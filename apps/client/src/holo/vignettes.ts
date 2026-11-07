import { getCard, type CardDef, type CivId, type GameEvent, type UnitFate } from '@pm/engine';
import * as THREE from 'three';
import { archBuilding, archCity } from './arch';
import { Actor, castFor, lane, PACK_ANIMAL, Troupe } from './director';
import type { Act, Role } from './figures';
import type { HoloModel } from './kit';
import { MY_COLOR, OPP_COLOR, seg, type Stage, type Vignette } from './theater';

/*
 * Hologram scenes. Each one is built from exactly what the engine reported
 * (who attacked, who blocked, which reaction, who fell and to what, what was
 * built) and staged with culture-specific people, machines and architecture.
 *
 * Battle layout (scene x): the attacker's bank on the left (x < −0.36), the
 * river in the middle, the defender's bank on the right (x > 0.06). The stage
 * is rotated so you always attack away from the viewer.
 */

type CombatEv = Extract<GameEvent, { type: 'combat' }>;
type SchemeEv = Extract<GameEvent, { type: 'scheme' }>;

const RED = 0xff6a4a, FIRE = 0xffa040, VIOLET = 0xc8a2ff, WHITE = 0xffffff, GOLD = 0xf3dfa6, DUST = 0xd9c39a;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const name = (id: string) => (id === 'city' ? 'the city' : getCard(id).name);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const col = (mine: boolean) => (mine ? MY_COLOR : OPP_COLOR);
const FWD = 0, BACK = Math.PI; // facing +x / −x
/** Stage rotation for two-bank scenes: the action runs diagonally away from you when you attack, toward you when they do. */
const OBLIQUE = 0.78;

const RIVER_C = -0.15, RIVER_W = 0.42;
const NEAR_BANK = RIVER_C - RIVER_W / 2 - 0.02; // attacker's edge of the water
const FAR_BANK = RIVER_C + RIVER_W / 2 + 0.02;

/** Fit a model to a target height (architecture comes in many sizes). */
function fit(m: HoloModel, h: number, maxScale = 3, maxW = h * 1.6) {
  const box = new THREE.Box3().setFromObject(m.group);
  const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 0.05);
  const s = Math.min(maxScale, h / Math.max(0.05, m.height), maxW / w);
  m.group.scale.setScalar(s);
  return m;
}

function building(s: Stage, cardId: string, civ: CivId, color: number, pos: [number, number, number], h: number): HoloModel {
  const m = cardId === 'city' ? archCity(civ, 3, color) : archBuilding(cardId, civ, color);
  s.register(m, pos);
  return fit(m, h);
}

function city(s: Stage, civ: CivId, age: number, color: number, pos: [number, number, number], h: number): HoloModel {
  const m = archCity(civ, age, color);
  s.register(m, pos);
  // Cities are wide and low: size them by footprint (h is a nominal size).
  const box = new THREE.Box3().setFromObject(m.group);
  const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 0.05);
  m.group.scale.setScalar(Math.min(1.6, (h * 2.2) / w));
  m.uniforms.uOpacity.value = 0.7; // dense: keep it from saturating
  return m;
}

function shake(m: HoloModel, amt: number, t: number, base = 0) {
  m.group.rotation.z = Math.sin(t * 60) * 0.03 * amt;
  m.group.rotation.y = base;
  m.uniforms.uHeat.value = Math.max(m.uniforms.uHeat.value * 0.92, amt);
}

/** Repeat a one-shot action every `period` seconds within [from, to). */
function repeat(a: Actor, act: Act, from: number, to: number, period: number) {
  for (let t = from; t < to - 0.05; t += period) a.do(t, act, { dur: period * 0.95 });
}

const isRanged = (a: Actor) => a.figure?.outfit.weapon === 'bow' || a.figure?.outfit.weapon === 'sling';
const missileOf = (a: Actor) => (a.figure?.outfit.weapon === 'sling' ? 'stone' : a.figure?.outfit.weapon === 'bow' ? 'arrow' : 'javelin') as 'stone' | 'arrow' | 'javelin';
const shootAct = (a: Actor): Act => (a.figure?.outfit.weapon === 'sling' ? 'sling' : a.figure?.outfit.weapon === 'bow' ? 'shoot' : 'throw');
const SHOT_DUR: Record<string, number> = { shoot: 0.5, sling: 0.55, throw: 0.55 };

// ===================================================================== battle

export interface BattleCtx { aCiv: CivId; dCiv: CivId; dAge: number; aAge: number }

