import { UserProgress, ErrorRecord, StorageBackend } from "@/types";

const DEFAULT_PROGRESS: UserProgress = {
  userId: "local",
  moduleProgress: {},
  streak: { current: 0, lastDate: "", longest: 0 },
};

// === LocalStorage 实现，预留 userId 便于未来迁移 ===
class LocalStorageBackend implements StorageBackend {
  private prefix = "study-math:";

  async getProgress(userId: string): Promise<UserProgress> {
    const key = this.prefix + "progress:" + userId;
    if (typeof window === "undefined") return DEFAULT_PROGRESS;
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_PROGRESS, userId };
    return JSON.parse(raw);
  }

  async saveProgress(userId: string, progress: UserProgress): Promise<void> {
    const key = this.prefix + "progress:" + userId;
    if (typeof window === "undefined") return;
    // 更新连续学习天数
    const today = new Date().toISOString().slice(0, 10);
    if (progress.streak.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (progress.streak.lastDate === yesterday) {
        progress.streak.current += 1;
      } else {
        progress.streak.current = 1;
      }
      progress.streak.lastDate = today;
      if (progress.streak.current > progress.streak.longest) {
        progress.streak.longest = progress.streak.current;
      }
    }
    localStorage.setItem(key, JSON.stringify(progress));
  }

  async logError(userId: string, error: ErrorRecord): Promise<void> {
    const key = this.prefix + "errors:" + userId;
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(key);
    const errors: ErrorRecord[] = raw ? JSON.parse(raw) : [];
    errors.push(error);
    localStorage.setItem(key, JSON.stringify(errors));
  }

  async getErrors(userId: string, moduleId?: string): Promise<ErrorRecord[]> {
    const key = this.prefix + "errors:" + userId;
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const all: ErrorRecord[] = JSON.parse(raw);
    return moduleId ? all.filter((e) => e.moduleId === moduleId) : all;
  }

  async getCollectedIds(userId: string): Promise<string[]> {
    const key = this.prefix + "collected:" + userId;
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  async toggleCollect(userId: string, questionId: string): Promise<void> {
    const ids = await this.getCollectedIds(userId);
    const idx = ids.indexOf(questionId);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      ids.push(questionId);
    }
    const key = this.prefix + "collected:" + userId;
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(ids));
    }
  }

  // === 章节掌握 ===
  async getMastery(userId: string): Promise<Record<string, any>> {
    const key = this.prefix + "mastery:" + userId;
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  }

  async setMastery(userId: string, moduleId: string): Promise<void> {
    const mastery = await this.getMastery(userId);
    mastery[moduleId] = { challengeCompleted: true, challengeCompletedAt: Date.now() };
    const key = this.prefix + "mastery:" + userId;
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(mastery));
  }

  // === 薄弱点 ===
  async getWeakPoints(userId: string): Promise<import("@/types").WeakPoint[]> {
    const key = this.prefix + "weakpoints:" + userId;
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  async getCompletions(round: number): Promise<string[]> {
    var key = this.prefix + "completions:" + round;
    if (typeof window === "undefined") return [];
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  async addCompletion(round: number, moduleId: string): Promise<void> {
    var key = this.prefix + "completions:" + round;
    var ids = await this.getCompletions(round);
    if (!ids.includes(moduleId)) { ids.push(moduleId); localStorage.setItem(key, JSON.stringify(ids)); }
  }

  async isCompleted(round: number, moduleId: string): Promise<boolean> {
    return (await this.getCompletions(round)).includes(moduleId);
  }

  async addWeakPoint(userId: string, wp: { moduleId: string; stepKey: string; description: string; count: number; lastOccurred: number }): Promise<void> {
    const points = await this.getWeakPoints(userId);
    const existing = points.find(p => p.moduleId === wp.moduleId && p.stepKey === wp.stepKey);
    if (existing) {
      existing.count += 1;
      existing.lastOccurred = Date.now();
    } else {
      points.push(wp);
    }
    const key = this.prefix + "weakpoints:" + userId;
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(points));
  }
}

export const storage = new LocalStorageBackend();
export default storage;