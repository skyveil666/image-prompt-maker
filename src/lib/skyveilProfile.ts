/**
 * skyveil好み学習エージェント — 既存の各分析を1つの「好みプロファイル」に統合する。
 *
 * 設計：新しい学習系統を増やすのではなく、すでにある実データを束ねる“統合ビュー”。
 *   - preferenceProfile : 実 Gemini 分析（好む/嫌う/キーワード/要約）
 *   - favoriteProfile   : お気に入りに多い傾向（traitPhrases）
 *   - ratingAnalysis    : 評価（良い/まあまあ/微妙/失敗）の軸別集計
 *   - imageAnalysis     : 画像分析（頻出＝出すぎ / 未開拓）
 *   - historyAnalysis   : 直近90日の偏り（頻出モチーフ・未開拓ジャンル）
 *
 * 反映の強さ（弱/標準/強）は既存の favoriteStrength(1/2/3) を流用するため、
 * 設定の二重持ちは作らない（単一の真実）。
 */

import type { PreferenceProfile } from "./preferenceProfile";
import type { FavoriteProfile } from "./favoriteProfile";
import type { RatingAnalysis } from "./ratingAnalyzer";
import type { ImageAnalysisResult } from "./imageAnalyzer";
import type { FullHistoryAnalysis } from "./historyAnalyzer";
import type { ReferenceLearning } from "./referenceLearning";

// ── 反映強度（既存 favoriteStrength と相互変換） ─────────────────────────────
export type SkyveilStrength = "weak" | "standard" | "strong";

export const STRENGTH_TO_FAVORITE: Record<SkyveilStrength, number> = {
  weak: 1, standard: 2, strong: 3,
};
export const STRENGTH_LABEL: Record<SkyveilStrength, string> = {
  weak: "弱", standard: "標準", strong: "強",
};
export function favoriteToStrength(n: number): SkyveilStrength {
  if (n <= 1) return "weak";
  if (n >= 3) return "strong";
  return "standard";
}

// ── 統合プロファイル ────────────────────────────────────────────────────────
export interface SkyveilProfile {
  /** 好きな傾向 */
  likes: string[];
  /** 好きだが出すぎ（＝変換して新鮮さを出す候補） */
  overusedButLiked: string[];
  /** 避けたい傾向 */
  avoid: string[];
  /** 未開拓おすすめ */
  underusedRecommended: string[];
  /** 要約（実 Gemini 分析がある時のみ） */
  summary: string;
  /** 何かしら表示できるデータがあるか */
  hasData: boolean;
}

const EMPTY: SkyveilProfile = {
  likes: [], overusedButLiked: [], avoid: [], underusedRecommended: [], summary: "", hasData: false,
};

function dedupe(arr: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const t = (s ?? "").trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** likes/dislikes の {bg,outfit,pose} から「明確な傾向なし」を除いた説明文を集める */
function axisPhrases(obj?: { bg: string; outfit: string; pose: string }): string[] {
  if (!obj) return [];
  return [obj.bg, obj.outfit, obj.pose].filter((s) => s && s !== "明確な傾向なし");
}

export function buildSkyveilProfile(inputs: {
  preferenceProfile?: PreferenceProfile | null;
  favoriteProfile?:   FavoriteProfile | null;
  ratingAnalysis?:    RatingAnalysis | null;
  imageAnalysis?:     ImageAnalysisResult | null;
  historyAnalysis?:   FullHistoryAnalysis | null;
  referenceLearning?: ReferenceLearning | null;
}): SkyveilProfile {
  const { preferenceProfile: pp, favoriteProfile: fp, ratingAnalysis: ra, imageAnalysis: ia, historyAnalysis: ha, referenceLearning: rl } = inputs;

  // 好き：お気に入り傾向 ＋ 実Gemini の好みキーワード/軸説明 ＋ Compare評価(referenceLearning)
  const likes = dedupe([
    ...(fp?.traitPhrases ?? []),
    ...(pp?.preferKeywords ?? []),
    ...axisPhrases(pp?.likes),
    ...(rl?.likes ?? []),
  ], 10);

  // 好きだが出すぎ：お気に入りに多いモチーフ ∩ 直近で頻出
  const favSet = new Set(ha?.favoriteMotifs ?? []);
  const overusedButLiked = dedupe(
    (ha?.topMotifs ?? [])
      .filter((m) => favSet.has(m.motif.label) || m.favoriteCount > 0)
      .map((m) => m.motif.label),
    8,
  );

  // 避けたい：実Gemini の回避キーワード/軸説明 ＋ 評価が低い軸カテゴリ ＋ Compare評価(referenceLearning)
  const avoid = dedupe([
    ...(pp?.avoidKeywords ?? []),
    ...axisPhrases(pp?.dislikes),
    ...(ra?.topAvoid ?? []).map((a) => `${a.axisJp}:${a.cat.jp}`),
    ...(rl?.avoid ?? []),
  ], 10);

  // 未開拓おすすめ：画像分析の未開拓カテゴリ ＋ 未開拓ジャンル
  const underusedRecommended = dedupe([
    ...(ia?.underusedCategories ?? []).map((u) => u.label),
    ...(ha?.untappedGenres ?? []).map((g) => g.label),
  ], 10);

  const summary = pp?.summary ?? "";
  const hasData =
    likes.length > 0 || overusedButLiked.length > 0 || avoid.length > 0 ||
    underusedRecommended.length > 0 || summary.length > 0;

  if (!hasData) return EMPTY;
  return { likes, overusedButLiked, avoid, underusedRecommended, summary, hasData };
}
