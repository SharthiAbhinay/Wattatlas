import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "./config/db.js";
import { configurePassport } from "./config/passport.js";
import { createSessionMiddleware } from "./config/session.js";
import authRouter from "./routes/auth.js";
import comparisonsRouter from "./routes/comparisons.js";
import placesRouter from "./routes/places.js";
import statesRouter from "./routes/states.js";

const distDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "frontend",
  "dist"
);

export function createApp() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not set. Add it to your .env file.");
  }
  const isProduction = process.env.NODE_ENV === "production";
  const passport = configurePassport();
  const app = express();

  app.disable("x-powered-by");
  // Hosts like Render and Vercel sit behind a proxy; this lets secure
  // cookies work there.
  if (isProduction) app.set("trust proxy", 1);

  app.use(express.json({ limit: "100kb" }));

  // Only API requests need the database and a session.
  app.use("/api", async (req, res, next) => {
    await connectDb();
    next();
  });
  app.use("/api", createSessionMiddleware({ secure: isProduction }));
  app.use("/api", passport.initialize());
  app.use("/api", passport.session());

  app.use("/api/auth", authRouter);
  app.use("/api/states", statesRouter);
  app.use("/api/places", placesRouter);
  app.use("/api/comparisons", comparisonsRouter);
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "There's no API route at that address." });
  });

  // The built React app. Any other GET returns index.html so React Router
  // can handle deep links like /comparisons/abc123.
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.use((req, res) => {
    res.status(404).send("Not found. Run npm run build to serve the app here.");
  });

  app.use((err, req, res, _next) => {
    if (err.type === "entity.parse.failed") {
      return res
        .status(400)
        .json({ error: "The request body isn't valid JSON." });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  return app;
}
