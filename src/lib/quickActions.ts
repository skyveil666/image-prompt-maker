/**
 * クイック操作用の状態ビルダー：
 *  - 🔥 一発バズり（buildViralInputs）
 *  - 🎲 全自動おまかせ（buildRandomInputs）
 *  - 🔄 この画像で別案（buildVariantInputs）
 *  - 👗 Y2K / 🚀 Y3K / 🏙️ ストリート（ファッションプリセット）
 * いずれも現在の inputs をベースに、必要なフィールドだけ差し替えて返す純粋関数。
 */
import {
  DEFAULT_DETAILS,
  AUTO_DETAILS,
  type BackgroundPlace,
  type CameraAngle,
  type CameraComposition,
  type CameraDistance,
  type CameraEyeHeight,
  type CameraFov,
  type CameraLens,
  type Count,
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
  createEmptyMemory,
  pickAvoidingRecent,
  pickNAvoidingRecent,
} from "./variationEngine";
import { shuffled } from "./shuffle";

function pickN<T>(arr: T[], n: number): T[] {
  return shuffled(arr).slice(0, Math.min(n, arr.length));
}

const VIRAL_MOOD_POOL: Mood[] = [
  "sns_pop",
  "fantasy",
  "cool",
  "dark",
  "japanese",
  "gothic",
  "mystic",
  "translucent",
  "art",
  "vivid",
  // SNS最適化（Task D で追加）
  "portrait",
  "instagram",
  "tiktok",
  "x_buzz",
];

const ALL_SCOPES: Scope[] = [
  "background",
  "pose",
  "hair",
  "outfit",
  "camera",
  "props",
  "lighting",
  "aspect_ratio",
];

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

const COUNTS: Count[] = [3, 4, 5, 6];

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
): Scope[] {
  const boost   = getMoodScopeBoosts(moods);
  const lastSet = new Set(lastScopes);
  const w: Partial<Record<string, number>> = {};

  for (const s of PRESET_SCOPE_POOL) {
    let v = ((base[s] as number | undefined) ?? 0) + ((boost[s] as number | undefined) ?? 0);
    if (penalizeRecent && lastSet.has(s)) v = Math.max(1, Math.floor(v * 0.3));
    if (v > 0) w[s] = v;
  }

  const count   = min + Math.floor(Math.random() * (max - min + 1));
  const pool    = PRESET_SCOPE_POOL.filter((s) => (w[s] ?? 0) > 0);
  const chosen  = new Set<Scope>();

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

  // 直近と完全一致 → 1 要素をランダムに入れ替えて差別化
  if (result.length === lastScopes.length && result.every((s) => lastSet.has(s))) {
    const rest = pool.filter((s) => !chosen.has(s));
    if (rest.length > 0) {
      const replaceIdx     = Math.floor(Math.random() * result.length);
      result[replaceIdx]   = rest[Math.floor(Math.random() * rest.length)];
    }
  }
  return result;
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
};

/**
 * スコープのフォールバック選択。
 * ユーザーがすでにスコープを選択済みならそれを維持する。
 * 未選択（空）の場合はプリセット推奨スコープを返す。
 */
function scopeOrDefault(current: PromptInputs, fallback: Scope[]): Scope[] {
  return current.scopes.length > 0 ? current.scopes : fallback;
}

/**
 * 🔥 一発バズり：SNS で目を引く強プロンプトを一発生成する設定を作る。
 */
export function buildViralInputs(current: PromptInputs, _memory: VariationMemory = createEmptyMemory()): PromptInputs {
  const moods  = pickN(VIRAL_MOOD_POOL, 2 + Math.floor(Math.random() * 2));

  return {
    ...current,
    scopes: scopeOrDefault(current, pickScopesWeighted(PW.viral, moods, _memory.lastScopes)),
    moods,
    count: 4 as Count,
    details: DEFAULT_DETAILS,
    faceLock: true,
    viralMode: true,
    autoMoodCategories: [],
  };
}

/**
 * 🎲 全自動おまかせ：scope / mood / 案数 を全部ランダムに決める。
 * 詳細は auto のまま（サーバ側で案ごとに散らせる）。
 */
export function buildRandomInputs(current: PromptInputs): PromptInputs {
  // scopes: 2〜4 個、ただし pose 単独より組み合わせを優先
  const scopes = pickN(ALL_SCOPES, 2 + Math.floor(Math.random() * 3));

  // moods: 2〜4 個
  const moods = pickN(ALL_MOODS, 2 + Math.floor(Math.random() * 3));

  // 案数: 3/4/5/6
  const count = COUNTS[Math.floor(Math.random() * COUNTS.length)];

  return {
    ...current,
    scopes,
    moods,
    count,
    details: DEFAULT_DETAILS,
    faceLock: true,
    viralMode: false,
    autoMoodCategories: [],
  };
}

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

// ─── 神引き ────────────────────────────────────────────────────────────────────

const GOD_MOOD_POOL: Mood[] = [
  // 幻想・神秘系
  "fantasy", "mystic", "fantasy_world",
  // 和風・ゴシック・ダーク系
  "japanese", "gothic", "dark", "decadent",
  // アート・透明感・映え系
  "art", "translucent", "cinematic", "sns_pop",
  // 鮮やか・明るい系
  "vivid", "bright", "pastel",
  // サイバー・近未来（控えめ）
  "near_future", "cyberpunk",
  // SNS最適化・高品質系（Task D で追加）
  "portrait", "wa_fantasy", "trend_2026",
];

/** 武器を除外。花・光・幻想系の小物を優先。 */
const GOD_PROPS_HINTS = [
  "巨大ハート",
  "発光蝶",
  "狐面",
  "透明傘",
  "王冠",
  "黒薔薇",
  "浮遊する花びら",
  "光るキューブ",
  "ガラス破片",
  "光の羽根",
  "浮遊する水球",
  "花冠",
  "光輪",
  "透明な翼",
  "月の欠片",
];

/**
 * 👑 神引き：ユーザースタイルを最大限に引き出す最高品質一枚絵を生成。
 * 世界観・演出・色を多様に散らし、「保存したくなる絵」レベルを目指す。
 */
export function buildGodInputs(current: PromptInputs, _memory: VariationMemory = createEmptyMemory()): PromptInputs {
  // ムードは毎回異なる方向から 3〜4 個選ぶ
  const moods  = pickN(GOD_MOOD_POOL, 3 + Math.floor(Math.random() * 2));
  // 武器を除いた小物ヒントをランダムに1つ選ぶ
  const propHint = GOD_PROPS_HINTS[Math.floor(Math.random() * GOD_PROPS_HINTS.length)];

  const godNote = [
    "【👑 神引きモード — 最高品質一枚絵生成】",
    "このユーザーの投稿スタイルに合わせた、SNSで「すごい！」と思わせる一枚絵を生成してください。",
    "",
    "▼ 強化項目：",
    "  - 色演出強化：主題色・グラデーション・色対比を最大限に美しく",
    "  - 光演出強化：オーラ・リムライト・発光粒子・光輪を印象的に演出",
    "  - 空気感強化：霧・浮遊感・大気感・神秘エフェクトを繊細に表現",
    "  - 構図完成度：主題が中央で際立つ「一枚絵として完結した構図」",
    "  - 保存率意識：「SNSで保存したくなる絵」「壁紙にしたい絵」レベルを目指す",
    "",
    `▼ 小物候補（使わなくてもよい）：${propHint}`,
    "",
    "▼ 絶対ルール：",
    "  - 各案で世界観・色・演出を完全に差別化する（似た案の量産は絶対禁止）",
    "  - 顔の同一性は絶対維持・別人化禁止",
    "  - 過剰ネオン・電脳都市・ブレードランナー風はデフォルト禁止",
    "  - 武器（刀・銃・デジタル武器）は明示指定がない限り出さない",
    "  - 露出は控えめ・被写体が若く見える場合は透明感・幻想性・花・光で映えさせる",
  ].join("\n");

  return {
    ...current,
    scopes:            scopeOrDefault(current, pickScopesWeighted(PW.god, moods, _memory.lastScopes, 4, 6)),
    moods,
    count:             4 as Count,
    details:           AUTO_DETAILS,
    faceLock:          true,
    viralMode:         true,
    extraInstructions: godNote,
    autoMoodCategories: [],
  };
}

// ─── 小物ガチャ ────────────────────────────────────────────────────────────────

/** 小物ガチャのプール。category は PropsCategory にマッピング済み。 */
export const GACHA_POOL: ReadonlyArray<{
  label: string;
  category: PropsCategory;
}> = [
  { label: "刀",             category: "weapon"    },
  { label: "透明傘",         category: "sns"       },
  { label: "蝶",             category: "cute"      },
  { label: "ネオン剣",       category: "weapon"    },
  { label: "花束",           category: "cute"      },
  { label: "猫",             category: "cute"      },
  { label: "ヘッドフォン",   category: "daily"     },
  { label: "王冠",           category: "sns"       },
  { label: "羽",             category: "cute"      },
  { label: "仮面",           category: "gothic"    },
  { label: "発光スマホ",     category: "futuristic"},
  { label: "ぬいぐるみ",     category: "cute"      },
  { label: "本",             category: "daily"     },
  { label: "カメラ",         category: "daily"     },
  { label: "鎖",             category: "gothic"    },
  { label: "扇子",           category: "japanese"  },
  { label: "和傘",           category: "japanese"  },
  { label: "狐面",           category: "japanese"  },
  { label: "ホログラム端末", category: "futuristic"},
  { label: "巨大リボン",     category: "sns"       },
] as const;

