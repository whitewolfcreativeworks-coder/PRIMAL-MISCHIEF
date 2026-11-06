import * as THREE from 'three';
import { holoLineMaterial, holoMaterial, type HoloUniforms } from './material';

/*
 * Shared building blocks for every hologram model (architecture, props,
 * vehicles). A model is a group of parts sharing one hologram material, so
 * it reveals, glitches, heats and fades as one, and can shatter into its
 * parts when destroyed.
 *
 * Conventions: units are scene metres where a person is ~0.3 tall; y is up;
 * ground is y = 0; a model's "front" faces +z (toward the viewer when the
 * stage is not rotated); vehicles and people move along +x.
 */

export interface HoloModel {
  group: THREE.Group;
  uniforms: HoloUniforms;
  parts: THREE.Object3D[];
  height: number;
  kind: 'unit' | 'building' | 'prop';
  dispose: () => void;
}

export type V3 = [number, number, number];

export class Builder {
  group = new THREE.Group();
  parts: THREE.Object3D[] = [];
  readonly mat;
  readonly line;
  private geoms: THREE.BufferGeometry[] = [];
  private extra: (() => void)[] = [];
  constructor(color: THREE.ColorRepresentation) {
    this.mat = holoMaterial(color);
    this.line = holoLineMaterial(this.mat.uniforms);
  }
  /** Add a solid part (with glowing edges unless edges=false). Top-level parts are what shatter() scatters. */
  add(geo: THREE.BufferGeometry, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], parent?: THREE.Object3D, edges = true) {
    const part = new THREE.Group();
    part.add(new THREE.Mesh(geo, this.mat));
    this.geoms.push(geo);
    if (edges) {
      const eg = new THREE.EdgesGeometry(geo, 28);
      this.geoms.push(eg);
      part.add(new THREE.LineSegments(eg, this.line));
    }
    part.position.set(...pos);
    part.rotation.set(...rot);
    (parent ?? this.group).add(part);
    if (!parent) this.parts.push(part);
    return part;
  }
  /** A bare glowing line (spear shafts, ropes, oars, masts). */
  line3(points: V3[], parent?: THREE.Object3D) {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    this.geoms.push(geo);
    const l = new THREE.Line(geo, this.line);
    (parent ?? this.group).add(l);
    if (!parent) this.parts.push(l);
    return l;
  }
  /** An empty pivot (for things that animate: doors, wheels, flags). */
  pivot(pos: V3 = [0, 0, 0], parent?: THREE.Object3D) {
    const g = new THREE.Group();
    g.position.set(...pos);
    (parent ?? this.group).add(g);
    if (!parent) this.parts.push(g);
    return g;
  }
  /** Absorb another model: it shares this model's material and is disposed with it. */
  adopt(m: HoloModel, pos?: V3, scale?: number) {
    m.group.traverse((o) => {
      const any = o as THREE.Mesh & THREE.Line;
      if (any.isMesh) any.material = this.mat;
      else if (any.isLine) any.material = this.line;
    });
    if (pos) m.group.position.set(...pos);
    if (scale) m.group.scale.setScalar(scale);
    this.extra.push(m.dispose);
    this.group.add(m.group);
    this.parts.push(m.group);
    return m.group;
  }
  done(kind: HoloModel['kind']): HoloModel {
    const bb = new THREE.Box3().setFromObject(this.group);
    return {
      group: this.group, uniforms: this.mat.uniforms, parts: this.parts, height: Math.max(0.1, bb.max.y), kind,
      dispose: () => { this.geoms.forEach((g) => g.dispose()); this.extra.forEach((d) => d()); this.mat.dispose(); this.line.dispose(); },
    };
  }
}

// ---------------------------------------------------------------- primitives

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sph = (r: number, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
export const dome = (r: number, seg = 12) => new THREE.SphereGeometry(r, seg, 6, 0, Math.PI * 2, 0, Math.PI / 2);
export const pyr = (r: number, h: number) => new THREE.ConeGeometry(r, h, 4);
export const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const torus = (r: number, tube: number, arc = Math.PI * 2, seg = 24) => new THREE.TorusGeometry(r, tube, 5, seg, arc);
/** A prism from a 2D outline (in the x-y plane), extruded along z by depth, centred on z. */
export function prism(points: [number, number][], depth: number) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}
/** Trapezoid outline (Inca doorways, Kush pylons), base width wb, top width wt, height h. */
export const trapezoid = (wb: number, wt: number, h: number): [number, number][] => [[-wb / 2, 0], [wb / 2, 0], [wt / 2, h], [-wt / 2, h]];

/** Deterministic random numbers for layouts (same city every time). */
export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
