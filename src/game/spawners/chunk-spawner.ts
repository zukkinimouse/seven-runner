import { CHUNK_WIDTH } from "../game-config";
import { CHUNK_TEMPLATES } from "../config/chunk-templates";
import { difficultyTForElapsedSeconds } from "../logic/difficulty";
import type { ChunkTemplate } from "../types";

function pickChunk(elapsedSec: number): ChunkTemplate {
  const t = difficultyTForElapsedSeconds(elapsedSec);
  const maxDiff = 1 + Math.floor(t * 4);
  const pool = CHUNK_TEMPLATES.filter((c) => c.difficulty <= maxDiff);
  const safe = pool.length ? pool : [...CHUNK_TEMPLATES];
  if (Math.random() < 0.25) {
    const easy = safe.filter((c) => c.difficulty <= 2);
    if (easy.length) return easy[Math.floor(Math.random() * easy.length)];
  }
  return safe[Math.floor(Math.random() * safe.length)];
}

export type ChunkSpawnJob = { template: ChunkTemplate; baseX: number };

export type ChunkSpawnerState = {
  nextStartX: number;
};

export function createChunkSpawnerState(startX: number): ChunkSpawnerState {
  return { nextStartX: startX };
}

/** プレイヤー前方にチャンクを積み上げるジョブを返す */
export function pullSpawnJobs(
  state: ChunkSpawnerState,
  playerX: number,
  elapsedSec: number,
): ChunkSpawnJob[] {
  const jobs: ChunkSpawnJob[] = [];
  const horizon = playerX + CHUNK_WIDTH * 4;
  while (state.nextStartX < horizon) {
    const baseX = state.nextStartX;
    state.nextStartX += CHUNK_WIDTH;
    jobs.push({ template: pickChunk(elapsedSec), baseX });
  }
  return jobs;
}
