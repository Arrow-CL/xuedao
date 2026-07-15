/**
 * Demo 专用 AI 引导 API
 *
 * 独立于正式的 guide API，专为 /demo 页面服务。
 * 使用 solution-engine 的本地匹配引擎 + DeepSeek AI 生成自然语言引导。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  matchStudentInput,
  getGuideContext,
  getFullBoard,
  getLocalSolution,
  shouldTriggerHelp,
  getKnowledgeFragment,
  getCurrentTargetNodeId,
  getNodeHint,
  getCurrentBoardLines,
  getNodeDiagram,
} from "@/lib/solution-engine";

// AI 配置——使用 DeepSeek
const AI_ENDPOINT = process.env.AI_API_ENDPOINT || "https://api.deepseek.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

// ============================================================================
// 类型定义
// ============================================================================

interface DemoGuideRequest {
  questionId: string;
  questionText: string;
  studentInput: string;
  currentNodeId: number;
  unlockedNodeIds: number[];
  chatHistory: Array<{ role: string; content: string }>;
  helpCount?: number;
  triggerMiniReview?: boolean;
  miniReviewData?: Array<{
    questionTitle: string;
    questionPrompt: string;
    knowledgePoints: string[];
  }>;
}

interface DemoGuideResponse {
  reply: string;
  boardLines: string[];
  matchedNodeId: number;
  nextHint: string;
  progress: string;
  knowledgePoints: string[];
  currentDiagram?: string;
  unlockedNodeIds: number[];
  knowledgeFragment?: string;
  isHelpMode?: boolean;
  isCompleted?: boolean;
}

// ============================================================================
// Prompt 构建
// ============================================================================

/**
 * 构建本地解题引擎专用的 AI prompt
 * 参考 guide/route.ts 中的 buildLocalSolutionPrompt 逻辑
 */
