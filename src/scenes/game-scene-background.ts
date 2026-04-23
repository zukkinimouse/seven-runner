import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/game-config";

export type BackgroundState = {
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
  currentMidKey: string;
};

const MID_TILE_SCALE = 0.9;
const MID_TILE_POSITION_Y = 380;

function buildMidCycleKeys(scene: Phaser.Scene): string[] {
  const orderedKeys = [
    "bg-mid",
    "bg-mid-dawn",
    "bg-mid-day",
    "bg-mid-dusk",
  ].filter((key) => scene.textures.exists(key));
  if (orderedKeys.length === 0) return ["bg-mid"];
  // 夜間 -> 夜明け -> 日中 -> 夕暮れを1回ずつ表示する
  return orderedKeys;
}

function isIOSLikeRuntime(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua);
}

function pickMidTextureKey(scene: Phaser.Scene, elapsedSec: number): string {
  const cycleKeys = buildMidCycleKeys(scene);
  // iOS は切替回数を減らして描画負荷を抑える
  const slotSec = isIOSLikeRuntime() ? 30 : 15;
  const cycleSec = elapsedSec % (cycleKeys.length * slotSec);
  const index = Math.floor(cycleSec / slotSec);
  return cycleKeys[index] ?? "bg-mid";
}

function applyMidLayerLayout(mid: Phaser.GameObjects.TileSprite): void {
  // 切り替え後も店員の位置がずれないようレイアウトを固定する
  mid.setTileScale(MID_TILE_SCALE, MID_TILE_SCALE);
  mid.tilePositionY = MID_TILE_POSITION_Y;
}

export function createBackgroundLayers(scene: Phaser.Scene): BackgroundState {
  // 遠景を先に敷いて、奥行きだけ追加する
  const far = scene.add
    .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "bg-far")
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(-30)
    .setAlpha(0.9);

  const initialMidKey = pickMidTextureKey(scene, 0);
  // 安定性優先: レイヤー多重保持をやめ、1枚を差し替える
  const mid = scene.add
    .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, initialMidKey)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(-20)
    .setAlpha(0.96);
  applyMidLayerLayout(mid);

  return {
    far,
    mid,
    currentMidKey: initialMidKey,
  };
}

export function updateBackgroundScroll(
  bg: BackgroundState,
  scene: Phaser.Scene,
  elapsedSec: number,
  scrollSpeed: number,
  deltaSec: number,
): void {
  const nextMidKey = pickMidTextureKey(scene, elapsedSec);
  if (nextMidKey !== bg.currentMidKey) {
    bg.mid.setTexture(nextMidKey);
    applyMidLayerLayout(bg.mid);
    bg.currentMidKey = nextMidKey;
  }

  // 遠景は遅く、中景は現状の速度を維持する
  bg.far.tilePositionX += scrollSpeed * 0.2 * deltaSec;
  bg.mid.tilePositionX += scrollSpeed * 0.46 * deltaSec;
}
