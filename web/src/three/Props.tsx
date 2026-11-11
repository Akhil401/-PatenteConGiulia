// 3D road furniture placed from the scene description (world3d.props). Positions are in scene px.
import { RoundedBox, useTexture } from '@react-three/drei'
import { useLabel } from './labels'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { layout, quad, ribbon, type Prop, type RoadKind, type World } from './world'
import type { Clock } from './Vehicle'

const ASPHALT = <meshStandardMaterial color="#3a3f4a" roughness={.92} />
const WHITE = <meshStandardMaterial color="#f8fafc" roughness={.6} />

/** The road surface for the layout (asphalt, shoulders, medians, guard rails). */
export function RoadSurface({ world }: { world: World }) {
  const L = useMemo(() => layout(world.road as RoadKind, world.line as any), [world])
  const geos = useMemo(() => ({
    asphalt: L.asphalt.map(([a, b]) => ribbon(world, a - 180, b - 180, .01)),
    shoulders: L.shoulders.map(([a, b]) => ribbon(world, a - 180, b - 180, .005)),
    light: L.light.map(([a, b]) => ribbon(world, a - 180, b - 180, .012)),
    medians: L.medians.map(([a, b]) => ribbon(world, a - 180, b - 180, .12)),
  }), [L, world])
  return (
    <group>
      {geos.asphalt.map((g, i) => <mesh key={'a' + i} geometry={g} receiveShadow><meshStandardMaterial color="#3a3f4a" roughness={.92} /></mesh>)}
      {geos.shoulders.map((g, i) => <mesh key={'s' + i} geometry={g} receiveShadow><meshStandardMaterial color="#a8a29e" roughness={1} /></mesh>)}
      {geos.light.map((g, i) => <mesh key={'l' + i} geometry={g} receiveShadow><meshStandardMaterial color="#5b616e" roughness={.95} /></mesh>)}
      {geos.medians.map((g, i) => <mesh key={'m' + i} geometry={g} receiveShadow><meshStandardMaterial color="#6faa5a" roughness={1} /></mesh>)}
      {L.guards.map(x => <GuardRail key={x} world={world} x={x} />)}
    </group>
  )
}

function GuardRail({ world, x }: { world: World; x: number }) {
  const rail = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let y = 560; y >= -320; y -= 10) pts.push(world.to3(x, y, .55))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, .06, 6, false)
  }, [world, x])
  const posts = useMemo(() => { const out: THREE.Vector3[] = []; for (let y = 560; y >= -320; y -= 34) out.push(world.to3(x, y, .3)); return out }, [world, x])
  return (
    <group>
      <mesh geometry={rail} castShadow><meshStandardMaterial color="#cbd5e1" metalness={.7} roughness={.35} /></mesh>
      {posts.map((p, i) => <mesh key={i} position={p} castShadow><boxGeometry args={[.08, .6, .08]} /><meshStandardMaterial color="#94a3b8" metalness={.6} roughness={.4} /></mesh>)}
    </group>
  )
}

function CrossRoad({ world, y, h, x0 = -520, x1 = 880 }: { world: World; y: number; h: number; x0?: number; x1?: number }) {
  const g = useMemo(() => quad(world, x0, y, x1, y + h, .015, 24, 1), [world, y, h, x0, x1])
  const centre = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (let x = x0; x < x1; x += 36) if (x + 20 < 105 || x > 255) parts.push(quad(world, x, y + h / 2 - 1.2, x + 20, y + h / 2 + 1.2, .025))
    return parts
  }, [world, y, h, x0, x1])
  return <group><mesh geometry={g} receiveShadow>{ASPHALT}</mesh>{centre.map((c, i) => <mesh key={i} geometry={c}>{WHITE}</mesh>)}</group>
}

