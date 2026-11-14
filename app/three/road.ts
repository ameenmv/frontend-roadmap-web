import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export interface Station {
  n: number
  color: string
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

const VOID = new THREE.Color('#05060a')
const UP = new THREE.Vector3(0, 1, 0)

export function createRoad(canvas: HTMLCanvasElement, stations: Station[], opts: RoadOptions) {
  const high = opts.quality === 'high'
  const count = stations.length

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.75 : 1.25))
  renderer.toneMapping = THREE.NoToneMapping

  const scene = new THREE.Scene()
  scene.background = VOID.clone()
  scene.fog = new THREE.FogExp2(VOID.clone(), 0.0105)

  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 600)

  // ---- path -------------------------------------------------------------
  const pts: THREE.Vector3[] = []
  for (let k = -3; k <= count + 2; k++) {
    pts.push(new THREE.Vector3(Math.sin(k * 0.62) * 13 + Math.sin(k * 0.21) * 6, Math.sin(k * 0.37) * 3.2, -k * 26))
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  curve.arcLengthDivisions = 2000

  const colors = stations.map((s) => new THREE.Color(s.color))
  /** Smooth level colour for a fractional station index. */
  const colorAt = (idx: number, out = new THREE.Color()) => {
    const i = THREE.MathUtils.clamp(idx, 0, count - 1)
    const a = Math.floor(i)
    const b = Math.min(a + 1, count - 1)
    return out.copy(colors[a]!).lerp(colors[b]!, THREE.MathUtils.smoothstep(i - a, 0.25, 0.75))
  }
  const idxAtT = (t: number) => ((t - T_START) / (T_END - T_START)) * (count - 1)

  // ---- road -------------------------------------------------------------
  const TUBULAR = 1400
  const RADIAL = 8
  const roadGeo = new THREE.TubeGeometry(curve, TUBULAR, 0.09, RADIAL, false)
  const roadColors = new Float32Array(roadGeo.attributes.position!.count * 3)
  const tmp = new THREE.Color()
  for (let i = 0; i < roadGeo.attributes.position!.count; i++) {
    const u = Math.floor(i / (RADIAL + 1)) / TUBULAR
    colorAt(idxAtT(u), tmp)
    roadColors.set([tmp.r, tmp.g, tmp.b], i * 3)
  }
  roadGeo.setAttribute('color', new THREE.BufferAttribute(roadColors, 3))
  const roadMat = new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vColor;
      varying float vU;
      void main() {
        vColor = color;
        vU = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uTime;
      varying vec3 vColor;
      varying float vU;
      void main() {
        float done = smoothstep(uProgress + 0.012, uProgress - 0.002, vU);
        float flow = pow(fract(vU * 90.0 - uTime * 0.35), 6.0);
        vec3 col = vColor * (0.3 + 0.95 * done) + vColor * flow * 0.7;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  scene.add(new THREE.Mesh(roadGeo, roadMat))

  // ---- gates + labels ---------------------------------------------------
  const gates: { group: THREE.Group; t: number; ring: THREE.Mesh; extra?: THREE.Object3D; mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = []
  const ringGeo = new THREE.TorusGeometry(3.1, 0.05, 10, 96)
  const bigRingGeo = new THREE.TorusGeometry(4.2, 0.09, 12, 128)
  const haloGeo = new THREE.TorusGeometry(5.4, 0.025, 8, 128)
  const gemGeo = new THREE.IcosahedronGeometry(0.85, 0)
  const textures: THREE.Texture[] = []

  const makeLabel = (s: Station) => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 420
    const g = c.getContext('2d')!
    g.textAlign = 'center'
    g.fillStyle = s.color
    g.font = `800 ${s.project ? 200 : 190}px Syne, system-ui, sans-serif`
    g.fillText(String(s.n).padStart(2, '0'), 512, 190)
    g.fillStyle = '#ffffff'
    g.font = `700 ${s.project ? 78 : 70}px Manrope, system-ui, sans-serif`
    g.fillText(s.label[0], 512, 290)
    if (s.label[1]) {
      g.fillStyle = 'rgba(255,255,255,0.62)'
      g.font = '500 54px Manrope, system-ui, sans-serif'
      g.fillText(s.label[1], 512, 368)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    textures.push(tex)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
    sprite.scale.set(9.2, 3.77, 1)
    return sprite
  }

  const buildStations = () => {
    stations.forEach((s, i) => {
      const t = stationT(i, count)
      const p = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const group = new THREE.Group()
      group.position.copy(p).addScaledVector(UP, 1.5)
      const base = colors[i]!.clone().multiplyScalar(s.project ? 1.7 : 1.25)
      const mat = new THREE.MeshBasicMaterial({ color: base.clone() })
      const ring = new THREE.Mesh(s.project ? bigRingGeo : ringGeo, mat)
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan)
      group.add(ring)
      let extra: THREE.Object3D | undefined
      if (s.project) {
        extra = new THREE.Group()
        const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: colors[i]!.clone().multiplyScalar(1.2) }))
        halo.quaternion.copy(ring.quaternion)
        const gem = new THREE.Mesh(gemGeo, new THREE.MeshBasicMaterial({ color: colors[i]!.clone().multiplyScalar(2), wireframe: true }))
        gem.position.y = 5.6
        gem.scale.setScalar(0.7)
        extra.add(halo, gem)
        group.add(extra)
      }
      const label = makeLabel(s)
      label.position.set(0, s.project ? 8.3 : 5.4, 0)
      group.add(label)
      scene.add(group)
      gates.push({ group, t, ring, extra, mat, base })
    })
  }
  // Wait for the web fonts so the canvas labels use them, but never block forever.
  Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]).then(buildStations)

  // ---- stars + debris ---------------------------------------------------
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const offsetFrom = (t: number, rMin: number, rMax: number) => {
    const a = Math.random() * Math.PI * 2
    const r = rand(rMin, rMax)
    return curve.getPointAt(t).add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.7, rand(-10, 10)))
  }

  const STARS = high ? 5200 : 1800
  const starPos = new Float32Array(STARS * 3)
  const starCol = new Float32Array(STARS * 3)
  for (let i = 0; i < STARS; i++) {
    const t = Math.random()
    const p = offsetFrom(t, 14, 120)
    starPos.set([p.x, p.y, p.z], i * 3)
    colorAt(idxAtT(t), tmp).lerp(new THREE.Color('#ffffff'), rand(0.35, 1))
    starCol.set([tmp.r, tmp.g, tmp.b], i * 3)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
  const starMat = new THREE.PointsMaterial({ size: 0.26, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, fog: false })
  scene.add(new THREE.Points(starGeo, starMat))

  const DEBRIS = high ? 260 : 90
  const debrisGeo = new THREE.OctahedronGeometry(0.55, 0)
  const debrisMat = new THREE.MeshBasicMaterial({ wireframe: true })
  const debris = new THREE.InstancedMesh(debrisGeo, debrisMat, DEBRIS)
  const debrisData: { pos: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; scale: number }[] = []
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const sc = new THREE.Vector3()
  for (let i = 0; i < DEBRIS; i++) {
    const t = Math.random()
    debrisData.push({
      pos: offsetFrom(t, 6, 30),
      rot: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
      spin: new THREE.Vector3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4)),
      scale: rand(0.4, 1.8),
    })
    debris.setColorAt(i, colorAt(idxAtT(t), tmp).multiplyScalar(rand(0.5, 1.3)))
  }
  scene.add(debris)

  // ---- post -------------------------------------------------------------
  let composer: EffectComposer | undefined
  let bloom: UnrealBloomPass | undefined
  if (high) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.55, 0.32)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  }

  // ---- state ------------------------------------------------------------
  let target = 0
  let current = 0
  const pointer = new THREE.Vector2()
  const pointerSmooth = new THREE.Vector2()
  const fogColor = new THREE.Color()
  const camPos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const right = new THREE.Vector3()
  const clock = new THREE.Clock()
  let raf = 0
  let running = true

  const onPointer = (e: PointerEvent) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    composer?.setSize(w, h)
    camera.aspect = w / h
    // Keep gates readable on tall, narrow screens.
    camera.fov = w / h < 0.8 ? 82 : 64
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  const frame = () => {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.05)
    const time = clock.elapsedTime

    current += (target - current) * (1 - Math.exp(-dt * 6))
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 4))

    // Sit a little before the current station so its gate and label are in view.
    const t = THREE.MathUtils.clamp(current - 0.019, 0, 0.985)
    curve.getPointAt(t, camPos)
    curve.getPointAt(Math.min(t + 0.011, 1), look)
    const tan = curve.getTangentAt(t)
    right.crossVectors(tan, UP).normalize()

    camera.position.copy(camPos).addScaledVector(UP, 1.7 - pointerSmooth.y * 0.5).addScaledVector(right, pointerSmooth.x * 0.9)
    look.addScaledVector(UP, 1.2)
    camera.lookAt(look)
    camera.rotateZ(-tan.x * 0.22 - pointerSmooth.x * 0.03)

    roadMat.uniforms.uProgress!.value = t
    roadMat.uniforms.uTime!.value = time

    colorAt(idxAtT(t), tmp)
    fogColor.copy(VOID).lerp(tmp, 0.007)
    ;(scene.fog as THREE.FogExp2).color.copy(fogColor)
    ;(scene.background as THREE.Color).copy(fogColor)

    for (const g of gates) {
      const d = g.t - t
      const near = Math.exp(-((d * 46) ** 2))
      const passed = d < -0.004
      g.ring.scale.setScalar(1 + near * 0.16)
      g.mat.color.copy(g.base).multiplyScalar(passed ? 0.3 : 0.7 + near * 0.8)
      if (g.extra) {
        g.extra.children[0]!.rotation.z = time * 0.35
        g.extra.children[1]!.rotation.set(time * 0.5, time * 0.7, 0)
      }
    }

    for (let i = 0; i < DEBRIS; i++) {
      const d = debrisData[i]!
      d.rot.x += d.spin.x * dt
      d.rot.y += d.spin.y * dt
      d.rot.z += d.spin.z * dt
      m4.compose(d.pos, q.setFromEuler(d.rot), sc.setScalar(d.scale))
      debris.setMatrixAt(i, m4)
    }
    debris.instanceMatrix.needsUpdate = true

    if (composer) composer.render()
    else renderer.render(scene, camera)
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
    setProgress(p: number) {
      target = p
    },
    /** Jump without easing, e.g. on first load at a deep-linked position. */
    snap(p: number) {
      target = current = p
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose?.()
      })
      textures.forEach((x) => x.dispose())
      composer?.dispose()
      renderer.dispose()
    },
  }
}

export type Road = ReturnType<typeof createRoad>
