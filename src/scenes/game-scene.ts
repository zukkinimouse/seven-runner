/** メインのラン／生成／入力を束ねるシーン */
import Phaser from "phaser";
import {
  FALL_DEATH_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  PLAYER_START_X,
} from "../game/game-config";
import { createChunkSpawnerState, type ChunkSpawnerState } from "../game/spawners/chunk-spawner";
import {
  createPlayerMode,
  updatePlayerPhysics,
  updatePlayerVisual,
  applyInvincibilityVisual,
  applyNormalHitbox,
  tryJump,
  tryAttack,
  getAttackCooldownRemainingMs,
} from "../game/entities/player-controller";
import {
  sfxAttack,
  sfxAttackHit,
  sfxBreak,
  sfxJump,
  sfxSpecialActivate,
  sfxSpecialHitEnemy,
  sfxSpecialHitObject,
  sfxSnatcherDefeat,
} from "../game/audio/sfx";
import { loadSave } from "../game/persistence/storage";
import { scrollSpeedForElapsedSeconds } from "../game/logic/difficulty";
import { createTouchControls, type TouchControlsUi } from "../game/entities/touch-controls";
import { cleanupOldChunks, createRunState, type RunState } from "./game-behavior";
import { randomItemId } from "./game-behavior";
import {
  createBackgroundLayers,
  updateBackgroundScroll,
  type BackgroundState,
} from "./game-scene-background";
import { registerCollisions } from "./game-scene-collisions";
import { runChunkSpawns, transitionToResult } from "./game-scene-flow";
import { updateHazardVelocities } from "./game-scene-helpers";
import { handleDesktopKeyboard } from "./game-scene-input";
import {
  createStaffSystemState,
  updateStaffSystem,
  type StaffSystemState,
} from "./game-scene-staff";
import type { SpawnedChunkHandle } from "../game/world/spawn-chunk";
import { spawnPickupItem } from "../game/world/spawn-chunk";

type SpecialFlameShot = {
  sprite: Phaser.GameObjects.Image;
  hitHazards: Set<Phaser.GameObjects.Image>;
  hitDestructibles: Set<Phaser.GameObjects.Image>;
};

export class GameScene extends Phaser.Scene {
  // キリン素材の余白ぶんを補正して、足元をレール上に合わせる
  private static readonly PLAYER_VISUAL_OFFSET_Y = 33;
  private static readonly ITEM_COLLECTOR_W = 66;
  private static readonly ITEM_COLLECTOR_H = 54;
  private static readonly ITEM_COLLECTOR_OFFSET_Y = -66;
  private static readonly FLAME_DISPLAY_W = 68;
  private static readonly FLAME_DISPLAY_H = 38;
  private static readonly HUD_FONT_FAMILY = '"Arial Black", "Trebuchet MS", sans-serif';
  private static readonly SNATCHER_TEXTURE_KEYS = [
    "obstacle-snatcher-1",
    "obstacle-snatcher-2",
    "obstacle-snatcher-3",
  ] as const;
  private static readonly SPEED_BOOST_SILVER_YEN = 15000;
  private static readonly SPEED_BOOST_GOLD_YEN = 30000;
  private static readonly SPEED_BOOST_PLATINUM_YEN = 45000;
  private static readonly SPEED_BOOST_MASTER_YEN = 70000;
  private static readonly SPEED_BOOST_GOD_YEN = 100000;
  private static readonly SNATCHER_HITBOX_SCALE_X = 0.8;
  private static readonly SNATCHER_HITBOX_SCALE_Y = 0.84;
  private static readonly SPECIAL_FLAME_COUNT = 7;
  private static readonly SPECIAL_FLAME_SPEED = 1080;
  private static readonly SPECIAL_FLAME_SPACING_RATIO = 0.42;
  private static readonly SPECIAL_FLAME_HITBOX_W = 122;
  private static readonly SPECIAL_FLAME_HITBOX_H = 26;
  private static readonly SPECIAL_FLAME_DESPAWN_MARGIN = 120;
  private static readonly DESTRUCTIBLE_DROP_CHANCE = 0.2;
  private static readonly SPECIAL_LOGO_SPAWN_MIN_Y = 260;
  private static readonly SPECIAL_LOGO_SPAWN_MAX_Y = 310;
  private static readonly ATTACK_FLAME_TEXTURE_KEYS = [
    "player-attack-flame-1",
    "player-attack-flame-2",
    "player-attack-flame-3",
    "player-attack-flame-4",
    "player-attack-flame",
  ] as const;
  private static readonly ITEM_PICKUP_EFFECT_TEXTURE_KEYS = [
    "item-effect-pickup-1",
    "item-effect-pickup-2",
    "item-effect-pickup-3",
    "item-effect-pickup-4",
    "item-effect-pickup-5",
    "item-effect-pickup-6",
  ] as const;
  private static readonly SKILL_HOLD_EFFECT_TEXTURE_KEYS = [
    "item-effect-pickup-1",
    "item-effect-pickup-2",
    "item-effect-pickup-3",
    "item-effect-pickup-4",
    "item-effect-pickup-5",
    "item-effect-pickup-6",
  ] as const;
  private static readonly SKILL_HOLD_FRAME_MS = 90;
  // 一時デバッグ用: true で開始直後から最大速度(360px/s)扱いにする
  private static readonly DEBUG_FORCE_MAX_SPEED_START = false;
  private static readonly MAX_SPEED_ELAPSED_SEC = 180;

  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private itemCollector!: Phaser.GameObjects.Rectangle;
  private mode = createPlayerMode();
  private run: RunState = createRunState();
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private items!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private destructibles!: Phaser.Physics.Arcade.Group;

  private spawner!: ChunkSpawnerState;
  private chunks: SpawnedChunkHandle[] = [];
  private background!: BackgroundState;

