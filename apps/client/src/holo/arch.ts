import * as THREE from 'three';
import type { CivId } from '@pm/engine';
import { Builder, box, cyl, cone, dome, prism, pyr, sph, seeded, torus, trapezoid, type HoloModel, type V3 } from './kit';

/*
 * Culture-specific hologram architecture. Every civilization builds in its
 * own vocabulary (see docs/HISTORY_NOTES.md — impressionistic but grounded,
 * architecture only, no sacred iconography):
 *
 *   kush     mudbrick with battered walls, round thatched huts, pylon
 *            gateways, steep narrow pyramids with pylon-fronted chapels,
 *            the Western Deffufa, rounded bastions, bowl furnaces.
 *   aksum    stone on stepped platforms, storeys separated by recessed
 *            bands with protruding timber "monkey-head" beam ends, tall
 *            stelae with false-window storeys and rounded heads, terraces.
 *   carthage whitewashed flat-roof houses of several storeys stepping up a
 *            hill, Punic flared ("gorge") cornices, columned podium temples,
 *            towered ashlar walls, the circular cothon, dye vats, olives.
 *   sumer    low mudbrick with niched buttress facades, stepped
 *            crenellations, arched reed mudhif houses, the ziggurat with its
 *            three stairways, half-round wall towers, canals and date palms.
 *   inca     fitted polygonal/ashlar stone (joint lines), trapezoidal doors
 *            and niches, steep thatched roofs with roof pegs, curving
 *            terraces, qullqa rows, kallanka halls, zig-zag fortress walls.
 *
 * Conventions follow kit.ts: ground y = 0, front faces +z, a person ~0.3.
 */

export type ArchPiece = 'house' | 'hall' | 'temple' | 'monument' | 'wonder' | 'walls' | 'gate' | 'tower' | 'palisade' | 'granary' | 'farm' | 'market' | 'harbor' | 'workshop' | 'road' | 'palace' | 'furnace' | 'canal' | 'quarry';

const PI = Math.PI;
type Rnd = () => number;
type P2 = [number, number];
interface C { b: Builder; p?: THREE.Object3D; r: Rnd; civ: CivId }

// ------------------------------------------------------------ ctx helpers

/** Add a part to the current group (top level when the context has no parent). */
function A(c: C, g: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], e = true) { return c.b.add(g, pos, rot, c.p, e); }
function L(c: C, pts: V3[]) { return c.b.line3(pts, c.p); }
/** A sub-group: one shatter chunk at top level, or nested inside the current group. */
function G(c: C, pos: V3, rotY = 0, s = 1): C {
  const g = c.b.pivot(pos, c.p);
  g.rotation.y = rotY;
  g.scale.setScalar(s);
  return { ...c, p: g };
}

// ------------------------------------------------------------ grounded geometry (base at y = 0)

const bx = (w: number, h: number, d: number) => box(w, h, d).translate(0, h / 2, 0);
const cy = (rt: number, rb: number, h: number, seg = 10) => cyl(rt, rb, h, seg).translate(0, h / 2, 0);
const cn = (r: number, h: number, seg = 8) => cone(r, h, seg).translate(0, h / 2, 0);
/** Square pyramid with half-side `half`, edges aligned to x/z. */
const pr = (half: number, h: number) => pyr(half * Math.SQRT2, h).rotateY(PI / 4).translate(0, h / 2, 0);
/** Tapered (battered) box: top is (1-t) times the base. */
function tb(w: number, h: number, d: number, t = 0) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * (1 - t), Math.SQRT1_2, h, 4, 1);
  g.rotateY(PI / 4); g.scale(w, 1, d); g.translate(0, h / 2, 0);
  return g;
}
/** Trapezoid slab facing +z (doorways, niches, pylons). */
const tp = (wb: number, wt: number, h: number, d: number) => prism(trapezoid(wb, wt, h), d);
/** Gable roof with the ridge along x (eaves face the front). */
const gableX = (w: number, h: number, d: number) => prism([[-d / 2, 0], [d / 2, 0], [0, h]], w).rotateY(PI / 2);
/** Half cylinder lying along z (arched reed houses). */
const hcyl = (r: number, len: number, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2);
/** Vertical half cylinder bulging toward +z (half-round wall towers). */
const hcylV = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg, 1, false, -PI / 2, PI).translate(0, h / 2, 0);
/** Upper half disc facing +z (the rounded head of a stele). */
const hdisc = (r: number, d: number) => new THREE.CylinderGeometry(r, r, d, 12, 1, false, PI / 2, PI).rotateX(PI / 2);
/** Cylinder sector centred on +z. */
/** A low mound (slag, spoil, shells) sitting on the ground. */
const heap = (r: number, sx = 1.3, sy = 0.5) => dome(r, 10).scale(sx, sy, 1);
const sector = (r: number, h: number, arc: number, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg, 1, false, -arc / 2, arc).translate(0, h / 2, 0);
/** Annulus (round walls, quays) with an optional gap facing +z. */
function ring(ro: number, ri: number, h: number, gap = 0, seg = 28) {
  const pts = [new THREE.Vector2(ri, 0), new THREE.Vector2(ro, 0), new THREE.Vector2(ro, h), new THREE.Vector2(ri, h), new THREE.Vector2(ri, 0)];
  return new THREE.LatheGeometry(pts, seg, gap / 2, PI * 2 - gap);
}
/** Extrude a ground plan (x, z) upward by h. */
const plan = (pts: P2[], h: number) => prism(pts.map(([x, z]) => [x, -z] as P2), h).rotateX(-PI / 2).translate(0, h / 2, 0);
/** A flight of steps, highest at z = 0 and descending toward +z. */
function stairs(n: number, run: number, rise: number, w: number) {
  const Lr = n * run;
  const pts: P2[] = [[0, 0], [Lr, 0]];
  for (let i = 0; i < n; i++) pts.push([Lr - i * run, (i + 1) * rise], [Lr - (i + 1) * run, (i + 1) * rise]);
  return prism(pts, w).rotateY(-PI / 2);
}
/** A wall elevation W×H (depth D) with an optional opening cut from its base and crenellations. */
function wallG(W: number, H: number, D: number, o: { open?: P2[]; cren?: 'plain' | 'stepped'; n?: number; mh?: number } = {}) {
  const pts: P2[] = [[-W / 2, 0]];
  if (o.open) pts.push(...o.open);
  pts.push([W / 2, 0], [W / 2, H]);
  if (o.cren) {
    const n = o.n ?? 5, mh = o.mh ?? 0.04, u = W / (2 * n + 1);
    for (let k = 0; k <= 2 * n; k++) {
      const x0 = W / 2 - k * u;
      if (k % 2 === 0) {
        if (o.cren === 'stepped') pts.push([x0, H + mh * 0.5], [x0 - u * 0.25, H + mh * 0.5], [x0 - u * 0.25, H + mh], [x0 - u * 0.75, H + mh], [x0 - u * 0.75, H + mh * 0.5], [x0 - u, H + mh * 0.5], [x0 - u, H]);
        else pts.push([x0, H + mh], [x0 - u, H + mh], [x0 - u, H]);
      } else pts.push([x0 - u, H]);
    }
  }
  pts.push([-W / 2, H]);
  return prism(pts, D);
}
const archOpen = (w: number, h: number, x = 0, n = 8): P2[] => {
  const r = w / 2, pts: P2[] = [[x - r, 0], [x - r, h - r]];
  for (let i = 1; i < n; i++) { const a = PI - (i / n) * PI; pts.push([x + r * Math.cos(a), h - r + r * Math.sin(a)]); }
  pts.push([x + r, h - r], [x + r, 0]);
  return pts;
};
const trapOpen = (wb: number, wt: number, h: number, x = 0): P2[] => [[x - wb / 2, 0], [x - wt / 2, h], [x + wt / 2, h], [x + wb / 2, 0]];
const rectOpen = (w: number, h: number, x = 0): P2[] => [[x - w / 2, 0], [x - w / 2, h], [x + w / 2, h], [x + w / 2, 0]];

// ------------------------------------------------------------ shared small elements

/** A doorway plate on a front face at height y, depth position z. Inca doorways are trapezoids. */
function door(c: C, x: number, z: number, w = 0.06, h = 0.13, y = 0, trap = c.civ === 'inca') {
  if (trap) A(c, tp(w, w * 0.72, h, 0.014), [x, y, z]);
  else A(c, bx(w, h, 0.012), [x, y, z]);
}
function niche(c: C, x: number, y: number, z: number, w = 0.04, h = 0.06) { A(c, tp(w, w * 0.7, h, 0.008), [x, y, z], [0, 0, 0], false); }
function water(c: C, w: number, d: number, pos: V3, ripples = 2) {
  const [x, , z] = pos, y = pos[1] + 0.003;
  A(c, new THREE.PlaneGeometry(w, d).rotateX(-PI / 2), [x, y, z], [0, 0, 0], false);
  L(c, [[x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2], [x - w / 2, y, z - d / 2]]);
  for (let i = 0; i < ripples; i++) {
    const z = pos[2] - d / 4 + (i * d) / 2 / Math.max(1, ripples - 1) * (ripples > 1 ? 1 : 0);
    const x0 = pos[0] - w * 0.35 + i * 0.05;
    L(c, [[x0, 0.009, z], [x0 + w * 0.18, 0.009, z + 0.006], [x0 + w * 0.36, 0.009, z]]);
  }
}
function field(c: C, x: number, z: number, w: number, d: number, rows = 4, y = 0) {
  A(c, bx(w, 0.01, d), [x, y, z]);
  for (let i = 0; i < rows; i++) { const zz = z - d / 2 + (d * (i + 0.5)) / rows; L(c, [[x - w * 0.45, y + 0.014, zz], [x + w * 0.45, y + 0.014, zz]]); }
}
function palm(c: C, x: number, z: number, h = 0.3) {
  A(c, cy(0.008, 0.013, h, 5), [x, 0, z], [0, 0, 0.06], false);
  const tx = x - h * 0.06, ty = h;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    L(c, [[tx, ty, z], [tx + dx * 0.05, ty + 0.025, z + dz * 0.05], [tx + dx * 0.095, ty - 0.03, z + dz * 0.095]]);
  }
}
function tree(c: C, x: number, z: number, s = 1) {
  L(c, [[x, 0, z], [x, 0.05 * s, z]]);
  A(c, sph(0.04 * s, 7, 5), [x, 0.075 * s, z], [0, 0, 0], false);
}
function shaduf(c: C, x: number, z: number) {
  L(c, [[x, 0, z], [x, 0.2, z]]);
  L(c, [[x - 0.14, 0.12, z], [x + 0.1, 0.26, z]]);
  L(c, [[x - 0.14, 0.12, z], [x - 0.14, 0.04, z]]);
  A(c, sph(0.022, 6, 4), [x + 0.1, 0.25, z], [0, 0, 0], false); // counterweight
}
/** Polygonal masonry joints drawn as one strip per course on a front face. */
function joints(c: C, x0: number, x1: number, y0: number, y1: number, z: number, courses = 3, poly = 1) {
  const H = (y1 - y0) / courses;
  for (let i = 1; i <= courses; i++) {
    const yb = y0 + H * i - (i === courses ? H : 0);
    if (i === courses && courses > 1) continue;
    const top = Math.min(y1, yb + H);
    const pts: V3[] = [];
    let x = x0;
    pts.push([x, yb, z]);
    while (x < x1 - 0.02) {
      x = Math.min(x1, x + (x1 - x0) / (2.5 + c.r() * 2.5));
      const jy = yb + (c.r() - 0.5) * H * 0.35 * poly;
      pts.push([x, jy, z]);
      if (x < x1 - 0.02) { const lean = (c.r() - 0.5) * 0.03 * poly; pts.push([x + lean, top, z], [x, jy, z]); }
    }
    L(c, pts);
  }
  // the bottom course gets its vertical joints too
  const pts: V3[] = [[x0, y0 + 0.001, z]];
  let x = x0;
  while (x < x1 - 0.03) { x += (x1 - x0) / (3 + c.r() * 2); if (x >= x1 - 0.02) break; const lean = (c.r() - 0.5) * 0.03 * poly; pts.push([x, y0 + 0.001, z], [x + lean, y0 + H, z], [x, y0 + 0.001, z]); }
  if (pts.length > 1) L(c, pts);
}
/** Protruding timber beam ends ("monkey heads") along a recessed band. */
function monkeyHeads(c: C, x0: number, x1: number, y: number, z: number, n: number) {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    A(c, cyl(0.011, 0.011, 0.03, 6), [x, y, z], [PI / 2, 0, 0], false);
  }
}
function hull(c: C, pos: V3, rotY = 0, s = 1, kind: 'plank' | 'reed' | 'river' = 'plank', sail = true) {
  const g = G(c, pos, rotY, s);
  if (kind === 'reed') {
    // bundled reed boat with high curled ends
    A(g, cy(0.03, 0.03, 0.26, 8).rotateZ(PI / 2).translate(0.13, 0.0, 0), [0, 0.03, 0]);
    A(g, torus(0.05, 0.016, PI * 0.7, 8), [-0.13, 0.08, 0], [0, 0, PI * 0.25], false);
    A(g, torus(0.05, 0.016, PI * 0.7, 8), [0.13, 0.08, 0], [0, PI, PI * 0.25], false);
    if (sail) L(g, [[0, 0.05, 0], [0, 0.26, 0]]);
    return g;
  }
  const sh = new THREE.Shape();
  if (kind === 'river') { sh.moveTo(-0.2, 0.09); sh.quadraticCurveTo(-0.12, 0, 0, 0); sh.quadraticCurveTo(0.12, 0, 0.2, 0.09); sh.lineTo(-0.2, 0.09); }
  else { sh.moveTo(-0.22, 0.08); sh.quadraticCurveTo(-0.16, 0, 0, 0); sh.lineTo(0.16, 0); sh.lineTo(0.26, 0.06); sh.lineTo(0.16, 0.08); sh.lineTo(-0.22, 0.08); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false, curveSegments: 5 });
  geo.translate(0, 0, -0.045);
  A(g, geo, [0, 0.01, 0]);
  if (sail) {
    L(g, [[0, 0.09, 0], [0, 0.4, 0]]);
    if (kind === 'river') A(g, new THREE.PlaneGeometry(0.16, 0.18), [0, 0.26, 0.005], [0, 0, 0], true);
    else A(g, prism([[-0.12, 0.12], [0.1, 0.4], [0.12, 0.14]], 0.004), [0, 0, 0.005]); // lateen sail
  }
  return g;
}
function banner(c: C, x: number, z: number, h = 0.36) {
  L(c, [[x, 0, z], [x, h, z]]);
  A(c, prism([[0, 0], [0.07, -0.012], [0.07, -0.032], [0, -0.044]], 0.003), [x, h, z], [0, 0, 0], false);
}
function cow(c: C, pos: V3, rotY = 0) {
  const g = G(c, pos, rotY);
  A(g, bx(0.12, 0.055, 0.05), [0, 0.06, 0]);
  A(g, bx(0.04, 0.035, 0.035), [0.08, 0.09, 0], [0, 0, -0.4], false);
  for (const [x, z] of [[-0.05, -0.018], [-0.05, 0.018], [0.05, -0.018], [0.05, 0.018]] as P2[]) L(g, [[x, 0.06, z], [x, 0, z]]);
  // lyre-shaped horns, as Kerma cattle are depicted
  L(g, [[0.09, 0.11, -0.01], [0.085, 0.14, -0.04], [0.1, 0.18, -0.03]]);
  L(g, [[0.09, 0.11, 0.01], [0.085, 0.14, 0.04], [0.1, 0.18, 0.03]]);
}
function llama(c: C, pos: V3, rotY = 0) {
  const g = G(c, pos, rotY);
  A(g, bx(0.08, 0.04, 0.032), [0, 0.07, 0]);
  A(g, bx(0.016, 0.07, 0.016), [0.035, 0.1, 0], [0, 0, 0], false);
  A(g, bx(0.032, 0.016, 0.016), [0.045, 0.17, 0], [0, 0, 0], false);
  L(g, [[0.04, 0.186, 0], [0.04, 0.205, 0]]);
  for (const [x, z] of [[-0.03, -0.012], [-0.03, 0.012], [0.03, -0.012], [0.03, 0.012]] as P2[]) L(g, [[x, 0.07, z], [x, 0, z]]);
}

