import * as d3 from "d3";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import "./MonthlyBarChart.css";

const MARGIN = { top: 12, right: 8, bottom: 26, left: 52 };
const MAX_BAR = 24;
const RADIUS = 4;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A column with a rounded top and a square base, so it sits on the baseline.
function columnPath(x, y, w, h) {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// One bar per month, January to December. `values` has 12 entries; a month
// with no bill is null and draws no bar. One measure per chart, so there is
// never a second y-axis.
function MonthlyBarChart({ values, color, label, valueFormat, tickFormat, height = 180 }) {
  const plotRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width))
    );
    observer.observe(plotRef.current);
    return () => observer.disconnect();
  }, []);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const x = d3.scaleBand().domain(d3.range(12)).range([0, innerWidth]).padding(0.3);
  const top = d3.max(values.filter((v) => v != null)) ?? 1;
  const y = d3.scaleLinear().domain([0, top]).nice().range([innerHeight, 0]);
  const barWidth = Math.min(MAX_BAR, x.bandwidth());

  return (
    <figure className="monthly-chart">
      <div className="monthly-chart-plot" ref={plotRef}>
        {width > 0 && (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            role="img"
            aria-label={label}
            onPointerLeave={() => setHover(null)}
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {y.ticks(4).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line className="monthly-chart-grid" x2={innerWidth} />
                  <text className="monthly-chart-tick" x={-8} dy="0.32em" textAnchor="end">
                    {tickFormat(t)}
                  </text>
                </g>
              ))}
              <line
                className="monthly-chart-baseline"
                y1={innerHeight}
                y2={innerHeight}
                x2={innerWidth}
              />
              {MONTHS.map((name, i) => (
                <text
                  key={name}
                  className="monthly-chart-tick"
                  x={x(i) + x.bandwidth() / 2}
                  y={innerHeight + 17}
                  textAnchor="middle"
                >
                  {name}
                </text>
              ))}
              {values.map((v, i) => {
                const cx = x(i) + x.bandwidth() / 2;
                return (
                  <g key={i} onPointerEnter={() => setHover(i)}>
                    {/* Wider, taller hit target than the bar itself. */}
                    <rect
                      x={x(i)}
                      y={0}
                      width={x.bandwidth()}
                      height={innerHeight}
                      fill="transparent"
                    />
                    {v != null && (
                      <path
                        d={columnPath(cx - barWidth / 2, y(v), barWidth, innerHeight - y(v))}
                        fill={color}
                        opacity={hover == null || hover === i ? 1 : 0.55}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        {hover != null && (
          <div
            className="monthly-chart-tooltip"
            style={{
              left: `${MARGIN.left + x(hover) + x.bandwidth() / 2}px`,
            }}
          >
            <strong>{MONTHS[hover]}</strong>{" "}
            {values[hover] == null ? "No bill" : valueFormat(values[hover])}
          </div>
        )}
      </div>
    </figure>
  );
}

MonthlyBarChart.propTypes = {
  values: PropTypes.arrayOf(PropTypes.number).isRequired,
  color: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  valueFormat: PropTypes.func.isRequired,
  tickFormat: PropTypes.func.isRequired,
  height: PropTypes.number,
};

export default MonthlyBarChart;
