"use client";
import { useState, useEffect } from "react";
import KnowledgeMap from "@/components/KnowledgeMap";
import SkillPanel from "@/components/SkillPanel";
import { upgradeSkill } from "@/lib/skill-mastery";
// @ts-ignore
import { skillContents, mapChapters } from "@/data/skills/mock-data";

export default function MapPage() {
  var [active, setActive] = useState("");
  var [levels, setLevels] = useState<Record<string,number>>({});
  var [key, setKey] = useState(0);

  useEffect(function() { loadLevels(); }, []);
  function loadLevels() {
    try {
      var r = localStorage.getItem("study-math:skill-levels");
      if (r) setLevels(JSON.parse(r));
    } catch {}
  }

  var skill = active ? skillContents[active] : null;
  var level = skill ? (levels[active] || 0) : 0;

  function select(id: string) {
    setActive(id);
    if (!levels[id] || levels[id] < 1) {
      upgradeSkill(id);
      loadLevels();
    }
  }

  function handleLevelUp() {
    if (!active) return;
    upgradeSkill(active);
    loadLevels();
    setKey(key + 1);
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-100">
      <div className="w-[380px] shrink-0 border-r border-gray-800 flex flex-col">
        <KnowledgeMap chapters={mapChapters} levels={levels} active={active} onSelect={select} />
      </div>
      <SkillPanel key={key} title={skill ? skill.title : ""} level={level}
        content={skill ? skill.round1 : { formulas: [], properties: [], examples: [] }}
        round2={skill ? skill.round2 : undefined} round3={skill ? skill.round3 : undefined}
        onLevelUp={handleLevelUp}
      />
    </div>
  );
}