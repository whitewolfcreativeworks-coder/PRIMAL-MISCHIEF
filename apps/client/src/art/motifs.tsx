/**
 * Primal Mischief — procedural card art.
 *
 * Original, hand-composed SVG "engraved museum plate" illustrations. Every motif
 * is built from simple geometric silhouettes, tonal gradients derived from the
 * civilization palette and thin accent linework. No external artwork is traced or
 * reproduced. All gradient / clip ids are namespaced per instance via useId().
 */
import { useId, type ReactNode } from 'react';

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
}

/* ------------------------------------------------------------------------ */
/* Colour utilities                                                          */
/* ------------------------------------------------------------------------ */

function parseHex(h: string): [number, number, number] | null {
  const m = h.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(m)) {
    return [0, 1, 2].map((i) => parseInt(m[i] + m[i], 16)) as [number, number, number];
  }
  if (/^[0-9a-f]{6}$/i.test(m)) {
    return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)) as [number, number, number];
  }
  return null;
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Linear blend a→b by t (0..1). Non-hex inputs fall back to `a`. */
function mix(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  if (!A || !B) return a;
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** Pull a colour toward its own luminance grey by t (0..1). */
function desat(c: string, t: number): string {
  const A = parseHex(c);
  if (!A) return c;
  const l = 0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2];
  return toHex(A[0] + (l - A[0]) * t, A[1] + (l - A[1]) * t, A[2] + (l - A[2]) * t);
}

/** Deterministic PRNG so procedural details never change between renders. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
type Pt = [number, number];
const pts = (p: Pt[]) => p.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');
const line = (p: Pt[]) => 'M' + p.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' L');

/* ------------------------------------------------------------------------ */
/* Drawing context                                                           */
/* ------------------------------------------------------------------------ */

interface Ctx {
  p: Palette;
  id: (name: string) => string;
  u: (name: string) => string;
  /** solid silhouette tone */
  dark: string;
  /** deepest ink */
  deep: string;
  /** mid tone between shade and lit, for secondary masses */
  mid: string;
}

function makeCtx(p: Palette, uid: string): Ctx {
  const id = (n: string) => `${uid}-${n}`;
  return {
    p,
    id,
    u: (n) => `url(#${id(n)})`,
    dark: mix(p.ink, p.primary, 0.22),
    deep: p.ink,
    mid: desat(mix(p.secondary, p.ink, 0.42), 0.15),
  };
}

const H = 98; // default horizon line

function Defs({ c }: { c: Ctx }) {
  const { p, id } = c;
  const skyTop = desat(mix(p.ink, p.primary, 0.22), 0.3);
  const skyMid = desat(mix(p.ink, p.primary, 0.62), 0.32);
  const skyLow = desat(mix(p.primary, p.accent, 0.38), 0.3);
  return (
    <defs>
      <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={skyTop} />
        <stop offset="0.55" stopColor={skyMid} />
        <stop offset="0.78" stopColor={skyLow} />
        <stop offset="1" stopColor={skyLow} />
      </linearGradient>
      <linearGradient id={id('lit')} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor={p.accent} />
        <stop offset="1" stopColor={p.secondary} />
      </linearGradient>
      <linearGradient id={id('litH')} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={p.accent} />
        <stop offset="1" stopColor={mix(p.secondary, p.ink, 0.15)} />
      </linearGradient>
      <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={mix(p.ink, p.secondary, 0.38)} />
        <stop offset="1" stopColor={mix(p.ink, p.primary, 0.18)} />
      </linearGradient>
      <linearGradient id={id('ground')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={desat(mix(p.ink, p.primary, 0.45), 0.25)} />
        <stop offset="1" stopColor={p.ink} />
      </linearGradient>
      <linearGradient id={id('water')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={desat(mix(p.primary, p.accent, 0.3), 0.35)} />
        <stop offset="1" stopColor={mix(p.ink, p.primary, 0.15)} />
      </linearGradient>
      <linearGradient id={id('fire')} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={mix(p.accent, '#ffffff', 0.35)} />
        <stop offset="0.5" stopColor={p.accent} />
        <stop offset="1" stopColor={p.secondary} stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id={id('beam')} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={p.accent} stopOpacity="0.55" />
        <stop offset="1" stopColor={p.accent} stopOpacity="0" />
      </linearGradient>
      <radialGradient id={id('glow')}>
        <stop offset="0" stopColor={p.accent} stopOpacity="0.6" />
        <stop offset="0.4" stopColor={p.accent} stopOpacity="0.18" />
        <stop offset="1" stopColor={p.accent} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id('vig')} cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.55" stopColor={p.ink} stopOpacity="0" />
        <stop offset="1" stopColor={p.ink} stopOpacity="0.55" />
      </radialGradient>
    </defs>
  );
}

/* ------------------------------------------------------------------------ */
/* Shared helpers                                                            */
/* ------------------------------------------------------------------------ */

/** Accent engraving stroke. */
const ln = (c: Ctx, w = 0.8, o = 0.6) => ({
  fill: 'none',
  stroke: c.p.accent,
  strokeWidth: w,
  strokeOpacity: o,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** Dark solid stroke (limbs, poles, cords). */
const dk = (c: Ctx, w = 1.6, col?: string) => ({
  fill: 'none',
  stroke: col ?? c.dark,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

function ground(c: Ctx, y = H) {
  return (
    <g>
      <rect x={-5} y={y} width={210} height={140 - y} fill={c.u('ground')} />
      <line x1={0} x2={200} y1={y} y2={y} {...ln(c, 0.6, 0.35)} />
    </g>
  );
}

function sun(c: Ctx, x: number, y: number, r: number) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 3.4} fill={c.u('glow')} />
      <circle cx={x} cy={y} r={r} fill={c.p.accent} fillOpacity={0.88} />
    </g>
  );
}

function night(c: Ctx, o = 0.5, stars = true) {
  const R = rng(91);
  let d = '';
  if (stars) {
    for (let i = 0; i < 22; i++) {
      const x = R() * 200;
      const y = R() * 60;
      d += `M${r2(x)},${r2(y)} h0.01 `;
    }
  }
  return (
    <g>
      <rect width={200} height={130} fill={c.deep} fillOpacity={o} />
      {stars && <path d={d} {...ln(c, 1.1, 0.7)} />}
    </g>
  );
}

function crescent(c: Ctx, x: number, y: number, r: number) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 3} fill={c.u('glow')} opacity={0.6} />
      <path
        d={`M${x},${y - r} A${r},${r} 0 1,0 ${x},${y + r} A${r * 0.78},${r} 0 1,1 ${x},${y - r} Z`}
        fill={c.p.accent}
        fillOpacity={0.92}
      />
    </g>
  );
}

/** Low rolling hills along the horizon. */
function hills(c: Ctx, y: number, amp: number, seed: number, opacity = 0.55) {
  const R = rng(seed);
  let d = `M-5,${y}`;
  for (let x = -5; x < 205; x += 40) {
    d += ` Q${x + 20},${r2(y - amp * (0.4 + R()))} ${x + 40},${r2(y - R() * amp * 0.3)}`;
  }
  d += ` L205,${H + 2} L-5,${H + 2} Z`;
  return <path d={d} fill={c.u('shade')} opacity={opacity} />;
}

interface FigOpts {
  /** polylines relative to the shoulder centre, in figure units */
  arms?: Pt[][];
  /** polylines relative to the hip, in figure units */
  legs?: Pt[][];
  robe?: boolean;
  fill?: string;
}

/** Elegant simplified human silhouette; (x, y) is the feet baseline. ~27 units tall. */
function figure(c: Ctx, x: number, y: number, s = 1, o: FigOpts = {}) {
  const f = o.fill ?? c.dark;
  const sy = y - 21 * s;
  const hip = y - 10 * s;
  const arms = o.arms ?? [
    [[-2.6, 0.5], [-3.8, 6], [-4, 10]],
    [[2.6, 0.5], [3.8, 6], [4, 10]],
  ];
  const legs = o.legs ?? [
    [[-1.2, 0], [-2.4, 10]],
    [[1.2, 0], [2.4, 10]],
  ];
  const body = o.robe
    ? `M${x - 3 * s},${sy} L${x + 3 * s},${sy} L${x + 5.5 * s},${y} L${x - 5.5 * s},${y} Z`
    : `M${r2(x - 3.2 * s)},${r2(sy)} L${r2(x + 3.2 * s)},${r2(sy)} L${r2(x + 1.9 * s)},${r2(hip - 2 * s)} L${r2(x + 3.2 * s)},${r2(hip + 2 * s)} L${r2(x - 3.2 * s)},${r2(hip + 2 * s)} L${r2(x - 1.9 * s)},${r2(hip - 2 * s)} Z`;
  const poly = (set: Pt[][], ox: number, oy: number) =>
    set.map((pl) => line(pl.map(([dx, dy]) => [ox + dx * s, oy + dy * s] as Pt))).join(' ');
  return (
    <g>
      <circle cx={x} cy={y - 25.2 * s} r={2.7 * s} fill={f} />
      <path d={body} fill={f} />
      <path d={poly(arms, x, sy)} {...dk(c, 1.7 * s, f)} />
      {!o.robe && <path d={poly(legs, x, hip)} {...dk(c, 2 * s, f)} />}
    </g>
  );
}

/** Tiny two-element figure for crowds. */
function tinyFig(c: Ctx, x: number, y: number, s: number, armUp = false) {
  const d = `M${x - 3 * s},${y - 19 * s} L${x + 3 * s},${y - 19 * s} L${x + 2 * s},${y - 9 * s} L${x + 3 * s},${y} L${x + 0.6 * s},${y} L${x},${y - 7 * s} L${x - 0.6 * s},${y} L${x - 3 * s},${y} L${x - 2 * s},${y - 9 * s} Z`;
  return (
    <g>
      <circle cx={x} cy={y - 22.5 * s} r={2.6 * s} fill={c.dark} />
      <path d={d} fill={c.dark} />
      {armUp && <path d={`M${x + 2.6 * s},${y - 18 * s} l${3 * s},${-8 * s}`} {...dk(c, 1.5 * s)} />}
    </g>
  );
}

/** Spear shaft with a small leaf blade at (x2, y2). */
function spear(c: Ctx, x1: number, y1: number, x2: number, y2: number, w = 0.9) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const tip: Pt = [x2 + ux * 5, y2 + uy * 5];
  const a: Pt = [x2 + ux * 1.5 - uy * 1.3, y2 + uy * 1.5 + ux * 1.3];
  const b: Pt = [x2 + ux * 1.5 + uy * 1.3, y2 + uy * 1.5 - ux * 1.3];
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} {...dk(c, w)} />
      <polygon points={pts([[x2, y2], a, tip, b])} fill={c.p.accent} />
    </g>
  );
}

function roundShield(c: Ctx, x: number, y: number, r: number) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={c.u('lit')} stroke={c.dark} strokeWidth={1.2} />
      <circle cx={x} cy={y} r={r * 0.72} {...ln(c, 0.7, 0.55)} stroke={c.dark} />
      <circle cx={x} cy={y} r={r * 0.2} fill={c.mid} />
    </g>
  );
}

function sheaf(c: Ctx, x: number, y: number, s = 1) {
  const P = (dx: number, dy: number): Pt => [x + dx * s, y + dy * s];
  return (
    <g>
      <polygon points={pts([P(-4, 0), P(-1, -6), P(-5.5, -15), P(5.5, -15), P(1, -6), P(4, 0)])} fill={c.u('lit')} />
      <path d={line([P(-1.6, -6), P(1.6, -6)])} {...dk(c, 1.2 * s)} />
      <path d={`${line([P(-4, -15), P(-5.5, -18)])} ${line([P(0, -15), P(0, -19)])} ${line([P(4, -15), P(5.5, -18)])}`} {...ln(c, 1.1 * s, 0.85)} />
    </g>
  );
}