function Rails({ world, y }: { world: World; y: number }) {
  const bed = useMemo(() => quad(world, -520, y, 880, y + 26, .03, 24, 1), [world, y])
  const sleepers = useMemo(() => { const out: THREE.Vector3[] = []; for (let x = -500; x < 860; x += 14) out.push(world.to3(x, y + 13, .06)); return out }, [world, y])
  return (
    <group>
      <mesh geometry={bed} receiveShadow><meshStandardMaterial color="#6b5b4b" roughness={1} /></mesh>
      {sleepers.map((p, i) => <mesh key={i} position={p} receiveShadow><boxGeometry args={[.25, .08, 1.5]} /><meshStandardMaterial color="#5b4636" /></mesh>)}
      {[y + 6, y + 20].map(yy => { const a = world.to3(-520, yy, .14), b = world.to3(880, yy, .14), m = a.clone().lerp(b, .5)
        return <mesh key={yy} position={m} rotation-z={Math.PI / 2}><cylinderGeometry args={[.06, .06, a.distanceTo(b), 6]} /><meshStandardMaterial color="#d4d4d8" metalness={.9} roughness={.25} /></mesh> })}
    </group>
  )
}

function Zebra({ world, y, x0 = 110, w = 140 }: { world: World; y: number; x0?: number; w?: number }) {
  const stripes = useMemo(() => Array.from({ length: Math.floor(w / 16) }, (_, i) => quad(world, x0 + 4 + i * 16, y, x0 + 13 + i * 16, y + 34, .025)), [world, y, x0, w])
  return <group>{stripes.map((g, i) => <mesh key={i} geometry={g} receiveShadow>{WHITE}</mesh>)}</group>
}

const LAMP: Record<string, string> = { red: '#ff3b30', amber: '#ffb020', green: '#22c55e', white: '#f8fafc' }
/**
 * Traffic light. kind: "vehicle" (red/amber/green), "ped" (red/green), "pair" (two red lamps side by side, level crossing),
 * "amber" (one flashing amber lamp). color = fixed lamp; cycle = [[color, fromMs], ...] changes over time; flash = blinking.
 */
function TrafficLight({ world, x, y, color, cycle, flash, kind = 'vehicle', clock, scale = 1 }: { world: World; x: number; y: number; color?: string; cycle?: [string, number][]; flash?: boolean; kind?: string; clock: Clock; scale?: number }) {
  const p = world.to3(x, y)
  const lamps = kind === 'pair' ? ['red', 'red'] : kind === 'ped' ? ['red', 'green'] : kind === 'amber' ? ['amber'] : ['red', 'amber', 'green']
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  useFrame(() => {
    const t = clock().time
    let cur = color || 'red'
    if (cycle) for (const [c, t0] of cycle) if (t >= t0) cur = c
    const blink = Math.floor(performance.now() / 450) % 2
    lamps.forEach((c, i) => {
      const m = mats.current[i]; if (!m) return
      let lit = c === cur
      if (flash && lit) lit = kind === 'pair' ? blink === i : blink === 0
      m.color.set(lit ? LAMP[c] : '#1f2937'); m.emissive.set(lit ? LAMP[c] : '#000000'); m.emissiveIntensity = lit ? 5 : 0
    })
  })
  const h = kind === 'pair' ? .55 : lamps.length * .4 + .1
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[.07, .07, 3.2, 10]} /><meshStandardMaterial color="#334155" metalness={.5} /></mesh>
      <RoundedBox args={[kind === 'pair' ? 1 : .5, h, .4]} radius={.08} position={[0, 3.3 + h / 2 - .2, 0]} castShadow><meshStandardMaterial color="#111827" /></RoundedBox>
      {lamps.map((_c, i) => <mesh key={i} position={kind === 'pair' ? [i ? .24 : -.24, 3.38, .21] : [0, 3.3 + h - .45 - i * .4, .21]}>
        <sphereGeometry args={[.14, 16, 12]} /><meshStandardMaterial ref={m => { mats.current[i] = m }} color="#1f2937" toneMapped={false} /></mesh>)}
    </group>
  )
}

