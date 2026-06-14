/**
 * 型定義（フロントエンド）。スカラー型の単一ソースは shared/promptScalars.ts に集約（型ミラー解消・案A / docs §15）。
 * ここでは import（内部利用）＋ re-export し、既存 consumer（import { Scope } from "./types"）を無改修で維持する。
 * 設定 interface（HairSettings 等）はフロント独自の厳密型（名前付きサブ型）のため、引き続き本ファイルで定義する。
 */
import type {
  AutoOr,
  Scope,
  OutputTarget,
  Mood,
  LockKey,
  SafetyMode,
  PromptTarget,
  Count,
  Expression,
  ColorStrategy,
  ArtStyle,
} from "../shared/promptScalars";
export type {
  AutoOr,
  Scope,
  OutputTarget,
  Mood,
  LockKey,
  SafetyMode,
  PromptTarget,
  Count,
  Expression,
  ColorStrategy,
  ArtStyle,
};

// 旧 type Era（グローバル時代軸）は撤去（dead code整理）。乗り物の「年代」(vehicle.era) は別物で存続。

export type HairLength =
  | "short" | "bob" | "medium" | "long" | "extra_long"
  | "very_short" | "wolf_short" | "hime" | "waist_length" | "floor_length" | "asymmetric";

export type HairShape =
  | "straight" | "wave" | "layer" | "twintail" | "ponytail" | "updo"
  | "hime_cut" | "wolf_cut" | "mash" | "flare_bob" | "constrict"
  | "half_twin" | "braid_twin" | "side_braid" | "bun_twin"
  | "high_ponytail" | "low_ponytail" | "braid" | "jellyfish"
  | "heavy_layer" | "cyber_bob";

export type HairTexture =
  | "silky" | "wet" | "fluffy" | "sharp" | "cyber"
  | "semi_wet" | "transparent" | "high_gloss" | "matte" | "airy"
  | "bundle_strand" | "glass" | "cyber_glow";

export type HairColorMode = "lock" | "subtle" | "bold" | "auto" | "skip";

export type HairColor =
  | "inherit" | "black" | "brown" | "blonde" | "ash" | "red" | "pink" | "blue" | "silver" | "rainbow"
  | "black_red_mesh" | "black_blue_mesh" | "black_purple_mesh" | "white_silver" | "milk_tea"
  | "teal_gradient" | "pink_gradient" | "inner_color" | "hem_color"
  | "neon_color" | "aurora_color" | "rainbow_mesh"
  | "white" | "purple"
  | "white_aqua" | "black_aqua_grad" | "black_teal_mesh";

export type HairBangs =
  | "full" | "swept" | "airy" | "curtain" | "blunt" | "none"
  | "hime_bangs" | "asymmetric" | "center_part" | "face_layer" | "antenna" | "eye_cover";

export type HairTips =
  | "natural" | "inner_curl" | "outer_curl" | "wave" | "blunt" | "feathered"
  | "strong_wave" | "loose_wave" | "random_curl" | "sharp";

export type HairVolume =
  | "flat" | "natural" | "volume" | "extra_volume"
  | "low_volume" | "heavy" | "light" | "floating" | "wind"
  | "water_float" | "tip_flow" | "one_side_flow";

export type HairAccessory =
  | "none" | "hairpin" | "ribbon" | "flower" | "ears" | "headphones" | "cap" | "circlet"
  | "fox_kanzashi" | "metal_clip" | "cyber_ring" | "japanese_kanzashi" | "veil" | "chain_accessory";

/** 髪型のスタイル系統（時代・文化・世界観） */
export type HairStyle =
  | "modern" | "y2k" | "heisei_gal" | "retro" | "showa_idol" | "taisho_roman"
  | "wa_gothic" | "cyberpunk" | "near_future" | "magical_girl" | "gothic_lolita"
  | "street" | "korean" | "anime" | "doll" | "viral" | "unique";

export interface HairSettings {
  length: AutoOr<HairLength>;
  shape: AutoOr<HairShape>;
  texture: AutoOr<HairTexture>;
  colorMode: HairColorMode;
  color: AutoOr<HairColor>;
  bangs: AutoOr<HairBangs>;
  tips: AutoOr<HairTips>;
  volume: AutoOr<HairVolume>;
  accessory: AutoOr<HairAccessory>;
  /** スタイル系統（時代感・世界観）。省略時は skip 扱い。 */
  hairStyle?: AutoOr<HairStyle>;
}

export type OutfitStyle =
  | "street"
  | "mode"
  | "cyber"
  | "japanese"
  | "gothic"
  | "military"
  | "techwear"
  | "dress"
  | "armor"
  | "y2k"
  | "lolita"
  | "uniform"
  | "future_dress"
  | "wa_modern"
  | "idol"
  | "runway";
export type OutfitExposure = "low" | "normal" | "high" | "shoulder_off" | "long_sleeve" | "high_neck";
export type OutfitMaterial =
  | "leather"
  | "nylon"
  | "metal"
  | "transparent"
  | "cloth"
  | "enamel"
  | "denim"
  | "chiffon"
  | "velvet"
  | "pvc"
  | "lace"
  | "knit"
  | "organza"
  | "liquid_metal"
  | "crystal_glass"
  | "neon_fabric";
export type OutfitColor =
  | "black"
  | "white"
  | "red"
  | "blue"
  | "green"
  | "pink"
  | "inherit"
  | "purple"
  | "light_blue"
  | "gold"
  | "silver"
  | "gradient"
  | "accent_color";
export type OutfitSilhouette = "tight" | "oversized" | "minimal" | "ornate" | "a_line" | "flare" | "long_length" | "short_length" | "asymmetric" | "layered";

export type OutfitDecoration = "minimal" | "moderate" | "elaborate" | "maximal" | "ribbon" | "embroidery" | "rhinestone" | "chain_decor" | "frill";
export type OutfitSeason = "spring" | "summer" | "autumn" | "winter" | "seasonless" | "rainy_season" | "midsummer" | "late_autumn" | "snowy_scene";
export type OutfitLuxury = "casual" | "refined" | "luxe" | "couture" | "classical" | "future_luxe";

export interface OutfitSettings {
  style: AutoOr<OutfitStyle>;
  exposure: AutoOr<OutfitExposure>;
  material: AutoOr<OutfitMaterial>;
  color: AutoOr<OutfitColor>;
  silhouette: AutoOr<OutfitSilhouette>;
  decoration: AutoOr<OutfitDecoration>;
  season: AutoOr<OutfitSeason>;
  luxury: AutoOr<OutfitLuxury>;
}

export type BackgroundPlace =
  | "indoor"
  | "alley"
  | "futuristic"
  | "abstract"
  | "nature"
  | "museum"
  | "industrial"
  | "gallery"
  | "atelier"
  | "japanese_room"
  | "garden"
  | "seaside"
  | "forest"
  | "empty_space"
  | "studio"
  | "paper_backdrop"
  | "fabric_backdrop"
  | "old_cinema"
  | "greenhouse"
  | "rooftop"
  | "library"
  | "rainy_station"
  | "night_amusement"
  | "frosted_room";
export type BackgroundColor =
  | "inherit"
  | "blue"
  | "green"
  | "red"
  | "pink"
  | "monochrome"
  | "white"
  | "black"
  | "beige"
  | "gold"
  | "light"
  | "low_sat"
  | "high_sat"
  | "pastel"
  | "vivid"
  | "earth";
