import { describe, it, expect } from "vitest";
import { solveExchanger, correctionFactorF, generateProfile, effectivenessTubosCorazaN, overallUFromHiHo } from "./engine.js";

describe("Resistencia de pared del tubo en el cálculo de U (fix #1)", () => {
  it("sin datos de pared (ni Do ni k): se comporta como antes, U = 1/(1/hi + 1/ho)", () => {
    const { U, wallApplicable } = overallUFromHiHo(1000, 2000, {});
    expect(wallApplicable).toBe(false);
    expect(U).toBeCloseTo(1 / (1 / 1000 + 1 / 2000), 6);
  });

  it("con Di, Do y k dados: suma ln(Do/Di)/(2k) referido a la superficie interior", () => {
    const Di = 0.05, Do = 0.06, k = 50, hi = 1000, ho = 2000;
    const { U, Rwall, wallApplicable } = overallUFromHiHo(hi, ho, { diametro_interior: Di, diametro_exterior: Do, conductividad_pared_k: k });
    const RwallEsperado = (Di * Math.log(Do / Di)) / (2 * k);
    const Uesperado = 1 / (1 / hi + RwallEsperado + (Di / Do) / ho);
    expect(wallApplicable).toBe(true);
    expect(Rwall).toBeCloseTo(RwallEsperado, 9);
    expect(U).toBeCloseTo(Uesperado, 6);
  });

  it("si falta k o Do (pared delgada implícita), NO agrega resistencia de pared", () => {
    const r1 = overallUFromHiHo(1000, 2000, { diametro_interior: 0.05, diametro_exterior: 0.06 }); // sin k
    const r2 = overallUFromHiHo(1000, 2000, { diametro_interior: 0.05, conductividad_pared_k: 50 }); // sin Do
    expect(r1.wallApplicable).toBe(false);
    expect(r2.wallApplicable).toBe(false);
  });

  it("el factor de incrustación exterior se corrige por la razón de áreas Di/Do", () => {
    const Di = 0.05, Do = 0.06, hi = 1000, ho = 2000, Rfo = 0.001;
    const { U } = overallUFromHiHo(hi, ho, { diametro_interior: Di, diametro_exterior: Do, factor_incrustacion_o: Rfo });
    const Uesperado = 1 / (1 / hi + (Di / Do) * Rfo + (Di / Do) / ho);
    expect(U).toBeCloseTo(Uesperado, 6);
  });

  it("integración con solveExchanger: U calculado desde hi/ho ahora incluye la pared si se dan los datos", () => {
    // Problema 11-124: tubo de latón (k=110), Di=1.3cm, Do=1.5cm, ho=35 W/m2C (aceite), hi supuesto dado
    const data = {
      tipo_intercambiador: "tubo_doble",
      configuracion_flujo: "contraflujo",
      fluido_caliente: { nombre: "aceite", temp_entrada_C: 100, temp_salida_C: 80, flujo_masico_kg_s: 1, cp_kJ_kgC: 2 },
      fluido_frio: { nombre: "agua", temp_entrada_C: 25, temp_salida_C: 35, flujo_masico_kg_s: 1, cp_kJ_kgC: 4.18 },
      hi: 9500,
      ho: 35,
      diametro_interior: 0.013,
      diametro_exterior: 0.015,
      conductividad_pared_k: 110,
      area_m2: 10,
    };
    const r = solveExchanger(data);
    const esperado = overallUFromHiHo(9500, 35, data).U;
    expect(r.U).toBeCloseTo(esperado, 6);
    // aislando SOLO el término de pared (mismos Di/Do, sin k): debe dar un U mayor
    // que con la pared incluida, porque la pared añade resistencia
    const { U: UsinPared } = overallUFromHiHo(9500, 35, { diametro_interior: 0.013, diametro_exterior: 0.015 });
    expect(r.U).toBeLessThan(UsinPared);
  });
});

