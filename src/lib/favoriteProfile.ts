/**
 * お気に入り学習：好みプロファイル生成
 *
 * お気に入り登録されたプロンプトを「好みの学習データ」として分析し、
 * 世界観・髪・色・衣装・背景・カメラ・演出・雰囲気などの傾向を抽出する。
 *
 * 重要：ここで作るのは「方向性（traitPhrases）」であり、プロンプト本文の複製ではない。
 * サーバ側の favoriteProfileBlock がこの方向性を「コピー禁止・変更範囲内のみ・
 * 固定優先・重複回避と両立」で反映する。
 */

import type { Mood, PromptHistoryItem } from "../types";
import { MOOD_GROUPS_BASIC, MOOD_GROUPS_DETAIL } from "../components/MoodSelector";

// ── Mood ラベルマップ（MoodSelector の定義から構築）──────────────────────────
const MOOD_LABEL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of [...MOOD_GROUPS_BASIC, ...MOOD_GROUPS_DETAIL]) {
    for (const m of g.moods) map[m.id] = m.label;
  }
  return map;
})();

// ── 好み分析タクソノミー ──────────────────────────────────────────────────────
// 各カテゴリ内で最頻出のものを「好きな傾向」として抽出する。

interface TraitDef {
  id: string;
  category: string;
  label: string;
  tokens: readonly string[];
}

