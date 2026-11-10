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
 *           noTurnLeft | noTurnRight | noUTurn | speedLimit | endLimit | park | noParking | noStopping | info
 * P.hazard: emoji shown ahead (danger signs), P.distance: e.g. "150 m", P.value: number for speed limits
 */
export function sign(P, q) {
  const a = P.action || "info";
  const img = q && q.image;
  const dur = 8800;
  const crossing = ["stop", "giveWay", "priority", "turnLeft", "turnRight", "straight", "noTurnLeft", "noTurnRight", "noUTurn", "noEntry"].includes(a);
  let bg = road2(a === "noOvertake" ? "dashed" : "dashed");
  if (crossing) bg += junction(100, 60);
  if (a === "stop") bg += stopLine(168, false) + label(R, 186, "STOP", { size: 13 });
  if (a === "giveWay") bg += stopLine(168, true) + `<path d="M196 182 L204 196 L212 182 Z M218 182 L226 196 L234 182 Z" fill="#fff"/>`;
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
  return { duration: dur, bg, actors, shows, steps, verdict: { ok } };
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
  return { duration: dur, bg, actors: [], shows, steps, verdict: P.verdict ? { ok: P.verdict !== "no" } : null };
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
  return { duration: dur, camera: "wide", bg, actors: [], shows, steps, verdict: P.verdict ? { ok: P.verdict !== "no" } : null };
}
