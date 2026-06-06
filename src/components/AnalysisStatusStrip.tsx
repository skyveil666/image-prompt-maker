import { useEffect, useState } from "react";
import type { AnalysisLiveState, AnalysisStepId } from "../lib/analysisLiveTypes";

/**
 * AnalysisStatusStrip — 5分析の「今・鮮度」表示（読み取り専用）。
 *
 * Phase 4（上部 sticky 1段統合）:
 *   - variant="summary" : `🤖 分析 N件・最新/分析中` の 1 チップ（GlobalProtectionBar のヘッダ行に内包）
 *   - variant="detail"  : 5分析のチップ一覧（dot+絵文字+件数・鮮度）＋ライブビュー誘導（GPB 展開内に内包）
 *   詳細（13ステップ/ログ/根拠）は AnalysisLiveView に委譲。
 *
 * 不変条件: 分析ロジックには干渉しない（既存 state を props で受けて表示するだけ）。
 */

export interface AnalysisCategoryView {
  key: "duplicate" | "color" | "image" | "favorite" | "skyveil";
  icon: string;
  label: string;
  /** 件数表示（"312" / "135/135" など）。null = 未実行 */
  count: string | null;
  /** 最終実行時刻（unix ms）。null = 未実行 */
  at: number | null;
}

interface Props {
  /** 既存 useAnalysisLive の state（実行中ステップ取得用） */
  live: AnalysisLiveState;
  /** 5分析の件数・鮮度（App.tsx の既存 state から算出して渡す） */
  categories: AnalysisCategoryView[];
  /** 表示モード（summary=要約1チップ / detail=5チップ一覧） */
  variant?: "summary" | "detail";
  /** AnalysisLiveView の開閉状態（detail の ▲/▼ 表示用） */
  detailOpen?: boolean;
  /** ライブビュー押下時：AnalysisLiveView の開閉をトグル（detail のみ） */
  onDetail?: () => void;
}

/** 実行中ステップ → 5カテゴリへのマッピング */
const STEP_TO_CATEGORY: Partial<Record<AnalysisStepId, AnalysisCategoryView["key"]>> = {
  duplicateAnalysis:        "duplicate",
  massAiBiasAnalysis:       "duplicate",
  colorAnalysis:            "color",
  imageAnalysis:            "image",
  loadImages:               "image",
  favoriteAnalysis:         "favorite",
  loadFavorites:            "favorite",
  skyveilPreferenceAnalysis:"skyveil",
  suggestionGeneration:     "skyveil",
  loadRatings:              "skyveil",
};

function relTime(at: number | null, now: number): string {
  if (at == null) return "未実行";
  const diff = Math.max(0, now - at);
  const s = Math.floor(diff / 1000);
  if (s < 10) return "たった今";
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return d === 1 ? "昨日" : `${d}日前`;
}

export function AnalysisStatusStrip({ live, categories, variant = "summary", detailOpen = false, onDetail }: Props) {
  // 相対時刻ラベルを生かすための軽量ティッカー（30秒・表示専用。分析ロジックとは無関係）
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const running = live.status === "running";
  const runningCat = running && live.currentStepId ? STEP_TO_CATEGORY[live.currentStepId] : undefined;

  // ── 要約（GPB ヘッダ行に内包：🤖 分析 N件・最新/分析中） ──
  if (variant === "summary") {
    const doneCount = categories.filter((c) => c.at != null && c.count != null).length;
    return (
      <span
        className="inline-flex items-center gap-1 leading-none whitespace-nowrap shrink-0"
        title="AI分析の状態と鮮度（詳細で各分析を表示）"
      >
        <span className="text-[12px] leading-none">🤖</span>
        <span className="text-[11px] font-bold text-cyan-200 leading-none">分析</span>
        {running ? (
          <span className="inline-flex items-center gap-1 leading-none">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] text-cyan-300 leading-none">分析中…</span>
          </span>
        ) : (
          <span className="text-[11px] leading-none">
            <span className="tabular-nums font-bold text-text-base">{doneCount}</span>
            <span className="text-text-muted/70">件・</span>
            <span className={doneCount > 0 ? "text-emerald-300/80" : "text-text-muted/45"}>
              {doneCount > 0 ? "最新" : "未実行"}
            </span>
          </span>
        )}
      </span>
    );
  }

  // ── 詳細（GPB 展開内に内包：5分析チップ＋ライブビュー誘導） ──
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-cyan-200/80">🤖 AI分析（件数・鮮度）</p>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        {categories.map((c) => {
          const isRunning = runningCat === c.key;
          const hasData = c.at != null && c.count != null;
          const dotCls = isRunning
            ? "bg-cyan-400 animate-pulse"
            : hasData ? "bg-emerald-400" : "bg-bg-border";
          return (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 leading-none whitespace-nowrap"
              title={`${c.label}：${c.count ?? "未実行"}${isRunning ? "（分析中）" : c.at != null ? " / " + relTime(c.at, now) : ""}`}
            >
              <span className={["inline-block w-1.5 h-1.5 rounded-full shrink-0", dotCls].join(" ")} />
              <span className="text-[12px] leading-none">{c.icon}</span>
              {isRunning ? (
                <span className="text-[11px] text-cyan-300 leading-none">分析中…</span>
              ) : hasData ? (
                <span className="text-[11px] leading-none">
                  <span className="font-bold text-text-base tabular-nums">{c.count}</span>
                  <span className="text-emerald-300/65"> ・{relTime(c.at, now)}</span>
                </span>
              ) : (
                <span className="text-[10px] text-text-muted/45 leading-none">未実行</span>
              )}
            </span>
          );
        })}
        <button
          type="button"
          onClick={onDetail}
          className={[
            "ml-auto shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border transition leading-none",
            detailOpen
              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
              : "border-[#252e44] text-text-muted/60 hover:border-cyan-400/40 hover:text-text-base",
          ].join(" ")}
          title="ステップ・ログ・根拠を AI分析ライブビューで表示"
        >
          <span>ライブビュー</span>
          <span className="text-[9px] leading-none">{detailOpen ? "▲" : "▼"}</span>
        </button>
      </div>
    </div>
  );
}
