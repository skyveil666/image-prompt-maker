import type { Count } from "../../types";

interface GenerationActionBarProps {
  count: Count;
  onCountChange: (count: Count) => void;
  canGenerate: boolean;
  generating: boolean;
  justCompleted: boolean;
  onGenerate: () => void;
}

/** 案数セレクタ＋生成ボタン（App.tsx の GlobalProtectionBar actions スロットから純移設・表示専用）。
 *  生成ロジック・Ctrl+Enter は App 側（onGenerate=handleGenerate を参照渡し）で不変。 */
export function GenerationActionBar({
  count,
  onCountChange,
  canGenerate,
  generating,
  justCompleted,
  onGenerate,
}: GenerationActionBarProps) {
  return (
    <>
      {/* 案数 */}
      <div className="flex items-center gap-1.5 select-none">
        <span className="text-[10px] text-text-muted/50 shrink-0">案数</span>
        <div className="flex gap-1">
          {([2, 3, 4, 5, 6] as Count[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCountChange(c)}
              className={[
                "w-6 h-6 rounded-md text-[11px] font-bold border transition leading-none",
                count === c
                  ? "border-accent/80 bg-accent/25 text-white shadow-[0_0_6px_rgba(139,92,246,0.4)]"
                  : "border-[#252e44] bg-transparent text-white/45 hover:border-accent/40 hover:text-white/80",
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {/* ✨ 生成ボタン（コンパクト・機能と Ctrl+Enter は不変） */}
      <button
        type="button"
        disabled={!canGenerate || generating}
        onClick={onGenerate}
        className={[
          "inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-[13px]",
          "transition-all duration-300 select-none shrink-0",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          justCompleted
            ? "bg-emerald-500 text-white hover:bg-emerald-400"
            : canGenerate
              ? "bg-accent text-white hover:bg-accent-hover"
              : "bg-[#1a2030] text-white/40",
        ].join(" ")}
      >
        {generating ? (
          <>
            <span className="inline-block animate-spin leading-none">⟳</span>
            生成中…
          </>
        ) : justCompleted ? (
          "✅ 完了！"
        ) : (
          <>
            ✨ プロンプトを生成
            <span className="text-[10px] font-normal opacity-50 ml-0.5 hidden lg:inline">Ctrl+↵</span>
          </>
        )}
      </button>
    </>
  );
}
