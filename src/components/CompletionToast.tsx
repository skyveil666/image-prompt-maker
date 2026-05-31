import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface Props {
  /** インクリメントするたびにトーストを1回表示する */
  trigger: number;
  count: number;
}

type Phase = "hidden" | "entering" | "visible" | "leaving";

export function CompletionToast({ trigger, count }: Props) {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    if (trigger === 0) return;

    setPhase("entering");
    // 次フレームで "visible" に遷移 → CSS transition が発火
    const t1 = setTimeout(() => setPhase("visible"),  30);
    // 2.8s 後にフェードアウト開始
    const t2 = setTimeout(() => setPhase("leaving"), 2800);
    // 0.4s 後に DOM から消す
    const t3 = setTimeout(() => setPhase("hidden"),  3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [trigger]);

  if (phase === "hidden") return null;

  const shown = phase === "visible";

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={[
        "fixed top-5 right-5 z-[9999]",
        "flex items-start gap-3 rounded-2xl",
        "border border-emerald-400/40 bg-[#0b1a12]/95 backdrop-blur-md",
        "px-4 py-3.5 min-w-[220px]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(52,211,153,0.12)]",
        "transition-all duration-300 ease-out",
        shown
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 -translate-y-3 scale-95 pointer-events-none",
      ].join(" ")}
    >
      <span className="text-2xl leading-none mt-0.5 shrink-0">✅</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-emerald-200 leading-snug">
          プロンプト生成完了
        </p>
        <p className="text-[13px] text-emerald-300/85 mt-0.5">
          {count}案の生成が完了しました
        </p>
      </div>
    </div>,
    document.body,
  );
}
