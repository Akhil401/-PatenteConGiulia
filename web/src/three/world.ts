// Maps the 2D scene coordinates (0..360 x 0..420, cars drive "up") onto a 3D road that can bend and climb.
import * as THREE from 'three'

export type RoadKind = 'twoWay' | 'oneWay' | 'dual' | 'twoLanesEach' | 'motorway' | 'motorway3' | 'space' | 'threeLanesEach' | 'threeCarriageways' | 'threeLane'
export interface Prop { type: string; [k: string]: any }
export interface World3D {
  road?: RoadKind; line?: 'dashed' | 'solid' | 'double' | 'mixed' | 'mixedSolidMine'; feature?: 'hill' | 'hillDown' | 'curve' | 'fog' | null
  props?: Prop[]
  /** studio scenes without a road: figure / rulecard / roadparts */
  studio?: 'figure' | 'rulecard' | 'roadparts'
  [k: string]: any
}

/** Road layout in scene px: asphalt strips, shoulders, painted lines, medians and guard rails. */
export function layout(road: RoadKind = 'twoWay', line: World3D['line'] = 'dashed') {
  const L = { asphalt: [] as [number, number][], shoulders: [] as [number, number][], solids: [] as number[], dashes: [] as number[], medians: [] as [number, number][], guards: [] as number[], light: [] as [number, number][] }
  const centre = (x: number) => {
    if (line === 'solid') L.solids.push(x)
    else if (line === 'double') L.solids.push(x - 3.5, x + 3.5)
    else if (line === 'mixed') { L.solids.push(x - 3.5); L.dashes.push(x + 3.5) }   // dashed on YOUR side: you may cross
    else if (line === 'mixedSolidMine') { L.solids.push(x + 3.5); L.dashes.push(x - 3.5) }   // solid on YOUR side: you may not
    else L.dashes.push(x)
  }
  switch (road) {
    case 'dual': L.asphalt.push([30, 168], [192, 330]); L.medians.push([168, 192]); L.guards.push(173, 187); L.solids.push(33, 165, 195, 327); L.dashes.push(105, 255); L.shoulders.push([18, 30], [330, 342]); break
    case 'twoLanesEach': L.asphalt.push([30, 330]); L.solids.push(33, 327, 176.5, 183.5); L.dashes.push(105, 255); L.shoulders.push([18, 30], [330, 342]); break
    case 'motorway': L.asphalt.push([85, 275]); L.light.push([275, 318]); L.solids.push(88, 275); L.dashes.push(148, 212); L.guards.push(80, 322); break
    case 'motorway3': L.asphalt.push([85, 275]); L.solids.push(88, 272); L.dashes.push(148, 212); L.guards.push(78, 282); break
    case 'space': L.asphalt.push([30, 160], [200, 330]); L.solids.push(33, 157, 203, 327); L.dashes.push(95, 265); L.shoulders.push([18, 30], [160, 172], [188, 200], [330, 342]); break
    // official figures: one carriageway with 3 lanes each way / 3 carriageways with 8 lanes
    case 'threeLanesEach': L.asphalt.push([20, 340]); L.solids.push(23, 337, 176.5, 183.5); L.dashes.push(72, 124, 236, 288); L.shoulders.push([8, 20], [340, 352]); break
    case 'threeCarriageways': L.asphalt.push([10, 90], [106, 254], [270, 350]); L.medians.push([90, 106], [254, 270]); L.solids.push(13, 87, 109, 251, 273, 347, 176.5, 183.5); L.dashes.push(50, 143, 217, 310); L.shoulders.push([0, 10], [350, 360]); break
    // one carriageway, 3 lanes, two-way: the centre lane is shared (overtaking / turning left)
    case 'threeLane': L.asphalt.push([70, 290]); L.solids.push(73, 287); L.dashes.push(143.3, 216.6); L.shoulders.push([58, 70], [290, 302]); break
    default: L.asphalt.push([110, 250]); L.shoulders.push([98, 110], [250, 262]); L.solids.push(113, 247); centre(180)
  }
  return L
}

/** A flat quad between two scene corners (axis-aligned in scene px), following the terrain. */
export function quad(world: World, x0: number, y0: number, x1: number, y1: number, lift = .02, nx = 1, ny = 1) {
  const pos: number[] = [], idx: number[] = []
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const p = world.to3(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, lift); pos.push(p.x, p.y, p.z)
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
  return g
}

export const S = 0.06                 // metres per scene pixel
const CX = 180, CY = 210              // scene centre -> 3D origin
const BEND_Y = 175, BEND_R = 230      // where the bend starts and its radius (scene px)
const HILL_W = 150, HILL_H = 5.5

export function makeWorld(w: World3D) {
  const curve = w.feature === 'curve', hill = w.feature === 'hill' || w.feature === 'hillDown'
  const HILL_Y = w.feature === 'hillDown' ? 400 : 95
  /** bend the flat scene plane (only before the bend start, i.e. further up the road) */
  const bend = (x: number, y: number) => {
    if (!curve || y >= BEND_Y) return { x, y }
    const d = BEND_Y - y, th = d / BEND_R, l = x - CX
    const cx = CX - BEND_R * (1 - Math.cos(th)), cy = BEND_Y - BEND_R * Math.sin(th)
    return { x: cx + l * Math.cos(th), y: cy - l * Math.sin(th) }
  }
  const height = (y: number) => (hill ? HILL_H * Math.exp(-(((y - HILL_Y) / HILL_W) ** 2)) : 0)
  /** scene (x, y) -> 3D position (metres) */
  const to3 = (x: number, y: number, lift = 0) => {
    const p = bend(x, y)
    return new THREE.Vector3((p.x - CX) * S, height(y) + lift, (p.y - CY) * S)
  }
  return { to3, height, curve, hill, fog: w.feature === 'fog', line: w.line || 'dashed', road: w.road || 'twoWay', props: w.props || [], wide: (w.road && w.road !== 'twoWay' && w.road !== 'oneWay') as boolean }
}
export type World = ReturnType<typeof makeWorld>

