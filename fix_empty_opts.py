import json

c = open("src/data/gaokao-questions/index.json", "r", encoding="utf-8").read()
idx = json.loads(c)

fixes = 0
for ch, qs in idx.items():
    for q in qs:
        for o in q.get("options", []):
            t = o.get("text")
            if t is None or t == "":
                o["text"] = "\u2014"
                fixes += 1

print(f"Fixed {fixes} empty/null options")

if fixes > 0:
    open("src/data/gaokao-questions/index.json", "w", encoding="utf-8").write(
        json.dumps(idx, ensure_ascii=False, indent=2)
    )
    print("Saved index.json")

# Also fix source files
for fp in __import__("pathlib").Path("src/data/gaokao-questions").rglob("*.json"):
    if fp.name == "index.json" or fp.name.startswith("_"):
        continue
    try:
        data = json.loads(fp.read_text("utf-8"))
        fixed = False
        if "questions" in data:
            for q in data["questions"]:
                for o in q.get("options", []):
                    t = o.get("text")
                    if t is None or t == "":
                        o["text"] = "\u2014"
                        fixed = True
                        fixes += 1
        if fixed:
            fp.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
    except:
        pass

print(f"Total fixes (index + paper files): {fixes}")
