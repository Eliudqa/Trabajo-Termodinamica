import { useState } from "react";
import { Flame, Snowflake, RotateCcw, SlidersHorizontal } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("principal");
  const updateField = (key, value) => onChange({ ...data, [key]: value });

  const isTubosCoraza = data.tipo_intercambiador === "tubos_coraza";
  const isFlujoCruzado = data.tipo_intercambiador === "flujo_cruzado";
  const needsConv = !!data.requiere_correlacion_convectiva;
  const externalCfg = data.configuracion_lado_externo || "anulo_tubo_doble";

  // Banco de tubos en flujo cruzado dentro de un ducto (sin aletas): p. ej.
  // "40 tubos de 1 cm en un ducto de 1×1 m, agua por dentro a 3 m/s, aire por
  // el ducto a 12 m/s". Aquí ninguno de los dos fluidos suele dar gasto
  // másico directo, así que hace falta saber cuál va por el tubo aunque no
  // se necesite calcular hᵢ/h₀ por correlación (U puede venir ya dado).
  const isDuctoBancoTubos = isFlujoCruzado && hasVal(data.numero_tubos);

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
  const hasAdvancedData = hasWallConduction || hasFouling || hasInverseDesign;

  const showFluidoPorTubo =
    (data.tipo_intercambiador === "tubo_doble" || isTubosCoraza || isDuctoBancoTubos) &&
    (needsConv || hasVal(data.fluido_por_tubo) || hasVal(data.velocidad_maxima_tubo_m_s) || isDuctoBancoTubos);

  return (
    <div className="hxs-card">
      <div className="hxs-eyebrow" style={{ marginBottom: 12 }}>Paso 2 · Datos detectados</div>
      <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "0 0 14px", lineHeight: 1.5 }}>
        Revisa lo que se detectó. Si algo está mal, corrígelo y pulsa <b>Recalcular</b> — es instantáneo, no
        vuelve a llamar a la IA.
      </p>

      <div className="hxs-tabs" role="tablist">
        <button type="button" role="tab" className="hxs-tab" data-active={activeTab === "principal"} onClick={() => setActiveTab("principal")}>
          Datos principales
        </button>
        <button type="button" role="tab" className="hxs-tab" data-active={activeTab === "avanzado"} onClick={() => setActiveTab("avanzado")}>
          Avanzado
          {hasAdvancedData && <span className="hxs-tab-dot" aria-label="Tiene datos" />}
        </button>
      </div>

      {activeTab === "principal" && (
        <div role="tabpanel">
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

          {isFlujoCruzado && (
            <>
              <div className="hxs-row" style={{ marginBottom: 4 }}>
                <NumField label="Número de tubos" value={data.numero_tubos} onChange={(v) => updateField("numero_tubos", v)} step="1" />
                <NumField label="Área frontal del ducto" suffix="m²" value={data.area_frontal_ducto_m2} onChange={(v) => updateField("area_frontal_ducto_m2", v)} />
                <NumField label="Profundidad de los tubos" suffix="m" value={data.profundidad_tubos_m} onChange={(v) => updateField("profundidad_tubos_m", v)} />
              </div>
              <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-2px 0 13px", lineHeight: 1.5 }}>
                Solo aplica a un banco de tubos SIN aletas dentro de un ducto (p. ej. aire cruzando perpendicular
                un conjunto de tubos con agua adentro). "Área frontal del ducto" es la sección transversal completa
                antes de descontar los tubos; "profundidad de los tubos" es cuánto mide cada tubo dentro del ducto
                (el motor la usa también como longitud del tubo para el área de transferencia). Con esto, el motor
                calcula el gasto másico de cada fluido a partir de su velocidad, sin necesitar que lo des directo.
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
            <NumField label="Pérdida de calor" suffix="%" value={data.perdida_calor_porcentaje} onChange={(v) => updateField("perdida_calor_porcentaje", v)} />
          </div>
          <div className="hxs-row">
            <NumField label="Área, As" suffix="m²" value={data.area_m2} onChange={(v) => updateField("area_m2", v)} />
            <NumField label="Diámetro interior" suffix="m" value={data.diametro_interior} onChange={(v) => updateField("diametro_interior", v)} />
            <NumField label="Diámetro exterior (tubo)" suffix="m" value={data.diametro_exterior} onChange={(v) => updateField("diametro_exterior", v)} />
            <NumField label="Longitud" suffix="m" value={data.longitud_m} onChange={(v) => updateField("longitud_m", v)} />
          </div>

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

          {isTubosCoraza && data.pasos_tubos > 1 && (
            <div className="hxs-checkbox-row" style={{ marginTop: -4 }}>
              <input type="checkbox" checked={!!data.longitud_por_paso} onChange={(e) => updateField("longitud_por_paso", e.target.checked)} />
              La longitud de arriba es POR PASO (se multiplica ×{data.pasos_tubos} para el área total). Desmárcalo si ya es la longitud total del tubo.
            </div>
          )}
        </div>
      )}

      {activeTab === "avanzado" && (
        <div role="tabpanel">
          <p style={{ fontSize: 11.5, color: "var(--ink-dim)", margin: "0 0 14px", lineHeight: 1.5, display: "flex", gap: 6 }}>
            <SlidersHorizontal size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            Efectos que solo aplican a algunos ejercicios: conducción por la pared del tubo, incrustación, y
            problemas de diseño inverso ("¿cuántos tubos hacen falta?").
          </p>

          <div className="hxs-row">
            <NumField label="Conductividad de la pared del tubo, k" suffix="W/m·°C" value={data.conductividad_pared_k} onChange={(v) => updateField("conductividad_pared_k", v)} />
          </div>
          {data.conductividad_pared_k != null && data.diametro_interior != null && data.diametro_exterior != null && (
            <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-6px 0 13px", lineHeight: 1.5 }}>
              Con diámetro interior, exterior y k dados, el motor suma la resistencia de conducción de la pared
              del tubo (ln(D₀/Dᵢ)/2k) al calcular U desde hᵢ/h₀.
            </p>
          )}

          <hr className="hxs-divider" />

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

          <hr className="hxs-divider" />

          <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "0 0 4px", lineHeight: 1.5 }}>
            Diseño inverso — para preguntas del tipo "¿cuántos tubos se necesitan?":
          </p>
          <div className="hxs-row" style={{ marginBottom: 4 }}>
            <NumField label="Carga de calor dada directamente" suffix="kW" value={data.Q_dado_kW} onChange={(v) => updateField("Q_dado_kW", v)} />
            <NumField label="Velocidad máxima permitida en el tubo" suffix="m/s" value={data.velocidad_maxima_tubo_m_s} onChange={(v) => updateField("velocidad_maxima_tubo_m_s", v)} />
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-dim)", margin: "-2px 0 13px", lineHeight: 1.5 }}>
            Si llenas la velocidad máxima y dejas "Número de tubos" en blanco (pestaña principal), el motor
            calcula cuántos tubos se necesitan (redondeado hacia arriba) a partir del gasto másico del fluido
            del tubo y su densidad.
          </p>
        </div>
      )}

      <div style={{ fontSize: 12, color: "var(--ink-dim)", margin: "13px 0", lineHeight: 1.5 }}>
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
