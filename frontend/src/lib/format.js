// Number and date formatting shared by the map, charts and tables.
const formatters = new Map();

function numberFormat(digits) {
  if (!formatters.has(digits)) {
    formatters.set(
      digits,
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    );
  }
  return formatters.get(digits);
}

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
});

const NO_DATA = "No data";

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

export function formatNumber(value, digits = 0) {
  return isNumber(value) ? numberFormat(digits).format(value) : NO_DATA;
}

export function formatCompact(value) {
  return isNumber(value) ? compactFormat.format(value) : NO_DATA;
}

export const formatKWh = (value) =>
  isNumber(value) ? `${formatNumber(value)} kWh` : NO_DATA;

export const formatGWh = (value) =>
  isNumber(value) ? `${formatNumber(value)} GWh` : NO_DATA;

export const formatCents = (value) =>
  isNumber(value) ? `${formatNumber(value, 1)}¢ per kWh` : NO_DATA;

export const formatCentsShort = (value) =>
  isNumber(value) ? `${formatNumber(value, 1)}¢` : NO_DATA;

// City and county estimates are stored in MWh.
export function formatMWh(value) {
  if (!isNumber(value)) return NO_DATA;
  if (value < 1000) return `${formatNumber(value)} MWh`;
  return `${formatNumber(value / 1000, value < 10000 ? 1 : 0)} GWh`;
}

// 0.384 -> "38%"
export function formatShare(value) {
  if (!isNumber(value)) return NO_DATA;
  if (value > 0 && value < 0.005) return "under 1%";
  return `${formatNumber(value * 100)}%`;
}

// 12.4 -> "+12%", -3.2 -> "−3%"
export function formatChange(percent) {
  if (!isNumber(percent)) return NO_DATA;
  const rounded = Math.round(percent);
  if (rounded === 0) return "No change";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}%`;
}

export function formatOrdinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

export const formatDate = (value) => dateFormat.format(new Date(value));

export const monthName = (month) =>
  monthFormat.format(new Date(Date.UTC(2000, month - 1, 1)));

// "2026-08" -> Date at the start of that month (UTC)
export function periodToDate(period) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

// `field` is the name of the matching figure in /api/states/summary.
export const METRICS = {
  perCapita: {
    id: "perCapita",
    field: "perCapita",
    label: "Use per person",
    title: "Electricity use per person",
    format: formatKWh,
    tickFormat: formatCompact,
  },
  total: {
    id: "total",
    field: "sales",
    label: "Total use",
    title: "Total electricity use",
    format: formatGWh,
    tickFormat: formatCompact,
  },
  price: {
    id: "price",
    field: "price",
    label: "Average price",
    title: "Average electricity price",
    format: formatCents,
    tickFormat: formatCentsShort,
  },
};

// Okabe–Ito colors: tell apart for the common forms of color blindness.
export const SERIES_COLORS = ["#0072b2", "#d55e00", "#009e73", "#cc79a7"];
export const SECTOR_COLORS = {
  ALL: "#172a3a",
  RES: "#0072b2",
  COM: "#009e73",
  IND: "#d55e00",
  TRA: "#cc79a7",
};
