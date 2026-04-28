import Phaser from "phaser";
import { GAME_WIDTH, GROUND_Y } from "../game/game-config";
import { MID_TILE_SCALE } from "./game-scene-background";

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
  prevScrollX: number | null;
  scrollCompensationX: number;
  isMaxSpeedLayout: boolean;
  lastOutOfRangeAtBySlot: Map<number, number>;
  lastDespawnAtBySlot: Map<number, number>;
};

const WAVE_KEYS = ["staff-wave-1", "staff-wave-2", "staff-wave-3", "staff-wave-2"] as const;
// 中景テクスチャ上の基準 X（1 周分のパターンに対するアンカー。実際のドアオブジェクトとは無関係）
const STAFF_PATTERN_ANCHOR_TEX_X = 1090;
// スロットごとの横オフセット（店舗間バリエーション）
// 要望: 0, 100, 160, 225, 295... のように
// 基本+60に対して +5, +10, +15... と段階的に増やす
const STAFF_TWEAK_FIRST = -1090;
const STAFF_TWEAK_SECOND = -830;
const STAFF_TWEAK_STEP_BASE = 1500;
const STAFF_TWEAK_STEP_GROW = 30;
const STAFF_TWEAK_STEP_MAX_SPEED = 80;
const STAFF_MAX_SPEED_LAYOUT_ON = 332;
const STAFF_MAX_SPEED_LAYOUT_OFF = 326;
const STAFF_DESPAWN_GRACE_MS = 220;
const STAFF_RESPAWN_COOLDOWN_MS = 500;
// アンカーに対する表示用の微調整（px）
const STAFF_X_OFFSET = -14;
const STAFF_Y = GROUND_Y - 2;
const STAFF_DISPLAY_W = 61;
const STAFF_DISPLAY_H = 145;
const STAFF_DEPTH = -5;
// ワールド座標。中景は scrollFactor(0) で tile が 0.46× 速、カメラはプレイヤーに追従するため、アンカーに scrollX を足して画面上の位置をタイルと同期させる
const STAFF_SCROLL_FACTOR = 1;
// カメラ追従由来の残留ドリフトを、scrollX のフレーム差分で打ち消す
const STAFF_SCROLL_DELTA_COMPENSATION = 0.05;
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
    prevScrollX: null,
    scrollCompensationX: 0,
    isMaxSpeedLayout: false,
    lastOutOfRangeAtBySlot: new Map<number, number>(),
    lastDespawnAtBySlot: new Map<number, number>(),
  };
}

export function updateStaffSystem(
  scene: Phaser.Scene,
  bgMid: Phaser.GameObjects.TileSprite,
  state: StaffSystemState,
  playerX: number,
  scrollX: number,
  now: number,
  scrollSpeed: number,
): void {
  const metrics = calcMidStaffMetrics(scene, bgMid);
  if (!metrics) return;
  if (state.isMaxSpeedLayout) {
    if (scrollSpeed <= STAFF_MAX_SPEED_LAYOUT_OFF) {
      state.isMaxSpeedLayout = false;
    }
  } else if (scrollSpeed >= STAFF_MAX_SPEED_LAYOUT_ON) {
    state.isMaxSpeedLayout = true;
  }
  const isAtMaxSpeed = state.isMaxSpeedLayout;
  const scrollDelta = state.prevScrollX === null ? 0 : scrollX - state.prevScrollX;
  state.prevScrollX = scrollX;
  state.scrollCompensationX += scrollDelta * STAFF_SCROLL_DELTA_COMPENSATION;

  ensureVisibleStaffActors(scene, state, metrics, scrollX, now, isAtMaxSpeed);

  const kept: StaffActor[] = [];
  for (const actor of state.actors) {
    if (!actor.sprite.active) continue;
    const anchorWorldX = worldStaffAnchorX(
      metrics,
      actor.slot,
      isAtMaxSpeed,
      scrollX,
      state.scrollCompensationX,
    );
    if (anchorWorldX < scrollX - 360) {
      const outSince = state.lastOutOfRangeAtBySlot.get(actor.slot) ?? now;
      state.lastOutOfRangeAtBySlot.set(actor.slot, outSince);
      if (now - outSince < STAFF_DESPAWN_GRACE_MS) {
        kept.push(actor);
        continue;
      }
      state.lastOutOfRangeAtBySlot.delete(actor.slot);
      state.lastDespawnAtBySlot.set(actor.slot, now);
      actor.bubble?.destroy(true);
      actor.sprite.destroy();
      continue;
    }
    state.lastOutOfRangeAtBySlot.delete(actor.slot);

    tryTriggerWaveOnEnter(state, actor, scrollX, now, anchorWorldX);
    tryTriggerPassMotion(state, actor, playerX, now, anchorWorldX);
    updateStaffMotion(actor, now);
    actor.sprite.setX(anchorWorldX);
    syncBubbleToActor(actor);
    tryTriggerWelcome(scene, state, actor, playerX, now, anchorWorldX);
    kept.push(actor);
  }
  state.actors = kept;
}

