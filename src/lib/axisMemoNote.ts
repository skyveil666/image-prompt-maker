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
export function buildCustomInstructionNote(text: string): string {
  const body = text.trim();
  return [
    "【指示（ユーザー指定・最優先で反映）】",
    body,
    "※ 上記の希望を最優先で具体化すること。ただし【NG】指定と安全要件には必ず従う。",
  ].join("\n");
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