describe("Incrustación dada como capa de depósito (espesor + k), no como Rf directo (fix #2)", () => {
  it("sin ningún dato de incrustación: no agrega nada (comportamiento anterior)", () => {
    const { U, Rf_i, Rf_o } = overallUFromHiHo(1000, 2000, {});
    expect(Rf_i).toBeNull();
    expect(Rf_o).toBeNull();
    expect(U).toBeCloseTo(1 / (1 / 1000 + 1 / 2000), 6);
  });

  it("factor directo (Rf) sigue funcionando igual que antes", () => {
    const { U, Rf_i } = overallUFromHiHo(1000, 2000, { factor_incrustacion_i: 0.0005 });
    expect(Rf_i).toBeCloseTo(0.0005, 9);
    expect(U).toBeCloseTo(1 / (1 / 1000 + 0.0005 + 1 / 2000), 6);
  });

  it("espesor+k de una capa de depósito (interior) se convierte a Rf = espesor/k", () => {
    const espesor = 0.002, k = 1.3; // Problema 11-25/11-26: caliza, 2mm, k=1.3
    const { U, Rf_i, foulingFromLayer_i } = overallUFromHiHo(1000, 2000, {
      incrustacion_i_espesor_m: espesor,
      incrustacion_i_k_W_mC: k,
    });
    expect(foulingFromLayer_i).toBe(true);
    expect(Rf_i).toBeCloseTo(espesor / k, 9);
    expect(U).toBeCloseTo(1 / (1 / 1000 + espesor / k + 1 / 2000), 6);
  });

  it("espesor+k del lado exterior también se corrige por la razón de áreas Di/Do", () => {
    const Di = 0.05, Do = 0.06, espesor = 0.001, k = 2;
    const { U, Rf_o } = overallUFromHiHo(1000, 2000, {
      diametro_interior: Di,
      diametro_exterior: Do,
      incrustacion_o_espesor_m: espesor,
      incrustacion_o_k_W_mC: k,
    });
    const Rfo = espesor / k;
    const areaRatio = Di / Do;
    const Uesperado = 1 / (1 / 1000 + areaRatio * Rfo + areaRatio / 2000);
    expect(Rf_o).toBeCloseTo(Rfo, 9);
    expect(U).toBeCloseTo(Uesperado, 6);
  });

  it("si se dan AMBOS formatos para el mismo lado, el valor directo (Rf) tiene prioridad", () => {
    const { Rf_i } = overallUFromHiHo(1000, 2000, {
      factor_incrustacion_i: 0.0009,
      incrustacion_i_espesor_m: 0.002,
      incrustacion_i_k_W_mC: 1.3, // esto daría 0.00154, distinto — no debe usarse
    });
    expect(Rf_i).toBeCloseTo(0.0009, 9);
  });

  it("integración con solveExchanger: agregar una capa de depósito aumenta la resistencia y baja U", () => {
    const base = {
      tipo_intercambiador: "tubo_doble",
      configuracion_flujo: "contraflujo",
      fluido_caliente: { nombre: "aceite", temp_entrada_C: 100, temp_salida_C: 80, flujo_masico_kg_s: 1, cp_kJ_kgC: 2 },
      fluido_frio: { nombre: "agua", temp_entrada_C: 25, temp_salida_C: 35, flujo_masico_kg_s: 1, cp_kJ_kgC: 4.18 },
      hi: 5000,
      ho: 2000,
      diametro_interior: 0.015,
      area_m2: 10,
    };
    const sinCapa = solveExchanger(base);
    const conCapa = solveExchanger({ ...base, incrustacion_o_espesor_m: 0.002, incrustacion_o_k_W_mC: 1.3 });
    expect(conCapa.U).toBeLessThan(sinCapa.U);
  });
});

