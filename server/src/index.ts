import "dotenv/config";
import express from "express";
import cors from "cors";
import type { GenerateRequest, GenerateResponse } from "./types.ts";
import { MODEL_NAME, generate, analyzePreferences, type AnalyzePreferenceSample } from "./gemini.ts";
import { extractReference } from "./referenceExtract.ts";
import { compareReference } from "./referenceCompare.ts";

const PORT = Number(process.env.PORT || 3001);

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ],
  })
);
// Images get encoded as data URLs; 12 MB cap leaves room for ~8 MB JPEG.
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL_NAME });
});

app.post("/api/generate", async (req, res) => {
  const raw = req.body as Partial<GenerateRequest> | undefined;

  if (!raw || !Array.isArray(raw.scopes) || raw.scopes.length === 0) {
    res.status(400).json({ error: "scopes is required and must be non-empty" });
    return;
  }
  if (typeof raw.count !== "number" || ![2, 3, 4, 5, 6].includes(raw.count)) {
    res.status(400).json({ error: "count must be 2, 3, 4, 5 or 6" });
    return;
  }
  if (Array.isArray(raw.moods) && raw.moods.length > 30) {
    res.status(400).json({ error: "moods must have at most 30 items" });
    return;
  }
  if (typeof raw.extraInstructions === "string" && raw.extraInstructions.length > 2000) {
    res.status(400).json({ error: "extraInstructions must be at most 2000 characters" });
    return;
  }

  // Fill in optional/newer fields so callers without them don't crash the
  // prompt builder downstream.
  const body: GenerateRequest = {
    imageDataUrl: raw.imageDataUrl ?? null,
    scopes: raw.scopes,
    moods: raw.moods ?? [],
    count: raw.count,
    // 顔・表情・同一性は faceLock で管理（locks には含めない）。旧クライアントが
    // face/identity/expression を送ってきても実行時は無視される。参照: docs/09_face-lock統合.md
    locks: raw.locks ?? {
      body_shape: true,
      color: true,
      camera: true,
      aspect_ratio: true,
    },
    safety: raw.safety ?? "fictional_ai",
    details: raw.details as GenerateRequest["details"],
    extraInstructions: raw.extraInstructions ?? "",
    faceLock: raw.faceLock ?? true,
    ngList: raw.ngList ?? "",
    viralMode: raw.viralMode ?? false,
    // Optional sliders — must be forwarded so promptSystem can use them
    ...(raw.strength            !== undefined && { strength:            raw.strength }),
    ...(raw.glossLevel          !== undefined && { glossLevel:           raw.glossLevel }),
    ...(raw.dimensionLevel      !== undefined && { dimensionLevel:       raw.dimensionLevel }),
    ...(raw.textureOriginal     !== undefined && { textureOriginal:      raw.textureOriginal }),
    ...(raw.textureDisabled     !== undefined && { textureDisabled:      raw.textureDisabled }),
    ...(raw.promptTarget        !== undefined && { promptTarget:         raw.promptTarget }),
    ...(raw.autoMoodCategories  !== undefined && { autoMoodCategories:   raw.autoMoodCategories }),
    // ── 以下、前セッションで追加されたフィールド（転送漏れ修正）──────────────────
    ...(raw.avoidCliche   !== undefined && { avoidCliche:   raw.avoidCliche }),
    ...(raw.era           !== undefined && { era:           raw.era }),
    ...(raw.colorStrategy !== undefined && { colorStrategy: raw.colorStrategy }),
    ...(raw.artStyle      !== undefined && { artStyle:      raw.artStyle }),
    ...(raw.expression    !== undefined && { expression:    raw.expression }),
    ...(Array.isArray(raw.recentGenres) && { recentGenres:  raw.recentGenres.slice(0, 24).map(String) }),
    ...(Array.isArray(raw.recentSubStyles) && { recentSubStyles: raw.recentSubStyles.slice(0, 30).map(String) }),
    ...(Array.isArray(raw.favoriteTraits) && { favoriteTraits: raw.favoriteTraits.slice(0, 12).map(String) }),
    ...(typeof raw.favoriteStrength === "number" && { favoriteStrength: raw.favoriteStrength }),
    ...(raw.zozoTrend && typeof raw.zozoTrend === "object" && Array.isArray(raw.zozoTrend.traits) && {
      zozoTrend: {
        ageLabel: String(raw.zozoTrend.ageLabel ?? ""),
        traits: raw.zozoTrend.traits.slice(0, 10).map(String),
        ...(raw.zozoTrend.mode === "priority" || raw.zozoTrend.mode === "assist"
          ? { mode: raw.zozoTrend.mode }
          : {}),
      },
    }),
    ...(Array.isArray(raw.boosts) && { boosts: raw.boosts.slice(0, 8).map(String) }),
    ...(Array.isArray(raw.motifControls) && {
      motifControls: raw.motifControls
        .slice(0, 30)
        .filter((c): c is { label: string; level: number } =>
          !!c && typeof c.label === "string" && typeof c.level === "number")
        .map((c) => ({ label: String(c.label), level: c.level })),
    }),
    ...(typeof raw.windLevel === "number" && raw.windLevel >= 0 && raw.windLevel <= 5 && {
      windLevel: Math.floor(raw.windLevel),
    }),
    ...(Array.isArray(raw.comboControls) && {
      comboControls: raw.comboControls
        .slice(0, 20)
        .filter((c): c is { labels: string[]; policy: "block" | "alt" } =>
          !!c && Array.isArray(c.labels) && (c.policy === "block" || c.policy === "alt"))
        .map((c) => ({ labels: c.labels.slice(0, 4).map(String), policy: c.policy })),
    }),
    ...(typeof raw.realismLevel === "number" && raw.realismLevel >= 1 && raw.realismLevel <= 5 && {
      realismLevel: Math.floor(raw.realismLevel),
    }),
    ...(typeof raw.realismType === "string" && raw.realismType.length > 0 && raw.realismType.length <= 30 && {
      realismType: String(raw.realismType),
    }),
    ...(Array.isArray(raw.colorControls) && {
      colorControls: raw.colorControls
        .slice(0, 12)
        .filter((c): c is { colorId: string; jp: string; policy: "restrict" | "block" } =>
          !!c
          && typeof c.colorId === "string"
          && typeof c.jp === "string"
          && (c.policy === "restrict" || c.policy === "block"))
        .map((c) => ({
          colorId: String(c.colorId),
          jp:      String(c.jp),
          policy:  c.policy,
        })),
    }),
    ...(Array.isArray(raw.colorWeights) && {
      colorWeights: raw.colorWeights
        .slice(0, 60)  // 12色 × 3軸 × 一応の上限余裕
        .filter((c): c is { colorId: string; jp: string; axis: "hair" | "outfit" | "background"; weight: 0|1|2|4|5 } =>
          !!c
          && typeof c.colorId === "string"
          && typeof c.jp === "string"
          && (c.axis === "hair" || c.axis === "outfit" || c.axis === "background")
          && typeof c.weight === "number"
          && [0, 1, 2, 4, 5].includes(c.weight))
        .map((c) => ({
          colorId: String(c.colorId),
          jp:      String(c.jp),
          axis:    c.axis,
          weight:  c.weight,
        })),
    }),
    ...(raw.preferenceProfile && typeof raw.preferenceProfile === "object" && {
      preferenceProfile: (() => {
        const p = raw.preferenceProfile as Record<string, unknown>;
        const str = (v: unknown, max = 300) => typeof v === "string" ? v.slice(0, max) : "";
        const arr = (v: unknown, max = 5) =>
          Array.isArray(v)
            ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((s) => s.slice(0, 60))
            : [];
        const triple = (v: unknown) => {
          const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
          return { bg: str(o.bg, 200), outfit: str(o.outfit, 200), pose: str(o.pose, 200) };
        };
        return {
          generatedAt: typeof p.generatedAt === "number" ? p.generatedAt : Date.now(),
          model:       str(p.model, 60),
          sampleSize:  typeof p.sampleSize === "number" ? Math.max(0, Math.floor(p.sampleSize)) : 0,
          likes:       triple(p.likes),
          dislikes:    triple(p.dislikes),
          preferKeywords: arr(p.preferKeywords),
          avoidKeywords:  arr(p.avoidKeywords),
          summary:        str(p.summary, 500),
        };
      })(),
    }),
    ...(raw.ratingBias && typeof raw.ratingBias === "object" && {
      ratingBias: {
        ...(Array.isArray(raw.ratingBias.recommended) && {
          recommended: raw.ratingBias.recommended
            .slice(0, 10)
            .filter((c): c is { axis: string; label: string; score: number } =>
              !!c && typeof c.axis === "string" && typeof c.label === "string" && typeof c.score === "number")
            .map((c) => ({
              axis:  String(c.axis).slice(0, 20),
              label: String(c.label).slice(0, 40),
              score: Math.max(-5, Math.min(5, c.score)),
            })),
        }),
        ...(Array.isArray(raw.ratingBias.avoid) && {
          avoid: raw.ratingBias.avoid
            .slice(0, 10)
            .filter((c): c is { axis: string; label: string; score: number } =>
              !!c && typeof c.axis === "string" && typeof c.label === "string" && typeof c.score === "number")
            .map((c) => ({
              axis:  String(c.axis).slice(0, 20),
              label: String(c.label).slice(0, 40),
              score: Math.max(-5, Math.min(5, c.score)),
            })),
        }),
        ...(raw.ratingBias.preference && typeof raw.ratingBias.preference === "object" && Array.isArray(raw.ratingBias.preference.axes) && {
          preference: {
            active: !!raw.ratingBias.preference.active,
            axes: raw.ratingBias.preference.axes
              .slice(0, 3)
              .filter((a): a is { axis: "bg"|"outfit"|"pose"; good: number; bad: number; goodRatio: number; badRatio: number } =>
                !!a && (a.axis === "bg" || a.axis === "outfit" || a.axis === "pose")
                && typeof a.good === "number" && typeof a.bad === "number"
                && typeof a.goodRatio === "number" && typeof a.badRatio === "number")
              .map((a) => ({
                axis:      a.axis,
                good:      Math.max(0, Math.floor(a.good)),
                bad:       Math.max(0, Math.floor(a.bad)),
                goodRatio: Math.max(0, Math.min(1, a.goodRatio)),
                badRatio:  Math.max(0, Math.min(1, a.badRatio)),
              })),
          },
        }),
      },
    }),
    ...(raw.imageBias && typeof raw.imageBias === "object" && {
      imageBias: {
        ...(Array.isArray(raw.imageBias.overused) && {
          overused: raw.imageBias.overused
            .slice(0, 10)
            .filter((c): c is { axis: string; label: string; ratio: number } =>
              !!c && typeof c.axis === "string" && typeof c.label === "string" && typeof c.ratio === "number")
            .map((c) => ({ axis: String(c.axis).slice(0, 20), label: String(c.label).slice(0, 40), ratio: Math.max(0, Math.min(1, c.ratio)) })),
        }),
        ...(Array.isArray(raw.imageBias.underused) && {
          underused: raw.imageBias.underused
            .slice(0, 12)
            .filter((c): c is { axis: string; label: string } =>
              !!c && typeof c.axis === "string" && typeof c.label === "string")
            .map((c) => ({ axis: String(c.axis).slice(0, 20), label: String(c.label).slice(0, 40) })),
        }),
        ...(typeof raw.imageBias.visualDupCount === "number" && {
          visualDupCount: Math.max(0, Math.floor(raw.imageBias.visualDupCount)),
        }),
      },
    }),
  };

  try {
    const proposals = await generate(body);
    const response: GenerateResponse = { proposals };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/generate] failed:", message);
    res.status(500).json({ error: message });
  }
});

