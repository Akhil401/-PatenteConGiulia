// Screen-space labels for the 3D scenes: plain DOM elements in one overlay layer, positioned every frame
// by projecting their 3D anchor points. (Replaces drei <Html>, which mounts extra React roots.)
import { useFrame, useThree } from '@react-three/fiber'
import { createContext, useContext, useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Item { el: HTMLDivElement; pos: THREE.Vector3 }
export class LabelLayer {
  root: HTMLDivElement | null = null
  items = new Set<Item>()
}
export const LabelCtx = createContext<LabelLayer | null>(null)

/**
 * Create a label. `html` is its content, `className` its CSS class.
 * Returns refs: el (the DOM element, for toggling classes) and pos (move it to follow an object).
 */
export function useLabel(html: string, className: string, at: THREE.Vector3 | [number, number, number]) {
  const layer = useContext(LabelCtx)
  const el = useRef<HTMLDivElement | null>(null)
  const pos = useRef(Array.isArray(at) ? new THREE.Vector3(...at) : at.clone())
  useEffect(() => {
    if (!layer?.root) return
    const d = document.createElement('div')
    d.className = 'lab3d'
    const inner = document.createElement('div')
    inner.className = className; inner.innerHTML = html
    d.appendChild(inner)
    layer.root.appendChild(d)
    const item = { el: d, pos: pos.current }
    layer.items.add(item)
    el.current = inner
    return () => { layer.items.delete(item); d.remove(); el.current = null }
  }, [layer, html, className])
  return { el, pos }
}

/** Projects every label each frame. Mount it last inside the Canvas. */
export function LabelDriver() {
  const layer = useContext(LabelCtx)
  const { camera, size } = useThree()
  const v = new THREE.Vector3()
  useFrame(() => {
    if (!layer) return
    layer.items.forEach(({ el, pos }) => {
      v.copy(pos).project(camera)
      const hidden = v.z > 1 || v.z < -1
      el.style.display = hidden ? 'none' : ''
      if (!hidden) el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2 * size.width).toFixed(1)}px,${((1 - v.y) / 2 * size.height).toFixed(1)}px)`
    })
  })
  return null
}

/** Language of the fixed words drawn in 3D (YOU / TU, Figure / Figura). Set by Scene3D. */
export const label3d = { lang: 'en' as string }
export const tr = (en: string, it: string) => (label3d.lang === 'it' ? it : en)