export type BackgroundDensity = "minimal" | "normal" | "dense";
export type BackgroundEffect =
  | "glitch"
  | "particles"
  | "fog"
  | "reflection"
  | "geometric"
  | "distortion"
  | "watercolor_bleed"
  | "ink_bleed"
  | "brushstroke"
  | "paper_texture"
  | "canvas_texture"
  | "collage"
  | "negative_space"
  | "abstract_lines"
  | "color_planes"
  | "modern_art_effect"
  | "handdrawn"
  | "fabric_flow"
  | "light_rays"
  | "shadow_pattern"
  | "water_reflection";
export type BackgroundStyle =
  | "photorealistic"
  | "watercolor"
  | "ink_wash"
  | "oil_painting"
  | "acrylic"
  | "modern_art"
  | "contemporary_art"
  | "abstract_art"
  | "cubism"
  | "collage"
  | "poster"
  | "minimal"
  | "simple"
  | "washi"
  | "canvas"
  | "gradient"
  | "monochrome"
  | "pastel"
  | "cyber"
  | "digital";

export type BackgroundTime =
  | "morning"
  | "noon"
  | "golden_hour"
  | "dusk"
  | "night"
  | "midnight"
  | "dawn";
export type BackgroundWeather = "clear" | "cloudy" | "rainy" | "snowy" | "stormy" | "foggy";
export type BackgroundDepth = "shallow" | "moderate" | "deep" | "extreme";
export type BackgroundInfo = "sparse" | "balanced" | "rich" | "maximalist";

/** 文字背景の種類 */
export type BgTextType =
  | "kanji"
  | "calligraphy"
  | "old_document"
  | "washi_text"
  | "scroll"
  | "ink_text"
  | "sanskrit"
  | "talisman"
  | "runes"
  | "latin_typography"
  | "equations"
  | "code_text"
  | "handwritten"
  | "newspaper"
  | "poster_text";

/** 文字背景の雰囲気 */
export type BgTextMood =
  | "japanese"
  | "mystical"
  | "decadent"
  | "contemporary_art"
  | "ancient"
  | "cyber_text"
  | "movie_poster"
  | "magazine_design";

/** 文字の配置 */
export type BgTextLayout =
  | "full_bg"
  | "wall_surface"
  | "floating"
  | "vertical_writing"
  | "horizontal_writing"
  | "diagonal"
  | "circular"
  | "behind_subject"
  | "screen_edge"
  | "blurred";

/** 文字の質感 */
export type BgTextTexture =
  | "ink"
  | "gold_leaf"
  | "carved"
  | "glowing"
  | "translucent"
  | "printed_paper"
  | "painted_wall"
  | "glass_reflection";

export interface BackgroundSettings {
  place:       AutoOr<BackgroundPlace>;
  color:       AutoOr<BackgroundColor>;
  density:     AutoOr<BackgroundDensity>;
  effect:      AutoOr<BackgroundEffect>;
  time:        AutoOr<BackgroundTime>;
  weather:     AutoOr<BackgroundWeather>;
  depth:       AutoOr<BackgroundDepth>;
  info:        AutoOr<BackgroundInfo>;
  style:       AutoOr<BackgroundStyle>;
  /** 文字背景 — 種類（"skip" = 使わない） */
  textType:    AutoOr<BgTextType>;
  /** 文字背景 — 雰囲気 */
  textMood:    AutoOr<BgTextMood>;
  /** 文字背景 — 配置 */
  textLayout:  AutoOr<BgTextLayout>;
  /** 文字背景 — 質感 */
  textTexture: AutoOr<BgTextTexture>;
}

export type PoseType =
  | "stand"
  | "sit"
  | "crouch"
  | "turn"
  | "walk"
  | "float"
  | "action"
  | "lean_wall"
  | "hand_up";
export type PoseImpression =
  | "cool"
  | "cute"
  | "strong"
  | "calm"
  | "dynamic"
  | "sns"
  | "provocative"
  | "fragile"
  | "composed"
  | "tense"
  | "mysterious";
export type PoseHand = "near_face" | "hip" | "extend" | "natural" | "prop" | "touch_hair" | "chest_hand" | "touch_cheek" | "cross_arms" | "pocket";
export type PoseFoot = "natural" | "cross" | "knee" | "walking" | "float" | "tiptoe" | "one_foot_forward";

export type PoseBalance = "centered" | "low" | "high" | "leaning_forward" | "leaning_back" | "off_center" | "one_leg_weight" | "arched" | "relaxed";
export type PoseMotion = "still" | "subtle" | "dynamic" | "explosive" | "mid_action" | "hair_flow" | "cloth_flow" | "mid_turn";
export type PoseGaze = "to_camera" | "away" | "downcast" | "upward" | "side_glance" | "over_shoulder" | "distant" | "diagonal_look" | "look_down";
export type PoseOrientation = "front" | "three_quarter" | "side" | "back" | "diagonal";

export interface PoseSettings {
  type: AutoOr<PoseType>;
  impression: AutoOr<PoseImpression>;
  hand: AutoOr<PoseHand>;
  foot: AutoOr<PoseFoot>;
  balance: AutoOr<PoseBalance>;
  motion: AutoOr<PoseMotion>;
  gaze: AutoOr<PoseGaze>;
  orientation: AutoOr<PoseOrientation>;
}

export type CameraAngle =
  | "front"
  | "diagonal_45"
  | "low"
  | "high"
  | "top_down"
  | "side_profile"
  | "over_shoulder"
  | "close_portrait"
  | "full_body"
  | "dutch"
  | "cinematic"
  | "diagonal_high"
  | "back_view";

export type CameraDistance =
  | "macro" | "close" | "medium" | "far" | "extreme_far"
  | "bust_up" | "knee_up";
export type CameraLens = "wide" | "normal" | "portrait" | "tele" | "fisheye" | "cinema" | "smartphone" | "wide_distort";
export type CameraComposition =
  | "rule_of_thirds"
  | "centered"
  | "diagonal"
  | "symmetric"
  | "leading_lines"
  | "negative_space"
  | "generous_space"
  | "asymmetric"
  | "subject_large"
  | "magazine";
export type CameraFov = "narrow" | "standard" | "wide" | "ultra_wide" | "vertical_sns" | "horizontal_cinema" | "square";
export type CameraEyeHeight = "low" | "waist" | "eye_level" | "above_head" | "ceiling" | "ground" | "chest_height" | "slightly_above";

/**
 * 3D カメラピッカーで指定するインタラクティブ状態。null の時は使用しない（プリセット指定に従う）。
 * 中身の意味は lib/cameraAngle.ts を参照。
 */
export interface Camera3DState {
  yaw: number;
  pitch: number;
  roll: number;
  distance: number;
  composition: "face" | "bust" | "waist" | "full" | "wide";
  preset: string | null;
  /** ポーズ状態（null = デフォルト自然立ち）*/
  pose?: import("./lib/poseLib").PoseState | null;
}

export interface CameraSettings {
  angle: AutoOr<CameraAngle>;
  distance: AutoOr<CameraDistance>;
  lens: AutoOr<CameraLens>;
  composition: AutoOr<CameraComposition>;
  fov: AutoOr<CameraFov>;
  eyeHeight: AutoOr<CameraEyeHeight>;
  /** 3D ピッカーで具体指定したカメラアングル。設定時は他のプリセット指定より優先。 */
  custom3D: Camera3DState | null;
}

