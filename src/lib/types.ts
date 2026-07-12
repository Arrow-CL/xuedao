// ============================================================================
// 核心类型定义 — 题目、知识点、用户进度
// ============================================================================

// ============ 题目类型 ============

/** 题目来源 */
export type QuestionSource = "gaokao" | "exercise";

/** 题目类型：选择题 / 填空题 / 解答题 */
export type QuestionType = "choice" | "fill" | "solve";

/** 难度等级：1=易 2=中 3=难 4=压轴 */
export type Difficulty = 1 | 2 | 3 | 4;

/** 高考真题元数据（仅 gaokao 类题目有） */
export interface GaokaoMeta {
  year: number;       // 高考年份，如 2024
  paper: string;       // 试卷名称，如 "全国甲卷理科"
  number: number;      // 题号
  sub?: string;        // 小题编号（拆分后的题目有，如 "a", "b", "c"）
}

/** 题目 */
export interface Question {
  /** 唯一ID，如 "vectors-app-001" */
  id: string;
  /** 所属章节ID，如 "vectors-app" */
  chapterId: string;
  /** 题目来源：gaokao（高考真题）或 exercise（练习） */
  source: QuestionSource;
  /** 题目文本（LaTeX 用 \\ 转义） */
  prompt: string;
  /** 题型 */
  type: QuestionType;
  /** 难度等级 1~4 */
  difficulty: Difficulty;
  /** 答案 */
  answer?: string;
  /** 解题过程（仅拆分小题有） */
  solution?: string;
  /** 选择题选项 */
  options?: string[];
  /** 高考真题元数据（仅 gaokao 类题目有） */
  meta?: GaokaoMeta;
  /** 题目配图路径（如 /gaokao-images/xxx.png） */
  imageUrl?: string;
  /** 本题覆盖的知识点ID列表 */
  knowledgePointIds: string[];
}

/** 章节题目池：key 为章节ID，value 为该章节下的所有题目 */
export type ChapterQuestions = Record<string, Question[]>;

// ============ 知识点 ============

/**
 * 知识点（从 chapters.ts 的 unit 中提取）
 *
 * id 命名约定：{chapterId}-{unitId}-{知识点后缀}
 * 例如 "vectors-app-dot-product-coord"
 */
export interface KnowledgePoint {
  /** 知识点唯一ID，如 "vectors-app-dot-product-coord" */
  id: string;
  /** 所属章节ID，如 "vectors-app" */
  chapterId: string;
  /** 所属单元ID，如 "vectors-app-dot-product" */
  unitId: string;
  /** 中文名称，如 "数量积坐标公式" */
  name: string;
  /** LaTeX 公式，如 "\\vec{a} \\cdot \\vec{b} = x_1 x_2 + y_1 y_2" */
  formula?: string;
  /** 在章节内的学习顺序（从 0 开始） */
  order: number;
}

// ============ 用户进度 ============

/** 单道题的做题记录 */
export interface QuestionRecord {
  /** 题目ID */
  questionId: string;
  /** 所属章节ID */
  chapterId: string;
  /** 完成时间戳 */
  completedAt: number;
  /** 本次做题覆盖的知识点ID */
  coveredKnowledgePointIds: string[];
  /** 错误次数 */
  errorCount: number;
  /** 错误的步骤记录（可选，用于错因分析） */
  errorSteps?: string[];
}

/** 章节进度 */
export interface ChapterProgress {
  /** 章节ID */
  chapterId: string;
  /** 已完成的题目ID列表 */
  completedQuestionIds: string[];
  /** 已覆盖的知识点ID集合（去重） */
  coveredKnowledgePointIds: string[];
  /** 章节内总做题数 */
  totalAttempted: number;
  /** 章节是否通关（所有知识点覆盖率 >= 100%） */
  isCleared: boolean;
  /** 通关时间戳（通关后才有） */
  clearedAt?: number;
  /** 上次知识梳理时间戳（ms），用于分数衰减 */
  lastReviewTimestamp?: number;
  /** 梳理次数，用于梳理深度等级 */
  reviewCount?: number;
}

/** 全局用户进度 */
export interface UserProgress {
  /** 当前解锁到的最大章节 order */
  maxUnlockedOrder: number;
  /** 各章节进度，key 为章节ID */
  chapters: Record<string, ChapterProgress>;
  /** 错题本 */
  errorRecords: QuestionRecord[];
  /** 总学习天数 */
  totalDays: number;
  /** 连续学习天数 */
  streakDays: number;
  /** 最后学习日期（YYYY-MM-DD） */
  lastStudyDate: string;
}

// ============ 板书步骤 ============

/** 板书步骤（AI 确认正确的解题步骤） */
export interface BoardStep {
  /** 步骤编号 */
  stepNumber: number;
  /** 步骤内容（LaTeX） */
  content: string;
  /** 是否确认正确 */
  isCorrect: boolean;
  /** 记录时间 */
  timestamp: number;
  /** 关联的其他章节知识（可选） */
  related?: string;
}

// ============ 推荐引擎相关 ============

/** 推荐结果 */
export interface RecommendationResult {
  /** 推荐的题目（如果没有可推荐的则为 null） */
  question: Question | null;
  /** 推荐理由，用于展示给学生 */
  reason: string;
  /** 被推荐的题目覆盖了哪些尚未学过的知识点 */
  newlyCoveredKnowledgePoints: string[];
}

/** 知识点覆盖率统计 */
export interface CoverageStats {
  /** 总知识点数 */
  total: number;
  /** 已覆盖知识点数 */
  covered: number;
  /** 覆盖百分比（0~100，保留一位小数） */
  percentage: number;
  /** 尚未覆盖的知识点ID列表 */
  remaining: string[];
}

/** 章节总结中的题目-知识点映射 */
export interface ChapterSummaryEntry {
  /** 题目ID */
  questionId: string;
  /** 题目文本摘要（截取前50字） */
  promptSummary: string;
  /** 该题覆盖的知识点列表 */
  coveredKnowledgePointIds: string[];
  /** 完成时间 */
  completedAt: number;
}

/** 章节通关总结 */
export interface ChapterSummary {
  /** 章节ID */
  chapterId: string;
  /** 是否已通关 */
  isCleared: boolean;
  /** 知识点覆盖率 */
  coverage: CoverageStats;
  /** 每道做过的题覆盖了哪些知识点 */
  entries: ChapterSummaryEntry[];
  /** 完整知识点体系（按 order 排序），标注每个知识点的掌握状态 */
  knowledgeMap: {
    knowledgePoint: KnowledgePoint;
    covered: boolean;
    /** 如果已覆盖，是被哪道题覆盖的 */
    coveredByQuestionId?: string;
  }[];
}
