import PropTypes from "prop-types";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { deleteComparison, deleteUtilityComparison } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { useApiData } from "../../lib/useApiData.js";
import "./ComparisonList.css";

const NOTES_PREVIEW = 160;

// One saved-comparisons section: a header with a "New comparison" button, then
// the saved items (or an empty state). Compare States and Compare Utility
// Companies both use it, so they always look the same.
function ComparisonSection({
  id,
  title,
  path,
  newPath,
  openPath,
  chipsLabel,
  chips,
  emptyText,
  remove,
  onMessage,
  onError,
}) {
  const { data, error, loading, reload } = useApiData(path);
  const [deletingId, setDeletingId] = useState(null);
  const items = data?.items ?? [];

  async function handleDelete(comparison) {
    if (!window.confirm(`Delete “${comparison.name}”? This can't be undone.`))
      return;
    setDeletingId(comparison.id);
    onError(null);
    try {
      await remove(comparison.id);
      onMessage(`Deleted “${comparison.name}”.`);
      reload();
    } catch (err) {
      onError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="comparison-list" aria-labelledby={`${id}-title`}>
      <header className="comparison-list-header">
        <h2 id={`${id}-title`}>{title}</h2>
        <Link className="button button-primary" to={newPath}>
          New comparison
        </Link>
      </header>

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
          <h3>Nothing saved yet</h3>
          <p>{emptyText}</p>
          <Link className="button button-primary" to={newPath}>
            Start a comparison
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <ul className="comparison-items">
          {items.map((comparison) => (
            <li key={comparison.id} className="comparison-item">
              <div className="comparison-item-main">
                <h3>
                  <Link to={`${openPath}/${comparison.id}`}>
                    {comparison.name}
                  </Link>
                </h3>
                <ul className="state-chips" aria-label={chipsLabel}>
                  {chips(comparison).map((label) => (
                    <li key={label} className="state-chip">
                      {label}
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
                <Link className="button" to={`${openPath}/${comparison.id}`}>
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

ComparisonSection.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  newPath: PropTypes.string.isRequired,
  openPath: PropTypes.string.isRequired,
  chipsLabel: PropTypes.string.isRequired,
  chips: PropTypes.func.isRequired,
  emptyText: PropTypes.string.isRequired,
  remove: PropTypes.func.isRequired,
  onMessage: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};

function ComparisonList() {
  const location = useLocation();
  const stateList = useApiData("/api/states");
  const [actionError, setActionError] = useState(null);
  const [message, setMessage] = useState(location.state?.message ?? null);

  const stateNames = new Map(
    (stateList.data?.states ?? []).map((s) => [s.abbr, s.name])
  );

  return (
    <div className="comparison-page">
      <h1>My comparisons</h1>
      <p className="comparison-list-message" role="status">
        {message}
      </p>
      {actionError && <p role="alert">{actionError}</p>}

      <ComparisonSection
        id="state-comparisons"
        title="Compare States"
        path="/api/comparisons"
        newPath="/comparisons/new"
        openPath="/comparisons"
        chipsLabel="States"
        chips={(c) => c.states.map((abbr) => stateNames.get(abbr) ?? abbr)}
        emptyText="Put up to four states side by side, with your own notes, and come back to them while you decide."
        remove={deleteComparison}
        onMessage={setMessage}
        onError={setActionError}
      />

      <ComparisonSection
        id="utility-comparisons"
        title="Compare Utility Companies"
        path="/api/utility-comparisons"
        newPath="/utility-comparisons/new"
        openPath="/utility-comparisons"
        chipsLabel="Utility companies"
        chips={(c) =>
          c.utilities.map((u) => u.name ?? `Utility ${u.utilityId}`)
        }
        emptyText="Put up to four electric utility companies side by side, with your own notes, and come back to them while you decide."
        remove={deleteUtilityComparison}
        onMessage={setMessage}
        onError={setActionError}
      />
    </div>
  );
}

ComparisonList.propTypes = {};

export default ComparisonList;
