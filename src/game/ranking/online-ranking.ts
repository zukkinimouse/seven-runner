import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GlobalAllTimeTopRecord, SaveDataV1 } from "../config/save-types";

type TopScoreRow = {
  guest_id: string;
  nickname: string;
  score_yen: number;
  achieved_at: string | null;
};

type WeeklyStoreRankingRow = {
  guest_id: string;
  nickname: string;
  best_score_yen: number;
  best_run_at: string;
};

export type WeeklyStoreRankingRecord = {
  guestId: string;
  nickname: string;
  scoreYen: number;
  bestRunAt: string;
};

let cachedClient: SupabaseClient | null | undefined;

export function isSupabaseRankingEnabled(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof url === "string" && typeof anonKey === "string" && !!url && !!anonKey;
}

function getCurrentWeekKey(now = new Date()): string {
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!isSupabaseRankingEnabled()) {
    cachedClient = null;
    return cachedClient;
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  cachedClient = createClient(url, anonKey);
  return cachedClient;
}

function mapTopScore(data: TopScoreRow): GlobalAllTimeTopRecord {
  return {
    guestId: data.guest_id,
    nickname: data.nickname,
    scoreYen: data.score_yen,
    achievedAt: data.achieved_at ?? "",
  };
}

export async function fetchGlobalAllTimeTopFromSupabase(): Promise<GlobalAllTimeTopRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("all_time_best_scores_top")
    .select("guest_id,nickname,score_yen,achieved_at")
    .order("score_yen", { ascending: false })
    .order("achieved_at", { ascending: true })
    .limit(1)
    .single();
  if (error) throw error;
  return mapTopScore(data);
}

export async function syncRankingToSupabase(
  save: SaveDataV1,
  scoreYen: number,
): Promise<GlobalAllTimeTopRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("submit_score", {
    p_store_id: save.storeId,
    p_guest_id: save.guestId,
    p_nickname: save.nickname,
    p_score_yen: scoreYen,
  });
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return null;
  return mapTopScore(data[0] as TopScoreRow);
}

export async function fetchWeeklyStoreRankingFromSupabase(args: {
  storeId: string;
  limit?: number;
}): Promise<WeeklyStoreRankingRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const weekKey = getCurrentWeekKey();
  const limit = Math.max(1, Math.min(100, args.limit ?? 20));
  const { data, error } = await supabase
    .from("weekly_store_rankings")
    .select("guest_id,nickname,best_score_yen,best_run_at")
    .eq("store_id", args.storeId)
    .eq("week_key", weekKey)
    .order("best_score_yen", { ascending: false })
    .order("best_run_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: WeeklyStoreRankingRow) => ({
    guestId: row.guest_id,
    nickname: row.nickname,
    scoreYen: row.best_score_yen,
    bestRunAt: row.best_run_at,
  }));
}
