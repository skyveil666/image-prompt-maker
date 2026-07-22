/**
 * クイック操作用の状態ビルダー：
 *  - ✨ アレンジ（buildArrangeInputs）
 *  - 👗 Y2K / 🚀 Y3K / 🏙️ ストリート ほか世界観プリセット（buildCombinedWorldInputs）
 * いずれも現在の inputs をベースに、必要なフィールドだけ差し替えて返す純粋関数。
 */
import {
  DEFAULT_DETAILS,
  AUTO_DETAILS,
  type BackgroundPlace,
  type BackgroundStyle,
  type BackgroundEffect,
  type BackgroundColor,
  type BackgroundDensity,
  type CyberGlowColor,
  type HairStyle,
  type LightIntensity,
  type LightTemperature,
  type Mood,
  type OutfitColor,
  type OutfitDecoration,
  type OutfitLuxury,
  type OutfitMaterial,
  type OutfitSilhouette,
  type OutfitStyle,
  type PromptHistoryItem,
  type PromptInputs,
  type PropsCategory,
  type Scope,
} from "../types";
import {
  type VariationMemory,
  pickAvoidingRecent,
  pickNAvoidingRecent,
} from "./variationEngine";

const ALL_MOODS: Mood[] = [
  "cool",
  "digital",
  "preserve_bg_color",
  "minimal",
  "japanese",
  "glitch",
  "fantasy",
  "sns_pop",
  "bright",
  "dark",
  "cyberpunk",
  "gothic",
  "translucent",
  "luxe",
  "cute",
  "stylish",
  "emo",
  "cinematic",
  "near_future",
  "retro",
  "pop",
  "monochrome",
  "pastel",
  "vivid",
  "mystic",
  "decadent",
  "street",
  "art",
  "fantasy_world",
  "noisy",
  // SNS最適化（Task D で追加）
  "portrait",
  "wa_fantasy",
  "tiktok",
  "instagram",
  "pinterest",
  "x_buzz",
  "trend_2026",
];

// ─── 重み付きスコープ抽選（プリセット・生成ツール共通） ───────────────────────────
//
// ■ 設計方針
//   プリセット = 「世界観を決める」だけ。変更範囲（scopes）は毎回ランダム抽選。
//   同じ組み合わせの連続を防ぐため memory.lastScopes を参照する。
//   基本 2〜4 個を選出（理想 3 個前後）。

export type ScopeWeight = Partial<Record<Scope, number>>;

/** プリセット適用時のランダム抽選対象スコープ（aspect_ratio はプリセット外） */
export const PRESET_SCOPE_POOL: Scope[] = [
  "background", "foreground", "pose", "hair", "outfit",
  "cosplay", "cyber", "camera", "props", "vehicle", "myth", "lighting",
];

/**
 * 選択済みムードからスコープへのブースト値を算出する。
 * プリセットの基本重みに加算して使う。
 */
export function getMoodScopeBoosts(moods: readonly Mood[]): ScopeWeight {
  const b: ScopeWeight = {};
  const add = (s: Scope, n: number) => {
    b[s] = ((b[s] as number | undefined) ?? 0) + n;
  };
  for (const m of moods) {
    if (["fantasy", "mystic", "wa_fantasy", "fantasy_world"].includes(m))       { add("myth", 5);       add("foreground", 3); add("lighting", 3); }
    if (["ad_visual", "magazine_cover", "scroll_stop"].includes(m))             { add("camera", 5);     add("lighting", 4);  add("props", 3);   }
    if (["retro", "noisy"].includes(m))                                          { add("background", 4); add("outfit", 3);     add("props", 3);   }
    if (["cyberpunk", "near_future", "digital", "glitch"].includes(m))          { add("cyber", 5);      add("foreground", 3); add("lighting", 3); }
    if (["japanese", "wa_fantasy"].includes(m))                                  { add("outfit", 4);     add("myth", 4);       add("background", 3); }
    if (["gothic", "dark", "decadent"].includes(m))                             { add("outfit", 4);     add("lighting", 4);   add("foreground", 3); }
    if (["cinematic", "movie_poster", "emo"].includes(m))                       { add("camera", 5);     add("lighting", 4);   add("background", 3); }
    if (["sns_pop", "tiktok", "instagram", "x_buzz", "scroll_stop"].includes(m)) { add("foreground", 4); add("props", 4);      add("camera", 3);  }
    if (["luxe", "art", "stylish"].includes(m))                                  { add("outfit", 3);     add("lighting", 3);   add("camera", 3);  }
    if (["street", "contemporary"].includes(m))                                  { add("outfit", 4);     add("hair", 4);       add("pose", 3);    }
  }
  return b;
}

/**
 * 重み付きランダムスコープ抽選。
 *
 * @param base           プリセット別の基本重み
 * @param moods          選択中のムード（ブースト計算に使う）
 * @param lastScopes     直前に使ったスコープ一覧（完全一致連続禁止）
 * @param min / max      選出個数の下限/上限（デフォルト 2〜4）
 * @param penalizeRecent true のとき lastScopes 内要素の重みを 30% に削減（量産回避向け）
 */
export function pickScopesWeighted(
  base:           ScopeWeight,
  moods:          readonly Mood[],
  lastScopes:     readonly string[],
  min            = 2,
  max            = 4,
  penalizeRecent = false,
  forced:         readonly Scope[] = [],
): Scope[] {
  const boost     = getMoodScopeBoosts(moods);
  const lastSet   = new Set(lastScopes);
  const forcedSet = new Set<Scope>(forced);
  const w: Partial<Record<string, number>> = {};

  for (const s of PRESET_SCOPE_POOL) {
    let v = ((base[s] as number | undefined) ?? 0) + ((boost[s] as number | undefined) ?? 0);
    if (penalizeRecent && lastSet.has(s)) v = Math.max(1, Math.floor(v * 0.3));
    if (v > 0) w[s] = v;
  }

  const count   = min + Math.floor(Math.random() * (max - min + 1));
  const pool    = PRESET_SCOPE_POOL.filter((s) => (w[s] ?? 0) > 0);
  const chosen  = new Set<Scope>(forced);  // forced スコープ（outfit 等）を先行シード＝必ず含める

  while (chosen.size < count) {
    const avail = pool.filter((s) => !chosen.has(s));
    if (avail.length === 0) break;
    const total = avail.reduce((sum, s) => sum + (w[s] ?? 0), 0);
    if (total <= 0) break;
    let r    = Math.random() * total;
    let pick = avail[avail.length - 1];
    for (const s of avail) { r -= (w[s] ?? 0); if (r <= 0) { pick = s; break; } }
    chosen.add(pick);
  }

  const result = [...chosen];

  // 直近と完全一致 → forced 以外の 1 要素をランダムに入れ替えて差別化（forced は必ず残す）
  if (result.length === lastScopes.length && result.every((s) => lastSet.has(s))) {
    const rest         = pool.filter((s) => !chosen.has(s));
    const swappableIdx = result.map((s, i) => (forcedSet.has(s) ? -1 : i)).filter((i) => i >= 0);
    if (rest.length > 0 && swappableIdx.length > 0) {
      const replaceIdx   = swappableIdx[Math.floor(Math.random() * swappableIdx.length)];
      result[replaceIdx] = rest[Math.floor(Math.random() * rest.length)];
    }
  }
  return result;
}

/** 世界観プリセット用：衣装(outfit)を必ず含め、残りを weighted で 2〜3 軸足す（総数 3〜4・全ジャンル共通）。 */
function pickWorldScopes(
  base:       ScopeWeight,
  moods:      readonly Mood[],
  lastScopes: readonly string[],
): Scope[] {
  return pickScopesWeighted(base, moods, lastScopes, 3, 4, false, ["outfit"]);
}

/**
 * プリセット別スコープ基本重み（高いほど選ばれやすい）。
 * ムードブーストと合算されるため、ここでは世界観の「素の優先度」を表す。
 */
export const PW: Record<string, ScopeWeight> = {
  y2k:    { background: 7,  foreground: 2, pose: 3, hair: 9,  outfit: 10, cyber: 1, camera: 4, props: 7,  lighting: 4 },
  y3k:    { background: 6,  foreground: 7, pose: 2, hair: 8,  outfit: 9,  cyber: 10, camera: 5, props: 7, myth: 1, lighting: 8 },
  street: { background: 8,  foreground: 2, pose: 7, hair: 9,  outfit: 10, camera: 7, props: 6,  lighting: 4 },
  wafuu:  { background: 9,  foreground: 7, pose: 3, hair: 5,  outfit: 10, camera: 3, props: 7,  myth: 8,   lighting: 6 },
  gothic: { background: 8,  foreground: 7, pose: 2, hair: 5,  outfit: 10, camera: 3, props: 5,  lighting: 9 },
  cinema: { background: 8,  foreground: 3, pose: 5, hair: 2,  outfit: 5,  camera: 10, lighting: 10 },
  ad:     { background: 7,  foreground: 2, pose: 2, hair: 4,  outfit: 7,  camera: 10, props: 5,  lighting: 8 },
  fantasy:{ background: 8,  foreground: 10, pose: 3, hair: 3, outfit: 5,  camera: 2,  props: 7,  myth: 9,   lighting: 8 },
  retro:  { background: 10, foreground: 3, pose: 2, hair: 6,  outfit: 9,  camera: 6,  props: 7,  lighting: 8 },
  god:        { background: 8,  foreground: 8, pose: 4, hair: 8,  outfit: 8,  cyber: 8,  camera: 8,  props: 8,  myth: 8,  lighting: 8 },
  gap:        { background: 7,  foreground: 6, pose: 6, hair: 7,  outfit: 9,  cyber: 4,  camera: 5,  myth: 4,   lighting: 7 },
  clean:      { background: 8,  foreground: 1, pose: 1, hair: 3,  outfit: 8,  camera: 5,  lighting: 7 },
  viral:      { background: 5,  foreground: 10, pose: 2, hair: 3, outfit: 4,  camera: 8,  props: 9,   lighting: 7 },
  jirai:      { outfit: 10, hair: 9, props: 8, lighting: 7, background: 6, camera: 5 },
  seikimatsu: { outfit: 9, background: 10, vehicle: 7, big_object: 7, lighting: 8, camera: 6 },
  // 🌌 斬新背景：背景を最優先、補助は前景・ライティングのみ（人物軸 outfit/pose/hair/camera/cyber は含めない＝人物を触らない）。
  code_space: { background: 10, lighting: 7, foreground: 6 },
  math_world: { background: 10, lighting: 6, foreground: 6 },
  digit_world: { background: 10, lighting: 7, foreground: 6 },
  kanji_space: { background: 10, lighting: 6, foreground: 6 },
  typo_space:  { background: 10, lighting: 7, foreground: 6 },
  circuit_city: { background: 10, lighting: 7, foreground: 6 },
  polygon_mesh: { background: 10, lighting: 6, foreground: 6 },
};



/**
 * ✨ アレンジ：過去プロンプトの雰囲気・世界観を継承しつつ、別案を生成する。
 * - 元プロンプトのテイストをシステム指示として injecting
 * - スコープは元案のものを使用（空なら現在の設定を維持）
 * - ムードは元案ベースで 1 個差し替え（マンネリ防止）
 * - 詳細は auto（案ごとに散らせる）
 * - faceLock / ngList / safety / count は現在の設定を引き継ぐ
 */
