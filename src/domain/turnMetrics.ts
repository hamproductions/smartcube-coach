export type TurnMetrics = { htm: number; qtm: number; stm: number; etm: number }

export function turnMetrics(moves: string[]): TurnMetrics {
  const metrics: TurnMetrics = { htm: 0, qtm: 0, stm: 0, etm: 0 }
  for (const raw of moves) {
    const move = raw.trim()
    const match = /^([URFDLBMESxyzurfdlb])(w?)(\d*)('?)$/.exec(move)
    if (!match) continue
    const [, letter, , amount] = match
    const quarters = (Number(amount || '1') % 4) === 2 ? 2 : 1
    metrics.etm += 1
    if (/[xyz]/.test(letter)) continue
    metrics.stm += 1
    if (/[MES]/.test(letter)) {
      metrics.htm += 2
      metrics.qtm += 2 * quarters
    } else {
      metrics.htm += 1
      metrics.qtm += quarters
    }
  }
  return metrics
}
