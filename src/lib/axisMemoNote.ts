/**
 * axisMemoNote — 「指示（自由文・任意）」単一フリー欄 → extraInstructions 用の整形 ＋ §5バッジ型。
 *
 * 経緯：当初は軸ごと（ポーズ等）メモを試作したが、変更対象まわりの「単一フリー指示欄」に方向転換。
 *   per-axis 機構は撤去し、軸非依存の汎用1欄へ集約した（PoseSettings.memo は dormant 据え置き＝
 *   hide-not-delete。UI/注入からは外している）。
 *
 * 設計（Stage 0 調査で確証済み）：
 *  - 指示は「入力（extraInstructions）」にのみ流す。出力 proposal 本文に生指示を後付け連結しない。
 *    → サーバの最後の砦 safetySanitizePrompt（gemini.ts:390・promptSystem.ts:3600）が全 proposal の
 *      出力本文を無条件に通すため、指示文がどう入っても露出/絶対NGは必ず中和される。
 *  - 注入ゲートと §5 バッジ発火条件はどちらも「customInstruction が非空」で一致させ、
 *    「効くのに画面に出ない」見えない支配を作らない（CLAUDE.md §5）。
 */

/**
 * フリー指示の整形（注入強度＝B「強め」：この方向を最優先。ただし安全/NG には常に劣後）。
 * サーバは extraInstructions を【ユーザー追加指示】として verbatim 注入する（promptSystem.ts:4268）。
 */
export const CUSTOM_INSTRUCTION_MARKER = "【指示（ユーザー指定・最優先で反映）】";

export function buildCustomInstructionNote(text: string): string {
  const body = text.trim();
  return [
    CUSTOM_INSTRUCTION_MARKER,
    body,
    "※ 上記の希望を最優先で具体化すること。ただし【NG】指定と安全要件には必ず従う。",
  ].join("\n");
}

/**
 * buildInputs() が組み立てた extraInstructions（＝ユーザーが自分で打った「追加指示」＋
 * 各種の自動生成ブロックの連結）から、✏指示ブロックだけを取り除く。
 *
 * ★なぜ必要か（バグ修正・実機報告「保留にしたチップがプロンプトに残る」）：
 *   アレンジ／同じ構成で再生成 は、組み立て済みの extraInstructions を **state へ書き戻す**。
 *   ✏指示は customInstructionItems（applied のみ結合）から毎回生成し直す設計なのに、
 *   一度書き戻されると「追加指示」欄の一部として焼き付き、以後チップを保留・削除しても
 *   消えなくなる（チップ0件でも送信され続ける＝§5「見えない支配」に該当）。
 *   書き戻す前に本関数で取り除くことで、✏指示の唯一の供給源を items 側に保つ。
 *
 * 実装：各ブロックは "\n\n" 区切りで連結される（各ブロック内部は "\n" のみ＝空行を含まない）。
 *   よって空行で段落分割し、マーカー行で始まる段落だけを落とす。ユーザーの自由文は保つ。
 *
 * ※ 既知の限界：他の自動生成ブロック（世界観／斬新背景／画法世界／参照画像／配色の主従 等）も
 *   同じ経路で焼き付く。それらはマーカーが可変（プリセット名を含む・そもそも【】で始まらない
 *   ものもある）ため一括除去は別途の設計判断が要る。ここでは実機報告のあった✏指示のみ対象。
 */
export function stripCustomInstructionBlock(text: string): string {
  return text
    .split(/\n{2,}/)
    .filter((block) => !block.trimStart().startsWith(CUSTOM_INSTRUCTION_MARKER))
    .join("\n\n")
    .trim();
}

/** §5「見えない支配」バッジ1個ぶん（ReflectionStatusBar / ArrangePreviewPanel 共通）。 */
export interface MemoBadge {
  key: string;
  label: string;
  /** 指示全文（バッジは要約表示＋ツールチップ全文）。 */
  summary: string;
  clearTitle: string;
  onClear: () => void;
}
