import { getCard, getCiv, type CivId } from '@pm/engine';
import type { ReactNode } from 'react';
import { HoloPreview } from '../holo/HoloStage';
import { CardFace } from './Card';
import { Icon, SUIT_LABEL } from './icons';

/** Plain-language explanations of the terms that appear on cards. */
const GLOSSARY: [RegExp, string, string][] = [
  [/Hostile/, 'Hostile', 'Targets your rival. They get one chance to react — Vigilant Watch cancels it, Mirror the Scheme turns it back on you.'],
  [/Reaction to an attack/, 'Reaction (attack)', 'Played during your rival’s turn when they attack you, together with your choice of blockers. One reaction per attack.'],
  [/Reaction to a Hostile/, 'Reaction (scheme)', 'Played during your rival’s turn when they target you with a Hostile card.'],
  [/Chain/, 'Chain', 'If the card you played just before this one has the named suit, you also get the Chain bonus. Any two cards of the same suit in a row earn +1 Momentum.'],
  [/Unrest/, 'Unrest', 'The building stops working for a number of its owner’s turns — and so does anything that depends on it.'],
  [/Wall:/, 'Wall', 'Damage that gets past your blockers hits the walls before it reaches the city or the targeted building.'],
  [/Ranged/, 'Ranged', '+1 Strength while blocking.'],
  [/Siege/, 'Siege', '+2 Strength when attacking a building, or a city protected by walls.'],
  [/Swift|may attack the turn/, 'Swift', 'Can attack on the turn it is played. Normally units must wait a turn.'],
  [/Raider/, 'Raider', 'When the attack gets through to its target, steal 2 Goods from your rival.'],
  [/Wage/, 'Wage', 'Costs Goods at the start of each of your turns. If you can’t pay, the unit deserts.'],
  [/Upkeep/, 'Upkeep', 'Food eaten each turn. If your Food runs out you suffer famine: −2 Stability and a unit deserts.'],
  [/Requires/, 'Requires', 'Only works while you have a working building of that kind. Lose it and this stops too.'],
  [/Wonder/, 'Wonder', 'A great monument: only one copy per deck, and a big Legacy engine.'],
  [/Legacy/, 'Legacy', `Reach 20 Legacy to win without conquest.`],
  [/Harbor/, 'Harbor', 'Supports Markets and lets you launch fleets.'],
  [/Famine/, 'Famine', 'Running out of Food costs 2 Stability and your hungriest unit.'],
];

export function Inspector({ cardId, civ, cost, note, children }: { cardId: string; civ?: CivId; cost?: number; note?: ReactNode; children?: ReactNode }) {
  const card = getCard(cardId);
  const text = `${card.text} ${card.chain?.text ?? ''}`;
  const terms = GLOSSARY.filter(([re]) => re.test(text));
  if (card.kind === 'unit') terms.unshift([/./, 'Strength and Health', 'Strength is the damage this unit deals in combat; Health is how much it can take before it falls. Damage heals at the end of each turn.']);
  if (card.kind === 'building') terms.unshift([/./, 'Integrity', 'How much damage the building can take. Each building you lose also costs 1 Stability.']);
  return (
    <div className="inspector">
      <div className="insp-card"><CardFace cardId={cardId} civ={civ} cost={cost} size="full" /></div>
      <div className="insp-side">
        <HoloPreview cardId={cardId} />
        <div className="insp-meta">
          <span><Icon name={card.suit} size={14} /> {SUIT_LABEL[card.suit]}</span>
          <span>{card.kind === 'building' ? 'Building' : card.kind === 'unit' ? 'Unit' : card.kind === 'reaction' ? 'Reaction' : 'Action'}</span>
          {card.civ && <span>{getCiv(card.civ).name}</span>}
        </div>
        {note && <p className="insp-note">{note}</p>}
        {terms.length > 0 && (
          <dl className="glossary">
            {terms.map(([, term, def]) => <div key={term}><dt>{term}</dt><dd>{def}</dd></div>)}
          </dl>
        )}
        <div className="sheet-actions insp-actions">{children}</div>
      </div>
    </div>
  );
}
