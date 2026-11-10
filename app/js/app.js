// Patente con Giulia - main app (hash router + screens).
import { data } from "./data.js";
import { store } from "./store.js";
import { stop as stopSpeech, voiceInfo } from "./speech.js";
import { createGiulia } from "./giulia.js";
import { learn } from "./learn.js";

const view = document.getElementById("view");
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let cleanup = [];
function onLeave(fn) { cleanup.push(fn); }

const CH_ICON = { 1: "📘", 2: "⚠️", 3: "⛔", 4: "🔵", 5: "🔻", 6: "〰️", 7: "🚦", 8: "🪧", 9: "🚧", 10: "🏷️", 11: "⏱️", 12: "↕️", 13: "🛣️",
  14: "🔀", 15: "🚗", 16: "🅿️", 17: "🛤️", 18: "💡", 19: "🔒", 20: "🪪", 21: "🚑", 22: "🍷", 23: "📄", 24: "🌿", 25: "🔧" };

// ---------- page-wide helpers ----------
function applyTheme() {
  const s = store.settings, root = document.documentElement;
  if (s.theme === "auto") delete root.dataset.theme; else root.dataset.theme = s.theme;
  if (s.motion === "reduce") root.dataset.motion = "reduce"; else delete root.dataset.motion;
}
const reducedMotion = () => store.settings.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
function updateStreak() {
  const st = store.streak();
  $("#streak").textContent = st.days ? `🔥 ${st.days}` : "";
  $("#streak").title = st.days ? `${st.days} day${st.days > 1 ? "s" : ""} in a row` : "";
}
let toastTimer = 0;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
function ring(pct, size = 46, stroke = 5, color = "var(--ok)") {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
    <circle class="v" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/></svg>`;
}
function confetti(fromEl, count = 22) {
  if (reducedMotion()) return;
  const r = fromEl.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "confetti-burst"; box.style.left = r.left + r.width / 2 + "px"; box.style.top = r.top + r.height / 2 + "px";
  const cols = ["#22c55e", "#facc15", "#6366f1", "#f472b6", "#38bdf8"];
  box.innerHTML = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, d = 90 + Math.random() * 140;
    return `<i style="background:${cols[i % 5]};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--rot:${(Math.random() * 720 - 360).toFixed(0)}deg"></i>`;
  }).join("");
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1200);
}

// ---------- router ----------
const routes = [
  [/^#?\/?$/, home],
  [/^#\/learn\/(ch\d\d)$/, (m) => learn(m[1], { view, $, esc, onLeave, confetti, ring, updateStreak, reducedMotion, showWordPop, closeWordPop, route, toast })],
  [/^#\/settings$/, settings],
];
async function route() {
  cleanup.forEach(f => { try { f(); } catch { /* ignore */ } }); cleanup = [];
  stopSpeech(); closeWordPop();
  document.querySelectorAll(".sheet, .explain-sheet").forEach(n => n.remove());
  const h = location.hash || "#/";
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) { try { await fn(m); } catch (e) { showError(e); } view.focus({ preventScroll: true }); return; }
  }
  location.hash = "#/";
}
function showError(e) {
  console.error(e);
  view.innerHTML = `<div class="card screen"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p><a class="btn" href="#/">Back home</a></div>`;
}

// ---------- home ----------
async function home() {
  const [index, ready] = await Promise.all([data.index(), data.ready()]);
  const readySet = new Set(ready.chapters);
  const st = store.streak();
  const vi = await voiceInfo();
  const readyCh = index.chapters.filter(c => readySet.has(c.id));
  const stats = {};
  let knownTotal = 0;
  for (const c of readyCh) {
    const ch = await data.chapter(c.id);
    stats[c.id] = store.chapterStats(ch.questions.map(q => q.id));
    knownTotal += stats[c.id].known;
  }
  const next = readyCh[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Buongiorno!" : hour < 18 ? "Ciao!" : "Buonasera!";
  view.innerHTML = `<div class="screen">
    <section class="hero">
      <div>
        <h1>${hello} 👋</h1>
        <p>${st.todayDone ? `Great work today. Keep the streak going!` : `I'm Giulia, your driving teacher. Ready for today's lesson?`}</p>
        <div class="hero-stats">
          <span class="stat"><b>🔥 ${st.days}</b>day streak</span>
          <span class="stat"><b>${st.todayCount}</b>today</span>
          <span class="stat"><b>${knownTotal}</b>known</span>
        </div>
      </div>
      <div id="g"></div>
      ${next ? `<a class="btn yellow hero-cta" href="#/learn/${next.id}">${stats[next.id] && stats[next.id].seen ? "Continue" : "Start"}: ${esc(next.titleEn.split(/[,(]/)[0])} →</a>` : ""}
    </section>
    ${!vi.supported || !vi.it ? `<div class="notice"><span>🔇</span><span><b>No Italian voice on this device.</b> You can still study with the text. To hear Giulia, add an Italian voice in your phone's text-to-speech settings.</span></div>` : ""}
    <div class="section-title"><h2>Chapters</h2><span class="muted small">${index.totalQuestions.toLocaleString()} official questions</span></div>
    <div class="chapters" id="chapters"></div>
    <div class="section-title"><h3>Coming soon</h3><span class="muted small">English is being written</span></div>
    <div class="chapters" id="soon"></div>
    <p class="muted small" style="margin-top:20px">Questions: official Ministry list (${esc(index.source)}).</p>
  </div>`;
  const g = createGiulia($("#g")); g.set("idle");
  for (const c of index.chapters) {
    const isReady = readySet.has(c.id);
    const el = document.createElement(isReady ? "a" : "div");
    el.className = "chapter " + (isReady ? "ready" : "locked");
    let right = `<span class="soon">Soon</span>`;
    if (isReady) {
      el.href = `#/learn/${c.id}`;
      const s = stats[c.id], pct = s.known / s.total;
      right = `<div class="ring" title="${s.known} of ${s.total} known">${ring(pct)}<span>${Math.round(pct * 100)}%</span></div>`;
    }
    el.innerHTML = `<span class="ico">${CH_ICON[c.n] || "📘"}</span><span><span class="t">${esc(c.titleEn)}</span><span class="it">${c.n}. ${esc(c.titleIt)}</span>
      ${isReady ? `<span class="it">${c.count} questions${stats[c.id].mistakes ? ` · <b style="color:var(--no)">${stats[c.id].mistakes} to fix</b>` : ""}</span>` : ""}</span>${right}`;
    (isReady ? $("#chapters") : $("#soon")).appendChild(el);
  }
}

