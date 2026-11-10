// Scene registry. buildScene(question) always returns a playable scene:
// unknown/missing scene ids fall back to an animated rule card.
import { lib, W, T, setLang } from "./engine.js";
import * as ov from "./overtake.js";
import * as sg from "./signs.js";

const ICONS = {
  car: "🚗", truck: "🚚", bus: "🚌", tram: "🚋", moto: "🏍️", bike: "🚲", pedestrian: "🚶", police: "🚓", ambulance: "🚑",
  eye: "👁️", mirror: "🪞", indicator: "↔️", horn: "📯", highbeam: "🔦", speed: "⏱️", distance: "↕️", warning: "⚠️",
  check: "✅", cross: "❌", road: "🛣️", curve: "↪️", hill: "⛰️", fog: "🌫️", rain: "🌧️", snow: "❄️", night: "🌙", wind: "💨",
  train: "🚆", light: "🚦", sign: "🪧", book: "📘", money: "💶", points: "🔢", alcohol: "🍷", seatbelt: "🔒", child: "👶",
  firstaid: "⛑️", fuel: "⛽", leaf: "🍃", tyre: "🛞", brake: "🛑", engine: "⚙️",
};

const TEMPLATES = {
  "overtake.basic": ov.basic,
  "overtake.blocked": ov.blocked,
  "overtake.allowed": ov.allowed,
  "overtake.right": ov.right,
  "overtake.space": ov.space,
  "overtake.beingOvertaken": ov.beingOvertaken,
  "overtake.motorway": ov.motorway,
  sign: sg.sign,
  figure: sg.figure,
  roadparts: sg.roadparts,
  rulecard,
};

function wrap(text, max) {
  const words = String(text).split(/\s+/), lines = [];
  let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/** Animated rule card: lines appear one by one, with icons, like chalk on a board. */
export function rulecard(P, q) {
  let lines = P.lines && P.lines.length ? P.lines : null;
  if (!lines) {
    const ex = (q && (T("en", "it") === "it" ? q.explainIt || q.explain : q.explain)) || {};
    const rule = ex.rule || ex.short || T("Read the rule carefully.", "Leggi bene la regola.");
    lines = rule.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4);
  }
  const icons = P.icons || [];
  const per = 1500;
  let y = 92;
  const shows = [];
  const font = `font-family="system-ui, -apple-system, Segoe UI, sans-serif"`;
  lines.forEach((ln, i) => {
    const parts = wrap(ln, 22);
    const icon = ICONS[icons[i]] || "💡";
    const h = Math.max(1, parts.length) * 23 + 26;
    let svg = `<g class="rc-line"><rect x="18" y="${y - 22}" width="${W - 36}" height="${h}" rx="18" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.12)"/></g>`;
    svg += `<g class="rc-icon"><circle cx="50" cy="${y - 22 + h / 2}" r="21" fill="#ffffff"/><text x="50" y="${y - 22 + h / 2 + 8}" font-size="22" text-anchor="middle">${icon}</text></g>`;
    svg += `<g class="rc-line">` + parts.map((p, j) => `<text x="84" y="${y - 22 + h / 2 - (parts.length - 1) * 11.5 + 6 + j * 23}" font-size="17.5" font-weight="700" fill="#fff" ${font}>${esc(p)}</text>`).join("") + `</g>`;
    shows.push({ t: 400 + i * per, svg });
    y += h + 12;
  });
  const dur = 400 + lines.length * per + 1800;
  const bg = `<defs><linearGradient id="rcBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#312e81"/></linearGradient></defs>
    <rect x="-200" y="-200" width="${W + 400}" height="820" fill="url(#rcBg)"/>
    <circle cx="${W - 30}" cy="40" r="90" fill="#6366f1" opacity=".25"/><circle cx="20" cy="400" r="120" fill="#a855f7" opacity=".15"/>
    <rect x="18" y="22" width="${T("THE RULE", "LA REGOLA").length * 10 + 28}" height="30" rx="15" fill="#facc15"/>
    <text x="32" y="42" font-size="14" font-weight="900" fill="#1e1b4b" letter-spacing="1.5" ${font}>${T("THE RULE", "LA REGOLA")}</text>`;
  const steps = lines.map((ln, i) => ({ t: 400 + i * per, text: ln }));
  steps.push({ t: dur - 1400, text: P.caption || lines[lines.length - 1], it: P.it });
  return { duration: dur, bg, actors: [], shows, steps, verdict: P.verdict ? { ok: P.verdict !== "no" } : null };
}

/** Build the scene for a question in "en" or "it". */
export function buildScene(q, lang = "en") {
  setLang(lang);
  const e = q.explain || {};
  let P = e.sceneParams || {};
  if (lang === "it" && q.explainIt) {
    P = { ...P, caption: q.explainIt.caption || P.caption, lines: q.explainIt.lines || P.lines };
  }
  const fn = TEMPLATES[e.scene] || rulecard;
  try { return fn(P, q); }
  catch (err) { console.warn("scene failed, using rule card", e.scene, err); return rulecard(P, q); }
}
