/**
 * High-level history operations. Wraps lib/idb.ts (history store) and adds
 * convenience helpers like month aggregation and patch-update.
 */
import * as idb from "./idb";
import { STORE_HISTORY } from "./idb";
import type {
  Count,
  DetailSettings,
  GeneratedProposal,
  LockKey,
  Mood,
  OutputTarget,
  PromptHistoryItem,
  PromptInputs,
  SafetyMode,
  Scope,
} from "../types";

/** YYYY-MM-DD（ローカルタイム）。 */
export function dateKeyOf(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface BuildArgs {
  proposals: GeneratedProposal[];
  target: OutputTarget;
  batchId: string;
  inputs: Omit<PromptInputs, "target">;
  thumbnail: string | null;
  /** 使用したプリセット名（任意） */
  presetName?: string;
}

/** API レスポンスの proposals を PromptHistoryItem[] に正規化する。 */
export function buildHistoryItems({
  proposals,
  target,
  batchId,
  inputs,
  thumbnail,
  presetName,
}: BuildArgs): PromptHistoryItem[] {
  const now = Date.now();
  const dk = dateKeyOf(new Date(now));
  return proposals.map((p) => ({
    id: uid(),
    batchId,
    createdAt: now,
    dateKey: dk,
    sourceImageThumbnail: thumbnail,
    resultImageData: null,
    outputType: target,
    promptText: p.body,
    proposalIndex: p.index,
    scopes: inputs.scopes,
    moods: inputs.moods,
    count: inputs.count,
    details: inputs.details,
    locks: inputs.locks,
    safety: inputs.safety,
    extraInstructions: inputs.extraInstructions,
    faceLock: inputs.faceLock,
    ngList: inputs.ngList,
    viralMode: inputs.viralMode,
    strength: inputs.strength,
    glossLevel: inputs.glossLevel,
    dimensionLevel: inputs.dimensionLevel,
    textureOriginal: inputs.textureOriginal,
    textureDisabled: inputs.textureDisabled,
    presetName,
    promptTarget: inputs.promptTarget,
    isFavorite: false,
    status: "unused",
    memo: "",
    tags: [],
  }));
}

export async function saveBatch(items: PromptHistoryItem[]): Promise<void> {
  await idb.putMany(STORE_HISTORY, items);
}

export async function getAll(): Promise<PromptHistoryItem[]> {
  return idb.getAll<PromptHistoryItem>(STORE_HISTORY);
}

export async function getByDate(dateKey: string): Promise<PromptHistoryItem[]> {
  return idb.getByIndex<PromptHistoryItem>(STORE_HISTORY, "dateKey", dateKey);
}

export async function updateItem(
  id: string,
  patch: Partial<PromptHistoryItem>
): Promise<PromptHistoryItem | null> {
  const existing = await idb.get<PromptHistoryItem>(STORE_HISTORY, id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await idb.put(STORE_HISTORY, updated);
  return updated;
}

export async function deleteItem(id: string): Promise<void> {
  await idb.remove(STORE_HISTORY, id);
}

export interface DayCounts {
  total: number;
  favorites: number;
}

/** 月内の日付別カウントを返す（year/month は 0-indexed の month を受け取る）。 */
export async function getMonthCounts(
  year: number,
  monthZeroIndexed: number
): Promise<Map<string, DayCounts>> {
  const all = await getAll();
  const prefix = `${year}-${String(monthZeroIndexed + 1).padStart(2, "0")}`;
  const counts = new Map<string, DayCounts>();
  for (const item of all) {
    if (item.dateKey.startsWith(prefix)) {
      const c = counts.get(item.dateKey) ?? { total: 0, favorites: 0 };
      c.total++;
      if (item.isFavorite) c.favorites++;
      counts.set(item.dateKey, c);
    }
  }
  return counts;
}

export type { Count, DetailSettings, LockKey, Mood, SafetyMode, Scope };
