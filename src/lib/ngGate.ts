import { splitNg } from "./ngPositive";
import type { PromptInputs } from "../types";

/**
 * NG出口一括適用（全送信経路の関所）。
 *
 * 各ビルダー（世界観 / カルチャー / 神引きプリセット等）は extraInstructions を自前 note で
 * 置き換えるため、buildInputs() で付与した S3肯定誘導(positiveGuidance) が消える経路がある。
 * そこで /api/generate への唯一の送信関数 generateViaBackend() の fetch 直前で本関数を1回通し、
 * どの経路（通常 / バズる / プリセット / 神引き / アレンジ / 安全寄り / インラインアレンジ）でも
 * NG を冪等に復元する。
 *
 * - ngForBlock（未マップ自由文＋禁止モチーフ英語展開）を inputs.ngList に行マージ（重複排除）。
 * - positiveGuidance（室内→「屋外・広い空」等）を extraInstructions に未包含時のみ付与（冪等）。
 * - サーバ(§4) / splitNg / buildInputs は無改修。既存フィールドの中身を保証するだけ。
 *   変更するのは ngList / extraInstructions の2フィールドのみ（他は ...inputs と同一）。
 */
export function applyNgGate(
  inputs: PromptInputs,
  ngList: string,
  forbiddenTokens: string[],
): PromptInputs {
  const { ngForBlock, positiveGuidance } = splitNg(ngList, forbiddenTokens);

  const mergedNg = mergeNgLines(inputs.ngList, ngForBlock);

  // null ガード：extraInstructions 未設定の経路でも throw しない。
  const baseExtra = inputs.extraInstructions ?? "";
  const extra =
    positiveGuidance && !baseExtra.includes(positiveGuidance)
      ? [baseExtra, positiveGuidance].filter(Boolean).join("\n\n")
      : baseExtra;

  return { ...inputs, ngList: mergedNg, extraInstructions: extra };
}

/**
 * セクションNG：詳細設定のフィールドを送信直前に強制 "skip" へ上書きする。
 *
 * - sectionNg は AutoOr 値レイヤとは別の独立フラグ（"category.field" 形式）。プリセット/ビルダーが
 *   入れた値を送信ゲートで塗り潰す＝preset に勝つ sticky。サーバは既存の "skip" 分岐で本文から除外。
 * - multiOverrides[key] は field値より優先されるため、該当キーは必ず delete する（消さないと複数選択が
 *   勝って本文に残る）。キーは "category.field" 同形なので変換不要。
 * - 非変異：inputs/details/各カテゴリ/multiOverrides を書き換えず、変更箇所のみ遅延シャローコピー。
 *   無変更なら同一参照を返す（同じ inputs を表示計算と送信で2回通しても二重変異しない）。
 */
export function applySectionNg(inputs: PromptInputs, sectionNg: string[]): PromptInputs {
  if (!sectionNg.length) return inputs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const src = inputs.details as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let details: Record<string, any> | null = null;   // 穴3: フィールドskip時のみ遅延複製
  let mo: Record<string, string[]> | null = null;    // 穴2: 実際に delete する時のみ遅延複製
  const srcMo = inputs.details.multiOverrides;
  for (const key of sectionNg) {
    const dot = key.indexOf(".");
    if (dot < 0) continue;
    const cat = key.slice(0, dot);
    const field = key.slice(dot + 1);
    const obj = src[cat];
    if (obj && typeof obj === "object" && field in obj) {
      if (!details) details = { ...src };
      details[cat] = { ...details[cat], [field]: "skip" };   // sticky 強制skip（同cat複数キーも累積）
    }
    if (srcMo && key in srcMo) {                              // 穴1: 同形キーで一致（変換不要）
      if (!mo) mo = { ...srcMo };
      delete mo[key];                                         // server優先のため必須
    }
  }
  if (!details && !mo) return inputs;                         // 穴3: 無変更なら同一参照
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = details ?? { ...src };
  if (mo) out.multiOverrides = Object.keys(mo).length ? mo : undefined; // 穴2: deleteした時だけ書き戻す
  return { ...inputs, details: out as PromptInputs["details"] };
}

/** 2つのNG文字列を行単位でマージし、重複行を排除して改行連結する（冪等）。 */
function mergeNgLines(a: string | undefined, b: string | undefined): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const src of [a ?? "", b ?? ""]) {
    for (const line of src.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(line);
      }
    }
  }
  return lines.join("\n");
}
