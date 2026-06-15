import type { Count } from "../../types";

interface GenerationSummaryProps {
  scopeLabel: string;
  count: Count;
  outputTargetLabel: string;
  viralMode: boolean;
}

/** 設定サマリー（P4：出力先ラベル・表示専用）。生成プログレスは上部バー(GlobalProtectionBar)へ移設。 */
export function GenerationSummary({
  scopeLabel,
  count,
  outputTargetLabel,
  viralMode,
}: GenerationSummaryProps) {
  return (
    <div className="px-1 space-y-1.5">
      <div className="text-sm text-text-muted flex flex-wrap items-center gap-2">
        <span className="text-text-base font-semibold">{scopeLabel}</span>
        <span>/</span>
        <span>{count}案 ・ 統一プロンプト</span>
        <span className="text-text-muted/60">・ 出力先：{outputTargetLabel}</span>
        {viralMode && (
          <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-500/15 text-rose-200 border border-rose-500/40">
            🔥 一発バズりモード
          </span>
        )}
      </div>
    </div>
  );
}
