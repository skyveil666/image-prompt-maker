import "dotenv/config";
import express from "express";
import cors from "cors";
import type { GenerateRequest, GenerateResponse } from "./types.ts";
import { MODEL_NAME, generate } from "./gemini.ts";

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
    locks: raw.locks ?? {
      face: true,
      body_shape: true,
      expression: true,
      identity: true,
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

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
  console.log(`[server] model: ${MODEL_NAME}`);
});
