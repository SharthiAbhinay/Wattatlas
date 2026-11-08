import {
  formatCents,
  formatChange,
  formatKWh,
  formatOrdinal,
  formatShare,
  monthName,
} from "./format.js";

const SECTOR_SUBJECT = {
  RES: "Homes",
  COM: "Shops, offices and other businesses",
  IND: "Industry",
  TRA: "Trains and other transportation",
};

export const PATTERN_LABEL = {
  summer: "Summer",
  winter: "Winter",
  both: "Summer and winter",
  even: "Steady all year",
};

function relativeTo(value, national) {
  const ratio = value / national - 1;
  const percent = Math.abs(Math.round(ratio * 100));
  if (percent < 3) return "about the same as";
  return `${percent}% ${ratio > 0 ? "more than" : "less than"}`;
}

function sectorInsight(sectors) {
  const known = sectors.filter((s) => s.share !== null);
  if (known.length === 0) return null;
  const largest = [...known].sort((a, b) => b.share - a.share)[0];
  const standout = [...known]
    .filter((s) => s.nationalShare !== null)
    .sort((a, b) => b.share - b.nationalShare - (a.share - a.nationalShare))[0];
  let text = `${SECTOR_SUBJECT[largest.id]} use ${formatShare(largest.share)} of the electricity here`;
  text +=
    largest.nationalShare !== null
      ? ` (${formatShare(largest.nationalShare)} nationally).`
      : ".";
  if (
    standout &&
    standout.id !== largest.id &&
    standout.share - standout.nationalShare > 0.05
  ) {
    text += ` ${SECTOR_SUBJECT[standout.id]} take a bigger slice than usual: ${formatShare(standout.share)} against ${formatShare(standout.nationalShare)} nationally.`;
  }
  return { id: "sectors", title: "Who uses the power", text };
}

function seasonInsight(seasonality) {
  if (!seasonality) return null;
  const peak = monthName(seasonality.peakMonth);
  const above = Math.round((Math.max(...seasonality.index) - 1) * 100);
  const texts = {
    summer: `Use peaks in ${peak}, about ${above}% above an average day, which points to air conditioning.`,
    winter: `Use peaks in ${peak}, about ${above}% above an average day, which points to electric heating.`,
    both: `Use climbs in both summer and winter, so air conditioning and electric heating both matter here. The peak is in ${peak}.`,
    even: "Use stays fairly steady through the year, without a strong heating or cooling season.",
  };
  return {
    id: "season",
    title: "When it peaks",
    text: texts[seasonality.pattern],
  };
}

function homeInsight(summary, national) {
  if (!summary.avgHomeMonthlyKWh || !national.avgHomeMonthlyKWh) return null;
  return {
    id: "homes",
    title: "Typical home",
    text: `The average home uses ${formatKWh(summary.avgHomeMonthlyKWh)} a month, ${relativeTo(summary.avgHomeMonthlyKWh, national.avgHomeMonthlyKWh)} the US average of ${formatKWh(national.avgHomeMonthlyKWh)}.`,
  };
}

function priceInsight(summary, national) {
  if (!summary.price || !national.price) return null;
  let text = `Electricity costs ${formatCents(summary.price)} on average, ${relativeTo(summary.price, national.price)} the US average of ${formatCents(national.price)}.`;
  if (summary.rank?.price) {
    text += ` That's the ${formatOrdinal(summary.rank.price)} highest of ${summary.statesRanked}.`;
  }
  text +=
    " Lower prices tend to go with higher use, since there's less reason to cut back.";
  return { id: "price", title: "What it costs", text };
}

function changeInsight(change) {
  if (!change || change.salesPct === null) return null;
  let text = `Total use changed ${formatChange(change.salesPct)} from ${change.fromYear} to ${change.toYear}`;
  text +=
    change.pricePct !== null
      ? `, while the average price changed ${formatChange(change.pricePct)}.`
      : ".";
  return { id: "change", title: "Over time", text };
}

// Plain-language reasons behind a state's usage, built from the numbers
// returned by GET /api/states/:abbr.
export function describeDrivers(detail) {
  return [
    sectorInsight(detail.sectors),
    seasonInsight(detail.seasonality),
    homeInsight(detail.summary, detail.national),
    priceInsight(detail.summary, detail.national),
    changeInsight(detail.change),
  ].filter(Boolean);
}
