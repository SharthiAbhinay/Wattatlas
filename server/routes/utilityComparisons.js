import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { findUtilitiesByIds } from "../models/utilities.js";
import {
  createUtilityComparison,
  deleteUtilityComparison,
  findUtilityComparison,
  listUtilityComparisons,
  updateUtilityComparison,
} from "../models/utilityComparisons.js";
import { parseObjectId, validateUtilityComparison } from "../lib/validation.js";

const NOT_FOUND = { error: "That comparison doesn't exist." };

// Sends the utilities with their names and states, in the order they were
// picked. A utility that has since left the data keeps its number and gets
// no name.
async function toClientComparisons(docs) {
  const ids = [...new Set(docs.flatMap((d) => d.utilityIds))];
  const found = new Map(
    (await findUtilitiesByIds(ids)).map((u) => [u.utilityId, u])
  );
  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    utilityIds: doc.utilityIds,
    utilities: doc.utilityIds.map((utilityId) => ({
      utilityId,
      name: found.get(utilityId)?.name ?? null,
      states: found.get(utilityId)?.states ?? [],
    })),
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
}

// Checks the body and that every utility number is a real utility.
async function readBody(body) {
  const { errors, value } = validateUtilityComparison(body);
  if (errors.length === 0) {
    const found = new Set(
      (await findUtilitiesByIds(value.utilityIds)).map((u) => u.utilityId)
    );
    const unknown = value.utilityIds.filter((id) => !found.has(id));
    if (unknown.length) {
      errors.push(`Unknown utility: ${unknown.join(", ")}.`);
    }
  }
  return { errors, value };
}

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const docs = await listUtilityComparisons(req.user._id);
  res.json({ items: await toClientComparisons(docs) });
});

router.post("/", async (req, res) => {
  const { errors, value } = await readBody(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const doc = await createUtilityComparison(req.user._id, value);
  const [comparison] = await toClientComparisons([doc]);
  res.status(201).json({ comparison });
});

router.get("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const doc = id && (await findUtilityComparison(req.user._id, id));
  if (!doc) return res.status(404).json(NOT_FOUND);
  const [comparison] = await toClientComparisons([doc]);
  res.json({ comparison });
});

router.put("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return res.status(404).json(NOT_FOUND);
  const { errors, value } = await readBody(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const doc = await updateUtilityComparison(req.user._id, id, value);
  if (!doc) return res.status(404).json(NOT_FOUND);
  const [comparison] = await toClientComparisons([doc]);
  res.json({ comparison });
});

router.delete("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const deleted = id && (await deleteUtilityComparison(req.user._id, id));
  if (!deleted) return res.status(404).json(NOT_FOUND);
  res.status(204).end();
});

export default router;
