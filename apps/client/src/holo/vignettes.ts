import { getCard, type GameEvent } from '@pm/engine';
import * as THREE from 'three';
import { CIV_MONUMENT, type HoloModel } from './models';
import { MY_COLOR, OPP_COLOR, seg, type Stage, type Vignette } from './theater';

type CombatEv = Extract<GameEvent, { type: 'combat' }>;
type SchemeEv = Extract<GameEvent, { type: 'scheme' }>;

const RED = 0xff6a4a, FIRE = 0xffa040, VIOLET = 0xc8a2ff, POISON = 0x9be26a, WHITE = 0xffffff;
const name = (id: string) => (id === 'city' ? 'the city' : getCard(id).name);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Spread n items along z. */
const lane = (i: number, n: number, spread = 0.34) => (n <= 1 ? 0 : -spread + (2 * spread * i) / (n - 1));

function walk(m: HoloModel, from: number, to: number, p: number, t: number) {
  m.group.position.x = from + (to - from) * p;
  m.group.position.y = p > 0 && p < 1 ? Math.abs(Math.sin(t * 14 + m.group.position.z * 9)) * 0.025 : 0;
}

function shake(m: HoloModel, amt: number, t: number) {
  m.group.rotation.z = Math.sin(t * 60) * 0.04 * amt;
  m.uniforms.uHeat.value = Math.max(m.uniforms.uHeat.value * 0.92, amt);
}

// ===================================================================== battle

