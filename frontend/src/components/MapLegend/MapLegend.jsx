import PropTypes from "prop-types";
import "./MapLegend.css";

// Reads the bins of a d3 quantile scale: each color covers an equal number
// of places, so the bins are ranges like "9.2k to 10.1k".
function MapLegend({ scale, title, tickFormat, note }) {
  const bins = scale
    ? scale
        .range()
        .map((color) => {
          const [low, high] = scale.invertExtent(color);
          return { color, low, high };
        })
        .filter((bin) => Number.isFinite(bin.low) && bin.high > bin.low)
    : [];
  const ticks = bins.length
    ? [bins[0].low, ...bins.map((bin) => bin.high)]
    : [];
  const description = bins
    .map((bin) => `${tickFormat(bin.low)} to ${tickFormat(bin.high)}`)
    .join(", ");

  return (
    <div className="map-legend">
      <p className="map-legend-title">{title}</p>
      {bins.length > 0 && (
        <div className="map-legend-row">
          <div
            className="map-legend-ramp"
            role="img"
            aria-label={`Color bins, light to dark: ${description}`}
          >
            <div className="map-legend-swatches">
              {bins.map((bin) => (
                <span key={bin.color} style={{ background: bin.color }} />
              ))}
            </div>
            <div className="map-legend-ticks" aria-hidden="true">
              {ticks.map((tick, i) => (
                <span
                  key={`${tick}-${i}`}
                  style={{ left: `${(i / bins.length) * 100}%` }}
                >
                  {tickFormat(tick)}
                </span>
              ))}
            </div>
          </div>
          <span className="map-legend-no-data">
            <span className="map-legend-no-data-swatch" aria-hidden="true" />
            No data
          </span>
        </div>
      )}
      {note && <p className="map-legend-note">{note}</p>}
    </div>
  );
}

MapLegend.propTypes = {
  scale: PropTypes.func,
  title: PropTypes.string.isRequired,
  tickFormat: PropTypes.func.isRequired,
  note: PropTypes.string,
};

export default MapLegend;
