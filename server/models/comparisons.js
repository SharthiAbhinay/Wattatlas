import { getDb } from "../config/db.js";

const comparisons = () => getDb().collection("comparisons");

// Every query filters on userId, so one user can never read or change
// another user's comparison; a foreign id simply looks like "not found".

export function listComparisons(userId) {
  return comparisons().find({ userId }).sort({ updatedAt: -1 }).toArray();
}

export function findComparison(userId, _id) {
  return comparisons().findOne({ _id, userId });
}

export async function createComparison(userId, { name, states, notes }) {
  const now = new Date();
  const doc = { userId, name, states, notes, createdAt: now, updatedAt: now };
  const { insertedId } = await comparisons().insertOne(doc);
  return { ...doc, _id: insertedId };
}

export function updateComparison(userId, _id, { name, states, notes }) {
  return comparisons().findOneAndUpdate(
    { _id, userId },
    { $set: { name, states, notes, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
}

export async function deleteComparison(userId, _id) {
  const { deletedCount } = await comparisons().deleteOne({ _id, userId });
  return deletedCount === 1;
}

export function toClientComparison(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    states: doc.states,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
