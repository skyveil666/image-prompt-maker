/**
 * monitoredMotifs — 監視要素タクソノミー（curated）。docs/28 / 100+要素拡張 P1。
 *
 * 偏り分析・頻出/未開拓度・出現制御(level)・タグの基盤となるモチーフ定義（curated）。
 * 検出は biasAnalyzer.containsMotif（小文字化＋トークン部分一致）。トークンは JP/EN を併記。
 *
 * 方針（docs/28）: 未開拓発見・意外性・新軸探索を優先。A群（造形・好み制御）は既存維持＋控えめ、
 * B群（表現スタイル）を主役に厚く。既存20要素のID/カテゴリは維持（後方互換：levels/tags/分析が継続）。
 *
 * ※ ここはデータのみ。型は biasAnalyzer から type-only import（実行時の循環を作らない）。
 * ※ ユーザー昇格モチーフ（発見層・P3）は別途 localStorage で実効集合にマージする。
 */
import type { MonitoredMotif } from "../lib/biasAnalyzer";

// ════════════════════════════════════════════════════════════════════════════
// A群：造形・好み制御（既存頻出を維持しつつ比率は低め）
// ════════════════════════════════════════════════════════════════════════════

const OUTFIT: MonitoredMotif[] = [
  // ── 既存（ID維持）──
  { id: "gothic_black", label: "黒ゴシック衣装", category: "衣装", tokens: ["gothic", "gothic dress", "gothic lolita", "black gothic", "gothic fashion", "ゴシック", "黒ゴシック"] },
  { id: "black_outfit", label: "黒系衣装", category: "衣装", tokens: ["black outfit", "black dress", "black coat", "all-black", "dark outfit", "黒衣装", "黒い衣装"] },
  { id: "dress_general", label: "ドレス全般", category: "衣装", tokens: ["dress", "gown", "ball gown", "flowing dress", "ドレス", "ガウン"] },
  { id: "white_dress", label: "白ドレス・白ワンピ", category: "衣装", tokens: ["white dress", "white gown", "white one-piece", "白ドレス", "白ワンピ"] },
  { id: "transparent_outfit", label: "透明素材衣装", category: "衣装", tokens: ["transparent", "see-through", "sheer fabric", "translucent", "透明素材", "透け素材", "pvc"] },
  { id: "long_coat", label: "ロングコート", category: "衣装", tokens: ["long coat", "trench coat", "overcoat", "duster coat", "ロングコート", "トレンチ"] },
  // ── 追加 ──
  { id: "street_wear", label: "ストリート系", category: "衣装", tokens: ["streetwear", "street style", "oversized hoodie", "baggy", "ストリート", "古着mix"] },
  { id: "wafuku", label: "和装・着物", category: "衣装", tokens: ["kimono", "yukata", "hakama", "japanese traditional", "着物", "浴衣", "和装", "袴"] },
  { id: "uniform", label: "制服・ユニフォーム", category: "衣装", tokens: ["uniform", "school uniform", "sailor", "blazer", "制服", "セーラー", "学生服"] },
  { id: "military_wear", label: "ミリタリー", category: "衣装", tokens: ["military", "camouflage", "tactical", "combat", "ミリタリー", "迷彩", "戦闘服"] },
  { id: "leather_wear", label: "レザー・革", category: "衣装", tokens: ["leather", "leather jacket", "biker", "studded", "レザー", "革ジャン", "ライダース"] },
  { id: "knit_wear", label: "ニット・編み", category: "衣装", tokens: ["knit", "sweater", "cable knit", "wool", "ニット", "セーター", "編み"] },
  { id: "frill_lace", label: "フリル・レース", category: "衣装", tokens: ["frill", "lace", "ruffle", "ribbon", "フリル", "レース", "リボン"] },
  { id: "avant_garde_wear", label: "前衛・アヴァンギャルド衣装", category: "衣装", tokens: ["avant-garde", "deconstructed", "conceptual fashion", "structural", "前衛", "アヴァンギャルド", "脱構築"] },
];

const HAIR: MonitoredMotif[] = [
  { id: "hair_long", label: "ロングヘア", category: "髪", tokens: ["long hair", "flowing hair", "ロングヘア", "ロング", "長い髪"] },
  { id: "hair_bob", label: "ボブ・ショート", category: "髪", tokens: ["bob cut", "short hair", "ボブ", "ショート", "短髪"] },
  { id: "hair_wolf", label: "ウルフ・レイヤー", category: "髪", tokens: ["wolf cut", "layered hair", "shaggy", "ウルフ", "レイヤー"] },
  { id: "hair_wet", label: "濡れ感・ウェット", category: "髪", tokens: ["wet hair", "wet look hair", "slicked", "濡れ感", "ウェットヘア"] },
  { id: "hair_twin", label: "ツインテール・お団子", category: "髪", tokens: ["twintails", "pigtails", "hair buns", "ツインテール", "お団子", "団子"] },
  { id: "hair_inner_color", label: "インナーカラー・派手髪", category: "髪", tokens: ["inner color hair", "dyed hair", "colorful hair", "vivid hair", "インナーカラー", "派手髪", "メッシュ"] },
];

const POSE: MonitoredMotif[] = [
  { id: "pose_diagonal", label: "斜め立ち", category: "ポーズ", tokens: ["diagonal pose", "angled stance", "three-quarter pose", "斜め立ち", "斜め"] },
  { id: "pose_lookup", label: "見上げ・見下ろし", category: "ポーズ", tokens: ["looking up", "looking down", "upward gaze", "見上げ", "見下ろし"] },
  { id: "pose_turn", label: "振り向き", category: "ポーズ", tokens: ["looking back", "turning around", "over the shoulder", "振り向き", "振り返り"] },
  { id: "pose_sit", label: "座り・しゃがみ", category: "ポーズ", tokens: ["sitting", "crouching", "seated", "kneeling", "座り", "しゃがみ", "膝立ち"] },
  { id: "pose_hand_face", label: "手を顔・髪へ", category: "ポーズ", tokens: ["hand to face", "touching hair", "hand near face", "手を顔", "髪に触れる"] },
  { id: "pose_dynamic", label: "動き・躍動", category: "ポーズ", tokens: ["dynamic pose", "action pose", "motion", "jumping", "躍動", "動きのある", "ジャンプ"] },
];