/** 小物ガチャを1回まわして結果を返す（DetailSettings は呼び出し側で反映）。 */
export function rollPropsGacha(): { label: string; category: PropsCategory } {
  const item = GACHA_POOL[Math.floor(Math.random() * GACHA_POOL.length)];
  return { label: item.label, category: item.category };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔄 この画像で別案：現在の画像と主要設定を残しつつ、
 * mood を 1 つだけ入れ替えて詳細を auto に戻す（少しだけ揺らす）。
 * scopes / count / locks / safety / NG / faceLock / extraInstructions は維持。
 */
export function buildVariantInputs(current: PromptInputs): PromptInputs {
  const others = ALL_MOODS.filter((m) => !current.moods.includes(m));
  const newMoods = [...current.moods];
  if (newMoods.length > 0 && others.length > 0) {
    const dropIdx = Math.floor(Math.random() * newMoods.length);
    newMoods.splice(dropIdx, 1);
    newMoods.push(others[Math.floor(Math.random() * others.length)]);
  } else if (others.length > 0) {
    // mood 未選択時：何か 1 個足す
    newMoods.push(others[Math.floor(Math.random() * others.length)]);
  }

  return {
    ...current,
    moods: newMoods,
    details: DEFAULT_DETAILS,
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
    scopes:             pickScopesWeighted(PW.y2k, moods, memory.lastScopes),
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
        exposure:   "skip",
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
    scopes:             pickScopesWeighted(PW.y3k, moods, memory.lastScopes),
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
        decoration: "auto",
        luxury:     "future_luxe",
        exposure:   "skip",
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
    scopes:             pickScopesWeighted(PW.street, moods, memory.lastScopes),
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
        exposure:   "normal",
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

// ── 🎭 ギャップ化 ─────────────────────────────────────────────────────────────

/** 現在の雰囲気方向と "映えるギャップ" になる逆方向 */
const GAP_DIRECTIONS: Array<{
  fromMoods: Mood[];
  toMoods:   Mood[];
  toOutfit:  OutfitStyle;
  label:     string;
}> = [
  {
    fromMoods: ["cute", "pop", "pastel", "bright", "sns_pop"],
    toMoods:   ["dark", "luxe", "cinematic", "decadent", "monochrome"] as Mood[],
    toOutfit:  "mode",
    label:     "かわいい→ダーク高級",
  },
  {
    fromMoods: ["dark", "gothic", "decadent", "monochrome"],
    toMoods:   ["sns_pop", "pop", "bright", "fantasy", "vivid", "pastel"] as Mood[],
    toOutfit:  "y2k",
    label:     "ダーク→ポップ幻想",
  },
  {
    fromMoods: ["street", "cool", "digital", "cyberpunk"],
    toMoods:   ["luxe", "cinematic", "art", "minimal"] as Mood[],
    toOutfit:  "runway",
    label:     "ストリート→クラシカル高級",
  },
  {
    fromMoods: ["near_future", "cyberpunk", "glitch"],
    toMoods:   ["retro", "cinematic", "emo", "noisy"] as Mood[],
    toOutfit:  "dress",
    label:     "未来系→レトロ映画風",
  },
  {
    fromMoods: ["japanese", "wa_fantasy", "mystic", "fantasy_world"],
    toMoods:   ["cool", "cinematic", "luxe", "monochrome"] as Mood[],
    toOutfit:  "mode",
    label:     "和風→クールモダン",
  },
  {
    fromMoods: ["translucent", "minimal", "pastel"],
    toMoods:   ["dark", "gothic", "decadent", "art"] as Mood[],
    toOutfit:  "gothic",
    label:     "透明感→ゴシックアート",
  },
  {
    fromMoods: ["luxe", "art", "cinematic"],
    toMoods:   ["street", "pop", "vivid", "sns_pop"] as Mood[],
    toOutfit:  "street",
    label:     "高級感→カラフルストリート",
  },
];

/**
 * 🎭 ギャップ化：現在の雰囲気と逆方向の "映えるギャップ" を設定する。
 * 毎回異なるギャップ方向を選ぶ（VariationMemory でムード連発を避ける）。
 */
export function buildGapInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const matched = GAP_DIRECTIONS.filter((d) =>
    d.fromMoods.some((m) => current.moods.includes(m))
  );
  const pool = matched.length > 0 ? matched : GAP_DIRECTIONS;
  const direction = pool[Math.floor(Math.random() * pool.length)];
  const newMoods = pickNAvoidingRecent(direction.toMoods, memory.recentMoods, 3);

  const note = [
    "【🎭 ギャップ化】",
    `現在の雰囲気とは逆方向への変換：${direction.label}`,
    "単純な反転ではなく「映えるギャップ」になるよう衣装・背景・色・演出を全体的にコーディネートする。",
    "各案でギャップの方向性は共有しつつ、具体的な衣装・背景・演出は差別化する。",
    "顔・人物同一性は完全固定。",
  ].join("\n");

  return {
    ...current,
    scopes: scopeOrDefault(current, pickScopesWeighted(PW.gap, newMoods, memory.lastScopes)),
    moods:              newMoods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  note,
    details: {
      ...current.details,
      outfit: {
        ...current.details.outfit,
        style:    direction.toOutfit,
        color:    "auto",
        luxury:   "auto",
        material: "auto",
      },
    },
  };
}

// ── 🧪 量産回避 ────────────────────────────────────────────────────────────────

const ANTI_BG_POOL: BackgroundPlace[] = [
  "old_cinema", "greenhouse", "library", "night_amusement", "frosted_room",
  "museum", "gallery", "atelier", "industrial",
];

const ANTI_MOOD_POOL: Mood[] = [
  "art", "monochrome", "cinematic", "emo", "noisy", "portrait", "pinterest", "minimal", "retro",
];

/**
 * 🧪 量産回避：AI量産テンプレを避け、珍しい場所・意外な色・映画的構図を優先する。
 * 毎回異なる背景・ムードを選ぶ。
 */
export function buildAntiTemplateInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const bgPlace = pickAvoidingRecent(ANTI_BG_POOL, memory.recentBgPlaces);
  const moods   = pickNAvoidingRecent(ANTI_MOOD_POOL, memory.recentMoods, 2 + Math.floor(Math.random() * 2));

  const note = [
    "【🧪 量産回避モード】",
    "「AI量産画像」に見えないよう、以下のパターンを積極的に避ける：",
    "  ✗ 黒バラ・ステンドグラス・白ワンピース・透明羽・神社・教会・魔法陣乱用・青紫ネオン街・雨のサイバー路地・HUDだけの演出・量産アニメ構図",
    "",
    "代わりに以下を優先する：",
    "  ✓ 珍しい場所（美術館・アトリエ・廃工場・大温室・地下図書館）",
    "  ✓ 意外な色組み合わせ（くすみグリーン×ゴールド・テラコッタ×シルバーなど）",
    "  ✓ 広告・ファッション誌・映画スチル風の構図",
    "  ✓ 現代美術・インスタレーション感のある背景",
    "  ✓ 素材感の主張（テクスチャ・光沢・透明感の意外な組み合わせ）",
    "  ✓ 余白を生かした雑誌風構図",
    "各案を生成する前に「よく見るAI画像と同じでないか」を必ず確認すること。",
  ].join("\n");

  return {
    ...current,
    scopes: scopeOrDefault(current, pickScopesWeighted(PW.gap, moods, memory.lastScopes)),
    moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  note,
    details: {
      ...current.details,
      background: { ...current.details.background, place: bgPlace },
      camera:     { ...current.details.camera, composition: "magazine" },
    },
  };
}

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
    scopes: pickScopesWeighted(PW.cinema, moods, memory.lastScopes),
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

// ── 🧊 清潔感 ──────────────────────────────────────────────────────────────────

const CLEAN_BG_POOL: BackgroundPlace[] = [
  "studio", "frosted_room", "gallery", "paper_backdrop", "fabric_backdrop", "empty_space",
];

const CLEAN_OUTFIT_STYLES: OutfitStyle[]    = ["mode", "dress", "runway", "future_dress"];
const CLEAN_OUTFIT_COLORS: OutfitColor[]    = ["white", "silver", "light_blue", "inherit"];
const CLEAN_OUTFIT_MATERIALS: OutfitMaterial[] = ["chiffon", "organza", "lace", "transparent"];

/**
 * 🧊 清潔感：上品・クリーン・高級広告風。白・シルバー・透明感を中心に。
 */
export function buildCleanInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const bgPlace      = pickAvoidingRecent(CLEAN_BG_POOL,       memory.recentBgPlaces);
  const outfitStyle  = pickAvoidingRecent(CLEAN_OUTFIT_STYLES, memory.recentOutfits);
  const outfitColor  = pickAvoidingRecent(CLEAN_OUTFIT_COLORS, memory.recentMoods) as OutfitColor;
  const outfitMat    = CLEAN_OUTFIT_MATERIALS[Math.floor(Math.random() * CLEAN_OUTFIT_MATERIALS.length)];

  const note = [
    "【🧊 清潔感モード】",
    "上品でクリーンな高級感を演出する。広告・美容誌・Appleプロモーション風の完成度。",
    "▼ 強化：清潔な明るいトーン・余白を活かしたミニマル構図・柔らかく透明感のある光",
    "▼ 禁止：過剰ネオン・汚れた背景・暗すぎる演出",
  ].join("\n");

  const cleanMoods: Mood[] = ["luxe", "translucent", "minimal", "instagram"];

  return {
    ...current,
    scopes: scopeOrDefault(current, pickScopesWeighted(PW.clean, cleanMoods, memory.lastScopes)),
    moods:              cleanMoods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  note,
    details: {
      ...current.details,
      outfit: {
        ...current.details.outfit,
        style:      outfitStyle,
        color:      outfitColor,
        material:   outfitMat,
        luxury:     "luxe" as OutfitLuxury,
        decoration: "minimal" as OutfitDecoration,
      },
      background: {
        ...current.details.background,
        place:   bgPlace,
        color:   "white",
        density: "minimal",
      },
      lighting: {
        ...current.details.lighting,
        intensity:   "pale_glow",
        temperature: "white_light",
        atmosphere:  "clear",
      },
    },
  };
}

