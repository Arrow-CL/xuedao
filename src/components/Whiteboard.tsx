"use client";
import MathContent from "./MathContent";

interface Step { number: number; text: string; correct: boolean; comment?: string; source?: string; }

interface TeachingStep { number: number; text: string; }

interface Props {
  question: string;
  steps: Step[];
  year?: number;
  difficulty?: number;
  images?: string[];
  teachingSteps?: TeachingStep[];
  teachingVisibleCount?: number;
  errorGroup?: { fromStep: number; fromText: string; toStep: number; toText: string; guidance: string };
  ocrText?: string;
}

export default function Whiteboard({
  question, steps, year, difficulty,
  images, teachingSteps, teachingVisibleCount = 0,
  errorGroup, ocrText,
}: Props) {
  const maxStep = steps.length > 0 ? Math.max(...steps.map(s => s.number)) : 0;
  const helpSteps = steps.filter(s => s.source === 'help' || s.text.includes('Δ = b') || s.text.includes('下一步'));

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Question header */}
      <div className="bg-gradient-to-br from-amber-50/80 to-white border-b border-gray-100 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          <span className="text-[11px] font-medium text-amber-500 uppercase tracking-wider">题目</span>
        </div>
        <div className="text-sm text-gray-800 leading-relaxed">
          <MathContent text={question} />
        </div>
        {images && images.length > 0 && (
          <div className="mt-2 flex gap-2">
            {images.map((img, i) => (
              <img key={i} src={img} alt="" className="max-h-48 rounded border border-gray-200" />
            ))}
          </div>
        )}
      </div>

      {/* Steps area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {steps.length === 0 && !teachingSteps ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-2.5">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <p className="text-sm text-gray-300 mb-0.5">解答过程将展示在这里</p>
              <p className="text-xs text-gray-200">在右侧对话框中写下你的解题步骤</p>
            </div>
          </div>
        ) : (
          <>
            {/* Student steps */}
            {steps.length > 0 && maxStep > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-gray-400">你的解题过程 ({steps.length}步)</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-green-500">✓ {steps.filter(s => s.correct).length}</span>
                  {steps.some(s => !s.correct) && (
                    <span className="text-xs text-red-400">✗ {steps.filter(s => !s.correct).length}</span>
                  )}
                </div>
              </div>
            )}
            {steps.map((step, i) => (
              <div key={i}
                className={"rounded-lg border-l-4 p-3.5 transition-colors " + (
                  step.correct
                    ? step.source === 'help'
                      ? "bg-amber-50/70 border-l-amber-400"
                      : "bg-green-50/70 border-l-green-400"
                    : "bg-red-50/70 border-l-red-400"
                )}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={"inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold " + (
                    step.correct
                      ? step.source === 'help'
                        ? "bg-amber-200 text-amber-700"
                        : "bg-green-200 text-green-700"
                      : "bg-red-200 text-red-700"
                  )}>
                    {i + 1}
                  </span>
                  {step.source === 'help' ? (
                    <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      引导步骤
                    </span>
                  ) : step.correct ? (
                    <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      正确
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      有误
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-800 leading-relaxed">
                  <MathContent text={step.text} />
                </div>
                {step.comment && (
                  <div className="mt-1.5 text-xs text-red-500 bg-red-50 rounded px-2 py-1">
                    {step.comment}
                  </div>
                )}
              </div>
            ))}

            {/* Teaching steps (from help) */}
            {teachingSteps && teachingSteps.length > 0 && (
              <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs text-amber-500">详解过程（逐步展示）</span>
                </div>
                {teachingSteps.slice(0, teachingVisibleCount).map((ts, i) => (
                  <div key={i} className="rounded-lg bg-amber-50/50 border-l-4 border-l-amber-300 p-3 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-200 text-amber-700 text-[10px] font-semibold">
                        {ts.number}
                      </span>
                    </div>
                    <div className="text-sm text-gray-800 leading-relaxed">
                      <MathContent text={ts.text} />
                    </div>
                  </div>
                ))}
                {teachingVisibleCount < teachingSteps.length && (
                  <div className="text-center py-2">
                    <span className="inline-block w-4 h-4 border-2 border-amber-200 border-t-amber-400 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* OCR text preview */}
        {ocrText && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-600 border border-blue-100">
            <span className="font-medium">识别到内容：</span>{ocrText}
          </div>
        )}
      </div>

      {year && (
        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>{year}年高考真题</span>
          <span className="inline-flex gap-0.5">
            {Array.from({length:5},(_,i)=>(
              <span key={i} className={i < (difficulty || 1) ? "text-amber-400" : "text-gray-200"}>★</span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
