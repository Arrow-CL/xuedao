import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function getQuestions() {
  const indexPath = join(process.cwd(), "src/data/gaokao-questions/index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf-8"));

  // Flatten all questions with chapter info
  const allQuestions: any[] = [];
  Object.entries(index).forEach(([chapter, qs]: [string, any]) => {
    qs.forEach((q: any, i: number) => {
      allQuestions.push({
        id: `${chapter}:${q.year}:${q.number}:${i}`,
        ...q,
        chapter,
      });
    });
  });

  return allQuestions;
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET() {
  try {
    const all = getQuestions();

    // Separate by difficulty
    const easy = all.filter(q => q.difficulty === 1);
    const hard = all.filter(q => q.difficulty >= 2);

    if (easy.length === 0 || hard.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    // Randomly pick one easy and one hard
    const shuffledEasy = shuffleArray(easy);
    const shuffledHard = shuffleArray(hard);

    const selected = [
      shuffledEasy[0],
      shuffledHard[0],
    ];

    // Format for frontend
    const formatted = selected.map(q => ({
      id: q.id,
      prompt: q.prompt,
      answer: q.answer,
      difficulty: q.difficulty,
      year: q.year,
      paper: q.paper,
      type: q.type,
      options: q.options,
    }));

    return NextResponse.json({ questions: formatted });
  } catch {
    return NextResponse.json({ questions: [] });
  }
}
