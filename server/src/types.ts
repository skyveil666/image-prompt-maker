/**
 * Server-side type mirror of the frontend types. Kept in sync manually — this
 * is a local-only project, so duplication is acceptable for clarity.
 */

export type Scope =
  | "background"
  | "foreground"
  | "pose"
  | "hair"
  | "outfit"
  | "cosplay"
  | "cyber"
  | "camera"
  | "props"
  | "big_object"
  | "vehicle"
  | "myth"
  | "lighting"
  | "aspect_ratio";
/**
 * 新規生成は常に "unified"。"nano_gemini" / "chatgpt_image" は
 * 旧バージョン時に保存された履歴を読み出す際の互換のため残す。
 */
export type OutputTarget = "unified" | "nano_gemini" | "chatgpt_image";
export type Mood =
  | "cool"
  | "digital"
  | "preserve_bg_color"
  | "minimal"
  | "japanese"
  | "glitch"
  | "fantasy"
  | "sns_pop"
  | "bright"
  | "dark"
  | "cyberpunk"
  | "gothic"
  | "translucent"
  | "luxe"
  | "cute"
  | "stylish"
  | "emo"
  | "cinematic"
  | "near_future"
  | "retro"
  | "pop"
  | "monochrome"
  | "pastel"
  | "vivid"
  | "mystic"
  | "decadent"
  | "street"
  | "art"
  | "fantasy_world"
  | "noisy"
  | "portrait"
  | "wa_fantasy"
  | "tiktok"
  | "instagram"
  | "pinterest"
  | "x_buzz"
  | "trend_2026"
  | "clean" | "heavy" | "ephemeral"
  | "contemporary" | "architectural" | "urban_fantasy" | "retro_future"
  | "reflection_rich" | "whitespace" | "ad_visual" | "magazine_cover" | "movie_poster"
  | "thumbnail_pop" | "scroll_stop" | "icon_pop"
  | "refl_water" | "refl_glass" | "refl_mirror" | "refl_metal" | "refl_wet_floor" | "refl_car_window"
  | "air_fog" | "air_smoke" | "air_after_rain" | "air_dust" | "air_light_particles" | "air_humid" | "air_cold"
  | "grade_cinema" | "grade_ad" | "grade_low_sat" | "grade_high_sat" | "grade_blue" | "grade_red" | "grade_white" | "grade_black"
  | "venue_wide" | "venue_narrow" | "venue_gallery" | "venue_hotel" | "venue_greenhouse" | "venue_station" | "venue_rooftop" | "venue_glass" | "venue_abstract";
export type LockKey =
  | "face"
  | "body_shape"
  | "expression"
  | "identity"
  | "color"
  | "camera"
  | "aspect_ratio";
export type SafetyMode = "fictional_ai" | "real_person";

/**
 * 出力先プラットフォームに合わせたプロンプト安全モード（フロントエンド src/types.ts と同期）。
 *  chatgpt_safe  : ChatGPT / DALL-E 向け（最も厳しい語句フィルタ）
 *  gemini_safe   : Gemini Image Generation 向け（やや緩い）
 *  nano_safe     : Nano Banana 向け（軽量・短文）
 *  full          : 従来通り（フィルタなし・詳細記述あり）
 */
export type PromptTarget = "chatgpt_safe" | "gemini_safe" | "nano_safe" | "full";
export type Count = 2 | 3 | 4 | 5 | 6;

/**
 * 表情指定。faceLock: false 時のみ有効。
 * null = 表情自由（顔の造形のみ維持）
 */
export type Expression =
  | "neutral"      // 無表情
  | "smile"        // 微笑み
  | "cold"         // 冷たい
  | "assertive"    // 強気
  | "sad"          // 悲しげ
  | "sleepy"       // 眠そう
  | "elegant"      // 上品
  | "cool"         // クール
  | "ephemeral"    // 儚い
  | "intimidating"; // 威圧感

/**
 * 時代軸。プロンプトの【時代軸】ブロックに反映される。
 * null = 設定なし（ブロック挿入しない）
 */
