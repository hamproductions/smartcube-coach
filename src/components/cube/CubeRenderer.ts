import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export type CubeColours = Record<'U' | 'D' | 'F' | 'B' | 'R' | 'L', string>

export const DEFAULT_CUBE_COLOURS: CubeColours = {
  U: '#f4f4f0',
  D: '#ffd500',
  F: '#00a651',
  B: '#0b5bd3',
  R: '#d1202a',
  L: '#ff6a13'
}

type Axis = 'x' | 'y' | 'z'
type Turn = { axis: Axis; layers: number[]; quarter: number }
type Cubie = { mesh: THREE.Group; home: THREE.Vector3; stickers: Array<{ mesh: THREE.Mesh; face: keyof CubeColours }> }
type Animation = { turn: Turn; pivot: THREE.Group; cubies: Cubie[]; start: number; duration: number }

const FACE_TURNS: Record<string, { axis: Axis; layers: number[]; sign: number }> = {
  R: { axis: 'x', layers: [1], sign: -1 },
  L: { axis: 'x', layers: [-1], sign: 1 },
  M: { axis: 'x', layers: [0], sign: 1 },
  U: { axis: 'y', layers: [1], sign: -1 },
  D: { axis: 'y', layers: [-1], sign: 1 },
  E: { axis: 'y', layers: [0], sign: 1 },
  F: { axis: 'z', layers: [1], sign: -1 },
  B: { axis: 'z', layers: [-1], sign: 1 },
  S: { axis: 'z', layers: [0], sign: -1 },
  x: { axis: 'x', layers: [-1, 0, 1], sign: -1 },
  y: { axis: 'y', layers: [-1, 0, 1], sign: -1 },
  z: { axis: 'z', layers: [-1, 0, 1], sign: -1 }
}

const WIDE: Record<string, string> = { r: 'R', l: 'L', u: 'U', d: 'D', f: 'F', b: 'B' }

