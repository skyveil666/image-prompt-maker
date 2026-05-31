/**
 * マンネリ回避エンジン用：直近に使われたジャンルIDのリングバッファ。
 *
 * サーバはステートレスなので、直近のジャンル履歴はクライアントが localStorage で保持し、
 * 生成リクエストの recentGenres として往復させる。
 * サーバの varietyEngine がこれを回避してジャンルを抽選する。
 *
 * 新しいものほど配列の先頭。最大 MAX 件（おおよそ直近3バッチ分）。
 */

const STORAGE_KEY = "ipm_recent_genres_v1";
const MAX = 12;

/** 直近ジャンルID配列を読み込む（新しい順）。壊れていたら空配列。 */
export function getRecentGenres(): string[] {
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
 * 新しく使われたジャンルIDを履歴の先頭に追加する。
 * 同一バッチ内の重複は除去し、既存の同IDも前方へ繰り上げる（最近性を反映）。
 */
export function pushRecentGenres(ids: string[]): void {
  try {
    const fresh = ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (fresh.length === 0) return;
    const prev = getRecentGenres();
    // 新規（バッチ内重複除去）→ 既存 の順で連結し、ID重複を前方優先で除去
    const merged: string[] = [];
    for (const id of [...fresh, ...prev]) {
      if (!merged.includes(id)) merged.push(id);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, MAX)));
  } catch {
    // localStorage 不可（プライベートブラウジング等）は無視
  }
}

/** 履歴をクリアする（デバッグ・設定リセット用）。 */
export function clearRecentGenres(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}
