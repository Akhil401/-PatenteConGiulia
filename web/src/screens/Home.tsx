import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { data } from '../lib/data.js'
import { voiceInfo } from '../lib/speech.js'
import { store } from '../lib/store.js'
import { Giulia } from '../components/Giulia'
import { Ring } from '../components/Ring'


interface IndexCh { id: string; n: number; titleIt: string; titleEn: string; count: number }
type Stats = { total: number; seen: number; known: number; mistakes: number; at: number }

export default function Home() {
  const [index, setIndex] = useState<{ chapters: IndexCh[]; totalQuestions: number; source: string } | null>(null)
  const [ready, setReady] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [noVoice, setNoVoice] = useState(false)
  const [ids, setIds] = useState<Record<string, string[]>>({})

  useEffect(() => {
    let live = true
    ;(async () => {
      // progress per chapter from the small question index (never download every chapter here)
      const [idx, rd, qb] = await Promise.all([data.index(), data.ready(), data.qbank()])
      const ids: Record<string, string[]> = {}
      for (const [id, ch] of (qb as { q: [string, string][] }).q) (ids[ch] = ids[ch] || []).push(id)
      const st: Record<string, Stats> = {}
      for (const id of rd.chapters) st[id] = { ...store.chapterStats(ids[id] || []), at: store.chapterAt(id, ids[id] || []) } as Stats
      if (!live) return
      setIndex(idx); setReady(new Set(rd.chapters)); setStats(st); setIds(ids)
      const vi = await voiceInfo()
      if (live) setNoVoice(!vi.supported || !vi.it)
    })()
    return () => { live = false }
  }, [])

  const st = store.streak() as { days: number; todayDone: boolean; todayCount: number }
  const known = Object.values(stats).reduce((a, s) => a + s.known, 0)
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Buongiorno!' : hour < 18 ? 'Ciao!' : 'Buonasera!'
  const readyCh = index ? index.chapters.filter(c => ready.has(c.id)) : []
  const next = readyCh.find(c => stats[c.id] && stats[c.id].at < stats[c.id].total) || readyCh[0]
  const restart = (c: IndexCh) => {
    if (!confirm(`Start chapter ${c.n} again from question 1?\n\nYour answers in this chapter will be cleared. Other chapters and your exam results stay.`)) return
    store.restartChapter(c.id, ids[c.id] || [])
    location.hash = `#/learn/${c.id}/go`
  }

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
        {next && <a className="btn yellow hero-cta" href={`#/learn/${next.id}${stats[next.id]?.at ? '/go' : ''}`}>
          <span>{stats[next.id]?.at ? `Resume · question ${Math.min(stats[next.id].at + 1, stats[next.id].total)}` : 'Start'} · {next.titleEn.split(/[,(;]/)[0]}</span><span className="arr">→</span></a>}
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
          const at = s?.at || 0, total = s?.total || c.count, finished = at >= total
          return (
            <motion.div key={c.id} className="chapter ready"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 * i, type: 'spring', stiffness: 300, damping: 24 }}>
              <a className="ch-main" href={`#/learn/${c.id}`}>
                <span className="ico">{c.n}</span>
                <span><span className="t">{c.titleEn}</span><span className="it">{c.titleIt}</span>
                  <span className="meta">{finished ? <>Finished ✓</> : at > 0 ? <>At question <em className="at">{at + 1}</em> of {total}</> : <>{total} questions</>}
                    {s?.mistakes ? <> · <b>{s.mistakes} to fix</b></> : null}</span></span>
                <span className="pct">{Math.round(pct * 100)}%<small>known</small></span>
              </a>
              <span className="line"><i style={{ width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%` }} /><i className="reach" style={{ width: `${Math.min(100, (100 * at) / total)}%` }} /></span>
              <div className={`ch-actions ${at > 0 ? 'three' : ''}`}>
                <a className="ch-btn go" href={`#/learn/${c.id}${at > 0 && !finished ? '/go' : ''}`}>{finished ? 'Review' : at > 0 ? <>Resume<span aria-hidden="true">▸</span></> : 'Learn'}</a>
                {at > 0 && <button className="ch-btn again" onClick={() => restart(c)} aria-label={`Start ${c.titleEn} over from question 1`}>↺ Start over</button>}
                <a className="ch-btn quiz" href={`#/exam/${c.id}`} aria-label={`Quiz: 30 random questions from ${c.titleEn}`}>Quiz 30<span aria-hidden="true">⏱</span></a>
              </div>
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
