// ============================================================
// Motor de cálculo de intercambiadores de calor
// Métodos: LMTD y Efectividad-NTU (Cengel, cap. 11)
// Validado contra los Ejemplos 11-3, 11-4, 11-9, 11-43 y el
// Problema 11-94 del libro.
//
// DISEÑO: en vez de dos ramas rígidas ("tengo las 4 temperaturas
// -> LMTD" / "no las tengo -> NTU"), el capítulo 11 es en realidad
// un sistema de ecuaciones (balances de energía de cada fluido,
// Q=UAsΔTml, y opcionalmente Q=εQmax) que se puede resolver por
// partes, en el orden que dé cada enunciado. solveExchanger()
// aplica todas las relaciones que pueda en cada pasada (propagación
// hasta punto fijo) y solo recurre al método NTU si, después de
// agotar el álgebra, todavía faltan las temperaturas de salida.
// ============================================================

import { internalTubeH, annulusH, externalCylinderH } from "./convection.js";

export const isNum = (x) => x != null && Number.isFinite(x);

// Respaldo de calor latente de vaporización del agua (kJ/kg) a distintas
// temperaturas de saturación, por si la extracción con IA no captura hfg
// para un fluido que cambia de fase (caso muy común: el enunciado no da
// hfg directamente, hay que sacarlo de tablas de vapor). Se asume agua,
// el fluido de cambio de fase más común en estos ejercicios. Fuente:
// tablas de vapor saturado estándar (Cengel, Apéndice 1).
const HFG_AGUA_TABLE = [
  [0, 2501], [10, 2477], [20, 2454], [30, 2431], [40, 2406], [50, 2383],
  [60, 2359], [70, 2334], [80, 2309], [90, 2283], [100, 2257], [110, 2230],
  [120, 2203], [130, 2174], [140, 2145], [150, 2114], [160, 2082], [170, 2049],
  [180, 2015], [190, 1978], [200, 1941], [220, 1859], [250, 1716], [300, 1406],
  [350, 894],
];

function estimateHfgWater(tempC) {
  if (!isNum(tempC)) return null;
  const min = HFG_AGUA_TABLE[0][0];
  const max = HFG_AGUA_TABLE[HFG_AGUA_TABLE.length - 1][0];
  const t = Math.min(Math.max(tempC, min), max);
  for (let i = 0; i < HFG_AGUA_TABLE.length - 1; i++) {
    const [t0, h0] = HFG_AGUA_TABLE[i];
    const [t1, h1] = HFG_AGUA_TABLE[i + 1];
    if (t >= t0 && t <= t1) {
      const frac = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return h0 + frac * (h1 - h0);
    }
  }
  return null;
}

// ------------------------------------------------------------
// Cálculo automático de hi/ho mediante correlaciones de convección
// (Dittus-Boelter para flujo interno, Churchill-Bernstein para flujo
// cruzado externo sobre un cilindro), cuando el enunciado da
// velocidad/caudal + geometría en vez de un coeficiente de convección
// directo. Cubre: flujo interno en tubo circular, flujo en el ánulo
// de un tubo doble, y flujo EXTERNO cruzado sobre un solo cilindro
// (ver límites documentados en convection.js).
// ------------------------------------------------------------
function meanTemp(fluid) {
  const a = fluid?.temp_entrada_C, b = fluid?.temp_salida_C;
  if (isNum(a) && isNum(b)) return (a + b) / 2;
  if (isNum(a)) return a;
  if (isNum(b)) return b;
  return null;
}

