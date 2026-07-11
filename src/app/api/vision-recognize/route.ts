import { NextRequest, NextResponse } from "next/server";

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_API_ENDPOINT = process.env.ARK_API_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const ARK_VISION_MODEL = process.env.ARK_VISION_MODEL || "doubao-vision-pro-32k";

// 数学手写识别专用提示词
const VISION_PROMPT = `你是一个专业的数学手写识别助手。请仔细识别图片中的手写数学内容。

要求：
1. 准确识别所有数学符号、公式、数字和文字
2. 数学表达式用标准的纯文本形式表示（如 x^2 表示x的平方，sqrt(x) 表示根号x）
3. 保留原始的解题步骤和格式
4. 如果是多行内容，用换行符分隔
5. 只输出识别结果，不要添加任何解释、说明或额外文字
6. 尽量保持原有的解题逻辑和步骤顺序
7. 注意区分：等号=、加号+、减号-、乘号×或*、除号÷或/、分数、上下标等

请直接输出识别后的内容：`;

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image) return NextResponse.json({ text: "", error: "No image provided" }, { status: 400 });

    if (!ARK_API_KEY) {
      return NextResponse.json({ text: "", error: "ARK_API_KEY not configured" }, { status: 500 });
    }

    // 处理base64图片
    const base64Data = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

    const response = await fetch(ARK_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: VISION_PROMPT,
              },
              {
                type: "image_url",
                image_url: {
                  url: base64Data,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vision API error:", response.status, errorText);
      return NextResponse.json(
        { text: "", error: `Vision API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    console.error("Vision recognize error:", err);
    return NextResponse.json(
      { text: "", error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
