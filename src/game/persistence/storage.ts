import { DEFAULT_SAVE, SAVE_KEY, type SaveDataV1 } from "../config/save-types";
import { rankScore } from "../logic/score";
import type { CouponRank, RunResultPayload } from "../types";

export function loadSave(): SaveDataV1 {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_SAVE };
  }
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SAVE };
    const obj = parsed as Partial<SaveDataV1>;
    if (obj.version !== 1) return { ...DEFAULT_SAVE };
    return {
      version: 1,
      highScore: typeof obj.highScore === "number" ? obj.highScore : 0,
      totalRuns: typeof obj.totalRuns === "number" ? obj.totalRuns : 0,
      bestRank: (obj.bestRank as CouponRank) ?? "D",
      unlockedItems: Array.isArray(obj.unlockedItems)
        ? obj.unlockedItems.filter((x) => typeof x === "string")
        : [],
      lastPlayedAt:
        typeof obj.lastPlayedAt === "string" ? obj.lastPlayedAt : "",
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(next: SaveDataV1): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
}

export function mergeBestRank(a: CouponRank, b: CouponRank): CouponRank {
  return rankScore(a) >= rankScore(b) ? a : b;
}

export function applyRunToSave(
  prev: SaveDataV1,
  payload: RunResultPayload,
  collectedItemIds: string[],
): SaveDataV1 {
  const unlocked = new Set(prev.unlockedItems);
  for (const id of collectedItemIds) unlocked.add(id);
  return {
    ...prev,
    highScore: Math.max(prev.highScore, payload.totalYen),
    totalRuns: prev.totalRuns + 1,
    bestRank: mergeBestRank(prev.bestRank, payload.rank),
    unlockedItems: [...unlocked],
    lastPlayedAt: new Date().toISOString(),
  };
}
