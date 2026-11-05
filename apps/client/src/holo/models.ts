import * as THREE from 'three';
import { holoLineMaterial, holoMaterial, type HoloUniforms } from './material';

/*
 * Procedural hologram miniatures. Each model is assembled from simple
 * primitives so it stays light on iPad GPUs and so it can fracture into
 * its parts when destroyed. Silhouettes follow the same historical
 * references as the card art (see docs/HISTORY_NOTES.md).
 */

export interface HoloModel {
  group: THREE.Group;
  uniforms: HoloUniforms;
  parts: THREE.Object3D[];
  height: number;
  kind: 'unit' | 'building' | 'prop';
  dispose: () => void;
}

class Builder {
  group = new THREE.Group();
  parts: THREE.Object3D[] = [];
  private mat;
  private line;
  private geoms: THREE.BufferGeometry[] = [];
  constructor(color: THREE.ColorRepresentation) {
    this.mat = holoMaterial(color);
    this.line = holoLineMaterial(this.mat.uniforms);
  }
  add(geo: THREE.BufferGeometry, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], parent?: THREE.Object3D, edges = true) {
    const part = new THREE.Group();
    const mesh = new THREE.Mesh(geo, this.mat);
    part.add(mesh);
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
  /** A bare line (spear shafts, bowstrings, oars). */
  line3(points: [number, number, number][], parent?: THREE.Object3D) {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    this.geoms.push(geo);
    const l = new THREE.Line(geo, this.line);
    (parent ?? this.group).add(l);
    if (!parent) this.parts.push(l);
    return l;
  }
  private extra: (() => void)[] = [];
  /** Absorb another model: it shares this model's material (so it reveals and fades together) and is disposed with it. */
  adopt(m: HoloModel) {
    m.group.traverse((o) => {
      const any = o as THREE.Mesh & THREE.Line;
      if (any.isMesh) any.material = this.mat;
      else if (any.isLine) any.material = this.line;
    });
    this.extra.push(m.dispose);
    this.group.add(m.group);
    this.parts.push(m.group);
  }
  done(kind: HoloModel['kind']): HoloModel {
    const box = new THREE.Box3().setFromObject(this.group);
    return {
      group: this.group, uniforms: this.mat.uniforms, parts: this.parts, height: Math.max(0.1, box.max.y), kind,
      dispose: () => { this.geoms.forEach((g) => g.dispose()); this.extra.forEach((d) => d()); this.mat.dispose(); this.line.dispose(); },
    };
  }
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r: number) => new THREE.SphereGeometry(r, 10, 8);
const pyr = (r: number, h: number) => new THREE.ConeGeometry(r, h, 4);

// ----------------------------------------------------------------- figures

function figure(b: Builder, parent: THREE.Object3D, opts: { weapon?: 'spear' | 'bow' | 'sling' | 'staff'; shield?: boolean; crown?: boolean } = {}) {
  b.add(cyl(0.035, 0.06, 0.2), [0, 0.12, 0], [0, 0, 0], parent); // body
  b.add(sph(0.035), [0, 0.255, 0], [0, 0, 0], parent, false); // head
  b.add(cyl(0.015, 0.015, 0.1, 6), [-0.02, 0.0, 0], [0, 0, 0.1], parent, false); // legs
  b.add(cyl(0.015, 0.015, 0.1, 6), [0.02, 0.0, 0], [0, 0, -0.1], parent, false);
  if (opts.crown) b.add(cyl(0.02, 0.03, 0.06, 8), [0, 0.3, 0], [0, 0, 0], parent, false);
  if (opts.weapon === 'spear') b.line3([[0.07, 0.02, 0.0], [0.07, 0.42, 0.0]], parent), b.add(pyr(0.015, 0.04), [0.07, 0.44, 0], [0, 0, 0], parent, false);
  if (opts.weapon === 'staff') b.line3([[0.06, 0.02, 0.0], [0.06, 0.38, 0.0]], parent);
  if (opts.weapon === 'bow') {
    const arc = new THREE.TorusGeometry(0.09, 0.006, 4, 12, Math.PI);
    b.add(arc, [0.07, 0.17, 0], [0, 0, -Math.PI / 2], parent, false);
    b.line3([[0.07, 0.08, 0], [0.07, 0.26, 0]], parent);
  }
  if (opts.weapon === 'sling') {
    const ring = new THREE.TorusGeometry(0.08, 0.005, 4, 16);
    b.add(ring, [0, 0.36, 0], [Math.PI / 2, 0, 0], parent, false);
  }
  if (opts.shield) b.add(cyl(0.06, 0.06, 0.012, 14), [-0.05, 0.13, 0.03], [0, 0, Math.PI / 2], parent);
}

