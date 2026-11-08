// Loads NREL City and County Energy Profiles (modeled yearly electricity use)
// into the places collection. Download the CSV files first; see the README.
//
//   npm run seed:places -- --type city --file data/raw/cities.csv
//   npm run seed:places -- --type county --file data/raw/counties.csv
//
// NREL has published these files in a few layouts, so columns are found by
// their headers. If a guess is wrong, name the column yourself:
//   --map "total=Total Electricity (MWh)"
// Reseeding a type replaces only that type.
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { closeDb, connectDb } from "../config/db.js";
import { ensureIndexes } from "../config/indexes.js";
import { findState } from "../lib/states.js";

dotenv.config({ quiet: true });

const BATCH_SIZE = 2000;
const FIPS_LENGTH = { city: 7, county: 5 };
const UNIT_FACTORS = { mwh: 1, kwh: 0.001, gwh: 1000 };
const SOURCE = "NREL City and County Energy Profiles (model estimate)";

const ELECTRIC = /elec|kwh|mwh|gwh/;
const NOT_ELECTRIC =
  /gas|ng_|therm|mcf|fuel|oil|propane|btu|cost|price|spend|per_/;
const isElectric = (h) => ELECTRIC.test(h) && !NOT_ELECTRIC.test(h);
const sectorColumn = (sector) => (h) =>
  isElectric(h) && new RegExp(`(^|_)${sector}`).test(h);

// For each field: exact header names to try first, then a looser test.
const FIELDS = {
  name: {
    city: ["city_name", "city", "place_name", "place", "municipality", "name"],
    county: ["county_name", "county", "name"],
  },
  state: {
    any: [
      "state_abbr",
      "state_abbreviation",
      "state_code",
      "stusps",
      "st",
      "state_name",
      "state",
    ],
  },
  fips: {
    city: ["geoid", "place_fips", "place_geoid", "fips", "geo_id"],
    county: ["geoid", "county_fips", "county_geoid", "fips", "geo_id"],
  },
  population: {
    any: ["population", "total_population", "pop"],
    test: (h) => /^pop|population/.test(h),
  },
  res: { test: sectorColumn("res") },
  com: { test: sectorColumn("com") },
  ind: { test: sectorColumn("ind") },
  total: {
    any: ["electricity_mwh", "total_electricity_mwh", "elec_mwh"],
    test: (h) => isElectric(h) && !/(^|_)(res|com|ind|tra|oth)/.test(h),
  },
  year: { any: ["year", "data_year"] },
};
const FIELD_NAMES = Object.keys(FIELDS);

// Parses CSV text into rows of strings. Handles quoted fields with commas,
// doubled quotes and line breaks, CRLF endings and a byte-order mark.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

