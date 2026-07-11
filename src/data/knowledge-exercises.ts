/**
 * 知识点练习题 - 按一数教辅风格
 * 特点：基础题练公式，带高考考法影子，不拐弯，直接套公式就能做
 */

export interface KnowledgeExercise {
  id: string;
  unitId: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  type: "calculate" | "choice" | "fill" | "solve";
  options?: string[];
  answer: string | number;
  gaokaoConnection?: string;
}

// 导入各章节练习题（从 JSON 文件）
import setsLogicData from "./sets-logic-exercises.json";
import inequalityData from "./inequality-exercises.json";
import funcDerivData from "./func-deriv-exercises.json";
import trigonometricData from "./trigonometric-exercises.json";
import trigTriangleData from "./trig-triangle-exercises.json";
import vectorData from "./vector-exercises.json";
import complexData from "./complex-exercises.json";
import sequenceData from "./sequence-exercises.json";
import solidData from "./solid-exercises.json";
import spaceVectorsData from "./space-vectors-exercises.json";
import analyticGeometryData from "./analytic-geometry-exercises.json";
import countingData from "./counting-exercises.json";
import probStatData from "./prob-stat-exercises.json";

// 将 JSON 数据转为 KnowledgeExercise 数组
const setsLogicExercises: KnowledgeExercise[] = (
  Object.values(setsLogicData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const inequalityExercises: KnowledgeExercise[] = (
  Object.values(inequalityData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const funcDerivExercises: KnowledgeExercise[] = (
  Object.values(funcDerivData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const trigonometricExercises: KnowledgeExercise[] = (
  Object.values(trigonometricData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const trigTriangleExercises: KnowledgeExercise[] = (
  Object.values(trigTriangleData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const vectorExercises: KnowledgeExercise[] = (
  Object.values(vectorData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const complexExercises: KnowledgeExercise[] = (
  Object.values(complexData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const sequenceExercises: KnowledgeExercise[] = (
  Object.values(sequenceData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const solidExercises: KnowledgeExercise[] = (
  Object.values(solidData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const spaceVectorsExercises: KnowledgeExercise[] = (
  Object.values(spaceVectorsData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const analyticGeometryExercises: KnowledgeExercise[] = (
  Object.values(analyticGeometryData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const countingExercises: KnowledgeExercise[] = (
  Object.values(countingData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

const probStatExercises: KnowledgeExercise[] = (
  Object.values(probStatData) as { title: string; exercises: any[] }[]
).flatMap((unit) => unit.exercises.map((ex) => ({
  id: ex.id,
  unitId: ex.unitId,
  difficulty: ex.difficulty as 1 | 2 | 3,
  prompt: ex.prompt,
  type: ex.type as KnowledgeExercise["type"],
  options: ex.options,
  answer: ex.answer,
  gaokaoConnection: ex.gaokaoConnection,
})));

/**
 * 一元二次方程 - 判别式
 * 一数风格：先练直接计算，再练判断根，再练简单应用
 */
export const discriminantExercises: KnowledgeExercise[] = [
  {
    id: "disc-1",
    unitId: "ineq-polynomial",
    difficulty: 1,
    prompt: "方程 x² - 5x + 6 = 0 的判别式 Δ 的值是多少？",
    type: "calculate",
    answer: 1,
    gaokaoConnection: "判别式计算是高考基础，选择填空第一题经常考"
  },
  {
    id: "disc-2",
    unitId: "ineq-polynomial",
    difficulty: 1,
    prompt: "方程 x² - 2x + 1 = 0 的根的情况是？",
    type: "choice",
    options: ["两个不相等的实数根", "两个相等的实数根", "没有实数根"],
    answer: "两个相等的实数根",
    gaokaoConnection: "判断根的情况是高考高频考点"
  },
  {
    id: "disc-3",
    unitId: "ineq-polynomial",
    difficulty: 2,
    prompt: "若方程 x² - 2x + m = 0 有两个不相等的实数根，则 m 的取值范围是？",
    type: "calculate",
    answer: "m < 1",
    gaokaoConnection: "含参数的判别式问题，是高考标准考法"
  }
];

/**
 * 一元二次方程 - 韦达定理（两根之和、两根之积）
 */
export const vietaExercises: KnowledgeExercise[] = [
  {
    id: "vieta-1",
    unitId: "ineq-polynomial",
    difficulty: 1,
    prompt: "方程 x² - 5x + 6 = 0 的两根之和 x₁ + x₂ = ？",
    type: "calculate",
    answer: 5,
    gaokaoConnection: "韦达定理是选择填空必考题"
  },
  {
    id: "vieta-2",
    unitId: "ineq-polynomial",
    difficulty: 1,
    prompt: "方程 x² - 5x + 6 = 0 的两根之积 x₁·x₂ = ？",
    type: "calculate",
    answer: 6,
    gaokaoConnection: "两根之积是韦达定理最基础的考法"
  },
  {
    id: "vieta-3",
    unitId: "ineq-polynomial",
    difficulty: 2,
    prompt: "方程 2x² - 4x + 1 = 0 的两根为 x₁, x₂，则 x₁ + x₂ = ？",
    type: "calculate",
    answer: 2,
    gaokaoConnection: "注意a不是1的情况，高考经常考"
  }
];

/**
 * 一元二次方程 - 求根公式
 */
export const quadraticFormulaExercises: KnowledgeExercise[] = [
  {
    id: "root-1",
    unitId: "ineq-polynomial",
    difficulty: 1,
    prompt: "解方程 x² - 5x + 6 = 0，x₁ = ？（小的那个根）",
    type: "calculate",
    answer: 2,
    gaokaoConnection: "解一元二次方程是所有计算的基础"
  },
  {
    id: "root-2",
    unitId: "ineq-polynomial",
    difficulty: 1,
    prompt: "解方程 x² - 5x + 6 = 0，x₂ = ？（大的那个根）",
    type: "calculate",
    answer: 3,
    gaokaoConnection: "求根公式必须练熟"
  },
  {
    id: "root-3",
    unitId: "ineq-polynomial",
    difficulty: 2,
    prompt: "方程 x² - 4x + 4 = 0 的根是？",
    type: "calculate",
    answer: 2,
    gaokaoConnection: "重根的情况，高考经常考"
  }
];

/**
 * 所有知识点练习题汇总
 * 按 unitId 索引
 */
export const knowledgeExercises: Record<string, KnowledgeExercise[]> = {
  // 第一章：集合与常用逻辑用语（5个单元）
  concept: setsLogicExercises.filter((e) => e.unitId === "concept"),
  relations: setsLogicExercises.filter((e) => e.unitId === "relations"),
  operations: setsLogicExercises.filter((e) => e.unitId === "operations"),
  condition: setsLogicExercises.filter((e) => e.unitId === "condition"),
  quantifier: setsLogicExercises.filter((e) => e.unitId === "quantifier"),
  // 第二章：一元二次函数，方程和不等式
  "ineq-properties": inequalityExercises.filter((e) => e.unitId === "ineq-properties"),
  "ineq-polynomial": [
    ...discriminantExercises,
    ...vietaExercises,
    ...quadraticFormulaExercises,
    ...inequalityExercises.filter((e) => e.unitId === "ineq-polynomial"),
  ],
  "ineq-mean": inequalityExercises.filter((e) => e.unitId === "ineq-mean"),
  // 第三章：函数的概念与性质
  "func-foundation": funcDerivExercises.filter((e) => e.unitId === "func-foundation"),
  "func-monotonicity": funcDerivExercises.filter((e) => e.unitId === "func-monotonicity"),
  "func-parity": funcDerivExercises.filter((e) => e.unitId === "func-parity"),
  "func-symmetry-periodicity": funcDerivExercises.filter((e) => e.unitId === "func-symmetry-periodicity"),
  "func-transform": funcDerivExercises.filter((e) => e.unitId === "func-transform"),
  "func-zeros": funcDerivExercises.filter((e) => e.unitId === "func-zeros"),
  // 第十五章：导数及其应用
  "derivative-concept": funcDerivExercises.filter((e) => e.unitId === "derivative-concept"),
  "derivative-monotonicity": funcDerivExercises.filter((e) => e.unitId === "derivative-monotonicity"),
  "derivative-extremum": funcDerivExercises.filter((e) => e.unitId === "derivative-extremum"),
  "derivative-always": funcDerivExercises.filter((e) => e.unitId === "derivative-always"),
  "derivative-zeros": funcDerivExercises.filter((e) => e.unitId === "derivative-zeros"),
  "derivative-construct": funcDerivExercises.filter((e) => e.unitId === "derivative-construct"),
  // 第五章：三角函数
  "trig-def": trigonometricExercises.filter((e) => e.unitId === "trig-def"),
  "trig-same-angle": trigonometricExercises.filter((e) => e.unitId === "trig-same-angle"),
  "trig-induction": trigonometricExercises.filter((e) => e.unitId === "trig-induction"),
  "trig-identities": trigonometricExercises.filter((e) => e.unitId === "trig-identities"),
  "trig-graphs": trigonometricExercises.filter((e) => e.unitId === "trig-graphs"),
  "trig-gaokao": trigonometricExercises.filter((e) => e.unitId === "trig-gaokao"),
  "trig-triangle": trigTriangleExercises.filter((e) => e.unitId === "trig-triangle"),
  // 第六章：平面向量及其应用
  "vec-linear": vectorExercises.filter((e) => e.unitId === "vec-linear"),
  "vec-dot": vectorExercises.filter((e) => e.unitId === "vec-dot"),
  "vec-coord": vectorExercises.filter((e) => e.unitId === "vec-coord"),
  "vec-geometry": vectorExercises.filter((e) => e.unitId === "vec-geometry"),
  "vec-mistakes": vectorExercises.filter((e) => e.unitId === "vec-mistakes"),
  // 第七章：复数
  "complex-basics": complexExercises.filter((e) => e.unitId === "complex-basics"),
  "complex-operations": complexExercises.filter((e) => e.unitId === "complex-operations"),
  "complex-geometry": complexExercises.filter((e) => e.unitId === "complex-geometry"),
  // 第八章：数列
  "arithmetic": sequenceExercises.filter((e) => e.unitId === "arithmetic"),
  "geometric": sequenceExercises.filter((e) => e.unitId === "geometric"),
  "seq-formula": sequenceExercises.filter((e) => e.unitId === "seq-formula"),
  "seq-sum": sequenceExercises.filter((e) => e.unitId === "seq-sum"),
  "seq-gaokao": sequenceExercises.filter((e) => e.unitId === "seq-gaokao"),
  // 第八章：立体几何初步
  "solid-shapes": solidExercises.filter((e) => e.unitId === "solid-shapes"),
  "solid-relations": solidExercises.filter((e) => e.unitId === "solid-relations"),
  "solid-sphere": solidExercises.filter((e) => e.unitId === "solid-sphere"),
  "solid-position": solidExercises.filter((e) => e.unitId === "solid-position"),
  // 第十一章：空间向量与立体几何
  "sv-basics": spaceVectorsExercises.filter((e) => e.unitId === "sv-basics"),
  "sv-comprehensive": spaceVectorsExercises.filter((e) => e.unitId === "sv-comprehensive"),
  "sv-choice": spaceVectorsExercises.filter((e) => e.unitId === "sv-choice"),
  // 第十二章：直线和圆的方程
  "line-equation": analyticGeometryExercises.filter((e) => e.unitId === "line-equation"),
  "circle-equation": analyticGeometryExercises.filter((e) => e.unitId === "circle-equation"),
  "point-circle": analyticGeometryExercises.filter((e) => e.unitId === "point-circle"),
  "line-circle-pos": analyticGeometryExercises.filter((e) => e.unitId === "line-circle-pos"),
  "circle-circle-pos": analyticGeometryExercises.filter((e) => e.unitId === "circle-circle-pos"),
  "symmetry-mistakes": analyticGeometryExercises.filter((e) => e.unitId === "symmetry-mistakes"),
  // 第十三章：圆锥曲线的方程
  "conic-basics": analyticGeometryExercises.filter((e) => e.unitId === "conic-basics"),
  "ellipse": analyticGeometryExercises.filter((e) => e.unitId === "ellipse"),
  "hyperbola": analyticGeometryExercises.filter((e) => e.unitId === "hyperbola"),
  "parabola": analyticGeometryExercises.filter((e) => e.unitId === "parabola"),
  "line-conic-method": analyticGeometryExercises.filter((e) => e.unitId === "line-conic-method"),
  "conic-conclusions": analyticGeometryExercises.filter((e) => e.unitId === "conic-conclusions"),
  "conic-mistakes": analyticGeometryExercises.filter((e) => e.unitId === "conic-mistakes"),
  // 第十六章：计数原理
  "counting-principles": countingExercises.filter((e) => e.unitId === "counting-principles"),
  "permutation": countingExercises.filter((e) => e.unitId === "permutation"),
  "combination": countingExercises.filter((e) => e.unitId === "combination"),
  "counting-strategy": countingExercises.filter((e) => e.unitId === "counting-strategy"),
  "binomial": countingExercises.filter((e) => e.unitId === "binomial"),
  "counting-mistakes": countingExercises.filter((e) => e.unitId === "counting-mistakes"),
  // 第九章：统计
  "sampling": probStatExercises.filter((e) => e.unitId === "sampling"),
  "estimation": probStatExercises.filter((e) => e.unitId === "estimation"),
  "correlation": probStatExercises.filter((e) => e.unitId === "correlation"),
  "independence-test": probStatExercises.filter((e) => e.unitId === "independence-test"),
  "stats-mistakes": probStatExercises.filter((e) => e.unitId === "stats-mistakes"),
  // 第十章：概率
  "event-prob": probStatExercises.filter((e) => e.unitId === "event-prob"),
  "classical-prob": probStatExercises.filter((e) => e.unitId === "classical-prob"),
  "geometric-prob": probStatExercises.filter((e) => e.unitId === "geometric-prob"),
  "conditional-independence": probStatExercises.filter((e) => e.unitId === "conditional-independence"),
  "prob-mistakes": probStatExercises.filter((e) => e.unitId === "prob-mistakes"),
  // 第十七章：随机变量及其分布
  "rv-basics": probStatExercises.filter((e) => e.unitId === "rv-basics"),
  "distribution": probStatExercises.filter((e) => e.unitId === "distribution"),
  "expectation": probStatExercises.filter((e) => e.unitId === "expectation"),
  "variance": probStatExercises.filter((e) => e.unitId === "variance"),
  "common-distributions": probStatExercises.filter((e) => e.unitId === "common-distributions"),
  "normal-distribution": probStatExercises.filter((e) => e.unitId === "normal-distribution"),
  "prob-template": probStatExercises.filter((e) => e.unitId === "prob-template"),
  "rv-mistakes": probStatExercises.filter((e) => e.unitId === "rv-mistakes"),
};

/**
 * 题库：所有练习题的 flat 列表（用于 /bank 页面）
 */
export const allExercises: KnowledgeExercise[] = Object.values(knowledgeExercises).flat();
