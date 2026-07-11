/**
 * 推荐引擎 — 核心逻辑
 *
 * 输入：
 *   - 章节题目池 (ChapterQuestions)
 *   - 章节的知识点列表 (KnowledgePoint[])
 *   - 学生当前进度 (ChapterProgress)
 *
 * 输出：
 *   - 推荐的下一道题 (Question | null)
 *   - 推荐理由
 *
 * 算法核心思路：
 *   优先推荐能覆盖最多「尚未学过知识点」的题目，
 *   通过加权轮盘赌在覆盖率最高的前 N 题中随机选择，
 *   兼顾学习效率和做题顺序的随机性。
 */

import type {
  Question,
  ChapterQuestions,
  KnowledgePoint,
  ChapterProgress,
  RecommendationResult,
  CoverageStats,
  ChapterSummary,
  ChapterSummaryEntry,
} from "./types";

// ============ 辅助函数 ============

/**
 * 获取学生尚未覆盖的知识点ID集合
 *
 * @param chapterId   - 章节ID
 * @param knowledgePoints - 该章节的所有知识点
 * @param progress    - 学生在该章节的进度
 * @returns 尚未覆盖的知识点ID数组
 */
function getUncoveredIds(
  chapterId: string,
  knowledgePoints: KnowledgePoint[],
  progress: ChapterProgress
): string[] {
  const coveredSet = new Set(progress.coveredKnowledgePointIds);
  return knowledgePoints
    .filter((kp) => kp.chapterId === chapterId && !coveredSet.has(kp.id))
    .map((kp) => kp.id);
}

/**
 * 计算单道题对「尚未覆盖知识点」的覆盖分
 *
 * @param question    - 候选题目
 * @param uncoveredIds - 尚未覆盖的知识点ID列表
 * @returns 覆盖分（0 表示没有新增覆盖）
 */
function calcCoverageScore(
  question: Question,
  uncoveredIds: string[]
): number {
  const uncoveredSet = new Set(uncoveredIds);
  return question.knowledgePointIds.filter((id) => uncoveredSet.has(id))
    .length;
}

/**
 * 加权轮盘赌选择
 *
 * 在候选列表中按权重随机选择一个元素。
 * 如果所有权重都为 0，则等概率随机选择。
 *
 * @param candidates - 带权重的候选数组
 * @returns 被选中的候选，如果列表为空则返回 null
 */
function weightedRandomSelect<T>(
  candidates: { item: T; weight: number }[]
): T | null {
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);

  // 所有权重为 0 时退化为等概率随机
  if (totalWeight === 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx].item;
  }

  // 轮盘赌：生成 [0, totalWeight) 的随机数，累加权重直到命中
  let rand = Math.random() * totalWeight;
  for (const candidate of candidates) {
    rand -= candidate.weight;
    if (rand <= 0) {
      return candidate.item;
    }
  }

  // 浮点精度兜底：返回最后一个
  return candidates[candidates.length - 1].item;
}

/**
 * 打乱数组（Fisher-Yates 洗牌），用于打破覆盖分相同时的平局
 *
 * @param arr - 待打乱的数组
 * @returns 打乱后的新数组（不修改原数组）
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============ 核心API ============

/**
 * 推荐下一道题
 *
 * 算法步骤：
 * 1. 过滤掉已做过的题
 * 2. 计算剩余每道题的「覆盖分」：覆盖了多少个学生还没学过的知识点
 * 3. 取覆盖分最高的前 3 题
 * 4. 加权随机选择（覆盖分越高权重越大，但不是确定性选择，保证顺序随机性）
 * 5. 返回选中的题目及推荐理由
 *
 * @param chapterId       - 当前章节ID
 * @param questions       - 章节题目池
 * @param knowledgePoints - 该章节的知识点列表
 * @param progress        - 学生在该章节的当前进度
 * @returns 推荐结果（含题目和理由）
 */
export function recommendNext(
  chapterId: string,
  questions: ChapterQuestions,
  knowledgePoints: KnowledgePoint[],
  progress: ChapterProgress
): RecommendationResult {
  // ---- 1. 获取该章节的题目池 ----
  const chapterQs = questions[chapterId] ?? [];

  // ---- 2. 过滤掉已做过的题 ----
  const completedSet = new Set(progress.completedQuestionIds);
  const remaining = chapterQs.filter((q) => !completedSet.has(q.id));

  // 如果没有剩余题目，返回 null
  if (remaining.length === 0) {
    return {
      question: null,
      reason: "该章节所有题目已完成。",
      newlyCoveredKnowledgePoints: [],
    };
  }

  // ---- 3. 计算覆盖分 ----
  const uncoveredIds = getUncoveredIds(chapterId, knowledgePoints, progress);

  // 如果所有知识点都已覆盖，退化为随机推荐（帮助巩固）
  if (uncoveredIds.length === 0) {
    const shuffled = shuffle(remaining);
    const picked = shuffled[0];
    return {
      question: picked,
      reason: "所有知识点已覆盖，随机推荐巩固练习。",
      newlyCoveredKnowledgePoints: [],
    };
  }

  // 计算每道题的覆盖分
  const scored = remaining.map((q) => ({
    item: q,
    weight: calcCoverageScore(q, uncoveredIds),
  }));

  // ---- 4. 取覆盖分最高的前 3 题 ----
  // 先按覆盖分降序，相同分数随机打破平局
  scored.sort((a, b) => b.weight - a.weight || Math.random() - 0.5);
  const topN = scored.slice(0, 3);

  // ---- 5. 加权轮盘赌选择 ----
  const picked = weightedRandomSelect(topN);

  if (!picked) {
    // 理论上不会走到这里
    return {
      question: null,
      reason: "推荐失败：无法选择题目。",
      newlyCoveredKnowledgePoints: [],
    };
  }

  // 计算本题新覆盖的知识点
  const uncoveredSet = new Set(uncoveredIds);
  const newlyCovered = picked.knowledgePointIds.filter((id) =>
    uncoveredSet.has(id)
  );

  // 构建推荐理由
  const kpNames = knowledgePoints
    .filter((kp) => newlyCovered.includes(kp.id))
    .map((kp) => kp.name);

  const reason =
    newlyCovered.length > 0
      ? `本题可帮你学习：${kpNames.join("、")}。`
      : "巩固练习，加深理解。";

  return {
    question: picked,
    reason,
    newlyCoveredKnowledgePoints: newlyCovered,
  };
}

