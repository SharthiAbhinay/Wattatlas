import { getDb } from "../config/db.js";

const households = () => getDb().collection("households");

// Each household has its own _id and a memberIds array of user ObjectIds.
// A user belongs to at most one household (unique index on memberIds).

export function findHousehold(userId) {
  return households().findOne({ memberIds: userId });
}

// Bills belong to a household, so a user who hasn't set one up yet gets an
// empty one (no state or size) the first time they need it.
export async function ensureHousehold(userId) {
  const existing = await findHousehold(userId);
  if (existing) return existing;
  const now = new Date();
  const doc = {
    state: null,
    size: null,
    memberIds: [userId],
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await households().insertOne(doc);
  return { ...doc, _id: insertedId };
}

export async function saveHousehold(userId, { state, size }) {
  const existing = await findHousehold(userId);
  if (existing) {
    return households().findOneAndUpdate(
      { _id: existing._id },
      { $set: { state, size, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  }
  const now = new Date();
  const doc = {
    state,
    size,
    memberIds: [userId],
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await households().insertOne(doc);
  return { ...doc, _id: insertedId };
}
