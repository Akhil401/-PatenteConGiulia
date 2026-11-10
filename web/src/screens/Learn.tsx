// Learn a chapter: intro, questions (swipe), result panel, explanation, checkpoint quizzes, end of round.
import { AnimatePresence, motion, useAnimationControls, type PanInfo } from 'framer-motion'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { data, glossaryFor, tokenize } from '../lib/data.js'
import { sound } from '../lib/sound.js'
import { speak, stop as stopSpeech } from '../lib/speech.js'
import { store } from '../lib/store.js'
import { Giulia, type GiuliaApi, type GiuliaState } from '../components/Giulia'
import { Ring } from '../components/Ring'
import Explanation from './Explanation'
import { confetti, pick, reducedMotion, setSetting, shuffle, toast, useSettings, type Chapter, type Question } from '../util'

const LINES = {
  ask: ['Vero o falso?', 'Listen carefully…', 'Read every word!', 'What do you think?', 'Vero o falso? Take your time.'],
  praise: ['Esatto! 🎯', 'Perfetto!', 'Bravissimo! 👏', 'Giusto!', 'Ottimo lavoro!', 'Yes! Well done.'],
  wrong: ['No problem. Let me show you 👇', 'Almost! Look at this.', "Tricky one! Let's see why."],
  nudge: "Take your time 🙂 Tap any word you don't know.",
  tips: ['Tip: tap any Italian word to see what it means 👆', 'Tip: imagine the road. Who could be coming?', 'Tip: «deve» means must. It makes a rule strict.', 'Tip: read to the very last word before you answer.'],
  combo: { 3: '3 in a row! 🔥', 5: "5 in a row! You're on fire! 🔥🔥", 10: '10 in a row!! Campione! 🏆', 15: '15 in a row! Incredibile! 🚀' } as Record<number, string>,
}
const TRAPS: Record<string, string> = { sempre: 'always', mai: 'never', solo: 'only', soltanto: 'only', unicamente: 'only', esclusivamente: 'only', anche: 'also / even',
  'purché': 'as long as', qualsiasi: 'any', tutti: 'all', nessun: 'no', nessuno: 'nobody', indifferentemente: 'either way', obbligatoriamente: 'must' }

type Result = { pick: boolean | null; correct: boolean }
type Overlay = null | { kind: 'sheet'; q: Question; ok: boolean; reviewing: boolean } | { kind: 'explain'; q: Question; wasRight: boolean; dunno: boolean; after: () => void }
type Mode = 'loading' | 'intro' | 'question' | 'checkpoint' | 'quiz' | 'quizDone' | 'done'

