import bcrypt from "bcrypt";
import { Router } from "express";
import passport from "passport";
import { SESSION_COOKIE_NAME } from "../config/session.js";
import {
  createUser,
  findUserByUsername,
  toClientUser,
} from "../models/users.js";
import { validateRegistration } from "../lib/validation.js";

const BCRYPT_ROUNDS = 12;
const USERNAME_TAKEN = "That username is taken. Try another one.";

const router = Router();

router.get("/me", (req, res) => {
  res.json({ user: req.user ? toClientUser(req.user) : null });
});

router.post("/register", async (req, res, next) => {
  const { errors, value } = validateRegistration(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  if (await findUserByUsername(value.username)) {
    return res.status(409).json({ error: USERNAME_TAKEN });
  }

  const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await createUser({ username: value.username, passwordHash });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: USERNAME_TAKEN });
    }
    throw err;
  }

  req.login(user, (err) => {
    if (err) return next(err);
    res.status(201).json({ user: toClientUser(user) });
  });
});

router.post("/login", (req, res, next) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Enter your username and password." });
  }

  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res
        .status(401)
        .json({ error: info?.message || "Incorrect username or password." });
    }
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.json({ user: toClientUser(user) });
    });
  })(req, res, next);
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(204).end();
    });
  });
});

export default router;
