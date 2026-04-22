import type { ItemDefinition } from "../types";

/** 商品マスタ（価格はデモ用の目安） */
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  { id: "onigiri_medium", name: "おにぎり（中）", price: 150, rarity: "common" },
  { id: "onigiri_large", name: "おにぎり（大）", price: 200, rarity: "uncommon" },
  { id: "sandwich_tamago", name: "たまごサンド", price: 250, rarity: "uncommon" },
  { id: "energy_drink", name: "栄養ドリンク", price: 200, rarity: "rare" },
  { id: "bento_small", name: "お弁当（小）", price: 400, rarity: "common" },
  { id: "bento_medium", name: "お弁当（中）", price: 500, rarity: "uncommon" },
  { id: "bento_large", name: "お弁当（大）", price: 600, rarity: "epic" },
] as const;

const byId = new Map<string, ItemDefinition>(
  ITEM_DEFINITIONS.map((x) => [x.id, x]),
);

export function getItemDefinition(id: string): ItemDefinition | undefined {
  return byId.get(id);
}

/** itemId を画像キーへ寄せる（運用を手軽にするためカテゴリ単位） */
export function getItemTextureKey(id: string): string {
  if (id.startsWith("onigiri_")) return "item-onigiri";
  if (id.includes("sandwich")) return "item-sandwich";
  if (id === "energy_drink") return "item-drink";
  if (id === "bento_small") return "item-bento";
  if (id === "bento_medium") return "item-bento";
  if (id === "bento_large") return "item-bento";
  return "item-bento";
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
