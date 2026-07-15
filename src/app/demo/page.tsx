"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import MathContent from "@/components/MathContent";
import { Send, HelpCircle, Upload, ChevronRight, BookOpen, Trophy, Sparkles } from "lucide-react";
import { getLocalSolution } from "@/lib/solution-engine";

// ============================================================================
// 题目数据（内嵌，不走 API 加载）
// ============================================================================

const DEMO_QUESTIONS = [
  {
    id: "gk-2024-xkb1-3",
    title: "第1题 · 2024新高考一 · 向量垂直",
    prompt:
      "已知向量$\\boldsymbol{a}=(0,1)$，$\\boldsymbol{b}=(2,x)$，若$\\boldsymbol{b}\\perp (\\boldsymbol{b}-4\\boldsymbol{a})$，则$x=$____",
    answer: "2",
  },
  {
    id: "gk-2022-xkb1-3",
    title: "第2题 · 2022新高考一 · 基底表示",
    prompt:
      "在$\\triangle ABC$中，点$D$在边$AB$上，$BD=2DA$。记$\\overrightarrow{CA}=\\boldsymbol{m}$，$\\overrightarrow{CD}=\\boldsymbol{n}$，则$\\overrightarrow{CB}=$____",
    answer: "$-2\\boldsymbol{m}+3\\boldsymbol{n}$",
  },
  {
    id: "gk-2024-xkb2-3",
    title: "第3题 · 2024新高考二 · 模长与数量积",
    prompt:
      "已知向量$\\boldsymbol{a},\\boldsymbol{b}$满足$|\\boldsymbol{a}|=1,\\ |\\boldsymbol{a}+2\\boldsymbol{b}|=2$，且$(\\boldsymbol{b}-2\\boldsymbol{a})\\perp \\boldsymbol{b}$，则$|\\boldsymbol{b}|=$____",
    answer: "$\\dfrac{\\sqrt{2}}{2}$",
  },
  {
    id: "vec-l5",
    title: "第4题 · 平行四边形向量",
    prompt:
      "在平行四边形$ABCD$中，$E$为$AD$中点，$BE$交$AC$于$F$，则$\\overrightarrow{DF}=$____",
    answer: "$\\dfrac{1}{3}\\overrightarrow{AB}-\\dfrac{2}{3}\\overrightarrow{AD}$",
  },
];

// ============================================================================
// 板书步骤类型
// ============================================================================

interface BoardStep {
  stepNumber: number;
  content: string;
  isCorrect: boolean;
}

// ============================================================================
// Demo 页面组件
// ============================================================================

