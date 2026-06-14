import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useToastPhase } from "../lib/useToastPhase";

interface Props {
  /** インクリメントするたびにトーストを1回表示する */
  trigger: number;
  /** 表示するメインメッセージ */
  message: string;
  /** 補足ヒント（省略可）。2行目に小さく表示。 */
  hint?: string;
}

/**
 * プリセット適用時などに上部中央に短時間表示されるトースト通知。
 * CompletionToast（右上）と干渉しないよう top-center に配置。
 */
export function PresetAppliedToast({ trigger, message, hint }: Props) {
  // 状態機械は useToastPhase に共通化（3.8s 表示 + 0.4s 退場）
  const { mounted, visible } = useToastPhase(trigger, { durationMs: 3800 });
  const [shownMsg,  setShownMsg]  = useState("");
  const [shownHint, setShownHint] = useState("");

  // trigger 発火タイミングで message / hint を snapshot（表示中に props が変わっても固定）
  useEffect(() => {
    if (trigger === 0) return;
    setShownMsg(message);
    setShownHint(hint ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={[
        "fixed top-4 left-1/2 -translate-x-1/2 z-[9999]",
        "flex items-start gap-2.5 rounded-xl",
        "border border-accent/35 bg-[#100c1a]/93 backdrop-blur-md",
        "px-4 py-3 min-w-[300px] max-w-[500px]",
        "shadow-[0_6px_24px_rgba(0,0,0,0.45),0_0_14px_rgba(124,92,255,0.12)]",
        "transition-all duration-300 ease-out",
        visible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 -translate-y-2 scale-95 pointer-events-none",
      ].join(" ")}
    >
      <span className="text-base leading-none shrink-0 mt-0.5">✨</span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-accent/90 leading-snug">{shownMsg}</p>
        {shownHint && (
          <p className="text-sm text-text-muted/85 mt-1 leading-snug">{shownHint}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
