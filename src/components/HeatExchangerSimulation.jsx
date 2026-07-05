import { useMemo, useId } from "react";
import { Flame, Snowflake, ArrowRightLeft } from "lucide-react";
import { isNum } from "../engine.js";

// ============================================================
// Simulación visual (SVG animado) del intercambiador.
//
// Principios de diseño (por feedback):
// - Geometría limpia y plana: la coraza es UNA forma de dos tonos
//   sólidos (borde + relleno), sin transparencias apiladas que se
//   vean como una nube.
// - Las flechas NUNCA se colocan a mano con un ángulo fijo: son
//   triángulos que viajan por el mismo <path> del fluido usando
//   <animateMotion rotate="auto">, así que si el tubo gira, la
//   flecha gira con él automáticamente.
// - El color varía según temperatura (más caliente = tono más claro
//   del mismo color, no solo opacidad), siempre con colores planos.
// - En los dos extremos de cada tubería el trazo llega exactamente
//   hasta la punta, para que las flechas animadas se vean "entrando"
//   o "saliendo" del dibujo, no perdidas en la mitad.
//
// Las temperaturas SIEMPRE se leen de solution.Th_in/Th_out/Tc_in/Tc_out
// (ya resueltas) — nunca de fluid.temp_entrada_C/temp_salida_C, porque
// ese es el dato crudo del enunciado y viene vacío justo cuando esa
// temperatura es la incógnita.
// ============================================================

const fmt = (x) => (isNum(x) ? x.toFixed(1) : "—");
const fmtFlow = (x) => (isNum(x) ? `${parseFloat(x.toFixed(4))}` : null);

// Tintes claros de los mismos colores de marca — "más caliente" se ve
// como una versión más clara/brillante del mismo color, no otro color.
const TINT = { copper: "#F2B489", steel: "#AFD0DD" };

// Decide qué extremo del gradiente recibe el tinte "caliente": el que
// tenga el valor numérico más alto, sin importar si es la entrada o
// la salida geométrica del dibujo.
function gradientEnds(valAtStart, valAtEnd, baseVar, tintHex) {
  if (!isNum(valAtStart) || !isNum(valAtEnd) || valAtStart === valAtEnd) return [baseVar, baseVar];
  return valAtStart > valAtEnd ? [tintHex, baseVar] : [baseVar, tintHex];
}

// Triángulo que viaja por `pathD` girando para quedar siempre tangente
// a la curva (si el tubo dobla, la flecha dobla con él). `fadeIn`/`fadeOut`
// hacen que aparezca/desaparezca justo en los extremos del camino, para
// simular que el fluido "entra" o "cae" en vez de cortarse de golpe.
function FlowArrows({ pathD, count = 4, duration = 4.5, color, size = 8, fadeIn = false, fadeOut = false }) {
  const w = size, h = size * 0.85;
  let opacityValues = null, opacityKeyTimes = null;
  if (fadeIn && fadeOut) {
    opacityValues = "0;1;1;0";
    opacityKeyTimes = "0;0.18;0.82;1";
  } else if (fadeIn) {
    opacityValues = "0;1;1";
    opacityKeyTimes = "0;0.22;1";
  } else if (fadeOut) {
    opacityValues = "1;1;0";
    opacityKeyTimes = "0;0.78;1";
  }
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const delay = -(duration / count) * i;
        return (
          <path key={i} d={`M ${-w * 0.35},${-h / 2} L ${w * 0.65},0 L ${-w * 0.35},${h / 2} Z`} fill={color}>
            <animateMotion dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" rotate="auto" path={pathD} />
            {opacityValues && (
              <animate attributeName="opacity" values={opacityValues} keyTimes={opacityKeyTimes} dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
            )}
          </path>
        );
      })}
    </>
  );
}

function ArrowHead({ x, y, dir, color, size = 7 }) {
  const s = size;
  const shapes = {
    right: `M ${x - s},${y - s * 0.75} L ${x + s * 0.5},${y} L ${x - s},${y + s * 0.75} Z`,
    left: `M ${x + s},${y - s * 0.75} L ${x - s * 0.5},${y} L ${x + s},${y + s * 0.75} Z`,
    down: `M ${x - s * 0.75},${y - s} L ${x},${y + s * 0.5} L ${x + s * 0.75},${y - s} Z`,
    up: `M ${x - s * 0.75},${y + s} L ${x},${y - s * 0.5} L ${x + s * 0.75},${y + s} Z`,
  };
  return <path d={shapes[dir]} fill={color} />;
}

