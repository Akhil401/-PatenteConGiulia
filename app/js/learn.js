// Learn a chapter: questions with Giulia, swipe navigation, explanations, checkpoint quizzes.
import { data, tokenize, glossaryFor } from "./data.js";
import { store } from "./store.js";
import { speak, stop as stopSpeech } from "./speech.js";
import { createGiulia } from "./giulia.js";
import { sound } from "./sound.js";
import { createBoard } from "./scenes/engine.js";
import { buildScene } from "./scenes/index.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// What Giulia says
const LINES = {
  ask: ["Vero o falso?", "Listen carefully…", "Read every word!", "What do you think?", "Vero o falso? Take your time."],
  praise: ["Esatto! 🎯", "Perfetto!", "Bravissimo! 👏", "Giusto!", "Ottimo lavoro!", "Yes! Well done."],
  wrong: ["No problem. Let me show you 👇", "Almost! Look at this.", "Tricky one! Let's see why."],
  nudge: "Take your time 🙂 Tap any word you don't know.",
  tips: ["Tip: tap any Italian word to see what it means 👆", "Tip: imagine the road. Who could be coming?", "Tip: «deve» means must. It makes a rule strict.", "Tip: read to the very last word before you answer."],
  combo: { 3: "3 in a row! 🔥", 5: "5 in a row! You're on fire! 🔥🔥", 10: "10 in a row!! Campione! 🏆", 15: "15 in a row! Incredibile! 🚀" },
};
// small Italian words that often decide the answer
const TRAPS = { sempre: "always", mai: "never", solo: "only", soltanto: "only", unicamente: "only", esclusivamente: "only", anche: "also / even",
  purché: "as long as", qualsiasi: "any", tutti: "all", nessun: "no", nessuno: "nobody", indifferentemente: "either way", obbligatoriamente: "must" };

const UI = {
  en: { right: "Right!", dunno: "Let's look at it together.", wrong: "Not quite.", answerIs: "It's", why: "Why", rule: "The rule", trap: "⚠️ Watch out", kw: "Key words",
    replay: "↺ Replay", slow: "🐢 Slow", step: "⏭ Step", got: "Got it →", inEn: "In English", look: "Look at the board with me 👇", steps: "Step by step",
    review: "Giulia is double-checking this explanation. The official answer is correct.", soon: "This explanation is coming soon. The official answer is correct.",
    stepOf: (a, b) => `Step ${a}/${b}` },
  it: { right: "Giusto!", dunno: "Vediamola insieme.", wrong: "Non proprio.", answerIs: "È", why: "Perché", rule: "La regola", trap: "⚠️ Attenzione", kw: "Parole chiave",
    replay: "↺ Ripeti", slow: "🐢 Piano", step: "⏭ Passo", got: "Ho capito →", inEn: "In inglese", look: "Guarda la lavagna con me 👇", steps: "Passo dopo passo",
    review: "Giulia sta ricontrollando questa spiegazione. La risposta ufficiale è corretta.", soon: "Questa spiegazione arriva presto. La risposta ufficiale è corretta.",
    stepOf: (a, b) => `Passo ${a}/${b}` },
};

