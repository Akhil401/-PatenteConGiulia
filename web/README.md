# Patente con Giulia: React version

React 19 + TypeScript + Vite, with Framer Motion for UI animation and three.js (via @react-three/fiber) for 3D scenes.
Installable and offline (PWA). All content (questions, explanations, images) comes from `../app` and is copied in
by `npm run sync` before every dev start and build, so `../app` stays the single source of truth.

## Run on your computer

```bash
npm install
```
```bash
npm run dev
```

Open http://localhost:5173.

## Build

```bash
npm run build
```

The finished site is in `dist/`, a plain static folder.

## Put it on Cloudflare Pages

**Option A: upload from this PC (quickest)**
1. Build: `npm run build`.
2. Deploy (the first time it asks you to log in to Cloudflare in the browser):
```bash
npx wrangler pages deploy dist --project-name patente-con-giulia
```
3. Cloudflare gives you a link like `https://patente-con-giulia.pages.dev`.

**Option B: automatic builds from GitHub**
1. Push the whole `D:\Patente` folder (it must include `app/` and `web/`) to a GitHub repository.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repository.
3. Build settings: root directory `web`, build command `npm run build`, output directory `dist`.
4. Every push builds and publishes a new version.

Then open the link on your phone and choose **Add to Home screen**: the app works offline after the first visit.

## Where things are
| Path | What |
|---|---|
| `src/screens/` | Home, Learn (questions, quizzes), Explanation, Settings |
| `src/components/` | Giulia, Board (animated scenes), Ring |
| `src/lib/` | Shared engine: Giulia's drawing, scene engine and templates, progress storage, voice, data loading |
| `scripts/sync-data.mjs` | Copies data, images and icons from `../app` into `public/` |
