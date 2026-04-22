export type ItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type ItemDefinition = {
  id: string;
  name: string;
  price: number;
  rarity: ItemRarity;
};

export type CouponRank = "D" | "C" | "B" | "A";

export type ReceiptLine = {
  name: string;
  yen: number;
};

export type RunResultPayload = {
  subtotalYen: number;
  comboMultiplier: number;
  totalYen: number;
  rank: CouponRank;
  couponText: string;
  lines: ReceiptLine[];
  elapsedSec: number;
};

export type TerrainBlock = {
  type: "ground" | "gap";
  x: number;
  width: number;
  y: number;
};

export type ItemSpawn = { itemId: string; x: number; y: number };

export type HazardSpawn = {
  kind: "shoplifter" | "biker";
  x: number;
  y: number;
};

export type DestructibleSpawn =
  | {
      kind: "box";
      x: number;
      y: number;
      stack?: 1 | 2 | 3;
    }
  | {
      kind: "trash_bag";
      x: number;
      y: number;
      count?: 1 | 2 | 3;
    };

export type ChunkTemplate = {
  id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  terrain: TerrainBlock[];
  items: ItemSpawn[];
  hazards: HazardSpawn[];
  destructibles: DestructibleSpawn[];
};
