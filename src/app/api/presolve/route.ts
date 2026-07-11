import { NextRequest, NextResponse } from "next/server";
import { PresolvedQuestion, PROMPT_VERSION } from "@/lib/presolve";

// 文本题引擎（DeepSeek）
const DEEPSEEK_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = process.env.AI_API_KEY || "";
const DEEPSEEK_MODEL = process.env.AI_MODEL || "deepseek-chat";

// 含图题引擎（千问 qwen3.6-flash，便宜且支持视觉）
const QWEN_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_API_KEY = process.env.QWEN_API_KEY || "";
const QWEN_MODEL = "qwen3.6-flash";

// 需要图片识别的模块（几何类）
const GEOMETRY_MODULES = [
  "solid-geometry", "space-vectors",
  "lines-circles", "conic-sections"
];

function isGeometryQuestion(moduleId?: string): boolean {
  return !!moduleId && GEOMETRY_MODULES.some(m => moduleId.includes(m));
}

/**
 * 预求解 API（双引擎路由）
 * 
 * 纯文本题 → DeepSeek（便宜）
 * 含图题  → 千问 qwen3.6-flash（支持视觉，成本 ≈ DeepSeek 的 0.5 倍）
 */
export async function POST(req: NextRequest) {
  try {
    const { questionId, questionText, answer, questionType, moduleId } = await req.json();

    if (!questionText) {
      return NextResponse.json({ error: "Missing questionText" }, { status: 400 });
    }

    const useVision = isGeometryQuestion(moduleId);

    const systemPrompt = {
      role: "system",
      content: `你是一位高中数学解题专家，正在为"学导"系统预求解高考真题。请将以下数学题拆解为结构化解题步骤。

核心要求：
1. 步骤必须足够细——每一步只做一件事。比如"写出c向量坐标"和"列出垂直条件"应该是两个独立的步骤
2. action 用**提问式**写法，语气像跟同学聊天，不要用"提示""试一试""已知"等词。关键概念和公式用数学语言表达（如 $\vec{a} \perp \vec{c} \Rightarrow \vec{a} \cdot \vec{c} = 0$），基础坐标运算简单带过
3. expression 中数学表达式用LaTeX，前后加$（如 $\vec{a} \cdot \vec{c} = 0$）
4. reasoning 解释"为什么这一步是对的"，不要跳步
5. checkHint 给学生验证自己这一步的方法
6. knowledgePoints 数组：列出这道题用到的所有知识点（公式、定理、性质），按使用顺序，每条格式为"中文名称，数学公式"，例如：["向量坐标相加减", "向量垂直数量积为零，$\\vec{a} \\perp \\vec{b} \\Rightarrow \\vec{a} \\cdot \\vec{b} = 0$", "数量积坐标运算，$\\vec{a} \\cdot \\vec{b} = x_1 x_2 + y_1 y_2$"]
7. knowledgeFragments 数组：每个碎片对应一个卡点，fragment用数学语言提问（如"$\vec{a} \perp \vec{c}$ 能得到什么等式？"），full是完整表述（回顾时用）
8. commonErrors 列出学生最易犯的2-3个错误
9. summary 做完后回顾（2-3句话：用了什么知识，关键在哪）
10. nextHint 下一题方向
11. 列条件或步骤时，用换行分隔，不要在行首用 - 号（避免LaTeX把减号和向量箭头连在一起渲染成"负向量"）

返回纯JSON（不要markdown代码块）：
{
  "finalAnswer": "最终答案",
  "knowledgePoints": ["知识点1", "知识点2"],
  "knowledgeFragments": [
    {"step": 1, "name": "知识点名", "fragment": "方向性提问（不完整）", "full": "完整内容"}
  ],
  "commonErrors": ["错误1", "错误2"],
  "entryStep": 1,
  "summary": "回顾总结",
  "nextHint": "下一题方向",
  "steps": [
    {
      "stepNumber": 1,
      "action": "用提问式：能不能XXX？",
      "expression": "$LaTeX表达式$",
      "result": "$计算结果$",
      "reasoning": "为什么这样做",
      "checkHint": "怎么验证"
    }
  ]
}`,
    };

    const answerHint = answer ? `\n\n已知这道题的正确答案是：${answer}` : "";

    // 双引擎路由：纯文本用DeepSeek，含图用千问
    const endpoint = useVision ? QWEN_ENDPOINT : DEEPSEEK_ENDPOINT;
    const apiKey = useVision ? QWEN_API_KEY : DEEPSEEK_API_KEY;
    const model = useVision ? QWEN_MODEL : DEEPSEEK_MODEL;

    const userContent = useVision && questionType === "image"
      ? [
          { type: "text", text: `请拆解这道题${answerHint}` },
          { type: "image_url", image_url: { url: questionText } },
        ]
      : [{ type: "text", text: `请拆解这道题：${questionText}${answerHint}` }];

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [systemPrompt, { role: "user", content: userContent }],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Presolve AI error:", res.status, errBody);
      return NextResponse.json(
        { error: "AI 暂时不可用" },
        { status: 200 }
      );
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "";

    // 解析 AI 返回的 JSON
    let parsed: any;
    try {
      // 尝试去掉可能的 markdown 代码块标记
      const cleanReply = reply.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanReply);
    } catch {
      console.error("Failed to parse presolve response:", reply.substring(0, 200));
      return NextResponse.json(
        { error: "AI 返回格式异常，请重试" },
        { status: 200 }
      );
    }

    // 构建预求解结果
    const presolve: PresolvedQuestion = {
      questionId,
      questionText,
      finalAnswer: parsed.finalAnswer || answer || "",
      steps: (parsed.steps || []).map((s: any, i: number) => ({
        stepNumber: i + 1,
        action: s.action || "",
        expression: s.expression || "",
        result: s.result || "",
        reasoning: s.reasoning || "",
        checkHint: s.checkHint || "",
      })),
      knowledgePoints: parsed.knowledgePoints || (parsed.knowledgePoint ? [parsed.knowledgePoint] : []),
      knowledgeFragments: parsed.knowledgeFragments || [],
      commonErrors: parsed.commonErrors || [],
      entryStep: parsed.entryStep || 1,
      summary: parsed.summary || "",
      nextHint: parsed.nextHint || "",
      solvedAt: Date.now(),
      promptVersion: PROMPT_VERSION,
    };

    return NextResponse.json(presolve);
  } catch (err) {
    console.error("Presolve route error:", err);
    return NextResponse.json(
      { error: "预求解失败，请稍后重试" },
      { status: 200 }
    );
  }
}
