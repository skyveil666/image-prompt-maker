export interface PresetItem {
  id: string;
  label: string; // UI表示用
  ja: string;    // 日本語プロンプト断片（ChatGPT Image 向け）
  en: string;    // 英語短縮（Nano Banana / Gemini 向け）
}

/* ---------------- HAIR ---------------- */

export const HAIR_LENGTHS: PresetItem[] = [
  { id: "very_short",   label: "ベリーショート",     ja: "ベリーショート",                     en: "very short, pixie-level" },
  { id: "short",        label: "ショート",           ja: "ショート丈",                         en: "short" },
  { id: "wolf_short",   label: "ウルフショート",      ja: "ウルフショート",                     en: "wolf cut short" },
  { id: "bob",          label: "ボブ",               ja: "ボブカット",                         en: "bob cut" },
  { id: "hime",         label: "姫カット丈",          ja: "姫カット丈（フロントが短く横に長い）", en: "hime cut length" },
  { id: "medium",       label: "ミディアム",          ja: "ミディアム丈",                       en: "medium length" },
  { id: "long",         label: "ロング",              ja: "ロング丈",                           en: "long" },
  { id: "waist_length", label: "腰まで",              ja: "腰まで届くロング",                   en: "waist-length" },
  { id: "extra_long",   label: "超ロング",            ja: "腰下まで届く超ロング",               en: "extra-long, past the waist" },
  { id: "floor_length", label: "床に届く超ロング",    ja: "床に届くほどの超超ロング",           en: "floor-length ultra long hair" },
  { id: "asymmetric",   label: "アシンメトリー",      ja: "左右非対称なアシンメトリーカット",   en: "asymmetric cut" },
];

export const HAIR_SHAPES: PresetItem[] = [
  { id: "straight",      label: "ストレート",        ja: "ストレート",                       en: "straight" },
  { id: "wave",          label: "ウェーブ",          ja: "ウェーブ",                         en: "wavy" },
  { id: "layer",         label: "レイヤー",          ja: "レイヤーカット",                   en: "layered cut" },
  { id: "heavy_layer",   label: "レイヤー強め",      ja: "レイヤーを強めに入れたカット",     en: "heavy layered cut" },
  { id: "hime_cut",      label: "姫カット",          ja: "姫カット（サイドを切り揃えた姫スタイル）", en: "hime cut" },
  { id: "wolf_cut",      label: "ウルフカット",      ja: "ウルフカット",                     en: "wolf cut" },
  { id: "mash",          label: "マッシュ",          ja: "マッシュスタイル",                 en: "mushroom / mash cut" },
  { id: "flare_bob",     label: "外ハネボブ",        ja: "外ハネボブ",                       en: "flipped-out bob" },
  { id: "constrict",     label: "くびれヘア",        ja: "くびれが出るスタイリング",         en: "constricted wavy style" },
  { id: "twintail",      label: "ツインテール",      ja: "ツインテール",                     en: "twin tails" },
  { id: "half_twin",     label: "ハーフツイン",      ja: "ハーフアップツインテール",         en: "half-up twin tails" },
  { id: "bun_twin",      label: "お団子ツイン",      ja: "左右お団子ツインスタイル",         en: "double bun twin style" },
  { id: "braid_twin",    label: "三つ編みツイン",    ja: "左右三つ編みツインテール",         en: "braided twin tails" },
  { id: "side_braid",    label: "サイド三つ編み",    ja: "サイドに垂れた三つ編み",           en: "side braid" },
  { id: "braid",         label: "編み込み",          ja: "編み込みスタイル",                 en: "braided style" },
  { id: "ponytail",      label: "ポニーテール",      ja: "ポニーテール",                     en: "ponytail" },
  { id: "high_ponytail", label: "高めポニーテール",  ja: "高い位置でまとめたポニーテール",   en: "high ponytail" },
  { id: "low_ponytail",  label: "低めポニーテール",  ja: "低い位置でまとめたポニーテール",   en: "low ponytail" },
  { id: "updo",          label: "アップスタイル",    ja: "アップでまとめた髪",               en: "updo" },
  { id: "jellyfish",     label: "クラゲヘア",        ja: "クラゲヘア（上はまとめて下はふわり広がる）", en: "jellyfish hairstyle" },
  { id: "cyber_bob",     label: "サイバーボブ",      ja: "サイバーパンク風のボブカット",     en: "cyber bob" },
];

export const HAIR_TEXTURES: PresetItem[] = [
  { id: "silky",        label: "さらさら",      ja: "さらさらした柔らかい質感",                     en: "silky" },
  { id: "wet",          label: "濡れ髪",        ja: "濡れ髪のような艶質感",                         en: "wet-look glossy" },
  { id: "semi_wet",     label: "セミウェット",   ja: "セミウェットな束感のある質感",                 en: "semi-wet, damp-look" },
  { id: "fluffy",       label: "ふわっと",      ja: "ふわりと空気を含んだ質感",                     en: "airy, fluffy" },
  { id: "airy",         label: "エアリー",      ja: "軽くエアリーに広がる質感",                     en: "lightweight airy" },
  { id: "transparent",  label: "透明感",        ja: "透け感・透明感のある軽い質感",                 en: "translucent sheer texture" },
  { id: "high_gloss",   label: "艶強め",        ja: "強い艶と光沢のある質感",                       en: "high gloss, shiny" },
  { id: "bundle_strand",label: "束感強め",      ja: "束感を強調したスタイリング",                   en: "strong strand definition" },
  { id: "matte",        label: "マット",        ja: "光沢を抑えたマット質感",                       en: "matte finish" },
  { id: "glass",        label: "ガラス質感",    ja: "ガラスのような光沢・透明感のある質感",         en: "glass-like luminous" },
  { id: "sharp",        label: "シャープ",      ja: "シャープに整えられた毛束",                     en: "sharp clean lines" },
  { id: "cyber",        label: "サイバー風",    ja: "サイバー感のあるエッジィな質感",               en: "edgy, cyber feel" },
  { id: "cyber_glow",   label: "サイバー発光",  ja: "発光するようなサイバーな質感",                 en: "glowing cyber hair" },
];

export const HAIR_COLOR_MODES: PresetItem[] = [
  { id: "lock",   label: "変更しない",       ja: "髪色は元画像から変更しない",                    en: "keep original hair color" },
  { id: "subtle", label: "少しだけ色味変更", ja: "髪色は元画像のトーンを基調にわずかに最適化",    en: "subtle color shift only" },
  { id: "bold",   label: "大きく変更",       ja: "髪色を雰囲気指定に合わせて大きく変える",        en: "bold color change matching mood" },
];

export const HAIR_COLORS: PresetItem[] = [
  { id: "inherit",          label: "元色を継承",          ja: "元画像の髪色を継承",                           en: "inherit original hair color" },
  { id: "black",            label: "黒",                  ja: "ブラック",                                     en: "black" },
  { id: "brown",            label: "ブラウン",            ja: "ブラウン",                                     en: "brown" },
  { id: "blonde",           label: "ブロンド",            ja: "ブロンド",                                     en: "blonde" },
  { id: "ash",              label: "アッシュ",            ja: "アッシュ",                                     en: "ash" },
  { id: "red",              label: "レッド",              ja: "レッド",                                       en: "red" },
  { id: "pink",             label: "ピンク",              ja: "ピンク",                                       en: "pink" },
  { id: "blue",             label: "ブルー",              ja: "ブルー",                                       en: "blue" },
  { id: "silver",           label: "シルバー",            ja: "シルバー",                                     en: "silver" },
  { id: "white_silver",     label: "白銀",                ja: "白銀（パールホワイト寄りのシルバー）",         en: "pearl white silver" },
  { id: "milk_tea",         label: "ミルクティー",        ja: "ミルクティーカラー（淡いブラウンベージュ）",   en: "milk tea brown beige" },
  { id: "rainbow",          label: "レインボー",          ja: "レインボー（インナーカラー含む）",             en: "rainbow / inner colors" },
  { id: "black_red_mesh",   label: "黒×赤メッシュ",      ja: "黒髪に赤のメッシュカラーを入れた",            en: "black hair with red mesh highlights" },
  { id: "black_blue_mesh",  label: "黒×青メッシュ",      ja: "黒髪に青のメッシュカラーを入れた",            en: "black hair with blue mesh highlights" },
  { id: "black_purple_mesh",label: "黒×紫メッシュ",      ja: "黒髪に紫のメッシュカラーを入れた",            en: "black hair with purple mesh highlights" },
  { id: "teal_gradient",    label: "青緑グラデ",          ja: "青緑のグラデーションカラー",                   en: "teal green gradient" },
  { id: "pink_gradient",    label: "ピンクグラデ",        ja: "ピンクのグラデーションカラー",                 en: "pink gradient" },
  { id: "inner_color",      label: "インナーカラー",      ja: "インナーカラー（内側に差し色）",               en: "inner color highlights" },
  { id: "hem_color",        label: "裾カラー",            ja: "裾カラー（毛先に差し色）",                     en: "hem / tip color" },
  { id: "neon_color",       label: "ネオンカラー",        ja: "ネオン発光系の鮮烈カラー",                     en: "neon electric color" },
  { id: "aurora_color",     label: "オーロラカラー",      ja: "オーロラのように複数色が溶け合うグラデーション",en: "aurora holographic gradient" },
  { id: "rainbow_mesh",     label: "レインボーメッシュ",  ja: "複数色のメッシュを散らしたレインボーメッシュ",  en: "rainbow mesh highlights" },
  { id: "white",              label: "ホワイト",              ja: "純白・雪白の髪",                                   en: "pure white hair" },
  { id: "purple",             label: "パープル",              ja: "パープル",                                         en: "purple" },
  { id: "white_aqua",         label: "白×水色",               ja: "白髪に水色のメッシュ・グラデーション",               en: "white hair with aqua highlights" },
  { id: "black_aqua_grad",    label: "黒×水色グラデ",         ja: "黒髪から水色へのグラデーションカラー",               en: "black to aqua blue gradient" },
  { id: "black_teal_mesh",    label: "黒×ティールメッシュ",   ja: "黒髪にティール（青緑）のメッシュを入れた",           en: "black hair with teal mesh highlights" },
];

export const HAIR_BANGS: PresetItem[] = [
  { id: "full",        label: "フル前髪",        ja: "厚めの前髪",                               en: "full bangs" },
  { id: "swept",       label: "斜め前髪",        ja: "斜めに流した前髪",                         en: "swept side bangs" },
  { id: "airy",        label: "シースルー",      ja: "シースルーな薄い前髪",                     en: "airy see-through bangs" },
  { id: "curtain",     label: "カーテン",        ja: "カーテンバング",                           en: "curtain bangs" },
  { id: "blunt",       label: "ぱっつん",        ja: "ぱっつん前髪",                             en: "blunt bangs" },
  { id: "hime_bangs",  label: "姫カット前髪",    ja: "姫カット風の前髪（サイドを切り揃えた）",  en: "hime-style princess bangs" },
  { id: "asymmetric",  label: "アシメ前髪",      ja: "左右非対称なアシメ前髪",                  en: "asymmetric bangs" },
  { id: "center_part", label: "センターパート",   ja: "センターパートでわけた前髪",               en: "center part" },
  { id: "face_layer",  label: "顔周りレイヤー",  ja: "顔周りに入ったレイヤー",                  en: "face-framing layers" },
  { id: "antenna",     label: "触角あり",        ja: "アホ毛・触角のような飛び出た前髪",        en: "ahoge / antenna strand" },
  { id: "eye_cover",   label: "目隠れ前髪",      ja: "片目または両目にかかる前髪",              en: "eye-covering bangs" },
  { id: "none",        label: "なし",            ja: "前髪なし／センター分け",                  en: "no bangs / center part" },
];

export const HAIR_TIPS: PresetItem[] = [
  { id: "natural",     label: "自然",            ja: "自然な毛先",                   en: "natural tips" },
  { id: "inner_curl",  label: "内巻き",          ja: "内巻きカール",                 en: "inner curl" },
  { id: "outer_curl",  label: "外ハネ",          ja: "外ハネカール",                 en: "outer curl" },
  { id: "wave",        label: "ウェーブ",        ja: "ウェーブする毛先",             en: "wavy tips" },
  { id: "strong_wave", label: "強めウェーブ",    ja: "強めにウェーブした毛先",       en: "strong wavy tips" },
  { id: "loose_wave",  label: "ゆる巻き",        ja: "ゆる巻きのふわふわな毛先",     en: "loose wavy tips" },
  { id: "random_curl", label: "ランダムカール",  ja: "ランダムにカールした毛先",     en: "random curl tips" },
  { id: "blunt",       label: "切りそろえ",      ja: "切りそろえた毛先",             en: "blunt tips" },
  { id: "feathered",   label: "羽のような軽さ",  ja: "羽のように軽く流れる毛先",     en: "feathered tips" },
  { id: "sharp",       label: "シャープ",        ja: "シャープに切り落とした毛先",   en: "sharp-cut tips" },
];

export const HAIR_VOLUMES: PresetItem[] = [
  { id: "flat",         label: "ぺたんこ",        ja: "ボリュームを抑えたぺたんこな質感",             en: "flat, low volume" },
  { id: "low_volume",   label: "ボリューム控えめ", ja: "ボリュームをやや抑えたスタイル",               en: "slightly low volume" },
  { id: "light",        label: "軽め",            ja: "軽くて動きのある質感",                         en: "light, airy feel" },
  { id: "natural",      label: "自然",            ja: "自然なボリューム",                             en: "natural volume" },
  { id: "volume",       label: "ふんわり",        ja: "ふんわりとしたボリューム",                     en: "voluminous" },
  { id: "extra_volume", label: "ボリューム強め",  ja: "ボリュームを強調した盛りスタイル",             en: "extra voluminous" },
  { id: "heavy",        label: "重め",            ja: "重みを感じる密度の高いスタイル",               en: "heavy, dense volume" },
  { id: "floating",     label: "浮遊感",          ja: "重力を感じさせない浮遊感のあるスタイル",       en: "floating, gravity-defying" },
  { id: "wind",          label: "風になびく",      ja: "風になびいているような動きのあるスタイル",         en: "wind-blown, flowing" },
  { id: "water_float",   label: "水中浮遊感",      ja: "水中で揺れるような無重力浮遊感の髪",               en: "underwater floating hair" },
  { id: "tip_flow",      label: "毛先だけ流れる",  ja: "毛先だけが風に流れるような軽やかな動き",           en: "tips gently flowing in wind" },
  { id: "one_side_flow", label: "片側流れ",        ja: "片側だけが大きくなびく非対称な動き",               en: "one-sided sweep, asymmetric flow" },
];

export const HAIR_ACCESSORIES: PresetItem[] = [
  { id: "none",              label: "なし",              ja: "ヘアアクセサリーなし",             en: "no hair accessory" },
  { id: "hairpin",           label: "ヘアピン",          ja: "ヘアピン",                         en: "hairpin" },
  { id: "ribbon",            label: "リボン",            ja: "リボン",                           en: "ribbon" },
  { id: "flower",            label: "花飾り",            ja: "花のヘアアクセサリー",             en: "flower accessory" },
  { id: "ears",              label: "猫耳・うさ耳",      ja: "猫耳／うさ耳など動物耳",          en: "cat / bunny ears" },
  { id: "fox_kanzashi",      label: "狐飾り",            ja: "狐面ミニ飾り・狐モチーフのかんざし",en: "fox-motif kanzashi" },
  { id: "japanese_kanzashi", label: "和風かんざし",      ja: "和風かんざし",                     en: "Japanese kanzashi" },
  { id: "metal_clip",        label: "金属クリップ",      ja: "金属ヘアクリップ",                 en: "metallic hair clip" },
  { id: "cyber_ring",        label: "サイバーリング",    ja: "サイバー感のあるリング型アクセ",   en: "cyber ring accessory" },
  { id: "chain_accessory",   label: "チェーンアクセ",    ja: "チェーンを使ったヘアアクセサリー", en: "chain hair accessory" },
  { id: "veil",              label: "ベール",            ja: "ベール（薄い布を頭に垂らした）",   en: "veil" },
  { id: "headphones",        label: "ヘッドホン",        ja: "ヘッドホン",                       en: "headphones" },
  { id: "cap",               label: "キャップ・帽子",    ja: "キャップ／帽子",                   en: "cap / hat" },
  { id: "circlet",           label: "サークレット",      ja: "サークレット／ティアラ",           en: "circlet / tiara" },
];

/** スタイル系統（時代・文化・世界観カテゴリ） */
export const HAIR_STYLES: PresetItem[] = [
  { id: "modern",        label: "現代風",          ja: "現代的でトレンドを押さえたスタイル",           en: "modern contemporary" },
  { id: "korean",        label: "韓国風",          ja: "韓国風のトレンドヘアスタイル",                 en: "Korean style" },
  { id: "y2k",           label: "Y2K",             ja: "2000年代初頭のY2Kスタイル",                    en: "Y2K 2000s style" },
  { id: "heisei_gal",    label: "平成ギャル風",    ja: "平成ギャル風のヘアスタイル",                   en: "Heisei gal style" },
  { id: "retro",         label: "レトロ",          ja: "レトロな雰囲気のヘアスタイル",                 en: "retro vintage" },
  { id: "showa_idol",    label: "昭和アイドル風",  ja: "昭和アイドル風のカールヘア",                   en: "Showa idol curled style" },
  { id: "taisho_roman",  label: "大正ロマン風",    ja: "大正ロマン風の和洋折衷ヘアスタイル",           en: "Taisho roman style" },
  { id: "wa_gothic",     label: "和ゴシック",      ja: "和と西洋ゴシックが融合したスタイル",           en: "Japanese Gothic fusion" },
  { id: "cyberpunk",     label: "サイバーパンク",  ja: "サイバーパンク世界観のエッジィなスタイル",     en: "cyberpunk edgy" },
  { id: "near_future",   label: "近未来",          ja: "近未来的でクリーンなスタイル",                 en: "near-future sleek" },
  { id: "magical_girl",  label: "魔法少女風",      ja: "魔法少女風のフェミニンで華やかなスタイル",     en: "magical girl style" },
  { id: "gothic_lolita", label: "ゴスロリ風",      ja: "ゴシックロリータ風の華やかダークスタイル",     en: "gothic lolita" },
  { id: "street",        label: "ストリート",      ja: "ストリートカルチャー系のスタイル",             en: "street style" },
  { id: "anime",         label: "アニメ風",        ja: "アニメキャラクターのような誇張スタイル",       en: "anime character style" },
  { id: "doll",          label: "ドール風",        ja: "西洋人形のようなドール系スタイル",             en: "doll-like style" },
  { id: "viral",         label: "バズり系",        ja: "SNSでバズる印象的なスタイル（プール参照）",    en: "viral trending style" },
  { id: "unique",        label: "珍しい髪型",      ja: "一般的でない独自性の高い珍しいスタイル",       en: "unique unconventional style" },
];

/* ---------------- OUTFIT ---------------- */

export const OUTFIT_STYLES: PresetItem[] = [
  { id: "street", label: "ストリート", ja: "ストリート系の構成", en: "street style" },
  { id: "mode", label: "モード", ja: "モード系の構築的な構成", en: "mode/avant-garde" },
  { id: "cyber", label: "サイバー", ja: "サイバー系", en: "cyber style" },
  { id: "japanese", label: "和風", ja: "和の意匠を取り入れた構成", en: "Japanese motif" },
  { id: "gothic", label: "ゴシック", ja: "ゴシック調", en: "gothic" },
  { id: "military", label: "ミリタリー", ja: "ミリタリー", en: "military" },
  { id: "techwear", label: "テックウェア", ja: "テックウェア", en: "techwear" },
  { id: "dress", label: "ドレス", ja: "ドレス系", en: "dress style" },
  { id: "armor", label: "アーマー", ja: "装甲のようなアーマー風", en: "armor-like" },
  { id: "y2k", label: "Y2K", ja: "Y2Kファッション（2000年代初頭のポップなスタイル）", en: "Y2K fashion style" },
  { id: "lolita", label: "ロリータ", ja: "ロリータファッション（フリル・レース・ふんわりスカート）", en: "lolita fashion" },
  { id: "uniform", label: "制服風", ja: "制服をベースにした衣装", en: "uniform-based outfit" },
  { id: "future_dress", label: "近未来ドレス", ja: "近未来的なドレス（メタリックやホログラム素材）", en: "near-future dress" },
  { id: "wa_modern", label: "和モダン", ja: "和をモダンに解釈した現代和装スタイル", en: "modern Japanese style" },
  { id: "idol", label: "アイドル風", ja: "アイドルのステージ衣装風スタイル", en: "idol stage costume style" },
  { id: "runway", label: "ランウェイ風", ja: "ファッションショーのランウェイのような洗練された衣装", en: "runway fashion show style" },
];

