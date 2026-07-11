"use client";
import { useState } from "react";

const FORMULAS: Record<string, {title:string;latex:string}[]> = {
  "sets-logic": [
    {title:"集合的含义", latex:"x \\in A"},
    {title:"交集", latex:"A \\cap B = \\{x \\mid x \\in A \\text{ 且 } x \\in B\\}"},
    {title:"并集", latex:"A \\cup B = \\{x \\mid x \\in A \\text{ 或 } x \\in B\\}"},
    {title:"补集", latex:"\\complement_U A = \\{x \\mid x \\in U \\text{ 且 } x \\notin A\\}"},
    {title:"子集个数", latex:"|P(A)| = 2^{|A|}"},
  ],
};

interface Props { moduleId: string; }

export default function FormulaPanel({ moduleId }: Props) {
  const formulas = FORMULAS[moduleId] || [];
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  const requestHint = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "system", content: "你是高考数学辅导老师。学生说“我不会”，请给出解题思路提示，不要直接写答案。提示要步步深入，简洁明了。" }], moduleId: moduleId, unitName: "提示" }),
      });
      const data = await res.json();
      setHint(data.reply || "暂无提示");
    } catch { setHint("暂无提示"); }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      {formulas.map((f, i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">{f.title}</p>
          <p className="text-sm font-mono text-gray-800">{f.latex}</p>
        </div>
      ))}
      <button onClick={requestHint} disabled={loading}
        className="w-full py-2 bg-gray-100 text-gray-500 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">
        {loading ? "思考中..." : "💡 我不会"}
      </button>
      {hint && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          {hint}
        </div>
      )}
    </div>
  );
}
