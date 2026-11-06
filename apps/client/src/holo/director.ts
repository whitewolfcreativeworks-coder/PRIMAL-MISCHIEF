import * as THREE from 'three';
import { getCard, type CivId } from '@pm/engine';
import { Figure, outfitFor, pose, type Act, type Outfit, type Role, type Weapon } from './figures';
import type { HoloModel } from './kit';
import type { Stage } from './theater';
import { seg } from './theater';
import { makeVehicle, type Vehicle, type VehicleKind } from './vehicles';

/*
 * The director: casts hologram actors from card data and plays them through
 * simple timelines ("at 1.2s, march to the river; at 2s, thrust; at 2.4s,
 * fall"). Scenes describe *what happened* (taken from engine events) and the
 * director turns it into motion, so a new or rebalanced card is staged
 * correctly without a hand-made animation.
 */

// ---------------------------------------------------------------- casting

export interface Casting {
  role: Role;
  /** People on foot per card (or riders when there is a vehicle). */
  count: number;
  vehicle?: VehicleKind;
  /** How many vehicles (elephants, ships, wagons). */
  vehicles?: number;
  crewRole?: Role;
  /** The motion of their attack. */
  attack: Act;
  missile?: 'arrow' | 'stone' | 'javelin' | 'torch';
  /** A commander walks with the troop (Kandake, Lugal, Sapa Inka's generals). */
  leader?: boolean;
  /** Extra outfit tweaks for this card. */
  outfit?: Partial<Outfit>;
  /** A mixed host: some archers among the spears. */
  mixed?: Role;
}

/** Hand-tuned exceptions; everything else is derived from the card's own data. */
const CAST_OVERRIDES: Record<string, Partial<Casting>> = {
  aksum_fleet: { vehicle: 'trader', vehicles: 1, role: 'marine', count: 2, crewRole: 'rower', attack: 'throw', missile: 'javelin' },
  carth_quinq: { vehicle: 'galley', vehicles: 1, role: 'marine', count: 3, crewRole: 'rower', attack: 'thrust' },
  carth_cavalry: { vehicle: 'horse', vehicles: 3, role: 'rider', count: 3, attack: 'throw', missile: 'javelin', outfit: { weapon: 'javelin', shield: 'small', head: 'bare' } },
  sumer_wagon: { vehicle: 'wagon', vehicles: 1, role: 'driver', count: 2, attack: 'throw', missile: 'javelin' },
  aksum_elephants: { vehicle: 'elephant', vehicles: 1, role: 'rider', count: 2, attack: 'thrust', crewRole: 'infantry' },
  carth_elephants: { vehicle: 'elephant', vehicles: 2, role: 'rider', count: 2, attack: 'thrust' },
  ram: { vehicle: 'ram', vehicles: 1, role: 'worker', count: 0, crewRole: 'worker', attack: 'push' },
  raiders: { role: 'raider', count: 3, attack: 'swing' },
  shieldBearers: { role: 'infantry', count: 4, attack: 'thrust', outfit: { shield: 'tall' } },
  eliteGuard: { role: 'elite', count: 4, attack: 'thrust' },
  grandArmy: { role: 'infantry', count: 5, attack: 'thrust', mixed: 'archer', leader: true },
  sumer_host: { role: 'infantry', count: 5, attack: 'thrust', mixed: 'archer', leader: true },
  kush_host: { role: 'archer', count: 5, attack: 'shoot', missile: 'arrow', mixed: 'infantry', leader: true },
  inca_army: { role: 'infantry', count: 5, attack: 'swing', mixed: 'slinger', leader: true },
  inca_mountain: { role: 'infantry', count: 3, attack: 'swing', outfit: { head: 'headband', shield: 'none' } },
  inca_mace: { role: 'infantry', count: 4, attack: 'swing' },
  carth_mercs: { role: 'mercenary', count: 3, attack: 'swing' },
  militia: { role: 'militia', count: 2, attack: 'swing' },
};

const ROLE_ATTACK: Partial<Record<Role, Act>> = { archer: 'shoot', slinger: 'sling', militia: 'swing', mercenary: 'swing', raider: 'swing', rider: 'thrust' };