export const OUTFIT_EXPOSURES: PresetItem[] = [
  { id: "low", label: "露出控えめ", ja: "露出は抑制的・清楚なデザイン", en: "low exposure, modest coverage" },
  { id: "high_neck", label: "ハイネック", ja: "ハイネック・首を隠すデザイン", en: "high neck collar" },
  { id: "long_sleeve", label: "長袖", ja: "長袖・腕を覆うデザイン", en: "long sleeve" },
  { id: "normal", label: "普通", ja: "標準的な露出度", en: "normal exposure" },
  { id: "shoulder_off", label: "肩出し", ja: "オフショルダー・肩を出したデザイン", en: "off-shoulder" },
  { id: "high", label: "高め", ja: "適度に露出のあるシルエット", en: "moderate exposure" },
];

export const OUTFIT_MATERIALS: PresetItem[] = [
  { id: "chiffon", label: "シフォン", ja: "シフォン素材（軽く透け感がある布地）", en: "chiffon" },
  { id: "lace", label: "レース", ja: "レース素材（繊細な模様のある透け生地）", en: "lace" },
  { id: "velvet", label: "ベルベット", ja: "ベルベット素材（起毛感のある高級布地）", en: "velvet" },
  { id: "organza", label: "オーガンジー", ja: "オーガンジー素材（透明感のあるドレス生地）", en: "organza" },
  { id: "knit", label: "ニット", ja: "ニット素材（編み物の温かみある生地）", en: "knit / knitwear" },
  { id: "cloth", label: "布", ja: "布素材主体", en: "fabric" },
  { id: "leather", label: "レザー", ja: "レザー素材主体", en: "leather" },
  { id: "enamel", label: "エナメル", ja: "エナメル素材", en: "enamel" },
  { id: "pvc", label: "PVC", ja: "PVC・ビニール素材（光沢のある透明〜半透明）", en: "PVC / vinyl material" },
  { id: "nylon", label: "ナイロン", ja: "ナイロン素材主体", en: "nylon" },
  { id: "denim", label: "デニム", ja: "デニム", en: "denim" },
  { id: "metal", label: "金属", ja: "金属パーツ主体", en: "metallic accents" },
  { id: "transparent", label: "透明素材", ja: "透明素材を一部に使用", en: "transparent material" },
  { id: "liquid_metal", label: "液体金属", ja: "液体金属のような流動感と鏡面光沢のある素材", en: "liquid metal shiny material" },
  { id: "crystal_glass", label: "クリスタル", ja: "クリスタルガラスのような透明感と光の屈折", en: "crystal glass refractive material" },
  { id: "neon_fabric", label: "ネオン発光", ja: "発光するネオンカラーのファブリック素材", en: "neon glowing fabric material" },
];

export const OUTFIT_COLORS: PresetItem[] = [
  { id: "black", label: "黒系", ja: "ブラック基調", en: "black-based" },
  { id: "white", label: "白系", ja: "ホワイト基調", en: "white-based" },
  { id: "red", label: "赤系", ja: "レッド基調", en: "red-based" },
  { id: "blue", label: "青系", ja: "ブルー基調", en: "blue-based" },
  { id: "green", label: "緑系", ja: "グリーン基調", en: "green-based" },
  { id: "pink", label: "ピンク系", ja: "ピンク基調", en: "pink-based" },
  { id: "purple", label: "紫系", ja: "パープル・バイオレット基調", en: "purple / violet-based" },
  { id: "light_blue", label: "水色系", ja: "水色・スカイブルー基調", en: "light blue / sky blue-based" },
  { id: "gold", label: "金色系", ja: "ゴールド・アンバー基調", en: "gold / amber-based" },
  { id: "silver", label: "銀色系", ja: "シルバー・クロム基調", en: "silver / chrome-based" },
  { id: "gradient", label: "グラデーション", ja: "複数色のグラデーション配色", en: "gradient multi-color" },
  { id: "accent_color", label: "差し色あり", ja: "ベースカラーに差し色を入れた配色", en: "accent color highlight" },
  { id: "inherit", label: "元画像色を継承", ja: "元画像の衣装色を抽出して継承", en: "inherit original outfit color" },
];

export const OUTFIT_SILHOUETTES: PresetItem[] = [
  { id: "tight", label: "タイト", ja: "身体に沿うタイトなシルエット", en: "tight silhouette" },
  { id: "a_line", label: "Aライン", ja: "ウエストから裾に向かって広がるAラインシルエット", en: "A-line silhouette" },
  { id: "flare", label: "フレア", ja: "裾が大きくフレアに広がるシルエット", en: "flare silhouette" },
  { id: "oversized", label: "オーバーサイズ", ja: "オーバーサイズシルエット", en: "oversized silhouette" },
  { id: "long_length", label: "ロング丈", ja: "ロング丈の全体シルエット", en: "long-length silhouette" },
  { id: "short_length", label: "ショート丈", ja: "ショート丈の全体シルエット", en: "short-length silhouette" },
  { id: "asymmetric", label: "アシンメトリー", ja: "左右非対称のアシンメトリーシルエット", en: "asymmetric silhouette" },
  { id: "layered", label: "レイヤード", ja: "重ね着のレイヤードシルエット", en: "layered silhouette" },
  { id: "minimal", label: "ミニマル", ja: "装飾を排したミニマルなシルエット", en: "minimal silhouette" },
  { id: "ornate", label: "装飾多め", ja: "装飾性の高いシルエット", en: "ornate, highly decorated silhouette" },
];

export const OUTFIT_DECORATIONS: PresetItem[] = [
  { id: "minimal", label: "極少", ja: "装飾はほぼなし", en: "minimal decoration" },
  { id: "moderate", label: "ほどよく", ja: "ほどよく装飾", en: "moderately decorated" },
  { id: "ribbon", label: "リボン多め", ja: "リボンをふんだんに使った装飾", en: "ribbon-heavy decoration" },
  { id: "frill", label: "フリル", ja: "フリルをふんだんに使った装飾", en: "frill / ruffle decoration" },
  { id: "embroidery", label: "刺繍", ja: "刺繍で飾られた装飾", en: "embroidery decoration" },
  { id: "rhinestone", label: "ラインストーン", ja: "ラインストーン・スパンコールで輝く装飾", en: "rhinestone / sequin decoration" },
  { id: "chain_decor", label: "チェーン", ja: "チェーンを使った装飾", en: "chain decoration" },
  { id: "elaborate", label: "凝った装飾", ja: "凝った装飾を多用", en: "elaborate decoration" },
  { id: "maximal", label: "最大限", ja: "最大限の装飾、過剰なほど", en: "maximalist decoration" },
];

export const OUTFIT_SEASONS: PresetItem[] = [
  { id: "spring", label: "春", ja: "春らしい軽やかな素材", en: "spring, light fabrics" },
  { id: "rainy_season", label: "梅雨", ja: "梅雨らしい湿度感と落ち着いた色調", en: "rainy season, humid tones" },
  { id: "midsummer", label: "真夏", ja: "真夏の明るく軽やかな素材", en: "midsummer, bright light fabrics" },
  { id: "summer", label: "夏", ja: "夏向き、涼しげな素材", en: "summer, breathable fabrics" },
  { id: "autumn", label: "秋", ja: "秋らしい暖色とレイヤード", en: "autumn, warm tones, layered" },
  { id: "late_autumn", label: "晩秋", ja: "晩秋の深みのある色調と重めの素材", en: "late autumn, deep tones" },
  { id: "winter", label: "冬", ja: "冬向き、厚手でレイヤー多め", en: "winter, heavy fabrics, layers" },
  { id: "snowy_scene", label: "雪景色向け", ja: "雪景色に映える白・銀・冬素材", en: "snowy scene, white and silver tones" },
  { id: "seasonless", label: "季節感なし", ja: "季節を問わないニュートラル", en: "seasonless" },
];

export const OUTFIT_LUXURIES: PresetItem[] = [
  { id: "casual", label: "カジュアル", ja: "気取らないカジュアル感", en: "casual" },
  { id: "refined", label: "上品", ja: "上品で洗練された印象", en: "refined" },
  { id: "classical", label: "クラシカル", ja: "クラシカルで時代を超えた品格", en: "classical, timeless elegance" },
  { id: "luxe", label: "高級感", ja: "高級ブランドのような質感", en: "luxe / high-end" },
  { id: "future_luxe", label: "近未来高級", ja: "近未来的な素材感を持つ高級デザイン", en: "near-future luxury design" },
  { id: "couture", label: "オートクチュール", ja: "オートクチュール／クチュリエ作品級", en: "couture-tier craftsmanship" },
];

/* ---------------- BACKGROUND ---------------- */

export const BG_PLACES: PresetItem[] = [
  { id: "indoor", label: "室内", ja: "整然とした室内空間", en: "interior space" },
  { id: "alley", label: "路地", ja: "湿度感のある都市の路地裏", en: "urban back alley" },
  {
    id: "futuristic",
    label: "近未来空間",
    ja: "近未来的な構築空間（金属面と石材の交差）",
    en: "near-future constructed space",
  },
  {
    id: "abstract",
    label: "抽象空間",
    ja: "幾何のみで構成された抽象的アーキテクチャ空間",
    en: "abstract architectural space",
  },
  { id: "nature", label: "自然", ja: "微細な光が差し込む自然環境", en: "natural environment" },
  {
    id: "museum",
    label: "美術館",
    ja: "美術館のような展示空間（高い天井と均一照明）",
    en: "museum-like gallery space",
  },
  {
    id: "industrial",
    label: "工業施設",
    ja: "重厚な工業施設の構造体",
    en: "heavy industrial structure",
  },
  { id: "gallery", label: "ギャラリー", ja: "白壁のアートギャラリー空間", en: "white-wall art gallery" },
  { id: "atelier", label: "アトリエ", ja: "画家のアトリエ、キャンバスと絵の具", en: "artist's atelier with canvases and paint" },
  { id: "japanese_room", label: "和室", ja: "畳・障子・木の柱のある和室空間", en: "Japanese tatami room with shoji" },
  { id: "garden", label: "庭園", ja: "整えられた日本庭園あるいは洋風庭園", en: "well-kept garden" },
  { id: "seaside", label: "海辺", ja: "波音のある海辺の浜辺・岸壁", en: "seaside, beachfront or coastal rocks" },
  { id: "forest", label: "森", ja: "木漏れ日の差す静かな森の中", en: "quiet forest with dappled light" },
  { id: "empty_space", label: "無地空間", ja: "色だけのフラットな無地背景", en: "flat solid-color background" },
  { id: "studio", label: "スタジオ", ja: "撮影スタジオ、自然光またはソフトボックス", en: "photography studio with soft light" },
  { id: "paper_backdrop", label: "紙バック", ja: "和紙・ケント紙のような紙質感バック", en: "paper-textured backdrop" },
  { id: "fabric_backdrop", label: "布バック", ja: "シルク・リネンのような布地バックドロップ", en: "fabric backdrop (silk or linen)" },
  { id: "old_cinema", label: "古い映画館", ja: "レトロな古い映画館の赤いシート・スクリーン空間", en: "old cinema with red seats and screen" },
  { id: "greenhouse", label: "温室", ja: "ガラス張りの温室・植物が溢れる空間", en: "greenhouse with lush plants" },
  { id: "rooftop", label: "屋上", ja: "都市の屋上・スカイラインが見える空間", en: "urban rooftop with skyline" },
  { id: "library", label: "図書館", ja: "本が壁一面に並ぶ図書館の空間", en: "library with bookshelves" },
  { id: "rainy_station", label: "雨の駅前", ja: "雨に濡れた駅前・傘が行き交う空間", en: "rainy station front, wet pavement" },
  { id: "night_amusement", label: "夜の遊園地", ja: "夜の遊園地・カラフルなライトと観覧車", en: "night amusement park with colorful lights" },
  { id: "frosted_room", label: "曇りガラスの部屋", ja: "曇りガラス越しの柔らかい光が差し込む部屋", en: "room with frosted glass, soft diffused light" },
];

export const BG_COLORS: PresetItem[] = [
  {
    id: "inherit",
    label: "元背景色を継承",
    ja: "元背景色を抽出して再解釈",
    en: "reinterpret original background palette",
  },
  { id: "blue", label: "青系", ja: "ブルー基調", en: "blue-based palette" },
  { id: "green", label: "緑系", ja: "グリーン基調", en: "green-based palette" },
  { id: "red", label: "赤系", ja: "レッド基調", en: "red-based palette" },
  { id: "pink", label: "ピンク系", ja: "ピンク基調", en: "pink-based palette" },
  { id: "monochrome", label: "モノクロ", ja: "モノクローム", en: "monochrome" },
  { id: "white", label: "白", ja: "クリーンな白", en: "clean white" },
  { id: "black", label: "黒", ja: "深い黒", en: "deep black" },
  { id: "beige", label: "ベージュ", ja: "温かみのあるベージュ", en: "warm beige" },
  { id: "gold", label: "ゴールド", ja: "金のような暖かい色調", en: "gold tone" },
  { id: "light", label: "明るいトーン", ja: "高明度の明るい淡い色調", en: "high-key light tones" },
  { id: "low_sat", label: "低彩度", ja: "彩度を抑えたくすみカラー", en: "low saturation, muted" },
  { id: "high_sat", label: "高彩度", ja: "鮮やかで彩度の高い色調", en: "high saturation, vivid" },
  { id: "pastel", label: "パステル", ja: "淡くミルキーなパステルカラー", en: "pastel, milky tones" },
  { id: "vivid", label: "ビビッド", ja: "原色に近い強烈なビビッドカラー", en: "vivid, bold primary-like colors" },
  { id: "earth", label: "アースカラー", ja: "土・木・石を連想するアースカラー", en: "earth tones (brown, ochre, clay)" },
];

export const BG_DENSITIES: PresetItem[] = [
  {
    id: "minimal",
    label: "ミニマル",
    ja: "余白を多く取ったミニマル構成",
    en: "minimal layout with lots of negative space",
  },
  { id: "normal", label: "普通", ja: "適度な情報量", en: "moderate density" },
  {
    id: "dense",
    label: "情報量多め",
    ja: "情報量の多い緻密な構成（被写体は埋もれさせない）",
    en: "dense, information-rich layout (subject must remain readable)",
  },
];

export const BG_EFFECTS: PresetItem[] = [
  {
    id: "glitch",
    label: "グリッチ",
    ja: "グリッチ／走査線（背景レイヤーのみ）",
    en: "glitch and scanlines (env layer only)",
  },
  { id: "particles", label: "光の粒子", ja: "微細な光の粒子が漂う", en: "fine light particles" },
  { id: "fog", label: "霧", ja: "湿度のある霧", en: "humid fog" },
  { id: "reflection", label: "反射", ja: "反射する床面", en: "reflective floor" },
  {
    id: "geometric",
    label: "幾何学",
    ja: "幾何学的なパターン構造",
    en: "geometric structural pattern",
  },
  {
    id: "distortion",
    label: "空間歪み",
    ja: "背景側の物理歪み（被写体には及ばない）",
    en: "background-only spatial distortion",
  },
  { id: "watercolor_bleed", label: "水彩にじみ", ja: "水彩絵の具のにじみとぼかし", en: "watercolor bleed and bloom" },
  { id: "ink_bleed", label: "墨のにじみ", ja: "墨が和紙に広がるようなにじみ", en: "ink bleed on washi paper" },
  { id: "brushstroke", label: "筆跡", ja: "絵筆のストローク跡が見える質感", en: "visible brushstroke texture" },
  { id: "paper_texture", label: "紙の質感", ja: "和紙・ケント紙・粗い紙の質感", en: "paper grain texture (washi or kent)" },
  { id: "canvas_texture", label: "キャンバス質感", ja: "キャンバス布の繊維目が見える質感", en: "canvas weave texture" },
  { id: "collage", label: "コラージュ", ja: "紙や写真を貼り合わせたコラージュ感", en: "paper and photo collage feel" },
  { id: "negative_space", label: "余白強調", ja: "意図的な余白と空白のデザイン", en: "intentional negative space design" },
  { id: "abstract_lines", label: "抽象ライン", ja: "抽象的な線描とスクラッチ表現", en: "abstract line work and scratches" },
  { id: "color_planes", label: "色面構成", ja: "フラットな色面で構成された背景", en: "flat color plane composition" },
  { id: "modern_art_effect", label: "現代アート効果", ja: "現代美術的なテクスチャ・混色・マチエール", en: "contemporary art texture and matiere" },
  { id: "handdrawn",        label: "手描き感",      ja: "手描きのスケッチ・ペン画の質感",                     en: "hand-drawn sketch or pen drawing feel" },
  { id: "fabric_flow",     label: "布の流れ",      ja: "風になびく布・ドレープが背景に揺れる演出",           en: "flowing fabric drapes in background" },
  { id: "light_rays",      label: "光芒",          ja: "光芒・光の放射線が差し込む演出",                     en: "light rays shafts of light" },
  { id: "shadow_pattern",  label: "影模様",        ja: "格子・レースの影模様が落ちる演出",                   en: "shadow pattern from lattice or lace" },
  { id: "water_reflection",label: "水面反射",      ja: "水面の反射・揺らめく水鏡のような演出",              en: "water surface reflection shimmer" },
];

export const BG_TIMES: PresetItem[] = [
  { id: "morning", label: "朝", ja: "朝の柔らかい光", en: "morning soft light" },
  { id: "noon", label: "昼", ja: "真昼の明るい光", en: "noon bright light" },
  { id: "golden_hour", label: "ゴールデンアワー", ja: "夕方ゴールデンアワーの暖色光", en: "golden hour warm light" },
  { id: "dusk", label: "夕暮れ", ja: "夕暮れ／ブルーアワー", en: "dusk / blue hour" },
  { id: "night", label: "夜", ja: "夜、人工光が主体", en: "night, artificial light" },
  { id: "midnight", label: "深夜", ja: "深夜、低光量で静かな印象", en: "midnight, low light" },
  { id: "dawn",     label: "朝焼け", ja: "夜明けの朝焼け・オレンジと紫が混じる空", en: "dawn, sunrise sky" },
];

export const BG_WEATHERS: PresetItem[] = [
  { id: "clear", label: "晴れ", ja: "晴天", en: "clear sky" },
  { id: "cloudy", label: "曇り", ja: "曇り空", en: "cloudy" },
  { id: "rainy", label: "雨", ja: "雨、濡れた地面", en: "rainy, wet ground" },
  { id: "snowy", label: "雪", ja: "雪、白い大気", en: "snowy" },
  { id: "stormy", label: "嵐", ja: "嵐、強風と稲光", en: "stormy" },
  { id: "foggy", label: "霧", ja: "深い霧に包まれた空気", en: "heavy fog" },
];

export const BG_DEPTHS: PresetItem[] = [
  { id: "shallow", label: "浅い", ja: "被写界深度が浅い（背景強くボケる）", en: "shallow DoF" },
  { id: "moderate", label: "普通", ja: "標準的な被写界深度", en: "moderate DoF" },
  { id: "deep", label: "深い", ja: "被写界深度が深く奥まで見える", en: "deep DoF" },
  { id: "extreme", label: "極端", ja: "ティルトシフトのような極端なボケ", en: "extreme miniature-like DoF" },
];

export const BG_INFOS: PresetItem[] = [
  { id: "sparse", label: "情報少なめ", ja: "要素が少なく余白多め", en: "sparse, lots of negative space" },
  { id: "balanced", label: "バランス", ja: "適度な情報量", en: "balanced information" },
  { id: "rich", label: "情報多め", ja: "ディテール豊富で情報多め", en: "rich, detailed" },
  { id: "maximalist", label: "最大限", ja: "ぎっしり詰まったマキシマリスト", en: "maximalist, packed" },
];

