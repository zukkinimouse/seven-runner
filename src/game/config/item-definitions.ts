import type { ItemDefinition } from "../types";

/** 商品マスタ（価格はデモ用の目安） */
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  { id: "onigiri_medium", name: "おにぎり（中）", price: 250, rarity: "common" },
  { id: "onigiri_large", name: "おにぎり（大）", price: 300, rarity: "uncommon" },
  { id: "sandwich_tamago", name: "たまごサンド", price: 350, rarity: "uncommon" },
  { id: "energy_drink", name: "栄養ドリンク", price: 300, rarity: "rare" },
  { id: "bento_small", name: "お弁当（小）", price: 500, rarity: "common" },
  { id: "bento_medium", name: "お弁当（中）", price: 600, rarity: "uncommon" },
  { id: "bento_large", name: "お弁当（大）", price: 700, rarity: "epic" },
] as const;

const byId = new Map<string, ItemDefinition>(
  ITEM_DEFINITIONS.map((x) => [x.id, x]),
);

export function getItemDefinition(id: string): ItemDefinition | undefined {
  return byId.get(id);
}

/** itemId を画像キーへ寄せる（運用を手軽にするためカテゴリ単位） */
export function getItemTextureKey(id: string): string {
  if (id.startsWith("onigiri_")) {
    return pickRandomTextureKey([
      "item-onigiri",
      "item-onigiri-konbu",
      "item-onigiri-tuna",
    ]);
  }
  // 弁当系は「sandwich」を含む名前より先に判定（将来の id 衝突を防ぐ）
  if (id.startsWith("bento_")) {
    return pickRandomTextureKey([
      "item-bento",
      "item-bento-karaage",
      "item-bento-shake",
    ]);
  }
  if (id.includes("sandwich")) {
    return pickRandomTextureKey([
      "item-sandwich",
      "item-sandwich-egg",
      "item-sandwich-tuna",
    ]);
  }
  if (id === "energy_drink") return "item-drink";
  return "item-bento";
}

function pickRandomTextureKey(keys: readonly string[]): string {
  const index = Math.floor(Math.random() * keys.length);
  return keys[index] ?? keys[0]!;
}

/** レシート表示名はカテゴリ単位で統一する */
export function getReceiptItemName(id: string): string {
  if (id === "onigiri_medium") return "おにぎり（中）";
  if (id === "onigiri_large") return "おにぎり（大）";
  if (id.includes("sandwich")) return "サンドイッチ";
  if (id === "energy_drink") return "栄養ドリンク";
  if (id === "bento_small") return "お弁当（小）";
  if (id === "bento_medium") return "お弁当（中）";
  if (id === "bento_large") return "お弁当（大）";
  return "商品";
}
