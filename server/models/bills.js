import { getDb } from "../config/db.js";

const bills = () => getDb().collection("bills");

// One bill per household per month. householdId says whose bill it is;
// authorId is the household member (user) who entered it.

export function listBills(householdId, limit = 5) {
  return bills()
    .find({ householdId })
    .sort({ month: -1 })
    .limit(limit)
    .toArray();
}

// Every bill the household has for one calendar year, January first.
export function listBillsForYear(householdId, year) {
  return bills()
    .find({ householdId, month: { $gte: `${year}-01`, $lte: `${year}-12` } })
    .sort({ month: 1 })
    .toArray();
}

export function findBill(householdId, month) {
  return bills().findOne({ householdId, month });
}

// Returns the new bill, or null when the household already has one for that
// month (the unique index on householdId + month decides, so two members
// submitting at once can't both win).
export async function createBill(householdId, authorId, { month, kwh, cost }) {
  const now = new Date();
  const doc = { householdId, authorId, month, kwh, cost, createdAt: now };
  try {
    const { insertedId } = await bills().insertOne(doc);
    return { ...doc, _id: insertedId };
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

export function findBillById(householdId, _id) {
  return bills().findOne({ _id, householdId });
}

// The month and author stay as they were; only the figures change.
export function updateBill(householdId, _id, { kwh, cost }) {
  return bills().findOneAndUpdate(
    { _id, householdId },
    { $set: { kwh, cost, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
}

export async function deleteBill(householdId, _id) {
  const { deletedCount } = await bills().deleteOne({ _id, householdId });
  return deletedCount === 1;
}