export function buildArrangeInputs(
  current: PromptInputs,
  sourceItem: PromptHistoryItem
): PromptInputs {
  const scopes: Scope[] =
    sourceItem.scopes.length > 0 ? sourceItem.scopes : current.scopes;

  // Start from source moods, swap 1 out for variety
  const moods: Mood[] = [...(sourceItem.moods.length > 0 ? sourceItem.moods : current.moods)];
  const others = ALL_MOODS.filter((m) => !moods.includes(m));
  if (moods.length > 0 && others.length > 0) {
    const dropIdx = Math.floor(Math.random() * moods.length);
    moods.splice(dropIdx, 1);
    moods.push(others[Math.floor(Math.random() * others.length)]);
  }
  if (moods.length === 0 && ALL_MOODS.length > 0) {
    moods.push(ALL_MOODS[Math.floor(Math.random() * ALL_MOODS.length)]);
  }

  // Inject source prompt as "reference" in extra instructions (truncated to keep prompt concise)
  const preview = sourceItem.promptText.slice(0, 450).trimEnd();
  const arrangeNote = [
    "【アレンジ指示】以下の参照プロンプトの世界観・雰囲気・テイストを継承しながら、",
    "衣装・背景・小物・ライティング・ポーズ・カメラなどの要素を少し変えた新しい案を作る。",
    "参照プロンプトをそのままコピーしてはいけない。必ず独自の差異を出すこと。",
    "──参照プロンプト（冒頭）──",
    preview + (sourceItem.promptText.length > 450 ? "…" : ""),
    "──────────────────",
  ].join("\n");

  // 既存の【アレンジ指示】ブロックを除去してから追記（複数回アレンジで無限に増えないように）
  const prevStripped = current.extraInstructions
    .replace(/\n*【アレンジ指示】[\s\S]*$/, "")
    .trim();
  const extra = prevStripped ? `${prevStripped}\n\n${arrangeNote}` : arrangeNote;

  return {
    ...current,
    scopes,
    moods,
    details: DEFAULT_DETAILS,
    extraInstructions: extra,
    viralMode: false,
    autoMoodCategories: [],
  };
}



// ─── ファッションプリセット ────────────────────────────────────────────────────
// 設定のみ適用（自動生成はしない）。ユーザーが内容を確認してから手動で生成できる。

// ─── Y2K カルチャー方向定義 ──────────────────────────────────────────────────
// Y2K = 2000年代カルチャー全般（ピンクギャル固定ではない）

interface Y2KDirection {
  label:             string;
  moods:             Mood[];
  outfitStyle:       OutfitStyle;
  outfitColor:       OutfitColor;
  outfitMaterial:    OutfitMaterial;
  outfitSilhouette:  OutfitSilhouette;
  outfitDecoration:  OutfitDecoration;
  outfitLuxury:      OutfitLuxury;
  bgPlace:           BackgroundPlace;
  hairStyle:         HairStyle;
  propsVibe:         "sns" | "cool" | "cute" | "luxury" | "retro" | "elegant";
}

const Y2K_DIRECTIONS: Y2KDirection[] = [
  // ── 海外セレブ ──────────────────────────────────────────────────────────────
  {
    label:            "海外セレブY2K",
    moods:            ["luxe", "vivid", "sns_pop"] as Mood[],
    outfitStyle:      "runway",
    outfitColor:      "gradient",
    outfitMaterial:   "pvc",
    outfitSilhouette: "ornate",
    outfitDecoration: "elaborate",
    outfitLuxury:     "couture",
    bgPlace:          "rooftop",
    hairStyle:        "viral",
    propsVibe:        "luxury",
  },
  // ── クラブ・ナイト ───────────────────────────────────────────────────────────
  {
    label:            "クラブ・ナイトY2K",
    moods:            ["dark", "vivid", "street"] as Mood[],
    outfitStyle:      "cyber",
    outfitColor:      "black",
    outfitMaterial:   "leather",
    outfitSilhouette: "tight",
    outfitDecoration: "chain_decor",
    outfitLuxury:     "refined",
    bgPlace:          "night_amusement",
    hairStyle:        "y2k",
    propsVibe:        "cool",
  },
  // ── MTVポップスター ──────────────────────────────────────────────────────────
  {
    label:            "MTVポップスターY2K",
    moods:            ["sns_pop", "pop", "bright"] as Mood[],
    outfitStyle:      "idol",
    outfitColor:      "gradient",
    outfitMaterial:   "pvc",
    outfitSilhouette: "short_length",
    outfitDecoration: "rhinestone",
    outfitLuxury:     "casual",
    bgPlace:          "studio",
    hairStyle:        "y2k",
    propsVibe:        "sns",
  },
  // ── スポーティ・アスレジャー ──────────────────────────────────────────────────
  {
    label:            "スポーティ・アスレジャーY2K",
    moods:            ["bright", "cool", "street"] as Mood[],
    outfitStyle:      "techwear",
    outfitColor:      "white",
    outfitMaterial:   "nylon",
    outfitSilhouette: "oversized",
    outfitDecoration: "minimal",
    outfitLuxury:     "casual",
    bgPlace:          "rooftop",
    hairStyle:        "modern",
    propsVibe:        "cool",
  },
  // ── デニム ─────────────────────────────────────────────────────────────────
  {
    label:            "デニムY2K",
    moods:            ["cool", "street", "retro"] as Mood[],
    outfitStyle:      "street",
    outfitColor:      "light_blue",
    outfitMaterial:   "denim",
    outfitSilhouette: "oversized",
    outfitDecoration: "moderate",
    outfitLuxury:     "casual",
    bgPlace:          "alley",
    hairStyle:        "street",
    propsVibe:        "cool",
  },
  // ── ラグジュアリー ───────────────────────────────────────────────────────────
  {
    label:            "ラグジュアリーY2K",
    moods:            ["luxe", "cinematic", "stylish"] as Mood[],
    outfitStyle:      "mode",
    outfitColor:      "gold",
    outfitMaterial:   "velvet",
    outfitSilhouette: "ornate",
    outfitDecoration: "elaborate",
    outfitLuxury:     "couture",
    bgPlace:          "atelier",
    hairStyle:        "viral",
    propsVibe:        "luxury",
  },
  // ── サイバー・テック ─────────────────────────────────────────────────────────
  {
    label:            "サイバー・テックY2K",
    moods:            ["near_future", "cool", "digital"] as Mood[],
    outfitStyle:      "y2k",
    outfitColor:      "silver",
    outfitMaterial:   "metal",
    outfitSilhouette: "minimal",
    outfitDecoration: "minimal",
    outfitLuxury:     "refined",
    bgPlace:          "futuristic",
    hairStyle:        "cyberpunk",
    propsVibe:        "cool",
  },
  // ── グランジ・ダーク ─────────────────────────────────────────────────────────
  {
    label:            "グランジ・ダークY2K",
    moods:            ["dark", "monochrome", "emo"] as Mood[],
    outfitStyle:      "street",
    outfitColor:      "black",
    outfitMaterial:   "leather",
    outfitSilhouette: "layered",
    outfitDecoration: "chain_decor",
    outfitLuxury:     "casual",
    bgPlace:          "industrial",
    hairStyle:        "street",
    propsVibe:        "cool",
  },
  // ── モード ─────────────────────────────────────────────────────────────────
  {
    label:            "モードY2K",
    moods:            ["art", "minimal", "monochrome"] as Mood[],
    outfitStyle:      "mode",
    outfitColor:      "white",
    outfitMaterial:   "cloth",
    outfitSilhouette: "minimal",
    outfitDecoration: "minimal",
    outfitLuxury:     "refined",
    bgPlace:          "gallery",
    hairStyle:        "modern",
    propsVibe:        "elegant",
  },
  // ── フェミニン ──────────────────────────────────────────────────────────────
  {
    label:            "フェミニンY2K",
    moods:            ["cute", "pastel", "instagram"] as Mood[],
    outfitStyle:      "dress",
    outfitColor:      "pink",
    outfitMaterial:   "chiffon",
    outfitSilhouette: "flare",
    outfitDecoration: "frill",
    outfitLuxury:     "refined",
    bgPlace:          "frosted_room",
    hairStyle:        "y2k",
    propsVibe:        "cute",
  },
  // ── 広告・クリーン ───────────────────────────────────────────────────────────
  {
    label:            "広告・クリーンY2K",
    moods:            ["clean", "ad_visual", "magazine_cover"] as Mood[],
    outfitStyle:      "runway",
    outfitColor:      "white",
    outfitMaterial:   "nylon",
    outfitSilhouette: "minimal",
    outfitDecoration: "minimal",
    outfitLuxury:     "refined",
    bgPlace:          "studio",
    hairStyle:        "modern",
    propsVibe:        "elegant",
  },
  // ── 渋谷系・カラフル ─────────────────────────────────────────────────────────
  {
    label:            "渋谷系・カラフルY2K",
    moods:            ["pop", "vivid", "sns_pop"] as Mood[],
    outfitStyle:      "y2k",
    outfitColor:      "gradient",
    outfitMaterial:   "pvc",
    outfitSilhouette: "layered",
    outfitDecoration: "elaborate",
    outfitLuxury:     "casual",
    bgPlace:          "night_amusement",
    hairStyle:        "y2k",
    propsVibe:        "sns",
  },
  // ── レトロポップ ────────────────────────────────────────────────────────────
  {
    label:            "レトロポップY2K",
    moods:            ["retro", "pop", "bright"] as Mood[],
    outfitStyle:      "y2k",
    outfitColor:      "red",
    outfitMaterial:   "pvc",
    outfitSilhouette: "short_length",
    outfitDecoration: "rhinestone",
    outfitLuxury:     "casual",
    bgPlace:          "old_cinema",
    hairStyle:        "retro",
    propsVibe:        "retro",
  },
  // ── クロームシルバー ─────────────────────────────────────────────────────────
  {
    label:            "クロームシルバーY2K",
    moods:            ["cool", "stylish", "cinematic"] as Mood[],
    outfitStyle:      "y2k",
    outfitColor:      "silver",
    outfitMaterial:   "enamel",
    outfitSilhouette: "tight",
    outfitDecoration: "moderate",
    outfitLuxury:     "refined",
    bgPlace:          "empty_space",
    hairStyle:        "viral",
    propsVibe:        "cool",
  },
  // ── 欧米ポップス ────────────────────────────────────────────────────────────
  {
    label:            "欧米ポップスY2K",
    moods:            ["bright", "pop", "portrait"] as Mood[],
    outfitStyle:      "idol",
    outfitColor:      "purple",
    outfitMaterial:   "pvc",
    outfitSilhouette: "a_line",
    outfitDecoration: "rhinestone",
    outfitLuxury:     "casual",
    bgPlace:          "indoor",
    hairStyle:        "y2k",
    propsVibe:        "sns",
  },
  // ── パープル・ミレニアム ─────────────────────────────────────────────────────
  {
    label:            "ミレニアム・パープルY2K",
    moods:            ["mystic", "dark", "vivid"] as Mood[],
    outfitStyle:      "y2k",
    outfitColor:      "purple",
    outfitMaterial:   "velvet",
    outfitSilhouette: "ornate",
    outfitDecoration: "elaborate",
    outfitLuxury:     "luxe",
    bgPlace:          "museum",
    hairStyle:        "y2k",
    propsVibe:        "elegant",
  },
  // ── ライムグリーン・ストリート ────────────────────────────────────────────────
  {
    label:            "ライムグリーン・ストリートY2K",
    moods:            ["vivid", "street", "bright"] as Mood[],
    outfitStyle:      "street",
    outfitColor:      "green",
    outfitMaterial:   "nylon",
    outfitSilhouette: "oversized",
    outfitDecoration: "moderate",
    outfitLuxury:     "casual",
    bgPlace:          "alley",
    hairStyle:        "street",
    propsVibe:        "sns",
  },
];

