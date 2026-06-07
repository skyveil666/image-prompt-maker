/**
 * 色分析エンジン (colorAnalyzer)
 *
 * 履歴の promptText から色を抽出して集計し、重複分析センターの「色分析」タブで使う。
 *
 * 集計軸（5本）:
 *   - 衣装色 (outfit)
 *   - 髪色 (hair)
 *   - ライティング色 (lighting)
 *   - 背景色 (background)
 *   - 差し色 (accent)
 *
 * 色グループ（12種）:
 *   黒 / 白 / 灰 / 茶 / 赤 / 桃 / 橙 / 黄 / 緑 / 青 / 紫 / 金属
 *
 * 抽出方式: 文単位の共起（軸キーワードと色トークンが同じ文に出現したら計上）。
 *           ヒューリスティックなので完全ではないが、追加依存ゼロ・即時実行可。
 */
import type { PromptHistoryItem } from "../types";

// ── 型 ──────────────────────────────────────────────────────────────────────

export type ColorAxis = "outfit" | "hair" | "lighting" | "background" | "accent";

export const COLOR_AXES: readonly { id: ColorAxis; jp: string; emoji: string }[] = [
  { id: "outfit",     jp: "衣装色",       emoji: "👗" },
  { id: "hair",       jp: "髪色",         emoji: "💇" },
  { id: "lighting",   jp: "ライティング色", emoji: "💡" },
  { id: "background", jp: "背景色",       emoji: "🏞" },
  { id: "accent",     jp: "差し色",       emoji: "✨" },
] as const;

export interface ColorGroup {
  id: string;
  jp: string;
  /** UI スウォッチ用 CSS color */
  swatch: string;
  /** prompt 内で照合するキーワード（日英混在OK） */
  tokens: readonly string[];
  /** ブロック時にプロンプトNGリストへ送る代表トークン（英語優先） */
  ngTokens: readonly string[];
}

export const COLOR_GROUPS: readonly ColorGroup[] = [
  { id: "black",    jp: "黒系",   swatch: "#1a1a1a",
    tokens: ["黒", "ブラック", "black", "墨", "漆黒", "ジェット", "jet"],
    ngTokens: ["black", "jet black"] },
  { id: "white",    jp: "白系",   swatch: "#f5f5f5",
    tokens: ["白", "ホワイト", "white", "アイボリー", "ivory", "オフホワイト", "off-white", "クリーム", "cream"],
    ngTokens: ["white", "ivory", "cream"] },
  { id: "gray",     jp: "灰系",   swatch: "#888888",
    tokens: ["灰", "グレー", "gray", "grey", "チャコール", "charcoal", "スモーキー", "smoky"],
    ngTokens: ["gray", "grey", "charcoal"] },
  { id: "brown",    jp: "茶系",   swatch: "#8b5a2b",
    tokens: ["茶", "ブラウン", "brown", "ベージュ", "beige", "キャメル", "camel", "モカ", "mocha", "tan"],
    ngTokens: ["brown", "beige", "tan"] },
  { id: "red",      jp: "赤系",   swatch: "#c1374a",
    tokens: ["赤", "レッド", "red", "crimson", "クリムゾン", "ワインレッド", "ボルドー", "burgundy", "scarlet"],
    ngTokens: ["red", "crimson", "burgundy"] },
  { id: "pink",     jp: "桃系",   swatch: "#ee87a1",
    tokens: ["桃", "ピンク", "pink", "rose", "ローズ", "桜色", "サクラ", "ベビーピンク", "magenta", "マゼンタ"],
    ngTokens: ["pink", "rose", "magenta"] },
  { id: "orange",   jp: "橙系",   swatch: "#e98341",
    tokens: ["橙", "オレンジ", "orange", "コーラル", "coral", "tangerine", "サーモン", "salmon"],
    ngTokens: ["orange", "coral"] },
  { id: "yellow",   jp: "黄系",   swatch: "#e6c200",
    tokens: ["黄", "イエロー", "yellow", "ゴールド", "gold", "金色", "マスタード", "mustard"],
    ngTokens: ["yellow", "gold", "mustard"] },
  { id: "green",    jp: "緑系",   swatch: "#4a9b6a",
    tokens: ["緑", "グリーン", "green", "ミント", "mint", "オリーブ", "olive", "エメラルド", "emerald", "カーキ", "khaki"],
    ngTokens: ["green", "olive", "emerald"] },
  { id: "blue",     jp: "青系",   swatch: "#3a78c2",
    tokens: ["青", "ブルー", "blue", "ネイビー", "navy", "シアン", "cyan", "空色", "azure", "サックス", "teal", "ティール"],
    ngTokens: ["blue", "navy", "cyan", "teal"] },
  { id: "purple",   jp: "紫系",   swatch: "#8e5fb8",
    tokens: ["紫", "パープル", "purple", "violet", "ラベンダー", "lavender", "mauve", "藤", "藤色", "アメジスト", "amethyst"],
    ngTokens: ["purple", "violet", "lavender"] },
  { id: "metallic", jp: "金属",   swatch: "#c0b08a",
    tokens: ["シルバー", "silver", "プラチナ", "platinum", "メタリック", "metallic", "クローム", "chrome"],
    ngTokens: ["silver", "platinum", "metallic", "chrome"] },
] as const;

