import * as THREE from 'three';
import type { CivId } from '@pm/engine';
import { holoLineMaterial, holoMaterial, type HoloUniforms } from './material';

/*
 * Hologram people. Each figure is a small articulated body (hips, spine,
 * neck, shoulders, elbows, hips, knees) built from shared primitives and
 * driven by a library of procedural poses: walking, fighting, shooting,
 * building, celebrating, falling. Every civilization dresses and arms its
 * people its own way (see OUTFITS). A figure stands ~0.3 tall and faces +x.
 *
 * Joint convention: rotation.z > 0 swings a hanging limb forward (+x);
 * a negative spine rotation.z leans the torso forward.
 */

// ---------------------------------------------------------------- outfits

export type Weapon = 'spear' | 'bow' | 'sling' | 'mace' | 'sword' | 'club' | 'javelin' | 'torch' | 'staff' | 'hammer' | 'axe' | 'oar' | 'none';
export type ShieldKind = 'none' | 'round' | 'oval' | 'tall' | 'small' | 'square';
export type HeadKind = 'bare' | 'cap' | 'crest' | 'helmet' | 'headband' | 'crown' | 'hood' | 'turban' | 'wrap';
export type Garment = 'kilt' | 'tunic' | 'robe' | 'fleece' | 'unku' | 'wrap';

export interface Outfit {
  head: HeadKind;
  garment: Garment;
  weapon: Weapon;
  shield: ShieldKind;
  quiver?: boolean;
  cloak?: boolean;
  /** Carried load drawn on the shoulder (workers, raiders). */
  load?: 'sack' | 'block' | 'jar' | 'basket';
}

export type Role =
  | 'infantry' | 'elite' | 'militia' | 'archer' | 'slinger' | 'mercenary' | 'rider' | 'driver' | 'rower' | 'marine'
  | 'worker' | 'carrier' | 'mason' | 'farmer' | 'scribe' | 'artisan' | 'merchant' | 'envoy' | 'ruler' | 'priest'
  | 'sentry' | 'saboteur' | 'raider' | 'runner' | 'dancer' | 'citizen' | 'torchbearer';

/** Who carries what, civilization by civilization (grounded in surviving depictions; simplified). */
export const OUTFITS: Record<CivId, Partial<Record<Role, Partial<Outfit>>> & { base: Outfit }> = {
  kush: {
    base: { head: 'bare', garment: 'kilt', weapon: 'none', shield: 'none' },
    infantry: { head: 'cap', weapon: 'spear', shield: 'oval' },
    elite: { head: 'helmet', weapon: 'spear', shield: 'oval', cloak: true },
    archer: { head: 'headband', weapon: 'bow', quiver: true },
    ruler: { head: 'crown', garment: 'robe', weapon: 'staff', cloak: true },
  },
  aksum: {
    base: { head: 'bare', garment: 'tunic', weapon: 'none', shield: 'none' },
    infantry: { head: 'headband', weapon: 'spear', shield: 'round' },
    elite: { head: 'helmet', weapon: 'spear', shield: 'round', cloak: true },
    archer: { head: 'headband', weapon: 'bow', quiver: true },
    ruler: { head: 'crown', garment: 'robe', weapon: 'staff', cloak: true },
  },
  carthage: {
    base: { head: 'bare', garment: 'tunic', weapon: 'none', shield: 'none' },
    infantry: { head: 'crest', weapon: 'spear', shield: 'oval' },
    elite: { head: 'crest', weapon: 'spear', shield: 'round', cloak: true },
    mercenary: { head: 'helmet', weapon: 'sword', shield: 'oval' },
    rider: { head: 'bare', weapon: 'javelin', shield: 'small' },
    archer: { head: 'cap', weapon: 'bow', quiver: true },
    ruler: { head: 'turban', garment: 'robe', weapon: 'staff', cloak: true },
  },
  sumer: {
    base: { head: 'bare', garment: 'fleece', weapon: 'none', shield: 'none' },
    infantry: { head: 'helmet', weapon: 'spear', shield: 'tall', cloak: true },
    elite: { head: 'helmet', weapon: 'axe', shield: 'tall', cloak: true },
    archer: { head: 'cap', weapon: 'bow', quiver: true },
    driver: { head: 'helmet', weapon: 'javelin' },
    ruler: { head: 'helmet', garment: 'fleece', weapon: 'axe', cloak: true },
  },
  inca: {
    base: { head: 'headband', garment: 'unku', weapon: 'none', shield: 'none' },
    infantry: { head: 'helmet', weapon: 'mace', shield: 'square' },
    elite: { head: 'helmet', weapon: 'mace', shield: 'square', cloak: true },
    archer: { head: 'headband', weapon: 'sling' },
    slinger: { head: 'headband', weapon: 'sling' },
    ruler: { head: 'crown', garment: 'unku', weapon: 'staff', cloak: true },
  },
};

