import type { CouponRank } from "../types";

export type RankRow = {
  minYen: number;
  rank: CouponRank;
  label: string;
};

/** 合計金額からランクを決める */
export const RANK_TABLE: readonly RankRow[] = [
  // 0〜3000円
  { minYen: 0, rank: "D", label: "クーポンなし" },
  // 3001〜5000円
  { minYen: 3001, rank: "C", label: "30円引き" },
  // 5001〜10000円
  { minYen: 5001, rank: "B", label: "50円引き" },
  // 10001円以上
  { minYen: 10001, rank: "A", label: "100円引き" },
] as const;
