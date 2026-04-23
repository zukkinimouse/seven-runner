import Phaser from "phaser";
import { GAME_WIDTH, GROUND_Y } from "../game/game-config";

type StaffMode = "idle" | "wave-loop" | "check-once" | "cheer-once";

type StaffActor = {
  slot: number;
  sprite: Phaser.GameObjects.Image;
  mode: StaffMode;
  modeStartedAt: number;
  modeEndsAt: number;
  hasCheckedEntryWave: boolean;
  hasPlayedPassMotion: boolean;
  hasWelcomed: boolean;
  bubble?: Phaser.GameObjects.Container;
};

export type StaffSystemState = {
  actors: StaffActor[];
  nextGlobalSpeechAt: number;
  lastTriggeredMotion?: Exclude<StaffMode, "idle">;
};

const WAVE_KEYS = ["staff-wave-1", "staff-wave-2", "staff-wave-3", "staff-wave-2"] as const;
// 背景アンカー方式: bg-mid のタイル座標から店員位置を算出する
const BG_MID_TILE_SCALE_X = 0.9;
const DOOR_TEXTURE_X = 1090;
// 店舗ごとの微調整（px）
// 要望: 0, 100, 160, 225, 295... のように
// 基本+60に対して +5, +10, +15... と段階的に増やす
const STAFF_TWEAK_FIRST = 0;
const STAFF_TWEAK_SECOND = 100;
const STAFF_TWEAK_STEP_BASE = 60;
const STAFF_TWEAK_STEP_GROW = 5;
const STAFF_TWEAK_STEP_MAX_SPEED = 70;
// ドア左側に寄せるためのオフセット
const STAFF_X_OFFSET = -14;
const STAFF_Y = GROUND_Y - 2;
const STAFF_DISPLAY_W = 61;
const STAFF_DISPLAY_H = 145;
const STAFF_DEPTH = -5;
const STAFF_SCROLL_FACTOR = 0;
// 余白差による見た目ズレを吸収する表示補正（チアを基準に微調整）
// 縦横を個別調整できるよう X/Y を分離する
const STAFF_IDLE_SCALE_X = 1.0;
const STAFF_IDLE_SCALE_Y = 1.0;
const STAFF_WAVE_SCALE_X = 1.37;
const STAFF_WAVE_SCALE_Y = 1.0;
const STAFF_CHECK_SCALE_X = 1.21;
const STAFF_CHECK_SCALE_Y = 1.03;
const STAFF_CHEER_SCALE_X = 0.95;
const STAFF_CHEER_SCALE_Y = 1.0;
const STAFF_IDLE_Y_OFFSET = 0;
const STAFF_WAVE_Y_OFFSET = 0;
const STAFF_CHECK_Y_OFFSET = 4;
const STAFF_CHEER_Y_OFFSET = 0;
const BUBBLE_OFFSET_X = 25;
const BUBBLE_OFFSET_Y = -24;
const STAFF_LINES = [
  "いらっしゃいませ！",
  "夜は揚げ物が\nお得です！",
  "温かいコーヒー\nあります♪",
  "新商品\n入荷しました！",
  "お疲れさまです！",
] as const;

export function createStaffSystemState(): StaffSystemState {
  return {
    actors: [],
    nextGlobalSpeechAt: 0,
    lastTriggeredMotion: undefined,
  };
}

export function updateStaffSystem(
  scene: Phaser.Scene,
  bgMid: Phaser.GameObjects.TileSprite,
  state: StaffSystemState,
  playerX: number,
  now: number,
  isAtMaxSpeed: boolean,
): void {
  const metrics = calcDoorMetrics(scene, bgMid);
  if (!metrics) return;
  ensureVisibleDoorActors(scene, state, metrics, isAtMaxSpeed);

  const kept: StaffActor[] = [];
  for (const actor of state.actors) {
    if (!actor.sprite.active) continue;
    const worldX = Math.round(
      worldDoorX(metrics, actor.slot) +
        STAFF_X_OFFSET +
        slotTweakX(actor.slot, isAtMaxSpeed),
    );
    actor.sprite.setX(worldX);
    syncBubbleToActor(actor);
    if (worldX < -360) {
      actor.bubble?.destroy(true);
      actor.sprite.destroy();
      continue;
    }

    tryTriggerWaveOnEnter(state, actor, now);
    tryTriggerPassMotion(state, actor, playerX, now);
    updateStaffMotion(actor, now);
    tryTriggerWelcome(scene, state, actor, playerX, now);
    kept.push(actor);
  }
  state.actors = kept;
}

type DoorMetrics = {
  patternWidth: number;
  offsetX: number;
  tilePositionX: number;
};

