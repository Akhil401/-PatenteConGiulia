// A 3D vehicle that follows an actor of the 2D scene timeline.
import { RoundedBox } from '@react-three/drei'
import { tr, useLabel } from './labels'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { CropImage } from './Props'
import * as THREE from 'three'
import { sample } from '../lib/scenes/engine.js'
import type { World } from './world'

export interface Panel { img: string; crop?: number[]; mode: 'pair' | 'single' | 'load'; w: number; h: number }
export interface Actor { id: string; kind: string; color?: string; keys: Record<string, any>[]; cone?: number; beam?: boolean; panel?: Panel; tag?: { text: string; ok: boolean; t0: number; cls?: string } }

/** A ✓ / ✕ bubble that rides above a vehicle (allowed / not allowed). */
function VehTag({ target, tag, clock }: { target: React.RefObject<THREE.Group | null>; tag: NonNullable<Actor['tag']>; clock: Clock }) {
  const lab = useLabel(tag.text, `m3d ${tag.cls || (tag.ok ? 'ok' : 'no')}`, [0, 0, 0])
  useFrame(() => {
    if (target.current) lab.pos.current.copy(target.current.position).add(new THREE.Vector3(0, 4.4, 0))
    lab.el.current?.classList.toggle('on', clock().time >= tag.t0)
  })
  return null
}

/** Reflective panels from the PDF on the back of a truck (or on a load sticking out of it). */
function RearPanels({ p }: { p: Panel }) {
  const z = 3.99
  if (p.mode === 'load') return (
    <group>
      {[-.25, 0, .25].map((x, i) => <mesh key={i} position={[x, 2.1 + (i % 2) * .22, z + .9]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[.13, .13, 3.4, 14]} /><meshStandardMaterial color="#94a3b8" metalness={.7} roughness={.3} /></mesh>)}
      <group position={[0, 2.1, z + 2.62]}><Suspense fallback={null}><CropImage img={p.img} crop={p.crop} w={p.w} h={p.h} /></Suspense></group>
    </group>
  )
  const xs = p.mode === 'pair' ? [-.68, .68] : [0]
  return <group>{xs.map(x => <group key={x} position={[x, p.mode === 'pair' ? .62 : 1.25, z]}><Suspense fallback={null}><CropImage img={p.img} crop={p.crop} w={p.w} h={p.h} /></Suspense></group>)}</group>
}
export type Clock = () => { time: number }

const AMBER = new THREE.Color('#ffb020'), RED = new THREE.Color('#ff2a1f'), BLUE = new THREE.Color('#3b82f6')

function Lamp({ pos, size = [.32, .12, .05], color, intensity, refFn }: { pos: [number, number, number]; size?: [number, number, number]; color: THREE.Color | string; intensity: number; refFn?: (m: THREE.MeshStandardMaterial | null) => void }) {
  return <mesh position={pos}><boxGeometry args={size} /><meshStandardMaterial ref={refFn} color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} /></mesh>
}