/**
 * 检查章节是否通关
 *
 * 通关条件：该章节所有知识点都已被覆盖过（覆盖率 >= 100%）
 *
 * @param chapterId       - 章节ID
 * @param knowledgePoints - 该章节的知识点列表
 * @param progress        - 学生在该章节的进度
 * @returns 是否通关
 */
export function checkChapterCleared(
  chapterId: string,
  knowledgePoints: KnowledgePoint[],
  progress: ChapterProgress
): boolean {
  const chapterKps = knowledgePoints.filter(
    (kp) => kp.chapterId === chapterId
  );

  if (chapterKps.length === 0) {
    // 没有知识点定义的章节视为已通关
    return true;
  }

  const coveredSet = new Set(progress.coveredKnowledgePointIds);
  return chapterKps.every((kp) => coveredSet.has(kp.id));
}

/**
 * 获取知识点覆盖率统计
 *
 * @param chapterId       - 章节ID
 * @param knowledgePoints - 该章节的知识点列表
 * @param progress        - 学生在该章节的进度
 * @returns 覆盖率统计信息
 */
export function getChapterCoverage(
  chapterId: string,
  knowledgePoints: KnowledgePoint[],
  progress: ChapterProgress
): CoverageStats {
  const chapterKps = knowledgePoints.filter(
    (kp) => kp.chapterId === chapterId
  );
  const total = chapterKps.length;

  const coveredSet = new Set(progress.coveredKnowledgePointIds);
  const covered = chapterKps.filter((kp) => coveredSet.has(kp.id)).length;
  const remaining = chapterKps
    .filter((kp) => !coveredSet.has(kp.id))
    .map((kp) => kp.id);

  const percentage =
    total > 0 ? Math.round((covered / total) * 1000) / 10 : 100;

  return {
    total,
    covered,
    percentage,
    remaining,
  };
}

/**
 * 获取章节通关总结
 *
 * 汇总该章节的做题记录，列出每道题覆盖了哪些知识点，
 * 最终合并成完整的知识体系图谱，标注每个知识点的掌握状态。
 *
 * @param chapterId       - 章节ID
 * @param knowledgePoints - 该章节的知识点列表
 * @param progress        - 学生在该章节的进度
 * @param questions       - 章节题目池（用于获取题目文本）
 * @returns 章节通关总结
 */
export function getChapterSummary(
  chapterId: string,
  knowledgePoints: KnowledgePoint[],
  progress: ChapterProgress,
  questions: ChapterQuestions
): ChapterSummary {
  // 1. 获取覆盖率
  const coverage = getChapterCoverage(chapterId, knowledgePoints, progress);

  // 2. 检查是否通关
  const isCleared = checkChapterCleared(
    chapterId,
    knowledgePoints,
    progress
  );

  // 3. 构建题目-知识点映射条目
  const chapterQs = questions[chapterId] ?? [];
  const completedSet = new Set(progress.completedQuestionIds);

  const entries: ChapterSummaryEntry[] = chapterQs
    .filter((q) => completedSet.has(q.id))
    .map((q) => ({
      questionId: q.id,
      promptSummary: q.prompt.slice(0, 50) + (q.prompt.length > 50 ? "..." : ""),
      coveredKnowledgePointIds: q.knowledgePointIds,
      completedAt: Date.now(), // 精确时间需要从 QuestionRecord 中获取，此处用占位
    }));

  // 4. 构建知识点图谱（按 order 排序）
  const chapterKps = knowledgePoints
    .filter((kp) => kp.chapterId === chapterId)
    .sort((a, b) => a.order - b.order);

  // 构建知识点 -> 覆盖题目的反向映射
  const coveredSet = new Set(progress.coveredKnowledgePointIds);
  const kpToQuestion: Record<string, string> = {};

  for (const q of chapterQs) {
    if (completedSet.has(q.id)) {
      for (const kpId of q.knowledgePointIds) {
        // 只记录第一次覆盖的知识点
        if (!kpToQuestion[kpId]) {
          kpToQuestion[kpId] = q.id;
        }
      }
    }
  }

  const knowledgeMap = chapterKps.map((kp) => ({
    knowledgePoint: kp,
    covered: coveredSet.has(kp.id),
    coveredByQuestionId: kpToQuestion[kp.id],
  }));

  return {
    chapterId,
    isCleared,
    coverage,
    entries,
    knowledgeMap,
  };
}