const FAVORITE_TRAITS: readonly TraitDef[] = [
  // ── 髪 ──────────────────────────────────────────────────────────────────
  { id: "hair_white_silver", category: "髪", label: "白髪・銀髪系",
    tokens: ["白髪", "銀髪", "シルバー", "白銀", "プラチナ", "white hair", "silver hair", "platinum"] },
  { id: "hair_black_red", category: "髪", label: "黒×赤メッシュ髪",
    tokens: ["黒髪に赤", "黒×赤メッシュ", "赤メッシュ", "black and red hair", "red streaks"] },
  { id: "hair_pink", category: "髪", label: "ピンク系の髪",
    tokens: ["ピンクの髪", "ピンクヘア", "pink hair", "rose hair"] },
  { id: "hair_blue_teal", category: "髪", label: "青・ティール系の髪",
    tokens: ["青い髪", "水色の髪", "ティール", "blue hair", "teal hair", "aqua hair"] },
  { id: "hair_long", category: "髪", label: "ロングヘア",
    tokens: ["ロングヘア", "ロングストレート", "long hair", "腰までロング"] },
  { id: "hair_twin", category: "髪", label: "ツインテール系",
    tokens: ["ツインテール", "ツイン", "twintail", "twin tails"] },
  // 観察パターン：前髪ぱっつん固定（hime/blunt）が多数のお気に入りで共通
  { id: "hair_bangs_blunt", category: "髪", label: "前髪ぱっつん",
    tokens: [
      "前髪ぱっつん", "ぱっつん前髪", "厚めの前髪", "姫カット前髪", "ぱっつん",
      "blunt bangs", "thick bangs", "hime bangs", "straight bangs",
    ] },
  // 観察パターン：黒髪に明色（ピンク/赤/シアン/緑）の差し色メッシュ
  { id: "hair_mesh_streak", category: "髪", label: "差し色メッシュ髪",
    tokens: [
      "メッシュ", "インナーカラー", "部分カラー", "ハイライト",
      "color streak", "highlight streak", "two-tone hair", "duo-tone hair",
      "黒×赤メッシュ", "黒×ピンクメッシュ", "黒×ティールメッシュ", "黒×紫メッシュ",
      "赤メッシュ", "ピンクメッシュ", "ティールメッシュ", "紫メッシュ",
    ] },

  // ── 色 ──────────────────────────────────────────────────────────────────
  { id: "color_black_red", category: "色", label: "黒×赤の配色",
    tokens: ["黒×赤", "黒と赤", "赤黒", "クリムゾン", "black and red", "crimson"] },
  { id: "color_mono", category: "色", label: "モノトーン配色",
    tokens: ["モノトーン", "モノクロ", "白黒", "monochrome", "black and white"] },
  { id: "color_pastel", category: "色", label: "パステル配色",
    tokens: ["パステル", "淡い色", "ミルキー", "pastel"] },
  { id: "color_vivid", category: "色", label: "ビビッド配色",
    tokens: ["ビビッド", "鮮やか", "高彩度", "vivid", "saturated"] },
  { id: "color_blue_purple", category: "色", label: "青紫配色",
    tokens: ["青紫", "ブルーパープル", "blue purple", "cyan purple"] },
  { id: "color_gold", category: "色", label: "ゴールド配色",
    tokens: ["ゴールド", "金色", "金装飾", "gold", "golden"] },

  // ── 衣装 ────────────────────────────────────────────────────────────────
  { id: "outfit_gothic", category: "衣装", label: "ゴシックモード衣装",
    tokens: ["ゴシック", "ゴシックモード", "gothic"] },
  { id: "outfit_tech", category: "衣装", label: "テックウェア衣装",
    tokens: ["テックウェア", "テクニカル", "techwear", "tech wear"] },
  { id: "outfit_street", category: "衣装", label: "ストリート衣装",
    tokens: ["ストリート", "street", "ストリートファッション"] },
  { id: "outfit_dress", category: "衣装", label: "ドレス系衣装",
    tokens: ["ドレス", "ガウン", "dress", "gown"] },
  { id: "outfit_wa", category: "衣装", label: "和装系",
    tokens: ["和装", "着物", "和服", "和モダン", "kimono"] },
  { id: "outfit_uniform", category: "衣装", label: "制服系",
    tokens: ["制服", "セーラー", "ブレザー", "uniform"] },
  // 観察パターン：PVC・レザー・エナメル素材
  { id: "outfit_pvc_leather", category: "衣装", label: "PVC・レザー素材",
    tokens: [
      "pvc", "レザー", "エナメル", "ビニール", "光沢素材", "patent leather",
      "vinyl", "shiny material", "wet look",
    ] },
  // 観察パターン：ベルト・ストラップ・ハーネス装飾
  { id: "outfit_belt_straps", category: "衣装", label: "ベルト/ハーネス装飾",
    tokens: [
      "ベルト", "ストラップ", "バックル", "ハーネス", "チェーン装飾",
      "belt", "strap detail", "harness", "buckle", "chain accessory",
    ] },
  // 観察パターン：クロップトップ + ローライズの組み合わせ
  { id: "outfit_crop_lowrise", category: "衣装", label: "クロップトップ+ローライズ",
    tokens: [
      "クロップ", "ローライズ", "へそ出し", "ショート丈",
      "crop top", "low rise", "low-rise", "midriff", "cropped",
    ] },
  // 観察パターン：和 × ダーク（黒や深赤の和装）
  { id: "outfit_wa_dark", category: "衣装", label: "和×ダーク（黒/深赤の和装）",
    tokens: [
      "黒い和服", "黒着物", "黒紋付", "深紅の和服", "黒の着物", "ダーク和装",
      "黒い振袖", "dark kimono", "black kimono", "crimson kimono",
    ] },

  // ── 世界観 ──────────────────────────────────────────────────────────────
  { id: "world_future", category: "世界観", label: "近未来・SF",
    tokens: ["近未来", "未来的", "sf", "futuristic"] },
  { id: "world_cyber", category: "世界観", label: "サイバー",
    tokens: ["サイバー", "サイバーパンク", "cyber", "cyberpunk"] },
  { id: "world_wa", category: "世界観", label: "和風",
    tokens: ["和風", "和の", "神社", "japanese style"] },
  { id: "world_fantasy", category: "世界観", label: "ファンタジー・幻想",
    tokens: ["ファンタジー", "幻想", "魔法", "fantasy"] },
  { id: "world_retro", category: "世界観", label: "レトロ",
    tokens: ["レトロ", "ヴィンテージ", "retro", "vintage"] },

  // ── 背景 ────────────────────────────────────────────────────────────────
  { id: "bg_luxe_ad", category: "背景", label: "高級広告・スタジオ感",
    tokens: ["高級", "広告", "ブランド", "ラグジュアリー", "スタジオ", "luxury", "editorial", "campaign", "studio"] },
  { id: "bg_nature", category: "背景", label: "自然背景",
    tokens: ["自然", "森", "海", "花畑", "空", "nature", "forest"] },
  { id: "bg_neon_city", category: "背景", label: "ネオン都市背景",
    tokens: ["ネオン街", "ネオン都市", "neon city", "サイバー都市"] },
  { id: "bg_abstract", category: "背景", label: "抽象・単色背景",
    tokens: ["抽象", "単色背景", "グラデーション背景", "白背景", "abstract background"] },
  // 観察パターン：廃墟・グラフィティ・落書き壁
  { id: "bg_ruins_graffiti", category: "背景", label: "廃墟・グラフィティ背景",
    tokens: [
      "廃墟", "グラフィティ", "落書き", "落書きの壁", "工業廃墟",
      "graffiti", "ruins", "abandoned building", "decayed", "urban decay",
    ] },
  // 観察パターン：雨上がり・水たまり反射の地面
  { id: "bg_wet_reflect", category: "背景", label: "濡れた地面・水たまり反射",
    tokens: [
      "水たまり", "濡れた地面", "雨上がりの地面", "濡れた路面", "反射する地面",
      "wet ground", "puddle reflection", "rainy street", "wet pavement",
    ] },

  // ── カメラ ──────────────────────────────────────────────────────────────
  { id: "cam_close", category: "カメラ", label: "近距離・バストアップ構図",
    tokens: ["近距離", "バストアップ", "クローズアップ", "顔アップ", "close-up", "bust"] },
  { id: "cam_full", category: "カメラ", label: "全身構図",
    tokens: ["全身", "full body", "full-body"] },
  { id: "cam_low", category: "カメラ", label: "ローアングル",
    tokens: ["ローアングル", "あおり", "low angle"] },
  { id: "cam_high", category: "カメラ", label: "俯瞰アングル",
    tokens: ["俯瞰", "見下ろし", "ハイアングル", "high angle", "overhead"] },

  // ── 演出 ────────────────────────────────────────────────────────────────
  { id: "fx_foreground", category: "演出", label: "前景演出あり",
    tokens: ["前景", "舞い散る", "手前にぼかし", "foreground", "前景演出"] },
  { id: "fx_reflection", category: "演出", label: "反射素材・映り込み",
    tokens: ["反射", "映り込み", "鏡面", "濡れた", "reflection", "reflective"] },
  { id: "fx_particles", category: "演出", label: "光の粒子",
    tokens: ["光の粒子", "発光粒子", "光粒", "light particles", "glowing particles"] },
  { id: "fx_dynamic_pose", category: "演出", label: "ダイナミックなポーズ",
    tokens: ["ダイナミック", "躍動", "ジャンプ", "動きのある", "dynamic pose"] },
  { id: "fx_atmosphere", category: "演出", label: "霧・空気感演出",
    tokens: ["霧", "煙", "ヘイズ", "空気感", "fog", "haze", "mist"] },
  // 観察パターン：青/ピンク/赤などのネオン色で輪郭を縁取る強いリムライト
  { id: "fx_rim_neon", category: "演出", label: "強いネオンリムライト",
    tokens: [
      "リムライト", "リム発光", "縁取りライト", "輪郭の発光", "ネオン光源",
      "rim light", "rim lighting", "edge light", "neon backlight",
    ] },

  // ── 表情 ────────────────────────────────────────────────────────────────
  // 観察パターン：クール・無表情・強い視線（カメラ目線）
  { id: "expr_cool", category: "表情", label: "クール・強い視線",
    tokens: [
      "クール", "無表情", "強い視線", "射抜く視線", "凛とした",
      "カメラ目線", "cool expression", "intense stare", "piercing gaze",
      "deadpan", "stoic",
    ] },
];

