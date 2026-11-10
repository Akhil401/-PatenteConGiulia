// React wrapper around Giulia (the animated SVG teacher in lib/giulia.js).
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { createGiulia } from '../lib/giulia.js'

export type GiuliaApi = ReturnType<typeof createGiulia>
export type GiuliaState = 'idle' | 'asking' | 'thinking' | 'happy' | 'sad' | 'explain' | 'celebrate' | 'oh'

interface Props { state?: GiuliaState; enter?: boolean; className?: string; followPointer?: boolean }

export const Giulia = forwardRef<GiuliaApi | null, Props>(function Giulia({ state = 'idle', enter = true, className, followPointer = true }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<GiuliaApi | null>(null)

  useLayoutEffect(() => {
    const el = host.current!
    api.current = createGiulia(el)
    if (enter) api.current.enter()
    return () => { el.innerHTML = ''; api.current = null }
  }, [enter])

  useEffect(() => { api.current?.set(state) }, [state])

  // eyes follow your finger / mouse
  useEffect(() => {
    if (!followPointer) return
    const f = (e: PointerEvent) => api.current?.lookAt(e.clientX, e.clientY)
    window.addEventListener('pointermove', f, { passive: true })
    window.addEventListener('pointerdown', f, { passive: true })
    return () => { window.removeEventListener('pointermove', f); window.removeEventListener('pointerdown', f) }
  }, [followPointer])

  useImperativeHandle(ref, () => api.current as GiuliaApi, [enter])
  return <div ref={host} className={className} />
})