export const BG_STYLES: PresetItem[] = [
  { id: "photorealistic", label: "フォトリアル", ja: "写真のようなリアルな質感", en: "photorealistic" },
  { id: "watercolor", label: "水彩画", ja: "水彩絵の具のにじみと透明感", en: "watercolor painting" },
  { id: "ink_wash", label: "水墨画", ja: "墨と余白で構成された水墨画風", en: "ink wash painting (sumi-e)" },
  { id: "oil_painting", label: "油彩画", ja: "厚みのある油彩絵の具の質感", en: "oil painting" },
  { id: "acrylic", label: "アクリル画", ja: "鮮やかなアクリル絵の具の質感", en: "acrylic painting" },
  { id: "modern_art", label: "現代アート", ja: "現代美術的な抽象表現とマチエール", en: "modern/contemporary art" },
  { id: "contemporary_art", label: "近代アート", ja: "印象派・フォーヴィスム等の近代絵画風", en: "contemporary fine art style" },
  { id: "abstract_art", label: "抽象アート", ja: "形や色のみで構成された抽象表現", en: "abstract expressionism" },
  { id: "cubism", label: "キュービズム", ja: "キュービズム的な多視点分割構成", en: "cubism" },
  { id: "collage", label: "コラージュ", ja: "写真や紙片を組み合わせたコラージュ", en: "collage / mixed media" },
  { id: "poster", label: "ポスター", ja: "グラフィックポスターのようなフラットデザイン", en: "graphic poster style" },
  { id: "minimal", label: "ミニマル", ja: "余白と最小限の要素で構成", en: "minimalist" },
  { id: "simple", label: "シンプル", ja: "単純でクリーンな背景", en: "simple and clean" },
  { id: "washi", label: "和紙", ja: "和紙の繊維目と温かみのある質感", en: "washi paper texture" },
  { id: "canvas", label: "キャンバス", ja: "キャンバス布目と重ねた絵の具の質感", en: "canvas texture with paint layers" },
  { id: "gradient", label: "グラデーション", ja: "滑らかなグラデーション背景", en: "smooth gradient" },
  { id: "monochrome", label: "モノクロ", ja: "白黒・グレースケールのみ", en: "monochrome / grayscale" },
  { id: "pastel", label: "パステル", ja: "淡くやさしいパステルトーン", en: "pastel tone" },
  { id: "cyber", label: "サイバー", ja: "ネオン発光・デジタルグリッド・サイバーパンク", en: "cyber / neon / digital grid" },
  { id: "digital", label: "デジタル", ja: "デジタルアート・ピクセル・データ表現", en: "digital art / pixel / data visualization" },
];

/* ---------------- 文字背景 / 書 ---------------- */

export const BG_TEXT_TYPES: PresetItem[] = [
  { id: "kanji",             label: "漢字",                 ja: "大きな漢字が背景に静かに配置される",                         en: "large kanji characters as background elements" },
  { id: "calligraphy",       label: "書道",                 ja: "筆で書かれた書道文字が背景を飾る",                           en: "calligraphy brushwork as background decoration" },
  { id: "old_document",      label: "古文書",               ja: "古い文書・古典籍のような文字の集積",                         en: "aged document or manuscript texture" },
  { id: "washi_text",        label: "和紙",                 ja: "和紙の質感に滲んだ文字が重なる",                             en: "washi paper with bleeding ink text" },
  { id: "scroll",            label: "巻物",                 ja: "巻物・掛け軸のような縦長の文字配置",                         en: "scroll or hanging-scroll style text arrangement" },
  { id: "ink_text",          label: "墨文字",               ja: "濃い墨で書かれた力強い文字",                                 en: "bold sumi-ink characters" },
  { id: "sanskrit",          label: "梵字",                 ja: "仏教的な梵字が静かに配置される",                             en: "Sanskrit / Buddhist Siddham characters" },
  { id: "talisman",          label: "呪符",                 ja: "道教・陰陽道的な呪符・符術の文字",                           en: "talisman or occult inscription characters" },
  { id: "runes",             label: "ルーン文字",            ja: "古代北欧のルーン文字が刻まれた背景",                         en: "ancient runic inscriptions" },
  { id: "latin_typography",  label: "英字タイポグラフィ",    ja: "欧文タイポグラフィがデザイン的に配置される",                 en: "Latin / Western typographic elements" },
  { id: "equations",         label: "数式",                 ja: "数学的な数式・記号が浮かぶ背景",                             en: "mathematical equations and symbols" },
  { id: "code_text",         label: "コード文字",            ja: "プログラムコードのような文字列が流れる",                      en: "code / matrix-style scrolling text" },
  { id: "handwritten",       label: "手書き文字",            ja: "手書きのメモやノートのような文字",                           en: "handwritten notes or letter texture" },
  { id: "newspaper",         label: "新聞紙風",              ja: "新聞紙のような密集した文字の質感",                           en: "newspaper-like dense text texture" },
  { id: "poster_text",       label: "ポスター文字",          ja: "グラフィックポスター的な大型文字",                           en: "large poster-style graphic lettering" },
];

export const BG_TEXT_MOODS: PresetItem[] = [
  { id: "japanese",          label: "和風",                 ja: "静謐で凛とした和の雰囲気",                                  en: "quiet, refined Japanese aesthetic" },
  { id: "mystical",          label: "神秘的",               ja: "神秘的・呪術的な雰囲気",                                    en: "mystical, occult atmosphere" },
  { id: "decadent",          label: "退廃的",               ja: "退廃的・頽廃美のある雰囲気",                                 en: "decadent, dark beauty atmosphere" },
  { id: "contemporary_art",  label: "現代アート",            ja: "現代アート・コンセプチュアルな雰囲気",                       en: "contemporary / conceptual art atmosphere" },
  { id: "ancient",           label: "古代文字",              ja: "古代文明・遺跡のような神話的雰囲気",                         en: "ancient civilization, mythological atmosphere" },
  { id: "cyber_text",        label: "サイバー文字",          ja: "サイバーパンク・デジタルデータの雰囲気",                     en: "cyberpunk / digital data atmosphere" },
  { id: "movie_poster",      label: "映画ポスター風",        ja: "映画ポスターのような劇的な演出",                             en: "dramatic movie poster style" },
  { id: "magazine_design",   label: "雑誌デザイン風",        ja: "ファッション誌のようなエディトリアル感",                      en: "editorial / fashion magazine design" },
];

export const BG_TEXT_LAYOUTS: PresetItem[] = [
  { id: "full_bg",           label: "背景全面",              ja: "背景全体を文字で覆うように配置",                             en: "text filling the entire background" },
  { id: "wall_surface",      label: "壁面",                 ja: "壁・平面に刻まれた・書かれた文字",                           en: "text written or carved on a wall surface" },
  { id: "floating",          label: "空中に浮遊",            ja: "文字が空中に漂うように浮かんでいる",                         en: "characters floating in mid-air" },
  { id: "vertical_writing",  label: "縦書き",               ja: "縦書きで配置された文字列",                                  en: "vertically written text columns" },
  { id: "horizontal_writing",label: "横書き",               ja: "横書きで配置された文字列",                                  en: "horizontally written text rows" },
  { id: "diagonal",          label: "斜め配置",              ja: "斜めに流れるように配置された文字",                           en: "text arranged diagonally" },
  { id: "circular",          label: "円形配置",              ja: "円・螺旋状に並べられた文字",                                 en: "text arranged in circular or spiral pattern" },
  { id: "behind_subject",    label: "人物の後ろ",            ja: "人物のすぐ背後に集中して配置",                               en: "text concentrated directly behind the subject" },
  { id: "screen_edge",       label: "画面端",               ja: "画面の端・枠に沿って配置",                                  en: "text along the edges or frame of the image" },
  { id: "blurred",           label: "ぼかし気味",            ja: "焦点を外したようにぼかして配置（主張しすぎない）",            en: "text placed out of focus, blurred, non-intrusive" },
];

export const BG_TEXT_TEXTURES: PresetItem[] = [
  { id: "ink",               label: "墨",                   ja: "毛筆・墨で書いたような濃淡のある質感",                       en: "sumi ink texture with natural tone variations" },
  { id: "gold_leaf",         label: "金箔",                 ja: "金箔・金泥で書かれた輝く文字",                               en: "gold leaf or gilt ink lettering" },
  { id: "carved",            label: "彫刻",                 ja: "石・木・金属に彫り込まれた文字",                             en: "carved or engraved text on stone, wood, or metal" },
  { id: "glowing",           label: "発光",                 ja: "内側から光るような発光する文字",                             en: "glowing, luminous text characters" },
  { id: "translucent",       label: "半透明",               ja: "半透明・透けるような繊細な文字",                             en: "translucent, semi-transparent text" },
  { id: "printed_paper",     label: "紙に印刷",              ja: "紙・和紙に印刷・スタンプされた文字",                         en: "text printed or stamped on paper" },
  { id: "painted_wall",      label: "壁に描かれた文字",      ja: "壁面に直接描かれた・描き殴られた文字",                       en: "text painted or scrawled directly on a wall" },
  { id: "glass_reflection",  label: "ガラスに反射した文字",  ja: "ガラス面に映り込む・書かれた文字",                           en: "text reflected or written on glass surface" },
];

/* ---------------- 大物 / 大道具 ---------------- */

export const BIG_OBJECT_GENRES: PresetItem[] = [
  { id: "clean",           label: "綺麗系",         ja: "高級感のある美しい大型オブジェ・クリアで洗練されたアート系",        en: "clean, elegant large art object or display piece" },
  { id: "luxury_display",  label: "高級展示系",     ja: "ギャラリー・高級店の大型展示オブジェ・ショーケース",               en: "luxury gallery display object or showcase" },
  { id: "art",             label: "アート系",       ja: "現代美術・抽象アートの大型インスタレーション",                    en: "contemporary art installation or abstract sculpture" },
  { id: "foreign",         label: "異物系",         ja: "なぜそこにあるのか不明な異質な大型オブジェ",                      en: "out-of-place large foreign object with uncanny presence" },
  { id: "broken",          label: "壊れ系",         ja: "破損・割れ・欠損した大型オブジェ・退廃的演出",                    en: "broken, cracked, or damaged large prop with decadent mood" },
  { id: "ruins",           label: "廃墟系",         ja: "廃墟・朽ちた巨大建築パーツ・さびれた展示物",                     en: "ruins-style large decayed architectural element" },
  { id: "creepy_cute",     label: "不気味かわいい", ja: "壊れたぬいぐるみ・片目の人形など不気味かわいい大型オブジェ",       en: "creepy-cute large stuffed toy or doll with unsettling charm" },
  { id: "retro_foreign",   label: "レトロ異物",     ja: "時代錯誤な巨大レトロ機器・古びたブラウン管・廃棄された遊具",      en: "anachronistic large retro machine or abandoned vintage device" },
  { id: "movie_prop",      label: "映画大道具",     ja: "映画セット・舞台装置のような劇的な大型道具",                      en: "cinematic large stage prop or movie set piece" },
  { id: "surreal",         label: "超現実",         ja: "日常空間に似合わない超現実的な巨大オブジェ・シュール演出",        en: "surreal large object that defies context" },
  { id: "lab",             label: "実験施設",       ja: "壊れた培養槽・巨大研究装置・実験施設の異物感",                   en: "lab equipment wreckage or oversized scientific device" },
  { id: "mystic_display",  label: "神秘展示",       ja: "神秘的な展示物・光る聖遺物・儀式的な大型オブジェ",               en: "mystical display or glowing ceremonial large object" },
];

export const BIG_OBJECT_TYPES: PresetItem[] = [
  { id: "stuffed",        label: "ぬいぐるみ系",   ja: "巨大ぬいぐるみ・人形・布製の大型オブジェ",    en: "oversized stuffed toy, plush figure, or doll" },
  { id: "display",        label: "展示物系",       ja: "展示台・ショーケース・高級陳列オブジェ",      en: "display stand, showcase, or exhibition piece" },
  { id: "sculpture",      label: "彫刻系",         ja: "石膏像・彫刻・抽象オブジェ",                 en: "sculpture, stone figure, or abstract art object" },
  { id: "lab_equipment",  label: "実験装置系",     ja: "培養槽・研究装置・実験器具",                 en: "cultivation tank, research apparatus, or lab equipment" },
  { id: "glass",          label: "ガラス系",       ja: "ガラス彫刻・ガラスケース・透明構造物",        en: "glass sculpture, glass case, or transparent structure" },
  { id: "architecture",   label: "建築物系",       ja: "建築パーツ・柱・扉・巨大フレーム",           en: "architectural element — column, door frame, or large structure" },
  { id: "retro_machine",  label: "レトロ機械系",   ja: "ブラウン管・古い機械・アーカイブ装置",        en: "CRT monitor, vintage machine, or archival device" },
  { id: "stage_prop",     label: "舞台装置系",     ja: "劇場の大道具・舞台装置・映画セット",         en: "theatrical large prop or movie set piece" },
  { id: "mystic_object",  label: "神秘オブジェ系", ja: "神秘的な光る石・儀式オブジェ・聖遺物",       en: "glowing mystical stone, ritual object, or relic" },
  { id: "foreign_object", label: "異物系",         ja: "文脈にそぐわない巨大異物・謎のオブジェ",     en: "out-of-context large object with uncanny presence" },
];

export const BIG_OBJECT_CONDITIONS: PresetItem[] = [
  { id: "brand_new",  label: "新品",           ja: "新品・未使用感",           en: "brand new, pristine" },
  { id: "clean",      label: "綺麗",           ja: "清潔で綺麗な状態",         en: "clean and well-maintained" },
  { id: "luxury",     label: "高級",           ja: "高級感のある仕上がり",     en: "luxurious finish and quality" },
  { id: "aged",       label: "古い",           ja: "年月を経た古い状態",       en: "aged, well-worn with time" },
  { id: "dirty",      label: "汚れ",           ja: "汚れ・埃・くすみ",         en: "dirty, dusty, or grimy" },
  { id: "torn",       label: "破れ",           ja: "破れ・綻び・裂け目",       en: "torn, frayed, or split" },
  { id: "broken",     label: "壊れ",           ja: "壊れた・変形した状態",     en: "broken or deformed" },
  { id: "rusted",     label: "錆び",           ja: "錆が浮いた・腐食した状態", en: "rusted or corroded" },
  { id: "cracked",    label: "ひび割れ",       ja: "ひび割れ・割れ目が入った", en: "cracked or shattered" },
  { id: "wet",        label: "水濡れ",         ja: "雨・水に濡れた状態",       en: "wet or water-soaked" },
  { id: "sandy",      label: "砂まみれ",       ja: "砂・土埃まみれの状態",     en: "covered in sand or dust" },
  { id: "faded",      label: "色あせ",         ja: "色褪せ・退色した状態",     en: "faded or discolored" },
  { id: "warped",     label: "歪み",           ja: "歪み・反り・変形",         en: "warped or bent out of shape" },
  { id: "damaged",    label: "欠損",           ja: "欠損・一部が欠けた状態",   en: "partially missing or chipped" },
  { id: "collapsing", label: "崩壊しかけ",     ja: "崩れかけ・今にも崩れそう", en: "on the verge of collapse" },
];

export const BIG_OBJECT_PLACEMENTS: PresetItem[] = [
  { id: "beside",         label: "横に置く",       ja: "人物の横に静かに置かれている",                    en: "placed quietly beside the subject" },
  { id: "holding",        label: "抱える",         ja: "人物が抱えている・寄り添っている",                en: "subject is holding or cradling it" },
  { id: "leaning",        label: "寄りかかる",     ja: "人物がもたれかかっている",                        en: "subject is leaning against it" },
  { id: "sitting",        label: "座る",           ja: "人物が上に座っている",                            en: "subject is sitting on it" },
  { id: "behind",         label: "背後",           ja: "人物の背後にそびえる",                            en: "looming behind the subject" },
  { id: "foreground",     label: "画面手前",       ja: "画面手前にぼかして配置",                          en: "placed blurred in the foreground" },
  { id: "surrounding",    label: "周囲配置",       ja: "周囲に複数配置",                                  en: "multiple pieces arranged around subject" },
  { id: "at_feet",        label: "足元",           ja: "人物の足元に置かれている",                        en: "placed at the subject's feet" },
  { id: "floating_above", label: "上部浮遊",       ja: "空中に浮遊している",                              en: "floating in the air above" },
  { id: "bg_center",      label: "背景中央",       ja: "背景の中央に鎮座している",                        en: "sitting prominently at background center" },
  { id: "asymmetric",     label: "左右非対称",     ja: "左右非対称に画面の片側を占める",                  en: "asymmetrically occupying one side of the frame" },
  { id: "deep_bg",        label: "奥に巨大配置",   ja: "遠景に巨大な影として配置",                        en: "placed deep in background as a massive silhouette" },
];

export const BIG_OBJECT_SIZES: PresetItem[] = [
  { id: "medium",          label: "中",                 ja: "人物より少し小さい程度",     en: "slightly smaller than the subject" },
  { id: "large",           label: "大きめ",             ja: "人物と同程度かやや大きい",   en: "about the same size or slightly larger" },
  { id: "same_as_person",  label: "人物と同サイズ",     ja: "人物とほぼ同じ大きさ",       en: "same size as the subject" },
  { id: "bigger",          label: "人物より大きい",     ja: "明らかに人物より大きい",     en: "clearly larger than the subject" },
  { id: "huge",            label: "超巨大",             ja: "圧倒的に巨大な存在感",       en: "overwhelmingly huge" },
  { id: "screen_filling",  label: "画面支配級",         ja: "画面全体を支配するほどの大きさ", en: "so large it dominates the entire frame" },
];

export const BIG_OBJECT_MOODS: PresetItem[] = [
  { id: "cute",             label: "かわいい",       ja: "かわいらしい・メルヘンな雰囲気",             en: "cute and whimsical" },
  { id: "luxury",           label: "高級",           ja: "ラグジュアリー・高級感のある雰囲気",         en: "luxurious and high-end" },
  { id: "fantasy",          label: "幻想",           ja: "幻想的・非現実的な神秘の雰囲気",             en: "fantastical and otherworldly" },
  { id: "eerie",            label: "不気味",         ja: "不気味・ホラー的な雰囲気",                   en: "eerie and unsettling" },
  { id: "decadent",         label: "退廃",           ja: "退廃的・朽ちる美・古びた哀愁",               en: "decadent, faded beauty with melancholy" },
  { id: "cinematic",        label: "映画風",         ja: "映画・ドラマのワンシーンのような演出",        en: "cinematic, like a movie scene" },
  { id: "ad_visual",        label: "広告風",         ja: "商業広告・ブランドキャンペーン的な演出",     en: "commercial ad or brand campaign visual" },
  { id: "contemporary_art", label: "現代美術",       ja: "現代アート・インスタレーション的な表現",     en: "contemporary art installation aesthetic" },
  { id: "lab",              label: "実験施設",       ja: "研究施設・科学実験・近未来的異物感",         en: "science lab or experimental facility vibe" },
  { id: "dreamy",           label: "夢っぽい",       ja: "夢の中のような曖昧で柔らかい雰囲気",         en: "dreamlike, soft, and ambiguous" },
  { id: "otherworld",       label: "異世界",         ja: "異世界・別次元からの異物感",                 en: "otherworldly, as if from another dimension" },
  { id: "surreal",          label: "シュール",       ja: "脈絡のないシュールな存在感",                 en: "surreal, absurdist, and out of context" },
  { id: "dramatic",         label: "ドラマチック",   ja: "ドラマチックで物語性のある演出",             en: "dramatic and narrative-driven staging" },
];

/* ---------------- POSE ---------------- */

