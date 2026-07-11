"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import MathContent from "@/components/MathContent";
import {
  ArrowLeft,
  Send,
  HelpCircle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import gaokaoIndex from "@/data/gaokao-questions/index.json";
import { chapters } from "@/data/chapters";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GaokaoQuestion {
  year: number;
  paper: string;
  number: number;
  prompt: string;
  type: string;
  difficulty: number;
  chapters: string[];
  answer?: string;
  options?: string[];
}

type GaokaoData = Record<string, GaokaoQuestion[]>;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

type PageMode = "select" | "solve";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Extract a short label from the full paper name, e.g. "全国乙卷（理）" */
function paperShort(full: string): string {
  const m = full.match(/[（(]([^)）]+)[)）]/);
  if (m) {
    const inner = m[1];
    if (inner.includes("新高考Ⅰ")) return "新高考I";
    if (inner.includes("新高考Ⅱ")) return "新高考II";
    if (inner.includes("全国甲")) return "全国甲卷";
    if (inner.includes("全国乙")) return "全国乙卷";
    return inner.length > 8 ? inner.slice(0, 8) + "..." : inner;
  }
  return full.length > 12 ? full.slice(0, 12) + "..." : full;
}

function difficultyLabel(d: number): string {
  if (d <= 1) return "基础";
  if (d <= 2) return "中等";
  if (d <= 3) return "较难";
  return "困难";
}

function difficultyColor(d: number): string {
  if (d <= 1) return "bg-green-50 text-green-600 border-green-200";
  if (d <= 2) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (d <= 3) return "bg-orange-50 text-orange-600 border-orange-200";
  return "bg-red-50 text-red-600 border-red-200";
}

function questionId(q: GaokaoQuestion): string {
  return `gaokao-${q.year}-${q.number}`;
}

