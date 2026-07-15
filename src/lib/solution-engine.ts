/**
 * 本地解题引擎 — 基于预存标准解题过程的锚定引导
 *
 * 核心逻辑：
 * 1. 每道题预存 "标准解题过程" + "关键节点列表"
 * 2. 学生输入 → 关键词匹配 → 定位匹配节点
 * 3. 板书仅渲染已解锁节点的行（不自动补齐未解锁节点）
 * 4. 最终答案单独拦截，只有精准命中答案节点才触发全显
 */

import demoSolutions from "@/data/demo-solutions-v2.json";

// ============================================================================
// 类型定义
// ============================================================================

export interface KeyNode {
  nodeId: number;
  lines: number[];           // 对应 standardProcess 中的行号
  keywords: string[];        // 匹配关键词
  hint: string;              // 该节点的引导提示语（用于AI prompt）
  diagram?: string;          // 可选：该节点对应的SVG图形路径
  knowledgeFragment?: string; // 知识点片段：公式/定理/定义，答疑模式用
}

export interface LocalSolution {
  questionId: string;
  standardProcess: string;   // 标准解题过程，用 \n 分隔的行
  keyNodes: KeyNode[];
  finalAnswer: string;
  knowledgePoints: string[];
}

export interface MatchResult {
  matchedNodeId: number;       // 本次匹配到的节点（0表示未匹配）
  boardLines: string[];        // 已解锁节点的板书行
  nextHint: string;            // 下一步引导提示
  progress: string;            // 当前进度描述
  currentDiagram?: string;     // 当前应显示的图形
  unlockedNodeIds: number[];   // 已解锁的节点ID集合（前端需回传）
}

// ============================================================================
// 数据加载
// ============================================================================

const solutionsMap = new Map<string, LocalSolution>();

for (const sol of demoSolutions as LocalSolution[]) {
  solutionsMap.set(sol.questionId, sol);
}

export function hasLocalSolution(questionId: string): boolean {
  return solutionsMap.has(questionId);
}

export function getLocalSolution(questionId: string): LocalSolution | null {
  return solutionsMap.get(questionId) || null;
}

// ============================================================================
// 匹配引擎
// ============================================================================

function splitProcess(process: string): string[] {
  return process.split("\\n").filter((line) => line.trim() !== "");
}

function containsKeyword(text: string, keyword: string): boolean {
  // 归一化：统一数学符号写法
  const normalize = (s: string) => s
    .toLowerCase()
    .replace(/\^2/g, "²").replace(/\^3/g, "³")  // ASCII ^2 → Unicode ²
    .replace(/\\/g, "").replace(/\$/g, "")       // 去掉 LaTeX 标记
    .replace(/\s+/g, "");                         // 去掉空格

  const normText = normalize(text);
  const normKeyword = normalize(keyword);

  if (normText.includes(normKeyword)) return true;

  // 原始 includes（兜底）
  if (text.toLowerCase().includes(keyword.toLowerCase())) return true;

  return false;
}

/**
 * 核心匹配函数 — 简化版
 *
 * 职责单一：只负责匹配学生输入 → 解锁板书节点
 * 不负责判定题目完成 —— 完全交给 AI 和前端（检测【完成】标记）
 */