// ============================================================ KUSH: mudbrick, pylons, steep pyramids

function kushHut(c: C, s = 1) {
  A(c, cy(0.11 * s, 0.12 * s, 0.16 * s, 10), [0, 0, 0]);
  A(c, cn(0.15 * s, 0.16 * s, 10), [0, 0.16 * s, 0]);
  A(c, bx(0.05 * s, 0.11 * s, 0.01), [0, 0, 0.118 * s], [0, 0, 0], false);
}
function kushHouse(c: C, w = 0.34, d = 0.26, h = 0.22) {
  A(c, tb(w, h, d, 0.07), [0, 0, 0]);
  A(c, tb(w * 0.34, 0.08, d * 0.42, 0.06), [-w * 0.2, h, -d * 0.12]); // roof room
  door(c, w * 0.16, d / 2 - 0.004, 0.06, 0.14);
  A(c, bx(0.03, 0.02, 0.012), [-w * 0.2, h * 0.62, d / 2 - 0.006], [0, 0, 0], false); // window slit
  A(c, cyl(0.007, 0.007, 0.05, 5), [w * 0.3, h - 0.02, d / 2], [PI / 2, 0, 0], false); // roof spout
}
function kushPylon(c: C, gate = 0.12, tw = 0.16, h = 0.36, td = 0.12) {
  for (const sx of [-1, 1]) {
    const x = sx * (gate / 2 + tw / 2 - 0.01);
    A(c, tb(tw, h, td, 0.2), [x, 0, 0]);
    A(c, tb(tw * 0.8 + 0.02, 0.025, td * 0.8 + 0.02, -0.06), [x, h, 0], [0, 0, 0], false); // cornice
  }
  A(c, bx(gate + 0.03, 0.05, td * 0.7), [0, h * 0.6, 0]); // lintel over the portal
  A(c, bx(gate + 0.04, 0.014, td * 0.74), [0, h * 0.6 + 0.05, 0], [0, 0, 0], false);
}
function kushPyramid(c: C, half: number, h: number, chapel = true) {
  A(c, pr(half, h), [0, 0, 0]);
  A(c, bx(half * 0.3, h * 0.03, half * 0.3), [0, h * 0.9, 0], [0, 0, 0], false); // flattened cap
  if (chapel) {
    const k = half / 0.15;
    const z = half + 0.06 * k;
    A(c, bx(0.1 * k, 0.08 * k, 0.11 * k), [0, 0, z]);
    for (const sx of [-1, 1]) A(c, tb(0.05 * k, 0.12 * k, 0.03 * k, 0.22), [sx * 0.042 * k, 0, z + 0.06 * k]);
  }
}
function kushFurnaces(c: C) {
  for (const [x, z, s] of [[-0.2, 0.08, 1], [0, 0.14, 0.85], [0.18, 0.06, 0.95]] as V3[]) {
    const g = G(c, [x, 0, z], 0, s);
    A(g, cy(0.05, 0.085, 0.2, 10), [0, 0, 0]);
    A(g, torus(0.05, 0.01, PI * 2, 12), [0, 0.2, 0], [PI / 2, 0, 0], false);
    A(g, cyl(0.012, 0.012, 0.08, 6), [0, 0.04, 0.09], [PI / 2.6, 0, 0], false); // tuyère
    L(g, [[0, 0.2, 0], [0.02, 0.27, 0], [-0.01, 0.33, 0]]); // smoke
  }
  A(c, heap(0.2, 1.3, 0.55), [0.05, 0, -0.2]); // slag heap
  A(c, heap(0.1, 1.2, 0.5), [-0.3, 0, -0.12], [0, 0, 0], false); // ore pile
  kushHut(G(c, [0.34, 0, -0.06]), 0.7);
}

function kushPiece(c: C, piece: ArchPiece) {
  switch (piece) {
    case 'house':
      kushHouse(c);
      kushHut(G(c, [0.29, 0, 0.06]), 0.75);
      A(c, bx(0.5, 0.06, 0.02), [0.05, 0, 0.2]); // courtyard wall
      break;
    case 'hall':
      A(c, tb(0.52, 0.24, 0.26, 0.05), [0, 0, -0.06]);
      for (let i = 0; i < 4; i++) A(c, cy(0.018, 0.022, 0.2, 8), [-0.18 + i * 0.12, 0, 0.14]);
      A(c, bx(0.5, 0.025, 0.14), [0, 0.2, 0.1]);
      door(c, 0, 0.075, 0.07, 0.15);
      break;
    case 'temple': {
      kushPylon(G(c, [0, 0, 0.17]), 0.11, 0.17, 0.4, 0.1);
      for (const sx of [-1, 1]) A(c, bx(0.03, 0.16, 0.26), [sx * 0.22, 0, -0.03]); // court walls
      for (const x of [-0.08, 0.08]) for (const z of [0.0, -0.1]) A(c, cy(0.02, 0.024, 0.18, 8), [x, 0, z]);
      A(c, bx(0.3, 0.22, 0.16), [0, 0, -0.22]); // sanctuary
      A(c, bx(0.32, 0.02, 0.18), [0, 0.22, -0.22], [0, 0, 0], false);
      break;
    }
    case 'monument':
      kushPyramid(c, 0.15, 0.62);
      A(c, bx(0.5, 0.03, 0.56), [0, 0, 0.03]);
      break;
    case 'wonder':
      kushPyramid(G(c, [0, 0, -0.12]), 0.13, 0.72);
      kushPyramid(G(c, [-0.33, 0, -0.08]), 0.09, 0.46);
      kushPyramid(G(c, [0.32, 0, -0.1]), 0.1, 0.5);
      kushPyramid(G(c, [-0.18, 0, 0.18]), 0.065, 0.32);
      kushPyramid(G(c, [0.2, 0, 0.2]), 0.07, 0.34);
      A(c, bx(1.0, 0.03, 0.02), [0, 0, 0.38]); // enclosure wall
      break;
    case 'walls':
      A(c, tb(0.9, 0.22, 0.1, 0.12), [0, 0, 0]);
      for (const x of [-0.42, -0.14, 0.14, 0.42]) {
        A(c, cy(0.06, 0.075, 0.27, 10), [x, 0, 0.05]); // rounded bastions
        A(c, torus(0.062, 0.008, PI * 2, 12), [x, 0.27, 0.05], [PI / 2, 0, 0], false);
      }
      break;
    case 'gate':
      kushPylon(c, 0.13, 0.17, 0.4, 0.12);
      for (const sx of [-1, 1]) A(c, tb(0.24, 0.2, 0.08, 0.1), [sx * 0.36, 0, 0]);
      break;
    case 'tower':
      A(c, cy(0.11, 0.15, 0.46, 12), [0, 0, 0]);
      A(c, ring(0.125, 0.1, 0.05, 0, 14), [0, 0.46, 0]);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; A(c, bx(0.03, 0.03, 0.03), [Math.cos(a) * 0.112, 0.51, Math.sin(a) * 0.112], [0, -a, 0], false); }
      door(c, 0, 0.145, 0.06, 0.13);
      A(c, bx(0.02, 0.04, 0.012), [0, 0.3, 0.125], [0, 0, 0], false);
      break;
    case 'palisade':
      for (let i = 0; i < 13; i++) {
        const a = -PI * 0.9 + (i / 12) * PI * 0.8, x = Math.cos(a) * 0.42, z = -Math.sin(a) * 0.26;
        A(c, cy(0.01, 0.014, 0.17 + (i % 3) * 0.02, 5), [x, 0, z], [0, 0, (c.r() - 0.5) * 0.15], false);
      }
      { // thorn hedge zig-zag on top of the stakes
        const pts: V3[] = [];
        for (let i = 0; i <= 24; i++) { const a = -PI * 0.9 + (i / 24) * PI * 0.8; pts.push([Math.cos(a) * 0.42, 0.13 + (i % 2) * 0.06, -Math.sin(a) * 0.26]); }
        L(c, pts);
      }
      A(c, bx(0.03, 0.22, 0.03), [-0.07, 0, 0.27]); A(c, bx(0.03, 0.22, 0.03), [0.07, 0, 0.27]);
      kushHut(G(c, [0, 0, -0.02]), 0.85);
      break;
    case 'granary':
      A(c, bx(0.62, 0.05, 0.3), [0, 0, 0]);
      for (const x of [-0.2, 0, 0.2]) { A(c, cy(0.085, 0.09, 0.2, 12), [x, 0.05, 0]); A(c, dome(0.085, 12), [x, 0.25, 0]); A(c, bx(0.03, 0.04, 0.01), [x, 0.18, 0.088], [0, 0, 0], false); }
      L(c, [[0.3, 0.05, 0.12], [0.24, 0.26, 0.06]]);
      break;
    case 'farm':
      water(c, 0.9, 0.1, [0, 0, 0.26]);
      field(c, -0.24, 0.05, 0.36, 0.26, 4); field(c, 0.2, 0.02, 0.4, 0.2, 3);
      field(c, -0.05, -0.2, 0.6, 0.16, 3);
      shaduf(c, 0.36, 0.2);
      palm(c, -0.42, 0.14, 0.32); palm(c, 0.42, -0.14, 0.28);
      break;
    case 'market':
      A(c, tb(0.7, 0.16, 0.05, 0.05), [0, 0, -0.2]);
      for (const x of [-0.22, 0.02, 0.24]) {
        for (const dx of [-0.08, 0.08]) L(c, [[x + dx, 0, 0.1], [x + dx, 0.17, 0.1]]);
        A(c, new THREE.PlaneGeometry(0.2, 0.18).rotateX(-PI / 2 + 0.25), [x, 0.18, 0.02]);
        A(c, sph(0.03, 7, 5), [x - 0.03, 0.03, 0.05], [0, 0, 0], false); // pots
        A(c, sph(0.025, 7, 5), [x + 0.035, 0.025, 0.06], [0, 0, 0], false);
      }
      kushHut(G(c, [-0.4, 0, -0.08]), 0.6);
      break;
    case 'harbor':
      water(c, 0.95, 0.24, [0, 0, 0.18], 3);
      for (let i = 0; i < 4; i++) A(c, bx(0.36, 0.03, 0.05), [-0.16, i * 0.03, -0.02 - i * 0.05]);
      hull(c, [0.18, 0, 0.18], 0, 0.8, 'river');
      for (const x of [-0.32, 0.02]) L(c, [[x, 0, 0.06], [x, 0.09, 0.06]]);
      kushHouse(G(c, [0.3, 0, -0.18], 0, 0.55));
      break;
    case 'workshop':
      kushHouse(G(c, [-0.14, 0, -0.06], 0, 0.85));
      { const g = G(c, [0.24, 0, 0.06]); A(g, cy(0.05, 0.085, 0.2, 10), [0, 0, 0]); A(g, torus(0.05, 0.01, PI * 2, 12), [0, 0.2, 0], [PI / 2, 0, 0], false); }
      A(c, heap(0.12, 1.2, 0.5), [0.3, 0, -0.2]);
      break;
    case 'road':
      A(c, bx(0.9, 0.015, 0.16), [0, 0, 0.06]);
      for (let i = 0; i < 4; i++) for (const z of [-0.06, 0.18]) A(c, tb(0.05, 0.12, 0.05, 0.15), [-0.36 + i * 0.24, 0, z]);
      kushPylon(G(c, [0.44, 0, 0.06], -PI / 2, 0.45));
      break;
    case 'palace':
      A(c, tb(0.62, 0.12, 0.46, 0.04), [0, 0, -0.04]);
      A(c, tb(0.46, 0.18, 0.3, 0.05), [0, 0.12, -0.08]);
      for (let i = 0; i < 5; i++) A(c, cy(0.016, 0.018, 0.14, 8), [-0.2 + i * 0.1, 0.12, 0.1]);
      A(c, bx(0.48, 0.02, 0.06), [0, 0.26, 0.1]);
      A(c, stairs(5, 0.025, 0.024, 0.14), [0, 0, 0.19]);
      door(c, 0, 0.075, 0.07, 0.12, 0.12);
      break;
    case 'furnace': kushFurnaces(c); break;
    case 'canal':
      water(c, 0.95, 0.12, [0, 0, 0.04], 2);
      A(c, bx(0.95, 0.03, 0.03), [0, 0, 0.115]); A(c, bx(0.95, 0.03, 0.03), [0, 0, -0.035]);
      field(c, -0.2, -0.2, 0.42, 0.2, 3);
      shaduf(c, 0.25, -0.08); shaduf(c, -0.3, 0.17);
      palm(c, 0.4, -0.22, 0.3);
      break;
    case 'quarry':
      A(c, tb(0.62, 0.14, 0.34, 0.05), [0, 0, -0.08]);
      A(c, tb(0.42, 0.12, 0.24, 0.06), [-0.08, 0.14, -0.12]);
      A(c, tb(0.22, 0.1, 0.16, 0.06), [-0.12, 0.26, -0.14]);
      for (const [x, z] of [[0.2, 0.18], [0.32, 0.12], [0.26, 0.24]] as P2[]) A(c, bx(0.08, 0.05, 0.05), [x, 0, z]);
      L(c, [[0.06, 0.004, 0.22], [0.2, 0.004, 0.22]]); // sledge track
      break;
  }
}

