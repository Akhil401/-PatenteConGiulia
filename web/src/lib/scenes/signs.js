// Scene templates for road signs (chapters 2-10), official figures and road parts (chapter 1).
import { lib, W, H, T } from "./engine.js";

const { label, ghost, pulse, bubble } = lib;
const FONT = `font-family="system-ui, -apple-system, Segoe UI, sans-serif"`;
const R = 215, L = 145;               // our lane / opposite lane on a two-way road
const SIGN = { x: 292, y: 205 };      // where the sign stands

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/** The official sign picture on a pole, popping up with a glow. */
function signPost(img, x = SIGN.x, y = SIGN.y, size = 58) {
  if (!img) return "";
  return `<g transform="translate(${x} ${y})"><rect x="-2" y="${size / 2 - 4}" width="4" height="46" fill="#64748b"/>
    <g class="popin"><circle r="${size * .78}" fill="#fff" opacity=".2" class="pulse-soft"/>
      <rect x="${-size / 2 - 4}" y="${-size / 2 - 4}" width="${size + 8}" height="${size + 8}" rx="12" fill="#fff" filter="url(#softShadow)"/>
      <image href="${esc(img)}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/></g></g>`;
}
function road2(line = "dashed") { return lib.grass() + lib.road(110, 140) + lib.line(180, line) + lib.arrow(R, 395) + lib.arrow(L, 30, "down"); }
function junction(y = 100, h = 60) {
  return `<rect x="-200" y="${y}" width="${W + 400}" height="${h}" fill="#3d4350"/>
    <line x1="-200" y1="${y + h / 2}" x2="110" y2="${y + h / 2}" stroke="#fff" stroke-width="3" stroke-dasharray="20 16"/>
    <line x1="250" y1="${y + h / 2}" x2="${W + 200}" y2="${y + h / 2}" stroke="#fff" stroke-width="3" stroke-dasharray="20 16"/>`;
}
const stopLine = (y, dashed) => `<line x1="182" y1="${y}" x2="248" y2="${y}" stroke="#fff" stroke-width="${dashed ? 4 : 6}" ${dashed ? 'stroke-dasharray="7 6"' : ""}/>`;
const hazardIcon = (emoji, x = R, y = 70) => emoji ? `<g data-focus="${x},${y}" transform="translate(${x} ${y})"><g class="popin"><circle r="26" fill="#facc15" stroke="#fff" stroke-width="3" filter="url(#softShadow)"/><text y="10" text-anchor="middle" font-size="28">${emoji}</text></g></g>` + pulse(x, y, 34, "#facc15") : "";

/**
 * sign: the question's sign + what your car must do.
 * P.action: slow | stop | giveWay | priority | noEntry | noOvertake | turnLeft | turnRight | straight | keepRight | keepLeft |
 *           straightOrRight | straightOrLeft | leftOrRight | eitherSide | narrowGiveWay | narrowPriority |
 *           noTurnLeft | noTurnRight | noUTurn | speedLimit | endLimit | park | noParking | noStopping | info
 * P.hazard: emoji shown ahead (danger signs), P.distance: e.g. "150 m", P.value: number for speed limits
 */