const ROLE_BASE: Partial<Record<Role, Partial<Outfit>>> = {
  militia: { weapon: 'club' },
  slinger: { weapon: 'sling', head: 'headband' },
  mercenary: { head: 'helmet', weapon: 'sword', shield: 'oval' },
  rider: { weapon: 'spear', shield: 'small' },
  driver: { weapon: 'javelin' },
  rower: { weapon: 'oar' },
  marine: { head: 'helmet', weapon: 'spear', shield: 'round' },
  worker: { weapon: 'hammer' },
  carrier: { load: 'block' },
  mason: { weapon: 'hammer' },
  farmer: { load: 'basket' },
  merchant: { garment: 'robe', load: 'jar' },
  envoy: { garment: 'robe', weapon: 'staff' },
  priest: { garment: 'robe', head: 'cap' },
  sentry: { weapon: 'spear', head: 'cap' },
  saboteur: { head: 'hood', garment: 'tunic', weapon: 'axe', cloak: true },
  raider: { head: 'hood', weapon: 'club', load: 'sack' },
  torchbearer: { head: 'hood', weapon: 'torch' },
  runner: { garment: 'kilt' },
  dancer: { garment: 'robe' },
  scribe: { garment: 'robe' },
  artisan: { weapon: 'hammer' },
};

export function outfitFor(civ: CivId, role: Role): Outfit {
  const o = OUTFITS[civ];
  return { ...o.base, ...(ROLE_BASE[role] ?? {}), ...(o[role] ?? {}) } as Outfit;
}

// ---------------------------------------------------------------- shared geometry

