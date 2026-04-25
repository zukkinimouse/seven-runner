import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // アイテム画像（public 配下）を先に読み込む
    this.load.image("item-onigiri", "assets/items/onigiri.png");
    this.load.image("item-onigiri-konbu", "assets/items/onigiri-konbu.png");
    this.load.image("item-onigiri-tuna", "assets/items/onigiri-tuna.png");
    this.load.image("item-sandwich", "assets/items/sandwich.png");
    this.load.image("item-sandwich-egg", "assets/items/sandwich-egg.png");
    this.load.image("item-sandwich-tuna", "assets/items/sandwich-tuna.png");
    this.load.image("item-drink", "assets/items/drink.png");
    this.load.image("item-bento", "assets/items/bento.png");
    this.load.image("item-bento-karaage", "assets/items/bento-karaage.png");
    this.load.image("item-bento-shake", "assets/items/bento-shake.png");
    this.load.image("obstacle-cone", "assets/obstacles/cone.png");
    this.load.image("obstacle-trash-bag", "assets/obstacles/trash-bag.png");
    this.load.image("obstacle-box", "assets/obstacles/cardboard-box.png");
    this.load.image("obstacle-snatcher-1", "assets/obstacles/snatcher-1.png");
    this.load.image("obstacle-snatcher-2", "assets/obstacles/snatcher-2.png");
    this.load.image("obstacle-snatcher-3", "assets/obstacles/snatcher-3.png");
    this.load.image(
      "obstacle-snatcher-defeat",
      "assets/obstacles/snatcher-4.png",
    );
    this.load.image("player-jump-1", "assets/player/giraffe-jump-1.png");
    this.load.image("player-jump-2", "assets/player/giraffe-jump-2.png");
    this.load.image("player-slide", "assets/player/giraffe-slide.png");
    // 攻撃差分は player フォルダへ集約する
    this.load.image("player-attack-1", "assets/player/attack-open-mouth-1.png");
    this.load.image("player-attack-2", "assets/player/attack-open-mouth-2.png");
    this.load.image("player-attack-3", "assets/player/attack-open-mouth-3.png");
    this.load.image("player-attack-4", "assets/player/attack-open-mouth-4.png");
    this.load.image("player-attack-flame", "assets/player/attack-flame.png");
    this.load.image("staff-idle", "assets/characters/staff/idle/staff-idle.png");
    this.load.image(
      "staff-check",
      "assets/characters/staff/reactions/staff-check.png",
    );
    this.load.image(
      "staff-cheer",
      "assets/characters/staff/reactions/staff-cheer.png",
    );
    this.load.image("staff-wave-1", "assets/characters/staff/wave/staff-wave-1.png");
    this.load.image("staff-wave-2", "assets/characters/staff/wave/staff-wave-2.png");
    this.load.image("staff-wave-3", "assets/characters/staff/wave/staff-wave-3.png");
    // タイトル用BGMとプレイ中BGMはキーを分離して管理する
    this.load.audio("bgm-title", "assets/audio/midnight-snack-run.mp3");
    this.load.audio("bgm-main", "assets/audio/midnight-snack-dash.mp3");
    for (let i = 1; i <= 8; i += 1) {
      this.load.image(`player-run-${i}`, `assets/player/giraffe-run-${i}.png`);
    }

    // 背景画像（遠景・中景・近景）を読み込む
    this.load.image("bg-far", "backgrounds/far.webp");
    this.load.image("bg-mid", "backgrounds/mid.webp");
    this.load.image("bg-mid-dawn", "backgrounds/bg-mid-dawn.webp");
    this.load.image("bg-mid-day", "backgrounds/bg-mid-day.webp");
    this.load.image("bg-mid-dusk", "backgrounds/bg-mid-dusk.webp");
    this.load.image("bg-near", "backgrounds/near.webp");
    // タイトル背景（Gemini生成）
    this.load.image("title-bg-gemini", "assets/backgrounds/title-bg-gemini.png");
    // タイトルUI（Gemini生成）
    this.load.image("title-logo-main", "assets/ui/title/logo/title-logo.webp");
    this.load.image(
      "title-btn-start-normal",
      "assets/ui/title/buttons/start/start-normal.webp",
    );
    this.load.image(
      "title-btn-start-hover",
      "assets/ui/title/buttons/start/start-hover.webp",
    );
    this.load.image(
      "title-btn-start-pressed",
      "assets/ui/title/buttons/start/start-pressed.webp",
    );
    this.load.image(
      "title-btn-howto-normal",
      "assets/ui/title/buttons/how-to/how-to-normal.webp",
    );
    this.load.image(
      "title-btn-howto-hover",
      "assets/ui/title/buttons/how-to/how-to-hover.webp",
    );
    this.load.image(
      "title-btn-howto-pressed",
      "assets/ui/title/buttons/how-to/how-to-pressed.webp",
    );
    this.load.image(
      "title-btn-settings-normal",
      "assets/ui/title/icons/settings/settings-normal.webp",
    );
    this.load.image(
      "title-btn-settings-hover",
      "assets/ui/title/icons/settings/settings-hover.webp",
    );
    this.load.image(
      "title-btn-settings-pressed",
      "assets/ui/title/icons/settings/settings-pressed.webp",
    );
    this.load.image(
      "title-btn-settings-disabled",
      "assets/ui/title/icons/settings/settings-disabled.webp",
    );
  }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(0x42a5f5, 1);
    g.fillRect(0, 0, 32, 48);
    g.generateTexture("player", 32, 48);
    g.destroy();

    if (!this.anims.exists("player-run")) {
      this.anims.create({
        key: "player-run",
        frames: Array.from({ length: 8 }, (_v, idx) => ({
          key: `player-run-${idx + 1}`,
        })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists("player-attack")) {
      this.anims.create({
        key: "player-attack",
        frames: Array.from({ length: 4 }, (_v, idx) => ({
          key: `player-attack-${idx + 1}`,
        })),
        frameRate: 16,
        repeat: -1,
      });
    }

    this.scene.start("TitleScene");
  }
}
