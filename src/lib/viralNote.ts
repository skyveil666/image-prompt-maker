/**
 * viralNote — 「この画像でバズる」モードの指示文（単一ソース）と、その除去ユーティリティ。
 *
 * 背景：旧実装で handleImageViral が note 込みの結合済み文字列を生の extraInstructions state へ
 *       書き戻していたため、押すたびに note が蓄積し settingsPersist で永続化されていた（S2/Dの回帰）。
 *       本ファイルで note を一元管理し、蓄積した note を起動時に安全に除去する。
 *
 * - note は buildImageViralInputs が生成 payload へ付与する（生の入力欄には書き戻さない）。
 * - stripViralImageNote は永続化済み extraInstructions から note ブロックのみを除去（生入力は保持）。
 */

/** バズる画像モードの指示文（buildImageViralInputs が payload の extraInstructions へ付与）。 */
export const VIRAL_IMAGE_NOTE = [
  "【⚡ 画像バズり生成モード — この画像から最強プロンプトを作る】",
  "添付された画像のスタイル・世界観・色使い・雰囲気・光を徹底的に分析してください。",
  "",
  "▼ このモードの目的：",
  "  この画像の「バズる要素」を抽出し、SNSで最大限話題になるプロンプト案を生成する。",
  "  同じ画像を再現するのではなく、この画像のエッセンス・空気感・視覚的強度を",
  "  さらに強化した「上位互換バージョン」を目指す。",
  "",
  "▼ 分析して反映すべき要素：",
  "  - 色パレット（主要色・アクセント色・全体トーン）",
  "  - 光の種類と演出（自然光/スタジオ/ドラマチック/暗め等）",
  "  - 被写体の雰囲気・表情・佇まい",
  "  - 背景の世界観・空気感",
  "  - 衣装・スタイリングの方向性",
  "",
  "▼ 各案で差別化：",
  "  案ごとに「バズりポイント」を変える（構図/色/演出/世界観）。",
  "  似たような案の量産は絶対禁止。各案が独立したSNSコンテンツになるように。",
  "",
  "▼ SNSバズの絶対条件：",
  "  「何これ？」「保存したい」「シェアしたい」と思わせる視覚的強度。",
  "  整った安全な画ではなく、印象に残る異常なほど完成度の高い画を目指す。",
  "【絶対維持】顔・表情・人物の同一性・体型は一切変更しない。",
].join("\n");

// note ブロックの開始/終端マーカー（VIRAL_IMAGE_NOTE と整合）。
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
