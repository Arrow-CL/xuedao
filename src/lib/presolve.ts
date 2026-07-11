/**
 * 预求解系统 - Presolve System
 * 
 * 核心思路：AI 先完整解一遍题目，生成结构化参考解
 * 后续引导时以参考解为锚点，精准定位学生的计算断层
 * 
 * 流程：
 * 1. 学生开始做某道题 → 调用 preolve API → AI 生成结构化解题步骤
 * 2. 参考解存入 localStorage（持久化，后续复用）
 * 3. 学生每写一步 → 本地引擎比对参考解 → 精准定位分歧点
 * 4. 引导：知道完整过程的 AI 不会产生幻觉
 */

import storage from "@/lib/storage";

// ============ 类型定义 ============

/** 预求解的单个解题步骤 */
export interface PresolvedStep {
  stepNumber: number;
  /** 这一步要做什么（自然语言） */
  action: string;
  /** 这一步的数学表达式/公式 */
  expression: string;
  /** 这一步的计算结果 */
  result: string;
  /** 为什么从上一步到这一步（推理说明） */
  reasoning: string;
  /** 学生做到这一步时，怎么验证自己做对了 */
  checkHint: string;
}

/** 知识碎片（引导时按需呈现） */
export interface KnowledgeFragment {
  /** 对应第几步 */
  step: number;
  /** 知识点名称 */
  name: string;
  /** 碎片提示（不完整，只给方向） */
  fragment: string;
  /** 完整内容（回顾时展示） */
  full: string;
}

// ============ Prompt 版本控制 ============
// 每次修改 presolve/guide prompt 时递增此版本号
// 旧版本的缓存会自动失效，强制重新预求解
export const PROMPT_VERSION = 4;

/** 题目的完整预求解结果 */
export interface PresolvedQuestion {
  questionId: string;
  /** 题目文本 */
  questionText: string;
  /** 正确答案 */
  finalAnswer: string;
  /** 结构化解题步骤 */
  steps: PresolvedStep[];
  /** 这道题用到的知识点列表（按使用顺序） */
  knowledgePoints: string[];
  /** 知识碎片（每步可按需注入对话） */
  knowledgeFragments: KnowledgeFragment[];
  /** 常见错误模式 */
  commonErrors: string[];
  /** 如果学生完全不会，从哪一步开始引导 */
  entryStep: number;
  /** 做完后的知识回顾总结 */
  summary: string;
  /** 下一题方向提示 */
  nextHint: string;
  /** 预求解时间 */
  solvedAt: number;
  /** 生成此结果的 prompt 版本 */
  promptVersion: number;
}

// ============ 预求解缓存（静态 JSON + localStorage 增量） ============

import presolvedCacheData from "@/data/presolved-cache.json";

/** 静态预求解缓存（批量生成，构建时打包） */
const staticCache: Record<string, PresolvedQuestion> = presolvedCacheData as Record<string, PresolvedQuestion>;

const STORAGE_KEY = "presolved_questions";

/**
 * 获取已缓存的预求解结果
 * 优先读静态 JSON（批量生成），其次读 localStorage（运行时增量补充）
 * 版本不匹配则返回 null
 */
export function getCachedPresolve(questionId: string): PresolvedQuestion | null {
  // 1. 优先静态缓存
  const staticItem = staticCache[questionId];
  if (staticItem && staticItem.promptVersion === PROMPT_VERSION) {
    return staticItem;
  }

  // 2. localStorage 增量缓存（仅客户端可用）
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const cache: Record<string, PresolvedQuestion> = JSON.parse(raw);
      const cached = cache[questionId] || null;
      if (cached && cached.promptVersion === PROMPT_VERSION) {
        return cached;
      }
    }
  } catch {
    // 服务端无 localStorage，忽略
  }

  return null;
}

/**
 * 检查某题是否有预求解缓存（不含版本检查，用于 UI 展示）
 */
export function hasPresolve(questionId: string): boolean {
  return !!(staticCache[questionId]);
}

/**
 * 缓存预求解结果到 localStorage（仅客户端）
 */
export function cachePresolve(presolve: PresolvedQuestion): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const cache: Record<string, PresolvedQuestion> = raw ? JSON.parse(raw) : {};
    cache[presolve.questionId] = presolve;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage 满了或不可用
  }
}

/**
 * 批量获取所有已缓存的预求解
 */
export function getAllCachedPresolves(): Record<string, PresolvedQuestion> {
  try {
    // 合并静态缓存和 localStorage
    const localRaw = localStorage.getItem(STORAGE_KEY);
    const local: Record<string, PresolvedQuestion> = localRaw ? JSON.parse(localRaw) : {};
    return { ...staticCache, ...local };
  } catch {
    return { ...staticCache };
  }
}

// ============ 本地比对引擎 ============

/**
 * 比对学生输入与参考解步骤
 * 返回最匹配的步骤编号和匹配度
 */