const COLOR: MonitoredMotif[] = [
  { id: "blue_purple", label: "青紫配色", category: "色", tokens: ["blue-purple", "cyan purple", "blue violet", "indigo violet", "青紫", "シアン紫"] },
  { id: "color_monotone", label: "モノトーン", category: "色", tokens: ["monochrome", "black and white", "grayscale", "monotone", "モノトーン", "白黒"] },
  { id: "color_pastel", label: "パステル", category: "色", tokens: ["pastel", "soft pastel", "pastel palette", "パステル", "淡色"] },
  { id: "color_vivid", label: "ビビッド・高彩度", category: "色", tokens: ["vivid", "saturated", "high saturation", "bold colors", "ビビッド", "高彩度", "原色"] },
  { id: "color_muted", label: "くすみ・ニュアンス", category: "色", tokens: ["muted colors", "desaturated", "dusty tone", "earthy", "くすみ", "ニュアンスカラー", "低彩度"] },
  { id: "color_complementary", label: "補色・コントラスト配色", category: "色", tokens: ["complementary colors", "high contrast palette", "color contrast", "補色", "コントラスト配色"] },
  { id: "color_warm", label: "暖色", category: "色", tokens: ["warm colors", "warm palette", "orange red tone", "暖色", "暖色系"] },
  { id: "color_cool", label: "寒色", category: "色", tokens: ["cool colors", "cool palette", "blue green tone", "寒色", "寒色系"] },
  { id: "color_earth", label: "アースカラー", category: "色", tokens: ["earth tones", "beige brown", "natural tone", "アースカラー", "ベージュ"] },
  { id: "color_neon_palette", label: "ネオンカラー配色", category: "色", tokens: ["neon palette", "neon colors", "fluorescent", "ネオンカラー", "蛍光色"] },
];

const LIGHTING: MonitoredMotif[] = [
  { id: "light_rim", label: "リムライト・逆光", category: "ライティング", tokens: ["rim light", "backlight", "backlit", "halo light", "リムライト", "逆光"] },
  { id: "light_highkey", label: "ハイキー（明るい）", category: "ライティング", tokens: ["high key", "bright lighting", "airy light", "ハイキー", "明るい照明"] },
  { id: "light_lowkey", label: "ローキー（暗い）", category: "ライティング", tokens: ["low key", "dark lighting", "chiaroscuro", "moody light", "ローキー", "暗い照明"] },
  { id: "light_natural", label: "自然光", category: "ライティング", tokens: ["natural light", "daylight", "sunlight", "window light", "自然光", "日光"] },
  { id: "light_neon_lit", label: "ネオン照明", category: "ライティング", tokens: ["neon lighting", "neon-lit", "colored light", "ネオン照明", "色光"] },
  { id: "light_golden", label: "ゴールデンアワー・夕景光", category: "ライティング", tokens: ["golden hour", "sunset light", "warm glow", "ゴールデンアワー", "夕景", "夕暮れ光"] },
];

const CAMERA: MonitoredMotif[] = [
  { id: "cam_low", label: "ローアングル", category: "カメラ", tokens: ["low angle", "looking up shot", "ローアングル", "煽り"] },
  { id: "cam_high", label: "俯瞰・ハイアングル", category: "カメラ", tokens: ["high angle", "bird's eye", "overhead shot", "俯瞰", "ハイアングル"] },
  { id: "cam_closeup", label: "寄り・クローズアップ", category: "カメラ", tokens: ["close-up", "macro", "tight shot", "寄り", "クローズアップ"] },
  { id: "cam_wide", label: "引き・ワイド", category: "カメラ", tokens: ["wide shot", "full body shot", "long shot", "引き", "ワイド", "全身"] },
  { id: "cam_symmetry", label: "対称構図", category: "カメラ", tokens: ["symmetry", "symmetrical composition", "centered", "対称構図", "シンメトリー"] },
  { id: "cam_thirds", label: "三分割・余白構図", category: "カメラ", tokens: ["rule of thirds", "negative space", "off-center", "三分割", "余白構図"] },
];

const EFFECT: MonitoredMotif[] = [
  // ── 既存（ID維持・比率は縮小だが定義は保持）──
  { id: "neon_glow", label: "ネオン発光", category: "演出", tokens: ["neon glow", "neon light", "neon sign", "glowing neon", "ネオン", "ネオン発光"] },
  { id: "crystal", label: "クリスタル・結晶", category: "演出", tokens: ["crystal", "glowing crystal", "crystal shard", "クリスタル", "結晶", "水晶"] },
  { id: "hologram_hud", label: "ホログラム・HUD", category: "演出", tokens: ["hologram", "holographic", "hud display", "ar overlay", "ホログラム", "hud"] },
  { id: "snow_ice", label: "雪・氷演出", category: "演出", tokens: ["snow", "ice", "frozen", "blizzard", "雪", "氷", "吹雪"] },
  { id: "feathers_wings", label: "羽・翼", category: "演出", tokens: ["feathers", "wings", "angel wings", "羽", "翼", "羽根"] },
  { id: "petals", label: "花びら", category: "演出", tokens: ["petals", "flower petals", "cherry blossoms", "花びら", "桜", "花弁"] },
  { id: "light_particles", label: "発光粒子", category: "演出", tokens: ["light particles", "glowing particles", "sparkling particles", "発光粒子", "光の粒子"] },
  // ── 追加 ──
  { id: "smoke_fog", label: "煙・霧", category: "演出", tokens: ["smoke", "fog", "mist", "haze", "煙", "霧", "靄"] },
  { id: "fire_flame", label: "炎・火花", category: "演出", tokens: ["fire", "flame", "embers", "burning", "炎", "火", "火花"] },
  { id: "water_splash", label: "水・水しぶき", category: "演出", tokens: ["water splash", "water droplets", "underwater", "水しぶき", "水滴", "水中"] },
  { id: "light_rays", label: "光線・レンズフレア", category: "演出", tokens: ["light rays", "god rays", "lens flare", "光線", "レンズフレア", "薄明光線"] },
  { id: "bokeh", label: "ボケ・玉ボケ", category: "演出", tokens: ["bokeh", "blurred lights", "depth of field bokeh", "ボケ", "玉ボケ", "前ボケ"] },
];

const PROPS: MonitoredMotif[] = [
  { id: "sword_katana", label: "刀・剣", category: "小物", tokens: ["katana", "sword", "blade", "energy sword", "刀", "剣", "刀剣"] },
  { id: "prop_umbrella", label: "傘", category: "小物", tokens: ["umbrella", "parasol", "傘", "日傘"] },
  { id: "prop_flowers", label: "花束・花", category: "小物", tokens: ["bouquet", "flowers", "floral", "花束", "花"] },
  { id: "prop_device", label: "デバイス・ガジェット", category: "小物", tokens: ["gadget", "device", "smartphone", "headphones", "デバイス", "ガジェット", "イヤホン"] },
];

