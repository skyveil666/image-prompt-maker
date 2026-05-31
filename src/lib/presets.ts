/**
 * クイックプリセット定義（v2）。
 *
 * 設計思想：STYLEプリセット = 「演出 / 盛る」
 *   - 顔・ポーズ・体型・表情・カメラ構図・アスペクト比は絶対維持
 *   - 変えるのは 雰囲気 / 光 / 背景演出 / 小物 のみ
 *   - 3段階強度（弱 / 標準 / 強）でどこまで変えるかをコントロール
 *
 * TRENDプリセット = STYLEに上乗せする軽い味付け（最小スコープ）
 */
import type { Count, DetailSettings, Mood, PromptInputs, Scope } from "../types";
import { AUTO_DETAILS } from "../types";

// ─── 強度型 ──────────────────────────────────────────────────────────────────

export type PresetIntensity = "weak" | "standard" | "strong";

export const INTENSITY_LABELS: Record<PresetIntensity, string> = {
  weak:     "弱",
  standard: "標準",
  strong:   "強",
};

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type DetailPatch = {
  background?: Partial<DetailSettings["background"]>;
  foreground?: Partial<DetailSettings["foreground"]>;
  hair?:       Partial<DetailSettings["hair"]>;
  outfit?:     Partial<DetailSettings["outfit"]>;
  cosplay?:    Partial<DetailSettings["cosplay"]>;
  cyber?:      Partial<DetailSettings["cyber"]>;
  pose?:       Partial<DetailSettings["pose"]>;
  camera?:     Partial<DetailSettings["camera"]>;
  props?:      Partial<DetailSettings["props"]>;
  lighting?:   Partial<DetailSettings["lighting"]>;
  aspectRatio?: Partial<DetailSettings["aspectRatio"]>;
};

export interface Preset {
  id: string;
  emoji: string;
  label: string;
  category: "style" | "trend";

  /** 基本ムード */
  moods: Mood[];

  /**
   * 標準強度で有効にするスコープ。
   * "pose" / "aspect_ratio" は設計上ここに含めない。
   */
  scopes: Scope[];

  /** 弱時にさらに除外するスコープ */
  weakRemoveScopes?: Scope[];

  /** 強時にさらに追加するスコープ */
  strongExtraScopes?: Scope[];

  /**
   * 詳細パッチ（lighting / background / props のみ推奨）。
   * camera / pose は含めない（構図保護のため）。
   */
  detailPatch?: DetailPatch;

  count?: Count;

  /** 強時のみ viralMode を ON にする */
  viralAtStrong?: boolean;

  /** 弱時の追加指示 */
  weakNote?: string;
  /** 標準時の追加指示 */
  extraNote?: string;
  /** 強時の追加指示 */
  strongNote?: string;
}

// ─── 共通フッター ─────────────────────────────────────────────────────────────

const PRESERVE_FOOTER =
  "【絶対維持】顔・表情・人物の同一性・体型・ポーズ・カメラ構図・アスペクト比は一切変更しないでください。" +
  "元画像の良さを活かしながら、雰囲気・光・演出だけを強化してください。";

// ─── スタイルプリセット ───────────────────────────────────────────────────────