function horse(b: Builder, parent: THREE.Object3D) {
  b.add(new THREE.CapsuleGeometry(0.045, 0.16, 3, 8), [0, 0.15, 0], [0, 0, Math.PI / 2], parent);
  b.add(new THREE.CapsuleGeometry(0.025, 0.08, 3, 6), [0.12, 0.22, 0], [0, 0, -0.7], parent, false);
  for (const [x, z] of [[-0.07, -0.025], [-0.07, 0.025], [0.07, -0.025], [0.07, 0.025]]) b.line3([[x, 0.12, z], [x, 0, z]], parent);
}

function wheel(b: Builder, parent: THREE.Object3D, x: number, z: number, r = 0.05) {
  b.add(cyl(r, r, 0.015, 12), [x, r, z], [Math.PI / 2, 0, 0], parent);
}

// ----------------------------------------------------------------- units

function unitModel(arch: string, color: THREE.ColorRepresentation): HoloModel {
  const b = new Builder(color);
  const root = b.add(new THREE.BufferGeometry(), [0, 0, 0], [0, 0, 0], undefined, false);
  switch (arch) {
    case 'archer': figure(b, root, { weapon: 'bow' }); break;
    case 'slinger': figure(b, root, { weapon: 'sling' }); break;
    case 'cavalry': {
      horse(b, root);
      const rider = new THREE.Group(); rider.position.set(0, 0.16, 0); rider.scale.setScalar(0.8); root.add(rider);
      figure(b, rider, { weapon: 'spear' });
      break;
    }
    case 'ram': {
      b.add(box(0.34, 0.14, 0.16), [0, 0.16, 0], [0, 0, 0], root);
      b.add(pyr(0.17, 0.1), [0, 0.28, 0], [0, Math.PI / 4, 0], root);
      b.add(cyl(0.025, 0.035, 0.42, 8), [0.06, 0.12, 0], [0, 0, Math.PI / 2], root);
      wheel(b, root, -0.11, 0.09); wheel(b, root, 0.11, 0.09); wheel(b, root, -0.11, -0.09); wheel(b, root, 0.11, -0.09);
      break;
    }
    case 'wagon': {
      b.add(box(0.2, 0.1, 0.14), [-0.05, 0.12, 0], [0, 0, 0], root);
      wheel(b, root, -0.12, 0.08, 0.055); wheel(b, root, 0.02, 0.08, 0.055); wheel(b, root, -0.12, -0.08, 0.055); wheel(b, root, 0.02, -0.08, 0.055);
      const d = new THREE.Group(); d.scale.setScalar(0.7); d.position.set(-0.07, 0.12, 0); root.add(d);
      figure(b, d, { weapon: 'spear' });
      const h = new THREE.Group(); h.scale.setScalar(0.75); h.position.set(0.17, 0, 0); root.add(h);
      horse(b, h);
      break;
    }
    case 'ship': {
      const hull = new THREE.Shape();
      hull.moveTo(-0.28, 0.08); hull.quadraticCurveTo(-0.2, 0, 0, 0); hull.lineTo(0.22, 0); hull.lineTo(0.34, 0.05); hull.lineTo(0.2, 0.08); hull.lineTo(-0.28, 0.08);
      const g = new THREE.ExtrudeGeometry(hull, { depth: 0.1, bevelEnabled: false });
      g.translate(0, 0.02, -0.05);
      b.add(g, [0, 0, 0], [0, 0, 0], root);
      b.line3([[0, 0.1, 0], [0, 0.46, 0]], root);
      b.add(new THREE.PlaneGeometry(0.22, 0.2), [0.0, 0.32, 0.01], [0, 0, 0], root);
      for (let i = -3; i <= 3; i++) b.line3([[i * 0.06, 0.05, 0.06], [i * 0.06 - 0.03, -0.02, 0.14]], root);
      break;
    }
    default: figure(b, root, { weapon: 'spear', shield: true });
  }
  return b.done('unit');
}

