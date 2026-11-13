import { getCard } from './data';
import type { BuildingInst, CivId } from './types';

/*
 * Districts: named combinations of working buildings that pay a bonus every
 * turn. They are the reason a hand full of Farms or Villages is a plan, and
 * the reason an attacker picks one building over another: knock out one
 * piece and the whole district stops paying.
 */

/** One piece of a district: a building with this tag (or exactly this card), `n` times. */
export interface DistrictPart { tag?: string; card?: string; n: number; label: string; /** Singular, for "one Farm away". */ one: string }

export interface DistrictDef {
  id: string;
  name: string;
  /** Only this civilization can complete it (undefined = everyone). */
  civ?: CivId;
  parts: DistrictPart[];
  /** Bonus every turn while complete. Kind 'legacy' bonuses are applied by the city ledger itself. */
  prosperity?: number;
  progress?: number;
  legacy?: boolean;
  text: string;
}

const P = (label: string, tag: string, n = 1, one = label): DistrictPart => ({ tag, n, label, one });
const C = (label: string, card: string): DistrictPart => ({ card, n: 1, label, one: label });

export const DISTRICTS: DistrictDef[] = [
  // Three of a kind (their bonuses live in the city ledger).
  { id: 'breadbasket', name: 'Breadbasket', parts: [P('Farms', 'farm', 3, 'Farm')], legacy: true, text: '+1 Food from every Farm.' },
  { id: 'crowded', name: 'Crowded City', parts: [P('fed Villages', 'housing', 3, 'Village')], legacy: true, text: '+1 Progress a turn.' },
  { id: 'stone', name: 'Stone City', parts: [P('Quarries', 'quarry', 3, 'Quarry')], legacy: true, text: '+1 Prosperity from every Quarry.' },
  // Mixed districts anyone can build.
  { id: 'marketTown', name: 'Market Town', parts: [P('Market', 'market'), P('Granary', 'granary'), P('Village', 'housing')], prosperity: 1,
    text: 'Grain stored, sold and eaten in one place: +1 Prosperity a turn.' },
  { id: 'craftQuarter', name: 'Craft Quarter', parts: [P('Workshop', 'workshop'), P('Quarries', 'quarry', 2, 'Quarry')], progress: 1,
    text: 'Stone and skill together: +1 Progress a turn.' },
  { id: 'holyCity', name: 'Holy City', parts: [P('Temple', 'temple'), P('Palace', 'palace')], progress: 1,
    text: 'Palace and temple side by side: +1 Progress a turn.' },
  // One district per civilization, from its own history.
  { id: 'ironCattle', name: 'Iron and Cattle', civ: 'kush', parts: [C('Iron Furnaces', 'kush_furnace'), P('Quarry', 'quarry'), P('Farm or Cattle', 'farm')], prosperity: 1, progress: 1,
    text: 'Ore, fuel and herds kept Meroë’s furnaces burning: +1 Prosperity and +1 Progress a turn.' },
  { id: 'redSea', name: 'Red Sea Trade', civ: 'aksum', parts: [C('Port of Adulis', 'aksum_adulis'), P('Market', 'market'), P('Farm or Fields', 'farm')], prosperity: 2, progress: 1,
    text: 'Highland grain and ivory out through Adulis: +2 Prosperity and +1 Progress a turn.' },
  { id: 'purpleTrade', name: 'Purple Trade', civ: 'carthage', parts: [C('Purple Dye Works', 'carth_dye'), P('Harbors', 'harbor', 2, 'Harbor')], prosperity: 2,
    text: 'Tyrian purple shipped from two harbours: +2 Prosperity a turn.' },
  { id: 'twoRivers', name: 'Land Between the Rivers', civ: 'sumer', parts: [C('Irrigation Canals', 'sumer_canals'), P('Farms', 'farm', 2, 'Farm'), P('Village or Reed Houses', 'housing')], prosperity: 1, progress: 1,
    text: 'Canals, fields and the people who work them: +1 Prosperity and +1 Progress a turn.' },
  { id: 'verticalArchipelago', name: 'Mountain Harvest', civ: 'inca', parts: [P('Farms or Terraces', 'farm', 2, 'Farm or Terrace'), P('Storehouse', 'granary'), P('Road', 'road')], progress: 1,
    text: 'Terraces at every altitude, storehouses on the road: +1 Progress a turn.' },
  { id: 'tradingTown', name: 'Trading Town', civ: 'norse', parts: [C('Hedeby Market', 'norse_market'), P('Fishing Grounds or Farm', 'farm'), P('Village', 'housing')], prosperity: 1, progress: 1,
    text: 'A market town on the water, fed by the sea: +1 Prosperity and +1 Progress a turn.' },
];

const DISTRICT_MAP = new Map(DISTRICTS.map((d) => [d.id, d]));
export const getDistrict = (id: string) => DISTRICT_MAP.get(id)!;

export function districtsFor(civ: CivId): DistrictDef[] {
  return DISTRICTS.filter((d) => !d.civ || d.civ === civ);
}

const fits = (part: DistrictPart, cardId: string) =>
  part.card ? part.card === cardId : (getCard(cardId).tags ?? []).includes(part.tag!);

/**
 * Assign buildings to the parts of a district (each building fills one part).
 * Returns how many of each part are still missing.
 */
function missingParts(d: DistrictDef, buildings: BuildingInst[]): number[] {
  const used = new Set<string>();
  return d.parts.map((part) => {
    let have = 0;
    for (const b of buildings) {
      if (have >= part.n) break;
      if (used.has(b.uid) || !fits(part, b.cardId)) continue;
      used.add(b.uid); have++;
    }
    return part.n - have;
  });
}

export interface DistrictStatus {
  /** Complete districts, all pieces working. */
  done: string[];
  /** Districts one building away (counting every building you own, working or not). */
  near: { id: string; missing: string }[];
}

export function districtStatus(civ: CivId, all: BuildingInst[], working: BuildingInst[]): DistrictStatus {
  const done: string[] = [];
  const near: DistrictStatus['near'] = [];
  for (const d of districtsFor(civ)) {
    const miss = missingParts(d, working);
    if (miss.every((m) => m === 0)) { done.push(d.id); continue; }
    const missAll = missingParts(d, all);
    const total = missAll.reduce((s, m) => s + m, 0);
    if (total === 1) near.push({ id: d.id, missing: d.parts[missAll.findIndex((m) => m > 0)].one });
  }
  return { done, near };
}
