import { getDb } from "./db.js";

// Households used to be keyed by a single userId. Convert those documents to
// memberIds: [userId] and drop the old unique userId index, which would
// reject new households that have no userId.
async function migrateHouseholds(db) {
  const households = db.collection("households");
  await households.updateMany({ userId: { $exists: true } }, [
    { $set: { memberIds: ["$userId"] } },
    { $unset: "userId" },
  ]);
  await households.dropIndex("userId_1").catch(() => null);

  // Bills used to be keyed by userId. Give each one its household and author.
  const bills = db.collection("bills");
  await bills.dropIndex("userId_1_month_-1").catch(() => null);

  // An earlier version of the household index had no partialFilterExpression.
  // createIndex can't change an existing index's options, so drop that one
  // (only that one) and let ensureIndexes recreate it.
  const existing = await bills.indexes().catch(() => []);
  const stale = existing.find(
    (i) => i.name === "householdId_1_month_-1" && !i.partialFilterExpression
  );
  if (stale) await bills.dropIndex(stale.name);
  const legacy = await bills.find({ userId: { $exists: true } }).toArray();
  for (const bill of legacy) {
    const household = await households.findOne({ memberIds: bill.userId });
    if (!household) continue;
    try {
      await bills.updateOne(
        { _id: bill._id },
        {
          $set: { householdId: household._id, authorId: bill.userId },
          $unset: { userId: "" },
        }
      );
    } catch (err) {
      // Two members of one household billed the same month: keep the first.
      if (err.code !== 11000) throw err;
    }
  }
}

// createIndex does nothing when the index already exists, so this runs on
// every server start and at the end of each seed script.
export async function ensureIndexes() {
  const db = getDb();
  await migrateHouseholds(db);
  await Promise.all([
    db.collection("users").createIndex({ usernameLower: 1 }, { unique: true }),
    db.collection("households").createIndex({ memberIds: 1 }, { unique: true }),
    db
      .collection("bills")
      .createIndex(
        { householdId: 1, month: -1 },
        // Skip any leftover bills that never got a household.
        { unique: true, partialFilterExpression: { householdId: { $exists: true } } }
      ),
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
