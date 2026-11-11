import { useEffect, useRef, useState } from 'react'
import { voiceInfo } from '../lib/speech.js'
import { keepStorage, storageStatus, store } from '../lib/store.js'
import { setSetting, toast, useSettings } from '../util'

function Switch({ k, title, desc }: { k: string; title: string; desc: string }) {
  const s = useSettings()
  return (
    <label className="setting"><span><b>{title}</b><br /><span className="desc">{desc}</span></span>
      <span className="switch"><input type="checkbox" checked={s[k] !== false && !!s[k]} onChange={e => setSetting(k, e.target.checked)} /><span /></span></label>
  )
}
function Select({ k, title, opts }: { k: string; title: string; opts: [string, string][] }) {
  const s = useSettings()
  return (
    <label className="setting"><b>{title}</b>
      <select className="sel" value={s[k]} onChange={e => setSetting(k, e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  )
}

export default function Settings() {
  const [vi, setVi] = useState<{ it: string | null; en: string | null }>({ it: null, en: null })
  const file = useRef<HTMLInputElement>(null)
  const [kept, setKept] = useState<string>('')
  useEffect(() => { voiceInfo().then(setVi); storageStatus().then(setKept) }, [])

  const exportFile = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `patente-progress-${store.today()}.json`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast('Progress exported.')
  }
  const importFile = async (f?: File) => {
    if (!f) return
    try { store.importJSON(await f.text()); setSetting('theme', store.settings.theme); toast('Progress imported.') }
    catch (err) { toast((err as Error).message || 'Could not read that file.') }
  }

  return (
    <div className="learn-wrap">
      <h1 style={{ marginTop: 6 }}>Settings</h1>
      <div className="section-title"><h3>Giulia</h3></div>
      <div className="group">
        <Switch k="autoRead" title="Read questions aloud" desc="Giulia reads each question in Italian." />
        <Select k="speed" title="Italian voice speed" opts={[['normal', 'Normal'], ['slow', 'Slow']]} />
        <Switch k="narrate" title="Explain the board aloud" desc="She says each step of the animation in plain words." />
        <Select k="explainLang" title="Explanation language" opts={[['en', 'English'], ['it', 'Italiano (simple)']]} />
      </div>
      <div className="section-title"><h3>Learning</h3></div>
      <div className="group">
        <Switch k="englishAlways" title="Always show English" desc="Show the translation under every question." />
        <Switch k="sound" title="Sounds" desc="A short chime for right and wrong answers." />
        <Switch k="examTimer" title="Exam timer" desc="Quiz 30 and the mock exam count down 20 minutes, like the real test." />
      </div>
      <div className="section-title"><h3>Look</h3></div>
      <div className="group">
        <Select k="theme" title="Appearance" opts={[['auto', 'Same as my phone'], ['light', 'Light'], ['dark', 'Dark']]} />
        <Select k="motion" title="Animations" opts={[['auto', 'Full'], ['reduce', 'Reduce motion']]} />
        <Switch k="scenes3d" title="3D scenes" desc="Show the board animations in 3D where available (turn off on slow phones)." />
      </div>
      <div className="section-title"><h3>Voices on this device</h3></div>
      <div className="group"><div className="setting"><span>Italian<br /><span className="desc">{vi.it || 'none found'}</span></span><span>English<br /><span className="desc">{vi.en || 'none found'}</span></span></div></div>
      <div className="section-title"><h3>Your progress</h3></div>
      <div className="card stack">
        <p className="muted small" style={{ margin: 0 }}>Progress is saved on this device only. Export it to keep a copy or move it to another phone.</p>
        {kept && kept !== 'unsupported' && (
          <div className={`keep ${kept === 'kept' ? 'ok' : ''}`}>
            <span className="dot" aria-hidden="true" />
            <span>{kept === 'kept'
              ? <><b>Kept permanently.</b> The browser will not clear your progress to free up space.</>
              : <><b>Not yet kept permanently.</b> The browser may clear it if the device runs low on space. Installing the app to the home screen helps.</>}</span>
            {kept !== 'kept' && <button className="btn small" onClick={async () => { const r = await keepStorage(); setKept(r); toast(r === 'kept' ? 'Your progress is now kept permanently.' : 'The browser said no for now. Install the app, then try again.') }}>Keep it</button>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn" onClick={exportFile}>⬇ Export</button>
          <button className="btn" onClick={() => file.current?.click()}>⬆ Import</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => importFile(e.target.files?.[0])} />
        </div>
        <button className="btn ghost" style={{ color: 'var(--no)' }}
          onClick={() => { if (confirm('Delete all your answers, mistakes and streak on this device? Your settings stay.')) { store.reset(); toast('Progress reset.') } }}>
          Reset all progress</button>
      </div>
    </div>
  )
}
