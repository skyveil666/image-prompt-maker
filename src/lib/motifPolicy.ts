/**
 * モチーフ出現制御（0〜5レベル）
 *
 * 各頻出モチーフに「出現制御レベル」を設定し、プロンプト生成に反映する。
 *   0 完全NG    … 使用しない（類似語も避ける。ngList へハード除外）
 *   1 強く抑制  … 基本出さない
 *   2 やや抑制  … 連続使用を避ける
 *   3 注意      … 使うなら変化を付ける
 *   4 許可      … 制限なし（デフォルト）
 *   5 積極許可  … 好み要素として優先（ただし重複しすぎない）
 *
 * 重要：レベル設定は即 localStorage 保存されるが、生成への反映は
 * `applied` フラグが true の時のみ（分析→検討→反映ボタン→適用）。
 */

import { MONITORED_MOTIFS } from "./biasAnalyzer";

/** 0〜5 の出現制御レベル（4 = 許可 = デフォルト） */
export type MotifLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const DEFAULT_LEVEL: MotifLevel = 4;

/** motifId → level（4 は保存しない） */
export type LevelMap = Record<string, MotifLevel>;

const STORAGE_KEY = "ipm_motif_levels_v1";
const APPLIED_KEY = "ipm_motif_policy_applied_v1";
const COMBO_KEY   = "ipm_combo_policies_v1";

// ── 頻出構成（複数モチーフの組み合わせ）のポリシー ────────────────────────────
export type ComboPolicy = "block" | "alt" | "allow";
/** key = sorted motif IDs joined with "|" */
export type ComboPolicyMap = Record<string, ComboPolicy>;

// ── レベル定義（ラベル・色）──────────────────────────────────────────────────
export interface LevelMeta {
  level: MotifLevel;
  label: string;     // 短ラベル
  full:  string;     // 説明
  bar:   string;     // バー進捗色
  /** 選択中ボタンのクラス */
  activeBtn: string;
}

export const LEVEL_META: readonly LevelMeta[] = [
  { level: 0, label: "NG",   full: "完全NG",   bar: "bg-rose-500",    activeBtn: "border-rose-400 bg-rose-500/80 text-white" },
  { level: 1, label: "強抑制", full: "強く抑制", bar: "bg-orange-500",  activeBtn: "border-orange-400 bg-orange-500/80 text-white" },
  { level: 2, label: "抑制",  full: "やや抑制", bar: "bg-amber-400",   activeBtn: "border-amber-400 bg-amber-500/80 text-white" },
  { level: 3, label: "注意",  full: "注意",     bar: "bg-yellow-300",  activeBtn: "border-yellow-300 bg-yellow-400/80 text-black" },
  { level: 4, label: "許可",  full: "許可",     bar: "bg-emerald-400", activeBtn: "border-emerald-400 bg-emerald-500/80 text-white" },
  { level: 5, label: "優先",  full: "積極許可", bar: "bg-cyan-400",    activeBtn: "border-cyan-400 bg-cyan-500/80 text-white" },
];

export function levelMeta(level: MotifLevel): LevelMeta {
  return LEVEL_META[level] ?? LEVEL_META[4];
}

// ── 読み書き ──────────────────────────────────────────────────────────────────

export function loadLevels(): LevelMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    // 数値のみ採用
    const out: LevelMap = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 0 && n <= 5 && n !== DEFAULT_LEVEL) out[k] = n as MotifLevel;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLevels(map: LevelMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / unavailable */
  }
}

export function isApplied(): boolean {
  try { return localStorage.getItem(APPLIED_KEY) === "1"; } catch { return false; }
}
export function setAppliedStorage(v: boolean): void {
  try { localStorage.setItem(APPLIED_KEY, v ? "1" : "0"); } catch {}
}

// ── レベル操作 ──────────────────────────────────────────────────────────────────

export function getLevel(map: LevelMap, motifId: string): MotifLevel {
  return map[motifId] ?? DEFAULT_LEVEL;
}

/** 単一モチーフのレベルを設定（4=許可ならキー削除） */
export function setLevel(map: LevelMap, motifId: string, level: MotifLevel): LevelMap {
  const next = { ...map };
  if (level === DEFAULT_LEVEL) delete next[motifId];
  else next[motifId] = level;
  return next;
}

