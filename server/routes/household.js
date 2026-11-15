import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { findHousehold, saveHousehold } from "../models/households.js";
import { findCounty } from "../models/places.js";
import { listUtilitiesForCounty } from "../models/utilities.js";
import { validateHousehold } from "../lib/validation.js";

function toClientHousehold(doc) {
  return {
    id: doc._id.toString(),
    memberIds: doc.memberIds.map((id) => id.toString()),
    state: doc.state ?? null,
    county: doc.county ?? null,
    countyFips: doc.countyFips ?? null,
    utilityId: doc.utilityId ?? null,
    utilityName: doc.utilityName ?? null,
    updatedAt: doc.updatedAt,
  };
}

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const doc = await findHousehold(req.user._id);
  res.json({ household: doc ? toClientHousehold(doc) : null });
});

// The electric utilities that serve the household's county.
router.get("/utilities", async (req, res) => {
  const household = await findHousehold(req.user._id);
  if (!household?.state || !household.county) {
    return res
      .status(400)
      .json({ error: "Tell us your state and county first." });
  }
  const { year, items } = await listUtilitiesForCounty(
    household.state,
    household.county
  );
  res.json({
    state: household.state,
    county: household.county,
    year,
    items,
  });
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
  // A chosen utility has to be one that serves that county.
  let utility = null;
  if (value.utilityId !== null) {
    const { items } = await listUtilitiesForCounty(value.state, county.name);
    utility = items.find((u) => u.utilityId === value.utilityId);
    if (!utility) {
      const error = `That utility doesn't serve ${county.name}.`;
      return res.status(400).json({ error, details: [error] });
    }
  }
  const doc = await saveHousehold(req.user._id, {
    state: value.state,
    county: county.name,
    countyFips: county.fips ?? null,
    utilityId: utility?.utilityId ?? null,
    utilityName: utility?.name ?? null,
  });
  res.json({ household: toClientHousehold(doc) });
});

export default router;
