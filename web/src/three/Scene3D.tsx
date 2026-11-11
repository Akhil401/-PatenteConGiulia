// 3D version of Giulia's board (three.js via react-three-fiber).
// It reads the SAME timeline as the 2D engine (clock), so narration, steps, replay and slow-motion all keep working.
import { Environment, Lightformer, Line, Sky } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { sample } from '../lib/scenes/engine.js'
import { Vehicle, type Actor, type Clock } from './Vehicle'
import { makeWorld, markings, readOverlays, trees, type World, type World3D } from './world'
import { Props, RoadSurface } from './Props'
import Studio, { StudioCards } from './Studio'
import { LabelCtx, LabelDriver, LabelLayer, label3d, tr, useLabel } from './labels'

interface Scene { duration: number; actors: Actor[]; shows: { t?: number; t0?: number; t1?: number; svg: string }[]; verdict?: { ok: boolean } | null; world3d: World3D }

function Ground({ world }: { world: World }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(260, 260, 130, 130)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    const col: number[] = []
    const c1 = new THREE.Color('#86b96a'), c2 = new THREE.Color('#6fa457')
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), yPx = z / .06 + 210
      p.setY(i, world.height(yPx) - .05)
      const n = (Math.sin(p.getX(i) * .35) + Math.cos(z * .27)) * .25 + .5
      const c = c1.clone().lerp(c2, n); col.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [world])
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial vertexColors roughness={1} /></mesh>
}

function Road({ world }: { world: World }) {
  const marks = useMemo(() => markings(world), [world])
  return (
    <group>
      <RoadSurface world={world} />
      {marks.map((g, i) => <mesh key={i} geometry={g} receiveShadow><meshStandardMaterial color="#f8fafc" roughness={.6} /></mesh>)}
    </group>
  )
}

function Trees({ world }: { world: World }) {
  const list = useMemo(() => trees(world), [world])
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color()
    list.forEach((t, i) => {
      m.compose(t.p.clone().add(new THREE.Vector3(0, .9 * t.s, 0)), q, new THREE.Vector3(t.s, t.s, t.s)); trunk.current?.setMatrixAt(i, m)
      m.compose(t.p.clone().add(new THREE.Vector3(0, 2.6 * t.s, 0)), q, new THREE.Vector3(t.s * 1.5, t.s * 1.7, t.s * 1.5)); crown.current?.setMatrixAt(i, m)
      crown.current?.setColorAt(i, c.setHSL(.28 + t.hue * .08, .45, .32 + t.hue * .12))
    })
    if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true
    if (crown.current) { crown.current.instanceMatrix.needsUpdate = true; if (crown.current.instanceColor) crown.current.instanceColor.needsUpdate = true }
  }, [list])
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, list.length]} castShadow><cylinderGeometry args={[.14, .2, 1.8, 6]} /><meshStandardMaterial color="#6b4f3a" /></instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, list.length]} castShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={.9} flatShading /></instancedMesh>
    </group>
  )
}

/** Planned path that draws itself, with a ✕ or ✓ at the end. */
function GhostPath({ g, world, clock }: { g: ReturnType<typeof readOverlays>['ghosts'][number]; world: World; clock: Clock }) {
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = []
    for (let i = 0; i < g.pts.length - 1; i++) {
      const [x0, y0] = g.pts[i], [x1, y1] = g.pts[i + 1]
      for (let k = 0; k < 12; k++) { const f = k / 12; out.push(world.to3(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, .18)) }
    }
    const [xl, yl] = g.pts[g.pts.length - 1]; out.push(world.to3(xl, yl, .18))
    return out
  }, [g, world])
  const grp = useRef<THREE.Group>(null)
  const line = useRef<any>(null)
  const end = g.mark ? world.to3(g.mark[0], g.mark[1], 1.4) : pts[pts.length - 1]
  const mark = useLabel(g.ok ? '✓' : '✕', `m3d ${g.ok ? 'ok' : 'no'}`, end)
  useFrame(() => {
    const t = clock().time, on = t >= g.t0 && t < g.t1
    if (grp.current) grp.current.visible = on
    if (line.current?.material) line.current.material.dashOffset -= .02
    mark.el.current?.classList.toggle('on', on && t >= g.t0 + 800)
  })
  return (
    <group ref={grp} visible={false}>
      <Line ref={line} points={pts} color={g.ok ? '#22c55e' : '#ef4444'} lineWidth={5} dashed dashSize={.7} gapSize={.45} toneMapped={false} />
    </group>
  )
}

