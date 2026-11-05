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
/* Scene helpers: posed actors, motion cues, props                           */
/* ------------------------------------------------------------------------ */

const P2 = (p: Pt) => `${r2(p[0])},${r2(p[1])}`;

/**
 * A pose in figure units (feet baseline y=0, ~27 tall, facing right).
 * `arms` polylines start at the shoulder, `legs` at the hip; the start point is implied.
 * `lean` tilts the torso forward (degrees); `hip` lowers the hip for kneeling/crouching.
 */
interface Pose {
  lean?: number;
  hip?: number;
  arms: Pt[][];
  legs?: Pt[][];
  robe?: boolean;
}

interface Actor {
  node: ReactNode;
  /** world-space hand positions, in the order of `arms` */
  hand: Pt[];
  head: Pt;
}

const POSE = {
  stand: { arms: [[[-1.5, 6], [-1.8, 10]], [[1.5, 6], [1.8, 10]]] },
  walk: { lean: 4, arms: [[[-3, 5.5], [-4.5, 9.5]], [[3, 5.5], [5, 9]]], legs: [[[-4, 10]], [[2, 5], [4, 10]]] },
  run: { lean: 18, arms: [[[-5, 4], [-8, 1]], [[5, 4], [7, -1]]], legs: [[[-6, 5], [-10, 8]], [[6, 4], [6, 10]]] },
  lunge: { lean: 20, arms: [[[4, 5], [8, 4]], [[7, 2], [12, 0]]], legs: [[[-7, 10]], [[5, 4], [7, 10]]] },
  pull: { lean: -26, arms: [[[6, 1], [11, -1]], [[6, 2.5], [11, 1]]], legs: [[[-5, 10]], [[5, 5], [7, 10]]] },
  push: { lean: 40, arms: [[[6, -1], [10, -2]], [[6, 1], [10, 0]]], legs: [[[-8, 9]], [[3, 4], [2, 10]]] },
  bend: { lean: 58, arms: [[[5, 5], [8, 9]], [[3, 6], [5, 10]]], legs: [[[-3, 10]], [[3, 10]]] },
  carry: { lean: 3, arms: [[[3, -3], [2, -7]], [[-2, -3], [-1, -7]]], legs: [[[-4, 10]], [[2, 5], [4, 10]]] },
  dance: { lean: 8, arms: [[[-4, -5], [-6, -11]], [[4, -5], [7, -10]]], legs: [[[-3, 10]], [[4, 5], [8, 6]]] },
  raise: { arms: [[[-2, 6], [-2.5, 10]], [[3, -5], [4, -11]]] },
  kneelAim: { hip: -6, lean: 4, arms: [[[2, -1], [1, -3]], [[5, -4], [8, -7]]], legs: [[[5, 0], [5, 6]], [[-2, 6], [-8, 6]]] },
  aimUp: { lean: -6, arms: [[[2, -2], [1, -4]], [[5, -5], [8, -9]]], legs: [[[-4, 10]], [[3, 10]]] },
  crouch: { hip: -6, lean: 32, arms: [[[4, 4], [8, 6]], [[3, 5], [5, 8]]], legs: [[[5, 1], [4, 6]], [[-3, 5], [-7, 6]]] },
  recoil: { lean: -22, arms: [[[-3, -4], [-5, -9]], [[4, -4], [7, -9]]], legs: [[[-6, 10]], [[3, 5], [5, 10]]] },
  throwF: { lean: 16, arms: [[[6, -3], [11, -7]], [[-5, 4], [-8, 7]]], legs: [[[-7, 10]], [[5, 4], [7, 10]]] },
  leap: { lean: 28, arms: [[[5, -4], [9, -9]], [[6, 0], [10, -2]]], legs: [[[-6, 4], [-11, 7]], [[5, 2], [7, 7]]] },
} satisfies Record<string, Pose>;

function act(c: Ctx, x: number, y: number, s: number, P: Pose, o: { flip?: boolean; fill?: string } = {}): Actor {
  const f = o.fill ?? c.dark;
  const k = o.flip ? -1 : 1;
  const hy = P.hip ?? -10;
  const a = ((P.lean ?? 0) * Math.PI) / 180;
  const at = (d: number, w: number): Pt => [Math.sin(a) * d + Math.cos(a) * w, hy - Math.cos(a) * d + Math.sin(a) * w];
  const sh = at(10.6, 0);
  const hd = at(14.9, 0);
  const torso = [at(-0.5, -2.2), at(4.5, -1.7), at(10.8, -3.1), at(10.8, 3.1), at(4.5, 1.7), at(-0.5, 2.2)];
  const arms = P.arms.map((pl) => [[0, 0.4] as Pt, ...pl].map(([dx, dy]) => [sh[0] + dx, sh[1] + dy] as Pt));
  const legs = (P.legs ?? [[[-2, 10]], [[2, 10]]]).map((pl) => [[0, 0] as Pt, ...pl].map(([dx, dy]) => [dx, hy + dy] as Pt));
  const W = (p: Pt): Pt => [x + k * p[0] * s, y + p[1] * s];
  const waist = at(3, 0);
  const node = (
    <g transform={`translate(${r2(x)} ${r2(y)}) scale(${r2(k * s)} ${r2(s)})`}>
      {P.robe ? (
        <polygon points={pts([at(3, -2.4), at(3, 2.4), [waist[0] + 5.4, 0], [waist[0] - 5.4, 0]])} fill={f} />
      ) : (
        <path d={legs.map(line).join(' ')} {...dk(c, 2, f)} />
      )}
      <polygon points={pts(torso)} fill={f} />
      <circle cx={r2(hd[0])} cy={r2(hd[1])} r={2.7} fill={f} />
      <path d={arms.map(line).join(' ')} {...dk(c, 1.7, f)} />
    </g>
  );
  return { node, hand: arms.map((pl) => W(pl[pl.length - 1])), head: W(hd) };
}

/** Arrowhead with its tip at (x, y), pointing along `ang` (radians). */
function aHead(c: Ctx, x: number, y: number, ang: number, sz = 3, fill?: string) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const p = (f: number, s2: number): Pt => [x + ca * f - sa * s2, y + sa * f + ca * s2];
  return <polygon points={pts([[x, y], p(-sz * 1.6, sz * 0.75), p(-sz * 1.05, 0), p(-sz * 1.6, -sz * 0.75)])} fill={fill ?? c.p.accent} />;
}

/** A straight arrow (shaft + head + fletching) with the tip at (x, y). */
function arrowAt(c: Ctx, x: number, y: number, ang: number, len = 12, w = 0.8) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const bx = x - ca * len;
  const by = y - sa * len;
  return (
    <g>
      <line x1={r2(bx)} y1={r2(by)} x2={r2(x)} y2={r2(y)} {...dk(c, w)} />
      {aHead(c, x, y, ang, 1.6 + w)}
      <path d={`M${r2(bx)},${r2(by)} l${r2(-ca * 3 - sa * 1.6)},${r2(-sa * 3 + ca * 1.6)} M${r2(bx)},${r2(by)} l${r2(-ca * 3 + sa * 1.6)},${r2(-sa * 3 - ca * 1.6)}`} {...ln(c, 0.6, 0.8)} />
    </g>
  );
}

/** Curved motion trail a→b (control q), optionally ending in an arrowhead. */
function trail(c: Ctx, a: Pt, q: Pt, b: Pt, o: { w?: number; op?: number; dash?: string; head?: number; col?: string } = {}) {
  const ang = Math.atan2(b[1] - q[1], b[0] - q[0]);
  return (
    <g>
      <path d={`M${P2(a)} Q${P2(q)} ${P2(b)}`} {...ln(c, o.w ?? 0.9, o.op ?? 0.7)} stroke={o.col ?? c.p.accent} strokeDasharray={o.dash} />
      {o.head ? aHead(c, b[0], b[1], ang, o.head, o.col) : null}
    </g>
  );
}

/** Starburst impact flash. */
function impact(c: Ctx, x: number, y: number, r: number, seed = 1, n = 9) {
  const R = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.5;
    const a1 = r * (0.35 + R() * 0.15);
    const a2 = r * (0.75 + R() * 0.5);
    d += `M${r2(x + Math.cos(a) * a1)},${r2(y + Math.sin(a) * a1)} L${r2(x + Math.cos(a) * a2)},${r2(y + Math.sin(a) * a2)} `;
  }
  return (
    <g>
      <circle cx={x} cy={y} r={r * 2.2} fill={c.u('glow')} />
      <path d={d} {...ln(c, 1, 0.95)} />
      <circle cx={x} cy={y} r={r * 0.28} fill={mix(c.p.accent, '#ffffff', 0.55)} />
    </g>
  );
}

/** Horizontal speed lines ending at x (drawn to the left, or right when dir = 1). */
function speed(c: Ctx, x: number, y: number, lens: number[], gap = 5, dir = -1, op = 0.5) {
  const d = lens.map((L, i) => `M${r2(x)},${r2(y + i * gap)} h${r2(dir * L)}`).join(' ');
  return <path d={d} {...ln(c, 0.8, op)} />;
}

function dust(c: Ctx, x: number, y: number, w: number, seed = 3) {
  const R = rng(seed);
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx={r2(x + (R() - 0.5) * w)} cy={r2(y - R() * 4)} rx={r2(w * (0.18 + R() * 0.16))} ry={r2(2 + R() * 2.4)} fill={i % 2 ? c.mid : c.p.accent} opacity={i % 2 ? 0.35 : 0.14} />
      ))}
    </g>
  );
}

function smoke(c: Ctx, x: number, y: number, h: number, sway = 4, op = 0.4) {
  let d = `M${x},${y}`;
  const n = Math.max(2, Math.round(h / 8));
  for (let i = 0; i < n; i++) d += ` q${i % 2 ? sway : -sway},${r2(-h / n / 2)} 0,${r2(-h / n)}`;
  return <path d={d} {...dk(c, 2.2, mix(c.mid, c.p.accent, 0.25))} opacity={op} />;
}

function sparks(c: Ctx, x: number, y: number, rx: number, ry: number, n: number, seed = 5, w = 1.2) {
  const R = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) d += `M${r2(x + (R() - 0.5) * 2 * rx)},${r2(y + (R() - 0.5) * 2 * ry)} h0.01 `;
  return <path d={d} {...ln(c, w, 0.9)} />;
}

/** Sack, base centre at (x,y). */
function sack(c: Ctx, x: number, y: number, s = 1) {
  return (
    <g transform={`translate(${r2(x)} ${r2(y)}) scale(${s})`}>
      <path d="M-5,0 Q-7.4,-7 -3,-10.5 L-1.6,-12.5 L1.6,-12.5 L3,-10.5 Q7.4,-7 5,0 Z" fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
      <path d="M-2.6,-10.6 h5.2" {...dk(c, 0.9)} />
    </g>
  );
}

/** A drawn bow held at `grip`, string pulled to `draw`. */
function bowDraw(c: Ctx, grip: Pt, draw: Pt, s: number) {
  const dx = grip[0] - draw[0];
  const dy = grip[1] - draw[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const px = -uy;
  const py = ux;
  const e1: Pt = [grip[0] - ux * 3 * s + px * 9 * s, grip[1] - uy * 3 * s + py * 9 * s];
  const e2: Pt = [grip[0] - ux * 3 * s - px * 9 * s, grip[1] - uy * 3 * s - py * 9 * s];
  const mid: Pt = [grip[0] + ux * 4 * s, grip[1] + uy * 4 * s];
  const tip: Pt = [grip[0] + ux * 5 * s, grip[1] + uy * 5 * s];
  return (
    <g>
      <path d={`M${P2(e1)} Q${P2(mid)} ${P2(e2)}`} {...dk(c, 1.3 * s)} />
      <path d={`M${P2(e1)} L${P2(draw)} L${P2(e2)}`} {...ln(c, 0.5 * s, 0.9)} />
      <path d={line([draw, tip])} {...dk(c, 0.7 * s)} />
      {aHead(c, tip[0], tip[1], Math.atan2(uy, ux), 1.8 * s)}
    </g>
  );
}

/** Spear held through two hands, extended beyond the front hand. */
function heldSpear(c: Ctx, back: Pt, front: Pt, behind = 8, ahead = 14, w = 1) {
  const dx = front[0] - back[0];
  const dy = front[1] - back[1];
  const L = Math.hypot(dx, dy) || 1;
  return spear(c, back[0] - (dx / L) * behind, back[1] - (dy / L) * behind, front[0] + (dx / L) * ahead, front[1] + (dy / L) * ahead, w);
}

function ox(c: Ctx, x: number, y: number, s: number) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-11,-10 L-13,0 M-7,-10 L-5,0 M8,-10 L10,0 M12,-10 L12,0" {...dk(c, 2.2)} />
      <path d="M-15,-14 Q-18,-10 -17,-4" {...dk(c, 1)} />
      <path d="M-15,-16 Q-15,-21 -6,-21 L8,-22 Q12,-24 15,-21 L21,-17 L24,-12 L21,-10 L16,-12 L13,-9 L-12,-9 Q-15,-10 -15,-16 Z" fill={c.dark} />
      <path d="M17,-20 q1,-5 5,-5 M16,-20 q-2,-4 1,-6" {...dk(c, 1.1, c.mid)} />
      <path d="M-10,-20 Q2,-22 10,-21" {...ln(c, 0.5, 0.45)} />
    </g>
  );
}

function llama(c: Ctx, x: number, y: number, s: number, rot = 0) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M-6,-9 L-7,0 M-3,-9 L-2.5,0 M5,-9 L5.5,0 M8,-9 L9,0" {...dk(c, 1.4)} />
      <ellipse cx={1} cy={-11} rx={9} ry={4} fill={c.dark} />
      <polygon points="6,-13 8.6,-24 8.6,-28 12.6,-28.4 14.2,-26.4 10.6,-25 10.4,-12" fill={c.dark} />
      <path d="M9.4,-28 l-0.4,-3 M11.4,-28 l0.4,-3 M-8,-12 q-2,0 -2,3" {...dk(c, 0.9)} />
      <rect x={-5} y={-18} width={10} height={7} rx={1.2} fill={c.u('lit')} />
      <path d="M-5,-14.5 h10" {...dk(c, 0.6)} />
      <path d="M0,-11 v3" {...ln(c, 0.8, 0.85)} />
    </g>
  );
}

function rat(c: Ctx, x: number, y: number, s: number, flip = false) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-4,-1.5 Q-9,-1 -12,2" {...dk(c, 0.6, c.deep)} />
      <path d="M-4.5,0 Q-5,-4.5 0,-4.6 Q4,-4.5 6.5,-1.5 L8,-0.6 L5,0 Z" fill={c.deep} />
      <circle cx={2} cy={-4.4} r={1.2} fill={c.deep} />
      <circle cx={4.6} cy={-2.4} r={0.35} fill={c.p.accent} />
    </g>
  );
}

/** Round-hulled merchant ship facing right, waterline at y. */
function roundShip(c: Ctx, x: number, y: number, s: number, flip = false) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M0,-6 L0,-40 M-14,-38 L14,-38" {...dk(c, 1.4)} />
      <path d="M-13,-37 L13,-37 Q16,-24 12,-12 L-12,-12 Q-15,-24 -13,-37 Z" fill={c.u('lit')} />
      <path d="M-26,-10 Q-22,2 0,2 Q22,2 28,-12 Q20,-6 -18,-6 Q-24,-7 -26,-10 Z" fill={c.dark} />
      <path d="M-26,-10 q-3,-5 1,-7" {...dk(c, 1.4)} />
      <path d="M-20,-4 Q0,-1 24,-8" {...ln(c, 0.6, 0.5)} />
    </g>
  );
}

