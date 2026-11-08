import { Router } from "express";
import { seasonalTrendForecast } from "../lib/forecast.js";
import { buildStateDetail } from "../lib/stateStats.js";
import { SECTOR_IDS, STATE_BY_ABBR, STATES } from "../lib/states.js";
import { LIMITS } from "../lib/validation.js";
import {
  getCoverage,
  getStateAnnual,
  getStateMonthly,
  getYearSummary,
} from "../models/stateSales.js";

const NO_DATA = {
  error:
    "No electricity data has been loaded yet. Run npm run seed:states first.",
};
const HISTORY_MONTHS_SHOWN = 36;

const router = Router();

// Sends a 503 and returns null when the EIA data hasn't been seeded.
async function coverageOr503(res) {
  const coverage = await getCoverage();
  if (!coverage) res.status(503).json(NO_DATA);
  return coverage;
}

async function loadStateDetail(abbr, coverage) {
  const year = coverage.latestYear;
  const [annualRows, monthlyRows, ...summaryList] = await Promise.all([
    getStateAnnual(abbr),
    getStateMonthly(abbr, "ALL"),
    ...SECTOR_IDS.map((sector) => getYearSummary(year, sector)),
  ]);
  const summaries = Object.fromEntries(
    SECTOR_IDS.map((sector, i) => [sector, summaryList[i]])
  );
  return buildStateDetail({
    state: STATE_BY_ABBR.get(abbr),
    year,
    completeYears: coverage.completeYears,
    annualRows,
    monthlyRows,
    summaries,
  });
}

// GET /api/states: the list of states, for pickers.
router.get("/", (req, res) => {
  res.json({
    states: STATES.map(({ abbr, name, fips }) => ({ abbr, name, fips })),
  });
});

// GET /api/states/summary: every state's figures for the latest full year.
router.get("/summary", async (req, res) => {
  const coverage = await coverageOr503(res);
  if (!coverage) return;
  const summary = await getYearSummary(coverage.latestYear, "ALL");
  res.json({ year: coverage.latestYear, ...summary });
});

// GET /api/states/compare?states=AZ,OH
router.get("/compare", async (req, res) => {
  const abbrs = [
    ...new Set(
      String(req.query.states ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (
    abbrs.length === 0 ||
    abbrs.length > LIMITS.comparisonStatesMax ||
    abbrs.some((a) => !STATE_BY_ABBR.has(a))
  ) {
    return res.status(400).json({
      error: `List 1 to ${LIMITS.comparisonStatesMax} state codes, like states=AZ,OH.`,
    });
  }
  const coverage = await coverageOr503(res);
  if (!coverage) return;
  const details = await Promise.all(
    abbrs.map((abbr) => loadStateDetail(abbr, coverage))
  );
  res.json({
    year: coverage.latestYear,
    states: details.map((d) => ({
      abbr: d.abbr,
      name: d.name,
      summary: d.summary,
      residentialShare: d.sectors.find((s) => s.id === "RES")?.share ?? null,
      pattern: d.seasonality?.pattern ?? null,
      change: d.change,
      annual: d.annual.map((a) => ({
        year: a.year,
        sales: a.sales.ALL,
        perCapita: a.perCapita,
        price: a.price.ALL,
      })),
    })),
  });
});

// GET /api/states/AZ: figures, sector mix, seasonality and yearly history.
router.get("/:abbr", async (req, res) => {
  const abbr = req.params.abbr.toUpperCase();
  if (!STATE_BY_ABBR.has(abbr)) {
    return res.status(404).json({ error: "We don't have that state." });
  }
  const coverage = await coverageOr503(res);
  if (!coverage) return;
  res.json(await loadStateDetail(abbr, coverage));
});

// GET /api/states/AZ/forecast: recent monthly use and a simple forecast.
router.get("/:abbr/forecast", async (req, res) => {
  const abbr = req.params.abbr.toUpperCase();
  if (!STATE_BY_ABBR.has(abbr)) {
    return res.status(404).json({ error: "We don't have that state." });
  }
  const rows = await getStateMonthly(abbr, "ALL");
  const history = rows
    .filter((r) => Number.isFinite(r.sales))
    .map((r) => ({ year: r.year, month: r.month, value: r.sales }));
  const result = seasonalTrendForecast(history);
  if (!result) {
    return res.status(503).json({
      error: "There isn't enough history to forecast this state yet.",
    });
  }
  res.json({
    abbr,
    unit: "GWh",
    history: history.slice(-HISTORY_MONTHS_SHOWN).map((h) => ({
      period: `${h.year}-${String(h.month).padStart(2, "0")}`,
      value: h.value,
    })),
    ...result,
  });
});

export default router;
