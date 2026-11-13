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
| **Golden Age** | Complete Age V: 11 + 13 + 16 + 19 + 22 = 81 Progress in all. |
| **Conquest** | The rival’s Stability falls from 30 to 0. |
| Chronicle (fallback) | After 80 player-turns, most total Progress + Stability. |

In AI-vs-AI simulation (v0.8) about 64% of games end in a Golden Age and 36%
in conquest; matches last about 16 turns per player (32 player-turns). v0.8
lengthened games by about half (they were 21 player-turns) after play-testing
found them over too quickly for the back-and-forth to develop.

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
3. **Main**: play cards (pay Prosperity), hide cards as traps, send ready
   units across the river, invoke your Signature (3 Momentum, once per turn),
   end the turn.

Unsprung traps return to their decks at the very start of your turn, before
upkeep.

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

### Districts and fallout (v0.8)

Buildings that work together form **districts** that pay every turn while all
their pieces are working (see `packages/engine/src/districts.ts`):

| District | Pieces | Bonus |
|---|---|---|
| Breadbasket | 3 Farms | +1 Food per Farm |
| Crowded City | 3 fed Villages | +1 Progress |
| Stone City | 3 Quarries | +1 Prosperity per Quarry |
| Market Town | Market + Granary + Village | +1 Prosperity |
| Craft Quarter | Workshop + 2 Quarries | +1 Progress |
| Holy City | Temple + Palace | +1 Progress |
| Iron and Cattle (Kush) | Iron Furnaces + Quarry + Farm/Cattle | +1 Prosperity, +1 Progress |
| Red Sea Trade (Aksum) | Port of Adulis + Market + Farm/Fields | +2 Prosperity, +1 Progress |
| Purple Trade (Carthage) | Purple Dye Works + 2 Harbors | +2 Prosperity |
| Land Between the Rivers (Sumer) | Canals + 2 Farms + Village/Reed Houses | +1 Prosperity, +1 Progress |
| Mountain Harvest (Inca) | 2 Farms/Terraces + Storehouse + Road | +1 Progress |
| Trading Town (Norse) | Hedeby + Fishing/Farm + Village | +1 Prosperity, +1 Progress |

Why: play-testing found construction cards felt unconnected; a hand of Farms
had no plan beyond two of them. Districts give every grouping a goal, the card
sheet says when a card completes one or leaves you "one Farm away", and the
city ledger lists them all.

**Fallout.** Tapping any building shows what its fall would do: buildings that
stop working (a Farm feeds a Village that staffs a Market), districts and
settlements broken, and Prosperity/Progress lost every turn. When attacking a
building, key targets carry a count of what falls with them and the attack is
confirmed on a sheet showing the fallout. This makes the attacker's choice of
target, and the defender's choice of where to hide traps, a real decision.

### Tug of war (v0.8)

- **The people rally:** a player gains 1 Momentum whenever one of their
  buildings falls.
- **Rally:** a civilization 6 or more total Progress behind its rival gains
  +2 Prosperity at the start of each turn until it catches up.
- **The computer pauses:** after attacking, Easy and Normal usually spend
  their next turn building (a 4 / 2.5 point penalty on attacks in their
  evaluation), so the rival gets a window to strike back. Hard keeps pressing.

### Fair computer (v0.8)

The single-player computer now decides only from its own view (`viewFor`): it
cannot see your hand, either deck order, or your traps. Before v0.8 it was
handed the full state with only traps masked, so it could avoid attacking into
a reaction card in your hand. Normal also misjudges now and then (a small
random wobble in its evaluation); Easy more often; Hard plays it straight.

### The living city (v0.8)

Each bank's skyline is the civilization's city, in its own architecture. It
grows house by house as Progress fills the Age bar (and by an Age's worth of
houses at each new Age), and one house falls to smoking ruin for every 3
Stability lost. A soft swell marks growth and a tremor marks damage; both scale
with `--pace`.

