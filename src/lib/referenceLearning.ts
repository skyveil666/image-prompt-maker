/**
 * referenceLearning — Compare評価（referenceRecords）を skyveil好みAI の素材へ集計する（Phase D / docs/27）。
 *
 * 方針：新しい学習系統を増やさず、referenceRecords を読んで likes/avoid の「方向性」素材に束ねる。
 *   - likes: ⭐ または 全体「良かった(5)」が付いた参照の適用テキスト ＋ 項目別👍(5) の軸テキスト
 *            （髪型/色味/空気感を優先・背景/衣装/ポーズは履歴ミラー済みのため重み低め）
 *   - avoid: 項目別👎(1) の軸テキスト（全体「違う(1)」は match品質の話なので avoid にしない）
 *
 * これらは「コピーではなく方向性」。生成へは限定重みで供給し、新規性・多様性は既存機構が優先する。
 * referenceRecords を読むだけ（保存・生成・抽出ロジックには影響しない）。
 */

import { getReferenceRecords, type ReferenceRecord } from "./referenceRecords";

export interface ReferenceLearning {
  /** 好む方向性（句） */
  likes: string[];
  /** 避けたい方向性（句） */
  avoid: string[];
  /** 評価が付いた参照レコード数（材料の量） */
  sampleCount: number;
  hasData: boolean;
}

const EMPTY: ReferenceLearning = { likes: [], avoid: [], sampleCount: 0, hasData: false };

/** 髪型/色味/空気感は履歴ミラー対象外＝主に補強。背景/衣装/ポーズは履歴側で既に学習され得るため重み低め。 */
const EMPHASIZE = new Set(["hair", "color", "mood"]);

function topByWeight(map: Map<string, number>, max: number): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}

/** referenceRecords 配列を likes/avoid に集計（純粋関数）。 */
export function buildReferenceLearning(records: ReferenceRecord[]): ReferenceLearning {
  if (!records || records.length === 0) return EMPTY;
  const likesW = new Map<string, number>();
  const avoidW = new Map<string, number>();
  let evaluated = 0;

  const add = (m: Map<string, number>, text: string | undefined, w: number) => {
    const t = (text ?? "").trim().slice(0, 80);
    if (!t) return;
    m.set(t, (m.get(t) ?? 0) + w);
  };

  for (const r of records) {
    const applied = r.applied ?? {};
    const extracted = r.extracted ?? {};
    const axisEval = r.userAxisEval ?? {};
    const likedWhole = r.favorite === true || r.userEvalOverall === 5;
    let touched = false;

    if (likedWhole) {
      for (const text of Object.values(applied)) { add(likesW, text, 1); touched = true; }
    }
    for (const [cat, val] of Object.entries(axisEval)) {
      const text = applied[cat] ?? extracted[cat];
      if (val === 5) { add(likesW, text, EMPHASIZE.has(cat) ? 2 : 1); touched = true; }
      else if (val === 1) { add(avoidW, text, 1); touched = true; }
    }
    if (touched) evaluated++;
  }

  const likes = topByWeight(likesW, 8);
  const avoid = topByWeight(avoidW, 8);
  return { likes, avoid, sampleCount: evaluated, hasData: likes.length > 0 || avoid.length > 0 };
}

/** IndexedDB から referenceRecords を読み込んで集計（App から呼ぶ）。失敗時は空。 */
export async function loadReferenceLearning(): Promise<ReferenceLearning> {
  try {
    return buildReferenceLearning(await getReferenceRecords());
  } catch {
    return EMPTY;
  }
}
