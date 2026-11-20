import type { TrainerAttempt, TrainerFamily } from '../domain/models'

export type PlanPreset =
  | { kind: 'cases'; set: 'PLL' | 'OLL'; mode: 'Learn' | 'Drill' | 'Recognize'; ids: string[] }
  | { kind: 'time-attack'; set: 'PLL' | 'OLL'; ids: string[] }
  | { kind: 'f2l'; ids: string[] }
  | { kind: 'cross-goal'; pairs: number }

export type PlanDrill = {
  id: string
  title: string
  trainer: string
  problem: string
  steps: string[]
  counts?: string
  preset?: PlanPreset
  family?: TrainerFamily
}

export type PlanGroup = { id: string; title: string; problem: string; drills: PlanDrill[] }

const pll = (...names: string[]) => names.map((name) => `pll-${name.toLowerCase()}`)
const oll = (...numbers: number[]) => numbers.map((number) => `oll-${String(number).padStart(2, '0')}`)
const f2l = (...numbers: number[]) => numbers.flatMap((number) => ['fr', 'fl', 'bl', 'br'].map((slot) => `f2l-${slot}-${number}`))
const stuckEdges = [1, 2, 3, 4, 5, 6].map((number) => `f2l-stuck-edge-${number}`)

export const PLAN: PlanGroup[] = [
  {
    id: 'pausing',
    title: 'Stop pausing between pairs',
    problem: 'You solve a pair, stop, look for the next one, then go.',
    drills: [
      {
        id: 'pacer', title: 'Solves on the beat', trainer: 'pacer',
        problem: 'Turning fast, then stopping to look.',
        steps: ['Set a beat slow enough that you never miss it.', 'Full solves, one turn per beat, through all of F2L.', 'Missed a beat while looking: lower the beat. Ten clean solves: raise it one step.'],
        counts: 'A solve counts when you never stopped between two pairs.'
      },
      {
        id: 'pair-tracking', title: 'Follow a pair you are not turning', trainer: 'pair-tracking', family: 'tracking',
        problem: 'Eyes stay on the pair being inserted.',
        steps: ['Follow the named pair while the moves play.', 'Answer where it ended up before the cube is hidden.']
      },
      {
        id: 'cross-two', title: 'Cross and two pairs without a stop', trainer: 'cross-goal', preset: { kind: 'cross-goal', pairs: 2 },
        problem: 'The stop between pair one and pair two.',
        steps: ['While your hands do pair one, your eyes are already on pair two.', 'Never look at the pair you are inserting.'],
        counts: 'A rep counts when there was no stop between the two pairs.'
      }
    ]
  },
  {
    id: 'cross',
    title: 'Cross',
    problem: 'You start turning before the cross is fully planned, then hesitate in the middle.',
    drills: [
      {
        id: 'blind-cross', title: 'Blind cross', trainer: 'cross-plan', family: 'inspection',
        problem: 'Hesitation inside the cross.',
        steps: ['Turn the scramble.', 'Plan every move. Do not touch the cube until you can say the whole cross.', 'Look away, then turn it in one go.', 'When yours was longer, watch the shortest cross play.'],
        counts: 'A rep counts when the verdict shows zero pauses.'
      },
      {
        id: 'cross-one', title: 'Cross and first pair', trainer: 'cross-goal', preset: { kind: 'cross-goal', pairs: 1 },
        problem: 'The stop after the cross.',
        steps: ['In inspection, also find one corner and its edge.', 'Solve the cross, then that pair, with no stop between.', 'No extra turn after the fourth cross edge lands.']
      }
    ]
  },
  {
    id: 'f2l',
    title: 'F2L cases',
    problem: 'A different solution every time, so you stop to decide.',
    drills: [
      {
        id: 'stuck-edge', title: 'Edge stuck in another slot', trainer: 'f2l-cube', preset: { kind: 'f2l', ids: stuckEdges }, family: 'algorithm',
        problem: 'Corner on top, its edge in another empty slot. You dig the edge out, stop, then solve a new case.',
        steps: ['The trainer sets the case up on your cube.', 'Solve it with the one direct solution it shows. Same one every time.'],
        counts: 'A rep counts when you started turning without a stop.'
      },
      {
        id: 'f2l-standard', title: 'Four standard cases', trainer: 'f2l-cube', preset: { kind: 'f2l', ids: f2l(36, 35, 24, 8) }, family: 'algorithm',
        problem: 'F2L 36 and 35: you rotate or pick a long version. F2L 24: your solution is too long. F2L 8: you see it too slowly.',
        steps: ['One solution per slot. Pick it and never switch.', 'No cube rotation. Back-left is where you rotate most: solve it from where you sit.']
      }
    ]
  },
  {
    id: 'last-layer',
    title: 'Last layer',
    problem: 'Some algorithms stop in the middle, some are slow to recognise.',
    drills: [
      {
        id: 'pll-stops', title: 'PLL that stops in the middle', trainer: 'cases', family: 'algorithm',
        preset: { kind: 'cases', set: 'PLL', mode: 'Drill', ids: pll('Aa', 'Ab', 'Gc', 'Gd', 'Nb', 'E', 'V') },
        problem: 'Aa, Ab, Gc, Gd, Nb, E and V break in the middle. You use two different V perms.',
        steps: ['Run each one in a single piece, slow if needed.', 'Pick one V perm and drop the other.']
      },
      {
        id: 'pll-recognise', title: 'PLL slow to recognise', trainer: 'cases', family: 'recognition',
        preset: { kind: 'cases', set: 'PLL', mode: 'Recognize', ids: pll('E', 'Aa', 'Ab', 'Z', 'Rb', 'Gc', 'Gd') },
        problem: 'You turn the top layer to check before you start.',
        steps: ['Name the case from the front and right stickers only.']
      },
      {
        id: 'pll-speed', title: 'PLL slow hands', trainer: 'time-attack', family: 'time-attack',
        preset: { kind: 'time-attack', set: 'PLL', ids: pll('Aa', 'Ab', 'Z', 'Nb', 'Ua', 'Ja', 'Ga', 'Gb', 'Gc', 'Gd') },
        problem: 'These run far slower than your T perm.',
        steps: ['Set each target to your T perm time.', 'Run the misses again.']
      },
      {
        id: 'oll-recognise', title: 'OLL slow to recognise', trainer: 'cases', family: 'recognition',
        preset: { kind: 'cases', set: 'OLL', mode: 'Recognize', ids: oll(47, 11, 12, 52, 56, 41, 42, 13, 16, 3, 4) },
        problem: 'You turn the top twice or more before starting.',
        steps: ['Learn each one from all four angles, so the first top-layer turn is the only one.']
      },
      {
        id: 'oll-two-step', title: 'OLL done in two steps', trainer: 'cases', family: 'algorithm',
        preset: { kind: 'cases', set: 'OLL', mode: 'Learn', ids: oll(20, 9, 13) },
        problem: 'OLL 20, 9 and 13 are solved in two steps.',
        steps: ['Learn one real algorithm for each.']
      },
      {
        id: 'oll-speed', title: 'OLL slow hands', trainer: 'time-attack', family: 'time-attack',
        preset: { kind: 'time-attack', set: 'OLL', ids: oll(20, 9, 1, 12, 22, 18) },
        problem: 'These run slower than your other OLLs.',
        steps: ['Run them back to back against a target.']
      }
    ]
  }
]

export const presetCaseIds = (drill: PlanDrill) => drill.preset && 'ids' in drill.preset ? drill.preset.ids : []

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

export function drillProgress(drill: PlanDrill, attempts: TrainerAttempt[], since: number) {
  const ids = presetCaseIds(drill)
  if (!drill.family) return undefined
  const today = attempts.filter((attempt) => (attempt.recordedAt ?? 0) >= since && attempt.family === drill.family && (!ids.length || ids.includes(attempt.caseId)))
  const clean = today.filter((attempt) => attempt.outcome === 'success')
  return { reps: today.length, clean: clean.length, cleanCases: new Set(clean.map((attempt) => attempt.caseId)) }
}
