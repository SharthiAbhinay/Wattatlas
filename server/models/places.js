import { getDb } from "../config/db.js";

const places = () => getDb().collection("places");

const FIELDS = {
  _id: 0,
  name: 1,
  fips: 1,
  population: 1,
  res: 1,
  com: 1,
  ind: 1,
  total: 1,
  perCapita: 1,
  year: 1,
};

// A state's cities, largest estimated use first, a page at a time.
export async function listCities(state, { page, limit }) {
  const filter = { type: "city", state };
  const [items, total] = await Promise.all([
    places()
      .find(filter, { projection: FIELDS })
      .sort({ total: -1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    places().countDocuments(filter),
  ]);
  return { items, total };
}

export function listCounties(state) {
  return places()
    .find({ type: "county", state }, { projection: FIELDS })
    .toArray();
}
