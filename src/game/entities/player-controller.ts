import Phaser from "phaser";
import {
  COMBO_TIMEOUT_MS,
  INVINCIBLE_MS,
  PLAYER_GROUND_OFFSET_Y,
  PLAYER_HITBOX_H,
  PLAYER_HITBOX_W,
  PLAYER_SLIDE_GROUND_OFFSET_Y,
  SLIDE_HITBOX_H,
} from "../game-config";

// 姿勢ごとに表示サイズを切り替え、足元基準で地面に合わせる
const PLAYER_NORMAL_DISPLAY_W = 96;
const PLAYER_NORMAL_DISPLAY_H = 96;
const PLAYER_SLIDE_DISPLAY_W = 140;
const PLAYER_SLIDE_DISPLAY_H = 68;
const PLAYER_NORMAL_ORIGIN_Y = 1.18;
const PLAYER_JUMP_ORIGIN_Y = 1.22;
const PLAYER_SLIDE_ORIGIN_Y = 1.65;
const PLAYER_ATTACK_ORIGIN_Y = 1.18;
const JUMP_INPUT_COOLDOWN_MS = 120;
const ATTACK_COOLDOWN_MS = 2000;
const RAINBOW_CYCLE_MS = 220;

export type PlayerMode = {
  hp: number;
  invUntil: number;
  damageInvUntil: number;
  drinkInvUntil: number;
  jumpsUsed: number;
  lastJumpAt: number;
  isSliding: boolean;
  slideUntil: number;
  attackUntil: number;
  lastAttackAt: number;
  lastStealAt: number;
};

export function createPlayerMode(): PlayerMode {
  return {
    hp: 3,
    invUntil: 0,
    damageInvUntil: 0,
    drinkInvUntil: 0,
    jumpsUsed: 0,
    lastJumpAt: -9999,
    isSliding: false,
    slideUntil: 0,
    attackUntil: 0,
    lastAttackAt: -9999,
    lastStealAt: 0,
  };
}

export function applyDamage(
  mode: PlayerMode,
  now: number,
): boolean {
  if (now < mode.invUntil) return false;
  mode.hp -= 1;
  mode.invUntil = now + INVINCIBLE_MS;
  mode.damageInvUntil = now + INVINCIBLE_MS;
  return true;
}

export function grantEnergyDrinkInvincibility(
  mode: PlayerMode,
  now: number,
): void {
  const drinkUntil = now + 2000;
  mode.drinkInvUntil = Math.max(mode.drinkInvUntil, drinkUntil);
  mode.invUntil = Math.max(mode.invUntil, mode.drinkInvUntil);
}

export function applyInvincibilityVisual(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  mode: PlayerMode,
  now: number,
): void {
  if (now >= mode.invUntil) {
    sprite.clearTint();
    sprite.setAlpha(1);
    return;
  }

  if (now < mode.drinkInvUntil) {
    // 栄養ドリンク無敵は淡い虹色で点滅させる
    const phase = (now % RAINBOW_CYCLE_MS) / RAINBOW_CYCLE_MS;
    const r = Math.floor(205 + 50 * Math.sin(phase * Math.PI * 2));
    const g = Math.floor(
      205 + 50 * Math.sin(phase * Math.PI * 2 + (2 * Math.PI) / 3),
    );
    const b = Math.floor(
      205 + 50 * Math.sin(phase * Math.PI * 2 + (4 * Math.PI) / 3),
    );
    sprite.setAlpha(1);
    sprite.setTint(Phaser.Display.Color.GetColor(r, g, b));
    return;
  }

  if (now < mode.damageInvUntil) {
    // 被弾時の無敵は透明点滅で演出する
    const blink = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin((now / 85) * Math.PI * 2));
    sprite.clearTint();
    sprite.setAlpha(blink);
    return;
  }

  sprite.clearTint();
  sprite.setAlpha(1);
}

export function updatePlayerPhysics(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  mode: PlayerMode,
  scrollSpeed: number,
  now: number,
): void {
  const body = sprite.body;
  body.setVelocityX(scrollSpeed);

  const onGround = body.onFloor();
  // 上昇中の瞬間接地でジャンプ回数が誤って回復しないよう、下降時のみリセットする
  if (onGround && body.velocity.y >= -10) mode.jumpsUsed = 0;

  if (mode.slideUntil > 0 && now > mode.slideUntil) {
    mode.isSliding = false;
    mode.slideUntil = 0;
    applyNormalHitbox(sprite);
  }

  if (mode.attackUntil > 0 && now > mode.attackUntil) {
    mode.attackUntil = 0;
  }
}

export function tryJump(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  mode: PlayerMode,
  now: number,
): void {
  if (now - mode.lastJumpAt < JUMP_INPUT_COOLDOWN_MS) return;
  const body = sprite.body;
  const onGround = body.onFloor() && body.velocity.y >= -10;
  if (onGround) {
    body.setVelocityY(-500);
    mode.jumpsUsed = 1;
    mode.lastJumpAt = now;
    return;
  }
  if (mode.jumpsUsed >= 2) return;
  if (mode.jumpsUsed < 2) {
    body.setVelocityY(-480);
    mode.jumpsUsed += 1;
    mode.lastJumpAt = now;
  }
}