export function battleScene(e: CombatEv, attackerIsMe: boolean, ctx: BattleCtx): Vignette {
  const aCol = col(attackerIsMe), dCol = col(!attackerIsMe);
  // Every reaction in force (from the hand and from sprung traps); the cancelling one wins.
  const RS = e.reactions ?? (e.reaction ? [e.reaction] : []);
  const has = (r: string) => RS.includes(r as never);
  const cancelR = e.cancelled ? (has('feignedRetreat') ? 'feignedRetreat' : has('treaty') ? 'treaty' : e.reaction) : null;
  const R = cancelR ?? e.reaction;
  const trap = e.trap ?? null;
  const fromTrap = e.blockerFromTrap ?? e.blockerCards.map(() => false);
  const trapNames = trap ? trap.cards.map((id) => getCard(id).name) : [];
  const fates = e.attackerFates ?? e.attackerCards.map((_, i) => (i < e.attackersLost ? 'melee' : null));
  const bFates = e.blockerFates ?? e.blockerCards.map((_, i) => i < e.blockersLost);
  const nA = e.attackerCards.length, nB = e.blockerCards.length;
  const perA = nA <= 1 ? 4 : nA === 2 ? 3 : nA <= 4 ? 2 : 1;
  const perB = nB <= 1 ? 3 : nB === 2 ? 2 : 1;
  const rName = R ? getCard(R === 'treaty' ? 'aksum_treaty' : R).name : '';
  const tgt = `${attackerIsMe ? 'their' : 'your'} ${e.target === 'city' ? 'city' : getCard(e.target).name}`;
  const fell = fates.filter(Boolean).length;
  const trapLead = trap ? `Hidden trap${trap.cards.length > 1 ? 's' : ''}: ${trapNames.join(', ')}! ` : '';
  const caption = trapLead + (R === 'treaty' ? `${rName}: the attack is called off for tribute`
    : e.cancelled ? `${rName}: the assault strikes empty ground${fell ? ` — ${plural(fell, 'unit')} lost` : ''}`
      : e.tideBack > 0 ? `${rName}! ${e.tideBack} damage crashes back on the attacker`
        : e.dealt > 0 ? `${nA === 1 ? getCard(e.attackerCards[0]).name : plural(nA, 'unit')} ${nA === 1 ? 'storms' : 'storm'} ${tgt}${R ? ` through ${rName}` : ''} — ${e.dealt} damage${e.targetDestroyed ? ', it falls' : ''}`
          : `${tgt[0].toUpperCase()}${tgt.slice(1)} holds${R ? ` with ${rName}` : ''}`);
  const dur = e.cancelled ? 4.2 : 5.6;

  let T!: Troupe;
  let target!: HoloModel, wall: HoloModel | null = null, home: HoloModel | null = null;
  let A: { a: Actor[]; fate: UnitFate | null; card: CardDef }[] = [];
  let B: { a: Actor[]; dies: boolean }[] = [];
  let ambushers: Actor[] = [], envoy: Actor | null = null;
  let glow: THREE.Mesh | null = null;
  let dome: THREE.Mesh | null = null, trapWall: HoloModel | null = null;
  let garrison: Actor[] = [];
  const TRAP_T = 1.45; // the moment the trap springs: the attackers reach the far bank

  const reachWall = (e.wallAbsorbed > 0 || e.dealt > 0) && !!e.wallCard && e.wallCard !== e.target;
  const breach = e.dealt > 0;

  return {
    duration: dur,
    caption,
    tone: R ? 'reverse' : attackerIsMe ? 'mine' : 'theirs',
    setup(s) {
      T = new Troupe(s);
      s.facing = attackerIsMe ? OBLIQUE : -OBLIQUE;
      s.river(RIVER_C, RIVER_W);
      s.frame(-0.1, 0, 1.05);
      // The defender's bank: the target (a building, or the city itself) and any wall in front of it.
      target = e.target === 'city' ? city(s, ctx.dCiv, ctx.dAge, dCol, [0.8, 0, 0], 0.55) : building(s, e.target, ctx.dCiv, dCol, [0.78, 0, 0], 0.42);
      target.group.rotation.y = -Math.PI / 2;
      if (e.wallCard && e.wallCard !== e.target) { wall = building(s, e.wallCard, ctx.dCiv, dCol, [0.5, 0, 0], 0.26); wall.group.rotation.y = Math.PI / 2; }
      if (e.tideBack > 0) { home = city(s, ctx.aCiv, ctx.aAge, aCol, [-1.0, 0, 0.55], 0.35); home.group.rotation.y = Math.PI / 2; }

      // Attackers: one squad per unit card, in lanes across the river.
      A = e.attackerCards.map((id, i) => ({
        a: T.squad(id, ctx.aCiv, aCol, [-0.95, lane(i, nA, Math.min(0.62, 0.2 * nA))], FWD, { max: perA, spread: 0.055 * perA }),
        fate: fates[i] ?? null, card: getCard(id),
      }));
      // Blockers hold the defender's bank.
      B = e.blockerCards.map((id, i) => {
        const z = lane(i, nB, Math.min(0.5, 0.18 * nB));
        const a = T.squad(id, ctx.dCiv, dCol, [fromTrap[i] ? 0.7 : 0.27, z], BACK, { max: perB, spread: 0.06 * perB });
        // Trap garrison: hidden inside the target, then bursts out to the riverbank.
        if (fromTrap[i]) { a.forEach((x) => x.do(TRAP_T, 'charge', { to: [0.27 + (x.x - 0.7), x.z], dur: 0.5 }).do(TRAP_T + 0.55, 'idle')); garrison.push(...a); }
        return { a, dies: !!bFates[i] };
      });
      if (trap) {
        if (trap.roles.includes('brace')) {
          dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: dCol, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, wireframe: true }));
          dome.position.copy(target.group.position); s.root.add(dome);
        }
        const fortIdx = trap.roles.indexOf('wall');
        if (fortIdx >= 0) { trapWall = building(s, trap.cards[fortIdx], ctx.dCiv, dCol, [0.46, 0, 0.18], 0.24); trapWall.group.rotation.y = Math.PI / 2; }
      }
      if (has('ambush')) ambushers = [-1, 1].flatMap((side) => [0, 1].map((k) => T.person(ctx.dCiv, k ? 'archer' : 'infantry', dCol, [-0.25 + k * 0.08, side * 0.78], side > 0 ? -Math.PI / 2 : Math.PI / 2)));
      if (R === 'treaty') envoy = T.person(ctx.dCiv, 'envoy', dCol, [0.45, 0], BACK);
      if (has('shieldWall') || has('turnTheTide')) {
        glow = new THREE.Mesh(has('shieldWall') ? new THREE.PlaneGeometry(0.9, 0.42) : new THREE.TorusGeometry(0.45, 0.05, 8, 32, Math.PI),
          new THREE.MeshBasicMaterial({ color: dCol, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
        glow.position.set(has('shieldWall') ? 0.17 : 0.3, has('shieldWall') ? 0.2 : 0, 0); glow.rotation.y = Math.PI / 2;
        s.root.add(glow);
      }

      // ---- choreography
      const all = A.flatMap((g) => g.a);
      const ranged = all.filter(isRanged);
      const melee = all.filter((a) => !isRanged(a));
      const blockers = B.flatMap((g) => g.a);
      const dyingAt: Map<Actor, number> = new Map();

      // Everyone advances to the water; ranged troops stop on their own bank.
      ranged.forEach((a, i) => a.do(0.5, 'march', { to: [NEAR_BANK - 0.06 - (i % 2) * 0.06, a.z], dur: 0.8 }));
      melee.forEach((a) => {
        const fast = a.vehicle?.kind === 'horse';
        a.do(0.5, fast ? 'charge' : 'march', { to: [NEAR_BANK, a.z], dur: fast ? 0.55 : 0.8 });
        a.do(1.3, a.vehicle ? 'march' : 'wade', { to: [FAR_BANK - 0.08, a.z * 0.85], dur: 0.75 });
      });

      if (R === 'treaty') {
        // The envoy meets them at the water; the host halts, bows and turns home.
        envoy!.do(0.5, 'walk', { to: [FAR_BANK + 0.02, 0], dur: 0.9 }).do(1.4, 'bow', { dur: 1 }).do(2.6, 'idle');
        melee.forEach((a) => { a.beats = a.beats.filter((b) => b.at < 1.3); a.do(1.3, 'idle').do(1.7, 'bow', { dur: 0.8 }).do(2.6, 'walk', { to: [-0.95, a.z], dur: 1.2, face: BACK }); });
        ranged.forEach((a) => a.do(2.6, 'walk', { to: [-0.95, a.z], dur: 1.2, face: BACK }));
        return;
      }
      if (R === 'feignedRetreat') {
        // The defenders turn and run; the attackers charge into nothing and stumble.
        blockers.forEach((b, i) => b.do(1.1 + i * 0.05, 'flee', { to: [1.15, b.z * 1.3], dur: 1.0, face: FWD }));
        melee.forEach((a) => a.do(2.05, 'charge', { to: [0.42, a.z], dur: 0.55 }).do(2.6, 'stagger', { dur: 0.6 }));
        A.forEach((g) => { if (g.fate === 'retreat') g.a.forEach((a, k) => a.do(3.0 + k * 0.05, 'fall', { dur: 0.6 })); else g.a.forEach((a) => a.do(3.2, 'idle')); });
        return;
      }

      // Towers on the far bank loose arrows at the waders.
      if (e.towerHits > 0) {
        const src = (wall ?? target).group.position;
        all.forEach((a, i) => T.missile('arrow', dCol, new THREE.Vector3(src.x, 0.35, src.z + (i % 3 - 1) * 0.1), a.chest(0.15).setX(-0.1), 1.25 + (i % 4) * 0.07, 0.5));
        A.forEach((g) => { if (g.fate === 'tower') g.a.forEach((a, k) => { dyingAt.set(a, 1.85 + k * 0.05); }); });
      }
      // A sprung snare: stakes and arrows lash every attacker from the target.
      if (trap && trap.snare > 0) {
        const src = target.group.position;
        all.forEach((a, i) => T.missile('javelin', dCol, new THREE.Vector3(src.x, 0.3, src.z + (i % 3 - 1) * 0.12), a.chest(0.12).setX(FAR_BANK - 0.05), TRAP_T + (i % 4) * 0.05, 0.4));
        A.forEach((g) => { if (g.fate === 'trap') g.a.forEach((a, k) => { if (!dyingAt.has(a)) dyingAt.set(a, TRAP_T + 0.5 + k * 0.05); }); });
      }
      // Ambush: warriors rise from the reeds on both flanks.
      if (has('ambush')) {
        ambushers.forEach((m, i) => {
          m.do(0, 'kneel');
          if (m.figure?.outfit.weapon === 'bow') { m.do(1.2, 'shoot', { dur: 0.5 }); T.volley([m], all.slice(i % Math.max(1, all.length)), 1.2, 'arrow', dCol); }
          else m.do(1.15, 'charge', { to: [-0.18, m.z * 0.35], dur: 0.45 }).do(1.6, 'thrust', { dur: 0.45 }).do(2.1, 'walk', { to: [-0.25, m.z], dur: 0.6, face: m.root.rotation.y + Math.PI });
        });
        A.forEach((g) => { if (g.fate === 'ambush') g.a.forEach((a, k) => { if (!dyingAt.has(a)) dyingAt.set(a, 1.9 + k * 0.06); }); });
      }
      // Ranged attackers shoot across the river twice.
      const bTargets = blockers.length ? blockers : [];
      const tgtPoint = new THREE.Vector3((wall ?? target).group.position.x, 0.2, 0);
      ranged.forEach((a, i) => {
        for (const t0 of [1.35, 2.05]) {
          const act = shootAct(a);
          a.do(t0 + i * 0.04, act, { dur: SHOT_DUR[act] });
          T.volley([a], bTargets.length ? [bTargets[i % bTargets.length]] : [tgtPoint.clone().setZ(a.z * 0.5)], t0 + i * 0.04, missileOf(a), aCol);
        }
        a.do(2.7, 'idle');
      });
      // Ranged blockers shoot at the waders.
      blockers.filter(isRanged).forEach((b, i) => {
        const act = shootAct(b);
        b.do(1.3 + i * 0.05, act, { dur: SHOT_DUR[act] });
        T.volley([b], melee.length ? [melee[i % melee.length]] : all, 1.3 + i * 0.05, missileOf(b), dCol);
      });

      // The clash at the water's edge.
      const clash = 2.1;
      if (blockers.length) {
        melee.forEach((a) => repeat(a, castFor(A.find((g) => g.a.includes(a))!.card.id, ctx.aCiv).attack === 'push' ? 'push' : (a.vehicle ? 'thrust' : (a.figure?.outfit.weapon === 'spear' || a.figure?.outfit.weapon === 'javelin' ? 'thrust' : 'swing')), clash, 3.0, 0.45));
        blockers.forEach((b) => { if (!isRanged(b)) { b.do(1.4, has('shieldWall') ? 'block' : 'brace'); repeat(b, has('shieldWall') ? 'block' : (b.figure?.outfit.weapon === 'spear' ? 'thrust' : 'swing'), clash + 0.15, 3.0, 0.5); } });
        A.forEach((g) => { if (g.fate === 'melee') g.a.forEach((a, k) => { if (!dyingAt.has(a)) dyingAt.set(a, 2.7 + k * 0.07); }); });
        B.forEach((g) => { if (g.dies) g.a.forEach((b, k) => dyingAt.set(b, 2.8 + k * 0.07)); });
      } else {
        A.forEach((g) => { if (g.fate === 'melee') g.a.forEach((a, k) => { if (!dyingAt.has(a)) dyingAt.set(a, 2.6 + k * 0.07); }); });
      }

      // Turn the Tide: the surviving defenders surge back across the river.
      const survivorsA = A.filter((g) => !g.fate).flatMap((g) => g.a);
      if (has('turnTheTide')) {
        B.filter((g) => !g.dies).flatMap((g) => g.a).forEach((b) => b.do(3.0, 'charge', { to: [-0.3, b.z], dur: 0.7, face: BACK }).do(3.75, 'cheer'));
        survivorsA.forEach((a) => a.do(3.05, 'flee', { to: [-1.05, a.z], dur: 0.9, face: BACK }));
      } else if (reachWall || breach) {
        // Breakthrough: the survivors push on to the walls and the target.
        const wallX = (wall?.group.position.x ?? 0.5) - 0.13;
        survivorsA.forEach((a, i) => {
          if (isRanged(a)) { const act = shootAct(a); [3.0, 3.6].forEach((t0) => { a.do(t0 + i * 0.05, act, { dur: SHOT_DUR[act] }); T.volley([a], [tgtPoint.clone().setZ(a.z * 0.3)], t0 + i * 0.05, missileOf(a), aCol); }); return; }
          a.do(2.9, a.vehicle?.kind === 'horse' ? 'charge' : 'march', { to: [reachWall ? wallX : 0.55, a.z * 0.6], dur: 0.55 });
          const strike: Act = a.vehicle?.kind === 'ram' ? 'push' : a.vehicle ? 'thrust' : 'swing';
          repeat(a, strike, 3.5, breach && reachWall ? 3.95 : 4.6, 0.42);
          if (breach && reachWall) { a.do(3.95, 'march', { to: [0.6, a.z * 0.5], dur: 0.45 }); repeat(a, strike, 4.45, 5.0, 0.42); }
        });
        // Raiders run home with plunder.
        if (e.progressRaided > 0) A.filter((g) => !g.fate && (g.card.keywords ?? []).includes('raider')).flatMap((g) => g.a).forEach((a) => a.do(4.7, 'run', { to: [-0.6, a.z], dur: 0.8, face: BACK }));
      } else {
        // Repulsed: survivors fall back across the river.
        survivorsA.forEach((a) => a.do(3.2, 'walk', { to: [-0.8, a.z], dur: 1.2, face: BACK }));
        B.filter((g) => !g.dies).flatMap((g) => g.a).forEach((b) => b.do(3.3, 'cheer'));
      }

      for (const [a, at] of dyingAt) { a.beats = a.beats.filter((b) => b.at < at); a.do(at, 'fall', { dur: 0.55 }); }
    },
    update(s, t) {
      T.reveal(seg(t, 0, 0.6));
      garrison.forEach((a) => a.reveal(seg(t, TRAP_T - 0.05, TRAP_T + 0.25)));
      if (trap && t > TRAP_T) s.once('trap', () => {
        s.burst(target.group.position.clone().setY(0.2), VIOLET, 90, { speed: 0.9, gravity: 0.5 });
        s.label('Hidden trap!', [target.group.position.x - 0.1, 0.62, 0], '#e2d4ff', 1.5, 0.36);
      });
      if (dome) { (dome.material as THREE.MeshBasicMaterial).opacity = 0.35 * seg(t, TRAP_T, TRAP_T + 0.3) * (1 - seg(t, dur - 1.2, dur - 0.6)); dome.rotation.y = t * 0.4; }
      if (trapWall) { s.reveal(trapWall, seg(t, TRAP_T, TRAP_T + 0.5, false)); }
      if (trap && trap.absorbed > 0 && t > 3.7) s.once('braced', () => s.label(`Trap soaks ${trap.absorbed}`, [0.5, 0.6, 0.3], '#e2d4ff', 1.3, 0.26));
      s.reveal(target, seg(t, 0, 0.6));
      if (wall) s.reveal(wall, seg(t, 0, 0.6));
      if (home) s.reveal(home, seg(t, 0, 0.6));
      T.update(t);

      if (R === 'treaty') {
        if (t > 1.6) s.once('coins', () => { s.burst([FAR_BANK, 0.25, 0], GOLD, 60, { speed: 0.6, gravity: 0.6 }); s.label('+3 Prosperity to the attacker', [-0.3, 0.8, 0], '#f3dfa6', 1.6, 0.28); });
        s.frame(-0.05, 0, 1.25);
        s.fadeAll(seg(t, dur - 0.4, dur));
        return;
      }
      if (R === 'feignedRetreat') {
        s.frame(t < 2 ? 0 : 0.3, 0, t < 2 ? 1.1 : 1.3);
        if (t > 2.6) s.once('empty', () => s.label('Empty ground', [0.4, 0.75, 0], '#d9c6ff'));
        s.fadeAll(seg(t, dur - 0.4, dur));
        return;
      }

      // Camera: wide, then in on the clash, then follow the breakthrough.
      if (t < 1.8) s.frame(-0.25, 0, 1.05);
      else if (t < 3.2) s.frame(0.05, 0, 1.18);
      else if (breach || reachWall) s.frame(0.4, 0, 1.15);
      else s.frame(-0.1, 0, 1.15);

      if (has('ambush') && t > 1.2) s.once('ambush', () => s.label('Ambush!', [-0.2, 0.8, 0], '#d9c6ff'));
      if (glow) {
        const m = glow.material as THREE.MeshBasicMaterial;
        if (has('shieldWall')) m.opacity = 0.3 * seg(t, 1.6, 2.0) * (1 - seg(t, 3.0, 3.4));
        else { const w = seg(t, 2.9, 3.8, false); m.opacity = 0.6 * Math.sin(Math.PI * w); glow.position.x = 0.3 - 1.3 * w; glow.scale.setScalar(0.8 + w * 0.6); }
      }
      if (t > 2.1) s.once('clash', () => { if (B.length) s.burst([FAR_BANK - 0.02, 0.22, 0], WHITE, 50, { speed: 0.8 }); });
      if (has('turnTheTide') && e.tideBack > 0 && home) {
        if (t > 3.6) s.once('tide', () => { s.burst(home!.group.position.clone().setY(0.25), RED, 70, { speed: 0.8 }); s.label(`−${e.tideBack} Stability`, [-1.0, 0.8, 0.55], '#d9c6ff', 1.4); });
        shake(home, t > 3.6 && t < 4.1 ? 1 : 0, t, Math.PI / 2);
      }
      if (wall && e.wallAbsorbed > 0) {
        if (t > 3.6) s.once('wall', () => { s.burst([wall!.group.position.x, 0.2, 0], FIRE, 40, { speed: 0.6 }); s.label(`Walls −${e.wallAbsorbed}`, [wall!.group.position.x, 0.7, -0.3], '#ffd2a8'); });
        shake(wall, t > 3.55 && t < 4.3 ? 1 : 0, t, Math.PI / 2);
      }
      if (breach) {
        const hitAt = reachWall ? 4.5 : 3.6;
        if (t > hitAt) s.once('hit', () => { s.burst([target.group.position.x, 0.3, 0], RED, 70, { speed: 0.9 }); s.label(`−${e.dealt}`, [target.group.position.x, 1.05, 0], '#ff9c86', 1.4, 0.4); });
        if (e.progressRaided > 0 && t > hitAt + 0.5) s.once('raid', () => s.label(`−${e.progressRaided} Progress raided`, [0.3, 0.95, 0], '#ffd2a8', 1.3, 0.26));
        if (e.targetDestroyed) { if (t > hitAt) s.shatter(target, seg(t, hitAt, hitAt + 1.0, false)); }
        else shake(target, t > hitAt && t < hitAt + 0.5 ? 1 : 0, t, -Math.PI / 2);
      } else if (!reachWall && !has('turnTheTide') && t > 3.2) s.once('held', () => s.label('Held!', [0.4, 0.8, 0], attackerIsMe ? '#ffd2a8' : '#aef6ff'));
      s.fadeAll(seg(t, dur - 0.4, dur));
    },
  };
}