export function battleScene(e: CombatEv, attackerIsMe: boolean): Vignette {
  const aCol = attackerIsMe ? MY_COLOR : OPP_COLOR, dCol = attackerIsMe ? OPP_COLOR : MY_COLOR;
  const aCards = e.attackerCards.slice(0, 5), dCards = e.blockerCards.slice(0, 4);
  const aLost = Math.min(aCards.length, Math.round((e.attackersLost / Math.max(1, e.attackerCards.length)) * aCards.length));
  const dLost = Math.min(dCards.length, Math.round((e.blockersLost / Math.max(1, e.blockerCards.length)) * dCards.length));
  const R = e.reaction;
  let A: HoloModel[] = [], D: HoloModel[] = [], ambushers: HoloModel[] = [];
  let target!: HoloModel, wall: HoloModel | null = null, prop: THREE.Mesh | null = null;
  const fx = new Set<string>();
  const once = (k: string, fn: () => void) => { if (!fx.has(k)) { fx.add(k); fn(); } };

  const tgt = `${attackerIsMe ? 'their' : 'your'} ${e.target === 'city' ? 'city' : getCard(e.target).name}`;
  const rName = R ? getCard(({ shieldWall: 'shieldWall', ambush: 'ambush', feignedRetreat: 'feignedRetreat', turnTheTide: 'turnTheTide' } as Record<string, string>)[R] ?? 'shieldWall').name : '';
  const caption = e.cancelled ? `${rName}: the assault strikes empty ground`
    : e.tideBack > 0 ? `${rName}! ${e.tideBack} damage crashes back on the attacker`
    : e.dealt > 0 ? `${aCards.length === 1 ? getCard(aCards[0]).name : plural(aCards.length, 'unit')} ${aCards.length === 1 ? 'storms' : 'storm'} ${tgt}${R ? ` through ${rName}` : ''} — ${e.dealt} damage${e.targetDestroyed ? ', it falls' : ''}`
    : `${tgt[0].toUpperCase()}${tgt.slice(1)} holds${R ? ` with ${rName}` : ''}`;

  return {
    duration: e.cancelled ? 3.2 : 4.8,
    caption,
    tone: R ? 'reverse' : attackerIsMe ? 'mine' : 'theirs',
    setup(s) {
      A = aCards.map((c, i) => s.spawn(c, 'unit', aCol, [-0.95, 0, lane(i, aCards.length)], 1.2, true));
      D = dCards.map((c, i) => s.spawn(c, 'unit', dCol, [0.32, 0, lane(i, dCards.length, 0.28)], 1.2, false));
      target = s.spawn(e.target === 'city' ? 'city' : e.target, 'building', dCol, [0.82, 0, 0], 0.9);
      if (e.wallCard && e.wallCard !== e.target) { wall = s.spawn(e.wallCard, 'building', dCol, [0.55, 0, 0], 0.7); wall.group.rotation.y = Math.PI / 2; }
      if (R === 'ambush') ambushers = [-1, 1].map((side) => s.spawn('militia', 'unit', dCol, [-0.35, 0, side * 0.75], 1.1, false));
      if (R === 'shieldWall') {
        prop = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.38), new THREE.MeshBasicMaterial({ color: dCol, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
        prop.position.set(0.2, 0.19, 0); prop.rotation.y = Math.PI / 2; s.root.add(prop);
      }
      if (R === 'turnTheTide') {
        prop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 32, Math.PI), new THREE.MeshBasicMaterial({ color: dCol, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        prop.position.set(0.5, 0.0, 0); prop.rotation.y = Math.PI / 2; s.root.add(prop);
      }
    },
    update(s, t) {
      const rev = seg(t, 0, 0.6);
      [...A, ...D, target, ...(wall ? [wall] : [])].forEach((m) => s.reveal(m, rev));
      ambushers.forEach((m) => s.reveal(m, seg(t, 0.8, 1.0)));

      if (e.cancelled) { // Feigned Retreat: defenders melt away, attackers hit nothing
        const adv = seg(t, 0.6, 1.9);
        A.forEach((m) => walk(m, -0.95, 0.35, adv, t));
        D.forEach((m, i) => { walk(m, 0.32, 1.15, seg(t, 0.7, 1.4), t + i); s.dissolve(m, seg(t, 1.1, 1.5)); });
        if (t > 1.9) once('trip', () => { A.forEach((m) => s.burst(m.group.position.clone().setY(0.15), aCol, 18, { speed: 0.5 })); s.label('Empty ground', [0.2, 0.75, 0], '#d9c6ff'); });
        A.forEach((m) => { m.uniforms.uGlitch.value = t > 1.9 && t < 2.3 ? 1 : 0; });
        s.fadeAll(seg(t, 2.8, 3.2));
        return;
      }

      // Advance to the clash point.
      const meet = D.length ? 0.1 : wall ? 0.32 : 0.55;
      const adv = seg(t, 0.6, 1.6);
      A.forEach((m) => walk(m, -0.95, meet - 0.12, adv, t));

      if (R === 'ambush') {
        ambushers.forEach((m) => { m.group.position.z *= 1 - seg(t, 1.0, 1.3) * 0.08; });
        if (t > 1.25) once('ambush', () => { A.forEach((m) => s.burst(m.group.position.clone().setY(0.2), dCol, 25, { speed: 0.7 })); s.label('Ambush!', [-0.3, 0.8, 0], '#d9c6ff'); });
        ambushers.forEach((m) => s.dissolve(m, seg(t, 2.2, 2.6)));
      }
      if (R === 'shieldWall' && prop) (prop.material as THREE.MeshBasicMaterial).opacity = 0.35 * seg(t, 1.0, 1.4) * (1 - seg(t, 2.6, 3.0));

      // Clash
      if (t > 1.6) once('clash', () => { s.burst([meet, 0.2, 0], WHITE, 70, { speed: 1.1 }); if (D.length) s.burst([meet, 0.2, 0], dCol, 40, { speed: 0.8 }); });
      const die = seg(t, 1.7, 2.3);
      A.slice(A.length - aLost).forEach((m) => s.dissolve(m, die));
      D.slice(0, dLost).forEach((m) => s.dissolve(m, die));
      if (t > 1.6 && t < 2.2) D.forEach((m) => { m.group.position.x = 0.32 + Math.sin(t * 40) * 0.01; });

      if (R === 'turnTheTide' && prop) {
        const w = seg(t, 1.9, 2.9, false);
        (prop.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.sin(Math.PI * w);
        prop.position.x = 0.5 - 1.7 * w;
        prop.scale.setScalar(0.8 + w * 0.6);
        A.slice(0, A.length - aLost).forEach((m) => { m.group.position.x = Math.min(m.group.position.x, prop!.position.x - 0.05); });
        if (t > 2.6 && e.tideBack > 0) once('tide', () => s.label(`−${e.tideBack} to their city`, [-0.6, 0.8, 0], '#d9c6ff', 1.6));
      }

      // Breakthrough
      const survivors = A.slice(0, A.length - aLost);
      if (e.wallAbsorbed > 0 || e.dealt > 0) {
        const push = seg(t, 2.3, 3.0);
        survivors.forEach((m) => walk(m, meet - 0.12, (wall ? 0.4 : 0.6), push, t));
        if (wall && e.wallAbsorbed > 0) {
          if (t > 2.9) once('wall', () => { s.burst([0.5, 0.25, 0], FIRE, 40, { speed: 0.7 }); s.label(`Walls −${e.wallAbsorbed}`, [0.5, 0.7, -0.3], '#ffd2a8'); });
          shake(wall, t > 2.9 && t < 3.4 ? 1 : 0, t);
        }
        if (e.dealt > 0 && t > 3.1) {
          once('hit', () => { s.burst([0.82, 0.35, 0], RED, 80, { speed: 1 }); s.label(`−${e.dealt}`, [0.82, 0.85, 0], '#ff9c86', 1.4, 0.4); });
          if (e.targetDestroyed) s.shatter(target, seg(t, 3.2, 4.4, false)); else shake(target, t < 3.6 ? 1 : 0, t);
        }
      } else if (t > 2.4) once('held', () => s.label('Held!', [0.5, 0.8, 0], attackerIsMe ? '#ffd2a8' : '#aef6ff'));
      s.fadeAll(seg(t, 4.3, 4.8));
    },
  };
}

// ===================================================================== schemes

export function schemeScene(e: SchemeEv, casterIsMe: boolean, destroyed: { target: boolean; mirror: boolean }): Vignette {
  const cCol = casterIsMe ? MY_COLOR : OPP_COLOR, dCol = casterIsMe ? OPP_COLOR : MY_COLOR;
  const card = getCard(e.cardId);
  const tgtId = e.targetCardId ?? (e.cardId === 'poison' ? 'granary' : e.cardId === 'carth_blockade' ? 'aksum_adulis' : 'city');
  const fxColor = e.cardId === 'arson' ? FIRE : e.cardId === 'saboteurs' || e.cardId === 'carth_blockade' ? VIOLET : e.cardId === 'poison' ? POISON : RED;
  let agent!: HoloModel, target!: HoloModel, back: HoloModel | null = null;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: fxColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const fired = new Set<string>();
  const once = (k: string, fn: () => void) => { if (!fired.has(k)) { fired.add(k); fn(); } };
  const caption = e.outcome === 'foiled' ? `${card.name} is caught and foiled`
    : e.outcome === 'mirrored' ? `Mirror the Scheme! ${card.name} turns on its caster`
    : `${card.name}${e.targetCardId ? ` strikes ${name(e.targetCardId)}` : ''}`;

  const strike = (s: Stage, m: HoloModel, t: number, start: number, gone: boolean) => {
    const p = seg(t, start, start + 1.3, false);
    if (p <= 0) return;
    if (e.cardId === 'arson' && p < 0.9 && Math.floor(t * 12) % 2 === 0) s.burst(m.group.position.clone().setY(0.2), FIRE, 10, { speed: 0.35, gravity: -0.6, ttl: 0.8, size: 0.04 });
    if (e.cardId === 'poison' && p < 0.9 && Math.floor(t * 10) % 2 === 0) s.burst(m.group.position.clone().setY(0.45), POISON, 8, { speed: 0.2, gravity: 0.5, ttl: 0.9 });
    if (e.cardId === 'saboteurs' || e.cardId === 'carth_blockade') { m.uniforms.uGlitch.value = p < 1 ? 1 : 0; m.group.rotation.z = Math.sin(t * 9) * 0.06 * (1 - p); }
    if (gone) s.shatter(m, seg(t, start + 0.4, start + 1.5, false));
    else m.uniforms.uHeat.value = Math.sin(Math.PI * p) * (e.cardId === 'saboteurs' ? 0.2 : 0.8);
  };

  return {
    duration: 3.6,
    caption,
    tone: e.outcome === 'hit' ? (casterIsMe ? 'mine' : 'theirs') : 'reverse',
    setup(s) {
      agent = e.cardId === 'carth_blockade' ? s.spawn('carth_quinq', 'unit', cCol, [-0.75, 0, 0], 1.1, true) : s.spawn('militia', 'unit', cCol, [-0.75, 0, 0], 1.3, true);
      target = s.spawn(tgtId, 'building', dCol, [0.6, 0, 0], 0.95);
      if (e.outcome === 'mirrored' && e.mirrorTargetCardId) back = s.spawn(e.mirrorTargetCardId, 'building', cCol, [-0.75, 0, -0.45], 0.8);
      orb.visible = false;
      s.root.add(orb);
    },
    update(s, t) {
      const rev = seg(t, 0, 0.5);
      s.reveal(agent, rev); s.reveal(target, rev); if (back) s.reveal(back, rev);
      const fly = seg(t, 0.6, 1.3);
      orb.visible = t > 0.6 && t < (e.outcome === 'hit' ? 1.35 : 2.2);
      orb.position.set(-0.7 + 1.25 * fly, 0.28 + Math.sin(fly * Math.PI) * 0.35, 0);
      if (e.outcome === 'hit') {
        if (t > 1.3) once('hit', () => s.burst([0.6, 0.3, 0], fxColor, 60, { speed: 0.8 }));
        strike(s, target, t, 1.3, destroyed.target);
      } else if (e.outcome === 'foiled') {
        if (t > 1.3) once('foil', () => { s.burst([0.38, 0.3, 0], MY_COLOR === dCol ? MY_COLOR : OPP_COLOR, 70, { speed: 0.9 }); s.label('Foiled', [0.3, 0.8, 0], '#d9c6ff'); });
        orb.visible = t < 1.32;
        s.dissolve(agent, seg(t, 1.6, 2.2));
      } else {
        // Reversal: the orb ricochets off a mirror flash and returns to the caster's own city.
        const ret = seg(t, 1.35, 2.1);
        if (t > 1.3) once('mirror', () => { s.burst([0.4, 0.3, 0], VIOLET, 60, { speed: 1 }); s.label('Reversed!', [0.35, 0.85, 0], '#e2d4ff', 1.6); });
        if (t > 1.3) orb.position.set(0.55 - 1.3 * ret, 0.28 + Math.sin(ret * Math.PI) * 0.4, -0.45 * ret);
        if (back) strike(s, back, t, 2.1, destroyed.mirror);
        else if (t > 2.1) once('self', () => s.burst(agent.group.position.clone().setY(0.2), fxColor, 50, { speed: 0.7 }));
      }
      s.fadeAll(seg(t, 3.2, 3.6));
    },
  };
}

// ===================================================================== simple scenes

export function raiseScene(cardId: string, mine: boolean): Vignette {
  const c = getCard(cardId);
  const big = c.rarity === 'wonder';
  let m!: HoloModel;
  return {
    duration: big ? 2.8 : 1.7,
    caption: `${c.name} rises`,
    tone: mine ? 'mine' : 'theirs',
    setup(s) { m = s.spawn(cardId, 'building', mine ? MY_COLOR : OPP_COLOR, [0, 0, 0], big ? 1.5 : 1.25); },
    update(s, t) {
      s.reveal(m, seg(t, 0.1, big ? 2.0 : 1.2, false));
      m.group.rotation.y = t * 0.4;
      if (t > 0.1) { const k = Math.floor(t * 8); if (k % 3 === 0 && t < (big ? 2 : 1.2)) s.burst([0, 0.02, 0], mine ? MY_COLOR : OPP_COLOR, 4, { speed: 0.4, gravity: 0.3, ttl: 0.6 }); }
      s.fadeAll(seg(t, (big ? 2.8 : 1.7) - 0.35, big ? 2.8 : 1.7));
    },
  };
}

export function collapseScene(cardId: string, mine: boolean): Vignette {
  let m!: HoloModel;
  return {
    duration: 2.0,
    caption: `${getCard(cardId).name} collapses`,
    tone: mine ? 'theirs' : 'mine',
    setup(s) { m = s.spawn(cardId, 'building', mine ? MY_COLOR : OPP_COLOR, [0, 0, 0], 1.25); s.reveal(m, 1); },
    update(s, t) {
      if (t > 0.35) s.shatter(m, seg(t, 0.35, 1.8, false));
      else shake(m, 1, t);
      if (t > 0.4 && t < 0.45) s.burst([0, 0.1, 0], 0xd9c39a, 90, { speed: 0.6, gravity: 0.4, ttl: 1.2, size: 0.035 });
    },
  };
}

export function signatureScene(civ: string, sig: string, mine: boolean): Vignette {
  let m!: HoloModel;
  const col = mine ? MY_COLOR : OPP_COLOR;
  return {
    duration: 2.6,
    caption: sig,
    tone: 'reverse',
    setup(s) { m = s.spawn(CIV_MONUMENT[civ] ?? 'temple', 'building', col, [0, 0, 0], 1.5); },
    update(s, t) {
      s.reveal(m, seg(t, 0, 0.8));
      m.group.rotation.y = t * 1.6;
      if (t > 0.9 && t < 0.95) s.burst([0, 0.5, 0], col, 120, { speed: 1.2, gravity: 0.2, ttl: 1.3 });
      s.fadeAll(seg(t, 2.2, 2.6));
    },
  };
}

export function victoryScene(civ: string, won: boolean): Vignette {
  let m!: HoloModel;
  const col = won ? MY_COLOR : OPP_COLOR;
  return {
    duration: 3.6,
    caption: won ? 'Your civilization endures' : 'Your rival prevails',
    tone: won ? 'mine' : 'theirs',
    setup(s) { m = s.spawn(CIV_MONUMENT[civ] ?? 'temple', 'building', col, [0, 0, 0], 1.8); },
    update(s, t) {
      s.reveal(m, seg(t, 0, 1.6, false));
      m.group.rotation.y = t * 0.5;
      if (Math.floor(t * 6) % 2 === 0 && t > 1.2 && t < 3) s.burst([0, 0.9, 0], col, 12, { speed: 0.9, gravity: 0.6, ttl: 1.1 });
    },
  };
}

/** Looping preview used in the card close-up: shows what the card does. */
export function previewScene(cardId: string): Vignette {
  const c = getCard(cardId);
  if (c.kind === 'building') { const v = raiseScene(cardId, true); return { ...v, duration: v.duration + 1.4, caption: c.name }; }
  if (c.kind === 'unit') {
    let m: HoloModel[] = [];
    return {
      duration: 3, caption: c.name, tone: 'mine',
      setup(s) { m = [-0.25, 0.25].map((z) => s.spawn(cardId, 'unit', MY_COLOR, [-0.6, 0, z], 1.6, true)); },
      update(s, t) { m.forEach((x) => { s.reveal(x, seg(t, 0, 0.5)); walk(x, -0.6, 0.45, seg(t, 0.4, 2.2), t); }); if (t > 2.2 && t < 2.25) s.burst([0.55, 0.2, 0], WHITE, 50); s.fadeAll(seg(t, 2.6, 3)); },
    };
  }
  if (c.kind === 'reaction') {
    const r = c.reaction!;
    if (r === 'vigilantWatch' || r === 'mirror') {
      return schemeScene({ type: 'scheme', caster: 1, cardId: 'arson', targetCardId: 'temple', outcome: r === 'mirror' ? 'mirrored' : 'foiled', mirrorTargetCardId: 'market' }, false, { target: false, mirror: false });
    }
    return battleScene({
      type: 'combat', attacker: 1, power: 4, blocked: 4, wallAbsorbed: 0, dealt: 0, attackerCards: ['spearmen', 'spearmen', 'militia'], blockerCards: ['archers', 'spearmen'],
      attackersLost: r === 'feignedRetreat' ? 0 : 2, blockersLost: 0, target: 'city', wallCard: null, reaction: r, cancelled: r === 'feignedRetreat', tideBack: r === 'turnTheTide' ? 3 : 0, targetDestroyed: false,
    }, false);
  }
  if (c.hostile) return schemeScene({ type: 'scheme', caster: 0, cardId, targetCardId: c.target === 'enemyBuilding' ? 'market' : null, outcome: 'hit', mirrorTargetCardId: null }, true, { target: false, mirror: false });
  // Self-targeted actions: a quiet blessing on your city.
  let m!: HoloModel;
  return {
    duration: 2.4, caption: c.name, tone: 'mine',
    setup(s) { m = s.spawn('city', 'building', MY_COLOR, [0, 0, 0], 1.3); },
    update(s, t) { s.reveal(m, seg(t, 0, 0.6)); if (t > 0.8 && t < 0.85) s.burst([0, 0.6, 0], 0xf3dfa6, 100, { speed: 0.9, gravity: 0.4, ttl: 1.2 }); m.group.rotation.y = t * 0.3; s.fadeAll(seg(t, 2.0, 2.4)); },
  };
}
