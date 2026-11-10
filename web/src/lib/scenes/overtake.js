// Overtaking scene templates (chapter 15). Each returns a scene for the engine.
// Texts use T(english, italian): the language is chosen by scenes/index.js before building.
import { lib, W, H, T } from "./engine.js";

const { label, ghost, pulse, bubble } = lib;
const LANE = { L: 145, R: 215 };           // two-way road: L = oncoming lane, R = our lane

// ---------- roads ----------
function roadCfg(kind = "twoWay", line = "dashed") {
  let bg = lib.grass();
  if (kind === "oneWay") {
    bg += lib.road(110, 140) + lib.line(180, line) + lib.arrow(145, 380) + lib.arrow(215, 380) + lib.sign(282, 300, "oneway") +
      label(300, 412, T("one-way", "senso unico"), { size: 11, anchor: "middle" });
    return { bg, right: 215, left: 145, opp: null };
  }
  if (kind === "dual" || kind === "twoLanesEach") {
    bg += lib.road(30, 300);
    if (kind === "dual") bg += `<rect x="168" y="-20" width="24" height="${H + 40}" fill="#6faa66"/><line x1="174" y1="-20" x2="174" y2="${H + 20}" stroke="#bbb" stroke-width="2"/><line x1="186" y1="-20" x2="186" y2="${H + 20}" stroke="#bbb" stroke-width="2"/>` +
      label(180, 412, T("separate carriageways", "carreggiate separate"), { size: 10 });
    else bg += lib.line(180, "double");
    bg += lib.line(105, "dashed") + lib.line(255, "dashed") + lib.arrow(80, 60, "down") + lib.arrow(130, 60, "down") + lib.arrow(225, 390) + lib.arrow(290, 390);
    return { bg, right: 290, left: 222, opp: 130 };
  }
  bg += lib.road(110, 140) + lib.line(180, line) + lib.arrow(215, 395) + lib.arrow(145, 30, "down");
  return { bg, right: LANE.R, left: LANE.L, opp: LANE.L };
}

// hazard / feature overlays drawn on the background
const FEATURE = {
  curve: (r) => `<path d="M60 150 Q120 60 40 -10" stroke="#1d3a2e" stroke-width="0" fill="none"/>
      <g fill="#4f9a5c">${[[60, 40], [95, 70], [130, 52], [160, 95], [120, 110], [80, 120], [175, 40]].map(([x, y]) => `<circle cx="${x + (r.left - 145)}" cy="${y}" r="26"/>`).join("")}</g>
      <path d="M${r.left - 10} 150 Q${r.left - 10} 90 ${r.left - 80} 60" stroke="#ffd38a" stroke-width="4" fill="none" stroke-dasharray="6 6"/>
      ${lib.sign(300, 210, "curve")}${label(300, 250, "curva", { size: 12, italic: true, color: "#ffd38a" })}`,
  hill: (r) => `<defs><linearGradient id="crest" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
      <rect x="0" y="40" width="${W}" height="140" fill="url(#crest)"/>
      <rect x="0" y="-20" width="${W}" height="70" fill="#0d1a15" opacity=".72"/>
      ${label(r.left, 30, "?", { size: 26, color: "#ffd38a" })}${label(r.right, 30, "?", { size: 26, color: "#ffd38a" })}
      ${lib.sign(310, 210, "hill")}${label(310, 250, "dosso", { size: 12, italic: true, color: "#ffd38a" })}`,
  hillDown: () => `<defs><linearGradient id="crest2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient></defs>
      <rect x="0" y="300" width="${W}" height="120" fill="url(#crest2)"/>${label(310, 330, "dosso", { size: 12, italic: true, color: "#ffd38a" })}${label(310, 346, T("(behind you)", "(dietro di te)"), { size: 10 })}
      ${label(60, 120, T("downhill:", "discesa:"), { size: 11 })}${label(60, 135, T("clear view", "si vede bene"), { size: 11 })}`,
  fog: () => lib.fog(-20, 260) + label(60, 60, T("fog", "nebbia"), { size: 13, color: "#2a3a35" }),
  rails: (y = 150) => `<rect x="-200" y="${y}" width="${W + 400}" height="26" fill="#6b5b4b"/>${[0, 1].map(i => `<line x1="-200" y1="${y + 6 + i * 14}" x2="${W + 200}" y2="${y + 6 + i * 14}" stroke="#aaa" stroke-width="3"/>`).join("")}
      ${Array.from({ length: 38 }, (_, i) => `<rect x="${i * 20 - 196}" y="${y + 2}" width="6" height="22" fill="#6b5844"/>`).join("")}`,
  zebra: (y = 140, x0 = 110, w = 140) => Array.from({ length: Math.floor(w / 16) }, (_, i) => `<rect x="${x0 + 4 + i * 16}" y="${y}" width="9" height="34" fill="#f4f1e6"/>`).join(""),
  junction: (y = 130, h = 60) => `<rect x="-200" y="${y}" width="${W + 400}" height="${h}" fill="#3d4350"/>`,
};

// ---------- standard choreography: a full overtake on the left ----------
function overtakeKeys(fromX, toX, o = {}) {
  const slow = o.slowY || [250, 165];
  const you = [
    { t: 0, x: fromX, y: 400, blink: null },
    { t: 600, x: fromX, y: 382, blink: o.noSignal ? null : "L" },
    { t: 1300, x: fromX, y: 345 },
    { t: 2500, x: toX, y: 290, blink: null },
    { t: 4300, x: toX, y: 150, blink: o.noSignal ? null : "R" },
    { t: 4700, x: toX, y: 118 },
    { t: 5900, x: fromX, y: 30, blink: null },
    { t: 7600, x: fromX, y: -80 },
  ];
  return { you, slow: [{ t: 0, x: fromX, y: slow[0] }, { t: 7600, x: fromX, y: slow[1] }] };
}

function finish(steps, P, dur) {
  steps.push({ t: dur - 1400, text: P.caption || "", it: P.it });
  return steps;
}