export function castFor(cardId: string, civ: CivId): Casting {
  const c = getCard(cardId);
  const kw = c.keywords ?? [];
  const str = c.str ?? 2;
  let base: Casting;
  if (kw.includes('ranged')) {
    const sling = civ === 'inca' || c.art === 'slinger';
    base = { role: sling ? 'slinger' : 'archer', count: Math.min(4, str + 1), attack: sling ? 'sling' : 'shoot', missile: sling ? 'stone' : 'arrow' };
  } else if (kw.includes('siege')) {
    base = { role: 'worker', count: 0, vehicle: 'ram', vehicles: 1, crewRole: 'worker', attack: 'push' };
  } else if (kw.includes('raider')) {
    base = { role: 'raider', count: 3, attack: 'swing' };
  } else if (kw.includes('swift') && civ !== 'inca') {
    base = { role: 'rider', count: 2, vehicle: 'horse', vehicles: 2, attack: 'thrust' };
  } else {
    base = { role: 'infantry', count: Math.max(2, Math.min(5, str + 1)), attack: 'thrust' };
  }
  const o = CAST_OVERRIDES[cardId] ?? CAST_OVERRIDES[c.art] ?? {};
  const out = { ...base, ...o };
  if (!o.attack && ROLE_ATTACK[out.role]) out.attack = ROLE_ATTACK[out.role]!;
  // An Inca troop never rides horses (none in the Andes before 1532).
  if (civ === 'inca' && (out.vehicle === 'horse' || out.vehicle === 'elephant')) { out.vehicle = undefined; out.vehicles = 0; }
  return out;
}

/** The pack animal of each culture (caravans, supply). */
export const PACK_ANIMAL: Record<CivId, VehicleKind> = { kush: 'donkey', aksum: 'camel', carthage: 'donkey', sumer: 'donkey', inca: 'llama' };

// ---------------------------------------------------------------- actors

export interface Beat {
  at: number;
  act: Act;
  /** Move to this (x, z) during the beat. */
  to?: [number, number];
  /** Duration of the movement / one-shot action. */
  dur?: number;
  /** Turn to face +x (0) or −x (π) at this beat. */
  face?: number;
}

export class Actor {
  readonly root = new THREE.Group();
  beats: Beat[] = [];
  phase: number;
  /** For vehicles. */
  riders: Figure[] = [];
  crew: Figure[] = [];
  private start: [number, number];
  private gone = false;
  constructor(
    readonly stage: Stage,
    readonly figure: Figure | null,
    readonly vehicle: Vehicle | null,
    pos: [number, number],
    facing: number,
    private models: HoloModel[],
    readonly weapon: Weapon,
  ) {
    this.start = pos;
    this.root.position.set(pos[0], 0, pos[1]);
    this.root.rotation.y = facing;
    this.phase = (Math.abs(pos[1] * 13.7 + pos[0] * 7.1) % 6.28);
    this.beats.push({ at: 0, act: 'idle', face: facing });
  }

  /** Schedule an action. Chainable. */
  do(at: number, act: Act, opts: { to?: [number, number]; dur?: number; face?: number } = {}) {
    this.beats.push({ at, act, ...opts });
    this.beats.sort((a, b) => a.at - b.at);
    return this;
  }

