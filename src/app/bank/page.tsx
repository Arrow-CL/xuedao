"use client";

import { useState, useMemo } from "react";
import { chapters } from "@/data/chapters";
import { allExercises, KnowledgeExercise } from "@/data/knowledge-exercises";
import MathContent from "@/components/MathContent";
import { BookOpen, Search, Filter, ChevronDown, ChevronRight, Star } from "lucide-react";

const difficultyLabels: Record<number, string> = {
  1: "基础",
  2: "中等",
  3: "较难",
};

const difficultyColors: Record<number, string> = {
  1: "bg-green-100 text-green-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-red-100 text-red-700",
};

const typeLabels: Record<string, string> = {
  calculate: "计算",
  choice: "选择",
  fill: "填空",
  solve: "解答",
};

// 构建 unitId -> chapter 的映射
const unitToChapter: Record<string, { chapterId: string; chapterTitle: string; unitName: string }> = {};
chapters.forEach((ch) => {
  ch.units.forEach((u) => {
    unitToChapter[u.id] = {
      chapterId: ch.id,
      chapterTitle: ch.title,
      unitName: u.name,
    };
  });
});

export default function BankPage() {
  const [search, setSearch] = useState("");
  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleChapter = (id: string) => {
    const next = new Set(expandedChapters);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedChapters(next);
  };

  const toggleUnit = (unitId: string) => {
    const next = new Set(selectedUnits);
    if (next.has(unitId)) next.delete(unitId);
    else next.add(unitId);
    setSelectedUnits(Array.from(next));
  };

  const toggleDifficulty = (d: number) => {
    const next = [...selectedDifficulties];
    const idx = next.indexOf(d);
    if (idx >= 0) next.splice(idx, 1);
    else next.push(d);
    setSelectedDifficulties(next);
  };

  const toggleType = (t: string) => {
    const next = [...selectedTypes];
    const idx = next.indexOf(t);
    if (idx >= 0) next.splice(idx, 1);
    else next.push(t);
    setSelectedTypes(next);
  };

  const filtered = useMemo(() => {
    return allExercises.filter((q) => {
      if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(q.difficulty)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(q.type)) return false;
      if (selectedUnits.length > 0 && !selectedUnits.includes(q.unitId)) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          q.prompt.toLowerCase().includes(s) ||
          (q.gaokaoConnection && q.gaokaoConnection.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [search, selectedDifficulties, selectedTypes, selectedUnits]);

  const toggleQuestion = (id: string) => {
    const next = new Set(expandedQuestions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedQuestions(next);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">精选题库</h1>
              <span className="text-sm text-gray-500">共 {filtered.length} 题</span>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索题目..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* 左侧筛选 */}
        <div className="w-64 shrink-0 space-y-6">
          {/* 难度筛选 */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4" />
              难度
            </h3>
            <div className="space-y-2">
              {[1, 2, 3].map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.includes(d)}
                    onChange={() => toggleDifficulty(d)}
                    className="rounded text-blue-600"
                  />
                  <span className={`text-xs px-2 py-0.5 rounded ${difficultyColors[d]}`}>
                    {difficultyLabels[d]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 题型筛选 */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              题型
            </h3>
            <div className="space-y-2">
              {["choice", "fill", "solve", "calculate"].map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t)}
                    onChange={() => toggleType(t)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-600">{typeLabels[t]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 章节/单元筛选 */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">章节</h3>
            <div className="space-y-1">
              {chapters.map((ch) => (
                <div key={ch.id}>
                  <button
                    onClick={() => toggleChapter(ch.id)}
                    className="flex items-center gap-1 w-full text-left text-sm font-medium text-gray-800 hover:bg-gray-50 p-1.5 rounded"
                  >
                    {expandedChapters.has(ch.id) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    )}
                    <span className="truncate">{ch.title}</span>
                  </button>
                  {expandedChapters.has(ch.id) && (
                    <div className="ml-5 space-y-0.5">
                      {ch.units.map((u) => {
                        const count = allExercises.filter((e) => e.unitId === u.id).length;
                        if (count === 0) return null;
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedUnits.includes(u.id)}
                              onChange={() => toggleUnit(u.id)}
                              className="rounded text-blue-600"
                            />
                            <span className="text-xs text-gray-600 truncate">{u.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">{count}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧题目列表 */}
        <div className="flex-1 space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>没有符合条件的题目</p>
            </div>
          ) : (
            filtered.map((q, idx) => {
              const info = unitToChapter[q.unitId];
              const isExpanded = expandedQuestions.has(q.id);
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-lg border hover:shadow-sm transition-shadow"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleQuestion(q.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-medium text-gray-400 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${difficultyColors[q.difficulty]}`}>
                            {difficultyLabels[q.difficulty]}
                          </span>
                          <span className="text-xs text-gray-500">{typeLabels[q.type]}</span>
                          {info && (
                            <span className="text-xs text-gray-400">
                              {info.chapterTitle} · {info.unitName}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-800 leading-relaxed">
                          <MathContent text={q.prompt} />
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t bg-gray-50/50">
                      {q.options && q.options.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {q.options.map((opt, i) => (
                            <div key={i} className="text-sm text-gray-700">
                              <MathContent text={opt} />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-4">
                        <div className="text-sm">
                          <span className="text-gray-500">答案：</span>
                          <span className="font-medium text-blue-700">
                            <MathContent text={String(q.answer)} />
                          </span>
                        </div>
                      </div>
                      {q.gaokaoConnection && (
                        <div className="mt-2 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                          <span className="font-medium text-amber-700">考法点拨：</span>
                          {q.gaokaoConnection}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