const G = (() => {
  const c = (rt: number, rb: number, h: number, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
  const limb = (r1: number, r2: number, len: number) => { const g = c(r1, r2, len, 6); g.translate(0, -len / 2, 0); return g; };
  return {
    pelvis: new THREE.BoxGeometry(0.03, 0.03, 0.05),
    torso: (() => { const g = c(0.03, 0.022, 0.09, 8); g.translate(0, 0.045, 0); g.scale(0.8, 1, 1.15); return g; })(),
    head: new THREE.SphereGeometry(0.021, 10, 8),
    upperArm: limb(0.0105, 0.009, 0.055),
    foreArm: limb(0.009, 0.0075, 0.05),
    thigh: limb(0.013, 0.011, 0.07),
    shin: limb(0.011, 0.009, 0.07),
    foot: (() => { const g = new THREE.BoxGeometry(0.03, 0.01, 0.016); g.translate(0.008, 0, 0); return g; })(),
    kilt: (() => { const g = c(0.026, 0.04, 0.045, 10); g.translate(0, -0.012, 0); return g; })(),
    tunic: (() => { const g = c(0.03, 0.045, 0.075, 10); g.translate(0, -0.028, 0); return g; })(),
    robe: (() => { const g = c(0.03, 0.055, 0.13, 10); g.translate(0, -0.058, 0); return g; })(),
    unku: (() => { const g = new THREE.BoxGeometry(0.05, 0.08, 0.062); g.translate(0, -0.02, 0); return g; })(),
    fleece: (() => { const parts = [c(0.026, 0.034, 0.022, 10), c(0.033, 0.041, 0.022, 10), c(0.04, 0.048, 0.022, 10)]; parts.forEach((p, i) => p.translate(0, -0.005 - i * 0.022, 0)); return parts; })(),
    cloak: (() => { const g = new THREE.ConeGeometry(0.045, 0.12, 8, 1, true, Math.PI * 0.5, Math.PI); g.translate(-0.006, 0.03, 0); return g; })(),
    cap: new THREE.SphereGeometry(0.023, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    helmet: (() => { const g = new THREE.SphereGeometry(0.025, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); return g; })(),
    crest: (() => { const g = new THREE.BoxGeometry(0.05, 0.022, 0.006); g.translate(-0.004, 0.03, 0); return g; })(),
    band: new THREE.TorusGeometry(0.022, 0.0035, 4, 14),
    crown: (() => { const g = c(0.016, 0.022, 0.05, 10); g.translate(0, 0.03, 0); return g; })(),
    turban: (() => { const g = new THREE.TorusGeometry(0.02, 0.008, 6, 14); return g; })(),
    hood: (() => { const g = new THREE.ConeGeometry(0.028, 0.06, 8); g.translate(-0.004, 0.012, 0); return g; })(),
    shieldRound: (() => { const g = c(0.042, 0.042, 0.005, 16); g.rotateZ(Math.PI / 2); return g; })(),
    shieldSmall: (() => { const g = c(0.03, 0.03, 0.005, 14); g.rotateZ(Math.PI / 2); return g; })(),
    shieldOval: (() => { const g = c(0.04, 0.04, 0.005, 16); g.rotateZ(Math.PI / 2); g.scale(1, 1.55, 0.95); return g; })(),
    shieldTall: new THREE.BoxGeometry(0.006, 0.13, 0.07),
    shieldSquare: new THREE.BoxGeometry(0.006, 0.055, 0.055),
    shaft: (() => { const g = c(0.0025, 0.0025, 1, 4); return g; })(),
    tip: new THREE.ConeGeometry(0.007, 0.022, 4),
    maceHead: new THREE.OctahedronGeometry(0.014, 0),
    blade: new THREE.BoxGeometry(0.004, 0.055, 0.012),
    axeHead: new THREE.BoxGeometry(0.004, 0.02, 0.026),
    hammerHead: new THREE.BoxGeometry(0.025, 0.014, 0.014),
    bow: new THREE.TorusGeometry(0.06, 0.003, 3, 14, Math.PI * 0.9),
    quiver: (() => { const g = c(0.009, 0.007, 0.06, 6); return g; })(),
    sack: new THREE.SphereGeometry(0.025, 8, 6),
    blockLoad: new THREE.BoxGeometry(0.045, 0.03, 0.035),
    jar: (() => { const g = new THREE.SphereGeometry(0.018, 8, 6); g.scale(1, 1.3, 1); return g; })(),
    basket: (() => { const g = c(0.024, 0.018, 0.022, 8); return g; })(),
    flame: new THREE.ConeGeometry(0.012, 0.035, 6),
    oarBlade: new THREE.BoxGeometry(0.004, 0.05, 0.016),
  };
})();
const EDGES = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
const edgesOf = (g: THREE.BufferGeometry) => { let e = EDGES.get(g); if (!e) { e = new THREE.EdgesGeometry(g, 30); EDGES.set(g, e); } return e; };

// ---------------------------------------------------------------- the figure

export interface Pose {
  lean?: number; // whole-body forward lean (+ = forward)
  bob?: number; // vertical offset
  sit?: number; // 0..1 lowers hips into a seated/kneeling height
  spine?: number; // torso bend (+ = forward)
  twist?: number; // torso turn (around y)
  neck?: number;
  shL?: number; shR?: number; // shoulder swing (+ forward)
  shLx?: number; shRx?: number; // shoulder out to the side (+ = away from body)
  elL?: number; elR?: number; // elbow bend (+ = forearm forward/up)
  hipL?: number; hipR?: number; // thigh swing (+ forward)
  kneeL?: number; kneeR?: number; // knee bend (+ = shin back)
  gripR?: number; // world angle of the right-hand weapon from vertical (+ toward -x/back, − toward +x/forward)
  gripL?: number;
  shield?: 'side' | 'front' | 'high' | 'back';
  drawn?: number; // bowstring pull 0..1
  slingSpin?: number; // radians: whirling sling
  fallen?: number; // 0..1 topples backward to the ground
}

export class Figure {
  root = new THREE.Group(); // place and face this
  readonly uniforms: HoloUniforms;
  readonly outfit: Outfit;
  private mat: THREE.ShaderMaterial;
  private line: THREE.ShaderMaterial;
  private bobG = new THREE.Group();
  private pelvis = new THREE.Group();
  private spine = new THREE.Group();
  private neck = new THREE.Group();
  private shL = new THREE.Group(); private shR = new THREE.Group();
  private elL = new THREE.Group(); private elR = new THREE.Group();
  private hdL = new THREE.Group(); private hdR = new THREE.Group();
  private hipL = new THREE.Group(); private hipR = new THREE.Group();
  private knL = new THREE.Group(); private knR = new THREE.Group();
  private gripR = new THREE.Group(); private gripL = new THREE.Group();
  private shieldG = new THREE.Group();
  private bowString: THREE.Line | null = null;
  private slingG: THREE.Group | null = null;
  private flame: THREE.Mesh | null = null;
  height = 0.3;

  constructor(color: THREE.ColorRepresentation, outfit: Outfit) {
    this.outfit = outfit;
    this.mat = holoMaterial(color);
    this.uniforms = this.mat.uniforms as unknown as HoloUniforms;
    this.line = holoLineMaterial(this.uniforms);
    const mesh = (g: THREE.BufferGeometry, parent: THREE.Object3D, edges = false, pos?: [number, number, number]) => {
      const m = new THREE.Mesh(g, this.mat);
      if (pos) m.position.set(...pos);
      parent.add(m);
      if (edges) { const l = new THREE.LineSegments(edgesOf(g), this.line); if (pos) l.position.set(...pos); parent.add(l); }
      return m;
    };
    this.root.add(this.bobG);
    this.bobG.add(this.pelvis);
    this.pelvis.position.y = 0.14;
    mesh(G.pelvis, this.pelvis);
    // legs
    for (const [hip, knee, z] of [[this.hipL, this.knL, -0.014], [this.hipR, this.knR, 0.014]] as const) {
      hip.position.set(0, -0.006, z);
      this.pelvis.add(hip);
      mesh(G.thigh, hip);
      knee.position.y = -0.07;
      hip.add(knee);
      mesh(G.shin, knee);
      mesh(G.foot, knee, false, [0, -0.072, 0]);
    }
    // garment
    if (outfit.garment === 'fleece') G.fleece.forEach((g) => mesh(g, this.pelvis, true));
    else mesh(outfit.garment === 'kilt' ? G.kilt : outfit.garment === 'robe' ? G.robe : outfit.garment === 'unku' ? G.unku : G.tunic, this.pelvis, true);
    // torso and head
    this.spine.position.y = 0.012;
    this.pelvis.add(this.spine);
    mesh(G.torso, this.spine, true);
    if (outfit.cloak) mesh(G.cloak, this.spine, false, [-0.01, 0.02, 0]);
    this.neck.position.y = 0.092;
    this.spine.add(this.neck);
    mesh(G.head, this.neck, false, [0, 0.022, 0]);
    this.buildHead(outfit.head, mesh);
    if (outfit.quiver) { const q = mesh(G.quiver, this.spine, false, [-0.026, 0.055, -0.01]); q.rotation.z = 0.5; }
    // arms
    for (const [sh, el, hd, z] of [[this.shL, this.elL, this.hdL, -0.036], [this.shR, this.elR, this.hdR, 0.036]] as const) {
      sh.position.set(0, 0.084, z);
      this.spine.add(sh);
      mesh(G.upperArm, sh);
      el.position.y = -0.055;
      sh.add(el);
      mesh(G.foreArm, el);
      hd.position.y = -0.05;
      el.add(hd);
    }
    this.hdR.add(this.gripR);
    this.hdL.add(this.gripL);
    this.buildWeapon(outfit.weapon, mesh);
    this.buildShield(outfit.shield, mesh);
    if (outfit.load) {
      const g = outfit.load === 'sack' ? G.sack : outfit.load === 'block' ? G.blockLoad : outfit.load === 'jar' ? G.jar : G.basket;
      const holder = new THREE.Group();
      holder.position.set(-0.005, 0.11, outfit.load === 'jar' || outfit.load === 'basket' ? 0 : 0.03);
      this.spine.add(holder);
      mesh(g, holder, true);
      this.loadG = holder;
    }
  }
  private loadG: THREE.Group | null = null;

  private buildHead(head: HeadKind, mesh: (g: THREE.BufferGeometry, p: THREE.Object3D, e?: boolean, pos?: [number, number, number]) => THREE.Mesh) {
    const at: [number, number, number] = [0, 0.026, 0];
    if (head === 'cap') mesh(G.cap, this.neck, true, at);
    if (head === 'helmet' || head === 'crest') mesh(G.helmet, this.neck, true, at);
    if (head === 'crest') mesh(G.crest, this.neck, false, at);
    if (head === 'headband') { const b = mesh(G.band, this.neck, false, [0, 0.028, 0]); b.rotation.x = Math.PI / 2; }
    if (head === 'crown') mesh(G.crown, this.neck, true, [0, 0.026, 0]);
    if (head === 'turban') { const t = mesh(G.turban, this.neck, true, [0, 0.036, 0]); t.rotation.x = Math.PI / 2; }
    if (head === 'hood') mesh(G.hood, this.neck, false, [0, 0.03, 0]);
    if (head === 'wrap') { const b = mesh(G.band, this.neck, false, [0, 0.03, 0]); b.rotation.x = Math.PI / 2; b.scale.setScalar(1.15); }
  }

  private buildWeapon(w: Weapon, mesh: (g: THREE.BufferGeometry, p: THREE.Object3D, e?: boolean, pos?: [number, number, number]) => THREE.Mesh) {
    const shaft = (len: number, parent: THREE.Object3D, from = -0.3) => { const m = mesh(G.shaft, parent); m.scale.y = len; m.position.y = len * (0.5 + from); return m; };
    const g = this.gripR;
    switch (w) {
      case 'spear': shaft(0.32, g); mesh(G.tip, g, false, [0, 0.32 * 0.7 + 0.011, 0]); break;
      case 'javelin': shaft(0.2, g, -0.4); mesh(G.tip, g, false, [0, 0.2 * 0.6 + 0.011, 0]); break;
      case 'staff': shaft(0.3, g, -0.6); break;
      case 'mace': shaft(0.1, g, -0.2); mesh(G.maceHead, g, true, [0, 0.085, 0]); break;
      case 'club': { const m = shaft(0.08, g, -0.1); m.scale.x = m.scale.z = 3; break; }
      case 'sword': mesh(G.blade, g, true, [0, 0.03, 0]); break;
      case 'axe': shaft(0.09, g, -0.2); mesh(G.axeHead, g, true, [0.008, 0.07, 0]); break;
      case 'hammer': shaft(0.07, g, -0.2); mesh(G.hammerHead, g, true, [0, 0.058, 0]); break;
      case 'torch': shaft(0.07, g, -0.2); this.flame = mesh(G.flame, g, false, [0, 0.075, 0]); break;
      case 'oar': shaft(0.24, g, -0.5); mesh(G.oarBlade, g, false, [0, -0.13, 0]); break;
      case 'bow': {
        const bow = mesh(G.bow, this.gripL, false, [0.0, 0, 0]);
        bow.rotation.z = -Math.PI / 2 - Math.PI * 0.45;
        const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.0, 0.057, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.0, -0.057, 0)]);
        this.bowString = new THREE.Line(sg, this.line);
        this.gripL.add(this.bowString);
        break;
      }
      case 'sling': {
        this.slingG = new THREE.Group();
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.07, 0)];
        this.slingG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.line));
        const stone = new THREE.Mesh(G.head, this.mat); stone.scale.setScalar(0.35); stone.position.y = 0.072;
        this.slingG.add(stone);
        g.add(this.slingG);
        break;
      }
    }
  }

  private buildShield(s: ShieldKind, mesh: (g: THREE.BufferGeometry, p: THREE.Object3D, e?: boolean, pos?: [number, number, number]) => THREE.Mesh) {
    if (s === 'none') return;
    const g = s === 'round' ? G.shieldRound : s === 'oval' ? G.shieldOval : s === 'tall' ? G.shieldTall : s === 'small' ? G.shieldSmall : G.shieldSquare;
    this.spine.add(this.shieldG);
    mesh(g, this.shieldG, true);
  }

  /** Apply a pose (unset joints return to neutral). */
  apply(p: Pose) {
    const fallen = p.fallen ?? 0;
    this.bobG.position.y = (p.bob ?? 0) - (p.sit ?? 0) * 0.06;
    this.bobG.rotation.z = -(p.lean ?? 0) * (1 - fallen) + fallen * 1.45;
    this.bobG.position.x = -fallen * 0.12;
    this.spine.rotation.z = -(p.spine ?? 0);
    this.spine.rotation.y = p.twist ?? 0;
    this.neck.rotation.z = -(p.neck ?? 0);
    this.shL.rotation.set(p.shLx ?? 0.08, 0, p.shL ?? 0);
    this.shR.rotation.set(-(p.shRx ?? 0.08), 0, p.shR ?? 0);
    this.elL.rotation.z = p.elL ?? 0.15;
    this.elR.rotation.z = p.elR ?? 0.15;
    this.hipL.rotation.z = p.hipL ?? 0;
    this.hipR.rotation.z = p.hipR ?? 0;
    this.knL.rotation.z = -(p.kneeL ?? 0);
    this.knR.rotation.z = -(p.kneeR ?? 0);
    // Weapons keep a chosen world angle whatever the arm is doing.
    const armR = (p.shR ?? 0) + (p.elR ?? 0.15) - (p.spine ?? 0) - (p.lean ?? 0);
    const armL = (p.shL ?? 0) + (p.elL ?? 0.15) - (p.spine ?? 0) - (p.lean ?? 0);
    if (p.gripR !== undefined) this.gripR.rotation.z = p.gripR - armR;
    else this.gripR.rotation.z = 0.25 - armR * 0.15;
    this.gripL.rotation.z = (p.gripL ?? 0) - armL;
    if (this.bowString) {
      const pull = (p.drawn ?? 0) * 0.05;
      const pos = this.bowString.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setX(1, -pull); pos.needsUpdate = true;
    }
    if (this.slingG) this.slingG.rotation.x = p.slingSpin ?? 0;
    const sh = p.shield ?? 'side';
    const sp = sh === 'front' ? [0.04, 0.05, -0.006, 0] : sh === 'high' ? [0.035, 0.09, -0.01, -0.4] : sh === 'back' ? [-0.03, 0.05, 0, 0] : [0.008, 0.045, -0.042, 0];
    this.shieldG.position.set(sp[0], sp[1], sp[2]);
    this.shieldG.rotation.set(0, sh === 'side' ? -1.2 : 0, sp[3]);
  }

  /** Torch flicker, etc. */
  tick(time: number) {
    if (this.flame) { this.flame.scale.set(1 + 0.2 * Math.sin(time * 31), 1 + 0.35 * Math.sin(time * 23), 1); }
  }

  set load(v: boolean) { if (this.loadG) this.loadG.visible = v; }

  dispose() { this.mat.dispose(); this.line.dispose(); }
}