function calcDoorMetrics(
  scene: Phaser.Scene,
  bgMid: Phaser.GameObjects.TileSprite,
): DoorMetrics | null {
  const src = scene.textures.get("bg-mid").getSourceImage() as {
    width?: number;
  };
  if (!src?.width) return null;
  const patternWidth = src.width * bgMid.tileScaleX;
  const offsetX = DOOR_TEXTURE_X * BG_MID_TILE_SCALE_X;
  return { patternWidth, offsetX, tilePositionX: bgMid.tilePositionX };
}

function worldDoorX(metrics: DoorMetrics, slot: number): number {
  return metrics.offsetX + slot * metrics.patternWidth - metrics.tilePositionX;
}

function slotTweakX(slot: number, isAtMaxSpeed: boolean): number {
  if (slot <= 0) return STAFF_TWEAK_FIRST;
  if (slot === 1) return STAFF_TWEAK_SECOND;
  if (isAtMaxSpeed) {
    return STAFF_TWEAK_SECOND + (slot - 1) * STAFF_TWEAK_STEP_MAX_SPEED;
  }
  let value = STAFF_TWEAK_SECOND;
  for (let i = 2; i <= slot; i += 1) {
    const step = STAFF_TWEAK_STEP_BASE + STAFF_TWEAK_STEP_GROW * (i - 1);
    value += step;
  }
  return value;
}

function ensureVisibleDoorActors(
  scene: Phaser.Scene,
  state: StaffSystemState,
  metrics: DoorMetrics,
  isAtMaxSpeed: boolean,
): void {
  const left = -120;
  const right = GAME_WIDTH * 2.3;
  const minSlot =
    Math.floor((left + metrics.tilePositionX - metrics.offsetX) / metrics.patternWidth) - 1;
  const maxSlot =
    Math.ceil((right + metrics.tilePositionX - metrics.offsetX) / metrics.patternWidth) + 1;

  for (let slot = minSlot; slot <= maxSlot; slot += 1) {
    const worldX = Math.round(
      worldDoorX(metrics, slot) +
        STAFF_X_OFFSET +
        slotTweakX(slot, isAtMaxSpeed),
    );
    if (worldX < left || worldX > right) continue;
    const exists = state.actors.some((actor) => actor.slot === slot && actor.sprite.active);
    if (exists) continue;
    const sprite = scene.add
      .image(worldX, STAFF_Y, "staff-wave-1")
      .setOrigin(0.5, 1)
      .setDisplaySize(STAFF_DISPLAY_W, STAFF_DISPLAY_H)
      .setScrollFactor(STAFF_SCROLL_FACTOR, STAFF_SCROLL_FACTOR)
      .setDepth(STAFF_DEPTH);
    state.actors.push({
      slot,
      sprite,
      mode: "idle",
      modeStartedAt: performance.now(),
      modeEndsAt: 0,
      hasCheckedEntryWave: false,
      hasPlayedPassMotion: false,
      hasWelcomed: false,
    });
  }
}

function syncBubbleToActor(actor: StaffActor): void {
  if (!actor.bubble) return;
  if (!actor.bubble.active) return;
  actor.bubble.setPosition(
    actor.sprite.x + BUBBLE_OFFSET_X,
    actor.sprite.y - actor.sprite.displayHeight + BUBBLE_OFFSET_Y,
  );
}

function updateStaffMotion(actor: StaffActor, now: number): void {
  if (actor.mode === "idle") {
    actor.sprite.setTexture("staff-idle");
    applyStaffDisplayAdjust(
      actor,
      STAFF_IDLE_SCALE_X,
      STAFF_IDLE_SCALE_Y,
      STAFF_IDLE_Y_OFFSET,
    );
    return;
  }

  if (actor.mode === "wave-loop") {
    const phase = Math.floor((now - actor.modeStartedAt) / 180);
    const key = WAVE_KEYS[((phase % WAVE_KEYS.length) + WAVE_KEYS.length) % WAVE_KEYS.length];
    actor.sprite.setTexture(key);
    applyStaffDisplayAdjust(
      actor,
      STAFF_WAVE_SCALE_X,
      STAFF_WAVE_SCALE_Y,
      STAFF_WAVE_Y_OFFSET,
    );
    return;
  }

  const oneShotKey = actor.mode === "check-once" ? "staff-check" : "staff-cheer";
  if (now < actor.modeStartedAt + 420) {
    actor.sprite.setTexture(oneShotKey);
    if (actor.mode === "check-once") {
      applyStaffDisplayAdjust(
        actor,
        STAFF_CHECK_SCALE_X,
        STAFF_CHECK_SCALE_Y,
        STAFF_CHECK_Y_OFFSET,
      );
    } else {
      applyStaffDisplayAdjust(
        actor,
        STAFF_CHEER_SCALE_X,
        STAFF_CHEER_SCALE_Y,
        STAFF_CHEER_Y_OFFSET,
      );
    }
    return;
  }
  if (now < actor.modeEndsAt) {
    actor.sprite.setTexture("staff-idle");
    applyStaffDisplayAdjust(
      actor,
      STAFF_IDLE_SCALE_X,
      STAFF_IDLE_SCALE_Y,
      STAFF_IDLE_Y_OFFSET,
    );
    return;
  }

  actor.mode = "idle";
  actor.modeStartedAt = now;
  actor.modeEndsAt = 0;
}

