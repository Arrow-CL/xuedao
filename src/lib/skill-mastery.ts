export function getSkillLevel(skillId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    var raw = localStorage.getItem("study-math:skill-levels");
    if (!raw) return 0;
    var levels = JSON.parse(raw);
    return levels[skillId] || 0;
  } catch { return 0; }
}

export function setSkillLevel(skillId: string, level: number): void {
  if (typeof window === "undefined") return;
  try {
    var raw = localStorage.getItem("study-math:skill-levels");
    var levels = raw ? JSON.parse(raw) : {};
    levels[skillId] = level;
    localStorage.setItem("study-math:skill-levels", JSON.stringify(levels));
  } catch {}
}

export function getAllLevels(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    var raw = localStorage.getItem("study-math:skill-levels");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function upgradeSkill(skillId: string): number {
  var level = getSkillLevel(skillId);
  if (level >= 5) return 5;
  setSkillLevel(skillId, level + 1);
  return level + 1;
}