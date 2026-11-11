// Exam-style quiz: 30 random questions from one chapter (#/exam/ch02) or from all ready chapters (#/exam/mock).
// Like the real Patente B test: no help while answering, you can move between questions and change answers,
// 20-minute timer (optional), pass with at most 3 mistakes. Then review the mistakes with Giulia.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { data } from '../lib/data.js'
import { sound } from '../lib/sound.js'
import { speak, stop as stopSpeech } from '../lib/speech.js'
import { store } from '../lib/store.js'
import { Giulia } from '../components/Giulia'
import { Ring } from '../components/Ring'
import Explanation from './Explanation'
import { confetti, shuffle, toast, useSettings, type Chapter, type Question } from '../util'

const SIZE = 30, MINUTES = 20

type Phase = 'loading' | 'intro' | 'run' | 'result'
interface ChMeta { id: string; n: number; titleIt: string; titleEn: string }
interface Pool { qs: Question[]; chOf: Map<string, ChMeta>; title: string; sub: string }

export default function Exam({ scope }: { scope: string }) {
  const settings = useSettings()
  const [pool, setPool] = useState<Pool | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [ids, setIds] = useState<string[]>([])
  const [answers, setAnswers] = useState<(boolean | null)[]>([])
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(MINUTES * 60)
  const [used, setUsed] = useState(0)
  const [explain, setExplain] = useState<{ q: Question; ch: Chapter } | null>(null)
  /** Load the full question (explanation, scene...) from its chapter only when the learner opens it. */
  const openExplain = async (id: string) => {
    const meta = pool?.chOf.get(id); if (!meta) return
    const ch = (await data.chapter(meta.id)) as Chapter
    const q = ch.questions.find(x => x.id === id)
    if (q) setExplain({ q, ch })
  }
  const started = useRef(0)
  const ans = useRef<(boolean | null)[]>([])
  ans.current = answers

  // ---- load the questions ----
  useEffect(() => {
    let live = true
    ;(async () => {
      const ready = (await data.ready()).chapters as string[]
      const chIds = scope === 'mock' ? ready : ready.includes(scope) ? [scope] : []
      const qb = (await data.qbank()) as { ch: Record<string, Omit<ChMeta, 'id'>>; q: [string, string, string, number, string][] }
      const want = new Set(chIds), chOf = new Map<string, ChMeta>(), qs: Question[] = []
      for (const [id, c, it, answer, image] of qb.q) {
        if (!want.has(c)) continue
        qs.push({ id, it, answer: !!answer, image: image || null } as unknown as Question)
        chOf.set(id, { id: c, ...qb.ch[c] })
      }
      if (!live) return
      const one = chIds.length === 1 ? chOf.get(qs[0]?.id) : null
      setPool({ qs, chOf, title: one ? one.titleEn : 'Mock exam', sub: one ? `Chapter ${one.n} · ${one.titleIt}` : `${chIds.length} chapters mixed · like the real test` })
      setPhase(qs.length ? 'intro' : 'result')
    })()
    return () => { live = false; stopSpeech() }
  }, [scope])

  const byId = useMemo(() => new Map((pool?.qs || []).map(q => [q.id, q])), [pool])
  const timer = settings.examTimer !== false

  const start = () => {
    if (!pool) return
    // a fair random set: never the same question twice; in the mock exam spread over the chapters
    let set: string[]
    if (scope === 'mock') {
      const groups = new Map<string, string[]>()
      pool.qs.forEach(q => { const c = pool.chOf.get(q.id)!.id; groups.set(c, [...(groups.get(c) || []), q.id]) })
      const lists = [...groups.values()].map(l => shuffle(l)); set = []
      for (let k = 0; set.length < Math.min(SIZE, pool.qs.length); k++) lists.forEach(l => { if (l[k] && set.length < SIZE) set.push(l[k]) })
      set = shuffle(set)
    } else set = shuffle(pool.qs.map(q => q.id)).slice(0, SIZE)
    setIds(set); setAnswers(set.map(() => null)); setI(0); setLeft(MINUTES * 60); started.current = Date.now(); setPhase('run')
  }

  // ---- countdown ----
  useEffect(() => {
    if (phase !== 'run' || !timer) return
    const t = setInterval(() => {
      const l = MINUTES * 60 - Math.floor((Date.now() - started.current) / 1000)
      setLeft(Math.max(0, l))
      if (l <= 0) { clearInterval(t); toast('Time is up!'); submit(true) }
    }, 500)
    return () => clearInterval(t)
  }, [phase, timer])

  // ---- read the question aloud (same setting as the lessons) ----
  useEffect(() => {
    if (phase !== 'run') return
    const q = byId.get(ids[i]); if (!q) return
    const t = setTimeout(() => store.settings.autoRead && speak(q.it, { lang: 'it-IT', rate: store.settings.speed === 'slow' ? .72 : .95 }), 300)
    return () => { clearTimeout(t); stopSpeech() }
  }, [phase, i])

  const submit = (forced = false) => {
    stopSpeech()
    const cur = ans.current
    const right = ids.filter((id, k) => cur[k] === byId.get(id)!.answer).length
    ids.forEach((id, k) => { if (cur[k] !== null) store.record(id, cur[k] === byId.get(id)!.answer) })
    const secs = Math.min(MINUTES * 60, Math.round((Date.now() - started.current) / 1000))
    setUsed(secs)
    store.addExam(scope, ids.length, right, secs)
    if (!forced && store.settings.sound) sound.done()
    setPhase('result')
  }

  const pickAnswer = (v: boolean) => {
    setAnswers(a => { const b = [...a]; b[i] = v; return b })
    if (store.settings.sound) sound.tick()
    // jump to the next unanswered question
    setTimeout(() => setI(cur => {
      const n = answers.length
      for (let k = 1; k <= n; k++) { const j = (cur + k) % n; if (j !== i && answers[j] === null) return j }
      return cur
    }), 180)
  }

  if (phase === 'loading' || !pool) return <div className="card">Loading…</div>
  if (!pool.qs.length) return <div className="card stack"><h2>No questions yet</h2><p className="muted">This chapter is not ready yet.</p><a className="btn primary block" href="#/">Back to chapters</a></div>

  // ---------- intro ----------
  if (phase === 'intro') {
    const n = Math.min(SIZE, pool.qs.length), allowed = Math.floor(n / 10)
    const last = store.exams(scope).slice(-3).reverse() as { size: number; right: number; date: string }[]
    return (
      <div className="exam-intro">
        <section className="hero exam-hero">
          <div><span className="eyebrow">{scope === 'mock' ? 'Simulazione d’esame' : 'Quiz 30'}</span>
            <h1>{pool.title}</h1><p>{pool.sub}</p></div>
          <Giulia state="thinking" />
        </section>
        <div className="card stack">
          <div className="rules">
            <div><b>{n}</b><span>questions, random</span></div>
            <div><b>{timer ? `${MINUTES}′` : '—'}</b><span>{timer ? 'minutes' : 'no timer'}</span></div>
            <div><b>≤ {allowed}</b><span>mistakes to pass</span></div>
          </div>
          <ul className="tips">
            <li>No help while you answer: no hints, no translation, no explanations.</li>
            <li>You can go back and change any answer before you hand in.</li>
            <li>At the end, tap a mistake to see Giulia’s explanation.</li>
          </ul>
          {last.length > 0 && <p className="muted small" style={{ margin: 0 }}>Last results: {last.map(e => `${e.size - e.right} mistake${e.size - e.right === 1 ? '' : 's'}`).join(' · ')}</p>}
          <motion.button className="btn primary block" style={{ minHeight: 56, fontSize: '1.05rem' }} whileTap={{ scale: .97 }} onClick={start}>Start the {scope === 'mock' ? 'exam' : 'quiz'} →</motion.button>
          <a className="btn ghost block" href="#/">Back to chapters</a>
        </div>
      </div>
    )
  }

  // ---------- results ----------
  if (phase === 'result') {
    const total = ids.length, right = ids.filter((id, k) => answers[k] === byId.get(id)!.answer).length
    const errors = total - right, allowed = Math.floor(total / 10), passed = errors <= allowed
    const unanswered = answers.filter(a => a === null).length
    return (
      <div className="exam-result">
        <Result passed={passed} right={right} total={total} />
        <div className="card stack">
          <h2 style={{ margin: 0 }}>{passed ? (errors === 0 ? 'Perfetto! Promosso 🎉' : 'Promosso! You passed 🎉') : 'Non superato. Not yet 💪'}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {errors} mistake{errors === 1 ? '' : 's'} · the exam allows {allowed}{unanswered ? ` · ${unanswered} not answered` : ''}{timer || used ? ` · ${Math.floor(used / 60)}:${String(used % 60).padStart(2, '0')} min` : ''}
          </p>
          {errors > 0 && <p className="small muted" style={{ margin: 0 }}>Tap a mistake to see Giulia’s explanation.</p>}
          {(() => {
            const row = (id: string, k: number) => {
              const q = byId.get(id)!, a = answers[k], ok = a === q.answer
              return <button key={id} className={`qres ${ok ? 'ok' : 'no'}`} onClick={() => openExplain(q.id)}>
                <span className="mark">{ok ? '✓' : '✕'}</span>
                <span className="txt">{q.it}<small>{q.answer ? 'VERO' : 'FALSO'}{ok ? '' : a === null ? ' · not answered' : ' · you said ' + (a ? 'VERO' : 'FALSO')}</small></span>
              </button>
            }
            const wrong = ids.map((id, k) => [id, k] as const).filter(([id, k]) => answers[k] !== byId.get(id)!.answer)
            const good = ids.map((id, k) => [id, k] as const).filter(([id, k]) => answers[k] === byId.get(id)!.answer)
            return <>
              {wrong.length > 0 && <div className="quiz-list exam-list"><span className="list-lbl">Your mistakes · {wrong.length}</span>{wrong.map(([id, k]) => row(id, k))}</div>}
              {good.length > 0 && <details className="more exam-good"><summary>Correct answers · {good.length}</summary><div className="quiz-list exam-list">{good.map(([id, k]) => row(id, k))}</div></details>}
            </>
          })()}
          <motion.button className="btn primary block" style={{ minHeight: 54 }} whileTap={{ scale: .97 }} onClick={start}>New set of {Math.min(SIZE, pool.qs.length)} →</motion.button>
          {scope !== 'mock' && <a className="btn block" href={`#/learn/${scope}`}>Study this chapter</a>}
          <a className="btn ghost block" href="#/">Back to chapters</a>
        </div>
        <AnimatePresence>{explain && <Explanation key={'ex' + explain.q.id} q={explain.q} ch={explain.ch} wasRight={answers[ids.indexOf(explain.q.id)] === explain.q.answer} dunno={false} onDone={() => setExplain(null)} />}</AnimatePresence>
      </div>
    )
  }

  // ---------- running ----------
  const q = byId.get(ids[i])!
  const done = answers.filter(a => a !== null).length
  const low = timer && left <= 120
  const leave = () => { if (confirm('Leave the exam? Your answers will be lost.')) location.hash = '#/' }
  return (
    <div className="exam-run">
      <div className="exam-top">
        <button className="icon-btn" aria-label="Leave the exam" onClick={leave}>✕</button>
        <div className="exam-meta"><b>{scope === 'mock' ? 'Mock exam' : 'Quiz 30'}</b><span>{done}/{ids.length} answered</span></div>
        {timer && <span className={`exam-clock ${low ? 'low' : ''}`} aria-label="Time left">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}
      </div>
      <div className="exam-map" role="tablist" aria-label="Questions">
        {ids.map((id, k) => <button key={id} role="tab" aria-selected={k === i} aria-label={`Question ${k + 1}`} className={`${k === i ? 'cur' : ''} ${answers[k] === true ? 'v' : answers[k] === false ? 'f' : ''}`} onClick={() => setI(k)}>{k + 1}</button>)}
      </div>
      <motion.div key={q.id} className="qcard exam-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22, ease: [.22, 1, .36, 1] }}>
          <span className="qlabel">Domanda {i + 1}</span>
          <p className="q-it" lang="it">{q.it}</p>
          {q.image && <img className="q-img" src={q.image} alt="Figure for this question" width={200} height={200} draggable={false} />}
      </motion.div>
      <div className="answers exam-answers">
        <div className="two">
          {[true, false].map(v => (
            <motion.button key={String(v)} className={`ans ${v ? 'vero' : 'falso'} ${answers[i] === v ? 'chosen' : answers[i] !== null ? 'dim' : ''}`} whileTap={{ scale: .97 }} onClick={() => pickAnswer(v)}>
              <span className="ic">{v ? '✓' : '✕'}</span><span>{v ? 'VERO' : 'FALSO'}<small>{v ? 'true' : 'false'}</small></span>
            </motion.button>))}
        </div>
        <div className="exam-nav">
          <button className="btn small" disabled={i === 0} onClick={() => setI(i - 1)}>‹ Prev</button>
          <button className={`btn small ${done === ids.length ? 'primary' : ''}`} onClick={() => {
            if (done < ids.length && !confirm(`${ids.length - done} question${ids.length - done === 1 ? ' is' : 's are'} not answered. Hand in anyway?`)) return
            submit()
          }}>Hand in{done === ids.length ? ' ✓' : ''}</button>
          <button className="btn small" disabled={i === ids.length - 1} onClick={() => setI(i + 1)}>Next ›</button>
        </div>
      </div>
    </div>
  )
}

function Result({ passed, right, total }: { passed: boolean; right: number; total: number }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => { if (passed) setTimeout(() => confetti(el.current, 70), 350) }, [])
  return (
    <section className={`exam-score ${passed ? 'pass' : 'fail'}`} ref={el}>
      <Giulia state={passed ? 'celebrate' : 'sad'} />
      <div className="exam-score-ring"><Ring pct={total ? right / total : 0} size={128} stroke={10} color={passed ? 'var(--ok-2)' : 'var(--no-2)'} label={`${right}/${total}`} /></div>
      <span className="exam-badge">{passed ? 'PROMOSSO' : 'NON SUPERATO'}</span>
    </section>
  )
}
