import { STATES, SECTORS } from "./states.js";

// EIA units: sales in million kWh (= GWh), revenue in million dollars.
const KWH_PER_GWH = 1e6;
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const SUMMER = [6, 7, 8];
const WINTER = [12, 1, 2];
const SHOULDER = [3, 4, 5, 9, 10, 11];

function priceCents(revenue, sales) {
  return sales > 0 && Number.isFinite(revenue) ? (revenue / sales) * 100 : null;
}

function perCapitaKWh(salesGWh, population) {
  return population > 0 && Number.isFinite(salesGWh)
    ? (salesGWh * KWH_PER_GWH) / population
    : null;
}

function monthlyKWhPerCustomer(salesGWh, customers) {
  return customers > 0 && Number.isFinite(salesGWh)
    ? (salesGWh * KWH_PER_GWH) / customers / 12
    : null;
}

function percentChange(from, to) {
  return Number.isFinite(from) && Number.isFinite(to) && from !== 0
    ? ((to - from) / from) * 100
    : null;
}

function rankBy(states, field) {
  const ranked = states
    .filter((s) => s[field] !== null)
    .sort((a, b) => b[field] - a[field]);
  return new Map(ranked.map((s, i) => [s.abbr, i + 1]));
}

// rows: one per state for a single year and sector, as produced by
// getYearSummary: { _id: "AZ", sales, revenue, customers, months }.
// Only states with all 12 months reported get values.
export function summarizeYear(rows) {
  const byAbbr = new Map(rows.map((r) => [r._id, r]));
  const states = STATES.map((state) => {
    const row = byAbbr.get(state.abbr);
    const complete = row && row.months === 12;
    const sales = complete ? row.sales : null;
    const revenue = complete ? row.revenue : null;
    return {
      abbr: state.abbr,
      name: state.name,
      fips: state.fips,
      population: state.population,
      sales,
      revenue,
      customers: complete ? Math.round(row.customers) || null : null,
      price: priceCents(revenue, sales),
      perCapita: perCapitaKWh(sales, state.population),
    };
  });

  const perCapitaRank = rankBy(states, "perCapita");
  const priceRank = rankBy(states, "price");
  const salesRank = rankBy(states, "sales");
  for (const s of states) {
    s.rank = {
      perCapita: perCapitaRank.get(s.abbr) ?? null,
      price: priceRank.get(s.abbr) ?? null,
      sales: salesRank.get(s.abbr) ?? null,
    };
  }

  const reported = states.filter((s) => s.sales !== null);
  const sales = reported.reduce((sum, s) => sum + s.sales, 0);
  const revenue = reported.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
  const population = reported.reduce((sum, s) => sum + s.population, 0);
  const customers = reported.reduce((sum, s) => sum + (s.customers ?? 0), 0);

  return {
    states,
    national: {
      sales: reported.length ? sales : null,
      price: priceCents(revenue, sales),
      perCapita: perCapitaKWh(sales, population),
      customers: customers || null,
      statesReported: reported.length,
    },
  };
}

// monthlyRows: [{ year, month, sales }] for the ALL sector of one state.
// Returns a daily-usage index per calendar month (1 = the year's average day),
// so short February does not look like a low-usage month.
function seasonalProfile(monthlyRows, completeYears) {
  const complete = new Set(completeYears);
  const byYear = new Map();
  for (const row of monthlyRows) {
    if (!complete.has(row.year) || !Number.isFinite(row.sales)) continue;
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year).push(row);
  }
  const sums = new Array(12).fill(0);
  let years = 0;
  for (const rows of byYear.values()) {
    if (rows.length !== 12) continue;
    const yearlyDailyAverage =
      rows.reduce((sum, r) => sum + r.sales, 0) / 365.25;
    if (yearlyDailyAverage <= 0) continue;
    for (const r of rows) {
      sums[r.month - 1] +=
        r.sales / DAYS_IN_MONTH[r.month - 1] / yearlyDailyAverage;
    }
    years += 1;
  }
  if (years === 0) return null;

  const index = sums.map((s) => s / years);
  const average = (months) =>
    months.reduce((sum, m) => sum + index[m - 1], 0) / months.length;
  const summer = average(SUMMER);
  const winter = average(WINTER);
  const shoulder = average(SHOULDER);

  let pattern = "even";
  if (summer / shoulder >= 1.1 && winter / shoulder >= 1.1) pattern = "both";
  else if (summer >= winter * 1.08) pattern = "summer";
  else if (winter >= summer * 1.08) pattern = "winter";

  const peakMonth = index.indexOf(Math.max(...index)) + 1;
  return { index, peakMonth, summer, winter, shoulder, pattern, years };
}

