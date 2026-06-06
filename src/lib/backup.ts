/**
 * バックアップ: JSON エクスポート / インポート。
 *
 * エクスポート（version 2）:
 *   - 全履歴アイテム（PromptHistoryItem[]・isFavorite フラグ含む）
 *   - 最近使った画像（thumbnail + imageDataUrl の両方を保存して完全復元を可能にする）
 *   - 選択範囲プロンプト履歴（selectionHistory）
 *   - Explorer お気に入り画像（miniExplorerDB.exFavs）
 *   - localStorage の設定スナップショット
 *   ファイル名: image-prompt-maker-backup-YYYY-MM-DD.json
 *   ※ exFolders（FileSystemDirectoryHandle）は JSON シリアライズ不可のため対象外
 *     （復元後はユーザーがフォルダを再選択する。これは仕様）。
 *
 * インポート:
 *   - 既存データとマージ（id が重複するアイテムはスキップ＝上書き・削除しない）
 *   - 最近画像は id（= imageHash）が重複する場合はスキップ
 *   - 選択範囲履歴 / Explorer★ も id 重複スキップのマージ
 *   - 設定（localStorage）の復元は opts.restoreSettings=true のとき「のみ」実行する
 *     opt-in（明示同意）方式。既定では設定に一切触れない（無断上書きしない）。
 *   - フォーマット検証あり（appName / version 1|2 を許容＝旧 v1 バックアップも読める）
 */
import type { PromptHistoryItem } from "../types";
import type { RecentImageItem } from "./recentImages";
import { getAll, saveBatch } from "./history";
import { listRecentImages } from "./recentImages";
import { listSelectionHistory, mergeSelectionHistory } from "./selectionHistory";
import type { SelectionHistoryItem } from "./selectionHistory";
import { listExplorerFavorites, mergeExplorerFavorites } from "./miniExplorer";
import type { ExplorerFavorite } from "./miniExplorer";
import * as idb from "./idb";
import { STORE_RECENT } from "./idb";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface AppBackup {
  /** 1 = 旧形式（history/recentImages/settings のみ） / 2 = selectionHistory・explorerFavorites を含む */
  version: 1 | 2;
  appName: "image-prompt-maker";
  exportedAt: number;
  history: PromptHistoryItem[];
  recentImages: RecentImageItem[];
  settings: Record<string, string>;
  /** v2+ 選択範囲プロンプト履歴（旧 v1 には無い → 復元時は空マージ） */
  selectionHistory?: SelectionHistoryItem[];
  /** v2+ Explorer お気に入り画像（miniExplorerDB.exFavs） */
  explorerFavorites?: ExplorerFavorite[];
}

export interface ImportResult {
  historyAdded: number;
  historySkipped: number;
  imagesAdded: number;
  imagesSkipped: number;
  selectionAdded: number;
  selectionSkipped: number;
  explorerFavAdded: number;
  explorerFavSkipped: number;
  /** opts.restoreSettings=true のとき復元した localStorage キー数（既定は 0） */
  settingsRestored: number;
  errors: string[];
}

// ─── エクスポート ────────────────────────────────────────────────────────────

/**
 * 現在のデータを JSON ファイルとしてダウンロードさせる。
 * 最近画像は thumbnail + imageDataUrl の両方を含む（完全バックアップ）。
 */
export async function exportBackup(): Promise<void> {
  const [history, recentImages, selectionHistory, explorerFavorites] = await Promise.all([
    getAll(),
    listRecentImages(),
    listSelectionHistory().catch(() => [] as SelectionHistoryItem[]),
    listExplorerFavorites().catch(() => [] as ExplorerFavorite[]),
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
    version: 2,
    appName: "image-prompt-maker",
    exportedAt: Date.now(),
    history,
    recentImages,
    settings,
    selectionHistory,
    explorerFavorites,
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
  // ダウンロード開始前に URL を破棄するとリンク切れになり得るため、1秒後に解放する。
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── インポート ──────────────────────────────────────────────────────────────

/**
 * バックアップ JSON ファイルを読み込み、既存データにマージする。
 * id が重複するアイテムはスキップ（上書き・削除しない）。
 *
 * @param opts.restoreSettings true のときだけ localStorage（設定）を復元する。
 *   既定 false＝設定には一切触れない（無断上書きを避けるための opt-in）。
 *   復元は明示同意のうえ該当キーを上書きする（反映には再読み込みが必要）。
 */
export async function importBackup(
  file: File,
  opts?: { restoreSettings?: boolean }
): Promise<ImportResult> {
  const result: ImportResult = {
    historyAdded: 0,
    historySkipped: 0,
    imagesAdded: 0,
    imagesSkipped: 0,
    selectionAdded: 0,
    selectionSkipped: 0,
    explorerFavAdded: 0,
    explorerFavSkipped: 0,
    settingsRestored: 0,
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

  // フォーマット検証（v1 / v2 の両方を許容＝旧バックアップも読める）
  if (backup.appName !== "image-prompt-maker" || (backup.version !== 1 && backup.version !== 2)) {
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

  // ─ 選択範囲プロンプト履歴マージ（v2+。v1 では undefined → 空マージ） ──────────
  try {
    const sel = await mergeSelectionHistory(backup.selectionHistory ?? []);
    result.selectionAdded = sel.added;
    result.selectionSkipped = sel.skipped;
  } catch {
    result.errors.push("選択範囲履歴の復元中にエラーが発生しました。");
  }

  // ─ Explorer お気に入り（exFavs）マージ（v2+） ─────────────────────────────────
  try {
    const ef = await mergeExplorerFavorites(backup.explorerFavorites ?? []);
    result.explorerFavAdded = ef.added;
    result.explorerFavSkipped = ef.skipped;
  } catch {
    result.errors.push("Explorer お気に入りの復元中にエラーが発生しました。");
  }

  // ─ 設定（localStorage）復元：opt-in 時のみ・明示同意のうえ該当キーを上書き ──────
  if (opts?.restoreSettings && backup.settings) {
    try {
      for (const [k, v] of Object.entries(backup.settings)) {
        localStorage.setItem(k, v);
        result.settingsRestored++;
      }
    } catch {
      result.errors.push("設定の復元中にエラーが発生しました。");
    }
  }

  return result;
}
