import * as THREE from 'three'
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'

export interface Station {
  n: number
  color: string
  levelName: string
  label: [string, string]
  project?: boolean
}

export interface RoadOptions {
  quality: 'high' | 'low'
}

/** Curve parameter of the first and last station; the rest are spread evenly between. */
export const T_START = 0.05
export const T_END = 0.955
export const stationT = (i: number, count: number) => T_START + (i / (count - 1)) * (T_END - T_START)

const INK = '#141312'
const PAPER = '#efe9dd'
const UP = new THREE.Vector3(0, 1, 0)
/** How far before a station the camera rests, so its sign is in view. */
const VIEW_BACK = 0.017
/** Portrait screens are narrow: stand further back so roadside signs fit. */
const VIEW_BACK_NARROW = 0.034

/** Roadside words, per level: the things you learn there. */
const WORDS: string[][] = [
  ['<div>', '<h1>', '{ }', 'flex', 'grid', '.css', '<a>', '#id', 'rem', '@media'],
  ['=>', '( )', '[ ]', 'async', 'const', '===', 'fetch', '.map', 'this', ': T'],
  ['<App />', 'props', 'state', 'ref( )', 'hook', '/:id', 'store'],
  ['test', 'query', 'SSR', 'a11y', 'ship', 'LCP', 'deploy'],
]

