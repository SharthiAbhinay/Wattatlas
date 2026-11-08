import * as d3 from "d3";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import "./TrendChart.css";

const MARGIN = { top: 12, right: 14, bottom: 28, left: 54 };
const monthLabel = d3.utcFormat("%b %Y");

// Line chart for yearly or monthly series. A series can be dashed (used for
// forecasts) and can carry a band of lower/upper values (a forecast range).
// Pass `series` from useMemo so the chart only redraws when data changes.
function TrendChart({
  series,
  xType = "year",
  yFormat,
  label,
  height = 220,
  yZero = false,
}) {
  const plotRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width))
    );
    observer.observe(plotRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tip = tipRef.current;
    svg.selectAll("*").remove();
    tip.hidden = true;
    if (width === 0) return;

    const valid = (p) => Number.isFinite(p.y);
    const points = series.flatMap((s) => s.points.filter(valid));
    if (points.length === 0) return;
    const bands = series.flatMap((s) =>
      (s.band ?? []).filter(
        (b) => Number.isFinite(b.lower) && Number.isFinite(b.upper)
      )
    );

    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const xValues = [...points.map((p) => +p.x), ...bands.map((b) => +b.x)];
    const x = (xType === "month" ? d3.scaleUtc() : d3.scaleLinear())
      .domain(d3.extent(xValues))
      .range([0, innerWidth]);
    const low = d3.min([
      ...points.map((p) => p.y),
      ...bands.map((b) => b.lower),
    ]);
    const high = d3.max([
      ...points.map((p) => p.y),
      ...bands.map((b) => b.upper),
    ]);
    const pad = (high - low) * 0.12 || high * 0.1 || 1;
    const y = d3
      .scaleLinear()
      .domain([yZero ? 0 : Math.max(0, low - pad), high + pad])
      .nice()
      .range([innerHeight, 0]);

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    g.append("g")
      .attr("class", "trend-chart-grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(yFormat))
      .call((axis) => axis.select(".domain").remove());

    const uniqueX = [...new Set(xValues)].sort((a, b) => a - b);
    const xAxis =
      xType === "month"
        ? d3
            .axisBottom(x)
            .ticks(Math.max(2, Math.floor(innerWidth / 95)))
            .tickFormat(monthLabel)
        : d3
            .axisBottom(x)
            .ticks(
              Math.min(uniqueX.length, Math.max(2, Math.floor(innerWidth / 55)))
            )
            .tickFormat(d3.format("d"));
    g.append("g")
      .attr("class", "trend-chart-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);

    for (const s of series) {
      const band = (s.band ?? []).filter(
        (b) => Number.isFinite(b.lower) && Number.isFinite(b.upper)
      );
      if (band.length) {
        g.append("path")
          .datum(band)
          .attr("class", "trend-chart-band")
          .attr("fill", s.color)
          .attr(
            "d",
            d3
              .area()
              .x((b) => x(b.x))
              .y0((b) => y(b.lower))
              .y1((b) => y(b.upper))
          );
      }
    }

    const line = d3
      .line()
      .defined(valid)
      .x((p) => x(p.x))
      .y((p) => y(p.y));
    for (const s of series) {
      g.append("path")
        .datum(s.points)
        .attr("class", "trend-chart-line")
        .attr("stroke", s.color)
        .attr("stroke-dasharray", s.dashed ? "6 4" : null)
        .attr("d", line);
    }

    const rule = g
      .append("line")
      .attr("class", "trend-chart-rule")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("display", "none");
    const dots = g.append("g");

    function hide() {
      rule.attr("display", "none");
      dots.selectAll("*").remove();
      tip.hidden = true;
    }

    g.append("rect")
      .attr("class", "trend-chart-overlay")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .on("pointerleave", hide)
      .on("pointermove", (event) => {
        const [mouseX] = d3.pointer(event);
        const target = +x.invert(mouseX);
        const nearest = uniqueX.reduce((best, value) =>
          Math.abs(value - target) < Math.abs(best - target) ? value : best
        );
        const rows = series
          .map((s) => ({
            s,
            p: s.points.find((p) => +p.x === nearest && valid(p)),
          }))
          .filter((row) => row.p);
        if (rows.length === 0) return hide();

        const px = x(nearest);
        rule.attr("display", null).attr("x1", px).attr("x2", px);
        dots
          .selectAll("circle")
          .data(rows)
          .join("circle")
          .attr("class", "trend-chart-dot")
          .attr("r", 4)
          .attr("cx", px)
          .attr("cy", (row) => y(row.p.y))
          .attr("fill", (row) => row.s.color);

        const heading = document.createElement("strong");
        heading.textContent =
          xType === "month" ? monthLabel(new Date(nearest)) : String(nearest);
        const list = document.createElement("ul");
        for (const row of rows) {
          const item = document.createElement("li");
          item.style.setProperty("--key-color", row.s.color);
          item.textContent = `${row.s.label}: ${yFormat(row.p.y)}`;
          list.append(item);
        }
        tip.replaceChildren(heading, list);
        tip.hidden = false;
        const left = MARGIN.left + px + 12;
        tip.style.left = `${left + tip.offsetWidth > width ? MARGIN.left + px - tip.offsetWidth - 12 : left}px`;
        tip.style.top = `${MARGIN.top}px`;
      });
  }, [series, width, height, xType, yFormat, yZero]);

  return (
    <figure className="trend-chart">
      <div className="trend-chart-plot" ref={plotRef}>
        <svg ref={svgRef} role="img" aria-label={label} height={height} />
        <div className="trend-chart-tooltip" ref={tipRef} hidden />
      </div>
      <ul className="trend-chart-legend">
        {series.map((s) => (
          <li key={s.id}>
            <span
              className={`trend-chart-key${s.dashed ? " is-dashed" : ""}`}
              style={{ "--key-color": s.color }}
              aria-hidden="true"
            />
            {s.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}

const xValue = PropTypes.oneOfType([
  PropTypes.number,
  PropTypes.instanceOf(Date),
]);

TrendChart.propTypes = {
  series: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      dashed: PropTypes.bool,
      points: PropTypes.arrayOf(
        PropTypes.shape({ x: xValue.isRequired, y: PropTypes.number })
      ).isRequired,
      band: PropTypes.arrayOf(
        PropTypes.shape({
          x: xValue.isRequired,
          lower: PropTypes.number,
          upper: PropTypes.number,
        })
      ),
    })
  ).isRequired,
  xType: PropTypes.oneOf(["year", "month"]),
  yFormat: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  height: PropTypes.number,
  yZero: PropTypes.bool,
};

export default TrendChart;
