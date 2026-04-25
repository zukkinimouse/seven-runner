import Phaser from "phaser";
import {
  applyDamage,
  grantEnergyDrinkInvincibility,
} from "../game/entities/player-controller";
import type { PlayerMode } from "../game/entities/player-controller";
import { sfxBreak, sfxHit, sfxSteal } from "../game/audio/sfx";
import {
  collectItem,
  isEnergyDrinkItem,
  randomItemId,
  stealFromCart,
} from "./game-behavior";
import type { RunState } from "./game-behavior";
import { spawnPickupItem } from "../game/world/spawn-chunk";

/** 衝突・取得の登録（日本語コメントは呼び出し元の意図補助） */
export function registerCollisions(args: {
  scene: Phaser.Scene;
  player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  platforms: Phaser.Physics.Arcade.StaticGroup;
  items: Phaser.Physics.Arcade.Group;
  hazards: Phaser.Physics.Arcade.Group;
  destructibles: Phaser.Physics.Arcade.Group;
  mode: PlayerMode;
  run: RunState;
}): void {
  const { scene, player, platforms, items, hazards, destructibles, mode, run } =
    args;

  scene.physics.add.collider(player, platforms);

  scene.physics.add.overlap(player, items, (_p, obj) => {
    const item = obj as Phaser.GameObjects.Image & {
      body: Phaser.Physics.Arcade.Body;
    };
    const id = item.getData("itemId") as string | undefined;
    const isSpoiled = item.getData("isSpoiled") === true;
    if (!id) return;
    if (isEnergyDrinkItem(id)) {
      // 栄養ドリンク取得後は2秒間の専用無敵を付与する
      grantEnergyDrinkInvincibility(mode, performance.now());
    }
    const addYen = collectItem(run, id, performance.now(), isSpoiled);
    if (addYen > 0) {
      // プレイヤー頭上に金額ポップアップを出すため、加算額だけ通知する
      scene.events.emit("pickup-yen-popup", { yen: addYen });
    } else if (addYen < 0) {
      // 腐敗アイテムなどの減額もHUDで即時フィードバックする
      scene.events.emit("steal-yen-popup", { yen: Math.abs(addYen) });
    }
    item.destroy();
  });

  scene.physics.add.overlap(player, hazards, (_p, obj) => {
    const hz = obj as Phaser.GameObjects.Image & {
      body: Phaser.Physics.Arcade.Body;
    };
    const kind = hz.getData("kind") as "shoplifter" | "biker" | undefined;
    const now = performance.now();

    if (kind === "shoplifter") {
      // 撃破演出に入った個体は接触減額対象から外す
      if (hz.getData("isDefeated") === true) return;
      // 攻撃受付中は撃破処理側を優先し、接触減額と競合させない
      if (now <= mode.attackUntil) return;
      // 無敵中はひったくり判定自体を無効化する
      if (now < mode.invUntil) {
        const lastRepelledAt = (hz.getData("lastRepelledAt") as number | undefined) ?? 0;
        if (now - lastRepelledAt < 220) return;
        hz.setData("lastRepelledAt", now);
        hz.setTint(0x93c5fd);
        scene.tweens.add({
          targets: hz,
          x: hz.x + 44,
          y: hz.y - 12,
          duration: 120,
          ease: "Quad.Out",
          yoyo: true,
          onComplete: () => {
            if (!hz.active) return;
            hz.clearTint();
          },
        });
        return;
      }
      // ひったくり犯接触時はダメージ無し、金額減少のみ適用する
      const lostYen = stealFromCart(run, now, mode);
      if (lostYen > 0) {
        scene.events.emit("steal-yen-popup", { yen: lostYen });
        sfxSteal();
      }
      return;
    }

    const damaged = applyDamage(mode, now);
    if (damaged) {
      run.comboCount = 0;
      sfxHit();
    }
  });

  scene.physics.add.overlap(player, destructibles, (_p, obj) => {
    const box = obj as Phaser.GameObjects.Image & {
      body: Phaser.Physics.Arcade.Body;
    };
    const now = performance.now();
    const canBreak = now <= mode.attackUntil;
    if (!canBreak) {
      // 仕様A: 壊せない状態で接触したらダメージ判定を入れる
      const damaged = applyDamage(mode, now);
      if (damaged) {
        run.comboCount = 0;
        sfxHit();
      }
      return;
    }

    const x = box.x;
    const y = box.y - 40;
    box.destroy();
    sfxBreak();
    // オブジェクト破壊時のドロップは20%に抑える
    if (Math.random() < 0.2) {
      spawnPickupItem(scene, items, x, y, randomItemId());
    }
  });
}