### Call to Arms (v0.7)

When attacked, the defender may also rush **one unit card from hand** into the
fight: pay its cost, it deploys and blocks at once, then stays in the army.
It combines with a reaction if Prosperity covers both. Not usable against a
Hostile scheme.

Why: play-testing found the defender rarely had an answer. In 1,903 AI-vs-AI
attacks before this rule, the defender had no unit free to block 68% of the
time and no attack reaction in hand 56% of the time; 52% of attacks met no
defence at all (no blocker, reaction or trap). Unit cards were the most common
cards in hand but could only be played on your own turn. Call to Arms turns
them into answers and rewards keeping Prosperity back, without adding cards.

### Hidden traps (v0.5)

Any card in hand can be hidden face-down under one of your buildings or your
city, free, up to 3 per spot. The rival sees the total count, never the cards
or where they are (enforced by `viewFor`; events and log say nothing).

If the rival attacks that spot, or aims a Hostile tactic at it (a scheme
with no target counts as aiming at the city), before your next turn, every
card there springs and is spent. A reaction played from hand that cancels
the attack (Retreat, Treaty) comes first, and the traps then stay hidden.
What a sprung card does depends on its kind:

| Card kind | Springs as | Against an attack | Against a scheme |
|---|---|---|---|
| Unit | Garrison | Fights as an extra blocker for that one fight, then leaves | Catches the agents: foiled |
| Reaction | Itself, free | Its normal effect (stacks with one from hand) | Watch/Ambush foil; Mirror reflects |
| Fort | Wall | Soaks its Integrity in damage for that fight | Soaks damage |
| Tactic | Snare | 1 damage to every attacker before the clash | Catches the agents: foiled |
| Civilization card | Brace | Soaks Age + 1 damage | Soaks Age + 1 damage |

Unsprung traps return to their decks at the start of your next turn, so
hiding a card also cycles it out of your hand. The spot also gives +1
Momentum when its traps spring. This gives every card a second use and turns
target choice into a guessing game. **Probing** follows from the rules:
attack a spot with one cheap unit to spend its traps, then send the army.
The AI tucks the cards it cannot use soon, spreads them over likely targets,
never sees the rival's placement, and probes before committing its army.

### Food, people and work (v0.6)

`cityLedger(p)` in `engine.ts` is the single source for all of this (UI, AI and lessons read it):

