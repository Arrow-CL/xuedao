import json, pathlib, urllib.request, time

API_KEY = "sk-ec8d585ec4b44606939c1c787347d4c6"
cp = pathlib.Path("src/data/content.json")
data = json.loads(cp.read_text("utf-8"))

def call(messages):
    d = json.dumps({"model": "deepseek-chat", "messages": messages, "temperature": 0.2, "max_tokens": 2048}).encode()
    r = urllib.request.Request("https://api.deepseek.com/v1/chat/completions", data=d, headers={
        "Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read())["choices"][0]["message"]["content"]

for ch, units in data.items():
    items = {uid: u["title"] for uid, u in units.items()}
    prompt = f"为每个知识点生成极简备考内容（分数很低的学生也能看懂）。\n\n返回JSON，格式：\n{{\"uid1\": {{\"formula\":\"公式直接写，最多40字\",\"mistake\":\"最常见错误，最多20字\"}}}}\n\n知识点：\n{json.dumps(items, ensure_ascii=False)}"
    
    try:
        reply = call([
            {"role": "system", "content": "你只返回JSON，不要任何其他文字。公式用LaTeX。每个公式和易错都要非常简短。"},
            {"role": "user", "content": prompt}
        ])
        import re
        m = re.search(r"\{[\s\S]*\}", reply)
        if m:
            result = json.loads(m.group())
            for uid, content in result.items():
                if uid in units:
                    f = content.get("formula", "").strip()
                    m2 = content.get("mistake", "").strip()
                    units[uid]["content"] = f"公式：{f}\n易错：{m2}"
            print(f"  OK: {ch} ({len(result)} units)")
        else:
            print(f"  FAIL: {ch} - no JSON in response")
    except Exception as e:
        print(f"  ERR: {ch} - {e}")
    time.sleep(0.3)

cp.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
print(f"\nSaved to content.json")