// ===================================================================== schemes

type SchemeKind = 'saboteurs' | 'fire' | 'steal' | 'arrows' | 'sack' | 'blockade' | 'landing';

/** How a hostile card is acted out — derived from its effects, so new cards get a fitting scene. */
export function schemeKindOf(c: CardDef): SchemeKind {
  if (c.id === 'carth_blockade') return 'blockade';
  if (c.id === 'aksum_campaign') return 'landing';
  const ops = (c.effects ?? []).map((e) => e.op);
  if (ops.includes('damageEnemyUnits')) return 'arrows';
  if (ops.includes('damageBuilding')) return 'fire';
  if (ops.includes('unrest') || ops.includes('unrestTag')) return 'saboteurs';
  if (ops.includes('damageCity')) return 'sack';
  return 'steal';
}

export interface SchemeCtx { casterCiv: CivId; victimCiv: CivId; victimAge: number; casterAge: number; victimUnits: string[]; victimUnitsLost: string[]; destroyed: { target: boolean; mirror: boolean } }

export function schemeScene(e: SchemeEv, casterIsMe: boolean, ctx: SchemeCtx): Vignette {
  const card = getCard(e.cardId);
  const kind = schemeKindOf(card);
  const cCol = col(casterIsMe), vCol = col(!casterIsMe);
  const trap = e.trap ?? null;
  const caption = trap && e.outcome === 'foiled' ? `A hidden trap catches the ${card.name} — foiled`
    : trap && e.outcome === 'mirrored' ? `A hidden Mirror! ${card.name} turns on its caster`
    : e.outcome === 'foiled' ? `${card.name} is caught and foiled`
    : e.outcome === 'mirrored' ? `Mirror the Scheme! ${card.name} turns on its caster`
      : kind === 'arrows' ? `${card.name}${ctx.victimUnitsLost.length ? ` — ${plural(ctx.victimUnitsLost.length, 'unit')} fall` : ''}`
        : `${card.name}${e.targetCardId ? ` strikes ${name(e.targetCardId)}` : ''}`;
  const dur = kind === 'arrows' ? 4.0 : 4.4;
  let T!: Troupe;
  let target: HoloModel | null = null, back: HoloModel | null = null;
  let agents: Actor[] = [];

  return {
    duration: dur,
    caption,
    tone: e.outcome === 'hit' ? (casterIsMe ? 'mine' : 'theirs') : 'reverse',
    setup(s) {
      T = new Troupe(s);
      s.facing = casterIsMe ? OBLIQUE : -OBLIQUE;
      s.river(RIVER_C, RIVER_W);
      s.frame(0, 0, 1.1);
      // What is struck: the named building, the city, or the army on the far bank.
      if (kind !== 'arrows') {
        const tid = e.targetCardId ?? 'city';
        target = tid === 'city' ? city(s, ctx.victimCiv, ctx.victimAge, vCol, [0.7, 0, 0], 0.55) : building(s, tid, ctx.victimCiv, vCol, [0.7, 0, 0], 0.42);
        target.group.rotation.y = -Math.PI / 2;
      }
      if (e.outcome === 'mirrored') {
        const mid = e.mirrorTargetCardId ?? 'city';
        back = mid === 'city' ? city(s, ctx.casterCiv, ctx.casterAge, cCol, [-0.85, 0, -0.35], 0.45) : building(s, mid, ctx.casterCiv, cCol, [-0.85, 0, -0.35], 0.36);
        back.group.rotation.y = Math.PI / 2;
      }
      const goHome = (a: Actor, at: number) => a.do(at, 'flee', { to: [-0.95, a.z], dur: 0.9, face: BACK });

      if (kind === 'arrows') {
        // A line of archers looses two volleys at every unit on the far bank.
        agents = [0, 1, 2, 3].map((i) => T.person(ctx.casterCiv, ctx.casterCiv === 'inca' ? 'slinger' : 'archer', cCol, [-0.62 - (i % 2) * 0.08, lane(i, 4, 0.4)], FWD));
        const lost = ctx.victimUnitsLost.map((id) => ({ id, dies: true })), alive = ctx.victimUnits.map((id) => ({ id, dies: false }));
        const shown = [...lost, ...alive].slice(0, 5);
        const victims = shown.map((u, i) => ({ ...u, a: T.squad(u.id, ctx.victimCiv, vCol, [0.45, lane(i, shown.length, 0.45)], BACK, { max: 1 }) }));
        const marks = victims.flatMap((v) => v.a);
        agents.forEach((a, i) => {
          const act = shootAct(a);
          [0.7, 1.5].forEach((t0) => {
            if (e.outcome !== 'hit' && t0 > 1) return;
            a.do(t0 + i * 0.05, act, { dur: SHOT_DUR[act] });
            T.volley([a], marks.length ? [marks[i % marks.length]] : [new THREE.Vector3(0.45, 0, lane(i, 4, 0.4))], t0 + i * 0.05, missileOf(a), cCol);
          });
          a.do(2.4, 'idle');
        });
        if (e.outcome === 'hit') victims.forEach((v) => v.a.forEach((a, k) => { a.do(1.0, 'cower'); if (v.dies) a.do(2.0 + k * 0.08, 'fall', { dur: 0.55 }); else a.do(2.4, 'idle'); }));
        else if (e.outcome === 'foiled') agents.forEach((a) => goHome(a, 1.8));
        else agents.forEach((a, i) => a.do(1.7 + i * 0.05, 'cower'));
        return;
      }

      const role: Role = kind === 'fire' ? 'torchbearer' : kind === 'steal' ? 'raider' : kind === 'sack' ? 'raider' : 'saboteur';
      if (kind === 'blockade' || kind === 'landing') {
        const v = T.machine(ctx.casterCiv, kind === 'blockade' ? 'galley' : 'trader', cCol, [-0.8, 0.25], FWD, ['marine', 'rower', 'rower']);
        agents = [v];
        v.do(0.4, 'march', { to: [RIVER_C, 0.25], dur: 1.3 });
        if (kind === 'landing') {
          const crew = [0, 1, 2].map((i) => T.person(ctx.casterCiv, 'marine', cCol, [RIVER_C, 0.25 + (i - 1) * 0.08], FWD));
          crew.forEach((c) => { c.reveal(0); c.do(0, 'idle'); });
          crew.forEach((c, i) => c.do(1.7, 'charge', { to: [0.48, (i - 1) * 0.15], dur: 0.6 }));
          crew.forEach((c) => repeat(c, 'thrust', 2.35, 3.2, 0.45));
          if (e.outcome !== 'hit') crew.forEach((c) => { c.beats = c.beats.filter((b) => b.at < 1.7); goHome(c, 1.8); });
          agents.push(...crew);
        }
      } else {
        const n = kind === 'sack' ? 5 : 2;
        agents = Array.from({ length: n }, (_, i) => T.person(ctx.casterCiv, kind === 'sack' && i % 2 ? 'infantry' : role, cCol, [-0.95 - (i % 2) * 0.08, lane(i, n, 0.2)], FWD, kind === 'sack' ? { weapon: 'torch' } : undefined));
        agents.forEach((a) => {
          a.do(0.3, kind === 'sack' ? 'march' : 'sneak', { to: [NEAR_BANK, a.z], dur: 0.6 }).do(0.9, kind === 'sack' ? 'wade' : 'sneak', { to: [FAR_BANK + 0.05, a.z * 0.7], dur: 0.7 });
        });
      }
      const strikeAt = 1.7;
      if (e.outcome === 'foiled') {
        // The watch spots them: torches flare, the intruders run.
        // A hidden trap: defenders burst out of the building itself. Otherwise the watch spots them.
        const watch = trap
          ? trap.cards.slice(0, 3).map((id, i) => T.person(ctx.victimCiv, getCard(id).kind === 'unit' ? 'infantry' : 'sentry', vCol, [0.68, (i - 1) * 0.16], BACK))
          : [0, 1].map((i) => T.person(ctx.victimCiv, 'sentry', vCol, [0.52, (i - 0.5) * 0.3], BACK, { weapon: i ? 'torch' : 'spear' }));
        watch.forEach((w) => w.do(1.3, 'point', { dur: 0.4 }).do(1.7, 'charge', { to: [FAR_BANK + 0.12, w.z], dur: 0.5 }).do(2.3, 'command'));
        agents.forEach((a) => { if (a.vehicle) { a.do(1.75, 'march', { to: [-0.8, a.z], dur: 1.2, face: BACK }); return; } a.beats = a.beats.filter((b) => b.at < 1.6); a.do(1.6, 'cower', { dur: 0.3 }); goHome(a, 1.9); });
        return;
      }
      const tx = target!.group.position.x;
      if (kind === 'fire') agents.forEach((a, i) => { a.do(strikeAt + i * 0.1, 'throw', { dur: 0.55 }); T.missile('torch', FIRE, a.chest(0.25), new THREE.Vector3(tx, 0.25, (i - 0.5) * 0.1), strikeAt + i * 0.1 + 0.3, 0.5); });
      if (kind === 'saboteurs' || kind === 'sack') agents.forEach((a) => { a.do(strikeAt - 0.1, 'run', { to: [tx - 0.18, a.z * 0.6], dur: 0.4 }); repeat(a, kind === 'sack' ? 'throw' : 'hammer', strikeAt + 0.3, 2.9, 0.45); });
      if (kind === 'steal') agents.forEach((a) => { if (a.figure) a.figure.load = false; a.do(strikeAt - 0.1, 'run', { to: [tx - 0.17, a.z], dur: 0.4 }).do(strikeAt + 0.3, 'lift', { dur: 0.6 }); });
      if (kind === 'blockade') agents[0].do(1.7, 'idle');
      if (e.outcome === 'mirrored') {
        // The reversal: a violet flash, and the scheme is carried back to the caster's own bank.
        const bx = back!.group.position.x + 0.2, bz = back!.group.position.z;
        agents.forEach((a, i) => {
          a.beats = a.beats.filter((b) => b.at < 1.5);
          if (a.vehicle) { a.do(1.5, 'march', { to: [-0.55, -0.3], dur: 1.0, face: BACK }); return; }
          a.do(1.5, 'stagger', { dur: 0.4 }).do(1.9, 'run', { to: [bx, bz + (i - 0.5) * 0.12], dur: 0.8, face: BACK });
          if (kind === 'fire') { a.do(2.75, 'throw', { dur: 0.55 }); T.missile('torch', FIRE, new THREE.Vector3(bx, 0.3, bz), back!.group.position.clone().setY(0.2), 3.05, 0.4); }
          else repeat(a, 'hammer', 2.75, 3.6, 0.45);
        });
        return;
      }
      // Hit: then away home (thieves with their sacks).
      if (kind === 'steal') agents.forEach((a) => { goHome(a, 2.6); });
      else if (kind !== 'blockade' && kind !== 'landing') agents.forEach((a) => goHome(a, 3.0));
    },
    update(s, t) {
      T.reveal(seg(t, 0, 0.5));
      if (target) s.reveal(target, seg(t, 0, 0.5));
      if (back) s.reveal(back, seg(t, 0, 0.5));
      T.update(t);
      if (kind === 'steal') agents.forEach((a) => { if (a.figure) a.figure.load = t > 2.0 && e.outcome === 'hit'; });
      s.frame(t < 1.4 ? -0.1 : e.outcome === 'mirrored' && t > 2 ? -0.45 : 0.3, 0, t < 1.4 ? 1.0 : 1.12);
      if (trap && t > 1.3) s.once('trapfx', () => { if (target) s.burst(target.group.position.clone().setY(0.2), VIOLET, 80, { speed: 0.8, gravity: 0.5 }); s.label('Hidden trap!', [0.5, 0.62, 0], '#e2d4ff', 1.4, 0.34); });
      if (trap && e.outcome === 'hit' && trap.absorbed > 0 && t > 2.3) s.once('soak', () => s.label(`Trap soaks ${trap.absorbed}`, [0.5, 0.7, 0], '#e2d4ff', 1.3, 0.26));
      if (e.outcome === 'foiled' && t > 1.5) s.once('foil', () => s.label('Foiled', [0.3, 0.8, 0], '#d9c6ff'));
      if (e.outcome === 'mirrored' && t > 1.5) s.once('mirror', () => { s.burst([FAR_BANK + 0.1, 0.25, 0], VIOLET, 80, { speed: 1 }); s.label('Reversed!', [0.2, 0.85, 0], '#e2d4ff', 1.6); });
      const victimHit = e.outcome === 'hit' ? target : e.outcome === 'mirrored' ? back : null;
      const gone = e.outcome === 'hit' ? ctx.destroyed.target : ctx.destroyed.mirror;
      const hitT = e.outcome === 'mirrored' ? 3.0 : 2.1;
      if (victimHit && kind !== 'arrows') {
        if (kind === 'fire' || kind === 'sack') { if (t > hitT && t < hitT + 1.6 && Math.floor(t * 12) % 2 === 0) s.burst(victimHit.group.position.clone().setY(0.18), FIRE, 8, { speed: 0.3, gravity: -0.6, ttl: 0.8, size: 0.04 }); }
        if (kind === 'saboteurs' || kind === 'blockade') victimHit.uniforms.uGlitch.value = t > hitT && t < hitT + 1.4 ? 1 : 0;
        if (kind === 'steal' || kind === 'blockade' || kind === 'landing') { if (t > hitT) s.once('drain', () => s.burst(victimHit.group.position.clone().setY(0.3), GOLD, 50, { speed: 0.6, gravity: 0.8 })); }
        if (gone) { if (t > hitT + 0.2) s.shatter(victimHit, seg(t, hitT + 0.2, hitT + 1.3, false)); }
        else victimHit.uniforms.uHeat.value = Math.sin(Math.PI * seg(t, hitT, hitT + 1.2)) * (kind === 'saboteurs' ? 0.3 : 0.8);
      }
      s.fadeAll(seg(t, dur - 0.4, dur));
    },
  };
}

