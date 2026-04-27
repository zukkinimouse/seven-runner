import type { CouponRank } from "../types";

export const SAVE_KEY = "sevenRunner_save";
export const SAVE_VERSION = 1 as const;
export const DEFAULT_STORE_ID = "store-default";

export type SaveDataV1 = {
  version: typeof SAVE_VERSION;
  highScore: number;
  totalRuns: number;
  bestRank: CouponRank;
  unlockedItems: string[];
  lastPlayedAt: string;
  bgmVolume: number;
  seVolume: number;
  muted: boolean;
  guestId: string;
  nickname: string;
  nicknamePrompted: boolean;
  recoveryNoticeAcknowledged: boolean;
  storeId: string;
  weeklyWeekKey: string;
  weeklyStoreRanking: WeeklyStoreRankingEntry[];
  globalAllTimeTop: GlobalAllTimeTopRecord;
};

export type WeeklyStoreRankingEntry = {
  storeId: string;
  weekKey: string;
  guestId: string;
  nickname: string;
  bestScoreYen: number;
  bestRunAt: string;
};

export type GlobalAllTimeTopRecord = {
  guestId: string;
  nickname: string;
  scoreYen: number;
  achievedAt: string;
};

export const DEFAULT_SAVE: SaveDataV1 = {
  version: SAVE_VERSION,
  highScore: 0,
  totalRuns: 0,
  bestRank: "D",
  unlockedItems: [],
  lastPlayedAt: "",
  bgmVolume: 0.35,
  seVolume: 1,
  muted: false,
  guestId: "",
  nickname: "",
  nicknamePrompted: false,
  recoveryNoticeAcknowledged: false,
  storeId: DEFAULT_STORE_ID,
  weeklyWeekKey: "",
  weeklyStoreRanking: [],
  globalAllTimeTop: {
    guestId: "",
    nickname: "",
    scoreYen: 0,
    achievedAt: "",
  },
};