export function matchStudentInput(
  questionId: string,
  studentInput: string,
  currentNodeId: number = 0,
  unlockedNodeIds: number[] = [],
): MatchResult {
  const solution = getLocalSolution(questionId);
  if (!solution) {
    return { matchedNodeId: 0, boardLines: [], nextHint: "", progress: "无本地解题数据", unlockedNodeIds: [] };
  }

  const lines = splitProcess(solution.standardProcess);
  const totalNodes = solution.keyNodes.length;
  const maxNodeId = solution.keyNodes.length > 0 ? Math.max(...solution.keyNodes.map((n) => n.nodeId)) : 0;

  // === 一、关键词匹配：分数优先，同分取更小 nodeId ===
  // 重要规则：最后一个节点（最终答案）只有在前面所有节点都解锁后才能被匹配
  // 防止开局直接写答案就跳到最后节点
  const finalNodeId = maxNodeId;
  const allPerviousUnlocked = solution.keyNodes
    .filter(n => n.nodeId < finalNodeId)
    .every(n => unlockedNodeIds.includes(n.nodeId));

  let bestNodeId = 0;
  let bestScore = 0;

  for (const node of solution.keyNodes) {
    // 最终答案节点：前置节点未全部解锁时，跳过匹配（防止跳步直接到终点）
    if (node.nodeId === finalNodeId && !allPerviousUnlocked) {
      continue;
    }
    let score = 0;
    for (const keyword of node.keywords) {
      if (containsKeyword(studentInput, keyword)) score += 1;
    }
    if (score > 0) {
      if (score > bestScore || (score === bestScore && node.nodeId < bestNodeId)) {
        bestNodeId = node.nodeId;
        bestScore = score;
      }
    }
  }

  // === 二、向量等价匹配补充 ===
  // 学生写的是等价表达式（如 3n-2m vs -2m+3n），也能解锁最后节点
  // 但同样需要前置节点全部解锁
  const hasReachedSecondLast = unlockedNodeIds.includes(maxNodeId - 1) || unlockedNodeIds.includes(maxNodeId);
  if (bestNodeId !== maxNodeId && allPerviousUnlocked && hasReachedSecondLast && isVectorEquivalent(studentInput, solution.finalAnswer)) {
    bestNodeId = maxNodeId;
    bestScore = 1;
  }

  // === 三、匹配到节点 → 解锁板书 ===
  if (bestScore > 0) {
    const newUnlocked = mergeUnlocked(unlockedNodeIds, bestNodeId, solution.keyNodes);
    const boardLines = getUnlockedLines(lines, solution.keyNodes, newUnlocked);
    const matchedNode = solution.keyNodes.find((n) => n.nodeId === bestNodeId);
    const nextNode = solution.keyNodes.find((n) => !newUnlocked.includes(n.nodeId));
    const lastDiagramNode = [...solution.keyNodes].filter((n) => newUnlocked.includes(n.nodeId) && n.diagram).pop();

    return {
      matchedNodeId: bestNodeId,
      boardLines,  // 始终只显示已解锁节点的板书，不补齐未解锁的
      nextHint: nextNode ? nextNode.hint : "",
      progress: `${newUnlocked.length}/${totalNodes}`,
      currentDiagram: matchedNode?.diagram || lastDiagramNode?.diagram,
      unlockedNodeIds: newUnlocked,
    };
  }

  // === 四、未匹配任何节点 ===
  const currentBoard = getUnlockedLines(lines, solution.keyNodes, unlockedNodeIds);
  const nextNode = solution.keyNodes.find((n) => !unlockedNodeIds.includes(n.nodeId));
  const currentDiagramNode = [...solution.keyNodes].filter((n) => unlockedNodeIds.includes(n.nodeId) && n.diagram).pop();

  return {
    matchedNodeId: 0,
    boardLines: currentBoard,
    nextHint: nextNode?.hint || "",
    progress: `${unlockedNodeIds.length}/${totalNodes}`,
    currentDiagram: currentDiagramNode?.diagram,
    unlockedNodeIds,
  };
}

/**
 * 合并已解锁集合：将新匹配的节点加入，同时补齐中间依赖节点
 * 
 * 策略：如果匹配到节点3但节点1、2未解锁，只解锁节点3（不补齐1、2）
 * 但如果节点1、2已解锁，匹配到节点3，则解锁集合为 [1,2,3]
 */