// ===================================================================== construction and growth

type Work = { crew: Role[]; act: Act; sledge?: boolean; pack?: boolean; ship?: boolean; sparks?: boolean };

/** Who builds what: chosen from the card's tags, so new buildings get a fitting crew. */
export function workFor(c: CardDef): Work {
  const tags = c.tags ?? [];
  if (c.rarity === 'wonder' || tags.includes('stele') || c.art === 'masonry' || c.art === 'pyramid') return { crew: ['mason', 'mason', 'carrier', 'worker', 'worker'], act: 'hammer', sledge: true };
  if (tags.includes('farm')) return { crew: ['farmer', 'farmer', 'farmer'], act: 'harvest' };
  if (tags.includes('harbor')) return { crew: ['carrier', 'merchant', 'carrier'], act: 'carry', ship: true };
  if (tags.includes('market') || tags.includes('trade')) return { crew: ['merchant', 'merchant', 'carrier'], act: 'carry', pack: true };
  if (tags.includes('temple')) return { crew: ['mason', 'carrier', 'priest'], act: 'hammer', sledge: true };
  if (tags.includes('forge') || tags.includes('workshop')) return { crew: ['artisan', 'artisan', 'carrier'], act: 'hammer', sparks: true };
  if (tags.includes('road') || tags.includes('canal')) return { crew: ['worker', 'worker', 'worker'], act: 'dig' };
  if (tags.includes('granary') || tags.includes('archive')) return { crew: ['carrier', 'carrier', tags.includes('archive') ? 'scribe' : 'worker'], act: 'carry' };
  if (tags.includes('walls')) return { crew: ['mason', 'mason', 'carrier'], act: 'hammer' };
  return { crew: ['worker', 'worker', 'carrier'], act: 'hammer' };
}

