import { ValidationResult, ErrorTag } from "@/types";

// ============================================================================
// === 高中数学核心公式库 ===
// 设计原则：
// 1. 每个公式独立定义，自包含校验逻辑
// 2. 参数通过数组传递，索引对应公式定义的 params 字段
// 3. 错误识别尽可能具体（sign-error, substitution-error, calculation 等）
// 4. 数值容差默认 0.001，关键步骤可收紧到 0.0001
// ============================================================================

const DEFAULT_TOLERANCE = 0.001;

function ok(): ValidationResult {
  return { isCorrect: true, confidence: 1, hint: "" };
}

function fail(hint: string, errorTag?: ErrorTag, confidence = 0.8): ValidationResult {
  return { isCorrect: false, confidence, hint, errorTag };
}

function near(a: number, b: number, tol = DEFAULT_TOLERANCE) {
  return Math.abs(a - b) < tol;
}

// ============================================================================
// 一元二次方程
// ============================================================================

function validateDiscriminant(p: number[], student: number): ValidationResult {
  const [a, b, c] = p;
  const expected = b * b - 4 * a * c;
  if (near(student, expected)) return ok();
  // 常见错误：符号搞错（b²+4ac）
  if (near(student, b * b + 4 * a * c)) {
    return fail("判别式中间是减号：Δ = b² - 4ac，不是加号", "sign-error");
  }
  // 常见错误：漏掉平方（b-4ac）
  if (near(student, b - 4 * a * c)) {
    return fail("b 要平方：Δ = b² - 4ac", "formula-recall");
  }
  // 常见错误：代入时符号没注意（如 b=-2 时写成 (-2)²= -4）
  if (near(student, -b * b - 4 * a * c)) {
    return fail("注意：(-2)² = 4，不是 -4。负数平方是正数", "sign-error");
  }
  return fail("再检查一下判别式的代入和计算", "calculation");
}

function validateQuadraticRoot(p: number[], student: number): ValidationResult {
  const [a, b, c] = p;
  const d = b * b - 4 * a * c;
  if (d < 0) return fail("判别式小于 0，方程无实数根", "misconception");
  const sqrtD = Math.sqrt(d);
  const expected1 = (-b + sqrtD) / (2 * a);
  const expected2 = (-b - sqrtD) / (2 * a);
  if (near(student, expected1) || near(student, expected2)) return ok();
  // 常见错误：分母忘了乘2（-b±√Δ / a）
  if (near(student, (-b + sqrtD) / a) || near(student, (-b - sqrtD) / a)) {
    return fail("分母是 2a，不是 a", "formula-recall");
  }
  // 常见错误：前面没加负号（b±√Δ / 2a）
  if (near(student, (b + sqrtD) / (2 * a)) || near(student, (b - sqrtD) / (2 * a))) {
    return fail("分子开头是 -b，不要忘记负号", "sign-error");
  }
  return fail("再检查一下求根公式的代入", "substitution-error");
}

function validateVietaSum(p: number[], student: number): ValidationResult {
  const [a, b] = p;
  const expected = -b / a;
  if (near(student, expected)) return ok();
  if (near(student, b / a)) {
    return fail("韦达定理：x₁ + x₂ = -b/a，注意前面的负号", "sign-error");
  }
  return fail("再检查一下韦达定理的和", "formula-recall");
}

function validateVietaProduct(p: number[], student: number): ValidationResult {
  const [a, b, c] = p;
  const expected = c / a;
  if (near(student, expected)) return ok();
  if (near(student, -c / a)) {
    return fail("韦达定理：x₁ · x₂ = c/a，这里不需要负号", "sign-error");
  }
  return fail("再检查一下韦达定理的积", "formula-recall");
}

function validateVietaSquareSum(p: number[], student: number): ValidationResult {
  const [a, b, c] = p;
  const sum = -b / a;
  const product = c / a;
  const expected = sum * sum - 2 * product;
  if (near(student, expected)) return ok();
  // 常见错误：忘了减 2x₁x₂
  if (near(student, sum * sum)) {
    return fail("x₁²+x₂² = (x₁+x₂)² - 2x₁x₂，别忘了后面的 -2x₁x₂", "formula-recall");
  }
  // 常见错误：符号搞错（+2x₁x₂）
  if (near(student, sum * sum + 2 * product)) {
    return fail("公式里是减号：x₁²+x₂² = (x₁+x₂)² - 2x₁x₂", "sign-error");
  }
  return fail("再检查一下 x₁²+x₂² 的计算", "calculation");
}

