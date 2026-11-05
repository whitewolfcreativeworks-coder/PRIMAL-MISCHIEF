import { RULES } from '@pm/engine';
import { Icon } from './icons';

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide howto" onClick={(e) => e.stopPropagation()}>
        <h3 className="sheet-title">How to play</h3>
        <div className="howto-grid">
          <section>
            <h4><Icon name="stability" /> Win</h4>
            <p><b>Conquest:</b> bring your rival’s Stability from {RULES.startingStability} to 0. <b>Legacy:</b> reach {RULES.legacyTarget} Legacy from temples and monuments.</p>
          </section>
          <section>
            <h4><Icon name="goods" /> Your turn</h4>
            <p>You collect Goods ({RULES.baseGoods} + buildings), Food (farms minus army upkeep) and Legacy, then draw. Spend Goods to play cards, attack with ready units, then end your turn. Unspent Goods carry over.</p>
          </section>
          <section>
            <h4><Icon name="broken" /> Everything depends on something</h4>
            <p>Markets need Roads, Barracks need Farms, and so on. Lose the support and the building stops working (<Icon name="broken" size={12} />). Every building lost costs 1 Stability. <b>Unrest</b> (<Icon name="unrest" size={12} />) switches a building off for a while — and everything leaning on it.</p>
          </section>
          <section>
            <h4><Icon name="food" /> Feed the army</h4>
            <p>Units eat. If Food runs out you suffer famine: −2 Stability and your hungriest unit deserts. Granaries prevent this.</p>
          </section>
          <section>
            <h4><Icon name="str" /> Combat</h4>
            <p>Tap your glowing units, then the city or a building. The defender chooses blockers; both sides strike at once. Damage beyond the blockers hits Walls first, then the target. Units that attacked are <b>exhausted</b> and cannot block on your rival’s next turn.</p>
          </section>
          <section>
            <h4><Icon name="shadow" /> Reactions — the mischief</h4>
            <p>When attacked or targeted by a <b>Hostile</b> scheme, the defender may answer with one Reaction: ambush the attackers, retreat, turn the tide, foil the plot — or mirror it back on its caster. One response per threat; no endless chains.</p>
          </section>
          <section>
            <h4><Icon name="momentum" /> Chains & Momentum</h4>
            <p>Play a card of the same suit as your previous card to <b>chain</b> for +1 Momentum; some cards gain extra Chain bonuses. Successful attacks and reactions also earn Momentum. Spend it on your civilization’s Signature ability or on a Rally (draw a card). No timers — think as long as you like.</p>
          </section>
        </div>
        <div className="sheet-actions"><button className="btn primary big" onClick={onClose}>To the table</button></div>
      </div>
    </div>
  );
}