export default function DemoPage() {
  // 状态管理
  const [questionIndex, setQuestionIndex] = useState(0);
  const [chat, setChat] = useState<Array<{ role: string; content: string }>>([]);
  const [boardSteps, setBoardSteps] = useState<BoardStep[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState(0);
  const [progress, setProgress] = useState("");
  const [currentDiagram, setCurrentDiagram] = useState<string | null>(null);
  const [unlockedNodeIds, setUnlockedNodeIds] = useState<number[]>([]);
  const [knowledgeFragments, setKnowledgeFragments] = useState<string[]>([]);
  const [helpCount, setHelpCount] = useState(0); // 当前节点连续说"我不会"的次数
  const prevBoardLengthRef = useRef(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentQuestion = DEMO_QUESTIONS[questionIndex];

  // 自动滚动到最新消息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // 自动滚动到最新板书步骤
  useEffect(() => {
    boardEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [boardSteps]);

  // 切换题目时清空所有状态
  const switchQuestion = (index: number) => {
    if (index === questionIndex && chat.length === 0) return;
    setQuestionIndex(index);
    setChat([]);
    setBoardSteps([]);
    setInput("");
    setProcessing(false);
    setDone(false);
    setSummary(null);
    setCurrentNodeId(0);
    setProgress("");
    setCurrentDiagram(null);
    setUnlockedNodeIds([]);
    setKnowledgeFragments([]);
    setHelpCount(0);
    prevBoardLengthRef.current = 0;
  };

  // 触发迷你知识回顾（做完所有题后）
  const triggerMiniReview = async () => {
    const reviewData = DEMO_QUESTIONS.map((q) => {
      const sol = getLocalSolution(q.id);
      return {
        questionTitle: q.title,
        questionPrompt: q.prompt,
        knowledgePoints: sol?.knowledgePoints || [],
      };
    });

    setProcessing(true);
    try {
      const res = await fetch("/api/demo-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: DEMO_QUESTIONS[0].id,
          questionText: "",
          studentInput: "迷你回顾触发",
          currentNodeId: 0,
          unlockedNodeIds: [],
          chatHistory: chat.map((m) => ({
            role: m.role === "student" ? "user" : "assistant",
            content: m.content,
          })),
          triggerMiniReview: true,
          miniReviewData: reviewData,
        }),
      });

      const data = await res.json();
      if (data.isMiniReview && data.reply) {
        setChat((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setSummary(null);
      }
    } catch (err) {
      console.error("[demo] Mini review failed:", err);
    }
    setProcessing(false);
  };

  // 下一题
  const goNextQuestion = () => {
    if (questionIndex < DEMO_QUESTIONS.length - 1) {
      switchQuestion(questionIndex + 1);
    }
  };

  // 发送消息
  const sendMessage = async (text: string, isHelp = false) => {
    if (processing || done) return;

    const q = DEMO_QUESTIONS[questionIndex];
    setProcessing(true);

    // 添加学生消息到 chat
    const userMsg = { role: "student" as const, content: isHelp ? "我不会" : text };
    setChat((prev) => [...prev, userMsg]);

    // 本次请求的 helpCount：求助时用当前值+1（因为这次是第helpCount+1次求助），正常答题时传0
    const currentHelpCount = isHelp ? helpCount : 0;

    // 构造发送给 AI 的历史消息（限制最近 20 条，防止 token 溢出）
    const recentChat = chat.slice(-20);
    const historyForAPI = recentChat.map((m) => ({
      role: m.role === "student" ? "user" : "assistant",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/demo-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          questionText: q.prompt,
          studentInput: isHelp ? "我不会" : text,
          currentNodeId,
          unlockedNodeIds,
          chatHistory: historyForAPI,
          helpCount: currentHelpCount,
        }),
      });

      const data = await res.json();

      // 添加 AI 回复到 chat
      setChat((prev) => [...prev, { role: "assistant", content: data.reply }]);

      // 更新板书
      if (data.boardLines && data.boardLines.length > 0) {
        // 过滤掉 [DIAGRAM:...] 占位行，不渲染为文字
        const textLines = data.boardLines.filter((line: string) => !line.startsWith("[DIAGRAM:"));
        const newSteps = textLines.map((line: string, idx: number) => ({
          stepNumber: idx + 1,
          content: line,
          isCorrect: true,
        }));
        setBoardSteps(newSteps);
        prevBoardLengthRef.current = newSteps.length;
      }

      // 检测题目完成信号（API 返回 isCompleted 或回复中包含【完成】）
      const questionCompleted = data.isCompleted || data.reply.includes("【完成】");

      if (questionCompleted) {
        // ===== 题目已完成 =====
        setDone(true);
        // 完成时显示题目主图形（API 已返回主图形）
        if (data.currentDiagram) {
          setCurrentDiagram(data.currentDiagram);
        }
        // 清除答疑知识点弹窗
        setKnowledgeFragments([]);
        setHelpCount(0);
        // AI 回复本身就是知识回顾，提取【完成】之前的内容
        const reviewContent = data.reply.split("【完成】")[0].trim();
        setSummary(reviewContent || data.reply);
        // 更新节点为全部完成
        setCurrentNodeId(totalNodes);
        setProgress(`${totalNodes}/${totalNodes}`);
        // API 已返回全量板书，直接渲染
        if (data.unlockedNodeIds) {
          setUnlockedNodeIds(data.unlockedNodeIds);
        }

        // 如果是最后一题，延迟触发迷你知识回顾
        if (questionIndex === DEMO_QUESTIONS.length - 1 && !data.isMiniReview) {
          setTimeout(() => triggerMiniReview(), 800);
        }
      } else {
        // ===== 正常解题中 =====
        // 更新图形
        if (data.currentDiagram) {
          setCurrentDiagram(data.currentDiagram);
        }

        // 知识点片段管理：答疑模式显示，正常解题且有进展时清除
        if (data.isHelpMode && data.knowledgeFragment) {
          setKnowledgeFragments([data.knowledgeFragment]);
        } else if (data.matchedNodeId > 0 && !data.isHelpMode) {
          // 学生答对了新节点，清除答疑知识点弹窗，重置helpCount
          setKnowledgeFragments([]);
          setHelpCount(0);
        }

        // 求助时递增 helpCount
        if (isHelp) {
          setHelpCount((prev) => prev + 1);
        }

        // 更新节点 ID
        if (data.matchedNodeId !== undefined) {
          setCurrentNodeId(data.matchedNodeId);
        }
        if (data.unlockedNodeIds) {
          setUnlockedNodeIds(data.unlockedNodeIds);
        }

        // 更新进度
        if (data.progress) {
          setProgress(data.progress);
        }
      }

      // 迷你回顾的AI回复
      if (data.isMiniReview) {
        setChat((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setSummary(null); // 清除单题知识回顾，替换为迷你回顾
      }
    } catch (err) {
      console.error("[demo] API call failed:", err);
      setChat((prev) => [
        ...prev,
        { role: "assistant", content: "（网络出错，请稍后重试）" },
      ]);
    }

    setProcessing(false);
    setInput("");
  };

  // 提交输入
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
  };

  // 上传图片处理（简化版：直接把图片转成文字提示）
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 简化处理：提示用户输入文字
    // 在 demo 中不实现完整的 OCR，改为提示
    setInput("我手写了解题过程（图片已上传）");
    e.target.value = "";
  };

  // 解析进度中的节点数（从 solution-engine 动态获取）
  const totalNodes = useMemo(() => {
    const sol = getLocalSolution(currentQuestion.id);
    return sol?.keyNodes.length || 6;
  }, [currentQuestion.id]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* ===== 顶部标题栏 ===== */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          {/* 标题行 */}
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h1 className="text-lg font-bold text-gray-900">学导 · 向量解题演示</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Demo
            </span>
          </div>

          {/* 题号标签 */}
          <div className="flex flex-wrap gap-2">
            {DEMO_QUESTIONS.map((q, i) => (
              <button
                key={q.id}
                onClick={() => switchQuestion(i)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    i === questionIndex
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }
                  ${done && i === questionIndex ? "bg-green-600 text-white" : ""}
                `}
              >
                {q.title}
              </button>
            ))}
          </div>

          {/* 进度条 */}
          {progress && !done && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (unlockedNodeIds.length / totalNodes) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                节点 {unlockedNodeIds.length}/{totalNodes}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ===== 主内容区 ===== */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full overflow-hidden">
        {/* ===== 左侧面板：解题板书（桌面 40%） ===== */}
        <aside className="lg:w-[40%] border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            {done ? (
              <Trophy className="w-4 h-4 text-amber-500" />
            ) : (
              <BookOpen className="w-4 h-4 text-green-600" />
            )}
            <h2 className="text-sm font-semibold text-gray-700">
              {done ? "完整解题过程" : "解题板书"}
            </h2>
            <span className="ml-auto flex items-center gap-2">
              {boardSteps.length > 0 && (
                <span className="text-xs text-gray-400">
                  {boardSteps.length} 步
                </span>
              )}
              {done && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  已完成
                </span>
              )}
            </span>
          </div>

          {/* 板书内容区 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* 完成状态顶部提示 */}
            {done && (
              <div className="demo-fade-in p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">题目已完成</p>
                  <p className="text-xs text-green-600">下方是完整解题过程，可以对照回顾</p>
                </div>
              </div>
            )}
            {boardSteps.length === 0 && !currentDiagram && knowledgeFragments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">
                  开始解题后，解题过程会逐步显示在这里
                </p>
              </div>
            ) : (
              <>
                {/* 数形结合图形区域 */}
                {currentDiagram && (
                  <div
                    key={currentDiagram}
                    className="demo-fade-in rounded-xl overflow-hidden border border-gray-100 shadow-sm"
                    style={{ animationDelay: "0ms" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentDiagram}
                      alt="几何图形"
                      className="w-full h-auto"
                    />
                  </div>
                )}

                {/* 知识点片段区域（答疑模式插入的公式/定理，有图形时自动隐藏） */}
                {knowledgeFragments.length > 0 && !currentDiagram && (
                  <div className="space-y-2">
                    {knowledgeFragments.map((frag, fIdx) => (
                      <div
                        key={fIdx}
                        className="demo-fade-in p-3 bg-amber-50 rounded-xl border border-amber-200 border-l-4 border-l-amber-400"
                        style={{ animationDelay: `${fIdx * 100}ms` }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-700">
                            知识点提示
                          </span>
                        </div>
                        <MathContent
                          text={frag}
                          className="text-sm text-amber-900 leading-relaxed"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 文字板书步骤 */}
                {boardSteps.map((step, idx) => {
                  const isNew = idx >= prevBoardLengthRef.current - boardSteps.length;
                  return (
                <div
                  key={`${questionIndex}-${idx}`}
                  className="
                    relative pl-4 pr-3 py-3
                    bg-white rounded-xl shadow-sm border border-gray-100
                    border-l-4 border-green-400
                    demo-fade-in
                  "
                  style={{
                    animationDelay: `${idx * 100}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-50 text-green-600 text-xs font-bold flex-shrink-0 mt-0.5">
                      {step.stepNumber}
                    </span>
                    <MathContent
                      text={step.content}
                      className="text-sm text-gray-800 leading-relaxed"
                    />
                  </div>
                </div>
              );
                })}
              </>
            )}
            <div ref={boardEndRef} />
          </div>
        </aside>

        {/* ===== 右侧面板：对话区（桌面 60%） ===== */}
        <main className="lg:w-[60%] flex flex-col bg-gray-50 overflow-hidden">
          {/* 题目展示（固定在顶部，不随聊天滚动） */}
          <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-100">
            <MathContent
              text={currentQuestion.prompt}
              className="text-sm text-gray-800"
            />
          </div>

          {/* 聊天区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chat.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-sm text-gray-400 mb-1">
                  {currentQuestion.title}
                </p>
                <p className="text-xs text-gray-300">
                  在下方输入你的解题步骤，AI 会逐步引导你
                </p>
              </div>
            )}

            {chat.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-4 py-2.5
                    ${
                      msg.role === "student"
                        ? "bg-blue-50 text-blue-900 rounded-br-md"
                        : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
                    }
                  `}
                >
                  <MathContent text={msg.content} className="text-sm leading-relaxed" />
                </div>
              </div>
            ))}

            {/* 处理中指示器 */}
            {processing && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-400 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs">AI 思考中...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ===== 底部输入区域 ===== */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white">
            {/* 下一题按钮（完成后显示） */}
            {done && questionIndex < DEMO_QUESTIONS.length - 1 && (
              <div className="px-4 pt-3 pb-2">
                <button
                  onClick={goNextQuestion}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors"
                >
                  下一题
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 全部完成提示 */}
            {done && questionIndex === DEMO_QUESTIONS.length - 1 && (
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium">
                  <Trophy className="w-4 h-4" />
                  全部题目已完成！
                </div>
              </div>
            )}

            {/* 输入框 + 按钮行 */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
              {/* 要提示按钮 */}
              <button
                type="button"
                onClick={() => sendMessage("", true)}
                disabled={processing || done}
                className="flex items-center gap-1 px-3 py-2 text-amber-600 bg-amber-50 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">要提示</span>
              </button>

              {/* 上传图片按钮（简化版） */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing || done}
                className="flex items-center justify-center px-2 py-2 text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                title="上传图片"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {/* 文本输入框 */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={done ? "本题已完成" : "输入你的解题步骤..."}
                disabled={processing || done}
                className="flex-1 min-w-0 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />

              {/* 发送按钮 */}
              <button
                type="submit"
                disabled={processing || done || !input.trim()}
                className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* ===== 全局样式注入（fadeIn 动画） ===== */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes demoFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .demo-fade-in { animation: demoFadeIn 0.4s ease-out; }
      `}} />
    </div>
  );
}