/** Line of sight from YOUR windscreen, cut off where the view is blocked. */
function SightCone({ actor, world, clock }: { actor: Actor; world: World; clock: Clock }) {
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Array(9 * 2).fill(0), 3)); return g }, [])
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = clock().time, s = sample(actor, t)
    const nose = s.y - 40, cut = Math.min(nose - 10, actor.cone!), half = Math.min(150, 14 + (nose - cut) * .35)
    const a = world.to3(s.x, nose, .25), b = world.to3(s.x - half, cut, .25), c = world.to3(s.x + half, cut, .25)
    const p = geo.attributes.position as THREE.BufferAttribute
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.setXYZ(2, c.x, c.y, c.z)
    p.setXYZ(3, a.x, a.y, a.z); p.setXYZ(4, c.x, c.y, c.z); p.setXYZ(5, b.x, b.y, b.z)
    p.needsUpdate = true; geo.computeBoundingSphere()
    if (mesh.current) mesh.current.visible = t > 900
  })
  return (
    <group>
      <mesh ref={mesh} geometry={geo}><meshBasicMaterial color="#fde047" transparent opacity={.28} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} /></mesh>
      <ConeEnd actor={actor} world={world} clock={clock} />
    </group>
  )
}
function ConeEnd({ actor, world, clock }: { actor: Actor; world: World; clock: Clock }) {
  const grp = useRef<THREE.Group>(null)
  const q = useLabel('?', 'q3d', [0, 0, 0])
  useFrame(() => {
    const t = clock().time, s = sample(actor, t)
    const nose = s.y - 40, cut = Math.min(nose - 10, actor.cone!)
    const p = world.to3(s.x, cut, 0)
    grp.current?.position.copy(p); if (grp.current) grp.current.visible = t > 900
    q.pos.current.copy(p).add(new THREE.Vector3(0, 1.6, 0))
    if (q.el.current) q.el.current.style.opacity = t > 900 ? '1' : '0'
  })
  return (
    <group ref={grp}>
      <mesh position={[0, .3, 0]}><boxGeometry args={[9, .06, .12]} /><meshBasicMaterial color="#ef4444" toneMapped={false} /></mesh>
    </group>
  )
}

function Pulse({ p, world, clock }: { p: { x: number; y: number; red: boolean; t0: number; t1: number }; world: World; clock: Clock }) {
  const m = useRef<THREE.Mesh>(null)
  const pos = useMemo(() => world.to3(p.x, p.y, .3), [p, world])
  useFrame(() => {
    const t = clock().time, on = t >= p.t0 && t < p.t1
    if (!m.current) return
    m.current.visible = on
    const k = ((t / 1100) % 1); m.current.scale.setScalar(1 + k * 1.6)
    ;(m.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * .8
  })
  return <mesh ref={m} position={pos} rotation-x={-Math.PI / 2}><ringGeometry args={[1.2, 1.6, 40]} /><meshBasicMaterial color={p.red ? '#ef4444' : '#facc15'} transparent toneMapped={false} /></mesh>
}

function Callout({ c, world, clock }: { c: ReturnType<typeof readOverlays>['callouts'][number]; world: World; clock: Clock }) {
  const lab = useLabel(escapeHtml(c.text), `c3d ${c.red ? 'red' : c.green ? 'green' : ''}`, world.to3(c.x, c.y, 2.2))
  useFrame(() => { const t = clock().time; lab.el.current?.classList.toggle('on', t >= c.t0 && t < c.t1) })
  return null
}
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))

