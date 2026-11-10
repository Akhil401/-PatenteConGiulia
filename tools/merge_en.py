"""Merge English (app/data/en) and simple-Italian (app/data/it) explanation files into the chapter files.

Usage:  py tools/merge_en.py app

Only the English fields are written (en, explain, keywords, review, reviewNote).
The official Italian text and answer are never touched. A chapter is listed in
app/data/ready.json when every question has a translation and an explanation.
"""
import sys, os, json, glob, re

app = sys.argv[1]
SCENES = {"overtake.basic", "overtake.blocked", "overtake.allowed", "overtake.right", "overtake.space",
          "overtake.beingOvertaken", "overtake.motorway", "rulecard", "sign", "figure", "roadparts"}
ready, problems = [], []
for path in sorted(glob.glob(os.path.join(app, "data", "chapters", "ch*.json"))):
    ch = json.load(open(path, encoding="utf-8"))
    cid = ch["id"]
    parts = sorted(glob.glob(os.path.join(app, "data", "en", cid + ".*.json")))
    en = {}
    for p in parts:
        for k, v in json.load(open(p, encoding="utf-8")).items():
            if k in en:
                problems.append("%s: %s appears in two English files" % (cid, k))
            en[k] = v
    ids = {q["id"] for q in ch["questions"]}
    for k in en:
        if k not in ids:
            problems.append("%s: English for unknown id %s" % (cid, k))
    for q in ch["questions"]:
        v = en.get(q["id"])
        if not v:
            continue
        q["en"] = v.get("en", "")
        q["explain"] = v.get("explain", q["explain"])
        q["keywords"] = v.get("keywords", [])
        q["review"] = bool(v.get("review", False))
        q["reviewNote"] = v.get("reviewNote", "")
        sc = q["explain"].get("scene")
        if sc and sc not in SCENES:
            problems.append("%s: unknown scene %s" % (q["id"], sc))
        for kw in q["keywords"]:
            if kw["it"].lower() not in q["it"].lower().replace("’", "'"):
                problems.append("%s: keyword '%s' not in the statement" % (q["id"], kw["it"]))
    # Italian explanations (simple Italian), same ids: app/data/it/chNN.*.json
    it_parts = sorted(glob.glob(os.path.join(app, "data", "it", cid + ".*.json")))
    itx = {}
    for p in it_parts:
        itx.update(json.load(open(p, encoding="utf-8")))
    for k in itx:
        if k not in ids:
            problems.append("%s: Italian explanation for unknown id %s" % (cid, k))
    for q in ch["questions"]:
        v = itx.get(q["id"])
        if v:
            q["explainIt"] = {f: v[f] for f in ("short", "rule", "trap", "caption", "lines") if v.get(f)}
            if q["explain"].get("scene") == "rulecard" and len(v.get("lines") or []) != len(q["explain"]["sceneParams"].get("lines") or []):
                problems.append("%s: Italian rule card has a different number of lines" % q["id"])
    # sentence breakdowns: app/data/chunks/chNN.*.json  (chunks must rebuild the official text exactly)
    ck_parts = sorted(glob.glob(os.path.join(app, "data", "chunks", cid + ".*.json")))
    chunks = {}
    for p in ck_parts:
        chunks.update(json.load(open(p, encoding="utf-8")))
    for q in ch["questions"]:
        v = chunks.get(q["id"])
        if not v:
            continue
        joined = " ".join(c["it"] for c in v["chunks"])
        if joined != q["it"]:
            problems.append("%s: chunks do not rebuild the official text" % q["id"])
            continue
        if not any(c.get("key") for c in v["chunks"]):
            problems.append("%s: no key chunk" % q["id"])
        q["chunks"] = v["chunks"]
        q["note"] = v.get("note", "")
        q["noteIt"] = v.get("noteIt", "")
    # topic rules of thumb per group: app/data/groups/chNN.json or chNN.<part>.json
    g_parts = sorted(glob.glob(os.path.join(app, "data", "groups", cid + ".json")) + glob.glob(os.path.join(app, "data", "groups", cid + ".*.json")))
    if g_parts:
        ch["groups"] = {}
        for p in g_parts:
            ch["groups"].update(json.load(open(p, encoding="utf-8")))
        for g in sorted({str(q["group"]) for q in ch["questions"]}):
            if g not in ch["groups"]:
                problems.append("%s: group %s has no rule of thumb" % (cid, g))
    if parts or it_parts or ck_parts or g_parts:
        json.dump(ch, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if all(q["en"] and q["explain"].get("short") for q in ch["questions"] if not q.get("hidden")):
        ready.append(cid)
json.dump({"chapters": ready}, open(os.path.join(app, "data", "ready.json"), "w", encoding="utf-8"))
print("ready chapters:", ready)
print("problems:", len(problems))
for p in problems:
    print("  ", p)
