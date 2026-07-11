/**
 * 解题轨迹引擎 - 核心大脑
 * 职责：
 * 1. 解析学生输入，提取数学步骤
 * 2. 分析学生过程到哪一步了，是否有错误
 * 3. 检测到错误时，指出"上一步到这一步怎么来的"
 * 4. 学生卡住时，本地续写解题过程（能算的算，算不了的才交给AI）
 * 5. 大幅减少AI调用：本地能判断的绝不调AI
 */
import {
  normalizeExpression,
  extractExpressions,
  isNumeric,
  evaluateExpression,
  isEquivalent,
  solveQuadratic,
  solveLinear,
  detectCommonErrors,
  MathError,
} from './math-engine';
import {
  ParsedStep,
  SolutionTrace,
  StepAnalysisResult,
  ContinuationResult,
  ErrorTag,
} from '@/types';

let stepIdCounter = 0;
function nextStepId(): string {
  return `step-${Date.now()}-${++stepIdCounter}`;
}

/**
 * 创建一个新的解题轨迹
 */
export function createSolutionTrace(questionId: string, questionText: string, questionType?: string): SolutionTrace {
  const knownParams = extractKnownParams(questionText);
  return {
    questionId,
    questionText,
    questionType,
    knownParams,
    derivedVars: {},
    steps: [],
    completed: false,
    aiCallCount: 0,
  };
}

/**
 * 从题目文本中提取已知参数
 * 例如 "方程 x²-2x+m=0" → 尝试识别a=1,b=-2,c=m
 * "方程2x²-4x+1=0" → a=2,b=-4,c=1
 */
function extractKnownParams(text: string): Record<string, number> {
  const params: Record<string, number> = {};

  // 识别标准一元二次方程 ax²+bx+c=0 形式
  // 先找 x² 项的系数
  const quadMatch = text.match(/(-?\d*)\s*x[²\^2]/);
  if (quadMatch) {
    const coef = quadMatch[1];
    params.a = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseInt(coef, 10);
  }

  // 找x项系数（避免匹配到x²项）
  const linearMatch = text.match(/([+-]?\s*\d+)\s*x(?!²|\^2|[²\^2])/);
  if (linearMatch) {
    const coef = linearMatch[1].replace(/\s/g, '');
    params.b = parseInt(coef, 10);
  } else {
    // 检查是否有 -x 或 +x 形式
    if (/[-]\s*x(?!²|\^2)/.test(text)) params.b = -1;
    else if (/[+]\s*x(?!²|\^2)/.test(text)) params.b = 1;
  }

  // 找常数项
  // 先尝试找等号后面的值，把方程整理为标准形式
  const eqMatch = text.match(/=\s*(-?\d+)/);
  if (eqMatch) {
    const rhs = parseInt(eqMatch[1], 10);
    // 常数项需要减去等号右边的值
    const constMatch = text.match(/([+-]?\s*\d+)(?!\s*[x\*a-zA-Z])/g);
    if (constMatch) {
      // 取最后一个数字作为常数项（近似）
      const last = constMatch[constMatch.length - 1].replace(/\s/g, '');
      const cVal = parseInt(last, 10);
      params.c = cVal - rhs;
    }
  } else {
    const constMatch = text.match(/([+-]\s*\d+)(?!\s*[x\*a-zA-Z])(?!\s*=)/);
    if (constMatch) {
      params.c = parseInt(constMatch[1].replace(/\s/g, ''), 10);
    }
  }

  return params;
}

/**
 * 解析学生输入，创建一个 ParsedStep
 */
export function parseStudentInput(raw: string): ParsedStep {
  const expressions = extractExpressions(raw);
  // 提取非数学的文字部分
  const mathParts = expressions.join('|');
  let textExplanation = raw;
  for (const expr of expressions) {
    textExplanation = textExplanation.replace(expr, '');
  }
  textExplanation = textExplanation.replace(/[=+\-*/^(),，。；]|或|和|的|是|为|得|即|故/g, '').trim();

  return {
    id: nextStepId(),
    raw: raw.trim(),
    expressions,
    textExplanation,
    status: 'pending',
    verifiedBy: 'none',
    confidence: 0,
    timestamp: Date.now(),
  };
}

/**
 * 分析学生最新输入的步骤，判断对错和进度
 * 这是最核心的函数：尽量本地判断，减少AI调用
 */
