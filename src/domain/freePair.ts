// Free-pair rules from https://www.solved.no/trainers/3x3/free-pair (freePairTrainer.js:
// algorithmCreatesFreePair, getFreePairOptions), ported from the free-pair-cheatsheet project
// (site/cube.js sticker model, site/app.js generator and finisher search).
import { Alg } from 'cubing/alg'
import { cube3x3x3 } from 'cubing/puzzles'
import { seededRandom } from './cfopSimulation'
import { freePairCases } from './freePairCases'

type Vec = readonly [number, number, number]
type Axis = 'x' | 'y' | 'z'
type Perm = number[]

export type FreePairSlot = 'FR' | 'FL' | 'BL' | 'BR'
export type FreePairMode = 'normal' | '2gen'

export type FreePairPrompt = {
  seed: string
  mode: FreePairMode
  caseName: string
  slot: FreePairSlot
  setup: string
  options: string[]
  finishes: Array<string | null>
  normalFinishes: Array<string | null>
}

const ROTATE: Record<Axis, Record<number, (v: Vec) => Vec>> = {
  x: { 1: ([x, y, z]) => [x, -z, y], [-1]: ([x, y, z]) => [x, z, -y] },
  y: { 1: ([x, y, z]) => [z, y, -x], [-1]: ([x, y, z]) => [-z, y, x] },
  z: { 1: ([x, y, z]) => [-y, x, z], [-1]: ([x, y, z]) => [y, -x, z] }
}
const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 }
const LAYERS: Record<string, [Axis, number, (v: number) => boolean]> = {
  R: ['x', -1, (v) => v === 1], L: ['x', 1, (v) => v === -1], M: ['x', 1, (v) => v === 0],
  r: ['x', -1, (v) => v >= 0], l: ['x', 1, (v) => v <= 0], x: ['x', -1, () => true],
  U: ['y', -1, (v) => v === 1], D: ['y', 1, (v) => v === -1], E: ['y', 1, (v) => v === 0],
  u: ['y', -1, (v) => v >= 0], d: ['y', 1, (v) => v <= 0], y: ['y', -1, () => true],
  F: ['z', -1, (v) => v === 1], B: ['z', 1, (v) => v === -1], S: ['z', -1, (v) => v === 0],
  f: ['z', -1, (v) => v >= 0], b: ['z', 1, (v) => v <= 0], z: ['z', -1, () => true]
}

const STICKERS: Array<{ p: Vec; n: Vec }> = []
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
  if (!(x || y || z)) continue
  for (const n of [[x, 0, 0], [0, y, 0], [0, 0, z]] as Vec[]) if (n.some(Boolean)) STICKERS.push({ p: [x, y, z], n })
}
const stickerKey = (p: Vec, n: Vec) => `${p}|${n}`
const INDEX = new Map(STICKERS.map((sticker, i) => [stickerKey(sticker.p, sticker.n), i]))
const stickerAt = (p: Vec, n: Vec) => INDEX.get(stickerKey(p, n)) as number

const identity = (): Perm => STICKERS.map((_, i) => i)
const compose = (a: Perm, b: Perm): Perm => a.map((_, i) => a[b[i]])
const invert = (a: Perm): Perm => {
  const out: Perm = []
  a.forEach((v, i) => { out[v] = i })
  return out
}

const layerPerm = (name: string): Perm => {
  const [axis, direction, inLayer] = LAYERS[name]
  const rotate = ROTATE[axis][direction]
  const out = identity()
  STICKERS.forEach((sticker, i) => {
    if (inLayer(sticker.p[AXIS_INDEX[axis]])) out[stickerAt(rotate(sticker.p), rotate(sticker.n))] = i
  })
  return out
}

const tokens = (alg: string) => alg.replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean)
const tokenPerm = (token: string): Perm => {
  const base = layerPerm(token[0])
  if (token[1] === '2') return compose(base, base)
  if (token[1] === "'") return invert(base)
  return base
}
const raw = (alg: string) => tokens(alg).reduce((state, token) => compose(state, tokenPerm(token)), identity())

const CENTRES = [stickerAt([0, 1, 0], [0, 1, 0]), stickerAt([0, 0, 1], [0, 0, 1])]
const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((a) => ['', 'y', 'y2', "y'"].map((b) => `${a} ${b}`.trim()))

const normalised = (alg: string) => {
  const state = raw(alg)
  for (const rotation of ROTATIONS) {
    const next = compose(state, raw(rotation))
    if (CENTRES.every((centre) => next[centre] === centre)) return { perm: next, rotation }
  }
  throw new Error(`No rotation restores the centres after ${alg}`)
}

const permCache = new Map<string, Perm>()
const perm = (alg: string) => {
  const cached = permCache.get(alg)
  if (cached) return cached
  const next = normalised(alg).perm
  permCache.set(alg, next)
  return next
}

