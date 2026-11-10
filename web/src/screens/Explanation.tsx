// Full-screen explanation: quick answer, rule of thumb, sentence pieces, animated board, steps, same-topic drill.
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildScene } from '../lib/scenes/index.js'
import { speak, stop as stopSpeech } from '../lib/speech.js'
import { sound } from '../lib/sound.js'
import { Board, type BoardApi, type Scene } from '../components/Board'
import { Giulia, type GiuliaApi, type GiuliaState } from '../components/Giulia'
import { setSetting, shuffle, useSettings, type Chapter, type Lang, type Question } from '../util'

const UI = {
  en: { right: 'Right!', dunno: "Let's look at it together.", wrong: 'Not quite.', answerIs: "It's", why: 'Why', rule: 'The rule', trap: '⚠️ Watch out', kw: 'Key words',
    replay: '↺ Replay', slow: '🐢 Slow', step: '⏭ Step', got: 'Got it →', inEn: 'In English', look: 'Look at the board with me 👇', steps: 'Step by step',
    remember: 'Remember', read: 'Read the sentence piece by piece', decides: '← this decides it', drill: 'Same topic in the exam: try them!',
    drillSub: 'Similar official statements. Tap VERO or FALSO.', more: 'More details: rule, trap, key words',
    review: 'Giulia is double-checking this explanation. The official answer is correct.', stepOf: (a: number, b: number) => `Step ${a}/${b}` },
  it: { right: 'Giusto!', dunno: 'Vediamola insieme.', wrong: 'Non proprio.', answerIs: 'È', why: 'Perché', rule: 'La regola', trap: '⚠️ Attenzione', kw: 'Parole chiave',
    replay: '↺ Ripeti', slow: '🐢 Piano', step: '⏭ Passo', got: 'Ho capito →', inEn: 'In inglese', look: 'Guarda la lavagna con me 👇', steps: 'Passo dopo passo',
    remember: 'Ricorda', read: 'Leggi la frase pezzo per pezzo', decides: '← decide la risposta', drill: 'Stesso argomento: prova tu!',
    drillSub: "Domande simili dell'esame. Tocca VERO o FALSO.", more: 'Più dettagli: regola, trappola, parole chiave',
    review: 'Giulia sta ricontrollando questa spiegazione. La risposta ufficiale è corretta.', stepOf: (a: number, b: number) => `Passo ${a}/${b}` },
}

function Drill({ s, lang }: { s: Question; lang: Lang }) {
  const settings = useSettings()
  const [pickV, setPick] = useState<boolean | null>(null)
  const ok = pickV !== null && pickV === s.answer
  const choose = (v: boolean) => { setPick(v); if (settings.sound) (v === s.answer ? sound.correct : sound.wrong)() }
  return (
    <motion.div className={`drill-card ${pickV === null ? '' : ok ? 'ok' : 'no'}`} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <p className="d-it" lang="it">{s.it}</p>
      <div className="d-btns">
        {[true, false].map(v => (
          <button key={String(v)} disabled={pickV !== null} onClick={() => choose(v)}
            className={`${pickV !== null && v === s.answer ? 'right' : ''} ${pickV === v ? 'picked' : ''}`}>{v ? 'VERO' : 'FALSO'}</button>
        ))}
      </div>
      {pickV !== null && <motion.p className="d-res" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }}>
        <b>{ok ? (lang === 'it' ? 'Giusto!' : 'Right!') : 'No:'} {s.answer ? 'VERO' : 'FALSO'}</b> · {(lang === 'it' ? s.noteIt : s.note) || s.en}</motion.p>}
    </motion.div>
  )
}

interface Props { q: Question; ch: Chapter; wasRight: boolean; dunno: boolean; onDone: () => void }

