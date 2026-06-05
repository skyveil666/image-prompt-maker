/**
 * 選択範囲プロンプト履歴の CRUD。
 * 第1段階: 画像編集は行わず、生成したプロンプトと選択マスクを記録するのみ。
 */
import * as idb from "./idb";
import { STORE_SELECTION } from "./idb";
import { uid } from "./history";

// ── Types ──────────────────────────────────────────────────────────────────

export type SelectionEditType =
  | "change"      // 選択範囲だけ変更
  | "remove"      // 選択範囲を自然に消す
  | "replace"     // 選択範囲を別の物に置換
  | "recolor"     // 選択範囲だけ色変更
  | "texture"     // 選択範囲だけ質感変更
  | "brightness"  // 選択範囲だけ明るさ変更
  | "gloss"       // 選択範囲だけ光沢変更
  | "outfit";     // 選択範囲だけ衣装変更

export interface SelectionHistoryItem {
  id: string;
  createdAt: number;
  /** 元画像の縮小サムネイル（~200px, 保存容量節約） */
  sourceImageThumbnail: string;
  /** マスクキャンバスの PNG data URL */
  maskDataUrl: string;
  /** 生成されたプロンプト本文 */
  generatedPrompt: string;
  /** 編集タイプ */
  editType: SelectionEditType;
  /** ユーザーが入力した追加指示（任意） */
  extraInstructions: string;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function saveSelectionItem(
  params: Omit<SelectionHistoryItem, "id" | "createdAt">
): Promise<SelectionHistoryItem> {
  const item: SelectionHistoryItem = {
    ...params,
    id: uid(),
    createdAt: Date.now(),
  };
  await idb.put(STORE_SELECTION, item);
  return item;
}

export async function listSelectionHistory(): Promise<SelectionHistoryItem[]> {
  const all = await idb.getAll<SelectionHistoryItem>(STORE_SELECTION);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSelectionItem(id: string): Promise<void> {
  await idb.remove(STORE_SELECTION, id);
}

/**
 * バックアップ復元用：id が重複しないアイテムだけ追加する（既存は上書き・削除しない）。
 */
export async function mergeSelectionHistory(
  items: SelectionHistoryItem[]
): Promise<{ added: number; skipped: number }> {
  const incoming = items ?? [];
  const existing = await idb.getAll<SelectionHistoryItem>(STORE_SELECTION);
  const existingIds = new Set(existing.map((it) => it.id));
  const toAdd = incoming.filter(
    (it) => it && typeof it.id === "string" && it.id.length > 0 && !existingIds.has(it.id)
  );
  if (toAdd.length > 0) await idb.putMany(STORE_SELECTION, toAdd);
  return { added: toAdd.length, skipped: incoming.length - toAdd.length };
}
