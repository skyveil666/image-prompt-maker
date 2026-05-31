/**
 * 衣装サブジャンル履歴：直近で使われたサブジャンルIDのリングバッファ。
 *
 * サーバはステートレスなので、クライアントが localStorage で保持し、
 * 生成リクエストの recentSubStyles として往復させる。
 * サーバの outfitSubStyles.planSubStylesForBatch がこれを回避して抽選する。
 *
 * 新しいものほど配列の先頭。最大 MAX 件（おおよそ直近5バッチ × 3個分）。
 */

const STORAGE_KEY = "ipm_recent_substyles_v1";
const MAX = 30;

/** 直近サブジャンルID配列を読み込む（新しい順）。壊れていたら空配列。 */
export function getRecentSubStyles(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is string => typeof v === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

/**
 * 新しく使われたサブジャンルIDを履歴の先頭に追加する。
 * 同一バッチ内の重複は除去し、既存の同IDも前方へ繰り上げる（最近性を反映）。
 */
export function pushRecentSubStyles(ids: string[]): void {
  try {
    const fresh = ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (fresh.length === 0) return;
    const prev = getRecentSubStyles();
    const merged: string[] = [];
    for (const id of [...fresh, ...prev]) {
      if (!merged.includes(id)) merged.push(id);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, MAX)));
  } catch {
    // localStorage 不可（プライベートブラウジング等）は無視
  }
}

/** 履歴をクリアする */
export function clearRecentSubStyles(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}