export type Era =
  | "auto"        // おまかせ
  | "primitive"   // 原始
  | "ancient"     // 古代
  | "egypt"       // エジプト
  | "greek"       // ギリシャ
  | "roman"       // ローマ
  | "heian"       // 平安
  | "sengoku"     // 戦国
  | "edo"         // 江戸
  | "meiji"       // 明治
  | "taisho"      // 大正
  | "showa"       // 昭和
  | "90s"         // 90s
  | "y2k"         // Y2K
  | "modern"      // 現代
  | "near_future" // 近未来
  | "y3k"         // Y3K
  | "far_future"  // 超未来
  | "apocalypse"; // 終末

/**
 * 色戦略。肯定系は【色戦略】ブロックに、否定系は【NG指定】ブロックに追加。
 * null = 設定なし
 */
export type ColorStrategy =
  | "auto"          // おまかせ
  | "red_only"      // 赤だけ
  | "warm"          // 暖色
  | "cool_tone"     // 寒色
  | "complement"    // 補色
  | "mono"          // モノクロ
  | "pastel"        // パステル
  | "vivid"         // 高彩度
  | "muted"         // 低彩度
  | "white_base"    // 白基調
  | "black_base"    // 黒基調
  | "no_color"      // 色禁止
  | "no_blue"       // 青NG
  | "no_purple"     // 紫NG
  | "no_pink"       // ピンクNG
  | "no_transparent"; // 透明素材NG

/**
 * 絵柄スタイル。全体の描画スタイルを制御する。
 * null = 設定なし
 */
export type ArtStyle =
  | "auto"
  | "photo"
  | "illustration"
  | "anime"
  | "watercolor"
  | "oil_painting"
  | "sketch"
  | "line_art"
  | "3d_render"
  | "concept_art"
  | "manga"
  | "game_art"
  | "pixel"
  | "flat_design"
  | "ghibli_style";

export type AutoOr<T extends string> = T | "auto" | "skip";

export interface HairSettings {
  length: AutoOr<
    | "short" | "bob" | "medium" | "long" | "extra_long"
    | "very_short" | "wolf_short" | "hime" | "waist_length" | "floor_length" | "asymmetric"
  >;
  shape: AutoOr<
    | "straight" | "wave" | "layer" | "twintail" | "ponytail" | "updo"
    | "hime_cut" | "wolf_cut" | "mash" | "flare_bob" | "constrict"
    | "half_twin" | "braid_twin" | "side_braid" | "bun_twin"
    | "high_ponytail" | "low_ponytail" | "braid" | "jellyfish"
    | "heavy_layer" | "cyber_bob"
  >;
  texture: AutoOr<
    | "silky" | "wet" | "fluffy" | "sharp" | "cyber"
    | "semi_wet" | "transparent" | "high_gloss" | "matte" | "airy"
    | "bundle_strand" | "glass" | "cyber_glow"
  >;
  colorMode: "lock" | "subtle" | "bold" | "auto" | "skip";
  color: AutoOr<
    | "inherit" | "black" | "brown" | "blonde" | "ash" | "red" | "pink" | "blue" | "silver" | "rainbow"
    | "black_red_mesh" | "black_blue_mesh" | "black_purple_mesh" | "white_silver" | "milk_tea"
    | "teal_gradient" | "pink_gradient" | "inner_color" | "hem_color"
    | "neon_color" | "aurora_color" | "rainbow_mesh"
    | "white" | "purple"
    | "white_aqua" | "black_aqua_grad" | "black_teal_mesh"
  >;
  bangs: AutoOr<
    | "full" | "swept" | "airy" | "curtain" | "blunt" | "none"
    | "hime_bangs" | "asymmetric" | "center_part" | "face_layer" | "antenna" | "eye_cover"
  >;
  tips: AutoOr<
    | "natural" | "inner_curl" | "outer_curl" | "wave" | "blunt" | "feathered"
    | "strong_wave" | "loose_wave" | "random_curl" | "sharp"
  >;
  volume: AutoOr<
    | "flat" | "natural" | "volume" | "extra_volume"
    | "low_volume" | "heavy" | "light" | "floating" | "wind"
    | "water_float" | "tip_flow" | "one_side_flow"
  >;
  accessory: AutoOr<
    | "none" | "hairpin" | "ribbon" | "flower" | "ears" | "headphones" | "cap" | "circlet"
    | "fox_kanzashi" | "metal_clip" | "cyber_ring" | "japanese_kanzashi" | "veil" | "chain_accessory"
  >;
  /** スタイル系統（時代・文化・世界観）。省略時は skip 扱い。 */
  hairStyle?: AutoOr<
    | "modern" | "y2k" | "heisei_gal" | "retro" | "showa_idol" | "taisho_roman"
    | "wa_gothic" | "cyberpunk" | "near_future" | "magical_girl" | "gothic_lolita"
    | "street" | "korean" | "anime" | "doll" | "viral" | "unique"
  >;
}

