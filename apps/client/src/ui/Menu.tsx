import { cardPoolFor, CIVS, getCiv, type CivId, type Difficulty, type Family } from '@pm/engine';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { CivEmblem } from '../art/motifs';
import cover from '../assets/cover.webp';
import { CardFace } from './Card';
import { Inspector } from './Inspector';
import type { Lesson } from '../game/tutorial';
import { FAMILY_LABEL, Icon, ROMAN } from './icons';

/** Build flag for the single-file offline edition (no game server, vs-computer only). */
export const OFFLINE = import.meta.env.VITE_OFFLINE === '1';

// ---------------------------------------------------------------- title

export function Title({ onLocal, onOnline, onHelp, onAcademy, onTheater, resumable, onResume, name, setName }: {
  onTheater: () => void; onAcademy: () => void; onLocal: () => void; onOnline: () => void; onHelp: () => void; resumable: boolean; onResume: () => void; name: string; setName: (n: string) => void;
}) {
  return (
    <div className="title-screen">
      <div className="title-cover">
        <img src={cover} alt="" width={840} height={840} decoding="async" />
      </div>
      <h1 className="visually-hidden">Primal Mischief</h1>
      <div className="title-side">
      <p className="tagline">Build civilizations. Dismantle theirs.</p>
      <label className="name-field">
        <span>Your name</span>
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Ruler" />
      </label>
      <div className="title-actions">
        {!OFFLINE && resumable && <button className="btn primary big" onClick={onResume}>Resume online match</button>}
        <button className="btn primary big" onClick={onLocal}>Play the computer</button>
        <button className="btn big" onClick={onAcademy}>Academy — learn each civilization</button>
        {!OFFLINE && <button className="btn big" onClick={onOnline}>Challenge a friend online</button>}
        <div className="title-minor">
          <button className="btn ghost" onClick={onHelp}><Icon name="info" /> How to play</button>
          <button className="btn ghost" onClick={onTheater}>Hologram Theater</button>
        </div>
      </div>
      <p className="fine">A turn-based card game of ancient civilizations · No timers · No purchases</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- civilization select

export function CivSelect({ title, chosen, onChoose, onBack, onDeck, children }: {
  title: string; chosen: CivId | null; onChoose: (c: CivId) => void; onBack: () => void; onDeck?: (c: CivId) => void; children?: ReactNode;
}) {
  return (
    <div className="screen civ-screen">
      <header className="screen-head">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <h2>{title}</h2>
        <span />
      </header>
      <div className="civ-grid">
        {CIVS.map((c) => (
          <button key={c.id} className={`civ-panel ${chosen === c.id ? 'is-chosen' : ''}`} onClick={() => onChoose(c.id)}
            style={{ '--c-primary': c.palette.primary, '--c-secondary': c.palette.secondary, '--c-accent': c.palette.accent, '--c-ink': c.palette.ink } as CSSProperties}>
            <div className="civ-top">
              <CivEmblem civ={c.id} palette={c.palette} size={68} />
              <div>
                <div className="civ-name">{c.name}</div>
                <div className="civ-meta">{c.region} · {c.era}</div>
                <div className="civ-epithet">{c.epithet}</div>
              </div>
            </div>
            <p className="civ-summary">{c.summary}</p>
            <p className="civ-history">{c.history}</p>
            <div className="civ-sig"><Icon name="civ" size={14} /><b>{c.trait.name}</b> — {c.trait.text}</div>
            <div className="civ-sig"><Icon name="momentum" size={14} /><b>{c.signature.name}</b> — {c.signature.text}</div>
            <div className="civ-ages">{c.ages.map((a, i) => <span key={a}><i>{ROMAN[i]}</i>{a}</span>)}</div>
            {chosen === c.id && onDeck && <span className="civ-deck-link" onClick={(e) => { e.stopPropagation(); onDeck(c.id); }}>See its cards →</span>}
          </button>
        ))}
      </div>
      {children && <div className="screen-foot">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- match setup vs AI

export function LocalSetup({ civ, setCiv, onBack, onStart, onDeck }: {
  civ: CivId | null; setCiv: (c: CivId) => void; onBack: () => void; onDeck: (c: CivId) => void;
  onStart: (opts: { aiCiv: CivId | 'random'; difficulty: Difficulty }) => void;
}) {
  const [aiCiv, setAiCiv] = useState<CivId | 'random'>('random');
  const [difficulty, setDifficulty] = useState<Difficulty>(() => { try { return (localStorage.getItem('pm.difficulty') as Difficulty) || 'normal'; } catch { return 'normal'; } });
  return (
    <CivSelect title="Choose your civilization" chosen={civ} onChoose={setCiv} onBack={onBack} onDeck={onDeck}>
      <div className="setup-row">
        <label>Opponent
          <select value={aiCiv} onChange={(e) => setAiCiv(e.target.value as CivId | 'random')}>
            <option value="random">Random civilization</option>
            {CIVS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="seg" role="radiogroup" aria-label="Difficulty">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} role="radio" aria-checked={difficulty === d} className={difficulty === d ? 'on' : ''}
              onClick={() => { setDifficulty(d); try { localStorage.setItem('pm.difficulty', d); } catch { /* storage unavailable */ } }}>{d}</button>
          ))}
        </div>
        <button className="btn primary big" disabled={!civ} onClick={() => onStart({ aiCiv, difficulty })}>Begin</button>
      </div>
    </CivSelect>
  );
}

// ---------------------------------------------------------------- codex (the civilization's two decks, by Age)

export function Codex({ civ, onDone }: { civ: CivId; onDone: () => void }) {
  const [peek, setPeek] = useState<string | null>(null);
  const [fam, setFam] = useState<Family>('civ');
  const c = getCiv(civ);
  const pool = useMemo(() => cardPoolFor(civ), [civ]);
  const copies = (id: string, age: number) => c.decks[fam][age - 1].filter((x) => x === id).length;
  return (
    <div className="screen deck-screen" style={{ '--c-primary': c.palette.primary, '--c-secondary': c.palette.secondary } as CSSProperties}>
      <header className="screen-head">
        <button className="btn ghost" onClick={onDone}>← Back</button>
        <h2>{c.name} · the two decks</h2>
        <div className="seg" role="tablist">
          {(['civ', 'mil'] as Family[]).map((f) => <button key={f} role="tab" aria-selected={fam === f} className={fam === f ? 'on' : ''} onClick={() => setFam(f)}><Icon name={f} size={14} /> {FAMILY_LABEL[f]}</button>)}
        </div>
      </header>
      <p className="academy-intro">Each Age shuffles stronger cards into both decks and retires the cards from two Ages back. Cards marked ★ belong only to {c.name.replace('Kingdom of ', '')}.</p>
      {[1, 2, 3, 4, 5].map((age) => {
        const ids = [...new Set(c.decks[fam][age - 1])];
        return (
          <section key={age} className="codex-age">
            <h3><span>Age {ROMAN[age - 1]}</span> {c.ages[age - 1]}</h3>
            <div className="pool">
              {ids.map((id) => {
                const card = pool.find((x) => x.id === id)!;
                return (
                  <div key={id} className="pool-item in-deck">
                    <CardFace cardId={id} civ={civ} onClick={() => setPeek(id)} />
                    <div className="pool-ctrl"><span>{card.civ ? '★ ' : ''}×{copies(id, age)}</span></div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {peek && (
        <div className="sheet-backdrop" onClick={() => setPeek(null)}>
          <div className="sheet wide" onClick={(e) => e.stopPropagation()}>
            <Inspector cardId={peek} civ={civ}><button className="btn ghost big" onClick={() => setPeek(null)}>Close</button></Inspector>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- online lobby

export function Lobby({ civ, setCiv, onBack, onCreate, onJoin, onDeck, initialCode, serverUrl, setServerUrl }: {
  civ: CivId | null; setCiv: (c: CivId) => void; onBack: () => void; onDeck: (c: CivId) => void;
  onCreate: () => void; onJoin: (code: string) => void; initialCode?: string; serverUrl: string; setServerUrl: (u: string) => void;
}) {
  const [code, setCode] = useState(initialCode ?? '');
  const [adv, setAdv] = useState(false);
  return (
    <CivSelect title="Online challenge — choose your civilization" chosen={civ} onChoose={setCiv} onBack={onBack} onDeck={onDeck}>
      <div className="setup-row lobby-row">
        <button className="btn primary big" disabled={!civ} onClick={onCreate}>Create private room</button>
        <span className="or">or</span>
        <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
          placeholder="ROOM CODE" aria-label="Room code" autoCapitalize="characters" />
        <button className="btn big" disabled={!civ || code.length !== 5} onClick={() => onJoin(code)}>Join</button>
        <button className="btn ghost small" onClick={() => setAdv(!adv)}>Server</button>
      </div>
      {adv && (
        <div className="setup-row">
          <label className="wide">Game server
            <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} spellCheck={false} />
          </label>
        </div>
      )}
    </CivSelect>
  );
}

export function WaitingRoom({ code, onCancel }: { code: string; onCancel: () => void }) {
  const link = `${location.origin}${location.pathname}?room=${code}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="screen waiting-screen">
      <h2>Room ready</h2>
      <p>Share this code with your opponent:</p>
      <div className="room-code">{code.split('').map((ch, i) => <span key={i}>{ch}</span>)}</div>
      <button className="btn" onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ title: 'Primal Mischief', text: `Join my Primal Mischief match: ${code}`, url: link });
          else { await navigator.clipboard.writeText(link); setCopied(true); }
        } catch { /* user cancelled */ }
      }}>{copied ? 'Link copied' : 'Share invite link'}</button>
      <p className="muted dots">Waiting for a challenger</p>
      <button className="btn ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ---------------------------------------------------------------- academy

export function Academy({ lessons, onStart, onBack }: { lessons: Lesson[]; onStart: (l: Lesson) => void; onBack: () => void }) {
  const done = (() => { try { return new Set<string>(JSON.parse(localStorage.getItem('pm.lessonsDone') ?? '[]')); } catch { return new Set<string>(); } })();
  const isDone = (l: Lesson) => done.has(l.id) || (!/-(build|army|mischief)$/.test(l.id) && done.has(l.civ));
  const LAYER: Record<string, string> = { build: 'Build: food, people and work', army: 'Army: who beats whom', mischief: 'Mischief: traps and probes' };
  return (
    <div className="screen academy-screen">
      <header className="screen-head">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <h2>Academy</h2>
        <span />
      </header>
      <p className="academy-intro">Four short lessons per civilization, about three minutes each: its own strengths first, then the three layers of the game. How to build a city, how to pick an army, and how to set traps and probe for them.</p>
      <div className="civ-grid">
        {CIVS.map((c) => {
          const own = lessons.filter((x) => x.civ === c.id);
          const intro = own.find((x) => !/-(build|army|mischief)$/.test(x.id));
          return (
            <div key={c.id} className="civ-panel lesson-panel"
              style={{ '--c-primary': c.palette.primary, '--c-secondary': c.palette.secondary, '--c-accent': c.palette.accent, '--c-ink': c.palette.ink } as CSSProperties}>
              <div className="civ-top">
                <CivEmblem civ={c.id} palette={c.palette} size={64} />
                <div>
                  <div className="civ-name">{c.name}</div>
                  <div className="civ-epithet">{intro?.title ?? c.epithet}</div>
                </div>
              </div>
              <div className="lesson-list">
                {own.map((l) => {
                  const layer = l.id.split('-').pop()!;
                  return (
                    <button key={l.id} className={`btn small lesson-btn ${isDone(l) ? 'done' : ''}`} onClick={() => onStart(l)} title={l.summary}>
                      <span>{LAYER[layer] ?? `Strengths: ${l.title}`}</span><em>{isDone(l) ? '✓' : '→'}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function markLessonDone(id: string) {
  try { const s = new Set<string>(JSON.parse(localStorage.getItem('pm.lessonsDone') ?? '[]')); s.add(id); localStorage.setItem('pm.lessonsDone', JSON.stringify([...s])); } catch { /* ignore */ }
}
