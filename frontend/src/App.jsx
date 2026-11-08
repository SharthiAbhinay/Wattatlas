import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import AuthForm from "./components/AuthForm/AuthForm.jsx";
import ComparisonEditor from "./components/ComparisonEditor/ComparisonEditor.jsx";
import ComparisonList from "./components/ComparisonList/ComparisonList.jsx";
import NavBar from "./components/NavBar/NavBar.jsx";
import StateDetail from "./components/StateDetail/StateDetail.jsx";
import UsageMap from "./components/UsageMap/UsageMap.jsx";
import { getCurrentUser, logOut } from "./lib/api.js";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // The open state lives in the URL (?state=AZ), so it can be bookmarked
  // and the browser's Back button zooms back out.
  const stateParam = (params.get("state") ?? "").toUpperCase();
  const selectedAbbr = /^[A-Z]{2}$/.test(stateParam) ? stateParam : null;

  useEffect(() => {
    getCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  function selectState(abbr) {
    setParams(abbr ? { state: abbr } : {});
  }

  async function handleLogOut() {
    await logOut().catch(() => null);
    setUser(null);
    navigate("/");
  }

  // Pages that need an account send visitors to log in, then bring them back.
  function protect(element) {
    if (!authChecked) {
      return (
        <p className="page-status" role="status">
          Checking whether you&rsquo;re logged in…
        </p>
      );
    }
    return user ? (
      element
    ) : (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }

  function authPage(mode) {
    if (authChecked && user) return <Navigate to="/" replace />;
    return <AuthForm key={mode} mode={mode} onAuth={setUser} />;
  }

  const mapPage = (
    <div className="explore">
      <UsageMap selectedAbbr={selectedAbbr} onSelectState={selectState} />
      <aside className="explore-panel" aria-label="State details">
        {selectedAbbr ? (
          <StateDetail
            key={selectedAbbr}
            abbr={selectedAbbr}
            onClose={() => selectState(null)}
          />
        ) : (
          <section>
            <h2>Pick a state</h2>
            <p>
              Click a state on the map, or choose one from the list above it, to
              zoom into its counties and cities. You&rsquo;ll see what drives
              its electricity use, how that has changed over the years and where
              it&rsquo;s heading.
            </p>
          </section>
        )}
      </aside>
    </div>
  );

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <NavBar user={user} onLogOut={handleLogOut} />
      <main id="main" className="app-main">
        <Routes>
          <Route path="/" element={mapPage} />
          <Route path="/login" element={authPage("login")} />
          <Route path="/signup" element={authPage("register")} />
          <Route path="/comparisons" element={protect(<ComparisonList />)} />
          <Route
            path="/comparisons/new"
            element={protect(<ComparisonEditor />)}
          />
          <Route
            path="/comparisons/:id"
            element={protect(<ComparisonEditor />)}
          />
          <Route
            path="*"
            element={
              <section className="page-status">
                <h1>There&rsquo;s no page here</h1>
                <p>
                  The link may be old or mistyped.{" "}
                  <Link to="/">Go to the map</Link>.
                </p>
              </section>
            }
          />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>
          State figures come from the U.S. Energy Information
          Administration&rsquo;s monthly retail sales data. City and county
          figures are model estimates from the National Renewable Energy
          Laboratory&rsquo;s City and County Energy Profiles. Per-person figures
          use 2020 Census population.
        </p>
      </footer>
    </div>
  );
}

App.propTypes = {};

export default App;
