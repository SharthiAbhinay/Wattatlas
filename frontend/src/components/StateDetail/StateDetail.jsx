import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatCents,
  formatCentsShort,
  formatCompact,
  formatGWh,
  formatKWh,
  formatMWh,
  formatNumber,
  formatOrdinal,
  formatShare,
  monthName,
  periodToDate,
  SECTOR_COLORS,
} from "../../lib/format.js";
import { describeDrivers } from "../../lib/insights.js";
import { useApiData } from "../../lib/useApiData.js";
import TrendChart from "../TrendChart/TrendChart.jsx";
import "./StateDetail.css";

const CITY_PAGE = 10;
const CITY_MAX = 100;
const MONTH_INITIALS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];
const SECTOR_LINES = [
  { id: "ALL", label: "All sectors" },
  { id: "RES", label: "Homes" },
  { id: "COM", label: "Businesses" },
  { id: "IND", label: "Industry" },
];
const FORECAST_COLOR = "#b86e00";

function compareToNational(value, national) {
  if (!Number.isFinite(value) || !Number.isFinite(national)) return "";
  const percent = Math.round((value / national - 1) * 100);
  if (Math.abs(percent) < 3) {
    return `About the same as the US average of ${formatKWh(national)}.`;
  }
  return `${Math.abs(percent)}% ${percent > 0 ? "above" : "below"} the US average of ${formatKWh(national)}.`;
}