// ── 🌀 前景盛り ─────────────────────────────────────────────────────────────────

const FG_EFFECT_POOL = [
  "petals", "sakura", "rose", "camellia",
  "butterfly", "feather", "light_particle", "stardust",
  "bubble", "snow", "glass", "confetti",
  "transparent_ribbon", "fabric_strip", "smoke_puff",
  "foxfire", "spirit_fire", "light_feather",
] as const;
type FgEffect = typeof FG_EFFECT_POOL[number];

const FG_MOTION_POOL = [
  "gentle_flow", "falling", "rising", "rotate", "wave", "surround",
] as const;

/**
 * 🌀 前景盛り：人物の手前にエフェクトを追加。毎回異なる種類・動きを選ぶ。
 */
export function buildForegroundRichInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const effect = pickAvoidingRecent(
    FG_EFFECT_POOL as unknown as FgEffect[],
    memory.recentFgEffects,
  );
  const motion  = FG_MOTION_POOL[Math.floor(Math.random() * FG_MOTION_POOL.length)];
  const density = Math.random() < 0.6 ? "rich" : "normal" as const;

  return {
    ...current,
    scopes:             scopeOrDefault(current, ["foreground"] as Scope[]),
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: current.autoMoodCategories,
    details: {
      ...current.details,
      foreground: {
        preset:      "skip",
        effectType:  effect,
        swirlType:   "skip",
        digitalType: "skip",
        artType:     "skip",
        position:    "full_body",
        density,
        motion,
        color:       "inherit",
        depth:       "front_back_overlap",
        visibility:  "face_protected",
      },
    },
  };
}

// ── 🧥 衣装だけ神引き ────────────────────────────────────────────────────────────

interface OutfitGodEntry {
  style:      OutfitStyle;
  color:      OutfitColor;
  material:   OutfitMaterial;
  luxury:     OutfitLuxury;
  decoration: OutfitDecoration;
  silhouette: OutfitSilhouette;
  moods:      Mood[];
}

const OUTFIT_GOD_POOL: OutfitGodEntry[] = [
  // ── モード・構築系 ──────────────────────────────────────────────────────────
  { style: "mode",        color: "black",    material: "leather",     luxury: "couture",     decoration: "minimal",    silhouette: "a_line",       moods: ["art",         "cinematic",   "luxe"]       },
  { style: "mode",        color: "white",    material: "cloth",       luxury: "couture",     decoration: "minimal",    silhouette: "asymmetric",   moods: ["minimal",     "art",         "luxe"]       },
  // ── ランウェイ・エディトリアル ──────────────────────────────────────────────
  { style: "runway",      color: "gold",     material: "velvet",      luxury: "couture",     decoration: "elaborate",  silhouette: "flare",        moods: ["luxe",        "cinematic",   "art"]        },
  { style: "runway",      color: "gradient", material: "organza",     luxury: "couture",     decoration: "chain_decor",silhouette: "asymmetric",   moods: ["instagram",   "luxe",        "art"]        },
  // ── 近未来・テックウェア ─────────────────────────────────────────────────────
  { style: "future_dress",color: "silver",   material: "transparent", luxury: "future_luxe", decoration: "chain_decor",silhouette: "asymmetric",   moods: ["near_future", "cool",        "luxe"]       },
  { style: "techwear",    color: "black",    material: "nylon",       luxury: "refined",     decoration: "minimal",    silhouette: "oversized",    moods: ["cool",        "near_future", "street"]     },
  { style: "cyber",       color: "silver",   material: "transparent", luxury: "future_luxe", decoration: "chain_decor",silhouette: "layered",      moods: ["near_future", "vivid",       "cool"]       },
  // ── ストリート・Y2K・グランジ ────────────────────────────────────────────────
  { style: "y2k",         color: "gradient", material: "pvc",         luxury: "casual",      decoration: "rhinestone", silhouette: "short_length", moods: ["sns_pop",     "pop",         "vivid"]      },
  { style: "street",      color: "white",    material: "denim",       luxury: "casual",      decoration: "minimal",    silhouette: "oversized",    moods: ["cool",        "street",      "clean"]      },
  { style: "street",      color: "red",      material: "nylon",       luxury: "casual",      decoration: "moderate",   silhouette: "layered",      moods: ["street",      "vivid",       "sns_pop"]    },
  // ── 和モダン ─────────────────────────────────────────────────────────────────
  { style: "wa_modern",   color: "inherit",  material: "chiffon",     luxury: "refined",     decoration: "embroidery", silhouette: "a_line",       moods: ["japanese",    "cinematic",   "mystic"]     },
  // ── ミリタリー・工業モード ────────────────────────────────────────────────────
  { style: "military",    color: "inherit",  material: "nylon",       luxury: "refined",     decoration: "minimal",    silhouette: "oversized",    moods: ["cool",        "cinematic",   "dark"]       },
  // ── ゴシック系（ドレス許可条件：ゴシック/ダークラグジュアリー文脈） ──────────
  { style: "gothic",      color: "black",    material: "velvet",      luxury: "refined",     decoration: "elaborate",  silhouette: "long_length",  moods: ["gothic",      "dark",        "art"]        },
  { style: "dress",       color: "black",    material: "velvet",      luxury: "couture",     decoration: "chain_decor",silhouette: "asymmetric",   moods: ["luxe",        "dark",        "cinematic"]  },
  // ── アイドル・クリーン（軽め演出用） ──────────────────────────────────────────
  { style: "idol",        color: "white",    material: "chiffon",     luxury: "refined",     decoration: "ribbon",     silhouette: "short_length", moods: ["sns_pop",     "bright",      "instagram"]  },
];

/**
 * 🧥 衣装だけ神引き：衣装スコープのみ変更。顔・背景・ポーズ・カメラは完全固定。
 * 毎回異なる衣装方向を選ぶ。
 */
export function buildOutfitGodInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = OUTFIT_GOD_POOL.filter((o) => !memory.recentOutfits.includes(o.style));
  const pool   = available.length > 0 ? available : OUTFIT_GOD_POOL;
  const outfit = pool[Math.floor(Math.random() * pool.length)];

  const note = [
    "【🧥 衣装だけ神引き】",
    "衣装のみを神引きレベルで生成する。背景・ポーズ・カメラ・髪・顔は完全固定。",
    "▼ 衣装強化：素材感の精密描写・デザイン細部・光源と衣装の色反射",
    "▼ 各案で衣装の方向性を明確に差別化する。背景・ポーズ・カメラ・髪は変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             scopeOrDefault(current, ["outfit"] as Scope[]),
    moods:              outfit.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  note,
    details: {
      ...current.details,
      outfit: {
        style:      outfit.style,
        color:      outfit.color,
        material:   outfit.material,
        luxury:     outfit.luxury,
        decoration: outfit.decoration,
        silhouette: outfit.silhouette,
        exposure:   "skip",
        season:     "skip",
      },
    },
  };
}

// ── 🌍 背景だけ神引き ────────────────────────────────────────────────────────────

interface BgGodEntry {
  place: BackgroundPlace;
  hint:  string;
  moods: Mood[];
}

