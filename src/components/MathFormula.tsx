"use client";
import "katex/dist/katex.min.css";
import katex from "katex";
import { useMemo } from "react";

interface MathFormulaProps {
  formula: string;
  display?: boolean;
  className?: string;
}

export default function MathFormula({ formula, display = false, className = "" }: MathFormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        displayMode: display,
        throwOnError: false,
      });
    } catch {
      return `<span class="text-red-500">公式错误: ${formula}</span>`;
    }
  }, [formula, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
