/**
 * カオス神引きエンジン
 *
 * 「普段あり得ない組み合わせ」を強制的に融合させ、意外性ある世界観を生成する。
 * ルール：
 *   - 無難な組み合わせ禁止
 *   - AIテンプレ（青紫未来 / クリスタル / 女神ドレス）禁止
 *   - 最低 3 カテゴリを強制混合
 *   - 毎回完全に異なる結果
 */

import type { BackgroundPlace, Count, Mood, OutfitStyle, Scope } from "../types";
import type { PromptInputs } from "../types";
import { type VariationMemory, createEmptyMemory } from "./variationEngine";
import { AUTO_DETAILS } from "../types";

// ── カテゴリ定義（互いに独立した次元） ──────────────────────────────────────────

type ChaosCategory =
  | "era"          // 時代軸
  | "environment"  // 空間・環境軸
  | "genre"        // ジャンル軸
  | "aesthetic";   // 審美観軸

interface ChaosWorld {
  readonly id:          string;
  readonly label:       string;          // 表示名
  readonly category:    ChaosCategory;
  readonly moods:       readonly Mood[];
  readonly bgPlaces:    readonly BackgroundPlace[];
  readonly outfitStyles: readonly OutfitStyle[];
  /** スコープ別相対重み（0 省略 = 非選択） */
  readonly scopeBoost:  Partial<Record<Scope, number>>;
  /** 世界観説明（プロンプト注入用） */
  readonly description: string;
}

// ── カオスワールド一覧 ────────────────────────────────────────────────────────

