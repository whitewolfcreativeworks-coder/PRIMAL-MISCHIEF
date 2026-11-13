// Primal Mischief — core type model (v2: two decks, blind draft, five Ages).
// Everything in GameState is plain JSON so it can be cloned, hashed,
// sent over the network and replayed deterministically.

export type PlayerId = 0 | 1;
export type CivId = 'kush' | 'aksum' | 'carthage' | 'sumer' | 'inca' | 'norse';

/** The two decks every civilization brings. */
export type Family = 'civ' | 'mil';
export type Age = 1 | 2 | 3 | 4 | 5;

/**
 * civ family:  building (stays on your bank) · development (one-shot growth)
 * mil family:  unit · fort (defensive structure) · tactic (one-shot) · reaction (played on the rival's turn)
 */
export type CardKind = 'building' | 'development' | 'unit' | 'fort' | 'tactic' | 'reaction';

export type Resource = 'prosperity' | 'progress' | 'stability' | 'momentum';

/** Static abilities a working building or fort grants its owner. */
export type Passive =
  | 'wall' // absorbs damage that gets past your blockers
  | 'tower' // deals 1 damage to every attacker before combat
  | 'swift' // your units may attack the turn they are deployed
  | 'unitHp' // your units +1 health
  | 'unitStr' // your units +1 strength
  | 'blockStr' // your blocking units +1 strength
  | 'buildDiscount' // your Civilization cards cost 1 less (min 1)
  | 'farmBoost'; // each of your Farms produces +1 Prosperity

/** Battlefield role: who beats whom (see ROLE_BEATS in engine.ts). */
export type UnitRole = 'spear' | 'rider' | 'archer' | 'shield' | 'siege' | 'skirmisher' | 'raider';

export type UnitKeyword = 'ranged' | 'siege' | 'swift' | 'raider' | 'guard';

export type TargetSpec = 'none' | 'enemyBuilding' | 'ownBuilding';

/** A single declarative effect step. Card behaviour is data, not code. */
export type Effect =
  | { op: 'gain'; res: Resource; amount: number; who?: 'self' | 'opp'; perTag?: string }
  | { op: 'draw'; family?: Family; n: number; ifTag?: string; elseN?: number }
  | { op: 'damageBuilding'; amount: number } // chosen enemy target
  | { op: 'damageCity'; amount: number } // enemy city (Stability)
  | { op: 'unrest'; turns: number } // chosen enemy target
  | { op: 'unrestTag'; tag: string; turns: number } // every enemy building with a tag
  | { op: 'damageEnemyUnits'; amount: number }
  | { op: 'createUnit'; card: string; n: number }
  | { op: 'repair'; full?: boolean; amount?: number; clearUnrest?: boolean } // chosen own target
  | { op: 'repairAll'; amount?: number; full?: boolean; clearUnrest?: boolean }
  | { op: 'fortify'; amount: number } // chosen own target: +max integrity
  | { op: 'readyUnits'; heal?: boolean }
  | { op: 'buffUnits'; str: number } // until end of turn
  | { op: 'revealHand' };

export interface CardDef {
  id: string;
  name: string;
  family: Family;
  kind: CardKind;
  age: Age; // the Age whose deck tier this card belongs to
  cost: number; // Prosperity
  civ?: CivId; // undefined = shared card
  text: string;
  flavor?: string;
  art: string;
  rarity?: 'common' | 'rare' | 'wonder';
  token?: boolean;
  // civilization cards
  progress?: number; // Progress gained when played
  income?: number; // Prosperity each turn while working
  growth?: number; // Progress each turn while working
  // the city's people and food (see cityLedger in engine.ts)
  food?: number; // Food made each turn while working
  eats?: number; // Food this building needs to work (Villages eat first)
  workers?: number; // Workers this building provides while fed
  staff?: number; // Workers this building needs to work
  store?: number; // Food it can keep from one turn to the next
  // buildings and forts
  integrity?: number;
  tags?: string[];
  requires?: string[]; // needs ANY of these tags from another working building
  passives?: Passive[];
  // units
  str?: number;
  hp?: number;
  upkeep?: number; // Food each turn, or the unit deserts
  role?: UnitRole;
  keywords?: UnitKeyword[];
  requiresToDeploy?: string;
  // developments, tactics, reactions
  target?: TargetSpec;
  hostile?: boolean; // opens a response window for the rival
  effects?: Effect[];
  reaction?: ReactionKind;
}

