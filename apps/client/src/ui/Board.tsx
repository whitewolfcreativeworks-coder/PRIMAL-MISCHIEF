import {
  actingPlayer, availableBlockers, canPlayCard, costOf, getCard, getCiv, HIDDEN_CARD, incomeOf, isWorking, maxIntegrity, other,
  playableReactions, readyAttackers, RULES, unitMaxHp, unitStr, workingBuildings,
  type BuildingInst, type GameEvent, type GameState, type PlayerId, type PlayerState, type UnitInst,
} from '@pm/engine';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { CardArt, CivEmblem } from '../art/motifs';
import { isMuted, play, setMuted } from '../audio';
import { LocalMatch, TutorialMatch, type AnyMatch } from '../game/match';
import type { Highlight } from '../game/tutorial';
import { HoloStage } from '../holo/HoloStage';
import { CardBack, CardFace, paletteFor } from './Card';
import { Icon } from './icons';
import { HowToPlay } from './HowToPlay';
import { Inspector } from './Inspector';

type Fx = Record<string, string>;
interface Ghost { key: string; owner: PlayerId; cardId: string; kind: 'building' | 'unit' }
interface Banner { key: number; text: string; sub?: string; tone: 'gold' | 'red' | 'violet' | 'plain' }
interface Floater { key: number; target: string; text: string; tone: string }

const sleepMs = (pace: number, ms: number) => Math.max(50, ms * Math.max(pace, 0.15));

