import { getCard, getCiv, type CardDef, type CivId } from '@pm/engine';
import type { CSSProperties, ReactElement } from 'react';
import { CardArt } from '../art/motifs';
import { FAMILY_COLOR, FAMILY_LABEL, Icon, ROMAN } from './icons';

const NEUTRAL = { primary: '#3a3328', secondary: '#bfa06a', accent: '#efe2c4', ink: '#17130d' };

export function paletteFor(card: CardDef, fallbackCiv?: CivId) {
  const civ = card.civ ?? fallbackCiv;
  return civ ? getCiv(civ).palette : NEUTRAL;
}

const KIND_LABEL: Record<CardDef['kind'], string> = {
  building: 'Building', development: 'Development', unit: 'Unit', fort: 'Fortification', tactic: 'Tactic', reaction: 'Reaction',
};

/** Rules text with keyword emphasis. */
function RulesText({ text }: { text: string }) {
  const parts = text.split(/(Hostile\.|Reaction to [^:]+:|Wall:|Tower:|Ranged:|Siege:|Swift:|Raider:|Wonder\.|Harbor\.?|Road:|Upkeep \d+\.?)/g);
  return <>{parts.map((s, i) => (i % 2 ? <b key={i}>{s}</b> : <span key={i}>{s}</span>))}</>;
}

export interface CardProps {
  cardId: string;
  civ?: CivId;
  cost?: number;
  size?: 'hand' | 'full';
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

export function CardFace({ cardId, civ, cost, size = 'hand', disabled, selected, onClick, style, className }: CardProps) {
  const card = getCard(cardId);
  const pal = paletteFor(card, civ);
  const rarity = card.rarity ?? 'common';
  const shownCost = cost ?? card.cost;
  const vars = {
    '--c-primary': pal.primary, '--c-secondary': pal.secondary, '--c-accent': pal.accent, '--c-ink': pal.ink,
    '--c-family': FAMILY_COLOR[card.family], ...style,
  } as CSSProperties;
  const stats: ReactElement[] = [];
  if (card.progress) stats.push(<span key="p" className="stat progress" title="Progress when played"><Icon name="progress" size={12} />+{card.progress}</span>);
  if (card.growth) stats.push(<span key="g" className="stat growth" title="Progress each turn"><Icon name="growth" size={12} />+{card.growth}/t</span>);
  if (card.income) stats.push(<span key="i" className="stat prosperity" title="Prosperity each turn"><Icon name="prosperity" size={12} />+{card.income}/t</span>);
  if (card.kind === 'unit') {
    stats.push(<span key="s" className="stat str"><Icon name="str" size={13} />{card.str}</span>);
    stats.push(<span key="h" className="stat hp"><Icon name="hp" size={13} />{card.hp}</span>);
    if (card.upkeep) stats.push(<span key="u" className="stat upkeep" title="Upkeep: Prosperity each turn"><Icon name="prosperity" size={12} />−{card.upkeep}/t</span>);
  }
  if (card.kind === 'building' || card.kind === 'fort') stats.push(<span key="n" className="stat integrity"><Icon name="integrity" size={13} />{card.integrity}</span>);
  return (
    <div
      className={`card card-${size} fam-${card.family} rarity-${rarity} kind-${card.kind} ${disabled ? 'is-disabled' : ''} ${selected ? 'is-selected' : ''} ${className ?? ''}`}
      style={vars} onClick={onClick} role={onClick ? 'button' : undefined} aria-label={`${card.name}, ${FAMILY_LABEL[card.family]}, Age ${card.age}, cost ${shownCost}. ${card.text}`}
    >
      <div className="card-frame">
        <div className="card-art"><CardArt motif={card.art} palette={pal} /></div>
        <div className="card-sheen" />
        <div className={`card-cost ${shownCost < card.cost ? 'discounted' : ''}`}>{shownCost}</div>
        <div className="card-age" title={`${FAMILY_LABEL[card.family]} · Age ${ROMAN[card.age - 1]}`}>
          <Icon name={card.family} size={size === 'full' ? 15 : 11} /><span>{ROMAN[card.age - 1]}</span>
        </div>
        <div className="card-body">
          <div className="card-name">{card.name}</div>
          <div className="card-type">{KIND_LABEL[card.kind]}{card.civ ? ` · ${getCiv(card.civ).name.replace('Kingdom of ', '')}` : ''}{rarity !== 'common' ? ` · ${rarity}` : ''}</div>
          <div className="card-text"><RulesText text={card.text} /></div>
          {size === 'full' && card.flavor && <div className="card-flavor">{card.flavor}</div>}
          {stats.length > 0 && <div className="card-stats">{stats}</div>}
        </div>
      </div>
    </div>
  );
}

/** Face-down card back: shows only the deck it came from. */
export function CardBack({ civ, family, style }: { civ: CivId; family?: 'civ' | 'mil'; style?: CSSProperties }) {
  const pal = getCiv(civ).palette;
  return <div className={`card-back ${family ? `back-${family}` : ''}`} style={{ '--c-primary': pal.primary, '--c-secondary': pal.secondary, ...style } as CSSProperties} />;
}