function amphora(c: Ctx, x: number, y: number, s = 1) {
  const d = `M${x - 1.2 * s},${y - 14 * s} L${x + 1.2 * s},${y - 14 * s} L${x + 1.4 * s},${y - 11 * s} Q${x + 5.2 * s},${y - 9 * s} ${x + 4 * s},${y - 4 * s} Q${x + 2 * s},${y - 0.5 * s} ${x},${y} Q${x - 2 * s},${y - 0.5 * s} ${x - 4 * s},${y - 4 * s} Q${x - 5.2 * s},${y - 9 * s} ${x - 1.4 * s},${y - 11 * s} Z`;
  return (
    <g>
      <path d={d} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.5} />
      <path d={`M${x - 1.3 * s},${y - 12.5 * s} q${-3 * s},${0.5 * s} ${-2.6 * s},${3.4 * s} M${x + 1.3 * s},${y - 12.5 * s} q${3 * s},${0.5 * s} ${2.6 * s},${3.4 * s}`} {...dk(c, 0.7 * s)} />
    </g>
  );
}

/** Lit front + shaded side + bright top: a simple stone block. (x,y) bottom-left. */
function cube(c: Ctx, x: number, y: number, w: number, h: number, d = w * 0.35) {
  const e = d * 0.6;
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill={c.u('lit')} />
      <polygon points={pts([[x, y - h], [x + d, y - h - e], [x + w + d, y - h - e], [x + w, y - h]])} fill={c.p.accent} fillOpacity={0.9} />
      <polygon points={pts([[x + w, y - h], [x + w + d, y - h - e], [x + w + d, y - e], [x + w, y]])} fill={c.u('shade')} />
    </g>
  );
}

function flame(cx: number, by: number, h: number, w: number, lean = 0) {
  return `M${r2(cx - w)},${by} C${r2(cx - w)},${r2(by - h * 0.5)} ${r2(cx + lean - w * 0.3)},${r2(by - h * 0.6)} ${r2(cx + lean)},${r2(by - h)} C${r2(cx + w * 0.4)},${r2(by - h * 0.55)} ${r2(cx + w)},${r2(by - h * 0.4)} ${r2(cx + w)},${by} Z`;
}

function palm(c: Ctx, x: number, y: number, s = 1) {
  const t: Pt = [x - 1 * s, y - 28 * s];
  const fr = [
    [-14, -26, -8, -33],
    [-12, -37, -6, -37],
    [9, -37, 2, -38],
    [13, -25, 7, -33],
    [-2, -40, -3, -35],
    [4, -20, 6, -27],
    [-6, -20, -7, -26],
  ]
    .map(([ex, ey, qx, qy]) => `M${r2(t[0])},${r2(t[1])} Q${r2(x + qx * s)},${r2(y + qy * s)} ${r2(x + ex * s)},${r2(y + ey * s)}`)
    .join(' ');
  return (
    <g>
      <path d={`M${x},${y} Q${x + 2.5 * s},${y - 14 * s} ${t[0]},${t[1]}`} {...dk(c, 1.6 * s)} />
      <path d={fr} {...dk(c, 1.3 * s)} />
    </g>
  );
}

/** Galloping/walking equid silhouette in unit space (facing right, hooves at y=0, ~45 wide). */
function horse(
  c: Ctx,
  x: number,
  y: number,
  s: number,
  o: { flip?: boolean; rider?: boolean; walk?: boolean; lance?: boolean; fill?: string } = {},
) {
  const f = o.fill ?? c.dark;
  const legs = o.walk
    ? 'M8,-12 L9,-6 L10,0 M5,-12 L4,-6 L3,0 M-8,-12 L-9,-6 L-10,0 M-5,-12 L-3,-6 L-4,0'
    : 'M8,-13 L15,-9 L18,-4 M6,-13 L10,-6 L8,-1 M-8,-13 L-15,-8 L-21,-6 M-6,-13 L-6,-6 L-9,-1';
  return (
    <g transform={`translate(${x} ${y}) scale(${o.flip ? -s : s} ${s})`}>
      <path d={legs} {...dk(c, 2.1, f)} />
      <path d="M-11,-18 Q-18,-20 -21,-11" {...dk(c, 2, f)} />
      <ellipse cx={0} cy={-16} rx={12} ry={5.6} fill={f} />
      <polygon points="6,-19.5 12,-29 15,-31 17,-30.5 23,-24 22,-21.5 16,-25 10.5,-14" fill={f} />
      <polygon points="13,-30 13.6,-34 15.6,-30.6" fill={f} />
      <path d="M-10,-20.5 Q0,-23 6,-20.5 M8,-21 L13,-29" {...ln(c, 0.5, 0.45)} />
      {o.rider && (
        <g>
          <polygon points="-3.5,-20 2,-20 4,-31 -0.5,-32" fill={f} />
          <circle cx={2.4} cy={-34.6} r={2.6} fill={f} />
          <path d="M0,-21 L4.5,-15 L3.5,-10.5" {...dk(c, 2, f)} />
          <path d="M2.4,-29 L8,-25.5 L12,-27" {...dk(c, 1.5, f)} />
          {o.lance && spear(c, -10, -22, 24, -40, 1)}
        </g>
      )}
    </g>
  );
}

function camel(c: Ctx, x: number, y: number, s: number) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-9,-15 L-10,0 M-6,-15 L-5,0 M5,-15 L4,0 M8,-15 L9,0" {...dk(c, 1.8)} />
      <path
        d="M-12,-18 Q-10,-30 -2,-31 Q4,-31 7,-22 L9,-20 Q12,-24 13,-30 L15,-33 L20,-32 L20,-30 L16,-29 L14,-20 Q12,-14 8,-15 L-10,-15 Q-14,-15 -12,-18 Z"
        fill={c.dark}
      />
      <path d="M-11,-18 Q-15,-17 -14,-11" {...dk(c, 1)} />
      <rect x={-8} y={-35} width={9} height={5} rx={1.5} fill={c.u('lit')} />
      <path d="M-8,-30 L-9,-24 M1,-30 L2,-24" {...ln(c, 0.6, 0.7)} />
    </g>
  );
}

/** Side-on war galley in unit space (facing right, waterline y=0, ~120 long). */
function galley(c: Ctx, x: number, y: number, s: number, sail = true) {
  let oars = '';
  for (let i = -36; i <= 36; i += 6) oars += `M${i},-6 L${i - 6},5 `;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={oars} {...dk(c, 1.1)} />
      {sail && (
        <g>
          <line x1={0} y1={-12} x2={0} y2={-54} {...dk(c, 1.6)} />
          <line x1={-19} y1={-51} x2={19} y2={-51} {...dk(c, 1.4)} />
          <path d="M-17,-50 L17,-50 Q19,-36 15,-22 L-15,-22 Q-19,-36 -17,-50 Z" fill={c.u('lit')} />
          <path d="M-8,-50 L-7,-22 M0,-50 L0,-22 M8,-50 L7,-22" {...ln(c, 0.6, 0.5)} stroke={c.dark} />
        </g>
      )}
      <path
        d="M-58,-15 Q-63,-25 -54,-27 Q-56,-19 -48,-12 L44,-12 L50,-6 L63,-2 L50,0.5 L-44,0.5 Q-54,-4 -58,-15 Z"
        fill={c.dark}
      />
      <path d="M-48,-12 L44,-12 M-44,-6 L48,-6" {...ln(c, 0.7, 0.55)} />
    </g>
  );
}

/* ------------------------------------------------------------------------ */
/* Motifs                                                                    */
/* ------------------------------------------------------------------------ */

type Draw = (c: Ctx) => ReactNode;

function fallback(c: Ctx) {
  let rays = '';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    rays += `M${r2(100 + Math.cos(a) * 22)},${r2(90 + Math.sin(a) * 22)} L${r2(100 + Math.cos(a) * 44)},${r2(90 + Math.sin(a) * 44)} `;
  }
  return (
    <>
      <path d={rays} {...ln(c, 0.8, 0.35)} />
      {sun(c, 100, 90, 14)}
      {hills(c, 94, 8, 7)}
      {ground(c)}
    </>
  );
}

