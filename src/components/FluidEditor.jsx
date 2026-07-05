import { Info } from "lucide-react";
import NumField from "./NumField.jsx";
import SelectField from "./SelectField.jsx";

const TIPO_FLUIDO_LABELS = {
  agua: "Agua",
  aire: "Aire",
  aceite_motor: "Aceite de motor",
  etilenglicol: "Etilenglicol",
  refrigerante_134a: "Refrigerante 134a",
  amoniaco: "Amoniaco",
  otro: "Otro / no listado",
};

const hasVal = (v) => v !== null && v !== undefined && v !== "";

export default function FluidEditor({ title, icon, tone, fluid, onChange, needsConvection }) {
  const set = (k, v) => onChange({ ...fluid, [k]: v });

  // "tipo_fluido" y "velocidad_m_s" solo son relevantes cuando el motor
  // necesita calcular h por correlación (o si ya vienen llenos de la
  // extracción) — en el resto de ejercicios son ruido innecesario.
  const showTipoFluido = !!needsConvection || hasVal(fluid.tipo_fluido);
  const showVelocidad = !!needsConvection || hasVal(fluid.velocidad_m_s);
  // La presión solo importa para GASES (su densidad depende de ella) y solo
  // en el mismo contexto donde ya pedimos velocidad (banco de tubos en un
  // ducto, o correlación convectiva) — para líquidos no se muestra nunca.
  const showPresion = fluid.tipo_fluido === "aire" && (showVelocidad || hasVal(fluid.presion_kPa));

  return (
    <div className={`hxs-fluid-card ${tone === "hot" ? "hxs-fluid-hot" : "hxs-fluid-cold"}`}>
      <div className="hxs-fluid-title">
        {icon} {title} — <span style={{ fontWeight: 400, opacity: 0.85 }}>{fluid.nombre || "sin nombre"}</span>
      </div>
      {showTipoFluido && (
        <>
          <SelectField
            label="Tipo de fluido (para tablas de propiedades)"
            value={fluid.tipo_fluido || "otro"}
            onChange={(v) => set("tipo_fluido", v)}
            options={TIPO_FLUIDO_LABELS}
          />
          <div style={{ height: 9 }} />
        </>
      )}
      <div className="hxs-checkbox-row">
        <input type="checkbox" checked={!!fluid.cambio_fase} onChange={(e) => set("cambio_fase", e.target.checked)} />
        cambia de fase (condensa / hierve) en el proceso
      </div>
      <div className="hxs-row">
        <NumField label="T entrada" suffix="°C" value={fluid.temp_entrada_C} onChange={(v) => set("temp_entrada_C", v)} />
        <NumField label="T salida" suffix="°C" value={fluid.temp_salida_C} onChange={(v) => set("temp_salida_C", v)} />
      </div>
      {fluid.cambio_fase ? (
        <>
          <NumField label="hfg" suffix="kJ/kg" value={fluid.hfg_kJ_kg} onChange={(v) => set("hfg_kJ_kg", v)} />
          {fluid.hfg_estimado && (
            <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: -4, display: "flex", gap: 4 }}>
              <Info size={11} style={{ flexShrink: 0, marginTop: 2 }} />
              hfg estimado por la IA a partir de tablas de saturación (no venía en el enunciado) — verifícalo contra tu tabla de propiedades.
            </div>
          )}
        </>
      ) : (
        <div className="hxs-row">
          <NumField label="Gasto másico" suffix="kg/s" value={fluid.flujo_masico_kg_s} onChange={(v) => set("flujo_masico_kg_s", v)} />
          <NumField label="cp" suffix="kJ/kg·°C" value={fluid.cp_kJ_kgC} onChange={(v) => set("cp_kJ_kgC", v)} />
          {showVelocidad && (
            <NumField label="Velocidad (si va por el tubo, o del fluido en el ducto)" suffix="m/s" value={fluid.velocidad_m_s} onChange={(v) => set("velocidad_m_s", v)} />
          )}
        </div>
      )}
      {showPresion && (
        <div className="hxs-row">
          <NumField label="Presión" suffix="kPa" value={fluid.presion_kPa} onChange={(v) => set("presion_kPa", v)} />
        </div>
      )}
      {showPresion && (
        <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-6px 0 9px", lineHeight: 1.5, display: "flex", gap: 4 }}>
          <Info size={11} style={{ flexShrink: 0, marginTop: 2 }} />
          Solo hace falta si no está a la presión atmosférica estándar (~101.3 kPa) — el motor la usa para corregir la densidad del gas.
        </p>
      )}
      {fluid.cp_estimado && !fluid.cambio_fase && (
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: -4, display: "flex", gap: 4 }}>
          <Info size={11} style={{ flexShrink: 0, marginTop: 2 }} />
          cp estimado por la IA (no venía en el enunciado) — verifícalo contra tu tabla de propiedades.
        </div>
      )}
    </div>
  );
}
