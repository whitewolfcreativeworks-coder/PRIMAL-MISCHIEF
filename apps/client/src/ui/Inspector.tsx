import { getCard, getCiv, roleText, type CivId } from '@pm/engine';
import type { ReactNode } from 'react';
import { HoloPreview } from '../holo/HoloStage';
import { CardFace } from './Card';
import { FAMILY_LABEL, Icon, ROMAN } from './icons';

/** Plain-language explanations of the terms that appear on cards. */
const GLOSSARY: [RegExp, string, string][] = [
  [/Hostile/, 'Hostile', 'Targets your rival. They get one chance to react: Vigilant Watch cancels it, Mirror the Scheme turns it back on you.'],
  [/Reaction to an attack/, 'Reaction (attack)', 'Played on your rival’s turn when they cross the river at you, together with your choice of blockers. One reaction per attack.'],
  [/Reaction to a Hostile/, 'Reaction (scheme)', 'Played on your rival’s turn when they target you with a Hostile card.'],
  [/Unrest/, 'Unrest', 'The building stops working for a number of its owner’s turns, and so does anything that depends on it.'],
  [/Wall:|Wall\./, 'Wall', 'Damage that gets past your blockers hits the walls before it reaches the city or the targeted building.'],
  [/Tower/, 'Tower', 'Deals 1 damage to every attacking unit as it crosses the river, before the fight.'],
  [/Ranged/, 'Ranged', '+1 Strength while blocking.'],
  [/Siege/, 'Siege', '+2 Strength when attacking a building, or a city protected by walls.'],
  [/Swift|attack the turn/, 'Swift', 'Can cross the river on the turn it is deployed. Normally units must wait a turn.'],
  [/Raider/, 'Raider', 'When the attack gets through, your rival loses 2 Progress.'],
  [/Eats \d+ Food|Eats no Food/, 'Food', 'Farms make Food each turn (and your land makes 1). Villages and Palaces eat first; soldiers eat what is left. Hungry buildings stand idle; hungry soldiers desert, weakest first. Spare Food fills your granaries, then sells for Prosperity.'],
  [/Worker/, 'Workers', 'Each fed Village gives a Worker, and your city has one per Age. Workplaces (Quarries, Markets, Temples…) need one each, or they stand idle.'],
  [/Makes \d+ Food|Counts as a Farm/, 'Farm', 'Makes Food. A working Farm, a fed Village and a staffed workplace together make a settlement: +1 Progress a turn. Three Farms make a Breadbasket: +1 Food each.'],
  [/Requires/, 'Requires', 'Only works while you have a working building of that kind. Lose it and this stops too.'],
  [/Wonder/, 'Wonder', 'A great monument of the fifth Age: one copy, a big Progress engine.'],
  [/Harbor/, 'Harbor', 'Supports Markets and launches fleets.'],
  [/Progress/, 'Progress', 'Fills your Age bar. A full bar advances your civilization to its next Age; completing Age V is a Golden Age victory.'],
  [/Prosperity/, 'Prosperity', 'Your civilization’s wealth: earned every turn and spent to play cards. Spare Food sells for it.'],
];

export function Inspector({ cardId, civ, cost, note, children }: { cardId: string; civ?: CivId; cost?: number; note?: ReactNode; children?: ReactNode }) {
  const card = getCard(cardId);
  const text = card.text;
  const terms = GLOSSARY.filter(([re]) => re.test(text));
  if (card.family === 'civ' && !terms.some(([, t]) => t === 'Progress')) terms.unshift([/./, 'Progress', 'Fills your Age bar. A full bar advances your civilization to its next Age; completing Age V is a Golden Age victory.']);
  if (card.role) terms.unshift([/./, 'Battlefield role', `${roleText(card.role)}. A unit facing a role it beats fights with +2 Strength. Three different roles attacking together get +2; three of one role form a massed formation (archers volley, spears form a hedgehog, riders charge).`]);
  if (card.kind === 'unit') terms.unshift([/./, 'Strength and Health', 'Strength is the damage this unit deals in combat; Health is how much it can take before it falls. Damage heals at the end of each turn.']);
  if (card.kind === 'building') terms.unshift([/./, 'Integrity', 'How much damage the building can take. Each building you lose also costs 1 Stability.']);
  return (
    <div className="inspector">
      <div className="insp-card"><CardFace cardId={cardId} civ={civ} cost={cost} size="full" /></div>
      <div className="insp-side">
        <HoloPreview cardId={cardId} />
        <div className="insp-meta">
          <span><Icon name={card.family} size={14} /> {FAMILY_LABEL[card.family]} deck · Age {ROMAN[card.age - 1]}</span>
          <span>{{ building: 'Building', development: 'Development', unit: 'Unit', fort: 'Fortification', tactic: 'Tactic', reaction: 'Reaction' }[card.kind]}</span>
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