  private hudHpText!: Phaser.GameObjects.Text;
  private hudYenText!: Phaser.GameObjects.Text;
  private hudTimeText!: Phaser.GameObjects.Text;
  private comboTitle!: Phaser.GameObjects.Text;
  private comboCountText!: Phaser.GameObjects.Text;
  private comboMultText!: Phaser.GameObjects.Text;
  private pauseButtonShadow!: Phaser.GameObjects.Rectangle;
  private pauseButtonBg!: Phaser.GameObjects.Rectangle;
  private pauseButtonText!: Phaser.GameObjects.Text;
  private pauseOverlayBg!: Phaser.GameObjects.Rectangle;
  private pauseOverlayPanel!: Phaser.GameObjects.Rectangle;
  private pauseOverlayTitle!: Phaser.GameObjects.Text;
  private pauseOverlayHint!: Phaser.GameObjects.Text;
  private isGameplayPaused = false;
  private pausedAtMs: number | null = null;
  private touchControlsUi?: TouchControlsUi;
  private lastCelebratedComboTier = 0;
  private attackFlame!: Phaser.GameObjects.Image;
  private bgm?: Phaser.Sound.BaseSound;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyX!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;
  private ended = false;
  private nextEnergyDrinkSpawnAtMs = 0;
  /** 直近スポーン時のプレイヤーX（スポーン世界座標ではない。距離クールのバグ防止） */
  private lastEnergyDrinkSpawnPlayerX = Number.NEGATIVE_INFINITY;
  private nextSnatcherMilestoneYen = 1000;
  private pendingSnatcherSpawns = 0;
  private nextSnatcherSpawnAtMs = 0;
  private snatcherJumpUnlocked = false;
  private staffSystem: StaffSystemState = createStaffSystemState();
  private specialFlameShots: SpecialFlameShot[] = [];
  private nextSpecialLogoSpawnAtMs = 0;
  private lastSpecialLogoSpawnPlayerX = Number.NEGATIVE_INFINITY;
  private hasStoredSpecialSkill = false;
  private specialSkillAura?: Phaser.GameObjects.Image;

  constructor() {
    super("GameScene");
  }

  create(): void {
    // Sceneインスタンス再利用時に前回ラン状態が残らないよう、開始時に必ず初期化する
    this.mode = createPlayerMode();
    this.run = createRunState();
    this.chunks = [];
    this.isGameplayPaused = false;
    this.pausedAtMs = null;
    this.ended = false;
    this.lastCelebratedComboTier = 0;
    this.nextEnergyDrinkSpawnAtMs = 0;
    this.lastEnergyDrinkSpawnPlayerX = Number.NEGATIVE_INFINITY;
    this.nextSnatcherMilestoneYen = 1000;
    this.pendingSnatcherSpawns = 0;
    this.nextSnatcherSpawnAtMs = 0;
    this.snatcherJumpUnlocked = false;
    this.staffSystem = createStaffSystemState();
    this.specialFlameShots = [];
    this.nextSpecialLogoSpawnAtMs = 0;
    this.lastSpecialLogoSpawnPlayerX = Number.NEGATIVE_INFINITY;
    this.hasStoredSpecialSkill = false;
    this.specialSkillAura?.destroy();
    this.specialSkillAura = undefined;
    this.physics.resume();

    this.background = createBackgroundLayers(this);
    this.startLoopBgm();

    this.platforms = this.physics.add.staticGroup();
    this.items = this.physics.add.group({ allowGravity: false });
    this.hazards = this.physics.add.group({ allowGravity: false });
    this.destructibles = this.physics.add.group({ allowGravity: false });

    this.player = this.physics.add.sprite(
      PLAYER_START_X,
      GROUND_Y - GameScene.PLAYER_VISUAL_OFFSET_Y,
      "player-run-1",
    );
    this.player.setOrigin(0.5, 1);
    this.player.setDisplaySize(42, 42);
    applyNormalHitbox(this.player);
    this.player.setCollideWorldBounds(false);
    // レール等のワールド要素より手前に描画して、重なりで埋もれて見えるのを防ぐ
    this.player.setDepth(10);
    this.player.play("player-run");
    // アイテム取得専用センサー。胴体の被弾・地形当たり判定と分離して首付近を拾いやすくする
    this.itemCollector = this.add
      .rectangle(
        this.player.x,
        this.player.y + GameScene.ITEM_COLLECTOR_OFFSET_Y,
        GameScene.ITEM_COLLECTOR_W,
        GameScene.ITEM_COLLECTOR_H,
        0x00ff00,
        0,
      )
      .setDepth(1);
    this.physics.add.existing(this.itemCollector);
    const collectorBody = this.itemCollector.body as Phaser.Physics.Arcade.Body;
    collectorBody.setAllowGravity(false);
    collectorBody.setImmovable(true);
    this.attackFlame = this.add
      .image(this.player.x, this.player.y, this.pickAttackFlameTextureKey())
      .setDepth(12)
      .setVisible(false);

    this.spawner = createChunkSpawnerState(0);
    this.nextEnergyDrinkSpawnAtMs = this.pickNextEnergyDrinkSpawnMs(
      performance.now(),
    );
    this.nextSpecialLogoSpawnAtMs = this.pickNextSpecialLogoSpawnMs(
      performance.now(),
    );
    this.nextSnatcherSpawnAtMs = performance.now();
    this.ensureWorld(0);

    registerCollisions({
      scene: this,
      player: this.player,
      itemCollector: this.itemCollector as Phaser.GameObjects.Rectangle & {
        body: Phaser.Physics.Arcade.Body;
      },
      platforms: this.platforms,
      items: this.items,
      hazards: this.hazards,
      destructibles: this.destructibles,
      mode: this.mode,
      run: this.run,
    });
    this.events.on(
      "pickup-yen-popup",
      (payload: { yen: number }) => {
        // 通常取得時は金額ポップアップのみ表示する
        this.spawnYenPopup(this.player.x, this.player.y - 73, payload.yen, {
          followPlayer: true,
          isLoss: false,
        });
      },
    );
    this.events.on("steal-yen-popup", (payload: { yen: number }) => {
      this.spawnYenPopup(this.player.x, this.player.y - 73, payload.yen, {
        followPlayer: true,
        isLoss: true,
      });
    });
    this.events.on("pickup-seven-logo-special", () => {
      this.storeSpecialSkill();
    });

    const kb = this.input.keyboard;
    if (kb) {
      this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      this.keyX = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
      this.keyShift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    }

    this.touchControlsUi = createTouchControls(this, {
      onJump: () => {
        tryJump(this.player, this.mode, performance.now());
        sfxJump();
      },
      onAttack: () => {
        const attacked = tryAttack(this.mode, performance.now());
        if (attacked) sfxAttack();
      },
      onSkill: () => {
        this.activateStoredSpecialSkill();
      },
    });

    this.cameras.main.setBounds(0, 0, 200000, GAME_HEIGHT);
    const isMobileDevice = !this.sys.game.device.os.desktop;
    // スマホは縦方向の追従を止めて、ジャンプ時の全画面ガタつき感を抑える
    const cameraLerpY = isMobileDevice ? 0 : 0.12;
    this.cameras.main.startFollow(this.player, true, 0.12, cameraLerpY, -160, 40);

    this.createHud();
    this.createPauseButton();
    this.createPauseOverlay();
    this.createComboUi();
  }

