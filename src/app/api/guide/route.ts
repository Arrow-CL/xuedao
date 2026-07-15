import { NextRequest, NextResponse } from "next/server";
import { PresolvedQuestion, getCachedPresolve, cachePresolve, generateGuidance, getStepByStepHelp, matchStudentStep } from "@/lib/presolve";

// AI 配置——使用 DeepSeek（prompt 已优化数学自检规则）
const AI_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

// 千问视觉模型（带图题目使用，通过千问VL接口）
const QWEN_VL_ENDPOINT = process.env.QWEN_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_VL_KEY = process.env.QWEN_API_KEY || "";
const QWEN_VL_MODEL = process.env.QWEN_VL_MODEL || "qwen-vl-max";

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
  triggerMiniReview?: boolean;
  errorCount?: number;
  errorSteps?: string[];
  chapterName?: string;
  completedCount?: number;
  coveragePercent?: number;
  /** 前端传来的预求解数据（核心引擎锚点） */
  presolveData?: PresolvedQuestion;
  /** 小回顾：最近4题摘要 */
  questionSummaries?: Array<{
    id: string;
    prompt?: string;
    type?: string;
    difficulty?: number;
    knowledgePointIds?: string[];
  }>;
  /** 小回顾：已覆盖的知识点名称 */
  coveredKnowledgePoints?: string[];
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

/** 基础章节引导 prompt（逐步引导）—— 豆包优化版 Prompt2 */
function buildBasicPrompt(questionText: string, answerContext: string, stepNumber: number): string {
  return `# 全局身份与最高优先级铁则
你是学导AI高中数学辅导老师，对话风格如同同学交流，禁止机械化话术。
1. 上下文记忆铁则
   1.1 全程留存对话全部推导结论，已做对步骤绝不重复提问、不要求重新演算；
   1.2 禁止从头开始、重新推导、回到第一步等倒退类表述；
   1.3 不重复题目原始条件，禁止以"已知"作为语句开头。
2. 话术禁令：严禁使用想一想、试试看、提示、尝试等生硬词汇，提问自然灵活多变。
3. 分步规则：单次仅推进一个推导步骤，绝不一次性输出完整解题全过程，不直接给出答案。
4. 数学格式：全部公式用$...$包裹，条件分行展示，行首不加减号。
5. 完成收尾规则：学生算出正确最终答案后，逐条罗列知识点（1.名称，LaTeX公式），末尾添加【完成】。

当前题目：${questionText}${answerContext}
当前对话轮次：第${stepNumber}轮

内置分层引导逻辑：
场景A——学生给出推导步骤：
  先判断对错。对了→直接认可，顺其结果继续推，不要求化简或解释已正确式子。错了→只指出具体哪里有问题，不给完整正确过程，最多提示一个方向让学生自纠。
场景B——学生说"我不会/不知道/看不懂"：
  立刻停止推进，把已得结论简洁列出（最多2-3行），问"卡在哪一步？"，针对具体点解释。连续2次以上说不会，换具体数字代入或更简单问法。连续3次以上仍卡住，直接给出关键公式或具体提示让其继续。
场景C——学生直接选了一个选项（如"我选B"）：
  先快速判断对错，不从头发掘。部分正确则指出缺失条件并追问补齐，以学生已有答案为起点。
场景D——学生卡住但不说话不会：
  帮他把当前已有结论摆出来，问"接下来该算什么？"，不替他想答案，只理清到哪了。
${GEO_ANNOTATION_PROMPT}`;
}

