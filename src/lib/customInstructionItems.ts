/**
 * customInstructionItems — 「✏ 指示（自由文）」欄の項目分割（段階1：データ構造＋区切りロジック）。
 *
 * 設計（Stage 0 調査で確証済み・docs/24 相当）：
 *  - 区切りは「改行 + 句点（。！？）」による文単位のみ（段階1のスコープ）。
 *    単語列のさらなる分割（カンマ/スペース）は段階3の「単語分割トグル」で追加する。
 *  - 半角の . ! ? は分割に使わない（"1.5倍" 等の数値表記を誤って割らないため）。
 *  - applied 項目だけを結合して extraInstructions へ流す（held/削除は流さない）。
 *    ★安全経路は不変：結合後の文字列は従来どおり buildCustomInstructionNote() に渡すだけで、
 *    extraInstructions → §4サニタイザ無条件、という既存経路をそのまま通る（axisMemoNote.ts 参照）。
 */

export interface CustomInstructionItem {
  id: string;
  text: string;
  status: "applied" | "held";
}

/** 文単位で分割する（改行 + 全角句点 。！？ の直後で区切る）。空文字・空白のみの断片は除く。 */
export function splitIntoItems(raw: string): string[] {
  return raw
    .split(/\n|(?<=[。！？])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

let seq = 0;
/** 項目ID採番（referenceRecords.ts と同じ timestamp+連番パターン）。 */
export function makeItemId(): string {
  seq = (seq + 1) % 1_000_000;
  return `ci_${Date.now()}_${seq.toString().padStart(6, "0")}`;
}

/** 生テキストから items[] を作る（新規項目はすべて既定 applied）。 */
export function itemsFromText(raw: string): CustomInstructionItem[] {
  return splitIntoItems(raw).map((text) => ({ id: makeItemId(), text, status: "applied" as const }));
}

/** applied 項目のテキストだけを改行結合する（held は含めない）。 */
export function joinAppliedItemsText(items: CustomInstructionItem[]): string {
  return items
    .filter((i) => i.status === "applied")
    .map((i) => i.text)
    .join("\n");
}

/** 指定IDの項目の適用/保留を切り替える（ダブルクリック用・他の項目は変更しない）。 */
export function toggleItemStatus(items: CustomInstructionItem[], id: string): CustomInstructionItem[] {
  return items.map((i) => (i.id === id ? { ...i, status: i.status === "applied" ? "held" : "applied" } : i));
}

/** 指定IDの項目を完全に削除する（保留と違い元に戻せない・UI側は独立ボタンにすること）。 */
export function removeItem(items: CustomInstructionItem[], id: string): CustomInstructionItem[] {
  return items.filter((i) => i.id !== id);
}

/** ドラフト欄の生テキストを分割し、新規applied項目として既存items[]の末尾に追記する。
 *  既存項目のstatusには触れない＝保留中の項目が入力の打ち足しで消えたり復活したりしない。 */
export function appendItemsFromText(items: CustomInstructionItem[], raw: string): CustomInstructionItem[] {
  return [...items, ...itemsFromText(raw)];
}
