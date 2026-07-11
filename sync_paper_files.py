import pathlib, json

# Load index (cleaned data)
idx = json.loads(pathlib.Path("src/data/gaokao-questions/index.json").read_text("utf-8"))

# Build a lookup: (paper, number) -> cleaned data
clean = {}
for ch, qs in idx.items():
    for q in qs:
        key = (q["paper"], q["number"])
        if key not in clean:
            clean[key] = {
                "prompt": q.get("prompt", ""),
                "options": q.get("options", []),
                "images": q.get("images", [])
            }

# Process each source paper file  
total_synced = 0
total_skipped = 0

for fp in sorted(pathlib.Path("src/data/gaokao-questions").rglob("*.json")):
    if fp.name == "index.json" or fp.name.startswith("_"):
        continue
    
    data = json.loads(fp.read_text("utf-8"))
    if "questions" not in data:
        continue
    
    changed = False
    for q in data["questions"]:
        num = q.get("number")
        paper = data.get("paper", "")
        key = (paper, num)
        
        if key in clean:
            cleaned = clean[key]
            old_prompt = q.get("prompt", "")
            new_prompt = cleaned["prompt"]
            
            if old_prompt != new_prompt:
                q["prompt"] = new_prompt
                q["options"] = cleaned["options"]
                if cleaned["images"]:
                    q["images"] = cleaned["images"]
                changed = True
                total_synced += 1
        else:
            total_skipped += 1
    
    if changed:
        fp.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
        print(f"  Updated: {fp.parent.name}/{fp.name}")

print(f"\nSynced: {total_synced} questions")
print(f"Skipped (no index match): {total_skipped} questions")
