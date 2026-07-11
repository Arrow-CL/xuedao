/**
 * chapter-scores.ts — 高考数学各章节分值配置
 *
 * 基于新高考数学大纲分值分布，总分 150 分。
 * 每个章节对应一个高考占分（取整），所有分值之和 = 150。
 */

/** 章节分值配置 */
export interface ChapterScoreConfig {
  chapterId: string;
  score: number; // 该章节对应的高考占分
}

/**
 * 高考数学分值分布
 * 参考：新高考数学试卷结构（选择题+填空题+解答题）
 * - 集合：约 5 分（选择题 1 道）
 * - 不等式/二次函数：约 5 分（选择题/填空）
 * - 函数概念与性质：约 10 分（选择题+解答题）
 * - 指数对数函数：约 8 分（选择+填空）
 * - 三角函数：约 15 分（选择+填空+解答）
 * - 平面向量：约 8 分（选择+填空）
 * - 复数：约 5 分（选择题 1 道）
 * - 立体几何：约 12 分（选择+解答大题）
 * - 统计：约 5 分（选择/填空）
 * - 概率：约 8 分（选择+填空）
 * - 空间向量与立体几何：约 5 分（解答大题部分）
 * - 直线和圆：约 5 分（选择/填空）
 * - 圆锥曲线：约 15 分（选择+填空+解答大题）
 * - 数列：约 10 分（选择+填空+解答）
 * - 导数：约 15 分（选择+解答大题）
 * - 计数原理：约 8 分（选择+填空）
 * - 随机变量及其分布：约 7 分（选择+填空+解答部分）
 * - 成对数据统计：约 4 分（选择/填空）
 */
export const chapterScores: ChapterScoreConfig[] = [
  { chapterId: "sets-logic", score: 5 },
  { chapterId: "quadratic-ineq", score: 5 },
  { chapterId: "func-concept", score: 10 },
  { chapterId: "exp-log", score: 8 },
  { chapterId: "trigonometric", score: 15 },
  { chapterId: "vectors-app", score: 8 },
  { chapterId: "complex", score: 5 },
  { chapterId: "solid-geometry", score: 12 },
  { chapterId: "statistics", score: 5 },
  { chapterId: "probability", score: 8 },
  { chapterId: "space-vectors", score: 5 },
  { chapterId: "lines-circles", score: 5 },
  { chapterId: "conic-sections", score: 15 },
  { chapterId: "sequences", score: 10 },
  { chapterId: "derivatives", score: 15 },
  { chapterId: "counting", score: 8 },
  { chapterId: "random-vars", score: 7 },
  { chapterId: "data-analysis", score: 4 },
];

/** 总分 */
export const TOTAL_SCORE = chapterScores.reduce((sum, c) => sum + c.score, 0); // 150

/** 获取某章节的高考占分 */
export function getChapterScore(chapterId: string): number {
  return chapterScores.find((c) => c.chapterId === chapterId)?.score ?? 0;
}

/**
 * 获取分数状态
 * @param lastReviewTimestamp 上次梳理时间戳（ms）
 * @returns "fresh" | "fading" | "forgotten"
 */
export function getScoreStatus(lastReviewTimestamp?: number): "fresh" | "fading" | "forgotten" {
  if (!lastReviewTimestamp) return "fresh";
  const daysSince = (Date.now() - lastReviewTimestamp) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return "fresh";
  if (daysSince <= 14) return "fading";
  return "forgotten";
}

/**
 * 根据分数状态返回对应的 Tailwind 颜色类
 */
export function getScoreColor(status: "fresh" | "fading" | "forgotten"): string {
  switch (status) {
    case "fresh": return "text-amber-500";
    case "fading": return "text-yellow-600";
    case "forgotten": return "text-gray-400";
  }
}

/**
 * 根据分数状态返回对应的背景颜色类
 */
export function getScoreBgColor(status: "fresh" | "fading" | "forgotten"): string {
  switch (status) {
    case "fresh": return "bg-amber-100 text-amber-700";
    case "fading": return "bg-yellow-100 text-yellow-700";
    case "forgotten": return "bg-gray-100 text-gray-400";
  }
}
