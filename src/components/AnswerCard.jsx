import { useState } from "react";
import { Target, ListChecks, ListFilter } from "lucide-react";

const fmt = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : x.toFixed(d));
const norm = (str) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function AnswerCard({ solution, incognita }) {
  const [showAll, setShowAll] = useState(false);
  const s = solution;
  if (!s || s.error) return null;

  const hotName = s.hot?.nombre || "el fluido caliente";
  const coldName = s.cold?.nombre || "el fluido frío";
  const q = norm(incognita);

  // ¿el enunciado menciona explícitamente uno de los dos fluidos por nombre
  // (o "caliente"/"frío"/"enfriamiento")? Si menciona SOLO uno, filtramos las
  // líneas específicas de fluido (gasto másico, temperatura de salida) a ese
  // lado; si menciona ambos o ninguno, se muestran los dos por seguridad.
  const hotWords = norm(hotName).split(/\s+/).filter((w) => w.length > 3);
  const coldWords = norm(coldName).split(/\s+/).filter((w) => w.length > 3);
  const mentionsHot = q.includes("caliente") || hotWords.some((w) => q.includes(w));
  const mentionsCold = q.includes("frio") || q.includes("fria") || q.includes("enfriamiento") || coldWords.some((w) => q.includes(w));
  const onlyHot = mentionsHot && !mentionsCold;
  const onlyCold = mentionsCold && !mentionsHot;
  const phaseChangeSide = s.hot?.cambio_fase ? "hot" : s.cold?.cambio_fase ? "cold" : null;

  const hasFlowKw = q.includes("gasto") || q.includes("flujo masico") || q.includes("caudal");
  const hasPhaseChangeKw = q.includes("condensac") || q.includes("evapora") || q.includes("vaporiza");
  const hasTempSalidaKw = q.includes("temperatura") && q.includes("salida");
  const hasUKw = q.includes("coeficiente");
  const hasQKw =
    q.includes("razon de la transferencia de calor") ||
    q.includes("razon de transferencia de calor") ||
    q.includes("carga de transferencia de calor") ||
    q.includes("cantidad de calor") ||
    q.includes("calor transferido") ||
    q.includes("flujo de calor") ||
    q.includes("razon del calor");
  const hasDtmlKw = q.includes("media logaritmica") || q.includes("lmtd") || q.includes("tml");
  const hasAsKw = q.includes("area") || q.includes("superficie");
  const hasLKw = q.includes("longitud");
  const hasNtuKw = q.includes("ntu");
  const hasEpsKw = q.includes("efectividad");
  const hasNumTubosKw = q.includes("tubos") && (q.includes("cuantos") || q.includes("numero"));
  const hasPerdidaMedidaKw = q.includes("perdida") || q.includes("adiabatico") || q.includes("adiabat");
  const hasEficienciaKw = q.includes("eficiencia");

  // Cada item: condición de coincidencia + el texto ya formateado.
  const candidates = [
    {
      match: s.hot?.flujo_masico_kg_s != null && ((hasFlowKw && !onlyCold) || (phaseChangeSide === "hot" && hasPhaseChangeKw)),
      text: `Gasto másico / razón de condensación-evaporación de ${hotName}: ${fmt(s.hot?.flujo_masico_kg_s, 4)} kg/s`,
    },
    {
      match: s.cold?.flujo_masico_kg_s != null && ((hasFlowKw && !onlyHot) || (phaseChangeSide === "cold" && hasPhaseChangeKw)),
      text: `Gasto másico de ${coldName}: ${fmt(s.cold?.flujo_masico_kg_s, 4)} kg/s`,
    },
    { match: s.Q != null && hasQKw, text: `Razón de transferencia de calor, Q: ${fmt(s.Q / 1000, 2)} kW` },
    {
      match:
        s.Q_liberado != null &&
        Math.abs(s.Q_liberado - s.Q) / Math.max(Math.abs(s.Q), 1) > 0.005 &&
        (hasQKw || q.includes("perdida")),
      text: `Calor liberado por ${hotName} (antes de pérdidas): ${fmt(s.Q_liberado / 1000, 2)} kW`,
    },
    { match: s.dTml != null && hasDtmlKw, text: `ΔT media logarítmica: ${fmt(s.dTml, 2)} °C` },
    { match: s.As != null && hasAsKw, text: `Área superficial requerida, As: ${fmt(s.As, 3)} m²` },
    {
      match: s.L != null && hasLKw,
      text: `Longitud total requerida, L: ${fmt(s.L, 2)} m${s.Lporpaso != null ? ` (${fmt(s.Lporpaso, 2)} m por paso)` : ""}`,
    },
    { match: s.NTU != null && hasNtuKw, text: `NTU: ${fmt(s.NTU, 3)}` },
    { match: s.eps != null && hasEpsKw, text: `Efectividad, ε: ${fmt(s.eps * 100, 1)} %` },
    { match: s.U != null && hasUKw, text: `Coeficiente de transferencia de calor total, U: ${fmt(s.U, 1)} W/m²·°C` },
    {
      match: s.Th_out != null && hasTempSalidaKw && !onlyCold,
      text: `Temperatura de salida de ${hotName}: ${fmt(s.Th_out, 1)} °C`,
    },
    {
      match: s.Tc_out != null && hasTempSalidaKw && !onlyHot,
      text: `Temperatura de salida de ${coldName}: ${fmt(s.Tc_out, 1)} °C`,
    },
    {
      match: s.numeroTubosRequerido != null && hasNumTubosKw,
      text: `Número de tubos necesario (según la velocidad máxima dada): ${s.numeroTubosRequerido}`,
    },
    {
      match: s.fraccionPerdidaMedida != null && hasPerdidaMedidaKw,
      text: `Fracción de pérdida de calor (medida, comparando ambos balances): ${fmt(s.fraccionPerdidaMedida * 100, 1)} %`,
    },
    {
      match: s.eficienciaTransferenciaMedida != null && (hasEficienciaKw || hasPerdidaMedidaKw),
      text: `Eficiencia de la transferencia de calor (medida): ${fmt(s.eficienciaTransferenciaMedida * 100, 1)} %`,
    },
  ];

  const filtered = candidates.filter((c) => c.match).map((c) => c.text);
  // Lista completa real (sin filtrar por palabras clave) — sirve tanto de
  // fallback cuando no se identifica nada, como para el botón "ver todo".
  const fullList = [];
  if (s.hot?.flujo_masico_kg_s != null) fullList.push(`Gasto másico / razón de condensación-evaporación de ${hotName}: ${fmt(s.hot.flujo_masico_kg_s, 4)} kg/s`);
  if (s.cold?.flujo_masico_kg_s != null) fullList.push(`Gasto másico de ${coldName}: ${fmt(s.cold.flujo_masico_kg_s, 4)} kg/s`);
  if (s.Q != null) fullList.push(`Razón de transferencia de calor, Q: ${fmt(s.Q / 1000, 2)} kW`);
  if (s.Q_liberado != null && Math.abs(s.Q_liberado - s.Q) / Math.max(Math.abs(s.Q), 1) > 0.005)
    fullList.push(`Calor liberado por ${hotName} (antes de pérdidas): ${fmt(s.Q_liberado / 1000, 2)} kW`);
  if (s.dTml != null) fullList.push(`ΔT media logarítmica: ${fmt(s.dTml, 2)} °C`);
  if (s.As != null) fullList.push(`Área superficial requerida, As: ${fmt(s.As, 3)} m²`);
  if (s.L != null) fullList.push(`Longitud total requerida, L: ${fmt(s.L, 2)} m${s.Lporpaso != null ? ` (${fmt(s.Lporpaso, 2)} m por paso)` : ""}`);
  if (s.NTU != null) fullList.push(`NTU: ${fmt(s.NTU, 3)}`);
  if (s.eps != null) fullList.push(`Efectividad, ε: ${fmt(s.eps * 100, 1)} %`);
  if (s.U != null) fullList.push(`Coeficiente de transferencia de calor total, U: ${fmt(s.U, 1)} W/m²·°C`);
  if (s.Th_out != null) fullList.push(`Temperatura de salida de ${hotName}: ${fmt(s.Th_out, 1)} °C`);
  if (s.Tc_out != null) fullList.push(`Temperatura de salida de ${coldName}: ${fmt(s.Tc_out, 1)} °C`);
  if (s.numeroTubosRequerido != null) fullList.push(`Número de tubos necesario (según la velocidad máxima dada): ${s.numeroTubosRequerido}`);
  if (s.fraccionPerdidaMedida != null) fullList.push(`Fracción de pérdida de calor (medida, comparando ambos balances): ${fmt(s.fraccionPerdidaMedida * 100, 1)} %`);
  if (s.eficienciaTransferenciaMedida != null) fullList.push(`Eficiencia de la transferencia de calor (medida): ${fmt(s.eficienciaTransferenciaMedida * 100, 1)} %`);

  const noMatch = filtered.length === 0;
  const lines = showAll || noMatch ? fullList : filtered;

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
      {noMatch && (
        <p style={{ fontSize: 11.5, color: "var(--ink-dim)", margin: "0 0 12px", lineHeight: 1.5, display: "flex", gap: 5 }}>
          <ListFilter size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          No identifiqué con certeza cuál de estos resultados es el que pide el enunciado, así que te muestro todo lo calculado.
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
      {!noMatch && fullList.length > filtered.length && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="hxs-btn hxs-btn-ghost hxs-btn-sm"
          style={{ marginTop: 13 }}
        >
          <ListChecks size={13} />
          {showAll ? "Mostrar solo lo que se pedía" : "Ver todos los resultados calculados"}
        </button>
      )}
    </div>
  );
}
