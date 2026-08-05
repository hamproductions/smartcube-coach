import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { schemeFor, type StickerColor } from '../ui/LastLayerDiagram'
import { styled } from 'styled-system/jsx'
import { useCubeConnection } from '../../device/CubeConnection'
import { repositories } from '../../storage/database'
import { downloadBackup, exportAllData } from '../../storage/transfer'
import { readPreferences, writePreference, type Preferences } from '../../storage/preferences'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { PwaStatus } from '../PwaStatus'

// Ported from docs/design/stitch/settings_device_hub/code.html: a header, then a
// two-column grid of bordered cards. Only the cards whose values this app can actually
// measure or act on are here — the export's firmware, signal-strength and inspection
// controls have nothing behind them yet, and a control that changes nothing is worse
// than an absent one. Unmeasurable rows render as a dash rather than a plausible number.

const Card = styled('section', {
  base: {
    bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card',
    p: '6', display: 'flex', flexDirection: 'column'
  }
})

const CardTitle = styled('h2', {
  base: { fontSize: 'md', fontWeight: 'bold', color: 'ink' }
})

const Inset = styled('div', {
  base: {
    bg: 'surface', borderWidth: '1px', borderColor: 'floating', borderRadius: 'control',
    p: '4', display: 'flex', flexDirection: 'column', gap: '2'
  }
})

const Action = styled('button', {
  base: {
    w: 'full', minH: '48px', px: '4', borderRadius: 'control',
    borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'ink',
    cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
    letterSpacing: '0.12em', textTransform: 'uppercase',
    _hover: { bg: 'floating' }
  },
  variants: {
    danger: { true: { borderColor: 'error', color: 'error', _hover: { bg: 'rgba(255,180,171,0.12)' } } }
  }
})

const DASH = '—'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4', fontFamily: 'mono', fontSize: 'sm' })}>
      <span className={css({ color: 'inkVariant' })}>{label}</span>
      <span className={css({ color: value === DASH ? 'inkVariant' : 'ink', textAlign: 'right' })}>{value}</span>
    </div>
  )
}

