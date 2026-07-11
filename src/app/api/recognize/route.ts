import { NextRequest, NextResponse } from "next/server";

const AI_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + AI_API_KEY },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "请识别图片中的数学题目内容，包括所有文字、公式、符号和图形描述。保持原有格式，用LaTeX表示数学公式。只输出识别结果，不要添加解释。" },
            { type: "image_url", image_url: { url: "data:image/png;base64," + image } }
          ]
        }],
        temperature: 0.01,
        max_tokens: 500,
      }),
    });
    
    if (!res.ok) return NextResponse.json({ text: "" }, { status: 200 });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: "" }, { status: 200 });
  }
}
