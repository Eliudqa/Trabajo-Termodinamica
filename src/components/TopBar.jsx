import BrandMark from "./BrandMark.jsx";

const fmt = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : x.toFixed(d));

// Escoge un puñado de resultados clave para el "ticker" — no todo, solo lo
// que da una idea de la respuesta de un vistazo (el detalle completo ya
// vive en el panel de resultados).
function pickTickerStats(solution) {
  if (!solution || solution.error) return [];
  const items = [];
  if (solution.Q != null) items.push(["Q", `${fmt(solution.Q / 1000, 1)} kW`]);
  if (solution.U != null) items.push(["U", `${fmt(solution.U, 0)} W/m²·°C`]);
  if (solution.As != null) items.push(["As", `${fmt(solution.As, 2)} m²`]);
  else if (solution.L != null) items.push(["L", `${fmt(solution.L, 1)} m`]);
  if (solution.eps != null) items.push(["ε", `${fmt(solution.eps * 100, 0)}%`]);
  if (solution.numeroTubosRequerido != null) items.push(["tubos", `${solution.numeroTubosRequerido}`]);
  return items.slice(0, 4);
}

export default function TopBar({ onNavigate, problemText, editedData, solution }) {
  const hasData = !!editedData;
  const hasError = !!solution?.error;
  const solved = !!solution && !hasError;

  const steps = [
    {
      id: "sec-enunciado",
      label: "Enunciado",
      state: hasData ? "done" : problemText?.trim() ? "active" : "pending",
    },
    {
      id: "sec-datos",
      label: "Datos",
      state: !hasData ? "pending" : hasError ? "warn" : solved ? "done" : "active",
    },
    {
      id: "sec-solucion",
      label: "Solución",
      state: !hasData ? "pending" : hasError ? "warn" : solved ? "done" : "active",
    },
    {
      id: "sec-simulacion",
      label: "Simulación",
      state: !solved ? "pending" : "active",
    },
  ];

  const ticker = pickTickerStats(solution);

  return (
    <div className="hxs-topbar">
      <div className="hxs-topbar-brand">
        <BrandMark size={22} />
      </div>
      <nav className="hxs-steps" aria-label="Progreso del ejercicio">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            className="hxs-step"
            data-state={s.state}
            disabled={s.state === "pending"}
            onClick={() => onNavigate(s.id)}
          >
            <span className="hxs-step-dot" />
            {s.label}
          </button>
        ))}
      </nav>
      {ticker.length > 0 && (
        <div className="hxs-ticker">
          {ticker.map(([label, value]) => (
            <span key={label}>
              {label} <b>{value}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