/** A development (one-shot growth): who celebrates or works, from its art/effects. */
function developmentCrew(c: CardDef): { crew: Role[]; act: Act; pack?: boolean; coins?: boolean; sparks?: boolean } {
  if (c.art === 'festival') return { crew: ['dancer', 'dancer', 'citizen', 'citizen', 'priest'], act: 'dance' };
  if (c.art === 'caravan') return { crew: ['merchant', 'merchant'], act: 'walk', pack: true };
  if (c.art === 'coin') return { crew: ['artisan', 'artisan', 'merchant'], act: 'hammer', coins: true };
  if (c.art === 'guilds') return { crew: ['artisan', 'artisan', 'artisan'], act: 'hammer', sparks: true };
  return { crew: ['mason', 'mason', 'worker', 'carrier'], act: 'hammer' };
}

/** A Civilization card: your city at its Age, and that culture's people raising the new work. */
export function growScene(cardId: string, civ: CivId, age: number, mine: boolean, progress?: number): Vignette {
  const c = getCard(cardId);
  const color = col(mine);
  const isBuilding = c.kind === 'building';
  const gain = progress ?? c.progress ?? 0;
  const big = c.rarity === 'wonder';
  const dur = isBuilding ? (big ? 4.2 : 3.4) : 3.0;
  let T!: Troupe;
  let home!: HoloModel, b: HoloModel | null = null;
  return {
    duration: dur,
    caption: `${mine ? 'Your' : 'Their'} civilization grows: ${c.name}${gain ? ` · +${gain} Progress` : ''}`,
    tone: mine ? 'mine' : 'theirs',
    setup(s) {
      T = new Troupe(s, 0.9);
      home = city(s, civ, age, color, isBuilding ? [-0.55, 0, -0.15] : [0, 0, -0.2], isBuilding ? 0.5 : 0.62);
      if (isBuilding) {
        b = building(s, cardId, civ, color, [0.35, 0, -0.05], big ? 0.62 : 0.45);
        const w = workFor(c);
        s.frame(0.2, 0, 1.25);
        w.crew.forEach((r, i) => {
          const side = i % 2 ? 1 : -1;
          const spot: [number, number] = [0.35 + side * 0.24, 0.18 + (i >> 1) * 0.08];
          const a = T.person(civ, r, color, r === 'carrier' ? [-0.25, 0.3 + i * 0.03] : spot, side > 0 ? BACK : FWD);
          if (r === 'carrier') { a.do(0.3, 'carry', { to: [0.15, 0.22], dur: 1.4 }).do(1.75, 'lift', { dur: 0.5 }).do(2.3, 'walk', { to: [-0.25, 0.3], dur: 1.2, face: BACK }); }
          else if (r === 'priest') a.do(0, 'idle').do(dur - 1.3, 'bow', { dur: 1 });
          else if (r === 'merchant') a.do(0.4, 'walk', { to: [spot[0], spot[1] + 0.1], dur: 1 }).do(1.5, 'point');
          else a.do(0.25 + i * 0.07, w.act);
        });
        if (w.sledge) {
          const sl = T.machine(civ, 'sledge', color, [-0.45, 0.42], FWD, [], 'worker', 3);
          sl.crew.forEach((f) => (f.root.rotation.y = 0));
          sl.do(0.3, 'march', { to: [0.05, 0.36], dur: 2.2 });
        }
        if (w.pack) { const p = T.machine(civ, PACK_ANIMAL[civ], color, [-0.6, 0.45], FWD); p.do(0.3, 'march', { to: [0.05, 0.42], dur: 1.8 }); }
        if (w.ship) { const sh = T.machine(civ, 'trader', color, [-0.1, 0.72], FWD, ['merchant', 'rower', 'rower']); sh.do(0.2, 'march', { to: [0.35, 0.62], dur: 1.6 }); }
      } else {
        const d = developmentCrew(c);
        s.frame(0, 0.1, 1.2);
        d.crew.forEach((r, i) => {
          const ang = (i / d.crew.length) * Math.PI - Math.PI / 2;
          const a = T.person(civ, r, color, [Math.sin(ang) * 0.45, 0.25 + Math.cos(ang) * 0.12], Math.sin(ang) > 0 ? BACK : FWD);
          if (d.act === 'walk') a.do(0.3, 'walk', { to: [a.x + 0.4, a.z], dur: 2 });
          else a.do(0.2 + i * 0.1, d.act);
          if (d.act === 'dance' && r !== 'dancer') a.do(0.3, 'cheer');
        });
        if (d.pack) [0, 1].forEach((i) => { const p = T.machine(civ, PACK_ANIMAL[civ], color, [-0.75 - i * 0.22, 0.4], FWD); p.do(0.3, 'march', { to: [0.15 - i * 0.22, 0.4], dur: 2.2 }); });
      }
    },
    update(s, t) {
      s.reveal(home, seg(t, 0, 0.5));
      T.reveal(seg(t, 0.1, 0.6));
      T.update(t);
      if (b) {
        // The building rises as the crew works.
        s.reveal(b, seg(t, 0.5, dur - 0.9, false));
        b.uniforms.uHeat.value = 0.2 * Math.sin(Math.PI * seg(t, 0.5, dur - 0.9));
        if (t > 0.6 && t < dur - 0.9 && Math.floor(t * 9) % 3 === 0) s.burst([b.group.position.x + (Math.random() - 0.5) * 0.2, 0.05, b.group.position.z + 0.1], DUST, 3, { speed: 0.25, gravity: 0.4, ttl: 0.5 });
        if (workFor(c).sparks && t > 0.5 && Math.floor(t * 10) % 2 === 0) s.burst([0.35, 0.08, 0.2], FIRE, 4, { speed: 0.4, gravity: 0.9, ttl: 0.4, size: 0.02 });
      } else if (c.art === 'coin' && t > 0.8 && t < 2.2 && Math.floor(t * 10) % 2 === 0) s.burst([0, 0.15, 0.2], GOLD, 5, { speed: 0.5, gravity: 0.9, ttl: 0.6 });
      if (t > dur - 1.4 && t < dur - 0.5 && Math.floor(t * 14) % 2 === 0) s.burst([isBuilding ? 0.35 : 0, 0.2, 0], GOLD, 5, { speed: 0.4, gravity: -0.6, ttl: 0.9, size: 0.035, up: 0.6 });
      if (gain && t > dur - 1.3) s.once('lbl', () => s.label(`+${gain} Progress`, [0, 0.95, 0], '#f3dfa6', 1.2, 0.34));
      s.fadeAll(seg(t, dur - 0.35, dur));
    },
  };
}

