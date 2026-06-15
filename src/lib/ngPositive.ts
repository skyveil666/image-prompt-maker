/**
 * ngPositive — NG（除外）指定を「否定形のまま【NG】に載せる」だけでなく、
 * 可能なものは肯定形の誘導文に変換してプロンプトへ加える。
 * GPT Image は否定指定（「室内を出すな」等）を守りにくいため、肯定方向（「屋外・広い空」）で誘導する。
 *
 * - NG_POSITIVE_MAP に該当する語 → 肯定誘導（extraInstructions へ相乗り）。
 * - 該当しない語 → 従来どおり【NG】（ngList）へ。禁止モチーフは英語類語展開（expandForbiddenTokens）。
 * - サーバ promptSystem(§4) は無改修：既存の ngList / extraInstructions フィールドに乗せるだけ。
 */
import { expandForbiddenTokens } from "./forbiddenTokens";

/** 「避けたい語（同義語含む）」→「肯定方向の誘導文」。入力語に synonym が含まれれば該当。 */
const NG_POSITIVE_MAP: { synonyms: string[]; positive: string }[] = [
  { synonyms: ["室内", "屋内", "インドア", "indoor"], positive: "屋外の開けた場所・広い空・自然光・開放感のある空間" },
  { synonyms: ["露出高め", "露出多め", "過度な露出", "露出"], positive: "露出を抑えた上品な服装・肌の出し過ぎない装い" },
  { synonyms: ["暗い", "暗すぎ", "暗め"], positive: "明るくクリアな光・軽やかで見やすい照明" },
  { synonyms: ["武器", "刃物"], positive: "武器を持たず手ぶら、または日常的な小物のみ" },
  { synonyms: ["群衆", "人混み", "モブ", "他人", "大勢"], positive: "被写体は主役1人のみ・背景に他の人物を入れない構図" },
  { synonyms: ["子供っぽい", "幼い"], positive: "大人びた落ち着いた佇まい・成人の雰囲気" },
  { synonyms: ["ごちゃごちゃ", "雑多", "散らかり"], positive: "すっきり整理された背景・余白のあるミニマルな構成" },
];

/** 入力語が対応表に該当すれば肯定誘導文、なければ null。 */
function matchPositive(term: string): string | null {
  const lc = term.toLowerCase();
  for (const e of NG_POSITIVE_MAP) {
    if (e.synonyms.some((s) => lc.includes(s.toLowerCase()))) return e.positive;
  }
  return null;
}

/**
 * NG欄文字列＋禁止モチーフを「【NG】へ載せる否定形(ngForBlock)」と「肯定誘導文(positiveGuidance)」に振り分ける。
 * buildInputs() でプロンプト組み立て前にクライアント側で呼ぶ（サーバ無改修）。
 */
export function splitNg(
  ngList: string,
  forbiddenTokens: string[],
): { ngForBlock: string; positiveGuidance: string } {
  const positives: string[] = [];
  const seen = new Set<string>();
  const addPositive = (p: string) => {
    if (!seen.has(p)) { seen.add(p); positives.push(p); }
  };

  // NG欄（自由文）：区切りで分割し、対応表該当は肯定誘導へ、その他は【NG】へ残す。
  const ngRemain: string[] = [];
  for (const t of ngList.split(/[\n,、/／・]+/).map((s) => s.trim()).filter(Boolean)) {
    const hit = matchPositive(t);
    if (hit) addPositive(hit);
    else ngRemain.push(t);
  }

  // 禁止モチーフ（チップ）：対応表該当は肯定誘導、その他は英語類語展開して【NG】へ。
  const tokRemain: string[] = [];
  for (const tok of forbiddenTokens.map((s) => s.trim()).filter(Boolean)) {
    const hit = matchPositive(tok);
    if (hit) addPositive(hit);
    else tokRemain.push(tok);
  }
  const expanded = expandForbiddenTokens(tokRemain).join(", ");

  const ngForBlock = [ngRemain.join(", "), expanded].filter(Boolean).join("\n");
  const positiveGuidance = positives.length
    ? `【避けたい要素を肯定方向で】${positives.join("、")}`
    : "";
  return { ngForBlock, positiveGuidance };
}
