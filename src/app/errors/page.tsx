"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorRecord } from "@/types";
import storage from "@/lib/storage";

const TAG_NAMES: Record<string, string> = {
  "formula-recall": "公式记忆",
  "substitution-error": "代入错误",
  "calculation": "运算错误",
  "sign-error": "符号错误",
  "misconception": "概念混淆",
};

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [filterModule, setFilterModule] = useState("");

  const loadErrors = useCallback(async () => {
    const all = await storage.getErrors("local");
    setErrors(all.sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  useEffect(() => { loadErrors(); }, [loadErrors]);

  const filtered = filterModule ? errors.filter((e) => e.moduleId === filterModule) : errors;

  // Aggregate statistics
  const byModule: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  filtered.forEach((e) => {
    byModule[e.moduleId] = (byModule[e.moduleId] || 0) + 1;
    e.tags.forEach((t) => { byTag[t] = (byTag[t] || 0) + 1; });
  });

  const modules = [...new Set(errors.map((e) => e.moduleId))];
  const totalErrors = filtered.length;

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
          <div className="text-2xl font-bold text-blue-500">{Object.keys(byModule).length}</div>
          <div className="text-xs text-gray-500 mt-1">涉及章节</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white text-center">
          <div className="text-2xl font-bold text-amber-500">{filtered.length > 0 ? Math.round(filtered.filter((e) => e.tags.includes("formula-recall")).length / filtered.length * 100) : 0}%</div>
          <div className="text-xs text-gray-500 mt-1">公式记忆错误</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">全部章节</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* By tag */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white mb-6">
        <h2 className="font-medium text-gray-800 mb-3">错误类型分布</h2>
        <div className="space-y-2">
          {Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
            <div key={tag} className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-20">{TAG_NAMES[tag] || tag}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-red-400 rounded-full h-2" style={{ width: (count / Math.max(...Object.values(byTag)) * 100) + "%" }}></div>
              </div>
              <span className="text-xs text-gray-400">{count}次</span>
            </div>
          ))}
        </div>
      </div>

      {/* By module */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white mb-6">
        <h2 className="font-medium text-gray-800 mb-3">各章节错误次数</h2>
        <div className="space-y-2">
          {Object.entries(byModule).sort((a, b) => b[1] - a[1]).map(([mod, count]) => (
            <div key={mod} className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-32 truncate">{mod}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-blue-400 rounded-full h-2" style={{ width: (count / Math.max(...Object.values(byModule)) * 100) + "%" }}></div>
              </div>
              <span className="text-xs text-gray-400">{count}次</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent errors */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white">
        <h2 className="font-medium text-gray-800 mb-3">最近错误</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.slice(0, 20).map((e, i) => (
            <div key={i} className="text-sm border-b border-gray-100 pb-2 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{new Date(e.timestamp).toLocaleString()}</span>
                <span className="text-xs bg-red-50 text-red-600 px-1.5 rounded">{e.moduleId}</span>
                {e.tags.map((t) => <span key={t} className="text-xs bg-gray-50 text-gray-500 px-1.5 rounded">{TAG_NAMES[t] || t}</span>)}
              </div>
              <div className="text-gray-600 mt-0.5">
                答案: {e.studentAnswer} (正确: {e.correctAnswer})
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">暂无错题记录</p>}
        </div>
      </div>
    </div>
  );
}