function applyStaffDisplayAdjust(
  actor: StaffActor,
  scaleX: number,
  scaleY: number,
  yOffset: number,
): void {
  actor.sprite.setDisplaySize(
    STAFF_DISPLAY_W * scaleX,
    STAFF_DISPLAY_H * scaleY,
  );
  actor.sprite.setY(STAFF_Y + yOffset);
}

function tryTriggerPassMotion(
  state: StaffSystemState,
  actor: StaffActor,
  playerX: number,
  now: number,
): void {
  if (actor.hasPlayedPassMotion) return;
  if (playerX < actor.sprite.x + 16) return;
  actor.hasPlayedPassMotion = true;
  // Wave は画面内に入った瞬間のみ発火させるため、通過時は check/cheer のみ抽選
  actor.mode = pickNonConsecutiveMotion(state, ["check-once", "cheer-once"]);
  actor.modeStartedAt = now;
  actor.modeEndsAt = actor.mode === "wave-loop" ? 0 : now + 900;
  state.lastTriggeredMotion = actor.mode;
}

function tryTriggerWaveOnEnter(
  state: StaffSystemState,
  actor: StaffActor,
  now: number,
): void {
  if (actor.hasCheckedEntryWave) return;
  const rightEdge = GAME_WIDTH;
  const leftEdge = -40;
  if (actor.sprite.x > rightEdge - 8) return;
  if (actor.sprite.x < leftEdge) return;
  actor.hasCheckedEntryWave = true;

  // 連続で同じモーションにならないよう、直前が wave なら今回は見送る
  if (state.lastTriggeredMotion === "wave-loop") return;

  actor.hasPlayedPassMotion = true;
  actor.mode = "wave-loop";
  actor.modeStartedAt = now;
  actor.modeEndsAt = 0;
  state.lastTriggeredMotion = actor.mode;
}

function tryTriggerWelcome(
  scene: Phaser.Scene,
  state: StaffSystemState,
  actor: StaffActor,
  playerX: number,
  now: number,
): void {
  if (actor.hasWelcomed) return;
  if (playerX < actor.sprite.x + 16) return;
  if (now < state.nextGlobalSpeechAt) return;

  actor.hasWelcomed = true;
  state.nextGlobalSpeechAt = now + Phaser.Math.Between(2200, 3200);
  if (actor.mode === "idle") {
    actor.mode = pickNonConsecutiveMotion(state, ["check-once", "cheer-once"]);
    actor.modeStartedAt = now;
    actor.modeEndsAt = now + 900;
    state.lastTriggeredMotion = actor.mode;
  }
  actor.bubble?.destroy(true);
  actor.bubble = createSpeechBubble(
    scene,
    actor.sprite.x + BUBBLE_OFFSET_X,
    actor.sprite.y - actor.sprite.displayHeight + BUBBLE_OFFSET_Y,
    Phaser.Utils.Array.GetRandom([...STAFF_LINES]),
  );
}

function createSpeechBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textValue: string,
): Phaser.GameObjects.Container {
  const panelW = 166;
  const panelH = 58;
  const panel = scene.add
    .rectangle(0, 0, panelW, panelH, 0xffffff, 0.97)
    .setStrokeStyle(2, 0x111827, 0.95);
  panel.setRounded?.(12);
  const tail = scene.add
    .triangle(0, panelH / 2 + 7, 0, 0, 16, 0, 8, 12, 0xffffff, 0.97)
    .setStrokeStyle(2, 0x111827, 0.95);
  const label = scene.add
    .text(0, -1, textValue, {
      fontSize: "16px",
      color: "#111827",
      align: "center",
      fontStyle: "bold",
    })
    .setOrigin(0.5, 0.5);
  const bubble = scene.add.container(x, y, [panel, tail, label]).setDepth(24).setAlpha(0);
  bubble.setScrollFactor(STAFF_SCROLL_FACTOR, STAFF_SCROLL_FACTOR);

  scene.tweens.chain({
    targets: bubble,
    tweens: [
      { alpha: 1, y: y - 6, duration: 120, ease: "Sine.Out" },
      { alpha: 1, y: y - 8, duration: 1150, ease: "Linear" },
      { alpha: 0, y: y - 18, duration: 180, ease: "Sine.In" },
    ],
    onComplete: () => bubble.destroy(),
  });
  return bubble;
}

function pickNonConsecutiveMotion(
  state: StaffSystemState,
  candidates: Exclude<StaffMode, "idle">[],
): Exclude<StaffMode, "idle"> {
  const last = state.lastTriggeredMotion;
  const filtered = candidates.filter((mode) => mode !== last);
  const pool = filtered.length > 0 ? filtered : candidates;
  return Phaser.Utils.Array.GetRandom(pool);
}