export function sign(P, q) {
  const a = P.action || "info";
  const img = q && q.image;
  const dur = 8800;
  const TWO = { straightOrRight: ["straight", "right"], straightOrLeft: ["straight", "left"], leftOrRight: ["left", "right"] };
  const crossing = ["stop", "giveWay", "priority", "turnLeft", "turnRight", "straight", "noTurnLeft", "noTurnRight", "noUTurn", "noEntry", ...Object.keys(TWO)].includes(a);
  const narrow = a === "narrowGiveWay" || a === "narrowPriority";
  let bg = road2(a === "noOvertake" ? "dashed" : "dashed");
  if (crossing) bg += junction(100, 60);
  if (a === "stop") bg += stopLine(168, false) + label(R, 186, "STOP", { size: 13 });
  if (a === "giveWay") bg += stopLine(168, true) + `<path d="M196 182 L204 196 L212 182 Z M218 182 L226 196 L234 182 Z" fill="#fff"/>`;
  if (narrow) bg += `<rect x="104" y="100" width="42" height="100" rx="8" fill="#94a3b8" stroke="#fff" stroke-width="2"/><rect x="214" y="100" width="42" height="100" rx="8" fill="#94a3b8" stroke="#fff" stroke-width="2"/>`;
  if (a === "eitherSide") bg += `<rect x="168" y="90" width="24" height="90" rx="12" fill="#cbd5e1" stroke="#fff" stroke-width="2"/>`;
  if (a === "keepRight" || a === "keepLeft") bg += `<rect x="168" y="90" width="24" height="90" rx="12" fill="#cbd5e1" stroke="#fff" stroke-width="2"/>`;
  if (a === "park" || a === "noParking" || a === "noStopping") bg += `<rect x="250" y="40" width="40" height="300" fill="#4b5262"/>` + Array.from({ length: 5 }, (_, i) => `<line x1="250" y1="${50 + i * 60}" x2="290" y2="${50 + i * 60}" stroke="#fff" stroke-width="2"/>`).join("");
  const shows = [{ t: 200, svg: `<g data-focus="${SIGN.x},${SIGN.y}">${signPost(img)}</g>` }];
  const actors = [];
  let you = [{ t: 0, x: R, y: 470 }, { t: 2600, x: R, y: 300 }, { t: dur, x: R, y: -60 }];
  let say = "";
  const ok = P.verdict !== "no";
  switch (a) {
    case "slow":
      you = [{ t: 0, x: R, y: 470 }, { t: 1800, x: R, y: 300 }, { t: 2600, x: R, y: 250, brake: true }, { t: 6400, x: R, y: 120, brake: false }, { t: dur, x: R, y: 20 }];
      shows.push({ t: 2400, svg: hazardIcon(P.hazard || "⚠️") });
      if (P.distance) shows.push({ t: 2600, svg: `<line x1="270" y1="${SIGN.y - 40}" x2="270" y2="100" stroke="#facc15" stroke-width="3" stroke-dasharray="5 5"/>` + label(282, 160, P.distance, { size: 13, anchor: "start" }) });
      say = T("Danger ahead: slow down and be ready.", "Pericolo più avanti: rallenta e stai attento."); break;
    case "stop":
      actors.push({ id: "x", kind: "car", color: "#ef4444", keys: [{ t: 0, x: 420, y: 115, r: -90 }, { t: 3800, x: 420, y: 115, r: -90 }, { t: 6000, x: -60, y: 115, r: -90 }] });
      you = [{ t: 0, x: R, y: 470 }, { t: 2600, x: R, y: 196, brake: true }, { t: 6200, x: R, y: 196, brake: false }, { t: dur, x: R, y: -40 }];
      shows.push({ t: 2700, svg: bubble(R - 70, 200, T("full stop", "fermati"), "#ef4444") });
      say = T("STOP: stop completely at the line, then give way to everyone.", "STOP: fermati del tutto alla linea, poi dai precedenza a tutti."); break;
    case "giveWay":
      actors.push({ id: "x", kind: "car", color: "#ef4444", keys: [{ t: 0, x: 420, y: 115, r: -90 }, { t: 3000, x: 420, y: 115, r: -90 }, { t: 5600, x: -60, y: 115, r: -90 }] });
      you = [{ t: 0, x: R, y: 470 }, { t: 2600, x: R, y: 210, brake: true }, { t: 5200, x: R, y: 204, brake: false }, { t: dur, x: R, y: -40 }];
      say = T("Give way: slow down and let the other cars pass first.", "Dare precedenza: rallenta e lascia passare prima gli altri."); break;
    case "priority":
      actors.push({ id: "x", kind: "car", color: "#94a3b8", keys: [{ t: 0, x: 330, y: 115, r: -90 }, { t: 1000, x: 300, y: 115, r: -90, brake: true }, { t: dur, x: 300, y: 115, r: -90 }] });
      you = [{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -60 }];
      say = T("You have priority: the others must wait for you.", "Hai la precedenza: gli altri devono aspettarti."); break;
    case "noEntry":
      you = [{ t: 0, x: R, y: 470 }, { t: 2600, x: R, y: 230, brake: true }, { t: dur, x: R, y: 226 }];
      shows.push({ t: 2600, svg: ghost([[R, 210], [R, 120], [R, 20]], false) });
      say = T("You may not drive into this road.", "Non puoi entrare in questa strada."); break;
    case "noOvertake":
      actors.push({ id: "s", kind: "truck", keys: [{ t: 0, x: R, y: 260 }, { t: dur, x: R, y: 120 }] });
      you = [{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: 300 }];
      shows.push({ t: 2600, svg: ghost([[R, 320], [L, 260], [L, 100], [R, 50]], false) });
      say = T("No overtaking here.", "Qui non si sorpassa."); break;
    case "turnLeft": case "turnRight": case "straight": {
      const exitX = a === "turnLeft" ? -60 : a === "turnRight" ? 420 : R;
      const exitY = a === "straight" ? -60 : (a === "turnLeft" ? 115 : 145);
      const rot = a === "turnLeft" ? -90 : a === "turnRight" ? 90 : 0;
      you = [{ t: 0, x: R, y: 470, r: 0 }, { t: 2600, x: R, y: 230, r: 0, blink: a === "turnLeft" ? "L" : a === "turnRight" ? "R" : null }, { t: 4200, x: a === "turnLeft" ? 170 : a === "turnRight" ? 235 : R, y: 140, r: rot * .6 }, { t: dur, x: exitX, y: exitY, r: rot, blink: null }];
      const others = { turnLeft: [[[R, 160], [R, 40]], [[R, 160], [330, 145]]], turnRight: [[[R, 160], [R, 40]], [[R, 160], [30, 115]]], straight: [[[R, 160], [30, 115]], [[R, 160], [330, 145]]] }[a];
      shows.push({ t: 1800, t1: 4200, svg: others.map(p => ghost(p, false)).join("") });
      say = { turnLeft: T("You must turn LEFT here.", "Qui devi girare a SINISTRA."), turnRight: T("You must turn RIGHT here.", "Qui devi girare a DESTRA."), straight: T("You must go STRAIGHT on.", "Devi andare DRITTO.") }[a]; break;
    }
    case "noTurnLeft": case "noTurnRight": case "noUTurn":
      shows.push({ t: 2600, svg: ghost(a === "noTurnLeft" ? [[R, 200], [R, 150], [40, 115]] : a === "noTurnRight" ? [[R, 200], [R, 160], [330, 145]] : [[R, 200], [R, 140], [L, 140], [L, 260]], false) });
      you = [{ t: 0, x: R, y: 470 }, { t: 2600, x: R, y: 240 }, { t: dur, x: R, y: -60 }];
      say = { noTurnLeft: T("Turning LEFT is forbidden here.", "Qui è vietato girare a SINISTRA."), noTurnRight: T("Turning RIGHT is forbidden here.", "Qui è vietato girare a DESTRA."), noUTurn: T("A U-turn is forbidden here.", "Qui è vietata l'inversione a U.") }[a]; break;
    case "keepRight": case "keepLeft": {
      const side = a === "keepRight" ? 228 : 132;
      you = [{ t: 0, x: R, y: 470 }, { t: 2200, x: R, y: 260 }, { t: 3600, x: side, y: 150 }, { t: 5200, x: side === 228 ? R : 160, y: 40 }, { t: dur, x: R, y: -60 }];
      shows.push({ t: 1800, t1: 3600, svg: ghost([[R, 240], [a === "keepRight" ? 150 : 232, 140]], false) });
      say = a === "keepRight" ? T("Pass on the RIGHT of the obstacle.", "Passa a DESTRA dell'ostacolo.") : T("Pass on the LEFT of the obstacle.", "Passa a SINISTRA dell'ostacolo."); break;
    }
    case "straightOrRight": case "straightOrLeft": case "leftOrRight": {
      // the two allowed exits in green, the forbidden one in red; your car takes the first allowed one
      const path = { straight: [[R, 200], [R, 120], [R, 20]], right: [[R, 200], [R, 160], [330, 145]], left: [[R, 200], [R, 140], [40, 115]] };
      const allowed = TWO[a], banned = ["straight", "left", "right"].find(d => !allowed.includes(d));
      shows.push({ t: 1800, t1: 5200, svg: allowed.map(d => ghost(path[d], true)).join("") + ghost(path[banned], false) });
      const d = allowed[0], rot = d === "left" ? -90 : d === "right" ? 90 : 0;
      you = [{ t: 0, x: R, y: 470, r: 0 }, { t: 2600, x: R, y: 230, r: 0, blink: d === "left" ? "L" : d === "right" ? "R" : null },
        { t: 4200, x: d === "left" ? 170 : d === "right" ? 235 : R, y: 140, r: rot * .6 }, { t: dur, x: d === "left" ? -60 : d === "right" ? 420 : R, y: d === "straight" ? -60 : d === "left" ? 115 : 145, r: rot, blink: null }];
      const name = { straight: T("straight on", "dritto"), left: T("left", "a sinistra"), right: T("right", "a destra") };
      say = T(`You may go ${name[allowed[0]]} or ${name[allowed[1]]}, nothing else.`, `Puoi andare ${name[allowed[0]]} o ${name[allowed[1]]}, non altrove.`); break;
    }
    case "eitherSide":
      shows.push({ t: 1800, t1: 5200, svg: ghost([[R, 240], [228, 140], [R, 40]], true) + ghost([[R, 240], [132, 140], [R, 40]], true) });
      you = [{ t: 0, x: R, y: 470 }, { t: 2200, x: R, y: 260 }, { t: 3600, x: 228, y: 150 }, { t: 5200, x: R, y: 40 }, { t: dur, x: R, y: -60 }];
      say = T("You may pass the obstacle on either side.", "Puoi passare l'ostacolo da tutti e due i lati."); break;
    case "narrowGiveWay":
      // the road narrows: the oncoming car goes through first, you wait before the narrow part
      actors.push({ id: "o", kind: "car", color: "#ef4444", keys: [{ t: 0, x: 180, y: -80 }, { t: 2600, x: 180, y: 60 }, { t: 5000, x: 180, y: 300 }, { t: dur, x: L, y: 520 }] });
      you = [{ t: 0, x: R, y: 470 }, { t: 2400, x: R, y: 240, brake: true }, { t: 5200, x: R, y: 236, brake: false }, { t: 6400, x: 180, y: 120 }, { t: dur, x: R, y: -60 }];
      shows.push({ t: 2600, svg: bubble(R - 70, 250, T("wait", "aspetta"), "#ef4444") });
      say = T("Narrow passage: let the oncoming car through first.", "Strettoia: lascia passare prima chi arriva di fronte."); break;
    case "narrowPriority":
      // the road narrows: you go first, the oncoming car waits
      actors.push({ id: "o", kind: "car", color: "#94a3b8", keys: [{ t: 0, x: L, y: -60 }, { t: 2400, x: L, y: 70, brake: true }, { t: 5600, x: L, y: 74, brake: false }, { t: dur, x: L, y: 420 }] });
      you = [{ t: 0, x: R, y: 470 }, { t: 2600, x: R, y: 240 }, { t: 4200, x: 180, y: 150 }, { t: 5400, x: R, y: 40 }, { t: dur, x: R, y: -60 }];
      say = T("Narrow passage: you go first, the oncoming car waits.", "Strettoia: passi prima tu, chi arriva di fronte aspetta."); break;
    case "speedLimit": case "endLimit":
      you = [{ t: 0, x: R, y: 470 }, { t: 2400, x: R, y: 280, brake: a === "speedLimit" }, { t: 3400, x: R, y: 240, brake: false }, { t: dur, x: R, y: -20 }];
      shows.push({ t: 2600, svg: bubble(R - 78, 210, a === "speedLimit" ? `≤ ${P.value || "?"} km/h` : T("limit ends", "fine limite"), a === "speedLimit" ? "#ef4444" : "#22c55e") });
      say = a === "speedLimit" ? T(`Maximum speed: ${P.value || "as shown"} km/h.`, `Velocità massima: ${P.value || "indicata"} km/h.`) : T("The limit ends here.", "Qui il limite finisce."); break;
    case "park":
      you = [{ t: 0, x: R, y: 470 }, { t: 2600, x: R, y: 260, blink: "R" }, { t: 4600, x: 270, y: 170, brake: true }, { t: dur, x: 270, y: 166, blink: null }];
      say = T("You may park here.", "Qui puoi parcheggiare."); break;
    case "noParking": case "noStopping":
      you = [{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -40 }];
      shows.push({ t: 2600, svg: ghost([[R, 300], [270, 220], [270, 160]], false) });
      say = a === "noParking" ? T("No parking here (a short stop is allowed).", "Qui divieto di sosta (la fermata breve è permessa).") : T("No stopping at all here.", "Qui divieto di fermata."); break;
    default:
      you = [{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -60 }];
      if (P.hazard) shows.push({ t: 2400, svg: hazardIcon(P.hazard) });
      say = T("This sign gives you information.", "Questo segnale ti dà un'informazione.");
  }
  actors.push({ id: "you", kind: "you", keys: you });
  const steps = [
    { t: 0, text: T("Look at the sign.", "Guarda il segnale.") },
    { t: 2200, text: say },
    { t: dur - 1400, text: P.caption || say, it: P.it },
  ];
  const props = [{ type: "sign", x: SIGN.x, y: SIGN.y, img }];
  if (crossing) props.push({ type: "junction", y: 100, h: 60 });
  if (a === "stop") props.push({ type: "stopLine", y: 168 });
  if (a === "giveWay") props.push({ type: "stopLine", y: 168, dashed: true });
  if (a === "keepRight" || a === "keepLeft" || a === "eitherSide") props.push({ type: "island", x: 168, y: 90, w: 24, h: 90 });
  if (narrow) props.push({ type: "island", x: 104, y: 100, w: 42, h: 100 }, { type: "island", x: 214, y: 100, w: 42, h: 100 });
  if (a === "park" || a === "noParking" || a === "noStopping") props.push({ type: "patch", x: 250, y: 40, w: 40, h: 300, color: "#4b5262" });
  if ((a === "slow" || a === "info") && P.hazard) props.push({ type: "hazard", x: R, y: 70, emoji: P.hazard, t0: 2400 });
  if (P.distance) props.push({ type: "label", x: 270, y: 150, text: P.distance, t0: 2600 });
  const model = img && markingModel(img, dur);
  return { duration: dur, bg, actors, shows, steps, verdict: { ok }, world3d: model ? { ...model, inset: img } : { road: "twoWay", props } };
}

