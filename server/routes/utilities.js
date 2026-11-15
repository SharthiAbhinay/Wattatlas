import { Router } from "express";
import { isStateAbbr } from "../lib/states.js";
import { findCounty } from "../models/places.js";
import {
  compareUtilities,
  utilityTrends,
  listUtilitiesForCounty,
  listUtilitiesForState,
} from "../models/utilities.js";
import { LIMITS } from "../lib/validation.js";

const router = Router();

// GET /api/utilities/county?state=AZ&county=Maricopa%20County
// The utilities that serve a county, biggest first.
router.get("/county", async (req, res) => {
  const state = String(req.query.state ?? "").toUpperCase();
  const name = String(req.query.county ?? "").trim();
  if (!isStateAbbr(state) || !name) {
    return res.status(400).json({ error: "Give a state and a county." });
  }
  const county = await findCounty(state, name);
  if (!county) {
    return res
      .status(404)
      .json({ error: `${name} isn't a county in ${state}.` });
  }
  const { year, items } = await listUtilitiesForCounty(state, county.name);
  res.json({ state, county: county.name, year, items });
});

// GET /api/utilities?state=AZ
// Every utility that serves a state, biggest first (for pickers).
router.get("/", async (req, res) => {
  const state = String(req.query.state ?? "").toUpperCase();
  if (!isStateAbbr(state)) {
    return res.status(400).json({ error: "Give a valid state." });
  }
  res.json(await listUtilitiesForState(state));
});

// Reads ?ids=803,16572 into one to four utility numbers, or sends a 400.
function readIds(req, res) {
  const ids = [
    ...new Set(
      String(req.query.ids ?? "")
        .split(",")
        .map((id) => Number(id.trim()))
    ),
  ];
  if (
    ids.length === 0 ||
    ids.length > LIMITS.comparisonUtilitiesMax ||
    ids.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    res.status(400).json({
      error: `Give one to ${LIMITS.comparisonUtilitiesMax} utility numbers.`,
    });
    return null;
  }
  return ids;
}

// GET /api/utilities/compare?ids=803,16572
// Residential figures for up to four utilities, in the order given.
router.get("/compare", async (req, res) => {
  const ids = readIds(req, res);
  if (ids) res.json({ items: await compareUtilities(ids) });
});

// GET /api/utilities/trend?ids=803,16572
// Average home usage and price per kWh for each year of data.
router.get("/trend", async (req, res) => {
  const ids = readIds(req, res);
  if (ids) res.json({ items: await utilityTrends(ids) });
});

export default router;
