import { defaultLetterScheme, generateBldDrill, normalizeLetterScheme } from '../../../domain/bld'
import { repositories } from '../../../storage/database'

export type BldConfig = { buffer: string; letterScheme: string }

export const DEFAULT_CONFIG: BldConfig = { buffer: 'A', letterScheme: defaultLetterScheme }

const CONFIG_KEY = 'bld-config'
const OPEN_KEY = 'bld:settings-open'
const ROUND_KEY = 'bld:round'

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

export function validateConfig(buffer: string, letterScheme: string): BldConfig {
  const scheme = normalizeLetterScheme(letterScheme)
  const normalizedBuffer = buffer.trim().toUpperCase()
  generateBldDrill('bld-check', normalizedBuffer, scheme)
  return { buffer: normalizedBuffer, letterScheme: scheme }
}

export async function loadConfig(): Promise<BldConfig> {
  const saved = (await repositories.settings.get(CONFIG_KEY))?.value as { buffer?: unknown; letterScheme?: unknown } | undefined
  if (!saved || typeof saved.buffer !== 'string' || typeof saved.letterScheme !== 'string') return DEFAULT_CONFIG
  try {
    return validateConfig(saved.buffer, saved.letterScheme)
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveConfig(config: BldConfig) {
  await repositories.settings.put({ key: CONFIG_KEY, value: config })
}

export const readSettingsOpen = () => read(OPEN_KEY) === '1'
export const writeSettingsOpen = (open: boolean) => write(OPEN_KEY, open ? '1' : '0')

export function readRound() {
  const stored = Number(read(ROUND_KEY))
  return Number.isInteger(stored) && stored > 0 ? stored : 1
}

export const writeRound = (round: number) => write(ROUND_KEY, String(round))

export const seedForRound = (round: number) => `bld-${String(round).padStart(3, '0')}`
