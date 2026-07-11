import { ValidationResult, ErrorTag, EquationParams, ExerciseStep } from "@/types";
import { getFormula, validateFormula } from "./formulas";

const DEFAULT_TOLERANCE = 0.001;

/**
 * 从 EquationParams 和 ExerciseStep 中提取参数数组
 * 优先级：step.params > equation.{a,b,c,d,e}
 */
function extractParams(equation: EquationParams, step?: ExerciseStep): number[] {
  const src = step?.params ?? equation;
  const vals: number[] = [];
  if (src.a !== undefined) vals.push(src.a);
  if (src.b !== undefined) vals.push(src.b);
  if (src.c !== undefined) vals.push(src.c);
  if (src.d !== undefined) vals.push(src.d);
  if (src.e !== undefined) vals.push(src.e);
  return vals;
}

/**
 * 尝试从学生输入中提取数字
 * 支持：纯数字、带等号（如 "Δ=4"、"x=3"）、分数（如 "1/2"）
 */
function extractNumber(input: string): number | null {
  const s = input.trim();

  // 1. 直接解析数字
  const direct = parseFloat(s);
  if (!isNaN(direct) && s.match(/^-?\d+\.?\d*$/)) {
    return direct;
  }

  // 2. 等号右边（如 "Δ=4"、"x = 3"、"结果是 5"）
  const afterEqual = s.match(/[=＝]\s*(-?\d+\.?\d*)/);
  if (afterEqual) {
    const n = parseFloat(afterEqual[1]);
    if (!isNaN(n)) return n;
  }

  // 3. 最后一个数字（如 "4-4m>0 的解是 1"）
  const lastNum = s.match(/(-?\d+\.?\d*)\s*$/);
  if (lastNum) {
    const n = parseFloat(lastNum[1]);
    if (!isNaN(n)) return n;
  }

  // 4. 简单分数（如 "1/2"、"3/4"）
  const fraction = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    return parseFloat(fraction[1]) / parseFloat(fraction[2]);
  }

  return null;
}

// ============================================================================
// 公式文本校验（学生写出公式而不是数值时）
// ============================================================================

interface TextCheck {
  keywords: string[];           // 必须同时包含的关键词
  forbidden?: string[];         // 不能包含的关键词（常见错误模式）
  errorHint: string;            // 错误提示
  errorTag?: ErrorTag;
}

const TEXT_CHECKS: Record<string, TextCheck[]> = {
  discriminant: [
    {
      keywords: ["b", "4", "a", "c"],
      forbidden: ["+"],
      errorHint: "判别式公式是 Δ = b² - 4ac，注意中间是减号",
      errorTag: "sign-error",
    },
    {
      keywords: ["b", "4", "a", "c"],
      errorHint: "判别式公式是 Δ = b² - 4ac",
      errorTag: "formula-recall",
    },
  ],
  vietaSum: [
    {
      keywords: ["x", "b", "a"],
      forbidden: ["c"],
      errorHint: "韦达定理：x₁ + x₂ = -b/a，不要和积的公式搞混",
      errorTag: "misconception",
    },
    {
      keywords: ["x", "b", "a"],
      errorHint: "韦达定理：x₁ + x₂ = -b/a，注意前面的负号",
      errorTag: "formula-recall",
    },
  ],
  vietaProduct: [
    {
      keywords: ["x", "c", "a"],
      forbidden: ["b"],
      errorHint: "韦达定理：x₁ · x₂ = c/a，不要和和的公式搞混",
      errorTag: "misconception",
    },
    {
      keywords: ["x", "c", "a"],
      errorHint: "韦达定理：x₁ · x₂ = c/a",
      errorTag: "formula-recall",
    },
  ],
  amGm: [
    {
      keywords: ["2", "√", "sqrt", "根号"],
      forbidden: ["+", "加"],
      errorHint: "基本不等式：a+b ≥ 2√(ab)，根号里是 a 乘 b",
      errorTag: "misconception",
    },
    {
      keywords: ["2", "√", "sqrt", "根号"],
      errorHint: "基本不等式：a+b ≥ 2√(ab)，不要忘记前面的 2",
      errorTag: "formula-recall",
    },
  ],
  sin2a: [
    {
      keywords: ["sin", "cos", "2"],
      forbidden: ["^2", "²"],
      errorHint: "sin(2α) = 2sinαcosα，不是 sin²α",
      errorTag: "formula-recall",
    },
    {
      keywords: ["sin", "cos", "2"],
      errorHint: "sin(2α) = 2sinαcosα",
      errorTag: "formula-recall",
    },
  ],
  powerRule: [
    {
      keywords: ["x", "n", "-1"],
      forbidden: ["+1", "n+1"],
      errorHint: "幂函数求导：(xⁿ)' = n·xⁿ⁻¹，指数是 n-1",
      errorTag: "formula-recall",
    },
    {
      keywords: ["x", "n"],
      errorHint: "幂函数求导：(xⁿ)' = n·xⁿ⁻¹",
      errorTag: "formula-recall",
    },
  ],
};

