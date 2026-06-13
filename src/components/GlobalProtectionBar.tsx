import { useState } from "react";
import type { ReactNode } from "react";
import type { IdentityRiskResult, IdentityRiskLevel } from "../lib/identityRisk";

/**
 * GlobalProtectionBar — 生成前の「顔・同一性状態」と「Identity Shield」の常時表示バー（読み取り専用）。
 *
 * 役割（Phase 3 / docs/18 で「顔・同一性 + Identity Shield」に専念）:
 *   - GlobalProtectionBar = 顔・同一性のロック状態 + Identity Shield のライブリスク
 *   - 変更対象（scopes）・守るもの（体型/色味/構図）の表示は ReflectionStatusBar に一本化（単一ソース）
 *   - 詳細な分析は AnalysisStatusStrip / AnalysisLiveView、生成後の結果は PromptGuardSection が担当
 *
 * 折りたたみ時でも以下2項目を常時表示:
 *   🛡 顔・同一性 / ⚠ Identity Shield
 * 詳細（Identity Shield 採点理由・注意・安全提案）は展開時のみ。
 */

type LevelStyle = {
  label: string;
  icon: string;
  text: string;
  bg: string;
  border: string;
  dot: string;
};

const LEVEL_STYLE: Record<IdentityRiskLevel, LevelStyle> = {
  low: {
    label: "LOW", icon: "🛡",
    text: "text-emerald-200", bg: "bg-emerald-500/12", border: "border-emerald-400/35", dot: "bg-emerald-400",
  },
  medium: {
    label: "MEDIUM", icon: "🛡",
    text: "text-sky-200", bg: "bg-sky-500/12", border: "border-sky-400/35", dot: "bg-sky-400",
  },
  high: {
    label: "HIGH", icon: "⚠",
    text: "text-amber-200", bg: "bg-amber-500/14", border: "border-amber-400/40", dot: "bg-amber-400",
  },
  danger: {
    label: "DANGER", icon: "🚨",
    text: "text-rose-200", bg: "bg-rose-500/14", border: "border-rose-400/45", dot: "bg-rose-400",
  },
};

interface Props {
  faceLock: boolean;
  /** analyzeIdentityRisk("", currentLock) の結果（設定ベースのライブ採点） */
  risk: IdentityRiskResult;
  /** 左端ブランド（IPMアイコン＋アプリ名）。UI配置のみ・保護ロジックには無関係。 */
  brand?: ReactNode;
  /** ブランド横の接続状況（Gemini）。UI配置のみ・保護ロジックには無関係。 */
  connection?: ReactNode;
  /** P4: 上部1段統合。ヘッダ行に内包する AI分析の要約（🤖 分析 N件・最新 等） */
  analysisSummary?: ReactNode;
  /** P4: 展開時に表示する AI分析の詳細（5分析チップ＋ライブビュー誘導） */
  analysisDetail?: ReactNode;
  /** ヘッダー右側に固定表示する操作群（出力先/案数/✨生成）。UI配置のみ・生成ロジックには無関係。 */
  actions?: ReactNode;
}