// ---------------------------------------------------------------- the pose library

export type Act =
  | 'idle' | 'stand' | 'walk' | 'march' | 'run' | 'wade' | 'sneak' | 'flee' | 'charge'
  | 'thrust' | 'swing' | 'shoot' | 'kneelShoot' | 'sling' | 'throw' | 'block' | 'brace'
  | 'push' | 'pull' | 'row' | 'carry' | 'hammer' | 'dig' | 'lift' | 'harvest'
  | 'cheer' | 'dance' | 'bow' | 'command' | 'ride' | 'sit' | 'kneel' | 'stagger' | 'fall' | 'dead' | 'cower' | 'point';

const S = Math.sin;

/**
 * Pose for an action. `t` is scene time (cycles), `p` is progress 0..1 through
 * a one-shot action (strikes, falls), `phase` offsets cycles so a crowd does
 * not move in lockstep.
 */
export function pose(act: Act, t: number, p = 0, phase = 0, w: Weapon = 'none'): Pose {
  const c = t * 9 + phase;
  const hold = w === 'spear' || w === 'staff' || w === 'javelin' ? -0.05 : undefined;
  switch (act) {
    case 'idle': case 'stand':
      return { bob: S(t * 2 + phase) * 0.002, shR: 0.15, elR: 0.6, gripR: hold, shL: 0.05, shield: 'side' };
    case 'walk': case 'march': {
      const a = act === 'march' ? 0.45 : 0.55;
      return { bob: Math.abs(S(c)) * 0.006, hipL: S(c) * a, hipR: -S(c) * a, kneeL: Math.max(0, -S(c + 1)) * 0.9, kneeR: Math.max(0, S(c + 1)) * 0.9,
        shL: -S(c) * 0.35, shR: act === 'march' ? 0.2 : S(c) * 0.35, elR: act === 'march' ? 0.7 : 0.3, gripR: hold, shield: 'side' };
    }
    case 'run': case 'charge': case 'flee': {
      const k = c * 1.6;
      return { lean: 0.25, bob: Math.abs(S(k)) * 0.012, hipL: S(k) * 0.9, hipR: -S(k) * 0.9, kneeL: Math.max(0, -S(k + 1)) * 1.4, kneeR: Math.max(0, S(k + 1)) * 1.4,
        shL: -S(k) * 0.7, shR: act === 'charge' ? 1.2 : S(k) * 0.7, elR: act === 'charge' ? 0.2 : 1, elL: 1, gripR: act === 'charge' ? -1.45 : hold, shield: act === 'charge' ? 'front' : 'side' };
    }
    case 'wade': {
      const k = c * 0.7;
      return { bob: -0.03 + Math.abs(S(k)) * 0.008, lean: 0.12, hipL: S(k) * 0.4, hipR: -S(k) * 0.4, kneeL: 0.5, kneeR: 0.5, shL: 0.6, elL: 0.8, shR: 0.5, elR: 0.9, gripR: hold, shield: 'high' };
    }
    case 'sneak': {
      const k = c * 0.8;
      return { sit: 0.35, lean: 0.4, hipL: 0.5 + S(k) * 0.4, hipR: 0.5 - S(k) * 0.4, kneeL: 1.1, kneeR: 1.1, shL: 0.4, shR: 0.6, elR: 0.8, shield: 'back' };
    }
    case 'thrust': { // spear jab: draw back then lunge
      const lunge = p < 0.45 ? -p / 0.45 * 0.3 : Math.sin(((p - 0.45) / 0.55) * Math.PI) * 1;
      return { lean: 0.15 + lunge * 0.2, hipL: 0.5, kneeL: 0.4, hipR: -0.3, shR: 1.2 + lunge * 0.35, elR: 0.25 + Math.max(0, lunge) * 0.1, gripR: -1.5, shL: 0.6, elL: 0.6, shield: 'front' };
    }
    case 'swing': { // overhead blow with club, mace, axe or sword
      const up = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
      const sh = up > 0 && p < 0.5 ? 2.6 * up : 2.6 - 3.3 * ((p - 0.5) / 0.5);
      return { lean: p > 0.5 ? 0.25 : 0, hipL: 0.45, kneeL: 0.35, hipR: -0.25, shR: Math.max(-0.4, sh), elR: 0.4, gripR: -sh * 0.8 + 0.3, shL: 0.7, elL: 0.6, shield: 'front' };
    }
    case 'shoot': case 'kneelShoot': { // nock, draw, loose
      const draw = p < 0.7 ? Math.min(1, p / 0.6) : Math.max(0, 1 - (p - 0.7) / 0.1);
      const kneel = act === 'kneelShoot';
      return { sit: kneel ? 0.8 : 0, hipL: kneel ? 1.4 : 0.25, kneeL: kneel ? 1.4 : 0.1, hipR: kneel ? -0.3 : -0.2, kneeR: kneel ? 2 : 0, twist: -0.35,
        shL: 1.45, elL: 0, gripL: 0.05, shR: 1.35 + draw * 0.05, elR: 0.2 + draw * 1.9, drawn: draw, neck: -0.1 };
    }
    case 'sling': { // whirl then release
      const rel = p > 0.75;
      return { twist: -0.3, hipL: 0.3, hipR: -0.25, shR: rel ? 1.6 : 2.7, shRx: 0.35, elR: rel ? 0.1 : 0.3, slingSpin: rel ? 0 : t * 22, gripR: rel ? -1 : 0, shL: 0.5, elL: 0.5 };
    }
    case 'throw': { // overarm javelin or torch
      const back = p < 0.55 ? p / 0.55 : 1 - (p - 0.55) / 0.45;
      const fwd = p >= 0.55;
      return { lean: fwd ? 0.25 : -0.1, twist: fwd ? 0.2 : -0.45, hipL: 0.45, kneeL: 0.3, hipR: -0.3, shR: fwd ? 1.2 + back * 1.2 : 2.6 + back * 0.4, elR: fwd ? 0.1 : 0.9, gripR: fwd ? -1.2 : 0.8, shL: 0.9, elL: 0.3 };
    }
    case 'block': case 'brace':
      return { lean: 0.12, sit: 0.25, hipL: 0.55, kneeL: 0.7, hipR: -0.25, kneeR: 0.3, shL: 1.0, elL: 0.6, shR: 0.8, elR: 0.6, gripR: act === 'brace' ? -1.2 : -0.6, shield: act === 'block' ? 'high' : 'front' };
    case 'push': {
      const k = c * 0.8;
      return { lean: 0.55, hipL: 0.35 + S(k) * 0.35, hipR: 0.35 - S(k) * 0.35, kneeL: 0.6, kneeR: 0.6, shL: 1.5, elL: 0.3, shR: 1.5, elR: 0.3, shield: 'back' };
    }
    case 'pull': {
      const k = c * 0.6;
      return { lean: -0.35, hipL: 0.6 + S(k) * 0.15, kneeL: 0.5, hipR: -0.2, kneeR: 0.2, shL: 1.2, elL: 0.2, shR: 1.15, elR: 0.25, shield: 'back' };
    }
    case 'row': {
      const k = c * 0.55;
      return { sit: 1, hipL: 1.4, hipR: 1.4, kneeL: 1.5, kneeR: 1.5, lean: -0.1 + S(k) * 0.25, shL: 1.1 + S(k) * 0.5, shR: 1.1 + S(k) * 0.5, elL: 0.4, elR: 0.4, gripR: 0.6 + S(k) * 0.4 };
    }
    case 'carry': {
      const k = c * 0.9;
      return { bob: Math.abs(S(k)) * 0.005, hipL: S(k) * 0.45, hipR: -S(k) * 0.45, kneeL: Math.max(0, -S(k + 1)) * 0.8, kneeR: Math.max(0, S(k + 1)) * 0.8, shL: 2.7, elL: 0.6, shR: 2.5, elR: 0.6, lean: 0.08, shield: 'back' };
    }
    case 'hammer': { // tool raised and struck, repeating
      const k = (t * 1.6 + phase * 0.2) % 1;
      const sh = k < 0.6 ? 0.6 + k / 0.6 * 2 : 2.6 - (k - 0.6) / 0.4 * 2.3;
      return { sit: 0.3, lean: 0.35, hipL: 0.8, kneeL: 1, hipR: 0.1, kneeR: 1.2, shR: sh, elR: 0.5, gripR: -sh + 0.9, shL: 0.9, elL: 0.8, shield: 'back' };
    }
    case 'dig': case 'harvest': {
      const k = (t * 1.3 + phase * 0.2) % 1;
      return { lean: 0.6, sit: 0.15, hipL: 0.4, kneeL: 0.5, hipR: -0.1, shL: 1 + S(k * 6.28) * 0.4, shR: 1.2 + S(k * 6.28) * 0.4, elL: 0.3, elR: 0.3, gripR: -1.3, shield: 'back' };
    }
    case 'lift':
      return { shL: 2.9, shR: 2.9, elL: 0.2, elR: 0.2, sit: 0.1 + S(t * 3 + phase) * 0.05, hipL: 0.15, hipR: -0.1, shield: 'back' };
    case 'cheer': {
      const k = t * 7 + phase;
      return { bob: Math.max(0, S(k)) * 0.025, shR: 2.6 + S(k) * 0.4, elR: 0.3, shL: 2.4 + S(k + 1) * 0.4, elL: 0.3, gripR: -0.1, shield: 'side' };
    }
    case 'dance': {
      const k = t * 5 + phase;
      return { bob: Math.abs(S(k)) * 0.02, twist: S(k * 0.5) * 0.6, hipL: S(k) * 0.6, hipR: -S(k) * 0.3, kneeL: 0.6, shL: 2 + S(k) * 0.8, shR: 2 - S(k) * 0.8, shLx: 0.6, shRx: 0.6, elL: 0.5, elR: 0.5 };
    }
    case 'bow':
      return { spine: 0.9 * Math.sin(Math.min(1, p) * Math.PI), shL: 0.2, shR: 0.2, elR: 0.3, shield: 'back' };
    case 'command':
      return { shR: 2.2 + S(t * 3) * 0.15, elR: 0.1, gripR: -0.2, shL: 0.3, elL: 0.6, neck: -0.15, shield: 'side' };
    case 'point':
      return { shR: 1.5, elR: 0, shL: 0.1, neck: -0.05 };
    case 'ride':
      return { sit: 1, hipL: 1.2, hipR: 1.2, kneeL: 1.4, kneeR: 1.4, shLx: 0.15, shRx: 0.15, shR: 1.0 + S(t * 9 + phase) * 0.1, elR: 0.5, gripR: w === 'javelin' || w === 'spear' ? -1.3 : hold, shL: 0.8, elL: 0.8, shield: 'side' };
    case 'sit':
      return { sit: 1, hipL: 1.5, hipR: 1.5, kneeL: 1.5, kneeR: 1.5, shL: 0.3, shR: 0.3, elL: 0.8, elR: 0.8 };
    case 'kneel':
      return { sit: 0.8, hipL: 1.4, kneeL: 1.4, hipR: -0.3, kneeR: 2, shR: 0.4, elR: 0.7, gripR: hold, shield: 'front' };
    case 'stagger':
      return { lean: -0.35 + S(t * 20) * 0.1, shL: 1.2, shR: 1.4, elL: 1, elR: 1, hipL: -0.3, hipR: 0.4, kneeR: 0.4 };
    case 'cower':
      return { sit: 0.6, lean: 0.3, hipL: 1, hipR: 1, kneeL: 1.4, kneeR: 1.4, shL: 2.2, shR: 2.2, elL: 1.8, elR: 1.8, shield: 'high' };
    case 'fall':
      return { fallen: Math.min(1, p), shL: 1.5 * p, shR: 1.8 * p, elL: 0.4, elR: 0.4, hipL: 0.3, hipR: 0.6 * p };
    case 'dead':
      return { fallen: 1, shL: 1.5, shR: 1.8, elL: 0.4, elR: 0.4, hipL: 0.3, hipR: 0.6 };
  }
  return {};
}
