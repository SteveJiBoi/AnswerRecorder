#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parse all TOEFL answer documents (.docx / .pdf) into a clean dataset.

Output: tasks.js  ->  window.TOEFL_TASKS = [ {name, reading:[mod...], listening:[mod...], writing:{m1:[...]}}, ... ]
Each module is an ordered list of items: {n, type:'fill'|'mc', ans} where ans is null if the key marks it blank ('/').
"""
import os, re, json, sys

# Folder containing the answer documents (.docx / .pdf).
# Override by passing a path as the first command-line argument:
#   python3 parse_answers.py "/path/to/答案"
ANS_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))

TOKEN_RE = re.compile(r"(\d+)\s*([A-Za-z/][A-Za-z'/]*)")
BREAK = "\x00BREAK\x00"
PUNCT_RE = re.compile(r"[\s,，:：.。;；!！?？、)\]】]+")

def detect_header(line):
    """Identify section headers / module markers across all doc formats.
    Returns (signal, is_module2). signal is one of: 'reading','listening','writing',
    'speaking', '__break__' (force new module in current section), or None."""
    n = PUNCT_RE.sub("", line).lower()
    if not n:
        return None, False
    section = None
    if n.startswith("reading") or n.startswith("阅读") or n.startswith("答案"):
        section = "reading"
    elif n.startswith("listening") or n.startswith("听力"):
        section = "listening"
    elif n.startswith("writing") or n.startswith("写作"):
        section = "writing"
    elif n.startswith("speaking") or n.startswith("口语"):
        section = "speaking"
    if section:
        m2 = ("module2" in n) or ("加试" in n) or ("第二部" in n) or ("第2部" in n)
        return section, m2
    if n.startswith("module2") or n.startswith("加试") or n.startswith("第二部") or n.startswith("第2部"):
        return "__break__", True
    if n.startswith("module1"):
        return "__break__", False
    return None, False

def extract_text(path):
    ext = path.lower().rsplit(".", 1)[-1]
    if ext == "docx":
        import docx
        d = docx.Document(path)
        return "\n".join(p.text for p in d.paragraphs)
    else:
        import pdfplumber
        out = []
        with pdfplumber.open(path) as pdf:
            for pg in pdf.pages:
                out.append(pg.extract_text() or "")
        return "\n".join(out)

_SPELL = None
def fills_dubious(module):
    """Detect a defective fill-answer key (truncated word fragments, e.g. the 2026-series
    PDFs where '1 transformation' renders as '1 t'). Returns True if the module's fill
    answers are mostly not real English words."""
    global _SPELL
    fills = [it["ans"] for it in module if it["type"] == "fill" and it["ans"]]
    if len(fills) < 5:
        return False
    try:
        if _SPELL is None:
            from spellchecker import SpellChecker
            _SPELL = SpellChecker()
        unknown = _SPELL.unknown([f.lower() for f in fills])
        return (len(unknown) / len(fills)) > 0.25
    except Exception:
        return False

def classify(val):
    v = val.strip()
    if v == "/" or v == "":
        return ("blank", None)
    if len(v) == 1 and v.lower() in "abcdefg":
        return ("mc", v.lower())
    return ("fill", v.lower())

def parse_qa_section(lines):
    """lines: content lines (may include BREAK sentinels) for a reading/listening section.
    Returns list of modules; each module = list of {n,type,ans}."""
    modules = [[]]
    def cur():
        return modules[-1]
    def new_module():
        if cur():
            modules.append([])
    for raw in lines:
        if raw == BREAK:
            new_module()
            continue
        for num_s, val in TOKEN_RE.findall(raw):
            n = int(num_s)
            typ, ans = classify(val)
            # new module only on a true reset to question 1 (handles missing markers like 5.11)
            if n == 1 and cur():
                new_module()
            cur().append({"n": n, "type": typ, "ans": ans})
    # dedupe duplicate question numbers within a module (e.g. 3.16 "28c 28d"): keep first
    out = []
    for m in modules:
        if not m:
            continue
        seen, dd = set(), []
        for it in m:
            if it["n"] in seen:
                continue
            seen.add(it["n"])
            dd.append(it)
        out.append(dd)
    return out

SUBTITLE_RE = re.compile(r"(buildasentence|makean|appropriatesentence|listenandrepeat|makeanappropriate)")

def parse_writing(lines):
    raw = []
    for line in lines:
        if line == BREAK:
            continue
        s = line.strip()
        if not s:
            continue
        if SUBTITLE_RE.search(PUNCT_RE.sub("", s).lower()):
            continue  # skip "Build a sentence." / "Make an appropriate sentence" subtitles
        raw.append(s)
    numbered = [s for s in raw if re.match(r"^\d+\s*[\.\)、]", s)]
    chosen = numbered if numbered else raw
    out = [re.sub(r"^\d+\s*[\.\)、]\s*", "", s).strip() for s in chosen]
    return [s for s in out if s]

def parse_doc(path):
    text = extract_text(path)
    secs = {"reading": [], "listening": [], "writing": [], "speaking": []}
    cur = None
    for line in text.split("\n"):
        if not line.strip():
            continue
        sig, m2 = detect_header(line)
        if sig in ("reading", "listening"):
            cur = sig
            if m2:
                secs[cur].append(BREAK)
            secs[cur].append(line)  # capture any inline answers (e.g. "加试1a 2a ...")
            continue
        if sig in ("writing", "speaking"):
            cur = sig
            continue
        if sig == "__break__":
            if cur in ("reading", "listening"):
                secs[cur].append(BREAK)
                secs[cur].append(line)  # inline answers after a bare module marker
            continue
        if cur is None:  # answers appearing before any header => assume reading
            cur = "reading"
        secs[cur].append(line)
    reading = parse_qa_section(secs["reading"])
    listening = parse_qa_section(secs["listening"])

    # Normalization: listening is all-MC. A listening module that is word-heavy is mislabeled reading content.
    keep_listen, moved = [], []
    for mod in listening:
        fills = sum(1 for it in mod if it["type"] == "fill")
        if fills >= 3:
            moved.append(mod)
        else:
            keep_listen.append(mod)
    if moved:
        reading.extend(moved)
        listening = keep_listen

    writing = parse_writing(secs["writing"])
    name = os.path.splitext(os.path.basename(path))[0]
    reading_mods = [{"items": m, "dubiousFills": fills_dubious(m)} for m in reading]
    listening_mods = [{"items": m} for m in listening]
    return {
        "name": name,
        "reading": reading_mods,
        "listening": listening_mods,
        "writing": writing,
    }

def fmt_counts(modules):
    parts = []
    for mod in modules:
        m = mod["items"]
        f = sum(1 for it in m if it["type"] == "fill")
        c = sum(1 for it in m if it["type"] == "mc")
        b = sum(1 for it in m if it["type"] == "blank")
        tag = "f" + ("!" if mod.get("dubiousFills") else "")
        parts.append(f"{f}{tag}/{c}c" + (f"/{b}x" if b else ""))
    return " ".join(parts) if parts else "-"

def main():
    files = sorted(
        [f for f in os.listdir(ANS_DIR) if f.lower().endswith((".docx", ".pdf")) and not f.startswith("~")],
        key=lambda x: x,
    )
    tasks = []
    print(f"Found {len(files)} documents\n")
    for f in files:
        path = os.path.join(ANS_DIR, f)
        try:
            t = parse_doc(path)
        except Exception as e:
            print(f"!! ERROR parsing {f}: {e}")
            continue
        tasks.append(t)
        rtot = sum(len(m["items"]) for m in t["reading"])
        ltot = sum(len(m["items"]) for m in t["listening"])
        flag = ""
        # expected: reading 35+15=50, listening 32+15=47
        if rtot not in (50,): flag += " R?"
        if ltot not in (47,): flag += " L?"
        if any(m.get("dubiousFills") for m in t["reading"]): flag += " FILLKEY!"
        print(f"{t['name'][:22]:24} | R[{len(t['reading'])}]: {fmt_counts(t['reading']):22} (={rtot}) | "
              f"L[{len(t['listening'])}]: {fmt_counts(t['listening']):16} (={ltot}) | W:{len(t['writing'])}{flag}")

    # natural sort by date for nicer ordering (M.D)
    def sortkey(t):
        m = re.match(r"(\d+)\.(\d+)", t["name"])
        return (int(m.group(1)), int(m.group(2))) if m else (99, 99)
    tasks.sort(key=sortkey)

    here = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(here, "data")
    out_path = os.path.join(data_dir if os.path.isdir(data_dir) else here, "tasks.js")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write("// Auto-generated from answer documents. Do not edit by hand.\n")
        fh.write("window.TOEFL_TASKS = ")
        fh.write(json.dumps(tasks, ensure_ascii=False, indent=1))
        fh.write(";\n")
    print(f"\nWrote {len(tasks)} tasks -> {out_path}")

if __name__ == "__main__":
    main()