function checkFormulaText(formulaKey: string, input: string): ValidationResult | null {
  const checks = TEXT_CHECKS[formulaKey];
  if (!checks) return null;

  const s = input.replace(/\s+/g, "").toLowerCase();

  for (const check of checks) {
    const hasAll = check.keywords.every((k) => s.includes(k.toLowerCase()));
    const hasForbidden = check.forbidden?.some((k) => s.includes(k.toLowerCase())) ?? false;

    if (hasAll && !hasForbidden) {
      // 通过了关键词检查 → 认为公式写对了
      return { isCorrect: true, confidence: 0.9, hint: "" };
    }
  }

  // 都没通过 → 返回第一个检查的错误提示（最可能的错误）
  return {
    isCorrect: false,
    confidence: 0.7,
    hint: checks[0].errorHint,
    errorTag: checks[0].errorTag,
  };
}

// ============================================================================
// 主校验入口
// ============================================================================

/**
 * 校验学生提交的步骤答案
 *
 * 校验优先级：
 * 1. 如果 step 有 formulaKey → 先尝试公式文本校验，再尝试数值校验
 * 2. 如果 step 有 expectedValue → 直接数值比对
 * 3. 否则 → 非空即通过（fallback 到 AI）
 */
export function validateStep(
  equation: EquationParams,
  step: ExerciseStep,
  studentAnswer: string
): ValidationResult {
  const tolerance = step.tolerance ?? DEFAULT_TOLERANCE;

  // ===== 情况 1：有 formulaKey → 先文本校验，再数值校验 =====
  if (step.formulaKey) {
    const formula = getFormula(step.formulaKey);
    if (!formula) {
      return {
        isCorrect: false,
        confidence: 0,
        hint: `系统暂不支持该公式校验：${step.formulaKey}`,
      };
    }

    // 1a. 尝试数值提取
    const num = extractNumber(studentAnswer);
    if (num !== null) {
      const params = extractParams(equation, step);
      // 参数数量检查
      if (params.length >= formula.params) {
        return validateFormula(step.formulaKey, params.slice(0, formula.params), num);
      }
      // 参数不够但 expectedValue 存在 → 用 expectedValue
      if (step.expectedValue !== undefined) {
        if (Math.abs(num - step.expectedValue) < tolerance) {
          return ok();
        }
        return fail("计算结果不对，再检查一下", "calculation");
      }
    }

    // 1b. 尝试公式文本校验
    const textResult = checkFormulaText(step.formulaKey, studentAnswer);
    if (textResult) return textResult;

    // 1c. 什么都没匹配到 → 宽松通过（让 AI 来判）
    if (studentAnswer.trim().length > 0) {
      return {
        isCorrect: true,
        confidence: 0.5,
        hint: "",
      };
    }
    return fail("请输入你的答案");
  }

  // ===== 情况 2：有 expectedValue → 数值比对 =====
  if (step.expectedValue !== undefined) {
    const num = extractNumber(studentAnswer);
    if (num !== null) {
      if (Math.abs(num - step.expectedValue) < tolerance) {
        return ok();
      }
      return fail("结果不对，再算一遍", "calculation");
    }
    // 无法提取数字但非空 → 宽松通过
    if (studentAnswer.trim().length > 0) {
      return { isCorrect: true, confidence: 0.5, hint: "" };
    }
    return fail("请输入你的答案");
  }

  // ===== 情况 3：无校验规则 → 非空即通过 =====
  if (studentAnswer.trim().length > 0) {
    return { isCorrect: true, confidence: 0.5, hint: "" };
  }
  return fail("请输入你的答案");
}

// ============================================================================
// 辅助函数
// ============================================================================

function ok(): ValidationResult {
  return { isCorrect: true, confidence: 1, hint: "" };
}

function fail(hint: string, errorTag?: ErrorTag): ValidationResult {
  return { isCorrect: false, confidence: 0.8, hint, errorTag };
}

/**
 * 兼容旧接口的快捷方法（用于直接校验数值）
 */
export function validateNumber(
  expected: number,
  studentAnswer: string,
  tolerance = DEFAULT_TOLERANCE
): ValidationResult {
  const num = extractNumber(studentAnswer);
  if (num !== null && Math.abs(num - expected) < tolerance) {
    return ok();
  }
  return fail("结果不对，再算一遍", "calculation");
}

export default { validateStep, validateNumber, extractNumber };