/** A new Age: the old settlement gives way to the next, and its people gather to cheer. */
export function ageUpScene(civ: CivId, age: number, ageName: string, mine: boolean): Vignette {
  const color = col(mine);
  let before!: HoloModel, after!: HoloModel, T!: Troupe;
  return {
    duration: 4.0,
    caption: `${mine ? 'You enter' : 'Your rival enters'} Age ${ROMAN[age - 1]}: ${ageName}`,
    tone: 'age',
    setup(s) {
      T = new Troupe(s, 0.9);
      before = city(s, civ, Math.max(1, age - 1), color, [0, 0, -0.15], 0.6);
      after = city(s, civ, age, color, [0, 0, -0.15], 0.75);
      s.frame(0, 0, 1.1);
      const ruler = T.person(civ, 'ruler', color, [0, 0.42], FWD);
      ruler.root.rotation.y = -Math.PI / 2;
      ruler.do(0, 'idle', { face: -Math.PI / 2 }).do(1.3, 'command', { face: -Math.PI / 2 });
      [-0.5, -0.3, 0.3, 0.5].forEach((x, i) => T.person(civ, i % 2 ? 'citizen' : 'worker', color, [x, 0.5 - Math.abs(x) * 0.2], -Math.PI / 2).do(0, 'idle', { face: Math.PI / 2 }).do(1.6 + i * 0.05, 'cheer', { face: Math.PI / 2 }));
    },
    update(s, t) {
      s.reveal(before, seg(t, 0, 0.5));
      T.reveal(seg(t, 0.2, 0.7));
      T.update(t);
      s.dissolve(before, seg(t, 1.0, 1.5));
      if (t > 1.2) s.once('ring', () => { s.burst([0, 0.05, 0], GOLD, 160, { speed: 1.3, gravity: 0.1, ttl: 1.4, size: 0.03 }); s.burst([0, 0.6, 0], color, 80, { speed: 0.8, gravity: 0.6, ttl: 1.2 }); });
      s.reveal(after, seg(t, 1.25, 2.8, false));
      if (t > 2.2) s.once('lbl', () => s.label(`Age ${ROMAN[age - 1]}`, [0, 0.8, 0], '#f3dfa6', 1.6, 0.46));
      s.fadeAll(seg(t, 3.6, 4.0));
    },
  };
}

