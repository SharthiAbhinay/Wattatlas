import PropTypes from "prop-types";
import { Link, NavLink } from "react-router-dom";
import "./NavBar.css";

// Add a page to the menu by adding it here.
const LINKS = [
  { to: "/", label: "Map", end: true },
  { to: "/comparisons", label: "My comparisons" },
];

function NavBar({ user, onLogOut }) {
  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <svg className="navbar-logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" />
          <path d="M18.5 4 8 18h7l-1.5 10L24 14h-7z" />
        </svg>
        WattAtlas
      </Link>
      <nav className="navbar-nav" aria-label="Main">
        <ul>
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="navbar-account">
        {user ? (
          <>
            <span className="navbar-user">{user.username}</span>
            <button
              type="button"
              className="button button-quiet"
              onClick={onLogOut}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <Link to="/signup" className="button button-primary">
              Create account
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

NavBar.propTypes = {
  user: PropTypes.shape({
    username: PropTypes.string.isRequired,
  }),
  onLogOut: PropTypes.func.isRequired,
};

export default NavBar;