/** Film-style camera: wide establishing shot -> low chase behind YOUR car -> lift on danger -> crane up for the verdict. */
function CameraRig({ scene, actors, world, clock }: { scene: Scene; actors: Actor[]; world: World; clock: Clock }) {
  const { camera } = useThree()
  const you = actors.find(a => a.kind === 'you')
  const cam = scene.world3d.cam as string | undefined
  const trk = actors.find(a => a.id === 'trk')
  const danger = useMemo(() => readOverlays(scene.shows).ghosts.filter(g => !g.ok), [scene])
  const cur = useRef({ pos: new THREE.Vector3(0, 30, 40), look: new THREE.Vector3(), init: false })
  useFrame((state, dt) => {
    const t = clock().time, d = scene.duration
    let pos: THREE.Vector3, look: THREE.Vector3
    if (cam === 'orbit') {
      // rule scenes: a slow crane around the place the rule is about
      const f = world.to3(180, (scene.world3d.focusY as number) ?? 180)
      const a = -.75 + (t / d) * 1.1
      const r = (scene.world3d.orbitR as number) ?? (world.wide ? 27 : 22), h = (scene.world3d.orbitH as number) ?? (world.wide ? 15 : 11)
      pos = f.clone().add(new THREE.Vector3(Math.sin(a) * r, h - (t / d) * 2.5, Math.cos(a) * r)); look = f.clone().add(new THREE.Vector3(0, -3.2, 0))
    } else if (cam === 'fly') {
      // starts as a top view, turned like the official drawing (road left-right), then flies down to a 3/4 view
      const k = THREE.MathUtils.smoothstep(t, 600, Math.min(d * .6, 4200))
      pos = new THREE.Vector3(THREE.MathUtils.lerp(30, 13, k), THREE.MathUtils.lerp(44, 19, k), THREE.MathUtils.lerp(.01, 19, k))
      look = new THREE.Vector3(0, 0, THREE.MathUtils.lerp(0, -4, k))
    } else if (cam === 'panel' && trk) {
      // first from the side, then right behind the truck at a driver's eye height, looking at its panels
      const s = sample(trk, t), s2 = sample(trk, t + 400)
      const P = world.to3(s.x, s.y), P2 = world.to3(s2.x, s2.y)
      const fwd = new THREE.Vector3(P2.x - P.x, 0, P2.z - P.z); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize()
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x)
      if (t < 1300) { pos = P.clone().addScaledVector(side, -10).addScaledVector(fwd, -3).add(new THREE.Vector3(0, 3.5, 0)); look = P.clone().add(new THREE.Vector3(0, 1.4, 0)) }
      else { const close = t > d * .55; pos = P.clone().addScaledVector(fwd, close ? -9 : -13).addScaledVector(side, close ? -.6 : -1.4).add(new THREE.Vector3(0, close ? 1.7 : 2.6, 0)); look = P.clone().addScaledVector(fwd, -3.6).add(new THREE.Vector3(0, .5, 0)) }
    } else if (you) {
      const s = sample(you, t), s2 = sample(you, t + 400)
      const P = world.to3(s.x, s.y), P2 = world.to3(s2.x, s2.y)
      let fwd = new THREE.Vector3(P2.x - P.x, 0, P2.z - P.z)
      if (fwd.lengthSq() < 1e-4) { const a = world.to3(s.x, s.y - 30); fwd = new THREE.Vector3(a.x - P.x, 0, a.z - P.z) }
      fwd.normalize()
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x)
      const dz = danger.find(g => t >= g.t0 + 200 && t < g.t0 + 2600)
      const sign = world.props.find((p: any) => p.type === 'sign')
      if ((scene as any).camera === 'wide') {
        // side-by-side comparisons: one high shot that shows both roads
        pos = world.to3(180, 470, 34); look = world.to3(180, 170, 0)
      } else if (sign && t < 2300) {
        // close-up on the sign first, from the driver's side of the road
        const sp = world.to3(sign.x, sign.y, 3.1)
        pos = world.to3(sign.x - 55, sign.y + 120, 3.2); look = sp
      } else if (t < 1100) { pos = P.clone().addScaledVector(fwd, -20).add(new THREE.Vector3(0, 15, 0)).addScaledVector(side, 6); look = P.clone().addScaledVector(fwd, 14) }
      else if (t > d - 1800) { pos = P.clone().addScaledVector(fwd, -14).add(new THREE.Vector3(0, 24, 0)).addScaledVector(side, -8); look = P.clone().addScaledVector(fwd, 10) }
      else if (dz) {
        const m = dz.mark ? world.to3(dz.mark[0], dz.mark[1]) : P.clone().addScaledVector(fwd, 15)
        const mid = P.clone().lerp(m, .5)
        if (world.hill) {
          // side profile: you SEE the crest and the car hidden behind it
          pos = mid.clone().addScaledVector(side, -24).add(new THREE.Vector3(0, 3.5, 0)); look = mid.clone().add(new THREE.Vector3(0, 2, 0))
        } else {
          pos = P.clone().addScaledVector(fwd, -11).add(new THREE.Vector3(0, 7, 0)).addScaledVector(side, -4); look = P.clone().lerp(m, .6)
        }
      } else {
        // chase: further back and higher when the scene has a sign or a junction to show
        const busy = !!sign || world.props.some((p: any) => p.type === 'junction' || p.type === 'sideRoad' || p.type === 'rails' || p.type === 'zebra')
        const back = busy ? 13 : 10, up = busy ? 7 : 4.4
        pos = P.clone().addScaledVector(fwd, -back).add(new THREE.Vector3(0, up, 0)); look = P.clone().addScaledVector(fwd, busy ? 16 : 14).add(new THREE.Vector3(0, .6, 0))
      }
    } else { pos = new THREE.Vector3(0, 26, 22); look = new THREE.Vector3(0, 0, -4) }
    // handheld feel
    const e = state.clock.elapsedTime
    pos.add(new THREE.Vector3(Math.sin(e * .7) * .12, Math.sin(e * 1.1) * .08, 0))
    const C = cur.current, k = C.init ? 1 - Math.exp(-dt * 2.4) : 1
    C.pos.lerp(pos, k); C.look.lerp(look, k); C.init = true
    camera.position.copy(C.pos); camera.lookAt(C.look)
  })
  return null
}

