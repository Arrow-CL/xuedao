"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MathContent from "@/components/MathContent";
import GeometryCanvas, { type GeometryAnnotation } from "@/components/GeometryCanvas";
import { chapters } from "@/data/chapters";
import { knowledgeExercises } from "@/data/knowledge-exercises";
import { getAllGaokaoQuestions } from "@/data/gaokao-questions";
import {
  getProgress,
  getChapterProgress,
  recordQuestionComplete,
  saveProgress,
} from "@/lib/storage-v2";
import {
  recommendNext,
  getChapterCoverage,
  checkChapterCleared,
} from "@/lib/recommendation";
import type { Question, KnowledgePoint, ChapterQuestions, ChapterProgress } from "@/lib/types";
import {
  ArrowLeft,
  Send,
  HelpCircle,
  Lightbulb,
  BookOpen,
  Map,
  Trophy,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

type PageState =
  | "no-chapter"       // 没有 chapterId
  | "no-questions"     // 章节暂无题目
  | "solving"          // 正在做题
  | "chapter-cleared"  // 章节通关
  | "loading";         // 初始化中

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get chapter title from chapters.ts */
function chapterTitle(id: string): string {
  const ch = chapters.find((c) => c.id === id);
  return ch?.title ?? id;
}

/** Get chapter order */
function chapterOrder(id: string): number {
  const ch = chapters.find((c) => c.id === id);
  return ch?.order ?? 0;
}

/**
 * Build KnowledgePoint[] from chapters data for the recommendation engine.
 * Each unit in a chapter becomes a knowledge point.
 */
function buildKnowledgePoints(chapterId: string): KnowledgePoint[] {
  const ch = chapters.find((c) => c.id === chapterId);
  if (!ch) return [];
  return ch.units.map((unit, idx) => ({
    id: `${chapterId}-${unit.id}`,
    chapterId,
    unitId: unit.id,
    name: unit.name,
    order: idx,
  }));
}

/**
 * Build ChapterQuestions from both knowledge-exercises and gaokao questions.
 * Gaokao questions take priority (they appear first in the list).
 */
function buildChapterQuestions(chapterId: string): ChapterQuestions {
  const ch = chapters.find((c) => c.id === chapterId);
  if (!ch) return {};

  const questions: Question[] = [];

  // 1. Add gaokao questions for this chapter
  const allGaokao = getAllGaokaoQuestions();
  const gaokaoQs = allGaokao[chapterId] ?? [];
  for (const gq of gaokaoQs) {
    questions.push(gq);
  }

  // 2. Add knowledge exercises for this chapter
  for (const unit of ch.units) {
    const unitExercises = knowledgeExercises[unit.id];
    if (!unitExercises || unitExercises.length === 0) continue;

    for (const ex of unitExercises) {
      questions.push({
        id: `${chapterId}-${ex.unitId}-${ex.id}`,
        chapterId,
        source: "exercise",
        prompt: ex.prompt,
        type: ex.type === "choice" ? "choice" : ex.type === "fill" ? "fill" : "solve",
        difficulty: ex.difficulty === 1 ? 1 : ex.difficulty === 2 ? 2 : 3,
        answer: String(ex.answer),
        options: ex.options,
        knowledgePointIds: [`${chapterId}-${unit.id}`],
      });
    }
  }

  return { [chapterId]: questions };
}

/** Reply sanitization: strip leading "- " before LaTeX formulas */
function sanitizeReply(reply: string): string {
  return reply.replace(/^-\s+(?=[\$\\])/gm, "");
}

/**
 * Parse [GEO:...] annotations from AI reply.
 * Extracts all [GEO:ACTION params] lines from the end of the reply,
 * returns the clean reply (without annotations) and parsed annotations.
 */
function parseGeoAnnotations(reply: string): {
  cleanReply: string;
  annotations: GeometryAnnotation[];
} {
  const lines = reply.split("\n");
  const annotationLines: string[] = [];
  let cutIndex = lines.length;

  // From the end, find consecutive [GEO:...] lines
  // Skip trailing empty lines first
  let i = lines.length - 1;
  while (i >= 0 && lines[i].trim() === "") {
    i--;
  }

  while (i >= 0) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^\[GEO:(\w+)\s*(.*)\]$/);
    if (match) {
      annotationLines.unshift(trimmed);
      cutIndex = i;
      i--;
    } else {
      break;
    }
  }

  // Parse annotations
  const annotations: GeometryAnnotation[] = [];
  for (const line of annotationLines) {
    const match = line.match(/^\[GEO:(\w+)\s*(.*)\]$/);
    if (!match) continue;

    const action = match[1].toLowerCase();
    const paramsStr = match[2].trim();
    const params: Record<string, string> = {};

    // Parse key=value pairs (e.g., "origin=100,100" or "label=A,50,80")
    // Special handling: first param key is the action-specific one
    if (paramsStr) {
      // For AXIS: origin=x,y
      // For POINT: label=x,y  (label is point name, x,y are coords)
      // For VECTOR: from=x1,y1 to=x2,y2 label=name
      if (action === "axis") {
        const kvMatch = paramsStr.match(/^(\w+)=(.+)$/);
        if (kvMatch) {
          params[kvMatch[1]] = kvMatch[2];
        }
      } else if (action === "point") {
        // format: label=PointName,x,y
        const kvMatch = paramsStr.match(/^(\w+)=(.+)$/);
        if (kvMatch) {
          params[kvMatch[1]] = kvMatch[2];
        }
      } else if (action === "vector") {
        // format: from=x1,y1 to=x2,y2 label=name
        const parts = paramsStr.split(/\s+/);
        for (const part of parts) {
          const kvMatch = part.match(/^(\w+)=(.+)$/);
          if (kvMatch) {
            params[kvMatch[1]] = kvMatch[2];
          }
        }
      }
      // CLEAR has no params
    }

    const typeMap: Record<string, GeometryAnnotation["type"]> = {
      axis: "axis",
      point: "point",
      vector: "vector",
      clear: "clear",
    };

    if (typeMap[action]) {
      annotations.push({ type: typeMap[action], params });
    }
  }

  // Clean reply: remove annotation lines and trailing whitespace
  const cleanReply = lines.slice(0, cutIndex).join("\n").trimEnd();

  return { cleanReply, annotations };
}

