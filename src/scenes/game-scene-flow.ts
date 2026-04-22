import Phaser from "phaser";
import {
  pullSpawnJobs,
  type ChunkSpawnerState,
} from "../game/spawners/chunk-spawner";
import { CHUNK_WIDTH } from "../game/game-config";
import { spawnChunkIntoScene } from "../game/world/spawn-chunk";
import type { SpawnedChunkHandle } from "../game/world/spawn-chunk";
import type { ChunkTemplate } from "../game/types";
import { buildResultPayload } from "./game-behavior";
import type { RunState } from "./game-behavior";
import { applyRunToSave, loadSave, writeSave } from "../game/persistence/storage";

const SAFE_START_CHUNK_END_X = CHUNK_WIDTH;

function applySafeStartTemplate(
  template: ChunkTemplate,
  chunkBaseX: number,
): ChunkTemplate {
  if (chunkBaseX >= SAFE_START_CHUNK_END_X) return template;
  // 最初の1チャンクだけを安全化し、初期の理不尽感だけ抑える
  return {
    ...template,
    hazards: [],
    destructibles: [],
  };
}

/** チャンク生成ジョブを消化 */
export function runChunkSpawns(
  scene: Phaser.Scene,
  spawner: ChunkSpawnerState,
  playerX: number,
  elapsedSec: number,
  chunks: SpawnedChunkHandle[],
  groups: {
    platforms: Phaser.Physics.Arcade.StaticGroup;
    items: Phaser.Physics.Arcade.Group;
    hazards: Phaser.Physics.Arcade.Group;
    destructibles: Phaser.Physics.Arcade.Group;
  },
): void {
  const jobs = pullSpawnJobs(spawner, playerX, elapsedSec);
  for (const job of jobs) {
    const template = applySafeStartTemplate(job.template, job.baseX);
    chunks.push(
      spawnChunkIntoScene(scene, template, job.baseX, groups),
    );
  }
}

/** ラン終了→保存→結果へ */
export function transitionToResult(
  scene: Phaser.Scene,
  run: RunState,
  elapsedSec: number,
): void {
  scene.physics.pause();
  const payload = buildResultPayload(run, elapsedSec);
  const prev = loadSave();
  writeSave(applyRunToSave(prev, payload, run.collectedItemIds));
  scene.scene.start("ResultScene", { payload });
}
