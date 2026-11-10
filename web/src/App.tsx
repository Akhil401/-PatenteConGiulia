import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { store } from './lib/store.js'
import { applyTheme, useHash } from './util'
import Home from './screens/Home'
import Learn from './screens/Learn'
import Settings from './screens/Settings'
import Dev3D from './screens/Dev3D'
import Exam from './screens/Exam'

function TopBar() {
  const st = store.streak() as { days: number }
  return (
    <header className="topbar">
      <a href="#/" className="brand" aria-label="Home">
        <span className="brand-mark" aria-hidden="true">G</span>
        <span className="brand-name">Patente <em>con Giulia</em></span>
      </a>
      <div className="topbar-right">
        {st.days > 0 && <span className="streak" title={`${st.days} days in a row`}>🔥 {st.days}</span>}
        <a href="#/settings" className="icon-btn" aria-label="Settings">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Zm7.43-2.53a7.8 7.8 0 0 0 0-1.94l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.3 7.3 0 0 0-1.68-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.38 2.65c-.6.25-1.17.58-1.68.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.8 7.8 0 0 0 0 1.94l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.39.3.6.22l2.49-1c.51.4 1.08.73 1.68.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.6-.25 1.17-.58 1.68-.98l2.49 1c.22.08.47 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65Z" /></svg>
        </a>
      </div>
    </header>
  )
}

export default function App() {
  const hash = useHash()
  useEffect(applyTheme, [])
  let screen: React.ReactNode
  const m = hash.match(/^#\/learn\/(ch\d\d)$/)
  const ex = hash.match(/^#\/exam\/(ch\d\d|mock)$/)
  const dev = hash.match(/^#\/dev3d\/(q\d+)(?:\/(it|en))?$/)
  if (m) screen = <Learn chId={m[1]} key={m[1]} />
  else if (ex) screen = <Exam scope={ex[1]} key={ex[1]} />
  else if (dev) screen = <Dev3D qid={dev[1]} lang={dev[2] || 'en'} key={hash} />
  else if (hash === '#/settings') screen = <Settings />
  else screen = <Home />
  return (
    <>
      <TopBar />
      <main id="view">
        <AnimatePresence mode="wait">
          <motion.div key={m ? 'learn' + m[1] : hash} initial={{ opacity: 0, y: 16, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            {screen}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  )
}
