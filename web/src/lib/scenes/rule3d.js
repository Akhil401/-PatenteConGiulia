import { T } from "./engine.js";
// A 3D "set" for a rule card: the road, the vehicles and the people the rule talks about,
// chosen from the words of the question and its explanation. The rule cards stay on top.

const has = (s, re) => re.test(s);

/** Lanes (scene px) in our direction ("up") and the other one ("down") for each road. */
const LANES = {
  twoWay: { up: [215], down: [145] }, oneWay: { up: [215, 150], down: [] },
  dual: { up: [225, 297], down: [135, 63] }, motorway: { up: [243, 180, 117], down: [] },
};

// words -> vehicle model (first match wins; order matters)
const KINDS = [
  ["ambulance", /ambulanc|fire brigade|firefight|emergency|soccorso|vigili del fuoco/],
  ["police", /police|polizia|carabinier/],
  ["tram", /\btram/],
  ["bus", /\bbus|autobus|coach/],
  ["truck", /lorr|truck|autocarr|semi-?trailer|trailer|agricultur|tractor|goods vehicle|heavy vehicle|machine/],
  ["caravan", /caravan|roulotte/],
  ["moto", /motorcycl|motorbike|moped|scooter|tricycle|ciclomotor|motocicl|quadricycle/],
  ["bike", /bicycl|cyclist|\bbike|ciclist/],
  ["car", /\bcar\b|\bcars\b|autovettur|motorhome|camper|taxi|vehicle/],
];
const ICON_KIND = { moto: "moto", truck: "truck", bus: "bus", bike: "bike", ambulance: "ambulance", police: "police", tram: "tram", car: "car" };
const COLORS = ["#e11d48", "#f59e0b", "#10b981", "#8b5cf6", "#0ea5e9"];

function kindOf(text) { for (const [k, re] of KINDS) if (re.test(text)) return k; return null; }
/** "Mopeds: no" / "No mopeds" -> false, "Cars: yes" -> true, otherwise null */
function verdictOf(line) {
  const l = line.toLowerCase();
  if (/:\s*(no|not allowed|forbidden|banned|never)\b/.test(l) || /^no\s+\w/.test(l) || /\bnot allowed\b|\bforbidden\b/.test(l)) return false;
  if (/:\s*(yes|allowed|ok|always)\b/.test(l) || /\ballowed\b/.test(l)) return true;
  return null;
}

/**
 * @param P sceneParams of the rule card ({lines, icons, caption, it})
 * @param q the question (q.en, q.it are used for the topic)
 * @param dur scene duration in ms, @param per ms per card, @param start first card time
 */
