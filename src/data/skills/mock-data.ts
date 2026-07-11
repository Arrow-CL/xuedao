import content from "./content.json";
import { SkillData } from "@/types/skill";
export var skillContents: Record<string, SkillData> = content as any;
export var mapChapters = [
  { id: "sets-logic", title: "集合与常用逻辑用语", order: 1,
    skills: [{ id: "set-concept", title: "集合的概念与表示" }, { id: "set-relations", title: "集合间的基本关系" }, { id: "set-operations", title: "集合的基本运算" }]
  },
];