import { describe, it, expect } from "vitest";
import { solveExchanger, correctionFactorF, generateProfile } from "./engine.js";

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
