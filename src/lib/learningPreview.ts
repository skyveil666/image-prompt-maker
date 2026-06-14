/**
 * learningPreview — 学習反映差分プレビュー。
 *
 * skyveil学習・お気に入り分析・成功パターン・逆プロンプト等を「現在設定」へ反映する前に、
 * 「何が変わるか」を差分で見せ、保護対象に違反する反映はブロックする安全装置。
 *
 * 最重要：プレビューだけでは絶対に設定を変えない。反映ボタンを押すまで state は不変。
 *         ブロックされた差分は反映しない。背景固定ON / 衣装OFF / 顔・同一性維持を最優先。
 */

import type { Scope } from "../types";
import type { SuccessPromptPattern } from "./successPatterns";
import { ALL_SCOPE_LABELS as SCOPE_LABEL } from "./scopeLabels";
import type { LockState } from "./promptLockCheck";

export type LearningApplySource =
  | "favoriteAnalysis" | "successPattern" | "failureMemo"
  | "reversePrompt" | "zozoTrend" | "kamiBiki" | "buzzMode" | "manual";

export interface SettingDiffItem {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  risk: "none" | "low" | "medium" | "high";
  warning?: string;
}

export interface LearningApplyPreviewResult {
  source: LearningApplySource;
  /** 反映される差分 */
  diffs: SettingDiffItem[];
  /** 保護対象違反でブロックされた差分（反映されない） */
  blockedDiffs: SettingDiffItem[];
  warnings: string[];
  /** 反映できる差分があるか */
  canApply: boolean;
}

// Scope→ラベルは scopeLabels.ts に一本化（SCOPE_LABEL は別名 import）。

/**
 * 成功パターンを現在のスコープへ反映する場合の差分プレビュー。
 * - 型の変更対象のうち、現在ONでないものを「追加予定」として diffs に。
 * - ただし背景・衣装が現在OFF（保護中）なら blockedDiffs に回す（反映不可）。
 */
export function previewSuccessPattern(args: {
  currentScopes: Scope[];
  pattern: SuccessPromptPattern;
  lock: LockState;
}): LearningApplyPreviewResult {
  const current = new Set(args.currentScopes);
  const protectedIfOff: Scope[] = ["background", "outfit"];
  const diffs: SettingDiffItem[] = [];
  const blockedDiffs: SettingDiffItem[] = [];
  const warnings: string[] = [];

  for (const s of args.pattern.changeTargetPattern) {
    if (current.has(s)) continue; // 既に変更対象
    const item: SettingDiffItem = {
      key: `scope.${s}`,
      label: `変更対象：${SCOPE_LABEL[s] ?? s}`,
      before: "保護（変更しない）",
      after: "変更対象に追加",
      risk: s === "pose" || s === "camera" || s === "hair" ? "medium" : "low",
    };
    if (protectedIfOff.includes(s)) {
      const reason = s === "background" ? "背景固定ONのため反映不可" : "衣装OFFのため反映不可";
      blockedDiffs.push({ ...item, risk: "high", warning: reason });
      warnings.push(`⚠️ ${reason}`);
    } else {
      diffs.push(item);
    }
  }

  return {
    source: "successPattern",
    diffs,
    blockedDiffs,
    warnings,
    canApply: diffs.length > 0,
  };
}

/**
 * プレビュー確定後に実際のスコープを返す（ユーザーが反映ボタンを押した時だけ呼ぶ）。
 * ブロックされた差分は含めない（保護対象を守る）。顔・同一性ロックは scopes と別管理で不変。
 */
export function applyPreviewedScopes(
  currentScopes: Scope[],
  preview: LearningApplyPreviewResult,
): Scope[] {
  const add = preview.diffs
    .filter((d) => d.key.startsWith("scope."))
    .map((d) => d.key.slice("scope.".length) as Scope);
  return Array.from(new Set([...currentScopes, ...add]));
}
