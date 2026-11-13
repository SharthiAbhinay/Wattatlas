import { useEffect, useState } from "react";
import { addBill, getBills, updateBill } from "../../lib/api.js";
import "./Household.css";

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
  const [currentBill, setCurrentBill] = useState(null);
  const [currentMonth, setCurrentMonth] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kwh: "", cost: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ kwh: "", cost: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getBills(controller.signal)
      .then((data) => {
        setBills(data.items);
        setCurrentBill(data.current);
        setCurrentMonth(data.currentMonth);
        setLoaded(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, []);

  const pastBills = bills.filter((b) => b.id !== currentBill?.id);
  const totalKwh = bills.reduce((sum, b) => sum + Number(b.kwh), 0);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const { bill } = await addBill(form);
      setBills([bill, ...bills].slice(0, 5));
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

  return (
    <main className="household">
      <section>
        <h2>Your Household</h2>
      </section>
      <section>
        <h2>Power Usage</h2>
        <div className="household-card">
          <p>Total logged: {totalKwh} kWh</p>
          {/* TODO: chart of kWh per month */}
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
        <h2>Household Bills</h2>
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
    </main>
  );
}
