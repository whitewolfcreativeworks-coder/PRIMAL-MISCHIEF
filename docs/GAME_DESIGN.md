# Primal Mischief — Game Design (v0.1)

> Build civilizations. Create combinations. Outsmart opponents. Tear down empires.

This document describes the rules as implemented in `packages/engine`. The
engine is the source of truth; if this file and the code disagree, the code
wins and this file should be fixed.

## 1. Design pillars

1. **Civilizations are systems, not health bars.** Buildings feed, house,
   arm and enrich each other. Taking the right piece out matters more than
   raw damage.
2. **Mischief is a philosophy.** Every strong line of play has an answer:
   sabotage, a reaction during the opponent's turn, or a reversal.
3. **Thinking beats tapping.** No timers or reflex windows in the rules.
   Momentum rewards *sequencing*, never physical speed.
4. **Readable reversals.** At most one response per threat. No stack, no
   infinite interruption chains.

## 2. Winning

| Path | Condition |
|---|---|
| **Conquest** | Opponent's Stability falls to 0 (starts at 20). |
| **Legacy** | Reach 20 Legacy (from temples, stelae, wonders). |
| **Chronicle** (fallback) | After 60 player-turns, highest Stability + Legacy wins. |

Stability is lost through attacks on the city, **every building destroyed
(−1)**, famine (−2) and reshuffling an empty deck (−1). So "strategic
collapse" is not a separate rule — it is what happens when an economy
fails: buildings fall, armies starve, and Stability bleeds out.

In AI-vs-AI simulation roughly two thirds of games end by Conquest and one
third by Legacy, so both paths are live.

## 3. Resources

| Resource | Source | Use / risk |
|---|---|---|
| **Goods** | 3 per turn + buildings (Quarry, Market, Port…) | Pay card costs. Carry over (cap 15), so saving for a reaction is a real choice. |
| **Food** | Farms, Terraces, Canals | Each unit has upkeep. Shortfall at turn start = **famine**. |
| **Legacy** | Temples, stelae, wonders | Victory track. |
| **Stability** | Starts at 20 | Your civilization's cohesion. 0 = collapse. |
| **Momentum** | Chains, damaging attacks, reactions, holding the line | Spend on your Signature (3) or Rally (2: draw a card). Cap 5. |

## 4. Turn structure

1. **Upkeep** — pay mercenary wages (or they desert); collect Goods, Food
   (production − upkeep) and Legacy; resolve famine; draw a card.
2. **Main** — in any order: play cards, attack, use Signature, Rally.
3. **End** — buildings in Unrest count down; temporary unit damage and
   buffs clear.

The first player skips their first draw; the second player starts with an
extra card and 1 Momentum. Simulated first-player win rate: ~46%.

## 5. Civilization construction and structural instability

Buildings provide **tags** and some **require** a tag from another working
building:

```
Farm ─┬─► Barracks (units +1 Health)
      ├─► Granary (famine protection)
      └─► Irrigation Canals (Sumer: every Farm +1 Food)
Road / Harbor ─► Market (+2 Goods) ─► Aksumite Mint
Quarry ─┬─► Workshop (buildings −1 cost; enables Battering Rams)
        └─► Iron Furnaces of Meroë (Kush: units +1 Strength)
```

Support is computed to a fixpoint, so losses **cascade**: burn a Road and
the Market stops; if the Mint depended on that Market, it stops too. A
building that is not working shows a broken-link badge and produces nothing.

**Unrest** (from Saboteurs, Blockade) switches a building off for a number
of its owner's turns without destroying it — the "temporary instability"
lever. Because it also removes the building's tags, a well-aimed Unrest can
knock out half a city for a turn.

**Famine** is the Jenga piece for armies: a big army needs farms. Spoil the
Stores (−4 Food) or knocking out a Farm can starve an opponent who
over-built their military.

## 6. Combat

1. The attacker chooses any ready units and a target: the **city** or one
   **building**.
2. A **response window** opens. The defender may assign blockers (any unit
   that has not attacked or blocked this turn) and may play **one
   Reaction**.
3. Resolution is simultaneous: blockers' strength is dealt to attackers
   (weakest first); attacking strength is dealt to blockers (weakest first).
4. Damage that gets past every blocker hits **Walls** first (if any), then
   the target.
5. If damage reaches the target, the attacker gains 1 Momentum (and
   Raiders steal 2 Goods each). If the defender blocked everything, the
   defender gains 1 Momentum.

**Exhaustion:** units that attacked cannot block until their owner's next
turn. This was added after simulation showed that free blocking made
attacking pointless; it creates the core attack-or-defend tension.

Keywords: **Ranged** (+1 Strength when blocking), **Siege** (+2 Strength
against buildings or walled cities), **Swift** (attack the turn it arrives),
**Raider** (steal Goods on a hit), **Wage** (pay Goods each turn or desert).

## 7. Counterplay — reactions

Reactions are cards played only in the response window. One per threat;
the attacker cannot respond to the response. That keeps reversals
understandable.

