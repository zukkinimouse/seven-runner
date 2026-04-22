import Phaser from "phaser";
import type { PlayerMode } from "../game/entities/player-controller";
import type { RunState } from "./game-behavior";

const SNATCHER_RUN_FRAMES = [
  "obstacle-snatcher-1",
  "obstacle-snatcher-2",
  "obstacle-snatcher-3",
] as const;
const SNATCHER_FRAME_MS = 120;

/** 敵の相対速度（ワールド座標） */
export function updateHazardVelocities(
  hazards: Phaser.Physics.Arcade.Group,
  scrollSpeed: number,
): void {
  hazards.children.iterate((obj) => {
    const hz = obj as Phaser.GameObjects.Image & {
      body?: Phaser.Physics.Arcade.Body;
    };
    const body = hz.body;
    if (!body) return true;
    const kind = hz.getData("kind") as string | undefined;
    // コーン（biker）は穴の両端に固定して、ひったくりだけ移動させる
    if (kind === "biker") {
      body.setVelocityX(0);
      return true;
    }

    body.setVelocityX(-(scrollSpeed + 20));

    // ひったくりは 1→2→3 のループで走行アニメーション化する
    const isDefeated = hz.getData("isDefeated") as boolean | undefined;
    if (isDefeated) return true;
    const now = hz.scene.time.now;
    const phase = Math.floor((now + hz.x * 0.35) / SNATCHER_FRAME_MS);
    const frameKey = SNATCHER_RUN_FRAMES[phase % SNATCHER_RUN_FRAMES.length];
    if (hz.texture.key !== frameKey) hz.setTexture(frameKey);
    return true;
  });
}

export function formatHudText(
  mode: PlayerMode,
  run: RunState,
  elapsedSec: number,
  scrollSpeed: number,
): string {
  const hearts = "❤️".repeat(Math.max(0, mode.hp));
  return [
    `${hearts}`,
    `¥${run.cartYen.toLocaleString("ja-JP")}`,
    `⏱ ${elapsedSec.toFixed(1)}s   速度 ${Math.round(scrollSpeed)}px/s`,
    `PC操作: Space/↑ ジャンプ  X 攻撃`,
  ].join("\n");
}
