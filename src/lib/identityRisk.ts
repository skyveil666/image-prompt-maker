/**
 * identityRisk — 同一性リスク表示（#7）。
 *
 * 顔・キャラクターの同一性が崩れやすい設定になっていないかを判定する。
 * 変更対象の数・危険語句・カメラ/ポーズ/髪変更の組み合わせから算出。
 * 表示・提案のみ（自動変更しない）。
 */

import type { LockState } from "./promptLockCheck";
import { FACE_DANGER } from "./categoryKeywords";

export type IdentityRiskLevel = "low" | "medium" | "high" | "danger";

export interface IdentityRiskResult {
  /** 0(安全)〜100(崩れやすい) */
  score: number;
  level: IdentityRiskLevel;
  reasons: string[];
  warnings: string[];
  safeSuggestions: string[];
}

// 顔を脅かす危険語句は categoryKeywords.ts の FACE_DANGER を使用（単一ソース）

/** 強いアングル指定（顔の見え方が変わりやすい） */
const STRONG_ANGLE = [
  "強いローアングル", "強いハイアングル", "極端なアングル", "煽り", "俯瞰",
  "low angle", "high angle", "drone view", "魚眼", "fisheye",
];

/** 前景が顔にかかる表現 */
const FOREGROUND_ON_FACE = [
  "顔にかかる", "顔の前", "前景が顔", "顔を覆う", "前ボケが顔",
];

function hits(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase()));
}

export function analyzeIdentityRisk(prompt: string, lock: LockState): IdentityRiskResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const ct = lock.changeTargets;
  // 変更対象の数（多いほど顔が崩れやすい）
  const changeCount = Object.values(ct).filter(Boolean).length;
  if (changeCount >= 5) { score += 28; reasons.push(`変更対象が${changeCount}項目と多い`); }
  else if (changeCount === 4) { score += 16; reasons.push("変更対象が4項目"); }

  // 個別の変更（髪・ポーズ・カメラは特に顔に影響）
  if (ct.hair)   { score += 8;  reasons.push("髪型変更ON"); }
  if (ct.pose)   { score += 12; reasons.push("ポーズ変更ON"); }
  if (ct.camera) { score += 12; reasons.push("カメラ変更ON"); }
  if (ct.lighting) { score += 5; }
  if (ct.foreground) { score += 6; }

  // 危険な同時変更（ポーズ＋カメラ＋髪）
  if (ct.pose && ct.camera) { score += 12; reasons.push("ポーズ変更＋カメラ変更が同時"); }
  if (ct.pose && ct.camera && ct.hair) { score += 8; reasons.push("ポーズ・カメラ・髪を同時変更"); }
  if (ct.outfit && ct.hair && ct.background && ct.camera && ct.pose) {
    score += 10; warnings.push("衣装・髪・背景・カメラ・ポーズを同時に変更しています");
  }

  // 強いアングル
  const angle = hits(prompt, STRONG_ANGLE);
  if (angle.length > 0) { score += 12; reasons.push(`強いアングル指定（${angle[0]}）`); }

  // 前景が顔にかかる
  const fg = hits(prompt, FOREGROUND_ON_FACE);
  if (fg.length > 0) { score += 12; warnings.push("前景演出が顔にかかる表現があります"); }

  // 顔の危険語句（最重要）
  const danger = hits(prompt, FACE_DANGER);
  if (danger.length > 0) {
    score += 40;
    warnings.push(`顔・同一性を脅かす表現：${danger.join("・")}`);
  }

  // 顔固定がOFFだと崩れやすい（保護されていない）
  if (!lock.protectedTargets.face) { score += 15; warnings.push("顔固定がOFFです（顔が変わる余地があります）"); }
  else { score = Math.max(0, score - 8); reasons.push("顔固定ONで保護されている"); }

  score = Math.max(0, Math.min(100, score));
  const level: IdentityRiskLevel =
    score >= 70 ? "danger" : score >= 45 ? "high" : score >= 22 ? "medium" : "low";

  // 安全提案（リスクが中以上のとき）
  const safeSuggestions: string[] = [];
  if (level !== "low") {
    safeSuggestions.push("顔・表情・顔の角度は固定する");
    if (ct.camera && ct.pose) safeSuggestions.push("カメラ変更とポーズ変更を同時に強くしすぎない");
    if (ct.foreground) safeSuggestions.push("前景演出は顔に被せない");
    if (ct.hair) safeSuggestions.push("髪型変更を控えめにする");
    safeSuggestions.push("「顔の特徴は完全維持」をプロンプト先頭に強めに入れる");
    if (changeCount > 3) safeSuggestions.push("変更対象を3項目以内に絞る");
  }

  return { score, level, reasons, warnings, safeSuggestions };
}

export function identityLevelLabel(level: IdentityRiskLevel): string {
  return {
    low: "✅ 安全",
    medium: "🟡 やや注意",
    high: "⚠️ 顔崩れリスクあり",
    danger: "❌ 同一性低下の可能性が高い",
  }[level];
}

/** 安全強化の固定文（プロンプト先頭に足す用） */
export function buildIdentitySafetyPreamble(): string {
  return "【最優先固定】顔の特徴・目鼻立ち・表情・人物の同一性・体型・アスペクト比は完全に維持し、一切変更しない。\n";
}
