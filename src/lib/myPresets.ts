/**
 * myPresets — 現在の全設定（スコープ・詳細・世界観/斬新背景/画法世界・配色主従）を
 * 名前付きで保存し、ワンクリックで再適用するための「マイプリセット」。
 *
 * 設計：
 *   - 保存対象は「スコープ・詳細・世界観/斬新背景/画法世界・配色主従」の生の state を
 *     そのままスナップショットする（handleRestoreFromHistory と同じ直接復元方式）。
 *     プリセットのビルダー関数を再実行するのではなく、保存時点の値をそのまま戻す。
 *   - croppedImages.ts と同じ「独立ストア・favorite無しの単純CRUD」パターンを踏襲。
 *     ただしこちらは自動蓄積ではなくユーザーの明示保存のみのため、上限に達したら
 *     古いものを黒子で間引く（croppedImages方式）のではなく、保存自体を拒否して
 *     ユーザーに選ばせる（名前付きで意図的に残した物を無断で消さない）。
 *   - §3 additive のみ：STORE_MY_PRESETS（idb.ts）に加算されるだけで既存ストアは無改修。
 *
 * ストア：STORE_MY_PRESETS（idb v8・加算的に追加。index: createdAt）。
 */

import { put, getAll, remove, STORE_MY_PRESETS } from "./idb";
import type { Scope, DetailSettings } from "../types";
import { WORLD_PRESET_DISPLAY, BG_PRESET_DISPLAY, ART_PRESET_DISPLAY } from "./quickActions";
import type { WorldPreset, BgPreset, ArtPreset } from "./quickActions";
import { DOMINANCE_LABELS } from "./colorDominanceNote";
import type { ColorDominance } from "./colorDominanceNote";
import type { ZozoTrend } from "./zozoTrend";

/** 保存対象のスナップショット（現在の全設定：スコープ・詳細・3種プリセット・配色主従）。 */
export interface MyPresetSnapshot {
  scopes:             Scope[];
  details:            DetailSettings;
  activeWorldPresets: WorldPreset[];
  worldCombinedNote:  string;
  worldScopes:        Scope[];
  activeBgPresets:    BgPreset[];
  bgPresetNote:       string;
  bgScopes:           Scope[];
  activeArtPresets:   ArtPreset[];
  artPresetNote:      string;
  artScopes:          Scope[];
  colorDominance:     ColorDominance | null;
}

export interface MyPresetRecord {
  id:        string;
  name:      string;
  createdAt: number;
  updatedAt: number;
  snapshot:  MyPresetSnapshot;
}

/** 保持上限。croppedImages(50)より少ないのは、こちらは名前付きの意図的な保存だから
 *  自動間引きをせず、上限に達したら保存自体を拒否してユーザーに削除を選ばせるため。 */
export const MY_PRESET_MAX = 20;

/** ID重複防止用の連番（同一msに複数保存されても衝突しない）。 */
let seq = 0;

/** 保存/上書き/削除のたびに発火（設定画面の直近10件とExplorerの全件一覧は別のReactツリーに
 *  いるため、片方の操作をもう片方へ即時反映するのに使う。croppedImagesChanged と同型）。 */
export const myPresetsChanged = new EventTarget();

export type SaveMyPresetResult =
  | { ok: true; record: MyPresetRecord }
  | { ok: false; reason: "at_cap" | "empty_name" };

/** 保存済みマイプリセットを新しい順（作成日時降順）で取得。 */
export async function listMyPresets(): Promise<MyPresetRecord[]> {
  const all = await getAll<MyPresetRecord>(STORE_MY_PRESETS);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 新規保存。上限(MY_PRESET_MAX)に達している場合、または名前が空文字の場合は
 * 保存せず理由を返す（呼び出し元がその理由をそのままUIに出せる）。
 */
export async function saveMyPreset(
  name: string,
  snapshot: MyPresetSnapshot
): Promise<SaveMyPresetResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "empty_name" };

  const existing = await getAll<MyPresetRecord>(STORE_MY_PRESETS);
  if (existing.length >= MY_PRESET_MAX) return { ok: false, reason: "at_cap" };

  const createdAt = Date.now();
  seq = (seq + 1) % 1_000_000;
  const id = `mypreset_${createdAt}_${seq.toString().padStart(6, "0")}`;
  const record: MyPresetRecord = { id, name: trimmed, createdAt, updatedAt: createdAt, snapshot };
  await put(STORE_MY_PRESETS, record);
  myPresetsChanged.dispatchEvent(new Event("change"));
  return { ok: true, record };
}

/**
 * 既存プリセットの内容（snapshot）を現在の設定で上書きする。名前・id・createdAtは不変。
 * 対象が見つからなければ null を返す。
 */
export async function overwriteMyPreset(
  id: string,
  snapshot: MyPresetSnapshot
): Promise<MyPresetRecord | null> {
  const all = await getAll<MyPresetRecord>(STORE_MY_PRESETS);
  const cur = all.find((r) => r.id === id);
  if (!cur) return null;
  const next: MyPresetRecord = { ...cur, snapshot, updatedAt: Date.now() };
  await put(STORE_MY_PRESETS, next);
  myPresetsChanged.dispatchEvent(new Event("change"));
  return next;
}

/** id指定で1件削除。 */
export async function removeMyPreset(id: string): Promise<void> {
  await remove(STORE_MY_PRESETS, id);
  myPresetsChanged.dispatchEvent(new Event("change"));
}

/**
 * 自動命名用の入力（MyPresetSnapshot＋ZOZO）。
 * ZOZOは保存対象のスナップショットには含めない（既存ロジック無改修の方針）が、
 * 「今どんな設定か」を名前に反映する目的では拾う。
 */
export interface MyPresetLabelInputs {
  activeWorldPresets: WorldPreset[];
  activeBgPresets:    BgPreset[];
  activeArtPresets:   ArtPreset[];
  colorDominance:     ColorDominance | null;
  zozoApplied:        ZozoTrend | null;
}

/** 自動命名ラベルに含める設定要素の最大数（長くなりすぎないよう主要3〜4個まで）。 */
const LABEL_MAX_PARTS = 4;

/**
 * 「YYYY/MM/DD 設定ラベル」形式のデフォルト名を機械的に組み立てる（Gemini/API は呼ばない・
 * 既存の§5バッジ用の表示ラベル辞書をそのまま流用）。有効な設定が無ければ「おまかせ」。
 */
export function buildMyPresetDefaultName(
  inputs: MyPresetLabelInputs,
  now: Date = new Date(),
): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePart = `${y}/${m}/${d}`;

  const parts: string[] = [
    ...inputs.activeWorldPresets.map((p) => WORLD_PRESET_DISPLAY[p]),
    ...inputs.activeBgPresets.map((p) => BG_PRESET_DISPLAY[p]),
    ...inputs.activeArtPresets.map((p) => ART_PRESET_DISPLAY[p]),
    ...(inputs.colorDominance ? [DOMINANCE_LABELS[inputs.colorDominance]] : []),
    ...(inputs.zozoApplied ? [`👗ZOZO${inputs.zozoApplied.categoryLabel ? `:${inputs.zozoApplied.categoryLabel}` : ""}`] : []),
  ];

  const labelPart = parts.length > 0 ? parts.slice(0, LABEL_MAX_PARTS).join("・") : "おまかせ";
  return `${datePart} ${labelPart}`;
}
