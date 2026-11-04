import { useEffect, useState, type ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { schemeFor, type StickerColor } from '../ui/LastLayerDiagram'
import { resetTrackedCubeToSolved, useCubeConnection } from '../../device/CubeConnection'
import { bluetoothSource } from '../../device/sources'
import { supportsWebBluetooth } from '../../device/webBluetooth'
import { repositories } from '../../storage/database'
import { downloadBackup, downloadCsTimerCsv, exportAllData, exportSessionAsCsTimerCsv } from '../../storage/transfer'
import { readPreferences, writePreference, type Preferences } from '../../storage/preferences'
import { parseAppSettings, type SettingsStore } from '../../domain/ao1k/settings'
import { Ao1kSettingsPanel } from '../ao1k/Ao1kSettingsPanel'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { PwaStatus } from '../PwaStatus'
import { DASH, PageHeader, Section, card, mono, pageFrame, primaryButton, secondaryButton, textInput } from '../ui/Page'

const COLOURS: StickerColor[] = ['white', 'yellow', 'green', 'blue', 'red', 'orange']

const ao1kStore: SettingsStore = {
  async read() {
    const record = await repositories.settings.get('ao1k-settings')
    return parseAppSettings(record?.value)
  },
  async write(settings) {
    await repositories.settings.put({ key: 'ao1k-settings', value: settings })
  }
}

const group = cx(card, css({ p: { base: '4', md: '5' }, display: 'flex', flexDirection: 'column', gap: '4' }))
const note = css({ fontSize: 'sm', color: 'inkVariant', maxW: '70ch' })

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4', py: '2', borderTopWidth: '1px', borderColor: 'floating', _first: { borderTopWidth: '0', pt: '0' } })}>
      <dt className={css({ color: 'inkVariant', fontSize: 'sm' })}>{label}</dt>
      <dd className={cx(mono, css({ m: '0', fontSize: 'sm', textAlign: 'right', minW: '0', overflowWrap: 'anywhere', color: value === DASH ? 'inkVariant' : 'ink' }))}>{value}</dd>
    </div>
  )
}