export default function Learn({ chId }: { chId: string }) {
  const settings = useSettings()
  const [ch, setCh] = useState<Chapter | null>(null)
  const [aux, setAux] = useState<{ glossary: any; dict: any; intro: any }>({ glossary: { terms: [] }, dict: { words: {} }, intro: {} })
  const [mode, setMode] = useState<Mode>('loading')
  const [, force] = useReducer((x: number) => x + 1, 0)
  const S = useRef({ queue: [] as string[], pos: 0, right: 0, wrong: 0, wrongIds: new Set<string>(), requeued: new Set<string>(), results: [] as Result[], combo: 0, checkpoint: 0, dir: 0 }).current
  const [overlay, setOverlay] = useState<Overlay>(null)

  useEffect(() => {
    let live = true
    Promise.all([data.chapter(chId), data.glossary(), data.dict(chId), data.intros().catch(() => ({}))]).then(([c, gl, di, intros]) => {
      if (!live) return
      const chapter = c as Chapter
      const all = chapter.questions.filter(q => !q.hidden)
      const todo = all.filter(q => !store.isKnown(q.id))
      S.queue = (todo.length ? todo : all).map(q => q.id)
      setCh(chapter); setAux({ glossary: gl, dict: di, intro: (intros as any)[chId] || {} }); setMode('intro')
    })
    return () => { live = false; stopSpeech() }
  }, [chId])

  const byId = useMemo(() => new Map((ch?.questions || []).map(q => [q.id, q])), [ch])
  if (!ch || mode === 'loading') return <div className="card">Loading…</div>
  const all = ch.questions.filter(q => !q.hidden)

  const nextQuestion = () => {
    setOverlay(null)
    if (S.checkpoint) { setMode('checkpoint'); return }
    goNext()
  }
  const goNext = () => {
    const answered = !!S.results[S.pos]
    if (!answered && S.pos < S.queue.length - 1) {
      const [id] = S.queue.splice(S.pos, 1); S.queue.push(id)
      toast('Skipped. It will come back later.')
      S.dir = 1; setMode('question'); force(); return
    }
    if (!answered) { toast('Answer this one to finish 🙂'); return }
    S.pos++; S.dir = 1
    if (S.pos >= S.queue.length) { setMode('done'); return }
    setMode('question'); force()
  }
  const goPrev = () => {
    if (S.pos === 0) { toast('This is the first question.'); return }
    S.pos--; S.dir = -1; force()
  }

  const content = (() => {
    switch (mode) {
      case 'intro': return <Intro ch={ch} intro={aux.intro} all={all} onStart={() => { S.dir = 0; setMode('question') }} />
      case 'question': return <QuestionView key={S.queue[S.pos] + ':' + S.pos} q={byId.get(S.queue[S.pos])!} S={S} ch={ch} aux={aux} settings={settings}
        onAnswered={(q, r) => {
          if (r.correct) setOverlay({ kind: 'sheet', q, ok: true, reviewing: false })
          else setTimeout(() => setOverlay({ kind: 'explain', q, wasRight: false, dunno: r.pick === null, after: nextQuestion }), r.pick === null ? 200 : 900)
        }}
        onReview={(q, r) => setOverlay({ kind: 'sheet', q, ok: r.correct, reviewing: true })}
        onNext={goNext} onPrev={goPrev} chId={chId} />
      case 'checkpoint': return <Checkpoint n={store.ck(chId).seen.length} ids={quizSet(chId, byId)} onGo={() => setMode('quiz')}
        onLater={() => { store.setQuizzed(chId, store.ck(chId).seen.length); goNext() }} />
      case 'quiz': return <Quiz ids={quizSet(chId, byId)} byId={byId} ch={ch} chId={chId} onExplain={(q, after) => setOverlay({ kind: 'explain', q, wasRight: false, dunno: false, after })}
        onFinish={() => goNext()} />
      case 'done': return <Done S={S} all={all} chId={chId} onAgain={() => {
        S.queue = [...S.wrongIds]; S.pos = 0; S.right = 0; S.wrong = 0; S.wrongIds = new Set(); S.requeued = new Set(S.queue); S.results = []; S.dir = 1; setMode('question')
      }} />
      default: return null
    }
  })()

  return (
    <div className="learn-wrap">
      {content}
      <AnimatePresence>
        {overlay?.kind === 'sheet' && (
          <motion.div key="sheet" className={`sheet ${overlay.ok ? 'ok' : 'no'}`} role="status"
            initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
            <div className="row"><motion.span className="big" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: .1, stiffness: 400, damping: 14 }}>{overlay.ok ? '✓' : '✕'}</motion.span>
              <div><h3>{overlay.ok ? (overlay.reviewing ? 'You got it right' : 'Esatto!') : 'Answer: ' + (overlay.q.answer ? 'VERO' : 'FALSO')}</h3>
                <span className="small">{overlay.ok ? <>It's <b>{overlay.q.answer ? 'VERO' : 'FALSO'}</b>.</> : 'You can see the explanation again.'}</span></div></div>
            <div className="acts">
              <motion.button className="btn go" whileTap={{ scale: .96 }} autoFocus onClick={() => (overlay.reviewing ? (setOverlay(null), goNext()) : nextQuestion())}>Continue →</motion.button>
              <motion.button className="btn why" whileTap={{ scale: .96 }} onClick={() => {
                const q = overlay.q, reviewing = overlay.reviewing
                setOverlay({ kind: 'explain', q, wasRight: overlay.ok, dunno: false, after: reviewing ? () => setOverlay(null) : nextQuestion })
              }}>💡 Why?</motion.button>
            </div>
          </motion.div>
        )}
        {overlay?.kind === 'explain' && <Explanation key={'ex' + overlay.q.id} q={overlay.q} ch={ch} wasRight={overlay.wasRight} dunno={overlay.dunno} onDone={overlay.after} />}
      </AnimatePresence>
    </div>
  )
}

