import type { CouponRank } from "../types";

export type RankRow = {
  minYen: number;
  rank: CouponRank;
  label: string;
};

/** 合計金額からランクを決める */
export const RANK_TABLE: readonly RankRow[] = [
  // 0〜4999円
  { minYen: 0, rank: "D", label: "クーポンなし" },
  // 5000〜8999円
  { minYen: 5000, rank: "C", label: "30円引き" },
  // 9000〜14999円
  { minYen: 9000, rank: "B", label: "50円引き" },
  // 15000円以上
  { minYen: 15000, rank: "A", label: "100円引き" },
] as const;