// ---------- templates ----------
export function basic(P) {
  const r = roadCfg("twoWay");
  const dur = 9000;
  const bad = P.bad, focus = P.focus || "checks";
  const k = overtakeKeys(r.right, r.left, { noSignal: bad === "noSignal" });
  const shows = [];
  const steps = [{ t: 0, text: T("You are behind a slow truck.", "Sei dietro a un camion lento.") }];
  const actors = [
    { id: "slow", kind: "truck", keys: k.slow },
    { id: "you", kind: "you", keys: k.you },
  ];

  if (focus === "checks") {
    shows.push({ t: 200, t1: 1400, svg: bubble(r.left, 120, T("road ahead free?", "strada libera?")) + bubble(r.right + 50, 400, T("mirror: anyone passing?", "specchietto: nessuno sorpassa?")) });
    steps.push({ t: 200, text: T("First look: is the road ahead free and long enough? Is anyone behind you already overtaking?", "Prima guarda: la strada davanti è libera e abbastanza lunga? Qualcuno dietro sta già sorpassando?") });
  }
  if (focus === "distance") {
    shows.push({ t: 0, t1: 1300, svg: `<line x1="${r.right + 26}" y1="300" x2="${r.right + 26}" y2="372" stroke="#7be0a0" stroke-width="3"/>` + label(r.right + 32, 340, T("safe gap", "distanza"), { size: 11, anchor: "start", color: "#7be0a0" }) });
    steps.push({ t: 200, text: T("Stay a safe distance behind the truck, even just before you overtake.", "Resta a distanza di sicurezza dal camion, anche prima del sorpasso.") });
  }
  steps.push({ t: 650, text: bad === "noSignal" ? T("No indicator! The others can't know what you will do.", "Niente freccia! Gli altri non sanno cosa farai.") : T("Turn on the LEFT indicator before you move out.", "Metti la freccia a SINISTRA prima di spostarti.") });
  if (focus === "signal" || bad === "noSignal") shows.push({ t: 650, t1: 2400, svg: pulse(r.right, 380, 30, bad === "noSignal" ? "#ff6b5e" : "#ffd38a") });
  if (bad === "horn") {
    shows.push({ t: 700, t1: 2300, svg: bubble(r.right - 40, 330, "BEEP!", "#ff6b5e") });
    steps.push({ t: 700, text: T("You do NOT have to use the horn to overtake.", "Per sorpassare NON devi suonare il clacson.") });
  }
  steps.push({ t: 2500, text: T("Move out and pass, leaving plenty of space at the side.", "Spostati a sinistra e supera, lasciando molto spazio di lato.") });
  if (focus === "gap") shows.push({ t: 2500, t1: 4400, svg: `<line x1="${r.left + 16}" y1="230" x2="${r.right - 19}" y2="230" stroke="#7be0a0" stroke-width="3" marker-end="none"/>` + label(180, 220, T("side space", "spazio laterale"), { size: 11, color: "#7be0a0" }) });
  if (focus === "speed") {
    shows.push({ t: 2500, t1: 4600, svg: bubble(r.left - 70, 200, T("speed limit still applies", "il limite vale sempre")) });
    steps.push({ t: 2600, text: T("Go a bit faster than the truck, but never over the speed limit.", "Vai un po' più veloce del camion, ma mai oltre il limite di velocità.") });
  }

  if (bad === "cutIn") {
    // return too early: the truck must brake
    actors[1].keys = [
      { t: 0, x: r.right, y: 400 }, { t: 600, x: r.right, y: 382, blink: "L" }, { t: 1300, x: r.right, y: 345 },
      { t: 2500, x: r.left, y: 290, blink: null }, { t: 3600, x: r.left, y: 190, blink: "R" }, { t: 4300, x: r.right, y: 140, blink: null }, { t: 7600, x: r.right, y: -60 },
    ];
    actors[0].keys = [{ t: 0, x: r.right, y: 250 }, { t: 4100, x: r.right, y: 190, brake: false }, { t: 4200, x: r.right, y: 188, brake: true }, { t: 6000, x: r.right, y: 190 }, { t: 7600, x: r.right, y: 170, brake: false }];
    shows.push({ t: 4200, t1: 6500, svg: pulse(r.right, 165, 34, "#ff6b5e") + bubble(r.right + 20, 250, T("brakes!", "frena!"), "#ff6b5e") });
    steps.push({ t: 3700, text: T("You moved back too early. The truck must brake hard. That is dangerous.", "Sei rientrato troppo presto. Il camion deve frenare forte. È pericoloso.") });
  } else if (bad === "stayLeft") {
    actors[1].keys = k.you.slice(0, 5).concat([{ t: 7600, x: r.left, y: -80, blink: null }]);
    actors.push({ id: "back", kind: "car", color: "#8e6bbf", keys: [{ t: 0, x: r.left, y: -80 }, { t: 3000, x: r.left, y: -80 }, { t: 5200, x: r.left, y: 60, brake: true }, { t: 7600, x: r.left, y: 120 }] });
    shows.push({ t: 4800, svg: bubble(r.left, 200, T("still on the left!", "ancora a sinistra!"), "#ff6b5e") });
    steps.push({ t: 4600, text: T("You stay on the left after passing. You block the road. That is dangerous.", "Resti a sinistra dopo il sorpasso. Blocchi la strada. È pericoloso.") });
  } else {
    steps.push({ t: 4300, text: T("Look in the mirror. Can you see the whole truck? Then signal RIGHT.", "Guarda nello specchietto. Vedi tutto il camion? Allora metti la freccia a DESTRA.") });
    if (focus === "mirror" || focus === "return") shows.push({ t: 4300, t1: 5900, svg: bubble(r.left - 60, 150, T("mirror check", "specchietto")) });
    steps.push({ t: 5900, text: T("Move back to the right, leaving the truck enough space.", "Rientra a destra, lasciando abbastanza spazio al camion.") });
  }
  const ok = P.verdict !== "no";
  return { duration: dur, bg: r.bg, actors, shows, steps: finish(steps, P, dur), verdict: { ok }, world3d: { road: "twoWay", line: "dashed" } };
}