export type PropsCategory =
  | "weapon"
  | "cute"
  | "sns"
  | "futuristic"
  | "japanese"
  | "gothic"
  | "daily"
  | "funny"
  | "fashion"
  | "flower"
  | "instrument";
export type PropsHoldMethod =
  | "one_hand"
  | "two_hands"
  | "shoulder"
  | "floating"
  | "on_floor"
  | "in_background"
  | "chest_hold"
  | "near_face_hold";
export type PropsSize = "small" | "medium" | "large" | "huge" | "tiny" | "foreground_large";
export type PropsGlow = "none" | "subtle" | "neon" | "magical" | "edge_glow" | "inner_glow";
export type PropsVibe = "cool" | "cute" | "funny" | "luxury" | "dark" | "sns" | "elegant" | "mysterious" | "retro" | "fragile_vibe";

export type PropsPlacement =
  | "near_subject"
  | "foreground"
  | "midground"
  | "background"
  | "all_around"
  | "blur_foreground"
  | "beside_face"
  | "at_feet"
  | "edge_frame";
export type PropsCount = "single" | "few" | "many" | "scattered" | "both_sides" | "arranged";

export interface PropsSettings {
  category: AutoOr<PropsCategory>;
  hold: AutoOr<PropsHoldMethod>;
  size: AutoOr<PropsSize>;
  glow: AutoOr<PropsGlow>;
  vibe: AutoOr<PropsVibe>;
  placement: AutoOr<PropsPlacement>;
  count: AutoOr<PropsCount>;
}

export type LightDirection =
  | "top"
  | "side"
  | "back"
  | "front"
  | "below"
  | "multi"
  | "rim"
  | "diagonal_above"
  | "window"
  | "spot"
  | "ambient";
export type LightIntensity = "soft" | "normal" | "strong" | "dramatic" | "low_key" | "soft_backlight" | "pale_glow";
export type LightTemperature = "warm" | "neutral" | "cool" | "mixed" | "blue_tone" | "red_tone" | "sunset" | "white_light";
export type LightShadow = "soft" | "sharp" | "long" | "minimal" | "deep" | "drop" | "outline";
export type LightReflection = "matte" | "satin" | "glossy" | "specular" | "wet" | "metal_reflect" | "glass_reflect" | "fabric";
export type LightAtmosphere = "clear" | "hazy" | "foggy" | "dusty" | "particulate" | "after_rain";

// ── Big Object / Large Prop types ─────────────────────────────────────────────

export type BigObjectGenre =
  | "clean"
  | "luxury_display"
  | "art"
  | "foreign"
  | "broken"
  | "ruins"
  | "creepy_cute"
  | "retro_foreign"
  | "movie_prop"
  | "surreal"
  | "lab"
  | "mystic_display";

export type BigObjectType =
  | "stuffed"
  | "display"
  | "sculpture"
  | "lab_equipment"
  | "glass"
  | "architecture"
  | "retro_machine"
  | "stage_prop"
  | "mystic_object"
  | "foreign_object";

export type BigObjectCondition =
  | "brand_new"
  | "clean"
  | "luxury"
  | "aged"
  | "dirty"
  | "torn"
  | "broken"
  | "rusted"
  | "cracked"
  | "wet"
  | "sandy"
  | "faded"
  | "warped"
  | "damaged"
  | "collapsing";

export type BigObjectPlacement =
  | "beside"
  | "holding"
  | "leaning"
  | "sitting"
  | "behind"
  | "foreground"
  | "surrounding"
  | "at_feet"
  | "floating_above"
  | "bg_center"
  | "asymmetric"
  | "deep_bg";

export type BigObjectSize =
  | "medium"
  | "large"
  | "same_as_person"
  | "bigger"
  | "huge"
  | "screen_filling";

export type BigObjectMood =
  | "cute"
  | "luxury"
  | "fantasy"
  | "eerie"
  | "decadent"
  | "cinematic"
  | "ad_visual"
  | "contemporary_art"
  | "lab"
  | "dreamy"
  | "otherworld"
  | "surreal"
  | "dramatic";

export interface BigObjectSettings {
  genre:     AutoOr<BigObjectGenre>;
  type:      AutoOr<BigObjectType>;
  condition: AutoOr<BigObjectCondition>;
  placement: AutoOr<BigObjectPlacement>;
  size:      AutoOr<BigObjectSize>;
  mood:      AutoOr<BigObjectMood>;
}

export interface LightingSettings {
  direction: AutoOr<LightDirection>;
  intensity: AutoOr<LightIntensity>;
  temperature: AutoOr<LightTemperature>;
  shadow: AutoOr<LightShadow>;
  reflection: AutoOr<LightReflection>;
  atmosphere: AutoOr<LightAtmosphere>;
}

export type AspectRatioPreset =
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

export interface AspectRatioSettings {
  preset: AspectRatioPreset;
  customW: number;
  customH: number;
}

// ── Cosplay types ─────────────────────────────────────────────────────────────

export type CosplayGenre =
  | "cute" | "kakkoi" | "cool" | "dark" | "elegant" | "transparent"
  | "luxury" | "street" | "idol" | "fantasy" | "japanese" | "near_future"
  | "gothic" | "battle" | "magic" | "villain" | "doll";

export type CosplayCuteStyle =
  | "magical_girl" | "yumekawa" | "ryousangata" | "jirai" | "lolita"
  | "sweet_lolita" | "hime_kei" | "idol_fashion" | "maid_fashion"
  | "bunny_ears" | "cat_ears" | "fairy_fashion" | "angel_fashion"
  | "heavy_ribbon" | "star_motif";

export type CosplayJobGenre =
  | "magical_girl" | "mage" | "witch" | "knight" | "princess_knight"
  | "ninja" | "samurai" | "shrine_maiden" | "angel" | "demon" | "fairy"
  | "vampire" | "idol" | "maid" | "military" | "phantom_thief" | "pirate"
  | "princess" | "queen" | "warrior" | "assassin" | "android" | "hero" | "bride";

export type CosplayJapaneseStyle =
  | "shrine_maiden" | "fox_shrine_maiden" | "geisha" | "kunoichi" | "samurai_girl"
  | "oni_girl" | "kitsune" | "wa_lolita" | "taisho_western" | "japanese_bride";

export type CosplayFantasyStyle =
  | "elf" | "dark_elf" | "dragon_knight" | "fairy_queen" | "sorceress"
  | "dark_knight" | "holy_knight" | "valkyrie" | "succubus" | "angel_knight"
  | "beastgirl" | "dragon_girl";

export type CosplayScifiStyle =
  | "android" | "cyber_soldier" | "space_captain" | "ai_girl" | "hacker"
  | "power_suit" | "mecha_pilot" | "hologram_idol" | "quantum_mage" | "nano_warrior";

export type CosplayDarkStyle =
  | "gothic_lolita" | "vampire" | "dark_witch" | "death_angel" | "cursed_knight"
  | "fallen_angel" | "demon_queen" | "plague_doctor" | "revenant" | "undead_bride";

