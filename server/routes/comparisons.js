import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createComparison,
  deleteComparison,
  findComparison,
  listComparisons,
  toClientComparison,
  updateComparison,
} from "../models/comparisons.js";
import { parseObjectId, validateComparison } from "../lib/validation.js";

const NOT_FOUND = { error: "That comparison doesn't exist." };

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const docs = await listComparisons(req.user._id);
  res.json({ items: docs.map(toClientComparison) });
});

router.post("/", async (req, res) => {
  const { errors, value } = validateComparison(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const doc = await createComparison(req.user._id, value);
  res.status(201).json({ comparison: toClientComparison(doc) });
});

router.get("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const doc = id && (await findComparison(req.user._id, id));
  if (!doc) return res.status(404).json(NOT_FOUND);
  res.json({ comparison: toClientComparison(doc) });
});

router.put("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return res.status(404).json(NOT_FOUND);
  const { errors, value } = validateComparison(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const doc = await updateComparison(req.user._id, id, value);
  if (!doc) return res.status(404).json(NOT_FOUND);
  res.json({ comparison: toClientComparison(doc) });
});

router.delete("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const deleted = id && (await deleteComparison(req.user._id, id));
  if (!deleted) return res.status(404).json(NOT_FOUND);
  res.status(204).end();
});

export default router;