  /** Where the actor will be standing at the end of everything scheduled so far. */
  get end(): [number, number] {
    let p = this.start;
    for (const b of this.beats) if (b.to) p = b.to;
    return p;
  }

  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }
  /** World position of the actor's chest (for missiles, bursts). */
  chest(y = 0.2): THREE.Vector3 { return new THREE.Vector3(this.root.position.x, y * this.root.scale.y, this.root.position.z); }

  update(t: number) {
    // Position: walk through every movement beat already begun.
    let px = this.start[0], pz = this.start[1];
    let cur = this.beats[0], face = this.root.rotation.y;
    for (const b of this.beats) {
      if (b.at > t) break;
      cur = b;
      if (b.face !== undefined) face = b.face;
      if (b.to) {
        const k = seg(t, b.at, b.at + (b.dur ?? 1), false);
        px += (b.to[0] - px) * k; pz += (b.to[1] - pz) * k;
        if (k >= 1) { px = b.to[0]; pz = b.to[1]; }
      }
    }
    this.root.position.x = px; this.root.position.z = pz;
    this.root.rotation.y = face;
    const p = cur.dur ? Math.min(1, (t - cur.at) / cur.dur) : 1;
    const moving = !!cur.to && t < cur.at + (cur.dur ?? 1);
    const act = cur.act === 'fall' && p >= 1 ? 'dead' : cur.act;
    if (this.figure) {
      this.figure.apply(pose(act, t, p, this.phase, this.weapon));
      this.figure.tick(t);
    }
    if (this.vehicle) {
      const speed = moving ? (act === 'charge' || act === 'run' ? 1.4 : 1) : 0;
      this.vehicle.animate(t + this.phase, speed);
      const striking = act === 'thrust' || act === 'swing' || act === 'push' && !moving;
      this.vehicle.strike(striking ? p : 0);
      const riderAct: Act = act === 'fall' || act === 'dead' ? act
        : this.vehicle.kind === 'galley' || this.vehicle.kind === 'trader' ? (moving ? 'row' : 'idle')
          : this.vehicle.kind === 'wagon' ? (striking || act === 'throw' ? 'throw' : 'stand') : 'ride';
      this.riders.forEach((f, i) => {
        const fighting = (act === 'thrust' || act === 'throw' || act === 'swing') && i === 0;
        const ra: Act = fighting ? act : (this.vehicle!.kind === 'galley' || this.vehicle!.kind === 'trader') && i > 0 ? 'row' : riderAct;
        const sitting = this.vehicle!.kind === 'horse' || this.vehicle!.kind === 'elephant' || this.vehicle!.kind === 'camel';
        const pp = pose(ra === 'thrust' || ra === 'throw' ? ra : ra, t, p, this.phase + i, f.outfit.weapon);
        if (sitting && (ra === 'thrust' || ra === 'throw')) { pp.sit = 1; pp.hipL = 1.2; pp.hipR = 1.2; pp.kneeL = 1.4; pp.kneeR = 1.4; pp.lean = 0; }
        f.apply(pp); f.tick(t);
      });
      this.crew.forEach((f, i) => {
        const ca: Act = act === 'fall' || act === 'dead' ? act : this.vehicle!.kind === 'ram' ? (moving || striking ? 'push' : 'brace') : moving ? 'walk' : 'idle';
        f.apply(pose(ca, t * (ca === 'push' && !moving ? 1.6 : 1), p, this.phase + i * 1.3, f.outfit.weapon)); f.tick(t);
      });
      if (act === 'fall' || act === 'dead') this.stage.shatter(this.vehicle.model, Math.min(1, p));
    }
    // The fallen flicker out over a second and a half.
    if (act === 'dead' || (cur.act === 'fall' && p >= 1)) {
      const k = seg(t, cur.at + (cur.dur ?? 0.6) + 0.4, cur.at + (cur.dur ?? 0.6) + 1.6);
      for (const m of this.models) { m.uniforms.uOpacity.value = Math.min(m.uniforms.uOpacity.value, 1 - k * 0.85); m.uniforms.uGlitch.value = k > 0 && k < 1 ? 0.5 : 0; }
      this.gone = k >= 1;
    }
  }

  /** Materialize from the floor up (0..1). */
  reveal(p: number) { for (const m of this.models) m.uniforms.uReveal.value = p >= 1 ? 99 : -0.02 + 0.6 * this.root.scale.y * p; }
  /** Heat/glitch flash when struck. */
  flash(amount: number) { for (const m of this.models) m.uniforms.uHeat.value = Math.max(m.uniforms.uHeat.value * 0.9, amount); }
  fade(p: number) { for (const m of this.models) m.uniforms.uOpacity.value = Math.min(m.uniforms.uOpacity.value, 1 - p); }
  get isGone() { return this.gone; }
}

// ---------------------------------------------------------------- missiles

type MissileKind = 'arrow' | 'stone' | 'javelin' | 'torch';
interface Missile { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; arc: number; kind: MissileKind; color: number; landed: boolean; onHit?: () => void }