export type CosplayOccupation =
  | "nurse" | "police" | "bunny_girl" | "magician" | "chef"
  | "teacher" | "nun" | "spy" | "pilot" | "cheerleader";

export type CosplayDecoration =
  | "minimal" | "moderate" | "elaborate" | "maximal" | "armored";

export type CosplayItem =
  | "wand" | "staff" | "sword" | "shield" | "bow" | "gun"
  | "book" | "potion" | "crown" | "wings" | "tail" | "ears"
  | "scythe" | "lantern" | "orb";

export type CosplayExposure = "modest" | "bold";

export type CosplayColorDir =
  | "inherit" | "white" | "black" | "red" | "blue" | "pink"
  | "purple" | "gold" | "silver" | "rainbow";

export interface CosplaySettings {
  genre:         AutoOr<CosplayGenre>;
  cuteStyle:     AutoOr<CosplayCuteStyle>;
  jobGenre:      AutoOr<CosplayJobGenre>;
  japaneseStyle: AutoOr<CosplayJapaneseStyle>;
  fantasyStyle:  AutoOr<CosplayFantasyStyle>;
  scifiStyle:    AutoOr<CosplayScifiStyle>;
  darkStyle:     AutoOr<CosplayDarkStyle>;
  occupation:    AutoOr<CosplayOccupation>;
  decoration:    AutoOr<CosplayDecoration>;
  item:          AutoOr<CosplayItem>;
  /** UIでは「おまかせ」ボタンを表示しない（露出は常に控えめ以上を保証） */
  exposure:      CosplayExposure | "skip";
  colorDir:      AutoOr<CosplayColorDir>;
}

// ── Foreground Effects types ──────────────────────────────────────────────────

export interface ForegroundSettings {
  /** プリセット（一括設定） */
  preset: AutoOr<
    | "buzz" | "god" | "subtle" | "flashy" | "fantasy" | "cyber"
    | "japanese" | "dark" | "translucent" | "art" | "watercolor"
    | "text_effect" | "light" | "flower"
  >;
  /** エフェクト種類（散布系） */
  effectType: AutoOr<
    | "petals" | "sakura" | "rose" | "camellia" | "higanbana"
    | "feather" | "down" | "snow" | "rain" | "bubble" | "drop"
    | "glass" | "confetti" | "spark" | "ash" | "light_particle"
    | "stardust" | "butterfly" | "jellyfish" | "foxfire" | "spirit_fire"
    | "red_mist" | "blue_mist" | "black_smoke" | "white_smoke" | "light_feather"
    | "fabric_strip" | "transparent_ribbon" | "smoke_puff"
  >;
  /** 回転・渦系エフェクト */
  swirlType: AutoOr<
    | "light_ring" | "energy_vortex" | "magic_circle" | "aura_swirl"
    | "particle_swirl" | "cable_swirl" | "wire_swirl" | "ink_vortex"
    | "water_vortex" | "fire_vortex" | "petal_vortex" | "butterfly_swirl"
    | "circular_hud" | "multi_ring" | "light_trail" | "ribbon_light" | "ripple"
    | "light_thread"
  >;
  /** HUD・デジタル系エフェクト */
  digitalType: AutoOr<
    | "ui_hologram" | "scanline" | "numbers" | "code_text" | "glitch_text"
    | "japanese_typography" | "alphanumeric_typography" | "glitch" | "target_ui"
    | "circular_hud" | "waveform" | "data_stream" | "geometric"
    | "hologram_panel" | "transparent_window" | "circuit_lines" | "digital_noise"
  >;
  /** アート表現系エフェクト */
  artType: AutoOr<
    | "watercolor_splash" | "ink_splash" | "paint_splash" | "brushstroke"
    | "ink_line" | "collage" | "paper_texture" | "modern_art_line"
    | "abstract_shape" | "color_plane" | "cubism_fragment" | "glass_abstract"
    | "fragment" | "glowing_lineart" | "handdrawn" | "transparent_acrylic"
  >;
  /** エフェクトの位置 */
  position: AutoOr<
    | "face_area" | "shoulder" | "arm" | "hand" | "avoid_chest"
    | "waist" | "feet" | "full_body" | "full_screen" | "one_side"
    | "center" | "surrounding" | "back_to_front" | "diagonal" | "rising" | "falling"
  >;
  /** 密度 */
  density: AutoOr<"minimal" | "subtle" | "normal" | "rich" | "max">;
  /** 動き */
  motion: AutoOr<
    | "still" | "gentle_flow" | "rotate" | "vortex" | "explode"
    | "radiate" | "falling" | "rising" | "diagonal" | "wave"
    | "attract" | "exit" | "surround" | "from_hands"
  >;
  /** 色方向 */
  color: AutoOr<
    | "inherit" | "blue_white" | "red_black" | "pink_purple" | "cyan"
    | "gold" | "white_light" | "rainbow" | "pastel" | "monochrome"
    | "low_sat" | "high_sat" | "match_bg" | "match_outfit"
  >;
  /** 奥行き */
  depth: AutoOr<
    | "front_only" | "around_subject" | "front_back_overlap"
    | "shallow" | "deep" | "bg_to_fg" | "bokeh_front"
    | "near_particles" | "far_particles"
  >;
  /** 視認性（顔・目を隠さない等） */
  visibility: AutoOr<
    | "face_protected" | "eyes_protected" | "outline_enhanced"
    | "subtle_face" | "strong_bg" | "emphasize_hands"
    | "emphasize_edges" | "subtle_center"
  >;
}

// ── Cyber / Mechanization types ───────────────────────────────────────────────

export type CyberPart =
  | "one_arm" | "both_arms" | "hand" | "finger" | "shoulder" | "neck"
  | "back" | "leg" | "one_leg" | "eye" | "cheek" | "hair_part" | "outfit_part" | "body_part";

export type CyberType =
  | "cyborg" | "robot_arm" | "robot_leg" | "android_armor" | "mech_parts"
  | "cable_exposure" | "glow_circuit" | "transparent_body" | "metal_skeleton"
  | "hologram" | "digital_decomp" | "polygon_mesh" | "wireframe" | "blueprint"
  | "cad" | "xray" | "circuit_board" | "glitch" | "data_stream" | "nanomachine" | "glass_mech";

export type CyberTexture =
  | "metal" | "black_metal" | "white_ceramic" | "transparent_glass"
  | "carbon" | "chrome" | "matte_metal" | "gloss_metal" | "glow_material" | "translucent";

export type CyberGlowColor =
  | "blue" | "cyan" | "purple" | "red" | "pink" | "green" | "white" | "gold" | "rainbow";

export type CyberIntensity = "subtle" | "normal" | "strong" | "bold";

export interface CyberSettings {
  part:      AutoOr<CyberPart>;
  type:      AutoOr<CyberType>;
  texture:   AutoOr<CyberTexture>;
  glowColor: AutoOr<CyberGlowColor>;
  /** 変化量：UIでは「おまかせ」ボタンを表示しない */
  intensity: CyberIntensity | "skip";
}

// ── Vehicle types ──────────────────────────────────────────────────────────────

export type VehicleGenre =
  | "land" | "air" | "sea" | "space" | "amusement"
  | "historical" | "near_future" | "fictional_mech"
  | "robot" | "military_display" | "fantasy";

