/**
 * Ported from hakatashi/smart-cube-timer (https://github.com/hakatashi/smart-cube-timer)
 * Source file: lib/utils.test.js (getRotationNotationFromFaces/
 * getRelativeFaceFromFaces/getOrientation fixtures ported verbatim; the
 * source's findRouxBlock fixtures used cubesolv.es algs containing whole-cube
 * rotations (x/y/z), wide moves (r), and slice moves (M2) that this repo's
 * only move-application primitive -- `cubeMath.turn`, whose regex is
 * `^([URFDLB])(2|')?$` -- does not support, so those specific fixtures could
 * not be reproduced; a face-turn-only sanity check is substituted instead)
 *
 * MIT License
 *
 * Copyright (c) 2018 Koki Takahashi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {describe, expect, test} from 'vitest'
import {turn, solvedCube} from './cubeMath'
import {findRouxBlock, getOrientation, getRelativeFaceFromFaces, getRotationNotationFromFaces} from './smartCubeTimerUtils'

function decodeForRouxBlock(cube: ReturnType<typeof solvedCube>) {
  const ca = (cube as unknown as {ca: number[]}).ca
  const ea = (cube as unknown as {ea: number[]}).ea
  return {
    cp: ca.map((v) => v & 7),
    co: ca.map((v) => v >> 3),
    ep: ea.map((v) => v >> 1),
    eo: ea.map((v) => v & 1),
    isSolved: () => false,
  }
}

function applyAlg(alg: string) {
  let cube = solvedCube()
  for (const move of alg.split(' ')) {
    cube = turn(cube, move)
  }
  return cube
}

describe('smartCubeTimerUtils', () => {
  describe('getRotationNotationFromFaces', () => {
    test('works', () => {
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['U', 'F']})).toEqual('y')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['U', 'L']})).toEqual('y2')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['U', 'B']})).toEqual("y'")
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['B', 'R']})).toEqual('x')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['D', 'R']})).toEqual('x2')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['F', 'R']})).toEqual("x'")
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['R', 'D']})).toEqual('z')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['D', 'L']})).toEqual('x2 y2')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['L', 'U']})).toEqual("z'")
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['R', 'F']})).toEqual('x y')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['F', 'L']})).toEqual('x y2')
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['L', 'B']})).toEqual("x y'")
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['L', 'F']})).toEqual("x' y")
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['B', 'L']})).toEqual("x' y2")
      expect(getRotationNotationFromFaces({from: ['U', 'R'], to: ['R', 'B']})).toEqual("x' y'")
      expect(getRotationNotationFromFaces({from: ['R', 'U'], to: ['D', 'L']})).toEqual('z y2')
      expect(getRotationNotationFromFaces({from: ['U', 'D'], to: ['R', 'L']})).toEqual('z')
    })
  })

  describe('getRelativeFaceFromFaces', () => {
    test('works', () => {
      expect(getRelativeFaceFromFaces('U', {from: ['U', 'R'], to: ['B', 'L']})).toEqual('B')
      expect(getRelativeFaceFromFaces('R', {from: ['U', 'R'], to: ['B', 'L']})).toEqual('L')
      expect(getRelativeFaceFromFaces('F', {from: ['U', 'R'], to: ['B', 'L']})).toEqual('D')
      expect(getRelativeFaceFromFaces('D', {from: ['U', 'R'], to: ['B', 'L']})).toEqual('F')
      expect(getRelativeFaceFromFaces('L', {from: ['U', 'R'], to: ['B', 'L']})).toEqual('R')
      expect(getRelativeFaceFromFaces('B', {from: ['U', 'R'], to: ['B', 'L']})).toEqual('U')
    })
  })

  describe('getOrientation', () => {
    test('works', () => {
      expect(getOrientation({from: 'U', to: 'R'})).toEqual({left: 'D', down: 'R'})
      expect(getOrientation({from: 'U', to: 'B'})).toEqual({left: 'L', down: 'B'})
      expect(getOrientation({from: 'U', to: 'U'})).toEqual({left: 'L', down: 'D'})
      expect(getOrientation({from: 'U', to: 'D'})).toEqual({left: 'R', down: 'U'})
    })
  })

  describe('findRouxBlock', () => {
    test('solved cube trivially satisfies a first block', () => {
      const cube = solvedCube()
      expect(findRouxBlock(decodeForRouxBlock(cube))).not.toBeNull()
    })

    test('cube with no 2x3 block on any face reports null', () => {
      const cube = applyAlg("R U2 F' L2 D2 B' U2 R2 F2 D' F U' L D' F2 R' B D' L2")
      expect(findRouxBlock(decodeForRouxBlock(cube))).toBeNull()
    })
  })
})
