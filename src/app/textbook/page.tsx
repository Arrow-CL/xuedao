"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chapters } from "@/data/chapters";
import allContent from "@/data/content";
import { knowledgeExercises, KnowledgeExercise } from "@/data/knowledge-exercises";
import MathContent from "@/components/MathContent";
import storage from "@/lib/storage";
import {
  ChevronDown, ChevronRight, BookOpen, CheckCircle,
  Circle, ArrowLeft, ArrowRight, Check, ChevronLeft,
  BookText, GraduationCap, Pencil, Send, HelpCircle,
  Lightbulb
} from "lucide-react";

const ROUND_GROUPS = [
  { title: "函数", icon: "\ud83d\udcd0", ids: ["sets-logic", "quadratic-ineq", "func-concept", "exp-log", "trigonometric"] },
  { title: "几何", icon: "\ud83d\udccf", ids: ["vectors-app", "solid-geometry", "space-vectors", "lines-circles", "conic-sections"] },
  { title: "代数", icon: "\ud83d\udd22", ids: ["sequences", "derivatives", "counting", "complex"] },
  { title: "概率统计", icon: "\ud83d\udcca", ids: ["statistics", "probability", "random-vars", "data-analysis"] },
];

type SplitMode = "textbook" | "practice";
type ChatMsg = { role: "user" | "assistant"; content: string };

