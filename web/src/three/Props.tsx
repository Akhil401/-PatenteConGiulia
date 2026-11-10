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

function TrafficLight({ world, x, y, color }: { world: World; x: number; y: number; color: string }) {
  const p = world.to3(x, y)
  const on = (c: string) => (c === color ? { red: '#ff3b30', amber: '#ffb020', green: '#22c55e' }[c]! : '#1f2937')
  return (
    <group position={p}>
      <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[.07, .07, 3.2, 10]} /><meshStandardMaterial color="#334155" metalness={.5} /></mesh>
      <RoundedBox args={[.5, 1.3, .4]} radius={.08} position={[0, 3.4, 0]} castShadow><meshStandardMaterial color="#111827" /></RoundedBox>
      {(['red', 'amber', 'green'] as const).map((c, i) => <mesh key={c} position={[0, 3.8 - i * .4, .21]}><sphereGeometry args={[.14, 16, 12]} /><meshStandardMaterial color={on(c)} emissive={on(c)} emissiveIntensity={c === color ? 5 : 0} toneMapped={false} /></mesh>)}
    </group>
  )
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
          case 'light': return <TrafficLight key={i} world={world} x={p.x} y={p.y} color={p.color} />
          case 'sign': return p.img ? <SignPost key={i} world={world} x={p.x} y={p.y} img={p.img} clock={clock} t0={p.t0} crop={p.crop} /> : null
          case 'stopLine': return <Line2D key={i} world={world} x0={182} x1={248} y={p.y} dashed={p.dashed} />
          case 'island': return <Island key={i} world={world} x={p.x} y={p.y} w={p.w} h={p.h} />
          case 'busStop': return <BusStop key={i} world={world} x={p.x} y={p.y} />
          case 'patch': return <Patch key={i} world={world} x={p.x} y={p.y} w={p.w} h={p.h} color={p.color} />
          case 'accelLane': return <AccelLane key={i} world={world} />
          case 'tramRails': return <TramRails key={i} world={world} xs={p.xs} />
          case 'hazard': return <Hazard key={i} world={world} x={p.x} y={p.y} emoji={p.emoji} clock={clock} t0={p.t0 ?? 0} />
          case 'town': return <Town key={i} world={world} />
          case 'speedSign': return <SpeedSign key={i} world={world} x={p.x} y={p.y} value={p.value} clock={clock} t0={p.t0} />
          case 'wind': return <Wind key={i} world={world} clock={clock} />
          case 'label': return <Label key={i} world={world} x={p.x} y={p.y} text={p.text} clock={clock} t0={p.t0} big={p.big} />
          default: return null
        }
      })}
    </group>
  )
}