export const POSE_TYPES: PresetItem[] = [
  { id: "stand", label: "立ち", ja: "立ちポーズ", en: "standing" },
  { id: "sit", label: "座り", ja: "座りポーズ", en: "seated" },
  { id: "crouch", label: "しゃがみ込み", ja: "しゃがみ込んだ姿勢", en: "crouching, squatting" },
  { id: "lean_wall", label: "壁にもたれる", ja: "壁にもたれかかるポーズ", en: "leaning against wall" },
  { id: "turn", label: "振り向き", ja: "斜め後ろを向き顔だけ振り返るポーズ", en: "turning, looking back over shoulder" },
  { id: "hand_up", label: "片手を上げる", ja: "片手を上方に向けて上げるポーズ", en: "one arm raised upward" },
  { id: "walk", label: "歩き出し", ja: "歩み出す瞬間", en: "stepping forward, walking" },
  { id: "float", label: "浮遊", ja: "浮遊感のあるポーズ", en: "floating" },
  { id: "action", label: "アクション", ja: "アクション性のあるポーズ", en: "action pose" },
];

export const POSE_IMPRESSIONS: PresetItem[] = [
  { id: "cool", label: "クール", ja: "クールな印象", en: "cool" },
  { id: "cute", label: "かわいい", ja: "かわいい印象", en: "cute" },
  { id: "strong", label: "強め", ja: "強さを感じさせる印象", en: "powerful" },
  { id: "provocative", label: "挑発的", ja: "挑発的・挑みかかるような印象", en: "provocative, challenging" },
  { id: "calm", label: "静か", ja: "静かで落ち着いた印象", en: "calm" },
  { id: "composed", label: "余裕", ja: "余裕のある落ち着いた印象", en: "composed, self-assured" },
  { id: "fragile", label: "儚い", ja: "儚く消えそうな印象", en: "fragile, ephemeral" },
  { id: "tense", label: "緊張感", ja: "緊張感のある張り詰めた印象", en: "tense, on-edge" },
  { id: "mysterious", label: "神秘的", ja: "神秘的な雰囲気の印象", en: "mysterious" },
  { id: "dynamic", label: "ダイナミック", ja: "ダイナミックで動的", en: "dynamic" },
  { id: "sns", label: "SNS映え", ja: "SNS映えする構図性", en: "SNS-friendly, photogenic" },
];

export const POSE_HANDS: PresetItem[] = [
  { id: "near_face", label: "顔の近く", ja: "片手を顔の近くに自然に添える", en: "one hand near the face" },
  { id: "touch_hair", label: "髪に触れる", ja: "片手で髪を触れるように添える", en: "hand touching hair" },
  { id: "touch_cheek", label: "頬に触れる", ja: "片手を頬に添える", en: "hand on cheek" },
  { id: "chest_hand", label: "胸元に手", ja: "片手を胸元に当てる", en: "hand at chest" },
  { id: "hip", label: "腰に手", ja: "片手を腰に置く", en: "hand on hip" },
  { id: "cross_arms", label: "腕を組む", ja: "両腕を組んだポーズ", en: "arms crossed" },
  { id: "pocket", label: "ポケットに手", ja: "片手をポケットに入れる", en: "hand in pocket" },
  { id: "extend", label: "片手を伸ばす", ja: "片手を空間に向けて伸ばす", en: "one arm extended" },
  { id: "natural", label: "両手を自然に", ja: "両手を自然に下ろし指先の力を抜く", en: "both hands relaxed at sides" },
  { id: "prop", label: "小物を持つ", ja: "片手で小物を自然に持つ", en: "one hand holding a prop" },
];

export const POSE_FEET: PresetItem[] = [
  { id: "natural", label: "自然な重心", ja: "自然な足元配置", en: "natural footing" },
  { id: "one_foot_forward", label: "片足前", ja: "片足を前に出した姿勢", en: "one foot forward" },
  { id: "tiptoe", label: "つま先立ち", ja: "つま先立ちのポーズ", en: "tiptoe stance" },
  { id: "cross", label: "足を交差", ja: "脚を軽くクロスさせる", en: "legs crossed" },
  { id: "knee", label: "片膝立ち", ja: "片膝を立てた姿勢", en: "one knee up" },
  { id: "walking", label: "歩行中", ja: "歩行中の足元", en: "mid-stride" },
  { id: "float", label: "浮遊感", ja: "床から離れた浮遊感のある足元", en: "feet slightly lifted, floating" },
];

export const POSE_BALANCES: PresetItem[] = [
  { id: "centered", label: "中心", ja: "重心を中央に置いた安定姿勢", en: "centered balance" },
  { id: "one_leg_weight", label: "片足重心", ja: "片足に重心をかけた姿勢", en: "weight on one leg" },
  { id: "low", label: "重心低め", ja: "重心を低く落とした姿勢", en: "low centered weight" },
  { id: "high", label: "重心高め", ja: "重心を高めに引き上げた姿勢", en: "high centered weight" },
  { id: "leaning_forward", label: "前のめり", ja: "前傾姿勢", en: "leaning forward" },
  { id: "arched", label: "反り気味", ja: "背中を反らせた姿勢", en: "slightly arched back" },
  { id: "leaning_back", label: "後傾", ja: "後傾姿勢", en: "leaning back" },
  { id: "relaxed", label: "リラックス", ja: "リラックスした自然な重心", en: "relaxed natural posture" },
  { id: "off_center", label: "片寄せ", ja: "重心を意図的に片側へ寄せる", en: "intentionally off-center" },
];

export const POSE_MOTIONS: PresetItem[] = [
  { id: "still", label: "完全静止", ja: "完全静止のスタティック", en: "completely still" },
  { id: "subtle", label: "微かな動き", ja: "わずかな動きの予感", en: "subtle motion" },
  { id: "hair_flow", label: "髪がなびく", ja: "髪が風になびいている瞬間", en: "hair flowing in wind" },
  { id: "cloth_flow", label: "布が舞う", ja: "衣装の布が風になびく瞬間", en: "clothing / fabric billowing" },
  { id: "mid_turn", label: "振り向き途中", ja: "振り向きの途中の瞬間", en: "mid-turn, caught turning" },
  { id: "dynamic", label: "動きあり", ja: "ダイナミックな動き", en: "dynamic motion" },
  { id: "mid_action", label: "歩行途中", ja: "アクション・歩行の途中の瞬間", en: "mid-action / mid-stride freeze" },
  { id: "explosive", label: "爆発的", ja: "爆発的・瞬間的な動き", en: "explosive motion" },
];

export const POSE_GAZES: PresetItem[] = [
  { id: "to_camera", label: "カメラ目線", ja: "カメラ目線", en: "to camera" },
  { id: "distant", label: "遠くを見る", ja: "遠くを見つめる視線", en: "gazing into the distance" },
  { id: "away", label: "視線を外す", ja: "カメラから視線を外す", en: "looking away" },
  { id: "downcast", label: "伏し目", ja: "伏し目がち", en: "downcast" },
  { id: "diagonal_look", label: "斜め目線", ja: "斜め方向を見る視線", en: "diagonal gaze" },
  { id: "look_down", label: "見下ろし", ja: "やや見下ろすような目線", en: "looking down at viewer" },
  { id: "upward", label: "見上げ", ja: "上を見上げる視線", en: "looking up" },
  { id: "side_glance", label: "横目", ja: "横目で見る", en: "side glance" },
  { id: "over_shoulder", label: "肩越し", ja: "肩越しに振り返る視線", en: "looking over shoulder" },
];

export const POSE_ORIENTATIONS: PresetItem[] = [
  { id: "front", label: "正面", ja: "体を正面に向ける", en: "facing front" },
  { id: "three_quarter", label: "斜め45度", ja: "斜め45度に体を向ける", en: "three-quarter view" },
  { id: "side", label: "真横", ja: "体を真横に向ける", en: "side profile" },
  { id: "back", label: "後ろ向き", ja: "体を後ろに向ける", en: "back to camera" },
  { id: "diagonal", label: "ねじり", ja: "体に捻りを入れる", en: "diagonal twist" },
];

/* ---------------- CAMERA ---------------- */

export const CAMERA_ANGLES: PresetItem[] = [
  { id: "front", label: "正面", ja: "正面構図", en: "front view" },
  { id: "diagonal_45", label: "斜め45度", ja: "斜め45度の構図", en: "45-degree diagonal view" },
  { id: "low", label: "ローアングル", ja: "ローアングル（煽り）", en: "low angle (upward shot)" },
  { id: "high", label: "ハイアングル", ja: "ハイアングル", en: "high angle" },
  { id: "top_down", label: "俯瞰", ja: "真上から見下ろす俯瞰", en: "top-down birds-eye" },
  { id: "diagonal_high", label: "斜め俯瞰", ja: "斜め上から見下ろす構図", en: "diagonal high-angle" },
  { id: "back_view", label: "背面寄り", ja: "被写体の背面・後ろ側からの構図", en: "back-facing composition" },
  { id: "side_profile", label: "横顔寄り", ja: "横顔寄りの構図", en: "side profile" },
  { id: "over_shoulder", label: "肩越し", ja: "肩越しの構図", en: "over the shoulder" },
  { id: "close_portrait", label: "近距離ポートレート", ja: "近距離ポートレート", en: "close portrait" },
  { id: "full_body", label: "全身構図", ja: "全身が収まる構図", en: "full body composition" },
  { id: "dutch", label: "ダッチアングル", ja: "ダッチアングル（傾けた構図）", en: "Dutch angle" },
  { id: "cinematic", label: "シネマティック構図", ja: "シネマティックな構図", en: "cinematic framing" },
];

export const CAMERA_DISTANCES: PresetItem[] = [
  { id: "macro", label: "超接写", ja: "マクロ距離（極端に近い）", en: "macro / extreme close-up" },
  { id: "bust_up", label: "バストアップ", ja: "バストアップ（胸から上が収まる距離）", en: "bust-up shot" },
  { id: "knee_up", label: "膝上", ja: "膝上までが収まる距離", en: "knee-up shot" },
  { id: "close", label: "近距離", ja: "近距離", en: "close distance" },
  { id: "medium", label: "中距離", ja: "中距離", en: "medium distance" },
  { id: "far", label: "遠距離", ja: "遠距離", en: "far distance" },
  { id: "extreme_far", label: "超遠距離", ja: "超遠距離（人物が小さい）", en: "extreme far" },
];

export const CAMERA_LENSES: PresetItem[] = [
  { id: "wide", label: "広角", ja: "広角レンズ感、軽い歪み", en: "wide-angle lens feel" },
  { id: "wide_distort", label: "広角歪み", ja: "広角レンズの強い歪みを強調した表現", en: "wide-angle with prominent distortion" },
  { id: "normal", label: "標準", ja: "標準レンズ感", en: "normal lens feel" },
  { id: "portrait", label: "ポートレート", ja: "85mm相当のポートレート感", en: "portrait lens (85mm-like)" },
  { id: "tele", label: "望遠/圧縮効果", ja: "望遠レンズ感、強い圧縮効果", en: "telephoto compression effect" },
  { id: "cinema", label: "シネマレンズ", ja: "映画用シネマレンズ特有の柔らかいボケと色再現", en: "cinema lens, soft bokeh" },
  { id: "smartphone", label: "スマホ撮影風", ja: "スマートフォンのカメラで撮影したような自然な感じ", en: "smartphone camera feel" },
  { id: "fisheye", label: "魚眼", ja: "魚眼レンズの強い湾曲", en: "fisheye distortion" },
];

export const CAMERA_COMPOSITIONS: PresetItem[] = [
  { id: "rule_of_thirds", label: "三分割", ja: "三分割構図", en: "rule of thirds" },
  { id: "centered", label: "中央配置", ja: "中央配置（被写体を中心に置く）", en: "centered" },
  { id: "diagonal", label: "対角線", ja: "対角線構図", en: "diagonal composition" },
  { id: "symmetric", label: "シンメトリー", ja: "対称構図", en: "symmetric" },
  { id: "leading_lines", label: "誘導線", ja: "誘導線を活かした構図", en: "leading lines" },
  { id: "negative_space", label: "余白活用", ja: "ネガティブスペースを活かす", en: "negative space" },
  { id: "generous_space", label: "余白多め", ja: "余白を意識的に多く取った構図", en: "generous negative space" },
  { id: "asymmetric", label: "左右非対称", ja: "左右非対称で動きのある構図", en: "asymmetric composition" },
  { id: "subject_large", label: "被写体大きめ", ja: "被写体を大きく画面に収める構図", en: "subject fills the frame" },
  { id: "magazine", label: "雑誌表紙風", ja: "雑誌の表紙のような洗練されたレイアウト", en: "magazine cover style layout" },
];

export const CAMERA_FOVS: PresetItem[] = [
  { id: "narrow", label: "狭い", ja: "狭い画角", en: "narrow FOV" },
  { id: "standard", label: "標準", ja: "標準的な画角", en: "standard FOV" },
  { id: "wide", label: "広い", ja: "広い画角", en: "wide FOV" },
  { id: "ultra_wide", label: "超広角", ja: "超広角", en: "ultra-wide FOV" },
  { id: "vertical_sns", label: "縦長SNS向け", ja: "縦長（9:16）のSNS向け構図", en: "vertical SNS-friendly framing" },
  { id: "horizontal_cinema", label: "横長シネマ", ja: "横長シネマスコープ風の構図", en: "horizontal cinematic widescreen framing" },
  { id: "square", label: "スクエア構図", ja: "スクエア（正方形）構図", en: "square composition" },
];

export const CAMERA_EYE_HEIGHTS: PresetItem[] = [
  { id: "ground", label: "地面すれすれ", ja: "地面すれすれの極低い視点", en: "ground-skimming eye height" },
  { id: "low", label: "低い視点", ja: "地面付近の低い視点", en: "ground-level eye height" },
  { id: "waist", label: "腰の高さ", ja: "腰の高さの視点", en: "waist height" },
  { id: "chest_height", label: "胸の高さ", ja: "胸の高さの視点", en: "chest-height eye level" },
  { id: "eye_level", label: "目線", ja: "被写体の目線", en: "subject's eye level" },
  { id: "slightly_above", label: "目線より少し上", ja: "目線より少し高い位置の視点", en: "slightly above eye level" },
  { id: "above_head", label: "頭上", ja: "頭上の高さ", en: "above the head" },
  { id: "ceiling", label: "天井", ja: "天井近くの高い視点", en: "ceiling height" },
];

/* ---------------- PROPS（持ち物・小物） ---------------- */

export const PROPS_CATEGORIES: PresetItem[] = [
  {
    id: "weapon",
    label: "武器系",
    ja: "武器系（刀・短刀・斧・槍・弓・巨大ハンマーなど）",
    en: "weapon (katana, dagger, axe, spear, bow, giant hammer, etc.)",
  },
  {
    id: "cute",
    label: "かわいい系",
    ja: "かわいい系（ぬいぐるみ・ハート型クッション・花束・キャンディ・風船など）",
    en: "cute (plushie, heart cushion, bouquet, candy, balloon, etc.)",
  },
  {
    id: "sns",
    label: "SNS映え系",
    ja: "SNS映え系（ネオンサイン・発光スマホ・透明傘・巨大リボン・カラフルなペンキ缶など）",
    en: "SNS-friendly (neon sign, glowing phone, transparent umbrella, giant ribbon, paint can, etc.)",
  },
  {
    id: "futuristic",
    label: "近未来系",
    ja: "近未来系（ホログラム端末・発光キューブ・サイバーゴーグル・透明タブレットなど）",
    en: "futuristic (hologram device, glowing cube, cyber goggles, transparent tablet, etc.)",
  },
  {
    id: "japanese",
    label: "和風系",
    ja: "和風系（扇子・和傘・御札・提灯・狐面など）",
    en: "Japanese (folding fan, wagasa, ofuda, paper lantern, fox mask, etc.)",
  },
  {
    id: "gothic",
    label: "ゴシック系",
    ja: "ゴシック系（黒い薔薇・古い本・燭台・鎖・十字モチーフなど）",
    en: "gothic (black rose, old book, candelabra, chain, cross motif, etc.)",
  },
  {
    id: "daily",
    label: "日常系",
    ja: "日常系（マグカップ・カメラ・ヘッドホン・バッグ・本など）",
    en: "daily (mug, camera, headphones, bag, book, etc.)",
  },
  {
    id: "funny",
    label: "面白い系",
    ja: "面白い系（巨大スプーン・謎の光る卵・ミニ宇宙船・浮遊する魚・巨大チェス駒など）",
    en: "funny (giant spoon, mystery glowing egg, mini spaceship, floating fish, giant chess piece, etc.)",
  },
  { id: "fashion", label: "ファッション小物", ja: "ファッション小物（バッグ・帽子・グローブ・サングラス・アクセサリーなど）", en: "fashion accessories (bag, hat, gloves, sunglasses, jewelry, etc.)" },
  { id: "flower", label: "花", ja: "花系の小物（花束・一輪挿し・花冠・散らした花びらなど）", en: "flower props (bouquet, single stem, flower crown, scattered petals, etc.)" },
  { id: "instrument", label: "楽器", ja: "楽器系（ヴァイオリン・チェロ・ギター・電子楽器など）", en: "musical instrument (violin, cello, guitar, electronic instrument, etc.)" },
];

export const PROPS_HOLDS: PresetItem[] = [
  { id: "chest_hold", label: "胸元で持つ", ja: "胸の前で持たせる・抱えるように持つ", en: "held at chest level" },
  { id: "near_face_hold", label: "顔の近くで", ja: "顔の近くで持たせる", en: "held near the face" },
  { id: "one_hand", label: "片手で持つ", ja: "片手で自然に持たせる", en: "held in one hand" },
  { id: "two_hands", label: "両手で包む", ja: "両手で包み込むように持たせる", en: "held in both hands, cradled" },
  { id: "shoulder", label: "肩に担ぐ", ja: "片肩に担ぐ", en: "carried over one shoulder" },
  { id: "floating", label: "浮遊させる", ja: "被写体の周囲に空中で浮かせる", en: "floating around the subject" },
  { id: "on_floor", label: "足元に置く", ja: "足元に自然に配置", en: "placed at the feet" },
  { id: "in_background", label: "背景側に配置", ja: "被写体には触れず背景側に配置", en: "placed in the background, not touching the subject" },
];

export const PROPS_SIZES: PresetItem[] = [
  { id: "tiny", label: "極小", ja: "非常に小さなサイズ", en: "tiny, very small" },
  { id: "small", label: "小さめ", ja: "小物サイズ", en: "small" },
  { id: "medium", label: "中サイズ", ja: "中サイズ", en: "medium" },
  { id: "large", label: "大きめ", ja: "大きめのサイズ", en: "large" },
  { id: "foreground_large", label: "手前に大きく", ja: "画面手前に大きく配置して存在感を出す", en: "large in foreground, prominent" },
  { id: "huge", label: "巨大", ja: "巨大サイズ（誇張表現）", en: "huge, oversized" },
];

export const PROPS_GLOWS: PresetItem[] = [
  { id: "none", label: "光らせない", ja: "発光なし", en: "no glow" },
  { id: "subtle", label: "淡い発光", ja: "ほのかな発光", en: "subtle glow" },
  { id: "edge_glow", label: "縁だけ発光", ja: "物体の縁だけが発光するエッジグロー", en: "edge glow only" },
  { id: "inner_glow", label: "内側から発光", ja: "内側から光が溢れるような発光", en: "inner glow from within" },
  { id: "neon", label: "強い発光", ja: "ネオン発光", en: "neon glow" },
  { id: "magical", label: "魔法の発光", ja: "魔法的な光、粒子エフェクト", en: "magical glow with particles" },
];

export const PROPS_VIBES: PresetItem[] = [
  { id: "cool", label: "クール", ja: "クールな雰囲気", en: "cool vibe" },
  { id: "cute", label: "かわいい", ja: "かわいい雰囲気", en: "cute vibe" },
  { id: "elegant", label: "上品", ja: "上品で優雅な雰囲気", en: "elegant vibe" },
  { id: "mysterious", label: "不思議", ja: "不思議で神秘的な雰囲気", en: "mysterious vibe" },
  { id: "retro", label: "レトロ", ja: "レトロで懐かしい雰囲気", en: "retro / vintage vibe" },
  { id: "fragile_vibe", label: "儚い", ja: "儚く壊れそうな繊細な雰囲気", en: "fragile, delicate vibe" },
  { id: "luxury", label: "高級感", ja: "高級感のある雰囲気", en: "luxurious vibe" },
  { id: "dark", label: "ダーク", ja: "ダーク・退廃的な雰囲気", en: "dark vibe" },
  { id: "funny", label: "面白い", ja: "ユーモラスで面白い雰囲気", en: "funny, humorous vibe" },
  { id: "sns", label: "SNS映え", ja: "SNS映えする視認性", en: "SNS-friendly visibility" },
];

