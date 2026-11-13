import {
  actingPlayer, ageName, availableBlockers, canPlayCard, costOf, draftNeeded, getCard, getCiv, HIDDEN_CARD, incomeOf, isWorking,
  canDeploy, districtsFor, fallout, maxIntegrity, musterable, other, playableReactions, previewPlay, progressNeeded, readyAttackers, roleOf, ROLE_LABEL, roleText, RULES, trapText, tuckSpots, unitMaxHp, unitStr, workingBuildings, cityLedger, beatsAny,
  type BuildingInst, type GameEvent, type GameState, type PlayerId, type PlayerState, type UnitInst,
} from '@pm/engine';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { CardArt, CivEmblem } from '../art/motifs';
import { Skyline, skylineBackdrop } from '../art/skyline';
import { isMuted, play, setMuted } from '../audio';
import { LocalMatch, TutorialMatch, type AnyMatch } from '../game/match';
import type { Highlight } from '../game/tutorial';
import { HoloStage } from '../holo/HoloStage';
import { CardBack, CardFace, paletteFor } from './Card';
import { HowToPlay } from './HowToPlay';
import { FAMILY_LABEL, Icon, ROMAN } from './icons';
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
  /** A hand card being hidden as a trap: waiting for the player to pick a spot. */
  const [hiding, setHiding] = useState<string | null>(null);
  const [attackers, setAttackers] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [reaction, setReaction] = useState<string | null>(null);
  const [muster, setMuster] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{ cardId: string; owner: PlayerId; note?: string; fallout?: string[] } | null>(null);
  /** A rival building chosen as an attack target, waiting for confirmation (shows what its fall would do). */
  const [aim, setAim] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<PlayerId | null>(null);
  const [showHelp, setShowHelp] = useState(() => { if (match instanceof TutorialMatch) return false; try { return !localStorage.getItem('pm.seenHelp2'); } catch { return false; } });
  const [confirmSig, setConfirmSig] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [fx, setFx] = useState<Fx>({});
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState<PlayerId | null>(null);
  const [draftCiv, setDraftCiv] = useState(3);
  const [discards, setDiscards] = useState<string[]>([]);
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
  const drafting = !!view && view.phase === 'draft' && acting === me;
  const myMain = !!view && view.phase === 'main' && acting === me;
  const responding = !!view && view.phase === 'response' && acting === me;
  const pendingKey = view?.pending ? JSON.stringify(view.pending) : '';

  useEffect(() => { setBlockers([]); setReaction(null); setMuster(null); }, [pendingKey]);
  useEffect(() => { if (!myMain) { setAttackers([]); setTargeting(null); setSelected(null); setHiding(null); } }, [myMain]);
  // A fresh draft each turn: suggest a split based on what is already in hand.
  useEffect(() => {
    if (!drafting || !view) return;
    setDiscards([]);
    const P = view.players[me];
    const need = draftNeeded(P);
    const milInHand = P.hand.filter((c) => getCard(c.cardId).family === 'mil').length;
    setDraftCiv(Math.max(0, Math.min(need, Math.round((RULES.handSize / 2 - (P.hand.length - milInHand)) + (need - (RULES.handSize / 2 - milInHand) - (RULES.handSize / 2 - (P.hand.length - milInHand))) / 2))));
  }, [drafting, view?.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (snap.error) { setToast(snap.error); play('tap'); const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); } }, [snap.errorSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presentation: engine events -> board animation and sound (the hologram theater handles the big moments).
  useEffect(() => {
    if (!view) return;
    const nextFx: Fx = {};
    const newGhosts: Ghost[] = [];
    const floats: Floater[] = [];
    let ban: Banner | null = null;
    const sounds = new Set<Parameters<typeof play>[0]>();
    const add = (target: string, text: string, tone: string) => floats.push({ key: ++counter.current, target, text, tone });
    const who = (p: PlayerId) => (p === me ? 'me' : 'opp');
    for (const e of snap.events as GameEvent[]) {
      switch (e.type) {
        case 'buildingRaised': nextFx[e.uid] = 'fx-rise'; sounds.add('build'); break;
        case 'unitDeployed': nextFx[e.uid] = 'fx-arrive'; sounds.add('card'); break;
        case 'buildingDamaged': nextFx[e.uid] = 'fx-hit'; add(e.uid, `−${e.amount}`, 'red'); sounds.add('clash'); break;
        case 'buildingDestroyed': newGhosts.push({ key: `g${++counter.current}`, owner: e.player, cardId: e.cardId, kind: 'building' }); sounds.add('collapse');
          if (e.progressLost) add(who(e.player), `−${e.progressLost} Progress`, 'red');
          break;
        case 'unitDestroyed': case 'unitDeserted':
          newGhosts.push({ key: `g${++counter.current}`, owner: e.player, cardId: e.cardId, kind: 'unit' });
          if (e.type === 'unitDeserted') add(who(e.player), 'Deserted — unpaid', 'red');
          break;
        case 'buildingUnrest': nextFx[e.uid] = 'fx-unrest'; break;
        case 'supportLost': nextFx[e.uid] = 'fx-crack'; break;
        case 'attackDeclared': for (const u of e.unitUids) nextFx[u] = 'fx-charge'; sounds.add('march');
          if (e.player !== me) ban = { key: ++counter.current, text: 'Across the river!', sub: e.target.kind === 'city' ? 'They are coming for your city' : 'They are coming for a building', tone: 'red' };
          break;
        case 'combat': if (e.power) sounds.add('clash'); break;
        case 'cityDamaged': add(who(e.player), `−${e.amount} Stability`, 'red'); setShake(e.player); setTimeout(() => setShake(null), 500); break;
        case 'grow': add(who(e.player), `+${e.progress} Progress`, 'gold'); break;
        case 'ageUp': sounds.add('victory'); if (pace === 0) ban = { key: ++counter.current, text: `Age ${ROMAN[e.age - 1]}`, sub: e.name, tone: 'gold' }; break;
        case 'reaction': sounds.add('reaction'); if (pace === 0) ban = { key: ++counter.current, text: getCard(e.cardId).name, sub: e.player === me ? 'Your reaction' : `${view.players[e.player].name} reacts!`, tone: 'violet' }; break;
        case 'signature': sounds.add('reaction'); if (pace === 0) ban = { key: ++counter.current, text: e.name, sub: view.players[e.player].name, tone: 'gold' }; break;
        case 'resource': if (e.res === 'prosperity' && e.delta > 0 && e.player === me) sounds.add('coin'); break;
        case 'drafted': if (e.player !== me) add('opp', `Picked ${e.civ} Civilization · ${e.mil} Military`, 'plain'); sounds.add('card'); break;
        case 'rally': ban = { key: ++counter.current, text: e.player === me ? 'Your people rally' : `${view.players[e.player].name} rallies`, sub: `${e.gap} Progress behind: +${e.prosperity} Prosperity`, tone: 'gold' }; break;
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
      setTimeout(() => setFloaters((f) => f.filter((x) => !floats.includes(x))), sleepMs(pace, 1600));
    }
    if (ban) {
      setBanner(ban);
      const k = ban.key;
      setTimeout(() => setBanner((b) => (b?.key === k ? null : b)), sleepMs(Math.max(pace, 0.6), ban.tone === 'plain' ? 900 : 1500));
    }
  }, [snap.eventSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-pass a response window when there is nothing at all we could do.
  useEffect(() => {
    if (!responding || !view || snap.coach) return;
    if (availableBlockers(view, me).length === 0 && playableReactions(view, me).length === 0 && musterable(view, me).length === 0) {
      const t = setTimeout(() => match.send({ type: 'respond', blockerUids: [] }), sleepMs(pace, 900));
      return () => clearTimeout(t);
    }
  }, [responding, pendingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return <div className="center-note">Preparing the river…</div>;

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
  const musterOk = new Set(responding ? musterable(view, me) : []);
  const attackPower = attackers.reduce((s, uid) => { const u = P.units.find((x) => x.uid === uid); return s + (u ? unitStr(P, u) : 0); }, 0);
  const need = drafting ? draftNeeded(P, discards.length) : 0;
  const civPick = Math.min(draftCiv, need);

  // ------------------------------------------------------------ interactions
  const send: AnyMatch['send'] = (a) => { play('tap'); match.send(a); };

  function tapHand(uid: string) {
    if (drafting) { setDiscards((d) => (d.includes(uid) ? d.filter((x) => x !== uid) : [...d, uid])); play('tap'); return; }
    if (!myMain && !responding) { setSelected(uid); return; }
    if (responding) {
      // A reaction and a Call to Arms can go together if Prosperity covers both; otherwise the new pick replaces the other.
      const costIn = (u: string | null) => { const c = u ? P.hand.find((x) => x.uid === u) : undefined; return c ? costOf(P, getCard(c.cardId)) : 0; };
      if (reactable.has(uid)) {
        if (reaction !== uid && costIn(uid) + costIn(muster) > P.prosperity) setMuster(null);
        setReaction((r) => (r === uid ? null : uid)); play('tap');
      } else if (musterOk.has(uid)) {
        if (muster !== uid && costIn(uid) + costIn(reaction) > P.prosperity) setReaction(null);
        setMuster((m) => (m === uid ? null : uid)); play('tap');
      } else setSelected(uid);
      return;
    }
    setTargeting(null);
    setHiding(null);
    setSelected((s) => (s === uid ? null : uid));
  }

  function playSelected() {
    if (!selCard) return;
    const card = getCard(selCard.cardId);
    if (card.target && card.target !== 'none') { setTargeting(selCard.uid); setSelected(null); return; }
    send({ type: 'play', uid: selCard.uid });
    setSelected(null);
  }

  const spots = new Set(myMain ? tuckSpots(view, me) : []);
  const hideAt = (at: string) => { if (!hiding) return; send({ type: 'tuck', uid: hiding, at }); setHiding(null); };

  function tapBuilding(owner: PlayerId, b: BuildingInst) {
    if (hiding && owner === me) { if (spots.has(b.uid)) hideAt(b.uid); return; }
    if (targeting && ((targetSpec === 'enemyBuilding' && owner === opp) || (targetSpec === 'ownBuilding' && owner === me))) {
      send({ type: 'play', uid: targeting, targetUid: b.uid });
      setTargeting(null);
      return;
    }
    if (myMain && attackers.length && owner === opp) {
      if (snap.coach) { send({ type: 'attack', unitUids: attackers, target: { kind: 'building', uid: b.uid } }); setAttackers([]); return; }
      setAim(b.uid); play('tap');
      return;
    }
    const p = view!.players[owner];
    const working = isWorking(p, b.uid);
    const c = getCard(b.cardId);
    const L = cityLedger(p);
    const note = b.unrest > 0 ? `In Unrest for ${b.unrest} more turn${b.unrest > 1 ? 's' : ''}.`
      : L.hungry.includes(b.uid) ? 'Hungry: not enough Food. Build a Farm, or feed fewer soldiers.'
        : L.idle.includes(b.uid) ? 'Idle: no Worker free. A fed Village gives one.'
          : !working ? `Not working: needs a working ${c.requires?.join(' or ')}.` : `Integrity ${maxIntegrity(b) - b.damage}/${maxIntegrity(b)}.`;
    setInspect({ cardId: b.cardId, owner, note, fallout: fallout(view!, owner, b.uid).lines });
  }

  function tapUnit(owner: PlayerId, u: UnitInst) {
    if (owner === me && myMain && ready.has(u.uid)) { setAttackers((a) => (a.includes(u.uid) ? a.filter((x) => x !== u.uid) : [...a, u.uid])); play('tap'); return; }
    if (owner === me && responding && canBlock.has(u.uid)) { setBlockers((b) => (b.includes(u.uid) ? b.filter((x) => x !== u.uid) : [...b, u.uid])); play('tap'); return; }
    const p = view!.players[owner];
    setInspect({ cardId: u.cardId, owner, note: `Strength ${unitStr(p, u)} · Health ${unitMaxHp(p, u) - u.damage}/${unitMaxHp(p, u)}${u.attacked ? ' · Exhausted: attacked this turn, cannot block' : ''}` });
  }

  const musterNote = (cardId: string) => {
    const card = getCard(cardId);
    if (pending?.kind !== 'attack') return 'Soldiers can only be called to arms against an attack, not a scheme.';
    if (P.units.length >= RULES.maxUnits) return 'Your army is at full strength, so no one else can join the fight.';
    if (!canDeploy(P, card)) return `Needs a working ${card.requiresToDeploy} to be called to arms.`;
    if (P.prosperity < costOf(P, card)) return `Calling it to arms costs ${costOf(P, card)} Prosperity; you have ${P.prosperity}.`;
    return null;
  };
  const respond = () => send({ type: 'respond', blockerUids: blockers, reactionUid: reaction ?? undefined, musterUid: muster ?? undefined });
  const doDraft = () => send({ type: 'draft', civ: civPick, mil: need - civPick, discard: discards });

  // ------------------------------------------------------------ render
  const rootStyle = {
    '--pace': String(pace === 0 ? 0.01 : pace),
    '--me-primary': civ.palette.primary, '--me-secondary': civ.palette.secondary,
    '--opp-primary': oppCiv.palette.primary, '--opp-secondary': oppCiv.palette.secondary,
  } as CSSProperties;
  const floatFor = (t: string) => floaters.filter((f) => f.target === t).map((f) => <span key={f.key} className={`floater tone-${f.tone}`}>{f.text}</span>);

  const renderBuildings = (owner: PlayerId) => {
    const p = view.players[owner];
    const w = workingBuildings(p);
    const isTarget = (targeting && ((targetSpec === 'enemyBuilding' && owner === opp) || (targetSpec === 'ownBuilding' && owner === me))) || (myMain && attackers.length > 0 && owner === opp);
    const hidden = (uid: string) => (owner === me ? (p.traps ?? []).filter((t) => t.at === uid).length : 0);
    // How much else falls with this building (other buildings stopped + districts broken): marks key targets.
    const keystoneOf = (uid: string) => { const f = fallout(view!, owner, uid); return f.stops.length + f.lines.filter((l) => l.startsWith('Breaks')).length; };
    const L = cityLedger(p);
    const threatened = pending?.kind === 'attack' && pending.target.kind === 'building' ? pending.target.uid : pending?.kind === 'action' ? pending.targetUid : undefined;
    return (
      <div className="row buildings">
        {p.buildings.map((b) => (
          <BuildingTile key={b.uid} glow={glowPiece('building', owner === me ? 'me' : 'opp', b.cardId)} b={b} p={p} working={w.has(b.uid)} fx={fx[b.uid]}
            targetable={!!isTarget || (!!hiding && owner === me && spots.has(b.uid))} threatened={threatened === b.uid} onTap={() => tapBuilding(owner, b)} floaters={floatFor(b.uid)}
            hidden={hidden(b.uid)} lack={L.hungry.includes(b.uid) ? 'hungry' : L.idle.includes(b.uid) ? 'idle' : undefined}
            keystone={owner === opp && myMain && attackers.length > 0 ? keystoneOf(b.uid) : 0} />
        ))}
        {ghosts.filter((g) => g.owner === owner && g.kind === 'building').map((g) => <GhostTile key={g.key} cardId={g.cardId} />)}
        {p.buildings.length === 0 && !ghosts.some((g) => g.owner === owner && g.kind === 'building') && <div className="row-empty">{owner === me ? 'Your bank awaits its first building' : 'An empty riverbank'}</div>}
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
            canBlock={owner === me && canBlock.has(u.uid)} attacking={attacking.includes(u.uid)} onTap={() => tapUnit(owner, u)} />
        ))}
        {ghosts.filter((g) => g.owner === owner && g.kind === 'unit').map((g) => <div key={g.key} className="unit ghost"><CardArt motif={getCard(g.cardId).art} palette={paletteFor(getCard(g.cardId), view.players[owner].civ)} /></div>)}
      </div>
    );
  };

  const status = (() => {
    if (view.phase === 'over') return view.winner === me ? 'Victory' : 'Defeat';
    if (drafting) return 'Choose your cards';
    if (responding) return pending?.kind === 'attack' ? 'Defend the riverbank!' : 'Counter the scheme?';
    if (myMain) return hiding ? 'Hide it where?' : targeting ? 'Choose a target' : attackers.length ? `Crossing with ${attackPower} strength` : 'Your turn';
    if (view.phase === 'draft') return `${O.name} is choosing cards…`;
    if (view.phase === 'response') return `${O.name} is responding…`;
    return `${O.name} is moving…`;
  })();

  return (
    <div className={`match river-match ${myMain ? 'my-turn' : ''} ${responding ? 'responding' : ''} ${drafting ? 'drafting' : ''}`} style={rootStyle}>
      <PlayerBar p={O} isMe={false} active={view.active === opp} over={view.phase === 'over'} floaters={floatFor('opp')} onCity={() => setLedgerFor(opp)}
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

      <main className="table river-table">
        <section className={`bank bank-far ${shake === opp ? 'shake' : ''}`}>
          <LivingCity p={O} side="far" />
          <div className="bank-content">
            {renderBuildings(opp)}
            {renderUnits(opp)}
          </div>
        </section>

        <section className="river">
          <div className="water" aria-hidden />
          <div className="river-bar">
            <div className={`status ${responding ? 'alert' : ''}`}>{status}</div>
            <div className="mid-actions">
              {myMain && attackers.length > 0 && (
                <>
                  <button className={`btn danger ${glowBtn('attackCity')}`} onClick={() => { send({ type: 'attack', unitUids: attackers, target: { kind: 'city' } }); setAttackers([]); }}>
                    <Icon name="city" size={16} /> Attack their city
                  </button>
                  <span className="hint">or tap one of their buildings</span>
                  {(() => {
                    const mine = attackers.map((uid) => P.units.find((u) => u.uid === uid)).filter(Boolean).map((u) => roleOf(u!.cardId));
                    const theirs = O.units.filter((u) => !u.attacked && !u.blocked).map((u) => roleOf(u.cardId));
                    const good = mine.filter((r) => beatsAny(r, theirs)).length, bad = theirs.filter((r) => beatsAny(r, mine)).length;
                    const roles = new Set(mine).size;
                    return <span className="hint matchup">{theirs.length ? `Their soldiers: ${theirs.map((r) => ROLE_LABEL[r]).join(', ')}. ` : 'No soldiers guard their bank. '}{good ? `${good} of yours beat them (+2). ` : ''}{bad ? `${bad} of theirs beat yours. ` : ''}{roles >= 3 ? 'Mixed army +2.' : ''}</span>;
                  })()}
                  <button className="btn ghost" onClick={() => setAttackers([])}>Cancel</button>
                </>
              )}
              {myMain && targeting && <><span className="hint">Tap a highlighted building</span><button className="btn ghost" onClick={() => setTargeting(null)}>Cancel</button></>}
              {myMain && hiding && (
                <>
                  <span className="hint">Tap one of your buildings, or</span>
                  <button className="btn trap-btn" disabled={!spots.has('city')} onClick={() => hideAt('city')}><Icon name="city" size={16} /> Under the city</button>
                  <button className="btn ghost" onClick={() => setHiding(null)}>Cancel</button>
                </>
              )}
              {myMain && !attackers.length && !targeting && !hiding && (
                <>
                  {ready.size > 0 && <span className="hint">Tap your glowing units to cross the river</span>}
                  <button className={`btn sig ${glowBtn('signature')}`} disabled={P.signatureUsed || P.momentum < civ.signature.cost} onClick={() => setConfirmSig(true)}>
                    <Icon name="momentum" size={15} /> {civ.signature.name} <small>{civ.signature.cost}</small>
                  </button>
                  <button className={`btn primary ${glowBtn('endTurn')}`} onClick={() => send({ type: 'endTurn' })}>End turn</button>
                </>
              )}
              {!myMain && !responding && !drafting && view.phase !== 'over' && <span className="hint dots">Waiting</span>}
            </div>
          </div>
        </section>

        <section className={`bank bank-near ${shake === me ? 'shake' : ''}`}>
          <LivingCity p={P} side="near" />
          <div className="bank-content">
            {renderUnits(me)}
            {renderBuildings(me)}
          </div>
        </section>

        <HoloStage events={snap.events} eventSeq={snap.eventSeq} view={view} me={me} pace={pace} onBusy={(b) => { holoBusy.current = b; }} />
      </main>

      <PlayerBar p={P} isMe active={view.active === me} over={view.phase === 'over'} floaters={floatFor('me')} onCity={() => setLedgerFor(me)} />

      <div className={`hand ${responding ? 'hand-respond' : ''} ${drafting ? 'hand-draft' : ''}`}>
        {P.hand.map((c, i) => {
          const card = getCard(c.cardId);
          const playable = myMain ? canPlayCard(view, me, c.uid) === null : responding ? reactable.has(c.uid) || musterOk.has(c.uid) : drafting;
          return (
            <div key={c.uid} className={`hand-slot ${glowHand(c.cardId) ? 'coach-glow' : ''} ${discards.includes(c.uid) ? 'to-discard' : ''}`} style={{ '--i': i, '--n': P.hand.length } as CSSProperties}>
              <CardFace cardId={c.cardId} civ={P.civ} cost={costOf(P, card)} disabled={!playable}
                selected={selected === c.uid || reaction === c.uid || muster === c.uid || targeting === c.uid} onClick={() => tapHand(c.uid)} />
              {drafting && discards.includes(c.uid) && <span className="discard-tag">Discard</span>}
              {responding && muster === c.uid && <span className="discard-tag muster-tag">To arms!</span>}
            </div>
          );
        })}
        {P.hand.length === 0 && !drafting && <div className="hand-empty">Your hand is empty. You refill it at the start of your turn.</div>}
      </div>

      {/* --------------------------------------------------- overlays */}
      {drafting && (
        <DraftPanel P={P} need={need} civPick={civPick} setCiv={(n) => { setDraftCiv(n); play('tap'); }} discards={discards.length}
          onDraft={doDraft} glow={glowBtn('draft')} />
      )}

      {responding && pending && (
        <ResponsePanel glow={glowBtn('respond')} view={view} me={me} blockers={blockers} reaction={reaction} muster={muster} onRespond={respond} onClearReaction={() => setReaction(null)} onClearMuster={() => setMuster(null)} />
      )}

      {selCard && !drafting && (
        <Sheet onClose={() => setSelected(null)} wide>
          <Inspector cardId={selCard.cardId} civ={P.civ} cost={costOf(P, getCard(selCard.cardId))}
            note={myMain ? canPlayCard(view, me, selCard.uid) : responding && getCard(selCard.cardId).kind === 'unit' ? musterNote(selCard.cardId) : getCard(selCard.cardId).kind === 'reaction' ? 'Reactions are played when your rival attacks or schemes against you.' : getCard(selCard.cardId).kind === 'unit' ? 'Call to Arms: when your rival attacks, you can pay this unit’s cost to rush it into the fight as a blocker.' : null}>
            {myMain && canPlayCard(view, me, selCard.uid) === null && (
              <button className="btn primary big" onClick={playSelected}>
                {getCard(selCard.cardId).target && getCard(selCard.cardId).target !== 'none' ? 'Choose target' : getCard(selCard.cardId).kind === 'unit' ? 'Deploy' : getCard(selCard.cardId).family === 'civ' ? 'Build' : 'Play'}
              </button>
            )}
            {myMain && canPlayCard(view, me, selCard.uid) === null && (() => {
              const pv = previewPlay(view, me, selCard.uid);
              return pv.length > 0 && <ul className="play-preview" aria-label="What this does for your city">{pv.map((t) => <li key={t} className={/hungry|idle|short|−|-\d/.test(t) ? 'bad' : 'good'}>{t}</li>)}</ul>;
            })()}
            {myMain && spots.size > 0 && (
              <div className="trap-offer">
                <button className="btn trap-btn big" onClick={() => { setHiding(selCard.uid); setSelected(null); play('tap'); }}><Icon name="trap" size={18} /> Hide as a trap</button>
                <p><b>If that spot is hit during your rival’s next turn:</b> {trapText(getCard(selCard.cardId))} Otherwise it returns to your deck. Your rival sees only that you hid something.</p>
              </div>
            )}
            <button className="btn ghost big" onClick={() => setSelected(null)}>Close</button>
          </Inspector>
        </Sheet>
      )}

      {inspect && (
        <Sheet onClose={() => setInspect(null)} wide>
          <Inspector cardId={inspect.cardId} civ={view.players[inspect.owner].civ} note={inspect.note}>
            {inspect.fallout && <FalloutList title={inspect.owner === me ? 'If your rival destroys it' : 'If you destroy it'} lines={inspect.fallout} />}
            <button className="btn ghost big" onClick={() => setInspect(null)}>Close</button>
          </Inspector>
        </Sheet>
      )}

      {aim && myMain && (() => {
        const tb = O.buildings.find((b) => b.uid === aim);
        if (!tb) return null;
        const fo = fallout(view, opp, aim);
        return (
          <Sheet onClose={() => setAim(null)}>
            <h3 className="sheet-title">Send {attackers.length} unit{attackers.length > 1 ? 's' : ''} ({attackPower} Strength) at {getCard(tb.cardId).name}?</h3>
            <p className="sheet-sub">Integrity {maxIntegrity(tb) - tb.damage}/{maxIntegrity(tb)}{(O.traps ?? []).length ? ` · your rival has hidden ${(O.traps ?? []).length} trap${(O.traps ?? []).length > 1 ? 's' : ''} somewhere` : ''}.</p>
            <FalloutList title="If it falls" lines={fo.lines} />
            <div className="sheet-actions">
              <button className="btn ghost big" onClick={() => setAim(null)}>Choose another</button>
              <button className="btn danger big" onClick={() => { send({ type: 'attack', unitUids: attackers, target: { kind: 'building', uid: aim } }); setAttackers([]); setAim(null); }}>Attack</button>
            </div>
          </Sheet>
        );
      })()}

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

      {ledgerFor !== null && <LedgerSheet p={view.players[ledgerFor]} mine={ledgerFor === me} onClose={() => setLedgerFor(null)} />}

      {showLog && (
        <Sheet onClose={() => setShowLog(false)} wide>
          <h3 className="sheet-title">Chronicle</h3>
          <ol className="log">
            {[...view.log].reverse().map((l, i) => <li key={i} className={l.player === me ? 'mine' : l.player === null ? 'sys' : 'theirs'}><span>T{l.turn}</span>{l.text}</li>)}
          </ol>
          <div className="sheet-actions"><button className="btn ghost" onClick={() => setShowLog(false)}>Close</button></div>
        </Sheet>
      )}

      {showHelp && <HowToPlay onClose={() => { setShowHelp(false); try { localStorage.setItem('pm.seenHelp2', '1'); } catch { /* ignore */ } }} />}

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
              {[P, O].map((p) => <div key={p.id}><b>{p.name}</b><span>Age {ROMAN[p.age - 1]} · {ageName(p.civ, p.age)}</span><span>Stability {p.stability}</span></div>)}
            </div>
            <div className="sheet-actions">
              {onRematch && <button className="btn primary big" onClick={onRematch}>Play again</button>}
              <button className="btn ghost" onClick={onExit}>{match instanceof TutorialMatch ? 'Back to the Academy' : 'Main menu'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================ pieces

function PlayerBar({ p, isMe, active, extra, floaters, over, onCity }: { p: PlayerState; isMe: boolean; active: boolean; extra?: ReactNode; floaters: ReactNode; over: boolean; onCity?: () => void }) {
  const civ = getCiv(p.civ);
  const inc = incomeOf(p);
  const L = inc.ledger;
  const needed = progressNeeded(p.age);
  const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (100 * v) / max))}%`;
  return (
    <div className={`pbar ${isMe ? 'pbar-me' : 'pbar-opp'} ${active ? 'is-active' : ''}`}>
      <div className="pbar-id">
        <CivEmblem civ={p.civ} palette={civ.palette} size={isMe ? 44 : 38} />
        <div>
          <div className="pbar-name">{p.name}</div>
          <div className="pbar-civ" title={`${civ.trait.name}: ${civ.trait.text}`}>{civ.name}</div>
        </div>
      </div>
      <div className="pbar-stats">
        <div className="age-meter" title={`Progress toward ${p.age === 5 ? 'the Golden Age' : `Age ${ROMAN[p.age]}`}`}>
          <div className="age-label"><b>Age {ROMAN[p.age - 1]}</b><span>{ageName(p.civ, p.age)}</span></div>
          <div className="age-track">
            {[1, 2, 3, 4, 5].map((a) => <i key={a} className={a < p.age ? 'done' : a === p.age ? 'now' : ''} />)}
          </div>
          <div className="progress-bar"><i style={{ '--w': pct(p.progress, needed) } as CSSProperties} /><span>{p.progress}/{needed}{inc.growth ? ` · +${inc.growth}/turn` : ''}</span></div>
        </div>
        <div className="meter stability" title="Stability: if it reaches 0 your city falls">
          <Icon name="stability" size={15} /><b>{p.stability}</b>
          <i style={{ '--w': pct(p.stability, RULES.startingStability) } as CSSProperties} />
        </div>
        <div className="chip prosperity" title={`Prosperity: spent to play cards. Next turn +${inc.prosperity}.`}>
          <Icon name="prosperity" size={15} /><b>{p.prosperity}</b><em>+{inc.net}</em>
        </div>
        <button className={`chip food ${inc.foodShort ? 'danger' : L.hungry.length ? 'warn' : ''}`} onClick={onCity} aria-label="Food and workers: open the city ledger"
          title={`Food: ${L.food} made${L.stored ? ` + ${L.stored} stored` : ''}, city eats ${L.cityEats}, army eats ${L.armyEats}${inc.foodShort ? ` — ${inc.foodShort} short!` : ''}`}>
          <Icon name="food" size={15} /><b>{L.food + L.stored - L.cityEats - L.armyEats}</b><em>spare</em>
          <span className="sep" /><Icon name="worker" size={14} /><b>{L.workers - L.workersUsed}</b><em>free</em>
          {L.sets + L.districts.length > 0 && <><span className="sep" /><Icon name="star" size={13} /><b>{L.sets + L.districts.length}</b></>}
        </button>
        <div className="momentum" title="Momentum: from victories, reactions and new Ages; spend 3 on your Signature">
          {Array.from({ length: RULES.momentumCap }, (_, i) => <span key={i} className={i < p.momentum ? 'on' : ''} />)}
        </div>
        <div className="chip small piles" title="Cards left in the Civilization and Military decks">
          <Icon name="civ" size={13} />{p.piles.civ.length}<Icon name="mil" size={13} />{p.piles.mil.length}
        </div>
        {!isMe && <div className="chip small" title="Cards in hand"><Icon name="hand" size={13} />{p.hand.length}</div>}
        {(p.traps ?? []).length > 0 && (
          <div className={`chip small traps ${isMe ? '' : 'rival'}`} title={isMe ? 'Your hidden traps (they return to your deck at the start of your turn)' : 'Hidden traps: somewhere under their buildings or city'}>
            <Icon name="trap" size={13} />{p.traps.length}{isMe && p.traps.some((t) => t.at === 'city') ? <em>{p.traps.filter((t) => t.at === 'city').length} under city</em> : !isMe ? <em>hidden</em> : null}
          </div>
        )}
      </div>
      {extra}
      <div className="floaters">{floaters}</div>
      {!over && active && <div className="active-glow" />}
    </div>
  );
}

function DraftPanel({ P, need, civPick, setCiv, discards, onDraft, glow }: {
  P: PlayerState; need: number; civPick: number; setCiv: (n: number) => void; discards: number; onDraft: () => void; glow: string;
}) {
  const milPick = need - civPick;
  const pile = (fam: 'civ' | 'mil', count: number, left: number) => (
    <button className={`draft-pile pile-${fam}`} onClick={() => setCiv(fam === 'civ' ? Math.min(need, civPick + 1) : Math.max(0, civPick - 1))} aria-label={`Take one more ${FAMILY_LABEL[fam]} card`}>
      <div className="pile-stack">
        {[0, 1, 2].map((i) => <CardBack key={i} civ={P.civ} family={fam} style={{ '--i': i } as CSSProperties} />)}
        <b className="pile-count">{count}</b>
      </div>
      <div className="pile-label"><Icon name={fam} size={16} /> {FAMILY_LABEL[fam]}</div>
      <div className="pile-sub">{fam === 'civ' ? 'Growth · buildings · Progress' : 'Units · forts · tactics · reactions'}</div>
      <div className="pile-left">{left} in deck</div>
      {P.peek && P.peek[fam] && <div className="pile-peek"><span>Scribes see</span><CardFace cardId={P.peek[fam]!} civ={P.civ} /></div>}
    </button>
  );
  return (
    <div className="draft-panel" role="dialog" aria-label="Choose your cards">
      <div className="draft-title">Fill your hand <small>{need === 0 ? 'your hand is full' : `pick ${need}, face down`}</small></div>
      <div className="draft-piles">
        {pile('civ', civPick, P.piles.civ.length)}
        <div className="draft-split">
          <input type="range" min={0} max={need} value={civPick} onChange={(e) => setCiv(Number(e.target.value))} aria-label="Civilization cards to pick" disabled={need === 0} />
          <div className="split-presets">
            <button className="btn ghost small" onClick={() => setCiv(need)}>All growth</button>
            <button className="btn ghost small" onClick={() => setCiv(Math.ceil(need / 2))}>Even</button>
            <button className="btn ghost small" onClick={() => setCiv(0)}>All military</button>
          </div>
        </div>
        {pile('mil', milPick, P.piles.mil.length)}
      </div>
      <div className="draft-foot">
        <span className="hint">{discards ? `${discards} card${discards > 1 ? 's' : ''} marked to discard · ` : ''}Tap cards in your hand to discard them first.</span>
        <button className={`btn primary big ${glow}`} onClick={onDraft}>{need === 0 ? 'Keep my hand' : `Draw ${civPick} + ${milPick}`}</button>
      </div>
    </div>
  );
}

function BuildingTile({ b, p, working, fx, targetable, threatened, onTap, floaters, glow, hidden = 0, lack, keystone = 0 }: {
  keystone?: number; lack?: 'hungry' | 'idle'; hidden?: number; glow?: boolean; b: BuildingInst; p: PlayerState; working: boolean; fx?: string; targetable: boolean; threatened: boolean; onTap: () => void; floaters: ReactNode;
}) {
  const card = getCard(b.cardId);
  const pal = paletteFor(card, p.civ);
  const maxI = maxIntegrity(b);
  const hp = maxI - b.damage;
  const state = b.unrest > 0 ? 'unrest' : working ? 'working' : lack ?? 'unsupported';
  return (
    <button className={`bld fam-${card.family} state-${state} ${glow ? 'coach-glow' : ''} ${fx ?? ''} ${targetable ? 'targetable' : ''} ${threatened ? 'threatened' : ''} rarity-${card.rarity ?? 'common'}`}
      style={{ '--c-primary': pal.primary, '--c-secondary': pal.secondary, '--c-accent': pal.accent } as CSSProperties}
      onClick={onTap} aria-label={`${card.name}, integrity ${hp} of ${maxI}, ${state}`}>
      <div className="bld-plinth" />
      <div className="bld-art"><CardArt motif={card.art} palette={pal} /></div>
      <div className="bld-name">{card.name}</div>
      <div className="bld-bar"><i style={{ width: `${(100 * hp) / maxI}%` }} /></div>
      <div className="bld-out">
        {card.income ? <span><Icon name="prosperity" size={11} />{card.income}</span> : null}
        {card.growth ? <span><Icon name="growth" size={11} />{card.growth}</span> : null}
        {(card.passives ?? []).includes('wall') ? <span><Icon name="integrity" size={11} />wall</span> : null}
        {(card.passives ?? []).includes('tower') ? <span><Icon name="str" size={11} />tower</span> : null}
      </div>
      {state === 'unrest' && <div className="bld-flag unrest"><Icon name="unrest" size={12} />{b.unrest}</div>}
      {state === 'unsupported' && <div className="bld-flag broken"><Icon name="broken" size={12} /></div>}
      {state === 'hungry' && <div className="bld-flag hungry" title="Hungry: not enough Food"><Icon name="food" size={12} /></div>}
      {state === 'idle' && <div className="bld-flag idle" title="Idle: no Worker free"><Icon name="worker" size={12} /></div>}
      <i className={`bld-age age-${card.age}`} aria-hidden />
      {hidden > 0 && <div className="bld-traps" aria-label={`${hidden} hidden trap${hidden > 1 ? 's' : ''}`}>{Array.from({ length: hidden }, (_, i) => <i key={i} />)}</div>}
      {keystone > 0 && <div className="bld-key" aria-label={`Key target: ${keystone} more thing${keystone > 1 ? 's' : ''} fall with it`}><Icon name="broken" size={11} />{keystone}</div>}
      <div className="floaters">{floaters}</div>
    </button>
  );
}

/**
 * The city on each bank: it grows house by house as Progress fills the Age bar,
 * and houses fall to ruin as Stability is lost. A short rise or tremor marks each change.
 */
function LivingCity({ p, side }: { p: PlayerState; side: 'near' | 'far' }) {
  const growth = p.progress / progressNeeded(p.age);
  const ruins = Math.min(10, Math.floor(Math.max(0, RULES.startingStability - p.stability) / 3));
  const key = `${p.age}:${Math.round(growth * 12)}:${ruins}`;
  const prev = useRef({ key, ruins, size: p.age * 100 + growth * 100 });
  const [fx, setFx] = useState('');
  useEffect(() => {
    const was = prev.current;
    if (was.key === key) return;
    const size = p.age * 100 + growth * 100;
    setFx(ruins > was.ruins || size < was.size - 0.5 ? 'city-hurt' : size > was.size ? 'city-rise' : '');
    prev.current = { key, ruins, size };
    const t = setTimeout(() => setFx(''), 1400);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
    <div className="city-backdrop" style={{ background: skylineBackdrop(getCiv(p.civ).palette, side) }} aria-hidden />
    <div className={`skyline ${fx}`} aria-label={`${getCiv(p.civ).name}: Age ${p.age}, ${Math.round(growth * 100)}% toward the next${ruins ? `, ${ruins} houses in ruins` : ''}`}>
      <Skyline civ={p.civ} age={p.age} palette={getCiv(p.civ).palette} side={side} growth={growth} ruins={ruins} />
    </div>
    </>
  );
}

function FalloutList({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="fallout">
      <h4><Icon name="broken" size={14} /> {title}</h4>
      <ul>{lines.map((l) => <li key={l} className={/Nothing else/.test(l) ? 'calm' : ''}>{l}</li>)}</ul>
    </div>
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
    <button className={`unit ${glow ? 'coach-glow' : ''} ${fx ?? ''} ${canAttack ? 'can-attack' : ''} ${canBlock ? 'can-block' : ''} ${selected ? 'is-selected' : ''} ${u.attacked ? 'exhausted' : ''} ${attacking ? 'attacking' : ''} ${!u.ready ? 'not-ready' : ''}`}
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

function ResponsePanel({ view, me, blockers, reaction, muster, onRespond, onClearReaction, onClearMuster, glow }: {
  glow?: string; view: GameState; me: PlayerId; blockers: string[]; reaction: string | null; muster: string | null;
  onRespond: () => void; onClearReaction: () => void; onClearMuster: () => void;
}) {
  const pending = view.pending!;
  const O = view.players[other(me)];
  const P = view.players[me];
  const reacts = playableReactions(view, me);
  const musters = musterable(view, me);
  let title: string, detail: ReactNode;
  if (pending.kind === 'attack') {
    const units = O.units.filter((u) => pending.unitUids.includes(u.uid));
    const power = units.reduce((s, u) => s + unitStr(O, u), 0);
    const tgt = pending.target.kind === 'city' ? 'your city' : getCard(P.buildings.find((b) => b.uid === (pending.target as { uid: string }).uid)?.cardId ?? 'farm').name;
    title = `${O.name} crosses the river toward ${tgt}`;
    detail = <>{units.length} unit{units.length > 1 ? 's' : ''}, <b>{power}</b> strength{units.some((u) => (getCard(u.cardId).keywords ?? []).includes('siege')) ? ' (+siege)' : ''}. {(() => {
      const ways = [
        P.units.some((u) => !u.attacked && !u.blocked) && 'tap your units to block (+1 Strength on their own bank)',
        musters.length > 0 && 'call a soldier from your hand to arms (pay its cost; it blocks at once)',
        reacts.length > 0 && 'play a reaction card',
      ].filter(Boolean) as string[];
      return ways.length ? <> You can {ways.length > 1 ? `${ways.slice(0, -1).join(', ')}, or ${ways[ways.length - 1]}` : ways[0]}.</> : <> Nothing can answer this one.</>;
    })()}</>;
  } else {
    const card = getCard(pending.card.cardId);
    const tgt = pending.targetUid ? P.buildings.find((b) => b.uid === pending.targetUid) : undefined;
    title = `${O.name} schemes: ${card.name}`;
    detail = <>{card.text}{tgt ? <> Target: <b>{getCard(tgt.cardId).name}</b>.</> : null}{reacts.length ? ' Pick a reaction to counter it.' : ' You have no counter ready.'}</>;
  }
  const doing = blockers.length || reaction || muster;
  return (
    <div className="respond-panel" role="dialog" aria-label="Respond">
      <div className="rp-title">{title}</div>
      <div className="rp-detail">{detail}</div>
      <div className="rp-actions">
        {reaction && <span className="rp-chip">{getCard(P.hand.find((c) => c.uid === reaction)!.cardId).name}<button onClick={onClearReaction} aria-label="Remove reaction"><Icon name="close" size={12} /></button></span>}
        {muster && <span className="rp-chip">To arms: {getCard(P.hand.find((c) => c.uid === muster)!.cardId).name}<button onClick={onClearMuster} aria-label="Cancel call to arms"><Icon name="close" size={12} /></button></span>}
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

/** The city ledger: food, workers, sets and what to build next, in plain words. */
function LedgerSheet({ p, mine, onClose }: { p: PlayerState; mine: boolean; onClose: () => void }) {
  const inc = incomeOf(p), L = inc.ledger;
  const nameOf = (uid: string) => getCard(p.buildings.find((b) => b.uid === uid)?.cardId ?? 'farm').name;
  const farms = p.buildings.filter((b) => L.working.has(b.uid) && (getCard(b.cardId).tags ?? []).includes('farm')).length;
  const houses = p.buildings.filter((b) => L.working.has(b.uid) && (getCard(b.cardId).tags ?? []).includes('housing')).length;
  const places = p.buildings.filter((b) => L.working.has(b.uid) && (getCard(b.cardId).staff ?? 0) > 0).length;
  const tips: string[] = [];
  if (inc.foodShort) tips.push(`Your army is ${inc.foodShort} Food short: the weakest soldiers will desert at the start of your turn. Build a Farm, or let them go.`);
  if (L.hungry.length) tips.push(`${L.hungry.map(nameOf).join(', ')} ${L.hungry.length > 1 ? 'are' : 'is'} hungry. A Farm makes 2 Food.`);
  if (L.idle.length) tips.push(`${L.idle.map(nameOf).join(', ')} ${L.idle.length > 1 ? 'stand' : 'stands'} idle with no Worker. A fed Village gives one.`);
  const lacking = farms <= houses && farms <= places ? 'a Farm' : houses <= places ? 'a Village' : 'a workplace (Quarry, Market, Temple)';
  tips.push(`Next settlement: add ${lacking}. Each working Farm + fed Village + staffed workplace gives +1 Progress a turn.`);
  return (
    <Sheet onClose={onClose} wide>
      <h3 className="sheet-title">{mine ? 'Your city' : `${getCiv(p.civ).name}`}: food, people and work</h3>
      <div className="ledger">
        <section className="ledger-col">
          <h4><Icon name="food" size={16} /> Food</h4>
          <dl>
            <div><dt>Made each turn</dt><dd>{L.food}</dd></div>
            {L.storeCap > 0 && <div><dt>Kept in granaries</dt><dd>{L.stored} / {L.storeCap}</dd></div>}
            <div><dt>Eaten by the city</dt><dd>−{L.cityEats}</dd></div>
            <div><dt>Eaten by the army</dt><dd className={inc.foodShort ? 'bad' : ''}>−{L.armyEats}{inc.foodShort ? ` (${inc.foodShort} short)` : ''}</dd></div>
            <div><dt>Spare: kept / sold</dt><dd>{L.keep} / +{L.sold} Prosperity</dd></div>
          </dl>
        </section>
        <section className="ledger-col">
          <h4><Icon name="worker" size={16} /> Workers</h4>
          <dl>
            <div><dt>From the city (one per Age)</dt><dd>{p.age}</dd></div>
            <div><dt>From fed Villages</dt><dd>{L.workers - p.age}</dd></div>
            <div><dt>At work</dt><dd>{L.workersUsed}</dd></div>
            <div><dt>Free</dt><dd>{L.workers - L.workersUsed}</dd></div>
          </dl>
        </section>
        <section className="ledger-col">
          <h4><Icon name="star" size={16} /> Bonuses</h4>
          <dl>
            <div><dt>Complete settlements</dt><dd>{L.sets} (+{L.sets} Progress a turn)</dd></div>
            <div><dt>Complete districts</dt><dd>{L.districts.length}</dd></div>
            <div><dt>Progress each turn</dt><dd>+{inc.growth}</dd></div>
            <div><dt>Prosperity each turn</dt><dd>+{inc.prosperity}</dd></div>
          </dl>
        </section>
      </div>
      <section className="districts">
        <h4><Icon name="star" size={16} /> Districts: combinations that pay every turn</h4>
        <div className="district-grid">
          {districtsFor(p.civ).map((d) => {
            const done = L.districts.includes(d.id);
            const near = L.near.find((n) => n.id === d.id);
            return (
              <div key={d.id} className={`district ${done ? 'done' : near ? 'near' : ''} ${d.civ ? 'own' : ''}`}>
                <div className="d-name">{d.name}{d.civ && <em> · {getCiv(d.civ).name.replace(/^Kingdom of /, '')} only</em>}</div>
                <div className="d-recipe">{d.parts.map((pt) => `${pt.n > 1 ? `${pt.n} ` : ''}${pt.label}`).join(' + ')}</div>
                <div className="d-bonus">{d.text}</div>
                <div className="d-state">{done ? '✓ Complete' : near ? `One ${near.missing} away` : ''}</div>
              </div>
            );
          })}
        </div>
      </section>
      {mine && <ul className="ledger-tips">{tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      <div className="sheet-actions"><button className="btn ghost" onClick={onClose}>Close</button></div>
    </Sheet>
  );
}
