/**
 * 画像評価アナライザ — ユーザーが画像ごとに付けた評価から
 * 「高評価に多い軸」「低評価に多い軸」を抽出する。
 *
 * 入力：履歴アイテム配列（PromptHistoryItem[]）
 *   各アイテムは resultImageDataList と resultRatings を持つ。
 *   評価が付いている画像のみが集計対象。
 *
 * 出力：軸（背景/衣装/髪/カメラ/光）ごとに、評価別の頻度。
 *      これを基に「次回プロンプト生成のヒント」を作る。
 *
 * 設計方針：
 *   - 画像に付いた評価は、その画像を生んだプロンプトの details に対する評価とみなす
 *     （同じ案で 3 枚生成しても、3 枚それぞれ評価が違うことはあるので、画像単位で集計）
 *   - 「画像 N 枚のうち評価 X が付いた件数」を軸×値で数える
 *   - 高評価=5, 普通=3, 低評価=2/1
 */
import type { PromptHistoryItem } from "../types";
import { getRatingAt, getResultImages, getAxisRatingAt, AXIS_RATING_META, isGoodRating, type RatingAxisKey } from "./history";
import { SKIP_VALUES } from "./skipValues";

/** 「好み分析レポート」を有効化する閾値（評価サンプル合計） */
export const PREFERENCE_REPORT_THRESHOLD = 30;

// ── 型 ──────────────────────────────────────────────────────────────────────

export type RatingAxis = "background" | "outfit" | "hair" | "camera" | "lighting";

export interface RatingCategoryStat {
  /** カテゴリ値（"alley", "y2k" 等） */
  value: string;
  /** 日本語ラベル */
  jp: string;
  /** 評価サンプル数（このカテゴリでレーティングがあった画像数） */
  total: number;
  /** 高評価（5）の件数 */
  good: number;
  /** 普通（3）の件数 */
  normal: number;
  /** 低評価（2 or 1）の件数 */
  bad: number;
  /** 神評価（6）の件数 */
  kami: number;
  /** 加重スコア：(good*2 + normal*0 - bad*2) / total */
  score: number;
}

export interface RatingAxisStat {
  axis: RatingAxis;
  jp: string;
  emoji: string;
  /** 出現したカテゴリの統計（score 降順） */
  categories: RatingCategoryStat[];
  /** 高評価率の高いカテゴリTOP（score >= 1, sample >= 2） */
  recommended: RatingCategoryStat[];
  /** 低評価率の高いカテゴリTOP（score <= -1, sample >= 2） */
  avoid: RatingCategoryStat[];
}

/**
 * 軸別評価（背景/衣装/ポーズ）の集計結果。
 * 各軸で「👍 良い件数 / 👎 悪い件数 / 良い率 / 悪い率」を算出。
 * 失敗推定や好み分析レポートの根拠になる。
 */
export interface AxisPreferenceStat {
  axis: RatingAxisKey;
  jp: string;
  emoji: string;
  good: number;
  bad: number;
  total: number;
  /** 0-1。total>0 のとき good/total。total=0 なら 0 */
  goodRatio: number;
  /** 0-1。同上で bad/total */
  badRatio:  number;
  /** 信頼性ラベル（サンプル数によって変動） */
  confidence: "none" | "low" | "medium" | "high";
}

/** 好み分析レポート（30件以上の軸別評価が集まったときに有効） */
export interface PreferenceReport {
  /** 軸別評価の合計サンプル数（3軸合算） */
  totalAxisRatings: number;
  /** 閾値（PREFERENCE_REPORT_THRESHOLD と同じ） */
  threshold: number;
  /** レポートが「アクティブ」か（>=threshold） */
  active: boolean;
  /** 軸別の集計 */
  axes: AxisPreferenceStat[];
  /** 失敗推定（badRatio>=0.50 の軸） */
  failureSuspects: AxisPreferenceStat[];
  /** 成功推定（goodRatio>=0.70 の軸） */
  successCategories: AxisPreferenceStat[];
}

