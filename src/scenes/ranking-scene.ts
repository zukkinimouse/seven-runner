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

    const loading = this.add
      .text(w / 2, h / 2, "読み込み中...", {
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

    const leftX = 56;
    const topY = 104;
    const rowH = isCompact ? 24 : 28;
    const maxRows = isCompact ? 10 : 12;
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
      this.add
        .text(leftX, y, `${medal} ${rank.toString().padStart(2, "0")}`, {
          fontSize: isCompact ? "14px" : "16px",
          color: "#fef08a",
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
      this.add
        .text(leftX + 84, y, row.nickname, {
          fontSize: isCompact ? "14px" : "16px",
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
      this.add
        .text(this.scale.width - 48, y, `¥${row.scoreYen.toLocaleString("ja-JP")}`, {
          fontSize: isCompact ? "14px" : "16px",
          color: "#86efac",
          fontStyle: "bold",
        })
        .setOrigin(1, 0);
    }
  }
}