const BACKGROUND: MonitoredMotif[] = [
  // ── 既存（ID維持・縮小だが保持）──
  { id: "cyber_bg", label: "サイバー・ネオン都市", category: "背景", tokens: ["cyberpunk city", "neon city", "futuristic city", "サイバー", "ネオン都市", "電脳都市"] },
  { id: "church_stained", label: "教会・ステンドグラス", category: "背景", tokens: ["church", "stained glass", "cathedral", "chapel", "教会", "ステンドグラス", "大聖堂"] },
  { id: "rooftop_urban", label: "屋上・地下・駐車場", category: "背景", tokens: ["rooftop", "underground", "parking lot", "garage", "屋上", "地下", "駐車場"] },
  { id: "dark_bg", label: "暗い・黒背景", category: "背景", tokens: ["dark background", "black background", "dark void", "黒背景", "暗い背景"] },
  // ── 追加 ──
  { id: "bg_nature", label: "自然・草原・空", category: "背景", tokens: ["nature", "meadow", "grassland", "sky", "自然", "草原", "空"] },
  { id: "bg_sea", label: "海・水辺", category: "背景", tokens: ["sea", "ocean", "beach", "waterside", "海", "水辺", "ビーチ"] },
  { id: "bg_forest", label: "森・林", category: "背景", tokens: ["forest", "woods", "jungle", "森", "林", "樹海"] },
  { id: "bg_interior", label: "室内・インテリア", category: "背景", tokens: ["interior", "indoor room", "living room", "室内", "部屋", "インテリア"] },
  { id: "bg_ruins", label: "廃墟・遺跡", category: "背景", tokens: ["ruins", "abandoned", "decayed", "derelict", "廃墟", "遺跡"] },
  { id: "bg_night_city", label: "夜景・繁華街", category: "背景", tokens: ["night city", "city lights", "downtown night", "夜景", "繁華街", "歓楽街"] },
];

const GROUP_A: MonitoredMotif[] = [
  ...OUTFIT, ...HAIR, ...POSE, ...COLOR, ...LIGHTING, ...CAMERA, ...EFFECT, ...PROPS, ...BACKGROUND,
];

// ════════════════════════════════════════════════════════════════════════════
// B群：表現スタイル・発見・意外性（主役・厚め）
// ════════════════════════════════════════════════════════════════════════════

const ART_STYLE: MonitoredMotif[] = [
  { id: "art_impressionism", label: "印象派", category: "芸術様式", tokens: ["impressionism", "impressionist", "monet style", "印象派"] },
  { id: "art_ukiyoe", label: "浮世絵", category: "芸術様式", tokens: ["ukiyo-e", "japanese woodblock", "hokusai style", "浮世絵", "木版画"] },
  { id: "art_cubism", label: "キュビズム", category: "芸術様式", tokens: ["cubism", "cubist", "picasso style", "キュビズム", "立体派"] },
  { id: "art_artnouveau", label: "アールヌーヴォー", category: "芸術様式", tokens: ["art nouveau", "mucha style", "アールヌーヴォー", "ミュシャ"] },
  { id: "art_artdeco", label: "アールデコ", category: "芸術様式", tokens: ["art deco", "1920s deco", "アールデコ"] },
  { id: "art_bauhaus", label: "バウハウス", category: "芸術様式", tokens: ["bauhaus", "geometric modernist", "バウハウス"] },
  { id: "art_surrealism", label: "シュルレアリスム", category: "芸術様式", tokens: ["surrealism", "surreal", "dali style", "シュルレアリスム", "超現実"] },
  { id: "art_popart", label: "ポップアート", category: "芸術様式", tokens: ["pop art", "warhol", "comic halftone", "ポップアート"] },
  { id: "art_vaporwave", label: "ヴェイパーウェイヴ", category: "芸術様式", tokens: ["vaporwave", "aesthetic 80s glitch", "ヴェイパーウェイヴ", "vapor"] },
  { id: "art_brutalism", label: "ブルータリズム（視覚）", category: "芸術様式", tokens: ["brutalist design", "raw concrete aesthetic", "ブルータリズム"] },
  { id: "art_minimalism", label: "ミニマリズム", category: "芸術様式", tokens: ["minimalism", "minimalist", "ミニマリズム", "ミニマル"] },
  { id: "art_expressionism", label: "表現主義", category: "芸術様式", tokens: ["expressionism", "expressionist", "表現主義"] },
  { id: "art_baroque", label: "バロック", category: "芸術様式", tokens: ["baroque", "baroque painting", "caravaggio", "バロック"] },
  { id: "art_renaissance", label: "ルネサンス絵画", category: "芸術様式", tokens: ["renaissance painting", "classical painting", "ルネサンス"] },
  { id: "art_gothic_art", label: "ゴシック美術", category: "芸術様式", tokens: ["gothic art", "medieval gothic art", "ゴシック美術"] },
  { id: "art_ink_wash", label: "水墨画", category: "芸術様式", tokens: ["ink wash painting", "sumi-e", "水墨画", "墨絵"] },
  { id: "art_watercolor", label: "水彩画", category: "芸術様式", tokens: ["watercolor", "watercolour painting", "水彩"] },
  { id: "art_oil_painting", label: "油彩画", category: "芸術様式", tokens: ["oil painting", "thick impasto", "油彩", "油絵"] },
  { id: "art_psychedelic", label: "サイケデリック", category: "芸術様式", tokens: ["psychedelic", "trippy", "サイケデリック"] },
  { id: "art_memphis", label: "メンフィス・デザイン", category: "芸術様式", tokens: ["memphis design", "80s memphis", "メンフィス"] },
  { id: "art_constructivism", label: "構成主義", category: "芸術様式", tokens: ["constructivism", "soviet poster art", "構成主義"] },
  { id: "art_fauvism", label: "フォーヴィスム", category: "芸術様式", tokens: ["fauvism", "fauvist", "matisse", "フォーヴィスム", "野獣派"] },
  { id: "art_pixel", label: "ピクセルアート", category: "芸術様式", tokens: ["pixel art", "8bit", "16bit", "ピクセルアート", "ドット絵"] },
  { id: "art_lowpoly", label: "ローポリ・3DCG様式", category: "芸術様式", tokens: ["low poly", "polygonal", "ローポリ"] },
  { id: "art_collage", label: "コラージュ", category: "芸術様式", tokens: ["collage", "mixed media collage", "コラージュ"] },
  { id: "art_lineart", label: "線画・ペン画", category: "芸術様式", tokens: ["line art", "pen drawing", "ink illustration", "線画", "ペン画"] },
  { id: "art_riso", label: "リソグラフ印刷", category: "芸術様式", tokens: ["risograph", "riso print", "リソグラフ"] },
  { id: "art_glitch", label: "グリッチアート", category: "芸術様式", tokens: ["glitch art", "datamosh", "グリッチ"] },
];

