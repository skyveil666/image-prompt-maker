/**
 * analyzeResult — 生成結果画像を Gemini Vision で実際に観察し、衣装/背景/色/構図/前景/主役性/
 * skyveil好み仮評価などを構造化 JSON で返す（AI仮評価）。
 *
 * 設計方針:
 *   - 既存 gemini.ts / promptSystem.ts / scopeFilter.ts / referenceExtract.ts は変更しない（本ファイルは独立）。
 *   - ユーザーが「分析」ボタンを押した時だけ呼ばれる想定（自動実行しない＝コスト現実主義）。
 *   - これは AI 仮評価であり、ユーザー評価（resultRatings）とは分離して保存・表示する。
 *   - 顔・同一性は「一致しているか／崩れていないか」の安全判定のみ。個人特定・年齢推定はしない。
 */
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

// ── 取りうる値（enum）。Gemini 応答はここへクランプする ──────────────────────
const E = {
  threeQ:   ["good", "normal", "bad"] as const,            // 良い/普通/悪い
  safety:   ["ok", "caution", "risk"] as const,            // OK/注意/危険
  scheme:   ["monotone", "good", "complex"] as const,      // 単調/良い/複雑すぎ
  sep:      ["yes", "weak", "no"] as const,                // あり/弱い/なし
  level:    ["low", "mid", "high"] as const,               // 低/中/高
  strength: ["strong", "normal", "weak"] as const,         // 強い/普通/弱い
  yesno:    ["yes", "no"] as const,                        // あり/なし
  prio:     ["high", "normal", "low"] as const,            // 高/普通/低
};

export interface ResultAnalysis {
  version: 1;
  model: string;
  analyzedAt: number;
  faceMatch:            typeof E.threeQ[number];   // 顔一致
  identitySafety:       typeof E.safety[number];   // 同一性安全
  outfitStructure:      string;                    // 衣装構造（テキスト）
  outfitColorScheme:    typeof E.scheme[number];   // 衣装配色
  topBottomSeparation:  typeof E.sep[number];      // 上下別色
  outerInnerSeparation: typeof E.sep[number];      // アウター/インナー別色
  monotone:             typeof E.level[number];    // 単色化リスク（high=単色化している）
  backgroundType:       string;                    // 背景の種類（テキスト）
  backgroundRealism:    typeof E.strength[number]; // 背景リアル寄り（strong=実写寄り）
  stylization:          typeof E.strength[number]; // 2D/2.5D感（strong=2D寄り）
  colorBias:            typeof E.yesno[number];     // 色偏り
  colorBiasNote:        string;                    // 色偏りの説明
  foregroundIntensity:  typeof E.level[number];    // 前景演出の強さ
  subjectPriority:      typeof E.prio[number];      // 主役優先度
  templateRisk:         typeof E.prio[number];      // 重複/テンプレ化の可能性
  skyveilPreference:    typeof E.strength[number]; // skyveil好み仮評価（strong=高い）
  improvement:          string;                    // 次回改善提案（テキスト）
}

export interface AnalyzeResultContext {
  prompt?: string;          // その画像を生んだ生成プロンプト本文
  scopes?: string[];        // 変更対象（outfit/background 等）
}

const SYSTEM = [
  "あなたは画像生成支援ツールの「生成結果アナライザ」です。与えられた生成結果画像を実際に観察し、",
  "衣装・背景・色・構図・前景・主役性などを構造化 JSON で評価します（AI仮評価）。",
  "",
  "# 厳守",
  "- 実在人物名・キャラ名・作品名・ブランド名・年齢/性別/人種の推定・個人特定は一切しない。",
  "  顔は『元の人物像と一致して見えるか／破綻していないか』の安全判定のみ。",
  "- 画像に実際に見えるものだけで判定する。憶測で足さない。",
  "- 各 enum は指定値のいずれかのみ。テキスト項目は日本語で簡潔に（各60字以内）。",
  "- 衣装は『全体の色』ではなく、アウター/インナー/上半身/下半身/靴/小物/差し色/素材/透けに分解して観察する。",
  "  特に『全身が同系色1色で単調になっていないか（単色化）』『上下で色が分かれているか』を厳しく見る。",
  "- 背景は『実写写真寄りか／2D・2.5Dのスタイライズ寄りか』を見る。",
  "",
  "# 各項目の観点",
  "- faceMatch: 顔・人物像が自然で一致して見えるか（good/normal/bad）",
  "- identitySafety: 別人化・崩れの危険度（ok=安全 / caution / risk）",
  "- outfitStructure: 衣装の構造を分解して簡潔に（アウター/インナー/上下/靴/小物/素材/透け）",
  "- outfitColorScheme: 衣装配色（monotone=単調すぎ / good=適度 / complex=複雑すぎ）",
  "- topBottomSeparation: 上半身と下半身で色が分かれているか（yes/weak/no）",
  "- outerInnerSeparation: アウターとインナーで色が分かれているか（yes/weak/no）",
  "- monotone: 全身が同系色1色に寄った単色化の度合い（high=単色化している / mid / low）",
  "- backgroundType: 背景の種類を簡潔に（例：図書館風 / 抽象空間 / ネオン街 等）",
  "- backgroundRealism: 背景が実写写真に寄っている度合い（strong=実写寄り / normal / weak=非写実）",
  "- stylization: 2D/2.5Dのスタイライズ感（strong=2D寄り / normal=2.5D / weak=実写的）",
  "- colorBias: 画面全体が特定色に偏っているか（yes/no）、colorBiasNote にどの色かを簡潔に",
  "- foregroundIntensity: 前景演出(粒子/エフェクト/前ボケ)の強さ（low/mid/high）",
  "- subjectPriority: 人物が主役として目立っているか（high/normal/low）",
  "- templateRisk: AIっぽいテンプレ感・量産っぽさ（high=テンプレ的 / normal / low=独自）",
  "- skyveilPreference: SNS映え・幻想/様式化・色の強さ等を踏まえた好み仮評価（strong=高い / normal / weak）",
  "- improvement: 次回どう変えると良いかの具体提案（衣装配色・背景・色・構図のいずれかを必ず含める）",
  "",
  "# 出力（このキー順で固定・JSON のみ。前置き/後置き/コードブロック不要）",
  '{"faceMatch":"normal","identitySafety":"ok","outfitStructure":"","outfitColorScheme":"good","topBottomSeparation":"weak","outerInnerSeparation":"weak","monotone":"mid","backgroundType":"","backgroundRealism":"normal","stylization":"normal","colorBias":"no","colorBiasNote":"","foregroundIntensity":"mid","subjectPriority":"normal","templateRisk":"normal","skyveilPreference":"normal","improvement":""}',
].join("\n");

