export interface Question {
  id: string; source: string; year?: number;
  chapter: string; chapters: string[];
  difficulty: number; round: number[];
  type: string; prompt: string;
  answer: any; options?: string[];
  steps: any[]; tags: string[];
  status: string;
}
export interface QuestionFilter {
  chapter?: string; year?: number; round?: number;
}