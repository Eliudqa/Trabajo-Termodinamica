// ============================================================
// Correlaciones de convección forzada interna (Dittus-Boelter) +
// tablas de propiedades, para calcular automáticamente hi/ho
// cuando el enunciado da velocidad/caudal y geometría en vez de
// un coeficiente de convección directo.
//
// LÍMITES HONESTOS de este módulo (dilo al usuario si pregunta):
// - Cubre flujo interno en tubo circular y en ánulo (tubo doble),
//   con la correlación de Dittus-Boelter (turbulento, Re>10 000)
//   y Nu=3.66 para laminar completamente desarrollado; y flujo
//   EXTERNO cruzado sobre UN cilindro aislado (Churchill-Bernstein),
//   p. ej. aire soplando perpendicular a un tubo. NO cubre
//   Gnielinski, Sieder-Tate (corrección por viscosidad de pared),
//   entrada térmica/hidrodinámica, tubos rugosos, bancos/arreglos de
//   varios tubos en flujo cruzado (correlación de Zukauskas), ni el
//   método de Kern para el lado de la coraza en haces de tubos reales
//   (tubos_coraza con muchos tubos) — para eso trata el lado de
//   la coraza como un ánulo simple, que es una aproximación.
// - Los valores de propiedades son de tablas estándar (aprox. las
//   del Apéndice 1 de Cengel) interpoladas linealmente; para
//   máxima precisión compáralos contra la tabla exacta de tu libro.
// ============================================================

const isNum = (x) => x != null && Number.isFinite(x);

// Cada fila: [T_C, rho(kg/m3), cp(kJ/kg·C), k(W/m·C), mu(Pa·s), Pr]
export const FLUID_PROPERTY_TABLES = {
  agua: [
    [0, 999.8, 4.217, 0.561, 1.792e-3, 13.5],
    [10, 999.7, 4.188, 0.580, 1.307e-3, 9.45],
    [20, 998.0, 4.182, 0.598, 1.002e-3, 7.01],
    [30, 996.0, 4.179, 0.615, 0.798e-3, 5.42],
    [40, 992.1, 4.179, 0.631, 0.653e-3, 4.32],
    [50, 988.1, 4.181, 0.644, 0.547e-3, 3.57],
    [60, 983.3, 4.185, 0.654, 0.467e-3, 2.99],
    [70, 977.5, 4.190, 0.663, 0.404e-3, 2.55],
    [80, 971.8, 4.197, 0.670, 0.355e-3, 2.21],
    [90, 965.3, 4.205, 0.675, 0.315e-3, 1.96],
    [100, 957.9, 4.216, 0.679, 0.282e-3, 1.75],
  ],
  aire: [
    [0, 1.292, 1.006, 0.02364, 1.729e-5, 0.7362],
    [20, 1.204, 1.007, 0.02514, 1.825e-5, 0.7309],
    [40, 1.127, 1.007, 0.02662, 1.918e-5, 0.7255],
    [60, 1.059, 1.007, 0.02808, 2.008e-5, 0.7202],
    [80, 0.9994, 1.008, 0.02953, 2.096e-5, 0.7166],
    [100, 0.9458, 1.009, 0.03095, 2.181e-5, 0.7111],
  ],
  aceite_motor: [
    [0, 899.1, 1.796, 0.147, 3.814, 47100],
    [20, 888.2, 1.880, 0.145, 0.800, 10400],
    [40, 876.1, 1.964, 0.144, 0.210, 2870],
    [60, 864.0, 2.047, 0.140, 0.0836, 1200],
    [80, 852.0, 2.131, 0.138, 0.0375, 490],
    [100, 840.0, 2.219, 0.137, 0.0171, 276],
    [120, 828.9, 2.307, 0.135, 0.00905, 155],
    [140, 816.9, 2.395, 0.133, 0.00518, 95.4],
  ],
  etilenglicol: [
    [0, 1130.8, 2.294, 0.242, 0.0651, 617],
    [20, 1116.7, 2.382, 0.249, 0.0157, 150],
    [40, 1101.4, 2.474, 0.256, 0.0093, 73.5],
    [60, 1087.7, 2.562, 0.260, 0.0053, 42.2],
    [80, 1077.6, 2.650, 0.261, 0.0033, 28.7],
    [100, 1058.5, 2.742, 0.263, 0.0021, 20.1],
  ],
};

export const KNOWN_FLUID_TYPES = Object.keys(FLUID_PROPERTY_TABLES);

function interpCol(table, tempC, colIdx) {
  const t = Math.min(Math.max(tempC, table[0][0]), table[table.length - 1][0]);
  for (let i = 0; i < table.length - 1; i++) {
    const t0 = table[i][0], t1 = table[i + 1][0];
    if (t >= t0 && t <= t1) {
      const frac = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return table[i][colIdx] + frac * (table[i + 1][colIdx] - table[i][colIdx]);
    }
  }
  return table[table.length - 1][colIdx];
}

/** Devuelve {rho, cp, k, mu, Pr} interpolados a tempC, o null si no hay tabla para ese tipo. */
export function getFluidProperties(tipoFluido, tempC) {
  const table = FLUID_PROPERTY_TABLES[tipoFluido];
  if (!table || !isNum(tempC)) return null;
  return {
    rho: interpCol(table, tempC, 1),
    cp: interpCol(table, tempC, 2),
    k: interpCol(table, tempC, 3),
    mu: interpCol(table, tempC, 4),
    Pr: interpCol(table, tempC, 5),
  };
}

