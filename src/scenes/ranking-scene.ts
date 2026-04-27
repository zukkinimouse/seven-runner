import Phaser from "phaser";
import { loadSave } from "../game/persistence/storage";
import { fetchWeeklyStoreRankingFromSupabase } from "../game/ranking/online-ranking";

type RankingRow = {
  guestId: string;
  nickname: string;
  scoreYen: number;
  bestRunAt: string;
};

export class RankingScene extends Phaser.Scene {
  constructor() {
    super("RankingScene");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const save = loadSave();
    const isCompact = w < 640 || h < 420;

    this.add.rectangle(w / 2, h / 2, w, h, 0x0f172a, 0.95);
    this.add
      .text(w / 2, 24, "店舗ランキング（週間）", {
        fontSize: isCompact ? "26px" : "32px",
        color: "#fef3c7",
        fontStyle: "bold",
        stroke: "#7c2d12",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(w / 2, 64, `店舗: ${save.storeId}`, {
        fontSize: isCompact ? "14px" : "16px",
        color: "#cbd5e1",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);
    const periodText = this.buildWeeklyPeriodLabel();
    this.add
      .text(w / 2, 84, periodText, {
        fontSize: isCompact ? "12px" : "14px",
        color: "#93c5fd",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0);

    const loading = this.add
      .text(w / 2, h / 2 + 8, "読み込み中...", {
        fontSize: isCompact ? "18px" : "22px",
        color: "#e2e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    const backButton = this.add
      .rectangle(w / 2, h - 34, isCompact ? 170 : 210, isCompact ? 40 : 46, 0xfde68a, 0.96)
      .setStrokeStyle(3, 0xf59e0b, 0.95)
      .setInteractive({ useHandCursor: true });
    backButton.setRounded?.(14);
    this.add
      .text(w / 2, h - 34, "タイトルへ戻る", {
        fontSize: isCompact ? "16px" : "18px",
        color: "#4a3500",
        fontStyle: "bold",
        stroke: "#fff7ed",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5);
    backButton.on("pointerdown", () => this.scene.start("TitleScene"));

    void this.renderRanking(save.storeId, loading, isCompact);
  }

  private async renderRanking(
    storeId: string,
    loading: Phaser.GameObjects.Text,
    isCompact: boolean,
  ): Promise<void> {
    let rows: RankingRow[] = [];
    try {
      rows = await fetchWeeklyStoreRankingFromSupabase({ storeId, limit: 20 });
    } catch {
      rows = [];
    }
    loading.destroy();

    const leftX = 44;
    const rightX = this.scale.width - 44;
    const topY = 118;
    const rowH = isCompact ? 36 : 42;
    const maxRows = isCompact ? 8 : 10;
    const shown = rows.slice(0, maxRows);

    if (shown.length === 0) {
      this.add
        .text(this.scale.width / 2, this.scale.height / 2 - 10, "まだランキングデータがありません", {
          fontSize: isCompact ? "18px" : "22px",
          color: "#e2e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0.5);
      return;
    }

    for (let i = 0; i < shown.length; i += 1) {
      const row = shown[i]!;
      const y = topY + i * rowH;
      const rank = i + 1;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : " ";
      const rowBg = this.add
        .rectangle(this.scale.width / 2, y + rowH / 2 - 2, this.scale.width - 56, rowH - 4, 0x1e293b, 0.82)
        .setStrokeStyle(1, 0x334155, 0.9);
      rowBg.setRounded?.(10);
      this.add
        .text(leftX + 8, y + 6, `${medal} ${rank.toString().padStart(2, "0")}`, {
          fontSize: isCompact ? "16px" : "18px",
          color: "#fef08a",
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
      this.add
        .text(leftX + 98, y + 6, row.nickname, {
          fontSize: isCompact ? "16px" : "18px",
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
      this.add
        .text(rightX - 6, y + 6, `¥${row.scoreYen.toLocaleString("ja-JP")}`, {
          fontSize: isCompact ? "16px" : "18px",
          color: "#86efac",
          fontStyle: "bold",
        })
        .setOrigin(1, 0);
    }
  }

  private buildWeeklyPeriodLabel(): string {
    const now = new Date();
    const day = now.getUTCDay() || 7;
    const weekStartUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    weekStartUtc.setUTCDate(weekStartUtc.getUTCDate() - day + 1);
    const weekEndUtc = new Date(weekStartUtc.getTime());
    weekEndUtc.setUTCDate(weekEndUtc.getUTCDate() + 6);
    const toJstDate = (date: Date): string =>
      date.toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "2-digit",
        day: "2-digit",
      });
    return `集計: ${toJstDate(weekStartUtc)}〜${toJstDate(weekEndUtc)} / リセット: 毎週月曜 09:00(JST)`;
  }
}
