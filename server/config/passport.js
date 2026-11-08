import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import {
  findUserById,
  findUserByUsername,
  toSessionUser,
} from "../models/users.js";

const LOGIN_FAILED = "Incorrect username or password.";

// Compared against when the username does not exist, so a wrong username
// takes as long to reject as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("wattatlas-timing-guard", 10);

let configured = false;

export function configurePassport() {
  if (configured) return passport;

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await findUserByUsername(username);
        const matches = await bcrypt.compare(
          password,
          user ? user.passwordHash : DUMMY_HASH
        );
        if (!user || !matches)
          return done(null, false, { message: LOGIN_FAILED });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user._id.toString()));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await findUserById(id);
      done(null, user ? toSessionUser(user) : false);
    } catch (err) {
      done(err);
    }
  });

  configured = true;
  return passport;
}
