import PropTypes from "prop-types";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logIn, register } from "../../lib/api.js";
import "./AuthForm.css";

const EMPTY = { username: "", password: "", confirm: "" };

function AuthForm({ mode, onAuth }) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (isRegister && values.password !== values.confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { user } = isRegister
        ? await register({
            username: values.username,
            password: values.password,
          })
        : await logIn({ username: values.username, password: values.password });
      onAuth(user);
      navigate(from ? `${from.pathname}${from.search ?? ""}` : "/", {
        replace: true,
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const switchLink = (
    <Link to={isRegister ? "/login" : "/signup"} state={location.state}>
      {isRegister ? "Log in" : "Create an account"}
    </Link>
  );

  return (
    <section className="auth" aria-labelledby="auth-title">
      <h1 id="auth-title">{isRegister ? "Create your account" : "Log in"}</h1>
      <p className="auth-intro">
        {from
          ? "Log in to keep going. Your comparisons are saved to your account."
          : isRegister
            ? "An account saves your state comparisons, homes and bills to you."
            : "Welcome back. Your saved comparisons are waiting."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            name="username"
            autoComplete="username"
            required
            minLength={isRegister ? 3 : undefined}
            maxLength={30}
            value={values.username}
            onChange={handleChange}
            aria-describedby={isRegister ? "auth-username-hint" : undefined}
          />
          {isRegister && (
            <p className="field-hint" id="auth-username-hint">
              3 to 30 letters, numbers, dots, dashes or underscores.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 8 : undefined}
            value={values.password}
            onChange={handleChange}
            aria-describedby={isRegister ? "auth-password-hint" : undefined}
          />
          {isRegister && (
            <p className="field-hint" id="auth-password-hint">
              At least 8 characters.
            </p>
          )}
        </div>

        {isRegister && (
          <div className="field">
            <label htmlFor="auth-confirm">Type the password again</label>
            <input
              id="auth-confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={values.confirm}
              onChange={handleChange}
            />
          </div>
        )}

        <p className="form-error" role="alert">
          {error}
        </p>

        <button
          type="submit"
          className="button button-primary auth-submit"
          disabled={submitting}
        >
          {submitting
            ? isRegister
              ? "Creating account…"
              : "Logging in…"
            : isRegister
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="auth-switch">
        {isRegister ? "Already have an account? " : "New to WattAtlas? "}
        {switchLink}
      </p>
    </section>
  );
}

AuthForm.propTypes = {
  mode: PropTypes.oneOf(["login", "register"]).isRequired,
  onAuth: PropTypes.func.isRequired,
};

export default AuthForm;
