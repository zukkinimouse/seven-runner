import type { CouponRank } from "../types";

export const SAVE_KEY = "sevenRunner_save";
export const SAVE_VERSION = 1 as const;

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
};
