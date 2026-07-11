import json, pathlib, re, sys

errors = []
warnings = []

# Check 1: index.json data integrity
idx = json.loads(pathlib.Path("src/data/gaokao-questions/index.json").read_text("utf-8"))
total_q = 0
total_opts = 0

for ch, qs in idx.items():
    for q in qs:
        total_q += 1
        p = q.get("prompt", "")
        
        # Check for remaining \( or \)
        if "\\(" in p or "\\)" in p:
            errors.append(f"[{ch}] Q{q.get('number')}: prompt has \\( or \\)")
        
        # Check for corrupted \neg patterns
        if "\\\\n\\\\" in p:  # \n\\ (newline + double backslash)
            errors.append(f"[{ch}] Q{q.get('number')}: corrupted \\\\n\\\\\\\\ in prompt")
        
        # Check options
        for o in q.get("options", []):
            total_opts += 1
            t = o.get("text", "")
            if "\\(" in t or "\\)" in t:
                errors.append(f"[{ch}] Q{q.get('number')} opt {o['label']}: has \\( or \\)")
            
            # Check for standalone "eg " not part of "\\neg "
            # Find "eg " preceded by NOT "n" (i.e., corrupted)
            for m in re.finditer(r"eg ", t):
                pos = m.start()
                if pos == 0 or t[pos-1] != "n":
                    errors.append(f"[{ch}] Q{q.get('number')} opt {o['label']}: corrupted 'eg ' at position {pos}")
            
            if "\\\\n\\\\" in t:
                errors.append(f"[{ch}] Q{q.get('number')} opt {o['label']}: corrupted \\\\n\\\\\\\\ in option")

# Check 2: Images exist
img_dir = pathlib.Path("public/gaokao-images")
mapping_file = img_dir / "_mapping.json"
if mapping_file.exists():
    mapping = json.loads(mapping_file.read_text("utf-8"))
else:
    warnings.append("No image mapping file found")

for ch, qs in idx.items():
    for q in qs:
        for img_path in q.get("images", []):
            # img_path is like "/gaokao-images/xxx.png"
            local_path = img_dir / pathlib.Path(img_path).name
            if not local_path.exists():
                errors.append(f"[{ch}] Q{q.get('number')}: image not found: {img_path}")

# Check 3: Paper JSON files consistency
paper_dir = pathlib.Path("src/data/gaokao-questions")
paper_counts = 0
for fp in paper_dir.rglob("*.json"):
    if fp.name == "index.json" or fp.name.startswith("_"):
        continue
    try:
        d = json.loads(fp.read_text("utf-8"))
        if "questions" in d:
            paper_counts += len(d["questions"])
    except:
        pass

# Summary
print("=" * 50)
print(f"VALIDATION REPORT")
print(f"Total questions in index: {total_q}")
print(f"Total options: {total_opts}")
print(f"Total in paper files: {paper_counts}")
print(f"Errors: {len(errors)}")
print(f"Warnings: {len(warnings)}")
print("=" * 50)

for e in errors:
    print(f"  ERROR: {e}")
for w in warnings:
    print(f"  WARN: {w}")

if errors:
    print(f"\n  FAILED: {len(errors)} issues found!")
    sys.exit(1)
else:
    print("\n  ✅ ALL CHECKS PASSED")