/**
 * 👗 Y2K：2000年代カルチャー全般。
 * ピンクギャル固定ではなく、17種の方向から毎回異なるスタイルを選ぶ。
 * 直近の背景・ムードを避けて連発を防止する。
 */
export function buildY2kInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  // 直近の背景・ムードが被らない方向を優先して選択
  const available = Y2K_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : Y2K_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];
  const moods = dir.moods;

  const y2kNote = [
    `【👗 Y2Kモード — ${dir.label}】`,
    "Y2K = 2000年代カルチャー全般。ピンクギャル・原宿ポップに固定しない。",
    "",
    "▼ Y2Kカルチャーの多様性（案ごとに差別化）：",
    "  海外セレブ / クラブ / MTV / スポーティ / デニム / ラグジュアリー",
    "  サイバー / グランジ / モード / フェミニン / 広告 / 渋谷系",
    "  レトロポップ / クロームシルバー / 欧米ポップス / ライムグリーン",
    "",
    "▼ 小物候補（ハート・キラキラ杖以外から選ぶ）：",
    "  MP3プレイヤー / ヘッドフォン / ミニバッグ / チェーンアクセ",
    "  ベルトアクセ / 折りたたみデバイス / ゲーム風小物 / 雑誌",
    "",
    "▼ 量産テンプレ禁止：",
    "  × ピンク固定 / ハート固定 / キラキラ杖固定 / ローライズ固定",
    "  × ギャル固定 / 平成雑誌だけ / 同じメタリック衣装連発",
    "  各案で色・衣装シルエット・小物・背景を完全に差別化すること。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.y2k, moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  y2kNote,
    details: {
      ...current.details,
      hair: {
        ...current.details.hair,
        hairStyle: dir.hairStyle,
      },
      outfit: {
        style:      dir.outfitStyle,
        color:      dir.outfitColor,
        silhouette: dir.outfitSilhouette,
        decoration: dir.outfitDecoration,
        luxury:     dir.outfitLuxury,
        exposure:   current.details.outfit.exposure,
        material:   dir.outfitMaterial,
        season:     "skip",
      },
      props: {
        ...DEFAULT_DETAILS.props,
        category: "fashion",
        vibe:     dir.propsVibe,
      },
    },
  };
}

// ─── Y3K pools ───────────────────────────────────────────────────────────────
// Y3K = 未来のファッションカルチャー全般（青SF固定しない）

/** 世界観をセットするコアムード（必ず1〜2個含める） */
const Y3K_MOOD_CORE: Mood[] = [
  "near_future", "luxe", "stylish", "cinematic",
  "contemporary", "urban_fantasy", "retro_future", "architectural",
  "ad_visual", "magazine_cover",
];
/** サブ雰囲気ムード（コアと組み合わせる） */
const Y3K_MOOD_SUB: Mood[] = [
  "cool", "vivid", "pastel", "pop", "bright", "dark",
  "monochrome", "art", "minimal", "translucent", "clean",
  "movie_poster", "trend_2026", "scroll_stop",
];
const Y3K_OUTFIT_STYLES: OutfitStyle[] = [
  "future_dress", "techwear", "runway", "mode", "cyber",
];
const Y3K_OUTFIT_COLORS: OutfitColor[] = [
  "silver", "white", "black", "gold", "gradient",
  "pink", "purple", "red", "green", "light_blue", "accent_color",
];
const Y3K_OUTFIT_MATERIALS: OutfitMaterial[] = [
  "transparent", "pvc", "metal", "nylon", "leather", "enamel", "velvet",
];
const Y3K_GLOW_COLORS: CyberGlowColor[] = [
  "cyan", "purple", "pink", "white", "gold", "green", "rainbow", "blue",
];
const Y3K_LIGHT_TEMPS: LightTemperature[] = [
  "cool", "neutral", "warm", "mixed", "sunset", "white_light", "blue_tone",
];
const Y3K_LIGHT_INTENSITIES: LightIntensity[] = [
  "dramatic", "soft", "strong", "normal",
];
const Y3K_HAIR_STYLES: HairStyle[] = [
  "near_future", "cyberpunk", "modern", "unique", "viral", "korean",
];

/**
 * 🚀 Y3K：未来のファッションカルチャー全般。
 * 「青いネオンSF」「透明クリスタルドレス」「HUDパネル」に固定しない。
 * 毎回異なるスタイル・色・背景・演出を選ぶ。
 */
export function buildY3kInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  // ── ムード：コア1〜2 + サブ1〜2（直近を避ける）
  const corePick = pickNAvoidingRecent(Y3K_MOOD_CORE, memory.recentMoods, 1 + Math.floor(Math.random() * 2));
  const subPick  = pickNAvoidingRecent(
    Y3K_MOOD_SUB.filter((m) => !corePick.includes(m)),
    memory.recentMoods,
    1 + Math.floor(Math.random() * 2),
  );
  const moods: Mood[] = [...corePick, ...subPick].slice(0, 3 + Math.floor(Math.random() * 2));

  // ── 衣装（直近スタイルを避ける）
  const outfitStyle    = pickAvoidingRecent(Y3K_OUTFIT_STYLES,    memory.recentOutfits);
  const outfitColor    = Y3K_OUTFIT_COLORS[Math.floor(Math.random() * Y3K_OUTFIT_COLORS.length)];
  const outfitMaterial = Y3K_OUTFIT_MATERIALS[Math.floor(Math.random() * Y3K_OUTFIT_MATERIALS.length)];

  // ── サイバー発光色（青連発を避ける）
  const glowColor    = pickAvoidingRecent(Y3K_GLOW_COLORS,        memory.recentMoods) as CyberGlowColor;
  // ── ライティング
  const lightTemp    = pickAvoidingRecent(Y3K_LIGHT_TEMPS,        memory.recentMoods) as LightTemperature;
  const lightInt     = Y3K_LIGHT_INTENSITIES[Math.floor(Math.random() * Y3K_LIGHT_INTENSITIES.length)];
  // ── ヘアスタイル
  const hairStyle    = Y3K_HAIR_STYLES[Math.floor(Math.random() * Y3K_HAIR_STYLES.length)] as HairStyle;

  // ── 小物カテゴリ：futuristic / fashion / art を均等に
  const propCats: PropsCategory[] = ["futuristic", "fashion"];
  const propCat = propCats[Math.floor(Math.random() * propCats.length)];

  const y3kNote = [
    "【🚀 Y3Kモード — 未来のファッションカルチャー全般】",
    "Y3K = 未来のファッション文化・カルチャー全体。「青いネオンSF」に固定しない。",
    "",
    "▼ 積極的に使う方向性（案ごとに差別化）：",
    "  ラグジュアリー未来 / ポップ未来 / カラフル未来 / AI広告未来 / 都市未来",
    "  バイオ未来 / ソフトミニマル未来 / 工業未来 / 宇宙ホテル / 未来ランウェイ",
    "  近未来ギャラリー / 未来クラブ / 高級ブランド未来 / 近未来ストリート",
    "",
    "▼ 小物（HUDパネル・透明オーブ・ホログラムUI以外から選ぶ）：",
    "  近未来バッグ / 発光アクセサリー / 奇抜なサングラス / 未来イヤーカフ",
    "  透明ドリンク / 近未来ヘッドフォン / 抽象オブジェ / 発光彫刻 / AR演出ツール",
    "",
    "▼ 量産テンプレ禁止：",
    "  × 青ネオン固定 / 透明クリスタルドレス連発 / HUDパネル手持ち連発",
    "  × SF通路固定 / 電脳都市の雨 / 青い発光ボディスーツ / ホログラムUI連発",
    "  各案で背景・色彩・小物・衣装シルエットを完全に差別化すること。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.y3k, moods, memory.lastScopes),
    moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  y3kNote,
    details: {
      ...current.details,
      hair: {
        ...current.details.hair,
        hairStyle,
      },
      outfit: {
        style:      outfitStyle,
        color:      outfitColor,
        silhouette: "auto",
        decoration: current.details.outfit.decoration,
        luxury:     "future_luxe",
        exposure:   current.details.outfit.exposure,
        material:   outfitMaterial,
        season:     "skip",
      },
      props: {
        ...DEFAULT_DETAILS.props,
        category: propCat,
        glow:     "edge_glow",
        vibe:     "cool",
      },
      cyber: {
        part:      "auto",
        type:      "auto",
        texture:   "transparent_glass",
        glowColor,
        intensity: "subtle",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   lightInt,
        atmosphere:  "hazy",
        temperature: lightTemp,
      },
    },
  };
}

// ─── Street pools ────────────────────────────────────────────────────────────
//
// 【設計方針】ストリート = ファッション誌・モデルスナップが基本。
//   80% ブライト方向：カラフル・明るめ・SNS映え・アーバンカジュアル
//   20% ダーク方向：アーバングランジ・ゴシックストリート（サイバーパンク固定は避ける）

/** 80%使用 — ファッション誌・明るめアーバン */
const STREET_BRIGHT_MOODS: Mood[] = [
  "cool", "street", "stylish", "cinematic", "contemporary",
  "clean", "sns_pop", "portrait", "instagram", "magazine_cover",
  "ad_visual", "bright", "art", "vivid",
];
const STREET_BRIGHT_COLORS: OutfitColor[] = [
  "white", "inherit", "gradient", "accent_color", "light_blue",
  "red", "green", "purple", "pink", "gold",
];
const STREET_BRIGHT_MATERIALS: OutfitMaterial[] = [
  "denim", "nylon", "cloth", "chiffon", "knit",
];

/** 20%使用 — アーバングランジ・ゴシックストリート（サイバーパンク固定は避ける） */
const STREET_DARK_MOODS: Mood[] = [
  "dark", "cinematic", "monochrome", "street", "cool", "art", "contemporary",
];
const STREET_DARK_COLORS: OutfitColor[] = ["black", "silver", "inherit"];
const STREET_DARK_MATERIALS: OutfitMaterial[] = ["denim", "leather", "nylon"];

/**
 * 🏙️ ストリート：ファッション誌・モデルスナップ・アーバンカジュアルが基本。
 * 80%はカラフル・明るめ方向。20%のみダーク方向（サイバーパンク固定は避ける）。
 * 毎回異なる色・背景・素材を選んで量産パターンを避ける。
 */
export function buildStreetInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  // 20%でダーク方向、80%でファッション誌・明るめ方向
  const isDark = Math.random() < 0.20;

  const moodPool   = isDark ? STREET_DARK_MOODS     : STREET_BRIGHT_MOODS;
  const colorPool  = isDark ? STREET_DARK_COLORS    : STREET_BRIGHT_COLORS;
  const matPool    = isDark ? STREET_DARK_MATERIALS : STREET_BRIGHT_MATERIALS;

  const moods       = pickNAvoidingRecent(moodPool, memory.recentMoods, 3) as Mood[];
  const outfitColor = colorPool[Math.floor(Math.random() * colorPool.length)] as OutfitColor;
  const outfitMat   = matPool[Math.floor(Math.random() * matPool.length)] as OutfitMaterial;

  const streetNote = isDark
    ? [
        "ストリートファッション：ダーク・アーバングランジ方向。",
        "▷ サイバーパンク電脳街・青紫ネオン路地には固定しない。アーバングランジ・ゴシックストリート・重厚なモードストリート等の方向で差別化。",
        "▷ 背景はネオン街一択にせず、アーバングランジ・重厚な空気感で雰囲気を変える。",
      ].join("\n")
    : [
        "ストリートファッション：ファッション誌・モデルスナップ・アーバンカジュアルが基本。",
        "▷ サイバーパンク・黒基調・ネオン電脳街は使わない。",
        "▷ 衣装は明るめの色・カラフルな差し色・ポップなデザインを優先。",
        "▷ 背景は都市の自然光・クリーンな空間など明るい雰囲気を使う。",
        "▷ 雰囲気はクール・スタイリッシュ・SNS映え・ファッション誌的に。",
      ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.street, moods, memory.lastScopes),
    moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  streetNote,
    details: {
      ...current.details,
      hair: {
        ...current.details.hair,
        hairStyle: "street",
      },
      outfit: {
        style:      "street",
        color:      outfitColor,
        silhouette: "oversized",
        decoration: "minimal",
        luxury:     "casual",
        exposure:   current.details.outfit.exposure,
        material:   outfitMat,
        season:     "skip",
      },
      props: {
        ...DEFAULT_DETAILS.props,
        category: "fashion",
        vibe:     "cool",
      },
    },
  };
}