export function blocked(P) {
  const hz = P.hazard || "oncoming";
  const r = roadCfg("twoWay", hz === "solidLine" ? "solid" : hz === "doubleSolid" ? "double" : "dashed");
  const dur = 7000;
  let bg = r.bg;
  const shows = [], actors = [];
  let slowKind = "truck", slowY = [250, 210], youY = [400, 330], hazardText = "";
  const g = ghost([[r.right, 300], [r.left, 230], [r.left, 120], [r.right, 60]], false);
  let ghostPath = g;

  switch (hz) {
    case "curve": bg += FEATURE.curve(r); hazardText = T("A bend. You cannot see who is coming the other way.", "Una curva. Non vedi chi arriva dall'altra parte.");
      actors.push({ id: "onc", kind: "car", color: "#e55", keys: [{ t: 0, x: r.left, y: -60 }, { t: 2800, x: r.left, y: -60 }, { t: 4800, x: r.left, y: 140 }] }); break;
    case "hill": bg += FEATURE.hill(r); hazardText = T("The top of a hill (dosso). You cannot see what is behind it.", "Un dosso. Non vedi cosa c'è dietro.");
      actors.push({ id: "onc", kind: "car", color: "#e55", keys: [{ t: 0, x: r.left, y: -60 }, { t: 2800, x: r.left, y: -60 }, { t: 4800, x: r.left, y: 150 }] }); break;
    case "fog": bg += FEATURE.fog(); hazardText = T("Fog. You cannot see far enough to overtake safely.", "Nebbia. Non vedi abbastanza lontano per sorpassare in sicurezza.");
      actors.push({ id: "onc", kind: "car", color: "#e55", keys: [{ t: 0, x: r.left, y: -60 }, { t: 3000, x: r.left, y: -60 }, { t: 5200, x: r.left, y: 130 }] }); break;
    case "solidLine": case "doubleSolid": hazardText = T("A solid white line. You must never cross it.", "Una striscia bianca continua. Non devi mai superarla.");
      shows.push({ t: 2600, svg: pulse(180, 200, 36, "#ff6b5e") }); break;
    case "oncoming": hazardText = T("A car is coming towards you. There is no room.", "Arriva un'auto dall'altra parte. Non c'è spazio.");
      actors.push({ id: "onc", kind: "car", color: "#e55", keys: [{ t: 0, x: r.left, y: -60 }, { t: 5000, x: r.left, y: 200 }] }); break;
    case "levelCrossing": bg += FEATURE.rails(140) + lib.sign(300, 230, "train") + label(300, 268, "passaggio a livello", { size: 10, italic: true, color: "#ffd38a" });
      slowY = [240, 205]; youY = [400, 300]; hazardText = T("A level crossing. Don't pass the queue using the other side of the road.", "Un passaggio a livello. Non superare la fila usando l'altra metà della strada.");
      actors.push({ id: "q2", kind: "car", color: "#9aa", keys: [{ t: 0, x: r.right, y: 310 }, { t: 1500, x: r.right, y: 295, brake: true }] });
      youY = [420, 360]; ghostPath = ghost([[r.right, 340], [r.left, 280], [r.left, 120]], false); break;
    case "trafficLightQueue": bg += lib.trafficLight(275, 120, "red");
      slowKind = "car"; slowY = [200, 175]; hazardText = T("Cars wait at a red light. Don't pass them on the other side of the road.", "Auto ferme al semaforo rosso. Non superarle dall'altra parte della strada.");
      actors.push({ id: "q2", kind: "car", color: "#9aa", keys: [{ t: 0, x: r.right, y: 260 }, { t: 1400, x: r.right, y: 240, brake: true }] });
      youY = [420, 320]; ghostPath = ghost([[r.right, 300], [r.left, 250], [r.left, 120]], false); break;
    case "queue": slowKind = "car"; slowY = [190, 170]; hazardText = T("A slow queue (traffic jam). Don't pass it on the other side of the road.", "Una fila lenta (traffico). Non superarla dall'altra parte della strada.");
      actors.push({ id: "q2", kind: "car", color: "#9aa", keys: [{ t: 0, x: r.right, y: 250 }, { t: 7000, x: r.right, y: 230, brake: true }] });
      actors.push({ id: "q3", kind: "car", color: "#a98", keys: [{ t: 0, x: r.right, y: 130 }, { t: 7000, x: r.right, y: 110 }] });
      youY = [420, 310]; ghostPath = ghost([[r.right, 290], [r.left, 240], [r.left, 80]], false); break;
    case "pedCrossing": bg += FEATURE.zebra(120);
      slowKind = "car"; slowY = [215, 190]; hazardText = T("The car stopped for a pedestrian. Never pass it: you could hit the person.", "L'auto si è fermata per un pedone. Non superarla mai: potresti investirlo.");
      actors.push({ id: "ped", kind: "ped", keys: [{ t: 0, x: 95, y: 137 }, { t: 1500, x: 95, y: 137 }, { t: 6500, x: 265, y: 137 }] });
      ghostPath = ghost([[r.right, 300], [r.left, 240], [r.left, 110]], false);
      shows.push({ t: 2500, svg: pulse(150, 137, 26, "#ff6b5e") }); break;
    case "accelLane":
      bg += `<path d="M250 420 L250 160 L250 160 L310 420 Z" fill="#3d4350"/><line x1="250" y1="420" x2="250" y2="160" stroke="#f4f1e6" stroke-width="3" stroke-dasharray="10 8"/>` + label(310, 140, "corsia di", { size: 10, italic: true, color: "#ffd38a" }) + label(310, 153, "accelerazione", { size: 10, italic: true, color: "#ffd38a" });
      slowKind = "car"; hazardText = T("This lane is only for joining the road. No overtaking here.", "Questa corsia serve solo per entrare. Qui non si sorpassa.");
      actors.push({ id: "s2", kind: "car", color: "#9aa", keys: [{ t: 0, x: 268, y: 300 }, { t: 7000, x: 262, y: 240 }] });
      ghostPath = ghost([[268, 400], [290, 330], [285, 220]], false);
      return {
        duration: dur, bg, shows: [{ t: 1600, svg: ghostPath }, { t: 3000, svg: pulse(268, 300, 34, "#ff6b5e") }],
        actors: [...actors, { id: "you", kind: "you", keys: [{ t: 0, x: 268, y: 420 }, { t: 7000, x: 262, y: 370 }] }],
        steps: finish([{ t: 0, text: T("You are on the acceleration lane, joining the road.", "Sei sulla corsia di accelerazione per entrare nella strada.") }, { t: 1600, text: T("Can you pass the car in front of you here?", "Puoi superare l'auto davanti a te qui?") }, { t: 3000, text: hazardText }], P, dur), verdict: { ok: false },
        world3d: { road: "twoWay", props: [{ type: "accelLane" }, { type: "label", x: 330, y: 200, text: T("acceleration lane", "corsia di accelerazione") }] },
      };
    case "ambulance": hazardText = T("Don't follow close behind an ambulance to get through traffic.", "Non metterti dietro a un'ambulanza per passare nel traffico.");
      actors.push({ id: "amb", kind: "ambulance", keys: [{ t: 0, x: r.right, y: 360, flash: true }, { t: 1200, x: r.left, y: 300 }, { t: 4000, x: r.left, y: 60 }, { t: 5500, x: r.right, y: -60 }] });
      youY = [440, 400]; ghostPath = ghost([[r.right, 400], [r.left, 320], [r.left, 120]], false); break;
    case "alreadyOvertaking": hazardText = T("That car is already overtaking. To pass it you would go even further onto the other side.", "Quell'auto sta già sorpassando. Per superarla andresti ancora più dall'altra parte.");
      actors.push({ id: "b", kind: "car", color: "#8e6bbf", keys: [{ t: 0, x: r.left, y: 320, blink: "L" }, { t: 7000, x: r.left, y: 200 }] });
      ghostPath = ghost([[r.right, 360], [100, 320], [100, 120]], false); youY = [420, 400]; break;
    case "junction": bg += FEATURE.junction(120, 60); hazardText = T("A junction with no traffic lights and no officer. No overtaking.", "Un incrocio senza semaforo e senza vigile. Non si sorpassa.");
      actors.push({ id: "x", kind: "car", color: "#e55", keys: [{ t: 0, x: 380, y: 135, r: -90, blink: "L" }, { t: 3000, x: 380, y: 135, r: -90 }, { t: 5000, x: 300, y: 135, r: -90, brake: true }] });
      ghostPath = ghost([[r.right, 300], [r.left, 240], [r.left, 100]], false); break;
    default: hazardText = T("Overtaking is not allowed here.", "Qui il sorpasso è vietato.");
  }
  actors.unshift({ id: "slow", kind: slowKind, keys: [{ t: 0, x: r.right, y: slowY[0] }, { t: dur, x: r.right, y: slowY[1], brake: slowKind === "car" }] });
  actors.push({ id: "you", kind: "you", cone: ({ curve: 140, hill: 125, fog: 175 })[hz], keys: [{ t: 0, x: r.right, y: youY[0] }, { t: 2000, x: r.right, y: youY[1] + 20, blink: null }, { t: dur, x: r.right, y: youY[1] }] });
  shows.push({ t: 1600, svg: ghostPath });
  const steps = finish([
    { t: 0, text: T("You are behind a slower vehicle.", "Sei dietro a un veicolo più lento.") },
    { t: 1600, text: T("You want to overtake. Are you allowed here?", "Vuoi sorpassare. Qui si può?") },
    { t: 3000, text: hazardText },
  ], P, dur);
  const props = {
    levelCrossing: [{ type: "rails", y: 140 }],
    trafficLightQueue: [{ type: "light", x: 275, y: 120, color: "red" }],
    pedCrossing: [{ type: "zebra", y: 120 }],
    junction: [{ type: "junction", y: 120, h: 60 }],
  }[hz] || [];
  const w3 = { road: "twoWay", line: hz === "solidLine" ? "solid" : hz === "doubleSolid" ? "double" : "dashed", feature: ["hill", "curve", "fog"].includes(hz) ? hz : null, props };
  return { duration: dur, bg, actors, shows, steps, verdict: { ok: P.verdict === "ok" }, world3d: w3 };
}

