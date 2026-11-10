// 3D "studio" scenes for questions without a road scene: the official figure, a rule card, or the parts of the road.
import { Float, RoundedBox, Sparkles, useTexture } from '@react-three/drei'
import { useLabel } from './labels'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Clock } from './Vehicle'
import type { World3D } from './world'

function Backdrop({ from = '#1e1b4b', to = '#4338ca' }: { from?: string; to?: string }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { a: { value: new THREE.Color(from) }, b: { value: new THREE.Color(to) } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 a; uniform vec3 b; varying vec3 p; void main(){ gl_FragColor = vec4(mix(a, b, smoothstep(-.4, .8, p.y)), 1.); }',
  }), [from, to])
  return <mesh material={mat}><sphereGeometry args={[60, 32, 16]} /></mesh>
}

/** Slow dolly + orbit around a target. */
function Orbit({ target, radius = 9, height = 2.5, speed = .12, clock }: { target: [number, number, number]; radius?: number; height?: number; speed?: number; clock: Clock }) {
  const { camera } = useThree()
  useFrame(() => {
    const t = clock().time / 1000
    const a = Math.sin(t * speed * 2) * .35
    const r = radius - Math.min(1.5, t * .25)
    camera.position.set(target[0] + Math.sin(a) * r, target[1] + height, target[2] + Math.cos(a) * r)
    camera.lookAt(target[0], target[1], target[2])
  })
  return null
}

/**
 * The text cards of a studio scene, drawn as a normal overlay on top of the 3D canvas
 * and revealed by the scene timeline (read with requestAnimationFrame).
 */
export function StudioCards({ w, clock }: { w: World3D; clock: Clock }) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const lines: string[] = w.studio === 'roadparts' ? [] : w.lines || []
  const icons: string[] = (w.studio === 'rulecard' || w.cards === 'rule') ? w.icons || [] : []
  const start = w.start ?? (w.studio === 'figure' ? 1200 : 400), per = w.per ?? 1500
  const times = [(w.studio === 'rulecard' || w.cards === 'rule') ? 0 : Infinity, ...lines.map((_, i) => start + i * per)]
  useEffect(() => {
    let raf = 0
    const tick = () => { const t = clock().time; times.forEach((t0, i) => refs.current[i]?.classList.toggle('on', t >= t0)); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })
  if (!lines.length) return null
  return (
    <div className={`stack3d ${w.studio || (w.cards === 'rule' ? 'rulecard' : 'figure')}`}>
      {(w.studio === 'rulecard' || w.cards === 'rule') && <div ref={el => { refs.current[0] = el }} className="pill3d">{w.title || 'THE RULE'}</div>}
      {lines.map((l, i) => <div key={i} ref={el => { refs.current[i + 1] = el }} className="card3d">{icons[i] && <span className="ic">{icons[i]}</span>}<span>{l}</span></div>)}
    </div>
  )
}

function Picture({ img }: { img: string }) {
  const tex = useTexture(img); tex.colorSpace = THREE.SRGBColorSpace
  return <mesh position={[0, 0, .13]}><planeGeometry args={[3.6, 3.6]} /><meshBasicMaterial map={tex} /></mesh>
}

function FigureStudio({ w, clock }: { w: World3D; clock: Clock }) {
  return (
    <group>
      <Backdrop />
      <ambientLight intensity={.6} />
      <spotLight position={[4, 8, 6]} angle={.5} penumbra={.6} intensity={60} castShadow />
      <Float speed={1.4} rotationIntensity={.25} floatIntensity={.5}>
        <group position={[0, 2.6, 0]}>
          <RoundedBox args={[4.2, 4.2, .24]} radius={.18} castShadow><meshPhysicalMaterial color="#ffffff" roughness={.25} clearcoat={1} /></RoundedBox>
          {w.img && <Suspense fallback={null}><Picture img={w.img} /></Suspense>}
        </group>
      </Float>
      <mesh rotation-x={-Math.PI / 2} position={[0, -.6, 0]} receiveShadow><circleGeometry args={[6, 48]} /><meshStandardMaterial color="#312e81" roughness={.4} metalness={.2} /></mesh>
      <Sparkles count={60} scale={[10, 6, 6]} size={3} speed={.3} color="#c7d2fe" />
      <Orbit target={[0, .6, 0]} radius={13} height={1.2} clock={clock} />
    </group>
  )
}

function RuleStudio({ w, clock }: { w: World3D; clock: Clock }) {
  const icons: string[] = w.icons || []
  return (
    <group>
      <Backdrop from="#0f172a" to="#4338ca" />
      <ambientLight intensity={.8} />
      <pointLight position={[3, 4, 5]} intensity={40} color="#a5b4fc" />
      {icons.map((ic, i) => <IconOrb key={i} icon={ic} i={i} n={icons.length} t0={(w.start ?? 400) + i * (w.per ?? 1500)} clock={clock} />)}
      <Sparkles count={80} scale={[12, 8, 6]} size={3.5} speed={.35} color="#fde68a" />
      <Orbit target={[0, 1.2, 0]} radius={11} height={.8} speed={.1} clock={clock} />
    </group>
  )
}