export const STYLE_PRESETS: Preset[] = [
  {
    id: "sns_max",
    emoji: "🔥",
    label: "SNS最強",
    category: "style",
    moods: ["sns_pop", "vivid", "bright"],
    scopes: ["background", "lighting", "props"],
    weakRemoveScopes: ["props"],
    strongExtraScopes: ["hair"],
    viralAtStrong: true,
    detailPatch: {
      lighting:   { intensity: "strong" },
      background: { info: "rich" },
      props:      { glow: "neon", vibe: "sns" },
    },
    weakNote:   "ライティングをSNS映えする鮮やかな光に軽く調整。背景の色味だけ引き上げる。衣装・小物・ポーズは変えない。",
    extraNote:  "背景・光をSNSで目を引く演出に。小物を1つ軽く追加してOK。高コントラスト・ビビッド。衣装・ポーズは変えない。",
    strongNote: "背景・光・小物・髪をSNS最適化。ネオン・高コントラスト・情報量UP。バズを狙う視覚インパクト。ポーズは変えない。",
  },
  {
    id: "cyberpunk",
    emoji: "🌃",
    label: "サイバーパンク",
    category: "style",
    moods: ["cyberpunk", "digital", "near_future"],
    scopes: ["background", "lighting", "props"],
    weakRemoveScopes: ["props"],
    strongExtraScopes: ["hair"],
    detailPatch: {
      background: { place: "futuristic", time: "night" },
      lighting:   { temperature: "cool", intensity: "dramatic" },
      props:      { category: "futuristic", vibe: "cool" },
    },
    weakNote:   "照明をネオン・冷色系のサイバーパンク風に調整。背景の雰囲気だけSF夜景に。衣装・ポーズは変えない。",
    extraNote:  "背景をネオン・雨に濡れた夜の都市に。照明を冷色・ドラマチックに。HUDやサイバー小物を軽く追加。衣装・ポーズは変えない。",
    strongNote: "背景・光・小物・髪をフルサイバーパンク化。ネオン・雨・グリッチエフェクト。衣装の質感をサイバー寄りにしてOK。ポーズは変えない。",
  },
  {
    id: "wagenia",
    emoji: "🌸",
    label: "和風幻想",
    category: "style",
    moods: ["japanese", "fantasy", "mystic"],
    scopes: ["background", "lighting", "props"],
    weakRemoveScopes: ["props"],
    strongExtraScopes: ["hair"],
    detailPatch: {
      background: { place: "nature", time: "dusk", weather: "foggy" },
      lighting:   { atmosphere: "hazy", temperature: "warm" },
      props:      { category: "japanese" },
    },
    weakNote:   "照明を柔らかい和風・夕暮れ色に。背景を霞がかった和の雰囲気に軽く変える。衣装・ポーズは変えない。",
    extraNote:  "背景を桜・鳥居・霞の和風幻想世界に。柔らかい和風ライティング。扇子・和傘などの和小物を追加。衣装・ポーズは変えない。",
    strongNote: "背景・光・小物・髪を和風幻想で全面強化。桜吹雪・金粉エフェクト・幽玄の光。衣装の質感を和の雰囲気に統一してOK。ポーズは変えない。",
  },
  {
    id: "luxury",
    emoji: "💎",
    label: "高級感",
    category: "style",
    moods: ["luxe", "minimal"],
    scopes: ["background", "lighting"],
    weakRemoveScopes: ["background"],
    strongExtraScopes: ["props"],
    detailPatch: {
      background: { density: "minimal", info: "sparse" },
      lighting:   { intensity: "soft", temperature: "neutral" },
    },
    weakNote:   "光を高級スタジオライト風に調整。明るさ・色温度のみ引き上げる。背景・衣装・ポーズは変えない。",
    extraNote:  "背景を上質でミニマルな空間に。柔らかいスタジオ照明。余白を活かした品格ある仕上げ。衣装・ポーズは変えない。",
    strongNote: "背景・光・小物で高級ブランド広告レベルを演出。ゴールドアクセント・深いコントラスト・ラグジュアリーな小物。衣装の質感を上質に統一してOK。",
  },
  {
    id: "dark",
    emoji: "🖤",
    label: "ダーク",
    category: "style",
    moods: ["dark", "gothic"],
    scopes: ["background", "lighting"],
    weakRemoveScopes: ["background"],
    strongExtraScopes: ["props"],
    detailPatch: {
      lighting: { direction: "back", intensity: "dramatic", temperature: "cool" },
    },
    weakNote:   "照明をローキー・逆光・暗めに調整。背景・衣装・ポーズは変えない。",
    extraNote:  "背景を暗く重厚な空間に。ローキーライティング・強い逆光。衣装・ポーズは変えない。",
    strongNote: "背景・光・小物でダーク全開。黒薔薇・鎖・月光などのダーク小物を追加。衣装の質感をダーク寄りにしてOK。ポーズは変えない。",
  },
  {
    id: "cute",
    emoji: "✨",
    label: "かわいい",
    category: "style",
    moods: ["cute", "pastel", "bright"],
    scopes: ["background", "lighting", "props"],
    weakRemoveScopes: ["props"],
    detailPatch: {
      lighting: { intensity: "soft", temperature: "warm" },
      props:    { category: "cute", vibe: "cute" },
    },
    weakNote:   "光を柔らかく暖かく。パステルな明るさに調整するだけ。背景・衣装・ポーズは変えない。",
    extraNote:  "背景を可愛らしい雰囲気に。柔らかい暖かい光。花・リボンなどのかわいい小物を1〜2個追加。衣装・ポーズは変えない。",
    strongNote: "背景・光・小物でかわいさMAX。花・ぬいぐるみ・リボン・パステルエフェクト。ヘアアクセも軽く追加してOK。",
  },
  {
    id: "cinematic",
    emoji: "🎬",
    label: "映画風",
    category: "style",
    moods: ["cinematic", "dark"],
    scopes: ["background", "lighting"],
    weakRemoveScopes: ["background"],
    detailPatch: {
      lighting:   { intensity: "dramatic" },
      background: { depth: "deep" },
    },
    weakNote:   "照明を映画的なドラマチック光に。シネマカラーグレーディング。背景・ポーズは変えない。",
    extraNote:  "背景をシネマティックな奥行きのある空間に。ドラマチック照明・映画的カラーグレーディング・フィルム感。カメラ構図・ポーズは変えない。",
    strongNote: "背景・光を映画フルスケールで演出。被写界深度効果・強いカラーグレーディング・シネスコ的空気感。衣装も映画的な質感に統一してOK。",
  },
  {
    id: "portrait",
    emoji: "📷",
    label: "ポートレート",
    category: "style",
    moods: ["cool", "stylish"],
    scopes: ["lighting"],
    strongExtraScopes: ["background"],
    detailPatch: {
      lighting: { intensity: "soft", temperature: "warm" },
    },
    weakNote:   "顔周りの光を柔らかく最適化。スキントーン引き上げ。それ以外は変えない。",
    extraNote:  "ポートレート最適化照明（柔らかく・暖色寄り）。背景を自然なぼけに統一。衣装・ポーズ・表情は一切変えない。",
    strongNote: "プロポートレート照明。スタジオライト・リムライト・アイキャッチ光を強化。背景も演出。衣装・ポーズは変えない。",
  },
];

