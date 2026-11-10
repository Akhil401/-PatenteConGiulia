// Copies the shared content (questions, explanations, images, icons) from ../app into public/.
// The ../app folder stays the single source of truth for all data.
import { cpSync, rmSync, existsSync } from "node:fs";
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
console.log("synced data, images and icons from", app);