// ---------- intro ----------
function Intro({ ch, intro, all, onStart }: { ch: Chapter; intro: any; all: Question[]; onStart: () => void }) {
  const st = store.chapterStats(all.map(q => q.id)) as { total: number; seen: number; known: number; mistakes: number }
  return (
    <div>
      <section className="hero" style={{ gridTemplateColumns: '1fr 130px' }}>
        <div><span className="stat" style={{ display: 'inline-block', marginBottom: 8 }}>Chapter {ch.n}</span>
          <h1 style={{ whiteSpace: 'normal' }}>{ch.titleEn}</h1><p style={{ margin: 0 }}><i>{ch.titleIt}</i></p></div>
        <Giulia state="happy" />
      </section>
      <div className="card intro-card stack">
        {intro.en && <p style={{ fontSize: '1.05rem', margin: 0 }}>{intro.en}</p>}
        <ul className="tips">
          {(intro.tips || []).map((t: string) => <li key={t}>💡 {t}</li>)}
          <li>👆 Swipe left or right to move between questions.</li><li>🧠 Every 10 new questions, Giulia offers you a quick quiz.</li>
        </ul>
        <div className="bar"><i style={{ width: `${Math.round(100 * st.known / st.total)}%` }} /></div>
        <p className="muted small" style={{ margin: 0 }}>{all.length} questions · you know {st.known} · {st.mistakes} to fix.</p>
        <motion.button className="btn primary block" style={{ minHeight: 56, fontSize: '1.05rem' }} whileTap={{ scale: .96 }} onClick={onStart}>{st.seen ? 'Continue' : "Let's start"} →</motion.button>
        <a className="btn ghost block" href="#/">Back to chapters</a>
      </div>
    </div>
  )
}

