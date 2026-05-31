import type { GeneratedProposal, PromptInputs } from "../types";

export interface BackendResponse {
  proposals: GeneratedProposal[];
  warnings?: string[];
}

export interface BackendError {
  error: string;
}

export async function generateViaBackend(
  inputs: PromptInputs,
  imageDataUrl: string | null,
  recentGenres: string[] = [],
  recentSubStyles: string[] = []
): Promise<BackendResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      recentGenres,
      recentSubStyles,
      scopes: inputs.scopes,
      moods: inputs.moods,
      count: inputs.count,
      locks: inputs.locks,
      safety: inputs.safety,
      details: inputs.details,
      extraInstructions: inputs.extraInstructions,
      faceLock: inputs.faceLock,
      ngList: inputs.ngList,
      viralMode: inputs.viralMode,
      strength: inputs.strength,
      glossLevel: inputs.glossLevel,
      dimensionLevel: inputs.dimensionLevel,
      textureOriginal: inputs.textureOriginal,
      textureDisabled: inputs.textureDisabled,
      promptTarget: inputs.promptTarget,
      autoMoodCategories: inputs.autoMoodCategories,
      avoidCliche: inputs.avoidCliche,
      era: inputs.era,
      colorStrategy: inputs.colorStrategy,
      artStyle: inputs.artStyle,
      expression: inputs.expression,
      favoriteTraits: inputs.favoriteTraits,
      favoriteStrength: inputs.favoriteStrength,
      zozoTrend: inputs.zozoTrend,
      boosts: inputs.boosts,
      motifControls: inputs.motifControls,
      comboControls: inputs.comboControls,
      windLevel: inputs.windLevel,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as BackendError;
      detail = j.error;
    } catch {
      detail = await res.text();
    }
    throw new Error(`Backend error (${res.status}): ${detail || "unknown"}`);
  }
  return (await res.json()) as BackendResponse;
}

export async function checkBackendHealth(): Promise<{ ok: boolean; model?: string }> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