/** Military deployment: each card's troop marches to the riverbank; forts are raised by masons at the water. */
export function deployScene(cardIds: string[], mine: boolean, civ: CivId): Vignette {
  const color = col(mine);
  const cards = cardIds.slice(0, 4).map(getCard);
  const forts = cards.filter((c) => c.kind !== 'unit');
  const units = cards.filter((c) => c.kind === 'unit');
  const names = [...new Set(cards.map((c) => c.name))];
  let T!: Troupe, F: HoloModel[] = [];
  const dur = forts.length ? 3.2 : 2.8;
  return {
    duration: dur,
    caption: `${names.join(' and ')} ${forts.length && !units.length ? 'rise on' : 'take position on'} ${mine ? 'your' : 'their'} riverbank`,
    tone: mine ? 'mine' : 'theirs',
    setup(s) {
      T = new Troupe(s);
      s.facing = mine ? OBLIQUE : -OBLIQUE;
      s.river(0.6, 0.38);
      s.frame(0.05, 0, 1.2);
      const per = units.length <= 1 ? 4 : units.length === 2 ? 3 : 2;
      units.forEach((c, i) => {
        const z = lane(i, units.length, Math.min(0.5, 0.2 * units.length));
        T.squad(c.id, civ, color, [-0.9, z], FWD, { max: per, spread: 0.12 }).forEach((a, k) => {
          a.do(0.3, a.vehicle?.kind === 'horse' ? 'run' : 'march', { to: [0.2 - (k % 2) * 0.08, a.z], dur: 1.5 }).do(1.85, 'idle');
        });
      });
      F = forts.map((c, i) => { const m = building(s, c.id, civ, color, [0.3, 0, lane(i, forts.length, 0.3)], 0.32); m.group.rotation.y = Math.PI / 2; return m; });
      forts.forEach((_, i) => [0, 1].forEach((k) => T.person(civ, 'mason', color, [0.14, lane(i, forts.length, 0.3) + (k ? 0.12 : -0.12)], FWD).do(0.2 + k * 0.1, 'hammer')));
    },
    update(s, t) {
      T.reveal(seg(t, 0, 0.4));
      T.update(t);
      F.forEach((m) => s.reveal(m, seg(t, 0.3, dur - 0.8, false)));
      s.fadeAll(seg(t, dur - 0.35, dur));
    },
  };
}

/** A non-hostile military tactic: staged from what it does (rallying, relaying, repairing). */
export function tacticScene(cardId: string, mine: boolean, civ: CivId): Vignette {
  const c = getCard(cardId);
  const color = col(mine);
  const ops = (c.effects ?? []).map((e) => e.op);
  const buff = ops.includes('buffUnits') || ops.includes('readyUnits');
  const repair = ops.includes('repairAll') || ops.includes('repair');
  let T!: Troupe, walls: HoloModel | null = null;
  return {
    duration: 2.8,
    caption: c.name,
    tone: mine ? 'mine' : 'theirs',
    setup(s) {
      T = new Troupe(s, 0.9);
      s.frame(0, 0, 1.2);
      if (buff) {
        T.person(civ, 'ruler', color, [-0.45, 0], FWD).do(0.3, 'command');
        [0, 1, 2, 3].forEach((i) => T.person(civ, i % 3 === 2 ? 'archer' : 'infantry', color, [0.15 + (i % 2) * 0.12, lane(i, 4, 0.35)], BACK).do(0.9 + i * 0.05, 'cheer').do(1.8, 'brace'));
      } else if (repair) {
        walls = building(s, 'walls', civ, color, [0.1, 0, -0.1], 0.35);
        [0, 1, 2].forEach((i) => T.person(civ, i === 2 ? 'carrier' : 'mason', color, [-0.2 + i * 0.25, 0.22], i % 2 ? BACK : FWD).do(0.3 + i * 0.1, i === 2 ? 'lift' : 'hammer'));
      } else {
        // A relay: one runner hands the message to the next.
        const r1 = T.person(civ, 'runner', color, [-0.85, 0.05], FWD), r2 = T.person(civ, 'runner', color, [0.0, -0.05], FWD);
        r1.do(0.2, 'run', { to: [-0.08, 0.02], dur: 0.9 }).do(1.1, 'point', { dur: 0.3 }).do(1.4, 'idle');
        r2.do(0, 'idle').do(1.15, 'run', { to: [0.85, -0.05], dur: 0.9 });
      }
    },
    update(s, t) {
      T.reveal(seg(t, 0, 0.45));
      if (walls) { s.reveal(walls, seg(t, 0, 0.45)); walls.uniforms.uHeat.value = 0.3 * Math.sin(Math.PI * seg(t, 0.5, 2)); }
      T.update(t);
      if (buff) T.actors.forEach((a) => a.flash(0.5 * Math.sin(Math.PI * seg(t, 0.9, 1.9))));
      if (repair && t > 0.5 && t < 2 && Math.floor(t * 12) % 2 === 0) s.burst([(Math.random() - 0.5) * 0.6, 0.25, 0], GOLD, 6, { speed: 0.4, gravity: 0.8, ttl: 0.6 });
      if (!buff && !repair && t > 1.1) s.once('pass', () => s.burst([-0.05, 0.3, 0], GOLD, 40, { speed: 0.6 }));
      s.fadeAll(seg(t, 2.45, 2.8));
    },
  };
}

// ===================================================================== collapse, signatures, victory

export function collapseScene(cardId: string, mine: boolean, civ: CivId): Vignette {
  let m!: HoloModel, T!: Troupe;
  const color = col(mine);
  return {
    duration: 2.4,
    caption: `${getCard(cardId).name} collapses`,
    tone: mine ? 'theirs' : 'mine',
    setup(s) {
      T = new Troupe(s, 0.9);
      m = building(s, cardId, civ, color, [0, 0, -0.1], 0.55); s.reveal(m, 1);
      s.frame(0, 0, 1.2);
      [-1, 1].forEach((side) => T.person(civ, 'citizen', color, [side * 0.18, 0.25], side > 0 ? FWD : BACK).do(0.3, 'cower').do(0.8, 'flee', { to: [side * 0.8, 0.35], dur: 1.0 }));
    },
    update(s, t) {
      T.reveal(1); T.update(t);
      if (t > 0.35) s.shatter(m, seg(t, 0.35, 1.8, false)); else shake(m, 1, t);
      if (t > 0.4) s.once('dust', () => s.burst([0, 0.1, 0], DUST, 90, { speed: 0.6, gravity: 0.4, ttl: 1.2, size: 0.035 }));
      s.fadeAll(seg(t, 2.0, 2.4));
    },
  };
}

export interface SignatureCtx { civ: CivId; age: number; rivalCiv: CivId; rivalUnits: string[]; rivalUnitsLost: string[] }

