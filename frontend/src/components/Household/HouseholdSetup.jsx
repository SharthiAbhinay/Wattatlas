import PropTypes from "prop-types";
import { useState } from "react";
import { saveHousehold } from "../../lib/api.js";
import { useApiData } from "../../lib/useApiData.js";

// First-visit prompt: where does the household live? Both fields are
// dropdowns fed by the server's own lists, and the server checks again that
// the county really is in the chosen state before saving.
export default function HouseholdSetup({ initialState = "", onSaved }) {
  const [state, setState] = useState(initialState);
  const [county, setCounty] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const states = useApiData("/api/states");
  const counties = useApiData(state ? `/api/places/${state}/counties` : null);
  const countyNames = (counties.data?.items ?? [])
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b));

  function handleStateChange(e) {
    setState(e.target.value);
    setCounty("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { household } = await saveHousehold({ state, county });
      onSaved(household);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const noCounties =
    state && !counties.loading && !counties.error && countyNames.length === 0;

  return (
    <main className="household household-setup">
      <section>
        <h2>Welcome! Where is your household?</h2>
        <p>
          Tell us your state and county so we can set up your household.
        </p>
        <form className="household-card setup-form" onSubmit={handleSubmit}>
          <label>
            State
            <select
              value={state}
              onChange={handleStateChange}
              required
              disabled={states.loading}
            >
              <option value="">Select a state</option>
              {(states.data?.states ?? []).map((s) => (
                <option key={s.abbr} value={s.abbr}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            County
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              required
              disabled={!state || counties.loading || countyNames.length === 0}
            >
              <option value="">
                {state ? "Select a county" : "Pick a state first"}
              </option>
              {countyNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {noCounties && (
            <p role="alert">We don&rsquo;t have county data for that state yet.</p>
          )}
          {(error || states.error || counties.error) && (
            <p role="alert">
              {error || (states.error || counties.error).message}
            </p>
          )}
          <button type="submit" disabled={!state || !county || saving}>
            {saving ? "Saving…" : "Save household"}
          </button>
        </form>
      </section>
    </main>
  );
}

HouseholdSetup.propTypes = {
  initialState: PropTypes.string,
  onSaved: PropTypes.func.isRequired,
};
