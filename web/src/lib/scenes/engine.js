// Scene engine v2 for Giulia's board: top-down road scenes with a moving camera.
// A scene = { duration, bg: svgString, actors: [...], shows: [...], steps: [...], verdict }.
//   actor  : { id, kind, color, label, keys: [{ t, x, y, r, blink: "L"|"R"|"H"|null, brake, flash, hide }] }
//   show   : { t0 | t, t1, svg }   overlay visible between t0 and t1 (ms)
//   step   : { t, text, it }       caption from time t
//   verdict: { ok }                stamp at the end
// World coordinates: 0..360 x 0..420, vehicles point up (driving up the road).
//
// Motion design:
//  - positions follow smooth Hermite curves through the keyframes (no stop-start at each key)
//  - cars turn into lane changes (heading from velocity) and leave speed streaks
//  - a camera eases between a wide shot, following YOUR car and zooming on the danger
//  - danger moments play in slow motion; the end lands with a stamp, flash and shake

export const W = 360, H = 420;

// Scene language: "en" or "it". T(english, italian) picks the text.
let LANG = "en";
export function setLang(l) { LANG = l === "it" ? "it" : "en"; }
export function getLang() { return LANG; }
export const T = (en, it) => (LANG === "it" && it ? it : en);

const NS = "http://www.w3.org/2000/svg";
const CHALK = "#ffffff";
let uid = 0;

// ---------- palette ----------
const C = {
  grass: "#8cc084", grass2: "#82b77a", tree: "#4f9a5c", treeHi: "#6fb978", treeSh: "rgba(20,50,30,.25)",
  road: "#3d4350", roadEdge: "#e9ecf2", mark: "#ffffff",
};

// ---------- vehicles (drawn pointing up, centred on 0,0) ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}
function lamps(w, h) {
  // headlights, tail lights, brake glow and indicators
  return `<rect x="${-w / 2 + 3}" y="${-h / 2 + 1}" width="6" height="2.6" rx="1.3" fill="#fff6c8"/>
    <rect x="${w / 2 - 9}" y="${-h / 2 + 1}" width="6" height="2.6" rx="1.3" fill="#fff6c8"/>
    <rect x="${-w / 2 + 3}" y="${h / 2 - 3.2}" width="6" height="2.4" rx="1.2" fill="#b3261e"/>
    <rect x="${w / 2 - 9}" y="${h / 2 - 3.2}" width="6" height="2.4" rx="1.2" fill="#b3261e"/>
    <g class="brake" opacity="0"><ellipse cx="0" cy="${h / 2 + 5}" rx="${w * .7}" ry="9" fill="url(#brakeGlow)"/>
      <rect x="${-w / 2 + 2}" y="${h / 2 - 3.6}" width="8" height="3.2" rx="1.5" fill="#ff3b30"/><rect x="${w / 2 - 10}" y="${h / 2 - 3.6}" width="8" height="3.2" rx="1.5" fill="#ff3b30"/></g>
    <g class="ind-L" opacity="0"><circle cx="${-w / 2 + 1}" cy="${-h / 2 + 4}" r="5" fill="url(#indGlow)"/><circle cx="${-w / 2 + 1}" cy="${h / 2 - 4}" r="5" fill="url(#indGlow)"/></g>
    <g class="ind-R" opacity="0"><circle cx="${w / 2 - 1}" cy="${-h / 2 + 4}" r="5" fill="url(#indGlow)"/><circle cx="${w / 2 - 1}" cy="${h / 2 - 4}" r="5" fill="url(#indGlow)"/></g>`;
}
function car(color, extra = "", w = 26, h = 46) {
  const c = color || "#3b82f6";
  return `<rect x="${-w / 2 - 1.5}" y="${-h / 2 + 7}" width="3" height="8" rx="1.2" fill="#1b1d22"/><rect x="${w / 2 - 1.5}" y="${-h / 2 + 7}" width="3" height="8" rx="1.2" fill="#1b1d22"/>
    <rect x="${-w / 2 - 1.5}" y="${h / 2 - 15}" width="3" height="8" rx="1.2" fill="#1b1d22"/><rect x="${w / 2 - 1.5}" y="${h / 2 - 15}" width="3" height="8" rx="1.2" fill="#1b1d22"/>
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="9" fill="${c}"/>
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="9" fill="url(#bodyShine)"/>
    <path d="M${-w / 2 + 3} ${-h / 2 + 12} Q0 ${-h / 2 + 7} ${w / 2 - 3} ${-h / 2 + 12} L${w / 2 - 4} ${-h / 2 + 19} L${-w / 2 + 4} ${-h / 2 + 19} Z" fill="#1d2633"/>
    <path d="M${-w / 2 + 6} ${-h / 2 + 12} L${-w / 2 + 10} ${-h / 2 + 10} L${-w / 2 + 8} ${-h / 2 + 17} Z" fill="#fff" opacity=".35"/>
    <rect x="${-w / 2 + 4}" y="${-h / 2 + 20}" width="${w - 8}" height="${h - 33}" rx="4" fill="${shade(c.startsWith("#") ? c : "#3b82f6", .82)}"/>
    <path d="M${-w / 2 + 4} ${h / 2 - 12} L${w / 2 - 4} ${h / 2 - 12} L${w / 2 - 5} ${h / 2 - 7} Q0 ${h / 2 - 5} ${-w / 2 + 5} ${h / 2 - 7} Z" fill="#1d2633"/>
    <rect x="${-w / 2 - 3}" y="${-h / 2 + 15}" width="4" height="2.6" rx="1" fill="${c}"/><rect x="${w / 2 - 1}" y="${-h / 2 + 15}" width="4" height="2.6" rx="1" fill="${c}"/>
    ${lamps(w, h)}${extra}`;
}

