import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { deleteComparison } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { useApiData } from "../../lib/useApiData.js";
import "./ComparisonList.css";

const NOTES_PREVIEW = 160;

function ComparisonList() {
  const location = useLocation();
  const { data, error, loading, reload } = useApiData("/api/comparisons");
  const stateList = useApiData("/api/states");
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [message, setMessage] = useState(location.state?.message ?? null);

  const stateNames = new Map(
    (stateList.data?.states ?? []).map((s) => [s.abbr, s.name])
  );
  const items = data?.items ?? [];

  async function handleDelete(comparison) {
    if (!window.confirm(`Delete “${comparison.name}”? This can't be undone.`))
      return;
    setDeletingId(comparison.id);
    setActionError(null);
    try {
      await deleteComparison(comparison.id);
      setMessage(`Deleted “${comparison.name}”.`);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      className="comparison-list"
      aria-labelledby="comparison-list-title"
    >
      <header className="comparison-list-header">
        <h1 id="comparison-list-title">My comparisons</h1>
        <Link className="button button-primary" to="/comparisons/new">
          New comparison
        </Link>
      </header>

      <p className="comparison-list-message" role="status">
        {message}
      </p>
      {actionError && <p role="alert">{actionError}</p>}
      {loading && !data && <p role="status">Loading your comparisons…</p>}
      {error && (
        <div role="alert">
          <p>{error.message}</p>
          <button type="button" className="button" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {data && items.length === 0 && (
        <div className="comparison-list-empty">
          <h2>Nothing saved yet</h2>
          <p>
            Put up to four states side by side, with your own notes, and come
            back to them while you decide.
          </p>
          <Link className="button button-primary" to="/comparisons/new">
            Start a comparison
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <ul className="comparison-items">
          {items.map((comparison) => (
            <li key={comparison.id} className="comparison-item">
              <div className="comparison-item-main">
                <h2>
                  <Link to={`/comparisons/${comparison.id}`}>
                    {comparison.name}
                  </Link>
                </h2>
                <ul className="state-chips" aria-label="States">
                  {comparison.states.map((abbr) => (
                    <li key={abbr} className="state-chip">
                      {stateNames.get(abbr) ?? abbr}
                    </li>
                  ))}
                </ul>
                {comparison.notes && (
                  <p className="comparison-item-notes">
                    {comparison.notes.length > NOTES_PREVIEW
                      ? `${comparison.notes.slice(0, NOTES_PREVIEW).trimEnd()}…`
                      : comparison.notes}
                  </p>
                )}
                <p className="comparison-item-date">
                  Updated {formatDate(comparison.updatedAt)}
                </p>
              </div>
              <div className="comparison-item-actions">
                <Link className="button" to={`/comparisons/${comparison.id}`}>
                  Open and edit
                </Link>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={deletingId === comparison.id}
                  onClick={() => handleDelete(comparison)}
                  aria-label={`Delete ${comparison.name}`}
                >
                  {deletingId === comparison.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

ComparisonList.propTypes = {};

export default ComparisonList;