// ---------- one question ----------
interface QProps {
  q: Question; S: any; ch: Chapter; aux: { glossary: any; dict: any }; settings: Record<string, any>; chId: string
  onAnswered: (q: Question, r: Result) => void; onReview: (q: Question, r: Result) => void; onNext: () => void; onPrev: () => void
}
function QuestionView({ q, S, ch, aux, settings, chId, onAnswered, onReview, onNext, onPrev }: QProps) {
  const g = useRef<GiuliaApi | null>(null)
  const done: Result | undefined = S.results[S.pos]
  const [gState, setG] = useState<GiuliaState>(done ? (done.correct ? 'happy' : 'sad') : 'idle')
  const [say, setSay] = useState('')
  const [sayCls, setSayCls] = useState('')
  const [speaking, setSpeaking] = useState(-1)
  const [showEn, setShowEn] = useState(!!(settings.englishAlways || done))
  const [result, setResult] = useState<Result | undefined>(done)
  const [shake, setShake] = useState(false)
  const [flash, setFlash] = useState(0)
  const [pop, setPop] = useState<{ x: number; y: number; html: React.ReactNode } | null>(null)
  const controls = useAnimationControls()
  const nudge = useRef(0)
  const card = useRef<HTMLDivElement>(null)
  const tokens = useMemo(() => tokenize(q.it) as { word?: string; gap?: string; start?: number }[], [q])
  const kw = useMemo(() => new Set((q.keywords || []).flatMap(k => k.it.toLowerCase().split(/[^a-zà-ÿ]+/i)).filter(w => w.length > 2)), [q])

  const talk = useCallback((text: string, cls = '') => { setSay(text); setSayCls(cls) }, [])
  const read = useCallback(() => {
    setG('asking')
    speak(q.it, {
      lang: 'it-IT', rate: store.settings.speed === 'slow' ? .72 : .95,
      onstart: () => g.current?.talkStart(),
      onboundary: (ci: number, _l: number, word: string, rate: number) => { g.current?.talkWord(word, rate); setSpeaking(ci) },
      onend: () => {
        g.current?.talkStop(); setSpeaking(-1); setG(s => (s === 'asking' ? 'thinking' : s))
        if (!S.results[S.pos]) nudge.current = window.setTimeout(() => { if (!S.results[S.pos]) { talk(LINES.nudge); g.current?.poke() } }, 15000)
      },
    })
  }, [q])

  useEffect(() => {
    controls.start({ x: 0, rotate: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 28 } })
    if (done) { talk(done.correct ? 'You got this one right ✓' : `This one is ${q.answer ? 'VERO' : 'FALSO'}. Tap "Why?" to see it again.`); onReview(q, done) }
    else {
      talk(S.pos === 0 && !S.answeredOnce ? 'Ciao! Tap me if you need a hint 😉' : pick(LINES.ask))
      const t = setTimeout(() => (store.settings.autoRead ? read() : setG('thinking')), S.dir ? 380 : 250)
      return () => { clearTimeout(t); clearTimeout(nudge.current); stopSpeech() }
    }
    return () => { clearTimeout(nudge.current); stopSpeech() }
  }, [q.id])

  const fly = async (dir: number) => {
    if (dir < 0 && S.pos === 0) { toast('This is the first question.'); controls.start({ x: 0, rotate: 0 }); return }
    stopSpeech()
    if (!reducedMotion()) await controls.start({ x: dir > 0 ? -480 : 480, rotate: dir > 0 ? -8 : 8, opacity: 0, transition: { duration: .25, ease: 'easeIn' } })
    dir > 0 ? onNext() : onPrev()
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -600) fly(1)
    else if (info.offset.x > 80 || info.velocity.x > 600) fly(-1)
    else controls.start({ x: 0, rotate: 0 })
  }

  const answer = (choice: boolean | null) => {
    stopSpeech(); g.current?.talkStop(); setPop(null); clearTimeout(nudge.current); g.current?.lean(null)
    S.answeredOnce = true
    const correct = choice === q.answer
    const firstTime = !store.q(q.id)
    store.record(q.id, correct)
    if (firstTime) {
      const n = store.markSeen(chId, q.id)
      if (n % 10 === 0 && n > store.ck(chId).quizzedAt) S.checkpoint = n
    }
    const r = { pick: choice, correct }
    S.results[S.pos] = r; setResult(r); setShowEn(true)
    if (correct) {
      S.right++; S.combo++
      setG('happy')
      const combo = LINES.combo[S.combo]
      talk(combo || pick(LINES.praise), combo ? 'combo' : '')
      if (settings.sound) sound.correct()
      try { navigator.vibrate?.(20) } catch { /* ignore */ }
      confetti(document.querySelector(choice ? '#aV' : '#aF'), combo ? 60 : 22)
    } else {
      S.wrong++; S.combo = 0; S.wrongIds.add(q.id)
      if (!S.requeued.has(q.id)) { S.requeued.add(q.id); S.queue.splice(Math.min(S.queue.length, S.pos + 6), 0, q.id) }
      setG(choice === null ? 'explain' : 'sad')
      talk(choice === null ? "Of course! Let's look at it together 👇" : pick(LINES.wrong))
      if (choice !== null) { setShake(true); if (settings.sound) sound.wrong(); try { navigator.vibrate?.([30, 40, 30]) } catch { /* ignore */ } }
    }
    onAnswered(q, r)
  }

  const tapWord = (e: React.MouseEvent, word: string) => {
    const d = aux.dict.words[word.toLowerCase()]
    const gl = glossaryFor(word, q.it, aux.glossary)
    const k = (q.keywords || []).find(k => k.it.toLowerCase().split(/[^a-zà-ÿ]+/i).includes(word.toLowerCase()))
    const r = (e.target as HTMLElement).getBoundingClientRect()
    setPop({ x: Math.max(12, Math.min(window.innerWidth - 292, r.left + r.width / 2 - 140)), y: r.bottom + 8, html: <>
      <b>{word}</b> = {d ? d.en : k ? k.en : '…'} {d && d.base && d.base.toLowerCase() !== word.toLowerCase() && <span style={{ opacity: .7 }}>({d.base})</span>}
      {k && k.it.includes(' ') && <span className="note">“{k.it}” = {k.en}</span>}
      {TRAPS[word.toLowerCase()] && <span className="note">⚠️ Trap word! It often decides if the sentence is true.</span>}
      {gl && <span className="note">{gl.note}</span>}</> })
    g.current?.look(0, 3)
    speak(word, { lang: 'it-IT', rate: .85 })
  }
  const hint = () => {
    g.current?.poke()
    const trap = tokens.find(t => t.word && TRAPS[t.word.toLowerCase()])
    if (trap?.word) { const w = trap.word.toLowerCase(); talk(`Careful with «${w}» = "${TRAPS[w]}". Small words like this decide the answer!`, 'hint'); setFlash(f => f + 1) }
    else talk(pick(LINES.tips), 'hint')
  }

  const pct = Math.round(100 * S.pos / S.queue.length)
  const disabled = !!result
  return (
    <div onClick={e => { if (pop && !(e.target as HTMLElement).closest('.w, .word-pop')) setPop(null) }}>
      <div className="learn-top">
        <a href="#/" className="icon-btn" aria-label="Close lesson">✕</a>
        <button className="icon-btn" aria-label="Previous question" disabled={S.pos === 0} onClick={() => fly(-1)}>‹</button>
        <div className="bar"><motion.i animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
        <button className="icon-btn" aria-label="Next question" onClick={() => fly(1)}>›</button>
        <span className="count">{S.pos + 1}/{S.queue.length}</span>
      </div>
      <motion.div className="qswipe" drag="x" dragElastic={.6} dragConstraints={{ left: 0, right: 0 }} onDragEnd={onDragEnd}
        initial={{ x: S.dir > 0 ? 260 : S.dir < 0 ? -260 : 0, y: S.dir ? 0 : 16, opacity: 0, rotate: S.dir * 4 }} animate={controls} whileDrag={{ scale: .98 }}>
        <div className="stage">
          <button className="g-hit" aria-label="Tap Giulia for a hint" onClick={hint}><Giulia ref={g} state={gState} /></button>
          <div className="stage-side">
            <motion.div key={say} className={`gsay ${sayCls}`} aria-live="polite" initial={{ scale: .6, y: 8, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}>{say}</motion.div>
            <div className="round-btns">
              <button className="rbtn" aria-label="Listen again" onClick={read}>🔊 Listen</button>
              <button className="rbtn" aria-pressed={settings.speed === 'slow'} aria-label="Slow voice" onClick={() => { setSetting('speed', settings.speed === 'slow' ? 'normal' : 'slow'); setTimeout(read, 0) }}>🐢</button>
            </div>
          </div>
        </div>
        <motion.div ref={card} className="qcard" animate={shake ? { x: [0, -8, 7, -5, 3, 0] } : {}} transition={{ duration: .45 }}>
          <span className="qlabel">{ch.titleIt.split(/[;,]/)[0]}</span>
          <p className="q-it" lang="it">{tokens.map((t, i) => t.gap !== undefined ? t.gap : (
            <span key={i} className={`w ${kw.has(t.word!.toLowerCase()) ? 'kw' : ''} ${speaking === t.start ? 'speaking' : ''} ${flash && TRAPS[t.word!.toLowerCase()] ? 'flash' : ''}`}
              data-f={flash} role="button" tabIndex={0} onClick={e => tapWord(e, t.word!)}>{t.word}</span>))}</p>
          {q.image && <img className="q-img" src={q.image} alt="Figure for this question" loading="lazy" width={200} height={200} draggable={false} />}
          <AnimatePresence>{showEn && <motion.p className="q-en" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{q.en}</motion.p>}</AnimatePresence>
          <button className="linkbtn" onClick={() => setShowEn(s => !s)}>{showEn ? 'Hide English' : 'Show English translation'}</button>
        </motion.div>
      </motion.div>
      <div className="answers">
        <div className="two">
          {[true, false].map(v => (
            <motion.button key={String(v)} id={v ? 'aV' : 'aF'} className={`ans ${v ? 'vero' : 'falso'} ${result?.pick === v ? 'picked' : ''} ${result && !result.correct && result.pick !== null && q.answer === v ? 'correct' : ''}`}
              disabled={disabled} whileTap={{ y: 4 }} onPointerDown={() => !disabled && g.current?.lean(v ? 'L' : 'R')} onPointerUp={() => g.current?.lean(null)} onPointerLeave={() => g.current?.lean(null)}
              onClick={() => answer(v)}>
              <span className="ic">{v ? '✓' : '✕'}</span><span>{v ? 'VERO' : 'FALSO'}<small>{v ? 'true' : 'false'}</small></span>
            </motion.button>))}
        </div>
        <div className="dunno-row">
          <button className="dunno" disabled={disabled} onClick={() => { setSetting('explainLang', 'en'); answer(null) }}>🤔 I don't understand<small>explain in English</small></button>
          <button className="dunno" disabled={disabled} onClick={() => { setSetting('explainLang', 'it'); answer(null) }}>🇮🇹 Non capisco<small>spiegami in italiano</small></button>
        </div>
        <p className="swipe-hint">‹ swipe to move between questions ›</p>
      </div>
      <AnimatePresence>{pop && <motion.div className="word-pop" role="dialog" style={{ left: pop.x, top: pop.y }}
        initial={{ opacity: 0, scale: .85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .9 }}>{pop.html}</motion.div>}</AnimatePresence>
    </div>
  )
}