const MOTIFS: Record<string, Draw> = {
  /* ---------------------------------- Common ---------------------------------- */
  farm: (c) => {
    let furrows = '';
    for (let k = -6; k <= 6; k++) furrows += `M${100 + k * 5},${H} L${100 + k * 26},130 `;
    return (
      <>
        {sun(c, 150, 76, 8)}
        {hills(c, 94, 7, 3)}
        {ground(c)}
        <path d={`M70,${H} L130,${H} L256,130 L-56,130 Z`} fill={c.u('lit')} fillOpacity={0.38} />
        <path d={furrows + `M57,108 L143,108 M30,118 L170,118`} {...ln(c, 0.7, 0.55)} />
        {sheaf(c, 34, 116, 1.15)}
        {sheaf(c, 47, 120, 1.25)}
        {sheaf(c, 162, 114, 1.1)}
      </>
    );
  },

  granary: (c) => {
    const silo = (x: number, w: number, h: number) => (
      <g>
        <rect x={x - w / 2} y={H - h} width={w} height={h} fill={c.u('lit')} />
        <rect x={x + w * 0.12} y={H - h} width={w * 0.38} height={h} fill={c.u('shade')} fillOpacity={0.55} />
        <path d={`M${x - w / 2},${H - h} Q${x},${H - h - w * 0.95} ${x + w / 2},${H - h} Z`} fill={c.u('lit')} />
        <path d={`M${x - w / 2},${H - h} Q${x},${H - h - w * 0.95} ${x + w / 2},${H - h}`} {...ln(c, 0.8, 0.5)} />
        <rect x={x - w * 0.1} y={H - h - w * 0.5} width={w * 0.2} height={w * 0.09} fill={c.dark} />
        <path d={`M${x - w / 2},${H - h * 0.66} h${w} M${x - w / 2},${H - h * 0.33} h${w}`} {...ln(c, 0.6, 0.45)} stroke={c.dark} />
        <path d={`M${x - w * 0.12},${H} v${-h * 0.26} a${w * 0.12},${w * 0.12} 0 0 1 ${w * 0.24},0 v${h * 0.26} Z`} fill={c.dark} />
      </g>
    );
    return (
      <>
        {sun(c, 46, 62, 8)}
        {ground(c)}
        {silo(64, 20, 24)}
        {silo(136, 20, 24)}
        {silo(100, 28, 34)}
      </>
    );
  },

  quarry: (c) => {
    let marks = '';
    const R = rng(4);
    for (let i = 0; i < 26; i++) {
      const x = 4 + R() * 150;
      const ledge = x < 60 ? 30 : x < 92 ? 46 : x < 124 ? 62 : 78;
      const y = ledge + 6 + R() * (H - ledge - 12);
      marks += `M${r2(x)},${r2(y)} l1.2,-4 `;
    }
    return (
      <>
        {sun(c, 178, 34, 7)}
        {ground(c)}
        <polygon points="0,30 60,30 60,46 92,46 92,62 124,62 124,78 156,78 156,98 0,98" fill={c.u('shade')} />
        <path d="M0,30 h60 M60,46 h32 M92,62 h32 M124,78 h32" {...ln(c, 2.4, 0.9)} />
        <path d="M60,30 v16 M92,46 v16 M124,62 v16 M156,78 v20" {...ln(c, 0.8, 0.5)} />
        <path d={marks} {...ln(c, 0.6, 0.35)} />
        {figure(c, 108, 62, 0.55)}
        {cube(c, 164, 110, 16, 11)}
        {cube(c, 182, 112, 12, 9)}
        {cube(c, 168, 99, 12, 8)}
      </>
    );
  },

  road: (c) => {
    let pav = '';
    for (let k = 1; k <= 9; k++) {
      const t = Math.pow(k / 9, 1.6);
      const y = H + 32 * t;
      pav += `M${r2(96 - 41 * t)},${r2(y)} L${r2(104 + 41 * t)},${r2(y)} `;
    }
    const ms = [0.22, 0.48, 0.85].map((t) => {
      const y = H + 32 * t;
      const sz = 1.2 + 6 * t;
      return (
        <g key={t}>
          <rect x={92 - 41 * t - 4 * t - sz} y={y - sz * 2.2} width={sz} height={sz * 2.2} rx={sz / 2} fill={c.u('lit')} />
          <rect x={108 + 41 * t + 4 * t} y={y - sz * 2.2} width={sz} height={sz * 2.2} rx={sz / 2} fill={c.u('shade')} />
        </g>
      );
    });
    return (
      <>
        {sun(c, 100, 92, 9)}
        {hills(c, 96, 10, 11)}
        {ground(c)}
        <polygon points={`96,${H} 104,${H} 145,130 55,130`} fill={c.u('lit')} fillOpacity={0.6} />
        <path d={pav + `M100,${H} L100,130`} {...ln(c, 0.6, 0.5)} stroke={c.dark} />
        <path d={`M96,${H} L55,130 M104,${H} L145,130`} {...ln(c, 1, 0.7)} />
        {ms}
      </>
    );
  },

  market: (c) => {
    const stalls = [0, 1, 2, 3].map((i) => {
      const x = 22 + i * 40;
      let sc = `M${x - 2},72`;
      for (let k = 0; k < 5; k++) sc += ` q4,4 8,0`;
      return (
        <g key={i}>
          <path d={`M${x + 2},72 V${H} M${x + 34},72 V${H}`} {...dk(c, 1.4)} />
          <polygon points={pts([[x - 2, 72], [x + 38, 72], [x + 33, 61], [x + 3, 61]])} fill={i % 2 ? c.u('shade') : c.u('lit')} />
          <path d={sc} fill={i % 2 ? c.mid : c.p.secondary} />
          <rect x={x + 3} y={84} width={30} height={14} fill={c.dark} />
          <path d={`M${x + 8},83 a3,3 0 0 1 6,0 Z M${x + 17},83 a3,3 0 0 1 6,0 Z M${x + 26},83 a2.5,2.5 0 0 1 5,0 Z`} fill={c.p.accent} fillOpacity={0.8} />
        </g>
      );
    });
    return (
      <>
        {ground(c)}
        <path d="M0,62 h30 v-8 h22 v8 h40 v-12 h26 v12 h44 v-6 h38 v36 H0 Z" fill={c.u('shade')} opacity={0.5} />
        {stalls}
        {amphora(c, 28, 114, 1)}
        {amphora(c, 38, 117, 0.9)}
        {amphora(c, 160, 113, 1)}
        {amphora(c, 172, 117, 0.85)}
      </>
    );
  },

  walls: (c) => {
    let mer = '';
    for (let x = 0; x < 200; x += 10) if (x < 54 || (x > 80 && x < 118) || x > 144) mer += `M${x + 1},60 v-6 h6 v6 Z `;
    for (const t of [56, 120]) for (let k = 0; k < 3; k++) mer += `M${t + 1 + k * 8},44 v-6 h6 v6 Z `;
    let courses = '';
    for (let y = 66; y < H; y += 6) courses += `M0,${y} H200 `;
    return (
      <>
        {sun(c, 158, 40, 7)}
        {ground(c)}
        <rect x={0} y={60} width={200} height={38} fill={c.u('lit')} />
        <path d={courses} {...ln(c, 0.5, 0.35)} stroke={c.dark} />
        <rect x={56} y={44} width={24} height={54} fill={c.u('lit')} />
        <rect x={120} y={44} width={24} height={54} fill={c.u('lit')} />
        <rect x={70} y={44} width={10} height={54} fill={c.u('shade')} opacity={0.6} />
        <rect x={134} y={44} width={10} height={54} fill={c.u('shade')} opacity={0.6} />
        <path d={mer} fill={c.u('lit')} />
        <path d="M66,54 v8 M130,54 v8" {...dk(c, 1.6)} />
        <path d={`M88,${H} L88,78 A12,12 0 0 1 112,78 L112,${H} Z`} fill={c.deep} />
        <path d={`M88,${H} L88,78 A12,12 0 0 1 112,78 L112,${H}`} {...ln(c, 1.2, 0.8)} />
        <path d={`M94,80 V${H} M100,70 V${H} M106,80 V${H}`} {...ln(c, 0.5, 0.3)} />
      </>
    );
  },

  barracks: (c) => {
    const spears = [0, 1, 2, 3, 4, 5].map((i) => <g key={i}>{spear(c, 128 + i * 8, 104, 126 + i * 8, 62, 1)}</g>);
    return (
      <>
        {hills(c, 92, 8, 21)}
        {ground(c)}
        <rect x={28} y={66} width={144} height={32} fill={c.u('lit')} />
        <rect x={130} y={66} width={42} height={32} fill={c.u('shade')} opacity={0.45} />
        <polygon points="22,67 100,51 178,67" fill={c.u('shade')} />
        <path d="M22,67 L100,51 L178,67" {...ln(c, 1, 0.7)} />
        <path d="M40,98 v-18 h10 v18 Z M62,98 v-18 h10 v18 Z M84,98 v-18 h10 v18 Z" fill={c.deep} />
        <path d="M34,72 H166" {...ln(c, 0.6, 0.4)} stroke={c.dark} />
        <path d="M122,92 H178 M122,74 H178 M124,104 V72 M176,104 V72" {...dk(c, 1.6)} />
        {spears}
      </>
    );
  },

  temple: (c) => {
    const cols = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = 55 + i * 17.6;
      return (
        <g key={i}>
          <rect x={x} y={53} width={6} height={29} fill={c.u('lit')} />
          <rect x={x + 3.8} y={53} width={2.2} height={29} fill={c.u('shade')} opacity={0.7} />
          <rect x={x - 1} y={52} width={8} height={2} fill={c.p.accent} />
        </g>
      );
    });
    return (
      <>
        {sun(c, 100, 40, 14)}
        {ground(c)}
        <rect x={54} y={52} width={92} height={30} fill={c.deep} opacity={0.75} />
        {cols}
        <rect x={50} y={46} width={100} height={6} fill={c.u('lit')} />
        <polygon points="48,46 100,30 152,46" fill={c.u('lit')} />
        <path d="M58,44 L100,33 L142,44 Z" {...ln(c, 0.6, 0.6)} stroke={c.dark} />
        <rect x={50} y={82} width={100} height={5} fill={c.u('lit')} />
        <rect x={44} y={87} width={112} height={6} fill={c.u('lit')} />
        <rect x={38} y={93} width={124} height={6} fill={c.u('lit')} />
        <path d="M50,87 H150 M44,93 H156 M38,99 H162" {...ln(c, 0.6, 0.5)} stroke={c.dark} />
      </>
    );
  },

  workshop: (c) => {
    let bricks = '';
    for (let y = 46, r = 0; y < 98; y += 6, r++) {
      bricks += `M20,${y} H180 `;
      for (let x = 20 + (r % 2) * 8; x < 180; x += 16) bricks += `M${x},${y} v6 `;
    }
    let teeth = 'M60,58';
    for (let i = 1; i <= 11; i++) teeth += ` L${r2(60 + i * 4 - 2)},${r2(58 - i * 0.45 + 1.4)} L${r2(60 + i * 4)},${r2(58 - i * 0.45)}`;
    return (
      <>
        {ground(c)}
        <rect x={20} y={40} width={160} height={58} fill={c.u('shade')} />
        <path d={bricks} {...ln(c, 0.5, 0.25)} />
        <path d="M60,53 L104,49 L104,53 L60,58 Z" fill={c.u('lit')} />
        <path d={teeth} {...ln(c, 0.6, 0.9)} stroke={c.dark} />
        <rect x={103} y={47} width={10} height={7} rx={2} fill={c.dark} />
        <path d="M134,48 v14 M128,48 h14 l-2,4 h-10 Z" {...dk(c, 1.6)} />
        <rect x={34} y={78} width={132} height={5} fill={c.u('lit')} />
        <path d="M40,83 V112 M160,83 V112 M44,100 H156" {...dk(c, 2.6)} />
        <rect x={52} y={73} width={42} height={5} fill={c.mid} />
        <path d="M60,73 v5 M72,73 v5 M84,73 v5" {...ln(c, 0.5, 0.4)} />
        <path d="M112,76 L142,74" {...dk(c, 2.2)} />
        <rect x={140} y={68} width={7} height={11} rx={1} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.7} />
        <path d="M100,77 L118,71" {...dk(c, 1.4)} />
        <path d="M150,82 q3,-3 6,0 q-3,3 -6,0 M30,104 q3,-3 6,0" {...ln(c, 0.7, 0.6)} />
      </>
    );
  },

  militia: (c) => (
    <>
      {sun(c, 152, 66, 8)}
      {hills(c, 94, 8, 5)}
      {ground(c)}
      {spear(c, 98.5, 104, 96, 42, 1.1)}
      {spear(c, 102, 104, 104.5, 40, 1.1)}
      {figure(c, 86, 104, 1.55, { arms: [[[-2.6, 0.5], [-4, 6], [-4.4, 10]], [[2.6, 0.5], [6, 6], [8, 5]]], legs: [[[-1.2, 0], [-3, 10]], [[1.2, 0], [2.4, 10]]] })}
      {figure(c, 116, 104, 1.55, { arms: [[[-2.6, 0.5], [-6, 5], [-7.6, 3]], [[2.6, 0.5], [4, 6], [4.4, 10]]], legs: [[[-1.2, 0], [-2.4, 10]], [[1.2, 0], [3, 10]]] })}
    </>
  ),

  spearmen: (c) => {
    const xs = [64, 88, 112, 136];
    return (
      <>
        {sun(c, 40, 50, 7)}
        {ground(c)}
        {xs.map((x) => (
          <g key={`s${x}`}>{spear(c, x + 6, 96, x + 18, 24, 1)}</g>
        ))}
        {xs.map((x) => (
          <g key={`h${x}`}>
            <circle cx={x + 2} cy={57} r={4.6} fill={c.dark} />
            <path d={`M${x - 2.6},56 a4.6,4.6 0 0 1 9.2,0 Z`} fill={c.u('lit')} />
            <path d={`M${x - 3},88 L${x - 5},${H + 2} M${x + 3},88 L${x + 5},${H + 2}`} {...dk(c, 2.6)} />
          </g>
        ))}
        {xs.map((x) => (
          <g key={`r${x}`}>{roundShield(c, x, 77, 14)}</g>
        ))}
      </>
    );
  },

  archers: (c) => (
    <>
      {sun(c, 160, 52, 7)}
      {hills(c, 94, 6, 13)}
      {ground(c)}
      <path d="M113,44 Q133,66 113,88" {...dk(c, 1.8)} />
      <path d="M113,44 L91,64 L113,88" {...ln(c, 0.6, 0.9)} />
      <path d="M91,64 L132,65.5" {...dk(c, 0.9)} />
      <polygon points="132,63.8 136,65.6 132,67.2" fill={c.p.accent} />
      <circle cx={95} cy={58.5} r={4.2} fill={c.dark} />
      <polygon points="89,64.5 100,64.5 97,84 87,84" fill={c.dark} />
      <path d="M99,66.5 L120,66 M91,66 L80,64 L91,64" {...dk(c, 2.4)} />
      <path d="M96,83 L107,86 L107,98 M89,83 L91,98 L77,98" {...dk(c, 3)} />
    </>
  ),

  ram: (c) => {
    let wall = '';
    for (let y = 36; y < H; y += 7) wall += `M168,${y} H200 `;
    return (
      <>
        {ground(c)}
        <rect x={168} y={30} width={32} height={68} fill={c.u('lit')} />
        <path d={wall} {...ln(c, 0.5, 0.4)} stroke={c.dark} />
        <path d="M168,30 v68" {...dk(c, 1.2)} />
        <rect x={110} y={72} width={58} height={6} rx={1} fill={c.dark} />
        <path d="M160,70 h8 v10 h-8 Z" fill={c.u('lit')} stroke={c.dark} strokeWidth={0.8} />
        <rect x={54} y={84} width={92} height={5} fill={c.dark} />
        <polygon points="52,86 72,52 128,52 148,86" fill={c.u('shade')} />
        <polygon points="52,86 72,52 84,52 70,86" fill={c.u('lit')} opacity={0.8} />
        <path d="M76,58 H124 M70,66 H130 M64,74 H136 M58,82 H142" {...ln(c, 0.6, 0.45)} />
        <path d="M54,89 H146" {...dk(c, 1.2)} />
        {[70, 130].map((x) => (
          <g key={x}>
            <circle cx={x} cy={93} r={7.5} fill={c.dark} />
            <circle cx={x} cy={93} r={5.5} {...ln(c, 0.7, 0.55)} />
            <circle cx={x} cy={93} r={1.6} fill={c.p.accent} />
          </g>
        ))}
        <path d="M150,60 l6,-4 M150,66 l7,0 M150,84 l6,4" {...ln(c, 0.8, 0.7)} />
      </>
    );
  },

  festival: (c) => (
    <>
      {night(c, 0.35, true)}
      {ground(c)}
      <circle cx={100} cy={66} r={42} fill={c.u('glow')} />
      <path d="M100,84 L88,104 M100,84 L112,104 M100,84 L100,104" {...dk(c, 1.6)} />
      <path d="M84,78 Q100,92 116,78 Z" fill={c.u('lit')} stroke={c.dark} strokeWidth={0.8} />
      <path d={flame(100, 79, 30, 8, -2)} fill={c.u('fire')} />
      <path d={flame(92, 79, 18, 5, -4)} fill={c.u('fire')} opacity={0.85} />
      <path d={flame(108, 79, 20, 5, 3)} fill={c.u('fire')} opacity={0.85} />
      <path d="M96,40 h0.01 M106,36 h0.01 M101,30 h0.01 M110,46 h0.01" {...ln(c, 1.4, 0.8)} />
      {sheaf(c, 40, 108, 1.2)}
      {sheaf(c, 54, 104, 1)}
      {sheaf(c, 148, 104, 1)}
      {sheaf(c, 162, 108, 1.2)}
      {[72, 128].map((x) => (
        <g key={x}>
          <path d={`M${x - 7},106 h14 a7,5 0 0 1 -14,0 Z`} fill={c.u('lit')} />
          <path d={`M${x - 4},106 a2,2 0 0 1 4,0 Z M${x},106 a2.5,2.5 0 0 1 5,0 Z`} fill={c.p.secondary} />
        </g>
      ))}
    </>
  ),

  caravan: (c) => (
    <>
      {sun(c, 40, 68, 11)}
      <path d="M-5,88 Q40,70 90,82 T205,78 L205,130 L-5,130 Z" fill={c.u('shade')} opacity={0.7} />
      <path d="M-5,104 Q60,86 120,98 T205,96 L205,130 L-5,130 Z" fill={c.u('lit')} opacity={0.55} />
      <path d="M-5,118 Q70,104 140,116 T205,114 L205,130 L-5,130 Z" fill={c.u('ground')} />
      <path d="M-5,104 Q60,86 120,98 T205,96" {...ln(c, 0.8, 0.6)} />
      <path d="M72,89 L94,91 L122,94 L150,98 L176,97" {...dk(c, 0.5)} />
      {camel(c, 66, 89, 0.6)}
      {camel(c, 90, 91.5, 0.7)}
      {camel(c, 118, 95, 0.8)}
      {camel(c, 148, 99, 0.9)}
      {figure(c, 178, 99, 0.8, { robe: true, arms: [[[-2.6, 0.5], [-5, 6]], [[2.6, 0.5], [4, 8]]] })}
    </>
  ),

  saboteurs: (c) => {
    let blocks = '';
    for (let y = 46, r = 0; y < H; y += 8, r++) {
      blocks += `M112,${y} H200 `;
      for (let x = 112 + (r % 2) * 10; x < 200; x += 20) blocks += `M${x},${y} v8 `;
    }
    return (
      <>
        {night(c, 0.6)}
        {crescent(c, 44, 30, 9)}
        {ground(c)}
        <rect x={112} y={38} width={88} height={60} fill={c.u('shade')} />
        <path d="M112,38 h8 v-6 h10 v6 h10 v-6 h10 v6 h10 v-6 h10 v6 h10 v-6 h10 v6 h10" fill={c.u('shade')} />
        <path d={blocks} {...ln(c, 0.5, 0.25)} />
        <path d="M112,38 V98" {...ln(c, 1, 0.5)} />
        <path d="M138,74 l4,-3 l-1,6 l5,-2" {...ln(c, 0.7, 0.6)} stroke={c.deep} />
        <ellipse cx={94} cy={99} rx={16} ry={2} fill={c.deep} opacity={0.6} />
        <path d="M80,98 Q82,76 88,64 Q90,54 96,55 Q103,58 101,67 Q106,80 107,98 Z" fill={c.dark} />
        <path d="M80,98 Q82,76 88,64 Q90,54 96,55 Q103,58 101,67" {...ln(c, 0.8, 0.55)} />
        <path d="M100,70 L112,74" {...dk(c, 1.8)} />
        <path d="M111,70 L114,78" {...dk(c, 1.2, c.p.accent)} />
      </>
    );
  },

  arson: (c) => (
    <>
      {night(c, 0.4)}
      {ground(c)}
      <circle cx={100} cy={54} r={56} fill={c.u('glow')} />
      <rect x={64} y={60} width={72} height={38} fill={c.u('shade')} />
      <polygon points="58,61 100,37 142,61" fill={c.u('shade')} />
      <path d="M58,61 L100,37 L142,61 M64,61 V98 M136,61 V98" {...ln(c, 1, 0.75)} />
      <path d="M93,98 V80 h14 V98 Z M74,72 h10 v8 h-10 Z" fill={c.deep} />
      <path d={flame(79, 80, 16, 5, 1)} fill={c.u('fire')} />
      <path d={flame(104, 52, 34, 10, -3)} fill={c.u('fire')} />
      <path d={flame(88, 54, 22, 6, -4)} fill={c.u('fire')} opacity={0.9} />
      <path d={flame(122, 58, 24, 7, 4)} fill={c.u('fire')} opacity={0.9} />
      <path d="M100,16 q-6,-6 0,-12 M112,22 q6,-6 0,-12 M90,24 q-5,-5 0,-10" {...ln(c, 1, 0.35)} stroke={c.deep} />
      <path d="M70,44 h0.01 M132,40 h0.01 M118,30 h0.01" {...ln(c, 1.3, 0.85)} />
    </>
  ),

  spy: (c) => {
    let bricks = '';
    for (let y = 4, r = 0; y < 130; y += 9, r++) {
      bricks += `M0,${y} H200 `;
      for (let x = (r % 2) * 12; x < 200; x += 24) bricks += `M${x},${y} v9 `;
    }
    const key = 'M92,68 A20,20 0 1,1 108,68 L114,108 L86,108 Z';
    return (
      <>
        <rect width={200} height={130} fill={c.u('shade')} />
        <path d={bricks} {...ln(c, 0.5, 0.2)} />
        <path d={key} fill={c.deep} />
        <circle cx={100} cy={52} r={22} fill={c.u('glow')} />
        <path d={key} {...ln(c, 1.3, 0.75)} />
        <path d="M84,52 Q100,39 116,52 Q100,65 84,52 Z" fill={c.u('lit')} />
        <circle cx={100} cy={52} r={6.2} fill={mix(c.p.primary, c.p.ink, 0.25)} />
        <circle cx={100} cy={52} r={2.8} fill={c.deep} />
        <circle cx={102} cy={50} r={1.1} fill={c.p.accent} />
        <path d="M84,52 Q100,39 116,52" {...dk(c, 1.2, c.deep)} />
      </>
    );
  },

  poison: (c) => {
    let grain = '';
    const R = rng(17);
    for (let i = 0; i < 40; i++) {
      const x = 46 + R() * 100;
      const top = 112 - (1 - Math.pow((x - 95) / 55, 2)) * 34;
      const y = top + 2 + R() * (112 - top - 3);
      grain += `M${r2(x)},${r2(y)} l0.8,-1.2 `;
    }
    return (
      <>
        {sun(c, 40, 60, 6)}
        {ground(c)}
        <path d="M40,112 Q95,44 150,112 Z" fill={c.u('lit')} />
        <path d={grain} {...ln(c, 0.6, 0.6)} stroke={c.dark} />
        <path d="M128,82 Q110,80 100,90 Q86,98 92,108 Q104,113 112,104 Q118,96 126,98 Q134,92 128,82 Z" fill={c.deep} opacity={0.85} />
        <path d="M96,108 q-1,4 0,7 M106,110 q0,3 1,5" {...dk(c, 1.4, c.deep)} />
        <g transform="rotate(-104 146 86)">{amphora(c, 146, 98, 1.4)}</g>
        <path d="M160,66 q4,-6 0,-12 M168,70 q5,-5 1,-12" {...ln(c, 0.8, 0.4)} />
      </>
    );
  },

  repair: (c) => {
    let blocks = '';
    for (let y = 46, r = 0; y < H; y += 8, r++) {
      blocks += `M30,${y} H170 `;
      for (let x = 30 + (r % 2) * 10; x < 170; x += 20) blocks += `M${x},${y} v8 `;
    }
    return (
      <>
        {sun(c, 30, 40, 6)}
        {ground(c)}
        <path d="M30,98 V38 H112 L118,46 L126,40 L132,50 L140,38 H170 V98 Z" fill={c.u('lit')} />
        <path d={blocks} {...ln(c, 0.5, 0.35)} stroke={c.dark} />
        <path d="M126,42 L122,58 L128,70 L120,86" {...dk(c, 1.2, c.deep)} />
        <path d="M50,28 V100 M90,28 V100 M130,32 V100 M44,58 H136 M44,80 H136 M50,80 L90,58 M90,80 L130,58" {...dk(c, 1.7)} />
        <rect x={46} y={55} width={88} height={3} fill={c.mid} />
        <rect x={46} y={77} width={88} height={3} fill={c.mid} />
        {figure(c, 108, 55, 0.75, { arms: [[[-2.6, 0.5], [-4, 6], [-3, 10]], [[2.6, 0.5], [7, -2], [10, -6]]] })}
        <g transform="rotate(-30 124 42)">
          <rect x={120} y={36} width={8} height={6} rx={1} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.7} />
          <path d="M124,42 V52" {...dk(c, 1.4)} />
        </g>
        <path d="M132,30 A14,14 0 0 1 138,46" {...ln(c, 0.8, 0.6)} strokeDasharray="2 2" />
      </>
    );
  },

  levy: (c) => {
    const crowd: [number, number, number, boolean][] = [
      [44, 100, 0.8, false], [60, 98, 0.72, true], [74, 104, 0.9, false], [87, 100, 0.78, true],
      [114, 100, 0.78, false], [127, 104, 0.9, true], [141, 98, 0.72, false], [156, 100, 0.8, true],
      [26, 110, 1.05, true], [174, 110, 1.05, false],
    ];
    return (
      <>
        {sun(c, 152, 60, 6)}
        {hills(c, 94, 8, 33)}
        {ground(c)}
        <path d="M100,108 V20" {...dk(c, 1.8)} />
        <circle cx={100} cy={19} r={2} fill={c.p.accent} />
        <path d="M101,24 Q114,19 130,26 Q123,34 130,44 Q115,37 101,42 Z" fill={c.u('lit')} />
        <path d="M101,24 Q114,19 130,26" {...ln(c, 0.7, 0.7)} />
        {crowd.map(([x, y, s, up]) => (
          <g key={x}>{tinyFig(c, x, y, s, up)}</g>
        ))}
      </>
    );
  },

  shieldWall: (c) => {
    const xs = [30, 58, 86, 114, 142, 170];
    return (
      <>
        {ground(c)}
        {xs.map((x) => (
          <g key={`b${x}`}>
            {spear(c, x + 9, 70, x + 11, 30, 1)}
            <circle cx={x} cy={58} r={5} fill={c.dark} />
            <path d={`M${x - 5},57 a5,5 0 0 1 10,0 Z`} fill={c.u('lit')} />
            <path d={`M${x - 5},90 L${x - 7},${H + 4} M${x + 5},90 L${x + 7},${H + 4}`} {...dk(c, 3)} />
          </g>
        ))}
        {xs.map((x) => (
          <g key={`s${x}`}>{roundShield(c, x, 78, 16)}</g>
        ))}
      </>
    );
  },

  feignedRetreat: (c) => (
    <>
      {sun(c, 36, 60, 7)}
      {hills(c, 94, 6, 41)}
      {ground(c)}
      <path d="M150,112 Q110,104 84,98 Q62,92 48,90" {...ln(c, 0.8, 0.35)} strokeDasharray="3 3" />
      <path d="M164,108 h14 M120,98 h12 M84,92 h10" {...ln(c, 0.8, 0.5)} />
      {horse(c, 140, 110, 0.85, { flip: true, rider: true })}
      {horse(c, 100, 100, 0.65, { flip: true, rider: true })}
      {horse(c, 66, 93, 0.5, { flip: true, rider: true })}
      <path d="M40,74 Q24,40 70,34 Q140,28 172,66" {...ln(c, 1.1, 0.75)} strokeDasharray="4 3" />
      <polygon points="175,72 167,67 174,62" fill={c.p.accent} fillOpacity={0.85} />
    </>
  ),

  turnTheTide: (c) => (
    <>
      {sun(c, 56, 44, 7)}
      <rect x={0} y={96} width={200} height={34} fill={c.u('water')} />
      <path
        d="M-5,108 C50,106 80,98 100,80 C118,62 122,38 146,32 C168,27 188,42 182,60 C179,72 164,76 158,66 C154,59 160,52 167,55 C158,58 150,70 156,84 C162,96 180,100 205,100 L205,130 L-5,130 Z"
        fill={c.u('lit')}
      />
      <path d="M100,80 C118,62 122,38 146,32 C168,27 188,42 182,60" {...ln(c, 1.2, 0.85)} stroke={c.dark} />
      <path d="M108,84 C124,66 130,46 150,40 M114,92 C132,74 136,56 156,48 M120,100 C138,84 144,70 162,64" {...ln(c, 0.7, 0.5)} stroke={c.dark} />
      <path d="M146,32 h0.01 M156,30 h0.01 M166,32 h0.01 M176,38 h0.01 M138,36 h0.01" {...ln(c, 1.6, 0.9)} />
      <path d="M0,116 q10,-3 20,0 t20,0 t20,0 t20,0 M10,124 q10,-3 20,0 t20,0 t20,0" {...ln(c, 0.6, 0.4)} stroke={c.dark} />
    </>
  ),

  ambush: (c) => {
    const reeds = (seed: number, topMin: number, topMax: number, step: number) => {
      const R = rng(seed);
      let d = '';
      for (let x = -4; x < 206; x += step) {
        const xx = x + R() * step;
        const top = topMin + R() * (topMax - topMin);
        const bend = (R() - 0.5) * 10;
        d += `M${r2(xx)},132 Q${r2(xx + bend * 0.3)},${r2((top + 132) / 2)} ${r2(xx + bend)},${r2(top)} `;
      }
      return d;
    };
    return (
      <>
        {sun(c, 150, 50, 7)}
        {ground(c)}
        <path d={reeds(5, 60, 78, 3.2)} {...dk(c, 1.1, c.mid)} />
        {[66, 104, 142].map((x, i) => (
          <g key={x}>
            {spear(c, x + 6, 90, x + 9, 44 + i * 2, 1)}
            <circle cx={x} cy={74 - (i % 2) * 3} r={4.4} fill={c.dark} />
          </g>
        ))}
        <path d={reeds(9, 78, 92, 2.6)} {...dk(c, 1.2)} />
        <path d={reeds(13, 84, 100, 7)} {...ln(c, 0.8, 0.55)} />
      </>
    );
  },

  vigilantWatch: (c) => {
    let courses = '';
    for (let y = 46; y < H; y += 7) {
      const t = (y - 40) / 58;
      courses += `M${r2(53 - 3 * t)},${y} H${r2(67 + 3 * t)} `;
    }
    return (
      <>
        {night(c, 0.55)}
        {hills(c, 94, 10, 51, 0.8)}
        {ground(c)}
        <polygon points="62,31 200,4 200,64" fill={c.u('beam')} />
        <polygon points="50,98 70,98 67,40 53,40" fill={c.u('lit')} />
        <polygon points="60,98 70,98 67,40 60,40" fill={c.u('shade')} opacity={0.7} />
        <path d={courses} {...ln(c, 0.5, 0.35)} stroke={c.dark} />
        <rect x={47} y={36} width={26} height={4} fill={c.u('lit')} />
        <path d="M50,36 V26 M70,36 V26" {...dk(c, 1.2)} />
        <polygon points="45,27 60,18 75,27" fill={c.u('shade')} />
        <circle cx={60} cy={31} r={14} fill={c.u('glow')} />
        <circle cx={60} cy={31} r={2.6} fill={c.p.accent} />
        <path d="M58,62 h4 v8 h-4 Z" fill={c.deep} />
      </>
    );
  },

  mirror: (c) => {
    const W = 66;
    const fig = figure(c, 86, W, 1.3, { arms: [[[-2.6, 0.5], [-4, 6], [-4, 10]], [[2.6, 0.5], [6, -4], [8, -10]]] });
    return (
      <>
        {sun(c, 40, 34, 6)}
        <rect x={0} y={W} width={200} height={130 - W} fill={c.u('water')} />
        <line x1={0} x2={200} y1={W} y2={W} {...ln(c, 0.7, 0.6)} />
        {fig}
        <g transform={`translate(0 ${2 * W}) scale(1 -1)`} opacity={0.42}>
          {fig}
        </g>
        <path d="M66,76 h40 M70,84 h32 M74,92 h24 M60,102 h50" {...ln(c, 0.6, 0.4)} />
        <path d="M118,40 C170,28 170,104 120,92" {...ln(c, 1.3, 0.85)} />
        <polygon points="114,91 122,87 121,96" fill={c.p.accent} fillOpacity={0.9} />
      </>
    );
  },

  /* ----------------------------------- Kush ----------------------------------- */
  furnace: (c) => {
    const shaft = (x: number, h: number, w: number) => (
      <g>
        <polygon points={pts([[x - w / 2, H], [x + w / 2, H], [x + w * 0.28, H - h], [x - w * 0.28, H - h]])} fill={c.u('lit')} />
        <polygon points={pts([[x + 2, H], [x + w / 2, H], [x + w * 0.28, H - h], [x + 1, H - h]])} fill={c.u('shade')} opacity={0.7} />
        <rect x={x - w * 0.3} y={H - h - 1.5} width={w * 0.6} height={2} fill={c.p.accent} />
        <circle cx={x} cy={H - 4} r={11} fill={c.u('glow')} />
        <path d={`M${x - 4},${H} v-5 a4,4 0 0 1 8,0 v5 Z`} fill={c.u('fire')} />
        <path d={`M${x},${H - h - 3} q-4,-6 0,-12 q4,-6 0,-12`} {...ln(c, 1, 0.3)} stroke={c.p.ink} />
      </g>
    );
    return (
      <>
        {ground(c)}
        {shaft(78, 36, 22)}
        {shaft(116, 28, 18)}
        <ellipse cx={46} cy={96} rx={8} ry={4} fill={c.mid} />
        <path d="M53,96 L70,95" {...dk(c, 1.4)} />
        <path d="M140,98 Q150,82 164,80 Q178,80 194,98 Z" fill={c.dark} />
        <path d="M150,92 h0.01 M158,88 h0.01 M168,86 h0.01 M176,90 h0.01 M162,94 h0.01" {...ln(c, 1.5, 0.8)} />
      </>
    );
  },

  pyramid: (c) => {
    const pyr = (x: number, base: number, w: number, h: number) => (
      <g>
        <polygon points={pts([[x - w / 2, base], [x, base - h], [x, base]])} fill={c.u('lit')} />
        <polygon points={pts([[x, base - h], [x + w / 2, base], [x, base]])} fill={c.u('shade')} />
        <path d={line([[x - w / 2, base], [x, base - h], [x + w / 2, base]])} {...ln(c, 0.7, 0.6)} />
        <path d={line([[x, base - h], [x, base]])} {...ln(c, 0.5, 0.3)} />
      </g>
    );
    const chapel = (x: number, y: number, s: number) => (
      <g>
        <rect x={x - 4 * s} y={y - 8 * s} width={8 * s} height={8 * s} fill={c.mid} />
        <polygon points={pts([[x - 8 * s, y], [x - 1.4 * s, y], [x - 2 * s, y - 10 * s], [x - 7 * s, y - 10 * s]])} fill={c.u('lit')} />
        <polygon points={pts([[x + 1.4 * s, y], [x + 8 * s, y], [x + 7 * s, y - 10 * s], [x + 2 * s, y - 10 * s]])} fill={c.u('lit')} />
        <rect x={x - 1.4 * s} y={y - 6 * s} width={2.8 * s} height={6 * s} fill={c.deep} />
      </g>
    );
    return (
      <>
        {sun(c, 150, 44, 7)}
        {hills(c, 92, 5, 61)}
        {ground(c)}
        {pyr(62, 94, 22, 46)}
        {pyr(140, 94, 22, 44)}
        {pyr(100, 98, 30, 64)}
        {chapel(62, 98, 0.75)}
        {chapel(140, 98, 0.75)}
        {chapel(100, 104, 1)}
      </>
    );
  },

  lion: (c) => (
    <>
      {sun(c, 100, 32, 10)}
      {ground(c)}
      <polygon points="38,98 88,98 84,40 44,40" fill={c.u('lit')} />
      <polygon points="112,98 162,98 156,40 116,40" fill={c.u('lit')} />
      <polygon points="70,98 88,98 84,40 72,40" fill={c.u('shade')} opacity={0.55} />
      <polygon points="144,98 162,98 156,40 144,40" fill={c.u('shade')} opacity={0.55} />
      <rect x={41} y={35} width={46} height={5} fill={c.p.accent} />
      <rect x={113} y={35} width={46} height={5} fill={c.p.accent} />
      <rect x={86} y={52} width={28} height={6} fill={c.u('lit')} />
      <rect x={90} y={58} width={20} height={40} fill={c.deep} />
      <path d="M44,40 L38,98 M84,40 L88,98 M116,40 L112,98 M156,40 L162,98 M48,50 H80 M120,50 H152" {...ln(c, 0.7, 0.5)} stroke={c.dark} />
      <rect x={80} y={104} width={40} height={8} fill={c.u('lit')} />
      <g transform="translate(100 104) scale(1.05)">
        <path d="M-10,0 Q-18,-2 -17,-9" {...dk(c, 1.4)} />
        <path
          d="M-10,0 L-12,-4 Q-13,-12 -8,-16 Q-4,-22 2,-24 Q4,-30 9,-29 Q13,-28 13,-24 L12,-21 Q9,-19 8,-16 L8,-4 L11,-2 L11,0 Z"
          fill={c.dark}
        />
        <path d="M2,-24 Q6,-20 8,-16" {...ln(c, 0.6, 0.5)} />
      </g>
    </>
  ),

  kandake: (c) => (
    <>
      {sun(c, 56, 66, 9)}
      <polygon points="134,94 142,62 150,94" fill={c.u('shade')} opacity={0.8} />
      <polygon points="150,94 157,68 164,94" fill={c.u('shade')} opacity={0.65} />
      <polygon points="30,94 36,70 42,94" fill={c.u('shade')} opacity={0.6} />
      {ground(c, 94)}
      <ellipse cx={100} cy={98} rx={22} ry={2.5} fill={c.deep} opacity={0.5} />
      <path d="M118,98 V30" {...dk(c, 1.4)} />
      <circle cx={118} cy={29} r={2.4} fill={c.p.accent} />
      <polygon points="94,53 106,53 110,70 117,98 83,98 90,70" fill={c.dark} />
      <path d="M95,54 L109,82 M90,72 Q100,76 110,72" {...ln(c, 0.8, 0.55)} />
      <rect x={98.5} y={48} width={3} height={6} fill={c.dark} />
      <circle cx={100} cy={45} r={4.2} fill={c.dark} />
      <polygon points="96.5,42 103.5,42 102.6,30 97.4,30" fill={c.u('lit')} />
      <path d="M97.4,30 h5.2" {...ln(c, 0.8, 0.9)} />
      <path d="M105,56 L113,64 L118,62" {...dk(c, 2.2)} />
      <path d="M95,56 L91,66 L97,72" {...dk(c, 2.2)} />
    </>
  ),

  /* ---------------------------------- Aksum ----------------------------------- */
  port: (c) => (
    <>
      {sun(c, 150, 62, 8)}
      <polygon points="150,90 170,80 190,82 205,78 205,90" fill={c.u('shade')} />
      <rect x={0} y={90} width={200} height={40} fill={c.u('water')} />
      <path d="M140,96 h20 M134,102 h34 M64,110 h24 M150,120 h30 M70,122 h20" {...ln(c, 0.6, 0.45)} />
      <path d="M90,100 L168,100 Q162,114 146,114 L112,114 Q100,112 90,100 Z" fill={c.dark} />
      <path d="M92,101 Q86,94 90,87" {...dk(c, 1.6)} />
      <path d="M128,100 V44" {...dk(c, 1.4)} />
      <path d="M102,74 L158,40" {...dk(c, 1.2)} />
      <polygon points="104,74 156,42 150,96 122,96" fill={c.u('lit')} />
      <path d="M130,59 L136,96 M143,50 L144,96" {...ln(c, 0.5, 0.45)} stroke={c.dark} />
      <path d="M128,44 l6,2 l-6,2" fill={c.p.accent} />
      <rect x={-2} y={94} width={60} height={36} fill={c.u('lit')} />
      <path d="M-2,100 H58 M58,94 V130 M10,100 V112 M30,100 V112 M48,100 V112 M0,112 H58" {...ln(c, 0.6, 0.4)} stroke={c.dark} />
      {amphora(c, 18, 94, 0.9)}
      {amphora(c, 27, 94, 0.8)}
      <rect x={50} y={88} width={4} height={6} rx={1} fill={c.dark} />
    </>
  ),

  mint: (c) => {
    const stack = (x: number, y: number, n: number) => {
      const top = y - n * 3;
      let edges = '';
      for (let i = 1; i < n; i++) edges += `M${x - 9},${y - i * 3} a9,3 0 0 0 18,0 `;
      return (
        <g>
          <path d={`M${x - 9},${top} V${y} a9,3 0 0 0 18,0 V${top} Z`} fill={c.u('litH')} />
          <path d={edges} {...ln(c, 0.5, 0.6)} stroke={c.dark} />
          <ellipse cx={x} cy={top} rx={9} ry={3} fill={c.p.accent} stroke={c.dark} strokeWidth={0.4} />
        </g>
      );
    };
    return (
      <>
        {ground(c)}
        <circle cx={100} cy={70} r={34} fill={c.u('glow')} />
        {cube(c, 82, 106, 32, 16)}
        <path d="M95,76 V90 a5,1.6 0 0 0 10,0 V76 Z" fill={c.u('litH')} />
        <ellipse cx={100} cy={76} rx={5} ry={1.6} fill={c.p.accent} />
        <g transform="rotate(-24 112 52)">
          <rect x={98} y={48} width={14} height={8} rx={1} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
          <path d="M112,52 H140" {...dk(c, 2)} />
        </g>
        <path d="M86,60 A20,20 0 0 1 92,48" {...ln(c, 0.8, 0.6)} strokeDasharray="2 2" />
        {stack(40, 110, 6)}
        {stack(58, 116, 4)}
        {stack(156, 112, 7)}
        <ellipse cx={136} cy={118} rx={6} ry={2} fill={c.p.accent} />
        <ellipse cx={176} cy={122} rx={6} ry={2} fill={c.p.secondary} />
      </>
    );
  },

  stele: (c) => {
    let bands = '';
    let wins = '';
    let beams = '';
    for (let i = 0; i < 7; i++) {
      const y = 28 + i * 8.6;
      const t = (y - 22) / 76;
      const l = 90 - 3 * t;
      const r = 110 + 3 * t;
      bands += `M${r2(l)},${r2(y)} H${r2(r)} `;
      for (let k = 0; k < 4; k++) beams += `M${r2(l + 3 + k * ((r - l - 6) / 3))},${r2(y + 1.6)} h0.01 `;
      if (i % 2 === 0) wins += `M${r2(l + 4)},${r2(y + 3.4)} h4 v4 h-4 Z M${r2(r - 8)},${r2(y + 3.4)} h4 v4 h-4 Z `;
    }
    return (
      <>
        {sun(c, 152, 50, 8)}
        <path d="M44,98 V64 a4,4 0 0 1 8,0 V98 Z M150,98 V72 a3.5,3.5 0 0 1 7,0 V98 Z" fill={c.u('shade')} opacity={0.6} />
        {ground(c)}
        <path d="M113,98 L119,95 L114,22 L110,22 Z" fill={c.u('shade')} />
        <path d="M87,98 L90,22 A10,10 0 0 1 110,22 L113,98 Z" fill={c.u('lit')} />
        <path d="M87,98 L90,22 A10,10 0 0 1 110,22 L113,98" {...ln(c, 0.7, 0.6)} stroke={c.dark} />
        <path d={bands} {...ln(c, 0.6, 0.6)} stroke={c.dark} />
        <path d={wins} fill={c.dark} opacity={0.8} />
        <path d={beams} {...ln(c, 1.3, 0.8)} stroke={c.dark} />
        <rect x={95.5} y={87} width={9} height={11} fill={c.deep} />
        <rect x={74} y={98} width={52} height={5} fill={c.u('lit')} />
      </>
    );
  },

  coin: (c) => {
    const wheat = (flip: boolean) => {
      const sx = flip ? -1 : 1;
      let leaves = '';
      for (let i = 0; i < 5; i++) {
        const y = 82 - i * 7;
        const x = 100 + sx * (-27 + i * 0.6);
        leaves += `M${r2(x)},${y} l${-3 * sx},-3 M${r2(x)},${y} l${3 * sx},-3 `;
      }
      return (
        <g>
          <path d={`M${100 + sx * -26},90 Q${100 + sx * -30},70 ${100 + sx * -25},50`} {...ln(c, 0.9, 0.75)} stroke={c.dark} />
          <path d={leaves} {...ln(c, 0.9, 0.75)} stroke={c.dark} />
        </g>
      );
    };
    return (
      <>
        <rect width={200} height={130} fill={c.deep} opacity={0.35} />
        <circle cx={100} cy={65} r={62} fill={c.u('glow')} />
        <circle cx={100} cy={65} r={47} fill={c.dark} opacity={0.5} />
        <circle cx={100} cy={64} r={46} fill={c.u('lit')} />
        <circle cx={100} cy={64} r={41.5} {...ln(c, 2.4, 0.9)} stroke={c.dark} strokeDasharray="0.1 3.6" />
        <circle cx={100} cy={64} r={38} {...ln(c, 0.7, 0.6)} stroke={c.dark} />
        {wheat(false)}
        {wheat(true)}
        <circle cx={100} cy={31} r={2.6} fill={c.dark} />
        <path d="M94,32 A6.2,6.2 0 0 0 106,32 A6.2,4.4 0 0 1 94,32 Z" fill={c.dark} />
        <path
          d="M80,94 Q83,80 92,77 L94,71 Q88,65 90,57 Q92,50 100,49 Q108,49 110,56 L113,62 L110,63 L111,67 L109,69 Q106,72 104,72 L105,77 Q116,79 120,94 Z"
          fill={mix(c.p.secondary, c.p.ink, 0.35)}
        />
        <polygon points="90,52 90,43 93,47 96,41 100,46 104,41 107,47 110,43 110,53" fill={mix(c.p.secondary, c.p.ink, 0.35)} />
        <path d="M80,94 Q83,80 92,77 M90,52 Q100,47 110,53" {...ln(c, 0.6, 0.8)} />
      </>
    );
  },

  /* --------------------------------- Carthage --------------------------------- */
  cothon: (c) => {
    const ticks = (rx1: number, ry1: number, rx2: number, ry2: number, cx: number, cy: number, n: number) => {
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        d += `M${r2(cx + Math.cos(a) * rx1)},${r2(cy + Math.sin(a) * ry1)} L${r2(cx + Math.cos(a) * rx2)},${r2(cy + Math.sin(a) * ry2)} `;
      }
      return d;
    };
    return (
      <>
        {sun(c, 160, 36, 6)}
        <rect x={0} y={48} width={200} height={10} fill={c.u('water')} />
        <rect x={0} y={58} width={200} height={72} fill={c.u('lit')} opacity={0.75} />
        <rect x={0} y={58} width={200} height={72} fill={c.u('ground')} opacity={0.45} />
        <polygon points="54,108 70,112 74,132 54,132" fill={c.u('water')} />
        <ellipse cx={100} cy={90} rx={74} ry={28} fill={c.u('water')} />
        <ellipse cx={100} cy={90} rx={74} ry={28} {...ln(c, 1, 0.7)} />
        <path d={ticks(74, 28, 67, 24.5, 100, 90, 48)} {...ln(c, 0.6, 0.55)} stroke={c.dark} />
        <ellipse cx={100} cy={88} rx={26} ry={10} fill={c.u('lit')} />
        <path d={ticks(22, 8, 26, 10, 100, 88, 30)} {...ln(c, 0.6, 0.7)} stroke={c.dark} />
        <rect x={94} y={76} width={12} height={10} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.5} />
        <polygon points="92,76 100,70 108,76" fill={c.u('shade')} />
        <path d="M58,104 l8,2 M136,104 l9,-2 M150,84 l6,3" {...dk(c, 1.6)} />
      </>
    );
  },

  mercenary: (c) => (
    <>
      {sun(c, 152, 56, 7)}
      {hills(c, 94, 8, 71)}
      {ground(c)}
      {spear(c, 77, 112, 72, 30, 1.2)}
      {figure(c, 96, 106, 2, {
        arms: [[[-2.6, 0.5], [-7, 5], [-10, 4]], [[2.6, 0.5], [6, 8]]],
        legs: [[[-1.2, 0], [-4, 10]], [[1.2, 0], [5, 10]]],
      })}
      <path d="M90.5,55.6 a5.4,5.4 0 0 1 10.8,0 Z" fill={c.u('lit')} />
      <path d="M95,50 q4,-6 9,-2" {...dk(c, 1.4)} />
      <ellipse cx={112} cy={80} rx={10} ry={16} fill={c.u('lit')} stroke={c.dark} strokeWidth={1.2} />
      <path d="M112,64 V96" {...dk(c, 1.4)} />
      <ellipse cx={112} cy={80} rx={3} ry={4} fill={c.mid} />
      <ellipse cx={112} cy={80} rx={7.5} ry={13} {...ln(c, 0.6, 0.5)} stroke={c.dark} />
    </>
  ),

  cavalry: (c) => (
    <>
      {sun(c, 40, 50, 7)}
      {hills(c, 94, 6, 81)}
      {ground(c)}
      <ellipse cx={58} cy={104} rx={18} ry={4} fill={c.p.accent} opacity={0.18} />
      <ellipse cx={46} cy={100} rx={10} ry={3} fill={c.p.accent} opacity={0.12} />
      <path d="M14,70 h26 M10,80 h30 M18,90 h22" {...ln(c, 0.8, 0.45)} />
      {horse(c, 104, 108, 2.1, { rider: true, lance: true })}
    </>
  ),

  ship: (c) => (
    <>
      {sun(c, 36, 54, 7)}
      <rect x={0} y={H} width={200} height={32} fill={c.u('water')} />
      <line x1={0} x2={200} y1={H} y2={H} {...ln(c, 0.6, 0.4)} />
      {galley(c, 100, 104, 1.25)}
      <path d="M20,112 h30 M60,118 h40 M120,114 h44 M150,122 h30 M10,124 h24" {...ln(c, 0.6, 0.45)} />
    </>
  ),

  blockade: (c) => (
    <>
      {sun(c, 100, 60, 7)}
      <rect x={0} y={80} width={200} height={50} fill={c.u('water')} />
      <line x1={0} x2={200} y1={80} y2={80} {...ln(c, 0.6, 0.4)} />
      {galley(c, 72, 96, 0.3)}
      {galley(c, 104, 95, 0.3)}
      {galley(c, 136, 96, 0.3)}
      <polygon points="0,64 26,66 54,98 60,130 0,130" fill={c.u('lit')} />
      <polygon points="200,60 170,64 146,98 140,130 200,130" fill={c.u('shade')} />
      <rect x={10} y={50} width={10} height={16} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
      <rect x={178} y={46} width={10} height={16} fill={c.u('shade')} stroke={c.dark} strokeWidth={0.6} />
      <path d="M10,50 h2 v-2 h2 v2 h2 v-2 h2 v2 M178,46 h2 v-2 h2 v2 h2 v-2 h2 v2" {...dk(c, 0.8)} />
      <path d="M52,100 Q100,116 148,100" {...dk(c, 2.6)} strokeDasharray="3 1.4" />
      <path d="M52,100 Q100,116 148,100" {...ln(c, 0.6, 0.6)} strokeDasharray="1.2 3.2" />
      <path d="M70,120 h20 M110,124 h24" {...ln(c, 0.6, 0.4)} />
    </>
  ),

  /* ---------------------------------- Sumer ----------------------------------- */
  canal: (c) => (
    <>
      {sun(c, 100, 84, 8)}
      {ground(c, 92)}
      <path d="M0,104 L200,104 M0,118 L200,118" {...ln(c, 0.6, 0.35)} />
      <polygon points="97,92 103,92 136,130 64,130" fill={c.u('water')} />
      <polygon points="99,92 101,92 108,130 92,130" fill={c.p.accent} opacity={0.35} />
      <rect x={0} y={102.5} width={200} height={3} fill={c.u('water')} />
      <rect x={0} y={116} width={200} height={4} fill={c.u('water')} />
      <path d="M97,92 L64,130 M103,92 L136,130" {...ln(c, 0.8, 0.6)} />
      <ellipse cx={100} cy={108} rx={3} ry={10} fill={c.p.accent} opacity={0.35} />
      {palm(c, 58, 94, 0.75)}
      {palm(c, 40, 100, 1.05)}
      {palm(c, 140, 95, 0.8)}
      {palm(c, 160, 102, 1.15)}
      {palm(c, 182, 112, 1.4)}
    </>
  ),

  ziggurat: (c) => {
    let steps = '';
    for (let y = 46; y < H; y += 3) {
      const t = (y - 44) / 54;
      steps += `M${r2(97 - 3 * t)},${y} H${r2(103 + 3 * t)} `;
    }
    return (
      <>
        {sun(c, 40, 46, 8)}
        {ground(c)}
        <polygon points="36,98 164,98 156,76 44,76" fill={c.u('lit')} />
        <polygon points="128,98 164,98 156,76 124,76" fill={c.u('shade')} opacity={0.6} />
        <polygon points="56,76 144,76 138,58 62,58" fill={c.u('lit')} />
        <polygon points="118,76 144,76 138,58 116,58" fill={c.u('shade')} opacity={0.6} />
        <polygon points="76,58 124,58 120,44 80,44" fill={c.u('lit')} />
        <polygon points="108,58 124,58 120,44 107,44" fill={c.u('shade')} opacity={0.6} />
        <path d="M40,87 H160 M59,67 H141" {...ln(c, 0.5, 0.4)} stroke={c.dark} />
        <polygon points="94,98 106,98 103,44 97,44" fill={c.mid} />
        <path d={steps} {...ln(c, 0.5, 0.55)} />
        <rect x={90} y={32} width={20} height={12} fill={c.u('lit')} />
        <rect x={102} y={32} width={8} height={12} fill={c.u('shade')} opacity={0.6} />
        <rect x={97} y={37} width={6} height={7} fill={c.deep} />
        <path d="M88,32 H112" {...ln(c, 1.2, 0.8)} />
      </>
    );
  },

  tablets: (c) => {
    const tab = (x: number, y: number, w: number, h: number, rot: number, seed: number) => {
      const R = rng(seed);
      let d = '';
      for (let yy = -h / 2 + 6; yy < h / 2 - 3; yy += 6) {
        for (let xx = -w / 2 + 5; xx < w / 2 - 4; xx += 4) {
          if (R() < 0.22) continue;
          d += R() < 0.65 ? `M${r2(xx)},${r2(yy)} l3,-1.2 l0,2.4 Z ` : `M${r2(xx + 1.5)},${r2(yy + 1.6)} l-1.2,-3 l2.4,0 Z `;
        }
      }
      return (
        <g transform={`translate(${x} ${y}) rotate(${rot})`}>
          <rect x={-w / 2 + 1.5} y={-h / 2 + 2} width={w} height={h} rx={4} fill={c.deep} opacity={0.5} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={c.u('lit')} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} {...ln(c, 0.7, 0.6)} stroke={c.dark} />
          <path d={d} fill={c.dark} opacity={0.75} />
        </g>
      );
    };
    return (
      <>
        <rect width={200} height={130} fill={c.deep} opacity={0.25} />
        {ground(c, 84)}
        {tab(62, 78, 40, 54, -10, 3)}
        {tab(138, 80, 38, 50, 8, 7)}
        {tab(100, 88, 46, 58, -2, 11)}
        <path d="M134,118 L178,104" {...dk(c, 2.2, c.mid)} />
        <path d="M176,104.6 L181,103" {...dk(c, 2.2, c.p.accent)} />
      </>
    );
  },

  wagon: (c) => (
    <>
      {sun(c, 30, 52, 7)}
      {hills(c, 94, 6, 91)}
      {ground(c)}
      <path d="M84,84 L122,80" {...dk(c, 1.8)} />
      {horse(c, 138, 102, 1.0, { fill: c.mid })}
      {horse(c, 130, 104, 1.05)}
      {figure(c, 68, 82, 0.85, { arms: [[[-2.6, 0.5], [-3, 6]], [[2.6, 0.5], [9, 4], [14, 3]]] })}
      <path d="M80,79 L150,76" {...ln(c, 0.5, 0.7)} stroke={c.dark} />
      <path d="M82,72 l6,-12 M85,72 l4,-11" {...dk(c, 0.9)} />
      <polygon points="46,90 86,90 88,62 82,62 80,80 48,80" fill={c.u('lit')} />
      <path d="M46,90 L86,90 L88,62 M48,85 H84" {...ln(c, 0.6, 0.5)} stroke={c.dark} />
      {[56, 78].map((x) => (
        <g key={x}>
          <circle cx={x} cy={96} r={9} fill={c.u('shade')} stroke={c.dark} strokeWidth={1} />
          <path d={`M${x - 3},87.5 V104.5 M${x + 3},87.5 V104.5`} {...ln(c, 0.5, 0.5)} />
          <circle cx={x} cy={96} r={2} fill={c.p.accent} />
        </g>
      ))}
    </>
  ),

  /* ----------------------------------- Inca ----------------------------------- */
  andeanRoad: (c) => {
    const road: Pt[] = [[58, 87], [112, 80], [80, 68], [114, 56], [92, 46], [118, 32]];
    return (
      <>
        {sun(c, 170, 30, 7)}
        <polygon points="0,98 40,56 70,74 90,98" fill={c.u('shade')} opacity={0.55} />
        {ground(c)}
        <polygon points="40,100 122,16 200,62 200,100" fill={c.u('lit')} />
        <polygon points="122,16 200,62 200,100 122,100" fill={c.u('shade')} />
        <polygon points="122,16 110,28 116,30 122,26 128,31 134,25" fill={c.p.accent} />
        <path d={line(road)} {...dk(c, 2.6, c.mid)} />
        <path d={line(road)} {...ln(c, 2.2, 0.9)} strokeDasharray="0.8 1.6" stroke={c.dark} />
        <polygon points="26,86 58,87 54,132 30,132" fill={c.deep} />
        <polygon points="0,84 26,84 30,132 0,132" fill={c.u('lit')} />
        <path d="M26,86 Q42,96 58,87 M26,79 Q42,89 58,80 M32,82.5 v7 M38,85 v7.5 M44,85.6 v7.4 M50,84.6 v7" {...dk(c, 0.8)} />
        <path d="M26,79 v7 M58,80 v7" {...dk(c, 1.4)} />
      </>
    );
  },

  terraces: (c) => {
    const clip = c.id('mt');
    let bands = '';
    let risers = '';
    for (let i = 0; i < 10; i++) {
      const y0 = 38 + i * 9.6;
      bands += `M-10,${r2(y0)} Q100,${r2(y0 - 28)} 210,${r2(y0 + 10)} `;
      risers += `M-10,${r2(y0 + 2.2)} Q100,${r2(y0 - 25.8)} 210,${r2(y0 + 12.2)} `;
    }
    return (
      <>
        <defs>
          <clipPath id={clip}>
            <polygon points="0,98 20,80 70,30 100,20 140,36 200,70 200,130 0,130" />
          </clipPath>
        </defs>
        {sun(c, 170, 30, 7)}
        <polygon points="120,98 170,40 200,50 200,98" fill={c.u('shade')} opacity={0.5} />
        {ground(c)}
        <polygon points="0,98 20,80 70,30 100,20 140,36 200,70 200,130 0,130" fill={c.u('shade')} />
        <g clipPath={`url(#${clip})`}>
          <path d={bands} {...ln(c, 4, 0.55)} />
          <path d={risers} {...dk(c, 0.9, c.deep)} />
        </g>
        <path d="M0,98 L20,80 L70,30 L100,20 L140,36 L200,70" {...ln(c, 0.8, 0.6)} />
      </>
    );
  },

  runner: (c) => (
    <>
      {sun(c, 40, 50, 7)}
      <polygon points="80,98 130,46 180,98" fill={c.u('shade')} opacity={0.55} />
      <polygon points="130,98 170,62 210,98" fill={c.u('shade')} opacity={0.4} />
      {ground(c)}
      <rect x={-5} y={104} width={210} height={6} fill={c.u('lit')} opacity={0.5} />
      <path d="M10,104 v6 M30,104 v6 M50,104 v6 M70,104 v6 M90,104 v6 M110,104 v6 M130,104 v6 M150,104 v6 M170,104 v6 M190,104 v6" {...ln(c, 0.5, 0.4)} stroke={c.dark} />
      <path d="M30,66 h22 M24,78 h26 M34,90 h18" {...ln(c, 0.8, 0.45)} />
      <g transform="rotate(12 100 106)">
        {figure(c, 100, 106, 1.9, {
          arms: [[[-2.6, 0.5], [-6, 6], [-10, 3]], [[2.6, 0.5], [7, -3], [9, -10]]],
          legs: [[[-1.2, 0], [-7, 5], [-12, 3]], [[1.2, 0], [6, 5], [5, 10]]],
        })}
        <path d="M116,45 l5,-6 l2.5,4 Z" fill={c.u('lit')} stroke={c.dark} strokeWidth={0.5} />
        <path d="M95,88 H103 M96,88 v6 M98,88 v8 M100,88 v5 M102,88 v7" {...dk(c, 0.7, c.p.accent)} />
        <path d="M96,92 h0.01 M98,95 h0.01 M100,91 h0.01 M102,94 h0.01" {...ln(c, 1.6, 1)} />
      </g>
    </>
  ),

  masonry: (c) => {
    const R = rng(29);
    const xs = [-10, 22, 50, 82, 118, 150, 178, 210];
    const ys = [18, 38, 58, 78, 98];
    const j = (n: number) => (R() - 0.5) * n;
    const V: Pt[][] = ys.map((y, ri) =>
      xs.map((x, ci) => [ci === 0 || ci === xs.length - 1 ? x : x + j(14), ri === 0 || ri === ys.length - 1 ? y : y + j(8)] as Pt),
    );
    const mh: Pt[][] = V.map((row, ri) =>
      row.slice(0, -1).map((v, ci) => [(v[0] + row[ci + 1][0]) / 2 + j(8), (v[1] + row[ci + 1][1]) / 2 + (ri === 0 || ri === ys.length - 1 ? 0 : j(8))] as Pt),
    );
    const mv: Pt[][] = V.slice(0, -1).map((row, ri) =>
      row.map((v, ci) => [(v[0] + V[ri + 1][ci][0]) / 2 + (ci === 0 || ci === xs.length - 1 ? 0 : j(8)), (v[1] + V[ri + 1][ci][1]) / 2 + j(5)] as Pt),
    );
    const stones: ReactNode[] = [];
    for (let r = 0; r < ys.length - 1; r++) {
      for (let k = 0; k < xs.length - 1; k++) {
        const poly: Pt[] = [V[r][k], mh[r][k], V[r][k + 1], mv[r][k + 1], V[r + 1][k + 1], mh[r + 1][k], V[r + 1][k], mv[r][k]];
        stones.push(
          <polygon key={`${r}-${k}`} points={pts(poly)} fill={c.u('lit')} fillOpacity={0.72 + R() * 0.28} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" />,
        );
      }
    }
    return (
      <>
        {sun(c, 166, 10, 5)}
        {ground(c)}
        <rect x={0} y={18} width={200} height={80} fill={c.mid} />
        {stones}
        <polygon points="86,98 114,98 109,52 91,52" fill={c.deep} />
        <rect x={86} y={45} width={28} height={7} fill={c.u('lit')} stroke={c.dark} strokeWidth={1.2} />
      </>
    );
  },

  slinger: (c) => (
    <>
      {sun(c, 160, 62, 7)}
      {hills(c, 94, 7, 97)}
      {ground(c)}
      <ellipse cx={108} cy={34} rx={24} ry={7} {...ln(c, 1, 0.75)} strokeDasharray="3 2.5" />
      <polygon points="84,31 88,37 81,37" fill={c.p.accent} fillOpacity={0.8} />
      <path d="M106.8,37.6 L126,30" {...dk(c, 0.8)} />
      <circle cx={127} cy={29.6} r={2.2} fill={c.p.accent} stroke={c.dark} strokeWidth={0.6} />
      {figure(c, 96, 104, 1.8, {
        arms: [[[-2.6, 0.5], [-8, 4], [-12, 2]], [[2.6, 0.5], [4, -8], [6, -16]]],
        legs: [[[-1.2, 0], [-5, 10]], [[1.2, 0], [6, 10]]],
      })}
    </>
  ),
};