// ─── トレンドプリセット ───────────────────────────────────────────────────────
// TRENDはSTYLEへの軽い上乗せ。スコープは最小限。

export const TREND_PRESETS: Preset[] = [
  {
    id: "trend_2026",
    emoji: "🆕",
    label: "2026トレンド",
    category: "trend",
    moods: ["near_future", "translucent", "cinematic"],
    scopes: ["background", "lighting"],
    weakRemoveScopes: ["background"],
    detailPatch: {
      background: { depth: "deep" },
      lighting:   { intensity: "soft" },
    },
    weakNote:   "透明感と近未来感を光だけで演出。変更は最小限。",
    extraNote:  "2026年トレンドの透明感・近未来・シネマティックな雰囲気を加える。過度な変更は避ける。",
    strongNote: "透明感・近未来・奥行きを全面強化。背景と光を2026年最先端に演出。",
  },
  {
    id: "pinterest",
    emoji: "📌",
    label: "Pinterest",
    category: "trend",
    moods: ["art", "minimal", "pastel"],
    scopes: ["lighting"],
    strongExtraScopes: ["background"],
    detailPatch: {
      lighting: { intensity: "soft" },
    },
    weakNote:   "色調と光をPinterest的な美しいトーンに軽く調整。",
    extraNote:  "保存したくなるPinterest的な美しい光・余白・色調に仕上げる。変更は控えめに。",
    strongNote: "背景と光をPinterest保存率MAXの美術的・パステルな空間演出に。",
  },
  {
    id: "tiktok",
    emoji: "🎵",
    label: "TikTok",
    category: "trend",
    moods: ["sns_pop", "vivid"],
    scopes: ["lighting", "props"],
    weakRemoveScopes: ["props"],
    viralAtStrong: true,
    detailPatch: {
      props: { glow: "neon" },
    },
    weakNote:   "光をTikTok映えする鮮やかな発光感に軽く調整。",
    extraNote:  "TikTok的な鮮やかな光と小物演出。縦型画面映えを意識した演出を追加。",
    strongNote: "TikTokでバズる視覚インパクト全開。ネオン発光・強い光・目を引く小物。ポーズは変えない。",
  },
  {
    id: "x_buzz",
    emoji: "✕",
    label: "Xバズ",
    category: "trend",
    moods: ["sns_pop", "vivid", "bright"],
    scopes: ["lighting", "props"],
    weakRemoveScopes: ["props"],
    viralAtStrong: true,
    detailPatch: {
      props:    { glow: "neon", vibe: "sns" },
      lighting: { intensity: "strong" },
    },
    weakNote:   "光をX(Twitter)でバズりやすい高コントラストに軽く調整。",
    extraNote:  "X(Twitter)で目立つ強いコントラストと光。目を引く小物を軽く追加。",
    strongNote: "Xバズ全開。高コントラスト・ネオン・強い小物でインパクト最大化。ポーズは変えない。",
  },
  {
    id: "instagram",
    emoji: "📸",
    label: "Instagram",
    category: "trend",
    moods: ["stylish", "bright", "pastel"],
    scopes: ["lighting"],
    strongExtraScopes: ["background"],
    detailPatch: {
      lighting: { intensity: "soft", temperature: "warm" },
    },
    weakNote:   "光をInstagram映えする柔らかく暖かいトーンに調整。",
    extraNote:  "Instagramフィードで映える柔らかい光と透明感。色味を整える。背景・ポーズは変えない。",
    strongNote: "Instagram映え全開。背景・光をおしゃれで透明感ある演出に。衣装・ポーズは変えない。",
  },
];

