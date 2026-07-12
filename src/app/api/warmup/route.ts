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

    const unitsList = units.map((u) => `- ${u.id}: ${u.name}`).join("\n");

    const systemPrompt = {
      role: "system",
      content: `你是"学导"AI，一位高中数学辅导老师。你的任务是在学生开始新章节学习前，用简洁自然的语言介绍本章涉及的知识点。语气轻松，不要太正式。不要用 $...$ 包裹公式，用纯文字描述即可。`,
    };

    const userPrompt = {
      role: "user",
      content: `学生即将开始学习「${chapterName}」。以下是本章节涉及的知识点：\n${unitsList}\n\n请用简洁自然的语言介绍每个知识点，每条1-2句话，让学生知道接下来要做什么。语气轻松，不要太正式。不要用 $...$ 包裹公式，用纯文字描述即可。最后说"准备好了就点下面的按钮开始第一题。"`,
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