const BG_GOD_POOL: BgGodEntry[] = [
  { place: "greenhouse",   hint: "巨大温室（ガラス張り・熱帯植物・蒸気・柔らかい自然光）",               moods: ["translucent", "art",       "bright"]     },
  { place: "museum",       hint: "現代美術館（広いホワイトウォール・スポットライト・余白の美）",           moods: ["art",         "minimal",   "cinematic"]  },
  { place: "library",      hint: "地下図書館（天井まで届く本棚・暗い照明・静寂の重厚感）",               moods: ["dark",        "cinematic", "emo"]        },
  { place: "old_cinema",   hint: "古い映画館（赤いシート・大きなスクリーン・ノスタルジア）",             moods: ["retro",       "cinematic", "emo"]        },
  { place: "night_amusement",hint:"夜の遊園地（カラフルなライト・観覧車・ドリーミーな光）",             moods: ["sns_pop",     "fantasy",   "vivid"]      },
  { place: "futuristic",   hint: "近未来の空港（白いアーチ型構造・透明な通路・清潔な光）",               moods: ["near_future", "cool",      "luxe"]       },
  { place: "indoor",       hint: "高層ホテルのラウンジ（床から天井まで窓・夜景・低い光源）",             moods: ["luxe",        "cinematic", "dark"]       },
  { place: "rooftop",      hint: "屋上プール（水面の光反射・都市の夜景・静かな夜）",                    moods: ["cinematic",   "cool",      "luxe"]       },
  { place: "abstract",     hint: "水面空間（床が鏡面・水面反射が全体を覆う幻想的な空間）",               moods: ["mystic",      "translucent","art"]       },
  { place: "gallery",      hint: "高級ブランドの路面店（白石床・ガラスウォール・照明演出）",             moods: ["luxe",        "minimal",   "instagram"]  },
  { place: "industrial",   hint: "廃倉庫アートスペース（レンガ・アーチ天井・粗い質感に対比する美）",      moods: ["art",         "cinematic", "emo"]        },
  { place: "frosted_room", hint: "ガラス回廊（半透明ガラスの廊下・拡散光・クリーンな幾何学感）",         moods: ["translucent", "cool",      "minimal"]    },
  { place: "atelier",      hint: "布のインスタレーション（大量の布が天井から垂れる芸術空間）",            moods: ["art",         "fantasy",   "cinematic"]  },
  { place: "night_amusement",hint:"屋上プール（夜の都市×水面反射×ライトアップ）",                      moods: ["sns_pop",     "luxe",      "cool"]       },
];

/**
 * 🌍 背景だけ神引き：人物固定。背景のみ大胆かつ独自性の高い空間へ。
 * ありきたりな背景は禁止。毎回異なる場所を選ぶ。
 */
export function buildBgGodInputs(current: PromptInputs, memory: VariationMemory): PromptInputs {
  const available = BG_GOD_POOL.filter((b) => !memory.recentBgPlaces.includes(b.place));
  const pool = available.length > 0 ? available : BG_GOD_POOL;
  const bg   = pool[Math.floor(Math.random() * pool.length)];

  const note = [
    "【🌍 背景だけ神引き】",
    "人物・衣装・ポーズ・カメラは完全固定。背景のみを大胆かつ独自性の高い空間に変更する。",
    `▼ 今回の背景：${bg.hint}`,
    "▼ 強化：背景の精密描写・人物と背景の自然な融合（光源・色温度・影の整合）",
    "▼ ありきたりな背景（ネオン街・神社・白スタジオのみ）は禁止。各案で細部・照明・時間帯を差別化。",
    "背景の変更のみ。人物・衣装・ポーズ・カメラは変更しない。",
  ].join("\n");

  return {
    ...current,
    scopes:             scopeOrDefault(current, ["background"] as Scope[]),
    moods:              bg.moods,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  note,
    details: {
      ...current.details,
      background: {
        ...DEFAULT_DETAILS.background,
        place:   bg.place,
        depth:   "shallow",
        density: "dense",
      },
    },
  };
}

// ── 📷 構図神引き ─────────────────────────────────────────────────────────────────

interface CompositionGodEntry {
  id:          string;
  label:       string;
  moods:       Mood[];
  /** CameraSettings の部分パッチ（指定したフィールドだけ上書き）。custom3D は常に null にリセット。 */
  camera: {
    angle?:       CameraAngle;
    distance?:    CameraDistance;
    lens?:        CameraLens;
    composition?: CameraComposition;
    fov?:         CameraFov;
    eyeHeight?:   CameraEyeHeight;
  };
  instruction: string;
}

const COMPOSITION_GOD_POOL: readonly CompositionGodEntry[] = [
  {
    id: "extreme_close", label: "超寄り",
    moods: ["cinematic", "portrait"],
    camera: { angle: "close_portrait", distance: "close", lens: "tele", composition: "centered" },
    instruction: "超寄りクローズアップ。顔や上半身を大きく切り取り、望遠圧縮で質感と表情のディテールを強調する。",
  },
  {
    id: "foot_level", label: "足元",
    moods: ["cinematic", "street"],
    camera: { angle: "low", distance: "close", lens: "normal", eyeHeight: "low" },
    instruction: "足元視点の落ち着いたローアングル。靴・裾・地面の質感を切り取る。体の高さと空間のコントラストを演出。",
  },
  {
    id: "back_view", label: "背面",
    moods: ["cinematic", "emo"],
    camera: { angle: "back_view", distance: "medium", lens: "normal" },
    instruction: "人物の後ろ姿を主役に。背景とシルエットのコントラスト・髪の流れ・背中のデザインを見せる。",
  },
  {
    id: "top_down", label: "真上",
    moods: ["art", "cinematic"],
    camera: { angle: "top_down", distance: "medium", lens: "normal", eyeHeight: "ceiling" },
    instruction: "真上から見下ろすトップダウン構図。床のデザイン・衣装の広がり・人物の平面的な美しさを強調。",
  },
  {
    id: "fisheye", label: "魚眼",
    moods: ["digital", "cinematic"],
    camera: { angle: "low", lens: "portrait", fov: "standard" },
    instruction: "ローアングルのポートレートレンズ構図。被写体を見上げるように捉え、存在感と迫力を引き出す。",
  },
  {
    id: "dutch", label: "ダッチ",
    moods: ["cinematic", "dark"],
    camera: { angle: "dutch", distance: "medium", composition: "rule_of_thirds" },
    instruction: "カメラを斜めに傾けたダッチアングル。緊張感・不安定感・ドラマ性を画面に刻む。",
  },
  {
    id: "cctv", label: "CCTV",
    moods: ["digital", "near_future"],
    camera: { angle: "high", distance: "far", lens: "normal", eyeHeight: "ceiling", composition: "symmetric" },
    instruction: "天井付近のCCTV監視カメラ風視点。低コントラスト・グレイン感を加えてもよい。",
  },
  {
    id: "drone", label: "ドローン",
    moods: ["cinematic", "cool"],
    camera: { angle: "top_down", distance: "far", fov: "standard", eyeHeight: "above_head" },
    instruction: "ドローン空撮風。高めからの俯瞰で大地・建築と対比させる。ただし人物は主役の大きさを保ち、豆粒化・点景化させない。",
  },
  {
    id: "smartphone_selfie", label: "スマホ自撮り",
    moods: ["sns_pop", "portrait"],
    camera: { angle: "close_portrait", distance: "close", lens: "smartphone", fov: "vertical_sns" },
    instruction: "スマホ自撮り風の縦長フォーマット。レンズ歪み・腕を伸ばした角度・現代的カジュアル感を表現。",
  },
  {
    id: "security_cam", label: "監視カメラ",
    moods: ["dark", "cinematic"],
    camera: { angle: "diagonal_high", distance: "far", lens: "normal", eyeHeight: "above_head" },
    instruction: "斜め上からの監視カメラ的視点。CCTVより斜め感が強く、人物を俯瞰で捉える。緊張感と孤独を演出。",
  },
  {
    id: "fashion_mag", label: "ファッション誌",
    moods: ["instagram", "luxe", "ad_visual"],
    camera: { angle: "diagonal_45", distance: "medium", lens: "portrait", composition: "rule_of_thirds" },
    instruction: "ファッション誌の撮影スタイル。商業的美意識を最優先。全身または腰上の洗練されたポートレートフレーム。",
  },
  {
    id: "magazine_cover", label: "雑誌表紙",
    moods: ["magazine_cover", "luxe"],
    camera: { angle: "front", distance: "bust_up", lens: "portrait", composition: "magazine", fov: "vertical_sns" },
    instruction: "雑誌の表紙レイアウト。上部にテキスト余白。視線はカメラ目線またはやや外し。縦長フォーマット。",
  },
  {
    id: "subject_large", label: "被写体大きめ",
    moods: ["cinematic", "portrait"],
    camera: { angle: "diagonal_45", distance: "close", lens: "portrait", composition: "subject_large" },
    instruction: "被写体を画面に大きく配置し存在感とオーラを前面に。背景は狭く絞る。",
  },
  {
    id: "negative_space", label: "余白多め",
    moods: ["minimal", "art"],
    camera: { angle: "front", distance: "far", lens: "normal", composition: "generous_space" },
    instruction: "余白を大きく取った構図。孤独感・広がり・ミニマルな美意識を表現。人物は画面の一部として配置。",
  },
  {
    id: "asymmetric", label: "左右非対称",
    moods: ["art", "cinematic"],
    camera: { angle: "diagonal_45", distance: "medium", lens: "normal", composition: "asymmetric" },
    instruction: "左右非対称の緊張感ある構図。対角線・視線誘導・余白の使い方で画面に動きを出す。",
  },
  {
    id: "low_angle", label: "低い視点",
    moods: ["cinematic", "cool"],
    camera: { angle: "low", distance: "medium", lens: "normal", eyeHeight: "low" },
    instruction: "見上げる低角度アングル。被写体の迫力・威圧感・高さを強調する。空や背景を大きく取り込む。",
  },
  {
    id: "ground_level", label: "地面すれすれ",
    moods: ["street", "cinematic"],
    camera: { angle: "low", distance: "close", lens: "normal", eyeHeight: "low", fov: "standard" },
    instruction: "低い視点から捉えた構図。地面の質感・脚元と空との対比を自然な低アングルで演出する。",
  },
  {
    id: "over_shoulder", label: "肩越し",
    moods: ["cinematic", "emo"],
    camera: { angle: "over_shoulder", distance: "medium", lens: "normal", composition: "rule_of_thirds" },
    instruction: "肩越しの奥行き構図。前景に肩や後頭部をフレームインし、視点の物語性と奥行きを生む。",
  },
  {
    id: "side_profile_close", label: "横顔寄り",
    moods: ["portrait", "cinematic", "emo"],
    camera: { angle: "side_profile", distance: "bust_up", lens: "portrait" },
    instruction: "横顔を寄りで捉えた構図。輪郭・目・鼻・唇の美しさを強調。背景は深くボカして被写体に集中させる。",
  },
] as const;

