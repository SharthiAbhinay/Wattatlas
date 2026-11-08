import * as d3 from "d3";
import PropTypes from "prop-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import us from "us-atlas/counties-10m.json";
import { METRICS } from "../../lib/format.js";
import { useApiData } from "../../lib/useApiData.js";
import MapControls from "../MapControls/MapControls.jsx";
import MapLegend from "../MapLegend/MapLegend.jsx";
import "./UsageMap.css";

const WIDTH = 975;
const HEIGHT = 610;
const MAX_ZOOM = 24;
const BINS = 7;
const SCHEMES = {
  usage: d3.schemeYlOrBr[BINS],
  price: d3.schemePuBu[BINS],
};
const NO_DATA_FILL = "var(--map-no-data)";

// Albers USA puts Alaska and Hawaii in insets; territories have no
// position in it, so their shapes are dropped.
const projection = d3
  .geoAlbersUsa()
  .scale(1300)
  .translate([WIDTH / 2, HEIGHT / 2]);
const path = d3.geoPath(projection);
const stateShapes = feature(us, us.objects.states).features.filter((f) =>
  path(f)
);
const countyShapes = feature(us, us.objects.counties).features.filter((f) =>
  path(f)
);
const innerBorders = mesh(us, us.objects.states, (a, b) => a !== b);
const outerBorder = mesh(us, us.objects.states, (a, b) => a === b);

function quantileScale(values, scheme) {
  const clean = values.filter(Number.isFinite);
  return clean.length >= 2 ? d3.scaleQuantile(clean, scheme) : null;
}

function fillFor(scale, value) {
  return scale && Number.isFinite(value) ? scale(value) : NO_DATA_FILL;
}

// County estimates are stored in MWh. The map shows GWh for total use and
// kWh per person, to match the state figures. Prices aren't published by
// county.
function countyValue(county, metric) {
  if (metric === "price" || !Number.isFinite(county.total)) return null;
  if (metric === "total") return county.total / 1000;
  return county.population > 0
    ? (county.total * 1000) / county.population
    : null;
}