describe("Convección automática con flujo cruzado externo sobre un cilindro (fix #3)", () => {
  it("resuelve hᵢ (velocidad interna) y h₀ (flujo cruzado externo) y los combina en U con la pared/incrustación de los fixes anteriores", () => {
    const data = {
      tipo_intercambiador: "tubo_doble",
      configuracion_flujo: "contraflujo",
      fluido_caliente: { nombre: "agua", temp_entrada_C: 82.2, temp_salida_C: 57.2, velocidad_m_s: 1.2192, tipo_fluido: "agua", cambio_fase: false }, // ~180°F->135°F, 4ft/s
      fluido_frio: { nombre: "aire", temp_entrada_C: 26.7, tipo_fluido: "aire", cambio_fase: false, cp_kJ_kgC: 1.007 },
      requiere_correlacion_convectiva: true,
      fluido_por_tubo: "caliente",
      configuracion_lado_externo: "flujo_cruzado_cilindro",
      velocidad_externa_m_s: 3.657, // aire a 12 ft/s
      diametro_interior: 0.019,
      diametro_exterior: 0.019,
      area_m2: 1,
    };
    const r = solveExchanger(data);
    // no debe pedir más datos de convección: ambos h se resolvieron
    expect(r.needsConvection).toBeFalsy();
    expect(r.U).toBeGreaterThan(0);
    // el aviso debe mencionar Churchill-Bernstein para h0 y no confundirlo con Dittus-Boelter/ánulo
    const avisos = r.warnings.join(" ");
    expect(avisos).toMatch(/Churchill-Bernstein/);
  });
});

describe("Ejemplo 11-3 del libro: condensador (LMTD, ambos gastos másicos desconocidos)", () => {
  const data = {
    tipo_intercambiador: "tubo_doble",
    configuracion_flujo: "contraflujo",
    fluido_caliente: { nombre: "vapor de agua", temp_entrada_C: 30, temp_salida_C: 30, cambio_fase: true, hfg_kJ_kg: 2431 },
    fluido_frio: { nombre: "agua de enfriamiento", temp_entrada_C: 14, temp_salida_C: 22, cp_kJ_kgC: 4.18 },
    coeficiente_U_W_m2C: 2100,
    area_m2: 45,
  };
  const r = solveExchanger(data);

  it("calcula la LMTD correcta", () => expect(r.dTml).toBeCloseTo(11.5, 1));
  it("calcula Q correcto", () => expect(r.Q / 1000).toBeCloseTo(1087, -1));
  it("despeja el gasto de agua de enfriamiento", () => expect(r.cold.flujo_masico_kg_s).toBeCloseTo(32.5, 0));
  it("despeja el gasto de condensación del vapor", () => expect(r.hot.flujo_masico_kg_s).toBeCloseTo(0.45, 1));
});

describe("Ejemplo 11-4 del libro: tubo doble a contraflujo (LMTD, Th_out se rellena por balance)", () => {
  const data = {
    tipo_intercambiador: "tubo_doble",
    configuracion_flujo: "contraflujo",
    fluido_caliente: { nombre: "agua geotérmica", temp_entrada_C: 160, flujo_masico_kg_s: 2, cp_kJ_kgC: 4.31 },
    fluido_frio: { nombre: "agua", temp_entrada_C: 20, temp_salida_C: 80, flujo_masico_kg_s: 1.2, cp_kJ_kgC: 4.18 },
    coeficiente_U_W_m2C: 640,
    diametro_interior: 0.015,
  };
  const r = solveExchanger(data);

  it("despeja Th_out por balance de energía", () => expect(r.Th_out).toBeCloseTo(125, 0));
  it("calcula Q correcto", () => expect(r.Q / 1000).toBeCloseTo(301, 0));
  it("calcula la LMTD correcta", () => expect(r.dTml).toBeCloseTo(91.9, 0));
  it("calcula el área requerida", () => expect(r.As).toBeCloseTo(5.12, 1));
  it("calcula la longitud requerida", () => expect(r.L).toBeCloseTo(109, -1));
});