/** Each civilization's signature, acted out by its own people. */
export function signatureScene(sig: string, mine: boolean, ctx: SignatureCtx): Vignette {
  const color = col(mine), rival = col(!mine);
  const civ = ctx.civ;
  if (civ === 'kush') {
    // Rain of Arrows uses the same staging as Arrow Storm.
    const v = schemeScene({ type: 'scheme', caster: 0, cardId: 'arrowStorm', targetCardId: null, outcome: 'hit', mirrorTargetCardId: null, trap: null }, mine,
      { casterCiv: civ, victimCiv: ctx.rivalCiv, victimAge: 1, casterAge: ctx.age, victimUnits: ctx.rivalUnits, victimUnitsLost: ctx.rivalUnitsLost, destroyed: { target: false, mirror: false } });
    return { ...v, caption: `${sig}${ctx.rivalUnitsLost.length ? ` — ${plural(ctx.rivalUnitsLost.length, 'unit')} fall` : ''}`, tone: 'reverse' };
  }
  let T!: Troupe, home!: HoloModel, theirs: HoloModel | null = null;
  return {
    duration: 3.6,
    caption: sig,
    tone: 'reverse',
    setup(s) {
      T = new Troupe(s, 0.9);
      home = city(s, civ, ctx.age, color, [civ === 'carthage' ? -0.55 : 0, 0, -0.2], 0.6);
      s.frame(0, 0, 1.15);
      if (civ === 'aksum') {
        // Red Sea Commerce: ships and camel caravans bring the world's trade home.
        T.machine(civ, 'trader', color, [-0.9, 0.5], FWD, ['merchant', 'rower', 'rower']).do(0.2, 'march', { to: [-0.2, 0.45], dur: 2 });
        [0, 1].forEach((i) => T.machine(civ, 'camel', color, [0.9 + i * 0.25, 0.25], BACK).do(0.3, 'march', { to: [0.35 + i * 0.25, 0.25], dur: 1.8 }));
        T.person(civ, 'merchant', color, [0.6, 0.35], BACK).do(0.3, 'walk', { to: [0.15, 0.3], dur: 1.6 }).do(2, 'point');
      } else if (civ === 'carthage') {
        // Close the Sea Lanes: war galleys sweep the rival's shipping away.
        theirs = city(s, ctx.rivalCiv, 2, rival, [0.65, 0, -0.25], 0.4);
        [0, 1].forEach((i) => T.machine(civ, 'galley', color, [-0.9, 0.3 + i * 0.2], FWD, ['marine', 'rower', 'rower']).do(0.2 + i * 0.2, 'march', { to: [0.2, 0.3 + i * 0.2], dur: 2 }));
      } else if (civ === 'sumer') {
        // Rebuild the City: crews swarm the walls.
        [0, 1, 2, 3].forEach((i) => T.person(civ, i === 3 ? 'carrier' : 'mason', color, [-0.4 + i * 0.27, 0.3], i % 2 ? BACK : FWD).do(0.2 + i * 0.1, i === 3 ? 'lift' : 'hammer'));
      } else {
        // Mountain Logistics: llama trains and chasqui runners along the Qhapaq Ñan.
        [0, 1, 2].forEach((i) => T.machine(civ, 'llama', color, [-0.95 - i * 0.2, 0.4], FWD).do(0.2, 'march', { to: [0.3 - i * 0.2, 0.4], dur: 2.4 }));
        T.person(civ, 'runner', color, [-0.9, 0.2], FWD).do(0.2, 'run', { to: [0.9, 0.2], dur: 1.6 });
        [0, 1].forEach((i) => T.person(civ, 'infantry', color, [0.5 + i * 0.15, -0.05], BACK).do(1.4, 'cheer'));
      }
    },
    update(s, t) {
      s.reveal(home, seg(t, 0, 0.5)); if (theirs) s.reveal(theirs, seg(t, 0, 0.5));
      T.reveal(seg(t, 0.1, 0.6)); T.update(t);
      if (t > 2.0) s.once('boon', () => { s.burst(home.group.position.clone().setY(0.4), GOLD, 120, { speed: 1, gravity: 0.3, ttl: 1.3 }); if (theirs) s.burst(theirs.group.position.clone().setY(0.3), rival, 50, { speed: 0.6 }); });
      if (theirs) theirs.uniforms.uGlitch.value = t > 2 && t < 2.8 ? 1 : 0;
      if (civ === 'sumer' && t > 0.5 && t < 2.3 && Math.floor(t * 12) % 2 === 0) s.burst([(Math.random() - 0.5) * 0.7, 0.25, 0.1], GOLD, 5, { speed: 0.4, gravity: 0.8, ttl: 0.6 });
      s.fadeAll(seg(t, 3.2, 3.6));
    },
  };
}

export function victoryScene(civ: CivId, age: number, won: boolean): Vignette {
  let m!: HoloModel, T!: Troupe;
  const color = col(won);
  return {
    duration: 4.2,
    caption: won ? 'Your civilization endures' : 'Your rival prevails',
    tone: won ? 'mine' : 'theirs',
    setup(s) {
      T = new Troupe(s, 0.9);
      m = city(s, civ, age, color, [0, 0, -0.2], 0.8);
      s.frame(0, 0, 1.05);
      T.person(civ, 'ruler', color, [0, 0.45], -Math.PI / 2).do(0, 'idle', { face: -Math.PI / 2 }).do(1.4, 'command', { face: -Math.PI / 2 });
      [-0.55, -0.35, -0.18, 0.18, 0.35, 0.55].forEach((x, i) => T.person(civ, (['infantry', 'citizen', 'dancer', 'citizen', 'archer', 'worker'] as Role[])[i], color, [x, 0.55 - Math.abs(x) * 0.25], Math.PI / 2).do(0, 'idle', { face: Math.PI / 2 }).do(1.5 + i * 0.07, i === 2 ? 'dance' : 'cheer', { face: Math.PI / 2 }));
    },
    update(s, t) {
      s.reveal(m, seg(t, 0, 1.6, false));
      T.reveal(seg(t, 0.4, 1.0)); T.update(t);
      if (Math.floor(t * 6) % 2 === 0 && t > 1.4 && t < 3.6) s.burst([0, 0.9, 0], color, 12, { speed: 0.9, gravity: 0.6, ttl: 1.1 });
    },
  };
}

// ===================================================================== close-up previews

/** Looping preview used in the card close-up: shows what the card does. */
export function previewScene(cardId: string): Vignette {
  const c = getCard(cardId);
  const civ: CivId = c.civ ?? 'sumer';
  if (c.family === 'civ') { const v = growScene(cardId, civ, Math.max(1, c.age), true); return { ...v, duration: v.duration + 0.6, caption: c.name }; }
  if (c.kind === 'fort') { const v = deployScene([cardId], true, civ); return { ...v, duration: v.duration + 0.6, caption: c.name }; }
  if (c.kind === 'tactic' && !c.hostile) return { ...tacticScene(cardId, true, civ), caption: c.name };
  const rival: CivId = civ === 'sumer' ? 'kush' : 'sumer';
  if (c.kind === 'unit') {
    // The troop crosses the river against a token defence and wins through.
    const v = battleScene({
      type: 'combat', attacker: 0, power: c.str ?? 2, blocked: 1, wallAbsorbed: 0, dealt: 2, attackerCards: [cardId], blockerCards: ['militia'],
      attackersLost: 0, blockersLost: 1, attackerFates: [null], blockerFates: [true], target: 'city', wallCard: null, reaction: null, cancelled: false, tideBack: 0, targetDestroyed: false, towerHits: 0, progressRaided: (c.keywords ?? []).includes('raider') ? 2 : 0, trap: null, blockerFromTrap: [false], reactions: [],
    }, true, { aCiv: civ, dCiv: rival, dAge: 2, aAge: 2 });
    return { ...v, caption: c.name };
  }
  if (c.kind === 'reaction') {
    const r = c.reaction!;
    if (r === 'vigilantWatch' || r === 'mirror') {
      return { ...schemeScene({ type: 'scheme', caster: 1, cardId: 'arson', targetCardId: 'temple', outcome: r === 'mirror' ? 'mirrored' : 'foiled', mirrorTargetCardId: 'market', trap: null }, false,
        { casterCiv: rival, victimCiv: civ, victimAge: 2, casterAge: 2, victimUnits: [], victimUnitsLost: [], destroyed: { target: false, mirror: false } }), caption: c.name };
    }
    const cancelled = r === 'feignedRetreat' || r === 'treaty';
    return { ...battleScene({
      type: 'combat', attacker: 1, power: 4, blocked: 4, wallAbsorbed: 0, dealt: 0, attackerCards: ['spearmen', 'spearmen', 'militia'], blockerCards: ['archers', 'spearmen'],
      attackersLost: cancelled ? 0 : 2, blockersLost: 0, attackerFates: cancelled ? [null, null, null] : r === 'ambush' ? ['ambush', null, 'ambush'] : ['melee', null, 'melee'], blockerFates: [false, false],
      target: 'city', wallCard: null, reaction: r, reactions: [r], cancelled, tideBack: r === 'turnTheTide' ? 3 : 0, targetDestroyed: false, towerHits: 0, progressRaided: 0, trap: null, blockerFromTrap: [false, false],
    }, false, { aCiv: rival, dCiv: civ, dAge: 2, aAge: 2 }), caption: c.name };
  }
  if (c.hostile) {
    return { ...schemeScene({ type: 'scheme', caster: 0, cardId, targetCardId: c.target === 'enemyBuilding' ? 'market' : null, outcome: 'hit', mirrorTargetCardId: null, trap: null }, true,
      { casterCiv: civ, victimCiv: rival, victimAge: 2, casterAge: 2, victimUnits: ['spearmen'], victimUnitsLost: ['archers', 'militia'], destroyed: { target: false, mirror: false } }), caption: c.name };
  }
  return { ...tacticScene(cardId, true, civ), caption: c.name };
}
