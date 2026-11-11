// Progress + settings in localStorage. Leitner boxes for spaced repetition.

const KEY = "pcg.v1";
const INTERVAL_DAYS = [0, 0, 1, 3, 7, 16];   // index = box (1..5); box 1 = due again today
const DEFAULT_SETTINGS = {
  englishAlways: false,   // show the English translation without tapping
  speed: "normal",        // Italian voice: "normal" | "slow"
  autoRead: true,         // Giulia reads each question aloud
  enVoice: false,         // (old setting, replaced by narrate)
  narrate: true,          // Giulia speaks each step of the board animation
  explainLang: "en",      // explanation language: "en" | "it"
  scenes3d: true,
  examTimer: true,        // 20-minute countdown in exam-style quizzes
  sound: true,
  theme: "auto",          // auto | light | dark
  motion: "auto",         // auto | reduce
  carOnly: false,         // kept for the spec; the Patente B list has no motorbike-only questions
};

function today(d = new Date()) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function addDays(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return today(d); }

function blank() { return { v: 1, settings: { ...DEFAULT_SETTINGS }, q: {}, days: {}, exams: [], created: today() }; }

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    s.q = s.q || {}; s.days = s.days || {}; s.exams = s.exams || [];
    return s;
  } catch { return blank(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }

/**
 * Ask the browser to keep this site's data permanently (not cleared when the device runs low on space).
 * Asked once the learner has started answering, not on the first visit: some browsers decide from how
 * much the site is used, and Firefox shows a small prompt.
 */
let persistAsked = false;
export async function keepStorage() {
  try {
    const sm = navigator.storage;
    if (!sm || !sm.persist) return "unsupported";
    if (await sm.persisted()) return "kept";
    if (persistAsked) return "not-kept";
    persistAsked = true;
    return (await sm.persist()) ? "kept" : "not-kept";
  } catch { return "unsupported"; }
}
/** Current state without asking: "kept" | "not-kept" | "unsupported". */
export async function storageStatus() {
  try { const sm = navigator.storage; if (!sm || !sm.persisted) return "unsupported"; return (await sm.persisted()) ? "kept" : "not-kept"; }
  catch { return "unsupported"; }
}

export const store = {
  today,
  get settings() { return state.settings; },
  setSetting(k, v) { state.settings[k] = v; save(); },

  q(id) { return state.q[id]; },

  /** Record an answer. dunno = "I don't understand" (counts as not known). */
  record(id, correct) {
    const t = today();
    const r = state.q[id] || { n: 0, ok: 0, ko: 0, box: 0 };
    r.n++; r.last = t;
    if (correct) { r.ok++; r.box = Math.min(5, (r.box || 0) + 1); r.lastOk = true; }
    else { r.ko++; r.box = 1; r.lastOk = false; }
    r.due = addDays(t, INTERVAL_DAYS[r.box]);
    state.q[id] = r;
    if (!persistAsked) keepStorage();
    state.days[t] = (state.days[t] || 0) + 1;
    save();
    return r;
  },

  isDue(id) { const r = state.q[id]; return !!r && r.due <= today(); },
  isMistake(id) { const r = state.q[id]; return !!r && r.lastOk === false; },
  /** "Known" = answered right the last time. */
  isKnown(id) { const r = state.q[id]; return !!r && r.lastOk === true; },

  chapterStats(ids) {
    let seen = 0, known = 0, mistakes = 0, due = 0;
    for (const id of ids) {
      const r = state.q[id]; if (!r) continue;
      seen++; if (r.lastOk) known++; else mistakes++;
      if (r.due <= today()) due++;
    }
    return { total: ids.length, seen, known, mistakes, due };
  },

  /** Days in a row with at least one answer, ending today (or yesterday: you still have today). */
  streak() {
    let n = 0, d = today();
    if (!state.days[d]) d = addDays(d, -1);
    while (state.days[d]) { n++; d = addDays(d, -1); }
    return { days: n, todayDone: !!state.days[today()], todayCount: state.days[today()] || 0 };
  },

  // ---- checkpoints: questions first seen in a chapter, in order, and when the last quiz was offered ----
  ck(ch) { state.ck = state.ck || {}; return state.ck[ch] || (state.ck[ch] = { seen: [], quizzedAt: 0 }); },
  /** Mark a question as seen for the first time in this chapter; returns how many are seen. */
  markSeen(ch, id) { const c = store.ck(ch); if (!c.seen.includes(id)) { c.seen.push(id); save(); } return c.seen.length; },
  setQuizzed(ch, n) { store.ck(ch).quizzedAt = n; save(); },
  /** Exam-style quiz result. scope = chapter id or "mock" (all ready chapters). */
  addExam(scope, size, right, secs) { state.exams = state.exams || []; state.exams.push({ scope, size, right, secs, date: today() }); save(); },
  exams(scope) { return (state.exams || []).filter(e => e.scope === scope); },
  addQuiz(ch, size, right) { state.quizzes = state.quizzes || []; state.quizzes.push({ ch, size, right, date: today() }); save(); },

  exportJSON() { return JSON.stringify({ app: "patente-con-giulia", exported: new Date().toISOString(), ...state }, null, 1); },
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || typeof s.q !== "object") throw new Error("This file is not a Patente con Giulia progress file.");
    state = { ...blank(), ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } };
    delete state.app; delete state.exported;
    save();
  },
  reset() { const keep = state.settings; state = blank(); state.settings = keep; save(); },
};