/** Car body parts per kind (front of the vehicle = -Z). Returns length for wheel placement. */
function Body({ kind, color, lamps }: { kind: string; color: string; lamps: { ind: THREE.MeshStandardMaterial[]; brake: THREE.MeshStandardMaterial[]; siren: THREE.MeshStandardMaterial[] } }) {
  const glass = <meshPhysicalMaterial color="#141b26" metalness={.6} roughness={.08} clearcoat={1} />
  const paint = (c: string) => <meshPhysicalMaterial color={c} metalness={.35} roughness={.32} clearcoat={1} clearcoatRoughness={.15} />
  const addInd = (m: THREE.MeshStandardMaterial | null) => { if (m && !lamps.ind.includes(m)) lamps.ind.push(m) }
  const addBrake = (m: THREE.MeshStandardMaterial | null) => { if (m && !lamps.brake.includes(m)) lamps.brake.push(m) }
  const addSiren = (m: THREE.MeshStandardMaterial | null) => { if (m && !lamps.siren.includes(m)) lamps.siren.push(m) }
  if (kind === 'truck') return (
    <group>
      <RoundedBox args={[2.3, 2.1, 2.2]} radius={.18} position={[0, 1.45, -3.0]} castShadow>{paint(color || '#f59e0b')}</RoundedBox>
      <mesh position={[0, 1.95, -4.08]}><boxGeometry args={[2.0, .8, .05]} />{glass}</mesh>
      <RoundedBox args={[2.45, 2.7, 6.0]} radius={.08} position={[0, 1.85, .95]} castShadow><meshStandardMaterial color="#f1f5f9" roughness={.6} /></RoundedBox>
      <Lamp pos={[-.85, .75, -4.12]} color="#fff7d6" intensity={2.2} /><Lamp pos={[.85, .75, -4.12]} color="#fff7d6" intensity={2.2} />
      <Lamp pos={[-.95, .7, 3.97]} color={RED} intensity={.6} refFn={addBrake} /><Lamp pos={[.95, .7, 3.97]} color={RED} intensity={.6} refFn={addBrake} />
      <Lamp pos={[-1.24, .8, -4.0]} size={[.05, .12, .22]} color={AMBER} intensity={0} refFn={addInd} /><Lamp pos={[1.24, .8, -4.0]} size={[.05, .12, .22]} color={AMBER} intensity={0} refFn={addInd} />
    </group>
  )
  const isAmb = kind === 'ambulance', isPol = kind === 'police', isBus = kind === 'bus' || kind === 'tram'
  if (isBus) return (
    <group>
      <RoundedBox args={[2.5, 2.9, 11]} radius={.25} position={[0, 1.7, 0]} castShadow>{paint(color || (kind === 'tram' ? '#ef4444' : '#14b8a6'))}</RoundedBox>
      <mesh position={[0, 2.1, 0]}><boxGeometry args={[2.52, .8, 9.6]} />{glass}</mesh>
    </group>
  )
  if (kind === 'moto' || kind === 'bike') return (
    <group>
      <mesh position={[0, .55, 0]} castShadow><boxGeometry args={[.25, .5, 1.7]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh position={[0, 1.25, .1]} castShadow><capsuleGeometry args={[.22, .5, 6, 12]} /><meshStandardMaterial color={color || '#f97316'} /></mesh>
      <mesh position={[0, 1.75, .05]} castShadow><sphereGeometry args={[.19, 16, 12]} /><meshStandardMaterial color="#111827" roughness={.3} /></mesh>
    </group>
  )
  const c = isAmb ? '#fafafa' : isPol ? '#f8fafc' : color || '#94a3b8'
  return (
    <group>
      <RoundedBox args={[1.86, .62, 4.4]} radius={.22} smoothness={4} position={[0, .58, 0]} castShadow>{paint(c)}</RoundedBox>
      <RoundedBox args={[1.6, .56, isAmb ? 3.4 : 2.3]} radius={.2} smoothness={4} position={[0, 1.12, isAmb ? .35 : .25]} castShadow>{isAmb ? paint('#fafafa') : glass}</RoundedBox>
      {isPol && <mesh position={[0, .62, 0]}><boxGeometry args={[1.88, .14, 4.2]} /><meshStandardMaterial color="#1d4ed8" /></mesh>}
      {isAmb && <><mesh position={[0, .9, 1.4]}><boxGeometry args={[1.9, .14, 1.6]} /><meshStandardMaterial color="#ef4444" /></mesh></>}
      {(isPol || isAmb) && <><Lamp pos={[-.35, isAmb ? 1.46 : 1.44, isAmb ? -1.1 : .1]} size={[.5, .14, .26]} color={BLUE} intensity={0} refFn={addSiren} /><Lamp pos={[.35, isAmb ? 1.46 : 1.44, isAmb ? -1.1 : .1]} size={[.5, .14, .26]} color={BLUE} intensity={0} refFn={addSiren} /></>}
      <Lamp pos={[-.62, .62, -2.21]} color="#fff7d6" intensity={2.4} /><Lamp pos={[.62, .62, -2.21]} color="#fff7d6" intensity={2.4} />
      <Lamp pos={[-.66, .66, 2.21]} color={RED} intensity={.7} refFn={addBrake} /><Lamp pos={[.66, .66, 2.21]} color={RED} intensity={.7} refFn={addBrake} />
      <Lamp pos={[-.94, .6, -1.95]} size={[.05, .1, .26]} color={AMBER} intensity={0} refFn={addInd} /><Lamp pos={[.94, .6, -1.95]} size={[.05, .1, .26]} color={AMBER} intensity={0} refFn={addInd} />
      <Lamp pos={[-.94, .62, 1.95]} size={[.05, .1, .26]} color={AMBER} intensity={0} refFn={addInd} /><Lamp pos={[.94, .62, 1.95]} size={[.05, .1, .26]} color={AMBER} intensity={0} refFn={addInd} />
      <mesh position={[-.98, .95, -.75]} castShadow><boxGeometry args={[.16, .1, .2]} />{paint(c)}</mesh><mesh position={[.98, .95, -.75]} castShadow><boxGeometry args={[.16, .1, .2]} />{paint(c)}</mesh>
    </group>
  )
}

/** The floating "YOU" tag that follows your car. */
function YouTag({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const lab = useLabel(tr('YOU', 'TU'), 'you3d', [0, 0, 0])
  useFrame(() => { if (target.current) lab.pos.current.copy(target.current.position).add(new THREE.Vector3(0, 2.6, 0)) })
  return null
}

export function Vehicle({ actor, world, clock, isYou }: { actor: Actor; world: World; clock: Clock; isYou: boolean }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const lamps = useMemo(() => ({ ind: [] as THREE.MeshStandardMaterial[], brake: [] as THREE.MeshStandardMaterial[], siren: [] as THREE.MeshStandardMaterial[] }), [])
  const st = useRef({ yaw: 0, roll: 0, spin: 0, last: null as THREE.Vector3 | null, init: false })
  const explicitR = actor.keys.some(k => 'r' in k)
  const kind = actor.kind === 'you' ? 'car' : actor.kind
  const len = kind === 'truck' ? 8 : kind === 'bus' || kind === 'tram' ? 11 : kind === 'moto' || kind === 'bike' ? 1.7 : 4.4
  // "yb" in the space scenes is YOUR car too (the B overtake); a caravan is your car towing one
  const isYouLike = isYou || actor.id === 'yb' || actor.kind === 'caravan'
  const color = isYouLike ? '#2563eb' : actor.color
  const isPed = kind === 'ped' || kind === 'officer'

  useFrame((state, dt) => {
    const g = root.current; if (!g) return
    const t = clock().time
    const s = sample(actor, t) as any, s2 = sample(actor, t + 90)
    const p = world.to3(s.x, s.y), p2 = world.to3(s2.x, s2.y)
    g.position.copy(p)
    const dx = p2.x - p.x, dz = p2.z - p.z, dist = Math.hypot(dx, dz)
    const S0 = st.current
    if (!S0.init) {   // face the first real movement
      for (let i = 0; i < actor.keys.length - 1; i++) {
        const a = world.to3(actor.keys[i].x, actor.keys[i].y), b = world.to3(actor.keys[i + 1].x, actor.keys[i + 1].y)
        if (a.distanceTo(b) > .1) { S0.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z)); break }
      }
      S0.init = true
    }
    let yaw = S0.yaw
    if (explicitR) yaw = -((s.r || 0) * Math.PI / 180)
    else if (dist > .004) yaw = Math.atan2(-dx, -dz)
    const dYaw = Math.atan2(Math.sin(yaw - S0.yaw), Math.cos(yaw - S0.yaw))
    S0.yaw += dYaw * Math.min(1, dt * 10)
    S0.roll += ((-dYaw / Math.max(dt, .001)) * .02 - S0.roll) * Math.min(1, dt * 6)
    const pitch = Math.atan2(p2.y - p.y, Math.max(dist, .001)) * (dist > .004 ? 1 : 0)
    g.rotation.set(pitch, S0.yaw, 0, 'YXZ')
    if (body.current && !isPed) {
      body.current.rotation.z = THREE.MathUtils.clamp(S0.roll, -.07, .07)
      body.current.position.y = Math.sin(state.clock.elapsedTime * 9 + p.z) * .012 * Math.min(1, dist * 20)
    }
    if (S0.last) S0.spin += S0.last.distanceTo(p) / .34
    S0.last = p.clone()
    if (wheels.current) wheels.current.children.forEach(w => { w.rotation.x = -S0.spin })
    const on = Math.floor(performance.now() / 380) % 2 === 0
    const L = s.blink === 'L' || s.blink === 'H', R = s.blink === 'R' || s.blink === 'H'
    lamps.ind.forEach(m => { const left = (m as any).__x ?? 0; m.emissiveIntensity = on && ((left < 0 && L) || (left > 0 && R)) ? 6 : 0 })
    lamps.brake.forEach(m => { m.emissiveIntensity = s.brake ? 7 : .7 })
    lamps.siren.forEach((m, i) => { m.emissiveIntensity = s.flash ? ((on ? i % 2 === 0 : i % 2 === 1) ? 9 : .4) : 0 })
    g.visible = !s.hide
    if (ring.current) { const k = 1 + Math.sin(state.clock.elapsedTime * 3) * .06; ring.current.scale.set(k, k, k) }
  })

  // remember which side each indicator is on (for left/right blinking)
  const tagSides = (grp: THREE.Group | null) => {
    if (!grp) return
    grp.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && lamps.ind.includes(m)) (m as any).__x = o.position.x })
  }

  if (isPed) return (
    <group ref={root}>
      <mesh position={[0, .8, 0]} castShadow><capsuleGeometry args={[.25, .9, 6, 12]} /><meshStandardMaterial color={kind === 'officer' ? '#1e3a8a' : actor.color || '#f59e0b'} /></mesh>
      <mesh position={[0, 1.6, 0]} castShadow><sphereGeometry args={[.2, 16, 12]} /><meshStandardMaterial color="#e8b48f" /></mesh>
    </group>
  )
  const wz = len / 2 - (kind === 'truck' ? 1.4 : .95), wx = kind === 'truck' ? 1.05 : .86
  return (
    <group ref={root}>
      {isYouLike && <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, .03, 0]}><ringGeometry args={[2.3, 2.75, 48]} /><meshBasicMaterial color="#60a5fa" transparent opacity={.55} toneMapped={false} /></mesh>}
      <group ref={g2 => { body.current = g2; tagSides(g2) }}><Body kind={kind === 'caravan' ? 'car' : kind} color={color || ''} lamps={lamps} /></group>
      {kind === 'caravan' && <group position={[0, 0, 4.6]}>
        <mesh position={[0, .45, -1.6]}><boxGeometry args={[.12, .12, 1.2]} /><meshStandardMaterial color="#334155" /></mesh>
        <RoundedBox args={[2.1, 2.2, 4.2]} radius={.25} position={[0, 1.45, .6]} castShadow><meshStandardMaterial color="#f8fafc" roughness={.5} /></RoundedBox>
        <mesh position={[1.06, 1.7, .6]}><boxGeometry args={[.02, .6, 1.4]} /><meshStandardMaterial color="#1d2633" /></mesh>
        {[-.95, .95].map(x => <mesh key={x} position={[x, .36, .9]} rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[.36, .36, .26, 18]} /><meshStandardMaterial color="#111318" /></mesh>)}
      </group>}
      {actor.panel && <RearPanels p={actor.panel} />}
      {actor.beam && <mesh position={[0, .7, -7.5]} rotation-x={-Math.PI / 2}><coneGeometry args={[3.2, 11, 24, 1, true]} /><meshBasicMaterial color="#fff7c2" transparent opacity={.22} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      {isYou && <YouTag target={root} />}
      {actor.tag && <VehTag target={root} tag={actor.tag} clock={clock} />}
      {kind !== 'moto' && kind !== 'bike' && <group ref={wheels}>
        {[[-wx, -wz], [wx, -wz], [-wx, wz], [wx, wz], ...(kind === 'truck' ? [[-wx, wz - 1.4], [wx, wz - 1.4]] : [])].map(([x, z], i) => (
          <group key={i} position={[x, .36, z]}>
            <mesh rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[.36, .36, .28, 20]} /><meshStandardMaterial color="#111318" roughness={.85} /></mesh>
            <mesh rotation-z={Math.PI / 2} position={[x < 0 ? -.145 : .145, 0, 0]}><cylinderGeometry args={[.2, .2, .02, 6]} /><meshStandardMaterial color="#9ca3af" metalness={.8} roughness={.3} /></mesh>
          </group>))}
      </group>}
    </group>
  )
}