const lineMats = new Map<number, THREE.LineBasicMaterial>();
const lineMat = (c: number) => { let m = lineMats.get(c); if (!m) { m = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }); lineMats.set(c, m); } return m; };
const ARROW = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.045, 0, 0), new THREE.Vector3(0.045, 0, 0)]);
const JAV = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.08, 0, 0), new THREE.Vector3(0.08, 0, 0)]);
const STONE = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.008, 0, 0), new THREE.Vector3(0.008, 0, 0), new THREE.Vector3(0, 0.008, 0), new THREE.Vector3(0, -0.008, 0)]);

// ---------------------------------------------------------------- the troupe

const SCALE = 0.95;

/** All the actors of one scene. Create in setup(), call update(t) every frame. */
export class Troupe {
  actors: Actor[] = [];
  private missiles: Missile[] = [];
  constructor(readonly stage: Stage, readonly scale = SCALE) {}

  /** One person. Facing 0 = toward +x, π = toward −x. */
  person(civ: CivId, role: Role, color: number, pos: [number, number], facing = 0, tweak?: Partial<Outfit>): Actor {
    const f = new Figure(color, { ...outfitFor(civ, role), ...tweak });
    const m = this.wrap(f);
    const a = new Actor(this.stage, f, null, pos, facing, [m], f.outfit.weapon);
    a.root.add(f.root);
    a.root.scale.setScalar(this.scale);
    this.stage.root.add(a.root);
    this.stage.register(m);
    this.actors.push(a);
    return a;
  }

  /** A vehicle with its riders and crew. */
  machine(civ: CivId, kind: VehicleKind, color: number, pos: [number, number], facing = 0, riders: Role[] = [], crew: Role = 'worker', crewN?: number, riderTweak?: Partial<Outfit>): Actor {
    const v = makeVehicle(kind, civ, color);
    const models: HoloModel[] = [v.model];
    const a = new Actor(this.stage, null, v, pos, facing, models, 'none');
    a.root.add(v.model.group);
    this.stage.register(v.model);
    riders.slice(0, v.seats.length).forEach((r, i) => {
      const f = new Figure(color, { ...outfitFor(civ, r), ...(i === 0 ? riderTweak : {}) });
      v.seats[i].add(f.root);
      const m = this.wrap(f); models.push(m); this.stage.register(m);
      a.riders.push(f);
    });
    const n = crewN ?? (kind === 'ram' ? 4 : 0);
    v.flanks.slice(0, n).forEach((pt) => {
      const f = new Figure(color, outfitFor(civ, crew));
      f.root.position.set(...pt);
      a.root.add(f.root);
      const m = this.wrap(f); models.push(m); this.stage.register(m);
      a.crew.push(f);
    });
    a.root.scale.setScalar(this.scale);
    this.stage.root.add(a.root);
    this.actors.push(a);
    return a;
  }

