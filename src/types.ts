// === 错误标签体系 ===
export type ErrorTag =
  | 'formula-recall'       // 公式记错/记混
  | 'substitution-error'   // 代入数值错误
  | 'calculation'          // 运算出错
  | 'sign-error'           // 正负号搞错
  | 'misconception';       // 概念混淆

// === 公式校验结果 ===
export interface ValidationResult {
  isCorrect: boolean;
  confidence: number;     // 0~1
  hint: string;           // 不依赖 AI 的纯代码提示
  errorTag?: ErrorTag;    // 识别到的错误类型（用于精准引导）
}

// === 题目参数（扩展到 5 个通用参数）===
export interface EquationParams {
  latex: string;
  a: number;
  b: number;
  c: number;
  d?: number;
  e?: number;
}

// === 练习步骤 ===
export interface ExerciseStep {
  key: string;
  description: string;
  formulaKey?: string;     // 对应 formulas.ts 中的公式
  expectedValue?: number;  // 数值答案
  tolerance?: number;      // 容差（默认 0.001）
  // 可选：覆盖全局 params 的局部参数
  params?: { a?: number; b?: number; c?: number; d?: number; e?: number };
}

// === 练习题定义 ===
export interface Exercise {
  id: string;
  type: string;
  difficulty: number;
  equation: EquationParams;
  prompt: string;
  answer: number;
  steps: ExerciseStep[];
  tags: ErrorTag[];
  commonMistakes: { pattern: string; tag: ErrorTag }[];
}

// === 练习单元 ===
export interface ExerciseUnit {
  unit: string;
  exercises: Exercise[];
}

// === 章节模块定义 ===
export interface StudyModule {
  id: string;
  title: string;
  subject: string;
  grade: 'middle' | 'high' | 'both';
  difficulty: number;
  prerequisites: string[];
  order: number;
  units: { id: string; name: string }[];
}

// === 用户进度 ===
export interface ModuleProgress {
  completedUnits: string[];
  unitAttempts: number;
  lastUnitId: string;
  lastStudiedAt: number;
}

export interface UserProgress {
  userId: string;
  moduleProgress: { [moduleId: string]: ModuleProgress };
  streak: { current: number; lastDate: string; longest: number };
}

// === 错误记录 ===
export interface ErrorRecord {
  userId: string;
  exerciseId: string;
  tags: ErrorTag[];
  studentAnswer: string;
  correctAnswer: number;
  timestamp: number;
  moduleId: string;
}

// === 存储层接口 ===
export interface StorageBackend {
  getProgress(userId: string): Promise<UserProgress>;
  saveProgress(userId: string, progress: UserProgress): Promise<void>;
  logError(userId: string, error: ErrorRecord): Promise<void>;
  getErrors(userId: string, moduleId?: string): Promise<ErrorRecord[]>;
  getCollectedIds(userId: string): Promise<string[]>;
  toggleCollect(userId: string, questionId: string): Promise<void>;
}

// === 引导状态 ===
export type HintLevel = 0 | 1 | 2 | 3;

export interface HintState {
  level: HintLevel;
  lastHintTime: number;
  stepCount: number;
  buttonDisabled: boolean;
}

// === 章节掌握状态 ===
export interface ModuleMastery {
  moduleId: string;
  challengeCompleted: boolean;
  challengeCompletedAt?: number;
}

// === 薄弱点记录 ===
export interface WeakPoint {
  moduleId: string;
  stepKey: string;        // 如 "discriminant"
  description: string;    // 如 "代入时负数符号搞错"
  count: number;          // 卡壳次数
  lastOccurred: number;   // 时间戳
}

export interface StudyRecord {
  userId: string;
  mastery: { [moduleId: string]: ModuleMastery };
  weakPoints: WeakPoint[];
}

// === 解题轨迹系统：本地步骤引擎核心 ===

export type StepStatus =
  | 'pending'      // 待验证
  | 'correct'      // 正确（本地验证通过）
  | 'correct-ai'   // 正确（AI判断通过）
  | 'error'        // 有错误
  | 'incomplete'   // 没写完（过程不完整但没明显错误）
  | 'help-step';   // 系统帮助生成的步骤