const KINDS = {
  car: (c) => ({ w: 26, h: 46, svg: car(c || "#94a3b8") }),
  you: (c) => ({ w: 26, h: 46, you: true, svg: car(c || "#2563eb") }),
  truck: (c) => ({ w: 34, h: 96, svg: `<rect x="-17" y="-48" width="34" height="24" rx="6" fill="${c || "#f59e0b"}"/><rect x="-17" y="-48" width="34" height="24" rx="6" fill="url(#bodyShine)"/>
      <path d="M-13 -40 Q0 -44 13 -40 L12 -33 L-12 -33 Z" fill="#1d2633"/>
      <rect x="-18" y="-21" width="36" height="69" rx="3" fill="#eef1f5"/><rect x="-18" y="-21" width="36" height="69" rx="3" fill="url(#bodyShine)"/>
      <line x1="-12" y1="-14" x2="-12" y2="42" stroke="#d5dae2" stroke-width="2"/><line x1="12" y1="-14" x2="12" y2="42" stroke="#d5dae2" stroke-width="2"/>
      ${lamps(34, 96)}` }),
  caravan: (c) => ({ w: 30, h: 104, svg: `<g transform="translate(0 -26)">${car(c || "#64748b")}</g><rect x="-1.5" y="-4" width="3" height="10" fill="#475569"/>
      <rect x="-15" y="4" width="30" height="50" rx="9" fill="#f8fafc"/><rect x="-15" y="4" width="30" height="50" rx="9" fill="url(#bodyShine)"/><rect x="-10" y="14" width="20" height="9" rx="3" fill="#cbd5e1"/>` }),
  bus: (c) => ({ w: 34, h: 100, svg: `<rect x="-17" y="-50" width="34" height="100" rx="8" fill="${c || "#14b8a6"}"/><rect x="-17" y="-50" width="34" height="100" rx="8" fill="url(#bodyShine)"/>
      <path d="M-13 -44 Q0 -48 13 -44 L13 -36 L-13 -36 Z" fill="#1d2633"/><rect x="-11" y="-26" width="22" height="60" rx="4" fill="rgba(255,255,255,.25)"/>
      <text y="4" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" transform="rotate(-90)" font-family="system-ui,sans-serif">BUS</text>${lamps(34, 100)}` }),
  tram: (c) => ({ w: 36, h: 136, svg: `<rect x="-18" y="-68" width="36" height="136" rx="14" fill="${c || "#ef4444"}"/><rect x="-18" y="-68" width="36" height="136" rx="14" fill="url(#bodyShine)"/>
      <path d="M-14 -60 Q0 -66 14 -60 L14 -50 L-14 -50 Z" fill="#1d2633"/>
      <line x1="-10" y1="-18" x2="10" y2="-30" stroke="#1d2633" stroke-width="2.5"/><line x1="-18" y1="0" x2="18" y2="0" stroke="rgba(0,0,0,.25)" stroke-width="2"/>
      <text y="4" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" transform="rotate(-90) translate(30 0)" font-family="system-ui,sans-serif">TRAM</text>` }),
  moto: (c) => ({ w: 12, h: 34, svg: `<rect x="-3.5" y="-17" width="7" height="34" rx="3.5" fill="#1f2937"/><rect x="-9" y="-11" width="18" height="3" rx="1.5" fill="#374151"/><circle cy="0" r="6.5" fill="${c || "#f97316"}"/><circle cy="-1.5" r="3" fill="rgba(255,255,255,.4)"/>${lamps(12, 34)}` }),
  bike: (c) => ({ w: 10, h: 30, svg: `<rect x="-1.8" y="-15" width="3.6" height="30" rx="1.8" fill="#334155"/><rect x="-7" y="-9" width="14" height="2.4" rx="1.2" fill="#475569"/><circle cy="0" r="5.5" fill="${c || "#84cc16"}"/>` }),
  police: () => ({ w: 26, h: 46, svg: car("#f8fafc", `<rect x="-13" y="-1" width="26" height="7" fill="#1d4ed8"/><text y="4.6" text-anchor="middle" font-size="5" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">POLIZIA</text>
      <g class="siren" opacity="0"><circle cx="-5" cy="-3" r="10" fill="url(#blueGlow)"/><circle cx="5" cy="-3" r="10" fill="url(#blueGlow)"/></g><rect x="-7" y="-5" width="14" height="4" rx="2" fill="#60a5fa"/>`) }),
  ambulance: () => ({ w: 30, h: 58, svg: `<rect x="-15" y="-29" width="30" height="58" rx="7" fill="#fafafa"/><rect x="-15" y="-29" width="30" height="58" rx="7" fill="url(#bodyShine)"/>
      <path d="M-11 -23 Q0 -27 11 -23 L11 -16 L-11 -16 Z" fill="#1d2633"/>
      <rect x="-3" y="-4" width="6" height="18" fill="#ef4444"/><rect x="-9" y="2" width="18" height="6" fill="#ef4444"/>
      <rect x="-15" y="18" width="30" height="3" fill="#f97316"/>
      <g class="siren" opacity="0"><circle cx="-6" cy="-13" r="12" fill="url(#blueGlow)"/><circle cx="6" cy="-13" r="12" fill="url(#blueGlow)"/></g><rect x="-8" y="-15" width="16" height="4" rx="2" fill="#3b82f6"/>${lamps(30, 58)}` }),
  ped: (c) => ({ w: 14, h: 14, ped: true, svg: `<ellipse cx="0" cy="0" rx="9" ry="6" fill="${c || "#fbbf24"}"/><circle r="4.6" fill="#7c4a2d"/><circle r="4.6" cx="-.8" cy="-.8" fill="#9a6340"/>` }),
  officer: () => ({ w: 18, h: 18, ped: true, svg: `<ellipse rx="12" ry="7" fill="#1e3a8a"/><circle r="6" fill="#f8fafc"/><circle r="6" fill="none" stroke="#1d4ed8" stroke-width="2"/><rect x="-16" y="-1.5" width="32" height="3" rx="1.5" fill="#f8fafc"/>` }),
};