export interface RatingAnalysis {
  /** 評価付き画像の総数 */
  totalRatedImages: number;
  /** 全体での高評価件数 */
  totalGood: number;
  /** 全体での低評価件数 */
  totalBad: number;
  /** 神評価（6）の件数 */
  totalKami: number;
  /** 神率: totalKami / totalRatedImages（0-1） */
  kamiRate: number;
  /** 軸別統計（details カテゴリの集計） */
  axes: RatingAxisStat[];
  /** 全軸まとめて「推奨カテゴリ TOP5」 */
  topRecommended: { axis: RatingAxis; axisJp: string; cat: RatingCategoryStat }[];
  /** 全軸まとめて「回避カテゴリ TOP5」 */
  topAvoid:       { axis: RatingAxis; axisJp: string; cat: RatingCategoryStat }[];
  /** 軸別👍👎評価（背景/衣装/ポーズ）レポート — 30件以上で active=true */
  preferenceReport: PreferenceReport;
}

// ── ラベル ──────────────────────────────────────────────────────────────────

const AXIS_META: Record<RatingAxis, { jp: string; emoji: string }> = {
  background: { jp: "背景",         emoji: "🏞" },
  outfit:     { jp: "衣装",         emoji: "👗" },
  hair:       { jp: "髪型",         emoji: "💇" },
  camera:     { jp: "カメラ",       emoji: "📷" },
  lighting:   { jp: "ライティング", emoji: "💡" },
};

const BG_PLACE_JP: Record<string, string> = {
  indoor: "屋内", alley: "路地", futuristic: "未来的", abstract: "抽象",
  nature: "自然", museum: "美術館", industrial: "工業", gallery: "ギャラリー",
  atelier: "アトリエ", japanese_room: "和室", garden: "庭園", seaside: "海辺",
  forest: "森", empty_space: "余白空間", studio: "スタジオ",
  paper_backdrop: "紙背景", fabric_backdrop: "布背景",
  old_cinema: "古い映画館", greenhouse: "温室", rooftop: "屋上",
  library: "図書館", rainy_station: "雨の駅", night_amusement: "夜の遊園地",
  frosted_room: "霜の部屋",
};
const OUTFIT_STYLE_JP: Record<string, string> = {
  street: "ストリート", mode: "モード", cyber: "サイバー",
  japanese: "和風", gothic: "ゴシック", military: "ミリタリー",
  techwear: "テックウェア", dress: "ドレス", armor: "アーマー",
  y2k: "Y2K", lolita: "ロリータ", uniform: "制服",
  future_dress: "未来ドレス", wa_modern: "和モダン", idol: "アイドル",
  runway: "ランウェイ",
};
const HAIR_STYLE_JP: Record<string, string> = {
  modern: "モダン", y2k: "Y2K", heisei_gal: "平成ギャル",
  retro: "レトロ", showa_idol: "昭和アイドル", taisho_roman: "大正ロマン",
  wa_gothic: "和ゴシック", cyberpunk: "サイバーパンク",
  near_future: "近未来", magical_girl: "魔法少女",
  gothic_lolita: "ゴシックロリ", street: "ストリート",
  korean: "韓国系", anime: "アニメ", doll: "ドール",
  viral: "バズ系", unique: "ユニーク",
};
const CAMERA_ANGLE_JP: Record<string, string> = {
  front: "正面", diagonal_45: "斜め45°", low: "ローアングル",
  high: "ハイアングル", top_down: "真上", side_profile: "横顔",
  over_shoulder: "肩越し", close_portrait: "アップ",
  full_body: "全身", dutch: "ダッチ", cinematic: "シネマ",
  diagonal_high: "斜め俯瞰", back_view: "後ろ姿",
};
const LIGHTING_DIR_JP: Record<string, string> = {
  top: "トップ", side: "サイド", back: "バック", front: "フロント",
  below: "下方", multi: "マルチ", rim: "リム",
  diagonal_above: "斜め上", window: "窓光", spot: "スポット",
  ambient: "環境光",
};

// ── ユーティリティ ──────────────────────────────────────────────────────────
// SKIP_VALUES は skipValues.ts に共通化（imageAnalyzer と共有）。

function pickAxis(item: PromptHistoryItem, axis: RatingAxis): string | undefined {
  switch (axis) {
    case "background": return item.details?.background?.place  as string | undefined;
    case "outfit":     return item.details?.outfit?.style      as string | undefined;
    case "hair":       return item.details?.hair?.hairStyle    as string | undefined;
    case "camera":     return item.details?.camera?.angle      as string | undefined;
    case "lighting":   return item.details?.lighting?.direction as string | undefined;
  }
}

function labelFor(axis: RatingAxis, value: string): string {
  switch (axis) {
    case "background": return BG_PLACE_JP[value]     ?? value;
    case "outfit":     return OUTFIT_STYLE_JP[value] ?? value;
    case "hair":       return HAIR_STYLE_JP[value]   ?? value;
    case "camera":     return CAMERA_ANGLE_JP[value] ?? value;
    case "lighting":   return LIGHTING_DIR_JP[value] ?? value;
  }
}