export function GlobalProtectionBar({ faceLock, risk, brand, connection, analysisSummary, analysisDetail, actions }: Props) {
  const [open, setOpen] = useState(false);
  const lvl = LEVEL_STYLE[risk.level];

  return (
    <div className="sticky top-0 z-40 mb-3">
      <div className={[
        "rounded-2xl border backdrop-blur-md transition-colors",
        faceLock ? "border-emerald-500/40 bg-[#0f1218]/95" : "border-amber-500/45 bg-[#0f1218]/95",
      ].join(" ")}>
        {/* ── 常時表示（ブランド / Gemini接続 / AI分析要約 / 生成アクション） ─────── */}
        <div className="flex items-center gap-2 px-3 py-2 flex-wrap">

          {/* ブランド（IPMアイコン＋アプリ名）：左端。UI配置のみ。 */}
          {brand}

          {/* Gemini接続状況：ブランド横。UI配置のみ。 */}
          {connection}

          {/* AI分析の要約（P4：上部1段統合。区切り＋🤖 分析 N件・最新） */}
          {analysisSummary && (
            <>
              <span className="text-text-muted/30 leading-none select-none hidden sm:inline">｜</span>
              {analysisSummary}
            </>
          )}

          {/* ✨ 生成アクション（出力先/案数/✨生成）：ヘッダー右側に固定表示。
              ヘッダー行は flex-wrap なので狭い画面では自動で2段目へ折り返す。 */}
          {actions && (
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              {actions}
            </div>
          )}

          {/* 詳細トグル */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={[
              actions ? "" : "ml-auto",
              "shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border transition",
              open
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-[#252e44] text-text-muted/60 hover:border-accent/40 hover:text-text-base",
            ].join(" ")}
          >
            <span>詳細</span>
            <span className="text-[9px] leading-none">{open ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* ── 展開時のみ：AI分析詳細 + 顔・同一性 + Identity Shield の詳細 ─────────── */}
        {open && (
          <div className="border-t border-bg-border/30 px-3 py-2.5 space-y-2.5">

            {/* AI分析の詳細（P4：詳細クリック時のみ5分析を表示） */}
            {analysisDetail && (
              <div className="pb-2 border-b border-bg-border/30">
                {analysisDetail}
              </div>
            )}

            {/* 顔・同一性 / Identity Shield バッジ（生成バー常時行から移設） */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* ① 顔・同一性 */}
              <div className={[
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 border shrink-0",
                faceLock ? "border-emerald-400/35 bg-emerald-500/10" : "border-amber-400/40 bg-amber-500/10",
              ].join(" ")}>
                <span className="text-[13px] leading-none">🛡</span>
                <span className="text-[11px] text-text-muted/70 leading-none">顔・同一性</span>
                <span className={[
                  "text-[12px] font-bold leading-none tabular-nums",
                  faceLock ? "text-emerald-200" : "text-amber-200",
                ].join(" ")}>
                  {faceLock ? "ON" : "OFF"}
                </span>
              </div>

              {/* ② Identity Shield */}
              <div className={["flex items-center gap-1.5 rounded-lg px-2.5 py-1 border shrink-0", lvl.bg, lvl.border].join(" ")}>
                <span className="text-[13px] leading-none">{lvl.icon}</span>
                <span className="text-[11px] text-text-muted/70 leading-none">Identity&nbsp;Shield</span>
                <span className="inline-flex items-center gap-1 leading-none">
                  <span className={["inline-block w-1.5 h-1.5 rounded-full", lvl.dot].join(" ")} />
                  <span className={["text-[12px] font-bold leading-none", lvl.text].join(" ")}>{lvl.label}</span>
                  <span className="text-[10px] text-text-muted/55 tabular-nums leading-none">{risk.score}</span>
                </span>
              </div>
            </div>

            {/* 顔・同一性 */}
            <p className="text-[12px] text-text-base/90 leading-snug">
              <span className="font-semibold text-text-muted/70">🛡 顔・同一性：</span>
              <span className={faceLock ? "text-emerald-200 font-bold" : "text-amber-200 font-bold"}>
                {faceLock ? "「顔ロック」で常時保護中（顔・表情・人物の同一性を固定）" : "顔ロックOFF（顔が変わる可能性あり）"}
              </span>
            </p>

            {/* Identity Shield 理由 */}
            {risk.reasons.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-text-muted/70">{lvl.icon} Identity Shield 採点理由</p>
                <ul className="space-y-0.5">
                  {risk.reasons.map((r, i) => (
                    <li key={`${i}-${r}`} className="text-[11.5px] text-text-base/80 leading-snug">・{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 警告 */}
            {risk.warnings.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-rose-200/85">⚠ 注意</p>
                <ul className="space-y-0.5">
                  {risk.warnings.map((w, i) => (
                    <li key={`${i}-${w}`} className="text-[11.5px] text-rose-200/85 leading-snug">・{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 安全提案 */}
            {risk.safeSuggestions.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-emerald-200/80">💡 安全提案</p>
                <ul className="space-y-0.5">
                  {risk.safeSuggestions.map((s, i) => (
                    <li key={`${i}-${s}`} className="text-[11.5px] text-emerald-100/80 leading-snug">・{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-text-muted/40 leading-snug pt-0.5">
              ※ 変更対象・守るものは「📡 現在の反映状態」に集約。実際の保護は生成時に Identity Shield + Scope Filter が適用します。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
