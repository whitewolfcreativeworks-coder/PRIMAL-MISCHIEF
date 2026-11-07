import { RULES } from '@pm/engine';
import { Icon } from './icons';

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const golden = RULES.progressToAdvance.reduce((a, b) => a + b, 0);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide howto" onClick={(e) => e.stopPropagation()}>
        <h3 className="sheet-title">Two civilizations, one river</h3>
        <div className="howto-grid">
          <section>
            <h4><Icon name="river" /> The river</h4>
            <p>You build on your bank, your rival on theirs. Each of you is racing to grow, and each of you threatens the other across the water.</p>
          </section>
          <section>
            <h4><Icon name="progress" /> Win</h4>
            <p><b>Golden Age:</b> grow through all five Ages and complete the fifth ({golden} Progress in all). <b>Conquest:</b> bring your rival’s Stability from {RULES.startingStability} to 0.</p>
          </section>
          <section>
            <h4><Icon name="civ" /> Two decks, one choice</h4>
            <p>Every turn you refill your hand to {RULES.handSize} cards, choosing blind how many come from your <b>Civilization</b> deck (growth) and how many from your <b>Military</b> deck (armies, forts, tactics, reactions). You may discard cards first. Lean one way and you grow fast but stand exposed; lean the other and you are safe but stand still.</p>
          </section>
          <section>
            <h4><Icon name="growth" /> Growing through the Ages</h4>
            <p>Civilization cards give Progress when you play them, and some buildings add Progress every turn. Fill the bar and your civilization enters its next Age: stronger cards join both of your decks and the oldest retire.</p>
          </section>
          <section>
            <h4><Icon name="prosperity" /> Prosperity</h4>
            <p>Every turn your civilization earns Prosperity, which pays for everything you play. Spare Food sells for more.</p>
          </section>
          <section>
            <h4><Icon name="food" /> Food, people and work</h4>
            <p>Farms make Food (your land makes 1). Villages eat first and give a Worker and Progress; workplaces (Quarries, Markets, Temples…) need a Worker each. Your soldiers eat what is left: hungry soldiers desert, weakest first. A working Farm, a fed Village and a staffed workplace make a settlement (+1 Progress a turn); three of the same building is a specialty. Tap the Food chip on your bar for the city ledger.</p>
          </section>
          <section>
            <h4><Icon name="role_spear" /> Who beats whom</h4>
            <p>Every soldier has a role. Spears beat riders, riders beat archers and shields, archers beat spears, shields blunt arrows; the Inca’s skirmishers take the riders’ place. A soldier facing a role it beats fights with +2. Three different roles attacking together get +2; three of one role form a massed formation: archers volley, spears form a hedgehog, riders charge.</p>
          </section>
          <section>
            <h4><Icon name="str" /> Crossing the river</h4>
            <p>Tap your glowing units, then the rival’s city or one of their buildings. Units must wait a turn after deploying unless they are Swift or you have a Road. Defenders fight with +1 Strength on their own bank. Damage that gets through hits walls first, then the target. A fallen building costs its owner Stability and Progress.</p>
          </section>
          <section>
            <h4><Icon name="shadow" /> Reactions: the mischief</h4>
            <p>When attacked or targeted by a Hostile card, the defender may play one Reaction: ambush the crossing, retreat, turn the tide, offer a treaty, foil the plot, or mirror it back on its caster. One response per threat.</p>
          </section>
          <section>
            <h4><Icon name="trap" /> Hidden traps</h4>
            <p>On your turn, tap a card you don’t need and <b>Hide as a trap</b> under one of your buildings or your city (up to {RULES.trapsPerSpot} in one place). Your rival sees how many you hid, never what or where. If they attack or scheme against that spot before your next turn, every card there springs: soldiers burst out to fight, reactions fire for free, forts stand as walls, tactics snare the attackers, and Civilization cards brace the spot. Unsprung traps return to your deck. A wise attacker sends a cheap unit first to test the ground.</p>
          </section>
          <section>
            <h4><Icon name="momentum" /> Momentum</h4>
            <p>Winning a fight, holding the bank, playing a reaction and entering a new Age earn Momentum. Spend 3 on your civilization’s Signature ability. No timers: think as long as you like.</p>
          </section>
        </div>
        <div className="sheet-actions"><button className="btn primary big" onClick={onClose}>To the river</button></div>
      </div>
    </div>
  );
}
