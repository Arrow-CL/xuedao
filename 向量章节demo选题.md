# 向量章节 Demo 选题（4道题）

> 用于 Trae 初赛 demo 录制，覆盖向量章节核心知识点，4题正好触发小梳理。

---

## 第1题 · 坐标运算基础

**题目来源：** 2024·新课标Ⅰ卷·第3题  
**难度：** ⭐（简单）  
**题型：** 填空题  
**ID：** `gk-2024-xkb1-3`  
**知识点：** 向量坐标运算、向量垂直

**题目：**
> 已知向量 $\boldsymbol{a}=(0,1)$，$\boldsymbol{b}=(2,x)$，若 $\boldsymbol{b}\perp (\boldsymbol{b}-4\boldsymbol{a})$，则 $x=$____

**答案：** $2$

---

## 第2题 · 向量线性表示

**题目来源：** 2022·新课标Ⅰ卷·第3题  
**难度：** ⭐（简单）  
**题型：** 填空题  
**ID：** `gk-2022-xkb1-3`  
**知识点：** 平面向量基本定理、向量线性运算

**题目：**
> 在 $\triangle ABC$ 中，点 $D$ 在边 $AB$ 上，$BD=2DA$。记 $\overrightarrow{CA}=\boldsymbol{m}$，$\overrightarrow{CD}=\boldsymbol{n}$，则 $\overrightarrow{CB}=$____

**答案：** $-2\boldsymbol{m}+3\boldsymbol{n}$

---

## 第3题 · 数量积求模长

**题目来源：** 2024·新课标Ⅱ卷·第3题  
**难度：** ⭐⭐（中等）  
**题型：** 填空题  
**ID：** `gk-2024-xkb2-3`  
**知识点：** 向量数量积、向量模长

**题目：**
> 已知向量 $\boldsymbol{a},\boldsymbol{b}$ 满足 $|\boldsymbol{a}|=1$，$|\boldsymbol{a}+2\boldsymbol{b}|=2$，且 $(\boldsymbol{b}-2\boldsymbol{a})\perp \boldsymbol{b}$，则 $|\boldsymbol{b}|=$____

**答案：** $\dfrac{\sqrt{2}}{2}$

---

## 第4题 · 平行四边形向量综合（几何背景）

**题目来源：** 练习题（改编自经典题型）  
**难度：** ⭐⭐（中等）  
**题型：** 填空题  
**ID：** `vec-l5`  
**知识点：** 平面向量基本定理、向量线性运算、相似三角形（几何背景）

**题目：**
> 在平行四边形 $ABCD$ 中，$E$ 为 $AD$ 中点，$BE$ 交 $AC$ 于 $F$，则 $\overrightarrow{DF}=$____

**答案：** $\dfrac13\overrightarrow{AB}-\dfrac23\overrightarrow{AD}$

---

## 需要豆包生成的内容

对每道题，请按以下格式生成标准解题板书：

```json
{
  "id": "题目ID",
  "solution": {
    "finalAnswer": "最终答案",
    "knowledgePoints": ["涉及的知识点名称"],
    "steps": [
      {
        "stepNumber": 1,
        "action": "这一步做什么（用提问句式）",
        "expression": "这一步的数学表达式（LaTeX格式）",
        "result": "中间结论（如果有）",
        "reasoning": "这一步的推理依据",
        "checkHint": "验证方法提示",
        "stepGeometry": null
      }
      // ... 每道题 4-5 步，高考得分点标准
    ]
  }
}
```

**要求：**
- 每步用 `∵/∴` 推理格式，符合高考答题标准
- 纯代数化简步骤可合并，保留关键推理链
- 第4题（平行四边形）需要 **stepGeometry** 数据（数形结合），描述平行四边形图形状态
- 其余3题纯代数，`stepGeometry` 填 `null`

---

## 第1题标准答案示例（供参考）

**解题过程：**

$\because \boldsymbol{b}\perp (\boldsymbol{b}-4\boldsymbol{a})$  
$\therefore \boldsymbol{b}\cdot (\boldsymbol{b}-4\boldsymbol{a})=0$  
$\because \boldsymbol{b}=(2,x)$，$\boldsymbol{a}=(0,1)$  
$\therefore \boldsymbol{b}-4\boldsymbol{a}=(2,x-4)$  
$\therefore 2\times 2+x(x-4)=0$  
$\therefore x^2-4x+4=0$  
$\therefore (x-2)^2=0$  
$\therefore x=2$

---

## 第2题标准答案示例（供参考）

**解题过程：**

$\because BD=2DA$，$\overrightarrow{CA}=\boldsymbol{m}$，$\overrightarrow{CD}=\boldsymbol{n}$  
$\therefore \overrightarrow{AD}=\dfrac13\overrightarrow{AB}$  
$\because \overrightarrow{CD}=\overrightarrow{CA}+\overrightarrow{AD}=\boldsymbol{m}+\dfrac13\overrightarrow{AB}$  
$\therefore \overrightarrow{AB}=3(\boldsymbol{n}-\boldsymbol{m})$  
$\therefore \overrightarrow{CB}=\overrightarrow{CA}+\overrightarrow{AB}=\boldsymbol{m}+3\boldsymbol{n}-3\boldsymbol{m}=-2\boldsymbol{m}+3\boldsymbol{n}$

---

## 第3题标准答案示例（供参考）

**解题过程：**

$\because |\boldsymbol{a}+2\boldsymbol{b}|=2$  
$\therefore |\boldsymbol{a}|^2+4\boldsymbol{a}\cdot\boldsymbol{b}+4|\boldsymbol{b}|^2=4$  
$\because |\boldsymbol{a}|=1$  
$\therefore 1+4\boldsymbol{a}\cdot\boldsymbol{b}+4|\boldsymbol{b}|^2=4$  
$\because (\boldsymbol{b}-2\boldsymbol{a})\perp\boldsymbol{b}$  
$\therefore \boldsymbol{b}\cdot\boldsymbol{b}-2\boldsymbol{a}\cdot\boldsymbol{b}=0$  
$\therefore |\boldsymbol{b}|^2=2\boldsymbol{a}\cdot\boldsymbol{b}$  
$\therefore 1+2|\boldsymbol{b}|^2+4|\boldsymbol{b}|^2=4$  
$\therefore 6|\boldsymbol{b}|^2=3$  
$\therefore |\boldsymbol{b}|^2=\dfrac12$  
$\therefore |\boldsymbol{b}|=\dfrac{\sqrt{2}}{2}$

---

## 第4题标准答案示例（供参考）

**解题过程：**

$\because ABCD$ 为平行四边形  
$\therefore AD\parallel BC$，$AD=BC$  
$\because E$ 为 $AD$ 中点  
$\therefore AE=\dfrac12AD=\dfrac12BC$  
$\because AD\parallel BC$  
$\therefore \triangle AEF\sim\triangle CBF$  
$\therefore \dfrac{AF}{FC}=\dfrac{AE}{BC}=\dfrac12$  
$\therefore AF=\dfrac13AC$  
$\because \overrightarrow{AC}=\overrightarrow{AB}+\overrightarrow{AD}$  
$\therefore \overrightarrow{AF}=\dfrac13(\overrightarrow{AB}+\overrightarrow{AD})$  
$\therefore \overrightarrow{DF}=\overrightarrow{AF}-\overrightarrow{AD}=\dfrac13\overrightarrow{AB}+\dfrac13\overrightarrow{AD}-\overrightarrow{AD}=\dfrac13\overrightarrow{AB}-\dfrac23\overrightarrow{AD}$
