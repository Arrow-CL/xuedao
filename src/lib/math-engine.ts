/**
 * 数学引擎 - 本地数学表达式处理核心
 * 不依赖AI，纯代码实现：解析、标准化、等价判断、数值计算、解方程
 */
import { create, all, MathNode } from 'mathjs';

const math = create(all);

// 配置mathjs
math.config({
  number: 'number',
  predictable: true,
});

// === 表达式标准化 ===
// 把学生各种写法的数学表达式统一成标准形式

const NORMALIZATION_RULES: [RegExp, string][] = [
  // 中文字符/全角符号转半角
  [/（/g, '('], [/）/g, ')'],
  [/，/g, ','], [/：/g, ':'],
  [/＋/g, '+'], [/－/g, '-'], [/＊/g, '*'], [/／/g, '/'],
  [/＝/g, '='], [/＜/g, '<'], [/＞/g, '>'],
  [/≤/g, '<='], [/≥/g, '>='], [/≠/g, '!='],
  // 乘号变体统一
  [/×/g, '*'], [/·/g, '*'], [/•/g, '*'],
  // 除号变体
  [/÷/g, '/'],
  // 平方/立方/上标数字
  [/²/g, '^2'], [/³/g, '^3'],
  [/⁴/g, '^4'], [/⁵/g, '^5'],
  // 希腊字母变体
  [/△/g, 'Delta'], [/Δ/g, 'Delta'], [/delta/gi, 'Delta'],
  [/π/g, 'pi'], [/pi\b/gi, 'pi'],
  // 根号变体
  [/√\(/g, 'sqrt('], [/√(\d)/g, 'sqrt($1)'], [/√([a-zA-Z])/g, 'sqrt($1)'],
  [/根号/g, 'sqrt'],
  // 不等号变体
  [/大于等于/g, '>='], [/小于等于/g, '<='],
  [/大于/g, '>'], [/小于/g, '<'],
  [/不等于/g, '!='],
  // 下标变量 x1, x2 → x_1, x_2（学生常直接打x1）
  // 特殊处理韦达定理常见写法
  [/x1/g, 'x_1'], [/x2/g, 'x_2'],
  // 常见数学短语
  [/判别式|Delta\s*=/gi, ''],
  // 清理空白
  [/\s+/g, ''],
];

/**
 * 预处理学生输入的数学表达式，统一格式
 */
export function normalizeExpression(raw: string): string {
  let s = raw.trim();
  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

/**
 * 从学生的自由文本输入中提取数学表达式
 * 支持格式：
 * - "Δ = b²-4ac = 4-8 = -4" → ["b^2-4*a*c", "4-8", "-4"]
 * - "因为a=1,b=2,c=1" → ["a=1", "b=2", "c=1"]
 * - "x = (-b±√Δ)/2a = (-2±2)/2 = 0或-2" → ["(-b+sqrt(Delta))/(2*a)", "(-2+2)/2", "0", "(-b-sqrt(Delta))/(2*a)", "(-2-2)/2", "-2"]
 */
export function extractExpressions(text: string): string[] {
  const normalized = normalizeExpression(text);
  const expressions: string[] = [];

  // 先按等号链分割：a = b = c → ["a", "b", "c"]
  // 但要注意 >= <= != 这些组合符号里的等号不能分割
  // 先保护 >= <= !=
  let protected_ = normalized
    .replace(/>=/g, '___GE___')
    .replace(/<=/g, '___LE___')
    .replace(/!=/g, '___NE___');

  // 按"="号分割
  const eqParts = protected_.split('=');
  for (const part of eqParts) {
    const restored = part
      .replace(/___GE___/g, '>=')
      .replace(/___LE___/g, '<=')
      .replace(/___NE___/g, '!=')
      .trim();
    if (restored) {
      // 对每个部分再按中文连接词分割
      const subParts = restored
        .split(/[,，;；。]|或|和|与|并且|所以|因此|故|则|即|得|得到|解得|求出|等于|为是/g)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      expressions.push(...subParts);
    }
  }

  // 过滤掉明显不是数学表达式的纯文字（简单启发式：必须包含数字、字母变量、或运算符）
  const mathLike = expressions.filter(expr => {
    return /[\d]|[a-zA-Z]|[+\-*/^()]/.test(expr) && expr.length <= 200;
  });

  return mathLike.length > 0 ? mathLike : expressions.filter(e => e.trim().length > 0);
}

/**
 * 判断一个字符串是否是纯数值
 */
export function isNumeric(s: string): boolean {
  const normalized = normalizeExpression(s);
  const n = Number(normalized);
  return !isNaN(n) && isFinite(n);
}

/**
 * 安全解析数学表达式，返回MathNode或null
 */
export function safeParse(expr: string): MathNode | null {
  try {
    const normalized = normalizeExpression(expr);
    // 自动补乘号：2a → 2*a, 2(a+b) → 2*(a+b), (a)(b) → (a)*(b)
    const withImplicitMul = addImplicitMultiplication(normalized);
    return math.parse(withImplicitMul);
  } catch {
    return null;
  }
}

/**
 * 自动补全隐式乘法：2a → 2*a, (a)(b) → (a)*(b)
 */
function addImplicitMultiplication(expr: string): string {
  let result = expr;
  // 数字接字母/括号: 2a → 2*a, 2(x+1) → 2*(x+1)
  result = result.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
  // 括号接字母/数字/括号: )x → )*x, (a)2 → (a)*2, )( → )*(
  result = result.replace(/\)([a-zA-Z\d(])/g, ')*$1');
  // 字母接括号: x( → x*(, a(b → a*(b  （但注意函数名如sqrt(, sin( 不替换）
  const functions = new Set(['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'abs', 'pow', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh']);
  result = result.replace(/([a-zA-Z])(\()/g, (match, letter, paren) => {
    // 检查前面是否是函数名
    const beforeMatch = result.substring(0, result.indexOf(match));
    for (const fn of functions) {
      if (beforeMatch.endsWith(fn) || letter === fn.charAt(fn.length - 1) && beforeMatch.endsWith(fn.slice(0, -1))) {
        return match;
      }
    }
    // 单个字母变量接括号 → 补乘号
    if (/^[a-zA-Z]$/.test(letter) && !functions.has(letter)) {
      return letter + '*' + paren;
    }
    return match;
  });
  return result;
}

/**
 * 两个表达式是否数学上等价
 * 使用策略：
 * 1. 如果都是数值，直接比较数值（容差0.001）
 * 2. 如果包含变量，尝试代入多组随机值比较数值结果
 * 3. 尝试符号化简后比较
 */
export function isEquivalent(expr1: string, expr2: string, vars?: string[]): boolean {
  const n1 = normalizeExpression(expr1);
  const n2 = normalizeExpression(expr2);

  if (n1 === n2) return true;

  // 数值比较
  const num1 = Number(n1);
  const num2 = Number(n2);
  if (!isNaN(num1) && !isNaN(num2)) {
    return Math.abs(num1 - num2) < 0.001;
  }

  const node1 = safeParse(n1);
  const node2 = safeParse(n2);
  if (!node1 || !node2) return false;

  try {
    // 方法1：符号化简比较
    const simplified1 = math.simplify(node1).toString();
    const simplified2 = math.simplify(node2).toString();
    if (simplified1 === simplified2) return true;

    // 方法2：代入多组随机数值比较
    const variables = vars || detectVariables(node1, node2);
    if (variables.length > 0 && variables.length <= 5) {
      return numericEquivalenceCheck(node1, node2, variables);
    }

    // 方法3：化简后再比较一次
    const s1 = math.simplify(node1.toString());
    const s2 = math.simplify(node2.toString());
    return s1.equals(s2);
  } catch {
    return false;
  }
}

/**
 * 通过代入随机数值验证两个表达式是否等价
 */
function numericEquivalenceCheck(node1: MathNode, node2: MathNode, variables: string[]): boolean {
  const TEST_COUNT = 8;
  const compiled1 = node1.compile();
  const compiled2 = node2.compile();

  for (let i = 0; i < TEST_COUNT; i++) {
    const scope: Record<string, number> = {};
    for (const v of variables) {
      // 用非0、非1、非整数的随机值，避免巧合
      scope[v] = 2.37 + i * 1.73 + Math.random() * 3.14;
    }
    try {
      const v1 = compiled1.evaluate(scope);
      const v2 = compiled2.evaluate(scope);
      if (typeof v1 !== 'number' || typeof v2 !== 'number') return false;
      if (!isFinite(v1) || !isFinite(v2)) continue;
      const diff = Math.abs(v1 - v2);
      const scale = Math.max(Math.abs(v1), Math.abs(v2), 1);
      if (diff / scale > 0.001) return false;
    } catch {
      continue;
    }
  }
  return true;
}

/**
 * 检测表达式中出现的变量
 */
function detectVariables(...nodes: MathNode[]): string[] {
  const vars = new Set<string>();
  for (const node of nodes) {
    node.traverse((n) => {
      if (n.type === 'SymbolNode') {
        const name = (n as any).name;
        // 排除内置常量和函数
        if (!['pi', 'e', 'sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'abs', 'pow', 'asin', 'acos', 'atan'].includes(name)) {
          vars.add(name);
        }
      }
    });
  }
  return Array.from(vars);
}

/**
 * 计算表达式的数值结果
 */
export function evaluateExpression(expr: string, scope?: Record<string, number>): number | null {
  try {
    const normalized = normalizeExpression(expr);
    const withMul = addImplicitMultiplication(normalized);
    const node = math.parse(withMul);
    const result = node.evaluate(scope || {});
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result * 1000000) / 1000000;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 解一元二次方程 ax² + bx + c = 0
 * 返回两个根（可能相等），或null如果无实根
 */
export function solveQuadratic(a: number, b: number, c: number): { roots: [number, number]; delta: number } | null {
  if (Math.abs(a) < 1e-10) {
    // 退化为一元一次方程 bx + c = 0
    if (Math.abs(b) < 1e-10) return null;
    const root = -c / b;
    return { roots: [root, root], delta: 0 };
  }
  const delta = b * b - 4 * a * c;
  if (delta < -1e-10) return null; // 无实根
  const sqrtDelta = Math.sqrt(Math.max(0, delta));
  const x1 = (-b + sqrtDelta) / (2 * a);
  const x2 = (-b - sqrtDelta) / (2 * a);
  return { roots: [x1, x2], delta };
}

/**
 * 解一元一次方程 ax + b = 0
 */
export function solveLinear(a: number, b: number): number | null {
  if (Math.abs(a) < 1e-10) return null;
  return -b / a;
}

/**
 * 检测常见错误模式
 * 返回错误类型和提示，或null表示未检测到特定错误
 */
export interface MathError {
  type: string;
  hint: string;
  confidence: number;
}

export function detectCommonErrors(
  studentExpr: string,
  expectedExpr: string,
  context?: { a?: number; b?: number; c?: number; stage?: string }
): MathError | null {
  const s = normalizeExpression(studentExpr);
  const e = normalizeExpression(expectedExpr);

  if (!s || !e) return null;

  // 错误1：符号错误（正负号搞反）
  // 尝试把所有正负号翻转后比较
  const flipped = s
    .replace(/\+/g, '___PLUS___')
    .replace(/-/g, '+')
    .replace(/___PLUS___/g, '-');
  if (isEquivalent(flipped, e)) {
    return {
      type: 'sign-error',
      hint: '注意正负号哦，这里好像符号搞反了～再检查一下',
      confidence: 0.85,
    };
  }

  // 错误2：判别式写成 b²+4ac（应该是减号）
  if (context?.stage === 'discriminant' && /b\^?2.*\+.*4.*a.*c/.test(s.replace(/\s/g, ''))) {
    return {
      type: 'sign-error',
      hint: '判别式是 b² - 4ac，中间是减号不是加号哦',
      confidence: 0.9,
    };
  }

  // 错误3：韦达定理和忘加负号（-b/a写成b/a）
  if (context?.stage === 'vieta-sum' && /b\s*\/\s*a/.test(s) && !/-/.test(s)) {
    return {
      type: 'sign-error',
      hint: '韦达定理的两根之和是 -b/a，b前面有个负号别忘了',
      confidence: 0.85,
    };
  }

  // 错误4：求根公式分母写成a（应该是2a）
  if (context?.stage === 'quadratic-formula' && /\/\s*a(?!\d)/.test(s) && !/\/\s*2a/.test(s)) {
    return {
      type: 'coefficient-error',
      hint: '求根公式的分母是 2a 哦，不是a，再想想～',
      confidence: 0.8,
    };
  }

  // 错误5：漏了平方（b2写成b2但不是b^2或b²）
  if (/(?<![a-zA-Z])b2(?![a-zA-Z\d])/.test(s) && !/b\^2|b²/.test(s)) {
    return {
      type: 'missing-power',
      hint: '这里的b应该是b的平方哦，b²，不是b×2',
      confidence: 0.75,
    };
  }

  // 错误6：系数错误（4ac写成2ac或ac）
  if (/(?<!\d)ac/.test(s) && !/4ac/.test(s) && !/2ac/.test(s) && expectedExpr.includes('4ac')) {
    return {
      type: 'coefficient-error',
      hint: 'ac前面的系数是4哦，是4ac不是ac',
      confidence: 0.7,
    };
  }

  // 错误7：数值计算偏差（接近但不对，比如少了个0）
  const studentVal = evaluateExpression(s);
  const expectedVal = evaluateExpression(e);
  if (studentVal !== null && expectedVal !== null) {
    const ratio = Math.abs(studentVal / expectedVal);
    if (Math.abs(ratio - 1) > 0.01 && Math.abs(ratio - 10) < 0.1) {
      return {
        type: 'decimal-error',
        hint: '数值差了一个数量级，是不是小数点位置搞错了？',
        confidence: 0.6,
      };
    }
    if (Math.abs(studentVal - expectedVal) > 0.001 && Math.abs(studentVal + expectedVal) < 0.001) {
      return {
        type: 'sign-error',
        hint: '结果的正负号好像反了，再检查一下',
        confidence: 0.8,
      };
    }
  }

  return null;
}

/**
 * 生成讲解：上一步是怎么得到下一步的
 * 根据变换类型自动生成解释
 */
export function explainStep(fromExpr: string, toExpr: string, operation?: string): string {
  const f = normalizeExpression(fromExpr);
  const t = normalizeExpression(toExpr);

  // 数值代入计算
  const fVal = evaluateExpression(f);
  const tVal = evaluateExpression(t);
  if (fVal !== null && tVal !== null) {
    return `把数值代入计算：${f} = ${tVal}。`;
  }

  // 代数化简
  if (operation === 'simplify') {
    return `化简：将 ${f} 合并同类项，得到 ${t}。`;
  }

  if (operation === 'substitute') {
    return `将已知条件代入 ${f}，得到 ${t}。`;
  }

  if (operation === 'solve') {
    return `解方程，得到 ${t}。`;
  }

  if (operation === 'factor') {
    return `因式分解：${f} = ${t}。`;
  }

  if (operation === 'expand') {
    return `展开：${f} = ${t}。`;
  }

  return `由上一步 ${f}，可以得到 ${t}。`;
}

export default math;