// ---------- checkpoint quizzes ----------
function quizSet(chId: string, byId: Map<string, Question>) {
  const seen = (store.ck(chId).seen as string[]).filter(id => byId.has(id))
  const newest = seen.slice(-10), older = seen.slice(0, -10), size = Math.min(seen.length, 30)
  const scored = older.map(id => { const r = (store.q(id) || {}) as any; return { id, s: (r.lastOk === false ? 100 : 0) + (r.box ? (6 - r.box) * 5 : 0) + Math.random() * 10 } })
    .sort((a, b) => b.s - a.s).slice(0, size - newest.length).map(x => x.id)
  return shuffle([...newest, ...scored])
}

function Checkpoint({ n, ids, onGo, onLater }: { n: number; ids: string[]; onGo: () => void; onLater: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => { setTimeout(() => confetti(btn.current, 40), 300) }, [])
  return (
    <div className="card done stack">
      <Giulia state="celebrate" />
      <span className="qlabel">Checkpoint</span>
      <h2>{n} questions learned! 🎉</h2>
      <p className="muted">Ready for a quick quiz? {ids.length} questions in random order, like the real exam: no help until the end. Then we look at any mistakes together.</p>
      <motion.button ref={btn} className="btn primary block" style={{ minHeight: 56 }} whileTap={{ scale: .96 }} onClick={onGo}>Yes, quiz me! ({ids.length}) →</motion.button>
      <button className="btn ghost block" onClick={onLater}>Not now, keep learning</button>
    </div>
  )
}