const ARCHITECTURE: MonitoredMotif[] = [
  { id: "arch_gothic", label: "ゴシック建築", category: "建築", tokens: ["gothic architecture", "flying buttress", "ゴシック建築"] },
  { id: "arch_brutalist", label: "ブルータリズム建築", category: "建築", tokens: ["brutalist architecture", "raw concrete building", "ブルータリズム建築"] },
  { id: "arch_modernist", label: "モダニズム建築", category: "建築", tokens: ["modernist architecture", "bauhaus building", "モダニズム建築"] },
  { id: "arch_japanese", label: "和建築・神社仏閣", category: "建築", tokens: ["japanese architecture", "shrine", "temple", "和建築", "神社", "寺"] },
  { id: "arch_futuristic", label: "未来建築", category: "建築", tokens: ["futuristic architecture", "parametric building", "未来建築"] },
  { id: "arch_metabolism", label: "メタボリズム", category: "建築", tokens: ["metabolism architecture", "capsule building", "メタボリズム"] },
  { id: "arch_classical", label: "古典・神殿建築", category: "建築", tokens: ["classical architecture", "greek temple", "columns", "神殿建築", "古典建築"] },
  { id: "arch_artdeco_bldg", label: "アールデコ建築", category: "建築", tokens: ["art deco building", "1930s skyscraper", "アールデコ建築"] },
  { id: "arch_nordic_interior", label: "北欧インテリア", category: "建築", tokens: ["scandinavian interior", "nordic design room", "北欧インテリア"] },
  { id: "arch_industrial_interior", label: "インダストリアル内装", category: "建築", tokens: ["industrial interior", "loft", "exposed brick", "インダストリアル内装", "ロフト"] },
  { id: "arch_minimal_interior", label: "ミニマル内装", category: "建築", tokens: ["minimalist interior", "concrete minimal room", "ミニマル内装"] },
  { id: "arch_baroque_bldg", label: "バロック建築・宮殿", category: "建築", tokens: ["baroque architecture", "palace interior", "バロック建築", "宮殿"] },
  { id: "arch_liminal", label: "リミナルスペース", category: "建築", tokens: ["liminal space", "empty corridor", "backrooms", "リミナル"] },
  { id: "arch_brutal_ruin", label: "巨大構造物・遺構", category: "建築", tokens: ["megastructure", "massive structure", "巨大構造物", "遺構"] },
  { id: "arch_traditional_street", label: "古い街並み・路地", category: "建築", tokens: ["old town street", "alley", "narrow lane", "街並み", "路地", "横丁"] },
  { id: "arch_greenhouse", label: "温室・ガラス建築", category: "建築", tokens: ["greenhouse", "glass conservatory", "atrium", "温室", "ガラス建築"] },
];

const ADVERTISING: MonitoredMotif[] = [
  { id: "ad_highbrand", label: "ハイブランド広告", category: "広告表現", tokens: ["luxury brand ad", "high fashion campaign", "ハイブランド広告"] },
  { id: "ad_cosme", label: "コスメ広告", category: "広告表現", tokens: ["cosmetics ad", "beauty campaign", "skincare ad", "コスメ広告", "美容広告"] },
  { id: "ad_product", label: "プロダクト広告", category: "広告表現", tokens: ["product advertising", "product hero shot", "プロダクト広告"] },
  { id: "ad_ec", label: "EC・物撮り", category: "広告表現", tokens: ["ecommerce photo", "studio product shot", "白背景物撮り", "物撮り"] },
  { id: "ad_billboard", label: "ビルボード・屋外広告", category: "広告表現", tokens: ["billboard", "outdoor advertising", "ooh ad", "ビルボード", "屋外広告"] },
  { id: "ad_editorial", label: "ファッションエディトリアル", category: "広告表現", tokens: ["fashion editorial", "editorial campaign", "エディトリアル"] },
  { id: "ad_lookbook", label: "LOOKBOOK", category: "広告表現", tokens: ["lookbook", "lookbook style", "ルックブック"] },
  { id: "ad_perfume", label: "フレグランス広告", category: "広告表現", tokens: ["perfume ad", "fragrance campaign", "香水広告", "フレグランス"] },
  { id: "ad_food", label: "フード・ドリンク広告", category: "広告表現", tokens: ["food advertising", "drink commercial", "appetizing", "フード広告", "ドリンク広告"] },
  { id: "ad_auto", label: "自動車広告", category: "広告表現", tokens: ["car advertising", "automotive ad", "自動車広告", "カー広告"] },
  { id: "ad_tech", label: "テック・ガジェット広告", category: "広告表現", tokens: ["tech product ad", "gadget campaign", "テック広告"] },
  { id: "ad_poster", label: "ポスター・キービジュアル", category: "広告表現", tokens: ["poster design", "key visual", "ポスター", "キービジュアル"] },
  { id: "ad_streetwear_campaign", label: "ストリートブランド広告", category: "広告表現", tokens: ["streetwear campaign", "hype brand ad", "ストリートブランド広告"] },
  { id: "ad_luxury_jewelry", label: "ジュエリー広告", category: "広告表現", tokens: ["jewelry advertising", "fine jewelry ad", "ジュエリー広告"] },
  { id: "ad_minimal_brand", label: "ミニマル・ブランディング", category: "広告表現", tokens: ["minimal branding", "clean brand visual", "ミニマル広告"] },
  { id: "ad_retro_ad", label: "レトロ広告", category: "広告表現", tokens: ["retro advertisement", "vintage poster ad", "レトロ広告", "昭和広告"] },
];

