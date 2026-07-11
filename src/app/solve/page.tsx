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
import type { Question, KnowledgePoint, ChapterQuestions, ChapterProgress, BoardStep } from "@/lib/types";
import { compressImage } from "@/lib/image-utils";
import {
  ArrowLeft,
  Send,
  HelpCircle,
  Lightbulb,
  BookOpen,
  Map,
  Trophy,
  ImagePlus,
  X,
  PenLine,
  ChevronDown,
  Bot,
  User,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string; // 学生上传的图片 base64（显示用）
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

/**
 * Parse [STEP:n|content] tag from AI reply.
 * Returns the clean reply (without the tag) and the parsed step info.
 */
function parseStepTag(reply: string): {
  cleanReply: string;
  step: BoardStep | null;
} {
  const match = reply.match(/\[STEP:(\d+)\|([^\]]+)\]\s*$/m);
  if (!match) return { cleanReply: reply, step: null };

  const stepNumber = parseInt(match[1], 10);
  const content = match[2].trim();
  const cleanReply = reply.replace(match[0], "").trimEnd();

  return {
    cleanReply,
    step: {
      stepNumber,
      content,
      isCorrect: true,
      timestamp: Date.now(),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Inner solve component (needs useSearchParams inside Suspense)       */
/* ------------------------------------------------------------------ */

/** 纸屑庆祝动画组件 */
function ConfettiCelebration() {
  const [particles] = useState(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      color: ["bg-yellow-400", "bg-indigo-400", "bg-green-400", "bg-pink-400", "bg-orange-400"][i % 5],
      size: Math.random() * 6 + 4,
    }))
  );

  return (
    <div className="confetti-container">
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute top-0 ${p.color} rounded-sm animate-confetti`}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

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
  const [pendingImage, setPendingImage] = useState<string | null>(null); // 待发送的图片 base64
  const [boardSteps, setBoardSteps] = useState<BoardStep[]>([]); // 板书步骤

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  /*  Image upload handlers                                             */
  /* ---------------------------------------------------------------- */
  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("图片不能超过 10MB");
      return;
    }
    try {
      const result = await compressImage(file);
      setPendingImage(result.base64);
    } catch {
      alert("图片处理失败，请重试");
    }
  }, []);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImageFile(file);
      // 清空 input 值，允许重复选择同一文件
      e.target.value = "";
    },
    [processImageFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processImageFile(file);
          return;
        }
      }
    },
    [processImageFile]
  );

  /* ---------------------------------------------------------------- */
  /*  Send a message to the guide API                                  */
  /* ---------------------------------------------------------------- */
  const sendMessage = useCallback(
    async (userText?: string, isHelp?: boolean) => {
      const text = (userText ?? input).trim();
      // 图片模式：有 pendingImage 就允许发送（即使文字为空）
      if ((!text && !pendingImage) || processing || !currentQuestion) return;

      const updated: ChatMsg[] = [
        ...chat,
        {
          role: "user",
          content: text || "（上传了解题过程图片）",
          imageUrl: pendingImage || undefined,
        },
      ];
      setChat(updated);
      setInput("");
      const sendingImage = pendingImage;
      setPendingImage(null);
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
            studentInput: text || "（上传了解题过程图片）",
            currentStepNumber: currentStep,
            chatHistory: updated,
            studentSaidHelp: !!isHelp,
            chapterId,
            imageUrl: currentQuestion.imageUrl ?? "",
            studentImageUrl: sendingImage || undefined,
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

        // Parse [STEP:n|content] tag for board
        const { cleanReply: stepCleanReply, step: boardStep } = parseStepTag(reply);
        reply = stepCleanReply;
        if (boardStep) {
          setBoardSteps((prev) => {
            // Replace if same step number, otherwise append
            const exists = prev.findIndex(s => s.stepNumber === boardStep.stepNumber);
            if (exists >= 0) {
              const updated = [...prev];
              updated[exists] = boardStep;
              return updated;
            }
            return [...prev, boardStep];
          });
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
    [input, processing, currentQuestion, chat, stepCount, chapterId, pendingImage]
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
      setBoardSteps([]); // 切换题目时清空板书
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

        {/* Cleared state with celebration */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-md animate-celebrate">
            {/* Trophy with glow effect */}
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-200/50">
              <Trophy size={42} className="text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
              章节通关
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              {chapterName}
            </p>
            <p className="text-sm text-gray-500 mb-8">
              你已完成 {completedCount} 道题，知识点覆盖率达 {coveragePercent}%
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push("/")}
                className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 shadow-sm"
              >
                <Map size={16} />
                返回学习地图
              </button>
            </div>
          </div>
        </div>

        {/* Confetti celebration */}
        <ConfettiCelebration />
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
  const solveProgressPercent = totalQuestions > 0 ? Math.round((completedCount / totalQuestions) * 100) : 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* ---- Top bar with progress ---- */}
      <div className="shrink-0 bg-white">
        {/* Thin progress bar */}
        <div className="w-full h-0.5 bg-gray-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${solveProgressPercent}%` }}
          />
        </div>
        <div className="px-4 py-2.5">
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
            <div className="shrink-0 text-xs text-gray-500 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-medium">
              {completedCount} / {totalQuestions}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Main body: question + chat ---- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Question + Board */}
        <div className="lg:w-[45%] shrink-0 bg-white border-r border-gray-100 overflow-y-auto flex flex-col">
          {/* Question area */}
          <div className="p-4 lg:p-6 border-b border-gray-100">
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

          {/* Board area */}
          <div className="flex-1 min-h-0 flex flex-col"
               style={{
                 backgroundImage: "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
                 backgroundSize: "20px 20px",
               }}>
            <div className="px-4 lg:px-6 pt-4 pb-2 flex items-center gap-2">
              <PenLine size={14} className="text-indigo-500" />
              <span className="text-xs text-gray-500 font-medium">解题板书</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4">
              {boardSteps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                  <PenLine size={24} className="mb-2" />
                  <p className="text-xs text-gray-400 text-center leading-relaxed">
                    完成正确步骤后将自动记录在这里
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {boardSteps.map((step, idx) => (
                    <div key={step.timestamp} className="flex items-start gap-2">
                      {/* Step number circle + connector */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                          {step.stepNumber}
                        </div>
                        {idx < boardSteps.length - 1 && (
                          <div className="w-0.5 h-6 bg-indigo-200 mt-1" />
                        )}
                      </div>
                      {/* Step content card */}
                      <div className="flex-1 pb-4">
                        <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg px-3 py-2 text-sm text-gray-800 leading-relaxed">
                          <MathContent text={step.content} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Animated indicator at bottom */}
                  <div className="flex items-center gap-2 pl-1">
                    <ChevronDown size={16} className="text-indigo-300 animate-bounce" />
                    <span className="text-xs text-indigo-300">继续解题...</span>
                  </div>
                </div>
              )}
            </div>
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
                  className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
                      <Bot size={14} className="text-indigo-500" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                      m.role === "user"
                        ? "bg-indigo-500 text-white rounded-br-md"
                        : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-md"
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {m.role === "assistant" ? (
                        <MathContent text={m.content} />
                      ) : (
                        <>
                          {m.imageUrl && (
                            <img
                              src={m.imageUrl}
                              alt="学生上传的解题过程"
                              className="max-w-full rounded-lg mb-1.5"
                              style={{ maxHeight: 200 }}
                            />
                          )}
                          {m.content !== "（上传了解题过程图片）" && m.content}
                        </>
                      )}
                    </div>
                  </div>
                  {m.role === "user" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
                      <User size={14} className="text-gray-500" />
                    </div>
                  )}
                </div>
              ))}
              {processing && (
                <div className="flex gap-2 justify-start">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
                    <Bot size={14} className="text-indigo-500" />
                  </div>
                  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-md px-3.5 py-2.5 text-gray-400 text-sm">
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
                    className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <BookOpen size={16} />
                    下一题
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 border border-red-100"
                    >
                      <HelpCircle size={14} />
                      我不会
                    </button>
                    <button
                      onClick={() => sendMessage("给我点提示", false)}
                      disabled={processing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-xs hover:bg-yellow-100 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 border border-yellow-100"
                    >
                      <Lightbulb size={14} />
                      要提示
                    </button>
                  </div>
                  {/* Image preview */}
                  {pendingImage && (
                    <div className="relative inline-block mb-2">
                      <img
                        src={pendingImage}
                        alt="预览"
                        className="max-w-[200px] rounded-lg border border-gray-200"
                        style={{ maxHeight: 120 }}
                      />
                      <button
                        onClick={() => setPendingImage(null)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {/* Text input */}
                  <div className="flex gap-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processing}
                      className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-50 hover:scale-105 active:scale-95"
                      title="上传图片"
                    >
                      <ImagePlus size={20} />
                    </button>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      onPaste={handlePaste}
                      placeholder="写你的思路或答案，按回车发送..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-50"
                      disabled={processing}
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={processing || (!input.trim() && !pendingImage)}
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
