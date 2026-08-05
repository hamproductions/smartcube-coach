const macPattern = /^([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})[:-]?([0-9a-f]{2})$/

export function normalizeCubeMac(input: string): string {
  const match = macPattern.exec(input.trim().toLowerCase().replaceAll(/\s+/g, ''))
  if (!match) throw new Error('Enter a cube MAC address as six hex bytes, for example CC:A3:00:00:23:C0')
  return match.slice(1).join(':').toUpperCase()
}

const prefixes: Array<[RegExp, string[]]> = [
  [/^QY-QYSC-A/i, ['CC:A2:00:00']],
  [/^QY-QYSC-S/i, ['CC:A3:00:00', 'CC:A3:00:01']],
  [/^QY-QYSC/i, ['CC:A3:00:00', 'CC:A3:00:01', 'CC:A2:00:00']],
  [/^XMD-Tornado/i, ['CC:A6:00:00']]
]

export function cubeMacCandidatesFromName(deviceName: string): string[] {
  const name = deviceName.trim()
  const qiyiA = /^QY-QYSC-A-([0-9A-Fa-f]{4})$/.exec(name)
  if (qiyiA) return [`CC:A2:00:00:${qiyiA[1].slice(0, 2)}:${qiyiA[1].slice(2, 4)}`.toUpperCase()]

  const qiyiS = /^QY-QYSC-S-([0-9A-Fa-f]{4})$/.exec(name)
  if (qiyiS) {
    const tail = `${qiyiS[1].slice(0, 2)}:${qiyiS[1].slice(2, 4)}`.toUpperCase()
    return [`CC:A3:00:00:${tail}`, `CC:A3:00:01:${tail}`]
  }

  const tornado = /^XMD-TornadoV4-i-([0-9A-Fa-f]{4})$/.exec(name)
  if (tornado) return [`CC:A6:00:00:${tornado[1].slice(0, 2)}:${tornado[1].slice(2, 4)}`.toUpperCase()]

  const trailing = /([0-9A-Fa-f]{4})[^0-9A-Fa-f]*$/.exec(name)
  if (!trailing) return []
  const tail = `${trailing[1].slice(0, 2)}:${trailing[1].slice(2, 4)}`.toUpperCase()
  for (const [pattern, bases] of prefixes) {
    if (pattern.test(name)) return bases.map((base) => `${base}:${tail}`)
  }

  return []
}
