export default function StatCard({ icon, label, value, unit, caption }) {
  return (
    <div className="hxs-stat">
      <div className="hxs-stat-label">
        {icon}
        {label}
      </div>
      <div className="hxs-stat-value">
        {value}
        {unit && <span className="hxs-stat-unit">{unit}</span>}
      </div>
      {caption && <div style={{ fontSize: 10.5, color: "var(--ink-dim)", marginTop: 3 }}>{caption}</div>}
    </div>
  );
}