export function createRoad(canvas: HTMLCanvasElement, stations: Station[], opts: RoadOptions) {
  const high = opts.quality === 'high'
  const count = stations.length

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5))

  const scene = new THREE.Scene()
  const sky = new THREE.Color()
  scene.background = sky
  scene.fog = new THREE.Fog(sky, 38, 235)

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900)

  // ---- path (flat: it is a road) -----------------------------------------
  const pts: THREE.Vector3[] = []
  for (let k = -3; k <= count + 2; k++) pts.push(new THREE.Vector3(Math.sin(k * 0.62) * 11 + Math.sin(k * 0.21) * 5, 0, -k * 26))
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  curve.arcLengthDivisions = 2000
  const length = curve.getLength()

  const levelColors = stations.map((s) => new THREE.Color(s.color))
  const colorAt = (idx: number, out = new THREE.Color()) => {
    const i = THREE.MathUtils.clamp(idx, 0, count - 1)
    const a = Math.floor(i)
    const b = Math.min(a + 1, count - 1)
    return out.copy(levelColors[a]!).lerp(levelColors[b]!, THREE.MathUtils.smoothstep(i - a, 0.2, 0.8))
  }
  const idxAtT = (t: number) => ((t - T_START) / (T_END - T_START)) * (count - 1)
  const sideAt = (t: number) => new THREE.Vector3().crossVectors(curve.getTangentAt(t), UP).normalize()

  const ink = new THREE.MeshBasicMaterial({ color: INK })
  const paper = new THREE.MeshBasicMaterial({ color: PAPER })
  const textures: THREE.Texture[] = []

  // ---- ground: a layout grid ----------------------------------------------
  const gridCanvas = document.createElement('canvas')
  gridCanvas.width = gridCanvas.height = 256
  {
    const g = gridCanvas.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(0,0,0,0.16)'
    g.fillRect(0, 0, 256, 3)
    g.fillRect(0, 0, 3, 256)
  }
  const gridTex = new THREE.CanvasTexture(gridCanvas)
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping
  gridTex.repeat.set(700 / 8, 1300 / 8)
  gridTex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  gridTex.colorSpace = THREE.SRGBColorSpace
  textures.push(gridTex)
  const groundMat = new THREE.MeshBasicMaterial({ map: gridTex })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 1300), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.02, -length / 2 + 80)
  scene.add(ground)

  // ---- asphalt ------------------------------------------------------------
  const ROAD_W = 3.4
  const SEG = 1500
  const pos = new Float32Array((SEG + 1) * 6)
  const uv = new Float32Array((SEG + 1) * 4)
  const idx: number[] = []
  const p = new THREE.Vector3()
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG
    curve.getPointAt(u, p)
    const s = sideAt(u)
    pos.set([p.x - s.x * ROAD_W, 0, p.z - s.z * ROAD_W, p.x + s.x * ROAD_W, 0, p.z + s.z * ROAD_W], i * 6)
    uv.set([(u * length) / 9, 0, (u * length) / 9, 1], i * 4)
    if (i < SEG) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const roadGeo = new THREE.BufferGeometry()
  roadGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  roadGeo.setIndex(idx)
  const roadCanvas = document.createElement('canvas')
  roadCanvas.width = 128
  roadCanvas.height = 256
  {
    const g = roadCanvas.getContext('2d')!
    g.fillStyle = INK
    g.fillRect(0, 0, 128, 256)
    g.fillStyle = PAPER
    g.fillRect(0, 8, 128, 5)
    g.fillRect(0, 243, 128, 5)
    g.fillRect(0, 125, 60, 6)
  }
  const roadTex = new THREE.CanvasTexture(roadCanvas)
  roadTex.wrapS = THREE.RepeatWrapping
  roadTex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  roadTex.colorSpace = THREE.SRGBColorSpace
  textures.push(roadTex)
  scene.add(new THREE.Mesh(roadGeo, new THREE.MeshBasicMaterial({ map: roadTex, side: THREE.DoubleSide })))

  // ---- sun ----------------------------------------------------------------
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 64), new THREE.MeshBasicMaterial({ color: PAPER, fog: false, depthWrite: false }))
  sun.renderOrder = -1
  scene.add(sun)

  // ---- road signs ---------------------------------------------------------
  const FONT = { display: 'Anton', sans: 'Archivo', mono: '"JetBrains Mono"' }
  const signs: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; station: Station }[] = []

  const drawSign = (c: HTMLCanvasElement, s: Station) => {
    const g = c.getContext('2d')!
    const W = c.width
    const H = c.height
    const num = String(s.n).padStart(2, '0')
    g.textBaseline = 'alphabetic'
    if (s.project) {
      g.fillStyle = INK
      g.fillRect(0, 0, W, H)
      g.strokeStyle = s.color
      g.lineWidth = 10
      g.strokeRect(18, 18, W - 36, H - 36)
      g.fillStyle = s.color
      g.font = `400 300px ${FONT.display}`
      g.fillText(num, 60, 318)
      g.fillStyle = PAPER
      g.font = `400 168px ${FONT.display}`
      g.fillText(s.label[0], 410, 208)
      g.fillStyle = s.color
      g.font = `600 58px ${FONT.mono}`
      g.fillText(s.label[1].toUpperCase(), 414, 300)
      return
    }
    g.fillStyle = PAPER
    g.fillRect(0, 0, W, H)
    g.strokeStyle = INK
    g.lineWidth = 12
    g.strokeRect(20, 20, W - 40, H - 40)
    g.fillStyle = s.color
    g.fillRect(26, H - 150, W - 52, 124)
    g.fillStyle = INK
    g.font = `600 38px ${FONT.mono}`
    g.fillText((s.levelName ?? '').toUpperCase(), 62, H - 72)
    g.font = `600 34px ${FONT.mono}`
    g.fillText('WEEK', 64, 96)
    g.font = `400 330px ${FONT.display}`
    g.fillText(num, 52, 418)
    g.font = `800 92px ${FONT.sans}`
    g.fillText(s.label[0], 420, 268)
    if (s.label[1]) {
      g.font = `500 66px ${FONT.sans}`
      g.fillText(s.label[1], 422, 356)
    }
  }

  const poleGeo = new THREE.BoxGeometry(0.16, 1, 0.16)
  const addPole = (parent: THREE.Object3D, x: number, h: number) => {
    const m = new THREE.Mesh(poleGeo, ink)
    m.scale.y = h
    m.position.set(x, h / 2, -0.12)
    parent.add(m)
  }

  const buildSigns = () => {
    stations.forEach((s, i) => {
      const t = stationT(i, count)
      const at = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const side = sideAt(t)
      const group = new THREE.Group()
      const c = document.createElement('canvas')
      c.width = s.project ? 1536 : 1024
      c.height = s.project ? 400 : 640
      drawSign(c, s)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      textures.push(tex)
      signs.push({ canvas: c, tex, station: s })
      const mat = new THREE.MeshBasicMaterial({ map: tex })
      let turn = 0

      if (s.project) {
        // overhead gantry across the road
        group.position.copy(at)
        const board = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.4), mat)
        board.position.y = 7.4
        group.add(board)
        const beam = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.3, 0.3), ink)
        beam.position.set(0, 5.55, -0.12)
        group.add(beam)
        addPole(group, -7.1, 9.1)
        addPole(group, 7.1, 9.1)
      } else {
        const dir = i % 2 === 0 ? 1 : -1
        group.position.copy(at).addScaledVector(side, dir * 6.6)
        const board = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.875), mat)
        board.position.y = 4.5
        group.add(board)
        addPole(group, -2.2, 2.7)
        addPole(group, 2.2, 2.7)
        turn = -dir * 0.32
      }
      // face oncoming traffic
      group.lookAt(group.position.clone().sub(tan))
      if (turn) group.rotateY(turn)
      scene.add(group)
    })
  }

  // ---- 3D type: giant week numbers + roadside words -----------------------
  const buildType = (font: Font) => {
    const text = (str: string, size: number, depth: number, front: THREE.Material, sideMat: THREE.Material) => {
      const geo = new TextGeometry(str, { font, size, depth, curveSegments: high ? 6 : 3 })
      geo.computeBoundingBox()
      const bb = geo.boundingBox!
      geo.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -depth / 2)
      return new THREE.Mesh(geo, [front, sideMat])
    }

    stations.forEach((s, i) => {
      const t = stationT(i, count)
      const at = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const side = sideAt(t)
      const dir = s.project ? (i % 2 ? 1 : -1) : i % 2 === 0 ? -1 : 1
      const big = !!s.project
      const m = text(String(s.n).padStart(2, '0'), big ? 15 : 8.5, big ? 4 : 2.4, big ? paper : ink, big ? ink : paper)
      m.position.copy(at).addScaledVector(side, dir * (big ? 34 : 25)).addScaledVector(tan, big ? 26 : 21)
      m.lookAt(m.position.clone().sub(tan))
      m.rotateY(-dir * 0.42)
      scene.add(m)
    })

    // One word per gap, painted flat on the shoulder like road markings, so it
    // never stands in front of a sign or a giant number.
    for (let i = 0; i < count - 1; i++) {
      const level = i < 8 ? 0 : i < 18 ? 1 : i < 24 ? 2 : 3
      const words = WORDS[level]!
      const t = stationT(i, count) + 0.5 * ((T_END - T_START) / (count - 1))
      const at = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const dir = i % 2 === 0 ? -1 : 1
      const m = text(words[(i * 3) % words.length]!, 1.7, 0.05, paper, paper)
      const half = m.geometry.boundingBox!.max.x - m.geometry.boundingBox!.min.x
      m.position.copy(at).addScaledVector(sideAt(t), dir * (ROAD_W + 1.3 + half / 2))
      m.position.y = 0.04
      m.lookAt(m.position.clone().sub(tan))
      m.rotateX(-Math.PI / 2)
      scene.add(m)
    }
  }

  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('800 50px Archivo'), document.fonts.load('500 50px Archivo'), document.fonts.load('600 30px "JetBrains Mono"')]),
    new Promise((r) => setTimeout(r, 3000)),
  ])
  fontsReady.then(buildSigns)
  new FontLoader().load('/fonts/helvetiker_bold.typeface.json', buildType)

  // ---- state ------------------------------------------------------------
  let target = 0
  let current = 0
  const pointer = new THREE.Vector2()
  const pointerSmooth = new THREE.Vector2()
  const camPos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const right = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const clock = new THREE.Clock()
  let raf = 0
  let running = true
  let viewBack = VIEW_BACK
  let steer = 0

  const onPointer = (e: PointerEvent) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  window.addEventListener('pointermove', onPointer, { passive: true })

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.fov = w / h < 0.8 ? 78 : 58
    viewBack = w / h < 0.8 ? VIEW_BACK_NARROW : VIEW_BACK
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  const frame = () => {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.05)

    current += (target - current) * (1 - Math.exp(-dt * 6))
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 4))

    const t = THREE.MathUtils.clamp(current - viewBack, 0, 0.985)
    curve.getPointAt(t, camPos)
    curve.getPointAt(Math.min(t + 0.014, 1), look)
    const tan = curve.getTangentAt(t)
    right.crossVectors(tan, UP).normalize()
    // how hard the road bends right now: change of heading just ahead
    const ahead = curve.getTangentAt(Math.min(t + 0.01, 1))
    steer = THREE.MathUtils.clamp((ahead.x - tan.x) * 25, -1, 1)

    camera.position.copy(camPos).addScaledVector(UP, 2.1 - pointerSmooth.y * 0.5).addScaledVector(right, pointerSmooth.x * 1.1)
    // At the very start, look up: the title owns the sky and the road rises into view.
    look.y = 3 + 2.2 * (1 - THREE.MathUtils.smoothstep(current, 0.004, 0.034))
    camera.lookAt(look)
    camera.rotateZ(-tan.x * 0.16 - pointerSmooth.x * 0.02)

    // sky follows the level; the ground is the same hue, deeper
    colorAt(idxAtT(current), sky)
    ;(scene.fog as THREE.Fog).color.copy(sky)
    groundMat.color.copy(sky).multiplyScalar(0.8)

    fwd.subVectors(look, camera.position).setY(0).normalize()
    sun.position.copy(camera.position).addScaledVector(fwd, 520).setY(26)
    sun.lookAt(camera.position.x, 26, camera.position.z)

    renderer.render(scene, camera)
  }
  frame()

  const onVisibility = () => {
    running = !document.hidden
    if (running) {
      clock.getDelta()
      frame()
    } else cancelAnimationFrame(raf)
  }
  document.addEventListener('visibilitychange', onVisibility)

  return {
    /** Signed bend of the road at the camera, roughly -1..1. */
    getSteer: () => steer,
    setProgress(v: number) {
      target = v
    },
    /** Jump without easing, e.g. when returning to a specific week. */
    snap(v: number) {
      target = current = v
    },
    /** Redraw sign text, e.g. after switching the React / Vue track. */
    setLabels(labels: [string, string][]) {
      fontsReady.then(() =>
        signs.forEach((s) => {
          const next = labels[s.station.n]
          if (!next || (next[0] === s.station.label[0] && next[1] === s.station.label[1])) return
          s.station = { ...s.station, label: next }
          drawSign(s.canvas, s.station)
          s.tex.needsUpdate = true
        }),
      )
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.())
      textures.forEach((x) => x.dispose())
      renderer.dispose()
    },
  }
}

export type Road = ReturnType<typeof createRoad>
