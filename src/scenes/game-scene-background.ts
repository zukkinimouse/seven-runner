import Phaser from "phaser";
import { GAME_HEIGHT } from "../game/game-config";

export type BackgroundState = {
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
  midLayers: Record<string, Phaser.GameObjects.TileSprite>;
  currentMidKey: string;
  isTransitioning: boolean;
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

function pickMidTextureKey(scene: Phaser.Scene, elapsedSec: number): string {
  const cycleKeys = buildMidCycleKeys(scene);
  const slotSec = 15;
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
    .tileSprite(0, 0, 200000, GAME_HEIGHT, "bg-far")
    .setOrigin(0, 0)
    .setDepth(-30)
    .setAlpha(0.9);

  const cycleKeys = buildMidCycleKeys(scene);
  const uniqueKeys = Array.from(new Set(cycleKeys));
  const initialMidKey = pickMidTextureKey(scene, 0);
  const midLayers: Record<string, Phaser.GameObjects.TileSprite> = {};
  for (const key of uniqueKeys) {
    const layer = scene.add
      .tileSprite(0, 0, 200000, GAME_HEIGHT, key)
      .setOrigin(0, 0)
      .setDepth(-20)
      .setAlpha(key === initialMidKey ? 0.96 : 0);
    applyMidLayerLayout(layer);
    midLayers[key] = layer;
  }

  return {
    far,
    mid: midLayers[initialMidKey],
    midLayers,
    currentMidKey: initialMidKey,
    isTransitioning: false,
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
  if (nextMidKey !== bg.currentMidKey && !bg.isTransitioning) {
    const currentLayer = bg.midLayers[bg.currentMidKey];
    const nextLayer = bg.midLayers[nextMidKey];
    if (currentLayer && nextLayer) {
      bg.isTransitioning = true;
      // setTexture切替を避け、事前生成レイヤーのフェードでカクつきを抑える
      nextLayer.tilePositionX = currentLayer.tilePositionX;
      nextLayer.tilePositionY = currentLayer.tilePositionY;
      nextLayer.setAlpha(0);
      scene.tweens.add({
        targets: currentLayer,
        alpha: 0,
        duration: 220,
        ease: "Sine.InOut",
      });
      scene.tweens.add({
        targets: nextLayer,
        alpha: 0.96,
        duration: 220,
        ease: "Sine.InOut",
        onComplete: () => {
          bg.currentMidKey = nextMidKey;
          bg.mid = nextLayer;
          bg.isTransitioning = false;
        },
      });
    } else {
      bg.currentMidKey = nextMidKey;
      bg.mid = bg.midLayers[nextMidKey] ?? bg.mid;
    }
  }

  // 遠景は遅く、中景は現状の速度を維持する
  bg.far.tilePositionX += scrollSpeed * 0.2 * deltaSec;
  const currentLayer = bg.midLayers[bg.currentMidKey];
  if (currentLayer) {
    currentLayer.tilePositionX += scrollSpeed * 0.46 * deltaSec;
  }
  if (bg.isTransitioning) {
    const nextLayer = bg.midLayers[pickMidTextureKey(scene, elapsedSec)];
    if (nextLayer) nextLayer.tilePositionX += scrollSpeed * 0.46 * deltaSec;
  }
}
