import MongoStore from "connect-mongo";
import session from "express-session";
import { getClientPromise, getDbName } from "./db.js";

export const SESSION_COOKIE_NAME = "wattatlas.sid";
const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;

export function createSessionMiddleware({ secure }) {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      clientPromise: getClientPromise(),
      dbName: getDbName(),
      collectionName: "sessions",
      ttl: TWO_WEEKS_SECONDS,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: TWO_WEEKS_SECONDS * 1000,
    },
  });
}