/* ------------------------------------------------------------------ */
/*  Inner solve component (needs useSearchParams inside Suspense)       */
/* ------------------------------------------------------------------ */

function SolveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const chapterId = searchParams.get("chapter") ?? "";

  // ---- state ----
  const [pageState, setPageState] = useState<PageState>("loading");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [geometryAnnotations, setGeometryAnnotations] = useState<GeometryAnnotation[]>([]);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- error tracking during solving ----
  const errorCountRef = useRef(0);
  const errorStepsRef = useRef<string[]>([]);

  // ---- derived ----
  const chapterName = chapterTitle(chapterId);

  /* ---- auto-scroll chat ---- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat, processing]);

  /* ---- focus input ---- */
  useEffect(() => {
    if (pageState === "solving" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [pageState]);

  /* ---- Initialize: get chapter data and recommend first question ---- */
  useEffect(() => {
    if (!chapterId) {
      setPageState("no-chapter");
      return;
    }

    const ch = chapters.find((c) => c.id === chapterId);
    if (!ch) {
      setPageState("no-chapter");
      return;
    }

    // Build data for recommendation engine
    const knowledgePoints = buildKnowledgePoints(chapterId);
    const chapterQuestions = buildChapterQuestions(chapterId);
    const questions = chapterQuestions[chapterId] ?? [];

    setTotalQuestions(questions.length);

    // Get current progress
    const chapterProg = getChapterProgress(chapterId);
    if (chapterProg) {
      setCompletedCount(chapterProg.completedQuestionIds.length);

      // Build a compatible ChapterProgress with all required fields
      const compatibleProgress: ChapterProgress = {
        chapterId,
        completedQuestionIds: chapterProg.completedQuestionIds,
        coveredKnowledgePointIds: chapterProg.coveredKnowledgePointIds,
        totalAttempted: chapterProg.completedQuestionIds.length,
        isCleared: chapterProg.isCleared,
      };

      // Check if already cleared
      if (compatibleProgress.isCleared) {
        setPageState("chapter-cleared");
        const coverage = getChapterCoverage(chapterId, knowledgePoints, compatibleProgress);
        setCoveragePercent(coverage.percentage);
        return;
      }

      // Check if all questions done
      const completedSet = new Set(chapterProg.completedQuestionIds);
      const remaining = questions.filter((q) => !completedSet.has(q.id));
      if (remaining.length === 0) {
        // No remaining questions but not formally cleared - mark as cleared
        setPageState("chapter-cleared");
        const coverage = getChapterCoverage(chapterId, knowledgePoints, compatibleProgress);
        setCoveragePercent(coverage.percentage);
        return;
      }

      // Recommend next question
      const result = recommendNext(chapterId, chapterQuestions, knowledgePoints, compatibleProgress);
      if (result.question) {
        setCurrentQuestion(result.question);
        setQuestionIndex(chapterProg.completedQuestionIds.length + 1);
        setChat([{ role: "assistant", content: result.question.prompt }]);
        setPageState("solving");
      } else {
        setPageState("chapter-cleared");
      }
    } else {
      setCompletedCount(0);
      // No progress yet - recommend first question
      if (questions.length === 0) {
        setPageState("no-questions");
        return;
      }

      const defaultProgress: ChapterProgress = {
        chapterId,
        completedQuestionIds: [],
        coveredKnowledgePointIds: [],
        totalAttempted: 0,
        isCleared: false,
      };

      const result = recommendNext(chapterId, chapterQuestions, knowledgePoints, defaultProgress);
      if (result.question) {
        setCurrentQuestion(result.question);
        setQuestionIndex(1);
        setChat([{ role: "assistant", content: result.question.prompt }]);
        setPageState("solving");
      } else {
        setPageState("no-questions");
      }
    }
  }, [chapterId]);

  /* ---------------------------------------------------------------- */
  /*  Send a message to the guide API                                  */
  /* ---------------------------------------------------------------- */
  const sendMessage = useCallback(
    async (userText?: string, isHelp?: boolean) => {
      const text = (userText ?? input).trim();
      if (!text || processing || !currentQuestion) return;

      const updated: ChatMsg[] = [...chat, { role: "user", content: text }];
      setChat(updated);
      setInput("");
      setProcessing(true);
      setStepCount((s) => s + 1);
      const currentStep = stepCount + 1;

      const fullQuestionText =
        currentQuestion.options && currentQuestion.options.length > 0
          ? `${currentQuestion.prompt}\n${currentQuestion.options.join("\n")}`
          : currentQuestion.prompt;

      try {
        const res = await fetch("/api/guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: currentQuestion.id,
            questionText: fullQuestionText,
            answer: currentQuestion.answer ?? "",
            studentInput: text,
            currentStepNumber: currentStep,
            chatHistory: updated,
            studentSaidHelp: !!isHelp,
            chapterId,
            imageUrl: currentQuestion.imageUrl ?? "",
          }),
        });

        const data = await res.json();
        let reply: string = data.reply ?? "（暂时无法回复，请再试一次）";
        reply = sanitizeReply(reply);

        // Parse [GEO:...] annotations from reply
        const { cleanReply, annotations } = parseGeoAnnotations(reply);
        reply = cleanReply;
        if (annotations.length > 0) {
          setGeometryAnnotations((prev) => [...prev, ...annotations]);
        }

        // Detect errors in AI reply (student got something wrong)
        const errorKeywords = ["不对", "不正确", "错了", "再想想", "有问题", "不是这样", "不太对", "错误", "不对哦", "差一点"];
        const hasError = errorKeywords.some(kw => reply.includes(kw));
        if (hasError && !isHelp) {
          errorCountRef.current += 1;
          errorStepsRef.current.push(text);
        }

        setChat((prev) => [...prev, { role: "assistant", content: reply }]);

        // Detect completion
        if (
          reply.includes("【正确】") ||
          reply.includes("【完成】") ||
          reply.includes("回答正确") ||
          reply.includes("做对了") ||
          data.solved
        ) {
          setDone(true);
          if (data.summary) {
            setSummary(data.summary);
          }

          // Record progress using storage-v2 (with error data)
          recordQuestionComplete(
            currentQuestion.id,
            chapterId,
            currentQuestion.knowledgePointIds,
            errorCountRef.current,
            errorStepsRef.current,
          );

          // Update completed count
          setCompletedCount((prev) => prev + 1);

          // Check if chapter is now cleared
          const knowledgePoints = buildKnowledgePoints(chapterId);
          const chapterQuestions = buildChapterQuestions(chapterId);
          const newProgress = getChapterProgress(chapterId);
          if (newProgress) {
            const compatibleProgress: ChapterProgress = {
              chapterId,
              completedQuestionIds: newProgress.completedQuestionIds,
              coveredKnowledgePointIds: newProgress.coveredKnowledgePointIds,
              totalAttempted: newProgress.completedQuestionIds.length,
              isCleared: newProgress.isCleared,
            };
            const isCleared = checkChapterCleared(chapterId, knowledgePoints, compatibleProgress);
            if (isCleared) {
              // Mark as cleared in storage
              newProgress.isCleared = true;
              newProgress.clearedAt = Date.now();
              const fullProgress = getProgress();
              saveProgress(fullProgress);
            }
          }
        }
      } catch {
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: "（网络有点问题，请再试一次）" },
        ]);
      }
      setProcessing(false);
    },
    [input, processing, currentQuestion, chat, stepCount, chapterId]
  );

  /* ---------------------------------------------------------------- */
  /*  Next question: use recommendation engine                         */
  /* ---------------------------------------------------------------- */
  const nextQuestion = useCallback(() => {
    const knowledgePoints = buildKnowledgePoints(chapterId);
    const chapterQuestions = buildChapterQuestions(chapterId);
    const chapterProg = getChapterProgress(chapterId);

    const compatibleProgress: ChapterProgress = {
      chapterId,
      completedQuestionIds: chapterProg?.completedQuestionIds ?? [],
      coveredKnowledgePointIds: chapterProg?.coveredKnowledgePointIds ?? [],
      totalAttempted: chapterProg?.completedQuestionIds?.length ?? 0,
      isCleared: chapterProg?.isCleared ?? false,
    };

    // Check coverage for clearing
    const coverage = getChapterCoverage(chapterId, knowledgePoints, compatibleProgress);
    setCoveragePercent(coverage.percentage);

    const isCleared = checkChapterCleared(chapterId, knowledgePoints, compatibleProgress);
    if (isCleared) {
      setPageState("chapter-cleared");
      return;
    }

    const result = recommendNext(chapterId, chapterQuestions, knowledgePoints, compatibleProgress);

    if (result.question) {
      setCurrentQuestion(result.question);
      setQuestionIndex((prev) => prev + 1);
      setDone(false);
      setStepCount(0);
      setSummary(null);
      setGeometryAnnotations([]);
      errorCountRef.current = 0;
      errorStepsRef.current = [];
      setChat([{ role: "assistant", content: result.question.prompt }]);
      setPageState("solving");
    } else {
      // No more questions
      setPageState("chapter-cleared");
    }
  }, [chapterId, questionIndex, chapterName]);

  /* ================================================================ */
  /*  RENDER                                                            */
  /* ================================================================ */

  /* ---------- No chapter selected ---------- */
  if (pageState === "no-chapter") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Map size={28} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            请从学习地图选择章节
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            选择一个章节后即可开始做题
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors"
          >
            返回学习地图
          </button>
        </div>
      </div>
    );
  }

  /* ---------- No questions available ---------- */
  if (pageState === "no-questions") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top bar */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2.5">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="返回学习地图"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {chapterName}
            </h2>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={28} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              该章节暂无题目
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              题目正在编写中，敬请期待
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors"
            >
              返回学习地图
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Chapter cleared ---------- */
  if (pageState === "chapter-cleared") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top bar */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2.5">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="返回学习地图"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {chapterName}
            </h2>
          </div>
        </div>

        {/* Cleared state */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Trophy size={36} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              章节通关
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              {chapterName}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              你已完成 {completedCount} 道题，知识点覆盖率达 {coveragePercent}%
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push("/")}
                className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2"
              >
                <Map size={16} />
                返回学习地图
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Loading ---------- */
  if (pageState === "loading" || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">正在加载题目...</p>
        </div>
      </div>
    );
  }

  /* ---------- Solve mode ---------- */
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* ---- Top bar ---- */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push("/")}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="返回学习地图"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">
                {chapterName}
              </h2>
              <p className="text-[11px] text-gray-400 truncate">
                第 {questionIndex} 题 / 已完成 {completedCount} 题
              </p>
            </div>
          </div>
          <div className="shrink-0 text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
            {completedCount} / {totalQuestions} 题
          </div>
        </div>
      </div>

      {/* ---- Main body: question + chat ---- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Question display */}
        <div className="lg:w-[45%] shrink-0 bg-white border-r border-gray-100 overflow-y-auto">
          <div className="p-4 lg:p-6">
            <div className="text-xs text-gray-400 mb-2 font-medium">
              题目
            </div>
            <div className="text-sm text-gray-800 leading-relaxed">
              <MathContent text={currentQuestion.prompt} />
            </div>
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {currentQuestion.options.map((opt, i) => (
                  <div
                    key={i}
                    className="text-sm text-gray-700 pl-2 border-l-2 border-gray-200"
                  >
                    <MathContent text={opt} />
                  </div>
                ))}
              </div>
            )}
            {currentQuestion.imageUrl && geometryAnnotations.length === 0 && (
              <div className="mt-4">
                <img
                  src={currentQuestion.imageUrl}
                  alt="题目配图"
                  className="max-w-[40%] rounded-lg border border-gray-200"
                />
              </div>
            )}
            {currentQuestion.imageUrl && geometryAnnotations.length > 0 && (
              <div className="mt-4">
                <GeometryCanvas
                  annotations={geometryAnnotations}
                  width={280}
                  height={280}
                  backgroundImageUrl={currentQuestion.imageUrl}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto space-y-3">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                      m.role === "user"
                        ? "bg-indigo-500 text-white"
                        : "bg-white text-gray-800 border border-gray-100"
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {m.role === "assistant" ? (
                        <MathContent text={m.content} />
                      ) : (
                        m.content
                      )}
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

              {/* Knowledge review (shown after correct) */}
              {done && summary && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-2">
                  <div className="text-sm font-semibold text-green-800 mb-1">
                    知识回顾
                  </div>
                  <div className="text-sm text-green-700 leading-relaxed">
                    <MathContent text={summary} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="shrink-0 bg-white border-t border-gray-100 p-3">
            <div className="max-w-2xl mx-auto">
              {done ? (
                <div className="flex gap-2">
                  <button
                    onClick={nextQuestion}
                    className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition flex items-center justify-center gap-2"
                  >
                    <BookOpen size={16} />
                    下一题
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition flex items-center justify-center gap-2"
                  >
                    <Map size={16} />
                    返回地图
                  </button>
                </div>
              ) : (
                <>
                  {/* Quick action buttons */}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => sendMessage("我不会", true)}
                      disabled={processing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 transition disabled:opacity-50 border border-red-100"
                    >
                      <HelpCircle size={14} />
                      我不会
                    </button>
                    <button
                      onClick={() => sendMessage("给我点提示", false)}
                      disabled={processing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-xs hover:bg-yellow-100 transition disabled:opacity-50 border border-yellow-100"
                    >
                      <Lightbulb size={14} />
                      要提示
                    </button>
                  </div>
                  {/* Text input */}
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="写你的思路或答案，按回车发送..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-50"
                      disabled={processing}
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={processing || !input.trim()}
                      className="p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export with Suspense boundary (Next.js requirement)          */
/* ------------------------------------------------------------------ */

export default function SolvePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">正在加载...</p>
          </div>
        </div>
      }
    >
      <SolveContent />
    </Suspense>
  );
}
