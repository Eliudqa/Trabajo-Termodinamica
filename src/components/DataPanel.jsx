import { useState } from "react";
import { Flame, Snowflake, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import NumField from "./NumField.jsx";
import SelectField from "./SelectField.jsx";
import FluidEditor from "./FluidEditor.jsx";

const TIPO_LABELS = { tubo_doble: "Tubo doble", tubos_coraza: "Coraza y tubos", flujo_cruzado: "Flujo cruzado" };
const FLOW_LABELS = {
  paralelo: "Flujo paralelo",
  contraflujo: "Contraflujo",
  cruzado_no_mezclado: "Cruzado, no mezclado",
  cruzado_cmax_mezclado: "Cruzado, Cmáx mezclado",
  cruzado_cmin_mezclado: "Cruzado, Cmín mezclado",
};

const hasVal = (v) => v !== null && v !== undefined && v !== "";
const anyVal = (...vals) => vals.some(hasVal);

export default function DataPanel({ data, onChange, onRecalculate }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const updateField = (key, value) => onChange({ ...data, [key]: value });

  const isTubosCoraza = data.tipo_intercambiador === "tubos_coraza";
  const needsConv = !!data.requiere_correlacion_convectiva;
  const externalCfg = data.configuracion_lado_externo || "anulo_tubo_doble";

  // Secciones "avanzadas": ocultas por default, visibles si ya traen datos
  // (la IA los detectó) o si el usuario prende el interruptor para agregar
  // un efecto que la extracción no detectó.
  const hasWallConduction = hasVal(data.conductividad_pared_k);
  const hasFouling = anyVal(
    data.factor_incrustacion_i,
    data.factor_incrustacion_o,
    data.incrustacion_i_espesor_m,
    data.incrustacion_i_k_W_mC,
    data.incrustacion_o_espesor_m,
    data.incrustacion_o_k_W_mC
  );
  const hasInverseDesign = anyVal(data.Q_dado_kW, data.velocidad_maxima_tubo_m_s);
  const hasPerdida = hasVal(data.perdida_calor_porcentaje);

  const showWallSection = showAdvanced || hasWallConduction;
  const showFoulingSection = showAdvanced || hasFouling;
  const showInverseSection = showAdvanced || hasInverseDesign;
  const showPerdida = showAdvanced || hasPerdida;

  const showFluidoPorTubo =
    (data.tipo_intercambiador === "tubo_doble" || isTubosCoraza) &&
    (needsConv || hasVal(data.fluido_por_tubo) || hasVal(data.velocidad_maxima_tubo_m_s) || showAdvanced);

  return (
    <div className="hxs-card">
      <div className="hxs-eyebrow" style={{ marginBottom: 12 }}>Paso 2 · Datos detectados</div>
      <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "0 0 14px", lineHeight: 1.5 }}>
        Revisa lo que se detectó. Si algo está mal, corrígelo y pulsa <b>Recalcular</b> — es instantáneo, no
        vuelve a llamar a la IA.
      </p>

      <div className="hxs-row" style={{ marginBottom: 13 }}>
        <SelectField label="Tipo de intercambiador" value={data.tipo_intercambiador} onChange={(v) => updateField("tipo_intercambiador", v)} options={TIPO_LABELS} />
        <SelectField label="Configuración de flujo" value={data.configuracion_flujo} onChange={(v) => updateField("configuracion_flujo", v)} options={FLOW_LABELS} />
      </div>

      {isTubosCoraza && (
        <>
          <div className="hxs-row" style={{ marginBottom: 4 }}>
            <NumField label="Pasos por la coraza" value={data.pasos_coraza} onChange={(v) => updateField("pasos_coraza", v)} step="1" />
            <NumField label="Pasos por los tubos" value={data.pasos_tubos} onChange={(v) => updateField("pasos_tubos", v)} step="1" />
            <NumField label="Número de tubos (en paralelo)" value={data.numero_tubos} onChange={(v) => updateField("numero_tubos", v)} step="1" />
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-2px 0 13px", lineHeight: 1.5 }}>
            "Pasos por los tubos" = cuántas veces el fluido recorre la coraza de ida y vuelta (afecta F/efectividad).
            "Número de tubos" = cuántos tubos físicos hay en paralelo (afecta el área total, p. ej. "24 tubos" → 24).
            Son cosas distintas; deja en blanco el que no aplique.
          </p>
        </>
      )}

      <FluidEditor
        title="Fluido caliente"
        icon={<Flame size={14} color="var(--copper)" />}
        tone="hot"
        fluid={data.fluido_caliente}
        onChange={(f) => updateField("fluido_caliente", f)}
        needsConvection={needsConv}
      />
      <FluidEditor
        title="Fluido frío"
        icon={<Snowflake size={14} color="var(--steel)" />}
        tone="cold"
        fluid={data.fluido_frio}
        onChange={(f) => updateField("fluido_frio", f)}
        needsConvection={needsConv}
      />

      <div className="hxs-row">
        <NumField label="Coeficiente U" suffix="W/m²·°C" value={data.coeficiente_U_W_m2C} onChange={(v) => updateField("coeficiente_U_W_m2C", v)} />
        <NumField label="hᵢ (interior)" suffix="W/m²·°C" value={data.hi} onChange={(v) => updateField("hi", v)} />
        <NumField label="h₀ (exterior)" suffix="W/m²·°C" value={data.ho} onChange={(v) => updateField("ho", v)} />
        {showPerdida && <NumField label="Pérdida de calor" suffix="%" value={data.perdida_calor_porcentaje} onChange={(v) => updateField("perdida_calor_porcentaje", v)} />}
      </div>
      <div className="hxs-row">
        <NumField label="Área, As" suffix="m²" value={data.area_m2} onChange={(v) => updateField("area_m2", v)} />
        <NumField label="Diámetro interior" suffix="m" value={data.diametro_interior} onChange={(v) => updateField("diametro_interior", v)} />
        <NumField label="Diámetro exterior (tubo)" suffix="m" value={data.diametro_exterior} onChange={(v) => updateField("diametro_exterior", v)} />
        <NumField label="Longitud" suffix="m" value={data.longitud_m} onChange={(v) => updateField("longitud_m", v)} />
      </div>

      {showWallSection && (
        <>
          <div className="hxs-row">
            <NumField label="Conductividad de la pared del tubo, k" suffix="W/m·°C" value={data.conductividad_pared_k} onChange={(v) => updateField("conductividad_pared_k", v)} />
          </div>
          {data.conductividad_pared_k != null && data.diametro_interior != null && data.diametro_exterior != null && (
            <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-6px 0 13px", lineHeight: 1.5 }}>
              Con diámetro interior, exterior y k dados, el motor suma la resistencia de conducción de la pared
              del tubo (ln(D₀/Dᵢ)/2k) al calcular U desde hᵢ/h₀.
            </p>
          )}
        </>
      )}

      {showFoulingSection && (
        <>
          <div className="hxs-row" style={{ marginBottom: 4 }}>
            <NumField label="Factor de incrustación i (directo)" suffix="m²·°C/W" value={data.factor_incrustacion_i} onChange={(v) => updateField("factor_incrustacion_i", v)} />
            <NumField label="Factor de incrustación o (directo)" suffix="m²·°C/W" value={data.factor_incrustacion_o} onChange={(v) => updateField("factor_incrustacion_o", v)} />
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "0 0 4px", lineHeight: 1.5 }}>
            Incrustación como capa de depósito (espesor + k), si el enunciado la da así en vez de un factor Rf directo:
          </p>
          <div className="hxs-row" style={{ marginBottom: 4 }}>
            <NumField label="Espesor capa, lado interior" suffix="m" value={data.incrustacion_i_espesor_m} onChange={(v) => updateField("incrustacion_i_espesor_m", v)} />
            <NumField label="k de la capa, lado interior" suffix="W/m·°C" value={data.incrustacion_i_k_W_mC} onChange={(v) => updateField("incrustacion_i_k_W_mC", v)} />
            <NumField label="Espesor capa, lado exterior" suffix="m" value={data.incrustacion_o_espesor_m} onChange={(v) => updateField("incrustacion_o_espesor_m", v)} />
            <NumField label="k de la capa, lado exterior" suffix="W/m·°C" value={data.incrustacion_o_k_W_mC} onChange={(v) => updateField("incrustacion_o_k_W_mC", v)} />
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-2px 0 13px", lineHeight: 1.5 }}>
            Si ya tienes el factor de incrustación Rf directamente, usa los campos de arriba; si el enunciado da
            espesor y k de una capa de depósito, usa estos otros — el motor da prioridad al valor directo si ambos están llenos.
          </p>
        </>
      )}

      {showFluidoPorTubo && (
        <div className="hxs-row" style={{ marginBottom: 4 }}>
          <SelectField
            label="¿Cuál fluido va por el tubo interior?"
            value={data.fluido_por_tubo || ""}
            onChange={(v) => updateField("fluido_por_tubo", v)}
            options={{ "": "— selecciona —", caliente: "El fluido caliente", frio: "El fluido frío" }}
          />
        </div>
      )}

      {needsConv && (
        <>
          <div className="hxs-row" style={{ marginBottom: 4 }}>
            <SelectField
              label="¿Cómo fluye el fluido de afuera del tubo?"
              value={externalCfg}
              onChange={(v) => updateField("configuracion_lado_externo", v)}
              options={{ anulo_tubo_doble: "Confinado en un ánulo (tubo doble)", flujo_cruzado_cilindro: "Flujo cruzado libre sobre el tubo (p. ej. aire perpendicular)" }}
            />
          </div>
          <div className="hxs-row" style={{ marginBottom: 4 }}>
            {externalCfg === "anulo_tubo_doble" ? (
              <NumField label="Diámetro interior de la coraza/ánulo" suffix="m" value={data.diametro_coraza_m} onChange={(v) => updateField("diametro_coraza_m", v)} />
            ) : (
              <NumField label="Velocidad del fluido externo" suffix="m/s" value={data.velocidad_externa_m_s} onChange={(v) => updateField("velocidad_externa_m_s", v)} />
            )}
          </div>
        </>
      )}

      {showInverseSection && (
        <>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "8px 0 4px", lineHeight: 1.5 }}>
            Diseño inverso (opcional) — para preguntas del tipo "¿cuántos tubos se necesitan?":
          </p>
          <div className="hxs-row" style={{ marginBottom: 4 }}>
            <NumField label="Carga de calor dada directamente" suffix="kW" value={data.Q_dado_kW} onChange={(v) => updateField("Q_dado_kW", v)} />
            <NumField label="Velocidad máxima permitida en el tubo" suffix="m/s" value={data.velocidad_maxima_tubo_m_s} onChange={(v) => updateField("velocidad_maxima_tubo_m_s", v)} />
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-2px 0 13px", lineHeight: 1.5 }}>
            Si llenas la velocidad máxima y dejas "Número de tubos" en blanco, el motor calcula cuántos tubos se
            necesitan (redondeado hacia arriba) a partir del gasto másico del fluido del tubo y su densidad.
          </p>
        </>
      )}

      {isTubosCoraza && data.pasos_tubos > 1 && (
        <div className="hxs-checkbox-row" style={{ marginTop: -4 }}>
          <input type="checkbox" checked={!!data.longitud_por_paso} onChange={(e) => updateField("longitud_por_paso", e.target.checked)} />
          La longitud de arriba es POR PASO (se multiplica ×{data.pasos_tubos} para el área total). Desmárcalo si ya es la longitud total del tubo.
        </div>
      )}

      <button
        type="button"
        className="hxs-btn hxs-btn-ghost hxs-btn-sm"
        style={{ marginTop: 4, marginBottom: 13 }}
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showAdvanced ? "Ocultar opciones avanzadas" : "Mostrar opciones avanzadas (incrustación, conducción de pared, diseño inverso...)"}
      </button>

      <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 13, lineHeight: 1.5 }}>
        <b style={{ color: "var(--ink)" }}>Se pide encontrar:</b> {data.incognita_principal || "—"}
        {data.notas && (
          <div style={{ marginTop: 4 }}>
            <b style={{ color: "var(--ink)" }}>Notas de la extracción:</b> {data.notas}
          </div>
        )}
      </div>

      <button className="hxs-btn hxs-btn-primary" onClick={onRecalculate}>
        <RotateCcw size={15} /> Recalcular con estos datos
      </button>
    </div>
  );
}
