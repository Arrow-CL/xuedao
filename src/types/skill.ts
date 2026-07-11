export interface Formula { id: string; latex: string; desc: string; }
export interface Property { id: string; title: string; content: string; }
export interface Example { id: string; problem: string; solution: string; steps: string[]; }
export interface RoundContent {
  formulas: Formula[]; properties: Property[]; examples: Example[];
}
export interface SkillData {
  id: string; title: string; chapterId: string;
  prerequisites: string[];
  round1: RoundContent; round2?: RoundContent; round3?: RoundContent;
}
export interface MapChapter {
  id: string; title: string; order: number;
  skills: { id: string; title: string; }[];
}