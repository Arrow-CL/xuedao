import { NextRequest, NextResponse } from "next/server";

const AI_ENDPOINT =
  process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

interface CompletedQuestionInfo {
  questionId: string;
  prompt: string;
  knowledgePointIds: string[];
  hasError: boolean;       // 这道题是否做错过
  errorSteps: string[];    // 当时错在哪里
}

interface ReviewRequest {
  chapterId: string;
  chapterName: string;
  units: { id: string; name: string }[];
  studentInput: string;
  chatHistory: { role: string; content: string }[];
  coveredUnits: string[];
  completedQuestions: CompletedQuestionInfo[];
}

function buildReviewPrompt(
  chapterName: string,
  units: { id: string; name: string }[],
  coveredUnits: string[],
  completedQuestions: CompletedQuestionInfo[],
): string {
  const unitList = units
    .map((u, i) => `${i + 1}. ${u.id}: ${u.name}${coveredUnits.includes(u.id) ? " ✓" : ""}`)
    .join("\n");

  const nextUnit = units.find((u) => !coveredUnits.includes(u.id));
  const nextUnitInfo = nextUnit
    ? `当前要梳理的知识点：${nextUnit.id}（${nextUnit.name}）`
    : "所有知识点已梳理完毕";

  // 按知识点分组构建题目数据，标记对错
  const questionsByUnit: string[] = [];
  for (const unit of units) {
    const related = completedQuestions.filter((q) =>
      q.knowledgePointIds?.some((kp) => kp.includes(unit.id))
    );
    if (related.length > 0) {
      const qLines = related.map((q) => {
        const snippet = q.prompt.length > 100 ? q.prompt.slice(0, 100) + "..." : q.prompt;
        const status = q.hasError
          ? `❌做错过（错在：${q.errorSteps.length > 0 ? q.errorSteps.join("、") : "计算错误"}）`
          : "✅一次做对";
        return `  - ${q.questionId}：${snippet} —— ${status}`;
      });
      questionsByUnit.push(`【${unit.id}（${unit.name}）】\n${qLines.join("\n")}`);
    }
  }
  const questionData = questionsByUnit.length > 0
    ? questionsByUnit.join("\n\n")
    : "（暂无已完成题目记录）";

  return `你是"学导"AI，一位高中数学辅导老师。现在你正在和学生进行"章节知识点梳理"。

当前章节：${chapterName}
知识点列表（共${units.length}个）：
${unitList}

${nextUnitInfo}

【学生的做题记录——按知识点分组】
${questionData}

【核心原则】
1. 陈述、精简：每次正文最多3句话，不要长篇大论
2. 引用具体题号：说"在第X题中"而不是"那道题"
3. 个性化反馈：
   - 如果该知识点对应的题目标记了❌做错过，要说"你在第X题这个地方当时错了，现在没问题了吧？"
   - 如果该知识点对应的题目全部✅一次做对，要说"你在第X题做得很好，对这个知识点理解很到位。"
4. 板书同步：第一次提到知识点时就板书

【梳理流程——严格遵守】
首次梳理某知识点时：
1. 引用具体题号，1-2句话带出知识点，加个性化反馈（做对/做错）
2. 再问一句"这个清楚了吧？"
3. 空一行
4. 写板书标记 [BOARD:知识点ID]完整公式[/BOARD]

【回复示例——严格照此格式】
第15题中你把$750^\\circ$化成了弧度$\\frac{5\\pi}{6}$，做得很好，这个知识点理解很到位。核心就是角度弧度互化，清楚了吧？

[BOARD:trig-angle-rad]$180^\\circ=\\pi$ rad，$l=|\\alpha|r$，扇形面积$S=\\frac{1}{2}|\\alpha|r^2$，终边相同角$\\{\\beta|\\beta=\\alpha+2k\\pi, k\\in\\mathbb{Z}\\}$[/BOARD]

另一个示例（有错误记录时）：
第17题求$\\sin 150^\\circ$时你当时把交点坐标写反了，现在没问题了吧？三角函数定义就是单位圆上点的坐标，清楚了吧？

[BOARD:trig-def]设角$\\alpha$终边与单位圆交于$P(x,y)$，则$\\sin\\alpha=y$，$\\cos\\alpha=x$，$\\tan\\alpha=\\frac{y}{x}(x\\neq 0)$[/BOARD]

注意：正文和板书之间空一行。板书只放公式，不放说明文字。

学生回应后：
- 说清楚了/懂了：直接进入下一个知识点，同样格式
- 说不清楚/不会：1-2句补充，不再重复板书

【板书规则】
- unitId 必须与知识点ID完全一致
- 板书内容写完整的核心公式和定义，可以占3-4行，不要遗漏重要内容
- 用 $...$ 包裹LaTeX

【完成所有知识点后】
正文写"梳理完成，看看左边的板书吧。"，不要再加板书标记。

格式：所有数学公式用 $...$ 包裹，不要用 - 开头列公式，用中文回复`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      chapterId,
      chapterName,
      units,
      studentInput,
      chatHistory = [],
      coveredUnits = [],
      completedQuestions = [],
    }: ReviewRequest = await req.json();

    if (!chapterId || !studentInput || !units || units.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const systemPrompt = buildReviewPrompt(
      chapterName,
      units,
      coveredUnits,
      completedQuestions,
    );

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: studentInput },
    ];

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
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ reply: "（AI 暂时不可用，请稍后重试）" });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "（AI 返回为空）";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Review API error:", err);
    return NextResponse.json({ reply: "（系统出错，请稍后重试）" });
  }
}
