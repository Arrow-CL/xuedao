import { NextRequest, NextResponse } from "next/server";
import { hasLocalSolution, getLocalSolution } from "@/lib/solution-engine";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const questionId = searchParams.get("questionId");

  if (!questionId) {
    return NextResponse.json({ error: "Missing questionId" }, { status: 400 });
  }

  const hasSol = hasLocalSolution(questionId);

  if (hasSol) {
    const solution = getLocalSolution(questionId);
    return NextResponse.json({
      hasSolution: true,
      solution: {
        questionId: solution!.questionId,
        standardProcess: solution!.standardProcess,
        finalAnswer: solution!.finalAnswer,
        knowledgePoints: solution!.knowledgePoints,
      },
    });
  }

  return NextResponse.json({ hasSolution: false });
}