export const PROPS_PLACEMENTS: PresetItem[] = [
  { id: "beside_face", label: "顔の横", ja: "顔の横・顔の近くに配置", en: "beside the face" },
  { id: "near_subject", label: "被写体に密着", ja: "被写体に密着するように配置", en: "placed close to subject" },
  { id: "blur_foreground", label: "手前にぼかす", ja: "手前にぼかして配置（ボケ効果）", en: "blurred in foreground" },
  { id: "foreground", label: "手前", ja: "手前に配置（被写体より前）", en: "in the foreground" },
  { id: "at_feet", label: "足元", ja: "足元に配置", en: "at the feet" },
  { id: "midground", label: "中景", ja: "中景に配置", en: "in the midground" },
  { id: "edge_frame", label: "画面端", ja: "画面の端に配置", en: "at the frame edge" },
  { id: "background", label: "背景側", ja: "背景に配置", en: "in the background" },
  { id: "all_around", label: "周囲全体", ja: "被写体の周囲全体に散らす", en: "scattered around the subject" },
];

export const PROPS_COUNTS: PresetItem[] = [
  { id: "single", label: "単体", ja: "1つだけ", en: "single" },
  { id: "few", label: "数個", ja: "2〜3個", en: "a few" },
  { id: "both_sides", label: "左右に複数", ja: "左右両側に複数配置", en: "multiple on both sides" },
  { id: "arranged", label: "規則的に並べる", ja: "規則的・対称的に並べた配置", en: "arranged in a pattern" },
  { id: "many", label: "たくさん", ja: "たくさん配置", en: "many" },
  { id: "scattered", label: "大量に散らす", ja: "散乱したように多数", en: "scattered, abundant" },
];

/* ---------------- LIGHTING ---------------- */

export const LIGHT_DIRECTIONS: PresetItem[] = [
  { id: "top", label: "トップライト", ja: "上方からの光", en: "top light" },
  { id: "diagonal_above", label: "斜め上", ja: "斜め上方からの光", en: "diagonal overhead light" },
  { id: "side", label: "サイドライト", ja: "横からの光", en: "side light" },
  { id: "back", label: "背後光/逆光", ja: "背後からの逆光", en: "back light / silhouette" },
  { id: "front", label: "正面光", ja: "正面からの光", en: "front light" },
  { id: "window", label: "窓光", ja: "窓からの自然な柔らかい光", en: "window light (soft natural)" },
  { id: "spot", label: "スポットライト", ja: "スポットライトで被写体を照らす", en: "spotlight on subject" },
  { id: "ambient", label: "環境光", ja: "周囲全体から均一に回る環境光", en: "ambient / wrap-around light" },
  { id: "below", label: "アンダーライト", ja: "下からの光", en: "under light" },
  { id: "multi", label: "複数光源", ja: "複数光源で複雑な陰影", en: "multiple light sources" },
  { id: "rim", label: "リムライト", ja: "輪郭を縁取るリムライト", en: "rim light" },
];

export const LIGHT_INTENSITIES: PresetItem[] = [
  { id: "low_key", label: "低照度", ja: "低照度・暗めのキーライト", en: "low-key, dim lighting" },
  { id: "soft", label: "柔らかい", ja: "柔らかい光", en: "soft light" },
  { id: "soft_backlight", label: "柔らかい逆光", ja: "柔らかく光が回る逆光照明", en: "soft backlight with glow" },
  { id: "pale_glow", label: "淡い発光", ja: "淡い発光感・ほのかなグロー", en: "pale glow, subtle luminescence" },
  { id: "normal", label: "標準", ja: "標準的な光量", en: "normal intensity" },
  { id: "strong", label: "ハイコントラスト", ja: "強い光、ハイコントラスト", en: "strong, high-contrast" },
  { id: "dramatic", label: "ドラマチック", ja: "極端なドラマチック照明", en: "dramatic, theatrical" },
];

export const LIGHT_TEMPS: PresetItem[] = [
  { id: "warm", label: "暖色", ja: "暖色（橙〜赤）", en: "warm temperature" },
  { id: "neutral", label: "ニュートラル", ja: "ニュートラル", en: "neutral temperature" },
  { id: "cool", label: "寒色", ja: "寒色（青〜紫）", en: "cool temperature" },
  { id: "blue_tone", label: "青み強め", ja: "青みがかった冷たい色温度", en: "blue-toned cool light" },
  { id: "red_tone", label: "赤み", ja: "赤みがかったアンバーな色温度", en: "red-amber tone" },
  { id: "sunset", label: "夕焼け色", ja: "夕焼けのオレンジ〜赤の色温度", en: "sunset orange-red tone" },
  { id: "white_light", label: "白色光", ja: "白色の中性的なスタジオ光", en: "white neutral studio light" },
  { id: "mixed", label: "暖寒ミックス", ja: "暖寒の混合", en: "mixed warm/cool" },
];

export const LIGHT_SHADOWS: PresetItem[] = [
  { id: "soft", label: "柔らかい陰影", ja: "柔らかく拡散した陰影", en: "soft, diffused shadows" },
  { id: "sharp", label: "シャープな影", ja: "輪郭のはっきりした影", en: "sharp, defined shadows" },
  { id: "deep", label: "深い影", ja: "深く暗い陰影", en: "deep, dark shadows" },
  { id: "drop", label: "落ち影", ja: "床・壁に落ちるドロップシャドウ", en: "drop shadow on surface" },
  { id: "outline", label: "輪郭影", ja: "被写体の輪郭に沿った影", en: "contour shadow, outline shadow" },
  { id: "long", label: "長い影", ja: "長く伸びる影", en: "long shadows" },
  { id: "minimal", label: "影ほぼなし", ja: "影をほとんど出さない", en: "minimal shadows" },
];

export const LIGHT_REFLECTIONS: PresetItem[] = [
  { id: "matte", label: "マット", ja: "マットで反射控えめ", en: "matte, low reflection" },
  { id: "satin", label: "サテン", ja: "サテンのほどよい反射", en: "satin reflection" },
  { id: "glossy", label: "光沢", ja: "光沢のある強い反射", en: "glossy reflection" },
  { id: "specular", label: "鏡面反射", ja: "鏡面のような強い反射", en: "specular highlights" },
  { id: "wet", label: "濡れた反射", ja: "濡れた表面のような艶と反射", en: "wet surface reflection" },
  { id: "metal_reflect", label: "金属反射", ja: "金属素材特有の鋭い反射", en: "metallic reflection" },
  { id: "glass_reflect", label: "ガラス反射", ja: "ガラスや水面のような透明な反射", en: "glass-like transparent reflection" },
  { id: "fabric", label: "布の反射", ja: "布素材の柔らかな乱反射", en: "fabric diffuse reflection" },
];

export const LIGHT_ATMOSPHERES: PresetItem[] = [
  { id: "clear", label: "クリア", ja: "クリアで澄んだ空気", en: "clear atmosphere" },
  { id: "hazy", label: "ヘイズ", ja: "薄いヘイズがかかる", en: "hazy" },
  { id: "foggy", label: "霧がかった", ja: "霧の濃い空気", en: "foggy, misty atmosphere" },
  { id: "after_rain", label: "雨上がり", ja: "雨上がりの澄んだ湿った空気感", en: "after-rain, fresh damp air" },
  { id: "dusty", label: "粉塵", ja: "塵が舞う乾いた空気", en: "dusty" },
  { id: "particulate", label: "光の粒", ja: "光の粒子が漂う空気", en: "particulate light" },
];

/* ---------------- ASPECT RATIO ---------------- */

export const ASPECT_RATIO_PRESETS: PresetItem[] = [
  {
    id: "original",
    label: "元のまま",
    ja: "元画像のアスペクト比を維持",
    en: "preserve original aspect ratio",
  },
  {
    id: "ar_9_16",
    label: "9:16",
    ja: "9:16 縦長構図（TikTok / Reels / Shorts 向け）",
    en: "9:16 vertical (TikTok / Reels / Shorts)",
  },
  {
    id: "ar_4_5",
    label: "4:5",
    ja: "4:5 縦長構図（Instagram 投稿向け）",
    en: "4:5 vertical (Instagram post)",
  },
  {
    id: "ar_1_1",
    label: "1:1",
    ja: "1:1 正方形構図（Instagram / アイコン向け）",
    en: "1:1 square (Instagram / icon)",
  },
  {
    id: "ar_16_9",
    label: "16:9",
    ja: "16:9 横長構図（YouTube サムネ / 横長映え）",
    en: "16:9 widescreen (YouTube / landscape)",
  },
  {
    id: "ar_3_4",
    label: "3:4",
    ja: "3:4 縦長構図",
    en: "3:4 vertical",
  },
  {
    id: "ar_2_3",
    label: "2:3",
    ja: "2:3 縦長構図",
    en: "2:3 vertical",
  },
  {
    id: "ar_21_9",
    label: "21:9",
    ja: "21:9 シネマティック横長構図",
    en: "21:9 cinematic widescreen",
  },
  {
    id: "custom",
    label: "カスタム",
    ja: "ユーザー指定のカスタム比率",
    en: "custom aspect ratio",
  },
];

/* ---------------- COSPLAY ---------------- */

export const COSPLAY_GENRES: PresetItem[] = [
  { id: "cute",        label: "かわいい系",     ja: "かわいい・ファンシーなコスプレ系統",   en: "cute / fancy cosplay style" },
  { id: "kakkoi",      label: "かっこいい系",   ja: "かっこいい・クールなコスプレ系統",     en: "cool / stylish cosplay" },
  { id: "cool",        label: "クール系",       ja: "クールでシャープなスタイル",           en: "sharp cool style" },
  { id: "dark",        label: "ダーク系",       ja: "ダーク・退廃的なコスプレ系統",         en: "dark / decadent cosplay" },
  { id: "elegant",     label: "エレガント系",   ja: "エレガントで上品なコスプレ系統",       en: "elegant cosplay" },
  { id: "transparent", label: "透明感系",       ja: "透明感・清楚なコスプレ系統",           en: "translucent / ethereal style" },
  { id: "luxury",      label: "ラグジュアリー系", ja: "高級感のあるコスプレ系統",           en: "luxury cosplay style" },
  { id: "street",      label: "ストリート系",   ja: "ストリートファッション寄りのコスプレ", en: "street cosplay" },
  { id: "idol",        label: "アイドル系",     ja: "アイドル衣装・ステージ衣装系統",       en: "idol / stage costume" },
  { id: "fantasy",     label: "ファンタジー系", ja: "ファンタジー世界観のコスプレ",         en: "fantasy cosplay" },
  { id: "japanese",    label: "和風系",         ja: "和風・和装コスプレ系統",               en: "Japanese style cosplay" },
  { id: "near_future", label: "近未来系",       ja: "近未来・SF系のコスプレ",               en: "near-future / sci-fi cosplay" },
  { id: "gothic",      label: "ゴシック系",     ja: "ゴシック・ダークロマンスなコスプレ",   en: "gothic cosplay" },
  { id: "battle",      label: "バトル系",       ja: "バトル・戦闘系のコスプレ",             en: "battle / combat cosplay" },
  { id: "magic",       label: "魔法系",         ja: "魔法・魔術系のコスプレ",               en: "magic / sorcery cosplay" },
  { id: "villain",     label: "ヴィラン系",     ja: "悪役・ヴィラン系のコスプレ",           en: "villain cosplay" },
  { id: "doll",        label: "ドール系",       ja: "人形・ドール系のコスプレ",             en: "doll-like cosplay" },
];

export const COSPLAY_CUTE_STYLES: PresetItem[] = [
  { id: "magical_girl",  label: "魔法少女",       ja: "魔法少女スタイル",                         en: "magical girl style" },
  { id: "yumekawa",      label: "夢かわいい",     ja: "夢かわいい（パステル・ふわふわ・盛り盛り）", en: "yumekawaii (pastel dreamy cute)" },
  { id: "ryousangata",   label: "量産型",         ja: "量産型コスプレ（チェック・ベレー帽・カーデ）", en: "mass-produced idol look" },
  { id: "jirai",         label: "地雷系",         ja: "地雷系（黒白・リボン・レース盛り）",         en: "jirai-kei (dark sweet style)" },
  { id: "lolita",        label: "ロリィタ",       ja: "クラシックロリィタファッション",             en: "classic lolita fashion" },
  { id: "sweet_lolita",  label: "スイートロリィタ", ja: "スイートロリィタ（パステルカラー・フリル）", en: "sweet lolita (pastel frills)" },
  { id: "hime_kei",      label: "姫系",           ja: "姫系ファッション（プリンセスライク）",       en: "hime-kei princess style" },
  { id: "idol_fashion",  label: "アイドル衣装",   ja: "アイドルのステージ衣装風",                   en: "idol stage costume" },
  { id: "maid_fashion",  label: "メイド服",       ja: "クラシックメイド服（白エプロン・フリル）",   en: "classic maid uniform" },
  { id: "bunny_ears",    label: "うさ耳コス",     ja: "うさ耳・ウサギモチーフのコスプレ",           en: "bunny ears cosplay" },
  { id: "cat_ears",      label: "猫耳コス",       ja: "猫耳・ネコモチーフのコスプレ",               en: "cat ears cosplay" },
  { id: "fairy_fashion", label: "妖精服",         ja: "妖精風の衣装（光・羽・小花）",               en: "fairy costume" },
  { id: "angel_fashion", label: "天使服",         ja: "天使風の衣装（白・羽・光輪）",               en: "angel costume" },
  { id: "heavy_ribbon",  label: "リボン盛り",     ja: "大きなリボンを多用した装飾",                 en: "heavily ribboned outfit" },
  { id: "star_motif",    label: "星モチーフ",     ja: "星・スターモチーフを全体に散りばめた衣装",   en: "star-motif cosplay outfit" },
];

export const COSPLAY_JOB_GENRES: PresetItem[] = [
  { id: "magical_girl",   label: "魔法少女",     ja: "魔法少女コスプレ（ステッキ・変身衣装）",   en: "magical girl cosplay" },
  { id: "mage",           label: "魔法使い",     ja: "魔法使い・ウィザードコスプレ",             en: "mage / wizard cosplay" },
  { id: "witch",          label: "魔女",         ja: "魔女コスプレ（帽子・ローブ）",             en: "witch cosplay" },
  { id: "knight",         label: "騎士",         ja: "騎士・ナイトコスプレ",                     en: "knight cosplay" },
  { id: "princess_knight",label: "姫騎士",       ja: "姫騎士コスプレ（可愛さと強さを併せ持つ）", en: "princess knight cosplay" },
  { id: "ninja",          label: "忍者",         ja: "忍者コスプレ",                             en: "ninja cosplay" },
  { id: "samurai",        label: "侍",           ja: "侍・剣士コスプレ",                         en: "samurai cosplay" },
  { id: "shrine_maiden",  label: "巫女",         ja: "巫女コスプレ（白衣・緋袴）",               en: "shrine maiden cosplay" },
  { id: "angel",          label: "天使",         ja: "天使コスプレ（白翼・光輪）",               en: "angel cosplay" },
  { id: "demon",          label: "悪魔",         ja: "悪魔コスプレ（角・尻尾・翼）",             en: "demon cosplay" },
  { id: "fairy",          label: "妖精",         ja: "妖精コスプレ（小さな翼・花冠）",           en: "fairy cosplay" },
  { id: "vampire",        label: "吸血鬼",       ja: "吸血鬼コスプレ（マント・牙）",             en: "vampire cosplay" },
  { id: "idol",           label: "アイドル",     ja: "アイドルコスプレ（ステージ衣装）",         en: "idol cosplay" },
  { id: "maid",           label: "メイド",       ja: "メイドコスプレ（エプロン・フリル）",       en: "maid cosplay" },
  { id: "military",       label: "軍人",         ja: "軍人・ミリタリーコスプレ（制服・階級章）", en: "military cosplay" },
  { id: "phantom_thief",  label: "怪盗",         ja: "怪盗コスプレ（マスク・タキシード）",       en: "phantom thief cosplay" },
  { id: "pirate",         label: "海賊",         ja: "海賊コスプレ（帽子・コート）",             en: "pirate cosplay" },
  { id: "princess",       label: "お姫様",       ja: "お姫様コスプレ（ドレス・ティアラ）",       en: "princess cosplay" },
  { id: "queen",          label: "女王",         ja: "女王コスプレ（王冠・豪華ドレス）",         en: "queen cosplay" },
  { id: "warrior",        label: "戦士",         ja: "戦士コスプレ（鎧・武器）",                 en: "warrior cosplay" },
  { id: "assassin",       label: "アサシン",     ja: "アサシンコスプレ（フード・暗器）",         en: "assassin cosplay" },
  { id: "android",        label: "アンドロイド", ja: "アンドロイドコスプレ（メカ風・電子パーツ）", en: "android cosplay" },
  { id: "hero",           label: "ヒーロー",     ja: "ヒーローコスプレ（スーパーヒーロー風）",   en: "hero cosplay" },
  { id: "bride",          label: "花嫁",         ja: "花嫁コスプレ（ウェディングドレス風）",     en: "bride cosplay" },
];

export const COSPLAY_JAPANESE_STYLES: PresetItem[] = [
  { id: "shrine_maiden",   label: "巫女",       ja: "巫女衣装（白衣・緋袴）",               en: "shrine maiden outfit" },
  { id: "fox_shrine_maiden",label: "狐巫女",    ja: "狐巫女（狐耳・白衣・緋袴）",           en: "fox shrine maiden" },
  { id: "geisha",           label: "芸者",       ja: "芸者・舞妓風の和装",                   en: "geisha / maiko style" },
  { id: "kunoichi",         label: "くノ一",     ja: "くノ一（忍装束・女忍者）",             en: "female ninja (kunoichi)" },
  { id: "samurai_girl",     label: "女侍",       ja: "女侍・剣士（和装・刀）",               en: "female samurai" },
  { id: "oni_girl",         label: "鬼女",       ja: "鬼の少女（角・和装）",                 en: "oni girl" },
  { id: "kitsune",          label: "狐",         ja: "狐の神（複数尾・白装束）",             en: "kitsune fox spirit" },
  { id: "wa_lolita",        label: "和ロリィタ", ja: "和風ロリィタ（着物×ロリィタ融合）",   en: "wa-lolita (Japanese lolita)" },
  { id: "taisho_western",   label: "大正浪漫",   ja: "大正ロマン洋装（着物×ハイカラ）",     en: "Taisho-era Western fusion" },
  { id: "japanese_bride",   label: "和装花嫁",   ja: "白無垢・和装の花嫁衣装",               en: "Japanese bridal kimono" },
];

export const COSPLAY_FANTASY_STYLES: PresetItem[] = [
  { id: "elf",          label: "エルフ",       ja: "エルフコスプレ（尖った耳・森の衣装）",     en: "elf cosplay" },
  { id: "dark_elf",     label: "ダークエルフ", ja: "ダークエルフ（褐色肌・銀髪・暗い衣装）",   en: "dark elf cosplay" },
  { id: "dragon_knight",label: "竜騎士",       ja: "竜騎士コスプレ（鱗模様の鎧・翼）",         en: "dragon knight cosplay" },
  { id: "fairy_queen",  label: "妖精女王",     ja: "妖精女王（光の翼・花冠・宮廷ドレス）",     en: "fairy queen cosplay" },
  { id: "sorceress",    label: "魔術師",       ja: "魔術師・ソーサレス（ローブ・魔法陣）",     en: "sorceress / arcane mage" },
  { id: "dark_knight",  label: "暗黒騎士",     ja: "暗黒騎士（黒い鎧・暗い光）",               en: "dark knight cosplay" },
  { id: "holy_knight",  label: "聖騎士",       ja: "聖騎士・パラディン（白銀の鎧・神聖な輝き）", en: "holy knight / paladin" },
  { id: "valkyrie",     label: "ヴァルキリー", ja: "ヴァルキリー（翼の鎧・槍・金髪）",         en: "valkyrie cosplay" },
  { id: "succubus",     label: "サキュバス",   ja: "サキュバス（蝙蝠翼・角・退廃的衣装）",     en: "succubus cosplay" },
  { id: "angel_knight", label: "天使騎士",     ja: "天使騎士（白翼・純白の鎧）",               en: "angel knight cosplay" },
  { id: "beastgirl",    label: "獣人少女",     ja: "獣人少女（動物の耳・尻尾・爪）",           en: "beastgirl cosplay" },
  { id: "dragon_girl",  label: "竜人少女",     ja: "竜人少女（鱗・角・翼・尻尾）",             en: "dragon girl cosplay" },
];

