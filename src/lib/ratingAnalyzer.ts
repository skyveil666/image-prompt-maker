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
import { getRatingAt, getResultImages, getAxisRatingAt, type RatingAxisKey } from "./history";

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

const SKIP_VALUES = new Set(["auto", "skip", "", null, undefined]);

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
  const tally: Record<RatingAxis, Map<string, { good: number; normal: number; bad: number }>> = {
    background: new Map(),
    outfit:     new Map(),
    hair:       new Map(),
    camera:     new Map(),
    lighting:   new Map(),
  };
  let totalRatedImages = 0;
  let totalGood = 0;
  let totalBad = 0;

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
      if (r === 5)      { totalGood++; bucket = "good"; }
      else if (r === 3) {                bucket = "normal"; }
      else              { totalBad++;   bucket = "bad"; }

      // この画像の評価を、案の details 各軸へ 1票投じる
      for (const axis of Object.keys(tally) as RatingAxis[]) {
        const v = pickAxis(item, axis);
        if (!v || SKIP_VALUES.has(v)) continue;
        let entry = tally[axis].get(v);
        if (!entry) { entry = { good: 0, normal: 0, bad: 0 }; tally[axis].set(v, entry); }
        entry[bucket!]++;
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
        total, good: counts.good, normal: counts.normal, bad: counts.bad,
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