function kushBespoke(c: C, id: string): boolean {
  switch (id) {
    case 'kush_cattle': {
      const pts: V3[] = [];
      for (let i = 0; i <= 20; i++) { const a = (i / 20) * PI * 2; pts.push([0.1 + Math.cos(a) * 0.3, 0.07, 0.04 + Math.sin(a) * 0.2]); }
      L(c, pts);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; const x = 0.1 + Math.cos(a) * 0.3, z = 0.04 + Math.sin(a) * 0.2; L(c, [[x, 0, z], [x, 0.09, z]]); }
      cow(c, [0.02, 0, 0.06], 0.3); cow(c, [0.2, 0, -0.02], -0.5); cow(c, [0.16, 0, 0.14], 2.6);
      kushHut(G(c, [-0.36, 0, -0.08]), 0.85);
      kushHut(G(c, [-0.3, 0, 0.2]), 0.65);
      return true;
    }
    case 'kush_deffufa': {
      // the Western Deffufa: a towering solid mudbrick temple block with an external stair
      A(c, tb(0.6, 0.46, 0.38, 0.08), [0, 0, -0.04]);
      A(c, tb(0.24, 0.1, 0.18, 0.08), [0.08, 0.46, -0.06]); // summit chamber
      for (let i = 0; i < 5; i++) A(c, bx(0.035, 0.42, 0.02), [-0.24 + i * 0.12, 0, 0.15], [0, 0, 0], false); // pilasters
      A(c, stairs(8, 0.04, 0.05, 0.08), [-0.34, 0, -0.1], [0, -PI / 2, 0]); // external stair up the side
      A(c, bx(0.08, 0.4, 0.1), [-0.34, 0, -0.1], [0, 0, 0], false);
      door(c, 0.06, 0.15, 0.07, 0.15);
      kushHut(G(c, [0.42, 0, 0.18]), 0.55);
      A(c, bx(0.9, 0.03, 0.025), [0, 0, 0.3]); // enclosure
      return true;
    }
    case 'kush_furnace': kushFurnaces(c); return true;
    case 'kush_apedemak': {
      // Lion Temple at Naqa: a pylon-fronted single chamber; a seated lion statue on a plinth
      kushPylon(G(c, [0, 0, 0.04]), 0.1, 0.17, 0.42, 0.1);
      A(c, bx(0.3, 0.26, 0.28), [0, 0, -0.18]);
      A(c, bx(0.32, 0.02, 0.3), [0, 0.26, -0.18], [0, 0, 0], false);
      const lion = G(c, [0.3, 0, 0.22], -0.35, 1.5);
      A(lion, bx(0.12, 0.06, 0.12), [0, 0, 0]); // plinth
      A(lion, tb(0.07, 0.07, 0.08, 0.2), [0, 0.06, -0.015]); // haunches
      A(lion, bx(0.06, 0.08, 0.025), [0, 0.06, 0.03], [0, 0, 0], false); // forelegs
      A(lion, sph(0.035, 8, 6), [0, 0.15, 0.02]); // head
      A(lion, torus(0.03, 0.01, PI * 2, 10), [0, 0.145, 0.015], [0, 0, 0], false); // mane
      return true;
    }
    case 'kush_pyramid': kushPiece(c, 'wonder'); return true;
  }
  return false;
}

// ============================================================ AKSUM: stone, recessed bands, monkey heads, stelae

function aksHouse(c: C, w = 0.34, d = 0.26, n = 2, hs = 0.15, beams = true) {
  A(c, bx(w + 0.08, 0.04, d + 0.08), [0, 0, 0]); // stepped platform
  A(c, bx(w + 0.04, 0.03, d + 0.04), [0, 0.04, 0], [0, 0, 0], false);
  let y = 0.07;
  for (let i = 0; i < n; i++) {
    A(c, bx(w, hs, d), [0, y, 0]);
    y += hs;
    A(c, bx(w - 0.03, 0.026, d - 0.03), [0, y, 0], [0, 0, 0], false); // recessed band
    if (beams) monkeyHeads(c, -w / 2 + 0.04, w / 2 - 0.04, y + 0.013, d / 2 - 0.01, Math.max(3, Math.round(w / 0.08)));
    y += 0.026;
    if (i > 0 || n === 1) A(c, bx(0.05, 0.06, 0.01), [w * 0.22, y - hs - 0.026 + 0.05, d / 2 + 0.002], [0, 0, 0], false); // window
  }
  A(c, bx(w + 0.01, 0.02, d + 0.01), [0, y, 0]); // roof slab
  door(c, -w * 0.12, d / 2 + 0.002, 0.065, 0.12, 0.07);
  return y + 0.02;
}
function tukul(c: C, s = 1) { // round stone house with conical thatch
  A(c, cy(0.1 * s, 0.105 * s, 0.13 * s, 10), [0, 0, 0]);
  A(c, cn(0.14 * s, 0.15 * s, 10), [0, 0.13 * s, 0]);
  A(c, bx(0.045 * s, 0.09 * s, 0.01), [0, 0, 0.103 * s], [0, 0, 0], false);
}
function aksStele(c: C, h: number, w: number, storeys: number, detail = true) {
  const d = w * 0.42;
  A(c, bx(w * 2.4, 0.03, w * 2), [0, 0, 0]);
  A(c, bx(w * 1.7, 0.03, w * 1.4), [0, 0.03, 0], [0, 0, 0], false);
  const y0 = 0.06, sh = h - y0 - w / 2;
  A(c, tb(w, sh, d, 0.1), [0, y0, 0]);
  A(c, hdisc(w * 0.45, d * 0.9), [0, y0 + sh, 0]); // rounded head
  const doorH = sh * 0.16;
  A(c, bx(w * 0.34, doorH, 0.006), [0, y0 + 0.01, d / 2], [0, 0, 0], false); // carved false door
  const st = (sh - doorH - 0.04) / storeys;
  for (let i = 0; i < storeys; i++) {
    const y = y0 + doorH + 0.03 + i * st, k = 1 - (0.1 * (y - y0)) / sh;
    A(c, bx(w * k + 0.006, 0.008, d * k + 0.006), [0, y, 0], [0, 0, 0], false); // storey band (beam row)
    if (detail) for (const sx of [-1, 1]) A(c, bx(w * k * 0.26, st * 0.42, 0.005), [sx * w * k * 0.2, y + st * 0.3, (d * k) / 2], [0, 0, 0], detail && i % 2 === 0);
  }
  A(c, bx(w * 1.1, 0.012, w * 0.5), [0, 0.06, d / 2 + w * 0.3], [0, 0, 0], false); // base plate
}

function aksumPiece(c: C, piece: ArchPiece) {
  switch (piece) {
    case 'house': aksHouse(c, 0.32, 0.24, 2); tukul(G(c, [0.32, 0, 0.1]), 0.75); break;
    case 'hall': aksHouse(c, 0.6, 0.28, 2, 0.13); break;
    case 'temple': {
      for (let i = 0; i < 3; i++) A(c, bx(0.64 - i * 0.08, 0.05, 0.5 - i * 0.07), [0, i * 0.05, -0.04 + i * 0.01]);
      A(c, stairs(4, 0.03, 0.037, 0.16), [0, 0, 0.24 - 0.12]);
      const g = G(c, [0, 0.08, -0.04]);
      aksHouse(g, 0.36, 0.26, 2, 0.14);
      for (const sx of [-1, 1]) A(c, bx(0.06, 0.3, 0.3), [sx * 0.21, 0.15, -0.04]); // projecting corners
      break;
    }
    case 'monument': aksStele(c, 0.95, 0.15, 7); break;
    case 'wonder': {
      aksStele(G(c, [0, 0, -0.12]), 1.0, 0.13, 8);
      aksStele(G(c, [-0.3, 0, -0.06]), 0.66, 0.1, 5, false);
      aksStele(G(c, [0.3, 0, -0.1]), 0.72, 0.1, 5, false);
      aksStele(G(c, [-0.16, 0, 0.18]), 0.42, 0.08, 3, false);
      aksStele(G(c, [0.18, 0, 0.2]), 0.36, 0.075, 2, false);
      // a fallen stele
      A(c, bx(0.5, 0.05, 0.07), [0.12, 0, 0.36], [0, 0.15, 0]);
      break;
    }
    case 'walls':
      A(c, bx(0.8, 0.12, 0.12), [0, 0, 0]);
      A(c, bx(0.77, 0.02, 0.1), [0, 0.12, 0], [0, 0, 0], false);
      monkeyHeads(c, -0.34, 0.34, 0.13, 0.05, 8);
      A(c, bx(0.8, 0.09, 0.12), [0, 0.14, 0]);
      for (const sx of [-1, 1]) aksHouse(G(c, [sx * 0.42, 0, 0], 0, 0.5), 0.3, 0.3, 3, 0.15);
      break;
    case 'gate':
      for (const sx of [-1, 1]) aksHouse(G(c, [sx * 0.2, 0, 0], 0, 0.7), 0.26, 0.26, 3, 0.14, true);
      A(c, bx(0.2, 0.04, 0.12), [0, 0.24, 0]); // timber lintel
      monkeyHeads(c, -0.08, 0.08, 0.26, 0.065, 3);
      break;
    case 'tower': aksHouse(c, 0.24, 0.22, 4, 0.13); break;
    case 'palisade':
      A(c, plan([[-0.42, 0], [-0.3, -0.18], [0, -0.24], [0.3, -0.18], [0.42, 0], [0.4, 0.02], [0.28, -0.15], [0, -0.21], [-0.28, -0.15], [-0.4, 0.02]], 0.08), [0, 0, 0.1]);
      for (let i = 0; i < 9; i++) { const a = PI * 0.15 + (i / 8) * PI * 0.7; L(c, [[Math.cos(a) * 0.36, 0.08, 0.1 - Math.sin(a) * 0.2], [Math.cos(a) * 0.36, 0.2, 0.1 - Math.sin(a) * 0.2]]); }
      tukul(G(c, [0, 0, -0.02]), 0.8);
      break;
    case 'granary':
      A(c, bx(0.62, 0.06, 0.3), [0, 0, 0]);
      for (const x of [-0.2, 0.02]) { A(c, cy(0.08, 0.08, 0.14, 10), [x, 0.06, 0]); A(c, cn(0.11, 0.12, 10), [x, 0.2, 0]); }
      aksHouse(G(c, [0.27, 0, -0.02], 0, 0.5), 0.26, 0.3, 1, 0.16);
      break;
    case 'farm':
      for (let i = 0; i < 3; i++) field(c, 0, 0.18 - i * 0.16, 0.86 - i * 0.06, 0.15, 3, i * 0.06);
      for (let i = 0; i < 3; i++) A(c, bx(0.86 - i * 0.06, i * 0.06 + 0.06, 0.02), [0, 0, 0.26 - i * 0.16], [0, 0, 0], false); // terrace risers
      for (const x of [-0.34, -0.24, 0.32]) A(c, cn(0.04, 0.1, 7), [x, 0.12, -0.14], [0, 0, 0], false); // grain stacks
      { const ox = G(c, [0.18, 0.0, 0.18]); A(ox, bx(0.1, 0.05, 0.045), [0, 0.05, 0]); A(ox, bx(0.035, 0.03, 0.03), [0.065, 0.075, 0], [0, 0, 0], false); L(ox, [[0.08, 0.11, -0.04], [0.08, 0.11, 0.04]]); L(ox, [[0.08, 0.1, 0], [0.22, 0.02, 0]]); }
      break;
    case 'market':
      aksHouse(G(c, [0, 0, -0.16], 0, 0.75), 0.5, 0.22, 1, 0.16);
      for (const x of [-0.28, 0, 0.28]) {
        A(c, bx(0.16, 0.05, 0.1), [x, 0, 0.14]);
        for (let k = 0; k < 2; k++) A(c, cy(0.012, 0.022, 0.07, 6), [x - 0.03 + k * 0.06, 0.05, 0.14], [0, 0, 0], false); // amphorae
        A(c, new THREE.PlaneGeometry(0.2, 0.14).rotateX(-PI / 2 + 0.2), [x, 0.2, 0.14], [0, 0, 0], false);
        L(c, [[x - 0.09, 0, 0.2], [x - 0.09, 0.2, 0.2]]); L(c, [[x + 0.09, 0, 0.2], [x + 0.09, 0.2, 0.2]]);
      }
      break;
    case 'harbor':
      water(c, 1.0, 0.26, [0, 0, 0.22], 3);
      A(c, bx(0.62, 0.06, 0.14), [-0.16, 0, 0.0]); // stone quay
      A(c, stairs(3, 0.02, 0.02, 0.1), [0.18, 0, 0.0], [0, -PI / 2, 0]);
      aksHouse(G(c, [-0.24, 0, -0.2], 0, 0.6), 0.36, 0.22, 1, 0.16);
      hull(c, [0.2, 0, 0.24], 0, 0.85, 'plank');
      for (let i = 0; i < 3; i++) A(c, cy(0.014, 0.024, 0.08, 6), [-0.36 + i * 0.07, 0.06, 0.03], [0, 0, 0], false);
      break;
    case 'workshop':
      aksHouse(G(c, [-0.14, 0, -0.04], 0, 0.85), 0.3, 0.24, 1, 0.16);
      A(c, cy(0.07, 0.09, 0.08, 10), [0.24, 0, 0.06]); A(c, dome(0.07, 10), [0.24, 0.08, 0.06]);
      A(c, cy(0.018, 0.018, 0.1, 6), [0.24, 0.13, 0.06], [0, 0, 0], false);
      A(c, bx(0.06, 0.04, 0.04), [0.1, 0, 0.18]);
      break;
    case 'road':
      A(c, bx(0.9, 0.015, 0.16), [0, 0, 0.04]);
      for (let i = 0; i < 6; i++) L(c, [[-0.45 + i * 0.18, 0.017, -0.04], [-0.45 + i * 0.18, 0.017, 0.12]]);
      for (const x of [-0.36, 0.36]) aksStele(G(c, [x, 0, -0.12]), 0.3, 0.06, 2, false);
      break;
    case 'palace': {
      // after Dungur / Ta'akha Maryam: a central keep on a stepped podium with corner towers
      A(c, bx(0.8, 0.05, 0.58), [0, 0, -0.04]);
      A(c, bx(0.74, 0.04, 0.52), [0, 0.05, -0.04], [0, 0, 0], false);
      A(c, stairs(4, 0.025, 0.022, 0.18), [0, 0, 0.25 - 0.1]);
      aksHouse(G(c, [0, 0.09, -0.08]), 0.32, 0.24, 3, 0.13);
      for (const [x, z] of [[-0.3, -0.24], [0.3, -0.24], [-0.3, 0.14], [0.3, 0.14]] as P2[]) {
        A(c, bx(0.12, 0.18, 0.12), [x, 0.09, z]);
        A(c, bx(0.1, 0.02, 0.1), [x, 0.27, z], [0, 0, 0], false);
        A(c, bx(0.12, 0.06, 0.12), [x, 0.29, z]);
      }
      break;
    }
    case 'furnace':
      A(c, bx(0.5, 0.04, 0.3), [0, 0, 0]);
      A(c, cy(0.09, 0.11, 0.14, 10), [-0.1, 0.04, 0]); A(c, dome(0.09, 10), [-0.1, 0.18, 0]);
      A(c, cy(0.025, 0.03, 0.16, 6), [-0.1, 0.25, 0]);
      A(c, bx(0.08, 0.06, 0.05), [0.12, 0.04, 0.04]); // anvil block
      A(c, bx(0.1, 0.04, 0.08), [0.14, 0.04, -0.08], [0, 0, 0], false); // bellows
      aksHouse(G(c, [0.32, 0, -0.06], 0, 0.45), 0.3, 0.3, 1, 0.16);
      break;
    case 'canal':
      // a stepped stone reservoir (cf. Mai Shum)
      for (let i = 0; i < 3; i++) A(c, ring(0.42 - i * 0.07, 0.38 - i * 0.07, 0.04, 0, 4).rotateY(PI / 4).scale(1, 1, 0.62), [0, -i * 0.0 + (2 - i) * 0.025, 0]);
      water(c, 0.32, 0.2, [0, 0, 0], 2);
      A(c, stairs(3, 0.03, 0.025, 0.1), [0, 0, 0.2]);
      break;
    case 'quarry':
      A(c, tb(0.6, 0.18, 0.3, 0.12), [0, 0, -0.12]);
      A(c, tb(0.34, 0.12, 0.2, 0.12), [-0.1, 0.18, -0.14]);
      A(c, bx(0.62, 0.06, 0.09), [0.04, 0.03, 0.16]); // stele blank on rollers
      for (const x of [-0.18, 0.08, 0.3]) A(c, cyl(0.016, 0.016, 0.14, 6), [x, 0.016, 0.16], [PI / 2, 0, 0], false);
      break;
  }
}