export function parseTurn(token: string): Turn | undefined {
  const match = /^([RLUDFBMESxyzrludfb])(w?)(\d*)('?)$/.exec(token.trim())
  if (!match) return undefined
  const [, letter, wide, amount, prime] = match
  const base = WIDE[letter] ?? letter
  const spec = FACE_TURNS[base]
  if (!spec) return undefined
  const layers = wide || WIDE[letter] ? [...spec.layers, 0] : spec.layers
  const count = (Number(amount || '1') % 4) * (prime ? -1 : 1)
  return { axis: spec.axis, layers, quarter: spec.sign * count }
}

const AXES: Record<Axis, THREE.Vector3> = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

function roundedSquare(size: number, radius: number) {
  const half = size / 2
  const shape = new THREE.Shape()
  shape.moveTo(-half + radius, -half)
  shape.lineTo(half - radius, -half)
  shape.quadraticCurveTo(half, -half, half, -half + radius)
  shape.lineTo(half, half - radius)
  shape.quadraticCurveTo(half, half, half - radius, half)
  shape.lineTo(-half + radius, half)
  shape.quadraticCurveTo(-half, half, -half, half - radius)
  shape.lineTo(-half, -half + radius)
  shape.quadraticCurveTo(-half, -half, -half + radius, -half)
  return new THREE.ShapeGeometry(shape, 6)
}

const STICKER_FACES: Array<{ face: keyof CubeColours; normal: THREE.Vector3; test: (p: THREE.Vector3) => boolean }> = [
  { face: 'R', normal: new THREE.Vector3(1, 0, 0), test: (p) => p.x === 1 },
  { face: 'L', normal: new THREE.Vector3(-1, 0, 0), test: (p) => p.x === -1 },
  { face: 'U', normal: new THREE.Vector3(0, 1, 0), test: (p) => p.y === 1 },
  { face: 'D', normal: new THREE.Vector3(0, -1, 0), test: (p) => p.y === -1 },
  { face: 'F', normal: new THREE.Vector3(0, 0, 1), test: (p) => p.z === 1 },
  { face: 'B', normal: new THREE.Vector3(0, 0, -1), test: (p) => p.z === -1 }
]

const PIECE_AXES: Record<string, [Axis, number]> = { U: ['y', 1], D: ['y', -1], R: ['x', 1], L: ['x', -1], F: ['z', 1], B: ['z', -1] }

export function pieceHome(name: string) {
  const letters = name.trim().toUpperCase().split('')
  if (letters.length < 2 || letters.length > 3) return undefined
  const home = new THREE.Vector3()
  for (const letter of letters) {
    const axis = PIECE_AXES[letter]
    if (!axis) return undefined
    home[axis[0]] = axis[1]
  }
  return home
}

export class CubeRenderer {
  readonly canvas: HTMLCanvasElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  private readonly root = new THREE.Group()
  private readonly puzzle = new THREE.Group()
  private cubies: Cubie[] = []
  private readonly queue: Turn[] = []
  private animation: Animation | null = null
  private frame = 0
  private dirty = true
  private orientation = new THREE.Quaternion()
  private orientationTarget: THREE.Quaternion | null = null
  private readonly materials: Record<keyof CubeColours, THREE.MeshStandardMaterial>
  private readonly dimmed: Record<keyof CubeColours, THREE.MeshStandardMaterial>
  private readonly geometries: THREE.BufferGeometry[] = []

  constructor(colours: CubeColours = DEFAULT_CUBE_COLOURS) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.canvas = this.renderer.domElement
    this.canvas.style.display = 'block'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'

    const environment = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.35
    environment.dispose()
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(3, 8, 6)
    const fill = new THREE.DirectionalLight(0xffffff, 0.5)
    fill.position.set(-6, 2, 4)
    this.scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.25))

    const spherical = new THREE.Spherical(9.2, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(32))
    this.camera.position.setFromSpherical(spherical)
    this.camera.lookAt(0, 0, 0)

    this.materials = Object.fromEntries(
      (Object.keys(colours) as Array<keyof CubeColours>).map((face) => [face, new THREE.MeshStandardMaterial({ color: colours[face], roughness: 0.32, metalness: 0 })])
    ) as Record<keyof CubeColours, THREE.MeshStandardMaterial>
    this.dimmed = Object.fromEntries(
      (Object.keys(colours) as Array<keyof CubeColours>).map((face) => [face, new THREE.MeshStandardMaterial({ color: new THREE.Color(colours[face]).multiplyScalar(0.22), roughness: 0.6, metalness: 0 })])
    ) as Record<keyof CubeColours, THREE.MeshStandardMaterial>

    this.root.add(this.puzzle)
    this.scene.add(this.root)
    this.build()
  }

  private build() {
    const body = new RoundedBoxGeometry(0.98, 0.98, 0.98, 3, 0.12)
    const sticker = roundedSquare(0.84, 0.13)
    this.geometries.push(body, sticker)
    const plastic = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.55, metalness: 0.05 })
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!x && !y && !z) continue
      const home = new THREE.Vector3(x, y, z)
      const mesh = new THREE.Group()
      mesh.add(new THREE.Mesh(body, plastic))
      const stickers: Cubie['stickers'] = []
      for (const side of STICKER_FACES) {
        if (!side.test(home)) continue
        const face = new THREE.Mesh(sticker, this.materials[side.face])
        face.position.copy(side.normal).multiplyScalar(0.491)
        face.lookAt(side.normal.clone().multiplyScalar(2))
        mesh.add(face)
        stickers.push({ mesh: face, face: side.face })
      }
      mesh.position.copy(home)
      this.puzzle.add(mesh)
      this.cubies.push({ mesh, home, stickers })
    }
  }

  setColours(colours: CubeColours) {
    for (const face of Object.keys(colours) as Array<keyof CubeColours>) {
      this.materials[face].color.set(colours[face])
      this.dimmed[face].color.set(colours[face]).multiplyScalar(0.22)
    }
    this.dirty = true
  }

  highlight(pieces: string[] | null) {
    const homes = pieces?.map(pieceHome).filter((home): home is THREE.Vector3 => home !== undefined) ?? []
    for (const cubie of this.cubies) {
      const lit = homes.length === 0 || homes.some((home) => home.equals(cubie.home))
      for (const sticker of cubie.stickers) sticker.mesh.material = lit ? this.materials[sticker.face] : this.dimmed[sticker.face]
    }
    this.dirty = true
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(height, 1)
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  reset() {
    this.finishAnimation()
    this.queue.length = 0
    for (const cubie of this.cubies) {
      cubie.mesh.position.copy(cubie.home)
      cubie.mesh.quaternion.identity()
    }
    this.dirty = true
  }

  applyInstant(moves: string[]) {
    this.finishAnimation()
    for (const token of this.drainQueue()) this.rotateLayer(token, 1)
    for (const move of moves) {
      const turn = parseTurn(move)
      if (turn) this.rotateLayer(turn, 1)
    }
    this.dirty = true
  }

  enqueue(moves: string[]) {
    for (const move of moves) {
      const turn = parseTurn(move)
      if (turn) this.queue.push(turn)
    }
  }

  setOrientation(target: { x: number; y: number; z: number; w: number } | null) {
    this.orientationTarget = target ? new THREE.Quaternion(target.x, target.y, target.z, target.w).normalize() : null
    if (!target) this.orientation.identity()
    this.dirty = true
  }

  start() {
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick)
      this.step(now)
    }
    this.frame = requestAnimationFrame(tick)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of [...Object.values(this.materials), ...Object.values(this.dimmed)]) material.dispose()
    this.scene.environment?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private drainQueue() {
    return this.queue.splice(0, this.queue.length)
  }

  private step(now: number) {
    if (!this.animation && this.queue.length) this.beginAnimation(now)
    if (this.animation) {
      const progress = Math.min(1, (now - this.animation.start) / this.animation.duration)
      const eased = 1 - (1 - progress) ** 3
      this.animation.pivot.quaternion.setFromAxisAngle(AXES[this.animation.turn.axis], (Math.PI / 2) * this.animation.turn.quarter * eased)
      if (progress >= 1) this.finishAnimation()
      this.dirty = true
    }
    if (this.orientationTarget) {
      this.orientation.slerp(this.orientationTarget, 0.25)
      if (this.orientation.angleTo(this.orientationTarget) > 1e-4) this.dirty = true
    }
    this.root.quaternion.copy(this.orientation)
    if (!this.dirty) return
    this.dirty = false
    this.renderer.render(this.scene, this.camera)
  }

  private layerCubies(turn: Turn) {
    return this.cubies.filter((cubie) => turn.layers.includes(Math.round(cubie.mesh.position[turn.axis])))
  }

  private beginAnimation(now: number) {
    const turn = this.queue.shift()!
    const backlog = this.queue.length
    const duration = backlog > 6 ? 0 : backlog > 2 ? 60 : Math.abs(turn.quarter) === 2 ? 170 : 120
    if (duration === 0) {
      this.rotateLayer(turn, 1)
      this.dirty = true
      return
    }
    const pivot = new THREE.Group()
    this.puzzle.add(pivot)
    const cubies = this.layerCubies(turn)
    for (const cubie of cubies) pivot.attach(cubie.mesh)
    this.animation = { turn, pivot, cubies, start: now, duration }
  }

  private finishAnimation() {
    const animation = this.animation
    if (!animation) return
    this.animation = null
    animation.pivot.quaternion.setFromAxisAngle(AXES[animation.turn.axis], (Math.PI / 2) * animation.turn.quarter)
    animation.pivot.updateMatrixWorld()
    for (const cubie of animation.cubies) this.puzzle.attach(cubie.mesh)
    this.puzzle.remove(animation.pivot)
    for (const cubie of animation.cubies) this.snap(cubie)
  }

  private rotateLayer(turn: Turn, fraction: number) {
    const rotation = new THREE.Quaternion().setFromAxisAngle(AXES[turn.axis], (Math.PI / 2) * turn.quarter * fraction)
    for (const cubie of this.layerCubies(turn)) {
      cubie.mesh.position.applyQuaternion(rotation)
      cubie.mesh.quaternion.premultiply(rotation)
      this.snap(cubie)
    }
  }

  private snap(cubie: Cubie) {
    const position = cubie.mesh.position
    position.set(Math.round(position.x), Math.round(position.y), Math.round(position.z))
    const matrix = new THREE.Matrix4().makeRotationFromQuaternion(cubie.mesh.quaternion)
    matrix.elements.forEach((value, index) => { matrix.elements[index] = Math.round(value) })
    cubie.mesh.quaternion.setFromRotationMatrix(matrix)
  }
}
