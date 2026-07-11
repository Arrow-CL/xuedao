"use client";
import { useState } from "react";
import MathContent from "@/components/MathContent";
import formulasData from "@/data/formulas.json";

interface Props { moduleId: string; }

export default function FormulaCard({ moduleId: id }: Props) {
  const [open, setOpen] = useState(false);
  const formulas = (formulasData as Record<string, { name: string; latex: string }[]>)[id];
  if (!formulas || formulas.length === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 overflow-hidden transition-shadow hover:shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-indigo-50">
        <span className="inline-flex items-center gap-2 font-medium text-indigo-700">
          <svg className={"w-4 h-4 text-indigo-400 transition-transform " + (open ? "rotate-90" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          本章核心公式（{formulas.length}个）
        </span>
        <span className="text-xs text-indigo-400 tabular-nums">{open ? "收起" : "展开"}</span>
      </button>
      <div className={"overflow-hidden transition-all " + (open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
        <div className="px-4 pb-4 space-y-2">
          {formulas.map((f, i) => (
            <div key={i} className="bg-white rounded-lg p-3.5 border border-indigo-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-100 text-[10px] font-semibold text-indigo-600">{i + 1}</span>
                <span className="text-xs font-medium text-indigo-600">{f.name}</span>
              </div>
              <div className="text-sm text-gray-800 pl-7"><MathContent text={f.latex} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
