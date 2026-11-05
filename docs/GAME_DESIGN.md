# Primal Mischief — Game Design (v0.3, “the river”)

> Two civilizations face each other across a river. Each is racing to grow,
> and each threatens the other’s prosperity. Every turn you choose: grow, or
> guard and strike.

The rules engine (`packages/engine`) is the source of truth. If this file and
the code disagree, the code wins and this file should be fixed.

## 1. Pillars

1. **Build or fight, every turn.** The blind pick forces the central choice:
   growth cards or military cards. Each choice has an advantage and a cost.
2. **Civilizations evolve.** Five Ages. Each Age makes both of your decks
   stronger and visibly transforms your city on its riverbank.
3. **Mischief.** Every strong move has an answer: blockers, walls, towers, and
   one reaction per threat (ambush, retreat, turn the tide, treaty, foil, mirror).
4. **Thinking beats tapping.** No timers or reflex windows.

## 2. Winning

| Path | Condition |
|---|---|
| **Golden Age** | Complete Age V: 8 + 10 + 12 + 14 + 16 = 60 Progress in all. |
| **Conquest** | The rival’s Stability falls from 22 to 0. |
| Chronicle (fallback) | After 80 player-turns, most total Progress + Stability. |

In AI-vs-AI simulation about 58% of games end in a Golden Age and 42% in
conquest; matches last about 14–15 turns per player.

## 3. The two decks and the blind pick

Every civilization brings a **Civilization deck** (growth) and a **Military
deck** (units, forts, tactics, reactions). Both are built in five Age tiers.

At the start of each turn, after income, you **refill your hand to 6**,
choosing how many cards come from each deck: all of one, all of the other, or
any mix. Picks are face down; you only know which deck a card comes from. You
may discard cards first. Sumer’s scribes see the top card of each deck before
choosing.

The decks start with only Age I cards. **Entering a new Age shuffles that
Age’s cards into both decks and retires cards two Ages old**, so your options
genuinely improve as your civilization grows.

## 4. Turn structure

1. **Upkeep**: gain Prosperity (base 3/4/5/6/7 by Age, plus buildings), gain
   Progress from growth buildings, pay army upkeep strongest-first. Units you
   cannot pay desert.
2. **Pick**: refill to 6 (see above).
3. **Main**: play cards (pay Prosperity), send ready units across the river,
   invoke your Signature (3 Momentum, once per turn), end the turn.

The second player starts with +1 Prosperity and +1 Momentum.

## 5. Resources

| | Source | Use |
|---|---|---|
| **Prosperity** | Income each turn; Markets, Harbors, Farms | Pay for cards; pay army upkeep. Cap 20. |
| **Progress** | Civilization cards (on play) and growth buildings (each turn) | Fills the Age bar. Lost to raids and fallen buildings. Never drops you back an Age. |
| **Stability** | Starts at 22 | Your city’s cohesion. 0 = conquest. |
| **Momentum** | Winning a fight, holding the bank, playing a reaction (+1); a new Age (+2) | Signature abilities. Cap 5. |

The core tension: **soldiers are paid from the same Prosperity that pays for
growth.** A big army slows your civilization down.

## 6. Building and its fragility

Buildings stay on your bank and give Progress when built; many add Prosperity
or Progress every turn. Some depend on others (Market ← Road or Harbor,
Granary ← Farm, Workshop ← Quarry, Iron Furnaces ← Quarry). Support is
computed to a fixpoint, so losses cascade. **Unrest** (Saboteurs, Blockade)
switches a building off for a few turns, together with everything leaning on
it. **A fallen building costs its owner 1 Stability and Progress equal to its
Age.**

## 7. Crossing the river

1. Units deploy to your bank and can attack from your next turn (Swift units,
   or any unit while you have a Road or The Cothon, can attack at once).
2. The attacker picks a target: **the city** (Stability, toward conquest) or a
   **building** (dismantle the rival’s engine and cost them Progress).
3. The defender chooses blockers and may play one reaction. **Blockers fight
   with +1 Strength on their own bank.** Towers hit every attacker for 1 first.
4. Simultaneous clash; damage past the blockers hits walls, then the target.
5. A breakthrough earns the attacker 1 Momentum; Raiders also steal 2
   Progress each. Holding the bank earns the defender 1 Momentum.

Units that attacked are exhausted and cannot block on the rival’s next turn.

## 8. Reactions

| Reaction | Answers | Effect |
|---|---|---|
| Shield Wall | Attack | Blockers +1/+1 this combat |
| Ambush | Attack | 2 damage to every attacker before combat |
| Feigned Retreat | Attack | Cancel; each attacker takes 1 damage |
| Turn the Tide | Attack | Blockers deal double; excess hits the attacker’s city |
| Treaty of Kings (Aksum) | Attack | Cancel; the attacker gains 3 Prosperity |
| Vigilant Watch | Hostile tactic | Cancel it |
| Mirror the Scheme | Hostile tactic | Cancel it and turn it on its caster |

## 9. Civilizations

| | Identity | Trait (always on) | Signature (3 Momentum) |
|---|---|---|---|
| **Kush** | Iron and the Bow | Ranged units +1 Strength | Rain of Arrows: 2 damage to every enemy unit |
| **Aksum** | Coin and Stone | Harbors +1 Prosperity | Red Sea Commerce: +2 Prosperity, +1 Progress per Market/Harbor |
| **Carthage** | Sea Lanes and Silver | Units cost 1 less | Close the Sea Lanes: rival −4 Prosperity −2 Progress, you +3 Prosperity |
| **Sumer** | Canal and Tablet | Scribes: see the top card of each deck when picking | Rebuild the City: full repair, end Unrest, +3 Stability |
| **Inca** | Road and Terrace | Storehouses: lose half Progress to raids and fallen buildings | Mountain Logistics: heal/ready units, +3 Prosperity, draw one of each |

Each civilization has its own card in every Age of both decks (20 unique
cards) on top of a shared backbone, and its own five Age names (e.g. Kush:
Riverside Villages → Kerma → Napata → Meroë → Golden Age of Meroë). The full
list is in `packages/engine/src/cards/` and the in-game Codex.

The other 17 candidate civilizations from the brief remain the expansion list
(see `HISTORY_NOTES.md`). A new civilization needs a `CivDef` (palette, Age
names, trait, signature) and ten cards.

## 10. Balance

`npx tsx packages/engine/test/simulate-par.ts 10 normal` plays every ordered
pairing ten times with the normal AI. Latest (200 games):

| Civ | Win rate |
|---|---|
| Kush | 55% |
| Aksum | 46% |
| Carthage | 58% |
| Sumer | 48% |
| Inca | 44% |

First player wins 56% (±7% at this sample size). Known outlier: Carthage’s
cheap mercenaries beat Sumer about 80% of the time in AI play.

Tuning so far: the riverbank +1 for defenders (without it attacks snowballed
and 60% of games ended in conquest); Aksum’s trade trait narrowed to Harbors
and its Signature tied to its trade buildings; Inca’s storehouses and Signature
strengthened; Carthage’s mercenary upkeep reduced; the AI taught to use
Sumer’s scribes. AI-vs-AI is a proxy; human play will find other lines.

## 11. Guard rails

No infinite loops (effects are finite, response windows cannot nest, AI turns
are capped, hard turn limit). Hidden information: both draw piles and the
opponent’s hand are never sent to a client; the scribes’ peek is visible only
to its owner. Caps: Prosperity 20, Momentum 5, hand 9, 8 buildings, 6 units.
