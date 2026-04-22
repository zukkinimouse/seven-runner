import Phaser from "phaser";
import { GAME_HEIGHT } from "../game/game-config";

export type BackgroundState = {
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
};

export function createBackgroundLayers(scene: Phaser.Scene): BackgroundState {
  // 遠景を先に敷いて、奥行きだけ追加する
  const far = scene.add
    .tileSprite(0, 0, 200000, GAME_HEIGHT, "bg-far")
    .setOrigin(0, 0)
    .setDepth(-30)
    .setAlpha(0.9);

  // まずは中景1枚だけにして、座標ズレ要因を無くす
  const mid = scene.add
    .tileSprite(0, 0, 200000, GAME_HEIGHT, "bg-mid")
    .setOrigin(0, 0)
    .setDepth(-20)
    .setAlpha(0.96);
  // 中景が大きく見えるため、タイルテクスチャを少し縮小して表示する
  mid.setTileScale(0.9, 0.9);
  mid.tilePositionY = 380;

  return { far, mid };
}

export function updateBackgroundScroll(
  bg: BackgroundState,
  scrollSpeed: number,
  deltaSec: number,
): void {
  // 遠景は遅く、中景は現状の速度を維持する
  bg.far.tilePositionX += scrollSpeed * 0.2 * deltaSec;
  bg.mid.tilePositionX += scrollSpeed * 0.46 * deltaSec;
}
