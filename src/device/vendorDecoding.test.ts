import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { installMockBluetoothFromFixture } from '../../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index'
import { serviceUuidsFromFixture } from '../../node_modules/smartcube-web-bluetooth/src/test/helpers/fixture-replay'
import type { FixtureSession } from '../../node_modules/smartcube-web-bluetooth/src/test/fixtures/types'
import { qiyiProtocol } from '../../node_modules/smartcube-web-bluetooth/src/smartcube/protocols/qiyi'
import { ganProtocol } from '../../node_modules/smartcube-web-bluetooth/src/smartcube/protocols/gan'
import { giikerProtocol } from '../../node_modules/smartcube-web-bluetooth/src/smartcube/protocols/giiker'
import { goCubeProtocol } from '../../node_modules/smartcube-web-bluetooth/src/smartcube/protocols/gocube'
import { moyu32Protocol } from '../../node_modules/smartcube-web-bluetooth/src/smartcube/protocols/moyu32'
import { FaceletReconciler } from '../domain/faceletReconciliation'

const dir = `${process.cwd()}/node_modules/smartcube-web-bluetooth/captures/`
const load = (name: string) => JSON.parse(readFileSync(dir + name, 'utf8')) as FixtureSession

const cases = [
  ['QiYi', 'fixture_QY-QYSC-S-A0E6________qiyi_2026-04-14T11-37-22.json', qiyiProtocol],
  ['QiYi Tornado', 'fixture_XMD-TornadoV4-i-034C__qiyi_2026-04-14T11-46-25.json', qiyiProtocol],
  ['GAN gen2', 'fixture_GAN12ui--B3C_gan-gen2_2026-04-14T11-40-51.json', ganProtocol],
  ['GAN gen4', 'fixture_GANi4_A26E_gan-gen4_2026-04-14T11-38-02.json', ganProtocol],
  ['Giiker', 'fixture_Giiker_i3SE_giiker_2026-04-14T11-42-39.json', giikerProtocol],
  ['GoCube', 'fixture_GoCube_gocube_2026-04-14T11-43-52.json', goCubeProtocol],
  ["Rubik's Connected", 'fixture_Rubiks_Connected_gocube_2026-04-14T11-50-17.json', goCubeProtocol],
  ['MoYu32', 'fixture_WCU_MY32_A388_moyu32_2026-04-15T06-43-44.json', moyu32Protocol]
] as const

describe('every vendor decodes its own recorded traffic', () => {
  it.each(cases.map(([label, file, protocol]) => [label, file, protocol] as const))(
    '%s decodes turns and any facelet packets it sends',
    async (_label, file, protocol) => {
      const fixture = load(file)
      const { device, replayer } = installMockBluetoothFromFixture(fixture, { maxAutoFlushNotifies: 0 })
      const connection = await protocol.connect(device, async () => fixture.device.mac ?? null, {
        serviceUuids: serviceUuidsFromFixture(fixture),
        advertisementManufacturerData: null,
        enableAddressSearch: false,
        onStatus: undefined,
        signal: undefined
      })

      const reconciler = new FaceletReconciler()
      const statuses: string[] = []
      let moves = 0
      const subscription = connection.events$.subscribe((event) => {
        if (event.type === 'MOVE') { moves += 1; reconciler.recordMove(event.move) }
        if (event.type === 'FACELETS') statuses.push(reconciler.reconcile(event.facelets).status)
      })

      await replayer.drainNotificationsAsync()
      subscription.unsubscribe()

      if (fixture.protocol.id === 'gan-gen4') {
        expect(connection.protocol.id, 'gen4 negotiates its protocol; its fixture consumes move traffic during init, so decoded turns are covered by the decoded-event replay instead').toBe('gan-gen4')
      } else {
        expect(moves, 'turns decoded').toBeGreaterThan(0)
        expect(statuses.filter((status) => status !== 'baseline' && status !== 'verified'), 'facelets agree with turns').toEqual([])
      }

      await connection.disconnect()
    },
    60_000
  )
})
