/**
 * 自動クリーンアップ: 90日を超えた通常履歴を削除する。
 *
 * 削除対象外:
 *   - isFavorite === true（お気に入り → 無期限保持）
 *   - status === "good"（結果よかった → 無期限保持）
 *   - isProtected === true（明示的に保護されたアイテム）
 *
 * 設定は localStorage の "ipm_autoCleanup" キーで ON/OFF。
 * 値がない場合はデフォルト ON。
 */
import { getAll, deleteItem } from "./history";

export const RETENTION_DAYS = 90;
const LS_KEY = "ipm_autoCleanup";

/** 自動クリーンアップが有効かどうかを localStorage から読む。デフォルト ON。 */
export function getAutoCleanupEnabled(): boolean {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v !== "false"; // "false" のときだけ OFF、未設定は ON
  } catch {
    return true;
  }
}

/** 自動クリーンアップの ON/OFF を localStorage に保存する。 */
export function setAutoCleanupEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_KEY, String(enabled));
  } catch { /* noop */ }
}

/**
 * 90日超過の通常履歴を削除する。
 * @returns 削除した件数
 */
export async function runAutoCleanup(): Promise<number> {
  const all = await getAll();
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const targets = all.filter(
    (it) =>
      it.createdAt < cutoff &&
      !it.isFavorite &&
      it.status !== "good" &&
      !it.isProtected
  );

  if (targets.length === 0) return 0;
  await Promise.all(targets.map((it) => deleteItem(it.id)));
  return targets.length;
}
