import { useEffect, useState } from "react";
import { apiClient, extractErrorMessage } from "../api/client.js";
import DomainScoreRow from "../components/DomainScoreRow.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/competency/profile")
      .then(({ data }) => setProfile(data))
      .catch((err) => setError(extractErrorMessage(err, "Could not load your competency profile.")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-intro">
        <h1>Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p>
          Your competency profile updates automatically after every assessment you take — this is where you can see
          where you stand today.
        </p>
      </div>

      {loading && <p className="loading-text">Loading your profile…</p>}
      {error && <div className="form-error">{error}</div>}

      {profile && (
        <>
          <div className="panel">
            <div className="stat-row">
              <div className="stat">
                <div className="stat__value">{Math.round(profile.overall_readiness)}</div>
                <div className="stat__label">Overall readiness (out of 100)</div>
              </div>
              <div className="stat">
                <div className="stat__value">{profile.domain_scores.length}</div>
                <div className="stat__label">Competency domains tracked</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Competency by domain</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.86rem", marginBottom: 18 }}>
              The red tick marks the proficiency level your role requires. The filled bar is where you are today.
            </p>
            <div className="domain-list">
              {profile.domain_scores.map((d) => (
                <DomainScoreRow key={d.domain_id} domain={d} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
