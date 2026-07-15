import { NextRequest, NextResponse } from "next/server";

const AI_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

interface WarmupRequest {
  chapterId: string;
  chapterName: string;
  units: { id: string; name: string }[];
}

/**
 * 章节预习 warmup API
 * 学生第一次进入章节时调用，介绍本章知识点
 */
export async function POST(req: NextRequest) {
  try {
    const { chapterId, chapterName, units }: WarmupRequest = await req.json();

    if (!chapterId || !chapterName || !units || !units.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const unitsList = units.map((u) => `${u.name}`).join("、");

    const systemPrompt = {
      role: "system",
      content: `你是学导知识点预热生成器，为章节第一道基础题做前置预习铺垫。
# 硬性联动规则（核心修复点）
1. 优先筛选本章节**第一道基础题直接依赖**的2-3个底层核心知识点，禁止选取章节后半段进阶知识点；
2. 每条知识点格式：$LaTeX公式$ + 一句话说明该知识点在第一道题中的使用场景；
3. 简洁无多余引导语，分行逐条展示；
4. 全部公式使用$...$包裹。
# 输出约束：纯知识点内容，无开场白、无总结、无拓展习题。`,
    };

    const userPrompt = {
      role: "user",
      content: `「${chapterName}」核心公式：${unitsList}

输出格式示例（严格遵守）：
$A \\cap B = \\{x \\mid x \\in A \\text{ 且 } x \\in B\\}$
$A \\cup B = \\{x \\mid x \\in A \\text{ 或 } x \\in B\\}$
$p \\Rightarrow q$
准备好了就开始第一题。

注意：每个公式只能出现一次，用$包裹。不要输出中文版本的公式。`,
    };

    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [systemPrompt, userPrompt],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      console.error("[warmup] AI API error:", res.status, await res.text());
      return NextResponse.json({ reply: "（AI 暂时不可用，请稍后重试）" });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "（AI 返回为空）";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[warmup] API error:", err);
    return NextResponse.json({ reply: "（系统出错，请稍后重试）" });
  }
}
