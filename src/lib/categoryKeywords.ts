/**
 * categoryKeywords — 量産AI偏り・顔危険語・量産AIクリシェの「単一の語彙ソース」。
 *
 * これまで massAIBias / skyveilScore / identityRisk / promptLockCheck に
 * 同じ系統の語リストが散在していたのを1か所に集約し、メンテ重複を解消する。
 */

/** 量産AI偏りカテゴリ（JP + EN の和集合） */
export const BIAS_CATEGORIES = {
  blackGothic: [
    "黒ゴシック", "ダークゴシック", "ゴシックドレス", "黒レース", "黒いバラ", "黒薔薇",
    "ステンドグラス", "大聖堂", "ヴァンパイア", "吸血鬼", "ダークファンタジー", "黒い羽", "黒ドレス", "黒主体",
    "black gothic", "dark gothic", "gothic dress", "black lace", "black roses",
    "stained glass", "cathedral", "vampire", "dark fantasy", "black feathers",
  ],
  blueNeon: [
    "青ネオン", "シアングロー", "エレクトリックブルー", "ネオンライト", "サイバーブルー",
    "青い光", "青いホログラム", "ネオンブルー", "ブルーネオン",
    "blue neon", "cyan glow", "electric blue", "neon lights", "cyber blue",
    "glowing blue", "blue hologram",
  ],
  cyberBackground: [
    "サイバーパンク都市", "近未来都市", "ネオン街", "電脳都市", "ホログラム都市",
    "SF通路", "電脳街", "仮想背景", "サイバー背景", "サイバー", "電脳", "サイバーパンク",
    "cyberpunk city", "futuristic city", "neon city", "digital city",
    "holographic city", "sci-fi street", "virtual background", "cyber background",
  ],
  crystal: [
    "クリスタル", "水晶", "宝石", "透明な結晶", "光る結晶", "クリスタルの羽", "結晶の粒子", "結晶",
    "crystal", "crystals", "gemstone", "transparent crystal", "glowing crystal",
    "crystal wings", "crystal particles",
  ],
  dress: [
    "ドレス", "ガウン", "ロングドレス", "フリルドレス", "エレガントなドレス",
    "ファンタジードレス", "プリンセスドレス", "妖精ドレス", "女神ドレス",
    "dress", "gown", "long dress", "frilly dress", "elegant dress",
    "fantasy dress", "princess dress",
  ],
} as const;

export type BiasCategory = keyof typeof BIAS_CATEGORIES;

export const BIAS_LABEL: Record<BiasCategory, string> = {
  blackGothic: "黒ゴシック", blueNeon: "青ネオン", cyberBackground: "サイバー背景",
  crystal: "クリスタル", dress: "ドレス",
};

/** 量産AIクリシェ語（オリジナリティ減点用） */
export const AI_CLICHE = [
  "プリンセス", "妖精", "女神", "エルフ女王", "透明シフォン", "フリル大量", "宝石まみれ",
  "キラキラ姫", "ふわふわ光る白", "魔法少女", "透明オーガンザ", "クリスタル",
];

/** 顔・同一性を脅かす危険語（JP + EN の和集合） */
export const FACE_DANGER = [
  "別人", "顔を変える", "顔つきを変える", "顔立ちを変える", "顔の造形を変更", "顔を作り変える",
  "大人っぽく", "大人っぽい顔", "幼く", "幼い顔", "顔の変形", "目鼻立ちを変える", "輪郭を変える",
  "別の顔", "新しい表情", "顔の角度を変える", "顔の向きを変える", "妖艶", "誘惑的",
  "different face", "new face", "mature face", "younger face", "face transformation",
  "change facial structure", "reshape face", "different person", "new expression",
  "dramatic facial change", "change face",
];

/** 大文字小文字を無視して、テキストに含まれる語を返す */
export function matchWords(text: string, words: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase()));
}