/** A yellow band on the road between two vehicles with the distance written on it (e.g. ≥ 70 m). */
function Gap({ gap, actors, world, clock }: { gap: { a: string; b: string; text: string; t0: number }; actors: Actor[]; world: World; clock: Clock }) {
  const A = actors.find(a => a.id === gap.a), B = actors.find(a => a.id === gap.b)
  const m = useRef<THREE.Mesh>(null)
  const lab = useLabel(escapeHtml(gap.text), 'tag3d lbl big', [0, 0, 0])
  useFrame(() => {
    if (!A || !B || !m.current) return
    const t = clock().time, on = t >= gap.t0
    const a = sample(A, t), b = sample(B, t)
    const half = (k: string) => (k === 'truck' ? 70 : k === 'bus' || k === 'tram' ? 95 : 38)   // half length in scene px
    const pa = world.to3(a.x, a.y + half(A.kind)), pb = world.to3(b.x, b.y - half(B.kind))   // rear of the vehicle ahead, front of yours
    const mid = pa.clone().lerp(pb, .5), len = Math.max(.1, pa.distanceTo(pb))
    m.current.position.set(mid.x, mid.y + .04, mid.z); m.current.scale.set(1, len, 1); m.current.visible = on
    lab.pos.current.copy(mid).add(new THREE.Vector3(0, 1.2, 0))
    lab.el.current?.classList.toggle('on', on)
  })
  return <mesh ref={m} rotation-x={-Math.PI / 2}><planeGeometry args={[2.6, 1]} /><meshBasicMaterial color="#facc15" transparent opacity={.45} depthWrite={false} toneMapped={false} /></mesh>
}

/** The official picture of the question, small in a corner; tap to make it big. */
function Inset({ img }: { img: string }) {
  const [big, setBig] = useState(false)
  return (
    <button type="button" className={`fig-inset${big ? ' big' : ''}`} onClick={e => { e.stopPropagation(); setBig(!big) }} onPointerDown={e => e.stopPropagation()} aria-label="Official picture">
      <img src={img} alt="" draggable={false} /><span>{tr('Figure', 'Figura')}{big ? ' ✕' : ''}</span>
    </button>
  )
}

/** Verdict stamp + flash + shake, driven by the timeline. */
function Verdict({ scene, clock, wrap }: { scene: Scene; clock: Clock; wrap: React.RefObject<HTMLDivElement | null> }) {
  const landed = useRef(false)
  useFrame(() => {
    if (!scene.verdict || !wrap.current) return
    const land = clock().time >= scene.duration - 1100
    if (land !== landed.current) {
      landed.current = land
      wrap.current.classList.toggle('landed', land)
      if (land && !scene.verdict.ok) { wrap.current.classList.remove('shake3d'); void wrap.current.offsetWidth; wrap.current.classList.add('shake3d') }
    }
  })
  return null
}

