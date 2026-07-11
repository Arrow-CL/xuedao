/**
 * storage-v2.ts — 新版进度管理模块
 *
 * 管理用户学习进度，使用 localStorage 持久化。
 * 与旧版 storage.ts 完全独立，保留旧版不动。
 *
 * 数据结构围绕"章节 (ChapterProgress)" 和"错题本 (QuestionRecord)" 设计，
 * 支持 streak 连续学习天数、知识点覆盖追踪、通关标记等。
 */

import type {
  UserProgress,
  ChapterProgress,
  QuestionRecord,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const PROGRESS_KEY = "xuedao_progress_v2";

/** 创建一个全新的默认进度 */
function createDefaultProgress(): UserProgress {
  return {
    maxUnlockedOrder: 1,
    chapters: {},
    errorRecords: [],
    totalDays: 0,
    lastStudyDate: "",
    streakDays: 0,
  };
}

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/** 获取今天日期字符串 YYYY-MM-DD（本地时间） */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 获取昨天日期字符串 YYYY-MM-DD */
function yesterdayStr(): string {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 安全地从 localStorage 读取并解析 JSON，失败时返回 null */
function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 安全地将值写入 localStorage */
function writeToStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 获取用户完整进度
 * - 如果 localStorage 中没有数据，返回默认进度
 * - 服务端渲染（typeof window === "undefined"）时也返回默认进度
 */
export function getProgress(): UserProgress {
  const stored = loadFromStorage<UserProgress>(PROGRESS_KEY);
  if (!stored) return createDefaultProgress();
  // 兼容：确保字段完整
  return {
    maxUnlockedOrder: stored.maxUnlockedOrder ?? 1,
    chapters: stored.chapters ?? {},
    errorRecords: stored.errorRecords ?? [],
    totalDays: stored.totalDays ?? 0,
    lastStudyDate: stored.lastStudyDate ?? "",
    streakDays: stored.streakDays ?? 0,
  };
}

/**
 * 保存用户完整进度
 * - 直接将传入的 progress 序列化写入 localStorage
 */
export function saveProgress(progress: UserProgress): void {
  writeToStorage(PROGRESS_KEY, progress);
}

/**
 * 记录一道题完成
 *
 * 逻辑：
 *  1. 获取当前进度（若不存在则创建默认进度）
 *  2. 初始化对应 chapterId 的 ChapterProgress（如不存在）
 *  3. 将 questionId 加入 completedQuestionIds（去重）
 *  4. 合并 coveredKnowledgePointIds
 *  5. 更新 lastStudyDate 并刷新 streak
 *  6. 如果有错误记录（errorCount > 0），创建 QuestionRecord 并加入 errorRecords
 *
 * @param questionId               题目 ID
 * @param chapterId                章节 ID
 * @param coveredKnowledgePointIds 本题涉及的知识点 ID
 * @param errorCount               做题时的错误次数（可选，默认 0）
 * @param errorSteps               出错的步骤描述（可选）
 * @returns 更新后的完整 UserProgress
 */
export function recordQuestionComplete(
  questionId: string,
  chapterId: string,
  coveredKnowledgePointIds: string[],
  errorCount?: number,
  errorSteps?: string[],
): UserProgress {
  const progress = getProgress();

  // ---- 初始化章节进度 ----
  if (!progress.chapters[chapterId]) {
    progress.chapters[chapterId] = {
      chapterId,
      completedQuestionIds: [],
      coveredKnowledgePointIds: [],
      isCleared: false,
      totalAttempted: 0,
    };
  }

  const chapter = progress.chapters[chapterId];

  // ---- 更新已完成题目（去重） ----
  if (!chapter.completedQuestionIds.includes(questionId)) {
    chapter.completedQuestionIds.push(questionId);
  }

  // ---- 合并知识点覆盖 ----
  for (const kpId of coveredKnowledgePointIds) {
    if (!chapter.coveredKnowledgePointIds.includes(kpId)) {
      chapter.coveredKnowledgePointIds.push(kpId);
    }
  }

  // ---- 错误记录（写入全局 errorRecords） ----
  const ec = errorCount ?? 0;
  if (ec > 0) {
    const record: QuestionRecord = {
      questionId,
      chapterId,
      completedAt: Date.now(),
      coveredKnowledgePointIds,
      errorCount: ec,
      errorSteps: errorSteps ?? [],
    };
    progress.errorRecords.push(record);
  }

  // ---- 更新 streak ----
  updateStreak(progress);

  // ---- 持久化 ----
  saveProgress(progress);

  return progress;
}

/**
 * 获取某章节进度
 * - 如果该章节没有任何记录，返回 null
 */
export function getChapterProgress(chapterId: string): ChapterProgress | null {
  const progress = getProgress();
  return progress.chapters[chapterId] ?? null;
}

/**
 * 检查并更新连续学习天数
 *
 * 规则：
 * - 如果 lastStudyDate 是今天 → 不做任何修改
 * - 如果 lastStudyDate 是昨天 → streakDays + 1
 * - 其他情况（隔了多天 / 从未学习过）→ streakDays 重置为 1
 * - 更新 lastStudyDate 为今天
 *
 * @returns 更新后的 UserProgress（注意：此函数不自动持久化，调用方需自行 saveProgress）
 */
export function updateStreak(progress: UserProgress): UserProgress {
  const today = todayStr();

  // 今天已记录过，跳过
  if (progress.lastStudyDate === today) {
    return progress;
  }

  const yesterday = yesterdayStr();

  if (progress.lastStudyDate === yesterday) {
    // 昨天学过，连续天数 +1
    progress.streakDays += 1;
  } else if (progress.lastStudyDate === "") {
    // 首次学习
    progress.streakDays = 1;
  } else {
    // 中断过了，重新开始
    progress.streakDays = 1;
  }

  progress.lastStudyDate = today;
  return progress;
}

/**
 * 获取错误本（所有 errorCount > 0 的记录）
 *
 * 遍历所有章节的 errorRecords，返回合并列表，按时间倒序排列
 */
export function getErrorRecords(): QuestionRecord[] {
  const progress = getProgress();
  return progress.errorRecords
    .filter(r => r.errorCount > 0)
    .sort((a, b) => b.completedAt - a.completedAt);
}

/**
 * 获取某章节的错误记录
 * - 返回该章节下 errorCount > 0 的题目记录
 * - 包含 questionId、errorCount、errorSteps，用于知识点梳理时回顾错误
 */
export function getChapterErrorRecords(chapterId: string): QuestionRecord[] {
  const progress = getProgress();
  return progress.errorRecords
    .filter(r => r.chapterId === chapterId && r.errorCount > 0)
    .sort((a, b) => b.completedAt - a.completedAt);
}

/**
 * 获取某章节已完成的题目ID列表
 */
export function getChapterCompletedQuestions(chapterId: string): string[] {
  const progress = getProgress();
  return progress.chapters[chapterId]?.completedQuestionIds ?? [];
}

/**
 * 重置某章节进度
 * - 从 chapters 中删除对应章节
 * - 不会影响其他章节
 * - 不会重置 maxUnlockedOrder 或 streak
 */
export function resetChapterProgress(chapterId: string): void {
  const progress = getProgress();

  if (progress.chapters[chapterId]) {
    delete progress.chapters[chapterId];
    saveProgress(progress);
  }
}

/**
 * 标记某章节所有知识点已覆盖（用于进入知识点梳理）
 * - 不需要实际做完所有题，直接将所有知识点标记为已覆盖
 * - 同时标记章节通关
 */
export function markChapterAllCovered(chapterId: string): void {
  const progress = getProgress();

  if (!progress.chapters[chapterId]) {
    progress.chapters[chapterId] = {
      chapterId,
      completedQuestionIds: [],
      coveredKnowledgePointIds: [],
      isCleared: true,
      totalAttempted: 0,
    };
  }

  progress.chapters[chapterId].isCleared = true;
  saveProgress(progress);
}

/**
 * 保存梳理板书（知识点笔记）
 * - 以 chapterId 为键存储板书内容到 localStorage
 */
const REVIEW_BOARD_KEY = "xuedao_review_board";

export interface ReviewBoardEntry {
  unitId: string;
  unitName: string;
  content: string;  // 知识点内容（LaTeX格式）
  order: number;
}

export function getReviewBoard(chapterId: string): ReviewBoardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${REVIEW_BOARD_KEY}_${chapterId}`);
    if (!raw) return [];
    return JSON.parse(raw) as ReviewBoardEntry[];
  } catch {
    return [];
  }
}

export function saveReviewBoardEntry(chapterId: string, entry: ReviewBoardEntry): void {
  if (typeof window === "undefined") return;
  const board = getReviewBoard(chapterId);
  const existing = board.findIndex((e) => e.unitId === entry.unitId);
  if (existing >= 0) {
    // 覆盖：同一个知识点只保留最新内容，不追加
    board[existing] = entry;
  } else {
    board.push(entry);
  }
  localStorage.setItem(`${REVIEW_BOARD_KEY}_${chapterId}`, JSON.stringify(board));
}

export function clearReviewBoard(chapterId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${REVIEW_BOARD_KEY}_${chapterId}`);
}

