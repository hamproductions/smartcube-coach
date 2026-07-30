import { parseHTML } from 'linkedom'

export type RecoStage = {
  label: string
  alg: string
  moves: string[]
}

export type RecoReconstruction = {
  id: string
  sourceUrl: string
  algUrl?: string
  solver: string
  result: string
  puzzle: string
  subtitle: string
  date?: string
  reconstructor?: string
  scramble: string
  reconstruction: string
  moves: string[]
  stages: RecoStage[]
  stats: Record<string, Record<string, string>>
  videoUrl?: string
}

const moveTokens = (alg: string) => alg.trim().split(/\s+/).filter(Boolean)

export function normalizeRecoUrl(input: string): string {
  const candidate = /^[a-z]+:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`
  let url: URL

  try {
    url = new URL(candidate)
  } catch {
    throw new Error('Invalid reco.nz solve URL')
  }

  const match = url.pathname.match(/^\/solve\/(\d+)\/?$/)
  if (!['reco.nz', 'www.reco.nz'].includes(url.hostname.toLowerCase()) || !match) {
    throw new Error('Invalid reco.nz solve URL')
  }

  return `https://reco.nz/solve/${match[1]}`
}

export function parseRecoHtml(html: string, inputUrl: string): RecoReconstruction {
  const sourceUrl = normalizeRecoUrl(inputUrl)
  const { document } = parseHTML(html)
  const heading = document.querySelector('.container > h1')?.textContent?.trim() ?? ''
  const headingMatch = heading.match(/^(.*?)\s+-\s+(.+?)\s+(3x3|4x4|5x5|6x6|7x7|OH|SQ1)\s+solve$/i)
  const subtitle = document.querySelector('.container > h3')?.textContent?.trim() ?? ''
  const reconstruction = document.querySelector('#reconstruction')?.textContent?.trim() ?? ''
  const algLink = Array.from(document.querySelectorAll('a')).find((link) => link.textContent?.trim() === 'alg.cubing.net')
  const algUrl = algLink?.getAttribute('href') ?? undefined
  const algParams = algUrl ? new URL(algUrl).searchParams : undefined
  const lines = reconstruction.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const scramble = algParams?.get('setup')?.trim() || lines[0] || ''
  const reconstructionLines = lines.slice(1)
  const stages = reconstructionLines.map((line) => {
    const [algPart, ...labelParts] = line.split('//')
    const alg = algPart.trim()
    return {
      label: labelParts.join('//').trim() || 'unlabeled',
      alg,
      moves: moveTokens(alg)
    }
  })
  const moves = stages
    .filter((stage) => stage.label.toLowerCase() !== 'inspection')
    .flatMap((stage) => stage.moves)
  const statsTable = document.querySelector('#solvestats')
  const rows = statsTable ? Array.from(statsTable.querySelectorAll('tr')) : []
  const headers = rows[0]
    ? Array.from(rows[0].querySelectorAll('th, td')).map((cell) => cell.textContent?.trim() ?? '').filter(Boolean)
    : []
  const stats: Record<string, Record<string, string>> = {}

  for (const row of rows.slice(1)) {
    const cells = Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent?.trim() ?? '')
    const name = cells[0]
    if (!name) continue
    stats[name] = Object.fromEntries(headers.map((header, index) => [header, cells[index + 1] ?? '']))
  }

  return {
    id: sourceUrl.split('/').at(-1) ?? '',
    sourceUrl,
    algUrl,
    solver: headingMatch?.[1]?.trim() ?? heading,
    result: headingMatch?.[2]?.trim() ?? '',
    puzzle: headingMatch?.[3]?.trim() ?? '',
    subtitle,
    date: subtitle.match(/\d{4}-\d{2}-\d{2}/)?.[0],
    reconstructor: document.querySelector('.container > h3 a:last-of-type')?.textContent?.trim() || undefined,
    scramble,
    reconstruction: reconstructionLines.join('\n'),
    moves,
    stages,
    stats,
    videoUrl: document.querySelector('iframe')?.getAttribute('src') || undefined
  }
}
