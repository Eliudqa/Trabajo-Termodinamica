import { useMemo, useId } from "react";
import { Flame, Snowflake, ArrowRightLeft, Wind } from "lucide-react";
import { isNum } from "../engine.js";

// ============================================================
// Simulación visual (SVG animado) de lo que está pasando dentro
// del intercambiador: hacia dónde va cada fluido y qué tan
// caliente/frío está en cada punto, a partir de las 4 temperaturas
// y la configuración de flujo ya resueltas por el motor.
//
// No hace ningún cálculo nuevo — sólo dibuja el resultado que ya
// tiene `solution` (Th_in/out, Tc_in/out, configKey, isParallel).
// ============================================================

const fmt = (x) => (isNum(x) ? x.toFixed(1) : "—");

// Mapea una temperatura a una opacidad 0.32–0.95 dentro del rango
// [Tmin, Tmax] de ESTE ejercicio, para que el tubo se vea más "cargado"
// donde el fluido está más caliente, sin necesitar saber colores exactos.
function makeOpacityScale(temps) {
  const nums = temps.filter(isNum);
  if (!nums.length) return () => 0.6;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const range = hi - lo || 1;
  return (t) => {
    if (!isNum(t)) return 0.5;
    const frac = Math.min(Math.max((t - lo) / range, 0), 1);
    return 0.32 + frac * 0.63;
  };
}