function Quiz({ ids: initialIds, byId, chId, onExplain, onFinish }: { ids: string[]; byId: Map<string, Question>; ch: Chapter; chId: string; onExplain: (q: Question, after: () => void) => void; onFinish: () => void }) {
  const [ids] = useState(initialIds)
  const [i, setI] = useState(0)
  const [res, setRes] = useState<{ id: string; pick: boolean; correct: boolean }[]>([])
  const g = useRef<GiuliaApi | null>(null)
  const settings = useSettings()
  const n = useRef(store.ck(chId).seen.length).current
  const finished = i >= ids.length
  const q = byId.get(ids[Math.min(i, ids.length - 1)])!

  useEffect(() => {
    if (finished) return
    const t = setTimeout(() => store.settings.autoRead && speak(q.it, { lang: 'it-IT', rate: store.settings.speed === 'slow' ? .72 : .95,
      onstart: () => g.current?.talkStart(), onboundary: (_c: number, _l: number, w: string, r: number) => g.current?.talkWord(w, r), onend: () => g.current?.talkStop() }), 350)
    return () => { clearTimeout(t); stopSpeech() }
  }, [i])

  useEffect(() => {
    if (!finished) return
    const right = res.filter(r => r.correct).length
    store.setQuizzed(chId, n); store.addQuiz(chId, res.length, right)
  }, [finished])

  if (finished) {
    const right = res.filter(r => r.correct).length, total = res.length, errors = total - right, allowed = Math.floor(total / 10), passed = errors <= allowed
    return (
      <div className="card done stack">
        <Giulia state={passed ? 'celebrate' : 'sad'} />
        <Ring pct={right / total} size={140} stroke={12} color={passed ? 'var(--ok)' : 'var(--no)'} label={`${right}/${total}`} />
        <h2>{passed ? 'Quiz passed! 🎉' : errors <= allowed + 2 ? 'So close! 💪' : "Let's review these together 📚"}</h2>
        <p className="muted">{errors} mistake{errors === 1 ? '' : 's'} (the exam allows {allowed} for {total} questions).{errors ? " Tap a mistake to see Giulia's explanation." : ''}</p>
        <div className="quiz-list">{res.map((r, k) => {
          const qq = byId.get(r.id)!
          return <button key={k} className={`qres ${r.correct ? 'ok' : 'no'}`} disabled={r.correct} onClick={() => onExplain(qq, () => {})}>
            <span className="mark">{r.correct ? '✓' : '✕'}</span><span className="txt">{qq.it}<small>{qq.answer ? 'VERO' : 'FALSO'}{r.correct ? '' : ' · you said ' + (r.pick ? 'VERO' : 'FALSO')}</small></span>{!r.correct && <span className="go">💡</span>}</button>
        })}</div>
        <button className="btn primary block" style={{ minHeight: 56 }} onClick={onFinish}>Continue learning →</button>
      </div>
    )
  }
  return (
    <div>
      <div className="learn-top quiz"><span className="qlabel" style={{ margin: 0 }}>Quiz</span>
        <div className="bar"><motion.i animate={{ width: `${Math.round(100 * i / ids.length)}%` }} /></div><span className="count">{i + 1}/{ids.length}</span></div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ x: 200, opacity: 0, rotate: 3 }} animate={{ x: 0, opacity: 1, rotate: 0 }} exit={{ x: -200, opacity: 0, rotate: -3 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}>
          <div className="stage quiz-stage"><Giulia ref={g} state="thinking" /><div className="stage-side"><div className="gsay">{i === 0 ? 'Quiz time! Answer them all, then we review 💪' : pick(['Next one!', 'Keep going!', 'Focus…', 'You can do it!'])}</div></div></div>
          <div className="qcard"><p className="q-it" lang="it">{q.it}</p>{q.image && <img className="q-img" src={q.image} alt="Figure for this question" width={200} height={200} />}</div>
        </motion.div>
      </AnimatePresence>
      <div className="answers"><div className="two">
        {[true, false].map(v => (
          <motion.button key={String(v)} className={`ans ${v ? 'vero' : 'falso'}`} whileTap={{ y: 4 }} onClick={() => {
            stopSpeech(); const correct = v === q.answer; store.record(q.id, correct)
            setRes(r => [...r, { id: q.id, pick: v, correct }]); if (settings.sound) sound.tick(); setI(x => x + 1)
          }}><span className="ic">{v ? '✓' : '✕'}</span><span>{v ? 'VERO' : 'FALSO'}<small>{v ? 'true' : 'false'}</small></span></motion.button>))}
      </div></div>
    </div>
  )
}