| Reaction | Answers | Effect |
|---|---|---|
| Shield Wall | Attack | Blockers +1/+1 this combat |
| Ambush | Attack | 2 damage to every attacker *before* combat |
| Feigned Retreat | Attack | Cancel the attack; attackers take 1 each |
| Turn the Tide | Attack | Blockers deal double; excess hits the **attacker's** city |
| Vigilant Watch | Hostile scheme | Cancel it |
| Mirror the Scheme | Hostile scheme | Cancel it and apply it **to its caster** (the "Reverse card") |

Information is part of the game: Goods carry over, so an opponent sitting
on 3 unspent Goods might be holding Turn the Tide. Spy Network reveals the
opponent's hand for a turn.

## 8. Chains and Momentum (the card-game inspirations)

- **Crazy Eights → Chains.** Play a card of the same suit as the card you
  played just before it: +1 Momentum. Several cards add a Chain bonus
  (Caravan: draw; Harvest Festival: +2 Stability; Gold Coinage: +1 Legacy).
- **Poker sets → collection.** The Great Stele gains Legacy for every other
  Star building; the Aksumite Mint for every other Silk building.
- **UNO Reverse → Mirror the Scheme / Turn the Tide.**
- **Go Fish → information.** Spy Network; open Goods counts.
- **Slapjack → response windows**, but untimed: anticipation, not reflexes.

Suits: Earth (food), Stone (construction), Bronze (military), Silk (trade),
Star (culture), Shadow (espionage).

## 9. Civilizations in v0.1

Five civilizations were chosen for distinct play, geographic range and
strong documented material culture (see `HISTORY_NOTES.md`):

| Civilization | Identity | Signature (3 Momentum) |
|---|---|---|
| **Kingdom of Kush** | Iron and the Bow — disciplined military economy, strong defence | *Land of the Bow*: 1 damage to every enemy unit; your units +1 Strength |
| **Kingdom of Aksum** | Coin and Stone — trade compounding into Legacy | *Red Sea Commerce*: +3 Goods, +2 Legacy, draw |
| **Carthage** | Sea Lanes and Silver — mercenaries, raids, blockades | *Close the Sea Lanes*: opponent −4 Goods, you +2 |
| **Sumer** | Canal and Tablet — resilient infrastructure and card flow | *Rebuild the City*: full repair, clear Unrest, +2 Stability |
| **Inca** | Road and Terrace — logistics, famine-proof, sturdy stone | *Mountain Logistics*: draw 2, +2 Food |

Three of the five are African civilizations, following the brief's
direction that Africa receive substantial representation. The full
candidate roster (Egypt, Kerma, Nok, Assyria, Hittites, Achaemenid Persia,
Phoenicia, Indus Valley, Han China, Khmer, Greece, Rome, Norse, Maya, Olmec,
Mississippian, Moche) remains the expansion list; each needs only a
`CivDef` and 5–6 card definitions.

### Why these five first

- **Distinct verbs:** Kush fights, Aksum trades, Carthage disrupts, Sumer
  endures, Inca moves. Each pairing plays differently.
- **Historical grounding:** each has well-attested, visually distinctive
  architecture (Meroitic pyramids, Aksumite stelae, the Carthaginian cothon,
  ziggurats, Inca terraces and roads) that suits procedural art.
- **Balance tractability:** five decks of 24 cards is a pool that can be
  simulated exhaustively (see below).

## 10. Balance

`npm run simulate -- 20 normal` plays every ordered pairing 20 times with
the normal AI. Latest runs:

| Civ | Normal AI (400 games) | Hard AI (160 games) |
|---|---|---|
| Kush | 60% | 50% |
| Aksum | 55% | 38% |
| Carthage | 48% | 69% |
| Sumer | 45% | 20% |
| Inca | 43% | 73% |

First player wins 45% (normal) / 43% (hard). Average length 23 player-turns
(≈11–12 each) with the normal AI.

**Open issue:** the hard AI (one-turn lookahead) favours the aggressive
decks — Inca and Carthage — and Sumer's slow, defensive plan underperforms.
That suggests stronger play rewards tempo more than the normal AI reveals.
Next balancing steps should come from human play-tests: likely levers are
Sumer's early defence (Walls of Uruk cost, Battle Wagon stats) and the
value of cheap Swift.

Tuning history: the first pass had Kush at 94% (furnace + double-attack
Kandake), Aksum at 25% (goods with no outlet). Fixes: exhaustion rule,
Legacy target 15→20, furnace now needs a Quarry, Kandake is a buff instead
of a second attack, Aksum's Signature and Gold Coinage convert trade into
Legacy, Chasqui Relay draws less; Inca's Signature no longer re-readies
the army, Slingers lost Swift and the Qhapaq Ñan costs 3.

AI-vs-AI balance is a proxy. Human play will find lines the heuristic AI
does not; treat these numbers as a floor for further testing.

## 11. Guard rails tested

- No infinite loops: every effect is finite; response windows cannot nest;
  AI turns are capped; matches have a hard turn limit.
- No unstoppable combinations found in simulation; every hostile scheme
  has two counters and every attack four.
- First-player advantage measured and compensated.
- Snowballing: Goods cap 15, Momentum cap 5, hand limit 9, at most 7
  buildings and 6 units.