// ============================================================================
// 基本不等式
// ============================================================================

function validateAmGm(p: number[], student: number): ValidationResult {
  const [a, b] = p; // a,b 为正数
  const expected = 2 * Math.sqrt(a * b);
  if (near(student, expected)) return ok();
  // 常见错误：忘了乘2
  if (near(student, Math.sqrt(a * b))) {
    return fail("基本不等式：a+b ≥ 2√(ab)，注意前面有个 2", "formula-recall");
  }
  // 常见错误：写成 a+b ≥ √(ab)
  if (near(student, Math.sqrt(a + b))) {
    return fail("基本不等式里是 √(ab)，不是 √(a+b)", "misconception");
  }
  return fail("再检查一下基本不等式的计算", "calculation");
}

// ============================================================================
// 指数对数
// ============================================================================

function validateLogChangeBase(p: number[], student: number): ValidationResult {
  const [a, b, c] = p; // log_a(b) = log_c(b)/log_c(a)
  if (c === 1 || c <= 0) return fail("换底时新底数必须大于0且不等于1", "misconception");
  const expected = Math.log(b) / Math.log(a);
  if (near(student, expected)) return ok();
  // 常见错误：分子分母写反
  if (near(student, Math.log(a) / Math.log(b))) {
    return fail("换底公式：logₐb = log_c(b) / log_c(a)，分子是 log_c(b)", "formula-recall");
  }
  return fail("再检查一下换底公式的计算", "calculation");
}

function validateExpProduct(p: number[], student: number): ValidationResult {
  const [a, m, n] = p; // a^m · a^n = a^(m+n)
  const expected = Math.pow(a, m + n);
  if (near(student, expected)) return ok();
  // 常见错误：指数相乘（a^(m·n)）
  if (near(student, Math.pow(a, m * n))) {
    return fail("同底数幂相乘，指数相加：aᵐ · aⁿ = aᵐ⁺ⁿ，不是相乘", "misconception");
  }
  return fail("再检查一下指数运算", "calculation");
}

// ============================================================================
// 三角函数
// ============================================================================

function validateSin2a(p: number[], student: number): ValidationResult {
  const [a] = p; // sin(2a) = 2sin(a)cos(a)
  const expected = 2 * Math.sin(a) * Math.cos(a);
  if (near(student, expected)) return ok();
  // 常见错误：写成 sin²a
  if (near(student, Math.sin(a) * Math.sin(a))) {
    return fail("sin(2α) = 2sinαcosα，不是 sin²α", "formula-recall");
  }
  return fail("再检查一下二倍角公式的计算", "calculation");
}

function validateCos2a(p: number[], student: number): ValidationResult {
  const [a] = p;
  const expected = Math.cos(a) * Math.cos(a) - Math.sin(a) * Math.sin(a);
  if (near(student, expected)) return ok();
  return fail("再检查一下 cos(2α) 的计算", "calculation");
}

function validateSinSum(p: number[], student: number): ValidationResult {
  const [a, b] = p; // sin(a+b) = sin(a)cos(b)+cos(a)sin(b)
  const expected = Math.sin(a) * Math.cos(b) + Math.cos(a) * Math.sin(b);
  if (near(student, expected)) return ok();
  // 常见错误：符号搞错 sin(a)cos(b)-cos(a)sin(b)
  if (near(student, Math.sin(a) * Math.cos(b) - Math.cos(a) * Math.sin(b))) {
    return fail("sin(α+β) = sinαcosβ + cosαsinβ，中间是加号", "sign-error");
  }
  return fail("再检查一下和角公式的计算", "calculation");
}

function validateCosSum(p: number[], student: number): ValidationResult {
  const [a, b] = p; // cos(a+b) = cos(a)cos(b)-sin(a)sin(b)
  const expected = Math.cos(a) * Math.cos(b) - Math.sin(a) * Math.sin(b);
  if (near(student, expected)) return ok();
  // 常见错误：符号搞错
  if (near(student, Math.cos(a) * Math.cos(b) + Math.sin(a) * Math.sin(b))) {
    return fail("cos(α+β) = cosαcosβ - sinαsinβ，中间是减号", "sign-error");
  }
  return fail("再检查一下和角公式的计算", "calculation");
}