/** 構図神引きのコンパニオンスコープ（カメラと一緒に付く1〜2スコープの重み） */
const COMPANION_SCOPE_WEIGHTS: Array<{ scope: Scope; weight: number }> = [
  { scope: "lighting",   weight: 7 },
  { scope: "background", weight: 6 },
  { scope: "foreground", weight: 5 },
  { scope: "outfit",     weight: 4 },
  { scope: "hair",       weight: 3 },
];

function pickCompanionScopes(count: 1 | 2): Scope[] {
  const chosen: Scope[] = [];
  const available = [...COMPANION_SCOPE_WEIGHTS];
  for (let i = 0; i < count && available.length > 0; i++) {
    const total = available.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (let j = 0; j < available.length; j++) {
      r -= available[j].weight;
      if (r <= 0) {
        chosen.push(available[j].scope);
        available.splice(j, 1);
        break;
      }
    }
  }
  return chosen;
}

/**
 * 📷 構図神引き：カメラを常に変更範囲に含め、印象的な特殊構図をランダムに選ぶ。
 * 顔・同一性は完全固定。毎回異なる構図を選ぶ（直近使用禁止）。
 * 「camera」スコープ + 1〜2個のコンパニオンスコープを返す。
 */
export function buildCompositionGodInputs(
  current: PromptInputs,
  memory: VariationMemory,
): { inputs: PromptInputs; compositionId: string } {
  // 直近使用を除外してフレッシュな構図を選ぶ
  const available = COMPOSITION_GOD_POOL.filter(
    (e) => !memory.recentCompositions.includes(e.id),
  );
  const pool  = available.length > 0 ? available : COMPOSITION_GOD_POOL;
  const entry = pool[Math.floor(Math.random() * pool.length)];

  // カメラ + 1〜2 コンパニオンスコープ（将来の参考用、実際のスコープはcurrent.scopesを使用）
  const companionCount: 1 | 2 = Math.random() < 0.5 ? 1 : 2;
  const companions = pickCompanionScopes(companionCount);
  void companions;

  const note = [
    "【📷 構図神引き】",
    `▼ 構図：${entry.label}`,
    `▼ ${entry.instruction}`,
    "▼ 顔・同一性・体型は完全固定。カメラ視点・フレーミング・レンズ感のみ変更する。",
    "▼ 各案で照明の色温度・強度・空気感を変えて多様性を出す。",
  ].join("\n");

  const inputs: PromptInputs = {
    ...current,
    scopes: scopeOrDefault(current, ["camera", "pose"] as Scope[]),
    moods:              entry.moods as Mood[],
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  note,
    details: {
      ...current.details,
      camera: {
        angle:       entry.camera.angle       ?? DEFAULT_DETAILS.camera.angle,
        distance:    entry.camera.distance    ?? DEFAULT_DETAILS.camera.distance,
        lens:        entry.camera.lens        ?? DEFAULT_DETAILS.camera.lens,
        composition: entry.camera.composition ?? DEFAULT_DETAILS.camera.composition,
        fov:         entry.camera.fov         ?? DEFAULT_DETAILS.camera.fov,
        eyeHeight:   entry.camera.eyeHeight   ?? DEFAULT_DETAILS.camera.eyeHeight,
        custom3D:    null,
      },
    },
  };

  return { inputs, compositionId: entry.id };
}

// ─── ワールドプリセット型 ────────────────────────────────────────────────────────
export type WorldPreset =
  | "y2k" | "y3k" | "street"
  | "cinema" | "wafuu" | "gothic"
  | "ad" | "fantasy" | "retro"
  | "jirai" | "seikimatsu";

export type EffectPreset = "fgrich" | "microcyber" | "clean";

// ── 🧬 微機械化 ─────────────────────────────────────────────────────────────────

const MICRO_PARTS = [
  "eye", "cheek", "neck", "shoulder", "hand", "finger", "hair_part", "outfit_part",
] as const;
const MICRO_TYPES = [
  "glow_circuit", "transparent_body", "hologram", "glass_mech", "nanomachine",
] as const;
const MICRO_GLOW_COLORS = [
  "blue", "cyan", "purple", "pink", "white", "gold",
] as const;

/**
 * 🧬 微機械化：戦闘系禁止。アクセサリー感ある上品な未来感を一部に追加。
 * 毎回異なる部位・タイプ・発光色を選ぶ。
 */
export function buildMicroCyberInputs(current: PromptInputs, _memory: VariationMemory): PromptInputs {
  const part      = MICRO_PARTS[Math.floor(Math.random() * MICRO_PARTS.length)];
  const type      = MICRO_TYPES[Math.floor(Math.random() * MICRO_TYPES.length)];
  const glowColor = MICRO_GLOW_COLORS[Math.floor(Math.random() * MICRO_GLOW_COLORS.length)];

  const note = [
    "【🧬 微機械化】",
    "ガチサイボーグではなく「未来的アクセサリー感」の上品な機械化。",
    "▼ 変化は一部分だけ（アクセサリーとして自然に存在する・主張しすぎない）",
    "▼ 透明感・発光感を上品に演出（高級ジュエリーのような質感）",
    "▼ 禁止：戦闘用サイボーグ・大げさな義手義足・血傷破壊表現・全身変化",
  ].join("\n");

  return {
    ...current,
    scopes:             scopeOrDefault(current, ["cyber"] as Scope[]),
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: current.autoMoodCategories,
    extraInstructions:  note,
    details: {
      ...current.details,
      cyber: {
        part,
        type,
        texture:   "transparent_glass",
        glowColor,
        intensity: "subtle",
      },
    },
  };
}

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
    scopes:             pickScopesWeighted(PW.wafuu, dir.moods, memory.lastScopes),
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
        decoration: "auto",
        luxury:     "refined",
        exposure:   "skip",
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
    scopes:             pickScopesWeighted(PW.gothic, dir.moods, memory.lastScopes),
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
        decoration: "auto",
        luxury:     "refined",
        exposure:   "skip",
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
    scopes:             pickScopesWeighted(PW.ad, dir.moods, memory.lastScopes),
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
        exposure:   "skip",
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
    scopes:             pickScopesWeighted(PW.fantasy, dir.moods, memory.lastScopes),
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
        decoration: "auto",
        luxury:     "refined",
        exposure:   "skip",
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
    scopes:             pickScopesWeighted(PW.retro, dir.moods, memory.lastScopes),
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
        decoration: "auto",
        luxury:     "refined",
        exposure:   "skip",
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

// ─── 🎨 色神引き ──────────────────────────────────────────────────────────────────

interface ColorGodDirection {
  label:       string;
  moods:       Mood[];
  outfitColor: OutfitColor;
  lightTemp:   LightTemperature;
  hint:        string;
}

const COLOR_GOD_POOL: ColorGodDirection[] = [
  { label: "レインボーグラデーション", moods: ["vivid", "sns_pop", "art"] as Mood[],            outfitColor: "gradient", lightTemp: "white_light", hint: "スペクトル全色・虹のグラデーション・鮮烈な色彩が被写体を包む。各案で異なる色帯の組み合わせを使う。" },
  { label: "モノクローム",             moods: ["monochrome", "art", "cinematic"] as Mood[],     outfitColor: "black",    lightTemp: "cool",        hint: "完全モノクローム。黒・白・グレーだけで光と影を最大限に使い、質感と輪郭で語る。" },
  { label: "ディープジュエル",         moods: ["dark", "luxe", "mystic"] as Mood[],             outfitColor: "purple",   lightTemp: "cool",        hint: "エメラルド・ルビー・サファイア・アメジストのジュエルトーン。深く豊かな宝石色を中心に。" },
  { label: "パステルドリーム",         moods: ["pastel", "translucent", "bright"] as Mood[],    outfitColor: "pink",     lightTemp: "warm",        hint: "くすみピンク・ラベンダー・ミント・クリームのパステルカラー。夢のような柔らかい色調。" },
  { label: "ゴールデンアワー",         moods: ["cinematic", "art", "retro"] as Mood[],          outfitColor: "gold",     lightTemp: "warm",        hint: "黄金の斜光・アンバー・オレンジ・金色のリムライト。映画的な黄金時間帯の光と色彩。" },
  { label: "ネオンエレクトリック",     moods: ["vivid", "cyberpunk", "near_future"] as Mood[],  outfitColor: "gradient", lightTemp: "cool",        hint: "電気的なネオン色。マゼンタ・シアン・ライム・パープルの高彩度電光色。過剰にならず印象的に。" },
  { label: "アイシーブルー",           moods: ["cool", "minimal", "translucent"] as Mood[],    outfitColor: "silver",   lightTemp: "cool",        hint: "冷たい青・銀・白の氷の色彩。透明感・清涼感・澄み切った空気感を最大表現。" },
  { label: "ウォームアース",           moods: ["cinematic", "art", "retro"] as Mood[],          outfitColor: "inherit",  lightTemp: "warm",        hint: "テラコッタ・ブラウン・カーキ・深緑のアースカラー。地に足のついた温かい色調と質感。" },
];

