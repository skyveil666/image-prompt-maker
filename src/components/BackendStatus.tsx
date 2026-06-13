import { useEffect, useState } from "react";
import { checkBackendHealth } from "../lib/backendClient";

interface Props {
  /** compact=true: ドット＋短いラベルのみ（サイドバー用） */
  compact?: boolean;
  /** prominent=true: カラーバッジ形式（ヘッダーバー用） */
  prominent?: boolean;
}

export function BackendStatus({ compact = false, prominent = false }: Props) {
  const [state, setState] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let active = true;
    const run = async () => {
      const r = await checkBackendHealth();
      if (!active) return;
      if (r.ok) {
        setState("ok");
      } else {
        setState("down");
      }
    };
    void run();
    const id = setInterval(run, 10000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const dot =
    state === "ok"
      ? "bg-emerald-400"
      : state === "down"
      ? "bg-rose-400"
      : "bg-amber-400 animate-pulse";

  const fullLabel =
    state === "ok"
      ? "Nano Banana 接続中"
      : state === "down"
      ? "未起動 — npm run dev:all"
      : "確認中…";

  const shortLabel =
    state === "ok"
      ? "接続中"
      : state === "down"
      ? "未接続"
      : "…";

  // prominent: ヘッダーバー用カラーバッジ
  if (prominent) {
    const badge =
      state === "ok"
        ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40"
        : state === "down"
        ? "bg-rose-500/15 text-rose-300 border border-rose-400/40"
        : "bg-amber-500/15 text-amber-200 border border-amber-400/40";
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-[13px] font-semibold shrink-0 ${badge}`}
        title={fullLabel}
      >
        <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
        <span>Gemini {shortLabel}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 text-[12px] text-text-muted/85 shrink-0"
        title={fullLabel}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="truncate max-w-[90px]">{shortLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 text-[13px] text-text-muted/85"
      title={fullLabel}
    >
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span className="hidden sm:inline truncate max-w-[200px]">{fullLabel}</span>
    </div>
  );
}