function tryAutoConvection(data, hot, cold) {
  const warnings = [];
  const info = {};
  if (!data.requiere_correlacion_convectiva) return { hi: null, ho: null, warnings, info };

  const tubeSideIsHot = data.fluido_por_tubo === "caliente";
  const tubeSideIsCold = data.fluido_por_tubo === "frio";
  if (!tubeSideIsHot && !tubeSideIsCold) {
    warnings.push(
      "No se pudo calcular hᵢ/h₀ automáticamente: falta indicar cuál fluido va por el tubo interior (campo 'fluido_por_tubo'). Indícalo en Datos detectados y recalcula, o escribe hᵢ/h₀ manualmente."
    );
    return { hi: null, ho: null, warnings, info };
  }
  const tubeFluid = tubeSideIsHot ? hot : cold;
  const shellFluid = tubeSideIsHot ? cold : hot;
  const tubeIsHeating = tubeSideIsHot ? false : true; // el que se calienta usa n=0.4
  const Di_tubo = data.diametro_interior ?? null;
  const Do_tubo = data.diametro_exterior ?? data.diametro_interior ?? null; // pared delgada: Do≈Di si no se da
  const Di_coraza = data.diametro_coraza_m ?? null;
  const externalCrossFlow = data.configuracion_lado_externo === "flujo_cruzado_cilindro";

  let hi = data.hi ?? null;
  let ho = data.ho ?? null;

  // --- lado del tubo (hi) ---
  if (hi == null && !tubeFluid.cambio_fase) {
    if (!tubeFluid.tipo_fluido) {
      warnings.push(`No se pudo calcular hᵢ automáticamente: falta identificar el tipo de fluido del lado del tubo (${tubeFluid.nombre || "?"}) entre agua/aire/aceite de motor/etilenglicol.`);
    } else if (!isNum(Di_tubo)) {
      warnings.push("No se pudo calcular hᵢ automáticamente: falta el diámetro interior del tubo.");
    } else if (!isNum(tubeFluid.flujo_masico_kg_s) && !isNum(tubeFluid.velocidad_m_s)) {
      warnings.push(`No se pudo calcular hᵢ automáticamente: falta el gasto másico o la velocidad de ${tubeFluid.nombre || "el fluido del tubo"}.`);
    } else {
      const numTubosConv = isNum(data.numero_tubos) && data.numero_tubos > 0 ? Math.round(data.numero_tubos) : 1;
      const r = internalTubeH({
        tipoFluido: tubeFluid.tipo_fluido,
        tempC: meanTemp(tubeFluid),
        mdot: isNum(tubeFluid.flujo_masico_kg_s) ? tubeFluid.flujo_masico_kg_s / numTubosConv : null, // el gasto se reparte entre los tubos en paralelo
        V: isNum(tubeFluid.velocidad_m_s) ? tubeFluid.velocidad_m_s : null, // o directamente la velocidad, si el enunciado la da así
        D: Di_tubo,
        heating: tubeIsHeating,
      });
      if (r) {
        hi = r.h;
        info.hi = r;
      } else {
        warnings.push(`No se pudo calcular hᵢ automáticamente para ${tubeFluid.nombre || "el fluido del tubo"} (revisa datos de geometría/temperatura).`);
      }
    }
  }

  // --- lado de la coraza (ho): ánulo de tubo doble, O flujo cruzado externo
  //     sobre un solo cilindro (p. ej. aire soplando perpendicular al tubo) ---
  if (ho == null && !shellFluid.cambio_fase) {
    const shellIsHeating = tubeSideIsHot ? true : false;
    if (!shellFluid.tipo_fluido) {
      warnings.push(`No se pudo calcular h₀ automáticamente: falta identificar el tipo de fluido del lado de la coraza (${shellFluid.nombre || "?"}) entre agua/aire/aceite de motor/etilenglicol.`);
    } else if (externalCrossFlow) {
      if (!isNum(Do_tubo)) {
        warnings.push("No se pudo calcular h₀ automáticamente (flujo cruzado externo): falta el diámetro exterior del tubo.");
      } else if (!isNum(data.velocidad_externa_m_s)) {
        warnings.push(`No se pudo calcular h₀ automáticamente (flujo cruzado externo): falta la velocidad de corriente libre de ${shellFluid.nombre || "el fluido externo"}.`);
      } else {
        const r = externalCylinderH({
          tipoFluido: shellFluid.tipo_fluido,
          tempC: meanTemp(shellFluid),
          V: data.velocidad_externa_m_s,
          D: Do_tubo,
        });
        if (r) {
          ho = r.h;
          info.ho = r;
        } else {
          warnings.push(`No se pudo calcular h₀ automáticamente para ${shellFluid.nombre || "el fluido externo"} (revisa datos de geometría/temperatura).`);
        }
      }
    } else if (!isNum(Do_tubo) || !isNum(Di_coraza)) {
      warnings.push("No se pudo calcular h₀ automáticamente: falta el diámetro interior de la coraza/casco (o el diámetro exterior del tubo interior).");
    } else if (!isNum(shellFluid.flujo_masico_kg_s)) {
      warnings.push(`No se pudo calcular h₀ automáticamente: falta el gasto másico de ${shellFluid.nombre || "el fluido de la coraza"}.`);
    } else {
      const r = annulusH({
        tipoFluido: shellFluid.tipo_fluido,
        tempC: meanTemp(shellFluid),
        mdot: shellFluid.flujo_masico_kg_s,
        Do_tubo,
        Di_coraza,
        heating: shellIsHeating,
      });
      if (r) {
        ho = r.h;
        info.ho = r;
      } else {
        warnings.push(`No se pudo calcular h₀ automáticamente para ${shellFluid.nombre || "el fluido de la coraza"} (revisa datos de geometría/temperatura).`);
      }
    }
  }

  return { hi, ho, warnings, info };
}


