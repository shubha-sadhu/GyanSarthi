function trendClass(trend) {
  if (trend > 0.5) return "trend-up";
  if (trend < -0.5) return "trend-down";
  return "trend-flat";
}

function trendLabel(trend) {
  if (trend > 0.5) return "↑ improving";
  if (trend < -0.5) return "↓ slipping";
  return "— steady";
}

export default function DomainScoreRow({ domain }) {
  const fillPct = Math.max(0, Math.min(100, domain.current_score));
  const targetPct = Math.max(0, Math.min(100, domain.target_level * 20));

  return (
    <div className="domain-row">
      <div className="domain-row__name">{domain.domain_name}</div>

      <div className="domain-row__track" title={`Score ${domain.current_score} / target ${domain.target_level * 20}`}>
        <div className="domain-row__fill" style={{ width: `${fillPct}%` }} />
        <div className="domain-row__target-tick" style={{ left: `${targetPct}%` }} />
      </div>

      <div className="domain-row__meta">
        <span className="level-badge">{domain.current_level}</span>
        <span>of {domain.target_level}</span>
        <span className={trendClass(domain.trend_per_attempt)}>{trendLabel(domain.trend_per_attempt)}</span>
      </div>
    </div>
  );
}