export function allowed(P) {
  const f = P.feature || "dashedLine";
  const roadKind = P.road || "twoWay";
  const r = roadCfg(roadKind, f === "mixedLine" ? "mixed" : "dashed");
  const dur = 9000;
  let bg = r.bg;
  let slowKind = "truck", slowColor;
  const shows = [], extra = [];
  let note = "", fromX = r.right, toX = r.left;
  let slowKeys = null;

  switch (f) {
    case "curve": bg += FEATURE.curve(r); note = roadKind === "twoWay" ? "" : T("A bend, but nobody can come towards you on this road.", "Una curva, ma su questa carreggiata nessuno arriva di fronte."); break;
    case "hill": bg += FEATURE.hill(r); note = T("A hill top, but nobody can come towards you on this road.", "Un dosso, ma su questa carreggiata nessuno arriva di fronte."); break;
    case "hillDownSlope": bg += FEATURE.hillDown(); note = T("You are past the top of the hill. You can see the road ahead.", "Hai già passato il dosso. Vedi la strada davanti."); break;
    case "mixedLine": note = T("The dashed line is on YOUR side, so you may cross it.", "La linea tratteggiata è dalla TUA parte: puoi superarla."); shows.push({ t: 2400, t1: 4000, svg: pulse(183, 290, 30) }); break;
    case "dashedLine": note = roadKind === "oneWay" ? T("A one-way road: everyone goes the same way.", "Strada a senso unico: tutti vanno nella stessa direzione.") : T("A dashed line can be crossed when it is safe.", "La linea tratteggiata si può superare quando è sicuro."); break;
    case "junctionLights": bg += FEATURE.junction(130, 60) + lib.trafficLight(275, 210, "green"); note = T("A junction with traffic lights. Overtaking is allowed.", "Un incrocio con semaforo. Il sorpasso è consentito."); break;
    case "junctionPolice": bg += FEATURE.junction(130, 60); extra.push({ id: "off", kind: "officer", keys: [{ t: 0, x: 300, y: 160 }] }); note = T("A traffic officer controls this junction. Overtaking is allowed.", "Un vigile regola questo incrocio. Il sorpasso è consentito."); break;
    case "junctionPriority": bg += FEATURE.junction(120, 60); note = T("A priority road with separate carriageways and lane lines. Allowed.", "Strada con precedenza, carreggiate separate e corsie segnate. Consentito."); break;
    case "bicycle": bg += FEATURE.junction(120, 60); slowKind = "bike"; fromX = r.right + 18; toX = 196;
      note = T("A bicycle. You can pass it without going onto the other side.", "Una bicicletta. Puoi superarla senza andare dall'altra parte."); break;
    case "levelCrossingLights": bg += FEATURE.rails(140) + lib.trafficLight(275, 210, "green"); note = T("No barriers, but traffic lights control it. Allowed.", "Senza barriere, ma con il semaforo. Consentito."); break;
    case "police": slowKind = "police"; note = T("A police car with no siren on can be overtaken.", "Un'auto della polizia senza sirena si può sorpassare."); break;
    case "bus": bg += `<rect x="252" y="160" width="40" height="70" fill="#9aa3b2"/>` + label(305, 195, "BUS", { size: 10, anchor: "start" });
      slowKind = "bus"; slowKeys = [{ t: 0, x: r.right + 12, y: 200 }, { t: dur, x: r.right + 12, y: 200 }]; note = T("A bus stopped at its stop can be passed. Go slowly.", "Un autobus fermo alla fermata si può superare. Vai piano."); break;
    case "rightIndicator": slowKind = "car"; slowColor = "#9aa";
      slowKeys = [{ t: 0, x: r.right, y: 250, blink: "R" }, { t: 2500, x: r.right + 18, y: 215, brake: true }, { t: dur, x: r.right + 18, y: 205 }];
      note = T("The car ahead signals right to stop. You may overtake it.", "L'auto davanti mette la freccia a destra per fermarsi. Puoi sorpassarla."); break;
    case "secondOvertake": extra.push({ id: "s2", kind: "car", color: "#9aa", keys: [{ t: 0, x: r.right, y: 140 }, { t: dur, x: r.right, y: 40 }] });
      note = T("Two lanes each way. You may pass the second vehicle before moving back right.", "Due corsie per senso. Puoi superare anche il secondo veicolo prima di rientrare."); break;
  }
  const k = overtakeKeys(fromX, toX);
  if (f === "secondOvertake") k.you = [
    { t: 0, x: fromX, y: 400 }, { t: 600, x: fromX, y: 382, blink: "L" }, { t: 1300, x: fromX, y: 345 }, { t: 2500, x: toX, y: 290, blink: null },
    { t: 5600, x: toX, y: 20, blink: "R" }, { t: 6600, x: fromX, y: -40, blink: null }, { t: 7600, x: fromX, y: -90 }];
  const actors = [{ id: "slow", kind: slowKind, color: slowColor, keys: slowKeys || k.slow }, ...extra, { id: "you", kind: "you", keys: k.you }];
  const steps = [{ t: 0, text: T("You are behind a slower vehicle.", "Sei dietro a un veicolo più lento.") }];
  if (note) steps.push({ t: 1300, text: note });
  steps.push({ t: 2600, text: T("Indicator, mirror, then overtake with plenty of space at the side.", "Freccia, specchietto, poi sorpassa con molto spazio di lato.") });
  steps.push({ t: 5900, text: T("Go back to the right when it is safe.", "Torna a destra quando è sicuro.") });
  const props3 = {
    junctionLights: [{ type: "junction", y: 130, h: 60 }, { type: "light", x: 275, y: 210, color: "green" }],
    junctionPolice: [{ type: "junction", y: 130, h: 60 }],
    junctionPriority: [{ type: "junction", y: 120, h: 60 }],
    bicycle: [{ type: "junction", y: 120, h: 60 }],
    levelCrossingLights: [{ type: "rails", y: 140 }, { type: "light", x: 275, y: 210, color: "green" }],
    bus: [{ type: "patch", x: 252, y: 160, w: 40, h: 70, color: "#5b616e" }, { type: "busStop", x: 305, y: 195 }],
  }[f] || [];
  const world3d = { road: roadKind, line: f === "mixedLine" ? "mixed" : "dashed", feature: f === "curve" || f === "hill" ? f : f === "hillDownSlope" ? "hillDown" : null, props: props3 };
  return { duration: dur, bg, actors, shows, steps: finish(steps, P, dur), verdict: { ok: P.verdict !== "no" }, world3d };
}