export function analyzeStep(
  trace: SolutionTrace,
  newStep: ParsedStep
): StepAnalysisResult {
  const result: StepAnalysisResult = {
    hasError: false,
    isCorrect: false,
    isComplete: false,
    confidence: 0,
    needAI: false,
    progress: 0,
  };

  if (newStep.expressions.length === 0) {
    // 纯文字，无法本地判断
    result.needAI = true;
    result.confidence = 0;
    return result;
  }

  // 获取已知参数和已推导出的变量
  const scope = { ...trace.knownParams, ...trace.derivedVars };
  const lastExpr = newStep.expressions[newStep.expressions.length - 1];
  const numericVal = evaluateExpression(lastExpr, scope);

  // 策略1：检查数值是否和已知参数一致
  // 学生做的是代入计算，检查结果对不对
  if (numericVal !== null) {
    // 检查是否是正确的中间结果
    // 对于一元二次方程，检查判别式
    if (trace.knownParams.a !== undefined && trace.knownParams.b !== undefined && trace.knownParams.c !== undefined) {
      const a = trace.knownParams.a;
      const b = trace.knownParams.b;
      const c = trace.knownParams.c;
      const expectedDelta = b * b - 4 * a * c;

      // 判断学生是否在计算判别式
      const lastExprLower = lastExpr.toLowerCase();
      const computingDelta = /delta|判别式|b\s*[²\^]?\s*2?\s*-\s*4\s*\*?\s*a\s*\*?\s*c/.test(lastExprLower)
        || newStep.raw.includes('Δ') || newStep.raw.includes('判别式');

      if (computingDelta || (trace.steps.length <= 1 && Math.abs(numericVal - expectedDelta) < 0.001)) {
        // 判别式计算正确
        result.isCorrect = true;
        result.confidence = 0.95;
        result.derivedVars = { Delta: expectedDelta, delta: expectedDelta };
        result.progress = 0.3;
        return result;
      }

      // 判别式错误检测
      if (computingDelta || (trace.steps.length <= 1 && isDiscriminantStage(trace))) {
        const commonError = detectCommonErrors(lastExpr, String(expectedDelta), {
          a, b, c, stage: 'discriminant',
        });
        if (commonError) {
          result.hasError = true;
          result.errorStep = newStep;
          result.errorType = commonError.type;
          result.localHint = commonError.hint;
          result.confidence = commonError.confidence;
          return result;
        }
        // 数值不对但没检测到具体错误模式
        if (Math.abs(numericVal - expectedDelta) > 0.001) {
          result.hasError = true;
          result.errorStep = newStep;
          result.errorType = 'calculation';
          result.localHint = `判别式计算好像有问题。Δ = b²-4ac，代入a=${a},b=${b},c=${c}，你再算一下？`;
          result.confidence = 0.7;
          return result;
        }
      }

      // 检查是否是求根结果
      if (trace.derivedVars.Delta !== undefined || trace.derivedVars.delta !== undefined) {
        const delta = trace.derivedVars.Delta ?? trace.derivedVars.delta;
        if (delta >= 0) {
          const sqrtDelta = Math.sqrt(delta);
          const expectedX1 = (-b + sqrtDelta) / (2 * a);
          const expectedX2 = (-b - sqrtDelta) / (2 * a);

          // 检查学生是否得到了正确的根
          if (Math.abs(numericVal - expectedX1) < 0.001 || Math.abs(numericVal - expectedX2) < 0.001) {
            result.isCorrect = true;
            result.confidence = 0.9;
            result.progress = 0.8;
            // 检查是否两个根都求出来了
            const foundRoots = newStep.expressions.filter(e => {
              const v = evaluateExpression(e, scope);
              return v !== null && (Math.abs(v - expectedX1) < 0.001 || Math.abs(v - expectedX2) < 0.001);
            });
            if (foundRoots.length >= 2 || (delta === 0 && Math.abs(numericVal - expectedX1) < 0.001)) {
              result.isComplete = true;
              result.progress = 1;
              result.derivedVars = { x1: expectedX1, x2: expectedX2, ...result.derivedVars };
            }
            return result;
          }
        }
      }

      // 韦达定理检查
      if (/x1.*x2|x_1.*x_2|两根之和|两根之积|韦达/.test(newStep.raw)) {
        const expectedSum = -b / a;
        const expectedProduct = c / a;

        if (Math.abs(numericVal - expectedSum) < 0.001) {
          result.isCorrect = true;
          result.confidence = 0.9;
          result.derivedVars = { x1_plus_x2: expectedSum };
          result.progress = 0.5;
          return result;
        }
        if (Math.abs(numericVal - expectedProduct) < 0.001) {
          result.isCorrect = true;
          result.confidence = 0.9;
          result.derivedVars = { x1_times_x2: expectedProduct };
          result.progress = 0.5;
          return result;
        }
      }
    }

    // 通用数值检查：和上一步的关系
    // 如果上一步是表达式，这一步是数值，检查计算是否正确
    if (trace.steps.length > 0) {
      const lastStep = trace.steps[trace.steps.length - 1];
      if (lastStep.expressions.length > 0) {
        const prevExpr = lastStep.expressions[lastStep.expressions.length - 1];
        const prevVal = evaluateExpression(prevExpr, scope);
        if (prevVal !== null && Math.abs(numericVal - prevVal) < 0.001) {
          result.isCorrect = true;
          result.confidence = 0.85;
          return result;
        }
      }
    }

    // 纯数值但无法确认是否正确（可能是对的中间结果）
    // 如果是最后一步的结果，和答案比对需要题目答案数据支持
    result.isCorrect = true; // 暂时认为计算正确（数值本身能算出来）
    result.confidence = 0.4; // 低置信度，后续可能需要AI确认
    result.needAI = false; // 不需要AI，数值是有效计算结果
    return result;
  }

  // 策略2：公式表达式检查（符号表达式）
  // 检查学生写的公式是否正确
  if (lastExpr) {
    // 判别式公式识别
    if (/b\^?2|b²/.test(lastExpr)) {
      // 检查是不是 b^2-4ac 的变体
      const hasMinus = lastExpr.includes('-');
      const has4ac = /4\s*\*?\s*a\s*\*?\s*c/.test(lastExpr);
      if (/b\^?2\s*-\s*4\s*\*?\s*a\s*\*?\s*c/.test(lastExpr.replace(/\s/g, ''))) {
        result.isCorrect = true;
        result.confidence = 0.95;
        result.progress = 0.2;
        return result;
      }
      if (/b\^?2\s*\+\s*4\s*\*?\s*a\s*\*?\s*c/.test(lastExpr.replace(/\s/g, ''))) {
        result.hasError = true;
        result.errorStep = newStep;
        result.errorType = 'sign-error';
        result.localHint = '判别式是 b² - 4ac，中间是减号不是加号哦～';
        result.confidence = 0.9;
        return result;
      }
      if (hasMinus && !has4ac) {
        result.hasError = true;
        result.errorStep = newStep;
        result.errorType = 'coefficient-error';
        result.localHint = 'ac前面的系数是4哦，应该是 b² - 4ac';
        result.confidence = 0.7;
        return result;
      }
    }

    // 韦达定理公式识别
    if (/-b\s*\/\s*a/.test(lastExpr.replace(/\s/g, ''))) {
      result.isCorrect = true;
      result.confidence = 0.9;
      result.progress = 0.4;
      return result;
    }
    if (/b\s*\/\s*a/.test(lastExpr) && !/-/.test(lastExpr) && /和|sum|x1.*x2/.test(newStep.raw)) {
      result.hasError = true;
      result.errorStep = newStep;
      result.errorType = 'sign-error';
      result.localHint = '两根之和是 -b/a，b前面有个负号别忘了';
      result.confidence = 0.85;
      return result;
    }

    // 求根公式识别
    if (/sqrt|√/.test(lastExpr) && /2\s*\*?\s*a/.test(lastExpr) && /-b/.test(lastExpr)) {
      result.isCorrect = true;
      result.confidence = 0.85;
      result.progress = 0.5;
      return result;
    }
  }

  // 策略3：如果学生写了文字解释或复杂表达式，交给AI
  if (newStep.textExplanation.length > 5 || newStep.expressions.length > 3) {
    result.needAI = true;
    result.confidence = 0.3;
    return result;
  }

  // 策略4：表达式格式正确但无法本地判断等价性（如三角函数、导数等）
  result.needAI = true;
  result.confidence = 0.2;
  return result;
}

