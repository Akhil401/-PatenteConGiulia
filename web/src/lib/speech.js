// Web Speech API wrapper: picks the best Italian / English voice and reports
// start / boundary / end so Giulia's mouth can follow the real speech.

const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
let voices = [];
let ready = null;

function load() {
  if (!synth) return Promise.resolve([]);
  if (ready) return ready;
  ready = new Promise(resolve => {
    const done = () => { voices = synth.getVoices(); if (voices.length) resolve(voices); };
    done();
    if (!voices.length) {
      synth.addEventListener("voiceschanged", done);
      setTimeout(() => { voices = synth.getVoices(); resolve(voices); }, 2500);
    }
  });
  return ready;
}

// Higher score = more natural voice.
function score(v, lang) {
  let s = 0;
  const n = v.name.toLowerCase();
  if (v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) s += 50;
  else if (v.lang.toLowerCase().startsWith(lang.slice(0, 2))) s += 30;
  else return -1;
  if (/natural|neural|online|premium|enhanced/.test(n)) s += 25;
  if (/google/.test(n)) s += 18;
  // Giulia is a woman: prefer female voices, avoid known male ones.
  if (/elsa|isabella|alice|federica|paola|giorgia|carla|bianca|elena|female|donna|samantha|aria|jenny|libby|sonia|hazel|zira|susan|emma|natasha|clara/.test(n)) s += 12;
  if (/cosimo|diego|luca|calogero|giuseppe|benigno|rinaldo|male|uomo|david|mark|george|ravi|guy|ryan|thomas|daniel|james/.test(n)) s -= 8;
  if (v.localService) s += 3;          // local voices send word-boundary events
  if (/compact|espeak/.test(n)) s -= 20;
  return s;
}

export async function bestVoice(lang) {
  await load();
  let best = null, bs = -1;
  for (const v of voices) { const s = score(v, lang); if (s > bs) { bs = s; best = v; } }
  return best;
}

export async function voiceInfo() {
  const it = await bestVoice("it-IT");
  const en = await bestVoice("en-GB") || await bestVoice("en-US");
  return { supported: !!synth, it: it ? it.name : null, en: en ? en.name : null };
}

export function stop() { if (synth) synth.cancel(); }

/**
 * Speak text. Resolves when finished (or cancelled).
 * opts: { lang: "it-IT" | "en-GB", rate, onstart, onboundary(charIndex, charLength), onend }
 */
export async function speak(text, opts = {}) {
  if (!synth || !text) { opts.onend && opts.onend(); return false; }
  const lang = opts.lang || "it-IT";
  const voice = (await bestVoice(lang)) || (lang.startsWith("en") ? await bestVoice("en-US") : null);
  if (!voice) { opts.onend && opts.onend(); return false; }
  synth.cancel();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = opts.rate || 1; u.pitch = 1.05;
    let finished = false;
    const finish = () => { if (finished) return; finished = true; opts.onend && opts.onend(); resolve(true); };
    u.onstart = () => opts.onstart && opts.onstart();
    u.onboundary = e => {
      if (e.name !== "word" && e.name !== undefined) return;
      const m = text.slice(e.charIndex).match(/^[\p{L}']+/u);
      opts.onboundary && opts.onboundary(e.charIndex, e.charLength, m ? m[0] : "", u.rate);
    };
    u.onend = finish;
    u.onerror = finish;
    // Chrome sometimes drops the queue after cancel(); a tiny delay avoids that.
    setTimeout(() => synth.speak(u), 60);
    // Safety net: some browsers never fire 'end'.
    setTimeout(finish, 1500 + text.length * 140 / (opts.rate || 1));
  });
}
