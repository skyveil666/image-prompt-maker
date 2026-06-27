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

/** 2つのNG文字列を行単位でマージし、重複行を排除して改行連結する（冪等）。 */
export function mergeNgLines(a: string | undefined, b: string | undefined): string {
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
