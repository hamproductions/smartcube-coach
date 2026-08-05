export type { SmartCubeConnection, SmartCubeEvent } from '../../node_modules/smartcube-web-bluetooth/src/index'
export { CubieCube, SOLVED_FACELET } from '../../node_modules/smartcube-web-bluetooth/src/smartcube/cubie-cube'
export type { FixtureSession } from '../../node_modules/smartcube-web-bluetooth/src/test/fixtures/types'
export { installMockBluetoothFromFixture } from '../../node_modules/smartcube-web-bluetooth/src/test/bluetooth-mock/index'

export async function loadSmartCubeApi() {
  return import('../../node_modules/smartcube-web-bluetooth/src/index')
}
