import { motion } from 'framer-motion'

/** Progress ring that animates to `pct` (0..1). */
export function Ring({ pct, size = 46, stroke = 5, color = 'var(--ok)', label }: { pct: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className={size > 80 ? 'score-ring' : 'ring'} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 60, damping: 16, delay: .15 }} />
      </svg>
      <span>{label ?? `${Math.round(pct * 100)}%`}</span>
    </div>
  )
}
