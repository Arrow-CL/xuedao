"use client";
import SkillNode from "./SkillNode";
import { useState } from "react";
interface MC { id: string; title: string; skills: { id: string; title: string; }[]; }
interface Props { chapters: MC[]; levels: Record<string,number>; active: string; onSelect: (id:string) => void; }
export default function KnowledgeMap({ chapters, levels, active, onSelect }: Props) {
  var [expanded, setExpanded] = useState<Record<string,boolean>>({});
  var vis = chapters.filter(function(c) { return c.skills.length > 0; });
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <h2 className="text-lg font-bold text-gray-100 mb-4">\ud83d\uddfa\ufe0f \u77e5\u8bc6\u5730\u56fe</h2>
      {vis.map(function(ch) {
        var ex = expanded[ch.id] !== false;
        var comp = ch.skills.filter(function(s) { return (levels[s.id] || 0) >= 3; }).length;
        return (
          <div key={ch.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 transition-colors" onClick={function() { var e: any = {}; e[ch.id] = !ex; setExpanded(Object.assign({}, expanded, e)); }}>
              <h3 className="text-sm font-semibold text-gray-100">{ch.title}</h3>
              <span className="text-xs text-gray-500">{comp}/{ch.skills.length}</span>
            </div>
            {ex && (
              <div className="px-3 pb-3 flex flex-wrap gap-2">
                {ch.skills.map(function(sk) {
                  return <SkillNode key={sk.id} id={sk.id} title={sk.title} level={levels[sk.id] || 0} active={active === sk.id} onClick={function() { onSelect(sk.id); }} />;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}