// ---------- scene helpers (backgrounds and overlays) ----------
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const isRed = c => /ff6b5e|ff9f6b|b93a2e|d9443a|ef4444/i.test(c || "");
const isGreen = c => /7be0a0|2e7d4f|22c55e/i.test(c || "");

export const lib = {
  CHALK,
  grass() {
    const trees = [[26, 66, 15], [72, 150, 11], [32, 250, 17], [78, 330, 10], [38, 398, 13], [294, 38, 12], [332, 120, 16], [300, 252, 10], [336, 330, 14], [290, 402, 11], [64, 24, 9], [324, 192, 8]];
    let s = `<rect x="-200" y="-200" width="${W + 400}" height="${H + 400}" fill="${C.grass}"/>`;
    for (let i = -6; i < 16; i++) s += `<rect x="-200" y="${i * 40}" width="${W + 400}" height="20" fill="${C.grass2}"/>`;
    s += trees.map(([x, y, r]) => `<ellipse cx="${x + 4}" cy="${y + 6}" rx="${r}" ry="${r * .9}" fill="${C.treeSh}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${C.tree}"/><circle cx="${x - r * .28}" cy="${y - r * .3}" r="${r * .55}" fill="${C.treeHi}"/>`).join("");
    return s;
  },
  road(x, w) {
    return `<rect x="${x - 6}" y="-200" width="${w + 12}" height="${H + 400}" fill="#c9ced8"/>
      <rect x="${x}" y="-200" width="${w}" height="${H + 400}" fill="${C.road}"/>
      <rect x="${x}" y="-200" width="${w}" height="${H + 400}" fill="url(#asphalt)"/>
      <line x1="${x + 3}" y1="-200" x2="${x + 3}" y2="${H + 200}" stroke="${C.roadEdge}" stroke-width="2.5"/>
      <line x1="${x + w - 3}" y1="-200" x2="${x + w - 3}" y2="${H + 200}" stroke="${C.roadEdge}" stroke-width="2.5"/>`;
  },
  line(x, kind = "dashed", y0 = -200, y1 = H + 200) {
    const dash = (dx = 0) => `<line x1="${x + dx}" y1="${y0}" x2="${x + dx}" y2="${y1}" stroke="${C.mark}" stroke-width="3" stroke-dasharray="20 16"/>`;
    const solid = (dx = 0) => `<line x1="${x + dx}" y1="${y0}" x2="${x + dx}" y2="${y1}" stroke="${C.mark}" stroke-width="3"/>`;
    if (kind === "solid") return solid();
    if (kind === "double") return solid(-3.5) + solid(3.5);
    if (kind === "mixed") return dash(3.5) + solid(-3.5);   // dashed on OUR side (right)
    return dash();
  },
  arrow(x, y, dir = "up", color = "rgba(255,255,255,.4)") {
    const r = dir === "up" ? 0 : 180;
    return `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 -14 L8 -2 L3 -2 L3 12 L-3 12 L-3 -2 L-8 -2 Z" fill="${color}"/>`;
  },
  label(x, y, text, opts = {}) {
    const size = opts.size || 13, anchor = opts.anchor || "middle";
    const color = opts.color && !/^#ffd38a$/i.test(opts.color) ? opts.color : "#ffffff";
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${opts.weight || 800}" fill="${color}" stroke="rgba(15,23,42,.65)" stroke-width="3" paint-order="stroke" stroke-linejoin="round" font-family="system-ui, -apple-system, Segoe UI, sans-serif" ${opts.italic ? 'font-style="italic"' : ""}>${esc(text)}</text>`;
  },
  /** A planned path that draws itself; ok=false ends in a red ✕ that pops in. */
  ghost(points, ok) {
    const id = "gm" + (++uid);
    const d = "M" + points.map(p => p.join(" ")).join(" L");
    const [ex, ey] = points[points.length - 1];
    const col = ok ? "#22c55e" : "#ef4444";
    let s = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-400" y="-400" width="1200" height="1200"><path class="draw" d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></mask>
      <path d="${d}" fill="none" stroke="rgba(15,23,42,.35)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id})"/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="5" stroke-dasharray="10 8" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id})" class="march"/>`;
    s += ok ? `<g class="pop" data-focus="${ex},${ey}" transform="translate(${ex} ${ey})"><g class="popin"><circle r="11" fill="#22c55e" stroke="#fff" stroke-width="3"/><path d="M-5 0 L-1.5 4 L5.5 -4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`
            : `<g class="pop xmark" data-focus="${ex},${ey}" transform="translate(${ex} ${ey})"><g class="popin"><circle r="17" fill="#ef4444" stroke="#fff" stroke-width="3.5"/><path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></g></g>`;
    return s;
  },
  pulse(x, y, r = 30, color = "#facc15") {
    const col = isRed(color) ? "#ef4444" : isGreen(color) ? "#22c55e" : "#facc15";
    return `<g data-focus="${x},${y}"><circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity=".18" class="pulse-ring"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-width="3.5" class="pulse-ring"/></g>`;
  },
  bubble(x, y, text, color = "#facc15") {
    const w = Math.max(44, text.length * 6.6 + 22);
    const red = isRed(color), green = isGreen(color);
    const bg = red ? "#ef4444" : green ? "#16a34a" : "#ffffff", fg = red || green ? "#ffffff" : "#0f172a";
    return `<g transform="translate(${x} ${y})"><g class="popin"><rect x="${-w / 2}" y="-14" width="${w}" height="28" rx="14" fill="${bg}" filter="url(#softShadow)"/>
      <text y="4.5" text-anchor="middle" font-size="12" font-weight="800" fill="${fg}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">${esc(text)}</text></g></g>`;
  },
  sign(x, y, kind) {
    const red = "#dc2626";
    const g = {
      noOvertake: `<circle r="17" fill="#fff" stroke="${red}" stroke-width="5"/><rect x="-11" y="-6" width="9" height="13" rx="2" fill="${red}"/><rect x="2" y="-6" width="9" height="13" rx="2" fill="#222"/>`,
      curve: `<path d="M0 -19 L18 13 L-18 13 Z" fill="#fff" stroke="${red}" stroke-width="4" stroke-linejoin="round"/><path d="M-3 9 L-3 0 Q-3 -6 4 -8" stroke="#222" stroke-width="3" fill="none"/>`,
      hill: `<path d="M0 -19 L18 13 L-18 13 Z" fill="#fff" stroke="${red}" stroke-width="4" stroke-linejoin="round"/><path d="M-9 9 Q0 -4 9 9" stroke="#222" stroke-width="3" fill="none"/>`,
      train: `<path d="M0 -19 L18 13 L-18 13 Z" fill="#fff" stroke="${red}" stroke-width="4" stroke-linejoin="round"/><rect x="-7" y="-2" width="14" height="9" fill="#222"/>`,
      oneway: `<rect x="-14" y="-16" width="28" height="32" rx="4" fill="#1d4ed8"/><path d="M0 -10 L7 -1 L2 -1 L2 10 L-2 10 L-2 -1 L-7 -1 Z" fill="#fff"/>`,
    }[kind] || "";
    return `<g transform="translate(${x} ${y})"><rect x="-1.5" y="10" width="3" height="18" fill="#64748b"/><g filter="url(#softShadow)">${g}</g></g>`;
  },
  trafficLight(x, y, color = "red") {
    const on = c => (c === color ? { red: "#ff3b30", amber: "#ffb020", green: "#22c55e" }[c] : "#2b2f36");
    const glow = { red: "#ff3b30", amber: "#ffb020", green: "#22c55e" }[color];
    const cy = { red: -14, amber: -2, green: 10 }[color];
    return `<g transform="translate(${x} ${y})"><circle cy="${cy}" r="14" fill="${glow}" opacity=".25" class="pulse-soft"/><rect x="-9" y="-25" width="18" height="46" rx="6" fill="#111827" filter="url(#softShadow)"/>
      <circle cy="-14" r="5.5" fill="${on("red")}"/><circle cy="-2" r="5.5" fill="${on("amber")}"/><circle cy="10" r="5.5" fill="${on("green")}"/></g>`;
  },
  fog(y0, y1) {
    return `<defs><linearGradient id="fogG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f5" stop-opacity=".97"/><stop offset="1" stop-color="#eef2f5" stop-opacity="0"/></linearGradient></defs>
      <rect x="-200" y="${y0 - 200}" width="${W + 400}" height="${y1 - y0 + 200}" fill="url(#fogG)" class="drift"/>`;
  },
};