// ─── 多様性ツール ─────────────────────────────────────────────────────────────────
// 各ビルダーはランダムプール + VariationMemory で毎回異なる組み合わせを選ぶ。
// いずれも設定のみ適用（自動生成なし）。



// ── 🎬 映画化 ──────────────────────────────────────────────────────────────────

const CINEMA_GENRES: Array<{
  name:    string;
  moods:   Mood[];
  bgPlace: BackgroundPlace;
}> = [
  { name: "SFスリラー",       moods: ["near_future", "cinematic", "dark"],          bgPlace: "futuristic"    },
  { name: "ノワール",          moods: ["dark", "cinematic", "monochrome"],           bgPlace: "rooftop"       },
  { name: "恋愛映画",          moods: ["cinematic", "emo", "portrait"],              bgPlace: "frosted_room"  },
  { name: "青春映画",          moods: ["bright", "cinematic", "emo"],               bgPlace: "rooftop"       },
  { name: "アート映画",        moods: ["art", "cinematic", "monochrome", "minimal"], bgPlace: "gallery"       },
  { name: "レトロ映画",        moods: ["retro", "cinematic", "noisy"],              bgPlace: "old_cinema"    },
  { name: "ファンタジー映画",  moods: ["fantasy_world", "cinematic", "mystic"],      bgPlace: "greenhouse"    },
  { name: "ファッション映画",  moods: ["luxe", "cinematic", "art"],                  bgPlace: "atelier"       },
];

/**
 * 🎬 映画化：映画ポスター風。毎回ジャンルを変化させる。
 */
export function buildCinematicInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = CINEMA_GENRES.filter((g) => !memory.recentBgPlaces.includes(g.bgPlace));
  const pool  = available.length > 0 ? available : CINEMA_GENRES;
  const genre = pool[Math.floor(Math.random() * pool.length)];

  const note = [
    `【🎬 映画化 — ${genre.name}】`,
    "映画スチル・映画ポスター風の一枚絵として構成する。",
    "▼ 強化項目：",
    "  - シネマ構図：余白・被写体配置を映画的に設計",
    "  - ドラマ照明：強い明暗コントラスト・色温度で「ジャンルの空気感」を演出",
    "  - 物語性：この一枚だけで「何かが起きている」と感じさせる",
    `  - ジャンル：${genre.name}の映画的表現を意識する`,
    "各案で同じジャンル内でも「シーン・角度・衣装・光の演出」を明確に差別化する。",
  ].join("\n");

  const moods  = [...genre.moods];

  return {
    ...current,
    scopes: pickWorldScopes(PW.cinema, moods, memory.lastScopes),
    moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  note,
    details: {
      ...current.details,
      camera:     { ...current.details.camera, composition: "rule_of_thirds", lens: "cinema" },
      lighting:   { ...current.details.lighting, intensity: "dramatic" },
    },
  };
}




// ─── ワールドプリセット型 ────────────────────────────────────────────────────────
export type WorldPreset =
  | "y2k" | "y3k" | "street"
  | "cinema" | "wafuu" | "gothic"
  | "ad" | "fantasy" | "retro"
  | "jirai" | "seikimatsu";


// ─── 🌸 和風 ──────────────────────────────────────────────────────────────────

interface WaFuuDirection {
  label:          string;
  moods:          Mood[];
  outfitStyle:    OutfitStyle;
  outfitColor:    OutfitColor;
  outfitMaterial: OutfitMaterial;
  bgPlace:        BackgroundPlace;
  extraHint:      string;
}

const WAFUU_DIRECTIONS: WaFuuDirection[] = [
  {
    label:          "雅な和",
    moods:          ["japanese", "mystic", "cinematic"] as Mood[],
    outfitStyle:    "wa_modern",
    outfitColor:    "inherit",
    outfitMaterial: "chiffon",
    bgPlace:        "japanese_room",
    extraHint:      "朱色を効かせた和の意匠・凛とした厳かな空気感",
  },
  {
    label:          "桜夜桜",
    moods:          ["japanese", "translucent", "cinematic"] as Mood[],
    outfitStyle:    "wa_modern",
    outfitColor:    "pink",
    outfitMaterial: "organza",
    bgPlace:        "garden",
    extraHint:      "舞い散る花びら・幻想的な夜空・柔らかい桃色の光・夜桜のしっとりした空気感",
  },
  {
    label:          "幽玄の霧",
    moods:          ["japanese", "mystic", "art"] as Mood[],
    outfitStyle:    "wa_modern",
    outfitColor:    "inherit",
    outfitMaterial: "chiffon",
    bgPlace:        "forest",
    extraHint:      "白い霧・薄い朝日・静謐で幻想的な空気感・水墨画的な奥行き",
  },
  {
    label:          "和モダン",
    moods:          ["japanese", "cool", "contemporary"] as Mood[],
    outfitStyle:    "wa_modern",
    outfitColor:    "black",
    outfitMaterial: "cloth",
    bgPlace:        "indoor",
    extraHint:      "和のテクスチャ・モダンジャパンの質感・都会的な洗練さ",
  },
  {
    label:          "和ゴシック",
    moods:          ["japanese", "gothic", "dark"] as Mood[],
    outfitStyle:    "gothic",
    outfitColor:    "black",
    outfitMaterial: "velvet",
    bgPlace:        "library",
    extraHint:      "和×ゴシックの融合・薄暗い陰影・闇と美の調和",
  },
  {
    label:          "秋紅葉",
    moods:          ["japanese", "cinematic", "art"] as Mood[],
    outfitStyle:    "wa_modern",
    outfitColor:    "gold",
    outfitMaterial: "velvet",
    bgPlace:        "garden",
    extraHint:      "紅葉・落ち葉・斜陽・赤と金の色彩・しっとりとした秋の空気・季節の終わり",
  },
  {
    label:          "和ファンタジー",
    moods:          ["wa_fantasy", "mystic", "fantasy"] as Mood[],
    outfitStyle:    "wa_modern",
    outfitColor:    "inherit",
    outfitMaterial: "organza",
    bgPlace:        "abstract",
    extraHint:      "幻想的な和の世界・月明かり・神隠し的な空気感・夢と現の境界",
  },
];

/**
 * 🌸 和風：和のテイストを軸にした多彩な世界観。
 * 7つの方向から毎回異なる和風スタイルを選ぶ。
 */
export function buildWaFuuInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = WAFUU_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : WAFUU_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];

  const wafuuNote = [
    `【🌸 和風プリセット — ${dir.label}】`,
    dir.extraHint,
    "",
    "▼ 和風プリセットの基本方針：",
    "  - 単純な「着物+神社固定」にしない。京都・桜・竹林・和モダン・和ゴシック・紅葉・和ファンタジー等で差別化する",
    "  - 衣装は和の要素を持ちながらも現代的なシルエット・素材感を取り入れる",
    "  - 各案で背景・色彩・時間帯・演出を明確に差別化する",
    "",
    "▼ 量産和風テンプレ禁止：",
    "  × 白着物+桜連発 / 狐面+神社固定 / 和傘+紅葉だけ / 単調な和テンプレ",
    "  各案で和の素材・空間・光の演出を変える。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.wafuu, dir.moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  wafuuNote,
    details: {
      ...current.details,
      outfit: {
        style:      dir.outfitStyle,
        color:      dir.outfitColor,
        silhouette: "auto",
        decoration: current.details.outfit.decoration,
        luxury:     "refined",
        exposure:   current.details.outfit.exposure,
        material:   dir.outfitMaterial,
        season:     "skip",
      },
      props: {
        ...DEFAULT_DETAILS.props,
        category: "japanese",
        vibe:     "elegant",
      },
    },
  };
}

// ─── 🖤 ゴシック ──────────────────────────────────────────────────────────────

interface GothicDirection {
  label:          string;
  moods:          Mood[];
  outfitStyle:    OutfitStyle;
  outfitColor:    OutfitColor;
  outfitMaterial: OutfitMaterial;
  bgPlace:        BackgroundPlace;
  extraHint:      string;
}

const GOTHIC_DIRECTIONS: GothicDirection[] = [
  {
    label:          "重厚ゴシック",
    moods:          ["gothic", "dark", "art"] as Mood[],
    outfitStyle:    "gothic",
    outfitColor:    "black",
    outfitMaterial: "velvet",
    bgPlace:        "library",
    extraHint:      "重厚な陰影・燭光のような揺れる光・深い影・知識と闇の荘厳さ",
  },
  {
    label:          "退廃ゴシック",
    moods:          ["gothic", "cinematic", "dark"] as Mood[],
    outfitStyle:    "gothic",
    outfitColor:    "black",
    outfitMaterial: "lace",
    bgPlace:        "industrial",
    extraHint:      "朽ちた美・薄暗い光・陰影の強い退廃的な空気感",
  },
  {
    label:          "古典ゴシック",
    moods:          ["gothic", "art", "decadent"] as Mood[],
    outfitStyle:    "gothic",
    outfitColor:    "purple",
    outfitMaterial: "velvet",
    bgPlace:        "museum",
    extraHint:      "古典絵画のような重厚さ・静寂・退廃的な美の余韻",
  },
  {
    label:          "夜想ゴシック",
    moods:          ["gothic", "dark", "vivid"] as Mood[],
    outfitStyle:    "gothic",
    outfitColor:    "black",
    outfitMaterial: "pvc",
    bgPlace:        "night_amusement",
    extraHint:      "夜の闇・残光のような淡い光・朽ちた美と現代の対比",
  },
  {
    label:          "ゴシックモード",
    moods:          ["gothic", "art", "luxe"] as Mood[],
    outfitStyle:    "gothic",
    outfitColor:    "black",
    outfitMaterial: "leather",
    bgPlace:        "gallery",
    extraHint:      "ハイファッション×ゴシック・モード的解釈・洗練されたダークシルエット",
  },
];

/**
 * 🖤 ゴシック：ダーク・退廃美・建築的ゴシックの多彩な世界観。
 * 5つの方向から毎回異なるスタイルを選ぶ。
 */
