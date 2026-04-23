import { CHUNK_WIDTH } from "../game/game-config";
import {
  ITEM_DEFINITIONS,
  getItemDefinition,
  getReceiptItemName,
} from "../game/config/item-definitions";
import { comboMultiplierFromCount, rankFromTotalYen } from "../game/logic/score";
import type { PlayerMode } from "../game/entities/player-controller";
import type { RunResultPayload } from "../game/types";
import type { SpawnedChunkHandle } from "../game/world/spawn-chunk";
import { sfxPickup, sfxSpoiledPickup } from "../game/audio/sfx";

export function isEnergyDrinkItem(itemId: string): boolean {
  return itemId === "energy_drink";
}

export type RunState = {
  startMs: number;
  cartYen: number;
  comboCount: number;
  lastItemAt: number;
  lastComboMult: number;
  receiptLines: { name: string; yen: number }[];
  collectedItemIds: string[];
};

export function createRunState(): RunState {
  return {
    startMs: performance.now(),
    cartYen: 0,
    comboCount: 0,
    lastItemAt: 0,
    lastComboMult: 1,
    receiptLines: [],
    collectedItemIds: [],
  };
}

export function cleanupOldChunks(
  chunks: SpawnedChunkHandle[],
  scrollX: number,
): void {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    if (c.baseX + CHUNK_WIDTH < scrollX - 500) {
      c.root.destroy(true);
      chunks.splice(i, 1);
    }
  }
}

export function collectItem(
  run: RunState,
  itemId: string,
  now: number,
  isSpoiled = false,
): number {
  const def = getItemDefinition(itemId);
  if (!def) return 0;
  const beforeYen = run.cartYen;
  let delta = 0;

  if (isSpoiled) {
    // 腐敗アイテムは負債のみ加算（コンボは進めない）
    delta = -Math.floor(def.price * 0.5);
  } else {
    run.comboCount += 1;
    run.lastItemAt = now;
    const mult = comboMultiplierFromCount(run.comboCount);
    run.lastComboMult = mult;
    delta = Math.floor(def.price * mult);
  }

  run.cartYen = Math.max(0, run.cartYen + delta);
  const appliedYen = run.cartYen - beforeYen;
  const itemName = isSpoiled
    ? `期限切れ ${getReceiptItemName(itemId)}`
    : getReceiptItemName(itemId);
  run.receiptLines.push({ name: itemName, yen: appliedYen });
  run.collectedItemIds.push(itemId);
  if (isSpoiled) {
    sfxSpoiledPickup();
  } else {
    sfxPickup();
  }
  return appliedYen;
}

export function stealFromCart(run: RunState, now: number, mode: PlayerMode): number {
  if (now - mode.lastStealAt < 900) return 0;
  mode.lastStealAt = now;
  const lost = Math.floor(run.cartYen * 0.2);
  run.cartYen = Math.max(0, run.cartYen - lost);
  run.receiptLines.push({ name: "（ひったくり被害）", yen: -lost });
  return lost;
}

/** 箱ドロップ用：弁当は小だけ偏りやすいので中・大をやや多めに抽選する */
export function randomItemId(): string {
  const pool = ITEM_DEFINITIONS.filter((item) => item.id !== "energy_drink");
  const weightFor = (id: string): number => {
    if (id === "bento_small") return 1;
    if (id === "bento_medium") return 2.1;
    if (id === "bento_large") return 2.1;
    return 1;
  };
  const weights = pool.map((it) => weightFor(it.id));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!.id;
  }
  return pool[pool.length - 1]!.id;
}

export function buildResultPayload(
  run: RunState,
  elapsedSec: number,
): RunResultPayload {
  const subtotalYen = run.receiptLines.reduce((s, l) => s + l.yen, 0);
  const totalYen = run.cartYen;
  const { rank, couponText } = rankFromTotalYen(totalYen);
  return {
    subtotalYen,
    comboMultiplier: run.lastComboMult,
    totalYen,
    rank,
    couponText,
    lines: run.receiptLines,
    elapsedSec,
  };
}