const CINEMATIC: MonitoredMotif[] = [
  { id: "cine_filmnoir", label: "フィルムノワール", category: "映画表現", tokens: ["film noir", "noir lighting", "フィルムノワール", "ノワール"] },
  { id: "cine_neonoir", label: "ネオノワール", category: "映画表現", tokens: ["neo-noir", "blade runner style", "ネオノワール"] },
  { id: "cine_a24", label: "A24系・インディー", category: "映画表現", tokens: ["a24 film", "indie film aesthetic", "arthouse", "a24", "インディー映画"] },
  { id: "cine_wesanderson", label: "対称・ウェス的", category: "映画表現", tokens: ["wes anderson style", "symmetrical pastel film", "ウェスアンダーソン"] },
  { id: "cine_scifi_epic", label: "SF大作", category: "映画表現", tokens: ["sci-fi epic", "blockbuster sci-fi", "space opera", "sf大作"] },
  { id: "cine_cyberpunk_film", label: "サイバーパンク映画", category: "映画表現", tokens: ["cyberpunk film", "dystopian cinema", "サイバーパンク映画"] },
  { id: "cine_horror", label: "ホラー・スリラー", category: "映画表現", tokens: ["horror film", "thriller cinematic", "eerie", "ホラー", "スリラー"] },
  { id: "cine_western", label: "西部劇", category: "映画表現", tokens: ["western film", "spaghetti western", "西部劇"] },
  { id: "cine_nouvellevague", label: "ヌーヴェルヴァーグ", category: "映画表現", tokens: ["nouvelle vague", "french new wave", "ヌーヴェルヴァーグ"] },
  { id: "cine_anime_film", label: "アニメ映画的", category: "映画表現", tokens: ["anime film still", "cinematic anime", "アニメ映画"] },
  { id: "cine_documentary", label: "ドキュメンタリー的", category: "映画表現", tokens: ["documentary style", "cinema verite", "ドキュメンタリー"] },
  { id: "cine_musical", label: "ミュージカル・舞台的", category: "映画表現", tokens: ["musical film", "stage theatrical", "ミュージカル", "舞台的"] },
  { id: "cine_kurosawa", label: "黒澤・時代劇的", category: "映画表現", tokens: ["kurosawa style", "samurai cinema", "時代劇", "黒澤"] },
  { id: "cine_giallo", label: "ジャーロ（伊ホラー）", category: "映画表現", tokens: ["giallo", "italian horror color", "ジャーロ"] },
  { id: "cine_70s_film", label: "70s映画グレイン", category: "映画表現", tokens: ["1970s film look", "vintage film grain", "70年代映画"] },
  { id: "cine_disaster", label: "ディザスター・終末", category: "映画表現", tokens: ["disaster film", "apocalyptic cinema", "post-apocalyptic", "終末", "ディザスター"] },
  { id: "cine_fantasy_epic", label: "ファンタジー大作", category: "映画表現", tokens: ["fantasy epic film", "high fantasy cinematic", "ファンタジー大作"] },
  { id: "cine_neo_tokyo", label: "ネオ東京・近未来日本", category: "映画表現", tokens: ["neo tokyo", "futuristic japan film", "ネオ東京"] },
];

const PHOTOGRAPHY: MonitoredMotif[] = [
  { id: "photo_35mm", label: "35mmフィルム", category: "写真表現", tokens: ["35mm film", "film photography", "35mm", "フィルム写真"] },
  { id: "photo_medium", label: "中判・大判", category: "写真表現", tokens: ["medium format", "large format", "hasselblad", "中判", "大判"] },
  { id: "photo_polaroid", label: "ポラロイド・インスタント", category: "写真表現", tokens: ["polaroid", "instant photo", "ポラロイド", "チェキ"] },
  { id: "photo_longexposure", label: "長時間露光", category: "写真表現", tokens: ["long exposure", "light trails", "長時間露光"] },
  { id: "photo_flash", label: "ストロボ・直焚き", category: "写真表現", tokens: ["direct flash", "on-camera flash", "harsh flash", "ストロボ", "直焚き"] },
  { id: "photo_reportage", label: "報道・スナップ", category: "写真表現", tokens: ["photojournalism", "reportage", "candid snap", "報道写真", "スナップ"] },
  { id: "photo_fashion", label: "ファッション写真", category: "写真表現", tokens: ["fashion photography", "vogue style photo", "ファッション写真"] },
  { id: "photo_street", label: "ストリートスナップ", category: "写真表現", tokens: ["street photography", "street snap", "ストリートスナップ"] },
  { id: "photo_portrait_studio", label: "スタジオポートレート", category: "写真表現", tokens: ["studio portrait", "seamless backdrop portrait", "スタジオポートレート"] },
  { id: "photo_film_grain", label: "フィルムグレイン・粒状", category: "写真表現", tokens: ["film grain", "grainy", "analog grain", "フィルムグレイン", "粒状"] },
  { id: "photo_double_exposure", label: "多重露光", category: "写真表現", tokens: ["double exposure", "multiple exposure", "多重露光"] },
  { id: "photo_tilt_shift", label: "ティルトシフト・ミニチュア", category: "写真表現", tokens: ["tilt-shift", "miniature effect", "ティルトシフト"] },
  { id: "photo_infrared", label: "赤外線写真", category: "写真表現", tokens: ["infrared photography", "ir film", "赤外線写真"] },
  { id: "photo_lomography", label: "ロモ・トイカメラ", category: "写真表現", tokens: ["lomography", "toy camera", "light leak", "ロモ", "トイカメラ"] },
  { id: "photo_blackwhite", label: "モノクロ写真", category: "写真表現", tokens: ["black and white photography", "monochrome photo", "モノクロ写真"] },
  { id: "photo_aerial", label: "空撮・ドローン", category: "写真表現", tokens: ["aerial photography", "drone shot", "空撮", "ドローン"] },
  { id: "photo_macro", label: "マクロ・接写", category: "写真表現", tokens: ["macro photography", "extreme close-up photo", "マクロ撮影", "接写"] },
  { id: "photo_night", label: "夜間・ナイトフォト", category: "写真表現", tokens: ["night photography", "low light photo", "夜間撮影", "ナイトフォト"] },
];