/** A flat ribbon along the road between lateral offsets l0..l1 (scene px from the centre line). */
export function ribbon(world: World, l0: number, l1: number, lift: number, y0 = 560, y1 = -320, step = 6) {
  const pos: number[] = [], idx: number[] = []
  let i = 0
  for (let y = y0; y >= y1; y -= step) {
    const a = world.to3(CX + l0, y, lift), b = world.to3(CX + l1, y, lift)
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k) }
    i++
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
  return g
}

/** Road markings for the layout: dashed and solid lines along the road (x in scene px). */
export function markings(world: World) {
  const L = layout(world.road as RoadKind, world.line as World3D['line'])
  const parts: THREE.BufferGeometry[] = []
  const solid = (x: number, w = .14) => parts.push(ribbon(world, x - CX - w / S / 2, x - CX + w / S / 2, .02))
  const dashed = (x: number) => {
    for (let y = 560; y > -320; y -= 36) {
      const pos: number[] = []
      for (const yy of [y, y - 20]) { const a = world.to3(x - 1.2, yy, .02), b = world.to3(x + 1.2, yy, .02); pos.push(a.x, a.y, a.z, b.x, b.y, b.z) }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex([0, 1, 2, 1, 3, 2]); g.computeVertexNormals()
      parts.push(g)
    }
  }
  L.solids.forEach(x => solid(x)); L.dashes.forEach(dashed)
  return parts
}

/** Trees placed relative to the road (so they never stand on it); dense on the inside of a bend to block the view. */
export function trees(world: World) {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const out: { p: THREE.Vector3; s: number; hue: number }[] = []
  for (let i = 0; i < 70; i++) {
    const side = rnd() < .5 ? -1 : 1
    const wideRoad = world.wide ? 85 : 0
    const l = side * (125 + wideRoad + rnd() * 230), y = 540 - rnd() * 840, s = .8 + rnd() * .9, hue = rnd()
    // keep junction arms and side roads free of trees
    if (world.props.some((p: Prop) => (p.type === 'junction' || p.type === 'sideRoad' || p.type === 'rails') && y > p.y - 30 && y < p.y + (p.h || 26) + 30)) continue
    if (world.props.some((p: Prop) => p.type === 'town') && Math.abs(l) < 330) continue
    // hill scenes: keep the left side open so the side camera can show the crest
    if (world.hill && side < 0 && y > -120 && y < 420) continue
    out.push({ p: world.to3(CX + l, y), s, hue })
  }
  if (world.curve) for (let i = 0; i < 26; i++) {
    const l = -(88 + rnd() * 70), y = 150 - rnd() * 230
    out.push({ p: world.to3(CX + l, y), s: 1.1 + rnd() * .8, hue: rnd() })
  }
  return out
}

export interface Ghost { pts: [number, number][]; ok: boolean; t0: number; t1: number; mark?: [number, number] }
export interface Callout { x: number; y: number; text: string; red: boolean; green: boolean; t0: number; t1: number }
/** Read the planned paths, danger marks and callouts out of the 2D scene's overlay SVG. */
export function readOverlays(shows: { t?: number; t0?: number; t1?: number; svg: string }[]) {
  const ghosts: Ghost[] = [], callouts: Callout[] = [], pulses: { x: number; y: number; red: boolean; t0: number; t1: number }[] = []
  for (const sh of shows || []) {
    const t0 = sh.t0 ?? sh.t ?? 0, t1 = sh.t1 ?? Infinity
    const m = sh.svg.match(/<path d="([^"]+)"[^>]*stroke="(#[0-9a-f]+)"[^>]*class="march"/i)
    if (m) {
      const nums = m[1].replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number)
      const pts: [number, number][] = []
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
      const mk = sh.svg.match(/class="pop[^"]*" data-focus="([\d.-]+),([\d.-]+)"/)
      ghosts.push({ pts, ok: /22c55e/i.test(m[2]), t0, t1, mark: mk ? [+mk[1], +mk[2]] : undefined })
    }
    for (const b of sh.svg.matchAll(/<g transform="translate\(([\d.-]+) ([\d.-]+)\)"><g class="popin"><rect[^>]*fill="(#[0-9a-f]+)"[^>]*\/>\s*<text[^>]*>([^<]+)<\/text>/gi))
      callouts.push({ x: +b[1], y: +b[2], text: b[4].replace(/&amp;/g, '&'), red: /ef4444/i.test(b[3]), green: /16a34a/i.test(b[3]), t0, t1 })
    for (const p of sh.svg.matchAll(/<g data-focus="([\d.-]+),([\d.-]+)"><circle[^>]*fill="(#[0-9a-f]+)"[^>]*class="pulse-ring"/gi))
      pulses.push({ x: +p[1], y: +p[2], red: /ef4444/i.test(p[3]), t0, t1 })
  }
  return { ghosts, callouts, pulses }
}
