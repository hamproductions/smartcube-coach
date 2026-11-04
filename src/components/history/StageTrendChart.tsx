import { useEffect, useId, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { DASH } from '../ui/Page'

export type StagePoint = { solveId: string; values: Array<number | undefined> }
export type StageSeries = { label: string; colour: string }

const HEIGHT = 220
const PAD = { top: 12, right: 12, bottom: 24, left: 40 }

const axisText = css({ fill: 'outline', fontFamily: 'mono' })
const axisLabel = css({ fill: 'outline', fontFamily: 'sans' })

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const secs = (ms: number) => (ms / 1000).toFixed(2)

function scale(maxMs: number) {
  const seconds = maxMs / 1000
  const step = seconds <= 4 ? 1 : seconds <= 8 ? 2 : seconds <= 20 ? 5 : seconds <= 40 ? 10 : 20
  const ticks = Math.max(1, Math.ceil(seconds / step))
  return { stepMs: step * 1000, ticks }
}

export function recentChange(values: Array<number | undefined>) {
  const measured = values.filter((value): value is number => value !== undefined)
  if (measured.length === 0) return undefined
  const recent = measured.slice(-5)
  const before = measured.slice(-10, -5)
  return { recent: mean(recent), count: recent.length, delta: before.length === 5 && recent.length === 5 ? mean(recent) - mean(before) : undefined }
}

export function StageTrendChart({ title, series, points }: { title: string; series: StageSeries[]; points: StagePoint[] }) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const element = host.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const all = points.flatMap((point) => point.values).filter((value): value is number => value !== undefined)
  const { stepMs: step, ticks } = scale(all.length ? Math.max(...all) : 1000)
  const top = step * ticks
  const innerW = width - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW)
  const y = (value: number) => PAD.top + innerH - (value / top) * innerH

  const paths = series.map((_, seriesIndex) => {
    let path = ''
    let drawing = false
    points.forEach((point, index) => {
      const value = point.values[seriesIndex]
      if (value === undefined) { drawing = false; return }
      path += `${drawing ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)} `
      drawing = true
    })
    return path.trim()
  })

  const changes = series.map((_, seriesIndex) => recentChange(points.map((point) => point.values[seriesIndex])))
  const description = series.map((entry, index) => {
    const change = changes[index]
    if (!change) return `${entry.label}: no timings`
    const trend = change.delta === undefined ? '' : change.delta < 0 ? `, ${secs(-change.delta)}s faster than the 5 before` : `, ${secs(change.delta)}s slower than the 5 before`
    return `${entry.label} averages ${secs(change.recent)}s over the last ${change.count}${trend}`
  }).join('. ')

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      <ul className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: '3', listStyle: 'none', m: '0', p: '0' })}>
        {series.map((entry, index) => {
          const change = changes[index]
          return (
            <li key={entry.label} className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
              <span className={css({ display: 'flex', alignItems: 'center', gap: '1.5', fontSize: 'xs', color: 'inkVariant' })}>
                <span aria-hidden className={css({ w: '2.5', h: '2.5', borderRadius: 'pill', flexShrink: '0' })} style={{ background: entry.colour }} />
                {entry.label}{changes[index] ? `, last ${changes[index]!.count}` : ''}
              </span>
              <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontSize: 'lg' })}>
                {change ? `${secs(change.recent)}s` : DASH}
                {change?.delta !== undefined && (
                  <span className={change.delta <= 0 ? css({ ml: '1.5', fontSize: 'xs', color: 'green' }) : css({ ml: '1.5', fontSize: 'xs', color: 'error' })}>
                    {change.delta <= 0 ? '-' : '+'}{secs(Math.abs(change.delta))}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <div ref={host} className={css({ w: 'full', minW: '0' })}>
        <svg width={width} height={HEIGHT} role="img" aria-labelledby={`${titleId} ${descId}`} className={css({ display: 'block', maxW: 'full', overflow: 'visible' })}>
          <title id={titleId}>{title}</title>
          <desc id={descId}>{description}</desc>
          {Array.from({ length: ticks + 1 }, (_, tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick * step)} y2={y(tick * step)} strokeWidth={1} className={css({ stroke: 'floating' })} />
              <text x={PAD.left - 8} y={y(tick * step)} dy="0.32em" textAnchor="end" fontSize={11} className={axisText}>{(tick * step / 1000).toFixed(0)}s</text>
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 6} fontSize={11} className={axisLabel}>older</text>
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" fontSize={11} className={axisLabel}>latest</text>
          {paths.map((path, index) => path && (
            <path key={series[index].label} d={path} fill="none" stroke={series[index].colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {points.length <= 24 && points.map((point, index) => point.values.map((value, seriesIndex) => value === undefined ? null : (
            <circle key={`${point.solveId}-${seriesIndex}`} cx={x(index)} cy={y(value)} r={2.5} fill={series[seriesIndex].colour} />
          )))}
        </svg>
      </div>
    </div>
  )
}
