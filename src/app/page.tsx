"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chapters } from "@/data/chapters";
import { getProgress, getChapterProgress, getStudyStats } from "@/lib/storage-v2";
import type { UserProgress } from "@/lib/types";
import {
  Lock,
  CheckCircle2,
  ChevronRight,
  Map,
  Flame,
  BookOpen,
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
}

interface Stats {
  totalQuestionsCompleted: number;
  chaptersCleared: number;
  totalKnowledgePointsCovered: number;
  streakDays: number;
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
          className={`inline-block h-2 w-2 rounded-full ${
            i <= level ? "bg-gray-700" : "bg-gray-300"
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
      return {
        id: ch.id,
        title: ch.title,
        order: ch.order,
        difficulty: ch.difficulty,
        unlocked,
        completedCount: cp?.completedQuestionIds?.length ?? 0,
        totalQuestions: 0, // 题目数据尚未录入
        isCleared: cp?.isCleared ?? false,
        started: cp !== null,
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

  /* ----- 骨架屏 ----- */
  if (!loaded) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* ----- 主内容 ----- */
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* ---- 顶部统计 ---- */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Map className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">学习地图</h1>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* 总完成题数 */}
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <BookOpen className="mx-auto mb-1 h-5 w-5 text-indigo-500" />
            <p className="text-lg font-semibold text-gray-800">
              {stats.totalQuestionsCompleted}
            </p>
            <p className="text-xs text-gray-500">完成题目</p>
          </div>

          {/* 通关章节数 */}
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-500" />
            <p className="text-lg font-semibold text-gray-800">
              {stats.chaptersCleared} / {chapters.length}
            </p>
            <p className="text-xs text-gray-500">通关章节</p>
          </div>

          {/* 连续学习天数 */}
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <Flame className="mx-auto mb-1 h-5 w-5 text-amber-500" />
            <p className="text-lg font-semibold text-gray-800">
              {stats.streakDays}
            </p>
            <p className="text-xs text-gray-500">连续学习(天)</p>
          </div>
        </div>
      </header>

      {/* ---- 章节列表 ---- */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {chapterStates.map((ch) => {
            const pct =
              ch.totalQuestions > 0
                ? Math.round((ch.completedCount / ch.totalQuestions) * 100)
                : 0;
            const label = statusLabel(ch);

            return (
              <div
                key={ch.id}
                onClick={() => ch.unlocked && handleClick(ch)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && ch.unlocked && handleClick(ch)}
                className={`relative text-left rounded-xl border p-4 transition-colors ${
                  ch.unlocked
                    ? "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm cursor-pointer"
                    : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                }`}
              >
                {/* 章节序号 */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      ch.isCleared
                        ? "bg-green-100 text-green-700"
                        : ch.completedCount > 0
                          ? "bg-amber-100 text-amber-700"
                          : ch.unlocked
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {String(ch.order).padStart(2, "0")}
                  </span>
                  {!ch.unlocked && (
                    <Lock className="h-4 w-4 text-gray-400" />
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
                </div>

                {/* 进度条 */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ch.isCleared
                        ? "bg-green-500"
                        : ch.completedCount > 0
                          ? "bg-indigo-500"
                          : "bg-gray-200"
                    }`}
                    style={{ width: pct + "%" }}
                  />
                </div>

                <p className="text-xs text-gray-400 mt-1.5">
                  {ch.completedCount} / {ch.totalQuestions} 题
                </p>
                {ch.isCleared && (
                  <button
                    onClick={(e) => handleReview(e, ch)}
                    className="mt-2 w-full text-xs font-medium py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    梳理知识点
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- 底部 ---- */}
      <footer className="mt-10 text-center text-xs text-gray-400">
        <p>完成当前章节 60% 即可解锁下一章</p>
      </footer>
    </div>
  );
}
