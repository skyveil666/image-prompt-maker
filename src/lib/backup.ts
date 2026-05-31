/**
 * バックアップ: JSON エクスポート / インポート。
 *
 * エクスポート:
 *   - 全履歴アイテム（PromptHistoryItem[]）
 *   - 最近使った画像（thumbnail + imageDataUrl の両方を保存して完全復元を可能にする）
 *   - localStorage の設定スナップショット
 *   ファイル名: image-prompt-maker-backup-YYYY-MM-DD.json
 *
 * インポート:
 *   - 既存データとマージ（id が重複するアイテムはスキップ）
 *   - 最近画像は id（= imageHash）が重複する場合はスキップ
 *   - フォーマット検証あり（appName / version チェック）
 */
import type { PromptHistoryItem } from "../types";
import type { RecentImageItem } from "./recentImages";
import { getAll, saveBatch } from "./history";
import { listRecentImages } from "./recentImages";
import * as idb from "./idb";
import { STORE_RECENT } from "./idb";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface AppBackup {
  version: 1;
  appName: "image-prompt-maker";
  exportedAt: number;
  history: PromptHistoryItem[];
  recentImages: RecentImageItem[];
  settings: Record<string, string>;
}

export interface ImportResult {
  historyAdded: number;
  historySkipped: number;
  imagesAdded: number;
  imagesSkipped: number;
  errors: string[];
}

// ─── エクスポート ────────────────────────────────────────────────────────────

/**
 * 現在のデータを JSON ファイルとしてダウンロードさせる。
 * 最近画像は thumbnail + imageDataUrl の両方を含む（完全バックアップ）。
 */
export async function exportBackup(): Promise<void> {
  const [history, recentImages] = await Promise.all([
    getAll(),
    listRecentImages(),
  ]);

  // localStorage の設定スナップショット
  const settings: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) settings[k] = localStorage.getItem(k) ?? "";
    }
  } catch { /* noop */ }

  const backup: AppBackup = {
    version: 1,
    appName: "image-prompt-maker",
    exportedAt: Date.now(),
    history,
    recentImages,
    settings,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);

  const a = document.createElement("a");
  a.href = url;
  a.download = `image-prompt-maker-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── インポート ──────────────────────────────────────────────────────────────

/**
 * バックアップ JSON ファイルを読み込み、既存データにマージする。
 * id が重複するアイテムはスキップ（上書きしない）。
 */
export async function importBackup(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    historyAdded: 0,
    historySkipped: 0,
    imagesAdded: 0,
    imagesSkipped: 0,
    errors: [],
  };

  // JSON パース
  let backup: AppBackup;
  try {
    const text = await file.text();
    backup = JSON.parse(text) as AppBackup;
  } catch {
    result.errors.push("JSON の解析に失敗しました。ファイルが破損している可能性があります。");
    return result;
  }

  // フォーマット検証
  if (backup.appName !== "image-prompt-maker" || backup.version !== 1) {
    result.errors.push(
      "このファイルは Image Prompt Maker のバックアップではありません（形式不正）。"
    );
    return result;
  }

  // ─ 履歴マージ ──────────────────────────────────────────────────────────────
  const existingHistory = await getAll();
  const existingIds = new Set(existingHistory.map((it) => it.id));

  const newHistoryItems = (backup.history ?? []).filter((it) => {
    if (!it.id || existingIds.has(it.id)) {
      result.historySkipped++;
      return false;
    }
    return true;
  });

  if (newHistoryItems.length > 0) {
    await saveBatch(newHistoryItems);
    result.historyAdded = newHistoryItems.length;
  }

  // ─ 最近画像マージ ───────────────────────────────────────────────────────────
  const existingImages = await idb.getAll<RecentImageItem>(STORE_RECENT);
  const existingImageIds = new Set(existingImages.map((it) => it.id));

  for (const img of backup.recentImages ?? []) {
    if (!img.id || !img.imageDataUrl || existingImageIds.has(img.id)) {
      result.imagesSkipped++;
      continue;
    }
    await idb.put(STORE_RECENT, img);
    result.imagesAdded++;
  }

  return result;
}