export function buildGothicInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = GOTHIC_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : GOTHIC_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];

  const gothicNote = [
    `【🖤 ゴシックプリセット — ${dir.label}】`,
    dir.extraHint,
    "",
    "▼ ゴシックプリセットの基本方針：",
    "  - 量産ゴシックドレス（黒コルセット+フリル+蝶）に固定しない",
    "  - ゴシック建築・退廃美・ダーク高級感・モード的ゴシックで差別化する",
    "  - 各案でシルエット・素材・光の演出・背景の細部を変える",
    "",
    "▼ 量産ゴシックテンプレ禁止：",
    "  × 黒コルセット+ペチコートフリル連発 / 量産バラ+蝶+蜘蛛の巣 / 同じ廃墟連発",
    "  ゴシック美は「空間・光・シルエット・素材」で表現する。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.gothic, dir.moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  gothicNote,
    details: {
      ...current.details,
      outfit: {
        style:      dir.outfitStyle,
        color:      dir.outfitColor,
        silhouette: "auto",
        decoration: current.details.outfit.decoration,
        luxury:     "refined",
        exposure:   current.details.outfit.exposure,
        material:   dir.outfitMaterial,
        season:     "skip",
      },
      props: {
        ...DEFAULT_DETAILS.props,
        category: "gothic",
        vibe:     "dark",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   "dramatic",
        atmosphere:  "hazy",
        temperature: "cool",
      },
    },
  };
}

// ─── 📢 広告ビジュアル ──────────────────────────────────────────────────────────

interface AdVisualDirection {
  label:          string;
  moods:          Mood[];
  outfitStyle:    OutfitStyle;
  outfitColor:    OutfitColor;
  outfitMaterial: OutfitMaterial;
  bgPlace:        BackgroundPlace;
  extraHint:      string;
}

const AD_VISUAL_DIRECTIONS: AdVisualDirection[] = [
  {
    label:          "ラグジュアリーブランド広告",
    moods:          ["luxe", "ad_visual", "cinematic"] as Mood[],
    outfitStyle:    "runway",
    outfitColor:    "black",
    outfitMaterial: "velvet",
    bgPlace:        "atelier",
    extraHint:      "ハイブランド広告・余白の美・最小限の小物・スポットライトと影の演出",
  },
  {
    label:          "ファッション誌表紙",
    moods:          ["magazine_cover", "stylish", "portrait"] as Mood[],
    outfitStyle:    "mode",
    outfitColor:    "inherit",
    outfitMaterial: "cloth",
    bgPlace:        "studio",
    extraHint:      "ファッション誌表紙・クリーンな背景・印象的な表情・プロのカメラマンが撮ったような構図",
  },
  {
    label:          "高級化粧品広告",
    moods:          ["luxe", "translucent", "clean"] as Mood[],
    outfitStyle:    "dress",
    outfitColor:    "white",
    outfitMaterial: "chiffon",
    bgPlace:        "frosted_room",
    extraHint:      "高級美容ブランド・ガラスの質感・柔らかい光・ミニマルで清潔な世界観",
  },
  {
    label:          "コンセプトショット",
    moods:          ["art", "ad_visual", "cinematic"] as Mood[],
    outfitStyle:    "runway",
    outfitColor:    "gold",
    outfitMaterial: "velvet",
    bgPlace:        "gallery",
    extraHint:      "コンセプチュアルな広告ショット・アートと商業の融合・強いビジュアルインパクト・記憶に残る一枚",
  },
  {
    label:          "スタイリッシュ広告",
    moods:          ["contemporary", "cool", "ad_visual"] as Mood[],
    outfitStyle:    "street",
    outfitColor:    "inherit",
    outfitMaterial: "cloth",
    bgPlace:        "rooftop",
    extraHint:      "都会的なファッション・スタイリッシュな自然光構図・洗練された空気感",
  },
];

/**
 * 📢 広告ビジュアル：ハイエンド広告・ファッション誌・ブランドビジュアルの世界観。
 * 5つの方向から毎回異なるスタイルを選ぶ。
 */
export function buildAdVisualInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = AD_VISUAL_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : AD_VISUAL_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];

  const adNote = [
    `【📢 広告ビジュアルプリセット — ${dir.label}】`,
    dir.extraHint,
    "",
    "▼ 広告ビジュアルの基本方針：",
    "  - ファッション誌・ハイエンドブランド・プロの広告撮影クオリティを意識する",
    "  - 余白・構図・光・衣装のバランスで「プロの仕事」感を表現する",
    "  - 各案で色調・構図・被写体の配置を明確に差別化する",
    "",
    "▼ 量産テンプレ禁止：",
    "  × アマチュア合成感 / 過剰なエフェクト / ごちゃごちゃした背景",
    "  シンプル・クリーン・インパクトを優先する。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.ad, dir.moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  adNote,
    details: {
      ...current.details,
      outfit: {
        style:      dir.outfitStyle,
        color:      dir.outfitColor,
        silhouette: "auto",
        decoration: "minimal",
        luxury:     "luxe",
        exposure:   current.details.outfit.exposure,
        material:   dir.outfitMaterial,
        season:     "skip",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   "dramatic",
        temperature: "white_light",
        atmosphere:  "clear",
      },
    },
  };
}

// ─── ✨ 幻想ファンタジー ──────────────────────────────────────────────────────

interface FantasyDirection {
  label:       string;
  moods:       Mood[];
  outfitStyle: OutfitStyle;
  outfitColor: OutfitColor;
  bgPlace:     BackgroundPlace;
  extraHint:   string;
}

const FANTASY_DIRECTIONS: FantasyDirection[] = [
  {
    label:       "光の幻想",
    moods:       ["fantasy_world", "translucent", "art"] as Mood[],
    outfitStyle: "wa_modern",
    outfitColor: "inherit",
    bgPlace:     "forest",
    extraHint:   "光が差し込む神秘的な空間・浮遊する光の粒・薄霧・精霊が宿るような静寂",
  },
  {
    label:       "月夜幻想",
    moods:       ["mystic", "fantasy", "cinematic"] as Mood[],
    outfitStyle: "mode",
    outfitColor: "silver",
    bgPlace:     "abstract",
    extraHint:   "月明かりの幻想空間・満月・浮遊する花びら・銀の光・夢のような空気感",
  },
  {
    label:       "花の嵐",
    moods:       ["fantasy", "vivid", "art"] as Mood[],
    outfitStyle: "runway",
    outfitColor: "gradient",
    bgPlace:     "garden",
    extraHint:   "花びらの嵐・色とりどりの花が舞う・光と色彩の洪水・幻想的な空気感",
  },
  {
    label:       "魔導の幻想",
    moods:       ["mystic", "fantasy_world", "dark"] as Mood[],
    outfitStyle: "gothic",
    outfitColor: "purple",
    bgPlace:     "library",
    extraHint:   "本が浮遊する魔法の空間・魔法の光・古い知識の気配・神秘的な照明演出",
  },
  {
    label:       "夢空間",
    moods:       ["fantasy", "pastel", "translucent"] as Mood[],
    outfitStyle: "mode",
    outfitColor: "gradient",
    bgPlace:     "greenhouse",
    extraHint:   "夢の中の空間・パステルの霧・浮遊感・夢幻的な光・現実離れした美しさ・透明感",
  },
];

/**
 * ✨ 幻想ファンタジー：神秘的・夢幻的な幻想世界観。
 * 5つの方向から毎回異なるスタイルを選ぶ。
 * 量産ファンタジードレス（プリンセス/女神/エルフ）は禁止。
 */
export function buildFantasyInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = FANTASY_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : FANTASY_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];

  const fantasyNote = [
    `【✨ 幻想ファンタジープリセット — ${dir.label}】`,
    dir.extraHint,
    "",
    "▼ 幻想ファンタジーの基本方針：",
    "  - 神秘・夢幻・幻想的な美しさを表現する",
    "  - 光・霧・浮遊感・透明感を使って「現実離れした世界」を作る",
    "  - 各案で色彩・光の演出・幻想の方向性を明確に差別化する",
    "",
    "▼ 量産ファンタジーテンプレ厳禁：",
    "  × プリンセスドレス / 女神ドレス / 妖精風 / エルフ女王風",
    "  × クリスタル連発 / フリル量産 / 紫青だけのファンタジー",
    "  幻想は「光・空気感・構図」で表現し、量産衣装で表現しない。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.fantasy, dir.moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  fantasyNote,
    details: {
      ...current.details,
      outfit: {
        style:      dir.outfitStyle,
        color:      dir.outfitColor,
        silhouette: "auto",
        decoration: current.details.outfit.decoration,
        luxury:     "refined",
        exposure:   current.details.outfit.exposure,
        material:   "auto",
        season:     "skip",
      },
      foreground: {
        preset:      "skip",
        effectType:  "light_particle",
        swirlType:   "skip",
        digitalType: "skip",
        artType:     "skip",
        position:    "full_body",
        density:     "normal",
        motion:      "gentle_flow",
        color:       "inherit",
        depth:       "front_back_overlap",
        visibility:  "face_protected",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   "soft",
        atmosphere:  "hazy",
        temperature: "warm",
      },
    },
  };
}

// ─── 📺 レトロ ────────────────────────────────────────────────────────────────

interface RetroDirection {
  label:          string;
  moods:          Mood[];
  outfitStyle:    OutfitStyle;
  outfitColor:    OutfitColor;
  outfitMaterial: OutfitMaterial;
  bgPlace:        BackgroundPlace;
  extraHint:      string;
}

const RETRO_DIRECTIONS: RetroDirection[] = [
  {
    label:          "昭和フィルム",
    moods:          ["retro", "cinematic", "emo"] as Mood[],
    outfitStyle:    "mode",
    outfitColor:    "inherit",
    outfitMaterial: "cloth",
    bgPlace:        "old_cinema",
    extraHint:      "昭和のフィルムグレイン・暖かいノスタルジア・昭和スターの雰囲気",
  },
  {
    label:          "フィルムカメラ風",
    moods:          ["retro", "noisy", "portrait"] as Mood[],
    outfitStyle:    "street",
    outfitColor:    "inherit",
    outfitMaterial: "cloth",
    bgPlace:        "alley",
    extraHint:      "フィルムカメラの粒子感・色褪せ・光漏れ・スナップ写真的な自然な構図",
  },
  {
    label:          "80年代ポップ",
    moods:          ["retro", "pop", "vivid"] as Mood[],
    outfitStyle:    "y2k",
    outfitColor:    "gradient",
    outfitMaterial: "nylon",
    bgPlace:        "studio",
    extraHint:      "1980年代ポップカルチャー・ネオンカラー・大胆なパターン・活気あるエネルギー・MTV感",
  },
  {
    label:          "ヴィンテージレトロ",
    moods:          ["retro", "emo", "art"] as Mood[],
    outfitStyle:    "mode",
    outfitColor:    "inherit",
    outfitMaterial: "cloth",
    bgPlace:        "indoor",
    extraHint:      "ヴィンテージな雰囲気・暖かい光・時代の記憶・静かなノスタルジア",
  },
  {
    label:          "夜のドライブ",
    moods:          ["retro", "cinematic", "dark"] as Mood[],
    outfitStyle:    "street",
    outfitColor:    "black",
    outfitMaterial: "leather",
    bgPlace:        "rooftop",
    extraHint:      "レトロな夜の光・ネオンサインの色・フィルムノワール・深夜の空気感",
  },
];

/**
 * 📺 レトロ：昭和・フィルム・80年代ポップ・ヴィンテージの多彩な世界観。
 * 5つの方向から毎回異なるスタイルを選ぶ。
 */