export interface OutfitSettings {
  style: AutoOr<
    | "street" | "mode" | "cyber" | "japanese" | "gothic" | "military" | "techwear" | "dress" | "armor"
    | "y2k" | "lolita" | "uniform" | "future_dress" | "wa_modern" | "idol" | "runway"
  >;
  exposure: AutoOr<"low" | "normal" | "high" | "shoulder_off" | "long_sleeve" | "high_neck">;
  material: AutoOr<
    | "leather" | "nylon" | "metal" | "transparent" | "cloth" | "enamel" | "denim"
    | "chiffon" | "velvet" | "pvc" | "lace" | "knit" | "organza"
    | "liquid_metal" | "crystal_glass" | "neon_fabric"
  >;
  color: AutoOr<
    | "black" | "white" | "red" | "blue" | "green" | "pink" | "inherit"
    | "purple" | "light_blue" | "gold" | "silver" | "gradient" | "accent_color"
  >;
  silhouette: AutoOr<
    | "tight" | "oversized" | "minimal" | "ornate"
    | "a_line" | "flare" | "long_length" | "short_length" | "asymmetric" | "layered"
  >;
  decoration: AutoOr<
    | "minimal" | "moderate" | "elaborate" | "maximal"
    | "ribbon" | "embroidery" | "rhinestone" | "chain_decor" | "frill"
  >;
  season: AutoOr<
    | "spring" | "summer" | "autumn" | "winter" | "seasonless"
    | "rainy_season" | "midsummer" | "late_autumn" | "snowy_scene"
  >;
  luxury: AutoOr<"casual" | "refined" | "luxe" | "couture" | "classical" | "future_luxe">;
}

export interface BackgroundSettings {
  place: AutoOr<
    | "indoor" | "alley" | "futuristic" | "abstract" | "nature" | "museum" | "industrial"
    | "gallery" | "atelier" | "japanese_room" | "garden" | "seaside" | "forest"
    | "empty_space" | "studio" | "paper_backdrop" | "fabric_backdrop"
    | "old_cinema" | "greenhouse" | "rooftop" | "library" | "rainy_station" | "night_amusement" | "frosted_room"
  >;
  color: AutoOr<
    | "inherit" | "blue" | "green" | "red" | "pink" | "monochrome"
    | "white" | "black" | "beige" | "gold" | "light" | "low_sat"
    | "high_sat" | "pastel" | "vivid" | "earth"
  >;
  density: AutoOr<"minimal" | "normal" | "dense">;
  effect: AutoOr<
    | "glitch" | "particles" | "fog" | "reflection" | "geometric" | "distortion"
    | "watercolor_bleed" | "ink_bleed" | "brushstroke" | "paper_texture"
    | "canvas_texture" | "collage" | "negative_space" | "abstract_lines"
    | "color_planes" | "modern_art_effect" | "handdrawn"
    | "fabric_flow" | "light_rays" | "shadow_pattern" | "water_reflection"
  >;
  time: AutoOr<"morning" | "noon" | "golden_hour" | "dusk" | "night" | "midnight" | "dawn">;
  weather: AutoOr<"clear" | "cloudy" | "rainy" | "snowy" | "stormy" | "foggy">;
  depth: AutoOr<"shallow" | "moderate" | "deep" | "extreme">;
  info: AutoOr<"sparse" | "balanced" | "rich" | "maximalist">;
  /** 背景スタイル（絵画・アート・素材感等）。省略時は auto/skip 扱い。 */
  style?: AutoOr<
    | "photorealistic" | "watercolor" | "ink_wash" | "oil_painting" | "acrylic"
    | "modern_art" | "contemporary_art" | "abstract_art" | "cubism" | "collage"
    | "poster" | "minimal" | "simple" | "washi" | "canvas" | "gradient"
    | "monochrome" | "pastel" | "cyber" | "digital"
  >;
}

