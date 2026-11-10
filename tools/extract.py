"""Extract the official Patente B question list (DomandeB.pdf) into JSON.

Usage:  py tools/extract.py source/DomandeB.pdf app

Writes:
  app/data/index.json              chapters, counts, metadata
  app/data/chapters/chNN.json      questions of one chapter
  app/images/<hash>.<ext>          each figure once

The Italian text and the VERO/FALSO answer are taken from the PDF as-is
(only line breaks are joined with a single space). English fields are left
empty for Phase C.  Re-running keeps any English already written.
"""
import sys, os, re, json, hashlib, collections
import pymupdf as fitz

# Official chapter order of the Patente B syllabus (25 topics).
# Matched by the start of the (sometimes truncated) heading in the PDF.
CHAPTERS = [
    ("Definizioni stradali e di traffico", "Road and traffic definitions, vehicle types, driver duties"),
    ("Segnali di pericolo", "Danger signs"),
    ("Segnali di divieto", "Prohibition signs"),
    ("Segnali di obbligo", "Mandatory (obligation) signs"),
    ("Segnali di precedenza", "Priority signs"),
    ("Segnaletica orizzontale", "Road markings and markings on obstacles"),
    ("Segnalazioni semaforiche", "Traffic lights and police officer signals"),
    ("Segnali di indicazione", "Information signs"),
    ("Segnali complementari", "Complementary, temporary and roadworks signs"),
    ("Pannelli integrativi", "Supplementary panels under signs"),
    ("Limiti di velocit", "Speed limits, danger and obstruction, level crossings"),
    ("Distanza di sicurezza", "Safe following distance"),
    ("Norme sulla circol", "Traffic rules: position on the road, changing lane and turning"),
    ("Esempi di precedenza", "Right of way at junctions (examples)"),
    ("Norme sul sorpasso", "Overtaking rules"),
    ("Fermata, sosta", "Stopping, parking, halting and moving off"),
    ("Ingombro della carreggiata", "Blocking the road, broken-down vehicle, motorways and extra-urban roads"),
    ("Uso delle luci", "Use of lights and horn, dashboard warning lights"),
    ("Dispositivi di equipaggiamento", "Equipment: seat belts, child seats, helmets"),
    ("Patenti di guida", "Driving licences, vehicle documents, penalties, points licence"),
    ("Comportamenti per prevenire", "Preventing accidents and what to do in an accident"),
    ("Guida in relazione", "Fitness to drive: alcohol, drugs, medicines, first aid"),
    ("Responsabilit", "Civil, criminal and administrative liability; insurance"),
    ("Limitazione dei consumi", "Fuel saving, environment and pollution"),
    ("Elementi costitutivi del veicolo", "Vehicle parts, maintenance, stability and road holding"),
]

NUM_X_MAX = 55      # question-number column
ANS_X_MIN = 353     # VERO / FALSO column
IMG_X_MIN = 460     # image column
HEADER_RE = re.compile(r"^Quesito n\S*\s*(\d+)\s*-\s*(.*)$")
SKIP_BLOCK_RE = re.compile(r"^(Quesito n|Numero\s*\n?domanda|Testo domanda|Ministero delle Infrastrutture)")


def chapter_index(title):
    for i, (prefix, _) in enumerate(CHAPTERS):
        if title.startswith(prefix):
            return i + 1
    raise ValueError("Unknown chapter heading: %r" % title)


def join_lines(lines):
    """Join wrapped lines with a space; a line ending in 'letter-' continues the word
    (e.g. 'air-' + 'bag' -> 'air-bag')."""
    out = ""
    for ln in lines:
        if out and re.search(r"[A-Za-zÀ-ÿ]-$", out):
            out += ln
        else:
            out = (out + " " + ln) if out else ln
    return out


def in_rect(w, r):
    cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    return r[0] - 1 <= cx <= r[2] + 1 and r[1] - 1 <= cy <= r[3] + 1


