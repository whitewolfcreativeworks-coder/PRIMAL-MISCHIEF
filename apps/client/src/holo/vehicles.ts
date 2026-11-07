import * as THREE from 'three';
import type { CivId } from '@pm/engine';
import { box, Builder, cone, cyl, prism, sph, type HoloModel, type V3 } from './kit';

/*
 * Animals, carts and ships for the hologram theater. Each vehicle exposes
 * animated pivots (legs, wheels, oars) and seats where figures ride, so
 * scenes can put the right people on the right machine. Everything faces +x.
 */

export type VehicleKind = 'horse' | 'elephant' | 'wagon' | 'ram' | 'galley' | 'trader' | 'llama' | 'donkey' | 'camel' | 'sledge';

export interface Vehicle {
  model: HoloModel;
  kind: VehicleKind;
  /** Where riders/crew sit or stand, in the vehicle's local space. */
  seats: THREE.Object3D[];
  /** Where crew walk alongside (pushing a ram, leading a llama). */
  flanks: V3[];
  /** Advance gait/wheels/oars. `speed` 0 = standing still. */
  animate(t: number, speed: number): void;
  /** One-off strike (ram swing, elephant rear) 0..1. */
  strike(p: number): void;
}

const leg = (b: Builder, parent: THREE.Object3D, pos: V3, len: number, r: number) => {
  const pv = b.pivot(pos, parent);
  const g = cyl(r, r * 0.8, len, 6); g.translate(0, -len / 2, 0);
  b.add(g, [0, 0, 0], [0, 0, 0], pv, false);
  return pv;
};
const gait = (legs: THREE.Object3D[], t: number, speed: number, amp: number) => {
  legs.forEach((l, i) => { l.rotation.z = speed ? Math.sin(t * 8 * speed + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * amp : 0; });
};

function quadruped(color: number, o: { len: number; height: number; girth: number; neck: number; head: number; legR: number; hump?: boolean; trunk?: boolean; ears?: boolean; tall?: boolean }) {
  const b = new Builder(color);
  const body = b.pivot([0, 0, 0]);
  const legLen = o.height - o.girth;
  const torso = sph(1, 12, 8); torso.scale(o.len / 2, o.girth / 2, o.girth / 2.4);
  b.add(torso, [0, legLen + o.girth / 2, 0], [0, 0, 0], body);
  if (o.hump) b.add(sph(o.girth * 0.32, 8, 6), [0, legLen + o.girth * 0.95, 0], [0, 0, 0], body);
  const neck = b.pivot([o.len * 0.42, legLen + o.girth * 0.65, 0], body);
  const ng = cyl(o.girth * 0.16, o.girth * 0.24, o.neck, 6); ng.translate(0, o.neck / 2, 0);
  b.add(ng, [0, 0, 0], [0, 0, o.tall ? -0.25 : -0.6], neck, false);
  const headAt: V3 = o.tall ? [o.neck * 0.25, o.neck * 0.95, 0] : [o.neck * 0.56, o.neck * 0.8, 0];
  const hg = box(o.head * 1.4, o.head * 0.7, o.head * 0.7);
  b.add(hg, headAt, [0, 0, -0.35], neck);
  if (o.ears) b.add(box(0.005, o.head * 1.3, o.head * 1.4), [headAt[0] - o.head * 0.3, headAt[1], 0], [0, 0, 0], neck);
  let trunk: THREE.Object3D | null = null;
  if (o.trunk) {
    trunk = b.pivot([headAt[0] + o.head * 0.6, headAt[1] - o.head * 0.1, 0], neck);
    const tg = cyl(o.head * 0.14, o.head * 0.24, o.head * 1.9, 6); tg.translate(0, -o.head * 0.95, 0);
    b.add(tg, [0, 0, 0], [0, 0, 0.15], trunk, false);
    b.add(cone(o.head * 0.08, o.head * 0.8, 5), [o.head * 0.15, -o.head * 0.1, o.head * 0.25], [0, 0, -1.9], trunk, false);
  }
  const tail = cyl(0.003, 0.002, o.girth * 0.7, 4); tail.translate(0, -o.girth * 0.35, 0);
  b.add(tail, [-o.len / 2, legLen + o.girth * 0.7, 0], [0, 0, -0.35], body, false);
  const lx = o.len * 0.32, lz = o.girth * 0.24, ly = legLen + o.girth * 0.2;
  const legs = [[lx, -lz], [lx, lz], [-lx, lz], [-lx, -lz]].map(([x, z]) => leg(b, body, [x, ly, z], ly, o.legR));
  return { b, body, neck, legs, trunk, back: legLen + o.girth };
}

function seat(b: Builder, parent: THREE.Object3D, pos: V3) { return b.pivot(pos, parent); }

export function makeVehicle(kind: VehicleKind, civ: CivId, color: number): Vehicle {
  switch (kind) {
    case 'horse': case 'donkey': case 'llama': case 'camel': {
      const spec = kind === 'horse' ? { len: 0.2, height: 0.22, girth: 0.08, neck: 0.1, head: 0.04, legR: 0.008 }
        : kind === 'donkey' ? { len: 0.15, height: 0.15, girth: 0.065, neck: 0.07, head: 0.035, legR: 0.007, ears: true }
          : kind === 'llama' ? { len: 0.13, height: 0.2, girth: 0.06, neck: 0.12, head: 0.03, legR: 0.006, tall: true, ears: true }
            : { len: 0.2, height: 0.3, girth: 0.085, neck: 0.15, head: 0.035, legR: 0.008, hump: true };
      const q = quadruped(color, spec);
      if (kind === 'horse') q.b.add(box(0.06, 0.012, 0.085), [0, q.back + 0.002, 0], [0, 0, 0], q.body); // saddle cloth
      if (kind !== 'horse') { // pack load
        q.b.add(box(0.05, 0.035, 0.09), [-0.005, q.back + 0.012, 0], [0, 0, 0], q.body);
      }
      const s = seat(q.b, q.body, [0, q.back - 0.1, 0]);
      const model = q.b.done('unit');
      return {
        model, kind, seats: [s], flanks: [[spec.len * 0.55, 0, 0.07]],
        animate(t, speed) { gait(q.legs, t, speed, 0.55); q.body.position.y = speed ? Math.abs(Math.sin(t * 8 * speed)) * 0.008 * speed : 0; q.neck.rotation.z = Math.sin(t * 4) * 0.06; },
        strike(p) { q.body.rotation.z = Math.sin(Math.min(1, p) * Math.PI) * 0.5; },
      };
    }
    case 'elephant': {
      const q = quadruped(color, { len: 0.36, height: 0.4, girth: 0.2, neck: 0.03, head: 0.09, legR: 0.026, trunk: true, ears: true });
      q.b.add(box(0.12, 0.01, 0.16), [0, q.back - 0.005, 0], [0, 0, 0], q.body); // blanket
      // The riders sit on its neck/back; Carthage's are shown with a small platform (a debated detail).
      if (civ === 'carthage') q.b.add(box(0.1, 0.04, 0.12), [-0.03, q.back + 0.02, 0], [0, 0, 0], q.body);
      const s1 = seat(q.b, q.body, [0.1, q.back - 0.11, 0]);
      const s2 = seat(q.b, q.body, [-0.04, q.back - 0.08 + (civ === 'carthage' ? 0.04 : 0), 0]);
      const model = q.b.done('unit');
      return {
        model, kind, seats: [s1, s2], flanks: [[0.2, 0, 0.14], [-0.15, 0, -0.14]],
        animate(t, speed) { gait(q.legs, t * 0.6, speed, 0.32); q.body.position.y = speed ? Math.abs(Math.sin(t * 4.8 * speed)) * 0.006 : 0; if (q.trunk) q.trunk.rotation.z = Math.sin(t * 2.5) * 0.25; },
        strike(p) { const k = Math.sin(Math.min(1, p) * Math.PI); q.body.rotation.z = k * 0.35; if (q.trunk) q.trunk.rotation.z = -k * 1.6; },
      };
    }
    case 'wagon': { // Sumerian four-wheeled battle wagon drawn by onagers (Standard of Ur)
      const b = new Builder(color);
      const cart = b.pivot([0, 0, 0]);
      const wheels: THREE.Object3D[] = [];
      for (const [x, z] of [[0.07, 0.07], [0.07, -0.07], [-0.07, 0.07], [-0.07, -0.07]]) {
        const w = b.pivot([x, 0.045, z], cart);
        const g = cyl(0.045, 0.045, 0.012, 14); g.rotateX(Math.PI / 2);
        b.add(g, [0, 0, 0], [0, 0, 0], w);
        b.add(box(0.09, 0.006, 0.013), [0, 0, 0], [0, 0, 0], w, false); // solid plank wheel seam
        wheels.push(w);
      }
      b.add(box(0.2, 0.02, 0.12), [0, 0.08, 0], [0, 0, 0], cart);
      b.add(box(0.03, 0.09, 0.12), [0.1, 0.135, 0], [0, 0, 0], cart); // high front screen
      b.add(box(0.07, 0.006, 0.006), [0.22, 0.13, 0], [0, 0, 0], cart, false); // pole
      b.line3([[0.1, 0.14, 0], [0.27, 0.15, 0]], cart);
      const quiver = cyl(0.008, 0.008, 0.07, 6); b.add(quiver, [0.09, 0.19, 0.05], [0, 0, 0.3], cart, false);
      // Two onagers in harness.
      const animals: ReturnType<typeof quadruped>[] = [];
      for (const z of [0.04, -0.04]) {
        const q = quadruped(color, { len: 0.13, height: 0.14, girth: 0.055, neck: 0.065, head: 0.03, legR: 0.006, ears: true });
        const m = q.b.done('unit');
        b.adopt(m, [0.33, 0, z]);
        m.group.parent!.remove(m.group); cart.add(m.group);
        animals.push(q);
      }
      const s1 = seat(b, cart, [0.03, 0.09, 0.025]);
      const s2 = seat(b, cart, [-0.05, 0.09, -0.025]);
      const model = b.done('unit');
      return {
        model, kind, seats: [s1, s2], flanks: [],
        animate(t, speed) { wheels.forEach((w) => (w.rotation.z = -t * 10 * speed)); animals.forEach((q) => gait(q.legs, t, speed, 0.6)); cart.position.y = speed ? Math.abs(Math.sin(t * 13)) * 0.004 : 0; },
        strike() { /* the crew does the striking */ },
      };
    }
    case 'ram': { // a roofed ram on wheels, pushed by its crew
      const b = new Builder(color);
      const frame = b.pivot([0, 0, 0]);
      const wheels: THREE.Object3D[] = [];
      for (const x of [0.12, -0.12]) for (const z of [0.07, -0.07]) {
        const w = b.pivot([x, 0.035, z], frame);
        const g = cyl(0.035, 0.035, 0.012, 12); g.rotateX(Math.PI / 2);
        b.add(g, [0, 0, 0], [0, 0, 0], w); wheels.push(w);
      }
      b.add(box(0.32, 0.015, 0.15), [0, 0.07, 0], [0, 0, 0], frame);
      for (const x of [0.14, 0.0, -0.14]) for (const z of [0.065, -0.065]) b.add(box(0.012, 0.16, 0.012), [x, 0.15, z], [0, 0, 0], frame, false);
      const roof = prism([[-0.18, 0], [0.18, 0], [0.12, 0.06], [-0.12, 0.06]], 0.16);
      roof.rotateX(0); b.add(roof, [0, 0.23, 0], [0, 0, 0], frame);
      // The beam hangs from ropes and swings.
      const swing = b.pivot([0, 0.22, 0], frame);
      const beam = cyl(0.018, 0.018, 0.42, 8); beam.rotateZ(Math.PI / 2);
      b.add(beam, [0.03, -0.08, 0], [0, 0, 0], swing);
      b.add(sph(0.026, 8, 6), [0.25, -0.08, 0], [0, 0, 0], swing);
      b.line3([[-0.08, 0, 0], [-0.08, -0.08, 0]], swing); b.line3([[0.1, 0, 0], [0.1, -0.08, 0]], swing);
      const model = b.done('unit');
      return {
        model, kind, seats: [], flanks: [[-0.22, 0, 0.04], [-0.2, 0, -0.08], [-0.05, 0, 0.13], [-0.05, 0, -0.13]],
        animate(t, speed) { wheels.forEach((w) => (w.rotation.z = -t * 6 * speed)); swing.position.x = speed ? Math.sin(t * 3) * 0.004 : 0; },
        strike(p) { const k = p < 0.6 ? -p / 0.6 : -1 + (p - 0.6) / 0.4 * 2.2; swing.position.x = Math.max(-1, Math.min(1.2, k)) * 0.06; swing.rotation.z = -swing.position.x * 0.6; },
      };
    }
    case 'galley': case 'trader': {
      const big = kind === 'galley' && civ === 'carthage';
      const b = new Builder(color);
      const ship = b.pivot([0, 0, 0]);
      const L = big ? 0.62 : 0.48;
      const norse = civ === 'norse';
      // A Norse longship is double-ended and shallow, with high curving stems; others have a ram bow and a raised stern.
      const hull = norse
        ? prism([[-L / 2 - 0.03, 0.1], [-L / 2 + 0.06, 0], [L / 2 - 0.06, 0], [L / 2 + 0.03, 0.1], [L / 2 - 0.03, 0.07], [-L / 2 + 0.03, 0.07]], 0.1)
        : prism([[-L / 2, 0.04], [-L / 2 + 0.05, 0], [L / 2 - 0.06, 0], [L / 2, 0.035], [L / 2 + 0.02, 0.08], [L / 2 - 0.05, 0.075], [-L / 2 + 0.04, 0.08], [-L / 2 - 0.02, 0.14]], 0.11);
      b.add(hull, [0, -0.02, 0], [0, 0, 0], ship);
      if (kind === 'galley' && !norse) b.add(cone(0.016, 0.07, 4), [L / 2 + 0.04, 0.0, 0], [0, 0, -Math.PI / 2], ship, false); // bronze ram
      if (norse) {
        // Curling stems fore and aft, and a row of round shields along each rail.
        for (const dir of [1, -1]) b.line3([[dir * (L / 2 + 0.03), 0.08, 0], [dir * (L / 2 + 0.06), 0.14, 0], [dir * (L / 2 + 0.05), 0.19, 0], [dir * (L / 2 + 0.02), 0.2, 0]], ship);
        for (let i = 0; i < 6; i++) for (const side of [1, -1]) {
          const sg = cyl(0.016, 0.016, 0.004, 8); sg.rotateX(Math.PI / 2);
          b.add(sg, [-L / 2 + 0.09 + i * ((L - 0.18) / 5), 0.065, side * 0.052], [0, 0, 0], ship, false);
        }
      }
      b.add(cyl(0.004, 0.004, 0.36, 4), [0, 0.24, 0], [0, 0, 0], ship, false); // mast
      const sail = b.pivot([0, 0.3, 0], ship);
      b.add(box(0.005, 0.15, 0.2), [0, 0, 0], [0, 0, 0], sail);
      b.line3([[-L / 2 + 0.02, 0.1, 0], [0, 0.42, 0], [L / 2 - 0.02, 0.09, 0]], ship);
      if (civ === 'carthage') b.add(sph(0.012, 6, 5), [L / 2 + 0.01, 0.1, 0.056], [0, 0, 0], ship, false); // painted eye
      if (norse) sail.scale.set(1, 1.1, 1.35); // a broad square sail
      const oars: THREE.Object3D[] = [];
      const n = kind === 'trader' ? 3 : big ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + 0.09 + i * ((L - 0.18) / Math.max(1, n - 1));
        for (const side of [1, -1]) {
          const pv = b.pivot([x, 0.06, side * 0.055], ship);
          const og = cyl(0.002, 0.002, 0.15, 3); og.translate(0, -0.075, 0); og.rotateX(side * 1.0);
          b.add(og, [0, 0, 0], [0, 0, 0], pv, false);
          oars.push(pv);
        }
      }
      const seats = [0.12, -0.02, -0.14].map((x) => seat(b, ship, [x * L * 2, 0.0, 0]));
      const model = b.done('unit');
      return {
        model, kind, seats, flanks: [],
        animate(t, speed) {
          oars.forEach((o, i) => { o.rotation.z = Math.sin(t * 4 + (i % 2) * 0) * 0.45 * (speed ? 1 : 0.2); o.rotation.y = Math.cos(t * 4) * 0.15; });
          ship.position.y = Math.sin(t * 2.2) * 0.008; ship.rotation.x = Math.sin(t * 1.7) * 0.03; sail.scale.z = (norse ? 1.35 : 1) * (1 + Math.sin(t * 2) * 0.05);
        },
        strike(p) { ship.rotation.z = Math.sin(Math.min(1, p) * Math.PI) * 0.12; },
      };
    }
    case 'sledge': { // a stone block on a wooden sledge, hauled with ropes (construction scenes)
      const b = new Builder(color);
      const s = b.pivot([0, 0, 0]);
      b.add(box(0.2, 0.015, 0.1), [0, 0.008, 0], [0, 0, 0], s);
      b.add(box(0.14, 0.09, 0.09), [0, 0.06, 0], [0, 0, 0], s);
      b.line3([[0.1, 0.03, 0.03], [0.4, 0.12, 0.05]], s); b.line3([[0.1, 0.03, -0.03], [0.4, 0.12, -0.05]], s);
      const model = b.done('prop');
      return { model, kind, seats: [], flanks: [[0.3, 0, 0.05], [0.4, 0, -0.05], [0.5, 0, 0.05]], animate() { /* dragged */ }, strike() { /* none */ } };
    }
  }
}