/** Traffic police officer. pose: "front" (arms open, facing you), "profile" (arms open, side to you), "raised" (one arm up), "angle". */
function Officer({ world, x, y, pose = 'front' }: { world: World; x: number; y: number; pose?: string }) {
  const p = world.to3(x, y)
  const navy = <meshStandardMaterial color="#1e3a8a" roughness={.7} />, white = <meshStandardMaterial color="#f8fafc" roughness={.5} />
  const arm = (side: number, rot: [number, number, number]) => (
    <group position={[side * .27, 1.55, 0]} rotation={rot}>
      <mesh position={[side * .32, 0, 0]} castShadow><boxGeometry args={[.62, .13, .13]} />{navy}</mesh>
      <mesh position={[side * .66, 0, 0]}><sphereGeometry args={[.08, 10, 8]} />{white}</mesh>
    </group>
  )
  const arms = pose === 'raised' ? [arm(1, [0, 0, Math.PI / 2]), arm(-1, [0, 0, -Math.PI / 2.4])]
    : pose === 'angle' ? [arm(1, [0, 0, 0]), arm(-1, [0, -Math.PI / 2, 0])]
    : [arm(1, [0, 0, 0]), arm(-1, [0, 0, 0])]
  return (
    <group position={p} rotation-y={pose === 'profile' ? Math.PI / 2 : 0} scale={1.35}>
      <mesh position={[0, .12, 0]} receiveShadow><cylinderGeometry args={[.7, .75, .24, 28]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      <mesh position={[0, 1.0, 0]} castShadow><capsuleGeometry args={[.26, .9, 6, 12]} />{navy}</mesh>
      <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[.27, .27, .08, 16]} />{white}</mesh>
      <mesh position={[0, 1.82, 0]} castShadow><sphereGeometry args={[.19, 16, 12]} /><meshStandardMaterial color="#e8b48f" /></mesh>
      <mesh position={[0, 1.98, 0]} castShadow><sphereGeometry args={[.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />{white}</mesh>
      {arms.map((a, i) => <group key={i}>{a}</group>)}
    </group>
  )
}

/** A white arrow painted in a lane, pointing up the road. dir: straight | left | right | straightLeft | straightRight | leftRight */
function RoadArrow({ world, x, y, dir = 'straight' }: { world: World; x: number; y: number; dir?: string }) {
  const geo = useMemo(() => {
    const shapes: THREE.Shape[] = []
    const straight = () => { const s = new THREE.Shape(); s.moveTo(-.12, 0); s.lineTo(.12, 0); s.lineTo(.12, 1.6); s.lineTo(.32, 1.6); s.lineTo(0, 2.15); s.lineTo(-.32, 1.6); s.lineTo(-.12, 1.6); s.lineTo(-.12, 0); return s }
    // a shaft that bends to one side and ends in a head pointing sideways
    const turn = (side: number) => {
      const s = new THREE.Shape(), k = side
      s.moveTo(-.12 * k, 0); s.lineTo(.12 * k, 0); s.lineTo(.12 * k, 1.0); s.lineTo(.55 * k, 1.0); s.lineTo(.55 * k, .78); s.lineTo(1.05 * k, 1.12); s.lineTo(.55 * k, 1.46); s.lineTo(.55 * k, 1.24); s.lineTo(-.12 * k, 1.24); s.lineTo(-.12 * k, 0)
      return s
    }
    if (dir === 'straight' || dir === 'straightLeft' || dir === 'straightRight') shapes.push(straight())
    if (dir === 'left' || dir === 'straightLeft' || dir === 'leftRight') shapes.push(turn(-1))
    if (dir === 'right' || dir === 'straightRight' || dir === 'leftRight') shapes.push(turn(1))
    const g = new THREE.ShapeGeometry(shapes); g.rotateX(-Math.PI / 2); g.scale(1.2, 1, 1.2); return g
  }, [dir])
  return <mesh geometry={geo} position={world.to3(x, y, .03)}><meshStandardMaterial color="#f8fafc" roughness={.6} side={THREE.DoubleSide} /></mesh>
}

/** Hatched traffic island painted on the road: a white border with diagonal stripes inside. */
function Hatch({ world, x, y, w, h }: { world: World; x: number; y: number; w: number; h: number }) {
  const parts = useMemo(() => {
    const out: THREE.BufferGeometry[] = []
    const e = 3
    out.push(quad(world, x, y, x + w, y + e, .03), quad(world, x, y + h - e, x + w, y + h, .03), quad(world, x, y, x + e, y + h, .03), quad(world, x + w - e, y, x + w, y + h, .03))
    // 45° stripes, clipped to the rectangle
    for (let c = x - h; c < x + w; c += 14) {
      const seg = (off: number) => {
        const pts: [number, number][] = []
        for (const [px, py] of [[c + off, y], [c + off + h, y + h]] as [number, number][]) pts.push([px, py])
        let [ax, ay] = pts[0], [bx, by] = pts[1]
        if (ax < x) { ay += x - ax; ax = x } if (bx > x + w) { by -= bx - (x + w); bx = x + w }
        return [[ax, ay], [bx, by]] as [number, number][]
      }
      const [[a0x, a0y], [b0x, b0y]] = seg(0), [[a1x, a1y], [b1x, b1y]] = seg(5)
      if (b0x - a0x < 2 || b1x - a1x < 2) continue
      const pos: number[] = []
      const P = (px: number, py: number) => { const v = world.to3(px, py, .03); pos.push(v.x, v.y, v.z) }
      P(a0x, a0y); P(b0x, b0y); P(b1x, b1y); P(a0x, a0y); P(b1x, b1y); P(a1x, a1y)
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); out.push(g)
    }
    return out
  }, [world, x, y, w, h])
  return <group>{parts.map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color="#f8fafc" roughness={.6} side={THREE.DoubleSide} /></mesh>)}</group>
}

