import { NextRequest, NextResponse } from "next/server";

/**
 * 临时接口：标记章节为已通关（仅开发环境可用）
 * 生产环境应删除此路由
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { chapterId } = await req.json();
  if (!chapterId) {
    return NextResponse.json({ error: "Missing chapterId" }, { status: 400 });
  }

  // 返回给前端一个脚本，让前端自己去执行 markChapterAllCovered
  return NextResponse.json({
    message: `请在浏览器控制台执行以下代码来标记 ${chapterId} 为已通关：`,
    script: `
// 在浏览器控制台执行：
const key = "xuedao_progress_v2";
const progress = JSON.parse(localStorage.getItem(key) || '{}');
if (!progress.chapters) progress.chapters = {};
progress.chapters["${chapterId}"] = {
  chapterId: "${chapterId}",
  completedQuestionIds: [],
  coveredKnowledgePointIds: [],
  isCleared: true,
  totalAttempted: 0,
};
localStorage.setItem(key, JSON.stringify(progress));
console.log("已标记 ${chapterId} 为通关");
location.reload();
    `.trim(),
  });
}