const SLOT_XZ: Record<FreePairSlot, [number, number]> = { FR: [1, 1], BR: [1, -1], BL: [-1, -1], FL: [-1, 1] }
const pairStickers = (slot: FreePairSlot) => {
  const [x, z] = SLOT_XZ[slot]
  const corner = ([[x, 0, 0], [0, -1, 0], [0, 0, z]] as Vec[]).map((n) => stickerAt([x, -1, z], n))
  const edge = ([[x, 0, 0], [0, 0, z]] as Vec[]).map((n) => stickerAt([x, 0, z], n))
  return [...corner, ...edge]
}
const pairSolved = (state: Perm, slot: FreePairSlot) => pairStickers(slot).every((i) => state[i] === i)

const ROTATION_FOR: Record<Exclude<FreePairSlot, 'FR'>, string> = { BR: 'y', BL: 'y2', FL: "y'" }
const UNDO_ROTATION: Record<string, string> = { y: "y'", y2: 'y2', "y'": 'y' }
const FREE_INSERTS = ["R U R'", "R U' R'", "F' U F", "F' U' F"]
const AUFS = ['', 'U', 'U2', "U'"]
const UNDO_AUF: Record<string, string> = { '': '', U: "U'", U2: 'U2', "U'": 'U' }
const MODES: Record<FreePairMode, { slots: Array<Exclude<FreePairSlot, 'FR'>>; inserts: string[]; aufs: string[] }> = {
  normal: { slots: ['BR', 'BL', 'FL'], inserts: FREE_INSERTS, aufs: AUFS },
  '2gen': { slots: ['BR'], inserts: ["F' U F", "F' U' F"], aufs: ['U', 'U2', "U'"] }
}

const inRotation = (rotation: string, ...moves: string[]) => [rotation, ...moves, UNDO_ROTATION[rotation]].filter(Boolean).join(' ')

const finisher = (state: Perm, slot: Exclude<FreePairSlot, 'FR'>, mode: FreePairMode) => {
  const rotation = ROTATION_FOR[slot]
  for (const auf of MODES[mode].aufs) for (const insert of MODES[mode].inserts) {
    if (pairSolved(compose(state, perm(inRotation(rotation, auf, insert))), slot)) return `(${[rotation, auf].filter(Boolean).join(' ')}) ${insert}`
  }
  return null
}

const QUARTERS: Record<string, number> = { '': 0, U: 1, U2: 2, "U'": 3 }
const withPreAuf = (alg: string, auf: string) => {
  const matched = /^\(([^)]*)\)\s*(.*)$/.exec(alg)
  const prefix = matched ? matched[1].split(/\s+/) : []
  const body = matched ? matched[2] : alg
  const quarters = prefix.filter((token) => token[0] === 'U').reduce((sum, token) => sum + QUARTERS[token], QUARTERS[auf])
  const lead = [...prefix.filter((token) => token[0] !== 'U'), AUFS[quarters % 4]].filter(Boolean)
  return lead.length ? `(${lead.join(' ')}) ${body}` : body
}

export function generateFreePairPrompt(seed: string, mode: FreePairMode = 'normal'): FreePairPrompt | undefined {
  const random = seededRandom(`${seed}:${mode}`)
  const pick = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length) % values.length]
  const rows = freePairCases.filter((row) => row.algs.length > 1)
  const config = MODES[mode]
  for (let attempt = 0; attempt < 400; attempt++) {
    const row = pick(rows)
    const shown = Math.floor(random() * row.algs.length) % row.algs.length
    const slot = pick(config.slots)
    const freeSetup = inRotation(ROTATION_FOR[slot], pick(config.inserts), pick(config.aufs))
    const auf = pick(AUFS)
    let state = compose(perm(freeSetup), invert(perm(row.algs[shown])))
    if (auf) state = compose(state, perm(auf))
    const options = row.algs.map((alg) => withPreAuf(alg, UNDO_AUF[auf]))
    const finishes = options.map((alg) => finisher(compose(state, perm(alg)), slot, mode))
    if (finishes.every((finish) => finish !== null) || finishes[shown] === null) continue
    const caseAlg = tokens(row.algs[shown]).join(' ')
    const caseRotation = normalised(caseAlg).rotation
    const moves = [freeSetup, caseRotation && new Alg(caseRotation).invert().toString(), new Alg(caseAlg).invert().toString(), auf].filter(Boolean).join(' ')
    const setup = new Alg(moves).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().replace(/2'/g, '2').trim()
    return {
      seed,
      mode,
      caseName: row.name,
      slot,
      setup,
      options,
      finishes,
      normalFinishes: options.map((alg) => finisher(compose(state, perm(alg)), slot, 'normal'))
    }
  }
  return undefined
}

export function gradeFreePair(prompt: FreePairPrompt, index: number) {
  return prompt.finishes[index] !== null && prompt.finishes[index] !== undefined
}
