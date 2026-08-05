const reconnectWindowMs = 30_000
const reconnectAttempts = 3

export function recordDrop(previous: number[], now: number) {
  return [...previous.filter((time) => now - time < reconnectWindowMs), now]
}

export function reconnectDecision(drops: number[], connected: boolean) {
  if (!connected) return { retry: false, status: 'Cube disconnected' as const }
  if (drops.length <= reconnectAttempts) return { retry: true, status: `Cube dropped · reconnecting (${drops.length}/${reconnectAttempts})` }
  return { retry: false, status: 'Cube keeps dropping · reconnect manually' as const }
}

export function reconnectDelayMs(drops: number[]) {
  return 400 * Math.max(1, drops.length)
}
