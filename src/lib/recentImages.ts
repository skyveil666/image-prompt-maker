/**
 * 直近で使った画像（最大8枚）の管理。IndexedDB の recentImages ストアに保存。
 *
 * - id は **元ファイル ArrayBuffer の SHA-256**（呼び出し側で計算して渡す）。
 *   → 同じファイルなら必ず同じ id ＝ IndexedDB の keyPath で物理的に dedup される。
 * - imageDataUrl は再利用用に 1600px / JPEG q0.85 へリサイズして保存。
 * - thumbnailDataUrl は表示用に 280px / JPEG q0.72。
 * - MAX_RECENT 件を超えたら古いものから削除（addedAt 昇順）。
 *
 * 旧スキーマ（id がファイルハッシュ以外で作られたレコード）が残っている場合のため、
 * dedupeRecentImages() を用意。`thumbnailDataUrl` 一致でグルーピングし、
 * 最新の 1 件だけ残して残りを物理削除する。
 */
import * as idb from "./idb";
import { STORE_RECENT } from "./idb";
import { imageContentHash, makeStorageSize, makeThumbnail } from "./imageThumb";

export interface RecentImageItem {
  id: string;                 // = fileHash(file)
  thumbnailDataUrl: string;
  imageDataUrl: string;
  addedAt: number;
  fileName: string;
}

export const MAX_RECENT = 12;

export async function listRecentImages(): Promise<RecentImageItem[]> {
  const all = await idb.getAll<RecentImageItem>(STORE_RECENT);
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export interface AddRecentResult {
  list: RecentImageItem[];
  item: RecentImageItem;
  wasExisting: boolean;
}

/**
 * 新しい画像を追加（または既存ならタイムスタンプ更新 = 先頭に移動）。
 * imageHash が一致するレコードがあれば新規追加しない。
 */
export async function addRecentImage(input: {
  imageHash: string;
  originalDataUrl: string;
  fileName?: string;
}): Promise<AddRecentResult> {
  const id = input.imageHash;
  const existing = await idb.get<RecentImageItem>(STORE_RECENT, id);

  let item: RecentImageItem;
  if (existing) {
    item = { ...existing, addedAt: Date.now() };
    await idb.put(STORE_RECENT, item);
  } else {
    const [storageUrl, thumbUrl] = await Promise.all([
      makeStorageSize(input.originalDataUrl),
      makeThumbnail(input.originalDataUrl),
    ]);
    item = {
      id,
      thumbnailDataUrl: thumbUrl,
      imageDataUrl: storageUrl,
      addedAt: Date.now(),
      fileName: input.fileName || `image-${Date.now()}.jpg`,
    };
    await idb.put(STORE_RECENT, item);
  }

  // MAX_RECENT 件超過分を削除
  let sorted = await listRecentImages();
  if (sorted.length > MAX_RECENT) {
    const overflow = sorted.slice(MAX_RECENT);
    await Promise.all(overflow.map((it) => idb.remove(STORE_RECENT, it.id)));
    sorted = sorted.slice(0, MAX_RECENT);
  }
  return { list: sorted, item, wasExisting: !!existing };
}

export async function deleteRecentImage(id: string): Promise<void> {
  await idb.remove(STORE_RECENT, id);
}

export async function clearRecentImages(): Promise<void> {
  await idb.clear(STORE_RECENT);
}

/**
 * 旧スキーマの重複や、何らかの理由で重複保存されたレコードを掃除する。
 *
 * - imageContentHash（32×32 ピクセルハッシュ）を使用して視覚的に同じ画像を検出。
 *   PNG/JPEG 等フォーマット違いでも同じ被写体なら同一と判定し、最新の 1 件だけ残す。
 * - ハッシュ計算に失敗したレコードは id をキーにフォールバック。
 * - 結果は addedAt 降順・最大 MAX_RECENT 件。
 */
export async function dedupeRecentImages(): Promise<RecentImageItem[]> {
  const all = await idb.getAll<RecentImageItem>(STORE_RECENT);
  if (all.length === 0) return [];

  const sorted = [...all].sort((a, b) => b.addedAt - a.addedAt);

  // 各レコードのコンテンツハッシュを計算（失敗時は id で代替）
  const withHashes = await Promise.all(
    sorted.map(async (it) => {
      try {
        const src = it.thumbnailDataUrl || it.imageDataUrl;
        const hash = src ? await imageContentHash(src) : it.id;
        return { item: it, hash };
      } catch {
        return { item: it, hash: it.id };
      }
    }),
  );

  // コンテンツハッシュをキーに最新の 1 件だけ採用（addedAt 降順なので先勝ち）
  const keptByHash = new Map<string, RecentImageItem>();
  for (const { item, hash } of withHashes) {
    if (!keptByHash.has(hash)) keptByHash.set(hash, item);
  }

  // 最大 MAX_RECENT 件まで
  const kept = Array.from(keptByHash.values())
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, MAX_RECENT);

  const keptIds = new Set(kept.map((it) => it.id));
  const toDelete = all.filter((it) => !keptIds.has(it.id));
  if (toDelete.length > 0) {
    await Promise.all(toDelete.map((it) => idb.remove(STORE_RECENT, it.id)));
  }
  return kept;
}