describe("Ejemplo 11-9 del libro: 1 paso coraza / 8 pasos tubos (método NTU)", () => {
  const data = {
    tipo_intercambiador: "tubos_coraza",
    configuracion_flujo: "contraflujo",
    pasos_coraza: 1,
    pasos_tubos: 8,
    fluido_caliente: { nombre: "aceite", temp_entrada_C: 150, flujo_masico_kg_s: 0.3, cp_kJ_kgC: 2.13 },
    fluido_frio: { nombre: "agua", temp_entrada_C: 20, flujo_masico_kg_s: 0.2, cp_kJ_kgC: 4.18 },
    coeficiente_U_W_m2C: 310,
    area_m2: 1.76,
  };
  const r = solveExchanger(data);

  it("identifica Cmin correcto", () => expect(r.Cmin / 1000).toBeCloseTo(0.639, 2));
  it("calcula C = Cmin/Cmax", () => expect(r.C).toBeCloseTo(0.764, 2));
  it("calcula NTU correcto", () => expect(r.NTU).toBeCloseTo(0.854, 1));
  // el libro lee epsilon=0.47 de una gráfica; la fórmula exacta de la Tabla 11-4 da ~0.462
  // (el propio libro dice que la fórmula es "más exacta pero con más trabajo" que la gráfica)
  it("calcula una efectividad físicamente consistente (fórmula exacta, no lectura de gráfica)", () => {
    expect(r.eps).toBeGreaterThan(0.44);
    expect(r.eps).toBeLessThan(0.48);
  });
  it("temperaturas de salida razonablemente cercanas a las del libro (±1.5°C; el resto de diferencia es lectura de gráfica vs. fórmula exacta, ver test de efectividad arriba)", () => {
    expect(Math.abs(r.Tc_out - 66.8)).toBeLessThan(1.5);
    expect(Math.abs(r.Th_out - 88.8)).toBeLessThan(1.5);
  });
});

describe("Factor de corrección F (fórmula de Underwood)", () => {
  it("F=1 en el límite de cambio de fase (R=0)", () => {
    expect(correctionFactorF(0.5, 0)).toBeCloseTo(1, 3);
  });
  it("F queda entre 0 y 1 en un caso normal", () => {
    const F = correctionFactorF(0.3, 1);
    expect(F).toBeGreaterThan(0.9);
    expect(F).toBeLessThanOrEqual(1);
  });
  it("devuelve null en un caso no factible (P demasiado alto)", () => {
    expect(correctionFactorF(0.97, 3)).toBeNull();
  });
});

describe("Perfil de temperatura respeta las condiciones de frontera (contraflujo)", () => {
  const pts = generateProfile(false, 160, 125, 20, 80, 2 * 4310, 1.2 * 4180, 301000, 20);
  it("en x=0 el fluido caliente está en su entrada y el frío en su salida", () => {
    expect(pts[0].Th).toBeCloseTo(160, 0);
    expect(pts[0].Tc).toBeCloseTo(80, 0);
  });
  it("en x=100% el fluido caliente está en su salida y el frío en su entrada", () => {
    expect(pts[pts.length - 1].Th).toBeCloseTo(125, 0);
    expect(pts[pts.length - 1].Tc).toBeCloseTo(20, 0);
  });
  it("Th siempre es mayor que Tc a lo largo de todo el intercambiador", () => {
    pts.forEach((p) => expect(p.Th).toBeGreaterThan(p.Tc));
  });
});

describe("Problema 11-94: 2 pasos por la coraza, 12 pasos por los tubos (regresión de los 2 bugs reportados)", () => {
  const data = {
    tipo_intercambiador: "tubos_coraza",
    configuracion_flujo: "contraflujo",
    pasos_coraza: 2,
    pasos_tubos: 12,
    fluido_caliente: { nombre: "aceite", temp_entrada_C: 160, flujo_masico_kg_s: 0.2, cp_kJ_kgC: 2.2 },
    fluido_frio: { nombre: "agua", temp_entrada_C: 18, flujo_masico_kg_s: 0.1, cp_kJ_kgC: 4.18 },
    coeficiente_U_W_m2C: 340,
    diametro_interior: 0.018,
    longitud_m: 3,
    longitud_por_paso: true, // "la longitud de CADA PASO... es de 3 m" -> hay 12 pasos
  };
  const r = solveExchanger(data);

  it("bug #1: el área usa la longitud TOTAL del tubo (3m × 12 pasos = 36m), no solo un paso", () => {
    expect(r.L).toBeCloseTo(36, 0);
    expect(r.As).toBeCloseTo(2.036, 2); // pi * 0.018 * 36
  });

  it("bug #2: usa la fórmula de 2 pasos por la coraza, no la de 1 paso", () => {
    // con la fórmula (incorrecta) de 1 solo paso, para este NTU≈1.656 y C≈0.95
    // la efectividad da distinto a la de 2 pasos combinados
    const NTU = (340 * r.As) / r.Cmin;
    const eps1paso = effectivenessTubosCorazaN(NTU, r.C, 1);
    expect(r.eps).not.toBeCloseTo(eps1paso, 2);
    expect(r.eps).toBeCloseTo(0.608, 2);
  });

  it("da temperaturas de salida físicamente consistentes", () => {
    expect(r.Th_out).toBeCloseTo(77.9, 0);
    expect(r.Tc_out).toBeCloseTo(104.4, 0);
    expect(r.Th_out).toBeGreaterThan(r.Tc_in);
    expect(r.Tc_out).toBeLessThan(r.Th_in);
  });

  it("calor transferido coherente con el balance de energía de ambos fluidos", () => {
    const Ch = 0.2 * 2200;
    const Cc = 0.1 * 4180;
    const Qh = Ch * (r.Th_in - r.Th_out);
    const Qc = Cc * (r.Tc_out - r.Tc_in);
    expect(Qh).toBeCloseTo(Qc, -2); // deben coincidir entre sí (balance de energía)
    expect(r.Q).toBeCloseTo(Qh, -2);
  });
});

