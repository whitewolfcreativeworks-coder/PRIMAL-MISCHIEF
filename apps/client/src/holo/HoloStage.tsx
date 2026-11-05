import { getCard, getCiv, type GameEvent, type GameState, type PlayerId } from '@pm/engine';
import { useEffect, useRef, useState } from 'react';
import { Theater, type Vignette } from './theater';
import { battleScene, collapseScene, previewScene, raiseScene, schemeScene, signatureScene, victoryScene } from './vignettes';

/** Translate one batch of engine events into hologram scenes. */
export function scenesFor(events: GameEvent[], view: GameState, me: PlayerId, pace: number): Vignette[] {
  const out: Vignette[] = [];
  const covered = new Set<number>(); // indices of buildingDestroyed events already shown inside a battle or scheme
  // Destruction during combat is reported before the combat summary, so cover the whole batch up front.
  events.forEach((e) => {
    if (e.type === 'combat') events.forEach((x, j) => { if (x.type === 'buildingDestroyed' && x.player !== e.attacker) covered.add(j); });
  });
  events.forEach((e, i) => {
    if (e.type === 'combat') {
      out.push(battleScene(e, e.attacker === me));
    } else if (e.type === 'scheme') {
      const later = events.slice(i + 1);
      const defender = e.caster === 0 ? 1 : 0;
      const tIdx = later.findIndex((x) => x.type === 'buildingDestroyed' && x.player === defender && x.cardId === e.targetCardId);
      const mIdx = later.findIndex((x) => x.type === 'buildingDestroyed' && x.player === e.caster && x.cardId === e.mirrorTargetCardId);
      if (tIdx >= 0) covered.add(i + 1 + tIdx);
      if (mIdx >= 0) covered.add(i + 1 + mIdx);
      out.push(schemeScene(e, e.caster === me, { target: tIdx >= 0, mirror: mIdx >= 0 }));
    } else if (e.type === 'buildingRaised') {
      if (pace >= 1 || getCardRarity(e.cardId) === 'wonder') out.push(raiseScene(e.cardId, e.player === me));
    } else if (e.type === 'buildingDestroyed' && !covered.has(i)) {
      out.push(collapseScene(e.cardId, e.player === me));
    } else if (e.type === 'signature') {
      out.push(signatureScene(view.players[e.player].civ, e.name, e.player === me));
    } else if (e.type === 'gameOver') {
      out.push(victoryScene(view.players[e.winner].civ, e.winner === me));
    }
  });
  return out;
}

const getCardRarity = (id: string) => getCard(id).rarity;

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