// "Residential Electricity (MWh)" -> "residential_electricity_mwh"
function normalizeHeader(header) {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseOverrides(pairs = []) {
  const overrides = {};
  for (const pair of pairs) {
    const [field, ...rest] = pair.split("=");
    if (!FIELD_NAMES.includes(field) || rest.length === 0) {
      throw new Error(
        `--map expects field=Header, with field one of: ${FIELD_NAMES.join(", ")}.`
      );
    }
    overrides[field] = rest.join("=");
  }
  return overrides;
}

// Returns { field: columnIndex } for every field it can find.
function detectColumns(headers, type, overrides) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  const used = new Set();
  for (const [field, header] of Object.entries(overrides)) {
    const index = normalized.indexOf(normalizeHeader(header));
    if (index === -1) {
      throw new Error(`--map ${field}=${header}: no column with that header.`);
    }
    mapping[field] = index;
    used.add(index);
  }
  for (const [field, rule] of Object.entries(FIELDS)) {
    if (field in mapping) continue;
    const exact = [...(rule[type] ?? []), ...(rule.any ?? [])];
    let index = exact
      .map((name) => normalized.indexOf(name))
      .find((i) => i !== -1 && !used.has(i));
    if (index === undefined && rule.test) {
      index = normalized.findIndex((h, i) => !used.has(i) && rule.test(h));
    }
    if (index !== undefined && index !== -1) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

// Values are stored in MWh; guess the file's unit from its column header.
function detectUnitFactor(headers, mapping) {
  const field = ["total", "res", "com", "ind"].find((f) => f in mapping);
  const header = normalizeHeader(headers[mapping[field]]);
  if (/gwh/.test(header)) return UNIT_FACTORS.gwh;
  if (/(^|_)kwh/.test(header)) return UNIT_FACTORS.kwh;
  return UNIT_FACTORS.mwh;
}

function toNumber(value) {
  if (value === undefined) return null;
  const text = String(value).replace(/[$,\s]/g, "");
  if (text === "" || /^(n\/?a|null|-+)$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function cleanFips(value, type, state) {
  const digits = String(value ?? "").trim();
  if (!/^\d+$/.test(digits)) return null;
  const padded = digits.padStart(FIPS_LENGTH[type], "0");
  return padded.length === FIPS_LENGTH[type] && padded.startsWith(state.fips)
    ? padded
    : null;
}

function toDocument(row, mapping, { type, unitFactor, defaultYear }) {
  const cell = (field) => (field in mapping ? row[mapping[field]] : undefined);
  const state = findState(cell("state"));
  const name = String(cell("name") ?? "").trim();
  if (!state || !name) return null;

  const mwh = (field) => {
    const value = toNumber(cell(field));
    return value === null ? null : value * unitFactor;
  };
  const res = mwh("res");
  const com = mwh("com");
  const ind = mwh("ind");
  const sectors = [res, com, ind].filter((v) => v !== null);
  const total =
    mwh("total") ??
    (sectors.length ? sectors.reduce((a, b) => a + b, 0) : null);
  if (total === null) return null;

  const population = toNumber(cell("population"));
  return {
    type,
    state: state.abbr,
    name,
    fips: cleanFips(cell("fips"), type, state),
    population,
    res,
    com,
    ind,
    total,
    perCapita: population > 0 ? (total * 1000) / population : null, // kWh
    year: toNumber(cell("year")) ?? defaultYear,
    source: SOURCE,
    estimate: true,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      type: { type: "string" },
      file: { type: "string" },
      map: { type: "string", multiple: true },
      year: { type: "string" },
      units: { type: "string" },
    },
  });
  const { type } = values;
  if (!["city", "county"].includes(type) || !values.file) {
    throw new Error(
      "Usage: npm run seed:places -- --type city|county --file path/to/file.csv"
    );
  }

  const rows = parseCsv(await readFile(values.file, "utf8"));
  if (rows.length < 2) throw new Error(`${values.file} has no data rows.`);
  const [headers, ...dataRows] = rows;
  const mapping = detectColumns(headers, type, parseOverrides(values.map));

  console.log("Columns used:");
  for (const field of FIELD_NAMES) {
    const header =
      field in mapping ? `"${headers[mapping[field]]}"` : "(not found)";
    console.log(`  ${field.padEnd(10)} ${header}`);
  }
  const hasElectricity = ["total", "res", "com", "ind"].some(
    (f) => f in mapping
  );
  if (!("name" in mapping) || !("state" in mapping) || !hasElectricity) {
    throw new Error(
      `Couldn't find the name, state and electricity columns. Headers in the file:\n  ${headers.join(" | ")}\nPoint to them with --map, for example --map "total=Electricity (MWh)".`
    );
  }

  const unitFactor = values.units
    ? UNIT_FACTORS[values.units.toLowerCase()]
    : detectUnitFactor(headers, mapping);
  if (unitFactor === undefined) {
    throw new Error("--units must be kwh, mwh or gwh.");
  }

  const options = {
    type,
    unitFactor,
    defaultYear: values.year ? Number(values.year) : null,
  };
  const documents = [];
  let skipped = 0;
  for (const row of dataRows) {
    const doc = toDocument(row, mapping, options);
    if (doc) documents.push(doc);
    else skipped += 1;
  }
  if (documents.length === 0) throw new Error("No usable rows were found.");

  const db = await connectDb();
  const collection = db.collection("places");
  await collection.deleteMany({ type });
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    await collection.insertMany(documents.slice(i, i + BATCH_SIZE), {
      ordered: false,
    });
  }
  await ensureIndexes();

  const withFips = documents.filter((d) => d.fips).length;
  console.log(
    `Saved ${documents.length.toLocaleString()} ${type} records (${withFips.toLocaleString()} with a FIPS code). Skipped ${skipped.toLocaleString()} rows outside the 50 states and DC or without electricity figures.`
  );
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
