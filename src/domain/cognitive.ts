export type ColorInferencePrompt = {
  seed: string
  visible: [string, string]
  answer: string
}

const corners = [
  ['White', 'Green', 'Red'], ['White', 'Red', 'Blue'], ['White', 'Blue', 'Orange'], ['White', 'Orange', 'Green'],
  ['Yellow', 'Red', 'Green'], ['Yellow', 'Blue', 'Red'], ['Yellow', 'Orange', 'Blue'], ['Yellow', 'Green', 'Orange']
]

function hash(seed: string) {
  let value = 2166136261
  for (const character of seed) {
    value ^= character.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

export function generateColorInference(seed: string): ColorInferencePrompt {
  const corner = corners[hash(seed) % corners.length]
  const missing = hash(`${seed}:missing`) % corner.length
  const visible = corner.filter((_, index) => index !== missing) as [string, string]

  if (hash(`${seed}:order`) % 2) visible.reverse()

  return { seed, visible, answer: corner[missing] }
}

export function gradeColorInference(prompt: ColorInferencePrompt, answer: string) {
  return prompt.answer.toLowerCase() === answer.trim().toLowerCase()
}