function aksumBespoke(c: C, id: string): boolean {
  switch (id) {
    case 'aksum_fields': aksumPiece(c, 'farm'); return true;
    case 'aksum_adulis': aksumPiece(c, 'harbor'); return true;
    case 'aksum_stele': aksStele(c, 0.98, 0.16, 7); return true;
    case 'aksum_stelae': aksumPiece(c, 'wonder'); return true;
  }
  return false;
}

// ============================================================ CARTHAGE: whitewashed storeys, Punic cornice, cothon

function carthHouse(c: C, w = 0.22, d = 0.2, n = 2, roof = true) {
  const hs = 0.12, h = n * hs;
  A(c, bx(w, h, d), [0, 0, 0]);
  A(c, bx(w + 0.014, 0.014, d + 0.014), [0, h, 0], [0, 0, 0], false); // cornice lip
  for (let i = 1; i < n; i++) {
    A(c, bx(w + 0.006, 0.006, d + 0.006), [0, i * hs, 0], [0, 0, 0], false);
    for (const sx of [-1, 1]) A(c, bx(0.03, 0.04, 0.008), [sx * w * 0.24, i * hs + 0.035, d / 2], [0, 0, 0], false);
  }
  door(c, -w * 0.18, d / 2 + 0.002, 0.05, 0.1);
  if (roof) A(c, bx(w * 0.36, 0.06, d * 0.36), [w * 0.24, h, -d * 0.2]); // stair house on the roof terrace
}
function punicTemple(c: C, w = 0.5, d = 0.36, cols = 5) {
  A(c, bx(w + 0.06, 0.08, d + 0.06), [0, 0, 0]); // podium
  A(c, stairs(3, 0.025, 0.027, w * 0.5), [0, 0, (d + 0.06) / 2 + 0.075]);
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + 0.04 + ((w - 0.08) * i) / (cols - 1);
    A(c, cy(0.02, 0.023, 0.24, 8), [x, 0.08, d / 2 - 0.04]);
    A(c, bx(0.05, 0.016, 0.05), [x, 0.32, d / 2 - 0.04], [0, 0, 0], false); // capitals
  }
  A(c, bx(w - 0.1, 0.24, d * 0.55), [0, 0.08, -d * 0.18]); // cella
  A(c, tb(w + 0.02, 0.05, d + 0.02, -0.08), [0, 0.335, 0]); // flared Egyptianising gorge cornice
  A(c, bx(w + 0.06, 0.02, d + 0.06), [0, 0.385, 0]);
}
function carthTower(c: C, w = 0.16, h = 0.42) {
  A(c, bx(w, h, w), [0, 0, 0]);
  A(c, bx(w + 0.016, 0.016, w + 0.016), [0, h, 0], [0, 0, 0], false);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; A(c, bx(0.03, 0.035, 0.03), [Math.cos(a) * w * 0.4, h + 0.016, Math.sin(a) * w * 0.4], [0, 0, 0], false); }
  for (let k = 1; k <= 2; k++) A(c, bx(0.025, 0.05, 0.008), [0, h * (k / 3) + 0.03, w / 2], [0, 0, 0], false);
}
function cothon(c: C) {
  water(c, 0.82, 0.62, [0, 0, -0.02], 0);
  A(c, ring(0.42, 0.36, 0.05, 0.5, 30), [0, 0, -0.02]); // circular quay with a channel to the sea
  A(c, cy(0.15, 0.16, 0.04, 18), [0, 0, -0.02]); // central island
  A(c, cy(0.04, 0.05, 0.26, 10), [0, 0.04, -0.02]); // admiral's pavilion
  A(c, cy(0.05, 0.05, 0.016, 10), [0, 0.3, -0.02], [0, 0, 0], false);
  const sheds = G(c, [0, 0.04, -0.02]); // ship sheds radiating round the island
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2, x = Math.sin(a) * 0.105, z = Math.cos(a) * 0.105;
    A(sheds, gableX(0.025, 0.035, 0.08).rotateY(PI / 2), [x, 0, z], [0, a, 0], i % 3 === 0);
  }
  const outer = G(c, [0, 0.05, -0.02]);
  for (let i = 0; i < 9; i++) {
    const a = 0.45 + (i / 8) * (PI * 2 - 0.9), x = Math.sin(a) * 0.39, z = Math.cos(a) * 0.39;
    A(outer, bx(0.045, 0.03, 0.05), [x, 0, z], [0, a, 0], false);
  }
  hull(c, [-0.17, 0, 0.18], 0.5, 0.42, 'plank', false);
  hull(c, [0.16, 0, 0.36], -0.2, 0.5, 'plank', true);
}

function carthPiece(c: C, piece: ArchPiece) {
  switch (piece) {
    case 'house':
      carthHouse(c, 0.22, 0.2, 3);
      carthHouse(G(c, [0.23, 0, 0.04]), 0.18, 0.18, 2);
      carthHouse(G(c, [-0.22, 0, 0.06]), 0.16, 0.16, 2, false);
      break;
    case 'hall':
      A(c, bx(0.56, 0.2, 0.26), [0, 0, -0.04]);
      A(c, tb(0.58, 0.04, 0.28, -0.08), [0, 0.2, -0.04]);
      for (let i = 0; i < 4; i++) door(c, -0.21 + i * 0.14, 0.092, 0.06, 0.12);
      for (let i = 0; i < 3; i++) A(c, cy(0.014, 0.024, 0.08, 6), [-0.2 + i * 0.06, 0, 0.18], [0, 0, 0], false);
      break;
    case 'temple': punicTemple(c); break;
    case 'monument': {
      // a tiered Libyco-Punic tower tomb crowned by a pyramid (cf. Dougga)
      A(c, bx(0.32, 0.05, 0.32), [0, 0, 0]);
      A(c, bx(0.24, 0.2, 0.24), [0, 0.05, 0]);
      A(c, tb(0.28, 0.04, 0.28, -0.1), [0, 0.25, 0]);
      for (const sx of [-1, 1]) A(c, cy(0.014, 0.016, 0.16, 6), [sx * 0.08, 0.29, 0.1]);
      A(c, bx(0.2, 0.16, 0.2), [0, 0.29, -0.01]);
      A(c, tb(0.24, 0.04, 0.24, -0.1), [0, 0.45, 0]);
      A(c, pr(0.11, 0.24), [0, 0.49, 0]);
      door(c, 0, 0.122, 0.05, 0.09, 0.08);
      break;
    }
    case 'wonder': cothon(c); break;
    case 'walls':
      A(c, wallG(0.8, 0.28, 0.1, { cren: 'plain', n: 7, mh: 0.035 }), [0, 0, 0]);
      for (const sx of [-1, 1]) carthTower(G(c, [sx * 0.42, 0, 0.02]), 0.16, 0.42);
      A(c, bx(0.8, 0.04, 0.02), [0, 0, 0.12], [0, 0, 0], false); // outer bank
      break;
    case 'gate':
      A(c, wallG(0.3, 0.3, 0.12, { open: archOpen(0.12, 0.22), cren: 'plain', n: 3, mh: 0.035 }), [0, 0, 0]);
      for (const sx of [-1, 1]) carthTower(G(c, [sx * 0.23, 0, 0.01]), 0.17, 0.44);
      for (const sx of [-1, 1]) A(c, wallG(0.18, 0.24, 0.09), [sx * 0.41, 0, -0.02]);
      break;
    case 'tower': carthTower(c, 0.22, 0.56); door(c, 0, 0.112, 0.06, 0.12); break;
    case 'palisade':
      A(c, plan([[-0.44, 0.06], [0.44, 0.06], [0.44, 0.12], [-0.44, 0.12]], 0.035), [0, 0, 0]);
      for (let i = 0; i < 14; i++) { const x = -0.4 + i * 0.0615; A(c, cy(0.014, 0.014, 0.2, 5), [x, 0.035, 0.07], [0, 0, 0], false); A(c, cn(0.016, 0.03, 5), [x, 0.235, 0.07], [0, 0, 0], false); }
      { const t = G(c, [0, 0, -0.04]); A(t, bx(0.13, 0.3, 0.13), [0, 0, 0]); A(t, bx(0.17, 0.02, 0.17), [0, 0.3, 0], [0, 0, 0], false); }
      carthHouse(G(c, [-0.28, 0, -0.18]), 0.18, 0.16, 1);
      break;
    case 'granary':
      A(c, bx(0.54, 0.22, 0.24), [0, 0, -0.06]);
      A(c, tb(0.56, 0.035, 0.26, -0.08), [0, 0.22, -0.06]);
      for (let i = 0; i < 3; i++) door(c, -0.18 + i * 0.18, 0.062, 0.07, 0.13);
      for (let i = 0; i < 6; i++) A(c, cy(0.013, 0.022, 0.08, 6), [-0.26 + (i % 3) * 0.05, (i >= 3 ? 0.04 : 0), 0.16 - (i >= 3 ? 0.03 : 0)], [0, 0, i >= 3 ? 0.4 : 0], false);
      break;
    case 'farm': {
      field(c, 0.1, 0.0, 0.7, 0.5, 0);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tree(c, -0.1 + i * 0.14, -0.16 + j * 0.13, 0.9); // olive grove
      for (let i = 0; i < 4; i++) L(c, [[0.24, 0.03, -0.2 + i * 0.1], [0.42, 0.03, -0.2 + i * 0.1]]); // vine rows
      carthHouse(G(c, [-0.36, 0, -0.06]), 0.2, 0.22, 2);
      A(c, bx(0.08, 0.06, 0.08), [-0.34, 0, 0.16]); // olive press
      A(c, cyl(0.03, 0.03, 0.02, 10), [-0.34, 0.07, 0.16], [0, 0, 0], false);
      break;
    }
    case 'market':
      A(c, bx(0.7, 0.04, 0.22), [0, 0, -0.08]);
      for (let i = 0; i < 6; i++) A(c, cy(0.016, 0.018, 0.2, 8), [-0.3 + i * 0.12, 0.04, 0.0]);
      A(c, bx(0.68, 0.18, 0.06), [0, 0.04, -0.16]);
      A(c, tb(0.72, 0.04, 0.24, -0.06), [0, 0.24, -0.08]);
      for (let i = 0; i < 5; i++) A(c, cy(0.013, 0.022, 0.08, 6), [-0.2 + i * 0.1, 0, 0.16], [0, 0, (i % 2) * 0.3], false);
      break;
    case 'harbor':
      water(c, 0.95, 0.4, [0, 0, 0.1], 3);
      A(c, plan([[-0.45, -0.12], [0.45, -0.12], [0.45, 0.3], [0.38, 0.3], [0.38, -0.05], [-0.38, -0.05], [-0.38, 0.3], [-0.45, 0.3]], 0.05), [0, 0, 0]);
      hull(c, [0.04, 0, 0.12], 0, 0.75);
      A(c, bx(0.5, 0.16, 0.12), [-0.1, 0, -0.22]);
      A(c, tb(0.52, 0.03, 0.14, -0.08), [-0.1, 0.16, -0.22]);
      carthHouse(G(c, [0.3, 0, -0.24]), 0.16, 0.14, 2);
      break;
    case 'workshop': carthDye(c); break;
    case 'road': {
      for (let i = 0; i < 6; i++) A(c, bx(0.16, 0.025 + i * 0.025, 0.08), [0, 0, 0.24 - i * 0.08], [0, 0, 0], i % 2 === 0);
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) carthHouse(G(c, [sx * 0.2, 0.04 + k * 0.08, 0.12 - k * 0.2], -sx * PI / 2), 0.18, 0.16, 2 + k, k === 1);
      break;
    }
    case 'palace':
      carthHouse(G(c, [0, 0, -0.14]), 0.5, 0.22, 3);
      A(c, bx(0.5, 0.03, 0.22), [0, 0, 0.12]);
      for (let i = 0; i < 6; i++) A(c, cy(0.014, 0.016, 0.14, 8), [-0.22 + (i % 3) * 0.22, 0.03, i < 3 ? 0.03 : 0.21]); // peristyle
      A(c, bx(0.5, 0.018, 0.2), [0, 0.17, 0.12], [0, 0, 0], false);
      break;
    case 'furnace':
      A(c, cy(0.09, 0.12, 0.16, 10), [-0.1, 0, 0]); A(c, dome(0.09, 10), [-0.1, 0.16, 0]);
      A(c, cy(0.02, 0.025, 0.16, 6), [-0.1, 0.22, 0]);
      carthHouse(G(c, [0.2, 0, -0.06]), 0.22, 0.2, 2);
      A(c, bx(0.06, 0.05, 0.05), [0.08, 0, 0.16]);
      break;
    case 'canal':
      water(c, 0.95, 0.14, [0, 0, 0.04], 2);
      A(c, bx(0.95, 0.04, 0.05), [0, 0, 0.14]); A(c, bx(0.95, 0.04, 0.05), [0, 0, -0.06]);
      A(c, plan([[-0.06, -0.08], [0.06, -0.08], [0.06, 0.16], [-0.06, 0.16]], 0.025), [0, 0.045, 0]); // bridge deck
      carthHouse(G(c, [-0.3, 0, -0.2]), 0.18, 0.14, 2); carthHouse(G(c, [0.3, 0, -0.2]), 0.16, 0.14, 1);
      break;
    case 'quarry':
      water(c, 0.95, 0.2, [0, 0, 0.26], 2);
      A(c, tb(0.7, 0.22, 0.34, 0.1), [0, 0, -0.08]);
      A(c, bx(0.18, 0.12, 0.2), [-0.12, 0.22, -0.1]);
      A(c, bx(0.18, 0.06, 0.2), [0.12, 0.22, -0.1]);
      for (const [x, z] of [[0.2, 0.12], [0.3, 0.1], [-0.3, 0.12]] as P2[]) A(c, bx(0.07, 0.05, 0.05), [x, 0, z]);
      break;
  }
}
function carthDye(c: C) {
  A(c, bx(0.6, 0.03, 0.34), [0, 0, 0]);
  for (const [x, z] of [[-0.18, 0.08], [0, 0.1], [0.18, 0.08], [-0.09, -0.06], [0.09, -0.06]] as P2[]) {
    A(c, ring(0.06, 0.05, 0.06, 0, 12), [x, 0.03, z]); // dye vats
    A(c, cy(0.05, 0.05, 0.004, 12), [x, 0.07, z], [0, 0, 0], false);
  }
  for (const x of [-0.24, 0.24]) L(c, [[x, 0, -0.18], [x, 0.24, -0.18]]);
  L(c, [[-0.24, 0.24, -0.18], [0.24, 0.24, -0.18]]);
  for (let i = 0; i < 3; i++) A(c, new THREE.PlaneGeometry(0.1, 0.14), [-0.15 + i * 0.15, 0.17, -0.18], [0, 0, 0], true); // drying cloth
  A(c, heap(0.09, 1.4, 0.5), [0.36, 0, 0.12], [0, 0, 0], false); // murex shell heap
  carthHouse(G(c, [-0.38, 0, -0.08]), 0.16, 0.18, 2);
}