export function SettingsHub() {
  const cube = useCubeConnection()
  const [prefs, setPrefs] = useState<Preferences>()
  const [counts, setCounts] = useState<{ solves: number; stages: number; studies: number }>()
  const [busy, setBusy] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [diagnostics, setDiagnostics] = useState(false)
  const bluetooth = supportsWebBluetooth()

  useEffect(() => {
    void readPreferences().then(setPrefs).catch(() => undefined)
    void Promise.all([repositories.solves.all(), repositories.stages.all(), repositories.studies.all()])
      .then(([solves, stages, studies]) => setCounts({ solves: solves.length, stages: stages.length, studies: studies.length }))
      .catch(() => undefined)
  }, [])

  const setPref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    void writePreference(key, value).then(setPrefs)
  }

  const connect = () => {
    void cube.connect(bluetoothSource({ requestInitialState: true }))
      .catch((error: unknown) => cube.setStatus(error instanceof Error ? error.message : 'Could not connect to a cube'))
  }

  const invalidHold = prefs !== undefined && !schemeFor(prefs.diagramTopColor, prefs.diagramFrontColor)

  return (
    <div className={pageFrame}>
      <PageHeader title="Settings" description="Your cube, how solves are timed and shown, and the data kept on this device." />

      <Section id="cube" title="Cube">
        <div className={group}>
          <dl className={css({ m: '0' })}>
            <Row label="Device" value={cube.handle?.name || DASH} />
            <Row label="Protocol" value={cube.handle?.protocol || DASH} />
            <Row label="MAC address" value={cube.handle?.mac || DASH} />
            <Row label="Battery" value={cube.batteryLevel === undefined ? DASH : `${cube.batteryLevel}%`} />
            <Row label="Status" value={<span className={css({ fontFamily: 'sans' })}>{cube.status}</span>} />
          </dl>
          <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
            {cube.handle
              ? <button type="button" onClick={() => void cube.disconnect()} className={secondaryButton}>Disconnect</button>
              : <button type="button" onClick={connect} disabled={cube.connecting || !bluetooth} className={primaryButton}>{cube.connecting ? 'Connecting...' : 'Connect cube'}</button>}
            <button
              type="button"
              onClick={() => { void resetTrackedCubeToSolved().then(() => { cube.setStatus('Tracking restarted from solved'); setNotice('Tracking restarted. The app now treats your cube as solved.') }) }}
              className={secondaryButton}
            >Reset tracking</button>
          </div>
          <p className={note}>
            {bluetooth ? 'Reset tracking tells the app the cube in your hands is solved. Use it when the cube on screen no longer matches yours.' : 'This browser has no Web Bluetooth, so a smart cube cannot connect here. Chrome or Edge on desktop or Android can.'}
          </p>
          {notice && <p role="status" className={css({ fontSize: 'sm', color: 'green' })}>{notice}</p>}
        </div>
      </Section>

      <Section id="solving" title="Solving">
        <div className={group}>
          <label className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4', minH: '44px', cursor: 'pointer' })}>
            <span className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
              <span>WCA inspection</span>
              <span className={note}>15 second countdown before a keyboard timer solve, +2 after 15 seconds and DNF after 17.</span>
            </span>
            <input
              type="checkbox"
              checked={prefs?.wcaInspection ?? false}
              onChange={(event) => setPref('wcaInspection', event.target.checked)}
              className={css({ w: '5', h: '5', flexShrink: '0', accentColor: 'green', cursor: 'pointer', _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } })}
            />
          </label>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '3', pt: '4', borderTopWidth: '1px', borderColor: 'floating' })}>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
              <span>How you hold the cube</span>
              <span className={note}>The solve cube, replays and OLL and PLL diagrams are drawn from this hold. F2L previews keep standard colours.</span>
            </div>
            <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 10rem))', gap: '3' })}>
              {([['diagramTopColor', 'Top colour'], ['diagramFrontColor', 'Front colour']] as const).map(([key, label]) => (
                <label key={key} className={css({ display: 'flex', flexDirection: 'column', gap: '1.5', fontSize: 'sm', color: 'inkVariant' })}>
                  {label}
                  <select
                    value={prefs?.[key] ?? (key === 'diagramTopColor' ? 'yellow' : 'green')}
                    onChange={(event) => setPref(key, event.target.value as StickerColor)}
                    className={cx(textInput, css({ cursor: 'pointer', textTransform: 'capitalize' }))}
                  >
                    {COLOURS.map((colour) => <option key={colour} value={colour}>{colour[0].toUpperCase() + colour.slice(1)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {invalidHold && <p role="alert" className={css({ fontSize: 'sm', color: 'error' })}>A cube cannot be held with those two colours on top and front. Pick two faces that share an edge.</p>}
          </div>
        </div>
      </Section>

      <Section id="look" title="Cube look">
        <div className={group}>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '3' })}>
              <label htmlFor="playback-speed">Case playback speed</label>
              <span className={cx(mono, css({ fontSize: 'sm', color: 'green' }))}>{(prefs?.playbackSpeed ?? 1).toFixed(1)}x</span>
            </div>
            <input
              id="playback-speed"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={prefs?.playbackSpeed ?? 1}
              onChange={(event) => setPref('playbackSpeed', Number(event.target.value))}
              className={css({ w: 'full', minH: '44px', accentColor: 'green', cursor: 'pointer' })}
            />
            <span className={note}>How fast algorithm cases play back in the trainers.</span>
          </div>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '3', pt: '4', borderTopWidth: '1px', borderColor: 'floating' })}>
            <p className={note}>Colours and player options below are saved on this device. The 3D cubes in this app do not read them yet.</p>
            <Ao1kSettingsPanel store={ao1kStore} />
          </div>
        </div>
      </Section>

      <Section id="data" title="Data">
        <div className={group}>
          <PwaStatus />
          <p className={cx(mono, css({ fontSize: 'sm', color: 'inkVariant', pt: '4', borderTopWidth: '1px', borderColor: 'floating' }))}>
            {counts ? `${counts.solves} solves · ${counts.stages} stages · ${counts.studies} saved studies` : DASH}
          </p>
          <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
            <button
              type="button"
              disabled={busy !== undefined}
              onClick={() => {
                setBusy('export')
                void exportAllData().then(downloadBackup).finally(() => setBusy(undefined))
              }}
              className={secondaryButton}
            >{busy === 'export' ? 'Exporting...' : 'Export all data'}</button>
            <button
              type="button"
              disabled={busy !== undefined || counts?.solves === 0}
              onClick={() => {
                setBusy('cstimer')
                void exportSessionAsCsTimerCsv('default').then((csv) => downloadCsTimerCsv(csv, 'default')).finally(() => setBusy(undefined))
              }}
              className={secondaryButton}
            >{busy === 'cstimer' ? 'Exporting...' : 'Export solves for csTimer'}</button>
          </div>
          <p className={note}>The full export is a JSON backup of every solve, stage, study and setting. The csTimer file holds your solve times.</p>
        </div>
      </Section>

      <Section id="diagnostics" title="Diagnostics" description="Developer tools for checking the cube connection without guessing.">
        <details
          open={diagnostics}
          onToggle={(event) => setDiagnostics((event.currentTarget as HTMLDetailsElement).open)}
          className={card}
        >
          <summary className={css({
            display: 'flex', alignItems: 'center', minH: '44px', px: '4', cursor: 'pointer', fontSize: 'sm', fontWeight: 'medium', listStyle: 'none',
            _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '-2px' },
            '&::-webkit-details-marker': { display: 'none' }
          })}>
            {diagnostics ? 'Hide developer tools' : 'Show developer tools'}
          </summary>
          {diagnostics && <div className={css({ p: { base: '4', md: '5' }, borderTopWidth: '1px', borderColor: 'floating' })}><DiagnosticsPanel /></div>}
        </details>
      </Section>
    </div>
  )
}
