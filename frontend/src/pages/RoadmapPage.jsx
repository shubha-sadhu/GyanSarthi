import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, extractErrorMessage } from "../api/client.js";

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/competency/roadmap")
      .then(({ data }) => setRoadmap(data))
      .catch((err) => setError(extractErrorMessage(err, "Could not load your roadmap.")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-intro">
        <h1>Your learning roadmap</h1>
        <p>
          Ranked by the size of the gap between where you are and where your role needs you to be — biggest gap
          first.
        </p>
      </div>

      {loading && <p className="loading-text">Loading…</p>}
      {error && <div className="form-error">{error}</div>}

      {roadmap && roadmap.items.length === 0 && (
        <div className="panel">
          <p className="empty-text">
            No gaps to close right now — every tracked domain is at or above your role's target level. Take an
            assessment to keep your profile current.
          </p>
        </div>
      )}

      {roadmap && roadmap.items.length > 0 && (
        <div className="panel">
          {roadmap.items.map((item) => (
            <div className="roadmap-item" key={item.domain_id}>
              <div className="roadmap-item__rank">{item.priority_rank}</div>
              <div className="roadmap-item__body">
                <h3>{item.domain_name}</h3>
                <span className="roadmap-item__gap">{Math.round(item.gap)} points below target</span>
                <p className="roadmap-item__rationale">{item.rationale}</p>

                {item.recommended_materials.length > 0 ? (
                  <div className="roadmap-item__materials">
                    <div className="roadmap-item__materials-label">Study these to close the gap:</div>
                    {item.recommended_materials.map((m) => (
                      <div className="roadmap-item__material" key={m.chunk_id}>
                        <div className="roadmap-item__material-title">{m.title}</div>
                        <p className="roadmap-item__material-snippet">{m.snippet}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="roadmap-item__rationale" style={{ fontStyle: "italic" }}>
                    No study material has been ingested for this domain yet — ask an admin to add some via "Add
                    training content."
                  </p>
                )}

                <Link to="/quiz" className="chip" style={{ display: "inline-block", marginTop: 8, textDecoration: "none" }}>
                  Take an assessment on this domain
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
