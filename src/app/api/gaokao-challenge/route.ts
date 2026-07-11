import { NextRequest, NextResponse } from "next/server";

const AI_ENDPOINT = process.env.AI_API_ENDPOINT || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

export async function POST(req: NextRequest) {
  try {
    const { moduleId, moduleTitle } = await req.json();
    const prompt = `你是高考数学出题老师。请为"${moduleTitle}"模块出一道综合性高考题。

要求：
1. 题目要覆盖该章节多个核心知识点
2. 需要多个步骤才能解答
3. 返回严格JSON格式，不包含其他文字
4. JSON格式: {"prompt":"题目描述","steps":[{"description":"步骤1说明","formulaKey":"步骤key","expectedValue":数值},{"description":"步骤2说明","formulaKey":"步骤key","expectedValue":数值}]}
5. 6. 步骤描述要通用，不要提示具体用哪个公式（如"计算结果"）
7. 每个步骤的expectedValue必须是正确的数值
8. 难度为高考水平
9. 数学符号用常用清晰格式，如 x的平方写成 x²`;

    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + AI_API_KEY },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: prompt }], temperature: 0.8, max_tokens: 800 }),
    });
    if (!res.ok) return NextResponse.json({ error: "AI不可用" }, { status: 200 });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "AI格式错误" }, { status: 200 });

    const ai = JSON.parse(m[0]);
    const exercise = {
      id: "gaokao-" + Date.now(),
      type: "gaokao-challenge",
      difficulty: 5,
      equation: { latex: "", a: 0, b: 0, c: 0 },
      prompt: ai.prompt || "综合题",
      answer: 0,
      steps: (ai.steps || []).map((s: any, i: number) => ({
        key: "s" + (i + 1),
        description: s.description || "解题步骤" + (i + 1),
        formulaKey: s.formulaKey || "",
        expectedValue: Number(s.expectedValue) || 0,
      })),
      tags: ["gaokao"],
      commonMistakes: [],
    };
    return NextResponse.json({ exercise });
  } catch (err) {
    return NextResponse.json({ error: "生成失败" }, { status: 200 });
  }
}