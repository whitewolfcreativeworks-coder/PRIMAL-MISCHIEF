/**
 * Primal Mischief — riverbank skyline panoramas.
 *
 * A wide, low, atmospheric SVG of a civilization's settlement at a given Age,
 * used as the background of each player's half of the board. Everything is
 * procedural: a seeded layout of simple building primitives whose number,
 * height and kind grow with the Age, plus one civilization-specific signature
 * structure. Silhouettes are simplified, historically grounded architecture
 * (see docs/HISTORY_NOTES.md) — artistic interpretation, not reconstruction.
 *
 * Colours are pre-blended with the backdrop rather than drawn translucent, so
 * nearer structures properly occlude farther ones while staying low-contrast.
 */
import { useId, type ReactNode } from 'react';
import { type Palette, mixColor as mix, desatColor as desat, seededRng as rng } from './motifs';

type Civ = 'kush' | 'aksum' | 'carthage' | 'sumer' | 'inca' | 'norse';
type Age = 1 | 2 | 3 | 4 | 5;
type P = [number, number];

const f = (n: number) => Math.round(n * 10) / 10;
const rect = (x: number, y: number, w: number, h: number) => `M${f(x)},${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const poly = (p: P[]) => 'M' + p.map(([x, y]) => `${f(x)},${f(y)}`).join('L') + 'Z';

/* ------------------------------------------------------------------------ */
/* Scene model: an ordered list of items, each a bundle of path layers        */
/* ------------------------------------------------------------------------ */

interface Tones {
  body: string;
  shade: string;
  lit: string;
  dark: string;
  glow: string;
  line: string;
  lineOp: number;
  flag: string;
  smoke: string;
  water: string;
}

class Item {
  body = '';
  shade = '';
  lit = '';
  dark = '';
  glow = '';
  line = '';
  stroke = '';
  frond = '';
  flag = '';
  smoke = '';
  water = '';
  /** drawn in raw panel coordinates (far scenery), not with the town's scale */
  free = false;
  constructor(public t: Tones) {}
}

class Scene {
  items: Item[] = [];
  constructor(public tones: Record<'far' | 'back' | 'main', Tones>) {}
  item(depth: 'far' | 'back' | 'main' = 'main', free = false) {
    const it = new Item(this.tones[depth]);
    it.free = free;
    this.items.push(it);
    return it;
  }
}

function renderItem(it: Item, key: number) {
  const t = it.t;
  return (
    <g key={key}>
      {it.water && <path d={it.water} fill={t.water} />}
      {it.body && <path d={it.body} fill={t.body} />}
      {it.shade && <path d={it.shade} fill={t.shade} />}
      {it.lit && <path d={it.lit} fill={t.lit} />}
      {it.dark && <path d={it.dark} fill={t.dark} />}
      {it.glow && <path d={it.glow} fill={t.glow} />}
      {it.stroke && <path d={it.stroke} fill="none" stroke={t.body} strokeWidth={1.8} strokeLinecap="round" />}
      {it.frond && <path d={it.frond} fill="none" stroke={t.body} strokeWidth={1.2} strokeLinecap="round" />}
      {it.line && <path d={it.line} fill="none" stroke={t.line} strokeOpacity={t.lineOp} strokeWidth={0.7} strokeLinecap="round" />}
      {it.flag && <path d={it.flag} fill={t.flag} />}
      {it.smoke && <path d={it.smoke} fill="none" stroke={t.smoke} strokeOpacity={0.3} strokeWidth={2.2} strokeLinecap="round" />}
    </g>
  );
}

/* ------------------------------------------------------------------------ */
/* Primitives. Local coordinates: baseline y = 0, heights grow upward (−y).   */
/* ------------------------------------------------------------------------ */

function block(L: Item, x: number, w: number, h: number, y = 0, sh = 0.3) {
  L.body += rect(x, y - h, w, h);
  L.shade += rect(x + w * (1 - sh), y - h, w * sh, h);
  L.line += `M${f(x)},${f(y - h)}h${f(w)}`;
}

function windows(L: Item, x: number, w: number, h: number, y: number, R: () => number, glowing: boolean) {
  const cols = Math.max(1, Math.floor(w / 6));
  for (let wy = y - h + 3; wy < y - 4; wy += 6) {
    for (let k = 0; k < cols; k++) {
      if (R() < 0.45) continue;
      const wx = x + ((k + 0.5) * w) / cols - 0.9;
      const r = rect(wx, wy, 1.8, 2.4);
      if (glowing && R() < 0.6) L.glow += r;
      else L.dark += r;
    }
  }
}

function door(L: Item, x: number, y: number, w: number, h: number) {
  L.dark += `M${f(x - w / 2)},${f(y)}V${f(y - h + w / 2)}A${f(w / 2)},${f(w / 2)} 0 0 1 ${f(x + w / 2)},${f(y - h + w / 2)}V${f(y)}Z`;
}

function trapDoor(L: Item, x: number, y: number, w: number, h: number) {
  L.dark += poly([[x - w / 2, y], [x - w * 0.32, y - h], [x + w * 0.32, y - h], [x + w / 2, y]]);
}

function roundHut(L: Item, x: number, w: number, h: number, y = 0) {
  block(L, x, w, h * 0.45, y, 0.35);
  L.body += poly([[x - 2, y - h * 0.45 + 0.5], [x + w / 2, y - h], [x + w + 2, y - h * 0.45 + 0.5]]);
  L.shade += poly([[x + w / 2, y - h], [x + w + 2, y - h * 0.45 + 0.5], [x + w / 2, y - h * 0.45 + 0.5]]);
  L.line += `M${f(x - 2)},${f(y - h * 0.45 + 0.5)}L${f(x + w / 2)},${f(y - h)}`;
  door(L, x + w * 0.35, y, 2.6, 4);
}

function reedHut(L: Item, x: number, w: number, h: number, y = 0) {
  L.body += `M${f(x)},${f(y)}V${f(y - h * 0.35)}Q${f(x + w / 2)},${f(y - h * 1.35)} ${f(x + w)},${f(y - h * 0.35)}V${f(y)}Z`;
  for (let k = 1; k < 4; k++) L.line += `M${f(x + (w * k) / 4)},${f(y)}v${f(-h * 0.55)}`;
  L.shade += rect(x + w * 0.72, y - h * 0.35, w * 0.28, h * 0.35);
  door(L, x + w / 2, y, 2.4, 4);
}

function gableHouse(L: Item, x: number, w: number, h: number, y = 0, inca = false) {
  block(L, x, w, h * 0.55, y);
  L.body += poly([[x - 1.6, y - h * 0.55 + 0.4], [x + w / 2, y - h], [x + w + 1.6, y - h * 0.55 + 0.4]]);
  L.shade += poly([[x + w / 2, y - h], [x + w + 1.6, y - h * 0.55 + 0.4], [x + w / 2, y - h * 0.55 + 0.4]]);
  L.line += `M${f(x - 1.6)},${f(y - h * 0.55 + 0.4)}L${f(x + w / 2)},${f(y - h)}`;
  if (inca) trapDoor(L, x + w / 2, y, 3.4, h * 0.36);
  else door(L, x + w / 2, y, 2.6, 4.4);
}

function flatHouse(L: Item, x: number, w: number, h: number, R: () => number, glowing: boolean, y = 0, parapet = false) {
  block(L, x, w, h, y);
  if (parapet) for (let px = x; px < x + w - 1; px += 3.2) L.body += rect(px, y - h - 1.6, 1.8, 1.6);
  windows(L, x, w, h, y, R, glowing);
}

function dome(L: Item, x: number, w: number, h: number, y = 0) {
  block(L, x, w, h * 0.55, y);
  L.body += `M${f(x - 0.6)},${f(y - h * 0.55)}Q${f(x + w / 2)},${f(y - h * 1.35)} ${f(x + w + 0.6)},${f(y - h * 0.55)}Z`;
  L.line += `M${f(x - 0.6)},${f(y - h * 0.55)}Q${f(x + w / 2)},${f(y - h * 1.35)} ${f(x + w + 0.6)},${f(y - h * 0.55)}`;
}

function palisade(L: Item, x0: number, x1: number, h: number, y = 0) {
  for (let x = x0; x < x1; x += 3.4) L.body += poly([[x, y], [x, y - h], [x + 1.4, y - h - 2.6], [x + 2.8, y - h], [x + 2.8, y]]);
  L.line += `M${f(x0)},${f(y - h * 0.55)}H${f(x1)}`;
}

function cityWall(L: Item, x0: number, x1: number, h: number, gate: number, step: number, o: { merlons?: boolean; flags?: boolean } = {}) {
  const merl = o.merlons !== false;
  L.body += rect(x0, -h, x1 - x0, h);
  L.line += `M${f(x0)},${f(-h)}H${f(x1)}M${f(x0)},${f(-h * 0.45)}H${f(x1)}`;
  if (merl) for (let x = x0; x < x1 - 2; x += 5) L.body += rect(x, -h - 2.4, 2.6, 2.4);
  const towers: number[] = [];
  for (let x = gate - step; x > x0 + 4; x -= step) towers.push(x);
  for (let x = gate + step; x < x1 - 4; x += step) towers.push(x);
  towers.push(x0 + 4, x1 - 4);
  towers.forEach((tx, i) => {
    block(L, tx - 4.5, 9, h + 6);
    if (merl) for (let k = 0; k < 3; k++) L.body += rect(tx - 4.5 + k * 3.4, -h - 8.4, 2.2, 2.4);
    if (o.flags && i % 2 === 0) banner(L, tx, -h - 8.4, 9);
  });
  block(L, gate - 9, 18, h + 9);
  if (merl) for (let k = 0; k < 4; k++) L.body += rect(gate - 9 + k * 4.8, -h - 11.4, 3, 2.4);
  door(L, gate, 0, 7, h + 3);
  if (o.flags) banner(L, gate, -h - 11.4, 11);
}

function banner(L: Item, x: number, y: number, h: number) {
  L.stroke += `M${f(x)},${f(y)}V${f(y - h)}`;
  L.flag += `M${f(x)},${f(y - h)}Q${f(x + 4)},${f(y - h - 1.6)} ${f(x + 9)},${f(y - h + 0.6)}L${f(x + 7.6)},${f(y - h + 2.8)}L${f(x + 9)},${f(y - h + 5)}Q${f(x + 4)},${f(y - h + 3.4)} ${f(x)},${f(y - h + 5)}Z`;
}

function smoke(L: Item, x: number, y: number, h: number, sway = 3) {
  let d = `M${f(x)},${f(y)}`;
  const n = Math.max(2, Math.round(h / 7));
  for (let i = 0; i < n; i++) d += `q${i % 2 ? sway : -sway},${f(-h / n / 2)} ${f(sway * 0.4)},${f(-h / n)}`;
  L.smoke += d;
}

function palm(L: Item, x: number, h: number, y = 0) {
  const tx = x + h * 0.12;
  const ty = y - h;
  L.stroke += `M${f(x)},${f(y)}Q${f(x + h * 0.1)},${f(y - h * 0.5)} ${f(tx)},${f(ty)}`;
  for (const [dx, dy] of [[-1, 0.3], [-0.8, -0.15], [-0.25, -0.35], [0.3, -0.3], [0.85, -0.1], [1, 0.32]] as P[]) {
    L.frond += `M${f(tx)},${f(ty)}Q${f(tx + dx * h * 0.25)},${f(ty + dy * h * 0.35 - h * 0.08)} ${f(tx + dx * h * 0.42)},${f(ty + dy * h * 0.4 + h * 0.1)}`;
  }
}

function pyramid(L: Item, x: number, w: number, h: number, y = 0) {
  L.body += poly([[x - w / 2, y], [x, y - h], [x + w / 2, y]]);
  L.shade += poly([[x, y - h], [x + w / 2, y], [x + w * 0.04, y]]);
  L.line += `M${f(x - w / 2)},${f(y)}L${f(x)},${f(y - h)}`;
  // offering chapel with its small pylon front
  block(L, x - w * 0.22, w * 0.44, h * 0.14, y, 0.35);
  L.body += poly([[x - w * 0.3, y], [x - w * 0.27, y - h * 0.2], [x - w * 0.12, y - h * 0.2], [x - w * 0.1, y]]);
}

function stele(L: Item, x: number, w: number, h: number, y = 0) {
  L.body += `M${f(x)},${f(y)}V${f(y - h + w * 0.5)}Q${f(x + w / 2)},${f(y - h - w * 0.35)} ${f(x + w)},${f(y - h + w * 0.5)}V${f(y)}Z`;
  L.shade += rect(x + w * 0.7, y - h + w * 0.5, w * 0.3, h - w * 0.5);
  const band = Math.max(5, h * 0.11);
  for (let yy = y - h * 0.16; yy > y - h + w * 0.9; yy -= band) {
    L.dark += rect(x + w * 0.12, yy, w * 0.76, Math.max(0.7, band * 0.12));
    L.dark += rect(x + w * 0.24, yy - band * 0.62, w * 0.18, band * 0.32);
    L.dark += rect(x + w * 0.58, yy - band * 0.62, w * 0.18, band * 0.32);
  }
  L.dark += rect(x + w * 0.36, y - h * 0.11, w * 0.28, h * 0.11);
  L.line += `M${f(x)},${f(y)}V${f(y - h + w * 0.5)}`;
}

function ziggurat(L: Item, x: number, w: number, h: number, shrine: boolean) {
  const tiers = 3;
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const tw = w * (1 - i * 0.3);
    const th = (h / tiers) * (i === 0 ? 1.15 : 0.92);
    L.body += poly([[x - tw / 2, y], [x + tw / 2, y], [x + tw / 2 - th * 0.22, y - th], [x - tw / 2 + th * 0.22, y - th]]);
    L.shade += poly([[x + tw * 0.18, y], [x + tw / 2, y], [x + tw / 2 - th * 0.22, y - th], [x + tw * 0.18, y - th]]);
    L.line += `M${f(x - tw / 2 + th * 0.22)},${f(y - th)}H${f(x + tw / 2 - th * 0.22)}`;
    for (let bx = x - tw / 2 + 4; bx < x + tw / 2 - 3; bx += 5) L.dark += rect(bx, y - th * 0.85, 0.8, th * 0.7);
    y -= th;
  }
  L.lit += poly([[x - w * 0.05, 0], [x + w * 0.05, 0], [x + w * 0.025, y], [x - w * 0.025, y]]);
  if (shrine) {
    block(L, x - w * 0.09, w * 0.18, h * 0.2, y);
    door(L, x, y, 2.6, h * 0.12);
  }
}

function pylonTemple(L: Item, x: number, w: number, h: number) {
  block(L, x - w * 0.38, w * 0.9, h * 0.55, 0, 0.25);
  L.body += poly([[x - w / 2, 0], [x - w * 0.09, 0], [x - w * 0.12, -h], [x - w * 0.44, -h]]);
  L.body += poly([[x + w * 0.09, 0], [x + w / 2, 0], [x + w * 0.44, -h], [x + w * 0.12, -h]]);
  L.shade += poly([[x + w * 0.3, 0], [x + w / 2, 0], [x + w * 0.44, -h], [x + w * 0.29, -h]]);
  L.line += `M${f(x - w * 0.44)},${f(-h)}H${f(x - w * 0.12)}M${f(x + w * 0.12)},${f(-h)}H${f(x + w * 0.44)}`;
  block(L, x - w * 0.09, w * 0.18, h * 0.72, 0, 0.2);
  door(L, x, 0, w * 0.1, h * 0.5);
}

function aksumPalace(L: Item, x: number, w: number, h: number, R: () => number, glowing: boolean) {
  block(L, x - w / 2 - 3, w + 6, 4, 0, 0.2);
  const wing = (wx: number, ww: number, wh: number) => {
    block(L, wx, ww, wh, -4);
    // stepped recesses and timber "monkey-head" ends in bands
    for (let yy = -4 - 5; yy > -4 - wh + 2; yy -= 6) for (let xx = wx + 1.5; xx < wx + ww - 1; xx += 3.4) L.dark += rect(xx, yy, 1.1, 1.1);
    windows(L, wx, ww, wh, -4, R, glowing);
  };
  wing(x - w / 2, w * 0.3, h * 0.62);
  wing(x + w * 0.2, w * 0.3, h * 0.62);
  wing(x - w * 0.2, w * 0.4, h);
  door(L, x, -4, 4, 8);
}

function carthTemple(L: Item, x: number, w: number, h: number, y = 0) {
  block(L, x - w / 2, w, h * 0.22, y, 0.25);
  const top = y - h * 0.22;
  L.body += rect(x - w * 0.44, top - h * 0.5, w * 0.88, h * 0.5);
  for (let cx = x - w * 0.4; cx < x + w * 0.4; cx += w / 8) L.lit += rect(cx, top - h * 0.48, w * 0.045, h * 0.46);
  L.body += poly([[x - w * 0.5, top - h * 0.5], [x, top - h], [x + w * 0.5, top - h * 0.5]]);
  L.shade += poly([[x, top - h], [x + w * 0.5, top - h * 0.5], [x, top - h * 0.5]]);
  L.line += `M${f(x - w * 0.5)},${f(top - h * 0.5)}L${f(x)},${f(top - h)}L${f(x + w * 0.5)},${f(top - h * 0.5)}`;
}

function sumerTemple(L: Item, x: number, w: number, h: number) {
  block(L, x - w / 2, w, h * 0.42, 0, 0.25);
  for (let bx = x - w / 2 + 3; bx < x + w / 2 - 2; bx += 4) L.dark += rect(bx, -h * 0.38, 0.8, h * 0.32);
  block(L, x - w * 0.3, w * 0.6, h * 0.58, -h * 0.42, 0.25);
  for (let bx = x - w * 0.3 + 3; bx < x + w * 0.3 - 2; bx += 4) L.dark += rect(bx, -h * 0.95, 0.8, h * 0.45);
  L.lit += poly([[x - 2.4, 0], [x + 2.4, 0], [x + 1.6, -h * 0.42], [x - 1.6, -h * 0.42]]);
}

function incaHall(L: Item, x: number, w: number, h: number) {
  block(L, x, w, h * 0.6, 0, 0.25);
  L.body += poly([[x - 2, -h * 0.6 + 0.4], [x + w * 0.12, -h], [x + w * 0.88, -h], [x + w + 2, -h * 0.6 + 0.4]]);
  L.shade += poly([[x + w * 0.7, -h], [x + w * 0.88, -h], [x + w + 2, -h * 0.6 + 0.4], [x + w * 0.7, -h * 0.6 + 0.4]]);
  for (let nx = x + 5; nx < x + w - 4; nx += 7) trapDoor(L, nx, -h * 0.12, 3.2, h * 0.3);
  trapDoor(L, x + w / 2, 0, 5, h * 0.45);
  for (let yy = -3; yy > -h * 0.6; yy -= 3) L.line += `M${f(x)},${f(yy)}h${f(w)}`;
}

function incaFortress(L: Item, Lb: Item, x: number, w: number, hill: number, h: number, tower: boolean) {
  Lb.body += `M${f(x - w)},0Q${f(x - w * 0.45)},${f(-hill)} ${f(x)},${f(-hill)}Q${f(x + w * 0.45)},${f(-hill)} ${f(x + w)},0Z`;
  let base = -hill * 0.72;
  for (let t = 0; t < 3; t++) {
    const tw = w * (0.95 - t * 0.2);
    const th = h * (0.36 - t * 0.04);
    const x0 = x - tw / 2;
    L.body += rect(x0, base - th, tw, th);
    // zig-zag salients: alternate lit/shaded triangles along the face
    const n = Math.max(4, Math.round(tw / 9));
    const sw = tw / n;
    let zig = `M${f(x0)},${f(base - th)}`;
    for (let k = 0; k < n; k++) {
      L.shade += poly([[x0 + k * sw + sw / 2, base - th], [x0 + (k + 1) * sw, base - th], [x0 + (k + 1) * sw, base], [x0 + k * sw + sw / 2, base]]);
      zig += `L${f(x0 + k * sw + sw / 2)},${f(base - th - 2.6)}L${f(x0 + (k + 1) * sw)},${f(base - th)}`;
      L.lit += poly([[x0 + k * sw, base - th], [x0 + k * sw + sw / 2, base - th - 2.6], [x0 + k * sw + sw / 2, base], [x0 + k * sw, base]]);
    }
    L.body += `${zig}V${f(base - th + 0.5)}H${f(x0)}Z`;
    L.line += zig;
    base -= th;
  }
  if (tower) {
    block(L, x - 6, 12, h * 0.22, base, 0.35);
    L.body += `M${f(x - 6.4)},${f(base - h * 0.22)}Q${f(x)},${f(base - h * 0.36)} ${f(x + 6.4)},${f(base - h * 0.22)}Z`;
  }
  return base;
}

function cothon(L: Item, x: number, rx: number, y: number, ships: number) {
  const ry = rx * 0.16;
  L.water += `M${f(x - rx)},${f(y)}A${f(rx)},${f(ry)} 0 1 0 ${f(x + rx)},${f(y)}A${f(rx)},${f(ry)} 0 1 0 ${f(x - rx)},${f(y)}Z`;
  L.water += rect(x - 4, y - ry - 6, 8, 6);
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    if (Math.abs(a - Math.PI * 1.5) < 0.25) continue; // channel mouth
    const sx = x + Math.cos(a) * rx * 1.06;
    const sy = y + Math.sin(a) * ry * 1.2;
    L.body += rect(sx - 1.4, sy - 3, 2.8, 3);
  }
  // central island with the admiral's tower
  L.body += `M${f(x - rx * 0.28)},${f(y)}A${f(rx * 0.28)},${f(ry * 0.36)} 0 1 0 ${f(x + rx * 0.28)},${f(y)}A${f(rx * 0.28)},${f(ry * 0.36)} 0 1 0 ${f(x - rx * 0.28)},${f(y)}Z`;
  block(L, x - 4, 8, 12, y);
  for (let k = 0; k < ships; k++) ship(L, x - rx * 0.62 + (k * rx * 1.24) / Math.max(1, ships - 1), y + (k % 2 ? 1.5 : -1.2), 0.75);
}

function ship(L: Item, x: number, y: number, s: number) {
  L.body += `M${f(x - 9 * s)},${f(y - 2 * s)}Q${f(x)},${f(y + 2 * s)} ${f(x + 10 * s)},${f(y - 3 * s)}L${f(x + 8 * s)},${f(y)}Q${f(x)},${f(y + 1.5 * s)} ${f(x - 8 * s)},${f(y)}Z`;
  L.stroke += `M${f(x)},${f(y - 1 * s)}V${f(y - 12 * s)}`;
  L.lit += rect(x - 4 * s, y - 11 * s, 8 * s, 7 * s);
}

/* Norse primitives */

/** Turf-roofed farmstead: low stone-and-turf walls under a rounded grass roof. */
function turfHouse(L: Item, x: number, w: number, h: number, y = 0) {
  L.body += `M${f(x)},${f(y)}V${f(y - h * 0.32)}Q${f(x + w * 0.06)},${f(y - h)} ${f(x + w / 2)},${f(y - h)}Q${f(x + w * 0.94)},${f(y - h)} ${f(x + w)},${f(y - h * 0.32)}V${f(y)}Z`;
  L.shade += `M${f(x + w * 0.66)},${f(y)}V${f(y - h * 0.94)}Q${f(x + w * 0.94)},${f(y - h)} ${f(x + w)},${f(y - h * 0.32)}V${f(y)}Z`;
  L.line += `M${f(x)},${f(y - h * 0.32)}Q${f(x + w * 0.06)},${f(y - h)} ${f(x + w / 2)},${f(y - h)}Q${f(x + w * 0.94)},${f(y - h)} ${f(x + w)},${f(y - h * 0.32)}`;
  door(L, x + w * 0.3, y, 2.4, 3.6);
}

/** Longhouse seen side-on: bowed wall, hip-ended curved roof; `posts` adds the leaning outer buttress posts. */
function longhouseS(L: Item, x: number, w: number, h: number, y = 0, posts = false) {
  const e = y - h * 0.4;
  L.body += `M${f(x)},${f(y)}V${f(e)}Q${f(x + w / 2)},${f(e - 2)} ${f(x + w)},${f(e)}V${f(y)}Z`;
  L.shade += rect(x + w * 0.74, e, w * 0.26, y - e);
  const top = y - h;
  const cy = (top - 0.25 * e) / 0.75;
  L.body += `M${f(x - 2.4)},${f(e + 0.6)}C${f(x + w * 0.03)},${f(cy)} ${f(x + w * 0.97)},${f(cy)} ${f(x + w + 2.4)},${f(e + 0.6)}Z`;
  L.shade += `M${f(x + w * 0.7)},${f(top + 0.2)}C${f(x + w * 0.9)},${f(top + 0.4)} ${f(x + w * 0.98)},${f(cy + h * 0.25)} ${f(x + w + 2.4)},${f(e + 0.6)}L${f(x + w * 0.7)},${f(e)}Z`;
  L.line += `M${f(x - 2.4)},${f(e + 0.6)}C${f(x + w * 0.03)},${f(cy)} ${f(x + w * 0.97)},${f(cy)} ${f(x + w + 2.4)},${f(e + 0.6)}`;
  door(L, x + w * 0.5, y, 2.4, Math.min(4.4, (y - e) * 0.9));
  if (posts) for (let px = x + 4; px < x + w - 2; px += 7) L.frond += `M${f(px - 2.4)},${f(y)}L${f(px)},${f(e - 0.6)}`;
}

/** A-frame stockfish drying rack. */
function dryingRack(L: Item, x: number, w: number, h: number, y = 0) {
  L.frond += `M${f(x - 1.6)},${f(y)}L${f(x)},${f(y - h)}L${f(x + 1.6)},${f(y)}M${f(x + w - 1.6)},${f(y)}L${f(x + w)},${f(y - h)}L${f(x + w + 1.6)},${f(y)}M${f(x - 1)},${f(y - h)}H${f(x + w + 1)}`;
  for (let fx = x + 1.6; fx < x + w - 0.8; fx += 1.8) L.dark += rect(fx - 0.45, y - h + 0.5, 0.9, h * 0.42);
}

/** Small clinker boat / longship, facing right; waterline y. */
function longboat(L: Item, x: number, y: number, s: number, sail: boolean, Ls?: Item) {
  L.body += `M${f(x - 11 * s)},${f(y - 5.6 * s)}Q${f(x - 8 * s)},${f(y + 0.8 * s)} ${f(x)},${f(y + 0.6 * s)}Q${f(x + 8 * s)},${f(y + 0.8 * s)} ${f(x + 11 * s)},${f(y - 6 * s)}Q${f(x + 7 * s)},${f(y - 1.8 * s)} ${f(x)},${f(y - 1.8 * s)}Q${f(x - 7 * s)},${f(y - 1.8 * s)} ${f(x - 11 * s)},${f(y - 5.6 * s)}Z`;
  if (sail) {
    L.stroke += `M${f(x)},${f(y - 1.5 * s)}V${f(y - 14 * s)}`;
    const S = Ls ?? L;
    S.lit += rect(x - 4.6 * s, y - 13 * s, 9.2 * s, 7.6 * s);
    S.dark += rect(x - 2.6 * s, y - 13 * s, 1.3 * s, 7.6 * s) + rect(x + 1.3 * s, y - 13 * s, 1.3 * s, 7.6 * s);
  }
}

/** Boat-shed (naust) seen from the water: open gable with a stem post inside. */
function naust(L: Item, x: number, w: number, h: number, y = 0) {
  L.body += poly([[x, y], [x, y - h * 0.32], [x + w / 2, y - h], [x + w, y - h * 0.32], [x + w, y]]);
  L.shade += poly([[x + w / 2, y - h], [x + w, y - h * 0.32], [x + w, y], [x + w * 0.62, y]]);
  L.dark += poly([[x + w * 0.16, y], [x + w * 0.16, y - h * 0.34], [x + w / 2, y - h * 0.8], [x + w * 0.84, y - h * 0.34], [x + w * 0.84, y]]);
  L.lit += `M${f(x + w * 0.42)},${f(y)}Q${f(x + w * 0.56)},${f(y - h * 0.2)} ${f(x + w * 0.5)},${f(y - h * 0.55)}L${f(x + w * 0.56)},${f(y - h * 0.55)}Q${f(x + w * 0.62)},${f(y - h * 0.2)} ${f(x + w * 0.5)},${f(y)}Z`;
  L.line += `M${f(x)},${f(y - h * 0.32)}L${f(x + w / 2)},${f(y - h)}L${f(x + w)},${f(y - h * 0.32)}`;
}

/** Trelleborg-type ring fortress side-on: a broad flat-topped rampart with palisade, gate, roofs within. */
function ringFortress(L: Item, Lb: Item, x: number, w: number, h: number) {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const hw = ((w - 30) / 4) * 0.9;
  for (let k = 0; k < 4; k++) {
    const hx = x0 + 15 + k * ((w - 30) / 4);
    const d = `M${f(hx)},${f(-h + 1)}C${f(hx + 1)},${f(-h - 6)} ${f(hx + hw - 1)},${f(-h - 6)} ${f(hx + hw)},${f(-h + 1)}`;
    Lb.body += d + 'Z';
    Lb.line += d;
  }
  L.body += `M${f(x0)},0Q${f(x0 + 6)},${f(-h)} ${f(x0 + 14)},${f(-h)}H${f(x1 - 14)}Q${f(x1 - 6)},${f(-h)} ${f(x1)},0Z`;
  L.shade += `M${f(x0)},0Q${f(x0 + 6)},${f(-h)} ${f(x0 + 14)},${f(-h)}V${f(-h * 0.25)}H${f(x1 - 14)}V${f(-h)}Q${f(x1 - 6)},${f(-h)} ${f(x1)},0Z`;
  for (let px = x0 + 12; px < x1 - 12; px += 2.6) L.body += rect(px, -h - 2.6, 1.4, 2.6);
  L.line += `M${f(x0 + 14)},${f(-h)}H${f(x1 - 14)}`;
  L.dark += poly([[x - 4.5, 0], [x - 3.5, -h + 0.5], [x + 3.5, -h + 0.5], [x + 4.5, 0]]);
  block(L, x - 5.5, 11, 4, -h, 0.3);
}

function pine(L: Item, x: number, h: number, y = 0) {
  L.body += rect(x - 0.5, y - h * 0.22, 1, h * 0.22);
  L.body += poly([[x - h * 0.26, y - h * 0.18], [x, y - h * 0.62], [x + h * 0.26, y - h * 0.18]]);
  L.body += poly([[x - h * 0.2, y - h * 0.48], [x, y - h], [x + h * 0.2, y - h * 0.48]]);
  L.shade += poly([[x, y - h * 0.62], [x + h * 0.26, y - h * 0.18], [x, y - h * 0.18]]);
}

/** A little harbour on the bank: an inlet of water with plank jetties on posts. */
function harbour(L: Item, x0: number, x1: number, jetties: number[]) {
  L.water += rect(x0, -3, x1 - x0, 3.4);
  for (const jx of jetties) {
    L.body += rect(jx, -3.6, 22, 1.2);
    for (let px = jx + 2; px < jx + 22; px += 5) L.stroke += `M${f(px)},${f(-2.4)}v2.4`;
  }
}

/* ------------------------------------------------------------------------ */
/* Civilization layouts                                                       */
/* ------------------------------------------------------------------------ */

const COUNT = [5, 10, 16, 22, 30];
const HMUL = [0.72, 0.88, 1.05, 1.22, 1.38];

function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Slot {
  x: number;
  w: number;
  h: number;
  back: boolean;
}

/** Fixed house slots per civ: later Ages add the outer slots, so a town visibly grows outward. */
function slots(civ: Civ): Slot[] {
  const R = rng(seedOf(civ));
  const out: Slot[] = [];
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1;
    const dist = 26 + i * 11.5 + R() * 18;
    out.push({ x: 400 + side * dist, w: 10 + R() * 11, h: 0.75 + R() * 0.5, back: i % 3 === 1 });
  }
  return out;
}

function dwelling(L: Item, civ: Civ, era: number, s: Slot, R: () => number, golden: boolean) {
  const base = 14 * HMUL[era - 1] * s.h;
  const y = s.back ? -3 : 0;
  const w = era === 1 ? Math.min(s.w, 14) : s.w;
  const x = s.x - w / 2;
  const tall = era >= 4 && R() < 0.45;
  switch (civ) {
    case 'kush':
      if (era === 1) roundHut(L, x, w, base * 1.1, y);
      else flatHouse(L, x, w, base * 0.8, R, golden, y, era >= 3);
      break;
    case 'aksum':
      if (era === 1) roundHut(L, x, w, base * 1.1, y);
      else {
        flatHouse(L, x, w, base * 0.85, R, golden, y);
        if (era >= 3) for (let xx = x + 1.5; xx < x + w - 1; xx += 3.4) L.dark += rect(xx, y - base * 0.85 + 2.4, 1, 1);
      }
      break;
    case 'carthage':
      if (era === 1) gableHouse(L, x, w, base, y);
      else flatHouse(L, x, w, base * (era >= 3 ? 1.05 : 0.85), R, golden, y);
      break;
    case 'sumer':
      if (era === 1 || (era === 2 && R() < 0.5)) reedHut(L, x, w, base * 1.05, y);
      else flatHouse(L, x, w, base * 0.8, R, golden, y, true);
      break;
    case 'inca':
      gableHouse(L, x, w, base * 1.15, y, true);
      if (era >= 3) for (let yy = y - 2.6; yy > y - base * 0.6; yy -= 2.6) L.line += `M${f(x)},${f(yy)}h${f(w)}`;
      break;
    case 'norse':
      // the town layer is stretched 1.45x vertically, so keep these low and long
      if (era === 1 || (era === 2 && R() < 0.4)) turfHouse(L, x - w * 0.1, w * 1.3, base * 0.5, y);
      else longhouseS(L, x - w * 0.3, w * 1.6, base * (era >= 4 ? 0.56 : 0.5), y);
      break;
  }
  if (tall && civ !== 'inca' && civ !== 'norse' && era > 1) {
    const top = y - base * (civ === 'carthage' ? 1.05 : 0.82);
    flatHouse(L, x + w * 0.15, w * 0.7, base * 0.5, R, golden, top);
  }
}

/** Far scenery behind the town (hills, peaks, sea). */
function scenery(S: Scene, civ: Civ, age: Age) {
  const L = S.item('far', true);
  const R = rng(seedOf(civ + 'far'));
  const hillLine = (y0: number, amp: number, step: number) => {
    let d = `M-10,0V${f(y0)}`;
    for (let x = -10; x < 810; x += step) d += `Q${f(x + step / 2)},${f(y0 - amp * (0.4 + R()))} ${f(x + step)},${f(y0 - R() * amp * 0.3)}`;
    return d + 'V0Z';
  };
  switch (civ) {
    case 'kush':
      L.body += hillLine(-8, 8, 120);
      break;
    case 'aksum':
      L.body += hillLine(-26, 26, 110);
      S.item('back', true).body += hillLine(-10, 12, 80);
      break;
    case 'sumer':
      for (let x = 10; x < 800; x += 22 + R() * 30) palm(L, x, 10 + R() * 6, -1);
      break;
    case 'carthage': {
      L.water += rect(520, -14, 300, 14);
      L.body += `M-10,0V-10Q120,-26 260,-12Q380,-4 520,-6V0Z`;
      L.body += `M760,-14Q790,-26 820,-20V-14Z`;
      break;
    }
    case 'norse': {
      // a steep-sided fjord: sheer walls at both ends, a lower ridge far up the inlet
      S.item('far', true).body += hillLine(-12, 10, 70);
      L.body += 'M-10,0V-86Q16,-90 54,-74Q110,-48 160,-18Q190,-4 230,0Z';
      L.body += 'M810,0V-92Q784,-94 744,-76Q690,-50 640,-18Q610,-4 572,0Z';
      L.line += 'M20,-80Q70,-62 120,-36M60,-70Q100,-50 150,-22M780,-86Q740,-66 700,-46M750,-74Q700,-46 660,-22';
      break;
    }
    case 'inca': {
      let d = 'M-10,0';
      let snow = '';
      const peaks: P[] = [[60, -92], [170, -70], [300, -100], [440, -82], [560, -104], [690, -76], [790, -96]];
      let px = -10;
      for (const [x, y] of peaks) {
        d += `L${f((px + x) / 2)},${f(y * 0.55)}L${f(x)},${f(y)}`;
        snow += poly([[x - 10, y + 12], [x, y], [x + 11, y + 13], [x + 5, y + 10], [x + 1, y + 14], [x - 4, y + 9]]);
        px = x;
      }
      L.body += d + 'L810,-50V0Z';
      L.lit += snow;
      break;
    }
  }
}

function signature(S: Scene, civ: Civ, age: Age, R: () => number, golden: boolean) {
  const L = S.item('main');
  switch (civ) {
    case 'kush': {
      if (age === 2 || age === 3) {
        // Western Deffufa of Kerma: a massive tapered mudbrick block
        const x = 330;
        L.body += `M${x - 26},0L${x - 23},-27Q${x - 22},-30 ${x - 18},-30H${x + 18}Q${x + 22},-30 ${x + 23},-27L${x + 26},0Z`;
        L.shade += poly([[x + 12, 0], [x + 26, 0], [x + 23, -27], [x + 12, -30]]);
        for (let y = -4; y > -28; y -= 4) L.line += `M${x - 24},${y}H${x + 24}`;
        door(L, x - 8, 0, 4, 7);
      }
      if (age >= 3) pylonTemple(S.item('main'), 520, 40, age >= 4 ? 26 : 22);
      if (age >= 4) {
        const P = S.item('main');
        const set: [number, number][] = age === 5
          ? [[330, 28], [352, 36], [376, 44], [400, 53], [424, 42], [446, 34], [466, 27]]
          : [[376, 34], [400, 42], [424, 31]];
        for (const [x, h] of set) pyramid(P, x, h * 0.58, h);
        if (golden) for (const [x, h] of set.filter((_, i) => i % 2 === 1)) banner(P, x - h * 0.3, -h * 0.14, 10);
      }
      break;
    }
    case 'aksum': {
      if (age >= 3) aksumPalace(S.item('main'), 520, age === 5 ? 64 : 52, age === 5 ? 36 : age === 4 ? 30 : 25, R, golden);
      if (age >= 4) {
        const Ls = S.item('main');
        const set: [number, number, number][] = age === 5
          ? [[340, 6, 20], [356, 7, 30], [374, 8, 40], [396, 10, 54], [418, 8, 37], [434, 7, 27], [448, 5, 18]]
          : [[378, 7, 28], [398, 9, 38], [416, 6, 22]];
        for (const [x, w, h] of set) stele(Ls, x - w / 2, w, h);
        Ls.body += rect(age === 5 ? 330 : 368, -1.6, age === 5 ? 130 : 58, 1.6);
      }
      break;
    }
    case 'carthage': {
      if (age >= 3) {
        // Byrsa hill rising behind the town
        const hill = age === 5 ? 26 : age === 4 ? 22 : 17;
        const Lh = S.item('back');
        Lh.body += `M320,0Q350,${-hill} 400,${-hill}Q450,${-hill} 480,0Z`;
        for (let k = 0; k < 7; k++) {
          const x = 364 + k * 12;
          const top = -hill + Math.abs(k - 3) * 2.4;
          flatHouse(Lh, x - 5, 9, 5 + R() * 4, R, golden, top + 1.5);
        }
        if (age >= 4) {
          carthTemple(S.item('main'), 400, age === 5 ? 42 : 32, age === 5 ? 24 : 18, -hill);
          if (golden) banner(S.item('main'), 400, -hill - 24, 9);
        }
      }
      if (age >= 4) cothon(S.item('main'), 590, age === 5 ? 60 : 48, -2, age === 5 ? 6 : 3);
      if (age === 1) {
        const Lp = S.item('main');
        Lp.body += rect(500, -2, 50, 2);
        for (let x = 502; x < 550; x += 10) Lp.stroke += `M${x},0v3`;
        ship(Lp, 536, -2, 1);
        ship(Lp, 574, -1, 0.85);
      }
      if (age === 2 || age === 3) {
        const Lw = S.item('main');
        flatHouse(Lw, 520, 40, 9, R, golden, 0);
        ship(Lw, 580, -1, 1);
        ship(Lw, 610, -2, 0.85);
        if (age === 3) ship(Lw, 640, -1, 0.9);
      }
      break;
    }
    case 'sumer': {
      if (age === 2) dome(S.item('main'), 470, 18, 16);
      if (age >= 3) sumerTemple(S.item('main'), age >= 4 ? 500 : 460, 34, age >= 4 ? 20 : 24);
      if (age >= 4) {
        const Lz = S.item('main');
        ziggurat(Lz, 400, age === 5 ? 120 : 92, age === 5 ? 46 : 34, age === 5);
        if (golden) {
          banner(Lz, 400 - 60 + 6, 0, 12);
          banner(Lz, 400 + 60 - 6, 0, 12);
        }
      }
      break;
    }
    case 'norse': {
      if (age === 1) {
        const Lr = S.item('main');
        dryingRack(Lr, 352, 20, 8);
        dryingRack(Lr, 448, 16, 7);
        longboat(Lr, 506, -1, 0.9, false);
        longboat(Lr, 528, -1, 0.75, false);
      }
      if (age === 2 || age === 3) {
        const Lh = S.item('main');
        harbour(Lh, 490, 660, [504, 560, 616]);
        longboat(Lh, 540, -2, 1.15, true);
        longboat(Lh, 596, -2, age === 3 ? 1.4 : 1.0, age === 3);
        if (age === 3) longboat(Lh, 646, -2, 1.05, true);
        dryingRack(Lh, 300, 18, 7);
      }
      if (age === 3) longhouseS(S.item('main'), 372, 64, 16, 0, true);
      if (age >= 4) {
        const Lb = S.item('back');
        const Lf = S.item('main');
        ringFortress(Lf, Lb, 290, age === 5 ? 140 : 120, age === 5 ? 15 : 13);
        if (golden) {
          banner(Lf, 236, -17, 10);
          banner(Lf, 344, -17, 10);
        }
        const Ln = S.item('main');
        harbour(Ln, 500, 720, age === 5 ? [] : [640]);
        for (let k = 0; k < 3; k++) naust(Ln, 506 + k * 30, 24, 14, -0.4);
        if (age === 4) {
          longboat(Ln, 678, -2, 1.3, true);
          longhouseS(S.item('main'), 400, 60, 17, 0, true);
        }
      }
      if (age === 5) {
        const Lg = S.item('main');
        longhouseS(Lg, 384, 116, 28, 0, true);
        smoke(Lg, 442, -30, 18, 3);
        banner(Lg, 378, -2, 18);
        banner(Lg, 506, -2, 18);
        const Lfl = S.item('main');
        for (let k = 0; k < 6; k++) longboat(Lfl, 612 + k * 20 + (k % 2) * 4, -2 + (k % 2) * 0.6, 1.25 - (k % 2) * 0.2, true);
      }
      break;
    }
    case 'inca': {
      if (age >= 3) incaHall(S.item('main'), 436, 46, 17);
      if (age >= 4) {
        const Lb = S.item('back');
        const Lf = S.item('main');
        const top = incaFortress(Lf, Lb, 350, age === 5 ? 80 : 64, age === 5 ? 18 : 15, age === 5 ? 34 : 28, age === 5);
        if (golden) {
          banner(Lf, 318, -18, 9);
          banner(Lf, 382, -18, 9);
          banner(Lf, 350, top - 10, 9);
        }
      }
      break;
    }
  }
}

/** Mountain terraces / qullqa for the Inca, palms for the Nile and the marshes. */
function landscape(S: Scene, civ: Civ, age: Age, R: () => number) {
  if (civ === 'inca') {
    const L = S.item('back', true);
    // terraced slope on the left, rising toward the peaks
    L.body += 'M-10,0V-58Q60,-62 130,-40Q180,-20 230,0Z';
    const rows = 2 + age * 2;
    for (let k = 0; k < rows; k++) {
      const y = -4 - k * (52 / rows);
      const xEnd = 230 - (k / rows) * 120;
      L.line += `M-10,${f(y)}Q${f(xEnd * 0.5)},${f(y - 4)} ${f(xEnd)},${f(y + 2)}`;
    }
    if (age >= 2) {
      const Q = S.item('back', true);
      Q.body += 'M590,0Q660,-46 760,-50Q800,-48 810,-44V0Z';
      const n = age * 3;
      for (let k = 0; k < n; k++) {
        const x = 640 + (k % 6) * 22 + (Math.floor(k / 6) % 2) * 11;
        const y = -14 - Math.floor(k / 6) * 9;
        Q.body += rect(x - 3, y - 4, 6, 4);
        Q.body += `M${x - 3.4},${y - 4}Q${x},${y - 9} ${x + 3.4},${y - 4}Z`;
      }
      if (age >= 3) Q.line += 'M470,0L560,-10L520,-20L610,-30L580,-40L660,-46';
    }
  }
  if (civ === 'norse') {
    const L = S.item('main');
    const n = 4 + age;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const x = 400 + side * (150 + i * 26 + R() * 18);
      pine(L, x, 14 + R() * 8);
      pine(L, x + 6, 10 + R() * 6, -1);
    }
  }
  if (civ === 'kush' || civ === 'sumer') {
    const L = S.item('main');
    const n = civ === 'sumer' ? 3 + age * 2 : 2 + age;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      palm(L, 400 + side * (60 + i * 34 + R() * 20), 16 + R() * 8);
    }
  }
}

function defences(S: Scene, civ: Civ, age: Age, golden: boolean) {
  const L = S.item('main');
  const span = [0, 120, 160, 220, 280][age - 1];
  if (civ === 'norse') {
    // open market town at Age II, a palisade at III; from IV the ring fortress is the stronghold
    if (age === 3) palisade(L, 400 - span * 0.75, 400 - 28, 9);
    if (age === 3) palisade(L, 400 + 28, 400 + span * 0.45, 9);
    return;
  }
  if (age === 2) {
    if (civ === 'sumer') {
      L.body += rect(400 - span, -7, span * 2, 7);
      for (let x = 400 - span; x < 400 + span; x += 10) L.body += rect(x, -10, 4, 3);
    } else if (civ === 'inca') {
      for (let x = 400 - span; x < 400 + span; x += 9) L.body += rect(x, -5, 8.4, 5);
    } else palisade(L, 400 - span, 400 + span, 9);
  }
  if (age >= 3) {
    const h = [0, 0, 8, 10, 12][age - 1];
    if (civ === 'inca') {
      // kancha enclosure walls of fitted stone, no battlements
      L.body += rect(400 - span, -h * 0.55, span * 2, h * 0.55);
      for (let x = 400 - span; x < 400 + span; x += 6) L.line += `M${f(x)},0v${f(-h * 0.55)}`;
      trapDoor(L, 400, 0, 8, h * 0.55);
    } else if (civ === 'carthage') {
      cityWall(L, 400 - span, 400 + span * 0.62, h, 400, 56, { flags: golden });
    } else cityWall(L, 400 - span, 400 + span, h, 400, 60, { flags: golden });
  }
}

/* ------------------------------------------------------------------------ */
/* Public component                                                           */
/* ------------------------------------------------------------------------ */

export function Skyline({
  civ,
  age,
  palette,
  side,
  className,
}: {
  civ: Civ;
  age: Age;
  palette: Palette;
  side: 'near' | 'far';
  className?: string;
}) {
  const uid = 'pmsky' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (n: string) => `${uid}-${n}`;
  const u = (n: string) => `url(#${id(n)})`;
  const p = palette;
  const a = (Math.min(5, Math.max(1, Math.round(age))) || 1) as Age;
  const golden = a === 5;
  const far = side === 'far';

  /* backdrop tones */
  const skyTop = desat(mix(p.ink, p.primary, 0.3), 0.35);
  let skyLow = desat(mix(p.primary, p.accent, 0.38), 0.35);
  if (golden) skyLow = mix(skyLow, p.secondary, 0.5);
  const groundTop = desat(mix(p.ink, p.primary, 0.45), 0.3);
  const groundLow = mix(p.ink, groundTop, 0.55);
  const waterTop = desat(mix(p.primary, p.accent, 0.25), 0.4);
  const waterLow = mix(p.ink, p.primary, 0.3);
  const bg = far ? skyLow : groundTop;
  const sil = mix(p.ink, p.primary, 0.18);
  const tone = (k: number): Tones => {
    const body = mix(bg, sil, k);
    return {
      body,
      shade: mix(body, p.ink, 0.35),
      lit: mix(body, p.accent, 0.28),
      dark: mix(body, p.ink, 0.55),
      glow: mix(p.accent, '#ffffff', 0.2),
      line: p.accent,
      lineOp: 0.16 + k * 0.2,
      flag: mix(body, p.secondary, 0.65),
      smoke: mix(bg, p.accent, 0.4),
      water: mix(bg, waterTop, 0.7),
    };
  };
  const S = new Scene({ far: tone(far ? 0.2 : 0.1), back: tone(0.38), main: tone(0.55) });
  const R = rng(seedOf(civ + a));

  scenery(S, civ, a);
  landscape(S, civ, a, R);
  const all = slots(civ).slice(0, COUNT[a - 1]);
  const prevN = a > 1 ? COUNT[a - 2] : 0;
  const B = S.item('back');
  for (const s of all.filter((s) => s.back)) dwelling(B, civ, all.indexOf(s) >= prevN && a > 1 ? a - 1 : a, s, R, golden);
  signature(S, civ, a, R, golden);
  for (const s of all.filter((s) => !s.back)) dwelling(S.item('main'), civ, all.indexOf(s) >= prevN && a > 1 ? a - 1 : a, s, R, golden);
  // hearth smoke in the early, small settlements
  if (a <= 3) {
    const Sm = S.item('main');
    all.slice(0, 3 + a).forEach((s, i) => i % 2 === 0 && smoke(Sm, s.x, -14 * HMUL[a - 1] * s.h - 2, 16 + a * 3));
  }
  defences(S, civ, a, golden);

  /* ground plane features: fields (early), roads & canals (later) */
  const ground: string[] = [];
  let fieldsD = '';
  if (a <= 3) {
    const Rf = rng(seedOf(civ + 'fields'));
    let d = '';
    for (const sgn of [-1, 1]) {
      const x0 = 400 + sgn * (110 + a * 60);
      for (let k = 0; k < 7; k++) {
        const xa = x0 + sgn * k * 30;
        const w = 22 + Rf() * 8;
        if (Rf() < 0.3) continue;
        for (let r = 0; r < 4; r++) d += `M${f(xa + sgn * r * 1.5)},${f(4 + r * 3)}h${f(sgn * w)}`;
      }
    }
    fieldsD = d;
  }
  if (a >= 3) ground.push(`M400,2L${400 - 60 - a * 10},36M400,2L${400 + 60 + a * 10},36M${400 - 200 - a * 30},6H${400 + 200 + a * 30}`);
  if (civ === 'sumer') ground.push(`M-10,10Q200,6 400,12T810,8M${300 - a * 20},10L${260 - a * 20},36M${520 + a * 20},12L${560 + a * 20},36`);

  /* reeds along the bank edge */
  const Rr = rng(seedOf(civ + 'reeds'));
  let reeds = '';
  for (let x = -4; x < 806; x += 3 + Rr() * 4) {
    if (Rr() < 0.25) {
      x += 14;
      continue;
    }
    const hgt = 6 + Rr() * 9;
    reeds += `M${f(x)},0q${f((Rr() - 0.5) * 2)},${f(-hgt * 0.5)} ${f((Rr() - 0.5) * 5)},${f(-hgt)}`;
  }

  const scenery_ = S.items.filter((it) => it.free).map(renderItem);
  const town = S.items.filter((it) => !it.free).map(renderItem);
  const TS = 'scale(1.2 1.45) translate(-400 0)';
  const ripples = 'M40,0h40M150,4h60M300,1h36M420,5h50M560,2h44M690,5h36';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 140"
      preserveAspectRatio="xMidYMax slice"
      width="100%"
      height="100%"
      className={className}
      style={{ display: 'block' }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyLow} />
        </linearGradient>
        <linearGradient id={id('gnd')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={groundTop} />
          <stop offset="1" stopColor={groundLow} />
        </linearGradient>
        <linearGradient id={id('gndN')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(groundTop, p.accent, 0.08)} />
          <stop offset="0.5" stopColor={groundTop} />
          <stop offset="1" stopColor={mix(groundTop, groundLow, 0.5)} />
        </linearGradient>
        <linearGradient id={id('wat')} x1="0" y1={far ? 0 : 1} x2="0" y2={far ? 1 : 0}>
          <stop offset="0" stopColor={waterTop} />
          <stop offset="1" stopColor={waterLow} />
        </linearGradient>
        <linearGradient id={id('mist')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg} stopOpacity="0" />
          <stop offset="1" stopColor={bg} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={id('glow')} cx="0.5" cy="1" r="0.6">
          <stop offset="0" stopColor={p.accent} stopOpacity={golden ? 0.5 : 0.18} />
          <stop offset="0.5" stopColor={p.secondary} stopOpacity={golden ? 0.2 : 0.05} />
          <stop offset="1" stopColor={p.secondary} stopOpacity="0" />
        </radialGradient>
      </defs>

      {far ? (
        <>
          <rect width={800} height={140} fill={u('sky')} />
          <ellipse cx={420} cy={80} rx={420} ry={golden ? 90 : 60} fill={u('glow')} />
          {golden && (
            <g>
              <circle cx={600} cy={74} r={26} fill={p.accent} opacity={0.14} />
              <circle cx={600} cy={74} r={11} fill={mix(p.accent, '#ffffff', 0.2)} opacity={0.55} />
            </g>
          )}
          <g transform="translate(0 86)">{scenery_}</g>
          <rect y={86} width={800} height={54} fill={u('gnd')} />
          <g transform={`translate(400 86) ${TS}`}>{town}</g>
          <rect y={72} width={800} height={16} fill={u('mist')} />
          <g transform="translate(0 86)">
            {fieldsD && <path d={fieldsD} fill="none" stroke={p.accent} strokeOpacity={0.13} strokeWidth={1} strokeLinecap="round" />}
            {ground.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={p.accent} strokeOpacity={0.1} strokeWidth={0.8} strokeLinecap="round" />
            ))}
          </g>
          <rect y={124} width={800} height={16} fill={u('wat')} />
          <path d="M0,124 H800" stroke={p.accent} strokeOpacity={0.22} strokeWidth={0.8} />
          <g transform="translate(0 131)">
            <path d={ripples} stroke={p.accent} strokeOpacity={0.14} strokeWidth={0.8} fill="none" />
          </g>
          <g transform="translate(0 126)">
            <path d={reeds} fill="none" stroke={mix(groundLow, p.secondary, 0.25)} strokeOpacity={0.55} strokeWidth={1} strokeLinecap="round" />
          </g>
        </>
      ) : (
        <>
          <rect width={800} height={140} fill={u('gndN')} />
          <ellipse cx={420} cy={140} rx={420} ry={golden ? 90 : 60} fill={u('glow')} />
          <g transform="translate(0 140)">{scenery_}</g>
          <g transform={`translate(400 140) ${TS}`}>{town}</g>
          <rect y={0} width={800} height={17} fill={u('wat')} />
          <path d="M0,17 H800" stroke={p.accent} strokeOpacity={0.22} strokeWidth={0.8} />
          <g transform="translate(0 8)">
            <path d={ripples} stroke={p.accent} strokeOpacity={0.14} strokeWidth={0.8} fill="none" />
          </g>
          <g transform="translate(0 30)">
            <path d={reeds} fill="none" stroke={mix(groundLow, p.secondary, 0.25)} strokeOpacity={0.55} strokeWidth={1} strokeLinecap="round" />
          </g>
        </>
      )}
    </svg>
  );
}