// ----------------------------------------------------------------- buildings

function buildingModel(arch: string, color: THREE.ColorRepresentation): HoloModel {
  const b = new Builder(color);
  switch (arch) {
    case 'pyramids':
      b.add(pyr(0.2, 0.62), [0, 0.31, 0], [0, Math.PI / 4, 0]);
      b.add(pyr(0.14, 0.44), [-0.32, 0.22, 0.1], [0, Math.PI / 4, 0]);
      b.add(pyr(0.12, 0.38), [0.3, 0.19, -0.05], [0, Math.PI / 4, 0]);
      b.add(box(0.12, 0.1, 0.06), [0, 0.05, 0.22]); // offering chapel
      break;
    case 'ziggurat':
      b.add(box(0.7, 0.16, 0.5), [0, 0.08, 0]);
      b.add(box(0.5, 0.15, 0.36), [0, 0.235, 0]);
      b.add(box(0.3, 0.14, 0.22), [0, 0.38, 0]);
      b.add(box(0.12, 0.1, 0.1), [0, 0.5, 0]);
      b.add(box(0.08, 0.02, 0.36), [0, 0.2, 0.3], [-0.6, 0, 0]); // central stair
      break;
    case 'stele':
      b.add(box(0.16, 0.9, 0.08), [0, 0.45, 0]);
      b.add(cyl(0.08, 0.08, 0.08, 16), [0, 0.9, 0], [Math.PI / 2, 0, 0]);
      for (let i = 1; i <= 5; i++) b.add(box(0.17, 0.015, 0.085), [0, i * 0.15, 0], [0, 0, 0], undefined, false);
      b.add(box(0.05, 0.08, 0.01), [0, 0.06, 0.045]);
      b.add(box(0.36, 0.04, 0.26), [0, 0.02, 0]);
      break;
    case 'temple':
      b.add(box(0.56, 0.08, 0.36), [0, 0.04, 0]);
      for (let i = 0; i < 5; i++) b.add(cyl(0.025, 0.025, 0.3, 8), [-0.22 + i * 0.11, 0.23, 0.12]);
      b.add(box(0.4, 0.2, 0.2), [0, 0.18, -0.04]);
      b.add(box(0.58, 0.05, 0.38), [0, 0.405, 0]);
      b.add(pyr(0.3, 0.12), [0, 0.49, 0], [0, Math.PI / 4, 0]);
      break;
    case 'pylon':
      b.add(cyl(0.1, 0.14, 0.44, 4), [-0.18, 0.22, 0], [0, Math.PI / 4, 0]);
      b.add(cyl(0.1, 0.14, 0.44, 4), [0.18, 0.22, 0], [0, Math.PI / 4, 0]);
      b.add(box(0.16, 0.28, 0.12), [0, 0.14, 0]);
      b.add(box(0.12, 0.08, 0.2), [0, 0.04, 0.24]); // seated lion plinth
      b.add(sph(0.045), [0.02, 0.12, 0.26]);
      break;
    case 'walls': {
      b.add(box(0.9, 0.26, 0.1), [0, 0.13, 0]);
      for (let i = 0; i < 9; i++) b.add(box(0.06, 0.06, 0.11), [-0.4 + i * 0.1, 0.29, 0], [0, 0, 0], undefined, false);
      b.add(box(0.16, 0.38, 0.16), [-0.45, 0.19, 0]);
      b.add(box(0.16, 0.38, 0.16), [0.45, 0.19, 0]);
      b.add(box(0.12, 0.16, 0.12), [0, 0.08, 0.02]);
      break;
    }
    case 'farm':
      b.add(box(0.7, 0.02, 0.42), [0, 0.01, 0]);
      for (let i = 0; i < 6; i++) b.line3([[-0.33, 0.03, -0.18 + i * 0.07], [0.33, 0.03, -0.18 + i * 0.07]]);
      for (let i = 0; i < 4; i++) b.add(new THREE.ConeGeometry(0.04, 0.14, 6), [-0.24 + i * 0.16, 0.08, 0.14]);
      break;
    case 'terraces':
      for (let i = 0; i < 4; i++) b.add(cyl(0.48 - i * 0.1, 0.5 - i * 0.1, 0.09, 18), [0, 0.045 + i * 0.09, 0]);
      break;
    case 'granary':
      for (const x of [-0.18, 0, 0.18]) { b.add(cyl(0.08, 0.09, 0.26, 12), [x, 0.13, 0]); b.add(new THREE.SphereGeometry(0.08, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [x, 0.26, 0]); }
      break;
    case 'quarry':
      b.add(box(0.6, 0.12, 0.36), [0, 0.06, 0]);
      b.add(box(0.44, 0.12, 0.26), [-0.06, 0.18, -0.04]);
      b.add(box(0.26, 0.12, 0.16), [-0.1, 0.3, -0.06]);
      b.add(box(0.1, 0.08, 0.08), [0.24, 0.16, 0.12]);
      break;
    case 'road':
      for (let i = 0; i < 6; i++) b.add(box(0.12, 0.02, 0.2), [-0.36 + i * 0.145, 0.01, 0]);
      b.add(cyl(0.025, 0.03, 0.18, 6), [-0.42, 0.09, 0.16]);
      b.add(cyl(0.025, 0.03, 0.18, 6), [0.42, 0.09, 0.16]);
      break;
    case 'market':
      for (const x of [-0.24, 0, 0.24]) { b.add(box(0.18, 0.1, 0.16), [x, 0.05, 0]); b.add(box(0.22, 0.015, 0.22), [x, 0.2, 0.02], [0.25, 0, 0]); b.line3([[x - 0.1, 0, 0.12], [x - 0.1, 0.2, 0.12]]); b.line3([[x + 0.1, 0, 0.12], [x + 0.1, 0.2, 0.12]]); }
      break;
    case 'harbor':
      b.add(new THREE.TorusGeometry(0.34, 0.035, 6, 28, Math.PI * 1.7), [0, 0.03, 0], [Math.PI / 2, 0, 0.6]);
      b.add(cyl(0.1, 0.12, 0.08, 16), [0, 0.04, 0]);
      b.add(box(0.06, 0.24, 0.06), [0, 0.2, 0]);
      b.add(box(0.2, 0.05, 0.08), [0.18, 0.03, 0.1]); // small hull
      break;
    case 'furnace':
      b.add(cyl(0.07, 0.12, 0.34, 10), [-0.14, 0.17, 0]);
      b.add(cyl(0.06, 0.1, 0.28, 10), [0.14, 0.14, 0.04]);
      b.add(new THREE.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0.02, 0, -0.22]); // slag heap
      break;
    case 'mint':
      for (let i = 0; i < 6; i++) b.add(cyl(0.12, 0.12, 0.03, 18), [-0.1 + (i % 2) * 0.01, 0.015 + i * 0.035, 0]);
      b.add(cyl(0.12, 0.12, 0.03, 18), [0.22, 0.12, 0], [0, 0, Math.PI / 2]);
      break;
    case 'canal':
      b.add(box(0.8, 0.02, 0.06), [0, 0.01, 0]);
      b.add(box(0.06, 0.02, 0.5), [-0.2, 0.01, 0]);
      b.add(box(0.06, 0.02, 0.5), [0.2, 0.01, 0]);
      b.add(box(0.12, 0.14, 0.04), [0, 0.07, -0.08]); // sluice
      b.add(new THREE.ConeGeometry(0.06, 0.24, 5), [0.34, 0.12, 0.18]); // palm
      break;
    case 'city':
      [[-0.3, 0.22, 0], [-0.12, 0.34, -0.1], [0.08, 0.26, 0.05], [0.26, 0.4, -0.06], [0.0, 0.5, -0.2], [0.36, 0.18, 0.12]]
        .forEach(([x, h, z]) => b.add(box(0.14, h, 0.14), [x, h / 2, z]));
      break;
    default: // hall: barracks, workshop, archive
      b.add(box(0.5, 0.22, 0.28), [0, 0.11, 0]);
      b.add(pyr(0.3, 0.12), [0, 0.28, 0], [0, Math.PI / 4, 0]);
      b.add(box(0.08, 0.12, 0.02), [0, 0.06, 0.15]);
  }
  return b.done('building');
}

