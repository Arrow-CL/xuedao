import { NextRequest, NextResponse } from "next/server";
import { PresolvedQuestion, PROMPT_VERSION } from "@/lib/presolve";

// 文本题引擎（DeepSeek）
const DEEPSEEK_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = process.env.AI_API_KEY || "";
const DEEPSEEK_MODEL = process.env.AI_MODEL || "deepseek-chat";

// 含图题引擎（千问 qwen3.6-flash，便宜且支持视觉）
const QWEN_ENDPOINT = process.env.QWEN_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_API_KEY = process.env.QWEN_API_KEY || "";
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3.6-flash";

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
      content: `# 角色定位
高中数学阅卷专家，生成高考标准得分点解题板书，输出仅用于系统苏格拉底引导锚点，不是教学讲解。
# 步骤划分硬性标准
1. 单一步骤=单个阅卷得分点：引入新定理、新条件、关键中间结论单独成步；纯代数展开、合并化简不单独拆分步骤，合并写在表达式内；
2. 化简省略规则：三角恒等变换、多项式展开仅保留起始式与最终结论，中间运算省略；
3. 书写规范：使用$\\because$、$\\therefore$推理，关键公式首次完整书写，后续简写。

# 数形结合硬性规则（几何/向量/解析几何题必须遵守）
1. 涉及几何图形（三角形、平行四边形、圆、坐标系等）的题目，每一步都必须在stepGeometry中描述该步对应的图形状态；
2. stepGeometry的设计原则：逐步累积，每步只新增本步涉及的元素。第一步通常画基础图形（如三角形ABC），后续步骤逐步添加辅助点、向量、标注等；
3. 坐标系范围固定0-100整数坐标，左上角(0,0)，x右y下。点的坐标按比例映射到此范围；
4. 不涉及图形的纯代数题，stepGeometry填null即可。

# 数学符号硬性约束（违反即失效）
1. "因为"只能用LaTeX符号 $\\because$ 表示，绝对禁止写成 "Because"、"因为"等文字
2. "所以"只能用LaTeX符号 $\\therefore$ 表示，绝对禁止写成 "herefore"、"所以"等文字
3. 向量只能用 $\\boldsymbol{a}$ 或 $\\vec{a}$ 格式，绝对禁止写成 "boldsymbol"、"vec"等英文
4. 所有数学符号、公式、运算符必须在 $...$ 内，包括推理符号 $\\because$、$\\therefore$

# 输出格式顶级强制规则（违反即失效，重复强调3次）
1. 仅输出纯净标准RFC8259 JSON，禁止任何markdown代码块、注释、解释文字、前后多余说明；
2. 所有键名、字符串使用双引号，数组末尾无多余逗号，所有括号完整闭合；
3. 字段严格按下方Schema完整输出，不得缺失、新增自定义字段，数值类型统一为数字，空值填null；
4. LaTeX表达式内部特殊符号正常转义，公式统一$...$包裹；
5. 禁止在行首使用减号罗列条件。

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
      "expression": "$\\because ... \\therefore ... 的标准答题文本$",
      "result": "$关键结论$",
      "reasoning": "用了什么定理/公式",
      "checkHint": "怎么验证",
      "stepGeometry": {
        "type": "shape",
        "shape": "triangle",
        "points": {"A": {"x": 10, "y": 70}, "B": {"x": 80, "y": 70}, "C": {"x": 30, "y": 20}},
        "edges": [{"from": "A", "to": "B"}, {"from": "B", "to": "C"}, {"from": "A", "to": "C"}],
        "labels": ["AB=3", "AC=4"],
        "caption": "建立△ABC"
      }
    }
  ],
  "diagram": {"shape": "triangle", "points": {"A": {"x": 10, "y": 70}, "B": {"x": 80, "y": 70}, "C": {"x": 30, "y": 20}}, "labels": ["AB=3", "AC=4"], "annotations": ["∠BAC=60°"]}
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
    let reply = data.choices?.[0]?.message?.content || "";

    // 检查是否因 max_tokens 截断
    const finishReason = data.choices?.[0]?.finish_reason;
    if (finishReason === "length" || reply.length < 50) {
      // 可能被截断，重试一次，增加 max_tokens
      console.log("[presolve] Retrying with larger max_tokens, finish_reason:", finishReason);
      const retryRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [systemPrompt, { role: "user", content: userContent }],
          temperature: 0.2,
          max_tokens: 8000,
        }),
      });
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        reply = retryData.choices?.[0]?.message?.content || reply;
      }
    }

    // 解析 AI 返回的 JSON
    let parsed: any;
    let cleanReply = reply.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleanReply.indexOf("{");
    const lastBrace = cleanReply.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleanReply = cleanReply.substring(firstBrace, lastBrace + 1);
    }
    // 修复尾随逗号
    cleanReply = cleanReply.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

    try {
      parsed = JSON.parse(cleanReply);
    } catch (err1) {
      // 第一次解析失败：尝试修复 LaTeX 反斜杠未转义问题
      // AI 经常在 JSON 字符串中输出 \overrightarrow、\frac 等，没有转义为 \\
      const fixed = cleanReply.replace(/\\(?![nrtbf"\\u/]|u[0-9a-fA-F]{4})/g, "\\\\");
      try {
        parsed = JSON.parse(fixed);
        console.log("[presolve] JSON parsed after fixing LaTeX backslashes");
      } catch (err2) {
        console.error("Failed to parse presolve response:", reply.substring(0, 800));
        return NextResponse.json(
          { error: "AI 返回格式异常，请重试" },
          { status: 200 }
        );
      }
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
        stepGeometry: s.stepGeometry || undefined,
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