function UsageMap({ selectedAbbr, onSelectState }) {
  const [metric, setMetric] = useState("perCapita");
  const summary = useApiData("/api/states/summary");
  const counties = useApiData(
    selectedAbbr ? `/api/places/${selectedAbbr}/counties` : null
  );
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  // D3 handlers are attached once, so they read the latest values here.
  const latest = useRef({});

  const metricInfo = METRICS[metric];
  const stateField = metricInfo.field;
  const scheme = metric === "price" ? SCHEMES.price : SCHEMES.usage;
  const states = useMemo(() => summary.data?.states ?? [], [summary.data]);
  const selected = states.find((s) => s.abbr === selectedAbbr) ?? null;
  const selectedFips = selected?.fips ?? null;

  const stateValues = useMemo(
    () => new Map(states.map((s) => [s.fips, s[stateField]])),
    [states, stateField]
  );
  const stateScale = useMemo(
    () => quantileScale([...stateValues.values()], scheme),
    [stateValues, scheme]
  );
  const countyRows = useMemo(
    () => (counties.data?.items ?? []).filter((c) => c.fips),
    [counties.data]
  );
  const countyValues = useMemo(
    () => new Map(countyRows.map((c) => [c.fips, countyValue(c, metric)])),
    [countyRows, metric]
  );
  const countyScale = useMemo(
    () => quantileScale([...countyValues.values()], scheme),
    [countyValues, scheme]
  );
  const showingCounties = Boolean(selected && countyScale);

  useEffect(() => {
    latest.current = {
      select(fips) {
        onSelectState(states.find((s) => s.fips === fips)?.abbr ?? null);
      },
      describeState(fips) {
        const row = states.find((s) => s.fips === fips);
        return row ? `${row.name}: ${metricInfo.format(row[stateField])}` : "";
      },
      describeCounty(fips, fallbackName) {
        const row = countyRows.find((c) => c.fips === fips);
        const name = row?.name ?? `${fallbackName} County`;
        return showingCounties
          ? `${name}: ${metricInfo.format(countyValues.get(fips))} (estimate)`
          : name;
      },
    };
  });

  // Draw the layers once.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tip = tipRef.current;

    function showTip(event, text, shape) {
      tip.textContent = text;
      tip.hidden = false;
      const [x, y] = d3.pointer(event, wrapRef.current);
      const flip = x > wrapRef.current.clientWidth - 220;
      tip.style.left = `${flip ? x - tip.offsetWidth - 14 : x + 14}px`;
      tip.style.top = `${y + 14}px`;
      svg.select(".map-hover").attr("d", path(shape)).attr("display", null);
    }
    function hideTip() {
      tip.hidden = true;
      svg.select(".map-hover").attr("display", "none");
    }

    svg.selectAll("*").remove();
    svg
      .append("rect")
      .attr("class", "map-background")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
      .on("click", () => latest.current.select(null));

    const root = svg.append("g").attr("class", "map-root");
    root
      .append("g")
      .selectAll("path")
      .data(stateShapes, (d) => d.id)
      .join("path")
      .attr("class", "map-state")
      .attr("d", path)
      .on("click", (event, d) => latest.current.select(d.id))
      .on("pointermove", (event, d) =>
        showTip(event, latest.current.describeState(d.id), d)
      )
      .on("pointerleave", hideTip);

    root
      .append("g")
      .attr("class", "map-counties")
      .on("pointermove", (event) => {
        const d = d3.select(event.target).datum();
        if (d) {
          showTip(
            event,
            latest.current.describeCounty(d.id, d.properties.name),
            d
          );
        }
      })
      .on("pointerleave", hideTip);

    root
      .append("path")
      .attr("class", "map-border")
      .datum(innerBorders)
      .attr("d", path);
    root
      .append("path")
      .attr("class", "map-outline")
      .datum(outerBorder)
      .attr("d", path);
    root.append("path").attr("class", "map-selected").attr("display", "none");
    root.append("path").attr("class", "map-hover").attr("display", "none");

    return () => svg.selectAll("*").remove();
  }, []);

  // Zoom to the selected state and draw its counties.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const shape = stateShapes.find((f) => f.id === selectedFips);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let transform = d3.zoomIdentity;
    if (shape) {
      const [[x0, y0], [x1, y1]] = path.bounds(shape);
      const scale = Math.min(
        MAX_ZOOM,
        0.88 / Math.max((x1 - x0) / WIDTH, (y1 - y0) / HEIGHT)
      );
      transform = d3.zoomIdentity
        .translate(WIDTH / 2, HEIGHT / 2)
        .scale(scale)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    }

    svg
      .select(".map-counties")
      .selectAll("path")
      .data(
        shape
          ? countyShapes.filter((f) => f.id.slice(0, 2) === selectedFips)
          : [],
        (d) => d.id
      )
      .join("path")
      .attr("class", "map-county")
      .attr("d", path);
    svg
      .select(".map-selected")
      .attr("display", shape ? null : "none")
      .attr("d", shape ? path(shape) : null);
    svg
      .selectAll(".map-state")
      .classed("is-dimmed", (d) => Boolean(shape) && d.id !== selectedFips);
    svg
      .select(".map-root")
      .transition()
      .duration(reduceMotion ? 0 : 750)
      .attr("transform", transform.toString());
  }, [selectedFips]);

  useEffect(() => {
    d3.select(svgRef.current)
      .selectAll(".map-state")
      .attr("fill", (d) => fillFor(stateScale, stateValues.get(d.id)));
  }, [stateValues, stateScale]);

  // Without county figures the counties stay see-through, so the state's
  // own color shows under the county lines.
  useEffect(() => {
    d3.select(svgRef.current)
      .selectAll(".map-county")
      .attr("fill", (d) =>
        countyScale
          ? fillFor(countyScale, countyValues.get(d.id))
          : "transparent"
      );
  }, [countyValues, countyScale, selectedFips]);

  const countyYear = countyRows.find((c) => c.year)?.year;
  let legendNote = null;
  if (selected && metric === "price") {
    legendNote =
      "Prices aren't published by county, so the state keeps one color.";
  } else if (selected && counties.data && countyRows.length === 0) {
    legendNote = "County estimates haven't been loaded yet.";
  } else if (showingCounties) {
    legendNote = `County figures are NREL model estimates${countyYear ? ` for ${countyYear}` : ""}, so they don't add up exactly to the state's EIA total.`;
  } else if (metric === "perCapita") {
    legendNote =
      "Use per person divides each state's use by its 2020 population.";
  }

  const year = summary.data?.year;
  const title = `${metricInfo.title}${year ? `, ${year}` : ""}`;

  return (
    <section className="usage-map" aria-labelledby="usage-map-title">
      <header className="usage-map-header">
        <nav className="usage-map-breadcrumb" aria-label="Where you are">
          {selected ? (
            <>
              <button
                type="button"
                className="link-button"
                onClick={() => onSelectState(null)}
              >
                United States
              </button>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{selected.name}</span>
            </>
          ) : (
            <span aria-current="page">United States</span>
          )}
        </nav>
        <h1 id="usage-map-title">{title}</h1>
      </header>

      <MapControls
        metric={metric}
        onMetricChange={setMetric}
        states={states}
        selectedAbbr={selectedAbbr}
        onSelectState={onSelectState}
      />

      {summary.error && (
        <p className="usage-map-error" role="alert">
          {summary.error.message}
        </p>
      )}

      <figure className="usage-map-figure">
        <div className="usage-map-canvas" ref={wrapRef}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Map of the United States colored by ${metricInfo.label.toLowerCase()}${selected ? `, zoomed to ${selected.name}` : ""}.`}
          />
          <div ref={tipRef} className="usage-map-tooltip" hidden />
        </div>
        <figcaption>
          <MapLegend
            scale={showingCounties ? countyScale : stateScale}
            title={`${metricInfo.label} by ${showingCounties ? "county" : "state"}`}
            tickFormat={metricInfo.tickFormat}
            note={legendNote}
          />
        </figcaption>
      </figure>
    </section>
  );
}

UsageMap.propTypes = {
  selectedAbbr: PropTypes.string,
  onSelectState: PropTypes.func.isRequired,
};

export default UsageMap;
