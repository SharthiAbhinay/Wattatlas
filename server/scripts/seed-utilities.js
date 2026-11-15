// Loads one year of the EIA-861 utility survey into MongoDB:
//
//   utilities           one document per utility (name, type, states)
//   utilityStats        one per utility, state, service type and year:
//                       customers, MWh, revenue, average use and price
//   utilityTerritories  one per utility, county and year (who serves where)
//
// In Excel, open each of the three EIA files and use File > Save As > CSV
// (that saves the first sheet, which is the one needed). Name them like this
// and put them in one folder per year:
//
//   data/raw/utilities/2025/Utility_Data_2025.csv
//   data/raw/utilities/2025/Sales_Ult_Cust_2025.csv
//   data/raw/utilities/2025/Service_Territory_2025.csv
//
//   npm run seed:utilities -- --year 2025
//   npm run seed:utilities -- --year 2025 --dry-run     (checks, saves nothing)
//
// Reseeding a year replaces only that year's stats and territories, so other
// years are kept and the script is safe to run again.
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { closeDb, connectDb } from "../config/db.js";
import { ensureIndexes } from "../config/indexes.js";
import { parseCsv } from "../lib/csv.js";
import { findState } from "../lib/states.js";

dotenv.config({ quiet: true });

const BATCH_SIZE = 2000;
const CLASSES = [
  "residential",
  "commercial",
  "industrial",
  "transportation",
  "total",
];
// Sales_Ult_Cust: Part A is bundled (energy and delivery together), B is
// energy only and C is delivery only. Part D is left out.
const PARTS = new Set(["A", "B", "C"]);

const TYPE_BY_OWNERSHIP = {
  "investor owned": "investor-owned",
  cooperative: "cooperative",
  municipal: "city-owned",
};
const utilityType = (ownership) => {
  const key = String(ownership).trim().toLowerCase();
  if (!key) return "unknown";
  return TYPE_BY_OWNERSHIP[key] ?? "other";
};

// EIA writes "." (or nothing) where a figure is missing.
function toNumber(value) {
  const text = String(value ?? "").replace(/[$,\s]/g, "");
  if (text === "" || text === ".") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// Rows under the header row, plus a lookup from header name to column.
function readTable(rows, file) {
  const headerAt = rows.findIndex((r) => r[0]?.trim() === "Data Year");
  if (headerAt === -1) {
    throw new Error(`${file}: couldn't find a "Data Year" header row.`);
  }
  const columns = {};
  rows[headerAt].forEach((header, i) => {
    const name = header.trim().split("\n")[0].trim();
    if (name && !(name in columns)) columns[name] = i;
  });
  return { rows: rows.slice(headerAt + 1), headerAt, columns };
}

function need(columns, names, file) {
  for (const name of names) {
    if (!(name in columns)) {
      throw new Error(`${file}: no "${name}" column. Is it the right sheet?`);
    }
  }
}

async function readCsv(dir, name, year) {
  const file = path.join(dir, `${name}_${year}.csv`);
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new Error(
      `Can't find ${file}. See the notes at the top of this script.`
    );
  }
  return { file, rows: parseCsv(text) };
}

// "Utility_Data": utility number -> name, ownership and states.
function readUtilities({ file, rows }) {
  const table = readTable(rows, file);
  const { columns } = table;
  need(
    columns,
    ["Utility Number", "Utility Name", "State", "Ownership Type"],
    file
  );
  const utilities = new Map();
  for (const row of table.rows) {
    const utilityId = toNumber(row[columns["Utility Number"]]);
    const state = findState(row[columns.State]);
    if (utilityId === null || !state) continue;
    const entry = utilities.get(utilityId) ?? {
      utilityId,
      name: row[columns["Utility Name"]].trim(),
      ownership: row[columns["Ownership Type"]].trim(),
      states: new Set(),
    };
    entry.states.add(state.abbr);
    utilities.set(utilityId, entry);
  }
  return utilities;
}

