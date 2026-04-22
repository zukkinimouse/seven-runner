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
import { sfxPickup } from "../game/audio/sfx";

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
): number {
  const def = getItemDefinition(itemId);
  if (!def) return 0;
  run.comboCount += 1;
  run.lastItemAt = now;

  const mult = comboMultiplierFromCount(run.comboCount);
  run.lastComboMult = mult;
  const add = Math.floor(def.price * mult);
  run.cartYen += add;
  run.receiptLines.push({ name: getReceiptItemName(itemId), yen: add });
  run.collectedItemIds.push(itemId);
  sfxPickup();
  return add;
}

export function stealFromCart(run: RunState, now: number, mode: PlayerMode): number {
  if (now - mode.lastStealAt < 900) return 0;
  mode.lastStealAt = now;
  const lost = Math.floor(run.cartYen * 0.2);
  run.cartYen = Math.max(0, run.cartYen - lost);
  run.receiptLines.push({ name: "（ひったくり被害）", yen: -lost });
  return lost;
}

export function randomItemId(): string {
  const pool = ITEM_DEFINITIONS.filter((item) => item.id !== "energy_drink");
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].id;
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
