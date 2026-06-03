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

/** 生成結果画像の最大保持枚数。 */
export const MAX_RESULT_IMAGES = 3;

/**
 * PromptHistoryItem から生成結果画像のリストを取得（互換性レイヤ）。
 *
 * - 新フィールド resultImageDataList があればそれを返す
 * - 無ければ旧 resultImageData を 1 要素配列に包んで返す
 * - 両方 null/空 → 空配列
 *
 * 表示・解析側は常にこの関数を経由すれば、旧データ／新データを意識せずに済む。
 */
export function getResultImages(item: {
  resultImageData?: string | null;
  resultImageDataList?: string[];
}): string[] {
  if (item.resultImageDataList && item.resultImageDataList.length > 0) {
    return item.resultImageDataList.slice(0, MAX_RESULT_IMAGES);
  }
  if (item.resultImageData) return [item.resultImageData];
  return [];
}

/**
 * 生成結果画像のリストを更新するための patch を作る（互換性レイヤ）。
 *
 * resultImageData（旧フィールド）と resultImageDataList（新フィールド）を必ず同期させる。
 * 配列が空のときは両方 null にする。
 */
export function buildResultImagesPatch(images: string[]): {
  resultImageData: string | null;
  resultImageDataList: string[];
} {
  const clipped = images.slice(0, MAX_RESULT_IMAGES);
  return {
    resultImageData: clipped[0] ?? null,
    resultImageDataList: clipped,
  };
}

// ── 画像ごとの評価（rating / memo）ヘルパ ──────────────────────────────

/** 評価値の意味 */
export type ImageRating = 1 | 2 | 3 | 5;  // 4 は欠番（お気に入り＝アイテム単位の isFavorite と混同を避けるため）

export const RATING_LABELS: Record<number, { jp: string; emoji: string; tone: string }> = {
  5: { jp: "良い",     emoji: "👍", tone: "good"   },
  3: { jp: "まあまあ", emoji: "😐", tone: "normal" },
  2: { jp: "微妙",     emoji: "👎", tone: "weak"   },
  1: { jp: "失敗",     emoji: "💀", tone: "bad"    },
};

/**
 * PromptHistoryItem から指定インデックスの評価を取得。未評価は null。
 */
export function getRatingAt(
  item: { resultRatings?: (number | null)[] },
  index: number,
): number | null {
  const arr = item.resultRatings;
  if (!Array.isArray(arr)) return null;
  const v = arr[index];
  return (v === 1 || v === 2 || v === 3 || v === 5) ? v : null;
}

/** 指定インデックスのメモを取得（未設定は ""） */
export function getMemoAt(
  item: { resultMemos?: (string | null)[] },
  index: number,
): string {
  const arr = item.resultMemos;
  if (!Array.isArray(arr)) return "";
  return arr[index] ?? "";
}

/**
 * 評価リスト/メモリストを画像枚数に合わせて正規化（足りない分は null パディング）。
 * 画像 N 枚に対して長さ N の配列にする。
 */
export function normalizeRatingsToLength(
  arr: (number | null)[] | undefined,
  len: number,
): (number | null)[] {
  const a = Array.isArray(arr) ? arr.slice(0, len) : [];
  while (a.length < len) a.push(null);
  return a;
}

export function normalizeMemosToLength(
  arr: (string | null)[] | undefined,
  len: number,
): (string | null)[] {
  const a = Array.isArray(arr) ? arr.slice(0, len) : [];
  while (a.length < len) a.push(null);
  return a;
}

/**
 * 評価値の patch を作る。画像枚数 N に合わせて整形。
 * value=null で「評価を外す」操作になる。
 */
export function buildRatingPatch(
  item: { resultRatings?: (number | null)[]; resultImageDataList?: string[]; resultImageData: string | null },
  index: number,
  value: number | null,
): { resultRatings: (number | null)[] } {
  const images = getResultImages(item);
  const next = normalizeRatingsToLength(item.resultRatings, images.length);
  if (index >= 0 && index < next.length) next[index] = value;
  return { resultRatings: next };
}

/**
 * メモ patch（同上）。空文字は null に正規化。
 */
export function buildMemoPatch(
  item: { resultMemos?: (string | null)[]; resultImageDataList?: string[]; resultImageData: string | null },
  index: number,
  memo: string,
): { resultMemos: (string | null)[] } {
  const images = getResultImages(item);
  const next = normalizeMemosToLength(item.resultMemos, images.length);
  if (index >= 0 && index < next.length) next[index] = memo.trim() ? memo.trim().slice(0, 200) : null;
  return { resultMemos: next };
}

// ── 軸別評価（背景/衣装/ポーズ） ──────────────────────────────────

export type RatingAxisKey = "bg" | "outfit" | "pose";

/** 軸別評価のラベル */
export const AXIS_RATING_META: Record<RatingAxisKey, { jp: string; emoji: string; field: keyof Pick<
  { resultBgRatings?: (number|null)[]; resultOutfitRatings?: (number|null)[]; resultPoseRatings?: (number|null)[] },
  "resultBgRatings" | "resultOutfitRatings" | "resultPoseRatings"
> }> = {
  bg:     { jp: "背景",   emoji: "🏞", field: "resultBgRatings" },
  outfit: { jp: "衣装",   emoji: "👗", field: "resultOutfitRatings" },
  pose:   { jp: "ポーズ", emoji: "🧍", field: "resultPoseRatings" },
};

/** 軸別評価値を取得（5=良い / 1=悪い / null=未評価） */
export function getAxisRatingAt(
  item: { resultBgRatings?: (number|null)[]; resultOutfitRatings?: (number|null)[]; resultPoseRatings?: (number|null)[] },
  axis: RatingAxisKey,
  index: number,
): number | null {
  const field = AXIS_RATING_META[axis].field;
  const arr = item[field];
  if (!Array.isArray(arr)) return null;
  const v = arr[index];
  return (v === 5 || v === 1) ? v : null;
}

/**
 * 軸別評価の patch を作る（指定軸・指定インデックスの値だけ更新）。
 * value=null で「評価を外す」操作。
 */
export function buildAxisRatingPatch(
  item: {
    resultBgRatings?: (number|null)[];
    resultOutfitRatings?: (number|null)[];
    resultPoseRatings?: (number|null)[];
    resultImageDataList?: string[];
    resultImageData: string | null;
  },
  axis: RatingAxisKey,
  index: number,
  value: number | null,
): Record<string, (number | null)[]> {
  const images = getResultImages(item);
  const field = AXIS_RATING_META[axis].field;
  const current = item[field];
  const next = normalizeRatingsToLength(current, images.length);
  if (index >= 0 && index < next.length) next[index] = value;
  return { [field]: next };
}

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
  /** 「同じ構成で再生成」用の追加スナップショット（PromptHistoryItem に直接ないフィールド） */
  settingsSnapshot?: PromptHistoryItem["settingsSnapshot"];
}

/** API レスポンスの proposals を PromptHistoryItem[] に正規化する。 */
export function buildHistoryItems({
  proposals,
  target,
  batchId,
  inputs,
  thumbnail,
  presetName,
  settingsSnapshot,
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
    resultImageDataList: [],
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
    realismLevel: inputs.realismLevel,
    realismType: inputs.realismType,
    textureOriginal: inputs.textureOriginal,
    textureDisabled: inputs.textureDisabled,
    presetName,
    promptTarget: inputs.promptTarget,
    // 「同じ構成で再生成」用スナップショット（存在する場合のみ保存）
    ...(settingsSnapshot ? { settingsSnapshot } : {}),
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
