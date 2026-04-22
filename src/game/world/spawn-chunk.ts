import Phaser from "phaser";
import { CHUNK_WIDTH, GROUND_Y } from "../game-config";
import { getItemTextureKey } from "../config/item-definitions";
import type { ChunkTemplate } from "../types";

export type SpawnedChunkHandle = {
  baseX: number;
  root: Phaser.GameObjects.Container;
};

function hazardTextureKey(kind: "shoplifter" | "biker"): string {
  if (kind === "biker") return "obstacle-cone";
  const variants = [
    "obstacle-snatcher-1",
    "obstacle-snatcher-2",
    "obstacle-snatcher-3",
  ] as const;
  return Phaser.Utils.Array.GetRandom(variants);
}

// 障害物を地面に接地させる基準値（必要ならここだけ調整）
const OBSTACLE_GROUND_OFFSET_Y = 0;
const ITEM_RANDOM_OFFSET_X = 50;
const ITEM_MIN_SPACING = 150;
const OBSTACLE_RANDOM_OFFSET_X = 60;
const OBSTACLE_MIN_SPACING = 260;
const ITEM_MIN_Y = 250;
const ITEM_MAX_Y = 430;
const BOX_GROUND_SINK_Y = 6;
const TRASH_GROUND_SINK_Y = 6;

function applyCenteredHitbox(
  sprite: Phaser.GameObjects.Image,
  body: Phaser.Physics.Arcade.Body,
  widthRatio: number,
  heightRatio: number,
): void {
  const hitboxWidth = sprite.displayWidth * widthRatio;
  const hitboxHeight = sprite.displayHeight * heightRatio;
  body.setSize(hitboxWidth, hitboxHeight, true);
}

function placeOnGround(sprite: Phaser.GameObjects.Image): void {
  sprite.y = GROUND_Y - sprite.displayHeight / 2 + OBSTACLE_GROUND_OFFSET_Y;
}