/** Raised kerb along the road edge, painted in alternating yellow and black (no parking). */
function Kerb({ world, x, y0 = -300, y1 = 520 }: { world: World; x: number; y0?: number; y1?: number }) {
  const segs = useMemo(() => { const out: { p: THREE.Vector3; yellow: boolean }[] = []; let i = 0; for (let y = y0; y < y1; y += 18) out.push({ p: world.to3(x, y + 9, .09), yellow: i++ % 2 === 0 }); return out }, [world, x, y0, y1])
  return <group>{segs.map((s, i) => <mesh key={i} position={s.p} castShadow><boxGeometry args={[.32, .18, 18 * .06]} /><meshStandardMaterial color={s.yellow ? '#facc15' : '#111827'} roughness={.6} /></mesh>)}</group>
}

/** Letters or numbers painted on the road (e.g. "50", "BUS"), stretched along the road like real road writing. */
function RoadText({ world, x, y, text, color = '#f8fafc', size = 2.6 }: { world: World; x: number; y: number; text: string; color?: string; size?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512
    const g = c.getContext('2d')!; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = `900 ${text.length > 3 ? 110 : 170}px Arial, sans-serif`
    g.save(); g.translate(128, 256); g.scale(1, 1.9); g.fillText(text, 0, 0); g.restore()
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [text, color])
  return <mesh position={world.to3(x, y, .03)} rotation-x={-Math.PI / 2}><planeGeometry args={[size, size * 2]} /><meshStandardMaterial map={tex} transparent roughness={.6} /></mesh>
}

/** A picture from the PDF on a plane, optionally cropped to [u0, v0, u1, v1] (fractions, v from the top). */
export function CropImage({ img, crop, w, h, z = 0, basic = true }: { img: string; crop?: number[]; w: number; h: number; z?: number; basic?: boolean }) {
  const base = useTexture(img)
  const tex = useMemo(() => {
    const t = crop ? base.clone() : base
    t.colorSpace = THREE.SRGBColorSpace
    if (crop) { const [u0, v0, u1, v1] = crop; t.repeat.set(u1 - u0, v1 - v0); t.offset.set(u0, 1 - v1); t.needsUpdate = true }
    return t
  }, [base, crop])
  return <mesh position={[0, 0, z]}><planeGeometry args={[w, h]} />{basic ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial map={tex} roughness={.5} />}</mesh>
}
function SignImage({ img, crop }: { img: string; crop?: number[] }) {
  return <CropImage img={img} crop={crop} w={1.5} h={1.5} z={.051} />
}
/** A sign on a post. `img` = the official sign picture of the question. Faces the oncoming driver. */
function SignPost({ world, x, y, img, clock, t0 = 200, crop }: { world: World; x: number; y: number; img: string; clock: Clock; t0?: number; crop?: number[] }) {
  const g = useRef<THREE.Group>(null)
  const p = world.to3(x, y)
  useFrame(() => {
    const t = clock().time, k = THREE.MathUtils.clamp((t - t0) / 500, 0, 1)
    const e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) : 1          // springy pop-up
    if (g.current) g.current.scale.setScalar(Math.max(.001, e))
  })
  return (
    <group position={p}>
      <mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[.06, .06, 2.6, 10]} /><meshStandardMaterial color="#94a3b8" metalness={.6} roughness={.35} /></mesh>
      <group ref={g} position={[0, 3.1, 0]}>
        <RoundedBox args={[1.75, 1.75, .1]} radius={.08} castShadow><meshStandardMaterial color="#ffffff" roughness={.4} /></RoundedBox>
        <Suspense fallback={null}><SignImage img={img} crop={crop} /></Suspense>
        <mesh position={[0, 0, -.07]}><circleGeometry args={[1.6, 32]} /><meshBasicMaterial color="#fff7cc" transparent opacity={.25} toneMapped={false} /></mesh>
      </group>
    </group>
  )
}

