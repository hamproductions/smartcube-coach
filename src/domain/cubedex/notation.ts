/**
 * Ported from poliva/cubedex (MIT licensed).
 * Source: src/lib/storage.ts (expandNotation)
 * Copyright (c) 2024 Pau Oliva Fora
 */

export function expandNotation(input: string): string {
  let output = input.replace(/["´`‘]/g, "'")
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/XYZ/g, 'xyz')

  output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '')

  output = output.replace(/\(/g, ' (')

  output = output.replace(/\)(?!\s)/g, ') ')

  output = output.replace(/'(?![\s)])/g, "' ")

  output = output.replace(/2(?![\s')])/g, '2 ')

  output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ')

  output = output.replace(/(\s)(?=2)/g, '')

  output = output.replace(/'2/g, "2'")

  output = output.replace(/\s+/g, ' ')

  return output.trim()
}