function buildLocalSolutionPrompt(
  questionText: string,
  studentInput: string,
  guideContext: ReturnType<typeof getGuideContext>,
  currentNodeId: number,
  isHelp: boolean,
  helpCount: number = 0,
  finalAnswer: string = "",
  unlockedNodeIds: number[] = [],
): string {
  const { standardProcess, keyNodes, nextHint, currentProgress, knowledgePoints } = guideContext;

  const stepsOverview = keyNodes.map(node =>
    `节点${node.nodeId}：${node.lines.map(l => standardProcess.split("\\n")[l]?.trim() || "").join(" → ")}`
  ).join("\n");

  const targetNode = keyNodes.find(n => n.nodeId === currentNodeId + 1);
  const completedNodes = keyNodes.filter(n => n.nodeId <= currentNodeId).map(n => `节点${n.nodeId}`).join("、");
  const hasDiagram = targetNode?.diagram;

  let strategyText = "";
  if (isHelp) {
    const helpLevel = helpCount === 0 ? "第一次" : helpCount === 1 ? "第二次" : `${helpCount + 1}次`;
    let hintLevel = "";
    if (helpCount === 0) {
      hintLevel = `【第一次说不会——只给大方向，绝对不出现任何公式、式子、答案】
用自然语言给一个思考方向就够了，比如"题目给了什么条件？""看到XX条件你想到什么性质？"，不出现任何数学表达式。`;
    } else if (helpCount === 1) {
      hintLevel = `【第二次说不会——给出核心公式/定理提示，但不列式子】
告诉学生这一步该用什么公式或定理（公式可以写出来，因为左侧知识点弹窗会展示），但不要帮学生列具体式子。`;
    } else {
      hintLevel = `【第三次及以上说不会——给出当前步骤的关键式子，再引导下一步】
把当前卡住的那一步式子完整写出来给学生看，然后基于这个式子引导下一步。`;
    }
    strategyText = `学生说"我不会"（${helpLevel}求助），分层递进提示，绝不越层：
${hintLevel}
${currentNodeId === 0
      ? "题目刚开始。给第一个起步方向，从已知条件入手。不要直接给出任何式子。"
      : `学生已做到节点${currentNodeId}。先肯定学生已经做出来的部分，再针对下一步（${targetNode?.hint || nextHint || "继续推导"}）按上述层级给提示。`
    }
⚠️ 无论第几次求助，都绝对不能直接给出最终答案，都必须抛一个问题让学生自己继续做。`;
  } else {
    strategyText = `学生输入了：${studentInput}
请自主判断学生回答的对错，然后执行对应策略：

场景A：学生输入内容匹配当前节点，推导正确（含跳步）
1. 先用一句简短正向反馈肯定学生的思路或计算结果；
2. 紧接着用上一步的结论自然引出下一问，必须交代清楚「为什么要做下一步」，让基础薄弱的学生明白每一步的目的，不出现逻辑断层；
3. 跳步直接认可，不打断、不回头要求补中间步骤。

示范（向量垂直题）：
- 学生说「向量垂直，数量积为0」→ AI回复：「说得很关键，这是这道题的核心等式，想要写出数量积，我们需要先得到两个向量的完整坐标，已知b的坐标，我们先把b-4a这个向量的坐标算出来？」
- 学生算出b-4a的坐标 → AI回复：「没错，现在两个向量坐标都有了，结合刚才的垂直条件，你能把数量积等式列出来吗？」
- 学生列出方程 → AI回复：「列式思路完全对，现在得到了方程，下一步你试着化简成标准形式？」

场景B：学生输入存在计算/概念错误
1. 只精准指出一处具体错误点，不给出完整正确过程；
2. 抛出小提问让学生自行修正，不替代演算。

场景C：学生回答偏离当前步骤
温和引导回当前目标步骤，告诉学生当前应该聚焦哪一层。

场景D：学生给出最终答案
- 如果已解锁节点数 < 总节点数：肯定答案正确，然后要求学生补全前面的关键推导过程，从缺失的第一个关键节点开始引导，绝对不能判定完成。
- 如果已解锁节点数 = 总节点数（全部关键思路都走完了）：按铁律4的完成格式输出知识回顾，末尾加【完成】。`;
  }

  return `# 全局身份
你是面向数学基础薄弱学生的分步引导助教，和学生是同龄同学，聊天语气自然松弛，不用老师说教腔。核心目标：带着学生一步步搭建完整解题逻辑链，**必须让学生理解每一步是怎么由条件推出来的**，不允许背答案、猜答案。

## 对话记忆规则
- messages 数组中包含了之前的完整对话历史，你**必须参考前面的对话内容**，保持上下文连贯；
- 学生之前说过的思路、犯过的错误、你之前给过的提示，都要记住，不要重复提问已经讨论过的内容；
- 如果学生纠正了之前的错误，要基于最新的正确思路继续引导。

---

# 最高优先级铁律（违反任意一条直接作废输出）

## 铁律0：什么能跳，什么绝对不能跳
1. **只有纯计算过程（代数化简、移项合并、数值运算）可以跳步认可**，关键思路推导步骤绝对不能跳；
2. **关键步骤举例（必须学生自己说出来才算数）**：
   - 向量垂直 → 数量积为0（这是性质应用，必须学生说）
   - 需要哪个向量的坐标 → 先算那个向量的坐标（这是思路选择，必须学生说）
   - 列方程的依据是什么（这是逻辑链，必须学生说）
   - 基底表示时选哪两个向量作为基底（这是方法选择，必须学生说）
3. **纯计算可跳举例**：
   - 学生说"列方程得x=2"，中间的展开化简过程不用写，可以直接认可
   - 学生说"坐标是(2,x-4)"，中间的数乘、减法运算过程不用写，可以直接认可

## 铁律1：禁止背答案/猜答案
1. **开局直接甩最终答案（0步推导）**：绝对不能判定完成，绝对不能输出【完成】，**绝对不能说"思路很清晰，完全正确"**。
   ✅ 正确回应开头："答案对的，但我想知道你是怎么推出来的" / "答案没错，不过咱们得从头理一遍"
   ❌ 错误回应开头："思路很清晰，完全正确！"（这是完成专用语，未完成时禁止使用）
   然后引导从第一个关键思路开始。
2. **只走了1-2步关键思路就给最终答案**：同样不判定完成，必须补全缺失的关键思路节点。
3. **学生答案正确但说不出推导过程**：不判定完成，回到第一个关键思路点重新引导。
4. **完成专用语"思路很清晰，完全正确！"只能在真正判定完成、输出知识回顾时作为开头使用**，任何未完成场景都禁止使用这句话，换用"没错"/"算得对"/"这步抓得准"等其他肯定词。

## 铁律2：上下文强关联（零逻辑断层）
1. **每一轮回复必须用「上一步结论」开头承接**，绝对禁止无铺垫跳转。
   ✅ 正确："没错，两个向量坐标都有了，那垂直条件怎么转化成等式？"（承接了"坐标已算出"这个结论）
   ❌ 错误："x=2" / "接下来解方程"（完全没承接上一步，出现逻辑断层）
2. **必须交代清楚「为什么要做下一步」**，不能只甩一个计算任务，要让基础薄弱的学生明白因果关系。
3. **禁止跳跃式引导**：上一步还在说"向量垂直→数量积为0"，下一步绝对不能直接说"x=2"，中间必须引导"先算向量坐标"→"列数量积方程"→"解方程"，每一步都要有。

## 铁律3：单步输出强锁
1. 单次对话**只能引导1个目标节点**，禁止输出2个及以上解题步骤、禁止一次性罗列多条公式推导；
2. 严格跟随本地solution-engine返回的currentNodeId（下一个待解锁节点），你的引导只围绕这个节点展开，不要跳去后面节点；
3. 学生仅说出中间步骤，无论式子多完整，都绝对不能判定题目做完，只针对当前节点提问下一步。

## 铁律4：完成判定（严格执行）
1. 判定完成必须**同时满足三个条件**：
   - 条件A：学生已经走了**全部关键思路节点**，已解锁节点数达到总节点数；
   - 条件B：学生**明确说出了最终答案**（数值或向量表达式），不能只停留在倒数第二步（如只说"(x-2)²=0"没说"x=2"不算完成，只说"6|b|²=3"没说"|b|=√2/2"不算完成）；
   - 条件C：学生给出的答案和标准答案等价。
2. **完成时输出格式固定（必须严格遵守）**：
   第一句必须是："思路很清晰，完全正确！"
   然后：分点知识回顾（每点一个核心知识点，带公式），语言口语化，不要学术腔；
   最后：末尾**固定单独加一行【完成】**。
3. 完成时知识回顾要**回扣整道题的逻辑链**：从已知条件出发，第一步用了什么性质，第二步怎么转化，第三步怎么计算，最后得到结果，帮学生串起来。
4. **未完成时绝对禁止使用"思路很清晰，完全正确！"这句话**，用其他肯定词代替。

## 铁律5：对话语气规范
1. 每一轮提问**必须**先对上一轮学生的回答做简短正向肯定（1句话），再基于上一步结论自然引出下一层思考（1句话+1个小问题）；
2. 正向反馈轮换使用：说得很关键、没错、算得完全正确、思路很清晰、这一步没错、列式很好、这步抓得准，禁止连续两次用相同句式；
3. 禁止使用"XX等于多少？"这种纯索取答案的问句，统一用启发式：
   - "想要用垂直条件，我们得先有什么？"
   - "结合刚才得到的坐标，你能把数量积等式写出来吗？"
   - "方程列出来了，化简后x是多少？"
4. 短句为主，带轻微口语化语气词（啦、咯、呢），不用敬语，提问只抛1个小问题；
5. **绝对禁止出现的词汇（出现任意一个，整个回复作废重写）**：想一想、试试看、提示你、尝试一下、请你、接下来我们、首先其次最后、综上所述、深入思考、慢慢推导、对对对。这些词绝对不能出现在你的回复中，一个字都不能有。

## 铁律6：板书与引导同步
1. 本地引擎会自动渲染已解锁的板书行，你不需要控制板书，只适配当前进度对话；
2. 引导顺序必须和板书步骤一一对应，板书到哪一步，提问就停在哪一层；
3. 你不能主动提及未解锁的板书式子、未出现的方程、最终答案。

---

# 学生输入分类处理逻辑

${strategyText}

---

# 数学格式要求
全部公式用 $...$ 包裹，条件分行展示，不使用复杂markdown列表。

---

# 当前题目信息
题目：${questionText}

## 完整解题路径（关键节点）
${stepsOverview}

## 学生当前进度
进度：${currentProgress}
${currentNodeId > 0 ? `已完成的关键节点：${completedNodes}` : "尚未开始解题"}
${targetNode ? `当前要引导的目标节点：节点${targetNode.nodeId} — ${targetNode.hint}${hasDiagram ? "（此节点会显示几何图形）" : ""}` : "所有关键步骤已完成"}

## 进度判定（决定你是否能判定完成）
当前已解锁节点数：${unlockedNodeIds.length}
总节点数：${keyNodes.length}
${unlockedNodeIds.length >= keyNodes.length ? "✅ 全部关键节点已走完，如果学生给出正确最终答案，按完成格式输出，末尾加【完成】。" : unlockedNodeIds.length >= keyNodes.length * 0.7 ? "⚠️ 进度过七成，学生若给出正确最终答案，可以引导完成最后一步再判定。" : "❌ 进度不足，即使学生给出正确最终答案也绝对不能判定完成，必须继续引导补全关键推导步骤。"}

## 最终答案参考（仅用于判断，绝对不能提前告诉学生）
本题标准答案：${finalAnswer}

---

# 输出硬性限制
单次回复长度严格控制在2-3句话以内（1句肯定+1句引导+1个小问题），禁止大段文字，禁止讲知识点，禁止提前给答案。`;
}