// ------------------------------------------------------------
// Resuelve la resistencia de incrustación de un lado (interior u
// exterior) en m²·°C/W. Cubre los DOS formatos con los que el libro
// da este dato:
//   a) directo, como factor de incrustación Rf (m²·°C/W) — lo de
//      siempre, campo factor_incrustacion_i / factor_incrustacion_o.
//   b) como una capa de depósito con espesor y conductividad propia
//      (p. ej. "una capa de 2 mm de caliza, k=1.3 W/m·°C" — Prob.
//      11-25/11-26), en cuyo caso Rf = espesor / k. Campos:
//      incrustacion_i_espesor_m + incrustacion_i_k_W_mC (interior),
//      incrustacion_o_espesor_m + incrustacion_o_k_W_mC (exterior).
// Si el enunciado da ambos formatos para el mismo lado (raro), el
// valor directo (a) tiene prioridad.
// ------------------------------------------------------------
function resolveFoulingR(data, side) {
  const direct = data[`factor_incrustacion_${side}`];
  if (isNum(direct)) return direct;
  const t = data[`incrustacion_${side}_espesor_m`];
  const k = data[`incrustacion_${side}_k_W_mC`];
  if (isNum(t) && isNum(k) && k > 0) return t / k;
  return null;
}

// ------------------------------------------------------------
// Combina hi y ho en un coeficiente total U, referido a la superficie
// INTERIOR del tubo (Ui) — la convención que usa este motor para As,
// que siempre se calcula con el diámetro interior (ver más abajo).
// Incluye tres cosas que antes se ignoraban:
//   1) La resistencia de conducción de la pared cilíndrica del tubo,
//      ln(Do/Di)/(2k), cuando el enunciado da la conductividad de la
//      pared (conductividad_pared_k) Y ambos diámetros. Si falta k o
//      solo se da un diámetro, se asume pared delgada (este término
//      es 0), igual que antes.
//   2) El factor de incrustación EXTERIOR corregido por la razón de
//      áreas Di/Do (una resistencia definida "por área exterior" pesa
//      menos vista desde la superficie interior). El factor interior
//      no necesita corrección porque ya está en la misma referencia.
//   3) El factor de incrustación puede venir como espesor+k de una
//      capa de depósito en vez de un valor Rf directo (ver
//      resolveFoulingR arriba).
// Fórmula (Cengel, ec. 11-5/11-6):
//   1/Ui = 1/hi + Rf,i + Di·ln(Do/Di)/(2k) + (Di/Do)·Rf,o + (Di/Do)/ho
// ------------------------------------------------------------
export function overallUFromHiHo(hi, ho, data) {
  const Di = data.diametro_interior ?? null;
  const Do = data.diametro_exterior ?? Di;
  const k = data.conductividad_pared_k ?? null;

  const Rf_i = resolveFoulingR(data, "i");
  const Rf_o = resolveFoulingR(data, "o");

  let R = 1 / hi;
  if (Rf_i != null) R += Rf_i;

  let Rwall = 0;
  const wallApplicable = isNum(Di) && isNum(Do) && isNum(k) && Do > Di && k > 0;
  if (wallApplicable) {
    Rwall = (Di * Math.log(Do / Di)) / (2 * k);
    R += Rwall;
  }

  const areaRatio = isNum(Di) && isNum(Do) && Do > 0 ? Di / Do : 1; // Ai/Ao
  if (Rf_o != null) R += areaRatio * Rf_o;
  R += areaRatio / ho;

  const foulingFromLayer_i = data.factor_incrustacion_i == null && Rf_i != null;
  const foulingFromLayer_o = data.factor_incrustacion_o == null && Rf_o != null;

  return { U: 1 / R, Rwall, wallApplicable, Rf_i, Rf_o, foulingFromLayer_i, foulingFromLayer_o };
}

export function capacityRate(fluid) {
  if (!fluid) return null;
  if (fluid.cambio_fase) return Infinity;
  if (fluid.flujo_masico_kg_s == null || fluid.cp_kJ_kgC == null) return null;
  return fluid.flujo_masico_kg_s * fluid.cp_kJ_kgC * 1000; // W/°C
}

export function lmtdCalc(dT1, dT2) {
  if (dT1 == null || dT2 == null) return null;
  if (dT1 <= 0 || dT2 <= 0) return null; // cruce de temperaturas: no físico
  if (Math.abs(dT1 - dT2) < 1e-6 * Math.max(dT1, dT2)) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}

// Efectividad para UN paso por la coraza (2, 4, 6... pasos por los tubos) — Tabla 11-4
function effectiveness1ShellPass(NTU, C) {
  const s = Math.sqrt(1 + C * C);
  const e = Math.exp(-NTU * s);
  return 2 / (1 + C + (s * (1 + e)) / (1 - e));
}

// Generaliza a N pasos por la coraza combinando N intercambiadores de "1 paso"
// en serie (fórmula de Kays & London, la misma que genera las curvas de la
// Fig. 11-18b para 2 pasos por la coraza, etc.). NTU_total se reparte en
// partes iguales entre los N pasos.
export function effectivenessTubosCorazaN(NTU_total, C, N) {
  const n = N && N > 0 ? Math.round(N) : 1;
  const NTU1 = NTU_total / n;
  const eps1 = effectiveness1ShellPass(NTU1, C);
  if (n === 1) return eps1;
  const Ceff = Math.abs(C - 1) < 1e-9 ? 0.999999 : C; // evita la singularidad 0/0 en C=1
  const ratio = Math.pow((1 - eps1 * Ceff) / (1 - eps1), n);
  return (ratio - 1) / (ratio - Ceff);
}

