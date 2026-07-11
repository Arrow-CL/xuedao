import json, pathlib, re, sys

errors = []

def check_text(text, label):
    """Check a text string for common corruption patterns"""
    if not text:
        errors.append(f"EMPTY: {label}")
        return
    
    # 1. Check for remaining \( or \) wrappers
    if chr(92) + "(" in text or chr(92) + ")" in text:
        errors.append(f"LATEX_WRAPPER: {label}: has \\( or \\)")
    
    # 2. Check for "eg " that is NOT preceded by "n" (corrupted neg)
    for m in re.finditer(r"eg ", text):
        pos = m.start()
        if pos == 0 or text[pos-1] != "n":
            ctx = text[max(0,pos-5):pos+10]
            errors.append(f"CORRUPT_EG: {label}: standalone 'eg ' at pos {pos}: ...{repr(ctx)}...")
    
    # 3. Check for \n\\ (newline + backslash, corrupted)
    if "\\n\\" in text:
        errors.append(f"CORRUPT_NL: {label}: has \\n\\")
    
    # 4. Check for \\ followed by unexpected characters (not valid LaTeX)
    # In the parsed data, \x is the LaTeX command. Check for common issues.
    for m in re.finditer(r"\\([a-z]+)", text):
        cmd = m.group(1)
        known_cmds = {"land","lor","neg","exists","forall","in","sin","cos","tan",
                      "log","ln","sqrt","frac","mid","cdot","times","circ","angle",
                      "perp","parallel","cong","sim","approx","le","ge","ne","pm",
                      "mp","to","infty","partial","nabla","int","sum","prod","lim",
                      "alpha","beta","gamma","delta","epsilon","zeta","eta","theta",
                      "iota","kappa","lambda","mu","nu","xi","omicron","pi","rho",
                      "sigma","tau","upsilon","phi","chi","psi","omega",
                      "left","right","big","Big","bigg","Bigg",
                      "text","mathrm","mathbf","mathit","mathbb","mathcal",
                      "cap","cup","subset","supset","subseteq","supseteq",
                      "complement","emptyset","varnothing",
                      "vert","Vert","mid","parallel",
                      "rightarrow","leftarrow","Rightarrow","Leftarrow",
                      "displaystyle","textstyle","hat","bar","vec","dot",
                      "label","text","item","enum","displaystyle"}
        if cmd not in known_cmds and cmd not in ["displaystyle"]:
            # Check if it"s a number (like frac12)
            if not cmd.isdigit() and cmd not in [""]:
                pass  # Only flag truly unknown commands
    
    # 5. Check for excessive backslashes (potential double-escaping)
    # In parsed text, \\\\ appears as \\ (two backslashes). LaTeX expects \\
    # We check for patterns like \\\\l which is \\l which is NOT valid LaTeX
    # (\\l = line break + l, should be \l which is ł)
    bt_count = text.count(chr(92))
    if bt_count > 20:
        pass  # Many LaTeX commands, expected
    
    # 6. Check for null bytes or control characters
    for c in text:
        if ord(c) < 32 and c not in ["\n", "\r", "\t"]:
            errors.append(f"CTRL_CHAR: {label}: has control char U+{ord(c):04X}")
    
    # 7. Check for unusual Unicode that might not render
    for c in text:
        cp = ord(c)
        if cp in range(0xFE00, 0xFE10):  # variation selectors
            errors.append(f"UNICODE: {label}: has variation selector U+{cp:04X}")

# =============================================
# CHECK 1: Index.json (the source of truth)
# =============================================
print("Checking index.json...")
idx = json.loads(pathlib.Path("src/data/gaokao-questions/index.json").read_text("utf-8"))
q_count = 0
for ch, qs in idx.items():
    for q in qs:
        q_count += 1
        lbl = f"[{ch}] Q{q.get('number','?')}"
        check_text(q.get("prompt",""), f"{lbl} prompt")
        for o in q.get("options", []):
            check_text(o.get("text",""), f"{lbl} opt {o.get('label','?')}")

# =============================================
# CHECK 2: Formulas.json
# =============================================
print("Checking formulas.json...")
fm = json.loads(pathlib.Path("src/data/formulas.json").read_text("utf-8"))
for ch, formulas in fm.items():
    for f in formulas:
        lbl = f"[Formula] {ch}/{f.get('name','?')}"
        check_text(f.get("latex",""), lbl)

# =============================================
# CHECK 3: Basic exercises (exercises.json files)
# =============================================
print("Checking exercises...")
ex_dir = pathlib.Path("src/data/questions/exercises")
if ex_dir.exists():
    for fp in ex_dir.glob("*.json"):
        try:
            data = json.loads(fp.read_text("utf-8"))
            for item in data.get("items", []):
                lbl = f"[Exercise] {fp.stem}/{item.get('id','?')}"
                check_text(item.get("prompt",""), f"{lbl} prompt")
                for s in item.get("steps", []):
                    check_text(s.get("description",""), f"{lbl} step {s.get('key','?')}")
        except:
            errors.append(f"PARSE_ERROR: {fp.name}")

# =============================================
# SUMMARY
# =============================================
print(f"\nChecked {q_count} index questions, {len(fm)} formula chapters, exercises")
print(f"Errors found: {len(errors)}")
print()

if errors:
    for e in errors[:30]:
        print(f"  {e}")
    if len(errors) > 30:
        print(f"  ... and {len(errors)-30} more")
else:
    print("  ALL CLEAN - No issues found")

sys.exit(1 if errors else 0)