function StackedLabel({ x, y, anchor = "start", lines, dy = 13 }) {
  if (!lines.length) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize="11" fill="var(--ink-dim)" fontFamily="'JetBrains Mono', monospace">
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : dy}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function CondensateMark({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M -9,0 q4.5,-7 9,0 q4.5,7 9,0" fill="none" stroke="var(--ink-dim)" strokeWidth="1.6" strokeLinecap="round" />
      <text x="0" y="19" fontSize="10" fill="var(--ink-dim)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
        condensado
      </text>
    </g>
  );
}

function fluidLines(fluid, temp, flow) {
  const lines = [];
  if (fluid?.nombre) lines.push(fluid.nombre);
  lines.push(`${fmt(temp)}°C`);
  const f = fmtFlow(flow);
  if (f) lines.push(`${f} kg/s`);
  return lines;
}

function isCondensingExit(fluid, tempOut) {
  return !!fluid?.cambio_fase && !isNum(tempOut);
}

// Camino serpenteante DENTRO de la coraza: entra en xLeftIn en la fila 0
// y va de ida y vuelta ys.length veces. IMPAR de pasos → termina del
// lado opuesto a la entrada; PAR → termina del mismo lado.
function buildSerpentine(xLeftIn, xRightIn, ys, bendR) {
  let d = `M ${xLeftIn},${ys[0]} `;
  let goingRight = true;
  for (let i = 0; i < ys.length; i++) {
    if (goingRight) {
      d += `L ${xRightIn},${ys[i]} `;
      if (i < ys.length - 1) d += `C ${xRightIn + bendR},${ys[i]} ${xRightIn + bendR},${ys[i + 1]} ${xRightIn},${ys[i + 1]} `;
    } else {
      d += `L ${xLeftIn},${ys[i]} `;
      if (i < ys.length - 1) d += `C ${xLeftIn - bendR},${ys[i]} ${xLeftIn - bendR},${ys[i + 1]} ${xLeftIn},${ys[i + 1]} `;
    }
    goingRight = !goingRight;
  }
  const exitSide = ys.length % 2 === 1 ? "right" : "left";
  return { d, exitSide };
}