export type VehicleType =
  // 陸
  | "bicycle" | "motorcycle" | "scooter" | "sports_car" | "classic_car"
  | "vintage_car" | "limousine" | "jeep" | "train" | "bus" | "tuk_tuk"
  // 空
  | "fighter_jet" | "small_plane" | "helicopter" | "hot_air_balloon"
  | "glider" | "drone" | "blimp"
  // 海
  | "yacht" | "motor_boat" | "cruiser" | "sailing_ship" | "rowboat"
  // 宇宙
  | "spaceship" | "rocket" | "space_station"
  // 遊具
  | "merry_go_round" | "miniature_train" | "gondola" | "carousel_horse"
  // 歴史系
  | "horse_carriage" | "rickshaw" | "galleon" | "steam_locomotive" | "roman_chariot"
  // 近未来
  | "hover_bike" | "capsule_car" | "maglev_train" | "flying_car" | "jet_pack_suit"
  // 架空メカ
  | "sky_fortress" | "giant_mech" | "transformation_mech"
  // ロボット
  | "cockpit_robot" | "mech_suit" | "walker_mech"
  // ミリタリー（展示のみ）
  | "armored_vehicle_display" | "tank_display"
  // ファンタジー
  | "dragon" | "pegasus" | "magic_carpet" | "giant_turtle" | "sky_whale" | "flying_island";

export type VehicleInteraction =
  | "riding" | "sitting_on" | "standing_beside" | "leaning_on"
  | "in_background" | "far_background" | "through_window"
  | "shadow_only" | "reflection_only" | "giant_backdrop";

export type VehicleEra =
  | "modern" | "retro" | "near_future" | "far_future"
  | "historical" | "fantasy" | "steampunk";

export type VehicleMaterial =
  | "metal" | "chrome" | "matte_metal" | "transparent" | "carbon"
  | "rust_vintage" | "wood" | "glowing" | "organic" | "crystal";

export type VehicleAtmosphere =
  | "cool" | "cute" | "pop" | "dark" | "elegant"
  | "luxury" | "adventure" | "cinematic" | "serene";

export interface VehicleSettings {
  genre:       AutoOr<VehicleGenre>;
  type:        AutoOr<VehicleType>;
  interaction: AutoOr<VehicleInteraction>;
  era:         AutoOr<VehicleEra>;
  material:    AutoOr<VehicleMaterial>;
  atmosphere:  AutoOr<VehicleAtmosphere>;
}

// ── Myth / Mythical creature types ────────────────────────────────────────────

export type MythRegion =
  | "japanese" | "chinese" | "egyptian" | "greek" | "norse" | "celtic"
  | "indian" | "middle_east" | "western_fantasy" | "oceanic" | "world_mix";

export type MythCreature =
  | "divine_beast" | "guardian" | "dragon" | "bird" | "serpent" | "wolf"
  | "cat" | "giant" | "spirit" | "phantom_beast" | "god" | "demigod"
  | "mech_myth" | "future_myth";

export type MythInteraction =
  | "bg_giant" | "far_distance" | "behind_subject" | "surrounding"
  | "on_shoulder" | "standing_beside" | "guarding" | "flying_above"
  | "looking_down" | "riding" | "summoning" | "silhouette_only"
  | "shadow_only" | "glow_aura_only" | "partial_reveal";

export type MythStyle =
  | "realistic" | "fantasy" | "cinematic" | "anime" | "mystic" | "dark"
  | "luxury" | "art" | "near_future" | "wa_modern" | "epic" | "ad_visual";

export type MythSize =
  | "small" | "shoulder_size" | "human_size" | "giant" | "colossal"
  | "sky_filling" | "distant_giant";

export interface MythSettings {
  region:      AutoOr<MythRegion>;
  creature:    AutoOr<MythCreature>;
  interaction: AutoOr<MythInteraction>;
  style:       AutoOr<MythStyle>;
  size:        AutoOr<MythSize>;
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
  bigObject: BigObjectSettings;
  vehicle: VehicleSettings;
  myth: MythSettings;
  lighting: LightingSettings;
  aspectRatio: AspectRatioSettings;
  /**
   * 複数選択オーバーライド。キーは "scope.field" 形式（例: "cyber.part"）。
   * 2個以上選択時のみエントリが存在する。1個以下はフィールド本体の値を使う。
   * 最大3項目。
   */
  multiOverrides?: Record<string, string[]>;
  /**
   * オプション単位の NG（ダブルクリックで設定）。キーは "scope.field" 形式（multiOverrides と同形）。
   * 値はそのフィールドで NG 指定されたオプション id の配列。NG 項目は UI で選択不可になり、
   * 選択値（単一/複数）に乗らないため生成プロンプトに出ない（ネガティブにも入れない＝単純に無視）。
   */
  ngOptions?: Record<string, string[]>;
}

// ── Texture / Dimension slider types ────────────────────────────────────────
// 旧 TextureMode / DimensionMode / DetailTextureLevel / DetailDimensionLevel は削除。
// 新しい UI は 5段階スライダー + 元画像維持フラグ + 反映しないフラグ の4フィールド。