/**
 * 判断是否是在计算判别式的阶段（还没算出Delta值）
 */
function isDiscriminantStage(trace: SolutionTrace): boolean {
  if (trace.derivedVars.Delta !== undefined || trace.derivedVars.delta !== undefined) return false;
  // 前两步且有a,b,c参数时，大概率在算判别式
  return trace.steps.length <= 2 &&
    trace.knownParams.a !== undefined &&
    trace.knownParams.b !== undefined &&
    trace.knownParams.c !== undefined;
}

/**
 * 将分析结果应用到步骤上，更新解题轨迹
 */
export function applyAnalysis(
  trace: SolutionTrace,
  step: ParsedStep,
  analysis: StepAnalysisResult
): SolutionTrace {
  const updatedStep = { ...step };

  if (analysis.hasError) {
    updatedStep.status = 'error';
    updatedStep.errorType = analysis.errorType;
    updatedStep.errorHint = analysis.localHint;
    updatedStep.verifiedBy = analysis.confidence > 0.7 ? 'local' : 'ai';
    updatedStep.confidence = analysis.confidence;
  } else if (analysis.isCorrect) {
    updatedStep.status = analysis.needAI ? 'pending' : 'correct';
    updatedStep.verifiedBy = analysis.needAI ? 'none' : 'local';
    updatedStep.confidence = analysis.confidence;
    if (analysis.derivedVars) {
      trace.derivedVars = { ...trace.derivedVars, ...analysis.derivedVars };
    }
  } else {
    updatedStep.status = 'pending';
    updatedStep.verifiedBy = 'none';
    updatedStep.confidence = analysis.confidence;
  }

  const newTrace: SolutionTrace = {
    ...trace,
    steps: [...trace.steps, updatedStep],
    completed: analysis.isComplete,
    aiCallCount: trace.aiCallCount + (analysis.needAI ? 1 : 0),
    lastLocalVerdict: analysis.hasError
      ? `检测到${analysis.errorType}类型错误`
      : analysis.isCorrect
      ? `步骤正确（进度${Math.round(analysis.progress * 100)}%）`
      : '需要AI辅助判断',
  };

  if (analysis.isComplete && !newTrace.finalAnswer) {
    const lastStep = newTrace.steps[newTrace.steps.length - 1];
    newTrace.finalAnswer = lastStep.expressions[lastStep.expressions.length - 1] || lastStep.raw;
  }

  return newTrace;
}

