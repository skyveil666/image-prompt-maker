/**
 * referenceCompare — Compare Mode Phase C の一致率採点（案1：画像ベース1コール）。
 *
 * 生成結果画像と「参照側の6項目テキスト（背景/衣装/ポーズ/髪型/色味/空気感）」を受け取り、
 * Gemini Vision が生成画像を観察して各項目を 0-100 で採点する。併せて生成画像の13カテゴリも抽出して返す
 * （Compare 中央表の「生成側」列・将来比較用）。
 *
 * ※ 既存 gemini.ts / promptSystem.ts / referenceExtract.ts は変更しない（本ファイルは独立）。
 * ※ 顔・同一性・年齢・人物特定は採点も記述もしない（P1〜P7）。
 */
import { GoogleGenAI } from "@google/genai";
import { REFERENCE_KEYS } from "./referenceExtract.ts";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/** 採点対象の6項目（フロント COMPARE_ITEMS と一致）。 */
export const COMPARE_KEYS = ["background", "outfit", "pose", "hair", "color", "mood"] as const;

export interface ReferenceItems {
  [key: string]: string;
}

export interface CompareReferenceResult {
  version: 1;
  /** 渡された項目のみ。0-100 の整数。 */
  scores: Record<string, number>;
  /** 任意：項目別の短評（日本語）。 */
  reasons: Record<string, string>;
  /** 生成結果画像の再抽出13カテゴリ。 */
  resultExtracted: Record<string, string>;
  model: string;
}

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

const SYSTEM = [
  "あなたは画像編集プロンプトツール「Compare Mode」の一致率スコアラーです。",
  "1枚の『生成結果画像』と、別途与えられる『参照側の項目テキスト』（背景/衣装/ポーズ/髪型/色味/空気感のうち渡された項目）を比べ、",
  "生成結果画像が各参照項目に **どれだけ一致しているか** を 0-100 の整数で採点してください。",
  "",
  "# 採点基準",
  "- 100=ほぼ完全一致 / 70-89=おおむね一致 / 40-69=部分一致 / 10-39=ほぼ不一致 / 0=無関係。",
  "- 生成結果画像に実際に見えるものと、参照テキストの記述を、具体的に照合して採点する。",
  "- 一致している点と異なる点の両方を見て、主要な属性（色・場所・形・素材・丈・構図・アングル等）が",
  "  **合っていれば高く、明確に違えば低く**する。表面的な共通点（どちらも単色／どちらも人物 等）だけで高得点にはしない。",
  "  例：参照 color が『青』で画像も青なら高い／画像が緑なら低い。",
  "- 画像に該当要素が見えない場合は低く（〜30）。確信が持てず部分的なら中間（40-69）。",
  "- 渡された項目だけ採点する（渡されていない項目はスコアに含めない）。",
  "",
  "# 厳守",
  "- 顔・目鼻立ち・肌・表情・年齢・性別・人種・個人や特定キャラクターの同一性は、採点も記述も一切しない。",
  "  髪・衣装・ポーズは『見た目のスタイル』としてのみ評価する（本人特定はしない）。",
  "- 実在人物名・キャラ名・作品名・ブランド名・作者名・ロゴ・透かし・画像内文字は出さない。",
  "- reasons は各項目1フレーズの簡潔な日本語（任意）。",
  "",
  "# 併せて：生成結果画像の13カテゴリ抽出",
  "- 生成結果画像に実際に見える要素を、別画像生成に使える具体的なプロンプト素材として13カテゴリで抽出する",
  "  （referenceExtract と同じ観点。説明文ではなく語句を「、」で列挙。見えない項目は \"\"）。",
  "",
  "# 出力（JSONのみ・前置き/コードブロック不要）",
  '{"scores":{"<渡された項目>":0-100},"reasons":{"<渡された項目>":"短評"},',
  '"generated":{"background":"","outfit":"","hair":"","pose":"","composition":"","camera":"","lighting":"","color":"","props":"","foreground":"","world":"","texture":"","mood":""}}',
].join("\n");

/** スコアを 0-100 の整数に整える（不正は除外）。 */
function sanitizeScores(obj: unknown, allowed: string[]): Record<string, number> {
  const o = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of allowed) {
    const v = o[k];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n)) out[k] = Math.max(0, Math.min(100, Math.round(n)));
  }
  return out;
}

function sanitizeReasons(obj: unknown, allowed: string[]): Record<string, string> {
  const o = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of allowed) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) out[k] = v.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return out;
}

function sanitizeExtracted(obj: unknown): Record<string, string> {
  const o = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of REFERENCE_KEYS) {
    const v = o[k];
    out[k] = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 160) : "";
  }
  return out;
}

/**
 * 生成結果画像 × 参照6項目テキスト の一致率を採点する。失敗時は例外（HTTP 500）。
 */
export async function compareReference(
  resultImageDataUrl: string,
  referenceItems: ReferenceItems,
): Promise<CompareReferenceResult> {
  if (!ai) throw new Error("GEMINI_API_KEY is not set in server/.env");
  const img = parseDataUrl(resultImageDataUrl);
  if (!img) throw new Error("resultImageDataUrl must be a data:image/...;base64 URL");

  // 採点対象＝6項目のうち中身のあるものだけ
  const allowed: string[] = COMPARE_KEYS.filter(
    (k) => typeof referenceItems[k] === "string" && referenceItems[k].trim(),
  );
  if (allowed.length === 0) throw new Error("referenceItems に採点対象（背景/衣装/ポーズ/髪型/色味/空気感）が1つもありません");

  const refLines = allowed.map((k) => `- ${k}: ${referenceItems[k].trim()}`).join("\n");
  const USER = [
    "次の『参照側の項目』に対し、添付した生成結果画像がどれだけ一致するかを採点してください。",
    "参照側の項目（この項目だけ採点）：",
    refLines,
    "ルールに従い JSON のみ返す（scores は上の項目のみ／generated は13カテゴリ）。",
  ].join("\n");

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
      throw new Error(`採点がブロックされました（${finishReason}）。別の画像をお試しください。`);
    }
    throw new Error(`Gemini が空の応答を返しました（finishReason: ${finishReason ?? "unknown"}）`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Gemini の応答が JSON として解析できません: ${(err as Error).message}`);
  }

  return {
    version: 1,
    scores: sanitizeScores(parsed.scores, allowed),
    reasons: sanitizeReasons(parsed.reasons, allowed),
    resultExtracted: sanitizeExtracted(parsed.generated),
    model,
  };
}
