import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  createComparison,
  deleteComparison,
  getComparison,
  updateComparison,
} from "../../lib/api.js";
import {
  formatCents,
  formatCentsShort,
  formatChange,
  formatCompact,
  formatGWh,
  formatKWh,
  formatShare,
  SERIES_COLORS,
} from "../../lib/format.js";
import { PATTERN_LABEL } from "../../lib/insights.js";
import { useApiData } from "../../lib/useApiData.js";
import TrendChart from "../TrendChart/TrendChart.jsx";
import "./ComparisonEditor.css";

const MAX_STATES = 4;
const NAME_MAX = 80;
const NOTES_MAX = 2000;

const CHART_OPTIONS = {
  perCapita: {
    label: "Use per person",
    field: "perCapita",
    format: formatCompact,
  },
  sales: { label: "Total use (GWh)", field: "sales", format: formatCompact },
  price: { label: "Average price", field: "price", format: formatCentsShort },
};

const ROWS = [
  { label: "Use per person", value: (s) => formatKWh(s.summary.perCapita) },
  { label: "Total use", value: (s) => formatGWh(s.summary.sales) },
  { label: "Average price", value: (s) => formatCents(s.summary.price) },
  {
    label: "Average home, per month",
    value: (s) => formatKWh(s.summary.avgHomeMonthlyKWh),
  },
  {
    label: "Homes’ share of use",
    value: (s) => formatShare(s.residentialShare),
  },
  { label: "Peak season", value: (s) => PATTERN_LABEL[s.pattern] ?? "No data" },
  {
    label: "Change in total use",
    value: (s) =>
      s.change
        ? `${formatChange(s.change.salesPct)} since ${s.change.fromYear}`
        : "No data",
  },
];

function statesFromQuery(value) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z]{2}$/.test(s))
    ),
  ].slice(0, MAX_STATES);
}

function ComparisonEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stateList = useApiData("/api/states");
  const [form, setForm] = useState(() => ({
    name: "",
    notes: "",
    states: isNew ? statesFromQuery(searchParams.get("states")) : [],
  }));
  const [loadError, setLoadError] = useState(null);
  const [loaded, setLoaded] = useState(isNew);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toAdd, setToAdd] = useState("");
  const [chartField, setChartField] = useState("perCapita");

  useEffect(() => {
    if (isNew) return undefined;
    const controller = new AbortController();
    getComparison(id, controller.signal)
      .then(({ comparison }) => {
        setForm({
          name: comparison.name,
          notes: comparison.notes,
          states: comparison.states,
        });
        setLoaded(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoadError(err);
      });
    return () => controller.abort();
  }, [id, isNew]);

  const preview = useApiData(
    form.states.length
      ? `/api/states/compare?states=${form.states.join(",")}`
      : null,
    { keepPrevious: true }
  );

  const allStates = stateList.data?.states ?? [];
  const nameOf = (abbr) => allStates.find((s) => s.abbr === abbr)?.name ?? abbr;
  const available = allStates.filter((s) => !form.states.includes(s.abbr));
  const full = form.states.length >= MAX_STATES;
  // Show columns in the order the states were picked.
  const compared = (preview.data?.states ?? []).filter((s) =>
    form.states.includes(s.abbr)
  );
  const chart = CHART_OPTIONS[chartField];

  const chartSeries = useMemo(
    () =>
      (preview.data?.states ?? [])
        .filter((s) => form.states.includes(s.abbr))
        .map((s) => ({
          id: s.abbr,
          label: s.name,
          color:
            SERIES_COLORS[form.states.indexOf(s.abbr) % SERIES_COLORS.length],
          points: s.annual.map((a) => ({ x: a.year, y: a[chart.field] })),
        })),
    [preview.data, form.states, chart.field]
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addState() {
    if (!toAdd || full) return;
    update("states", [...form.states, toAdd]);
    setToAdd("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problems = [];
    if (!form.name.trim()) problems.push("Give the comparison a name.");
    if (form.states.length === 0) problems.push("Pick at least one state.");
    if (problems.length) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      if (isNew) await createComparison(form);
      else await updateComparison(id, form);
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
      await deleteComparison(id);
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
        <h1>{isNew ? "New comparison" : "Edit comparison"}</h1>

        <div className="field">
          <label htmlFor="comparison-name">Name</label>
          <input
            id="comparison-name"
            value={form.name}
            maxLength={NAME_MAX}
            placeholder="Where to move for the new job"
            onChange={(event) => update("name", event.target.value)}
            required
          />
        </div>

        <fieldset className="comparison-states">
          <legend>
            States <span className="field-hint">(up to {MAX_STATES})</span>
          </legend>
          {form.states.length > 0 && (
            <ul className="state-chips">
              {form.states.map((abbr, i) => (
                <li
                  key={abbr}
                  className="state-chip"
                  style={{
                    "--chip-color": SERIES_COLORS[i % SERIES_COLORS.length],
                  }}
                >
                  {nameOf(abbr)}
                  <button
                    type="button"
                    className="state-chip-remove"
                    aria-label={`Remove ${nameOf(abbr)}`}
                    onClick={() =>
                      update(
                        "states",
                        form.states.filter((s) => s !== abbr)
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="comparison-add">
            <label htmlFor="comparison-add-state" className="sr-only">
              State to add
            </label>
            <select
              id="comparison-add-state"
              value={toAdd}
              disabled={full}
              onChange={(event) => setToAdd(event.target.value)}
            >
              <option value="">
                {full ? "Four states is the limit" : "Choose a state"}
              </option>
              {available.map((s) => (
                <option key={s.abbr} value={s.abbr}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button"
              disabled={!toAdd || full}
              onClick={addState}
            >
              Add state
            </button>
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="comparison-notes">Notes</label>
          <textarea
            id="comparison-notes"
            rows={6}
            value={form.notes}
            maxLength={NOTES_MAX}
            onChange={(event) => update("notes", event.target.value)}
            aria-describedby="comparison-notes-count"
          />
          <p className="field-hint" id="comparison-notes-count">
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

      <section
        className="comparison-preview"
        aria-labelledby="comparison-preview-title"
      >
        <h2 id="comparison-preview-title">
          Side by side{preview.data ? `, ${preview.data.year}` : ""}
        </h2>
        {form.states.length === 0 && (
          <p className="comparison-preview-empty">
            Add a state and its numbers appear here. You can also start from any
            state on the map.
          </p>
        )}
        {preview.error && <p role="alert">{preview.error.message}</p>}
        {preview.loading && compared.length === 0 && (
          <p role="status">Loading the figures…</p>
        )}

        {compared.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <td />
                    {compared.map((s) => (
                      <th key={s.abbr} scope="col">
                        <span
                          className="comparison-table-key"
                          style={{
                            background:
                              SERIES_COLORS[
                                form.states.indexOf(s.abbr) %
                                  SERIES_COLORS.length
                              ],
                          }}
                          aria-hidden="true"
                        />
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {compared.map((s) => (
                        <td key={s.abbr}>{row.value(s)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="comparison-chart-header">
              <h3>Over the years</h3>
              <label htmlFor="comparison-chart-field" className="sr-only">
                Chart shows
              </label>
              <select
                id="comparison-chart-field"
                value={chartField}
                onChange={(event) => setChartField(event.target.value)}
              >
                {Object.entries(CHART_OPTIONS).map(([key, option]) => (
                  <option key={key} value={key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <TrendChart
              series={chartSeries}
              yFormat={chart.format}
              label={`${chart.label} by year for ${compared.map((s) => s.name).join(", ")}`}
            />
          </>
        )}
      </section>
    </div>
  );
}

ComparisonEditor.propTypes = {};

export default ComparisonEditor;