function validateAuxiliaryAngle(p: number[], student: number): ValidationResult {
  const [a, b] = p; // asinα + bcosα = √(a²+b²) sin(α+φ)
  const expected = Math.sqrt(a * a + b * b);
  if (near(student, expected)) return ok();
  // 常见错误：忘了开根号
  if (near(student, a * a + b * b)) {
    return fail("辅助角公式：振幅是 √(a²+b²)，记得开根号", "formula-recall");
  }
  return fail("再检查一下辅助角公式的计算", "calculation");
}

// ============================================================================
// 向量
// ============================================================================

function validateDotProduct(p: number[], student: number): ValidationResult {
  const [x1, y1, x2, y2] = p; // a·b = x1x2 + y1y2
  const expected = x1 * x2 + y1 * y2;
  if (near(student, expected)) return ok();
  // 常见错误：写成 x1y2 + x2y1
  if (near(student, x1 * y2 + x2 * y1)) {
    return fail("向量点积：a·b = x₁x₂ + y₁y₂，是对应坐标相乘再相加", "formula-recall");
  }
  return fail("再检查一下向量点积的计算", "calculation");
}

function validateVectorModulus(p: number[], student: number): ValidationResult {
  const [x, y] = p; // |a| = √(x²+y²)
  const expected = Math.sqrt(x * x + y * y);
  if (near(student, expected)) return ok();
  // 常见错误：忘了开根号
  if (near(student, x * x + y * y)) {
    return fail("向量模长：|a| = √(x²+y²)，记得开根号", "formula-recall");
  }
  return fail("再检查一下向量模长的计算", "calculation");
}

// ============================================================================
// 数列
// ============================================================================

function validateArithmeticNth(p: number[], student: number): ValidationResult {
  const [a1, d, n] = p; // a_n = a_1 + (n-1)d
  const expected = a1 + (n - 1) * d;
  if (near(student, expected)) return ok();
  // 常见错误：写成 a1 + nd
  if (near(student, a1 + n * d)) {
    return fail("等差数列通项：aₙ = a₁ + (n-1)d，不是 a₁ + nd", "formula-recall");
  }
  return fail("再检查一下等差数列通项的计算", "substitution-error");
}

function validateArithmeticSum(p: number[], student: number): ValidationResult {
  const [a1, d, n] = p; // S_n = na_1 + n(n-1)d/2
  const expected = n * a1 + (n * (n - 1) * d) / 2;
  if (near(student, expected)) return ok();
  // 常见错误：分母忘除2
  if (near(student, n * a1 + n * (n - 1) * d)) {
    return fail("等差数列求和：Sₙ = na₁ + n(n-1)d/2，别忘了除以 2", "formula-recall");
  }
  return fail("再检查一下等差数列求和的计算", "calculation");
}

function validateGeometricNth(p: number[], student: number): ValidationResult {
  const [a1, q, n] = p; // a_n = a_1 · q^(n-1)
  const expected = a1 * Math.pow(q, n - 1);
  if (near(student, expected)) return ok();
  // 常见错误：写成 a1 · q^n
  if (near(student, a1 * Math.pow(q, n))) {
    return fail("等比数列通项：aₙ = a₁·qⁿ⁻¹，指数是 n-1 不是 n", "formula-recall");
  }
  return fail("再检查一下等比数列通项的计算", "substitution-error");
}

function validateGeometricSum(p: number[], student: number): ValidationResult {
  const [a1, q, n] = p; // S_n = a1(1-q^n)/(1-q), q≠1
  if (near(q, 1)) return fail("等比数列求和公式要求 q≠1", "misconception");
  const expected = (a1 * (1 - Math.pow(q, n))) / (1 - q);
  if (near(student, expected)) return ok();
  // 常见错误：分子分母写反
  if (near(student, (a1 * (1 - Math.pow(q, n))) / (q - 1))) {
    return fail("注意分母是 (1-q)，如果写成 (q-1) 需要整体加负号", "sign-error");
  }
  return fail("再检查一下等比数列求和的计算", "calculation");
}

// ============================================================================
// 导数
// ============================================================================

function validatePowerRule(p: number[], student: number): ValidationResult {
  const [n, x] = p; // (x^n)' = n·x^(n-1)，在 x 处的值
  const expected = n * Math.pow(x, n - 1);
  if (near(student, expected)) return ok();
  // 常见错误：指数没减1
  if (near(student, n * Math.pow(x, n))) {
    return fail("幂函数求导：(xⁿ)' = n·xⁿ⁻¹，指数要减 1", "formula-recall");
  }
  // 常见错误：系数忘乘 n
  if (near(student, Math.pow(x, n - 1))) {
    return fail("幂函数求导：(xⁿ)' = n·xⁿ⁻¹，前面要乘 n", "formula-recall");
  }
  return fail("再检查一下幂函数求导的计算", "calculation");
}