def extract(pdf_path, out_dir):
    doc = fitz.open(pdf_path)
    img_dir = os.path.join(out_dir, "images")
    os.makedirs(img_dir, exist_ok=True)
    img_cache = {}          # xref -> relative path
    img_files = set()
    events = []             # (page, y, kind, payload)
    questions = []

    for pno, page in enumerate(doc):
        blocks = page.get_text("blocks")
        skip_rects = []
        table_tops = sorted(b[1] for b in blocks if re.match(r"^Numero\s*\n?domanda", b[4]))
        all_words = page.get_text("words")
        for b in blocks:
            text = b[4]
            if SKIP_BLOCK_RE.match(text):
                skip_rects.append(b[:4])
            m = HEADER_RE.match(text.split("\n")[0].strip())
            if m:
                below = [t for t in table_tops if t > b[1]]
                # heading at the page bottom: its table starts on the next page
                band_end = below[0] - 0.5 if below else page.rect.height
                band = (0, b[1] - 1, page.rect.width, band_end)
                skip_rects.append(band)
                # full (possibly wrapped) heading text inside the band
                bw = sorted((w for w in all_words if in_rect(w, band)), key=lambda w: (round(w[1]), w[0]))
                full = " ".join(w[4] for w in bw)
                full = HEADER_RE.match(full).group(2).strip() if HEADER_RE.match(full) else m.group(2).strip()
                events.append((pno, b[1], "H", (int(m.group(1)), full)))
        words = [w for w in all_words if not any(in_rect(w, r) for r in skip_rects)]
        starts = sorted((w[1], w[4]) for w in words if w[0] < NUM_X_MAX and re.fullmatch(r"\d{4,6}", w[4]))
        imgs = [i for i in page.get_image_info(xrefs=True) if i["bbox"][0] >= IMG_X_MIN]
        for k, (y, num) in enumerate(starts):
            y_end = starts[k + 1][0] if k + 1 < len(starts) else page.rect.height
            row = [w for w in words if y - 2 <= w[1] < y_end - 2]
            text_words = sorted((w for w in row if NUM_X_MAX <= w[0] < ANS_X_MIN),
                                key=lambda w: (w[5], w[6], w[7]))
            ans_words = [w[4] for w in row if w[0] >= ANS_X_MIN and w[4] in ("VERO", "FALSO")]
            other = [w[4] for w in row if w[0] >= ANS_X_MIN and w[4] not in ("VERO", "FALSO")]
            # rebuild lines (block, line) and join with single spaces
            lines = collections.OrderedDict()
            for w in text_words:
                lines.setdefault((w[5], w[6]), []).append(w[4])
            text = join_lines([" ".join(ws) for ws in lines.values()])
            image = None
            row_imgs = [i for i in imgs if y - 4 <= i["bbox"][1] < y_end - 2]
            if row_imgs:
                xref = row_imgs[0]["xref"]
                if xref not in img_cache:
                    data = doc.extract_image(xref)
                    h = hashlib.md5(data["image"]).hexdigest()[:12]
                    name = "%s.%s" % (h, data["ext"])
                    if name not in img_files:
                        with open(os.path.join(img_dir, name), "wb") as f:
                            f.write(data["image"])
                        img_files.add(name)
                    img_cache[xref] = "images/" + name
                image = img_cache[xref]
            q = {"num": int(num), "page": pno + 1, "y": y, "it": text,
                 "answers": ans_words, "extra": other, "image": image,
                 "n_imgs": len(row_imgs)}
            questions.append(q)
            events.append((pno, y, "Q", q))

    # assign each question to the latest heading above it (reading order)
    events.sort(key=lambda e: (e[0], e[1], 0 if e[2] == "H" else 1))
    cur = None
    for _, _, kind, payload in events:
        if kind == "H":
            cur = payload
        else:
            payload["group"], payload["title"] = cur
    return doc, questions, len(img_files)


def main():
    pdf_path, out_dir = sys.argv[1], sys.argv[2]
    doc, qs, n_img = extract(pdf_path, out_dir)
    problems = [q for q in qs if len(q["answers"]) != 1 or q["extra"] or not q["it"] or q["n_imgs"] > 1]
    chapters = collections.defaultdict(list)
    titles = {}
    for q in qs:
        ci = chapter_index(q["title"])
        titles.setdefault(ci, collections.Counter())[q["title"]] += 1
        chapters[ci].append(q)

    data_dir = os.path.join(out_dir, "data", "chapters")
    os.makedirs(data_dir, exist_ok=True)
    index = {"source": os.path.basename(pdf_path),
             "sourceCreated": doc.metadata.get("creationDate"),
             "totalQuestions": len(qs), "totalImages": n_img, "chapters": []}
    for ci in sorted(chapters):
        cid = "ch%02d" % ci
        path = os.path.join(data_dir, cid + ".json")
        old = {}
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                old = {o["id"]: o for o in json.load(f)["questions"]}
        out = []
        for q in sorted(chapters[ci], key=lambda q: (q["group"], q["num"])):
            qid = "q%d" % q["num"]
            o = old.get(qid, {})
            out.append({
                "id": qid,
                "chapter": cid,
                "group": q["group"],
                "it": q["it"],
                "answer": q["answers"][0] == "VERO" if q["answers"] else None,
                "image": q["image"],
                "en": o.get("en", ""),
                "explain": o.get("explain", {"short": "", "rule": "", "trap": "", "scene": None, "sceneParams": {}}),
                "keywords": o.get("keywords", []),
                "motoOnly": False,
                "hidden": o.get("hidden", False),
                "review": o.get("review", False),
                "src": {"page": q["page"]},
            })
        it_title = titles[ci].most_common(1)[0][0]
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"id": cid, "n": ci, "titleIt": it_title, "titleEn": CHAPTERS[ci - 1][1],
                       "questions": out}, f, ensure_ascii=False, indent=1)
        index["chapters"].append({"id": cid, "n": ci, "titleIt": it_title, "titleEn": CHAPTERS[ci - 1][1],
                                  "count": len(out), "groups": len({q["group"] for q in out}),
                                  "withImage": sum(1 for q in out if q["image"])})
    with open(os.path.join(out_dir, "data", "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    print("questions", len(qs), "images", n_img, "problems", len(problems))
    for p in problems[:20]:
        print("  PROBLEM", p["num"], "p", p["page"], p["answers"], p["extra"], p["n_imgs"], repr(p["it"][:60]))
    for c in index["chapters"]:
        print("%s %5d q %4d groups %5d img  %s" % (c["id"], c["count"], c["groups"], c["withImage"], c["titleEn"]))


if __name__ == "__main__":
    main()
