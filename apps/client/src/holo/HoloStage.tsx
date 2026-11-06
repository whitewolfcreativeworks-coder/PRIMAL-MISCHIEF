import { getCard, getCiv, type GameEvent, type GameState, type PlayerId } from '@pm/engine';
import { useEffect, useRef, useState } from 'react';
import { Theater, type Vignette } from './theater';
import { ageUpScene, battleScene, collapseScene, deployScene, growScene, previewScene, schemeScene, signatureScene, tacticScene, victoryScene } from './vignettes';

/**
 * Translate one batch of engine events into hologram scenes.
 * Full: every card gets a scene. Fast: only the big moments (battles, schemes, new Ages, wonders, signatures).
 */
export function scenesFor(events: GameEvent[], view: GameState, me: PlayerId, pace: number): Vignette[] {
  const out: Vignette[] = [];
  const full = pace >= 1;
  const P = view.players;
  const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
  const covered = new Set<number>(); // buildingDestroyed events already shown inside a battle or scheme
  events.forEach((e) => {
    if (e.type === 'combat') events.forEach((x, j) => { if (x.type === 'buildingDestroyed' && x.player !== e.attacker) covered.add(j); });
  });
  /** Units of `pid` destroyed by the event at index i (up to the next battle or scheme). */
  const lostAfter = (i: number, pid: PlayerId) => {
    const lost: string[] = [];
    for (const x of events.slice(i + 1)) {
      if (x.type === 'combat' || x.type === 'scheme' || x.type === 'signature') break;
      if (x.type === 'unitDestroyed' && x.player === pid) lost.push(x.cardId);
    }
    return lost;
  };
  const deployed: Record<PlayerId, string[]> = { 0: [], 1: [] };
  const flushDeploy = () => {
    for (const p of [0, 1] as PlayerId[]) if (deployed[p].length) { if (full) out.push(deployScene(deployed[p], p === me, P[p].civ)); deployed[p] = []; }
  };
  events.forEach((e, i) => {
    if (e.type !== 'unitDeployed' && !(e.type === 'buildingRaised' && getCard(e.cardId).kind === 'fort')) flushDeploy();
    switch (e.type) {
      case 'combat': {
        const d = other(e.attacker);
        out.push(battleScene(e, e.attacker === me, { aCiv: P[e.attacker].civ, dCiv: P[d].civ, aAge: P[e.attacker].age, dAge: P[d].age }));
        break;
      }
      case 'scheme': {
        const later = events.slice(i + 1);
        const victim = other(e.caster);
        const tIdx = later.findIndex((x) => x.type === 'buildingDestroyed' && x.player === victim && x.cardId === e.targetCardId);
        const mIdx = later.findIndex((x) => x.type === 'buildingDestroyed' && x.player === e.caster && x.cardId === e.mirrorTargetCardId);
        if (tIdx >= 0) covered.add(i + 1 + tIdx);
        if (mIdx >= 0) covered.add(i + 1 + mIdx);
        out.push(schemeScene(e, e.caster === me, {
          casterCiv: P[e.caster].civ, victimCiv: P[victim].civ, casterAge: P[e.caster].age, victimAge: P[victim].age,
          victimUnits: P[victim].units.map((u) => u.cardId), victimUnitsLost: lostAfter(i, victim), destroyed: { target: tIdx >= 0, mirror: mIdx >= 0 },
        }));
        break;
      }
      case 'grow': {
        const p = P[e.player];
        const wonder = getCard(e.cardId).rarity === 'wonder';
        // Show the city at the Age it was when the card was played (an Age-up scene follows if it advanced).
        const ageAfter = events.slice(i + 1).find((x) => x.type === 'ageUp' && x.player === e.player);
        const age = ageAfter && ageAfter.type === 'ageUp' ? ageAfter.age - 1 : p.age;
        if (full || wonder) out.push(growScene(e.cardId, p.civ, age, e.player === me, e.progress));
        break;
      }
      case 'ageUp': out.push(ageUpScene(P[e.player].civ, e.age, e.name, e.player === me)); break;
      case 'unitDeployed': deployed[e.player].push(e.cardId); break;
      case 'buildingRaised': if (getCard(e.cardId).kind === 'fort') deployed[e.player].push(e.cardId); break;
      case 'tactic': if (full) out.push(tacticScene(e.cardId, e.player === me, P[e.player].civ)); break;
      case 'buildingDestroyed': if (!covered.has(i)) out.push(collapseScene(e.cardId, e.player === me, P[e.player].civ)); break;
      case 'signature': {
        const r = other(e.player);
        out.push(signatureScene(e.name, e.player === me, { civ: P[e.player].civ, age: P[e.player].age, rivalCiv: P[r].civ, rivalUnits: P[r].units.map((u) => u.cardId), rivalUnitsLost: lostAfter(i, r) }));
        break;
      }
      case 'gameOver': out.push(victoryScene(P[e.winner].civ, P[e.winner].age, e.winner === me)); break;
    }
  });
  flushDeploy();
  return out;
}

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** The battle hologram projected over the table. */
export function HoloStage({ events, eventSeq, view, me, pace, onBusy }: {
  events: GameEvent[]; eventSeq: number; view: GameState; me: PlayerId; pace: number; onBusy: (busy: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const theater = useRef<Theater | null>(null);
  const [scene, setScene] = useState<Vignette | null>(null);
  const [ok] = useState(webglAvailable);

  useEffect(() => {
    if (!ok || !canvas.current) return;
    const t = new Theater(canvas.current);
    t.onChange = (v) => { setScene(v); onBusy(!!v); };
    theater.current = t;
    return () => { t.dispose(); theater.current = null; onBusy(false); };
  }, [ok]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (theater.current) theater.current.speed = pace >= 1 ? 1 : 1.8; }, [pace]);

  useEffect(() => {
    const t = theater.current;
    if (!t || pace === 0) return;
    for (const v of scenesFor(events, view, me, pace)) t.enqueue(v);
  }, [eventSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ok) return null;
  return (
    <div className={`holo ${scene ? 'on' : ''} tone-${scene?.tone ?? 'neutral'}`} onClick={() => theater.current?.skip()} aria-hidden={!scene}>
      <canvas ref={canvas} />
      {scene && <div className="holo-caption"><span>{scene.caption}</span><small>Tap to skip</small></div>}
    </div>
  );
}

/** A looping hologram of what a single card does, for the close-up view. */
export function HoloPreview({ cardId }: { cardId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ok] = useState(webglAvailable);
  useEffect(() => {
    if (!ok || !canvas.current) return;
    const t = new Theater(canvas.current);
    t.loop = () => previewScene(cardId);
    t.enqueue(previewScene(cardId));
    return () => t.dispose();
  }, [cardId, ok]);
  if (!ok) return null;
  return <div className="holo-preview"><canvas ref={canvas} /><span>Hologram</span></div>;
}

export const civName = (id: Parameters<typeof getCiv>[0]) => getCiv(id).name;
