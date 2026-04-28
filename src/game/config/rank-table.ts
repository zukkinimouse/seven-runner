import type { CouponRank } from "../types";

export type RankRow = {
  minYen: number;
  rank: CouponRank;
  label: string;
};

/** 合計金額からランクを決める */
export const RANK_TABLE: readonly RankRow[] = [
  // 0〜14,999円
  { minYen: 0, rank: "BRONZE", label: "クーポンなし" },
  // 15,000〜29,999円
  { minYen: 15000, rank: "SILVER", label: "30円引き" },
  // 30,000〜44,999円
  { minYen: 30000, rank: "GOLD", label: "50円引き" },
  // 45,000〜69,999円
  { minYen: 45000, rank: "PLATINUM", label: "100円引き" },
  // 70,000〜99,999円
  { minYen: 70000, rank: "MASTER", label: "150円引き" },
  // 100,000円以上
  { minYen: 100000, rank: "GOD", label: "200円引き" },
] as const;