export function SettingsHub() {
  const cube = useCubeConnection()
  const [prefs, setPrefs] = useState<Preferences>()
  const [counts, setCounts] = useState<{ solves: number; stages: number }>()
  const [busy, setBusy] = useState<string>()

  useEffect(() => {
    void readPreferences().then(setPrefs).catch(() => undefined)
    void Promise.all([repositories.solves.all(), repositories.stages.all()])
      .then(([solves, stages]) => setCounts({ solves: solves.length, stages: stages.length }))
      .catch(() => undefined)
  }, [])

  const setPref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    void writePreference(key, value).then(setPrefs)
  }

  return (
    <div className={css({ flex: '1', minH: '0', overflowY: 'auto', p: '8' })}>
      <div className={css({ maxW: '1024px', mx: 'auto' })}>
        <header className={css({ mb: '8', pb: '4', borderBottomWidth: '1px', borderColor: 'floating' })}>
          <h1 className={css({ fontSize: '2xl', fontWeight: 'semibold', color: 'ink', letterSpacing: '-0.02em' })}>Settings &amp; Device Hub</h1>
          <p className={css({ mt: '2', color: 'inkVariant' })}>Manage your smart cube connection, playback, and data.</p>
        </header>

        <div className={css({ display: 'grid', gap: 'gutter', gridTemplateColumns: '1fr', lg: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } })}>
          <Card>
            <CardTitle className={css({ mb: '6' })}>Cube Connection</CardTitle>
            <Inset>
              <Row label="Device" value={cube.handle?.name ?? DASH} />
              <Row label="Protocol" value={cube.handle?.protocol ?? DASH} />
              <Row label="MAC address" value={cube.handle?.mac ?? DASH} />
              <Row label="Battery" value={cube.batteryLevel === undefined ? DASH : `${cube.batteryLevel}%`} />
              <Row label="Status" value={cube.status} />
            </Inset>
            <p className={css({ mt: '3', fontSize: 'xs', color: 'inkVariant' })}>
              Firmware and signal strength are not exposed over this protocol, so they are not shown.
            </p>
            <div className={css({ mt: 'auto', pt: '6' })}>
              <Action
                type="button"
                disabled={cube.connecting}
                onClick={() => { if (cube.handle) void cube.disconnect() }}
              >{cube.handle ? 'Disconnect' : 'Not connected'}</Action>
            </div>
          </Card>

          <Card>
            <CardTitle className={css({ mb: '6' })}>Solve preferences</CardTitle>
            {/* The export ships these toggles; this one is wired because the cockpit's
                keyboard timer already implements WCA inspection (handleSpaceUp takes a
                useInspection flag). Toggles with nothing behind them are not shown. */}
            <label className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4', cursor: 'pointer' })}>
              <span>
                <span className={css({ display: 'block', color: 'ink' })}>WCA inspection</span>
                <span className={css({ display: 'block', mt: '1', fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>15-second countdown before the solve</span>
              </span>
              <input
                type="checkbox"
                aria-label="WCA inspection"
                checked={prefs?.wcaInspection ?? false}
                onChange={(event) => setPref('wcaInspection', event.target.checked)}
                className={css({ w: '5', h: '5', accentColor: 'green', cursor: 'pointer' })}
              />
            </label>

            {/* Last-layer diagrams are drawn from the hold you actually use — a solver with
                white on top is looking at a different case if the diagram assumes yellow.
                F2L-family previews come from cubing.js, which has no colour-scheme API, so
                they keep its fixed scheme; the label says so rather than overclaiming. */}
            <div className={css({ mt: '6', display: 'flex', gap: '4', flexWrap: 'wrap' })}>
              {([['diagramTopColor', 'Top colour'], ['diagramFrontColor', 'Front colour']] as const).map(([key, label]) => (
                <label key={key} className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
                  <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{label}</span>
                  <select
                    aria-label={label}
                    value={prefs?.[key] ?? (key === 'diagramTopColor' ? 'yellow' : 'green')}
                    onChange={(event) => setPref(key, event.target.value as StickerColor)}
                    className={css({
                      minH: '40px', px: '3', borderRadius: 'control', bg: 'container', color: 'ink',
                      borderWidth: '1px', borderColor: 'floating', cursor: 'pointer', fontSize: 'sm'
                    })}
                  >
                    {(['white', 'yellow', 'green', 'blue', 'red', 'orange'] as StickerColor[]).map((colour) => (
                      <option key={colour} value={colour}>{colour}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className={css({ mt: '2', fontSize: 'xs', color: 'inkVariant' })}>
              Applies to OLL and PLL diagrams. F2L previews are rendered by cubing.js, which
              has no colour-scheme setting, so they keep its standard colours.
            </p>
            {prefs && !schemeFor(prefs.diagramTopColor, prefs.diagramFrontColor) && (
              <p className={css({ mt: '2', fontSize: 'xs', color: 'error' })}>
                A cube cannot be held with those two colours adjacent — pick faces that meet at an edge.
              </p>
            )}
          </Card>

          <Card>
            <CardTitle className={css({ mb: '6' })}>Playback</CardTitle>
            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '2' })}>
              <span className={css({ color: 'ink' })}>Playback speed</span>
              <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'green' })}>{(prefs?.playbackSpeed ?? 1).toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              aria-label="Playback speed"
              value={prefs?.playbackSpeed ?? 1}
              onChange={(event) => setPref('playbackSpeed', Number(event.target.value))}
              className={css({ w: 'full', accentColor: 'green', cursor: 'pointer' })}
            />
            <div className={css({ display: 'flex', justifyContent: 'space-between', mt: '1', fontFamily: 'mono', fontSize: '2xs', color: 'inkVariant' })}>
              <span>0.5x</span>
              <span>2.0x</span>
            </div>
            <p className={css({ mt: '4', fontSize: 'xs', color: 'inkVariant' })}>
              Applies to case playback in Training.
            </p>
          </Card>

          <Card>
            <CardTitle className={css({ mb: '6' })}>Data Management</CardTitle>
            <Inset className={css({ flexDirection: 'row', alignItems: 'center', gap: '4' })}>
              <div className={css({ display: 'flex', flexDirection: 'column' })}>
                <span className={css({ color: 'ink' })}>Local storage</span>
                <span className={css({ mt: '1', fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant' })}>
                  {counts ? `${counts.solves} solves · ${counts.stages} stages` : DASH}
                </span>
              </div>
            </Inset>
            <div className={css({ mt: 'auto', pt: '6', display: 'flex', flexDirection: 'column', gap: '4' })}>
              <Action
                type="button"
                onClick={() => {
                  setBusy('export')
                  void exportAllData().then(downloadBackup).finally(() => setBusy(undefined))
                }}
              >{busy === 'export' ? 'Exporting…' : 'Export all data'}</Action>
              <Action type="button" danger disabled>Delete all data</Action>
              <p className={css({ fontSize: 'xs', color: 'inkVariant' })}>
                Deletion is disabled until it has a confirmation step — it would destroy every recorded solve.
              </p>
            </div>
          </Card>
        </div>

        <section className={css({ mt: '10' })}>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold', color: 'ink', mb: '2' })}>Storage</h2>
          <p className={css({ color: 'inkVariant', mb: '4' })}>Local-first storage quota, and the browser permission that stops it being evicted.</p>
          <PwaStatus />
        </section>

        <section className={css({ mt: '10' })}>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold', color: 'ink', mb: '2' })}>Diagnostics</h2>
          <p className={css({ color: 'inkVariant', mb: '6' })}>Live state and telemetry from the connected cube.</p>
          <DiagnosticsPanel />
        </section>
      </div>
    </div>
  )
}
