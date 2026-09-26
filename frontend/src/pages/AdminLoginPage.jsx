import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminLoginPage() {
  const { loginAsAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    // This hits a dedicated /auth/admin/login endpoint that checks isAdmin
    // server-side — a non-admin account never gets a token back from it,
    // even with the correct password.
    const result = await loginAsAdmin(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    navigate("/dashboard");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="chip" style={{ marginBottom: 10 }}>
          Admin portal
        </div>
        <div className="auth-card__mark">Gyan Sarthi</div>
        <div className="auth-card__tagline">Sign in with an admin account to manage content and view organisation data.</div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="email">
              Admin email
            </label>
            <input
              id="email"
              className="field__input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="field__input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn--stamp" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Signing in…" : "Sign in as admin"}
          </button>
        </form>

        <div className="auth-card__switch">
          Not an admin? <Link to="/login">Sign in here</Link>
        </div>
      </div>
    </div>
  );
}
