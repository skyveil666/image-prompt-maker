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
      throw new Error(
        `安全フィルターにより生成がブロックされました（${finishReason}）。` +
        "画像の内容・追加指示・NG指定を変更してもう一度お試しください。"
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
