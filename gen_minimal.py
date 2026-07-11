import json, pathlib, urllib.request, time

API_KEY = "sk-ec8d585ec4b44606939c1c787347d4c6"
content_path = pathlib.Path("src/data/content.json")
current = json.loads(content_path.read_text("utf-8"))

def call_api(messages):
    data = json.dumps({"model": "deepseek-chat", "messages": messages, "temperature": 0.2, "max_tokens": 1024}).encode()
    req = urllib.request.Request("https://api.deepseek.com/v1/chat/completions", data=data, headers={
        "Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["choices"][0]["message"]["content"]

total = 0
for ch, units in current.items():
    names = [f"{uid}: {u["title"]}" for uid, u in units.items()]
    prompt = f'为"{ch}"章节的以下子知识点生成极简备考内容。\n\n格式（每段严格按照以下格式，不要多写）：\n公式：[必填，写可直接套用的公式，用LaTeX，50字以内]\n易错：[必填，写最常见的1个错误，20字以内]\n\n知识点：\n' + "\n".join(names) + "\n\n回复格式：\n概念:\n公式：...\n易错：...\n\n概念:\n公式：...\n易错：..."

    try:
        reply = call_api([
            {"role": "system", "content": "你只回复公式和易错，每段不超过70字。不要解释，不要多写。"},
            {"role": "user", "content": prompt}
        ])
        # Parse reply into units
        lines = reply.strip().split("\n")
        current_uid = None
        for line in lines:
            line = line.strip()
            if ":" in line and len(line) < 30 and not line.startswith("公式") and not line.startswith("易错"):
                uid_part = line.split(":")[0].strip().lower()
                for uid in units:
                    if uid.startswith(uid_part) or uid_part.startswith(uid):
                        current_uid = uid
                        break
            elif line.startswith("公式") and current_uid:
                formula = line.split("：", 1)[1] if "：" in line else ""
                units[current_uid]["content"] = formula
            elif line.startswith("易错") and current_uid:
                mistake = line.split("：", 1)[1] if "：" in line else ""
                units[current_uid]["content"] = units[current_uid].get("content", "") + "\n易错：" + mistake
        
        total += len(units)
        print(f"{ch}: {len(units)} units")
    except Exception as e:
        print(f"{ch}: error - {e}")
    time.sleep(0.3)

content_path.write_text(json.dumps(current, ensure_ascii=False, indent=2), "utf-8")
print(f"\nDone! Updated {total} units")
