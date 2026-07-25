/**
 * 配色の主従ノート（front-only・§4不触）。
 *
 * 衣装と背景、どちらの配色を主役にするか（あるいは対比させるか）を選べるようにする。
 * extraInstructions（promptSystem が verbatim 注入する経路）に載せる短い前提ノートを生成する。
 * outfitColorNotes.ts と同型のパターン。
 *
 * ★衣装色(details.outfit.color)・背景色(details.background.color)はそれぞれ独立に決まるだけで、
 *   両者の関係性（主従・対比）を指示する仕組みが無かったため新設（実機での「衣装と背景が同系色に
 *   収束する」報告を受けた調査より）。scopes は変更しない＝outfit/background が既に変更対象の
 *   時だけ意味を持つ補助指示（呼び出し側でゲートする）。
 */

export type ColorDominance = "outfit" | "background" | "contrast";

export function buildColorDominanceNote(mode: ColorDominance): string {
  switch (mode) {
    case "outfit":
      return "【配色の主従：衣装が主役】背景の配色は無彩色〜低彩度に抑え、衣装だけが彩度・鮮やかさを持つようにする。ただし背景の明暗・奥行き・質感（陰影や前後の層）は失わない。";
    case "background":
      return "【配色の主従：背景が主役】衣装の配色はモノトーン〜控えめに抑え、背景の方が色で主張するようにする。ただし衣装の質感・立体感は失わない。";
    case "contrast":
      return "【配色の主従：対比】衣装と背景を反対方向の配色（暖色⇄寒色、有彩色⇄無彩色など）に振り分け、両者のコントラストを強める。";
  }
}
