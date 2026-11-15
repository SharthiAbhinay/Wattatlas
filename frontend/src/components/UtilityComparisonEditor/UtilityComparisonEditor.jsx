import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createUtilityComparison,
  deleteUtilityComparison,
  getUtilityComparison,
  updateUtilityComparison,
} from "../../lib/api.js";
import { formatKWh, SERIES_COLORS } from "../../lib/format.js";
import { useApiData } from "../../lib/useApiData.js";
import PriceBarChart from "../PriceBarChart/PriceBarChart.jsx";
import TrendChart from "../TrendChart/TrendChart.jsx";
// Shares its layout, table and chip styles with the state comparison editor.
import "../ComparisonEditor/ComparisonEditor.css";

const MAX_UTILITIES = 4;
const NAME_MAX = 80;
const NOTES_MAX = 2000;

const customerCount = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const perKwh = (cents) => `$${(cents / 100).toFixed(3)}`;
const dollars = (n) => `$${n.toFixed(2)}`;
const none = "No data";

// What the "Over the years" chart can show. Price is plotted in dollars.
const TREND_OPTIONS = {
  usage: {
    label: "Average home usage (kWh per month)",
    value: (year) => year.kwhPerMonth,
    format: (n) => `${Math.round(n).toLocaleString("en-US")} kWh`,
  },
  price: {
    label: "Price per kWh",
    value: (year) =>
      year.centsPerKwh === null ? null : year.centsPerKwh / 100,
    format: (n) => `$${n.toFixed(3)}`,
  },
};

const OWNER_LABELS = {
  "investor-owned": "Investor-owned",
  cooperative: "Cooperative",
  "city-owned": "City-owned",
};

// The three main kinds by name; anything else (federal, state, political
// subdivision and so on) shows the ownership EIA reports.
function ownerLabel(u) {
  if (OWNER_LABELS[u.type]) return OWNER_LABELS[u.type];
  if (u.type === "other" && u.ownership) return u.ownership;
  return none;
}

const ROWS = [
  { label: "Owner type", value: ownerLabel },
  {
    label: "Residential customers",
    value: (u) =>
      u.customers === null ? none : customerCount.format(u.customers),
  },
  {
    label: "Average price",
    value: (u) =>
      u.centsPerKwh === null ? none : `${perKwh(u.centsPerKwh)} per kWh`,
  },
  {
    label: "Average home, per month",
    value: (u) => (u.kwhPerMonth === null ? none : formatKWh(u.kwhPerMonth)),
  },
  {
    label: "Average monthly bill",
    value: (u) => (u.monthlyBill === null ? none : dollars(u.monthlyBill)),
  },
];

function UtilityComparisonEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const stateList = useApiData("/api/states");
  const [form, setForm] = useState({ name: "", notes: "", utilityIds: [] });
  // Names for the chips, remembered from the picker and from saved data.
  const [names, setNames] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [loaded, setLoaded] = useState(isNew);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pickState, setPickState] = useState("");
  const [pickCounty, setPickCounty] = useState("");

  useEffect(() => {
    if (isNew) return undefined;
    const controller = new AbortController();
    getUtilityComparison(id, controller.signal)
      .then(({ comparison }) => {
        setForm({
          name: comparison.name,
          notes: comparison.notes,
          utilityIds: comparison.utilityIds,
        });
        setNames(
          Object.fromEntries(
            comparison.utilities.map((u) => [u.utilityId, u.name])
          )
        );
        setLoaded(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoadError(err);
      });
    return () => controller.abort();
  }, [id, isNew]);

  const counties = useApiData(
    pickState ? `/api/places/${pickState}/counties` : null
  );
  const countyNames = (counties.data?.items ?? [])
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b));
  // Every utility that serves the chosen county, with its residential figures.
  const countyUtilities = useApiData(
    pickState && pickCounty
      ? `/api/utilities/county?state=${pickState}&county=${encodeURIComponent(pickCounty)}`
      : null
  );

  // Figures for the utilities picked so far (any county), for the table.
  const preview = useApiData(
    form.utilityIds.length
      ? `/api/utilities/compare?ids=${form.utilityIds.join(",")}`
      : null,
    { keepPrevious: true }
  );

  // Year-by-year figures for the same utilities, for the "Over the years" chart.
  const trend = useApiData(
    form.utilityIds.length
      ? `/api/utilities/trend?ids=${form.utilityIds.join(",")}`
      : null,
    { keepPrevious: true }
  );
  const [trendField, setTrendField] = useState("usage");
  const trendOption = TREND_OPTIONS[trendField];
  const trendSeries = useMemo(
    () =>
      (trend.data?.items ?? [])
        .filter((u) => form.utilityIds.includes(u.utilityId))
        .map((u) => ({
          id: String(u.utilityId),
          label: u.name,
          color:
            SERIES_COLORS[
              form.utilityIds.indexOf(u.utilityId) % SERIES_COLORS.length
            ],
          points: u.years.map((y) => ({
            x: y.year,
            y: trendOption.value(y),
          })),
        }))
        .filter((s) => s.points.some((p) => Number.isFinite(p.y))),
    [trend.data, form.utilityIds, trendOption]
  );

  const full = form.utilityIds.length >= MAX_UTILITIES;
  const nameOf = (utilityId) => names[utilityId] ?? `Utility ${utilityId}`;
  // Show columns in the order the utilities were picked.
  const compared = form.utilityIds
    .map((utilityId) =>
      (preview.data?.items ?? []).find((u) => u.utilityId === utilityId)
    )
    .filter(Boolean);
  const year = compared.find((u) => u.year)?.year;
  const priced = compared.filter((u) => u.centsPerKwh !== null);
  const averageCents = priced.length
    ? priced.reduce((sum, u) => sum + u.centsPerKwh, 0) / priced.length
    : null;
  // One bar per company with a price, in the order picked, then the average.
  const chartRows = [
    ...priced.map((u) => ({
      key: u.utilityId,
      label: u.name,
      value: u.centsPerKwh,
      color:
        SERIES_COLORS[
          form.utilityIds.indexOf(u.utilityId) % SERIES_COLORS.length
        ],
    })),
    ...(averageCents === null
      ? []
      : [
          {
            key: "average",
            label: `Average of ${priced.length}`,
            value: averageCents,
            color: "var(--ink)",
            isAverage: true,
          },
        ]),
  ];

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function removeUtility(utilityId) {
    update(
      "utilityIds",
      form.utilityIds.filter((u) => u !== utilityId)
    );
  }

  function addUtility(utility) {
    if (full || form.utilityIds.includes(utility.utilityId)) return;
    setNames((current) => ({ ...current, [utility.utilityId]: utility.name }));
    update("utilityIds", [...form.utilityIds, utility.utilityId]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problems = [];
    if (!form.name.trim()) problems.push("Give the comparison a name.");
    if (form.utilityIds.length === 0) {
      problems.push("Pick at least one utility.");
    }
    if (problems.length) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      if (isNew) await createUtilityComparison(form);
      else await updateUtilityComparison(id, form);
      navigate("/comparisons", {
        state: {
          message: isNew ? `Saved “${form.name.trim()}”.` : "Changes saved.",
        },
      });
    } catch (err) {
      setErrors(err.details ?? [err.message]);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete “${form.name}”? This can't be undone.`)) return;
    try {
      await deleteUtilityComparison(id);
      navigate("/comparisons", {
        state: { message: `Deleted “${form.name}”.` },
      });
    } catch (err) {
      setErrors([err.message]);
    }
  }

  if (loadError) {
    return (
      <section className="page-status">
        <h1>Can&rsquo;t open this comparison</h1>
        <p role="alert">{loadError.message}</p>
        <Link to="/comparisons">Back to my comparisons</Link>
      </section>
    );
  }
  if (!loaded) {
    return (
      <p className="page-status" role="status">
        Loading the comparison…
      </p>
    );
  }

  return (
    <div className="comparison-editor">
      <form className="comparison-form" onSubmit={handleSubmit} noValidate>
        <Link className="comparison-back" to="/comparisons">
          My comparisons
        </Link>
        <h1>{isNew ? "New utility comparison" : "Edit utility comparison"}</h1>

        <div className="field">
          <label htmlFor="utility-comparison-name">Name</label>
          <input
            id="utility-comparison-name"
            value={form.name}
            maxLength={NAME_MAX}
            placeholder="Who should power my new apartment"
            onChange={(event) => update("name", event.target.value)}
            required
          />
        </div>

        <div className="comparison-location">
          <p className="comparison-instructions">
            Choose a state and county to see every utility company that serves
            it, then add up to {MAX_UTILITIES} to compare.
          </p>
          <div className="comparison-add">
            <label htmlFor="utility-comparison-state" className="sr-only">
              State
            </label>
            <select
              id="utility-comparison-state"
              value={pickState}
              onChange={(event) => {
                setPickState(event.target.value);
                setPickCounty("");
              }}
            >
              <option value="">Choose a state</option>
              {(stateList.data?.states ?? []).map((s) => (
                <option key={s.abbr} value={s.abbr}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="comparison-add">
            <label htmlFor="utility-comparison-county" className="sr-only">
              County
            </label>
            <select
              id="utility-comparison-county"
              value={pickCounty}
              disabled={!pickState || counties.loading}
              onChange={(event) => setPickCounty(event.target.value)}
            >
              <option value="">
                {pickState ? "Choose a county" : "Pick a state first"}
              </option>
              {countyNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {counties.error && <p role="alert">{counties.error.message}</p>}
        </div>

        {form.utilityIds.length > 0 && (
          <fieldset className="comparison-states">
            <legend>
              Utility companies{" "}
              <span className="field-hint">(up to {MAX_UTILITIES})</span>
            </legend>
            {form.utilityIds.length > 0 && (
              <ul className="state-chips">
                {form.utilityIds.map((utilityId, i) => (
                  <li
                    key={utilityId}
                    className="state-chip"
                    style={{
                      "--chip-color": SERIES_COLORS[i % SERIES_COLORS.length],
                    }}
                  >
                    {nameOf(utilityId)}
                    <button
                      type="button"
                      className="state-chip-remove"
                      aria-label={`Remove ${nameOf(utilityId)}`}
                      onClick={() => removeUtility(utilityId)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        <div className="field">
          <label htmlFor="utility-comparison-notes">Notes</label>
          <textarea
            id="utility-comparison-notes"
            rows={6}
            value={form.notes}
            maxLength={NOTES_MAX}
            onChange={(event) => update("notes", event.target.value)}
            aria-describedby="utility-comparison-notes-count"
          />
          <p className="field-hint" id="utility-comparison-notes-count">
            {form.notes.length} of {NOTES_MAX} characters
          </p>
        </div>

        {errors.length > 0 && (
          <ul className="form-error" role="alert">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className="comparison-form-actions">
          <button
            type="submit"
            className="button button-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : isNew ? "Save comparison" : "Save changes"}
          </button>
          {!isNew && (
            <button
              type="button"
              className="button button-danger"
              onClick={handleDelete}
            >
              Delete comparison
            </button>
          )}
        </div>
      </form>

      <div className="comparison-right">
        <section
          className="comparison-preview"
          aria-labelledby="utility-options-title"
        >
          <h2 id="utility-options-title">
            {pickCounty
              ? `Utilities serving ${pickCounty}, ${pickState}`
              : "Utilities by county"}
          </h2>
          {countyUtilities.loading && <p role="status">Loading utilities…</p>}
          {countyUtilities.error && (
            <p role="alert">{countyUtilities.error.message}</p>
          )}
          {countyUtilities.data && countyUtilities.data.items.length === 0 && (
            <p>We do not have utility data for this county.</p>
          )}
          {countyUtilities.data && countyUtilities.data.items.length > 0 && (
            <ul className="utility-options">
              {countyUtilities.data.items.map((u) => {
                const added = form.utilityIds.includes(u.utilityId);
                return (
                  <li key={u.utilityId} className="utility-option">
                    <div className="utility-option-main">
                      <strong>{u.name}</strong>
                      <span className="utility-option-figures">
                        {u.customers === null
                          ? "No figures reported"
                          : [
                              `${customerCount.format(u.customers)} customers`,
                              u.centsPerKwh === null
                                ? null
                                : `${perKwh(u.centsPerKwh)} per kWh`,
                              u.kwhPerMonth === null
                                ? null
                                : `${Math.round(u.kwhPerMonth).toLocaleString("en-US")} kWh/month`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="button"
                      disabled={added || full}
                      onClick={() => addUtility(u)}
                      aria-label={`Add ${u.name} to the comparison`}
                    >
                      {added ? "Added" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {countyUtilities.data?.year && (
            <p className="comparison-preview-empty">
              Residential figures from {countyUtilities.data.year}.
            </p>
          )}
        </section>

        <section
          className="comparison-preview"
          aria-labelledby="utility-comparison-preview-title"
        >
          <h2 id="utility-comparison-preview-title">
            Side by side{year ? `, ${year}` : ""}
          </h2>
          {form.utilityIds.length === 0 && (
            <p className="comparison-preview-empty">
              Add a utility company and its numbers appear here. Figures are for
              homes only.
            </p>
          )}
          {preview.error && <p role="alert">{preview.error.message}</p>}
          {preview.loading && compared.length === 0 && (
            <p role="status">Loading the figures…</p>
          )}

          {compared.length > 0 && (
            <div className="table-scroll">
              <table className="comparison-table comparison-table-wrap">
                <thead>
                  <tr>
                    <td />
                    {compared.map((u) => (
                      <th key={u.utilityId} scope="col">
                        <span
                          className="comparison-table-key"
                          style={{
                            background:
                              SERIES_COLORS[
                                form.utilityIds.indexOf(u.utilityId) %
                                  SERIES_COLORS.length
                              ],
                          }}
                          aria-hidden="true"
                        />
                        {u.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {compared.map((u) => (
                        <td key={u.utilityId}>{row.value(u)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="comparison-table-actions">
                    <td />
                    {compared.map((u) => (
                      <td key={u.utilityId}>
                        <button
                          type="button"
                          className="button button-quiet"
                          onClick={() => removeUtility(u.utilityId)}
                          aria-label={`Remove ${u.name} from the comparison`}
                        >
                          Remove
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {compared.length > 1 && (
          <section
            className="comparison-preview"
            aria-labelledby="utility-average-title"
          >
            <h2 id="utility-average-title">Average price per kWh</h2>
            <PriceBarChart
              label="Average price per kWh for the selected companies"
              format={perKwh}
              rows={chartRows}
            />
            {priced.length < compared.length && (
              <p className="comparison-preview-empty">
                Companies with no price are left out of the average.
              </p>
            )}
          </section>
        )}

        {form.utilityIds.length > 0 && (
          <section
            className="comparison-preview"
            aria-labelledby="utility-trend-title"
          >
            <div className="comparison-chart-header">
              <h2 id="utility-trend-title">Over the years</h2>
              <label htmlFor="utility-trend-field" className="sr-only">
                Chart shows
              </label>
              <select
                id="utility-trend-field"
                value={trendField}
                onChange={(event) => setTrendField(event.target.value)}
              >
                {Object.entries(TREND_OPTIONS).map(([key, option]) => (
                  <option key={key} value={key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {trend.error && <p role="alert">{trend.error.message}</p>}
            {trend.loading && trendSeries.length === 0 && (
              <p role="status">Loading the figures…</p>
            )}
            {trendSeries.length > 0 && (
              <TrendChart
                series={trendSeries}
                yFormat={trendOption.format}
                label={`${trendOption.label} by year for ${trendSeries
                  .map((s) => s.label)
                  .join(", ")}`}
              />
            )}
            {trend.data && trendSeries.length === 0 && (
              <p className="comparison-preview-empty">
                No yearly figures are available for these companies.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

UtilityComparisonEditor.propTypes = {};

export default UtilityComparisonEditor;