/** Get chapter title from chapters.ts */
function chapterTitle(id: string): string {
  const ch = chapters.find((c) => c.id === id);
  return ch?.title ?? id;
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ExperiencePage() {
  const data = gaokaoIndex as GaokaoData;

  // ---- mode ----
  const [mode, setMode] = useState<PageMode>("select");

  // ---- selection mode state ----
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // ---- solve mode state ----
  const [selectedQ, setSelectedQ] = useState<GaokaoQuestion | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- auto-scroll chat ---- */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat, processing]);

  /* ---- focus input on mount ---- */
  useEffect(() => {
    if (mode === "solve" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  /* ---------------------------------------------------------------- */
  /*  Select a question                                                */
  /* ---------------------------------------------------------------- */
  const startSolving = useCallback((q: GaokaoQuestion) => {
    setSelectedQ(q);
    setMode("solve");
    setDone(false);
    setStepCount(0);
    setSummary(null);
    setChat([
      {
        role: "assistant",
        content: `**${q.year}年 ${paperShort(q.paper)} 第${q.number}题**\n\n${q.prompt}\n\n这道题已知了什么？从哪里开始？`,
      },
    ]);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Back to selection                                                 */
  /* ---------------------------------------------------------------- */
  const backToSelect = useCallback(() => {
    setMode("select");
    setSelectedQ(null);
    setChat([]);
    setInput("");
    setDone(false);
    setStepCount(0);
    setSummary(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Reply sanitization: strip leading "- " before LaTeX formulas     */
  /* ---------------------------------------------------------------- */
  const sanitizeReply = useCallback((reply: string): string => {
    // Remove "- " at line start when followed by math content ($ or \)
    // This prevents "- $\vec{a}" from rendering as "negative vector"
    return reply.replace(/^-\s+(?=[\$\\])/gm, "");
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Send a message to the guide API                                  */
  /* ---------------------------------------------------------------- */
  const sendMessage = useCallback(
    async (userText?: string, isHelp?: boolean) => {
      const text = (userText ?? input).trim();
      if (!text || processing || !selectedQ) return;

      const qid = questionId(selectedQ);
      const updated: ChatMsg[] = [...chat, { role: "user", content: text }];
      setChat(updated);
      setInput("");
      setProcessing(true);
      setStepCount((s) => s + 1);
      const currentStep = stepCount + 1;

      try {
        const res = await fetch("/api/guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: qid,
            questionText: selectedQ.prompt,
            answer: selectedQ.answer ?? "",
            studentInput: text,
            currentStepNumber: currentStep,
            chatHistory: updated,
            studentSaidHelp: !!isHelp,
          }),
        });

        const data = await res.json();
        let reply: string = data.reply ?? "（暂时无法回复，请再试一次）";
        reply = sanitizeReply(reply);

        setChat((prev) => [...prev, { role: "assistant", content: reply }]);

        // Detect completion
        if (
          reply.includes("【正确】") ||
          reply.includes("回答正确") ||
          reply.includes("做对了") ||
          data.solved
        ) {
          setDone(true);
          // If the guide returns a summary, show it
          if (data.summary) {
            setSummary(data.summary);
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
    [input, processing, selectedQ, chat, stepCount]
  );

  /* ---------------------------------------------------------------- */
  /*  Next question (random from same chapter)                          */
  /* ---------------------------------------------------------------- */
  const nextQuestion = useCallback(() => {
    if (!selectedQ) return;
    const primaryChapter = selectedQ.chapters?.[0];
    if (!primaryChapter) return;
    const pool = data[primaryChapter];
    if (!pool || pool.length === 0) return;
    // Pick a random different question
    let next: GaokaoQuestion;
    const tries = 20;
    for (let i = 0; i < tries; i++) {
      next = pool[Math.floor(Math.random() * pool.length)];
      if (questionId(next) !== questionId(selectedQ)) {
        startSolving(next);
        return;
      }
    }
    // Fallback: just use first question in pool
    startSolving(pool[0]);
  }, [selectedQ, data, startSolving]);

  /* ================================================================ */
  /*  RENDER                                                            */
  /* ================================================================ */

  /* ---------- Selection Mode ---------- */
  if (mode === "select") {
    const chapterIds = Object.keys(data).filter(
      (k) => data[k] && data[k].length > 0
    );

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
                <BookOpen size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  高考真题闯关
                </h1>
                <p className="text-xs text-gray-400">
                  选择章节和题目，开始做题
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter list */}
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          {chapterIds.map((chId) => {
            const qs = data[chId];
            const isExpanded = expandedChapter === chId;
            const totalCount = qs.length;
            const easyCount = qs.filter((q) => q.difficulty <= 1).length;
            const hardCount = qs.filter((q) => q.difficulty >= 3).length;

            return (
              <div
                key={chId}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden"
              >
                {/* Chapter header — clickable */}
                <button
                  onClick={() =>
                    setExpandedChapter(isExpanded ? null : chId)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    )}
                    <span className="font-medium text-gray-800 text-sm truncate">
                      {chapterTitle(chId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[11px] text-gray-400">
                      {totalCount}题
                    </span>
                    {easyCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-600 border border-green-200">
                        {easyCount}基础
                      </span>
                    )}
                    {hardCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-50 text-orange-600 border border-orange-200">
                        {hardCount}较难
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded question list */}
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {qs.map((q, idx) => (
                      <button
                        key={`${q.year}-${q.number}-${idx}`}
                        onClick={() => startSolving(q)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50/50 transition-colors"
                      >
                        {/* Year badge */}
                        <span className="shrink-0 text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {q.year}
                        </span>
                        {/* Paper + number */}
                        <span className="text-xs text-gray-600 shrink-0 truncate max-w-[100px]">
                          {paperShort(q.paper)} #{q.number}
                        </span>
                        {/* Difficulty */}
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${difficultyColor(q.difficulty)}`}
                        >
                          {difficultyLabel(q.difficulty)}
                        </span>
                        {/* Type */}
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {q.type === "choice"
                            ? "选择"
                            : q.type === "multi-choice"
                              ? "多选"
                              : q.type === "fill"
                                ? "填空"
                                : q.type === "essay"
                                  ? "解答"
                                  : q.type}
                        </span>
                        {/* Truncated prompt */}
                        <span className="text-xs text-gray-400 truncate ml-auto max-w-[180px]">
                          {q.prompt.slice(0, 30).replace(/[\\\n{}]/g, " ")}...
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------- Solve Mode ---------- */
  if (!selectedQ) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ---- Top bar ---- */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={backToSelect}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="返回选题"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">
                {selectedQ.year}年 {paperShort(selectedQ.paper)} 第
                {selectedQ.number}题
              </h2>
              <p className="text-[11px] text-gray-400 truncate">
                {selectedQ.type === "choice"
                  ? "选择题"
                  : selectedQ.type === "multi-choice"
                    ? "多选题"
                    : selectedQ.type === "fill"
                      ? "填空题"
                      : "解答题"}{" "}
                | {difficultyLabel(selectedQ.difficulty)} |{" "}
                {selectedQ.chapters.map(chapterTitle).join("、")}
              </p>
            </div>
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
              <MathContent text={selectedQ.prompt} />
            </div>
            {selectedQ.options && selectedQ.options.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {selectedQ.options.map((opt, i) => (
                  <div
                    key={i}
                    className="text-sm text-gray-700 pl-2 border-l-2 border-gray-200"
                  >
                    <MathContent text={`${String.fromCharCode(65 + i)}. ${opt}`} />
                  </div>
                ))}
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
                    onClick={backToSelect}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
                  >
                    返回选题
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
