import { describe, it, expect } from "vitest";
import { internalTubeH, externalCylinderH, getFluidProperties } from "./convection.js";

describe("internalTubeH: ahora acepta velocidad directa además de gasto másico (fix #3)", () => {
  it("con velocidad V dada directamente, no necesita mdot", () => {
    const r = internalTubeH({ tipoFluido: "agua", tempC: 25, V: 1.2, D: 0.02, heating: false });
    expect(r).not.toBeNull();
    expect(r.V).toBeCloseTo(1.2, 9);
    expect(r.Re).toBeGreaterThan(0);
  });

  it("con mdot equivalente a esa V, da el mismo resultado (consistencia)", () => {
    const D = 0.02, V = 1.2;
    const props = getFluidProperties("agua", 25);
    const A = (Math.PI / 4) * D * D;
    const mdot = V * props.rho * A;
    const rV = internalTubeH({ tipoFluido: "agua", tempC: 25, V, D, heating: false });
    const rM = internalTubeH({ tipoFluido: "agua", tempC: 25, mdot, D, heating: false });
    expect(rV.h).toBeCloseTo(rM.h, 6);
    expect(rV.Re).toBeCloseTo(rM.Re, 6);
  });

  it("sin V ni mdot, devuelve null (no puede calcular nada)", () => {
    expect(internalTubeH({ tipoFluido: "agua", tempC: 25, D: 0.02, heating: false })).toBeNull();
  });
});

describe("externalCylinderH: flujo cruzado externo sobre un cilindro (Churchill-Bernstein, fix #3)", () => {
  it("da un h positivo y razonable para aire cruzando un tubo (Prob. 11-27 estilo)", () => {
    // aire a ~80°F≈26.7°C, V=12 ft/s≈3.66 m/s, D=3/4 in≈0.01905 m
    const r = externalCylinderH({ tipoFluido: "aire", tempC: 26.7, V: 3.657, D: 0.01905 });
    expect(r).not.toBeNull();
    expect(r.correlation).toBe("Churchill-Bernstein");
    expect(r.h).toBeGreaterThan(0);
    // orden de magnitud esperado para aire en flujo cruzado sobre un tubo pequeño: decenas de W/m2C
    expect(r.h).toBeGreaterThan(10);
    expect(r.h).toBeLessThan(200);
  });

  it("h aumenta con la velocidad (más Re -> más Nu -> más h)", () => {
    const r1 = externalCylinderH({ tipoFluido: "aire", tempC: 20, V: 2, D: 0.02 });
    const r2 = externalCylinderH({ tipoFluido: "aire", tempC: 20, V: 8, D: 0.02 });
    expect(r2.h).toBeGreaterThan(r1.h);
  });

  it("coincide con un cálculo manual de la fórmula de Churchill-Bernstein", () => {
    const tipoFluido = "aire", tempC = 20, V = 5, D = 0.03;
    const props = getFluidProperties(tipoFluido, tempC);
    const Re = (props.rho * V * D) / props.mu;
    const Pr = props.Pr;
    const term1 = (0.62 * Math.pow(Re, 0.5) * Math.pow(Pr, 1 / 3)) / Math.pow(1 + Math.pow(0.4 / Pr, 2 / 3), 0.25);
    const term2 = Math.pow(1 + Math.pow(Re / 282000, 5 / 8), 4 / 5);
    const NuEsperado = 0.3 + term1 * term2;
    const hEsperado = (NuEsperado * props.k) / D;
    const r = externalCylinderH({ tipoFluido, tempC, V, D });
    expect(r.Nu).toBeCloseTo(NuEsperado, 6);
    expect(r.h).toBeCloseTo(hEsperado, 6);
  });

  it("devuelve null si falta la velocidad o el diámetro", () => {
    expect(externalCylinderH({ tipoFluido: "aire", tempC: 20, D: 0.02 })).toBeNull();
    expect(externalCylinderH({ tipoFluido: "aire", tempC: 20, V: 5 })).toBeNull();
  });
});
