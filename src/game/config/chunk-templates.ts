import type { ChunkTemplate } from "../types";

/** エンドレス用チャンク（x はチャンク先頭からの相対座標） */
export const CHUNK_TEMPLATES: readonly ChunkTemplate[] = [
  {
    id: "easy_straight",
    difficulty: 1,
    terrain: [{ type: "ground", x: 0, width: 800, y: 0 }],
    items: [
      { itemId: "onigiri_medium", x: 200, y: 400 },
      { itemId: "sandwich_tamago", x: 450, y: 400 },
      // 序盤でも中弁当が出るようにする（小だけが続きやすいのを緩和）
      { itemId: "bento_medium", x: 650, y: 400 },
    ],
    hazards: [],
    destructibles: [
      { kind: "box", x: 340, y: 420, stack: 2 },
      { kind: "trash_bag", x: 540, y: 420, count: 2 },
      { kind: "box", x: 720, y: 420 },
    ],
  },
  {
    id: "easy_small_gap",
    difficulty: 2,
    terrain: [
      { type: "ground", x: 0, width: 320, y: 0 },
      { type: "gap", x: 320, width: 120, y: 0 },
      { type: "ground", x: 440, width: 360, y: 0 },
    ],
    items: [
      { itemId: "onigiri_medium", x: 120, y: 400 },
      { itemId: "sandwich_tamago", x: 560, y: 400 },
      { itemId: "bento_large", x: 340, y: 360 },
    ],
    hazards: [],
    destructibles: [{ kind: "trash_bag", x: 620, y: 420, count: 2 }],
  },
  {
    id: "mid_boxes",
    difficulty: 3,
    terrain: [{ type: "ground", x: 0, width: 800, y: 0 }],
    items: [
      { itemId: "bento_medium", x: 260, y: 340 },
      { itemId: "onigiri_medium", x: 520, y: 400 },
    ],
    hazards: [],
    destructibles: [
      { kind: "box", x: 280, y: 420, stack: 2 },
      { kind: "box", x: 520, y: 420, stack: 3 },
    ],
  },
  {
    id: "mid_high_item",
    difficulty: 3,
    terrain: [{ type: "ground", x: 0, width: 800, y: 0 }],
    items: [
      { itemId: "bento_large", x: 520, y: 260 },
      { itemId: "sandwich_tamago", x: 220, y: 400 },
    ],
    hazards: [],
    destructibles: [
      { kind: "box", x: 300, y: 420 },
      { kind: "trash_bag", x: 660, y: 420, count: 2 },
    ],
  },
  {
    id: "hard_double_gap",
    difficulty: 4,
    terrain: [
      { type: "ground", x: 0, width: 260, y: 0 },
      { type: "gap", x: 260, width: 140, y: 0 },
      { type: "ground", x: 400, width: 220, y: 0 },
      { type: "gap", x: 620, width: 120, y: 0 },
      { type: "ground", x: 740, width: 60, y: 0 },
    ],
    items: [{ itemId: "onigiri_large", x: 120, y: 400 }],
    hazards: [],
    destructibles: [
      { kind: "box", x: 180, y: 420, stack: 2 },
      { kind: "trash_bag", x: 560, y: 420, count: 1 },
    ],
  },
  {
    id: "hard_epic",
    difficulty: 5,
    terrain: [
      { type: "ground", x: 0, width: 360, y: 0 },
      { type: "gap", x: 360, width: 160, y: 0 },
      { type: "ground", x: 520, width: 280, y: 0 },
    ],
    items: [
      { itemId: "bento_large", x: 640, y: 300 },
      { itemId: "onigiri_medium", x: 120, y: 400 },
    ],
    hazards: [],
    destructibles: [
      { kind: "box", x: 150, y: 420, stack: 2 },
      { kind: "trash_bag", x: 480, y: 420, count: 2 },
    ],
  },
  {
    id: "mid_legend",
    difficulty: 5,
    terrain: [{ type: "ground", x: 0, width: 800, y: 0 }],
    items: [{ itemId: "bento_large", x: 560, y: 380 }],
    hazards: [],
    destructibles: [{ kind: "box", x: 470, y: 420, stack: 3 }],
  },
  {
    id: "easy_recover",
    difficulty: 1,
    terrain: [{ type: "ground", x: 0, width: 800, y: 0 }],
    items: [
      { itemId: "onigiri_medium", x: 200, y: 400 },
      { itemId: "sandwich_tamago", x: 500, y: 400 },
    ],
    hazards: [],
    destructibles: [
      { kind: "box", x: 320, y: 420 },
      { kind: "trash_bag", x: 540, y: 420, count: 1 },
      { kind: "box", x: 740, y: 420, stack: 2 },
    ],
  },
] as const;
