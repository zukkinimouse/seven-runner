import {
  DEFAULT_SAVE,
  DEFAULT_STORE_ID,
  SAVE_KEY,
  type SaveDataV1,
  type WeeklyStoreRankingEntry,
} from "../config/save-types";
import { rankScore } from "../logic/score";
import type { CouponRank, RunResultPayload } from "../types";

type RankingSnapshot = {
  personalAllTimeBestYen: number;
  globalAllTimeTopYen: number;
  globalAllTimeTopNickname: string;
};

function buildFreshSave(): SaveDataV1 {
  const guestId = createGuestId();
  const weekKey = getCurrentWeekKey();
  return {
    ...DEFAULT_SAVE,
    guestId,
    nickname: createDefaultNickname(guestId),
    storeId: DEFAULT_STORE_ID,
    weeklyWeekKey: weekKey,
  };
}

function createGuestId(): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `guest-${rand}`;
}

function createDefaultNickname(guestId: string): string {
  const suffix = guestId.replace("guest-", "").slice(-4);
  return `ゲスト${suffix || "0000"}`;
}

// 週間リセット用の ISO 週キー（例: 2026-W17）
function getCurrentWeekKey(now = new Date()): string {
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function sanitizeNickname(value: unknown, fallbackGuestId: string): string {
  if (typeof value !== "string") return createDefaultNickname(fallbackGuestId);
  const trimmed = value.trim().slice(0, 20);
  return trimmed.length > 0 ? trimmed : createDefaultNickname(fallbackGuestId);
}

function normalizeWeeklyRanking(
  raw: unknown,
  storeId: string,
  weekKey: string,
): WeeklyStoreRankingEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is WeeklyStoreRankingEntry => Boolean(x && typeof x === "object"))
    .map((entry) => ({
      storeId: typeof entry.storeId === "string" ? entry.storeId : storeId,
      weekKey: typeof entry.weekKey === "string" ? entry.weekKey : weekKey,
      guestId: typeof entry.guestId === "string" ? entry.guestId : "",
      nickname: typeof entry.nickname === "string" ? entry.nickname : "",
      bestScoreYen:
        typeof entry.bestScoreYen === "number" ? Math.max(0, entry.bestScoreYen) : 0,
      bestRunAt: typeof entry.bestRunAt === "string" ? entry.bestRunAt : "",
    }))
    .filter((entry) => entry.guestId.length > 0);
}

export function loadSave(): SaveDataV1 {
  if (typeof window === "undefined" || !window.localStorage) {
    return buildFreshSave();
  }
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return buildFreshSave();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return buildFreshSave();
    const obj = parsed as Partial<SaveDataV1>;
    if (obj.version !== 1) return buildFreshSave();
    const guestId =
      typeof obj.guestId === "string" && obj.guestId.length > 0 ? obj.guestId : createGuestId();
    const nickname = sanitizeNickname(obj.nickname, guestId);
    const storeId =
      typeof obj.storeId === "string" && obj.storeId.length > 0
        ? obj.storeId
        : DEFAULT_STORE_ID;
    const currentWeekKey = getCurrentWeekKey();
    const loadedWeekKey =
      typeof obj.weeklyWeekKey === "string" && obj.weeklyWeekKey.length > 0
        ? obj.weeklyWeekKey
        : currentWeekKey;
    const weeklyStoreRanking = normalizeWeeklyRanking(
      obj.weeklyStoreRanking,
      storeId,
      loadedWeekKey,
    );
    const activeWeeklyRanking =
      loadedWeekKey === currentWeekKey ? weeklyStoreRanking : [];
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
      bgmVolume:
        typeof obj.bgmVolume === "number"
          ? Math.max(0, Math.min(1, obj.bgmVolume))
          : 0.35,
      seVolume:
        typeof obj.seVolume === "number"
          ? Math.max(0, Math.min(1, obj.seVolume))
          : 1,
      muted: obj.muted === true,
      guestId,
      nickname,
      storeId,
      weeklyWeekKey: currentWeekKey,
      weeklyStoreRanking: activeWeeklyRanking,
      globalAllTimeTop: {
        guestId:
          typeof obj.globalAllTimeTop?.guestId === "string"
            ? obj.globalAllTimeTop.guestId
            : "",
        nickname:
          typeof obj.globalAllTimeTop?.nickname === "string"
            ? obj.globalAllTimeTop.nickname
            : "",
        scoreYen:
          typeof obj.globalAllTimeTop?.scoreYen === "number"
            ? Math.max(0, obj.globalAllTimeTop.scoreYen)
            : 0,
        achievedAt:
          typeof obj.globalAllTimeTop?.achievedAt === "string"
            ? obj.globalAllTimeTop.achievedAt
            : "",
      },
    };
  } catch {
    return buildFreshSave();
  }
}