/** Top-down galley with oars and wake, bow pointing along `ang` degrees. */
function topGalley(c: Ctx, x: number, y: number, ang: number, s: number) {
  let oars = '';
  for (let i = -8; i <= 6; i += 3.5) oars += `M${i},-2.4 L${i - 1},-4.6 M${i},2.4 L${i - 1},4.6 `;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)}) rotate(${r2(ang)}) scale(${s})`}>
      <path d="M-13,-2 Q-22,-4 -30,-7 M-13,2 Q-22,4 -30,7" {...ln(c, 0.8, 0.6)} />
      <path d={oars} {...ln(c, 0.5, 0.5)} stroke={c.dark} />
      <path d="M-12,0 Q-8,-3.4 7,-2.6 L14,0 L7,2.6 Q-8,3.4 -12,0 Z" fill={c.u('litH')} stroke={c.dark} strokeWidth={0.6} />
      <path d="M-9,0 H8" {...dk(c, 0.8)} />
      <path d="M14,0 h3.4" {...dk(c, 1.2, c.p.accent)} />
    </g>
  );
}

/** Distant town silhouette. */
function skyline(c: Ctx, y: number, x0: number, x1: number, seed: number, op = 0.45) {
  const R = rng(seed);
  let d = `M${x0},${y}`;
  for (let x = x0; x < x1; ) {
    const w = 6 + R() * 10;
    const h = 4 + R() * 9;
    d += ` V${r2(y - h)} H${r2(Math.min(x1, x + w))}`;
    x += w;
  }
  d += ` V${y} Z`;
  return <path d={d} fill={c.u('shade')} opacity={op} />;
}

/* ------------------------------------------------------------------------ */
/* Motifs: every plate shows the card's effect in progress                   */
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

/** Domed storehouse used by Granary / Qullqa. */
function silo(c: Ctx, x: number, w: number, h: number, base = H) {
  return (
    <g>
      <rect x={x - w / 2} y={base - h} width={w} height={h} fill={c.u('lit')} />
      <rect x={x + w * 0.12} y={base - h} width={w * 0.38} height={h} fill={c.u('shade')} fillOpacity={0.55} />
      <path d={`M${x - w / 2 - 1},${base - h} Q${x},${base - h - w * 0.95} ${x + w / 2 + 1},${base - h} Z`} fill={c.u('lit')} />
      <path d={`M${x - w / 2 - 1},${base - h} Q${x},${base - h - w * 0.95} ${x + w / 2 + 1},${base - h}`} {...ln(c, 0.8, 0.55)} />
      <path d={`M${x - w / 2},${base - h * 0.66} h${w} M${x - w / 2},${base - h * 0.33} h${w}`} {...ln(c, 0.6, 0.45)} stroke={c.dark} />
      <path d={`M${x - w * 0.13},${base} v${-h * 0.32} a${w * 0.13},${w * 0.13} 0 0 1 ${w * 0.26},0 v${h * 0.32} Z`} fill={c.deep} />
    </g>
  );
}

const MOTIFS: Record<string, Draw> = {
  /* ---------------------------------- Common ---------------------------------- */

  /** Farmland: reaper cutting standing grain, porter carrying a sheaf home. */
  farm: (c) => {
    const R = rng(12);
    let grain = '';
    let heads = '';
    let stub = '';
    for (let x = 118; x < 206; x += 2.4) {
      const bx = x + (R() - 0.5) * 1.4;
      const top = 68 + R() * 6;
      grain += `M${r2(bx)},${H + 8} L${r2(bx + 1.2)},${r2(top)} `;
      heads += `M${r2(bx + 1.2)},${r2(top)} l0.7,-4 `;
    }
    for (let x = 4; x < 114; x += 3.4) stub += `M${r2(x + R())},${r2(H + 3 + R() * 22)} l0.4,-2.4 `;
    const reaper = act(c, 98, 110, 1.4, POSE.bend);
    const [hx, hy] = reaper.hand[0];
    const carrier = act(c, 58, 118, 1.3, POSE.carry, { flip: true });
    const [cx, cy] = carrier.head;
    return (
      <>
        {sun(c, 36, 66, 8)}
        {hills(c, 92, 9, 3, 0.45)}
        <path d="M142,93 l7,-7 l7,7 Z M156,93 l5,-5 l5,5 Z" fill={c.u('shade')} opacity={0.55} />
        {ground(c)}
        <polygon points={`114,72 206,66 206,${H + 8} 114,${H + 8}`} fill={c.u('lit')} opacity={0.22} />
        <path d={stub} {...ln(c, 0.6, 0.45)} />
        <path d={grain} {...dk(c, 0.7, c.mid)} />
        <path d={heads} {...ln(c, 1.3, 0.9)} />
        <path d={`M${r2(hx - 12)},${r2(hy - 16)} A18,18 0 0 0 ${r2(hx + 3)},${r2(hy + 5)}`} {...ln(c, 0.9, 0.55)} strokeDasharray="2 2.2" />
        {reaper.node}
        <path d={`M${r2(hx)},${r2(hy)} a5.5,5.5 0 0 1 8,-5.4`} {...dk(c, 1.4, c.p.accent)} />
        <path d={`M${r2(hx + 10)},${r2(hy - 8)} l5,-6 M${r2(hx + 12)},${r2(hy - 4)} l6,-3`} {...ln(c, 0.9, 0.85)} />
        {sheaf(c, 22, 121, 1.35)}
        {sheaf(c, 35, 124, 1.15)}
        {carrier.node}
        <g transform={`rotate(-14 ${r2(cx)} ${r2(cy)})`}>{sheaf(c, cx, cy - 1, 0.9)}</g>
      </>
    );
  },

  /** Granary / Qullqa: porters bring sacks; one tips grain into the dome hatch. */
  granary: (c) => {
    const p1 = act(c, 34, 118, 1.3, POSE.carry);
    const p2 = act(c, 64, 110, 1.1, POSE.carry);
    const pour = act(c, 99, 73, 0.95, { lean: 20, arms: [[[6, -6], [10, -12]], [[7, -4], [11, -9]]], legs: [[[-1, 10]], [[3, 6], [3, 10]]] });
    const [sx, sy] = pour.hand[0];
    let rungs = '';
    for (let t = 0.1; t < 1; t += 0.13) rungs += `M${r2(86 + 16 * t)},${r2(H - 44 * t)} l5,0 `;
    return (
      <>
        {sun(c, 172, 50, 7)}
        {hills(c, 92, 7, 17, 0.45)}
        {ground(c)}
        <path d={`M-5,124 Q40,112 92,${H + 1}`} {...dk(c, 9, c.mid)} opacity={0.6} />
        {silo(c, 172, 22, 22)}
        {silo(c, 126, 32, 32)}
        <path d={`M86,${H} L102,54 M91,${H} L107,54 ${rungs}`} {...dk(c, 1.1)} />
        {pour.node}
        <g transform={`rotate(-50 ${r2(sx)} ${r2(sy)})`}>{sack(c, sx + 2, sy + 4, 0.8)}</g>
        <path d={`M${r2(sx + 6)},${r2(sy - 1)} Q${r2(sx + 12)},${r2(sy + 2)} 125,51`} {...ln(c, 1.6, 0.9)} strokeDasharray="0.6 1.8" />
        <ellipse cx={126} cy={51.5} rx={3.4} ry={1.3} fill={c.deep} />
        {sack(c, 78, 104, 1)}
        {sack(c, 70, 106, 0.9)}
        {p2.node}
        {sack(c, p2.head[0] + 1, p2.head[1] - 2, 0.85)}
        {p1.node}
        {sack(c, p1.head[0] + 1, p1.head[1] - 2, 1)}
        {speed(c, 18, 96, [8, 12, 6], 4)}
      </>
    );
  },

  /** Quarry: a hammer drives a wedge, the block splits, a second worker levers it free. */
  quarry: (c) => {
    const striker = act(c, 78, 120, 1.4, { lean: 12, arms: [[[5, -4], [9, -8]], [[4, -3], [8, -7]]], legs: [[[-6, 10]], [[4, 4], [5, 10]]] });
    const [hx, hy] = striker.hand[0];
    const lever = act(c, 160, 120, 1.25, POSE.push, { flip: true });
    const [lx, ly] = lever.hand[1];
    return (
      <>
        {sun(c, 178, 30, 7)}
        <polygon points="0,26 52,26 52,42 80,42 80,58 108,58 108,76 136,76 136,98 0,98" fill={c.u('shade')} />
        <path d="M0,26 h52 M52,42 h28 M80,58 h28 M108,76 h28" {...ln(c, 2.2, 0.85)} />
        <path d="M52,26 v16 M80,42 v16 M108,58 v18 M136,76 v22" {...ln(c, 0.8, 0.45)} />
        {tinyFig(c, 64, 42, 0.42, true)}
        {tinyFig(c, 92, 58, 0.42)}
        {cube(c, 112, 76, 12, 7)}
        {ground(c)}
        {cube(c, 92, 118, 38, 18, 11)}
        <path d="M108,100 l3,5 l-2,4 l4,5 l-1,4" {...dk(c, 1.6, c.deep)} />
        <path d="M108,100 l3,5 l-2,4 l4,5 l-1,4" {...ln(c, 0.8, 0.95)} />
        <path d="M106,94 l3,-6 l3,6 Z" fill={c.mid} />
        {impact(c, 109, 89, 7, 4)}
        {sparks(c, 112, 80, 14, 8, 9, 6)}
        <path d={`M76,48 A34,34 0 0 1 ${r2(hx + 12)},${r2(hy + 4)}`} {...ln(c, 0.9, 0.55)} strokeDasharray="2.4 2" />
        {striker.node}
        <path d={`M${r2(hx)},${r2(hy)} L108,86`} {...dk(c, 1.6)} />
        <rect x={103} y={81} width={10} height={6} rx={1.2} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.7} transform="rotate(40 108 84)" />
        <path d={`M${r2(lx)},${r2(ly)} L128,116`} {...dk(c, 1.6)} />
        {lever.node}
        {cube(c, 172, 124, 14, 9)}
      </>
    );
  },

  /** Road: an ox-cart rolls along the paving while a column marches on the far road. */
  road: (c) => {
    let joints = '';
    for (let x = 4; x < 204; x += 13) {
      const t = (x + 5) / 210;
      joints += `M${r2(x)},${r2(104 - 8 * t)} L${r2(x - 3)},${r2(122 - 10 * t)} `;
    }
    const drv = act(c, 176, 114, 1.15, POSE.walk);
    const col = [22, 30, 38, 46, 54, 62].map((x, i) => (
      <g key={x}>
        {tinyFig(c, x, 86 - i * 0.6, 0.32)}
        <path d={`M${x + 1.6},${r2(86 - i * 0.6 - 5)} l0.8,-6`} {...ln(c, 0.6, 0.85)} />
      </g>
    ));
    return (
      <>
        {sun(c, 150, 70, 8)}
        {hills(c, 92, 12, 11, 0.5)}
        <path d="M-5,88 Q40,84 70,86 T140,82" {...ln(c, 1.4, 0.4)} />
        {col}
        {ground(c)}
        <polygon points="-5,104 205,96 205,112 -5,122" fill={c.u('lit')} opacity={0.55} />
        <path d="M-5,104 L205,96 M-5,122 L205,112" {...ln(c, 1, 0.7)} />
        <path d={joints} {...ln(c, 0.5, 0.45)} stroke={c.dark} />
        {dust(c, 64, 114, 26, 2)}
        {speed(c, 56, 92, [22, 30, 18], 6)}
        <path d="M114,99 L152,96" {...dk(c, 1.6)} />
        {ox(c, 148, 111, 1.05)}
        <rect x={74} y={88} width={42} height={12} rx={1.5} fill={c.u('shade')} />
        <path d="M74,88 h42" {...ln(c, 0.8, 0.6)} />
        {sack(c, 84, 88, 0.9)}
        {sack(c, 94, 88, 1)}
        {amphora(c, 106, 88, 0.85)}
        <circle cx={95} cy={106} r={9} fill={c.dark} />
        <circle cx={95} cy={106} r={7} {...ln(c, 0.7, 0.6)} />
        <path d="M95,99 V113 M88,106 H102 M90,101 L100,111 M100,101 L90,111" {...ln(c, 0.5, 0.45)} />
        <path d="M83,103 A13,13 0 0 1 90,95 M84,111 A13,13 0 0 0 91,118" {...ln(c, 0.7, 0.6)} />
        {drv.node}
        <path d={`M${r2(drv.hand[1][0])},${r2(drv.hand[1][1])} L170,82`} {...dk(c, 0.8)} />
        <rect x={192} y={88} width={5} height={13} rx={2.5} fill={c.u('lit')} />
      </>
    );
  },

  /** Market: two traders exchange goods across the stalls. */
  market: (c) => {
    const give: Pose = { lean: 8, robe: true, arms: [[[5, 3], [10, 1]], [[-1, 6], [0, 10]]] };
    const a = act(c, 80, 118, 1.5, give);
    const b = act(c, 122, 118, 1.5, give, { flip: true });
    const [ax, ay] = a.hand[0];
    const [bx, by] = b.hand[0];
    const stall = (x: number, w: number, key: string) => {
      let sc = `M${x},62`;
      for (let k = 0; k < w / 8; k++) sc += ` q4,4 8,0`;
      return (
        <g key={key}>
          <path d={`M${x + 3},62 V${H} M${x + w - 3},62 V${H}`} {...dk(c, 1.3)} />
          <polygon points={pts([[x, 62], [x + w, 62], [x + w - 5, 51], [x + 5, 51]])} fill={c.u('lit')} />
          <path d={sc} fill={c.p.secondary} />
          <rect x={x + 3} y={84} width={w - 6} height={14} fill={c.dark} />
          <path d={`M${x + 8},83 a3,3 0 0 1 6,0 Z M${x + 17},83 a3,3 0 0 1 6,0 Z`} fill={c.p.accent} fillOpacity={0.8} />
        </g>
      );
    };
    return (
      <>
        {skyline(c, 66, 0, 200, 23, 0.5)}
        {ground(c)}
        {stall(4, 48, 'l')}
        {stall(150, 48, 'r')}
        <path d={`M${r2(ax - 1)},${r2(ay - 8)} Q100,${r2(ay - 30)} ${r2(bx + 1)},${r2(by - 9)}`} {...ln(c, 1, 0.8)} strokeDasharray="3 2" />
        {aHead(c, bx + 1, by - 9, 0.9, 2.6)}
        <path d={`M${r2(bx + 1)},${r2(by + 9)} Q100,${r2(by + 22)} ${r2(ax - 1)},${r2(ay + 9)}`} {...ln(c, 1, 0.8)} strokeDasharray="3 2" />
        {aHead(c, ax - 1, ay + 9, -2.25, 2.6)}
        {a.node}
        {b.node}
        <g transform={`rotate(-70 ${r2(ax + 2)} ${r2(ay)})`}>{amphora(c, ax + 2, ay + 6, 0.8)}</g>
        <path d={`M${r2(bx - 4)},${r2(by - 1)} q-3,-6 2,-7 q5,1 2,7 Z`} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
        {sparks(c, 101, ay - 4, 4, 4, 4, 9, 1.4)}
        {amphora(c, 30, 122, 1)}
        {amphora(c, 40, 125, 0.9)}
        <path d="M156,124 h20 l-3,-7 h-14 Z" fill={c.u('lit')} />
        <path d="M160,117 a3,3 0 0 1 6,0 Z M166,117 a3,3 0 0 1 6,0 Z" fill={c.p.accent} />
      </>
    );
  },

  /** City Walls / Walls of Uruk: arrows and stones break harmlessly on the wall while sentries hold. */
  walls: (c) => {
    let mer = '';
    for (let x = 0; x < 200; x += 9) if (x < 22 || (x > 54 && x < 144) || x > 176) mer += `M${x + 1},58 v-5 h5 v5 Z `;
    for (const t of [24, 146]) for (let k = 0; k < 3; k++) mer += `M${t + 1 + k * 10},40 v-6 h6 v6 Z `;
    let courses = '';
    for (let y = 64; y < H; y += 6) courses += `M0,${y} H200 `;
    const sentry = (x: number, y: number, P: Pose, flip = false, key = '') => {
      const s = act(c, x, y, 0.62, P, { flip });
      return <g key={key}>{s.node}{spear(c, s.hand[1][0], s.hand[1][1] + 4, s.hand[1][0] + (flip ? -1 : 1), s.hand[1][1] - 12, 0.7)}</g>;
    };
    const archer = (x: number) => {
      const a = act(c, x, 126, 0.95, POSE.aimUp, { fill: c.deep });
      return <g key={x}>{a.node}{bowDraw(c, a.hand[1], a.hand[0], 0.95)}</g>;
    };
    return (
      <>
        {sun(c, 170, 22, 6)}
        {ground(c)}
        <rect x={0} y={58} width={200} height={40} fill={c.u('lit')} />
        <path d={courses} {...ln(c, 0.5, 0.35)} stroke={c.dark} />
        <rect x={24} y={40} width={30} height={58} fill={c.u('lit')} />
        <rect x={146} y={40} width={30} height={58} fill={c.u('lit')} />
        <rect x={42} y={40} width={12} height={58} fill={c.u('shade')} opacity={0.6} />
        <rect x={164} y={40} width={12} height={58} fill={c.u('shade')} opacity={0.6} />
        {sentry(12, 58, POSE.stand, false, 'a')}
        {sentry(39, 40, POSE.raise, false, 'b')}
        {sentry(120, 58, POSE.stand, true, 'c')}
        {sentry(161, 40, POSE.stand, true, 'd')}
        {sentry(188, 58, POSE.stand, true, 'e')}
        <path d={mer} fill={c.u('lit')} />
        <path d={`M88,${H} L88,78 A12,12 0 0 1 112,78 L112,${H} Z`} fill={c.deep} />
        <path d={`M88,${H} L88,78 A12,12 0 0 1 112,78 L112,${H}`} {...ln(c, 1.2, 0.8)} />
        <path d={`M94,80 V${H} M100,70 V${H} M106,80 V${H}`} {...ln(c, 0.5, 0.3)} />
        {trail(c, [10, 104], [30, 40], [62, 70], { dash: '2 2.4', op: 0.5 })}
        {trail(c, [34, 104], [70, 30], [128, 72], { dash: '2 2.4', op: 0.5 })}
        {impact(c, 62, 70, 4.5, 2)}
        {impact(c, 128, 72, 4.5, 7)}
        {arrowAt(c, 74, 84, 2.6, 10)}
        {arrowAt(c, 70, 82, 1.9, 9)}
        {arrowAt(c, 140, 88, 2.2, 10)}
        <path d="M60,74 l-2,4 l2,3 M130,76 l2,5" {...dk(c, 0.9, c.deep)} />
        {archer(16)}
        {archer(40)}
      </>
    );
  },

  /** Barracks: a drill line thrusts spears in unison at the instructor's signal. */
  barracks: (c) => {
    const drill = [62, 90, 118, 146].map((x, i) => {
      const s = act(c, x, 120, 1.2, POSE.lunge);
      const [b, f] = s.hand;
      return (
        <g key={x}>
          {roundShield(c, x - 4, 104, 5.2)}
          {s.node}
          {heldSpear(c, b, f, 8, 14, 1)}
          {speed(c, f[0] + 25, f[1] - 2 + (i % 2), [6, 9], 3, 1, 0.6)}
        </g>
      );
    });
    const sgt = act(c, 26, 122, 1.35, POSE.raise);
    return (
      <>
        {hills(c, 80, 6, 21, 0.4)}
        {ground(c, 84)}
        <rect x={12} y={52} width={130} height={32} fill={c.u('lit')} />
        <rect x={104} y={52} width={38} height={32} fill={c.u('shade')} opacity={0.45} />
        <polygon points="6,53 77,40 148,53" fill={c.u('shade')} />
        <path d="M6,53 L77,40 L148,53" {...ln(c, 1, 0.7)} />
        <path d="M24,84 v-16 h9 v16 Z M46,84 v-16 h9 v16 Z M68,84 v-16 h9 v16 Z" fill={c.deep} />
        <polygon points="-5,92 205,92 205,126 -5,126" fill={c.u('lit')} opacity={0.32} />
        <path d="M-5,92 H205" {...ln(c, 0.6, 0.5)} />
        <path d="M156,84 V58 M196,84 V58 M154,64 H198 M154,76 H198" {...dk(c, 1.4)} />
        {[160, 166, 172, 178, 184, 190].map((x) => (
          <g key={x}>{spear(c, x, 84, x - 1, 52, 0.8)}</g>
        ))}
        {sgt.node}
        <path d={`M${r2(sgt.hand[1][0])},${r2(sgt.hand[1][1] + 8)} L${r2(sgt.hand[1][0] + 2)},${r2(sgt.hand[1][1] - 8)}`} {...dk(c, 1.2)} />
        <path d={`M${r2(sgt.hand[1][0] + 4)},${r2(sgt.hand[1][1] - 4)} a5,5 0 0 1 4,4 M${r2(sgt.hand[1][0] + 5)},${r2(sgt.hand[1][1] - 9)} a9,9 0 0 1 7,7`} {...ln(c, 0.8, 0.7)} />
        {drill}
      </>
    );
  },

  /** Temple: a procession climbs to the altar brazier as smoke rises past the columns. */
  temple: (c) => {
    const cols = [0, 1, 2, 3, 4].map((i) => {
      const x = 124 + i * 15;
      return (
        <g key={i}>
          <rect x={x} y={50} width={6} height={36} fill={c.u('lit')} />
          <rect x={x + 3.8} y={50} width={2.2} height={36} fill={c.u('shade')} opacity={0.7} />
          <rect x={x - 1} y={49} width={8} height={2} fill={c.p.accent} />
        </g>
      );
    });
    const steps = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `M${r2(38 + i * 9)},${r2(118 - i * 4.2)} h8`).join(' ');
    const proc = [0.18, 0.4, 0.62, 0.82].map((t, i) => {
      const x = 44 + 64 * t;
      const y = 118 - 32 * t;
      const f = act(c, x, y, 1.05 - t * 0.2, { lean: 6, robe: true, arms: [[[3, -3], [2, -7]], [[-2, 5], [-1, 9]]] });
      return (
        <g key={i}>
          {f.node}
          <path d={`M${r2(f.head[0] - 3.4)},${r2(f.head[1] - 4)} h7 l-1.6,2.4 h-3.8 Z`} fill={c.u('lit')} />
        </g>
      );
    });
    return (
      <>
        {sun(c, 40, 46, 9)}
        {hills(c, 94, 6, 27, 0.45)}
        {ground(c)}
        <rect x={110} y={86} width={92} height={32} fill={c.u('lit')} />
        <rect x={110} y={86} width={92} height={32} fill={c.u('shade')} opacity={0.3} />
        <rect x={118} y={50} width={84} height={36} fill={c.deep} opacity={0.75} />
        {cols}
        <rect x={114} y={44} width={90} height={6} fill={c.u('lit')} />
        <polygon points="112,44 160,28 208,44" fill={c.u('lit')} />
        <path d="M122,42 L160,31 L198,42 Z" {...ln(c, 0.6, 0.6)} stroke={c.dark} />
        <polygon points="30,122 46,122 114,88 106,86" fill={c.u('lit')} />
        <path d={steps} {...ln(c, 0.6, 0.6)} stroke={c.dark} />
        <circle cx={118} cy={74} r={22} fill={c.u('glow')} />
        {smoke(c, 118, 66, 50, 5, 0.5)}
        {smoke(c, 122, 64, 38, 4, 0.35)}
        <path d="M112,86 L118,74 L124,86 M118,74 V86" {...dk(c, 1.3)} />
        <path d="M110,74 h16 l-3,4 h-10 Z" fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
        <path d={flame(118, 74, 14, 5, -1)} fill={c.u('fire')} />
        {sparks(c, 118, 54, 6, 6, 5, 3)}
        {proc}
      </>
    );
  },

  /** Workshop: a carpenter swings an adze at a beam; a siege frame rises behind. */
  workshop: (c) => {
    const wright = act(c, 122, 118, 1.5, { lean: 22, arms: [[[6, -2], [9, -8]], [[5, -1], [8, -7]]], legs: [[[-6, 10]], [[4, 4], [6, 10]]] });
    const [hx, hy] = wright.hand[0];
    const porter = act(c, 36, 118, 1.25, POSE.carry);
    return (
      <>
        {ground(c, 100)}
        <rect x={8} y={30} width={184} height={70} fill={c.u('shade')} />
        <path d="M2,32 L198,26 L198,30 L2,36 Z" fill={c.u('lit')} />
        <path d="M14,34 V100 M186,30 V100" {...dk(c, 2.6)} />
        <path d="M150,96 L166,46 L182,96 M154,84 H178 M158,70 H174 M166,46 V96" {...dk(c, 1.6, c.mid)} />
        <circle cx={154} cy={96} r={5} {...dk(c, 1.2, c.mid)} />
        <path d="M40,46 h18 M44,46 v10 M54,46 v6 M68,44 l10,10 M80,44 v12" {...dk(c, 1.4, c.mid)} />
        <rect x={54} y={94} width={88} height={6} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
        <path d="M62,94 h70" {...ln(c, 0.5, 0.4)} stroke={c.dark} />
        <path d="M62,100 L58,116 M66,100 L70,116 M130,100 L126,116 M134,100 L138,116" {...dk(c, 1.8)} />
        <path d="M86,94 q4,-1 6,-4 l2,4 Z" fill={c.mid} />
        <path d={`M${r2(hx + 12)},40 A36,36 0 0 1 ${r2(hx - 2)},${r2(hy + 14)}`} {...ln(c, 0.9, 0.55)} strokeDasharray="2.4 2" />
        {impact(c, 94, 92, 5, 8)}
        <path d="M92,88 l-6,-8 M96,87 l1,-9 M90,91 l-9,-3" {...ln(c, 1, 0.85)} />
        {wright.node}
        <path d={`M${r2(hx)},${r2(hy)} L${r2(hx - 9)},${r2(hy + 13)}`} {...dk(c, 1.5)} />
        <path d={`M${r2(hx - 9)},${r2(hy + 13)} l-5,-1 l1,3 Z`} fill={c.p.accent} />
        {porter.node}
        <path d={`M${r2(porter.head[0] - 22)},${r2(porter.head[1] - 6)} L${r2(porter.head[0] + 20)},${r2(porter.head[1] - 2)}`} {...dk(c, 3, c.u('lit'))} />
      </>
    );
  },

  /** Militia: villagers charge with whatever weapons they have. */
  militia: (c) => {
    const a = act(c, 128, 118, 1.6, POSE.run);
    const b = act(c, 88, 112, 1.35, POSE.run);
    const d = act(c, 52, 108, 1.15, { ...POSE.run, arms: [[[-4, 4], [-8, 2]], [[4, -4], [6, -10]]] });
    return (
      <>
        {sun(c, 160, 58, 8)}
        {hills(c, 94, 8, 5, 0.5)}
        <path d="M14,94 l6,-6 l6,6 Z M24,94 l5,-5 l5,5 Z" fill={c.u('shade')} opacity={0.6} />
        {ground(c)}
        {dust(c, 34, 108, 24, 1)}
        {dust(c, 66, 114, 26, 4)}
        {dust(c, 104, 120, 28, 7)}
        {speed(c, 30, 72, [14, 22, 16], 6)}
        {speed(c, 62, 78, [16, 24, 14], 6)}
        {d.node}
        <path d={`M${r2(d.hand[1][0])},${r2(d.hand[1][1] + 4)} l2,-12`} {...dk(c, 2.2)} />
        <circle cx={r2(d.hand[1][0] + 2)} cy={r2(d.hand[1][1] - 8)} r={2.4} fill={c.dark} />
        {b.node}
        {heldSpear(c, b.hand[0], b.hand[1], 6, 16)}
        {a.node}
        {heldSpear(c, a.hand[0], a.hand[1], 8, 20, 1.2)}
        <path d={`M${r2(a.hand[1][0] + 30)},${r2(a.hand[1][1] - 12)} l6,-2 M${r2(a.hand[1][0] + 31)},${r2(a.hand[1][1] - 6)} l7,0`} {...ln(c, 0.9, 0.7)} />
      </>
    );
  },

  /** Spearmen: the phalanx advances, spears levelled over locked shields. */
  spearmen: (c) => {
    const xs = [40, 66, 92, 118];
    return (
      <>
        {sun(c, 30, 50, 7)}
        {hills(c, 92, 6, 19, 0.45)}
        {ground(c)}
        {xs.map((x) => (
          <g key={`b${x}`}>{spear(c, x - 8, 104, x - 2, 30, 0.9)}</g>
        ))}
        {xs.map((x) => (
          <g key={`h${x}`}>
            <circle cx={x + 3} cy={61} r={4.8} fill={c.dark} />
            <path d={`M${x - 1.8},60 a4.8,4.8 0 0 1 9.6,0 Z`} fill={c.u('lit')} />
            <path d={`M${x - 2},94 L${x - 8},${H + 14} M${x + 4},94 L${x + 9},${H + 14}`} {...dk(c, 2.8)} />
          </g>
        ))}
        {xs.map((x) => (
          <g key={`r${x}`}>{roundShield(c, x + 4, 82, 14)}</g>
        ))}
        {xs.map((x) => (
          <g key={`s${x}`}>{spear(c, x - 6, 72, x + 60, 66, 1.1)}</g>
        ))}
        {speed(c, 190, 60, [10, 16, 10, 14], 5, 1, 0.55)}
        {dust(c, 70, 112, 70, 11)}
        {speed(c, 30, 70, [14, 20, 12], 8)}
      </>
    );
  },

  /** Archers / Archers of Ta-Seti: a kneeling and standing rank loose a volley. */
  archers: (c) => {
    const front = act(c, 56, 120, 1.7, POSE.kneelAim);
    const back = [
      act(c, 96, 112, 1.25, POSE.aimUp),
      act(c, 126, 106, 1.0, POSE.aimUp),
    ];
    const arcs: [Pt, Pt, Pt][] = [
      [[78, 66], [118, 18], [164, 30]],
      [[112, 72], [148, 22], [186, 36]],
      [[92, 52], [140, 4], [176, 18]],
      [[136, 72], [168, 34], [196, 50]],
    ];
    return (
      <>
        {sun(c, 30, 46, 7)}
        {hills(c, 94, 6, 13, 0.5)}
        {ground(c)}
        {arcs.map(([a, q, b], i) => (
          <g key={i}>
            {trail(c, a, q, b, { dash: '2 2.6', op: 0.55 })}
            {arrowAt(c, b[0], b[1], Math.atan2(b[1] - q[1], b[0] - q[0]), 9, 0.8)}
          </g>
        ))}
        {back.map((a, i) => (
          <g key={i}>
            {a.node}
            {bowDraw(c, a.hand[1], a.hand[0], i ? 1 : 1.25)}
          </g>
        ))}
        {front.node}
        {bowDraw(c, front.hand[1], front.hand[0], 1.7)}
        <path d="M24,110 l-6,10 M28,112 l-4,8" {...dk(c, 1.6, c.mid)} />
        <rect x={20} y={104} width={6} height={12} rx={1.5} fill={c.u('lit')} transform="rotate(-20 23 110)" />
      </>
    );
  },

  /** Battering Ram: the ram strikes the gate; timbers split. */
  ram: (c) => {
    let planks = '';
    for (let x = 172; x < 200; x += 6) planks += `M${x},44 V98 `;
    return (
      <>
        {ground(c)}
        <rect x={164} y={20} width={40} height={78} fill={c.u('lit')} />
        <rect x={166} y={42} width={40} height={56} fill={c.u('shade')} />
        <path d={planks} {...ln(c, 0.6, 0.45)} stroke={c.dark} />
        <path d="M166,56 h40 M166,84 h40" {...dk(c, 1.4)} />
        <path d="M168,74 l8,-4 l4,6 l9,-3 M170,80 l7,6 l8,-2" {...dk(c, 1.2, c.deep)} />
        <path d="M168,74 l8,-4 l4,6 l9,-3" {...ln(c, 0.6, 0.85)} />
        {impact(c, 166, 75, 10, 3, 11)}
        <path d="M156,60 l-6,-6 l2,-2 Z M158,88 l-8,4 l1,3 Z M162,52 l-2,-9 l3,0 Z" fill={c.u('lit')} />
        <rect x={98} y={72} width={64} height={6} rx={1} fill={c.dark} />
        <path d="M156,70 h8 v10 h-8 Z" fill={c.u('lit')} stroke={c.dark} strokeWidth={0.8} />
        <path d="M102,68 l-1,4 M114,68 l1,4" {...dk(c, 1)} />
        <rect x={44} y={84} width={92} height={5} fill={c.dark} />
        {[56, 72, 88, 104, 120].map((x, i) => (
          <path key={x} d={`M${x},89 L${x - 6 + (i % 2) * 2},${H + 1} M${x + 3},89 L${x + 7},${H + 1}`} {...dk(c, 1.8)} />
        ))}
        <polygon points="42,86 62,52 118,52 138,86" fill={c.u('shade')} />
        <polygon points="42,86 62,52 74,52 60,86" fill={c.u('lit')} opacity={0.8} />
        <path d="M66,58 H114 M60,66 H120 M54,74 H126 M48,82 H132" {...ln(c, 0.6, 0.45)} />
        {[60, 120].map((x) => (
          <g key={x}>
            <circle cx={x} cy={93} r={7.5} fill={c.dark} />
            <circle cx={x} cy={93} r={5.5} {...ln(c, 0.7, 0.55)} />
            <circle cx={x} cy={93} r={1.6} fill={c.p.accent} />
          </g>
        ))}
        {speed(c, 36, 58, [14, 22, 26, 18], 7)}
        {dust(c, 40, 100, 24, 9)}
      </>
    );
  },

  /** Harvest Festival: dancers whirl round the brazier beside the piled sheaves. */
  festival: (c) => {
    const back = [act(c, 78, 96, 0.9, POSE.dance), act(c, 122, 96, 0.9, POSE.dance, { flip: true })];
    const front = [act(c, 58, 118, 1.35, POSE.dance, { flip: true }), act(c, 142, 118, 1.35, POSE.dance)];
    return (
      <>
        {night(c, 0.35, true)}
        {ground(c)}
        <circle cx={100} cy={70} r={50} fill={c.u('glow')} />
        {back.map((a, i) => (
          <g key={i}>{a.node}</g>
        ))}
        <path d="M100,86 L88,106 M100,86 L112,106 M100,86 L100,106" {...dk(c, 1.6)} />
        <path d="M84,80 Q100,94 116,80 Z" fill={c.u('lit')} stroke={c.dark} strokeWidth={0.8} />
        <path d={flame(100, 81, 32, 8, -2)} fill={c.u('fire')} />
        <path d={flame(92, 81, 18, 5, -4)} fill={c.u('fire')} opacity={0.85} />
        <path d={flame(108, 81, 20, 5, 3)} fill={c.u('fire')} opacity={0.85} />
        {sparks(c, 100, 34, 12, 12, 8, 4, 1.4)}
        <path d="M100,108 m-46,0 a46,9 0 0 0 92,0" {...ln(c, 0.8, 0.45)} strokeDasharray="3 3" />
        {aHead(c, 146, 107, -0.5, 2.4)}
        {sheaf(c, 16, 116, 1.2)}
        {sheaf(c, 28, 120, 1.3)}
        {sheaf(c, 22, 106, 1)}
        {sheaf(c, 176, 118, 1.25)}
        {sheaf(c, 188, 114, 1.1)}
        {front.map((a, i) => (
          <g key={i}>{a.node}</g>
        ))}
      </>
    );
  },

  /** Caravan: a laden camel train arrives at the city gate. */
  caravan: (c) => {
    const herder = act(c, 146, 112, 1.2, { ...POSE.walk, robe: true, arms: [[[-4, 4], [-8, 6]], [[3, 5.5], [5, 9]]] });
    return (
      <>
        {sun(c, 36, 60, 10)}
        <path d="M-5,88 Q40,74 90,84 T205,80 L205,130 L-5,130 Z" fill={c.u('shade')} opacity={0.6} />
        {ground(c, 98)}
        <path d="M-5,118 Q60,100 140,112 L205,108" {...ln(c, 0.8, 0.45)} />
        <rect x={160} y={44} width={45} height={68} fill={c.u('lit')} />
        <rect x={160} y={44} width={10} height={68} fill={c.u('shade')} opacity={0.5} />
        <path d="M160,44 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h3" fill={c.u('lit')} />
        <path d="M172,112 V84 A11,11 0 0 1 194,84 V112 Z" fill={c.deep} />
        <path d="M172,112 V84 A11,11 0 0 1 194,84 V112" {...ln(c, 1, 0.75)} />
        <circle cx={183} cy={96} r={18} fill={c.u('glow')} opacity={0.7} />
        {dust(c, 24, 106, 30, 3)}
        {camel(c, 30, 104, 0.56)}
        {camel(c, 58, 106, 0.68)}
        {camel(c, 90, 108, 0.82)}
        {camel(c, 124, 112, 0.98)}
        <path d="M35,86 L58,86 M66,85 L90,84 M100,82 L124,80 M136,80 L144,90" {...dk(c, 0.5)} />
        {herder.node}
        {speed(c, 14, 74, [10, 16, 8], 5)}
      </>
    );
  },

  /** Saboteurs: a rope is cut at night; the watch-tower lurches over. */
  saboteurs: (c) => {
    const sab = act(c, 70, 112, 1.35, POSE.crouch);
    const [kx, ky] = sab.hand[0];
    return (
      <>
        {night(c, 0.6)}
        {crescent(c, 34, 26, 8)}
        {skyline(c, 98, 0, 60, 41, 0.45)}
        {ground(c)}
        <g transform="rotate(10 166 98)">
          <path d="M136,98 L140,60 M164,98 L160,60 M138,82 L162,70 M162,82 L138,70" {...dk(c, 2)} />
          <rect x={128} y={56} width={44} height={5} fill={c.u('lit')} />
          <rect x={132} y={34} width={36} height={22} fill={c.u('shade')} />
          <polygon points="126,35 150,22 174,35" fill={c.u('lit')} />
          <rect x={146} y={40} width={8} height={9} fill={c.deep} />
          <path d="M126,35 L150,22 L174,35" {...ln(c, 0.8, 0.7)} />
        </g>
        <path d="M176,44 L200,98" {...dk(c, 0.8)} />
        <path d={`M136,30 Q110,58 ${r2(kx + 18)},${r2(ky - 20)}`} {...dk(c, 0.9)} />
        <path d={`M${r2(kx + 18)},${r2(ky - 20)} l2,-2 m-2,2 l2.4,0.6`} {...ln(c, 0.7, 0.9)} />
        <path d={`M${r2(kx + 3)},${r2(ky - 3)} l3,-3`} {...dk(c, 0.9)} />
        <path d={`M${r2(kx + 5)},${ky + 2} v${r2(H - ky - 2)}`} {...dk(c, 2.2, c.mid)} />
        <path d="M150,10 A44,44 0 0 1 192,40" {...ln(c, 1.1, 0.75)} strokeDasharray="3 2.4" />
        {aHead(c, 192, 40, 1.15, 3)}
        <path d="M128,98 l-4,-4 M170,98 l4,-5 M172,98 l5,-1" {...ln(c, 0.8, 0.7)} />
        {impact(c, kx + 4, ky - 2, 5, 12, 7)}
        {sab.node}
        <path d={`M${r2(kx)},${r2(ky)} l4,-3`} {...dk(c, 1.4, c.p.accent)} />
      </>
    );
  },

  /** Arson: a torch is hurled onto a roof already catching fire. */
  arson: (c) => {
    const thrower = act(c, 38, 118, 1.5, POSE.throwF);
    const [tx, ty] = thrower.hand[0];
    return (
      <>
        {night(c, 0.45)}
        {ground(c)}
        <circle cx={140} cy={60} r={58} fill={c.u('glow')} />
        <rect x={104} y={60} width={76} height={38} fill={c.u('shade')} />
        <polygon points="98,61 142,36 186,61" fill={c.u('shade')} />
        <path d="M98,61 L142,36 L186,61 M104,61 V98 M180,61 V98" {...ln(c, 1, 0.75)} />
        <path d="M134,98 V80 h14 V98 Z M114,72 h10 v8 h-10 Z M160,72 h10 v8 h-10 Z" fill={c.deep} />
        <path d={flame(119, 80, 14, 5, 1)} fill={c.u('fire')} />
        <path d={flame(146, 50, 34, 11, -3)} fill={c.u('fire')} />
        <path d={flame(128, 54, 22, 7, -4)} fill={c.u('fire')} opacity={0.9} />
        <path d={flame(166, 58, 24, 7, 4)} fill={c.u('fire')} opacity={0.9} />
        {smoke(c, 146, 14, 14, 4, 0.4)}
        {smoke(c, 160, 22, 18, 5, 0.3)}
        {sparks(c, 140, 20, 26, 10, 9, 8, 1.3)}
        {trail(c, [tx + 2, ty - 2], [70, 6], [102, 30], { dash: '1 2.6', w: 1.4, op: 0.85 })}
        <g transform="rotate(30 104 32)">
          <rect x={96} y={31} width={10} height={2.2} rx={1} fill={c.dark} />
          <path d={flame(107, 33, 9, 3, 2)} fill={c.u('fire')} transform="rotate(70 107 32)" />
        </g>
        <circle cx={104} cy={32} r={8} fill={c.u('glow')} />
        {thrower.node}
        <path d="M40,120 L-5,126" {...dk(c, 5, c.deep)} opacity={0.5} />
      </>
    );
  },

  /** Spy Network: a listener under a lit window; a faint watching eye above. */
  spy: (c) => {
    const spy = act(c, 112, 104, 1.35, { hip: -6, lean: 14, arms: [[[2, -3], [1, -6]], [[4, 4], [8, 6]]], legs: [[[5, 1], [4, 6]], [[-3, 5], [-7, 6]]] });
    let bricks = '';
    for (let y = 30, r = 0; y < H; y += 8, r++) {
      bricks += `M90,${y} H200 `;
      for (let x = 90 + (r % 2) * 10; x < 200; x += 20) bricks += `M${x},${y} v8 `;
    }
    return (
      <>
        {night(c, 0.55)}
        {skyline(c, 98, 0, 90, 55, 0.6)}
        <path d="M18,40 Q40,26 62,40 Q40,54 18,40 Z" {...ln(c, 0.8, 0.3)} />
        <circle cx={40} cy={40} r={5} {...ln(c, 0.8, 0.3)} />
        <circle cx={40} cy={40} r={1.8} fill={c.p.accent} opacity={0.4} />
        {ground(c)}
        <rect x={90} y={22} width={110} height={76} fill={c.u('shade')} />
        <path d={bricks} {...ln(c, 0.5, 0.2)} />
        <polygon points="128,72 166,72 186,108 112,108" fill={c.p.accent} opacity={0.14} />
        <rect x={128} y={44} width={38} height={28} fill={c.p.accent} opacity={0.75} />
        <circle cx={147} cy={58} r={26} fill={c.u('glow')} />
        <circle cx={139} cy={56} r={3.4} fill={c.dark} />
        <path d="M134,72 Q134,61 139,61 Q144,61 145,72 Z" fill={c.dark} />
        <circle cx={156} cy={55} r={3.4} fill={c.dark} />
        <path d="M150,72 Q151,60 156,60 Q161,60 161,72 Z" fill={c.dark} />
        <path d="M144,62 q2,-2 4,0 M144,58 q2,-3 5,0" {...ln(c, 0.6, 0.6)} stroke={c.deep} />
        <rect x={126} y={72} width={42} height={3} fill={c.u('lit')} />
        <path d="M128,44 h38 v28 h-38 Z M147,44 v28" {...dk(c, 1.4)} />
        {spy.node}
        <path d={`M${r2(spy.head[0] + 4)},${r2(spy.head[1] - 3)} a5,5 0 0 1 3,4 M${r2(spy.head[0] + 5)},${r2(spy.head[1] - 7)} a9,9 0 0 1 6,7`} {...ln(c, 0.8, 0.8)} />
      </>
    );
  },

  /** Spoil the Stores: split sacks spill grain into a spreading stain; rats swarm. */
  poison: (c) => {
    const R = rng(17);
    let grain = '';
    for (let i = 0; i < 34; i++) {
      const x = 92 + R() * 50;
      const y = 112 + R() * 12;
      grain += `M${r2(x)},${r2(y)} l0.8,-1.2 `;
    }
    const thief = act(c, 30, 98, 0.8, POSE.run, { flip: true, fill: c.deep });
    return (
      <>
        {sun(c, 170, 40, 6)}
        {ground(c)}
        <rect x={40} y={36} width={120} height={62} fill={c.u('shade')} />
        <path d="M34,37 L100,22 L166,37 Z" fill={c.u('lit')} />
        <path d="M84,98 V62 h32 V98 Z" fill={c.deep} />
        <path d="M116,62 L130,66 L130,98 L116,98 Z" fill={c.mid} />
        {thief.node}
        {speed(c, 44, 82, [10, 14], 5, 1)}
        <path d="M80,114 Q90,104 112,108 Q140,104 156,112 Q168,120 150,126 Q120,130 96,126 Q74,122 80,114 Z" fill={c.deep} opacity={0.7} />
        {sack(c, 66, 120, 1.7)}
        <g transform="rotate(-62 96 116)">
          {sack(c, 96, 116, 1.8)}
          <path d="M92,104 l3,2 l-2,3 l3,2" {...dk(c, 1, c.deep)} />
        </g>
        <path d="M100,108 Q112,104 120,116" {...ln(c, 3, 0.85)} strokeDasharray="0.6 1.6" />
        <path d={grain} {...ln(c, 0.8, 0.7)} />
        {sack(c, 168, 122, 1.4)}
        <path d="M162,110 l2,4 l-2,3" {...dk(c, 0.9, c.deep)} />
        {rat(c, 120, 118, 1.2)}
        {rat(c, 138, 124, 1.1, true)}
        {rat(c, 150, 114, 1)}
        {rat(c, 108, 126, 1.2, true)}
        <path d="M128,118 h-6 M156,112 h-5" {...ln(c, 0.7, 0.6)} />
      </>
    );
  },

  /** Repair Crews: a fresh stone is hauled up the scaffold and set into the breach. */
  repair: (c) => {
    let blocks = '';
    for (let y = 46, r = 0; y < H; y += 8, r++) {
      blocks += `M24,${y} H160 `;
      for (let x = 24 + (r % 2) * 10; x < 160; x += 20) blocks += `M${x},${y} v8 `;
    }
    const puller = act(c, 178, 118, 1.3, POSE.pull, { flip: true });
    const setter = act(c, 104, 56, 0.85, { lean: 10, arms: [[[5, -6], [8, -11]], [[4, -5], [7, -10]]] });
    const mason = act(c, 62, 78, 0.85, { lean: 10, arms: [[[4, -5], [7, -11]], [[5, 3], [9, 4]]] });
    return (
      <>
        {sun(c, 22, 30, 6)}
        {ground(c)}
        <path d="M24,98 V38 H104 L110,46 L118,40 L126,50 L134,38 H160 V98 Z" fill={c.u('lit')} />
        <path d={blocks} {...ln(c, 0.5, 0.35)} stroke={c.dark} />
        <path d="M118,42 L114,58 L120,70 L112,86" {...dk(c, 1.2, c.deep)} />
        <path d="M36,46 h20 v8 h-20 Z M76,62 h20 v8 h-20 Z" fill="none" stroke={c.p.accent} strokeWidth={0.9} />
        <path d="M44,26 V100 M84,26 V100 M40,56 H112 M40,78 H112 M44,78 L84,56" {...dk(c, 1.7)} />
        <rect x={40} y={55} width={72} height={2.6} fill={c.mid} />
        <rect x={40} y={77} width={72} height={2.6} fill={c.mid} />
        <path d="M150,100 V16 M118,18 H152" {...dk(c, 2)} />
        <circle cx={120} cy={20} r={2.6} fill={c.p.accent} />
        <path d={`M120,22 V30 M120,20 H150 L${r2(puller.hand[1][0])},${r2(puller.hand[1][1])}`} {...dk(c, 0.8)} />
        <rect x={112} y={30} width={16} height={10} fill={c.u('lit')} stroke={c.p.accent} strokeWidth={1} />
        <path d="M134,40 v-12" {...ln(c, 0.9, 0.8)} />
        {aHead(c, 134, 27, -Math.PI / 2, 2.4)}
        {setter.node}
        {mason.node}
        <path d={`M${r2(mason.hand[0][0])},${r2(mason.hand[0][1])} l3,-5`} {...dk(c, 1.2)} />
        <rect x={r2(mason.hand[0][0] + 1)} y={r2(mason.hand[0][1] - 8)} width={5} height={3.4} fill={c.u('lit')} />
        <path d={`M${r2(mason.hand[0][0] - 6)},${r2(mason.hand[0][1] - 8)} a10,10 0 0 1 10,-4`} {...ln(c, 0.8, 0.6)} strokeDasharray="1.6 1.6" />
        {sparks(c, 76, 66, 4, 3, 3, 2)}
        {puller.node}
      </>
    );
  },

  /** Call the Levy: villagers take spears from the rack and gather under the plain banner. */
  levy: (c) => {
    const crowd: [number, number, number, boolean][] = [
      [96, 98, 0.62, true], [112, 97, 0.6, false], [128, 98, 0.62, true], [144, 97, 0.6, true], [160, 98, 0.62, false], [176, 97, 0.58, true],
    ];
    const reach = act(c, 50, 118, 1.3, { lean: -8, arms: [[[-4, -5], [-8, -10]], [[2, 6], [3, 10]]] }, { flip: true });
    const go = act(c, 80, 114, 1.2, POSE.walk);
    const raise = act(c, 114, 120, 1.45, POSE.raise);
    return (
      <>
        {sun(c, 166, 52, 6)}
        {hills(c, 92, 8, 33, 0.5)}
        <path d="M150,92 l6,-7 l6,7 Z M164,92 l5,-5 l5,5 Z" fill={c.u('shade')} opacity={0.6} />
        {ground(c)}
        <path d="M140,110 V18" {...dk(c, 1.8)} />
        <circle cx={140} cy={17} r={2} fill={c.p.accent} />
        <path d="M141,22 Q156,16 174,24 Q166,32 174,42 Q158,35 141,40 Z" fill={c.u('lit')} />
        <path d="M141,22 Q156,16 174,24" {...ln(c, 0.7, 0.7)} />
        <path d="M178,26 q4,2 8,0 M178,34 q4,2 8,0" {...ln(c, 0.8, 0.6)} />
        {crowd.map(([x, y, s, up]) => (
          <g key={x}>
            {tinyFig(c, x, y, s, up)}
            {up && <path d={`M${r2(x + 2.4 * s)},${r2(y - 15 * s)} l${r2(3 * s)},${r2(-14 * s)}`} {...ln(c, 0.8, 0.85)} />}
          </g>
        ))}
        <path d="M8,118 V82 M36,118 V82 M6,90 H38" {...dk(c, 1.6)} />
        {[12, 18, 24, 30].map((x) => (
          <g key={x}>{spear(c, x, 118, x + 1, 74, 0.9)}</g>
        ))}
        {reach.node}
        {go.node}
        {spear(c, go.hand[1][0] - 2, go.hand[1][1] + 8, go.hand[1][0] + 4, go.hand[1][1] - 30, 1)}
        {raise.node}
        {spear(c, raise.hand[1][0], raise.hand[1][1] + 14, raise.hand[1][0] + 2, raise.hand[1][1] - 14, 1.1)}
        {speed(c, 70, 96, [10, 14], 5)}
      </>
    );
  },

  /** Shield Wall: arrows glance off the locked shields. */
  shieldWall: (c) => {
    const xs = [30, 56, 82, 108, 134, 160];
    const hits: Pt[] = [[64, 70], [118, 66], [148, 80], [92, 86]];
    return (
      <>
        {sun(c, 30, 30, 6)}
        {ground(c)}
        {xs.map((x) => (
          <g key={`b${x}`}>
            {spear(c, x - 6, 76, x - 4, 30, 1)}
            <circle cx={x} cy={58} r={5} fill={c.dark} />
            <path d={`M${x - 5},57 a5,5 0 0 1 10,0 Z`} fill={c.u('lit')} />
            <path d={`M${x - 5},90 L${x - 8},${H + 6} M${x + 5},90 L${x + 8},${H + 6}`} {...dk(c, 3)} />
          </g>
        ))}
        {xs.map((x) => (
          <g key={`s${x}`}>{roundShield(c, x, 78, 16)}</g>
        ))}
        {hits.map(([x, y], i) => (
          <g key={i}>
            {trail(c, [x + 60, y - 70], [x + 30, y - 40], [x, y], { dash: '2 2.6', op: 0.45 })}
            {impact(c, x, y, 5, 20 + i, 8)}
            {trail(c, [x + 2, y - 2], [x + 6 + i * 2, y - 26], [x + 18 + i * 3, y - 30], { op: 0.75, w: 0.8 })}
            <g transform={`rotate(${-40 + i * 50} ${x + 18 + i * 3} ${y - 30})`}>{arrowAt(c, x + 22 + i * 3, y - 30, 0, 8, 0.7)}</g>
          </g>
        ))}
        <path d="M30,112 l12,-3 M70,118 l9,2 M130,114 l10,-4 M160,120 l8,1" {...dk(c, 0.9)} />
      </>
    );
  },

  /** Feigned Retreat: the riders flee, wheel round and crash into their pursuers. */
  feignedRetreat: (c) => {
    const p1 = act(c, 170, 114, 1.15, POSE.recoil, { flip: true });
    return (
      <>
        {sun(c, 30, 46, 7)}
        {hills(c, 92, 6, 41, 0.5)}
        {ground(c)}
        {horse(c, 34, 98, 0.55, { flip: true, rider: true })}
        {horse(c, 62, 102, 0.62, { flip: true, rider: true })}
        {speed(c, 76, 88, [8, 12], 4, 1)}
        <path d="M30,78 Q10,30 70,30 Q122,30 112,86" {...ln(c, 1.3, 0.85)} strokeDasharray="4 3" />
        {aHead(c, 112, 86, 1.75, 3.4)}
        {dust(c, 74, 118, 30, 5)}
        {speed(c, 86, 92, [16, 24, 14], 6)}
        {horse(c, 118, 120, 1.25, { rider: true, lance: true })}
        {impact(c, 158, 82, 8, 6)}
        {p1.node}
        <g transform="rotate(-50 190 120)">{act(c, 190, 120, 1.05, POSE.recoil, { flip: true }).node}</g>
        {spear(c, 150, 112, 176, 70, 0.9)}
        <path d="M178,70 l6,-4 M183,78 l7,-1" {...ln(c, 0.9, 0.8)} />
      </>
    );
  },

  /** Turn the Tide: a wave rears up and breaks back over the advancing attackers. */
  turnTheTide: (c) => {
    const att = [
      act(c, 162, 112, 1.05, POSE.recoil, { flip: true }),
      act(c, 188, 116, 1.1, POSE.run, { flip: true }),
    ];
    return (
      <>
        {sun(c, 40, 34, 7)}
        <rect x={0} y={96} width={200} height={34} fill={c.u('water')} />
        <polygon points="128,106 205,98 205,130 118,130" fill={c.u('ground')} />
        <path d="M128,106 L205,98" {...ln(c, 0.7, 0.5)} />
        <path
          d="M-5,106 C40,104 66,98 84,78 C100,60 106,36 132,30 C156,25 178,40 172,56 C169,66 158,68 154,60 C151,54 156,49 161,51 C154,52 146,62 150,74 C153,84 148,98 134,108 L-5,114 Z"
          fill={c.u('lit')}
        />
        <path d="M84,78 C100,60 106,36 132,30 C156,25 178,40 172,56" {...ln(c, 1.2, 0.85)} stroke={c.dark} />
        <path d="M92,84 C108,66 114,46 136,40 M100,94 C116,76 122,58 142,50 M110,102 C126,88 132,72 146,66" {...ln(c, 0.7, 0.5)} stroke={c.dark} />
        <path d="M172,56 q8,10 6,24 M166,62 q6,12 2,26 M176,52 q10,8 14,20" {...ln(c, 1, 0.75)} strokeDasharray="1 2.6" />
        {sparks(c, 166, 30, 22, 10, 10, 11, 1.6)}
        {att.map((a, i) => (
          <g key={i}>{a.node}</g>
        ))}
        <g transform="rotate(35 178 96)">{act(c, 178, 96, 0.9, POSE.recoil, { flip: true }).node}</g>
        {spear(c, 150, 86, 132, 66, 0.9)}
        {impact(c, 168, 90, 6, 3)}
        <path d="M0,118 q10,-3 20,0 t20,0 t20,0 t20,0 M10,126 q10,-3 20,0 t20,0 t20,0" {...ln(c, 0.6, 0.4)} stroke={c.dark} />
        {speed(c, 196, 80, [10, 14], 6, -1)}
      </>
    );
  },

  /** Ambush: warriors burst from the reeds onto a passing column. */
  ambush: (c) => {
    const reeds = (seed: number, topMin: number, topMax: number, step: number, x0 = -4, x1 = 206) => {
      const R = rng(seed);
      let d = '';
      for (let x = x0; x < x1; x += step) {
        const xx = x + R() * step;
        const top = topMin + R() * (topMax - topMin);
        const bend = (R() - 0.5) * 10;
        d += `M${r2(xx)},132 Q${r2(xx + bend * 0.3)},${r2((top + 132) / 2)} ${r2(xx + bend)},${r2(top)} `;
      }
      return d;
    };
    const col = [40, 64, 88, 112, 136, 160].map((x, i) => {
      const f = act(c, x, 96, 0.72, i === 2 || i === 4 ? POSE.recoil : POSE.walk, { fill: c.mid });
      return (
        <g key={x}>
          {f.node}
          {spear(c, x - 2, 94, x + 2, 66, 0.7)}
        </g>
      );
    });
    const j1 = act(c, 70, 114, 1.4, POSE.leap);
    const j2 = act(c, 150, 116, 1.35, POSE.leap, { flip: true });
    return (
      <>
        {sun(c, 172, 40, 7)}
        {hills(c, 90, 6, 61, 0.45)}
        {ground(c, 96)}
        {col}
        <path d={reeds(5, 84, 100, 3.4)} {...dk(c, 1, c.mid)} />
        {impact(c, 92, 72, 6, 2)}
        {impact(c, 128, 76, 6, 5)}
        {j1.node}
        {heldSpear(c, j1.hand[1], j1.hand[0], 6, 12)}
        {j2.node}
        {heldSpear(c, j2.hand[1], j2.hand[0], 6, 12)}
        <path d="M54,124 Q50,110 56,96 M84,124 Q90,110 86,98 M136,124 Q130,110 136,98 M164,124 Q170,110 166,98" {...ln(c, 1, 0.75)} />
        <path d={reeds(9, 98, 112, 2.6)} {...dk(c, 1.2)} />
        <path d={reeds(13, 104, 118, 7)} {...ln(c, 0.8, 0.55)} />
      </>
    );
  },

  /** Vigilant Watch: the sentry's lantern catches a saboteur in the act. */
  vigilantWatch: (c) => {
    let courses = '';
    for (let y = 46; y < H; y += 7) {
      const t = (y - 40) / 58;
      courses += `M${r2(33 - 3 * t)},${y} H${r2(47 + 3 * t)} `;
    }
    const sentry = act(c, 40, 36, 0.62, { arms: [[[4, -1], [10, 2]], [[2, 5], [3, 9]]] });
    const sab = act(c, 150, 108, 1.4, { hip: -7, lean: -18, arms: [[[-4, -5], [-7, -10]], [[5, -4], [8, -9]]], legs: [[[5, 1], [5, 7]], [[-4, 5], [-8, 7]]] }, { flip: true });
    return (
      <>
        {night(c, 0.6)}
        {hills(c, 94, 10, 51, 0.8)}
        {ground(c)}
        <polygon points="48,30 120,110 190,104" fill={c.p.accent} opacity={0.18} />
        <polygon points="48,30 132,108 176,104" fill={c.p.accent} opacity={0.14} />
        <ellipse cx={152} cy={108} rx={30} ry={5} fill={c.p.accent} opacity={0.3} />
        <polygon points="30,98 50,98 47,40 33,40" fill={c.u('lit')} />
        <polygon points="40,98 50,98 47,40 40,40" fill={c.u('shade')} opacity={0.7} />
        <path d={courses} {...ln(c, 0.5, 0.35)} stroke={c.dark} />
        <rect x={27} y={36} width={26} height={4} fill={c.u('lit')} />
        {sentry.node}
        <circle cx={r2(sentry.hand[0][0] + 1)} cy={r2(sentry.hand[0][1] + 2)} r={12} fill={c.u('glow')} />
        <rect x={r2(sentry.hand[0][0] - 0.6)} y={r2(sentry.hand[0][1])} width={3.2} height={4} rx={0.8} fill={c.p.accent} />
        <path d="M110,108 L190,108" {...ln(c, 0.6, 0.4)} />
        <path d="M170,108 L196,104" {...dk(c, 4, c.deep)} opacity={0.6} />
        <path d="M120,108 L132,72 M126,90 l10,-4" {...dk(c, 1.4, c.mid)} />
        <path d="M120,108 L132,72" {...ln(c, 0.5, 0.6)} />
        {sab.node}
        <path d={`M${r2(sab.head[0] - 8)},${r2(sab.head[1] - 6)} l-4,-4 M${r2(sab.head[0])},${r2(sab.head[1] - 9)} v-6 M${r2(sab.head[0] + 8)},${r2(sab.head[1] - 6)} l4,-4`} {...ln(c, 1.1, 0.95)} />
        <path d={`M${r2(sab.hand[1][0])},${r2(sab.hand[1][1])} l-3,-3`} {...dk(c, 1.2, c.p.accent)} />
      </>
    );
  },

  /** Mirror the Scheme: a fire-arrow rebounds off a polished shield onto its archer. */
  mirror: (c) => {
    const archer = act(c, 36, 116, 1.35, POSE.recoil);
    const guard = act(c, 160, 118, 1.45, { lean: -6, arms: [[[-6, 0], [-10, 2]], [[2, 6], [3, 10]]] }, { flip: true });
    return (
      <>
        {sun(c, 100, 24, 5)}
        {hills(c, 94, 6, 77, 0.5)}
        {ground(c)}
        <path d="M54,86 L128,78" {...ln(c, 0.9, 0.5)} strokeDasharray="2 2.6" />
        <path d="M128,74 Q92,10 46,78" {...dk(c, 3, c.p.accent)} opacity={0.35} />
        <path d="M128,74 Q92,10 46,78" {...ln(c, 1.3, 0.9)} />
        {sparks(c, 96, 36, 22, 8, 9, 15, 1.4)}
        <g transform="rotate(124 48 76)">
          <rect x={36} y={75} width={12} height={1.4} fill={c.dark} />
          <path d={flame(36, 76, 9, 2.6, 0)} fill={c.u('fire')} transform="rotate(-90 36 76)" />
        </g>
        {aHead(c, 48, 76, 2.15, 2.6)}
        <circle cx={46} cy={78} r={10} fill={c.u('glow')} />
        {archer.node}
        <path d={`M${r2(archer.hand[1][0])},${r2(archer.hand[1][1] - 9)} Q${r2(archer.hand[1][0] + 7)},${r2(archer.hand[1][1])} ${r2(archer.hand[1][0])},${r2(archer.hand[1][1] + 9)}`} {...dk(c, 1.3)} />
        {guard.node}
        <circle cx={134} cy={80} r={19} fill={c.u('glow')} />
        <circle cx={134} cy={80} r={15} fill={c.u('litH')} stroke={c.dark} strokeWidth={1.4} />
        <path d="M124,72 A12,12 0 0 1 140,67" {...dk(c, 2, mix(c.p.accent, '#ffffff', 0.6))} />
        <path d="M126,86 l14,-14 M130,90 l12,-12" {...ln(c, 0.6, 0.5)} stroke="#ffffff" />
        {impact(c, 126, 76, 7, 4)}
      </>
    );
  },

  /* ----------------------------------- Kush ----------------------------------- */

  /** Iron Furnaces: bellows-workers pump, molten iron runs from the tap. */
  furnace: (c) => {
    const shaft = (x: number, h: number, w: number) => (
      <g>
        <polygon points={pts([[x - w / 2, H], [x + w / 2, H], [x + w * 0.28, H - h], [x - w * 0.28, H - h]])} fill={c.u('lit')} />
        <polygon points={pts([[x + 2, H], [x + w / 2, H], [x + w * 0.28, H - h], [x + 1, H - h]])} fill={c.u('shade')} opacity={0.7} />
        <rect x={x - w * 0.3} y={H - h - 1.5} width={w * 0.6} height={2} fill={c.p.accent} />
        <path d={flame(x, H - h, 10, w * 0.22, 1)} fill={c.u('fire')} />
        {smoke(c, x, H - h - 8, 30, 5, 0.35)}
      </g>
    );
    const pumper = act(c, 36, 110, 1.3, { arms: [[[2, -4], [3, -10]], [[-2, 2], [-3, 6]]], legs: [[[-3, 6], [-4, 10]], [[3, 10]]] });
    const tapper = act(c, 156, 116, 1.35, POSE.push, { flip: true });
    return (
      <>
        {night(c, 0.35, false)}
        {ground(c)}
        <circle cx={100} cy={84} r={56} fill={c.u('glow')} />
        {shaft(80, 40, 24)}
        {shaft(120, 30, 18)}
        <path d="M80,96 v-6 a4,4 0 0 1 8,0 v6 Z" fill={c.u('fire')} />
        <path d="M86,98 Q98,104 104,112 Q110,120 128,122" {...dk(c, 4, c.p.accent)} />
        <path d="M86,98 Q98,104 104,112 Q110,120 128,122" {...ln(c, 1.4, 1)} stroke={mix(c.p.accent, '#ffffff', 0.6)} />
        <ellipse cx={132} cy={122} rx={9} ry={2.6} fill={c.p.accent} />
        <circle cx={130} cy={120} r={12} fill={c.u('glow')} />
        {sparks(c, 100, 50, 24, 16, 12, 7, 1.4)}
        {sparks(c, 108, 110, 14, 8, 6, 8, 1.2)}
        <ellipse cx={30} cy={110} rx={7} ry={2.8} fill={c.mid} />
        <ellipse cx={44} cy={111} rx={7} ry={2.8} fill={c.mid} />
        <path d="M50,108 L68,96" {...dk(c, 1.6)} />
        {pumper.node}
        <path d={`M${r2(pumper.hand[0][0])},${r2(pumper.hand[0][1])} L${r2(pumper.hand[0][0])},${r2(pumper.hand[0][1] + 24)}`} {...dk(c, 0.9)} />
        <path d="M24,104 v-4 M50,104 v-6" {...ln(c, 0.8, 0.7)} />
        {tapper.node}
        <path d={`M${r2(tapper.hand[1][0])},${r2(tapper.hand[1][1])} L88,96`} {...dk(c, 1.4)} />
      </>
    );
  },

  /** Pyramids of Meroë at dusk: a procession bears offerings to the chapels. */
  pyramid: (c) => {
    const pyr = (x: number, base: number, w: number, h: number) => (
      <g>
        <polygon points={pts([[x - w / 2, base], [x, base - h], [x, base]])} fill={c.u('lit')} />
        <polygon points={pts([[x, base - h], [x + w / 2, base], [x, base]])} fill={c.u('shade')} />
        <path d={line([[x - w / 2, base], [x, base - h], [x + w / 2, base]])} {...ln(c, 0.7, 0.6)} />
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
    const proc = [24, 38, 52, 66, 80].map((x, i) => {
      const y = 116 - i * 2.4;
      const s = 0.8 - i * 0.05;
      const f = act(c, x, y, s, { lean: 5, robe: true, arms: [[[3, -3], [2, -7]], [[-2, 5], [-1, 9]]] });
      return (
        <g key={x}>
          <path d={`M${x},${r2(y)} l-24,2 l0,1.6 Z`} fill={c.deep} opacity={0.4} />
          {f.node}
          <path d={`M${r2(f.head[0] - 3)},${r2(f.head[1] - 3.6 * s)} h6 l-1.4,2 h-3.2 Z`} fill={c.u('lit')} />
        </g>
      );
    });
    return (
      <>
        <rect width={200} height={130} fill={c.deep} opacity={0.18} />
        {sun(c, 168, 92, 10)}
        {hills(c, 94, 5, 61, 0.6)}
        {ground(c)}
        {pyr(186, 94, 18, 34)}
        {pyr(146, 96, 24, 50)}
        {pyr(112, 100, 30, 66)}
        {chapel(146, 100, 0.8)}
        {chapel(112, 106, 1)}
        <path d="M58,118 Q90,112 104,107" {...ln(c, 0.8, 0.45)} strokeDasharray="2 2.4" />
        {proc}
        {sparks(c, 112, 96, 4, 3, 3, 4, 1.2)}
      </>
    );
  },

  /** Lion Temple: guards cross spears before the gateway. */
  lion: (c) => {
    const g1 = act(c, 82, 106, 1.3, { arms: [[[4, -2], [8, -4]], [[2, 4], [5, 6]]] });
    const g2 = act(c, 118, 106, 1.3, { arms: [[[4, -2], [8, -4]], [[2, 4], [5, 6]]] }, { flip: true });
    return (
      <>
        {sun(c, 100, 52, 10)}
        {ground(c)}
        <polygon points="30,98 82,98 78,36 36,36" fill={c.u('lit')} />
        <polygon points="118,98 170,98 164,36 122,36" fill={c.u('lit')} />
        <polygon points="64,98 82,98 78,36 66,36" fill={c.u('shade')} opacity={0.55} />
        <polygon points="152,98 170,98 164,36 152,36" fill={c.u('shade')} opacity={0.55} />
        <rect x={33} y={31} width={48} height={5} fill={c.p.accent} />
        <rect x={119} y={31} width={48} height={5} fill={c.p.accent} />
        <path d="M42,48 H72 M42,58 H72 M128,48 H158 M128,58 H158" {...ln(c, 0.6, 0.45)} stroke={c.dark} />
        <rect x={82} y={48} width={36} height={6} fill={c.u('lit')} />
        <rect x={86} y={54} width={28} height={44} fill={c.deep} />
        <circle cx={100} cy={76} r={20} fill={c.u('glow')} />
        {g1.node}
        {g2.node}
        {spear(c, g1.hand[1][0] - 2, g1.hand[1][1] + 8, 112, 50, 1.2)}
        {spear(c, g2.hand[1][0] + 2, g2.hand[1][1] + 8, 88, 50, 1.2)}
        {impact(c, 100, 61, 4, 9, 8)}
        {roundShield(c, g1.hand[0][0] - 8, g1.hand[0][1] + 4, 6)}
        {roundShield(c, g2.hand[0][0] + 8, g2.hand[0][1] + 4, 6)}
        <rect x={14} y={108} width={36} height={8} fill={c.u('lit')} />
        <g transform="translate(32 108) scale(0.85)">
          <path d="M-10,0 Q-18,-2 -17,-9" {...dk(c, 1.4)} />
          <path d="M-10,0 L-12,-4 Q-13,-12 -8,-16 Q-4,-22 2,-24 Q4,-30 9,-29 Q13,-28 13,-24 L12,-21 Q9,-19 8,-16 L8,-4 L11,-2 L11,0 Z" fill={c.dark} />
        </g>
      </>
    );
  },

  /** Kandake's Command: the queen raises her staff and the army surges forward. */
  kandake: (c) => {
    const q = act(c, 52, 84, 1.45, { robe: true, arms: [[[3, -5], [4, -12]], [[5, 2], [10, 1]]] });
    const troops = [
      [96, 104, 0.62], [116, 106, 0.66], [136, 104, 0.62], [156, 107, 0.68], [176, 104, 0.62],
      [106, 120, 0.85], [134, 122, 0.88], [162, 120, 0.85], [190, 122, 0.86],
    ].map(([x, y, s]) => {
      const f = act(c, x, y, s, POSE.run);
      return (
        <g key={`${x}-${y}`}>
          {f.node}
          {heldSpear(c, f.hand[0], f.hand[1], 4, 10, 0.8)}
        </g>
      );
    });
    return (
      <>
        {sun(c, 170, 50, 8)}
        <polygon points="132,94 140,64 148,94" fill={c.u('shade')} opacity={0.6} />
        <polygon points="150,94 157,70 164,94" fill={c.u('shade')} opacity={0.5} />
        {ground(c, 94)}
        {dust(c, 130, 110, 80, 13)}
        {troops}
        {speed(c, 96, 96, [12, 18, 14], 6)}
        {speed(c, 100, 112, [16, 22], 6)}
        <rect x={20} y={84} width={64} height={8} fill={c.u('lit')} />
        <rect x={12} y={92} width={80} height={8} fill={c.u('lit')} />
        <rect x={4} y={100} width={96} height={30} fill={c.u('shade')} />
        <path d="M20,92 H84 M12,100 H92" {...ln(c, 0.6, 0.6)} stroke={c.dark} />
        <circle cx={58} cy={38} r={22} fill={c.u('glow')} />
        {q.node}
        <path d={`M${r2(q.hand[0][0])},${r2(q.hand[0][1] + 26)} L${r2(q.hand[0][0] + 1)},${r2(q.hand[0][1] - 10)}`} {...dk(c, 1.4)} />
        <circle cx={r2(q.hand[0][0] + 1)} cy={r2(q.hand[0][1] - 11)} r={2.4} fill={c.p.accent} />
        <path d={`M${r2(q.head[0] - 2.6)},${r2(q.head[1] - 2.6)} L${r2(q.head[0] - 1.8)},${r2(q.head[1] - 9)} L${r2(q.head[0] + 1.8)},${r2(q.head[1] - 9)} L${r2(q.head[0] + 2.6)},${r2(q.head[1] - 2.6)} Z`} fill={c.u('lit')} />
        <path d={`M${r2(q.hand[1][0] + 4)},${r2(q.hand[1][1])} h14 M${r2(q.hand[1][0] + 6)},${r2(q.hand[1][1] - 5)} h10`} {...ln(c, 0.9, 0.75)} />
      </>
    );
  },

  /* ---------------------------------- Aksum ----------------------------------- */

  /** Port of Adulis: porters carry amphorae up the gangplank onto a trader. */
  port: (c) => {
    const p1 = act(c, 74, 98, 1.0, { ...POSE.carry, lean: 10 });
    const p2 = act(c, 36, 94, 1.05, POSE.bend);
    return (
      <>
        {sun(c, 160, 56, 8)}
        <polygon points="140,90 166,78 190,82 205,76 205,90" fill={c.u('shade')} />
        <rect x={0} y={90} width={200} height={40} fill={c.u('water')} />
        <path d="M140,96 h20 M150,104 h30 M64,112 h24 M150,120 h30 M70,124 h20" {...ln(c, 0.6, 0.45)} />
        <path d="M92,100 L176,100 Q170,114 152,114 L116,114 Q102,112 92,100 Z" fill={c.dark} />
        <path d="M94,101 Q88,94 92,87" {...dk(c, 1.6)} />
        <path d="M134,100 V40" {...dk(c, 1.4)} />
        <path d="M108,72 L166,36" {...dk(c, 1.2)} />
        <polygon points="110,72 164,38 158,96 128,96" fill={c.u('lit')} />
        <path d="M136,58 L142,96 M150,48 L151,96" {...ln(c, 0.5, 0.45)} stroke={c.dark} />
        {amphora(c, 120, 100, 0.8)}
        {amphora(c, 160, 100, 0.8)}
        <rect x={-2} y={94} width={60} height={36} fill={c.u('lit')} />
        <path d="M-2,100 H58 M58,94 V130 M10,100 V112 M30,100 V112 M48,100 V112 M0,112 H58" {...ln(c, 0.6, 0.4)} stroke={c.dark} />
        <path d="M54,95 L104,101" {...dk(c, 2.4, c.mid)} />
        <path d="M54,95 L104,101" {...ln(c, 0.6, 0.6)} />
        {amphora(c, 14, 94, 0.9)}
        {amphora(c, 22, 94, 0.8)}
        {p2.node}
        {amphora(c, p2.hand[0][0] + 2, p2.hand[0][1] + 2, 0.8)}
        {p1.node}
        <g transform={`rotate(-80 ${r2(p1.head[0])} ${r2(p1.head[1] - 4)})`}>{amphora(c, p1.head[0], p1.head[1] + 3, 0.85)}</g>
        {trail(c, [60, 80], [80, 72], [100, 86], { dash: '2 2', op: 0.6, head: 2.4 })}
        <path d="M60,30 q3,-3 6,0 q3,-3 6,0 M84,22 q2,-2 4,0 q2,-2 4,0" {...dk(c, 0.8)} />
      </>
    );
  },

  /** Aksumite Mint: the hammer is raised over the die; struck coins fly out. */
  mint: (c) => {
    const smith = act(c, 72, 120, 1.6, { hip: -6, lean: 6, arms: [[[3, -6], [5, -13]], [[6, 3], [11, 4]]], legs: [[[5, 1], [5, 6]], [[-2, 6], [-8, 6]]] });
    const [hx, hy] = smith.hand[0];
    const [px, py] = smith.hand[1];
    const stack = (x: number, y: number, n: number) => {
      const top = y - n * 3;
      let edges = '';
      for (let i = 1; i < n; i++) edges += `M${x - 8},${y - i * 3} a8,2.6 0 0 0 16,0 `;
      return (
        <g>
          <path d={`M${x - 8},${top} V${y} a8,2.6 0 0 0 16,0 V${top} Z`} fill={c.u('litH')} />
          <path d={edges} {...ln(c, 0.5, 0.6)} stroke={c.dark} />
          <ellipse cx={x} cy={top} rx={8} ry={2.6} fill={c.p.accent} stroke={c.dark} strokeWidth={0.4} />
        </g>
      );
    };
    return (
      <>
        <rect width={200} height={130} fill={c.deep} opacity={0.3} />
        {ground(c, 104)}
        <rect x={0} y={0} width={200} height={104} fill={c.u('shade')} opacity={0.3} />
        <path d="M0,24 H200 M0,26 H200" {...ln(c, 0.5, 0.3)} />
        <circle cx={104} cy={86} r={40} fill={c.u('glow')} />
        {cube(c, 92, 120, 30, 18, 9)}
        <path d={`M${r2(px)},${r2(py)} L106,96`} {...dk(c, 1.2)} />
        <rect x={104} y={84} width={4} height={14} fill={c.u('litH')} stroke={c.dark} strokeWidth={0.5} />
        <ellipse cx={106} cy={99} rx={6} ry={1.8} fill={c.p.accent} />
        <path d={`M${r2(hx)},${r2(hy)} L${r2(hx + 18)},${r2(hy - 2)}`} {...dk(c, 2)} />
        <rect x={r2(hx + 14)} y={r2(hy - 9)} width={8} height={14} rx={1.2} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.7} />
        <path d={`M${r2(hx + 26)},${r2(hy - 4)} A30,30 0 0 1 110,80`} {...ln(c, 1, 0.65)} strokeDasharray="2.4 2" />
        {aHead(c, 110, 80, 1.9, 2.6)}
        {sparks(c, 106, 92, 10, 5, 7, 4, 1.4)}
        {smith.node}
        {[[136, 74, 20], [150, 90, -30], [128, 62, 50], [160, 70, 10]].map(([x, y, r], i) => (
          <g key={i} transform={`rotate(${r} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={4} ry={i % 2 ? 1.6 : 4} fill={c.u('litH')} stroke={c.dark} strokeWidth={0.5} />
          </g>
        ))}
        <path d="M120,84 l8,-6 M122,90 l12,-2 M118,78 l4,-10" {...ln(c, 0.8, 0.7)} />
        {stack(30, 124, 5)}
        {stack(170, 120, 6)}
        {stack(186, 126, 3)}
      </>
    );
  },

  /** Great Stele: haulers strain on ropes to raise the carved granite monolith. */
  stele: (c) => {
    let bands = '';
    let wins = '';
    for (let i = 0; i < 6; i++) {
      const y = 34 + i * 10;
      bands += `M101,${y} H119 `;
      if (i % 2 === 0) wins += `M104,${y + 3} h4 v4 h-4 Z M112,${y + 3} h4 v4 h-4 Z `;
    }
    const tilt = -28;
    const a = (tilt * Math.PI) / 180;
    const top: Pt = [110 + Math.sin(a) * -72 * -1, 100 - Math.cos(a) * 72];
    const haulers = [136, 158, 180].map((x) => act(c, x, 118, 1.15, POSE.pull, { flip: true }));
    const rope: Pt[] = [top, ...haulers.map((h) => h.hand[0])];
    return (
      <>
        {sun(c, 170, 40, 8)}
        <path d="M24,98 V66 a4,4 0 0 1 8,0 V98 Z M40,98 V74 a3,3 0 0 1 6,0 V98 Z" fill={c.u('shade')} opacity={0.6} />
        {ground(c)}
        {[14, 52, 62].map((x) => (
          <g key={x}>{tinyFig(c, x, 104, 0.5, x === 52)}</g>
        ))}
        <polygon points="84,104 126,104 120,94 92,94" fill={c.mid} />
        <path d="M84,100 L72,72 M94,100 L80,66" {...dk(c, 2)} />
        <g transform={`rotate(${tilt} 110 100)`}>
          <path d="M98,100 L100,30 A10,10 0 0 1 120,30 L122,100 Z" fill={c.u('lit')} />
          <path d="M122,100 L126,98 L122,30 L120,30 Z" fill={c.u('shade')} />
          <path d={bands} {...ln(c, 0.6, 0.6)} stroke={c.dark} />
          <path d={wins} fill={c.dark} opacity={0.8} />
          <rect x={106} y={88} width={8} height={10} fill={c.deep} />
        </g>
        <path d={line(rope)} {...dk(c, 1)} />
        <path d={line(rope.map(([x, y]) => [x + 1, y + 2] as Pt))} {...ln(c, 0.6, 0.6)} />
        <path d="M92,24 a14,14 0 0 1 18,-4" {...ln(c, 1.1, 0.8)} strokeDasharray="3 2" />
        {aHead(c, 112, 20, 0.1, 2.8)}
        {haulers.map((h, i) => (
          <g key={i}>{h.node}</g>
        ))}
        <path d="M130,100 l-3,-4 M152,100 l-3,-4 M174,100 l-3,-4" {...ln(c, 0.8, 0.7)} />
        {dust(c, 160, 120, 50, 21)}
      </>
    );
  },

  /** Gold Coinage: a merchant pours coins from a pouch onto a glittering heap. */
  coin: (c) => {
    const m = act(c, 160, 120, 1.7, { robe: true, lean: -4, arms: [[[-5, -5], [-11, -9]], [[-2, 6], [-1, 10]]] });
    const [hx, hy] = m.hand[0];
    const R = rng(33);
    const fall = Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      const x = hx - 8 - t * 38 + (R() - 0.5) * 6;
      const y = hy + 2 + t * t * 62 + (R() - 0.5) * 4;
      return (
        <ellipse key={i} cx={r2(x)} cy={r2(y)} rx={3.4} ry={r2(0.8 + R() * 2.6)} transform={`rotate(${r2(R() * 80 - 40)} ${r2(x)} ${r2(y)})`} fill={c.u('litH')} stroke={c.dark} strokeWidth={0.4} />
      );
    });
    let heap = '';
    for (let i = 0; i < 22; i++) {
      const x = 76 + R() * 56;
      const yTop = 120 - (1 - Math.pow((x - 104) / 30, 2)) * 14;
      heap += `M${r2(x - 3)},${r2(yTop + R() * (122 - yTop))} a3,1.1 0 0 0 6,0 `;
    }
    return (
      <>
        <rect width={200} height={130} fill={c.deep} opacity={0.3} />
        {skyline(c, 98, 0, 200, 71, 0.4)}
        {ground(c)}
        <circle cx={104} cy={104} r={40} fill={c.u('glow')} />
        <path d="M72,122 Q104,92 136,122 Z" fill={c.u('litH')} />
        <path d={heap} {...ln(c, 0.6, 0.7)} stroke={c.dark} />
        <path d={`M${r2(hx - 6)},${r2(hy)} Q${r2(hx - 30)},${r2(hy + 8)} 106,104`} {...ln(c, 6, 0.18)} />
        {fall}
        {sparks(c, 104, 96, 22, 10, 10, 6, 1.5)}
        {m.node}
        <path d={`M${r2(hx + 2)},${r2(hy - 4)} q-8,-2 -10,4 q2,6 10,2 Z`} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
      </>
    );
  },

  /* --------------------------------- Carthage --------------------------------- */

  /** The Cothon: warships glide through the channel and into the ship-sheds. */
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
        {sun(c, 160, 30, 6)}
        <rect x={0} y={44} width={200} height={14} fill={c.u('water')} />
        <rect x={0} y={58} width={200} height={72} fill={c.u('lit')} opacity={0.75} />
        <rect x={0} y={58} width={200} height={72} fill={c.u('ground')} opacity={0.45} />
        <polygon points="56,108 74,112 80,132 52,132" fill={c.u('water')} />
        <ellipse cx={100} cy={90} rx={76} ry={28} fill={c.u('water')} />
        <ellipse cx={100} cy={90} rx={76} ry={28} {...ln(c, 1, 0.7)} />
        <path d={ticks(76, 28, 68, 24.5, 100, 90, 48)} {...ln(c, 0.7, 0.6)} stroke={c.dark} />
        <ellipse cx={100} cy={88} rx={26} ry={10} fill={c.u('lit')} />
        <path d={ticks(22, 8, 26, 10, 100, 88, 30)} {...ln(c, 0.6, 0.7)} stroke={c.dark} />
        <rect x={94} y={74} width={12} height={12} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.5} />
        <polygon points="92,74 100,68 108,74" fill={c.u('shade')} />
        {topGalley(c, 66, 118, -68, 0.9)}
        {topGalley(c, 160, 104, 25, 0.8)}
        {topGalley(c, 46, 82, 200, 0.8)}
        {topGalley(c, 128, 100, -15, 0.75)}
        {topGalley(c, 150, 60, 0, 0.6)}
        <path d="M76,48 h22 M110,52 h30" {...ln(c, 0.6, 0.5)} />
      </>
    );
  },

  /** Mercenary Company: a column of hired soldiers with mismatched shields marches out. */
  mercenary: (c) => {
    const ms = [
      { x: 52, y: 104, s: 1.05, sh: 'oval' },
      { x: 94, y: 110, s: 1.3, sh: 'round' },
      { x: 144, y: 118, s: 1.6, sh: 'rect' },
    ].map(({ x, y, s, sh }) => {
      const f = act(c, x, y, s, POSE.walk);
      const [hx, hy] = f.hand[1];
      const cx = x + 4 * s;
      const cy = y - 17 * s;
      return (
        <g key={x}>
          {spear(c, hx - 6 * s, hy + 6 * s, hx + 10 * s, hy - 26 * s, 1)}
          {f.node}
          {sh === 'round' && roundShield(c, cx, cy, 7 * s)}
          {sh === 'oval' && <ellipse cx={cx} cy={cy} rx={5 * s} ry={9 * s} fill={c.u('lit')} stroke={c.dark} strokeWidth={1} />}
          {sh === 'oval' && <path d={`M${cx},${cy - 9 * s} V${cy + 9 * s}`} {...dk(c, 1)} />}
          {sh === 'rect' && <rect x={cx - 5 * s} y={cy - 9 * s} width={10 * s} height={18 * s} rx={2 * s} fill={c.u('lit')} stroke={c.dark} strokeWidth={1} />}
          {sh === 'rect' && <circle cx={cx} cy={cy} r={1.6 * s} fill={c.mid} />}
          <path d={`M${r2(f.head[0] - 2.8 * s)},${r2(f.head[1] - 0.6 * s)} a${2.8 * s},${2.8 * s} 0 0 1 ${5.6 * s},0 Z`} fill={c.u('lit')} />
          {dust(c, x - 8 * s, y + 1, 14 * s, x)}
        </g>
      );
    });
    return (
      <>
        {sun(c, 168, 52, 7)}
        {hills(c, 94, 8, 71, 0.5)}
        {ground(c)}
        <path d="M-5,104 Q60,100 120,112 T205,124" {...ln(c, 0.8, 0.4)} />
        {ms}
        <path d="M184,88 q4,-2 6,2 q-2,4 -6,2 Z" fill={c.u('lit')} />
        {speed(c, 30, 80, [10, 16, 10], 6)}
      </>
    );
  },

  /** Numidian Horse: light cavalry at full gallop, javelin thrown. */
  cavalry: (c) => (
    <>
      {sun(c, 36, 46, 7)}
      {hills(c, 94, 6, 81, 0.5)}
      {ground(c)}
      {horse(c, 52, 100, 0.85, { rider: true, fill: c.mid })}
      {dust(c, 30, 104, 30, 4)}
      {dust(c, 66, 120, 40, 8)}
      {speed(c, 54, 72, [20, 30, 24, 16], 7)}
      {horse(c, 112, 120, 1.9, { rider: true })}
      <g transform="translate(112 120) scale(1.9)">
        <path d="M2.4,-29 L-2,-35 L-5,-39" {...dk(c, 1.5)} />
      </g>
      {spear(c, 82, 44, 118, 52, 1)}
      {trail(c, [126, 40], [150, 20], [176, 30], { dash: '2 2.4', op: 0.7 })}
      {spear(c, 164, 23, 184, 36, 1)}
      {speed(c, 160, 24, [8, 12], 4, -1, 0.6)}
    </>
  ),

  /** Red Sea Traders / Quinquereme: the ship drives through the swell, oars churning. */
  ship: (c) => {
    let splash = '';
    for (let i = -36; i <= 36; i += 6) splash += `M${r2(100 + (i - 6) * 1.2)},${r2(108 + i * 0.12)} q-2,-3 0,-5 `;
    return (
      <>
        {sun(c, 36, 50, 7)}
        <rect x={0} y={92} width={200} height={38} fill={c.u('water')} />
        <path d="M-5,104 Q40,96 80,104 T150,100 T205,98 L205,130 L-5,130 Z" fill={c.u('water')} />
        <path d="M-5,104 Q40,96 80,104 T150,100 T205,98" {...ln(c, 0.8, 0.55)} />
        <g transform="rotate(-5 100 106)">
          {galley(c, 100, 106, 1.2)}
          <path d={splash} {...ln(c, 0.9, 0.85)} />
          <path d="M176,104 q8,-10 16,-6 M176,106 q10,-4 18,2 M172,100 q4,-12 12,-14" {...ln(c, 1.1, 0.9)} />
          {amphora(c, 70, 91, 0.6)}
          {amphora(c, 78, 91, 0.6)}
        </g>
        {sparks(c, 184, 92, 10, 8, 8, 6, 1.6)}
        <path d="M10,114 h30 M2,120 h40 M20,126 h30 M120,118 h44 M150,124 h30" {...ln(c, 0.6, 0.45)} />
        {speed(c, 30, 70, [12, 18, 12], 7)}
      </>
    );
  },

  /** Blockade: warships hold the chain across the harbour mouth; a merchantman turns back. */
  blockade: (c) => (
    <>
      {sun(c, 100, 56, 7)}
      <rect x={0} y={80} width={200} height={50} fill={c.u('water')} />
      <line x1={0} x2={200} y1={80} y2={80} {...ln(c, 0.6, 0.4)} />
      {galley(c, 74, 96, 0.3)}
      {galley(c, 126, 96, 0.3)}
      <polygon points="0,64 26,66 54,98 60,130 0,130" fill={c.u('lit')} />
      <polygon points="200,60 170,64 146,98 140,130 200,130" fill={c.u('shade')} />
      <rect x={10} y={50} width={10} height={16} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.6} />
      <rect x={178} y={46} width={10} height={16} fill={c.u('shade')} stroke={c.dark} strokeWidth={0.6} />
      <path d="M10,50 h2 v-2 h2 v2 h2 v-2 h2 v2 M178,46 h2 v-2 h2 v2 h2 v-2 h2 v2" {...dk(c, 0.8)} />
      <path d="M52,100 Q100,112 148,100" {...dk(c, 2.6)} strokeDasharray="3 1.4" />
      <path d="M52,100 Q100,112 148,100" {...ln(c, 0.6, 0.6)} strokeDasharray="1.2 3.2" />
      {roundShip(c, 104, 126, 0.55, true)}
      <path d="M118,124 h14 M120,128 h18" {...ln(c, 0.7, 0.55)} />
      <path d="M100,110 Q128,108 130,116 Q132,124 120,126" {...ln(c, 1.1, 0.8)} strokeDasharray="3 2" />
      <path d="M96,126 Q78,126 70,120" {...ln(c, 1.1, 0.8)} strokeDasharray="3 2" />
      {aHead(c, 70, 120, -2.5, 3)}
      {impact(c, 100, 106, 4, 8, 7)}
    </>
  ),

  /* ---------------------------------- Sumer ----------------------------------- */

  /** Irrigation Canals: a sluice is hauled open and water floods the fields. */
  canal: (c) => {
    let crops = '';
    const R = rng(44);
    for (let i = 0; i < 40; i++) {
      const left = i % 2 === 0;
      const x = left ? 4 + R() * 70 : 128 + R() * 70;
      const y = 104 + R() * 22;
      crops += `M${r2(x)},${r2(y)} l0,-4 m0,1.6 l-1.6,-1.6 m1.6,1.6 l1.6,-1.6 `;
    }
    const w = act(c, 132, 98, 1.2, POSE.pull, { flip: true });
    return (
      <>
        {sun(c, 40, 66, 8)}
        <rect x={0} y={82} width={200} height={6} fill={c.u('water')} />
        {palm(c, 168, 84, 0.6)}
        {palm(c, 24, 84, 0.55)}
        {ground(c, 88)}
        <path d={crops} {...ln(c, 0.8, 0.75)} />
        <polygon points="94,88 106,88 132,130 68,130" fill={c.u('water')} />
        <path d="M94,88 L68,130 M106,88 L132,130" {...ln(c, 0.8, 0.6)} />
        <path d="M80,112 Q40,110 -5,114 L-5,118 Q40,114 78,116 Z M120,112 Q160,110 205,114 L205,118 Q160,114 122,116 Z" fill={c.u('water')} />
        <path d="M84,96 L116,96" {...dk(c, 2)} />
        <path d="M86,96 V70 M114,96 V70 M84,70 H116" {...dk(c, 2.2)} />
        <rect x={88} y={74} width={24} height={14} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.8} />
        <path d={`M100,70 V74 M100,66 L${r2(w.hand[0][0])},${r2(w.hand[0][1])}`} {...dk(c, 0.8)} />
        <path d="M90,90 q10,8 20,0 M88,94 q12,12 24,0" {...ln(c, 1.4, 0.95)} />
        <path d="M96,104 l4,4 l4,-4 M94,114 l6,5 l6,-5 M64,113 l-5,2 l5,2 M136,113 l5,2 l-5,2" {...ln(c, 1, 0.85)} />
        {sparks(c, 100, 98, 12, 4, 7, 5, 1.4)}
        {w.node}
        {aHead(c, 100, 72, -Math.PI / 2, 2.4)}
      </>
    );
  },

  /** Ziggurat: a procession climbs the great stair to the burning brazier at the summit. */
  ziggurat: (c) => {
    let steps = '';
    for (let y = 46; y < H; y += 3) {
      const t = (y - 44) / 54;
      steps += `M${r2(96 - 4 * t)},${y} H${r2(104 + 4 * t)} `;
    }
    const proc = [0.1, 0.3, 0.5, 0.7, 0.88].map((t) => {
      const y = 98 - 52 * t;
      const s = 0.62 - t * 0.3;
      return <g key={t}>{act(c, 100, y, s, { robe: true, arms: [[[3, -3], [2, -7]], [[-2, 5], [-1, 9]]] }).node}</g>;
    });
    return (
      <>
        {sun(c, 36, 50, 8)}
        {ground(c)}
        <polygon points="30,98 170,98 162,76 38,76" fill={c.u('lit')} />
        <polygon points="132,98 170,98 162,76 128,76" fill={c.u('shade')} opacity={0.6} />
        <polygon points="52,76 148,76 142,58 58,58" fill={c.u('lit')} />
        <polygon points="120,76 148,76 142,58 118,58" fill={c.u('shade')} opacity={0.6} />
        <polygon points="74,58 126,58 122,44 78,44" fill={c.u('lit')} />
        <polygon points="110,58 126,58 122,44 108,44" fill={c.u('shade')} opacity={0.6} />
        <path d="M34,87 H166 M55,67 H145" {...ln(c, 0.5, 0.4)} stroke={c.dark} />
        <polygon points="90,98 110,98 104,44 96,44" fill={c.mid} />
        <path d={steps} {...ln(c, 0.5, 0.55)} />
        <rect x={88} y={32} width={24} height={12} fill={c.u('lit')} />
        <rect x={103} y={32} width={9} height={12} fill={c.u('shade')} opacity={0.6} />
        <rect x={97} y={36} width={6} height={8} fill={c.deep} />
        <path d="M86,32 H114" {...ln(c, 1.2, 0.8)} />
        <circle cx={118} cy={26} r={14} fill={c.u('glow')} />
        <path d="M114,32 h8 l-1.4,-3 h-5.2 Z" fill={c.u('lit')} />
        <path d={flame(118, 29, 9, 3, 1)} fill={c.u('fire')} />
        {smoke(c, 118, 20, 22, 4, 0.45)}
        {proc}
        {[30, 44, 156, 170].map((x, i) => (
          <g key={x}>{tinyFig(c, x, 112 + (i % 2) * 4, 0.6, i === 1 || i === 2)}</g>
        ))}
      </>
    );
  },

  /** Tablet House / Census: a scribe presses the stylus into wet clay, tallying the sacks. */
  tablets: (c) => {
    const scribe = act(c, 70, 116, 1.75, { hip: -6, lean: 14, arms: [[[3, 6], [8, 6]], [[4, 3], [9, 1]]], legs: [[[6, 1], [4, 6]], [[-2, 5], [-6, 6]]] });
    const [tx, ty] = scribe.hand[0];
    const [sx, sy] = scribe.hand[1];
    let shelf = '';
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) shelf += `M${12 + k * 9},${30 + r * 16} h6 v9 h-6 Z `;
    let tally = '';
    for (let i = 0; i < 4; i++) tally += `M${150 + i * 3},62 v-6 `;
    return (
      <>
        <rect width={200} height={130} fill={c.deep} opacity={0.3} />
        {ground(c, 100)}
        <rect x={6} y={24} width={74} height={50} fill={c.u('shade')} opacity={0.6} />
        <path d={shelf} fill={c.u('lit')} opacity={0.7} />
        <path d="M6,40 H80 M6,56 H80 M6,72 H80" {...dk(c, 1.2)} />
        <circle cx={104} cy={50} r={18} fill={c.u('glow')} />
        <path d="M100,56 h8 l-2,3 h-4 Z" fill={c.u('lit')} />
        <path d={flame(104, 56, 7, 2, 0.5)} fill={c.u('fire')} />
        {sack(c, 146, 100, 1.6)}
        {sack(c, 164, 100, 1.5)}
        {sack(c, 182, 100, 1.6)}
        {sack(c, 156, 82, 1.4)}
        {sack(c, 174, 82, 1.4)}
        <path d={tally + 'M148,58 l14,-2'} {...ln(c, 1, 0.9)} />
        <path d="M140,104 l-8,4 M198,104 l-6,4" {...dk(c, 0.8, c.mid)} />
        {scribe.node}
        <g transform={`rotate(-14 ${r2(tx + 4)} ${r2(ty - 5)})`}>
          <rect x={r2(tx - 4)} y={r2(ty - 14)} width={16} height={18} rx={3} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.7} />
          <path d={`M${r2(tx - 1)},${r2(ty - 9)} l3,-1 v2 Z M${r2(tx + 4)},${r2(ty - 9)} l3,-1 v2 Z M${r2(tx - 1)},${r2(ty - 4)} l3,-1 v2 Z M${r2(tx + 4)},${r2(ty - 4)} l3,-1 v2 Z M${r2(tx - 1)},${r2(ty + 1)} l3,-1 v2 Z`} fill={c.dark} />
        </g>
        <path d={`M${r2(sx)},${r2(sy)} L${r2(sx - 3)},${r2(sy - 12)}`} {...dk(c, 1.2, c.p.accent)} />
        <path d={`M${r2(sx - 6)},${r2(sy - 14)} a6,6 0 0 1 6,-2`} {...ln(c, 0.8, 0.7)} />
        {trail(c, [128, 72], [118, 62], [112, 70], { dash: '2 2', op: 0.6, head: 2.2 })}
      </>
    );
  },

  /** Battle Wagon: onagers at the gallop, wheels spinning, a javelin raised. */
  wagon: (c) => {
    const drv = act(c, 64, 82, 0.95, { lean: 10, arms: [[[6, 2], [12, 3]], [[-2, -5], [-4, -11]]] });
    return (
      <>
        {sun(c, 30, 48, 7)}
        {hills(c, 94, 6, 91, 0.5)}
        {ground(c)}
        {dust(c, 30, 110, 40, 6)}
        {speed(c, 36, 66, [18, 26, 20, 14], 7)}
        {horse(c, 142, 104, 1.05, { fill: c.mid })}
        {horse(c, 132, 108, 1.1)}
        <path d="M84,84 L124,82" {...dk(c, 1.8)} />
        <path d={`M${r2(drv.hand[0][0])},${r2(drv.hand[0][1])} L146,80`} {...ln(c, 0.5, 0.8)} stroke={c.dark} />
        {drv.node}
        {spear(c, drv.hand[1][0] - 12, drv.hand[1][1] + 2, drv.hand[1][0] + 12, drv.hand[1][1] - 4, 0.9)}
        <polygon points="42,92 86,92 88,62 82,62 80,82 44,82" fill={c.u('lit')} />
        <path d="M42,92 L86,92 L88,62 M44,87 H84" {...ln(c, 0.6, 0.5)} stroke={c.dark} />
        {[54, 78].map((x) => (
          <g key={x}>
            <circle cx={x} cy={98} r={9} fill={c.u('shade')} stroke={c.dark} strokeWidth={1} />
            <path d={`M${x - 3},89.5 V106.5 M${x + 3},89.5 V106.5`} {...ln(c, 0.5, 0.5)} />
            <circle cx={x} cy={98} r={2} fill={c.p.accent} />
            <path d={`M${x - 12},94 A12,12 0 0 1 ${x - 4},86 M${x - 11},104 A12,12 0 0 0 ${x - 3},110`} {...ln(c, 0.8, 0.6)} />
          </g>
        ))}
      </>
    );
  },

  /* ----------------------------------- Inca ----------------------------------- */

  /** Qhapaq Ñan: a llama caravan climbs the stepped mountain road. */
  andeanRoad: (c) => {
    const road: Pt[] = [[-4, 122], [130, 92], [70, 76], [136, 58], [104, 44], [128, 30]];
    let stepT = '';
    for (let i = 0; i < road.length - 1; i++) {
      const [x1, y1] = road[i];
      const [x2, y2] = road[i + 1];
      const L = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.floor(L / 5);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        stepT += `M${r2(x - ((y2 - y1) / L) * 2.6)},${r2(y + ((x2 - x1) / L) * 2.6)} l${r2(((y2 - y1) / L) * 5.2)},${r2(-((x2 - x1) / L) * 5.2)} `;
      }
    }
    const ang = (Math.atan2(92 - 122, 134) * 180) / Math.PI;
    const at = (t: number): Pt => [-4 + 134 * t, 122 - 30 * t];
    const herder = act(c, at(0.22)[0], at(0.22)[1] + 2, 1.15, { ...POSE.walk, lean: 10 });
    return (
      <>
        {sun(c, 172, 26, 7)}
        <polygon points="120,98 170,26 205,60 205,98" fill={c.u('shade')} opacity={0.5} />
        <polygon points="170,26 162,38 168,36 172,40 178,33" fill={c.p.accent} opacity={0.8} />
        {ground(c)}
        <polygon points="-5,130 -5,100 60,54 116,14 170,60 205,96 205,130" fill={c.u('lit')} />
        <polygon points="116,14 170,60 205,96 205,130 116,130" fill={c.u('shade')} opacity={0.65} />
        <polygon points="116,14 106,26 112,28 118,24 124,30 130,26" fill={c.p.accent} />
        <path d={line(road)} {...dk(c, 6, c.mid)} />
        <path d={stepT} {...ln(c, 0.6, 0.7)} stroke={c.dark} />
        {llama(c, ...at(0.5), 1.15, ang)}
        {llama(c, ...at(0.68), 1.05, ang)}
        {llama(c, ...at(0.86), 0.95, ang)}
        {herder.node}
        <path d={`M${r2(herder.hand[1][0])},${r2(herder.hand[1][1] + 6)} l3,-20`} {...dk(c, 1)} />
        {llama(c, 112, 46, 0.5, 20)}
        {llama(c, 124, 33, 0.42, -30)}
        <path d="M120,114 l6,-1 M136,110 l6,-2" {...ln(c, 0.8, 0.6)} />
      </>
    );
  },

  /** Andean Terraces: farmers work the curving terraces; a porter climbs with a basket. */
  terraces: (c) => {
    const clip = c.id('mt');
    let bands = '';
    let risers = '';
    for (let i = 0; i < 10; i++) {
      const y0 = 38 + i * 9.6;
      bands += `M-10,${r2(y0)} Q100,${r2(y0 - 28)} 210,${r2(y0 + 10)} `;
      risers += `M-10,${r2(y0 + 2.2)} Q100,${r2(y0 - 25.8)} 210,${r2(y0 + 12.2)} `;
    }
    const onBand = (i: number, t: number): Pt => {
      const y0 = 38 + i * 9.6;
      const x = -10 * (1 - t) ** 2 + 200 * t * (1 - t) + 210 * t * t;
      const y = y0 * (1 - t) ** 2 + 2 * (y0 - 28) * t * (1 - t) + (y0 + 10) * t * t;
      return [x, y + 1];
    };
    let crops = '';
    const R = rng(8);
    for (let i = 2; i < 10; i++) {
      for (let k = 0; k < 9; k++) {
        const [x, y] = onBand(i, 0.06 + k * 0.11 + R() * 0.03);
        crops += `M${r2(x)},${r2(y)} l0,-3.6 m0,1.4 l-1.4,-1.4 m1.4,1.4 l1.4,-1.4 `;
      }
    }
    const f1 = act(c, ...onBand(6, 0.3), 0.8, POSE.bend);
    const f2 = act(c, ...onBand(8, 0.72), 0.9, POSE.bend, { flip: true });
    const f3 = act(c, ...onBand(4, 0.55), 0.68, POSE.walk);
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
          <path d={crops} {...ln(c, 0.7, 0.85)} stroke={c.p.secondary} />
        </g>
        <path d="M0,98 L20,80 L70,30 L100,20 L140,36 L200,70" {...ln(c, 0.8, 0.6)} />
        {f1.node}
        <path d={`M${r2(f1.hand[0][0])},${r2(f1.hand[0][1])} l2,4 l3,-1`} {...dk(c, 1, c.p.accent)} />
        {f2.node}
        <path d={`M${r2(f2.hand[0][0])},${r2(f2.hand[0][1])} l-2,4 l-3,-1`} {...dk(c, 1, c.p.accent)} />
        {f3.node}
        <path d={`M${r2(f3.head[0] - 6)},${r2(f3.head[1] + 2)} h-5 l1,8 h4 Z`} fill={c.u('lit')} stroke={c.dark} strokeWidth={0.5} />
      </>
    );
  },

  /** Chasqui Relay: one runner hands the knotted khipu to the next, already in stride. */
  runner: (c) => {
    const a = act(c, 70, 114, 1.55, { ...POSE.run, arms: [[[-5, 4], [-8, 1]], [[6, 1], [11, -1]]] });
    const b = act(c, 124, 112, 1.5, { ...POSE.run, lean: 22, arms: [[[-6, 3], [-11, 3]], [[5, 4], [7, -1]]] });
    const [ax, ay] = a.hand[1];
    const [bx, by] = b.hand[0];
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    let cords = '';
    let knots = '';
    for (let i = 0; i < 5; i++) {
      const x = ax + ((bx - ax) * (i + 0.5)) / 5;
      cords += `M${r2(x)},${r2(my)} l${r2((i - 2) * 0.6)},${8 + (i % 2) * 3} `;
      knots += `M${r2(x + (i - 2) * 0.2)},${r2(my + 3 + (i % 3))} h0.01 M${r2(x + (i - 2) * 0.4)},${r2(my + 6 + (i % 2))} h0.01 `;
    }
    return (
      <>
        {sun(c, 36, 44, 7)}
        <polygon points="70,98 120,40 170,98" fill={c.u('shade')} opacity={0.5} />
        <polygon points="130,98 170,58 210,98" fill={c.u('shade')} opacity={0.4} />
        <rect x={168} y={80} width={22} height={18} fill={c.u('lit')} />
        <polygon points="164,80 179,70 194,80" fill={c.u('shade')} />
        <rect x={176} y={88} width={6} height={10} fill={c.deep} />
        {ground(c)}
        <rect x={-5} y={112} width={210} height={6} fill={c.u('lit')} opacity={0.5} />
        <path d="M10,112 v6 M30,112 v6 M50,112 v6 M90,112 v6 M110,112 v6 M150,112 v6 M170,112 v6 M190,112 v6" {...ln(c, 0.5, 0.4)} stroke={c.dark} />
        {speed(c, 46, 70, [18, 26, 20, 12], 7)}
        {dust(c, 50, 114, 20, 3)}
        {a.node}
        {b.node}
        <path d={`M${r2(ax)},${r2(ay)} Q${r2(mx)},${r2(my - 2)} ${r2(bx)},${r2(by)}`} {...dk(c, 1.2, c.p.accent)} />
        <path d={cords} {...ln(c, 0.7, 0.95)} />
        <path d={knots} {...ln(c, 1.8, 1)} stroke={c.dark} />
        <circle cx={r2(mx)} cy={r2(my + 4)} r={10} fill={c.u('glow')} />
        {speed(c, 160, 82, [10, 16, 10], 6, 1, 0.55)}
      </>
    );
  },

  /** Ashlar Masonry: a fitted polygonal block is levered into its exact place in the wall. */
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
    const GR = 3;
    const GK = 2;
    let gap: Pt[] = [];
    for (let r = 0; r < ys.length - 1; r++) {
      for (let k = 0; k < xs.length - 1; k++) {
        const poly: Pt[] = [V[r][k], mh[r][k], V[r][k + 1], mv[r][k + 1], V[r + 1][k + 1], mh[r + 1][k], V[r + 1][k], mv[r][k]];
        if (r === GR && k === GK) {
          gap = poly;
          continue;
        }
        stones.push(
          <polygon key={`${r}-${k}`} points={pts(poly)} fill={c.u('lit')} fillOpacity={0.72 + R() * 0.28} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" />,
        );
      }
    }
    const dx = 40;
    const dy = 4;
    const block = gap.map(([x, y]) => [x + dx, y + dy] as Pt);
    const bx1 = Math.max(...block.map((p) => p[0]));
    const pusher = act(c, bx1 + 18, 120, 1.35, POSE.push, { flip: true });
    const lev = act(c, bx1 + 44, 122, 1.3, POSE.pull, { flip: true });
    return (
      <>
        {sun(c, 166, 10, 5)}
        {ground(c)}
        <rect x={0} y={18} width={200} height={80} fill={c.mid} />
        {stones}
        <polygon points={pts(gap)} fill={c.deep} />
        <polygon points={pts(gap)} fill="none" stroke={c.p.accent} strokeWidth={1.1} strokeDasharray="2.4 1.8" />
        <ellipse cx={r2(block.reduce((s, p) => s + p[0], 0) / block.length)} cy={102} rx={22} ry={3} fill={c.deep} opacity={0.6} />
        <polygon points={pts(block)} fill={c.u('lit')} stroke={c.p.accent} strokeWidth={1.2} strokeLinejoin="round" />
        <path d={`M${r2(bx1 - 46)},78 h-12 M${r2(bx1 - 46)},88 h-16`} {...ln(c, 1.1, 0.9)} />
        {aHead(c, bx1 - 60, 78, Math.PI, 2.8)}
        {aHead(c, bx1 - 64, 88, Math.PI, 2.8)}
        {pusher.node}
        {lev.node}
        <path d={`M${r2(lev.hand[0][0])},${r2(lev.hand[0][1])} L${r2(bx1 - 4)},100`} {...dk(c, 1.8)} />
        {dust(c, bx1 - 6, 104, 20, 7)}
      </>
    );
  },

  /** Slingers: one whirls the sling overhead as another's stone flies at the enemy. */
  slinger: (c) => {
    const back = act(c, 120, 108, 1.2, { lean: 14, arms: [[[6, -4], [11, -5]], [[-4, 4], [-7, 7]]], legs: [[[-6, 10]], [[4, 4], [6, 10]]] });
    return (
      <>
        {sun(c, 166, 60, 7)}
        {hills(c, 94, 7, 97, 0.5)}
        {ground(c)}
        {back.node}
        <path d={`M${r2(back.hand[0][0])},${r2(back.hand[0][1])} l6,-3 M${r2(back.hand[0][0])},${r2(back.hand[0][1])} l7,1`} {...dk(c, 0.7)} />
        {trail(c, [back.hand[0][0] + 6, back.hand[0][1] - 4], [164, 30], [192, 40], { dash: '2 2.4', op: 0.7 })}
        <circle cx={192} cy={40} r={2.2} fill={c.p.accent} />
        {speed(c, 188, 38, [8, 12], 3)}
        {trail(c, [150, 26], [170, 10], [196, 20], { dash: '2 2.4', op: 0.5 })}
        <circle cx={196} cy={20} r={1.8} fill={c.p.accent} />
        {(() => {
          const f = act(c, 58, 118, 1.8, { lean: -10, arms: [[[6, 2], [11, 0]], [[1, -7], [3, -15]]], legs: [[[-7, 10]], [[5, 4], [8, 10]]] });
          const [hx, hy] = f.hand[1];
          const ey = hy - 6;
          return (
            <g>
              <ellipse cx={r2(hx)} cy={r2(ey)} rx={24} ry={7} {...ln(c, 1, 0.8)} strokeDasharray="3 2.5" />
              <ellipse cx={r2(hx)} cy={r2(ey)} rx={18} ry={5} {...ln(c, 0.7, 0.45)} strokeDasharray="2 3" />
              {aHead(c, hx - 23, ey + 2.4, 1.9, 2.8)}
              <path d={`M${r2(hx)},${r2(hy)} L${r2(hx + 21)},${r2(ey + 3)}`} {...dk(c, 0.8)} />
              <circle cx={r2(hx + 22)} cy={r2(ey + 3)} r={2.4} fill={c.p.accent} stroke={c.dark} strokeWidth={0.6} />
              {speed(c, hx + 18, ey + 6, [6, 9], 3, -1, 0.7)}
              {f.node}
            </g>
          );
        })()}
        <path d="M24,122 l4,-3 l4,3 Z M30,124 l3,-2 l3,2 Z" fill={c.mid} />
      </>
    );
  },
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