export interface PoseSettings {
  type: AutoOr<"stand" | "sit" | "crouch" | "turn" | "walk" | "float" | "action" | "lean_wall" | "hand_up">;
  impression: AutoOr<
    | "cool" | "cute" | "strong" | "calm" | "dynamic" | "sns"
    | "provocative" | "fragile" | "composed" | "tense" | "mysterious"
  >;
  hand: AutoOr<
    | "near_face" | "hip" | "extend" | "natural" | "prop"
    | "touch_hair" | "chest_hand" | "touch_cheek" | "cross_arms" | "pocket"
  >;
  foot: AutoOr<"natural" | "cross" | "knee" | "walking" | "float" | "tiptoe" | "one_foot_forward">;
  balance: AutoOr<
    | "centered" | "low" | "high" | "leaning_forward" | "leaning_back" | "off_center"
    | "one_leg_weight" | "arched" | "relaxed"
  >;
  motion: AutoOr<"still" | "subtle" | "dynamic" | "explosive" | "mid_action" | "hair_flow" | "cloth_flow" | "mid_turn">;
  gaze: AutoOr<
    | "to_camera" | "away" | "downcast" | "upward" | "side_glance" | "over_shoulder"
    | "distant" | "diagonal_look" | "look_down"
  >;
  orientation: AutoOr<"front" | "three_quarter" | "side" | "back" | "diagonal">;
}

export interface Camera3DState {
  yaw: number;
  pitch: number;
  roll: number;
  distance: number;
  composition: "face" | "bust" | "waist" | "full" | "wide";
  preset: string | null;
}

export interface CameraSettings {
  angle: AutoOr<
    | "front" | "diagonal_45" | "low" | "high" | "top_down" | "side_profile"
    | "over_shoulder" | "close_portrait" | "full_body" | "dutch" | "cinematic"
    | "diagonal_high" | "back_view"
  >;
  distance: AutoOr<"macro" | "close" | "medium" | "far" | "extreme_far" | "bust_up" | "knee_up">;
  lens: AutoOr<"wide" | "normal" | "portrait" | "tele" | "fisheye" | "cinema" | "smartphone" | "wide_distort">;
  composition: AutoOr<
    | "rule_of_thirds" | "centered" | "diagonal" | "symmetric" | "leading_lines" | "negative_space"
    | "generous_space" | "asymmetric" | "subject_large" | "magazine"
  >;
  fov: AutoOr<"narrow" | "standard" | "wide" | "ultra_wide" | "vertical_sns" | "horizontal_cinema" | "square">;
  eyeHeight: AutoOr<
    | "low" | "waist" | "eye_level" | "above_head" | "ceiling"
    | "ground" | "chest_height" | "slightly_above"
  >;
  custom3D: Camera3DState | null;
}

export interface PropsSettings {
  category: AutoOr<
    | "weapon" | "cute" | "sns" | "futuristic" | "japanese" | "gothic" | "daily" | "funny"
    | "fashion" | "flower" | "instrument"
  >;
  hold: AutoOr<
    | "one_hand" | "two_hands" | "shoulder" | "floating" | "on_floor" | "in_background"
    | "chest_hold" | "near_face_hold"
  >;
  size: AutoOr<"small" | "medium" | "large" | "huge" | "tiny" | "foreground_large">;
  glow: AutoOr<"none" | "subtle" | "neon" | "magical" | "edge_glow" | "inner_glow">;
  vibe: AutoOr<"cool" | "cute" | "funny" | "luxury" | "dark" | "sns" | "elegant" | "mysterious" | "retro" | "fragile_vibe">;
  placement: AutoOr<
    | "near_subject" | "foreground" | "midground" | "background" | "all_around"
    | "blur_foreground" | "beside_face" | "at_feet" | "edge_frame"
  >;
  count: AutoOr<"single" | "few" | "many" | "scattered" | "both_sides" | "arranged">;
}

