import { Alg } from 'cubing/alg'
import type { AlgorithmRecord } from './models'

export interface CatalogueCase {
  id: string
  set: AlgorithmRecord['set']
  name: string
  algorithm: string
}

const ollAlgorithms: Array<[number, string, string]> = [
  [1, 'Runway', "R U2 R2 F R F' U2 R' F R F'"],
  [2, 'Zamboni', "r U r' U2 r U2 R' U2 R U' r'"],
  [3, 'Anti-Mounted Fish', "r' R2 U R' U r U2 r' U M'"],
  [4, 'Mounted Fish', "M U' r U2 r' U' R U' R' M'"],
  [5, 'Lightning Bolt', "l' U2 L U L' U l"],
  [6, 'Anti-Lightning Bolt', "r U2 R' U' R U' r'"],
  [7, 'Mario', "r U R' U R U2 r'"],
  [8, 'Luigi', "l' U' L U' L' U2 l"],
  [9, 'Kite', "R U R' U' R' F R2 U R' U' F'"],
  [10, 'Anti-Kite', "R U R' U R' F R F' R U2 R'"],
  [11, 'Downstairs', "r U R' U R' F R F' R U2 r'"],
  [12, 'Upstairs', "M' R' U' R U' R' U2 R U' R r'"],
  [13, 'Gun', "F U R U' R2 F' R U R U' R'"],
  [14, 'Anti-Gun', "R' F R U R' F' R F U' F'"],
  [15, 'Squeegee', "l' U' l L' U' L U l' U l"],
  [16, 'Anti-Squeegee', "r U r' R U R' U' r U' r'"],
  [17, 'Slash', "F R' F' R2 r' U R U' R' U' M'"],
  [18, 'Crown', "r U R' U R U2 r2 U' R U' R' U2 r"],
  [19, 'Bunny', "r' R U R U R' U' M' R' F R F'"],
  [20, 'Checkers', "r U R' U' M2 U R U' R' U' M'"],
  [21, 'Double Sune', "R U2 R' U' R U R' U' R U' R'"],
  [22, 'Anti-Double Sune', "R U2 R2 U' R2 U' R2 U2 R"],
  [23, 'Headlights', "R2 D' R U2 R' D R U2 R"],
  [24, 'Bowtie', "r U R' U' r' F R F'"],
  [25, 'Anti-Bowtie', "F' r U R' U' r' F R"],
  [26, 'Anti-Sune', "R U2 R' U' R U' R'"],
  [27, 'Sune', "R U R' U R U2 R'"],
  [28, 'Duck', "r U R' U' r' R U R U' R'"],
  [29, 'Spotted Chameleon', "R U R' U' R U' R' F' U' F R U R'"],
  [30, 'Anti-Spotted Chameleon', "F R' F R2 U' R' U' R U R' F2"],
  [31, 'Couch', "R' U' F U R U' R' F' R"],
  [32, 'Anti-Couch', "L U F' U' L' U L F L'"],
  [33, 'Key', "R U R' U' R' F R F'"],
  [34, 'City', "R U R2 U' R' F R U R U' F'"],
  [35, 'Fish Salad', "R U2 R2 F R F' R U2 R'"],
  [36, 'Anti-Mounted Fish Salad', "L' U' L U' L' U L U L F' L' F"],
  [37, 'Mounted Fish Salad', "F R' F' R U R U' R'"],
  [38, 'Mario Head', "R U R' U R U' R' U' R' F R F'"],
  [39, 'Luigi Head', "L F' L' U' L U F U' L'"],
  [40, 'Mario Cap', "R' F R U R' U' F' U R"],
  [41, 'Awkward Fish', "R U R' U R U2 R' F R U R' U' F'"],
  [42, 'Anti-Awkward Fish', "R' U' R U' R' U2 R F R U R' U' F'"],
  [43, 'Anti-P Shape', "F' U' L' U L F"],
  [44, 'P Shape', "F U R U' R' F'"],
  [45, 'T Shape', "F R U R' U' F'"],
  [46, 'Seein Headlights', "R' U' R' F R F' U R"],
  [47, 'Anti-Breakneck', "F' L' U' L U L' U' L U F"],
  [48, 'Breakneck', "F R U R' U' R U R' U' F'"],
  [49, 'Right Back Squeezy', "r U' r2 U r2 U r2 U' r"],
  [50, 'Right Front Squishy', "r' U r2 U' r2 U' r2 U r'"],
  [51, 'Bottlecap', "F U R U' R' U R U' R' F'"],
  [52, 'Rice Cooker', "R U R' U R U' B U' B' R'"],
  [53, 'Frying Pan', "l' U2 L U L' U' L U L' U l"],
  [54, 'Anti-Frying Pan', "r U2 R' U' R U R' U' R U' r'"],
  [55, 'Highway', "R' F R U R U' R2 F' R2 U' R' U R U R'"],
  [56, 'Streetlights', "r U r' U R U' R' U R U' R' r U' r'"],
  [57, 'H', "R U R' U' M' U R U' r'"]
]