const CHAOS_WORLDS: readonly ChaosWorld[] = [

  // ────────────────── 時代軸 ────────────────────────────────────────────────────

  {
    id: "edo", label: "江戸", category: "era",
    moods:       ["japanese", "dark", "mystic"] as Mood[],
    bgPlaces:    ["japanese_room", "garden"] as BackgroundPlace[],
    outfitStyles: ["japanese", "wa_modern"] as OutfitStyle[],
    scopeBoost:  { background: 9, outfit: 9, myth: 7, props: 6 },
    description:  "江戸時代の空間・建築・衣装・風情",
  },
  {
    id: "showa", label: "昭和", category: "era",
    moods:       ["retro", "noisy", "pop"] as Mood[],
    bgPlaces:    ["old_cinema", "indoor"] as BackgroundPlace[],
    outfitStyles: ["street", "mode"] as OutfitStyle[],
    scopeBoost:  { background: 8, outfit: 7, lighting: 7, props: 8 },
    description:  "昭和の映画・街並み・雑多な生活感",
  },
  {
    id: "medieval", label: "中世欧州", category: "era",
    moods:       ["gothic", "dark", "cinematic"] as Mood[],
    bgPlaces:    ["museum", "library"] as BackgroundPlace[],
    outfitStyles: ["gothic", "armor"] as OutfitStyle[],
    scopeBoost:  { background: 9, outfit: 9, lighting: 7, camera: 6 },
    description:  "中世ヨーロッパの城・教会・重厚な甲冑・石の空間",
  },
  {
    id: "taisho", label: "大正ロマン", category: "era",
    moods:       ["retro", "art", "mystic"] as Mood[],
    bgPlaces:    ["japanese_room", "library"] as BackgroundPlace[],
    outfitStyles: ["japanese", "wa_modern"] as OutfitStyle[],
    scopeBoost:  { background: 8, outfit: 8, hair: 7, props: 6 },
    description:  "大正ロマン：洋館・着物洋装ミックス・瓦斯灯",
  },

  // ────────────────── 空間・環境軸 ──────────────────────────────────────────────

  {
    id: "underwater", label: "水中世界", category: "environment",
    moods:       ["mystic", "translucent", "art"] as Mood[],
    bgPlaces:    ["abstract", "nature"] as BackgroundPlace[],
    outfitStyles: ["future_dress", "mode"] as OutfitStyle[],
    scopeBoost:  { background: 10, foreground: 9, lighting: 8, myth: 5 },
    description:  "深海・珊瑚・水中空間・揺らめく光と影",
  },
  {
    id: "industrial", label: "廃工場", category: "environment",
    moods:       ["dark", "cinematic", "emo"] as Mood[],
    bgPlaces:    ["industrial"] as BackgroundPlace[],
    outfitStyles: ["techwear", "military"] as OutfitStyle[],
    scopeBoost:  { background: 9, lighting: 8, outfit: 6, camera: 7 },
    description:  "廃墟工場・錆・煙・廃材・荒廃した産業空間",
  },
  {
    id: "space", label: "宇宙空間", category: "environment",
    moods:       ["near_future", "cinematic", "vivid"] as Mood[],
    bgPlaces:    ["abstract", "futuristic"] as BackgroundPlace[],
    outfitStyles: ["techwear", "future_dress"] as OutfitStyle[],
    scopeBoost:  { background: 10, lighting: 8, outfit: 5, foreground: 6 },
    description:  "宇宙・星雲・無重力・星の光・深宇宙の孤独感",
  },
  {
    id: "greenhouse", label: "温室・植物園", category: "environment",
    moods:       ["art", "bright", "translucent"] as Mood[],
    bgPlaces:    ["greenhouse", "garden"] as BackgroundPlace[],
    outfitStyles: ["dress", "mode"] as OutfitStyle[],
    scopeBoost:  { background: 9, foreground: 7, lighting: 8, props: 6 },
    description:  "温室・鉄骨ガラス・南国植物・湿った空気・熱帯色",
  },
  {
    id: "hospital", label: "病院・医療", category: "environment",
    moods:       ["clean", "minimal", "emo"] as Mood[],
    bgPlaces:    ["indoor"] as BackgroundPlace[],
    outfitStyles: ["uniform", "mode"] as OutfitStyle[],
    scopeBoost:  { background: 8, outfit: 7, lighting: 9, props: 6 },
    description:  "病院の廊下・白い壁・無機質な蛍光灯・医療用品",
  },
  {
    id: "amusement", label: "遊園地・廃墟遊園地", category: "environment",
    moods:       ["noisy", "vivid", "dark"] as Mood[],
    bgPlaces:    ["night_amusement"] as BackgroundPlace[],
    outfitStyles: ["street", "lolita"] as OutfitStyle[],
    scopeBoost:  { background: 10, foreground: 7, lighting: 7, props: 8 },
    description:  "遊園地・観覧車・カーニバル・退廃した夢の跡地",
  },
  {
    id: "train_station", label: "駅・鉄道", category: "environment",
    moods:       ["cinematic", "retro", "emo"] as Mood[],
    bgPlaces:    ["rainy_station"] as BackgroundPlace[],
    outfitStyles: ["mode", "street"] as OutfitStyle[],
    scopeBoost:  { background: 9, camera: 8, lighting: 7, props: 5 },
    description:  "雨の駅・電車のホーム・蒸気・光の反射・出発と別れ",
  },

  // ────────────────── ジャンル軸 ─────────────────────────────────────────────────

  {
    id: "military", label: "ミリタリー", category: "genre",
    moods:       ["cool", "dark", "cinematic"] as Mood[],
    bgPlaces:    ["industrial", "rooftop"] as BackgroundPlace[],
    outfitStyles: ["military", "techwear"] as OutfitStyle[],
    scopeBoost:  { outfit: 9, background: 7, camera: 8, props: 7 },
    description:  "ミリタリー・戦術装備・砂漠・ジャングル・作戦行動",
  },
  {
    id: "sports", label: "スポーツ・競技", category: "genre",
    moods:       ["vivid", "bright", "cool"] as Mood[],
    bgPlaces:    ["indoor", "rooftop"] as BackgroundPlace[],
    outfitStyles: ["techwear", "street"] as OutfitStyle[],
    scopeBoost:  { outfit: 8, pose: 9, camera: 7, background: 6 },
    description:  "スポーツ競技・アスリート・スタジアム・躍動",
  },
  {
    id: "fashion_mag", label: "ファッション誌", category: "genre",
    moods:       ["luxe", "ad_visual", "magazine_cover"] as Mood[],
    bgPlaces:    ["studio", "atelier"] as BackgroundPlace[],
    outfitStyles: ["runway", "mode"] as OutfitStyle[],
    scopeBoost:  { outfit: 8, camera: 9, lighting: 9, hair: 6 },
    description:  "ファッション誌・ハイエンド広告・クリーンスタジオ",
  },
  {
    id: "horror", label: "ホラー・怪談", category: "genre",
    moods:       ["dark", "emo", "mystic"] as Mood[],
    bgPlaces:    ["forest", "library"] as BackgroundPlace[],
    outfitStyles: ["gothic", "dress"] as OutfitStyle[],
    scopeBoost:  { background: 9, lighting: 10, foreground: 7, outfit: 6 },
    description:  "ホラー・和怪談・闇・霧・呪い・古い屋敷の空気",
  },
  {
    id: "luxury_brand", label: "高級ブランド", category: "genre",
    moods:       ["luxe", "stylish", "cinematic"] as Mood[],
    bgPlaces:    ["atelier", "gallery"] as BackgroundPlace[],
    outfitStyles: ["runway", "mode"] as OutfitStyle[],
    scopeBoost:  { outfit: 10, camera: 8, lighting: 8, props: 7 },
    description:  "ハイジュエリー・クチュール・大理石空間・ラグジュアリー",
  },

  // ────────────────── 審美観軸 ───────────────────────────────────────────────────

  {
    id: "biomechanical", label: "生体機械", category: "aesthetic",
    moods:       ["dark", "near_future", "art"] as Mood[],
    bgPlaces:    ["industrial", "abstract"] as BackgroundPlace[],
    outfitStyles: ["cyber", "armor"] as OutfitStyle[],
    scopeBoost:  { cyber: 10, outfit: 7, background: 7, foreground: 6 },
    description:  "生体機械融合・H.R.ギーガー的・骨格と機械の共存",
  },
  {
    id: "folklore", label: "民族・神話", category: "aesthetic",
    moods:       ["wa_fantasy", "mystic", "art"] as Mood[],
    bgPlaces:    ["nature", "forest"] as BackgroundPlace[],
    outfitStyles: ["japanese", "armor"] as OutfitStyle[],
    scopeBoost:  { myth: 9, outfit: 8, background: 8, props: 7 },
    description:  "世界各地の神話・民族衣装・儀式・精霊・伝承の世界",
  },
  {
    id: "brutalist", label: "ブルータリズム", category: "aesthetic",
    moods:       ["architectural", "monochrome", "minimal"] as Mood[],
    bgPlaces:    ["abstract", "museum"] as BackgroundPlace[],
    outfitStyles: ["mode", "street"] as OutfitStyle[],
    scopeBoost:  { background: 10, camera: 9, lighting: 7, outfit: 5 },
    description:  "ブルータリスト建築・コンクリート・荒削りな幾何学空間",
  },
  {
    id: "kawaii_dark", label: "ダークかわいい", category: "aesthetic",
    moods:       ["cute", "dark", "decadent"] as Mood[],
    bgPlaces:    ["indoor", "frosted_room"] as BackgroundPlace[],
    outfitStyles: ["lolita", "gothic"] as OutfitStyle[],
    scopeBoost:  { outfit: 9, hair: 8, foreground: 7, lighting: 6 },
    description:  "かわいいとダークが同居する退廃的少女美・ダークロリータ",
  },
  {
    id: "surrealist", label: "シュルレアリスム", category: "aesthetic",
    moods:       ["art", "mystic", "fantasy_world"] as Mood[],
    bgPlaces:    ["abstract", "nature"] as BackgroundPlace[],
    outfitStyles: ["mode", "future_dress"] as OutfitStyle[],
    scopeBoost:  { background: 10, foreground: 9, camera: 7, lighting: 7 },
    description:  "シュルレアリスム・夢と現実の境界・非現実的な空間",
  },
  {
    id: "wabi_sabi", label: "侘び寂び", category: "aesthetic",
    moods:       ["minimal", "art", "ephemeral"] as Mood[],
    bgPlaces:    ["japanese_room", "garden"] as BackgroundPlace[],
    outfitStyles: ["japanese", "mode"] as OutfitStyle[],
    scopeBoost:  { background: 9, lighting: 8, outfit: 6, props: 7 },
    description:  "侘び寂び・不完全の美・枯れた空間・茶の湯的審美",
  },
  {
    id: "afrofuturism", label: "アフロフューチャリズム", category: "aesthetic",
    moods:       ["vivid", "near_future", "art"] as Mood[],
    bgPlaces:    ["futuristic", "abstract"] as BackgroundPlace[],
    outfitStyles: ["runway", "armor"] as OutfitStyle[],
    scopeBoost:  { outfit: 10, background: 8, lighting: 8, hair: 7 },
    description:  "アフロフューチャリズム・鮮烈な色・民族と宇宙の融合",
  },
];

