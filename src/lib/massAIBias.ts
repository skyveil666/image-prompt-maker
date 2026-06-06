/**
 * massAIBias — 量産AI回避メーター（#6）。
 *
 * 生成プロンプトが「よくある量産AI画像っぽい表現」に寄りすぎていないかを
 * カテゴリ別に検出してスコア化する。提案・表示のみ（自動修正しない）。
 */

import { BIAS_CATEGORIES, BIAS_LABEL, matchWords } from "./categoryKeywords";

export type MassAILevel = "low" | "medium" | "high" | "danger";

export interface MassAIResult {
  /** 0(個性的)〜100(かなりテンプレ) */
  totalScore: number;
  level: MassAILevel;
  categories: {
    blackGothic: number;
    blueNeon: number;
    cyberBackground: number;
    crystal: number;
    dress: number;
  };
  matchedWords: string[];
  warnings: string[];
  suggestions: string[];
}

// ── カテゴリ別の検出語は categoryKeywords.ts に集約（単一ソース） ──────────────
const DICT = BIAS_CATEGORIES;
const CAT_LABEL = BIAS_LABEL;

/** 各カテゴリの改善置換案 */
const CAT_SUGGEST: Record<keyof MassAIResult["categories"], string> = {
  blackGothic: "黒ゴシック要素を減らし、素材感・生活感・現代ストリート要素に置き換える",
  blueNeon: "青ネオンを避け、暖色光・自然光・反射光・フィルム調に置き換える",
  cyberBackground: "サイバー背景ではなく、実在感のある都市・屋内・自然・店舗・展示空間に変える",
  crystal: "クリスタルではなく、水滴・布・紙・ガラス・煙・影・反射などに変える",
  dress: "ドレスではなく、レイヤード・テックウェア・古着・スポーツラグジュアリー・モードストリートに変える",
};

const countHits = matchWords;

/** カテゴリ偏りの強さ（0-100）を語句ヒット数から算出 */
function catScore(hits: number): number {
  if (hits <= 0) return 0;
  if (hits === 1) return 35;
  if (hits === 2) return 65;
  return 90;
}

export function biasStrengthLabel(score: number): "強" | "中" | "弱" | "なし" {
  if (score >= 65) return "強";
  if (score >= 35) return "中";
  if (score > 0) return "弱";
  return "なし";
}

export function analyzeMassAIBias(prompt: string): MassAIResult {
  const matchedWords: string[] = [];
  const categories = {} as MassAIResult["categories"];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  (Object.keys(DICT) as (keyof typeof DICT)[]).forEach((cat) => {
    const hits = countHits(prompt, DICT[cat]);
    matchedWords.push(...hits);
    const s = catScore(hits.length);
    categories[cat] = s;
    if (s >= 65) {
      warnings.push(`${CAT_LABEL[cat]}に強く寄っています`);
      suggestions.push(CAT_SUGGEST[cat]);
    } else if (s >= 35) {
      suggestions.push(CAT_SUGGEST[cat]);
    }
  });

  // 総合：最大カテゴリを重く、複数カテゴリ重なりも加点
  const values = Object.values(categories);
  const max = Math.max(0, ...values);
  const activeCount = values.filter((v) => v >= 35).length;
  const totalScore = Math.min(100, Math.round(max * 0.7 + activeCount * 12));

  const level: MassAILevel =
    totalScore >= 80 ? "danger" : totalScore >= 55 ? "high" : totalScore >= 30 ? "medium" : "low";

  return {
    totalScore,
    level,
    categories,
    matchedWords: Array.from(new Set(matchedWords)),
    warnings,
    suggestions: Array.from(new Set(suggestions)),
  };
}

export function massAILevelLabel(level: MassAILevel): string {
  return {
    low: "✅ 個性あり",
    medium: "🟡 少し量産AI寄り",
    high: "⚠️ 量産AI感が強い",
    danger: "❌ かなりテンプレ寄り",
  }[level];
}
