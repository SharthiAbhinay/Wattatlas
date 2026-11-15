import { useEffect, useState } from "react";
import {
  addBill,
  getBills,
  getHousehold,
  getYearBills,
  updateBill,
} from "../../lib/api.js";
import { useApiData } from "../../lib/useApiData.js";
import HouseholdSetup from "./HouseholdSetup.jsx";
import MonthlyBarChart from "../MonthlyBarChart/MonthlyBarChart.jsx";
import "./Household.css";

// 1,287,097 -> "1.3M", 15,507 -> "15.5K", 808 -> "808"
const customerCount = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatCustomers = (n) => customerCount.format(n);
const KWH_COLOR = "#0072b2";
const COST_COLOR = "#d55e00";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const formatKwh = (n) => `${Math.round(n).toLocaleString("en-US")} kWh`;
const formatDollars = (n) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const compactKwh = (n) =>
  n >= 10000 ? `${n / 1000}K` : n.toLocaleString("en-US");
const compactDollars = (n) =>
  `$${n >= 10000 ? `${n / 1000}K` : n.toLocaleString("en-US")}`;

// "2026-11" -> "November 2026"
function formatMonth(month) {
  const [year, m] = month.split("-").map(Number);
  const name = new Date(year, m - 1, 1).toLocaleString("en-US", {
    month: "long",
  });
  return `${name} ${year}`;
}

