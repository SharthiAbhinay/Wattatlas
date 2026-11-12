import { getDb } from "../config/db.js";

const households = () => getDb().collection("households");

// One household per user.

export function findHousehold(userId) {
  return households().findOne({ userId });
}

export function saveHousehold(userId, { state, size }) {
  return households().findOneAndUpdate(
    { userId },
    {
      $set: { state, size, updatedAt: new Date() },
      $setOnInsert: { userId, createdAt: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );
}
