/**
 * Ported from hakatashi/smart-cube-timer (https://github.com/hakatashi/smart-cube-timer)
 * Source file: lib/MoveSequence.test.js
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
import MoveSequence from './moveSequence'
import {getRotationNotationFromFaces} from './smartCubeTimerUtils'

describe('MoveSequence', () => {
  describe('.fromScramble', () => {
    test('parse notation of rotation', () => {
      const sequence = MoveSequence.fromScramble('R L U D B F')
      expect(sequence.moves).toEqual([
        {face: 'R', amount: 1},
        {face: 'L', amount: 1},
        {face: 'U', amount: 1},
        {face: 'D', amount: 1},
        {face: 'B', amount: 1},
        {face: 'F', amount: 1},
      ])
    })

    test('parse notation of inverse rotation', () => {
      const sequence = MoveSequence.fromScramble("R' L' U' D' B' F'")
      expect(sequence.moves).toEqual([
        {face: 'R', amount: -1},
        {face: 'L', amount: -1},
        {face: 'U', amount: -1},
        {face: 'D', amount: -1},
        {face: 'B', amount: -1},
        {face: 'F', amount: -1},
      ])
    })

    test('parse notation of double rotation', () => {
      const sequence = MoveSequence.fromScramble('R2 L2 U2 D2 B2 F2')
      expect(sequence.moves).toEqual([
        {face: 'R', amount: 2},
        {face: 'L', amount: 2},
        {face: 'U', amount: 2},
        {face: 'D', amount: 2},
        {face: 'B', amount: 2},
        {face: 'F', amount: 2},
      ])
    })
  })

  describe('#toString', () => {
    test('without cross/rouxBlock', () => {
      const sequence = MoveSequence.fromScramble('R L U D B F')
      expect(sequence.toString()).toEqual('R L U D B F')
    })

    test('with cross R', () => {
      const sequence = MoveSequence.fromScramble('R L U D B F')
      expect(sequence.toString({cross: 'R'})).toEqual('D U R L B F')
    })

    test('with cross U', () => {
      const sequence = MoveSequence.fromScramble('R L U D B F')
      // front face should be F
      expect(sequence.toString({cross: 'U'})).toEqual('L R D U B F')
    })

    test('with rouxBlock B-L-L', () => {
      const sequence = MoveSequence.fromScramble('R L U D F')
      expect(
        sequence.toString({
          rouxBlock: {side: 'B', bottomDirection: 'L'},
          fixDirection: true,
        }),
      ).toEqual('U D F B R')
    })

    test('with rouxBlock B-L-L and left move', () => {
      const sequence1 = MoveSequence.fromScramble('B R L U D F')
      expect(
        sequence1.toString({
          rouxBlock: {side: 'B', bottomDirection: 'L'},
          fixDirection: true,
        }),
      ).toEqual('r B F U D R')

      const sequence2 = MoveSequence.fromScramble("B' R L U D F")
      expect(
        sequence2.toString({
          rouxBlock: {side: 'B', bottomDirection: 'L'},
          fixDirection: true,
        }),
      ).toEqual("r' F B D U R")
    })

    test('with slices [M]', () => {
      const sequence1 = MoveSequence.fromScramble("R L' U R' L U R' L U L' R")
      expect(sequence1.toString({slices: ['M']})).toEqual("M F M' U M' B M")

      const sequence2 = MoveSequence.fromScramble("R L' R L' R L' R L' R L'")
      expect(sequence2.toString({slices: ['M']})).toEqual('M2 M2 M')

      const sequence3 = MoveSequence.fromScramble("R2 L' R L2'")
      expect(sequence3.toString({slices: ['M']})).toEqual("R M2 L'")

      const sequence4 = MoveSequence.fromScramble("R2 L2' R2' L2")
      expect(sequence4.toString({slices: ['M']})).toEqual("M2 M2'")

      const sequence5 = MoveSequence.fromScramble("L' R2 L2' R2 L2' R")
      expect(sequence5.toString({slices: ['M']})).toEqual('M2 M2 M')

      const sequence6 = MoveSequence.fromScramble("L' R2 L2' U R2 L2' R")
      expect(sequence6.toString({slices: ['M']})).toEqual("M2 L' D M2 R")
    })

    test('with slices [M, S] and cross R', () => {
      // https://alg.cubing.net/?alg=U-_D_F_L_R-_D-
      // https://alg.cubing.net/?alg=z_M-_U_S_U-_x2_y
      const sequence = MoveSequence.fromScramble("U' D F L R' D'")
      const {text, orientation} = sequence.toText({slices: ['M', 'S'], cross: 'R'})
      expect(text).toEqual("M' U S U'")
      expect(getRotationNotationFromFaces({from: [orientation.left, orientation.down], to: ['L', 'D']})).toEqual('x2 y')
    })
  })
})