const MAGAZINE: MonitoredMotif[] = [
  { id: "mag_vogue", label: "モード誌（Vogue風）", category: "雑誌表現", tokens: ["vogue style", "high fashion magazine", "モード誌", "vogue"] },
  { id: "mag_culture", label: "カルチャー誌", category: "雑誌表現", tokens: ["culture magazine", "indie magazine", "カルチャー誌"] },
  { id: "mag_street", label: "ストリート誌", category: "雑誌表現", tokens: ["street fashion magazine", "snap magazine", "ストリート誌"] },
  { id: "mag_cover", label: "雑誌表紙", category: "雑誌表現", tokens: ["magazine cover", "cover layout", "雑誌表紙", "表紙"] },
  { id: "mag_editorial_layout", label: "特集レイアウト・グリッド", category: "雑誌表現", tokens: ["editorial layout", "magazine spread", "grid layout", "特集レイアウト", "誌面"] },
  { id: "mag_typography", label: "タイポグラフィ主体", category: "雑誌表現", tokens: ["typographic design", "bold typography layout", "タイポグラフィ"] },
  { id: "mag_zine", label: "ZINE・自主制作", category: "雑誌表現", tokens: ["zine", "diy zine aesthetic", "ジン", "自主制作誌"] },
  { id: "mag_retro_mag", label: "レトロ雑誌・昭和誌面", category: "雑誌表現", tokens: ["retro magazine", "vintage magazine layout", "レトロ雑誌", "昭和誌面"] },
  { id: "mag_beauty_mag", label: "ビューティ誌面", category: "雑誌表現", tokens: ["beauty magazine", "beauty editorial", "ビューティ誌面"] },
  { id: "mag_lifestyle", label: "ライフスタイル誌", category: "雑誌表現", tokens: ["lifestyle magazine", "interior magazine", "ライフスタイル誌"] },
  { id: "mag_avantgarde_mag", label: "前衛・実験誌面", category: "雑誌表現", tokens: ["avant-garde magazine", "experimental layout", "実験的誌面"] },
  { id: "mag_monochrome_edit", label: "モノクロ誌面", category: "雑誌表現", tokens: ["monochrome editorial", "black white magazine", "モノクロ誌面"] },
];

const GROUP_B1: MonitoredMotif[] = [
  ...ART_STYLE, ...ARCHITECTURE, ...ADVERTISING, ...CINEMATIC, ...PHOTOGRAPHY, ...MAGAZINE,
];

const WORLDVIEW: MonitoredMotif[] = [
  { id: "goddess_ethereal", label: "女神・天使系", category: "世界観", tokens: ["goddess", "celestial", "angelic", "ethereal", "divine", "女神", "天使", "神々しい"] },
  { id: "world_decadent", label: "退廃的世界", category: "世界観", tokens: ["decadent world", "decadence", "退廃", "退廃的"] },
  { id: "world_nearfuture", label: "近未来", category: "世界観", tokens: ["near future", "近未来"] },
  { id: "world_nostalgic", label: "ノスタルジック", category: "世界観", tokens: ["nostalgic", "wistful past", "ノスタルジック", "郷愁的"] },
  { id: "world_dystopia", label: "ディストピア", category: "世界観", tokens: ["dystopia", "dystopian", "ディストピア"] },
  { id: "world_utopia", label: "ユートピア", category: "世界観", tokens: ["utopia", "utopian", "ユートピア"] },
  { id: "world_mythological", label: "神話的世界", category: "世界観", tokens: ["mythological", "mythic", "legend", "神話的", "神話"] },
  { id: "world_wamodern", label: "和モダン", category: "世界観", tokens: ["japanese modern", "wa-modern", "和モダン"] },
  { id: "world_apocalyptic", label: "終末・ポストアポカリプス", category: "世界観", tokens: ["apocalyptic", "post-apocalyptic", "終末", "終末世界"] },
  { id: "world_paradise", label: "楽園・桃源郷", category: "世界観", tokens: ["paradise", "eden", "arcadia", "楽園", "桃源郷"] },
  { id: "world_dreamlike", label: "夢幻・幻想", category: "世界観", tokens: ["dreamlike world", "fantastical realm", "夢幻", "幻想世界"] },
  { id: "world_mechanical", label: "機械文明", category: "世界観", tokens: ["mechanical civilization", "machine world", "機械文明"] },
  { id: "world_nature_worship", label: "自然崇拝・精霊", category: "世界観", tokens: ["nature spirit world", "animism", "精霊", "自然崇拝"] },
  { id: "world_otherworld", label: "異世界・別次元", category: "世界観", tokens: ["otherworld", "another dimension", "異世界", "別次元"] },
  { id: "world_cosmic", label: "宇宙的・コズミック", category: "世界観", tokens: ["cosmic", "celestial space", "宇宙的", "コズミック"] },
  { id: "world_industrial_decay", label: "産業退廃・工業退廃", category: "世界観", tokens: ["industrial decay", "rust dystopia", "産業退廃", "工業退廃"] },
  { id: "world_fantasy_orient", label: "幻想東洋", category: "世界観", tokens: ["fantasy orient", "oriental fantasy", "幻想東洋"] },
  { id: "world_cyber_myth", label: "サイバー神話・電脳霊性", category: "世界観", tokens: ["cyber mythology", "techno-spiritual", "サイバー神話", "電脳霊性"] },
  { id: "world_serene", label: "静寂・静謐世界", category: "世界観", tokens: ["serene world", "tranquil realm", "静寂世界", "静謐"] },
  { id: "world_baroque_opulence", label: "豪奢・バロック的世界", category: "世界観", tokens: ["opulent baroque world", "lavish", "豪奢", "絢爛"] },
];

const CULTURE: MonitoredMotif[] = [
  { id: "cul_japanese", label: "和・日本", category: "文化圏", tokens: ["japanese culture", "wabi sabi", "和風", "日本文化"] },
  { id: "cul_nordic", label: "北欧", category: "文化圏", tokens: ["nordic", "scandinavian", "北欧"] },
  { id: "cul_eastern_europe", label: "東欧", category: "文化圏", tokens: ["eastern european", "slavic folk", "東欧"] },
  { id: "cul_middle_east", label: "中東・アラビア", category: "文化圏", tokens: ["middle eastern", "arabian", "persian", "中東", "アラビア"] },
  { id: "cul_latin", label: "ラテン・中南米", category: "文化圏", tokens: ["latin american", "mexican folk", "ラテン", "中南米"] },
  { id: "cul_african", label: "アフリカ", category: "文化圏", tokens: ["african", "tribal african", "アフリカ"] },
  { id: "cul_south_asian", label: "南アジア・インド", category: "文化圏", tokens: ["south asian", "indian culture", "南アジア", "インド"] },
  { id: "cul_southeast_asian", label: "東南アジア", category: "文化圏", tokens: ["southeast asian", "thai balinese", "東南アジア"] },
  { id: "cul_chinese", label: "中華", category: "文化圏", tokens: ["chinese culture", "chinoiserie", "中華", "中国風"] },
  { id: "cul_korean", label: "韓国", category: "文化圏", tokens: ["korean culture", "hanbok", "韓国"] },
  { id: "cul_mediterranean", label: "地中海", category: "文化圏", tokens: ["mediterranean", "greek aegean", "地中海"] },
  { id: "cul_celtic", label: "ケルト", category: "文化圏", tokens: ["celtic", "celtic folklore", "ケルト"] },
  { id: "cul_slavic", label: "スラブ", category: "文化圏", tokens: ["slavic", "russian folk", "スラブ"] },
  { id: "cul_indigenous", label: "ネイティブ・先住民", category: "文化圏", tokens: ["indigenous", "native tribal", "先住民", "ネイティブ"] },
];