/** 进阶章节引导 prompt—— 适合基础较好的学生，侧重思路拓展和一题多解 */
function buildAdvancedPrompt(questionText: string, answerContext: string, stepNumber: number): string {
  return `# 全局身份与最高优先级铁则
你是学导AI高中数学辅导老师，面向基础扎实的学生，对话简洁高效，侧重思路拓展和数学思维培养，禁止机械化啰嗦话术。
1. 上下文记忆铁则
   1.1 全程留存对话全部推导结论，已做对步骤绝不重复提问、不要求重新演算；
   1.2 禁止从头开始、重新推导、回到第一步等倒退类表述；
   1.3 不重复题目原始条件，禁止以"已知"作为语句开头。
2. 话术要求：语言简洁，点到为止，不做过多铺垫；适当引导一题多解、最优解法选择；完成后关联高考考法和易错点提醒。
3. 分步规则：单次仅推进一个推导步骤，不跳步但提示更精炼；学生卡住时优先引导思路方向而非具体计算，鼓励自主探索。
4. 数学格式：全部公式用$...$包裹，条件分行展示，行首不加减号。
5. 完成收尾规则：学生算出正确最终答案后，除罗列知识点外，补充：①本题的其他解法思路 ②常见易错点 ③高考中该知识点的常见考法，末尾添加【完成】。

当前题目：${questionText}${answerContext}
当前对话轮次：第${stepNumber}轮

内置分层引导逻辑：
场景A——学生给出推导步骤：
  先判断对错。对了→直接认可，可提示是否有更简便的方法，顺其结果继续推。错了→精准指出错误本质，不重复计算过程，引导学生自己发现问题。
场景B——学生说"我不会/不知道/看不懂"：
  直接给出解题思路方向和关键突破口，不绕弯子，问"从这个方向切入试试？"，连续2次不会再给出具体公式提示。
场景C——学生直接选了一个选项（如"我选B"）：
  快速判断对错，部分正确则直接指出逻辑漏洞，引导补全严谨性。
场景D——学生卡住但不说话：
  点出当前的关键转化点，问"是不是这里没想到转化方法？"，直接点破思路卡点。
${GEO_ANNOTATION_PROMPT}`;
}

/**
 * 步骤感知引导 prompt —— 以 presolve 板书为锚，AI 只负责自然语言包装
 * 
 * 关键设计：AI 知道完整解题路径（板书），每一步的目标明确，
 * 不会被学生的回答带着走，而是把学生的回答当"进度信号"处理。
 */