/** 軸ごとのキーワード（promptText 内でこの近くに出てきた色を、その軸の色とみなす） */
const AXIS_KEYWORDS: Record<ColorAxis, readonly string[]> = {
  outfit:     ["衣装", "服", "ドレス", "outfit", "dress", "コート", "coat", "ジャケット", "jacket", "シャツ", "shirt", "スカート", "skirt", "パンツ", "pants", "トップス", "top", "ボトムス", "ワンピース", "セットアップ", "コスチューム", "costume", "wear"],
  hair:       ["髪", "ヘア", "hair", "毛", "髪色"],
  lighting:   ["ライト", "ライティング", "光", "lighting", "light", "rim light", "リムライト", "リム", "glow", "neon", "ネオン", "spotlight", "スポット", "照明", "発光"],
  background: ["背景", "background", "bg", "後ろ", "シーン", "scene", "舞台", "壁", "wall", "空", "sky"],
  accent:     ["差し色", "accent", "アクセント", "ポイントカラー", "ハイライト", "highlight"],
};

// ── 内部ヘルパ ──────────────────────────────────────────────────────────────

/** 全色トークンを1つの正規表現にまとめる（小文字化済みの本文に対して検索） */
function buildColorRegex(): RegExp {
  // tokens は日本語と英単語が混ざる。境界判定は英語側だけで十分（日本語に \b は意味薄）
  const parts: string[] = [];
  for (const g of COLOR_GROUPS) {
    for (const t of g.tokens) {
      parts.push(escapeRegex(t));
    }
  }
  // 重複排除
  const unique = Array.from(new Set(parts));
  // 長いもの優先（"navy" を "n" にマッチさせない）
  unique.sort((a, b) => b.length - a.length);
  return new RegExp(unique.join("|"), "gi");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** トークン → colorId への逆引き */
const TOKEN_TO_COLOR: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of COLOR_GROUPS) {
    for (const t of g.tokens) {
      m.set(t.toLowerCase(), g.id);
    }
  }
  return m;
})();

const COLOR_REGEX = buildColorRegex();

/**
 * BUG-4-C（ストップワード方式）：色トークンを部分一致で誤検出する「ホスト語」。
 * 色マッチの直前にこれらを除去して誤検出を防ぐ。
 *   rosemary → rose（桃）/ instant・important・constant・distant → tan（茶）
 * ※ golden→gold, grayscale→gray, bluish→blue など正当な複合語マッチは温存する
 *   （全面的な単語境界化は採用しない）。必要に応じてこの配列に語を追加するだけで拡張可能。
 */
const COLOR_FALSE_POSITIVE_WORDS = [
  "rosemary", "instant", "important", "constant", "distant",
];
const COLOR_FP_REGEX = new RegExp(
  "(?<![a-z])(?:" + COLOR_FALSE_POSITIVE_WORDS.join("|") + ")(?![a-z])",
  "gi",
);

