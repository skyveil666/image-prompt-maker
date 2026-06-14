/**
 * Prompt scalar spine — フロント(src/types.ts)とサーバ(server/src/types.ts)で
 * 完全に同一だったスカラー型の単一ソース（型ミラー解消・案A / docs §15）。
 *
 * ここに置けるのは「依存ゼロ（他ファイルを import しない）」かつ
 * 「両ビルドで定義が一致する」型のみ。設定 interface（HairSettings 等）は
 * サーバが意図的に loosening（AutoOrStr=string・union インライン化）しているため、
 * ここには含めず各 types.ts に残す。
 *
 * 両 types.ts はこのファイルを「import（内部利用）＋ re-export」で読み込む。
 * 既存の `import { Scope } from "./types"` はそのまま動作する（consumer 無改修）。
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
 * 旧バージョン時に保存された履歴を読み出すための互換値。
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
  // ── 基本 追加 ──────────────────────────────────────────────
  | "clean"
  | "heavy"
  | "ephemeral"
  // ── 世界観 追加 ─────────────────────────────────────────────
  | "contemporary"
  | "architectural"
  | "urban_fantasy"
  | "retro_future"
  // ── 演出 追加 ──────────────────────────────────────────────
  | "reflection_rich"
  | "whitespace"
  | "ad_visual"
  | "magazine_cover"
  | "movie_poster"
  // ── SNS最適化 追加 ──────────────────────────────────────────
  | "thumbnail_pop"
  | "scroll_stop"
  | "icon_pop"
  // ── 反射 新カテゴリ ─────────────────────────────────────────
  | "refl_water"
  | "refl_glass"
  | "refl_mirror"
  | "refl_metal"
  | "refl_wet_floor"
  | "refl_car_window"
  // ── 空気感 新カテゴリ ────────────────────────────────────────
  | "air_fog"
  | "air_smoke"
  | "air_after_rain"
  | "air_dust"
  | "air_light_particles"
  | "air_humid"
  | "air_cold"
  // ── 色調 新カテゴリ ─────────────────────────────────────────
  | "grade_cinema"
  | "grade_ad"
  | "grade_low_sat"
  | "grade_high_sat"
  | "grade_blue"
  | "grade_red"
  | "grade_white"
  | "grade_black"
  // ── 空間 新カテゴリ ─────────────────────────────────────────
  | "venue_wide"
  | "venue_narrow"
  | "venue_gallery"
  | "venue_hotel"
  | "venue_greenhouse"
  | "venue_station"
  | "venue_rooftop"
  | "venue_glass"
  | "venue_abstract";

/**
 * 軸別ロック。顔・同一性・表情は faceLock（単一の真実）で一元管理するため、
 * ここには含めない。これらの保護は faceLock + Identity Shield が担う。
 * 参照: docs/09_face-lock統合.md
 */
export type LockKey =
  | "body_shape"
  | "color"
  | "camera"
  | "aspect_ratio";

export type SafetyMode = "fictional_ai" | "real_person";

/**
 * 出力先プラットフォームに合わせたプロンプト安全モード。
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
 * 色戦略。肯定系（warm / mono 等）はプロンプト指示として注入。
 * 否定系（no_blue / no_purple 等）は NG ブロックに追加。
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
  | "auto"          // おまかせ
  | "photo"         // フォトリアル写真風
  | "illustration"  // デジタルイラスト風
  | "anime"         // アニメ調
  | "watercolor"    // 水彩画風
  | "oil_painting"  // 油絵風
  | "sketch"        // スケッチ・鉛筆画風
  | "line_art"      // 線画
  | "3d_render"     // 3DCGレンダリング風
  | "concept_art"   // コンセプトアート風
  | "manga"         // 白黒漫画風
  | "game_art"      // ゲームアート風
  | "pixel"         // ドット絵
  | "flat_design"   // フラットデザイン
  | "ghibli_style"; // ジブリ風

/**
 * "skip" = don't include this field in the prompt at all.
 * "auto" = vary this field across proposals (AI decides).
 * T     = pin to a specific value.
 */
export type AutoOr<T extends string> = T | "auto" | "skip";
