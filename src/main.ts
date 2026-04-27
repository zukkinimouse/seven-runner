/** Phaser ゲームのエントリ（Vite が読み込む） */
import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/game-config";
import { BootScene } from "./scenes/boot-scene";
import { TitleScene } from "./scenes/title-scene";
import { GameScene } from "./scenes/game-scene";
import { ResultScene } from "./scenes/result-scene";
import { RankingScene } from "./scenes/ranking-scene";
import { registerSW } from "virtual:pwa-register";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#111111",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1200 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, GameScene, ResultScene, RankingScene],
});

// モバイルでアドレスバー表示/非表示や向き変更時に親サイズとキャンバス位置を再計算する
const refreshGameScale = (): void => {
  game.scale.refresh();
};
window.addEventListener("resize", refreshGameScale);
window.visualViewport?.addEventListener("resize", refreshGameScale);

// PWA更新を即時反映寄りにするため、起動時と可視化復帰時に更新確認を走らせる
const updateServiceWorker = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) return;
    window.setInterval(() => {
      void registration.update();
    }, 60_000);
  },
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  updateServiceWorker(true);
});
