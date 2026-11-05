// Primal Mischief — core type model.
// Everything in GameState is plain JSON so it can be cloned, hashed,
// sent over the network and replayed deterministically.

export type PlayerId = 0 | 1;
export type CivId = 'kush' | 'aksum' | 'carthage' | 'sumer' | 'inca';

/** Card suits. Matching suits drive Chains and Momentum (see GAME_DESIGN.md). */
export type Suit = 'earth' | 'stone' | 'bronze' | 'silk' | 'star' | 'shadow';

export type CardKind = 'building' | 'unit' | 'action' | 'reaction';

export type Resource = 'goods' | 'food' | 'stability' | 'legacy' | 'momentum';

/** Static abilities a supported building grants its owner. */
export type Passive =
  | 'wall' // absorbs overflow damage from attacks before the target is hit
  | 'swift' // your units may attack the turn they are recruited
  | 'unitHp' // your units +1 health
  | 'unitStr' // your units +1 strength
  | 'blockStr' // your blocking units +1 strength
  | 'buildDiscount' // your building cards cost 1 less (min 1)
  | 'famineShield' // famine does not cost stability or units
  | 'scribes' // draw an extra card at turn start while your hand is below 5
  | 'mint' // +1 goods at turn start for each other supported Silk building
  | 'irrigation'; // each of your Farms produces +1 food

export type UnitKeyword = 'ranged' | 'siege' | 'swift' | 'raider';

export type TargetSpec = 'none' | 'enemyBuilding' | 'ownBuilding';

/** A single declarative effect step. Card behaviour is data, not code. */
export type Effect =
  | { op: 'gain'; res: Resource; amount: number; who?: 'self' | 'opp'; per?: PerCount }
  | { op: 'draw'; n: number; ifTag?: string; elseN?: number }
  | { op: 'damageBuilding'; amount: number } // uses chosen target
  | { op: 'unrest'; turns: number } // uses chosen target
  | { op: 'unrestSuit'; suit: Suit; turns: number } // all opponent buildings of a suit
  | { op: 'damageEnemyUnits'; amount: number }
  | { op: 'createUnit'; card: string; n: number }
  | { op: 'repair'; full?: boolean; amount?: number; clearUnrest?: boolean } // chosen own target
  | { op: 'repairAll'; amount?: number; full?: boolean; clearUnrest?: boolean }
  | { op: 'fortify'; amount: number } // chosen own target: +max integrity
  | { op: 'readyUnits'; heal?: boolean }
  | { op: 'buffUnits'; str: number } // until end of turn
  | { op: 'revealHand' };

export type PerCount =
  | { kind: 'suitBuildings'; suit: Suit }
  | { kind: 'tag'; tag: string };

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  suit: Suit;
  cost: number;
  civ?: CivId; // undefined = common card any civ may use
  text: string; // rules text shown on the card
  flavor?: string; // short historical note
  art: string; // art motif key
  rarity?: 'common' | 'rare' | 'wonder';
  maxCopies?: number;
  token?: boolean; // created by effects, never in decks
  // buildings
  integrity?: number;
  goods?: number;
  food?: number;
  legacy?: number;
  legacyPerSuit?: Suit; // +1 legacy per OTHER supported building of this suit
  tags?: string[];
  requires?: string[]; // needs ANY one of these tags from another supported building
  passives?: Passive[];
  // units
  str?: number;
  hp?: number;
  upkeep?: number; // food per turn
  wage?: number; // goods per turn, or the unit deserts
  keywords?: UnitKeyword[];
  requiresToRecruit?: string; // tag you must control to play this unit
  // actions / reactions
  target?: TargetSpec;
  hostile?: boolean; // opens a response window for the opponent
  effects?: Effect[];
  chain?: { suit: Suit; effects: Effect[]; text: string };
  reaction?: ReactionKind;
}

export type ReactionKind =
  | 'shieldWall' // blockers +1 str +1 hp this combat
  | 'feignedRetreat' // cancel the attack; attackers take 1 damage each
  | 'turnTheTide' // blockers deal double; excess hits attacker's city
  | 'ambush' // 2 damage to every attacker before combat
  | 'vigilantWatch' // cancel a hostile action
  | 'mirror'; // cancel a hostile action and turn it on its caster

export interface CivDef {
  id: CivId;
  name: string;
  region: string;
  era: string;
  epithet: string;
  summary: string;
  history: string; // short, careful historical grounding
  palette: { primary: string; secondary: string; accent: string; ink: string };
  signature: { name: string; cost: number; text: string; effects: Effect[] };
  starterDeck: string[]; // card ids (24)
}