export default function Household() {
  const [bills, setBills] = useState([]);
  const [yearBills, setYearBills] = useState([]);
  const [currentBill, setCurrentBill] = useState(null);
  const [currentMonth, setCurrentMonth] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kwh: "", cost: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ kwh: "", cost: "" });
  const [error, setError] = useState("");
  // undefined while loading, null when the user has no household yet.
  const [household, setHousehold] = useState(undefined);
  const [editingHousehold, setEditingHousehold] = useState(false);
  // Utilities that serve the household's county (waits until it's known).
  const utilities = useApiData(
    household?.county ? "/api/household/utilities" : null
  );

  useEffect(() => {
    const controller = new AbortController();
    getHousehold(controller.signal)
      .then((data) => setHousehold(data.household))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getBills(controller.signal)
      .then((data) => {
        setBills(data.items);
        setCurrentBill(data.current);
        setCurrentMonth(data.currentMonth);
        setLoaded(true);
        return getYearBills(data.currentMonth.slice(0, 4), controller.signal);
      })
      .then((data) => setYearBills(data.items))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, []);

  const pastBills = bills.filter((b) => b.id !== currentBill?.id);
  const year = currentMonth.slice(0, 4);
  // One entry per calendar month; null where the household has no bill.
  const kwhByMonth = Array(12).fill(null);
  const costByMonth = Array(12).fill(null);
  for (const b of yearBills) {
    const i = Number(b.month.slice(5, 7)) - 1;
    kwhByMonth[i] = Number(b.kwh);
    costByMonth[i] = Number(b.cost);
  }
  const totalKwh = kwhByMonth.reduce((sum, v) => sum + (v ?? 0), 0);
  const totalCost = costByMonth.reduce((sum, v) => sum + (v ?? 0), 0);

  // Keep the yearly charts in step with a bill that was just added or edited.
  function syncYear(bill) {
    if (!bill.month.startsWith(year)) return;
    setYearBills([...yearBills.filter((b) => b.id !== bill.id), bill]);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const { bill } = await addBill(form);
      setBills([bill, ...bills].slice(0, 5));
      syncYear(bill);
      setCurrentBill(bill);
      setAdding(false);
      setForm({ kwh: "", cost: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(bill) {
    setError("");
    setEditingId(bill.id);
    setEditForm({ kwh: String(bill.kwh), cost: String(bill.cost) });
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function handleEditSubmit(e, id) {
    e.preventDefault();
    setError("");
    try {
      const { bill } = await updateBill(id, editForm);
      setBills(bills.map((b) => (b.id === id ? bill : b)));
      syncYear(bill);
      if (currentBill?.id === id) setCurrentBill(bill);
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  // One bill as a card: its figures in a row plus an Edit button, or the
  // edit form in its place while that bill is being edited.
  function renderBill(bill, className) {
    if (editingId === bill.id) {
      return (
        <li key={bill.id} className={className}>
          <strong>{formatMonth(bill.month)}</strong>
          <form
            className="bill-edit-form"
            onSubmit={(e) => handleEditSubmit(e, bill.id)}
          >
            <input
              name="kwh"
              type="number"
              aria-label="kWh"
              value={editForm.kwh}
              onChange={handleEditChange}
              required
            />
            <input
              name="cost"
              type="number"
              step="0.01"
              aria-label="Cost ($)"
              value={editForm.cost}
              onChange={handleEditChange}
              required
            />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </form>
        </li>
      );
    }
    return (
      <li key={bill.id} className={className}>
        <strong>{formatMonth(bill.month)}</strong>
        <span>{bill.kwh} kWh</span>
        <span>${bill.cost}</span>
        <button type="button" onClick={() => startEdit(bill)}>
          Edit
        </button>
      </li>
    );
  }

  let billContent;
  if (currentBill) {
    billContent = (
      <ul className="bill-history">
        {renderBill(currentBill, "bill-card bill-card--current")}
      </ul>
    );
  } else if (adding) {
    billContent = (
      <form onSubmit={handleSubmit}>
        <input
          name="kwh"
          type="number"
          placeholder="kWh"
          value={form.kwh}
          onChange={handleChange}
          required
        />
        <input
          name="cost"
          type="number"
          step="0.01"
          placeholder="Cost ($)"
          value={form.cost}
          onChange={handleChange}
          required
        />
        <button type="submit">Save bill</button>
        <button type="button" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </form>
    );
  } else if (loaded) {
    billContent = (
      <>
        <p>No bill submitted for {currentMonth} yet.</p>
        <button type="button" onClick={() => setAdding(true)}>
          Add bill
        </button>
      </>
    );
  }

  if (household === undefined) {
    return (
      <p className="page-status" role="status">
        {error || "Loading your household…"}
      </p>
    );
  }

  // New accounts (and households saved before counties existed) are asked
  // where they live before seeing the dashboard.
  if (!household?.county) {
    return (
      <HouseholdSetup
        initialState={household?.state ?? ""}
        onSaved={setHousehold}
      />
    );
  }

  // Changing where the household lives (and its utility) later.
  if (editingHousehold) {
    return (
      <HouseholdSetup
        editing
        initialState={household.state}
        initialCounty={household.county}
        initialUtilityId={household.utilityId ?? undefined}
        onSaved={(saved) => {
          setHousehold(saved);
          setEditingHousehold(false);
          utilities.reload();
        }}
        onCancel={() => setEditingHousehold(false)}
      />
    );
  }

  return (
    <main className="household">
      <section>
        <h2>Your Household</h2>
        <div className="household-summary">
          <p>
            {household.county}, {household.state}
          </p>
          <p>Utility: {household.utilityName ?? "Not chosen"}</p>
          <button type="button" onClick={() => setEditingHousehold(true)}>
            Edit location and utility
          </button>
        </div>
      </section>
      <section>
        <h2>Power Usage</h2>
        <div className="household-card">
          <p>
            {year} total: {formatKwh(totalKwh)} &middot;{" "}
            {formatDollars(totalCost)}
          </p>
          <h3 className="chart-title">Power used (kWh)</h3>
          <MonthlyBarChart
            values={kwhByMonth}
            color={KWH_COLOR}
            label={`Power used per month in ${year}, in kilowatt-hours`}
            valueFormat={formatKwh}
            tickFormat={compactKwh}
          />
          <h3 className="chart-title">Price paid ($)</h3>
          <MonthlyBarChart
            values={costByMonth}
            color={COST_COLOR}
            label={`Amount paid per month in ${year}, in dollars`}
            valueFormat={formatDollars}
            tickFormat={compactDollars}
          />
          <details className="chart-table">
            <summary>View as table</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">kWh</th>
                  <th scope="col">Cost</th>
                </tr>
              </thead>
              <tbody>
                {MONTH_NAMES.map((name, i) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>
                      {kwhByMonth[i] == null ? "—" : formatKwh(kwhByMonth[i])}
                    </td>
                    <td>
                      {costByMonth[i] == null
                        ? "—"
                        : formatDollars(costByMonth[i])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </section>
      <section>
        <h2>Members of your household</h2>
        <div className="household-card">
          {/* TODO: replace placeholders with real household members */}
          <ul className="member-list">
            {[1, 2, 3].map((n) => (
              <li key={n} className="member">
                <span className="member-avatar" aria-hidden="true" />
                <span className="member-name">Member {n}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="household-bills">
        <h2>Monthly Bills</h2>
        <div className="household-card">
          {billContent}
          {error && <p role="alert">{error}</p>}
          {pastBills.length > 0 && (
            <ul className="bill-history" aria-label="Past bills">
              {pastBills.map((b) => renderBill(b, "bill-card"))}
            </ul>
          )}
        </div>
      </section>

      <section className="household-utilities">
        <h2>
          Utilities serving {household.county}, {household.state}
        </h2>
        <div className="household-card">
          {utilities.loading && <p role="status">Loading utilities…</p>}
          {utilities.error && <p role="alert">{utilities.error.message}</p>}
          {utilities.data && utilities.data.items.length === 0 && (
            <p>We don&rsquo;t have utility data for this county.</p>
          )}
          {utilities.data && utilities.data.items.length > 0 && (
            <ul className="bill-history utility-list">
              {utilities.data.items.map((u) => (
                <li key={u.utilityId} className="bill-card utility-card">
                  <strong>{u.name}</strong>
                  {u.customers === null ? (
                    <span>No figures reported</span>
                  ) : (
                    <>
                      <span>{formatCustomers(u.customers)} customers</span>
                      <span>
                        {u.centsPerKwh === null
                          ? "—"
                          : `$${(u.centsPerKwh / 100).toFixed(3)} per kWh`}
                      </span>
                      <span>
                        {u.kwhPerMonth === null
                          ? "—"
                          : `${Math.round(u.kwhPerMonth).toLocaleString("en-US")} kWh/month`}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {utilities.data?.year && (
            <p className="utility-note">
              Residential figures from {utilities.data.year}.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