export function buildColorGodInputs(current: PromptInputs, memory: VariationMemory = createEmptyMemory()): PromptInputs {
  const available = COLOR_GOD_POOL.filter((c) => !c.moods.every((m) => memory.recentMoods.includes(m)));
  const pool = available.length > 0 ? available : COLOR_GOD_POOL;
  const dir  = pool[Math.floor(Math.random() * pool.length)];
  const note = [
    `【🎨 色神引き — ${dir.label}】`, dir.hint, "",
    "▼ 色彩強化ルール：",
    "  - 選ばれたパレットの色が全体を支配する（衣装・背景・光源・前景を統一した色調で）",
    "  - 各案で色の組み合わせ・比率・強調点を変えて差別化する",
    "  - 補色・類似色・モノトーンなど配色理論を活用してクオリティを高める",
    "【絶対維持】顔・表情・人物の同一性は一切変更しない。",
  ].join("\n");
  return {
    ...current, scopes: scopeOrDefault(current, ["lighting", "background", "foreground"] as Scope[]), moods: dir.moods, faceLock: true, viralMode: false, autoMoodCategories: [], extraInstructions: note,
    details: {
      ...current.details,
      outfit:  { ...current.details.outfit,   color: dir.outfitColor },
      lighting:{ ...current.details.lighting, temperature: dir.lightTemp, intensity: "dramatic" },
    },
  };
}

// ─── 🌌 世界観神引き ──────────────────────────────────────────────────────────────

interface WorldGodDirection {
  label:   string;
  moods:   Mood[];
  bgPlace: BackgroundPlace;
  hint:    string;
}

const WORLD_GOD_POOL: WorldGodDirection[] = [
  { label: "宇宙神社",   moods: ["mystic", "fantasy_world", "cinematic"] as Mood[], bgPlace: "abstract",   hint: "神社の鳥居が宇宙空間に浮かぶ。星雲・銀河・霊気が融合した幻想的な聖域。" },
  { label: "水没図書館", moods: ["dark", "fantasy", "cinematic"] as Mood[],         bgPlace: "library",    hint: "水に沈んだ古い図書館。本が水中に漂い、魚が泳ぎ、光が水面を揺らぐ幻想空間。" },
  { label: "空中庭園",   moods: ["fantasy", "translucent", "art"] as Mood[],        bgPlace: "garden",     hint: "雲の上に浮かぶ空中庭園。花・噴水・白亜の柱が空に漂う神話的な楽園。" },
  { label: "廃工場×自然",moods: ["cinematic", "art", "emo"] as Mood[],              bgPlace: "industrial", hint: "朽ちた工場を自然が飲み込む。鉄骨に絡まる植物・割れた窓から差す光・廃墟の詩情。" },
  { label: "鏡の宮殿",   moods: ["luxe", "art", "translucent"] as Mood[],           bgPlace: "abstract",   hint: "無限に続く鏡の回廊・反射と奥行きの連鎖・光が乱反射する幻惑的な宮殿空間。" },
  { label: "月面基地",   moods: ["near_future", "cool", "cinematic"] as Mood[],     bgPlace: "futuristic", hint: "月面に建設された透明ドーム基地。宇宙の黒と月の白・地球が地平線に浮かぶ光景。" },
  { label: "深海神殿",   moods: ["mystic", "dark", "art"] as Mood[],                bgPlace: "museum",     hint: "深海に沈む古代神殿。ジェリーフィッシュの発光・珊瑚・暗闇に輝く遺跡の荘厳さ。" },
  { label: "温室×降雪", moods: ["translucent", "art", "cinematic"] as Mood[],      bgPlace: "greenhouse", hint: "熱帯植物が茂る温室の中に雪が降る矛盾した美空間。ガラス越しの白と内部の緑の対比。" },
];

export function buildWorldGodInputs(current: PromptInputs, memory: VariationMemory = createEmptyMemory()): PromptInputs {
  const available = WORLD_GOD_POOL.filter((w) => !memory.recentBgPlaces.includes(w.bgPlace) && !w.moods.every((m) => memory.recentMoods.includes(m)));
  const pool = available.length > 0 ? available : WORLD_GOD_POOL;
  const dir  = pool[Math.floor(Math.random() * pool.length)];
  const note = [
    `【🌌 世界観神引き — ${dir.label}】`, dir.hint, "",
    "▼ 世界観神引きの方針：",
    "  - 選ばれた世界観を徹底的に表現する（背景・照明・前景・雰囲気の全てで）",
    "  - 現実にはあり得ない空間でも、細部のリアリティで説得力を持たせる",
    "  - 各案で世界観の異なる側面・時間帯・視点を選んで差別化する",
    "  - 量産異世界（白ドレス+桜+神社固定）は絶対禁止",
    "【絶対維持】顔・表情・人物の同一性・体型は一切変更しない。",
  ].join("\n");
  return {
    ...current, scopes: scopeOrDefault(current, ["background", "foreground", "lighting"] as Scope[]), moods: dir.moods, faceLock: true, viralMode: false, autoMoodCategories: [], extraInstructions: note,
    details: { ...current.details, background: { ...DEFAULT_DETAILS.background, place: dir.bgPlace } },
  };
}

// ─── 🎁 小物神引き ────────────────────────────────────────────────────────────────

interface PropsGodEntry {
  label:    string;
  category: PropsCategory;
  hint:     string;
  moods:    Mood[];
}

const PROPS_GOD_POOL: PropsGodEntry[] = [
  { label: "光る蝶",           category: "cute",       moods: ["fantasy", "translucent", "art"] as Mood[],   hint: "発光する蝶が被写体の周りを舞う。光の粒・幻想・儚さ。蝶の翅の精密描写。" },
  { label: "王冠と宝石",       category: "sns",        moods: ["luxe", "cinematic", "instagram"] as Mood[],  hint: "精巧な金細工の王冠・宝石の輝き・王族感。光源との反射を精密に描写する。" },
  { label: "ガラスの剣",       category: "gothic",     moods: ["dark", "art", "cinematic"] as Mood[],        hint: "透明なガラス製の剣・光の屈折・危険な美しさ。人を傷つける描写は禁止。" },
  { label: "花冠（生花）",     category: "cute",       moods: ["bright", "art", "translucent"] as Mood[],    hint: "繊細な生花を編んだ花冠・季節の花・自然の美。素材感と花の精細さを強調。" },
  { label: "ホログラム端末",   category: "futuristic", moods: ["near_future", "cool", "digital"] as Mood[],  hint: "空中に投影されるホログラム・近未来インターフェース・光の面の質感。" },
  { label: "和傘（美術品）",   category: "japanese",   moods: ["japanese", "cinematic", "art"] as Mood[],    hint: "職人技の和傘・繊細な模様・和の伝統工芸の美。光が和紙を透過する様子。" },
  { label: "鎖と薔薇",         category: "gothic",     moods: ["gothic", "dark", "decadent"] as Mood[],      hint: "金属の鎖に絡まる深紅の薔薇・美と束縛の対比。鎖の質感と薔薇の色を精密に。" },
  { label: "浮遊する本",       category: "daily",      moods: ["mystic", "art", "cinematic"] as Mood[],      hint: "無数の本が周りに浮遊する。知識・魔法・図書館的神秘。古い紙の質感。" },
  { label: "光の翼",           category: "sns",        moods: ["fantasy", "translucent", "vivid"] as Mood[], hint: "発光する羽根・光の粒が翼を形成・神秘的な浮遊感。透明感と光を最大表現。" },
  { label: "ヴィンテージカメラ",category: "daily",     moods: ["retro", "art", "cinematic"] as Mood[],       hint: "アンティークカメラ・真鍮の質感・時代を記録する機器。金属と革の素材感。" },
];

export function buildPropsGodInputs(current: PromptInputs, memory: VariationMemory = createEmptyMemory()): PromptInputs {
  const available = PROPS_GOD_POOL.filter((p) => !p.moods.every((m) => memory.recentMoods.includes(m)));
  const pool = available.length > 0 ? available : PROPS_GOD_POOL;
  const item = pool[Math.floor(Math.random() * pool.length)];
  const note = [
    `【🎁 小物神引き — ${item.label}】`, item.hint, "",
    "▼ 小物神引きの方針：",
    "  - 選ばれたアイテムを主役として際立たせる（質感・光・細部を精密に描写）",
    "  - アイテムと被写体・背景・ライティングが自然に調和する構図にする",
    "  - 各案でアイテムの見せ方・位置・光の当て方を変えて差別化する",
    "【絶対維持】顔・表情・人物の同一性は一切変更しない。",
  ].join("\n");
  return {
    ...current, scopes: scopeOrDefault(current, ["props", "lighting", "background"] as Scope[]), moods: item.moods, faceLock: true, viralMode: false, autoMoodCategories: [], extraInstructions: note,
    details: { ...current.details, props: { ...DEFAULT_DETAILS.props, category: item.category, vibe: "elegant" } },
  };
}

