import { useEffect, useRef, type MutableRefObject } from "react";

/**
 * 値を常に最新に保つ ref を返す共通フック。
 * `const xRef = useRef(x); useEffect(() => { xRef.current = x; }, [x]);` の定番を集約する。
 *
 * 用途: runGenerate / buildInputs など「deps 非依存で最新 state を読みたい」コールバックから、
 * stale closure を避けて最新値を参照するため。更新タイミングは従来どおり
 * 「コミット後の useEffect」を厳守するので挙動は不変。
 *
 * 注意: state より前で ref を宣言し、後から別 effect で同期したいケース
 * （TDZ 回避の前方宣言。例: preferenceProfileRef / skyveilProfileRef）は、
 * 宣言地点で値を渡せないため対象外（従来どおり手動 useRef + useEffect を使う）。
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