/** figure: the official picture of the question, big on the board, with the rule appearing line by line. */
export function figure(P, q) {
  const img = q && q.image;
  const lines = (P.lines && P.lines.length ? P.lines : [(q && q.explain && q.explain.short) || ""]).slice(0, 3);
  const per = 1600, dur = 1400 + lines.length * per + 1800;
  let bg = `<defs><linearGradient id="figBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#312e81"/></linearGradient></defs>
    <rect x="-200" y="-200" width="${W + 400}" height="820" fill="url(#figBg)"/>`;
  const shows = [{ t: 100, svg: img ? `<g class="popin"><rect x="70" y="16" width="220" height="220" rx="20" fill="#fff" filter="url(#softShadow)"/>
      <image href="${esc(img)}" x="80" y="26" width="200" height="200" preserveAspectRatio="xMidYMid meet"/></g>` : "" }];
  let y = 262;
  lines.forEach((ln, i) => {
    const words = String(ln).split(/\s+/), rows = []; let cur = "";
    for (const w of words) { if ((cur + " " + w).trim().length > 30) { rows.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
    if (cur) rows.push(cur);
    const h = rows.length * 20 + 18;
    shows.push({ t: 1200 + i * per, svg: `<g class="rc-line"><rect x="18" y="${y}" width="${W - 36}" height="${h}" rx="14" fill="rgba(255,255,255,.1)"/>` +
      rows.map((r, j) => `<text x="${W / 2}" y="${y + 23 + j * 20}" text-anchor="middle" font-size="15.5" font-weight="700" fill="#fff" ${FONT}>${esc(r)}</text>`).join("") + `</g>` });
    y += h + 8;
  });
  const steps = [{ t: 0, text: T("Look at the picture.", "Guarda la figura.") }, ...lines.map((ln, i) => ({ t: 1200 + i * per, text: ln }))];
  steps.push({ t: dur - 1400, text: P.caption || lines[lines.length - 1], it: P.it });
  const model = img && figureModel(img, dur);
  const world3d = model ? { ...model, inset: img, lines, per, start: 1200 } : { studio: "figure", img, lines, per, start: 1200 };
  return { duration: dur, bg, actors: [], shows, steps, verdict: P.verdict ? { ok: P.verdict !== "no" } : null, world3d };
}

/* ---------- 3D models of the official figures (the picture stays visible as an inset) ---------- */
// cars driving "up" (our direction) or "down" (the other direction) along a lane, spread along the road
function lane(id, x, dir, dur, phase, kind = "car", color) {
  const run = kind === "truck" ? 420 : 620;
  const keys = dir === "up" ? [{ t: 0, x, y: 560 - phase }, { t: dur, x, y: 560 - phase - run }]
    : [{ t: 0, x, y: -140 + phase }, { t: dur, x, y: -140 + phase + run }];
  return { id, kind, color, keys };
}
const PAL = ["#e11d48", "#f59e0b", "#10b981", "#64748b", "#8b5cf6", "#0ea5e9", "#f97316", "#94a3b8"];
function traffic(up, down, dur) {
  const a = [];
  up.forEach((x, i) => a.push(lane("u" + i, x, "up", dur, (i * 170 + 260) % 420, i === 0 ? "truck" : "car", PAL[i % 8])));
  down.forEach((x, i) => a.push(lane("d" + i, x, "down", dur, (i * 230 + 90) % 420, "car", PAL[(i + 3) % 8])));
  return a;
}
const lbl = (x, y, text, t0) => ({ type: "label", x, y, text, t0 });
// sign "A then B" pictures: crop each sign out of the picture
const CROP_A = [.248, .107, .758, .523], CROP_B = [.261, .581, .707, .945];

const DASHBOARD = ["ec7b0a5e3715", "7933bbf13cf3", "d858676ca464", "583c22d15e61", "14a02317e39b", "7f50dfe61c76", "36779cfc84d8", "7ddd91f6c3fc", "44cc0960ffd0"];
function figureModel(img, dur) {
  const has = h => img.includes(h);
  if (DASHBOARD.some(has)) return { studio: "dashboard", img };
  // carriageway with 2 lanes each way
  if (has("637129125cd2")) return { road: "twoLanesEach", cam: "fly", actors: traffic([292, 217], [67, 142], dur),
    props: [lbl(292, 150, T("normal driving", "marcia normale"), 1600), lbl(217, 60, T("overtaking", "sorpasso"), 2200), lbl(105, 20, T("other direction", "senso opposto"), 2800)] };
  // one carriageway with 3 lanes each way
  if (has("a55112f8aa2f")) return { road: "threeLanesEach", cam: "fly", actors: traffic([312, 262, 210], [48, 98, 150], dur),
    props: [lbl(312, 170, T("right: normal driving", "destra: marcia normale"), 1600), lbl(236, 60, T("centre + left: overtaking", "centro + sinistra: sorpasso"), 2200), lbl(98, 10, T("other direction", "senso opposto"), 2800)] };
  // 3 carriageways, 8 lanes
  if (has("6304fecd8e8f")) return { road: "threeCarriageways", cam: "fly", actors: traffic([330, 290, 236, 199], [30, 70, 124, 161], dur),
    props: [lbl(310, 160, T("one-way", "senso unico"), 1600), lbl(180, 60, T("centre: two-way", "centro: doppio senso"), 2200), lbl(50, 160, T("one-way", "senso unico"), 2800)] };
  // panels on the back of heavy vehicles
  const truck = panel => ({ road: "twoWay", line: "dashed", cam: "panel", props: [],
    actors: [{ id: "trk", kind: "truck", color: "#0f766e", panel, keys: [{ t: 0, x: 215, y: 230 }, { t: dur, x: 215, y: -330 }] },
      { id: "onc", kind: "car", color: "#e11d48", keys: [{ t: 0, x: 145, y: -260 }, { t: dur * .7, x: 145, y: 520 }] }] });
  if (has("87fd4191b69f")) return truck({ img, crop: [.05, .36, .95, .64], mode: "pair", w: .95, h: .3 });   // lorries > 3.5 t
  if (has("be0079414cd4")) return truck({ img, crop: [.04, .34, .96, .66], mode: "pair", w: .95, h: .33 });  // trailers > 3.5 t
  if (has("37cb85177810")) return truck({ img, crop: [.1, .2, .9, .8], mode: "single", w: .8, h: .6 });      // dangerous goods
  if (has("cebd5604de2f")) return truck({ img, crop: [.15, .15, .85, .85], mode: "load", w: .6, h: .6 });    // load sticking out
  if (has("da5d3e67a29e")) return truck({ img, mode: "single", w: .9, h: .9 });                             // works-vehicle panel (ch17)
  if (has("061decd67e69")) return truck({ img, mode: "single", w: 1.15, h: 1.15 });                     // speed-limit stickers (ch11)
  // sign A, then sign B further on
  if (has("8c3ca9b5032f") || has("2a0caaad4dff")) return { road: "twoWay", line: "dashed",
    props: [{ type: "sign", x: 268, y: 150, img, crop: CROP_A, t0: 200 }, lbl(300, 150, "A", 400),
      { type: "sign", x: 268, y: -70, img, crop: CROP_B, t0: 1800 }, lbl(300, -70, "B", 2000)],
    actors: [{ id: "you", kind: "you", keys: [{ t: 0, x: 215, y: 470 }, { t: dur, x: 215, y: -40 }] },
      { id: "onc", kind: "car", color: "#e11d48", keys: [{ t: 0, x: 145, y: -320 }, { t: dur, x: 145, y: 380 }] }] };
  // roundabout: warning triangle (B) first, then the blue roundabout disc (A) - ch04 q20287
  if (has("a546518b46a8")) return { road: "twoWay", line: "dashed",
    props: [{ type: "sign", x: 268, y: 150, img, crop: [.248, .534, .774, .964], t0: 200 }, lbl(300, 150, "B", 400),
      { type: "sign", x: 268, y: -70, img, crop: [.242, .109, .726, .505], t0: 1800 }, lbl(300, -70, "A", 2000)],
    actors: [{ id: "you", kind: "you", keys: [{ t: 0, x: 215, y: 470 }, { t: dur, x: 215, y: -40 }] },
      { id: "onc", kind: "car", color: "#e11d48", keys: [{ t: 0, x: 145, y: -320 }, { t: dur, x: 145, y: 380 }] }] };
  // keep at least 70 m from the vehicle ahead
  if (has("1be58ec74bcd")) return { road: "twoWay", line: "dashed",
    props: [{ type: "sign", x: 268, y: 60, img, t0: 200 }],
    gap: { a: "lead", b: "you", text: "≥ 70 m", t0: 2400 },
    actors: [{ id: "lead", kind: "truck", color: "#f59e0b", keys: [{ t: 0, x: 215, y: 130 }, { t: dur, x: 215, y: -420 }] },
      { id: "you", kind: "you", keys: [{ t: 0, x: 215, y: 420 }, { t: dur, x: 215, y: -130 }] }] };
  return markingModel(img, dur);
}

/* ---------- 3D models for road markings (chapter 6), traffic lights and police officers (chapter 7) ----------
   Facts only: the labels say what the marking / light / gesture IS, never whether a quiz statement is true. */
const youCar = (keys) => ({ id: "you", kind: "you", keys });
const slowTruck = (dur) => ({ id: "trk", kind: "truck", color: "#0f766e", keys: [{ t: 0, x: R, y: 230 }, { t: dur, x: R, y: -60 }] });
const tag = (x, y, en, it, t0 = 1600, big) => ({ type: "label", x, y, text: T(en, it), t0, big });
// you behind a slow truck: overtake (crossing the centre line) or stay behind
const passTruck = (dur) => youCar([{ t: 0, x: R, y: 470 }, { t: 1500, x: R, y: 330 }, { t: 2800, x: L, y: 230 }, { t: 4600, x: L, y: 40 }, { t: 6000, x: R, y: -60 }, { t: dur, x: R, y: -200 }]);
const followTruck = (dur) => youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: 330 }]);
// you drive up to a line at y and stop there
const stopAt = (y, dur, go) => youCar(go ? [{ t: 0, x: R, y: 470 }, { t: dur * .4, x: R, y: y + 40, brake: true }, { t: go, x: R, y: y + 36, brake: true }, { t: dur, x: R, y: -60 }]
  : [{ t: 0, x: R, y: 470 }, { t: dur * .45, x: R, y: y + 40, brake: true }, { t: dur, x: R, y: y + 36, brake: true }]);