export async function learn(chId, X) {
  const { view, $, esc, onLeave, confetti, ring, updateStreak, reducedMotion, showWordPop, closeWordPop, route, toast } = X;
  const [ch, glossary, dict, intros] = await Promise.all([data.chapter(chId), data.glossary(), data.dict(chId), data.intros().catch(() => ({}))]);
  const all = ch.questions.filter(q => !q.hidden);
  const byId = new Map(all.map(q => [q.id, q]));
  const todo = all.filter(q => !store.isKnown(q.id));
  const reviewRound = todo.length === 0;
  const S = { queue: (reviewRound ? all : todo).map(q => q.id), pos: 0, right: 0, wrong: 0, wrongIds: new Set(), requeued: new Set(), results: [], combo: 0, checkpoint: 0 };
  const stats = store.chapterStats(all.map(q => q.id));
  const intro = intros[chId] || {};

  let board = null, g = null, nudgeTimer = 0, typeTimer = 0;
  const closeOverlays = () => { document.querySelectorAll(".sheet, .explain-sheet").forEach(n => n.remove()); document.body.style.overflow = ""; };
  // Giulia's eyes follow your finger / mouse anywhere on the page
  const onMove = e => { g && g.lookAt(e.clientX, e.clientY); };
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  onLeave(() => {
    board && board.destroy(); clearTimeout(nudgeTimer); clearInterval(typeTimer); closeOverlays();
    window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerdown", onMove);
  });

  /** Giulia's speech bubble types the text out. */
  function say(text, cls = "") {
    const el = $("#gsay"); if (!el) return;
    clearInterval(typeTimer);
    el.className = "gsay " + cls; void el.offsetWidth; el.classList.add("pop");
    if (reducedMotion()) { el.textContent = text; return; }
    let i = 0; el.textContent = "";
    typeTimer = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeTimer); }, 22);
  }

  // ---------- intro ----------
  view.innerHTML = `<div class="screen learn-wrap">
    <section class="hero" style="grid-template-columns:1fr 130px">
      <div><span class="stat" style="display:inline-block;margin-bottom:8px">Chapter ${ch.n}</span>
        <h1 style="white-space:normal">${esc(ch.titleEn)}</h1><p style="margin:0"><i>${esc(ch.titleIt)}</i></p></div>
      <div id="g"></div>
    </section>
    <div class="card intro-card stack">
      ${intro.en ? `<p style="font-size:1.05rem;margin:0">${esc(intro.en)}</p>` : ""}
      ${intro.tips ? `<ul class="tips">${intro.tips.map(t => `<li>💡 ${esc(t)}</li>`).join("")}</ul>` : ""}
      <ul class="tips"><li>👆 Swipe left or right to move between questions.</li><li>🧠 Every 10 new questions, Giulia offers you a quick quiz.</li></ul>
      <div class="bar"><i style="width:${Math.round(100 * stats.known / stats.total)}%"></i></div>
      <p class="muted small" style="margin:0">${all.length} questions · you know ${stats.known} · ${stats.mistakes} to fix.
        ${reviewRound ? "You know them all: this is a review round." : stats.seen ? "We continue with the ones you don't know yet." : ""}</p>
      <button class="btn primary block" id="start" style="min-height:56px;font-size:1.05rem">${stats.seen ? "Continue" : "Let's start"} →</button>
      <a class="btn ghost block" href="#/">Back to chapters</a>
    </div></div>`;
  g = createGiulia($("#g")); g.set("happy"); g.enter();
  $("#start").addEventListener("click", () => renderQuestion(0), { once: true });

  // ---------- navigation ----------
  function afterAnswer() {
    closeOverlays(); stopSpeech();
    board && board.destroy(); board = null;
    if (S.checkpoint) { const n = S.checkpoint; S.checkpoint = 0; return offerQuiz(n); }
    goNext();
  }
  function goNext() {
    clearTimeout(nudgeTimer);
    const answered = !!S.results[S.pos];
    if (!answered && S.pos < S.queue.length - 1) {
      // skip: this question comes back at the end
      const [id] = S.queue.splice(S.pos, 1); S.queue.push(id);
      toast("Skipped. It will come back later.");
      return renderQuestion(1);
    }
    if (!answered) return toast("Answer this one to finish 🙂");
    S.pos++;
    if (S.pos >= S.queue.length) return renderDone();
    renderQuestion(1);
  }
  function goPrev() {
    if (S.pos === 0) return toast("This is the first question.");
    S.pos--; renderQuestion(-1);
  }

  // ---------- one question ----------
  function renderQuestion(dir = 0) {
    stopSpeech(); closeWordPop(); closeOverlays(); clearTimeout(nudgeTimer);
    const q = byId.get(S.queue[S.pos]);
    const done = S.results[S.pos];
    const s = store.settings;
    const kw = new Set((q.keywords || []).flatMap(k => k.it.toLowerCase().split(/[^a-zà-ÿ]+/i)).filter(w => w.length > 2));
    const itHtml = tokenize(q.it).map(t => t.gap !== undefined ? esc(t.gap)
      : `<span class="w${kw.has(t.word.toLowerCase()) ? " kw" : ""}${TRAPS[t.word.toLowerCase()] ? " trapw" : ""}" data-w="${esc(t.word)}" data-s="${t.start}" tabindex="0" role="button">${esc(t.word)}</span>`).join("");
    const pct = Math.round(100 * S.pos / S.queue.length);
    view.innerHTML = `<div class="learn-wrap">
      <div class="learn-top">
        <a href="#/" class="icon-btn" aria-label="Close lesson">✕</a>
        <button class="icon-btn" id="prev" aria-label="Previous question" ${S.pos === 0 ? "disabled" : ""}>‹</button>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <button class="icon-btn" id="nextq" aria-label="Next question">›</button>
        <span class="count">${S.pos + 1}/${S.queue.length}</span>
      </div>
      <div class="qswipe ${dir > 0 ? "in-right" : dir < 0 ? "in-left" : "in-up"}" id="qswipe">
        <div class="stage">
          <button class="g-hit" id="ghit" aria-label="Tap Giulia for a hint"><div id="g"></div></button>
          <div class="stage-side">
            <div class="gsay" id="gsay" aria-live="polite"></div>
            <div class="round-btns">
              <button class="rbtn" id="replay" aria-label="Listen again">🔊 Listen</button>
              <button class="rbtn" id="speed" aria-pressed="${s.speed === "slow"}" aria-label="Slow voice">🐢</button>
            </div>
          </div>
        </div>
        <div class="qcard" id="qcard">
          <span class="qlabel">${esc(ch.titleIt.split(/[;,]/)[0])}</span>
          <p class="q-it" lang="it" id="qit">${itHtml}</p>
          ${q.image ? `<img class="q-img" src="${esc(q.image)}" alt="Figure for this question" loading="lazy" width="200" height="200">` : ""}
          <p class="q-en" id="qen" ${s.englishAlways || done ? "" : "hidden"}>${esc(q.en || "(English translation coming soon)")}</p>
          <button class="linkbtn" id="showEn">${s.englishAlways || done ? "Hide English" : "Show English translation"}</button>
        </div>
      </div>
      <div class="answers" id="answers">
        <div class="two">
          <button class="ans vero" id="aV"><span class="ic">✓</span><span>VERO<small>true</small></span></button>
          <button class="ans falso" id="aF"><span class="ic">✕</span><span>FALSO<small>false</small></span></button>
        </div>
        <div class="dunno-row">
          <button class="dunno" id="aD">🤔 I don't understand<small>explain in English</small></button>
          <button class="dunno" id="aDi">🇮🇹 Non capisco<small>spiegami in italiano</small></button>
        </div>
        <p class="swipe-hint">‹ swipe to move between questions ›</p>
      </div></div>`;
    g = createGiulia($("#g"));
    g.set(done ? (done.correct ? "happy" : "sad") : "idle");
    g.enter();
    $("#prev").addEventListener("click", () => fly(-1));
    $("#nextq").addEventListener("click", () => fly(1));
    bindSwipe($("#qswipe"));

    // tap Giulia: she reacts and gives a hint (never the answer)
    $("#ghit").addEventListener("click", () => {
      g.poke();
      const traps = [...view.querySelectorAll("#qit .trapw")];
      if (traps.length) {
        const w = traps[0].dataset.w.toLowerCase();
        say(`Careful with «${w}» = "${TRAPS[w]}". Small words like this decide the answer!`, "hint");
        traps.forEach(t => { t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); });
      } else say(pick(LINES.tips), "hint");
    });

    // tap a word -> meaning
    $("#qit").addEventListener("click", e => {
      const w = e.target.closest(".w"); if (!w || swiped) return;
      const word = w.dataset.w, d = dict.words[word.toLowerCase()];
      const gl = glossaryFor(word, q.it, glossary);
      const k = (q.keywords || []).find(k => k.it.toLowerCase().split(/[^a-zà-ÿ]+/i).includes(word.toLowerCase()));
      let html = `<b>${esc(word)}</b> = ${esc(d ? d.en : (k ? k.en : "…"))}`;
      if (d && d.base && d.base.toLowerCase() !== word.toLowerCase()) html += ` <span style="opacity:.7">(${esc(d.base)})</span>`;
      if (k && k.it.includes(" ")) html += `<span class="note">“${esc(k.it)}” = ${esc(k.en)}</span>`;
      if (TRAPS[word.toLowerCase()]) html += `<span class="note">⚠️ Trap word! It often decides if the sentence is true.</span>`;
      if (gl) html += `<span class="note">${esc(gl.note)}</span>`;
      showWordPop(w, html);
      g.look(0, 3);
      speak(word, { lang: "it-IT", rate: .85 });
    });
    $("#qit").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest(".w")) { e.preventDefault(); e.target.click(); } });

    const words = [...view.querySelectorAll("#qit .w")];
    function read() {
      g.set("asking");
      speak(q.it, {
        lang: "it-IT", rate: store.settings.speed === "slow" ? .72 : .95,
        onstart: () => g.talkStart(),
        onboundary: (ci, len, word, rate) => { g.talkWord(word, rate); words.forEach(w => w.classList.toggle("speaking", +w.dataset.s === ci)); },
        onend: () => {
          g.talkStop(); words.forEach(w => w.classList.remove("speaking"));
          if (g.state === "asking") g.set("thinking");
          if (!S.results[S.pos]) nudgeTimer = setTimeout(() => { if (!S.results[S.pos]) { say(LINES.nudge); g.poke(); } }, 15000);
        },
      });
    }
    $("#replay").addEventListener("click", read);
    $("#speed").addEventListener("click", e => {
      const slow = store.settings.speed !== "slow";
      store.setSetting("speed", slow ? "slow" : "normal");
      e.currentTarget.setAttribute("aria-pressed", slow); read();
    });
    $("#showEn").addEventListener("click", e => {
      const en = $("#qen"); en.hidden = !en.hidden;
      e.currentTarget.textContent = en.hidden ? "Show English translation" : "Hide English";
    });

    // Giulia leans towards the button you are pressing
    for (const [id, dirn] of [["#aV", "L"], ["#aF", "R"]]) {
      const b = $(id);
      b.addEventListener("pointerdown", () => !b.disabled && g.lean(dirn));
      b.addEventListener("pointerleave", () => g.lean(null));
      b.addEventListener("pointerup", () => g.lean(null));
    }

    if (done) {
      // reviewing an earlier answer
      ["#aV", "#aF", "#aD", "#aDi"].forEach(id => { $(id).disabled = true; });
      if (done.pick !== null) $(done.pick ? "#aV" : "#aF").classList.add("picked");
      $(q.answer ? "#aV" : "#aF").classList.add("correct");
      say(done.correct ? "You got this one right ✓" : `This one is ${q.answer ? "VERO" : "FALSO"}. Tap "Why?" to see it again.`);
      showSheet(q, done.correct, true);
      return;
    }
    $("#aV").addEventListener("click", () => answer(q, true));
    $("#aF").addEventListener("click", () => answer(q, false));
    $("#aD").addEventListener("click", () => { store.setSetting("explainLang", "en"); answer(q, null); });
    $("#aDi").addEventListener("click", () => { store.setSetting("explainLang", "it"); answer(q, null); });
    say(S.pos === 0 && S.answeredOnce !== true ? "Ciao! Tap me if you need a hint 😉" : pick(LINES.ask));
    if (store.settings.autoRead) setTimeout(read, dir ? 380 : 250); else g.set("thinking");
    window.scrollTo({ top: 0 });
  }

  // drag the card with your finger; release past the threshold to change question
  let swiped = false;
  function bindSwipe(el) {
    let x0 = 0, y0 = 0, dx = 0, active = false, horiz = null;
    el.addEventListener("pointerdown", e => { if (e.button > 0) return; active = true; horiz = null; swiped = false; x0 = e.clientX; y0 = e.clientY; dx = 0; });
    el.addEventListener("pointermove", e => {
      if (!active) return;
      dx = e.clientX - x0; const dy = e.clientY - y0;
      if (horiz === null && Math.hypot(dx, dy) > 10) horiz = Math.abs(dx) > Math.abs(dy);
      if (!horiz) return;
      swiped = Math.abs(dx) > 12;
      el.style.transition = "none";
      el.style.transform = `translateX(${dx}px) rotate(${dx * .025}deg)`;
      el.style.opacity = String(1 - Math.min(.5, Math.abs(dx) / 500));
    });
    const end = () => {
      if (!active) return; active = false;
      if (horiz && Math.abs(dx) > 80) { dx < 0 ? fly(1) : fly(-1); }
      else { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; }
      setTimeout(() => { swiped = false; }, 50);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
  function fly(dir) {
    if (dir < 0 && S.pos === 0) { toast("This is the first question."); return resetCard(); }
    const el = $("#qswipe");
    if (!el || reducedMotion()) return dir > 0 ? goNext() : goPrev();
    el.style.transition = "transform .28s cubic-bezier(.5,0,.75,0), opacity .28s";
    el.style.transform = `translateX(${dir > 0 ? -120 : 120}%) rotate(${dir > 0 ? -8 : 8}deg)`;
    el.style.opacity = "0";
    setTimeout(() => (dir > 0 ? goNext() : goPrev()), 240);
  }
  function resetCard() { const el = $("#qswipe"); if (el) { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; } }

  function answer(q, choice) {
    stopSpeech(); g.talkStop(); closeWordPop(); clearTimeout(nudgeTimer); g.lean(null);
    S.answeredOnce = true;
    const correct = choice === q.answer;
    const firstTime = !store.q(q.id);
    store.record(q.id, correct);
    updateStreak();
    if (firstTime) {
      const n = store.markSeen(chId, q.id);
      if (n % 10 === 0 && n > store.ck(chId).quizzedAt) S.checkpoint = n;
    }
    S.results[S.pos] = { pick: choice, correct };
    ["#aV", "#aF", "#aD", "#aDi"].forEach(id => { $(id).disabled = true; });
    if (choice !== null) $(choice ? "#aV" : "#aF").classList.add("picked");
    $("#qen").hidden = false; $("#showEn").textContent = "Hide English";
    if (correct) {
      S.right++; S.combo++;
      g.set("happy");
      const combo = LINES.combo[S.combo];
      say(combo || pick(LINES.praise), combo ? "combo" : "");
      if (store.settings.sound) sound.correct();
      if (navigator.vibrate) try { navigator.vibrate(20); } catch { /* ignore */ }
      confetti($(choice ? "#aV" : "#aF"), combo ? 60 : 22);
      showSheet(q, true, false);
    } else {
      S.wrong++; S.combo = 0; S.wrongIds.add(q.id);
      if (!S.requeued.has(q.id)) {  // see it again later in this session
        S.requeued.add(q.id);
        S.queue.splice(Math.min(S.queue.length, S.pos + 6), 0, q.id);
      }
      g.set(choice === null ? "explain" : "sad");
      say(choice === null ? "Of course! Let's look at it together 👇" : pick(LINES.wrong));
      if (choice !== null) {
        $(q.answer ? "#aV" : "#aF").classList.add("correct");
        $("#qcard").classList.add("shake");
        if (store.settings.sound) sound.wrong();
        if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch { /* ignore */ }
      }
      setTimeout(() => showExplanation(q, false, choice === null, afterAnswer), choice === null ? 200 : 900);
    }
  }

  /** Bottom sheet after an answer (or when reviewing): you decide when to continue. */
  function showSheet(q, ok, reviewing) {
    closeOverlays();
    const sh = document.createElement("div");
    sh.className = "sheet " + (ok ? "ok" : "no"); sh.setAttribute("role", "status");
    sh.innerHTML = `<div class="row"><span class="big">${ok ? "✓" : "✕"}</span><div><h3>${ok ? (reviewing ? "You got it right" : "Esatto!") : "Answer: " + (q.answer ? "VERO" : "FALSO")}</h3>
        <span class="small">${ok ? `It's <b>${q.answer ? "VERO" : "FALSO"}</b>.` : "You can see the explanation again."}</span></div></div>
      <div class="acts"><button class="btn go" id="next">Continue →</button><button class="btn why" id="why">💡 Why?</button></div>`;
    document.body.appendChild(sh);
    $("#next").addEventListener("click", () => { sh.classList.add("leaving"); setTimeout(reviewing ? goNext : afterAnswer, 180); });
    $("#why").addEventListener("click", () => { sh.remove(); showExplanation(q, ok, false, reviewing ? () => { closeOverlays(); renderQuestion(0); } : afterAnswer); });
    $("#next").focus({ preventScroll: true });
  }

  // ---------- explanation (full-screen sheet) ----------
  function showExplanation(q, wasRight, dunno, onDone) {
    let lang = store.settings.explainLang === "it" && q.explainIt ? "it" : "en";
    closeOverlays();
    const sheet = document.createElement("div");
    sheet.className = "explain-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Explanation");
    document.body.appendChild(sheet);
    document.body.style.overflow = "hidden";
    let g2 = null, io = null;
    const both = st => { g && g.set(st); g2 && g2.set(st); };
    const grp = ch.groups && ch.groups[String(q.group)];
    // other official statements on the same topic (same picture / group)
    const siblings = shuffle(ch.questions.filter(s => s.group === q.group && s.id !== q.id && !s.hidden)).slice(0, 6);

    function render() {
      stopSpeech();
      board && board.destroy();
      const u = UI[lang];
      const e = lang === "it" ? { ...q.explain, ...q.explainIt } : (q.explain || {});
      const narrate = store.settings.narrate !== false;
      sheet.innerHTML = `
        <div class="ex-head">
          <div style="flex:1;min-width:0"><span class="verdict ${wasRight ? "ok" : "no"}"><span class="big">${wasRight ? "✓" : dunno ? "💡" : "✕"}</span>
            <span>${wasRight ? u.right : dunno ? u.dunno : u.wrong} ${u.answerIs} <span class="ans-word">${q.answer ? "VERO" : "FALSO"}</span></span></span></div>
          <div class="seg" role="group" aria-label="Explanation language">
            <button data-lang="en" aria-pressed="${lang === "en"}">EN</button>
            <button data-lang="it" aria-pressed="${lang === "it"}" ${q.explainIt ? "" : "disabled"}>IT</button>
          </div>
        </div>
        <div class="ex-body">
          <div class="quick ${q.answer ? "v" : "f"}">
            <span class="qa-pill">${q.answer ? "✓ VERO" : "✕ FALSO"}</span>
            <p class="qa-text">${esc((lang === "it" ? q.noteIt : q.note) || e.short || "")}</p>
          </div>
          ${grp ? `<div class="remember"><span class="lbl">🧠 ${lang === "it" ? "Ricorda" : "Remember"} · ${esc(lang === "it" ? grp.titleIt : grp.title)}</span>${esc(lang === "it" ? grp.it : grp.en)}</div>` : ""}
          ${q.chunks ? `<div class="breakdown"><span class="lbl">${lang === "it" ? "Leggi la frase pezzo per pezzo" : "Read the sentence piece by piece"}</span>
            <div class="chunks">${q.chunks.map((c, i) => `<button class="chunk ${c.key ? "key" : ""}" data-i="${i}" style="--d:${i * 90}ms"><span class="c-it" lang="it">${esc(c.it)}</span><span class="c-en">${esc(c.en)}</span>${c.key ? `<span class="c-tag">${lang === "it" ? "← decide la risposta" : "← this decides it"}</span>` : ""}</button>`).join("")}</div>
            <p class="full-en"><b>${u.inEn}:</b> ${esc(q.en || "")}</p></div>`
          : `<p class="ex-translation"><span class="lbl">${u.inEn}</span>${esc(q.en || "")}</p>`}
          <div class="teacher"><div id="g2"></div><div class="say" id="say" aria-live="polite">${u.look}</div></div>
          <div class="board-wrap">
            <div class="board"><div id="boardSvg"></div><div class="board-cap" id="cap"></div><div class="board-progress"><i id="bprog"></i></div></div>
            <div class="board-ctrl">
              <button class="btn small" id="bReplay">${u.replay}</button>
              <button class="btn small" id="bSlow" aria-pressed="false">${u.slow}</button>
              <button class="btn small" id="bStep">${u.step}</button>
              <button class="btn small" id="bVoice" aria-pressed="${narrate}" aria-label="Giulia's voice">${narrate ? "🔊" : "🔇"}</button>
            </div>
          </div>
          <div class="steps-box"><span class="lbl">${u.steps}</span><ol class="steps" id="steps"></ol></div>
          ${siblings.length ? `<div class="drill"><span class="lbl">🎯 ${lang === "it" ? "Stesso argomento: prova tu!" : "Same topic in the exam: try them!"}</span>
            <p class="small muted" style="margin:0 0 8px">${lang === "it" ? "Domande simili dell'esame. Tocca VERO o FALSO." : "Similar official statements. Tap VERO or FALSO."}</p>
            ${siblings.map(s => `<div class="drill-card" data-id="${s.id}"><p class="d-it" lang="it">${esc(s.it)}</p>
              <div class="d-btns"><button data-v="1">VERO</button><button data-v="0">FALSO</button></div><p class="d-res" hidden></p></div>`).join("")}</div>` : ""}
          <details class="more">
            <summary>${lang === "it" ? "Più dettagli: regola, trappola, parole chiave" : "More details: rule, trap, key words"}</summary>
            <div class="exp">
              ${e.short ? `<div class="blk why"><span class="lbl">${u.why}</span>${esc(e.short)}</div>` : ""}
              ${e.rule ? `<div class="blk"><span class="lbl">${u.rule}</span>${esc(e.rule)}</div>` : ""}
              ${e.trap ? `<div class="blk trap"><span class="lbl">${u.trap}</span>${esc(e.trap)}</div>` : ""}
              ${q.keywords && q.keywords.length ? `<div class="blk"><span class="lbl">${u.kw}</span><div class="kw-list">${q.keywords.map(k => `<span class="chip"><span class="it">${esc(k.it)}</span> ${esc(k.en)}</span>`).join("")}</div></div>` : ""}
            </div>
          </details>
          ${q.review ? `<div class="blk review-note" style="margin-top:10px">${u.review}</div>` : ""}
          ${!e.short && !e.rule ? `<div class="blk muted">${u.soon}</div>` : ""}
          <div class="ex-foot"><button class="btn primary" id="got">${u.got}</button></div>
        </div>`;
      const cap = $("#cap", sheet), sayEl = $("#say", sheet), list = $("#steps", sheet);
      g2 = createGiulia($("#g2", sheet)); g2.enter();
      board = createBoard($("#boardSvg", sheet), {
        // Giulia says each step in plain words; the board moves on when she has finished.
        onStep: (st, i, n) => {
          sayEl.textContent = st.text;
          sayEl.classList.remove("pop"); void sayEl.offsetWidth; sayEl.classList.add("pop");
          cap.innerHTML = `<span>${u.stepOf(i + 1, n)}</span>` + (st.it ? `<span class="it">${esc(st.it)}</span>` : "");
          $("#bprog", sheet).style.width = `${Math.round(100 * (i + 1) / n)}%`;
          list.querySelectorAll("li").forEach((li, j) => { li.classList.toggle("active", j === i); li.classList.toggle("done", j < i); });
          const cur = list.children[i]; if (cur) cur.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
          g2.poke();
          if (store.settings.narrate === false) return null;
          both("explain");
          return speak(st.text, {
            lang: lang === "it" ? "it-IT" : "en-GB", rate: lang === "it" ? .92 : 1,
            onstart: () => g2.talkStart(), onboundary: (ci, len, word, rate) => g2.talkWord(word, rate), onend: () => g2.talkStop(),
          }).then(() => new Promise(r => setTimeout(r, 250)));
        },
        onLand: ok => { both(ok ? "happy" : "oh"); setTimeout(() => g2 && g2.state === "oh" && both("explain"), 1400); },
        onEnd: () => { setTimeout(() => both(wasRight ? "happy" : "idle"), 1500); },
      });
      board.load(buildScene(q, lang));
      list.innerHTML = board.steps.map((st, i) => `<li><button data-i="${i}"><span class="n">${i + 1}</span><span>${esc(st.text)}</span></button></li>`).join("");
      list.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { stopSpeech(); both("explain"); board.seekStep(+b.dataset.i); }));
      both("idle");
      // start the board when it scrolls into view (it is below the quick answer and the sentence)
      io && io.disconnect();
      let started = false;
      const start = () => { if (started || !board) return; started = true; both("explain"); reducedMotion() ? board.step() : board.play(); };
      io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { start(); io.disconnect(); } }, { root: sheet, threshold: .45 });
      io.observe($(".board", sheet));
      // tap a chunk: hear it in Italian
      sheet.querySelectorAll(".chunk").forEach(b => b.addEventListener("click", () => {
        sheet.querySelectorAll(".chunk").forEach(x => x.classList.remove("on")); b.classList.add("on");
        speak(q.chunks[+b.dataset.i].it, { lang: "it-IT", rate: .85 });
      }));
      // same-topic drill
      sheet.querySelectorAll(".drill-card").forEach(card => {
        const s = ch.questions.find(x => x.id === card.dataset.id);
        card.querySelectorAll(".d-btns button").forEach(btn => btn.addEventListener("click", () => {
          const ok = (btn.dataset.v === "1") === s.answer;
          card.classList.add(ok ? "ok" : "no");
          card.querySelectorAll(".d-btns button").forEach(x => { x.disabled = true; x.classList.toggle("right", (x.dataset.v === "1") === s.answer); });
          btn.classList.add("picked");
          const r = card.querySelector(".d-res"); r.hidden = false;
          r.innerHTML = `<b>${ok ? (lang === "it" ? "Giusto!" : "Right!") : (lang === "it" ? "No:" : "No:")} ${s.answer ? "VERO" : "FALSO"}</b> · ${esc((lang === "it" ? s.noteIt : s.note) || s.en || "")}`;
          if (ok && store.settings.sound) sound.correct(); else if (!ok && store.settings.sound) sound.wrong();
        }));
      });
      $("#bReplay", sheet).addEventListener("click", () => { stopSpeech(); both("explain"); board.replay(); });
      $("#bSlow", sheet).addEventListener("click", ev => { const slow = board.speed === 1; board.setSpeed(slow ? .45 : 1); ev.currentTarget.setAttribute("aria-pressed", slow); });
      $("#bStep", sheet).addEventListener("click", () => { stopSpeech(); both("explain"); board.step(); });
      $("#bVoice", sheet).addEventListener("click", ev => {
        const on = store.settings.narrate === false;
        store.setSetting("narrate", on);
        ev.currentTarget.textContent = on ? "🔊" : "🔇"; ev.currentTarget.setAttribute("aria-pressed", on);
        if (!on) { stopSpeech(); g2.talkStop(); }
      });
      sheet.querySelectorAll(".seg [data-lang]").forEach(b => b.addEventListener("click", () => {
        if (b.dataset.lang === lang) return;
        lang = b.dataset.lang; store.setSetting("explainLang", lang); render();
      }));
      $("#got", sheet).addEventListener("click", () => { stopSpeech(); io && io.disconnect(); board && board.destroy(); board = null; onDone(); });
    }
    render();
  }

  // ---------- checkpoint quizzes ----------
  function quizSet(n) {
    const seen = store.ck(chId).seen.filter(id => byId.has(id));
    const newest = seen.slice(-10);
    const size = Math.min(seen.length, 30);
    const older = seen.slice(0, -10);
    // favour mistakes, then the ones seen longest ago, then random
    const scored = older.map(id => {
      const r = store.q(id) || {};
      return { id, s: (r.lastOk === false ? 100 : 0) + (r.box ? (6 - r.box) * 5 : 0) + Math.random() * 10 };
    }).sort((a, b) => b.s - a.s).slice(0, size - newest.length).map(x => x.id);
    return shuffle([...newest, ...scored]);
  }

  function offerQuiz(n) {
    stopSpeech(); closeOverlays();
    const ids = quizSet(n);
    view.innerHTML = `<div class="screen learn-wrap"><div class="card done stack">
      <div id="g"></div>
      <span class="qlabel">Checkpoint</span>
      <h2>${n} questions learned! 🎉</h2>
      <p class="muted">Ready for a quick quiz? ${ids.length} questions in random order, like the real exam: no help until the end. Then we look at any mistakes together.</p>
      <button class="btn primary block" id="go" style="min-height:56px">Yes, quiz me! (${ids.length}) →</button>
      <button class="btn ghost block" id="later">Not now, keep learning</button>
    </div></div>`;
    g = createGiulia($("#g")); g.set("celebrate"); g.enter();
    confetti($("#go"), 40);
    $("#go").addEventListener("click", () => runQuiz(ids, n));
    $("#later").addEventListener("click", () => { store.setQuizzed(chId, n); goNext(); });
  }

  function runQuiz(ids, n) {
    const Q = { i: 0, res: [] };
    function show() {
      const q = byId.get(ids[Q.i]);
      view.innerHTML = `<div class="learn-wrap">
        <div class="learn-top quiz">
          <span class="qlabel" style="margin:0">Quiz</span>
          <div class="bar"><i style="width:${Math.round(100 * Q.i / ids.length)}%"></i></div>
          <span class="count">${Q.i + 1}/${ids.length}</span>
        </div>
        <div class="qswipe in-right">
          <div class="stage quiz-stage"><div id="g"></div><div class="stage-side"><div class="gsay" id="gsay"></div>
            <div class="round-btns"><button class="rbtn" id="replay">🔊 Listen</button></div></div></div>
          <div class="qcard"><p class="q-it" lang="it">${esc(q.it)}</p>
            ${q.image ? `<img class="q-img" src="${esc(q.image)}" alt="Figure for this question" width="200" height="200">` : ""}</div>
        </div>
        <div class="answers"><div class="two">
          <button class="ans vero" id="aV"><span class="ic">✓</span><span>VERO<small>true</small></span></button>
          <button class="ans falso" id="aF"><span class="ic">✕</span><span>FALSO<small>false</small></span></button>
        </div></div></div>`;
      g = createGiulia($("#g")); g.set("thinking");
      say(Q.i === 0 ? "Quiz time! Answer them all, then we review 💪" : pick(["Next one!", "Keep going!", "Focus…", "You can do it!"]));
      const read = () => speak(q.it, { lang: "it-IT", rate: store.settings.speed === "slow" ? .72 : .95, onstart: () => g.talkStart(),
        onboundary: (ci, len, word, rate) => g.talkWord(word, rate), onend: () => g.talkStop() });
      $("#replay").addEventListener("click", read);
      if (store.settings.autoRead) setTimeout(read, 350);
      for (const [id, v, dirn] of [["#aV", true, "L"], ["#aF", false, "R"]]) {
        const b = $(id);
        b.addEventListener("pointerdown", () => g.lean(dirn));
        b.addEventListener("click", () => {
          stopSpeech(); g.lean(null);
          const correct = v === q.answer;
          store.record(q.id, correct);
          Q.res.push({ id: q.id, pick: v, correct });
          b.classList.add("picked");
          if (store.settings.sound) sound.tick && sound.tick();
          setTimeout(() => { Q.i++; Q.i < ids.length ? show() : results(); }, 280);
        });
      }
    }
    function results() {
      stopSpeech(); updateStreak();
      const right = Q.res.filter(r => r.correct).length, total = Q.res.length, errors = total - right;
      const allowed = Math.floor(total / 10);   // like the exam: 3 errors out of 30
      const passed = errors <= allowed;
      store.setQuizzed(chId, n); store.addQuiz(chId, total, right);
      view.innerHTML = `<div class="screen learn-wrap"><div class="card done stack">
        <div id="g"></div>
        <div class="score-ring">${ring(0, 140, 12, passed ? "var(--ok)" : "var(--no)")}<span>${right}/${total}</span></div>
        <h2>${passed ? "Quiz passed! 🎉" : errors <= allowed + 2 ? "So close! 💪" : "Let's review these together 📚"}</h2>
        <p class="muted">${errors} mistake${errors === 1 ? "" : "s"} (the exam allows ${allowed} for ${total} questions).${errors ? " Tap a mistake to see Giulia's explanation." : ""}</p>
        <div class="quiz-list">${Q.res.map((r, i) => {
          const q = byId.get(r.id);
          return `<button class="qres ${r.correct ? "ok" : "no"}" data-i="${i}" ${r.correct ? "disabled" : ""}><span class="mark">${r.correct ? "✓" : "✕"}</span>
            <span class="txt">${esc(q.it)}<small>${q.answer ? "VERO" : "FALSO"}${r.correct ? "" : " · you said " + (r.pick ? "VERO" : "FALSO")}</small></span>${r.correct ? "" : `<span class="go">💡</span>`}</button>`;
        }).join("")}</div>
        <button class="btn primary block" id="cont" style="min-height:56px">Continue learning →</button>
      </div></div>`;
      g = createGiulia($("#g")); g.set(passed ? "celebrate" : "sad"); g.enter();
      requestAnimationFrame(() => setTimeout(() => {
        const v = view.querySelector(".score-ring circle.v"); if (!v) return;
        const c = +v.getAttribute("stroke-dasharray"); v.style.strokeDashoffset = (c * (1 - right / total)).toFixed(1);
      }, 150));
      if (passed) { confetti($(".score-ring"), 60); if (store.settings.sound) sound.done(); }
      view.querySelectorAll(".qres.no").forEach(b => b.addEventListener("click", () => {
        const r = Q.res[+b.dataset.i];
        showExplanation(byId.get(r.id), false, false, () => { closeOverlays(); });
      }));
      $("#cont").addEventListener("click", () => goNext());
    }
    show();
  }

  // ---------- end of the round ----------
  function renderDone() {
    stopSpeech();
    const total = S.right + S.wrong;
    const pct = total ? S.right / total : 0;
    const st = store.chapterStats(all.map(q => q.id));
    view.innerHTML = `<div class="screen learn-wrap"><div class="card done stack">
      <div id="g"></div>
      <div class="score-ring">${ring(0, 140, 12, pct >= .7 ? "var(--ok)" : "var(--primary)")}<span>${S.right}/${total}</span></div>
      <h2>${pct >= .9 ? "Bravissimo! 🎉" : pct >= .7 ? "Very good! 💪" : "Good effort! 🌱"}</h2>
      <p class="muted">${pct >= .9 ? "You really know this chapter." : pct >= .7 ? "A few more rounds and you've got it." : "Every mistake you see now is one you won't make in the exam."}</p>
      <p class="small muted">Chapter: you know ${st.known} of ${st.total}${st.mistakes ? ` · ${st.mistakes} to fix` : ""}.</p>
      ${S.wrongIds.size ? `<button class="btn primary block" id="again">Practise my ${S.wrongIds.size} mistake${S.wrongIds.size > 1 ? "s" : ""} again</button>` : ""}
      ${st.known < st.total ? `<button class="btn ${S.wrongIds.size ? "" : "primary"} block" id="more">Continue the chapter</button>` : ""}
      <a class="btn ghost block" href="#/">Back to chapters</a>
    </div></div>`;
    g = createGiulia($("#g")); g.set(pct >= .7 ? "celebrate" : "happy"); g.enter();
    requestAnimationFrame(() => setTimeout(() => {
      const v = view.querySelector(".score-ring circle.v"); if (!v) return;
      const c = +v.getAttribute("stroke-dasharray"); v.style.strokeDashoffset = (c * (1 - pct)).toFixed(1);
    }, 150));
    if (store.settings.sound) sound.done();
    if (pct >= .7) confetti($(".score-ring"), 60);
    const again = $("#again");
    if (again) again.addEventListener("click", () => {
      S.queue = [...S.wrongIds]; S.pos = 0; S.right = 0; S.wrong = 0; S.wrongIds = new Set(); S.requeued = new Set(S.queue); S.results = [];
      renderQuestion(1);
    });
    const more = $("#more");
    if (more) more.addEventListener("click", () => route());
  }
}
