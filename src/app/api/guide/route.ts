import { NextRequest, NextResponse } from "next/server";
import { PresolvedQuestion, getCachedPresolve, cachePresolve, generateGuidance, getStepByStepHelp, matchStudentStep } from "@/lib/presolve";

// AI 配置
const AI_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

// 千问视觉模型（带图题目使用）
const QWEN_VL_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_VL_KEY = process.env.QWEN_API_KEY || "";
const QWEN_VL_MODEL = "qwen-vl-max";

// 基础章节列表（order 1-6）
const BASIC_CHAPTERS = new Set([
  "sets-logic",
  "complex",
  "quadratic-ineq",
  "func-concept",
  "exp-log",
  "trigonometric",
]);

// 进阶章节列表
const ADVANCED_CHAPTERS = new Set([
  "vectors-app",
  "solid-geometry",
  "space-vectors",
  "conic-sections",
  "sequences",
  "derivatives",
  "lines-circles",
  "counting",
  "probability",
  "statistics",
  "random-vars",
  "data-analysis",
]);

interface GuideRequest {
  questionId: string;
  questionText: string;
  answer?: string;
  studentInput: string;
  currentStepNumber: number;
  chatHistory?: { role: string; content: string }[];
  studentSaidHelp?: boolean;
  chapterId?: string;
  imageUrl?: string;
  studentImageUrl?: string; // 学生上传的图片 base64
}

/** 判断章节引导模式 */
function getGuideMode(chapterId?: string): "basic" | "advanced" {
  if (!chapterId) return "basic";
  if (BASIC_CHAPTERS.has(chapterId)) return "basic";
  if (ADVANCED_CHAPTERS.has(chapterId)) return "advanced";
  return "basic";
}

/** 几何标注系统 prompt（两种模式都添加） */
const GEO_ANNOTATION_PROMPT = `
几何标注（仅在涉及立体几何/空间向量/解析几何题目时使用）：
- 当你需要学生在图形上看到坐标系、点、向量时，在回复最末尾添加标注指令
- 格式：每行一个 [GEO:ACTION params]
- 可用动作：
  [GEO:AXIS origin=x,y] — 建立坐标系，origin是原点在图形中的位置
  [GEO:POINT label=x,y] — 标注一个点，label是点名称
  [GEO:VECTOR from=x1,y1 to=x2,y2 label=name] — 画一个向量
  [GEO:CLEAR] — 清除所有标注
- 只在引导学生建系或确认了正确坐标后才使用
- 学生回答正确坐标后，添加对应 [GEO:POINT] 标注
- 这些标注必须放在回复的最末尾，与正文之间空一行`;

/** 基础章节引导 prompt（逐步引导） */
function buildBasicPrompt(questionText: string, answerContext: string, stepNumber: number): string {
  return `你是"学导"AI，一位苏格拉底式的数学辅导老师。

当前题目：${questionText}${answerContext}
当前对话轮次：第${stepNumber}轮

引导原则（严格遵守）：
1. 永远不直接告诉学生答案或完整步骤
2. 不要重复题目内容（题目已经在对话历史中），不要说"已知..."，不要列知识点名称
3. 如果学生说"我不会"或类似：先看对话历史判断学生已经做到哪一步，只帮他理清当前已有的结论，然后直接问下一步。不要写"已知..."，不要重复列已经提过的东西，不要从头开始讲
4. 如果学生写了一步：先判断对不对
   - **对了**：直接认可，推下一步。不要多此一举让学生化简或解释已经正确的式子。学生跳步但结果正确时，直接认可，不要追问跳过的过程——偶尔问一下可以，但不要每一步都问，频繁追问会让学生反感
   - **错了**：指出具体哪个式子有问题（如"你这个式子是怎么来的？"），让学生把那一步写出来，然后引导他自己发现错误（如"所以你的过程是不是写错了，正确的过程应该是xxx对吧"），不要直接给正确答案
5. 学生卡住时：直接帮他把当前已有的结论摆出来，问他"你觉得接下来该算什么？"——不要替他想答案，只帮他理清到哪了
6. 每次只往前推一步，做完一步再推下一步，绝不跳步。如果学生连续说"我不会"，要逐步深入，不要每次都回到原点
7. 学生得出最终正确答案后，先认可答案，然后帮他回顾"这道题我们一步步用了哪些东西"。回顾格式：每个知识点用"序号.中文名称，数学公式"的格式，例如：
   1.向量坐标相加减
   2.向量垂直数量积为零，$\\vec{a} \\perp \\vec{b} \\Rightarrow \\vec{a} \\cdot \\vec{b} = 0$
   3.数量积坐标运算，$\\vec{a} \\cdot \\vec{b} = x_1 x_2 + y_1 y_2$
   回顾完后，预告下一题的方向："下一题我们会在此基础上增加xxx"，让学生知道下一题会学什么。最后在回复末尾加上 【完成】

知识呈现方式：
- 用数学语言表达概念和公式，让学生在做题过程中自然总结知识点
- 例如：向量垂直直接写 $\\vec{a} \\perp \\vec{c} \\Rightarrow \\vec{a} \\cdot \\vec{c} = 0$，而不是文字描述"两个向量垂直意味着数量积为0"
- 数量积坐标公式、模长公式等可以直接写出数学表达式，不用额外解释公式含义
- 过于基础的运算（如向量坐标加减）简单带过即可，不需要解释"怎么加"

语气：就当跟同学聊天，自然、简洁、直接，不要用"提示""想一想""试试看"这类词。

格式要求：
- 所有数学公式和表达式必须用 $...$ 包裹（如 $\\vec{a} \\cdot \\vec{c} = 0$、$k = -\\frac{10}{3}$）
- 列条件或公式时用纯换行分隔，不要用 - 开头（避免LaTeX把减号和向量箭头连在一起渲染成"负向量"）
- 用中文回复

板书标记规则（严格遵守）：
- 当你认可学生的某一步正确时，在该步回复的最末尾（在[GEO:...]标注之前）添加一个标记：[STEP:步骤编号|步骤结论LaTeX]
- 步骤编号从1开始递增，每确认正确一步就加1
- 步骤结论是该步得到的核心结论，用 $...$ 包裹LaTeX
- 示例：学生算对了函数表达式，你在回复末尾加 [STEP:1|$f(x) = x^2 - 2x + 1$]
- 如果一次回复中确认了学生多个步骤正确，只标记最新那一步的结论
- 最终完成时（回复中有【完成】）不要加 [STEP:...] 标记
${GEO_ANNOTATION_PROMPT}`;
}