// ── 本体 ────────────────────────────────────────────────────────────────────

/**
 * 履歴から評価分析を行う。
 *
 * 各履歴アイテムの登録画像と評価（resultRatings）をひもづけ、
 * その画像を生んだ details の軸値（background/outfit/hair/camera/lighting）に
 * 評価を投票していく方式で集計。
 */
export function analyzeRatings(items: readonly PromptHistoryItem[]): RatingAnalysis {
  // 軸 × カテゴリ値 → { good, normal, bad }
  const tally: Record<RatingAxis, Map<string, { good: number; normal: number; bad: number; kami: number }>> = {
    background: new Map(),
    outfit:     new Map(),
    hair:       new Map(),
    camera:     new Map(),
    lighting:   new Map(),
  };
  let totalRatedImages = 0;
  let totalGood = 0;
  let totalBad = 0;
  let totalKami = 0;

  for (const item of items) {
    const images = getResultImages(item);
    if (images.length === 0) continue;

    // この案で何枚に評価が付いたか
    let ratedHere = 0;
    let bucket: "good" | "normal" | "bad" | null = null;
    // 案全体の評価分布。サンプルが少ない場合は画像ごとの評価をそのまま使い、
    // 多い場合は最頻評価で代表する … よりも、画像ごとに独立カウントの方が単純で正確。
    for (let i = 0; i < images.length; i++) {
      const r = getRatingAt(item, i);
      if (r == null) continue;
      ratedHere++;
      if (isGoodRating(r)) { totalGood++; bucket = "good"; }   // 5=良い / 6=神 を good 扱い
      else if (r === 3) {                bucket = "normal"; }
      else              { totalBad++;   bucket = "bad"; }
      if (r === 6) totalKami++;

      // この画像の評価を、案の details 各軸へ 1票投じる
      for (const axis of Object.keys(tally) as RatingAxis[]) {
        const v = pickAxis(item, axis);
        if (!v || SKIP_VALUES.has(v)) continue;
        let entry = tally[axis].get(v);
        if (!entry) { entry = { good: 0, normal: 0, bad: 0, kami: 0 }; tally[axis].set(v, entry); }
        entry[bucket!]++;
        if (r === 6) entry.kami++;
      }
    }
    totalRatedImages += ratedHere;
  }

  // ── 各軸を統計化 ──
  const axes: RatingAxisStat[] = (Object.keys(tally) as RatingAxis[]).map((axis) => {
    const meta = AXIS_META[axis];
    const categories: RatingCategoryStat[] = [];
    for (const [value, counts] of tally[axis].entries()) {
      const total = counts.good + counts.normal + counts.bad;
      const score = total > 0 ? (counts.good * 2 - counts.bad * 2) / total : 0;
      categories.push({
        value, jp: labelFor(axis, value),
        total, good: counts.good, normal: counts.normal, bad: counts.bad, kami: counts.kami,
        score,
      });
    }
    categories.sort((a, b) => b.score - a.score);
    const recommended = categories.filter((c) => c.total >= 2 && c.score >= 1).slice(0, 5);
    const avoid       = categories.filter((c) => c.total >= 2 && c.score <= -1).slice(-5).reverse();
    return { axis, jp: meta.jp, emoji: meta.emoji, categories, recommended, avoid };
  });

  // ── 全軸まとめのTOP ──
  const allRecommended: { axis: RatingAxis; axisJp: string; cat: RatingCategoryStat }[] = [];
  const allAvoid:       { axis: RatingAxis; axisJp: string; cat: RatingCategoryStat }[] = [];
  for (const a of axes) {
    for (const c of a.recommended) allRecommended.push({ axis: a.axis, axisJp: a.jp, cat: c });
    for (const c of a.avoid)       allAvoid.push      ({ axis: a.axis, axisJp: a.jp, cat: c });
  }
  allRecommended.sort((x, y) => y.cat.score - x.cat.score);
  allAvoid      .sort((x, y) => x.cat.score - y.cat.score);

  // ── 軸別 👍👎 評価集計（背景/衣装/ポーズ）──
  const AXIS_META_KEY: Record<RatingAxisKey, { jp: string; emoji: string }> = {
    bg:     { jp: "背景",   emoji: "🏞" },
    outfit: { jp: "衣装",   emoji: "👗" },
    pose:   { jp: "ポーズ", emoji: "🧍" },
  };
  const prefAxes: AxisPreferenceStat[] = (["bg", "outfit", "pose"] as RatingAxisKey[]).map((axis) => {
    let good = 0, bad = 0;
    for (const item of items) {
      const images = getResultImages(item);
      for (let i = 0; i < images.length; i++) {
        const v = getAxisRatingAt(item, axis, i);
        if (v === 5) good++;
        else if (v === 1) bad++;
      }
    }
    const total = good + bad;
    const goodRatio = total > 0 ? good / total : 0;
    const badRatio  = total > 0 ? bad / total : 0;
    let confidence: AxisPreferenceStat["confidence"] = "none";
    if (total >= 30)      confidence = "high";
    else if (total >= 15) confidence = "medium";
    else if (total >= 5)  confidence = "low";
    return { axis, jp: AXIS_META_KEY[axis].jp, emoji: AXIS_META_KEY[axis].emoji,
             good, bad, total, goodRatio, badRatio, confidence };
  });
  const totalAxisRatings = prefAxes.reduce((s, a) => s + a.total, 0);
  const preferenceReport: PreferenceReport = {
    totalAxisRatings,
    threshold: PREFERENCE_REPORT_THRESHOLD,
    active: totalAxisRatings >= PREFERENCE_REPORT_THRESHOLD,
    axes: prefAxes,
    failureSuspects:   prefAxes.filter((a) => a.total >= 5 && a.badRatio  >= 0.50),
    successCategories: prefAxes.filter((a) => a.total >= 5 && a.goodRatio >= 0.70),
  };

  return {
    totalRatedImages, totalGood, totalBad,
    totalKami,
    kamiRate: totalRatedImages > 0 ? totalKami / totalRatedImages : 0,
    axes,
    topRecommended: allRecommended.slice(0, 5),
    topAvoid:       allAvoid.slice(0, 5),
    preferenceReport,
  };
}

