import json, re

c = open("src/data/gaokao-questions/index.js", "r", encoding="utf-8").read()
m = re.search(r"const gaokaoIndex = ({.*?});", c, re.DOTALL)
if m:
    idx = json.loads(m.group(1))
    for ch, qs in idx.items():
        for q in qs:
            p = q.get("prompt", "")
            if "命题" in p:
                print("Chapter:", ch)
                print("Prompt:", p[:100])
                for o in q.get("options", []):
                    print(f"  {o["label"]}. {o["text"]}")
                print()
                break
