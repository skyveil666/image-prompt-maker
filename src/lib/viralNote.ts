/**
 * viralNote — 旧「この画像でバズる」モードが蓄積した指示文 note の除去ユーティリティ。
 *
 * 背景：旧実装が note 込みの結合済み文字列を生の extraInstructions state へ書き戻していたため、
 *       押すたびに note が蓄積し settingsPersist で永続化されていた（S2/Dの回帰）。
 *       「この画像でバズる」機能の撤去後も、既存ユーザーの永続データに残る蓄積 note を起動時に除去する。
 * - stripViralImageNote は永続化済み extraInstructions から note ブロックのみを除去（生入力は保持・冪等）。
 */

// 旧バズる note ブロックの開始/終端マーカー（既存データの蓄積 note 除去用）。
const NOTE_START = "【⚡ 画像バズり生成モード";
const NOTE_END = "【絶対維持】顔・表情・人物の同一性・体型は一切変更しない。";

/**
 * extraInstructions に蓄積したバズる note ブロックを全て除去する（生のユーザー入力は保持）。
 * START から その直後最初の END までを範囲削除し、余分な連続空行を畳んで trim する。冪等。
 */
export function stripViralImageNote(text: string): string {
  if (!text) return text;
  let result = text;
  // START〜END（含む）を繰り返し除去。END が見つからなければ安全側で中断。
  // 無限ループ防止のため上限回数を設ける（蓄積は通常数回）。
  for (let i = 0; i < 50; i++) {
    const start = result.indexOf(NOTE_START);
    if (start < 0) break;
    const endPos = result.indexOf(NOTE_END, start);
    if (endPos < 0) break;
    result = result.slice(0, start) + result.slice(endPos + NOTE_END.length);
  }
  // 連続する空行を1つに畳み、前後の空白/改行を除去。
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