function StateDetail({ abbr, onClose }) {
  const detailState = useApiData(`/api/states/${abbr}`);
  const forecastState = useApiData(`/api/states/${abbr}/forecast`);
  const [cityLimit, setCityLimit] = useState(CITY_PAGE);
  const cityState = useApiData(
    `/api/places/${abbr}/cities?limit=${cityLimit}`,
    {
      keepPrevious: true,
    }
  );
  const detail = detailState.data;
  const forecast = forecastState.data;
  const cities = cityState.data;

  const usageSeries = useMemo(
    () =>
      (detail?.annual ? SECTOR_LINES : []).map((line) => ({
        id: line.id,
        label: line.label,
        color: SECTOR_COLORS[line.id],
        points: detail.annual.map((a) => ({ x: a.year, y: a.sales[line.id] })),
      })),
    [detail]
  );

  const priceSeries = useMemo(
    () =>
      detail
        ? [
            {
              id: "ALL",
              label: "All customers",
              color: SECTOR_COLORS.ALL,
              points: detail.annual.map((a) => ({ x: a.year, y: a.price.ALL })),
            },
            {
              id: "RES",
              label: "Homes",
              color: SECTOR_COLORS.RES,
              points: detail.annual.map((a) => ({ x: a.year, y: a.price.RES })),
            },
          ]
        : [],
    [detail]
  );

  const forecastSeries = useMemo(() => {
    if (!forecast) return [];
    const history = forecast.history.map((h) => ({
      x: periodToDate(h.period),
      y: h.value,
    }));
    const ahead = forecast.forecast.map((f) => ({
      x: periodToDate(f.period),
      y: f.value,
    }));
    return [
      {
        id: "history",
        label: "Reported",
        color: SECTOR_COLORS.ALL,
        points: history,
      },
      {
        id: "forecast",
        label: "Forecast, with likely range",
        color: FORECAST_COLOR,
        dashed: true,
        points: history.length ? [history.at(-1), ...ahead] : ahead,
        band: forecast.forecast.map((f) => ({
          x: periodToDate(f.period),
          lower: f.lower,
          upper: f.upper,
        })),
      },
    ];
  }, [forecast]);

  if (detailState.loading) {
    return (
      <p className="state-detail-status" role="status">
        Loading the numbers…
      </p>
    );
  }
  if (detailState.error) {
    return (
      <div className="state-detail-status">
        <p role="alert">{detailState.error.message}</p>
        <button type="button" className="button" onClick={onClose}>
          Back to US map
        </button>
      </div>
    );
  }
  if (!detail) return null;

  const { summary, national, year } = detail;
  const drivers = describeDrivers(detail);
  const seasonMax = detail.seasonality
    ? Math.max(...detail.seasonality.index)
    : 1;
  const meterText = formatNumber(summary.perCapita);

  return (
    <article className="state-detail" aria-labelledby="state-detail-title">
      <header className="state-detail-header">
        <h2 id="state-detail-title">{detail.name}</h2>
        <div className="state-detail-actions">
          <Link className="button" to={`/comparisons/new?states=${abbr}`}>
            Compare with other states
          </Link>
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Back to US map
          </button>
        </div>
      </header>

      {Number.isFinite(summary.perCapita) && (
        <section className="state-readout" aria-label="Use per person">
          {/* Each digit sits on its own dark wheel, like an electric meter. */}
          <p
            className="meter"
            aria-label={`${meterText} kilowatt-hours per person`}
          >
            {[...meterText].map((char, i) =>
              char === "," ? (
                <span key={i} className="meter-separator" aria-hidden="true" />
              ) : (
                <span key={i} className="meter-digit" aria-hidden="true">
                  {char}
                </span>
              )
            )}
            <span className="meter-unit" aria-hidden="true">
              kWh
            </span>
          </p>
          <p className="state-readout-caption">
            per person in {year}.{" "}
            {compareToNational(summary.perCapita, national.perCapita)}
          </p>
        </section>
      )}

      <dl className="state-figures">
        <div>
          <dt>Total use</dt>
          <dd>{formatGWh(summary.sales)}</dd>
        </div>
        <div>
          <dt>Average price</dt>
          <dd>{formatCents(summary.price)}</dd>
        </div>
        <div>
          <dt>Average home</dt>
          <dd>{formatKWh(summary.avgHomeMonthlyKWh)} a month</dd>
        </div>
        {summary.rank?.perCapita && (
          <div>
            <dt>Use per person rank</dt>
            <dd>
              {formatOrdinal(summary.rank.perCapita)} highest of{" "}
              {summary.statesRanked}
            </dd>
          </div>
        )}
      </dl>

      <section className="state-section" aria-labelledby="drivers-title">
        <h3 id="drivers-title">What drives usage here</h3>
        <div className="sector-bars">
          {[
            { key: "state", label: detail.name, field: "share" },
            { key: "us", label: "United States", field: "nationalShare" },
          ].map((row) => (
            <div className="sector-bar" key={row.key}>
              <span className="sector-bar-label">{row.label}</span>
              <span className="sector-bar-track">
                {detail.sectors
                  .filter((s) => s[row.field] > 0)
                  .map((s) => (
                    <span
                      key={s.id}
                      className="sector-bar-part"
                      style={{
                        width: `${s[row.field] * 100}%`,
                        background: SECTOR_COLORS[s.id],
                      }}
                      title={`${s.label}: ${formatShare(s[row.field])}`}
                    />
                  ))}
              </span>
            </div>
          ))}
          <ul className="sector-bar-key">
            {detail.sectors
              .filter((s) => s.share !== null)
              .map((s) => (
                <li key={s.id}>
                  <span
                    style={{ background: SECTOR_COLORS[s.id] }}
                    aria-hidden="true"
                  />
                  {s.label} {formatShare(s.share)}
                </li>
              ))}
          </ul>
        </div>

        <ul className="drivers">
          {drivers.map((item) => (
            <li key={item.id}>
              <strong>{item.title}.</strong> {item.text}
            </li>
          ))}
        </ul>

        {detail.seasonality && (
          <figure className="season">
            <div
              className="season-bars"
              role="img"
              aria-label={`Daily use by month compared with an average day. Highest in ${monthName(detail.seasonality.peakMonth)}.`}
            >
              {detail.seasonality.index.map((value, i) => (
                <span key={i} className="season-bar">
                  <span
                    className={`season-bar-fill${value >= 1 ? " is-above" : ""}`}
                    style={{ height: `${(value / seasonMax) * 100}%` }}
                  />
                  <span className="season-bar-label" aria-hidden="true">
                    {MONTH_INITIALS[i]}
                  </span>
                </span>
              ))}
            </div>
            <figcaption>
              Use on an average day in each month, averaged over{" "}
              {detail.seasonality.years} years. Darker bars are above the yearly
              average.
            </figcaption>
          </figure>
        )}
      </section>

      <section className="state-section" aria-labelledby="trend-title">
        <h3 id="trend-title">Usage over the years</h3>
        <TrendChart
          series={usageSeries}
          yFormat={formatCompact}
          label={`Yearly electricity use in ${detail.name} by sector, in GWh`}
          yZero
        />
        <h4>Average price</h4>
        <TrendChart
          series={priceSeries}
          yFormat={formatCentsShort}
          label={`Average electricity price in ${detail.name}, in cents per kWh`}
          height={180}
        />
      </section>

      <section className="state-section" aria-labelledby="forecast-title">
        <h3 id="forecast-title">Where it&rsquo;s heading</h3>
        {forecastState.loading && (
          <p role="status">Working out the forecast…</p>
        )}
        {forecastState.error && (
          <p role="alert">{forecastState.error.message}</p>
        )}
        {forecast && (
          <>
            <p className="forecast-headline">
              {detail.name} is on track to use about{" "}
              <strong>{formatGWh(forecast.nextYear.total)}</strong> in{" "}
              {forecast.nextYear.year}
              {Number.isFinite(forecast.nextYear.lower) &&
                `, likely between ${formatNumber(forecast.nextYear.lower)} and ${formatGWh(forecast.nextYear.upper)}`}
              .
            </p>
            <TrendChart
              series={forecastSeries}
              xType="month"
              yFormat={formatCompact}
              label={`Monthly electricity use in ${detail.name}, reported and forecast, in GWh`}
            />
            <p className="state-note">
              How this works: {forecast.method} It&rsquo;s a simple trend, not
              an official EIA forecast.
            </p>
          </>
        )}
      </section>

      <section className="state-section" aria-labelledby="cities-title">
        <h3 id="cities-title">Cities</h3>
        <p className="state-note">
          Yearly use estimated by NREL&rsquo;s model, not metered readings.
        </p>
        {cityState.error && <p role="alert">{cityState.error.message}</p>}
        {cities && cities.total === 0 && (
          <p className="state-note">
            City estimates haven&rsquo;t been loaded yet.
          </p>
        )}
        {cities && cities.items.length > 0 && (
          <div className="table-scroll">
            <table className="city-table">
              <caption className="sr-only">
                Cities in {detail.name} by estimated yearly electricity use
              </caption>
              <thead>
                <tr>
                  <th scope="col">City</th>
                  <th scope="col" className="numeric">
                    Estimated use
                  </th>
                  <th scope="col" className="numeric">
                    Per person
                  </th>
                </tr>
              </thead>
              <tbody>
                {cities.items.map((city, i) => (
                  <tr key={`${city.fips ?? city.name}-${i}`}>
                    <th scope="row">{city.name}</th>
                    <td className="numeric">{formatMWh(city.total)}</td>
                    <td className="numeric">{formatKWh(city.perCapita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {cities &&
          cities.total > cities.items.length &&
          cityLimit < CITY_MAX && (
            <button
              type="button"
              className="button"
              disabled={cityState.loading}
              onClick={() =>
                setCityLimit((n) => Math.min(n + CITY_PAGE, CITY_MAX))
              }
            >
              Show more cities
            </button>
          )}
      </section>
    </article>
  );
}

StateDetail.propTypes = {
  abbr: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default StateDetail;
