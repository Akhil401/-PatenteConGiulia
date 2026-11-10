"""Check one content batch written by a helper.

Usage:  py -P -E tools/check_batch.py ch02.c

The batch's groups come from the plan file tools/batches.json.
Prints every problem found, or OK.
"""
import sys, os, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
SCENES = {"overtake.basic", "overtake.blocked", "overtake.allowed", "overtake.right", "overtake.space",
          "overtake.beingOvertaken", "overtake.motorway", "rulecard", "sign", "figure", "roadparts"}
ACTIONS = {"slow", "stop", "giveWay", "priority", "noEntry", "noOvertake", "turnLeft", "turnRight", "straight", "keepRight", "keepLeft",
           "noTurnLeft", "noTurnRight", "noUTurn", "speedLimit", "endLimit", "park", "noParking", "noStopping", "info"}
PARTS = {"carreggiata", "corsia", "banchina", "marciapiede", "pistaCiclabile", "spartitraffico", "passaggioPedonale", "intersezione", "corsiaEmergenza"}
ICONS = set("car truck bus tram moto bike pedestrian police ambulance eye mirror indicator horn highbeam speed distance warning check cross road curve hill fog rain snow night wind train light sign book money points alcohol seatbelt child firstaid fuel leaf tyre brake engine".split())

batch = sys.argv[1]
ch = batch.split(".")[0]
plan = json.load(open(os.path.join(ROOT, "tools", "batches.json"), encoding="utf-8"))
groups = set(plan[batch])
chap = json.load(open(os.path.join(APP, "data", "chapters", ch + ".json"), encoding="utf-8"))
qs = {q["id"]: q for q in chap["questions"] if q["group"] in groups}
P = []

def load(kind):
    p = os.path.join(APP, "data", kind, batch + ".json")
    if not os.path.exists(p):
        P.append("missing file %s" % p); return {}
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception as e:
        P.append("%s is not valid JSON: %s" % (p, e)); return {}

en, it, ck, gr = load("en"), load("it"), load("chunks"), load("groups")
for name, d in (("en", en), ("it", it), ("chunks", ck)):
    miss = sorted(set(qs) - set(d)); extra = sorted(set(d) - set(qs))
    if miss: P.append("%s: missing ids %s" % (name, miss[:12]))
    if extra: P.append("%s: ids not in this batch %s" % (name, extra[:12]))
for g in groups:
    if str(g) not in gr: P.append("groups: missing group %s" % g)
    else:
        for f in ("title", "titleIt", "en", "it"):
            if not gr[str(g)].get(f): P.append("groups: %s has empty %s" % (g, f))

for qid, q in qs.items():
    e = en.get(qid)
    if e:
        x = e.get("explain", {})
        for f in ("short", "rule", "trap"):
            if not x.get(f): P.append("%s: explain.%s empty" % (qid, f))
        if not e.get("en"): P.append("%s: en empty" % qid)
        if re.match(r"^\s*(true|false)\b", x.get("short", ""), re.I): P.append("%s: short starts with True/False" % qid)
        sc, sp = x.get("scene"), x.get("sceneParams", {})
        if sc not in SCENES: P.append("%s: unknown scene %r" % (qid, sc))
        for f in ("verdict", "caption", "it"):
            if f not in sp: P.append("%s: sceneParams.%s missing" % (qid, f))
        if sp.get("verdict") not in ("ok", "no"): P.append("%s: verdict must be ok/no" % qid)
        if len(sp.get("caption", "")) > 70: P.append("%s: caption too long" % qid)
        if sc == "sign" and sp.get("action") not in ACTIONS: P.append("%s: sign action %r invalid" % (qid, sp.get("action")))
        if sc == "sign" and not q.get("image"): P.append("%s: sign scene but the question has no image" % qid)
        if sc == "figure" and not q.get("image"): P.append("%s: figure scene but the question has no image" % qid)
        if sc == "roadparts" and sp.get("part") not in PARTS: P.append("%s: roadparts part %r invalid" % (qid, sp.get("part")))
        if sc in ("rulecard", "figure"):
            ls = sp.get("lines") or []
            if not ls: P.append("%s: %s needs lines" % (qid, sc))
            if sc == "rulecard" and len(sp.get("icons") or []) != len(ls): P.append("%s: icons/lines count differ" % qid)
            if sc == "rulecard" and any(i not in ICONS for i in sp.get("icons") or []): P.append("%s: unknown icon" % qid)
            iv = (it.get(qid) or {}).get("lines") or []
            if len(iv) != len(ls): P.append("%s: Italian lines count differs from English" % qid)
        kws = e.get("keywords") or []
        if not 1 <= len(kws) <= 6: P.append("%s: need 2-5 keywords" % qid)
        low = q["it"].lower().replace("’", "'")
        for k in kws:
            if k.get("it", "").lower() not in low: P.append("%s: keyword %r not in the statement" % (qid, k.get("it")))
    i = it.get(qid)
    if i:
        for f in ("short", "rule", "trap", "caption"):
            if not i.get(f): P.append("%s: Italian %s empty" % (qid, f))
    c = ck.get(qid)
    if c:
        ch_ = c.get("chunks") or []
        if " ".join(x.get("it", "") for x in ch_) != q["it"]: P.append("%s: chunks do not rebuild the official text exactly" % qid)
        if not 2 <= len(ch_) <= 6 and len(q["it"].split()) > 3: P.append("%s: need 2-6 chunks" % qid)
        nk = sum(1 for x in ch_ if x.get("key"))
        if not 1 <= nk <= 2: P.append("%s: need 1-2 key chunks" % qid)
        want_en, want_it = ("So it is TRUE.", "Quindi è VERO.") if q["answer"] else ("So it is FALSE.", "Quindi è FALSO.")
        if not c.get("note", "").strip().endswith(want_en): P.append("%s: note must end with %r" % (qid, want_en))
        if not c.get("noteIt", "").strip().endswith(want_it): P.append("%s: noteIt must end with %r" % (qid, want_it))

if P:
    print("%d problem(s):" % len(P))
    for p in P[:80]:
        print(" -", p)
    sys.exit(1)
print("OK: %d questions, %d groups" % (len(qs), len(groups)))