export function effectivenessFromNTU(configKey, NTU, C) {
  switch (configKey) {
    case "paralelo":
      return (1 - Math.exp(-NTU * (1 + C))) / (1 + C);
    case "contraflujo": {
      if (Math.abs(C - 1) < 1e-9) return NTU / (1 + NTU);
      const e = Math.exp(-NTU * (1 - C));
      return (1 - e) / (1 - C * e);
    }
    case "tubos_coraza_1paso":
      return effectiveness1ShellPass(NTU, C);
    case "cruzado_no_mezclado":
      return 1 - Math.exp((1 / C) * Math.pow(NTU, 0.22) * (Math.exp(-C * Math.pow(NTU, 0.78)) - 1));
    case "cruzado_cmax_mezclado":
      return (1 / C) * (1 - Math.exp(-C * (1 - Math.exp(-NTU))));
    case "cruzado_cmin_mezclado":
      return 1 - Math.exp(-(1 / C) * (1 - Math.exp(-C * NTU)));
    default: {
      if (Math.abs(C - 1) < 1e-9) return NTU / (1 + NTU);
      const e = Math.exp(-NTU * (1 - C));
      return (1 - e) / (1 - C * e);
    }
  }
}

// F de Underwood — exacto para 1 paso por la coraza, N pasos por los tubos (Fig. 11-18a del libro)
export function correctionFactorF(P, R) {
  if (P == null || R == null || P <= 0) return 1;
  if (P >= 1) return null;
  const Reff = Math.abs(R - 1) < 1e-6 ? 1.000001 : R;
  const s = Math.sqrt(Reff * Reff + 1);
  const num = s * Math.log((1 - P) / (1 - P * Reff));
  const a = 2 / P - 1 - Reff + s;
  const b = 2 / P - 1 - Reff - s;
  if (a <= 0 || b <= 0) return null;
  const den = (Reff - 1) * Math.log(a / b);
  if (Math.abs(den) < 1e-12) return 1;
  const F = num / den;
  if (!Number.isFinite(F) || F <= 0) return null;
  return Math.min(F, 1);
}

export function generateProfile(isParallel, Th_in, Th_out, Tc_in, Tc_out, Ch, Cc, Q, N = 30) {
  const points = [];
  const dT1 = isParallel ? Th_in - Tc_in : Th_in - Tc_out;
  const dT2 = isParallel ? Th_out - Tc_out : Th_out - Tc_in;
  const nearlyEqual = Math.abs(dT1 - dT2) < 1e-6 * Math.max(Math.abs(dT1), Math.abs(dT2), 1);

  for (let i = 0; i <= N; i++) {
    const xi = i / N;
    let Th, Tc;
    if (isParallel) {
      const mInv = (isNum(Ch) ? 1 / Ch : 0) + (isNum(Cc) ? 1 / Cc : 0);
      const dTxi = nearlyEqual || mInv === 0 ? dT1 : dT1 * Math.pow(dT2 / dT1, xi);
      const q = mInv === 0 ? Q * xi : (dT1 - dTxi) / mInv;
      Th = isNum(Ch) ? Th_in - q / Ch : Th_in;
      Tc = isNum(Cc) ? Tc_in + q / Cc : Tc_in;
    } else {
      let q;
      if (nearlyEqual) q = Q * xi;
      else q = ((dT1 * Q) / (dT1 - dT2)) * (1 - Math.pow(dT2 / dT1, xi));
      Th = isNum(Ch) ? Th_in - q / Ch : Th_in;
      Tc = isNum(Cc) ? Tc_in + (Q - q) / Cc : Tc_in;
    }
    points.push({ x: Math.round(xi * 1000) / 10, Th, Tc });
  }
  return points;
}

// Factor de corrección F para la config. dada, una vez se conocen las 4 temperaturas.
function computeCorrectionFactor(tipo, pasosCoraza, isParallel, Th_in, Th_out, Tc_in, Tc_out) {
  if (isParallel) return { F: 1, warning: null };
  if (tipo === "tubo_doble" || !tipo) return { F: 1, warning: null };
  const P = (Tc_out - Tc_in) / (Th_in - Tc_in);
  const R = (Th_in - Th_out) / (Tc_out - Tc_in);
  if (tipo === "tubos_coraza" && (pasosCoraza ?? 1) === 1) {
    const Fcalc = correctionFactorF(P, R);
    if (Fcalc) return { F: Fcalc, warning: null };
    return { F: 1, warning: "No se pudo calcular F automáticamente; se asumió F=1 (verifica la Figura 11-18)." };
  }
  if (tipo === "tubos_coraza") {
    return {
      F: 1,
      warning: "Configuración multipasos (más de 1 paso por la coraza): F se aproximó como 1 — la fórmula exacta de Underwood solo cubre 1 paso por la coraza. Verifica la Figura 11-18 del libro.",
    };
  }
  // flujo_cruzado
  return { F: 1, warning: "Flujo cruzado: F se aproximó como 1. Verifica la Figura 11-18 del libro para mayor precisión." };
}