const eollAlgorithms: Array<[string, string, string]> = [
  ['dot', 'Dot', "F R U R' U' F' f R U R' U' f'"],
  ['line', 'Line', "F R U R' U' F'"],
  ['l', 'Bent', "f R U R' U' f'"]
]

const pllAlgorithms: Array<[string, string]> = [
  ['Aa', "R' F R' B2 R F' R' B2 R2"],
  ['Ab', "R B' R F2 R' B R F2 R2"],
  ['E', "x' R U' R' D R U R' D' R U R' D R U' R' D' x"],
  ['F', "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"],
  ['Ga', "R2 U R' U R' U' R U' R2 U' D R' U R D'"],
  ['Gb', "R' U' R U D' R2 U R' U R U' R U' R2 D"],
  ['Gc', "R2 U' R U' R U R' U R2 U D' R U' R' D"],
  ['Gd', "R U R' U' D R2 U' R U' R' U R' U R2 D'"],
  ['H', 'M2 U M2 U2 M2 U M2'],
  ['Ja', "x R2 F R F' R U2 r' U r U2 x'"],
  ['Jb', "R U R' F' R U R' U' R' F R2 U' R' U'"],
  ['Na', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"],
  ['Nb', "R' U R U' R' F' U' F R U R' F R' F' R U' R"],
  ['Ra', "R U' R' U' R U R D R' U' R D' R' U2 R' U'"],
  ['Rb', "R2 F R U R U' R' F' R U2 R' U2 R"],
  ['T', "R U R' U' R' F R2 U' R' U' R U R' F'"],
  ['Ua', "M2 U M U2 M' U M2"],
  ['Ub', "M2 U' M U2 M' U' M2"],
  ['V', "R' U R' U' y R' F' R2 U' R' U R' F R F"],
  ['Y', "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
  ['Z', "M2 U M2 U M' U2 M2 U2 M' U2"]
]

export const ollCases: CatalogueCase[] = ollAlgorithms.map(([number, name, algorithm]) => ({
  id: `oll-${String(number).padStart(2, '0')}`,
  set: 'OLL',
  name: `OLL ${number} ${name}`,
  algorithm
}))

export const eollCases: CatalogueCase[] = eollAlgorithms.map(([suffix, name, algorithm]) => ({
  id: `eoll-${suffix}`,
  set: 'OLL',
  name: `EOLL ${name}`,
  algorithm
}))

export const pllCases: CatalogueCase[] = pllAlgorithms.map(([name, algorithm]) => ({
  id: `pll-${name.toLowerCase()}`,
  set: 'PLL',
  name: `${name} Perm`,
  algorithm
}))

export const catalogueCases: CatalogueCase[] = [...ollCases, ...pllCases]

const collAlgorithms: Array<[string, string, string]> = [
  ['as-1', 'Anti-Sune 1', "R' U2' R U R' U R"],
  ['as-2', 'Anti-Sune 2', "R2' D' R U' R' D R U' R U R' U R y'"],
  ['as-3', 'Anti-Sune 3', "R' U2' R U2' L U' R' U R L'"],
  ['as-4', 'Anti-Sune 4', "R2' F R U R U' R' F' R U' R' U R"],
  ['as-5', 'Anti-Sune 5', "L U' R' U L' U' R"],
  ['as-6', 'Anti-Sune 6', "R' D' R U' R' D R U2' R U R' U2' R U R'"],
  ['s-1', 'Sune 1', "R U2' R' U' R U' R'"],
  ['s-2', 'Sune 2', "R L' U' L U R' U2' L' U2' L"],
  ['s-3', 'Sune 3', "R U2' R' U2' L' U R U' R' L"],
  ['s-4', 'Sune 4', "R2' D R' U R D' R' U R' U' R U' R' y"],
  ['s-5', 'Sune 5', "L' U R U' L U R'"],
  ['s-6', 'Sune 6', "F R U R' U' R' F2' R U2' R U2' R' F"],
  ['l-1', 'L 1', "R U R' U R U' R' U R U' R' U R U2' R' y"],
  ['l-2', 'L 2', "R2' D' R U2' R' D R U2' R"],
  ['l-3', 'L 3', "R2' D R' U2' R D' R' U2' R' y'"],
  ['l-4', 'L 4', "R U R D R' U' R D' R2' y2'"],
  ['l-5', 'L 5', "R' F' r U R U' r' F y2'"],
  ['l-6', 'L 6', "R2' F' R U R U' R' F R U' R' U R y"],
  ['u-1', 'U 1', "R U2' R' U' R U' R2' U2' R U R' U R"],
  ['u-2', 'U 2', "R' F R' F' R U R U' R' F R U' R' U R U R' F' R"],
  ['u-3', 'U 3', "R U2' R D R' U2' R D' R2' y2'"],
  ['u-4', 'U 4', "F R U R' U' R U' R' U' R U R' F'"],
  ['u-5', 'U 5', "R' U2' R' D' R U2' R' D R2'"],
  ['u-6', 'U 6', "F U' R' U R U F' R' U2' R"],
  ['t-1', 'T 1', "R' U' R U' R' U2' R2' U R' U R U2' R'"],
  ['t-2', 'T 2', "L' U R' U' L R U2' R' U' R"],
  ['t-3', 'T 3', "F' r U R' U' L' U l y'"],
  ['t-4', 'T 4', "F R U' R' U R U R' U R U' R' F' y2'"],
  ['t-5', 'T 5', "F R' F' r U R U' r' y"],
  ['t-6', 'T 6', "R' U R2' D r' U2' r D' R2' U' R"],
  ['pi-1', 'Pi 1', "R' U2' R2' U R2' U R2' U2' R'"],
  ['pi-2', 'Pi 2', "R U R' U F2' R U2' R' U2' R' F2' R"],
  ['pi-3', 'Pi 3', "R' U2' R U2' R2' F' R U R U' R' F U R"],
  ['pi-4', 'Pi 4', "F U R U' R' U R U' R2' F' R U R U' R'"],
  ['pi-5', 'Pi 5', "L' U' L U' L' U' R U' L U R'"],
  ['pi-6', 'Pi 6', "R' U2' R2' U R U R2' D' R U' R' D U' R'"],
  ['h-1', 'H 1', "R U2' R' U' R U R' U' R U' R'"],
  ['h-2', 'H 2', "F U R U' R' U R U2' R' U' R U R' F'"],
  ['h-3', 'H 3', "L' U R U' L U' R' U' R U' R'"],
  ['h-4', 'H 4', "F U R U' R' U R U' R' U R U' R' F' y'"]
]

const cmllAlgorithms: Array<[string, string, string]> = [
  ['o-1', 'O 1', "R U R' F' R U R' U' R' F R2 U' R'"],
  ['o-2', 'O 2', "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
  ['h-1', 'H 1', "R U2 R' U' R U R' U' R U' R'"],
  ['h-2', 'H 2', "F R U R' U' R U R' U' R U R' U' F'"],
  ['h-3', 'H 3', "R U2' R2' F R F' U2 R' F R F'"],
  ['h-4', 'H 4', "r U' r2' D' r U' r' D r2 U r'"],
  ['pi-1', 'Pi 1', "F R U R' U' R U R' U' F'"],
  ['pi-2', 'Pi 2', "F R' F' R U2 R U' R' U R U2' R'"],
  ['pi-3', 'Pi 3', "R' F R U F U' R U R' U' F'"],
  ['pi-4', 'Pi 4', "R U2 R' U' R U R' U2' R' F R F'"],
  ['pi-5', 'Pi 5', "r U' r2' D' r U r' D r2 U r'"],
  ['pi-6', 'Pi 6', "R' U' R' F R F' R U' R' U2 R"],
  ['u-1', 'U 1', "R2 D R' U2 R D' R' U2 R'"],
  ['u-2', 'U 2', "R2' D' R U2 R' D R U2 R"],
  ['u-3', 'U 3', "R2' F U' F U F2 R2 U' R' F R"],
  ['u-4', 'U 4', "F R2 D R' U R D' R2' U' F'"],
  ['u-5', 'U 5', "r U' r' U r' D' r U' r' D r"],
  ['u-6', 'U 6', "F R U R' U' F'"],
  ['t-1', 'T 1', "R U R' U' R' F R F'"],
  ['t-2', 'T 2', "L' U' L U L F' L' F"],
  ['t-3', 'T 3', "F R' F R2 U' R' U' R U R' F2"],
  ['t-4', 'T 4', "r' U r U2' R2' F R F' R"],
  ['t-5', 'T 5', "r' D' r U r' D r U' r U r'"],
  ['t-6', 'T 6', "r2' D' r U r' D r2 U' r' U' r"],
  ['s-1', 'S 1', "R U R' U R U2 R'"],
  ['s-2', 'S 2', "L' U2 L U2' L F' L' F"],
  ['s-3', 'S 3', "F R' F' R U2 R U2' R'"],
  ['s-4', 'S 4', "R' U' R U' R2' F' R U R U' R' F U2' R"],
  ['s-5', 'S 5', "R U R' U R' F R F' R U2' R'"],
  ['s-6', 'S 6', "R U' L' U R' U' L"],
  ['as-1', 'Anti-S 1', "R' U' R U' R' U2' R"],
  ['as-2', 'Anti-S 2', "R2 D R' U R D' R' U R' U' R U' R'"],
  ['as-3', 'Anti-S 3', "F' L F L' U2' L' U2 L"],
  ['as-4', 'Anti-S 4', "R U2' R' U2 R' F R F'"],
  ['as-5', 'Anti-S 5', "L' U R U' L U R'"],
  ['as-6', 'Anti-S 6', "R' U' R U' R' U R' F R F' U R"],
  ['l-1', 'L 1', "F R U' R' U' R U R' F'"],
  ['l-2', 'L 2', "F R' F' R U R U' R'"],
  ['l-3', 'L 3', "R U2 R' U' R U R' U' R U R' U' R U' R'"],
  ['l-4', 'L 4', "R U2 R D R' U2 R D' R2'"],
  ['l-5', 'L 5', "R' U' R U R' F' R U R' U' R' F R2"],
  ['l-6', 'L 6', "R' U2 R' D' R U2 R' D R2"]
]

export const collCases: CatalogueCase[] = collAlgorithms.map(([id, name, algorithm]) => ({
  id: `coll-${id}`,
  set: 'COLL',
  name: `COLL ${name}`,
  algorithm
}))

export const cmllCases: CatalogueCase[] = cmllAlgorithms.map(([id, name, algorithm]) => ({
  id: `cmll-${id}`,
  set: 'CMLL',
  name: `CMLL ${name}`,
  algorithm
}))

// The cubedex-ported last-layer sets are one-look algorithms of similar length to OLL/PLL,
// so they inherit a comparable target rather than a made-up one.
const targetMs: Record<AlgorithmRecord['set'], number> = {
  F2L: 900, OLL: 1300, PLL: 1500, BLD: 3000, COLL: 1600, CMLL: 1600,
  WVLS: 1300, OLLCP: 1600, VHLS: 1300, ZBLL: 1600, ZBLS: 1300, 'L6E-EO': 1300, 'L6E-EOLR': 1300
}

export function toAlgorithmRecord(entry: CatalogueCase, timestamp = Date.now()): AlgorithmRecord {
  return {
    id: entry.id,
    set: entry.set,
    name: entry.name,
    algorithm: entry.algorithm,
    setup: new Alg(entry.algorithm).invert().toString(),
    targetMs: targetMs[entry.set],
    mastery: 0,
    dueAt: timestamp,
    orientations: ['U', "U'", 'U2']
  }
}