export function ruleWorld(P, q, lines, dur, per, start) {
  const text = [q && q.en, q && q.it, P.caption, P.it, ...(lines || [])].filter(Boolean).join(" ").toLowerCase();
  const icons = P.icons || [];

  // ---- the road ----
  let road = "twoWay", line = "dashed", feature = null;
  if (has(text, /motorway|autostrad|slip lane|acceleration lane|deceleration lane|piazzol/)) road = "motorway";
  else if (has(text, /main out-of-town|extraurbane principal|separate carriageways|dual carriageway/)) road = "dual";
  else if (has(text, /one-way|senso unico(?! alternato)/)) road = "oneWay";
  if (has(text, /mountain|bend|curve|curva|tornant/) || icons.includes("curve")) feature = "curve";
  else if (has(text, /\bhump|summit|dosso|hill/) || icons.includes("hill")) feature = "hill";
  else if (has(text, /\bfog\b|nebbia/) || icons.includes("fog")) feature = "fog";
  if (road === "motorway" || road === "dual") feature = feature === "fog" ? "fog" : null;
  const town = road === "twoWay" && has(text, /urban|built-up|town|city|centro abitato|pedestrian area|limited traffic|school|taxi|residential|zona|garage|driveway|passo carrabile|entrance/);
  const lanes = LANES[road] || LANES.twoWay;

  const props = [], actors = [];
  if (town) props.push({ type: "town" });

  // ---- places on the road ----
  const rails = has(text, /level crossing|passaggio a livello|railway|rails|\btrain/) || icons.includes("train");
  const people = has(text, /pedestrian|pedon|blind|elderly|anzian|pregnant|child|bambin|school|zebra|crossing the carriageway|white stick/) || icons.includes("pedestrian") || icons.includes("child");
  // junctions from the ENGLISH wording only: in Italian "incrocio" also means meeting an oncoming vehicle
  const textEn = [q && q.en, P.caption, ...(lines || [])].filter(Boolean).join(" ").toLowerCase();
  const junction = !rails && has(textEn, /junction|intersection|crossroad|right of way|roundabout/);
  const lights = has(text, /traffic light|semafor|red light|yellow light|lights/) && !rails;
  const island = has(text, /island|isola|salvagente/);
  const busStop = has(text, /bus stop|fermata/);
  let stopY = null;                                  // where traffic stops (zebra / rails / junction)
  if (rails) { props.push({ type: "rails", y: 120 }); props.push({ type: "light", x: 262, y: 160, color: "red" }); stopY = 190; }
  else if (junction) { props.push({ type: "junction", y: 70, h: 60 }); if (lights) props.push({ type: "light", x: 262, y: 140, color: "red" }); stopY = 175; }
  if (people && !rails) { props.push({ type: "zebra", y: rails || junction ? 150 : 110 }); stopY = (rails || junction ? 150 : 110) + 80; }
  if (lights && !junction && !rails) props.push({ type: "light", x: 262, y: (people ? 110 : 120) + 30, color: "red" });
  if (island && road === "twoWay") props.push({ type: "island", x: 168, y: 220, w: 24, h: 70 });
  if (busStop) props.push({ type: "busStop", x: 285, y: 230 });
  if (road === "motorway" && has(text, /acceleration lane/)) props.push({ type: "accelLane" });

  // ---- speed limits written in the rule: a real round sign for each ----
  const speeds = [...new Set([...(lines || []).join(" ").matchAll(/(\d{2,3})\s?km\/h/g)].map(m => +m[1]))].slice(0, 2);
  const signX = road === "motorway" ? 300 : road === "dual" ? 348 : 268;
  speeds.forEach((v, i) => props.push({ type: "speedSign", x: signX, y: 170 - i * 170, value: v, t0: start + i * per }));

  // ---- the vehicles the rule is about, each with a ✓ / ✕ if the card says yes / no ----
  const heroes = [];
  (lines || []).forEach((ln, i) => {
    const k = kindOf(ln.toLowerCase()) || ICON_KIND[icons[i]];
    if (!k || heroes.some(h => h.kind === k)) return;
    heroes.push({ kind: k, ok: verdictOf(ln), t0: start + i * per });
  });
  if (!heroes.length) { const k = kindOf(text); if (k) heroes.push({ kind: k, ok: null, t0: start }); }
  if (!heroes.length && !people) heroes.push({ kind: "car", ok: null, t0: start });
  // a queue of vehicles ("driving in a line", "in coda")
  if (has(text, /\bqueue|in a line with|line of vehicles|\bcoda\b|incolonnat|colonna/) && heroes.length < 3)
    while (heroes.length < 3) heroes.push({ kind: "car", ok: null, t0: start });
  heroes.slice(0, 3).forEach((h, i) => {
    const n = lanes.up.length, x = lanes.up[i % n], row = Math.floor(i / n), y0 = 430 + row * 100;
    const kind = h.kind === "caravan" ? "caravan" : h.kind;
    const keys = stopY != null
      ? [{ t: 0, x, y: y0 }, { t: dur * .5, x, y: stopY + row * 100, brake: true }, { t: dur, x, y: stopY + row * 100 - 4, brake: true }]
      : [{ t: 0, x, y: y0 }, { t: dur, x, y: y0 - 420 }];
    const a = { id: "h" + i, kind, color: COLORS[i], keys, flashOn: kind === "ambulance" || kind === "police" };
    if (a.flashOn) keys.forEach(k => { k.flash = true; });
    if (h.ok !== null) a.tag = { text: h.ok ? "✓" : "✕", ok: h.ok, t0: h.t0 + 300 };
    actors.push(a);
  });
  // a bit of life on the other side of the road
  if (lanes.down.length) actors.push({ id: "o0", kind: "car", color: "#64748b", keys: [{ t: 0, x: lanes.down[0], y: -360 }, { t: dur, x: lanes.down[0], y: 560 }] });

  // ---- people crossing ----
  if (people && !rails) {
    const zy = (junction ? 150 : 110) + 17;
    const kids = has(text, /child|bambin|school/) || icons.includes("child");
    actors.push({ id: "p0", kind: "ped", color: "#f59e0b", keys: [{ t: 0, x: 92, y: zy }, { t: 700, x: 92, y: zy }, { t: dur * .85, x: 268, y: zy }] });
    actors.push({ id: "p1", kind: "ped", color: kids ? "#ec4899" : "#22c55e", small: kids, keys: [{ t: 0, x: 76, y: zy + 10 }, { t: 1300, x: 76, y: zy + 10 }, { t: dur, x: 250, y: zy + 10 }] });
  }

  // following distance: two vehicles in your lane with the gap between them labelled
  const gapRule = has(text, /distanza di sicurezza|safe distance|following distance|stopping distance|braking distance|reaction distance|spazio di (frenatura|arresto)|tempo di reazione|distanza minima/);
  if (gapRule && !people && !rails) {
    const x = lanes.up[0], heavy = has(text, /lorr|truck|autocarr|camion|heavy|pesante|ingombrant/);
    const lead = { id: "lead", kind: heavy ? "truck" : "car", color: "#f59e0b", keys: [{ t: 0, x, y: 160 }, { t: dur, x, y: 40 }] };
    const you = { id: "you", kind: "you", keys: [{ t: 0, x, y: 400 }, { t: dur, x, y: 280 }] };
    const others = actors.filter(a => !a.id.startsWith("h"));
    return { road, line, feature, props, actors: [...others, lead, you], cam: "orbit", focusY: 230, orbitR: 17, orbitH: 15,
      gap: { a: "lead", b: "you", text: T("safe distance", "distanza di sicurezza"), t0: start + 600 } };
  }
  return { road, line, feature, props, actors, cam: "orbit", focusY: stopY != null ? stopY - 40 : 180 };
}