export const ALL_PRESETS: Preset[] = [...STYLE_PRESETS, ...TREND_PRESETS];

// ─── スコープ解決ヘルパー（PresetBar での表示用） ─────────────────────────────

export function getIntensityScopes(preset: Preset, intensity: PresetIntensity): Scope[] {
  let scopes = [...preset.scopes];
  if (intensity === "weak" && preset.weakRemoveScopes) {
    scopes = scopes.filter((s) => !preset.weakRemoveScopes!.includes(s));
  }
  if (intensity === "strong" && preset.strongExtraScopes) {
    for (const s of preset.strongExtraScopes) {
      if (!scopes.includes(s)) scopes.push(s);
    }
  }
  // pose は絶対に含まない
  return scopes.filter((s) => s !== "pose");
}

// ─── プリセット適用関数 ───────────────────────────────────────────────────────

/**
 * プリセットを現在の PromptInputs に適用して新しい PromptInputs を返す。
 *
 * @param intensity  弱 / 標準 / 強（省略時 = 標準）
 *
 * 設計方針：
 *  - 顔・ポーズ・体型・カメラ・アスペクト比は常にロック
 *  - スコープは intensity に応じて conservative に制限
 *  - 強度が上がるほど変更範囲が広がる
 */
export function applyPreset(
  current: PromptInputs,
  preset: Preset,
  intensity: PresetIntensity = "standard"
): PromptInputs {
  // ── スコープ解決 ──────────────────────────────────────────────
  const scopes = getIntensityScopes(preset, intensity);

  // ── 追加指示解決 ──────────────────────────────────────────────
  let baseNote = preset.extraNote ?? "";
  if (intensity === "weak"   && preset.weakNote)   baseNote = preset.weakNote;
  if (intensity === "strong" && preset.strongNote)  baseNote = preset.strongNote;

  const extraInstructions = [
    baseNote,
    PRESERVE_FOOTER,
  ].filter(Boolean).join("\n");

  // ── viralMode ────────────────────────────────────────────────
  const viralMode = preset.viralAtStrong ? intensity === "strong" : false;

  // ── 詳細パッチ ────────────────────────────────────────────────
  // camera / pose / aspectRatio は常に AUTO_DETAILS（構図保護）
  const p = preset.detailPatch ?? {};
  const details: DetailSettings = {
    hair:        { ...AUTO_DETAILS.hair,       ...(p.hair       ?? {}) },
    outfit:      { ...AUTO_DETAILS.outfit,     ...(p.outfit     ?? {}) },
    cosplay:     { ...AUTO_DETAILS.cosplay,    ...(p.cosplay    ?? {}) },
    cyber:       { ...AUTO_DETAILS.cyber,      ...(p.cyber      ?? {}) },
    background:  { ...AUTO_DETAILS.background, ...(p.background ?? {}) },
    foreground:  { ...AUTO_DETAILS.foreground, ...(p.foreground ?? {}) },
    pose:        { ...AUTO_DETAILS.pose },         // 常にAUTO
    camera:      { ...AUTO_DETAILS.camera },        // 常にAUTO（構図変えない）
    props:       { ...AUTO_DETAILS.props,      ...(p.props      ?? {}) },
    bigObject:   { ...AUTO_DETAILS.bigObject },      // デフォルトAUTO
    vehicle:     { ...AUTO_DETAILS.vehicle },        // デフォルトAUTO（プリセットで必要なら上書き）
    myth:        { ...AUTO_DETAILS.myth },           // デフォルトAUTO
    lighting:    { ...AUTO_DETAILS.lighting,   ...(p.lighting   ?? {}) },
    aspectRatio: { ...AUTO_DETAILS.aspectRatio },   // 常にAUTO
  };

  // 弱強度ではさらにシンプルに（patchの過半を無視）
  if (intensity === "weak") {
    details.background = { ...AUTO_DETAILS.background };
    details.props      = { ...AUTO_DETAILS.props };
    details.hair       = { ...AUTO_DETAILS.hair };
    // lighting patch だけ維持
    details.lighting   = { ...AUTO_DETAILS.lighting, ...(p.lighting ?? {}) };
  }

  return {
    ...current,
    moods: preset.moods,
    scopes,
    details,
    count:              preset.count ?? current.count,
    viralMode,
    faceLock:           true,
    extraInstructions,
    autoMoodCategories: [],
  };
}