const DEFS = `<defs>
  <linearGradient id="bodyShine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".35" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
  <radialGradient id="indGlow"><stop offset="0" stop-color="#fff3b0"/><stop offset=".35" stop-color="#ffb020"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient>
  <radialGradient id="brakeGlow"><stop offset="0" stop-color="#ff3b30" stop-opacity=".7"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient>
  <radialGradient id="blueGlow"><stop offset="0" stop-color="#bfdbfe"/><stop offset=".4" stop-color="#3b82f6" stop-opacity=".8"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
  <radialGradient id="vignette" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0b1220" stop-opacity=".45"/></radialGradient>
  <linearGradient id="coneG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fde047" stop-opacity=".55"/><stop offset="1" stop-color="#fde047" stop-opacity=".12"/></linearGradient>
  <radialGradient id="youRing"><stop offset=".55" stop-color="#60a5fa" stop-opacity="0"/><stop offset=".8" stop-color="#60a5fa" stop-opacity=".55"/><stop offset="1" stop-color="#60a5fa" stop-opacity="0"/></radialGradient>
  <pattern id="asphalt" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="#fff" opacity=".06"/><circle cx="8" cy="9" r=".6" fill="#000" opacity=".18"/><circle cx="10" cy="2" r=".5" fill="#fff" opacity=".05"/></pattern>
  <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity=".35"/></filter>
  <filter id="carShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter>
</defs>`;

