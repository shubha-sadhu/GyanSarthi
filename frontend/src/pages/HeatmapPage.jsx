import { useEffect, useState } from "react";
import { apiClient, extractErrorMessage } from "../api/client.js";

export default function HeatmapPage() {
  const [heatmap, setHeatmap] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get("/competency/heatmap")
      .then(({ data }) => setHeatmap(data.heatmap))
      .catch((err) => setError(extractErrorMessage(err, "Could not load the heat-map.")));
  }, []);

  return (
    <div>
      <div className="page-intro">
        <h1>Organisation heat-map</h1>
        <p>Average competency score across every registered learner, weakest domain first — where training should focus next.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      {heatmap && (
        <div className="panel">
          {heatmap.map((row) => (
            <div className="heatmap-row" key={row.domain_id}>
              <div>{row.domain_name}</div>
              <div className="heatmap-row__track">
                <div className="heatmap-row__fill" style={{ width: `${Math.min(100, row.avg_score)}%` }} />
              </div>
              <div>
                {row.avg_score} <span style={{ color: "var(--ink-faint)" }}>({row.num_users} learners)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