export interface PromptInputs {
  scopes: Scope[];
  target: OutputTarget;
  /** プロンプト安全フィルタモード（省略時 = "chatgpt_safe"）*/
  promptTarget?: PromptTarget;
  moods: Mood[];
  /**
   * おまかせ設定のカテゴリ名一覧（例: ["基本", "色味"]）。
   * 該当カテゴリの雰囲気は案ごとに自然に変化させる指示をサーバが追加する。
   */
  autoMoodCategories?: string[];
  count: Count;
  locks: Record<LockKey, boolean>;
  safety: SafetyMode;
  details: DetailSettings;
  extraInstructions: string;
  /** 顔絶対固定ロック（初期ON）。強い顔固定文言を system prompt に注入。 */
  faceLock: boolean;
  /**
   * 表情指定（faceLock: false 時のみ有効）。
   * null = 顔の造形のみ維持・表情は自然なものに。
   */
  expression?: Expression | null;
  /** 入れたくない要素（自由入力）。ChatGPT版では【NG】、Nano版では短く反映。 */
  ngList: string;
  /** 🔥 一発バズりで自動セットされるモード。サーバ側で専用プールから抽選する指示を入れる。 */
  viralMode: boolean;
  /**
   * Prompt Strength (1〜5)。サーバ側で変更度合いの指示に反映される。
   * 1=原型維持 3=標準 5=最大変化。省略時は 3 と同じ扱い。
   */
  strength?: number;
  /** 光沢感 1-5（1=マット 2=ややマット 3=標準 4=光沢 5=強光沢）。3=標準はプロンプト非出力。 */
  glossLevel?: number;
  /** 立体感 1-5（1=2D 2=やや2D 3=2.5D 4=やや3D 5=3D）。3=2.5Dはプロンプト非出力。
   * 互換のため残しているが、UIから露出はしない。代わりに realismLevel を使う。 */
  dimensionLevel?: number;
  /**
   * 質感・リアル度 1-5（1=完全2Dイラスト / 2=デジタルペイント / 3=2.5D（既定）/ 4=リアル寄り / 5=写真リアル）。
   * 「背景だけリアルすぎる問題」を防ぐため、人物と背景の質感統一を最優先する。
   * scope（背景/衣装/カメラ/ライティング）に応じて、各軸の質感プロンプトに反映される。
   * 3（2.5D）はプロンプト非出力（既定値なので不要）。
   */
  realismLevel?: number;
  /**
   * 質感タイプ（任意）。realismLevel と組み合わせて、より具体的な絵柄を指定する。
   * null/未指定 = タイプ指定なし（realismLevel のみで決定）。
   */
  realismType?: string | null;
  /** 元画像維持モード：true のとき両スライダーを無視して「元画像の質感と立体感を維持」 */
  textureOriginal?: boolean;
  /** プロンプトに反映しない：true のとき質感ブロックを出力しない */
  textureDisabled?: boolean;
  /**
   * 量産構図回避モード（初期ON）。
   * ゴシック×教会×黒バラ、白服×羽×魔法陣 などの定番すぎる組み合わせを避け、
   * 背景・小物・演出をひとひねりした方向にズラす指示をサーバが追加する。
   * 完全禁止ではなく、頻度を下げてバリエーションを広げる。
   */
  avoidCliche?: boolean;
  /**
   * リアル背景回避（true = 有効・既定ON）。背景が変更対象（scopes に background）の時だけ、
   * 実写風の住宅街・路地・生活感ある背景を強め抑制し、映画的・デザイン的・非写真的背景へ誘導する。
   * 背景がscope外（背景固定）の時は適用されない。省略時は true 扱い。
   */
  avoidRealBackground?: boolean;
  /**
   * 色戦略（null = 設定なし）。
   * 肯定系は【色戦略】ブロックに、否定系は【NG指定】ブロックに追加される。
   */
  colorStrategy?: ColorStrategy | null;
  /**
   * 絵柄スタイル（null = 設定なし）。
   * 【絵柄】ブロックに反映され、全体の描画スタイルを制御する。
   */
  artStyle?: ArtStyle | null;
  /**
   * お気に入り学習で抽出した好み傾向フレーズ（日本語）。
   * 空/未指定 = 反映なし。サーバは方向性のみ反映（コピー禁止・変更範囲内・固定優先）。
   */
  favoriteTraits?: string[];
  /** お気に入り反映強度：1=弱め / 2=標準 / 3=強め。 */
  favoriteStrength?: number;
  /**
   * ZOZOトレンド（衣装にのみ反映。outfit スコープON時のみ送信）。
   * 抽象的なトレンド属性のみでブランド名は含まない。
   */
  zozoTrend?: { ageLabel: string; traits: string[]; mode?: "assist" | "priority" };
  /**
   * 神引き補助モディファイア（複数選択可）。
   * "avoid_overlap" | "other_world" | "buzz" | "face_pop"
   * 補助指示として追加。顔固定・変更範囲・固定ルールは最優先で維持される。
   */
  boosts?: string[];
  /**
   * 重複制御（頻出モチーフの出現制御レベル）。
   * level: 0完全NG / 1強抑制 / 2やや抑制 / 3注意 / 5積極許可（4=許可は送らない）。
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
   * 色ごとのポリシー（旧構造・互換のため残す）。
   * @deprecated 新規実装は colorWeights を使う。
   */
  colorControls?: { colorId: string; jp: string; policy: "restrict" | "block" }[];
  /**
   * 色×軸の重み制御（髪/服/背景それぞれ 0〜5、3=普通は送らない）。
   * 0 = 完全禁止 / 1 = 強抑制 / 2 = 抑制 / 4 = 推奨 / 5 = 強推奨
   */
  colorWeights?: {
    colorId: string;
    jp:      string;
    axis:    "hair" | "outfit" | "background";
    weight:  0 | 1 | 2 | 4 | 5;
  }[];
  /**
   * 画像分析バイアス（生成結果画像由来）。
   * 視覚的重複・カテゴリ偏りをサーバ側プロンプトに渡す。
   */
  imageBias?: {
    overused?:  { axis: string; label: string; ratio: number }[];
    underused?: { axis: string; label: string }[];
    visualDupCount?: number;
  };
  /**
   * 好みプロファイル（実 AI 分析結果）。
   * Gemini Flash で実際に分析した「好む傾向 / 嫌う傾向 / 優先・回避キーワード」を渡す。
   * 未分析時は undefined。
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
   * ユーザー画像評価バイアス（👍/😐/👎/💀）から導いた方向性ヒント。
   * 「変更範囲ONの軸のみ」フィルタ済みのものを送る。
   * preference: 軸別👍👎レポート（30件以上で active=true）
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
  /** マンネリ回避エンジンが割り当てたジャンルID（recentGenres に往復させる）。 */
  genre?: string;
  /** 割り当てジャンルの日本語ラベル（UI表示用）。 */
  genreLabel?: string;
  /** この案に混ぜた意外性のひとさじ（UI表示用・任意）。 */
  surprise?: string;
  /** 衣装サブジャンルID（outfitSubStyles → recentSubStyles に往復）。 */
  subStyles?: string[];
  /** サーバ側スコープフィルタで削除した項目（UI表示用）。 */
  scopeFilter?: ServerScopeFilterSummary;
  /** Identity Shield の結果（UI表示用）。 */
  identityShield?: IdentityShieldSummary;
}

/** サーバ側スコープフィルタの要約（最終出力前に削除したもの） */
export interface ServerScopeFilterSummary {
  removedItems: { category: string; text: string; reason: string; severity: string }[];
  warnings: string[];
}

/** Identity Shield の要約（追加した同一性保護文・リスク） */
export interface IdentityShieldSummary {
  riskScore: number;
  riskLevel: string;
  addedIdentityClauses: string[];
  reasons: string[];
  warnings: string[];
}

export interface GenerationResult {
  proposals: GeneratedProposal[];
  negative?: string;
}

export type HistoryStatus = "unused" | "used" | "good" | "bad" | "posted";

/**
 * 生成結果画像の AI 仮評価（Gemini Vision・サーバ /api/analyze-result の戻り値）。
 * ユーザー評価（resultRatings 等）とは分離した「仮評価」。確定はユーザー操作時のみ。
 * server/src/analyzeResult.ts の ResultAnalysis と構造を一致させる。
 */
export interface ResultAnalysis {
  version: 1;
  model: string;
  analyzedAt: number;
  faceMatch:            "good" | "normal" | "bad";
  identitySafety:       "ok" | "caution" | "risk";
  outfitStructure:      string;
  outfitColorScheme:    "monotone" | "good" | "complex";
  topBottomSeparation:  "yes" | "weak" | "no";
  outerInnerSeparation: "yes" | "weak" | "no";
  monotone:             "low" | "mid" | "high";
  backgroundType:       string;
  backgroundRealism:    "strong" | "normal" | "weak";
  stylization:          "strong" | "normal" | "weak";
  colorBias:            "yes" | "no";
  colorBiasNote:        string;
  foregroundIntensity:  "low" | "mid" | "high";
  subjectPriority:      "high" | "normal" | "low";
  templateRisk:         "high" | "normal" | "low";
  skyveilPreference:    "strong" | "normal" | "weak";
  improvement:          string;
}

/** IndexedDB に保存される 1 案単位の履歴アイテム。 */
export interface PromptHistoryItem {
  id: string;
  batchId: string;          // 同じ「生成」操作で出た案をグループ化
  createdAt: number;        // unix ms
  dateKey: string;          // YYYY-MM-DD（ローカル時刻）

