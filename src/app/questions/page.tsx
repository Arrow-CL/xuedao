"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { chapters } from "@/data/chapters";
import { getQuestions } from "@/data/questions";

interface ExBrief { id: string; chapterId: string; prompt: string; difficulty: number; }

export default function QuestionsPage() {
  const [exercises, setExercises] = useState<ExBrief[]>([]);
  const [chapter, setChapter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const all: ExBrief[] = [];
      for (const ch of chapters) {
        try {
          const data = await import("@/data/" + ch.id + "/exercises.json");
          const exs = (data as any).default?.exercises || (data as any).exercises || [];
          exs.forEach((ex: any) => all.push({
            id: ex.id, chapterId: ch.id,
            prompt: ex.prompt, difficulty: ex.difficulty || 1,
          }));
        } catch {}
      }
      setExercises(all);
      setLoading(false);
    })();
  }, []);

  const filtered = chapter === "all" ? exercises : exercises.filter(e => e.chapterId === chapter);

  function Stars({ d }: { d: number }) {
    return (
      <span className="inline-flex gap-0.5">
        {Array.from({length:5},(_,i)=>(
          <span key={i} className={i < d ? "text-amber-400" : "text-gray-200"}>★</span>
        ))}
      </span>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">高考题库</h1>
            <p className="text-xs text-gray-400">共 {exercises.length} 道高考真题（近10年）</p>
          </div>
        </div>
      </div>

      {/* Chapter filter */}
      <div className="flex gap-2 mt-6 mb-5 overflow-x-auto pb-1">
        <button onClick={() => setChapter("all")}
          className={"flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all " +
            (chapter === "all"
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700")}>
          全部
        </button>
        {chapters.map(c => (
          <button key={c.id} onClick={() => setChapter(c.id)}
            className={"flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all " +
              (chapter === c.id
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700")}>
            {c.title || c.id}
          </button>
        ))}
      </div>

      {/* Question list */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
          <p className="text-sm text-gray-400 mt-3">加载题目中...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">暂无题目</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(ex => {
            const ch = chapters.find(c => c.id === ex.chapterId);
            return (
              <Link key={ex.id} href={"/modules/" + ex.chapterId}
                className="group block rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm bg-white transition-all">
                <p className="text-sm text-gray-800 leading-relaxed line-clamp-2 group-hover:text-gray-900">
                  {ex.prompt}
                </p>
                <div className="flex items-center gap-3 mt-2.5">
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md border border-gray-100">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    {ch?.title || ex.chapterId}
                  </span>
                  <Stars d={ex.difficulty} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
