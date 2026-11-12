import { getDb } from "../config/db.js";

const bills = () => getDb().collection("bills");

// One bill per user per month; every query filters on userId.

export function listBills(userId) {
  return bills().find({ userId }).sort({ month: -1 }).toArray();
}

export function saveBill(userId, { month, kwh, cost }) {
  return bills().findOneAndUpdate(
    { userId, month },
    {
      $set: { kwh, cost, updatedAt: new Date() },
      $setOnInsert: { userId, month, createdAt: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );
}

export async function deleteBill(userId, _id) {
  const { deletedCount } = await bills().deleteOne({ _id, userId });
  return deletedCount === 1;
}
