// junctionOrder: the right-of-way order at a junction (chapter 14 pictures).
// The helper who reads the official picture describes it as data:
//   arms:     ["n","e","s","w", ...]           which arms the junction has (8 compass points; north = up in the picture)
//   vehicles: [{ id: "A", from: "s", to: "n", kind: "car" }, ...]   to = the arm it leaves by
//   order:    [["A"], ["B", "E"], ["C"]]        the CORRECT order; vehicles in one group go together
//   signs:    [{ arm: "s", type: "stop" | "giveWay" | "priority" }]   optional
// The scene builds that junction, then the vehicles cross in the official order, each labelled with its letter.
import { lib, W, T } from "./engine.js";

const { label } = lib;
const C = { x: 180, y: 210 };                      // junction centre (scene px)
const DIRS = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };
export const COMPASS = Object.keys(DIRS);
const KINDS = new Set(["car", "truck", "bus", "tram", "moto", "bike", "police", "ambulance"]);
const COLORS = ["#2563eb", "#e11d48", "#f59e0b", "#16a34a", "#8b5cf6", "#0ea5e9", "#f97316"];

const unit = d => { const a = DIRS[d] * Math.PI / 180; return { x: Math.sin(a), y: -Math.cos(a) }; };   // from the centre out along the arm
const right = h => ({ x: -h.y, y: h.x });                                                                  // right-hand side of a heading
const add = (...v) => v.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 });
const mul = (v, k) => ({ x: v.x * k, y: v.y * k });
const LANE = 22, WAIT = 118;

/** Path of one vehicle: drive in along its arm (right lane), wait, cross, leave along the exit arm. */
function path(v, go, dur) {
  const u = unit(v.from), o = unit(v.to);
  const hin = mul(u, -1), inLane = mul(right(hin), LANE), outLane = mul(right(o), LANE);
  const start = add(C, mul(u, 300), inLane), wait = add(C, mul(u, WAIT), inLane);
  const mid = add(C, mul(add(inLane, outLane), .55), v.from === v.to ? mul(u, -20) : { x: 0, y: 0 });
  const exit = add(C, mul(o, 340), outLane);
  const P = p => ({ x: Math.round(p.x), y: Math.round(p.y) });
  return [
    { t: 0, ...P(start) }, { t: 1300, ...P(wait), brake: true }, { t: go, ...P(wait), brake: false },
    { t: go + 1000, ...P(mid) }, { t: Math.min(dur, go + 2600), ...P(exit) },
  ];
}

export function junctionOrder(P, q) {
  const arms = (P.arms || []).filter(a => a in DIRS);
  const vehicles = (P.vehicles || []).filter(v => v.from in DIRS && v.to in DIRS);
  const order = (P.order || []).map(g => (Array.isArray(g) ? g : [g]));
  const slot = id => order.findIndex(g => g.includes(id));
  const dur = 2000 + order.length * 2300 + 2000;
  const go = id => 2000 + Math.max(0, slot(id)) * 2300;

  const actors = vehicles.map((v, i) => {
    const kind = KINDS.has(v.kind) ? v.kind : "car";
    return { id: "v" + v.id, kind, color: COLORS[i % COLORS.length], keys: path(v, go(v.id), dur).map(k => (kind === "police" || kind === "ambulance") && v.siren ? { ...k, flash: true } : k),
      tag: { text: v.id, ok: true, t0: 0, cls: "letter" } };
  });

  // 2D board: arms as rotated strips, letters at the waiting points
  let bg = `<rect x="-200" y="-200" width="${W + 400}" height="820" fill="#86b96a"/><circle cx="${C.x}" cy="${C.y}" r="92" fill="#4b5262"/>`;
  for (const a of arms) bg += `<rect x="${C.x - 43}" y="${C.y - 330}" width="86" height="330" fill="#4b5262" transform="rotate(${DIRS[a]} ${C.x} ${C.y})"/>`;
  const shows = vehicles.map(v => { const w = add(C, mul(unit(v.from), WAIT + 34), mul(right(mul(unit(v.from), -1)), LANE)); return { t: 300, svg: label(w.x, w.y, v.id, { size: 15, color: "#fff" }) }; });

  // 3D: the junction, its signs, and the vehicles
  const props = [{ type: "radial", arms: arms.map(a => DIRS[a]) }];
  for (const s of P.signs || []) {
    if (!(s.arm in DIRS)) continue;
    const u = unit(s.arm), at = add(C, mul(u, WAIT + 28), mul(right(mul(u, -1)), LANE));
    const text = s.type === "stop" ? "STOP" : s.type === "giveWay" ? T("give way", "dare precedenza") : T("priority", "precedenza");
    props.push({ type: "label", x: at.x, y: at.y, text, t0: 600 });
    if (s.type === "stop") props.push({ type: "roadText", x: at.x, y: at.y, text: "STOP", size: 1.4 });
  }
  const names = g => g.join(T(" and ", " e "));
  const steps = [{ t: 0, text: T("Who goes first?", "Chi passa per primo?") },
    ...order.map((g, k) => ({ t: go(g[0]), text: T(`${k + 1}. ${names(g)}${g.length > 1 ? " together" : ""}`, `${k + 1}. ${names(g)}${g.length > 1 ? " insieme" : ""}`) })),
    { t: dur - 1400, text: P.caption || order.map(names).join(" → "), it: P.it }];
  return { duration: dur, bg, actors, shows, steps, verdict: P.verdict ? { ok: P.verdict !== "no" } : null,
    world3d: { road: "none", props, cam: "orbit", focusY: C.y, orbitR: 20, orbitH: 24, inset: q && q.image } };
}
