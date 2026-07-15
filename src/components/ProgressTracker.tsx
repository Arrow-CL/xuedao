"use client";
import { useCallback, useEffect, useState } from "react";
import { getStudyStats, getChapterProgress } from "@/lib/storage-v2";

interface ProgressTrackerProps {
  chapterId?: string;
}

export default function ProgressTracker({ chapterId }: ProgressTrackerProps) {
  const [stats, setStats] = useState<{
    streakDays: number;
    totalQuestionsCompleted: number;
    chaptersCleared: number;
  } | null>(null);
  const [chapterCompleted, setChapterCompleted] = useState(0);

  const loadProgress = useCallback(() => {
    const s = getStudyStats();
    setStats({
      streakDays: s.streakDays,
      totalQuestionsCompleted: s.totalQuestionsCompleted,
      chaptersCleared: s.chaptersCleared,
    });
    if (chapterId) {
      const cp = getChapterProgress(chapterId);
      setChapterCompleted(cp?.completedQuestionIds?.length ?? 0);
    }
  }, [chapterId]);

  useEffect(() => {
    loadProgress();
    // 监听storage变化，实时更新
    const handleStorageChange = () => loadProgress();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadProgress]);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1 text-amber-600">
        <span>🔥</span>
        <span className="font-semibold">{stats.streakDays}</span>
        <span className="text-gray-400">天连续</span>
      </div>

      {chapterId && (
        <div className="text-gray-500">
          <span className="font-medium text-gray-700">{chapterCompleted}</span> 题已完成
        </div>
      )}

      <div className="text-gray-500">
        <span className="font-medium text-gray-700">{stats.chaptersCleared}</span> 章已通关
      </div>

      <div className="text-gray-400">
        <span>📝 共{stats.totalQuestionsCompleted}题</span>
      </div>
    </div>
  );
}