const PRODUCT: MonitoredMotif[] = [
  { id: "prod_industrial", label: "インダストリアルデザイン", category: "プロダクト", tokens: ["industrial design", "industrial product", "インダストリアルデザイン"] },
  { id: "prod_minimal", label: "ミニマルプロダクト", category: "プロダクト", tokens: ["minimal product design", "muji style", "ミニマルプロダクト"] },
  { id: "prod_retro_appliance", label: "レトロ家電", category: "プロダクト", tokens: ["retro appliance", "vintage electronics", "レトロ家電"] },
  { id: "prod_nordic_furniture", label: "北欧家具", category: "プロダクト", tokens: ["nordic furniture", "mid-century furniture", "北欧家具"] },
  { id: "prod_concept_car", label: "コンセプトカー", category: "プロダクト", tokens: ["concept car", "automotive design", "コンセプトカー"] },
  { id: "prod_gadget", label: "ガジェットデザイン", category: "プロダクト", tokens: ["gadget design", "device industrial design", "ガジェットデザイン"] },
  { id: "prod_packaging", label: "パッケージデザイン", category: "プロダクト", tokens: ["packaging design", "package mockup", "パッケージデザイン"] },
  { id: "prod_furniture", label: "家具・インテリア什器", category: "プロダクト", tokens: ["furniture design", "designer chair", "家具デザイン"] },
  { id: "prod_watch", label: "時計デザイン", category: "プロダクト", tokens: ["watch design", "timepiece", "時計デザイン"] },
  { id: "prod_lighting", label: "照明器具デザイン", category: "プロダクト", tokens: ["lighting fixture design", "designer lamp", "照明器具"] },
  { id: "prod_toy", label: "玩具・フィギュアデザイン", category: "プロダクト", tokens: ["toy design", "figure design", "玩具デザイン", "フィギュア"] },
  { id: "prod_stationery", label: "文具デザイン", category: "プロダクト", tokens: ["stationery design", "paper goods", "文具デザイン"] },
];

const MATERIAL: MonitoredMotif[] = [
  { id: "mat_metal", label: "メタル・金属", category: "素材", tokens: ["metal", "chrome", "brushed metal", "メタル", "金属"] },
  { id: "mat_glass", label: "ガラス", category: "素材", tokens: ["glass", "frosted glass", "ガラス"] },
  { id: "mat_liquid", label: "液体・流体", category: "素材", tokens: ["liquid", "fluid", "molten", "液体", "流体"] },
  { id: "mat_silk", label: "シルク・布", category: "素材", tokens: ["silk", "flowing fabric", "satin", "シルク", "布"] },
  { id: "mat_concrete", label: "コンクリート", category: "素材", tokens: ["concrete", "raw concrete", "コンクリート"] },
  { id: "mat_wood", label: "木・木材", category: "素材", tokens: ["wood", "wooden texture", "timber", "木", "木材"] },
  { id: "mat_ceramic", label: "陶器・セラミック", category: "素材", tokens: ["ceramic", "porcelain", "陶器", "セラミック"] },
  { id: "mat_holographic", label: "ホログラフィック素材", category: "素材", tokens: ["holographic material", "iridescent", "ホログラフィック素材", "玉虫色"] },
  { id: "mat_velvet", label: "ベルベット", category: "素材", tokens: ["velvet", "plush velvet", "ベルベット"] },
  { id: "mat_marble", label: "大理石", category: "素材", tokens: ["marble", "marble texture", "大理石"] },
  { id: "mat_paper", label: "紙・ペーパー", category: "素材", tokens: ["paper", "paper craft", "origami", "紙", "ペーパー"] },
  { id: "mat_rubber", label: "ラバー・ゴム", category: "素材", tokens: ["rubber", "latex", "ラバー", "ゴム"] },
  { id: "mat_acrylic", label: "アクリル・透明樹脂", category: "素材", tokens: ["acrylic", "clear resin", "アクリル", "透明樹脂"] },
  { id: "mat_organic", label: "苔・有機・自然素材", category: "素材", tokens: ["moss", "organic texture", "natural material", "苔", "有機素材"] },
];

const EMOTION: MonitoredMotif[] = [
  { id: "emo_serene", label: "静謐・穏やか", category: "感情トーン", tokens: ["serene", "calm", "peaceful mood", "静謐", "穏やか"] },
  { id: "emo_tense", label: "緊張・張りつめ", category: "感情トーン", tokens: ["tense", "suspenseful mood", "緊張感", "張りつめ"] },
  { id: "emo_decadent", label: "退廃・耽美", category: "感情トーン", tokens: ["decadent mood", "aesthetic decay", "退廃的", "耽美"] },
  { id: "emo_euphoric", label: "高揚・多幸", category: "感情トーン", tokens: ["euphoric", "uplifting", "blissful", "高揚", "多幸感"] },
  { id: "emo_melancholy", label: "憂い・メランコリー", category: "感情トーン", tokens: ["melancholy", "wistful", "憂い", "メランコリー"] },
  { id: "emo_intoxicated", label: "陶酔・恍惚", category: "感情トーン", tokens: ["intoxicated mood", "dreamy daze", "陶酔", "恍惚"] },
  { id: "emo_uneasy", label: "不穏・不安", category: "感情トーン", tokens: ["uneasy", "unsettling", "ominous", "不穏", "不安"] },
  { id: "emo_nostalgic_mood", label: "郷愁・ノスタルジー感情", category: "感情トーン", tokens: ["nostalgic mood", "longing", "郷愁", "懐かしさ"] },
  { id: "emo_mysterious", label: "神秘・ミステリアス", category: "感情トーン", tokens: ["mysterious mood", "enigmatic", "神秘的", "ミステリアス"] },
  { id: "emo_sensual", label: "官能・艶", category: "感情トーン", tokens: ["sensual mood", "alluring", "官能的", "艶"] },
  { id: "emo_lonely", label: "孤独・静寂感", category: "感情トーン", tokens: ["lonely", "solitary", "isolation mood", "孤独", "静寂感"] },
  { id: "emo_powerful", label: "荘厳・力強さ", category: "感情トーン", tokens: ["powerful mood", "majestic", "awe", "荘厳", "力強い"] },
];

