/**
 * croppedImages — トリミング結果（ImageCropModal）を IndexedDB に蓄積する。
 *
 * 設計：
 *   - ★フルサイズで保存する（サムネ縮小はしない＝再利用が目的のため）。一覧表示の軽さのため
 *     `thumb`（makeThumbnail 圧縮）も併記するが、これは表示専用で `dataUrl` の代替ではない。
 *   - 元画像 state（App.tsx の imageDataUrl）・commit1（ImageCropModal の非破壊配線）には無関係。
 *   - §3 additive のみ：STORE_CROPPED（idb.ts）に加算されるだけで既存ストアは無改修。
 *
 * ストア：STORE_CROPPED（idb v7・加算的に追加。index: createdAt）。
 */

import { put, getAll, remove, STORE_CROPPED } from "./idb";
import { makeThumbnail } from "./imageThumb";

export interface CroppedImageRecord {
  /** 一意ID（createdAt と連番から決定的に生成） */
  id: string;
  /** 記録時刻（ms） */
  createdAt: number;
  /** トリミング結果（フルサイズ・PNG data URL） */
  dataUrl: string;
  /** 一覧表示用の軽量サムネ（表示専用。実体は dataUrl） */
  thumb: string;
  /** お気に入り（true の間は上限50のカウント・削除対象から除外＝保護） */
  favorite?: boolean;
}

/** 保持上限（非favoriteのみでカウント。古いものから間引く）。 */
const MAX_RECORDS = 50;
/** ID 重複防止用の連番（同一 ms に複数保存されても衝突しない） */
let seq = 0;

/** 保存/削除/お気に入り切替のたびに発火（UI側の即時反映用・パネルの開閉に依存しない）。 */
export const croppedImagesChanged = new EventTarget();

/**
 * トリミング結果を1件保存する。失敗しても呼び出し元の操作を止めないためベストエフォート。
 * 戻り値：保存できた id（失敗時 null）。
 */
export async function saveCroppedImage(dataUrl: string): Promise<string | null> {
  try {
    const createdAt = Date.now();
    seq = (seq + 1) % 1_000_000;
    const id = `crop_${createdAt}_${seq.toString().padStart(6, "0")}`;
    const thumb = await makeThumbnail(dataUrl);
    const entry: CroppedImageRecord = { id, createdAt, dataUrl, thumb };
    await put(STORE_CROPPED, entry);
    // ★毎回チェックする（参照履歴の「seq&0x0fで16件に1回」方式は、ページ再読み込みで
    //   seq がリセットされ発火漏れする既知の弱点があるため採用しない）。
    await pruneIfNeeded();
    croppedImagesChanged.dispatchEvent(new Event("change"));
    return id;
  } catch {
    /* ローカル保存失敗は無視 */
    return null;
  }
}

/**
 * 上限超過分を古い順に間引く。★favorite=true は件数カウント・削除対象の両方から除外（保護）。
 */
async function pruneIfNeeded(): Promise<void> {
  try {
    const all = await getAll<CroppedImageRecord>(STORE_CROPPED);
    const nonFavorite = all.filter((r) => !r.favorite);
    if (nonFavorite.length <= MAX_RECORDS) return;
    const sorted = nonFavorite.sort((a, b) => b.createdAt - a.createdAt);
    const toRemove = sorted.slice(MAX_RECORDS);
    await Promise.all(toRemove.map((e) => remove(STORE_CROPPED, e.id)));
  } catch {
    /* noop */
  }
}

/** 全トリミング結果を新しい順で取得。 */
export async function listCroppedImages(): Promise<CroppedImageRecord[]> {
  const all = await getAll<CroppedImageRecord>(STORE_CROPPED);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** id 指定で1件削除（手動整理用）。 */
export async function removeCroppedImage(id: string): Promise<void> {
  await remove(STORE_CROPPED, id);
  croppedImagesChanged.dispatchEvent(new Event("change"));
}

/** favorite を切り替える（対象が無ければ何もしない）。 */
export async function toggleCroppedFavorite(id: string): Promise<void> {
  const all = await getAll<CroppedImageRecord>(STORE_CROPPED);
  const cur = all.find((r) => r.id === id);
  if (!cur) return;
  await put(STORE_CROPPED, { ...cur, favorite: !cur.favorite });
  croppedImagesChanged.dispatchEvent(new Event("change"));
}