function mergeUnlocked(
  current: number[],
  newNodeId: number,
  keyNodes: KeyNode[],
): number[] {
  const set = new Set(current);
  set.add(newNodeId);
  // 排序返回
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * 获取已解锁节点的板书行
 * 严格规则：只渲染已解锁集合内的节点对应的行，不自动补齐未解锁节点
 */
function getUnlockedLines(
  allLines: string[],
  keyNodes: KeyNode[],
  unlockedIds: number[],
): string[] {
  const visibleLineIndices = new Set<number>();

  for (const node of keyNodes) {
    if (unlockedIds.includes(node.nodeId)) {
      for (const lineIdx of node.lines) {
        visibleLineIndices.add(lineIdx);
      }
    }
  }

  return allLines.filter((_, idx) => visibleLineIndices.has(idx));
}

/**
 * 纯向量系数等价匹配（严格，仅用于分步推进到倒数第二步时的补充判定）
 * 只比较变量名和对应系数是否一致，不做 includes 等宽松匹配
 * 例如 "-2m+3n" 和 "3n-2m" 等价，但 "m+n" 和 "-2m+3n" 不等价
 */
function isVectorEquivalent(input: string, finalAnswer: string): boolean {
  const cleanInput = input.replace(/\\/g, "").replace(/\$/g, "").replace(/\s/g, "").toLowerCase();
  const cleanAnswer = finalAnswer.replace(/\\/g, "").replace(/\$/g, "").replace(/\s/g, "").toLowerCase();

  // 去掉前缀：如果输入包含 "=" 号，只取右边部分（如 "CB=m+3n-3m" → "m+3n-3m"）
  // 这样 "CB="、"b-4a=" 等前缀不会干扰变量解析
  const pureInput = cleanInput.includes("=") ? cleanInput.split("=").pop()!.replace(/[=]/g, "") : cleanInput;
  const pureAnswer = cleanAnswer.includes("=") ? cleanAnswer.split("=").pop()!.replace(/[=]/g, "") : cleanAnswer;

  // 支持分数系数：如 "1/3ab"、"-2/3ad"、"3n"
  const termPattern = /([+-]?\d*\.?\d*(?:\/\d+)?)\*?([a-zA-Z]\w*)/g;
  const inputTerms = new Map<string, number>();
  const answerTerms = new Map<string, number>();

  function parseCoeff(raw: string): number {
    if (raw === "" || raw === "+") return 1;
    if (raw === "-") return -1;
    if (raw.includes("/")) {
      const [num, den] = raw.split("/");
      return parseFloat(num) / parseFloat(den);
    }
    return parseFloat(raw);
  }

  function extractTerms(text: string, terms: Map<string, number>) {
    termPattern.lastIndex = 0; // 重置正则游标
    let m;
    while ((m = termPattern.exec(text)) !== null) {
      const coeff = parseCoeff(m[1]);
      const variable = m[2];
      terms.set(variable, (terms.get(variable) || 0) + coeff);
    }
  }

  extractTerms(pureInput, inputTerms);
  extractTerms(pureAnswer, answerTerms);

  if (inputTerms.size === 0 || answerTerms.size === 0) return false;
  if (inputTerms.size !== answerTerms.size) return false;
  for (const [variable, coeff] of answerTerms) {
    if (!inputTerms.has(variable)) return false;
    if (Math.abs(inputTerms.get(variable)! - coeff) > 0.001) return false;
  }
  return true;
}

function isFinalAnswerMatch(input: string, finalAnswer: string): boolean {
  const cleanInput = input.replace(/\\/g, "").replace(/\$/g, "").replace(/\s/g, "").toLowerCase();
  const cleanAnswer = finalAnswer.replace(/\\/g, "").replace(/\$/g, "").replace(/\s/g, "").toLowerCase();

  // 前置过滤：带向量等式前缀的中间输入直接返回不匹配
  // 防止 "CB="、"b-4a=" 这类中间关系式误匹配答案
  if (/^[a-zA-Z]+[=]/.test(cleanInput) && !cleanInput.includes(cleanAnswer)) {
    return false;
  }

  // 直接包含（答案整体出现在输入中）
  if (cleanInput.includes(cleanAnswer)) return true;

  // 纯数字答案：输入必须包含该数字且数字是独立的（不是坐标或其他表达式的一部分）
  if (/^\d+(\.\d+)?$/.test(cleanAnswer)) {
    // 用边界匹配，防止 "2" 误中 "(2,x-4)"
    const numPattern = new RegExp(`(^|[^a-zA-Z0-9.])${cleanAnswer.replace(/\./g, "\\.")}($|[^a-zA-Z0-9.])`);
    if (numPattern.test(cleanInput)) return true;
    // 等式结尾匹配，如 "x=2" 末尾的 2
    if (new RegExp(`=${cleanAnswer.replace(/\./g, "\\.")}$`).test(cleanInput)) return true;
    return false;
  }

  // 含等号的答案（如 "x=2"）：必须是完整等式匹配，不能只匹配部分变量
  if (cleanAnswer.includes("=")) {
    // 直接包含已在上面检查过，这里不再做宽松匹配
    return false;
  }

  // 向量系数等价匹配：仅对纯表达式答案（不含等号）启用
  // 例如 "-2m+3n" 和 "3n-2m" 应该匹配
  const termPattern = /([+-]?\d*\.?\d*)([a-zA-Z]\w*)/g;
  const inputTerms = new Map<string, number>();
  const answerTerms = new Map<string, number>();

  let match;
  while ((match = termPattern.exec(cleanInput)) !== null) {
    const coeffStr = match[1] === "" || match[1] === "+" ? "1" : match[1] === "-" ? "-1" : match[1];
    const coeff = parseFloat(coeffStr);
    const variable = match[2];
    inputTerms.set(variable, (inputTerms.get(variable) || 0) + coeff);
  }
  while ((match = termPattern.exec(cleanAnswer)) !== null) {
    const coeffStr = match[1] === "" || match[1] === "+" ? "1" : match[1] === "-" ? "-1" : match[1];
    const coeff = parseFloat(coeffStr);
    const variable = match[2];
    answerTerms.set(variable, (answerTerms.get(variable) || 0) + coeff);
  }

  // 比较两个 Map 的 key 集合和对应的系数
  if (inputTerms.size > 0 && answerTerms.size > 0) {
    // 额外校验：输入和答案的项数必须一致，且输入中不能有多余字符
    // 防止 "(2,x-4)" 中只有一个 x 就匹配上 "x=2" 里的 x（含等号的已经在上面返回了）
    if (inputTerms.size !== answerTerms.size) return false;
    for (const [variable, coeff] of answerTerms) {
      if (!inputTerms.has(variable)) return false;
      if (Math.abs(inputTerms.get(variable)! - coeff) > 0.001) return false;
    }
    return true;
  }

  return false;
}

export function getFullBoard(questionId: string): string[] {
  const solution = getLocalSolution(questionId);
  if (!solution) return [];
  return splitProcess(solution.standardProcess);
}

export function getGuideContext(questionId: string, currentNodeId: number = 0): {
  standardProcess: string;
  keyNodes: KeyNode[];
  nextHint: string;
  currentProgress: string;
  knowledgePoints: string[];
} {
  const solution = getLocalSolution(questionId);
  if (!solution) {
    return {
      standardProcess: "",
      keyNodes: [],
      nextHint: "",
      currentProgress: "",
      knowledgePoints: [],
    };
  }

  const nextNode = solution.keyNodes.find((n) => n.nodeId === currentNodeId + 1);

  return {
    standardProcess: solution.standardProcess,
    keyNodes: solution.keyNodes,
    nextHint: nextNode?.hint || "",
    currentProgress: `${currentNodeId}/${solution.keyNodes.length}`,
    knowledgePoints: solution.knowledgePoints,
  };
}

// ============================================================================
// 全局答疑模式支持
// ============================================================================

/** 全局答疑触发关键词池 */
export const HELP_KEYWORDS = [
  "我不会", "不会算", "什么是", "什么叫",
  "不懂", "不知道", "算错了", "记错了",
  "分不清", "无从下手",
];

/** 检测学生输入是否触发全局答疑模式 */
export function shouldTriggerHelp(input: string): boolean {
  const lowerInput = input.toLowerCase();
  return HELP_KEYWORDS.some((kw) => lowerInput.includes(kw.toLowerCase()));
}

/** 获取指定节点的知识点片段 */
export function getKnowledgeFragment(
  questionId: string,
  nodeId: number,
): string | null {
  const solution = getLocalSolution(questionId);
  if (!solution) return null;
  const node = solution.keyNodes.find((n) => n.nodeId === nodeId);
  return node?.knowledgeFragment || null;
}

/** 获取当前待解锁的目标节点ID（学生卡住的节点） */
export function getCurrentTargetNodeId(
  questionId: string,
  unlockedNodeIds: number[],
  currentNodeId: number = 0,
): number {
  const solution = getLocalSolution(questionId);
  if (!solution || solution.keyNodes.length === 0) return 1;

  // 如果 currentNodeId 有效，优先找下一个节点
  if (currentNodeId > 0) {
    const nextNode = solution.keyNodes.find(
      (n) => n.nodeId === currentNodeId + 1,
    );
    if (nextNode) return nextNode.nodeId;
  }

  // 否则找第一个未解锁的节点
  const firstUnlocked = solution.keyNodes.find(
    (n) => !unlockedNodeIds.includes(n.nodeId),
  );
  return (
    firstUnlocked?.nodeId ||
    solution.keyNodes[solution.keyNodes.length - 1]?.nodeId ||
    1
  );
}

/** 获取节点的引导提示语 */
export function getNodeHint(questionId: string, nodeId: number): string | null {
  const solution = getLocalSolution(questionId);
  if (!solution) return null;
  const node = solution.keyNodes.find((n) => n.nodeId === nodeId);
  return node?.hint || null;
}

/** 获取节点绑定的图形路径 */
export function getNodeDiagram(questionId: string, nodeId: number): string | null {
  const solution = getLocalSolution(questionId);
  if (!solution) return null;
  const node = solution.keyNodes.find((n) => n.nodeId === nodeId);
  return node?.diagram || null;
}

/** 获取当前已解锁的板书行（不触发匹配，纯查询） */
export function getCurrentBoardLines(
  questionId: string,
  unlockedNodeIds: number[],
): string[] {
  const solution = getLocalSolution(questionId);
  if (!solution) return [];
  const lines = splitProcess(solution.standardProcess);
  return getUnlockedLines(lines, solution.keyNodes, unlockedNodeIds);
}

/** 获取本题知识回顾内容（带公式）——用于最终答案 fallback */
export function getKnowledgeReviewContent(questionId: string): string {
  const solution = getLocalSolution(questionId);
  if (!solution) return "";

  const fragments = solution.keyNodes
    .filter((n) => n.knowledgeFragment)
    .map((n, i) => `${i + 1}. ${n.knowledgeFragment}`);

  if (fragments.length === 0) return "";
  return `做对了！这道题用到的核心知识点：\n${fragments.join("\n")}\n【完成】`;
}

export function getSupportedQuestionIds(): string[] {
  return Array.from(solutionsMap.keys());
}