function buildStepAwarePrompt(
  questionText: string,
  answer: string | undefined,
  presolve: PresolvedQuestion,
  targetStep: number,      // 当前应该引导学生做到哪一步
  matchResult: { matchedStep: number; confidence: number; diffDescription: string },
  studentInput: string,
  chatHistory: { role: string; content: string }[],
  studentSaidHelp: boolean,
): string {
  // 构建板书概览（让 AI 知道完整路径）
  const stepsOverview = presolve.steps.map(s =>
    `第${s.stepNumber}步：${s.action} → ${s.expression}${s.result ? " = " + s.result : ""}`
  ).join("\n");

  // 当前目标步骤的详细信息
  const target = presolve.steps[targetStep - 1];
  const prevSteps = presolve.steps.slice(0, targetStep - 1);
  const prevResults = prevSteps.map(s => `第${s.stepNumber}步结论：${s.result || s.expression}`).join("\n");

  // 本地引擎的匹配结果作为参考信息传给 AI，不做最终裁定
  // AI 自己判断学生回答是否正确、做到哪一步
  const localMatchInfo = matchResult.matchedStep > 0
    ? `本地文本匹配参考：可能匹配到第${matchResult.matchedStep}步，置信度${(matchResult.confidence * 100).toFixed(0)}%。${matchResult.diffDescription}（注意：这只是文本匹配参考，可能不准确。你必须自己判断学生回答的数学正确性。）`
    : `本地文本匹配参考：未匹配到任何步骤（置信度${(matchResult.confidence * 100).toFixed(0)}%）。（注意：文本匹配不等于对错判断。学生可能写了正确的数学内容但格式不同，也可能写了错误的内容。你必须自己判断。）`;

  // 引导策略：明确告诉 AI 当前目标步骤、如何加标签
  let guidanceStrategy = "";

  // 构建所有步骤的标签参考信息
  const allStepsTagInfo = presolve.steps.map(s =>
    `第${s.stepNumber}步标签：[STEP:${s.stepNumber}|${s.result || s.expression}]`
  ).join("\n");

  if (studentSaidHelp) {
    // 只有"学生说不会"是确定性的，可以直接预设
    guidanceStrategy = `学生明确表示不会做第${targetStep}步。
策略：${targetStep <= 2 ? "这道题刚开始，给出一个具体的起步提示，比如代入具体数值，或者直接写出第一步的表达式让学生确认" : "把上一步的结论摆出来（不要重复推导），然后针对当前步骤给一个具体提示（如关键公式或方向），让学生从这个提示出发继续"}。
如果连续多次说"我不会"，直接给出这一步的完整做法。

【标签规则】学生没有完成任何步骤，本次回复不要加 [STEP:...] 标签。`;
  } else {
    // 其他所有情况：让 AI 自主判断学生回答的对错
    guidanceStrategy = `请自主判断学生的回答属于以下哪种情况，并执行对应策略：

情况1——学生回答正确（完成了第${targetStep}步或更后面的步骤）：
  直接认可，不要求倒退。自然过渡到下一步，用提问方式引导学生。绝对不要说"跳步了""放慢一点""先回到第X步"。
  【标签规则——重要】学生完成了哪一步，就在回复末尾追加对应的标签：
${allStepsTagInfo}
  例如：如果学生完成了第${targetStep}步，在回复末尾固定追加：[STEP:${targetStep}|${target?.result || target?.expression || ""}]
  如果学生跳步完成了更后面的步骤，追加该步骤对应的标签。

情况2——学生回答有数学错误（式子结构近似，但符号/计算/公式有误）：
  必须明确指出错误在哪里，只指出错误点，不给完整正确过程。让学生自己纠正。
  【标签规则】学生做错了，本次回复不要加 [STEP:...] 标签。

情况3——学生回答与当前步骤无关（写的是其他步骤的内容，或完全偏离）：
  温和引导学生回到当前目标步骤。不要批评，直接抛出当前步骤的方向性提问。
  【标签规则】学生没有完成目标步骤，本次回复不要加 [STEP:...] 标签。

${studentInput.length > 50 ? `情况4——学生提交了较长内容（可能是手写图片OCR），匹配度低：
  仔细阅读输入，尝试提取数学含义。能识别出已做步骤就认可并加对应标签；能看出最终答案就直接做知识回顾；确实无法判断时温和询问当前进度。不要说"看不清楚/从头开始"。
` : ""}${localMatchInfo}`;
  }

  return `# 全局身份锚定
你是学导AI，高中数学苏格拉底辅导老师，全程以同龄同学聊天语气对话，禁止机械话术。
# 全局硬性铁则（最高优先级，所有逻辑不能违背）
1. 上下文永久记忆规则：
   1.1 严格读取【完整解题路径】【学生当前进度】【之前已完成的结论】，全程记住学生所有已推导正确式子，绝不要求学生重做、退回已完成步骤；
   1.2 禁止出现任何"放慢一点、回到第X步、从头来、重新推导、再试一次"类倒退话术；
   1.3 学生跳步且结果正确，直接认可并推进下一步，不纠结跳步行为；
   1.4 禁止重复复述题目原始条件，禁止以"已知"开头。
2. 语气强制约束：
   2.1 绝对禁用：想一想、试试看、提示你、尝试一下、思考看看这类生硬引导词；
   2.2 提问句式自然口语化，句式随机切换，不要固定模板提问；
   2.3 简洁直白，无多余废话。
3. 数学格式规则：
   3.1 全部公式、向量、根式、分数用$...$包裹；
   3.2 罗列推导条件纯换行，行首禁止使用减号"-"；
4. 输出标签强制规则：
   4.1 学生完成当前目标步骤，末尾固定追加 [STEP:步骤编号|步骤LaTeX结论]；
   4.2 推进至下一新步骤时，标签同步更新为新步骤编号与结论；
   4.3 全部步骤完成后，按固定格式罗列知识点：1.知识点名称，对应LaTeX公式，末尾追加标记【完成】。
5. 分步约束：单次对话仅引导单一步骤，一次性不得输出多步完整推导，绝不直接给出最终答案。

当前题目环境：
题目：${questionText}
${answer ? `正确答案：${answer}` : ""}

【完整解题路径】
${stepsOverview}

【学生当前进度】
学生应该做：第${targetStep}步
${prevResults ? `之前已完成的结论：\n${prevResults}\n` : ""}
${target ? `当前步骤详情：第${targetStep}步——${target.action}\n表达式：${target.expression}${target.result ? "\n预期结果：" + target.result : ""}\n推理：${target.reasoning}\n验证方法：${target.checkHint}` : "所有步骤已完成"}

内置5套自动判断策略：
策略1——学生做对了当前步骤或更后面的步骤（跳步也算对）：
  直接认可，不要求倒退或重新做。自然过渡到下一步，用提问方式引导学生，不直接告诉做法。
策略2——学生回答接近某一步但有错误：
  只指出具体哪里有问题（符号？公式？计算？），不给完整正确过程。最多提示一个方向，让学生自纠。
策略3——学生说"我不会/要提示"：
  ${targetStep <= 2 ? "题目刚开始，给出具体起步提示（代入数值或直接写出第一步表达式让学生确认）" : "把上一步结论摆出来（不重复推导），针对当前步骤给一个具体提示（关键公式或方向），让学生从提示出发继续"}。
  连续多次说不会，直接给出这一步的完整做法。
策略4——学生提交了较长内容（可能是图片OCR）但匹配度低：
  不说"看不清楚/从第一步开始"。仔细阅读输入，尝试提取数学含义，认可已做步骤。确实无法判断时温和询问。
策略5——学生没有给出有效回答：
  引导学生回到第${targetStep}步。${target ? `提问：${target.action}` : ""}

当前引导策略：
${guidanceStrategy}
${GEO_ANNOTATION_PROMPT}`;
}

