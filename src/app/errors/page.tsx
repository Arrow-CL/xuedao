"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getErrorRecords } from "@/lib/storage-v2";
import type { QuestionRecord } from "@/lib/types";

const TAG_NAMES: Record<string, string> = {
  "formula-recall": "公式记忆",
  "substitution-error": "代入错误",
  "calculation": "运算错误",
  "sign-error": "符号错误",
  "misconception": "概念混淆",
};

// 错误记录展示类型
interface ErrorDisplayRecord extends QuestionRecord {
  moduleName?: string;
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorDisplayRecord[]>([]);
  const [filterChapter, setFilterChapter] = useState("");

  const loadErrors = useCallback(async () => {
    const records = getErrorRecords();
    // 补充显示信息
    const displayRecords: ErrorDisplayRecord[] = records.map(r => ({
      ...r,
      moduleName: r.chapterId,
    }));
    setErrors(displayRecords);
  }, []);

  useEffect(() => { loadErrors(); }, [loadErrors]);

  const filtered = filterChapter ? errors.filter((e) => e.chapterId === filterChapter) : errors;

  // Aggregate statistics
  const byChapter: Record<string, number> = {};
  const totalErrors = filtered.length;
  filtered.forEach((e) => {
    byChapter[e.chapterId] = (byChapter[e.chapterId] || 0) + 1;
  });

  const chapters = [...new Set(errors.map((e) => e.chapterId))];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 学习地图</Link>
        <h1 className="text-xl font-bold text-gray-900">错题分析</h1>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 p-4 bg-white text-center">
          <div className="text-2xl font-bold text-red-500">{totalErrors}</div>
          <div className="text-xs text-gray-500 mt-1">总错误次数</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white text-center">
          <div className="text-2xl font-bold text-blue-500">{Object.keys(byChapter).length}</div>
          <div className="text-xs text-gray-500 mt-1">涉及章节</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white text-center">
          <div className="text-2xl font-bold text-amber-500">{errors.length > 0 ? Math.round(errors.reduce((sum, e) => sum + e.errorCount, 0) / errors.length * 10) / 10 : 0}</div>
          <div className="text-xs text-gray-500 mt-1">平均每道题错误次数</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select value={filterChapter} onChange={(e) => setFilterChapter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">全部章节</option>
          {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 错误次数分布 */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white mb-6">
        <h2 className="font-medium text-gray-800 mb-3">各章节错误次数</h2>
        <div className="space-y-2">
          {Object.entries(byChapter).sort((a, b) => b[1] - a[1]).map(([chapter, count]) => (
            <div key={chapter} className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-32 truncate">{chapter}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-blue-400 rounded-full h-2" style={{ width: (count / Math.max(...Object.values(byChapter)) * 100) + "%" }}></div>
              </div>
              <span className="text-xs text-gray-400">{count}次</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent errors */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white">
        <h2 className="font-medium text-gray-800 mb-3">最近错误</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.slice(0, 30).map((e, i) => (
            <div key={i} className="text-sm border-b border-gray-100 pb-3 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400">{new Date(e.completedAt).toLocaleString()}</span>
                <span className="text-xs bg-red-50 text-red-600 px-1.5 rounded">{e.chapterId}</span>
                <span className="text-xs bg-orange-50 text-orange-600 px-1.5 rounded">错误{e.errorCount}次</span>
              </div>
              <div className="text-gray-700 text-xs mb-1">题目ID：{e.questionId}</div>
              {e.errorSteps && e.errorSteps.length > 0 && (
                <div className="text-gray-500 text-xs">
                  错误步骤：{e.errorSteps.join(" → ")}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">暂无错题记录，快去做题吧~</p>}
        </div>
      </div>
    </div>
  );
}