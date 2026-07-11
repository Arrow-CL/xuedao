import { NextRequest, NextResponse } from "next/server";

// AI 配置 — 通过环境变量设置
const AI_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

export async function POST(req: NextRequest) {
  try {
    const { messages, moduleId, unitName } = await req.json();

    // 构建系统提示
    const systemPrompt = {
      role: "system",
      content: `你是"学导"AI，一位苏格拉底式的数学辅导老师。\
你正在辅导学生学"${moduleId || ""}"的"${unitName || ""}"部分。\
你的原则：
1. 永远不直接告诉学生答案，永远用提问引导学生自己发现
2. 学生的步骤计算是否正确由系统校验，你不需要说"对了"或"错了"
3. 你只负责引导思路、指出方向、鼓励思考
4. 如果学生卡住了，给出由浅入深的提示
5. 用中文回复，语气平和耐心
6. 如果学生明显走偏了，可以问"你是怎么想到这一步的？"`,
    };

    const apiMessages = [systemPrompt, ...messages];

    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("AI API error:", res.status, errBody);
      return NextResponse.json(
        { reply: "（AI 暂时不可用，请检查 API Key 配置）" },
        { status: 200 }
      );
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "（AI 返回为空）";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("AI route error:", err);
    return NextResponse.json(
      { reply: "（AI 连接失败，请稍后重试）" },
      { status: 200 }
    );
  }
}