export type StepVerification = 'local' | 'ai' | 'none';

export interface ParsedStep {
  id: string;
  raw: string;                    // 学生原始输入
  expressions: string[];          // 提取出的数学表达式列表
  textExplanation: string;        // 非数学的文字说明部分
  status: StepStatus;
  verifiedBy: StepVerification;
  confidence: number;             // 0~1，判断置信度
  errorType?: string;             // 检测到的错误类型
  errorHint?: string;             // 本地生成的错误提示
  expectedNextHint?: string;      // 对下一步的引导提示
  isFromHelp?: boolean;           // 是否是系统帮助生成的
  timestamp: number;
}

export interface SolutionTrace {
  questionId: string;
  questionText: string;
  questionType?: string;          // 题目类型：quadratic, trig, derivative等
  knownParams: Record<string, number>;  // 从题目中提取的已知参数（如a=1,b=2,c=1）
  derivedVars: Record<string, number>;  // 解题过程中求出的中间变量
  steps: ParsedStep[];
  completed: boolean;
  finalAnswer?: string;
  aiCallCount: number;            // 本次解题调用AI次数（用于监控和优化）
  lastLocalVerdict?: string;      // 本地最后一次判断结论
}

export interface ContinuationResult {
  canContinue: boolean;           // 本地能否续写
  nextExpression?: string;        // 下一步的数学表达式
  explanation: string;            // "上一步怎么到下一步"的讲解
  isFinal?: boolean;              // 是否是最终答案
  needAI?: boolean;               // 是否需要AI介入
  aiPromptHint?: string;          // 如果需要AI，给AI的提示
}

export interface StepAnalysisResult {
  hasError: boolean;              // 是否检测到错误
  isCorrect: boolean;             // 是否正确
  isComplete: boolean;            // 过程是否完整到达答案
  confidence: number;             // 判断置信度
  errorStep?: ParsedStep;         // 出错的步骤
  errorType?: string;
  localHint?: string;             // 本地生成的提示
  needAI: boolean;                // 是否需要AI介入判断
  progress: number;               // 0~1，估计解题进度
  derivedVars?: Record<string, number>;  // 新发现的中间变量
}

// === 学习路径系统：知识点→练习→高考真题→每日规划 ===

export interface LearningUnit {
  moduleId: string;            // 所属章节ID（如 "trigonometric"）
  unitId: string;               // 单元ID（如 "trig-basics"）
  unitName: string;             // 单元名称
  order: number;                // 在章节中的顺序
  contentReady: boolean;        // 知识点内容是否已就绪
  bridgeExercises: BridgeExercise[];  // 过渡练习（学完知识点后的练习）
  relatedGaokao: GaokaoMapping[];     // 关联的高考真题
}

export interface BridgeExercise {
  id: string;
  unitId: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  type: 'calculate' | 'formula' | 'choice' | 'derivation';
  options?: string[];
  answer: string;
  hint?: string;
  steps: {
    description: string;
    expectedType: 'number' | 'formula' | 'text';
    expectedValue?: string | number;
    hint: string;
  }[];
  sourceGaokaoIds?: string[];   // 关联的高考真题ID（标注"这道练习对应哪道高考题"）
}

export interface GaokaoMapping {
  id: string;
  year: number;
  paper: string;
  number: number;
  prompt: string;
  type: string;
  difficulty: number;
  chapters: string[];
  requiredUnits: string[];      // 做这道高考题需要先学完的unit列表
}

export interface DailyPlan {
  date: string;                 // YYYY-MM-DD
  dayNumber: number;             // 第几天
  modules: DailyModulePlan[];
  estimatedMinutes: number;
}

export interface DailyModulePlan {
  moduleId: string;
  moduleName: string;
  phase: 'textbook' | 'practice' | 'gaokao';
  units: string[];              // 当天要学的unit IDs
  practiceCount: number;         // 过渡练习题数
  gaokaoCount: number;          // 高考真题数
  estimatedMinutes: number;
}

export interface StudyPath {
  totalDays: number;
  dailyPlans: DailyPlan[];
  currentDay: number;
  completedModules: string[];
  completedUnits: Record<string, string[]>;
  weakPoints: string[];
}
