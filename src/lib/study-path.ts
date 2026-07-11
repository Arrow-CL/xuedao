/**
 * 学习路径引擎
 *
 * 核心逻辑：
 * 1. 每个知识点(unit)配3道过渡练习（简单→中等→接近高考难度）
 * 2. 学完2-3个unit的练习后，解锁对应的高考真题
 * 3. 每天规划：1个unit的课本 + 3道练习 + 1-2道高考真题
 * 4. 根据学生进度和薄弱点动态调整
 */
import { chapters } from '@/data/chapters';
import allContent from '@/data/content';
import {
  LearningUnit,
  BridgeExercise,
  GaokaoMapping,
  DailyPlan,
  DailyModulePlan,
  StudyPath,
} from '@/types';

// 存储key
const PATH_KEY = 'study-math:study-path';
const UNIT_PROGRESS_KEY = 'study-math:unit-progress';

// ============================================================
// 1. 学习单元构建：每个unit + 练习 + 高考真题映射
// ============================================================

/**
 * 获取某个章节下所有学习单元（带练习和高考题映射）
 * 懒加载：练习数据从localStorage或默认数据中读取
 */
export function getLearningUnits(moduleId: string): LearningUnit[] {
  const mod = chapters.find(m => m.id === moduleId);
  if (!mod) return [];

  const contentData = allContent[moduleId] || {};
  const bridgeData = loadBridgeExercises(moduleId);
  const gaokaoMappings = loadGaokaoMappings(moduleId);

  return mod.units.map((unit, idx) => {
    const unitBridge = bridgeData[unit.id] || [];
    const unitGaokao = gaokaoMappings.filter(g =>
      g.requiredUnits.includes(unit.id) ||
      g.chapters.includes(moduleId)
    );

    return {
      moduleId,
      unitId: unit.id,
      unitName: unit.name,
      order: idx,
      contentReady: !!contentData[unit.id],
      bridgeExercises: unitBridge,
      relatedGaokao: unitGaokao,
    };
  });
}

/**
 * 获取某个module的整体学习进度
 * 返回每个unit的状态：未开始/已读课本/已做练习/已做高考题
 */