export default function HeatExchangerSimulation({ solution, data }) {
  const uid = useId().replace(/[:]/g, "");
  const s = solution;

  const tipoEfectivo =
    data?.tipo_intercambiador ||
    (s?.configKey?.startsWith("cruzado") ? "flujo_cruzado" : s?.configKey === "tubos_coraza_1paso" ? "tubos_coraza" : "tubo_doble");

  const layout = useMemo(() => {
    if (!s || s.error) return null;
    if (tipoEfectivo === "flujo_cruzado") return "cruzado";
    return "coraza"; // tubo_doble y tubos_coraza comparten el mismo renderizador:
    // un tubo doble ES un intercambiador de coraza-y-tubo de un solo paso.
  }, [s, tipoEfectivo]);

  if (!s || s.error || !layout) return null;

  const hotName = s.hot?.nombre || "Fluido caliente";
  const coldName = s.cold?.nombre || "Fluido frío";
  const W = 720;
  const isDoubleTube = tipoEfectivo === "tubo_doble";

  const badgeParts = [];
  if (layout === "coraza") badgeParts.push(isDoubleTube ? "Tubo doble" : "Coraza y tubos");
  else if (layout === "cruzado") badgeParts.push("Flujo cruzado");
  if (s.configKey === "paralelo") badgeParts.push("Flujo paralelo");
  else if (s.configKey === "contraflujo" || s.configKey === "tubos_coraza_1paso") badgeParts.push("Contraflujo");
  if (layout === "coraza" && !isDoubleTube) {
    if (isNum(data?.pasos_tubos) && data.pasos_tubos > 1) badgeParts.push(`${Math.round(data.pasos_tubos)} pasos/tubos`);
    if (isNum(data?.pasos_coraza) && data.pasos_coraza > 1) badgeParts.push(`${Math.round(data.pasos_coraza)} pasos/coraza`);
  }

  const tubeIsHot = data?.fluido_por_tubo !== "frio";
  const tubeFluid = tubeIsHot ? s.hot : s.cold;
  const shellFluid = tubeIsHot ? s.cold : s.hot;
  const tubeTempIn = tubeIsHot ? s.Th_in : s.Tc_in;
  const tubeTempOut = tubeIsHot ? s.Th_out : s.Tc_out;
  const shellTempIn = tubeIsHot ? s.Tc_in : s.Th_in;
  const shellTempOut = tubeIsHot ? s.Tc_out : s.Th_out;
  const tubeColor = tubeIsHot ? "var(--copper)" : "var(--steel)";
  const shellColor = tubeIsHot ? "var(--steel)" : "var(--copper)";
  const tubeTint = tubeIsHot ? TINT.copper : TINT.steel;
  const shellTint = tubeIsHot ? TINT.steel : TINT.copper;
  const tubeAssignmentGuessed = !data?.fluido_por_tubo;

  let H = 240;
  let content = null;

  if (layout === "cruzado") {
    const casingX = 150, casingW = W - 300, casingH = 140;
    const colTopOuter = 74;
    const casingY = colTopOuter + 56;
    const colBottomOuter = casingY + casingH + 56;
    H = colBottomOuter + 60;
    const nTubes = 4;
    const tubeYs = Array.from({ length: nTubes }, (_, i) => casingY + 24 + i * ((casingH - 48) / (nTubes - 1)));
    const xLeftOuter = 64, xRightOuter = W - 64;
    const colXs = [0.25, 0.5, 0.75].map((f) => casingX + f * casingW);

    const [tubeC0, tubeC1] = gradientEnds(tubeTempIn, tubeTempOut, tubeColor, tubeTint);
    const [shellC0, shellC1] = gradientEnds(shellTempIn, shellTempOut, shellColor, shellTint);
    const condensing = isCondensingExit(shellFluid, shellTempOut);

    content = (
      <>
        <linearGradient id={`tubegrad-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={tubeC0} />
          <stop offset="100%" stopColor={tubeC1} />
        </linearGradient>
        <linearGradient id={`shellgrad-v-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={shellC0} />
          <stop offset="100%" stopColor={shellC1} />
        </linearGradient>

        {/* carcasa sólida — mismo lenguaje visual que la coraza y tubos */}
        <rect x={casingX} y={casingY} width={casingW} height={casingH} rx={22} fill="#2C3138" stroke="#4A525C" strokeWidth={5} />
        <rect x={casingX + 6} y={casingY + 6} width={casingW - 12} height={casingH - 12} rx={17} fill="none" stroke="#383F48" strokeWidth={2} opacity={0.7} />

        {/* banco de tubos — el fluido que va POR DENTRO de los tubos */}
        {tubeYs.map((y, i) => {
          const p = `M ${xLeftOuter},${y} L ${xRightOuter},${y}`;
          return (
            <g key={i}>
              <path d={p} fill="none" stroke={`url(#tubegrad-${uid})`} strokeWidth={9} strokeLinecap="round" />
              <FlowArrows pathD={p} count={3} duration={4} color={tubeColor} size={6} />
            </g>
          );
        })}
        <ArrowHead x={xLeftOuter + 13} y={tubeYs[0]} dir="right" color={tubeColor} size={7.5} />
        <ArrowHead x={xRightOuter - 13} y={tubeYs[0]} dir="right" color={tubeColor} size={7.5} />
        <StackedLabel x={xLeftOuter} y={tubeYs[0] - 42} lines={fluidLines(tubeFluid, tubeTempIn, tubeFluid?.flujo_masico_kg_s)} />
        <StackedLabel x={xRightOuter} y={tubeYs[0] - 42} anchor="end" lines={[`${fmt(tubeTempOut)}°C`]} />

        {/* fluido cruzado — pasa perpendicular, por FUERA de los tubos */}
        {colXs.map((x, i) => {
          const p = `M ${x},${colTopOuter} L ${x},${colBottomOuter}`;
          return (
            <g key={i}>
              <path d={p} fill="none" stroke={`url(#shellgrad-v-${uid})`} strokeWidth={8} strokeLinecap="round" opacity={0.9} />
              <FlowArrows pathD={p} count={2} duration={2.6} color={shellColor} size={6.5} fadeIn={i === 1} fadeOut={i === 1} />
            </g>
          );
        })}
        <ArrowHead x={colXs[1]} y={casingY - 6} dir="down" color={shellColor} size={7.5} />
        <ArrowHead x={colXs[1]} y={casingY + casingH + 44} dir="down" color={shellColor} size={7.5} />
        <StackedLabel x={colXs[1]} y={12} anchor="middle" lines={fluidLines(shellFluid, shellTempIn, shellFluid?.flujo_masico_kg_s)} />
        {condensing ? (
          <CondensateMark x={colXs[1]} y={colBottomOuter + 20} />
        ) : (
          <StackedLabel x={colXs[1]} y={colBottomOuter + 34} anchor="middle" lines={[`${fmt(shellTempOut)}°C`]} />
        )}
      </>
    );
  }

  if (layout === "coraza") {
    const truePasses = isDoubleTube ? 1 : isNum(data?.pasos_tubos) && data.pasos_tubos > 0 ? Math.round(data.pasos_tubos) : 1;
    const maxDrawn = 5;
    const visualPasses = truePasses > maxDrawn ? (truePasses % 2 === 0 ? 4 : 5) : truePasses;
    const simplified = visualPasses !== truePasses;

    const rowH = 44;
    const shellThick = 70;
    const halfThick = shellThick / 2;
    const topMargin = 120;
    const bottomMargin = 158;

    const ys = Array.from({ length: visualPasses }, (_, i) => topMargin + halfThick + i * rowH);
    const shellTopY = ys[0] - halfThick;
    const shellBottomY = ys[ys.length - 1] + halfThick;
    H = shellBottomY + bottomMargin;

    const xLeftOuter = 64, xRightOuter = W - 64;
    const xLeftIn = xLeftOuter + 108, xRightIn = xRightOuter - 108;
    const shellX = xLeftIn - halfThick, shellRight = xRightIn + halfThick, shellW = shellRight - shellX;

    const { d: innerPath, exitSide } = buildSerpentine(xLeftIn, xRightIn, ys, Math.max(halfThick - 6, 22));
    const entryStubD = `L ${xLeftIn},${ys[0]} `;
    const fullTubePath =
      `M ${xLeftOuter},${ys[0]} ` +
      entryStubD +
      innerPath.replace(/^M [^ ]+ /, "") +
      (exitSide === "right" ? `L ${xRightOuter},${ys[ys.length - 1]}` : `L ${xLeftOuter},${ys[ys.length - 1]}`);

    // El lado de la coraza fluye a favor (paralelo) o en contra (contraflujo)
    // del primer tramo del tubo (que siempre va de izquierda a derecha).
    const shellEntrySide = s.isParallel ? "left" : "right";
    const shellExitSide = shellEntrySide === "left" ? "right" : "left";
    const fracFor = (side) => (side === "left" ? 0.22 : 0.78);
    const shellEntryX = shellX + shellW * fracFor(shellEntrySide);
    const shellExitX = shellX + shellW * fracFor(shellExitSide);
    const shellFlowsRight = shellEntrySide === "left";

    const condensing = isCondensingExit(shellFluid, shellTempOut);
    const [tubeC0, tubeC1] = gradientEnds(tubeTempIn, tubeTempOut, tubeColor, tubeTint);

    // rutas rectas (invisibles) solo para que las flechas de la coraza
    // viajen en el sentido correcto entre cada fila del tubo
    const shellGapPaths = ys.slice(0, -1).map((y, i) => {
      const midY = (y + ys[i + 1]) / 2;
      return shellFlowsRight ? `M ${xLeftIn - 16},${midY} L ${xRightIn + 16},${midY}` : `M ${xRightIn + 16},${midY} L ${xLeftIn - 16},${midY}`;
    });
    const shellSingleRowPaths =
      visualPasses === 1
        ? [
            shellFlowsRight ? `M ${xLeftIn - 12},${ys[0] - halfThick * 0.45} L ${xRightIn + 12},${ys[0] - halfThick * 0.45}` : `M ${xRightIn + 12},${ys[0] - halfThick * 0.45} L ${xLeftIn - 12},${ys[0] - halfThick * 0.45}`,
            shellFlowsRight ? `M ${xLeftIn - 12},${ys[0] + halfThick * 0.45} L ${xRightIn + 12},${ys[0] + halfThick * 0.45}` : `M ${xRightIn + 12},${ys[0] + halfThick * 0.45} L ${xLeftIn - 12},${ys[0] + halfThick * 0.45}`,
          ]
        : [];
    const entryStubPath = `M ${shellEntryX},${shellTopY - 50} L ${shellEntryX},${shellTopY + 4}`;
    const exitStubPath = `M ${shellExitX},${shellBottomY - 4} L ${shellExitX},${shellBottomY + 56}`;

    content = (
      <>
        <linearGradient id={`tubegrad-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={tubeC0} />
          <stop offset="100%" stopColor={tubeC1} />
        </linearGradient>

        {/* coraza: la MISMA curva que el tubo, mucho más gruesa — un cuerpo
            sólido y opaco (borde + cuerpo + realce central), como una
            carcasa metálica real, no una silueta translúcida */}
        <path d={innerPath} fill="none" stroke="#4A525C" strokeWidth={shellThick + 10} strokeLinecap="round" strokeLinejoin="round" />
        <path d={innerPath} fill="none" stroke="#2C3138" strokeWidth={shellThick} strokeLinecap="round" strokeLinejoin="round" />
        <path d={innerPath} fill="none" stroke="#383F48" strokeWidth={shellThick - 20} strokeLinecap="round" strokeLinejoin="round" />

        {/* flechas del fluido de la coraza (sin líneas guía, geometría limpia) */}
        {shellGapPaths.map((p, i) => (
          <FlowArrows key={i} pathD={p} count={1} duration={3.2} color={shellColor} size={7} />
        ))}
        {shellSingleRowPaths.map((p, i) => (
          <FlowArrows key={i} pathD={p} count={2} duration={3.4} color={shellColor} size={7} />
        ))}

        {/* tubo (serpentín), un solo trazo con degradado por temperatura */}
        <path d={fullTubePath} fill="none" stroke={`url(#tubegrad-${uid})`} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
        <FlowArrows pathD={fullTubePath} count={visualPasses + 3} duration={3.6 + visualPasses * 0.8} color={tubeColor} size={8.5} />

        {/* flechas fijas de entrada y salida del tubo — siempre visibles,
            no dependen de que la animación esté en ese punto justo ahora */}
        <ArrowHead x={xLeftOuter + 14} y={ys[0]} dir="right" color={tubeColor} size={8.5} />
        <ArrowHead
          x={exitSide === "right" ? xRightOuter - 14 : xLeftOuter + 14}
          y={ys[ys.length - 1]}
          dir={exitSide === "right" ? "right" : "left"}
          color={tubeColor}
          size={8.5}
        />

        {/* tubuladura de entrada de la coraza — partículas que "aparecen"
            cayendo desde arriba hacia el cuerpo del intercambiador */}
        <path d={entryStubPath} stroke={shellColor} strokeWidth={9} opacity={0.55} strokeLinecap="round" />
        <FlowArrows pathD={entryStubPath} count={2} duration={1.8} color={shellColor} size={8} fadeIn />
        <ArrowHead x={shellEntryX} y={shellTopY + 4} dir="down" color={shellColor} size={8} />
        <StackedLabel x={shellEntryX} y={16} anchor="middle" lines={fluidLines(shellFluid, shellTempIn, shellFluid?.flujo_masico_kg_s)} />

        {/* tubuladura de salida de la coraza — partículas que caen y se
            desvanecen, como gotas saliendo del tubo */}
        <path d={exitStubPath} stroke={shellColor} strokeWidth={9} opacity={0.55} strokeLinecap="round" />
        <FlowArrows pathD={exitStubPath} count={2} duration={1.8} color={shellColor} size={8} fadeOut />
        <ArrowHead x={shellExitX} y={shellBottomY + 44} dir="down" color={shellColor} size={8} />
        {condensing ? (
          <CondensateMark x={shellExitX} y={shellBottomY + 66} />
        ) : (
          <StackedLabel x={shellExitX} y={shellBottomY + 70} anchor="middle" lines={[`${fmt(shellTempOut)}°C`]} />
        )}

        {/* etiquetas del tubo */}
        <StackedLabel x={xLeftOuter} y={ys[0] - 58} lines={fluidLines(tubeFluid, tubeTempIn, tubeFluid?.flujo_masico_kg_s)} />
        <StackedLabel
          x={exitSide === "right" ? xRightOuter : xLeftOuter}
          y={ys[ys.length - 1] + (exitSide === "right" ? -30 : 42)}
          anchor={exitSide === "right" ? "end" : "start"}
          lines={[`${fmt(tubeTempOut)}°C`]}
        />

        {simplified && (
          <text x={W / 2} y={H - 14} fontSize="10.5" fill="var(--ink-dim)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" opacity={0.75}>
            (esquema simplificado — el enunciado indica {truePasses} pasos reales por los tubos)
          </text>
        )}
      </>
    );
  }

  return (
    <div className="hxs-card">
      <div className="hxs-section-title">
        <ArrowRightLeft size={15} color="var(--copper)" /> Simulación del intercambiador
        <span className="hxs-badge" style={{ marginLeft: "auto" }}>{badgeParts.join(" · ")}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {content}
      </svg>

      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11.5, color: "var(--ink-dim)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Flame size={12} color="var(--copper)" /> {hotName}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Snowflake size={12} color="var(--steel)" /> {coldName}
        </span>
        {tubeAssignmentGuessed && (
          <span style={{ marginLeft: "auto", opacity: 0.8 }}>
            (el enunciado no especifica cuál fluido va por el tubo — se dibujó a {tubeFluid === s.hot ? hotName : coldName} por dentro; es solo visual, no cambia el cálculo)
          </span>
        )}
      </div>
    </div>
  );
}