// ── 出力型 ───────────────────────────────────────────────────────────────────

export interface TraitCount {
  label: string;
  count: number;
}

export interface FavoriteCategory {
  category: string;
  items: TraitCount[];
}

export interface FavoriteProfile {
  /** 分析対象お気に入り件数 */
  favoriteCount: number;
  /** カテゴリ別の傾向（分析画面用、頻度降順） */
  categories: FavoriteCategory[];
  /** 表示＆サーバ送信用の傾向フレーズ（上位） */
  traitPhrases: string[];
  /** お気に入りに多い雰囲気（mood ラベル） */
  topMoodLabels: string[];
  /** 神引き（viralMode）率 0–1 */
  viralRatio: number;
}

// ── 内部ユーティリティ ────────────────────────────────────────────────────────

function normalize(t: string): string {
  return t.toLowerCase().normalize("NFC");
}

// ── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * お気に入り（isFavorite=true の履歴）から好みプロファイルを生成する。
 * @param favorites isFavorite でフィルタ済みの履歴アイテム
 */
export function buildFavoriteProfile(favorites: PromptHistoryItem[]): FavoriteProfile {
  const favoriteCount = favorites.length;

  // 空：何も学習していない
  if (favoriteCount === 0) {
    return { favoriteCount: 0, categories: [], traitPhrases: [], topMoodLabels: [], viralRatio: 0 };
  }

  const texts = favorites.map((f) => normalize(f.promptText));

  // ── トレイト集計
  const countById = new Map<string, number>();
  for (const def of FAVORITE_TRAITS) {
    let c = 0;
    for (const text of texts) {
      if (def.tokens.some((tok) => text.includes(normalize(tok)))) c++;
    }
    if (c > 0) countById.set(def.id, c);
  }

  // ── カテゴリ別にまとめる（頻度降順）
  const catMap = new Map<string, TraitCount[]>();
  for (const def of FAVORITE_TRAITS) {
    const count = countById.get(def.id);
    if (!count) continue;
    const arr = catMap.get(def.category) ?? [];
    arr.push({ label: def.label, count });
    catMap.set(def.category, arr);
  }
  const CATEGORY_ORDER = ["世界観", "衣装", "髪", "色", "背景", "カメラ", "演出", "表情"];
  const categories: FavoriteCategory[] = CATEGORY_ORDER
    .filter((c) => catMap.has(c))
    .map((c) => ({
      category: c,
      items: (catMap.get(c) ?? []).sort((a, b) => b.count - a.count),
    }));

  // ── 雰囲気（moods）集計
  const moodCount = new Map<Mood, number>();
  for (const f of favorites) {
    for (const m of f.moods ?? []) {
      moodCount.set(m, (moodCount.get(m) ?? 0) + 1);
    }
  }
  const topMoodLabels = [...moodCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([m]) => MOOD_LABEL_MAP[m] ?? m)
    .filter(Boolean);

  // ── 神引き率
  const viralCount = favorites.filter((f) => f.viralMode).length;
  const viralRatio = favoriteCount > 0 ? viralCount / favoriteCount : 0;

  // ── traitPhrases：各カテゴリの最頻出を1つ（出現率20%以上を優先）＋雰囲気1つ
  const threshold = Math.max(2, Math.ceil(favoriteCount * 0.2));
  const phrases: string[] = [];
  for (const cat of categories) {
    const top = cat.items[0];
    if (top && top.count >= Math.min(threshold, top.count)) {
      // 出現率がそこそこあるものを優先採用（最低2件）
      if (top.count >= 2) phrases.push(top.label);
    }
  }
  // 雰囲気を1つ加える
  if (topMoodLabels.length > 0) phrases.push(`${topMoodLabels[0]}の雰囲気`);
  // 神引き傾向
  if (viralRatio >= 0.4) phrases.push("神引き（豪華・インパクト）志向");

  // 上限8件
  const traitPhrases = phrases.slice(0, 8);

  return { favoriteCount, categories, traitPhrases, topMoodLabels, viralRatio };
}
