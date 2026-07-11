# 初赛 Demo 功能完善 - 新会话任务文档

> 本文档用于指导三个新 TRAE 会话的开发任务。每个会话独立完成一个功能模块，完成后自然获得不同的 Session ID。

---

## 会话 1：图片/截图识别 + 判断对错

### 目标
学生在做题对话中可以发送手写过程图片或截图，系统识别后 AI 判断对错并继续引导。

### 技术方案

#### 1.1 对话框添加图片上传入口
- 文件：`src/app/solve/page.tsx`
- 在输入框区域（约第815行）添加一个图片上传按钮（📎 或 ImagePlus 图标），位于发送按钮左侧
- 支持两种方式：点击上传 + 粘贴（Ctrl+V）
- 上传后显示缩略图预览，可以删除后重新上传
- 图片先压缩（复用 `@/lib/image-utils` 的 `compressImage`），限制最大 2MB
- 发送时将图片转为 base64，通过 API 传给后端

#### 1.2 OCR 识别路由
- 文件：新建 `src/app/api/student-image/route.ts`
- **双引擎策略**：
  1. 先尝试百度 OCR（API Key 已配置在 .env.local：`BAIDU_OCR_API_KEY` + `BAIDU_OCR_SECRET_KEY`）
  2. 如果百度 OCR 识别结果为空或质量差（文字少于5个字符），fallback 到 qwen 视觉模型（`qwen-vl-max`）
- 百度 OCR 用的是通用文字识别 API：https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic
  - 先用 API Key + Secret Key 获取 access_token
  - 然后调用识别接口
- Qwen 视觉模型用已有的 qwen-vl 调用方式（参考 `src/app/api/vision-qwen/route.ts`）
- 识别 prompt：`请识别这张图片中的数学表达式和文字，保持数学符号和公式的准确性，用纯文本输出。如果是手写内容，请将手写数学符号转为标准LaTeX格式，用 $...$ 包裹。`

#### 1.3 AI 判断流程
- 文件：`src/app/api/guide/route.ts`
- 在 guide API 中增加参数 `studentImageUrl`（base64）
- 如果收到图片，先调用 student-image API 做识别，将识别结果作为 `studentInput` 传给 AI
- AI 正常判断对错并引导下一步（逻辑不变）

#### 1.4 前端交互流程
```
学生点击上传/粘贴图片 → 显示预览 → 点击发送
  → 前端发送 { studentImageUrl: base64, questionId, ... } 到 /api/guide
  → 后端识别图片 → 得到文本 → AI判断 → 返回回复
  → 对话框显示：学生消息显示缩略图 + AI回复
```

#### 1.5 注意事项
- 百度 OCR 对数学公式识别较差，尤其是分数、根号等，所以一定要有 qwen fallback
- 学生消息气泡要支持显示图片（目前只显示文字）
- 压缩图片到合理大小，避免 base64 过大导致请求超时

---

## 会话 2：左侧板书区（已引导通过的解题步骤）

### 目标
在解题页面的左侧区域，将 AI 已确认正确的步骤以板书形式展示，形成完整的解题过程记录。

### 技术方案

#### 2.1 数据结构设计
- 文件：`src/lib/types.ts`
- 新增类型：
```typescript
interface BoardStep {
  stepNumber: number;        // 步骤编号
  content: string;           // 步骤内容（LaTeX）
  isCorrect: boolean;        // 是否确认正确
  timestamp: number;         // 记录时间
}
```

#### 2.2 板书状态管理
- 文件：`src/app/solve/page.tsx`
- 新增 state：`const [boardSteps, setBoardSteps] = useState<BoardStep[]>([]);`
- **核心逻辑**：在 sendMessage 的 AI 回复处理中，检测到学生步骤被确认正确时，将该步骤添加到板书
- 判断依据：
  - 如果 AI 回复中包含正向信号（"很好"、"正确"、"没错"、"对的"、"就是这样"、"可以"）且不是最终完成
  - 同时提取 AI 回复中总结的该步骤结论（AI 在 prompt 中已经会总结）
  - 添加到 boardSteps

