function read(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

export function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = read(key)
  return allowed.includes(stored as T) ? (stored as T) : fallback
}

export const writeChoice = (key: string, value: string) => write(key, value)

export function readFlag(key: string) {
  return read(key) === '1'
}

export const writeFlag = (key: string, value: boolean) => write(key, value ? '1' : '0')

export function readIdList(key: string): string[] | 'all' {
  const stored = read(key)
  if (!stored) return 'all'
  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string') ? parsed : 'all'
  } catch {
    return 'all'
  }
}

export const writeIdList = (key: string, value: string[] | 'all') => write(key, value === 'all' ? null : JSON.stringify(value))
