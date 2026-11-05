import {
  actingPlayer, applyAction, createGame, getCard, viewFor,
  type Action, type CivId, type GameEvent, type GameState, type PlayerId,
} from '@pm/engine';

/*
 * Guided lessons ("Academy"). A lesson is a scripted board plus a list of
 * steps. Each step either explains something (info, with a Next button) or
 * asks the player to make one specific move (do). Opponent moves are
 * scripted so every lesson plays out the same way. Every "do" step carries
 * a `solution`, used by the "Show me" button and by the lesson test.
 */

export type Highlight =
  | { kind: 'hand'; cardId: string }
  | { kind: 'unit'; cardId: string; owner: 'me' | 'opp' }
  | { kind: 'building'; cardId: string; owner: 'me' | 'opp' }
  | { kind: 'button'; name: 'endTurn' | 'signature' | 'attackCity' | 'respond' | 'rally' };

export interface Step {
  text: string;
  /** "do" steps: is this the move the lesson wants? */
  expect?: (a: Action, st: GameState) => boolean;
  /** The correct move for "do" steps (powers "Show me" and tests). */
  solution?: (st: GameState) => Action;
  hint?: string; // shown when the player tries something else
  highlight?: Highlight[];
  /** Runs when the step begins: scripted opponent moves or board tweaks. */
  onEnter?: (t: TutorApi) => void;
  /** How the scripted opponent answers the player's move if a response window opens. */
  oppResponse?: (st: GameState) => Action;
}

export interface Lesson {
  id: string;
  civ: CivId;
  opponent: CivId;
  title: string;
  summary: string;
  setup: (t: TutorApi) => void;
  steps: Step[];
}

/** Helpers lessons use to build the board and script the opponent. */
export interface TutorApi {
  readonly state: GameState;
  /** Directly edit the state (setup only — not visible as a move). */
  edit: (fn: (st: GameState) => void) => void;
  give: (pid: PlayerId, ...cardIds: string[]) => void;
  build: (pid: PlayerId, ...cardIds: string[]) => void;
  unit: (pid: PlayerId, cardId: string, ready?: boolean) => void;
  clearHand: (pid: PlayerId) => void;
  /** Apply a real move for the opponent (seat 1), with events and holograms. */
  opp: (a: Action) => void;
}

// ------------------------------------------------------------------ lookups used by lessons

export const handUid = (st: GameState, pid: PlayerId, cardId: string) => st.players[pid].hand.find((c) => c.cardId === cardId)?.uid ?? '';
export const unitUids = (st: GameState, pid: PlayerId, cardId?: string) => st.players[pid].units.filter((u) => !cardId || u.cardId === cardId).map((u) => u.uid);
export const buildingUid = (st: GameState, pid: PlayerId, cardId: string) => st.players[pid].buildings.find((b) => b.cardId === cardId)?.uid ?? '';
export const isPlay = (a: Action, st: GameState, cardId: string, targetCardId?: string, targetOwner: PlayerId = 1) =>
  a.type === 'play' && st.players[0].hand.find((c) => c.uid === a.uid)?.cardId === cardId &&
  (!targetCardId || st.players[targetOwner].buildings.find((b) => b.uid === a.targetUid)?.cardId === targetCardId);

// ------------------------------------------------------------------ runner (no React; testable)

export interface CoachState {
  lesson: Lesson;
  index: number;
  total: number;
  step: Step;
  mode: 'info' | 'do' | 'done' | 'wait';
}

export class TutorialRunner {
  state: GameState;
  index = 0;
  onEvents: (events: GameEvent[]) => void = () => {};
  onError: (msg: string) => void = () => {};
  /** Defers scripted moves until holograms finish (set by the UI). */
  whenIdle: (fn: () => void) => void = (fn) => fn();
  inSetup = true;
  waiting = false; // a scripted rival move is queued behind a hologram
  pendingEvents: GameEvent[] = [];

