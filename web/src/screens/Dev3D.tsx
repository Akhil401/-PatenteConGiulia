// Developer page: #/dev3d/q23476 shows one question's board on its own (2D engine + 3D view).
import { useEffect, useMemo, useRef, useState } from 'react'
import { data } from '../lib/data.js'
import { buildScene } from '../lib/scenes/index.js'
import { Board, type BoardApi, type Scene } from '../components/Board'
import type { Chapter, Question } from '../util'

export default function Dev3D({ qid, lang = 'en' }: { qid: string; lang?: string }) {
  const [q, setQ] = useState<Question | null>(null)
  const [step, setStep] = useState('')
  const board = useRef<BoardApi | null>(null)
  useEffect(() => {
    (async () => {
      const ready = await data.ready()
      for (const id of ready.chapters) {
        const ch = (await data.chapter(id)) as Chapter
        const f = ch.questions.find(x => x.id === qid)
        if (f) { setQ(f); return }
      }
    })()
  }, [qid])
  const scene = useMemo(() => (q ? (buildScene(q, lang) as Scene) : null), [q, lang])
  if (!q || !scene) return <div className="card">Loading {qid}…</div>
  return (
    <div className="learn-wrap">
      <p className="small muted">{q.id} · {q.explain.scene} · {JSON.stringify(q.explain.sceneParams)}</p>
      <div className="board"><Board ref={board} scene={scene} onStep={st => { setStep(st.text); return null }} /></div>
      <p style={{ fontWeight: 700 }}>{step}</p>
      <div className="board-ctrl"><button className="btn small" onClick={() => board.current?.replay()}>↺ Replay</button><button className="btn small" onClick={() => board.current?.step()}>⏭ Step</button></div>
    </div>
  )
}
