import { getDb } from "../config/db.js";

const db = () => getDb();

// The utilities with these utility numbers, as { utilityId, name, states, type, ownership }.
export function findUtilitiesByIds(ids) {
  return db()
    .collection("utilities")
    .find(
      { utilityId: { $in: ids } },
      {
        projection: {
          _id: 0,
          utilityId: 1,
          name: 1,
          states: 1,
          type: 1,
          ownership: 1,
        },
      }
    )
    .toArray();
}

// Bundled figures cover the whole bill, so they win over energy-only or
// delivery-only rows for the same utility.
const SERVICE_RANK = { Bundled: 0, Delivery: 1, Energy: 2 };

// The utilities that serve a county, using the newest year of territory data,
// each with its residential figures for that state and year when it has them.
export async function listUtilitiesForCounty(state, county) {
  const latest = await db()
    .collection("utilityTerritories")
    .find({ state, county })
    .sort({ year: -1 })
    .limit(1)
    .next();
  if (!latest) return { year: null, items: [] };
  const { year } = latest;

  const territories = await db()
    .collection("utilityTerritories")
    .find({ state, county, year })
    .toArray();
  const ids = [...new Set(territories.map((t) => t.utilityId))];

  const [utilities, stats] = await Promise.all([
    db()
      .collection("utilities")
      .find({ utilityId: { $in: ids } })
      .toArray(),
    db()
      .collection("utilityStats")
      .find({ utilityId: { $in: ids }, state, year })
      .toArray(),
  ]);

  const bestStats = new Map();
  for (const s of stats) {
    const current = bestStats.get(s.utilityId);
    const rank = SERVICE_RANK[s.serviceType] ?? 9;
    if (!current || rank < (SERVICE_RANK[current.serviceType] ?? 9)) {
      bestStats.set(s.utilityId, s);
    }
  }

  const items = utilities.map((u) => {
    const residential = bestStats.get(u.utilityId)?.residential ?? null;
    return {
      utilityId: u.utilityId,
      name: u.name,
      type: u.type,
      customers: residential?.customers ?? null,
      kwhPerMonth: residential?.kwhPerMonth ?? null,
      centsPerKwh: residential?.centsPerKwh ?? null,
    };
  });
  // Biggest first; utilities without figures go last, then by name.
  items.sort(
    (a, b) =>
      (b.customers ?? -1) - (a.customers ?? -1) || a.name.localeCompare(b.name)
  );
  return { year, items };
}

const rankOf = (serviceType) => SERVICE_RANK[serviceType] ?? 9;

// Every utility that serves a state, biggest first, with residential figures
// from the newest year of sales data for that state.
export async function listUtilitiesForState(state) {
  const latest = await db()
    .collection("utilityStats")
    .find({ state })
    .sort({ year: -1 })
    .limit(1)
    .next();
  const year = latest?.year ?? null;

  const [utilities, stats] = await Promise.all([
    db()
      .collection("utilities")
      .find(
        { states: state },
        { projection: { _id: 0, utilityId: 1, name: 1 } }
      )
      .toArray(),
    year === null
      ? []
      : db().collection("utilityStats").find({ state, year }).toArray(),
  ]);

  const best = new Map();
  for (const s of stats) {
    const current = best.get(s.utilityId);
    if (!current || rankOf(s.serviceType) < rankOf(current.serviceType)) {
      best.set(s.utilityId, s);
    }
  }
  const items = utilities.map((u) => {
    const residential = best.get(u.utilityId)?.residential ?? null;
    return {
      utilityId: u.utilityId,
      name: u.name,
      customers: residential?.customers ?? null,
    };
  });
  items.sort(
    (a, b) =>
      (b.customers ?? -1) - (a.customers ?? -1) || a.name.localeCompare(b.name)
  );
  return { state, year, items };
}

// Residential figures for one utility in one year. A utility that serves
// several states is added up across them, using its most complete service
// type (bundled first). Everything is null when there are no sales rows.
function residentialFigures(rows) {
  if (rows.length === 0) {
    return {
      customers: null,
      kwhPerMonth: null,
      centsPerKwh: null,
      monthlyBill: null,
    };
  }
  const rank = Math.min(...rows.map((s) => rankOf(s.serviceType)));
  const chosen = rows.filter((s) => rankOf(s.serviceType) === rank);
  const sum = (field) => {
    const values = chosen
      .map((s) => s.residential?.[field])
      .filter((v) => v !== null && v !== undefined);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const customers = sum("customers");
  const mwh = sum("mwh");
  const revenue = sum("revenueThousands");
  return {
    customers,
    kwhPerMonth:
      customers > 0 && mwh !== null ? (mwh * 1000) / customers / 12 : null,
    centsPerKwh: mwh > 0 && revenue !== null ? (revenue * 100) / mwh : null,
    monthlyBill:
      customers > 0 && revenue !== null
        ? (revenue * 1000) / customers / 12
        : null,
  };
}

async function loadUtilitiesAndStats(ids) {
  const [utilities, stats] = await Promise.all([
    findUtilitiesByIds(ids),
    db()
      .collection("utilityStats")
      .find({ utilityId: { $in: ids } })
      .toArray(),
  ]);
  return { byUtility: new Map(utilities.map((u) => [u.utilityId, u])), stats };
}

// Side-by-side residential figures for each utility's newest year, in the
// order given. Utilities with no sales figures come back with nulls.
export async function compareUtilities(ids) {
  const { byUtility, stats } = await loadUtilitiesAndStats(ids);

  return ids
    .filter((id) => byUtility.has(id))
    .map((utilityId) => {
      const { name, states, type, ownership } = byUtility.get(utilityId);
      const rows = stats.filter((s) => s.utilityId === utilityId);
      const year = Math.max(...rows.map((s) => s.year), -Infinity);
      const ofYear = rows.filter((s) => s.year === year);
      return {
        utilityId,
        name,
        states,
        type,
        ownership,
        year: ofYear.length ? year : null,
        ...residentialFigures(ofYear),
      };
    });
}

// Residential figures year by year (oldest first) for each utility, in the
// order given, for charts of average home usage and price over time. A year
// the utility has no sales rows for is left out.
export async function utilityTrends(ids) {
  const { byUtility, stats } = await loadUtilitiesAndStats(ids);

  return ids
    .filter((id) => byUtility.has(id))
    .map((utilityId) => {
      const rows = stats.filter((s) => s.utilityId === utilityId);
      const years = [...new Set(rows.map((s) => s.year))].sort((a, b) => a - b);
      return {
        utilityId,
        name: byUtility.get(utilityId).name,
        years: years.map((year) => ({
          year,
          ...residentialFigures(rows.filter((s) => s.year === year)),
        })),
      };
    });
}