  sourceImageThumbnail: string | null; // 圧縮サムネ
  /**
   * 生成結果画像（ChatGPT / Gemini 等で生成後に登録）。
   * 旧フィールド：互換のため残す。新フィールド resultImageDataList の 1 枚目と必ず同期させる。
   * （リスト形式に移行後もここを参照する箇所が多いため null/string で維持）
   */
  resultImageData: string | null;
  /**
   * 生成結果画像のリスト（最大3枚）。
   * 1案あたり同じプロンプトで複数回生成した結果を並べて登録できる。
   * 空配列または未定義 = まだ登録なし（resultImageData も null）。
   */
  resultImageDataList?: string[];
  /**
   * 生成結果画像ごとのユーザー評価（resultImageDataList と同じインデックス）。
   *   5 = 良い(good)、3 = まあまあ(normal)、2 = 微妙(weak)、1 = 失敗(bad)、null = 未評価
   *   ※ お気に入り（PromptHistoryItem.isFavorite）は案カード単位の最高評価。
   *      評価=5 とは併用可能（評価は画像単位の独立シグナル）。
   * length は resultImageDataList と一致させるが、保存時に同期する。
   */
  resultRatings?: (number | null)[];
  /**
   * 生成結果画像ごとの評価メモ（任意の短い文章）。
   * resultImageDataList と同じインデックス。空文字や null は「メモなし」。
   */
  resultMemos?: (string | null)[];
  /**
   * 軸別評価（👍=5 / 👎=1 / null=未評価）。
   * 全体評価（resultRatings）の補助として、画像単位で「背景・衣装・ポーズ」の
   * どこが良かった/悪かったかを別々に記録する。
   * 30件以上集まると「好み分析レポート」が有効化され、自動補正の根拠になる。
   */
  resultBgRatings?:     (number | null)[];
  resultOutfitRatings?: (number | null)[];
  resultPoseRatings?:   (number | null)[];
  /**
   * 生成結果画像ごとの AI 仮評価（Gemini Vision）。resultImageDataList と同じインデックス。
   * ユーザーが「AI分析」を押した画像だけ埋まる（未分析は null）。ユーザー評価とは分離。
   * 追加 optional フィールド＝既存履歴/お気に入り/評価/IDB構造は非破壊。
   */
  resultAiAnalysis?: (ResultAnalysis | null)[];
  generatedResultAddedAt?: number;     // 生成結果を登録した unix ms

  /**
   * 派生元情報（アレンジ結果から保存した場合に付与）。
   * - derivedFromId: アレンジ元 PromptHistoryItem の ID
   * - derivedFromDate: 元アイテムの createdAt（表示用）
   * - arrangeCaseNumber: アレンジ案番号（1始まり）
   * - arrangeUsedScopes: アレンジ時に「使用した」スコープ一覧
   * - arrangeExcludedScopes: アレンジ時に「除外した」スコープ一覧
   */
  derivedFromId?:           string;
  derivedFromDate?:         number;
  arrangeCaseNumber?:       number;
  arrangeUsedScopes?:       Scope[];
  arrangeExcludedScopes?:   Scope[];

  outputType: OutputTarget;
  promptText: string;
  proposalIndex: number;

  // 生成時の設定スナップショット
  scopes: Scope[];
  moods: Mood[];
  count: Count;
  details: DetailSettings;
  locks: Record<LockKey, boolean>;
  safety: SafetyMode;
  extraInstructions: string;
  faceLock: boolean;
  ngList: string;
  viralMode: boolean;

  // ユーザーメタデータ
  isFavorite: boolean;
  status: HistoryStatus;
  memo: string;
  tags: string[];
  copied?: boolean;      // 一度コピーしたらずっと true（リロードまで保持）
  isProtected?: boolean; // true の場合は自動クリーンアップ対象外
  updatedAt?: number;    // 最終更新 unix ms
  locked?: boolean;          // 🔒 固定（アレンジベース候補としてハイライト）
  strength?: number;         // Prompt Strength (1〜5) 生成時の設定値
  glossLevel?: number;
  dimensionLevel?: number;
  /** 質感・リアル度 1-5（1=完全2D / 5=写真リアル）。3=2.5D は標準なので非出力。 */
  realismLevel?: number;
  /** 質感タイプ（"anime_bg" など、null=指定なし） */
  realismType?: string | null;
  textureOriginal?: boolean;
  textureDisabled?: boolean;
  presetName?: string;       // 生成時に使用したプリセット名
  promptTarget?: PromptTarget; // 生成時の出力先安全モード

  /**
   * 「同じ構成で再生成」用の追加スナップショット。
   * PromptHistoryItem に直接載っていない設定値（風・ZOZO・ブースト等）を保存する。
   * 古い履歴には存在しないため optional。
   */
  settingsSnapshot?: {
    windLevel?: number;
    /** 反映中の ZOZOトレンド（null = 未反映） */
    zozoApplied?: import("./lib/zozoTrend").ZozoTrend | null;
    /** 有効なブーストID一覧（"avoid_overlap" / "other_world" / "buzz" / "face_pop"） */
    activeBoosts?: string[];
    /** カラーストラテジー */
    colorStrategy?: string | null;
    /** 絵柄スタイル */
    artStyle?: string | null;
    /** スコープ以外の era（時代設定） */
    era?: string | null;
  };

  /**
   * 失敗理由メモ（なぜ失敗したかをワンタップ＋自由入力で記録）。
   * skyveil好み学習・重複分析・禁止タグの材料としてのみ保存する。
   * 自動でプロンプトに反映しない（反映はユーザーが学習反映ボタンを押した時だけ）。
   */
  failureMemo?: FailureMemo;

  /**
   * プロンプトの版履歴（差分表示・この版に戻す用）。
   * promptText を上書きする操作（禁止ワード除去・改善案反映・逆プロンプト反映・版復元）の
   * 直前の内容を push する。古い順。
   */
  versions?: import("./lib/promptDiff").PromptVersion[];

  /** 生成時のサーバ側スコープフィルタ結果（最後の砦で削除した項目）。 */
  serverScopeFilter?: ServerScopeFilterSummary;
  /** 生成時の Identity Shield 結果（追加した同一性保護文・リスク）。 */
  identityShield?: IdentityShieldSummary;
}

/** 失敗理由メモ */
export interface FailureMemo {
  id: string;
  /** 記録時刻（unix ms） */
  createdAt: number;
  /** 対象プロンプト案ID（= PromptHistoryItem.id） */
  promptId: string;
  /** 対象画像ID（任意） */
  imageId?: string;
  /** ワンタップで選んだ理由 */
  selectedReasons: string[];
  /** 自由入力メモ */
  customMemo: string;
  /** 深刻度 1（軽微）〜5（致命的） */
  severity: 1 | 2 | 3 | 4 | 5;
}

/** 失敗理由ワンタップ候補（顔・同一性系を先頭に） */
export const FAILURE_REASONS: string[] = [
  "顔が変わった", "同一性が弱い", "背景が変わった", "衣装が違う", "髪型が違う",
  "ポーズが違う", "カメラが違う", "小物が反映されない", "前景が邪魔", "AIっぽい",
  "黒ゴシックに寄りすぎ", "青ネオンに寄りすぎ", "ドレスに寄りすぎ", "サイバー背景に寄りすぎ",
  "クリスタルが出すぎ", "色が好みじゃない", "構図が弱い", "バズり感が弱い",
  "変化が少ない", "変化しすぎ",
];

