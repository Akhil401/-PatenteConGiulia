import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { data } from '../lib/data.js'
import { voiceInfo } from '../lib/speech.js'
import { store } from '../lib/store.js'
import { Giulia } from '../components/Giulia'
import { Ring } from '../components/Ring'
import type { Chapter } from '../util'


interface IndexCh { id: string; n: number; titleIt: string; titleEn: string; count: number }
type Stats = { total: number; seen: number; known: number; mistakes: number }

export default function Home() {
  const [index, setIndex] = useState<{ chapters: IndexCh[]; totalQuestions: number; source: string } | null>(null)
  const [ready, setReady] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [noVoice, setNoVoice] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      const [idx, rd] = await Promise.all([data.index(), data.ready()])
      const st: Record<string, Stats> = {}
      for (const id of rd.chapters) {
        const ch = (await data.chapter(id)) as Chapter
        st[id] = store.chapterStats(ch.questions.map(q => q.id)) as Stats
      }
      const vi = await voiceInfo()
      if (!live) return
      setIndex(idx); setReady(new Set(rd.chapters)); setStats(st); setNoVoice(!vi.supported || !vi.it)
    })()
    return () => { live = false }
  }, [])

  const st = store.streak() as { days: number; todayDone: boolean; todayCount: number }
  const known = Object.values(stats).reduce((a, s) => a + s.known, 0)
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Buongiorno!' : hour < 18 ? 'Ciao!' : 'Buonasera!'
  const readyCh = index ? index.chapters.filter(c => ready.has(c.id)) : []
  const next = readyCh.find(c => stats[c.id] && stats[c.id].known < stats[c.id].total) || readyCh[0]

  return (
    <div>
      <section className="hero">
        <div>
          <span className="eyebrow">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>{hello}</h1>
          <p>{st.todayDone ? 'Great work today. Keep the streak going!' : "I'm Giulia, your driving teacher. Ready for today's lesson?"}</p>
          <div className="hero-stats">
            <span className="stat"><b>🔥 {st.days}</b>day streak</span>
            <span className="stat"><b>{st.todayCount}</b>today</span>
            <span className="stat"><b>{known}</b>known</span>
          </div>
        </div>
        <Giulia state="idle" />
        {next && <a className="btn yellow hero-cta" href={`#/learn/${next.id}`}>
          <span>{stats[next.id]?.seen ? 'Continue' : 'Start'} · {next.titleEn.split(/[,(;]/)[0]}</span><span className="arr">→</span></a>}
      </section>

      {readyCh.length > 0 && (() => {
        const total = readyCh.reduce((a, c) => a + (stats[c.id]?.total || c.count), 0)
        const pct = total ? known / total : 0
        return (
          <div className="overview">
            <Ring pct={pct} size={54} stroke={5} color="var(--primary)" />
            <div><b>{known.toLocaleString()} of {total.toLocaleString()} questions known</b>
              <span className="small">{readyCh.length} chapters ready · {Object.values(stats).reduce((a, s) => a + s.mistakes, 0)} mistakes to fix</span></div>
          </div>
        )
      })()}

      {readyCh.length > 0 && (() => {
        const last = (store.exams('mock') as { size: number; right: number }[]).slice(-1)[0]
        const errs = last ? last.size - last.right : 0
        return (
          <a className="mock" href="#/exam/mock">
            <span className="mock-ico" aria-hidden="true">✍︎</span>
            <span className="mock-txt"><span className="eyebrow">Simulazione d’esame</span><b>Mock exam</b>
              <span>30 questions from your {readyCh.length} chapters · 20 min · pass with ≤ 3 mistakes</span>
              {last && <span className={`mock-last ${errs <= 3 ? 'ok' : 'no'}`}>Last try: {errs} mistake{errs === 1 ? '' : 's'} · {errs <= 3 ? 'passed' : 'not passed'}</span>}</span>
            <span className="arr" aria-hidden="true">→</span>
          </a>
        )
      })()}

      {noVoice && <div className="notice"><span>🔇</span><span><b>No Italian voice on this device.</b> You can still study with the text. To hear Giulia, add an Italian voice in your phone's text-to-speech settings.</span></div>}

      <div className="section-title"><h2>Your chapters</h2><span className="muted small">{index ? index.totalQuestions.toLocaleString() : ''} official questions</span></div>
      <div className="chapters">
        {readyCh.map((c, i) => {
          const s = stats[c.id]; const pct = s ? s.known / s.total : 0
          return (
            <motion.div key={c.id} className="chapter ready"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 * i, type: 'spring', stiffness: 300, damping: 24 }}>
              <a className="ch-main" href={`#/learn/${c.id}`}>
                <span className="ico">{c.n}</span>
                <span><span className="t">{c.titleEn}</span><span className="it">{c.titleIt}</span>
                  <span className="meta">{c.count} questions{s?.mistakes ? <> · <b>{s.mistakes} to fix</b></> : null}</span></span>
                <span className="pct">{Math.round(pct * 100)}%<small>known</small></span>
              </a>
              <div className="ch-actions">
                <a className="ch-btn" href={`#/learn/${c.id}`}>{s?.seen ? 'Continue' : 'Learn'}</a>
                <a className="ch-btn quiz" href={`#/exam/${c.id}`} aria-label={`Quiz: 30 random questions from ${c.titleEn}`}>Quiz 30<span aria-hidden="true">⏱</span></a>
              </div>
              <span className="line"><i style={{ width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%` }} /></span>
            </motion.div>
          )
        })}
      </div>

      {index && index.chapters.some(c => !ready.has(c.id)) && (
        <details className="soon-list">
          <summary><span>Coming soon <span className="muted">· {index.chapters.filter(c => !ready.has(c.id)).length} chapters</span></span><span className="chev">⌄</span></summary>
          <div className="soon-grid">
            {index.chapters.filter(c => !ready.has(c.id)).map(c => (
              <div key={c.id} className="soon-row"><span className="n">{c.n}</span><span>{c.titleEn}</span></div>
            ))}
          </div>
        </details>
      )}
      {index && <p className="footnote">Questions: official Ministry list ({index.source}).</p>}
    </div>
  )
}