// ============================================================================
// 主处理函数
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const {
      questionId,
      questionText,
      studentInput,
      currentNodeId = 0,
      unlockedNodeIds = [],
      chatHistory = [],
      helpCount = 0,
      triggerMiniReview = false,
      miniReviewData = [],
    }: DemoGuideRequest = await req.json();

    // 迷你回顾不需要 questionText 验证
    if (!triggerMiniReview && (!questionText || !studentInput)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 0. 迷你知识回顾（做完所有题后触发）
    if (triggerMiniReview && miniReviewData) {
      const questionDetails = miniReviewData
        .map((q, i) => `第${i + 1}题（${q.questionTitle}）：${q.questionPrompt.length > 80 ? q.questionPrompt.slice(0, 80) + "..." : q.questionPrompt}`)
        .join("\n");

      const allKP = miniReviewData
        .flatMap((q) => q.knowledgePoints)
        .filter((v, i, a) => a.indexOf(v) === i);

      const reviewPrompt = `你是"学导"AI，一位苏格拉底式的数学辅导老师。
学生刚刚完成了4道向量题的全部练习。

【4道题详情】
${questionDetails}

【涉及的核心知识点】
${allKP.join("、")}

小回顾规则：
1. 开头先真诚地夸奖学生完成全部4道题，语气温暖自然；
2. 逐一回顾这4道题分别考了什么核心方法，用学生能听懂的语言（不要照抄题目）；
3. 总结这4道题覆盖了哪些知识点方向，点出其中1-2个核心公式/定理加深印象（用$...$包裹公式）；
4. 表扬学生表现；
5. 预告向量的下一步练习方向（比如空间向量、基底法等）；
6. 最后说"准备好继续就点下一章"

语气要求：像聊天一样自然，不要用编号列表格式。控制在250字以内。`;

      let reviewReply = "";
      try {
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

        if (res.ok) {
          const data = await res.json();
          reviewReply = data.choices?.[0]?.message?.content || "";
        }
      } catch (err) {
        console.error("[demo-guide] Mini review AI call failed:", err);
      }

      if (!reviewReply) {
        reviewReply = `做得很棒！这4道题覆盖了向量垂直判定、坐标运算、数量积公式、完全平方配方、基底表示等核心知识点。向量是高考高频考点，继续加油！准备好继续就点下一章。`;
      }

      return NextResponse.json({
        reply: reviewReply,
        boardLines: [],
        matchedNodeId: 0,
        nextHint: "",
        progress: "",
        knowledgePoints: allKP,
        unlockedNodeIds: [],
        isMiniReview: true,
      } satisfies DemoGuideResponse & { isMiniReview?: boolean });
    }

    // 1. 判断是否触发求助（"我不会"）
    const isHelp = shouldTriggerHelp(studentInput);
    let knowledgeFragment: string | undefined = undefined;

    // 2. 用本地引擎匹配学生输入（传入已解锁节点集合）
    //    求助时不做匹配，保持当前进度
    const matchResult = isHelp
      ? {
          matchedNodeId: currentNodeId,
          boardLines: getCurrentBoardLines(questionId, unlockedNodeIds),
          nextHint: getNodeHint(questionId, getCurrentTargetNodeId(questionId, unlockedNodeIds, currentNodeId)) || "",
          progress: `${unlockedNodeIds.length}/${getGuideContext(questionId, currentNodeId).keyNodes.length}`,
          currentDiagram: getNodeDiagram(questionId, getCurrentTargetNodeId(questionId, unlockedNodeIds, currentNodeId)) || undefined,
          unlockedNodeIds: [...unlockedNodeIds],
        }
      : matchStudentInput(questionId, studentInput, currentNodeId, unlockedNodeIds);

    // 求助时获取当前节点的知识点片段（供左侧弹窗展示）
    if (isHelp) {
      const targetNodeId = getCurrentTargetNodeId(questionId, unlockedNodeIds, currentNodeId);
      const frag = getKnowledgeFragment(questionId, targetNodeId);
      if (frag) knowledgeFragment = frag;
    }

    // 3. 获取引导上下文
    const guideContext = getGuideContext(questionId, matchResult.matchedNodeId);

    // 4. 调用 AI 生成引导回复（统一入口，AI 自主判断是否完成）
    const solution = getLocalSolution(questionId);
    const systemPrompt = buildLocalSolutionPrompt(
      questionText,
      studentInput,
      guideContext,
      matchResult.matchedNodeId,
      isHelp,
      helpCount || 0,
      solution?.finalAnswer || "",
      matchResult.unlockedNodeIds,
    );

    let reply = "";

    try {
      const res = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory,
            { role: "user", content: studentInput },
          ],
          temperature: 0.55,
          max_tokens: 800,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content || "";
      }
    } catch (err) {
      console.error("[demo-guide] AI call failed:", err);
    }

    // 如果 AI 不可用，用本地引擎的 nextHint 作为 fallback
    if (!reply) {
      reply = matchResult.nextHint || guideContext.nextHint || "继续解题，告诉我你想到的下一步。";
    }

    // 5. 检测是否完成（AI 回复中包含【完成】标记）
    const isCompleted = reply.includes("【完成】");
    let finalBoardLines = matchResult.boardLines;
    let finalUnlockedNodeIds = matchResult.unlockedNodeIds;
    let finalProgress = matchResult.progress;
    let finalDiagram = matchResult.currentDiagram;

    if (isCompleted) {
      // 完成时：强制显示全部板书，无论之前解锁了多少
      const fullSolution = getLocalSolution(questionId);
      if (fullSolution) {
        finalBoardLines = getFullBoard(questionId);
        // 解锁全部节点
        finalUnlockedNodeIds = fullSolution.keyNodes.map(n => n.nodeId);
        finalProgress = `${fullSolution.keyNodes.length}/${fullSolution.keyNodes.length}`;
        // 完成时显示题目的主图形（第一个带图形的节点，即题目几何配图）
        const primaryDiagram = fullSolution.keyNodes.find(n => n.diagram)?.diagram;
        if (primaryDiagram) {
          finalDiagram = primaryDiagram;
        }
      }
    }

    // 6. 返回结果
    return NextResponse.json({
      reply,
      boardLines: finalBoardLines,
      matchedNodeId: matchResult.matchedNodeId,
      nextHint: matchResult.nextHint,
      progress: finalProgress,
      knowledgePoints: [],
      currentDiagram: finalDiagram,
      unlockedNodeIds: finalUnlockedNodeIds,
      isCompleted,
      knowledgeFragment,
      isHelpMode: isHelp,
    } satisfies DemoGuideResponse);
  } catch (err) {
    console.error("[demo-guide] Error:", err);
    return NextResponse.json({
      reply: "（系统出错，请稍后重试）",
      boardLines: [],
      matchedNodeId: 0,
      nextHint: "",
      progress: "",
      knowledgePoints: [],
    });
  }
}
