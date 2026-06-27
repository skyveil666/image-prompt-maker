/**
 * 衣装の配色ノート（front-only・§4不触）。
 *
 * extraInstructions（promptSystem が verbatim 注入する経路）に載せる短い前提ノートを生成する。
 * サーバの promptSystem / scopeFilter / gemini は一切変更しない（前提語注入のみで品質を誘導）。
 *
 * 2系統（併用可）：
 *  - buildOutfitColorfulNote()        … 「カラフル」トグル（details.outfit.colorful）用。
 *                                        各案の“中で”多色化する（案間のバラけとは独立）。
 *  - buildOutfitColorVarietyNote(n)   … 色方向「おまかせ」(color === "auto") 用。
 *                                        案“ごと”に配色の主系統を変える（count に応じ列挙）。
 *
 * おまかせ＝案間で配色をバラす × カラフル＝1案の中で多色、を同時に効かせられる。
 */

/** 案ごとに割り当てる配色の「主系統」。Count 最大6に対応（先頭から count 個を使う）。 */
const OUTFIT_COLOR_FAMILIES = [
  "暖色系（赤・オレンジ・ピンクなど）",
  "寒色系（青・水色・緑など）",
  "無彩色・モノトーン系（黒・白・グレー）",
  "ビビッド・差し色系（紫・金など鮮やかなアクセント）",
  "アースカラー系（ベージュ・ブラウン・カーキなど）",
  "パステル系（淡く優しい中間色）",
] as const;

/**
 * 「カラフル」：衣装を多色・カラフルな配色にする（1案の中で複数色を混ぜる）。
 * color の単一値とは独立した補助フラグ。color === "auto"（おまかせ）と併用可能。
 */
export function buildOutfitColorfulNote(): string {
  return "【衣装の配色：カラフル】衣装は複数の色を組み合わせた多彩でカラフルな配色にする（単色に寄せず、2〜3色以上を意図的に取り入れる）。";
}

/**
 * 色方向「おまかせ」：複数案で配色が同系統（例：全案グリーン）に偏らないよう、
 * 案ごとに配色の主系統を割り当てる。
 * @param count 生成案数（2〜6）。先頭から count 個の系統を列挙する。
 */
export function buildOutfitColorVarietyNote(count: number): string {
  const n = Math.max(2, Math.min(Math.floor(count), OUTFIT_COLOR_FAMILIES.length));
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    lines.push(`・案${i + 1}＝${OUTFIT_COLOR_FAMILIES[i]}`);
  }
  return (
    "【衣装の配色：案ごとに変える】各案で衣装の配色の主系統を必ず変える（同じ系統を複数案で繰り返さない）：\n" +
    lines.join("\n")
  );
}