export interface LightingSettings {
  direction: AutoOr<
    | "top" | "side" | "back" | "front" | "below" | "multi" | "rim"
    | "diagonal_above" | "window" | "spot" | "ambient"
  >;
  intensity: AutoOr<"soft" | "normal" | "strong" | "dramatic" | "low_key" | "soft_backlight" | "pale_glow">;
  temperature: AutoOr<"warm" | "neutral" | "cool" | "mixed" | "blue_tone" | "red_tone" | "sunset" | "white_light">;
  shadow: AutoOr<"soft" | "sharp" | "long" | "minimal" | "deep" | "drop" | "outline">;
  reflection: AutoOr<"matte" | "satin" | "glossy" | "specular" | "wet" | "metal_reflect" | "glass_reflect" | "fabric">;
  atmosphere: AutoOr<"clear" | "hazy" | "foggy" | "dusty" | "particulate" | "after_rain">;
}

export interface AspectRatioSettings {
  preset:
    | "skip"
    | "original"
    | "ar_9_16"
    | "ar_4_5"
    | "ar_1_1"
    | "ar_16_9"
    | "ar_3_4"
    | "ar_2_3"
    | "ar_21_9"
    | "custom";
  customW: number;
  customH: number;
}

export type AutoOrStr = string | "auto" | "skip";

export interface CosplaySettings {
  genre:         AutoOrStr;
  cuteStyle:     AutoOrStr;
  jobGenre:      AutoOrStr;
  japaneseStyle: AutoOrStr;
  fantasyStyle:  AutoOrStr;
  scifiStyle:    AutoOrStr;
  darkStyle:     AutoOrStr;
  occupation:    AutoOrStr;
  decoration:    AutoOrStr;
  item:          AutoOrStr;
  /** UIでは "auto" は使わない（"skip" or 具体値） */
  exposure:      "modest" | "bold" | "skip";
  colorDir:      AutoOrStr;
}

export interface CyberSettings {
  part:      AutoOrStr;
  type:      AutoOrStr;
  texture:   AutoOrStr;
  glowColor: AutoOrStr;
  /** 変化量："auto" は使わない（"skip" or 具体値） */
  intensity: "subtle" | "normal" | "strong" | "bold" | "skip";
}

export interface ForegroundSettings {
  preset:      AutoOrStr;
  effectType:  AutoOrStr;
  swirlType:   AutoOrStr;
  digitalType: AutoOrStr;
  artType:     AutoOrStr;
  position:    AutoOrStr;
  density:     AutoOrStr;
  motion:      AutoOrStr;
  color:       AutoOrStr;
  depth:       AutoOrStr;
  visibility:  AutoOrStr;
}

export interface VehicleSettings {
  genre:       AutoOrStr;
  type:        AutoOrStr;
  interaction: AutoOrStr;
  era:         AutoOrStr;
  material:    AutoOrStr;
  atmosphere:  AutoOrStr;
}

export interface MythSettings {
  region:      AutoOrStr;
  creature:    AutoOrStr;
  interaction: AutoOrStr;
  style:       AutoOrStr;
  size:        AutoOrStr;
}

export interface BigObjectSettings {
  genre:     AutoOrStr;
  type:      AutoOrStr;
  condition: AutoOrStr;
  placement: AutoOrStr;
  size:      AutoOrStr;
  mood:      AutoOrStr;
}

export interface DetailSettings {
  hair: HairSettings;
  outfit: OutfitSettings;
  cosplay: CosplaySettings;
  cyber: CyberSettings;
  background: BackgroundSettings;
  foreground: ForegroundSettings;
  pose: PoseSettings;
  camera: CameraSettings;
  props: PropsSettings;
  bigObject?: BigObjectSettings;
  vehicle: VehicleSettings;
  myth: MythSettings;
  lighting: LightingSettings;
  aspectRatio: AspectRatioSettings;
  /**
   * 複数選択オーバーライド（"hair.color" 等のキー → 選択値の配列）。
   * フロントエンドの MultiFieldSection（最大3つの複数選択）の値を保持する。
   * promptSystem の getMultiVals がこれを参照して組み合わせ表現を生成する。
   */
  multiOverrides?: Record<string, string[]>;
}

// ── Texture / Dimension slider types (mirror of frontend src/types.ts) ───────
// 旧 TextureMode / DimensionMode / DetailTextureLevel / DetailDimensionLevel は廃止。