function carthBespoke(c: C, id: string): boolean {
  switch (id) {
    case 'carth_post':
      water(c, 0.95, 0.24, [0, 0, 0.24], 3);
      A(c, bx(0.4, 0.05, 0.12), [-0.1, 0, 0.1]); // small quay
      hull(c, [0.22, 0, 0.24], 0, 0.75);
      A(c, bx(0.3, 0.14, 0.14), [-0.12, 0, -0.1]); A(c, tb(0.32, 0.03, 0.16, -0.08), [-0.12, 0.14, -0.1]);
      carthHouse(G(c, [0.22, 0, -0.14]), 0.18, 0.16, 2);
      for (let i = 0; i < 4; i++) A(c, cy(0.013, 0.022, 0.08, 6), [-0.26 + i * 0.05, 0.05, 0.12], [0, 0, 0], false);
      return true;
    case 'carth_cothon': cothon(c); return true;
    case 'carth_dye': carthDye(c); return true;
    case 'carth_estates': carthPiece(c, 'farm'); return true;
    case 'carth_byrsa': {
      A(c, cy(0.3, 0.52, 0.22, 16).scale(1, 1, 0.7), [0, 0, 0]); // the Byrsa hill
      A(c, ring(0.33, 0.3, 0.07, 0, 16).scale(1, 1, 0.7), [0, 0.22, 0]); // citadel wall
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; carthTower(G(c, [Math.sin(a) * 0.315, 0.22, Math.cos(a) * 0.22], -a, 0.4)); }
      punicTemple(G(c, [0, 0.22, -0.02], 0, 0.62), 0.44, 0.32, 5);
      for (const [x, z, n] of [[-0.36, 0.22, 2], [-0.2, 0.32, 3], [0.18, 0.33, 2], [0.36, 0.24, 2]] as V3[]) carthHouse(G(c, [x, 0, z], 0, 0.6), 0.2, 0.18, n, false);
      return true;
    }
  }
  return false;
}

// ============================================================ SUMER: mudbrick buttresses, mudhif, ziggurat

function mudhif(c: C, r = 0.13, len = 0.38) {
  A(c, hcyl(r, len), [0, 0, 0]);
  for (let i = 0; i < 4; i++) A(c, torus(r + 0.006, 0.006, PI, 10), [0, 0, -len / 2 + 0.05 + i * ((len - 0.1) / 3)], [0, 0, 0], false); // reed arches
  for (const sx of [-1, 1]) { // great reed-bundle pillars framing the end
    A(c, cy(0.018, 0.022, r * 1.35, 6), [sx * r * 0.85, 0, len / 2 + 0.005]);
    A(c, sph(0.022, 6, 4), [sx * r * 0.85, r * 1.35, len / 2 + 0.005], [0, 0, 0], false);
  }
  A(c, torus(r * 0.4, 0.008, PI, 8), [0, 0, len / 2 + 0.006], [0, 0, 0], false); // arched doorway
  L(c, [[-r * 0.6, r * 0.7, len / 2 + 0.006], [r * 0.6, r * 0.7, len / 2 + 0.006]]); // lattice
}
function buttresses(c: C, w: number, h: number, z: number, n: number, y = 0) {
  for (let i = 0; i < n; i++) A(c, bx(0.022, h, 0.014), [-w / 2 + 0.03 + ((w - 0.06) * i) / Math.max(1, n - 1), y, z], [0, 0, 0], false);
}
function sumerHouse(c: C, w = 0.4, d = 0.32) {
  A(c, bx(w, 0.18, 0.12), [0, 0, -d / 2 + 0.06]); // back wing
  A(c, bx(w, 0.13, 0.08), [0, 0, d / 2 - 0.04]); // front wing
  for (const sx of [-1, 1]) A(c, bx(0.08, 0.15, d - 0.2), [sx * (w / 2 - 0.04), 0, 0.02]);
  A(c, bx(w * 0.3, 0.07, 0.1), [w * 0.2, 0.18, -d / 2 + 0.06]); // roof room
  door(c, -w * 0.15, d / 2 + 0.002, 0.06, 0.11);
  L(c, [[w * 0.18, 0.13, d / 2 + 0.01], [w * 0.18, 0.2, d / 2 + 0.05], [w * 0.32, 0.2, d / 2 + 0.05], [w * 0.32, 0.13, d / 2 + 0.01]]); // reed awning
}
function ziggurat(c: C, k = 1) {
  A(c, tb(0.74 * k, 0.17 * k, 0.52 * k, 0.07), [0, 0, 0]);
  buttresses(c, 0.7 * k, 0.15 * k, 0.26 * k, 7, 0);
  A(c, tb(0.5 * k, 0.14 * k, 0.34 * k, 0.07), [0, 0.17 * k, -0.04 * k]);
  A(c, tb(0.3 * k, 0.1 * k, 0.2 * k, 0.07), [0, 0.31 * k, -0.07 * k]);
  A(c, bx(0.13 * k, 0.09 * k, 0.1 * k), [0, 0.41 * k, -0.08 * k]); // summit shrine
  A(c, bx(0.03 * k, 0.05 * k, 0.006), [0, 0.41 * k, -0.03 * k + 0.004], [0, 0, 0], false);
  // the three stairways of Ur: one straight up the middle, two along the facade, meeting at a gatehouse
  A(c, stairs(6, 0.036 * k, 0.17 * k / 6, 0.07 * k), [0, 0, 0.245 * k]);
  for (const sx of [-1, 1]) A(c, stairs(7, 0.034 * k, 0.024 * k, 0.05 * k), [sx * 0.04 * k, 0, 0.255 * k + 0.028 * k], [0, sx * PI / 2, 0]);
  A(c, bx(0.08 * k, 0.07 * k, 0.07 * k), [0, 0.17 * k, 0.2 * k]); // gatehouse
}

function sumerPiece(c: C, piece: ArchPiece) {
  switch (piece) {
    case 'house': sumerHouse(c); palm(c, 0.32, 0.14, 0.34); break;
    case 'hall':
      A(c, bx(0.58, 0.22, 0.26), [0, 0, -0.04]);
      buttresses(c, 0.58, 0.22, 0.095, 9);
      A(c, bx(0.6, 0.02, 0.28), [0, 0.22, -0.04], [0, 0, 0], false);
      door(c, 0, 0.096, 0.07, 0.14);
      break;
    case 'temple':
      // after the White Temple of Uruk: a whitewashed shrine on a high battered platform
      A(c, tb(0.62, 0.15, 0.44, 0.1), [0, 0, -0.04]);
      A(c, stairs(6, 0.03, 0.025, 0.08), [0.2, 0, 0.18]);
      A(c, bx(0.38, 0.17, 0.2), [0, 0.15, -0.06]);
      buttresses(c, 0.38, 0.17, 0.045, 7, 0.15);
      A(c, bx(0.4, 0.02, 0.22), [0, 0.32, -0.06], [0, 0, 0], false);
      door(c, 0, 0.042, 0.05, 0.1, 0.15);
      break;
    case 'monument': ziggurat(c, 0.9); break;
    case 'wonder': sumerUr(c); break;
    case 'walls':
      A(c, wallG(0.9, 0.24, 0.12, { cren: 'stepped', n: 8, mh: 0.04 }), [0, 0, 0]);
      for (const x of [-0.36, -0.12, 0.12, 0.36]) { A(c, hcylV(0.055, 0.28, 8), [x, 0, 0.06]); A(c, cy(0.04, 0.04, 0.02, 8), [x, 0.28, 0.075], [0, 0, 0], false); }
      break;
    case 'gate':
      A(c, wallG(0.3, 0.32, 0.14, { open: archOpen(0.12, 0.22), cren: 'stepped', n: 3, mh: 0.04 }), [0, 0, 0]);
      for (const sx of [-1, 1]) { const t = G(c, [sx * 0.22, 0, 0.01]); A(t, bx(0.15, 0.42, 0.18), [0, 0, 0]); buttresses(t, 0.15, 0.42, 0.093, 3); A(t, wallG(0.15, 0.0, 0.18, { cren: 'stepped', n: 1, mh: 0.05 }), [0, 0.42, 0], [0, 0, 0], false); }
      for (const sx of [-1, 1]) A(c, wallG(0.16, 0.26, 0.1, { cren: 'stepped', n: 2, mh: 0.035 }), [sx * 0.39, 0, -0.02]);
      break;
    case 'tower': {
      A(c, bx(0.24, 0.5, 0.24), [0, 0, 0]);
      buttresses(c, 0.24, 0.5, 0.124, 4);
      for (const r of [0, PI / 2, PI, -PI / 2]) A(c, wallG(0.24, 0.0, 0.03, { cren: 'stepped', n: 2, mh: 0.05 }), [Math.sin(r) * 0.105, 0.5, Math.cos(r) * 0.105], [0, r, 0], false);
      door(c, 0, 0.122, 0.06, 0.12);
      break;
    }
    case 'palisade':
      for (let i = 0; i < 12; i++) {
        const a = PI * 0.12 + (i / 11) * PI * 0.76, x = Math.cos(a) * 0.42, z = 0.12 - Math.sin(a) * 0.3;
        A(c, cy(0.016, 0.02, 0.2, 6), [x, 0, z], [0, 0, 0], i % 3 === 0); // reed bundles
        A(c, torus(0.016, 0.006, PI, 6), [x + 0.016, 0.2, z], [0, 0, 0], false); // curled tips
      }
      { const pts: V3[] = []; for (let i = 0; i <= 11; i++) { const a = PI * 0.12 + (i / 11) * PI * 0.76; pts.push([Math.cos(a) * 0.42, 0.11, 0.12 - Math.sin(a) * 0.3]); } L(c, pts); }
      mudhif(G(c, [0, 0, -0.02], 0, 0.7));
      break;
    case 'granary':
      A(c, bx(0.48, 0.2, 0.24), [-0.06, 0, -0.06]);
      buttresses(c, 0.48, 0.2, 0.066, 6);
      A(c, bx(0.5, 0.02, 0.26), [-0.06, 0.2, -0.06], [0, 0, 0], false);
      door(c, -0.06, 0.062, 0.07, 0.13);
      A(c, cn(0.09, 0.08, 9), [0.28, 0, 0.12]); // grain heap
      for (let i = 0; i < 3; i++) A(c, cy(0.025, 0.018, 0.09, 7), [0.22 + i * 0.06, 0, -0.08], [0, 0, 0], false); // storage jars
      break;
    case 'farm':
      water(c, 0.95, 0.06, [0, 0, 0.0], 1);
      field(c, -0.2, 0.18, 0.5, 0.2, 4); field(c, 0.22, -0.18, 0.46, 0.2, 4); field(c, -0.24, -0.2, 0.36, 0.16, 3);
      A(c, bx(0.03, 0.01, 0.2), [0.12, 0, 0.13]); // feeder channel
      palm(c, 0.34, 0.16, 0.34); palm(c, 0.42, 0.08, 0.28); palm(c, -0.42, -0.06, 0.3);
      break;
    case 'market':
      water(c, 0.95, 0.16, [0, 0, 0.26], 2);
      A(c, bx(0.9, 0.04, 0.06), [0, 0, 0.15]); // quay
      for (const x of [-0.24, 0.02, 0.26]) { for (const dx of [-0.08, 0.08]) L(c, [[x + dx, 0, 0.06], [x + dx, 0.16, 0.06]]); A(c, new THREE.PlaneGeometry(0.2, 0.16).rotateX(-PI / 2 + 0.2), [x, 0.17, 0.0]); A(c, cy(0.022, 0.016, 0.07, 7), [x, 0, 0.02], [0, 0, 0], false); }
      sumerHouse(G(c, [0.0, 0, -0.22], 0, 0.6));
      hull(c, [0.28, 0, 0.27], 0, 0.7, 'reed');
      break;
    case 'harbor':
      water(c, 0.95, 0.34, [0, 0, 0.14], 3);
      A(c, bx(0.9, 0.05, 0.1), [0, 0, -0.06]);
      hull(c, [-0.18, 0, 0.12], 0.1, 0.9, 'reed'); hull(c, [0.2, 0, 0.22], -0.15, 0.75, 'reed', false);
      sumerHouse(G(c, [-0.2, 0, -0.24], 0, 0.5)); palm(c, 0.36, -0.2, 0.3);
      break;
    case 'workshop':
      sumerHouse(G(c, [-0.14, 0, -0.06], 0, 0.75));
      A(c, cy(0.08, 0.1, 0.1, 10), [0.24, 0, 0.0]); A(c, dome(0.08, 10), [0.24, 0.1, 0.0]); // pottery kiln
      A(c, cyl(0.04, 0.04, 0.01, 12), [0.18, 0.05, 0.2], [0, 0, 0], false); L(c, [[0.18, 0, 0.2], [0.18, 0.05, 0.2]]); // potter's wheel
      for (let i = 0; i < 3; i++) A(c, cy(0.02, 0.014, 0.05, 7), [0.3 + i * 0.04, 0, 0.18], [0, 0, 0], false);
      break;
    case 'road':
      A(c, bx(0.9, 0.02, 0.18), [0, 0, 0.04]);
      for (let i = 0; i < 8; i++) L(c, [[-0.42 + i * 0.12, 0.022, -0.05], [-0.42 + i * 0.12, 0.022, 0.13]]);
      A(c, bx(0.9, 0.03, 0.02), [0, 0, -0.06]); A(c, bx(0.9, 0.03, 0.02), [0, 0, 0.14]);
      palm(c, -0.3, -0.16, 0.32); palm(c, 0.1, -0.16, 0.3); palm(c, 0.36, 0.26, 0.28);
      break;
    case 'palace': {
      const W = 0.7, D = 0.5;
      A(c, bx(W, 0.2, 0.06), [0, 0, -D / 2 + 0.03]); A(c, bx(W, 0.16, 0.06), [0, 0, D / 2 - 0.03]);
      for (const sx of [-1, 1]) A(c, bx(0.06, 0.18, D - 0.12), [sx * (W / 2 - 0.03), 0, 0]);
      buttresses(c, W, 0.16, D / 2 + 0.002, 10);
      door(c, 0, D / 2 + 0.004, 0.08, 0.13);
      A(c, bx(0.34, 0.24, 0.16), [0, 0, -0.12]); buttresses(c, 0.34, 0.24, -0.04 + 0.004, 6); // throne hall
      palm(c, 0.2, 0.08, 0.24);
      break;
    }
    case 'furnace':
      A(c, cy(0.1, 0.12, 0.14, 10), [-0.06, 0, 0]); A(c, dome(0.1, 10), [-0.06, 0.14, 0]);
      A(c, bx(0.05, 0.05, 0.012), [-0.06, 0, 0.115], [0, 0, 0], false);
      for (let i = 0; i < 3; i++) A(c, bx(0.12, 0.03, 0.06), [0.24, i * 0.03, 0.1], [0, 0, 0], false); // brick stack
      sumerHouse(G(c, [0.24, 0, -0.16], 0, 0.45));
      break;
    case 'canal': sumerCanals(c); break;
    case 'quarry': {
      // no stone in the southern plain: a brick yard of drying mud bricks and a kiln
      A(c, bx(0.6, 0.008, 0.4), [-0.1, 0, 0]);
      for (let r = 0; r < 4; r++) A(c, bx(0.5, 0.02, 0.05), [-0.1, 0.008, -0.14 + r * 0.09], [0, 0, 0], r % 2 === 0);
      for (let r = 0; r < 4; r++) for (let k = 1; k < 6; k++) L(c, [[-0.35 + k * 0.083, 0.03, -0.165 + r * 0.09], [-0.35 + k * 0.083, 0.03, -0.115 + r * 0.09]]);
      A(c, cy(0.08, 0.1, 0.12, 10), [0.34, 0, -0.08]); A(c, dome(0.08, 10), [0.34, 0.12, -0.08]);
      A(c, heap(0.08, 1.4, 0.3), [0.32, 0, 0.18], [0, 0, 0], false); // clay pit spoil
      break;
    }
  }
}
function sumerCanals(c: C) {
  water(c, 0.95, 0.07, [0, 0, 0.0], 1);
  water(c, 0.06, 0.4, [-0.2, 0, -0.2], 0); water(c, 0.06, 0.32, [0.24, 0, 0.18], 0);
  A(c, bx(0.12, 0.12, 0.03), [-0.2, 0, 0.0]); // sluice
  field(c, 0.02, -0.2, 0.3, 0.3, 4); field(c, -0.02, 0.2, 0.36, 0.26, 4);
  palm(c, 0.38, -0.12, 0.32); palm(c, 0.44, -0.04, 0.26); palm(c, -0.4, 0.16, 0.3); palm(c, -0.38, -0.22, 0.28);
}
function sumerUr(c: C) {
  ziggurat(G(c, [0, 0, -0.08]), 1.0);
  const pts: V3[] = [];
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; pts.push([Math.cos(a) * 0.62, 0.05, -0.04 + Math.sin(a) * 0.45]); }
  A(c, plan([[-0.48, -0.36], [0.48, -0.36], [0.48, 0.34], [0.12, 0.34], [0.12, 0.32], [0.46, 0.32], [0.46, -0.34], [-0.46, -0.34], [-0.46, 0.32], [-0.12, 0.32], [-0.12, 0.34], [-0.48, 0.34]], 0.07), [0, 0, 0]); // temenos wall
  for (const [x, z] of [[-0.38, 0.2], [0.38, 0.2], [-0.38, -0.24]] as P2[]) { const g = G(c, [x, 0, z], 0, 0.3); sumerHouse(g); }
  palm(c, 0.4, -0.22, 0.3); palm(c, -0.2, 0.26, 0.26);
}

