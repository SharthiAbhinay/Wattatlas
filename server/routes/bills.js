import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createBill,
  deleteBill,
  findBillById,
  listBills,
  updateBill,
} from "../models/bills.js";
import { ensureHousehold, findHousehold } from "../models/households.js";
import { parseObjectId, validateBill } from "../lib/validation.js";

function toClientBill(doc) {
  return {
    id: doc._id.toString(),
    householdId: doc.householdId.toString(),
    authorId: doc.authorId.toString(),
    month: doc.month,
    kwh: doc.kwh,
    cost: doc.cost,
    createdAt: doc.createdAt,
  };
}

// The server decides what "this month" is so every member sees the same one.
const currentMonth = () => new Date().toISOString().slice(0, 7);

const router = Router();
router.use(requireAuth);

// The household's latest 5 bills, whoever in the household entered them.
router.get("/", async (req, res) => {
  const household = await findHousehold(req.user._id);
  const items = household ? (await listBills(household._id)).map(toClientBill) : [];
  const month = currentMonth();
  res.json({
    currentMonth: month,
    current: items.find((b) => b.month === month) ?? null,
    items,
  });
});

// Adds this month's bill. A household can only have one per month.
router.post("/", async (req, res) => {
  const month = currentMonth();
  const { errors, value } = validateBill({ ...req.body, month });
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const household = await ensureHousehold(req.user._id);
  const doc = await createBill(household._id, req.user._id, value);
  if (!doc) {
    return res
      .status(409)
      .json({ error: "Your household already submitted this month's bill." });
  }
  res.status(201).json({ bill: toClientBill(doc) });
});

// Any member of the household can correct the kWh and cost of its bills.
router.put("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const household = await findHousehold(req.user._id);
  const existing = id && household && (await findBillById(household._id, id));
  if (!existing) return res.status(404).json({ error: "That bill doesn't exist." });

  const { errors, value } = validateBill({ ...req.body, month: existing.month });
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const doc = await updateBill(household._id, id, value);
  res.json({ bill: toClientBill(doc) });
});

router.delete("/:id", async (req, res) => {
  const id = parseObjectId(req.params.id);
  const household = await findHousehold(req.user._id);
  const deleted = id && household && (await deleteBill(household._id, id));
  if (!deleted) return res.status(404).json({ error: "That bill doesn't exist." });
  res.status(204).end();
});

export default router;
