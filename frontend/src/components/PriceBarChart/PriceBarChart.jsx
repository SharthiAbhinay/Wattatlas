import PropTypes from "prop-types";
import "./PriceBarChart.css";

// A small horizontal bar chart: one bar per row, all on one scale that starts
// at zero. A row can be marked as the average, which draws it in a neutral
// dark color after a divider. With only a handful of bars, each carries its
// value at the tip.
function PriceBarChart({ rows, format, label }) {
  const top = Math.max(...rows.map((r) => r.value), 0);

  return (
    <ul className="price-chart" aria-label={label}>
      {rows.map((row) => (
        <li
          key={row.key}
          className={`price-chart-row${row.isAverage ? " is-average" : ""}`}
        >
          <span className="price-chart-name">{row.label}</span>
          <span className="price-chart-track">
            <span
              className="price-chart-bar"
              style={{
                width: `${top > 0 ? (row.value / top) * 100 : 0}%`,
                background: row.color,
              }}
            />
          </span>
          <span className="price-chart-value">{format(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}

PriceBarChart.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired,
      isAverage: PropTypes.bool,
    })
  ).isRequired,
  format: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
};

export default PriceBarChart;
