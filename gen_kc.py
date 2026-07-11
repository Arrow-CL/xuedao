"use client";
import MathContent from "@/components/MathContent";

interface Props { text: string; }

export default function KnowledgeContent({ text }: Props) {
  if (!text) return null;

  const lines = text.split("\n").filter((l: string) => l.trim());
  const getLine = (prefix: string) => {
    const l = lines.find((x: string) => x.startsWith(prefix));
    return l ? l.replace(new RegExp("^" + prefix + "[：:]\\s*"), "") : "";
  };

  let formula = getLine("公式") || getLine("定理") || getLine("结论");
  const theorem = getLine("定理");
  const conclusion = getLine("结论");
  const explain = getLine("说明");
  let mistake = getLine("易错");

  // Handle case where formula and mistake are on same line (old format)
  if (!mistake && formula && formula.includes("易错")) {
    const parts = formula.split(/易错[：:]/);
    formula = parts[0].trim();
    mistake = parts[1] ? parts[1].trim() : "";
  }

  if (!formula && !theorem && !conclusion && !explain && !mistake)
    return <MathContent text={text} />;

  return (
    <div className="space-y-3">
      {/* Explanation text */}
      {explain && (
        <div className="bg-white rounded-lg">
          <MathContent text={explain} />
        </div>
      )}

      {/* Formula card */}
      {formula && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-xs text-purple-600 font-medium mb-1">{"\uD83D\uDCD0"} 公式</div>
          <div className="text-gray-900 leading-relaxed"><MathContent text={formula} /></div>
        </div>
      )}

      {/* Theorem card */}
      {theorem && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs text-blue-600 font-medium mb-1">{"\uD83D\uDCD6"} 定理</div>
          <div className="text-gray-900 text-base leading-relaxed"><MathContent text={theorem} /></div>
        </div>
      )}

      {/* Conclusion card */}
      {conclusion && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-green-600 font-medium mb-1">{"\uD83C\uDFAF"} 结论</div>
          <div className="text-gray-800 leading-relaxed"><MathContent text={conclusion} /></div>
        </div>
      )}

      {/* Mistake warning */}
      {mistake && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-xs text-red-600 font-medium mb-1">{"\u26A0\uFE0F"} 易错</div>
          <div className="text-gray-800 leading-relaxed"><MathContent text={mistake} /></div>
        </div>
      )}
    </div>
  );
}