/** A glossy coloured orb with the line's icon, popping in above the cards. */
function IconOrb({ icon, i, n, t0, clock }: { icon: string; i: number; n: number; t0: number; clock: Clock }) {
  const g = useRef<THREE.Group>(null)
  const x = (i - (n - 1) / 2) * 2.4
  const lab = useLabel(icon, 'orb3d', [x, 3, 0])
  useFrame(state => {
    const t = clock().time, k = THREE.MathUtils.clamp((t - t0) / 600, 0, 1)
    const e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 8) : 1
    if (g.current) { g.current.scale.setScalar(Math.max(.001, e)); g.current.position.y = 3 + Math.sin(state.clock.elapsedTime * 1.5 + i) * .15; g.current.rotation.y += .01; lab.pos.current.copy(g.current.position) }
    lab.el.current?.classList.toggle('on', t >= t0 + 200)
  })
  const hue = ['#6366f1', '#f59e0b', '#10b981', '#ec4899'][i % 4]
  return (
    <group ref={g} position={[x, 3, 0]}>
      <mesh castShadow><sphereGeometry args={[.85, 40, 28]} /><meshPhysicalMaterial color={hue} roughness={.12} metalness={.1} clearcoat={1} clearcoatRoughness={.05} emissive={hue} emissiveIntensity={.25} /></mesh>
      <mesh scale={1.18}><sphereGeometry args={[.85, 32, 20]} /><meshBasicMaterial color={hue} transparent opacity={.12} toneMapped={false} /></mesh>
    </group>
  )
}

const PART_BOX: Record<string, [number, number, number, number, number]> = {
  // [x, z, width, depth, height] in metres on the studio street
  carreggiata: [0, 0, 7.2, 30, .06], corsia: [1.8, 0, 3.4, 30, .07], banchina: [4.2, 0, .9, 30, .07], marciapiede: [5.9, 0, 2.2, 30, .25],
  pistaCiclabile: [-5.0, 0, 1.4, 30, .06], spartitraffico: [0, 0, .8, 30, .3], passaggioPedonale: [0, 4, 7.2, 2.4, .07],
  intersezione: [0, -7, 7.2, 7, .07], corsiaEmergenza: [4.2, 0, .9, 30, .07],
}
function RoadPartsStudio({ w, clock }: { w: World3D; clock: Clock }) {
  const box = PART_BOX[w.part] || PART_BOX.carreggiata
  const glow = useRef<THREE.Mesh>(null)
  const lbl = useLabel(String(w.label || ''), 'tag3d lbl big', [box[0], 2.2, box[1]])
  useFrame(state => {
    const on = clock().time > 1200
    if (glow.current) { glow.current.visible = on; (glow.current.material as THREE.MeshBasicMaterial).opacity = .35 + Math.sin(state.clock.elapsedTime * 4) * .15 }
    lbl.el.current?.classList.toggle('on', on)
  })
  const stripes = useMemo(() => Array.from({ length: 8 }, (_, i) => -3.2 + i * .9), [])
  return (
    <group>
      <color attach="background" args={['#bfdbfe']} />
      <hemisphereLight args={['#e0f2fe', '#4d6b3a', .8]} />
      <directionalLight position={[8, 14, 6]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -.02, 0]} receiveShadow><planeGeometry args={[60, 60]} /><meshStandardMaterial color="#86b96a" /></mesh>
      {/* carriageway, verges, pavements, cycle lane, median, crossing, junction */}
      <mesh position={[0, .02, 0]} receiveShadow><boxGeometry args={[7.2, .04, 30]} /><meshStandardMaterial color="#3a3f4a" roughness={.9} /></mesh>
      <mesh position={[0, -.02, -7]} receiveShadow><boxGeometry args={[30, .04, 7]} /><meshStandardMaterial color="#3a3f4a" roughness={.9} /></mesh>
      {[-4.2, 4.2].map(x => <mesh key={x} position={[x, .02, 0]} receiveShadow><boxGeometry args={[.9, .04, 30]} /><meshStandardMaterial color="#a8a29e" /></mesh>)}
      {[-5.9, 5.9].map(x => <mesh key={x} position={[x, .12, 3]} castShadow receiveShadow><boxGeometry args={[2.2, .24, 24]} /><meshStandardMaterial color="#d6d3d1" /></mesh>)}
      <mesh position={[-5.0, .03, 3]} receiveShadow><boxGeometry args={[1.4, .04, 24]} /><meshStandardMaterial color="#dc2626" roughness={.8} /></mesh>
      <mesh position={[0, .15, 6]} castShadow><boxGeometry args={[.8, .3, 16]} /><meshStandardMaterial color="#6faa5a" /></mesh>
      {stripes.map(x => <mesh key={x} position={[x, .05, 4]}><boxGeometry args={[.45, .02, 2.4]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
      {[-1.8, 1.8].map(x => <mesh key={x} position={[x, .05, 10]}><boxGeometry args={[.12, .02, 8]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
      <mesh ref={glow} position={[box[0], box[4] / 2 + .05, box[1]]}><boxGeometry args={[box[2] + .1, box[4] + .04, box[3] + .1]} /><meshBasicMaterial color="#facc15" transparent opacity={.4} toneMapped={false} depthWrite={false} /></mesh>
      <Orbit target={[box[0] * .5, 0, box[1] + 2]} radius={22} height={14} speed={.15} clock={clock} />
    </group>
  )
}

export default function Studio({ w, clock }: { w: World3D; clock: Clock }) {
  if (w.studio === 'figure') return <FigureStudio w={w} clock={clock} />
  if (w.studio === 'roadparts') return <RoadPartsStudio w={w} clock={clock} />
  return <RuleStudio w={w} clock={clock} />
}
