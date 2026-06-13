import type { GeneratedProposal, PromptInputs } from "../types";

export interface BackendResponse {
  proposals: GeneratedProposal[];
  warnings?: string[];
  retried?: boolean;
}

export interface BackendError {
  error: string;
  /** Gemini 安全フィルタのカテゴリ別スコア（BlockedError 時のみ付く）。
   *  診断用途のみ — フィルタ回避には使わない。 */
  safetyCategories?: Record<string, string>;
}

export async function generateViaBackend(
  inputs: PromptInputs,
  imageDataUrl: string | null,
  recentGenres: string[] = [],
  recentSubStyles: string[] = []
): Promise<BackendResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      recentGenres,
      recentSubStyles,
      scopes: inputs.scopes,
      moods: inputs.moods,
      count: inputs.count,
      locks: inputs.locks,
      safety: inputs.safety,
      details: inputs.details,
      extraInstructions: inputs.extraInstructions,
      faceLock: inputs.faceLock,
      ngList: inputs.ngList,
      viralMode: inputs.viralMode,
      strength: inputs.strength,
      glossLevel: inputs.glossLevel,
      dimensionLevel: inputs.dimensionLevel,
      realismLevel: inputs.realismLevel,
      realismType: inputs.realismType,
      textureOriginal: inputs.textureOriginal,
      textureDisabled: inputs.textureDisabled,
      promptTarget: inputs.promptTarget,
      autoMoodCategories: inputs.autoMoodCategories,
      avoidCliche: inputs.avoidCliche,
      avoidRealBackground: inputs.avoidRealBackground,
      colorStrategy: inputs.colorStrategy,
      artStyle: inputs.artStyle,
      expression: inputs.expression,
      favoriteTraits: inputs.favoriteTraits,
      favoriteStrength: inputs.favoriteStrength,
      zozoTrend: inputs.zozoTrend,
      boosts: inputs.boosts,
      motifControls: inputs.motifControls,
      comboControls: inputs.comboControls,
      windLevel: inputs.windLevel,
      colorControls: inputs.colorControls,
      colorWeights:  inputs.colorWeights,
      imageBias:     inputs.imageBias,
      ratingBias:    inputs.ratingBias,
      preferenceProfile: inputs.preferenceProfile,
    }),
  });

  if (!res.ok) {
    // Body は1度しか読めないので text() で取ってから JSON 試行
    let detail = "";
    try {
      const raw = await res.text();
      try {
        const j = JSON.parse(raw) as BackendError;
        detail = j.error || raw;
        // safetyCategories があればエラーメッセージに追記（診断用表示。LOW/NEGLIGIBLE は除外）
        if (j.safetyCategories && Object.keys(j.safetyCategories).length > 0) {
          const catStr = Object.entries(j.safetyCategories)
            .filter(([, v]) => v !== "NEGLIGIBLE" && v !== "LOW")
            .map(([k, v]) => `${k}:${v}`)
            .join(" / ");
          if (catStr) detail += ` ▶ [${catStr}]`;
        }
      } catch {
        detail = raw;
      }
    } catch { /* noop */ }
    throw new Error(`Backend error (${res.status}): ${detail || "unknown"}`);
  }
  return (await res.json()) as BackendResponse;
}

// ── 参照ピッカー：画像から要素抽出（Gemini Vision・13カテゴリ）───────────────

export interface ReferenceExtractResponse {
  version: number;
  elements: Record<string, string>;
  model: string;
  missingRequired?: string[];
}

/**
 * 参照画像を Gemini Vision で解析し、13カテゴリの要素を抽出する。失敗時は例外。
 */
