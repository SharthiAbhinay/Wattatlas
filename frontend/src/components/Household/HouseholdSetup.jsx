import PropTypes from "prop-types";
import { useState } from "react";
import { saveHousehold } from "../../lib/api.js";
import { useApiData } from "../../lib/useApiData.js";
import "./HouseholdSetup.css";

// First-visit prompt: where does the household live? Both fields are
// dropdowns fed by the server's own lists, and the server checks again that
// the county really is in the chosen state before saving.
export default function HouseholdSetup({
  initialState = "",
  initialCounty = "",
  initialUtilityId = null,
  editing = false,
  onSaved,
  onCancel,
}) {
  const [state, setState] = useState(initialState);
  const [county, setCounty] = useState(initialCounty);
  const [utilityId, setUtilityId] = useState(
    initialUtilityId === null ? "" : String(initialUtilityId)
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const states = useApiData("/api/states");
  const counties = useApiData(state ? `/api/places/${state}/counties` : null);
  // The utilities that serve the chosen county. Choosing one is optional.
  const utilities = useApiData(
    state && county
      ? `/api/utilities/county?state=${state}&county=${encodeURIComponent(county)}`
      : null
  );
  const utilityOptions = utilities.data?.items ?? [];
  const countyNames = (counties.data?.items ?? [])
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b));

  function handleStateChange(e) {
    setState(e.target.value);
    setCounty("");
    setUtilityId("");
    setError("");
  }

  function handleCountyChange(e) {
    setCounty(e.target.value);
    setUtilityId("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { household } = await saveHousehold({ state, county, utilityId });
      onSaved(household);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const noCounties =
    state && !counties.loading && !counties.error && countyNames.length === 0;

  return (
    <div className="household household-setup">
      <section>
        <h1>
          {editing
            ? "Edit your household"
            : "Welcome! Where is your household?"}
        </h1>
        <p>
          Tell us your state and county, and your electric utility if you know
          it.
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
              onChange={handleCountyChange}
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
          <label>
            Electric utility (optional)
            <select
              value={utilityId}
              onChange={(e) => setUtilityId(e.target.value)}
              disabled={!county || utilities.loading}
            >
              <option value="">
                {county ? "Not listed / I don't know" : "Pick a county first"}
              </option>
              {utilityOptions.map((u) => (
                <option key={u.utilityId} value={u.utilityId}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {noCounties && (
            <p role="alert">
              We don&rsquo;t have county data for that state yet.
            </p>
          )}
          {(error || states.error || counties.error) && (
            <p role="alert">
              {error || (states.error || counties.error).message}
            </p>
          )}
          <button type="submit" disabled={!state || !county || saving}>
            {saving ? "Saving…" : "Save household"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

HouseholdSetup.propTypes = {
  initialState: PropTypes.string,
  initialCounty: PropTypes.string,
  initialUtilityId: PropTypes.number,
  editing: PropTypes.bool,
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};
