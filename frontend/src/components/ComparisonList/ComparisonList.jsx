import { useState } from "react";
import { useLocation } from "react-router-dom";
import { deleteComparison, deleteUtilityComparison } from "../../lib/api.js";
import { useApiData } from "../../lib/useApiData.js";
import ComparisonSection from "../ComparisonSection/ComparisonSection.jsx";
import "./ComparisonList.css";

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
