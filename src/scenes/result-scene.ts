import Phaser from "phaser";
import type { RunResultPayload } from "../game/types";

type RankVisualTheme = {
  primary: string;
  accent: string;
  shadow: number;
  panel: number;
  label: string;
};

export class ResultScene extends Phaser.Scene {
  private payload?: RunResultPayload;

  constructor() {
    super("ResultScene");
  }

  init(data: { payload?: RunResultPayload }): void {
    this.payload = data.payload;
  }

  create(): void {
    const payload = this.payload;
    if (!payload) {
      this.scene.start("TitleScene");
      return;
    }

    const rankTheme = this.getRankVisualTheme(payload.rank);
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const isCompact = viewW <= 760;
    const frameW = Math.min(viewW * 0.94, 900);
    const frameH = Math.min(viewH * 0.92, 500);
    const frameX = viewW / 2;
    const frameY = viewH / 2;
    const frameLeft = frameX - frameW / 2;
    const frameTop = frameY - frameH / 2;
    const frameBottom = frameTop + frameH;
    const rightPanelW = isCompact ? frameW - 28 : Math.max(260, frameW * 0.34);
    const rightPanelH = isCompact ? Math.max(188, frameH * 0.36) : frameH - 28;
    const rightPanelX = isCompact ? frameX : frameLeft + frameW - rightPanelW / 2 - 14;
    const rightPanelY = isCompact ? frameBottom - rightPanelH / 2 - 14 : frameY;
    const receiptLeftX = frameLeft + 24;
    const receiptTopY = frameTop + 26;
    const receiptWidth = isCompact ? frameW - 50 : frameW - rightPanelW - 54;
    const receiptBodyY = receiptTopY + 48;

    this.add
      .rectangle(frameX, frameY, frameW, frameH, 0xfff8e1)
      .setStrokeStyle(3, 0x333333);
    this.add
      .rectangle(rightPanelX, rightPanelY, rightPanelW, rightPanelH, rankTheme.panel, 0.34)
      .setStrokeStyle(3, rankTheme.shadow, 0.5);

    this.add.text(receiptLeftX, receiptTopY, "お買い物レシート", {
      fontSize: isCompact ? "22px" : "26px",
      color: "#111111",
    });

    const aggregatedLines = (() => {
      const order: string[] = [];
      const map = new Map<string, { name: string; count: number; totalYen: number }>();
      for (const line of payload.lines) {
        const key = line.name;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          existing.totalYen += line.yen;
          continue;
        }
        order.push(key);
        map.set(key, { name: line.name, count: 1, totalYen: line.yen });
      }
      return order.map((key) => map.get(key)!);
    })();
    const receiptRightX = receiptLeftX + receiptWidth - 8;
    const receiptLineH = isCompact ? 20 : 24;
    const maxItemRows = isCompact ? 8 : 14;
    let rowY = receiptBodyY;
    const addReceiptRow = (name: string, amount: string, options?: {
      emphasizeAmount?: boolean;
      amountColor?: string;
      nameColor?: string;
    }): void => {
      const nameSize = isCompact ? "13px" : "15px";
      const amountSize = options?.emphasizeAmount
        ? isCompact
          ? "18px"
          : "22px"
        : isCompact
          ? "15px"
          : "19px";
      this.add
        .text(receiptLeftX, rowY, name, {
          fontSize: nameSize,
          color: options?.nameColor ?? "#1f2937",
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
      this.add
        .text(receiptRightX, rowY, amount, {
          fontSize: amountSize,
          color: options?.amountColor ?? "#111111",
          fontStyle: "bold",
          stroke: "#ffffff",
          strokeThickness: 3,
        })
        .setOrigin(1, 0);
      rowY += receiptLineH;
    };
    const addReceiptDivider = (): void => {
      this.add.line(0, 0, receiptLeftX, rowY + 8, receiptRightX, rowY + 8, 0x9ca3af, 1).setOrigin(0, 0);
      rowY += 14;
    };

    addReceiptRow("商品", "金額", { amountColor: "#374151", nameColor: "#374151" });
    addReceiptDivider();
    for (const l of aggregatedLines.slice(0, maxItemRows)) {
      const sign = l.totalYen < 0 ? "-" : "";
      const abs = Math.abs(l.totalYen);
      const quantity = l.count > 1 ? ` x${l.count}` : "";
      addReceiptRow(`${l.name}${quantity}`, `${sign}¥${abs.toLocaleString("ja-JP")}`, {
        amountColor: l.totalYen < 0 ? "#2563eb" : "#111111",
      });
    }
    addReceiptDivider();
    addReceiptRow("小計（明細合計）", `¥${payload.subtotalYen.toLocaleString("ja-JP")}`);
    addReceiptRow("コンボ倍率", `×${payload.comboMultiplier.toFixed(1)}`);
    addReceiptDivider();
    addReceiptRow("合計", `¥${payload.totalYen.toLocaleString("ja-JP")}`, {
      emphasizeAmount: true,
      amountColor: "#b91c1c",
    });
    const receiptCenterX = receiptLeftX + receiptWidth / 2;
    const receiptCtaY = rowY + (isCompact ? 24 : 30);
    const ctaHeight = isCompact ? 44 : 54;
    const ctaWidth = Math.min(receiptWidth * 0.44, isCompact ? 150 : 188);
    const ctaGap = isCompact ? 14 : 18;
    const createResultActionButton = (args: {
      x: number;
      label: string;
      fillColor: number;
      strokeColor: number;
      onClick: () => void;
    }): Phaser.GameObjects.GameObject[] => {
      const shadow = this.add
        .rectangle(args.x + 2, receiptCtaY + 2, ctaWidth, ctaHeight, 0x7c2d12, 0.24)
        .setDepth(8);
      const box = this.add
        .rectangle(args.x, receiptCtaY, ctaWidth, ctaHeight, args.fillColor, 0.98)
        .setStrokeStyle(4, args.strokeColor, 0.95)
        .setDepth(9)
        .setInteractive({ useHandCursor: true });
      box.setRounded?.(16);
      const text = this.add
        .text(args.x, receiptCtaY, args.label, {
          fontSize: isCompact ? "18px" : "22px",
          color: "#4a3500",
          fontStyle: "bold",
          stroke: "#fff7ed",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(10);
      box.on("pointerdown", () => args.onClick());
      this.tweens.add({
        targets: [box, text, shadow],
        scale: 1.03,
        duration: 780,
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
      });
      return [shadow, box, text];
    };
    const retryX = receiptCenterX - (ctaWidth / 2 + ctaGap / 2);
    const titleX = receiptCenterX + (ctaWidth / 2 + ctaGap / 2);
    createResultActionButton({
      x: retryX,
      label: "もう一度",
      fillColor: 0xfde68a,
      strokeColor: 0xf59e0b,
      onClick: () => this.scene.start("GameScene"),
    });
    createResultActionButton({
      x: titleX,
      label: "タイトルへ",
      fillColor: 0xfff7d6,
      strokeColor: 0xfb923c,
      onClick: () => this.scene.start("TitleScene"),
    });
    this.add
      .text(receiptCenterX, receiptCtaY + ctaHeight / 2 + (isCompact ? 22 : 26), "SPACE: もう一度 / T: タイトルへ", {
        fontSize: isCompact ? "12px" : "14px",
        color: "#6b7280",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    const panelTop = rightPanelY - rightPanelH / 2;
    const resultTitleY = panelTop + 20;
    const rankLabelY = resultTitleY + (isCompact ? 4 : 52);
    const rankValueY = rankLabelY + (isCompact ? 22 : 34);
    const couponHeadingY = rankValueY + (isCompact ? 84 : 110);
    const couponBubbleY = couponHeadingY + (isCompact ? 96 : 106);
    const couponBubbleW = Math.min(rightPanelW - 30, isCompact ? frameW * 0.62 : 238);
    const couponBubbleH = isCompact ? 104 : 132;

    this.add
      .text(rightPanelX, resultTitleY, "RESULT", {
        fontSize: isCompact ? "28px" : "34px",
        color: "#fef3c7",
        fontStyle: "bold",
        stroke: "#7c2d12",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(rightPanelX, rankLabelY, rankTheme.label, {
        fontSize: isCompact ? "18px" : "22px",
        color: rankTheme.accent,
        fontStyle: "bold",
        stroke: "#111827",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    const rankText = this.add
      .text(rightPanelX, rankValueY, payload.rank, {
        fontSize: isCompact ? "64px" : "82px",
        color: rankTheme.primary,
        fontStyle: "bold",
        stroke: rankTheme.accent,
        strokeThickness: 10,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 6, "#000000", 0.35, true, true);

    this.tweens.add({
      targets: rankText,
      scale: 1.08,
      angle: 1.5,
      duration: 700,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(rightPanelX, couponHeadingY, "獲得クーポン", {
        fontSize: isCompact ? "20px" : "24px",
        color: "#fef9c3",
        fontStyle: "bold",
        stroke: "#78350f",
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);

    const couponBubble = this.add
      .rectangle(rightPanelX, couponBubbleY, couponBubbleW, couponBubbleH, 0xfffbeb, 0.96)
      .setStrokeStyle(4, rankTheme.shadow, 0.8);
    couponBubble.setRounded?.(24);

    this.add
      .text(rightPanelX, couponBubbleY, payload.couponText, {
        fontSize: isCompact ? "24px" : "28px",
        color: rankTheme.primary,
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: couponBubbleW - 24 },
        stroke: "#111827",
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0.5);

    this.spawnResultConfetti(rightPanelX, rankValueY + 58, rankTheme.shadow);

    this.input.keyboard?.once("keydown-SPACE", () => this.scene.start("GameScene"));
    this.input.keyboard?.once("keydown-T", () => this.scene.start("TitleScene"));
  }

  private getRankVisualTheme(rank: string): RankVisualTheme {
    const normalized = rank.toUpperCase();
    if (normalized === "A" || normalized.includes("GOLD")) {
      return {
        primary: "#facc15",
        accent: "#fef08a",
        shadow: 0xb45309,
        panel: 0x92400e,
        label: "GOLD RANK",
      };
    }
    if (normalized === "B" || normalized.includes("SILVER")) {
      return {
        primary: "#d1d5db",
        accent: "#f3f4f6",
        shadow: 0x475569,
        panel: 0x334155,
        label: "SILVER RANK",
      };
    }
    if (normalized === "C") {
      return {
        primary: "#f59e0b",
        accent: "#fcd34d",
        shadow: 0x7c2d12,
        panel: 0x7c2d12,
        label: "BRONZE RANK",
      };
    }
    return {
      primary: "#93c5fd",
      accent: "#dbeafe",
      shadow: 0x1e3a8a,
      panel: 0x1e3a8a,
      label: "STARTER RANK",
    };
  }

  private spawnResultConfetti(centerX: number, centerY: number, tintColor: number): void {
    for (let i = 0; i < 10; i += 1) {
      const piece = this.add
        .star(
          centerX + Phaser.Math.Between(-110, 110),
          centerY + Phaser.Math.Between(-140, 140),
          5,
          Phaser.Math.Between(5, 8),
          Phaser.Math.Between(12, 18),
          tintColor,
          0.9,
        )
        .setDepth(5);
      this.tweens.add({
        targets: piece,
        y: piece.y - Phaser.Math.Between(8, 18),
        alpha: 0.35,
        angle: Phaser.Math.Between(-24, 24),
        duration: Phaser.Math.Between(700, 1200),
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
      });
    }
  }
}
