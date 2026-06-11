/**
 * 色 × 軸（髪/服/背景）の生成制御重み（0〜5）を localStorage に永続化する。
 *
 * 0 = 完全禁止（候補から除外＋NGトークン）
 * 1 = 強く抑制（必要時のみ）
 * 2 = 抑制（控えめ）
 * 3 = 普通（既定。プロンプト非出力）
 * 4 = 推奨（積極的に使う）
 * 5 = 強く推奨（最優先）
 *
 * 旧 ipm_color_policies_v1 (allow/restrict/block) から自動マイグレーション。
 */
import { COLOR_GROUPS, type ColorAnalysis } from "./colorAnalyzer";

// ── 型 ──────────────────────────────────────────────────────────────────────

export type ColorWeight = 0 | 1 | 2 | 3 | 4 | 5;

/** 生成制御で参照する3軸 */
export type ColorAxisCtrl = "hair" | "outfit" | "background";

export const COLOR_AXIS_CTRL: { id: ColorAxisCtrl; jp: string; emoji: string }[] = [
  { id: "hair",       jp: "髪",   emoji: "💇" },
  { id: "outfit",     jp: "服",   emoji: "👗" },
  { id: "background", jp: "背景", emoji: "🏞" },
];

export interface ColorWeightEntry {
  hair:       ColorWeight;
  outfit:     ColorWeight;
  background: ColorWeight;
}

export type ColorWeightMap = Record<string, ColorWeightEntry>;

export const DEFAULT_WEIGHT: ColorWeight = 3;
export const DEFAULT_ENTRY: ColorWeightEntry = { hair: 3, outfit: 3, background: 3 };

// ── 旧型（互換維持のため一時的に残す）──────────────────────
// 古いコードが import している可能性があるので named export を残す
export type ColorPolicy = "allow" | "restrict" | "block";
export type ColorPolicyMap = Record<string, ColorPolicy>;

// ── レベルメタ ──────────────────────────────────────────────────────────────

export const WEIGHT_META: Record<ColorWeight, {
  jp: string;
  short: string;
  cls: string;          // 選択中のセル色（既存 LEVEL_META と揃える）
  textCls: string;
}> = {
  0: { jp: "禁止",     short: "禁",  cls: "border-rose-400/70 bg-rose-500/22",    textCls: "text-rose-100" },
  1: { jp: "強抑制",   short: "1",   cls: "border-amber-400/65 bg-amber-500/18",  textCls: "text-amber-100" },
  2: { jp: "抑制",     short: "2",   cls: "border-yellow-400/55 bg-yellow-500/14",textCls: "text-yellow-100" },
  3: { jp: "普通",     short: "3",   cls: "border-slate-400/55 bg-slate-500/12",  textCls: "text-slate-100" },
  4: { jp: "推奨",     short: "4",   cls: "border-sky-400/65 bg-sky-500/18",      textCls: "text-sky-100" },
  5: { jp: "強推奨",   short: "5",   cls: "border-violet-400/70 bg-violet-500/22",textCls: "text-violet-100" },
};

// ── ストレージ ──────────────────────────────────────────────────────────────

const STORAGE_KEY        = "ipm_color_weights_v1";
const LEGACY_POLICY_KEY  = "ipm_color_policies_v1";

/** 旧 policy → 重みへの変換（マイグレーション用） */
function migrateFromLegacy(legacy: Record<string, unknown>): ColorWeightMap {
  const migrated: ColorWeightMap = {};
  for (const [colorId, policy] of Object.entries(legacy)) {
    if (policy === "block") {
      migrated[colorId] = { hair: 0, outfit: 0, background: 0 };
    } else if (policy === "restrict") {
      migrated[colorId] = { hair: 2, outfit: 2, background: 2 };
    }
    // "allow" は既定値なので保存しない
  }
  return migrated;
}

/** 1エントリの安全化（不正値を 3 に補正） */
function sanitizeEntry(e: unknown): ColorWeightEntry {
  const r: ColorWeightEntry = { ...DEFAULT_ENTRY };
  if (!e || typeof e !== "object") return r;
  const o = e as Record<string, unknown>;
  (["hair", "outfit", "background"] as const).forEach((k) => {
    const v = o[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5) {
      r[k] = v as ColorWeight;
    }
  });
  return r;
}