// ---------- word popup (tap any Italian word) ----------
let pop = null;
function closeWordPop() { if (pop) { pop.remove(); pop = null; } }
document.addEventListener("click", e => { if (pop && !e.target.closest(".w") && !e.target.closest(".word-pop")) closeWordPop(); });
function showWordPop(el, info) {
  closeWordPop();
  pop = document.createElement("div");
  pop.className = "word-pop"; pop.setAttribute("role", "dialog");
  pop.innerHTML = info;
  document.body.appendChild(pop);
  const r = el.getBoundingClientRect(), pw = pop.offsetWidth;
  const left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2));
  let top = r.bottom + 8;
  if (top + pop.offsetHeight > window.innerHeight - 8) top = r.top - pop.offsetHeight - 8;
  pop.style.left = left + "px"; pop.style.top = top + "px";
}

// ---------- settings ----------
async function settings() {
  const s = store.settings;
  const vi = await voiceInfo();
  const sw = (key, title, desc) => `<label class="setting"><span><b>${title}</b><br><span class="desc">${desc}</span></span>
      <span class="switch"><input type="checkbox" data-k="${key}" ${s[key] !== false && s[key] ? "checked" : ""}><span></span></span></label>`;
  const sel = (key, title, opts) => `<label class="setting"><b>${title}</b><select class="sel" data-k="${key}">${opts.map(([v, l]) => `<option value="${v}" ${s[key] === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  view.innerHTML = `<div class="screen learn-wrap">
    <h1 style="margin-top:6px">Settings</h1>
    <div class="section-title"><h3>Giulia</h3></div>
    <div class="group">
      ${sw("autoRead", "Read questions aloud", "Giulia reads each question in Italian.")}
      ${sel("speed", "Italian voice speed", [["normal", "Normal"], ["slow", "Slow"]])}
      ${sw("narrate", "Explain the board aloud", "She says each step of the animation in plain words.")}
      ${sel("explainLang", "Explanation language", [["en", "English"], ["it", "Italiano (simple)"]])}
    </div>
    <div class="section-title"><h3>Learning</h3></div>
    <div class="group">
      ${sw("englishAlways", "Always show English", "Show the translation under every question.")}
      ${sw("sound", "Sounds", "A short chime for right and wrong answers.")}
    </div>
    <div class="section-title"><h3>Look</h3></div>
    <div class="group">
      ${sel("theme", "Appearance", [["auto", "Same as my phone"], ["light", "Light"], ["dark", "Dark"]])}
      ${sel("motion", "Animations", [["auto", "Full"], ["reduce", "Reduce motion"]])}
    </div>
    <div class="section-title"><h3>Voices on this device</h3></div>
    <div class="group"><div class="setting"><span>Italian<br><span class="desc">${esc(vi.it || "none found")}</span></span><span>English<br><span class="desc">${esc(vi.en || "none found")}</span></span></div></div>
    <div class="section-title"><h3>Your progress</h3></div>
    <div class="card stack">
      <p class="muted small" style="margin:0">Progress is saved on this device only. Export it to keep a copy or move it to another phone.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn" id="exp">⬇ Export</button>
        <label class="btn" for="imp">⬆ Import</label>
        <input type="file" id="imp" accept="application/json,.json" hidden>
      </div>
      <button class="btn ghost" id="reset" style="color:var(--no)">Reset all progress</button>
    </div></div>`;
  view.querySelectorAll("input[data-k]").forEach(i => i.addEventListener("change", () => { store.setSetting(i.dataset.k, i.checked); }));
  view.querySelectorAll("select[data-k]").forEach(i => i.addEventListener("change", () => { store.setSetting(i.dataset.k, i.value); applyTheme(); }));
  $("#exp").addEventListener("click", () => {
    const blob = new Blob([store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `patente-progress-${store.today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Progress exported.");
  });
  $("#imp").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); applyTheme(); updateStreak(); toast("Progress imported."); settings(); }
    catch (err) { toast(err.message || "Could not read that file."); }
  });
  $("#reset").addEventListener("click", () => {
    if (confirm("Delete all your answers, mistakes and streak on this device? Your settings stay.")) { store.reset(); updateStreak(); toast("Progress reset."); }
  });
}

// ---------- start ----------
applyTheme();
updateStreak();
window.addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => { /* offline support unavailable */ });
}
