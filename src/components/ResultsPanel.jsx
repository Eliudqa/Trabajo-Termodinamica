import {
  AlertCircle, CheckCircle2, Flame, Snowflake, Thermometer, Gauge,
  Square, Ruler, Hash, Percent, Scale, SlidersHorizontal, ShieldAlert,
} from "lucide-react";
import StatCard from "./StatCard.jsx";
import ProfileChart from "./ProfileChart.jsx";
import AnswerCard from "./AnswerCard.jsx";

const fmt = (x, d = 2) => (x == null || !Number.isFinite(x) ? "—" : x.toFixed(d));
const METHOD_LABELS = { LMTD: "LMTD (diferencia media logarítmica)", NTU: "Efectividad – NTU" };
const ic = { size: 12 };

export default function ResultsPanel({ solution, incognita }) {
  if (!solution) return null;

  if (solution.error) {
    return (
      <div className="hxs-card">
        <div className="hxs-section-title">
          <AlertCircle size={16} color="var(--bad)" /> No se pudo resolver del todo
        </div>
        {solution.numeroTubosRequerido != null && (
          <div className="hxs-alert hxs-alert-info">
            Número de tubos necesario (según la velocidad máxima dada): <b>{solution.numeroTubosRequerido}</b> — esta
            parte sí se pudo calcular aunque falten otros datos del intercambiador (ver detalle abajo).
          </div>
        )}
        {(solution.fraccionPerdidaMedida != null || solution.eficienciaTransferenciaMedida != null) && (
          <div className="hxs-alert hxs-alert-info">
            {solution.fraccionPerdidaMedida != null && (
              <>Fracción de pérdida de calor (medida): <b>{fmt(solution.fraccionPerdidaMedida * 100, 1)}%</b>. </>
            )}
            {solution.eficienciaTransferenciaMedida != null && (
              <>Eficiencia de la transferencia (medida): <b>{fmt(solution.eficienciaTransferenciaMedida * 100, 1)}%</b>. </>
            )}
            Esta parte sí se pudo calcular comparando los dos balances de energía, aunque falten otros datos del intercambiador.
          </div>
        )}
        <div className="hxs-alert hxs-alert-error">
          <AlertCircle size={14} />
          {solution.error}
        </div>
        {solution.warnings?.map((w, i) => (
          <div className="hxs-alert hxs-alert-warn" key={i}>
            <AlertCircle size={14} />
            {w}
          </div>
        ))}
        {solution.needsConvection && (
          <div className="hxs-alert hxs-alert-info">
            El motor intenta calcular hᵢ/h₀ automáticamente por correlación de convección (Dittus-Boelter) cuando
            el enunciado da velocidad/caudal en vez de h directo, pero le falta algún dato para completarlo —
            revisa el aviso de arriba, corrígelo en "Datos detectados" (tipo de fluido, cuál va por el tubo,
            diámetro de la coraza, gasto másico) y pulsa <b>Recalcular</b>. Si prefieres, también puedes calcular
            hᵢ/h₀ (o U) tú mismo y escribirlo directamente ahí.
          </div>
        )}
      </div>
    );
  }

  const s = solution;
  const showQLiberado = s.Q_liberado != null && Math.abs(s.Q_liberado - s.Q) / Math.max(Math.abs(s.Q), 1) > 0.005;

  return (
    <>
      <AnswerCard solution={s} incognita={incognita} />
      <div className="hxs-card">
        <div className="hxs-section-title">
          <CheckCircle2 size={16} color="var(--good)" /> Solución
          <span className="hxs-badge" style={{ marginLeft: "auto" }}>{METHOD_LABELS[s.method]}</span>
        </div>

        {s.warnings?.map((w, i) => (
          <div className="hxs-alert hxs-alert-warn" key={i}>
            <AlertCircle size={14} />
            {w}
          </div>
        ))}

        <div className="hxs-stat-grid">
          <StatCard icon={<Flame {...ic} />} label="Calor recibido por el fluido frío, Q" value={fmt(s.Q / 1000, 2)} unit="kW" />
          {showQLiberado && (
            <StatCard
              icon={<Flame {...ic} />}
              label="Calor liberado por el fluido caliente"
              value={fmt(s.Q_liberado / 1000, 2)}
              unit="kW"
              caption="diferencia = pérdida de calor hacia el ambiente"
            />
          )}
          {s.dTml != null && (
            <StatCard
              icon={<Thermometer {...ic} />}
              label={`ΔT media log.${s.F != null && s.F < 0.999 ? " (con F)" : ""}`}
              value={fmt(s.dTml, 2)}
              unit="°C"
            />
          )}
          {s.F != null && s.F < 0.999 && <StatCard icon={<SlidersHorizontal {...ic} />} label="Factor de corrección, F" value={fmt(s.F, 3)} />}
          {s.U != null && <StatCard icon={<Gauge {...ic} />} label="Coeficiente U" value={fmt(s.U, 1)} unit="W/m²·°C" />}
          {s.As != null && <StatCard icon={<Square {...ic} />} label="Área superficial, As" value={fmt(s.As, 3)} unit="m²" />}
          {s.L != null && (
            <StatCard
              icon={<Ruler {...ic} />}
              label="Longitud total, L"
              value={fmt(s.L, 2)}
              unit="m"
              caption={s.Lporpaso != null ? `(${fmt(s.Lporpaso, 2)} m por paso)` : null}
            />
          )}
          {s.NTU != null && <StatCard icon={<Hash {...ic} />} label="NTU" value={fmt(s.NTU, 3)} />}
          {s.eps != null && <StatCard icon={<Percent {...ic} />} label="Efectividad, ε" value={fmt(s.eps * 100, 1)} unit="%" />}
          {s.C != null && <StatCard icon={<Scale {...ic} />} label="C = Cmín/Cmáx" value={fmt(s.C, 3)} />}
          {s.numeroTubosRequerido != null && (
            <StatCard icon={<Hash {...ic} />} label="Número de tubos necesario" value={s.numeroTubosRequerido} caption="para no exceder la velocidad máxima dada" />
          )}
          {s.fraccionPerdidaMedida != null && (
            <StatCard
              icon={<ShieldAlert {...ic} />}
              label="Fracción de pérdida de calor (medida)"
              value={fmt(s.fraccionPerdidaMedida * 100, 1)}
              unit="%"
              caption="comparando el balance de energía de ambos fluidos"
            />
          )}
          {s.eficienciaTransferenciaMedida != null && (
            <StatCard
              icon={<Percent {...ic} />}
              label="Eficiencia de la transferencia (medida)"
              value={fmt(s.eficienciaTransferenciaMedida * 100, 1)}
              unit="%"
            />
          )}
        </div>

        <hr className="hxs-divider" />

        <div className="hxs-row">
          <StatCard
            icon={<Flame size={13} color="var(--copper)" />}
            label={`${s.hot?.nombre || "Caliente"}: entra / sale`}
            value={`${fmt(s.Th_in, 1)}°C → ${fmt(s.Th_out, 1)}°C`}
            caption={s.hot?.flujo_masico_kg_s != null ? `ṁ = ${fmt(s.hot.flujo_masico_kg_s, 4)} kg/s` : null}
          />
          <StatCard
            icon={<Snowflake size={13} color="var(--steel)" />}
            label={`${s.cold?.nombre || "Frío"}: entra / sale`}
            value={`${fmt(s.Tc_in, 1)}°C → ${fmt(s.Tc_out, 1)}°C`}
            caption={s.cold?.flujo_masico_kg_s != null ? `ṁ = ${fmt(s.cold.flujo_masico_kg_s, 4)} kg/s` : null}
          />
        </div>
      </div>
      <ProfileChart solution={s} />
    </>
  );
}