export const COSPLAY_SCIFI_STYLES: PresetItem[] = [
  { id: "android",        label: "アンドロイド",     ja: "アンドロイド（機械パーツ・透明ボディ）",     en: "android cosplay" },
  { id: "cyber_soldier",  label: "サイバー兵士",     ja: "サイバーパンク兵士（装甲・ネオン）",         en: "cyber soldier cosplay" },
  { id: "space_captain",  label: "宇宙艦長",         ja: "宇宙艦長（SF制服・バッジ）",                 en: "space captain cosplay" },
  { id: "ai_girl",        label: "AIガール",         ja: "AIガール（ホログラム・デジタル模様）",       en: "AI girl cosplay" },
  { id: "hacker",         label: "ハッカー",         ja: "ハッカー（フード・サイバー機器）",           en: "hacker cosplay" },
  { id: "power_suit",     label: "パワードスーツ",   ja: "パワードスーツ（強化外骨格・メカ腕）",       en: "power suit cosplay" },
  { id: "mecha_pilot",    label: "メカパイロット",   ja: "ロボット・メカのパイロット衣装",             en: "mech pilot cosplay" },
  { id: "hologram_idol",  label: "ホログラムアイドル", ja: "ホログラムアイドル（半透明エフェクト衣装）", en: "hologram idol cosplay" },
  { id: "quantum_mage",   label: "量子魔法使い",     ja: "量子魔法使い（科学×魔法の融合衣装）",       en: "quantum mage cosplay" },
  { id: "nano_warrior",   label: "ナノマシン戦士",   ja: "ナノマシン戦士（液体金属風の全身鎧）",       en: "nano warrior cosplay" },
];

export const COSPLAY_DARK_STYLES: PresetItem[] = [
  { id: "gothic_lolita", label: "ゴシックロリィタ", ja: "ゴシックロリィタ（黒×白・フリル・薔薇）",     en: "gothic lolita cosplay" },
  { id: "vampire",       label: "吸血鬼",           ja: "吸血鬼（マント・牙・血色の目）",               en: "vampire cosplay" },
  { id: "dark_witch",    label: "闇の魔女",         ja: "闇の魔女（黒ローブ・禍々しい紋章）",           en: "dark witch cosplay" },
  { id: "death_angel",   label: "死の天使",         ja: "死の天使（漆黒の翼・白装束）",                 en: "death angel cosplay" },
  { id: "cursed_knight", label: "呪われた騎士",     ja: "呪われた騎士（ひび割れた鎧・闇の光）",         en: "cursed knight cosplay" },
  { id: "fallen_angel",  label: "堕天使",           ja: "堕天使（黒い羽・傷ついた翼）",                 en: "fallen angel cosplay" },
  { id: "demon_queen",   label: "悪魔女王",         ja: "悪魔女王（角・豪華な黒ドレス・玉座感）",       en: "demon queen cosplay" },
  { id: "plague_doctor", label: "ペスト医師",       ja: "ペスト医師（くちばし仮面・黒コート）",         en: "plague doctor cosplay" },
  { id: "revenant",      label: "亡霊",             ja: "亡霊・ゴースト（半透明・古い衣装・傷）",       en: "revenant / ghost cosplay" },
  { id: "undead_bride",  label: "アンデッド花嫁",   ja: "アンデッド花嫁（朽ちたウェディングドレス）",   en: "undead bride cosplay" },
];

export const COSPLAY_OCCUPATIONS: PresetItem[] = [
  { id: "nurse",       label: "ナース",         ja: "ナースコスプレ（白衣・ナースキャップ）",       en: "nurse cosplay" },
  { id: "police",      label: "警察",           ja: "警察コスプレ（制服・バッジ）",                 en: "police cosplay" },
  { id: "bunny_girl",  label: "バニーガール",   ja: "バニーガール（バニー耳・ボディスーツ）",       en: "bunny girl cosplay" },
  { id: "magician",    label: "マジシャン",     ja: "マジシャン（タキシード・マント・シルクハット）", en: "magician cosplay" },
  { id: "chef",        label: "シェフ",         ja: "シェフコスプレ（白コック服・帽子）",           en: "chef cosplay" },
  { id: "teacher",     label: "先生",           ja: "先生コスプレ（スーツ・眼鏡）",                 en: "teacher cosplay" },
  { id: "nun",         label: "シスター",       ja: "シスター・修道女コスプレ",                     en: "nun cosplay" },
  { id: "spy",         label: "スパイ",         ja: "スパイコスプレ（タキシード・スマートウォッチ）", en: "spy cosplay" },
  { id: "pilot",       label: "パイロット",     ja: "パイロットコスプレ（制服・サングラス）",       en: "pilot cosplay" },
  { id: "cheerleader", label: "チアリーダー",   ja: "チアリーダーコスプレ（ポンポン・ミニスカ）",   en: "cheerleader cosplay" },
];

export const COSPLAY_DECORATIONS: PresetItem[] = [
  { id: "minimal",   label: "装飾少なめ", ja: "シンプルでミニマルな装飾",                 en: "minimal decoration" },
  { id: "moderate",  label: "ほどよく",   ja: "ほどよい装飾量",                           en: "moderate decoration" },
  { id: "elaborate", label: "凝った装飾", ja: "凝ったデザインと豊富な装飾",               en: "elaborate decoration" },
  { id: "maximal",   label: "装飾最大",   ja: "全身を埋め尽くすほどの装飾・盛り盛り",     en: "maximal decoration" },
  { id: "armored",   label: "鎧付き",     ja: "防具・鎧のパーツを組み合わせた装飾",       en: "armored decoration" },
];

export const COSPLAY_ITEMS: PresetItem[] = [
  { id: "wand",          label: "魔法のステッキ", ja: "魔法少女風のステッキ・ロッド",       en: "magical wand / rod" },
  { id: "staff",         label: "魔法の杖",       ja: "魔法使い・ウィザードの杖",           en: "wizard staff" },
  { id: "sword",         label: "剣",             ja: "剣・刀（片手剣・大剣）",             en: "sword" },
  { id: "shield",        label: "盾",             ja: "騎士の盾",                           en: "shield" },
  { id: "bow",           label: "弓",             ja: "弓矢",                               en: "bow and arrow" },
  { id: "gun",           label: "銃",             ja: "拳銃・SF銃・魔法銃",                 en: "gun / magical gun" },
  { id: "book",          label: "魔導書",         ja: "魔法の本・グリモア",                 en: "grimoire / magic book" },
  { id: "potion",        label: "ポーション",     ja: "ポーション瓶・魔薬",                 en: "potion bottle" },
  { id: "crown",         label: "王冠",           ja: "王冠・ティアラ",                     en: "crown / tiara" },
  { id: "wings",         label: "翼",             ja: "翼（羽根・妖精の翼）",               en: "wings" },
  { id: "tail",          label: "尻尾",           ja: "動物や悪魔の尻尾",                   en: "tail" },
  { id: "ears",          label: "動物耳",         ja: "猫耳・兎耳・狐耳など動物の耳",       en: "animal ears" },
  { id: "scythe",        label: "大鎌",           ja: "死神風の大鎌",                       en: "scythe" },
  { id: "lantern",       label: "ランタン",       ja: "魔法のランタン・提灯",               en: "lantern" },
  { id: "orb",           label: "魔法球",         ja: "輝く魔法球・水晶球",                 en: "magic orb / crystal ball" },
];

export const COSPLAY_EXPOSURES: PresetItem[] = [
  { id: "modest", label: "控えめ", ja: "露出は控えめで清楚なデザイン",           en: "modest, low exposure design" },
  { id: "bold",   label: "大胆",   ja: "露出高めのスタイリッシュなデザイン",     en: "bold, high-exposure stylish design" },
];

export const COSPLAY_COLOR_DIRS: PresetItem[] = [
  { id: "inherit", label: "元画像継承", ja: "元画像の色調を引き継ぐ",     en: "inherit from source image" },
  { id: "white",   label: "白系",       ja: "白・パール・アイボリー系",   en: "white / pearl tone" },
  { id: "black",   label: "黒系",       ja: "黒・チャコール系",           en: "black / charcoal tone" },
  { id: "red",     label: "赤系",       ja: "赤・クリムゾン系",           en: "red / crimson tone" },
  { id: "blue",    label: "青系",       ja: "青・ネイビー・コバルト系",   en: "blue / navy tone" },
  { id: "pink",    label: "ピンク系",   ja: "ピンク・ローズ系",           en: "pink / rose tone" },
  { id: "purple",  label: "紫系",       ja: "紫・ヴァイオレット系",       en: "purple / violet tone" },
  { id: "gold",    label: "ゴールド系", ja: "ゴールド・アンバー系",       en: "gold / amber tone" },
  { id: "silver",  label: "シルバー系", ja: "シルバー・クロム系",         en: "silver / chrome tone" },
  { id: "rainbow", label: "レインボー", ja: "レインボー・多色配色",       en: "rainbow / multicolor" },
];

/* ---------------- CYBER（機械化・サイボーグ化） ---------------- */

export const CYBER_PARTS: PresetItem[] = [
  { id: "one_arm",    label: "片腕",       ja: "片腕の一部をサイボーグ化",             en: "one arm partially mechanized" },
  { id: "both_arms",  label: "両腕",       ja: "両腕をサイボーグ化",                   en: "both arms mechanized" },
  { id: "hand",       label: "手",         ja: "手をロボット化・機械化",               en: "hand mechanized" },
  { id: "finger",     label: "指",         ja: "指を機械化・金属化",                   en: "fingers mechanized" },
  { id: "shoulder",   label: "肩",         ja: "肩にメカパーツを装着",                 en: "shoulder mechanized" },
  { id: "neck",       label: "首元",       ja: "首元にサイバーパーツを組み込む",       en: "neck area mechanized" },
  { id: "back",       label: "背中",       ja: "背中にメカパーツ・装備を搭載",         en: "back mechanized" },
  { id: "leg",        label: "脚",         ja: "両脚をサイボーグ化",                   en: "legs mechanized" },
  { id: "one_leg",    label: "片脚",       ja: "片脚の一部をサイボーグ化",             en: "one leg mechanized" },
  { id: "eye",        label: "目元",       ja: "目元にサイバーアイ・スキャナーを組み込む", en: "eye area cyber-enhanced" },
  { id: "cheek",      label: "頬",         ja: "頬に回路・機械パーツを露出させる",     en: "cheek with cyber parts" },
  { id: "hair_part",  label: "髪の一部",   ja: "髪の一部を光ファイバー・金属化する",   en: "part of hair mechanized" },
  { id: "outfit_part",label: "衣装の一部", ja: "衣装の一部にメカパーツを統合",         en: "part of outfit mechanized" },
  { id: "body_part",  label: "体の一部",   ja: "体のどこか一部だけを機械化（AI任せ）", en: "one part of body mechanized" },
];

export const CYBER_TYPES: PresetItem[] = [
  { id: "cyborg",           label: "サイボーグ化",     ja: "生身と機械が融合したサイボーグデザイン",         en: "cyborg fusion design" },
  { id: "robot_arm",        label: "ロボット義手",     ja: "精巧なロボット義手",                             en: "robotic prosthetic arm" },
  { id: "robot_leg",        label: "ロボット義足",     ja: "精巧なロボット義足",                             en: "robotic prosthetic leg" },
  { id: "android_armor",    label: "アンドロイド装甲", ja: "アンドロイド風の精密な装甲パーツ",               en: "android armor plating" },
  { id: "mech_parts",       label: "メカパーツ露出",   ja: "皮膚の下からメカニカルパーツが露出",             en: "mechanical parts exposed under skin" },
  { id: "cable_exposure",   label: "ケーブル露出",     ja: "細いケーブル・配線が皮膚から見える",             en: "cables and wiring exposed" },
  { id: "glow_circuit",     label: "発光回路",         ja: "皮膚の下に発光する電子回路が透けて見える",       en: "glowing circuit beneath skin" },
  { id: "transparent_body", label: "透明外装",         ja: "透明な外装の中に精密な機械構造が見える",         en: "transparent casing with inner mechanics" },
  { id: "metal_skeleton",   label: "金属骨格",         ja: "金属製の骨格・フレームが一部露出",               en: "metal skeleton partially exposed" },
  { id: "hologram",         label: "ホログラム化",     ja: "体の一部がホログラム状に半透明化・分解",         en: "part dissolving into hologram" },
  { id: "digital_decomp",   label: "デジタル分解",     ja: "体の一部がデジタルピクセルに分解・消滅",         en: "digital pixel decomposition" },
  { id: "polygon_mesh",     label: "ポリゴンメッシュ", ja: "体の一部が3Dポリゴンメッシュ状に変化",           en: "3D polygon mesh transformation" },
  { id: "wireframe",        label: "ワイヤーフレーム", ja: "体の一部がワイヤーフレームモデルに変化",         en: "wireframe model transformation" },
  { id: "blueprint",        label: "設計図風",         ja: "体の一部が工業設計図・青写真スタイルに変化",     en: "engineering blueprint style" },
  { id: "cad",              label: "CAD図面風",         ja: "体の一部がCAD図面のように白地×青線に変化",       en: "CAD drawing style" },
  { id: "xray",             label: "X線風",             ja: "体の一部がX線透過・骨格・機械構造が透けて見える", en: "X-ray view of inner structure" },
  { id: "circuit_board",    label: "回路基板風",       ja: "体の一部が電子回路基板のパターンで覆われる",     en: "circuit board pattern overlay" },
  { id: "glitch",           label: "グリッチ化",       ja: "体の一部がデジタルグリッチ・ノイズで崩壊",       en: "digital glitch corruption" },
  { id: "data_stream",      label: "データ化",         ja: "体の一部が流れるデータ・コード・文字列に変化",   en: "dissolving into data streams" },
  { id: "nanomachine",      label: "ナノマシン風",     ja: "体の一部がナノマシン群の集合体のように変化",     en: "nanomachine swarm transformation" },
  { id: "glass_mech",       label: "ガラス機械化",     ja: "ガラスのような透明素材の精密な機械パーツに変化", en: "glass-like mechanical transformation" },
];

export const CYBER_TEXTURES: PresetItem[] = [
  { id: "metal",            label: "金属",         ja: "シルバー金属質感",                         en: "metallic silver" },
  { id: "black_metal",      label: "黒金属",       ja: "マットブラックの金属質感",                 en: "matte black metal" },
  { id: "white_ceramic",    label: "白セラミック", ja: "白い滑らかなセラミック素材",               en: "white ceramic" },
  { id: "transparent_glass",label: "透明ガラス",   ja: "透明なガラス素材・クリアパーツ",           en: "transparent glass" },
  { id: "carbon",           label: "カーボン",     ja: "カーボンファイバー質感",                   en: "carbon fiber" },
  { id: "chrome",           label: "クローム",     ja: "鏡面クローム・高反射メタル",               en: "chrome / mirror finish" },
  { id: "matte_metal",      label: "マットメタル", ja: "光沢を抑えたマットメタル質感",             en: "matte metal" },
  { id: "gloss_metal",      label: "光沢メタル",   ja: "強い光沢のある金属質感",                   en: "glossy metal" },
  { id: "glow_material",    label: "発光素材",     ja: "内側から発光するエネルギー素材",           en: "self-illuminating material" },
  { id: "translucent",      label: "半透明素材",   ja: "半透明で内部構造が透けて見える素材",       en: "translucent material" },
];

export const CYBER_GLOW_COLORS: PresetItem[] = [
  { id: "blue",    label: "青",     ja: "青い発光（電気エネルギー系）",   en: "blue glow" },
  { id: "cyan",    label: "シアン", ja: "シアンの発光（サイバー系）",     en: "cyan glow" },
  { id: "purple",  label: "紫",     ja: "紫の発光（魔力・神秘系）",       en: "purple glow" },
  { id: "red",     label: "赤",     ja: "赤い発光（高出力・警戒系）",     en: "red glow" },
  { id: "pink",    label: "ピンク", ja: "ピンクの発光（可愛い系サイバー）", en: "pink glow" },
  { id: "green",   label: "緑",     ja: "緑の発光（バイオ・ハッカー系）", en: "green glow" },
  { id: "white",   label: "白",     ja: "白い発光（クリーン・天使系）",   en: "white glow" },
  { id: "gold",    label: "金色",   ja: "金色の発光（高級・神聖系）",     en: "gold glow" },
  { id: "rainbow", label: "虹色",   ja: "虹色の多色発光",                 en: "rainbow glow" },
];

export const CYBER_INTENSITIES: PresetItem[] = [
  { id: "subtle", label: "控えめ", ja: "ごく一部・控えめな機械化",           en: "subtle, minimal mechanization" },
  { id: "normal", label: "普通",   ja: "程よい機械化・バランスが良い",       en: "moderate mechanization" },
  { id: "strong", label: "強め",   ja: "明確で存在感のある機械化",           en: "strong, prominent mechanization" },
  { id: "bold",   label: "大胆",   ja: "大胆で印象的な機械化（目立つデザイン）", en: "bold, dramatic mechanization" },
];

/* ---------------- FOREGROUND EFFECTS ---------------- */

export const FG_PRESETS: PresetItem[] = [
  { id: "buzz",        label: "バズ強化",   ja: "SNS映えするバズ強化前景演出",                  en: "buzz-optimized foreground fx" },
  { id: "god",         label: "神引き",     ja: "神引きレベルの最高品質前景演出",               en: "god-tier foreground effects" },
  { id: "subtle",      label: "控えめ",     ja: "控えめで自然な前景演出",                       en: "subtle foreground effects" },
  { id: "flashy",      label: "ド派手",     ja: "ド派手で強烈な前景演出",                       en: "flashy dramatic foreground" },
  { id: "fantasy",     label: "幻想的",     ja: "幻想的・夢幻的な前景演出",                     en: "fantastical dreamy foreground" },
  { id: "cyber",       label: "サイバー",   ja: "サイバー・デジタル系前景演出",                 en: "cyber digital foreground fx" },
  { id: "japanese",    label: "和風",       ja: "和風の前景演出",                               en: "japanese-style foreground" },
  { id: "dark",        label: "ダーク",     ja: "ダーク・ゴシック系前景演出",                   en: "dark gothic foreground" },
  { id: "translucent", label: "透明感",     ja: "透明感のある前景演出",                         en: "translucent ethereal foreground" },
  { id: "art",         label: "アート系",   ja: "現代アート・近代アート系前景演出",             en: "art-style foreground" },
  { id: "watercolor",  label: "水彩系",     ja: "水彩・水墨系前景演出",                         en: "watercolor-style foreground" },
  { id: "text_effect", label: "文字演出",   ja: "文字・タイポグラフィ系前景演出",               en: "typography text foreground" },
  { id: "light",       label: "光演出",     ja: "光・発光系前景演出",                           en: "light glow foreground fx" },
  { id: "flower",      label: "花演出",     ja: "花・花びら系前景演出",                         en: "floral petal foreground" },
];