export function writeSave(next: SaveDataV1): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
}

export function writeAudioSettings(args: {
  bgmVolume: number;
  seVolume: number;
  muted: boolean;
}): SaveDataV1 {
  const prev = loadSave();
  const next: SaveDataV1 = {
    ...prev,
    bgmVolume: Math.max(0, Math.min(1, args.bgmVolume)),
    seVolume: Math.max(0, Math.min(1, args.seVolume)),
    muted: args.muted,
  };
  writeSave(next);
  return next;
}

export function mergeBestRank(a: CouponRank, b: CouponRank): CouponRank {
  return rankScore(a) >= rankScore(b) ? a : b;
}

export function applyRunToSave(
  prev: SaveDataV1,
  payload: RunResultPayload,
  collectedItemIds: string[],
): SaveDataV1 {
  const nowIso = new Date().toISOString();
  const weekKey = getCurrentWeekKey();
  const weekly = prev.weeklyWeekKey === weekKey ? [...prev.weeklyStoreRanking] : [];
  const selfIndex = weekly.findIndex(
    (entry) =>
      entry.storeId === prev.storeId &&
      entry.weekKey === weekKey &&
      entry.guestId === prev.guestId,
  );
  if (selfIndex >= 0) {
    const current = weekly[selfIndex]!;
    if (payload.totalYen > current.bestScoreYen) {
      weekly[selfIndex] = {
        ...current,
        nickname: prev.nickname,
        bestScoreYen: payload.totalYen,
        bestRunAt: nowIso,
      };
    }
  } else {
    weekly.push({
      storeId: prev.storeId,
      weekKey,
      guestId: prev.guestId,
      nickname: prev.nickname,
      bestScoreYen: payload.totalYen,
      bestRunAt: nowIso,
    });
  }

  let globalAllTimeTop = prev.globalAllTimeTop;
  if (
    payload.totalYen > prev.globalAllTimeTop.scoreYen ||
    (payload.totalYen === prev.globalAllTimeTop.scoreYen &&
      prev.globalAllTimeTop.achievedAt &&
      nowIso < prev.globalAllTimeTop.achievedAt)
  ) {
    // 同点は先達者優先のため、同点更新は既存時刻より早い場合のみ許可
    globalAllTimeTop = {
      guestId: prev.guestId,
      nickname: prev.nickname,
      scoreYen: payload.totalYen,
      achievedAt: nowIso,
    };
  }

  const unlocked = new Set(prev.unlockedItems);
  for (const id of collectedItemIds) unlocked.add(id);
  return {
    ...prev,
    highScore: Math.max(prev.highScore, payload.totalYen),
    totalRuns: prev.totalRuns + 1,
    bestRank: mergeBestRank(prev.bestRank, payload.rank),
    unlockedItems: [...unlocked],
    lastPlayedAt: nowIso,
    weeklyWeekKey: weekKey,
    weeklyStoreRanking: weekly,
    globalAllTimeTop,
  };
}

export function getRankingSnapshot(save: SaveDataV1): RankingSnapshot {
  const nickname =
    save.globalAllTimeTop.nickname.trim().length > 0
      ? save.globalAllTimeTop.nickname
      : "未設定";
  return {
    personalAllTimeBestYen: save.highScore,
    globalAllTimeTopYen: save.globalAllTimeTop.scoreYen,
    globalAllTimeTopNickname: nickname,
  };
}
