import data from "./content.json";
const content: Record<string, Record<string, { title: string; content: string }>> = data as Record<string, Record<string, { title: string; content: string }>>;
export default content;
