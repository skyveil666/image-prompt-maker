import type { GeneratedProposal, PromptInputs } from "../types";
import { applyNgGate } from "./ngGate";
import { tagNgToBgExclude } from "../data/tagNgOptions";

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

/**
 * 失敗レスポンス(res.ok===false)から診断用の詳細文字列を抽出する共通ヘルパ。
 * Body は1度しか読めないので text() で取ってから JSON 試行（BUG-11 と同方式）。
 * safetyCategories があれば NEGLIGIBLE/LOW を除いて追記（診断用表示・フィルタ回避には使わない）。
 * 呼び出し側は固有のプレフィックスを付けて throw する:
 *   const detail = await extractBackendError(res);
 *   throw new Error(`...に失敗しました (${res.status}): ${detail || "unknown"}`);
 */
async function extractBackendError(res: Response): Promise<string> {
  let detail = "";
  try {
    const raw = await res.text();
    try {
      const j = JSON.parse(raw) as BackendError;
      detail = j.error || raw;
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
  return detail;
}

export async function generateViaBackend(
  inputs: PromptInputs,
  imageDataUrl: string | null,
  recentGenres: string[] = [],
  recentSubStyles: string[] = [],
  rawNgList = "",
  forbiddenTokens: string[] = [],
  tagNg: string[] = []
): Promise<BackendResponse> {
  // 🔒 NG出口一括適用：/api/generate への唯一の送信関数。どの経路（runGenerate /
  //    インラインアレンジ）を通っても、fetch 直前に NG を冪等復元する。送信はこの1回が唯一の真実。
  // 🚫 ①tagNg分離：タグ個別NG(tagNg) は【NG】(ngList) へ合流させない。
  //    【NG】はユーザーの手動NG欄(rawNgList)のみ＝既存どおり維持。
  const gated = applyNgGate(inputs, rawNgList, forbiddenTokens);
  // 🚫 ②候補除外：tagNg → 背景候補の事前除外 id（place/style）。サーバの「背景バリエーション指示」が
  //    参照して NG済みの場所/スタイルを積極採用リストから外す（本文の【NG】とは別経路・読み取り専用派生）。
  const ngExclude = tagNgToBgExclude(tagNg);
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
      details: gated.details,
      extraInstructions: gated.extraInstructions,
      faceLock: inputs.faceLock,
      ngList: gated.ngList,
      ngExclude,
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
    const detail = await extractBackendError(res);
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
    const detail = await extractBackendError(res);
    throw new Error(`抽出に失敗しました (${res.status}): ${detail || "unknown"}`);
  }
  const data = (await res.json()) as ReferenceExtractResponse;
  return { elements: data.elements ?? {}, missingRequired: data.missingRequired ?? [] };
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
    const detail = await extractBackendError(res);
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
    const detail = await extractBackendError(res);
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
