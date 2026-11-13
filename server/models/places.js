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

// The county called `name` in `state` (ignoring case), or null if the state
// has no such county. Returns its stored spelling and FIPS code.
export function findCounty(state, name) {
  return places().findOne(
    { type: "county", state, name },
    {
      projection: { _id: 0, name: 1, fips: 1 },
      collation: { locale: "en", strength: 2 },
    }
  );
}

export function listCounties(state) {
  return places()
    .find({ type: "county", state }, { projection: FIELDS })
    .toArray();
}