/** テキストを文単位に分割（日英の区切り混在に対応） */
function splitSentences(text: string): string[] {
  // 。．！？.;\n を区切りに
  return text
    .split(/(?<=[。．！？!?;])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 1つの文から (axis, colorId) ペアを全部抽出（重複可） */
function extractFromSentence(sentence: string): { axis: ColorAxis; colorId: string }[] {
  const lower = sentence.toLowerCase();

  // どの軸に該当するか（複数可能）
  const matchedAxes: ColorAxis[] = [];
  for (const axis of Object.keys(AXIS_KEYWORDS) as ColorAxis[]) {
    const keys = AXIS_KEYWORDS[axis];
    if (keys.some((k) => lower.includes(k.toLowerCase()))) {
      matchedAxes.push(axis);
    }
  }
  if (matchedAxes.length === 0) return [];

  // 色トークンを全部拾う（BUG-4-C: 誤検出元のホスト語を除去してからマッチ）
  const colorIds = new Set<string>();
  const colorHaystack = lower.replace(COLOR_FP_REGEX, " ");
  const matches = colorHaystack.match(COLOR_REGEX);
  if (matches) {
    for (const m of matches) {
      const id = TOKEN_TO_COLOR.get(m.toLowerCase());
      if (id) colorIds.add(id);
    }
  }
  if (colorIds.size === 0) return [];

  // 軸 × 色 で展開
  const result: { axis: ColorAxis; colorId: string }[] = [];
  for (const axis of matchedAxes) {
    for (const id of colorIds) {
      result.push({ axis, colorId: id });
    }
  }
  return result;
}

// ── パブリック API ──────────────────────────────────────────────────────────

export interface ColorAxisCount {
  axis: ColorAxis;
  /** その軸での総カウント */
  total: number;
  /** colorId → count（降順ではない、UIで並べ替え） */
  byColor: { colorId: string; count: number; ratio: number }[];
  /** 偏り上位色（>= 50% でフラグ） */
  topColor?: { colorId: string; ratio: number };
}

export interface ColorGlobalRanking {
  colorId: string;
  count: number;
  ratio: number;
}

/** 配色（軸ごとの色組合せ）の頻出 TOP */
export interface ColorComboEntry {
  /** 各軸に対応する colorId の組み合わせ */
  axes: { axis: ColorAxis; colorId: string }[];
  count: number;
}

export interface ColorBiasWarning {
  axis: ColorAxis | "global";
  colorId: string;
  ratio: number;
  severity: "high" | "medium";
  message: string;
  recommendColorIds: string[];
}

export interface ColorAnalysis {
  /** 対象件数 */
  windowSize: number;
  /** 軸別カウント */
  perAxis: ColorAxisCount[];
  /** 全体ランキング（軸を問わない総出現数） */
  globalRanking: ColorGlobalRanking[];
  /** 配色 TOP10（衣装×髪、衣装×背景 など、2軸ペアの組合せ） */
  comboRanking: ColorComboEntry[];
  /** 未開拓色（全体で count===0 または極小）の colorId 一覧 */
  unexploredColors: string[];
  /** 偏り警告 */
  biasWarnings: ColorBiasWarning[];
}

/**
 * 履歴から色分析を行う。
 * @param items 履歴アイテム（時系列順 / 新→旧 どちらでも可、内部で createdAt で降順ソートする）
 * @param windowSize 直近何件を対象にするか
 */
export function analyzeColors(
  items: readonly PromptHistoryItem[],
  windowSize: 50 | 100 = 50,
): ColorAnalysis {
  // 新しい順にソート
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  const target = sorted.slice(0, windowSize);

  // ── 抽出 ────────────────────────────────────────
  const axisCounts: Record<ColorAxis, Map<string, number>> = {
    outfit:     new Map(),
    hair:       new Map(),
    lighting:   new Map(),
    background: new Map(),
    accent:     new Map(),
  };
  const axisTotals: Record<ColorAxis, number> = {
    outfit: 0, hair: 0, lighting: 0, background: 0, accent: 0,
  };
  const globalCounts = new Map<string, number>();
  /** バッチ内で出現した (axis,colorId) ペア集合 → アイテムごとに配色を作る */
  const itemAxisColor: Map<string, Map<ColorAxis, Set<string>>> = new Map();

  for (const item of target) {
    if (!item.promptText) continue;
    const sentences = splitSentences(item.promptText);
    const perItem = new Map<ColorAxis, Set<string>>();

    for (const sent of sentences) {
      const pairs = extractFromSentence(sent);
      for (const { axis, colorId } of pairs) {
        // アイテム内重複は1回にカウント（過剰計上を防ぐ）
        if (!perItem.has(axis)) perItem.set(axis, new Set());
        const seen = perItem.get(axis)!;
        if (seen.has(colorId)) continue;
        seen.add(colorId);

        axisCounts[axis].set(colorId, (axisCounts[axis].get(colorId) ?? 0) + 1);
        axisTotals[axis]++;
        globalCounts.set(colorId, (globalCounts.get(colorId) ?? 0) + 1);
      }
    }
    if (perItem.size > 0) itemAxisColor.set(item.id, perItem);
  }

  // ── perAxis ─────────────────────────────────────
  const perAxis: ColorAxisCount[] = COLOR_AXES.map(({ id }) => {
    const total = axisTotals[id];
    const byColor: { colorId: string; count: number; ratio: number }[] = [];
    for (const g of COLOR_GROUPS) {
      const c = axisCounts[id].get(g.id) ?? 0;
      const ratio = total > 0 ? c / total : 0;
      byColor.push({ colorId: g.id, count: c, ratio });
    }
    byColor.sort((a, b) => b.count - a.count);
    const topRaw = byColor[0];
    const topColor = total > 0 && topRaw.count > 0 ? { colorId: topRaw.colorId, ratio: topRaw.ratio } : undefined;
    return { axis: id, total, byColor, topColor };
  });

  // ── globalRanking ──────────────────────────────
  const globalTotal = Array.from(globalCounts.values()).reduce((s, n) => s + n, 0);
  const globalRanking: ColorGlobalRanking[] = COLOR_GROUPS
    .map((g) => {
      const c = globalCounts.get(g.id) ?? 0;
      return { colorId: g.id, count: c, ratio: globalTotal > 0 ? c / globalTotal : 0 };
    })
    .sort((a, b) => b.count - a.count);

  // ── comboRanking ──────────────────────────────
  // 2軸ペア × colorId 組み合わせのカウント
  // 例：outfit=black & background=blue が N 回出た
  const comboMap = new Map<string, ColorComboEntry>();
  const axisPairs: [ColorAxis, ColorAxis][] = [
    ["outfit", "hair"],
    ["outfit", "background"],
    ["outfit", "lighting"],
    ["hair", "background"],
    ["background", "lighting"],
    ["outfit", "accent"],
  ];
  for (const itemPairs of itemAxisColor.values()) {
    for (const [a1, a2] of axisPairs) {
      const set1 = itemPairs.get(a1);
      const set2 = itemPairs.get(a2);
      if (!set1 || !set2) continue;
      for (const c1 of set1) {
        for (const c2 of set2) {
          const key = `${a1}:${c1}|${a2}:${c2}`;
          const entry = comboMap.get(key);
          if (entry) {
            entry.count++;
          } else {
            comboMap.set(key, {
              axes: [{ axis: a1, colorId: c1 }, { axis: a2, colorId: c2 }],
              count: 1,
            });
          }
        }
      }
    }
  }
  const comboRanking = Array.from(comboMap.values())
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── unexploredColors ──────────────────────────
  // 全 12色のうち、global count == 0 を未開拓とする
  const unexploredColors = globalRanking
    .filter((r) => r.count === 0)
    .map((r) => r.colorId);

  // ── biasWarnings ─────────────────────────────
  const biasWarnings: ColorBiasWarning[] = [];

  // 全体で >= 50% は medium、>= 70% は high
  if (globalTotal >= 5) {
    const top = globalRanking[0];
    if (top.ratio >= 0.70) {
      const g = COLOR_GROUPS.find((x) => x.id === top.colorId)!;
      const recommend = pickRecommendedColors(top.colorId, globalRanking);
      const recJp = recommend.map((id) => COLOR_GROUPS.find((c) => c.id === id)?.jp ?? id).join("・");
      biasWarnings.push({
        axis: "global",
        colorId: top.colorId,
        ratio: top.ratio,
        severity: "high",
        message: `${g.jp}が全体の${Math.round(top.ratio * 100)}%以上です。今回は${recJp}を推奨します。`,
        recommendColorIds: recommend,
      });
    } else if (top.ratio >= 0.50) {
      const g = COLOR_GROUPS.find((x) => x.id === top.colorId)!;
      const recommend = pickRecommendedColors(top.colorId, globalRanking);
      const recJp = recommend.map((id) => COLOR_GROUPS.find((c) => c.id === id)?.jp ?? id).join("・");
      biasWarnings.push({
        axis: "global",
        colorId: top.colorId,
        ratio: top.ratio,
        severity: "medium",
        message: `${g.jp}がやや多めです（${Math.round(top.ratio * 100)}%）。${recJp}も試してみては？`,
        recommendColorIds: recommend,
      });
    }
  }

  // 軸別 70% 超え（衣装・髪・背景）
  for (const ax of perAxis) {
    if (ax.total < 5) continue;
    const top = ax.byColor[0];
    if (top.count === 0) continue;
    if (top.ratio >= 0.70) {
      const g = COLOR_GROUPS.find((x) => x.id === top.colorId)!;
      const axJp = COLOR_AXES.find((a) => a.id === ax.axis)?.jp ?? ax.axis;
      const recommend = pickRecommendedColors(top.colorId, globalRanking);
      const recJp = recommend.map((id) => COLOR_GROUPS.find((c) => c.id === id)?.jp ?? id).join("・");
      biasWarnings.push({
        axis: ax.axis,
        colorId: top.colorId,
        ratio: top.ratio,
        severity: top.ratio >= 0.85 ? "high" : "medium",
        message: `${axJp}が${g.jp}に偏っています（${Math.round(top.ratio * 100)}%）。${recJp}を提案。`,
        recommendColorIds: recommend,
      });
    }
  }

  return {
    windowSize: target.length,
    perAxis,
    globalRanking,
    comboRanking,
    unexploredColors,
    biasWarnings,
  };
}

/**
 * 偏った色に対する推奨色を3つ返す。
 * - 黒系 → 白・金・ベージュ
 * - 白系 → 黒・紺・赤
 * - その他 → 補色 + アクセント
 */
function pickRecommendedColors(biasedColorId: string, ranking: ColorGlobalRanking[]): string[] {
  const HARD_RECS: Record<string, string[]> = {
    black:    ["white", "yellow", "brown"],   // 白・金・ベージュ
    white:    ["black", "blue", "red"],
    gray:     ["red", "yellow", "green"],
    brown:    ["blue", "white", "purple"],
    red:      ["green", "blue", "white"],
    pink:     ["green", "blue", "brown"],
    orange:   ["blue", "purple", "white"],
    yellow:   ["purple", "blue", "black"],
    green:    ["red", "pink", "yellow"],
    blue:     ["orange", "yellow", "brown"],
    purple:   ["yellow", "green", "white"],
    metallic: ["red", "green", "blue"],
  };
  const baseRecs = HARD_RECS[biasedColorId] ?? ["white", "blue", "red"];

  // 出現回数の少ない順に並び替え（より未開拓側を推す）
  const ratioByColor = new Map(ranking.map((r) => [r.colorId, r.ratio]));
  return [...baseRecs].sort((a, b) => (ratioByColor.get(a) ?? 0) - (ratioByColor.get(b) ?? 0));
}

/** 単純なヘルパ：colorId → 表示メタ */
export function getColorMeta(colorId: string): ColorGroup | undefined {
  return COLOR_GROUPS.find((c) => c.id === colorId);
}

// ── A2-3b: 色の成功率分析（色×評価×時系列）docs/32 §5.5 ───────────────────────
// 既存 analyzeColors とは独立の加算的派生集計。promptText 由来の色 × resultRatings × createdAt。
// 成功=評価4-5 / 失敗=評価1-2（評価3=中立は除外）。推移=直近30日 / 90日。急上昇/急下降=30日 vs 31-90日の比率差。
export interface ColorRateEntry { colorId: string; good: number; bad: number; total: number; rate: number; }
export interface ColorTrendEntry { colorId: string; count: number; }
export interface ColorDeltaEntry { colorId: string; recent: number; prev: number; delta: number; }
export interface ColorSuccessAnalysis {
  ratedItemCount: number;
  successTop: ColorTrendEntry[];
  failTop: ColorTrendEntry[];
  successRate: ColorRateEntry[];
  trend30: ColorTrendEntry[];
  trend90: ColorTrendEntry[];
  rising: ColorDeltaEntry[];
  falling: ColorDeltaEntry[];
}

/** 1アイテムのプロンプトから出現色ID集合（軸問わず・重複除去） */
function itemColorIds(item: PromptHistoryItem): Set<string> {
  const ids = new Set<string>();
  if (!item.promptText) return ids;
  for (const sent of splitSentences(item.promptText)) {
    for (const { colorId } of extractFromSentence(sent)) ids.add(colorId);
  }
  return ids;
}

const COLOR_DAY_MS = 86400000;

export function analyzeColorSuccess(items: readonly PromptHistoryItem[], nowMs: number): ColorSuccessAnalysis {
  const good = new Map<string, number>();
  const bad = new Map<string, number>();
  let ratedItemCount = 0;
  const cnt30 = new Map<string, number>();
  const cntPrev = new Map<string, number>();
  const cnt90 = new Map<string, number>();

  for (const it of items) {
    const colors = itemColorIds(it);
    if (colors.size === 0) continue;

    const ratings = (it.resultRatings ?? []).filter((r): r is number => typeof r === "number");
    const goodImgs = ratings.filter((r) => r >= 4).length;
    const badImgs = ratings.filter((r) => r >= 1 && r <= 2).length;
    if (goodImgs > 0 || badImgs > 0) ratedItemCount++;
    for (const id of colors) {
      if (goodImgs > 0) good.set(id, (good.get(id) ?? 0) + goodImgs);
      if (badImgs > 0) bad.set(id, (bad.get(id) ?? 0) + badImgs);
    }

    const age = nowMs - it.createdAt;
    if (age <= 90 * COLOR_DAY_MS) {
      for (const id of colors) cnt90.set(id, (cnt90.get(id) ?? 0) + 1);
      if (age <= 30 * COLOR_DAY_MS) {
        for (const id of colors) cnt30.set(id, (cnt30.get(id) ?? 0) + 1);
      } else {
        for (const id of colors) cntPrev.set(id, (cntPrev.get(id) ?? 0) + 1);
      }
    }
  }

  const top = (m: Map<string, number>, n = 10): ColorTrendEntry[] =>
    [...m.entries()].map(([colorId, count]) => ({ colorId, count })).sort((a, b) => b.count - a.count).slice(0, n);

  const allIds = new Set<string>([...good.keys(), ...bad.keys()]);
  const successRate: ColorRateEntry[] = [...allIds].map((colorId) => {
    const g = good.get(colorId) ?? 0;
    const b = bad.get(colorId) ?? 0;
    const total = g + b;
    return { colorId, good: g, bad: b, total, rate: total > 0 ? Math.round((g / total) * 100) : 0 };
  }).filter((e) => e.total >= 2).sort((a, b) => b.rate - a.rate || b.total - a.total);

  const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
  const tot30 = sum(cnt30) || 1;
  const totPrev = sum(cntPrev) || 1;
  const deltaIds = new Set<string>([...cnt30.keys(), ...cntPrev.keys()]);
  const deltas: ColorDeltaEntry[] = [...deltaIds].map((colorId) => {
    const recent = Math.round(((cnt30.get(colorId) ?? 0) / tot30) * 100);
    const prev = Math.round(((cntPrev.get(colorId) ?? 0) / totPrev) * 100);
    return { colorId, recent, prev, delta: recent - prev };
  });
  const rising = [...deltas].filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 6);
  const falling = [...deltas].filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 6);

  return {
    ratedItemCount,
    successTop: top(good), failTop: top(bad), successRate,
    trend30: top(cnt30, 8), trend90: top(cnt90, 8), rising, falling,
  };
}
