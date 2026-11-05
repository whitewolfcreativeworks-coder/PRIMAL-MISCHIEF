import { getCard, getCiv, type CardDef, type CivId } from '@pm/engine';
import type { CSSProperties, ReactElement } from 'react';
import { CardArt } from '../art/motifs';
import { Icon, SUIT_COLOR, SUIT_LABEL } from './icons';

const NEUTRAL = { primary: '#3a3328', secondary: '#bfa06a', accent: '#efe2c4', ink: '#17130d' };

export function paletteFor(card: CardDef, fallbackCiv?: CivId) {
  const civ = card.civ ?? fallbackCiv;
  return civ ? getCiv(civ).palette : NEUTRAL;
}

const KIND_LABEL = { building: 'Building', unit: 'Unit', action: 'Action', reaction: 'Reaction' } as const;

/** Rules text with keyword emphasis. */
function RulesText({ text }: { text: string }) {
  const parts = text.split(/(Hostile\.|Reaction to [^:]+:|Chain \w+:|Wall:|Ranged:|Siege:|Swift:|Raider:|Wage:|Wonder\.|Harbor\.?|Road:)/g);
  return <>{parts.map((s, i) => (i % 2 ? <b key={i}>{s}</b> : <span key={i}>{s}</span>))}</>;
}

export interface CardProps {
  cardId: string;
  civ?: CivId; // owner's civ, tints common cards
  cost?: number; // effective cost (e.g. after discounts)
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
    '--c-suit': SUIT_COLOR[card.suit], ...style,
  } as CSSProperties;
  const stats: ReactElement[] = [];
  if (card.kind === 'unit') {
    stats.push(<span key="s" className="stat str"><Icon name="str" size={13} />{card.str}</span>);
    stats.push(<span key="h" className="stat hp"><Icon name="hp" size={13} />{card.hp}</span>);
    if (card.upkeep) stats.push(<span key="u" className="stat food" title="Upkeep"><Icon name="food" size={12} />−{card.upkeep}</span>);
  }
  if (card.kind === 'building') {
    stats.push(<span key="i" className="stat integrity"><Icon name="integrity" size={13} />{card.integrity}</span>);
    if (card.goods) stats.push(<span key="g" className="stat goods"><Icon name="goods" size={12} />+{card.goods}</span>);
    if (card.food) stats.push(<span key="f" className="stat food"><Icon name="food" size={12} />+{card.food}</span>);
    if (card.legacy) stats.push(<span key="l" className="stat legacy"><Icon name="legacy" size={12} />+{card.legacy}</span>);
  }
  return (
    <div
      className={`card card-${size} rarity-${rarity} kind-${card.kind} ${disabled ? 'is-disabled' : ''} ${selected ? 'is-selected' : ''} ${className ?? ''}`}
      style={vars} onClick={onClick} role={onClick ? 'button' : undefined} aria-label={`${card.name}, cost ${shownCost}. ${card.text}`}
    >
      <div className="card-frame">
        <div className="card-art"><CardArt motif={card.art} palette={pal} /></div>
        <div className="card-sheen" />
        <div className={`card-cost ${shownCost < card.cost ? 'discounted' : ''}`}>{shownCost}</div>
        <div className="card-suit" title={SUIT_LABEL[card.suit]}><Icon name={card.suit} size={size === 'full' ? 18 : 13} /></div>
        <div className="card-body">
          <div className="card-name">{card.name}</div>
          <div className="card-type">{KIND_LABEL[card.kind]}{card.civ ? ` · ${getCiv(card.civ).name.replace('Kingdom of ', '')}` : ''}{rarity !== 'common' ? ` · ${rarity}` : ''}</div>
          <div className="card-text"><RulesText text={card.text} />{card.chain && <> <RulesText text={card.chain.text} /></>}</div>
          {size === 'full' && card.flavor && <div className="card-flavor">{card.flavor}</div>}
          {stats.length > 0 && <div className="card-stats">{stats}</div>}
        </div>
      </div>
    </div>
  );
}

/** Face-down card back used for the opponent's hand. */
export function CardBack({ civ, style }: { civ: CivId; style?: CSSProperties }) {
  const pal = getCiv(civ).palette;
  return <div className="card-back" style={{ '--c-primary': pal.primary, '--c-secondary': pal.secondary, ...style } as CSSProperties} />;
}
