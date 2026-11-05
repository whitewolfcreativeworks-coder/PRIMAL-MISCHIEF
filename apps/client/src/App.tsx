import { CIVS, type CivId, type Difficulty } from '@pm/engine';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultServerUrl, LocalMatch, OnlineMatch, savedRoom, type AnyMatch } from './game/match';
import { Board } from './ui/Board';
import { HowToPlay } from './ui/HowToPlay';
import { DeckBuilder, loadDeck, LocalSetup, Lobby, Title, WaitingRoom } from './ui/Menu';

type Screen = 'title' | 'local' | 'online' | 'deck' | 'match';

const stored = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const store = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function App() {
  const params = new URLSearchParams(location.search);
  const inviteCode = params.get('room')?.toUpperCase() ?? undefined;
  const [screen, setScreen] = useState<Screen>(inviteCode ? 'online' : 'title');
  const [back, setBack] = useState<Screen>('title');
  const [civ, setCiv] = useState<CivId | null>(() => (stored('pm.civ', '') as CivId) || null);
  const [deckCiv, setDeckCiv] = useState<CivId>('kush');
  const [name, setName] = useState(() => stored('pm.name', ''));
  const [pace, setPace] = useState(() => Number(stored('pm.pace', '1')));
  const [serverUrl, setServerUrl] = useState(() => stored('pm.server', '') || defaultServerUrl());
  const [match, setMatch] = useState<AnyMatch | null>(null);
  const [help, setHelp] = useState(false);
  const [, force] = useState(0);
  const lastLocal = useRef<{ aiCiv: CivId | 'random'; difficulty: Difficulty } | null>(null);

  useEffect(() => store('pm.name', name), [name]);
  useEffect(() => { if (civ) store('pm.civ', civ); }, [civ]);
  useEffect(() => store('pm.pace', String(pace)), [pace]);
  useEffect(() => { if (match instanceof LocalMatch) match.setPace(pace); }, [pace, match]);
  useEffect(() => () => match?.dispose(), [match]);

  // Re-render while an online match is waiting so the waiting room appears.
  useEffect(() => { if (!match) return; const off = match.subscribe(() => force((n) => n + 1)); return () => { off(); }; }, [match]);

  const ruler = name.trim() || 'Ruler';

  function startLocal(opts: { aiCiv: CivId | 'random'; difficulty: Difficulty }) {
    if (!civ) return;
    lastLocal.current = opts;
    const others = CIVS.filter((c) => c.id !== civ);
    const aiCiv = opts.aiCiv === 'random' ? others[Math.floor(Math.random() * others.length)].id : opts.aiCiv;
    match?.dispose();
    setMatch(new LocalMatch({
      seed: Math.floor(Math.random() * 2 ** 31), difficulty: opts.difficulty, pace,
      human: { name: ruler, civ, deck: loadDeck(civ) },
      ai: { name: CIVS.find((c) => c.id === aiCiv)!.name.replace('Kingdom of ', ''), civ: aiCiv },
    }));
    setScreen('match');
  }

  function startOnline(kind: 'create' | 'join', code?: string) {
    if (!civ) return;
    store('pm.server', serverUrl);
    match?.dispose();
    const m = new OnlineMatch(serverUrl, kind === 'create'
      ? { kind: 'create', name: ruler, civ, deck: loadDeck(civ) }
      : { kind: 'join', code: code!, name: ruler, civ, deck: loadDeck(civ) });
    setMatch(m);
    setScreen('match');
    if (inviteCode) history.replaceState(null, '', location.pathname);
  }

  function resume() {
    const r = savedRoom();
    if (!r) return;
    match?.dispose();
    setMatch(new OnlineMatch(r.url, { kind: 'resume', code: r.code, token: r.token }));
    setScreen('match');
  }

  function exit() {
    if (match instanceof OnlineMatch) match.leave(); else match?.dispose();
    setMatch(null);
    setScreen('title');
  }

  const openDeck = (c: CivId, from: Screen) => { setDeckCiv(c); setBack(from); setScreen('deck'); };

  let body: ReactNode;
  if (screen === 'match' && match) {
    const s = match.getSnapshot();
    if (s.online && !s.view) {
      body = s.status === 'error'
        ? <div className="screen waiting-screen"><h2>Connection problem</h2><p>{s.error}</p><p className="muted">Server: {serverUrl}</p><button className="btn" onClick={exit}>Back</button></div>
        : s.roomCode ? <WaitingRoom code={s.roomCode} onCancel={exit} /> : <div className="screen waiting-screen"><p className="dots">Connecting</p><button className="btn ghost" onClick={exit}>Cancel</button></div>;
    } else {
      body = <Board key={String(s.online) + (lastLocal.current ? JSON.stringify(lastLocal.current) : '')} match={match} pace={pace} onExit={exit}
        onRematch={match instanceof LocalMatch && lastLocal.current ? () => startLocal(lastLocal.current!) : undefined} />;
    }
  } else if (screen === 'local') {
    body = <LocalSetup civ={civ} setCiv={setCiv} onBack={() => setScreen('title')} onStart={startLocal} onDeck={(c) => openDeck(c, 'local')} />;
  } else if (screen === 'online') {
    body = <Lobby civ={civ} setCiv={setCiv} onBack={() => setScreen('title')} onDeck={(c) => openDeck(c, 'online')} initialCode={inviteCode}
      onCreate={() => startOnline('create')} onJoin={(code) => startOnline('join', code)} serverUrl={serverUrl} setServerUrl={setServerUrl} />;
  } else if (screen === 'deck') {
    body = <DeckBuilder civ={deckCiv} onDone={() => setScreen(back)} />;
  } else {
    body = (
      <>
        <Title onLocal={() => setScreen('local')} onOnline={() => setScreen('online')} onHelp={() => setHelp(true)}
          resumable={!!savedRoom()} onResume={resume} name={name} setName={setName} />
        <div className="pace-ctl">
          <span>Animations</span>
          <div className="seg">
            {[[1, 'Full'], [0.5, 'Fast'], [0, 'Off']].map(([v, l]) => <button key={l} className={pace === v ? 'on' : ''} onClick={() => setPace(v as number)}>{l}</button>)}
          </div>
        </div>
      </>
    );
  }
  return <div className="app">{body}{help && <HowToPlay onClose={() => setHelp(false)} />}</div>;
}