// ----------------------------------------------------------------- mapping

const UNIT_ARCH: Record<string, string> = {
  archers: 'archer', kush_archers: 'archer', inca_slingers: 'slinger', carth_cavalry: 'cavalry',
  ram: 'ram', sumer_wagon: 'wagon', aksum_fleet: 'ship', carth_quinq: 'ship',
};
const BUILDING_ARCH: Record<string, string> = {
  farm: 'farm', inca_terraces: 'terraces', granary: 'granary', inca_qullqa: 'granary', quarry: 'quarry',
  road: 'road', inca_road: 'road', market: 'market', walls: 'walls', sumer_uruk: 'walls', temple: 'temple',
  kush_apedemak: 'pylon', kush_furnace: 'furnace', kush_pyramid: 'pyramids', aksum_stele: 'stele',
  aksum_adulis: 'harbor', carth_cothon: 'harbor', aksum_mint: 'mint', sumer_canals: 'canal', sumer_ziggurat: 'ziggurat',
  city: 'city',
};
export const CIV_MONUMENT: Record<string, string> = {
  kush: 'kush_pyramid', aksum: 'aksum_stele', carthage: 'carth_cothon', sumer: 'sumer_ziggurat', inca: 'inca_terraces',
};

/** A whole settlement for a civilization at a given Age: it visibly grows from huts to a monumental capital. */
export function cityModel(civ: string, age: number, color: THREE.ColorRepresentation): HoloModel {
  const b = new Builder(color);
  let seed = civ.length * 97 + age * 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Dwellings: more, taller and tighter with each Age.
  const n = 4 + age * 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const r = 0.22 + rnd() * (0.18 + age * 0.03);
    const h = 0.05 + rnd() * 0.04 + age * 0.018;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.75;
    if (age === 1 && civ !== 'inca') { b.add(new THREE.ConeGeometry(0.045, 0.08, 7), [x, 0.04, z]); continue; } // huts and tents
    b.add(box(0.07 + rnd() * 0.03, h, 0.07), [x, h / 2, z]);
  }
  if (age >= 2) { // walls or palisade ring
    const ring = new THREE.TorusGeometry(0.5 + age * 0.03, age >= 3 ? 0.03 : 0.015, 4, 40);
    b.add(ring, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
  }
  if (age >= 3) { // a temple or palace at the heart of the city
    b.add(box(0.2, 0.12, 0.14), [0.0, 0.06, 0.12]);
    b.add(pyr(0.14, 0.07), [0.0, 0.155, 0.12], [0, Math.PI / 4, 0]);
  }
  if (age >= 4) { // the civilization's signature monument
    const mon = buildingModel(BUILDING_ARCH[CIV_MONUMENT[civ]] ?? 'temple', color);
    mon.group.scale.setScalar(age === 5 ? 0.62 : 0.45);
    mon.group.position.set(0, 0, -0.18);
    b.adopt(mon);
  }
  if (age === 5) { // golden age banners
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.line3([[Math.cos(a) * 0.6, 0, Math.sin(a) * 0.45], [Math.cos(a) * 0.6, 0.32, Math.sin(a) * 0.45]]); }
  }
  return b.done('building');
}

export function modelFor(cardId: string, color: THREE.ColorRepresentation, kind: 'unit' | 'building'): HoloModel {
  return kind === 'unit' ? unitModel(UNIT_ARCH[cardId] ?? 'infantry', color) : buildingModel(BUILDING_ARCH[cardId] ?? 'hall', color);
}