export const MOTIF_KEYS: string[] = Object.keys(MOTIFS);

/* ------------------------------------------------------------------------ */
/* Public components                                                          */
/* ------------------------------------------------------------------------ */

function useSafeId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

export function CardArt({ motif, palette, className }: { motif: string; palette: Palette; className?: string }) {
  const uid = useSafeId('pmart');
  const c = makeCtx(palette, uid);
  const draw = MOTIFS[motif] ?? fallback;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 130"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      className={className}
      style={{ display: 'block' }}
      aria-hidden="true"
      focusable="false"
    >
      <Defs c={c} />
      <rect width={200} height={130} fill={c.u('sky')} />
      {draw(c)}
      <rect width={200} height={130} fill={c.u('vig')} pointerEvents="none" />
    </svg>
  );
}

type CivKey = 'kush' | 'aksum' | 'carthage' | 'sumer' | 'inca';

const EMBLEMS: Record<CivKey, (c: Ctx, lit: string) => ReactNode> = {
  kush: (c, lit) => (
    <>
      <polygon points="50,20 50,68 37,68" fill={lit} />
      <polygon points="50,20 63,68 50,68" fill={c.mid} />
      <path d="M26,74 Q50,90 74,74" {...dk(c, 3, lit)} />
      <path d="M26,74 L74,74" {...dk(c, 0.8, lit)} />
    </>
  ),
  aksum: (c, lit) => {
    let bands = '';
    for (let y = 34; y < 70; y += 7) bands += `M41,${y} H59 `;
    return (
      <>
        <path d="M40,80 L42,28 A8,8 0 0 1 58,28 L60,80 Z" fill={lit} />
        <path d={bands} {...dk(c, 1, c.dark)} />
        <path d="M44,40 h3 v3 h-3 Z M53,40 h3 v3 h-3 Z M44,54 h3 v3 h-3 Z M53,54 h3 v3 h-3 Z" fill={c.dark} />
        <rect x={46.5} y={70} width={7} height={10} fill={c.dark} />
      </>
    );
  },
  carthage: (c, lit) => (
    <>
      <circle cx={50} cy={32} r={7} fill={lit} />
      <path d="M36,40 A14,14 0 0 0 64,40 A14,9.5 0 0 1 36,40 Z" fill={lit} />
      <path d="M28,64 q5.5,-5 11,0 t11,0 t11,0 t11,0 M28,72 q5.5,-5 11,0 t11,0 t11,0 t11,0 M32,80 q4.5,-4 9,0 t9,0 t9,0 t9,0" {...dk(c, 2.2, lit)} />
    </>
  ),
  sumer: (c, lit) => (
    <>
      <polygon points="24,70 76,70 72,58 28,58" fill={lit} />
      <polygon points="34,58 66,58 63,47 37,47" fill={lit} />
      <polygon points="42,47 58,47 56,37 44,37" fill={lit} />
      <polygon points="47,70 53,70 52,37 48,37" fill={c.mid} />
      <rect x={45} y={29} width={10} height={8} fill={lit} />
      <path d="M30,79 l5,-2 l0,4 Z M40,79 l5,-2 l0,4 Z M50,79 l5,-2 l0,4 Z M60,79 l5,-2 l0,4 Z M67,82 l-2,-5 l4,0 Z" fill={lit} />
    </>
  ),
  inca: (c, lit) => {
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays += `M${r2(64 + Math.cos(a) * 10)},${r2(34 + Math.sin(a) * 10)} L${r2(64 + Math.cos(a) * 14)},${r2(34 + Math.sin(a) * 14)} `;
    }
    return (
      <>
        <circle cx={64} cy={34} r={7.5} fill={lit} />
        <path d={rays} {...dk(c, 1.6, lit)} />
        <path d="M18,80 L18,74 Q30,72 34,64 Q38,58 46,56 L46,62 Q40,64 36,70 Q30,78 18,80 Z" fill={lit} opacity={0.6} />
        <path d="M20,82 Q34,82 42,72 Q48,64 58,62 L66,62 Q56,66 52,74 Q46,84 30,86 Z" fill={lit} />
        <path d="M26,86 Q44,86 54,76 Q62,68 76,68 L80,70 Q68,72 62,80 Q54,88 34,90 Z" fill={lit} opacity={0.8} />
        <path d="M24,82 Q36,80 44,72 M34,86 Q50,84 58,74" {...dk(c, 0.7, c.dark)} />
      </>
    );
  },
};