/**
 * サーバへ送る形式（ratingBias）に整形。
 * 「変更範囲ONの軸だけを送る」のは呼び出し側の責任。
 */
export interface RatingBiasPayload {
  recommended?: { axis: RatingAxis; label: string; score: number }[];
  avoid?:       { axis: RatingAxis; label: string; score: number }[];
  preference?: {
    active: boolean;
    axes: { axis: RatingAxisKey; good: number; bad: number; goodRatio: number; badRatio: number }[];
  };
}

export function buildRatingBiasPayload(
  analysis: RatingAnalysis,
  activeScopes: ReadonlySet<string>,
): RatingBiasPayload | null {
  const scopeOf: Record<RatingAxis, string> = {
    background: "background", outfit: "outfit", hair: "hair",
    camera: "camera", lighting: "lighting",
  };
  const rec = analysis.topRecommended.filter((r) => activeScopes.has(scopeOf[r.axis]));
  const avd = analysis.topAvoid      .filter((r) => activeScopes.has(scopeOf[r.axis]));
  // 軸別👍👎レポートは、サーバ側で改めて scope フィルタするので全部送る
  const pref = analysis.preferenceReport;
  const hasPref = pref.active && pref.axes.some((a) => a.total > 0);

  if (rec.length === 0 && avd.length === 0 && !hasPref) return null;
  return {
    ...(rec.length > 0 && {
      recommended: rec.map((r) => ({ axis: r.axis, label: r.cat.jp, score: r.cat.score })),
    }),
    ...(avd.length > 0 && {
      avoid: avd.map((r) => ({ axis: r.axis, label: r.cat.jp, score: r.cat.score })),
    }),
    ...(hasPref && {
      preference: {
        active: pref.active,
        axes: pref.axes.map((a) => ({
          axis: a.axis, good: a.good, bad: a.bad,
          goodRatio: a.goodRatio, badRatio: a.badRatio,
        })),
      },
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  評価集計 強化（②）— 期間別 / 軸別👍👎 / カテゴリ別成功率 / 月別 / 推移
//  ※ analyzeRatings（好み学習・サーバ送信）は不変。本セクションは表示専用の追加集計。
//    成功/失敗の基準は色成功率分析と統一：全体評価 5=成功 / 3=中立 / 2・1=失敗。
// ════════════════════════════════════════════════════════════════════════════

export type RatingPeriodKey = "d7" | "d30" | "d90" | "all";

/** 軸別👍👎（背景/衣装/ポーズ・直接評価データ）の期間集計 */
export interface AxisGoodBadStat {
  axis: RatingAxisKey;
  jp: string;
  emoji: string;
  good: number;
  bad: number;
  total: number;
  /** good/(good+bad) */
  goodRatio: number;
}

/** カテゴリ値別の成功率（全体評価×details軸出現から派生） */
export interface CatSuccessEntry {
  value: string;
  jp: string;
  good: number;
  bad: number;
  total: number;
  /** good/(good+bad) */
  rate: number;
}

/** details軸（背景/衣装/髪型/カメラ/ライティング）別の成功率集計 */
export interface AxisSuccessStat {
  axis: RatingAxis;
  jp: string;
  emoji: string;
  good: number;
  bad: number;
  total: number;
  rate: number;
  /** 成功率の高いカテゴリ値（total>=2） */
  best: CatSuccessEntry[];
  /** 成功率の低いカテゴリ値（total>=2） */
  worst: CatSuccessEntry[];
}

export interface RatingPeriodStat {
  key: RatingPeriodKey;
  label: string;
  rated: number;
  good: number;
  normal: number;
  bad: number;
  /** 神評価（6）の件数 */
  kami: number;
  /** 神率: kami / rated（0-1） */
  kamiRate: number;
  /** 全体評価の平均（rated>0 のとき） */
  avg: number;
  /** 成功率 good/(good+bad) */
  rate: number;
  axisGoodBad: AxisGoodBadStat[];
  axisSuccess: AxisSuccessStat[];
}

export interface MonthlyRatingStat {
  /** "YYYY-MM" */
  month: string;
  count: number;
  good: number;
  normal: number;
  bad: number;
  avg: number;
  rate: number;
}

export interface RatingTrend {
  recentAvg: number;
  prevAvg: number;
  deltaAvg: number;
  recentRate: number;
  prevRate: number;
  deltaRate: number;
  recentN: number;
  prevN: number;
}

export interface RatingTrends {
  periods: Record<RatingPeriodKey, RatingPeriodStat>;
  monthly: MonthlyRatingStat[];
  trend: RatingTrend;
  totalRated: number;
}

const RT_DAY_MS = 86_400_000;
const RATING_PERIODS: { key: RatingPeriodKey; label: string; maxAgeDays: number | null }[] = [
  { key: "d7", label: "直近7日", maxAgeDays: 7 },
  { key: "d30", label: "直近30日", maxAgeDays: 30 },
  { key: "d90", label: "直近90日", maxAgeDays: 90 },
  { key: "all", label: "全期間", maxAgeDays: null },
];

function rtBucket(r: number): "good" | "normal" | "bad" {
  if (isGoodRating(r)) return "good";
  if (r === 3) return "normal";
  return "bad"; // 1, 2
}

function rtCreatedAt(item: PromptHistoryItem): number | null {
  const t = (item as { createdAt?: number }).createdAt;
  return typeof t === "number" && Number.isFinite(t) ? t : null;
}

function computePeriodStat(
  key: RatingPeriodKey,
  label: string,
  items: readonly PromptHistoryItem[],
): RatingPeriodStat {
  let rated = 0, good = 0, normal = 0, bad = 0, sum = 0, kami = 0;

  const axisGB: Record<RatingAxisKey, { good: number; bad: number }> = {
    bg: { good: 0, bad: 0 }, outfit: { good: 0, bad: 0 }, pose: { good: 0, bad: 0 },
  };
  const catTally: Record<RatingAxis, Map<string, { good: number; bad: number }>> = {
    background: new Map(), outfit: new Map(), hair: new Map(), camera: new Map(), lighting: new Map(),
  };

  for (const item of items) {
    const images = getResultImages(item);
    for (let i = 0; i < images.length; i++) {
      // 軸別👍👎（直接評価データ）
      for (const ax of ["bg", "outfit", "pose"] as RatingAxisKey[]) {
        const v = getAxisRatingAt(item, ax, i);
        if (v === 5) axisGB[ax].good++;
        else if (v === 1) axisGB[ax].bad++;
      }
      // 全体評価
      const r = getRatingAt(item, i);
      if (r == null) continue;
      rated++; sum += r;
      if (r === 6) kami++;
      const b = rtBucket(r);
      if (b === "good") good++;
      else if (b === "normal") normal++;
      else bad++;
      // カテゴリ別成功率（中立=3 は寄与させない）
      if (b !== "normal") {
        for (const ax of Object.keys(catTally) as RatingAxis[]) {
          const val = pickAxis(item, ax);
          if (!val || SKIP_VALUES.has(val)) continue;
          let e = catTally[ax].get(val);
          if (!e) { e = { good: 0, bad: 0 }; catTally[ax].set(val, e); }
          if (b === "good") e.good++; else e.bad++;
        }
      }
    }
  }

  const axisGoodBad: AxisGoodBadStat[] = (["bg", "outfit", "pose"] as RatingAxisKey[]).map((ax) => {
    const g = axisGB[ax].good, bd = axisGB[ax].bad, total = g + bd;
    return {
      axis: ax, jp: AXIS_RATING_META[ax].jp, emoji: AXIS_RATING_META[ax].emoji,
      good: g, bad: bd, total, goodRatio: total > 0 ? g / total : 0,
    };
  });

  const axisSuccess: AxisSuccessStat[] = (Object.keys(catTally) as RatingAxis[]).map((ax) => {
    const meta = AXIS_META[ax];
    let g = 0, bd = 0;
    const cats: CatSuccessEntry[] = [];
    for (const [value, c] of catTally[ax].entries()) {
      const total = c.good + c.bad;
      g += c.good; bd += c.bad;
      cats.push({ value, jp: labelFor(ax, value), good: c.good, bad: c.bad, total, rate: total > 0 ? c.good / total : 0 });
    }
    const total = g + bd;
    const eligible = cats.filter((c) => c.total >= 2);
    const best = [...eligible].sort((a, b2) => b2.rate - a.rate || b2.total - a.total).slice(0, 5);
    const worst = [...eligible].sort((a, b2) => a.rate - b2.rate || b2.total - a.total).slice(0, 5);
    return { axis: ax, jp: meta.jp, emoji: meta.emoji, good: g, bad: bd, total, rate: total > 0 ? g / total : 0, best, worst };
  });

  return {
    key, label, rated, good, normal, bad, kami,
    kamiRate: rated > 0 ? kami / rated : 0,
    avg: rated > 0 ? sum / rated : 0,
    rate: (good + bad) > 0 ? good / (good + bad) : 0,
    axisGoodBad, axisSuccess,
  };
}

function computeWindow(
  items: readonly PromptHistoryItem[], nowMs: number, fromDays: number, toDays: number,
): { n: number; avg: number; rate: number } {
  let n = 0, good = 0, bad = 0, sum = 0;
  for (const item of items) {
    const t = rtCreatedAt(item);
    if (t == null) continue;
    const age = (nowMs - t) / RT_DAY_MS;
    if (age < fromDays || age >= toDays) continue;
    const images = getResultImages(item);
    for (let i = 0; i < images.length; i++) {
      const r = getRatingAt(item, i);
      if (r == null) continue;
      n++; sum += r;
      const b = rtBucket(r);
      if (b === "good") good++; else if (b === "bad") bad++;
    }
  }
  return { n, avg: n > 0 ? sum / n : 0, rate: (good + bad) > 0 ? good / (good + bad) : 0 };
}

/**
 * 評価集計の強化版（表示専用）。
 * 期間別（7/30/90/全期間）× 軸別👍👎（背景/衣装/ポーズ）× カテゴリ別成功率
 * （背景/衣装/髪型/カメラ/ライティング）＋ 月別推移 ＋ 直近トレンド を一括算出。
 *
 * @param items 履歴アイテム（全件）
 * @param nowMs 現在時刻（Date.now()）— 期間フィルタの基準
 */
export function analyzeRatingTrends(
  items: readonly PromptHistoryItem[], nowMs: number,
): RatingTrends {
  const periods = {} as Record<RatingPeriodKey, RatingPeriodStat>;
  for (const p of RATING_PERIODS) {
    const filtered = p.maxAgeDays == null
      ? items
      : items.filter((it) => {
          const t = rtCreatedAt(it);
          return t != null && (nowMs - t) <= p.maxAgeDays! * RT_DAY_MS;
        });
    periods[p.key] = computePeriodStat(p.key, p.label, filtered);
  }

  // 月別
  const byMonth = new Map<string, { count: number; good: number; normal: number; bad: number; sum: number }>();
  for (const item of items) {
    const t = rtCreatedAt(item);
    if (t == null) continue;
    const d = new Date(t);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const images = getResultImages(item);
    for (let i = 0; i < images.length; i++) {
      const r = getRatingAt(item, i);
      if (r == null) continue;
      let m = byMonth.get(month);
      if (!m) { m = { count: 0, good: 0, normal: 0, bad: 0, sum: 0 }; byMonth.set(month, m); }
      m.count++; m.sum += r;
      const b = rtBucket(r);
      if (b === "good") m.good++; else if (b === "normal") m.normal++; else m.bad++;
    }
  }
  const monthly: MonthlyRatingStat[] = [...byMonth.entries()]
    .map(([month, m]) => ({
      month, count: m.count, good: m.good, normal: m.normal, bad: m.bad,
      avg: m.count > 0 ? m.sum / m.count : 0,
      rate: (m.good + m.bad) > 0 ? m.good / (m.good + m.bad) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 推移（直近30日 vs 31〜60日前）
  const recent = computeWindow(items, nowMs, 0, 30);
  const prev = computeWindow(items, nowMs, 30, 60);
  const trend: RatingTrend = {
    recentAvg: recent.avg, prevAvg: prev.avg, deltaAvg: recent.avg - prev.avg,
    recentRate: recent.rate, prevRate: prev.rate, deltaRate: recent.rate - prev.rate,
    recentN: recent.n, prevN: prev.n,
  };

  return { periods, monthly, trend, totalRated: periods.all.rated };
}

// ════════════════════════════════════════════════════════════════════════════
//  ③ 成功/失敗ランキング — 構成（組合せ）/ 要素横断 / 案単位
//  目的：勝ちパターン発見・神引き候補発見。成功=評価5 / 失敗=評価2・1（中立3は除外）。
//  ※ 表示専用。保存データ・既存集計・好み学習・生成には一切影響しない。
//  ※ 要素横断の「色」は表示側で既存 colorSuccess（色別成功率）と統合する（再抽出しない）。
// ════════════════════════════════════════════════════════════════════════════

export interface ComboPart { axisJp: string; valueJp: string; }

/** 構成（組合せ）単位の成功率エントリ */
export interface ComboRankEntry {
  key: string;
  size: number;
  parts: ComboPart[];
  good: number;
  bad: number;
  total: number;
  /** good/(good+bad)。0-1 */
  rate: number;
}

/** 要素横断（単一要素）の成功率エントリ */
export interface ElementRankEntry {
  key: string;
  axisJp: string;
  valueJp: string;
  emoji: string;
  good: number;
  bad: number;
  total: number;
  /** 0-1 */
  rate: number;
}

/** 案（個別生成）単位の成功度エントリ */
export interface CaseRankEntry {
  id: string;
  promptText: string;
  /** 主要要素ラベル（絵文字＋値） */
  parts: string[];
  createdAt: number | null;
  good: number;
  bad: number;
  rated: number;
  /** 全体評価の平均 */
  avg: number;
}

export interface SuccessRankings {
  composition: { success: ComboRankEntry[]; fail: ComboRankEntry[] };
  /** details軸の全要素（色は表示側で colorSuccess と統合してから順位付け） */
  elements: ElementRankEntry[];
  cases: { success: CaseRankEntry[]; fail: CaseRankEntry[] };
  minSample: number;
  topN: number;
  totalRated: number;
}

const RANK_AXES: { axis: RatingAxis; jp: string; emoji: string }[] = [
  { axis: "background", jp: "背景", emoji: "🏞" },
  { axis: "outfit", jp: "衣装", emoji: "👗" },
  { axis: "hair", jp: "髪型", emoji: "💇" },
  { axis: "camera", jp: "カメラ", emoji: "📷" },
  { axis: "lighting", jp: "ライティング", emoji: "💡" },
];

/** 配列から k 個の組合せを列挙（入力順を保持） */
function combosOf<T>(arr: readonly T[], k: number): T[][] {
  const n = arr.length;
  const res: T[][] = [];
  if (k > n || k <= 0) return res;
  const idx = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    res.push(idx.map((i) => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return res;
}

/**
 * 成功/失敗ランキングを算出（全期間）。
 * @param items 履歴アイテム（全件）
 * @param opts.minSample 構成/要素の最小サンプル数（既定3）
 * @param opts.topN 各ランキングの上限件数（既定20）
 */
export function analyzeSuccessRankings(
  items: readonly PromptHistoryItem[],
  opts?: { minSample?: number; topN?: number },
): SuccessRankings {
  const minSample = opts?.minSample ?? 3;
  const topN = opts?.topN ?? 20;

  const elemTally = new Map<string, { axisJp: string; valueJp: string; emoji: string; good: number; bad: number }>();
  const comboTally = new Map<string, { parts: ComboPart[]; size: number; good: number; bad: number }>();
  const caseTally = new Map<string, { promptText: string; parts: string[]; createdAt: number | null; good: number; bad: number; sum: number; rated: number }>();
  let totalRated = 0;

  for (const item of items) {
    const present: { axis: RatingAxis; axisJp: string; valueJp: string; emoji: string; value: string }[] = [];
    for (const a of RANK_AXES) {
      const v = pickAxis(item, a.axis);
      if (!v || SKIP_VALUES.has(v)) continue;
      present.push({ axis: a.axis, axisJp: a.jp, emoji: a.emoji, value: v, valueJp: labelFor(a.axis, v) });
    }
    const partsLabels = present.map((p) => `${p.emoji}${p.valueJp}`);

    const images = getResultImages(item);
    let iGood = 0, iBad = 0, iSum = 0, iRated = 0;
    for (let i = 0; i < images.length; i++) {
      const r = getRatingAt(item, i);
      if (r == null) continue;
      const b = rtBucket(r);
      iRated++; iSum += r; totalRated++;
      if (b === "good") iGood++; else if (b === "bad") iBad++;
      if (b === "normal") continue; // 中立は成功/失敗の集計に寄与させない

      // 要素横断（単一要素）
      for (const p of present) {
        const key = `${p.axis}:${p.value}`;
        let e = elemTally.get(key);
        if (!e) { e = { axisJp: p.axisJp, valueJp: p.valueJp, emoji: p.emoji, good: 0, bad: 0 }; elemTally.set(key, e); }
        if (b === "good") e.good++; else e.bad++;
      }
      // 構成（2要素・3要素の組合せ）
      for (const k of [2, 3]) {
        for (const combo of combosOf(present, k)) {
          const key = combo.map((p) => `${p.axis}:${p.value}`).join("|");
          let c = comboTally.get(key);
          if (!c) { c = { parts: combo.map((p) => ({ axisJp: p.axisJp, valueJp: p.valueJp })), size: k, good: 0, bad: 0 }; comboTally.set(key, c); }
          if (b === "good") c.good++; else c.bad++;
        }
      }
    }
    if (iRated > 0) {
      const id = (item as { id?: string }).id ?? item.promptText ?? "";
      caseTally.set(id, {
        promptText: item.promptText ?? "",
        parts: partsLabels,
        createdAt: rtCreatedAt(item),
        good: iGood, bad: iBad, sum: iSum, rated: iRated,
      });
    }
  }

  // 要素横断（details軸の全件。色は表示側で統合）
  const elements: ElementRankEntry[] = [...elemTally.entries()].map(([key, e]) => {
    const total = e.good + e.bad;
    return { key, axisJp: e.axisJp, valueJp: e.valueJp, emoji: e.emoji, good: e.good, bad: e.bad, total, rate: total > 0 ? e.good / total : 0 };
  });

  // 構成
  const eligibleCombos: ComboRankEntry[] = [...comboTally.entries()]
    .map(([key, c]) => {
      const total = c.good + c.bad;
      return { key, size: c.size, parts: c.parts, good: c.good, bad: c.bad, total, rate: total > 0 ? c.good / total : 0 };
    })
    .filter((c) => c.total >= minSample);
  // 成功リストは「成功1件以上」、失敗リストは「失敗1件以上」に限定（100%/0%の混入を防ぐ）
  const compSuccess = [...eligibleCombos].filter((c) => c.good > 0).sort((a, b) => b.rate - a.rate || b.total - a.total).slice(0, topN);
  const compFail = [...eligibleCombos].filter((c) => c.bad > 0).sort((a, b) => a.rate - b.rate || b.total - a.total).slice(0, topN);

  // 案単位
  const allCases: CaseRankEntry[] = [...caseTally.entries()].map(([id, c]) => ({
    id, promptText: c.promptText, parts: c.parts, createdAt: c.createdAt,
    good: c.good, bad: c.bad, rated: c.rated, avg: c.rated > 0 ? c.sum / c.rated : 0,
  }));
  const caseSuccess = [...allCases].filter((c) => c.good > 0).sort((a, b) => b.avg - a.avg || b.rated - a.rated).slice(0, topN);
  const caseFail = [...allCases].filter((c) => c.bad > 0).sort((a, b) => a.avg - b.avg || b.rated - a.rated).slice(0, topN);

  return {
    composition: { success: compSuccess, fail: compFail },
    elements,
    cases: { success: caseSuccess, fail: caseFail },
    minSample, topN, totalRated,
  };
}
