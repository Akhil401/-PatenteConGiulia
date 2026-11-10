import json, glob, re, collections
qs=[q for f in sorted(glob.glob("app/data/chapters/ch*.json")) for q in json.load(open(f,encoding="utf-8"))["questions"]]
fig=re.compile(r"\b(figura|raffigurat\w*|rappresentat\w* in|illustrat\w*)\b", re.I)
noimg=[q for q in qs if fig.search(q["it"]) and not q["image"]]
print("mention a figure but no image:", len(noimg))
for q in noimg[:15]: print("  ", q["id"], q["chapter"], q["it"][:110])
hy=[q for q in qs if re.search(r"\w- \w", q["it"])]
print("hyphen + space inside text:", len(hy))
for q in hy[:15]: print("  ", q["id"], re.search(r".{0,25}\w- \w.{0,15}", q["it"]).group(0))
imgq=collections.Counter(q["image"] for q in qs if q["image"])
print("questions with image:", sum(imgq.values()), "distinct images used:", len(imgq))
