import { Router } from "express";
import { STATE_BY_ABBR } from "../lib/states.js";
import { parseIntParam } from "../lib/validation.js";
import { listCities, listCounties } from "../models/places.js";

const router = Router();

function findStateOr404(req, res) {
  const abbr = req.params.abbr.toUpperCase();
  if (STATE_BY_ABBR.has(abbr)) return abbr;
  res.status(404).json({ error: "We don't have that state." });
  return null;
}

// GET /api/places/AZ/cities?page=1&limit=10
router.get("/:abbr/cities", async (req, res) => {
  const state = findStateOr404(req, res);
  if (!state) return;
  const page = parseIntParam(req.query.page, {
    min: 1,
    max: 1000,
    fallback: 1,
  });
  const limit = parseIntParam(req.query.limit, {
    min: 1,
    max: 100,
    fallback: 10,
  });
  if (page === null || limit === null) {
    return res
      .status(400)
      .json({ error: "Page must be 1 or more and limit 1 to 100." });
  }
  const { items, total } = await listCities(state, { page, limit });
  res.json({ state, page, limit, total, items });
});

// GET /api/places/AZ/counties
router.get("/:abbr/counties", async (req, res) => {
  const state = findStateOr404(req, res);
  if (!state) return;
  res.json({ state, items: await listCounties(state) });
});

export default router;