export function right(P) {
  const c = P.case || "leftTurner";
  const dur = 8000;
  const shows = [];
  let r, bg, actors, text;
  switch (c) {
    case "leftTurner":
      r = roadCfg("twoWay"); bg = r.bg + `<rect x="-10" y="120" width="120" height="60" fill="#3d4350"/>`;
      actors = [
        { id: "t", kind: "car", color: "#9aa", keys: [{ t: 0, x: r.right, y: 250, blink: "L" }, { t: 2200, x: 190, y: 200 }, { t: 3000, x: 188, y: 196, brake: true }, { t: 5400, x: 188, y: 196 }, { t: 7600, x: 120, y: 150, r: -80 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: r.right, y: 400 }, { t: 2600, x: r.right, y: 320 }, { t: 3200, x: 236, y: 280 }, { t: 5600, x: 236, y: 60 }, { t: 7000, x: r.right, y: -60 }] },
      ];
      text = T("The car ahead signals LEFT and moves to the middle. You pass it on the RIGHT.", "L'auto davanti mette la freccia a SINISTRA e va al centro. La superi a DESTRA."); break;
    case "oneWayLeftStop":
      r = roadCfg("oneWay"); bg = r.bg;
      actors = [
        { id: "t", kind: "car", color: "#9aa", keys: [{ t: 0, x: 145, y: 250, blink: "L" }, { t: 2600, x: 128, y: 200, brake: true }, { t: dur, x: 128, y: 195 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: 215, y: 400 }, { t: 5600, x: 215, y: 60 }, { t: dur, x: 215, y: -60 }] },
      ];
      text = T("One-way road. The car ahead will stop on the LEFT. Pass it on the right.", "Strada a senso unico. L'auto davanti si ferma a SINISTRA. Superala a destra."); break;
    case "tramMoving": case "tramOneWay": case "tramIsland": case "tramNoIsland": {
      const one = c === "tramOneWay";
      r = roadCfg(one ? "oneWay" : "twoWay");
      bg = r.bg + `<line x1="166" y1="-20" x2="166" y2="${H + 20}" stroke="#999" stroke-width="2"/><line x1="194" y1="-20" x2="194" y2="${H + 20}" stroke="#999" stroke-width="2"/>`;
      const stopped = c === "tramIsland" || c === "tramNoIsland";
      if (c === "tramIsland") bg += `<rect x="201" y="120" width="14" height="150" rx="3" fill="#cbd5e1" stroke="#fff" stroke-width="2"/>` + label(268, 112, "salvagente", { size: 11, italic: true, color: "#ffd38a" });
      const tramKeys = stopped ? [{ t: 0, x: 180, y: 190 }, { t: dur, x: 180, y: 190 }] : [{ t: 0, x: 180, y: 220 }, { t: dur, x: 180, y: 120 }];
      actors = [{ id: "tram", kind: "tram", keys: tramKeys }];
      if (c === "tramIsland") actors.push(...[150, 200, 240].map((y, i) => ({ id: "p" + i, kind: "ped", keys: [{ t: 0, x: 208, y }] })));
      if (c === "tramNoIsland") {
        actors.push(...[0, 1].map(i => ({ id: "p" + i, kind: "ped", keys: [{ t: 0, x: 202, y: 170 + i * 40 }, { t: 2000, x: 202, y: 170 + i * 40 }, { t: 4500, x: 238 + i * 6, y: 160 + i * 40 }] })));
        actors.push({ id: "you", kind: "you", keys: [{ t: 0, x: 236, y: 420 }, { t: 3000, x: 236, y: 330, brake: false }, { t: 3800, x: 236, y: 315, brake: true }, { t: dur, x: 236, y: 315 }] });
        shows.push({ t: 1600, svg: ghost([[236, 330], [236, 80]], false) });
        text = T("The tram stopped and there is no island. People step onto the road. Don't pass on the right.", "Il tram è fermo e non c'è salvagente. Le persone scendono in strada. Non superare a destra.");
      } else {
        actors.push({ id: "you", kind: "you", keys: [{ t: 0, x: 236, y: 420 }, { t: 5600, x: 236, y: 40 }, { t: dur, x: 236, y: -60 }] });
        text = c === "tramIsland" ? T("The tram stopped at a passenger island (salvagente). You may pass on the right.", "Il tram è fermo al salvagente. Puoi superarlo a destra.")
             : one ? T("One-way road, wide enough. You may pass the tram on either side.", "Senso unico e strada larga. Puoi superare il tram da tutti e due i lati.")
             : T("A tram moving in the middle of the road is passed on the RIGHT.", "Un tram che va al centro della strada si supera a DESTRA.");
        if (one) shows.push({ t: 1200, svg: ghost([[236, 380], [236, 100]], true) + ghost([[120, 380], [120, 100]], true) });
      }
      break;
    }
    case "motorway": {
      bg = lib.grass() + lib.road(85, 190) + lib.line(148) + lib.line(212) + label(312, 30, "autostrada", { size: 11, italic: true, color: "#ffd38a" });
      actors = [
        { id: "s", kind: "car", color: "#9aa", keys: [{ t: 0, x: 180, y: 220 }, { t: dur, x: 180, y: 140 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: 180, y: 400 }, { t: 2500, x: 180, y: 300 }, { t: dur, x: 180, y: 260 }] },
      ];
      shows.push({ t: 1600, svg: ghost([[180, 290], [243, 230], [243, 120]], false) });
      text = T("On the motorway you overtake on the LEFT, not on the right.", "In autostrada si sorpassa a SINISTRA, non a destra."); break;
    }
    case "motorbike": default: {
      r = roadCfg("twoWay"); bg = r.bg;
      actors = [
        { id: "m", kind: "moto", keys: [{ t: 0, x: 200, y: 230 }, { t: dur, x: 200, y: 160 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: r.right, y: 400 }, { t: dur, x: r.right, y: 320 }] },
      ];
      shows.push({ t: 1600, svg: ghost([[r.right, 300], [238, 250], [238, 120]], false) });
      text = T("You pass a motorbike on the LEFT, like any other vehicle.", "Una moto si supera a SINISTRA, come ogni altro veicolo.");
    }
  }
  const steps = finish([{ t: 0, text: T("Passing on the RIGHT is allowed only in special cases.", "Sorpassare a DESTRA si può solo in casi speciali.") }, { t: 1500, text }], P, dur);
  const tram = c.startsWith("tram");
  const world3d = {
    road: c === "motorway" ? "motorway3" : c === "oneWayLeftStop" || c === "tramOneWay" ? "oneWay" : "twoWay",
    props: [
      ...(c === "leftTurner" ? [{ type: "sideRoad", y: 120, h: 60, x1: 112 }] : []),
      ...(tram ? [{ type: "tramRails", xs: [168, 192] }] : []),
      ...(c === "tramIsland" ? [{ type: "island", x: 201, y: 120, w: 14, h: 150 }, { type: "label", x: 268, y: 112, text: T("tram island (salvagente)", "salvagente") }] : []),
    ],
  };
  return { duration: dur, bg, actors, shows, steps, verdict: { ok: P.verdict !== "no" }, world3d };
}

