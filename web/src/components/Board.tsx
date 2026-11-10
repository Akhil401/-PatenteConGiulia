// Giulia's board. The 2D engine (lib/scenes/engine.js) always runs the timeline (steps, narration, replay, slow, step).
// When a scene describes its road in 3D (scene.world3d) and the device supports WebGL, a three.js view is drawn on top.
import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createBoard } from '../lib/scenes/engine.js'
import { reducedMotion, useSettings } from '../util'

const Scene3D = lazy(() => import('../three/Scene3D'))

export interface Step { t: number; text: string; it?: string }
export interface Scene { duration: number; steps: Step[]; world3d?: unknown; [k: string]: unknown }
export interface BoardApi { replay(): void; step(): void; setSpeed(s: number): void; readonly speed: number; seekStep(i: number): void }

interface Props {
  scene: Scene
  onStep?: (st: Step, i: number, n: number) => Promise<unknown> | null | void
  onLand?: (ok: boolean) => void
  onEnd?: () => void
  /** start playing when the board scrolls into view (inside this scroll container) */
  scrollRoot?: Element | null
}

let webgl: boolean | null = null
export function hasWebGL() {
  if (webgl === null) { try { const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { webgl = false } }
  return webgl
}

export const Board = forwardRef<BoardApi | null, Props>(function Board({ scene, onStep, onLand, onEnd, scrollRoot }, ref) {
  const settings = useSettings()
  const host = useRef<HTMLDivElement>(null)
  const ctl = useRef<ReturnType<typeof createBoard> | null>(null)
  const [ready, setReady] = useState(false)
  const cbs = useRef({ onStep, onLand, onEnd })
  cbs.current = { onStep, onLand, onEnd }
  const use3D = !!scene.world3d && settings.scenes3d !== false && hasWebGL()

  useEffect(() => {
    const el = host.current!
    const board = createBoard(el, {
      onStep: (st: Step, i: number, n: number) => cbs.current.onStep?.(st, i, n) ?? null,
      onLand: (ok: boolean) => cbs.current.onLand?.(ok),
      onEnd: () => cbs.current.onEnd?.(),
    })
    board.load(scene)
    ctl.current = board
    setReady(true)
    let started = false
    const start = () => { if (started) return; started = true; reducedMotion() ? board.step() : board.play() }
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { start(); io.disconnect() } }, { root: scrollRoot ?? null, threshold: .45 })
    io.observe(el)
    return () => { io.disconnect(); board.destroy(); ctl.current = null; setReady(false) }
  }, [scene, scrollRoot])

  useImperativeHandle(ref, () => ({
    replay: () => ctl.current?.replay(),
    step: () => ctl.current?.step(),
    setSpeed: (s: number) => ctl.current?.setSpeed(s),
    get speed() { return ctl.current?.speed ?? 1 },
    seekStep: (i: number) => ctl.current?.seekStep(i),
  }), [])

  return (
    <div className={`board-stack ${use3D ? 'is3d' : ''}`}>
      <div ref={host} className="board2d" />
      {use3D && ready && (
        <Suspense fallback={<div className="scene3d loading">Loading 3D…</div>}>
          <Scene3D scene={scene as any} clock={() => ({ time: ctl.current?.time ?? 0 })} />
        </Suspense>
      )}
    </div>
  )
})