export function matchStudentStep(
  studentInput: string,
  steps: PresolvedStep[]
): { matchedStep: number; confidence: number; diffDescription: string } {
  if (!studentInput.trim()) {
    return { matchedStep: -1, confidence: 0, diffDescription: "空输入" };
  }

  const cleaned = studentInput
    .replace(/\s+/g, "")
    .replace(/[。.，,；;！!？?]/g, "")
    .toLowerCase();

  let bestMatch = -1;
  let bestConfidence = 0;
  let bestDiff = "";

  for (const step of steps) {
    // 检查学生的输入是否和这一步的表达式匹配
    const exprClean = step.expression.replace(/\s+/g, "").toLowerCase();
    const resultClean = step.result.replace(/\s+/g, "").toLowerCase();

    let confidence = 0;

    // 精确匹配结果
    if (cleaned.includes(resultClean) && resultClean.length > 0) {
      confidence = 0.95;
    }
    // 精确匹配表达式
    else if (cleaned.includes(exprClean) && exprClean.length > 0) {
      confidence = 0.9;
    }
    // 部分匹配（包含关键数字或符号）
    else {
      const keyParts = exprClean.replace(/[=+\-*/^()]/g, " ").split(/\s+/).filter(p => p.length > 1);
      const matchCount = keyParts.filter(p => cleaned.includes(p)).length;
      if (keyParts.length > 0 && matchCount / keyParts.length > 0.5) {
        confidence = matchCount / keyParts.length;
      }
    }

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = step.stepNumber;
      bestDiff = confidence < 0.8
        ? `你写的和第${step.stepNumber}步（${step.action}）有些接近，但不太一样`
        : "";
    }
  }

  return { matchedStep: bestMatch, confidence: bestConfidence, diffDescription: bestDiff };
}

/**
 * 根据学生的当前进度，生成精准引导
 * 核心逻辑：找到学生应该做的步骤 vs 实际做的步骤之间的分歧点
 */
export function generateGuidance(
  studentInput: string,
  currentStepNumber: number, // 学生目前应该做到第几步
  presolve: PresolvedQuestion
): {
  type: "on-track" | "off-track" | "stuck" | "correct" | "complete";
  message: string;
  hint?: string;
  nextStep?: number;
} {
  const match = matchStudentStep(studentInput, presolve.steps);

  // 高置信度匹配某一步
  if (match.confidence >= 0.85) {
    // 匹配的步骤 >= 应该做的步骤 → 在正确路径上
    if (match.matchedStep >= currentStepNumber) {
      if (match.matchedStep >= presolve.steps.length) {
        return { type: "complete", message: "做对了！这道题你已经完成了。" };
      }
      const nextStep = presolve.steps[match.matchedStep];
      return {
        type: "correct",
        message: `这一步对了！${nextStep ? "" : ""}`,
        nextStep: match.matchedStep + 1,
        hint: nextStep ? `下一步：${nextStep.action}` : undefined,
      };
    }
    // 匹配的步骤 < 应该做的步骤 → 倒退了
    return {
      type: "off-track",
      message: `这一步是对的（${presolve.steps[match.matchedStep - 1]?.action || ""}），但你好像已经做过了。你目前在第${currentStepNumber}步，再看看接下来该怎么做？`,
      nextStep: currentStepNumber,
      hint: presolve.steps[currentStepNumber - 1]?.action,
    };
  }

  // 低置信度匹配 → 可能算错了或走偏了
  if (match.confidence >= 0.4) {
    const expectedStep = presolve.steps[currentStepNumber - 1];
    if (expectedStep) {
      return {
        type: "off-track",
        message: `这一步不太对。${expectedStep.action.replace(/=\s*[\d.±\-]+/g, "= ?")}`,
        hint: expectedStep.checkHint,
        nextStep: currentStepNumber,
      };
    }
  }

  // 完全匹配不上 → 学生卡住了
  const expectedStep = presolve.steps[currentStepNumber - 1];
  if (expectedStep) {
    return {
      type: "stuck",
      message: `${expectedStep.action}`,
      hint: expectedStep.checkHint,
      nextStep: currentStepNumber,
    };
  }

  return { type: "stuck", message: "需要更多帮助吗？可以点「要提示」或者「我不会」。" };
}

/**
 * 学生说"我不会"时，从预求解中给出逐步引导
 * 核心原则：帮学生理清当前已知，让他自己往前推一步
 */
export function getStepByStepHelp(
  currentStepNumber: number,
  presolve: PresolvedQuestion
): { message: string; revealedUpTo: number } {
  const steps = presolve.steps;
  
  if (currentStepNumber > steps.length) {
    return { message: "这道题你已经走到最后了，写出最终答案吧。", revealedUpTo: steps.length };
  }

  const step = steps[currentStepNumber - 1];
  const prevStep = currentStepNumber > 1 ? steps[currentStepNumber - 2] : null;

  let message = "";
  
  // 1. 回顾上一步结果（如果有）——简洁带过，不重复
  if (prevStep) {
    message += `$${prevStep.result}$\n\n`;
  }

  // 2. 提问式引导，不直接给做法
  message += `${step.action}\n\n`;
  
  // 3. 只给reasoning第一句话作为方向，不全暴露
  if (step.reasoning && step.reasoning.length > 0) {
    const firstHint = step.reasoning.split(/[。.！!]/)[0];
    if (firstHint) {
      message += `${firstHint}。\n\n`;
    }
  }

  message += `你觉得呢？`;
  
  return { message, revealedUpTo: currentStepNumber - 1 };
}