export default function TextbookPage() {
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [completedUnits, setCompletedUnits] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "函数": true, "几何": true, "代数": true, "概率统计": true,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Split view state
  const [splitMode, setSplitMode] = useState<SplitMode>("textbook");

  // Practice state
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const loadProgress = useCallback(async () => {
    try {
      const p = await storage.getProgress("local");
      const ids: string[] = [];
      Object.entries(p.moduleProgress).forEach(([modId, mp]) => {
        mp.completedUnits.forEach((uId) => ids.push(`${modId}:${uId}`));
      });
      setCompletedUnits(ids);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  // Default: first module > first unit
  useEffect(() => {
    if (!selectedModule && chapters.length > 0) {
      const firstId = chapters[0].id;
      setSelectedModule(firstId);
      setSelectedUnit(chapters[0].units[0]?.id || "");
    }
  }, [selectedModule]);

  const currentModule = useMemo(() => chapters.find((m) => m.id === selectedModule), [selectedModule]);
  const currentUnit = useMemo(() => currentModule?.units.find((u) => u.id === selectedUnit), [currentModule, selectedUnit]);
  const unitContent = useMemo(() => {
    if (!selectedModule || !selectedUnit) return null;
    return allContent[selectedModule]?.[selectedUnit] as (Record<string, any> | null);
  }, [selectedModule, selectedUnit]);

  const currentExercises = useMemo(() => {
    if (!selectedUnit) return [];
    // 从题库中抽取最多3道中等以下难度题目作为单元练习
    const all = (knowledgeExercises[selectedUnit] || []).filter((e) => e.difficulty <= 2);
    // 稳定排序：按 id 散列取前3道
    return all.slice(0, 3);
  }, [selectedUnit]);

  const currentQ = currentExercises[qIdx] || null;

  // Init practice chat when unit, question or mode changes
  useEffect(() => {
    if (currentQ && splitMode !== "textbook") {
      setChat([{
        role: "assistant",
        content: `第 ${qIdx + 1} 题：\n\n${currentQ.prompt}`
      }]);
      setDone(false);
      setInput("");
    }
  }, [qIdx, selectedUnit, splitMode]);

  const allUnits = useMemo(() => {
    const list: { moduleId: string; unitId: string; moduleTitle: string; unitTitle: string }[] = [];
    chapters.forEach((mod) => {
      mod.units.forEach((u) => {
        const content = allContent[mod.id]?.[u.id];
        list.push({ moduleId: mod.id, unitId: u.id, moduleTitle: mod.title, unitTitle: content?.title || u.name });
      });
    });
    return list;
  }, []);

  const currentIdx = useMemo(() => {
    return allUnits.findIndex((u) => u.moduleId === selectedModule && u.unitId === selectedUnit);
  }, [allUnits, selectedModule, selectedUnit]);

  const isUnitComplete = (modId: string, unitId: string) => completedUnits.includes(`${modId}:${unitId}`);

  const goToUnit = useCallback((modId: string, unitId: string) => {
    setSelectedModule(modId);
    setSelectedUnit(unitId);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    chatRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goToPrev = useCallback(() => {
    if (currentIdx > 0) {
      const prev = allUnits[currentIdx - 1];
      goToUnit(prev.moduleId, prev.unitId);
    }
  }, [currentIdx, allUnits, goToUnit]);

  const goToNext = useCallback(() => {
    if (currentIdx < allUnits.length - 1) {
      const next = allUnits[currentIdx + 1];
      goToUnit(next.moduleId, next.unitId);
    }
  }, [currentIdx, allUnits, goToUnit]);

  const markComplete = useCallback(async () => {
    if (!selectedModule || !selectedUnit) return;
    const key = `${selectedModule}:${selectedUnit}`;
    if (completedUnits.includes(key)) return;
    try {
      const p = await storage.getProgress("local");
      if (!p.moduleProgress[selectedModule]) {
        p.moduleProgress[selectedModule] = { completedUnits: [], unitAttempts: 0, lastUnitId: "", lastStudiedAt: 0 };
      }
      const mp = p.moduleProgress[selectedModule];
      if (!mp.completedUnits.includes(selectedUnit)) {
        mp.completedUnits.push(selectedUnit);
      }
      mp.lastUnitId = selectedUnit;
      mp.lastStudiedAt = Date.now();
      mp.unitAttempts += 1;
      await storage.saveProgress("local", p);
      setCompletedUnits((prev) => [...prev, key]);
    } catch { /* ignore */ }
  }, [selectedModule, selectedUnit, completedUnits]);

  const moduleProgress = useCallback((modId: string) => {
    const mod = chapters.find((m) => m.id === modId);
    if (!mod) return { done: 0, total: 0, percent: 0 };
    const done = mod.units.filter((u) => isUnitComplete(modId, u.id)).length;
    return { done, total: mod.units.length, percent: Math.round((done / mod.units.length) * 100) };
  }, [completedUnits]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const submitPractice = useCallback(async (userText?: string) => {
    const text = (userText || input).trim();
    if (!text || processing || !currentQ) return;

    const updated: ChatMsg[] = [...chat, { role: "user", content: text }];
    setChat(updated);
    setInput("");
    setProcessing(true);

    try {
      // Local quick check
      const ans = currentQ.answer.toString();
      const cleanText = text.replace(/\s+/g, "").replace(/[。.，,！!？?]/g, "");
      const cleanAns = ans.replace(/\s+/g, "");

      if (cleanText.includes(cleanAns)) {
        const msg = `对了！\n\n${currentQ.gaokaoConnection ? `高考小提示：${currentQ.gaokaoConnection}` : ""}`;
        setChat([...updated, { role: "assistant", content: msg }]);
        setDone(true);
        setProcessing(false);
        return;
      }

      if (currentQ.type === "choice" && currentQ.options) {
        const correctOpt = currentQ.answer.toString();
        if (text.includes(correctOpt)) {
          setChat([...updated, {
            role: "assistant",
            content: `对了！\n\n${currentQ.gaokaoConnection ? `高考小提示：${currentQ.gaokaoConnection}` : ""}`
          }]);
          setDone(true);
          setProcessing(false);
          return;
        }
      }

      // AI tutor fallback
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `你是高中数学AI辅导老师，名字叫"学导"。你的原则是"不直接给答案，用苏格拉底式提问引导学生自己想出来"。

这道题是：${currentQ.prompt}
正确答案是：${currentQ.answer}

严格按以下规则回复：
1. 如果学生说"我不会"、"没思路"、"怎么做"：
   - 不要直接讲题，先问："这道题考的是哪个知识点呀？想想我们学过的公式~"
   - 引导学生自己说出考点，再一步步引导思路

2. 如果学生写了一半过程卡住了：
   - 先判断学生的思路对不对，能不能得出正确答案
   - 如果思路对，只是某一步算错了：精准定位到错的那一步，问"你看看这一步，上一步是怎么得到这个结果的？再算一遍试试？"
   - 如果思路偏了：先肯定学生的尝试，再引导回正确方向

3. 如果学生能自己反应过来：鼓励他继续写下去
4. 如果学生还是不会：从他卡住的那一步开始，一点点讲，每讲一步问一句"理解了吗？"，直到算出结果
5. 如果学生做对了：回复"【正确】"，然后简单鼓励，再加一句高考相关的小提示

语气要像耐心的学长学姐，不要太官方，不要说废话。会就是会，不会就是不会，不会就从不会的地方一步步教，绝不跳步。`
            },
            ...updated
          ],
          moduleId: selectedUnit,
          unitName: "基础练习"
        }),
      });

      const data = await res.json();
      const reply = data.reply || "";
      setChat([...updated, { role: "assistant", content: reply }]);

      if (reply.includes("【正确】")) {
        setDone(true);
      }
    } catch {
      setChat([...updated, { role: "assistant", content: "（网络有点问题，你再试试？）" }]);
    }
    setProcessing(false);
  }, [input, processing, chat, currentQ, selectedUnit]);

  const nextQ = () => {
    if (qIdx < currentExercises.length - 1) {
      setQIdx(qIdx + 1);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* === TOC Sidebar === */}
      <aside className={`shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[280px]"
      }`}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
              <BookText size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 leading-tight">课本</h2>
              <p className="text-[10px] text-gray-400 leading-tight">高中数学 · 18章</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {ROUND_GROUPS.map((group) => {
            const groupModules = group.ids
              .map((id) => chapters.find((m) => m.id === id))
              .filter(Boolean);
            return (
              <div key={group.title} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs">{group.icon}</span>
                  <span className="flex-1 text-left">{group.title}</span>
                  {expandedGroups[group.title] ? (
                    <ChevronDown size={14} className="text-gray-300" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-300" />
                  )}
                </button>
                {expandedGroups[group.title] && (
                  <div className="ml-1 mt-0.5 space-y-0.5">
                    {groupModules.map((mod) => {
                      if (!mod) return null;
                      const mp = moduleProgress(mod.id);
                      const isActive = selectedModule === mod.id;
                      return (
                        <div key={mod.id}>
                          <button
                            onClick={() => {
                              setSelectedModule(mod.id);
                              setSelectedUnit(mod.units[0]?.id || "");
                              contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors ${
                              isActive
                                ? "bg-indigo-50 text-indigo-700 font-medium"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className={`shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold ${
                              mp.percent === 100
                                ? "bg-green-100 text-green-600"
                                : mp.percent > 0
                                  ? "bg-indigo-100 text-indigo-600"
                                  : "bg-gray-100 text-gray-400"
                            }`}>
                              {mp.percent === 100 ? "\u2713" : mp.done}
                            </span>
                            <span className="flex-1 text-left truncate">{mod.title}</span>
                            <span className="text-[10px] text-gray-400">{mp.done}/{mp.total}</span>
                          </button>
                          {isActive && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-indigo-100 pl-2">
                              {mod.units.map((u) => {
                                const content = allContent[mod.id]?.[u.id];
                                const title = content?.title || u.name;
                                const isComplete = isUnitComplete(mod.id, u.id);
                                return (
                                  <button
                                    key={u.id}
                                    onClick={() => goToUnit(mod.id, u.id)}
                                    className={`flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs transition-colors ${
                                      selectedUnit === u.id
                                        ? "bg-indigo-100 text-indigo-700 font-medium"
                                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                                  >
                                    {isComplete ? (
                                      <CheckCircle size={12} className="text-green-500 shrink-0" />
                                    ) : (
                                      <Circle size={12} className="text-gray-300 shrink-0" />
                                    )}
                                    <span className="truncate">{title}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 px-4 py-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-gray-400 font-medium">总进度</span>
            <span className="text-[11px] text-gray-500 font-medium">
              {completedUnits.length}/{allUnits.length} 单元
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${allUnits.length > 0 ? (completedUnits.length / allUnits.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </aside>

      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="shrink-0 w-6 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors self-stretch"
      >
        {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* === Split View Container === */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top toolbar with split mode toggle */}
        {currentModule && currentUnit && unitContent && (
          <div className="shrink-0 h-11 bg-white border-b border-gray-100 flex items-center px-4 gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <button onClick={() => { setSelectedModule(""); setSelectedUnit(""); }} className="hover:text-indigo-500 transition-colors">课本</button>
              <ChevronRight size={12} />
              <span className="text-gray-600">{currentModule.title}</span>
              <ChevronRight size={12} />
              <span className="text-indigo-600 font-medium">{unitContent.title}</span>
              {isUnitComplete(selectedModule, selectedUnit) && (
                <span className="ml-1 inline-flex items-center gap-1 text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  <Check size={10} /> 已学完
                </span>
              )}
            </div>
            <div className="flex-1" />
            {/* Split mode toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setSplitMode("textbook")}
                className={"px-2.5 py-1 text-[11px] rounded-md transition-all flex items-center gap-1 " + (
                  splitMode === "textbook" ? "bg-white text-gray-800 shadow-sm font-medium" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <BookOpen size={12} />
                课本
              </button>
              <button
                onClick={() => setSplitMode("practice")}
                className={"px-2.5 py-1 text-[11px] rounded-md transition-all flex items-center gap-1 " + (
                  splitMode === "practice" ? "bg-white text-gray-800 shadow-sm font-medium" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Pencil size={12} />
                练习
              </button>
            </div>
          </div>
        )}

        {/* === Split Panels === */}
        {!currentModule || !currentUnit || !unitContent ? (
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center mb-6 border border-indigo-100">
                <BookOpen size={36} className="text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">高中数学课本</h1>
              <p className="text-sm text-gray-400 max-w-md leading-relaxed mb-8">
                基于知识图谱的高中数学完整自学体系，涵盖 18 个章节、所有核心知识点。
                从左侧目录选择一个章节开始学习。
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                {ROUND_GROUPS.map((g) => (
                  <div key={g.title} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-left">
                    <span className="text-lg">{g.icon}</span>
                    <h3 className="text-sm font-semibold text-gray-800 mt-1">{g.title}</h3>
                    <p className="text-[11px] text-gray-400">{g.ids.length} 个章节</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* === LEFT PANEL: Textbook === */}
            {(splitMode === "textbook") && (
              <div ref={contentRef} className="overflow-y-auto bg-white w-full">
                <div className="max-w-3xl mx-auto px-6 py-6">
                  <div className="mb-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-indigo-500 font-medium mb-2">
                      <GraduationCap size={14} />
                      <span>第 {chapters.findIndex((m) => m.id === selectedModule) + 1} 章</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 leading-snug">{unitContent.title}</h1>
                    <p className="text-sm text-gray-400 mt-1">{currentModule.title}</p>
                  </div>

                  <div className="text-base leading-relaxed text-gray-800">
                    <MathContent text={unitContent.content} />
                  </div>

                  {/* Progress + Nav at bottom */}
                  <div className="mt-8 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 font-medium">本章进度</span>
                      <span className="text-xs text-gray-500">
                        {moduleProgress(selectedModule).done}/{moduleProgress(selectedModule).total} 单元
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-400 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${moduleProgress(selectedModule).percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 pb-8 border-t border-gray-100">
                    <button
                      onClick={goToPrev}
                      disabled={currentIdx <= 0}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    >
                      <ArrowLeft size={15} />
                      <span>上一节</span>
                    </button>
                    <button
                      onClick={markComplete}
                      disabled={isUnitComplete(selectedModule, selectedUnit)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isUnitComplete(selectedModule, selectedUnit)
                          ? "bg-green-50 text-green-600 border border-green-200 cursor-default"
                          : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm hover:shadow-md active:scale-[0.97]"
                      }`}
                    >
                      {isUnitComplete(selectedModule, selectedUnit) ? (
                        <><Check size={15} /> 已完成</>
                      ) : (
                        <><CheckCircle size={15} /> 标记完成</>
                      )}
                    </button>
                    <button
                      onClick={goToNext}
                      disabled={currentIdx >= allUnits.length - 1}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    >
                      <span>下一节</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* === RIGHT PANEL: Practice === */}
            {(splitMode === "practice") && (
              <div ref={chatRef} className="flex flex-col bg-gray-50 w-full">
                {currentQ ? (
                  <>
                    {/* Practice header */}
                    <div className="shrink-0 px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">第 {qIdx + 1} / {currentExercises.length} 题</span>
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                          基础练习
                        </span>
                        {currentQ.difficulty === 1 && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded text-[10px]">基础</span>}
                        {currentQ.difficulty === 2 && <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded text-[10px]">中等</span>}
                        {currentQ.difficulty === 3 && <span className="px-1.5 py-0.5 bg-red-50 text-red-500 rounded text-[10px]">较难</span>}
                      </div>
                      {/* Progress dots */}
                      <div className="flex items-center gap-1">
                        {currentExercises.map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            i < qIdx ? "bg-green-400" : i === qIdx ? "bg-indigo-500" : "bg-gray-200"
                          }`} />
                        ))}
                      </div>
                    </div>

                    {/* Chat messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {chat.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                            m.role === "user" ? "bg-indigo-500 text-white" : "bg-white text-gray-800 border border-gray-100"
                          }`}>
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              <MathContent text={m.content} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {processing && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-gray-100 rounded-2xl px-3.5 py-2.5 text-gray-400 text-sm">
                            思考中...
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Practice input */}
                    <div className="shrink-0 p-3 bg-white border-t border-gray-100">
                      {done ? (
                        <button
                          onClick={nextQ}
                          className="w-full py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition"
                        >
                          {qIdx < currentExercises.length - 1 ? "下一题 →" : "🎉 完成练习！"}
                        </button>
                      ) : (
                        <>
                          <div className="flex gap-2 mb-2">
                            <button
                              onClick={() => submitPractice("我不会")}
                              disabled={processing}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 transition disabled:opacity-50"
                            >
                              <HelpCircle size={14} />
                              我不会
                            </button>
                            <button
                              onClick={() => submitPractice("给我点提示")}
                              disabled={processing}
                              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-xs hover:bg-yellow-100 transition disabled:opacity-50"
                            >
                              <Lightbulb size={14} />
                              要提示
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              ref={inputRef}
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && submitPractice()}
                              placeholder="写答案或过程，按回车提交..."
                              className="flex-1 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              disabled={processing}
                            />
                            <button
                              onClick={() => submitPractice()}
                              disabled={processing || !input.trim()}
                              className="p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition"
                            >
                              <Send size={18} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center px-6">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <Pencil size={24} className="text-gray-300" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-600 mb-1">暂无练习题</h3>
                      <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                        这个知识点的练习题正在准备中，你可以先看课本内容，或切换到高考真题板块练习。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