export function CivEmblem({
  civ,
  palette,
  size = 64,
  className,
}: {
  civ: CivKey;
  palette: Palette;
  size?: number;
  className?: string;
}) {
  const uid = useSafeId('pmemb');
  const c = makeCtx(palette, uid);
  const id = c.id;
  const draw = EMBLEMS[civ] ?? EMBLEMS.kush;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.accent} />
          <stop offset="0.45" stopColor={palette.secondary} />
          <stop offset="0.7" stopColor={mix(palette.accent, '#ffffff', 0.3)} />
          <stop offset="1" stopColor={mix(palette.secondary, palette.ink, 0.35)} />
        </linearGradient>
        <radialGradient id={id('field')} cx="0.5" cy="0.38" r="0.7">
          <stop offset="0" stopColor={desat(mix(palette.primary, palette.accent, 0.12), 0.15)} />
          <stop offset="1" stopColor={mix(palette.ink, palette.primary, 0.3)} />
        </radialGradient>
        <linearGradient id={id('sym')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={mix(palette.accent, '#ffffff', 0.25)} />
          <stop offset="1" stopColor={palette.secondary} />
        </linearGradient>
      </defs>
      <circle cx={50} cy={50} r={48} fill={c.u('ring')} />
      <circle cx={50} cy={50} r={48} fill="none" stroke={palette.ink} strokeOpacity={0.45} strokeWidth={0.8} />
      <circle cx={50} cy={50} r={42} fill={c.u('field')} />
      <circle cx={50} cy={50} r={42} fill="none" stroke={palette.ink} strokeOpacity={0.6} strokeWidth={1.2} />
      <circle cx={50} cy={50} r={39} fill="none" stroke={palette.accent} strokeOpacity={0.35} strokeWidth={0.6} />
      {draw(c, c.u('sym'))}
    </svg>
  );
}
