import { RANK_TABLE } from "../config/rank-table";
import type { CouponRank } from "../types";

/** コンボ数から倍率を取得 */
export function comboMultiplierFromCount(count: number): number {
  // 10コンボごとに+0.1、最大50コンボ時の1.5倍で打ち止め
  const comboTier = Math.floor(Math.max(0, count) / 10);
  return Math.min(1 + comboTier * 0.1, 1.5);
}

/** 合計金額からランクを決定 */
export function rankFromTotalYen(totalYen: number): {
  rank: CouponRank;
  couponText: string;
} {
  let row = RANK_TABLE[0];
  for (const r of RANK_TABLE) {
    if (totalYen >= r.minYen) row = r;
  }
  return { rank: row.rank, couponText: row.label };
}

/** ランクの優劣順（保存用） */
export function rankScore(rank: CouponRank): number {
  // 現在仕様は D < C < B < A < P の5段階
  const order: CouponRank[] = ["D", "C", "B", "A", "P"];
  return order.indexOf(rank);
}