describe("Caso de repaso: longitud total (no por paso) no se multiplica de más", () => {
  it("si longitud_por_paso=false, no multiplica por el número de pasos", () => {
    const data = {
      tipo_intercambiador: "tubos_coraza",
      configuracion_flujo: "contraflujo",
      pasos_coraza: 2,
      pasos_tubos: 4,
      fluido_caliente: { nombre: "agua caliente", temp_entrada_C: 80, temp_salida_C: 40, cp_kJ_kgC: 4.18 },
      fluido_frio: { nombre: "glicerina", temp_entrada_C: 20, temp_salida_C: 50, cp_kJ_kgC: 2.48 },
      coeficiente_U_W_m2C: 25,
      diametro_interior: 0.02,
      longitud_m: 60, // longitud TOTAL ya dada (como en el Ejemplo 11-5 del libro)
      longitud_por_paso: false,
    };
    const r = solveExchanger(data);
    expect(r.As).toBeCloseTo(Math.PI * 0.02 * 60, 2); // NO multiplicado por 4
  });
});


describe("Problema 11-43: pérdida de calor, fluido frío completamente desconocido (caso reportado por el usuario)", () => {
  const data = {
    tipo_intercambiador: "tubo_doble",
    configuracion_flujo: "paralelo",
    fluido_caliente: { nombre: "agua caliente", temp_entrada_C: 85, temp_salida_C: 50, flujo_masico_kg_s: 1.4, cp_kJ_kgC: 4.25 },
    fluido_frio: { nombre: "agua fría", cp_kJ_kgC: 4.18 }, // sin temperaturas ni gasto másico
    coeficiente_U_W_m2C: 1150,
    area_m2: 4,
    perdida_calor_porcentaje: 3,
  };
  const r = solveExchanger(data);

  it("no debe devolver error: hay suficiente información sin conocer nada del fluido frío", () => {
    expect(r.error).toBeUndefined();
  });

  it("calcula Q liberado por el fluido caliente (antes de pérdidas)", () => {
    expect(r.Q_liberado / 1000).toBeCloseTo(208.25, 1);
  });

  it("calcula Q recibido por el agua fría (97% del liberado)", () => {
    expect(r.Q / 1000).toBeCloseTo(202.0, 1);
  });

  it("despeja ΔTml directamente de Q=UAsΔTml, sin necesitar las temperaturas del fluido frío", () => {
    expect(r.dTml).toBeCloseTo(43.91, 1);
    expect(r.Tc_in).toBeNull();
    expect(r.Tc_out).toBeNull();
  });
});

describe("Caso de datos insuficientes (NTU sin U ni As)", () => {
  it("devuelve un error claro en vez de reventar", () => {
    const r = solveExchanger({
      tipo_intercambiador: "tubo_doble",
      configuracion_flujo: "contraflujo",
      fluido_caliente: { nombre: "aceite", temp_entrada_C: 150, flujo_masico_kg_s: 0.3, cp_kJ_kgC: 2.1 },
      fluido_frio: { nombre: "agua", temp_entrada_C: 20, flujo_masico_kg_s: 0.2, cp_kJ_kgC: 4.18 },
    });
    expect(r.error).toBeTruthy();
  });
});