// ---------------------------------------------------------------- state

export interface CardInst {
  uid: string;
  cardId: string;
}

export interface BuildingInst {
  uid: string;
  cardId: string;
  damage: number;
  bonusIntegrity: number;
  unrest: number; // turns remaining (counts down at owner's turn start)
}

export interface UnitInst {
  uid: string;
  cardId: string;
  damage: number;
  ready: boolean; // can attack this turn
  attacked: boolean;
  blocked: boolean; // has blocked during the current opponent turn
  buff: number; // temporary strength until end of turn
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  civ: CivId;
  stability: number;
  legacy: number;
  goods: number;
  food: number;
  momentum: number;
  deck: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  buildings: BuildingInst[];
  units: UnitInst[];
  signatureUsed: boolean; // once per turn
  lastSuit: Suit | null; // suit of the last card played this turn (chains)
  handRevealedTo: boolean; // opponent may see this hand until end of turn
}

export type AttackTarget = { kind: 'city' } | { kind: 'building'; uid: string };

export interface PendingAttack {
  kind: 'attack';
  attacker: PlayerId;
  unitUids: string[];
  target: AttackTarget;
}

export interface PendingAction {
  kind: 'action';
  caster: PlayerId;
  card: CardInst;
  targetUid?: string;
}

export type Pending = PendingAttack | PendingAction;

export type Phase = 'main' | 'response' | 'over';

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  turn: number; // increments every player-turn, starting at 1
  active: PlayerId;
  phase: Phase;
  pending: Pending | null;
  players: [PlayerState, PlayerState];
  winner: PlayerId | null;
  winReason: string | null;
  uidCounter: number;
  log: LogEntry[];
}

export interface LogEntry {
  turn: number;
  player: PlayerId | null;
  text: string;
}

// ---------------------------------------------------------------- actions

export type Action =
  | { type: 'play'; uid: string; targetUid?: string }
  | { type: 'attack'; unitUids: string[]; target: AttackTarget }
  | { type: 'signature'; targetUid?: string }
  | { type: 'rally' } // spend 2 momentum: draw a card
  | { type: 'respond'; reactionUid?: string; blockerUids: string[] }
  | { type: 'endTurn' }
  | { type: 'concede' };

/** Presentation events emitted by the engine so clients can animate what happened. */
export type GameEvent =
  | { type: 'turnStart'; player: PlayerId; turn: number }
  | { type: 'income'; player: PlayerId; goods: number; food: number; legacy: number }
  | { type: 'famine'; player: PlayerId }
  | { type: 'draw'; player: PlayerId; n: number }
  | { type: 'cardPlayed'; player: PlayerId; cardId: string }
  | { type: 'chain'; player: PlayerId; suit: Suit }
  | { type: 'buildingRaised'; player: PlayerId; uid: string; cardId: string }
  | { type: 'buildingDamaged'; player: PlayerId; uid: string; amount: number }
  | { type: 'buildingDestroyed'; player: PlayerId; uid: string; cardId: string }
  | { type: 'buildingUnrest'; player: PlayerId; uid: string }
  | { type: 'supportLost'; player: PlayerId; uid: string }
  | { type: 'unitRecruited'; player: PlayerId; uid: string; cardId: string }
  | { type: 'unitDestroyed'; player: PlayerId; uid: string; cardId: string }
  | { type: 'unitDeserted'; player: PlayerId; uid: string; cardId: string }
  | { type: 'attackDeclared'; player: PlayerId; unitUids: string[]; target: AttackTarget }
  | { type: 'reaction'; player: PlayerId; cardId: string; reaction: ReactionKind }
  | { type: 'reversed'; player: PlayerId; cardId: string }
  | {
      type: 'combat'; attacker: PlayerId; power: number; blocked: number; wallAbsorbed: number; dealt: number;
      // Detail for presentation (hologram battle scenes):
      attackerCards: string[]; blockerCards: string[]; attackersLost: number; blockersLost: number;
      target: string; // 'city' or the target building's card id
      wallCard: string | null; reaction: ReactionKind | null; cancelled: boolean; tideBack: number; targetDestroyed: boolean;
    }
  | { type: 'scheme'; caster: PlayerId; cardId: string; targetCardId: string | null; outcome: 'hit' | 'foiled' | 'mirrored'; mirrorTargetCardId: string | null }
  | { type: 'cityDamaged'; player: PlayerId; amount: number }
  | { type: 'resource'; player: PlayerId; res: Resource; delta: number }
  | { type: 'signature'; player: PlayerId; name: string }
  | { type: 'gameOver'; winner: PlayerId; reason: string };

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

export class RuleError extends Error {}