export type ReactionKind =
  | 'shieldWall' // blockers +1 str +1 hp this combat
  | 'feignedRetreat' // cancel the attack; attackers take 1 damage each
  | 'turnTheTide' // blockers deal double; excess hits the attacker's city
  | 'ambush' // 2 damage to every attacker before combat
  | 'treaty' // cancel the attack; the attacker gains 3 Prosperity
  | 'vigilantWatch' // cancel a hostile tactic
  | 'mirror'; // cancel a hostile tactic and turn it on its caster

export type TraitKind = 'bowmen' | 'trade' | 'hiredSwords' | 'scribes' | 'storehouses' | 'longships';

export interface CivDef {
  id: CivId;
  name: string;
  region: string;
  era: string;
  epithet: string;
  summary: string;
  history: string;
  palette: { primary: string; secondary: string; accent: string; ink: string };
  ages: [string, string, string, string, string]; // names of the five Ages
  trait: { kind: TraitKind; name: string; text: string };
  signature: { name: string; cost: number; text: string; effects: Effect[] };
  /** Card ids per Age tier, per deck (duplicates = copies). */
  decks: Record<Family, [string[], string[], string[], string[], string[]]>;
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
  unrest: number;
}

export interface UnitInst {
  uid: string;
  cardId: string;
  damage: number;
  ready: boolean;
  attacked: boolean;
  blocked: boolean;
  buff: number;
}

/**
 * A card tucked face-down under one of your buildings (or your city) as a
 * hidden trap. It guards through the rival's next turn: if that spot is
 * attacked or targeted, every card under it springs and is spent; if not,
 * the cards shuffle back into their decks at the start of your turn.
 * The rival sees how many you tucked, never which cards or where.
 */
export interface TrapInst {
  uid: string;
  cardId: string;
  /** A building uid, or 'city'. */
  at: string;
}

/** What a sprung trap card does, from its kind. */
export type TrapRole = 'garrison' | 'reaction' | 'wall' | 'snare' | 'brace';