  update(): void {
    if (this.ended) return;
    if (this.isGameplayPaused) return;

    const now = performance.now();
    const elapsedSec = (now - this.run.startMs) / 1000;
    const speedElapsedSec = GameScene.DEBUG_FORCE_MAX_SPEED_START
      ? GameScene.MAX_SPEED_ELAPSED_SEC
      : elapsedSec;
    // 店員スポーンの最大速度レイアウト判定は scrollSpeed に依存するため、
    // ランク加速（ボーナス秒）とは分離して安定させる。
    const baseScrollSpeed = scrollSpeedForElapsedSeconds(speedElapsedSec);
    const difficultyElapsedSec = speedElapsedSec + this.getAdvancedModeElapsedBonusSec();
    const boostedScrollSpeed = scrollSpeedForElapsedSeconds(difficultyElapsedSec);
    const deltaSec = this.game.loop.delta / 1000;

    updateBackgroundScroll(this.background, this, elapsedSec, boostedScrollSpeed, deltaSec);

    updatePlayerPhysics(this.player, this.mode, boostedScrollSpeed, now);
    updatePlayerVisual(this.player, this.mode);
    this.updateItemCollectorPosition();
    applyInvincibilityVisual(this.player, this.mode, now);

    handleDesktopKeyboard(
      this.player,
      this.mode,
      {
        space: this.keySpace,
        up: this.keyUp,
        x: this.keyX,
        shift: this.keyShift,
        c: this.keyC,
      },
      now,
      () => this.activateStoredSpecialSkill(),
    );
    this.updateAttackFlameAndHits(now);
    this.updateSpecialFlameShots(deltaSec);
    this.updateSpecialSkillAura(now);

    this.updateSnatcherJumpUnlock();
    this.updateSnatcherJumpBehavior(now);
    updateHazardVelocities(this.hazards, boostedScrollSpeed);
    this.touchControlsUi?.setAttackCooldownRemainingMs(
      getAttackCooldownRemainingMs(this.mode, now),
    );
    this.touchControlsUi?.setSkillReady(this.hasStoredSpecialSkill);

    this.updateRainbowPickupItems(now);
    this.updateSpoiledPickupItems(now);

    this.ensureWorld(difficultyElapsedSec);
    this.spawnMilestoneSnatchers(now);
    this.cullStaleEnergyDrinks(this.cameras.main.scrollX);
    this.spawnTimedEnergyDrink(now, this.player.x);
    this.cullStaleSpecialLogos(this.cameras.main.scrollX);
    this.spawnTimedSpecialLogo(now, this.player.x);
    this.updateStaffNpcAndSpeech(now, baseScrollSpeed);
    cleanupOldChunks(this.chunks, this.cameras.main.scrollX);

    this.updateHud(elapsedSec, boostedScrollSpeed);
    this.updateComboUi();

    if (this.player.y > FALL_DEATH_Y || this.mode.hp <= 0) {
      this.ended = true;
      this.endRun(elapsedSec);
    }
  }

  private getAdvancedModeElapsedBonusSec(): number {
    const yen = this.run.cartYen;
    if (yen < GameScene.SPEED_BOOST_SILVER_YEN) return 0;
    // 中間案（段階加速）: ランク帯に応じて難易度計算用の経過秒を底上げする
    if (yen >= GameScene.SPEED_BOOST_GOD_YEN) return 110;
    if (yen >= GameScene.SPEED_BOOST_MASTER_YEN) return 90;
    if (yen >= GameScene.SPEED_BOOST_PLATINUM_YEN) return 70;
    if (yen >= GameScene.SPEED_BOOST_GOLD_YEN) return 50;
    return 30; // SILVER
  }

  private updateItemCollectorPosition(): void {
    if (!this.itemCollector?.active) return;
    this.itemCollector.setPosition(
      this.player.x,
      this.player.y + GameScene.ITEM_COLLECTOR_OFFSET_Y,
    );
  }

  /** 栄養ドリンク取得物のレインボー演出（無敵アイテムの視認性） */
  private updateRainbowPickupItems(now: number): void {
    const children = this.items.getChildren() as Phaser.GameObjects.Image[];
    for (const im of children) {
      if (!im?.active) continue;
      const id = im.getData("itemId") as string | undefined;
      if (id === "seven_special_logo") {
        // ロゴは金色寄りの明滅でスペシャル感を出す
        const phase = (now % 1100) / 1100;
        const pulse = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
        im.setTint(0xfff4a3);
        im.setAlpha(pulse);
        continue;
      }
      if (id !== "energy_drink") continue;
      const phase = (now % 2400) / 2400;
      const r = Math.floor(210 + 45 * Math.sin(phase * Math.PI * 2));
      const g = Math.floor(
        210 + 45 * Math.sin(phase * Math.PI * 2 + (2 * Math.PI) / 3),
      );
      const b = Math.floor(
        210 + 45 * Math.sin(phase * Math.PI * 2 + (4 * Math.PI) / 3),
      );
      im.setTint(Phaser.Display.Color.GetColor(r, g, b));
      im.setAlpha(1);
    }
  }

  /** 腐敗アイテムは紫ライティングをゆっくり脈動させて判別しやすくする */
  private updateSpoiledPickupItems(now: number): void {
    const children = this.items.getChildren() as Phaser.GameObjects.Image[];
    for (const im of children) {
      if (!im?.active) continue;
      if (im.getData("isSpoiled") !== true) continue;
      const phase = (now % 1600) / 1600;
      const pulse = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
      im.setTint(0x8b5cf6);
      im.setAlpha(pulse);
    }
  }

  /** コンビニ前の店員NPCと吹き出しを更新する */
  private updateStaffNpcAndSpeech(now: number, scrollSpeed: number): void {
    updateStaffSystem(
      this,
      this.background.mid,
      this.staffSystem,
      this.player.x,
      this.cameras.main.scrollX,
      now,
      scrollSpeed,
    );
  }

