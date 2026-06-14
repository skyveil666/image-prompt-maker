/**
 * アレンジ補助ユーティリティ。
 * 変更ポイント（どの軸が変更され／維持されたか）を計算する。
 *
 * アレンジは sourceItem.scopes を変更範囲とし、それ以外の軸は
 * プロンプトの固定原則により維持される。したがって
 * 「changed = arrange scopes に含まれるか」で正確に表現できる。
 */
import type { Scope, ArrangeChangedAxis, PromptHistoryItem } from "../types";
import { ALL_SCOPE_LABELS } from "./scopeLabels";

// 全スコープの日本語ラベルは scopeLabels.ts に一本化。既存 import 互換のため再エクスポート。
export { ALL_SCOPE_LABELS };

/** アレンジ要素選択で常に表示する候補軸（順序固定） */
export const ARRANGE_AXES: ReadonlyArray<{ scope: Scope; label: string }> = [
  { scope: "outfit",     label: "衣装" },
  { scope: "hair",       label: "髪" },
  { scope: "lighting",   label: "ライティング" },
  { scope: "background", label: "背景" },
  { scope: "camera",     label: "カメラ" },
  { scope: "foreground", label: "前景演出" },
  { scope: "pose",       label: "ポーズ" },
  { scope: "props",      label: "持ち物" },
  { scope: "big_object", label: "大物" },
];

/**
 * アレンジ要素選択の候補スコープ一覧。
 * 標準9軸＋元プロンプトに含まれるその他の軸（コスプレ等）を重複なく返す。
 */
export function arrangeCandidateScopes(source: PromptHistoryItem | null): Scope[] {
  const base = ARRANGE_AXES.map((a) => a.scope);
  const extra = (source?.scopes ?? []).filter((s) => !base.includes(s));
  return [...base, ...extra];
}

/** 元プロンプトの変更範囲を初期ON要素として検出する。 */
export function detectSourceScopes(source: PromptHistoryItem | null): Scope[] {
  if (!source) return [];
  const candidates = arrangeCandidateScopes(source);
  return candidates.filter((s) => source.scopes?.includes(s));
}

/**
 * アレンジ要素フィルタ指示を生成する。
 * ON要素のみ方向性として使い、OFF要素は参照に記述があっても一切使わない。
 */
export function buildElementFilterInstruction(used: Scope[], excluded: Scope[]): string {
  const usedLabels = used.map((s) => ALL_SCOPE_LABELS[s]).join("・") || "（なし）";
  const exLabels   = excluded.map((s) => ALL_SCOPE_LABELS[s]).join("・") || "（なし）";
  return [
    "【アレンジ要素フィルタ — 厳守】",
    "参照プロンプトの中から『使用する要素』の方向性だけを参考にして、新しい案を作る。",
    `使用する要素：${usedLabels}`,
    `使用しない要素：${exLabels}`,
    "- 使用しない要素は、参照プロンプトに記述があっても一切参考にせず、変更もせず、アレンジ後プロンプトに記述しない。",
    "- 特に背景がオフの場合、背景の描写・背景の変更を出力しない（背景は元のまま維持する）。",
    "- 使用する要素のみ、コピーではなく新しい組み合わせでアレンジする。",
  ].join("\n");
}

/** 常に表示するコア軸（変更/維持を両方見せる） */
const CORE_AXES: ReadonlyArray<{ scope: Scope; label: string }> = [
  { scope: "outfit",     label: "衣装" },
  { scope: "hair",       label: "髪" },
  { scope: "background", label: "背景" },
  { scope: "camera",     label: "カメラ" },
  { scope: "lighting",   label: "ライティング" },
  { scope: "pose",       label: "ポーズ" },
];

/** コア軸以外で、変更範囲に含まれていれば追加表示する軸 */
const EXTRA_LABEL: Partial<Record<Scope, string>> = {
  foreground:   "前景演出",
  props:        "持ち物",
  cosplay:      "コスプレ",
  cyber:        "🦾 メカ",
  big_object:   "大物",
  vehicle:      "乗り物",
  myth:         "神話/幻獣",
  aspect_ratio: "アスペクト比",
};

/**
 * アレンジの変更範囲（scopes）から変更ポイントのタグ配列を作る。
 * コア6軸は常に表示（変更/維持）し、その他の変更軸は末尾に追加する。
 */
export function computeChangedAxes(arrangeScopes: Scope[]): ArrangeChangedAxis[] {
  const set = new Set(arrangeScopes);
  const axes: ArrangeChangedAxis[] = CORE_AXES.map((a) => ({
    scope: a.scope,
    label: a.label,
    changed: set.has(a.scope),
  }));
  for (const s of arrangeScopes) {
    if (!CORE_AXES.some((a) => a.scope === s) && EXTRA_LABEL[s]) {
      axes.push({ scope: s, label: EXTRA_LABEL[s]!, changed: true });
    }
  }
  return axes;
}