  constructor(public lesson: Lesson) {
    this.state = createGame(7, [{ name: 'You', civ: lesson.civ }, { name: 'Rival', civ: lesson.opponent }], 0).state;
    // Start from a clean board: lessons place exactly what they need.
    this.api.edit((st) => {
      for (const p of st.players) { p.hand = []; p.buildings = []; p.units = []; p.momentum = 0; p.stability = 20; p.legacy = 0; p.food = 6; }
      st.players[0].goods = 6; st.players[1].goods = 6;
    });
    lesson.setup(this.api);
    this.inSetup = false;
    this.enter(0);
  }

  readonly api: TutorApi = ((self: TutorialRunner) => ({
    get state() { return self.state; },
    edit: (fn: (st: GameState) => void) => { fn(self.state); },
    give: (pid: PlayerId, ...ids: string[]) => self.api.edit((st) => ids.forEach((id) => st.players[pid].hand.push({ uid: `L${++st.uidCounter}`, cardId: id }))),
    build: (pid: PlayerId, ...ids: string[]) => self.api.edit((st) => ids.forEach((id) => st.players[pid].buildings.push({ uid: `L${++st.uidCounter}`, cardId: id, damage: 0, bonusIntegrity: 0, unrest: 0 }))),
    unit: (pid: PlayerId, id: string, ready = true) => self.api.edit((st) => { st.players[pid].units.push({ uid: `L${++st.uidCounter}`, cardId: id, damage: 0, ready, attacked: false, blocked: false, buff: 0 }); }),
    clearHand: (pid: PlayerId) => self.api.edit((st) => { st.players[pid].hand = []; }),
    opp: (a: Action) => {
      const r = applyAction(self.state, 1, a);
      self.state = r.state;
      if (self.inSetup) return;
      self.pendingEvents.push(...r.events);
    },
  }))(this);


  get coach(): CoachState {
    const step = this.lesson.steps[this.index];
    const done = this.index >= this.lesson.steps.length - 1 && !step.expect;
    return { lesson: this.lesson, index: this.index, total: this.lesson.steps.length, step, mode: this.waiting ? 'wait' : done ? 'done' : step.expect ? 'do' : 'info' };
  }

  view() { return viewFor(this.state, 0); }

  private flush() {
    const ev = this.pendingEvents;
    this.pendingEvents = [];
    if (ev.length) this.onEvents(ev);
  }

  private enter(i: number) {
    this.index = i;
    const step = this.lesson.steps[i];
    if (step?.onEnter) {
      const run = () => { step.onEnter!(this.api); this.waiting = false; this.flush(); };
      if (this.inSetup || i === 0) run(); else { this.waiting = true; this.whenIdle(run); }
    }
  }

  next() {
    if (this.waiting || this.coach.mode !== 'info') return;
    this.enter(this.index + 1);
  }

  /** The player's move. Returns false (and reports why) when it isn't the move the lesson wants. */
  send(a: Action): boolean {
    if (this.waiting) { this.onError('Wait for your rival to finish.'); return false; }
    const step = this.lesson.steps[this.index];
    if (!step.expect) { this.onError(this.coach.mode === 'done' ? 'Lesson complete.' : 'Tap Next to continue the lesson.'); return false; }
    if (!step.expect(a, this.state)) { this.onError(step.hint ?? 'Follow the highlighted step for this lesson.'); return false; }
    let r;
    try { r = applyAction(this.state, 0, a); } catch (e) { this.onError((e as Error).message); return false; }
    this.state = r.state;
    this.pendingEvents.push(...r.events);
    if (actingPlayer(this.state) === 1 && this.state.phase === 'response') {
      const reply = step.oppResponse?.(this.state) ?? { type: 'respond', blockerUids: [] };
      const rr = applyAction(this.state, 1, reply);
      this.state = rr.state;
      this.pendingEvents.push(...rr.events);
    }
    this.flush();
    this.enter(this.index + 1);
    return true;
  }

  /** Perform the current step's solution ("Show me"). */
  solve() {
    if (this.waiting) return;
    const step = this.lesson.steps[this.index];
    if (step.solution) this.send(step.solution(this.state));
    else this.next();
  }
}

export const cardName = (id: string) => getCard(id).name;
