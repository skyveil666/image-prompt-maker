/**
 * promptDiff — プロンプト差分表示（#8）。
 *
 * 前回プロンプトと今回プロンプトの違いを行単位で比較する。
 * 確認用のみ（自動で前回内容に戻さない）。
 */

export interface PromptDiffResult {
  added: string[];
  removed: string[];
  changed: { before: string; after: string }[];
  unchanged: string[];
  summary: string[];
}

/** プロンプトの版（この版に戻す／差分比較用） */
export interface PromptVersion {
  id: string;
  /** 記録時刻（unix ms） */
  createdAt: number;
  prompt: string;
  /** 変更の出どころ */
  source: "manual" | "regenerate" | "improvement" | "favoriteArrange" | "reversePrompt" | "cleaned";
  /** 当時の変更対象ラベル */
  changeTargets?: string[];
  /** 当時の保護対象ラベル */
  protectedTargets?: string[];
}

function normLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/**
 * 行単位の差分。
 * - prev にあって current に無い行 = removed
 * - current にあって prev に無い行 = added
 * - 近い行（先頭が一致する等）で内容が違うもの = changed
 */
export function diffPrompts(previousPrompt: string, currentPrompt: string): PromptDiffResult {
  const prev = normLines(previousPrompt);
  const cur = normLines(currentPrompt);
  const prevSet = new Set(prev);
  const curSet = new Set(cur);

  const unchanged = cur.filter((l) => prevSet.has(l));
  const addedRaw = cur.filter((l) => !prevSet.has(l));
  const removedRaw = prev.filter((l) => !curSet.has(l));

  // 「変更された行」を推定：先頭ラベル（【...】や "："まで）が一致する add/remove ペア
  const changed: { before: string; after: string }[] = [];
  const added: string[] = [];
  const removed = [...removedRaw];

  const keyOf = (l: string): string => {
    const m = l.match(/^【[^】]+】|^[^：:]{1,12}[：:]/);
    return m ? m[0] : "";
  };

  for (const a of addedRaw) {
    const k = keyOf(a);
    if (k) {
      const idx = removed.findIndex((r) => keyOf(r) === k);
      if (idx >= 0) {
        changed.push({ before: removed[idx], after: a });
        removed.splice(idx, 1);
        continue;
      }
    }
    added.push(a);
  }

  const summary: string[] = [];
  if (added.length) summary.push(`追加 ${added.length}行`);
  if (removed.length) summary.push(`削除 ${removed.length}行`);
  if (changed.length) summary.push(`変更 ${changed.length}行`);
  if (summary.length === 0) summary.push("差分なし");

  return { added, removed, changed, unchanged, summary };
}