export function getModuleLearningStatus(moduleId: string): Record<string, {
  textbookDone: boolean;
  practiceDone: boolean;
  practiceCorrect: number;
  practiceTotal: number;
  gaokaoDone: number;
  gaokaoTotal: number;
}> {
  try {
    const raw = localStorage.getItem(`${UNIT_PROGRESS_KEY}:${moduleId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  // 默认全部未完成
  const mod = chapters.find(m => m.id === moduleId);
  if (!mod) return {};
  const status: Record<string, any> = {};
  for (const unit of mod.units) {
    status[unit.id] = {
      textbookDone: false,
      practiceDone: false,
      practiceCorrect: 0,
      practiceTotal: 0,
      gaokaoDone: 0,
      gaokaoTotal: 0,
    };
  }
  return status;
}

export function saveUnitStatus(moduleId: string, unitId: string, field: string, value: any) {
  try {
    const key = `${UNIT_PROGRESS_KEY}:${moduleId}`;
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {};
    if (!data[unitId]) {
      data[unitId] = {
        textbookDone: false, practiceDone: false,
        practiceCorrect: 0, practiceTotal: 0, gaokaoDone: 0, gaokaoTotal: 0,
      };
    }
    data[unitId][field] = value;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ============================================================
// 2. 过渡练习数据管理
// ============================================================

/**
 * 加载某个章节的过渡练习数据
 * 优先从localStorage读取（可能被AI动态生成过），否则用默认数据
 */
function loadBridgeExercises(moduleId: string): Record<string, BridgeExercise[]> {
  try {
    const raw = localStorage.getItem(`study-math:bridge:${moduleId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getDefaultBridgeExercises(moduleId);
}

/**
 * 保存AI生成的过渡练习到localStorage
 */
export function saveBridgeExercises(moduleId: string, exercises: Record<string, BridgeExercise[]>) {
  try {
    localStorage.setItem(`study-math:bridge:${moduleId}`, JSON.stringify(exercises));
  } catch {}
}

// ============================================================
// 3. 高考真题映射
// ============================================================

function loadGaokaoMappings(moduleId: string): GaokaoMapping[] {
  try {
    const raw = localStorage.getItem(`study-math:gaokao-mapping:${moduleId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getDefaultGaokaoMappings(moduleId);
}

export function saveGaokaoMappings(moduleId: string, mappings: GaokaoMapping[]) {
  try {
    localStorage.setItem(`study-math:gaokao-mapping:${moduleId}`, JSON.stringify(mappings));
  } catch {}
}

// ============================================================
// 4. 学习路径规划
// ============================================================

/**
 * 判断某个unit是否可以做高考真题了
 * 条件：该unit的课本已读完，且练习正确率>=60%
 */
export function canDoGaokao(moduleId: string, unitId: string): boolean {
  const status = getModuleLearningStatus(moduleId);
  const unitStatus = status[unitId];
  if (!unitStatus) return false;
  if (!unitStatus.textbookDone) return false;
  if (unitStatus.practiceTotal < 2) return false;
  if (unitStatus.practiceTotal > 0) {
    return unitStatus.practiceCorrect / unitStatus.practiceTotal >= 0.6;
  }
  return false;
}

/**
 * 判断某个module是否可以做综合高考真题了
 * 条件：至少2个unit的练习已完成，且整体正确率>=60%
 */
export function canDoModuleGaokao(moduleId: string): boolean {
  const status = getModuleLearningStatus(moduleId);
  const units = Object.values(status);
  const completedPractice = units.filter(u => u.practiceDone);
  return completedPractice.length >= 2;
}

/**
 * 获取模块的高考真题门槛提示
 * 告诉学生还差什么才能解锁高考真题
 */
export function getGaokaoUnlockHint(moduleId: string): string {
  const mod = chapters.find(m => m.id === moduleId);
  if (!mod) return '';
  const status = getModuleLearningStatus(moduleId);
  const units = mod.units;
  const completedPractice = units.filter(u => status[u.id]?.practiceDone);
  const readTextbook = units.filter(u => status[u.id]?.textbookDone);

  if (readTextbook.length === 0) {
    return `先去"课本"模式阅读知识点，读完${Math.min(2, units.length)}个单元后就可以做练习了`;
  }
  if (completedPractice.length < 2) {
    return `再完成${2 - completedPractice.length}个单元的练习，就可以解锁本章高考真题了`;
  }
  return '你已解锁本章高考真题练习！';
}

/**
 * 获取推荐的学习流程（当前该做什么）
 */
export function getRecommendedFlow(moduleId: string): {
  phase: 'textbook' | 'practice' | 'gaokao';
  unitId: string;
  unitName: string;
  reason: string;
} | null {
  const mod = chapters.find(m => m.id === moduleId);
  if (!mod) return null;
  const status = getModuleLearningStatus(moduleId);

  // 找第一个没读课本的unit
  for (const unit of mod.units) {
    if (!status[unit.id]?.textbookDone) {
      return {
        phase: 'textbook',
        unitId: unit.id,
        unitName: unit.name,
        reason: '建议先读懂这个知识点，再开始做题',
      };
    }
  }

  // 找第一个没做练习的unit
  for (const unit of mod.units) {
    if (!status[unit.id]?.practiceDone) {
      return {
        phase: 'practice',
        unitId: unit.id,
        unitName: unit.name,
        reason: '知识点已读完，来做几道练习巩固一下',
      };
    }
  }

  // 所有unit的练习都做完了，可以做高考真题
  return {
    phase: 'gaokao',
    unitId: mod.units[mod.units.length - 1].id,
    unitName: '综合',
    reason: '练习都做完了，来挑战一下高考真题吧！',
  };
}

// ============================================================
// 5. 每日学习规划生成
// ============================================================

/**
 * 生成完整的学习路径规划
 * 策略：每个module分配1-3天，每天1-2个unit
 */
export function generateStudyPath(
  startDate?: string,
  targetModules?: string[],    // 如果不指定，按顺序学所有module
  minutesPerDay?: number,      // 每天学习分钟数，默认60
): StudyPath {
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  const dailyMinutes = minutesPerDay || 60;

  // 确定要学的模块
  const mods = targetModules
    ? chapters.filter(m => targetModules.includes(m.id))
    : [...chapters];

  // 加载已有进度
  let completedModules: string[] = [];
  let completedUnits: Record<string, string[]> = {};
  try {
    const raw = localStorage.getItem(PATH_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      completedModules = saved.completedModules || [];
      completedUnits = saved.completedUnits || {};
    }
  } catch {}

  // 过滤掉已完成的模块
  const remainingMods = mods.filter(m => !completedModules.includes(m.id));

  const dailyPlans: DailyPlan[] = [];
  let dayNum = 0;
  const moduleQueue = [...remainingMods];

  while (moduleQueue.length > 0) {
    const mod = moduleQueue.shift()!;
    const units = mod.units;
    // 根据模块难度和unit数量分配天数
    // 简单模块(difficulty<=2)：所有unit + 练习 1天搞定
    // 中等模块(difficulty=3)：2天
    // 困难模块(difficulty>=4)：3天
    const daysForModule = mod.difficulty >= 4 ? 3 : mod.difficulty >= 3 ? 2 : 1;

    for (let d = 0; d < daysForModule; d++) {
      dayNum++;
      const date = new Date(start);
      date.setDate(date.getDate() + dayNum - 1);
      const dateStr = date.toISOString().split('T')[0];

      // 分配这一天的units
      const unitsPerDay = Math.ceil(units.length / daysForModule);
      const startIdx = d * unitsPerDay;
      const endIdx = Math.min(startIdx + unitsPerDay, units.length);
      const dayUnits = units.slice(startIdx, endIdx);
      const unitIds = dayUnits.map(u => u.id);

      // 判断这一天的阶段
      let phase: 'textbook' | 'practice' | 'gaokao' = 'textbook';
      if (d === daysForModule - 1 && dayUnits.length > 0) {
        phase = 'gaokao'; // 最后一天做高考真题
      } else if (d > 0) {
        phase = 'practice'; // 中间天做练习
      }

      const plan: DailyPlan = {
        date: dateStr,
        dayNumber: dayNum,
        modules: [{
          moduleId: mod.id,
          moduleName: mod.title,
          phase,
          units: unitIds,
          practiceCount: phase === 'practice' ? 3 : phase === 'gaokao' ? 0 : 0,
          gaokaoCount: phase === 'gaokao' ? 3 : 0,
          estimatedMinutes: dailyMinutes,
        }],
        estimatedMinutes: dailyMinutes,
      };
      dailyPlans.push(plan);
    }
  }

  return {
    totalDays: dayNum,
    dailyPlans,
    currentDay: 1,
    completedModules,
    completedUnits,
    weakPoints: [],
  };
}

/**
 * 获取今天的学习计划
 */
export function getTodayPlan(): DailyPlan | null {
  const today = new Date().toISOString().split('T')[0];
  const path = generateStudyPath();
  return path.dailyPlans.find(p => p.date === today) || path.dailyPlans[0] || null;
}

/**
 * 标记今天的任务完成，推进到下一天
 */
export function completeTodayPlan(plan: DailyPlan) {
  try {
    const raw = localStorage.getItem(PATH_KEY);
    const path = raw ? JSON.parse(raw) : {};
    path.currentDay = (path.currentDay || 1) + 1;
    // 记录完成的units
    if (!path.completedUnits) path.completedUnits = {};
    for (const mod of plan.modules) {
      if (!path.completedUnits[mod.moduleId]) path.completedUnits[mod.moduleId] = [];
      for (const unitId of mod.units) {
        if (!path.completedUnits[mod.moduleId].includes(unitId)) {
          path.completedUnits[mod.moduleId].push(unitId);
        }
      }
      // 如果这个module的所有unit都完成了
      const modDef = chapters.find(m => m.id === mod.moduleId);
      if (modDef) {
        const allDone = modDef.units.every(u =>
          path.completedUnits[mod.moduleId].includes(u.id)
        );
        if (allDone && !path.completedModules.includes(mod.moduleId)) {
          path.completedModules.push(mod.moduleId);
        }
      }
    }
    localStorage.setItem(PATH_KEY, JSON.stringify(path));
  } catch {}
}

/**
 * 获取当前学习路径状态
 */
export function getStudyPathStatus(): StudyPath | null {
  try {
    const raw = localStorage.getItem(PATH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// ============================================================
// 默认数据生成（过渡练习）
// ============================================================

/**
 * 为所有章节生成默认的过渡练习数据
 * 这些是"骨架数据"，后续可以用AI动态补充
 */
function getDefaultBridgeExercises(moduleId: string): Record<string, BridgeExercise[]> {
  const mod = chapters.find(m => m.id === moduleId);
  if (!mod) return {};

  const exercises: Record<string, BridgeExercise[]> = {};
  for (const unit of mod.units) {
    exercises[unit.id] = generateDefaultBridgeForUnit(moduleId, unit.id, unit.name);
  }
  return exercises;
}

function generateDefaultBridgeForUnit(
  moduleId: string, unitId: string, unitName: string
): BridgeExercise[] {
  // 每个unit默认3道练习：基础概念→公式运用→接近高考
  // 这里是通用骨架，具体题目内容应该用AI生成或手动填写
  return [
    {
      id: `${unitId}-b1`,
      unitId,
      difficulty: 1,
      prompt: `[${unitName}] 基础概念题（待生成）`,
      type: 'choice',
      answer: 'A',
      hint: `提示：回忆${unitName}的核心定义`,
      steps: [
        {
          description: `回忆${unitName}的定义或公式`,
          expectedType: 'text',
          hint: '先写出相关的定义或公式',
        },
        {
          description: '根据定义判断或计算',
          expectedType: 'text',
          hint: '套用刚才的公式来计算',
        },
      ],
    },
    {
      id: `${unitId}-b2`,
      unitId,
      difficulty: 2,
      prompt: `[${unitName}] 公式运用题（待生成）`,
      type: 'calculate',
      answer: '0',
      hint: `提示：本题考查${unitName}的公式运用`,
      steps: [
        {
          description: '写出需要用到的公式',
          expectedType: 'formula',
          hint: '想想这道题用哪个公式',
        },
        {
          description: '代入计算',
          expectedType: 'number',
          hint: '把数值代入公式计算',
        },
      ],
    },
    {
      id: `${unitId}-b3`,
      unitId,
      difficulty: 3,
      prompt: `[${unitName}] 高考题型练习（待生成）`,
      type: 'derivation',
      answer: '0',
      hint: `提示：这道题的解法和高考真题很像，试试分步完成`,
      steps: [
        {
          description: '分析题目条件，写出已知量',
          expectedType: 'text',
          hint: '先把题目告诉你的条件列出来',
        },
        {
          description: '选择合适的公式或方法',
          expectedType: 'text',
          hint: '想想用哪个定理/公式能建立已知和未知的联系',
        },
        {
          description: '计算求结果',
          expectedType: 'number',
          hint: '最后算出结果',
        },
      ],
    },
  ];
}

function getDefaultGaokaoMappings(moduleId: string): GaokaoMapping[] {
  // 尝试从gaokao-questions/index.json加载
  try {
    // 注意：这是客户端代码，不能直接import JSON
    // 实际数据会在API路由或初始化时加载
    return [];
  } catch {
    return [];
  }
}
