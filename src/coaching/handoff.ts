const KEY = 'smartcube-coach:plan-handoff'

export type PlanHandoff = { trainer: string; caseIds?: string[]; pairs?: number }

export function setPlanHandoff(handoff: PlanHandoff) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(handoff))
  } catch {
    return
  }
}

export function readPlanHandoff(trainer: string): PlanHandoff | undefined {
  try {
    const stored = window.sessionStorage.getItem(KEY)
    if (!stored) return undefined
    const parsed = JSON.parse(stored) as PlanHandoff
    return parsed.trainer === trainer ? parsed : undefined
  } catch {
    return undefined
  }
}

export function clearPlanHandoff() {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    return
  }
}