export const FG_EFFECT_TYPES: PresetItem[] = [
  { id: "petals",       label: "花びら",     ja: "花びら散布",                   en: "flower petals" },
  { id: "sakura",       label: "桜",         ja: "桜の花びら",                   en: "sakura petals" },
  { id: "rose",         label: "薔薇",       ja: "薔薇の花びら",                 en: "rose petals" },
  { id: "camellia",     label: "椿",         ja: "椿の花",                       en: "camellia flowers" },
  { id: "higanbana",    label: "彼岸花",     ja: "彼岸花（赤い妖艶な花）",       en: "spider lily higanbana" },
  { id: "feather",      label: "羽",         ja: "羽根・羽毛",                   en: "feathers" },
  { id: "down",         label: "羽毛",       ja: "ふわふわした羽毛",             en: "fluffy down feathers" },
  { id: "snow",         label: "雪",         ja: "雪の粒・雪片",                 en: "snow particles" },
  { id: "rain",         label: "雨粒",       ja: "雨粒",                         en: "raindrops" },
  { id: "bubble",       label: "泡",         ja: "水の泡",                       en: "bubbles" },
  { id: "drop",         label: "水滴",       ja: "水滴",                         en: "water droplets" },
  { id: "glass",        label: "ガラス片",   ja: "割れたガラスの破片",           en: "glass shards" },
  { id: "confetti",     label: "紙吹雪",     ja: "紙吹雪",                       en: "confetti" },
  { id: "spark",        label: "火の粉",     ja: "火の粉・スパーク",             en: "sparks embers" },
  { id: "ash",          label: "灰",         ja: "灰・黒い灰",                   en: "ash particles" },
  { id: "light_particle",label:"光の粒",     ja: "光の粒子・光の点",             en: "light particles" },
  { id: "stardust",     label: "星屑",       ja: "星屑・星の輝き",               en: "stardust sparkles" },
  { id: "butterfly",    label: "蝶",         ja: "蝶々",                         en: "butterflies" },
  { id: "jellyfish",    label: "クラゲ",     ja: "クラゲ（幻想的な半透明クラゲ）", en: "jellyfish" },
  { id: "foxfire",      label: "狐火",       ja: "狐火（和風の神秘的な火）",     en: "fox fire kitsunebi" },
  { id: "spirit_fire",  label: "霊火",       ja: "霊火（青白い霊的な炎）",       en: "spirit flame ghost fire" },
  { id: "red_mist",     label: "赤い霧",     ja: "赤い霧・赤いオーラ霧",        en: "red mist" },
  { id: "blue_mist",    label: "青い霧",     ja: "青白い霧・神秘的な青い霧",    en: "blue mist" },
  { id: "black_smoke",  label: "黒い煙",     ja: "黒い煙・闇の霧",              en: "black smoke" },
  { id: "white_smoke",  label: "白い煙",     ja: "白い煙・白い霧",              en: "white smoke" },
  { id: "light_feather",     label: "光の羽",       ja: "発光する羽根",                           en: "glowing light feathers" },
  { id: "fabric_strip",      label: "布の帯",       ja: "布の帯・薄い布が舞い散る演出",           en: "strips of fabric floating" },
  { id: "transparent_ribbon",label: "透明リボン",   ja: "透明なリボン・薄膜が漂う演出",           en: "transparent ribbon wisps" },
  { id: "smoke_puff",        label: "煙の塊",       ja: "ふわっと膨らむ煙の塊・柔らかい霧",       en: "soft puff of smoke mist" },
];

export const FG_SWIRL_TYPES: PresetItem[] = [
  { id: "light_ring",      label: "光リング",        ja: "光のリング",                     en: "light ring" },
  { id: "energy_vortex",   label: "エネルギー渦",    ja: "エネルギーの渦",                 en: "energy vortex" },
  { id: "magic_circle",    label: "魔法陣",          ja: "魔法陣",                         en: "magic circle" },
  { id: "aura_swirl",      label: "オーラ旋回",      ja: "オーラの旋回",                   en: "aura swirl" },
  { id: "particle_swirl",  label: "粒子旋回",        ja: "粒子の旋回",                     en: "particle swirl" },
  { id: "cable_swirl",     label: "ケーブル旋回",    ja: "ケーブル・コードの旋回",         en: "cable wire swirl" },
  { id: "wire_swirl",      label: "ワイヤー旋回",    ja: "ワイヤーの旋回",                 en: "wire swirl" },
  { id: "ink_vortex",      label: "インク渦",        ja: "墨・インクの渦",                 en: "ink vortex" },
  { id: "water_vortex",    label: "水流渦",          ja: "水の渦・水流",                   en: "water vortex" },
  { id: "fire_vortex",     label: "火炎渦",          ja: "炎の渦",                         en: "fire vortex" },
  { id: "petal_vortex",    label: "花びらの渦",      ja: "花びらの旋回・渦",               en: "petal vortex" },
  { id: "butterfly_swirl", label: "蝶の旋回",        ja: "蝶々の旋回",                     en: "butterfly swirl" },
  { id: "circular_hud",    label: "円形HUD",         ja: "円形のHUDエフェクト",            en: "circular HUD ring" },
  { id: "multi_ring",      label: "多重リング",      ja: "多重リング・多重円",             en: "multi ring layers" },
  { id: "light_trail",     label: "光の軌跡",        ja: "光の軌跡・残像",                 en: "light trail" },
  { id: "ribbon_light",    label: "リボン状の光",    ja: "リボン状に流れる光",             en: "ribbon light stream" },
  { id: "ripple",          label: "波紋",            ja: "波紋・水面の波",                 en: "ripple effect" },
  { id: "light_thread",    label: "光の糸",          ja: "光の糸・繊細な線が交差する演出", en: "light thread fine lines crossing" },
];

export const FG_DIGITAL_TYPES: PresetItem[] = [
  { id: "ui_hologram",           label: "UIホログラム",       ja: "ホログラムUI",                       en: "hologram UI" },
  { id: "scanline",              label: "スキャンライン",     ja: "スキャンライン",                     en: "scanlines" },
  { id: "numbers",               label: "数字",               ja: "数字の流れ",                         en: "floating numbers" },
  { id: "code_text",             label: "コード文字",         ja: "プログラムコード文字",               en: "code text" },
  { id: "glitch_text",           label: "文字乱列",           ja: "文字の乱列・グリッチ文字",           en: "glitch text scramble" },
  { id: "japanese_typography",   label: "和文タイポ",         ja: "日本語タイポグラフィ",               en: "japanese typography" },
  { id: "alphanumeric_typography",label:"英数字タイポ",       ja: "英数字タイポグラフィ",               en: "alphanumeric typography" },
  { id: "glitch",                label: "グリッチ",           ja: "グリッチエフェクト",                 en: "glitch effect" },
  { id: "target_ui",             label: "ターゲットUI",       ja: "ターゲットサークルUI",               en: "target UI" },
  { id: "circular_hud",         label: "円形HUD",            ja: "円形HUDパネル",                     en: "circular HUD panel" },
  { id: "waveform",              label: "波形",               ja: "音波・波形グラフ",                   en: "waveform" },
  { id: "data_stream",           label: "データ流",           ja: "データストリーム",                   en: "data stream" },
  { id: "geometric",             label: "幾何学図形",         ja: "幾何学的図形",                       en: "geometric shapes" },
  { id: "hologram_panel",        label: "ホログラムパネル",   ja: "ホログラムパネル",                   en: "hologram panel" },
  { id: "transparent_window",    label: "透明ウィンドウ",     ja: "透明なウィンドウ",                   en: "transparent window" },
  { id: "circuit_lines",         label: "電子回路線",         ja: "電子回路のライン",                   en: "circuit board lines" },
  { id: "digital_noise",         label: "デジタルノイズ",     ja: "デジタルノイズ",                     en: "digital noise" },
];

export const FG_ART_TYPES: PresetItem[] = [
  { id: "watercolor_splash",  label: "水彩飛沫",       ja: "水彩絵の具の飛沫",                   en: "watercolor splash" },
  { id: "ink_splash",         label: "墨飛沫",         ja: "墨汁の飛沫",                         en: "ink splash" },
  { id: "paint_splash",       label: "ペンキ飛沫",     ja: "ペンキの飛沫",                       en: "paint splash" },
  { id: "brushstroke",        label: "ブラシストローク",ja: "筆のブラシストローク",              en: "brushstroke" },
  { id: "ink_line",           label: "インクライン",   ja: "インクのライン",                     en: "ink lines" },
  { id: "collage",            label: "コラージュ片",   ja: "コラージュ風の断片",                 en: "collage fragments" },
  { id: "paper_texture",      label: "紙テクスチャ",   ja: "紙の質感テクスチャ",                 en: "paper texture overlay" },
  { id: "modern_art_line",    label: "現代アート線",   ja: "現代アート風の線",                   en: "modern art lines" },
  { id: "abstract_shape",     label: "抽象図形",       ja: "抽象的な図形",                       en: "abstract shapes" },
  { id: "color_plane",        label: "色面構成",       ja: "色面構成",                           en: "color plane composition" },
  { id: "cubism_fragment",    label: "キュビズム片",   ja: "キュビズム風の断片",                 en: "cubism fragments" },
  { id: "glass_abstract",     label: "ガラス風抽象片", ja: "ガラス風の抽象的な破片",            en: "glass-like abstract shards" },
  { id: "fragment",           label: "破片表現",       ja: "破片・断片の演出",                   en: "fragment shards" },
  { id: "glowing_lineart",    label: "光る線画",       ja: "発光する線画・グローライン",         en: "glowing lineart" },
  { id: "handdrawn",          label: "手描き線",       ja: "手描き風の線",                       en: "hand-drawn lines" },
  { id: "transparent_acrylic",label: "透明アクリル片", ja: "透明なアクリル片",                   en: "transparent acrylic shards" },
];

export const FG_POSITIONS: PresetItem[] = [
  { id: "face_area",      label: "顔まわり",         ja: "顔の周囲（軽めに）",               en: "around face (subtle)" },
  { id: "shoulder",       label: "肩まわり",         ja: "肩・首まわり",                     en: "around shoulders" },
  { id: "arm",            label: "腕まわり",         ja: "腕の周囲",                         en: "around arms" },
  { id: "hand",           label: "手元",             ja: "手元・手の周囲",                   en: "at hands" },
  { id: "avoid_chest",    label: "胸元は避ける",     ja: "胸元は避けて配置",                 en: "avoid chest area" },
  { id: "waist",          label: "腰まわり",         ja: "腰まわり",                         en: "around waist" },
  { id: "feet",           label: "足元",             ja: "足元",                             en: "at feet" },
  { id: "full_body",      label: "全身",             ja: "全身に広がる",                     en: "full body spread" },
  { id: "full_screen",    label: "画面全体",         ja: "画面全体",                         en: "full screen" },
  { id: "one_side",       label: "片側だけ",         ja: "画面の片側のみ",                   en: "one side only" },
  { id: "center",         label: "中央集中",         ja: "画面中央に集中",                   en: "center concentrated" },
  { id: "surrounding",    label: "周囲を囲む",       ja: "人物の周囲を囲むように",           en: "surrounding the subject" },
  { id: "back_to_front",  label: "背面から前面",     ja: "背面から前面へ流れる",             en: "flowing back to front" },
  { id: "diagonal",       label: "斜めに横切る",     ja: "斜めに横切る",                     en: "diagonal across" },
  { id: "rising",         label: "下から舞い上がる", ja: "下から舞い上がる",                 en: "rising from below" },
  { id: "falling",        label: "上から降り注ぐ",   ja: "上から降り注ぐ",                   en: "falling from above" },
];

export const FG_DENSITIES: PresetItem[] = [
  { id: "minimal", label: "ごく控えめ", ja: "ごく控えめ（最小限）",         en: "minimal" },
  { id: "subtle",  label: "控えめ",     ja: "控えめ（少量）",               en: "subtle" },
  { id: "normal",  label: "普通",       ja: "普通の量",                     en: "normal" },
  { id: "rich",    label: "多め",       ja: "多めの量",                     en: "rich" },
  { id: "max",     label: "最大",       ja: "最大（顔・目は隠さない範囲）", en: "maximum (face always visible)" },
];

export const FG_MOTIONS: PresetItem[] = [
  { id: "still",       label: "静止",           ja: "静止",                 en: "still static" },
  { id: "gentle_flow", label: "ゆるく流れる",   ja: "ゆるやかに流れる",     en: "gentle flow" },
  { id: "rotate",      label: "回転",           ja: "回転",                 en: "rotating" },
  { id: "vortex",      label: "渦巻く",         ja: "渦巻く",               en: "vortex swirling" },
  { id: "explode",     label: "爆発",           ja: "爆発的に広がる",       en: "explosive burst" },
  { id: "radiate",     label: "放射",           ja: "中心から放射状に広がる", en: "radiating outward" },
  { id: "falling",     label: "降り注ぐ",       ja: "上から降り注ぐ",       en: "falling down" },
  { id: "rising",      label: "舞い上がる",     ja: "下から舞い上がる",     en: "rising upward" },
  { id: "diagonal",    label: "斜めに流れる",   ja: "斜めに流れる",         en: "diagonal flow" },
  { id: "wave",        label: "波打つ",         ja: "波のように揺れる",     en: "waving" },
  { id: "attract",     label: "引き寄せられる", ja: "人物に引き寄せられる", en: "attracting to subject" },
  { id: "exit",        label: "画面外へ抜ける", ja: "画面外へ抜けていく",   en: "exiting frame" },
  { id: "surround",    label: "人物を囲む",     ja: "人物の周囲を囲む",     en: "surrounding subject" },
  { id: "from_hands",  label: "手元から広がる", ja: "手元から広がる",       en: "spreading from hands" },
];

export const FG_COLORS: PresetItem[] = [
  { id: "inherit",      label: "元画像色を継承",   ja: "元画像の色調を継承",           en: "inherit source colors" },
  { id: "blue_white",   label: "青白",             ja: "青白い配色",                   en: "blue and white" },
  { id: "red_black",    label: "赤黒",             ja: "赤と黒の配色",                 en: "red and black" },
  { id: "pink_purple",  label: "ピンク紫",         ja: "ピンクと紫の配色",             en: "pink and purple" },
  { id: "cyan",         label: "シアン",           ja: "シアン色",                     en: "cyan" },
  { id: "gold",         label: "金色",             ja: "金色・ゴールド",               en: "gold" },
  { id: "white_light",  label: "白光",             ja: "白い光・ホワイトグロー",       en: "white light glow" },
  { id: "rainbow",      label: "虹色",             ja: "虹色・多色",                   en: "rainbow multicolor" },
  { id: "pastel",       label: "パステル",         ja: "パステルカラー",               en: "pastel colors" },
  { id: "monochrome",   label: "モノクロ",         ja: "モノクロ・白黒",               en: "monochrome" },
  { id: "low_sat",      label: "低彩度",           ja: "低彩度・くすんだ色",           en: "low saturation" },
  { id: "high_sat",     label: "高彩度",           ja: "高彩度・鮮やかな色",           en: "high saturation" },
  { id: "match_bg",     label: "背景色に合わせる", ja: "背景の色調に合わせる",         en: "match background color" },
  { id: "match_outfit", label: "衣装色に合わせる", ja: "衣装の色調に合わせる",         en: "match outfit color" },
];

export const FG_DEPTHS: PresetItem[] = [
  { id: "front_only",         label: "人物の手前のみ",     ja: "人物の手前のみ",           en: "in front of subject only" },
  { id: "around_subject",     label: "人物の周囲",         ja: "人物の周囲全体",           en: "around subject" },
  { id: "front_back_overlap", label: "前後に重なる",       ja: "前後に重なる奥行き",       en: "overlapping front and back" },
  { id: "shallow",            label: "浅い奥行き",         ja: "浅い奥行き",               en: "shallow depth" },
  { id: "deep",               label: "深い奥行き",         ja: "深い奥行き",               en: "deep depth" },
  { id: "bg_to_fg",           label: "背景から前景へ",     ja: "背景から前景へ流れる",     en: "flowing background to foreground" },
  { id: "bokeh_front",        label: "近景ぼかし",         ja: "カメラ手前にぼかし",       en: "bokeh in foreground" },
  { id: "near_particles",     label: "近景粒子あり",       ja: "近景に粒子",               en: "near particles" },
  { id: "far_particles",      label: "遠景粒子あり",       ja: "遠景に粒子",               en: "far particles" },
];

export const FG_VISIBILITIES: PresetItem[] = [
  { id: "face_protected",    label: "顔を絶対隠さない",   ja: "顔を完全に見せる（最優先）",           en: "face always fully visible" },
  { id: "eyes_protected",    label: "目を絶対隠さない",   ja: "目・瞳を完全に見せる",                 en: "eyes always visible" },
  { id: "outline_enhanced",  label: "人物輪郭を強調",     ja: "人物の輪郭を強調する",                 en: "enhance subject outline" },
  { id: "subtle_face",       label: "顔まわりは控えめ",   ja: "顔まわりのエフェクトを控えめに",       en: "subtle near face" },
  { id: "strong_bg",         label: "背景側を強め",       ja: "背景側のエフェクトを強める",           en: "stronger in background" },
  { id: "emphasize_hands",   label: "手元を強調",         ja: "手元のエフェクトを強調",               en: "emphasize at hands" },
  { id: "emphasize_edges",   label: "画面端を強調",       ja: "画面端のエフェクトを強調",             en: "emphasize at screen edges" },
  { id: "subtle_center",     label: "中央は控えめ",       ja: "中央部分のエフェクトを控えめに",       en: "subtle at center" },
];

/* ---------------- VEHICLE ---------------- */

export const VEHICLE_GENRES: PresetItem[] = [
  { id: "land",             label: "陸上",           ja: "陸上の乗り物",                     en: "land vehicle" },
  { id: "air",              label: "空中",           ja: "空中の乗り物",                     en: "aerial vehicle" },
  { id: "sea",              label: "海上",           ja: "海上の乗り物",                     en: "sea vehicle" },
  { id: "space",            label: "宇宙",           ja: "宇宙船・ロケット",                 en: "space vehicle" },
  { id: "amusement",        label: "遊具・観光",     ja: "遊園地・観光系の乗り物",           en: "amusement / leisure vehicle" },
  { id: "historical",       label: "歴史系",         ja: "歴史的な乗り物",                   en: "historical vehicle" },
  { id: "near_future",      label: "近未来",         ja: "近未来の乗り物",                   en: "near-future vehicle" },
  { id: "fictional_mech",   label: "架空メカ",       ja: "架空の巨大メカ・要塞",             en: "fictional mech / fortress" },
  { id: "robot",            label: "ロボット",       ja: "搭乗型ロボット・メカスーツ",       en: "rideable robot / mech suit" },
  { id: "military_display", label: "ミリタリー展示", ja: "展示・静止状態のミリタリー車両",   en: "military vehicle (display only)" },
  { id: "fantasy",          label: "ファンタジー",   ja: "ファンタジー系の乗り物・生物",     en: "fantasy creature / vehicle" },
];

