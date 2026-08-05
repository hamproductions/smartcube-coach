import type { StageRecord } from './models'

/**
 * What to actually do about one stage of one solve.
 *
 * The insight panel says what is true across solves; this says what to change in this stage,
 * measured against the rest of the same solve so the advice is about the solver, not a
 * global benchmark. Silence is correct when the stage is fine — advice on every row is noise.
 */
export function stageAdvice(stage: StageRecord, all: StageRecord[]): string | undefined {
  const total = (record: StageRecord) => (record.recognitionMs ?? 0) + (record.executionMs ?? 0)
  const ms = total(stage)
  if (ms === 0) return undefined

  // The better pair outranks everything: choosing the wrong slot costs more than executing
  // the right one badly, and it is the one thing the solver can change on the very next solve.
  if (stage.betterSlot) {
    // Which pair to have taken, and what it was worth. The stored `moves` come from the same
    // unconstrained search as `optimalMoves` and are not an algorithm to follow, so they are
    // not printed — the actionable part is the choice of slot.
    // Named by colour when the analyser recorded them: a solver can see a green/red pair, where
    // `BL` depends on a frame they never chose.
    const named = stage.betterSlotColours?.length
      ? `${stage.betterSlotColours.map((colour) => colour.name).join('/')} (${stage.betterSlot.slot})`
      : stage.betterSlot.slot
    return `The ${named} pair was ${stage.betterSlot.saved} moves cheaper here`
  }

  const recognition = stage.recognitionMs ?? 0
  const share = recognition / ms

  // Recognition is the pause before the turns start. More than half the stage spent there
  // means the case was found slowly, not executed slowly.
  if (share >= 0.5 && recognition >= 700) {
    return `Recognition took ${(recognition / 1000).toFixed(2)}s of ${(ms / 1000).toFixed(2)}s — drill spotting this case, not turning it.`
  }

  if (stage.optimalMoveCount !== undefined && stage.moveCount - stage.optimalMoveCount >= 4) {
    const extra = stage.moveCount - stage.optimalMoveCount
    // The move count only. `optimalMoves` is the SHORTEST cross-plus-pair sequence a search
    // can find, and printing it as advice was wrong twice over: it is not an algorithm anybody
    // turns (`U R2 F R2 F2 U' F` for a pair), and the search is free to take apart pairs that
    // were already solved, so following it would undo the solver's own work. The algorithm to
    // use comes from the case catalogue, on its own line, when the case is recognised.
    return `${stage.moveCount} moves against an optimal ${stage.optimalMoveCount} — ${extra} wasted turns.`
  }

  const others = all.filter((record) => record.id !== stage.id).map(total).filter((value) => value > 0)
  if (others.length >= 2) {
    const mean = others.reduce((sum, value) => sum + value, 0) / others.length
    if (ms > mean * 1.6) {
      return `${(ms / 1000).toFixed(2)}s against ${(mean / 1000).toFixed(2)}s for your other stages here — this is where the solve went.`
    }
  }

  if (stage.pauseCount !== undefined && stage.pauseCount >= 2) {
    return `${stage.pauseCount} pauses mid-stage — you are turning, stopping to look, then turning again.`
  }

  return undefined
}
