/**
 * reversePrompt — 逆プロンプト生成（#10）。
 *
 * 失敗画像・失敗メモ・各種チェック結果から「次回はこう書くべき」改善案を作る。
 * 元プロンプトを自動上書きしない。反映はユーザーがボタンを押した時だけ。
 * 反映時も保護対象・変更対象・固定設定を最優先する（保護軸の改善案は除外）。
 */

import type { FailureMemo } from "../types";
import type { LockState, PromptValidationResult } from "./promptLockCheck";
import { changedTargetLabels, lockedTargetLabels, cleanForbidden } from "./promptLockCheck";
import type { MassAIResult } from "./massAIBias";
import type { IdentityRiskResult } from "./identityRisk";
import { buildIdentitySafetyPreamble } from "./identityRisk";

export interface ReversePromptResult {
  id: string;
  sourcePromptId: string;
  sourceImageId?: string;
  failureMemoIds: string[];
  failureSummary: string[];
  avoidNextTime: string[];
  strengthenLocks: string[];
  improvedPrompt: string;
  lockReminder: string[];
  massAIAvoidanceSuggestions: string[];
  identitySafetySuggestions: string[];
  createdAt: number;
}

/** 失敗理由 → 「次回避ける表現」「強める固定文」へのマッピング */
const REASON_HINTS: Record<string, { avoid?: string[]; lock?: string }> = {
  "顔が変わった":        { lock: "顔の特徴・目鼻立ち・同一性は完全維持し、一切変更しない。" },
  "同一性が弱い":        { lock: "人物の同一性を最優先で維持する。別人化を禁止する。" },
  "背景が変わった":      { avoid: ["futuristic city", "cyberpunk background", "neon street", "別の背景"], lock: "背景は元画像から一切変更しない。構造・場所・奥行き・色味を完全維持する。" },
  "衣装が違う":          { lock: "衣装は元画像のデザイン・シルエットを維持する。" },
  "髪型が違う":          { lock: "髪型・髪色は元画像から変更しない。" },
  "ポーズが違う":        { lock: "ポーズ・体の向きは元画像を維持する。" },
  "カメラが違う":        { lock: "カメラアングル・構図・画角は元画像を維持する。" },
  "AIっぽい":            { avoid: ["量産AIドレス", "透明シフォン", "フリル大量", "クリスタルまみれ"] },
  "黒ゴシックに寄りすぎ": { avoid: ["black gothic", "gothic dress", "black roses", "cathedral"] },
  "青ネオンに寄りすぎ":  { avoid: ["blue neon", "cyan glow", "neon lights"] },
  "ドレスに寄りすぎ":    { avoid: ["dress", "gown", "princess dress"] },
  "サイバー背景に寄りすぎ": { avoid: ["cyberpunk city", "neon city", "sci-fi street"] },
  "クリスタルが出すぎ":  { avoid: ["crystal", "crystal wings", "crystal particles"] },
};

export function generateReversePrompt(args: {
  sourcePrompt: string;
  sourcePromptId: string;
  failureMemo?: FailureMemo;
  validation: PromptValidationResult;
  massAI: MassAIResult;
  identity: IdentityRiskResult;
  lock: LockState;
}): ReversePromptResult {
  const { sourcePrompt, sourcePromptId, failureMemo, validation, massAI, identity, lock } = args;

  const failureSummary: string[] = [];
  const avoidNextTime: string[] = [];
  const strengthenLocks: string[] = [];

  // 1) 変更禁止チェックの違反を要約
  for (const w of validation.warnings) {
    failureSummary.push(w.message);
    avoidNextTime.push(...w.matchedWords.slice(0, 4));
  }

  // 2) 失敗メモの理由を反映（保護軸に関するものだけ固定文を強める）
  if (failureMemo) {
    for (const r of failureMemo.selectedReasons) {
      const hint = REASON_HINTS[r];
      if (!hint) continue;
      // 「背景が変わった」だが背景が変更対象なら、固定文は付けない（ユーザーが背景を変えたいので）
      const isBgReason = r.includes("背景");
      const isOutfitReason = r.includes("衣装");
      const isHairReason = r.includes("髪");
      const isPoseReason = r.includes("ポーズ");
      const isCameraReason = r.includes("カメラ");
      const skip =
        (isBgReason && lock.changeTargets.background) ||
        (isOutfitReason && lock.changeTargets.outfit) ||
        (isHairReason && lock.changeTargets.hair) ||
        (isPoseReason && lock.changeTargets.pose) ||
        (isCameraReason && lock.changeTargets.camera);
      if (hint.avoid) avoidNextTime.push(...hint.avoid);
      if (hint.lock && !skip) strengthenLocks.push(hint.lock);
    }
    if (failureMemo.customMemo) failureSummary.push(`メモ：${failureMemo.customMemo}`);
  }

  // 3) 量産AI・同一性の提案を取り込む
  const massAIAvoidanceSuggestions = massAI.suggestions.slice(0, 5);
  const identitySafetySuggestions = identity.safeSuggestions.slice(0, 5);

  // 顔・同一性の固定文は必ず強める（最優先方針）
  strengthenLocks.unshift("顔の特徴・同一性・表情・体型・アスペクト比は完全維持し、一切変更しない。");

  // 4) ロック確認
  const changed = changedTargetLabels(lock);
  const locked = lockedTargetLabels(lock);
  const lockReminder = [
    `【変更する】 ${changed.join(" / ") || "（なし）"}`,
    `【変更しない】 ${locked.join(" / ")}`,
  ];

  // 5) 改善プロンプト案を構築
  //    - 禁止ワード除去（保護軸の語を削除）
  //    - 先頭に架空キャラ前提＋同一性最優先固定文
  const cleaned = cleanForbidden(sourcePrompt, lock);
  const dedupLocks = Array.from(new Set(strengthenLocks));
  const improvedPrompt = [
    "【前提】この画像はAIで生成された架空キャラクターです。画像編集として、",
    `${changed.join("・") || "指定された項目"}のみを変更してください。`,
    buildIdentitySafetyPreamble().trim(),
    `【固定】${locked.join("・")}は完全維持。`,
    ...dedupLocks.map((l) => `【注意】${l}`),
    "",
    cleaned,
  ].join("\n");

  return {
    id: `rev-${Date.now()}`,
    sourcePromptId,
    sourceImageId: failureMemo?.imageId,
    failureMemoIds: failureMemo ? [failureMemo.id] : [],
    failureSummary: Array.from(new Set(failureSummary)),
    avoidNextTime: Array.from(new Set(avoidNextTime)),
    strengthenLocks: dedupLocks,
    improvedPrompt,
    lockReminder,
    massAIAvoidanceSuggestions,
    identitySafetySuggestions,
    createdAt: Date.now(),
  };
}