export function resetAllLevels(): LevelMap {
  return {};
}

/** 指定モチーフを一括で同一レベルに設定（一括操作用） */
export function bulkSetLevels(map: LevelMap, motifIds: string[], level: MotifLevel): LevelMap {
  const next = { ...map };
  for (const id of motifIds) {
    if (level === DEFAULT_LEVEL) delete next[id];
    else next[id] = level;
  }
  return next;
}

/** 完全NG(0) のモチーフだけ許可(4)に戻す（「完全NG解除」用） */
export function clearNgLevels(map: LevelMap): LevelMap {
  const next: LevelMap = {};
  for (const [k, v] of Object.entries(map)) if (v !== 0) next[k] = v;
  return next;
}

// ── 反映用ヘルパー ────────────────────────────────────────────────────────────

/** 完全NG(0) モチーフのトークン（類似語含む）を集める → ngList へ */
export function getNgTokens(map: LevelMap): string[] {
  const tokens = new Set<string>();
  for (const motif of MONITORED_MOTIFS) {
    if (map[motif.id] === 0) {
      for (const t of motif.tokens) tokens.add(t);
    }
  }
  return [...tokens];
}

/** デフォルト(4)以外のモチーフ制御を {label, level} で返す（サーバ制御ブロック用） */
export function getMotifControls(map: LevelMap): { label: string; level: number }[] {
  const out: { label: string; level: number }[] = [];
  for (const motif of MONITORED_MOTIFS) {
    const lv = map[motif.id];
    if (lv !== undefined && lv !== DEFAULT_LEVEL) out.push({ label: motif.label, level: lv });
  }
  return out;
}

// ── 自動調整 ──────────────────────────────────────────────────────────────────

export interface AutoAdjustInput {
  /** 頻出ランキング順（先頭が最頻出）。各要素は { id, count } */
  topMotifs: { id: string; count: number }[];
  /** ウィンドウ件数（出現率の母数）。0 の場合は順位のみで判定 */
  windowSize: number;
  /** 未開拓ジャンル名（推奨用）。MONITORED_MOTIFS の label と一致するIDを 5 にする */
  preferIds?: string[];
}

export interface AutoAdjustResult {
  /** 新しい LevelMap（手動を残す場合は手動を保持した結果） */
  next: LevelMap;
  /** 変更された motifId（ハイライト用） */
  changedIds: string[];
  /** 手動保護で変更されなかった motifId */
  preservedIds: string[];
}

/**
 * 出現回数（順位＋出現率）から 0〜5 を自動決定する。
 *
 *   完全NG(0)   : 最頻出 かつ 出現率 ≥ 15%
 *   強抑制(1)   : 第2〜3位 または 出現率 ≥ 8%
 *   やや抑制(2) : 第4〜6位 または 出現率 ≥ 5%
 *   注意(3)     : 第7〜11位 または 出現率 ≥ 3%
 *   許可(4)     : それ以下（デフォルト）
 *   積極許可(5) : preferIds に含まれる（手動が無ければ）
 */
function levelByRanking(rank: number, count: number, windowSize: number): MotifLevel {
  const ratio = windowSize > 0 ? count / windowSize : 0;
  if (rank === 0 && ratio >= 0.15)              return 0;
  if (rank <= 2 || ratio >= 0.08)               return 1;
  if (rank <= 5 || ratio >= 0.05)               return 2;
  if (rank <= 10 || ratio >= 0.03)              return 3;
  return DEFAULT_LEVEL;
}

/**
 * 自動調整：頻出要素のレベルを一括設定する。
 *
 * @param current     現在の LevelMap
 * @param input       頻出ランキング・ウィンドウ件数・推奨ID
 * @param preserveManual true=手動設定（非4）を保護、false=全上書き
 */
