"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MasteryBadge from "./MasteryBadge";
import RuleCard from "./RuleCard";

interface SC { formulas: any[]; properties: any[]; examples: any[]; }
interface Props { 
  title: string; 
  level: number; 
  content: SC; 
  round2?: SC; 
  round3?: SC; 
  chapterId?: string;
  onLevelUp: () => void; 
}

export default function SkillPanel({ title, level, content, round2, round3, chapterId, onLevelUp }: Props) {
  const router = useRouter();
  const [round, setRound] = useState(1);
  const rounds = [
    { n: 1, label: "一轮基础", unlocked: true, data: content },
    { n: 2, label: "二轮强化", unlocked: level >= 3, data: round2 },
    { n: 3, label: "三轮冲刺", unlocked: level >= 4, data: round3 },
  ];
  const cur = rounds[round - 1];
  const data = cur && cur.data;

  const handleStartPractice = () => {
    if (chapterId) {
      router.push(`/solve?chapter=${chapterId}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{background:"#0a0a0a"}}>
      {!title ? (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">点击左侧考点查看详情</div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">{title}</h2>
            <MasteryBadge level={level} />
          </div>
          <div className="flex gap-2 mb-6">
            {rounds.map(function(r) {
              return (
                <button key={r.n} onClick={function() { if (r.unlocked) setRound(r.n); }}
                  className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (round === r.n ? "bg-amber-500/20 text-amber-400 border border-amber-500/50" : r.unlocked ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed")}>
                  {r.unlocked ? "" : "🔒 "}{r.label}
                </button>
              );
            })}
          </div>
          {data && data.formulas && data.formulas.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-100 mb-3">∑ 公式</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.formulas.map(function(f: any, i: number) { return <RuleCard key={f.id} type="formula" content={f.latex} desc={f.desc} idx={i + 1} />; })}
              </div>
            </div>
          )}
          {data && data.properties && data.properties.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-100 mb-3">✎ 性质</h3>
              <div className="space-y-2">
                {data.properties.map(function(p: any, i: number) { return <RuleCard key={p.id} type="property" content={p.content} desc={p.title} idx={i + 1} />; })}
              </div>
            </div>
          )}
          {data && data.examples && data.examples.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-100 mb-3">✏ 例题</h3>
              <div className="space-y-3">
                {data.examples.map(function(ex: any, i: number) {
                  return (
                    <div key={ex.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                      <div className="text-xs text-amber-500/60 mb-2">#{i + 1}</div>
                      <div className="text-sm text-gray-300 mb-2">{ex.problem}</div>
                      <div className="text-sm text-gray-400 mb-2">{ex.solution}</div>
                      <div className="flex flex-wrap gap-1">
                        {ex.steps.map(function(s: string, si: number) { return <span key={si} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{si + 1}. {s}</span>; })}
                      </div>
                      <button 
                        onClick={handleStartPractice}
                        className="mt-3 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/30"
                      >
                        开始练习
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(!data || !data.formulas) && (
            <div className="text-center py-12 text-gray-500 text-sm">
              {!cur.unlocked ? "需要 Lv." + (round === 2 ? 3 : 4) + " 解锁" : "暂无内容"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}