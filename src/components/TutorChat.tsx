"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Exercise, HintLevel, ErrorTag, ErrorRecord } from "@/types";

import { validateStep } from "@/lib/validator";


import storage from "@/lib/storage";

import MathFormula from "./MathFormula";



interface TutorChatProps {
  challenge?: boolean;

  exercise: Exercise;

  moduleId: string;

  unitName: string;

  onComplete: () => void;

}



export default function TutorChat({ exercise, moduleId, unitName, onComplete, challenge }: TutorChatProps) {
  async function callAPI(messages: { role: string; content: string }[], modId: string, unitNm: string): Promise<string> {
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, moduleId: modId, unitName: unitNm }),
      });
      const data = await res.json();
      return data.reply;
    } catch { return '\u0028AI\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff09'; }
  }

      const [messages, setMessages] = useState<{ role: "system" | "user" | "assistant"; content: string }[]>([{ role: "system", content: "你是高考数学苏格拉底式导师。教学原则：\n1.永远不给答案，只引导思路\n2.每写一步就点评对错\n3.写错时问「你怎么这步的？」\n4.卡住时给提示，不给答案\n5.学生自己写出完整正确过程后，才说【正确】\n6.如果题看很单单，学生直接给正确答案，确认正确后步通过，不必强行分步引导" }]);

  const [currentStep, setCurrentStep] = useState(0);

  const [studentInput, setStudentInput] = useState("");

  const [hintLevel, setHintLevel] = useState<HintLevel>(0);

  const [lastHintTime, setLastHintTime] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);

  const [isComplete, setIsComplete] = useState(false);

  const [thinkingTime, setThinkingTime] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);



  // 计时器：记录学生在当前步骤的思考时间

  useEffect(() => {

    if (isComplete) return;

    timerRef.current = setInterval(() => {

      setThinkingTime((t) => t + 1);

    }, 1000);

    return () => {

      if (timerRef.current) clearInterval(timerRef.current);

    };

  }, [isComplete, currentStep]);



  // 自动滚动

  useEffect(() => {

    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

  }, [messages]);



  // 初始化 AI 助手消息

  useEffect(() => {



    setMessages([])

  }, [exercise, moduleId, unitName]);



  // 判断按钮是否可用（20 秒 + 至少输入一些内容）

  const canRequestHint = useCallback(() => {

    const timeSinceLastHint = Date.now() - lastHintTime;

    if (!hasSubmitted) return false;
    return timeSinceLastHint >= 20000 && thinkingTime >= 5;

  }, [lastHintTime, thinkingTime, hasSubmitted]);



  // 处理"我不会了"

  const handleHintRequest = useCallback(async () => {

    if (!canRequestHint() || isProcessing) return;



    setIsProcessing(true);

    const newLevel = Math.min(hintLevel + 1, 3) as HintLevel;

    setHintLevel(newLevel);

    setLastHintTime(Date.now());



    // 构造提示语

    let hintMessage = "";

    switch (newLevel) {

      case 1:

        hintMessage = "学生需要帮助，请直接告诉他当前步骤该怎么做，给出公式和代入方向。";

        break;

      case 2:

        hintMessage = "学生仍然不会，请直接展示当前步骤的完整计算过程和答案。";

        break;

      case 3:

        hintMessage = "学生需要完整的解题过程，请把整个题目的完整解题步骤和最终答案都展示出来。";

        break;

    }



    const updatedMessages = [

      ...messages,

      { role: "user" as const, content: `（请求提示）我已经想了很久还是不会。${hintMessage}` },

    ];

    setMessages(updatedMessages);



    try {

      const reply = await callAPI(updatedMessages, moduleId, unitName);

      setMessages([...updatedMessages, { role: "assistant", content: reply }]);

    } catch {

      setMessages([...updatedMessages, { role: "assistant", content: "请先写出你目前的计算过程，我来看看你的思路。" }]);

    }

    setIsProcessing(false);

  }, [canRequestHint, hintLevel, isProcessing, messages]);



  // 提交当前步骤

  const handleSubmit = useCallback(async () => {

    if (!studentInput.trim() || isProcessing) return;



    setIsProcessing(true);

    setThinkingTime(0);



    const userMsg = { role: "user" as const, content: studentInput };

    const updatedMessages = [...messages, userMsg];

    setMessages(updatedMessages);

    setStudentInput("");



    // 获取当前步骤的校验信息

    const step = exercise.steps[currentStep];

    let validation;



    if (step.formulaKey || step.expectedValue !== undefined) {

      // 用代码校验当前步骤（适配新签名：equation, step, studentAnswer）
      validation = validateStep(
        exercise.equation,
        step,
        studentInput
      );



      if (validation.isCorrect) {

        // 步骤正确，AI 引导下一步

        const nextStep = exercise.steps[currentStep + 1];

        if (nextStep) {

          setCurrentStep(currentStep + 1);

          const reply = `✅ 正确。\n\n接下来，${nextStep.description}。`;

          setMessages([...updatedMessages, { role: "assistant", content: reply }]);

        } else {

          // 所有步骤完成

          setIsComplete(true);

          setMessages([...updatedMessages, { role: "assistant", content: "🎉 太棒了！你完成了这道题！\n\n请点击「完成练习」继续。" }]);

          onComplete();

        }

      } else {

        // 步骤错误，记录错误日志

        const errorRecord: ErrorRecord = {

          userId: "local",

          exerciseId: exercise.id,

          tags: exercise.tags,

          studentAnswer: studentInput,

          correctAnswer: step.expectedValue || exercise.answer,

          timestamp: Date.now(),

          moduleId,

        };

        storage.logError("local", errorRecord);

        storage.addWeakPoint("local", {
          moduleId, stepKey: step.formulaKey || step.key,
          description: step.description, count: 1, lastOccurred: Date.now(),
        });



        // AI 引导反思（不告诉学生答案）

        const stepInfo = `当前步骤: ${step.description}。学生提交了 ${studentInput}，系统的校验认为有误（但不要告诉学生具体哪个数值错了）。请直接告诉学生哪里错了、正确答案是什么、为什么错。不要用提问方式，直接解释。`;

        try {
const reply = await callAPI(updatedMessages, moduleId, unitName);

          setMessages([...updatedMessages, { role: "assistant", content: reply }]);

        } catch {

          setMessages([...updatedMessages, { role: "assistant", content: "再检查一下你的代入过程，看看系数有没有弄错？" }]);

        }

      }

    } else {

      // 没有校验规则，AI 直接分析

      try {
const reply = await callAPI(updatedMessages, moduleId, unitName);

        setMessages([...updatedMessages, { role: "assistant", content: reply }]);

      } catch {

        setMessages([...updatedMessages, { role: "assistant", content: "好的，请继续写下你的下一步。" }]);

      }

    }

    setIsProcessing(false);

  }, [studentInput, isProcessing, messages, currentStep, exercise, moduleId, unitName, onComplete]);



  if (isComplete) {

    return (

      <div className="text-center py-12">

        <div className="text-6xl mb-4">🎉</div>

        <h3 className="text-xl font-semibold text-green-700 mb-2">完成！</h3>

        <p className="text-gray-600">你已经完成了这道题。</p>

      </div>

    );

  }



  const step = exercise.steps[currentStep];

  const hintCooldown = Math.max(0, 20 - Math.floor((Date.now() - lastHintTime) / 1000));

  const canHint = canRequestHint();



  return (

    <div className="border rounded-lg bg-white shadow-sm flex flex-col h-[500px]">

      {hasSubmitted && step && !challenge && <p className="text-xs text-blue-500 px-4 pb-2">{step.description}</p>}



      {/* 对话区 */}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {messages.map((msg, i) => (

          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

            <div

              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${

                msg.role === "user"

                  ? "bg-blue-500 text-white"

                  : msg.role === "system"

                  ? "bg-gray-100 text-gray-500 italic"

                  : "bg-gray-100 text-gray-800"

              }`}

            >

              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{msg.content}</div>

            </div>

          </div>

        ))}

        <div ref={chatEndRef} />

      </div>



      {/* 输入区 */}

      <div className="border-t p-3 space-y-2">

        <div className="flex gap-2">

          <input

            type="text"

            value={studentInput}

            onChange={(e) => setStudentInput(e.target.value)}

            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}

            placeholder="写下你这一步的结果..."

            className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

            disabled={isProcessing}

          />

          <button

            onClick={handleSubmit}

            disabled={!studentInput.trim() || isProcessing}

            className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"

          >

            {isProcessing ? "..." : "提交"}

          </button>

        </div>



        {/* "我不会了" 按钮 */}

        <div className="flex items-center gap-2">

          <button

            onClick={handleHintRequest}

            disabled={!canHint || isProcessing}

            className={`px-3 py-1.5 rounded text-sm transition-colors ${

              canHint && !isProcessing

                ? "bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100"

                : "bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"

            }`}

          >

            💡 我不会了

          </button>

          {!canHint && (

            <span className="text-xs text-gray-400">

              {!hasSubmitted ? "先试着写一步吧" : thinkingTime < 5

                ? `再想一会儿...`

                : `${hintCooldown}秒后可求助`}

            </span>

          )}

          {hintLevel > 0 && (

            <span className="text-xs text-amber-500">

              已求助 {hintLevel}/3 次

            </span>

          )}

        </div>

      </div>

    </div>

  );

}