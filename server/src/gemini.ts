import { GoogleGenAI } from "@google/genai";
import type { Part } from "@google/genai";
import type { GenerateRequest, GeneratedProposal } from "./types.ts";
import { buildSystemPrompt, buildUserPrompt, safetySanitizePrompt, nanoSanitizePrompt } from "./promptSystem.ts";
import { planBatch, shouldApplyVariety } from "./varietyEngine.ts";
import { planSubStylesForBatch } from "./outfitSubStyles.ts";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in server/.env");
}

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const MODEL_NAME = model;

const ai = new GoogleGenAI({ apiKey });

// ── 好みプロファイル分析（structured JSON 出力） ────────────────────────

export interface AnalyzePreferenceSample {
  prompt: string;
  overall: number;             // 5/3/2/1
  bg:     number | null;        // 5/1/null
  outfit: number | null;
  pose:   number | null;
  createdAt: number;
}

export interface AnalyzePreferenceResult {
  likes:    { bg: string; outfit: string; pose: string };
  dislikes: { bg: string; outfit: string; pose: string };
  preferKeywords: string[];
  avoidKeywords:  string[];
  summary: string;
}

/**
 * Gemini Flash に「好み傾向の分析」を依頼し、構造化 JSON で結果を取得。
 * 失敗時は例外を投げる（HTTP 500 になる）。
 */