function applyItemDisplaySize(
  item: Phaser.GameObjects.Image,
  itemId: string,
  texKey: string,
  isPickup: boolean,
): void {
  if (texKey === "item-bento") {
    if (itemId === "bento_small") {
      item.setDisplaySize(isPickup ? 30 : 34, isPickup ? 30 : 34);
      return;
    }
    if (itemId === "bento_medium") {
      item.setDisplaySize(isPickup ? 42 : 46, isPickup ? 42 : 46);
      return;
    }
    if (itemId === "bento_large") {
      item.setDisplaySize(isPickup ? 54 : 58, isPickup ? 54 : 58);
      return;
    }
    // 未定義IDは中サイズとして扱って表示崩れを防ぐ
    item.setDisplaySize(isPickup ? 42 : 46, isPickup ? 42 : 46);
    return;
  }
  if (texKey === "item-onigiri") {
    // おにぎりは中・大の2段階で視覚的に差が出るようにする
    if (itemId === "onigiri_medium") {
      item.setDisplaySize(isPickup ? 26 : 30, isPickup ? 26 : 30);
      return;
    }
    if (itemId === "onigiri_large") {
      item.setDisplaySize(isPickup ? 38 : 42, isPickup ? 38 : 42);
      return;
    }
    item.setDisplaySize(isPickup ? 26 : 30, isPickup ? 26 : 30);
    return;
  }
  if (texKey === "item-drink") {
    item.setDisplaySize(isPickup ? 24 : 26, isPickup ? 42 : 46);
    return;
  }
  item.setDisplaySize(isPickup ? 34 : 36, isPickup ? 34 : 36);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomizeLocalXs(
  localXs: number[],
  offsetRange: number,
  minSpacing: number,
  minX: number,
  maxX: number,
): number[] {
  if (localXs.length <= 1) return [...localXs];
  const sorted = [...localXs].sort((a, b) => a - b);
  const randomized: number[] = [];
  // 配置可能幅を超える最小間隔は自動で緩め、端への押し込みを防ぐ
  const maxPossibleSpacing = Math.floor((maxX - minX) / (localXs.length - 1));
  const safeSpacing = Math.min(minSpacing, Math.max(80, maxPossibleSpacing));
  let prev = minX - safeSpacing;

  for (const x of sorted) {
    const jittered = x + randomInt(-offsetRange, offsetRange);
    const withGap = Math.max(jittered, prev + safeSpacing);
    const clamped = clamp(withGap, minX, maxX);
    randomized.push(clamped);
    prev = clamped;
  }

  return randomized;
}

type OccupiedRange = { left: number; right: number };

function canReserveObstacleRange(
  occupied: OccupiedRange[],
  centerX: number,
  width: number,
  minSpacing: number,
): boolean {
  const halfWidth = width / 2;
  const left = centerX - halfWidth;
  const right = centerX + halfWidth;
  const gap = minSpacing / 2;

  for (const zone of occupied) {
    // 既存障害物の周囲に余白を持たせ、近接しすぎる配置を防ぐ
    if (right + gap > zone.left && left - gap < zone.right) return false;
  }
  return true;
}

function reserveObstacleRange(
  occupied: OccupiedRange[],
  centerX: number,
  width: number,
): void {
  const halfWidth = width / 2;
  occupied.push({ left: centerX - halfWidth, right: centerX + halfWidth });
}

function findAvailableObstacleX(
  occupied: OccupiedRange[],
  desiredX: number,
  width: number,
  minSpacing: number,
  minX: number,
  maxX: number,
): number | null {
  const candidates = [0, 40, -40, 80, -80, 120, -120, 160, -160];
  for (const offset of candidates) {
    const x = clamp(desiredX + offset, minX, maxX);
    if (canReserveObstacleRange(occupied, x, width, minSpacing)) return x;
  }
  return null;
}

function itemDisplaySizeByItem(
  itemId: string,
  texKey: string,
): { width: number; height: number } {
  if (texKey === "item-bento") {
    if (itemId === "bento_small") return { width: 34, height: 34 };
    if (itemId === "bento_medium") return { width: 46, height: 46 };
    if (itemId === "bento_large") return { width: 58, height: 58 };
    return { width: 46, height: 46 };
  }
  if (texKey === "item-onigiri") {
    if (itemId === "onigiri_medium") return { width: 30, height: 30 };
    if (itemId === "onigiri_large") return { width: 42, height: 42 };
    return { width: 30, height: 30 };
  }
  if (texKey === "item-drink") return { width: 26, height: 46 };
  return { width: 36, height: 36 };
}

function canPlaceItemX(
  obstacleRanges: OccupiedRange[],
  itemRanges: OccupiedRange[],
  centerX: number,
  width: number,
): boolean {
  const half = width / 2;
  const left = centerX - half;
  const right = centerX + half;
  for (const range of obstacleRanges) {
    if (right + 18 > range.left && left - 18 < range.right) return false;
  }
  for (const range of itemRanges) {
    if (right + ITEM_MIN_SPACING / 2 > range.left && left - ITEM_MIN_SPACING / 2 < range.right) {
      return false;
    }
  }
  return true;
}

function findAvailableItemX(
  obstacleRanges: OccupiedRange[],
  itemRanges: OccupiedRange[],
  desiredX: number,
  width: number,
): number | null {
  const candidates = [0, 40, -40, 80, -80, 120, -120, 160, -160, 200, -200];
  for (const offset of candidates) {
    const x = clamp(desiredX + offset, 140, CHUNK_WIDTH - 140);
    if (canPlaceItemX(obstacleRanges, itemRanges, x, width)) return x;
  }
  return null;
}

function spawnHazard(
  scene: Phaser.Scene,
  groups: { hazards: Phaser.Physics.Arcade.Group },
  root: Phaser.GameObjects.Container,
  kind: "shoplifter" | "biker",
  x: number,
  y: number,
): void {
  const hz = scene.add.image(x, y, hazardTextureKey(kind));
  hz.setDisplaySize(
    kind === "shoplifter" ? 74 : 56,
    kind === "shoplifter" ? 74 : 56,
  );
  placeOnGround(hz);
  scene.physics.add.existing(hz);
  const hb = hz.body as Phaser.Physics.Arcade.Body;
  hb.setAllowGravity(false);
  hb.setImmovable(true);
  applyCenteredHitbox(
    hz,
    hb,
    kind === "shoplifter" ? 0.78 : 0.86,
    kind === "shoplifter" ? 0.82 : 0.86,
  );
  hz.setData("kind", kind);
  groups.hazards.add(hz);
  root.add(hz);
}

function spawnBoxStack(
  scene: Phaser.Scene,
  groups: { destructibles: Phaser.Physics.Arcade.Group },
  root: Phaser.GameObjects.Container,
  centerX: number,
  stack: 1 | 2 | 3,
): void {
  // 理不尽さを避けるため、単体は中サイズ中心・段積みは少し小さめでランダム化
  const boxSize =
    stack === 1
      ? Phaser.Utils.Array.GetRandom([64, 68, 72])
      : Phaser.Utils.Array.GetRandom([50, 54, 58]);
  const stackedStep = Math.round(boxSize * 0.73);
  for (let level = 0; level < stack; level += 1) {
    const box = scene.add.image(centerX, 0, "obstacle-box");
    box.setDisplaySize(boxSize, boxSize);
    placeOnGround(box);
    // 箱は地面に少し沈めて、浮いて見えないようにする
    box.y += BOX_GROUND_SINK_Y;
    // 段間を少し詰めて、浮いて見えない自然な積み上げにする
    box.y -= level * stackedStep;
    scene.physics.add.existing(box);
    const bb = box.body as Phaser.Physics.Arcade.Body;
    bb.setAllowGravity(false);
    bb.setImmovable(true);
    applyCenteredHitbox(box, bb, 0.88, 0.88);
    box.setData("kind", "box");
    groups.destructibles.add(box);
    root.add(box);
  }
}

function spawnTrashRow(
  scene: Phaser.Scene,
  groups: { destructibles: Phaser.Physics.Arcade.Group },
  root: Phaser.GameObjects.Container,
  centerX: number,
  count: 1 | 2 | 3,
): void {
  const bagSize = 64;
  // 連続配置時は重なりを許容し、間隔を詰めて密度を上げる
  const gap = 6;
  const spacing = bagSize + gap;
  const startX = centerX - ((count - 1) * spacing) / 2;

  for (let i = 0; i < count; i += 1) {
    const bag = scene.add.image(startX + i * spacing, 0, "obstacle-trash-bag");
    bag.setDisplaySize(bagSize, bagSize);
    placeOnGround(bag);
    // ゴミ袋も地面に少し沈めて接地感を強める
    bag.y += TRASH_GROUND_SINK_Y;
    scene.physics.add.existing(bag);
    const bb = bag.body as Phaser.Physics.Arcade.Body;
    bb.setAllowGravity(false);
    bb.setImmovable(true);
    applyCenteredHitbox(bag, bb, 0.88, 0.88);
    bag.setData("kind", "trash_bag");
    groups.destructibles.add(bag);
    root.add(bag);
  }
}

/** チャンクをワールドに生成（プレースホルダー矩形） */
export function spawnChunkIntoScene(
  scene: Phaser.Scene,
  template: ChunkTemplate,
  baseX: number,
  groups: {
    platforms: Phaser.Physics.Arcade.StaticGroup;
    items: Phaser.Physics.Arcade.Group;
    hazards: Phaser.Physics.Arcade.Group;
    destructibles: Phaser.Physics.Arcade.Group;
  },
): SpawnedChunkHandle {
  const root = scene.add.container(0, 0);
  const itemSpawnXs = randomizeLocalXs(
    template.items.map((it) => it.x),
    ITEM_RANDOM_OFFSET_X,
    ITEM_MIN_SPACING,
    140,
    CHUNK_WIDTH - 140,
  );
  const destructibleSpawnXs = randomizeLocalXs(
    template.destructibles.map((d) => d.x),
    OBSTACLE_RANDOM_OFFSET_X,
    OBSTACLE_MIN_SPACING,
    170,
    CHUNK_WIDTH - 170,
  );
  const occupiedObstacles: OccupiedRange[] = [];
  const occupiedItems: OccupiedRange[] = [];

  for (const b of template.terrain) {
    if (b.type === "ground") {
      const plat = scene.add.rectangle(
        baseX + b.x + b.width / 2,
        GROUND_Y + 10,
        b.width,
        20,
        0x6b6b6b,
      );
      plat.setStrokeStyle(2, 0x333333);
      scene.physics.add.existing(plat, true);
      const body = plat.body as Phaser.Physics.Arcade.StaticBody;
      body.updateFromGameObject();
      groups.platforms.add(plat);
      root.add(plat);
      continue;
    }

    // 穴の両端にコーンを置き、危険エリアを明示する（接触でダメージあり）
    const leftConeLocalX = b.x - 18;
    const rightConeLocalX = b.x + b.width + 18;
    const leftConeX = baseX + leftConeLocalX;
    const rightConeX = baseX + rightConeLocalX;
    reserveObstacleRange(occupiedObstacles, leftConeLocalX, 56);
    reserveObstacleRange(occupiedObstacles, rightConeLocalX, 56);
    spawnHazard(scene, groups, root, "biker", leftConeX, GROUND_Y);
    spawnHazard(scene, groups, root, "biker", rightConeX, GROUND_Y);
  }

  for (const h of template.hazards) {
    const localX = h.x;
    const spawnX = baseX + localX;
    // 両端コーンは固定表示優先のため間隔制御対象から除外する
    if (h.kind === "biker") {
      spawnHazard(scene, groups, root, h.kind, spawnX, h.y);
      continue;
    }
    if (!canReserveObstacleRange(occupiedObstacles, localX, 58, OBSTACLE_MIN_SPACING)) {
      continue;
    }
    reserveObstacleRange(occupiedObstacles, localX, 58);
    spawnHazard(scene, groups, root, h.kind, spawnX, h.y);
  }

  for (let i = 0; i < template.destructibles.length; i += 1) {
    const d = template.destructibles[i];
    const preferBox = (i + Math.round(Math.random())) % 2 === 0;
    const spawnAsBox = Math.random() < 0.72 ? preferBox : !preferBox;
    const boxStack = d.kind === "box" ? (d.stack ?? 1) : (randomInt(1, 3) as 1 | 2 | 3);
    const trashCount =
      d.kind === "trash_bag" ? (d.count ?? 1) : (randomInt(1, 3) as 1 | 2 | 3);
    const visualWidth = spawnAsBox ? 60 : trashCount * 56 + (trashCount - 1) * 18;
    const localX = destructibleSpawnXs[i];
    const spawnLocalX = findAvailableObstacleX(
      occupiedObstacles,
      localX,
      visualWidth,
      OBSTACLE_MIN_SPACING,
      170,
      CHUNK_WIDTH - 170,
    );
    if (spawnLocalX === null) continue;
    reserveObstacleRange(occupiedObstacles, spawnLocalX, visualWidth);
    const spawnX = baseX + spawnLocalX;
    if (spawnAsBox) {
      spawnBoxStack(scene, groups, root, spawnX, boxStack);
      continue;
    }
    spawnTrashRow(scene, groups, root, spawnX, trashCount);
  }

  for (let i = 0; i < template.items.length; i += 1) {
    const it = template.items[i];
    const texKey = getItemTextureKey(it.itemId);
    const size = itemDisplaySizeByItem(it.itemId, texKey);
    const desiredLocalX = itemSpawnXs[i];
    const itemLocalX = findAvailableItemX(
      occupiedObstacles,
      occupiedItems,
      desiredLocalX,
      size.width,
    );
    if (itemLocalX === null) continue;

    reserveObstacleRange(occupiedItems, itemLocalX, size.width);
    const randomY = clamp(
      it.y + randomInt(-90, 80),
      ITEM_MIN_Y,
      ITEM_MAX_Y,
    );
    const item = scene.add.image(baseX + itemLocalX, randomY, texKey);
    applyItemDisplaySize(item, it.itemId, texKey, false);
    scene.physics.add.existing(item);
    const ib = item.body as Phaser.Physics.Arcade.Body;
    ib.setAllowGravity(false);
    ib.setImmovable(true);
    applyCenteredHitbox(item, ib, 0.82, 0.82);
    item.setData("itemId", it.itemId);
    groups.items.add(item);
    root.add(item);
  }

  return { baseX, root };
}

/** 単体アイテム（箱破壊報酬など） */
export function spawnPickupItem(
  scene: Phaser.Scene,
  items: Phaser.Physics.Arcade.Group,
  x: number,
  y: number,
  itemId: string,
): void {
  const texKey = getItemTextureKey(itemId);
  const item = scene.add.image(x, y, texKey);
  applyItemDisplaySize(item, itemId, texKey, true);
  scene.physics.add.existing(item);
  const ib = item.body as Phaser.Physics.Arcade.Body;
  ib.setAllowGravity(false);
  ib.setImmovable(true);
  applyCenteredHitbox(item, ib, 0.84, 0.84);
  item.setData("itemId", itemId);
  items.add(item);
}
