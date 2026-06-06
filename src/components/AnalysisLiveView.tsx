/**
 * AnalysisLiveView — AI分析ライブビュー
 *
 * 3モード：
 *   compact  … 常時表示。現在のステップ + 進捗バー + 集計数
 *   detail   … ステップ一覧（pending/running/done/error）
 *   log      … ターミナル風ログ（自動スクロール）
 *
 * 軽量性確保：
 *   - ログは最大 LIVE_LOG_MAX 件（フック側で管理）
 *   - アニメーションは CSS のみ（JS setInterval なし）
 *   - 詳細モードは必要時だけ展開
 */

import { useEffect, useRef, useState } from "react";
import type { AnalysisLiveState } from "../lib/analysisLiveTypes";
import { ANALYSIS_STEP_ORDER } from "../lib/analysisLiveTypes";

type ViewMode = "compact" | "detail" | "log";

interface Props {
  state: AnalysisLiveState;
  onRetry?: () => void;
}

const STATUS_COLOR = {
  idle:      "text-text-muted/60",
  running:   "text-cyan-300",
  completed: "text-emerald-300",
  error:     "text-rose-300",
};

const LOG_COLOR = {
  info:    "text-text-muted/80",
  success: "text-emerald-300",
  warning: "text-amber-300",
  error:   "text-rose-300",
};

const LOG_PREFIX = {
  info:    "·",
  success: "✓",
  warning: "⚠",
  error:   "✕",
};

// ステップのアイコン
function stepIcon(status: string): string {
  if (status === "done")    return "✅";
  if (status === "running") return "▶";
  if (status === "error")   return "❌";
  return "⬜";
}

