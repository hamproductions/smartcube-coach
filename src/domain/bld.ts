export type BldDrill = {
  seed: string
  permutation: string[]
  cycles: string[][]
  memo: string
  parity: boolean
}

const edgeLetters = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')

function hash(seed: string) {
  let value = 2166136261
  for (const character of seed) {
    value ^= character.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function random(seed: string) {
  let state = hash(seed)
  return () => {
    state = Math.imul(1664525, state) + 1013904223 >>> 0
    return state / 2 ** 32
  }
}

export function generateBldDrill(seed: string, buffer = 'A'): BldDrill {
  const rng = random(seed)
  const permutation = edgeLetters.filter((letter) => letter !== buffer)
  for (let index = permutation.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    ;[permutation[index], permutation[swap]] = [permutation[swap], permutation[index]]
  }
  const cycleLength = 8 + Math.floor(rng() * 5)
  const cycle = [buffer, ...permutation.slice(0, cycleLength), buffer]
  const memoLetters = cycle.slice(1, -1)
  const memo = memoLetters.reduce<string[]>((pairs, letter, index) => {
    if (index % 2 === 0) pairs.push(letter)
    else pairs[pairs.length - 1] += letter
    return pairs
  }, []).join(' ')
  return {
    seed,
    permutation,
    cycles: [cycle],
    memo,
    parity: memoLetters.length % 2 === 1
  }
}

export function validateMemo(drill: BldDrill, input: string) {
  return input.replaceAll(/\s+/g, '').toUpperCase() === drill.memo.replaceAll(/\s+/g, '')
}
