/**
 * 参照画像から「適用」した軸タグ付き自由文を「【参照画像から強制適用】」ブロックに整形する純関数。
 * App.tsx の useMemo から呼ぶ（出力文字列は従来のインライン実装と完全一致＝挙動不変）。
 * 生成ロジック本体には影響しない（extraInstructions への統合は呼び出し側が行う）。
 *
 * @param referenceNote catKey → text のマップ（空・空白のみのエントリは除外）。
 * @param categories    表示順とラベルの定義（REFERENCE_CATEGORIES を渡す）。
 *                      lib をコンポーネント層へ依存させないため、型は最小形で受ける。
 * @returns 整形済みブロック文字列。該当行が無ければ ""。
 */
export function buildReferenceNoteText(
  referenceNote: Record<string, string>,
  categories: ReadonlyArray<{ key: string; label: string }>,
): string {
  const lines = categories
    .filter((c) => (referenceNote[c.key] ?? "").trim())
    .map((c) => `${c.label}：${referenceNote[c.key].trim()}`);
  if (lines.length === 0) return "";
  return [
    "【参照画像から強制適用】",
    ...lines,
    "上記の参照要素は優先度最高で必ず反映する。自動生成のジャンル・世界観・他の変更指示よりも優先する。",
    "参照画像の雰囲気・構図・色味・空気感を保つこと。参照画像に無い要素を勝手に足さないこと。",
  ].join("\n");
}