export async function extractReferenceViaBackend(
  imageDataUrl: string,
): Promise<{ elements: Record<string, string>; missingRequired: string[] }> {
  const res = await fetch("/api/extract-reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  });
  if (!res.ok) {
    // Body は1度しか読めないので text() で取ってから JSON 試行（BUG-11 と同方式）
    let detail = "";
    try {
      const rawText = await res.text();
      try {
        const j = JSON.parse(rawText) as BackendError;
        detail = j.error || rawText;
      } catch {
        detail = rawText;
      }
    } catch { /* noop */ }
    throw new Error(`抽出に失敗しました (${res.status}): ${detail || "unknown"}`);
  }
  const data = (await res.json()) as ReferenceExtractResponse;
  return { elements: data.elements ?? {}, missingRequired: data.missingRequired ?? [] };
}

// ── 生成結果画像の AI 仮評価（Gemini Vision・/api/analyze-result）─────────────

/**
 * 生成結果画像を Gemini Vision で分析し、AI 仮評価（ResultAnalysis）を返す。失敗時は例外。
 * ユーザーが「AI分析」ボタンを押した時だけ呼ぶ（自動実行しない）。
 */
export async function analyzeResultViaBackend(
  imageDataUrl: string,
  context: { prompt?: string; scopes?: string[] } = {},
): Promise<import("../types").ResultAnalysis> {
  const res = await fetch("/api/analyze-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, prompt: context.prompt, scopes: context.scopes }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const rawText = await res.text();
      try { detail = (JSON.parse(rawText) as BackendError).error || rawText; } catch { detail = rawText; }
    } catch { /* noop */ }
    throw new Error(`AI分析に失敗しました (${res.status}): ${detail || "unknown"}`);
  }
  return (await res.json()) as import("../types").ResultAnalysis;
}

// ── Compare Mode：生成結果×参照の一致率採点（Gemini Vision・案1）─────────────

export interface CompareReferenceResponse {
  version: number;
  scores: Record<string, number>;
  reasons?: Record<string, string>;
  resultExtracted: Record<string, string>;
  model: string;
}

/**
 * 生成結果画像と参照6項目テキストを比較し、項目別一致率(0-100)＋生成側抽出を返す。失敗時は例外。
 */
export async function compareReferenceViaBackend(
  resultImageDataUrl: string,
  referenceItems: Record<string, string>,
): Promise<{ scores: Record<string, number>; reasons: Record<string, string>; resultExtracted: Record<string, string> }> {
  const res = await fetch("/api/compare-reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resultImageDataUrl, referenceItems }),
  });
  if (!res.ok) {
    // Body は1度しか読めないので text() で取ってから JSON 試行（BUG-11 と同方式）
    let detail = "";
    try {
      const rawText = await res.text();
      try {
        const j = JSON.parse(rawText) as BackendError;
        detail = j.error || rawText;
      } catch {
        detail = rawText;
      }
    } catch { /* noop */ }
    throw new Error(`一致率の算出に失敗しました (${res.status}): ${detail || "unknown"}`);
  }
  const data = (await res.json()) as CompareReferenceResponse;
  return { scores: data.scores ?? {}, reasons: data.reasons ?? {}, resultExtracted: data.resultExtracted ?? {} };
}

export async function checkBackendHealth(): Promise<{ ok: boolean; model?: string }> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

// ── 好みプロファイル分析（実 Gemini 呼び出し） ────────────────────────

import type { PreferenceSample, PreferenceProfile } from "./preferenceProfile";

export interface AnalyzePreferencesResponse {
  result: {
    likes:    { bg: string; outfit: string; pose: string };
    dislikes: { bg: string; outfit: string; pose: string };
    preferKeywords: string[];
    avoidKeywords:  string[];
    summary: string;
  };
  model: string;
  sampleSize: number;
  generatedAt: number;
}

/**
 * 評価サンプルをサーバへ送り、Gemini Flash で分析して好みプロファイルを得る。
 * 失敗時は例外。
 */
export async function analyzePreferencesViaBackend(
  samples: PreferenceSample[],
): Promise<PreferenceProfile> {
  const res = await fetch("/api/analyze-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ samples }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const errData = await res.json() as BackendError;
      detail = errData.error || "";
    } catch { /* noop */ }
    throw new Error(`Backend error (${res.status}): ${detail || "unknown"}`);
  }
  const data = (await res.json()) as AnalyzePreferencesResponse;
  return {
    version: 1,
    generatedAt: data.generatedAt,
    model: data.model,
    sampleSize: data.sampleSize,
    likes:    data.result.likes,
    dislikes: data.result.dislikes,
    preferKeywords: data.result.preferKeywords,
    avoidKeywords:  data.result.avoidKeywords,
    summary: data.result.summary,
  };
}