export interface GenerateRequest {
  imageDataUrl: string | null;
  scopes: Scope[];
  moods: Mood[];
  count: Count;
  locks: Record<LockKey, boolean>;
  safety: SafetyMode;
  details: DetailSettings;
  extraInstructions: string;
  faceLock: boolean;
  /**
   * 表情指定（faceLock: false 時のみ有効）。
   * null / 省略 = 顔の造形のみ維持・表情は自然なものに。
   */
  expression?: Expression | null;
  ngList: string;
  viralMode: boolean;
  /** Prompt Strength 1〜5。省略時は 3（標準）。*/
  strength?: number;
  /** 光沢感 1-5（1=マット 2=ややマット 3=標準 4=光沢 5=強光沢）。3はプロンプト非出力。 */
  glossLevel?: number;
  /** 立体感 1-5（1=2D 2=やや2D 3=2.5D 4=やや3D 5=3D）。3はプロンプト非出力。
   * 互換のため残しているが、UIから露出はしない。代わりに realismLevel を使う。 */
  dimensionLevel?: number;
  /**
   * 質感・リアル度 1-5（1=完全2Dイラスト / 2=デジタルペイント / 3=2.5D / 4=リアル寄り / 5=写真リアル）。
   * 「背景だけリアルすぎる問題」を防ぐため、人物と背景の質感統一を最優先する。
   * 3は標準値のためプロンプト非出力。
   */
  realismLevel?: number;
  /**
   * 質感タイプ（"anime_bg" / "digital_paint" 等、null/未指定 = タイプ指定なし）。
   * realismLevel と組み合わせて具体的な絵柄を指定する。
   */
  realismType?: string | null;
  /** 元画像維持：true のとき質感と立体感を「元画像と同じに維持」 */
  textureOriginal?: boolean;
  /** プロンプトに反映しない：true のとき質感ブロックを出力しない */
  textureDisabled?: boolean;
  /** プロンプト安全フィルタモード（省略時 = "full" 扱い）*/
  promptTarget?: PromptTarget;
  /** 雰囲気カテゴリのうち「おまかせ」に設定されているカテゴリ名の配列 */
  autoMoodCategories?: string[];
  /**
   * 量産構図回避モード（true = 有効）。
   * ゴシック×教会×黒バラ、白服×羽×魔法陣 などの定番すぎる組み合わせを避ける指示を追加。
   * 省略時は true と同じ扱い（デフォルト ON）。
   */
  avoidCliche?: boolean;
  /** 時代軸（null / 省略 = 設定なし）。プロンプトの【時代軸】ブロックに反映。 */
  era?: Era | null;
  /** 色戦略（null / 省略 = 設定なし）。肯定系は【色戦略】ブロック、否定系は NG ブロックに追加。 */
  colorStrategy?: ColorStrategy | null;
  /** 絵柄スタイル（null / 省略 = 設定なし）。【絵柄】ブロックに反映。 */
  artStyle?: ArtStyle | null;
  /**
   * 直近の生成で使われたジャンルID（マンネリ回避エンジン用）。
   * クライアントが localStorage で保持し往復させる。新しいものほど先頭。
   * varietyEngine がこれを回避してジャンルを抽選する。
   */
  recentGenres?: string[];
  /**
   * 直近の生成で使われた衣装サブジャンルID（outfitSubStyles 用）。
   * クライアントが localStorage で保持し往復させる。
   * planSubStylesForBatch がこれを回避してサブジャンルを抽選する。
   */
  recentSubStyles?: string[];
  /**
   * お気に入り学習で抽出された「好みの傾向」フレーズ（日本語）。
   * 空/未指定 = お気に入り学習OFF。コピーではなく方向性として反映する。
   */
  favoriteTraits?: string[];
  /** お気に入り反映強度：1=弱め / 2=標準 / 3=強め。省略時は 2。 */
  favoriteStrength?: number;
  /**
   * ZOZOトレンド（衣装にのみ反映）。
   * 抽象的なトレンド属性のみ。ブランド名・商品名は含まない。
   * outfit スコープ選択時のみ反映される。
   */
  zozoTrend?: { ageLabel: string; traits: string[]; mode?: "assist" | "priority" };
  /**
   * 神引き補助モディファイア（複数選択可）。
   * "avoid_overlap" | "other_world" | "buzz" | "face_pop"
   * プロンプト生成時に補助指示として追加される。変更範囲・固定ルールは最優先で維持。
   */
  boosts?: string[];
  /**
   * 重複制御（頻出モチーフの出現制御レベル）。
   * level: 0完全NG / 1強抑制 / 2やや抑制 / 3注意 / 5積極許可（4=許可は送らない）。
   * 完全NG(0)のトークンは ngList にも追加済み。
   */
  motifControls?: { label: string; level: number }[];
  /**
   * 頻出構成（モチーフの組み合わせ）の制御。
   * policy: "block"=同時使用禁止 / "alt"=出そうな時は別ジャンルへ振る。
   */
  comboControls?: { labels: string[]; policy: "block" | "alt" }[];
  /**
   * 風の強さ：0=無風 / 1=微風 / 2=ややなびく / 3=標準 / 4=強め / 5=強風。
   * 髪・衣装・前景演出・ポーズ・カメラのいずれかが変更範囲ONの時のみ反映。
   */
  windLevel?: number;
  /**
   * 色ごとのポリシー（旧構造、互換のため残す。3=普通は送らない）。
   * "restrict" = できるだけ控える / "block" = 一発禁止（候補から除外）。
   * block の色は ngList にもキーワードが追加される。
   * @deprecated 新規実装は colorWeights を使う。
   */
  colorControls?: { colorId: string; jp: string; policy: "restrict" | "block" }[];
  /**
   * 色×軸の重み制御（髪/服/背景それぞれ 0〜5、3=普通は送らない）。
   * 0 = 完全禁止 / 1 = 強抑制 / 2 = 抑制 / 4 = 推奨 / 5 = 強推奨
   * 同一色でも軸ごとに異なる重みを取れる（例：白系は髪は禁止だが背景は推奨）。
   */
  colorWeights?: {
    colorId: string;
    jp:      string;
    axis:    "hair" | "outfit" | "background";
    weight:  0 | 1 | 2 | 4 | 5;
  }[];
  /**
   * 画像分析（生成結果画像）からの偏り情報。
   * - overused: 出現率が高すぎる（ratio>=0.40）カテゴリ → プロンプトで回避指示
   * - underused: まだ使われていないカテゴリ → 候補として提案
   * - visualDupCount: 視覚的に酷似した画像クラスタの最大サイズ
   */
  imageBias?: {
    overused?:  { axis: string; label: string; ratio: number }[];
    underused?: { axis: string; label: string }[];
    visualDupCount?: number;
  };
  /**
   * 好みプロファイル（実 AI 分析結果）。
   * Gemini Flash で分析した「好む傾向 / 嫌う傾向 / 優先・回避キーワード」。
   */
  preferenceProfile?: {
    generatedAt: number;
    model: string;
    sampleSize: number;
    likes:    { bg: string; outfit: string; pose: string };
    dislikes: { bg: string; outfit: string; pose: string };
    preferKeywords: string[];
    avoidKeywords:  string[];
    summary: string;
  };
  /**
   * ユーザー画像評価（👍/😐/👎/💀）から導出した方向性ヒント。
   * - recommended: 高評価が多いカテゴリ（score>=1, サンプル>=2）
   * - avoid:       低評価が多いカテゴリ（score<=-1, サンプル>=2）
   * クライアント側で「変更範囲ONの軸のみ」フィルタ済みのものを送る。
   *
   * preference: 軸別👍👎の集計レポート（30件以上で active=true）。
   * 背景/衣装/ポーズの 3軸について、ユーザーの好む傾向／嫌う傾向を直接示す。
   */
  ratingBias?: {
    recommended?: { axis: string; label: string; score: number }[];
    avoid?:       { axis: string; label: string; score: number }[];
    preference?: {
      active: boolean;
      axes: {
        axis: "bg" | "outfit" | "pose";
        good: number;
        bad: number;
        goodRatio: number;
        badRatio: number;
      }[];
    };
  };
}

export interface GeneratedProposal {
  index: number;
  target: OutputTarget;
  body: string;
  /** マンネリ回避エンジンがこの案に割り当てたジャンルID（recentGenres に往復させる）。 */
  genre?: string;
  /** 割り当てジャンルの日本語ラベル（UI表示用）。 */
  genreLabel?: string;
  /** この案に混ぜた意外性のひとさじ（UI表示用・任意）。 */
  surprise?: string;
  /** outfitSubStyles が割り当てた衣装サブジャンルID（recentSubStyles に往復）。 */
  subStyles?: string[];
}

export interface GenerateResponse {
  proposals: GeneratedProposal[];
  warnings?: string[];
}