const close = { cam: "orbit", orbitR: 17, orbitH: 8 };

function markingModel(img, dur) {
  const has = h => img.includes(h);
  // ---- chapter 6: lines ----
  if (has("f9768f4e7a23")) return { road: "twoWay", line: "dashed", actors: [slowTruck(dur), passTruck(dur)],
    props: [tag(175, 150, "dashed line: you may cross it", "striscia discontinua: si può superare", 2600)] };
  if (has("9452b305a54d")) return { road: "twoWay", line: "double", actors: [slowTruck(dur), followTruck(dur)],
    props: [tag(180, 160, "double solid line: never cross it", "doppia striscia continua: mai superarla")] };
  if (has("b43758bb9d85")) return { road: "twoWay", line: "solid", actors: [slowTruck(dur), followTruck(dur)],
    props: [tag(180, 160, "solid line: do not cross it", "striscia continua: non superarla")] };
  // mixed centre line: which line is on YOUR side decides (official figures, groups 4216 and 4217)
  if (has("2a8cb20b2ed1")) return { road: "twoWay", line: "mixedSolidMine", actors: [slowTruck(dur), followTruck(dur)],
    props: [tag(180, 170, "solid line on your side: you may not cross", "striscia continua dal tuo lato: non puoi superarla")] };
  if (has("baa788372c1b")) return { road: "twoWay", line: "mixed", actors: [slowTruck(dur), passTruck(dur)],
    props: [tag(175, 150, "dashed line on your side: you may cross both", "striscia discontinua dal tuo lato: puoi superarle", 2600)] };
  // markings before a level crossing: painted X and a solid centre line (group 4237)
  if (has("fc0562d273c7")) return { road: "twoWay", line: "solid", ...close, focusY: 150,
    props: [{ type: "rails", y: 60 }, { type: "roadText", x: R, y: 190, text: "X", size: 2.4 }, tag(180, 110, "level crossing ahead", "passaggio a livello più avanti", 1600)],
    actors: [stopAt(110, dur)] };
  if (has("4bd471ec7c86") || has("d12587ece8be")) return { road: "twoWay", props: [{ type: "junction", y: 70, h: 60 },
    tag(180, 100, "guide lines lead you through the junction", "strisce di guida: ti guidano nell'incrocio")], actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -100 }])], ...close, focusY: 120 };
  if (has("2b001af183ef")) return { road: "threeLanesEach", ...close, focusY: 170, orbitR: 24, orbitH: 12,
    props: [{ type: "junction", y: -40, h: 60 }, ...[[210, "left"], [262, "straight"], [312, "straightRight"]].flatMap(([x, d]) => [{ type: "arrow", x, y: 260, dir: d }, { type: "arrow", x, y: 120, dir: d }]),
      tag(262, 40, "arrows: choose your lane before the junction", "frecce: scegli la corsia prima dell'incrocio", 1400)],
    actors: [youCar([{ t: 0, x: 262, y: 480 }, { t: dur, x: 262, y: 10 }])] };
  if (has("475560f5610d") || has("327707c84ac3") || has("05769e683b8d")) {
    // lanes A, B, C before a junction; arrows as painted in the official figure (none in 475560f5610d)
    const dirs = has("327707c84ac3") ? ["left", "leftRight", "right"] : has("05769e683b8d") ? ["left", "straightLeft", "straightRight"] : null;
    const arrows = dirs ? [210, 262, 312].flatMap((x, i) => [{ type: "arrow", x, y: 250, dir: dirs[i] }, { type: "arrow", x, y: 120, dir: dirs[i] }]) : [];
    return { road: "threeLanesEach", ...close, focusY: 170, orbitR: 24, orbitH: 12,
    props: [{ type: "junction", y: -40, h: 60 }, ...arrows, tag(210, 200, "A", "A", 800), tag(262, 200, "B", "B", 1000), tag(312, 200, "C", "C", 1200)],
    actors: [youCar([{ t: 0, x: 262, y: 480 }, { t: dur, x: 262, y: 120 }])] };
  }
  // ---- chapter 6: areas, kerbs, writing ----
  if (has("80f7af983ab4")) return { road: "twoWay", ...close, focusY: 150,
    props: [{ type: "junction", y: 70, h: 60 }, { type: "hatch", x: 150, y: 132, w: 60, h: 40 }, tag(180, 150, "traffic island: do not drive or stop on it", "isola di traffico: non passarci e non sostare", 1800)],
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur * .6, x: R, y: 200 }, { t: dur, x: 420, y: 115, r: 90 }])] };
  if (has("af2602d8031b")) return { road: "twoWay", props: [{ type: "kerb", x: 252 }, tag(262, 170, "yellow and black kerb: no parking", "cordolo giallo e nero: divieto di sosta", 1800)],
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -100 }])], ...close, focusY: 170 };
  if (has("f7a805a7af03")) return { road: "twoWay", ...close, focusY: 220,
    props: [{ type: "patch", x: 250, y: 180, w: 40, h: 110, color: "#facc15" }, { type: "patch", x: 254, y: 184, w: 32, h: 102 }, { type: "roadText", x: 270, y: 235, text: "BUS", color: "#facc15", size: 1.6 }, { type: "busStop", x: 300, y: 235 },
      tag(270, 160, "bus stop: keep it free", "fermata bus: lasciala libera", 1800)],
    actors: [{ id: "bus", kind: "bus", keys: [{ t: 0, x: R, y: 520 }, { t: dur * .55, x: 270, y: 240, brake: true }, { t: dur, x: 270, y: 236, brake: true }] }] };
  if (has("eb927982dff8")) return { road: "twoWay", ...close, focusY: 170,
    props: [{ type: "zebra", y: 140 }, tag(180, 120, "pedestrian crossing: let people cross", "attraversamento pedonale: lascia passare i pedoni", 1800)],
    actors: [stopAt(174, dur, dur * .8), { id: "p0", kind: "ped", keys: [{ t: 0, x: 92, y: 157 }, { t: 900, x: 92, y: 157 }, { t: dur * .75, x: 268, y: 157 }] }] };
  if (has("af4cddba8bbf")) return { road: "twoWay", ...close, focusY: 150,
    props: [{ type: "junction", y: 70, h: 60 }, { type: "stopLine", y: 150 }, { type: "light", x: 262, y: 150, cycle: [["green", 0], ["amber", 1800], ["red", 3000]] }, tag(215, 175, "stop line: stop here", "linea di arresto: fermati qui", 3000)],
    actors: [stopAt(150, dur)] };
  if (has("235cb5fa6b81")) return { road: "twoWay", ...close, focusY: 190, props: [{ type: "roadText", x: R, y: 200, text: "50" }],
    actors: [youCar([{ t: 0, x: R, y: 480 }, { t: dur, x: R, y: -80 }])] };
  if (has("567251f9cff6")) return { road: "twoWay", ...close, focusY: 170,
    props: [{ type: "patch", x: 250, y: 90, w: 50, h: 150 }, tag(280, 120, "lay-by (piazzola)", "piazzola di sosta", 1600)],
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur * .6, x: 272, y: 170, brake: true, blink: "R" }, { t: dur, x: 272, y: 166, brake: true }])] };
  if (has("94f7f145ac94")) return { road: "motorway", props: [tag(296, 180, "A · emergency lane", "A · corsia di emergenza", 1400)],
    actors: [youCar([{ t: 0, x: 243, y: 470 }, { t: dur, x: 243, y: -100 }]), { id: "c1", kind: "car", color: "#e11d48", keys: [{ t: 0, x: 180, y: 300 }, { t: dur, x: 180, y: -300 }] }] };
  // ---- chapter 6: single pictures inside larger groups ----
  if (has("e21cc580f432")) return { road: "twoWay", ...close, focusY: 170,
    props: [120, 145, 170, 195, 220].map(y => ({ type: "stopLine", y })).concat([tag(215, 100, "slow-down stripes: moderate your speed", "strisce rallentatrici: modera la velocità", 1600)]),
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur * .4, x: R, y: 250, brake: true }, { t: dur, x: R, y: -60 }])] };
  if (has("fd5851d40abd")) return { road: "twoWay", ...close, focusY: 170,
    props: [{ type: "zebra", y: 120 }, { type: "patch", x: 248, y: 160, w: 6, h: 120, color: "#facc15" }, tag(180, 100, "pedestrian crossing ahead", "attraversamento pedonale più avanti", 1600)],
    actors: [stopAt(154, dur, dur * .8), { id: "p0", kind: "ped", keys: [{ t: 0, x: 92, y: 137 }, { t: 900, x: 92, y: 137 }, { t: dur * .75, x: 268, y: 137 }] }] };
  if (has("bcc89d4b3f24")) return { road: "twoWay", ...close, focusY: 170,
    props: Array.from({ length: 7 }, (_, i) => ({ type: "patch", x: 110 + i * 20, y: 150, w: 20, h: 14, color: i % 2 ? "#111827" : "#facc15" })).concat([tag(180, 120, "speed bump: slow down", "dosso artificiale: rallenta", 1600)]),
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur * .45, x: R, y: 200, brake: true }, { t: dur, x: R, y: -60 }])] };
  if (has("3c4dace65cc3")) return { road: "twoWay", ...close, focusY: 190,
    props: [{ type: "patch", x: 252, y: 140, w: 48, h: 110, color: "#facc15" }, { type: "patch", x: 256, y: 144, w: 40, h: 102 }, { type: "hatch", x: 256, y: 144, w: 40, h: 40 }, tag(276, 120, "yellow lines: a reserved area", "strisce gialle: area riservata", 1600)],
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -60 }])] };
  if (has("5069a289ee1d") || has("6922a0846a7e") || has("387f648b42cd")) {
    const what = has("5069a289ee1d") ? T("dashed edge line: a driveway beside the road", "striscia laterale discontinua: passo carrabile")
      : has("6922a0846a7e") ? T("dashed edge line: a lane beside the road", "striscia laterale discontinua: corsia a lato")
      : T("dashed edge line at the side of the road", "striscia laterale discontinua sul bordo");
    return { road: "twoWay", ...close, focusY: 180, props: [{ type: "patch", x: 250, y: 120, w: 46, h: 130 }, { type: "label", x: 272, y: 150, text: what, t0: 1600 }],
      actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -60 }])] };
  }
  if (has("5a7b8a62df93")) return { road: "twoWay", props: [{ type: "junction", y: 70, h: 60 },
    tag(180, 100, "guide lines lead you through the junction", "strisce di guida: ti guidano nell'incrocio")], actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -100 }])], ...close, focusY: 120 };
  if (has("913d1c94c874") || has("8255d00faa2a")) return { road: "twoWay", ...close, focusY: 150,
    props: [{ type: "junction", y: 70, h: 60 }, { type: "stopLine", y: 150 }, tag(215, 175, "stop line: stop here", "linea di arresto: fermati qui", 2600)],
    actors: [stopAt(150, dur, dur * .8)] };
  // ---- chapter 13: reversing out of an angled parking space (vehicles B, E, S) ----
  if (has("40d3c6c83dd9")) return { road: "twoWay", ...close, focusY: 190, orbitR: 19, orbitH: 11,
    props: [{ type: "patch", x: 252, y: 90, w: 56, h: 190, color: "#4b5262" }, tag(290, 238, "B", "B", 400), tag(290, 178, "E", "E", 500), tag(290, 128, "S", "S", 600),
      tag(215, 90, "reversing out: give way to traffic", "in retromarcia: dai la precedenza", 2400)],
    actors: [{ id: "B", kind: "car", color: "#2563eb", keys: [{ t: 0, x: 280, y: 240, r: -35 }] }, { id: "E", kind: "car", color: "#dc2626", keys: [{ t: 0, x: 280, y: 180, r: -35 }] },
      { id: "S", kind: "car", color: "#16a34a", keys: [{ t: 0, x: 280, y: 130, r: -35, blink: "L" }, { t: dur * .55, x: 280, y: 130, r: -35, blink: "L" }, { t: dur * .85, x: 238, y: 160, r: -12, blink: "L" }, { t: dur, x: 226, y: 168, r: -5, blink: "L" }] },
      { id: "c", kind: "car", color: "#f59e0b", keys: [{ t: 0, x: R, y: 480 }, { t: dur * .5, x: R, y: 40 }, { t: dur, x: R, y: -300 }] }] };
  // ---- chapter 13: one carriageway with 3 lanes, two-way (A yours, B shared centre, C oncoming) ----
  if (has("dff3b1affd47")) return { road: "threeLane", ...close, focusY: 180, orbitR: 22, orbitH: 12,
    props: [tag(253, 230, "A", "A", 600), tag(180, 230, "B", "B", 800), tag(106, 230, "C", "C", 1000), tag(180, 120, "centre lane B: shared, for overtaking", "corsia centrale B: comune, per il sorpasso", 2200)],
    actors: [{ id: "trk", kind: "truck", color: "#0f766e", keys: [{ t: 0, x: 253, y: 230 }, { t: dur, x: 253, y: -40 }] },
      youCar([{ t: 0, x: 253, y: 470 }, { t: 1600, x: 253, y: 360 }, { t: 3000, x: 180, y: 250 }, { t: 5200, x: 180, y: 40 }, { t: 6400, x: 253, y: -60 }, { t: dur, x: 253, y: -200 }]),
      { id: "o", kind: "car", color: "#e11d48", keys: [{ t: 0, x: 106, y: -300 }, { t: dur, x: 106, y: 520 }] }] };
  // ---- chapter 13: more road diagrams ----
  if (has("e00e36976523") || has("a688b13a965a")) return { road: "dual", cam: "orbit", focusY: 170, orbitR: 26, orbitH: 15,
    props: has("a688b13a965a") ? [tag(297, 210, "A", "A", 600), tag(225, 210, "B", "B", 800), tag(63, 150, "A", "A", 600), tag(135, 150, "B", "B", 800)]
      : [tag(260, 120, "keep to the carriageway on your right", "percorri la carreggiata alla tua destra", 1800)],
    actors: [youCar([{ t: 0, x: 297, y: 470 }, { t: dur, x: 297, y: -80 }]), { id: "c1", kind: "car", color: "#f59e0b", keys: [{ t: 0, x: 225, y: 300 }, { t: dur, x: 225, y: -260 }] },
      { id: "o1", kind: "car", color: "#e11d48", keys: [{ t: 0, x: 63, y: -300 }, { t: dur, x: 63, y: 520 }] }] };
  if (has("7bdda2428f96") || has("8cb18c0726c0") || has("fc3a97abfe3d")) {
    const round = has("fc3a97abfe3d");   // with roundabout signs you go round the centre of the junction
    return { road: "twoWay", cam: "orbit", focusY: 110, orbitR: 16, orbitH: 13,
      props: [{ type: "junction", y: 70, h: 60 }, { type: "patch", x: 176, y: 96, w: 8, h: 8, color: "#f8fafc" },
        tag(180, 60, round ? "roundabout signs: go round the centre" : "left turn: keep the centre on your right", round ? "segnali di rotatoria: gira intorno al centro" : "svolta a sinistra: centro dell'incrocio alla tua destra", 2000)],
      actors: [youCar(round
        ? [{ t: 0, x: R, y: 470, r: 0 }, { t: dur * .4, x: R, y: 150, r: 0, blink: "L" }, { t: dur * .6, x: 200, y: 78, r: -40, blink: "L" }, { t: dur * .8, x: 140, y: 90, r: -100 }, { t: dur, x: -60, y: 112, r: -90, blink: null }]
        : [{ t: 0, x: R, y: 470, r: 0 }, { t: dur * .45, x: R, y: 150, r: 0, blink: "L" }, { t: dur * .7, x: 172, y: 116, r: -60, blink: "L" }, { t: dur, x: -60, y: 112, r: -90, blink: null }])] };
  }
  if (has("5da3cff18ce4")) return { road: "twoWay", feature: "hill", line: "mixed", props: [tag(R, 120, "on a hump: keep to the right", "sul dosso: tieniti a destra", 1800)],
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -120 }]), { id: "o", kind: "car", color: "#e11d48", keys: [{ t: 0, x: L, y: -320 }, { t: dur, x: L, y: 480 }] }] };
  if (has("a95b434389fb")) return { road: "twoLanesEach", cam: "orbit", focusY: 180, orbitR: 24, orbitH: 13,
    props: [{ type: "patch", x: 18, y: -320, w: 14, h: 880, color: "#facc15" }, { type: "patch", x: 328, y: -320, w: 14, h: 880, color: "#facc15" }, tag(320, 150, "cycle lane: bicycles only", "pista ciclabile: solo biciclette", 1800)],
    actors: [{ id: "bk", kind: "bike", keys: [{ t: 0, x: 336, y: 360 }, { t: dur, x: 336, y: 120 }] }, youCar([{ t: 0, x: 292, y: 470 }, { t: dur, x: 292, y: -60 }])] };
  if (has("ace26137a49a") || has("f4ce89521572")) return { road: "threeLanesEach", ...close, focusY: 170, orbitR: 24, orbitH: 13,
    props: [{ type: "junction", y: -40, h: 60 }, { type: "stopLine", y: 22 }, tag(262, 120, "solid lane lines: no lane change here", "strisce continue: qui non si cambia corsia", 1800)],
    actors: [youCar([{ t: 0, x: 262, y: 480 }, { t: dur, x: 262, y: 60, brake: true }])] };
  // ---- chapter 7: traffic lights ----
  if (has("9ce1d0d0b1d2")) return { road: "twoWay", ...close, focusY: 150,
    props: [{ type: "junction", y: 70, h: 60 }, { type: "stopLine", y: 150 }, { type: "light", x: 262, y: 150, cycle: [["green", 0], ["amber", 2200], ["red", 3500]], scale: 1.3 },
      tag(215, 175, "red: stop at the line", "rosso: fermati alla linea", 3500)],
    actors: [stopAt(150, dur), { id: "x", kind: "car", color: "#e11d48", keys: [{ t: 0, x: -60, y: 115, r: 90 }, { t: 4200, x: -60, y: 115, r: 90 }, { t: dur, x: 420, y: 115, r: 90 }] }] };
  if (has("e1cf603fd1bc") || has("db2b7fa24f44") || has("80179c5962ca")) return { road: "twoWay", ...close, focusY: 150,
    props: [{ type: "junction", y: 70, h: 60 }, { type: "light", x: 262, y: 150, color: "green", scale: 1.3 },
      tag(180, 175, has("db2b7fa24f44") ? "green wave: keep the speed shown" : has("80179c5962ca") ? "lights for reversible lanes" : "lane lights with arrows", has("db2b7fa24f44") ? "onda verde: tieni la velocità indicata" : has("80179c5962ca") ? "semafori per corsie reversibili" : "semafori di corsia con frecce", 1600)],
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -80 }])] };
  if (has("af67ba8e23b2")) return { road: "twoWay", ...close, focusY: 160,
    props: [{ type: "rails", y: 110 }, { type: "light", x: 262, y: 160, kind: "pair", color: "red", flash: true, scale: 1.3 }, tag(215, 190, "flashing red: stop, a train is coming", "rosso lampeggiante: fermati, arriva il treno", 2600)],
    actors: [stopAt(160, dur)] };
  if (has("f826d5e22eba")) return { road: "twoWay", ...close, focusY: 150,
    props: [{ type: "junction", y: 70, h: 60 }, { type: "light", x: 262, y: 150, color: "green", scale: 1.3 }, tag(180, 175, "a light for buses and trams", "semaforo per bus e tram", 1600)],
    actors: [{ id: "bus", kind: "bus", keys: [{ t: 0, x: R, y: 520 }, { t: dur, x: R, y: -120 }] }] };
  if (has("2129f648b286")) return { road: "twoWay", ...close, focusY: 170,
    props: [{ type: "zebra", y: 140 }, { type: "light", x: 98, y: 130, kind: "ped", cycle: [["red", 0], ["green", 2000]], scale: 1.1 }, tag(180, 120, "a light for pedestrians", "semaforo pedonale", 1600)],
    actors: [stopAt(174, dur), { id: "p0", kind: "ped", keys: [{ t: 0, x: 88, y: 157 }, { t: 2200, x: 88, y: 157 }, { t: dur, x: 268, y: 157 }] }, { id: "p1", kind: "ped", color: "#22c55e", keys: [{ t: 0, x: 76, y: 165 }, { t: 2600, x: 76, y: 165 }, { t: dur, x: 250, y: 165 }] }] };
  if (has("c3c957780ed4")) return { road: "twoWay", ...close, focusY: 170,
    props: [{ type: "patch", x: 110, y: 140, w: 140, h: 34, color: "#b91c1c" }, { type: "light", x: 98, y: 130, kind: "ped", cycle: [["red", 0], ["green", 2000]], scale: 1.1 }, tag(180, 120, "a light for cyclists", "semaforo per biciclette", 1600)],
    actors: [stopAt(178, dur), { id: "b0", kind: "bike", keys: [{ t: 0, x: 80, y: 157, r: 90 }, { t: 2200, x: 80, y: 157, r: 90 }, { t: dur, x: 300, y: 157, r: 90 }] }] };
  if (has("72f9b60b915b")) return { road: "twoWay", ...close, focusY: 150,
    props: [{ type: "junction", y: 70, h: 60 }, { type: "light", x: 262, y: 150, kind: "amber", color: "amber", flash: true, scale: 1.3 }, tag(180, 175, "flashing yellow: slow down, take care", "giallo lampeggiante: rallenta, fai attenzione", 1600)],
    actors: [youCar([{ t: 0, x: R, y: 470 }, { t: dur * .45, x: R, y: 220, brake: true }, { t: dur, x: R, y: -60 }])] };
  // ---- chapter 7: police officer ----
  const pose = has("5dec4c1e652c") ? "front" : has("1f358b9293d9") ? "profile" : has("125f03bc48cb") ? "raised" : has("d610e27fa096") ? "angle" : null;
  if (pose) {
    const go = pose === "profile";
    const text = { front: T("arms open, facing you: STOP (like red)", "braccia aperte verso di te: ALT (come il rosso)"),
      profile: T("side view, arms open: you may GO (like green)", "di profilo, braccia aperte: puoi PASSARE (come il verde)"),
      raised: T("one arm raised: like yellow, clear the junction", "un braccio alzato: come il giallo, libera l'incrocio"),
      angle: T("the officer directs the traffic", "il vigile dirige il traffico") }[pose];
    return { road: "twoWay", cam: "orbit", orbitR: 14, orbitH: 6, focusY: 120,
      props: [{ type: "junction", y: 70, h: 60 }, { type: "officer", x: 180, y: 100, pose }, { type: "label", x: 180, y: 60, text, t0: 1800 }],
      actors: [go ? youCar([{ t: 0, x: R, y: 470 }, { t: dur, x: R, y: -80 }]) : stopAt(150, dur)] };
  }
  return null;
}