function buildUser(ctx: AnalyzeResultContext): string {
  const lines = [
    "この生成結果画像を実際に観察し、上記ルールで JSON を返してください。",
    "特に『衣装の色分離（上下別色・アウター/インナー別色）』『単色化していないか』『背景が実写寄りか2D/2.5D寄りか』を厳しく判定してください。",
  ];
  if (ctx.scopes && ctx.scopes.length) {
    lines.push(`参考（この画像の変更対象スコープ）: ${ctx.scopes.join(", ")}。変更対象が衣装なら衣装が実際に変化・色分離しているかを重視。`);
  }
  if (ctx.prompt) {
    lines.push(`参考（生成プロンプト抜粋）: ${ctx.prompt.slice(0, 600)}`);
  }
  lines.push("JSON のみ返す：");
  return lines.join("\n");
}

function clamp<T extends readonly string[]>(v: unknown, allowed: T, def: T[number]): T[number] {
  return (typeof v === "string" && (allowed as readonly string[]).includes(v)) ? (v as T[number]) : def;
}
function str(v: unknown, max = 80): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function sanitize(obj: unknown): Omit<ResultAnalysis, "version" | "model" | "analyzedAt"> {
  const o = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  return {
    faceMatch:            clamp(o.faceMatch,            E.threeQ,   "normal"),
    identitySafety:       clamp(o.identitySafety,       E.safety,   "ok"),
    outfitStructure:      str(o.outfitStructure, 120),
    outfitColorScheme:    clamp(o.outfitColorScheme,    E.scheme,   "good"),
    topBottomSeparation:  clamp(o.topBottomSeparation,  E.sep,      "weak"),
    outerInnerSeparation: clamp(o.outerInnerSeparation, E.sep,      "weak"),
    monotone:             clamp(o.monotone,             E.level,    "mid"),
    backgroundType:       str(o.backgroundType, 60),
    backgroundRealism:    clamp(o.backgroundRealism,    E.strength, "normal"),
    stylization:          clamp(o.stylization,          E.strength, "normal"),
    colorBias:            clamp(o.colorBias,            E.yesno,    "no"),
    colorBiasNote:        str(o.colorBiasNote, 60),
    foregroundIntensity:  clamp(o.foregroundIntensity,  E.level,    "mid"),
    subjectPriority:      clamp(o.subjectPriority,      E.prio,     "normal"),
    templateRisk:         clamp(o.templateRisk,         E.prio,     "normal"),
    skyveilPreference:    clamp(o.skyveilPreference,    E.strength, "normal"),
    improvement:          str(o.improvement, 160),
  };
}

/** 生成結果画像を Vision 分析する。失敗時は例外（HTTP 500）。 */
export async function analyzeResult(
  imageDataUrl: string,
  context: AnalyzeResultContext = {},
): Promise<ResultAnalysis> {
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
          { text: buildUser(context) },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason as string | undefined;
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      throw new Error(`分析がブロックされました（${finishReason}）。別の画像をお試しください。`);
    }
    throw new Error(`Gemini が空の応答を返しました（finishReason: ${finishReason ?? "unknown"}）`);
  }

  let parsed: Omit<ResultAnalysis, "version" | "model" | "analyzedAt">;
  try {
    parsed = sanitize(JSON.parse(text));
  } catch (err) {
    throw new Error(`Gemini の応答が JSON として解析できません: ${(err as Error).message}`);
  }

  return { version: 1, model, analyzedAt: Date.now(), ...parsed };
}
