// Copies the shared content (questions, explanations, images, icons) from ../app into public/.
// The ../app folder stays the single source of truth for all data.
import { cpSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..", "..", "app");
const pub = resolve(here, "..", "public");
for (const dir of ["data", "images", "icons"]) {
  const from = resolve(app, dir), to = resolve(pub, dir);
  if (!existsSync(from)) { console.error("missing", from); process.exit(1); }
  rmSync(to, { recursive: true, force: true });
  // skip the helper files used only to build the content
  cpSync(from, to, { recursive: true, filter: src => !/[\\/]data[\\/](en|it|chunks|groups)([\\/]|$)|_ch\d\d_words\.json$/.test(src) });
}
// A small question index (id, chapter, Italian text, answer, picture) so the home screen and the mock exam
// do not need to download every chapter file (all chapters together are many MB).
{
  const dir = resolve(pub, "data", "chapters"), bank = { ch: {}, q: [] };
  for (const f of readdirSync(dir).filter(f => /^ch[0-9][0-9][.]json$/.test(f)).sort()) {
    const c = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
    bank.ch[c.id] = { n: c.n, titleIt: c.titleIt, titleEn: c.titleEn };
    for (const q of c.questions) if (!q.hidden) bank.q.push([q.id, c.id, q.it, q.answer ? 1 : 0, q.image || ""]);
  }
  writeFileSync(resolve(pub, "data", "qbank.json"), JSON.stringify(bank));
  console.log("question index:", bank.q.length, "questions");
}
console.log("synced data, images and icons from", app);