/** roadparts: a road drawing; the named part lights up. */
const PARTS = {
  carreggiata: { box: [110, -20, 140, 460], en: "carriageway: where vehicles drive", it: "carreggiata: dove passano i veicoli" },
  corsia: { box: [182, -20, 66, 460], en: "lane: room for one line of vehicles", it: "corsia: spazio per una fila di veicoli" },
  banchina: { box: [250, -20, 22, 460], en: "verge: the strip beside the carriageway", it: "banchina: striscia accanto alla carreggiata" },
  marciapiede: { box: [276, -20, 40, 460], en: "pavement: for pedestrians", it: "marciapiede: per i pedoni" },
  pistaCiclabile: { box: [76, -20, 28, 460], en: "cycle lane: for bicycles", it: "pista ciclabile: per le biciclette" },
  spartitraffico: { box: [172, -20, 16, 460], en: "central reservation: separates the two directions", it: "spartitraffico: separa i due sensi" },
  passaggioPedonale: { box: [110, 250, 140, 40], en: "pedestrian crossing", it: "passaggio pedonale" },
  intersezione: { box: [110, 120, 140, 70], en: "junction: where roads meet", it: "intersezione: dove le strade si incontrano" },
  corsiaEmergenza: { box: [250, -20, 22, 460], en: "emergency lane / hard shoulder", it: "corsia di emergenza" },
};
export function roadparts(P, q) {
  const part = PARTS[P.part] || PARTS.carreggiata;
  const dur = 6200;
  let bg = lib.grass() + `<rect x="270" y="-200" width="60" height="820" fill="#d6d3cc"/><rect x="70" y="-200" width="38" height="820" fill="#c2410c" opacity=".55"/>` +
    lib.road(110, 140) + `<rect x="172" y="-200" width="16" height="820" fill="#7cb36b" stroke="#fff" stroke-width="2"/>` + lib.line(149) + lib.line(215) +
    `<rect x="-200" y="120" width="${W + 400}" height="70" fill="#3d4350"/>` +
    Array.from({ length: 8 }, (_, i) => `<rect x="${114 + i * 17}" y="252" width="9" height="36" fill="#fff"/>`).join("");
  const [x, y, w, h] = part.box;
  const shows = [{ t: 1200, svg: `<g data-focus="${x + w / 2},${Math.max(80, Math.min(340, y + h / 2))}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#facc15" opacity=".35" class="pulse-soft"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="#facc15" stroke-width="4"/></g>` },
    { t: 1800, svg: bubble(W / 2, 395, T(part.en, part.it).split(":")[0], "#facc15") }];
  const steps = [{ t: 0, text: T("Look at the parts of the road.", "Guarda le parti della strada.") },
    { t: 1200, text: T(part.en, part.it) },
    { t: dur - 1400, text: P.caption || T(part.en, part.it), it: P.it }];
  return { duration: dur, camera: "wide", bg, actors: [], shows, steps, verdict: P.verdict ? { ok: P.verdict !== "no" } : null,
    world3d: { studio: "roadparts", part: P.part in PARTS ? P.part : "carreggiata", label: T(part.en, part.it).split(":")[0] } };
}
