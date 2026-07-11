"use client";
import MathContent from "./MathContent";
interface Props { type: "formula" | "property"; content: string; desc?: string; idx: number; }
export default function RuleCard({ type, content, desc, idx }: Props) {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 hover:border-amber-500/30 transition-colors">
      <div className="text-xs text-amber-500/60 mb-2">{type === "formula" ? "∑ 公式" : "📌 性质"} #{idx}</div>
      {type === "formula" ? (
        <div className="text-center py-2"><MathContent text={content} /></div>
      ) : (
        <div className="text-sm text-[#ccc]"><MathContent text={content} /></div>
      )}
      {desc && <div className="text-xs text-[#888] mt-2">{desc}</div>}
    </div>
  );
}