export const VEHICLE_TYPES: PresetItem[] = [
  // 陸
  { id: "bicycle",               label: "自転車",           ja: "スタイリッシュな自転車",               en: "stylish bicycle" },
  { id: "motorcycle",            label: "バイク",           ja: "バイク（大型バイク）",                 en: "motorcycle" },
  { id: "scooter",               label: "スクーター",       ja: "カラフルなスクーター",                 en: "colorful scooter" },
  { id: "sports_car",            label: "スポーツカー",     ja: "スポーツカー",                         en: "sports car" },
  { id: "classic_car",           label: "クラシックカー",   ja: "クラシックカー（ビンテージ車）",       en: "classic vintage car" },
  { id: "vintage_car",           label: "ヴィンテージカー", ja: "1950〜60年代のヴィンテージカー",       en: "1950s–60s vintage car" },
  { id: "limousine",             label: "リムジン",         ja: "高級リムジン",                         en: "luxury limousine" },
  { id: "jeep",                  label: "ジープ",           ja: "アドベンチャー系ジープ・SUV",          en: "adventure jeep / SUV" },
  { id: "train",                 label: "電車・列車",       ja: "電車・列車（駅ホームや線路）",         en: "train / locomotive" },
  { id: "bus",                   label: "バス",             ja: "ヴィンテージバス・二階建てバス",       en: "vintage / double-decker bus" },
  { id: "tuk_tuk",               label: "トゥクトゥク",     ja: "カラフルなトゥクトゥク",               en: "colorful tuk-tuk" },
  // 空
  { id: "fighter_jet",           label: "戦闘機",           ja: "戦闘機（展示・背景）",                 en: "fighter jet (display / background)" },
  { id: "small_plane",           label: "小型飛行機",       ja: "小型プロペラ機",                       en: "small propeller plane" },
  { id: "helicopter",            label: "ヘリコプター",     ja: "ヘリコプター",                         en: "helicopter" },
  { id: "hot_air_balloon",       label: "熱気球",           ja: "カラフルな熱気球",                     en: "colorful hot air balloon" },
  { id: "glider",                label: "グライダー",       ja: "優雅なグライダー",                     en: "elegant glider" },
  { id: "drone",                 label: "ドローン",         ja: "近未来的なドローン",                   en: "futuristic drone" },
  { id: "blimp",                 label: "飛行船",           ja: "レトロな飛行船・ツェッペリン",         en: "retro airship / blimp" },
  // 海
  { id: "yacht",                 label: "ヨット",           ja: "白帆のヨット",                         en: "sailing yacht" },
  { id: "motor_boat",            label: "モーターボート",   ja: "スピードボート",                       en: "speed motorboat" },
  { id: "cruiser",               label: "クルーザー",       ja: "高級クルーザー",                       en: "luxury cruiser" },
  { id: "sailing_ship",          label: "帆船",             ja: "大型帆船（海賊船・探検船風）",         en: "tall sailing ship" },
  { id: "rowboat",               label: "ボート",           ja: "小さな木製ボート",                     en: "small wooden rowboat" },
  // 宇宙
  { id: "spaceship",             label: "宇宙船",           ja: "洗練された宇宙船",                     en: "sleek spaceship" },
  { id: "rocket",                label: "ロケット",         ja: "打ち上げロケット",                     en: "launch rocket" },
  { id: "space_station",         label: "宇宙ステーション", ja: "宇宙ステーションの一部",               en: "space station" },
  // 遊具
  { id: "merry_go_round",        label: "メリーゴーランド", ja: "装飾豊かなメリーゴーランド",           en: "ornate merry-go-round" },
  { id: "miniature_train",       label: "豆汽車",           ja: "可愛らしいミニチュア汽車",             en: "cute miniature train" },
  { id: "gondola",               label: "ゴンドラ",         ja: "ベネチアのゴンドラ・観光船",           en: "Venetian gondola" },
  { id: "carousel_horse",        label: "メリーゴーランドの馬", ja: "カラフルなメリーゴーランドの馬（停止）", en: "carousel horse" },
  // 歴史系
  { id: "horse_carriage",        label: "馬車",             ja: "優雅な馬車（馬なし・背景）",           en: "elegant horse carriage" },
  { id: "rickshaw",              label: "人力車",           ja: "和風人力車",                           en: "traditional rickshaw" },
  { id: "galleon",               label: "ガレオン船",       ja: "大型ガレオン船（背景・遠景）",         en: "large galleon ship" },
  { id: "steam_locomotive",      label: "蒸気機関車",       ja: "蒸気機関車・レトロな汽車",             en: "steam locomotive" },
  { id: "roman_chariot",         label: "古代戦車",         ja: "古代ローマ風の戦闘馬車（展示）",       en: "ancient Roman chariot (display)" },
  // 近未来
  { id: "hover_bike",            label: "ホバーバイク",     ja: "空中浮遊バイク（近未来）",             en: "hovering futuristic bike" },
  { id: "capsule_car",           label: "カプセルカー",     ja: "透明カプセル型の自動運転車",           en: "transparent capsule autonomous car" },
  { id: "maglev_train",          label: "磁気浮上列車",     ja: "磁気浮上式リニア列車",                 en: "maglev linear train" },
  { id: "flying_car",            label: "フライングカー",   ja: "透明翼付きフライングカー",             en: "transparent-winged flying car" },
  { id: "jet_pack_suit",         label: "ジェットスーツ",   ja: "ジェットパック搭載スーツ（着用中）",   en: "jet-pack suit" },
  // 架空メカ
  { id: "sky_fortress",          label: "空中要塞",         ja: "巨大な空中要塞（背景）",               en: "giant sky fortress (background)" },
  { id: "giant_mech",            label: "巨大メカ",         ja: "巨大人型メカロボット（背景）",         en: "giant humanoid mech (background)" },
  { id: "transformation_mech",   label: "変形メカ",         ja: "変形合体メカ（オリジナルデザイン）",   en: "original transforming mech design" },
  // ロボット
  { id: "cockpit_robot",         label: "コックピットロボット", ja: "搭乗型ロボットのコックピット",     en: "rideable robot cockpit" },
  { id: "mech_suit",             label: "メカスーツ",       ja: "小型パワードスーツ・メカスーツ",       en: "powered mech suit" },
  { id: "walker_mech",           label: "歩行メカ",         ja: "二足歩行型小型メカ",                   en: "bipedal walker mech" },
  // ミリタリー（展示のみ）
  { id: "armored_vehicle_display", label: "装甲車（展示）", ja: "博物館・展示場の装甲車（停止状態）",   en: "armored vehicle on display (static)" },
  { id: "tank_display",          label: "戦車（展示）",     ja: "博物館・公園の戦車（展示・停止状態）", en: "tank on public display (static)" },
  // ファンタジー
  { id: "dragon",                label: "ドラゴン",         ja: "巨大ドラゴン（背景または騎乗）",       en: "giant dragon (background or ridden)" },
  { id: "pegasus",               label: "天馬",             ja: "白い翼を持つ天馬（背景または騎乗）",   en: "winged pegasus (background or ridden)" },
  { id: "magic_carpet",          label: "魔法の絨毯",       ja: "空飛ぶ魔法の絨毯",                     en: "flying magic carpet" },
  { id: "giant_turtle",          label: "巨大亀",           ja: "神秘的な巨大亀（背景または騎乗）",     en: "giant mystical turtle" },
  { id: "sky_whale",             label: "空中クジラ",       ja: "空を泳ぐ巨大クジラ（背景）",           en: "giant sky whale (background)" },
  { id: "flying_island",         label: "空飛ぶ島",         ja: "宙に浮かぶ島・空中島",                 en: "floating sky island" },
];

export const VEHICLE_INTERACTIONS: PresetItem[] = [
  { id: "riding",          label: "乗っている",       ja: "乗り物に乗っている・操縦している",           en: "riding / piloting" },
  { id: "sitting_on",      label: "座っている",       ja: "乗り物の上・座席に座っている",               en: "sitting on it" },
  { id: "standing_beside", label: "横に立つ",         ja: "乗り物の横に立っている",                     en: "standing beside it" },
  { id: "leaning_on",      label: "寄りかかる",       ja: "乗り物に寄りかかっている",                   en: "leaning against it" },
  { id: "in_background",   label: "中景に置く",       ja: "人物の後方・中景に乗り物を配置",             en: "placed in midground background" },
  { id: "far_background",  label: "遠景に置く",       ja: "人物の遠景に小さく乗り物を配置",             en: "placed in far background" },
  { id: "through_window",  label: "窓越し",           ja: "窓越しに乗り物が見える（人物は室内または乗り物内）", en: "seen through a window" },
  { id: "shadow_only",     label: "影だけ",           ja: "乗り物の影だけが地面・壁に落ちている",       en: "only its shadow visible" },
  { id: "reflection_only", label: "反射だけ",         ja: "乗り物が水面・鏡面に反射して映っている",     en: "reflected in a surface" },
  { id: "giant_backdrop",  label: "巨大背景として",   ja: "乗り物全体が巨大な背景・舞台として機能",     en: "serving as a giant backdrop" },
];

export const VEHICLE_ERAS: PresetItem[] = [
  { id: "modern",       label: "現代",           ja: "現代的なデザイン",                 en: "modern design" },
  { id: "retro",        label: "レトロ",         ja: "レトロ・ビンテージ感（50〜80年代）", en: "retro vintage (50s–80s)" },
  { id: "near_future",  label: "近未来",         ja: "10〜30年後の近未来感",             en: "near-future (10–30 years ahead)" },
  { id: "far_future",   label: "遠未来",         ja: "数百年後の先進的な未来感",         en: "far future (centuries ahead)" },
  { id: "historical",   label: "歴史的",         ja: "歴史的・古代〜中世のデザイン",     en: "historical / ancient to medieval" },
  { id: "fantasy",      label: "ファンタジー",   ja: "魔法・ファンタジー世界観",         en: "magical fantasy world" },
  { id: "steampunk",    label: "スチームパンク", ja: "蒸気機関・スチームパンク美学",     en: "steampunk aesthetic" },
];

export const VEHICLE_MATERIALS: PresetItem[] = [
  { id: "metal",        label: "金属",           ja: "金属製・スチール感",               en: "metallic steel" },
  { id: "chrome",       label: "クローム",       ja: "鏡面クロームメッキ",               en: "chrome mirror finish" },
  { id: "matte_metal",  label: "マットメタル",   ja: "マットメタル（光沢抑えた金属）",   en: "matte metal" },
  { id: "transparent",  label: "透明素材",       ja: "透明・クリスタルガラス素材",       en: "transparent crystal glass" },
  { id: "carbon",       label: "カーボン",       ja: "カーボンファイバー（格子模様）",   en: "carbon fiber" },
  { id: "rust_vintage", label: "サビ・古色",     ja: "サビ・経年劣化のある古びた質感",   en: "rusted vintage worn texture" },
  { id: "wood",         label: "木材",           ja: "木材・ウッド素材",                 en: "natural wood material" },
  { id: "glowing",      label: "発光素材",       ja: "発光する素材・ネオン光沢",         en: "glowing neon material" },
  { id: "organic",      label: "有機素材",       ja: "生体的・有機的な素材感",           en: "organic / bio material" },
  { id: "crystal",      label: "クリスタル",     ja: "結晶・宝石のような透明素材",       en: "crystal gemstone-like" },
];

export const VEHICLE_ATMOSPHERES: PresetItem[] = [
  { id: "cool",       label: "クール",         ja: "クール・スタイリッシュ",                 en: "cool stylish" },
  { id: "cute",       label: "かわいい",       ja: "かわいい・ポップ",                       en: "cute pop" },
  { id: "pop",        label: "ポップ",         ja: "カラフルでポップな雰囲気",               en: "colorful pop vibe" },
  { id: "dark",       label: "ダーク",         ja: "ダーク・神秘的な雰囲気",                 en: "dark mysterious" },
  { id: "elegant",    label: "エレガント",     ja: "エレガント・上品な雰囲気",               en: "elegant refined" },
  { id: "luxury",     label: "ラグジュアリー", ja: "高級感・ラグジュアリーな雰囲気",         en: "luxury high-end" },
  { id: "adventure",  label: "アドベンチャー", ja: "冒険・旅・探検の雰囲気",                 en: "adventure exploration" },
  { id: "cinematic",  label: "映画的",         ja: "映画ポスター風の映画的な演出",           en: "cinematic movie-poster" },
  { id: "serene",     label: "静謐",           ja: "静かで穏やかな、詩的な雰囲気",           en: "serene peaceful poetic" },
];

/* ---------------- MYTH / MYTHICAL CREATURE ---------------- */

export const MYTH_REGIONS: PresetItem[] = [
  { id: "japanese",        label: "日本神話",       ja: "日本神話・和の神獣（龍・鳳凰・狛犬等）",         en: "Japanese mythology" },
  { id: "chinese",         label: "中国神話",       ja: "中国神話・東洋神獣（四神・麒麟等）",             en: "Chinese mythology" },
  { id: "egyptian",        label: "エジプト神話",   ja: "エジプト神話（バステト・アヌビス・ラー等）",     en: "Egyptian mythology" },
  { id: "greek",           label: "ギリシャ神話",   ja: "ギリシャ神話（ペガサス・ゴルゴン・グリフィン等）",en: "Greek mythology" },
  { id: "norse",           label: "北欧神話",       ja: "北欧神話（フェンリル・ヴァルキリー・ユグドラシル等）", en: "Norse mythology" },
  { id: "celtic",          label: "ケルト神話",     ja: "ケルト神話（バンシー・プーカ・グリーンドラゴン等）",  en: "Celtic mythology" },
  { id: "indian",          label: "インド神話",     ja: "インド神話（ガルーダ・ナーガ・デーヴァ等）",     en: "Indian mythology" },
  { id: "middle_east",     label: "中東・アラビア", ja: "中東神話（ロック・シームルグ・ジン等）",         en: "Middle Eastern mythology" },
  { id: "western_fantasy", label: "西洋ファンタジー",ja: "西洋ファンタジー独自の幻獣（ドラゴン・ユニコーン・フェニックス等）", en: "Western fantasy creatures" },
  { id: "oceanic",         label: "海洋・南島神話", ja: "南太平洋・海洋神話（タニファ・タンガロア等）",   en: "Oceanic mythology" },
  { id: "world_mix",       label: "世界ミックス",   ja: "複数文化の神話要素を混合したオリジナル幻獣",     en: "world mythology mix" },
];

export const MYTH_CREATURES: PresetItem[] = [
  { id: "divine_beast",  label: "神獣",         ja: "神の使いとされる聖なる獣（鳳凰・麒麟・白虎等）",   en: "divine sacred beast" },
  { id: "guardian",      label: "守護者",       ja: "場所や人を守護する守り神的な存在",                 en: "guardian deity beast" },
  { id: "dragon",        label: "龍・竜",       ja: "龍・東洋竜・西洋ドラゴン等の龍族",               en: "dragon / wyvern" },
  { id: "bird",          label: "霊鳥",         ja: "鳳凰・ロック・シームルグ・天の鳥",               en: "mythical bird (phoenix, roc)" },
  { id: "serpent",       label: "大蛇・蛇神",   ja: "大蛇・ナーガ・ジョルムンガンド等の蛇神族",       en: "great serpent / naga" },
  { id: "wolf",          label: "霊狼",         ja: "神話の狼（フェンリル・おおかみ神等）",           en: "mythical wolf" },
  { id: "cat",           label: "霊猫",         ja: "神話の猫・猫神（バステト・猫又等）",             en: "mythical cat deity" },
  { id: "giant",         label: "巨人・神",     ja: "巨人・神・デーヴァなど大型の神話的存在",         en: "giant / titan / deity" },
  { id: "spirit",        label: "精霊",         ja: "自然に宿る精霊・妖精・ニンフ等",                 en: "spirit / fairy / nymph" },
  { id: "phantom_beast", label: "幻獣",         ja: "ユニコーン・グリフィン・キメラ等の架空生物",     en: "phantom beast (unicorn, griffin)" },
  { id: "god",           label: "神格",         ja: "神そのもの・神化した存在（オリジナルデザイン）", en: "god / deity (original design)" },
  { id: "demigod",       label: "半神",         ja: "人と神の中間・半神半人の存在",                   en: "demigod / half-divine being" },
  { id: "mech_myth",     label: "機械神",       ja: "機械と神話が融合した未来的な神獣",               en: "mechanical myth / cyber deity" },
  { id: "future_myth",   label: "未来幻獣",     ja: "SFと神話が融合した近未来的な幻獣",               en: "sci-fi mythical creature" },
];

export const MYTH_INTERACTIONS: PresetItem[] = [
  { id: "bg_giant",       label: "背景に巨大配置",   ja: "幻獣を画面奥に巨大な背景として配置",             en: "placed as giant background element" },
  { id: "far_distance",   label: "遠景に小さく",     ja: "遠景に小さく幻獣が見える（神秘感を演出）",       en: "small silhouette in far distance" },
  { id: "behind_subject", label: "被写体の後ろに",   ja: "人物の真後ろに幻獣が佇む",                       en: "looming behind the subject" },
  { id: "surrounding",    label: "取り囲む",         ja: "幻獣が人物を包み込むように取り囲む",             en: "surrounding / encircling the subject" },
  { id: "on_shoulder",    label: "肩に乗る",         ja: "小型の幻獣が肩に乗っている",                     en: "perched on shoulder (small creature)" },
  { id: "standing_beside",label: "横に並ぶ",         ja: "幻獣が人物の横に並んで立つ",                     en: "standing alongside the subject" },
  { id: "guarding",       label: "護衛している",     ja: "幻獣が人物を守護・護衛するように配置",           en: "guarding / protecting the subject" },
  { id: "flying_above",   label: "上空を飛翔",       ja: "幻獣が頭上を舞い飛ぶ",                           en: "soaring overhead" },
  { id: "looking_down",   label: "見下ろす",         ja: "巨大な幻獣が上方から人物を見下ろす",             en: "giant creature looking down at subject" },
  { id: "riding",         label: "騎乗する",         ja: "人物が幻獣に騎乗している",                       en: "riding the creature" },
  { id: "summoning",      label: "召喚する",         ja: "人物が幻獣を召喚・顕現させている瞬間",           en: "summoning / materializing the creature" },
  { id: "silhouette_only",label: "シルエットのみ",   ja: "幻獣のシルエットだけが背景に浮かび上がる",       en: "creature silhouette only" },
  { id: "shadow_only",    label: "影だけ",           ja: "幻獣の影だけが地面・壁に落ちている",             en: "only the shadow of the creature" },
  { id: "glow_aura_only", label: "光のオーラのみ",   ja: "幻獣の形は見えず、神々しい光のオーラだけが漂う", en: "only glowing aura / divine light remains" },
  { id: "partial_reveal", label: "一部だけ見える",   ja: "幻獣の翼・爪・尾等の一部だけが画面に入る",       en: "only a part (wing, claw, tail) visible" },
];

export const MYTH_STYLES: PresetItem[] = [
  { id: "realistic",   label: "リアル",           ja: "写真的なリアルな質感で幻獣を描写",                       en: "photorealistic creature" },
  { id: "fantasy",     label: "ファンタジー",     ja: "ファンタジーイラスト風の幻獣（光・煙・魔法エフェクト）", en: "fantasy illustration style" },
  { id: "cinematic",   label: "映画的",           ja: "映画特撮風の重厚な幻獣描写",                             en: "cinematic blockbuster style" },
  { id: "anime",       label: "アニメ調",         ja: "アニメ・イラスト調のデザイン",                           en: "anime illustration style" },
  { id: "mystic",      label: "神秘的",           ja: "霧・光・半透明で神秘的に表現",                           en: "mystical ethereal appearance" },
  { id: "dark",        label: "ダーク",           ja: "ダーク・ゴシック・禍々しい雰囲気",                       en: "dark gothic ominous" },
  { id: "luxury",      label: "高級感",           ja: "黄金・宝石・白金で装飾した豪華な幻獣",                   en: "luxurious golden jeweled beast" },
  { id: "art",         label: "アート系",         ja: "現代アート・前衛的な表現スタイル",                       en: "contemporary art style" },
  { id: "near_future", label: "近未来",           ja: "SF・近未来技術と神話が融合したスタイル",                 en: "near-future sci-fi mythology" },
  { id: "wa_modern",   label: "和モダン",         ja: "和の伝統と現代的なデザインを融合",                       en: "Japanese modern fusion" },
  { id: "epic",        label: "エピック",         ja: "壮大・叙事詩的な迫力あるスタイル",                       en: "epic grand scale" },
  { id: "ad_visual",   label: "広告ビジュアル",   ja: "商業広告・ビジュアルデザイン風",                         en: "advertising visual style" },
];

export const MYTH_SIZES: PresetItem[] = [
  { id: "small",         label: "小型",           ja: "手のひらサイズの小さな幻獣",                     en: "small palm-sized creature" },
  { id: "shoulder_size", label: "肩乗りサイズ",   ja: "肩に乗る程度の中小型幻獣",                       en: "shoulder-perching size" },
  { id: "human_size",    label: "人間と同サイズ", ja: "人間と同程度の大きさ",                           en: "human-sized creature" },
  { id: "giant",         label: "大型",           ja: "人間の数倍の大型幻獣",                           en: "giant (several times human height)" },
  { id: "colossal",      label: "超大型",         ja: "建物・山ほどの超巨大幻獣",                       en: "colossal building-scale creature" },
  { id: "sky_filling",   label: "空を覆う",       ja: "空全体を覆い尽くすほど巨大",                     en: "sky-filling enormous beast" },
  { id: "distant_giant", label: "遠景の巨人",     ja: "遥か遠くにそびえ立つ巨大な存在",                 en: "towering giant visible only in distance" },
];

/* ---------------- Utility ---------------- */

export function findPreset(arr: PresetItem[], id: string): PresetItem | undefined {
  return arr.find((p) => p.id === id);
}
