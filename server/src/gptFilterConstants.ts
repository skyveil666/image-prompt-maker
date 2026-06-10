/**
 * GPT Image 2 フィルター複合トリガー対策（L3のみ）
 *
 * ▼ 方針（2026-06-11 確定）:
 *   単語単体の全置換（旧L1/L2）は撤去済み。実テストで「監視カメラ」「ロリィタ」等の
 *   単語単体は生成成功しており、ブロックの原因は複合要素の積み重なりにあるため。
 *   ユーザーが使いたい表現は置換せず残し、本当に危険な複合時のみ
 *   「安全方向のアンカー文を追記」する方式とする（語彙を書き換えない）。
 *
 * ▼ 撤去済みのL3パターン（参考・復活させる場合は要承認）:
 *   - コスプレ×上方アングル → 目線高さ置換: 5月の成功プロンプトに
 *     「コスプレ＋ドローン空撮風ハイアングル」があり、置換すると黄金語彙を壊すため撤去。
 *   - 防犯カメラ/ドローン空撮 → ポートレート置換: 同上。
 */

export const L3_COMPOUND: Array<{
  label: string;
  detect: (text: string) => boolean;
  fix: (text: string) => string;
}> = [
  {
    // 人物 + 肌露出多の複合時のみ、fully clothed アンカーを末尾に追記する。
    // 既存語を置換しない（追記のみ）ので、表現の個性を奪わない。
    label: "L3-exposure-person",
    detect: (t) =>
      /人物|モデル|キャラクター|character|model|figure/i.test(t) &&
      /肌の露出が多|露出多め|肌露出|bare skin|exposed skin|skin showing/i.test(t),
    fix: (t) => t + ", fully clothed, complete outfit coverage",
  },
];
