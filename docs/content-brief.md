# Content brief: writing Giulia's teaching layer for one batch of questions

The app: "Patente con Giulia", a study app for the Italian Patente B theory exam, for an English speaker who barely reads Italian
and is nervous about the exam. Each question is an OFFICIAL Ministry true/false statement. You write everything the learner sees
around it: translation, explanation (English + simple Italian), a sentence breakdown, and a rule of thumb per topic group.

## Inputs
- `D:\Patente\app\data\chapters\chNN.json` - questions: `id`, `group`, `it` (official Italian, exact), `answer` (official true/false), `image` (path under `D:\Patente\app\`, or null).
- `D:\Patente\docs\scene-catalog.md` - animated scene templates and their params (read it fully).
- `D:\Patente\app\data\glossary.json` - shared glossary of Italian driving words.
- `D:\Patente\app\data\chapters\ch15.json` - a finished chapter: look at a few questions (fields en, explain, explainIt, chunks, note, noteIt, keywords) and `groups` to match the style and quality.

**Look at the pictures.** Statements in a group share one picture. For each group with an image, open the image file (Read tool on
`D:\Patente\app\<image path>`) before writing, so you know exactly which sign or road layout it shows. Never guess a sign.

## Hard rules
1. NEVER change, argue with or "fix" the official answer or the official Italian text. Your explanation supports the official answer.
   If you think the official answer conflicts with the current Codice della Strada (including the reform of December 2024, Legge 177/2024)
   or you are not sure, still explain the official answer and set `"review": true` with a one-line `reviewNote`.
2. Correct Italian traffic law only. Do not invent numbers. Your own words; no web browsing; do not copy quiz sites.
3. Beginner level: short sentences, everyday words. Explain an Italian traffic term in brackets the first time.
4. Statements in the same group are variations of one topic: keep them consistent; the group rule of thumb must cover them all.

## Output: exactly four files for your batch (UTF-8 JSON), with the batch name given in your task (e.g. `ch02.c`)
### 1. `D:\Patente\app\data\en\<batch>.json` - keyed by question id
```
"q19001": {
  "en": "natural English translation, faithful (keep trap words: always/only/never/even if/as a rule)",
  "explain": {
    "short": "1-2 simple sentences: WHY the official answer is right (do not start with True/False)",
    "rule": "the rule in plain English, 1-2 sentences",
    "trap": "the trick in the Italian wording (quote the Italian word), 1 sentence",
    "scene": "sign | figure | roadparts | rulecard | any overtake.* scene from the catalog",
    "sceneParams": { "verdict": "ok|no", "caption": "max ~60 chars", "it": "1-3 Italian key words", ...scene params }
  },
  "keywords": [ {"it": "word or phrase exactly as in the statement", "en": "meaning"} ],   // 2-5
  "review": false, "reviewNote": ""
}
```
Scene choice: a SIGN picture -> `sign` with the right `action` (and `hazard`/`distance`/`value` when useful); a road DIAGRAM picture -> `figure`
with 1-3 `lines`; a definition without picture -> `roadparts` if a part fits, else `rulecard` with `lines` + `icons` (same count, icon ids from the catalog).
For a FALSE statement about a sign, the scene shows what the sign REALLY means (verdict "ok"); the caption says what the statement got wrong.

### 2. `D:\Patente\app\data\it\<batch>.json` - same ids, simple Italian (A2-B1, sentences of max ~15 words), SAME content as the English
```
"q19001": { "short": "...", "rule": "...", "trap": "... quote the Italian word in «»", "caption": "max ~60 chars", "lines": ["..."] }
```
`lines` only when the scene has `lines` (rulecard / figure): same count as the English lines.

### 3. `D:\Patente\app\data\chunks\<batch>.json` - the sentence broken into pieces
```
"q19001": { "chunks": [ {"it": "Il segnale raffigurato", "en": "the sign shown"}, {"it": "preannuncia un dosso", "en": "warns of a hump", "key": true} ],
            "note": "One short sentence why the key piece makes it TRUE/FALSE. So it is TRUE.",
            "noteIt": "La stessa cosa in italiano semplice. Quindi è VERO." }
```
- 2-6 chunks; the chunk `it` values joined with single spaces must be EXACTLY the official `it` text (same characters, accents, apostrophes, punctuation).
- `key: true` on the 1 (max 2) chunk(s) that decide the answer. `note` ends with "So it is TRUE." / "So it is FALSE."; `noteIt` ends with "Quindi è VERO." / "Quindi è FALSO.", matching the official answer.

### 4. `D:\Patente\app\data\groups\<batch>.json` - one rule of thumb per GROUP in your batch
```
"4051": { "title": "short topic title", "titleIt": "titolo breve", "en": "2-3 sentences that let the learner answer EVERY statement of this group", "it": "the same in simple Italian" }
```
For a sign group: name the sign, what it means, where it is placed, and the typical false claims the quiz makes about it.

## Check before you finish
Run: `py -P -E D:\Patente\tools\check_batch.py <batch>` (for example `ch02.c`). Fix everything it reports until it says `OK`.
Write any helper scripts in your own scratch folder, never in `D:\Patente`. Do not edit any other file.
Final reply (max 8 lines): counts, ids with review:true and why, anything you were unsure about.