function FlowParticles({ id, pathD, count, duration, color, reverse, size = 4.2 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const delay = -(duration / count) * i;
        return (
          <circle key={i} r={size} fill={color} opacity={0.9}>
            <animateMotion
              dur={`${duration}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
              keyPoints={reverse ? "1;0" : "0;1"}
              keyTimes="0;1"
              calcMode="linear"
              path={pathD}
            />
          </circle>
        );
      })}
    </>
  );
}

function ArrowHead({ x, y, dir, color }) {
  // dir: "right" | "left" | "down"
  const shapes = {
    right: `M ${x - 7},${y - 5} L ${x + 5},${y} L ${x - 7},${y + 5} Z`,
    left: `M ${x + 7},${y - 5} L ${x - 5},${y} L ${x + 7},${y + 5} Z`,
    down: `M ${x - 5},${y - 7} L ${x},${y + 5} L ${x + 5},${y - 7} Z`,
  };
  return <path d={shapes[dir]} fill={color} opacity={0.85} />;
}

export default function HeatExchangerSimulation({ solution }) {
  const uid = useId().replace(/[:]/g, "");
  const s = solution;

  const layout = useMemo(() => {
    if (!s || s.error) return null;
    if (s.configKey?.startsWith("cruzado")) return "cruzado";
    return "lineal"; // paralelo, contraflujo, tubos_coraza_1paso
  }, [s]);

  if (!s || s.error || !layout) return null;

  const hotName = s.hot?.nombre || "Fluido caliente";
  const coldName = s.cold?.nombre || "Fluido frío";
  const opacityOf = makeOpacityScale([s.Th_in, s.Th_out, s.Tc_in, s.Tc_out]);

  const W = 640, H = layout === "cruzado" ? 260 : 220;
  const padX = 60;

  return (
    <div className="hxs-card">
      <div className="hxs-section-title">
        <ArrowRightLeft size={15} color="var(--copper)" /> Simulación del intercambiador
        <span className="hxs-badge" style={{ marginLeft: "auto" }}>
          {s.configKey === "paralelo" && "Flujo paralelo"}
          {s.configKey === "contraflujo" && "Contraflujo"}
          {s.configKey === "tubos_coraza_1paso" && "Coraza y tubos"}
          {s.configKey?.startsWith("cruzado") && "Flujo cruzado"}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`hotgrad-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--copper)" stopOpacity={opacityOf(s.Th_in)} />
            <stop offset="100%" stopColor="var(--copper)" stopOpacity={opacityOf(s.Th_out)} />
          </linearGradient>
          <linearGradient id={`coldgrad-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop
              offset="0%"
              stopColor="var(--steel)"
              stopOpacity={opacityOf(layout === "lineal" && s.isParallel ? s.Tc_in : s.Tc_out)}
            />
            <stop
              offset="100%"
              stopColor="var(--steel)"
              stopOpacity={opacityOf(layout === "lineal" && s.isParallel ? s.Tc_out : s.Tc_in)}
            />
          </linearGradient>
          <linearGradient id={`coldgrad-v-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--steel)" stopOpacity={opacityOf(s.Tc_in)} />
            <stop offset="100%" stopColor="var(--steel)" stopOpacity={opacityOf(s.Tc_out)} />
          </linearGradient>
        </defs>

        {layout === "lineal" && (
          <>
            {s.configKey === "tubos_coraza_1paso" && (
              <rect x={padX - 22} y={30} width={W - 2 * (padX - 22)} height={H - 60} rx={26} fill="none" stroke="var(--ink-dim)" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 4" />
            )}

            {/* tubo caliente (arriba) */}
            <rect x={padX} y={52} width={W - 2 * padX} height={34} rx={17} fill={`url(#hotgrad-${uid})`} />
            <FlowParticles
              pathD={`M ${padX + 10},69 L ${W - padX - 10},69`}
              count={5}
              duration={3.2}
              color="var(--copper)"
              reverse={false}
            />
            <ArrowHead x={W - padX + 4} y={69} dir="right" color="var(--copper)" />

            {/* tubo frío (abajo) */}
            <rect x={padX} y={H - 86} width={W - 2 * padX} height={34} rx={17} fill={`url(#coldgrad-${uid})`} />
            <FlowParticles
              pathD={`M ${padX + 10},${H - 69} L ${W - padX - 10},${H - 69}`}
              count={5}
              duration={3.6}
              color="var(--steel)"
              reverse={!s.isParallel}
            />
            <ArrowHead
              x={s.isParallel ? W - padX + 4 : padX - 4}
              y={H - 69}
              dir={s.isParallel ? "right" : "left"}
              color="var(--steel)"
            />

            {/* etiquetas */}
            <text x={padX} y={40} fontSize="11" fill="var(--ink-dim)" fontFamily="'JetBrains Mono', monospace">
              {hotName} · {fmt(s.Th_in)}°C
            </text>
            <text x={W - padX} y={40} fontSize="11" fill="var(--ink-dim)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
              {fmt(s.Th_out)}°C
            </text>
            <text x={s.isParallel ? padX : W - padX} y={H - 12} fontSize="11" fill="var(--ink-dim)" textAnchor={s.isParallel ? "start" : "end"} fontFamily="'JetBrains Mono', monospace">
              {coldName} · {fmt(s.Tc_in)}°C
            </text>
            <text x={s.isParallel ? W - padX : padX} y={H - 12} fontSize="11" fill="var(--ink-dim)" textAnchor={s.isParallel ? "end" : "start"} fontFamily="'JetBrains Mono', monospace">
              {fmt(s.Tc_out)}°C
            </text>
          </>
        )}

        {layout === "cruzado" && (
          <>
            {/* banco de tubos horizontal (fluido "interno") */}
            <rect x={padX} y={H / 2 - 17} width={W - 2 * padX} height={34} rx={17} fill={`url(#hotgrad-${uid})`} />
            <FlowParticles
              pathD={`M ${padX + 10},${H / 2} L ${W - padX - 10},${H / 2}`}
              count={5}
              duration={3.2}
              color="var(--copper)"
              reverse={false}
            />
            <ArrowHead x={W - padX + 4} y={H / 2} dir="right" color="var(--copper)" />

            {/* flujo externo cruzado (vertical), 3 columnas */}
            {[0.28, 0.5, 0.72].map((f, i) => {
              const x = padX + f * (W - 2 * padX);
              return (
                <g key={i}>
                  <rect x={x - 9} y={16} width={18} height={H - 32} rx={9} fill={`url(#coldgrad-v-${uid})`} opacity={0.55} />
                  <FlowParticles pathD={`M ${x},26 L ${x},${H - 26}`} count={3} duration={2.4} color="var(--steel)" reverse={false} size={3.4} />
                </g>
              );
            })}
            <ArrowHead x={padX + 0.5 * (W - 2 * padX)} y={H - 14} dir="down" color="var(--steel)" />

            <text x={padX} y={H / 2 - 26} fontSize="11" fill="var(--ink-dim)" fontFamily="'JetBrains Mono', monospace">
              {hotName} · {fmt(s.Th_in)}°C → {fmt(s.Th_out)}°C
            </text>
            <text x={padX} y={16} fontSize="11" fill="var(--ink-dim)" fontFamily="'JetBrains Mono', monospace">
              {coldName} (cruzado) · {fmt(s.Tc_in)}°C → {fmt(s.Tc_out)}°C
            </text>
          </>
        )}
      </svg>

      <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "var(--ink-dim)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Flame size={12} color="var(--copper)" /> {hotName}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Snowflake size={12} color="var(--steel)" /> {coldName}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
          <Wind size={12} /> el color más intenso = más caliente en ese punto
        </span>
      </div>
    </div>
  );
}