// ---------- end of round ----------
function Done({ S, all, chId, onAgain }: { S: any; all: Question[]; chId: string; onAgain: () => void }) {
  const total = S.right + S.wrong, pct = total ? S.right / total : 0
  const st = store.chapterStats(all.map(q => q.id)) as { total: number; known: number; mistakes: number }
  const ring = useRef<HTMLDivElement>(null)
  useEffect(() => { if (store.settings.sound) sound.done(); if (pct >= .7) setTimeout(() => confetti(ring.current, 60), 300) }, [])
  return (
    <div className="card done stack">
      <Giulia state={pct >= .7 ? 'celebrate' : 'happy'} />
      <div ref={ring}><Ring pct={pct} size={140} stroke={12} color={pct >= .7 ? 'var(--ok)' : 'var(--primary)'} label={`${S.right}/${total}`} /></div>
      <h2>{pct >= .9 ? 'Bravissimo! 🎉' : pct >= .7 ? 'Very good! 💪' : 'Good effort! 🌱'}</h2>
      <p className="muted">{pct >= .9 ? 'You really know this chapter.' : pct >= .7 ? "A few more rounds and you've got it." : "Every mistake you see now is one you won't make in the exam."}</p>
      <p className="small muted">Chapter: you know {st.known} of {st.total}{st.mistakes ? ` · ${st.mistakes} to fix` : ''}.</p>
      {S.wrongIds.size > 0 && <button className="btn primary block" onClick={onAgain}>Practise my {S.wrongIds.size} mistake{S.wrongIds.size > 1 ? 's' : ''} again</button>}
      {st.known < st.total && <a className={`btn ${S.wrongIds.size ? '' : 'primary'} block`} href={`#/learn/${chId}?r=${Date.now()}`} onClick={() => setTimeout(() => (location.hash = `#/learn/${chId}`), 0)}>Continue the chapter</a>}
      <a className="btn ghost block" href="#/">Back to chapters</a>
    </div>
  )
}