// ------------------------------------------------------------
// Propagación algebraica: aplica repetidamente las relaciones
// conocidas (balances de energía, pérdidas de calor, Q=UAsFΔTml
// y sus tres despejes, back-fill de gastos másicos) hasta que ya
// no se pueda deducir nada más. Muta `s`, `hot` y `cold` en el sitio.
// ------------------------------------------------------------
function runPropagation(s, hot, cold, data, isParallel) {
  let changed = true;
  let iterations = 0;
  const warnings = [];

  while (changed && iterations < 12) {
    changed = false;
    iterations++;

    // --- balances de energía de cada lado ---
    if (s.Q_hot == null && isNum(s.Ch) && isNum(s.Th_in) && isNum(s.Th_out)) {
      s.Q_hot = s.Ch * (s.Th_in - s.Th_out);
      changed = true;
    }
    if (s.Q_cold == null && isNum(s.Cc) && isNum(s.Tc_in) && isNum(s.Tc_out)) {
      s.Q_cold = s.Cc * (s.Tc_out - s.Tc_in);
      changed = true;
    }

    // --- relación entre lo que libera el caliente y lo que recibe el frío
    //     (si hay pérdidas de calor hacia el ambiente, difieren) ---
    if (s.Q_cold == null && s.Q_hot != null) {
      s.Q_cold = s.Q_hot * (1 - s.lossFraction);
      changed = true;
    }
    if (s.Q_hot == null && s.Q_cold != null && s.lossFraction < 0.999) {
      s.Q_hot = s.Q_cold / (1 - s.lossFraction);
      changed = true;
    }

    // --- temperaturas de cambio de fase (constantes) ---
    if (s.Th_out == null && hot.cambio_fase && isNum(s.Th_in)) { s.Th_out = s.Th_in; changed = true; }
    if (s.Th_in == null && hot.cambio_fase && isNum(s.Th_out)) { s.Th_in = s.Th_out; changed = true; }
    if (s.Tc_out == null && cold.cambio_fase && isNum(s.Tc_in)) { s.Tc_out = s.Tc_in; changed = true; }
    if (s.Tc_in == null && cold.cambio_fase && isNum(s.Tc_out)) { s.Tc_in = s.Tc_out; changed = true; }

    // --- despejar una temperatura faltante por balance de energía ---
    if (s.Th_out == null && isNum(s.Ch) && s.Q_hot != null && isNum(s.Th_in)) { s.Th_out = s.Th_in - s.Q_hot / s.Ch; changed = true; }
    if (s.Th_in == null && isNum(s.Ch) && s.Q_hot != null && isNum(s.Th_out)) { s.Th_in = s.Th_out + s.Q_hot / s.Ch; changed = true; }
    if (s.Tc_out == null && isNum(s.Cc) && s.Q_cold != null && isNum(s.Tc_in)) { s.Tc_out = s.Tc_in + s.Q_cold / s.Cc; changed = true; }
    if (s.Tc_in == null && isNum(s.Cc) && s.Q_cold != null && isNum(s.Tc_out)) { s.Tc_in = s.Tc_out - s.Q_cold / s.Cc; changed = true; }

    // --- ΔTml a partir de las 4 temperaturas (y el factor F que corresponda) ---
    if (s.dTml_CF == null && isNum(s.Th_in) && isNum(s.Th_out) && isNum(s.Tc_in) && isNum(s.Tc_out)) {
      const dT1 = isParallel ? s.Th_in - s.Tc_in : s.Th_in - s.Tc_out;
      const dT2 = isParallel ? s.Th_out - s.Tc_out : s.Th_out - s.Tc_in;
      const val = lmtdCalc(dT1, dT2);
      if (val != null) {
        s.dT1 = dT1;
        s.dT2 = dT2;
        s.dTml_CF = val;
        const { F, warning } = computeCorrectionFactor(data.tipo_intercambiador, data.pasos_coraza, isParallel, s.Th_in, s.Th_out, s.Tc_in, s.Tc_out);
        s.F = F;
        s.F_computed = true;
        if (warning) warnings.push(warning);
        s.dTml = F * val;
        changed = true;
      }
    }

    // --- CASO CLAVE: ΔTml directo desde Q, U y As, sin necesitar las 4
    //     temperaturas (p. ej. cuando el otro fluido es un "agua fría de la
    //     llave" del que no se conoce nada) ---
    // NOTA: por convención s.dTml YA incluye el factor F multiplicado
    // (ver más arriba: s.dTml = F * val). Por eso estas relaciones NO
    // vuelven a multiplicar/dividir por s.F — hacerlo lo aplicaría dos
    // veces y desinfla/infla U o As artificialmente cuando F≠1.
    if (s.dTml == null && s.Q_cold != null && isNum(s.U) && isNum(s.As)) {
      if (data.tipo_intercambiador === "tubos_coraza" && !s.F_computed && !isParallel) {
        warnings.push("No hay temperaturas suficientes para calcular el factor de corrección F con precisión; se asumió F=1.");
      }
      s.dTml = s.Q_cold / (s.U * s.As);
      changed = true;
    }
    // --- Q desde ΔTml, U y As (si ΔTml se conoce de otra forma) ---
    if (s.Q_cold == null && s.dTml != null && isNum(s.U) && isNum(s.As)) {
      s.Q_cold = s.U * s.As * s.dTml;
      changed = true;
    }
    // --- U o As despejados de los otros tres ---
    if (s.U == null && s.Q_cold != null && s.dTml != null && isNum(s.As)) {
      s.U = s.Q_cold / (s.As * s.dTml);
      changed = true;
    }
    if (s.As == null && s.Q_cold != null && s.dTml != null && isNum(s.U)) {
      s.As = s.Q_cold / (s.U * s.dTml);
      changed = true;
    }

    // --- back-fill de gastos másicos faltantes ---
    if (!hot.cambio_fase && hot.flujo_masico_kg_s == null && hot.cp_kJ_kgC && s.Q_hot != null && isNum(s.Th_in) && isNum(s.Th_out) && s.Th_in !== s.Th_out) {
      hot.flujo_masico_kg_s = s.Q_hot / (hot.cp_kJ_kgC * 1000 * (s.Th_in - s.Th_out));
      s.Ch = capacityRate(hot);
      changed = true;
    }
    if (!cold.cambio_fase && cold.flujo_masico_kg_s == null && cold.cp_kJ_kgC && s.Q_cold != null && isNum(s.Tc_in) && isNum(s.Tc_out) && s.Tc_in !== s.Tc_out) {
      cold.flujo_masico_kg_s = s.Q_cold / (cold.cp_kJ_kgC * 1000 * (s.Tc_out - s.Tc_in));
      s.Cc = capacityRate(cold);
      changed = true;
    }
    if (hot.cambio_fase && hot.flujo_masico_kg_s == null && hot.hfg_kJ_kg && s.Q_hot != null) {
      hot.flujo_masico_kg_s = s.Q_hot / (hot.hfg_kJ_kg * 1000);
      changed = true;
    }
    if (cold.cambio_fase && cold.flujo_masico_kg_s == null && cold.hfg_kJ_kg && s.Q_cold != null) {
      cold.flujo_masico_kg_s = s.Q_cold / (cold.hfg_kJ_kg * 1000);
      changed = true;
    }
  }

  return warnings;
}

