"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chapters } from "@/data/chapters";
import {
  getProgress,
  getChapterProgress,
  getStudyStats,
  getChapterReviewInfo,
} from "@/lib/storage-v2";
import type { UserProgress } from "@/lib/types";
import {
  TOTAL_SCORE,
  getChapterScore,
  getScoreStatus,
  getScoreColor,
  getScoreBgColor,
} from "@/data/chapter-scores";
import {
  Lock,
  CheckCircle2,
  ChevronRight,
  Map,
  Flame,
  BookOpen,
  Trophy,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  状态类型                                                          */
/* ------------------------------------------------------------------ */

interface ChapterState {
  id: string;
  title: string;
  order: number;
  difficulty: number;
  unlocked: boolean;
  completedCount: number;
  totalQuestions: number;
  isCleared: boolean;
  started: boolean;
  coveredKP: number;   // 已覆盖知识点数
  totalKP: number;     // 总知识点数
  score: number;       // 高考占分
  lastReviewTimestamp?: number;
  reviewCount: number;
}

interface Stats {
  totalQuestionsCompleted: number;
  chaptersCleared: number;
  totalKnowledgePointsCovered: number;
  streakDays: number;
  masteredScore: number;
}

/* ------------------------------------------------------------------ */
/*  工具函数                                                          */
/* ------------------------------------------------------------------ */

/** 渲染难度圆点 */
function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            i <= level ? "bg-indigo-400" : "bg-gray-200"
          }`}
        />
      ))}
    </span>
  );
}

/** 状态标签文字 */
function statusLabel(ch: ChapterState) {
  if (ch.isCleared) return { text: "已通关", color: "text-green-600" };
  if (ch.completedCount > 0) return { text: "进行中", color: "text-amber-600" };
  if (ch.unlocked) return { text: "未开始", color: "text-gray-500" };
  return { text: "未解锁", color: "text-gray-400" };
}

/* ------------------------------------------------------------------ */
/*  页面组件                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  const router = useRouter();
  const [chapterStates, setChapterStates] = useState<ChapterState[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalQuestionsCompleted: 0,
    chaptersCleared: 0,
    totalKnowledgePointsCovered: 0,
    streakDays: 0,
    masteredScore: 0,
  });
  const [loaded, setLoaded] = useState(false);

  /* 加载数据 */
  useEffect(() => {
    const progress: UserProgress = getProgress();
    const maxOrder = progress.maxUnlockedOrder ?? 1;

    const sorted = [...chapters].sort((a, b) => a.order - b.order);

    const states: ChapterState[] = sorted.map((ch) => {
      const cp = getChapterProgress(ch.id);
      const unlocked = ch.order <= maxOrder;
      const reviewInfo = getChapterReviewInfo(ch.id);
      return {
        id: ch.id,
        title: ch.title,
        order: ch.order,
        difficulty: ch.difficulty,
        unlocked,
        completedCount: cp?.completedQuestionIds?.length ?? 0,
        totalQuestions: 0,
        isCleared: cp?.isCleared ?? false,
        started: cp !== null,
        coveredKP: cp?.coveredKnowledgePointIds?.length ?? 0,
        totalKP: ch.units.length,
        score: getChapterScore(ch.id),
        lastReviewTimestamp: cp?.lastReviewTimestamp,
        reviewCount: reviewInfo.reviewCount,
      };
    });

    const s = getStudyStats();

    setChapterStates(states);
    setStats(s);
    setLoaded(true);
  }, []);

  /* 点击章节 */
  const handleClick = (ch: ChapterState) => {
    if (!ch.unlocked) return;
    router.push("/solve?chapter=" + ch.id);
  };

  /* 点击梳理按钮 */
  const handleReview = (e: React.MouseEvent, ch: ChapterState) => {
    e.stopPropagation();
    router.push("/review?chapter=" + ch.id);
  };

  /* 分数进度条百分比 */
  const scorePercent = TOTAL_SCORE > 0 ? Math.round((stats.masteredScore / TOTAL_SCORE) * 100) : 0;

  /* ----- 骨架屏 ----- */
  if (!loaded) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-2xl mb-4 animate-pulse" />
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* ----- 主内容 ----- */
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-20">
      {/* ---- 顶部统计 ---- */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Map className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">学习地图</h1>
        </div>

        {/* 主统计区：掌握分数 */}
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50/50 p-5 mb-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                当前掌握分数
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {stats.masteredScore}
                </span>
                <span className="text-lg text-gray-400 font-medium">/ {TOTAL_SCORE}</span>
              </div>
            </div>
            <span className="text-xs font-medium text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">
              {scorePercent}%
            </span>
          </div>
          {/* 分数进度条 */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-700 ease-out"
              style={{ width: scorePercent + "%" }}
            />
          </div>
        </div>

        {/* 三列统计卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
            <BookOpen className="mx-auto mb-1 h-4.5 w-4.5 text-indigo-500" />
            <p className="text-lg font-bold text-gray-800">
              {stats.totalQuestionsCompleted}
            </p>
            <p className="text-[11px] text-gray-500">完成题目</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
            <CheckCircle2 className="mx-auto mb-1 h-4.5 w-4.5 text-green-500" />
            <p className="text-lg font-bold text-gray-800">
              {stats.chaptersCleared} / {chapters.length}
            </p>
            <p className="text-[11px] text-gray-500">通关章节</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
            <Flame className="mx-auto mb-1 h-4.5 w-4.5 text-amber-500" />
            <p className="text-lg font-bold text-gray-800">
              {stats.streakDays}
            </p>
            <p className="text-[11px] text-gray-500">连续学习(天)</p>
          </div>
        </div>
      </header>

      {/* ---- 章节列表 ---- */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {chapterStates.map((ch, idx) => {
            const pct =
              ch.totalQuestions > 0
                ? Math.round((ch.completedCount / ch.totalQuestions) * 100)
                : 0;
            const label = statusLabel(ch);
            const scoreStatus = getScoreStatus(ch.lastReviewTimestamp);
            const kpPct = ch.totalKP > 0 ? Math.round((ch.coveredKP / ch.totalKP) * 100) : 0;
            // 是否是当前进行中的章节（第一个已解锁但未通关的）
            const isActive = ch.unlocked && !ch.isCleared && ch.completedCount > 0;
            // 是否是下一个可解锁的章节（第一个已解锁但未开始的）
            const isNext = ch.unlocked && !ch.isCleared && ch.completedCount === 0;
            // 检查是否需要连接线（在2列布局中，上一个位置有内容且同行）
            const showConnector = idx >= 1 && idx % 2 === 1 && chapterStates[idx - 1].isCleared;

            return (
              <div key={ch.id} className="relative">
                {/* 卡片间的连接线（水平） */}
                {showConnector && (
                  <div className="hidden sm:block absolute -left-2 top-1/2 w-2 h-px bg-green-200 z-10" />
                )}

                <div
                  onClick={() => ch.unlocked && handleClick(ch)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && ch.unlocked && handleClick(ch)}
                  className={`relative text-left rounded-xl border p-4 transition-all duration-200 ${
                    ch.unlocked
                      ? isActive
                        ? "border-amber-200 bg-white hover:shadow-md hover:-translate-y-0.5 cursor-pointer ring-2 ring-amber-200/60 animate-pulse-subtle"
                        : "border-gray-200 bg-white hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-200 cursor-pointer"
                      : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50 blur-[0.5px]"
                  }`}
                >
                  {/* 右上角分值标签 */}
                  {ch.isCleared && (
                    <div className={`absolute top-3 right-3 flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${getScoreBgColor(scoreStatus)}`}>
                      {ch.score}分
                    </div>
                  )}
                  {!ch.isCleared && ch.unlocked && (
                    <div className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                      {ch.score}分
                    </div>
                  )}

                  {/* 章节序号 + 图标 */}
                  <div className="flex items-center justify-between mb-2 pr-12">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ch.isCleared
                          ? "bg-green-100 text-green-700"
                          : isActive
                            ? "bg-amber-100 text-amber-700"
                            : ch.unlocked
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {String(ch.order).padStart(2, "0")}
                    </span>
                    {!ch.unlocked && (
                      <Lock className="h-4 w-4 text-gray-300" />
                    )}
                    {ch.unlocked && !ch.isCleared && (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    {ch.isCleared && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>

                  {/* 标题 + 难度 */}
                  <h3
                    className={`text-sm font-semibold leading-snug mb-1 ${
                      ch.unlocked ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {ch.title}
                  </h3>

                  <div className="flex items-center gap-2 mb-3">
                    <DifficultyDots level={ch.difficulty} />
                    <span className={`text-xs ${label.color}`}>{label.text}</span>
                    {isActive && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    )}
                  </div>

                  {/* 进度条 */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        ch.isCleared
                          ? "bg-green-500"
                          : ch.completedCount > 0
                            ? "bg-indigo-500"
                            : "bg-gray-200"
                      }`}
                      style={{ width: pct + "%" }}
                    />
                  </div>

                  {/* 底部信息 */}
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-gray-400">
                      {ch.completedCount} / {ch.totalQuestions} 题
                    </p>
                    {ch.isCleared && ch.totalKP > 0 && (
                      <p className="text-[11px] text-green-600">
                        知识点覆盖 {ch.coveredKP}/{ch.totalKP}（{kpPct}%）
                      </p>
                    )}
                  </div>

                  {/* 通关后：梳理按钮 + 衰减提示 */}
                  {ch.isCleared && (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={(e) => handleReview(e, ch)}
                        className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        {ch.reviewCount > 0 ? `第${ch.reviewCount + 1}次梳理` : "梳理知识点"}
                      </button>
                      {scoreStatus === "fading" && (
                        <span className="text-[10px] text-yellow-600 bg-yellow-50 border border-yellow-100 px-1.5 py-1 rounded-md self-center">
                          快忘了
                        </span>
                      )}
                      {scoreStatus === "forgotten" && (
                        <span className="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-1 rounded-md self-center">
                          已遗忘
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- 底部 ---- */}
      <footer className="mt-10 text-center text-xs text-gray-400">
        <p>完成当前章节即可解锁下一章</p>
      </footer>
    </div>
  );
}