/**
 * 获取总学习统计
 *
 * 汇总所有章节的数据，返回：
 * - totalQuestionsCompleted  全部已完成题目数
 * - chaptersCleared          已通关章节数
 * - totalKnowledgePointsCovered  已覆盖知识点总数（去重）
 * - streakDays               当前连续学习天数
 */
export function getStudyStats(): {
  totalQuestionsCompleted: number;
  chaptersCleared: number;
  totalKnowledgePointsCovered: number;
  streakDays: number;
} {
  const progress = getProgress();

  let totalQuestionsCompleted = 0;
  let chaptersCleared = 0;
  const allKnowledgePoints = new Set<string>();

  for (const chapterId of Object.keys(progress.chapters)) {
    const chapter = progress.chapters[chapterId];

    totalQuestionsCompleted += chapter.completedQuestionIds?.length ?? 0;

    if (chapter.isCleared) {
      chaptersCleared += 1;
    }

    if (chapter.coveredKnowledgePointIds) {
      for (const kpId of chapter.coveredKnowledgePointIds) {
        allKnowledgePoints.add(kpId);
      }
    }
  }

  return {
    totalQuestionsCompleted,
    chaptersCleared,
    totalKnowledgePointsCovered: allKnowledgePoints.size,
    streakDays: progress.streakDays,
  };
}