const GENRE: MonitoredMotif[] = [
  { id: "genre_y2k", label: "Y2K", category: "ジャンル", tokens: ["y2k aesthetic", "y2k", "2000s cyber", "y2k"] },
  { id: "genre_cottagecore", label: "コテージコア", category: "ジャンル", tokens: ["cottagecore", "rural cozy aesthetic", "コテージコア"] },
  { id: "genre_dark_academia", label: "ダークアカデミア", category: "ジャンル", tokens: ["dark academia", "ダークアカデミア"] },
  { id: "genre_light_academia", label: "ライトアカデミア", category: "ジャンル", tokens: ["light academia", "ライトアカデミア"] },
  { id: "genre_steampunk", label: "スチームパンク", category: "ジャンル", tokens: ["steampunk", "スチームパンク"] },
  { id: "genre_fairycore", label: "フェアリーコア", category: "ジャンル", tokens: ["fairycore", "fairy aesthetic", "フェアリーコア"] },
  { id: "genre_vaporwave", label: "ヴェイパーウェイヴ（ジャンル）", category: "ジャンル", tokens: ["vaporwave aesthetic", "vaporwave genre", "ヴェイパーウェイヴ系"] },
  { id: "genre_solarpunk", label: "ソーラーパンク", category: "ジャンル", tokens: ["solarpunk", "eco-futurism", "ソーラーパンク"] },
  { id: "genre_dreamcore", label: "ドリームコア", category: "ジャンル", tokens: ["dreamcore", "weirdcore", "ドリームコア"] },
  { id: "genre_jirai", label: "地雷系", category: "ジャンル", tokens: ["jirai kei", "地雷系", "病みかわ"] },
  { id: "genre_ryousan", label: "量産型", category: "ジャンル", tokens: ["ryousangata", "量産型"] },
  { id: "genre_cybergoth", label: "サイバーゴス", category: "ジャンル", tokens: ["cybergoth", "サイバーゴス"] },
  { id: "genre_grunge", label: "グランジ", category: "ジャンル", tokens: ["grunge aesthetic", "90s grunge", "グランジ"] },
  { id: "genre_bohemian", label: "ボヘミアン", category: "ジャンル", tokens: ["bohemian", "boho", "ボヘミアン"] },
  { id: "genre_balletcore", label: "バレエコア", category: "ジャンル", tokens: ["balletcore", "ballet aesthetic", "バレエコア"] },
  { id: "genre_mermaidcore", label: "マーメイド・アクアティック", category: "ジャンル", tokens: ["mermaidcore", "aquatic aesthetic", "マーメイドコア"] },
  { id: "genre_witchcore", label: "ウィッチコア", category: "ジャンル", tokens: ["witchcore", "witchy aesthetic", "ウィッチコア"] },
  { id: "genre_retrofuturism", label: "レトロフューチャリズム", category: "ジャンル", tokens: ["retrofuturism", "retro future aesthetic", "レトロフューチャー"] },
  { id: "genre_afrofuturism", label: "アフロフューチャリズム", category: "ジャンル", tokens: ["afrofuturism", "アフロフューチャリズム"] },
  { id: "genre_normcore", label: "ノームコア", category: "ジャンル", tokens: ["normcore", "ノームコア"] },
  { id: "genre_kidcore", label: "キッドコア・トイポップ", category: "ジャンル", tokens: ["kidcore", "toy pop aesthetic", "キッドコア"] },
  { id: "genre_acubi", label: "アクビ・ストリートミニマル", category: "ジャンル", tokens: ["acubi aesthetic", "cyber y2k minimal", "アクビ"] },
  { id: "genre_goblincore", label: "ゴブリンコア・自然退廃", category: "ジャンル", tokens: ["goblincore", "earthy decay aesthetic", "ゴブリンコア"] },
  { id: "genre_angelcore", label: "エンジェルコア", category: "ジャンル", tokens: ["angelcore", "ethereal angel aesthetic", "エンジェルコア"] },
];

const ERA: MonitoredMotif[] = [
  { id: "era_80s", label: "80年代", category: "時代", tokens: ["1980s", "80s aesthetic", "80年代"] },
  { id: "era_90s", label: "90年代", category: "時代", tokens: ["1990s", "90s aesthetic", "90年代"] },
  { id: "era_2000s", label: "2000年代", category: "時代", tokens: ["2000s era", "early 2000s", "2000年代"] },
  { id: "era_retrofuture", label: "レトロフューチャー時代", category: "時代", tokens: ["retro future era", "atompunk", "レトロフューチャー時代"] },
  { id: "era_medieval", label: "中世", category: "時代", tokens: ["medieval era", "middle ages", "中世"] },
  { id: "era_taisho", label: "大正・モダン", category: "時代", tokens: ["taisho era", "taisho roman", "大正", "大正ロマン"] },
  { id: "era_showa", label: "昭和レトロ", category: "時代", tokens: ["showa retro", "showa era", "昭和レトロ", "昭和"] },
  { id: "era_victorian", label: "ヴィクトリア朝", category: "時代", tokens: ["victorian era", "ヴィクトリア朝"] },
  { id: "era_1920s", label: "1920年代・ギャツビー", category: "時代", tokens: ["1920s", "gatsby era", "roaring twenties", "1920年代"] },
  { id: "era_1970s", label: "1970年代", category: "時代", tokens: ["1970s", "70s retro", "70年代"] },
  { id: "era_edo", label: "江戸", category: "時代", tokens: ["edo period", "江戸"] },
  { id: "era_future2050", label: "近未来2050", category: "時代", tokens: ["year 2050", "mid-21st century", "近未来2050"] },
];

const GROUP_B2: MonitoredMotif[] = [
  ...WORLDVIEW, ...CULTURE, ...PRODUCT, ...MATERIAL, ...EMOTION, ...GENRE, ...ERA,
];

/** 監視要素タクソノミー（curated 全体）。biasAnalyzer から re-export して使用。 */
export const MONITORED_MOTIFS: readonly MonitoredMotif[] = [
  ...GROUP_A, ...GROUP_B1, ...GROUP_B2,
];

/** カテゴリ表示順（専用画面のグルーピング用） */
export const MOTIF_CATEGORY_ORDER = [
  "衣装", "髪", "ポーズ", "色", "ライティング", "カメラ", "演出", "背景", "小物",
  "芸術様式", "建築", "広告表現", "映画表現", "写真表現", "雑誌表現",
  "世界観", "文化圏", "プロダクト", "素材", "感情トーン", "ジャンル", "時代", "その他",
] as const;
