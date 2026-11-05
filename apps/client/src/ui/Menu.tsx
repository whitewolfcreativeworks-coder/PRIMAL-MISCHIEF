import { cardPoolFor, CIVS, getCard, getCiv, maxCopies, RULES, validateDeck, type CivId, type Difficulty } from '@pm/engine';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { CivEmblem } from '../art/motifs';
import { CardFace } from './Card';
import { Icon } from './icons';

// ---------------------------------------------------------------- persistence

export function loadDeck(civ: CivId): string[] {
  try {
    const raw = localStorage.getItem(`pm.deck.${civ}`);
    if (raw) { const d = JSON.parse(raw); if (validateDeck(civ, d).length === 0) return d; }
  } catch { /* ignore */ }
  return [...getCiv(civ).starterDeck];
}
export function saveDeck(civ: CivId, deck: string[] | null) {
  try { if (deck) localStorage.setItem(`pm.deck.${civ}`, JSON.stringify(deck)); else localStorage.removeItem(`pm.deck.${civ}`); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- title

export function Title({ onLocal, onOnline, onHelp, resumable, onResume, name, setName }: {
  onLocal: () => void; onOnline: () => void; onHelp: () => void; resumable: boolean; onResume: () => void; name: string; setName: (n: string) => void;
}) {
  return (
    <div className="title-screen">
      <div className="title-emblems">
        {CIVS.map((c, i) => <div key={c.id} className="t-emb" style={{ '--i': i } as CSSProperties}><CivEmblem civ={c.id} palette={c.palette} size={58} /></div>)}
      </div>
      <h1 className="logo">Primal <span>Mischief</span></h1>
      <p className="tagline">Build civilizations. Dismantle theirs.</p>
      <label className="name-field">
        <span>Your name</span>
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Ruler" />
      </label>
      <div className="title-actions">
        {resumable && <button className="btn primary big" onClick={onResume}>Resume online match</button>}
        <button className="btn primary big" onClick={onLocal}>Play the computer</button>
        <button className="btn big" onClick={onOnline}>Challenge a friend online</button>
        <button className="btn ghost" onClick={onHelp}><Icon name="info" /> How to play</button>
      </div>
      <p className="fine">A turn-based card game of ancient civilizations · No timers · No purchases</p>
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
            <div className="civ-sig"><Icon name="momentum" size={14} /><b>{c.signature.name}</b> — {c.signature.text}</div>
            {chosen === c.id && onDeck && <span className="civ-deck-link" onClick={(e) => { e.stopPropagation(); onDeck(c.id); }}>Edit deck →</span>}
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
  const [difficulty, setDifficulty] = useState<Difficulty>(() => (localStorage.getItem('pm.difficulty') as Difficulty) || 'normal');
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
              onClick={() => { setDifficulty(d); localStorage.setItem('pm.difficulty', d); }}>{d}</button>
          ))}
        </div>
        <button className="btn primary big" disabled={!civ} onClick={() => onStart({ aiCiv, difficulty })}>Begin</button>
      </div>
    </CivSelect>
  );
}

// ---------------------------------------------------------------- deck builder

export function DeckBuilder({ civ, onDone }: { civ: CivId; onDone: () => void }) {
  const [deck, setDeck] = useState<string[]>(() => loadDeck(civ));
  const [peek, setPeek] = useState<string | null>(null);
  const pool = useMemo(() => cardPoolFor(civ).sort((a, b) => (a.civ ? 0 : 1) - (b.civ ? 0 : 1) || a.kind.localeCompare(b.kind) || a.cost - b.cost), [civ]);
  const count = (id: string) => deck.filter((d) => d === id).length;
  const errors = validateDeck(civ, deck);
  const c = getCiv(civ);
  const add = (id: string) => { if (deck.length < RULES.deckSize && count(id) < maxCopies(getCard(id))) setDeck([...deck, id]); };
  const remove = (id: string) => { const i = deck.indexOf(id); if (i >= 0) setDeck(deck.filter((_, j) => j !== i)); };
  const byKind = (k: string) => deck.filter((d) => getCard(d).kind === k).length;
  return (
    <div className="screen deck-screen" style={{ '--c-primary': c.palette.primary, '--c-secondary': c.palette.secondary } as CSSProperties}>
      <header className="screen-head">
        <button className="btn ghost" onClick={onDone}>← Back</button>
        <h2>{c.name} deck <small className={deck.length === RULES.deckSize ? 'ok' : 'warn'}>{deck.length}/{RULES.deckSize}</small></h2>
        <div className="deck-tools">
          <button className="btn ghost" onClick={() => setDeck([...c.starterDeck])}>Reset to starter</button>
          <button className="btn primary" disabled={errors.length > 0} onClick={() => { saveDeck(civ, deck); onDone(); }}>Save</button>
        </div>
      </header>
      <div className="deck-mix">
        <span>Buildings {byKind('building')}</span><span>Units {byKind('unit')}</span><span>Actions {byKind('action')}</span><span>Reactions {byKind('reaction')}</span>
        {errors.length > 0 && <span className="warn">{errors[0]}</span>}
      </div>
      <div className="pool">
        {pool.map((card) => {
          const n = count(card.id);
          return (
            <div key={card.id} className={`pool-item ${n ? 'in-deck' : ''}`}>
              <CardFace cardId={card.id} civ={civ} onClick={() => setPeek(card.id)} />
              <div className="pool-ctrl">
                <button className="icon-btn" onClick={() => remove(card.id)} disabled={!n} aria-label={`Remove ${card.name}`}>−</button>
                <span>{n}/{maxCopies(card)}</span>
                <button className="icon-btn" onClick={() => add(card.id)} disabled={n >= maxCopies(card) || deck.length >= RULES.deckSize} aria-label={`Add ${card.name}`}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {peek && (
        <div className="sheet-backdrop" onClick={() => setPeek(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <CardFace cardId={peek} civ={civ} size="full" />
            <div className="sheet-actions"><button className="btn ghost" onClick={() => setPeek(null)}>Close</button></div>
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
