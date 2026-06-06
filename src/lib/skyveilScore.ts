/**
 * skyveilScore — 生成プロンプト案ごとの「skyveil好み適性スコア」を算出する。
 *
 * 重要：このスコアは提案・参考表示のみ。自動でプロンプトを変更してはいけない。
 *       改善案を作っても元プロンプトは上書きしない（ユーザーが反映ボタンを押した時だけ）。
 *
 * スコアはキーワードベースのヒューリスティック（透明・説明可能）。
 */

import type { LockState, PromptValidationResult } from "./promptLockCheck";
import { cleanForbidden, buildLockHeader } from "./promptLockCheck";
import type { SkyveilProfile } from "./skyveilProfile";
import { AI_CLICHE, FACE_DANGER } from "./categoryKeywords";
import type { MassAIResult } from "./massAIBias";

export interface SkyveilScore {
  total: number;
  identitySafety: number;
  lockCompliance: number;
  originality: number;
  trendBalance: number;
  aiBiasAvoidance: number;
  buzzPotential: number;
  reasons: string[];   // 加点理由
  warnings: string[];  // 減点理由（赤系で表示）
}

// ── キーワード辞書（量産AI偏り・顔危険語は categoryKeywords.ts に集約） ──────────

/** 同一性保護を示す加点語 */
const IDENTITY_KEEP = ["同一性", "顔の特徴", "目鼻立ち", "維持", "固定", "人物の一貫性"];
/** 顔を脅かす減点語（共通の FACE_DANGER を使用） */
const FACE_RISK = FACE_DANGER;

/** SNS映え・バズ余地の加点語 */
const BUZZ_WORDS = [
  "ドラマチック", "強いコントラスト", "前景演出", "光演出", "粒子", "インパクト",
  "迫力", "高級感", "ファッション性", "印象的",
];
/** カメラ・構図が具体的（加点） */
const CAMERA_SPECIFIC = ["アングル", "構図", "ローアングル", "ハイアングル", "クローズアップ", "俯瞰", "煽り"];
/** 色が明確（加点） */
const COLOR_SPECIFIC = ["配色", "差し色", "トーン", "カラー", "色"];

