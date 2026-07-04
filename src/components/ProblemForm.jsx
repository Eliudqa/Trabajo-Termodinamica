import { Loader2, Wand2, AlertCircle, KeyRound } from "lucide-react";

export default function ProblemForm({ problemText, onChangeText, onSolve, status, errorMsg, hasApiKey }) {
  return (
    <div className="hxs-card">
      <div className="hxs-eyebrow" style={{ marginBottom: 12 }}>Paso 1 · Enunciado</div>

      <textarea
        className="hxs-textarea"
        placeholder="Pega aquí el enunciado completo del ejercicio…"
        value={problemText}
        onChange={(e) => onChangeText(e.target.value)}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 13, flexWrap: "wrap" }}>
        <button
          className="hxs-btn hxs-btn-primary"
          onClick={onSolve}
          disabled={!hasApiKey || !problemText.trim() || status === "loading"}
        >
          {status === "loading" ? <Loader2 size={16} className="hxs-spin" /> : <Wand2 size={16} />}
          {status === "loading" ? "Resolviendo…" : "Resolver con Gemini"}
        </button>

        {!hasApiKey && (
          <span className="hxs-envnotice">
            <KeyRound size={13} />
            Falta <code>VITE_GEMINI_API_KEY</code> en tu <code>.env.local</code> (ver README).
          </span>
        )}
      </div>

      {status === "error" && (
        <div className="hxs-alert hxs-alert-error" style={{ marginTop: 13 }}>
          <AlertCircle size={14} />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