export function loadColorWeights(): ColorWeightMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        const result: ColorWeightMap = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const safe = sanitizeEntry(v);
          // すべて 3 のときは保存しない（map をスリムに保つ）
          if (safe.hair !== 3 || safe.outfit !== 3 || safe.background !== 3) {
            result[k] = safe;
          }
        }
        return result;
      }
    }
    // マイグレーション：旧 policy が残っていたら変換
    const legacy = localStorage.getItem(LEGACY_POLICY_KEY);
    if (legacy) {
      const obj = JSON.parse(legacy);
      if (obj && typeof obj === "object") {
        const migrated = migrateFromLegacy(obj as Record<string, unknown>);
        // 一度保存して以降は新キーから読まれるようにする
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          // マイグレーション完了後、旧キーは削除して localStorage を綺麗に保つ
          localStorage.removeItem(LEGACY_POLICY_KEY);
        } catch { /* quota */ }
        return migrated;
      }
    }
  } catch { /* fallthrough */ }
  return {};
}

export function saveColorWeights(map: ColorWeightMap): void {
  try {
    // 既定（3,3,3）のエントリは削除して保存
    const slim: ColorWeightMap = {};
    for (const [k, v] of Object.entries(map)) {
      if (v.hair !== 3 || v.outfit !== 3 || v.background !== 3) slim[k] = v;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch { /* quota */ }
}

// ── 取得・更新ヘルパ ───────────────────────────────────────────────────────

export function getColorWeight(map: ColorWeightMap, colorId: string, axis: ColorAxisCtrl): ColorWeight {
  const e = map[colorId];
  if (!e) return 3;
  return e[axis];
}

export function getColorEntry(map: ColorWeightMap, colorId: string): ColorWeightEntry {
  return map[colorId] ?? { ...DEFAULT_ENTRY };
}

export function setColorWeight(
  map: ColorWeightMap, colorId: string, axis: ColorAxisCtrl, weight: ColorWeight
): ColorWeightMap {
  const next = { ...map };
  const entry = { ...(next[colorId] ?? DEFAULT_ENTRY) };
  entry[axis] = weight;
  if (entry.hair === 3 && entry.outfit === 3 && entry.background === 3) {
    delete next[colorId];
  } else {
    next[colorId] = entry;
  }
  return next;
}

/** その色の3軸すべてに同じ重みを設定 */
export function setColorAllAxes(map: ColorWeightMap, colorId: string, weight: ColorWeight): ColorWeightMap {
  const next = { ...map };
  if (weight === 3) {
    delete next[colorId];
  } else {
    next[colorId] = { hair: weight, outfit: weight, background: weight };
  }
  return next;
}

export function resetColorWeights(): ColorWeightMap {
  return {};
}

// ── 集計 ────────────────────────────────────────────────────────────────────

export function countWeights(map: ColorWeightMap): {
  block: number;      // 0 が一つでもある色の数
  suppress: number;   // 1 or 2 が一つでもある色の数（block を除く）
  boost: number;      // 4 or 5 が一つでもある色の数
  customized: number; // 既定でない色の数
} {
  let block = 0, suppress = 0, boost = 0, customized = 0;
  for (const v of Object.values(map)) {
    const arr = [v.hair, v.outfit, v.background];
    if (arr.some((x) => x === 0)) block++;
    else if (arr.some((x) => x === 1 || x === 2)) suppress++;
    if (arr.some((x) => x === 4 || x === 5)) boost++;
    customized++;
  }
  return { block, suppress, boost, customized };
}

// ── サーバ送信用 ──────────────────────────────────────────────────────────

/** サーバへ送る軸別重みリスト（3 は送らない） */
export interface ColorWeightControl {
  colorId: string;
  jp: string;
  axis:   ColorAxisCtrl;
  weight: 0 | 1 | 2 | 4 | 5;   // 3 は含まれない
}

export function getColorWeightControls(map: ColorWeightMap): ColorWeightControl[] {
  const list: ColorWeightControl[] = [];
  for (const g of COLOR_GROUPS) {
    const e = map[g.id];
    if (!e) continue;
    (["hair", "outfit", "background"] as ColorAxisCtrl[]).forEach((axis) => {
      const w = e[axis];
      if (w !== 3) {
        list.push({ colorId: g.id, jp: g.jp, axis, weight: w as 0 | 1 | 2 | 4 | 5 });
      }
    });
  }
  return list;
}

/** weight===0（完全禁止）の色の代表NGトークンを集約 */
export function getBlockedColorTokens(map: ColorWeightMap): string[] {
  const tokens: string[] = [];
  for (const g of COLOR_GROUPS) {
    const e = map[g.id];
    if (!e) continue;
    // 全軸が 0（=その色を完全に使わない）のときだけハード NG トークン化する。
    // 一部の軸だけ 0（例：衣装だけ白禁止）は colorWeightBlock の軸別自然文指示に委ね、
    // 他軸（髪・背景）へ波及させない（軸別制御の維持）。
    if (e.hair === 0 && e.outfit === 0 && e.background === 0) {
      tokens.push(...g.ngTokens);
    }
  }
  return Array.from(new Set(tokens));
}

// ── 自動調整アルゴリズム ───────────────────────────────────────────────────

export interface WeightChange {
  colorId: string;
  axis:    ColorAxisCtrl;
  from:    ColorWeight;
  to:      ColorWeight;
  reason:  "bias" | "untapped" | "axis_bias";
}

export interface AutoAdjustResult {
  next:    ColorWeightMap;
  changes: WeightChange[];
}

/**
 * 色分析結果から重みを自動調整する。
 *
 * - 偏り色（全体ratio>=30%）→ 3軸すべて -1（>=50%なら -2）
 * - 未使用色（count=0）       → 3軸すべて +1（既定 3→4）
 * - 軸別の偏り（perAxis top color ratio>=50%）→ その軸のみ -2
 *
 * preserveManual: true のとき、既定（3）でない既存の重みは触らない。
 */
export function autoAdjustColorWeights(
  current: ColorWeightMap,
  analysis: ColorAnalysis,
  preserveManual: boolean = true,
): AutoAdjustResult {
  const next: ColorWeightMap = JSON.parse(JSON.stringify(current));
  const changes: WeightChange[] = [];

  // 全体偏り
  for (const r of analysis.globalRanking) {
    if (r.count === 0) continue;
    if (r.ratio < 0.30) continue;
    const dec = r.ratio >= 0.50 ? 2 : 1;
    const cur = next[r.colorId] ?? { ...DEFAULT_ENTRY };
    if (preserveManual && (cur.hair !== 3 || cur.outfit !== 3 || cur.background !== 3)) {
      continue; // 手動設定保護
    }
    const updated: ColorWeightEntry = {
      hair:       Math.max(0, cur.hair - dec) as ColorWeight,
      outfit:     Math.max(0, cur.outfit - dec) as ColorWeight,
      background: Math.max(0, cur.background - dec) as ColorWeight,
    };
    (["hair", "outfit", "background"] as ColorAxisCtrl[]).forEach((axis) => {
      if (cur[axis] !== updated[axis]) {
        changes.push({ colorId: r.colorId, axis, from: cur[axis], to: updated[axis], reason: "bias" });
      }
    });
    next[r.colorId] = updated;
  }

  // 軸別偏り
  for (const ax of analysis.perAxis) {
    if (ax.total < 5) continue;
    if (ax.axis !== "hair" && ax.axis !== "outfit" && ax.axis !== "background") continue;
    const top = ax.byColor[0];
    if (!top || top.ratio < 0.50) continue;
    const cur = next[top.colorId] ?? { ...DEFAULT_ENTRY };
    if (preserveManual && cur[ax.axis as ColorAxisCtrl] !== 3) continue;
    const newW = Math.max(0, cur[ax.axis as ColorAxisCtrl] - 2) as ColorWeight;
    if (newW !== cur[ax.axis as ColorAxisCtrl]) {
      changes.push({ colorId: top.colorId, axis: ax.axis as ColorAxisCtrl, from: cur[ax.axis as ColorAxisCtrl], to: newW, reason: "axis_bias" });
      const updated = { ...cur, [ax.axis]: newW };
      next[top.colorId] = updated;
    }
  }

  // 未使用色を加点
  for (const colorId of analysis.unexploredColors) {
    const cur = next[colorId] ?? { ...DEFAULT_ENTRY };
    if (preserveManual && (cur.hair !== 3 || cur.outfit !== 3 || cur.background !== 3)) continue;
    const updated: ColorWeightEntry = {
      hair:       Math.min(5, cur.hair + 1) as ColorWeight,
      outfit:     Math.min(5, cur.outfit + 1) as ColorWeight,
      background: Math.min(5, cur.background + 1) as ColorWeight,
    };
    (["hair", "outfit", "background"] as ColorAxisCtrl[]).forEach((axis) => {
      if (cur[axis] !== updated[axis]) {
        changes.push({ colorId, axis, from: cur[axis], to: updated[axis], reason: "untapped" });
      }
    });
    next[colorId] = updated;
  }

  // 既定（3,3,3）に戻ったエントリは削除
  for (const [k, v] of Object.entries(next)) {
    if (v.hair === 3 && v.outfit === 3 && v.background === 3) delete next[k];
  }

  return { next, changes };
}
