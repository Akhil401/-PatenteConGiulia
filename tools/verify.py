"""Independent check of the extracted JSON against the PDF.

Usage:  py tools/verify.py source/DomandeB.pdf app [n_spot]

Reads the PDF a second, different way (plain text stream, no coordinates)
and compares every question's number, Italian text and answer with the JSON.
Also prints n_spot random questions side by side (default 30).
"""
import sys, os, re, json, glob, random
import pymupdf as fitz

pdf_path, app = sys.argv[1], sys.argv[2]
n_spot = int(sys.argv[3]) if len(sys.argv) > 3 else 30
norm = lambda s: re.sub(r"\s+", " ", s).strip()


def join_lines(lines):
    out = ""
    for ln in lines:
        out = out + ln if out and re.search(r"[A-Za-zÀ-ÿ]-$", out) else (out + " " + ln if out else ln)
    return out

# ---- JSON side
qs = {}
dups = []
for f in sorted(glob.glob(os.path.join(app, "data", "chapters", "ch*.json"))):
    for q in json.load(open(f, encoding="utf-8"))["questions"]:
        if q["id"] in qs:
            dups.append(q["id"])
        qs[q["id"]] = q
idx = json.load(open(os.path.join(app, "data", "index.json"), encoding="utf-8"))

# ---- PDF side: plain text stream
doc = fitz.open(pdf_path)
noise = re.compile(r"^(Quesito n\S* \d+ - .*|Numero|domanda|Testo domanda|Risposta Corretta|Immagine|"
                   r"Ministero delle Infrastrutture e dei Trasporti)$")
heads = set()
pdf = {}
cur = None
for page in doc:
    for line in page.get_text().splitlines():
        line = line.strip()
        if not line or noise.match(line):
            continue
        if re.fullmatch(r"\d{5}", line):
            cur = line
            pdf[cur] = {"text": [], "ans": None, "page": page.number + 1}
            continue
        if cur is None:
            continue
        m = re.match(r"^(.*?)\s*\b(VERO|FALSO)$", line)
        if m and pdf[cur]["ans"] is None:
            if m.group(1):
                pdf[cur]["text"].append(m.group(1))
            pdf[cur]["ans"] = m.group(2) == "VERO"
        elif pdf[cur]["ans"] is None:
            pdf[cur]["text"].append(line)
        else:
            heads.add(line)   # text after the answer = wrapped chapter heading lines

problems = []
for num, p in pdf.items():
    q = qs.get("q" + num)
    if q is None:
        problems.append(("missing in JSON", num)); continue
    if q["answer"] is None or q["answer"] != p["ans"]:
        problems.append(("answer differs", num, q["answer"], p["ans"]))
    if norm(q["it"]) != norm(join_lines(p["text"])):
        problems.append(("text differs", num, q["it"], join_lines(p["text"])))
extra = set(qs) - {"q" + n for n in pdf}

print("PDF questions:", len(pdf), " JSON questions:", len(qs), " index total:", idx["totalQuestions"])
print("duplicate ids:", len(dups), " in JSON not in PDF:", len(extra))
print("empty text:", sum(1 for q in qs.values() if not q["it"].strip()),
      " empty answers:", sum(1 for q in qs.values() if q["answer"] is None))
print("chapter counts match index:",
      all(c["count"] == sum(1 for q in qs.values() if q["chapter"] == c["id"]) for c in idx["chapters"]))
print("VERO:", sum(q["answer"] for q in qs.values()), " FALSO:", sum(not q["answer"] for q in qs.values()))
missing_img = [q["id"] for q in qs.values() if q["image"] and not os.path.exists(os.path.join(app, q["image"]))]
print("image files missing:", len(missing_img))
print("lines ignored after an answer (wrapped headings):", sorted(heads)[:8])
print("mismatches:", len(problems))
for p in problems[:40]:
    print("  ", p)

random.seed(2026)
print("\n==== %d random spot checks ====" % n_spot)
for num in random.sample(sorted(pdf), n_spot):
    q, p = qs["q" + num], pdf[num]
    ok = norm(q["it"]) == norm(join_lines(p["text"])) and q["answer"] == p["ans"]
    print("%s %s p%-3d %-5s %-5s | %s" % ("OK " if ok else "BAD", num, p["page"],
          "VERO" if p["ans"] else "FALSO", "VERO" if q["answer"] else "FALSO", q["it"][:95]))