export function space(P) {
  const f = P.factor || "speedDiff";
  const dur = 7500;
  let bg = lib.grass() + lib.road(30, 130) + lib.line(95) + lib.road(200, 130) + lib.line(265);
  bg += label(95, 20, "A", { size: 16 }) + label(265, 20, "B", { size: 16 });
  const long = f !== "otherSlows";
  const lenA = 150, lenB = long ? 260 : 95;
  const labels = {
    speedDiff: [T("big speed difference", "grande differenza di velocità"), T("small speed difference", "poca differenza di velocità")],
    lengthOther: [T("passing a car", "superi un'auto"), T("passing a long truck", "superi un camion lungo")],
    lengthOwn: [T("you drive a car", "guidi un'auto"), T("you tow a caravan", "trascini un caravan")],
    otherAccelerates: [T("other car steady", "l'altra va costante"), T("other car speeds up", "l'altra accelera")],
    otherSlows: [T("other car steady", "l'altra va costante"), T("other car slows down", "l'altra rallenta")],
  }[f] || ["", ""];
  bg += label(95, 38, labels[0], { size: 11, color: "#ffd38a" }) + label(265, 38, labels[1], { size: 11, color: "#ffd38a" });
  const slowB = f === "lengthOther" ? "truck" : "car";
  const youB = f === "lengthOwn" ? "caravan" : "you";
  const actors = [
    { id: "sa", kind: "car", color: "#9aa", keys: [{ t: 0, x: 128, y: 260 }, { t: dur, x: 128, y: 200 }] },
    { id: "ya", kind: "you", keys: [{ t: 0, x: 128, y: 400 }, { t: 1200, x: 62, y: 340 }, { t: 4200, x: 62, y: 160 }, { t: 5400, x: 128, y: 120 }, { t: dur, x: 128, y: 100 }] },
    { id: "sb", kind: slowB, color: "#9aa", keys: [{ t: 0, x: 298, y: 260 }, { t: dur, x: 298, y: f === "otherAccelerates" ? 120 : f === "otherSlows" ? 240 : 200 }] },
    { id: "yb", kind: youB, keys: [{ t: 0, x: 298, y: 400 }, { t: 1200, x: 232, y: 340 }, { t: 6200, x: 232, y: long ? 70 : 200 }, { t: dur, x: 298, y: long ? 40 : 160 }] },
  ];
  const bracket = (x, y0, len, col) => `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 - len}" stroke="${col}" stroke-width="4"/><line x1="${x - 6}" y1="${y0}" x2="${x + 6}" y2="${y0}" stroke="${col}" stroke-width="4"/><line x1="${x - 6}" y1="${y0 - len}" x2="${x + 6}" y2="${y0 - len}" stroke="${col}" stroke-width="4"/>`;
  const shows = [{ t: 4500, svg: bracket(18, 360, lenA, "#7be0a0") + bracket(188, 360, lenB, long ? "#ff9f6b" : "#7be0a0") + label(180, 405, long ? T("B needs MORE road", "B: serve PIÙ strada") : T("B needs LESS road", "B: serve MENO strada"), { size: 14, color: "#ffd38a" }) }];
  const steps = finish([{ t: 0, text: T("Two overtakes side by side. How much road does each one need?", "Due sorpassi uno accanto all'altro. Quanta strada serve a ognuno?") }, { t: 4500, text: long ? T("Overtake B takes much longer, so it needs more free road ahead.", "Il sorpasso B dura molto di più: serve più strada libera davanti.") : T("When the other car slows down, you pass it sooner. You need less road.", "Se l'altra auto rallenta, la superi prima. Serve meno strada.") }], P, dur);
  const world3d = { road: "space", props: [
    { type: "label", x: 95, y: 40, text: "A · " + labels[0] }, { type: "label", x: 265, y: 40, text: "B · " + labels[1] },
    { type: "label", x: 180, y: 300, t0: 4500, big: true, text: long ? T("B needs MORE road", "B: serve PIÙ strada") : T("B needs LESS road", "B: serve MENO strada") },
  ] };
  return { duration: dur, camera: "wide", bg, actors, shows, steps, verdict: { ok: P.verdict !== "no" }, world3d };
}