  private createHud(): void {
    this.hudHpText = this.add
      .text(16, 10, "", {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: GameScene.HUD_FONT_FAMILY,
        stroke: "#0f172a",
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.hudYenText = this.add
      .text(16, 42, "", {
        fontSize: "28px",
        color: "#fef08a",
        fontFamily: GameScene.HUD_FONT_FAMILY,
        stroke: "#7c2d12",
        strokeThickness: 5,
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.hudTimeText = this.add
      .text(16, 78, "", {
        fontSize: "20px",
        color: "#e2e8f0",
        fontFamily: GameScene.HUD_FONT_FAMILY,
        stroke: "#0f172a",
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  private updateHud(elapsedSec: number, scrollSpeed: number): void {
    const hearts = "❤️".repeat(Math.max(0, this.mode.hp));
    this.hudHpText.setText(hearts);
    this.hudYenText.setText(`¥${this.run.cartYen.toLocaleString("ja-JP")}`);
    this.hudTimeText.setText(
      `⏱ ${elapsedSec.toFixed(1)}s   速度 ${Math.round(scrollSpeed)}px/s`,
    );
  }

  private ensureWorld(elapsedSec: number): void {
    runChunkSpawns(
      this,
      this.spawner,
      this.player.x,
      elapsedSec,
      this.chunks,
      {
        platforms: this.platforms,
        items: this.items,
        hazards: this.hazards,
        destructibles: this.destructibles,
      },
    );
  }

  private endRun(elapsedSec: number): void {
    this.stopLoopBgm();
    transitionToResult(this, this.run, elapsedSec);
  }

  private pickNextEnergyDrinkSpawnMs(baseNowMs: number): number {
    // 出現率が下がりすぎないよう、次回は6〜8秒後に予約する
    return baseNowMs + Phaser.Math.Between(6000, 8000);
  }

  private pickNextSpecialLogoSpawnMs(baseNowMs: number): number {
    // スペシャルロゴは強力なので、栄養ドリンクより長めの間隔にする
    return baseNowMs + Phaser.Math.Between(11000, 14500);
  }

  /** 画面外左に残った栄養ドリンクを破棄（未取得のまま hasActive が固まるのを防ぐ） */
  private cullStaleEnergyDrinks(scrollX: number): void {
    const margin = 420;
    const children = this.items.getChildren() as Phaser.GameObjects.Image[];
    for (const im of children) {
      if (!im?.active) continue;
      if (im.getData("itemId") !== "energy_drink") continue;
      if (im.x < scrollX - margin) im.destroy();
    }
  }

  private spawnTimedEnergyDrink(nowMs: number, playerX: number): void {
    if (nowMs < this.nextEnergyDrinkSpawnAtMs) return;
    if (this.hasActiveEnergyDrink()) return;
    // プレイヤー進行距離ベース（旧実装はスポーンXを入れて条件が常に未達になりやすかった）
    if (playerX - this.lastEnergyDrinkSpawnPlayerX < 1200) return;

    const spawnX = playerX + GAME_WIDTH * 0.9;
    const spawnY = Phaser.Math.Between(290, 390);
    spawnPickupItem(this, this.items, spawnX, spawnY, "energy_drink");
    this.lastEnergyDrinkSpawnPlayerX = playerX;
    this.nextEnergyDrinkSpawnAtMs = this.pickNextEnergyDrinkSpawnMs(nowMs);
  }

  private hasActiveEnergyDrink(): boolean {
    const items = this.items.getChildren() as Phaser.GameObjects.Image[];
    return items.some(
      (item) => item.active && item.getData("itemId") === "energy_drink",
    );
  }

  private hasActiveSpecialLogo(): boolean {
    const items = this.items.getChildren() as Phaser.GameObjects.Image[];
    return items.some(
      (item) => item.active && item.getData("itemId") === "seven_special_logo",
    );
  }

  private cullStaleSpecialLogos(scrollX: number): void {
    const margin = 420;
    const children = this.items.getChildren() as Phaser.GameObjects.Image[];
    for (const im of children) {
      if (!im?.active) continue;
      if (im.getData("itemId") !== "seven_special_logo") continue;
      if (im.x < scrollX - margin) im.destroy();
    }
  }

  private spawnTimedSpecialLogo(nowMs: number, playerX: number): void {
    if (nowMs < this.nextSpecialLogoSpawnAtMs) return;
    if (this.hasActiveSpecialLogo()) return;
    if (playerX - this.lastSpecialLogoSpawnPlayerX < 1650) return;

    const spawnX = playerX + GAME_WIDTH * 0.95;
    const spawnY = Phaser.Math.Between(
      GameScene.SPECIAL_LOGO_SPAWN_MIN_Y,
      GameScene.SPECIAL_LOGO_SPAWN_MAX_Y,
    );
    spawnPickupItem(this, this.items, spawnX, spawnY, "seven_special_logo");
    this.lastSpecialLogoSpawnPlayerX = playerX;
    this.nextSpecialLogoSpawnAtMs = this.pickNextSpecialLogoSpawnMs(nowMs);
  }

  private storeSpecialSkill(): void {
    this.hasStoredSpecialSkill = true;
    // 取得時のみ短い取得エフェクトを表示する
    this.spawnItemPickupEffect(this.player.x, this.player.y - 68);
    this.ensureSpecialSkillAura();
  }

  private activateStoredSpecialSkill(): void {
    if (!this.hasStoredSpecialSkill) return;
    this.hasStoredSpecialSkill = false;
    this.specialSkillAura?.destroy();
    this.specialSkillAura = undefined;
    sfxSpecialActivate();
    this.fireSpecialLogoFlames();
  }

  private ensureSpecialSkillAura(): void {
    if (!this.hasStoredSpecialSkill) return;
    if (this.specialSkillAura?.active) return;
    const loaded = GameScene.SKILL_HOLD_EFFECT_TEXTURE_KEYS.filter((key) =>
      this.textures.exists(key),
    );
    if (loaded.length === 0) return;
    const key = Phaser.Utils.Array.GetRandom([...loaded]);
    this.specialSkillAura = this.add
      .image(this.player.x, this.player.y - 40, key)
      .setDepth(9)
      .setAlpha(0.26);
    // 保持中オーラは主張しすぎない中サイズに固定する
    this.specialSkillAura.setDisplaySize(192, 192);
  }

  private updateSpecialSkillAura(now: number): void {
    if (!this.hasStoredSpecialSkill) {
      this.specialSkillAura?.destroy();
      this.specialSkillAura = undefined;
      return;
    }
    this.ensureSpecialSkillAura();
    if (!this.specialSkillAura?.active) return;
    const loaded = GameScene.SKILL_HOLD_EFFECT_TEXTURE_KEYS.filter((key) =>
      this.textures.exists(key),
    );
    if (loaded.length > 0) {
      // 保持演出は拡大縮小ではなく、6枚差分をコマ送りで再生する
      const frame = Math.floor(now / GameScene.SKILL_HOLD_FRAME_MS) % loaded.length;
      this.specialSkillAura.setTexture(loaded[frame]!);
    }
    const phase = (now % 1200) / 1200;
    const alpha = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
    this.specialSkillAura
      .setPosition(this.player.x, this.player.y - 40)
      .setAlpha(alpha);
  }

  private fireSpecialLogoFlames(): void {
    const mouthCenterY = this.player.y - 75;
    const playerBody = this.player.body;
    // 口元基準の間隔に +5px して、上下の抜けを強める
    const spacing = Phaser.Math.Clamp(
      playerBody.height * GameScene.SPECIAL_FLAME_SPACING_RATIO + 5,
      21,
      34,
    );
    const halfSpread = spacing * (GameScene.SPECIAL_FLAME_COUNT - 1) * 0.5;
    // 地面に少し埋まるのは許容し、画面外だけを避ける
    const clampedCenterY = Phaser.Math.Clamp(
      mouthCenterY,
      30 + halfSpread,
      GAME_HEIGHT - 8 - halfSpread,
    );

    for (let i = 0; i < GameScene.SPECIAL_FLAME_COUNT; i += 1) {
      const offsetIndex = i - (GameScene.SPECIAL_FLAME_COUNT - 1) / 2;
      const y = clampedCenterY + offsetIndex * spacing;
      const sprite = this.add
        .image(this.player.x + 56, y, this.pickAttackFlameTextureKey())
        .setDepth(12)
        .setDisplaySize(74, 30)
        .setAlpha(0.94);
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0.7, to: 1 },
        duration: 130,
        yoyo: true,
        repeat: 1,
      });
      this.specialFlameShots.push({
        sprite,
        hitHazards: new Set(),
        hitDestructibles: new Set(),
      });
    }

    // 取得直後の爽快感を出すため、短いフラッシュを重ねる
    const flash = this.add
      .circle(this.player.x + 28, clampedCenterY, 28, 0xfff1a8, 0.6)
      .setDepth(13);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.1,
      duration: 220,
      ease: "Quad.Out",
      onComplete: () => flash.destroy(),
    });
  }

  private updateSpecialFlameShots(deltaSec: number): void {
    if (this.specialFlameShots.length === 0) return;

    const hitHazards: Phaser.GameObjects.Image[] = [];
    const hitDestructibles: Phaser.GameObjects.Image[] = [];
    const rightEdge =
      this.cameras.main.scrollX +
      GAME_WIDTH +
      GameScene.SPECIAL_FLAME_DESPAWN_MARGIN;

    for (let i = this.specialFlameShots.length - 1; i >= 0; i -= 1) {
      const shot = this.specialFlameShots[i];
      if (!shot.sprite.active) {
        this.specialFlameShots.splice(i, 1);
        continue;
      }

      shot.sprite.x += GameScene.SPECIAL_FLAME_SPEED * deltaSec;
      if (shot.sprite.x > rightEdge) {
        shot.sprite.destroy();
        this.specialFlameShots.splice(i, 1);
        continue;
      }

      const flameRect = new Phaser.Geom.Rectangle(
        shot.sprite.x + 4,
        shot.sprite.y - GameScene.SPECIAL_FLAME_HITBOX_H * 0.5,
        GameScene.SPECIAL_FLAME_HITBOX_W,
        GameScene.SPECIAL_FLAME_HITBOX_H,
      );

      const hazards = this.hazards.getChildren() as Phaser.GameObjects.Image[];
      for (const hz of hazards) {
        if (!hz.active) continue;
        if (hz.getData("isDefeated")) continue;
        if (shot.hitHazards.has(hz)) continue;
        const body = (hz as Phaser.GameObjects.Image & {
          body?: Phaser.Physics.Arcade.Body;
        }).body;
        if (!body || !body.enable) continue;
        if (!this.isRectOverlappingBody(flameRect, body)) continue;
        shot.hitHazards.add(hz);
        hitHazards.push(hz);
      }

      const destructibles = this.destructibles.getChildren() as Phaser.GameObjects.Image[];
      for (const dst of destructibles) {
        if (!dst.active) continue;
        if (shot.hitDestructibles.has(dst)) continue;
        const body = (dst as Phaser.GameObjects.Image & {
          body?: Phaser.Physics.Arcade.Body;
        }).body;
        if (!body || !body.enable) continue;
        if (!this.isRectOverlappingBody(flameRect, body)) continue;
        shot.hitDestructibles.add(dst);
        hitDestructibles.push(dst);
      }
    }

    let defeatedSnatcher = false;
    let otherFlameHazard = false;
    for (const hz of hitHazards) {
      if (!hz.active) continue;
      const kind = hz.getData("kind") as "shoplifter" | "biker" | undefined;
      if (kind === "shoplifter") {
        this.spawnAttackHitEffect(hz.x, hz.y, "destructible");
        const bonusYen = this.snatcherDefeatBonusByYen(this.run.cartYen);
        this.run.cartYen += bonusYen;
        this.run.receiptLines.push({
          name: "（ひったくり撃退ボーナス）",
          yen: bonusYen,
        });
        this.spawnYenPopup(hz.x, hz.y - 22, bonusYen);
        this.playSnatcherDefeatEffect(hz);
        defeatedSnatcher = true;
        continue;
      }
      this.spawnAttackHitEffect(hz.x, hz.y, "hazard");
      hz.destroy();
      otherFlameHazard = true;
    }

    let brokeDestructible = false;
    for (const dst of hitDestructibles) {
      if (!dst.active) continue;
      const dropX = dst.x;
      const dropY = dst.y - 40;
      this.spawnAttackHitEffect(dst.x, dst.y, "hazard");
      dst.destroy();
      if (Math.random() < GameScene.DESTRUCTIBLE_DROP_CHANCE) {
        spawnPickupItem(this, this.items, dropX, dropY, randomItemId());
      }
      brokeDestructible = true;
    }

    if (defeatedSnatcher) {
      sfxSnatcherDefeat();
      sfxSpecialHitEnemy();
    }
    if (otherFlameHazard || hitDestructibles.length > 0) sfxSpecialHitObject();
    if (brokeDestructible) sfxBreak();
  }

  private spawnMilestoneSnatchers(now: number): void {
    // 合計金額が1000円を超えるたびに出現予約だけ積み、同時湧きを防ぐ
    while (this.run.cartYen >= this.nextSnatcherMilestoneYen) {
      this.pendingSnatcherSpawns += 1;
      this.nextSnatcherMilestoneYen += 1000;
    }
    if (this.pendingSnatcherSpawns <= 0) return;
    if (now < this.nextSnatcherSpawnAtMs) return;
    this.spawnSnatcherAhead();
    this.pendingSnatcherSpawns -= 1;
    // 1体出たら8秒のクールタイムを必ず挟む
    this.nextSnatcherSpawnAtMs = now + 8000;
  }

  private spawnSnatcherAhead(): void {
    const availableKeys = GameScene.SNATCHER_TEXTURE_KEYS.filter((key) =>
      this.textures.exists(key),
    );
    const textureKey =
      availableKeys.length > 0
        ? Phaser.Utils.Array.GetRandom(availableKeys)
        : "obstacle-cone";
    const snatcher = this.add.image(0, 0, textureKey);
    const displaySize = 110;
    const spawnX = this.player.x + Phaser.Math.Between(720, 860);
    snatcher.setDisplaySize(displaySize, displaySize);
    snatcher.x = spawnX;
    snatcher.y = GROUND_Y - snatcher.displayHeight / 2;
    this.physics.add.existing(snatcher);
    const body = snatcher.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    this.applySnatcherHitbox(snatcher, body);
    snatcher.setData("kind", "shoplifter");
    this.hazards.add(snatcher);
  }

  private applySnatcherHitbox(
    snatcher: Phaser.GameObjects.Image,
    body: Phaser.Physics.Arcade.Body,
  ): void {
    const scaleX = Math.abs(snatcher.scaleX) || 1;
    const scaleY = Math.abs(snatcher.scaleY) || 1;
    const desiredHitboxW = snatcher.displayWidth * GameScene.SNATCHER_HITBOX_SCALE_X;
    const desiredHitboxH = snatcher.displayHeight * GameScene.SNATCHER_HITBOX_SCALE_Y;
    // setSize はテクスチャ座標基準なので、表示ピクセルから逆算してズレを防ぐ
    const bodyWidthTex = desiredHitboxW / scaleX;
    const bodyHeightTex = desiredHitboxH / scaleY;
    body.setSize(bodyWidthTex, bodyHeightTex);
    // 正面衝突時の抜けを防ぐため、Xは中央寄せ・Yは足元基準で下端を合わせる
    const offsetXTex = (snatcher.width - bodyWidthTex) / 2;
    const offsetYTex = snatcher.height - bodyHeightTex;
    body.setOffset(offsetXTex, offsetYTex);
  }

  private updateSnatcherJumpUnlock(): void {
    // 所持金が1万円を超えた瞬間を境に、以後ずっとジャンプ挙動を有効化する
    if (!this.snatcherJumpUnlocked && this.run.cartYen >= 10000) {
      this.snatcherJumpUnlocked = true;
    }
  }

  private updateSnatcherJumpBehavior(now: number): void {
    if (!this.snatcherJumpUnlocked) return;

    const hazards = this.hazards.getChildren() as Phaser.GameObjects.Image[];
    for (const hz of hazards) {
      if (!hz.active) continue;
      const kind = hz.getData("kind") as "shoplifter" | "biker" | undefined;
      if (kind !== "shoplifter") continue;
      if (hz.getData("isDefeated")) continue;
      if (hz.getData("isSnatcherJumping")) continue;

      const nextJumpAt = hz.getData("nextJumpAt") as number | undefined;
      if (nextJumpAt === undefined) {
        hz.setData("nextJumpAt", now + Phaser.Math.Between(260, 1200));
        continue;
      }
      if (now < nextJumpAt) continue;
      this.launchSnatcherJump(hz, now);
    }
  }

  private launchSnatcherJump(hz: Phaser.GameObjects.Image, now: number): void {
    const startY = GROUND_Y - hz.displayHeight / 2;
    const apexY = startY - Phaser.Math.Between(60, 190);

    hz.setData("isSnatcherJumping", true);
    hz.setData("nextJumpAt", now + Phaser.Math.Between(300, 1800));

    const body = (hz as Phaser.GameObjects.Image & {
      body?: Phaser.Physics.Arcade.Body;
    }).body;
    if (body) body.setVelocity(0, 0);

    // 不規則に見えるよう、着地点・高さ・間隔を毎回ランダム化する
    this.tweens.chain({
      targets: hz,
      tweens: [
        {
          y: apexY,
          duration: Phaser.Math.Between(140, 240),
          ease: "Sine.Out",
          onUpdate: () => {
            if (!body) return;
            if (!hz.active) return;
            if (!body.enable) return;
            body.updateFromGameObject();
          },
        },
        {
          y: startY,
          duration: Phaser.Math.Between(160, 280),
          ease: "Sine.In",
          onUpdate: () => {
            if (!body) return;
            if (!hz.active) return;
            if (!body.enable) return;
            body.updateFromGameObject();
          },
        },
      ],
      onComplete: () => {
        if (!hz.active) return;
        hz.setData("isSnatcherJumping", false);
        hz.y = startY;
        if (body && body.enable) body.updateFromGameObject();
      },
    });
  }

  private snatcherDefeatBonusByYen(cartYen: number): number {
    // 終盤は撃破リターンを段階強化し、ハイリスク行動の旨味を維持する
    if (cartYen >= 70000) return 2000;
    if (cartYen >= 45000) return 1500;
    return 1000;
  }

  private playSnatcherDefeatEffect(hz: Phaser.GameObjects.Image): void {
    hz.setData("isDefeated", true);
    hz.setData("isSnatcherJumping", false);
    this.tweens.killTweensOf(hz);
    hz.setTexture("obstacle-snatcher-defeat");
    const body = (hz as Phaser.GameObjects.Image & {
      body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;
    }).body;
    if (body) body.enable = false;

    // スローに抜けるよう本体を少し長めに残し、残像を重ねる
    const spawnAfterImage = (delayMs: number, alpha: number): void => {
      this.time.delayedCall(delayMs, () => {
        if (!hz.active) return;
        const ghost = this.add
          .image(hz.x, hz.y, "obstacle-snatcher-defeat")
          .setDisplaySize(hz.displayWidth, hz.displayHeight)
          .setAlpha(alpha)
          .setDepth(8);
        this.tweens.add({
          targets: ghost,
          x: ghost.x + 36,
          y: ghost.y - 10,
          alpha: 0,
          duration: 280,
          ease: "Quad.Out",
          onComplete: () => ghost.destroy(),
        });
      });
    };
    spawnAfterImage(40, 0.42);
    spawnAfterImage(95, 0.3);
    spawnAfterImage(150, 0.22);

    this.tweens.add({
      targets: hz,
      x: hz.x + 44,
      y: hz.y - 14,
      alpha: 0,
      duration: 380,
      ease: "Cubic.Out",
      onComplete: () => {
        if (hz.active) hz.destroy();
      },
    });
  }

  private updateAttackFlameAndHits(now: number): void {
    if (now > this.mode.attackUntil) {
      this.attackFlame.setVisible(false);
      return;
    }

    // 口元に炎素材を追従表示する
    const mouthX = this.player.x + 23;
    const mouthY = this.player.y - 75;
    this.attackFlame
      .setPosition(mouthX + 45, mouthY)
      .setDisplaySize(GameScene.FLAME_DISPLAY_W, GameScene.FLAME_DISPLAY_H)
      .setVisible(true);

    // 真下への巻き込みを減らすため、判定を前方寄り＆やや上方向に寄せる
    const isFalling = this.player.body.velocity.y > 120;
    const flameHitboxX = mouthX + 10;
    const flameHitboxY = mouthY - 20;
    const flameHitboxWidth = GameScene.FLAME_DISPLAY_W + 23;
    const flameHitboxHeight = isFalling
      ? GameScene.FLAME_DISPLAY_H - 2
      : GameScene.FLAME_DISPLAY_H + 8;
    const flameRect = new Phaser.Geom.Rectangle(
      flameHitboxX,
      flameHitboxY,
      flameHitboxWidth,
      flameHitboxHeight,
    );
    const hitHazards: Phaser.GameObjects.Image[] = [];
    const hitDestructibles: Phaser.GameObjects.Image[] = [];

    // 走査中に destroy しないようスナップショットで判定する
    const hazardChildren = this.hazards.getChildren() as Phaser.GameObjects.Image[];
    for (const obj of hazardChildren) {
      if (!obj || !obj.active) continue;
      const hz = obj as Phaser.GameObjects.Image & { body?: Phaser.Physics.Arcade.Body };
      if (hz.getData("isDefeated")) continue;
      const body = hz.body;
      if (!body) continue;
      if (!body.enable) continue;
      if (!this.isRectOverlappingBody(flameRect, body)) continue;
      hitHazards.push(hz);
    }

    const destructibleChildren = this.destructibles.getChildren() as Phaser.GameObjects.Image[];
    for (const obj of destructibleChildren) {
      if (!obj || !obj.active) continue;
      const dst = obj as Phaser.GameObjects.Image & { body?: Phaser.Physics.Arcade.Body };
      const body = dst.body;
      if (!body) continue;
      if (!this.isRectOverlappingBody(flameRect, body)) continue;
      hitDestructibles.push(dst);
    }

    let defeatedSnatcher = false;
    let otherFlameHazard = false;
    for (const hz of hitHazards) {
      if (!hz.active) continue;
      const kind = hz.getData("kind") as "shoplifter" | "biker" | undefined;
      if (kind === "shoplifter") {
        this.spawnAttackHitEffect(hz.x, hz.y, "destructible");
        const bonusYen = this.snatcherDefeatBonusByYen(this.run.cartYen);
        this.run.cartYen += bonusYen;
        this.run.receiptLines.push({
          name: "（ひったくり撃退ボーナス）",
          yen: bonusYen,
        });
        this.spawnYenPopup(hz.x, hz.y - 22, bonusYen);
        // ひったくりは撃破差分を一瞬表示してから消し、視認性を上げる
        this.playSnatcherDefeatEffect(hz);
        defeatedSnatcher = true;
        continue;
      }
      this.spawnAttackHitEffect(hz.x, hz.y, "hazard");
      hz.destroy();
      otherFlameHazard = true;
    }

    if (defeatedSnatcher) {
      sfxSnatcherDefeat();
    }
    if (otherFlameHazard || hitDestructibles.length > 0) {
      sfxAttackHit();
    }

    for (const dst of hitDestructibles) {
      if (!dst.active) continue;
      const dropX = dst.x;
      const dropY = dst.y - 40;
      this.spawnAttackHitEffect(dst.x, dst.y, "hazard");
      dst.destroy();
      sfxBreak();
      if (Math.random() < GameScene.DESTRUCTIBLE_DROP_CHANCE) {
        spawnPickupItem(this, this.items, dropX, dropY, randomItemId());
      }
    }
  }

  private isRectOverlappingBody(
    rect: Phaser.Geom.Rectangle,
    body: Phaser.Physics.Arcade.Body,
  ): boolean {
    const bodyLeft = body.x;
    const bodyTop = body.y;
    const bodyRight = body.x + body.width;
    const bodyBottom = body.y + body.height;
    return !(
      rect.right < bodyLeft ||
      rect.x > bodyRight ||
      rect.bottom < bodyTop ||
      rect.y > bodyBottom
    );
  }

  private pickAttackFlameTextureKey(): string {
    const loaded = GameScene.ATTACK_FLAME_TEXTURE_KEYS.filter((key) =>
      this.textures.exists(key),
    );
    if (loaded.length === 0) return "player-attack-flame";
    return Phaser.Utils.Array.GetRandom([...loaded]);
  }

  private spawnItemPickupEffect(x: number, y: number): void {
    const loaded = GameScene.ITEM_PICKUP_EFFECT_TEXTURE_KEYS.filter((key) =>
      this.textures.exists(key),
    );
    if (loaded.length === 0) return;
    const key = Phaser.Utils.Array.GetRandom([...loaded]);
    const effect = this.add.image(x, y, key).setDepth(13).setAlpha(1);
    effect.setDisplaySize(9, 9);
    this.tweens.add({
      targets: effect,
      y: y - 16,
      alpha: 0,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 240,
      ease: "Quad.Out",
      onComplete: () => effect.destroy(),
    });
  }

  private spawnAttackHitEffect(
    x: number,
    y: number,
    kind: "hazard" | "destructible",
  ): void {
    const key =
      kind === "destructible" ? "hit-effect-destructible-1" : "hit-effect-hazard-1";
    if (!this.textures.exists(key)) return;
    const effect = this.add.image(x, y, key).setDepth(13).setAlpha(0.96);
    effect.setDisplaySize(9, 9);
    this.tweens.add({
      targets: effect,
      alpha: 0,
      scaleX: 1.34,
      scaleY: 1.34,
      duration: 180,
      ease: "Quad.Out",
      onComplete: () => effect.destroy(),
    });
    // ヒット感は少しだけ残す
    this.cameras.main.shake(70, 0.0012, true);
  }

  private spawnYenPopup(
    x: number,
    y: number,
    yen: number,
    options?: {
      followPlayer?: boolean;
      isLoss?: boolean;
    },
  ): void {
    const followPlayer = options?.followPlayer ?? false;
    const isLoss = options?.isLoss ?? false;
    const sign = isLoss ? "-" : "+";
    const textColor = isLoss ? "#3b82f6" : "#ff2f43";
    const popup = this.add
      .text(x, y, `${sign}${yen.toLocaleString("ja-JP")}`, {
        fontSize: "22px",
        color: textColor,
        fontStyle: "bold",
        stroke: "#ffffff",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(120);
    const anim = { rise: 0, alpha: 1 };
    this.tweens.add({
      targets: anim,
      rise: 72,
      alpha: 0,
      duration: 980,
      ease: "Cubic.Out",
      onUpdate: () => {
        const anchorX = followPlayer ? this.player.x : x;
        const anchorY = followPlayer ? this.player.y - 73 : y;
        popup.setPosition(anchorX, anchorY - anim.rise);
        popup.setAlpha(anim.alpha);
      },
      onComplete: () => popup.destroy(),
    });
  }

  private createPauseButton(): void {
    const buttonX = GAME_WIDTH - 78;
    const buttonY = 34;
    this.pauseButtonShadow = this.add
      .rectangle(buttonX + 2, buttonY + 2, 104, 34, 0x000000, 0.25)
      .setScrollFactor(0)
      .setDepth(139);
    this.pauseButtonBg = this.add
      .rectangle(buttonX, buttonY, 104, 34, 0x1f2937, 0.86)
      .setScrollFactor(0)
      .setDepth(140)
      .setStrokeStyle(2, 0xfde68a, 0.95)
      .setInteractive({ useHandCursor: true });
    this.pauseButtonText = this.add
      .text(buttonX, buttonY, "⏸ 一時停止", {
        fontSize: "16px",
        color: "#f9fafb",
        fontFamily: GameScene.HUD_FONT_FAMILY,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(141);
    this.pauseButtonBg.on("pointerover", () => {
      if (this.isGameplayPaused) return;
      this.pauseButtonBg.setFillStyle(0x374151, 0.95);
      this.pauseButtonText.setScale(1.04);
      this.pauseButtonShadow.setAlpha(0.32);
    });
    this.pauseButtonBg.on("pointerout", () => {
      if (this.isGameplayPaused) return;
      this.pauseButtonBg.setFillStyle(0x1f2937, 0.86);
      this.pauseButtonText.setScale(1);
      this.pauseButtonShadow.setAlpha(0.25);
    });
    this.pauseButtonBg.on("pointerdown", () => {
      this.pauseButtonBg.setFillStyle(0x111827, 0.98);
      this.pauseButtonText.setScale(0.98);
      this.pauseButtonShadow.setAlpha(0.38);
    });
    this.pauseButtonBg.on("pointerup", () => {
      this.togglePause();
    });
  }

  private createPauseOverlay(): void {
    this.pauseOverlayBg = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62)
      .setScrollFactor(0)
      .setDepth(180)
      .setVisible(false);
    this.pauseOverlayPanel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, Math.min(GAME_WIDTH * 0.8, 360), 176, 0x111827, 0.92)
      .setScrollFactor(0)
      .setDepth(181)
      .setStrokeStyle(3, 0xfde68a, 0.95)
      .setVisible(false);
    this.pauseOverlayTitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 34, "一時停止中", {
        fontSize: "38px",
        color: "#fef3c7",
        fontFamily: GameScene.HUD_FONT_FAMILY,
        stroke: "#7c2d12",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(182)
      .setVisible(false);
    this.pauseOverlayHint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, "右上のボタンで再開", {
        fontSize: "22px",
        color: "#e5e7eb",
        fontFamily: GameScene.HUD_FONT_FAMILY,
        stroke: "#0f172a",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(182)
      .setVisible(false);
  }

  private setPauseOverlayVisible(visible: boolean): void {
    this.pauseOverlayBg.setVisible(visible);
    this.pauseOverlayPanel.setVisible(visible);
    this.pauseOverlayTitle.setVisible(visible);
    this.pauseOverlayHint.setVisible(visible);
  }

  private togglePause(): void {
    this.isGameplayPaused = !this.isGameplayPaused;
    if (this.isGameplayPaused) {
      this.pausedAtMs = performance.now();
      this.physics.pause();
      this.pauseButtonText.setText("▶ 再開");
      this.pauseButtonBg.setFillStyle(0x0f766e, 0.94);
      this.pauseButtonShadow.setAlpha(0.4);
      this.pauseButtonText.setScale(1);
      this.setPauseOverlayVisible(true);
      return;
    }
    if (this.pausedAtMs !== null) {
      // 一時停止中に進んだ実時間ぶんを開始時刻へ加算し、経過時間表示を止める
      this.run.startMs += performance.now() - this.pausedAtMs;
      this.pausedAtMs = null;
    }
    this.physics.resume();
    this.pauseButtonText.setText("⏸ 一時停止");
    this.pauseButtonBg.setFillStyle(0x1f2937, 0.86);
    this.pauseButtonShadow.setAlpha(0.25);
    this.pauseButtonText.setScale(1);
    this.setPauseOverlayVisible(false);
  }

  private createComboUi(): void {
    const rightX = GAME_WIDTH - 18;
    this.comboTitle = this.add
      .text(rightX, 72, "COMBO", {
        fontSize: "24px",
        color: "#fef08a",
        fontStyle: "bold",
        fontFamily: '"Arial Black", "Trebuchet MS", sans-serif',
        stroke: "#7c2d12",
        strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(130);
    this.comboCountText = this.add
      .text(rightX, 100, "0", {
        fontSize: "48px",
        color: "#ffffff",
        fontStyle: "bold",
        fontFamily: '"Arial Black", "Trebuchet MS", sans-serif',
        stroke: "#0f172a",
        strokeThickness: 6,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(130);
    this.comboMultText = this.add
      .text(rightX, 150, "x1.0", {
        fontSize: "28px",
        color: "#86efac",
        fontStyle: "bold",
        fontFamily: '"Arial Black", "Trebuchet MS", sans-serif',
        stroke: "#14532d",
        strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(130);
  }

  private updateComboUi(): void {
    this.comboTitle.setAlpha(this.run.comboCount > 0 ? 1 : 0.88);
    this.comboCountText.setText(`${this.run.comboCount}`);
    this.comboMultText.setText(`x${this.run.lastComboMult.toFixed(1)}`);

    const comboTier = Math.floor(this.run.comboCount / 10);
    if (this.run.comboCount < 10) {
      this.lastCelebratedComboTier = 0;
      return;
    }
    if (comboTier <= this.lastCelebratedComboTier) return;
    this.lastCelebratedComboTier = comboTier;
    this.playComboTierEffect(comboTier);
  }

  private playComboTierEffect(comboTier: number): void {
    const burst = this.add
      .text(GAME_WIDTH - 16, 206, `${comboTier * 10} COMBO!`, {
        fontSize: "32px",
        color: "#f472b6",
        fontStyle: "bold",
        fontFamily: '"Arial Black", "Trebuchet MS", sans-serif',
        stroke: "#831843",
        strokeThickness: 6,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(135)
      // 初動を抑えてからゆっくり弾けるようにする（スローモーション感）
      .setScale(0.88);
    this.tweens.chain({
      targets: burst,
      tweens: [
        {
          scale: 1.08,
          duration: 520,
          ease: "Sine.Out",
        },
        {
          scale: 1.42,
          alpha: 0,
          y: burst.y - 40,
          duration: 980,
          ease: "Cubic.InOut",
        },
      ],
      onComplete: () => burst.destroy(),
    });
  }

  private startLoopBgm(): void {
    const save = loadSave();
    const bgmVolume = save.muted ? 0 : save.bgmVolume;
    // シーン再開時の多重再生を防ぎ、常に現在設定の音量で1トラックだけ鳴らす
    const existing = this.sound.get("bgm-main");
    if (existing) existing.destroy();
    this.bgm = this.sound.add("bgm-main", {
      loop: true,
      volume: bgmVolume,
    });
    this.bgm.play();

    // シーン離脱時に確実に停止して、次回開始を安定させる
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopLoopBgm());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopLoopBgm());
  }

  private stopLoopBgm(): void {
    if (!this.bgm) return;
    if (this.bgm.isPlaying) this.bgm.stop();
    this.bgm.destroy();
    this.bgm = undefined;
  }
}