function sumerBespoke(c: C, id: string): boolean {
  switch (id) {
    case 'sumer_reeds':
      mudhif(G(c, [-0.16, 0, 0.0], 0.15), 0.13, 0.38);
      mudhif(G(c, [0.22, 0, -0.08], -0.2, 0.8), 0.13, 0.38);
      water(c, 0.95, 0.1, [0, 0, 0.32], 2);
      hull(c, [0.24, 0, 0.32], 0, 0.6, 'reed', false);
      return true;
    case 'sumer_canals': sumerCanals(c); return true;
    case 'sumer_archive': {
      sumerHouse(G(c, [-0.12, 0, -0.08], 0, 0.9));
      const g = G(c, [0.26, 0, 0.04]); // tablet room open to the front
      A(g, bx(0.22, 0.2, 0.03), [0, 0, -0.08]);
      for (let i = 0; i < 3; i++) { A(g, bx(0.2, 0.01, 0.05), [0, 0.04 + i * 0.055, -0.05]); L(g, [[-0.08, 0.06 + i * 0.055, -0.03], [-0.04, 0.06 + i * 0.055, -0.03], [-0.04, 0.05 + i * 0.055, -0.03], [-0.02, 0.05 + i * 0.055, -0.03], [-0.02, 0.06 + i * 0.055, -0.03], [0.02, 0.06 + i * 0.055, -0.03], [0.02, 0.05 + i * 0.055, -0.03], [0.04, 0.05 + i * 0.055, -0.03], [0.04, 0.06 + i * 0.055, -0.03], [0.08, 0.06 + i * 0.055, -0.03]]); }
      A(g, bx(0.12, 0.05, 0.06), [0, 0, 0.06]); // writing bench
      for (let i = 0; i < 3; i++) A(g, bx(0.025, 0.006, 0.035), [-0.035 + i * 0.035, 0.05, 0.06], [0, 0, 0], false); // tablets
      return true;
    }
    case 'sumer_ziggurat': ziggurat(c, 1.0); return true;
    case 'sumer_ur': sumerUr(c); return true;
    case 'sumer_uruk':
      A(c, wallG(1.0, 0.3, 0.16, { open: archOpen(0.1, 0.2), cren: 'stepped', n: 10, mh: 0.045 }), [0, 0, 0]);
      for (const x of [-0.44, -0.3, -0.16, 0.16, 0.3, 0.44]) A(c, hcylV(0.05, 0.34, 8), [x, 0, 0.08]);
      for (const sx of [-1, 1]) { A(c, bx(0.12, 0.42, 0.22), [sx * 0.09, 0, 0.02]); A(c, wallG(0.12, 0.0, 0.22, { cren: 'stepped', n: 1, mh: 0.05 }), [sx * 0.09, 0.42, 0.02], [0, 0, 0], false); }
      A(c, wallG(1.0, 0.22, 0.08, { cren: 'stepped', n: 9, mh: 0.035 }), [0, 0, -0.18]); // inner wall of the double circuit
      return true;
  }
  return false;
}

// ============================================================ INCA: fitted stone, trapezoids, thatch, terraces

function incaHouse(c: C, w = 0.34, d = 0.22, h = 0.16, doors = 1, pegs = true) {
  A(c, tb(w, h, d, 0.05), [0, 0, 0]);
  const rw = w + 0.06, rd = d + 0.09, rh = 0.22;
  A(c, gableX(rw, rh, rd), [0, h - 0.015, 0]); // steep thatch
  { // thatch strokes down the front slope
    const pts: V3[] = [], n = Math.max(4, Math.round(rw / 0.05));
    for (let i = 0; i <= n; i++) { const x = -rw / 2 + 0.01 + ((rw - 0.02) * i) / n; pts.push(i % 2 ? [x, h - 0.015, rd / 2] : [x, h - 0.015 + rh * 0.92, rd * 0.04]); }
    L(c, pts);
  }
  for (let i = 0; i < doors; i++) door(c, doors === 1 ? -w * 0.1 : -w / 2 + (w * (i + 0.5)) / doors, d / 2 - 0.002, 0.06, 0.12);
  if (doors === 1) niche(c, w * 0.26, 0.05, d / 2 - 0.001);
  if (pegs) for (const sx of [-1, 1]) A(c, cyl(0.007, 0.007, 0.04, 5), [sx * (w / 2 + 0.02), h + 0.06, 0], [0, 0, PI / 2], false); // roof pegs
}
function qullqa(c: C, round = true) {
  if (round) { A(c, cy(0.06, 0.066, 0.12, 10), [0, 0, 0]); A(c, cn(0.08, 0.09, 10), [0, 0.12, 0]); }
  else { A(c, tb(0.14, 0.11, 0.09, 0.05), [0, 0, 0]); A(c, gableX(0.17, 0.09, 0.12), [0, 0.11, 0]); }
  A(c, bx(0.03, 0.035, 0.008), [0, 0.06, round ? 0.064 : 0.045], [0, 0, 0], false); // small window-door
}
function terraces(c: C, n = 4, R = 0.62, arc = 1.4, rise = 0.07, cz = -0.5) {
  for (let i = 0; i < n; i++) {
    A(c, sector(R - i * 0.1, rise, arc, 12), [0, i * rise, cz]);
    // crop rows on each tread
    const r = R - i * 0.1 - 0.05;
    const pts: V3[] = [];
    for (let k = 0; k <= 8; k++) { const a = -arc / 2 + (arc * k) / 8; pts.push([Math.sin(a) * r, (i + 1) * rise + 0.004, cz + Math.cos(a) * r]); }
    L(c, pts);
  }
}
function zigzag(c: C, W: number, H: number, teeth: number, depth: number, z: number, y = 0, thick = 0.07) {
  const pts: P2[] = [];
  const u = W / teeth;
  for (let i = 0; i <= teeth; i++) pts.push([-W / 2 + i * u, z + (i % 2 ? depth : 0)]);
  for (let i = teeth; i >= 0; i--) pts.push([-W / 2 + i * u, z + (i % 2 ? depth : 0) - thick]);
  A(c, plan(pts, H), [0, y, 0]);
  // fitted polygonal joints on the salient faces
  for (let i = 0; i < teeth; i++) {
    const x0 = -W / 2 + i * u, x1 = x0 + u, z0 = z + (i % 2 ? depth : 0), z1 = z + ((i + 1) % 2 ? depth : 0);
    const pts3: V3[] = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; pts3.push([x0 + (x1 - x0) * t, y + H * (0.45 + (c.r() - 0.5) * 0.25), z0 + (z1 - z0) * t + 0.002]); }
    L(c, pts3);
  }
}

/** Andean peaks as glowing ridge silhouettes (light on the GPU, never hiding the buildings). */
function mountains(c: C, x0: number, x1: number, z: number, hMax: number, peaks = 3) {
  const pts: V3[] = [[x0, 0, z]];
  const n = peaks * 4;
  for (let i = 1; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t;
    const env = Math.abs(Math.sin(t * PI * peaks));
    const h = hMax * (0.25 + 0.75 * env) * (0.75 + 0.25 * Math.sin(i * 2.3)) * (0.9 + c.r() * 0.2);
    pts.push([x, h, z - env * 0.05]);
  }
  pts.push([x1, 0, z]);
  L(c, pts);
  // a snow line under each summit
  for (let p = 0; p < peaks; p++) { const t = (p + 0.5) / peaks, x = x0 + (x1 - x0) * t, h = hMax * 0.62; L(c, [[x - 0.06, h, z - 0.04], [x - 0.02, h + 0.03, z - 0.05], [x + 0.02, h - 0.01, z - 0.05], [x + 0.06, h + 0.02, z - 0.04]]); }
}

