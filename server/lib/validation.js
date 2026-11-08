import { ObjectId } from "mongodb";
import { isStateAbbr } from "./states.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  passwordMin: 8,
  passwordMaxBytes: 72, // bcrypt ignores anything past 72 bytes
  comparisonNameMax: 80,
  comparisonNotesMax: 2000,
  comparisonStatesMax: 4,
};

export function parseObjectId(value) {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value)
    ? new ObjectId(value)
    : null;
}

// Reads an integer query parameter. Missing values get the fallback;
// values that are present but invalid or out of range return null.
export function parseIntParam(value, { min, max, fallback }) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateRegistration(body = {}) {
  const errors = [];
  const username = trimmed(body.username);
  const password = typeof body.password === "string" ? body.password : "";

  if (
    username.length < LIMITS.usernameMin ||
    username.length > LIMITS.usernameMax
  ) {
    errors.push(
      `Username must be ${LIMITS.usernameMin} to ${LIMITS.usernameMax} characters.`
    );
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.push(
      "Username can use letters, numbers, dots, dashes and underscores."
    );
  }
  if (password.length < LIMITS.passwordMin) {
    errors.push(`Password must be at least ${LIMITS.passwordMin} characters.`);
  } else if (Buffer.byteLength(password, "utf8") > LIMITS.passwordMaxBytes) {
    errors.push("Password is too long.");
  }

  return { errors, value: { username, password } };
}

export function validateComparison(body = {}) {
  const errors = [];
  const name = trimmed(body.name);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const rawStates = Array.isArray(body.states) ? body.states : [];
  const cleaned = rawStates
    .filter((s) => typeof s === "string")
    .map((s) => s.trim().toUpperCase());
  const states = [...new Set(cleaned)];

  if (!name) errors.push("Give the comparison a name.");
  if (name.length > LIMITS.comparisonNameMax) {
    errors.push(
      `Name must be ${LIMITS.comparisonNameMax} characters or fewer.`
    );
  }
  if (states.length === 0) errors.push("Pick at least one state.");
  if (states.length > LIMITS.comparisonStatesMax) {
    errors.push(
      `A comparison can hold up to ${LIMITS.comparisonStatesMax} states.`
    );
  }
  if (cleaned.length !== states.length) {
    errors.push("Each state can appear only once.");
  }
  const unknown = states.filter((s) => !isStateAbbr(s));
  if (unknown.length) {
    errors.push(`Unknown state code: ${unknown.join(", ")}.`);
  }
  if (notes.length > LIMITS.comparisonNotesMax) {
    errors.push(
      `Notes must be ${LIMITS.comparisonNotesMax} characters or fewer.`
    );
  }

  return { errors, value: { name, states, notes } };
}