/**
 * 学生说"我不会了"/"卡壳了"，本地续写解题过程
 * 核心：能本地推导的绝不调AI，只有需要策略选择时才调AI
 */
export function continueSolution(trace: SolutionTrace): ContinuationResult {
  const scope = { ...trace.knownParams, ...trace.derivedVars };
  const { a, b, c } = trace.knownParams;

  // 情况1：一元二次方程类型，有完整的a,b,c参数
  if (a !== undefined && b !== undefined && c !== undefined) {
    const delta = trace.derivedVars.Delta ?? trace.derivedVars.delta;

    // 还没算判别式 → 算判别式
    if (delta === undefined) {
      const expectedDelta = b * b - 4 * a * c;
      return {
        canContinue: true,
        nextExpression: `Δ = b² - 4ac = ${b}² - 4×${a}×${c} = ${expectedDelta}`,
        explanation: `我们先用判别式 Δ = b² - 4ac 来判断方程根的情况。代入a=${a}, b=${b}, c=${c}：Δ = ${b}² - 4×${a}×${c} = ${b * b} - ${4 * a * c} = ${expectedDelta}。`,
        isFinal: false,
      };
    }

    // 判别式算出来了，接下来求根
    if (delta >= 0) {
      const sqrtDelta = Math.sqrt(delta);
      const x1 = (-b + sqrtDelta) / (2 * a);
      const x2 = (-b - sqrtDelta) / (2 * a);
      const rootsEqual = Math.abs(x1 - x2) < 0.001;

      // 检查学生是否已经开始求根了
      const hasX1 = trace.derivedVars.x1 !== undefined || /x\s*[₁1]/.test(trace.steps.map(s => s.raw).join(' '));

      if (!hasX1) {
        if (delta === 0) {
          return {
            canContinue: true,
            nextExpression: `x = -b/(2a) = ${-b}/(${2 * a}) = ${x1}`,
            explanation: `因为Δ=0，方程有两个相等的实数根。代入求根公式 x = -b/(2a) = ${-b}/(${2 * a}) = ${x1}。所以方程的解是 x = ${roundNice(x1)}。`,
            isFinal: true,
          };
        }
        return {
          canContinue: true,
          nextExpression: `x = (-b ± √Δ)/(2a) = (${-b} ± √${delta})/${2 * a}`,
          explanation: `Δ=${delta} > 0，方程有两个不相等的实数根。用求根公式 x = (-b ± √Δ)/(2a)，代入得 x = (${-b} ± √${delta})/${2 * a}。`,
          isFinal: false,
        };
      }

      // 求根公式写了，算出具体值
      return {
        canContinue: true,
        nextExpression: rootsEqual
          ? `x₁ = x₂ = ${roundNice(x1)}`
          : `x₁ = ${roundNice(x1)}, x₂ = ${roundNice(x2)}`,
        explanation: rootsEqual
          ? `因为Δ=0，两个根相等：x₁ = x₂ = ${roundNice(x1)}。`
          : `计算得：x₁ = (${-b} + ${roundNice(sqrtDelta)})/${2 * a} = ${roundNice(x1)}，x₂ = (${-b} - ${roundNice(sqrtDelta)})/${2 * a} = ${roundNice(x2)}。所以方程的两个根是 ${roundNice(x1)} 和 ${roundNice(x2)}。`,
        isFinal: true,
      };
    }

    // 判别式 < 0，无实根
    return {
      canContinue: true,
      nextExpression: `Δ = ${delta} < 0，方程无实数根`,
      explanation: `Δ = ${delta} < 0，这说明方程在实数范围内没有解。如果考虑复数范围，可以用复数表示根，但高中阶段通常只需要回答"无实数根"。`,
      isFinal: true,
    };
  }

  // 情况2：一元一次方程
  // 识别 ax + b = 0 形式
  // 暂时交给AI处理（因为参数提取对一次方程需要更精细的解析）

  // 无法本地续写，需要AI
  return {
    canContinue: false,
    explanation: '',
    needAI: true,
    aiPromptHint: getAIPromptHint(trace),
  };
}

