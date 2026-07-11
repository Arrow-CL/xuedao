"use client";
import { useRef, useState, useCallback } from "react";
import MathContent from "./MathContent";

interface Props {
  question: string;
  onProcessText: (text: string) => void;
  disabled?: boolean;
}

export default function DrawingCanvas({ question, onProcessText, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getPos = (e: React.PointerEvent) => {
    const c = canvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startDraw = (e: React.PointerEvent) => {
    if (disabled) return; setIsDrawing(true);
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y);
  };
  const moveDraw = (e: React.PointerEvent) => {
    if (!isDrawing || disabled) return;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    ctx.lineTo(getPos(e).x, getPos(e).y); ctx.stroke();
  };
  const endDraw = () => setIsDrawing(false);
  const clearCanvas = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };

  const handleSubmit = useCallback(() => {
    const t = textRef.current?.value || "";
    if (t.trim()) onProcessText(t);
  }, [onProcessText]);

  return (
    <div className="flex flex-col h-full">
      {/* 题目显示 */}
      <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-lg p-4 mb-3">
        <p className="text-xs text-amber-500 mb-1">📝 题目</p>
        <div className="text-sm text-gray-800 leading-relaxed"><MathContent text={question} /></div>
      </div>

      {/* 画布 */}
      <div className="flex-1 bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width="700" height="400"
          onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerLeave={endDraw}
          className="w-full h-full touch-none cursor-crosshair" style={{ touchAction: "none" }}
        />
      </div>

      {/* 下方操作栏 */}
      <div className="flex items-center gap-2 mt-3">
        <textarea ref={textRef}
          placeholder="打字输入你的解题过程... (Ctrl+Enter)"
          className="flex-1 h-10 border rounded-lg p-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
          disabled={disabled} onKeyDown={e => { if ((e.ctrlKey||e.metaKey) && e.key==="Enter") handleSubmit(); }}
        />
        <button onClick={clearCanvas}
          className="px-3 py-2 border border-gray-200 text-gray-400 rounded-lg text-xs hover:bg-gray-50">
          清空
        </button>
        <button onClick={handleSubmit} disabled={disabled}
          className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
          {disabled ? "..." : "提交"}
        </button>
      </div>
    </div>
  );
}