// ── 好みプロファイル分析エンドポイント（実 AI 呼び出し） ─────────────────
app.post("/api/analyze-preferences", async (req, res) => {
  const raw = req.body as { samples?: unknown } | undefined;
  if (!raw || !Array.isArray(raw.samples)) {
    res.status(400).json({ error: "samples must be an array" });
    return;
  }
  if (raw.samples.length === 0) {
    res.status(400).json({ error: "samples is empty" });
    return;
  }
  // 入力バリデーション（一定の型に絞り込む）
  const samples: AnalyzePreferenceSample[] = (raw.samples as unknown[])
    .slice(0, 100)
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      prompt:    typeof s.prompt === "string" ? s.prompt.slice(0, 1500) : "",
      overall:   typeof s.overall === "number" && [1, 2, 3, 5].includes(s.overall) ? s.overall : 3,
      bg:        s.bg     === 5 || s.bg     === 1 ? s.bg     : null,
      outfit:    s.outfit === 5 || s.outfit === 1 ? s.outfit : null,
      pose:      s.pose   === 5 || s.pose   === 1 ? s.pose   : null,
      // BUG-7: new Date(x).toISOString() は有効範囲外（|x|>8.64e15ms）や非有限値で RangeError を投げる。
      // 有限かつ有効な Date 範囲の数値のみ採用し、それ以外は現在時刻にフォールバック。
      createdAt:
        typeof s.createdAt === "number" && Number.isFinite(s.createdAt) &&
        s.createdAt >= 0 && s.createdAt <= 8.64e15
          ? s.createdAt
          : Date.now(),
    }))
    .filter((s) => s.prompt.length > 0);

  if (samples.length === 0) {
    res.status(400).json({ error: "no valid samples after sanitization" });
    return;
  }

  console.log(`[/api/analyze-preferences] start: ${samples.length} samples`);
  try {
    const { result, model } = await analyzePreferences(samples);
    res.json({
      result,
      model,
      sampleSize: samples.length,
      generatedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/analyze-preferences] failed:", message);
    res.status(500).json({ error: message });
  }
});