  /** Every actor a unit card brings, in formation around (x, z). */
  squad(cardId: string, civ: CivId, color: number, at: [number, number], facing = 0, opts: { spread?: number; max?: number } = {}): Actor[] {
    const c = castFor(cardId, civ);
    const out: Actor[] = [];
    const dir = Math.cos(facing) >= 0 ? 1 : -1;
    if (c.vehicle) {
      const n = Math.max(1, Math.min(opts.max ?? 3, c.vehicles ?? 1));
      for (let i = 0; i < n; i++) {
        const riders: Role[] = c.vehicle === 'galley' || c.vehicle === 'trader' ? [c.role, c.crewRole ?? 'rower', c.crewRole ?? 'rower'] : c.vehicle === 'ram' ? [] : Array(c.count).fill(c.role);
        out.push(this.machine(civ, c.vehicle, color, [at[0] - dir * i * 0.12, at[1] + lane(i, n, (opts.spread ?? 0.22))], facing, riders, c.crewRole ?? 'worker', c.vehicle === 'ram' ? 4 : c.vehicle === 'elephant' && c.crewRole ? 1 : 0, c.outfit));
      }
      return out;
    }
    const n = Math.max(1, Math.min(opts.max ?? 5, c.count));
    const leader = c.leader ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const row = i % 2, col = Math.floor(i / 2);
      const role = c.mixed && i >= Math.ceil(n * 0.6) ? c.mixed : c.role;
      const z = at[1] + lane(i, n, opts.spread ?? 0.16 * Math.min(n, 4) / 2);
      out.push(this.person(civ, role, color, [at[0] - dir * (row * 0.07 + col * 0.015), z], facing, role === c.role ? c.outfit : undefined));
    }
    if (leader) out.push(this.person(civ, 'ruler', color, [at[0] - dir * 0.16, at[1]], facing));
    return out;
  }

  /** A missile from a to b, launched at t0 and landing after dur; onHit fires on landing. */
  missile(kind: 'arrow' | 'stone' | 'javelin' | 'torch', color: number, from: THREE.Vector3, to: THREE.Vector3, t0: number, dur = 0.55, onHit?: () => void) {
    const geo = kind === 'arrow' ? ARROW : kind === 'javelin' ? JAV : STONE;
    const obj = kind === 'stone' ? new THREE.LineSegments(geo, lineMat(color)) : kind === 'torch' ? new THREE.LineSegments(STONE, lineMat(0xffa040)) : new THREE.Line(geo, lineMat(color));
    if (kind === 'torch') obj.scale.setScalar(2.5);
    obj.visible = false;
    this.stage.root.add(obj);
    const arc = kind === 'stone' ? 0.18 : kind === 'arrow' ? 0.32 : 0.22;
    this.missiles.push({ obj, from, to, t0, dur, arc, kind, color, landed: false, onHit });
  }

  /** A volley: each shooter looses at a random target among `targets`. */
  volley(shooters: Actor[], targets: Actor[] | THREE.Vector3[], t0: number, kind: 'arrow' | 'stone' | 'javelin' | 'torch', color: number, onHit?: (i: number) => void) {
    shooters.forEach((s, i) => {
      const tg = targets.length ? targets[i % targets.length] : null;
      const to = tg instanceof Actor ? tg.chest(0.15).add(new THREE.Vector3(0, 0, (i % 3 - 1) * 0.02)) : (tg as THREE.Vector3 | null) ?? new THREE.Vector3(s.x + 0.8, 0, s.z);
      const lead = kind === 'stone' ? 0.42 : kind === 'arrow' ? 0.36 : 0.3;
      this.missile(kind, color, s.chest(0.22), to, t0 + lead + (i % 3) * 0.06, kind === 'stone' ? 0.45 : 0.55, onHit ? () => onHit(i) : undefined);
    });
  }

  update(t: number) {
    for (const a of this.actors) a.update(t);
    for (const m of this.missiles) {
      const k = (t - m.t0) / m.dur;
      m.obj.visible = k > 0 && k < 1;
      if (k <= 0) continue;
      if (k >= 1) {
        if (!m.landed) { m.landed = true; this.stage.burst(m.to, m.kind === 'torch' ? 0xffa040 : m.color, m.kind === 'torch' ? 16 : 6, { speed: 0.35, ttl: 0.5, size: 0.025 }); m.onHit?.(); }
        continue;
      }
      const p = m.from.clone().lerp(m.to, k);
      p.y += Math.sin(Math.PI * k) * m.arc;
      const ahead = m.from.clone().lerp(m.to, Math.min(1, k + 0.02)); ahead.y += Math.sin(Math.PI * Math.min(1, k + 0.02)) * m.arc;
      m.obj.position.copy(p);
      if (m.kind !== 'stone') { m.obj.lookAt(ahead); m.obj.rotateY(-Math.PI / 2); }
      if (m.kind === 'torch' && Math.floor(t * 30) % 2 === 0) this.stage.burst(p, 0xffa040, 2, { speed: 0.15, gravity: -0.3, ttl: 0.35, size: 0.03 });
    }
  }

  reveal(p: number) { this.actors.forEach((a) => a.reveal(p)); }

  private wrap(f: Figure): HoloModel {
    f.uniforms.uOpacity.value = 0.8; // many small overlapping figures: keep them from blowing out
    return { group: f.root, uniforms: f.uniforms, parts: [], height: 0.32, kind: 'unit', dispose: () => f.dispose() };
  }
}

/** Spread n items along z. */
export const lane = (i: number, n: number, spread = 0.34) => (n <= 1 ? 0 : -spread + (2 * spread * i) / (n - 1));
