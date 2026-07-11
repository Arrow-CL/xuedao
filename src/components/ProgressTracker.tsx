"use client";
import { useCallback, useEffect, useState } from "react";
import { UserProgress } from "@/types";
import storage from "@/lib/storage";

export default function ProgressTracker({ moduleId }: { moduleId?: string }) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [collectedCount, setCollectedCount] = useState(0);

  const loadProgress = useCallback(async () => {
    const p = await storage.getProgress("local");
    setProgress(p);
    const ids = await storage.getCollectedIds("local");
    setCollectedCount(ids.length);
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  if (!progress) return null;

  const moduleData = moduleId ? progress.moduleProgress[moduleId] : null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1 text-amber-600">
        <span>🔥</span>
        <span className="font-semibold">{progress.streak.current}</span>
        <span className="text-gray-400">天</span>
      </div>

      {moduleData && (
        <div className="text-gray-500">
          <span className="font-medium text-gray-700">{moduleData.completedUnits.length}</span> 单元完成
        </div>
      )}

      <div className="text-gray-400">
        <span>📌 {collectedCount}</span>
      </div>
    </div>
  );
}