type MidStaffMetrics = {
  patternWidth: number;
  offsetX: number;
  tilePositionX: number;
};

/** 現在中景スプライトのテクスチャ・tilePosition と同期したアンカー指標 */
function calcMidStaffMetrics(
  scene: Phaser.Scene,
  bgMid: Phaser.GameObjects.TileSprite,
): MidStaffMetrics | null {
  const texKey = bgMid.texture.key;
  const src = scene.textures.get(texKey).getSourceImage() as {
    width?: number;
  };
  if (!src?.width) return null;
  const patternWidth = src.width * bgMid.tileScaleX;
  const offsetX = STAFF_PATTERN_ANCHOR_TEX_X * MID_TILE_SCALE;
  return {
    patternWidth,
    offsetX,
    tilePositionX: bgMid.tilePositionX,
  };
}

/**
 * 中景タイル（SF=0）上のパターンと画面上で一致させるためのワールド X。
 * タイルのみ −tilePositionX だとカメラ移動分と合成したときに 0.46 と 1.0 の差で滑るため +scrollX を加える。
 */
function worldStaffAnchorX(
  metrics: MidStaffMetrics,
  slot: number,
  isAtMaxSpeed: boolean,
  scrollX: number,
  scrollCompensationX: number,
): number {
  return Math.round(
    metrics.offsetX +
      slot * metrics.patternWidth -
      metrics.tilePositionX +
      scrollX +
      scrollCompensationX +
      STAFF_X_OFFSET +
      slotTweakX(slot, isAtMaxSpeed),
  );
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

function ensureVisibleStaffActors(
  scene: Phaser.Scene,
  state: StaffSystemState,
  metrics: MidStaffMetrics,
  scrollX: number,
  now: number,
  isAtMaxSpeed: boolean,
): void {
  const left = scrollX - 120;
  const right = scrollX + GAME_WIDTH * 2.3;
  const minSlot =
    Math.floor((left + metrics.tilePositionX - metrics.offsetX) / metrics.patternWidth) -
    1;
  const maxSlot =
    Math.ceil((right + metrics.tilePositionX - metrics.offsetX) / metrics.patternWidth) +
    1;

  // 以前は「画面内だけ spawn」＋「3 スロットに 1 人」で初期位置が縛られ、オフセット調整が見えにくかったため撤廃。min〜max の全スロットで生成する。
  for (let slot = minSlot; slot <= maxSlot; slot += 1) {
    const lastDespawnAt = state.lastDespawnAtBySlot.get(slot);
    if (
      lastDespawnAt !== undefined &&
      now - lastDespawnAt < STAFF_RESPAWN_COOLDOWN_MS
    ) {
      continue;
    }
    const worldX = worldStaffAnchorX(
      metrics,
      slot,
      isAtMaxSpeed,
      scrollX,
      state.scrollCompensationX,
    );
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
  anchorWorldX: number,
): void {
  if (actor.hasPlayedPassMotion) return;
  if (playerX < anchorWorldX + 16) return;
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
  scrollX: number,
  now: number,
  anchorWorldX: number,
): void {
  if (actor.hasCheckedEntryWave) return;
  const rightEdge = scrollX + GAME_WIDTH;
  const leftEdge = scrollX - 40;
  if (anchorWorldX > rightEdge - 8) return;
  if (anchorWorldX < leftEdge) return;
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
  anchorWorldX: number,
): void {
  if (actor.hasWelcomed) return;
  if (playerX < anchorWorldX + 16) return;
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
      padding: { top: 3, bottom: 1 },
    })
    .setOrigin(0.5, 0.5);
  // プレイヤー最前面を維持するため、吹き出しはプレイヤーより後ろに置く
  const bubble = scene.add.container(x, y, [panel, tail, label]).setDepth(9).setAlpha(0);
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
