import { useState } from "react";
import "./Household.css";

export default function Household() {
  // TODO: load from API (e.g. GET /api/bills) instead of local state
  const [bills, setBills] = useState([]);
  const [form, setForm] = useState({ month: "", kwh: "", cost: "" });

  const totalKwh = bills.reduce((sum, b) => sum + Number(b.kwh), 0);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: POST to API, then refresh list
    setBills([...bills, form]);
    setForm({ month: "", kwh: "", cost: "" });
  }

  return (
    <main>
      <section>
        <h2>Your household usage</h2>
        <p>Total logged: {totalKwh} kWh</p>
        {/* TODO: chart of kWh per month */}
      </section>

      <section>
        <h2>Log a monthly bill</h2>
        <form onSubmit={handleSubmit}>
          <input name="month" type="month" value={form.month} onChange={handleChange} required />
          <input name="kwh" type="number" placeholder="kWh" value={form.kwh} onChange={handleChange} required />
          <input name="cost" type="number" step="0.01" placeholder="Cost ($)" value={form.cost} onChange={handleChange} required />
          <button type="submit">Add bill</button>
        </form>

        <ul>
          {bills.map((b, i) => (
            <li key={i}>
              {b.month}: {b.kwh} kWh, ${b.cost}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
