import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiClient } from "../api/client.js";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [roles, setRoles] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get("/framework")
      .then(({ data }) => {
        setRoles(data.roles || []);
        if (data.roles?.length) setRoleId(data.roles[0].role_id);
      })
      .catch(() => setError("Could not load roles. Is the backend running?"));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await register({ name, email, password, roleId, adminCode });
    setSubmitting(false);
    if (result.ok) {
      navigate("/dashboard");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__mark">Gyan Sarthi</div>
        <div className="auth-card__tagline">Create your account to start tracking competency.</div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="name">
              Full name
            </label>
            <input id="name" className="field__input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="email">
              Email
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div className="field__hint">At least 8 characters.</div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="role">
              Role / designation
            </label>
            <select id="role" className="field__select" required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.role_id} value={r.role_id}>
                  {r.title}
                </option>
              ))}
            </select>
            <div className="field__hint">Your role sets the competency targets you're measured against.</div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="adminCode">
              Admin code (optional)
            </label>
            <input
              id="adminCode"
              className="field__input"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              autoComplete="off"
            />
            <div className="field__hint">Only fill this in if you were given a code to register as an admin.</div>
          </div>

          <button className="btn btn--primary" type="submit" disabled={submitting || !roleId} style={{ width: "100%" }}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-card__switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
