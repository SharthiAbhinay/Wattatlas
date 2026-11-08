import PropTypes from "prop-types";
import { METRICS } from "../../lib/format.js";
import "./MapControls.css";

function MapControls({
  metric,
  onMetricChange,
  states,
  selectedAbbr,
  onSelectState,
}) {
  return (
    <div className="map-controls">
      <fieldset className="map-controls-metric">
        <legend>Color the map by</legend>
        <div className="segmented">
          {Object.values(METRICS).map((option) => (
            <label key={option.id} className="segmented-option">
              <input
                type="radio"
                name="map-metric"
                value={option.id}
                checked={metric === option.id}
                onChange={() => onMetricChange(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="map-controls-field">
        <label htmlFor="map-state">Zoom to a state</label>
        <select
          id="map-state"
          value={selectedAbbr ?? ""}
          onChange={(event) => onSelectState(event.target.value || null)}
        >
          <option value="">Whole country</option>
          {states.map((state) => (
            <option key={state.abbr} value={state.abbr}>
              {state.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

MapControls.propTypes = {
  metric: PropTypes.oneOf(Object.keys(METRICS)).isRequired,
  onMetricChange: PropTypes.func.isRequired,
  states: PropTypes.arrayOf(
    PropTypes.shape({
      abbr: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  selectedAbbr: PropTypes.string,
  onSelectState: PropTypes.func.isRequired,
};

export default MapControls;
