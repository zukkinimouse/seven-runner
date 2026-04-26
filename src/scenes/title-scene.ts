import Phaser from "phaser";
import { setAudioMuted, setSeVolume, sfxPickup } from "../game/audio/sfx";
import { loadSave, writeAudioSettings } from "../game/persistence/storage";

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
  private bgm?: Phaser.Sound.BaseSound;

  constructor() {
    super("TitleScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const isCompact = width < 600 || height < 340;
    const palette = TitleScene.GOLD;
    const save = loadSave();
    setSeVolume(save.seVolume);
    setAudioMuted(save.muted);
    this.startLoopBgm(save.bgmVolume, save.muted);
    this.drawGradientBackground(width, height, palette.bgTop, palette.bgBottom);
    this.drawTitleBackgroundImage(width, height);

    const centerX = width / 2;
    const logoY = isCompact ? 84 : 100;
    const scoreAreaX = 20;
    const scoreAreaY = 20;
    const startY = isCompact ? 194 : 220;
    const howToY = isCompact ? 250 : 290;
    const settingsButtonSize = isCompact ? 44 : 48;
    const settingsX = width - 20 - settingsButtonSize;
    const rankingX = settingsX - settingsButtonSize - 10;
    const settingsY = isCompact ? 52 : 40;
    const scoreFontSize = isCompact ? 13 : 16;
    const noticeFontSize = isCompact ? 13 : 16;

    if (!this.createTitleLogo(centerX, logoY, isCompact)) {
      const logoFontSize = isCompact ? 36 : 48;
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
    }

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

    const startImageButton = this.createImageButton({
      x: centerX,
      y: startY,
      normalKey: "title-btn-start-normal",
      hoverKey: "title-btn-start-hover",
      pressedKey: "title-btn-start-pressed",
      width: isCompact ? 160 : 200,
      height: isCompact ? 45 : 56,
      onClick: () => {
        if (!this.canStart) return;
        this.scene.start("GameScene");
      },
    });
    if (startImageButton) {
      this.tweens.add({
        targets: [startImageButton],
        scaleX: startImageButton.scaleX * 1.04,
        scaleY: startImageButton.scaleY * 1.04,
        duration: 740,
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
      });
    } else {
      const startButton = this.createRoundButton({
        x: centerX,
        y: startY,
        width: isCompact ? 160 : 200,
        height: isCompact ? 45 : 56,
        radius: isCompact ? 22 : 28,
        label: "スタート",
        labelSize: isCompact ? 18 : 24,
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
    }

    const openHowTo = (): void => {
      if (!this.canStart) return;
      if (this.isInfoModalOpen) return;
      this.openInfoModal({
        title: "遊び方",
        lines: [
          "・ジャンプ：SPACE / ↑ / JUMPボタン / 左画面半分タップ",
          "・攻撃：X / ATTACKボタン（クールタイムあり）",
          "・スペシャルロゴ取得でスキルを保持（C / SKILLボタンで発動）",
          "・ひったくりは無敵中なら被害なし",
        ],
      });
    };
    const howToImageButton = this.createImageButton({
      x: centerX,
      y: howToY,
      normalKey: "title-btn-howto-normal",
      hoverKey: "title-btn-howto-hover",
      pressedKey: "title-btn-howto-pressed",
      width: isCompact ? 128 : 160,
      height: isCompact ? 35 : 44,
      onClick: openHowTo,
    });
    if (!howToImageButton) {
      this.createRoundButton({
        x: centerX,
        y: howToY,
        width: isCompact ? 128 : 160,
        height: isCompact ? 35 : 44,
        radius: isCompact ? 18 : 22,
        label: "遊び方",
        labelSize: isCompact ? 14 : 18,
        palette,
        onClick: openHowTo,
      });
    }

    const openSettings = (): void => {
      if (!this.canStart) return;
      if (this.isInfoModalOpen) return;
      this.openInfoModal({
        title: "設定",
        lines: ["各種今後追加予定"],
      });
    };
    const openRanking = (): void => {
      if (!this.canStart) return;
      if (this.isInfoModalOpen) return;
      this.scene.start("RankingScene");
    };
    this.createRoundButton({
      x: rankingX + settingsButtonSize / 2,
      y: settingsY + settingsButtonSize / 2,
      width: settingsButtonSize,
      height: settingsButtonSize,
      radius: settingsButtonSize / 2,
      label: "🏆",
      labelSize: isCompact ? 17 : 20,
      palette,
      onClick: openRanking,
    });
    const settingsImageButton = this.createImageButton({
      x: settingsX + settingsButtonSize / 2,
      y: settingsY + settingsButtonSize / 2,
      normalKey: "title-btn-settings-normal",
      hoverKey: "title-btn-settings-hover",
      pressedKey: "title-btn-settings-pressed",
      disabledKey: "title-btn-settings-disabled",
      width: settingsButtonSize,
      height: settingsButtonSize,
      onClick: openSettings,
      allowClickWhen: () => this.canStart && !this.isInfoModalOpen,
    });
    if (!settingsImageButton) {
      this.createRoundButton({
        x: settingsX + settingsButtonSize / 2,
        y: settingsY + settingsButtonSize / 2,
        width: settingsButtonSize,
        height: settingsButtonSize,
        radius: settingsButtonSize / 2,
        label: "⚙",
        labelSize: isCompact ? 18 : 22,
        palette,
        onClick: openSettings,
      });
    }

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
    // 端末の向き（ゲーム解像度ではなく画面）の変化を拾う
    this.scale.on("orientationchange", () => this.updateOrientationState());

    const start = () => {
      if (!this.canStart) return;
      if (this.isInfoModalOpen) return;
      this.scene.start("GameScene");
    };

    this.input.keyboard?.once("keydown-SPACE", start);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopLoopBgm());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopLoopBgm());
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

  private createTitleLogo(x: number, y: number, isCompact: boolean): boolean {
    if (!this.textures.exists("title-logo-main")) return false;
    const logo = this.add.image(x, y, "title-logo-main").setDepth(21).setOrigin(0.5);
    const source = this.textures.get("title-logo-main").getSourceImage() as {
      width?: number;
      height?: number;
    };
    if (!source?.width || !source?.height) return true;
    const targetW = isCompact ? 280 : 360;
    const scale = targetW / source.width;
    logo.setDisplaySize(source.width * scale, source.height * scale);
    return true;
  }

  private createImageButton(args: {
    x: number;
    y: number;
    normalKey: string;
    hoverKey?: string;
    pressedKey?: string;
    disabledKey?: string;
    width: number;
    height: number;
    onClick: () => void;
    allowClickWhen?: () => boolean;
  }): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(args.normalKey)) return null;
    const image = this.add
      .image(args.x, args.y, args.normalKey)
      .setOrigin(0.5)
      .setDisplaySize(args.width, args.height)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    const canInteract = (): boolean => (args.allowClickWhen ? args.allowClickWhen() : true);
    image.on("pointerover", () => {
      if (canInteract() && args.hoverKey && this.textures.exists(args.hoverKey)) {
        image.setTexture(args.hoverKey);
      }
    });
    image.on("pointerout", () => {
      if (!canInteract() && args.disabledKey && this.textures.exists(args.disabledKey)) {
        image.setTexture(args.disabledKey);
        return;
      }
      image.setTexture(args.normalKey);
    });
    image.on("pointerdown", () => {
      if (!canInteract()) {
        if (args.disabledKey && this.textures.exists(args.disabledKey)) {
          image.setTexture(args.disabledKey);
        }
        return;
      }
      if (args.pressedKey && this.textures.exists(args.pressedKey)) {
        image.setTexture(args.pressedKey);
      }
      args.onClick();
    });
    image.on("pointerup", () => {
      if (!canInteract() && args.disabledKey && this.textures.exists(args.disabledKey)) {
        image.setTexture(args.disabledKey);
        return;
      }
      if (args.hoverKey && this.textures.exists(args.hoverKey)) {
        image.setTexture(args.hoverKey);
        return;
      }
      image.setTexture(args.normalKey);
    });
    return image;
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

  /** 端末が縦向きか。scale.width/height はゲーム固定解像度なので inner や Scale API を使う */
  private isDevicePortrait(): boolean {
    if (this.scale.isPortrait) return true;
    if (this.scale.isLandscape) return false;
    if (typeof window !== "undefined") {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  }

  private updateOrientationState(): void {
    const isPortrait = this.isDevicePortrait();
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
    // 「遊び方」は説明量が多いため、通常モーダルより横幅と高さを少し広げる
    const isHowToModal = payload.title === "遊び方";
    const modalW = Math.min(width * (isHowToModal ? 0.78 : 0.72), isHowToModal ? 500 : 460);
    const modalH = Math.min(height * (isHowToModal ? 0.84 : 0.78), isHowToModal ? 330 : 290);
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
    const controls: Phaser.GameObjects.GameObject[] = [];
    if (payload.title === "遊び方") {
      const isDesktopDevice = this.sys.game.device.os.desktop;
      const pages = [
        {
          heading: "1/4 操作方法",
          body: isDesktopDevice
            ? [
                "⭐ ジャンプ：SPACE / ↑",
                "⚡ 攻撃：X（クールタイムあり）",
              ].join("\n")
            : [
                "⭐ ジャンプ：JUMPボタン",
                "👆 左画面半分タップでもジャンプ",
                "⚡ ATTACKで攻撃（CTあり）",
              ].join("\n"),
        },
        {
          heading: "2/4 アイテム",
          body: [
            "💰 通常アイテム：獲得金額が加算",
            "🌈 栄養ドリンク：一定時間無敵",
            "✨ スペシャルロゴ：スキルを保持",
            "🎯 C / SKILLボタンで発動",
            "🟣 期限切れアイテム：半額分を減額",
          ].join("\n"),
        },
        {
          heading: "3/4 ひったくり犯",
          body: [
            "⚠ 接触すると所持金を減額",
            "💥 攻撃で撃退するとボーナス",
            "🛡 無敵中は被害なし",
          ].join("\n"),
        },
        {
          heading: "4/4 ランクと上達",
          body: [
            "🔥 15,000円を超えると上級モードへ移行",
            "⚡ 20,000円を超えるとさらに加速",
          ].join("\n"),
        },
      ] as const;
      let pageIndex = 0;
      const bodyCard = this.add
        .rectangle(centerX, centerY - 6, modalW - 68, modalH - 150, 0x1e293b, 0.82)
        .setDepth(201)
        .setStrokeStyle(2, 0x93c5fd, 0.65);
      bodyCard.setRounded?.(14);
      const headingText = this.add
        .text(centerX, centerY - modalH / 2 + 62, "", {
          fontSize: "18px",
          color: "#fbbf24",
          fontStyle: "bold",
          stroke: "#7c2d12",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0)
        .setDepth(202);
      const bodyText = this.add
        .text(centerX, centerY - 6, "", {
          fontSize: "16px",
          color: "#f8fafc",
          align: "left",
          lineSpacing: 10,
          wordWrap: { width: modalW - 116, useAdvancedWrap: true },
          stroke: "#111827",
          strokeThickness: 4,
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0.5)
        .setDepth(202)
        .setShadow(0, 2, "#000000", 0.72, true, true);
      // ランクページは2x2カードにして、視線移動を短くして読みやすくする
      const rankCards = [
        {
          label: "Bronze",
          range: "0円〜4,999円",
          color: "#cd7f32",
          x: centerX - 96,
          y: centerY - 42,
        },
        {
          label: "Silver",
          range: "5,000円〜8,999円",
          color: "#c0c0c0",
          x: centerX + 96,
          y: centerY - 42,
        },
        {
          label: "Gold",
          range: "9,000円〜14,999円",
          color: "#ffd700",
          x: centerX - 96,
          y: centerY + 8,
        },
        {
          label: "Platinum",
          range: "15,000円以上",
          color: "#67e8f9",
          x: centerX + 96,
          y: centerY + 8,
        },
      ] as const;
      const rankCardObjects: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];
      for (const card of rankCards) {
        const bg = this.add
          .rectangle(card.x, card.y, 176, 38, 0x0f172a, 0.88)
          .setDepth(202)
          .setStrokeStyle(2, 0x94a3b8, 0.72)
          .setVisible(false);
        bg.setRounded?.(10);
        const labelText = this.add
          .text(card.x - 76, card.y - 7, card.label, {
            fontSize: "14px",
            color: card.color,
            fontStyle: "bold",
            stroke: "#111827",
            strokeThickness: 4,
          })
          .setOrigin(0, 0.5)
          .setDepth(203)
          .setVisible(false);
        const rangeText = this.add
          .text(card.x - 76, card.y + 8, card.range, {
            fontSize: "13px",
            color: "#f8fafc",
            fontStyle: "bold",
            stroke: "#111827",
            strokeThickness: 4,
          })
          .setOrigin(0, 0.5)
          .setDepth(203)
          .setVisible(false);
        rankCardObjects.push(bg, labelText, rangeText);
      }
      const rankNoteBg = this.add
        // 2行テキストでも窮屈にならないよう、ランク注記枠を広めに取る
        .rectangle(centerX, centerY + 62, modalW - 96, 52, 0x0f172a, 0.9)
        .setDepth(202)
        .setStrokeStyle(2, 0xfbbf24, 0.82)
        .setVisible(false);
      rankNoteBg.setRounded?.(10);
      const rankNoteText = this.add
        .text(centerX, centerY + 62, pages[3].body, {
          fontSize: "14px",
          color: "#f8fafc",
          align: "center",
          lineSpacing: 6,
          fontStyle: "bold",
          stroke: "#111827",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(203)
        .setShadow(0, 2, "#000000", 0.72, true, true)
        .setVisible(false);
      const pagerText = this.add
        .text(centerX, centerY + modalH / 2 - 54, "", {
          fontSize: "15px",
          color: "#cbd5e1",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0.5)
        .setDepth(202);
      const createNavButton = (args: {
        x: number;
        label: string;
        onClick: () => void;
      }): Phaser.GameObjects.GameObject[] => {
        const button = this.add
          .rectangle(args.x, centerY + modalH / 2 - 54, 84, 34, 0x374151, 0.95)
          .setDepth(202)
          .setStrokeStyle(2, 0xfde68a, 0.95)
          .setInteractive({ useHandCursor: true });
        button.setRounded?.(10);
        const text = this.add
          .text(args.x, centerY + modalH / 2 - 54, args.label, {
            fontSize: "15px",
            color: "#fef3c7",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(203);
        button.on("pointerdown", () => args.onClick());
        return [button, text];
      };
      const renderHowToPage = (): void => {
        const page = pages[pageIndex]!;
        headingText.setText(page.heading);
        const isRankPage = pageIndex === 3;
        bodyText.setText(page.body);
        bodyText.setVisible(!isRankPage);
        for (const obj of rankCardObjects) {
          obj.setVisible(isRankPage);
        }
        rankNoteBg.setVisible(isRankPage);
        rankNoteText.setVisible(isRankPage);
        if (isRankPage) {
          headingText.setColor("#fb923c");
          bodyCard.setStrokeStyle(2, 0xfcd34d, 0.9);
        } else {
          bodyText.setPosition(centerX, centerY - 6);
          headingText.setColor("#fbbf24");
          bodyCard.setStrokeStyle(2, 0x93c5fd, 0.65);
        }
        pagerText.setText(`${pageIndex + 1} / ${pages.length}`);
      };
      const prevButton = createNavButton({
        x: centerX - 110,
        label: "◀ 前へ",
        onClick: () => {
          pageIndex = (pageIndex - 1 + pages.length) % pages.length;
          renderHowToPage();
        },
      });
      const nextButton = createNavButton({
        x: centerX + 110,
        label: "次へ ▶",
        onClick: () => {
          pageIndex = (pageIndex + 1) % pages.length;
          renderHowToPage();
        },
      });
      renderHowToPage();
      controls.push(
        bodyCard,
        headingText,
        bodyText,
        ...rankCardObjects,
        rankNoteBg,
        rankNoteText,
        pagerText,
        ...prevButton,
        ...nextButton,
      );
    } else if (payload.title === "設定") {
      const current = loadSave();
      let bgmVolume = current.bgmVolume;
      let seVolume = current.seVolume;
      let muted = current.muted;
      let lastSePreviewAt = 0;
      const applySettings = (): void => {
        const next = writeAudioSettings({ bgmVolume, seVolume, muted });
        bgmVolume = next.bgmVolume;
        seVolume = next.seVolume;
        muted = next.muted;
        setSeVolume(next.seVolume);
        setAudioMuted(next.muted);
        this.sound.volume = next.muted ? 0 : next.bgmVolume;
      };
      const sliderWidth = Math.min(220, modalW - 170);
      const sliderLeft = centerX - sliderWidth / 2 + 24;
      const sliderLabelX = sliderLeft - 72;
      const sliderValueX = sliderLeft + sliderWidth + 46;
      const rowBgmY = centerY - 56;
      const rowSeY = centerY - 12;
      const createVolumeSlider = (args: {
        label: string;
        y: number;
        labelColor: string;
        getValue: () => number;
        setValue: (value: number) => void;
        previewOnChange?: boolean;
      }): Phaser.GameObjects.GameObject[] => {
        const label = this.add
          .text(sliderLabelX, args.y, args.label, {
            fontSize: "18px",
            color: args.labelColor,
            fontStyle: "bold",
          })
          .setOrigin(0, 0.5)
          .setDepth(202);
        const track = this.add
          .rectangle(sliderLeft + sliderWidth / 2, args.y, sliderWidth, 10, 0x334155, 0.95)
          .setDepth(202)
          .setStrokeStyle(2, 0xfde68a, 0.7)
          .setInteractive({ useHandCursor: true });
        track.setRounded?.(5);
        const fill = this.add
          .rectangle(sliderLeft, args.y, 0, 10, 0xf59e0b, 0.98)
          .setOrigin(0, 0.5)
          .setDepth(203);
        fill.setRounded?.(5);
        const knob = this.add
          .circle(sliderLeft, args.y, 11, 0xfef3c7, 0.98)
          .setStrokeStyle(2, 0x7c5a00, 0.95)
          .setDepth(204)
          .setInteractive({ draggable: true, useHandCursor: true });
        const valueText = this.add
          .text(sliderValueX, args.y, "0%", {
            fontSize: "16px",
            color: "#f8fafc",
            fontStyle: "bold",
          })
          .setOrigin(1, 0.5)
          .setDepth(202);
        const syncSliderUi = (normalized: number): void => {
          const knobX = sliderLeft + sliderWidth * normalized;
          knob.setX(knobX);
          fill.setSize(Math.max(2, knobX - sliderLeft), 10);
          valueText.setText(`${Math.round(normalized * 100)}%`);
        };
        const setFromNormalized = (
          rawValue: number,
          opts?: { preview?: boolean; writeSave?: boolean },
        ): void => {
          const normalized = Math.round(Math.max(0, Math.min(1, rawValue)) * 20) / 20;
          args.setValue(normalized);
          syncSliderUi(normalized);
          if (opts?.writeSave !== false) applySettings();
          if (opts?.preview && args.previewOnChange) {
            const now = performance.now();
            // 連続ドラッグ時にSEが過密にならないよう少し間引いて試聴する
            if (now - lastSePreviewAt > 130) {
              sfxPickup();
              lastSePreviewAt = now;
            }
          }
        };
        track.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          setFromNormalized((pointer.x - sliderLeft) / sliderWidth, {
            preview: true,
          });
        });
        this.input.setDraggable(knob, true);
        knob.on(
          "drag",
          (_pointer: Phaser.Input.Pointer, dragX: number) => {
            setFromNormalized((dragX - sliderLeft) / sliderWidth, {
              preview: true,
            });
          },
        );
        setFromNormalized(args.getValue(), { preview: false, writeSave: false });
        return [label, track, fill, knob, valueText];
      };
      controls.push(
        ...createVolumeSlider({
          label: "BGM",
          y: rowBgmY,
          labelColor: "#fde68a",
          getValue: () => bgmVolume,
          setValue: (value) => {
            bgmVolume = value;
          },
        }),
        ...createVolumeSlider({
          label: "SE",
          y: rowSeY,
          labelColor: "#a7f3d0",
          getValue: () => seVolume,
          setValue: (value) => {
            seVolume = value;
          },
          previewOnChange: true,
        }),
      );
      const muteButton = this.add
        .rectangle(centerX, centerY + 42, 210, 42, 0x4b5563, 0.95)
        .setStrokeStyle(2, 0xfde68a, 0.95)
        .setDepth(202)
        .setInteractive({ useHandCursor: true });
      muteButton.setRounded?.(12);
      const muteText = this.add
        .text(centerX, centerY + 42, "", {
          fontSize: "18px",
          color: "#fef3c7",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(203);
      muteButton.on("pointerdown", () => {
        muted = !muted;
        muteText.setText(`ミュート: ${muted ? "ON" : "OFF"}`);
        applySettings();
      });
      controls.push(muteButton, muteText);
      applySettings();
      muteText.setText(`ミュート: ${muted ? "ON" : "OFF"}`);
    } else {
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
      controls.push(body);
    }
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

    this.infoModalLayer = this.add
      .container(0, 0, [backdrop, panel, title, ...controls, closeText])
      .setDepth(200);
    backdrop.on("pointerdown", () => this.closeInfoModal());
    this.input.keyboard?.once("keydown-ESC", () => this.closeInfoModal());
  }

  private closeInfoModal(): void {
    if (!this.infoModalLayer) return;
    this.infoModalLayer.destroy(true);
    this.infoModalLayer = undefined;
    this.isInfoModalOpen = false;
  }

  private startLoopBgm(volume: number, muted: boolean): void {
    const existing = this.sound.get("bgm-title");
    if (existing) existing.destroy();
    this.bgm = this.sound.add("bgm-title", {
      loop: true,
      volume: muted ? 0 : volume,
    });
    this.bgm.play();
    this.sound.volume = muted ? 0 : volume;
  }

  private stopLoopBgm(): void {
    if (!this.bgm) return;
    if (this.bgm.isPlaying) this.bgm.stop();
    this.bgm.destroy();
    this.bgm = undefined;
  }
}