function incaPiece(c: C, piece: ArchPiece) {
  switch (piece) {
    case 'house':
      incaHouse(G(c, [-0.04, 0, -0.02], 0.35));
      A(c, plan([[-0.3, 0.18], [0.36, 0.18], [0.36, 0.2], [-0.3, 0.2]], 0.07), [0, 0, 0]); // kancha wall
      incaHouse(G(c, [0.32, 0, -0.06], -PI / 2, 0.6), 0.34, 0.22, 0.16, 1, false);
      break;
    case 'hall': incaHouse(c, 0.66, 0.24, 0.17, 4); break; // kallanka
    case 'temple': {
      // after the Coricancha: fine ashlar, a curved wall and halls with trapezoidal niches
      A(c, bx(0.7, 0.06, 0.48), [0, 0, -0.04]);
      joints(c, -0.35, 0.35, 0, 0.06, 0.201, 1, 0);
      A(c, ring(0.2, 0.17, 0.2, PI, 14).rotateY(PI), [0.2, 0.06, 0.02]); // curved wall facing out
      incaHouse(G(c, [-0.1, 0.06, -0.08]), 0.36, 0.2, 0.16, 1);
      for (let i = 0; i < 3; i++) niche(c, -0.22 + i * 0.06, 0.1, 0.022);
      A(c, stairs(3, 0.02, 0.02, 0.12), [-0.1, 0, 0.2 + 0.06]);
      break;
    }
    case 'monument': {
      // a stepped ashlar platform crowned by a double-jamb gateway
      for (let i = 0; i < 3; i++) { A(c, tb(0.62 - i * 0.14, 0.09, 0.46 - i * 0.1, 0.04), [0, i * 0.09, -0.02 - i * 0.02]); joints(c, -0.3 + i * 0.07, 0.3 - i * 0.07, i * 0.09, i * 0.09 + 0.09, 0.21 - i * 0.07, 1, 1); }
      A(c, stairs(6, 0.025, 0.045, 0.1), [0, 0, 0.21 + 0.0]);
      A(c, wallG(0.24, 0.28, 0.06, { open: trapOpen(0.1, 0.07, 0.2) }), [0, 0.27, -0.06]);
      A(c, wallG(0.2, 0.24, 0.02, { open: trapOpen(0.12, 0.09, 0.22) }), [0, 0.27, -0.02], [0, 0, 0], false);
      break;
    }
    case 'wonder': incaFortress(c); break;
    case 'walls':
      A(c, tb(0.9, 0.26, 0.12, 0.08), [0, 0, 0]);
      joints(c, -0.43, 0.43, 0, 0.25, 0.058, 3, 1);
      A(c, tp(0.11, 0.08, 0.19, 0.03), [0.1, 0, 0.05]);
      break;
    case 'gate':
      A(c, wallG(0.5, 0.36, 0.14, { open: trapOpen(0.14, 0.1, 0.25) }), [0, 0, 0]);
      A(c, wallG(0.3, 0.3, 0.04, { open: trapOpen(0.17, 0.13, 0.27) }), [0, 0, 0.085]); // outer jamb (double-jamb)
      joints(c, -0.25, -0.1, 0, 0.36, 0.105, 3, 1); joints(c, 0.1, 0.25, 0, 0.36, 0.105, 3, 1);
      for (const sx of [-1, 1]) A(c, tb(0.22, 0.26, 0.12, 0.08), [sx * 0.36, 0, -0.01]);
      break;
    case 'tower':
      A(c, cy(0.15, 0.17, 0.12, 14), [0, 0, 0]);
      A(c, cy(0.12, 0.13, 0.26, 14), [0, 0.12, 0]);
      A(c, ring(0.13, 0.115, 0.03, 0, 14), [0, 0.38, 0], [0, 0, 0], false);
      A(c, cn(0.15, 0.2, 12), [0, 0.38, 0]);
      door(c, 0, 0.165, 0.06, 0.11);
      niche(c, 0.0, 0.24, 0.13);
      break;
    case 'palisade': // a hilltop pukara with dry-stone rings
      A(c, cy(0.36, 0.46, 0.08, 14).scale(1, 1, 0.62), [0, 0, 0]);
      A(c, ring(0.4, 0.37, 0.07, 0.4, 16).scale(1, 1, 0.62), [0, 0, 0]);
      A(c, ring(0.26, 0.23, 0.08, 0.5, 14).scale(1, 1, 0.62), [0, 0.08, 0]);
      incaHouse(G(c, [0, 0.08, -0.04], 0, 0.55));
      break;
    case 'granary':
      for (let i = 0; i < 4; i++) A(c, bx(0.8 - i * 0.1, 0.05, 0.16), [0, i * 0.05, 0.2 - i * 0.14]); // slope steps
      for (let i = 0; i < 4; i++) for (let k = 0; k < 3 - (i === 3 ? 1 : 0); k++) qullqa(G(c, [-0.22 + k * 0.22 + (i % 2) * 0.05, (i + 1) * 0.05, 0.2 - i * 0.14], 0, 0.82), i % 2 === 0);
      break;
    case 'farm':
      terraces(c, 4, 0.62, 1.7);
      L(c, [[-0.05, 0.28, -0.12], [-0.05, 0.21, -0.0], [-0.07, 0.14, 0.03], [-0.07, 0.07, 0.07], [-0.09, 0.005, 0.13]]); // irrigation channel
      break;
    case 'market':
      A(c, bx(0.8, 0.02, 0.5), [0, 0, 0]);
      incaHouse(G(c, [0, 0.02, -0.16], 0, 0.8), 0.6, 0.2, 0.15, 3);
      llama(c, [-0.18, 0.02, 0.14], 0.3); llama(c, [0.12, 0.02, 0.16], -2.8);
      for (const x of [0.28, 0.34]) A(c, heap(0.03, 1, 0.9), [x, 0.02, 0.1], [0, 0, 0], false); // bundles
      break;
    case 'harbor': // a totora reed boat landing on a lake shore
      water(c, 0.95, 0.3, [0, 0, 0.18], 3);
      A(c, bx(0.5, 0.05, 0.1), [-0.2, 0, -0.02]);
      joints(c, -0.45, 0.05, 0, 0.05, 0.031, 1, 1);
      hull(c, [0.16, 0, 0.18], 0, 0.85, 'reed', true);
      incaHouse(G(c, [-0.2, 0, -0.22], 0, 0.6));
      break;
    case 'workshop':
      incaHouse(G(c, [-0.12, 0, -0.06], 0, 0.85));
      for (const [x, z, s] of [[0.22, 0.12, 1], [0.32, 0.04, 0.8], [0.26, -0.08, 0.9]] as V3[]) A(c, plan([[-0.04 * s, -0.03 * s], [0.03 * s, -0.04 * s], [0.05 * s, 0.01 * s], [0.02 * s, 0.04 * s], [-0.045 * s, 0.03 * s]], 0.05 * s), [x, 0, z]);
      L(c, [[0.06, 0, 0.18], [0.06, 0.16, 0.18]]); L(c, [[0.14, 0, 0.18], [0.14, 0.16, 0.18]]); L(c, [[0.06, 0.14, 0.18], [0.14, 0.14, 0.18]]); // loom frame
      break;
    case 'road': incaRoad(c); break;
    case 'palace': {
      const W = 0.72, D = 0.5;
      A(c, wallG(W, 0.12, 0.04, { open: trapOpen(0.09, 0.065, 0.1) }), [0, 0, D / 2 - 0.02]);
      A(c, bx(W, 0.12, 0.04), [0, 0, -D / 2 + 0.02]);
      for (const sx of [-1, 1]) A(c, bx(0.04, 0.12, D - 0.08), [sx * (W / 2 - 0.02), 0, 0]);
      joints(c, -W / 2, -0.05, 0, 0.12, D / 2 + 0.001, 2, 0); joints(c, 0.05, W / 2, 0, 0.12, D / 2 + 0.001, 2, 0);
      incaHouse(G(c, [0, 0, -0.14], 0, 0.75), 0.5, 0.2, 0.16, 3);
      incaHouse(G(c, [-0.22, 0, 0.06], PI / 2, 0.6), 0.3, 0.2, 0.16, 1, false);
      incaHouse(G(c, [0.22, 0, 0.06], -PI / 2, 0.6), 0.3, 0.2, 0.16, 1, false);
      break;
    }
    case 'furnace': // huayrachina: wind furnaces on a breezy slope
      A(c, tb(0.8, 0.1, 0.34, 0.1), [0, 0, -0.06]);
      for (const [x, z] of [[-0.2, 0.02], [0.02, -0.04], [0.22, 0.02]] as P2[]) {
        A(c, cy(0.04, 0.06, 0.16, 9), [x, 0.1, z]);
        for (let k = 0; k < 4; k++) A(c, cyl(0.008, 0.008, 0.01, 5), [x + Math.sin(k * 1.6) * 0.05, 0.16 + (k % 2) * 0.04, z + Math.cos(k * 1.6) * 0.05], [PI / 2, k * 1.6, 0], false);
        L(c, [[x, 0.26, z], [x + 0.03, 0.34, z], [x + 0.01, 0.4, z]]);
      }
      break;
    case 'canal': // stepped stone channels feeding a fountain (cf. Tipón)
      for (let i = 0; i < 4; i++) { A(c, bx(0.7 - i * 0.12, 0.05, 0.12), [0, i * 0.05, 0.18 - i * 0.12]); A(c, bx(0.04, 0.006, 0.12), [0, i * 0.05 + 0.05, 0.18 - i * 0.12], [0, 0, 0], false); }
      for (let i = 0; i < 3; i++) L(c, [[0, i * 0.05 + 0.05, 0.12 - i * 0.12], [0, i * 0.05 + 0.02, 0.125 - i * 0.12]]);
      water(c, 0.18, 0.08, [0, 0, 0.3], 1);
      joints(c, -0.35, 0.35, 0, 0.05, 0.241, 1, 0);
      break;
    case 'quarry':
      A(c, tb(0.56, 0.22, 0.3, 0.2), [0, 0, -0.12]);
      joints(c, -0.26, 0.26, 0, 0.2, 0.03, 3, 1);
      A(c, tb(0.12, 0.12, 0.3, 0.1), [0.34, 0, -0.04], [0.3, 0, 0], false); // ramp
      for (const [x, z, s] of [[0.0, 0.18, 1.3], [-0.2, 0.16, 1]] as V3[]) A(c, plan([[-0.05 * s, -0.035 * s], [0.04 * s, -0.045 * s], [0.06 * s, 0.01 * s], [0.025 * s, 0.045 * s], [-0.055 * s, 0.03 * s]], 0.07 * s), [x, 0, z]);
      L(c, [[0.06, 0.08, 0.18], [0.3, 0.02, 0.24]]); // haul rope
      break;
  }
}
function incaRoad(c: C) {
  // stepped stone road climbing to a q'eswachaka-style rope bridge
  for (let i = 0; i < 6; i++) A(c, bx(0.14, 0.03 + i * 0.03, 0.07), [-0.36 + i * 0.035, 0, 0.24 - i * 0.07], [0, 0.35, 0], i % 2 === 0);
  A(c, tb(0.24, 0.2, 0.3, 0.2), [-0.3, 0, -0.18]); // abutment
  A(c, tb(0.24, 0.2, 0.3, 0.2), [0.36, 0, -0.18]);
  for (const [x, sx] of [[-0.22, 1], [0.28, -1]] as P2[]) for (const z of [-0.22, -0.14]) L(c, [[x, 0.2, z], [x, 0.3, z]]);
  for (const z of [-0.22, -0.14]) {
    const hand: V3[] = [], deck: V3[] = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10, x = -0.22 + 0.5 * t, sag = Math.sin(t * PI) * 0.06; hand.push([x, 0.3 - sag, z]); deck.push([x, 0.2 - sag, -0.18]); }
    L(c, hand); if (z < -0.2) L(c, deck);
  }
  for (let k = 1; k < 10; k++) { const t = k / 10, x = -0.22 + 0.5 * t, sag = Math.sin(t * PI) * 0.06; L(c, [[x, 0.3 - sag, -0.22], [x, 0.2 - sag, -0.18], [x, 0.3 - sag, -0.14]]); }
  mountains(c, -0.45, 0.5, -0.42, 0.42, 2); // peaks behind the gorge
}
function incaFortress(c: C) {
  // Sacsayhuamán: three stacked tiers of zig-zag walls with a round tower on top
  A(c, tb(1.0, 0.36, 0.6, 0.35), [0, 0, -0.22]); // the hill
  zigzag(c, 0.96, 0.16, 8, 0.07, 0.12, 0, 0.07);
  zigzag(c, 0.8, 0.13, 6, 0.06, 0.0, 0.12, 0.06);
  zigzag(c, 0.62, 0.1, 4, 0.05, -0.12, 0.24, 0.05);
  A(c, tp(0.08, 0.055, 0.12, 0.02), [0.06, 0, 0.17]); // trapezoid gate in the outer wall
  A(c, cy(0.09, 0.1, 0.2, 14), [0, 0.36, -0.24]); // Muyuq Marka
  A(c, cy(0.06, 0.07, 0.06, 12), [0, 0.56, -0.24], [0, 0, 0], false);
  A(c, cn(0.08, 0.1, 10), [0, 0.62, -0.24]);
  mountains(c, -0.55, 0.55, -0.52, 0.78, 3);
}

function incaBespoke(c: C, id: string): boolean {
  switch (id) {
    case 'inca_terraces': terraces(c, 5, 0.66, 1.5, 0.065, -0.5); incaHouse(G(c, [0.0, 0.325, -0.18], 0, 0.45)); return true;
    case 'inca_road': incaRoad(c); return true;
    case 'inca_qullqa': incaPiece(c, 'granary'); return true;
    case 'inca_fortress': incaFortress(c); return true;
  }
  return false;
}

// ============================================================ dispatch

const PIECE: Record<CivId, (c: C, p: ArchPiece) => void> = { kush: kushPiece, aksum: aksumPiece, carthage: carthPiece, sumer: sumerPiece, inca: incaPiece };
const BESPOKE: Record<CivId, (c: C, id: string) => boolean> = { kush: kushBespoke, aksum: aksumBespoke, carthage: carthBespoke, sumer: sumerBespoke, inca: incaBespoke };
const CIVS: CivId[] = ['kush', 'aksum', 'carthage', 'sumer', 'inca'];
const civOf = (id: string, fallback: CivId): CivId => {
  const pre = id.split('_')[0];
  const m: Record<string, CivId> = { kush: 'kush', aksum: 'aksum', carth: 'carthage', sumer: 'sumer', inca: 'inca' };
  return m[pre] ?? fallback;
};
function ctx(civ: CivId, color: THREE.ColorRepresentation, seed: number): C {
  return { b: new Builder(color), r: seeded(seed * 7919 + CIVS.indexOf(civ) * 131 + 17), civ };
}

/** One structure in a civilization's own style. */
export function archPiece(piece: ArchPiece, civ: CivId, color: THREE.ColorRepresentation, seed = 1): HoloModel {
  const c = ctx(civ, color, seed);
  (PIECE[civ] ?? kushPiece)(c, piece);
  return c.b.done('building');
}

const SHARED_MAP: Record<string, ArchPiece | 'village'> = {
  farm: 'farm', village: 'village', quarry: 'quarry', granary: 'granary', road: 'road', market: 'market', temple: 'temple',
  workshop: 'workshop', palace: 'palace', palisade: 'palisade', watchtower: 'tower', walls: 'walls',
};
const CIV_IDS = [
  'kush_cattle', 'kush_deffufa', 'kush_furnace', 'kush_apedemak', 'kush_pyramid',
  'aksum_fields', 'aksum_adulis', 'aksum_stele', 'aksum_stelae',
  'carth_post', 'carth_cothon', 'carth_dye', 'carth_estates', 'carth_byrsa',
  'sumer_reeds', 'sumer_canals', 'sumer_archive', 'sumer_ziggurat', 'sumer_ur', 'sumer_uruk',
  'inca_terraces', 'inca_road', 'inca_qullqa', 'inca_fortress',
];
/** Card ids that archBuilding renders explicitly (others fall back to the civ's hall). */
export const ARCH_CARD_IDS: string[] = [...Object.keys(SHARED_MAP), ...CIV_IDS];

function village(c: C) {
  const spots: V3[] = [[-0.24, 0, -0.08], [0.16, 0, -0.14], [0.02, 0, 0.16], [0.32, 0, 0.12]];
  spots.forEach((p, i) => dwelling(G(c, p, (c.r() - 0.5) * 0.6, 2.3), c.civ, i < 2 ? 2 : 1, i));
  if (c.civ === 'sumer') palm(c, -0.38, 0.16, 0.3);
  else if (c.civ === 'inca') llama(c, [-0.3, 0, 0.2], 0.4);
  else if (c.civ === 'kush') cow(c, [-0.3, 0, 0.2], 0.4);
  else if (c.civ === 'carthage') tree(c, -0.36, 0.18);
  else field(c, -0.3, 0.22, 0.26, 0.14, 3);
}

/** The model for a specific building or fort card, built in the owning civilization's style (shared cards like 'temple' or 'walls' look different for each civ). */
export function archBuilding(cardId: string, civ: CivId, color: THREE.ColorRepresentation): HoloModel {
  let seed = 0;
  for (let i = 0; i < cardId.length; i++) seed = (seed * 31 + cardId.charCodeAt(i)) % 100000;
  const owner = civOf(cardId, civ);
  const c = ctx(owner, color, seed + 1);
  if (!BESPOKE[owner](c, cardId)) {
    const m = SHARED_MAP[cardId];
    if (m === 'village') village(c);
    else PIECE[owner](c, m ?? 'hall');
  }
  return c.b.done('building');
}

// ============================================================ cities

