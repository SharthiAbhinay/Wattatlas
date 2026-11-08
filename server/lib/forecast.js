// Seasonal linear-trend forecast.
//
// Each calendar month gets its own straight-line fit across the years
// (all Januaries, all Februaries, ...). That keeps the seasonal shape of the
// state's usage while following its long-term direction. Ranges are standard
// least-squares prediction intervals, so they widen the further out we go.

// Two-sided 95% Student t values for 1 to 30 degrees of freedom.
const T_95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201,
  2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074,
  2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

function tValue(df) {
  if (df < 1) return null;
  return df <= T_95.length ? T_95[df - 1] : 1.96;
}

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function fitMonth(points) {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.year, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.value, 0) / n;
  if (n < 3) {
    return { predict: () => ({ value: meanY, se: null }) };
  }
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.year - meanX) ** 2;
    sxy += (p.year - meanX) * (p.value - meanY);
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = meanY - slope * meanX;
  const sse = points.reduce(
    (sum, p) => sum + (p.value - (intercept + slope * p.year)) ** 2,
    0
  );
  const df = n - 2;
  const s = Math.sqrt(sse / df);
  const t = tValue(df);
  return {
    predict(year) {
      const value = intercept + slope * year;
      const se = s * Math.sqrt(1 + 1 / n + (year - meanX) ** 2 / sxx);
      return { value, se, t };
    },
  };
}

function buildModel(history) {
  const byMonth = new Map();
  for (const point of history) {
    if (!byMonth.has(point.month)) byMonth.set(point.month, []);
    byMonth.get(point.month).push(point);
  }
  const fits = new Map();
  for (const [month, points] of byMonth) fits.set(month, fitMonth(points));
  return fits;
}

function nextMonth({ year, month }) {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

function predictRange(fits, from, through) {
  const result = [];
  let cursor = from;
  while (
    cursor.year < through.year ||
    (cursor.year === through.year && cursor.month <= through.month)
  ) {
    const fit = fits.get(cursor.month);
    if (!fit) return null;
    const { value, se, t } = fit.predict(cursor.year);
    const point = Math.max(0, value);
    const margin = se !== null && t ? t * se : null;
    result.push({
      period: periodKey(cursor.year, cursor.month),
      year: cursor.year,
      month: cursor.month,
      value: point,
      lower: margin === null ? null : Math.max(0, value - margin),
      upper: margin === null ? null : value + margin,
      se,
    });
    cursor = nextMonth(cursor);
  }
  return result;
}

// history: [{ year, month, value }] in time order with no null values.
// Forecasts from the month after the last observation through December of
// the following calendar year.
export function seasonalTrendForecast(history) {
  if (history.length < 24) return null;
  const last = history.at(-1);
  const fits = buildModel(history);
  const forecast = predictRange(fits, nextMonth(last), {
    year: last.year + 1,
    month: 12,
  });
  if (!forecast) return null;

  const nextYearMonths = forecast.filter((p) => p.year === last.year + 1);
  const total = nextYearMonths.reduce((sum, p) => sum + p.value, 0);
  const withSe = nextYearMonths.filter((p) => p.se !== null);
  // Treats monthly errors as independent, which makes this range a rough guide.
  const totalMargin =
    withSe.length === nextYearMonths.length
      ? 1.96 * Math.sqrt(withSe.reduce((sum, p) => sum + p.se ** 2, 0))
      : null;

  return {
    method:
      "Each calendar month's trend over the past years is extended forward.",
    forecast: forecast.map((p) => ({
      period: p.period,
      value: p.value,
      lower: p.lower,
      upper: p.upper,
    })),
    nextYear: {
      year: last.year + 1,
      total,
      lower: totalMargin === null ? null : Math.max(0, total - totalMargin),
      upper: totalMargin === null ? null : total + totalMargin,
    },
  };
}