/**
 * Densidad de un fluido a una presión distinta de la atmosférica estándar
 * (~101.325 kPa, que es a la que están referidas las tablas de arriba).
 * Solo es relevante para GASES (el aire, por ahora — el único gas tabulado
 * en este módulo): a temperatura constante, la densidad de un gas ideal es
 * directamente proporcional a la presión (ρ = P/RT → ρ2/ρ1 = P2/P1), así
 * que basta con escalar la densidad de tabla por esa razón. Para líquidos
 * (agua, aceite, etilenglicol) la presión no afecta la densidad de forma
 * apreciable en el rango de estos ejercicios, así que se ignora.
 */
const ATM_KPA = 101.325;
export function densityAtPressure(tipoFluido, tempC, presionKPa) {
  const props = getFluidProperties(tipoFluido, tempC);
  if (!props) return null;
  if (!isNum(presionKPa) || tipoFluido !== "aire") return props.rho;
  return props.rho * (presionKPa / ATM_KPA);
}

function nusseltDittusBoelter(Re, Pr, heating) {
  if (Re < 2300) return { Nu: 3.66, regime: "laminar" };
  const n = heating ? 0.4 : 0.3;
  const Nu = 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, n);
  return { Nu, regime: Re < 10000 ? "transición (Dittus-Boelter aplicado con reserva)" : "turbulento" };
}

/**
 * Flujo interno en tubo circular de diámetro D (m).
 * heating: true si ESE fluido se está calentando (usa n=0.4), false si se enfría (n=0.3).
 * Acepta el gasto másico (mdot) O directamente la velocidad media (V) cuando el
 * enunciado la da así (p. ej. "agua a 4 ft/s" en vez de un gasto másico) — si se
 * da V, se usa directamente y se ignora mdot.
 */
export function internalTubeH({ tipoFluido, tempC, mdot, V, D, heating }) {
  const props = getFluidProperties(tipoFluido, tempC);
  if (!props || !isNum(D) || D <= 0) return null;
  const A = (Math.PI / 4) * D * D;
  let velocity = isNum(V) ? V : null;
  if (velocity == null) {
    if (!isNum(mdot)) return null;
    velocity = mdot / (props.rho * A);
  }
  const Re = (props.rho * velocity * D) / props.mu;
  const { Nu, regime } = nusseltDittusBoelter(Re, props.Pr, heating);
  const h = (Nu * props.k) / D;
  return { h, Re, Pr: props.Pr, Nu, V: velocity, regime, D_used: D, props };
}

/**
 * Flujo en el ánulo entre el tubo interior (diámetro exterior Do_tubo) y la
 * coraza/casco (diámetro interior Di_coraza). Usa diámetro hidráulico.
 */
export function annulusH({ tipoFluido, tempC, mdot, Do_tubo, Di_coraza, heating }) {
  const props = getFluidProperties(tipoFluido, tempC);
  if (!props || !isNum(mdot) || !isNum(Do_tubo) || !isNum(Di_coraza) || Di_coraza <= Do_tubo) return null;
  const Dh = Di_coraza - Do_tubo;
  const A = (Math.PI / 4) * (Di_coraza * Di_coraza - Do_tubo * Do_tubo);
  const V = mdot / (props.rho * A);
  const Re = (props.rho * V * Dh) / props.mu;
  const { Nu, regime } = nusseltDittusBoelter(Re, props.Pr, heating);
  const h = (Nu * props.k) / Dh;
  return { h, Re, Pr: props.Pr, Nu, V, Dh, regime, props };
}

/**
 * Flujo EXTERNO cruzado (perpendicular) sobre un solo cilindro de diámetro D,
 * con velocidad de corriente libre V — p. ej. aire soplando perpendicular a un
 * tubo (Prob. 11-27). Correlación de Churchill-Bernstein (válida para
 * Re·Pr > 0.2, prácticamente cualquier Re de interés práctico); Nu se evalúa
 * con las propiedades del fluido a su temperatura media (film temperature más
 * simple: aquí se usa la temperatura media del fluido, como en el resto del
 * módulo, no la temperatura de película exacta pared-fluido).
 * NO cubre bancos/arreglos de tubos (para eso se necesita el factor de
 * corrección por arreglo de Zukauskas — fuera del alcance de este módulo).
 */
function nusseltChurchillBernstein(Re, Pr) {
  const term1 = (0.62 * Math.pow(Re, 0.5) * Math.pow(Pr, 1 / 3)) / Math.pow(1 + Math.pow(0.4 / Pr, 2 / 3), 0.25);
  const term2 = Math.pow(1 + Math.pow(Re / 282000, 5 / 8), 4 / 5);
  return 0.3 + term1 * term2;
}

export function externalCylinderH({ tipoFluido, tempC, V, D }) {
  const props = getFluidProperties(tipoFluido, tempC);
  if (!props || !isNum(V) || !isNum(D) || D <= 0) return null;
  const Re = (props.rho * V * D) / props.mu;
  const Nu = nusseltChurchillBernstein(Re, props.Pr);
  const h = (Nu * props.k) / D;
  return { h, Re, Pr: props.Pr, Nu, V, D_used: D, props, correlation: "Churchill-Bernstein" };
}
