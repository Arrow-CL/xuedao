"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { knowledgeExercises, KnowledgeExercise } from "@/data/knowledge-exercises";
import { ArrowLeft, Lightbulb, Send, HelpCircle } from "lucide-react";
import Link from "next/link";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function PracticePage() {
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const unitId = searchParams.get("unit") || "ineq-polynomial";
  
  const exercises = knowledgeExercises[unitId] || [];
  const [qIdx, setQIdx] = useState(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQ = exercises[qIdx];

  // 初始化题目
  useEffect(() => {
    if (currentQ) {
      setChat([{
        role: "assistant",
        content: `第 ${qIdx + 1} 题：\n\n${currentQ.prompt}`
      }]);
      setDone(false);
    }
  }, [qIdx, unitId]);

  const submit = useCallback(async (userText?: string) => {
    const text = (userText || input).trim();
    if (!text || processing || !currentQ) return;
    
    const updated: ChatMsg[] = [...chat, { role: "user", content: text }];
    setChat(updated);
    setInput("");
    setProcessing(true);

    try {
      // 本地快速校验：直接写了答案就过
      const ans = currentQ.answer.toString();
      const cleanText = text.replace(/\s+/g, "").replace(/[。.，,！!？?]/g, "");
      const cleanAns = ans.replace(/\s+/g, "");
      
      if (cleanText.includes(cleanAns)) {
        const msg = `对了！✅\n\n${currentQ.gaokaoConnection ? `💡 高考小提示：${currentQ.gaokaoConnection}` : ""}`;
        setChat([...updated, { role: "assistant", content: msg }]);
        setDone(true);
        setProcessing(false);
        return;
      }

      // 选择题校验
      if (currentQ.type === "choice" && currentQ.options) {
        const correctOpt = currentQ.answer.toString();
        if (text.includes(correctOpt)) {
          setChat([...updated, { 
            role: "assistant", 
            content: `对了！✅\n\n${currentQ.gaokaoConnection ? `💡 高考小提示：${currentQ.gaokaoConnection}` : ""}` 
          }]);
          setDone(true);
          setProcessing(false);
          return;
        }
      }

      // 否则调用AI引导
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
          moduleId: unitId,
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
  }, [input, processing, chat, currentQ, unitId]);

  const nextQ = () => {
    if (qIdx < exercises.length - 1) {
      setQIdx(qIdx + 1);
    }
  };

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="flex items-center gap-2 text-gray-600 mb-8 hover:text-gray-900">
            <ArrowLeft size={20} />
            返回
          </Link>
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <h1 className="text-2xl font-bold mb-4">基础练习</h1>
            <p className="text-gray-500">这个知识点的练习题正在准备中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-2xl mx-auto w-full p-4 flex-1 flex flex-col">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-4">
          <Link href="javascript:history.back()" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={20} />
            返回
          </Link>
          <div className="text-sm text-gray-500">
            第 {qIdx + 1} / {exercises.length} 题
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
              基础练习
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
          <div 
            className="bg-green-500 h-1.5 rounded-full transition-all" 
            style={{ width: `${((qIdx) / exercises.length) * 100}%` }}
          />
        </div>

        {/* 聊天区 */}
        <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
                }`}>
                  <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                </div>
              </div>
            ))}
            {processing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-2.5 text-gray-400 text-sm">
                  思考中...
                </div>
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="p-4 border-t">
            {done ? (
              <button
                onClick={nextQ}
                className="w-full py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition"
              >
                {qIdx < exercises.length - 1 ? "下一题 →" : "🎉 完成练习！"}
              </button>
            ) : (
              <>
                {/* 快捷按钮 */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => submit("我不会")}
                    disabled={processing}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition disabled:opacity-50"
                  >
                    <HelpCircle size={16} />
                    我不会
                  </button>
                  <button
                    onClick={() => submit("给我点提示")}
                    disabled={processing}
                    className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-sm hover:bg-yellow-100 transition disabled:opacity-50"
                  >
                    <Lightbulb size={16} />
                    要提示
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="写答案或过程，按回车提交..."
                    className="flex-1 px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={processing}
                  />
                  <button
                    onClick={() => submit()}
                    disabled={processing || !input.trim()}
                    className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
