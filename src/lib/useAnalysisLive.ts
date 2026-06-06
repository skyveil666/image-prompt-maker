/**
 * useAnalysisLive — AI分析ライブビューの状態管理フック
 *
 * 分析を「見える化」するための状態と、更新用メソッドを提供する。
 * 実際の分析ロジックには干渉せず、状態の記録・表示だけを行う。
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { AnalysisEvidence, AnalysisLiveState, AnalysisStepId } from "./analysisLiveTypes";
import {
  ANALYSIS_STEP_ORDER,
  ANALYSIS_STEP_LABELS,
  LIVE_LOG_MAX,
  createInitialLiveState,
} from "./analysisLiveTypes";

let logSeq = 0;

function nowStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

function calcProgress(steps: AnalysisLiveState["steps"]): number {
  const total = steps.length;
  if (total === 0) return 0;
  const done = steps.filter((s) => s.status === "done").length;
  const running = steps.find((s) => s.status === "running");
  const runningBonus = running ? running.progress / 100 : 0;
  return Math.min(100, Math.round(((done + runningBonus) / total) * 100));
}

export interface AnalysisLiveAPI {
  state: AnalysisLiveState;
  /** 分析を開始する。triggerLabel = 「何の分析か」の表示名 */
  start: (triggerLabel: string, counts?: Partial<AnalysisLiveState["targetCounts"]>) => void;
  /** ステップを開始 */
  startStep: (id: AnalysisStepId, message?: string, sourceCount?: number) => void;
  /** ステップを完了 */
  completeStep: (id: AnalysisStepId, message?: string) => void;
  /** ステップをエラー */
  errorStep: (id: AnalysisStepId, message: string) => void;
  /** ステップ内の進捗（0-100）だけ更新 */
  setStepProgress: (id: AnalysisStepId, progress: number) => void;
  /** ログを1件追加（上限 LIVE_LOG_MAX） */
  addLog: (level: "info" | "success" | "warning" | "error", message: string) => void;
  /** 根拠（Evidence）を追加 */
  addEvidence: (ev: Omit<AnalysisEvidence, "id">) => void;
  /** 全体完了 */
  complete: (message?: string) => void;
  /** エラー終了 */
  error: (message: string) => void;
  /** 状態をリセット */
  reset: () => void;
}