export function AnalysisLiveView({ state, onRetry }: Props) {
  const [mode, setMode] = useState<ViewMode>("compact");
  const [open, setOpen] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ログが追加されたら自動スクロール（logモード時のみ）
  useEffect(() => {
    if (mode === "log" && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.logs, mode]);

  // 分析が始まったらデフォルトで開く
  useEffect(() => {
    if (state.status === "running") setOpen(true);
  }, [state.status]);

  const currentStep = state.steps.find((s) => s.id === state.currentStepId);
  const isIdle = state.status === "idle";

  // idle で何もなければ薄く表示
  if (isIdle && state.logs.length === 0) {
    return (
      <div className="rounded-xl border border-bg-border/40 bg-bg-panel/20 px-3 py-2 flex items-center gap-2">
        <span className="text-[12px]">🤖</span>
        <span className="text-[12px] font-semibold text-text-muted/60">AI分析ライブビュー</span>
        <span className="text-[11px] text-text-muted/40">— 分析待機中</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/4 overflow-hidden">
      {/* ── ヘッダー（常時表示） ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/3 transition text-left"
      >
        <span className="text-[13px]">🤖</span>
        <span className="text-[12px] font-bold text-cyan-200">AI分析ライブビュー</span>
        {state.triggerLabel && (
          <span className="text-[11px] text-text-muted/65 truncate">{state.triggerLabel}</span>
        )}
        {/* ステータスバッジ */}
        <span className={["text-[11px] font-semibold leading-none shrink-0", STATUS_COLOR[state.status]].join(" ")}>
          {state.status === "running" ? "分析中…" : state.status === "completed" ? "完了" : state.status === "error" ? "エラー" : "待機中"}
        </span>
        <span className="ml-auto text-[10px] text-text-muted/45">{open ? "▲" : "▼"}</span>
      </button>

      {/* プログレスバー（常時表示） */}
      {state.status !== "idle" && (
        <div className="h-1 bg-bg-border/40 relative overflow-hidden">
          <div
            className={[
              "h-full transition-all duration-500",
              state.status === "error" ? "bg-rose-500"
              : state.status === "completed" ? "bg-emerald-500"
              : "bg-cyan-500",
            ].join(" ")}
            style={{ width: `${state.overallProgress}%` }}
          />
          {/* 流れる光（running時のみ） */}
          {state.status === "running" && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="h-full w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.8s_ease-in-out_infinite]" />
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="border-t border-cyan-400/15">
          {/* コンパクト情報行 */}
          <div className="px-3 py-2 flex items-center gap-3 flex-wrap">
            {currentStep && state.status === "running" && (
              <span className="text-[12px] text-cyan-200 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {currentStep.label}…
              </span>
            )}
            <span className="text-[11px] text-text-muted/70">
              進行 <span className="text-cyan-300 font-semibold">{state.overallProgress}%</span>
            </span>
            {state.targetCounts.history > 0 && (
              <span className="text-[11px] text-text-muted/60">
                対象：{state.targetRangeLabel} / 履歴{state.targetCounts.history}件
                {state.targetCounts.images > 0 && ` / 画像${state.targetCounts.images}件`}
                {state.targetCounts.ratings > 0 && ` / 評価${state.targetCounts.ratings}件`}
              </span>
            )}
            {/* モード切替ボタン */}
            <div className="ml-auto flex items-center gap-1">
              {(["compact","detail","log"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={[
                    "text-[10px] px-1.5 py-0.5 rounded border leading-none transition",
                    mode === m
                      ? "border-cyan-400/55 bg-cyan-400/15 text-cyan-200"
                      : "border-bg-border/60 text-text-muted/55 hover:text-text-muted/80",
                  ].join(" ")}
                >
                  {m === "compact" ? "概要" : m === "detail" ? "詳細" : "ログ"}
                </button>
              ))}
            </div>
          </div>

          {/* エラー表示 */}
          {state.status === "error" && state.errorMessage && (
            <div className="mx-3 mb-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-2 space-y-1">
              <p className="text-[12px] text-rose-200 font-semibold">⚠️ 分析中にエラーが発生しました</p>
              <p className="text-[11px] text-rose-200/80">{state.errorMessage}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-rose-400/50 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 transition leading-none"
                >
                  🔄 再分析する
                </button>
              )}
            </div>
          )}

          {/* 詳細モード：ステップ一覧 */}
          {mode === "detail" && (
            <div className="mx-3 mb-2 space-y-0.5">
              {ANALYSIS_STEP_ORDER.filter((id) => id !== "complete").map((id) => {
                const step = state.steps.find((s) => s.id === id);
                if (!step) return null;
                const isRunning = step.status === "running";
                return (
                  <div
                    key={id}
                    className={[
                      "flex items-start gap-2 px-2 py-1 rounded-lg text-[11px] transition",
                      isRunning ? "bg-cyan-400/10 border border-cyan-400/30" : "",
                    ].join(" ")}
                  >
                    <span className="shrink-0 mt-0.5">
                      {isRunning
                        ? <span className="inline-block w-3 h-3 text-cyan-300 animate-pulse">▶</span>
                        : <span>{stepIcon(step.status)}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={[
                        "font-medium",
                        step.status === "done" ? "text-emerald-200/90"
                        : step.status === "running" ? "text-cyan-200"
                        : step.status === "error" ? "text-rose-300"
                        : "text-text-muted/50",
                      ].join(" ")}>
                        {step.label}
                      </span>
                      {step.message && step.status !== "pending" && (
                        <span className="text-[10px] text-text-muted/60 ml-1.5">{step.message}</span>
                      )}
                      {step.sourceCount != null && (
                        <span className="text-[10px] text-text-muted/50 ml-1.5">{step.sourceCount}件</span>
                      )}
                    </div>
                    {/* ステップ内進捗バー */}
                    {isRunning && step.progress > 0 && (
                      <div className="w-16 h-1 bg-bg-border/40 rounded-full overflow-hidden shrink-0 self-center">
                        <div className="h-full bg-cyan-400 transition-all" style={{ width: `${step.progress}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ログモード：ターミナル風 */}
          {mode === "log" && (
            <div className="mx-3 mb-2 rounded-lg border border-bg-border/50 bg-bg-base/80 p-2 max-h-48 overflow-y-auto text-[11px] font-mono space-y-0.5">
              {state.logs.length === 0 ? (
                <p className="text-text-muted/40">ログ待機中…</p>
              ) : (
                state.logs.map((log) => (
                  <div key={log.id} className={["flex items-baseline gap-1.5", LOG_COLOR[log.level]].join(" ")}>
                    <span className="shrink-0">{LOG_PREFIX[log.level]}</span>
                    <span className="break-all leading-snug">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          )}

          {/* 根拠パネル（evidences がある時） */}
          {state.evidences.length > 0 && (
            <div className="mx-3 mb-2 space-y-1.5">
              <p className="text-[11px] font-bold text-cyan-200/80">📋 根拠（なぜその結果になったか）</p>
              {state.evidences.map((ev) => (
                <div key={ev.id} className="rounded-lg border border-cyan-400/20 bg-bg-base/40 px-2.5 py-1.5 space-y-0.5">
                  <p className="text-[12px] font-semibold text-text-base leading-snug">{ev.title}</p>
                  <p className="text-[11px] text-cyan-100/80 leading-snug">{ev.conclusion}</p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {ev.sources.map((src, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-400/25 bg-cyan-400/8 text-cyan-200/80 leading-none">
                        {src.label}：{src.count}件
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 完了サマリ */}
          {state.status === "completed" && state.finishedAt && state.startedAt && (
            <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/8 text-[11px] text-emerald-200/85">
              ✅ 分析完了 — {Math.ceil((state.finishedAt - state.startedAt) / 1000)}秒
              {state.evidences.length > 0 && ` / 根拠 ${state.evidences.length}件`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
