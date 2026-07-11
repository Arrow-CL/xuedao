import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function getIndex() { return JSON.parse(readFileSync(join(process.cwd(), "src/data/gaokao-questions/index.json"), "utf-8")); }

export async function GET(request: NextRequest) {
  const chapter = request.nextUrl.searchParams.get("chapter");
  
  const index = getIndex();
  if (chapter && index[chapter]) {
    const questions = index[chapter].map((q: any, i: number) => ({
      id: chapter + ":" + q.year + ":" + q.number + ":" + i,
      ...q,
      fullPrompt: (q.prompt || "") + (q.options && q.options.length > 0 ? "\n" + q.options.filter((o: any) => o.text && o.text.trim()).map((o: any) => o.label + ". " + (o.text || "")).join("\n") : "")
    }));
    return NextResponse.json({ questions });
  }
  
  const summary = Object.entries(index).map(([ch, qs]) => ({
    chapter: ch,
    count: (qs as any[]).length
  }));
  
  return NextResponse.json({ chapters: summary, total: Object.values(index).flat().length });
}
