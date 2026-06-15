import { useEffect, useRef } from "react";

/**
 * Escape キーで onEscape を呼ぶ共通フック（モーダル/パネルの「閉じる」処理用）。
 *
 * - enabled=false の間はリスナーを張らない（開いている時だけ反応させる）。
 * - onEscape は ref 経由で常に最新を呼ぶため、インライン関数を渡しても
 *   enabled が変わらない限りリスナーは張り替えない。
 *
 * 注意: Escape 以外のキーも同一リスナーで扱うコンポーネント（undo/redo 等の
 * 複合キー）や、入力欄の keydown（ForbiddenTokens）は、Escape だけ切り出すと
 * リスナーが分裂するため対象外。
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const ref = useRef(onEscape);
  useEffect(() => { ref.current = onEscape; }, [onEscape]);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") ref.current(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
