import type { PromptHistoryItem } from "../../types";

interface RestoredItemBannerProps {
  item: PromptHistoryItem;
  canGenerate: boolean;
  generating: boolean;
  onGenerate: () => void;
  onClose: () => void;
}

/** 🔁 復元確認バナー：「同じ構成で再生成」後に表示（App.tsx から純移設・表示専用）。
 *  生成・閉じる操作は呼び出し側のコールバックに委譲し、本体は表示のみ。 */
export function RestoredItemBanner({
  item,
  canGenerate,
  generating,
  onGenerate,
  onClose,
}: RestoredItemBannerProps) {
  return (
    <div className="rounded-2xl border border-sky-400/45 bg-sky-500/10 px-4 py-3 flex items-center gap-3 flex-wrap shadow-[0_0_20px_-4px_rgba(56,189,248,0.35)]">
      <span className="text-[18px] shrink-0">🔁</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-sky-100 leading-snug">
          この構成を復元しました
        </p>
        <p className="text-[12px] text-sky-200/70 leading-snug">
          {item.settingsSnapshot
            ? `${new Date(item.createdAt).toLocaleDateString("ja-JP")} 生成 — 変更対象・詳細設定・元画像・全設定を復元しました`
            : `${new Date(item.createdAt).toLocaleDateString("ja-JP")} 生成（古い履歴のため一部設定は復元できません）`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="rounded-lg px-3 py-1.5 text-[13px] font-bold border border-sky-400/65 bg-sky-500/22 text-sky-100 hover:bg-sky-500/35 transition disabled:opacity-50 leading-none"
        >
          🚀 このまま生成
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-[12px] border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
        >
          ✕ 閉じる
        </button>
      </div>
    </div>
  );
}