#### 2.3 AI Prompt 调整
- 文件：`src/app/api/guide/route.ts`
- 在 prompt 中增加规则：当学生回答正确时，在该步回复末尾用 `[STEP:步骤编号|步骤结论LaTeX]` 标记
  - 例如学生第一步算对了，AI回复末尾加 `[STEP:1|$f(x) = x^2 - 2x + 1$]`
- 前端解析 `[STEP:n|content]` 标记，自动提取到板书

#### 2.4 左侧布局调整
- 文件：`src/app/solve/page.tsx`
- 当前左侧只显示题目（约第683行），改为上下分区：
  - 上方：题目显示（不变）
  - 下方：板书区域（新增）
- 板书区域：
  - 标题："解题板书"
  - 每个步骤显示为卡片：`步骤1: xxx`
  - 步骤间用连接线或箭头连接
  - 空状态显示："完成正确步骤后将自动记录在这里"
  - 背景用浅色网格线，模拟黑板/稿纸效果
  - 步骤内容用 `<MathContent>` 渲染 LaTeX

#### 2.5 板书样式参考
```
┌─────────────────────────┐
│  题目                    │  ← 原有题目区域
│  ...                     │
├─────────────────────────┤
│  📝 解题板书             │  ← 新增板书区域
│                          │
│  ① $f(x) = x^2-2x+1$   │
│       ↓                  │
│  ② $f'(x) = 2x-2$      │
│       ↓                  │
│  ③ 令 $2x-2=0$ ...      │
│                          │
└─────────────────────────┘
```

#### 2.6 注意事项
- 板书只在 AI 确认正确后才添加，做错的不展示
- 切换到下一题时清空板书
- 板书区域需要有足够的滚动空间

---

## 会话 3：UI 美化 + 学习地图升级

### 目标
提升整体视觉效果，让 Demo 更有冲击力。

### 技术方案

#### 3.1 学习地图视觉升级
- 文件：`src/app/page.tsx`
- 章节卡片升级：
  - 已通关：添加微光/渐变效果（green-50 → emerald-100 渐变背景）
  - 进行中：添加脉冲动画边框（amber 色）
  - 未解锁：更明显的锁住效果（灰色 + 模糊）
- 章节卡片增加知识点数量显示
- 章节之间加连接线（用 SVG 或 CSS 伪元素），形成路径感
- 顶部统计卡片：
  - 添加渐变背景色
  - 数字用更大字号 + 粗体
  - 添加趋势小图标

#### 3.2 首页英雄区域
- 在学习地图上方添加一个简短的欢迎区：
  - 显示学生昵称或"同学你好"
  - 今日学习目标提示
  - 整体进度环

#### 3.3 整体配色优化
- 主色从 `indigo` 调整为更有教育感的配色方案（可选）：
  - 主色：`#4F46E5`（靛蓝）保持不变，或换成更活泼的蓝紫
  - 辅色：amber/orange 用于激励和提示
  - 成功色：green 保持
- 按钮样式：增加 hover 动画（scale 微放大 + shadow）
- 卡片：增加 hover 时的微交互（translate-y + shadow 变化）

#### 3.4 解题页面美化
- 文件：`src/app/solve/page.tsx`
- 顶栏增加章节进度条（细线型，全宽）
- 对话气泡样式优化：
  - AI 消息：添加 AI 头像小图标
  - 学生消息：添加学生头像小图标
- 快捷按钮美化：更圆润、添加微动画
- 通关页面：添加庆祝动画（confetti 效果或简单的粒子动画）

#### 3.5 注意事项
- 不要过度设计，保持简洁
- 确保移动端适配（Tailwind 响应式）
- 性能优先，不要加影响加载速度的重动画

---

## Session ID 收集方式

每个会话完成后，记录该会话的 Session ID：
- 在 TRAE 中查看 `c:\Users\22407\.trae-cn\memory\projects\-d-360MoveData-Users-22407-Documents-New-project\{日期}\topics.md`
- 提取 `[session_id: xxx | ...]` 中的 session_id
- 初赛要求 3 个以上 Session ID，加上当前会话 `6a49db6d3eb17439f2f389f2`，共 4 个

## 每次开发完成后的操作

1. `git add . && git commit -m "feat: xxx" && git push`
2. `npx vercel --prod --yes` 重新部署
3. 验证线上效果：https://study-math-mocha.vercel.app