export function computeAutoAdjust(
  current: LevelMap,
  input: AutoAdjustInput,
  preserveManual: boolean
): AutoAdjustResult {
  const next: LevelMap = { ...current };
  const changedIds: string[] = [];
  const preservedIds: string[] = [];
  const preferSet = new Set(input.preferIds ?? []);

  // 頻出ランキング上位を順に評価
  input.topMotifs.forEach(({ id, count }, rank) => {
    const desired = levelByRanking(rank, count, input.windowSize);
    const cur = current[id] ?? DEFAULT_LEVEL;
    if (preserveManual && cur !== DEFAULT_LEVEL) {
      preservedIds.push(id);
      return;
    }
    if (cur !== desired) {
      if (desired === DEFAULT_LEVEL) delete next[id];
      else next[id] = desired;
      changedIds.push(id);
    }
  });

  // 未開拓推奨：preferIds は許可(4)→積極許可(5)に（手動保護時は触らない）
  for (const id of preferSet) {
    const cur = current[id] ?? DEFAULT_LEVEL;
    if (preserveManual && cur !== DEFAULT_LEVEL) {
      if (!preservedIds.includes(id)) preservedIds.push(id);
      continue;
    }
    if (cur !== 5) {
      next[id] = 5;
      if (!changedIds.includes(id)) changedIds.push(id);
    }
  }

  return { next, changedIds, preservedIds };
}

// ── 構成（コンボ）ポリシー ────────────────────────────────────────────────────

export function loadComboPolicies(): ComboPolicyMap {
  try {
    const raw = localStorage.getItem(COMBO_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    const out: ComboPolicyMap = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === "block" || v === "alt") out[k] = v as ComboPolicy;
    }
    return out;
  } catch { return {}; }
}

export function saveComboPolicies(map: ComboPolicyMap): void {
  try { localStorage.setItem(COMBO_KEY, JSON.stringify(map)); } catch {}
}

export function getComboPolicy(map: ComboPolicyMap, comboKey: string): ComboPolicy {
  return map[comboKey] ?? "allow";
}

export function setComboPolicy(map: ComboPolicyMap, comboKey: string, p: ComboPolicy): ComboPolicyMap {
  const next = { ...map };
  if (p === "allow") delete next[comboKey];
  else next[comboKey] = p;
  return next;
}

export function resetComboPolicies(): ComboPolicyMap {
  return {};
}

/**
 * 反映用：block/alt のコンボを {labels, policy} 配列で返す。
 * サーバの comboControlBlock に流す。
 * @param comboMap   ユーザーが設定した combo policy
 * @param keyToCombo combo key → {motifLabels, motifIds} の lookup
 */
export function getComboControls(
  comboMap: ComboPolicyMap,
  keyToCombo: Map<string, { motifLabels: string[]; motifIds: string[] }>
): { labels: string[]; policy: "block" | "alt" }[] {
  const out: { labels: string[]; policy: "block" | "alt" }[] = [];
  for (const [k, p] of Object.entries(comboMap)) {
    if (p !== "block" && p !== "alt") continue;
    const info = keyToCombo.get(k);
    if (!info) continue;
    out.push({ labels: info.motifLabels, policy: p });
  }
  return out;
}

/** block(完全NG)中のコンボから NG指定 用フレーズを返す（クライアント側で ngList に注入） */
export function getNgPhrasesFromCombos(
  comboMap: ComboPolicyMap,
  keyToCombo: Map<string, { motifLabels: string[]; motifIds: string[] }>
): string[] {
  const out: string[] = [];
  for (const [k, p] of Object.entries(comboMap)) {
    if (p !== "block") continue;
    const info = keyToCombo.get(k);
    if (!info || info.motifLabels.length < 2) continue;
    out.push(`${info.motifLabels.join(" + ")}の同時使用`);
  }
  return out;
}

/** 構成ポリシーの件数（block / alt） */
export function countComboPolicies(map: ComboPolicyMap): { block: number; alt: number } {
  let block = 0, alt = 0;
  for (const v of Object.values(map)) {
    if (v === "block") block++;
    else if (v === "alt") alt++;
  }
  return { block, alt };
}

/** 制御中（非4）の件数と、内訳カウント */
export function countLevels(map: LevelMap): { controlled: number; ng: number; suppressed: number; prefer: number } {
  let controlled = 0, ng = 0, suppressed = 0, prefer = 0;
  for (const v of Object.values(map)) {
    if (v === DEFAULT_LEVEL) continue;
    controlled++;
    if (v === 0) ng++;
    else if (v === 1 || v === 2) suppressed++;
    else if (v === 5) prefer++;
  }
  return { controlled, ng, suppressed, prefer };
}