// The three header rows are: class names (merged cells, so only the first
// column of each group has the name), then Revenues / Sales / Customers, then
// the column titles.
function classColumns(rows, headerAt, file) {
  if (headerAt < 2)
    throw new Error(`${file}: expected two header rows above "Data Year".`);
  const groups = [];
  let current = "";
  for (const cell of rows[headerAt - 2]) {
    if (cell.trim()) current = cell.trim().toLowerCase();
    groups.push(current);
  }
  const measures = {
    revenues: "revenue",
    sales: "mwh",
    customers: "customers",
  };
  const found = {};
  rows[headerAt - 1].forEach((cell, i) => {
    const measure = measures[cell.trim().toLowerCase()];
    if (measure && CLASSES.includes(groups[i])) {
      found[groups[i]] = { ...found[groups[i]], [measure]: i };
    }
  });
  for (const name of CLASSES) {
    const c = found[name];
    if (!c?.revenue || !c.mwh || !c.customers) {
      throw new Error(
        `${file}: couldn't find the ${name} revenue, sales and customer columns.`
      );
    }
  }
  return found;
}

function classStats(row, c) {
  const revenueThousands = toNumber(row[c.revenue]);
  const mwh = toNumber(row[c.mwh]);
  const customers = toNumber(row[c.customers]);
  if (revenueThousands === null && mwh === null && customers === null)
    return null;
  return {
    customers,
    mwh,
    revenueThousands,
    // Average monthly use per customer, in kWh.
    kwhPerMonth:
      customers > 0 && mwh !== null ? (mwh * 1000) / customers / 12 : null,
    // Revenue is in thousand dollars and sales in MWh, so the x100 makes cents per kWh.
    centsPerKwh:
      mwh > 0 && revenueThousands !== null
        ? (revenueThousands * 100) / mwh
        : null,
  };
}

// "Sales_Ult_Cust": one row per utility, state and service type.
function readStats({ file, rows }, year) {
  const table = readTable(rows, file);
  const { columns } = table;
  need(
    columns,
    [
      "Utility Number",
      "Utility Name",
      "Part",
      "Service Type",
      "State",
      "Ownership",
    ],
    file
  );
  const classes = classColumns(rows, table.headerAt, file);
  const stats = [];
  let skipped = 0;
  for (const row of table.rows) {
    const utilityId = toNumber(row[columns["Utility Number"]]);
    const state = findState(row[columns.State]);
    const part = row[columns.Part].trim();
    if (utilityId === null || !state || !PARTS.has(part)) {
      skipped += 1;
      continue;
    }
    const doc = {
      utilityId,
      name: row[columns["Utility Name"]].trim(),
      state: state.abbr,
      year,
      serviceType: row[columns["Service Type"]].trim(),
      ownership: row[columns.Ownership].trim(),
    };
    for (const name of CLASSES) doc[name] = classStats(row, classes[name]);
    stats.push(doc);
  }
  return { stats, skipped };
}

// "Hennepin County", "St. Louis" and "Saint Louis" should all find the
// same place, while "Baltimore city" stays different from "Baltimore".
const countyKey = (state, name) =>
  `${state}|${name
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/\s+(county|parish|borough|census area|municipality)$/, "")
    .replace(/\s+/g, " ")
    .trim()}`;

// "Service_Territory": one row per utility, state and county.
function readTerritories({ file, rows }, year, countyLookup) {
  const table = readTable(rows, file);
  const { columns } = table;
  need(columns, ["Utility Number", "Utility Name", "State", "County"], file);
  const territories = [];
  const names = new Map();
  const shortForm = new Set();
  const unmatched = new Set();
  for (const row of table.rows) {
    const utilityId = toNumber(row[columns["Utility Number"]]);
    const state = findState(row[columns.State]);
    const county = row[columns.County].trim();
    if (utilityId === null || !state || !county) continue;
    names.set(utilityId, row[columns["Utility Name"]].trim());
    if (row[columns["Short Form"]]?.trim().toUpperCase() === "Y") {
      shortForm.add(utilityId);
    }
    const place = countyLookup.get(countyKey(state.abbr, county));
    if (!place) unmatched.add(`${county}, ${state.abbr}`);
    territories.push({
      utilityId,
      year,
      state: state.abbr,
      // Spelled the way the places data (and a household's county) spells it.
      county: place?.name ?? county,
      countyFips: place?.fips ?? null,
    });
  }
  return { territories, unmatched, names, shortForm };
}