/**
 * 获取给AI的提示上下文，减少AI的工作量
 */
function getAIPromptHint(trace: SolutionTrace): string {
  const lastStep = trace.steps[trace.steps.length - 1];
  const steps = trace.steps.map((s, i) => `第${i + 1}步：${s.raw}${s.status === 'error' ? '（这步有错）' : ''}`).join('\n');
  const derived = Object.entries(trace.derivedVars)
    .map(([k, v]) => `${k}=${v}`).join(', ');

  return `题目：${trace.questionText}

已知参数：${JSON.stringify(trace.knownParams)}
已推导出的中间变量：${derived || '无'}

学生已写的过程：
${steps}

学生最后一步：${lastStep?.raw || '还没开始写'}

请分析学生目前的进展：
1. 如果学生的步骤有错误，直接指出错误在哪，问"从上一步到这一步你是怎么推导的？"
2. 如果学生没写完卡住了，请从学生已写的最后一步开始，继续写完后续过程，每一步都要解释"上一步怎么得到这一步"
3. 永远不要直接给完整答案跳过学生的过程，要顺着学生写的来`;
}

/**
 * 把数字四舍五入到好看的形式（分数或简单小数）
 */
function roundNice(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // 尝试分数表示
  const fractions: [number, string][] = [
    [0.5, '1/2'], [0.25, '1/4'], [0.75, '3/4'],
    [0.333, '1/3'], [0.667, '2/3'],
    [0.2, '1/5'], [0.4, '2/5'], [0.6, '3/5'], [0.8, '4/5'],
    [0.125, '1/8'], [0.375, '3/8'], [0.625, '5/8'], [0.875, '7/8'],
  ];
  const rounded = Math.round(n * 1000) / 1000;
  for (const [val, str] of fractions) {
    if (Math.abs(Math.abs(n) - val) < 0.002) {
      return n < 0 ? '-' + str : str;
    }
  }
  // 检查分母为整数的情况（最多到10）
  for (let denom = 2; denom <= 10; denom++) {
    const numer = Math.round(n * denom);
    if (Math.abs(numer / denom - n) < 0.001) {
      if (numer === 1) return `1/${denom}`;
      return `${numer}/${denom}`;
    }
  }
  return String(rounded);
}

/**
 * 记录学生错误到错题本（结合现有的错误标签体系）
 */
export function tagError(errorType?: string): ErrorTag {
  switch (errorType) {
    case 'sign-error': return 'sign-error';
    case 'coefficient-error': return 'calculation';
    case 'missing-power': return 'formula-recall';
    case 'calculation': return 'calculation';
    case 'decimal-error': return 'calculation';
    case 'substitution-error': return 'substitution-error';
    case 'misconception': return 'misconception';
    default: return 'calculation';
  }
}
