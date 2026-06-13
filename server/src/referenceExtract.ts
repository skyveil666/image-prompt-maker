/**
 * referenceExtract — Reference Picker（参照ピッカー）用の Gemini Vision 要素抽出。
 *
 * 参照画像を実際に観察し、「画像に見える要素だけ」を生成に使える具体プロンプト素材として
 * 13カテゴリ固定の JSON で返す。説明文ではなく素材。人物の顔・同一性・年齢は出さない。
 *
 * ※ 既存 gemini.ts / promptSystem.ts / scopeFilter.ts のロジックは変更しない（本ファイルは独立）。
 */
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/** 13カテゴリ固定キー（フロント REFERENCE_CATEGORIES と一致） */
export const REFERENCE_KEYS = [
  "background", "outfit", "hair", "pose", "composition",
  "camera", "lighting", "color", "props", "foreground",
  "world", "texture", "mood",
] as const;

/** 必ず具体的に埋める8カテゴリ（空欄・雑な一語は禁止） */
const REQUIRED_KEYS = ["background", "outfit", "hair", "pose", "composition", "camera", "lighting", "color"];

export interface ReferenceElements {
  [key: string]: string;
}

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

const SYSTEM = [
  "あなたは画像編集プロンプトツール「Reference Picker」の素材抽出器です。",
  "画像のキャプションを書くAIではありません。与えられた参照画像を実際に観察し、",
  "「実際に画像に見える要素」だけを、別画像生成に転用できる具体的なプロンプト素材として",
  "13カテゴリ固定の JSON で返してください。",
  "",
  "# 最重要・厳守",
  "- 画像に実際に写っている要素だけを書く。**画像に無いものを推測で足さない**。色・衣装・ポーズ・背景を別物に変えない。",
  "  禁止例（参照画像に無ければ絶対に書かない）：黒ゴシック / 黒レイヤード / 青ネオン / サイバー都市 /",
  "  クリスタル / 羽・翼 / HUD・ホログラム。これらは画像に明確に見える場合のみ書く。",
  "- 人物の顔・目鼻立ち・肌・表情・年齢・性別・人種・個人や特定キャラクターの同一性は一切書かない。",
  "  髪・衣装・ポーズは『見た目のスタイル』としてのみ書く（本人特定はしない）。",
  "- 実在人物名・キャラ名・作品名・ブランド名・作者名・ロゴ・透かし・画像内文字は出さない。",
  "- 各値は『生成に使える具体的なプロンプト素材』。説明文（「〜です」「人物が〜」）は禁止。",
  "  日本語の語句を「、」で区切って具体的に列挙する。",
  "- background / outfit / hair / pose / composition / camera / lighting / color は",
  "  必ず具体的に埋める（空欄・「不明」・雑な一語は禁止）。",
  "  props / foreground / world / texture / mood は、画像に該当が見えれば埋め、無ければ \"\"。",
  "- 元画像の『印象』が残るよう、空気感・世界観・色温度・感情トーンも具体的に拾う。",
  "",
  "# 各カテゴリの観点（実際に見えるものを具体的に・列挙する）",
  "- background: 場所・奥行き・壁・床・窓・建築構造・家具・光源・明るさ・色味",
  "- outfit: 色・素材・形・丈・レイヤード(重ね着)・トップス・ボトムス・靴・アクセサリー・シルエット",
  "- hair: 長さ・前髪の有無・毛流れ・質感・色（顔・本人特定は書かない）",
  "- pose: 立ち/座り・体の向き・重心・手の位置・脚の位置・視線・カメラとの角度",
  "- composition: 構図(縦長/横長)・被写体の配置・写っている範囲(全身/上半身等)・余白",
  "- camera: アングル(正面/見上げ/見下ろし)・距離(寄り/引き)・視点の高さ",
  "- lighting: 光の方向・強さ・色温度(暖色/寒色)・影の硬さ",
  "- color: 全体の配色・トーン・彩度・色温度(実際に見える色を中心に)",
  "- props: 手元/周囲の小物・アクセサリー(見えるもののみ)",
  "- foreground: 手前の演出・前ボケ・粒子(見えるもののみ)",
  "- world: 世界観・時代/文化・空間の雰囲気(固有作品名は不可)",
  "- texture: 質感・描画傾向(実写/イラスト/グレイン/マット/光沢)",
  "- mood: 全体の空気感・感情トーン(静か/緊張感/儚さ/退廃 等)",
  "",
  "# 出力（このキー・順序で固定・JSONのみ。前置き/後置き/コードブロック不要）",
  '{"background":"","outfit":"","hair":"","pose":"","composition":"","camera":"","lighting":"","color":"","props":"","foreground":"","world":"","texture":"","mood":""}',
].join("\n");

const USER = [
  "この参照画像を実際に観察し、上記ルールで13カテゴリの JSON を返してください。",
  "background / outfit / hair / pose / composition / camera / lighting / color は必ず具体的に埋めること。",
  "画像に無い要素を足さないこと。JSON のみ返す：",
].join("\n");

/** Gemini 応答を13キー固定・string に整える（不足キーは ""、長すぎは切り詰め） */
function sanitize(obj: unknown): ReferenceElements {
  const o = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  const out: ReferenceElements = {};
  for (const k of REFERENCE_KEYS) {
    const v = o[k];
    out[k] = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 160) : "";
  }
  return out;
}

export interface ExtractReferenceResult {
  version: 2;
  elements: ReferenceElements;
  model: string;
  /** 必須カテゴリのうち空だったキー（UI 警告用・任意） */
  missingRequired: string[];
}

/**
 * 参照画像から13カテゴリ要素を抽出する。失敗時は例外（HTTP 500）。
 */
export async function extractReference(imageDataUrl: string): Promise<ExtractReferenceResult> {
  if (!ai) throw new Error("GEMINI_API_KEY is not set in server/.env");
  const img = parseDataUrl(imageDataUrl);
  if (!img) throw new Error("imageDataUrl must be a data:image/...;base64 URL");

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: img.mimeType, data: img.data } },
          { text: USER },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  let text: string | null | undefined;
  try {
    text = response.text;
  } catch {
    // getter が throw した場合は null として扱い、後続の原因判定へ
  }
  if (!text) {
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason as string | undefined;
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      throw new Error(`抽出がブロックされました（${finishReason}）。別の画像をお試しください。`);
    }
    throw new Error(`Gemini が空の応答を返しました（finishReason: ${finishReason ?? "unknown"}）`);
  }

  let elements: ReferenceElements;
  try {
    elements = sanitize(JSON.parse(text));
  } catch (err) {
    throw new Error(`Gemini の応答が JSON として解析できません: ${(err as Error).message}`);
  }

  const missingRequired = REQUIRED_KEYS.filter((k) => !elements[k]);
  return { version: 2, elements, model, missingRequired };
}