function countHits(text: string, words: string[]): { count: number; hits: string[] } {
  const lower = text.toLowerCase();
  const hits = words.filter((w) => lower.includes(w.toLowerCase()));
  return { count: hits.length, hits };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── スコア算出 ───────────────────────────────────────────────────────────────

export function calculateSkyveilScore(args: {
  promptText: string;
  lock: LockState;
  validation: PromptValidationResult;
  profile?: SkyveilProfile | null;
  /** 量産AI分析の結果（あれば再計算せず流用＝偏り検出の重複を排除） */
  massAI?: MassAIResult;
}): SkyveilScore {
  const { promptText, lock, validation, profile, massAI } = args;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // ── 1) 同一性安全度 ─────────────────────────────────────────────
  let identitySafety = 70;
  if (lock.protectedTargets.face || lock.protectedTargets.identity) {
    identitySafety += 15;
    reasons.push("顔・同一性維持ルールが明確");
  }
  const idKeep = countHits(promptText, IDENTITY_KEEP);
  if (idKeep.count >= 2) { identitySafety += 10; reasons.push("同一性維持の表現が含まれている"); }
  const faceRisk = countHits(promptText, FACE_RISK);
  if (faceRisk.count > 0) {
    identitySafety -= 45;
    warnings.push(`顔が変わりそうな表現：${faceRisk.hits.join("・")}`);
  }
  // 指示が多すぎる（行数が多い）と同一性が崩れやすい
  const lineCount = promptText.split(/\r?\n/).filter((l) => l.trim()).length;
  if (lineCount > 16) { identitySafety -= 8; warnings.push("指示が多く、顔・同一性が崩れる余地がある"); }
  identitySafety = clamp(identitySafety);

  // ── 2) ロック遵守度 ─────────────────────────────────────────────
  let lockCompliance = 100;
  for (const w of validation.warnings) {
    lockCompliance -= w.severity === "high" ? 35 : w.severity === "medium" ? 20 : 10;
    warnings.push(w.message);
  }
  const changeCount = Object.values(lock.changeTargets).filter(Boolean).length;
  if (changeCount > 0 && changeCount <= 4) { reasons.push("変更対象が限定されている"); }
  else if (changeCount >= 6) { lockCompliance -= 5; warnings.push("変更対象が多く、保護がゆるい"); }
  if (validation.isValid) reasons.push("保護対象への干渉なし");
  lockCompliance = clamp(lockCompliance);

  // ── 3) オリジナリティ（量産AI回避） ─────────────────────────────
  let originality = 85;
  const cliche = countHits(promptText, AI_CLICHE);
  if (cliche.count > 0) {
    originality -= cliche.count * 15;
    warnings.push(`量産AIパターン：${cliche.hits.join("・")}`);
  } else {
    reasons.push("量産AIっぽさが少ない");
  }
  originality = clamp(originality);

  // ── 4) トレンドバランス（寄りすぎ検出）──
  // massAI（量産AI回避メーター）の結果があれば再キーワード照合せず流用する（重複排除）。
  let trendBalance = 90;
  if (massAI) {
    // massAI.categories は 0-100。寄りが強いほど trendBalance を引く。
    for (const [cat, s] of Object.entries(massAI.categories)) {
      if (s >= 65) { trendBalance -= 18; warnings.push(`${cat}に寄りすぎ`); }
      else if (s >= 35) { trendBalance -= 6; }
    }
  }
  // skyveil の「出すぎ」傾向に一致したら軽く減点
  if (profile?.overusedButLiked?.length) {
    const over = countHits(promptText, profile.overusedButLiked);
    if (over.count > 0) trendBalance -= over.count * 5;
  }
  trendBalance = clamp(trendBalance);

  // ── 5) AIバイアス回避度（massAI 総合を流用） ──
  let aiBiasAvoidance = massAI ? clamp(100 - massAI.totalScore * 0.6) : 80;
  if (cliche.count > 0) aiBiasAvoidance -= cliche.count * 12;
  // 汎用的すぎる（具体語が少ない）と減点
  const specifics = countHits(promptText, [...CAMERA_SPECIFIC, ...COLOR_SPECIFIC, ...BUZZ_WORDS]);
  if (specifics.count <= 1) { aiBiasAvoidance -= 12; warnings.push("指定が汎用的すぎる"); }
  // skyveil の「避けたい」に一致したら減点
  if (profile?.avoid?.length) {
    const av = countHits(promptText, profile.avoid);
    if (av.count > 0) { aiBiasAvoidance -= av.count * 8; warnings.push("避けたい傾向に近い表現がある"); }
  }
  aiBiasAvoidance = clamp(aiBiasAvoidance);

  // ── 6) バズり余地 ───────────────────────────────────────────────
  let buzzPotential = 55;
  const buzz = countHits(promptText, BUZZ_WORDS);
  if (buzz.count >= 2) { buzzPotential += 20; reasons.push("SNS映えする構成"); }
  else if (buzz.count === 1) buzzPotential += 8;
  const cam = countHits(promptText, CAMERA_SPECIFIC);
  if (cam.count >= 1) { buzzPotential += 10; reasons.push("カメラアングルが具体的"); }
  const col = countHits(promptText, COLOR_SPECIFIC);
  if (col.count >= 1) { buzzPotential += 8; reasons.push("色指定が明確"); }
  if (lock.changeTargets.foreground) { buzzPotential += 7; reasons.push("前景演出が変更対象"); }
  if (buzz.count === 0 && cam.count === 0) warnings.push("バズり感が弱い（演出・構図が薄い）");
  buzzPotential = clamp(buzzPotential);

  // skyveil の「好き」に一致したら全体に軽い加点
  if (profile?.likes?.length) {
    const liked = countHits(promptText, profile.likes);
    if (liked.count > 0) reasons.push(`skyveilの好み傾向に近い（${liked.hits.slice(0, 3).join("・")}）`);
  }

  // ── 総合（重み付け：同一性とロック遵守を最重視） ──────────────────
  const total = clamp(
    identitySafety * 0.28 +
    lockCompliance * 0.24 +
    originality * 0.14 +
    trendBalance * 0.12 +
    aiBiasAvoidance * 0.12 +
    buzzPotential * 0.10
  );

  // 重複・短すぎ理由の整理
  return {
    total,
    identitySafety, lockCompliance, originality, trendBalance, aiBiasAvoidance, buzzPotential,
    reasons: Array.from(new Set(reasons)),
    warnings: Array.from(new Set(warnings)),
  };
}

// ── スコアバンド ─────────────────────────────────────────────────────────────

export function scoreBand(total: number): { label: string; tone: "green" | "lime" | "amber" | "orange" | "red" } {
  if (total >= 90) return { label: "🔥 skyveil適性かなり高い", tone: "green" };
  if (total >= 75) return { label: "✨ 良い感じ", tone: "lime" };
  if (total >= 60) return { label: "🟡 普通。改善余地あり", tone: "amber" };
  if (total >= 40) return { label: "⚠️ 方向性が弱い", tone: "orange" };
  return { label: "❌ 再調整推奨", tone: "red" };
}

// ── 改善案（ローカル・ヒューリスティック。元は上書きしない） ──────────────────

/**
 * スコアの警告に基づいて改善案プロンプトを生成する。
 * - 禁止ワードを除去
 * - 先頭に「架空キャラクター＋同一性最優先」の前提文を補強
 * これは『提案』であり、ユーザーが反映ボタンを押すまで元プロンプトは変えない。
 */
export function buildImprovedPrompt(promptText: string, lock: LockState): string {
  const cleaned = cleanForbidden(promptText, lock);
  // 既に前提文が入っていれば二重化しない
  const hasPreamble = /架空(の)?キャラクター|AI(で)?生成/.test(cleaned);
  const preamble = hasPreamble ? "" : buildLockHeader(lock);
  return (preamble + cleaned).trim();
}
