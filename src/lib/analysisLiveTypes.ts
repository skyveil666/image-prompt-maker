/**
 * AI分析ライブビュー — 型定義
 *
 * ユーザーが「今何を分析しているか・なぜその結果になったか」を
 * リアルタイムで確認できるようにするための状態管理型。
 */

export type AnalysisStepId =
  | "loadHistory"
  | "loadImages"
  | "loadFavorites"
  | "loadRatings"
  | "loadFailureMemos"
  | "duplicateAnalysis"
  | "colorAnalysis"
  | "imageAnalysis"
  | "favoriteAnalysis"
  | "massAiBiasAnalysis"
  | "identityRiskAnalysis"
  | "skyveilPreferenceAnalysis"
  | "suggestionGeneration"
  | "complete";

export const ANALYSIS_STEP_LABELS: Record<AnalysisStepId, string> = {
  loadHistory:              "履歴を読み込み",
  loadImages:               "生成画像を読み込み",
  loadFavorites:            "お気に入りを集計",
  loadRatings:              "評価データを確認",
  loadFailureMemos:         "失敗理由メモを確認",
  duplicateAnalysis:        "重複構成を分析",
  colorAnalysis:            "色傾向を分析",
  imageAnalysis:            "画像傾向を分析",
  favoriteAnalysis:         "お気に入り傾向を分析",
  massAiBiasAnalysis:       "量産AI偏りを分析",
  identityRiskAnalysis:     "同一性リスクを確認",
  skyveilPreferenceAnalysis:"skyveil好み傾向を整理",
  suggestionGeneration:     "次回おすすめ案を生成",
  complete:                 "分析完了",
};

/** 全ステップの表示順 */
export const ANALYSIS_STEP_ORDER: AnalysisStepId[] = [
  "loadHistory",
  "loadImages",
  "loadFavorites",
  "loadRatings",
  "loadFailureMemos",
  "duplicateAnalysis",
  "colorAnalysis",
  "imageAnalysis",
  "favoriteAnalysis",
  "massAiBiasAnalysis",
  "identityRiskAnalysis",
  "skyveilPreferenceAnalysis",
  "suggestionGeneration",
  "complete",
];

export type AnalysisLiveStatus = "idle" | "running" | "completed" | "error";

export type AnalysisLiveStep = {
  id: AnalysisStepId;
  label: string;
  status: "pending" | "running" | "done" | "error";
  progress: number;
  startedAt?: number;
  finishedAt?: number;
  message?: string;
  sourceCount?: number;
};

export type AnalysisLiveLog = {
  id: string;
  timestamp: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
};

export type AnalysisEvidence = {
  id: string;
  title: string;
  conclusion: string;
  sources: {
    type: "history" | "favorite" | "rating" | "failureMemo" | "image" | "tag";
    label: string;
    count: number;
  }[];
};

export type AnalysisLiveState = {
  status: AnalysisLiveStatus;
  /** どの分析を起動したか（表示用） */
  triggerLabel?: string;
  currentStepId?: AnalysisStepId;
  overallProgress: number;
  startedAt?: number;
  finishedAt?: number;
  targetRangeLabel: string;
  targetCounts: {
    history: number;
    images: number;
    favorites: number;
    ratings: number;
    failureMemos: number;
  };
  steps: AnalysisLiveStep[];
  logs: AnalysisLiveLog[];
  evidences: AnalysisEvidence[];
  errorMessage?: string;
};

/** ログ上限 — これを超えたら古い方から削除 */
export const LIVE_LOG_MAX = 100;

/** ステップ一覧の初期状態を生成 */
function makeInitialSteps(): AnalysisLiveStep[] {
  return ANALYSIS_STEP_ORDER.map((id) => ({
    id,
    label: ANALYSIS_STEP_LABELS[id],
    status: "pending",
    progress: 0,
  }));
}

export function createInitialLiveState(): AnalysisLiveState {
  return {
    status: "idle",
    overallProgress: 0,
    targetRangeLabel: "直近90日",
    targetCounts: { history: 0, images: 0, favorites: 0, ratings: 0, failureMemos: 0 },
    steps: makeInitialSteps(),
    logs: [],
    evidences: [],
  };
}
