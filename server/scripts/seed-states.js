// Loads about 10 years of monthly electricity sales for every state and
// sector from the EIA Open Data API into the stateSales collection.
//
//   npm run seed:states
//   npm run seed:states -- --start-year 2015
//
// Needs EIA_API_KEY in .env (free: https://www.eia.gov/opendata/register.php).
import dotenv from "dotenv";
import { parseArgs } from "node:util";
import { closeDb, connectDb } from "../config/db.js";
import { ensureIndexes } from "../config/indexes.js";
import { SECTOR_IDS, STATE_BY_ABBR } from "../lib/states.js";

dotenv.config({ quiet: true });

const API_URL = "https://api.eia.gov/v2/electricity/retail-sales/data/";
const PAGE_SIZE = 5000; // the most EIA returns per request
const BATCH_SIZE = 5000;

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildUrl(apiKey, startPeriod, offset) {
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "monthly",
    start: startPeriod,
    offset: String(offset),
    length: String(PAGE_SIZE),
  });
  ["customers", "price", "revenue", "sales"].forEach((field, i) =>
    params.append(`data[${i}]`, field)
  );
  SECTOR_IDS.forEach((sector) => params.append("facets[sectorid][]", sector));
  params.append("sort[0][column]", "period");
  params.append("sort[0][direction]", "asc");
  return `${API_URL}?${params}`;
}

async function fetchPage(url, attempt = 1) {
  const response = await fetch(url);
  if (response.ok) return response.json();
  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    return fetchPage(url, attempt + 1);
  }
  const body = await response.text();
  throw new Error(`EIA API returned ${response.status}: ${body.slice(0, 300)}`);
}

function toDocument(row) {
  const state = STATE_BY_ABBR.get(row.stateid);
  if (!state || !SECTOR_IDS.includes(row.sectorid)) return null;
  const [year, month] = String(row.period).split("-").map(Number);
  if (!year || !month) return null;
  return {
    state: state.abbr,
    sector: row.sectorid,
    year,
    month,
    sales: toNumber(row.sales), // million kWh (GWh)
    revenue: toNumber(row.revenue), // million dollars
    price: toNumber(row.price), // cents per kWh, as reported by EIA
    customers: toNumber(row.customers),
  };
}

async function main() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Set EIA_API_KEY in .env. Get a free key at https://www.eia.gov/opendata/register.php"
    );
  }
  const { values } = parseArgs({
    options: { "start-year": { type: "string" } },
  });
  const startYear =
    Number(values["start-year"]) || new Date().getFullYear() - 10;
  const startPeriod = `${startYear}-01`;

  const documents = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const json = await fetchPage(buildUrl(apiKey, startPeriod, offset));
    if (!json.response) {
      throw new Error(
        `Unexpected EIA response: ${JSON.stringify(json).slice(0, 300)}`
      );
    }
    total = Number(json.response.total);
    const rows = json.response.data ?? [];
    for (const row of rows) {
      const doc = toDocument(row);
      if (doc) documents.push(doc);
    }
    offset += PAGE_SIZE;
    process.stdout.write(
      `\rDownloaded ${Math.min(offset, total).toLocaleString()} of ${total.toLocaleString()} EIA rows`
    );
    if (rows.length === 0) break;
  }
  process.stdout.write("\n");

  if (documents.length === 0) {
    throw new Error(
      "EIA returned no state rows. Check the API key and start year."
    );
  }

  const db = await connectDb();
  const collection = db.collection("stateSales");
  await collection.deleteMany({});
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    await collection.insertMany(documents.slice(i, i + BATCH_SIZE), {
      ordered: false,
    });
  }
  await ensureIndexes();

  let first = Infinity;
  let last = -Infinity;
  for (const d of documents) {
    const period = d.year * 100 + d.month;
    first = Math.min(first, period);
    last = Math.max(last, period);
  }
  const format = (p) =>
    `${Math.floor(p / 100)}-${String(p % 100).padStart(2, "0")}`;
  const states = new Set(documents.map((d) => d.state)).size;
  console.log(
    `Saved ${documents.length.toLocaleString()} monthly records for ${states} states, ${format(first)} to ${format(last)}.`
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
