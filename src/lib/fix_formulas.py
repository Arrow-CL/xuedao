import { ValidationResult } from "@/types";

// === 硬编码公式库：所有公式判断不依赖 AI ===
const FORMULAS = {
  discriminant: {
    name: "判别式",
    formula: "\\Delta = b^2 - 4ac",
    validate(a: number, b: number, c: number, studentResult: number): ValidationResult {
      const expected = b * b - 4 * a * c;
      return compareNumeric(studentResult, expected);
    },
  },
  quadraticRoot: {
    name: "求根公式",
    formula: "x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}",
    validate(a: number, b: number, discriminant: number, studentRoots: [number, number]): ValidationResult {
      const sqrtD = Math.sqrt(discriminant);
      const expected1 = (-b + sqrtD) / (2 * a);
      const expected2 = (-b - sqrtD) / (2 * a);
      const r1 = compareNumeric(studentRoots[0], expected1);
      const r2 = compareNumeric(studentRoots[1], expected2);
      if (r1.isCorrect && r2.isCorrect) return { isCorrect: true, confidence: 1, hint: "" };
      if (!r1.isCorrect && !r2.isCorrect) return { isCorrect: false, confidence: 0.8, hint: "两个根都不对，再检查一下代入" };
      return { isCorrect: false, confidence: 0.6, hint: "有一个根不对，检查正负号" };
    },
  },
  vietaSum: {
    name: "韦达定理（和）",
    formula: "x_1 + x_2 = -\\frac{b}{a}",
    validate(a: number, b: number, _c: number, studentResult: number | [number, number]): ValidationResult {
      const expected = -b / a;
      return compareNumeric(studentResult, expected);
    },
  },
  vietaProduct: {
    name: "韦达定理（积）",
    formula: "x_1 \\cdot x_2 = \\frac{c}{a}",
    validate(a: number, _b: number, c: number, studentResult: number | [number, number]): ValidationResult {
      const expected = c / a;
      return compareNumeric(studentResult, expected);
    },
  },
};

function compareNumeric(input: number, expected: number): ValidationResult {
  const diff = Math.abs(input - expected);
  if (diff < 0.001) {
    return { isCorrect: true, confidence: 1, hint: "" };
  }
  return { isCorrect: false, confidence: 0.8, hint: "再检查一下代入过程" };
}

export function getFormula(key: string) {
  return FORMULAS[key as keyof typeof FORMULAS] || null;
}

export function validateFormula(
  formulaKey: string,
  a: number,
  b: number,
  c: number,
  studentResult: any
): ValidationResult {
  const formula = getFormula(formulaKey);
  if (!formula) {
    return { isCorrect: false, confidence: 0, hint: "未知公式" };
  }
  return formula.validate(a, b, c, studentResult as never);
}

export default FORMULAS;
