import { getDb } from "../config/db.js";
import { parseObjectId } from "../lib/validation.js";

const users = () => getDb().collection("users");

export function findUserByUsername(username) {
  return users().findOne({ usernameLower: username.trim().toLowerCase() });
}

export async function findUserById(id) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return users().findOne({ _id }, { projection: { passwordHash: 0 } });
}

export async function createUser({ username, passwordHash }) {
  const doc = {
    username,
    usernameLower: username.toLowerCase(),
    passwordHash,
    createdAt: new Date(),
  };
  const { insertedId } = await users().insertOne(doc);
  return { ...doc, _id: insertedId };
}

// What the rest of the app (and Emily's routes) see as req.user.
// Keeps _id as an ObjectId for queries; never includes the password hash.
export function toSessionUser(user) {
  return {
    _id: user._id,
    id: user._id.toString(),
    username: user.username,
    createdAt: user.createdAt,
  };
}

// The shape sent to the browser.
export function toClientUser(user) {
  const { id, username, createdAt } = toSessionUser(user);
  return { id, username, createdAt };
}