// ── カオス禁止組み合わせ（自然に合いすぎる NG ペア） ──────────────────────────

/** 「同カテゴリから 2 つ選ばない」が基本ルールだが、
 *  それ以外にも「当たり前すぎる融合」は禁止する。 */
const FORBIDDEN_COMBOS: ReadonlyArray<readonly [string, string]> = [
  ["military", "industrial"],    // 軍事×工場は普通
  ["fashion_mag", "luxury_brand"], // ファッション誌×高級は自明
  ["edo", "taisho"],             // 江戸×大正は近すぎる
  ["gothic", "horror"],          // 内部で implicit だが念のため
  ["medieval", "folklore"],      // 重複感が強い
];

function isForbiddenCombo(ids: string[]): boolean {
  for (const [a, b] of FORBIDDEN_COMBOS) {
    if (ids.includes(a) && ids.includes(b)) return true;
  }
  return false;
}

// ── スコープ抽選 ─────────────────────────────────────────────────────────────

const CHAOS_SCOPE_POOL: readonly Scope[] = [
  "background", "foreground", "pose", "hair", "outfit",
  "cosplay", "cyber", "camera", "props", "vehicle", "myth", "lighting",
];

export function pickChaosScopes(
  worlds: readonly ChaosWorld[],
  lastScopes: readonly string[],
): Scope[] {
  // マージした重み
  const w: Partial<Record<string, number>> = {};
  for (const world of worlds) {
    for (const [s, v] of Object.entries(world.scopeBoost)) {
      w[s] = ((w[s] as number | undefined) ?? 0) + (v as number);
    }
  }

  // カオスは全体的に高め（最低 4 に底上げ）
  for (const s of CHAOS_SCOPE_POOL) {
    w[s] = Math.max((w[s] as number | undefined) ?? 0, 4);
  }

  // lastScopes ペナルティ
  const lastSet = new Set(lastScopes);
  for (const s of CHAOS_SCOPE_POOL) {
    if (lastSet.has(s)) w[s] = Math.max(1, Math.floor(((w[s] as number | undefined) ?? 1) * 0.4));
  }

  // 4〜6 個選出
  const count = 4 + Math.floor(Math.random() * 3);
  const pool  = CHAOS_SCOPE_POOL.filter((s) => (w[s] ?? 0) > 0);
  const chosen = new Set<Scope>();

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

  // 直前と同一なら 1 要素を置き換え
  if (result.length === lastScopes.length && result.every((s) => lastSet.has(s))) {
    const rest = pool.filter((s) => !chosen.has(s));
    if (rest.length > 0) result[0] = rest[Math.floor(Math.random() * rest.length)];
  }

  return result;
}

