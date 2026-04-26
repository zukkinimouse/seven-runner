import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GlobalAllTimeTopRecord, SaveDataV1 } from "../config/save-types";

type TopScoreRow = {
  guest_id: string;
  nickname: string;
  score_yen: number;
  achieved_at: string | null;
};

let cachedClient: SupabaseClient | null | undefined;

function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== "string" || typeof anonKey !== "string" || !url || !anonKey) {
    cachedClient = null;
    return cachedClient;
  }
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