export async function analyzePreferences(
  samples: AnalyzePreferenceSample[],
): Promise<{ result: AnalyzePreferenceResult; model: string }> {
  if (samples.length === 0) {
    throw new Error("samples is empty");
  }

  // 評価ラベル
  const ratingJp = (n: number | null) =>
    n === 5 ? "良い(👍)" : n === 3 ? "普通(😐)" : n === 2 ? "微妙(👎)" : n === 1 ? "失敗(💀)" : "未評価";

  // プロンプト本文を構築（短く・JSON サンプル付き）
  const sampleLines = samples.slice(0, 60).map((s, i) => {
    return [
      `--- サンプル ${i + 1} ---`,
      `日時: ${new Date(s.createdAt).toISOString().slice(0, 10)}`,
      `全体評価: ${ratingJp(s.overall)}`,
      `背景評価: ${ratingJp(s.bg)} / 衣装評価: ${ratingJp(s.outfit)} / ポーズ評価: ${ratingJp(s.pose)}`,
      `プロンプト本文:`,
      (s.prompt ?? "").slice(0, 800),
    ].join("\n");
  }).join("\n\n");

  const system = [
    "あなたは画像生成プロンプトの好み傾向分析の専門家です。",
    "ユーザーが過去に生成したプロンプト本文と、自身で付けた評価（👍良い/😐普通/👎微妙/💀失敗）から、",
    "ユーザーの好みの傾向を抽出してください。",
    "",
    "重要：",
    "  - 出力は厳密に JSON のみ。コードブロック・前置き・後置き・改行装飾は不要。",
    "  - 各フィールドは指定の型・要素数を守る。",
    "  - 日本語の自然な短文で記述。",
  ].join("\n");

  const userPrompt = [
    `【分析対象】合計 ${samples.length} 件の評価データ：`,
    "",
    sampleLines,
    "",
    "【出力 JSON 仕様】",
    "{",
    '  "likes":    { "bg": "...", "outfit": "...", "pose": "..." },',
    '  "dislikes": { "bg": "...", "outfit": "...", "pose": "..." },',
    '  "preferKeywords": ["...", "..."],   // 次回プロンプトで優先したい表現（最大5、日本語）',
    '  "avoidKeywords":  ["...", "..."],   // 次回プロンプトで避けるべき表現（最大5、日本語）',
    '  "summary": "ユーザー好み傾向の要約（2-3文）"',
    "}",
    "",
    "likes/dislikes の各フィールドは、その軸でユーザーが好む/嫌う傾向を1-2文の自然な日本語で。",
    "明確な傾向が読み取れない場合は「明確な傾向なし」と書く。サンプルが少なくても無理に推測しない。",
    "",
    "JSON のみ返す：",
  ].join("\n");

  const response = await ai.models.generateContent({
    model,
    contents: [
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    config: {
      systemInstruction: system,
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason as string | undefined;
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      throw new Error(`分析がブロックされました（${finishReason}）`);
    }
    throw new Error(`Gemini が空の応答を返しました（finishReason: ${finishReason ?? "unknown"}）`);
  }

  // JSON パース
  let parsed: AnalyzePreferenceResult;
  try {
    const obj = JSON.parse(text);
    parsed = sanitizeAnalysisResult(obj);
  } catch (err) {
    throw new Error(`Gemini の応答が JSON として解析できません: ${(err as Error).message}`);
  }

  return { result: parsed, model };
}

/** Gemini の応答が型に合致するかチェック＋デフォルト埋め */
function sanitizeAnalysisResult(obj: unknown): AnalyzePreferenceResult {
  if (!obj || typeof obj !== "object") {
    throw new Error("レスポンスがオブジェクトではありません");
  }
  const o = obj as Record<string, unknown>;
  const strField = (v: unknown, max = 200): string =>
    typeof v === "string" ? v.slice(0, max).trim() : "明確な傾向なし";
  const arrField = (v: unknown, max = 5): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string")
      .slice(0, max)
      .map((s) => s.slice(0, 60).trim())
      .filter((s) => s.length > 0);
  };
  const triple = (v: unknown): { bg: string; outfit: string; pose: string } => {
    const o2 = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return {
      bg:     strField(o2.bg),
      outfit: strField(o2.outfit),
      pose:   strField(o2.pose),
    };
  };
  return {
    likes:    triple(o.likes),
    dislikes: triple(o.dislikes),
    preferKeywords: arrField(o.preferKeywords),
    avoidKeywords:  arrField(o.avoidKeywords),
    summary: strField(o.summary, 400),
  };
}

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

/**
 * Gemini が返す本文を提案 N 件に分割する。
 * Gemini は指示通りに区切り行を入れないことがあるため、複数戦略でフォールバックする：
 *  A) 推奨区切り「---案区切り---」
 *  B) 単なる「---」のみの行
 *  C) 「【前提】」を行頭起点に分割（unified format は必ず【前提】から始まる）
 * いずれでも 2 件以上に割れなければ、丸ごと 1 件として返す。
 */
function splitProposals(text: string, count: number): string[] {
  const t = text.trim();
  if (!t) return [];

  const strategies: RegExp[] = [
    /^[ \t]*-{3,}\s*案区切り\s*-{3,}[ \t]*$/m,    // ---案区切り---
    /^[ \t]*-{3,}[ \t]*$/m,                         // ---
    new RegExp("(?=^\\s*【前提】)", "m"),           // 【前提】の行頭手前で分割（lookahead）
  ];

  for (const re of strategies) {
    const parts = t
      .split(re)
      .map(normalizeChunk)
      .filter((p) => p.length > 0);
    if (parts.length >= 2) {
      const cut = parts.slice(0, count);
      if (cut.length >= 2) return cut;
    }
  }

  return [normalizeChunk(t)].filter((p) => p.length > 0);
}

/** 1 案分の本文を整える：先頭のゴミ行（「以下が…」「案1：」等）を【前提】まで切り捨て。 */
function normalizeChunk(s: string): string {
  const trimmed = s.trim();
  const idx = trimmed.indexOf("【前提】");
  return (idx >= 0 ? trimmed.slice(idx) : trimmed).trim();
}

/**
 * 統一プロンプト生成。
 * 1回の Gemini 呼び出しで N 案を取得し、target="unified" でラベリングして返す。
 */
export async function generate(req: GenerateRequest): Promise<GeneratedProposal[]> {
  // マンネリ回避エンジン：ジャンル抽選をコード側で実施（単純ランダム禁止）。
  // シーン系スコープ or 神引き時のみ適用。髪だけ等の部分編集ではシーンを変えない
  // （固定軸の維持に反するため）ので plan は undefined にする。
  // 同じ plan をプロンプト生成と案へのジャンル付与の両方で使う（二重抽選を防ぐ）。
  const plan = shouldApplyVariety(req) ? planBatch(req) : undefined;

  // 衣装サブジャンル展開：outfit スコープ＋大カテゴリ指定時のみ発動
  const subStylePlan = planSubStylesForBatch(req) ?? undefined;

  const systemPrompt = buildSystemPrompt(req, plan, subStylePlan);
  const userText = buildUserPrompt(req);

  const parts: Part[] = [{ text: userText }];
  if (req.imageDataUrl) {
    const parsed = parseDataUrl(req.imageDataUrl);
    if (parsed) {
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.95,
      topP: 0.95,
    },
  });

  // response.text は安全フィルター発動時に null / undefined になる。
  // SDK によっては getter が throw することもあるので try/catch で保護。
  let text = "";
  try {
    text = (response.text ?? "").trim();
  } catch {
    // getter が throw した場合は空文字として扱い、後続の原因判定へ
  }

  // テキストが空の場合は finishReason / blockReason から原因を特定して
  // ユーザーが対処できる日本語メッセージを返す。
  if (!text) {
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason as string | undefined;

    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      // エラーメッセージに PROHIBITED_CONTENT を含める（クライアント側の検知に使用）
      throw new Error(
        `プロンプトがブロックされました（PROHIBITED_CONTENT）。` +
        "入力画像・追加指示・NG指定を変更してお試しください。"
      );
    }
    if (finishReason === "RECITATION") {
      throw new Error(
        "著作権保護コンテンツの引用と判定されブロックされました（RECITATION）。" +
        "追加指示の内容を変えてお試しください。"
      );
    }
    if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
      throw new Error(
        `Gemini の生成が異常終了しました（finishReason: ${finishReason}）。` +
        "しばらく待ってから再試行してください。"
      );
    }

    // promptFeedback はSDKの型に含まれないため any でアクセス
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blockReason = (response as any).promptFeedback?.blockReason as string | undefined;
    if (blockReason) {
      throw new Error(
        `プロンプトがブロックされました（${blockReason}）。` +
        "入力画像・追加指示・NG指定を変更してお試しください。"
      );
    }

    throw new Error(
      "Gemini が空のレスポンスを返しました。" +
      "しばらく待ってから再試行するか、画像や指示の内容を変えてお試しください。"
    );
  }

  const proposals = splitProposals(text, req.count);
  if (proposals.length === 0) {
    throw new Error("レスポンスを案に分割できませんでした。もう一度生成してください。");
  }

  const result: GeneratedProposal[] = proposals.map((body, idx) => {
    const sanitized = safetySanitizePrompt(body);
    const finalBody = req.promptTarget === "nano_safe"
      ? nanoSanitizePrompt(sanitized)
      : sanitized;
    // 抽選したジャンルを案に付与（クライアントが recentGenres として往復させる）。
    // plan は部分編集時 undefined。その場合ジャンルは付与しない。
    const planItem = plan?.items[idx];
    const subItem = subStylePlan?.items[idx];
    return {
      index: idx + 1,
      target: "unified",
      body: finalBody,
      ...(planItem && {
        genre: planItem.genreId,
        genreLabel: planItem.genreLabel,
        surprise: planItem.surprise,
      }),
      ...(subItem && subItem.picks.length > 0 && {
        subStyles: subItem.picks.map((p) => p.id),
      }),
    };
  });

  return result;
}
