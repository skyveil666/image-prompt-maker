import type { PromptHistoryItem } from "../../types";

interface ArrangeSourceBannerProps {
  source: PromptHistoryItem;
  onClear: () => void;
}

/** ✨ アレンジ元プロンプト表示バナー（App.tsx から純移設・表示専用）。 */
export function ArrangeSourceBanner({ source, onClear }: ArrangeSourceBannerProps) {
  return (
    <div className="rounded-xl border border-violet-400/40 bg-violet-400/10 px-3.5 py-2.5 flex items-center gap-2.5 text-xs">
      <span className="text-base shrink-0">✨</span>
      <div className="flex-1 min-w-0">
        <span className="text-violet-200 font-semibold">アレンジ生成中</span>
        <span className="text-text-muted ml-2">
          元プロンプト: 案{source.proposalIndex} ·{" "}
          {new Date(source.createdAt).toLocaleDateString("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-text-muted hover:text-text-base transition"
      >
        ✕
      </button>
    </div>
  );
}
