import { useEffect, useState } from "react";

export type ToastPhase = "hidden" | "entering" | "visible" | "leaving";

interface ToastPhaseOptions {
  /** visible を維持する時間(ms)。これを過ぎると leaving へ。既定 2800。 */
  durationMs?: number;
  /** leaving → hidden の退場アニメ時間(ms)。既定 400。 */
  exitMs?: number;
}

/**
 * trigger をインクリメントするたびに hidden→entering→visible→leaving→hidden の
 * 4フェーズを進めるトースト共通フック。
 * CompletionToast / PresetAppliedToast が共有する状態機械（位置・色・本文は各コンポ側）。
 *
 * 返り値: phase（生フェーズ）/ mounted（DOMに出すか = phase!=="hidden"）/ visible（表示中か）。
 */
export function useToastPhase(
  trigger: number,
  { durationMs = 2800, exitMs = 400 }: ToastPhaseOptions = {},
): { phase: ToastPhase; mounted: boolean; visible: boolean } {
  const [phase, setPhase] = useState<ToastPhase>("hidden");

  useEffect(() => {
    if (trigger === 0) return;
    setPhase("entering");
    // 次フレームで visible に遷移 → CSS transition 発火
    const t1 = setTimeout(() => setPhase("visible"), 30);
    const t2 = setTimeout(() => setPhase("leaving"), durationMs);
    const t3 = setTimeout(() => setPhase("hidden"), durationMs + exitMs);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // durationMs/exitMs は使用箇所では定数。trigger 発火時のみ起動させる。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return { phase, mounted: phase !== "hidden", visible: phase === "visible" };
}
