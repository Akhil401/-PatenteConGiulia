// Loads data files on demand (chapters are only fetched when opened).

const cache = new Map();

async function json(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then(r => {
      if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
      return r.json();
    }).catch(e => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}

export const data = {
  index: () => json("data/index.json"),
  chapter: id => json(`data/chapters/${id}.json`),
  /** Small index of every question: { ch: {chNN: {n, titleIt, titleEn}}, q: [[id, chNN, it, answer 1/0, image]] } */
  qbank: () => json("data/qbank.json"),
  glossary: () => json("data/glossary.json"),
  intros: () => json("data/intros.json"),
  dict: id => json(`data/dict/${id}.json`).catch(() => ({ words: {} })),
  /** Chapters that already have the English layer and are playable. */
  ready: () => json("data/ready.json").catch(() => ({ chapters: [] })),
};

/** Split Italian text into words and the gaps between them (keeps punctuation as-is). */
export function tokenize(text) {
  const out = [];
  const re = /[A-Za-zÀ-ÿ]+/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ gap: text.slice(last, m.index) });
    out.push({ word: m[0], start: m.index });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ gap: text.slice(last) });
  return out;
}

/** Find the glossary term that contains this word in the question, if any. */
export function glossaryFor(word, sentence, glossary) {
  const s = sentence.toLowerCase(), w = word.toLowerCase();
  let best = null;
  for (const t of glossary.terms) {
    const parts = t.it.toLowerCase().split(/\s*\/\s*/);
    for (const p of parts) {
      const stem = p.length > 5 ? p.slice(0, -1) : p;   // sorpasso / sorpassare
      if (p.split(" ").some(x => x.startsWith(w.slice(0, Math.max(4, w.length - 1))) || w.startsWith(stem)) && s.includes(stem.split(" ")[0])) {
        if (!best || p.length > best.it.length) best = t;
      }
    }
  }
  return best;
}
