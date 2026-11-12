import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { deleteBill, listBills, saveBill } from "../models/bills.js";
import { parseObjectId, validateBill } from "../lib/validation.js";

function toClientBill(doc) {
  return {
    id: doc._id.toString(),
    month: doc.month,
    kwh: doc.kwh,
    cost: doc.cost,
    updatedAt: doc.updatedAt,
  };
}

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const docs = await listBills(req.user._id);
  res.json({ items: docs.map(toClientBill) });
});

// Saving a month that already has a bill replaces it.
router.put("/", async (req, res) => {
  const { errors, value } = validateBill(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const doc = await saveBill(req.user._id, value);
  res.json({ bill: toClientBill(doc) });
});

router.delete("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const deleted = id && (await deleteBill(req.user._id, id));
  if (!deleted) return res.status(404).json({ error: "That bill doesn't exist." });
  res.status(204).end();
});

export default router;
