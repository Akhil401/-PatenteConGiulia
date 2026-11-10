// Small shared helpers for the React app.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { store } from './lib/store.js'

export type Lang = 'en' | 'it'

export interface Chunk { it: string; en: string; key?: boolean }
export interface Question {
  id: string; chapter: string; group: number; it: string; answer: boolean; image: string | null;
  en: string; keywords?: { it: string; en: string }[]; hidden?: boolean; review?: boolean;
  explain: { short?: string; rule?: string; trap?: string; scene?: string; sceneParams?: Record<string, unknown> };
  explainIt?: { short?: string; rule?: string; trap?: string; caption?: string; lines?: string[] };
  chunks?: Chunk[]; note?: string; noteIt?: string;
}
export interface Chapter { id: string; n: number; titleIt: string; titleEn: string; questions: Question[];
  groups?: Record<string, { title: string; titleIt: string; en: string; it: string }> }

/** Current location hash, e.g. "#/learn/ch02". */
export function useHash() {
  return useSyncExternalStore(
    cb => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb) },
    () => location.hash || '#/',
  )
}
export const go = (h: string) => { location.hash = h }

/** Re-render when a setting changes (settings live in localStorage via store). */
export function useSettings() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const f = () => setTick(t => t + 1)
    window.addEventListener('pcg-settings', f)
    return () => window.removeEventListener('pcg-settings', f)
  }, [])
  return store.settings as Record<string, any>
}
export function setSetting(k: string, v: unknown) {
  store.setSetting(k, v)
  applyTheme()
  window.dispatchEvent(new Event('pcg-settings'))
}
export function applyTheme() {
  const s = store.settings as Record<string, any>, root = document.documentElement
  if (s.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = s.theme
  if (s.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion
}
export const reducedMotion = () =>
  (store.settings as any).motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches

export const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
export const shuffle = <T,>(a: T[]) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

/** Confetti burst from an element. */
export function confetti(fromEl: Element | null, count = 22) {
  if (!fromEl || reducedMotion()) return
  const r = fromEl.getBoundingClientRect()
  const box = document.createElement('div')
  box.className = 'confetti-burst'; box.style.left = r.left + r.width / 2 + 'px'; box.style.top = r.top + r.height / 2 + 'px'
  const cols = ['#22c55e', '#facc15', '#6366f1', '#f472b6', '#38bdf8']
  box.innerHTML = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, d = 90 + Math.random() * 140
    return `<i style="background:${cols[i % 5]};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--rot:${(Math.random() * 720 - 360).toFixed(0)}deg"></i>`
  }).join('')
  document.body.appendChild(box)
  setTimeout(() => box.remove(), 1200)
}

let toastTimer = 0
export function toast(msg: string) {
  let t = document.getElementById('toast')
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t) }
  t.textContent = msg; t.classList.add('show')
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t!.classList.remove('show'), 2600)
}