/**
 * 智能引导 API
 * 
 * 核心改造：以 presolve（解题板书）为锚
 * 1. 有 presolve → 本地引擎判断学生进度 → AI 围绕目标步骤生成引导
 * 2. 无 presolve → fallback 到原来的纯 AI 引导（向后兼容）
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
      triggerMiniReview = false,
      errorCount,
      errorSteps,
      chapterName,
      completedCount,
      coveragePercent,
      presolveData,
      questionSummaries,
      coveredKnowledgePoints,
    }: GuideRequest = await req.json();

    if (!triggerMiniReview && (!questionText || !studentInput)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 提前获取 presolve（图片处理需要用板书信息）
    const presolve = presolveData || getCachedPresolve(questionId);

    // 如果学生上传了图片，用视觉模型直接判断进度（不走 OCR）
    let effectiveStudentInput = studentInput;
    let matchResult = { matchedStep: -1, confidence: 0, diffDescription: "" };
    let needPassImageToGuide = false; // 视觉模型失败时，把图片传给 guide AI
    if (studentImageUrl) {
      try {
        // 优先使用视觉模型直接看图判断
        if (presolve && presolve.steps && presolve.steps.length > 0) {
          // 构建板书概览给视觉模型
          const stepsOverview = presolve.steps.map(s =>
            `第${s.stepNumber}步：${s.action} → 结果：${s.result || s.expression}`
          ).join("\n");

          const visionRes = await fetch(QWEN_VL_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${QWEN_VL_KEY}`,
            },
            body: JSON.stringify({
              model: "qwen-vl-max",
              messages: [{
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `# 角色：数学手写进度判定助手，仅做结构化识别，不生成教学文字
# 格式强制约束
仅输出纯净JSON，无图片描述、无多余文字、无markdown、无注释；键名双引号，无尾随逗号，数值纯数字，无匹配答案填null。
# 判断标准
1. matchedStep：学生手写推导到达的最大板书步骤编号，跳步结果正确直接取最大步骤；
2. allCorrect：布尔值，全程推导无错误true，存在符号/公式/计算错误false；
3. studentAnswer：学生手写最终答案字符串，无答案填null；
4. summary：一句话概括学生整体推导过程；
# 固定输出模板，严格匹配结构
{"matchedStep": 数字,"allCorrect": true/false,"studentAnswer": "答案文本或null","summary": "一句话总结手写内容"}
# 输入参考
题目：${questionText}
标准答案：${presolve.finalAnswer || answer || ""}
标准板书步骤：
${stepsOverview}
图片为学生手写解题全过程，请严格按照上述规则判定。`,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: studentImageUrl.startsWith("http")
                        ? studentImageUrl
                        : studentImageUrl.startsWith("data:")
                          ? studentImageUrl
                          : `data:image/jpeg;base64,${studentImageUrl}`,
                    },
                  },
                ],
              }],
              temperature: 0.1,
              max_tokens: 500,
            }),
          });

          if (visionRes.ok) {
            const visionData = await visionRes.json();
            if (visionData.error) {
              console.error("[guide] Vision model error:", visionData.error.message);
            }
            const visionText = visionData.choices?.[0]?.message?.content || "";

            // 解析视觉模型的判断
            let visionMatchedStep = -1;
            let visionAllCorrect = false;
            try {
              const cleanVision = visionText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              const firstBrace = cleanVision.indexOf("{");
              const lastBrace = cleanVision.lastIndexOf("}");
              if (firstBrace >= 0 && lastBrace > firstBrace) {
                const visionParsed = JSON.parse(cleanVision.substring(firstBrace, lastBrace + 1));
                visionMatchedStep = visionParsed.matchedStep || -1;
                visionAllCorrect = visionParsed.allCorrect || false;
                console.log(`[guide] Vision model judged: step=${visionMatchedStep}, correct=${visionAllCorrect}`);
              }
            } catch {
              console.error("[guide] Failed to parse vision model response:", visionText.substring(0, 200));
            }

            // 如果视觉模型判断出来了步骤，直接用它的结果
            if (visionMatchedStep > 0) {
              effectiveStudentInput = `学生上传了解题过程图片。视觉模型判断：学生做到了第${visionMatchedStep}步，${visionAllCorrect ? "全部正确" : "有错误"}。${visionText.substring(0, 200)}`;
              // 覆盖 matchResult
              matchResult = { matchedStep: visionMatchedStep, confidence: visionAllCorrect ? 0.9 : 0.7, diffDescription: "" };
            } else {
              // 视觉模型无法判断步骤，但看到了图片内容，把图片传给 guide AI 让它自己看
              console.log("[guide] Vision model could not match step, falling back to direct image in guide");
              effectiveStudentInput = `学生上传了解题过程图片。[VISION_IMAGE:${studentImageUrl.substring(0, 100)}]`;
            }
          } else {
            // 视觉模型 API 调用失败，把图片标记传给 guide AI 让它直接看图
            console.error("[guide] Vision model API failed:", visionRes.status);
            effectiveStudentInput = `学生上传了解题过程图片，请直接查看图片内容判断。`;
            // 标记需要把图片传给 guide AI
            needPassImageToGuide = true;
          }
        } else {
          // 无 presolve，fallback 到 OCR
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
        }
      } catch (err) {
        console.error("[guide] Student image processing failed:", err);
        // 全部失败，保留原始输入
      }
    }

    // 长对话摘要：超过8条消息时压缩早期历史
    let contextSummary = "";
    const MAX_RECENT_MESSAGES = 8;
    let effectiveChatHistory = chatHistory;
    if (chatHistory.length > MAX_RECENT_MESSAGES) {
      const earlyMessages = chatHistory.slice(0, -MAX_RECENT_MESSAGES);
      effectiveChatHistory = chatHistory.slice(-MAX_RECENT_MESSAGES);
      
      // 从早期消息中提取关键信息
      const earlyAssistantMessages = earlyMessages
        .filter(m => m.role === "assistant")
        .map(m => m.content)
        .join("\n");
      
      // 提取[STEP:...]标签中的结论
      const stepMatches = earlyAssistantMessages.match(/\[STEP:\d+\|[^\]]+\]/g);
      const completedSteps = stepMatches ? stepMatches.map(s => s.replace(/^\[STEP:\d+\|/, "").replace(/\]$/, "")) : [];
      
      // 检查是否已完成
      const isCompleted = earlyAssistantMessages.includes("【完成】");
      
      if (completedSteps.length > 0 || isCompleted) {
        contextSummary = `\n【历史对话摘要（早期${earlyMessages.length}条消息已压缩）】\n已完成推导结论：${completedSteps.length > 0 ? completedSteps.join("；") : "无"}\n${isCompleted ? "注意：学生已完成该题。此摘要仅供参考。" : ""}\n`;
      } else {
        contextSummary = `\n【历史对话摘要（早期${earlyMessages.length}条消息已压缩）】\n早期对话内容已省略，以下是最近的对话。\n`;
      }
    }

    const guideMode = getGuideMode(chapterId);

    // ====== 小回顾模式 ======
    if (triggerMiniReview) {
      // 构建做题详情
      const questionDetails = questionSummaries?.map((q, i) => {
        const typeLabel = q.type === "choice" ? "选择题" : q.type === "fill" ? "填空题" : "解答题";
        const diffLabel = q.difficulty === 1 ? "基础" : q.difficulty === 2 ? "中等" : "进阶";
        return `第${i + 1}题（${typeLabel}，${diffLabel}）：${q.prompt || "未知题目"}`;
      }).join("\n") || "题目信息不可用";

      const kpText = coveredKnowledgePoints?.length
        ? coveredKnowledgePoints.join("、")
        : "暂无知识点记录";

      const errorContext = (errorCount && errorCount > 0)
        ? `这4道题中学生出错了${errorCount}次。${errorSteps?.length ? "出错的地方：" + errorSteps.join("、") : ""}`
        : "这4道题学生全部一次做对。";

      const reviewPrompt = `你是"学导"AI，一位苏格拉底式的数学辅导老师。

学生刚刚在"${chapterName}"章节完成了4道题，当前知识点覆盖率约${coveragePercent ?? 0}%。

【最近4道题详情】
${questionDetails}

【已掌握的知识点】
${kpText}

【做题表现】
${errorContext}

小回顾规则：
1. 开头先真诚地夸奖学生，语气温暖自然（像一个关心学生的老师）
2. 逐一回顾这4道题分别考了什么，用学生能听懂的语言（不要照抄题目）
3. 总结这4道题覆盖了哪些知识点方向，点出其中1-2个核心公式/定理加深印象
4. ${errorCount && errorCount > 0 ? "温柔地提醒容易出错的点，给出防错建议" : "表扬学生表现稳定"}
5. 预告下一步大概会练什么方向（不要出题）
6. 最后说"准备好了就继续"

语气要求：像聊天一样自然，不要用编号列表格式。用$...$包裹所有公式。控制在200字以内。`;

      const res = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: "system", content: reviewPrompt }],
          temperature: 0.6,
          max_tokens: 600,
        }),
      });

      if (!res.ok) return NextResponse.json({ reply: "（AI 暂时不可用，请稍后重试）" });
      const data = await res.json();
      return NextResponse.json({ reply: data.choices?.[0]?.message?.content || "（AI 返回为空）", source: "ai-review" });
    }

    // ====== 核心路径：有 presolve 数据时，以板书为锚引导 ======

    if (presolve && presolve.steps && presolve.steps.length > 0) {
      // 1. 用本地引擎判断学生当前进度（如果图片处理时没有覆盖 matchResult）
      if (matchResult.matchedStep <= 0) {
        matchResult = matchStudentStep(effectiveStudentInput, presolve.steps);
      }

      // 2. 判断是否已完成所有步骤
      if (matchResult.matchedStep >= presolve.steps.length && matchResult.confidence >= 0.6) {
        // 学生已完成所有步骤，做知识回顾
        const reviewPrompt = `你是"学导"AI。
学生刚完成了这道题：${questionText}
正确答案：${presolve.finalAnswer || answer || ""}

做知识回顾：
1. 认可学生完成
2. 列出用到的知识点，格式："序号.中文名称，数学公式"
3. 预告下一题方向
4. 末尾加 【完成】

${presolve.summary ? "参考总结：" + presolve.summary : ""}
${presolve.knowledgePoints?.length ? "知识点：" + presolve.knowledgePoints.join("\n") : ""}
${presolve.nextHint ? "下一题方向：" + presolve.nextHint : ""}

语气自然简洁。用中文。`;

        const res = await fetch(AI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [{ role: "system", content: reviewPrompt + contextSummary }, ...effectiveChatHistory, { role: "user", content: effectiveStudentInput }],
            temperature: 0.4,
            max_tokens: 800,
          }),
        });

        if (!res.ok) return NextResponse.json({ reply: "（AI 暂时不可用，请稍后重试）" });
        const data = await res.json();

        const reviewReply = data.choices?.[0]?.message?.content || "（AI 返回为空）";
        // 所有步骤已完成，发送全部步骤的 completedStep 标签
        const allStepsTag = `[STEP:DONE|${presolve.steps.length}]`;

        return NextResponse.json({
          reply: `${reviewReply}\n${allStepsTag}`,
          source: "presolve-review",
          matchedStep: matchResult.matchedStep,
          completedStep: presolve.steps.length,
          totalSteps: presolve.steps.length,
          solved: true,
        });
      }

      // 3. 计算目标步骤（学生应该做到哪一步）
      const targetStep = Math.max(1, currentStepNumber);

      // 4. 构建步骤感知 prompt，让 AI 围绕目标步骤引导
      const stepAwarePrompt = buildStepAwarePrompt(
        questionText, answer, presolve, targetStep,
        matchResult, effectiveStudentInput, effectiveChatHistory, studentSaidHelp,
      );

      // 5. 调用 AI 生成自然语言引导
      const hasImage = !!imageUrl && imageUrl.length > 0;
      type TextMsg = { role: string; content: string };
      type MultiMsg = { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };

      let apiMessages: (TextMsg | MultiMsg)[];
      let endpoint: string;
      let apiKey: string;
      let model: string;

      if (hasImage || needPassImageToGuide) {
        // 题目有图片 或 学生上传了图片需要 guide AI 直接看 → 用 Qwen VL
        endpoint = QWEN_VL_ENDPOINT;
        apiKey = QWEN_VL_KEY;
        model = QWEN_VL_MODEL;
        apiMessages = [{ role: "system", content: stepAwarePrompt + contextSummary } as MultiMsg];
        if (effectiveChatHistory.length === 0) {
          apiMessages.push({
            role: "user",
            content: [
              { type: "text", text: questionText },
              ...(imageUrl ? [{ type: "image_url", image_url: { url: imageUrl.startsWith("http") ? imageUrl : `https://localhost:3000${imageUrl}` } }] : []),
            ],
          } as MultiMsg);
          apiMessages.push({ role: "assistant", content: questionText } as MultiMsg);
          // 学生消息可能带图片
          if (needPassImageToGuide && studentImageUrl) {
            apiMessages.push({
              role: "user",
              content: [
                { type: "text", text: effectiveStudentInput },
                { type: "image_url", image_url: { url: studentImageUrl.startsWith("data:") ? studentImageUrl : `data:image/jpeg;base64,${studentImageUrl}` } },
              ],
            } as MultiMsg);
          } else {
            apiMessages.push({ role: "user", content: effectiveStudentInput } as MultiMsg);
          }
        } else {
          apiMessages.push(...(effectiveChatHistory as MultiMsg[]));
          if (needPassImageToGuide && studentImageUrl) {
            apiMessages.push({
              role: "user",
              content: [
                { type: "text", text: effectiveStudentInput },
                { type: "image_url", image_url: { url: studentImageUrl.startsWith("data:") ? studentImageUrl : `data:image/jpeg;base64,${studentImageUrl}` } },
              ],
            } as MultiMsg);
          } else {
            apiMessages.push({ role: "user", content: effectiveStudentInput } as MultiMsg);
          }
        }
      } else {
        endpoint = AI_ENDPOINT;
        apiKey = AI_API_KEY;
        model = AI_MODEL;
        apiMessages = [{ role: "system", content: stepAwarePrompt + contextSummary } as TextMsg, ...(effectiveChatHistory as TextMsg[]), { role: "user", content: effectiveStudentInput } as TextMsg];
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: apiMessages, temperature: 0.55, max_tokens: 1000 }),
      });

      if (!res.ok) {
        // AI 不可用时，用本地引擎的文本结果作为 fallback
        const localGuidance = generateGuidance(effectiveStudentInput, targetStep, presolve);

        // 根据 matchResult 确定 completedStep
        let fallbackCompletedStep = 0;
        if (matchResult.matchedStep > 0 && matchResult.confidence >= 0.5) {
          fallbackCompletedStep = matchResult.matchedStep;
        }
        const fallbackReply = fallbackCompletedStep > 0
          ? `${localGuidance.message}\n[STEP:DONE|${fallbackCompletedStep}]`
          : localGuidance.message;

        return NextResponse.json({
          reply: fallbackReply,
          source: "local-fallback",
          matchedStep: matchResult.matchedStep,
          completedStep: fallbackCompletedStep > 0 ? fallbackCompletedStep : undefined,
          totalSteps: presolve.steps.length,
          targetStep,
        });
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "（AI 返回为空）";

      // 根据 matchResult 确定 completedStep，追加板书同步标签
      let completedStep = 0;
      if (presolve && presolve.steps && presolve.steps.length > 0 && matchResult.matchedStep > 0 && matchResult.confidence >= 0.5) {
        completedStep = matchResult.matchedStep;
      }
      const finalReply = completedStep > 0 ? `${reply}\n[STEP:DONE|${completedStep}]` : reply;

      return NextResponse.json({
        reply: finalReply,
        source: "presolve-guided",
        matchedStep: matchResult.matchedStep,
        completedStep: completedStep > 0 ? completedStep : undefined,
        totalSteps: presolve.steps.length,
        targetStep,
        presolveReady: true,
        guideMode,
      });
    }

    // ====== Fallback：无 presolve，使用原来的纯 AI 引导 ======
    const answerContext = answer ? `\n\n（这道题的正确答案是：${answer}，供你参考判断学生是否做对，但不要直接告诉学生）` : "";
    const systemPromptContent = guideMode === "advanced"
      ? buildAdvancedPrompt(questionText, answerContext, currentStepNumber)
      : buildBasicPrompt(questionText, answerContext, currentStepNumber);

    const hasImage = !!imageUrl && imageUrl.length > 0;
    type TextMsg = { role: string; content: string };
    type MultiMsg = { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };
    let apiMessages: (TextMsg | MultiMsg)[];
    let endpoint: string;
    let apiKey: string;
    let model: string;

    if (hasImage) {
      endpoint = QWEN_VL_ENDPOINT;
      apiKey = QWEN_VL_KEY;
      model = QWEN_VL_MODEL;
      apiMessages = [{ role: "system", content: systemPromptContent + contextSummary } as MultiMsg];
      if (effectiveChatHistory.length === 0) {
        apiMessages.push({
          role: "user",
          content: [
            { type: "text", text: questionText },
            { type: "image_url", image_url: { url: imageUrl.startsWith("http") ? imageUrl : `https://localhost:3000${imageUrl}` } },
          ],
        } as MultiMsg);
        apiMessages.push({ role: "assistant", content: questionText } as MultiMsg);
        apiMessages.push({ role: "user", content: effectiveStudentInput } as MultiMsg);
      } else {
        apiMessages.push(...(effectiveChatHistory as MultiMsg[]), { role: "user", content: effectiveStudentInput } as MultiMsg);
      }
    } else {
      endpoint = AI_ENDPOINT;
      apiKey = AI_API_KEY;
      model = AI_MODEL;
      apiMessages = [{ role: "system", content: systemPromptContent + contextSummary } as TextMsg, ...(effectiveChatHistory as TextMsg[]), { role: "user", content: effectiveStudentInput } as TextMsg];
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: apiMessages, temperature: 0.55, max_tokens: 1200 }),
    });

    if (!res.ok) return NextResponse.json({ reply: "（AI 暂时不可用，请稍后重试）" });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "（AI 返回为空）";

    return NextResponse.json({ reply, source: "ai-fallback", presolveReady: false, guideMode });
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
