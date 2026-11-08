// The 50 states plus DC, with 2-digit FIPS codes (they match the ids in
// us-atlas) and 2020 Census resident population, used for per-person figures.
export const STATES = [
  { abbr: "AL", name: "Alabama", fips: "01", population: 5024279 },
  { abbr: "AK", name: "Alaska", fips: "02", population: 733391 },
  { abbr: "AZ", name: "Arizona", fips: "04", population: 7151502 },
  { abbr: "AR", name: "Arkansas", fips: "05", population: 3011524 },
  { abbr: "CA", name: "California", fips: "06", population: 39538223 },
  { abbr: "CO", name: "Colorado", fips: "08", population: 5773714 },
  { abbr: "CT", name: "Connecticut", fips: "09", population: 3605944 },
  { abbr: "DE", name: "Delaware", fips: "10", population: 989948 },
  { abbr: "DC", name: "District of Columbia", fips: "11", population: 689545 },
  { abbr: "FL", name: "Florida", fips: "12", population: 21538187 },
  { abbr: "GA", name: "Georgia", fips: "13", population: 10711908 },
  { abbr: "HI", name: "Hawaii", fips: "15", population: 1455271 },
  { abbr: "ID", name: "Idaho", fips: "16", population: 1839106 },
  { abbr: "IL", name: "Illinois", fips: "17", population: 12812508 },
  { abbr: "IN", name: "Indiana", fips: "18", population: 6785528 },
  { abbr: "IA", name: "Iowa", fips: "19", population: 3190369 },
  { abbr: "KS", name: "Kansas", fips: "20", population: 2937880 },
  { abbr: "KY", name: "Kentucky", fips: "21", population: 4505836 },
  { abbr: "LA", name: "Louisiana", fips: "22", population: 4657757 },
  { abbr: "ME", name: "Maine", fips: "23", population: 1362359 },
  { abbr: "MD", name: "Maryland", fips: "24", population: 6177224 },
  { abbr: "MA", name: "Massachusetts", fips: "25", population: 7029917 },
  { abbr: "MI", name: "Michigan", fips: "26", population: 10077331 },
  { abbr: "MN", name: "Minnesota", fips: "27", population: 5706494 },
  { abbr: "MS", name: "Mississippi", fips: "28", population: 2961279 },
  { abbr: "MO", name: "Missouri", fips: "29", population: 6154913 },
  { abbr: "MT", name: "Montana", fips: "30", population: 1084225 },
  { abbr: "NE", name: "Nebraska", fips: "31", population: 1961504 },
  { abbr: "NV", name: "Nevada", fips: "32", population: 3104614 },
  { abbr: "NH", name: "New Hampshire", fips: "33", population: 1377529 },
  { abbr: "NJ", name: "New Jersey", fips: "34", population: 9288994 },
  { abbr: "NM", name: "New Mexico", fips: "35", population: 2117522 },
  { abbr: "NY", name: "New York", fips: "36", population: 20201249 },
  { abbr: "NC", name: "North Carolina", fips: "37", population: 10439388 },
  { abbr: "ND", name: "North Dakota", fips: "38", population: 779094 },
  { abbr: "OH", name: "Ohio", fips: "39", population: 11799448 },
  { abbr: "OK", name: "Oklahoma", fips: "40", population: 3959353 },
  { abbr: "OR", name: "Oregon", fips: "41", population: 4237256 },
  { abbr: "PA", name: "Pennsylvania", fips: "42", population: 13002700 },
  { abbr: "RI", name: "Rhode Island", fips: "44", population: 1097379 },
  { abbr: "SC", name: "South Carolina", fips: "45", population: 5118425 },
  { abbr: "SD", name: "South Dakota", fips: "46", population: 886667 },
  { abbr: "TN", name: "Tennessee", fips: "47", population: 6910840 },
  { abbr: "TX", name: "Texas", fips: "48", population: 29145505 },
  { abbr: "UT", name: "Utah", fips: "49", population: 3271616 },
  { abbr: "VT", name: "Vermont", fips: "50", population: 643077 },
  { abbr: "VA", name: "Virginia", fips: "51", population: 8631393 },
  { abbr: "WA", name: "Washington", fips: "53", population: 7705281 },
  { abbr: "WV", name: "West Virginia", fips: "54", population: 1793716 },
  { abbr: "WI", name: "Wisconsin", fips: "55", population: 5893718 },
  { abbr: "WY", name: "Wyoming", fips: "56", population: 576851 },
];

export const STATE_BY_ABBR = new Map(STATES.map((s) => [s.abbr, s]));

const STATE_BY_NAME = new Map(STATES.map((s) => [s.name.toLowerCase(), s]));

// EIA sector codes, as used by the retail sales API.
export const SECTORS = [
  { id: "ALL", label: "All sectors" },
  { id: "RES", label: "Residential" },
  { id: "COM", label: "Commercial" },
  { id: "IND", label: "Industrial" },
  { id: "TRA", label: "Transportation" },
];

export const SECTOR_IDS = SECTORS.map((s) => s.id);

export function isStateAbbr(value) {
  return typeof value === "string" && STATE_BY_ABBR.has(value.toUpperCase());
}

// Accepts "AZ", "az", "Arizona" or "ARIZONA" and returns the state, or null.
export function findState(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length === 2) return STATE_BY_ABBR.get(text.toUpperCase()) || null;
  return STATE_BY_NAME.get(text.toLowerCase()) || null;
}