// annualRows: [{ sector, year, sales, revenue, customers, months }] for one
// state. summaries: { ALL, RES, COM, IND, TRA } from summarizeYear for `year`.
export function buildStateDetail({
  state,
  year,
  completeYears,
  annualRows,
  monthlyRows,
  summaries,
}) {
  const complete = new Set(completeYears);
  const annualByYear = new Map();
  for (const row of annualRows) {
    if (!complete.has(row.year) || row.months !== 12) continue;
    if (!annualByYear.has(row.year)) annualByYear.set(row.year, {});
    annualByYear.get(row.year)[row.sector] = row;
  }

  const annual = [...annualByYear.keys()]
    .sort((a, b) => a - b)
    .filter((y) => annualByYear.get(y).ALL)
    .map((y) => {
      const bySector = annualByYear.get(y);
      const sales = {};
      for (const { id } of SECTORS) sales[id] = bySector[id]?.sales ?? null;
      return {
        year: y,
        sales,
        perCapita: perCapitaKWh(sales.ALL, state.population),
        price: {
          ALL: priceCents(bySector.ALL?.revenue, bySector.ALL?.sales),
          RES: priceCents(bySector.RES?.revenue, bySector.RES?.sales),
        },
      };
    });

  const find = (sector) =>
    summaries[sector]?.states.find((s) => s.abbr === state.abbr) ?? null;
  const all = find("ALL");
  const res = find("RES");
  const nationalAll = summaries.ALL?.national ?? {};
  const nationalRes = summaries.RES?.national ?? {};

  const sectors = SECTORS.filter((s) => s.id !== "ALL").map(({ id, label }) => {
    const row = find(id);
    const national = summaries[id]?.national;
    return {
      id,
      label,
      sales: row?.sales ?? null,
      price: row?.price ?? null,
      share: row?.sales != null && all?.sales ? row.sales / all.sales : null,
      nationalShare:
        national?.sales != null && nationalAll.sales
          ? national.sales / nationalAll.sales
          : null,
    };
  });

  const first = annual[0];
  const current = annual.find((a) => a.year === year);

  return {
    abbr: state.abbr,
    name: state.name,
    fips: state.fips,
    population: state.population,
    year,
    summary: {
      sales: all?.sales ?? null,
      perCapita: all?.perCapita ?? null,
      price: all?.price ?? null,
      avgHomeMonthlyKWh: monthlyKWhPerCustomer(res?.sales, res?.customers),
      rank: all?.rank ?? null,
      statesRanked: nationalAll.statesReported ?? null,
    },
    national: {
      perCapita: nationalAll.perCapita ?? null,
      price: nationalAll.price ?? null,
      avgHomeMonthlyKWh: monthlyKWhPerCustomer(
        nationalRes.sales,
        nationalRes.customers
      ),
    },
    sectors,
    seasonality: seasonalProfile(monthlyRows, completeYears),
    change:
      first && current && first.year < current.year
        ? {
            fromYear: first.year,
            toYear: current.year,
            salesPct: percentChange(first.sales.ALL, current.sales.ALL),
            pricePct: percentChange(first.price.ALL, current.price.ALL),
          }
        : null,
    annual,
  };
}
