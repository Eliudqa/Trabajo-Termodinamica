import { Target } from "lucide-react";

const fmt = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : x.toFixed(d));

export default function AnswerCard({ solution, incognita }) {
  const s = solution;
  if (!s || s.error) return null;

  const hotName = s.hot?.nombre || "el fluido caliente";
  const coldName = s.cold?.nombre || "el fluido frío";
  const lines = [];

  if (s.hot?.flujo_masico_kg_s != null) {
    lines.push(`Gasto másico / razón de condensación-evaporación de ${hotName}: ${fmt(s.hot.flujo_masico_kg_s, 4)} kg/s`);
  }
  if (s.cold?.flujo_masico_kg_s != null) {
    lines.push(`Gasto másico de ${coldName}: ${fmt(s.cold.flujo_masico_kg_s, 4)} kg/s`);
  }
  if (s.Q != null) lines.push(`Razón de transferencia de calor, Q: ${fmt(s.Q / 1000, 2)} kW`);
  if (s.Q_liberado != null && Math.abs(s.Q_liberado - s.Q) / Math.max(Math.abs(s.Q), 1) > 0.005) {
    lines.push(`Calor liberado por ${hotName} (antes de pérdidas): ${fmt(s.Q_liberado / 1000, 2)} kW`);
  }
  if (s.dTml != null) lines.push(`ΔT media logarítmica: ${fmt(s.dTml, 2)} °C`);
  if (s.As != null) lines.push(`Área superficial requerida, As: ${fmt(s.As, 3)} m²`);
  if (s.L != null) lines.push(`Longitud total requerida, L: ${fmt(s.L, 2)} m${s.Lporpaso != null ? ` (${fmt(s.Lporpaso, 2)} m por paso)` : ""}`);
  if (s.NTU != null) lines.push(`NTU: ${fmt(s.NTU, 3)}`);
  if (s.eps != null) lines.push(`Efectividad, ε: ${fmt(s.eps * 100, 1)} %`);
  if (s.Th_out != null) lines.push(`Temperatura de salida de ${hotName}: ${fmt(s.Th_out, 1)} °C`);
  if (s.Tc_out != null) lines.push(`Temperatura de salida de ${coldName}: ${fmt(s.Tc_out, 1)} °C`);

  if (!lines.length) return null;

  return (
    <div
      className="hxs-card"
      style={{
        borderColor: "var(--copper-line)",
        background: "linear-gradient(180deg, rgba(221,133,82,0.07), transparent)",
      }}
    >
      <div className="hxs-section-title">
        <Target size={16} color="var(--copper)" /> Respuesta
      </div>
      {incognita && (
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "0 0 13px", lineHeight: 1.5 }}>
          <b style={{ color: "var(--ink)" }}>Se pedía encontrar:</b> {incognita}
        </p>
      )}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
        {lines.map((l, i) => (
          <li key={i} style={{ fontSize: 14.5, lineHeight: 1.45, display: "flex", gap: 9, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: "var(--brass)" }}>›</span>
            <span style={{ fontFamily: "'Inter', sans-serif" }}>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