// ── カオスワールド選択 ────────────────────────────────────────────────────────

/** 3〜4 のカオスワールドを選ぶ（異カテゴリ必須・禁止コンボ回避） */
function pickChaosWorlds(): ChaosWorld[] {
  const ALL_CATEGORIES: ChaosCategory[] = ["era", "environment", "genre", "aesthetic"];

  // カテゴリシャッフル
  const shuffledCats = [...ALL_CATEGORIES].sort(() => Math.random() - 0.5);

  // 各カテゴリから 1 世界選出して最大 4 世界候補を作る
  const selected: ChaosWorld[] = [];
  const wantCount = Math.random() < 0.4 ? 4 : 3;

  for (const cat of shuffledCats) {
    if (selected.length >= wantCount) break;

    const pool = CHAOS_WORLDS.filter((w) => w.category === cat);
    if (pool.length === 0) continue;

    // ランダムに選択
    const candidate = pool[Math.floor(Math.random() * pool.length)];

    // 禁止コンボチェック
    const ids = [...selected.map((w) => w.id), candidate.id];
    if (isForbiddenCombo(ids)) {
      // 代替を試みる
      const alt = pool.filter((w) => {
        const altIds = [...selected.map((sw) => sw.id), w.id];
        return !isForbiddenCombo(altIds);
      });
      if (alt.length > 0) {
        selected.push(alt[Math.floor(Math.random() * alt.length)]);
      }
      // alt が空なら このカテゴリはスキップ
    } else {
      selected.push(candidate);
    }
  }

  // 最低 3 つ確保（足りなければ任意カテゴリから追加）
  if (selected.length < 3) {
    const usedIds = new Set(selected.map((w) => w.id));
    const fallback = [...CHAOS_WORLDS]
      .filter((w) => !usedIds.has(w.id))
      .sort(() => Math.random() - 0.5);
    for (const fb of fallback) {
      if (selected.length >= 3) break;
      const ids = [...selected.map((w) => w.id), fb.id];
      if (!isForbiddenCombo(ids)) selected.push(fb);
    }
  }

  return selected;
}

