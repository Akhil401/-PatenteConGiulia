# Patente con Giulia

Study the Italian **Patente B** theory exam with Giulia, an animated teacher. She reads the official
Ministry questions in Italian, you answer **VERO / FALSO**, and every question has a simple English (or
simple Italian) explanation with an animated 3D scene.

The Italian question text and the answers come **only** from the official Ministry list
(`source/DomandeB.pdf`) and are never changed. `tools/verify.py` checks every question against the PDF.

## Status

| Chapter | Questions | Status |
|---|---|---|
| 1. Definizioni stradali e di traffico… | 531 | ready |
| 2. Segnali di pericolo | 662 | ready |
| 3. Segnali di divieto | 519 | ready |
| 15. Norme sul sorpasso | 156 | ready |
| other 21 chapters | 5,279 | Italian data ready, English not written yet |

Features: lessons with swipe, tap-a-word translations, Italian voice (the phone's text-to-speech),
explanations in English or simple Italian, 3D explanation scenes (three.js), checkpoint quizzes every
10 questions, **Quiz 30** per chapter and a **mock exam** (30 questions, 20 minutes, max 3 mistakes),
progress with spaced repetition, light/dark theme, installable and offline (PWA).

## What's in this repository

| Path | What it is |
|---|---|
| `web/` | **The app** (React 19 + Vite + TypeScript, three.js via react-three-fiber). This is what you build and publish. |
| `app/` | The **data** (source of truth): `app/data/chapters/` (official Italian + answer + English), `app/images/` (the 410 official figures), icons. Also the older plain-JavaScript version of the app. |
| `source/DomandeB.pdf` | The official Ministry question list |
| `tools/` | Python scripts: extract the PDF, verify the data, merge the English, make icons |
| `docs/` | Content brief and the catalogue of explanation scenes |

`web/scripts/sync-data.mjs` copies `app/data`, `app/images` and `app/icons` into `web/public/` before
every `npm run dev` / `npm run build`, so the data lives in one place.

## Run it on your computer

You need Node.js 20 or newer.

```bash
cd web
```
```bash
npm install
```
```bash
npm run dev
```

Then open <http://localhost:5173>. Developer page for one scene: `http://localhost:5173/#/dev3d/q18315`
(add `/it` for Italian).

## Build

```bash
cd web
```
```bash
npm run build
```

The finished site is in `web/dist/`.

## Put it online with Cloudflare Pages

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, pick this repository.
2. Build settings:
   - **Root directory:** `web`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Environment variable `NODE_VERSION` = `22`
3. **Save and Deploy.** Every push to `main` deploys again.

The build reads `../app` (outside `web/`), which works because Cloudflare clones the whole repository.

## Install it on your phone (works offline)

Open the link on the phone, then:
- **Android (Chrome):** menu ⋮ → **Add to Home screen / Install app**.
- **iPhone (Safari):** Share → **Add to Home Screen**.

**Italian voice:** Giulia uses the phone's own text-to-speech. If you hear nothing, add an Italian voice:
Android: Settings → Accessibility → Text-to-speech; iPhone: Settings → Accessibility → Spoken Content → Voices → Italian.

**Your progress** is stored on the device. Use **Settings → Export progress** to save a copy and
**Import progress** to restore it on another phone.

## Data tools (maintainers)

All commands run from the repository root with Python 3 + PyMuPDF (`py -m pip install --user pymupdf`).
Use `py -P -E` (not `-I`, which hides user-installed packages).

```bash
py -P -E tools/extract.py source/DomandeB.pdf app
```
```bash
py -P -E tools/verify.py source/DomandeB.pdf app 30
```
```bash
py -P -E tools/merge_en.py app
```

- `extract.py` rebuilds the chapter files from the PDF (keeps any English already written).
- `verify.py` re-reads the PDF a second way and checks every question's text and answer.
- `merge_en.py` merges `app/data/{en,it,chunks,groups}/chNN*.json` into the chapters and updates `app/data/ready.json`.

To hide withdrawn ("oscurati") questions, set `"hidden": true` on them in the chapter file.