export function beingOvertaken(P) {
  const r = roadCfg("twoWay");
  const dur = 8500;
  const d = P.do || "keepRight", bad = P.bad;
  let you = [{ t: 0, x: r.right, y: 380 }, { t: dur, x: r.right, y: 200 }];
  const shows = [];
  let text = T("Someone is overtaking you.", "Qualcuno ti sta sorpassando.");
  if (d === "keepRight" && !bad) { you = [{ t: 0, x: r.right, y: 380 }, { t: 1800, x: r.right, y: 340 }, { t: 3000, x: r.right + 16, y: 310 }, { t: dur, x: r.right + 16, y: 200 }]; text = T("Move as far right as you can to make room.", "Stai il più possibile a destra per fare spazio."); }
  if (d === "slowDown" && !bad) { you = [{ t: 0, x: r.right, y: 380 }, { t: 2600, x: r.right, y: 320 }, { t: 2700, x: r.right + 12, y: 318, brake: true }, { t: dur, x: r.right + 12, y: 280, brake: false }]; text = T("A car is coming. Slow down and keep right, so the other car can get back in.", "Arriva un'auto. Rallenta e stai a destra, così l'altro può rientrare."); }
  if (d === "noAccelerate" && !bad) { text = T("Keep the same speed. Never speed up while someone overtakes you.", "Mantieni la stessa velocità. Non accelerare mai mentre ti sorpassano."); }
  if (d === "letPass" && !bad) {
    shows.push({ t: 0, svg: `<rect x="250" y="150" width="40" height="110" fill="#3d4350"/>` + label(305, 140, T("lay-by", "piazzola"), { size: 11 }) });
    you = [{ t: 0, x: r.right, y: 380 }, { t: 2000, x: r.right, y: 300, blink: "R" }, { t: 3600, x: 268, y: 220, brake: true, blink: null }, { t: dur, x: 268, y: 210 }];
    text = T("You are very slow. Pull in when you can and let the others pass.", "Sei molto lento. Accosta appena puoi e lascia passare gli altri.");
  }
  if (bad === "race") { you = [{ t: 0, x: r.right, y: 380 }, { t: 1800, x: r.right, y: 330 }, { t: 5000, x: r.right, y: 90 }, { t: dur, x: r.right, y: -40 }]; text = T("Speeding up to race the other car is forbidden and dangerous.", "Accelerare per fare a gara con l'altro è vietato e pericoloso."); shows.push({ t: 2000, t1: 5200, svg: bubble(r.right + 60, 200, T("faster!", "accelera!"), "#ff6b5e") }); }
  if (bad === "centre") { you = [{ t: 0, x: r.right, y: 380 }, { t: 2200, x: 186, y: 320 }, { t: dur, x: 186, y: 220 }]; text = T("Moving to the middle to block the other car is forbidden.", "Spostarsi al centro per bloccare l'altro è vietato."); }
  if (bad === "hazardLights") { you[0].blink = "H"; text = T("Hazard lights do not mean 'the road is free'. Don't use them like that.", "Le quattro frecce non vogliono dire 'strada libera'. Non usarle così."); }
  if (bad === "indicator") { you[0].blink = "R"; text = T("The right indicator is not a 'danger' signal for the other driver.", "La freccia a destra non è un segnale di pericolo per l'altro."); }
  if (bad === "highBeam") { shows.push({ t: 1500, svg: `<path d="M${r.right - 12} 300 L${r.right - 60} 120 L${r.right + 60} 120 L${r.right + 12} 300 Z" fill="#fff6b0" opacity=".35"/>` }); text = T("High beams dazzle the driver coming towards you. Don't use them as a warning.", "Gli abbaglianti accecano chi arriva di fronte. Non usarli come avviso."); }
  const over = [{ t: 0, x: r.right, y: 470 }, { t: 1000, x: r.right, y: 440, blink: "L" }, { t: 2200, x: r.left, y: 380, blink: null }, { t: 5000, x: r.left, y: 150, blink: "R" }, { t: 6400, x: r.right, y: 40, blink: null }, { t: dur, x: r.right, y: -80 }];
  const actors = [{ id: "you", kind: "you", keys: you }, { id: "o", kind: "car", color: "#e55", keys: over }];
  if (d === "slowDown" || bad === "highBeam" || bad === "indicator" || bad === "hazardLights" || (d === "keepRight" && !bad)) {
    actors.push({ id: "onc", kind: "car", color: "#8e6bbf", keys: [{ t: 0, x: r.left, y: -80 }, { t: 3000, x: r.left, y: -80 }, { t: dur, x: r.left, y: 260 }] });
  }
  if (bad === "race") actors[1].keys = [{ t: 0, x: r.right, y: 470 }, { t: 1000, x: r.right, y: 440, blink: "L" }, { t: 2200, x: r.left, y: 380, blink: null }, { t: 5000, x: r.left, y: 140, brake: true }, { t: dur, x: r.left, y: 60 }];
  const steps = finish([{ t: 0, text: T("You are the slow car. Someone starts to overtake you.", "Tu sei l'auto lenta. Qualcuno inizia a sorpassarti.") }, { t: 2200, text }], P, dur);
  if (bad === "highBeam") actors[0].beam = true;
  const world3d = { road: "twoWay", props: d === "letPass" && !bad ? [{ type: "patch", x: 250, y: 150, w: 40, h: 110 }, { type: "label", x: 305, y: 140, text: T("lay-by", "piazzola") }] : [] };
  return { duration: dur, bg: r.bg, actors, shows, steps, verdict: { ok: P.verdict !== "no" }, world3d };
}

