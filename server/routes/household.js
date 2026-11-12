import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { findHousehold, saveHousehold } from "../models/households.js";
import { validateHousehold } from "../lib/validation.js";

function toClientHousehold(doc) {
  return { state: doc.state, size: doc.size, updatedAt: doc.updatedAt };
}

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const doc = await findHousehold(req.user._id);
  res.json({ household: doc ? toClientHousehold(doc) : null });
});

router.put("/", async (req, res) => {
  const { errors, value } = validateHousehold(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const doc = await saveHousehold(req.user._id, value);
  res.json({ household: toClientHousehold(doc) });
});

export default router;
