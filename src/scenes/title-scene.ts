import Phaser from "phaser";
import { loadSave } from "../game/persistence/storage";

export class TitleScene extends Phaser.Scene {
  private static readonly GOLD = {
    bgTop: 0x0b1021,
    bgBottom: 0x1a2040,
    textMain: "#ffffff",
    textStroke: "#b8860b",
    btnBg: 0xffd700,
    btnBottom: 0xdaa520,
    btnText: "#4a3500",
  } as const;

  private orientationOverlayBg?: Phaser.GameObjects.Rectangle;
  private orientationOverlayPanel?: Phaser.GameObjects.Rectangle;
  private orientationOverlayTitle?: Phaser.GameObjects.Text;
  private orientationOverlayHint?: Phaser.GameObjects.Text;
  private infoModalLayer?: Phaser.GameObjects.Container;
  private isInfoModalOpen = false;
  private canStart = true;

  constructor() {
    super("TitleScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const isCompact = width < 600 || height < 340;
    const palette = TitleScene.GOLD;
    const save = loadSave();
    const isDesktopDevice = this.sys.game.device.os.desktop;
    this.drawGradientBackground(width, height, palette.bgTop, palette.bgBottom);
    this.drawTitleBackgroundImage(width, height);

    const centerX = width / 2;
    const logoY = isCompact ? 84 : 100;
    const scoreAreaX = 20;
    const scoreAreaY = 20;
    const startY = isCompact ? 194 : 220;
    const howToY = isCompact ? 250 : 290;
    const settingsX = width - 20 - (isCompact ? 38 : 48);
    const settingsY = 40;
    const logoFontSize = isCompact ? 36 : 48;
    const scoreFontSize = isCompact ? 13 : 16;
    const startFontSize = isCompact ? 18 : 24;
    const howToFontSize = isCompact ? 14 : 18;
    const noticeFontSize = isCompact ? 13 : 16;

    this.add
      .text(centerX, logoY, "コンビニランナー", {
        fontSize: `${logoFontSize}px`,
        color: "#fffdf5",
        stroke: "#7c5a00",
        strokeThickness: 10,
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setShadow(0, 4, "#1f2937", 0.85, true, true);

    this.add
      .text(scoreAreaX, scoreAreaY, `ハイスコア: ¥${save.highScore.toLocaleString("ja-JP")}`, {
        fontSize: `${scoreFontSize}px`,
        color: "#fff7c2",
        stroke: "#3b2200",
        strokeThickness: 6,
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setDepth(21)
      .setShadow(0, 2, "#000000", 0.72, true, true);

    this.add
      .text(scoreAreaX, scoreAreaY + (isCompact ? 20 : 24), `最高ランク: ${save.bestRank}`, {
        fontSize: `${scoreFontSize}px`,
        color: "#f8fafc",
        stroke: "#111827",
        strokeThickness: 6,
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setDepth(21)
      .setShadow(0, 2, "#000000", 0.72, true, true);

    const startButton = this.createRoundButton({
      x: centerX,
      y: startY,
      width: isCompact ? 160 : 200,
      height: isCompact ? 45 : 56,
      radius: isCompact ? 22 : 28,
      label: "スタート",
      labelSize: startFontSize,
      palette,
      onClick: () => {
        if (!this.canStart) return;
        this.scene.start("GameScene");
      },
    });
    this.tweens.add({
      targets: [startButton.top, startButton.text],
      scale: 1.04,
      duration: 740,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });

    this.createRoundButton({
      x: centerX,
      y: howToY,
      width: isCompact ? 128 : 160,
      height: isCompact ? 35 : 44,
      radius: isCompact ? 18 : 22,
      label: "遊び方",
      labelSize: howToFontSize,
      palette,
      onClick: () => {
        if (!this.canStart) return;
        if (this.isInfoModalOpen) return;
        this.openInfoModal({
          title: "遊び方",
          lines: isDesktopDevice
            ? [
                "・ジャンプ：SPACE または ↑",
                "・攻撃：X（クールタイムあり）",
                "・ひったくりは無敵中なら被害なし",
              ]
            : [
                "・ジャンプ：JUMPボタン または 画面左タップ",
                "・攻撃：ATTACKボタン",
                "・攻撃ボタンはクールタイム中にグレー表示",
              ],
        });
      },
    });

    this.createRoundButton({
      x: settingsX,
      y: settingsY,
      width: isCompact ? 38 : 48,
      height: isCompact ? 38 : 48,
      radius: isCompact ? 19 : 24,
      label: "⚙",
      labelSize: isCompact ? 18 : 22,
      palette,
      onClick: () => {
        if (!this.canStart) return;
        if (this.isInfoModalOpen) return;
        this.openInfoModal({
          title: "設定",
          lines: ["各種今後追加予定"],
        });
      },
    });

    this.add
      .text(centerX, howToY + (isCompact ? 42 : 58), "SPACE / タップでスタート", {
        fontSize: `${noticeFontSize}px`,
        color: "#fffef7",
        stroke: "#7c5a00",
        strokeThickness: 6,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setShadow(0, 3, "#000000", 0.75, true, true);

    this.createOrientationOverlay(width, height);
    this.updateOrientationState();
    this.scale.on("resize", () => this.updateOrientationState());

    const start = () => {
      if (!this.canStart) return;
      if (this.isInfoModalOpen) return;
      this.scene.start("GameScene");
    };

    this.input.keyboard?.once("keydown-SPACE", start);
  }

  private createRoundButton(args: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    label: string;
    labelSize: number;
    palette: typeof TitleScene.GOLD;
    onClick: () => void;
  }): { top: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
    const bottom = this.add
      .rectangle(args.x, args.y + 4, args.width, args.height, args.palette.btnBottom, 0.96)
      .setDepth(9);
    bottom.setRounded?.(args.radius);
    const top = this.add
      .rectangle(args.x, args.y, args.width, args.height, args.palette.btnBg, 0.98)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    top.setRounded?.(args.radius);
    const text = this.add
      .text(args.x, args.y, args.label, {
        fontSize: `${args.labelSize}px`,
        color: args.palette.btnText,
        fontStyle: "bold",
        stroke: "#fff7ed",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setShadow(0, 2, "#7c2d12", 0.35, true, true);
    top.on("pointerdown", () => {
      top.setScale(0.97);
      text.setScale(0.97);
      args.onClick();
    });
    top.on("pointerup", () => {
      top.setScale(1);
      text.setScale(1);
    });
    top.on("pointerout", () => {
      top.setScale(1);
      text.setScale(1);
    });
    return { top, text };
  }

  private drawGradientBackground(
    width: number,
    height: number,
    topColor: number,
    bottomColor: number,
  ): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    bg.fillRect(0, 0, width, height);
  }

  private drawTitleBackgroundImage(width: number, height: number): void {
    if (!this.textures.exists("title-bg-gemini")) return;
    const bg = this.add.image(width / 2, height / 2, "title-bg-gemini").setDepth(1);
    const src = this.textures.get("title-bg-gemini").getSourceImage() as {
      width: number;
      height: number;
    };
    if (!src?.width || !src?.height) {
      bg.setDisplaySize(width, height);
      return;
    }
    const scale = Math.max(width / src.width, height / src.height);
    bg.setDisplaySize(src.width * scale, src.height * scale);
    // UIの可読性を落とさないよう、背景画像は少し抑えた明るさで重ねる
    bg.setAlpha(0.68);
  }

  private createOrientationOverlay(width: number, height: number): void {
    this.orientationOverlayBg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setDepth(100)
      .setVisible(false);
    this.orientationOverlayPanel = this.add
      .rectangle(width / 2, height / 2, Math.min(width * 0.82, 420), Math.min(height * 0.72, 210), 0x111827, 0.95)
      .setDepth(101)
      .setStrokeStyle(3, 0xfde68a, 0.95)
      .setVisible(false);
    this.orientationOverlayPanel.setRounded?.(20);
    this.orientationOverlayTitle = this.add
      .text(width / 2, height / 2 - 36, "横画面でプレイしてください", {
        fontSize: "30px",
        color: "#fffdf5",
        fontStyle: "bold",
        stroke: "#7c5a00",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(102)
      .setVisible(false)
      .setShadow(0, 3, "#000000", 0.8, true, true);
    this.orientationOverlayHint = this.add
      .text(width / 2, height / 2 + 28, "端末を横向きにすると開始できます", {
        fontSize: "20px",
        color: "#f8fafc",
        align: "center",
        stroke: "#111827",
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(102)
      .setVisible(false)
      .setShadow(0, 2, "#000000", 0.75, true, true);
  }

  private updateOrientationState(): void {
    const isPortrait = this.scale.height > this.scale.width;
    this.canStart = !isPortrait;
    this.orientationOverlayBg?.setVisible(isPortrait);
    this.orientationOverlayPanel?.setVisible(isPortrait);
    this.orientationOverlayTitle?.setVisible(isPortrait);
    this.orientationOverlayHint?.setVisible(isPortrait);
  }

  private openInfoModal(payload: { title: string; lines: string[] }): void {
    this.infoModalLayer?.destroy(true);
    this.isInfoModalOpen = true;
    const width = this.scale.width;
    const height = this.scale.height;
    const modalW = Math.min(width * 0.72, 460);
    const modalH = Math.min(height * 0.72, 260);
    const centerX = width / 2;
    const centerY = height / 2;

    const backdrop = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.55)
      .setDepth(200)
      .setInteractive({ useHandCursor: true });
    const panel = this.add
      .rectangle(centerX, centerY, modalW, modalH, 0x111827, 0.96)
      .setDepth(201)
      .setStrokeStyle(3, 0xfde68a, 0.95);
    panel.setRounded?.(18);
    const title = this.add
      .text(centerX, centerY - modalH / 2 + 24, payload.title, {
        fontSize: "28px",
        color: "#fffdf5",
        fontStyle: "bold",
        stroke: "#7c5a00",
        strokeThickness: 7,
      })
      .setOrigin(0.5, 0)
      .setDepth(202)
      .setShadow(0, 2, "#000000", 0.75, true, true);
    const body = this.add
      .text(centerX, centerY - 10, payload.lines.join("\n"), {
        fontSize: "18px",
        color: "#f8fafc",
        align: "left",
        lineSpacing: 8,
        stroke: "#111827",
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(202)
      .setShadow(0, 2, "#000000", 0.72, true, true);
    const closeText = this.add
      .text(centerX, centerY + modalH / 2 - 22, "タップで閉じる", {
        fontSize: "16px",
        color: "#fff4bd",
        fontStyle: "bold",
        stroke: "#7c5a00",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 1)
      .setDepth(202)
      .setShadow(0, 2, "#000000", 0.75, true, true);

    this.infoModalLayer = this.add.container(0, 0, [backdrop, panel, title, body, closeText]).setDepth(200);
    backdrop.on("pointerdown", () => this.closeInfoModal());
    this.input.keyboard?.once("keydown-ESC", () => this.closeInfoModal());
  }

  private closeInfoModal(): void {
    if (!this.infoModalLayer) return;
    this.infoModalLayer.destroy(true);
    this.infoModalLayer = undefined;
    this.isInfoModalOpen = false;
  }
}
