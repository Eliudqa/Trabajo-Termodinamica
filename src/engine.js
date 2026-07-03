// ============================================================
// Motor de cálculo de intercambiadores de calor
// Métodos: LMTD y Efectividad-NTU (Cengel, cap. 11)
// Validado contra los Ejemplos 11-3, 11-4 y 11-9 del libro.
// ============================================================

export const isNum = (x) => x != null && Number.isFinite(x);

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

export function effectivenessFromNTU(configKey, NTU, C) {
  switch (configKey) {
    case "paralelo":
      return (1 - Math.exp(-NTU * (1 + C))) / (1 + C);
    case "contraflujo": {
      if (Math.abs(C - 1) < 1e-9) return NTU / (1 + NTU);
      const e = Math.exp(-NTU * (1 - C));
      return (1 - e) / (1 - C * e);
    }
    case "tubos_coraza_1paso": {
      const s = Math.sqrt(1 + C * C);
      const e = Math.exp(-NTU * s);
      return 2 / (1 + C + (s * (1 + e)) / (1 - e));
    }
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

// Si falta exactamente UNA de las 4 temperaturas, la despeja con un balance
// de energía simple (así es como el libro determina temperaturas de salida
// antes de aplicar LMTD).
export function fillMissingTemperature(t, hot, cold, Ch, Cc) {
  const temps = { ...t };
  const missing = Object.keys(temps).filter((k) => temps[k] == null);
  if (missing.length !== 1) return temps;
  const key = missing[0];

  if (key === "Th_out") {
    if (hot.cambio_fase) {
      temps.Th_out = temps.Th_in;
      return temps;
    }
    if (isNum(temps.Tc_in) && isNum(temps.Tc_out) && isNum(Cc) && isNum(Ch)) {
      const Q = Cc * (temps.Tc_out - temps.Tc_in);
      temps.Th_out = temps.Th_in - Q / Ch;
    }
  } else if (key === "Tc_out") {
    if (cold.cambio_fase) {
      temps.Tc_out = temps.Tc_in;
      return temps;
    }
    if (isNum(temps.Th_in) && isNum(temps.Th_out) && isNum(Ch) && isNum(Cc)) {
      const Q = Ch * (temps.Th_in - temps.Th_out);
      temps.Tc_out = temps.Tc_in + Q / Cc;
    }
  } else if (key === "Th_in") {
    if (isNum(temps.Tc_in) && isNum(temps.Tc_out) && isNum(Cc) && isNum(Ch)) {
      const Q = Cc * (temps.Tc_out - temps.Tc_in);
      temps.Th_in = temps.Th_out + Q / Ch;
    }
  } else if (key === "Tc_in") {
    if (isNum(temps.Th_in) && isNum(temps.Th_out) && isNum(Ch) && isNum(Cc)) {
      const Q = Ch * (temps.Th_in - temps.Th_out);
      temps.Tc_in = temps.Tc_out - Q / Cc;
    }
  }
  return temps;
}

export function solveExchanger(data) {
  const warnings = [];
  const hot = { ...data.fluido_caliente };
  const cold = { ...data.fluido_frio };

  let Ch = capacityRate(hot);
  let Cc = capacityRate(cold);

  let U = data.coeficiente_U_W_m2C ?? null;
  if (U == null && isNum(data.hi) && isNum(data.ho)) {
    let R = 1 / data.hi + 1 / data.ho;
    if (data.factor_incrustacion_i) R += data.factor_incrustacion_i;
    if (data.factor_incrustacion_o) R += data.factor_incrustacion_o;
    U = 1 / R;
  }
  const needsConvection = U == null && !!data.requiere_correlacion_convectiva;

  let As = data.area_m2 ?? null;
  const D = data.diametro_interior ?? data.diametro_m ?? null;
  if (As == null && D && data.longitud_m) As = Math.PI * D * data.longitud_m;

  let temps = fillMissingTemperature(
    { Th_in: hot.temp_entrada_C, Th_out: hot.temp_salida_C, Tc_in: cold.temp_entrada_C, Tc_out: cold.temp_salida_C },
    hot,
    cold,
    Ch,
    Cc
  );

  const allTempsKnown = isNum(temps.Th_in) && isNum(temps.Th_out) && isNum(temps.Tc_in) && isNum(temps.Tc_out);
  const flowType = data.configuracion_flujo || "contraflujo";
  const isParallel = flowType === "paralelo";
  let configKey = "contraflujo";
  if (isParallel) configKey = "paralelo";
  else if (data.tipo_intercambiador === "tubos_coraza") configKey = "tubos_coraza_1paso";
  else if (flowType === "cruzado_no_mezclado") configKey = "cruzado_no_mezclado";
  else if (flowType === "cruzado_cmax_mezclado") configKey = "cruzado_cmax_mezclado";
  else if (flowType === "cruzado_cmin_mezclado") configKey = "cruzado_cmin_mezclado";

  if (allTempsKnown) {
    let { Th_in, Th_out, Tc_in, Tc_out } = temps;

    const dT1 = isParallel ? Th_in - Tc_in : Th_in - Tc_out;
    const dT2 = isParallel ? Th_out - Tc_out : Th_out - Tc_in;
    const dTml_CF = lmtdCalc(dT1, dT2);

    let F = 1;
    if (dTml_CF && data.tipo_intercambiador === "tubos_coraza" && (data.pasos_coraza ?? 1) === 1 && !isParallel) {
      const P = (Tc_out - Tc_in) / (Th_in - Tc_in);
      const R = (Th_in - Th_out) / (Tc_out - Tc_in);
      const Fcalc = correctionFactorF(P, R);
      if (Fcalc) F = Fcalc;
      else warnings.push("No se pudo calcular F automáticamente; se asumió F=1 (verifica la Figura 11-18).");
    } else if (dTml_CF && data.tipo_intercambiador !== "tubo_doble" && !isParallel) {
      warnings.push("Configuración multipasos/flujo cruzado: F se aproximó como 1. Para más precisión verifica la Figura 11-18 del libro.");
    }
    const dTml = dTml_CF != null ? F * dTml_CF : null;

    let Qh = isNum(Ch) ? Ch * (Th_in - Th_out) : null;
    let Qc = isNum(Cc) ? Cc * (Tc_out - Tc_in) : null;
    let Q = null;
    if (Qh != null && Qc != null) {
      if (Math.abs(Qh - Qc) / Math.max(Math.abs(Qh), Math.abs(Qc)) > 0.08) {
        warnings.push("Los balances de energía de los dos fluidos no coinciden bien (diferencia >8%); revisa los datos extraídos.");
      }
      Q = (Qh + Qc) / 2;
    } else {
      Q = Qh ?? Qc;
    }
    if (Q == null && hot.cambio_fase && hot.hfg_kJ_kg && hot.flujo_masico_kg_s) Q = hot.flujo_masico_kg_s * hot.hfg_kJ_kg * 1000;
    if (Q == null && cold.cambio_fase && cold.hfg_kJ_kg && cold.flujo_masico_kg_s) Q = cold.flujo_masico_kg_s * cold.hfg_kJ_kg * 1000;
    if (Q == null && U != null && As != null && dTml) Q = U * As * dTml;

    if (Q != null && dTml) {
      if (U == null && As != null) U = Q / (As * dTml);
      else if (As == null && U != null) As = Q / (U * dTml);
    }

    let L = data.longitud_m ?? null;
    if (L == null && As != null && D) L = As / (Math.PI * D);

    if (Q != null) {
      if (!hot.cambio_fase && Ch == null && hot.cp_kJ_kgC) {
        hot.flujo_masico_kg_s = Q / (hot.cp_kJ_kgC * 1000 * (Th_in - Th_out));
        Ch = capacityRate(hot);
      }
      if (!cold.cambio_fase && Cc == null && cold.cp_kJ_kgC) {
        cold.flujo_masico_kg_s = Q / (cold.cp_kJ_kgC * 1000 * (Tc_out - Tc_in));
        Cc = capacityRate(cold);
      }
      if (hot.cambio_fase && hot.flujo_masico_kg_s == null && hot.hfg_kJ_kg) {
        hot.flujo_masico_kg_s = Q / (hot.hfg_kJ_kg * 1000);
      }
      if (cold.cambio_fase && cold.flujo_masico_kg_s == null && cold.hfg_kJ_kg) {
        cold.flujo_masico_kg_s = Q / (cold.hfg_kJ_kg * 1000);
      }
    }

    return {
      method: "LMTD",
      warnings,
      Q,
      U,
      As,
      L,
      F,
      dTml,
      dT1,
      dT2,
      Th_in,
      Th_out,
      Tc_in,
      Tc_out,
      Ch,
      Cc,
      hot,
      cold,
      configKey,
      isParallel,
      needsConvection,
    };
  }

  // ---------------- MÉTODO EFECTIVIDAD-NTU ----------------
  if (U == null || As == null) {
    return {
      method: "NTU",
      warnings,
      error: "Faltan U y/o el área superficial para aplicar el método NTU (y no hay temperaturas suficientes para LMTD).",
      needsConvection,
      hot,
      cold,
    };
  }
  if (!isNum(Ch) && Ch !== Infinity) {
    return {
      method: "NTU",
      warnings,
      error: "Falta el gasto másico o cp del fluido caliente: no se puede determinar su razón de capacidad calorífica.",
      needsConvection,
      hot,
      cold,
    };
  }
  if (!isNum(Cc) && Cc !== Infinity) {
    return {
      method: "NTU",
      warnings,
      error: "Falta el gasto másico o cp del fluido frío: no se puede determinar su razón de capacidad calorífica.",
      needsConvection,
      hot,
      cold,
    };
  }
  if (temps.Th_in == null || temps.Tc_in == null) {
    return { method: "NTU", warnings, error: "Faltan las temperaturas de entrada de los fluidos.", needsConvection, hot, cold };
  }

  const Cmin = Math.min(Ch, Cc);
  const Cmax = Math.max(Ch, Cc);
  const C = Cmax === Infinity ? 0 : Cmin / Cmax;
  const NTU = (U * As) / Cmin;
  const eps = C === 0 ? 1 - Math.exp(-NTU) : effectivenessFromNTU(configKey, NTU, C);
  const Qmax = Cmin * (temps.Th_in - temps.Tc_in);
  const Q = eps * Qmax;

  const Th_out = temps.Th_out ?? (isNum(Ch) ? temps.Th_in - Q / Ch : temps.Th_in);
  const Tc_out = temps.Tc_out ?? (isNum(Cc) ? temps.Tc_in + Q / Cc : temps.Tc_in);

  const dT1 = isParallel ? temps.Th_in - temps.Tc_in : temps.Th_in - Tc_out;
  const dT2 = isParallel ? Th_out - Tc_out : Th_out - temps.Tc_in;

  return {
    method: "NTU",
    warnings,
    Q,
    U,
    As,
    L: data.longitud_m ?? null,
    F: null,
    dTml: lmtdCalc(dT1, dT2),
    dT1,
    dT2,
    Th_in: temps.Th_in,
    Th_out,
    Tc_in: temps.Tc_in,
    Tc_out,
    Ch,
    Cc,
    Cmin,
    Cmax,
    C,
    NTU,
    eps,
    hot,
    cold,
    configKey,
    isParallel,
    needsConvection,
  };
}
