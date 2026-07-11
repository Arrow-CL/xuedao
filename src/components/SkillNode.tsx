"use client";
interface Props { id: string; title: string; level: number; active: boolean; onClick: () => void; }
export default function SkillNode({ id, title, level, active, onClick }: Props) {
  var colors = active
    ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
    : level >= 3 ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300"
    : level > 0 ? "bg-gray-800 border-gray-600 text-gray-300"
    : "bg-gray-900 border-gray-700 text-gray-500 opacity-60";
  return (
    <button onClick={onClick}
      className={"text-xs px-3 py-1.5 rounded-full border transition-all duration-200 " + colors}>
      {level >= 3 ? "✅ " : level > 0 ? "📌 " : "🔒 "}{title}
    </button>
  );
}