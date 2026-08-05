import { describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { diagramFaceletIndex, schemeFor } from './LastLayerDiagram'
import { patternToFacelets, solvedPattern } from '../../domain/cubedex/cubeUtils'

// The tab order was established by turning single faces on a solved cube and reading which
// facelet index changed — B and R index from the far side, so they run against the diagram.
// These assertions pin that, because a silently mirrored diagram still looks plausible.
const faceletsAfter = async (alg: string) => {
  const solved = await solvedPattern()
  return patternToFacelets(alg ? solved.applyAlg(Alg.fromString(alg)) : solved)
}

describe('last layer diagram geometry', () => {
  it('reads the U face with row 0 at the back and column 0 on the left', async () => {
    // An F turn brings the L face onto U's front row; a B turn brings R onto U's back row.
    const afterF = await faceletsAfter('F')
    for (let column = 0; column < 3; column += 1) {
      expect(afterF[diagramFaceletIndex.top(2, column)]).toBe('L')
    }
    const afterB = await faceletsAfter('B')
    for (let column = 0; column < 3; column += 1) {
      expect(afterB[diagramFaceletIndex.top(0, column)]).toBe('R')
    }
    // An L turn claims the left column, an R turn the right one.
    const afterL = await faceletsAfter('L')
    for (let row = 0; row < 3; row += 1) expect(afterL[diagramFaceletIndex.top(row, 0)]).toBe('B')
    const afterR = await faceletsAfter('R')
    for (let row = 0; row < 3; row += 1) expect(afterR[diagramFaceletIndex.top(row, 2)]).toBe('F')
  })

  it('orders each side tab as it appears looking down at the cube', async () => {
    // After R, the U sticker that moved onto B sits at the end nearest R — the right-hand
    // tab in the diagram. Reversed, it would draw on the left and the case would read wrong.
    const afterR = await faceletsAfter('R')
    expect(afterR[diagramFaceletIndex.back(2)]).toBe('U')
    expect(afterR[diagramFaceletIndex.back(0)]).toBe('B')

    // After F, the U sticker on R sits at the front — the bottom tab.
    const afterF = await faceletsAfter('F')
    expect(afterF[diagramFaceletIndex.right(2)]).toBe('U')
    expect(afterF[diagramFaceletIndex.right(0)]).toBe('R')

    // L and R turns leave F and L tabs; check they run with the diagram.
    const afterB = await faceletsAfter('B')
    expect(afterB[diagramFaceletIndex.left(0)]).toBe('U')
    const afterL = await faceletsAfter('L')
    expect(afterL[diagramFaceletIndex.front(0)]).toBe('U')
  })

  it('shows a fully oriented top for a solved cube', async () => {
    const solved = await faceletsAfter('')
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        expect(solved[diagramFaceletIndex.top(row, column)]).toBe('U')
      }
    }
    for (let position = 0; position < 3; position += 1) {
      expect(solved[diagramFaceletIndex.front(position)]).toBe('F')
      expect(solved[diagramFaceletIndex.right(position)]).toBe('R')
      expect(solved[diagramFaceletIndex.back(position)]).toBe('B')
      expect(solved[diagramFaceletIndex.left(position)]).toBe('L')
    }
  })
})

describe('colour scheme derivation', () => {
  it('reproduces the standard scheme for the two usual holds', () => {
    // White up, green front is the reference scheme every cube ships with.
    expect(schemeFor('white', 'green')).toEqual({ U: 'white', F: 'green', R: 'red', D: 'yellow', B: 'blue', L: 'orange' })
    // Flipping to yellow up keeps green in front, which puts orange on the right.
    expect(schemeFor('yellow', 'green')).toEqual({ U: 'yellow', F: 'green', R: 'orange', D: 'white', B: 'blue', L: 'red' })
  })

  it('derives a hold on any adjacent pair', () => {
    expect(schemeFor('red', 'white')).toEqual({ U: 'red', F: 'white', R: 'green', D: 'orange', B: 'yellow', L: 'blue' })
    expect(schemeFor('blue', 'yellow')).toEqual({ U: 'blue', F: 'yellow', R: 'orange', D: 'green', B: 'white', L: 'red' })
  })

  it('rejects holds a cube cannot take', () => {
    expect(schemeFor('white', 'white')).toBeNull()
    expect(schemeFor('white', 'yellow')).toBeNull()
    expect(schemeFor('red', 'orange')).toBeNull()
  })
})