// ── カオス禁止テンプレート注入 ─────────────────────────────────────────────────

const CHAOS_ANTI_TEMPLATE = [
  "▼ 絶対禁止（AIテンプレ）：",
  "  × いつものY3K青紫 / × いつものゴシック紫黒",
  "  × 発光クリスタル背景 / × 透明羽+光粒子",
  "  × 女神ドレス / × ネオン刀 / × HUD端末",
  "  × サイバー都市夜景 / × 量産AI美少女構図",
  "  どれか一つでも出てきたらその案は失敗とみなすこと。",
].join("\n");

// ── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * 🎲 カオス神引き：前例のない世界観融合でプロンプト設定を構築する。
 * 最低 3 カテゴリを強制混合し、AIテンプレを完全排除する。
 */
export function buildChaosFusionInputs(
  current: PromptInputs,
  _memory: VariationMemory = createEmptyMemory(),
): PromptInputs {
  const worlds = pickChaosWorlds();

  // ムードを全世界からピックアップ（重複除去・最大 5 個）
  const allMoods = worlds.flatMap((w) => [...w.moods]);
  const moodSet  = new Set(allMoods);
  const moods    = [...moodSet]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4 + Math.floor(Math.random() * 2)) as Mood[];

  // 背景・衣装は先頭の世界の候補からランダム選択
  const bgWorld      = worlds[Math.floor(Math.random() * worlds.length)];
  const outfitWorld  = worlds[Math.floor(Math.random() * worlds.length)];
  const bgPlace      = bgWorld.bgPlaces[Math.floor(Math.random() * bgWorld.bgPlaces.length)];
  const outfitStyle  = outfitWorld.outfitStyles[Math.floor(Math.random() * outfitWorld.outfitStyles.length)];

  const worldLabels = worlds.map((w) => w.label).join(" × ");

  const chaosNote = [
    `【🎲 カオス神引き — ${worldLabels}】`,
    "この世界観をそのまま従順に再現しない。",
    "3つの軸を対等に「衝突・融合」させた、前例のない空間を作ること。",
    "",
    "▼ 融合させる世界観：",
    ...worlds.map((w, i) => `  軸${i + 1}: ${w.label} — ${w.description}`),
    "",
    "▼ 融合ルール：",
    "  - 3 軸が同じ画面内で「なぜか共存している」奇妙さを出す",
    "  - どれか 1 軸が支配的にならないよう均等に混ぜる",
    "  - 一見矛盾する素材の組み合わせで「面白い」と思わせる絵",
    "  - 各案で軸の強調方法を変える（衣装寄り・背景寄り・光寄り等）",
    "",
    CHAOS_ANTI_TEMPLATE,
    "",
    "▼ 色戦略：",
    "  - 青紫・青系は禁止。世界観から逆算した独自配色を使う",
    "  - 各案で色の主役を変える（赤系・土系・緑系・金系 等）",
    "",
    "▼ 構図：",
    "  - 正面シンメトリー禁止。奇抜な角度・余白・緊張感のある構図を選ぶ",
    "  - 顔・表情・人物の同一性は絶対維持。体型・ポーズ変更可。",
  ].join("\n");

  return {
    ...current,
    scopes:             current.scopes.length > 0 ? current.scopes : pickChaosScopes(worlds, _memory.lastScopes),
    moods,
    count:              4 as Count,
    details:            {
      ...AUTO_DETAILS,
      background: { ...AUTO_DETAILS.background, place: bgPlace },
      outfit:     { ...AUTO_DETAILS.outfit,     style: outfitStyle },
    },
    faceLock:           true,
    viralMode:          true,
    extraInstructions:  chaosNote,
    autoMoodCategories: [],
  };
}

/** カオス神引きで使用されたワールドのラベル文字列を返す（UI表示用） */
export function formatChaosLabel(note: string): string {
  const m = note.match(/カオス神引き — (.+?)】/);
  return m ? m[1] : "カオス融合";
}
