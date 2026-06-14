import type { SuccessPromptPattern } from "../../lib/successPatterns";
import type { LearningApplyPreviewResult } from "../../lib/learningPreview";

interface PatternPreviewBannerProps {
  pattern: SuccessPromptPattern;
  preview: LearningApplyPreviewResult;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 🏆 学習反映差分プレビュー（成功パターン）：反映前に必ず差分確認（App.tsx から純移設・表示専用）。
 *  反映/キャンセルは呼び出し側のコールバックに委譲し、本体は差分の表示のみ。 */
export function PatternPreviewBanner({
  pattern,
  preview,
  onConfirm,
  onCancel,
}: PatternPreviewBannerProps) {
  return (
    <div className="rounded-2xl border border-emerald-400/45 bg-emerald-500/8 px-4 py-3 space-y-2 shadow-[0_0_20px_-4px_rgba(52,211,153,0.3)]">
      <p className="text-[14px] font-bold text-emerald-100">
        学習反映プレビュー — {pattern.title}
      </p>
      {preview.diffs.length > 0 ? (
        <div className="space-y-0.5">
          <p className="text-[12px] text-emerald-200/80 font-semibold">変更予定（反映されます）：</p>
          {preview.diffs.map((d, i) => (
            <p key={i} className="text-[12px] text-text-base/90 leading-snug">
              ・{d.label}（{String(d.before)} → {String(d.after)}）<span className="text-text-muted/60 text-[10px]">Risk:{d.risk}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-text-muted/75">追加される変更対象はありません（すべて現状維持またはブロック）。</p>
      )}
      {preview.blockedDiffs.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[12px] text-rose-200 font-semibold">ブロック（保護対象のため反映不可）：</p>
          {preview.blockedDiffs.map((d, i) => (
            <p key={i} className="text-[12px] text-rose-200/90 leading-snug">⚠️ {d.label} — {d.warning}</p>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!preview.canApply}
          className="rounded-lg px-3 py-1.5 text-[13px] font-bold border border-emerald-400/60 bg-emerald-500/22 text-emerald-50 hover:bg-emerald-500/35 transition disabled:opacity-40 disabled:cursor-not-allowed leading-none"
        >
          ✓ この変更を反映
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-[12px] border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
        >
          キャンセル
        </button>
        <span className="text-[10px] text-text-muted/55 ml-1">※ 反映ボタンを押すまで設定は変わりません</span>
      </div>
    </div>
  );
}