// ─── 🏛️ 大物神引き ───────────────────────────────────────────────────────────────

interface BigObjectGodDirection { label: string; moods: Mood[]; hint: string; }

const BIG_OBJECT_GOD_POOL: BigObjectGodDirection[] = [
  { label: "巨大クリスタル",         moods: ["mystic", "art", "translucent"] as Mood[],    hint: "人の何倍もある透明なクリスタルが背景に聳える。光の屈折・虹色の分光・神秘的な威圧感。" },
  { label: "古代石像",               moods: ["cinematic", "dark", "art"] as Mood[],        hint: "苔生した巨大な古代彫刻。時代の重み・朽ちた美・文明の遺産としての存在感。" },
  { label: "浮遊する本棚",           moods: ["mystic", "fantasy", "art"] as Mood[],        hint: "天井から地面まで続く浮遊する本棚の迷宮。重力を無視した本・知識の圧倒的な量。" },
  { label: "巨大鏡",                 moods: ["art", "luxe", "cinematic"] as Mood[],        hint: "部屋を埋め尽くす巨大な鏡。無限の反射・空間の拡張・現実と虚像の曖昧さ。" },
  { label: "錆びた巨大機械",         moods: ["cinematic", "retro", "emo"] as Mood[],       hint: "廃工場の巨大な機械装置。産業革命の遺産・朽ちた鉄・静止した歯車の詩情。" },
  { label: "花のインスタレーション", moods: ["art", "vivid", "instagram"] as Mood[],       hint: "部屋全体を埋め尽くす生花のアートインスタレーション。色彩・自然の圧倒的な量。" },
  { label: "グランドピアノ",         moods: ["art", "luxe", "emo"] as Mood[],              hint: "ステージを支配するグランドピアノ。黒い鏡面・鍵盤の白・芸術の権威と美。" },
  { label: "巨大水族館の壁",         moods: ["cinematic", "translucent", "mystic"] as Mood[],hint: "巨大な水族館の壁を背景に。海洋生物・青い光・水中の静けさと神秘。" },
];

export function buildBigObjectGodInputs(current: PromptInputs, memory: VariationMemory = createEmptyMemory()): PromptInputs {
  const available = BIG_OBJECT_GOD_POOL.filter((d) => !d.moods.every((m) => memory.recentMoods.includes(m)));
  const pool = available.length > 0 ? available : BIG_OBJECT_GOD_POOL;
  const dir  = pool[Math.floor(Math.random() * pool.length)];
  const note = [
    `【🏛️ 大物神引き — ${dir.label}】`, dir.hint, "",
    "▼ 大物神引きの方針：",
    "  - 選ばれた大物を画面の主軸として配置し、被写体との関係性で画面を構成する",
    "  - スケール感・質感・存在感を最大化する（細部まで精密に描写）",
    "  - 各案で大物の向き・被写体との距離・光の当て方を変えて差別化する",
    "【絶対維持】顔・表情・人物の同一性・体型は一切変更しない。",
  ].join("\n");
  return { ...current, scopes: scopeOrDefault(current, ["big_object", "background", "lighting"] as Scope[]), moods: dir.moods, faceLock: true, viralMode: false, autoMoodCategories: [], extraInstructions: note };
}

// ─── 🐉 神話神引き ────────────────────────────────────────────────────────────────

interface MythGodDirection { label: string; moods: Mood[]; bgPlace: BackgroundPlace; hint: string; }

const MYTH_GOD_POOL: MythGodDirection[] = [
  { label: "白龍",       moods: ["mystic", "fantasy_world", "cinematic"] as Mood[], bgPlace: "abstract",      hint: "神話的な白龍・雲を割る巨体・白と金の鱗・威厳と神秘を兼ね備えた存在。" },
  { label: "鳳凰",       moods: ["wa_fantasy", "vivid", "art"] as Mood[],           bgPlace: "abstract",      hint: "炎と光の翼を持つ鳳凰・再生と不死・金と赤の圧倒的な存在感。" },
  { label: "人魚姫",     moods: ["translucent", "fantasy", "art"] as Mood[],        bgPlace: "abstract",      hint: "水中の人魚・光の屈折・気泡・神秘的な深海の美しさ。尾の鱗の精密描写。" },
  { label: "天使",       moods: ["bright", "art", "translucent"] as Mood[],         bgPlace: "abstract",      hint: "白い大きな羽・後光・神聖な光。写実的でありながら神話的な天使の荘厳さ。" },
  { label: "白狐の化身", moods: ["japanese", "mystic", "art"] as Mood[],            bgPlace: "japanese_room", hint: "複数の尾を持つ白狐。和の霊力・狐火・神社の空気感・妖艶な化身の存在感。" },
  { label: "花の精霊",   moods: ["fantasy", "translucent", "bright"] as Mood[],     bgPlace: "forest",        hint: "花々から生まれた精霊・花びらと光が体を構成・儚くも力強い自然の化身。" },
  { label: "月の女神",   moods: ["mystic", "art", "cinematic"] as Mood[],           bgPlace: "abstract",      hint: "月光を纏った女神・白銀の光輪・夜空と月・神話的な月の守護者。" },
  { label: "セイレーン", moods: ["dark", "mystic", "cinematic"] as Mood[],          bgPlace: "abstract",      hint: "嵐の海に現れる海の精・波・霧・謎めいた美しさと危険の同居。" },
];

export function buildMythGodInputs(current: PromptInputs, memory: VariationMemory = createEmptyMemory()): PromptInputs {
  const available = MYTH_GOD_POOL.filter((d) => !memory.recentBgPlaces.includes(d.bgPlace) && !d.moods.every((m) => memory.recentMoods.includes(m)));
  const pool = available.length > 0 ? available : MYTH_GOD_POOL;
  const dir  = pool[Math.floor(Math.random() * pool.length)];
  const note = [
    `【🐉 神話神引き — ${dir.label}】`, dir.hint, "",
    "▼ 神話神引きの方針：",
    "  - 神話的存在を写実的かつ芸術的に表現する（量産テンプレ禁止）",
    "  - 被写体と神話的存在の関係・スケール感・光の演出で世界観を完成させる",
    "  - 各案で存在の向き・被写体との配置・光源を変えて差別化する",
    "  - 過剰なエフェクト・ゲーム的な演出は避け、神話的な荘厳さを優先する",
    "【絶対維持】顔・表情・人物の同一性・体型は一切変更しない。",
  ].join("\n");
  return {
    ...current, scopes: scopeOrDefault(current, ["myth", "background", "lighting"] as Scope[]), moods: dir.moods, faceLock: true, viralMode: false, autoMoodCategories: [], extraInstructions: note,
    details: { ...current.details, background: { ...DEFAULT_DETAILS.background, place: dir.bgPlace } },
  };
}

// ─── 🎬 映画神引き ────────────────────────────────────────────────────────────────

interface MovieGodDirection { label: string; moods: Mood[]; bgPlace: BackgroundPlace; outfitStyle: OutfitStyle; lens: CameraLens; hint: string; }

const MOVIE_GOD_POOL: MovieGodDirection[] = [
  { label: "ノワール",              moods: ["dark", "cinematic", "monochrome"] as Mood[],    bgPlace: "alley",         outfitStyle: "mode",      lens: "cinema",   hint: "1940年代フィルムノワール。雨濡れの路地・煙草の煙・縦型の影・モノクローム映画的な世界。" },
  { label: "SF叙事詩",              moods: ["near_future", "cinematic", "cool"] as Mood[],   bgPlace: "futuristic",    outfitStyle: "techwear",  lens: "cinema",   hint: "銀河・宇宙船・壮大なスケール・英雄的な孤独感。過剰なブレードランナー感は禁止。" },
  { label: "ゴシックホラー",        moods: ["dark", "gothic", "cinematic"] as Mood[],        bgPlace: "industrial",    outfitStyle: "gothic",    lens: "cinema",   hint: "ゴシックホラー映画。不気味な光・長い影・廃墟・恐怖と美の拮抗。" },
  { label: "香港映画（詩情派）",   moods: ["cinematic", "emo", "retro"] as Mood[],           bgPlace: "indoor",        outfitStyle: "mode",      lens: "normal",   hint: "香港映画的な詩情。長時間露光・余白の多い構図・孤独と欲望の交差。" },
  { label: "西部劇",                moods: ["cinematic", "retro", "street"] as Mood[],       bgPlace: "rooftop",       outfitStyle: "military",  lens: "normal",   hint: "荒野の夕暮れ・砂埃・正義と悪の緊張・ウェスタン映画の英雄的な孤独。" },
  { label: "スパイ映画",            moods: ["cool", "cinematic", "luxe"] as Mood[],           bgPlace: "indoor",        outfitStyle: "mode",      lens: "portrait", hint: "Bond映画的なエレガンス。夜のバー・ガラス・スーツ・危険と魅力の同居。" },
  { label: "日本映画（黒澤風）",   moods: ["japanese", "cinematic", "dark"] as Mood[],       bgPlace: "japanese_room", outfitStyle: "wa_modern", lens: "cinema",   hint: "黒澤映画的な強い光と影・雨・凛としたたたずまい・時代の重み。" },
  { label: "イタリア・ネオリアリズモ",moods: ["cinematic", "emo", "art"] as Mood[],          bgPlace: "alley",         outfitStyle: "street",    lens: "normal",   hint: "路地・自然光・普通の人の顔・詩的なリアリズム・人間の尊厳と美しさ。" },
];

