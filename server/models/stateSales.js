import { getDb } from "../config/db.js";
import { summarizeYear } from "../lib/stateStats.js";

const stateSales = () => getDb().collection("stateSales");

// The EIA data only changes when someone reseeds, so summaries are kept in
// memory for a few minutes. Empty results are not kept, so a first seed
// shows up without restarting the server.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

async function cached(key, compute) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await compute();
  if (value !== null) cache.set(key, { value, expires: Date.now() + CACHE_MS });
  return value;
}

// A month counts only when EIA reported a sales figure for it.
const REPORTED = { $cond: [{ $gt: ["$sales", null] }, 1, 0] };

// Which years have all 12 months, and the latest month on file.
// Returns null when nothing has been seeded yet.
export function getCoverage() {
  return cached("coverage", async () => {
    const rows = await stateSales()
      .aggregate([
        { $match: { sector: "ALL" } },
        { $group: { _id: { year: "$year", month: "$month" } } },
        {
          $group: {
            _id: "$_id.year",
            months: { $sum: 1 },
            lastMonth: { $max: "$_id.month" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    const completeYears = rows.filter((r) => r.months === 12).map((r) => r._id);
    if (completeYears.length === 0) return null;
    const last = rows.at(-1);
    return {
      completeYears,
      latestYear: completeYears.at(-1),
      latestPeriod: `${last._id}-${String(last.lastMonth).padStart(2, "0")}`,
    };
  });
}

export function getYearSummary(year, sector) {
  return cached(`summary:${year}:${sector}`, async () => {
    const rows = await stateSales()
      .aggregate([
        { $match: { year, sector } },
        {
          $group: {
            _id: "$state",
            sales: { $sum: "$sales" },
            revenue: { $sum: "$revenue" },
            customers: { $avg: "$customers" },
            months: { $sum: REPORTED },
          },
        },
      ])
      .toArray();
    return summarizeYear(rows);
  });
}

export function getStateAnnual(state) {
  return stateSales()
    .aggregate([
      { $match: { state } },
      {
        $group: {
          _id: { sector: "$sector", year: "$year" },
          sales: { $sum: "$sales" },
          revenue: { $sum: "$revenue" },
          customers: { $avg: "$customers" },
          months: { $sum: REPORTED },
        },
      },
      {
        $project: {
          _id: 0,
          sector: "$_id.sector",
          year: "$_id.year",
          sales: 1,
          revenue: 1,
          customers: 1,
          months: 1,
        },
      },
    ])
    .toArray();
}

export function getStateMonthly(state, sector) {
  return stateSales()
    .find(
      { state, sector },
      { projection: { _id: 0, year: 1, month: 1, sales: 1 } }
    )
    .sort({ year: 1, month: 1 })
    .toArray();
}