async function insertAll(collection, documents) {
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    await collection.insertMany(documents.slice(i, i + BATCH_SIZE), {
      ordered: false,
    });
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      year: { type: "string", default: "2025" },
      dir: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const year = Number(values.year);
  if (!Number.isInteger(year))
    throw new Error("--year must be a year, like 2025.");
  const dir = values.dir ?? path.join("data", "raw", "utilities", String(year));

  const [utilityFile, salesFile, territoryFile] = await Promise.all([
    readCsv(dir, "Utility_Data", year),
    readCsv(dir, "Sales_Ult_Cust", year),
    readCsv(dir, "Service_Territory", year),
  ]);
  const utilities = readUtilities(utilityFile);
  const { stats, skipped } = readStats(salesFile, year);

  const db = await connectDb();
  const placeCounties = await db
    .collection("places")
    .find(
      { type: "county" },
      { projection: { _id: 0, state: 1, name: 1, fips: 1 } }
    )
    .toArray();
  const countyLookup = new Map(
    placeCounties.map((p) => [countyKey(p.state, p.name), p])
  );
  const { territories, unmatched, names, shortForm } = readTerritories(
    territoryFile,
    year,
    countyLookup
  );

  // A utility that only shows up in the sales or territory files still gets a
  // record, so every stats row and territory row points at a real utility.
  for (const s of stats) {
    if (!utilities.has(s.utilityId)) {
      utilities.set(s.utilityId, {
        utilityId: s.utilityId,
        name: s.name,
        ownership: s.ownership,
        states: new Set(),
      });
    }
    utilities.get(s.utilityId).states.add(s.state);
  }
  // Small utilities file the short EIA-861S form, so they appear in the
  // territory file but have no sales figures here. Keep them by name.
  let nameOnly = 0;
  for (const t of territories) {
    if (!utilities.has(t.utilityId)) {
      utilities.set(t.utilityId, {
        utilityId: t.utilityId,
        name: names.get(t.utilityId),
        ownership: "",
        states: new Set(),
      });
      nameOnly += 1;
    }
    utilities.get(t.utilityId).states.add(t.state);
  }

  console.log(`Year ${year}`);
  console.log(`  utilities           ${utilities.size.toLocaleString()}`);
  console.log(
    `  utility stats       ${stats.length.toLocaleString()} (skipped ${skipped.toLocaleString()} rows: territories, Part D or blank)`
  );
  console.log(`  service territories ${territories.length.toLocaleString()}`);
  if (placeCounties.length === 0) {
    console.log(
      "  County matching: the places collection has no counties yet, so no FIPS codes were added. Run seed:places for counties first."
    );
  } else {
    const matched =
      territories.length - territories.filter((t) => !t.countyFips).length;
    console.log(
      `  counties matched to places data: ${matched.toLocaleString()} of ${territories.length.toLocaleString()}`
    );
    if (unmatched.size) {
      console.log(
        `  ${unmatched.size} county names didn't match, for example: ${[...unmatched].slice(0, 8).join("; ")}`
      );
    }
  }
  if (nameOnly) {
    console.log(
      `  ${nameOnly.toLocaleString()} utilities appear only in the territory file (mostly short-form filers), so they have a name and counties but no type or figures.`
    );
  }

  if (values["dry-run"]) {
    console.log("Dry run: nothing was saved.");
    return;
  }

  // Years can be seeded in any order. A utility's name, ownership and states
  // come from its newest year, so an older year never overwrites them.
  const now = new Date();
  await db.collection("utilities").bulkWrite(
    [...utilities.values()].map((u) => {
      const keep = (field, value) => ({
        $cond: ["$isNewest", { $literal: value }, `$${field}`],
      });
      return {
        updateOne: {
          filter: { utilityId: u.utilityId },
          update: [
            {
              $set: {
                isNewest: { $gte: [year, { $ifNull: ["$latestYear", 0] }] },
              },
            },
            {
              $set: {
                name: keep("name", u.name),
                ownership: keep("ownership", u.ownership),
                type: keep("type", utilityType(u.ownership)),
                shortForm: keep("shortForm", shortForm.has(u.utilityId)),
                states: keep("states", [...u.states].sort()),
                latestYear: { $max: [year, { $ifNull: ["$latestYear", 0] }] },
                createdAt: { $ifNull: ["$createdAt", now] },
                updatedAt: now,
              },
            },
            { $unset: "isNewest" },
          ],
          upsert: true,
        },
      };
    })
  );
  await db.collection("utilityStats").deleteMany({ year });
  await insertAll(db.collection("utilityStats"), stats);
  await db.collection("utilityTerritories").deleteMany({ year });
  await insertAll(db.collection("utilityTerritories"), territories);
  await ensureIndexes();
  console.log("Saved.");
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
