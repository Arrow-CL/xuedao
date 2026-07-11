"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getModule } from "@/data/chapters";
import allContent from "@/data/content";
import MathContent from "@/components/MathContent";
// import GaokaoDecomposed from "@/components/GaokaoDecomposed";
import ProgressTracker from "@/components/ProgressTracker";
import storage from "@/lib/storage";
import {
  getLearningUnits,
  getModuleLearningStatus,
  saveUnitStatus,
  getRecommendedFlow,
  canDoModuleGaokao,
  getGaokaoUnlockHint,
  generateStudyPath,
  getTodayPlan,
  completeTodayPlan,
  getStudyPathStatus,
} from "@/lib/study-path";
import type { BridgeExercise, LearningUnit, DailyPlan } from "@/types";

export default function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const mod = getModule(id);
  const [currentUnitId, setCurrentUnitId] = useState("");
  const [mode, setMode] = useState<"learn" | "practice" | "gaokao">("learn");
  const [completedUnits, setCompletedUnits] = useState<string[]>([]);
  const [challengeDone, setChallengeDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  // 学习路径状态
  const learningUnits = useMemo(() => getLearningUnits(id), [id]);
  const unitStatus = useMemo(() => getModuleLearningStatus(id), [id, completedUnits]);
  const recommended = useMemo(() => getRecommendedFlow(id), [id, completedUnits]);
  const gaokaoUnlocked = useMemo(() => canDoModuleGaokao(id), [id, completedUnits]);
  const unlockHint = useMemo(() => getGaokaoUnlockHint(id), [id, completedUnits]);
  const todayPlan = useMemo(() => getTodayPlan(), [id]);

  // 加载进度
  const loadData = useCallback(async () => {
    if (!mod) return;
    setCurrentUnitId(mod.units[0]?.id || "");
    const p = await storage.getProgress("local");
    setCompletedUnits(p.moduleProgress[id]?.completedUnits || []);
  }, [id, mod]);

  useEffect(() => { loadData(); }, [loadData]);

  // 自动推荐模式
  useEffect(() => {
    if (recommended && mod) {
      if (recommended.phase === "textbook") setMode("learn");
      else if (recommended.phase === "practice") setMode("practice");
      else if (recommended.phase === "gaokao") setMode("gaokao");
      if (recommended.unitId && !currentUnitId) {
        setCurrentUnitId(recommended.unitId);
      }
    }
  }, [recommended]);

  const currentUnit = mod?.units.find((u) => u.id === currentUnitId) || mod?.units[0];
  const contentData = allContent[id];
  const contentItem = contentData?.[currentUnitId || ""];
  const unitContent = contentItem || { title: currentUnit?.name || "学习中", content: "内容待补充" };
  const allUnitsDone = mod ? completedUnits.length === mod.units.length : false;

  // 标记课本已读
  const markTextbookDone = useCallback(() => {
    if (!currentUnitId) return;
    saveUnitStatus(id, currentUnitId, "textbookDone", true);
    if (!completedUnits.includes(currentUnitId)) {
      setCompletedUnits([...completedUnits, currentUnitId]);
    }
  }, [id, currentUnitId, completedUnits]);

  // 标记练习完成
  const markPracticeDone = useCallback((correct: number, total: number) => {
    if (!currentUnitId) return;
    const existing = unitStatus[currentUnitId] || {};
    saveUnitStatus(id, currentUnitId, "practiceDone", true);
    saveUnitStatus(id, currentUnitId, "practiceCorrect", (existing.practiceCorrect || 0) + correct);
    saveUnitStatus(id, currentUnitId, "practiceTotal", (existing.practiceTotal || 0) + total);
    setCorrectCount(prev => prev + correct);
  }, [id, currentUnitId, unitStatus]);

  const handleCompleteModule = useCallback(async () => {
    await storage.addCompletion(1, id);
    setCompleted(true);
  }, [id]);

  if (!mod) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-700">模块未找到</h1>
        <Link href="/" className="text-blue-500 hover:underline mt-4 inline-block">← 回到学习地图</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-300 hover:text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{mod.title}</h1>
            {recommended && (
              <p className="text-xs text-gray-400 mt-0.5">
                建议：{recommended.phase === "textbook" ? "📖 先读课本" : recommended.phase === "practice" ? "✏️ 做练习巩固" : "🏆 挑战高考真题"} · {recommended.reason}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ProgressTracker moduleId={id} />
          {completed ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1.5 rounded-md border border-green-100">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              已完成
            </span>
          ) : (
            <button onClick={handleCompleteModule}
              className="inline-flex items-center gap-1 text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-md hover:bg-green-600 transition-colors shadow-sm">
              完成本章
            </button>
          )}
        </div>
      </div>

      {/* 学习链路进度条：课本 → 练习 → 高考真题 */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-amber-50 border border-gray-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          <span className="font-medium">学习链路</span>
        </div>
        <div className="flex items-center gap-0">
          {/* Step 1: 课本 */}
          <button onClick={() => setMode("learn")}
            className={"flex-1 rounded-l-lg px-4 py-3 text-center transition-all border " + (
              mode === "learn" ? "bg-blue-500 text-white border-blue-500 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            )}>
            <div className="text-xs font-medium mb-1">📖 课本</div>
            <div className="text-[10px] opacity-80">
              {completedUnits.filter(u => unitStatus[u]?.textbookDone).length}/{mod.units.length} 单元
            </div>
          </button>

          {/* Arrow */}
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>

          {/* Step 2: 练习 */}
          <button onClick={() => setMode("practice")}
            className={"flex-1 px-4 py-3 text-center transition-all border " + (
              mode === "practice" ? "bg-purple-500 text-white border-purple-500 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
            )}>
            <div className="text-xs font-medium mb-1">✏️ 练习</div>
            <div className="text-[10px] opacity-80">
              {Object.values(unitStatus).filter(u => u.practiceDone).length} 已完成
            </div>
          </button>

          {/* Arrow */}
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>

          {/* Step 3: 高考真题 */}
          <button onClick={() => gaokaoUnlocked && setMode("gaokao")}
            className={"flex-1 rounded-r-lg px-4 py-3 text-center transition-all border " + (
              mode === "gaokao" ? "bg-amber-500 text-white border-amber-500 shadow-sm"
              : gaokaoUnlocked ? "bg-white text-gray-600 border-gray-200 hover:border-amber-300 cursor-pointer"
              : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
            )}>
            <div className="text-xs font-medium mb-1">🏆 高考真题</div>
            <div className="text-[10px] opacity-80">
              {gaokaoUnlocked ? "已解锁" : unlockHint.slice(0, 12) + "..."}
            </div>
          </button>
        </div>

        {/* 解锁提示 */}
        {!gaokaoUnlocked && mode !== "gaokao" && (
          <div className="mt-2.5 text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            {unlockHint}
          </div>
        )}
      </div>

      {/* Unit tabs（课本和练习模式下显示） */}
      {mode !== "gaokao" && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
          {mod.units.map((unit) => {
            const s = unitStatus[unit.id] || {};
            const isActive = unit.id === currentUnitId;
            const isDone = s.textbookDone && s.practiceDone;
            return (
              <button key={unit.id} onClick={() => setCurrentUnitId(unit.id)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-blue-500 text-white shadow-sm"
                    : isDone
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300"
                }`}>
                {isDone ? (
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {unit.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {unit.name}
                    {mode === "learn" && s.textbookDone && (
                      <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded">已读</span>
                    )}
                    {mode === "practice" && s.practiceDone && (
                      <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded">已练</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ===== 模式内容 ===== */}

      {/* 课本模式 */}
      {mode === "learn" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-800">{unitContent.title}</h2>
              {!unitStatus[currentUnitId]?.textbookDone && (
                <button onClick={markTextbookDone}
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  标记已读，去做练习
                </button>
              )}
              {unitStatus[currentUnitId]?.textbookDone && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  已读完
                </span>
              )}
            </div>
            <div className="text-gray-700 leading-relaxed">
              <MathContent text={unitContent.content} />
            </div>
          </div>

          {/* 读完后引导去做练习 */}
          {unitStatus[currentUnitId]?.textbookDone && !unitStatus[currentUnitId]?.practiceDone && (
            <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800">课本已读完，来做练习巩固一下吧</p>
                <p className="text-xs text-purple-500 mt-0.5">3道练习题，从基础到高考难度递进</p>
              </div>
              <button onClick={() => setMode("practice")}
                className="flex-shrink-0 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors shadow-sm">
                开始练习 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* 练习模式 */}
      {mode === "practice" && (
        <div className="space-y-5">
          {(() => {
            const unit = learningUnits.find(u => u.unitId === currentUnitId);
            const exercises = unit?.bridgeExercises || [];
            const isPracticeDone = unitStatus[currentUnitId]?.practiceDone;

            if (isPracticeDone) {
              return (
                <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="text-base font-semibold text-green-800 mb-1">本单元练习已完成</h3>
                  <p className="text-sm text-green-600">
                    正确率：{unitStatus[currentUnitId]?.practiceTotal > 0
                      ? Math.round((unitStatus[currentUnitId]?.practiceCorrect / unitStatus[currentUnitId]?.practiceTotal) * 100) + "%"
                      : "-"}
                  </p>
                  <div className="mt-4 flex justify-center gap-3">
                    <button onClick={() => setMode("learn")}
                      className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg text-sm hover:border-gray-300">
                      复习课本
                    </button>
                    {gaokaoUnlocked && (
                      <button onClick={() => setMode("gaokao")}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 shadow-sm">
                        挑战高考真题 →
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            if (exercises.length === 0 || exercises[0].prompt.includes("待生成")) {
              return (
                <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <h3 className="font-medium text-purple-800">练习题准备中</h3>
                  </div>
                  <p className="text-sm text-purple-600 mb-4">
                    本章的过渡练习正在准备中。你可以先做高考真题练习来检验学习效果，
                    或者先用课本模式复习知识点。
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setMode("learn")}
                      className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg text-sm hover:border-gray-300">
                      回到课本
                    </button>
                    {gaokaoUnlocked && (
                      <button onClick={() => setMode("gaokao")}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 shadow-sm">
                        直接做高考真题
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // 有练习题时展示（后续完善）
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {unit?.unitName || currentUnitId} - 过渡练习
                </h3>
                <p className="text-xs text-gray-400">
                  共 {exercises.length} 道练习题（练习组件开发中，暂时请用高考真题练习）
                </p>
                <button onClick={() => setMode("gaokao")}
                  className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 shadow-sm">
                  先做高考真题 →
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* 高考真题模式 */}
      {mode === "gaokao" && (
        <div className="space-y-5">
          {gaokaoUnlocked ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 bg-amber-500 rounded-full" />
                <h2 className="text-sm font-semibold text-gray-700">高考真题分步练习</h2>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="p-8 text-center text-gray-500">
                高考真题功能正在准备中，先完成基础练习吧~
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-2">高考真题练习未解锁</h3>
              <p className="text-sm text-gray-400 mb-4">{unlockHint}</p>
              <button onClick={() => setMode("learn")}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 shadow-sm">
                回到课本开始学习
              </button>
            </div>
          )}
        </div>
      )}

      {/* 今日学习计划卡片 */}
      {todayPlan && (
        <div className="mt-6 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-sky-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-xs font-medium text-blue-600">今日学习计划</span>
            <span className="text-[10px] text-blue-300">第{todayPlan.dayNumber}天</span>
          </div>
          {todayPlan.modules.map((mp, i) => (
            <div key={i} className="text-xs text-gray-600">
              <span className="text-blue-500 font-medium">{mp.moduleName}</span>
              {" · "}
              <span>{mp.phase === "textbook" ? "📖 读课本" : mp.phase === "practice" ? "✏️ 做练习" : "🏆 高考真题"}</span>
              {mp.units.length > 0 && <span className="text-gray-400"> · {mp.units.length}个单元</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
