/**
 * analyzeProposal — 1案ぶんの全チェックを1関数に集約する（処理の一本化）。
 *
 * これまで PromptGuardSection が validatePromptLocks / analyzeMassAIBias /
 * analyzeIdentityRisk / calculateSkyveilScore を別々に呼んでいたのを束ね、
 * 「最終プロンプト生成後の解析」を1経路に統一する。
 *
 * 重要：解析のみ。プロンプトを書き換えたり自動反映したりは一切しない。
 */

import type { LockState, PromptValidationResult } from "./promptLockCheck";
import { validatePromptLocks, changedTargetLabels, lockedTargetLabels } from "./promptLockCheck";
import { analyzeIdentityRisk, type IdentityRiskResult } from "./identityRisk";
import { analyzeMassAIBias, type MassAIResult } from "./massAIBias";
import { calculateSkyveilScore, type SkyveilScore } from "./skyveilScore";
import type { SkyveilProfile } from "./skyveilProfile";

export interface ProposalAnalysis {
  validation: PromptValidationResult;
  identityRisk: IdentityRiskResult;
  massAI: MassAIResult;
  skyveilScore: SkyveilScore;
  lockSummary: { changed: string[]; locked: string[] };
}

export function analyzeProposal(
  promptText: string,
  lock: LockState,
  profile?: SkyveilProfile | null,
): ProposalAnalysis {
  // 1) 変更禁止チェック（保護軸への干渉）
  const validation = analyzeValidation(promptText, lock);
  // 2) 量産AI回避メーター
  const massAI = analyzeMassAIBias(promptText);
  // 3) 同一性リスク
  const identityRisk = analyzeIdentityRisk(promptText, lock);
  // 4) skyveil好みスコア（massAI を渡して偏り検出の二重計算を避ける）
  const skyveilScore = calculateSkyveilScore({ promptText, lock, validation, profile, massAI });
  // 5) ロック一覧
  const lockSummary = {
    changed: changedTargetLabels(lock),
    locked: lockedTargetLabels(lock),
  };
  return { validation, identityRisk, massAI, skyveilScore, lockSummary };
}

function analyzeValidation(promptText: string, lock: LockState): PromptValidationResult {
  return validatePromptLocks(promptText, lock);
}
