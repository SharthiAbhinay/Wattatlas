import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { findHousehold, saveHousehold } from "../models/households.js";
import { findCounty } from "../models/places.js";
import { validateHousehold } from "../lib/validation.js";

function toClientHousehold(doc) {
  return {
    id: doc._id.toString(),
    memberIds: doc.memberIds.map((id) => id.toString()),
    state: doc.state ?? null,
    county: doc.county ?? null,
    countyFips: doc.countyFips ?? null,
    updatedAt: doc.updatedAt,
  };
}

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const doc = await findHousehold(req.user._id);
  res.json({ household: doc ? toClientHousehold(doc) : null });
});

// Saves where the household lives. The county has to be one of the state's
// counties; it's stored with the spelling and FIPS code from the places data.
router.put("/", async (req, res) => {
  const { errors, value } = validateHousehold(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }
  const county = await findCounty(value.state, value.county);
  if (!county) {
    const error = `${value.county} isn't a county in ${value.state}.`;
    return res.status(400).json({ error, details: [error] });
  }
  const doc = await saveHousehold(req.user._id, {
    state: value.state,
    county: county.name,
    countyFips: county.fips ?? null,
  });
  res.json({ household: toClientHousehold(doc) });
});

export default router;