export function trySlide(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  mode: PlayerMode,
  now: number,
): void {
  const body = sprite.body;
  const onGround = body.onFloor();
  if (!onGround) return;
  mode.isSliding = true;
  mode.slideUntil = now + 450;
  applySlideHitbox(sprite);
}

// テクスチャ座標で指定するため、表示サイズとスケールを考慮して body を合わせる
function applyScaledHitbox(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  displayW: number,
  displayH: number,
  hitboxW: number,
  hitboxH: number,
  groundOffsetY: number,
  originY: number,
): void {
  // 見た目の接地位置は originY で調整する
  sprite.setOrigin(0.5, originY);
  sprite.setDisplaySize(displayW, displayH);

  const scaleX = sprite.scaleX;
  const scaleY = sprite.scaleY;
  const body = sprite.body;

  // body サイズは表示ピクセル基準で与え、テクスチャ座標に逆算する
  const bodyWidthTex = hitboxW / scaleX;
  const bodyHeightTex = hitboxH / scaleY;
  body.setSize(bodyWidthTex, bodyHeightTex);

  // origin.y = 1 の足元基準で、body の下端が「見た目の下端 - groundOffsetY」になるよう合わせる
  const offsetXTex = (sprite.width - bodyWidthTex) / 2;
  const offsetYTex = (displayH - hitboxH + groundOffsetY) / scaleY;
  body.setOffset(offsetXTex, offsetYTex);
}

export function applyNormalHitbox(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
): void {
  applyScaledHitbox(
    sprite,
    PLAYER_NORMAL_DISPLAY_W,
    PLAYER_NORMAL_DISPLAY_H,
    PLAYER_HITBOX_W,
    PLAYER_HITBOX_H,
    PLAYER_GROUND_OFFSET_Y,
    PLAYER_NORMAL_ORIGIN_Y,
  );
}

export function applySlideHitbox(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
): void {
  applyScaledHitbox(
    sprite,
    PLAYER_SLIDE_DISPLAY_W,
    PLAYER_SLIDE_DISPLAY_H,
    PLAYER_HITBOX_W,
    SLIDE_HITBOX_H,
    PLAYER_SLIDE_GROUND_OFFSET_Y,
    PLAYER_SLIDE_ORIGIN_Y,
  );
}

export function updatePlayerVisual(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  mode: PlayerMode,
): void {
  const body = sprite.body;
  const onGround = body.blocked.down || body.touching.down;
  const isAttacking = mode.attackUntil > performance.now();

  if (isAttacking) {
    // 攻撃差分は通常立ち姿勢に近いため、通常原点を使って足元を安定させる
    sprite.setOrigin(0.5, PLAYER_ATTACK_ORIGIN_Y);
    if (sprite.anims.currentAnim?.key !== "player-attack" || !sprite.anims.isPlaying) {
      sprite.play("player-attack", true);
    }
    return;
  }

  if (mode.isSliding) {
    sprite.anims.stop();
    // スライド画像は余白が大きいため、個別の原点で接地見た目を合わせる
    sprite.setOrigin(0.5, PLAYER_SLIDE_ORIGIN_Y);
    sprite.setTexture("player-slide");
    return;
  }

  if (!onGround) {
    sprite.anims.stop();
    // ジャンプ画像は縦長なので、通常より少し高めに表示原点を調整する
    sprite.setOrigin(0.5, PLAYER_JUMP_ORIGIN_Y);
    sprite.setTexture(body.velocity.y < -40 ? "player-jump-1" : "player-jump-2");
    return;
  }

  // 通常走行は基準原点へ戻し、足元の位置を安定させる
  sprite.setOrigin(0.5, PLAYER_NORMAL_ORIGIN_Y);

  if (sprite.anims.currentAnim?.key !== "player-run" || !sprite.anims.isPlaying) {
    sprite.play("player-run", true);
  }
}

export function tryAttack(mode: PlayerMode, now: number): boolean {
  if (now - mode.lastAttackAt < ATTACK_COOLDOWN_MS) return false;
  mode.lastAttackAt = now;
  // 入力体感を安定させるため、攻撃受付を少し長めに取る
  mode.attackUntil = now + 300;
  return true;
}

export function getAttackCooldownRemainingMs(
  mode: PlayerMode,
  now: number,
): number {
  const elapsedFromLastAttack = now - mode.lastAttackAt;
  return Math.max(0, ATTACK_COOLDOWN_MS - elapsedFromLastAttack);
}

export function isComboExpired(
  lastItemAt: number,
  now: number,
): boolean {
  if (lastItemAt === 0) return false;
  return now - lastItemAt > COMBO_TIMEOUT_MS;
}