export default function Explanation({ q, ch, wasRight, dunno, onDone }: Props) {
  const settings = useSettings()
  const [lang, setLang] = useState<Lang>(settings.explainLang === 'it' && q.explainIt ? 'it' : 'en')
  const u = UI[lang]
  const e = lang === 'it' ? { ...q.explain, ...q.explainIt } : q.explain
  const grp = ch.groups?.[String(q.group)]
  const scene = useMemo(() => buildScene(q, lang) as Scene, [q, lang])
  const siblings = useMemo(() => shuffle(ch.questions.filter(s => s.group === q.group && s.id !== q.id && !s.hidden)).slice(0, 6), [q, ch])
  const [say, setSay] = useState(u.look)
  const [stepIdx, setStepIdx] = useState(-1)
  const [gState, setG] = useState<GiuliaState>('idle')
  const [slow, setSlow] = useState(false)
  const [chunkOn, setChunkOn] = useState(-1)
  const sheet = useRef<HTMLDivElement>(null)
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const board = useRef<BoardApi | null>(null)
  const g2 = useRef<GiuliaApi | null>(null)

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; stopSpeech() } }, [])
  useEffect(() => { setSay(UI[lang].look); setStepIdx(-1) }, [lang])

  const onStep = (st: { text: string }, i: number) => {
    setSay(st.text); setStepIdx(i); g2.current?.poke()
    if (settings.narrate === false) return null
    setG('explain')
    return speak(st.text, {
      lang: lang === 'it' ? 'it-IT' : 'en-GB', rate: lang === 'it' ? .92 : 1,
      onstart: () => g2.current?.talkStart(), onboundary: (_c: number, _l: number, w: string, r: number) => g2.current?.talkWord(w, r), onend: () => g2.current?.talkStop(),
    }).then(() => new Promise(r => setTimeout(r, 250)))
  }

  return (
    <motion.div className="explain-sheet" role="dialog" aria-label="Explanation" ref={el => { sheet.current = el; setRoot(el) }}
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 220, damping: 28 }}>
      <div className="ex-head">
        <div style={{ flex: 1, minWidth: 0 }}><span className={`verdict ${wasRight ? 'ok' : 'no'}`}><span className="big">{wasRight ? '✓' : dunno ? '💡' : '✕'}</span>
          <span>{wasRight ? u.right : dunno ? u.dunno : u.wrong} {u.answerIs} <span className="ans-word">{q.answer ? 'VERO' : 'FALSO'}</span></span></span></div>
        <div className="seg" role="group" aria-label="Explanation language">
          <button aria-pressed={lang === 'en'} onClick={() => { stopSpeech(); setLang('en'); setSetting('explainLang', 'en') }}>EN</button>
          <button aria-pressed={lang === 'it'} disabled={!q.explainIt} onClick={() => { stopSpeech(); setLang('it'); setSetting('explainLang', 'it') }}>IT</button>
        </div>
      </div>
      <div className="ex-body">
        <motion.div className={`quick ${q.answer ? 'v' : 'f'}`} initial={{ opacity: 0, y: 20, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', delay: .15 }}>
          <span className="qa-pill">{q.answer ? '✓ VERO' : '✕ FALSO'}</span>
          <p className="qa-text">{(lang === 'it' ? q.noteIt : q.note) || e.short}</p>
        </motion.div>
        {grp && <motion.div className="remember" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', delay: .25 }}>
          <span className="lbl">🧠 {u.remember} · {lang === 'it' ? grp.titleIt : grp.title}</span>{lang === 'it' ? grp.it : grp.en}</motion.div>}
        {q.chunks ? (
          <div className="breakdown"><span className="lbl">{u.read}</span>
            <div className="chunks">{q.chunks.map((c, i) => (
              <motion.button key={i} className={`chunk ${c.key ? 'key' : ''} ${chunkOn === i ? 'on' : ''}`} initial={{ opacity: 0, y: 10, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', delay: .35 + i * .09 }} whileTap={{ scale: .95 }} onClick={() => { setChunkOn(i); speak(c.it, { lang: 'it-IT', rate: .85 }) }}>
                <span className="c-it" lang="it">{c.it}</span><span className="c-en">{c.en}</span>{c.key && <span className="c-tag">{u.decides}</span>}
              </motion.button>))}</div>
            <p className="full-en"><b>{u.inEn}:</b> {q.en}</p></div>
        ) : <p className="ex-translation"><span className="lbl">{u.inEn}</span>{q.en}</p>}

        <div className="teacher"><Giulia ref={g2} state={gState} /><motion.div key={say} className="say" aria-live="polite" initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>{say}</motion.div></div>
        <div className="board-wrap">
          <div className="board">
            <Board ref={board} scene={scene} scrollRoot={root} onStep={onStep}
              onLand={ok => { setG(ok ? 'happy' : 'oh'); if (!ok) setTimeout(() => setG('explain'), 1400) }}
              onEnd={() => setTimeout(() => setG(wasRight ? 'happy' : 'idle'), 1500)} />
            <div className="board-cap"><span>{u.stepOf(Math.max(1, stepIdx + 1), scene.steps.length)}</span>{scene.steps[stepIdx]?.it && <span className="it">{scene.steps[stepIdx].it}</span>}</div>
            <div className="board-progress"><i style={{ width: `${Math.round(100 * (stepIdx + 1) / scene.steps.length)}%` }} /></div>
          </div>
          <div className="board-ctrl">
            <button className="btn small" onClick={() => { stopSpeech(); board.current?.replay() }}>{u.replay}</button>
            <button className="btn small" aria-pressed={slow} onClick={() => { board.current?.setSpeed(slow ? 1 : .45); setSlow(!slow) }}>{u.slow}</button>
            <button className="btn small" onClick={() => { stopSpeech(); board.current?.step() }}>{u.step}</button>
            <button className="btn small" aria-pressed={settings.narrate !== false} aria-label="Giulia's voice"
              onClick={() => { const on = settings.narrate === false; setSetting('narrate', on); if (!on) { stopSpeech(); g2.current?.talkStop() } }}>{settings.narrate !== false ? '🔊' : '🔇'}</button>
          </div>
        </div>

        <div className="steps-box"><span className="lbl">{u.steps}</span>
          <ol className="steps">{scene.steps.map((st, i) => (
            <li key={i} className={i === stepIdx ? 'active' : i < stepIdx ? 'done' : ''}>
              <button onClick={() => { stopSpeech(); board.current?.seekStep(i) }}><span className="n">{i + 1}</span><span>{st.text}</span></button></li>))}</ol></div>

        {siblings.length > 0 && <div className="drill"><span className="lbl">🎯 {u.drill}</span>
          <p className="small muted" style={{ margin: '0 0 8px' }}>{u.drillSub}</p>
          {siblings.map(s => <Drill key={s.id + lang} s={s} lang={lang} />)}</div>}

        <details className="more"><summary>{u.more}</summary>
          <div className="exp">
            {e.short && <div className="blk why"><span className="lbl">{u.why}</span>{e.short}</div>}
            {e.rule && <div className="blk"><span className="lbl">{u.rule}</span>{e.rule}</div>}
            {e.trap && <div className="blk trap"><span className="lbl">{u.trap}</span>{e.trap}</div>}
            {q.keywords?.length ? <div className="blk"><span className="lbl">{u.kw}</span><div className="kw-list">{q.keywords.map(k => <span key={k.it} className="chip"><span className="it">{k.it}</span> {k.en}</span>)}</div></div> : null}
          </div></details>
        {q.review && <div className="blk review-note" style={{ marginTop: 10 }}>{u.review}</div>}
        <div className="ex-foot"><motion.button className="btn primary" whileTap={{ scale: .96 }} onClick={() => { stopSpeech(); onDone() }}>{u.got}</motion.button></div>
      </div>
    </motion.div>
  )
}