export default function Scene3D({ scene, clock }: { scene: Scene; clock: Clock }) {
  const wrap = useRef<HTMLDivElement>(null)
  const layer = useMemo(() => new LabelLayer(), [scene])
  label3d.lang = (scene.world3d.lang as string) || 'en'
  const ok = scene.verdict?.ok
  const overlay = <div className="label-layer" ref={el => { layer.root = el }} />
  if (scene.world3d.studio) return (
    <div ref={wrap} className="scene3d studio">
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 42, near: .1, far: 200, position: [0, 2, 10] }} gl={{ antialias: true }}>
        <LabelCtx.Provider value={layer}>
          <Studio w={scene.world3d} clock={clock} />
          <Verdict scene={scene} clock={clock} wrap={wrap} />
          <LabelDriver />
        </LabelCtx.Provider>
        <EffectComposer multisampling={0}>
          <Bloom intensity={.7} luminanceThreshold={.8} mipmapBlur />
          <Vignette offset={.3} darkness={.6} />
        </EffectComposer>
      </Canvas>
      {overlay}
      <StudioCards w={scene.world3d} clock={clock} />
      {scene.verdict && <div className={`stamp3d small ${ok ? 'ok' : 'no'}`}><span>{ok ? '✓' : '✕'}</span>{ok ? 'OK' : 'NO'}</div>}
      <div className={`flash3d ${ok ? 'ok' : 'no'}`} />
    </div>
  )
  return <RoadScene scene={scene} clock={clock} wrap={wrap} layer={layer} overlay={overlay} />
}

function RoadScene({ scene, clock, wrap, layer, overlay }: { scene: Scene; clock: Clock; wrap: React.RefObject<HTMLDivElement | null>; layer: LabelLayer; overlay: React.ReactNode }) {
  const world = useMemo(() => makeWorld(scene.world3d), [scene])
  const ov = useMemo(() => readOverlays(scene.shows), [scene])
  const actors = useMemo<Actor[]>(() => [...scene.actors, ...((scene.world3d.actors as Actor[]) || [])], [scene])
  const you = actors.find(a => a.kind === 'you')
  const ok = scene.verdict?.ok
  return (
    <div ref={wrap} className="scene3d">
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 48, near: .1, far: 600, position: [0, 30, 40] }} gl={{ antialias: true }}>
       <LabelCtx.Provider value={layer}>
        {world.fog ? <><color attach="background" args={['#dfe6ea']} /><fog attach="fog" args={['#dfe6ea', 14, 46]} /></>
          : <><Sky sunPosition={[60, 40, -80]} turbidity={6} rayleigh={1.2} mieCoefficient={.005} /><fog attach="fog" args={['#cfe3f2', 70, 190]} /></>}
        <hemisphereLight args={['#dbeafe', '#4d6b3a', .7]} />
        <directionalLight position={[18, 30, 12]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-bias={-.0004} />
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={2} position={[0, 6, -10]} scale={[20, 4, 1]} color="#ffffff" />
          <Lightformer intensity={1} position={[-10, 3, 6]} scale={[10, 3, 1]} color="#bfdbfe" />
          <Lightformer intensity={.6} rotation-x={Math.PI / 2} position={[0, -4, 0]} scale={[30, 30, 1]} color="#4d6b3a" />
        </Environment>
        <Ground world={world} />
        <Road world={world} />
        <Trees world={world} />
        <Props world={world} clock={clock} />
        {actors.map(a => <Vehicle key={a.id} actor={a} world={world} clock={clock} isYou={a.kind === 'you'} />)}
        {you?.cone !== undefined && <SightCone actor={you} world={world} clock={clock} />}
        {ov.ghosts.map((g, i) => <GhostPath key={i} g={g} world={world} clock={clock} />)}
        {ov.pulses.map((p, i) => <Pulse key={i} p={p} world={world} clock={clock} />)}
        {ov.callouts.map((c, i) => <Callout key={i} c={c} world={world} clock={clock} />)}
        {scene.world3d.gap && <Gap gap={scene.world3d.gap} actors={actors} world={world} clock={clock} />}
        <CameraRig scene={scene} actors={actors} world={world} clock={clock} />
        <Verdict scene={scene} clock={clock} wrap={wrap} />
        <LabelDriver />
       </LabelCtx.Provider>
        <EffectComposer multisampling={0}>
          <Bloom intensity={.9} luminanceThreshold={.85} luminanceSmoothing={.2} mipmapBlur />
          <Vignette offset={.25} darkness={.55} />
        </EffectComposer>
      </Canvas>
      {overlay}
      {scene.world3d.lines && <StudioCards w={scene.world3d} clock={clock} />}
      {scene.world3d.inset && <Inset img={scene.world3d.inset} />}
      {scene.verdict && <div className={`stamp3d ${ok ? 'ok' : 'no'}`}><span>{ok ? '✓' : '✕'}</span>{ok ? 'OK' : 'NO'}</div>}
      <div className={`flash3d ${ok ? 'ok' : 'no'}`} />
    </div>
  )
}