export function buildRetroInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = RETRO_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : RETRO_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];

  const retroNote = [
    `【📺 レトロプリセット — ${dir.label}】`,
    dir.extraHint,
    "",
    "▼ レトロプリセットの基本方針：",
    "  - 「ノスタルジア・フィルム感・時代の空気」を中心に構成する",
    "  - 昭和・80年代・フィルムカメラ・ヴィンテージカフェ等の方向で差別化する",
    "  - 各案でフィルムグレイン・色温度・背景の時代感を変える",
    "",
    "▼ 量産テンプレ禁止：",
    "  × 単純な「セピア+着物」固定 / アナログ感だけの演出",
    "  時代の空気・色彩・衣装で「どのレトロか」を明確にする。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.retro, dir.moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  retroNote,
    details: {
      ...current.details,
      outfit: {
        style:      dir.outfitStyle,
        color:      dir.outfitColor,
        silhouette: "auto",
        decoration: current.details.outfit.decoration,
        luxury:     "refined",
        exposure:   current.details.outfit.exposure,
        material:   dir.outfitMaterial,
        season:     "skip",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   "dramatic",
        temperature: "warm",
        atmosphere:  "hazy",
      },
    },
  };
}


// ─── 🖤 地雷系 ─────────────────────────────────────────────────────────────────

interface JiraiDirection {
  label:            string;
  moods:            Mood[];
  outfitStyle:      OutfitStyle;
  outfitColor:      OutfitColor;
  outfitMaterial:   OutfitMaterial;
  outfitDecoration: OutfitDecoration;
  hairStyle:        HairStyle;
  bgPlace:          BackgroundPlace;
  extraHint:        string;
}

const JIRAI_DIRECTIONS: JiraiDirection[] = [
  {
    label:          "かわいい×ダーク地雷",
    moods:          ["cute", "dark", "emo"] as Mood[],
    outfitStyle:    "dress",
    outfitColor:    "black",
    outfitMaterial: "chiffon",
    outfitDecoration: "ribbon",
    hairStyle:      "gothic_lolita",
    bgPlace:        "night_amusement",
    extraHint:      "黒×ピンクのベーシック地雷系。リボン・厚底・レイヤードで「かわいい」と「ダーク」を両立。",
  },
  {
    label:          "モード地雷",
    moods:          ["art", "dark", "monochrome"] as Mood[],
    outfitStyle:    "mode",
    outfitColor:    "black",
    outfitMaterial: "cloth",
    outfitDecoration: "moderate",
    hairStyle:      "doll",
    bgPlace:        "gallery",
    extraHint:      "ファッション誌的な地雷感。モード・建築的シルエット・白黒コントラストにピンクのアクセント。",
  },
  {
    label:          "ストリート地雷",
    moods:          ["street", "dark", "emo"] as Mood[],
    outfitStyle:    "street",
    outfitColor:    "black",
    outfitMaterial: "denim",
    outfitDecoration: "chain_decor",
    hairStyle:      "street",
    bgPlace:        "alley",
    extraHint:      "アーバンな空気の中で地雷系を表現。アーバン×病みかわいい。レイヤードグランジ。",
  },
  {
    label:          "広告地雷",
    moods:          ["ad_visual", "dark", "stylish"] as Mood[],
    outfitStyle:    "mode",
    outfitColor:    "white",
    outfitMaterial: "cloth",
    outfitDecoration: "moderate",
    hairStyle:      "viral",
    bgPlace:        "studio",
    extraHint:      "ハイブランド広告風の地雷ビジュアル。クリーンバック×黒白ピンクのシャープなコントラスト。",
  },
  {
    label:          "近未来地雷",
    moods:          ["near_future", "dark", "sns_pop"] as Mood[],
    outfitStyle:    "cyber",
    outfitColor:    "pink",
    outfitMaterial: "pvc",
    outfitDecoration: "chain_decor",
    hairStyle:      "near_future",
    bgPlace:        "futuristic",
    extraHint:      "Y3K×地雷の融合。メタリックピンク・暗い未来空間・テックウェア地雷。",
  },
  {
    label:          "ゴシック地雷",
    moods:          ["gothic", "dark", "decadent"] as Mood[],
    outfitStyle:    "gothic",
    outfitColor:    "black",
    outfitMaterial: "velvet",
    outfitDecoration: "ribbon",
    hairStyle:      "wa_gothic",
    bgPlace:        "old_cinema",
    extraHint:      "ゴシック×地雷の融合。退廃的な空間に厚底・リボン・ダークピンクのアクセント。",
  },
];

/**
 * 🖤 地雷系：かわいい×ダークの「病みかわいい」世界観。
 * 6方向（かわいいダーク・モード・ストリート・広告・近未来・ゴシック）から毎回異なるスタイルを選ぶ。
 * 露出強調・身体強調・病み表現の過激化は一切しない。
 */
export function buildJiraiInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = JIRAI_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : JIRAI_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];

  const jiraiNote = [
    `【🖤 地雷系プリセット — ${dir.label}】`,
    dir.extraHint,
    "",
    "▼ 地雷系の基本方針：",
    "  - 黒×ピンク×白×赤系の配色。リボン・厚底・レイヤード感を軸に",
    "  - 「かわいい × ダーク」の両立。病みかわいい雰囲気。量産型ではなくモード寄りに",
    "  - フリルは控えめ。過度な装飾より「シルエットとカラーリング」で個性を出す",
    "  - SNS映え・都会の夜・インドア感のある空気感を優先",
    "",
    "▼ 量産テンプレ禁止：",
    "  × 毎回ピンク黒リボンだけ / 過度なフリル / 病み表現を過激にする",
    "  × 露出強調・身体的特徴の強調は一切しない",
    "  各案でシルエット・背景・光・小物を完全に差別化すること。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.jirai, dir.moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  jiraiNote,
    details: {
      ...current.details,
      hair: {
        ...current.details.hair,
        hairStyle: dir.hairStyle,
      },
      outfit: {
        style:      dir.outfitStyle,
        color:      dir.outfitColor,
        silhouette: "layered",
        decoration: dir.outfitDecoration,
        luxury:     "refined",
        exposure:   current.details.outfit.exposure,
        material:   dir.outfitMaterial,
        season:     "skip",
      },
      props: {
        ...DEFAULT_DETAILS.props,
        category: "fashion",
        vibe:     "cute",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   "dramatic",
        atmosphere:  "hazy",
        temperature: "cool",
      },
    },
  };
}

// ─── ☠️ 世紀末系 ────────────────────────────────────────────────────────────────

interface SeikimatsuDirection {
  label:       string;
  moods:       Mood[];
  outfitStyle: OutfitStyle;
  bgPlace:     BackgroundPlace;
  lightTemp:   LightTemperature;
  extraHint:   string;
}

const SEIKIMATSU_DIRECTIONS: SeikimatsuDirection[] = [
  {
    label:       "砂塵の終末",
    moods:       ["dark", "cinematic", "decadent"] as Mood[],
    outfitStyle: "street",
    bgPlace:     "industrial",
    lightTemp:   "warm",
    extraHint:   "砂埃の舞う終末的な空気感。錆と砂と風の質感。ロードムービー的な光。",
  },
  {
    label:       "錆びた終末",
    moods:       ["dark", "monochrome", "emo"] as Mood[],
    outfitStyle: "mode",
    bgPlace:     "industrial",
    lightTemp:   "cool",
    extraHint:   "錆びた金属の重厚な質感・冷たい光・孤独な静けさ。",
  },
  {
    label:       "風化の終末",
    moods:       ["dark", "cinematic", "noisy"] as Mood[],
    outfitStyle: "street",
    bgPlace:     "alley",
    lightTemp:   "warm",
    extraHint:   "色あせた文字の質感・剥がれた質感・風化したざらつき・荒廃した空気感。",
  },
  {
    label:       "改造服の終末",
    moods:       ["dark", "contemporary", "cinematic"] as Mood[],
    outfitStyle: "techwear",
    bgPlace:     "nature",
    lightTemp:   "sunset",
    extraHint:   "布と金属パーツを組み合わせた改造服。風に揺れる砂・空の広さ。終末感。",
  },
  {
    label:       "崩落の終末",
    moods:       ["dark", "art", "decadent"] as Mood[],
    outfitStyle: "mode",
    bgPlace:     "museum",
    lightTemp:   "cool",
    extraHint:   "錆と崩落の質感・朽ちた美・孤独な荘厳さ。",
  },
  {
    label:       "静寂の終末",
    moods:       ["dark", "monochrome", "art"] as Mood[],
    outfitStyle: "military",
    bgPlace:     "rooftop",
    lightTemp:   "blue_tone",
    extraHint:   "終末後の静寂・朽ちた質感・かすかな光・誰もいない静けさ。",
  },
];

/**
 * ☠️ 世紀末系：荒廃都市・廃墟・錆びた金属・終末のロードムービー感。
 * 6方向（砂埃都市・廃工場・廃市街・荒野・廃墟巨構造物・廃都市屋上）から毎回異なる方向を選ぶ。
 * 血・暴力・武器強調は一切しない。廃墟の美しさと終末後の静けさで表現する。
 */
export function buildSeikimatsuInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = SEIKIMATSU_DIRECTIONS.filter(
    (d) =>
      !memory.recentBgPlaces.includes(d.bgPlace) &&
      !d.moods.every((m) => memory.recentMoods.includes(m)),
  );
  const pool = available.length > 0 ? available : SEIKIMATSU_DIRECTIONS;
  const dir  = pool[Math.floor(Math.random() * pool.length)];

  const seikimatsuNote = [
    `【☠️ 世紀末系プリセット — ${dir.label}】`,
    dir.extraHint,
    "",
    "▼ 世紀末系の基本方針：",
    "  - 荒廃都市・廃墟・錆びた金属・砂埃・終末のロードムービー感",
    "  - 改造服・布×金属の組み合わせ・終末ファッション・実用的な無骨さ",
    "  - 既存作品のIP名・固有名詞はプロンプトに直接出さない",
    "  - 各案でロケーション・光の質感・衣装のディテールを完全に差別化する",
    "",
    "▼ 量産テンプレ禁止：",
    "  × 毎回バイク+荒野+革だけ / 血・流血・暴力描写 / 戦闘中・武器の強調",
    "  廃墟の美しさ・朽ちた空間の静けさ・終末後の孤独感をビジュアルで表現する。",
    "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図は一切変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             pickWorldScopes(PW.seikimatsu, dir.moods, memory.lastScopes),
    moods:              dir.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  seikimatsuNote,
    details: {
      ...current.details,
      outfit: {
        style:      dir.outfitStyle,
        color:      "inherit",
        silhouette: "layered",
        decoration: "moderate",
        luxury:     "casual",
        exposure:   current.details.outfit.exposure,
        material:   "leather",
        season:     "skip",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   "dramatic",
        atmosphere:  "hazy",
        temperature: dir.lightTemp,
      },
    },
  };
}

// ─── 🌍 世界観コンボ / 演出コンボ ──────────────────────────────────────────────

/** 世界観プリセットのUI表示ラベル */
export const WORLD_PRESET_DISPLAY: Record<WorldPreset, string> = {
  y2k:        "👗 Y2K",
  y3k:        "🚀 Y3K",
  street:     "🏙️ ストリート",
  cinema:     "🎬 映画",
  wafuu:      "🌸 和風",
  gothic:     "🖤 ゴシック",
  ad:         "📢 広告",
  fantasy:    "✨ 幻想",
  retro:      "📺 レトロ",
  jirai:      "🖤 地雷系",
  seikimatsu: "☠️ 世紀末系",
};

type WorldPresetBuilder = (current: PromptInputs, memory: VariationMemory) => PromptInputs;

const WORLD_PRESET_BUILDERS: Record<WorldPreset, WorldPresetBuilder> = {
  y2k:        buildY2kInputs,
  y3k:        buildY3kInputs,
  street:     buildStreetInputs,
  cinema:     buildCinematicInputs,
  wafuu:      buildWaFuuInputs,
  gothic:     buildGothicInputs,
  ad:         buildAdVisualInputs,
  fantasy:    buildFantasyInputs,
  retro:      buildRetroInputs,
  jirai:      buildJiraiInputs,
  seikimatsu: buildSeikimatsuInputs,
};

