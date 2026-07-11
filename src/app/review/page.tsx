"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MathContent from "@/components/MathContent";
import { chapters } from "@/data/chapters";
import { getAllGaokaoQuestions } from "@/data/gaokao-questions";
import {
  getReviewBoard,
  saveReviewBoardEntry,
  clearReviewBoard,
  getChapterErrorRecords,
  getChapterCompletedQuestions,
  type ReviewBoardEntry,
} from "@/lib/storage-v2";
import { ArrowLeft, Send, Trash2, BookOpen } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Parse [BOARD:unitId]content[/BOARD] from AI reply.
 * Returns clean reply and parsed board entries.
 */
function parseBoardAnnotations(
  reply: string,
  units: { id: string; name: string }[]
): { cleanReply: string; newEntries: ReviewBoardEntry[] } {
  const entries: ReviewBoardEntry[] = [];
  const boardRegex = /\[BOARD:([^\]]+)\]([\s\S]*?)\[\/BOARD\]/g;

  let cleanReply = reply.replace(boardRegex, (_, unitId, content) => {
    const unit = units.find((u) => u.id === unitId);
    if (unit) {
      entries.push({
        unitId,
        unitName: unit.name,
        content: content.trim(),
        order: units.findIndex((u) => u.id === unitId),
      });
    }
    return "";
  });

  // Clean up extra blank lines
  cleanReply = cleanReply.replace(/\n{3,}/g, "\n\n").trim();

  return { cleanReply, newEntries: entries };
}

/* ------------------------------------------------------------------ */
/*  Inner component (needs useSearchParams inside Suspense)             */
/* ------------------------------------------------------------------ */

function ReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chapterId = searchParams.get("chapter") ?? "";

  const ch = chapters.find((c) => c.id === chapterId);
  const chapterName = ch?.title ?? chapterId;
  const units = ch?.units ?? [];

  // ---- state ----
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [board, setBoard] = useState<ReviewBoardEntry[]>([]);
  const [coveredUnits, setCoveredUnits] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- ref to track latest chat state (avoids stale closure in setTimeout) ----
  const chatStateRef = useRef<ChatMsg[]>([]);

  // ---- refs for question/error data (built once on init) ----
  const completedQuestionsRef = useRef<{
    questionId: string;
    prompt: string;
    knowledgePointIds: string[];
    hasError: boolean;
    errorSteps: string[];
  }[]>([]);

  /* ---- Load saved board + build question/error data on mount ---- */
  useEffect(() => {
    if (chapterId) {
      const saved = getReviewBoard(chapterId);
      setBoard(saved);
      setCoveredUnits(new Set(saved.map((e) => e.unitId)));

      // Build completed questions data, merging error records
      const completedIds = getChapterCompletedQuestions(chapterId);
      const allGaokao = getAllGaokaoQuestions();
      const chapterQs = allGaokao[chapterId] ?? [];
      const chapterErrors = getChapterErrorRecords(chapterId);
      // Build error map: questionId -> { errorCount, errorSteps }
      const errorMap = new Map<string, { errorCount: number; errorSteps: string[] }>();
      for (const err of chapterErrors) {
        errorMap.set(err.questionId, { errorCount: err.errorCount, errorSteps: err.errorSteps ?? [] });
      }

      const completedQs: typeof completedQuestionsRef.current = [];
      for (const q of chapterQs) {
        if (completedIds.includes(q.id)) {
          const errInfo = errorMap.get(q.id);
          completedQs.push({
            questionId: q.id,
            prompt: q.prompt,
            knowledgePointIds: q.knowledgePointIds ?? [],
            hasError: !!errInfo,
            errorSteps: errInfo?.errorSteps ?? [],
          });
        }
      }
      completedQuestionsRef.current = completedQs;

      setInitialized(true);
    }
  }, [chapterId]);

  /* ---- auto-scroll chat ---- */
  useEffect(() => {
    chatStateRef.current = chat;
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat, processing]);

  /* ---- focus input ---- */
  useEffect(() => {
    if (initialized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initialized]);

  /* ---- Auto-start: AI takes initiative to review ---- */
  const startTriggered = useRef(false);
  useEffect(() => {
    if (!initialized || startTriggered.current) return;
    startTriggered.current = true;
    // 先显示AI的开场白，然后触发API开始梳理第一个知识点
    setChat([
      {
        role: "assistant",
        content: `好，我们开始梳理${chapterName}的知识点。你做过的题目我都记录着，我会带你回顾每道题用到的知识点，看看你现在掌握得怎么样。\n\n先从第一个知识点开始：`,
      },
    ]);
    // 500ms后触发AI开始梳理
    const timer = setTimeout(() => {
      sendMessage("请开始梳理第一个知识点", true);
    }, 500);
    return () => clearTimeout(timer);
  }, [initialized]);

  /* ---- Send message ---- */
  const sendMessage = useCallback(
    async (overrideText?: string, hidden?: boolean) => {
      const text = (overrideText ?? input).trim();
      if (!text || processing || !chapterId) return;

      // Use ref to get the latest chat state (avoids stale closure in setTimeout)
      const currentChat = chatStateRef.current;

      // hidden=true 时不把用户消息显示在聊天中（用于自动触发）
      if (!hidden) {
        setChat([...currentChat, { role: "user", content: text }]);
      }
      setInput("");
      setProcessing(true);

      // Build chatHistory for API (includes hidden user message)
      const chatHistory = hidden
        ? [...currentChat, { role: "user", content: text }]
        : [...currentChat, { role: "user", content: text }];

      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterId,
            chapterName,
            units,
            studentInput: text,
            chatHistory,
            coveredUnits: Array.from(coveredUnits),
            completedQuestions: completedQuestionsRef.current,
          }),
        });

      const data = await res.json();
      let reply: string = data.reply ?? "（暂时无法回复，请再试一次）";

      // Parse [BOARD:...] annotations
      const { cleanReply, newEntries } = parseBoardAnnotations(reply, units);
      reply = cleanReply;

      // Save new board entries
      for (const entry of newEntries) {
        saveReviewBoardEntry(chapterId, entry);
      }

      // Update state
      if (newEntries.length > 0) {
        setBoard((prev) => {
          const merged = [...prev];
          for (const entry of newEntries) {
            const idx = merged.findIndex((e) => e.unitId === entry.unitId);
            if (idx >= 0) {
              // 覆盖，不追加
              merged[idx] = entry;
            } else {
              merged.push(entry);
            }
          }
          return merged.sort((a, b) => a.order - b.order);
        });

        setCoveredUnits((prev) => {
          const next = new Set(prev);
          for (const entry of newEntries) next.add(entry.unitId);
          return next;
        });
      }

      setChat((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChat((prev) => [
        ...prev,
        { role: "assistant", content: "（网络错误，请重试）" },
      ]);
    } finally {
      setProcessing(false);
    }
  }, [input, processing, chapterId, chapterName, units, coveredUnits]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ---- Clear board ---- */
  const handleClearBoard = () => {
    clearReviewBoard(chapterId);
    setBoard([]);
    setCoveredUnits(new Set());
  };

  /* ---- No chapter selected ---- */
  if (!chapterId || !ch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">请从学习地图选择要梳理的章节</p>
          <button
            onClick={() => router.push("/")}
            className="mt-3 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600"
          >
            返回学习地图
          </button>
        </div>
      </div>
    );
  }

  const totalUnits = units.length;
  const coveredCount = coveredUnits.size;
  const progressPercent =
    totalUnits > 0 ? Math.round((coveredCount / totalUnits) * 100) : 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* ---- Top bar ---- */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
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
                知识点梳理 — {chapterName}
              </h2>
              <p className="text-[11px] text-gray-400 truncate">
                已梳理 {coveredCount}/{totalUnits} 个知识点
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{progressPercent}%</span>
          </div>
        </div>
      </div>

      {/* ---- Main: left board + right chat ---- */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Knowledge Board (blackboard style) */}
        <div className="w-[42%] shrink-0 bg-gray-900 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-green-400" />
                <span className="text-xs font-medium text-green-400 uppercase tracking-wider">
                  知识板书
                </span>
              </div>
              {board.length > 0 && (
                <button
                  onClick={handleClearBoard}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  title="清空板书"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {board.length === 0 ? (
              <div className="text-gray-600 text-xs italic">
                还没有梳理知识点。在右边对话框中跟着AI回顾，知识点会自动板书到这里。
              </div>
            ) : (
              <div className="space-y-3">
                {board.map((entry) => (
                  <div
                    key={entry.unitId}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-xs font-medium text-green-400">
                        {entry.unitName}
                      </span>
                    </div>
                    <div className="text-sm text-gray-200 leading-relaxed">
                      <MathContent text={entry.content} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-gray-100">
          {/* Chat messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto space-y-3">
              {chat.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  AI 正在准备梳理第一个知识点...
                </div>
              )}
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
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
            </div>
          </div>

          {/* Input */}
          <div className="shrink-0 bg-white border-t border-gray-100 p-3">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="回复你的理解或疑问..."
                className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
              <button
                onClick={() => sendMessage()}
                disabled={processing || !input.trim()}
                className="shrink-0 p-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