- **Food:** the land makes 1; Farms make 2 (Carthage's Great Estates 3, Sumer's Reed Houses 1, Carthage's Trading Post 1). Irrigation Canals: +1 per Farm. Three working Farms (Breadbasket): +1 per Farm.
- **Who eats:** Villages (and Palaces, 2) eat first, in the order built; a Village with no Food is hungry and stands idle. Soldiers eat what is left (their `upkeep`, now in Food): strongest fed first, the rest desert. Prosperity no longer pays upkeep.
- **Spare Food** fills granaries (Granary 2, Qullqa 4) and the rest sells for +1 Prosperity each.
- **Workers:** 1 per Age from the city (+1 for Sumer's scribes), +1 per fed Village. Workplaces (`staff`: Quarry, Market, Workshop, Temple and the civ workplaces) need 1 each; the most expensive are staffed first; the rest stand idle.
- **Bonuses:** each complete settlement (working Farm + fed Village + staffed workplace) +1 Progress a turn. Three of a kind: Breadbasket (Farms, +1 Food each), Crowded City (Villages, +1 Progress), Stone City (Quarries, +1 Prosperity each).

### Roles and formations (v0.6)

| Role | Beats (+2 Strength) | Units |
|---|---|---|
| Spear | Riders, Skirmishers | Spearmen, Elite Guard, Grand Army, Iron Spearmen, Highland Spearmen, Phalanx, Mercenaries, Hosts |
| Rider | Archers, Shields | Numidian Horse, Battle Wagon, Elephants |
| Archer | Spears, Siege, Raiders | Archers, Bowmen, Slingers, Host of the Kandake |
| Shield | Archers | Militia, Shield Bearers |
| Skirmisher (Inca) | Archers, Siege | Mountain Warriors, Mace Bearers |
| Siege, Raider | — | Siege Ram (needs a Workshop), River Raiders, ships |

A unit gets +2 if any unit on the other side has a role it beats. Three or more different roles in one attack: +2 power. Three or more of one role: archers volley (1 damage to every enemy unit in the fight before the clash), spears form a hedgehog (+1 each while blocking), riders charge (+1 each while attacking).

## 9. Civilizations

| | Identity | Trait (always on) | Signature (3 Momentum) |
|---|---|---|---|
| **Kush** | Iron and the Bow | Ranged units +1 Strength while blocking | Rain of Arrows: 2 damage to every enemy unit |
| **Aksum** | Coin and Stone | Harbors +1 Prosperity | Red Sea Commerce: +2 Prosperity, +1 Progress per Market/Harbor |
| **Carthage** | Sea Lanes and Silver | Units cost 1 less | Close the Sea Lanes: rival −4 Prosperity −2 Progress, you +3 Prosperity |
| **Sumer** | Canal and Tablet | Scribes: see the top card of each deck when picking; +1 Worker | Rebuild the City: full repair, end Unrest, +3 Stability |
| **Norse** | Keel and Shield Wall | Longships: Raiders that get through carry off 1 Prosperity (Longship Raiders are Swift) | Summer Raid: rival −2 Progress, you +2 Prosperity |
| **Inca** | Road and Terrace | Storehouses: lose half Progress to raids and fallen buildings | Mountain Logistics: heal/ready units, draw one of each |

Each civilization has its own card in every Age of both decks (20 unique
cards) on top of a shared backbone, and its own five Age names (e.g. Kush:
Riverside Villages → Kerma → Napata → Meroë → Golden Age of Meroë). The full
list is in `packages/engine/src/cards/` and the in-game Codex.

The other 17 candidate civilizations from the brief remain the expansion list
(see `HISTORY_NOTES.md`). A new civilization needs a `CivDef` (palette, Age
names, trait, signature) and ten cards.

## 10. Balance

`npx tsx packages/engine/test/simulate-par.ts 8 normal` plays every ordered
pairing eight times with the normal AI. Latest (v0.8, six per pairing, 180
games), with the computer deciding from its own view only:

| Civ | Win rate |
|---|---|
| Kush | 53% |
| Aksum | 40% |
| Carthage | 50% |
| Sumer | 45% |
| Inca | 60% |
| Norse | 52% |

First player wins 51%; about 32 player-turns a game (was 21); Golden Age 116,
Conquest 64. v0.8 lifted Sumer from 29% to 45% (longer games favour its
builders). Aksum fell to 34% in longer races, so its Red Sea Trade trait now
also gives +1 Progress for every two working Harbors or Markets, and its
district +1 Progress (back to 40%). Carthage remains Aksum's hard counter
(blockades choke trade). **Open issue:** Aksum is still the weakest; Inca the
strongest. The `8 hard` run was not repeated for v0.8.

Tuning so far: the riverbank +1 for defenders (without it attacks snowballed
and 60% of games ended in conquest); Aksum’s trade trait narrowed to Harbors
and its Signature tied to its trade buildings; Inca’s storehouses and Signature
strengthened; Carthage’s mercenary upkeep reduced; the AI taught to use
Sumer’s scribes. AI-vs-AI is a proxy; human play will find other lines.

## 11. Guard rails

No infinite loops (effects are finite, response windows cannot nest, AI turns
are capped, hard turn limit). Hidden information: both draw piles and the
opponent’s hand are never sent to a client; the scribes’ peek is visible only
to its owner; hidden traps show only their count. Caps: Prosperity 20, Momentum 5, hand 9, 8 buildings, 6 units.
