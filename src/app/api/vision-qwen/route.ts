import { NextRequest, NextResponse } from "next/server";

// 通义千问 VL 视觉识别 API
// 申请地址：https://dashscope.aliyun.com/
// 模型：qwen-vl-max 或 qwen-vl-plus

const QWEN_API_KEY = process.env.QWEN_API_KEY || "";
const QWEN_API_ENDPOINT = process.env.QWEN_API_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3.5-ocr";

export async function POST(req: NextRequest) {
  if (!QWEN_API_KEY) {
    return NextResponse.json({ error: "QWEN_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { imageBase64, prompt = "请准确识别图片中的所有数学公式、符号和文字，保持原有格式和步骤顺序。只输出识别结果，不要添加任何解释。" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
    }

    const res = await fetch(QWEN_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message || "Vision API error" }, { status: 500 });
    }

    const result = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}