export function solveExchanger(data) {
  const hot = { ...data.fluido_caliente };
  const cold = { ...data.fluido_frio };

  // --- respaldo: si cambia de fase y no vino hfg (la IA lo omitió porque el
  //     enunciado no lo da explícito), lo estimamos con la tabla de vapor
  //     saturado de agua. Sin esto, el gasto másico de ese fluido queda
  //     sin poder despejarse aunque todo lo demás esté completo. ---
  if (hot.cambio_fase && hot.hfg_kJ_kg == null) {
    const est = estimateHfgWater(hot.temp_entrada_C ?? hot.temp_salida_C);
    if (est != null) {
      hot.hfg_kJ_kg = est;
      hot.hfg_estimado = true;
    }
  }
  if (cold.cambio_fase && cold.hfg_kJ_kg == null) {
    const est = estimateHfgWater(cold.temp_entrada_C ?? cold.temp_salida_C);
    if (est != null) {
      cold.hfg_kJ_kg = est;
      cold.hfg_estimado = true;
    }
  }

  // --- geometría: As desde D y longitud, contemplando pasos por los tubos
  //     Y número de tubos EN PARALELO (dos conceptos distintos: "pasos" es
  //     cuántas veces el mismo tubo serpentea de ida y vuelta; "número de
  //     tubos" es cuántos tubos físicos hay uno junto al otro dentro de la
  //     coraza, típico en coraza-tubos con muchos tubos, p. ej. "24 tubos"). ---
  let As = data.area_m2 ?? null;
  const D = data.diametro_interior ?? data.diametro_m ?? null;
  const tubePasses = isNum(data.pasos_tubos) && data.pasos_tubos > 0 ? Math.round(data.pasos_tubos) : 1;
  const numTubos = isNum(data.numero_tubos) && data.numero_tubos > 0 ? Math.round(data.numero_tubos) : 1;
  let longitudTotal = null;
  if (data.longitud_m != null) {
    const esPorPaso = data.longitud_por_paso ?? tubePasses > 1;
    longitudTotal = esPorPaso ? data.longitud_m * tubePasses : data.longitud_m;
  }
  if (As == null && D && longitudTotal) As = Math.PI * D * longitudTotal * numTubos;

  // --- U directo, o combinado desde hi/ho (dados o calculados por correlación) ---
  let U = data.coeficiente_U_W_m2C ?? null;
  let hi = data.hi ?? null;
  let ho = data.ho ?? null;
  let convectionWarnings = [];
  let convectionInfo = null;
  let wallNote = null;
  if (U == null && (hi == null || ho == null) && data.requiere_correlacion_convectiva) {
    const auto = tryAutoConvection(data, hot, cold);
    if (hi == null && auto.hi != null) hi = auto.hi;
    if (ho == null && auto.ho != null) ho = auto.ho;
    convectionWarnings = auto.warnings;
    if (auto.info.hi || auto.info.ho) convectionInfo = auto.info;
  }
  if (U == null && isNum(hi) && isNum(ho)) {
    const combined = overallUFromHiHo(hi, ho, data);
    U = combined.U;
    if (combined.wallApplicable) {
      wallNote = `Se incluyó la resistencia de conducción de la pared del tubo (ln(Do/Di)/2k ≈ ${combined.Rwall.toExponential(3)} m²·°C/W, con k=${data.conductividad_pared_k} W/m·°C) — U está referido a la superficie interior del tubo (Ui), que es la que usa este motor para As.`;
    }
    if (combined.foulingFromLayer_i) {
      wallNote = (wallNote ? wallNote + " " : "") + `Factor de incrustación interior calculado como espesor/k de la capa de depósito ≈ ${combined.Rf_i.toExponential(3)} m²·°C/W.`;
    }
    if (combined.foulingFromLayer_o) {
      wallNote = (wallNote ? wallNote + " " : "") + `Factor de incrustación exterior calculado como espesor/k de la capa de depósito ≈ ${combined.Rf_o.toExponential(3)} m²·°C/W.`;
    }
  }
  const needsConvection = U == null && !!data.requiere_correlacion_convectiva;

  const lossFraction = isNum(data.perdida_calor_porcentaje)
    ? Math.min(Math.max(data.perdida_calor_porcentaje / 100, 0), 0.99)
    : 0;

  const flowType = data.configuracion_flujo || "contraflujo";
  const isParallel = flowType === "paralelo";
  let configKey = "contraflujo";
  if (isParallel) configKey = "paralelo";
  else if (data.tipo_intercambiador === "tubos_coraza") configKey = "tubos_coraza_1paso";
  else if (flowType === "cruzado_no_mezclado") configKey = "cruzado_no_mezclado";
  else if (flowType === "cruzado_cmax_mezclado") configKey = "cruzado_cmax_mezclado";
  else if (flowType === "cruzado_cmin_mezclado") configKey = "cruzado_cmin_mezclado";

  const s = {
    Th_in: hot.temp_entrada_C ?? null,
    Th_out: hot.temp_salida_C ?? null,
    Tc_in: cold.temp_entrada_C ?? null,
    Tc_out: cold.temp_salida_C ?? null,
    Ch: capacityRate(hot),
    Cc: capacityRate(cold),
    Q_hot: null,
    Q_cold: null,
    dT1: null,
    dT2: null,
    dTml_CF: null,
    F: 1,
    F_computed: false,
    dTml: null,
    U,
    As,
    lossFraction,
  };

  // Chequeo de consistencia: si NO se declaró ninguna pérdida y ambos balances
  // de energía se pueden calcular de forma independiente, deben coincidir.
  const warnings = [];
  if (convectionInfo) {
    if (convectionInfo.hi) {
      warnings.push(
        `hᵢ calculado automáticamente por correlación (Dittus-Boelter): Re=${convectionInfo.hi.Re.toFixed(0)}, Pr=${convectionInfo.hi.Pr.toFixed(2)}, Nu=${convectionInfo.hi.Nu.toFixed(1)}, flujo ${convectionInfo.hi.regime} → hᵢ≈${convectionInfo.hi.h.toFixed(0)} W/m²·°C. Verifícalo contra tu tabla de propiedades.`
      );
    }
    if (convectionInfo.ho) {
      const ho_info = convectionInfo.ho;
      if (ho_info.correlation === "Churchill-Bernstein") {
        warnings.push(
          `h₀ calculado automáticamente por correlación de flujo cruzado externo (Churchill-Bernstein): Re=${ho_info.Re.toFixed(0)}, Pr=${ho_info.Pr.toFixed(2)}, Nu=${ho_info.Nu.toFixed(1)} → h₀≈${ho_info.h.toFixed(0)} W/m²·°C. Verifícalo contra tu tabla de propiedades.`
        );
      } else {
        warnings.push(
          `h₀ calculado automáticamente por correlación (Dittus-Boelter, ánulo): Re=${ho_info.Re.toFixed(0)}, Pr=${ho_info.Pr.toFixed(2)}, Nu=${ho_info.Nu.toFixed(1)}, flujo ${ho_info.regime} → h₀≈${ho_info.h.toFixed(0)} W/m²·°C. Verifícalo contra tu tabla de propiedades.`
        );
      }
    }
  }
  warnings.push(...convectionWarnings);
  if (wallNote) warnings.push(wallNote);
  const Q_hot_direct = isNum(s.Ch) && isNum(s.Th_in) && isNum(s.Th_out) ? s.Ch * (s.Th_in - s.Th_out) : null;
  const Q_cold_direct = isNum(s.Cc) && isNum(s.Tc_in) && isNum(s.Tc_out) ? s.Cc * (s.Tc_out - s.Tc_in) : null;
  if (Q_hot_direct != null && Q_cold_direct != null && lossFraction === 0) {
    if (Math.abs(Q_hot_direct - Q_cold_direct) / Math.max(Math.abs(Q_hot_direct), Math.abs(Q_cold_direct)) > 0.08) {
      warnings.push(
        "Los balances de energía de los dos fluidos no coinciden bien (diferencia >8%); revisa los datos extraídos (¿el enunciado menciona pérdidas de calor que no se capturaron? corrige el campo correspondiente y recalcula)."
      );
    }
  }
  s.Q_hot = Q_hot_direct;
  s.Q_cold = Q_cold_direct;

  warnings.push(...runPropagation(s, hot, cold, data, isParallel));

  let method = "LMTD";
  let ntuInfo = null;
  const stillMissingSomething = s.Q_cold == null || !isNum(s.Th_in) || !isNum(s.Th_out) || !isNum(s.Tc_in) || !isNum(s.Tc_out);

  if (stillMissingSomething) {
    const haveNTUInputs =
      s.U != null &&
      s.As != null &&
      (isNum(s.Ch) || s.Ch === Infinity) &&
      (isNum(s.Cc) || s.Cc === Infinity) &&
      isNum(s.Th_in) &&
      isNum(s.Tc_in) &&
      !(s.Ch === Infinity && s.Cc === Infinity);

    if (haveNTUInputs) {
      const Cmin = Math.min(s.Ch, s.Cc);
      const Cmax = Math.max(s.Ch, s.Cc);
      const C = Cmax === Infinity ? 0 : Cmin / Cmax;
      const NTU = (s.U * s.As) / Cmin;
      let eps;
      if (C === 0) eps = 1 - Math.exp(-NTU);
      else if (data.tipo_intercambiador === "tubos_coraza") eps = effectivenessTubosCorazaN(NTU, C, data.pasos_coraza ?? 1);
      else eps = effectivenessFromNTU(configKey, NTU, C);
      const Qmax = Cmin * (s.Th_in - s.Tc_in);
      const Qntu = eps * Qmax;

      if (s.Q_cold == null) s.Q_cold = Qntu;
      if (s.Q_hot == null) s.Q_hot = lossFraction < 0.999 ? s.Q_cold / (1 - lossFraction) : s.Q_cold;

      method = "NTU";
      ntuInfo = { Cmin, Cmax, C, NTU, eps };

      // segunda pasada de propagación: con Q ya resuelto por NTU, se pueden
      // completar temperaturas de salida, ΔTml, gastos másicos, etc.
      warnings.push(...runPropagation(s, hot, cold, data, isParallel));
    }
  }

  // geometría final (usa As ya sea dado, calculado, o despejado por NTU/LMTD)
  let L = longitudTotal;
  if (L == null && s.As != null && D) L = s.As / (Math.PI * D);
  const Lporpaso = L != null && tubePasses > 1 ? L / tubePasses : null;

  if (s.Q_cold == null) {
    let hint = "No hay suficiente información para resolver este ejercicio con los datos actuales.";
    if (needsConvection) {
      hint = "No se pudo calcular U: falta hᵢ/h₀ y no se pudo completar el cálculo automático por correlación de convección (revisa los avisos abajo para ver exactamente qué dato falta).";
    } else if (s.U == null || s.As == null) {
      hint = "Faltan U y/o el área superficial (As): no se puede aplicar ni Q=UAsΔTml ni el método NTU.";
    } else if (!isNum(s.Ch) && s.Ch !== Infinity) {
      hint = "Falta el gasto másico o cp del fluido caliente.";
    } else if (!isNum(s.Cc) && s.Cc !== Infinity) {
      hint = "Falta el gasto másico o cp del fluido frío (y tampoco hay suficientes temperaturas para despejar Q sin él).";
    } else if (!isNum(s.Th_in) || !isNum(s.Tc_in)) {
      hint = "Faltan las temperaturas de entrada de los fluidos.";
    }
    return { method, warnings, error: hint, needsConvection, hot, cold, U: s.U, As: s.As };
  }

  return {
    method,
    warnings,
    Q: s.Q_cold,
    Q_liberado: s.Q_hot,
    U: s.U,
    As: s.As,
    L,
    Lporpaso,
    F: s.F,
    dTml: s.dTml,
    dT1: s.dT1,
    dT2: s.dT2,
    Th_in: s.Th_in,
    Th_out: s.Th_out,
    Tc_in: s.Tc_in,
    Tc_out: s.Tc_out,
    Ch: s.Ch,
    Cc: s.Cc,
    ...(ntuInfo || {}),
    hot,
    cold,
    configKey,
    isParallel,
    needsConvection,
  };
}