function validateDerivativeAtPoint(p: number[], student: number): ValidationResult {
  const [a, b, c, x0] = p; // f(x)=ax²+bx+c, f'(x0)=2ax0+b
  const expected = 2 * a * x0 + b;
  if (near(student, expected)) return ok();
  if (near(student, 2 * a * x0)) {
    return fail("f'(x) = 2ax + b，别忘了后面的 +b", "formula-recall");
  }
  return fail("再检查一下导数在某点的值", "substitution-error");
}

// ============================================================================
// 圆锥曲线
// ============================================================================

function validateEllipseEccentricity(p: number[], student: number): ValidationResult {
  const [a, b] = p; // e = c/a, c² = a²-b² (a>b>0)
  const c = Math.sqrt(a * a - b * b);
  const expected = c / a;
  if (near(student, expected)) return ok();
  // 常见错误：写成 c/b
  if (near(student, c / b)) {
    return fail("椭圆离心率 e = c/a，分母是长半轴 a", "formula-recall");
  }
  // 常见错误：忘了开根号 c²=a²-b²
  if (near(student, (a * a - b * b) / a)) {
    return fail("c² = a² - b²，所以 c = √(a²-b²)，记得开根号", "formula-recall");
  }
  return fail("再检查一下椭圆离心率的计算", "calculation");
}

function validateParabolaFocus(p: number[], student: number): ValidationResult {
  const [pVal] = p; // y²=2px 的焦点是 (p/2, 0)
  const expected = pVal / 2;
  if (near(student, expected)) return ok();
  if (near(student, pVal)) {
    return fail("抛物线 y²=2px 的焦点坐标是 (p/2, 0)，不是 (p, 0)", "formula-recall");
  }
  if (near(student, 2 * pVal)) {
    return fail("抛物线 y²=2px 的焦点坐标是 (p/2, 0)，不是 (2p, 0)", "formula-recall");
  }
  return fail("再检查一下抛物线焦点的计算", "calculation");
}

// ============================================================================
// 计数原理
// ============================================================================

function validatePermutation(p: number[], student: number): ValidationResult {
  const [n, m] = p; // A(n,m) = n!/(n-m)!
  let expected = 1;
  for (let i = 0; i < m; i++) expected *= (n - i);
  if (near(student, expected, 0.5)) return ok(); // 整数用 0.5 容差
  // 常见错误：写成 C(n,m) = n!/(m!(n-m)!)
  let comb = expected;
  for (let i = 2; i <= m; i++) comb /= i;
  if (near(student, comb, 0.5)) {
    return fail("这是排列 A(n,m) = n!/(n-m)!，不需要除以 m!。组合才需要除以 m!", "misconception");
  }
  return fail("再检查一下排列数的计算", "calculation");
}

function validateCombination(p: number[], student: number): ValidationResult {
  const [n, m] = p; // C(n,m) = n!/(m!(n-m)!)
  let num = 1, den = 1;
  for (let i = 0; i < m; i++) num *= (n - i);
  for (let i = 2; i <= m; i++) den *= i;
  const expected = num / den;
  if (near(student, expected, 0.5)) return ok();
  // 常见错误：写成排列
  let perm = num;
  if (near(student, perm, 0.5)) {
    return fail("这是组合 C(n,m) = n!/(m!(n-m)!)，记得除以 m!", "formula-recall");
  }
  return fail("再检查一下组合数的计算", "calculation");
}

// ============================================================================
// 公式注册表
// ============================================================================

export interface FormulaDef {
  name: string;
  formula: string;          // LaTeX 展示
  params: number;           // 需要几个参数
  validate: (params: number[], studentResult: number) => ValidationResult;
}