// ── 参照ピッカー：画像から要素抽出（Gemini Vision・13カテゴリJSON）─────────────
app.post("/api/extract-reference", async (req, res) => {
  const raw = req.body as { imageDataUrl?: unknown } | undefined;
  const url = raw?.imageDataUrl;
  if (typeof url !== "string" || !url.startsWith("data:image/")) {
    res.status(400).json({ error: "imageDataUrl (data:image/...;base64) is required" });
    return;
  }
  console.log("[/api/extract-reference] start");
  try {
    const out = await extractReference(url);
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/extract-reference] failed:", message);
    res.status(500).json({ error: message });
  }
});

app.post("/api/compare-reference", async (req, res) => {
  const raw = req.body as { resultImageDataUrl?: unknown; referenceItems?: unknown } | undefined;
  const url = raw?.resultImageDataUrl;
  const items = raw?.referenceItems;
  if (typeof url !== "string" || !url.startsWith("data:image/")) {
    res.status(400).json({ error: "resultImageDataUrl (data:image/...;base64) is required" });
    return;
  }
  if (!items || typeof items !== "object" || Array.isArray(items)) {
    res.status(400).json({ error: "referenceItems (object) is required" });
    return;
  }
  // 値は文字列のみ・各160字に制限（過大入力防止）
  const sanitizedItems: Record<string, string> = {};
  for (const [k, v] of Object.entries(items as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) sanitizedItems[k] = v.trim().slice(0, 160);
  }
  console.log("[/api/compare-reference] start");
  try {
    const out = await compareReference(url, sanitizedItems);
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/compare-reference] failed:", message);
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
  console.log(`[server] model: ${MODEL_NAME}`);
});