export function motorway(P) {
  const risk = P.risk || "mirror";
  const dur = 8000;
  const bg = lib.grass() + lib.road(85, 190) + lib.line(148) + lib.line(212) + `<rect x="275" y="-20" width="40" height="${H + 40}" fill="#41454a"/>` +
    label(300, 412, "autostrada", { size: 11, italic: true, color: "#ffd38a" });
  const lanes = [243, 180, 117];  // right, middle, left
  let actors = [], shows = [], text = "";
  const youStd = [{ t: 0, x: lanes[1], y: 400 }, { t: 900, x: lanes[1], y: 370, blink: "L" }, { t: 2400, x: lanes[2], y: 300, blink: null }, { t: dur, x: lanes[2], y: 120 }];
  switch (risk) {
    case "mirror":
      actors = [{ id: "s", kind: "truck", keys: [{ t: 0, x: lanes[1], y: 250 }, { t: dur, x: lanes[1], y: 190 }] },
        { id: "fast", kind: "car", color: "#e55", keys: [{ t: 0, x: lanes[2], y: 520 }, { t: 2600, x: lanes[2], y: 360, brake: true }, { t: dur, x: lanes[2], y: 230 }] },
        { id: "you", kind: "you", keys: youStd }];
      shows.push({ t: 2600, t1: 5000, svg: pulse(lanes[2], 340, 40, "#ff6b5e") });
      text = T("A fast car is coming in the left lane. Look in your mirrors before you move out!", "Arriva un'auto veloce nella corsia di sinistra. Guarda negli specchietti prima di spostarti!"); break;
    case "distance":
      actors = [{ id: "s", kind: "truck", keys: [{ t: 0, x: lanes[1], y: 230 }, { t: dur, x: lanes[1], y: 170 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: lanes[1], y: 400 }, { t: 2000, x: lanes[1], y: 305 }, { t: dur, x: lanes[1], y: 250 }] }];
      shows.push({ t: 2000, svg: `<line x1="${lanes[1] + 26}" y1="276" x2="${lanes[1] + 26}" y2="225" stroke="#ff6b5e" stroke-width="3"/>` + bubble(lanes[1] + 70, 250, T("too close!", "troppo vicino!"), "#ff6b5e") });
      text = T("You are too close to the truck. No space and no time to react.", "Sei troppo vicino al camion. Niente spazio e niente tempo per reagire."); break;
    case "cutIn":
      actors = [{ id: "c", kind: "car", color: "#9aa", keys: [{ t: 0, x: lanes[1], y: 200 }, { t: 2400, x: lanes[1], y: 170, blink: "L" }, { t: 3800, x: lanes[2], y: 150, blink: null }, { t: dur, x: lanes[2], y: 100 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: lanes[2], y: 400 }, { t: 3800, x: lanes[2], y: 230, brake: true }, { t: dur, x: lanes[2], y: 200 }] }];
      shows.push({ t: 3800, t1: 6000, svg: pulse(lanes[2], 170, 38, "#ff6b5e") });
      text = T("A car ahead suddenly moves into your lane. Be ready to brake.", "Un'auto davanti entra all'improvviso nella tua corsia. Preparati a frenare."); break;
    case "stayLeft":
      actors = [{ id: "you", kind: "you", keys: [{ t: 0, x: lanes[2], y: 300 }, { t: dur, x: lanes[2], y: 160 }] },
        { id: "q", kind: "car", color: "#e55", keys: [{ t: 0, x: lanes[2], y: 480 }, { t: 3000, x: lanes[2], y: 270, brake: true }, { t: dur, x: lanes[2], y: 230 }] }];
      shows.push({ t: 2600, svg: bubble(lanes[0], 200, T("lanes free on the right", "corsie libere a destra"), "#7be0a0") });
      text = T("You stay in the overtaking lane while the right lanes are free. You block the others.", "Resti nella corsia di sorpasso con le corsie a destra libere. Blocchi gli altri."); break;
    case "follow":
      actors = [{ id: "s", kind: "truck", keys: [{ t: 0, x: lanes[1], y: 240 }, { t: dur, x: lanes[1], y: 180 }] },
        { id: "o", kind: "car", color: "#8e6bbf", keys: [{ t: 0, x: lanes[2], y: 330 }, { t: dur, x: lanes[2], y: 120 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: lanes[2], y: 420 }, { t: dur, x: lanes[2], y: 175 }] }];
      shows.push({ t: 2500, svg: bubble(lanes[2] - 50, 230, T("right behind!", "attaccato!"), "#ff6b5e") });
      text = T("You follow another overtaking car too closely. If it brakes, you crash.", "Segui troppo da vicino un'altra auto che sorpassa. Se frena, la tamponi."); break;
    case "wind": default:
      actors = [{ id: "s", kind: "truck", keys: [{ t: 0, x: lanes[0], y: 250 }, { t: 2000, x: lanes[0] - 4, y: 230 }, { t: 3000, x: lanes[0] + 6, y: 220 }, { t: 4000, x: lanes[0] - 6, y: 210 }, { t: dur, x: lanes[0], y: 170 }] },
        { id: "you", kind: "you", keys: [{ t: 0, x: lanes[1], y: 400 }, { t: 3000, x: lanes[1] - 4, y: 280 }, { t: 4000, x: lanes[1] + 4, y: 250 }, { t: dur, x: lanes[1], y: 160 }] }];
      shows.push({ t: 1500, svg: [80, 160, 240].map(y => `<path d="M10 ${y} Q40 ${y - 10} 70 ${y} T130 ${y}" stroke="#bfe3f2" stroke-width="3" fill="none"/>`).join("") + label(40, 60, T("strong wind", "vento forte"), { size: 12, color: "#bfe3f2", anchor: "start" }) });
      text = T("Strong side wind pushes the vehicles sideways while you pass.", "Il vento forte di lato spinge i veicoli mentre sorpassi.");
  }
  const steps = finish([{ t: 0, text: T("Overtaking on the motorway (autostrada).", "Sorpasso in autostrada.") }, { t: 2200, text }], P, dur);
  return { duration: dur, bg, actors, shows, steps, verdict: { ok: P.verdict === "ok" }, world3d: { road: "motorway", props: risk === "wind" ? [{ type: "wind" }] : [] } };
}