export interface PlayerState {
  id: PlayerId;
  name: string;
  civ: CivId;
  age: Age;
  progress: number; // toward the next Age (or the Golden Age at Age V)
  prosperity: number;
  stability: number;
  momentum: number;
  piles: Record<Family, CardInst[]>; // face-down draw piles
  discards: Record<Family, CardInst[]>;
  hand: CardInst[];
  buildings: BuildingInst[]; // includes forts
  units: UnitInst[];
  signatureUsed: boolean;
  handRevealedTo: boolean;
  /** Sumer's scribes: top card of each pile, visible to the owner while drafting. */
  peek: Record<Family, string | null> | null;
  /** Hidden traps (owner sees all; the rival sees only how many). */
  traps: TrapInst[];
  /** Food kept in granaries from last turn. */
  stored: number;
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

export type Phase = 'draft' | 'main' | 'response' | 'over';

export interface GameState {
  version: 2;
  seed: number;
  rng: number;
  turn: number;
  active: PlayerId;
  phase: Phase;
  pending: Pending | null;
  players: [PlayerState, PlayerState];
  winner: PlayerId | null;
  winReason: string | null;
  uidCounter: number;
  log: LogEntry[];
  /** Spots ('city' or building uid) the active player has already attacked or targeted this turn (public). */
  struck: string[];
}

export interface LogEntry {
  turn: number;
  player: PlayerId | null;
  text: string;
}

// ---------------------------------------------------------------- actions

export type Action =
  | { type: 'draft'; civ: number; mil: number; discard?: string[] }
  | { type: 'play'; uid: string; targetUid?: string }
  | { type: 'attack'; unitUids: string[]; target: AttackTarget }
  | { type: 'signature'; targetUid?: string }
  | { type: 'respond'; reactionUid?: string; blockerUids: string[]; /** Call to Arms: a unit card from hand joins the fight as a blocker. */ musterUid?: string }
  | { type: 'tuck'; uid: string; at: string }
  | { type: 'endTurn' }
  | { type: 'concede' };

/** How an attacking unit fell: tower arrows, an ambush, a feigned retreat, or the melee itself. */
export type UnitFate = 'tower' | 'ambush' | 'retreat' | 'trap' | 'volley' | 'melee';

/** How roles and formations shaped a fight (for the UI and holograms). */
export interface CombatTactics {
  attackerMatch: number; // attacking units that faced a role they beat
  blockerMatch: number;
  mixed: boolean; // three or more roles attacked together
  attackerMassed: UnitRole | null;
  blockerMassed: UnitRole | null;
  volley: { attacker: number; blocker: number }; // units hit by massed archers before the clash
}

/** The trap cards that sprang in a fight or against a scheme, and what each did. */
export interface TrapReport {
  cards: string[];
  roles: TrapRole[];
  /** Total damage soaked by braces and trap walls. */
  absorbed: number;
  /** Damage dealt to each attacker by snares. */
  snare: number;
}

/** Presentation events emitted by the engine so clients can animate what happened. */
export type GameEvent =
  | { type: 'turnStart'; player: PlayerId; turn: number }
  | { type: 'income'; player: PlayerId; prosperity: number; growth: number; upkeep: number; food: number; foodSold: number; hungry: number }
  | { type: 'drafted'; player: PlayerId; civ: number; mil: number; discarded: number }
  | { type: 'cardPlayed'; player: PlayerId; cardId: string }
  | { type: 'grow'; player: PlayerId; cardId: string; progress: number }
  | { type: 'ageUp'; player: PlayerId; age: Age; name: string }
  | { type: 'buildingRaised'; player: PlayerId; uid: string; cardId: string }
  | { type: 'buildingDamaged'; player: PlayerId; uid: string; amount: number }
  | { type: 'buildingDestroyed'; player: PlayerId; uid: string; cardId: string; progressLost: number }
  | { type: 'buildingUnrest'; player: PlayerId; uid: string }
  | { type: 'supportLost'; player: PlayerId; uid: string }
  | { type: 'unitDeployed'; player: PlayerId; uid: string; cardId: string }
  | { type: 'unitDestroyed'; player: PlayerId; uid: string; cardId: string }
  | { type: 'unitDeserted'; player: PlayerId; uid: string; cardId: string }
  | { type: 'attackDeclared'; player: PlayerId; unitUids: string[]; target: AttackTarget }
  | { type: 'reaction'; player: PlayerId; cardId: string; reaction: ReactionKind }
  /** A civilization far behind in Progress rallies for extra Prosperity this turn. */
  | { type: 'rally'; player: PlayerId; prosperity: number; gap: number }
  | { type: 'reversed'; player: PlayerId; cardId: string }
  | {
      type: 'combat'; attacker: PlayerId; power: number; blocked: number; wallAbsorbed: number; dealt: number;
      attackerCards: string[]; blockerCards: string[]; attackersLost: number; blockersLost: number;
      /** Per attacker (same order as attackerCards): null = survived, else what killed it. */
      attackerFates: (UnitFate | null)[];
      /** Per blocker (same order as blockerCards): true = fell. */
      blockerFates: boolean[];
      target: string; wallCard: string | null; reaction: ReactionKind | null; cancelled: boolean; tideBack: number;
      targetDestroyed: boolean; towerHits: number; progressRaided: number;
      /** Hidden traps that sprang at the target (null = none). Garrison troops are listed in blockerCards with blockerFromTrap. */
      trap: TrapReport | null;
      blockerFromTrap: boolean[];
      /** Call to Arms: the unit card the defender rushed from hand into this fight (it is also among blockerCards). */
      mustered?: string | null;
      /** Every reaction in force, from the hand and from traps (reaction is the first). */
      reactions: ReactionKind[];
      /** Roles and formations (null when the attack was called off). */
      tactics: CombatTactics | null;
    }
  | { type: 'scheme'; caster: PlayerId; cardId: string; targetCardId: string | null; outcome: 'hit' | 'foiled' | 'mirrored'; mirrorTargetCardId: string | null; trap: TrapReport | null }
  | { type: 'tucked'; player: PlayerId; total: number }
  | { type: 'trapSprung'; player: PlayerId; at: string; cards: string[] }
  | { type: 'trapsReturned'; player: PlayerId; n: number }
  | { type: 'tactic'; player: PlayerId; cardId: string } // non-hostile military card (buffs, draws)
  | { type: 'cityDamaged'; player: PlayerId; amount: number }
  | { type: 'resource'; player: PlayerId; res: Resource; delta: number }
  | { type: 'signature'; player: PlayerId; name: string }
  | { type: 'gameOver'; winner: PlayerId; reason: string };

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

export class RuleError extends Error {}
