"use client";
import { useState } from "react";
import MasteryBadge from "./MasteryBadge";
import RuleCard from "./RuleCard";

interface SC { formulas: any[]; properties: any[]; examples: any[]; }
interface Props { title: string; level: number; content: SC; round2?: SC; round3?: SC; onLevelUp: () => void; }

export default function SkillPanel({ title, level, content, round2, round3, onLevelUp }: Props) {
  var [round, setRound] = useState(1);
  var rounds = [
    { n: 1, label: "\u4e00\u8f6e\u57fa\u7840", unlocked: true, data: content },
    { n: 2, label: "\u4e8c\u8f6e\u5f3a\u5316", unlocked: level >= 3, data: round2 },
    { n: 3, label: "\u4e09\u8f6e\u51b2\u523a", unlocked: level >= 4, data: round3 },
  ];
  var cur = rounds[round - 1];
  var data = cur && cur.data;

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{background:"#0a0a0a"}}>
      {!title ? (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">\u70b9\u51fb\u5de6\u4fa7\u8003\u70b9\u67e5\u770b\u8be6\u60c5</div>
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
                  {r.unlocked ? "" : "\ud83d\udd12 "}{r.label}
                </button>
              );
            })}
          </div>
          {data && data.formulas && data.formulas.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-100 mb-3">\u2211 \u516c\u5f0f</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.formulas.map(function(f: any, i: number) { return <RuleCard key={f.id} type="formula" content={f.latex} desc={f.desc} idx={i + 1} />; })}
              </div>
            </div>
          )}
          {data && data.properties && data.properties.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-100 mb-3">\u2712 \u6027\u8d28</h3>
              <div className="space-y-2">
                {data.properties.map(function(p: any, i: number) { return <RuleCard key={p.id} type="property" content={p.content} desc={p.title} idx={i + 1} />; })}
              </div>
            </div>
          )}
          {data && data.examples && data.examples.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-100 mb-3">\u270f \u4f8b\u9898</h3>
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
                      <button className="mt-3 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/30">\u5f00\u59cb\u7ec3\u4e60</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(!data || !data.formulas) && (
            <div className="text-center py-12 text-gray-500 text-sm">
              {!cur.unlocked ? "\u9700\u8981 Lv." + (round === 2 ? 3 : 4) + " \u89e3\u9501" : "\u6682\u65e0\u5185\u5bb9"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}