/** 进阶章节引导 prompt（阶段式引导） */
function buildAdvancedPrompt(questionText: string, answerContext: string, stepNumber: number): string {
  return `你是"学导"AI，一位苏格拉底式的数学辅导老师。

当前题目：${questionText}${answerContext}
当前对话轮次：第${stepNumber}轮

【阶段式引导模式】
本题采用阶段式引导：将解题过程划分为若干阶段，每个阶段包含关联的多个步骤。

引导原则（严格遵守）：
1. 永远不直接告诉学生答案或完整步骤
2. 不要重复题目内容（题目已经在对话历史中），不要说"已知..."，不要列知识点名称
3. 如果学生说"我不会"或类似：先看对话历史判断学生已经做到哪一步，只帮他理清当前已有的结论，然后直接问下一步
4. 阶段式引导规则：
   - 每次把关联步骤打包成一个"阶段"一起问
   - 例如空间向量建系阶段：一起问"建系后各关键点的坐标是什么"
   - 学生回答时，判断该阶段所有问题是否都正确回答
   - 一个阶段全部正确后才推进下一阶段
   - 始终提醒学生当前在解决什么最终问题（例如"我们现在在建系，建系的目的是为了把向量坐标化"）
   - 如果学生在同一阶段中只回答了部分，追问剩余部分（不要开启新阶段）
5. 学生写了一步时：
   - **对了**：认可，但继续追问当前阶段的其他问题
   - **错了**：指出具体问题，引导纠正
6. 学生卡住时：帮他理清当前阶段的已有结论，问"这个阶段还差什么？"
7. 学生得出最终正确答案后，先认可答案，然后帮他回顾。回顾格式：每个知识点用"序号.中文名称，数学公式"的格式，例如：
   1.空间向量建系
   2.求平面的法向量，$\\vec{n} = (x, y, z)$
   3.求点到平面的距离公式
   回顾完后，预告下一题的方向："下一题我们会在此基础上增加xxx"。最后在回复末尾加上 【完成】

知识呈现方式：
- 用数学语言表达概念和公式
- 直接写数学表达式，不用额外解释公式含义
- 过于基础的运算简单带过即可

语气：就当跟同学聊天，自然、简洁、直接，不要用"提示""想一想""试试看"这类词。

格式要求：
- 所有数学公式和表达式必须用 $...$ 包裹
- 列条件或公式时用纯换行分隔，不要用 - 开头
- 用中文回复

板书标记规则（严格遵守）：
- 当你认可学生的某一步/某个阶段正确时，在该步回复的最末尾（在[GEO:...]标注之前）添加一个标记：[STEP:步骤编号|步骤结论LaTeX]
- 步骤编号从1开始递增，每确认正确一步/一个阶段就加1
- 步骤结论是该步/阶段得到的核心结论，用 $...$ 包裹LaTeX
- 示例：学生建系完成，你在回复末尾加 [STEP:1|$\\vec{OA} = (1, 0, 0)$]
- 如果一次回复中确认了多个阶段正确，只标记最新那个阶段的结论
- 最终完成时（回复中有【完成】）不要加 [STEP:...] 标记
${GEO_ANNOTATION_PROMPT}`;
}

