import { Question, QuestionFilter } from "./types";

var gaokaoFiles = [
  function() { return import("@/data/questions/gaokao/2024/北京卷.json").then(function(m) { return m.default || m; }); },
];

function match(q: Question, f: QuestionFilter): boolean {
  if (f.chapter && !q.chapters.includes(f.chapter)) return false;
  if (f.year && q.year !== f.year) return false;
  if (f.round !== undefined && !q.round.includes(f.round)) return false;
  if (q.status === "deprecated") return false;
  return true;
}

export async function getQuestions(filter: QuestionFilter = {}): Promise<Question[]> {
  filter = filter || {};
  var result: Question[] = [];
  if (filter.chapter) {
    try {
      var ex = await import("@/data/questions/exercises/" + filter.chapter + ".json");
      result.push.apply(result, ((ex.default || ex).items || []));
    } catch(e) {
      try {
        var old = await import("@/data/" + filter.chapter + "/exercises.json");
        var oldItems = ((old.default || old).exercises || []).map(function(e: any) {
          return Object.assign({}, e, { source: "basic", chapter: filter.chapter, chapters: [filter.chapter], round: [1], status: "active" });
        });
        result.push.apply(result, oldItems);
      } catch(e2) {}
    }
  }
  for (var i = 0; i < gaokaoFiles.length; i++) {
    try { result.push.apply(result, ((await gaokaoFiles[i]()).questions || [])); } catch(e3) {}
  }
  return result.filter(function(q: Question) { return match(q, filter); });
}

export async function getAllQuestions(): Promise<Question[]> {
  return getQuestions({});
}