/** A small dwelling for city layouts (~0.1 wide), by civ and Age. */
function dwelling(c: C, civ: CivId, age: number, i: number) {
  const r = c.r;
  switch (civ) {
    case 'kush':
      if (age <= 2 || (age === 3 && i % 3 === 0) || i % 5 === 0) { A(c, cy(0.04, 0.044, 0.055, 8), [0, 0, 0]); A(c, cn(0.055, 0.06, 8), [0, 0.055, 0], [0, 0, 0], false); }
      else { const h = 0.06 + r() * 0.03; A(c, tb(0.11, h, 0.09, 0.08), [0, 0, 0]); if (i % 2) A(c, tb(0.04, 0.03, 0.04, 0.05), [-0.025, h, -0.015], [0, 0, 0], false); }
      break;
    case 'aksum':
      if (age === 1 || (age === 2 && i % 2 === 0)) { A(c, cy(0.04, 0.042, 0.05, 8), [0, 0, 0]); A(c, cn(0.055, 0.06, 8), [0, 0.05, 0], [0, 0, 0], false); }
      else {
        const n = age >= 4 && i % 3 === 0 ? 2 : 1;
        A(c, bx(0.12, 0.015, 0.1), [0, 0, 0], [0, 0, 0], false);
        for (let k = 0; k < n; k++) { A(c, bx(0.1, 0.055, 0.08), [0, 0.015 + k * 0.065, 0]); A(c, bx(0.09, 0.01, 0.07), [0, 0.07 + k * 0.065, 0], [0, 0, 0], false); }
      }
      break;
    case 'carthage': {
      const n = age <= 1 ? 1 : 1 + Math.floor(r() * Math.min(3, age));
      A(c, bx(0.08, 0.05 * n, 0.08), [0, 0, 0]);
      A(c, bx(0.086, 0.007, 0.086), [0, 0.05 * n, 0], [0, 0, 0], false);
      if (n > 1 && i % 2) A(c, bx(0.03, 0.025, 0.03), [0.02, 0.05 * n, -0.015], [0, 0, 0], false);
      break;
    }
    case 'sumer':
      if (age <= 2 || i % 4 === 0) { A(c, hcyl(0.04, 0.12, 8), [0, 0, 0]); A(c, cy(0.006, 0.006, 0.055, 4), [-0.034, 0, 0.062], [0, 0, 0], false); A(c, cy(0.006, 0.006, 0.055, 4), [0.034, 0, 0.062], [0, 0, 0], false); }
      else { A(c, bx(0.12, 0.06, 0.05), [0, 0, -0.025]); A(c, bx(0.04, 0.05, 0.06), [-0.04, 0, 0.03], [0, 0, 0], false); A(c, bx(0.04, 0.045, 0.06), [0.04, 0, 0.03], [0, 0, 0], false); }
      break;
    case 'inca':
      A(c, tb(0.11, 0.05, 0.07, 0.06), [0, 0, 0]);
      A(c, gableX(0.12, 0.065, 0.09), [0, 0.05, 0], [0, 0, 0], age >= 3 || i % 2 === 0);
      break;
  }
}

class Plan {
  occ: [number, number, number][] = [];
  constructor(public c: C) {}
  free(x: number, z: number, r: number) { return !this.occ.some(([ox, oz, or]) => Math.hypot(ox - x, oz - z) < or + r); }
  reserve(x: number, z: number, r: number) { this.occ.push([x, z, r]); }
  y = 0;
  put(x: number, z: number, r: number, s: number, draw: (c: C) => void, rotY = 0) { this.reserve(x, z, r); draw(G(this.c, [x, this.y, z], rotY, s)); }
  houses(n: number, age: number, rx = 0.56, rz = 0.36, rr = 0.07, cz = 0, inside?: (x: number, z: number) => boolean) {
    let tries = 0, made = 0;
    while (made < n && tries < 900) {
      tries++;
      const a = this.c.r() * PI * 2, d = Math.sqrt(this.c.r());
      const x = Math.cos(a) * rx * d, z = cz + Math.sin(a) * rz * d;
      if (inside && !inside(x, z)) continue;
      if (!this.free(x, z, rr)) continue;
      this.reserve(x, z, rr);
      dwelling(G(this.c, [x, this.y, z], (this.c.r() - 0.5) * 0.5, 1.25), this.c.civ, age, made);
      made++;
    }
  }
}
const HOUSES = [0, 4, 7, 10, 12, 14];

function kushCity(c: C, age: number, P: Plan) {
  water(c, 1.2, 0.07, [0, 0, 0.36], 2); P.reserve(0, 0.42, 0.12); for (let x = -0.6; x <= 0.6; x += 0.2) P.reserve(x, 0.38, 0.06);
  if (age <= 3) { field(c, -0.4, 0.27, 0.3, 0.08, 2); field(c, 0.38, 0.27, 0.28, 0.08, 2); P.reserve(-0.4, 0.27, 0.12); P.reserve(0.38, 0.27, 0.12); }
  if (age === 1) { const pts: V3[] = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * PI * 2; pts.push([0.3 + Math.cos(a) * 0.14, 0.04, -0.12 + Math.sin(a) * 0.09]); } L(c, pts); cow(c, [0.3, 0, -0.12], 0.4); P.reserve(0.3, -0.12, 0.16); }
  if (age === 2) {
    const pts: V3[] = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * PI * 2; pts.push([Math.cos(a) * 0.5, 0.04 + (i % 2) * 0.03, -0.04 + Math.sin(a) * 0.28]); } L(c, pts);
    P.put(-0.3, -0.18, 0.12, 0.4, (g) => kushPiece(g, 'granary'));
  }
  if (age >= 3) {
    const W = 0.98, D = 0.6, z0 = -0.05;
    for (const sz of [-1, 1]) A(c, tb(W, 0.07, 0.03, 0.15), [0, 0, z0 + (sz * D) / 2]);
    for (const sx of [-1, 1]) A(c, tb(0.03, 0.07, D, 0.15), [(sx * W) / 2, 0, z0]);
    for (const [x, z] of [[-W / 2, z0 - D / 2], [W / 2, z0 - D / 2], [-W / 2, z0 + D / 2], [W / 2, z0 + D / 2], [-0.08, z0 + D / 2], [0.08, z0 + D / 2]] as P2[]) A(c, cy(0.03, 0.035, 0.1, 8), [x, 0, z], [0, 0, 0], false);
    A(c, bx(0.08, 0.008, 0.36), [0, 0, 0.06], [0, 0, 0], false); // processional road
    P.reserve(0, 0.06, 0.06); P.reserve(0, 0.16, 0.06);
    P.put(0, -0.22, 0.18, 0.4, (g) => kushPiece(g, 'temple'));
  }
  if (age >= 4) {
    P.put(-0.36, -0.22, 0.12, 0.4, (g) => kushBespoke(g, 'kush_apedemak'));
    if (age === 4) { P.put(0.36, -0.2, 0.12, 0.6, (g) => kushPyramid(g, 0.15, 0.62)); P.put(0.17, -0.28, 0.08, 0.42, (g) => kushPyramid(g, 0.15, 0.62)); }
  }
  if (age === 5) { P.put(0.3, -0.2, 0.22, 0.62, (g) => kushPiece(g, 'wonder')); P.put(-0.14, 0.06, 0.1, 0.32, (g) => kushPiece(g, 'palace')); }
}
function aksumCity(c: C, age: number, P: Plan) {
  for (const [k, yy] of [[1, 0.0], [0.94, 0.02]] as P2[]) { const pts: V3[] = []; for (let i = 0; i <= 28; i++) { const a = (i / 28) * PI * 2; pts.push([Math.cos(a) * 0.64 * k, yy, Math.sin(a) * 0.4 * k]); } L(c, pts); } // highland plateau rim
  const y = 0.02;
  P.y = y;
  const lift = (draw: (g: C) => void) => draw;
  if (age <= 3) { const g = G(c, [0.38, y, 0.26], 0, 0.36); aksumPiece(g, 'farm'); P.reserve(0.38, 0.26, 0.17); }
  if (age >= 2) P.put(-0.36, -0.2, 0.1, 0.36, lift((g) => aksumPiece(g, 'granary')));
  if (age >= 3) { P.put(0, -0.16, 0.16, 0.42, lift((g) => aksumPiece(g, 'temple'))); A(c, bx(0.1, 0.006, 0.3), [0, y, 0.18], [0, 0, 0], false); P.reserve(0, 0.18, 0.06); }
  if (age === 4) P.put(0.3, -0.18, 0.08, 0.6, lift((g) => aksStele(g, 0.95, 0.15, 7)));
  if (age === 5) { P.put(0.3, -0.16, 0.2, 0.6, lift((g) => { aksStele(G(g, [0, 0, -0.12]), 1.0, 0.13, 8, false); aksStele(G(g, [-0.3, 0, -0.06]), 0.66, 0.1, 5, false); aksStele(G(g, [0.3, 0, -0.1]), 0.72, 0.1, 5, false); aksStele(G(g, [0, 0, 0.2]), 0.4, 0.08, 3, false); })); for (const x of [-0.5, 0.5]) P.put(x, -0.1, 0.05, 0.4, lift((g) => aksStele(g, 0.5, 0.08, 3, false))); }
  return y;
}
function carthCity(c: C, age: number, P: Plan) {
  water(c, 1.2, 0.1, [0, 0, 0.36], 3); for (let x = -0.6; x <= 0.6; x += 0.2) P.reserve(x, 0.38, 0.07);
  A(c, cy(0.22, 0.42, 0.1, 16).scale(1, 1, 0.6), [-0.08, 0, -0.16]); // Byrsa hill
  P.reserve(-0.08, -0.16, 0.2);
  // houses stepping up the hill
  const hill = Math.min(8, 2 + age * 2);
  for (let i = 0; i < hill; i++) { const a = (i / hill) * PI * 2 + 0.3, x = -0.08 + Math.cos(a) * 0.28, z = -0.16 + Math.sin(a) * 0.15; dwelling(G(c, [x, 0.06, z], -a), 'carthage', age, i); }
  if (age <= 2) { P.put(0.3, 0.24, 0.1, 0.4, (g) => { A(g, bx(0.4, 0.05, 0.12), [0, 0, 0]); hull(g, [0.1, 0, 0.18], 0, 0.75); }); }
  if (age === 2) { const pts: V3[] = []; for (let i = 0; i <= 10; i++) pts.push([-0.56 + i * 0.112, 0.06, 0.24]); for (const p of pts) L(c, [[p[0], 0, p[2]], [p[0], 0.06, p[2]]]); L(c, pts); }
  if (age >= 3) {
    A(c, wallG(1.12, 0.08, 0.03, { cren: 'plain', n: 12, mh: 0.015 }), [0, 0, 0.27]);
    for (const x of [-0.56, -0.2, 0.2, 0.56]) carthTower(G(c, [x, 0, 0.27], 0, 0.36), 0.16, 0.42);
    punicTemple(G(c, [-0.08, 0.1, -0.16], 0, 0.3));
  }
  if (age >= 4) P.put(0.36, 0.04, 0.2, 0.46, (g) => cothon(g));
  if (age === 5) { punicTemple(G(c, [-0.08, 0.1, -0.16], 0, 0.36)); P.put(-0.42, 0.06, 0.08, 0.38, (g) => carthPiece(g, 'monument')); }
}
function sumerCity(c: C, age: number, P: Plan) {
  water(c, 1.2, 0.05, [0, 0, 0.35], 1); water(c, 0.04, 0.3, [-0.5, 0, 0.18], 0);
  for (let x = -0.6; x <= 0.6; x += 0.2) P.reserve(x, 0.36, 0.05);
  for (const [x, z, h] of [[0.5, 0.3, 0.2], [-0.56, 0.0, 0.18], [0.56, -0.18, 0.2], [-0.42, 0.3, 0.16]] as V3[]) { palm(c, x, z, h); P.reserve(x, z, 0.05); }
  if (age <= 2) { field(c, 0.3, 0.24, 0.32, 0.1, 2); P.reserve(0.3, 0.24, 0.14); }
  if (age >= 2) P.put(-0.36, -0.22, 0.1, 0.32, (g) => sumerPiece(g, 'granary'));
  if (age >= 3) {
    const pts: P2[] = [];
    const n = 20;
    for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; pts.push([Math.cos(a) * 0.54, -0.03 + Math.sin(a) * 0.33]); }
    const inner = pts.map(([x, z]) => [x * 0.95, -0.03 + (z + 0.03) * 0.92] as P2).reverse();
    A(c, plan([...pts, pts[0], inner[inner.length - 1], ...inner], 0.07), [0, 0, 0]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; A(c, cy(0.022, 0.022, 0.09, 6), [Math.cos(a) * 0.55, 0, -0.03 + Math.sin(a) * 0.34], [0, 0, 0], false); }
    if (age === 3) P.put(0, -0.16, 0.16, 0.4, (g) => sumerPiece(g, 'temple'));
  }
  if (age === 4) P.put(0, -0.14, 0.2, 0.56, (g) => ziggurat(g, 1));
  if (age === 5) { P.put(0, -0.12, 0.24, 0.72, (g) => ziggurat(g, 1)); P.put(0.34, 0.06, 0.12, 0.3, (g) => sumerPiece(g, 'palace')); }
}
function incaCity(c: C, age: number, P: Plan) {
  mountains(c, -0.6, 0.6, -0.42, 0.6, 3);
  P.reserve(0, -0.42, 0.1);
  const tg = G(c, [-0.34, 0, 0.04], 0.6, 0.4); terraces(tg, Math.min(5, 2 + age), 0.6, 1.3, 0.06, -0.5); P.reserve(-0.4, -0.08, 0.2);
  if (age >= 2) P.put(0.38, -0.2, 0.14, 0.34, (g) => incaPiece(g, 'granary'));
  if (age >= 2 && age < 4) { const pts: V3[] = []; for (let i = 0; i <= 18; i++) { const a = PI * 0.05 + (i / 18) * PI * 0.9; pts.push([Math.cos(a) * 0.56, 0.035, -0.02 + Math.sin(a) * 0.34]); } L(c, pts); }
  if (age >= 3) { P.put(0.06, 0.02, 0.14, 0.4, (g) => incaPiece(g, 'temple')); A(c, bx(0.6, 0.006, 0.05), [0.1, 0, 0.3], [0, 0, 0], false); for (let x = -0.15; x < 0.4; x += 0.1) P.reserve(x, 0.3, 0.04); }
  if (age >= 4) P.put(-0.08, -0.26, 0.12, 0.38, (g) => incaPiece(g, 'hall'));
  if (age === 5) P.put(0.0, -0.26, 0.3, 0.46, (g) => incaFortress(g));
}
const CITY: Record<CivId, (c: C, age: number, P: Plan) => unknown> = { kush: kushCity, aksum: aksumCity, carthage: carthCity, sumer: sumerCity, inca: incaCity };

/** A whole settlement for a civilization at an Age 1–5, visibly growing from huts and fields to a walled capital with its great wonder. Footprint about 1.2 × 0.8, centred on the origin. */
export function archCity(civ: CivId, age: number, color: THREE.ColorRepresentation): HoloModel {
  const a = Math.max(1, Math.min(5, Math.round(age)));
  const c = ctx(civ, color, a * 101 + 7);
  const P = new Plan(c);
  (CITY[civ] ?? kushCity)(c, a, P);
  P.houses(HOUSES[a], a);
  if (a === 5) for (let i = 0; i < 6; i++) { const t = (i / 6) * PI * 2 + 0.26; banner(c, Math.cos(t) * 0.6, Math.sin(t) * 0.38, 0.34); }
  return c.b.done('building');
}
