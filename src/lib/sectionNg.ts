/**
 * セクションNG（詳細フィールド単位の強制skip）の単一ソース定義。
 *
 * キーは "category.field" 形式（DetailSettings のカテゴリ名・例 "background.place"）。
 * - applySectionNg（ngGate.ts）：このキーで details[cat][field] を "skip" 上書き／multiOverrides[key] を delete。
 * - DetailsCard：見出しダブルクリックで onToggleSectionNg(key)。ngKey はこの型に縛り、ラベルマップと同形を強制。
 * - ReflectionStatusBar / ArrangePreviewPanel（B2b）：このマップで key → 日本語ラベルに変換してバッジ表示。
 *
 * ＝「ngKey ↔ ラベル ↔ applySectionNg/multiOverrides」を1ソース・同一規則で揃える（キーずれ防止）。
 * アスペクト比は対象外（含めない）。B2a は background のみ、以降のカテゴリは rollout で追記する。
 */
export const SECTION_NG_LABELS = {
  "background.place":   "場所",
  "background.color":   "背景色",
  "background.density": "密度",
  "background.effect":  "空間効果",
  "background.time":    "時間帯",
  "background.weather": "天候",
  "background.depth":   "奥行き",
  "background.info":    "情報量",
  "background.style":   "背景スタイル",
} as const;

/** セクションNG 可能なフィールドキー（"category.field"）。ngKey はこの union に縛る。 */
export type SectionNgKey = keyof typeof SECTION_NG_LABELS;

/** sectionNg 配列を日本語ラベル配列へ（未知キーはそのまま）。バッジ表示用。 */
export function sectionNgLabels(keys: string[]): string[] {
  return keys.map((k) => (SECTION_NG_LABELS as Record<string, string>)[k] ?? k);
}
