export type Pace = 'slow' | 'normal' | 'fast'

export const PACES: Pace[] = ['slow', 'normal', 'fast']
export const PACE_LABEL: Record<Pace, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' }
export const PACE_MS: Record<Pace, number> = { slow: 1100, normal: 700, fast: 400 }
export const LEAD_MS: Record<Pace, number> = { slow: 1600, normal: 1200, fast: 800 }

const PACE_KEY = 'lookahead:pace'
const roundKey = (trainerId: string) => `lookahead:${trainerId}:round`

function read(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

export function readPace(): Pace {
  const stored = read(PACE_KEY)
  return PACES.includes(stored as Pace) ? (stored as Pace) : 'normal'
}

export const writePace = (pace: Pace) => write(PACE_KEY, pace)

export function readRound(trainerId: string) {
  const stored = Number(read(roundKey(trainerId)))
  return Number.isInteger(stored) && stored > 0 ? stored : 1
}

export const writeRound = (trainerId: string, round: number) => write(roundKey(trainerId), String(round))

export const roundSeed = (prefix: string, round: number) => `${prefix}-${String(round).padStart(3, '0')}`