export function useAnalysisLive(): AnalysisLiveAPI {
  const [state, setState] = useState<AnalysisLiveState>(createInitialLiveState);
  // ログバッチ用 ref（短時間に複数ログが来ても1回の setState にまとめる）
  const pendingLogsRef = useRef<AnalysisLiveState["logs"]>([]);
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushLogs = useCallback(() => {
    const batch = pendingLogsRef.current;
    pendingLogsRef.current = [];
    if (batch.length === 0) return;
    setState((prev) => {
      const combined = [...prev.logs, ...batch];
      return { ...prev, logs: combined.slice(-LIVE_LOG_MAX) };
    });
  }, []);

  const addLog = useCallback((level: "info" | "success" | "warning" | "error", message: string) => {
    pendingLogsRef.current.push({
      id: `log-${Date.now()}-${++logSeq}`,
      timestamp: Date.now(),
      level,
      message: `[${nowStr()}] ${message}`,
    });
    if (!logTimerRef.current) {
      logTimerRef.current = setTimeout(() => {
        logTimerRef.current = null;
        flushLogs();
      }, 60);
    }
  }, [flushLogs]);

  const start = useCallback((triggerLabel: string, counts: Partial<AnalysisLiveState["targetCounts"]> = {}) => {
    addLog("info", `分析開始：${triggerLabel}`);
    setState(() => ({
      ...createInitialLiveState(),
      status: "running",
      triggerLabel,
      startedAt: Date.now(),
      targetCounts: {
        history: counts.history ?? 0,
        images: counts.images ?? 0,
        favorites: counts.favorites ?? 0,
        ratings: counts.ratings ?? 0,
        failureMemos: counts.failureMemos ?? 0,
      },
      logs: [],
    }));
  }, [addLog]);

  const startStep = useCallback((id: AnalysisStepId, message?: string, sourceCount?: number) => {
    const label = ANALYSIS_STEP_LABELS[id];
    addLog("info", message ?? `${label}...`);
    setState((prev) => {
      const steps = prev.steps.map((s) => {
        if (s.id === id) return { ...s, status: "running" as const, progress: 0, startedAt: Date.now(), message, sourceCount };
        // 前のステップが running のままなら done に変更
        if (s.status === "running" && ANALYSIS_STEP_ORDER.indexOf(s.id) < ANALYSIS_STEP_ORDER.indexOf(id)) {
          return { ...s, status: "done" as const, progress: 100, finishedAt: Date.now() };
        }
        return s;
      });
      return { ...prev, currentStepId: id, steps, overallProgress: calcProgress(steps) };
    });
  }, [addLog]);

  const completeStep = useCallback((id: AnalysisStepId, message?: string) => {
    const label = ANALYSIS_STEP_LABELS[id];
    addLog("success", message ?? `${label}が完了`);
    setState((prev) => {
      const steps = prev.steps.map((s) =>
        s.id === id
          ? { ...s, status: "done" as const, progress: 100, finishedAt: Date.now(), message }
          : s,
      );
      return { ...prev, steps, overallProgress: calcProgress(steps) };
    });
  }, [addLog]);

  const errorStep = useCallback((id: AnalysisStepId, message: string) => {
    addLog("error", `[エラー] ${message}`);
    setState((prev) => {
      const steps = prev.steps.map((s) =>
        s.id === id ? { ...s, status: "error" as const, message } : s,
      );
      return { ...prev, steps, status: "error", errorMessage: message };
    });
  }, [addLog]);

  const setStepProgress = useCallback((id: AnalysisStepId, progress: number) => {
    setState((prev) => {
      const steps = prev.steps.map((s) =>
        s.id === id ? { ...s, progress: Math.min(100, progress) } : s,
      );
      return { ...prev, steps, overallProgress: calcProgress(steps) };
    });
  }, []);

  const addEvidence = useCallback((ev: Omit<AnalysisEvidence, "id">) => {
    const full: AnalysisEvidence = { ...ev, id: `ev-${Date.now()}` };
    addLog("info", `根拠を記録：${ev.title}`);
    setState((prev) => ({ ...prev, evidences: [...prev.evidences, full] }));
  }, [addLog]);

  const complete = useCallback((message?: string) => {
    addLog("success", message ?? "分析完了");
    setState((prev) => ({
      ...prev,
      status: "completed",
      currentStepId: "complete",
      overallProgress: 100,
      finishedAt: Date.now(),
      steps: prev.steps.map((s) =>
        s.status !== "error"
          ? { ...s, status: "done" as const, progress: 100, finishedAt: s.finishedAt ?? Date.now() }
          : s,
      ),
    }));
  }, [addLog]);

  const error = useCallback((message: string) => {
    addLog("error", `分析エラー：${message}`);
    setState((prev) => ({ ...prev, status: "error", errorMessage: message, finishedAt: Date.now() }));
  }, [addLog]);

  const reset = useCallback(() => {
    pendingLogsRef.current = [];
    setState(createInitialLiveState());
  }, []);

  // BUG-6: 戻り値を useMemo で安定化。各メソッドは useCallback で安定なので、
  // この API オブジェクトは state 変化時のみ新参照になる（毎レンダリングでの不要な再生成・
  // 依存連鎖の effect 空回りを防ぐ）。
  return useMemo(
    () => ({ state, start, startStep, completeStep, errorStep, setStepProgress, addLog, addEvidence, complete, error, reset }),
    [state, start, startStep, completeStep, errorStep, setStepProgress, addLog, addEvidence, complete, error, reset],
  );
}