/**
 * 🌍×🌌 世界観×斬新背景の融合ブリッジ文（Stage1・固定均衡・front-only・§4不触）。
 * 世界観プリセットと斬新背景プリセットが両方 active かつ背景が変更対象のときだけ、App 側で
 * buildInputs の extra 先頭へ1要素挿入する。背景を一方に寄せず両者を約半々で融合させる方向を
 * 促す中立な指示文。worldCombinedNote/bgPresetNote/各 builder/§4 は無改変。
 * 安全方向（露出抑制/【NG】）には一切触れない。Stage2 で worldBgBalance 値による分岐へ拡張予定。
 */
export function buildWorldBgBridgeNote(): string {
  return [
    "【世界観×斬新背景の融合指示】",
    "世界観プリセットと斬新背景プリセットを同時に指定している。融合させるのは背景に限り、背景はどちらか一方に寄せず両者の要素を約半々で混ぜ合わせ、1つの画面に共存させること。",
    "各案で「世界観の背景だけ／斬新背景だけ」へ振り分けず、毎案で両テーマが溶け合った融合背景にする。",
    "人物・顔・同一性は上記の指示のまま維持する（融合は背景にのみ適用）。",
  ].join("\n");
}

/**
 * 複数の世界観プリセットを融合してひとつの PromptInputs を生成する。
 * - 1つだけ選択 → 通常のビルダーを呼ぶ
 * - 複数選択 → スコープ・ムードをマージし、コンボ指示文を生成
 */
export function buildCombinedWorldInputs(
  current: PromptInputs,
  presets: WorldPreset[],
  memory: VariationMemory,
): PromptInputs {
  if (presets.length === 0) return current;
  if (presets.length === 1) return WORLD_PRESET_BUILDERS[presets[0]](current, memory);

  const built = presets.map((p) => WORLD_PRESET_BUILDERS[p](current, memory));

  const mergedScopes = [...new Set(built.flatMap((b) => b.scopes))] as Scope[];
  const mergedMoods  = [...new Set(built.flatMap((b) => b.moods))].slice(0, 6) as Mood[];

  const labels  = presets.map((p) => WORLD_PRESET_DISPLAY[p]);
  const combo   = labels.join(" × ");

  const comboIntro = [
    `【🌍 世界観コンボ：${combo}】`,
    `${labels.join("・")}を融合したビジュアルを作ること。`,
    "単純に並べるのではなく、各世界観の最も強い要素を自然に掛け合わせる。",
    "衝突する要素は意図的な「ギャップ」として演出し、独自の世界観を作る。",
    "",
  ].join("\n");

  const combinedNotes = built
    .map((b) => b.extraInstructions ?? "")
    .filter(Boolean)
    .join("\n\n");

  return {
    ...current,
    scopes:             mergedScopes,
    moods:              mergedMoods,
    details:            AUTO_DETAILS,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  comboIntro + combinedNotes,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 🌌 斬新背景プリセット（世界観ボタンの背景版・Stage 1）
//
// 設計（Stage 0 で確定）:
//   - background スコープを forced 強制し、details.background の WIRED フィールド
//     （style/effect/color/density/place）＋ extraInstructions 文章で「斬新な背景」を作る。
//   - 文字背景フィールド（textType/textMood/textLayout/textTexture）は DEAD（promptSystem
//     注入経路ゼロ）＝設定しない（no-op）。文字要素は文章で表現する。
//   - 人物・衣装・露出・構図は一切触らない：scopes は背景系のみ（outfit/pose/hair/camera/cyber
//     を含めない）、moods は人物スコープをブーストしない中立ムードのみ、faceLock:true。
//   - §4（promptSystem/scopeFilter/gemini）不触。details.background は REPLACE-on-apply。
// ═══════════════════════════════════════════════════════════════════════════════

export type BgPreset = "code_space" | "math_world" | "digit_world" | "kanji_space" | "typo_space" | "circuit_city" | "polygon_mesh";

interface NovelBgDirection {
  label:    string;
  /** 中立ムードのみ（getMoodScopeBoosts で人物スコープを増やさない＝P8） */
  moods:    Mood[];
  /** 背景スタイル候補（WIRED enum のみ・案ごとに1つ抽選） */
  styles:   BackgroundStyle[];
  /** 空間効果候補（WIRED enum のみ・案ごとに1つ抽選） */
  effects:  BackgroundEffect[];
  /** 背景色候補（WIRED enum のみ・案ごとに1つ抽選。背景にのみ効く＝人物の配色は変えない） */
  colors:   BackgroundColor[];
  density:  BackgroundDensity;
  /** 実在地名を使わない abstract（斬新＝未知の世界を担保） */
  place:    BackgroundPlace;
  /** extraInstructions 文章（bgPresetNote へ格納） */
  note:     string;
}

const NOVEL_BG_DIRECTIONS: Record<BgPreset, NovelBgDirection> = {
  code_space: {
    label:   "🖥 コード空間",
    moods:   ["cool", "minimal"],
    styles:  ["cyber", "digital"],
    effects: ["glitch", "abstract_lines", "particles", "light_rays"],
    colors:  ["monochrome", "high_sat", "vivid"],
    density: "dense",
    place:   "abstract",
    note: [
      "【🖥 斬新背景：コード空間】",
      "背景を「流れるソースコード・端末グリフ・無数のデータライン」で画面いっぱいに埋め尽くす、未知のデジタルの海にする。",
      "実在の都市・看板・ロゴは使わず、どこにも存在しないコードの世界として描く。",
      "",
      "▼ 奥行き：文字・コードを前景から奥へ層を成して羅列し、遠近感のある深い奥行きにする（近景は大きく粗く、遠景は細かく霞ませる）。",
      "▼ 密度：画面を埋め尽くす細かい文字・無数のグリフ・敷き詰められたコード行で情報量を最大にする。",
      "▼ 明るさ：明暗の幅を持たせる。発光する文字列・光るライン・グロー要素を散らし、暗がり一辺倒にしない。",
      "▼ 馴染み：背景の光・粒子・淡いコードが人物の輪郭に自然に回り込み、人物が背景から浮かないようライティングを調和させる（前景要素が人物に薄くかかるのは可）。",
      "",
      "▼ 方向性（案ごとに差別化）：",
      "  ターミナル風コード / 回路基板 / データストリーム / グリッチ画面 / 発光する文字列 / 流れる抽象ライン",
      "",
      "▼ 守ること：",
      "  × 顔の上に読める文字を大きく重ねない（同一性を保つ）。文字・コードは背景・前景側に置く。",
      "  × 実在の場所・ブランド・ロゴを出さない",
      "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・衣装・露出は一切変更しない（斬新化するのは背景の質感・空気・ライティングのみ）。",
    ].join("\n"),
  },
  math_world: {
    label:   "🔢 数式世界",
    moods:   ["minimal", "clean"],
    styles:  ["digital", "monochrome"],
    effects: ["abstract_lines", "geometric", "particles", "light_rays"],
    colors:  ["monochrome", "high_sat"],
    density: "dense",
    place:   "abstract",
    note: [
      "【🔢 斬新背景：数式世界】",
      "背景を「浮遊する数式・記号・幾何学的なライン」で画面いっぱいに敷き詰めた、未知の抽象世界にする。",
      "黒板的な虚空／無限に続く数式の連なりとして描き、実在の場所は使わない。",
      "",
      "▼ 奥行き：数式・記号を前景から奥へ層を成して浮遊させ、遠近感のある深い奥行きにする（手前は大きく、奥は細かく無数に続かせる）。",
      "▼ 密度：画面を埋め尽くす細かい数式・無数の記号・敷き詰められた方程式で情報量を最大にする。",
      "▼ 明るさ：明暗の幅を持たせる。発光する記号・光る数式・グロー要素を散らし、暗がり一辺倒にしない。",
      "▼ 馴染み：背景の光が人物の輪郭に自然に回り込み、人物が背景から浮かないようライティングを調和させる（前景の数式が人物に薄くかかるのは可）。",
      "",
      "▼ 方向性（案ごとに差別化）：",
      "  浮遊する方程式 / 幾何学グリッド / 発光する記号 / 抽象的な座標フィールド / 流れる数式",
      "",
      "▼ 守ること：",
      "  × 顔の上に読める数式を大きく重ねない（同一性を保つ）。数式・記号は背景・前景側に置く。",
      "  × 実在の場所・ブランド・ロゴを出さない",
      "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・衣装・露出は一切変更しない（斬新化するのは背景の質感・空気・ライティングのみ）。",
    ].join("\n"),
  },
  digit_world: {
    label:   "🔟 数字世界",
    moods:   ["cool", "minimal"],
    styles:  ["cyber", "digital"],
    effects: ["abstract_lines", "particles", "light_rays"],
    colors:  ["monochrome", "high_sat"],
    density: "dense",
    place:   "abstract",
    note: [
      "【🔟 斬新背景：数字世界】",
      "背景を「無数の数字・数列・0と1のバイナリ」で画面いっぱいに埋め尽くす、未知のデジタルの海にする。",
      "実在の都市・看板・ロゴは使わず、どこにも存在しない数字の世界として描く。",
      "",
      "▼ 奥行き：数字・数列を前景から奥へ層を成して流れ降らせ、遠近感のある深い奥行きにする（近景は大きく、遠景は細かく霞ませる）。",
      "▼ 密度：画面を埋め尽くす細かい数字・無数の数列・敷き詰められた桁で情報量を最大にする（マトリックス的な数字の雨）。",
      "▼ 明るさ：明暗の幅を持たせる。発光する数字・光る数列・グロー要素を散らし、暗がり一辺倒にしない。",
      "▼ 馴染み：背景の光・粒子が人物の輪郭に自然に回り込み、人物が背景から浮かないようライティングを調和させる（前景要素が人物に薄くかかるのは可）。",
      "",
      "▼ 方向性（案ごとに差別化）：",
      "  流れ降る数列 / バイナリの雨 / 発光する桁 / デジタルカウンター / 浮遊する数字群",
      "",
      "▼ 守ること：",
      "  × 顔の上に読める数字を大きく重ねない（同一性を保つ）。数字は背景・前景側に置く。",
      "  × 実在の場所・ブランド・ロゴを出さない",
      "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・衣装・露出は一切変更しない（斬新化するのは背景の質感・空気・ライティングのみ）。",
    ].join("\n"),
  },
  kanji_space: {
    label:   "🖌 漢字空間",
    moods:   ["minimal", "clean"],
    styles:  ["abstract_art", "monochrome"],
    effects: ["abstract_lines", "ink_bleed", "brushstroke", "geometric"],
    colors:  ["monochrome", "beige"],
    density: "dense",
    place:   "abstract",
    note: [
      "【🖌 斬新背景：漢字空間】",
      "背景を「無数の漢字・古文書の文字・墨字・呪符的な文字」で画面いっぱいに敷き詰めた、未知の文字の海にする。",
      "実在の場所・看板・ロゴは使わず、どこにも存在しない和の文字の世界として描く。",
      "",
      "▼ 奥行き：漢字・墨字を前景から奥へ層を成して羅列し、遠近感のある深い奥行きにする（手前は大きく、奥は細かく無数に続かせる）。",
      "▼ 密度：画面を埋め尽くす細かい漢字・無数の墨字・敷き詰められた古文書の文字で情報量を最大にする（巻物や呪符のような文字の海）。",
      "▼ 明るさ：墨の濃淡と発光する文字で明暗の幅を持たせ、暗がり一辺倒にしない。",
      "▼ 馴染み：背景の光が人物の輪郭に自然に回り込み、人物が背景から浮かないようライティングを調和させる（前景の文字が人物に薄くかかるのは可）。",
      "",
      "▼ 方向性（案ごとに差別化）：",
      "  墨字の羅列 / 古文書の文字 / 呪符・護符の文字 / 巻物の文字列 / 浮遊する漢字群",
      "",
      "▼ 守ること：",
      "  × 顔の上に読める文字を大きく重ねない（同一性を保つ）。文字は背景・前景側に置く。",
      "  × 実在の場所・ブランド・ロゴを出さない",
      "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・衣装・露出は一切変更しない（斬新化するのは背景の質感・空気・ライティングのみ）。",
    ].join("\n"),
  },
  typo_space: {
    label:   "🔤 英字タイポ空間",
    moods:   ["cool", "minimal"],
    styles:  ["gradient", "digital"],
    effects: ["geometric", "color_planes", "particles", "light_rays"],
    colors:  ["high_sat", "vivid"],
    density: "dense",
    place:   "abstract",
    note: [
      "【🔤 斬新背景：英字タイポ空間】",
      "背景を「英単語・アルファベット・タイポグラフィの羅列」で画面いっぱいに構成した、未知のエディトリアルな世界にする。",
      "実在のブランド名・ロゴ・看板は使わず、どこにも存在しない抽象的な文字の構成として描く。",
      "",
      "▼ 奥行き：英字・タイポグラフィを前景から奥へ浮遊させ層を成して羅列し、遠近感のある深い奥行きにする（近景は大きく、遠景は細かく）。",
      "▼ 密度：画面を埋め尽くす英単語・無数のアルファベット・敷き詰められたタイポで情報量を最大にする。",
      "▼ 明るさ：発光する文字・色面・グロー要素で明暗と色彩の幅を持たせ、暗がり一辺倒にしない。",
      "▼ 馴染み：背景の光が人物の輪郭に自然に回り込み、人物が背景から浮かないようライティングを調和させる（前景の文字が人物に薄くかかるのは可）。",
      "",
      "▼ 方向性（案ごとに差別化）：",
      "  エディトリアルなタイポ / 壁面の英文字 / 浮遊するアルファベット / 広告的タイポグラフィ / 色面と文字の構成",
      "",
      "▼ 守ること：",
      "  × 顔の上に読める文字を大きく重ねない（同一性を保つ）。文字は背景・前景側に置く。",
      "  × 実在のブランド名・ロゴ・実在の場所を出さない",
      "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・衣装・露出は一切変更しない（斬新化するのは背景の質感・空気・ライティングのみ）。",
    ].join("\n"),
  },
  circuit_city: {
    label:   "🔌 回路基板の街",
    moods:   ["cool", "minimal"],
    styles:  ["cyber", "digital"],
    effects: ["geometric", "abstract_lines", "light_rays", "particles"],
    colors:  ["green", "gold", "monochrome"],
    density: "dense",
    place:   "abstract",
    note: [
      "【🔌 斬新背景：回路基板の街】",
      "背景を「基板の配線が道路になり、実装部品が建物になった」未知の電子回路都市にする。緑や黒の基板地肌に金色・銀色の配線パターンが街路のように張り巡らされ、ICチップやコンデンサが摩天楼のように林立する。",
      "実在の都市・看板・ロゴは使わず、どこにも存在しない回路の街として描く。",
      "",
      "▼ 奥行き：手前の配線・部品を大きく粗く、奥へ向かうほど細かい回路パターンを層状に重ね、遠近感のある深い奥行きにする（回路の街並みが奥まで続くスケール感）。",
      "▼ 密度：画面を埋め尽くす配線・端子・部品の密集で情報量を最大にする（隙間のない基板の街）。",
      "▼ 明るさ：明暗の幅を持たせる。発光する配線・LEDの点滅・グロー要素を散らし、暗がり一辺倒にしない。",
      "▼ 馴染み：基板の光・配線の反射が人物の輪郭に自然に回り込み、人物が背景から浮かないようライティングを調和させる（前景の配線が人物に薄くかかるのは可）。",
      "",
      "▼ 方向性（案ごとに差別化）：",
      "  緑基板の街並み / 金の配線街路 / 発光するチップの摩天楼 / 銀色の回路網 / 部品が林立する電子都市",
      "",
      "▼ 守ること：",
      "  × 顔の上に読める文字・ロゴを大きく重ねない（同一性を保つ）。配線・部品は背景・前景側に置く。",
      "  × 実在の場所・ブランド・ロゴを出さない",
      "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・衣装・露出は一切変更しない（斬新化するのは背景の質感・空気・ライティングのみ）。",
    ].join("\n"),
  },
  polygon_mesh: {
    label:   "🔺 ポリゴン・ワイヤーフレーム",
    moods:   ["cool", "clean"],
    styles:  ["digital", "monochrome"],
    effects: ["geometric", "abstract_lines", "light_rays"],
    colors:  ["monochrome", "high_sat", "vivid"],
    density: "dense",
    place:   "abstract",
    note: [
      "【🔺 斬新背景：ポリゴン・ワイヤーフレーム世界】",
      "背景を「低ポリゴンの面とワイヤーフレームの線」だけで構成された、未知の幾何学世界にする。三角形・多角形のファセットが折り重なり、輪郭線が発光するワイヤーとして浮かび上がる。",
      "実在の場所・建物は使わず、どこにも存在しないポリゴンの世界として描く。",
      "",
      "▼ 奥行き：手前のポリゴン面を大きく粗く、奥へ向かうほど細かいメッシュを層状に重ね、遠近感のある深い奥行きにする（近景は大きな面、遠景は細かい網目）。",
      "▼ 密度：画面を埋め尽くす面・稜線・頂点の密集で情報量を最大にする（隙間のないメッシュの世界）。",
      "▼ 明るさ：明暗の幅を持たせる。発光するワイヤー・面の陰影・グロー要素を散らし、暗がり一辺倒にしない。",
      "▼ 馴染み：ワイヤーの光・面の反射が人物の輪郭に自然に回り込み、人物が背景から浮かないようライティングを調和させる（前景のメッシュが人物に薄くかかるのは可）。",
      "",
      "▼ 方向性（案ごとに差別化）：",
      "  発光するワイヤーフレーム / 低ポリの山脈状メッシュ / 折り重なるファセット面 / ネオン色の稜線 / 浮遊する多面体群",
      "",
      "▼ 守ること：",
      "  × 顔の上に読めるワイヤーを大きく重ねない（同一性を保つ）。メッシュ・ワイヤーは背景・前景側に置く。",
      "  × 実在の場所・ブランド・ロゴを出さない",
      "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・衣装・露出は一切変更しない（斬新化するのは背景の質感・空気・ライティングのみ）。",
    ].join("\n"),
  },
};

/** 斬新背景用：背景(background)を必ず含め、残りを weighted で 1〜2 軸足す（総数 2〜3・背景系のみ）。 */
function pickBgScopes(
  base:       ScopeWeight,
  moods:      readonly Mood[],
  lastScopes: readonly string[],
): Scope[] {
  return pickScopesWeighted(base, moods, lastScopes, 2, 3, false, ["background"]);
}

/**
 * 斬新背景プリセットを 1 つビルドする（人物・衣装・露出・構図は触らない）。
 * details.background の WIRED フィールドだけ差し替え（REPLACE-on-apply）。
 * 文字背景フィールド（textType/textMood/textLayout/textTexture）は設定しない（DEAD・no-op）。
 */
function buildNovelBgInputs(
  current: PromptInputs,
  memory:  VariationMemory,
  preset:  BgPreset,
): PromptInputs {
  const dir    = NOVEL_BG_DIRECTIONS[preset];
  const moods  = dir.moods;
  const style  = dir.styles[Math.floor(Math.random()  * dir.styles.length)];
  const effect = dir.effects[Math.floor(Math.random() * dir.effects.length)];
  const color  = dir.colors[Math.floor(Math.random()  * dir.colors.length)];

  return {
    ...current,
    scopes:             pickBgScopes(PW[preset], moods, memory.lastScopes),
    moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  dir.note,
    details: {
      ...current.details,
      background: {
        ...current.details.background,  // time/weather/depth/info・文字背景は現状維持（文字背景は DEAD・触らない）
        style,
        effect,
        color,
        density: dir.density,
        place:   dir.place,
      },
    },
  };
}

export function buildCodeSpaceInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  return buildNovelBgInputs(current, memory, "code_space");
}
export function buildMathWorldInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  return buildNovelBgInputs(current, memory, "math_world");
}

