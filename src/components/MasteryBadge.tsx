"use client";
interface Props { level: number; }
var labels = ["\u672a\u63a5\u89e6","\u521d\u5b66","\u7406\u89e3","\u719f\u7ec3","\u7cbe\u901a","\u638c\u63e1"];
var colors = ["bg-gray-800 text-gray-400","bg-blue-900/40 text-blue-300","bg-cyan-900/40 text-cyan-300","bg-amber-900/40 text-amber-300","bg-orange-900/40 text-orange-300","bg-emerald-900/40 text-emerald-300"];
export default function MasteryBadge({ level }: Props) {
  return (
    <div className={"inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium " + (colors[level] || colors[0])}>
      <span className="font-bold">Lv.{level}</span>
      <span>{labels[level] || "\u672a\u77e5"}</span>
    </div>
  );
}