export type AppView = "main" | "history";

/** アレンジで変更された/維持された軸の1項目（変更ポイント表示用）。 */
export interface ArrangeChangedAxis {
  scope: Scope;
  label: string;
  changed: boolean;   // true=変更 / false=維持
}

/** 履歴一覧のインライン・アレンジ結果（右側プレビューパネルで表示）。 */
export interface ArrangeResult {
  /** アレンジ元の履歴アイテム */
  source: PromptHistoryItem;
  /** アレンジ実行に使った入力スナップショット（お気に入り保存に再利用） */
  inputs: PromptInputs;
  /** 生成された案 */
  proposals: GeneratedProposal[];
  /** 変更ポイント（タグ表示用） */
  changedAxes: ArrangeChangedAxis[];
  createdAt: number;
}

/** Default: all fields unset ("設定なし"). Used by クリア button and initial state. */
export const DEFAULT_DETAILS: DetailSettings = {
  hair: {
    length: "skip",
    shape: "skip",
    texture: "skip",
    colorMode: "skip",
    color: "skip",
    bangs: "skip",
    tips: "skip",
    volume: "skip",
    accessory: "skip",
    hairStyle: "skip",
  },
  outfit: {
    style: "skip",
    exposure: "skip",
    material: "skip",
    color: "skip",
    silhouette: "skip",
    decoration: "skip",
    season: "skip",
    luxury: "skip",
  },
  cosplay: {
    genre:         "skip",
    cuteStyle:     "skip",
    jobGenre:      "skip",
    japaneseStyle: "skip",
    fantasyStyle:  "skip",
    scifiStyle:    "skip",
    darkStyle:     "skip",
    occupation:    "skip",
    decoration:    "skip",
    item:          "skip",
    exposure:      "skip",
    colorDir:      "skip",
  },
  cyber: {
    part:      "skip",
    type:      "skip",
    texture:   "skip",
    glowColor: "skip",
    intensity: "skip",
  },
  background: {
    place:       "skip",
    color:       "skip",
    density:     "skip",
    effect:      "skip",
    time:        "skip",
    weather:     "skip",
    depth:       "skip",
    info:        "skip",
    style:       "skip",
    textType:    "skip",
    textMood:    "skip",
    textLayout:  "skip",
    textTexture: "skip",
  },
  foreground: {
    preset:      "skip",
    effectType:  "skip",
    swirlType:   "skip",
    digitalType: "skip",
    artType:     "skip",
    position:    "skip",
    density:     "skip",
    motion:      "skip",
    color:       "skip",
    depth:       "skip",
    visibility:  "skip",
  },
  pose: {
    type: "skip",
    impression: "skip",
    hand: "skip",
    foot: "skip",
    balance: "skip",
    motion: "skip",
    gaze: "skip",
    orientation: "skip",
  },
  camera: {
    angle: "skip",
    distance: "skip",
    lens: "skip",
    composition: "skip",
    fov: "skip",
    eyeHeight: "skip",
    custom3D: null,
  },
  props: {
    category: "skip",
    hold: "skip",
    size: "skip",
    glow: "skip",
    vibe: "skip",
    placement: "skip",
    count: "skip",
  },
  bigObject: {
    genre:     "skip",
    type:      "skip",
    condition: "skip",
    placement: "skip",
    size:      "skip",
    mood:      "skip",
  },
  vehicle: {
    genre:       "skip",
    type:        "skip",
    interaction: "skip",
    era:         "skip",
    material:    "skip",
    atmosphere:  "skip",
  },
  myth: {
    region:      "skip",
    creature:    "skip",
    interaction: "skip",
    style:       "skip",
    size:        "skip",
  },
  lighting: {
    direction: "skip",
    intensity: "skip",
    temperature: "skip",
    shadow: "skip",
    reflection: "skip",
    atmosphere: "skip",
  },
  aspectRatio: {
    preset: "skip",
    customW: 1080,
    customH: 1350,
  },
};

/** All-auto preset: used by "すべておまかせ" button. */
export const AUTO_DETAILS: DetailSettings = {
  hair: {
    length: "auto",
    shape: "auto",
    texture: "auto",
    colorMode: "auto",
    color: "auto",
    bangs: "auto",
    tips: "auto",
    volume: "auto",
    accessory: "auto",
    hairStyle: "auto",
  },
  outfit: {
    style: "auto",
    exposure: "auto",
    material: "auto",
    color: "auto",
    silhouette: "auto",
    decoration: "auto",
    season: "auto",
    luxury: "auto",
  },
  cosplay: {
    genre:         "auto",
    cuteStyle:     "auto",
    jobGenre:      "auto",
    japaneseStyle: "auto",
    fantasyStyle:  "auto",
    scifiStyle:    "auto",
    darkStyle:     "auto",
    occupation:    "auto",
    decoration:    "auto",
    item:          "auto",
    exposure:      "modest",  // 安全のため "auto" は使わない
    colorDir:      "auto",
  },
  cyber: {
    part:      "auto",
    type:      "auto",
    texture:   "auto",
    glowColor: "auto",
    intensity: "normal",  // おまかせ時は "普通" 相当
  },
  background: {
    place:       "auto",
    color:       "auto",
    density:     "auto",
    effect:      "auto",
    time:        "auto",
    weather:     "auto",
    depth:       "auto",
    info:        "auto",
    style:       "auto",
    textType:    "skip",
    textMood:    "skip",
    textLayout:  "skip",
    textTexture: "skip",
  },
  foreground: {
    preset:      "auto",
    effectType:  "auto",
    swirlType:   "auto",
    digitalType: "auto",
    artType:     "auto",
    position:    "auto",
    density:     "auto",
    motion:      "auto",
    color:       "auto",
    depth:       "auto",
    visibility:  "face_protected",  // おまかせ時も顔は必ず保護
  },
  pose: {
    type: "auto",
    impression: "auto",
    hand: "auto",
    foot: "auto",
    balance: "auto",
    motion: "auto",
    gaze: "auto",
    orientation: "auto",
  },
  camera: {
    angle: "auto",
    distance: "auto",
    lens: "auto",
    composition: "auto",
    fov: "auto",
    eyeHeight: "auto",
    custom3D: null,
  },
  props: {
    category: "auto",
    hold: "auto",
    size: "auto",
    glow: "auto",
    vibe: "auto",
    placement: "auto",
    count: "auto",
  },
  bigObject: {
    genre:     "auto",
    type:      "auto",
    condition: "auto",
    placement: "auto",
    size:      "auto",
    mood:      "auto",
  },
  vehicle: {
    genre:       "auto",
    type:        "auto",
    interaction: "auto",
    era:         "auto",
    material:    "auto",
    atmosphere:  "auto",
  },
  myth: {
    region:      "auto",
    creature:    "auto",
    interaction: "auto",
    style:       "auto",
    size:        "auto",
  },
  lighting: {
    direction: "auto",
    intensity: "auto",
    temperature: "auto",
    shadow: "auto",
    reflection: "auto",
    atmosphere: "auto",
  },
  aspectRatio: {
    preset: "original",
    customW: 1080,
    customH: 1350,
  },
};