const STYLE = `<style>
  .show{opacity:0;transition:opacity .35s ease}
  .show.on{opacity:1}
  .draw{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1s cubic-bezier(.65,0,.35,1)}
  .show.on .draw{stroke-dashoffset:0}
  .march{animation:march 1s linear infinite}
  @keyframes march{to{stroke-dashoffset:-18}}
  .popin{transform:scale(0);transform-box:fill-box;transform-origin:center;transition:transform .55s cubic-bezier(.34,1.9,.5,1)}
  .show.on .popin{transform:scale(1)}
  .show.on .xmark .popin, .show.on .pop .popin{transition-delay:.8s}
  .pulse-ring{transform-box:fill-box;transform-origin:center;animation:pr 1.2s ease-out infinite}
  @keyframes pr{from{opacity:.9;transform:scale(.55)}to{opacity:0;transform:scale(1.5)}}
  .pulse-soft{animation:ps 1.4s ease-in-out infinite}
  @keyframes ps{50%{opacity:.6}}
  .drift{animation:drift 6s ease-in-out infinite alternate}
  @keyframes drift{to{transform:translateX(14px)}}
  .rc-line{opacity:0;transform:translateY(14px);transition:opacity .5s ease, transform .6s cubic-bezier(.22,1.4,.36,1)}
  .show.on .rc-line{opacity:1;transform:none}
  .rc-icon{transform:scale(0) rotate(-20deg);transform-box:fill-box;transform-origin:center;transition:transform .6s cubic-bezier(.34,1.9,.5,1) .1s}
  .show.on .rc-icon{transform:none}
  .stamp{opacity:0;transform:scale(2.6) rotate(-18deg);transform-box:fill-box;transform-origin:center}
  .stamp.on{opacity:1;transform:scale(1) rotate(-8deg);transition:transform .45s cubic-bezier(.2,1.6,.4,1), opacity .15s}
  .stamp.ok.on{transform:scale(1) rotate(0)}
  .flash{opacity:0}
  .flash.go{animation:flash .7s ease-out}
  @keyframes flash{0%{opacity:.55}100%{opacity:0}}
  .burst circle{opacity:0}
  .burst.go circle{animation:burst .9s cubic-bezier(.2,.8,.3,1) forwards}
  @keyframes burst{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4)}}
  .check{stroke-dasharray:40;stroke-dashoffset:40}
  .stamp.on .check{transition:stroke-dashoffset .5s ease .25s;stroke-dashoffset:0}
</style>`;

// ---------- motion ----------
// Hermite curve through keyframes, with time-aware tangents (smooth speed, no stop at each key).
function tangents(keys) {
  const n = keys.length, m = [];
  const same = (a, b) => Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5;
  for (let i = 0; i < n; i++) {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)], k = keys[i];
    if ((i > 0 && same(keys[i - 1], k)) || (i < n - 1 && same(keys[i + 1], k)) || b.t === a.t) { m.push({ x: 0, y: 0 }); continue; }
    m.push({ x: (b.x - a.x) / (b.t - a.t), y: (b.y - a.y) / (b.t - a.t) });
  }
  return m;
}

export function sample(actor, t) {
  const keys = actor.keys, m = actor._m || (actor._m = tangents(keys));
  let flags = {};
  const take = k => { for (const f of ["blink", "brake", "flash", "hide"]) if (f in k) flags[f] = k[f]; };
  if (t <= keys[0].t) { take(keys[0]); return { x: keys[0].x, y: keys[0].y, r: keys[0].r || 0, ...flags }; }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    take(a);
    if (t <= b.t) {
      const dt = b.t - a.t || 1, p = (t - a.t) / dt, p2 = p * p, p3 = p2 * p;
      const h00 = 2 * p3 - 3 * p2 + 1, h10 = p3 - 2 * p2 + p, h01 = -2 * p3 + 3 * p2, h11 = p3 - p2;
      const x = h00 * a.x + h10 * dt * m[i].x + h01 * b.x + h11 * dt * m[i + 1].x;
      const y = h00 * a.y + h10 * dt * m[i].y + h01 * b.y + h11 * dt * m[i + 1].y;
      const ra = a.r || 0, rb = b.r ?? ra;
      const pe = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      return { x, y, r: ra + (rb - ra) * pe, ...flags };
    }
  }
  const last = keys[keys.length - 1];
  take(last);
  return { x: last.x, y: last.y, r: last.r || 0, ...flags };
}