const FORMULAS: Record<string, FormulaDef> = {
  // 一元二次方程
  discriminant:     { name: "判别式",     formula: "\\Delta = b^2 - 4ac",              params: 3, validate: validateDiscriminant },
  quadraticRoot:    { name: "求根公式",   formula: "x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}", params: 3, validate: validateQuadraticRoot },
  vietaSum:         { name: "韦达和",     formula: "x_1 + x_2 = -\\frac{b}{a}",        params: 2, validate: validateVietaSum },
  vietaProduct:     { name: "韦达积",     formula: "x_1 \\cdot x_2 = \\frac{c}{a}",      params: 3, validate: validateVietaProduct },
  vietaSquareSum:   { name: "韦达平方和", formula: "x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2",  params: 3, validate: validateVietaSquareSum },

  // 基本不等式
  amGm:             { name: "基本不等式", formula: "a+b \\geq 2\\sqrt{ab}",              params: 2, validate: validateAmGm },

  // 指数对数
  logChangeBase:    { name: "换底公式",   formula: "\\log_a b = \\frac{\\log_c b}{\\log_c a}", params: 3, validate: validateLogChangeBase },
  expProduct:       { name: "指数乘法",   formula: "a^m \\cdot a^n = a^{m+n}",          params: 3, validate: validateExpProduct },

  // 三角函数
  sin2a:            { name: "sin二倍角",  formula: "\\sin(2\\alpha) = 2\\sin\\alpha\\cos\\alpha", params: 1, validate: validateSin2a },
  cos2a:            { name: "cos二倍角",  formula: "\\cos(2\\alpha) = \\cos^2\\alpha - \\sin^2\\alpha", params: 1, validate: validateCos2a },
  sinSum:           { name: "sin和角",    formula: "\\sin(\\alpha+\\beta)=\\sin\\alpha\\cos\\beta+\\cos\\alpha\\sin\\beta", params: 2, validate: validateSinSum },
  cosSum:           { name: "cos和角",    formula: "\\cos(\\alpha+\\beta)=\\cos\\alpha\\cos\\beta-\\sin\\alpha\\sin\\beta", params: 2, validate: validateCosSum },
  auxiliaryAngle:   { name: "辅助角",     formula: "a\\sin\\alpha+b\\cos\\alpha=\\sqrt{a^2+b^2}\\sin(\\alpha+\\varphi)", params: 2, validate: validateAuxiliaryAngle },

  // 向量
  dotProduct:       { name: "向量点积",   formula: "\\vec{a} \\cdot \\vec{b} = x_1x_2 + y_1y_2", params: 4, validate: validateDotProduct },
  vectorModulus:    { name: "向量模长",   formula: "|\\vec{a}| = \\sqrt{x^2+y^2}",       params: 2, validate: validateVectorModulus },

  // 数列
  arithmeticNth:    { name: "等差通项",   formula: "a_n = a_1 + (n-1)d",                params: 3, validate: validateArithmeticNth },
  arithmeticSum:    { name: "等差求和",   formula: "S_n = na_1 + \\frac{n(n-1)}{2}d",   params: 3, validate: validateArithmeticSum },
  geometricNth:     { name: "等比通项",   formula: "a_n = a_1 \\cdot q^{n-1}",           params: 3, validate: validateGeometricNth },
  geometricSum:     { name: "等比求和",   formula: "S_n = \\frac{a_1(1-q^n)}{1-q}",     params: 3, validate: validateGeometricSum },

  // 导数
  powerRule:        { name: "幂函数求导", formula: "(x^n)' = n\\cdot x^{n-1}",          params: 2, validate: validatePowerRule },
  derivativeAtPoint:{ name: "导数求值",   formula: "f'(x_0) = 2ax_0 + b",               params: 4, validate: validateDerivativeAtPoint },

  // 圆锥曲线
  ellipseEccentricity: { name: "椭圆离心率", formula: "e = \\frac{c}{a}, c^2=a^2-b^2",  params: 2, validate: validateEllipseEccentricity },
  parabolaFocus:    { name: "抛物线焦点", formula: "y^2=2px \\Rightarrow F(\\frac{p}{2},0)", params: 1, validate: validateParabolaFocus },

  // 计数原理
  permutation:      { name: "排列数",     formula: "A_n^m = \\frac{n!}{(n-m)!}",         params: 2, validate: validatePermutation },
  combination:      { name: "组合数",     formula: "C_n^m = \\frac{n!}{m!(n-m)!}",      params: 2, validate: validateCombination },
};

export function getFormula(key: string): FormulaDef | null {
  return FORMULAS[key] || null;
}

export function listFormulas(): { key: string; name: string; formula: string }[] {
  return Object.entries(FORMULAS).map(([key, f]) => ({ key, name: f.name, formula: f.formula }));
}

export function validateFormula(
  formulaKey: string,
  params: number[],
  studentResult: number
): ValidationResult {
  const formula = getFormula(formulaKey);
  if (!formula) {
    return { isCorrect: false, confidence: 0, hint: `未知公式: ${formulaKey}` };
  }
  return formula.validate(params, studentResult);
}

export default FORMULAS;
