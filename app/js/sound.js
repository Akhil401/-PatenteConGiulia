// Tiny generated sounds (no audio files): a cheerful chime and a soft "hmm".
let ctx = null;
function ac() { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); } return ctx; }

function tone(freq, start, dur, type = "sine", gain = .16) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + .02);
  g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + .05);
}

export const sound = {
  correct() { tone(659, 0, .18); tone(880, .1, .28); },
  wrong() { tone(330, 0, .22, "triangle", .12); tone(262, .14, .3, "triangle", .1); },
  tick() { tone(520, 0, .08, "sine", .08); },
  done() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .11, .3)); },
};