export function buildMovieGodInputs(current: PromptInputs, memory: VariationMemory = createEmptyMemory()): PromptInputs {
  const available = MOVIE_GOD_POOL.filter((d) => !memory.recentBgPlaces.includes(d.bgPlace) && !d.moods.every((m) => memory.recentMoods.includes(m)));
  const pool = available.length > 0 ? available : MOVIE_GOD_POOL;
  const dir  = pool[Math.floor(Math.random() * pool.length)];
  const note = [
    `【🎬 映画神引き — ${dir.label}】`, dir.hint, "",
    "▼ 映画神引きの方針：",
    "  - 選ばれた映画ジャンルの美学を徹底的に表現する",
    "  - 映画的なフレーミング・照明・色調で「映画のワンシーン」レベルを目指す",
    "  - 各案でジャンルの異なる側面・時間帯・感情を表現して差別化する",
    "【絶対維持】顔・表情・人物の同一性・体型は一切変更しない。",
  ].join("\n");
  return {
    ...current, scopes: scopeOrDefault(current, ["background", "camera", "lighting"] as Scope[]), moods: dir.moods, faceLock: true, viralMode: false, autoMoodCategories: [], extraInstructions: note,
    details: {
      ...current.details,
      outfit:     { ...current.details.outfit,     style: dir.outfitStyle },
      background: { ...DEFAULT_DETAILS.background, place: dir.bgPlace },
      camera:     { ...current.details.camera,     lens: dir.lens, composition: "rule_of_thirds" as CameraComposition },
      lighting:   { ...current.details.lighting,   intensity: "dramatic", atmosphere: "hazy" },
    },
  };
}

// ─── 🖤 地雷系 ─────────────────────────────────────────────────────────────────

interface JiraiDirection {
  label:          string;
  moods:          Mood[];
  outfitStyle:    OutfitStyle;
  outfitColor:    OutfitColor;
  outfitMaterial: OutfitMaterial;
  hairStyle:      HairStyle;
  bgPlace:        BackgroundPlace;
  extraHint:      string;
}

const JIRAI_DIRECTIONS: JiraiDirection[] = [
  {
    label:          "かわいい×ダーク地雷",
    moods:          ["cute", "dark", "emo"] as Mood[],
    outfitStyle:    "dress",
    outfitColor:    "black",
    outfitMaterial: "chiffon",
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
    scopes:             pickScopesWeighted(PW.jirai, dir.moods, memory.lastScopes),
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
        decoration: "moderate",
        luxury:     "refined",
        exposure:   "skip",
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
    scopes:             pickScopesWeighted(PW.seikimatsu, dir.moods, memory.lastScopes),
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
        exposure:   "skip",
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

type EffectBuilder = (current: PromptInputs, memory: VariationMemory) => PromptInputs;

const EFFECT_BUILDERS: Record<EffectPreset, EffectBuilder> = {
  fgrich:     buildForegroundRichInputs,
  microcyber: buildMicroCyberInputs,
  clean:      buildCleanInputs,
};

/**
 * 複数の演出プリセットを合成する。
 * - 1つだけ → 通常ビルダー
 * - 複数 → スコープをユニオン、最後のビルダーの設定をベースに指示文を連結
 */
export function buildCombinedEffectInputs(
  current: PromptInputs,
  effects: EffectPreset[],
  memory: VariationMemory,
): PromptInputs {
  if (effects.length === 0) return current;
  if (effects.length === 1) return EFFECT_BUILDERS[effects[0]](current, memory);

  const built = effects.map((e) => EFFECT_BUILDERS[e](current, memory));
  const last  = built[built.length - 1];

  const mergedScopes = [...new Set(built.flatMap((b) => b.scopes))] as Scope[];
  const mergedMoods  = [...new Set(built.flatMap((b) => b.moods))].slice(0, 6) as Mood[];
  const notes = built.map((b) => b.extraInstructions ?? "").filter(Boolean).join("\n\n");

  return {
    ...last,
    scopes: mergedScopes,
    moods:  mergedMoods.length > 0 ? mergedMoods : last.moods,
    extraInstructions: notes || last.extraInstructions,
  };
}

// ─── 👑 神引きコンボ ──────────────────────────────────────────────────────────

/** 神引きモードの表示ラベル（combineable + solo 共通）。表示名は QuickActions.GOD_DISPLAY / ReflectionStatusBar.GOD_JP と揃える */
export const GOD_MODE_DISPLAY: Record<string, string> = {
  normal:      "👑 強力おまかせ",
  chaos:       "🎲 ぶっ飛び融合",
  outfit:      "🧥 衣装",
  bg:          "🌍 背景",
  composition: "📷 構図",
  color:       "🎨 色",
  world_god:   "🌌 異世界ガチャ",
  props:       "🎁 小物",
  bigobject:   "🏛️ 大物",
  myth:        "🐉 神話",
  movie:       "🎬 映画",
};

type CombineableGodMode = "outfit" | "bg" | "color" | "world_god" | "props" | "bigobject" | "myth" | "movie";

const COMBINEABLE_GOD_BUILDERS: Record<CombineableGodMode, (c: PromptInputs, m: VariationMemory) => PromptInputs> = {
  outfit:    buildOutfitGodInputs,
  bg:        buildBgGodInputs,
  color:     buildColorGodInputs,
  world_god: buildWorldGodInputs,
  props:     buildPropsGodInputs,
  bigobject: buildBigObjectGodInputs,
  myth:      buildMythGodInputs,
  movie:     buildMovieGodInputs,
};

/**
 * 複数の神引きモード（outfit/bg/color/world_god/props/bigobject/myth/movie）を融合する。
 * normal/chaos/composition は solo 専用なので呼び出し側で事前に処理すること。
 */
export function buildCombinedGodInputs(
  current: PromptInputs,
  modes: string[],
  memory: VariationMemory,
): PromptInputs {
  const combineable = modes.filter((m): m is CombineableGodMode => m in COMBINEABLE_GOD_BUILDERS);
  if (combineable.length === 0) return current;
  if (combineable.length === 1) return COMBINEABLE_GOD_BUILDERS[combineable[0]](current, memory);

  const built = combineable.map((m) => COMBINEABLE_GOD_BUILDERS[m](current, memory));
  const mergedScopes = [...new Set(built.flatMap((b) => b.scopes))] as Scope[];
  const mergedMoods  = [...new Set(built.flatMap((b) => b.moods))].slice(0, 6) as Mood[];
  const labels = combineable.map((m) => GOD_MODE_DISPLAY[m] ?? m);
  const notes  = built.map((b) => b.extraInstructions ?? "").filter(Boolean).join("\n\n");

  return {
    ...current,
    scopes:             mergedScopes,
    moods:              mergedMoods,
    details:            AUTO_DETAILS,
    faceLock:           true,
    viralMode:          false,
    autoMoodCategories: [],
    extraInstructions:  `【👑 神引きコンボ：${labels.join(" × ")}】\n各要素を自然に融合させること。\n\n${notes}`,
  };
}

// ─── 生成補助コンボ（ギャップ化 + 量産回避）──────────────────────────────────

/**
 * 複数の生成補助モード（"gap" | "anti"）を融合する。
 * - 1つ → 通常ビルダー
 * - 両方 → スコープ・ムードをマージ、ギャップ化の衣装設定 + 量産回避の背景・カメラ設定を合成
 */
export function buildCombinedAssistInputs(
  current: PromptInputs,
  modes: string[],
  memory: VariationMemory,
): PromptInputs {
  if (modes.length === 0) return current;
  if (modes.length === 1) {
    if (modes[0] === "gap")  return buildGapInputs(current, memory);
    if (modes[0] === "anti") return buildAntiTemplateInputs(current, memory);
    return current;
  }

  const gapBuilt  = buildGapInputs(current, memory);
  const antiBuilt = buildAntiTemplateInputs(current, memory);
  const mergedScopes = [...new Set([...gapBuilt.scopes, ...antiBuilt.scopes])] as Scope[];
  const mergedMoods  = [...new Set([...gapBuilt.moods,  ...antiBuilt.moods])].slice(0, 5) as Mood[];
  const notes = [gapBuilt.extraInstructions, antiBuilt.extraInstructions].filter(Boolean).join("\n\n");

  return {
    ...gapBuilt,
    scopes:            mergedScopes,
    moods:             mergedMoods,
    extraInstructions: `【🎭×🧪 ギャップ化＋量産回避コンボ】\nギャップ方向に振りつつ量産AIパターンを徹底回避する。\n\n${notes}`,
    details: {
      ...gapBuilt.details,
      background: antiBuilt.details.background,
      camera:     antiBuilt.details.camera,
    },
  };
}