/**
 * 智能引导 API
 * 
 * 流程：
 * 1. 查本地缓存是否有预求解结果
 * 2. 有 → 用本地比对引擎精准定位断层
 * 3. 没有 → 先触发预求解（异步），再用普通AI引导
 * 4. 返回精准引导信息
 */
export async function POST(req: NextRequest) {
  try {
    const {
      questionId,
      questionText,
      answer,
      studentInput,
      currentStepNumber,
      chatHistory = [],
      studentSaidHelp = false,
      chapterId,
      imageUrl = "",
      studentImageUrl = "",
    }: GuideRequest = await req.json();

    if (!questionText || !studentInput) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 如果学生上传了图片，先做 OCR 识别，将识别结果拼接到 studentInput
    let effectiveStudentInput = studentInput;
    if (studentImageUrl) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const ocrRes = await fetch(`${baseUrl}/api/student-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: studentImageUrl }),
        });
        if (ocrRes.ok) {
          const ocrData = await ocrRes.json();
          if (ocrData.text) {
            effectiveStudentInput = `学生上传了解题过程图片，OCR识别结果如下：\n${ocrData.text}`;
          }
        }
      } catch (err) {
        console.error("[guide] Student image OCR failed:", err);
        // OCR 失败不影响主流程，继续用原始输入
      }
    }

    // 判断引导模式
    const guideMode = getGuideMode(chapterId);

    // 暂时跳过 presolve 缓存，直接走 AI fallback
    const answerContext = answer ? `\n\n（这道题的正确答案是：${answer}，供你参考判断学生是否做对，但不要直接告诉学生）` : "";

    // 根据模式构建不同的 system prompt
    const systemPromptContent =
      guideMode === "advanced"
        ? buildAdvancedPrompt(questionText, answerContext, currentStepNumber)
        : buildBasicPrompt(questionText, answerContext, currentStepNumber);

    const systemPrompt = {
      role: "system",
      content: systemPromptContent,
    };

    // 判断是否有图片 → 切换模型
    const hasImage = !!imageUrl && imageUrl.length > 0;
    type TextMsg = { role: string; content: string };
    type MultiMsg = { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };
    let apiMessages: (TextMsg | MultiMsg)[];
    let endpoint: string;
    let apiKey: string;
    let model: string;

    if (hasImage) {
      // 带图题目：使用千问视觉模型
      endpoint = QWEN_VL_ENDPOINT;
      apiKey = QWEN_VL_KEY;
      model = QWEN_VL_MODEL;
      // 构建带图片的 messages：第一轮 system + user(带图) + assistant + ...
      apiMessages = [systemPrompt as MultiMsg];
      // 如果 chatHistory 为空，说明是第一轮，需要把题目+图片作为 user 消息
      if (chatHistory.length === 0) {
        apiMessages.push({
          role: "user",
          content: [
            { type: "text", text: questionText },
            {
              type: "image_url",
              image_url: {
                url: imageUrl.startsWith("http")
                  ? imageUrl
                  : `https://localhost:3000${imageUrl}`,
              },
            },
          ],
        } as MultiMsg);
        apiMessages.push({ role: "assistant", content: questionText } as MultiMsg);
        apiMessages.push({ role: "user", content: effectiveStudentInput } as MultiMsg);
      } else {
        // 后续轮次：chatHistory 中已经有完整对话
        apiMessages.push(...(chatHistory as MultiMsg[]), { role: "user", content: effectiveStudentInput } as MultiMsg);
      }
    } else {
      // 无图题目：使用 DeepSeek
      endpoint = AI_ENDPOINT;
      apiKey = AI_API_KEY;
      model = AI_MODEL;
      apiMessages = [systemPrompt as TextMsg, ...(chatHistory as TextMsg[]), { role: "user", content: effectiveStudentInput } as TextMsg];
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ reply: "（AI 暂时不可用，请稍后重试）" });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "（AI 返回为空）";

    return NextResponse.json({
      reply,
      source: "ai-fallback",
      presolveReady: false,
      guideMode,
    });
  } catch (err) {
    console.error("Guide API error:", err);
    return NextResponse.json({ reply: "（系统出错，请稍后重试）" });
  }
}

/**
 * 后台触发预求解（不阻塞当前请求）
 */
async function triggerPresolve(
  questionId: string,
  questionText: string,
  answer?: string
): Promise<void> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"}/api/presolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, questionText, answer }),
    });

    if (res.ok) {
      const presolve = await res.json();
      cachePresolve(presolve);
      console.log(`[Presolve] Cached for question: ${questionId}`);
    }
  } catch (err) {
    console.error("[Presolve] Background solve failed:", err);
  }
}