export function Board({ match, onExit, onRematch, pace }: { match: AnyMatch; onExit: () => void; onRematch?: () => void; pace: number }) {
  const snap = useSyncExternalStore(match.subscribe, match.getSnapshot);
  const view = snap.view;
  const [selected, setSelected] = useState<string | null>(null);
  const [targeting, setTargeting] = useState<string | null>(null);
  const [attackers, setAttackers] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [reaction, setReaction] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{ cardId: string; owner: PlayerId; note?: string } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showHelp, setShowHelp] = useState(() => { if (match instanceof TutorialMatch) return false; try { return !localStorage.getItem('pm.seenHelp'); } catch { return false; } });
  const [confirmSig, setConfirmSig] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [fx, setFx] = useState<Fx>({});
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState<PlayerId | null>(null);
  const counter = useRef(0);
  const holoBusy = useRef(false);
  useEffect(() => { if (match instanceof LocalMatch || match instanceof TutorialMatch) match.setGate(() => holoBusy.current); }, [match]);
  const coach = snap.coach;
  const hl = (h: Highlight[] | undefined) => h ?? [];
  const glowHand = (cardId: string) => hl(coach?.step.highlight).some((h) => h.kind === 'hand' && h.cardId === cardId);
  const glowPiece = (kind: 'unit' | 'building', owner: 'me' | 'opp', cardId: string) => hl(coach?.step.highlight).some((h) => h.kind === kind && h.owner === owner && h.cardId === cardId);
  const glowBtn = (name: string) => (hl(coach?.step.highlight).some((h) => h.kind === 'button' && h.name === name) ? 'coach-glow' : '');

  const me = snap.me;
  const opp = other(me);
  const acting = view ? actingPlayer(view) : null;
  const myMain = !!view && view.phase === 'main' && acting === me;
  const responding = !!view && view.phase === 'response' && acting === me;
  const pendingKey = view?.pending ? JSON.stringify(view.pending) : '';

  // Reset transient selections whenever the situation changes.
  useEffect(() => { setBlockers([]); setReaction(null); }, [pendingKey]);
  useEffect(() => { if (!myMain) { setAttackers([]); setTargeting(null); setSelected(null); } }, [myMain]);

  // Rule errors -> toast
  useEffect(() => { if (snap.error) { setToast(snap.error); play('tap'); const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); } }, [snap.errorSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presentation: turn engine events into animations and sound.
  useEffect(() => {
    if (!view) return;
    const nextFx: Fx = {};
    const newGhosts: Ghost[] = [];
    const floats: Floater[] = [];
    let ban: Banner | null = null;
    const sounds = new Set<Parameters<typeof play>[0]>();
    const add = (target: string, text: string, tone: string) => floats.push({ key: ++counter.current, target, text, tone });
    for (const e of snap.events as GameEvent[]) {
      switch (e.type) {
        case 'buildingRaised': nextFx[e.uid] = 'fx-rise'; sounds.add('build'); break;
        case 'unitRecruited': nextFx[e.uid] = 'fx-arrive'; sounds.add('card'); break;
        case 'buildingDamaged': nextFx[e.uid] = 'fx-hit'; add(e.uid, `−${e.amount}`, 'red'); sounds.add('clash'); break;
        case 'buildingDestroyed': newGhosts.push({ key: `g${++counter.current}`, owner: e.player, cardId: e.cardId, kind: 'building' }); sounds.add('collapse'); break;
        case 'unitDestroyed': case 'unitDeserted':
          newGhosts.push({ key: `g${++counter.current}`, owner: e.player, cardId: e.cardId, kind: 'unit' });
          if (e.type === 'unitDeserted') add(e.player === me ? 'me' : 'opp', 'Deserted', 'red');
          break;
        case 'buildingUnrest': nextFx[e.uid] = 'fx-unrest'; break;
        case 'supportLost': nextFx[e.uid] = 'fx-crack'; break;
        case 'attackDeclared': for (const u of e.unitUids) nextFx[u] = 'fx-charge'; sounds.add('march');
          if (e.player !== me) ban = { key: ++counter.current, text: 'Under attack', sub: e.target.kind === 'city' ? 'Your city is the target' : 'A building is the target', tone: 'red' };
          break;
        case 'combat': if (e.power) sounds.add('clash'); break;
        case 'cityDamaged': add(e.player === me ? 'me' : 'opp', `−${e.amount}`, 'red'); setShake(e.player); setTimeout(() => setShake(null), 500); break;
        case 'reaction': if (pace > 0) { sounds.add('reaction'); break; } ban = { key: ++counter.current, text: getCard(e.cardId).name, sub: e.player === me ? 'Your reaction' : `${view.players[e.player].name} reacts!`, tone: 'violet' }; sounds.add('reaction'); break;
        case 'reversed': if (pace > 0) break; ban = { key: ++counter.current, text: 'Reversed!', sub: `${getCard(e.cardId).name} strikes its caster`, tone: 'violet' }; sounds.add('reaction'); break;
        case 'chain': add(e.player === me ? 'me' : 'opp', 'Chain +1', 'gold'); sounds.add('chain'); break;
        case 'signature': if (pace > 0) { sounds.add('reaction'); break; } ban = { key: ++counter.current, text: e.name, sub: view.players[e.player].name, tone: 'gold' }; sounds.add('reaction'); break;
        case 'resource': if (e.res === 'goods' && e.delta > 0 && e.player === me) sounds.add('coin'); break;
        case 'famine': add(e.player === me ? 'me' : 'opp', 'Famine', 'red'); break;
        case 'turnStart': if (!ban) ban = { key: ++counter.current, text: e.player === me ? 'Your turn' : `${view.players[e.player].name}'s turn`, tone: 'plain' }; sounds.add('turn'); break;
        case 'gameOver': sounds.add(e.winner === me ? 'victory' : 'defeat'); break;
      }
    }
    sounds.forEach((s) => play(s));
    if (Object.keys(nextFx).length) {
      setFx((f) => ({ ...f, ...nextFx }));
      setTimeout(() => setFx((f) => { const n = { ...f }; for (const k of Object.keys(nextFx)) if (n[k] === nextFx[k]) delete n[k]; return n; }), sleepMs(pace, 1100));
    }
    if (newGhosts.length) {
      setGhosts((g) => [...g, ...newGhosts]);
      setTimeout(() => setGhosts((g) => g.filter((x) => !newGhosts.includes(x))), sleepMs(pace, 1200));
    }
    if (floats.length) {
      setFloaters((f) => [...f, ...floats]);
      setTimeout(() => setFloaters((f) => f.filter((x) => !floats.includes(x))), sleepMs(pace, 1300));
    }
    if (ban && pace > 0) {
      setBanner(ban);
      const k = ban.key;
      setTimeout(() => setBanner((b) => (b?.key === k ? null : b)), sleepMs(pace, ban.tone === 'plain' ? 900 : 1500));
    }
  }, [snap.eventSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-pass a response window when there is literally nothing we could do.
  useEffect(() => {
    if (!responding || !view || snap.coach) return;
    if (availableBlockers(view, me).length === 0 && playableReactions(view, me).length === 0) {
      const t = setTimeout(() => match.send({ type: 'respond', blockerUids: [] }), sleepMs(pace, 900));
      return () => clearTimeout(t);
    }
  }, [responding, pendingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return <div className="center-note">Preparing the table…</div>;

  const P = view.players[me];
  const O = view.players[opp];
  const civ = getCiv(P.civ);
  const oppCiv = getCiv(O.civ);
  const pending = view.pending;
  const selCard = selected ? P.hand.find((c) => c.uid === selected) : undefined;
  const targetSpec = targeting ? getCard(P.hand.find((c) => c.uid === targeting)?.cardId ?? 'farm').target : undefined;
  const ready = new Set(myMain ? readyAttackers(view, me) : []);
  const canBlock = new Set(responding ? availableBlockers(view, me) : []);
  const reactable = new Set(responding ? playableReactions(view, me) : []);
  const attackPower = attackers.reduce((s, uid) => { const u = P.units.find((x) => x.uid === uid); return s + (u ? unitStr(P, u) : 0); }, 0);

  // ------------------------------------------------------------ interactions
  const send: AnyMatch['send'] = (a) => { play('tap'); match.send(a); };

  function tapHand(uid: string) {
    if (!myMain && !responding) { setSelected(uid); return; }
    if (responding) {
      if (reactable.has(uid)) setReaction((r) => (r === uid ? null : uid));
      else setSelected(uid);
      return;
    }
    setTargeting(null);
    setSelected((s) => (s === uid ? null : uid));
  }

  function playSelected() {
    if (!selCard) return;
    const card = getCard(selCard.cardId);
    if (card.target && card.target !== 'none') { setTargeting(selCard.uid); setSelected(null); return; }
    send({ type: 'play', uid: selCard.uid });
    setSelected(null);
  }

  function tapBuilding(owner: PlayerId, b: BuildingInst) {
    if (targeting && ((targetSpec === 'enemyBuilding' && owner === opp) || (targetSpec === 'ownBuilding' && owner === me))) {
      send({ type: 'play', uid: targeting, targetUid: b.uid });
      setTargeting(null);
      return;
    }
    if (myMain && attackers.length && owner === opp) {
      send({ type: 'attack', unitUids: attackers, target: { kind: 'building', uid: b.uid } });
      setAttackers([]);
      return;
    }
    const p = view!.players[owner];
    const working = isWorking(p, b.uid);
    const c = getCard(b.cardId);
    const note = b.unrest > 0 ? `In Unrest for ${b.unrest} more turn${b.unrest > 1 ? 's' : ''}.`
      : !working ? `Not working: needs a working ${c.requires?.join(' or ')}.` : `Integrity ${maxIntegrity(b) - b.damage}/${maxIntegrity(b)}.`;
    setInspect({ cardId: b.cardId, owner, note });
  }

  function tapUnit(owner: PlayerId, u: UnitInst) {
    if (owner === me && myMain && ready.has(u.uid)) {
      setAttackers((a) => (a.includes(u.uid) ? a.filter((x) => x !== u.uid) : [...a, u.uid]));
      play('tap');
      return;
    }
    if (owner === me && responding && canBlock.has(u.uid)) {
      setBlockers((b) => (b.includes(u.uid) ? b.filter((x) => x !== u.uid) : [...b, u.uid]));
      play('tap');
      return;
    }
    const p = view!.players[owner];
    setInspect({ cardId: u.cardId, owner, note: `Strength ${unitStr(p, u)} · Health ${unitMaxHp(p, u) - u.damage}/${unitMaxHp(p, u)}${u.attacked ? ' · Exhausted (attacked this turn, cannot block)' : ''}` });
  }

  function respond() {
    send({ type: 'respond', blockerUids: blockers, reactionUid: reaction ?? undefined });
  }

  // ------------------------------------------------------------ render pieces
  const rootStyle = {
    '--pace': String(pace === 0 ? 0.01 : pace),
    '--me-primary': civ.palette.primary, '--me-secondary': civ.palette.secondary,
    '--opp-primary': oppCiv.palette.primary, '--opp-secondary': oppCiv.palette.secondary,
  } as CSSProperties;

  const floatFor = (t: string) => floaters.filter((f) => f.target === t).map((f) => <span key={f.key} className={`floater tone-${f.tone}`}>{f.text}</span>);

  const renderBuildings = (owner: PlayerId) => {
    const p = view.players[owner];
    const w = workingBuildings(p);
    const isTarget = (targeting && ((targetSpec === 'enemyBuilding' && owner === opp) || (targetSpec === 'ownBuilding' && owner === me)))
      || (myMain && attackers.length > 0 && owner === opp);
    const threatened = pending?.kind === 'attack' && pending.target.kind === 'building' ? pending.target.uid : pending?.kind === 'action' ? pending.targetUid : undefined;
    return (
      <div className="row buildings">
        {p.buildings.map((b) => (
          <BuildingTile key={b.uid} glow={glowPiece('building', owner === me ? 'me' : 'opp', b.cardId)} b={b} p={p} working={w.has(b.uid)} fx={fx[b.uid]} targetable={!!isTarget} threatened={threatened === b.uid}
            onTap={() => tapBuilding(owner, b)} floaters={floatFor(b.uid)} />
        ))}
        {ghosts.filter((g) => g.owner === owner && g.kind === 'building').map((g) => <GhostTile key={g.key} cardId={g.cardId} />)}
        {p.buildings.length === 0 && !ghosts.some((g) => g.owner === owner && g.kind === 'building') && <div className="row-empty">{owner === me ? 'Your city awaits its first building' : 'No buildings yet'}</div>}
      </div>
    );
  };

  const renderUnits = (owner: PlayerId) => {
    const p = view.players[owner];
    const attacking = pending?.kind === 'attack' ? pending.unitUids : [];
    return (
      <div className="row units">
        {p.units.map((u) => (
          <UnitToken key={u.uid} glow={glowPiece('unit', owner === me ? 'me' : 'opp', u.cardId)} u={u} p={p} fx={fx[u.uid]}
            canAttack={owner === me && ready.has(u.uid)} selected={attackers.includes(u.uid) || blockers.includes(u.uid)}
            canBlock={owner === me && canBlock.has(u.uid)} attacking={attacking.includes(u.uid)}
            onTap={() => tapUnit(owner, u)} />
        ))}
        {ghosts.filter((g) => g.owner === owner && g.kind === 'unit').map((g) => <div key={g.key} className="unit ghost"><CardArt motif={getCard(g.cardId).art} palette={paletteFor(getCard(g.cardId), view.players[owner].civ)} /></div>)}
      </div>
    );
  };

  const status = (() => {
    if (view.phase === 'over') return view.winner === me ? 'Victory' : 'Defeat';
    if (responding) return pending?.kind === 'attack' ? 'Defend!' : 'Counter the scheme?';
    if (myMain) return targeting ? 'Choose a target' : attackers.length ? `Attack: ${attackPower} strength` : 'Your turn';
    if (view.phase === 'response') return `${O.name} is responding…`;
    return `${O.name} is thinking…`;
  })();

  return (
    <div className={`match ${myMain ? 'my-turn' : ''} ${responding ? 'responding' : ''}`} style={rootStyle}>
      <PlayerBar p={O} view={view} isMe={false} active={view.active === opp} shake={shake === opp} floaters={floatFor('opp')}
        extra={
          <div className="bar-tools">
            {snap.online && <span className={`net ${snap.opponentConnected && snap.status === 'live' ? 'ok' : 'warn'}`} title="Connection">
              <Icon name="wifi" size={15} />{snap.status !== 'live' ? snap.status : snap.opponentConnected ? '' : 'opponent away'}</span>}
            <button className="icon-btn" onClick={() => { setMuted(!muted); setMutedState(!muted); }} aria-label={muted ? 'Unmute' : 'Mute'}><Icon name={muted ? 'mute' : 'sound'} size={18} /></button>
            <button className="icon-btn" onClick={() => setShowLog(true)} aria-label="Chronicle"><Icon name="deck" size={18} /></button>
            <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="How to play"><Icon name="info" size={18} /></button>
            <button className="icon-btn" onClick={onExit} aria-label="Leave match"><Icon name="close" size={18} /></button>
          </div>
        } />

      <div className="opp-hand" aria-label={`${O.name} holds ${O.hand.length} cards`}>
        {O.hand.map((c, i) => c.cardId === HIDDEN_CARD
          ? <CardBack key={c.uid} civ={O.civ} style={{ '--i': i, '--n': O.hand.length } as CSSProperties} />
          : <div key={c.uid} className="opp-revealed" style={{ '--i': i, '--n': O.hand.length } as CSSProperties} onClick={() => setInspect({ cardId: c.cardId, owner: opp, note: 'Revealed by your spies.' })}><CardFace cardId={c.cardId} civ={O.civ} /></div>)}
      </div>

      <main className="table">
        <HoloStage events={snap.events} eventSeq={snap.eventSeq} view={view} me={me} pace={pace} onBusy={(b) => { holoBusy.current = b; }} />
        <section className={`side side-opp ${shake === opp ? 'shake' : ''}`}>
          {renderBuildings(opp)}
          {renderUnits(opp)}
        </section>

        <section className="midline">
          <div className={`status ${responding ? 'alert' : ''}`}>{status}</div>
          <div className="mid-actions">
            {myMain && attackers.length > 0 && (
              <>
                <button className={`btn danger ${glowBtn('attackCity')}`} onClick={() => { send({ type: 'attack', unitUids: attackers, target: { kind: 'city' } }); setAttackers([]); }}>
                  <Icon name="city" size={16} /> Attack city
                </button>
                <span className="hint">or tap an enemy building</span>
                <button className="btn ghost" onClick={() => setAttackers([])}>Cancel</button>
              </>
            )}
            {myMain && targeting && <><span className="hint">Tap a highlighted building</span><button className="btn ghost" onClick={() => setTargeting(null)}>Cancel</button></>}
            {myMain && !attackers.length && !targeting && (
              <>
                {ready.size > 0 && <span className="hint">Tap your glowing units to attack</span>}
                <button className={`btn sig ${glowBtn('signature')}`} disabled={P.signatureUsed || P.momentum < civ.signature.cost} onClick={() => setConfirmSig(true)}>
                  <Icon name="momentum" size={15} /> {civ.signature.name} <small>{civ.signature.cost}</small>
                </button>
                <button className="btn ghost" disabled={P.momentum < RULES.rallyCost} onClick={() => send({ type: 'rally' })} title="Spend 2 Momentum to draw a card">
                  Rally <small>{RULES.rallyCost}</small>
                </button>
                <button className={`btn primary ${glowBtn('endTurn')}`} onClick={() => send({ type: 'endTurn' })}>End turn</button>
              </>
            )}
            {!myMain && !responding && view.phase !== 'over' && <span className="hint dots">Waiting</span>}
          </div>
        </section>

        <section className={`side side-me ${shake === me ? 'shake' : ''}`}>
          {renderUnits(me)}
          {renderBuildings(me)}
        </section>
      </main>

      <PlayerBar p={P} view={view} isMe active={view.active === me} shake={shake === me} floaters={floatFor('me')} />

      <div className={`hand ${responding ? 'hand-respond' : ''}`}>
        {P.hand.map((c, i) => {
          const card = getCard(c.cardId);
          const playable = myMain ? canPlayCard(view, me, c.uid) === null : responding ? reactable.has(c.uid) : false;
          return (
            <div key={c.uid} className={`hand-slot ${glowHand(c.cardId) ? 'coach-glow' : ''}`} style={{ '--i': i, '--n': P.hand.length } as CSSProperties}>
              <CardFace cardId={c.cardId} civ={P.civ} cost={costOf(P, card)} disabled={!playable}
                selected={selected === c.uid || reaction === c.uid || targeting === c.uid} onClick={() => tapHand(c.uid)} />
            </div>
          );
        })}
      </div>

      {/* --------------------------------------------------- overlays */}
      {responding && pending && (
        <ResponsePanel glow={glowBtn('respond')} view={view} me={me} blockers={blockers} reaction={reaction} onRespond={respond}
          onClearReaction={() => setReaction(null)} />
      )}

      {selCard && (
        <Sheet onClose={() => setSelected(null)} wide>
          <Inspector cardId={selCard.cardId} civ={P.civ} cost={costOf(P, getCard(selCard.cardId))}
            note={myMain ? canPlayCard(view, me, selCard.uid) : getCard(selCard.cardId).kind === 'reaction' ? 'Reactions are played when your rival attacks or schemes against you.' : null}>
            {myMain && canPlayCard(view, me, selCard.uid) === null && (
              <button className="btn primary big" onClick={playSelected}>
                {getCard(selCard.cardId).target && getCard(selCard.cardId).target !== 'none' ? 'Choose target' : 'Play'}
              </button>
            )}
            <button className="btn ghost big" onClick={() => setSelected(null)}>Close</button>
          </Inspector>
        </Sheet>
      )}

      {inspect && (
        <Sheet onClose={() => setInspect(null)} wide>
          <Inspector cardId={inspect.cardId} civ={view.players[inspect.owner].civ} note={inspect.note}>
            <button className="btn ghost big" onClick={() => setInspect(null)}>Close</button>
          </Inspector>
        </Sheet>
      )}

      {confirmSig && (
        <Sheet onClose={() => setConfirmSig(false)}>
          <div className="sig-card" style={{ '--c-primary': civ.palette.primary, '--c-secondary': civ.palette.secondary } as CSSProperties}>
            <CivEmblem civ={P.civ} palette={civ.palette} size={84} />
            <h3>{civ.signature.name}</h3>
            <p>{civ.signature.text}</p>
            <p className="muted">Costs {civ.signature.cost} Momentum · once per turn</p>
          </div>
          <div className="sheet-actions">
            <button className={`btn primary big ${glowBtn('signature')}`} onClick={() => { send({ type: 'signature' }); setConfirmSig(false); }}>Invoke</button>
            <button className="btn ghost" onClick={() => setConfirmSig(false)}>Not yet</button>
          </div>
        </Sheet>
      )}

      {showLog && (
        <Sheet onClose={() => setShowLog(false)} wide>
          <h3 className="sheet-title">Chronicle</h3>
          <ol className="log">
            {[...view.log].reverse().map((l, i) => <li key={i} className={l.player === me ? 'mine' : l.player === null ? 'sys' : 'theirs'}><span>T{l.turn}</span>{l.text}</li>)}
          </ol>
          <div className="sheet-actions"><button className="btn ghost" onClick={() => setShowLog(false)}>Close</button></div>
        </Sheet>
      )}

      {showHelp && <HowToPlay onClose={() => { setShowHelp(false); try { localStorage.setItem('pm.seenHelp', '1'); } catch { /* ignore */ } }} />}

      {coach && match instanceof TutorialMatch && (
        <aside className={`coach mode-${coach.mode}`} aria-live="polite">
          <div className="coach-head"><span>Academy · {coach.lesson.title}</span><b>{Math.min(coach.index + 1, coach.total)}/{coach.total}</b></div>
          <div className="coach-bar"><i style={{ width: `${(100 * (coach.index + 1)) / coach.total}%` }} /></div>
          <p>{coach.step.text}</p>
          <div className="coach-actions">
            {coach.mode === 'info' && <button className="btn primary" onClick={() => { play('tap'); match.next(); }}>Next</button>}
            {coach.mode === 'do' && <button className="btn ghost small" onClick={() => { play('tap'); setSelected(null); setTargeting(null); setAttackers([]); match.solve(); }}>Show me</button>}
            {coach.mode === 'wait' && <span className="hint dots">Your rival is moving</span>}
            {coach.mode === 'done' && <button className="btn primary" onClick={onExit}>Back to the Academy</button>}
          </div>
        </aside>
      )}

      {banner && <div key={banner.key} className={`banner tone-${banner.tone}`}><div className="banner-text">{banner.text}</div>{banner.sub && <div className="banner-sub">{banner.sub}</div>}</div>}
      {toast && <div className="toast" role="alert">{toast}</div>}

      {view.phase === 'over' && (
        <div className="gameover">
          <div className={`gameover-card ${view.winner === me ? 'win' : 'lose'}`}>
            <CivEmblem civ={view.players[view.winner ?? 0].civ} palette={getCiv(view.players[view.winner ?? 0].civ).palette} size={110} />
            <h2>{view.winner === me ? 'Victory' : 'Defeat'}</h2>
            <p>{view.winReason}</p>
            <div className="go-stats">
              {[P, O].map((p) => <div key={p.id}><b>{p.name}</b><span>Stability {p.stability} · Legacy {p.legacy}</span></div>)}
            </div>
            <div className="sheet-actions">
              {onRematch && <button className="btn primary big" onClick={onRematch}>Play again</button>}
              <button className="btn ghost" onClick={onExit}>Main menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================ pieces

function PlayerBar({ p, view, isMe, active, extra, shake, floaters }: { p: PlayerState; view: GameState; isMe: boolean; active: boolean; extra?: ReactNode; shake: boolean; floaters: ReactNode }) {
  const civ = getCiv(p.civ);
  const inc = incomeOf(p);
  const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (100 * v) / max))}%`;
  return (
    <div className={`pbar ${isMe ? 'pbar-me' : 'pbar-opp'} ${active ? 'is-active' : ''} ${shake ? 'shake' : ''}`}>
      <div className="pbar-id">
        <CivEmblem civ={p.civ} palette={civ.palette} size={isMe ? 44 : 38} />
        <div>
          <div className="pbar-name">{p.name}</div>
          <div className="pbar-civ">{civ.name}</div>
        </div>
      </div>
      <div className="pbar-stats">
        <div className="meter stability" title="Stability — reach 0 and your civilization collapses">
          <Icon name="stability" size={15} /><b>{p.stability}</b>
          <i style={{ '--w': pct(p.stability, RULES.startingStability) } as CSSProperties} />
        </div>
        <div className="meter legacy" title={`Legacy — reach ${RULES.legacyTarget} to win`}>
          <Icon name="legacy" size={15} /><b>{p.legacy}</b><small>/{RULES.legacyTarget}</small>
          {inc.legacy > 0 && <em>+{inc.legacy}</em>}
          <i style={{ '--w': pct(p.legacy, RULES.legacyTarget) } as CSSProperties} />
        </div>
        <div className="chip goods" title="Goods — spent to play cards; income each turn"><Icon name="goods" size={15} /><b>{p.goods}</b><em>+{inc.goods}</em></div>
        <div className={`chip food ${inc.netFood < 0 ? 'neg' : ''} ${p.food + inc.netFood < 0 ? 'danger' : ''}`} title="Food — farms feed your army; shortage causes famine">
          <Icon name="food" size={15} /><b>{p.food}</b><em>{inc.netFood >= 0 ? '+' : ''}{inc.netFood}</em>
        </div>
        <div className="momentum" title="Momentum — earned by chains, successful attacks and reactions">
          {Array.from({ length: RULES.momentumCap }, (_, i) => <span key={i} className={i < p.momentum ? 'on' : ''} />)}
        </div>
        <div className="chip small" title="Cards in deck"><Icon name="deck" size={13} />{p.deck.length}</div>
        {!isMe && <div className="chip small" title="Cards in hand"><Icon name="hand" size={13} />{p.hand.length}</div>}
      </div>
      {extra}
      <div className="floaters">{floaters}</div>
      {view.phase !== 'over' && active && <div className="active-glow" />}
    </div>
  );
}

function BuildingTile({ b, p, working, fx, targetable, threatened, onTap, floaters, glow }: {
  glow?: boolean; b: BuildingInst; p: PlayerState; working: boolean; fx?: string; targetable: boolean; threatened: boolean; onTap: () => void; floaters: ReactNode;
}) {
  const card = getCard(b.cardId);
  const pal = paletteFor(card, p.civ);
  const maxI = maxIntegrity(b);
  const hp = maxI - b.damage;
  const state = b.unrest > 0 ? 'unrest' : working ? 'working' : 'unsupported';
  return (
    <button className={`bld state-${state} ${glow ? 'coach-glow' : ''} ${fx ?? ''} ${targetable ? 'targetable' : ''} ${threatened ? 'threatened' : ''} rarity-${card.rarity ?? 'common'}`}
      style={{ '--c-primary': pal.primary, '--c-secondary': pal.secondary, '--c-accent': pal.accent } as CSSProperties}
      onClick={onTap} aria-label={`${card.name}, integrity ${hp} of ${maxI}, ${state}`}>
      <div className="bld-plinth" />
      <div className="bld-art"><CardArt motif={card.art} palette={pal} /></div>
      <div className="bld-name">{card.name}</div>
      <div className="bld-bar"><i style={{ width: `${(100 * hp) / maxI}%` }} /></div>
      <div className="bld-out">
        {card.goods ? <span><Icon name="goods" size={11} />{card.goods}</span> : null}
        {card.food ? <span><Icon name="food" size={11} />{card.food}</span> : null}
        {card.legacy ? <span><Icon name="legacy" size={11} />{card.legacy}</span> : null}
        {(card.passives ?? []).includes('wall') ? <span><Icon name="integrity" size={11} />wall</span> : null}
      </div>
      {state === 'unrest' && <div className="bld-flag unrest"><Icon name="unrest" size={12} />{b.unrest}</div>}
      {state === 'unsupported' && <div className="bld-flag broken"><Icon name="broken" size={12} /></div>}
      <div className="floaters">{floaters}</div>
    </button>
  );
}

function GhostTile({ cardId }: { cardId: string }) {
  const card = getCard(cardId);
  const pal = paletteFor(card);
  return (
    <div className="bld ghost collapse" aria-hidden>
      <div className="shard left"><CardArt motif={card.art} palette={pal} /></div>
      <div className="shard right"><CardArt motif={card.art} palette={pal} /></div>
      <div className="dust" />
    </div>
  );
}

function UnitToken({ u, p, fx, canAttack, canBlock, selected, attacking, onTap, glow }: {
  glow?: boolean; u: UnitInst; p: PlayerState; fx?: string; canAttack: boolean; canBlock: boolean; selected: boolean; attacking: boolean; onTap: () => void;
}) {
  const card = getCard(u.cardId);
  const pal = paletteFor(card, p.civ);
  const hp = unitMaxHp(p, u) - u.damage;
  return (
    <button className={`unit ${glow ? 'coach-glow' : ''} ${fx ?? ''} ${canAttack ? 'can-attack' : ''} ${canBlock ? 'can-block' : ''} ${selected ? 'is-selected' : ''} ${u.attacked ? 'exhausted' : ''} ${attacking ? 'attacking' : ''}`}
      style={{ '--c-primary': pal.primary, '--c-secondary': pal.secondary } as CSSProperties}
      onClick={onTap} aria-label={`${card.name}, strength ${unitStr(p, u)}, health ${hp}`}>
      <div className="unit-art"><CardArt motif={card.art} palette={pal} /></div>
      <div className="unit-name">{card.name}</div>
      <div className="unit-stats">
        <span className={`s ${u.buff ? 'buffed' : ''}`}><Icon name="str" size={11} />{unitStr(p, u)}</span>
        <span className={`h ${u.damage ? 'hurt' : ''}`}><Icon name="hp" size={11} />{hp}</span>
      </div>
    </button>
  );
}

function ResponsePanel({ view, me, blockers, reaction, onRespond, onClearReaction, glow }: {
  glow?: string; view: GameState; me: PlayerId; blockers: string[]; reaction: string | null; onRespond: () => void; onClearReaction: () => void;
}) {
  const pending = view.pending!;
  const O = view.players[other(me)];
  const P = view.players[me];
  const reacts = playableReactions(view, me);
  let title: string, detail: ReactNode;
  if (pending.kind === 'attack') {
    const units = O.units.filter((u) => pending.unitUids.includes(u.uid));
    const power = units.reduce((s, u) => s + unitStr(O, u), 0);
    const tgt = pending.target.kind === 'city' ? 'your city' : getCard(P.buildings.find((b) => b.uid === (pending.target as { uid: string }).uid)?.cardId ?? 'farm').name;
    title = `${O.name} attacks ${tgt}`;
    detail = <>{units.length} unit{units.length > 1 ? 's' : ''}, <b>{power}</b> strength{units.some((u) => (getCard(u.cardId).keywords ?? []).includes('siege')) ? ' (+siege)' : ''}. Tap your units to block{reacts.length ? ', or pick a reaction card below' : ''}.</>;
  } else {
    const card = getCard(pending.card.cardId);
    const tgt = pending.targetUid ? P.buildings.find((b) => b.uid === pending.targetUid) : undefined;
    title = `${O.name} schemes: ${card.name}`;
    detail = <>{card.text}{tgt ? <> Target: <b>{getCard(tgt.cardId).name}</b>.</> : null}{reacts.length ? ' Pick a reaction to counter it.' : ' You have no counter ready.'}</>;
  }
  const doing = blockers.length || reaction;
  return (
    <div className="respond-panel" role="dialog" aria-label="Respond">
      <div className="rp-title">{title}</div>
      <div className="rp-detail">{detail}</div>
      <div className="rp-actions">
        {reaction && <span className="rp-chip">{getCard(P.hand.find((c) => c.uid === reaction)!.cardId).name}<button onClick={onClearReaction} aria-label="Remove reaction"><Icon name="close" size={12} /></button></span>}
        {blockers.length > 0 && <span className="rp-chip">{blockers.length} blocker{blockers.length > 1 ? 's' : ''}</span>}
        <button className={`btn big ${doing ? 'primary' : 'ghost'} ${glow ?? ''}`} onClick={onRespond}>{doing ? 'Respond' : pending.kind === 'attack' ? 'Take the hit' : 'Let it happen'}</button>
      </div>
    </div>
  );
}

function Sheet({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