/** 斬新背景プリセットのUI表示ラベル */
export const BG_PRESET_DISPLAY: Record<BgPreset, string> = {
  code_space: "🖥 コード空間",
  math_world: "🔢 数式世界",
  digit_world: "🔟 数字世界",
  kanji_space: "🖌 漢字空間",
  typo_space:  "🔤 英字タイポ空間",
  circuit_city: "🔌 回路基板の街",
  polygon_mesh: "🔺 ポリゴン・ワイヤーフレーム",
};

type BgPresetBuilder = (current: PromptInputs, memory: VariationMemory) => PromptInputs;
const BG_PRESET_BUILDERS: Record<BgPreset, BgPresetBuilder> = {
  code_space: buildCodeSpaceInputs,
  math_world: buildMathWorldInputs,
  digit_world: (c, m) => buildNovelBgInputs(c, m, "digit_world"),
  kanji_space: (c, m) => buildNovelBgInputs(c, m, "kanji_space"),
  typo_space:  (c, m) => buildNovelBgInputs(c, m, "typo_space"),
  circuit_city: (c, m) => buildNovelBgInputs(c, m, "circuit_city"),
  polygon_mesh: (c, m) => buildNovelBgInputs(c, m, "polygon_mesh"),
};

/**
 * 複数の斬新背景プリセットを融合してひとつの PromptInputs を生成する（world と同型）。
 * 背景系スコープ・中立ムードのみマージ＝人物は触らない。
 * details はコンボ時に触らない（単一選択時のみ background を差し替え＝world と同型）。
 */
export function buildCombinedBgInputs(
  current: PromptInputs,
  presets: BgPreset[],
  memory:  VariationMemory,
): PromptInputs {
  if (presets.length === 0) return current;
  if (presets.length === 1) return BG_PRESET_BUILDERS[presets[0]](current, memory);

  const built        = presets.map((p) => BG_PRESET_BUILDERS[p](current, memory));
  const mergedScopes = [...new Set(built.flatMap((b) => b.scopes))] as Scope[];
  const mergedMoods  = [...new Set(built.flatMap((b) => b.moods))].slice(0, 4) as Mood[];

  const labels = presets.map((p) => BG_PRESET_DISPLAY[p]);
  const combo  = labels.join(" × ");

  const comboIntro = [
    `【🌌 斬新背景コンボ：${combo}】`,
    `${labels.join("・")}を融合した、実在しない斬新な背景世界を作ること。`,
    "各背景テーマの最も強い要素を自然に掛け合わせ、人物・衣装・構図は一切変えない（背景のみ）。",
    "",
  ].join("\n");

  const combinedNotes = built
    .map((b) => b.extraInstructions ?? "")
    .filter(Boolean)
    .join("\n\n");

  return {
    ...current,
    scopes:             mergedScopes,
    moods:              mergedMoods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  comboIntro + combinedNotes,
  };
}




