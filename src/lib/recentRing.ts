/**
 * 直近使用IDのリングバッファ（localStorage 永続）を生成する共通ファクトリ。
 *
 * genreHistory / subStyleHistory が共有する実装。サーバはステートレスなので、
 * 直近の使用履歴はクライアントが localStorage で保持し、生成リクエストで往復させる。
 * サーバ側（varietyEngine / outfitSubStyles）がこれを回避して抽選する。
 *
 * 新しいものほど配列の先頭。最大 max 件。
 */

export interface RecentRing {
  /** 直近ID配列を読み込む（新しい順）。壊れていたら空配列。 */
  get(): string[];
  /**
   * 新しく使われたIDを履歴の先頭に追加する。
   * 同一バッチ内の重複は除去し、既存の同IDも前方へ繰り上げる（最近性を反映）。
   */
  push(ids: string[]): void;
  /** 履歴をクリアする（デバッグ・設定リセット用）。 */
  clear(): void;
}

/** storageKey と最大件数 max を束ねたリングバッファ操作を返す。 */
export function createRecentRing(storageKey: string, max: number): RecentRing {
  function get(): string[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter((v): v is string => typeof v === "string").slice(0, max);
    } catch {
      return [];
    }
  }

  function push(ids: string[]): void {
    try {
      const fresh = ids.filter((v): v is string => typeof v === "string" && v.length > 0);
      if (fresh.length === 0) return;
      const prev = get();
      // 新規（バッチ内重複除去）→ 既存 の順で連結し、ID重複を前方優先で除去（Setで O(n)）
      const merged = [...new Set([...fresh, ...prev])];
      localStorage.setItem(storageKey, JSON.stringify(merged.slice(0, max)));
    } catch {
      // localStorage 不可（プライベートブラウジング等）は無視
    }
  }

  function clear(): void {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // 無視
    }
  }

  return { get, push, clear };
}