/**
 * Create a board in `host`. Returns controls.
 * onStep(step, index, count) is called when a caption changes; if it returns a promise,
 * the animation holds until it resolves (Giulia speaking). onEnd() at the end.
 */
export function createBoard(host, { onStep, onEnd, onLand } = {}) {
  host.innerHTML = "";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.classList.add("scene");
  host.appendChild(svg);
  let scene = null, t = 0, speed = 1, playing = false, raf = 0, lastTs = 0, stepIdx = -1, ended = false, pauseAt = null;
  let actorEls = [], showEls = [], cam = { x: W / 2, y: H / 2, s: 1 }, world = null, hud = null, stampEl = null, flashEl = null, burstEl = null;
  let gen = 0, holding = false, holdUntil = 0, landed = false, youActor = null, hasActors = false;

  function build(s) {
    scene = s;
    svg.setAttribute("aria-label", s.steps.map(x => x.text).join(" "));
    svg.innerHTML = STYLE + DEFS + `<g class="world"></g><g class="hud"></g>`;
    world = svg.querySelector(".world"); hud = svg.querySelector(".hud");
    world.innerHTML = s.bg;
    hasActors = s.actors.length > 0;
    actorEls = s.actors.map(a => {
      a._m = null;
      const k = (KINDS[a.kind] || KINDS.car)(a.color);
      const g = document.createElementNS(NS, "g");
      const explicitR = a.keys.some(key => "r" in key);
      g.innerHTML = (k.ped ? "" : `<rect class="shadow" x="${-k.w / 2 + 2}" y="${-k.h / 2 + 4}" width="${k.w}" height="${k.h}" rx="8" fill="rgba(15,23,42,.35)" filter="url(#carShadow)"/>`) +
        (k.ped ? "" : `<g class="streaks" opacity="0">${[-k.w / 3, 0, k.w / 3].map((dx, i) => `<line x1="${dx}" y1="${k.h / 2 + 6 + i * 3}" x2="${dx}" y2="${k.h / 2 + 26 + i * 5}" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="${.5 - i * .1}"/>`).join("")}</g>`) +
        (a.cone ? `<g class="cone"><path class="cone-shape" fill="url(#coneG)"/><line class="cone-end" stroke="#ef4444" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/>
          <g class="cone-q"><circle r="11" fill="#ef4444" stroke="#fff" stroke-width="2.5"/><text y="5" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">?</text></g></g>` : "") +
        (k.you ? `<circle class="you-ring" r="${k.h * .62}" fill="url(#youRing)"/>` : "") +
        `<g class="body">${k.svg}</g>` +
        (k.you ? `<g class="you-tag"><rect x="-16" y="${-k.h / 2 - 20}" width="32" height="14" rx="7" fill="#2563eb" stroke="#fff" stroke-width="1.5"/><text y="${-k.h / 2 - 10}" text-anchor="middle" font-size="8.5" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">${T("YOU", "TU")}</text></g>` : "") +
        (a.label ? `<g transform="translate(${k.w / 2 + 6} 0)">${lib.label(0, 4, a.label, { size: 11, anchor: "start" })}</g>` : "");
      world.appendChild(g);
      // initial heading = direction of the first real movement
      let heading = 0;
      for (let i = 0; i < a.keys.length - 1; i++) {
        const p = a.keys[i], q = a.keys[i + 1];
        if (Math.hypot(q.x - p.x, q.y - p.y) > 2) { heading = Math.atan2(q.x - p.x, -(q.y - p.y)) * 180 / Math.PI; break; }
      }
      const e = { a, g, k, explicitR, heading, cone: g.querySelector(".cone"), body: g.querySelector(".body"), tag: g.querySelector(".you-tag"),
        L: g.querySelector(".ind-L"), R: g.querySelector(".ind-R"), br: g.querySelector(".brake"), siren: g.querySelector(".siren"), streaks: g.querySelector(".streaks") };
      if (k.you) youActor = e;
      return e;
    });
    showEls = (s.shows || []).map(sh => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "show");
      g.innerHTML = sh.svg;
      world.appendChild(g);
      const f = g.querySelector("[data-focus]");
      const focus = f ? f.getAttribute("data-focus").split(",").map(Number) : null;
      return { sh, g, t0: sh.t0 ?? sh.t ?? 0, t1: sh.t1 ?? Infinity, focus, danger: !!g.querySelector(".xmark") || /ef4444/.test(sh.svg) };
    });
    // HUD: vignette, flash, verdict stamp, burst
    const ok = s.verdict && s.verdict.ok;
    hud.innerHTML = `<rect width="${W}" height="${H}" fill="url(#vignette)" pointer-events="none"/>
      <rect class="flash" width="${W}" height="${H}" fill="${ok ? "#22c55e" : "#ef4444"}"/>
      <g class="burst" transform="translate(${W / 2} ${H / 2 - 20})">${Array.from({ length: 14 }, (_, i) => {
        const a = i / 14 * Math.PI * 2, d = 90 + (i % 3) * 30;
        return `<circle r="${4 + (i % 3)}" fill="${["#22c55e", "#facc15", "#60a5fa", "#f472b6"][i % 4]}" style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px"/>`;
      }).join("")}</g>
      ${s.verdict ? `<g transform="translate(${W / 2} ${hasActors ? H / 2 - 20 : H - 52}) scale(${hasActors ? 1 : .72})"><g class="stamp ${ok ? "ok" : "no"}">
        <rect x="-74" y="-34" width="148" height="68" rx="20" fill="${ok ? "#16a34a" : "#dc2626"}" stroke="#fff" stroke-width="5" filter="url(#softShadow)"/>
        ${ok ? `<path class="check" d="M-52 0 L-40 12 L-22 -10" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
             : `<path d="M-52 -11 L-30 11 M-30 -11 L-52 11" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`}
        <text x="18" y="12" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" font-family="system-ui,sans-serif" letter-spacing="1">${ok ? "OK" : "NO"}</text></g></g>` : ""}`;
    stampEl = hud.querySelector(".stamp"); flashEl = hud.querySelector(".flash"); burstEl = hud.querySelector(".burst");
    landed = false;
    cam = camTarget(0);
  }

  // Where should the camera look at time t?
  function camTarget(tt) {
    if (!hasActors || scene.camera === "wide") return { x: W / 2, y: H / 2, s: 1 };
    const d = scene.duration;
    if (tt < 700 || tt > d - 1700) return { x: W / 2, y: H / 2, s: 1 };
    for (const e of showEls) {
      if (e.focus && tt >= e.t0 + 300 && tt < e.t0 + 2300 && tt < e.t1) {
        // frame the danger mark and your car together
        const p = youActor ? sample(youActor.a, tt) : { x: e.focus[0], y: e.focus[1] };
        const x0 = Math.min(p.x, e.focus[0]) - 70, x1 = Math.max(p.x, e.focus[0]) + 70;
        const y0 = Math.min(p.y, e.focus[1]) - 70, y1 = Math.max(p.y, e.focus[1]) + 70;
        const s = Math.max(1, Math.min(1.6, W / (x1 - x0), H / (y1 - y0)));
        return clampCam({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, s });
      }
    }
    if (youActor) { const p = sample(youActor.a, tt); return clampCam({ x: p.x, y: p.y - 60, s: 1.3 }); }
    return { x: W / 2, y: H / 2, s: 1 };
  }
  function clampCam(c) {
    const hw = W / 2 / c.s, hh = H / 2 / c.s;
    return { s: c.s, x: Math.min(W - hw + 30, Math.max(hw - 30, c.x)), y: Math.min(H - hh + 40, Math.max(hh - 60, c.y)) };
  }
  // slow motion while a danger mark appears
  function timeScale(tt) {
    for (const e of showEls) if (e.danger && tt >= e.t0 + 200 && tt < e.t0 + 1500) return .4;
    return 1;
  }

  function render(dtReal = 0, snap = false) {
    const blinkOn = Math.floor(performance.now() / 380) % 2 === 0;
    // camera
    const target = camTarget(t);
    const k = snap ? 1 : 1 - Math.exp(-dtReal / 260);
    cam = { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k, s: cam.s + (target.s - cam.s) * k };
    world.setAttribute("transform", `translate(${W / 2} ${H / 2}) scale(${cam.s.toFixed(4)}) translate(${(-cam.x).toFixed(2)} ${(-cam.y).toFixed(2)})`);
    // actors
    for (const e of actorEls) {
      const st = sample(e.a, t);
      const ahead = sample(e.a, Math.min(scene.duration, t + 60));
      const vx = (ahead.x - st.x) / 60, vy = (ahead.y - st.y) / 60;
      const v = Math.hypot(vx, vy);
      let rot = st.r || 0;
      if (!e.explicitR && !e.k.ped) {
        // face the direction of travel (oncoming cars face down); keep the heading when stopped
        const want = v > .004 ? Math.atan2(vx, -vy) * 180 / Math.PI : e.heading;
        const d = ((want - e.heading + 540) % 360) - 180;
        e.heading = snap ? e.heading + d : e.heading + d * Math.min(1, dtReal / 90);
        rot = e.heading;
      }
      e.g.setAttribute("transform", `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)}) rotate(${rot.toFixed(1)})`);
      e.g.style.opacity = st.hide ? 0 : 1;
      if (e.tag) e.tag.setAttribute("transform", `rotate(${(-rot).toFixed(1)})`);
      if (e.cone) {
        // line of sight: from the windscreen forward, cut off where the view is blocked (a.cone = world y)
        const L = Math.max(16, st.y - e.a.cone - e.k.h / 2), y0 = -e.k.h / 2, y1 = y0 - L, half = Math.min(70, 10 + L * .32);
        e.cone.querySelector(".cone-shape").setAttribute("d", `M-7 ${y0} L7 ${y0} L${half} ${y1} L${-half} ${y1} Z`);
        const end = e.cone.querySelector(".cone-end");
        end.setAttribute("x1", -half - 6); end.setAttribute("x2", half + 6); end.setAttribute("y1", y1); end.setAttribute("y2", y1);
        e.cone.querySelector(".cone-q").setAttribute("transform", `translate(${half + 18} ${y1})`);
        e.cone.style.opacity = t > 900 ? 1 : 0;
      }
      if (e.streaks) e.streaks.setAttribute("opacity", Math.max(0, Math.min(1, (v - .045) / .05)).toFixed(2));
      const L = st.blink === "L" || st.blink === "H", R = st.blink === "R" || st.blink === "H";
      if (e.L) e.L.setAttribute("opacity", L && blinkOn ? 1 : 0);
      if (e.R) e.R.setAttribute("opacity", R && blinkOn ? 1 : 0);
      if (e.br) e.br.setAttribute("opacity", st.brake ? 1 : 0);
      if (e.siren) e.siren.setAttribute("opacity", st.flash && blinkOn ? 1 : st.flash ? .35 : 0);
    }
    for (const e of showEls) e.g.classList.toggle("on", t >= e.t0 && t < e.t1);
    // landing: stamp + flash + shake + burst
    const land = scene.verdict && t >= scene.duration - 1100;
    if (land && !landed) {
      landed = true;
      stampEl && stampEl.classList.add("on");
      if (!snap) {
        flashEl.classList.remove("go"); void flashEl.getBBox(); flashEl.classList.add("go");
        if (scene.verdict.ok) { burstEl.classList.remove("go"); void burstEl.getBBox(); burstEl.classList.add("go"); }
        else { host.classList.remove("shake"); void host.offsetWidth; host.classList.add("shake"); }
        if (navigator.vibrate && !scene.verdict.ok) try { navigator.vibrate(60); } catch { /* not allowed */ }
        onLand && onLand(scene.verdict.ok);
      }
    } else if (!land && landed) {
      landed = false; stampEl && stampEl.classList.remove("on"); burstEl.classList.remove("go");
    }
    // captions
    let idx = -1;
    scene.steps.forEach((s, i) => { if (t >= s.t) idx = i; });
    if (idx !== stepIdx) {
      stepIdx = idx;
      if (idx >= 0 && onStep) {
        const r = onStep(scene.steps[idx], idx, scene.steps.length);
        if (r && typeof r.then === "function" && playing) {
          // keep the scene alive in slow motion (never past the next step) until Giulia has finished
          const myGen = gen;
          holding = true;
          const nextStep = scene.steps[idx + 1];
          holdUntil = nextStep ? nextStep.t - 1 : scene.duration;
          r.then(() => { if (myGen === gen) holding = false; });
        }
      }
    }
  }

  // keeps the camera easing and indicators blinking while paused / holding / finished
  function idleLoop() {
    cancelAnimationFrame(raf);
    let last = 0;
    const tick = ts => {
      if (playing || !scene) return;
      render(last ? ts - last : 16); last = ts;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function frame(ts) {
    if (!playing) return;
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    if (holding) t = Math.min(holdUntil, t + dt * speed * .12);
    else t = Math.min(scene.duration, t + dt * speed * timeScale(t));
    if (pauseAt !== null && t >= pauseAt) { t = pauseAt; pauseAt = null; playing = false; render(dt); idleLoop(); return; }
    render(dt);
    if (!playing) return;
    if (t >= scene.duration) {
      playing = false;
      if (!ended) { ended = true; onEnd && onEnd(); }
      idleLoop();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  const restart = () => { t = 0; ended = false; stepIdx = -1; landed = false; stampEl && stampEl.classList.remove("on"); };
  const ctl = {
    load(s) { gen++; holding = false; playing = false; cancelAnimationFrame(raf); youActor = null; build(s); t = 0; stepIdx = -1; ended = false; render(0, true); idleLoop(); },
    play() { if (!scene) return; gen++; holding = false; cancelAnimationFrame(raf); if (t >= scene.duration) restart(); playing = true; lastTs = 0; raf = requestAnimationFrame(frame); },
    pause() { gen++; holding = false; playing = false; idleLoop(); },
    replay() { pauseAt = null; restart(); ctl.play(); },
    setSpeed(s) { speed = s; },
    get speed() { return speed; },
    /** Play until the next caption, then pause. */
    step() {
      if (!scene) return;
      if (t >= scene.duration) restart();
      const next = scene.steps.find(s => s.t > t + 1);
      pauseAt = next ? next.t : scene.duration;
      gen++; holding = false;
      playing = true; lastTs = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    },
    jumpToEnd() { t = scene.duration; render(0, true); },
    /** Jump to caption i and play from there. */
    seekStep(i) {
      if (!scene || !scene.steps[i]) return;
      gen++; holding = false; pauseAt = null;
      t = scene.steps[i].t; stepIdx = i - 1; ended = false;
      if (t < scene.duration - 1100) { landed = false; stampEl && stampEl.classList.remove("on"); }
      playing = true; lastTs = 0; cancelAnimationFrame(raf); render(0); raf = requestAnimationFrame(frame);
    },
    get steps() { return scene ? scene.steps : []; },
    seek(ms) { t = Math.max(0, Math.min(scene.duration, ms)); stepIdx = -1; render(0, true); },
    get duration() { return scene ? scene.duration : 0; },
    /** current scene time in ms (the 3D view reads this every frame) */
    get time() { return t; },
    get speedNow() { return playing ? speed * (holding ? .12 : timeScale(t)) : 0; },
    destroy() { gen++; playing = false; cancelAnimationFrame(raf); scene = null; host.innerHTML = ""; },
  };
  return ctl;
}