function Line2D({ world, x0, x1, y, dashed }: { world: World; x0: number; x1: number; y: number; dashed?: boolean }) {
  const parts = useMemo(() => {
    if (!dashed) return [quad(world, x0, y - 3, x1, y + 3, .03)]
    const out: THREE.BufferGeometry[] = []; for (let x = x0; x < x1; x += 13) out.push(quad(world, x, y - 2.5, Math.min(x1, x + 7), y + 2.5, .03)); return out
  }, [world, x0, x1, y, dashed])
  return <group>{parts.map((g, i) => <mesh key={i} geometry={g}>{WHITE}</mesh>)}</group>
}

function Island({ world, x, y, w, h }: { world: World; x: number; y: number; w: number; h: number }) {
  const p = world.to3(x + w / 2, y + h / 2, .12)
  return <RoundedBox args={[w * .06, .24, h * .06]} radius={.1} position={p} castShadow receiveShadow><meshStandardMaterial color="#e2e8f0" roughness={.8} /></RoundedBox>
}

function BusStop({ world, x, y }: { world: World; x: number; y: number }) {
  const p = world.to3(x, y)
  useLabel('BUS', 'tag3d', p.clone().add(new THREE.Vector3(0, 3.1, 0)))
  return (
    <group position={p}>
      {[[-1.2, -.6], [1.2, -.6], [-1.2, .6], [1.2, .6]].map(([a, b], i) => <mesh key={i} position={[a, 1.2, b]} castShadow><boxGeometry args={[.08, 2.4, .08]} /><meshStandardMaterial color="#475569" /></mesh>)}
      <mesh position={[0, 2.45, 0]} castShadow><boxGeometry args={[2.8, .1, 1.5]} /><meshStandardMaterial color="#0ea5e9" transparent opacity={.75} /></mesh>
      <mesh position={[0, .5, .3]} castShadow><boxGeometry args={[2, .1, .4]} /><meshStandardMaterial color="#64748b" /></mesh>
    </group>
  )
}

function Patch({ world, x, y, w, h, color = '#3a3f4a' }: { world: World; x: number; y: number; w: number; h: number; color?: string }) {
  const g = useMemo(() => quad(world, x, y, x + w, y + h, .013, 2, 6), [world, x, y, w, h])
  return <mesh geometry={g} receiveShadow><meshStandardMaterial color={color} roughness={.92} /></mesh>
}

function AccelLane({ world }: { world: World }) {
  const g = useMemo(() => {
    const pos: number[] = [], idx: number[] = []
    const pts = [[250, 560], [310, 560], [310, 420], [250, 160]] as const
    pts.forEach(([x, y]) => { const p = world.to3(x, y, .012); pos.push(p.x, p.y, p.z) })
    idx.push(0, 3, 1, 1, 3, 2)
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo
  }, [world])
  return <group><mesh geometry={g} receiveShadow>{ASPHALT}</mesh>
    {Array.from({ length: 14 }, (_, i) => <mesh key={i} geometry={quad(world, 248, 420 - i * 20, 252, 410 - i * 20, .03)}>{WHITE}</mesh>)}</group>
}

function TramRails({ world, xs = [168, 192] }: { world: World; xs?: number[] }) {
  const g = useMemo(() => xs.map(x => ribbon(world, x - 180 - 1, x - 180 + 1, .03)), [world, xs])
  return <group>{g.map((geo, i) => <mesh key={i} geometry={geo}><meshStandardMaterial color="#cbd5e1" metalness={.9} roughness={.25} /></mesh>)}</group>
}

function Hazard({ world, x, y, emoji, clock, t0 }: { world: World; x: number; y: number; emoji: string; clock: Clock; t0: number }) {
  const lab = useLabel(emoji, 'hz3d', world.to3(x, y, 2.4))
  useFrame(() => { lab.el.current?.classList.toggle('on', clock().time >= t0) })
  return null
}

