import { NextRequest, NextResponse } from "next/server";

// 百度 OCR 配置
const BAIDU_OCR_API_KEY = process.env.BAIDU_OCR_API_KEY || "";
const BAIDU_OCR_SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || "";

// Qwen 视觉模型（fallback）
const QWEN_API_KEY = process.env.QWEN_API_KEY || "";
const QWEN_API_ENDPOINT = process.env.QWEN_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3.6-flash";

/** 获取百度 access_token */
async function getBaiduAccessToken(): Promise<string | null> {
  if (!BAIDU_OCR_API_KEY || !BAIDU_OCR_SECRET_KEY) return null;
  try {
    const res = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_OCR_API_KEY}&client_secret=${BAIDU_OCR_SECRET_KEY}`,
      { method: "POST" }
    );
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

/** 百度 OCR 识别 */
async function baiduOCR(imageBase64: string): Promise<string> {
  const token = await getBaiduAccessToken();
  if (!token) return "";

  // 去掉 data:image/xxx;base64, 前缀
  const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const res = await fetch(
    `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `image=${encodeURIComponent(pureBase64)}&language_type=CHN_ENG`,
    }
  );

  const data = await res.json();
  if (data.words_result && data.words_result.length > 0) {
    return data.words_result.map((w: { words: string }) => w.words).join("\n");
  }
  return "";
}

/** Qwen 视觉模型识别 */
async function qwenVLOCR(imageBase64: string): Promise<string> {
  if (!QWEN_API_KEY) return "";

  const res = await fetch(QWEN_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请识别这张手写数学解题过程中的所有内容。要求：\n1. 逐行识别，保持原推导顺序\n2. 数学符号用标准文本表示：向量用 a, b（不需要箭头），点乘用·，模用|a|，平方用^2，根号用√，分数用/，π用pi\n3. 不要用LaTeX的$符号，直接输出纯文本数学表达式\n4. 示例：'|a+2b|^2 = 4' 而不是 '$|\\vec{a}+2\\vec{b}|^2=4$'\n5. 每个等式一行，不要加额外解释，只输出识别到的数学内容",
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:")
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
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
    console.error("[Qwen VL OCR error]", data.error.message);
    return "";
  }
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
    }

    // 1. 先尝试百度 OCR
    let text = "";
    if (BAIDU_OCR_API_KEY && BAIDU_OCR_SECRET_KEY) {
      text = await baiduOCR(imageBase64);
    }

    // 2. 如果百度 OCR 结果质量差（文字少于5个字符），fallback 到 Qwen
    if (text.trim().length < 5) {
      console.log("[student-image] Baidu OCR result too short, falling back to Qwen VL");
      text = await qwenVLOCR(imageBase64);
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "无法识别图片内容" }, { status: 500 });
    }

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("[student-image] Error:", err);
    return NextResponse.json({ error: err.message || "识别失败" }, { status: 500 });
  }
}
