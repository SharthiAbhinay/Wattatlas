import { getDb } from "../config/db.js";

const comparisons = () => getDb().collection("utilityComparisons");

// Like the state comparisons: every query filters on userId, so one user can
// never read or change another user's comparison; a foreign id simply looks
// like "not found". Only the utility numbers are stored. Names are looked up
// when the comparison is read, so they stay correct if the data is reseeded.

export function listUtilityComparisons(userId) {
  return comparisons().find({ userId }).sort({ updatedAt: -1 }).toArray();
}

export function findUtilityComparison(userId, _id) {
  return comparisons().findOne({ _id, userId });
}

export async function createUtilityComparison(
  userId,
  { name, utilityIds, notes }
) {
  const now = new Date();
  const doc = {
    userId,
    name,
    utilityIds,
    notes,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await comparisons().insertOne(doc);
  return { ...doc, _id: insertedId };
}

export function updateUtilityComparison(
  userId,
  _id,
  { name, utilityIds, notes }
) {
  return comparisons().findOneAndUpdate(
    { _id, userId },
    { $set: { name, utilityIds, notes, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
}

export async function deleteUtilityComparison(userId, _id) {
  const { deletedCount } = await comparisons().deleteOne({ _id, userId });
  return deletedCount === 1;
}