function Label({ world, x, y, text, clock, t0 = 0, big }: { world: World; x: number; y: number; text: string; clock: Clock; t0?: number; big?: boolean }) {
  const lab = useLabel(text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)), `tag3d lbl ${big ? 'big' : ''}`, world.to3(x, y, big ? 3 : 1.8))
  useFrame(() => { lab.el.current?.classList.toggle('on', clock().time >= t0) })
  return null
}

/** A junction with arms at any angle (deg, 0 = up the road): a round asphalt centre plus straight arms with a dashed middle line. */
function Radial({ world, arms }: { world: World; arms: number[] }) {
  const c = world.to3(180, 210)
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, .012, 0]} receiveShadow><circleGeometry args={[6, 48]} /><meshStandardMaterial color="#3a3f4a" roughness={.92} /></mesh>
      {arms.map(a => (
        <group key={a} rotation-y={-a * Math.PI / 180}>
          <mesh rotation-x={-Math.PI / 2} position={[0, .01, -12]} receiveShadow><planeGeometry args={[5.2, 24]} /><meshStandardMaterial color="#3a3f4a" roughness={.92} /></mesh>
          {[-2.5, 2.5].map(x => <mesh key={x} rotation-x={-Math.PI / 2} position={[x, .011, -11.5]}><planeGeometry args={[.12, 19]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
          {Array.from({ length: 6 }, (_, i) => <mesh key={i} rotation-x={-Math.PI / 2} position={[0, .013, -7.5 - i * 3]}><planeGeometry args={[.12, 1.5]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
        </group>))}
    </group>
  )
}

/** Low houses on both sides of the road for town / urban rules. */
function Town({ world }: { world: World }) {
  const houses = useMemo(() => {
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const out: { p: THREE.Vector3; w: number; d: number; h: number; c: string; roof: string; side: number }[] = []
    const walls = ['#f1e4c9', '#e9c9a4', '#d9e2ec', '#f4d6cc', '#e7e5e4', '#fde68a']
    for (const side of [-1, 1]) for (let y = 470; y > -380; y -= 88 + rnd() * 30) {
      const off = 128 + rnd() * 30
      out.push({ p: world.to3(180 + side * (off + 40), y), w: 4.2 + rnd() * 1.5, d: 4.4 + rnd() * 1.6, h: 3.2 + rnd() * 3.6, c: walls[Math.floor(rnd() * walls.length)], roof: rnd() < .5 ? '#b45309' : '#9a3412', side })
    }
    return out
  }, [world])
  const walk = useMemo(() => [-1, 1].map(s => ribbon(world, s * 92, s * 120, .1)), [world])
  return (
    <group>
      {walk.map((g, i) => <mesh key={i} geometry={g} receiveShadow><meshStandardMaterial color="#cbd5e1" roughness={.9} /></mesh>)}
      {houses.map((h, i) => (
        <group key={i} position={h.p}>
          <mesh position={[0, h.h / 2, 0]} castShadow receiveShadow><boxGeometry args={[h.w, h.h, h.d]} /><meshStandardMaterial color={h.c} roughness={.85} /></mesh>
          <mesh position={[0, h.h + .7, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[Math.max(h.w, h.d) * .78, 1.4, 4]} /><meshStandardMaterial color={h.roof} roughness={.8} flatShading /></mesh>
          {[-.25, .25].map(f => <mesh key={f} position={[-h.side * (h.w / 2 + .01), h.h * .6, f * h.d]} rotation-y={-h.side * Math.PI / 2}><planeGeometry args={[.8, .9]} /><meshStandardMaterial color="#334155" emissive="#fde68a" emissiveIntensity={.15} /></mesh>)}
        </group>))}
    </group>
  )
}

/** A round speed-limit sign drawn on a canvas (red ring, the number in the middle). */
function SpeedSign({ world, x, y, value, clock, t0 = 0 }: { world: World; x: number; y: number; value: number; clock: Clock; t0?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#dc2626'; g.lineWidth = 34; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#111'; g.font = `900 ${value >= 100 ? 92 : 112}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(value), 128, 136)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
  }, [value])
  const grp = useRef<THREE.Group>(null)
  const p = world.to3(x, y)
  useFrame(() => {
    const k = THREE.MathUtils.clamp((clock().time - t0) / 500, 0, 1), e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) : 1
    grp.current?.scale.setScalar(Math.max(.001, e))
  })
  return (
    <group position={p}>
      <mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[.06, .06, 2.6, 10]} /><meshStandardMaterial color="#94a3b8" metalness={.6} roughness={.35} /></mesh>
      <group ref={grp} position={[0, 3.1, 0]}>
        <mesh castShadow rotation-x={Math.PI / 2}><cylinderGeometry args={[.86, .86, .06, 40]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
                <mesh position={[0, 0, .035]}><circleGeometry args={[.84, 40]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      </group>
    </group>
  )
}

function Wind({ world, clock }: { world: World; clock: Clock }) {
  const grp = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = clock().time / 1000
    grp.current?.children.forEach((c, i) => { c.position.x = ((t * 14 + i * 7) % 40) - 20; (c as THREE.Mesh).visible = clock().time > 1500 })
  })
  const base = world.to3(180, 220, 1.6)
  return <group ref={grp} position={base}>{Array.from({ length: 8 }, (_, i) => (
    <mesh key={i} position={[0, (i % 3) * .6, -6 + i * 1.6]} rotation-z={Math.PI / 2}><cylinderGeometry args={[.03, .03, 3, 6]} /><meshBasicMaterial color="#e0f2fe" transparent opacity={.7} toneMapped={false} /></mesh>))}</group>
}

export function Props({ world, clock }: { world: World; clock: Clock }) {
  return (
    <group>
      {world.props.map((p: Prop, i: number) => {
        switch (p.type) {
          case 'junction': return <CrossRoad key={i} world={world} y={p.y} h={p.h ?? 60} />
          case 'sideRoad': return <CrossRoad key={i} world={world} y={p.y} h={p.h ?? 60} x0={p.x0 ?? -520} x1={p.x1 ?? 112} />
          case 'rails': return <Rails key={i} world={world} y={p.y} />
          case 'zebra': return <Zebra key={i} world={world} y={p.y} x0={p.x0} w={p.w} />
          case 'light': return <TrafficLight key={i} world={world} x={p.x} y={p.y} color={p.color} cycle={p.cycle} flash={p.flash} kind={p.kind} clock={clock} scale={p.scale} />
          case 'officer': return <Officer key={i} world={world} x={p.x} y={p.y} pose={p.pose} />
          case 'arrow': return <RoadArrow key={i} world={world} x={p.x} y={p.y} dir={p.dir} />
          case 'hatch': return <Hatch key={i} world={world} x={p.x} y={p.y} w={p.w} h={p.h} />
          case 'kerb': return <Kerb key={i} world={world} x={p.x} y0={p.y0} y1={p.y1} />
          case 'roadText': return <RoadText key={i} world={world} x={p.x} y={p.y} text={p.text} color={p.color} size={p.size} />
          case 'sign': return p.img ? <SignPost key={i} world={world} x={p.x} y={p.y} img={p.img} clock={clock} t0={p.t0} crop={p.crop} /> : null
          case 'stopLine': return <Line2D key={i} world={world} x0={182} x1={248} y={p.y} dashed={p.dashed} />
          case 'island': return <Island key={i} world={world} x={p.x} y={p.y} w={p.w} h={p.h} />
          case 'busStop': return <BusStop key={i} world={world} x={p.x} y={p.y} />
          case 'patch': return <Patch key={i} world={world} x={p.x} y={p.y} w={p.w} h={p.h} color={p.color} />
          case 'accelLane': return <AccelLane key={i} world={world} />
          case 'tramRails': return <TramRails key={i} world={world} xs={p.xs} />
          case 'hazard': return <Hazard key={i} world={world} x={p.x} y={p.y} emoji={p.emoji} clock={clock} t0={p.t0 ?? 0} />
          case 'town': return <Town key={i} world={world} />
          case 'radial': return <Radial key={i} world={world} arms={p.arms} />
          case 'speedSign': return <SpeedSign key={i} world={world} x={p.x} y={p.y} value={p.value} clock={clock} t0={p.t0} />
          case 'wind': return <Wind key={i} world={world} clock={clock} />
          case 'label': return <Label key={i} world={world} x={p.x} y={p.y} text={p.text} clock={clock} t0={p.t0} big={p.big} />
          default: return null
        }
      })}
    </group>
  )
}
