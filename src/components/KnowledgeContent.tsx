"use client";
import MathContent from "@/components/MathContent";

interface Props { text: string; }

const PREFIXES = [
  { key: "说明", icon: "📝", bg: "bg-white", border: "border-gray-200", labelColor: "text-gray-600" },
  { key: "公式", icon: "📐", bg: "bg-purple-50", border: "border-purple-200", labelColor: "text-purple-600" },
  { key: "定义", icon: "📋", bg: "bg-amber-50", border: "border-amber-200", labelColor: "text-amber-600" },
  { key: "性质", icon: "💡", bg: "bg-teal-50", border: "border-teal-200", labelColor: "text-teal-600" },
  { key: "图形", icon: "📈", bg: "bg-white", border: "border-dashed border-gray-300", labelColor: "text-gray-500" },
  { key: "定理", icon: "📖", bg: "bg-blue-50", border: "border-blue-200", labelColor: "text-blue-600" },
  { key: "结论", icon: "🎯", bg: "bg-green-50", border: "border-green-200", labelColor: "text-green-600" },
  { key: "例题", icon: "✏️", bg: "bg-indigo-50", border: "border-indigo-200", labelColor: "text-indigo-600" },
  { key: "易错", icon: "⚠️", bg: "bg-red-50", border: "border-red-200", labelColor: "text-red-600" },
];

export default function KnowledgeContent({ text }: Props) {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks: { type: string; content: string; style: typeof PREFIXES[0] | null }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // 空行：如果最后一个 block 是普通文本，追加换行；否则忽略
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "text") {
        blocks[blocks.length - 1].content += "\n";
      }
      continue;
    }

    // 检查是否匹配某个前缀
    let matched = false;
    for (const p of PREFIXES) {
      const re = new RegExp("^" + p.key + "[\uFF1A:]\\s*");
      if (re.test(trimmed)) {
        const content = trimmed.replace(re, "").trim();
        blocks.push({ type: p.key, content, style: p });
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 普通文本行
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "text") {
        blocks[blocks.length - 1].content += "\n" + trimmed;
      } else {
        blocks.push({ type: "text", content: trimmed, style: null });
      }
    }
  }

  if (blocks.length === 0)
    return <MathContent text={text} />;

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          return (
            <div key={i} className="text-gray-800 leading-relaxed">
              <MathContent text={block.content} />
            </div>
          );
        }
        const s = block.style!;
        return (
          <div key={i} className={`${s.bg} border ${s.border} rounded-lg p-4`}>
            <div className={`text-xs ${s.labelColor} font-medium mb-1`}>{s.icon} {block.type}</div>
            <div className="text-gray-900 leading-relaxed">
              <MathContent text={block.content} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
