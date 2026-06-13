import { useLayoutEffect, useRef } from "react";

interface AutoResizeOptions {
  /** 最小行数。指定時は (minRows × 概算行高20px) を高さの下限にする。未指定なら内容ぴったり。 */
  minRows?: number;
}

/**
 * textarea の高さを内容に合わせて自動調整するフック。
 * 返り値の ref を <textarea> に渡すだけ。value が変わるたびに高さを再計算する
 * （height="auto" にリセット → scrollHeight を採用）。描画前に同期実行するため
 * ちらつきが出ない。minRows 指定時はその行数分を下限とする。
 *
 * 使う側で overflow:hidden（内容ぴったり用）や resize-y（minRows 用）を className/style で付ける。
 */
export function useAutoResizeTextarea(value: string, options: AutoResizeOptions = {}) {
  const { minRows } = options;
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const min = minRows ? minRows * 20 : 0;
    el.style.height = `${Math.max(el.scrollHeight, min)}px`;
  }, [value, minRows]);
  return ref;
}
