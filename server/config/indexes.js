import { getDb } from "./db.js";

// createIndex does nothing when the index already exists, so this runs on
// every server start and at the end of each seed script.
export async function ensureIndexes() {
  const db = getDb();
  await Promise.all([
    db.collection("users").createIndex({ usernameLower: 1 }, { unique: true }),
    db.collection("comparisons").createIndex({ userId: 1, updatedAt: -1 }),
    db
      .collection("stateSales")
      .createIndex(
        { state: 1, sector: 1, year: 1, month: 1 },
        { unique: true }
      ),
    db.collection("stateSales").createIndex({ year: 1, sector: 1 }),
    db.collection("places").createIndex({ type: 1, state: 1, total: -1 }),
  ]);
}
