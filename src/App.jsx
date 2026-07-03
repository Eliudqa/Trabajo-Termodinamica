import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Key, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Flame, Snowflake, RotateCcw, Settings2, ExternalLink, Info, Trash2, FlaskConical,
} from "lucide-react";
import { solveExchanger, generateProfile, isNum } from "./engine.js";
import { extractWithGemini } from "./extraction.js";
import { SAMPLES } from "./sampleData.js";

const LS_KEY_API = "hxs.geminiApiKey";
const LS_KEY_SESSION = "hxs.lastSession";

/* ============================================================
   ESTILO — tema "plano de ingeniería" (blueprint)
   ============================================================ */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

.hxs-root {
  --bg: #0F2438;
  --bg-card: #15304A;
  --line: rgba(158, 202, 230, 0.16);
  --line-strong: rgba(158, 202, 230, 0.32);
  --ink: #EAF1F7;
  --ink-dim: #93AEC4;
  --hot: #FF7A52;
  --hot-dim: rgba(255, 122, 82, 0.16);
  --cold: #57C7EF;
  --cold-dim: rgba(87, 199, 239, 0.16);
  --amber: #F2B056;
  --good: #5FBE8D;
  --bad: #FF6B6B;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--ink);
  background:
    repeating-linear-gradient(0deg, var(--line) 0px, var(--line) 1px, transparent 1px, transparent 28px),
    repeating-linear-gradient(90deg, var(--line) 0px, var(--line) 1px, transparent 1px, transparent 28px),
    linear-gradient(160deg, var(--bg) 0%, #0B1D2E 100%);
  min-height: 100vh;
  padding: 32px 18px 60px;
}
.hxs-root * { box-sizing: border-box; }
.hxs-shell { max-width: 880px; margin: 0 auto; }
.hxs-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--amber);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.hxs-eyebrow::before { content: ''; width: 16px; height: 1px; background: var(--amber); display: inline-block; }
.hxs-h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: clamp(22px, 4.5vw, 30px);
  line-height: 1.15;
  margin: 0 0 4px;
  letter-spacing: -0.01em;
}
.hxs-sub { color: var(--ink-dim); font-size: 13.5px; line-height: 1.5; margin: 0 0 20px; max-width: 60ch; }
.hxs-card { background: var(--bg-card); border: 1px solid var(--line); border-radius: 10px; padding: 18px; margin-bottom: 16px; }
.hxs-section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  font-size: 15px;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.hxs-textarea {
  width: 100%; min-height: 140px; background: #0C1E30; border: 1px solid var(--line);
  border-radius: 8px; color: var(--ink); font-family: 'Inter', sans-serif; font-size: 14px;
  line-height: 1.55; padding: 12px 14px; resize: vertical; outline: none; transition: border-color .15s;
}
.hxs-textarea:focus { border-color: var(--cold); }
.hxs-textarea::placeholder { color: #4E6B84; }
.hxs-input, .hxs-select {
  display: block; width: 100%; margin-top: 4px; background: #0C1E30; border: 1px solid var(--line); border-radius: 6px;
  color: var(--ink); font-family: 'JetBrains Mono', monospace; font-size: 13px; padding: 7px 9px;
  outline: none; transition: border-color .15s;
}
.hxs-select { font-family: 'Inter', sans-serif; }
.hxs-input:focus, .hxs-select:focus { border-color: var(--cold); }
.hxs-label { display: block; font-size: 11px; color: var(--ink-dim); margin-bottom: 4px; font-family: 'JetBrains Mono', monospace; }
.hxs-field { margin-bottom: 10px; }
.hxs-row { display: flex; gap: 10px; flex-wrap: wrap; }
.hxs-row > * { flex: 1 1 130px; min-width: 0; }
.hxs-btn {
  font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 14px; border-radius: 8px;
  padding: 11px 20px; border: none; cursor: pointer; display: inline-flex; align-items: center;
  gap: 8px; transition: transform .1s, filter .15s;
}
.hxs-btn:active { transform: scale(0.98); }
.hxs-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.hxs-btn-primary { background: linear-gradient(135deg, #FF7A52, #F2B056); color: #1A1006; }
.hxs-btn-primary:not(:disabled):hover { filter: brightness(1.08); }
.hxs-btn-ghost { background: transparent; color: var(--cold); border: 1px solid var(--line-strong); }
.hxs-btn-ghost:not(:disabled):hover { background: var(--cold-dim); }
.hxs-btn-sm { padding: 7px 12px; font-size: 12.5px; }
.hxs-fluid-card { border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
.hxs-fluid-hot { background: var(--hot-dim); border: 1px solid rgba(255,122,82,0.35); }
.hxs-fluid-cold { background: var(--cold-dim); border: 1px solid rgba(87,199,239,0.35); }
.hxs-fluid-title { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 13.5px; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.hxs-checkbox-row { display: flex; align-items: center; gap: 7px; margin: 6px 0 10px; font-size: 12.5px; color: var(--ink-dim); }
.hxs-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.hxs-stat { background: #0C1E30; border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
.hxs-stat-label { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.hxs-stat-value { font-family: 'JetBrains Mono', monospace; font-size: 19px; font-weight: 600; color: var(--ink); }
.hxs-stat-unit { font-size: 11px; color: var(--ink-dim); margin-left: 3px; }
.hxs-badge { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 4px 10px; border-radius: 100px; border: 1px solid var(--line-strong); color: var(--ink-dim); }
.hxs-alert { display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; font-size: 12.5px; line-height: 1.5; margin-bottom: 10px; }
.hxs-alert-warn { background: rgba(242,176,86,0.1); border: 1px solid rgba(242,176,86,0.35); color: #F2C98A; }
.hxs-alert-error { background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.35); color: #FFA3A3; }
.hxs-alert-info { background: rgba(87,199,239,0.08); border: 1px solid rgba(87,199,239,0.28); color: #9FDCF2; }
.hxs-link { color: var(--cold); text-decoration: underline; text-underline-offset: 2px; }
.hxs-collapse-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
.hxs-divider { height: 1px; background: var(--line); margin: 14px 0; border: none; }
.hxs-spin { animation: hxs-spin 1s linear infinite; }
@keyframes hxs-spin { to { transform: rotate(360deg); } }
.hxs-legend-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.hxs-sample-chip {
  font-family: 'JetBrains Mono', monospace; font-size: 11.5px; padding: 6px 11px; border-radius: 100px;
  border: 1px solid var(--line-strong); background: transparent; color: var(--ink-dim); cursor: pointer;
  transition: all .15s;
}
.hxs-sample-chip:hover { border-color: var(--amber); color: var(--amber); }
@media (max-width: 480px) {
  .hxs-root { padding: 20px 12px 40px; }
  .hxs-card { padding: 14px; }
}
`;

const isNumF = (x) => x != null && Number.isFinite(x);
const fmt = (x, d = 2) => (x == null || !Number.isFinite(x) ? "—" : x.toFixed(d));

const TIPO_LABELS = { tubo_doble: "Tubo doble", tubos_coraza: "Coraza y tubos", flujo_cruzado: "Flujo cruzado" };
const FLOW_LABELS = {
  paralelo: "Flujo paralelo", contraflujo: "Contraflujo",
  cruzado_no_mezclado: "Cruzado, no mezclado", cruzado_cmax_mezclado: "Cruzado, Cmáx mezclado",
  cruzado_cmin_mezclado: "Cruzado, Cmín mezclado",
};
const METHOD_LABELS = { LMTD: "LMTD (diferencia media logarítmica)", NTU: "Efectividad – NTU" };

function NumField({ label, value, onChange, step = "any", suffix }) {
  return (
    <div className="hxs-field">
      <label className="hxs-label">
        {label}{suffix ? ` (${suffix})` : ""}
        <input
          className="hxs-input"
          type="number"
          step={step}
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}

function FluidEditor({ title, icon, tone, fluid, onChange }) {
  const set = (k, v) => onChange({ ...fluid, [k]: v });
  return (
    <div className={`hxs-fluid-card ${tone === "hot" ? "hxs-fluid-hot" : "hxs-fluid-cold"}`}>
      <div className="hxs-fluid-title">{icon} {title} — <span style={{ fontWeight: 400, opacity: 0.85 }}>{fluid.nombre || "sin nombre"}</span></div>
      <div className="hxs-checkbox-row">
        <input type="checkbox" checked={!!fluid.cambio_fase} onChange={(e) => set("cambio_fase", e.target.checked)} />
        cambia de fase (condensa / hierve) en el proceso
      </div>
      <div className="hxs-row">
        <NumField label="T entrada" suffix="°C" value={fluid.temp_entrada_C} onChange={(v) => set("temp_entrada_C", v)} />
        <NumField label="T salida" suffix="°C" value={fluid.temp_salida_C} onChange={(v) => set("temp_salida_C", v)} />
      </div>
      {fluid.cambio_fase ? (
        <NumField label="hfg" suffix="kJ/kg" value={fluid.hfg_kJ_kg} onChange={(v) => set("hfg_kJ_kg", v)} />
      ) : (
        <div className="hxs-row">
          <NumField label="Gasto másico" suffix="kg/s" value={fluid.flujo_masico_kg_s} onChange={(v) => set("flujo_masico_kg_s", v)} />
          <NumField label="cp" suffix="kJ/kg·°C" value={fluid.cp_kJ_kgC} onChange={(v) => set("cp_kJ_kgC", v)} />
        </div>
      )}
      {fluid.cp_estimado && !fluid.cambio_fase && (
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: -4 }}>
          <Info size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
          cp estimado por la IA (no venía en el enunciado) — verifícalo contra tu tabla de propiedades.
        </div>
      )}
    </div>
  );
}

function ProfileChart({ solution }) {
  const { Th_in, Th_out, Tc_in, Tc_out, Ch, Cc, Q, isParallel, hot, cold } = solution;
  const data = useMemo(() => {
    if (![Th_in, Th_out, Tc_in, Tc_out, Q].every(isNumF)) return null;
    if (!isNumF(Ch) && Ch !== Infinity) return null;
    if (!isNumF(Cc) && Cc !== Infinity) return null;
    return generateProfile(isParallel, Th_in, Th_out, Tc_in, Tc_out, Ch, Cc, Q);
  }, [Th_in, Th_out, Tc_in, Tc_out, Ch, Cc, Q, isParallel]);

  if (!data) return null;
  const hotName = hot?.nombre || "Fluido caliente";
  const coldName = cold?.nombre || "Fluido frío";

  return (
    <div className="hxs-card">
      <div className="hxs-section-title">
        <span className="hxs-legend-dot" style={{ background: "var(--hot)" }} /> Perfil de temperatura a lo largo del intercambiador
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>
        {isParallel ? "→ flujo paralelo →" : "→ contraflujo ←"}
      </div>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 14, left: -6, bottom: 8 }}>
            <CartesianGrid stroke="rgba(158,202,230,0.12)" />
            <XAxis
              dataKey="x" type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
              tick={{ fill: "#93AEC4", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
              label={{ value: "Posición a lo largo del intercambiador", position: "insideBottom", offset: -4, fill: "#93AEC4", fontSize: 10.5 }}
            />
            <YAxis
              tick={{ fill: "#93AEC4", fontSize: 10.5, fontFamily: "JetBrains Mono" }}
              label={{ value: "T (°C)", angle: -90, position: "insideLeft", fill: "#93AEC4", fontSize: 10.5 }}
            />
            <Tooltip
              contentStyle={{ background: "#0C1E30", border: "1px solid rgba(158,202,230,0.3)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#93AEC4" }}
              formatter={(v, name) => [`${v.toFixed(1)} °C`, name]}
              labelFormatter={(l) => `${l}%`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "var(--ink)" }}>{v}</span>} />
            <Line type="monotone" dataKey="Th" name={hotName} stroke="var(--hot)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="Tc" name={coldName} stroke="var(--cold)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ResultsPanel({ solution }) {
  if (!solution) return null;
  if (solution.error) {
    return (
      <div className="hxs-card">
        <div className="hxs-section-title"><AlertCircle size={16} color="var(--bad)" /> No se pudo resolver del todo</div>
        <div className="hxs-alert hxs-alert-error">{solution.error}</div>
        {solution.needsConvection && (
          <div className="hxs-alert hxs-alert-info">
            Este ejercicio requiere calcular h mediante correlaciones de convección (Reynolds/Nusselt) a partir de
            la velocidad y las propiedades del fluido — esta versión todavía no lo hace de forma automática.
            Calcúlalo aparte y escribe hᵢ y h₀ (o U directamente) en "Datos detectados" arriba, luego pulsa{" "}
            <b>Recalcular</b>.
          </div>
        )}
      </div>
    );
  }

  const s = solution;
  return (
    <>
      <div className="hxs-card">
        <div className="hxs-section-title">
          <CheckCircle2 size={16} color="var(--good)" /> Solución
          <span className="hxs-badge" style={{ marginLeft: "auto" }}>{METHOD_LABELS[s.method]}</span>
        </div>

        {s.warnings?.map((w, i) => (
          <div className="hxs-alert hxs-alert-warn" key={i}><AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{w}</div>
        ))}

        <div className="hxs-stat-grid">
          <div className="hxs-stat">
            <div className="hxs-stat-label">Calor transferido, Q</div>
            <div className="hxs-stat-value">{fmt(s.Q / 1000, 2)}<span className="hxs-stat-unit">kW</span></div>
          </div>
          {s.dTml != null && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">ΔT media log.{s.F != null && s.F < 0.999 ? " (con F)" : ""}</div>
              <div className="hxs-stat-value">{fmt(s.dTml, 2)}<span className="hxs-stat-unit">°C</span></div>
            </div>
          )}
          {s.F != null && s.F < 0.999 && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">Factor de corrección, F</div>
              <div className="hxs-stat-value">{fmt(s.F, 3)}</div>
            </div>
          )}
          {s.U != null && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">Coeficiente U</div>
              <div className="hxs-stat-value">{fmt(s.U, 1)}<span className="hxs-stat-unit">W/m²·°C</span></div>
            </div>
          )}
          {s.As != null && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">Área superficial, As</div>
              <div className="hxs-stat-value">{fmt(s.As, 3)}<span className="hxs-stat-unit">m²</span></div>
            </div>
          )}
          {s.L != null && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">Longitud, L</div>
              <div className="hxs-stat-value">{fmt(s.L, 2)}<span className="hxs-stat-unit">m</span></div>
            </div>
          )}
          {s.NTU != null && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">NTU</div>
              <div className="hxs-stat-value">{fmt(s.NTU, 3)}</div>
            </div>
          )}
          {s.eps != null && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">Efectividad, ε</div>
              <div className="hxs-stat-value">{fmt(s.eps * 100, 1)}<span className="hxs-stat-unit">%</span></div>
            </div>
          )}
          {s.C != null && (
            <div className="hxs-stat">
              <div className="hxs-stat-label">C = Cmín/Cmáx</div>
              <div className="hxs-stat-value">{fmt(s.C, 3)}</div>
            </div>
          )}
        </div>

        <hr className="hxs-divider" />

        <div className="hxs-row">
          <div className="hxs-stat">
            <div className="hxs-stat-label"><Flame size={11} style={{ verticalAlign: -1 }} /> {s.hot?.nombre || "Caliente"}: entra / sale</div>
            <div className="hxs-stat-value" style={{ fontSize: 15 }}>{fmt(s.Th_in, 1)}°C → {fmt(s.Th_out, 1)}°C</div>
            {s.hot?.flujo_masico_kg_s != null && <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 3 }}>ṁ = {fmt(s.hot.flujo_masico_kg_s, 4)} kg/s</div>}
          </div>
          <div className="hxs-stat">
            <div className="hxs-stat-label"><Snowflake size={11} style={{ verticalAlign: -1 }} /> {s.cold?.nombre || "Frío"}: entra / sale</div>
            <div className="hxs-stat-value" style={{ fontSize: 15 }}>{fmt(s.Tc_in, 1)}°C → {fmt(s.Tc_out, 1)}°C</div>
            {s.cold?.flujo_masico_kg_s != null && <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 3 }}>ṁ = {fmt(s.cold.flujo_masico_kg_s, 4)} kg/s</div>}
          </div>
        </div>
      </div>
      <ProfileChart solution={s} />
    </>
  );
}

/* ============================================================
   APP PRINCIPAL
   ============================================================ */
export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKeyPanel, setShowKeyPanel] = useState(true);

  const [problemText, setProblemText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");
  const [editedData, setEditedData] = useState(null);
  const [solution, setSolution] = useState(null);

  // cargar clave guardada (localStorage) + variable de entorno como respaldo
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY_API);
    const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
    const k = saved || envKey || "";
    if (k) {
      setApiKey(k);
      setApiKeyInput(k);
      setShowKeyPanel(false);
    }
    try {
      const s = localStorage.getItem(LS_KEY_SESSION);
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed.problemText) setProblemText(parsed.problemText);
        if (parsed.editedData) {
          setEditedData(parsed.editedData);
          setSolution(solveExchanger(parsed.editedData));
        }
      }
    } catch (e) { /* sesión previa corrupta o inexistente, se ignora */ }
  }, []);

  const saveApiKey = useCallback(() => {
    const k = apiKeyInput.trim();
    setApiKey(k);
    setShowKeyPanel(false);
    localStorage.setItem(LS_KEY_API, k);
  }, [apiKeyInput]);

  const forgetApiKey = useCallback(() => {
    setApiKey(""); setApiKeyInput(""); setShowKeyPanel(true);
    localStorage.removeItem(LS_KEY_API);
  }, []);

  const persistSession = useCallback((text, data) => {
    try { localStorage.setItem(LS_KEY_SESSION, JSON.stringify({ problemText: text, editedData: data })); } catch (e) { /* cuota de storage llena, no crítico */ }
  }, []);

  const handleSolve = useCallback(async () => {
    if (!apiKey || !problemText.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    setSolution(null);
    try {
      const data = await extractWithGemini(apiKey, problemText.trim());
      setEditedData(data);
      const sol = solveExchanger(data);
      setSolution(sol);
      setStatus("idle");
      persistSession(problemText.trim(), data);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Ocurrió un error inesperado.");
    }
  }, [apiKey, problemText, persistSession]);

  const loadSample = useCallback((sample) => {
    setProblemText(sample.texto);
    setEditedData(sample.data);
    setSolution(solveExchanger(sample.data));
    setStatus("idle");
    setErrorMsg("");
    persistSession(sample.texto, sample.data);
  }, [persistSession]);

  const handleRecalculate = useCallback(() => {
    if (!editedData) return;
    const sol = solveExchanger(editedData);
    setSolution(sol);
    persistSession(problemText, editedData);
  }, [editedData, problemText, persistSession]);

  const updateField = (key, value) => setEditedData((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="hxs-root">
      <style>{STYLES}</style>
      <div className="hxs-shell">
        <div className="hxs-eyebrow">Herramienta · Transferencia de calor</div>
        <h1 className="hxs-h1">Resuelve tu ejercicio de intercambiadores</h1>
        <p className="hxs-sub">
          Pega el enunciado, Gemini extrae los datos y este motor aplica LMTD o efectividad-NTU
          —validado contra los ejemplos del libro— sin que tengas que teclear un solo número.
        </p>

        {/* --- Clave de API --- */}
        <div className="hxs-card">
          <div className="hxs-collapse-header" onClick={() => setShowKeyPanel((v) => !v)}>
            <div className="hxs-section-title" style={{ marginBottom: 0 }}>
              <Key size={15} /> Clave de API de Gemini {apiKey && <span className="hxs-badge">guardada</span>}
            </div>
            {showKeyPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {showKeyPanel && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12.5, color: "var(--ink-dim)", lineHeight: 1.5, margin: "0 0 10px" }}>
                Gratis, sin tarjeta. Ve a{" "}
                <a className="hxs-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                  aistudio.google.com/apikey <ExternalLink size={10} style={{ verticalAlign: -1 }} />
                </a>{" "}
                → inicia sesión con tu cuenta de Google → "Create API key" → pégala aquí. Se guarda solo en tu
                navegador (o ponla en <code>.env.local</code> como <code>VITE_GEMINI_API_KEY</code> para no repetirlo nunca).
              </p>
              <div className="hxs-row">
                <input
                  className="hxs-input" type="password" placeholder="AIzaSy…"
                  value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{ flex: "3 1 220px" }}
                />
                <button className="hxs-btn hxs-btn-primary hxs-btn-sm" style={{ flex: "1 1 100px" }} onClick={saveApiKey} disabled={!apiKeyInput.trim()}>
                  Guardar
                </button>
                {apiKey && (
                  <button className="hxs-btn hxs-btn-ghost hxs-btn-sm" style={{ flex: "1 1 100px" }} onClick={forgetApiKey}>
                    <Trash2 size={13} /> Olvidar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- Enunciado --- */}
        <div className="hxs-card">
          <div className="hxs-eyebrow" style={{ marginBottom: 10 }}>Paso 1 · Enunciado</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: 5 }}>
              <FlaskConical size={13} /> Probar sin API:
            </span>
            {SAMPLES.map((s) => (
              <button key={s.id} className="hxs-sample-chip" onClick={() => loadSample(s)}>{s.label}</button>
            ))}
          </div>

          <textarea
            className="hxs-textarea"
            placeholder="Pega aquí el enunciado completo del ejercicio…"
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="hxs-btn hxs-btn-primary"
              onClick={handleSolve}
              disabled={!apiKey || !problemText.trim() || status === "loading"}
            >
              {status === "loading" ? <Loader2 size={16} className="hxs-spin" /> : <Settings2 size={16} />}
              {status === "loading" ? "Resolviendo…" : "Resolver con Gemini"}
            </button>
            {!apiKey && <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>Primero guarda tu clave de API arriba ↑ (o usa un ejemplo de prueba)</span>}
          </div>
          {status === "error" && (
            <div className="hxs-alert hxs-alert-error" style={{ marginTop: 12 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{errorMsg}
            </div>
          )}
        </div>

        {/* --- Datos extraídos (editables) --- */}
        {editedData && (
          <div className="hxs-card">
            <div className="hxs-eyebrow" style={{ marginBottom: 10 }}>Paso 2 · Datos detectados</div>
            <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "0 0 12px", lineHeight: 1.5 }}>
              Revisa lo que se detectó. Si algo está mal, corrígelo y pulsa <b>Recalcular</b> — es instantáneo,
              no vuelve a llamar a la IA.
            </p>

            <div className="hxs-row" style={{ marginBottom: 12 }}>
              <div className="hxs-field" style={{ margin: 0 }}>
                <label className="hxs-label">
                  Tipo de intercambiador
                  <select className="hxs-select" value={editedData.tipo_intercambiador} onChange={(e) => updateField("tipo_intercambiador", e.target.value)}>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
              <div className="hxs-field" style={{ margin: 0 }}>
                <label className="hxs-label">
                  Configuración de flujo
                  <select className="hxs-select" value={editedData.configuracion_flujo} onChange={(e) => updateField("configuracion_flujo", e.target.value)}>
                    {Object.entries(FLOW_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {editedData.tipo_intercambiador === "tubos_coraza" && (
              <div className="hxs-row" style={{ marginBottom: 4 }}>
                <NumField label="Pasos por la coraza" value={editedData.pasos_coraza} onChange={(v) => updateField("pasos_coraza", v)} step="1" />
                <NumField label="Pasos por los tubos" value={editedData.pasos_tubos} onChange={(v) => updateField("pasos_tubos", v)} step="1" />
              </div>
            )}

            <FluidEditor title="Fluido caliente" icon={<Flame size={14} color="var(--hot)" />} tone="hot" fluid={editedData.fluido_caliente} onChange={(f) => updateField("fluido_caliente", f)} />
            <FluidEditor title="Fluido frío" icon={<Snowflake size={14} color="var(--cold)" />} tone="cold" fluid={editedData.fluido_frio} onChange={(f) => updateField("fluido_frio", f)} />

            <div className="hxs-row">
              <NumField label="Coeficiente U" suffix="W/m²·°C" value={editedData.coeficiente_U_W_m2C} onChange={(v) => updateField("coeficiente_U_W_m2C", v)} />
              <NumField label="hᵢ (interior)" suffix="W/m²·°C" value={editedData.hi} onChange={(v) => updateField("hi", v)} />
              <NumField label="h₀ (exterior)" suffix="W/m²·°C" value={editedData.ho} onChange={(v) => updateField("ho", v)} />
            </div>
            <div className="hxs-row">
              <NumField label="Área, As" suffix="m²" value={editedData.area_m2} onChange={(v) => updateField("area_m2", v)} />
              <NumField label="Diámetro interior" suffix="m" value={editedData.diametro_interior} onChange={(v) => updateField("diametro_interior", v)} />
              <NumField label="Longitud" suffix="m" value={editedData.longitud_m} onChange={(v) => updateField("longitud_m", v)} />
            </div>

            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 12, lineHeight: 1.5 }}>
              <b style={{ color: "var(--ink)" }}>Se pide encontrar:</b> {editedData.incognita_principal || "—"}
              {editedData.notas && <div style={{ marginTop: 4 }}><b style={{ color: "var(--ink)" }}>Notas de la extracción:</b> {editedData.notas}</div>}
            </div>

            <button className="hxs-btn hxs-btn-primary" onClick={handleRecalculate}>
              <RotateCcw size={15} /> Recalcular con estos datos
            </button>
          </div>
        )}

        {/* --- Resultados --- */}
        {solution && (
          <>
            <div className="hxs-eyebrow" style={{ margin: "4px 0 10px" }}>Paso 3 · Solución</div>
            <ResultsPanel solution={solution} />
          </>
        )}
      </div>
    </div>
  );
}
