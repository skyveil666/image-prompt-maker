/**
 * Builds the system + user prompts sent to OpenAI for each generation.
 * The LLM produces the final user-facing prompts; this module shapes the
 * constraints (scope locks, safety, mood, pinned details, variation rules).
 */
import type {
  ArtStyle,
  Camera3DState,
  ColorStrategy,
  DetailSettings,
  Era,
  Expression,
  GenerateRequest,
  LockKey,
  Mood,
  PromptTarget,
  Scope,
} from "./types.ts";
import type { BatchPlan } from "./varietyEngine.ts";
import { varietyBlock } from "./varietyEngine.ts";
import type { SubStylePlan } from "./outfitSubStyles.ts";
import { subStyleBlock } from "./outfitSubStyles.ts";

/**
 * Camera3DState（3Dピッカー指定）を自然言語化する。
 * lib/cameraAngle.ts と同等のロジック（サーバ独立で持つ）。
 */
function describeCustom3D(c: Camera3DState): string {
  const parts: string[] = [];
  const yawN = (((c.yaw % 360) + 540) % 360) - 180;
  const yawAbs = Math.abs(yawN);
  if (yawAbs < 8) parts.push("正面構図");
  else if (yawAbs >= 170) parts.push("背面構図");
  else if (yawAbs > 80 && yawAbs < 100)
    parts.push(yawN > 0 ? "右側からの真横（横顔）" : "左側からの真横（横顔）");
  else if (yawN > 0) parts.push(`右斜め${Math.round(yawAbs)}度`);
  else parts.push(`左斜め${Math.round(yawAbs)}度`);

  if (c.pitch > 55) parts.push("真上からの俯瞰");
  else if (c.pitch > 15) parts.push(`ハイアングル（${Math.round(c.pitch)}度見下ろし）`);
  else if (c.pitch < -55) parts.push("極端なローアングル");
  else if (c.pitch < -15) parts.push(`ローアングル（${Math.round(Math.abs(c.pitch))}度あおり）`);
  else parts.push("ほぼ水平視点");

  if (Math.abs(c.roll) > 5) {
    parts.push(
      `ダッチアングル（${c.roll > 0 ? "右" : "左"}に${Math.round(Math.abs(c.roll))}度傾ける）`
    );
  }

  const compMap: Record<Camera3DState["composition"], string> = {
    face: "顔アップ構図",
    bust: "バストアップ構図",
    waist: "腰までの構図",
    full: "全身構図",
    wide: "引きの広角構図",
  };
  parts.push(compMap[c.composition]);
  return parts.join("、") + "。";
}

const SCOPE_JA: Record<Scope, string> = {
  background: "背景",
  foreground: "前景演出",
  pose: "ポーズ",
  hair: "髪型",
  outfit: "衣装",
  cosplay: "コスプレ",
  cyber: "機械化・サイボーグ化",
  camera: "カメラアングル",
  props: "持ち物・小物",
  big_object: "大物・大道具",
  vehicle: "乗り物",
  myth: "神話/幻獣",
  lighting: "ライティング",
  aspect_ratio: "アスペクト比",
};

// 顔・表情・同一性は faceLockBlock + Identity Shield が保護するため LOCK_JA に含めない。
// 参照: docs/09_face-lock統合.md
const LOCK_JA: Record<LockKey, string> = {
  body_shape: "体型",
  color: "色味",
  camera: "カメラ位置",
  aspect_ratio: "アスペクト比",
};

const MOOD_JA: Record<Mood, string> = {
  cool: "クールで洗練された質感",
  digital: "微細なデジタル質感、抽象的な構造",
  preserve_bg_color: "元画像の色温度・色相を主軸に再解釈",
  minimal: "極端に整理されたミニマル構成",
  japanese: "和の様式美、墨・余白・自然素材",
  glitch: "意図的なグリッチ／走査線（背景側のみ）",
  fantasy: "幻想的な大気、淡い粒子と非現実的な遠景",
  sns_pop: "SNS映えする視認性、整ったレイアウト",
  bright: "明るく軽快な高明度",
  dark: "深いダーク基調、低照度の重厚感",
  cyberpunk: "サイバーパンク美学：電子的・退廃的・工業的な質感、ネオン色彩と発光感（背景ロケーションは別途指定がない限り自由）",
  gothic: "ゴシック、黒・赤・退廃的なエレガンス",
  translucent: "透明感のある質感、ガラス・水・氷の透過",
  luxe: "高級感、ブランド広告のような質感",
  cute: "かわいい、ふんわり優しい色彩",
  stylish: "かっこいい、キレのある決め画作り",
  emo: "エモい、湿度のある哀愁とノスタルジー",
  cinematic: "映画的なライティングと構図",
  near_future: "近未来、整然としたテクノロジー感",
  retro: "レトロ、フィルム粒子と昭和〜80年代の色味",
  pop: "ポップ、原色とリズミカルな構成",
  monochrome: "モノクロ、明度のみで構成",
  pastel: "パステル、淡いミルキーカラー",
  vivid: "ビビッド、彩度高めの強い色",
  mystic: "神秘的、霧と光柱、儀式性",
  decadent: "退廃的、朽ちる美と濃い陰影",
  street: "ストリート、都市的なエッジィさ",
  art: "アート系、現代美術的な抽象性",
  fantasy_world: "中世〜魔法的なファンタジー世界観",
  noisy: "ノイズ強め、フィルムノイズと粗いテクスチャ",
  portrait: "ポートレート映え、顔・表情を主役にした構図と繊細な光",
  wa_fantasy: "和の幻想、桜・霧・神社・狐火などの和風ファンタジー",
  tiktok: "TikTok映え、縦動画向けの強い対比とポップな演出",
  instagram: "Instagram映え、柔らかい光と洗練された美的レイアウト",
  pinterest: "Pinterest映え、ムードボードのような整然とした洗練ビジュアル",
  x_buzz: "X（Twitter）バズ向け、インパクト重視の強烈なビジュアル",
  trend_2026: "2026年トレンド、最新のSNS・ファッション・AIアート傾向を反映",
  // ── 基本 追加 ──────────────────────────────────────────────────
  clean:      "清潔感あふれる白・シルバー・光の整合性、高純度で澄んだ印象",
  heavy:      "重厚感のある質感、深い影と濃いコントラスト、どっしりとした存在感",
  ephemeral:  "儚い美しさ、散り際・消えゆく瞬間・薄明光の繊細さと無常感",
  // ── 世界観 追加 ─────────────────────────────────────────────────
  contemporary: "コンテンポラリーアート的表現、現代美術館の静謐さと知的な空間性",
  architectural: "建築的なシャープさ、構造美・直線の強調・空間の対称性と幾何学",
  urban_fantasy: "都市幻想、現代的なビルや街並みと幻想的な要素が溶け合う世界観",
  retro_future: "レトロ未来（スペースエイジ・アトムパンク）、1950〜80年代SF的未来観",
  // ── 演出 追加 ──────────────────────────────────────────────────
  reflection_rich: "反射多め演出、水面・鏡面・ガラス・濡れた路面への映り込みを積極活用",
  whitespace:  "余白を大胆に活用、被写体と空白のバランスを意識した息を吸えるような構図",
  ad_visual:   "広告ビジュアル的なクリーンさと訴求力、商業写真・ブランドキャンペーン的完成度",
  magazine_cover: "雑誌表紙風の構図と色調、タイトルスペースを意識した洗練されたレイアウト",
  movie_poster: "映画ポスター風の劇的な構図とライティング、タイトル配置を想定した余白と対比",
  // ── SNS最適化 追加 ──────────────────────────────────────────────
  thumbnail_pop: "YouTube・動画サムネ映え、強い対比と明確なメインビジュアル・視線誘導",
  scroll_stop: "スクロールが止まるインパクト、最初の一瞬で目を引く構図・色・驚きの要素",
  icon_pop:    "SNSアイコン・プロフィール画像映え、中央寄りでクリーンな顔と背景の対比",
  // ── 反射 新カテゴリ ─────────────────────────────────────────────
  refl_water:     "水面反射、静かな水鏡に映り込む幻想的な倒映で奥行きと詩情を出す",
  refl_glass:     "ガラス反射、透明なガラス面に映る半透明の映り込みと透過の重なり",
  refl_mirror:    "鏡面反射、完全な鏡面への映り込みと対称的な構図で非現実感を演出",
  refl_metal:     "金属反射、磨かれた金属面に映る歪んだ映り込みとハイライトの輝き",
  refl_wet_floor: "濡れた床への反射、雨上がり・夜の街・照明が地面に映る艶やかな演出",
  refl_car_window: "車窓の反射、窓ガラスに映り込む風景と室内の重なりで旅情・都市感を出す",
  // ── 空気感 新カテゴリ ────────────────────────────────────────────
  air_fog:           "霧に包まれた神秘的な空気感、輪郭がぼやけ距離感が消える幻想的な空間",
  air_smoke:         "煙が漂う空間、ヴェールのような白煙・青煙・紫煙が雰囲気を作る演出",
  air_after_rain:    "雨上がりの澄んだ空気感、濡れた地面と清涼感・土の香りを感じる清潔さ",
  air_dust:          "粉塵・塵が舞う空気感、光の筋がホコリに反射する神聖または荒廃的な表現",
  air_light_particles: "光の粒子が漂う空気感、花粉・光沢の粒・ほこりが空中に浮かぶ幻想演出",
  air_humid:         "湿度感のある重たい空気感、夏の熱帯夜や温室のような肌にまとわりつく湿気",
  air_cold:          "冷たい空気感、吐く息が白く見えるような冷涼感と鮮明さ・凛とした張り",
  // ── 色調 新カテゴリ ─────────────────────────────────────────────
  grade_cinema:   "映画的カラーグレーディング、ティール＆オレンジ・グリーンシャドウ系の対比",
  grade_ad:       "広告カラーグレーディング、明度高め・彩度均一・肌色を美しく保つクリーンな色調",
  grade_low_sat:  "低彩度グレーディング、色を抑えたシネマライクな落ち着いた脱色気味の色調",
  grade_high_sat: "高彩度グレーディング、フィルム的な鮮烈な色の豊かさ・ビビッドな色彩爆発",
  grade_blue:     "青みのかかった色調整、全体を寒色系にシフトした冷たく美しいブルートーン",
  grade_red:      "赤みのかかった色調整、全体を暖色系にシフトした情熱的なレッドトーン",
  grade_white:    "白基調グレーディング、白・ホワイト・クリームを基調にした清潔で明るい色調",
  grade_black:    "黒基調グレーディング、黒・チャコール・ダークトーンを基調にした重厚感ある色調",
  // ── 空間 新カテゴリ ─────────────────────────────────────────────
  venue_wide:      "広大な空間・引きの広角感、人物が空間に包まれる解放感のある構図",
  venue_narrow:    "狭い空間・圧迫感・密室感、壁が近く親密・緊張感のある閉鎖空間",
  venue_gallery:   "展示空間・ホワイトキューブ・美術館的な白い静謐な空間背景",
  venue_hotel:     "高級ホテル・ロビー・客室・ラグジュアリーな室内インテリア空間",
  venue_greenhouse: "温室・植物に囲まれたガラス建築・植物園的な緑と光に満ちた空間",
  venue_station:   "駅・プラットホーム・電車の旅情・鉄道的な空間と旅立ちの雰囲気",
  venue_rooftop:   "都市の屋上・スカイライン・夜景を背景にした開放感と高さの演出",
  venue_glass:     "全面ガラス建築・光が透過する透明感ある空間・ガラス天井・ガラス壁",
  venue_abstract:  "抽象的な空間・現実に存在しない夢のような非具体的・概念的な背景",
};

/**
 * カテゴリ名 → そのカテゴリに含まれる雰囲気の日本語ラベル一覧。
 * autoMoodCategories（おまかせ選択）のプロンプト生成に使用。
 */
const MOOD_GROUPS_SERVER: Record<string, string[]> = {
  "基本":       ["クール", "かわいい", "かっこいい", "エモい", "明るめ", "ダーク", "清潔感", "重厚感", "儚い"],
  "世界観":     ["近未来", "サイバーパンク", "和風", "ゴシック", "幻想的", "ファンタジー", "レトロ", "和ファンタジー", "現代美術", "建築的", "都市幻想", "レトロ未来"],
  "演出":       ["SNS映え", "映画風", "グリッチ", "ノイズ強め", "透明感", "デジタル", "元背景色活かす", "反射多め", "余白活用", "広告ビジュアル", "雑誌表紙風", "映画ポスター風"],
  "色味":       ["モノクロ", "パステル", "ビビッド", "ポップ", "神秘的", "アート系"],
  "SNS最適化":  ["ポートレート", "Instagram映え", "TikTok映え", "Pinterest映え", "Xバズ", "2026トレンド", "サムネ映え", "スクロール停止", "アイコン映え"],
  "その他":     ["ミニマル", "高級感", "退廃的", "ストリート"],
  "反射":       ["水面反射", "ガラス反射", "鏡面反射", "金属反射", "濡れた床", "車窓反射"],
  "空気感":     ["霧", "煙", "雨上がり", "粉塵", "光の粒", "湿度感", "冷たい空気"],
  "色調":       ["シネマ調", "広告調", "低彩度", "高彩度", "青み", "赤み", "白基調", "黒基調"],
  "空間":       ["広い空間", "狭い空間", "展示空間", "ホテル", "温室", "駅", "屋上", "ガラス空間", "抽象空間"],
};

// 顔・表情・人物同一性は faceLockBlock + Identity Shield（applyIdentityShield）が
// 常時保護するため、SCOPE_TO_LOCKS には含めない（lockLineJa との二重表現を排除）。
// ここに残すのは「ユーザートグルで追加固定しうる軸」= body_shape / color / camera / aspect_ratio のみ。
// 参照: docs/09_face-lock統合.md
const SCOPE_TO_LOCKS: Record<Scope, LockKey[]> = {
  background: ["body_shape", "camera", "aspect_ratio"],
  // 前景演出は人物の手前にエフェクトを重ねるだけ。体型・カメラ・比率は固定。
  foreground: ["body_shape", "camera", "aspect_ratio"],
  pose: ["color", "camera", "aspect_ratio"],
  hair: ["body_shape", "camera", "aspect_ratio"],
  outfit: ["body_shape", "camera", "aspect_ratio"],
  // コスプレは衣装・装飾のみ変更。体型・カメラは固定。
  cosplay: ["body_shape", "camera", "aspect_ratio"],
  // 機械化は一部分だけ変化。体型・ポーズ・カメラは固定。
  cyber: ["body_shape", "camera", "aspect_ratio"],
  camera: ["body_shape", "color", "aspect_ratio"],
  props: ["body_shape", "camera", "aspect_ratio"],
  // 大物は演出要素。人物が主役で大型オブジェは脇役。体型・カメラは固定。
  big_object: ["body_shape", "camera", "aspect_ratio"],
  // 乗り物は人物・ポーズ・カメラ・背景に影響しないよう、固定できるものはすべてロック。
  vehicle: ["body_shape", "camera", "aspect_ratio"],
  // 神話/幻獣は演出要素。人物・ポーズ・カメラ・衣装は固定し、幻獣のみ追加する。
  myth: ["body_shape", "camera", "aspect_ratio"],
  // ライティングは色温度・影を意図的に変えるため、color は SCOPE_TO_LOCKS に含めない。
  // ユーザーが「色味ロック」(ControlPanel) を ON にしていればその意思に従って lockLine に出る。
  lighting: ["body_shape", "camera", "aspect_ratio"],
  // アスペクト比変更時は比率のみ変更。体型・色味・カメラ位置は固定。
  aspect_ratio: ["body_shape", "color", "camera"],
};

const HAIR_LABELS = {
  length: {
    short: "ショート", bob: "ボブ", medium: "ミディアム", long: "ロング", extra_long: "超ロング",
    very_short: "ベリーショート", wolf_short: "ウルフショート", hime: "姫カット丈",
    waist_length: "腰までロング", floor_length: "床に届く超ロング", asymmetric: "アシンメトリーカット",
  },
  shape: {
    straight: "ストレート", wave: "ウェーブ", layer: "レイヤーカット",
    twintail: "ツインテール", ponytail: "ポニーテール", updo: "アップスタイル",
    hime_cut: "姫カット", wolf_cut: "ウルフカット", mash: "マッシュ",
    flare_bob: "外ハネボブ", constrict: "くびれヘア",
    half_twin: "ハーフアップツインテール", bun_twin: "お団子ツイン",
    braid_twin: "三つ編みツインテール", side_braid: "サイド三つ編み",
    braid: "編み込み", high_ponytail: "高めポニーテール", low_ponytail: "低めポニーテール",
    jellyfish: "クラゲヘア", heavy_layer: "レイヤー強め", cyber_bob: "サイバーボブ",
  },
  texture: {
    silky: "さらさら", wet: "濡れ髪", fluffy: "ふわっと", sharp: "シャープ", cyber: "サイバー風",
    semi_wet: "セミウェット", transparent: "透明感のある軽い質感",
    high_gloss: "艶強め", matte: "マット質感", airy: "エアリー",
    bundle_strand: "束感強め", glass: "ガラス質感", cyber_glow: "サイバー発光",
  },
  colorMode: {
    lock: "髪色は変更しない",
    subtle: "髪色を少しだけ変更",
    bold: "髪色を大きく変更",
    auto: "髪色は案ごとに自由に変化させてよい（固定しない）",
  },
  color: {
    inherit: "元の髪色を継承",
    black: "ブラック", brown: "ブラウン", blonde: "ブロンド", ash: "アッシュ",
    red: "レッド", pink: "ピンク", blue: "ブルー", silver: "シルバー",
    rainbow: "レインボー（インナーカラー含む）",
    black_red_mesh: "黒×赤メッシュ", black_blue_mesh: "黒×青メッシュ",
    black_purple_mesh: "黒×紫メッシュ", white_silver: "白銀", milk_tea: "ミルクティーカラー",
    teal_gradient: "青緑グラデーション", pink_gradient: "ピンクグラデーション",
    inner_color: "インナーカラー", hem_color: "裾カラー",
    neon_color: "ネオンカラー", aurora_color: "オーロラカラー", rainbow_mesh: "レインボーメッシュ",
    white: "ホワイト（純白）", purple: "パープル",
    white_aqua: "ホワイト×アクアブルーのグラデーション/メッシュ",
    black_aqua_grad: "ブラック→アクアブルーのグラデーション",
    black_teal_mesh: "黒髪にティール（青緑）のメッシュを入れた",
  },
  bangs: {
    full: "厚めの前髪", swept: "斜め前髪", airy: "シースルー前髪",
    curtain: "カーテンバング", blunt: "ぱっつん前髪", none: "前髪なし／センター分け",
    hime_bangs: "姫カット前髪", asymmetric: "アシメ前髪", center_part: "センターパート",
    face_layer: "顔周りレイヤー", antenna: "触角あり（アホ毛）", eye_cover: "目隠れ前髪",
  },
  tips: {
    natural: "自然な毛先", inner_curl: "内巻きカール", outer_curl: "外ハネカール",
    wave: "ウェーブする毛先", blunt: "切りそろえた毛先", feathered: "羽のような毛先",
    strong_wave: "強めウェーブの毛先", loose_wave: "ゆる巻きの毛先",
    random_curl: "ランダムカールの毛先", sharp: "シャープな毛先",
  },
  volume: {
    flat: "ぺたんこ", natural: "自然なボリューム", volume: "ふんわりボリューム",
    extra_volume: "強めのボリューム", low_volume: "ボリューム控えめ",
    heavy: "重みのある密なボリューム", light: "軽い動きのある質感",
    floating: "浮遊感のあるスタイル", wind: "風になびく動き",
    water_float: "水中浮遊感（重力を感じさせない）", tip_flow: "毛先だけ流れる", one_side_flow: "片側流れ（非対称）",
  },
  accessory: {
    none: "ヘアアクセサリーなし",
    hairpin: "ヘアピン", ribbon: "リボン", flower: "花のヘアアクセ",
    ears: "動物耳（猫耳・うさ耳）", headphones: "ヘッドホン",
    cap: "キャップ／帽子", circlet: "サークレット／ティアラ",
    fox_kanzashi: "狐面ミニ飾り・狐モチーフかんざし",
    metal_clip: "金属ヘアクリップ", cyber_ring: "サイバーリングアクセ",
    japanese_kanzashi: "和風かんざし", veil: "ベール", chain_accessory: "チェーンアクセ",
  },
  hairStyle: {
    modern: "現代トレンド風", korean: "韓国トレンド風", y2k: "Y2K（2000年代初頭）スタイル",
    heisei_gal: "平成ギャル風", retro: "レトロヴィンテージ", showa_idol: "昭和アイドル風カール",
    taisho_roman: "大正ロマン風", wa_gothic: "和ゴシック（和洋折衷）",
    cyberpunk: "サイバーパンク系", near_future: "近未来クリーン系",
    magical_girl: "魔法少女風", gothic_lolita: "ゴシックロリータ風",
    street: "ストリート系", anime: "アニメキャラ風（誇張表現）", doll: "ドール系",
    viral: "バズり系（SNS映えする珍しいスタイル）",
    unique: "珍しい独自スタイル（一般的でない大胆なカット）",
  },
} as const;

/** バズり系ヘアスタイルのプール（案ごとにバランスよく採用する） */
const VIRAL_HAIR_POOL = [
  "クラゲヘア",
  "姫カット",
  "三つ編みツインテール",
  "黒髪×ネオンメッシュ",
  "白銀ロング",
  "サイバーボブ",
  "ハーフツイン",
  "お団子ツイン",
  "オーロラグラデーションカラー",
  "狐面ヘアアクセ付きスタイル",
];

const CYBER_LABELS = {
  part: {
    one_arm: "片腕", both_arms: "両腕", hand: "手", finger: "指",
    shoulder: "肩", neck: "首元", back: "背中", leg: "脚", one_leg: "片脚",
    eye: "目元", cheek: "頬", hair_part: "髪の一部", outfit_part: "衣装の一部", body_part: "体の一部",
  },
  type: {
    cyborg: "サイボーグ化", robot_arm: "ロボット義手", robot_leg: "ロボット義足",
    android_armor: "アンドロイド装甲", mech_parts: "メカパーツ露出",
    cable_exposure: "ケーブル露出", glow_circuit: "発光回路",
    transparent_body: "透明外装", metal_skeleton: "金属骨格",
    hologram: "ホログラム化", digital_decomp: "デジタル分解",
    polygon_mesh: "ポリゴンメッシュ", wireframe: "ワイヤーフレーム",
    blueprint: "設計図風", cad: "CAD図面風", xray: "X線風構造",
    circuit_board: "回路基板風", glitch: "グリッチ化",
    data_stream: "データ化", nanomachine: "ナノマシン風", glass_mech: "ガラス機械化",
  },
  texture: {
    metal: "金属（シルバー）", black_metal: "黒金属", white_ceramic: "白セラミック",
    transparent_glass: "透明ガラス", carbon: "カーボンファイバー",
    chrome: "クローム（鏡面）", matte_metal: "マットメタル", gloss_metal: "光沢メタル",
    glow_material: "発光素材", translucent: "半透明素材",
  },
  glowColor: {
    blue: "青", cyan: "シアン", purple: "紫", red: "赤", pink: "ピンク",
    green: "緑", white: "白", gold: "金色", rainbow: "虹色",
  },
  intensity: {
    subtle: "控えめ（ごく一部）", normal: "普通（程よい変化）",
    strong: "強め（存在感あり）", bold: "大胆（印象的な変化）",
  },
} as const;

const COSPLAY_LABELS = {
  genre: {
    cute: "かわいい系", kakkoi: "かっこいい系", cool: "クール系", dark: "ダーク系",
    elegant: "エレガント系", transparent: "透明感系", luxury: "ラグジュアリー系",
    street: "ストリート系", idol: "アイドル系", fantasy: "ファンタジー系",
    japanese: "和風系", near_future: "近未来系", gothic: "ゴシック系",
    battle: "バトル系", magic: "魔法系", villain: "ヴィラン系", doll: "ドール系",
  },
  cuteStyle: {
    magical_girl: "魔法少女", yumekawa: "夢かわいい", ryousangata: "量産型",
    jirai: "地雷系", lolita: "ロリィタ", sweet_lolita: "スイートロリィタ",
    hime_kei: "姫系", idol_fashion: "アイドル衣装", maid_fashion: "メイド服",
    bunny_ears: "うさ耳コス", cat_ears: "猫耳コス", fairy_fashion: "妖精服",
    angel_fashion: "天使服", heavy_ribbon: "リボン盛り", star_motif: "星モチーフ",
  },
  jobGenre: {
    magical_girl: "魔法少女", mage: "魔法使い", witch: "魔女", knight: "騎士",
    princess_knight: "姫騎士", ninja: "忍者", samurai: "侍", shrine_maiden: "巫女",
    angel: "天使", demon: "ゴシック系キャラクター", fairy: "妖精", vampire: "ゴシック系ヴァンパイア",
    idol: "アイドル", maid: "メイド", military: "軍人", phantom_thief: "怪盗",
    pirate: "海賊", princess: "お姫様", queen: "女王", warrior: "戦士",
    assassin: "スパイ・エージェント系", android: "アンドロイド", hero: "ヒーロー", bride: "花嫁",
  },
  japaneseStyle: {
    shrine_maiden: "巫女", fox_shrine_maiden: "狐巫女", geisha: "芸者",
    kunoichi: "くノ一", samurai_girl: "女侍", oni_girl: "鬼女", kitsune: "狐",
    wa_lolita: "和ロリィタ", taisho_western: "大正浪漫", japanese_bride: "和装花嫁",
  },
  fantasyStyle: {
    elf: "エルフ", dark_elf: "ダークエルフ", dragon_knight: "竜騎士",
    fairy_queen: "妖精女王", sorceress: "魔術師", dark_knight: "ダーク系騎士",
    holy_knight: "聖騎士", valkyrie: "ヴァルキリー", succubus: "ミステリアスなダーク系ファンタジーキャラクター",
    angel_knight: "天使騎士", beastgirl: "獣人少女", dragon_girl: "竜人少女",
  },
  scifiStyle: {
    android: "アンドロイド", cyber_soldier: "サイバー兵士", space_captain: "宇宙艦長",
    ai_girl: "AIガール", hacker: "ハッカー", power_suit: "パワードスーツ",
    mecha_pilot: "メカパイロット", hologram_idol: "ホログラムアイドル",
    quantum_mage: "量子魔法使い", nano_warrior: "ナノマシン戦士",
  },
  darkStyle: {
    gothic_lolita: "ゴシックロリィタ", vampire: "ゴシック系ヴァンパイアキャラクター", dark_witch: "神秘的な魔女",
    death_angel: "ゴシック系の天使", cursed_knight: "ダーク系の騎士", fallen_angel: "神秘的な翼のキャラクター",
    demon_queen: "ゴシック系の女王", plague_doctor: "神秘的なペスト医師スタイル", revenant: "幻影のキャラクター",
    undead_bride: "ゴシック系の花嫁",
  },
  occupation: {
    nurse: "ナース", police: "警察", bunny_girl: "バニーモチーフコスチューム", magician: "マジシャン",
    chef: "シェフ", teacher: "先生", nun: "シスター", spy: "スパイ",
    pilot: "パイロット", cheerleader: "チアリーダー",
  },
  decoration: {
    minimal: "装飾少なめ", moderate: "ほどよい装飾", elaborate: "凝った装飾",
    maximal: "装飾最大限", armored: "鎧付き装飾",
  },
  item: {
    wand: "魔法のステッキ", staff: "魔法の杖", sword: "発光する剣型アクセサリー", shield: "盾",
    bow: "弓型アクセサリー", gun: "スタイリッシュな発光アクセサリー", book: "魔導書", potion: "ポーション",
    crown: "王冠", wings: "翼", tail: "尻尾", ears: "動物耳",
    scythe: "大鎌型アクセサリー", lantern: "ランタン", orb: "魔法球",
  },
  exposure: {
    modest: "上品なデザイン（清楚なシルエット）",
    bold:   "スタイリッシュで印象的なデザイン",
  },
  colorDir: {
    inherit: "元画像の色調を引き継ぐ", white: "白・パール系",
    black: "黒・チャコール系", red: "赤・クリムゾン系",
    blue: "青・ネイビー系", pink: "ピンク・ローズ系",
    purple: "紫・ヴァイオレット系", gold: "ゴールド・アンバー系",
    silver: "シルバー・クロム系", rainbow: "レインボー・多色配色",
  },
} as const;

const OUTFIT_LABELS = {
  style: {
    street: "ストリート", mode: "モード", cyber: "サイバー", japanese: "和風", gothic: "ゴシック",
    military: "ミリタリー", techwear: "テックウェア", dress: "ドレス", armor: "アーマー",
    y2k: "Y2K（2000年代初頭のポップスタイル）", lolita: "ロリィタ（フリルと可憐さを重視）",
    uniform: "制服（学校・職業系）", future_dress: "未来ドレス（シャープな近未来デザイン）",
    wa_modern: "和モダン（和洋折衷のモダンスタイル）", idol: "アイドル衣装（華やかなステージ系）",
    runway: "ランウェイ（ハイファッションのモデル系）",
  },
  exposure: {
    low:          "デザイン：カバレッジ多め（肌見せ控えめ）",
    normal:       "デザイン：標準シルエット",
    high:         "デザイン：スタイリッシュなシルエット（開放感あり）",
    shoulder_off: "オフショルダー（肩を出したデザイン）",
    long_sleeve:  "長袖（腕をしっかり覆う）",
    high_neck:    "ハイネック・タートルネック（首元を覆う）",
  },
  material: {
    leather: "レザー", nylon: "ナイロン", metal: "金属パーツ", transparent: "透明素材", cloth: "布", enamel: "エナメル", denim: "デニム",
    chiffon: "シフォン（軽く透け感のある薄い布）", velvet: "ベルベット（深みのある起毛素材）",
    pvc: "PVC（光沢のある透明ビニール素材）", lace: "レース（繊細な透かし模様）",
    knit: "ニット（編み物の温かみある素材）", organza: "オーガンザ（透け感のある硬めの薄布）",
    liquid_metal: "液体金属（流動感のある鏡面光沢素材）",
    crystal_glass: "クリスタルガラス（透明感と光の屈折を持つ素材）",
    neon_fabric: "ネオンファブリック（発光するネオンカラーの素材）",
  },
  color: {
    black: "黒系", white: "白系", red: "赤系", blue: "青系", green: "緑系", pink: "ピンク系", inherit: "元画像色を継承",
    purple: "パープル系", light_blue: "水色・ライトブルー系", gold: "ゴールド系", silver: "シルバー系",
    gradient: "グラデーション配色", accent_color: "差し色（アクセントカラーを入れる）",
  },
  silhouette: {
    tight: "タイト", oversized: "オーバーサイズ", minimal: "ミニマル", ornate: "装飾多め",
    a_line: "Aライン（ウエストから裾に向かって広がる）", flare: "フレア（下方向に揺れる広がり）",
    long_length: "ロング丈（床に近いマキシ丈）", short_length: "ショート丈（ミニ丈）",
    asymmetric: "アシンメトリー（左右非対称のシルエット）", layered: "レイヤード（重ね着風シルエット）",
  },
  decoration: {
    minimal: "装飾極少", moderate: "装飾ほどよく", elaborate: "凝った装飾", maximal: "装飾最大限",
    ribbon: "リボン（大きなリボン装飾）", embroidery: "刺繍（繊細な刺繍装飾）",
    rhinestone: "ラインストーン（キラキラビジュー装飾）",
    chain_decor: "チェーン（金属チェーン装飾）", frill: "フリル（重なるフリル装飾）",
  },
  season: {
    spring: "春", summer: "夏", autumn: "秋", winter: "冬", seasonless: "季節感なし",
    rainy_season: "梅雨（雨・しっとり感）", midsummer: "真夏（強い陽射し・涼しさ）",
    late_autumn: "晩秋（落ち葉・しっとりした寒さ）", snowy_scene: "雪景色（冬の雪・防寒感）",
  },
  luxury: {
    casual: "カジュアル", refined: "上品", luxe: "高級感", couture: "オートクチュール級",
    classical: "クラシカル（古典的で伝統ある上品さ）", future_luxe: "フューチャーラグジュアリー（近未来的な高級感）",
  },
} as const;

const BG_LABELS = {
  place: {
    indoor: "室内", alley: "路地", futuristic: "近未来空間", abstract: "抽象空間",
    nature: "自然", museum: "美術館", industrial: "工業施設",
    gallery: "ギャラリー", atelier: "アトリエ", japanese_room: "和室", garden: "庭園",
    seaside: "海辺", forest: "森", empty_space: "無地空間", studio: "スタジオ",
    paper_backdrop: "紙バック", fabric_backdrop: "布バック",
    old_cinema: "古い映画館（レトロな赤いシートとスクリーン）", greenhouse: "温室（ガラス張りの植物溢れる空間）",
    rooftop: "都市の屋上（スカイラインが見える）", library: "図書館（本が壁一面に並ぶ）",
    rainy_station: "雨の駅前（雨に濡れた駅頭・傘が行き交う）",
    night_amusement: "夜の遊園地（カラフルなライトと観覧車）",
    frosted_room: "曇りガラスの部屋（柔らかい拡散光が差し込む）",
  },
  color: {
    inherit: "元背景色を継承", blue: "青系", green: "緑系", red: "赤系", pink: "ピンク系", monochrome: "モノクロ",
    white: "白", black: "黒", beige: "ベージュ", gold: "ゴールド", light: "明るいトーン",
    low_sat: "低彩度", high_sat: "高彩度", pastel: "パステル", vivid: "ビビッド", earth: "アースカラー",
  },
  density: { minimal: "ミニマル", normal: "普通", dense: "情報量多め" },
  effect: {
    glitch: "グリッチ", particles: "光の粒子", fog: "霧", reflection: "反射", geometric: "幾何学", distortion: "空間歪み",
    watercolor_bleed: "水彩のにじみ", ink_bleed: "墨のにじみ", brushstroke: "筆跡",
    paper_texture: "紙の質感", canvas_texture: "キャンバス質感", collage: "コラージュ",
    negative_space: "余白強調", abstract_lines: "抽象ライン", color_planes: "色面構成",
    modern_art_effect: "現代アート効果", handdrawn: "手描き感",
    fabric_flow: "布の流れ（風になびく布・ドレープ）", light_rays: "光芒（光の放射線・差し込む光）",
    shadow_pattern: "影模様（格子・レースの影が落ちる）", water_reflection: "水面反射（揺らめく水鏡）",
  },
  time: { morning: "朝", noon: "昼", golden_hour: "ゴールデンアワー", dusk: "夕暮れ", night: "夜", midnight: "深夜", dawn: "朝焼け（夜明けのオレンジと紫が混じる空）" },
  weather: { clear: "晴れ", cloudy: "曇り", rainy: "雨", snowy: "雪", stormy: "嵐", foggy: "深い霧" },
  depth: { shallow: "被写界深度浅い（背景ボケ強）", moderate: "被写界深度普通", deep: "被写界深度深い", extreme: "極端な被写界深度" },
  info: { sparse: "情報少なめ", balanced: "バランス", rich: "情報多め", maximalist: "最大限" },
  style: {
    photorealistic: "フォトリアル", watercolor: "水彩画風", ink_wash: "水墨画風",
    oil_painting: "油彩画風", acrylic: "アクリル画風", modern_art: "現代アート",
    contemporary_art: "近代アート", abstract_art: "抽象アート", cubism: "キュービズム",
    collage: "コラージュ", poster: "ポスター", minimal: "ミニマル", simple: "シンプル",
    washi: "和紙", canvas: "キャンバス", gradient: "グラデーション", monochrome: "モノクロ",
    pastel: "パステル", cyber: "サイバー", digital: "デジタル",
  },
} as const;

const POSE_LABELS = {
  type: {
    stand: "立ち", sit: "座り", crouch: "しゃがみ", turn: "振り向き", walk: "歩き", float: "浮遊", action: "アクション",
    lean_wall: "壁に寄りかかる", hand_up: "手を上げる（片腕または両腕を上方向に伸ばす）",
  },
  impression: {
    cool: "クール", cute: "かわいい", strong: "強め", calm: "静か", dynamic: "ダイナミック", sns: "SNS映え",
    provocative: "印象的・存在感のある表情", fragile: "はかなげ・壊れそうな儚い印象",
    composed: "落ち着いた・凛とした品のある印象", tense: "張り詰めた・緊張感のある印象",
    mysterious: "謎めいた・得体の知れない印象",
  },
  hand: {
    near_face: "片手を顔の近く", hip: "片手を腰", extend: "片手を伸ばす", natural: "両手を自然に", prop: "小物を持つ",
    touch_hair: "髪に手を添える", chest_hand: "トップス部分に手を当てる",
    touch_cheek: "頬に触れる", cross_arms: "腕を組む", pocket: "ポケットに手を入れる",
  },
  foot: {
    natural: "自然", cross: "クロス", knee: "片膝立ち", walking: "歩行中", float: "浮遊感",
    tiptoe: "つま先立ち（つま先で立つ）", one_foot_forward: "片足を前に出す",
  },
  balance: {
    centered: "重心中央", low: "重心低め", high: "重心高め",
    leaning_forward: "前傾", leaning_back: "後傾", off_center: "片寄せ",
    one_leg_weight: "片脚に重心（片脚荷重）", arched: "背をそらした姿勢", relaxed: "脱力・リラックスした姿勢",
  },
  motion: {
    still: "完全静止", subtle: "微かな動き", dynamic: "ダイナミック", explosive: "爆発的", mid_action: "アクション途中",
    hair_flow: "髪が流れる動き（風・水中感）", cloth_flow: "衣装が揺れる動き", mid_turn: "振り向き途中の瞬間",
  },
  gaze: {
    to_camera: "カメラ目線", away: "視線を外す", downcast: "伏し目", upward: "見上げる",
    side_glance: "横目", over_shoulder: "肩越し",
    distant: "虚空を見つめる（遠くを見る）", diagonal_look: "斜め視線（斜め上または斜め下を見る）",
    look_down: "下を向く（目線を下に落とす）",
  },
  orientation: {
    front: "正面向き",
    three_quarter: "斜め45度",
    side: "真横",
    back: "後ろ向き",
    diagonal: "ねじり",
  },
} as const;

const CAMERA_LABELS = {
  angle: {
    front: "正面", diagonal_45: "斜め45度", low: "ローアングル", high: "ハイアングル",
    top_down: "上空から見下ろし", side_profile: "横顔寄り", over_shoulder: "肩越し",
    close_portrait: "近距離ポートレート", full_body: "全身構図", dutch: "ダッチアングル", cinematic: "シネマティック構図",
    diagonal_high: "斜め高角度（斜め上から見下ろす）", back_view: "後ろ姿（背面から撮影）",
  },
  distance: {
    macro: "マクロ距離", close: "近距離", medium: "中距離", far: "遠距離", extreme_far: "超遠距離",
    bust_up: "バストアップ（上半身）", knee_up: "膝上（膝から上）",
  },
  lens: {
    wide: "広角レンズ感", normal: "標準レンズ感", portrait: "ポートレートレンズ感（85mm相当）",
    tele: "望遠レンズ感", fisheye: "魚眼レンズ感",
    cinema: "シネマレンズ感（映画的な圧縮・浅い被写界深度）",
    smartphone: "スマートフォンカメラ感（自然なスナップ感）",
    wide_distort: "広角歪み（周辺が歪む誇張広角感）",
  },
  composition: {
    rule_of_thirds: "三分割構図", centered: "中央配置", diagonal: "対角線構図",
    symmetric: "対称構図", leading_lines: "誘導線構図", negative_space: "余白活用",
    generous_space: "ゆとりある余白（被写体の周りに広めのスペース）",
    asymmetric: "非対称構図（意図的なアンバランス）",
    subject_large: "被写体大きく（被写体が画面を占める迫力構図）",
    magazine: "雑誌風構図（表紙・見開きを意識した洗練された構図）",
  },
  fov: {
    narrow: "狭い画角", standard: "標準画角", wide: "広い画角", ultra_wide: "超広角",
    vertical_sns: "縦長SNS（9:16 TikTok / Reels 向け縦長）",
    horizontal_cinema: "横長シネマ（21:9 映画的横長）",
    square: "正方形（1:1 Instagram 向け）",
  },
  eyeHeight: {
    low: "低い視点", waist: "腰の高さ", eye_level: "目線", above_head: "頭上", ceiling: "天井近く",
    ground: "地面すれすれの視点（極低アングル）",
    chest_height: "上半身の高さ（自然な立ち目線より少し低め）",
    slightly_above: "やや上からの視点（少し高めの見下ろし）",
  },
} as const;

const PROPS_LABELS = {
  category: {
    weapon: "武器系（刀・短刀・斧・槍・弓・巨大ハンマーなど）",
    cute: "かわいい系（ぬいぐるみ・ハート型クッション・花束・キャンディ・風船など）",
    sns: "SNS映え系（ネオンサイン・発光スマホ・透明傘・巨大リボン・カラフルなペンキ缶など）",
    futuristic: "近未来系（ホログラム端末・発光キューブ・サイバーゴーグル・透明タブレットなど）",
    japanese: "和風系（扇子・和傘・御札・提灯・狐面など）",
    gothic: "ゴシック系（黒い薔薇・古い本・燭台・鎖・十字モチーフなど）",
    daily: "日常系（マグカップ・カメラ・ヘッドホン・バッグ・本など）",
    funny: "面白い系（巨大スプーン・謎の光る卵・ミニ宇宙船・浮遊する魚・巨大チェス駒など）",
    fashion: "ファッション系（バッグ・帽子・サングラス・アクセサリーなどのファッションアイテム）",
    flower: "花・植物系（花束・花冠・花の枝・植物のつるなど）",
    instrument: "楽器系（バイオリン・ギター・笛・鼓など）",
  },
  hold: {
    one_hand: "片手で持つ", two_hands: "両手で持つ", shoulder: "片肩に担ぐ",
    floating: "被写体の近くに浮かせる", on_floor: "足元に置く",
    in_background: "背景側に配置（被写体には触れない）",
    chest_hold: "体の前で抱きしめるように持つ", near_face_hold: "顔の近くに持ち上げる・添える",
  },
  size: {
    small: "小物", medium: "中サイズ", large: "大きめ", huge: "巨大（誇張）",
    tiny: "極小（ミニチュア・ディテールとして）", foreground_large: "前景に大きく（被写体より前に大写し）",
  },
  glow: {
    none: "発光なし", subtle: "ほのかに発光", neon: "ネオン発光", magical: "魔法的な光・粒子エフェクト",
    edge_glow: "エッジ発光（輪郭だけが光る）", inner_glow: "内部発光（内側から光る半透明感）",
  },
  vibe: {
    cool: "クール", cute: "かわいい", funny: "ユーモラスで面白い", luxury: "高級感", dark: "ダーク", sns: "SNS映え",
    elegant: "エレガント・上品な雰囲気", mysterious: "謎めいた・神秘的な雰囲気",
    retro: "レトロ・懐かしい雰囲気", fragile_vibe: "壊れそうなはかない雰囲気",
  },
  placement: {
    near_subject: "被写体に密着", foreground: "手前（被写体より前）", midground: "中景",
    background: "背景側", all_around: "周囲全体に散らす",
    blur_foreground: "前景にぼかして配置（被写体の前でボケる）",
    beside_face: "顔の横に添える", at_feet: "足元に配置", edge_frame: "画面端にフレームとして配置",
  },
  count: {
    single: "1つ", few: "2〜3個", many: "たくさん", scattered: "散乱して多数",
    both_sides: "両サイドに対称に配置", arranged: "整然と配置（コレクション的な並べ方）",
  },
} as const;

const LIGHTING_LABELS = {
  direction: {
    top: "トップライト", side: "サイドライト", back: "逆光", front: "正面光",
    below: "アンダーライト", multi: "複数光源", rim: "リムライト",
    diagonal_above: "斜め上からのライト（45度斜めの自然な光）",
    window: "窓からの自然光（横から差し込む柔らかい自然光）",
    spot: "スポットライト（強い点状のライト）",
    ambient: "環境光（方向性のない柔らかい全体光）",
  },
  intensity: {
    soft: "柔らかい光", normal: "標準的な光量", strong: "強い光・ハイコントラスト", dramatic: "ドラマチック照明",
    low_key: "ローキー（暗く影が多い・陰影を強調）",
    soft_backlight: "柔らかい逆光（輪郭を光で縁取る）",
    pale_glow: "淡い発光感（ふんわりと光が滲む）",
  },
  temperature: {
    warm: "暖色光", neutral: "ニュートラル", cool: "寒色光", mixed: "暖寒ミックス",
    blue_tone: "ブルートーン（青白い冷たい光）",
    red_tone: "レッドトーン（赤みがかった情熱的な光）",
    sunset: "夕焼け光（オレンジ〜赤のマジックアワー）",
    white_light: "純白光（白く明るいクリーンな光）",
  },
  shadow: {
    soft: "柔らかい影", sharp: "シャープな影", long: "長く伸びる影", minimal: "影ほぼなし",
    deep: "深い影（暗く重い影・コントラスト強）",
    drop: "ドロップシャドウ（物体から落ちる影）",
    outline: "輪郭シャドウ（被写体の輪郭だけに影）",
  },
  reflection: {
    matte: "マット質感", satin: "サテン反射", glossy: "光沢反射", specular: "鏡面反射",
    wet: "濡れ感（濡れた肌・濡れた布のしっとり反射）",
    metal_reflect: "金属反射（硬質な金属面の映り込み）",
    glass_reflect: "ガラス反射（透明感のある硬い反射）",
    fabric: "布面反射（生地の繊維に沿った柔らかな光）",
  },
  atmosphere: {
    clear: "クリアな空気", hazy: "薄いヘイズ", foggy: "霧の濃い空気", dusty: "塵の舞う空気",
    particulate: "粒子が漂う空気",
    after_rain: "雨上がりの空気（湿度・清涼感・地面の光反射）",
  },
} as const;

const ASPECT_RATIO_LABELS: Record<string, string> = {
  original: "元画像のアスペクト比を維持",
  ar_9_16: "9:16 縦長（TikTok / Reels / Shorts 向け）",
  ar_4_5: "4:5 縦長（Instagram 投稿向け）",
  ar_1_1: "1:1 正方形（Instagram / アイコン向け）",
  ar_16_9: "16:9 横長（YouTube サムネ / 横長映え）",
  ar_3_4: "3:4 縦長",
  ar_2_3: "2:3 縦長",
  ar_21_9: "21:9 シネマティック横長",
  custom: "カスタム比率",
};

const FOREGROUND_LABELS = {
  preset: {
    buzz: "SNS映えバズり", god: "神引き（最高品質）", subtle: "控えめ自然", flashy: "ド派手演出",
    fantasy: "幻想・ファンタジー", cyber: "サイバー・デジタル", japanese: "和風・和モダン",
    dark: "ダーク・ゴシック", translucent: "透明感・ガラス", art: "アート・絵画風",
    watercolor: "水彩にじみ", text_effect: "文字エフェクト", light: "光・グロー演出",
    flower: "花・植物系",
  },
  effectType: {
    petals: "花びら（汎用）", sakura: "桜花びら", rose: "バラの花びら", camellia: "椿の花びら",
    higanbana: "彼岸花", feather: "羽（汎用）", down: "産毛・ダウン羽", snow: "雪",
    rain: "雨粒", bubble: "シャボン玉", drop: "水滴", glass: "ガラス破片",
    confetti: "紙吹雪", spark: "火花", ash: "灰・燃え殻", light_particle: "光の粒子",
    stardust: "星屑", butterfly: "蝶", jellyfish: "クラゲ", foxfire: "狐火",
    spirit_fire: "霊火", red_mist: "赤い霧", blue_mist: "青い霧",
    black_smoke: "黒煙", white_smoke: "白煙", light_feather: "光の羽",
    fabric_strip: "布の帯（薄い布の帯が舞い散る）", transparent_ribbon: "透明リボン（薄膜のリボンが漂う）",
    smoke_puff: "煙の塊（ふわっと膨らむ柔らかい霧）",
  },
  swirlType: {
    light_ring: "光輪", energy_vortex: "エネルギー渦", magic_circle: "魔法陣",
    aura_swirl: "オーラ渦", particle_swirl: "粒子渦", cable_swirl: "ケーブル渦",
    wire_swirl: "ワイヤー渦", ink_vortex: "墨渦", water_vortex: "水渦",
    fire_vortex: "炎渦", petal_vortex: "花びら渦", butterfly_swirl: "蝶の渦",
    circular_hud: "円形HUD", multi_ring: "多重リング", light_trail: "光の軌跡",
    ribbon_light: "リボン光", ripple: "波紋",
    light_thread: "光の糸（繊細な光の糸が交差する演出）",
  },
  digitalType: {
    ui_hologram: "UIホログラム", scanline: "スキャンライン", numbers: "数字の流れ",
    code_text: "コードテキスト", glitch_text: "グリッチテキスト",
    japanese_typography: "日本語タイポグラフィ", alphanumeric_typography: "英数字タイポ",
    glitch: "グリッチ", target_ui: "ターゲットUI", circular_hud: "円形HUD",
    waveform: "波形", data_stream: "データストリーム", geometric: "幾何学図形",
    hologram_panel: "ホログラムパネル", transparent_window: "透明ウィンドウ",
    circuit_lines: "回路ライン", digital_noise: "デジタルノイズ",
  },
  artType: {
    watercolor_splash: "水彩スプラッシュ", ink_splash: "インクスプラッシュ",
    paint_splash: "絵具スプラッシュ", brushstroke: "筆跡",
    ink_line: "墨ライン", collage: "コラージュ", paper_texture: "紙質感",
    modern_art_line: "現代アートライン", abstract_shape: "抽象シェイプ",
    color_plane: "色面", cubism_fragment: "キュービズム断片",
    glass_abstract: "ガラス抽象", fragment: "破片", glowing_lineart: "発光ライン画",
    handdrawn: "手描き感", transparent_acrylic: "透明アクリル",
  },
  position: {
    face_area: "顔周り（顔は隠さない）", shoulder: "肩周り", arm: "腕周り", hand: "手周り",
    avoid_chest: "上半身を避けた位置", waist: "腰周り", feet: "足元周り",
    full_body: "全身を取り巻く", full_screen: "画面全体", one_side: "片側のみ",
    center: "中央付近", surrounding: "被写体を囲む", back_to_front: "背後から前方へ",
    diagonal: "斜め配置", rising: "下から上へ上昇", falling: "上から下へ落下",
  },
  density: {
    minimal: "極少量（1〜3個）", subtle: "少量（控えめ）", normal: "普通",
    rich: "たっぷり", max: "最大密度",
  },
  motion: {
    still: "静止", gentle_flow: "ゆっくり流れる", rotate: "回転", vortex: "渦巻き",
    explode: "爆発的に広がる", radiate: "放射状に広がる", falling: "落下",
    rising: "上昇", diagonal: "斜め移動", wave: "波打つ", attract: "中心に集まる",
    exit: "画面外に消えていく", surround: "被写体を取り巻く", from_hands: "手から発生",
  },
  color: {
    inherit: "背景・衣装の色を継承", blue_white: "青白", red_black: "赤黒",
    pink_purple: "ピンク紫", cyan: "シアン", gold: "ゴールド", white_light: "白光",
    rainbow: "レインボー", pastel: "パステル", monochrome: "モノクロ",
    low_sat: "低彩度", high_sat: "高彩度", match_bg: "背景色に合わせる",
    match_outfit: "衣装色に合わせる",
  },
  depth: {
    front_only: "最前面のみ", around_subject: "被写体周囲", front_back_overlap: "前後に重なる",
    shallow: "浅い奥行き", deep: "深い奥行き", bg_to_fg: "背景から前景へ",
    bokeh_front: "前景をボケさせる", near_particles: "近くに粒子",
    far_particles: "遠くに粒子",
  },
  visibility: {
    face_protected: "顔と目を保護（必ず視認可能に）",
    eyes_protected: "目を完全に保護",
    outline_enhanced: "被写体の輪郭を強調",
    subtle_face: "顔周りのエフェクトを控えめに",
    strong_bg: "背景側を強くする",
    emphasize_hands: "手元を強調",
    emphasize_edges: "輪郭部分を強調",
    subtle_center: "中央を控えめに",
  },
} as const;

const VEHICLE_LABELS = {
  genre: {
    land:             "陸上の乗り物",
    air:              "空中の乗り物",
    sea:              "海上の乗り物",
    space:            "宇宙船・ロケット",
    amusement:        "遊園地・観光系の乗り物",
    historical:       "歴史的な乗り物",
    near_future:      "近未来の乗り物",
    fictional_mech:   "架空の巨大メカ・要塞",
    robot:            "搭乗型ロボット・メカスーツ",
    military_display: "展示・停止状態のミリタリー車両",
    fantasy:          "ファンタジー系の乗り物・生物",
  },
  type: {
    // 陸
    bicycle:                "スタイリッシュな自転車",
    motorcycle:             "バイク（大型バイク）",
    scooter:                "カラフルなスクーター",
    sports_car:             "スポーツカー",
    classic_car:            "クラシックカー（ビンテージ車）",
    vintage_car:            "1950〜60年代のヴィンテージカー",
    limousine:              "高級リムジン",
    jeep:                   "アドベンチャー系ジープ・SUV",
    train:                  "電車・列車",
    bus:                    "ヴィンテージバス・二階建てバス",
    tuk_tuk:                "カラフルなトゥクトゥク",
    // 空
    fighter_jet:            "戦闘機（展示・背景）",
    small_plane:            "小型プロペラ機",
    helicopter:             "ヘリコプター",
    hot_air_balloon:        "カラフルな熱気球",
    glider:                 "優雅なグライダー",
    drone:                  "近未来的なドローン",
    blimp:                  "レトロな飛行船・ツェッペリン",
    // 海
    yacht:                  "白帆のヨット",
    motor_boat:             "スピードボート",
    cruiser:                "高級クルーザー",
    sailing_ship:           "大型帆船（海賊船・探検船風）",
    rowboat:                "小さな木製ボート",
    // 宇宙
    spaceship:              "洗練された宇宙船",
    rocket:                 "打ち上げロケット",
    space_station:          "宇宙ステーションの一部",
    // 遊具
    merry_go_round:         "装飾豊かなメリーゴーランド",
    miniature_train:        "可愛らしいミニチュア汽車",
    gondola:                "ベネチアのゴンドラ・観光船",
    carousel_horse:         "カラフルなメリーゴーランドの馬",
    // 歴史系
    horse_carriage:         "優雅な馬車",
    rickshaw:               "和風人力車",
    galleon:                "大型ガレオン船",
    steam_locomotive:       "蒸気機関車",
    roman_chariot:          "古代ローマ風の戦闘馬車（展示）",
    // 近未来
    hover_bike:             "空中浮遊バイク（近未来）",
    capsule_car:            "透明カプセル型の自動運転車",
    maglev_train:           "磁気浮上式リニア列車",
    flying_car:             "透明翼付きフライングカー",
    jet_pack_suit:          "ジェットパック搭載スーツ（着用中）",
    // 架空メカ
    sky_fortress:           "巨大な空中要塞（背景・オリジナルデザイン）",
    giant_mech:             "巨大人型メカロボット（背景・オリジナルデザイン）",
    transformation_mech:    "変形合体メカ（オリジナルデザイン）",
    // ロボット
    cockpit_robot:          "搭乗型ロボットのコックピット",
    mech_suit:              "小型パワードスーツ・メカスーツ",
    walker_mech:            "二足歩行型小型メカ",
    // ミリタリー（展示のみ）
    armored_vehicle_display:"博物館・展示場の装甲車（停止状態）",
    tank_display:           "博物館・公園の戦車（展示・停止状態）",
    // ファンタジー
    dragon:                 "巨大ドラゴン",
    pegasus:                "白い翼を持つ天馬",
    magic_carpet:           "空飛ぶ魔法の絨毯",
    giant_turtle:           "神秘的な巨大亀",
    sky_whale:              "空を泳ぐ巨大クジラ",
    flying_island:          "宙に浮かぶ空中島",
  },
  interaction: {
    riding:          "乗り物に乗っている・操縦している",
    sitting_on:      "乗り物の上・座席に座っている",
    standing_beside: "乗り物の横に立っている",
    leaning_on:      "乗り物に寄りかかっている",
    in_background:   "人物の後方・中景に乗り物を配置",
    far_background:  "人物の遠景に小さく乗り物を配置",
    through_window:  "窓越しに乗り物が見える",
    shadow_only:     "乗り物の影だけが地面・壁に落ちている",
    reflection_only: "乗り物が水面・鏡面に反射して映っている",
    giant_backdrop:  "乗り物全体が巨大な背景・舞台として機能",
  },
  era: {
    modern:      "現代的なデザイン",
    retro:       "レトロ・ビンテージ感（50〜80年代）",
    near_future: "近未来感（10〜30年後）",
    far_future:  "遠未来感（数百年後）",
    historical:  "歴史的・古代〜中世デザイン",
    fantasy:     "魔法・ファンタジー世界観",
    steampunk:   "蒸気機関・スチームパンク美学",
  },
  material: {
    metal:        "金属・スチール感",
    chrome:       "鏡面クロームメッキ",
    matte_metal:  "マットメタル（光沢抑えた金属）",
    transparent:  "透明・クリスタルガラス素材",
    carbon:       "カーボンファイバー",
    rust_vintage: "サビ・経年劣化のある古びた質感",
    wood:         "木材・ウッド素材",
    glowing:      "発光する素材・ネオン光沢",
    organic:      "生体的・有機的な素材感",
    crystal:      "結晶・宝石のような透明素材",
  },
  atmosphere: {
    cool:       "クール・スタイリッシュ",
    cute:       "かわいい・ポップ",
    pop:        "カラフルでポップな雰囲気",
    dark:       "ダーク・神秘的な雰囲気",
    elegant:    "エレガント・上品",
    luxury:     "高級感・ラグジュアリー",
    adventure:  "冒険・旅・探検の雰囲気",
    cinematic:  "映画ポスター風の映画的演出",
    serene:     "静かで穏やかな詩的な雰囲気",
  },
} as const;

const MYTH_LABELS = {
  region: {
    japanese:        "日本神話（龍・鳳凰・狛犬等）",
    chinese:         "中国神話（四神・麒麟・白虎等）",
    egyptian:        "エジプト神話（バステト・アヌビス・ラー等）",
    greek:           "ギリシャ神話（ペガサス・グリフィン・ゴルゴン等）",
    norse:           "北欧神話（フェンリル・ヴァルキリー等）",
    celtic:          "ケルト神話（バンシー・プーカ・ドラゴン等）",
    indian:          "インド神話（ガルーダ・ナーガ・デーヴァ等）",
    middle_east:     "中東・アラビア神話（ロック・ジン・シームルグ等）",
    western_fantasy: "西洋ファンタジー幻獣（ドラゴン・ユニコーン・フェニックス等）",
    oceanic:         "海洋・南島神話（タニファ・タンガロア等）",
    world_mix:       "複数文化の神話を融合したオリジナル幻獣",
  },
  creature: {
    divine_beast:  "神獣（鳳凰・麒麟・白虎等の聖なる獣）",
    guardian:      "守護神獣（場所・人を守護する存在）",
    dragon:        "龍・竜（東洋龍・西洋ドラゴン）",
    bird:          "霊鳥（鳳凰・ロック・シームルグ等）",
    serpent:       "大蛇・蛇神（ナーガ・ジョルムンガンド等）",
    wolf:          "霊狼（フェンリル・神話の狼等）",
    cat:           "霊猫（バステト・猫又等の猫神）",
    giant:         "巨人・神（タイタン・デーヴァ等の大型神話存在）",
    spirit:        "精霊（自然の精霊・妖精・ニンフ等）",
    phantom_beast: "幻獣（ユニコーン・グリフィン・キメラ等）",
    god:           "神格（オリジナルデザインの神・神格化された存在）",
    demigod:       "半神（人と神の中間・半神半人）",
    mech_myth:     "機械神（機械と神話が融合した未来的神獣）",
    future_myth:   "未来幻獣（SFと神話が融合した近未来的幻獣）",
  },
  interaction: {
    bg_giant:        "幻獣を画面奥に巨大な背景として配置",
    far_distance:    "遠景に小さく幻獣が見える",
    behind_subject:  "人物の真後ろに幻獣が佇む",
    surrounding:     "幻獣が人物を取り囲む",
    on_shoulder:     "小型幻獣が肩に乗っている",
    standing_beside: "幻獣が人物の横に並ぶ",
    guarding:        "幻獣が人物を守護・護衛している",
    flying_above:    "幻獣が頭上を舞い飛ぶ",
    looking_down:    "巨大な幻獣が上から人物を見下ろす",
    riding:          "人物が幻獣に騎乗している",
    summoning:       "人物が幻獣を召喚・顕現させている",
    silhouette_only: "幻獣のシルエットだけが背景に浮かぶ",
    shadow_only:     "幻獣の影だけが地面・壁に落ちている",
    glow_aura_only:  "幻獣の神々しい光のオーラだけが漂う",
    partial_reveal:  "幻獣の翼・爪・尾等の一部だけが見える",
  },
  style: {
    realistic:   "写真的なリアル質感",
    fantasy:     "ファンタジーイラスト風（光・煙・魔法エフェクト）",
    cinematic:   "映画特撮風の重厚な描写",
    anime:       "アニメ・イラスト調",
    mystic:      "霧・光・半透明で神秘的に表現",
    dark:        "ダーク・ゴシック・禍々しい雰囲気",
    luxury:      "黄金・宝石・白金で装飾した豪華な幻獣",
    art:         "現代アート・前衛的な表現スタイル",
    near_future: "SF・近未来技術と神話が融合",
    wa_modern:   "和の伝統と現代デザインを融合",
    epic:        "壮大・叙事詩的な迫力あるスタイル",
    ad_visual:   "商業広告・ビジュアルデザイン風",
  },
  size: {
    small:         "手のひらサイズ",
    shoulder_size: "肩に乗る中小型サイズ",
    human_size:    "人間と同程度の大きさ",
    giant:         "人間の数倍の大型",
    colossal:      "建物・山ほどの超巨大",
    sky_filling:   "空全体を覆うほど巨大",
    distant_giant: "遥か遠くにそびえ立つ遠景の巨人",
  },
} as const;

const BIG_OBJECT_LABELS = {
  genre: {
    clean:           "綺麗系（高級感のある美しい大型オブジェ・クリアで洗練されたアート系）",
    luxury_display:  "高級展示系（ギャラリー・高級店の大型展示オブジェ・ショーケース）",
    art:             "アート系（現代美術・抽象アートの大型インスタレーション）",
    foreign:         "異物系（なぜそこにあるのか不明な異質な大型オブジェ）",
    broken:          "壊れ系（破損・割れ・欠損した大型オブジェ・退廃的演出）",
    ruins:           "廃墟系（廃墟・朽ちた巨大建築パーツ・さびれた展示物）",
    creepy_cute:     "不気味かわいい（壊れたぬいぐるみ・片目の人形など不気味かわいい大型オブジェ）",
    retro_foreign:   "レトロ異物（時代錯誤な巨大レトロ機器・古びたブラウン管・廃棄された遊具）",
    movie_prop:      "映画大道具（映画セット・舞台装置のような劇的な大型道具）",
    surreal:         "超現実（日常空間に似合わない超現実的な巨大オブジェ・シュール演出）",
    lab:             "実験施設（壊れた培養槽・巨大研究装置・実験施設の異物感）",
    mystic_display:  "神秘展示（神秘的な展示物・光る聖遺物・儀式的な大型オブジェ）",
  },
  type: {
    stuffed:        "巨大ぬいぐるみ・人形・布製の大型オブジェ",
    display:        "展示台・ショーケース・高級陳列オブジェ",
    sculpture:      "石膏像・彫刻・抽象オブジェ",
    lab_equipment:  "培養槽・研究装置・実験器具",
    glass:          "ガラス彫刻・ガラスケース・透明構造物",
    architecture:   "建築パーツ・柱・扉・巨大フレーム",
    retro_machine:  "ブラウン管・古い機械・アーカイブ装置",
    stage_prop:     "劇場の大道具・舞台装置・映画セット",
    mystic_object:  "神秘的な光る石・儀式オブジェ・聖遺物",
    foreign_object: "文脈にそぐわない巨大異物・謎のオブジェ",
  },
  condition: {
    brand_new:  "新品・未使用感",
    clean:      "清潔で綺麗な状態",
    luxury:     "高級感のある仕上がり",
    aged:       "年月を経た古い状態",
    dirty:      "汚れ・埃・くすみ",
    torn:       "破れ・綻び・裂け目",
    broken:     "壊れた・変形した状態",
    rusted:     "錆が浮いた・腐食した状態",
    cracked:    "ひび割れ・割れ目が入った",
    wet:        "雨・水に濡れた状態",
    sandy:      "砂・土埃まみれの状態",
    faded:      "色褪せ・退色した状態",
    warped:     "歪み・反り・変形",
    damaged:    "欠損・一部が欠けた状態",
    collapsing: "崩れかけ・今にも崩れそう",
  },
  placement: {
    beside:         "人物の横に静かに置かれている",
    holding:        "人物が抱えている・寄り添っている",
    leaning:        "人物がもたれかかっている",
    sitting:        "人物が上に座っている",
    behind:         "人物の背後にそびえる",
    foreground:     "画面手前にぼかして配置",
    surrounding:    "周囲に複数配置",
    at_feet:        "人物の足元に置かれている",
    floating_above: "空中に浮遊している",
    bg_center:      "背景の中央に鎮座している",
    asymmetric:     "左右非対称に画面の片側を占める",
    deep_bg:        "遠景に巨大な影として配置",
  },
  size: {
    medium:         "人物より少し小さい程度",
    large:          "人物と同程度かやや大きい",
    same_as_person: "人物とほぼ同じ大きさ",
    bigger:         "明らかに人物より大きい",
    huge:           "圧倒的に巨大な存在感",
    screen_filling: "画面全体を支配するほどの大きさ",
  },
  mood: {
    cute:             "かわいらしい・メルヘンな雰囲気",
    luxury:           "ラグジュアリー・高級感のある雰囲気",
    fantasy:          "幻想的・非現実的な神秘の雰囲気",
    eerie:            "不気味・ホラー的な雰囲気",
    decadent:         "退廃的・朽ちる美・古びた哀愁",
    cinematic:        "映画・ドラマのワンシーンのような演出",
    ad_visual:        "商業広告・ブランドキャンペーン的な演出",
    contemporary_art: "現代アート・インスタレーション的な表現",
    lab:              "研究施設・科学実験・近未来的異物感",
    dreamy:           "夢の中のような曖昧で柔らかい雰囲気",
    otherworld:       "異世界・別次元からの異物感",
    surreal:          "脈絡のないシュールな存在感",
    dramatic:         "ドラマチックで物語性のある演出",
  },
} as const;

/**
 * リクエストの details から undefined になりうるフィールドを skip 相当のデフォルト値で埋める。
 * 古い localStorage 保存データや JSON シリアライズで undefined が除去されたフィールドを補完する。
 */
function safeDetails(d: Partial<DetailSettings>): DetailSettings {
  const SK = "skip" as const;
  return {
    hair:        d.hair        ?? { length: SK, shape: SK, texture: SK, colorMode: SK, color: SK, bangs: SK, tips: SK, volume: SK, accessory: SK },
    outfit:      d.outfit      ?? { style: SK, exposure: SK, material: SK, color: SK, silhouette: SK, decoration: SK, season: SK, luxury: SK },
    cosplay:     d.cosplay     ?? { genre: SK, cuteStyle: SK, jobGenre: SK, japaneseStyle: SK, fantasyStyle: SK, scifiStyle: SK, darkStyle: SK, occupation: SK, decoration: SK, item: SK, exposure: SK, colorDir: SK },
    cyber:       d.cyber       ?? { part: SK, type: SK, texture: SK, glowColor: SK, intensity: SK },
    background:  d.background  ?? { place: SK, color: SK, density: SK, effect: SK, time: SK, weather: SK, depth: SK, info: SK },
    foreground:  d.foreground  ?? { preset: SK, effectType: SK, swirlType: SK, digitalType: SK, artType: SK, position: SK, density: SK, motion: SK, color: SK, depth: SK, visibility: SK },
    pose:        d.pose        ?? { type: SK, impression: SK, hand: SK, foot: SK, balance: SK, motion: SK, gaze: SK, orientation: SK },
    camera:      d.camera      ?? { angle: SK, distance: SK, lens: SK, composition: SK, fov: SK, eyeHeight: SK, custom3D: null },
    props:       d.props       ?? { category: SK, hold: SK, size: SK, glow: SK, vibe: SK, placement: SK, count: SK },
    bigObject:   d.bigObject   ?? { genre: SK, type: SK, condition: SK, placement: SK, size: SK, mood: SK },
    vehicle:     d.vehicle     ?? { genre: SK, type: SK, interaction: SK, era: SK, material: SK, atmosphere: SK },
    myth:        d.myth        ?? { region: SK, creature: SK, interaction: SK, style: SK, size: SK },
    lighting:    d.lighting    ?? { direction: SK, intensity: SK, temperature: SK, shadow: SK, reflection: SK, atmosphere: SK },
    aspectRatio: d.aspectRatio ?? { preset: SK, customW: 1, customH: 1 },
    multiOverrides: d.multiOverrides,
  };
}

/** multiOverrides から指定キーの複数選択値を取得。なければ [] を返す。 */
function getMultiVals(mo: Record<string, string[]> | undefined, key: string): string[] {
  return mo?.[key] ?? [];
}

function describeDetails(
  scopes: Scope[],
  details: DetailSettings,
  _pt: PromptTarget = "full",
  subStylePlan?: SubStylePlan,
): string {
  // OUTFIT_LABELS.exposure はすでに全モード共通の安全表現を使用している
  const exposureLabel = (v: string): string =>
    (OUTFIT_LABELS.exposure as Record<string, string>)[v] ?? v;
  const lines: string[] = [];

  if (scopes.includes("hair")) {
    const h = details.hair;
    const fixed: string[] = [];
    const vary: string[] = [];

    // スタイル系統（時代・世界観）
    const hs = h.hairStyle;
    if (hs && hs !== "auto" && hs !== "skip") {
      if (hs === "viral") {
        fixed.push(
          `【スタイル系統】バズり系 — 以下のプールから案ごとに異なるスタイルを1つ採用：` +
          VIRAL_HAIR_POOL.join("・")
        );
      } else if (hs === "unique") {
        fixed.push("【スタイル系統】珍しい髪型（一般的でない独自性の高いスタイルを大胆に採用。各案で方向性を変える）");
      } else {
        fixed.push(`【スタイル系統】${HAIR_LABELS.hairStyle[hs]}（固定。このスタイルの時代感・世界観に沿った髪型にする）`);
      }
    } else if (hs === "auto") {
      vary.push("スタイル系統");
    }

    if (h.length !== "auto" && h.length !== "skip") fixed.push(`長さ：${HAIR_LABELS.length[h.length as keyof typeof HAIR_LABELS.length]}（固定）`);
    else if (h.length === "auto") vary.push("長さ");
    const hairShapeVals = getMultiVals(details.multiOverrides, "hair.shape");
    if (hairShapeVals.length >= 2) {
      fixed.push(`形：${hairShapeVals.map(v => (HAIR_LABELS.shape as Record<string, string>)[v] ?? v).join("と")}の組み合わせ（複数スタイルを自然に融合）`);
    } else if (h.shape !== "auto" && h.shape !== "skip") {
      fixed.push(`形：${HAIR_LABELS.shape[h.shape as keyof typeof HAIR_LABELS.shape]}（固定）`);
    } else if (h.shape === "auto") vary.push("形");
    if (h.texture !== "auto" && h.texture !== "skip") fixed.push(`質感：${HAIR_LABELS.texture[h.texture as keyof typeof HAIR_LABELS.texture]}（固定）`);
    else if (h.texture === "auto") vary.push("質感");
    // colorMode: skip → 省略、auto → vary に追加、それ以外 → fixed（髪色変更ポリシー）
    if (h.colorMode !== "skip") {
      if (h.colorMode === "auto") vary.push("髪色変更ポリシー");
      else fixed.push(HAIR_LABELS.colorMode[h.colorMode]);
    }
    const hairColorVals = getMultiVals(details.multiOverrides, "hair.color");
    if (hairColorVals.length >= 2) {
      fixed.push(`髪色：${hairColorVals.map(v => (HAIR_LABELS.color as Record<string, string>)[v] ?? v).join("×")}のグラデーション・メッシュ配色（複数色を自然に融合）`);
    } else if (h.color !== "auto" && h.color !== "skip") {
      fixed.push(`髪色：${HAIR_LABELS.color[h.color as keyof typeof HAIR_LABELS.color]}`);
    } else if (h.color === "auto" && h.colorMode !== "lock" && h.colorMode !== "skip") vary.push("髪色");
    if (h.bangs !== "auto" && h.bangs !== "skip") fixed.push(`前髪：${HAIR_LABELS.bangs[h.bangs as keyof typeof HAIR_LABELS.bangs]}（固定）`);
    else if (h.bangs === "auto") vary.push("前髪");
    if (h.tips !== "auto" && h.tips !== "skip") fixed.push(`毛先：${HAIR_LABELS.tips[h.tips as keyof typeof HAIR_LABELS.tips]}（固定）`);
    else if (h.tips === "auto") vary.push("毛先");
    if (h.volume !== "auto" && h.volume !== "skip") fixed.push(`ボリューム：${HAIR_LABELS.volume[h.volume as keyof typeof HAIR_LABELS.volume]}（固定）`);
    else if (h.volume === "auto") vary.push("ボリューム");
    if (h.accessory !== "auto" && h.accessory !== "skip") fixed.push(`アクセサリー：${HAIR_LABELS.accessory[h.accessory as keyof typeof HAIR_LABELS.accessory]}（固定）`);
    else if (h.accessory === "auto") vary.push("アクセサリー");

    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`髪の指示：${parts.join(" / ")}`);
    }
    // 髪型変更の原則ルール（常時）
    lines.push(
      "【髪型変更ルール】顔の造形・目鼻立ち・顔の印象・人物の同一性は完全維持。" +
      "髪型・髪色・髪質のみ変更する。体型・衣装・背景・ポーズ・カメラは変更範囲に含まれていない限り手を加えない。"
    );
  }

  if (scopes.includes("outfit")) {
    const o = details.outfit;
    const fixed: string[] = [];
    const vary: string[] = [];
    const outfitStyleVals  = getMultiVals(details.multiOverrides, "outfit.style");
    const outfitColorVals  = getMultiVals(details.multiOverrides, "outfit.color");
    const outfitMatVals    = getMultiVals(details.multiOverrides, "outfit.material");
    const outfitSilhVals   = getMultiVals(details.multiOverrides, "outfit.silhouette");
    if (outfitStyleVals.length >= 2) {
      fixed.push(`系統：${outfitStyleVals.map(v => (OUTFIT_LABELS.style as Record<string, string>)[v] ?? v).join("×")}のコンビネーションスタイル`);
    } else if (o.style !== "auto" && o.style !== "skip") {
      // サブジャンル展開プランがある場合は大カテゴリ名を出さない（下記の【衣装サブジャンル展開】で具体化）
      if (subStylePlan && subStylePlan.styleKey === o.style) {
        fixed.push(`系統：「${OUTFIT_LABELS.style[o.style]}」をサブジャンルへ展開（下記の【衣装サブジャンル展開】を参照）`);
      } else {
        fixed.push(`系統：${OUTFIT_LABELS.style[o.style]}（固定）`);
      }
    } else if (o.style === "auto") vary.push("系統");
    if (o.exposure !== "auto" && o.exposure !== "skip") fixed.push(`${exposureLabel(o.exposure)}（固定）`);
    else if (o.exposure === "auto") vary.push("衣装デザイン");
    if (outfitMatVals.length >= 2) {
      fixed.push(`素材：${outfitMatVals.map(v => (OUTFIT_LABELS.material as Record<string, string>)[v] ?? v).join("と")}のミックス素材`);
    } else if (o.material !== "auto" && o.material !== "skip") {
      fixed.push(`素材：${OUTFIT_LABELS.material[o.material]}（固定）`);
    } else if (o.material === "auto") vary.push("素材");
    if (outfitColorVals.length >= 2) {
      fixed.push(`色方向：${outfitColorVals.map(v => (OUTFIT_LABELS.color as Record<string, string>)[v] ?? v).join("×")}の配色（複数色を調和させる）`);
    } else if (o.color !== "auto" && o.color !== "skip") {
      fixed.push(`色方向：${OUTFIT_LABELS.color[o.color]}（固定）`);
    } else if (o.color === "auto") vary.push("色方向");
    if (outfitSilhVals.length >= 2) {
      fixed.push(`シルエット：${outfitSilhVals.map(v => (OUTFIT_LABELS.silhouette as Record<string, string>)[v] ?? v).join("と")}の組み合わせシルエット`);
    } else if (o.silhouette !== "auto" && o.silhouette !== "skip") {
      fixed.push(`シルエット：${OUTFIT_LABELS.silhouette[o.silhouette]}（固定）`);
    } else if (o.silhouette === "auto") vary.push("シルエット");
    if (o.decoration !== "auto" && o.decoration !== "skip") fixed.push(`装飾量：${OUTFIT_LABELS.decoration[o.decoration]}（固定）`);
    else if (o.decoration === "auto") vary.push("装飾量");
    if (o.season !== "auto" && o.season !== "skip") fixed.push(`季節感：${OUTFIT_LABELS.season[o.season]}（固定）`);
    else if (o.season === "auto") vary.push("季節感");
    if (o.luxury !== "auto" && o.luxury !== "skip") fixed.push(`高級感：${OUTFIT_LABELS.luxury[o.luxury]}（固定）`);
    else if (o.luxury === "auto") vary.push("高級感");
    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`衣装の指示：${parts.join(" / ")}`);
    }
  }

  if (scopes.includes("cosplay")) {
    const c = details.cosplay;
    const fixed: string[] = [];
    const vary: string[] = [];

    // ヘルパー：auto/skip チェック付きラベル取得
    const cl = <K extends keyof typeof COSPLAY_LABELS>(
      field: K,
      val: string
    ): string => (COSPLAY_LABELS[field] as Record<string, string>)[val] ?? val;

    if (c.genre !== "auto" && c.genre !== "skip") fixed.push(`ジャンル系統：${cl("genre", c.genre)}（固定）`);
    else if (c.genre === "auto") vary.push("ジャンル系統");
    if (c.cuteStyle !== "auto" && c.cuteStyle !== "skip") fixed.push(`かわいい系スタイル：${cl("cuteStyle", c.cuteStyle)}（固定）`);
    else if (c.cuteStyle === "auto") vary.push("かわいい系サブスタイル");
    if (c.jobGenre !== "auto" && c.jobGenre !== "skip") fixed.push(`職種・役割：${cl("jobGenre", c.jobGenre)}（固定）`);
    else if (c.jobGenre === "auto") vary.push("職種・役割");
    if (c.japaneseStyle !== "auto" && c.japaneseStyle !== "skip") fixed.push(`和風スタイル：${cl("japaneseStyle", c.japaneseStyle)}（固定）`);
    else if (c.japaneseStyle === "auto") vary.push("和風スタイル");
    if (c.fantasyStyle !== "auto" && c.fantasyStyle !== "skip") fixed.push(`ファンタジースタイル：${cl("fantasyStyle", c.fantasyStyle)}（固定）`);
    else if (c.fantasyStyle === "auto") vary.push("ファンタジースタイル");
    if (c.scifiStyle !== "auto" && c.scifiStyle !== "skip") fixed.push(`SF・近未来スタイル：${cl("scifiStyle", c.scifiStyle)}（固定）`);
    else if (c.scifiStyle === "auto") vary.push("SF・近未来スタイル");
    if (c.darkStyle !== "auto" && c.darkStyle !== "skip") fixed.push(`ダーク系スタイル：${cl("darkStyle", c.darkStyle)}（固定）`);
    else if (c.darkStyle === "auto") vary.push("ダーク系スタイル");
    if (c.occupation !== "auto" && c.occupation !== "skip") fixed.push(`職業コスプレ：${cl("occupation", c.occupation)}（固定）`);
    else if (c.occupation === "auto") vary.push("職業コスプレ");
    if (c.decoration !== "auto" && c.decoration !== "skip") fixed.push(`装飾レベル：${cl("decoration", c.decoration)}（固定）`);
    else if (c.decoration === "auto") vary.push("装飾レベル");
    if (c.item !== "auto" && c.item !== "skip") fixed.push(`持ち物・小物：${cl("item", c.item)}（固定）`);
    else if (c.item === "auto") vary.push("持ち物・小物");
    // 露出：skip か具体値のみ（"auto" は使わない）
    if (c.exposure !== "skip") fixed.push(`${COSPLAY_LABELS.exposure[c.exposure]}（固定）`);
    if (c.colorDir !== "auto" && c.colorDir !== "skip") fixed.push(`カラー方向：${cl("colorDir", c.colorDir)}（固定）`);
    else if (c.colorDir === "auto") vary.push("カラー方向");

    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`コスプレの指示：${parts.join(" / ")}`);
    }

    lines.push(
      "【コスプレ変更ルール】" +
      "オリジナルコスプレとして表現する（既存のアニメ・ゲームキャラクターの名前は使わない）。" +
      "顔の造形・目鼻立ち・人物の同一性は完全維持。体型は変更しない。" +
      "ポーズ・カメラ構図は変更範囲に指定されていない限り維持する。" +
      "露出は原則として控えめで安全なデザインを維持する。" +
      "変更対象：衣装・装飾・小物・コスプレスタイル・カラー方向のみ。"
    );
  }

  if (scopes.includes("cyber")) {
    const cy = details.cyber;
    const fixed: string[] = [];
    const vary: string[] = [];

    const cyl = <K extends keyof typeof CYBER_LABELS>(field: K, val: string): string =>
      (CYBER_LABELS[field] as Record<string, string>)[val] ?? val;

    const cyPartVals  = getMultiVals(details.multiOverrides, "cyber.part");
    const cyTypeVals  = getMultiVals(details.multiOverrides, "cyber.type");
    const cyTexVals   = getMultiVals(details.multiOverrides, "cyber.texture");
    const cyGlowVals  = getMultiVals(details.multiOverrides, "cyber.glowColor");
    if (cyPartVals.length >= 2) {
      fixed.push(`変化する部位：${cyPartVals.map(v => cyl("part", v)).join("・")}（複数部位を組み合わせて変化させる）`);
    } else if (cy.part !== "auto" && cy.part !== "skip") {
      fixed.push(`変化する部位：${cyl("part", cy.part)}（固定）`);
    } else if (cy.part === "auto") vary.push("変化する部位");
    if (cyTypeVals.length >= 2) {
      fixed.push(`機械化タイプ：${cyTypeVals.map(v => cyl("type", v)).join("と")}を組み合わせたデザイン`);
    } else if (cy.type !== "auto" && cy.type !== "skip") {
      fixed.push(`機械化タイプ：${cyl("type", cy.type)}（固定）`);
    } else if (cy.type === "auto") vary.push("機械化タイプ");
    if (cyTexVals.length >= 2) {
      fixed.push(`質感：${cyTexVals.map(v => cyl("texture", v)).join("×")}のミックス質感`);
    } else if (cy.texture !== "auto" && cy.texture !== "skip") {
      fixed.push(`質感：${cyl("texture", cy.texture)}（固定）`);
    } else if (cy.texture === "auto") vary.push("質感");
    if (cyGlowVals.length >= 2) {
      fixed.push(`発光色：${cyGlowVals.map(v => cyl("glowColor", v)).join("・")}のグラデーション発光`);
    } else if (cy.glowColor !== "auto" && cy.glowColor !== "skip") {
      fixed.push(`発光色：${cyl("glowColor", cy.glowColor)}（固定）`);
    } else if (cy.glowColor === "auto") vary.push("発光色");
    // 変化量：skip か具体値のみ
    if (cy.intensity !== "skip") fixed.push(`変化量：${CYBER_LABELS.intensity[cy.intensity]}（固定）`);

    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`機械化・サイボーグ化の指示：${parts.join(" / ")}`);
    }

    lines.push(
      "【機械化変更ルール — 絶対厳守】\n" +
      "- 元画像の『一部だけ』をSF的・デジタル的に変化させる。全身を別キャラに変換しない。\n" +
      "- 顔全体・顔の造形・目鼻立ち・表情・人物の同一性は絶対に変更しない。\n" +
      "- 体型・ポーズ・カメラ構図・背景は維持する（変更範囲に含まれていない限り）。\n" +
      "- 生々しい・痛々しい方向の表現は避け、クリーンで美しいSFデザインに統合する。\n" +
      "- 機械化部位と元の部位の境界は自然なグラデーションで繋ぎ、美しいSFデザインとして統合する。\n" +
      "- 変化は洗練されたSFアート・デザイン表現として描画する。"
    );
  }

  if (scopes.includes("background")) {
    const b = details.background;
    const fixed: string[] = [];
    const vary: string[] = [];
    // 背景スタイル（絵画・アート・素材系）
    if (b.style && b.style !== "auto" && b.style !== "skip")
      fixed.push(`【背景スタイル】：${BG_LABELS.style[b.style as keyof typeof BG_LABELS.style]}（固定）`);
    else if (b.style === "auto") vary.push("背景スタイル");
    const bgPlaceVals = getMultiVals(details.multiOverrides, "background.place");
    if (bgPlaceVals.length >= 2) {
      fixed.push(`場所：${bgPlaceVals.map(v => (BG_LABELS.place as Record<string, string>)[v] ?? v).join("と")}を組み合わせた空間（複数ロケーションを自然に融合）`);
    } else if (b.place !== "auto" && b.place !== "skip") {
      fixed.push(`場所：${BG_LABELS.place[b.place as keyof typeof BG_LABELS.place]}（固定）`);
    } else if (b.place === "auto") vary.push("場所");
    if (b.color !== "auto" && b.color !== "skip") fixed.push(`色：${BG_LABELS.color[b.color as keyof typeof BG_LABELS.color]}（固定）`);
    else if (b.color === "auto") vary.push("色");
    if (b.density !== "auto" && b.density !== "skip") fixed.push(`密度：${BG_LABELS.density[b.density]}（固定）`);
    else if (b.density === "auto") vary.push("密度");
    if (b.effect !== "auto" && b.effect !== "skip") fixed.push(`空間効果：${BG_LABELS.effect[b.effect as keyof typeof BG_LABELS.effect]}（固定）`);
    else if (b.effect === "auto") vary.push("空間効果");
    if (b.time !== "auto" && b.time !== "skip") fixed.push(`時間帯：${BG_LABELS.time[b.time]}（固定）`);
    else if (b.time === "auto") vary.push("時間帯");
    if (b.weather !== "auto" && b.weather !== "skip") fixed.push(`天候：${BG_LABELS.weather[b.weather]}（固定）`);
    else if (b.weather === "auto") vary.push("天候");
    if (b.depth !== "auto" && b.depth !== "skip") fixed.push(`奥行き：${BG_LABELS.depth[b.depth]}（固定）`);
    else if (b.depth === "auto") vary.push("奥行き");
    if (b.info !== "auto" && b.info !== "skip") fixed.push(`情報量：${BG_LABELS.info[b.info]}（固定）`);
    else if (b.info === "auto") vary.push("情報量");
    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向で変化させる` : "",
      ].filter(Boolean);
      lines.push(`背景の指示：${parts.join(" / ")}`);
    }
    // 背景の多様性確保：場所・スタイルが未指定（skip／auto）の場合、ネオン系への偏りを抑制
    const styleUnset = !b.style || b.style === "auto" || b.style === "skip";
    const placeUnset = b.place === "auto" || b.place === "skip";
    if (styleUnset && placeUnset) {
      lines.push(
        "【背景バリエーション指示】背景の場所・スタイルが明示指定されていないため、案ごとに多様な方向から選ぶ：\n" +
        "- ネオン街・サイバー都市・電脳都市・雨の路地・日本語ネオンサイン・ブレードランナー風はデフォルト採用禁止（全案の15%以内）。\n" +
        "- 【自然系】森・花畑・海辺・空・雲海・雨上がり・湖・水辺 を積極的に採用する。\n" +
        "- 【抽象系】単色・グラデーション・光粒子・幾何学・現代アート・水彩・水墨・油絵・ミニマル を均等に使う。\n" +
        "- 【室内系】スタジオ・白空間・黒空間・美術館・ホテル・ラウンジ・ガラス空間・未来室内 も選択肢に含める。\n" +
        "- 【幻想系】幻想空間・月夜・神秘空間・夢空間・ファンタジー背景 も積極的に採用する。\n" +
        "- 各案で背景の方向性を明確に差別化し、同じ傾向が連続しないようにする。"
      );
    }
  }

  if (scopes.includes("foreground")) {
    const fg = details.foreground;
    const fixed: string[] = [];
    const vary: string[] = [];

    // ヘルパー：ラベル取得
    const fgl = <K extends keyof typeof FOREGROUND_LABELS>(field: K, val: string): string =>
      (FOREGROUND_LABELS[field] as Record<string, string>)[val] ?? val;

    // preset はその他のフィールドを一括上書きするため単独で扱う
    if (fg.preset !== "auto" && fg.preset !== "skip") {
      fixed.push(`前景プリセット：${fgl("preset", fg.preset)}（固定）`);
    } else if (fg.preset === "auto") vary.push("前景プリセット");

    if (fg.effectType !== "auto" && fg.effectType !== "skip") fixed.push(`エフェクト種類：${fgl("effectType", fg.effectType)}（固定）`);
    else if (fg.effectType === "auto") vary.push("エフェクト種類");
    if (fg.swirlType !== "auto" && fg.swirlType !== "skip") fixed.push(`回転・渦：${fgl("swirlType", fg.swirlType)}（固定）`);
    else if (fg.swirlType === "auto") vary.push("回転・渦");
    if (fg.digitalType !== "auto" && fg.digitalType !== "skip") fixed.push(`HUD・デジタル：${fgl("digitalType", fg.digitalType)}（固定）`);
    else if (fg.digitalType === "auto") vary.push("HUD・デジタル");
    if (fg.artType !== "auto" && fg.artType !== "skip") fixed.push(`アート表現：${fgl("artType", fg.artType)}（固定）`);
    else if (fg.artType === "auto") vary.push("アート表現");
    if (fg.position !== "auto" && fg.position !== "skip") fixed.push(`位置：${fgl("position", fg.position)}（固定）`);
    else if (fg.position === "auto") vary.push("位置");
    if (fg.density !== "auto" && fg.density !== "skip") fixed.push(`密度：${fgl("density", fg.density)}（固定）`);
    else if (fg.density === "auto") vary.push("密度");
    if (fg.motion !== "auto" && fg.motion !== "skip") fixed.push(`動き：${fgl("motion", fg.motion)}（固定）`);
    else if (fg.motion === "auto") vary.push("動き");
    if (fg.color !== "auto" && fg.color !== "skip") fixed.push(`色方向：${fgl("color", fg.color)}（固定）`);
    else if (fg.color === "auto") vary.push("色方向");
    if (fg.depth !== "auto" && fg.depth !== "skip") fixed.push(`奥行き：${fgl("depth", fg.depth)}（固定）`);
    else if (fg.depth === "auto") vary.push("奥行き");
    // visibility は常に face_protected に近い値のため skip 以外は固定扱い
    if (fg.visibility !== "skip") fixed.push(`視認性：${fgl("visibility", fg.visibility)}（固定）`);

    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`前景演出の指示：${parts.join(" / ")}`);
    }

    lines.push(
      "【前景演出ルール — 絶対厳守】\n" +
      "- 人物の手前（カメラに近い側）にエフェクト・演出を重ねる。ポーズ・体型・衣装は変更しない。\n" +
      "- 顔・目・表情・人物の同一性は絶対に隠さない・変更しない。顔は常に視認できるようにする。\n" +
      "- エフェクトは背景色・衣装色と自然に馴染ませる（光源・色温度を整合させる）。\n" +
      "- 粒子・光は前後に重なり、画面に奥行きと立体感を出す。\n" +
      "- 各案でエフェクトの種類・色・密度・動きを明確に差別化する。"
    );
  }

  if (scopes.includes("pose")) {
    const p = details.pose;
    const fixed: string[] = [];
    const vary: string[] = [];
    if (p.type !== "auto" && p.type !== "skip") fixed.push(`種類：${POSE_LABELS.type[p.type]}（固定）`);
    else if (p.type === "auto") vary.push("種類");
    if (p.impression !== "auto" && p.impression !== "skip") fixed.push(`印象：${POSE_LABELS.impression[p.impression]}（固定）`);
    else if (p.impression === "auto") vary.push("印象");
    if (p.hand !== "auto" && p.hand !== "skip") fixed.push(`手：${POSE_LABELS.hand[p.hand]}（固定）`);
    else if (p.hand === "auto") vary.push("手の位置");
    if (p.foot !== "auto" && p.foot !== "skip") fixed.push(`足：${POSE_LABELS.foot[p.foot]}（固定）`);
    else if (p.foot === "auto") vary.push("足の位置");
    if (p.balance !== "auto" && p.balance !== "skip") fixed.push(`重心：${POSE_LABELS.balance[p.balance]}（固定）`);
    else if (p.balance === "auto") vary.push("重心");
    if (p.motion !== "auto" && p.motion !== "skip") fixed.push(`動き：${POSE_LABELS.motion[p.motion]}（固定）`);
    else if (p.motion === "auto") vary.push("動き");
    if (p.gaze !== "auto" && p.gaze !== "skip") fixed.push(`視線：${POSE_LABELS.gaze[p.gaze]}（固定）`);
    else if (p.gaze === "auto") vary.push("視線");
    if (p.orientation !== "auto" && p.orientation !== "skip") fixed.push(`体の向き：${POSE_LABELS.orientation[p.orientation]}（固定）`);
    else if (p.orientation === "auto") vary.push("体の向き");
    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`ポーズの指示：${parts.join(" / ")}`);
    }
  }

  if (scopes.includes("camera")) {
    const c = details.camera;
    if (c.custom3D) {
      // 3D ピッカーで具体指定された場合は、それを最優先で反映する
      const desc = describeCustom3D(c.custom3D);
      lines.push(`カメラの指示（3Dピッカーで具体指定・全案で厳守）：${desc}`);
      const extras: string[] = [];
      if (c.lens !== "auto" && c.lens !== "skip") extras.push(`レンズ感：${CAMERA_LABELS.lens[c.lens]}`);
      if (c.fov !== "auto" && c.fov !== "skip") extras.push(`画角：${CAMERA_LABELS.fov[c.fov]}`);
      if (c.composition !== "auto" && c.composition !== "skip") extras.push(`構図補助：${CAMERA_LABELS.composition[c.composition]}`);
      if (extras.length > 0) {
        lines.push(`カメラ補助：${extras.join(" / ")}`);
      }
    } else {
      const fixed: string[] = [];
      const vary: string[] = [];
      const camAngleVals = getMultiVals(details.multiOverrides, "camera.angle");
      const camDistVals  = getMultiVals(details.multiOverrides, "camera.distance");
      const camLensVals  = getMultiVals(details.multiOverrides, "camera.lens");
      const camCompVals  = getMultiVals(details.multiOverrides, "camera.composition");
      if (camAngleVals.length >= 2) {
        fixed.push(`アングル：${camAngleVals.map(v => (CAMERA_LABELS.angle as Record<string, string>)[v] ?? v).join("×")}を組み合わせた複合アングル`);
      } else if (c.angle !== "auto" && c.angle !== "skip") {
        fixed.push(`アングル：${CAMERA_LABELS.angle[c.angle]}（固定）`);
      } else if (c.angle === "auto") vary.push("アングル");
      if (camDistVals.length >= 2) {
        fixed.push(`距離：${camDistVals.map(v => (CAMERA_LABELS.distance as Record<string, string>)[v] ?? v).join("と")}を組み合わせた距離感`);
      } else if (c.distance !== "auto" && c.distance !== "skip") {
        fixed.push(`距離：${CAMERA_LABELS.distance[c.distance]}（固定）`);
      } else if (c.distance === "auto") vary.push("距離");
      if (camLensVals.length >= 2) {
        fixed.push(`レンズ感：${camLensVals.map(v => (CAMERA_LABELS.lens as Record<string, string>)[v] ?? v).join("×")}のミックスレンズ効果`);
      } else if (c.lens !== "auto" && c.lens !== "skip") {
        fixed.push(`レンズ感：${CAMERA_LABELS.lens[c.lens]}（固定）`);
      } else if (c.lens === "auto") vary.push("レンズ感");
      if (camCompVals.length >= 2) {
        fixed.push(`構図：${camCompVals.map(v => (CAMERA_LABELS.composition as Record<string, string>)[v] ?? v).join("と")}を組み合わせた複合構図`);
      } else if (c.composition !== "auto" && c.composition !== "skip") {
        fixed.push(`構図：${CAMERA_LABELS.composition[c.composition]}（固定）`);
      } else if (c.composition === "auto") vary.push("構図");
      if (c.fov !== "auto" && c.fov !== "skip") fixed.push(`画角：${CAMERA_LABELS.fov[c.fov]}（固定）`);
      else if (c.fov === "auto") vary.push("画角");
      if (c.eyeHeight !== "auto" && c.eyeHeight !== "skip") fixed.push(`視点高さ：${CAMERA_LABELS.eyeHeight[c.eyeHeight]}（固定）`);
      else if (c.eyeHeight === "auto") vary.push("視点高さ");
      if (fixed.length > 0 || vary.length > 0) {
        const parts = [
          ...fixed,
          vary.length ? `${vary.join("・")}は案ごとに異なる視点で変化させる` : "",
        ].filter(Boolean);
        lines.push(`カメラの指示：${parts.join(" / ")}`);
      }
    }
  }

  if (scopes.includes("props")) {
    const p = details.props;
    const parts: string[] = [];
    const propsCatVals = getMultiVals(details.multiOverrides, "props.category");
    if (propsCatVals.length >= 2) {
      parts.push(`カテゴリ：${propsCatVals.map(v => (PROPS_LABELS.category as Record<string, string>)[v] ?? v).join("と")}を組み合わせた小物（複数カテゴリの要素を自然に混在させる）`);
    } else if (p.category !== "auto" && p.category !== "skip") {
      parts.push(`カテゴリ：${PROPS_LABELS.category[p.category]}（固定。例示の中から1つ選ぶか、近い性質のものを採用）`);
    } else if (p.category === "auto") {
      parts.push("カテゴリ：おまかせ（案ごとに異なるカテゴリを選び、被らないようにする）");
    }
    if (p.hold !== "auto" && p.hold !== "skip") parts.push(`持たせ方：${PROPS_LABELS.hold[p.hold]}（固定）`);
    if (p.size !== "auto" && p.size !== "skip") parts.push(`サイズ：${PROPS_LABELS.size[p.size]}（固定）`);
    if (p.glow !== "auto" && p.glow !== "skip") parts.push(`光り方：${PROPS_LABELS.glow[p.glow]}（固定）`);
    if (p.vibe !== "auto" && p.vibe !== "skip") parts.push(`雰囲気：${PROPS_LABELS.vibe[p.vibe]}（固定）`);
    if (p.placement !== "auto" && p.placement !== "skip") parts.push(`配置：${PROPS_LABELS.placement[p.placement]}（固定）`);
    if (p.count !== "auto" && p.count !== "skip") parts.push(`個数：${PROPS_LABELS.count[p.count]}（固定）`);
    if (parts.length > 0) {
      lines.push(`持ち物・小物の指示：${parts.join(" / ")}`);
    }
  }

  if (scopes.includes("big_object") && details.bigObject) {
    const bo = details.bigObject;
    const fixed: string[] = [];
    const vary: string[] = [];

    const bol = <K extends keyof typeof BIG_OBJECT_LABELS>(field: K, val: string): string =>
      (BIG_OBJECT_LABELS[field] as Record<string, string>)[val] ?? val;

    const boGenreVals = getMultiVals(details.multiOverrides, "bigObject.genre");
    if (boGenreVals.length >= 2) {
      fixed.push(`系統：${boGenreVals.map(v => bol("genre", v)).join("×")}を組み合わせた複合演出`);
    } else if (bo.genre !== "auto" && bo.genre !== "skip") {
      fixed.push(`系統：${bol("genre", bo.genre)}（固定）`);
    } else if (bo.genre === "auto") vary.push("系統");
    if (bo.type !== "auto" && bo.type !== "skip") fixed.push(`種類：${bol("type", bo.type)}（固定）`);
    else if (bo.type === "auto") vary.push("種類");
    if (bo.condition !== "auto" && bo.condition !== "skip") fixed.push(`状態：${bol("condition", bo.condition)}（固定）`);
    else if (bo.condition === "auto") vary.push("状態");
    if (bo.placement !== "auto" && bo.placement !== "skip") fixed.push(`配置：${bol("placement", bo.placement)}（固定）`);
    else if (bo.placement === "auto") vary.push("配置");
    if (bo.size !== "auto" && bo.size !== "skip") fixed.push(`サイズ：${bol("size", bo.size)}（固定）`);
    else if (bo.size === "auto") vary.push("サイズ");
    if (bo.mood !== "auto" && bo.mood !== "skip") fixed.push(`雰囲気：${bol("mood", bo.mood)}（固定）`);
    else if (bo.mood === "auto") vary.push("雰囲気");

    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`大物・大道具の指示：${parts.join(" / ")}`);
    }

    lines.push(
      "【大物・大道具ルール — 絶対厳守】\n" +
      "- 人物（被写体）が主役。大型オブジェは演出・舞台装置として機能させ、オブジェの説明に終始しない。\n" +
      "- 顔の造形・目鼻立ち・表情・人物の同一性は完全維持。体型・ポーズ・衣装は変更範囲に含まれていない限り維持。\n" +
      "- 大物は必ず人物の存在感・物語性・映像美を高める方向で演出する。\n" +
      "- 「ありふれた可愛い大物（巨大テディベア・巨大花束・普通のぬいぐるみ等）」は避ける。意外性・物語性・映画感・SNS映えを優先する。\n" +
      "- 「なぜそれがそこにあるの？」と思わせる意外な構図を優先する。\n" +
      "- 過剰に怖い・生々しい方向の表現は避け、あくまで美しくアート的な演出にする。\n" +
      "- 各案でオブジェの種類・配置・状態・雰囲気を完全に差別化し、同じパターンを繰り返さない。"
    );
  }

  if (scopes.includes("vehicle")) {
    const v = details.vehicle;
    const fixed: string[] = [];
    const vary: string[] = [];

    const vl = <K extends keyof typeof VEHICLE_LABELS>(field: K, val: string): string =>
      (VEHICLE_LABELS[field] as Record<string, string>)[val] ?? val;

    if (v.genre !== "auto" && v.genre !== "skip") fixed.push(`ジャンル：${vl("genre", v.genre)}（固定）`);
    else if (v.genre === "auto") vary.push("ジャンル");
    if (v.type !== "auto" && v.type !== "skip") fixed.push(`種類：${vl("type", v.type)}（固定）`);
    else if (v.type === "auto") vary.push("種類");
    if (v.interaction !== "auto" && v.interaction !== "skip") fixed.push(`関わり方：${vl("interaction", v.interaction)}（固定）`);
    else if (v.interaction === "auto") vary.push("関わり方");
    if (v.era !== "auto" && v.era !== "skip") fixed.push(`時代感：${vl("era", v.era)}（固定）`);
    else if (v.era === "auto") vary.push("時代感");
    if (v.material !== "auto" && v.material !== "skip") fixed.push(`素材感：${vl("material", v.material)}（固定）`);
    else if (v.material === "auto") vary.push("素材感");
    if (v.atmosphere !== "auto" && v.atmosphere !== "skip") fixed.push(`雰囲気：${vl("atmosphere", v.atmosphere)}（固定）`);
    else if (v.atmosphere === "auto") vary.push("雰囲気");

    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`乗り物の指示：${parts.join(" / ")}`);
    }

    lines.push(
      "【乗り物ルール — 絶対厳守】\n" +
      "- 人物（被写体）が主役。乗り物は脇役・背景要素として機能させる。乗り物の説明に終始しない。\n" +
      "- 顔の造形・目鼻立ち・表情・人物の同一性は完全維持。体型・ポーズは変更範囲に含まれていない限り維持。\n" +
      "- ミリタリー系の車両は必ず『展示・停止状態』として描写。動いている描写や争いの場面は描かない。\n" +
      "- 既存のアニメ・映画・ゲームに登場する固有の乗り物名（ガンダム・エヴァ等）は使わない。オリジナルデザインとして描く。\n" +
      "- ありきたりなクリシェ（ネオン光るバイク1台のみ・真っ黒スポーツカーのみ）は避け、構図・背景との調和を重視する。\n" +
      "- 乗り物の演出は安全で美しいビジュアル表現とし、穏やかで上品な雰囲気にまとめる。"
    );
  }

  if (scopes.includes("myth")) {
    const m = details.myth;
    const fixed: string[] = [];
    const vary: string[] = [];

    const ml = <K extends keyof typeof MYTH_LABELS>(field: K, val: string): string =>
      (MYTH_LABELS[field] as Record<string, string>)[val] ?? val;

    const mythRegionVals   = getMultiVals(details.multiOverrides, "myth.region");
    const mythCreatureVals = getMultiVals(details.multiOverrides, "myth.creature");
    if (mythRegionVals.length >= 2) {
      fixed.push(`神話地域：${mythRegionVals.map(v => ml("region", v)).join("×")}の神話を融合したオリジナル幻獣`);
    } else if (m.region !== "auto" && m.region !== "skip") {
      fixed.push(`神話地域：${ml("region", m.region)}（固定）`);
    } else if (m.region === "auto") vary.push("神話地域");
    if (mythCreatureVals.length >= 2) {
      fixed.push(`幻獣種別：${mythCreatureVals.map(v => ml("creature", v)).join("と")}の特徴を持つ複合幻獣`);
    } else if (m.creature !== "auto" && m.creature !== "skip") {
      fixed.push(`幻獣種別：${ml("creature", m.creature)}（固定）`);
    } else if (m.creature === "auto") vary.push("幻獣種別");
    if (m.interaction !== "auto" && m.interaction !== "skip") fixed.push(`配置：${ml("interaction", m.interaction)}（固定）`);
    else if (m.interaction === "auto") vary.push("配置");
    if (m.style !== "auto" && m.style !== "skip") fixed.push(`描写スタイル：${ml("style", m.style)}（固定）`);
    else if (m.style === "auto") vary.push("描写スタイル");
    if (m.size !== "auto" && m.size !== "skip") fixed.push(`サイズ感：${ml("size", m.size)}（固定）`);
    else if (m.size === "auto") vary.push("サイズ感");

    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる方向性で変化させる` : "",
      ].filter(Boolean);
      lines.push(`神話/幻獣の指示：${parts.join(" / ")}`);
    }

    lines.push(
      "【神話/幻獣ルール — 絶対厳守】\n" +
      "- 人物（被写体）が主役。幻獣は演出・背景要素として機能させ、幻獣の説明に終始しない。\n" +
      "- 顔の造形・目鼻立ち・表情・人物の同一性・衣装・ポーズは完全維持。\n" +
      "- 既存のアニメ・ゲーム・映画に登場する固有キャラクター名（ガンダム・ポケモン・DQ・FF等の固有名詞）は使わない。オリジナルデザインとして描く。\n" +
      "- 幻獣のデザインは神話の文化的特徴を活かしつつ、美しく・神秘的・迫力ある描写にする。\n" +
      "- 生々しい描写は避け、神聖・神秘・壮大・美麗なイメージで表現する。\n" +
      "- 各案で幻獣の種類・配置・色・雰囲気を完全に差別化し、同じパターンを繰り返さない。"
    );
  }

  if (scopes.includes("lighting")) {
    const l = details.lighting;
    const fixed: string[] = [];
    const vary: string[] = [];
    const lightDirVals  = getMultiVals(details.multiOverrides, "lighting.direction");
    const lightIntVals  = getMultiVals(details.multiOverrides, "lighting.intensity");
    const lightTempVals = getMultiVals(details.multiOverrides, "lighting.temperature");
    const lightShdVals  = getMultiVals(details.multiOverrides, "lighting.shadow");
    const lightReflVals = getMultiVals(details.multiOverrides, "lighting.reflection");
    if (lightDirVals.length >= 2) {
      fixed.push(`光源方向：${lightDirVals.map(v => (LIGHTING_LABELS.direction as Record<string, string>)[v] ?? v).join("と")}の複合光源`);
    } else if (l.direction !== "auto" && l.direction !== "skip") {
      fixed.push(`光源方向：${LIGHTING_LABELS.direction[l.direction]}（固定）`);
    } else if (l.direction === "auto") vary.push("光源方向");
    if (lightIntVals.length >= 2) {
      fixed.push(`光の強さ：${lightIntVals.map(v => (LIGHTING_LABELS.intensity as Record<string, string>)[v] ?? v).join("と")}を組み合わせた光量`);
    } else if (l.intensity !== "auto" && l.intensity !== "skip") {
      fixed.push(`光の強さ：${LIGHTING_LABELS.intensity[l.intensity]}（固定）`);
    } else if (l.intensity === "auto") vary.push("光の強さ");
    if (lightTempVals.length >= 2) {
      fixed.push(`色温度：${lightTempVals.map(v => (LIGHTING_LABELS.temperature as Record<string, string>)[v] ?? v).join("×")}のミックス光色`);
    } else if (l.temperature !== "auto" && l.temperature !== "skip") {
      fixed.push(`色温度：${LIGHTING_LABELS.temperature[l.temperature]}（固定）`);
    } else if (l.temperature === "auto") vary.push("色温度");
    if (lightShdVals.length >= 2) {
      fixed.push(`影：${lightShdVals.map(v => (LIGHTING_LABELS.shadow as Record<string, string>)[v] ?? v).join("と")}の複合影表現`);
    } else if (l.shadow !== "auto" && l.shadow !== "skip") {
      fixed.push(`影：${LIGHTING_LABELS.shadow[l.shadow]}（固定）`);
    } else if (l.shadow === "auto") vary.push("影");
    if (lightReflVals.length >= 2) {
      fixed.push(`反射：${lightReflVals.map(v => (LIGHTING_LABELS.reflection as Record<string, string>)[v] ?? v).join("×")}のミックス反射`);
    } else if (l.reflection !== "auto" && l.reflection !== "skip") {
      fixed.push(`反射：${LIGHTING_LABELS.reflection[l.reflection]}（固定）`);
    } else if (l.reflection === "auto") vary.push("反射");
    if (l.atmosphere !== "auto" && l.atmosphere !== "skip") fixed.push(`空気感：${LIGHTING_LABELS.atmosphere[l.atmosphere]}（固定）`);
    else if (l.atmosphere === "auto") vary.push("空気感");
    if (fixed.length > 0 || vary.length > 0) {
      const parts = [
        ...fixed,
        vary.length ? `${vary.join("・")}は案ごとに異なる表情で変化させる` : "",
      ].filter(Boolean);
      lines.push(`ライティングの指示：${parts.join(" / ")}`);
      lines.push(
        "ライティング変更時の絶対条件：被写体の顔・髪・衣装・背景・ポーズ・カメラ・アスペクト比は固定。" +
          "光源方向・影・反射・色温度・空気感のみ変更する。"
      );
    }
  }

  if (scopes.includes("aspect_ratio") && details.aspectRatio.preset !== "skip") {
    const ar = details.aspectRatio;
    const label =
      ar.preset === "custom"
        ? `カスタム比率 ${ar.customW}:${ar.customH}`
        : (ASPECT_RATIO_LABELS[ar.preset] ?? ar.preset);
    lines.push(
      `アスペクト比の指示：${label}（全案で統一して適用）。` +
        "被写体の顔・体型・髪・衣装・ポーズ・人物の同一性・色味は完全固定。トリミング・余白・画面比率のみ変更する。"
    );
  }

  return lines.join("\n");
}

function lockLineJa(locks: Record<LockKey, boolean>, scopes: Scope[], pt: PromptTarget = "full"): string {
  const want = new Set<LockKey>();
  for (const s of scopes) for (const k of SCOPE_TO_LOCKS[s]) want.add(k);
  if (scopes.includes("camera")) want.delete("camera");
  if (scopes.includes("aspect_ratio")) want.delete("aspect_ratio");
  const keys = Array.from(want).filter((k) => locks[k]);
  if (keys.length === 0) return "";

  // safe モードでは "体型" を中立表現に置き換え、"完全に維持" も言い換える
  const LOCK_JA_SAFE: Record<LockKey, string> = {
    ...LOCK_JA,
    body_shape: "外観スタイル",
  };
  const labelMap = pt === "full" ? LOCK_JA : LOCK_JA_SAFE;
  const verb = pt === "full" ? "完全に維持し、変更しない" : "一貫性を保ち、変更しない";
  return `入力画像の${keys.map((k) => labelMap[k]).join("・")}は${verb}。`;
}

function safetyJa(req: GenerateRequest): string {
  const target = req.scopes.map((s) => SCOPE_JA[s]).join("・") || "指定範囲";
  if (req.safety === "fictional_ai") {
    return (
      "この画像は実在人物ではなく、AIで生成された架空の人物キャラクターです。" +
      "本人確認・有名人・実在人物の再現ではありません。" +
      `元画像の架空キャラクター性を保ったまま、画像編集として${target}のみを変更してください。`
    );
  }
  return `入力画像の被写体は完全未編集のまま固定し、${target}のみを再構築する。人物描写なし。顔・身体・服装・表情への変更なし。`;
}

/** 一発バズりモードの内部プール。各案で異なる要素を採用させる。武器は除外。 */
const VIRAL_POOL = [
  "透明傘",
  "発光スマホ",
  "巨大リボン",
  "狐面",
  "発光蝶",
  "透明な羽",
  "花びら",
  "ガラス破片",
  "黒薔薇",
  "巨大ハート",
  "魔法陣",
  "カラフルなペンキ",
  "光るキューブ",
  "光の羽根",
  "水の球",
  "花冠",
];

function faceLockBlock(pt: PromptTarget = "full"): string {
  if (pt === "nano_safe") {
    return [
      "【架空キャラクター一貫性ロック】",
      "- 参照画像はAI生成の架空キャラクター。実在人物ではありません。",
      "- 架空キャラクターの顔の特徴・髪型・外観スタイル・表情・視覚的一貫性を維持する。",
      "- キャラクターデザインの核となる要素（顔立ち・髪型・全体スタイル）は変えない。",
      "- ポーズ・カメラ・アスペクト比はなるべく維持する。",
    ].join("\n");
  }
  if (pt === "chatgpt_safe" || pt === "gemini_safe") {
    return [
      "【キャラクター一貫性ロック】",
      "- キャラクターの視覚的特徴、一貫した顔立ち、髪型、全体の雰囲気を維持する。",
      "- 同一キャラクターとして一貫性を保つ。見た目の核となる要素を変えない。",
      "- 表情スコープが含まれる場合でも、顔立ちの核は固定し、表情ニュアンスのみ変える。",
    ].join("\n");
  }
  // full（従来）
  return [
    "【顔絶対固定ロック】",
    "- 顔の造形、目、鼻、口、輪郭、表情の細部、人物の同一性は完全に維持する。",
    "- 顔の特徴・印象は固定。人物の視覚的同一性を保つ。",
    "- 表情スコープが変更範囲に含まれる場合でも、目・鼻・口の形そのものは変えず、ニュアンスだけ変える。",
  ].join("\n");
}

// 表情変更ブロック（日本語ラベルマップ）
const EXPRESSION_JA: Record<Expression, string> = {
  neutral:      "無表情",
  smile:        "微笑み",
  cold:         "冷たい眼差し",
  assertive:    "強気",
  sad:          "悲しげ",
  sleepy:       "眠そう",
  elegant:      "上品",
  cool:         "クール",
  ephemeral:    "儚げ",
  intimidating: "威圧感",
};

/**
 * expressionUnlockBlock — faceLock: false 時に注入する表情変更指示。
 * 顔の造形・同一性は維持しつつ、表情ニュアンスのみ変更する。
 * expression が null の場合は「表情自由」指示を返す。
 */
function expressionUnlockBlock(expression: Expression | null | undefined, pt: PromptTarget = "full"): string {
  const exprLabel = expression ? EXPRESSION_JA[expression] : null;

  if (pt === "nano_safe") {
    return exprLabel
      ? [
          "【表情変更モード（架空キャラクター）】",
          `- 架空キャラクターの顔の造形・外観スタイル・視覚的一貫性は維持する。`,
          `- 表情のみ「${exprLabel}」に変更する。目・鼻・口の形そのものは変えず、眼差し・口元のニュアンスのみ調整する。`,
        ].join("\n")
      : [
          "【表情変更モード（架空キャラクター）】",
          "- 架空キャラクターの顔の造形・外観スタイル・視覚的一貫性は維持する。",
          "- 表情は自然で魅力的なものにする。ただし顔立ちの核は変えない。",
        ].join("\n");
  }

  if (pt === "chatgpt_safe" || pt === "gemini_safe") {
    return exprLabel
      ? [
          "【表情変更モード】",
          `- キャラクターの顔立ち・同一性・髪型・全体の視覚的一貫性は維持する。`,
          `- 表情のみ「${exprLabel}」に変更する。目・鼻・口の形は変えず、眼差し・口元のニュアンスのみ変える。`,
        ].join("\n")
      : [
          "【表情変更モード】",
          "- キャラクターの顔立ち・同一性・髪型・全体の視覚的一貫性は維持する。",
          "- 表情は自然で魅力的なものにする。顔立ちの核は変えない。",
        ].join("\n");
  }

  // full
  return exprLabel
    ? [
        "【表情変更モード】",
        `- 顔の造形（目・鼻・口の形）・輪郭・人物の同一性は完全に維持する。`,
        `- 表情のみ「${exprLabel}」に自然に変更する。`,
        "- 目・鼻・口の解剖学的形状は変えず、眼差しの方向・瞼の開き・口角・表情筋のニュアンスのみ調整する。",
        "- 別人化は絶対禁止。顔の印象が変わりすぎないよう注意する。",
      ].join("\n")
    : [
        "【表情変更モード】",
        "- 顔の造形（目・鼻・口の形）・輪郭・人物の同一性は完全に維持する。",
        "- 表情は自然で魅力的なものにする。顔立ちの核は変えない。",
        "- 別人化は絶対禁止。",
      ].join("\n");
}

/**
 * Nano Banana 専用：参照画像が架空AIキャラクターであることを宣言するブロック。
 * 実在人物の誤判定を防ぐため、pt === "nano_safe" 時にシステムプロンプトへ注入する。
 * （安全制限の回避ではなく、AIで生成された架空キャラクター画像の正確な記述のための整備）
 */
function nanoCharacterBlock(): string {
  return [
    "【Nano Banana 専用前提 — AI架空キャラクター編集】",
    "参照画像は、実在人物ではなく、AIで生成された架空のキャラクターイラスト・合成画像です。",
    "有名人・本人確認・実在人物の再現ではありません。",
    "この架空キャラクターのデザインを基準に、指定部分のみ画像編集として変更してください。",
    "",
    "▼ 出力プロンプトで使う表現：",
    "  ✓ 架空キャラクター / AI生成の架空キャラクター / キャラクターデザイン",
    "  ✓ 視覚的一貫性 / 外観スタイル / キャラクターの特徴 / 参照画像のキャラクター",
    "  ✗ 人物 / 本人 / 実在人物 / ポートレート写真 / 顔を維持 / 人物の同一性",
    "",
    "▼ Nano Banana 軽量化ルール（品質維持のため厳守）：",
    "  - 各案は短く・簡潔に。長い世界観説明・抽象的な雰囲気表現・冗長な修飾は避ける。",
    "  - 【固定】（顔の特徴・目・前髪・表情・視覚的一貫性・体型・ポーズ・アスペクト比の維持）を必ず冒頭に置く。",
    "  - 変更は『主要な3項目まで』に絞る。4項目以上ある場合は優先度の高い3つ（衣装→髪→ライティング→背景の順）を選び、残りは省略するか一言で要約する。",
    "  - 魚眼・超ローアングル・ドローン視点などの強いカメラ指定や、複数の前景演出を同時に盛らない。",
    "  - 元画像の雰囲気・画風・質感・顔の印象を維持する一文を必ず入れる。",
    "  - 1回で全部を変えようとしない。簡潔で破綻しない指示を優先する。",
  ].join("\n");
}

/**
 * 手足・関節補正ブロック。全案・全モード・全スコープで常時適用。省略不可。
 */
function bodyFixBlock(): string {
  return [
    "【人体補正ルール — 全案・全モード・全スコープ・絶対省略禁止】",
    "出力するすべての案の末尾（【NG】の直前、または【品質】の直後）に",
    "【人体補正】セクションを必ず 1 行含める。このルールに例外はない。",
    "─ 補正内容 ─",
    "・手・指（片手は必ず5本）・手首・肘・腕の解剖学的整合性を維持する。",
    "・余分な指・欠損した指・融合した指・不自然な手首/肘の角度を修正する。",
    "・脚・膝・足首・つま先の角度と接地感を物理的に自然にする。",
    "・影・接触影・重心バランスも物理的に整合させる。",
    "─ 出力時の文例（そのまま使ってよい）─",
    "【人体補正】手は片手5本指・自然な関節構造・手首肘なめらか。脚・膝・足首・接地感を物理的に正確に整合。" +
      " Anatomically correct hands (5 fingers each), wrists, elbows, legs, knees, ankles, grounding.",
  ].join("\n");
}

function ngBlock(ngList: string): string {
  const cleaned = ngList.trim();
  if (!cleaned) return "";
  return [
    "【NG指定（必ず除外）】",
    cleaned,
    "出力プロンプト本文の末尾に必ず【NG】セクションとして含めること。",
  ].join("\n");
}

/**
 * 出力プロンプトのスタイルガイドブロック。
 * NG ワードを羅列すると Gemini 自身の安全フィルターが反応するため、
 * 「何を使わないか」ではなく「どう書くか（ポジティブ指示）」のみを記述する。
 */
function sanitizerBlock(pt: PromptTarget): string {
  if (pt === "full") return "";

  const platformName =
    pt === "chatgpt_safe" ? "ChatGPT Image (DALL-E)" :
    pt === "gemini_safe"  ? "Gemini Image Generation" :
                            "Nano Banana";

  const base = [
    `【出力プロンプト スタイルガイド — ${platformName} 向け】`,
    "出力するプロンプト本文は以下のスタイルに従って記述してください：",
    "",
    "▼ キャラクター同一性の記述：",
    "  「視覚的特徴を維持」「一貫性を保つ」「外観スタイルを維持」「visual identity を保持」の表現を使う。",
    "",
    "▼ 衣装の記述：",
    "  衣装はデザイン系統・色・素材・シルエットで表現する。",
    "  ファッション的・スタイリッシュな表現に集中する。",
  ];

  if (pt === "chatgpt_safe") {
    base.push("");
    base.push("▼ ChatGPT 向け記述方針：");
    base.push("  衣装は系統・色・素材のみで記述（例: dark cyber jacket, elegant white dress, gothic fashion）。");
    base.push("  美的・ファッション的な表現を中心にまとめること。");
  } else if (pt === "gemini_safe") {
    base.push("");
    base.push("▼ Gemini 向け記述方針：");
    base.push("  衣装はデザインとファッションスタイルで表現し、スタイリッシュで上品な記述にする。");
  } else if (pt === "nano_safe") {
    base.push("");
    base.push("▼ Nano Banana 向け記述方針（軽量仕様）：");
    base.push("  衣装は英語でシンプルに（例: dark cyber outfit, elegant dress, gothic fashion）。");
    base.push("  視覚的スタイルと雰囲気に集中すること。");
    base.push("");
    base.push("▼ Nano Banana 専用記述方針（架空キャラクター）：");
    base.push("  【前提】は必ず「参照画像は実在人物ではなく、AIで生成された架空のキャラクターイラストです」から始める。");
    base.push("  「人物」「本人」「実在人物」「ポートレート写真」「顔を維持」は一切使わない。");
    base.push("  代わりに「架空キャラクター」「キャラクターデザイン」「視覚的一貫性」「外観スタイル」を使う。");
  }

  return base.join("\n");
}

function viralBlock(pt: PromptTarget = "full"): string {
  const lines = [
    "【🔥 一発バズりモード — SNS映え最大化】",
    "- SNSで「何これ？」と止まる、強い印象と視覚的完成度を目指す。",
    `- 各案で以下のプールから "1つずつ異なる" インパクト要素を採用：${VIRAL_POOL.join("、")}`,
    "- 強コントラスト・ドラマチック光源・印象的な構図・意外な色の組み合わせを活かす。",
    "- 意外な世界観の組み合わせを積極採用：上品×ストリート / 広告×廃墟 / Y3K×和紙 / ゴシック×ポップ / 廃墟×高級ブランド",
    "- 武器や危険物は使わない。代わりに「主役級のファッション小道具」でインパクトを与える。",
    "- 衣装・ポーズ・ライティング・エフェクト・背景は上品かつ視覚的に強い表現にする。",
  ];
  if (pt === "full") {
    lines.push("- 色演出・光演出・空気感・空間対比でインパクトを演出。ファッション性×意外性×視覚的完成度を最大化。");
    lines.push("- 架空のAIキャラクターとして「清潔感・スタイル・存在感」で魅せる。量産パターンは使わない。");
    lines.push("- 顔・外観スタイル・人物の同一性・アスペクト比は必ず固定。");
  } else {
    lines.push("- 視覚的インパクトはファッション・背景・ライティング・エフェクト・小物で表現する。");
    lines.push("- 架空キャラクターの外観スタイル・視覚的一貫性・アスペクト比は必ず維持する。");
  }
  return lines.join("\n");
}

/**
 * 質感・立体感ブロック（5段階スライダー版）。
 * - textureDisabled=true → 何も出力しない
 * - textureOriginal=true → 「元画像の質感と立体感を維持」
 * - glossLevel=3 かつ dimensionLevel=3 → デフォルト値なので何も出力しない
 * - それ以外 → 各レベルに対応したテキストを出力
 */
function textureBlock(req: GenerateRequest): string {
  const {
    textureDisabled,
    textureOriginal,
    glossLevel   = 3,
    dimensionLevel = 3,
  } = req;

  // プロンプトに反映しない
  if (textureDisabled) return "";

  // 元画像維持モード
  if (textureOriginal) {
    return "【質感・立体感】\n元画像の質感（光沢・反射）と立体感（2D/3D度）をそのまま維持すること。";
  }

  const GLOSS_TEXT: Record<number, string> = {
    1: "【質感】反射を抑えたマットな質感に調整。ハイライトを最小限にする。",
    2: "【質感】やや艶消しの落ち着いた質感に調整。柔らかいサテン程度の反射にとどめる。",
    // 3 = 標準 → 出力なし
    4: "【質感】元画像よりやや光沢を強め、自然な反射とツヤを追加。",
    5: "【質感】強い光沢感。濡れたような反射、エナメル調のツヤ、金属的なリムライトを追加。",
  };
  const DIM_TEXT: Record<number, string> = {
    1: "【立体感】2D・フラットなイラスト表現。影や立体感を抑えたアニメ風にする。",
    2: "【立体感】やや2D寄りの表現。フラット気味の陰影で奥行きを抑える。",
    // 3 = 2.5D → 出力なし
    4: "【立体感】やや3D寄りの奥行き感を追加。自然な影と立体感を強める。",
    5: "【立体感】3D寄りの奥行き、物理的な影、リアルなマテリアル感を強める。",
  };

  const g = Math.min(5, Math.max(1, Math.round(glossLevel)));
  const d = Math.min(5, Math.max(1, Math.round(dimensionLevel)));

  const glossLine = g !== 3 ? (GLOSS_TEXT[g] ?? "") : "";
  const dimLine   = d !== 3 ? (DIM_TEXT[d]   ?? "") : "";

  if (!glossLine && !dimLine) return "";

  const lines: string[] = [];
  if (glossLine) lines.push(glossLine);
  if (dimLine)   lines.push(dimLine);
  return lines.join("\n");
}

function strengthBlock(strength: number): string {
  const s = Math.min(5, Math.max(1, Math.round(strength)));
  if (s === 1) {
    return [
      "【Prompt Strength: 1 / 控えめ変更】",
      "- 変更は最小限に。元画像の雰囲気・色味・構図・全体的な印象を最大限維持してください。",
      "- 「変えたかどうか気づかれるか気づかれないか」程度の微変更にとどめる。",
      "- ライティング・カメラ・構図・色調は特に指定がなければ全力維持。",
    ].join("\n");
  }
  if (s === 2) {
    return [
      "【Prompt Strength: 2 / やや控えめ変更】",
      "- 変更は控えめに。元画像の主要な特徴（構図・色調・雰囲気）を大きく壊さない範囲で変更する。",
      "- 細部の変化にとどめ、全体的な印象の変化を最小化する。",
    ].join("\n");
  }
  if (s === 4) {
    return [
      "【Prompt Strength: 4 / 大きめ変更】",
      "- 背景・衣装・小物・ライティング・カメラを積極的に変化させてください。",
      "- 元画像からインスパイアを受けつつ、新鮮で驚きのある変化を加えてください。",
      "- 顔・人物同一性は絶対固定。",
    ].join("\n");
  }
  if (s === 5) {
    return [
      "【Prompt Strength: 5 / 大胆変更】",
      "- 変更範囲内の要素を最大限に変化させてください。",
      "- 視覚的インパクト・意外性・SNS映えを最大化する方向で積極的に変えてください。",
      "- 色・質感・ライティング・小物・背景を大胆に変えて、元画像とは別物に見せてください。",
      "- 顔・人物同一性は絶対固定。",
    ].join("\n");
  }
  return ""; // s === 3: 標準（特別な指示不要）
}

/**
 * 量産構図回避ブロック。
 * ゴシック×教会×黒バラ、白服×透明羽×魔法陣 など
 * SNSで見慣れた「定番すぎる組み合わせ」への偏りを抑制し、
 * ひとひねりした独自性のある構成を促す。
 * 完全禁止ではなく頻度を下げる方針（25%ルール）。
 */
function avoidClicheBlock(): string {
  return [
    "【量産構図回避ルール】",
    "以下の「定番すぎる組み合わせ」は避け、少し予想外の方向にズラすこと：",
    "",
    "▼ 避けるべき定番パターン（複数要素が同時に揃った場合に差し替える）：",
    "  ① ゴシック衣装 × ステンドグラス × 黒いバラ",
    "  ② 白いワンピース × 透明な羽 × 青白い幻想光",
    "  ③ サイバー系 × 鋭利な小道具 × ネオン発光",
    "  ④ 魔法少女風衣装 × 魔法陣 × 杖",
    "  ⑤ 黒ドレス × 教会背景 × 薔薇",
    "  ⑥ 白ドレス × 雪・氷・水晶 × 羽",
    "  ⑦ 狐巫女 × 桜 × 神社",
    "  ⑧ アンドロイド × 青いHUD × 未来都市",
    "  ⑨ 透明ホログラムパネル × 汎用テックUI × 近未来都市",
    "  ⑩ ネオンピンク・ブルー × 雨の夜の路地 × サイバーポップコード",
    "  ⑪ ドレス × 大量の花びら × 舞い散る幻想光",
    "  ⑫ クリスタル・水晶装飾 × 白い羽大量 × 幻想光",
    "",
    "▼ ズラし方の例（積極的に取り入れる）：",
    "  - ゴシック衣装 → 背景を「古い映画館」「廃ホテル」「ガラス温室」「夜の遊園地」などに変える",
    "  - 白い服 → 羽・魔法陣の代わりに「紙吹雪」「曇りガラス」「布のレイヤー」「影の演出」を使う",
    "  - サイバー系 → 鋭利な小道具の代わりに「フィルムカメラ」「透明傘」「古い電話」「発光ケーブル」など",
    "  - 和風系 → 桜＋神社の代わりに「曼珠沙華」「蛍」「川の流れ」「廃神社」「夜の竹林」など",
    "  - 花演出 → バラ・桜だけに偏らず「椿」「百合」「アネモネ」「ドライフラワー」「花びらの影」に分散",
    "  - サイバー/未来系 → 青いHUDパネル・透明ホログラムUIの代わりに空間・光質感・テクスチャで表現",
    "",
    "▼ 出現頻度を下げる要素（完全禁止ではない。全案の25%以内に抑える）：",
    "  黒いバラ / ステンドグラス / 透明な羽 / 魔法陣 / 鋭利な小道具 / ネオン街 / 桜＋神社の同時使用 /",
    "  透明ホログラムパネル / HUDパネル / 汎用テックUI / 青ネオン単色 /",
    "  花びら大量散布 / クリスタル装飾過多 / 発光する鋭利な小道具 / 白い羽大量",
    "",
    "各案で「よく見るSNS画像と同じ組み合わせ」になっていないか確認してから生成すること。",
    "「意外性のある一手」を加えることで保存率・拡散率が上がる。",
  ].join("\n");
}

/**
 * 色彩多様性ブロック。
 * LLM が「黒・白・グレーのみ」に偏る傾向を抑制し、各案に少なくとも1か所の
 * アクセントカラーを要求する。常時挿入。
 *
 * 抑制ルール：
 * - mono / no_color → 完全にスキップ（ユーザーが意図的に無彩色指定）
 * - white_base / black_base → 緩めバージョン（ベース色は維持しつつアクセント要求）
 * - それ以外（未設定含む）→ フルバージョン
 */
function colorDiversityBlock(req: GenerateRequest): string {
  const cs = req.colorStrategy;

  // 完全モノクロ・無彩色指定時はスキップ
  if (cs === "mono" || cs === "no_color") return "";

  // ★変更範囲ルール厳守：色が反映される＝変更対象に入っている軸だけを色多様性の対象にする。
  //   背景OFF・衣装OFF・髪OFF などスコープ外の軸の色は絶対に変更させない。
  const colorAxes: string[] = [];
  if (req.scopes.includes("outfit"))     colorAxes.push("衣装");
  if (req.scopes.includes("hair"))       colorAxes.push("髪");
  if (req.scopes.includes("background")) colorAxes.push("背景");
  if (req.scopes.includes("foreground")) colorAxes.push("前景演出");
  if (req.scopes.includes("cosplay"))    colorAxes.push("コスプレ衣装");
  // 色を持つ変更対象が1つも無い場合（カメラ・ポーズのみ等）は色指示を出さない
  if (colorAxes.length === 0) return "";
  const axesLabel = colorAxes.join("・");

  // 白ベース・黒ベース指定時は「アクセントを足す」緩め版（対象軸内のみ）
  if (cs === "white_base" || cs === "black_base") {
    const base = cs === "white_base" ? "白・シルバー基調" : "黒・ダーク基調";
    return [
      "【色彩アクセントルール】",
      `${base}の方向性でも完全な無彩色統一を避け、変更対象（${axesLabel}）の中に` +
      "少なくとも1箇所、有彩色アクセントを加える。",
      "※変更対象外・固定軸の色は変更しない（背景OFFなら背景色を変えない等）。",
    ].join("\n");
  }

  // デフォルト（色戦略未設定 or それ以外）→ 対象軸内での色多様性
  return [
    "【色彩多様性ルール】",
    `複数案をまたいで「黒・白・グレー系のみ」に偏ることを禁止する（対象：${axesLabel}）。`,
    "",
    "▼ 1案ごとの必須ルール：",
    `  - 変更対象（${axesLabel}）の中に、少なくとも1箇所は黒・白・グレー以外の有彩色アクセントを入れる。`,
    "  - 変更対象が全て無彩色のみ、という案を作らない。",
    "  - ※変更対象に含まれない軸・固定軸の色は変更しない（OFFの軸の色は元のまま維持）。",
    "",
    "▼ 複数案をまたいだルール：",
    "  - 黒主体の案・白主体の案はそれぞれ全案の25%（4案なら1案）以内。",
    "  - 残りの案には有彩色を積極的に採用し、色調を案ごとに明確に変える。",
    "",
    "▼ 採用する有彩色の方向性（案ごとに散らす）：",
    "  深紅・バーガンディ / 電気ブルー・コバルト / エメラルド・ターコイズ / ゴールド・アンバー /",
    "  パープル / フューシャ・マゼンタ / コーラル・オレンジ / シアン・アクア / インディゴ / マルーン",
  ].join("\n");
}

/**
 * お気に入り学習ブロック。
 * ユーザーがお気に入り登録した過去作から抽出した「好みの傾向」を反映する。
 *
 * 絶対ルール：
 *  - コピー禁止（方向性のみ取り込む）
 *  - 変更範囲（scopes）内の軸でのみ反映。範囲外・固定軸は変えない
 *  - 顔固定・背景固定などの固定ルールが最優先（お気に入り学習より上）
 *  - 重複回避と両立（同じ表現の乱発禁止。好きな傾向は近縁バリエーションに展開）
 */
function favoriteProfileBlock(
  traits: string[] | undefined,
  strength: number | undefined,
): string {
  if (!traits || traits.length === 0) return "";
  const s = strength === 1 ? 1 : strength === 3 ? 3 : 2;

  const strengthLine =
    s === 1
      ? "反映強度：弱め。好みの方向性をほんの少しだけ意識する程度に留め、新規性を最優先する。"
      : s === 3
      ? "反映強度：強め。好みの方向性をはっきり反映する。ただし完全コピーは禁止で、必ず新しい組み合わせにする。"
      : "反映強度：標準。好みの方向性を反映しつつ、新規性とのバランスを保つ。";

  return [
    "【お気に入り学習 — 好みの方向性を反映】",
    "ユーザーが過去にお気に入り登録した作品から抽出した『好みの傾向』は以下：",
    "  " + traits.map((t) => `「${t}」`).join("、"),
    "",
    strengthLine,
    "",
    "▼ 反映ルール（厳守）：",
    "  - これは『方向性の参考』であり、過去プロンプトの文章をコピーしてはいけない。",
    "    必ず今回の被写体・変更範囲に合わせた新しい組み合わせで表現する。",
    "  - 反映してよいのは『今回の変更範囲（スコープ）に含まれる軸』のみ。",
    "    変更範囲外・固定指定された軸（顔固定・背景固定・元画像維持など）は絶対に変更しない。",
    "    固定ルールはお気に入り学習よりも常に優先される。",
    "  - 好みの傾向でも同じ表現を全案で乱発しない（重複回避と両立）。",
    "    近縁のバリエーションに展開すること。",
    "    例：白髪が多い → 銀髪・淡いグレー・ハイライト・部分メッシュに展開。",
    "    例：ゴシックが多い → ゴシックモード・黒広告・ダークラグジュアリーに展開。",
    "  - 各案は互いに差別化し、好みに寄せつつも新鮮さを保つ。",
  ].join("\n");
}

/**
 * 神引き補助モディファイアブロック。
 * 🔁被り回避 / 🎲別世界 / 🧲バズ寄せ / 🎯顔映え を補助指示として追加する。
 *
 * 最優先ルール：顔・同一性・表情の固定、変更範囲（スコープ）、固定軸は常に維持。
 * これらの補助はあくまで「変更対象の軸の範囲内」での演出・方向づけに留める。
 */
function boostBlock(req: GenerateRequest): string {
  const boosts = req.boosts;
  if (!Array.isArray(boosts) || boosts.length === 0) return "";

  const sections: string[] = [];

  if (boosts.includes("avoid_overlap")) {
    sections.push(
      "▼ 🔁 被り回避：直近の生成と似た方向を避ける。\n" +
      "  - 変更対象の軸（背景・衣装・色・前景演出・カメラ・世界観のうち選択中のもの）が、" +
      "直近の傾向と重ならないようにする。\n" +
      "  - ネオン / サイバー / 黒一色衣装 / 剣 / 花びら / 廃墟 / 屋上 などの頻出要素を連続使用しない。\n" +
      "  - 各案を互いに、そして直近履歴と明確に差別化する。"
    );
  }
  if (boosts.includes("other_world")) {
    sections.push(
      "▼ 🎲 別世界：前回とまったく違う方向へ大胆に振る。\n" +
      "  - 顔・人物の同一性・表情・基本スタイルは維持したまま、" +
      "変更対象の軸（背景・衣装・色・ライティング・演出など選択中のもの）を大胆に変化させる。\n" +
      "  - ただし破綻させず、1つの完成された世界観としてまとめる。\n" +
      "  - スコープ外・固定軸は変更しない。"
    );
  }
  if (boosts.includes("buzz")) {
    sections.push(
      "▼ 🧲 バズ寄せ：SNS（X等）で目を引く構図・色・前景演出に寄せる。\n" +
      "  - サムネイルで強く見えるよう、明暗差・顔周りへの視線誘導・印象的な背景・強い一要素を入れる。\n" +
      "  - ただしネオン・サイバーに毎回偏らない。色や演出は案ごとに変える。\n" +
      "  - 変更対象の軸の範囲で行い、固定軸・顔は変更しない。"
    );
  }
  if (boosts.includes("face_pop")) {
    sections.push(
      "▼ 🎯 顔映え（顔は絶対に変更しない・最優先保護）：\n" +
      "  - 顔そのもの・目・鼻・口・輪郭・表情・人物の同一性は一切変更しない（顔固定が最優先）。\n" +
      "  - 顔が最も魅力的に見えるよう、ライティング・構図・前景の配置を最適化する：\n" +
      "    リムライト / キャッチライト / 柔らかいスポットで顔の印象を強める。\n" +
      "  - 顔に視線が集まる構図にし、顔周辺に邪魔な前景演出を置かない（顔・目は常に視認可能に）。\n" +
      "  - 背景が変更対象の場合は顔が映える明暗・色に整える（背景が変更対象でない場合は背景自体は変えない）。\n" +
      "  - 髪・衣装・背景を変える場合も、顔の印象を邪魔しない方向にする。\n" +
      "  - これは『顔の変更』ではなく『顔を引き立てる光・構図・演出の最適化』である。"
    );
  }

  if (sections.length === 0) return "";

  return [
    "【神引き補助モディファイア】",
    "以下の補助方針を反映する。ただし顔・人物の同一性・表情の固定、変更範囲（スコープ）、" +
    "固定軸、アスペクト比維持は常に最優先で守ること（補助よりも固定ルールが優先）。",
    "※ 補助方針が変更対象に含まれない軸（背景・衣装・髪・カメラ・ポーズ等）の見た目を" +
    "変える内容を含む場合、その軸は変更しない。保護対象と矛盾する場合は必ず保護対象を優先する。",
    "",
    ...sections,
  ].join("\n");
}

/**
 * 重複制御ブロック。頻出モチーフの出現制御レベルをプロンプトに反映する。
 * level: 0完全NG / 1強抑制 / 2やや抑制 / 3注意 / 5積極許可。
 * Nano Banana（nano_safe）では簡潔な1〜2行に圧縮する。
 */
function motifControlBlock(req: GenerateRequest, pt: PromptTarget): string {
  const ctrl = req.motifControls;
  if (!Array.isArray(ctrl) || ctrl.length === 0) return "";

  const pick = (lv: number) => ctrl.filter((c) => c.level === lv).map((c) => c.label);
  const ng     = pick(0);
  const strong = pick(1);
  const mild   = pick(2);
  const caution= pick(3);
  const prefer = pick(5);
  if (ng.length + strong.length + mild.length + caution.length + prefer.length === 0) return "";

  // Nano Banana：短く簡潔に
  if (pt === "nano_safe") {
    const lines: string[] = ["【重複制御（簡潔反映）】"];
    if (ng.length)      lines.push(`使わない：${ng.join("・")}（類似含む）`);
    if (strong.length)  lines.push(`なるべく避ける：${strong.join("・")}`);
    if (mild.length || caution.length) lines.push(`連続回避・変化を付ける：${[...mild, ...caution].join("・")}`);
    if (prefer.length)  lines.push(`好み（重複しすぎない範囲で採用可）：${prefer.join("・")}`);
    return lines.join("\n");
  }

  // ChatGPT / full：段階別に丁寧に
  const lines: string[] = [
    "【重複制御 — 出現コントロール】",
    "頻出モチーフの出現制御レベルを以下のとおり反映する：",
  ];
  if (ng.length)
    lines.push(`  ▼ 完全NG（使用しない・類似表現も避ける）：${ng.join("・")}`);
  if (strong.length)
    lines.push(`  ▼ 強く抑制（基本的に出さない・候補から外す）：${strong.join("・")}`);
  if (mild.length)
    lines.push(`  ▼ やや抑制（連続使用を避け、続く場合は別系統に差し替える）：${mild.join("・")}`);
  if (caution.length)
    lines.push(`  ▼ 注意（使う場合は過去と違う素材・色・シルエット・見せ方にする）：${caution.join("・")}`);
  if (prefer.length)
    lines.push(`  ▼ 積極採用（好み要素として活かす・ただし毎回同じにせず変化を付ける）：${prefer.join("・")}`);
  return lines.join("\n");
}

/**
 * 頻出構成（モチーフ組み合わせ）の制御ブロック。
 *  block: その組み合わせを同時に含めない（完全NG扱い）
 *  alt  : 出そうな時は別ジャンル（ホワイトミニマル等）へ振る
 *
 * Nano Banana では短く圧縮。
 */
function comboControlBlock(req: GenerateRequest, pt: PromptTarget): string {
  const ctrl = req.comboControls;
  if (!Array.isArray(ctrl) || ctrl.length === 0) return "";

  const blocks = ctrl.filter((c) => c.policy === "block");
  const alts   = ctrl.filter((c) => c.policy === "alt");
  if (blocks.length + alts.length === 0) return "";

  if (pt === "nano_safe") {
    const lines: string[] = ["【頻出構成 制御（簡潔反映）】"];
    if (blocks.length) {
      lines.push("同時に出さない組み合わせ：");
      for (const c of blocks) lines.push("  ・" + c.labels.join(" + "));
    }
    if (alts.length) {
      lines.push("出そうな時は別ジャンルへ振る組み合わせ：");
      for (const c of alts) lines.push("  ・" + c.labels.join(" + "));
    }
    return lines.join("\n");
  }

  const lines: string[] = [
    "【頻出構成 制御 — 同時出現の管理】",
    "下記は履歴で頻発している組み合わせ（構成）です。指定の方針で扱ってください：",
  ];
  if (blocks.length > 0) {
    lines.push("");
    lines.push("▼ 同時使用禁止（これらの要素を同じ案で全部揃えない）：");
    for (const c of blocks) lines.push(`  ・${c.labels.join(" + ")}`);
    lines.push("  ※ 個別要素は他の制御に従う。あくまで『同時に揃えない』ことを優先する。");
  }
  if (alts.length > 0) {
    lines.push("");
    lines.push("▼ 別ジャンル化（この組み合わせが出そうな案は、別方向の世界観に振り替える）：");
    for (const c of alts) lines.push(`  ・${c.labels.join(" + ")}`);
    lines.push("  振替先の例：ホワイトミニマル / 建築写真 / 高級ファッション広告 / アパレルLOOKBOOK / スポーツラグジュアリー / 映画ポスター。");
  }
  lines.push("");
  lines.push("※ 変更範囲（スコープ）に含まれない軸は変えない。固定軸（顔・体型・固定範囲）は最優先で維持。");
  return lines.join("\n");
}

/**
 * 色×軸重み制御ブロック（新方式）。
 *
 * 各色の 髪／服／背景 ごとに 0〜5 の重みを取り、
 *   0 = 完全禁止 / 1 = 強抑制 / 2 = 抑制 / 4 = 推奨 / 5 = 強推奨
 * を、該当軸（scope）に該当する場合のみ強く反映する。
 *
 * 「同じ色でも軸によって意味が変わる」ことを LLM に明確に伝える設計。
 *   例：白系は『髪=禁止 / 背景=推奨』のような分離が可能。
 */
function colorWeightBlock(req: GenerateRequest, pt: PromptTarget): string {
  const ctrl = req.colorWeights;
  if (!Array.isArray(ctrl) || ctrl.length === 0) return "";

  // 軸別にグループ化
  type Axis = "hair" | "outfit" | "background";
  const AXIS_JP: Record<Axis, string> = { hair: "髪", outfit: "服", background: "背景" };
  const SCOPE_OF: Record<Axis, string> = { hair: "hair", outfit: "outfit", background: "background" };

  const grouped: Record<Axis, Record<number, string[]>> = {
    hair:       { 0: [], 1: [], 2: [], 4: [], 5: [] },
    outfit:     { 0: [], 1: [], 2: [], 4: [], 5: [] },
    background: { 0: [], 1: [], 2: [], 4: [], 5: [] },
  };
  for (const c of ctrl) {
    if (!grouped[c.axis][c.weight]) continue;
    grouped[c.axis][c.weight].push(c.jp);
  }

  // 何も無ければ出さない
  const hasAny = (Object.values(grouped) as Record<number, string[]>[])
    .some((g) => Object.values(g).some((arr) => arr.length > 0));
  if (!hasAny) return "";

  // スコープ未選択軸は弱い指示のみ
  const scopeIncludes = (axis: Axis) => req.scopes.includes(SCOPE_OF[axis] as never);

  const WEIGHT_LABEL: Record<number, string> = {
    0: "完全禁止",
    1: "強抑制（必要最小限）",
    2: "抑制（控えめ）",
    4: "推奨（積極的に取り入れる）",
    5: "強推奨（最優先で使う）",
  };

  if (pt === "nano_safe") {
    const lines: string[] = ["【色×軸 重み制御（簡潔反映）】"];
    (["hair", "outfit", "background"] as Axis[]).forEach((axis) => {
      const g = grouped[axis];
      const parts: string[] = [];
      ([5, 4, 0, 1, 2] as const).forEach((w) => {
        if (g[w].length > 0) parts.push(`${WEIGHT_LABEL[w]}=${g[w].join("/")}`);
      });
      if (parts.length > 0) {
        const tag = scopeIncludes(axis) ? "" : "（参考）";
        lines.push(`${AXIS_JP[axis]}${tag}：${parts.join(" / ")}`);
      }
    });
    return lines.join("\n");
  }

  // ChatGPT / full 向け詳細版
  const lines: string[] = [
    "【色×軸 重み制御 — 髪／服／背景 をそれぞれ独立に制御】",
    "下記は利用者が指定した『軸ごとに別の重み』を持つ色制御です。",
    "重要：同じ色でも軸が違えば扱いも変わります。下記の指示は**該当軸の値だけ**変えてください。",
  ];

  (["hair", "outfit", "background"] as Axis[]).forEach((axis) => {
    const g = grouped[axis];
    const hasContent = Object.values(g).some((arr) => arr.length > 0);
    if (!hasContent) return;

    lines.push("");
    const inScope = scopeIncludes(axis);
    lines.push(`▼ ${AXIS_JP[axis]}${inScope ? "（変更範囲ON：必ず反映）" : "（変更範囲外：参考レベル）"}`);

    // 強い順に出す
    ([5, 4, 0, 1, 2] as const).forEach((w) => {
      if (g[w].length === 0) return;
      lines.push(`  ・${WEIGHT_LABEL[w]}：${g[w].join("、")}`);
    });

    // 軸別の補足ガイド
    if (g[0].length > 0) {
      lines.push(`    ※ ${AXIS_JP[axis]}に「禁止」指定の色は微量のアクセントとしても使用しない。`);
    }
    if (g[5].length > 0 || g[4].length > 0) {
      lines.push(`    ※ ${AXIS_JP[axis]}の「推奨／強推奨」色は、メイン配色の候補として優先的に検討する。`);
    }
  });

  lines.push("");
  lines.push("※ 変更範囲（scope）に含まれない軸については、勝手に色を変えない（参考扱い）。");
  lines.push("※ 色固定ロックが入っている場合は、ロックを最優先で維持する。");
  return lines.join("\n");
}

/**
 * ユーザー画像評価バイアスブロック。
 *
 * 各案カードで「👍 良い / 😐 まあまあ / 👎 微妙 / 💀 失敗」と付けた評価を
 * 軸別カテゴリに投票して集計したヒント。クライアント側で「変更範囲ON軸のみ」
 * のフィルタ済み。
 */
/**
 * 好みプロファイルブロック（実 Gemini 分析結果）。
 *
 * このブロックは「ユーザー本人の評価から AI が抽出した本物の好み傾向」を入れる。
 * 経験則（ratingBias）より一段上位のヒント。
 *
 * - 変更範囲（scope）に含まれる軸のみ反映（背景/衣装/ポーズ）
 * - preferKeywords / avoidKeywords は scope に関係なく注入される
 */
function preferenceProfileBlock(req: GenerateRequest, pt: PromptTarget): string {
  const p = req.preferenceProfile;
  if (!p) return "";

  // scope に応じて軸別の likes/dislikes を採用
  const scopeOf: Record<"bg" | "outfit" | "pose", string> = {
    bg: "background", outfit: "outfit", pose: "pose",
  };
  const axisJp: Record<"bg" | "outfit" | "pose", string> = {
    bg: "背景", outfit: "衣装", pose: "ポーズ",
  };
  const usableLikes:    { axis: string; like: string }[] = [];
  const usableDislikes: { axis: string; dislike: string }[] = [];
  for (const axis of ["bg", "outfit", "pose"] as const) {
    if (req.scopes.includes(scopeOf[axis] as never)) {
      if (p.likes[axis]    && p.likes[axis]    !== "明確な傾向なし") usableLikes.push({ axis: axisJp[axis], like: p.likes[axis] });
      if (p.dislikes[axis] && p.dislikes[axis] !== "明確な傾向なし") usableDislikes.push({ axis: axisJp[axis], dislike: p.dislikes[axis] });
    }
  }
  const kPrefer = p.preferKeywords ?? [];
  const kAvoid  = p.avoidKeywords  ?? [];

  if (usableLikes.length === 0 && usableDislikes.length === 0 && kPrefer.length === 0 && kAvoid.length === 0) {
    return "";
  }

  if (pt === "nano_safe") {
    const lines: string[] = ["【AI好みプロファイル（簡潔反映）】"];
    if (p.summary) lines.push("概要：" + p.summary.slice(0, 80));
    for (const l of usableLikes)    lines.push(`好む(${l.axis})：${l.like}`);
    for (const d of usableDislikes) lines.push(`嫌う(${d.axis})：${d.dislike}`);
    if (kPrefer.length > 0) lines.push("優先：" + kPrefer.join(" / "));
    if (kAvoid.length  > 0) lines.push("回避：" + kAvoid.join(" / "));
    return lines.join("\n");
  }

  const lines: string[] = [
    "【AI 好みプロファイル — ユーザー評価データから抽出した好み傾向】",
    `この内容は、ユーザー本人が過去 ${p.sampleSize} 件の画像に付けた評価を ${p.model} で分析した結果です。`,
    "他のヒントより優先度が高いので、scope の範囲内で積極的に活用してください。",
  ];
  if (p.summary) {
    lines.push("");
    lines.push("▼ 全体傾向：");
    lines.push(`  ${p.summary}`);
  }
  if (usableLikes.length > 0) {
    lines.push("");
    lines.push("▼ ユーザーが好む傾向（変更範囲内の軸のみ）：");
    for (const l of usableLikes) lines.push(`  ・${l.axis}：${l.like}`);
  }
  if (usableDislikes.length > 0) {
    lines.push("");
    lines.push("▼ ユーザーが嫌う傾向（変更範囲内の軸のみ）：");
    for (const d of usableDislikes) lines.push(`  ・${d.axis}：${d.dislike}`);
  }
  if (kPrefer.length > 0) {
    lines.push("");
    lines.push("▼ 優先キーワード（積極的に取り入れる）：");
    lines.push(`  ${kPrefer.join("、")}`);
  }
  if (kAvoid.length > 0) {
    lines.push("");
    lines.push("▼ 回避キーワード（避ける）：");
    lines.push(`  ${kAvoid.join("、")}`);
  }
  lines.push("");
  lines.push("※ scope に含まれない軸の傾向は無視。固定軸は最優先で維持。");
  return lines.join("\n");
}

function ratingBiasBlock(req: GenerateRequest, pt: PromptTarget): string {
  const rb = req.ratingBias;
  if (!rb) return "";
  // 絶対スコープルールの二重防御：rec/avd の軸名（background/outfit/hair/camera/lighting）が
  // 変更対象スコープに含まれるものだけを残す。フロントでも絞っているがサーバ側でも保証する。
  const rec = (rb.recommended ?? []).filter((r) => req.scopes.includes(r.axis as never));
  const avd = (rb.avoid       ?? []).filter((r) => req.scopes.includes(r.axis as never));
  const pref = rb.preference;
  // 軸別👍👎レポートが active のとき、scopes と一致する軸のみを抽出
  const AXIS_SCOPE: Record<"bg"|"outfit"|"pose", string> = {
    bg: "background", outfit: "outfit", pose: "pose",
  };
  const AXIS_JP: Record<"bg"|"outfit"|"pose", string> = {
    bg: "背景", outfit: "衣装", pose: "ポーズ",
  };
  const prefAxes = (pref?.active ? pref.axes : []).filter((a) => req.scopes.includes(AXIS_SCOPE[a.axis] as never));
  const prefSuccess = prefAxes.filter((a) => a.goodRatio >= 0.70 && (a.good + a.bad) >= 5);
  const prefFail    = prefAxes.filter((a) => a.badRatio  >= 0.50 && (a.good + a.bad) >= 5);

  if (rec.length === 0 && avd.length === 0 && prefSuccess.length === 0 && prefFail.length === 0) return "";

  if (pt === "nano_safe") {
    const lines: string[] = ["【ユーザー評価バイアス（簡潔反映）】"];
    if (rec.length > 0) {
      lines.push("好み：" + rec.slice(0, 5).map((r) => `${r.axis}=${r.label}`).join(" / "));
    }
    if (avd.length > 0) {
      lines.push("回避：" + avd.slice(0, 5).map((r) => `${r.axis}=${r.label}`).join(" / "));
    }
    if (prefSuccess.length > 0) {
      lines.push("好評軸：" + prefSuccess.map((a) => `${AXIS_JP[a.axis]}(${Math.round(a.goodRatio*100)}%)`).join(" / "));
    }
    if (prefFail.length > 0) {
      lines.push("不評軸：" + prefFail.map((a) => `${AXIS_JP[a.axis]}(${Math.round(a.badRatio*100)}%)`).join(" / "));
    }
    return lines.join("\n");
  }

  const lines: string[] = [
    "【ユーザー評価バイアス — 過去の画像評価から導いた方向性】",
    "ユーザーが過去に各画像へ付けた評価（👍良い／😐まあまあ／👎微妙／💀失敗）を、",
    "軸（背景・衣装・髪・カメラ・光）×カテゴリで集計した傾向です：",
  ];
  if (rec.length > 0) {
    lines.push("");
    lines.push("▼ 高評価が多い方向（積極的に取り入れる）：");
    for (const r of rec.slice(0, 6)) {
      lines.push(`  ・${r.axis}：${r.label}（評価スコア +${r.score.toFixed(1)}）`);
    }
  }
  if (avd.length > 0) {
    lines.push("");
    lines.push("▼ 低評価が多い方向（できるだけ避ける）：");
    for (const r of avd.slice(0, 6)) {
      lines.push(`  ・${r.axis}：${r.label}（評価スコア ${r.score.toFixed(1)}）`);
    }
  }

  // 軸別👍👎レポート（30件以上で本格活用）
  if (prefSuccess.length > 0) {
    lines.push("");
    lines.push("▼ 軸別好評傾向（ユーザーが好む軸 — 安心して取り入れる）：");
    for (const a of prefSuccess) {
      const pct = Math.round(a.goodRatio * 100);
      lines.push(`  ・${AXIS_JP[a.axis]}：高評価率 ${pct}%（👍 ${a.good} / 👎 ${a.bad}）— この軸はユーザーの好みに合っているので積極的に活用`);
    }
  }
  if (prefFail.length > 0) {
    lines.push("");
    lines.push("▼ 軸別不評傾向（ユーザーが嫌う軸 — 慎重に扱う）：");
    for (const a of prefFail) {
      const pct = Math.round(a.badRatio * 100);
      lines.push(`  ・${AXIS_JP[a.axis]}：低評価率 ${pct}%（👍 ${a.good} / 👎 ${a.bad}）— 過去の失敗傾向と被らないよう、別方向を慎重に検討`);
    }
  }
  lines.push("");
  lines.push("※ ユーザー本人の評価データなので、お気に入り学習や ZOZO トレンドより優先度は中〜高。");
  lines.push("※ 変更範囲（scope）に含まれない軸は変えない。固定軸は最優先で維持。");
  return lines.join("\n");
}

/**
 * 画像分析バイアスブロック。
 *
 * フロント側で履歴の **生成結果画像** を perceptual hash でクラスタリングし、
 * 視覚的に酷似した画像が多いとき・特定カテゴリの出現率が高すぎる時に注入する。
 *
 * 「プロンプト文言は違うが画像が似ている」ケースの回避が目的。
 */
function imageBiasBlock(req: GenerateRequest, pt: PromptTarget): string {
  const ib = req.imageBias;
  if (!ib) return "";
  const overused  = ib.overused  ?? [];
  const underused = ib.underused ?? [];
  const dup       = ib.visualDupCount ?? 0;
  if (overused.length === 0 && underused.length === 0 && dup < 3) return "";

  if (pt === "nano_safe") {
    const lines: string[] = ["【画像分析バイアス（簡潔反映）】"];
    if (dup >= 3) lines.push(`視覚的に類似画像 ${dup} 枚あり：別方向必須`);
    if (overused.length > 0) {
      lines.push("避ける：" + overused.slice(0, 5).map((o) => `${o.axis}=${o.label}`).join(" / "));
    }
    if (underused.length > 0) {
      lines.push("試す：" + underused.slice(0, 4).map((u) => `${u.axis}=${u.label}`).join(" / "));
    }
    return lines.join("\n");
  }

  const lines: string[] = [
    "【画像分析バイアス — 過去の『生成結果画像』が示す偏り】",
    "下記は過去の出力画像を視覚的に分析した結果です。プロンプト文言の重複ではなく、",
    "実際に生成された画像が示している傾向です。優先的に従ってください：",
  ];
  if (dup >= 3) {
    lines.push("");
    lines.push(`▼ 視覚的に酷似する画像が ${dup} 枚連続しています`);
    lines.push("  → 文言を変えても見た目が同じになっています。今回は明確に別ジャンル／別構図へ振ってください。");
  }
  if (overused.length > 0) {
    lines.push("");
    lines.push("▼ 頻出カテゴリ（画像で既に多すぎる、可能なら避ける）：");
    for (const o of overused.slice(0, 6)) {
      lines.push(`  ・${o.axis}：${o.label}（${Math.round(o.ratio * 100)}%）`);
    }
  }
  if (underused.length > 0) {
    lines.push("");
    lines.push("▼ 未開拓カテゴリ（まだ画像になっていない、優先的に検討）：");
    const byAxis = new Map<string, string[]>();
    for (const u of underused) {
      if (!byAxis.has(u.axis)) byAxis.set(u.axis, []);
      byAxis.get(u.axis)!.push(u.label);
    }
    for (const [axis, labels] of byAxis.entries()) {
      lines.push(`  ・${axis}：${labels.slice(0, 4).join("、")}`);
    }
  }
  lines.push("");
  lines.push("※ 変更範囲（scope）に含まれない軸は変えない。固定軸は最優先で維持。");
  return lines.join("\n");
}

/**
 * 質感・リアル度ブロック。
 *
 * 「背景だけリアルすぎる問題」を防ぐためのもの。人物と背景の質感統一が最優先。
 *   1: 完全2Dイラスト寄り（背景もアニメ/絵画的）
 *   2: デジタルペイント寄り
 *   3: 2.5D（人物と背景を統一）← 既定。プロンプト非出力
 *   4: リアル寄り（背景は実写寄りだが人物と馴染ませる）
 *   5: 写真リアル
 *
 * 反映ルール（変更範囲外の軸には勝手に影響させない）：
 *   - 背景ON      → 背景の質感に必ず反映
 *   - 衣装ON      → 衣装の素材感にも反映
 *   - カメラON    → レンズ感や写真感に反映
 *   - ライティングON → 現実写真風かイラスト照明かを調整
 *
 * Nano Banana は短文化。
 */
function realismBlock(req: GenerateRequest, pt: PromptTarget): string {
  const lv = req.realismLevel;
  if (!lv || lv < 1 || lv > 5) return "";
  if (lv === 3 && !req.realismType) return "";  // 標準値かつタイプ指定なし → 非出力

  const scopes = req.scopes;
  const affectsBg     = scopes.includes("background");
  const affectsOutfit = scopes.includes("outfit");
  const affectsCam    = scopes.includes("camera");
  const affectsLight  = scopes.includes("lighting");
  if (!affectsBg && !affectsOutfit && !affectsCam && !affectsLight && lv === 3) {
    return ""; // 対象軸ゼロかつ標準 → 出力なし
  }

  // レベル別の主指示
  const LEVEL_LEAD: Record<number, string> = {
    1: "完全2Dイラスト寄り。背景もアニメ背景・セル画・手描き・絵画的にする。実写写真の質感は使わない。",
    2: "デジタルペイント寄り。背景は描き込みのあるアニメ背景・ゲーム背景・油絵風・コンセプトアート風。",
    3: "人物と背景の質感を2.5Dで統一する。写真すぎず、イラストすぎず。",
    4: "リアル寄り。背景は実写寄りだが、人物と馴染むよう柔らかく調整する。",
    5: "写真リアル。背景も実写写真のような質感を許可する。",
  };

  // タイプ別の補足
  const TYPE_HINT: Record<string, string> = {
    anime_bg:      "アニメ背景・セル画調の描き込み",
    digital_paint: "デジタルペイント／厚塗り風",
    oil_paint:     "油絵・厚塗り・絵画的タッチ",
    watercolor:    "水彩・にじみ・透明感のある絵画調",
    cel:           "セル画調・線画と平面塗り",
    manga_bg:      "漫画背景・トーン・スクリーントーン質感",
    game_bg:       "ゲーム背景・コンセプトアート寄り",
    concept_art:   "コンセプトアート・大胆なライティングと構図",
    photo_real:    "実写写真の質感・センサーノイズ感",
    movie_bg:      "映画美術・シネマティックな空間設計",
  };

  if (pt === "nano_safe") {
    const lines: string[] = ["【質感・リアル度（簡潔反映）】"];
    lines.push(`Lv${lv}：${LEVEL_LEAD[lv]}`);
    if (req.realismType && TYPE_HINT[req.realismType]) {
      lines.push(`タイプ：${TYPE_HINT[req.realismType]}`);
    }
    // 軸ごとの極短指示
    if (affectsBg)     lines.push(`背景：${lv <= 2 ? "非実写・絵画的" : lv === 3 ? "2.5D" : lv === 4 ? "実写寄り＋人物に馴染ませる" : "実写OK"}`);
    if (affectsOutfit) lines.push(`衣装素材：${lv <= 2 ? "塗りで表現" : lv >= 4 ? "実物質感" : "中間"}`);
    if (affectsCam)    lines.push(`レンズ感：${lv <= 2 ? "写真感は弱め" : lv >= 4 ? "写真寄り" : "中間"}`);
    if (affectsLight)  lines.push(`照明：${lv <= 2 ? "イラスト的" : lv >= 4 ? "実写的" : "中間"}`);
    return lines.join("\n");
  }

  // ChatGPT / full 向け詳細版
  const lines: string[] = [
    "【質感・リアル度 — 人物と背景の質感統一を最優先】",
    `現在のレベル：Lv${lv}（${["イラスト", "デジタルペイント", "2.5D", "リアル寄り", "写真リアル"][lv - 1]}）`,
    `指針：${LEVEL_LEAD[lv]}`,
  ];
  if (req.realismType && TYPE_HINT[req.realismType]) {
    lines.push(`質感タイプ：${TYPE_HINT[req.realismType]}（このタイプの絵柄/描画スタイルを保つ）`);
  }
  lines.push("");
  lines.push("▼ 軸別の反映（変更範囲に含まれない軸は変えない）：");
  if (affectsBg) {
    lines.push(
      lv <= 2
        ? "  ・背景：写真のように描かない。アニメ背景／2D背景／デジタルペイント／絵画的背景にする。"
        : lv === 3
        ? "  ・背景：人物と同じ2.5D質感で統一。実写写真に見えないようにする。"
        : lv === 4
        ? "  ・背景：実写寄りだが、人物のアニメ／2.5D質感と馴染むよう柔らかく調整。"
        : "  ・背景：実写写真のような空間表現を許可する。"
    );
  }
  if (affectsOutfit) {
    lines.push(
      lv <= 2
        ? "  ・衣装の素材感：実写ではなく、塗り表現（セル画／ペイント）で示す。"
        : lv >= 4
        ? "  ・衣装の素材感：実物に近い質感・縫い目・布の落ち感を表現する。"
        : "  ・衣装の素材感：2.5Dの落とし込み（実写ほど精緻でなく、しかし立体感は残す）。"
    );
  }
  if (affectsCam) {
    lines.push(
      lv <= 2
        ? "  ・レンズ感：写真用語は控えめに。被写界深度のボケや実レンズ歪みは強調しない。"
        : lv >= 4
        ? "  ・レンズ感：実写レンズの収差・ボケ・センサー感を意識する。"
        : "  ・レンズ感：写真ともイラストとも取れる中間的な処理。"
    );
  }
  if (affectsLight) {
    lines.push(
      lv <= 2
        ? "  ・照明：イラスト的照明（影は塗り表現、ハイライトは色面で。）"
        : lv >= 4
        ? "  ・照明：現実の光の物理（柔らかい反射・GI・サブサーフェス）を意識する。"
        : "  ・照明：2.5D的にややディフォルメ。実写ほど厳密ではない。"
    );
  }
  lines.push("");
  lines.push("※ 重要：人物がアニメ／2.5D寄りの場合、背景だけ実写写真にしない。人物と背景の質感を必ず合わせる。");
  return lines.join("\n");
}

/**
 * 色ポリシー（restrict / block）ブロック。
 *
 *  block    : その色を一切使わない（衣装・髪・背景・小物・ライティングすべての軸で禁止）
 *  restrict : できるだけ控える（必要最小限、面積比 10% 未満）
 *
 * 「許可」は明示しない（既定状態）。
 * 完全な NG は ngList 側にも代表トークンが追加される（フロントの getBlockedColorTokens 経由）。
 * Nano Banana では短く圧縮。
 */
function colorControlBlock(req: GenerateRequest, pt: PromptTarget): string {
  const ctrl = req.colorControls;
  if (!Array.isArray(ctrl) || ctrl.length === 0) return "";

  const blocks    = ctrl.filter((c) => c.policy === "block");
  const restricts = ctrl.filter((c) => c.policy === "restrict");
  if (blocks.length + restricts.length === 0) return "";

  if (pt === "nano_safe") {
    const lines: string[] = ["【色 制御（簡潔反映）】"];
    if (blocks.length) {
      lines.push("使わない色：" + blocks.map((c) => c.jp).join("、"));
    }
    if (restricts.length) {
      lines.push("控える色（必要最小限）：" + restricts.map((c) => c.jp).join("、"));
    }
    return lines.join("\n");
  }

  const lines: string[] = [
    "【色 制御 — 出現コントロール】",
    "下記は利用者が指定した色ポリシーです。今回の【変更対象】に含まれる軸の色にのみ適用してください（変更対象外の軸の色は変えない）：",
  ];
  if (blocks.length > 0) {
    lines.push("");
    lines.push("▼ 一切使わない（候補から完全除外）：");
    for (const c of blocks) lines.push(`  ・${c.jp}`);
    lines.push("  ※ 微量のアクセントとしても使用しない。NG指定としても扱う。");
  }
  if (restricts.length > 0) {
    lines.push("");
    lines.push("▼ 控える（必要時のみ、画面占有率の目安は10%未満）：");
    for (const c of restricts) lines.push(`  ・${c.jp}`);
    lines.push("  ※ 主役色には選ばず、補助・小物・差し色程度に留める。");
  }
  lines.push("");
  lines.push("※ 変更範囲（スコープ）に含まれない軸の色は変えない。色固定ロックは最優先で維持。");
  return lines.join("\n");
}

/**
 * 風の強さブロック（0〜5）。
 * 髪・衣装・前景演出・ポーズ・カメラのいずれかが変更範囲ONの時のみ反映する。
 * 0 または対象スコープがない場合は何も出さない。
 */
function windBlock(req: GenerateRequest): string {
  const lv = req.windLevel;
  if (!lv || lv <= 0 || lv > 5) return "";
  const affectsAny =
    req.scopes.includes("hair") ||
    req.scopes.includes("outfit") ||
    req.scopes.includes("foreground") ||
    req.scopes.includes("pose") ||
    req.scopes.includes("camera");
  if (!affectsAny) return "";

  const hasHair    = req.scopes.includes("hair");
  const hasOutfit  = req.scopes.includes("outfit");
  const hasForeg   = req.scopes.includes("foreground");
  const hasPose    = req.scopes.includes("pose");
  const hasCamera  = req.scopes.includes("camera");

  // ── レベル別：「数値・気象比喩・具体的な物理現象」を盛る。
  //    LLM が「弱い」「強い」だけだとほぼ無視するので、毎レベルで違う具体名を入れる。
  type LevelSpec = {
    label:   string;   // 短いラベル
    mps:     string;   // 風速（参考値）
    analogy: string;   // 気象比喩（イメージ用）
    hair:    string;
    outfit:  string;
    foreg:   string;
    pose:    string;
    camera:  string;
    sharedFx: string;  // 共通で効かせる効果
  };

  const SPECS: Record<number, LevelSpec> = {
    1: {
      label: "微風", mps: "1〜2m/s 相当",
      analogy: "そよ風（カフェのテラスで前髪がふっと持ち上がる程度）",
      hair:   "毛先が数本だけ持ち上がる。前髪の先がわずかに乱れる。",
      outfit: "薄いシフォン/レースの裾の端だけが 1〜2cm ふわっと浮く。",
      foreg:  "細かい粒子（花粉・埃）が 1〜2粒、空中で漂う。",
      pose:   "髪に触れる手や首をかしげる仕草で『風を感じる』身体反応を1か所だけ入れる。",
      camera: "シャッタースピード 1/250 相当。動きはほぼ止めて捉える。",
      sharedFx: "全体は概ね静止画。動きはアクセント1点のみ。",
    },
    2: {
      label: "そよ風", mps: "3〜5m/s 相当",
      analogy: "夏の朝（カーテンが軽く揺れる、髪が顔にかかる）",
      hair:   "毛束のひと房が顔の前を横切る／後ろへ流れる。",
      outfit: "スカート/長袖の裾・袖口が片側に軽く流れて 5〜10cm の動きが見える。",
      foreg:  "花びら・木の葉などを 3〜5枚、被写体の脇に水平に流す。",
      pose:   "髪を耳にかける・布を押さえるなど『風に応じた』ナチュラルな仕草を1〜2か所。",
      camera: "シャッタースピード 1/125 相当。先端だけが軽くブレる。",
      sharedFx: "動きは全体の 10〜20% の領域。",
    },
    3: {
      label: "標準的な風", mps: "6〜8m/s 相当",
      analogy: "海辺の散歩（髪が顔から後ろへ明確に流れる）",
      hair:   "毛全体が片方向へ斜めに流れ、ボリュームが片寄る。後れ毛が顔の前を横切る。",
      outfit: "袖・裾・スカーフが斜め後ろへはっきりとなびく（30〜50cm のフロー）。",
      foreg:  "花びら・羽根・布片を 8〜12枚、被写体を取り囲むように斜めに流す。",
      pose:   "片手で髪を押さえる／布を翻す等、風と相互作用するアクティブなポーズに。",
      camera: "シャッタースピード 1/60 相当。流れる要素にわずかなモーションブラーを許可。",
      sharedFx: "動きは画面の 30〜50% を占める。風向は必ず明示する（左→右 等）。",
    },
    4: {
      label: "強い風", mps: "9〜12m/s 相当",
      analogy: "嵐の前ぶれ（コートが舞い、髪が乱れる）",
      hair:   "毛全体が強くたなびき、後ろへ尾を引く。前髪が大きく乱れて額や目元が見える瞬間。",
      outfit: "ロングコート・ドレスの裾が斜め後方へ大きくはためく（パラシュート状）。布のシワが明確。",
      foreg:  "花びら・葉・水滴・布片など 15〜25個を風線に沿って斜めに大量に流す。軌跡（streak）を描く。",
      pose:   "前傾／髪を顔から払う／布を掴むなど『風に対抗する動的ポーズ』。バランスがダイナミック。",
      camera: "シャッタースピード 1/30 相当。流れる要素に明確なモーションブラー／光跡を入れる。",
      sharedFx: "動きが構図の主役。画面の 50〜70% を風の流れが支配する。",
    },
    5: {
      label: "強風／突風", mps: "13m/s 以上",
      analogy: "台風・嵐（映画のクライマックスシーン）",
      hair:   "髪が完全に水平〜斜め上方向へ放射状にたなびく。一部の束は空中で軌跡を描く。",
      outfit: "コート・ドレスが大きく翻り、布が空中に弧を描く。スカートやマントが旗のように張る。",
      foreg:  "花びら・葉・砂・水しぶき・破片を 30+ 個、強い風線（streamlines）で表現。長い軌跡。",
      pose:   "嵐に立ち向かう／髪と布が暴れる中で踏ん張る等、ドラマチックで物語性の高い瞬間。",
      camera: "シャッタースピード 1/15 相当。明確な光跡・モーションブラー。シネマティック。",
      sharedFx: "動きが画面全体を支配する。風の方向と速度感が一目で伝わる構図に。",
    },
  };

  const s = SPECS[lv];

  // ── 軸別の具体指示を組み立て ──
  const axisLines: string[] = [];
  if (hasHair)   axisLines.push(`  ・髪 ：${s.hair}`);
  if (hasOutfit) axisLines.push(`  ・衣装：${s.outfit}`);
  if (hasForeg)  axisLines.push(`  ・前景演出：${s.foreg}`);
  if (hasPose)   axisLines.push(`  ・ポーズ：${s.pose}`);
  if (hasCamera) axisLines.push(`  ・カメラ：${s.camera}`);

  return [
    `【💨 風の強さ Lv${lv}／${s.label}（${s.mps}）— 必ず画面上で見える形で表現すること】`,
    `イメージ：${s.analogy}`,
    "",
    "▼ 軸別の具体表現（変更範囲ONの軸のみ反映・他軸は変えない）：",
    ...axisLines,
    "",
    `▼ 全体方針：${s.sharedFx}`,
    "",
    "▼ 厳守ルール：",
    "  ・「風が吹いている」と一言書くだけでは不十分。上記の具体的な視覚要素を必ず描写に含める。",
    "  ・無風・止まった印象になる表現（completely still / no motion / frozen pose）は禁止。",
    "  ・風向は画面の中で一貫させる（左→右なら全要素が同じ方向に流れる）。バラバラな方向の風を混ぜない。",
    "  ・背景・顔・人物の同一性は変えない。風はあくまで動きの演出。",
  ].join("\n");
}

/**
 * ZOZOトレンド反映ブロック（衣装のみ）。
 * 現在の女性ファッショントレンドを抽象属性として衣装に落とし込む。
 * outfit スコープ選択時のみ発動。ブランド名・商品名は出さない。
 */
function zozoTrendBlock(req: GenerateRequest): string {
  const z = req.zozoTrend;
  if (!z || !Array.isArray(z.traits) || z.traits.length === 0) return "";
  // 衣装ON時のみ反映（最重要ルール）
  if (!req.scopes.includes("outfit")) return "";

  const priority = z.mode === "priority";
  const heading  = priority
    ? "【ZOZOトレンド 優先反映 — 衣装方針の主軸】"
    : "【ZOZOトレンド反映 — 衣装のみ】";
  const headLine = priority
    ? `女性ファッショントレンド（参考年代：${z.ageLabel}）を衣装方針の『主軸』として最優先で反映する。`
    : `現在の女性ファッショントレンド（参考年代：${z.ageLabel}）を参考に、以下の傾向をリアルな衣装に落とし込む：`;

  // トレンド候補をトップス/ボトムス/その他に分類（差別化指示に使う）
  const TOPS_KEYWORDS    = ["カットソー", "ブラウス", "ニット", "シャツ", "トップス", "Ｔ", "T", "チューブ",
                             "ベスト", "タンク", "キャミ", "オフショル"];
  const BOTTOMS_KEYWORDS = ["パンツ", "スカート", "ワンピ", "デニム", "レギンス", "サロペット", "カーゴ"];
  const hasTops    = z.traits.filter((t) => TOPS_KEYWORDS.some((kw) => t.includes(kw)));
  const hasBottoms = z.traits.filter((t) => BOTTOMS_KEYWORDS.some((kw) => t.includes(kw)));
  const hasOthers  = z.traits.filter((t) => !hasTops.includes(t) && !hasBottoms.includes(t));
  const diversityNote =
    (hasTops.length >= 2 || hasBottoms.length >= 2)
      ? [
          "",
          "▼ 案ごとの差別化ルール（最重要）：",
          `  - トップス候補（${hasTops.length}種）：${hasTops.map((t) => `「${t}」`).join("、")}`,
          `    → 各案で【異なるトップス】を1つ選ぶ。同じトップスを複数案で使い回さない。`,
          ...(hasBottoms.length >= 2
            ? [`  - ボトムス候補（${hasBottoms.length}種）：${hasBottoms.map((t) => `「${t}」`).join("、")}`,
               `    → 各案で【異なるボトムス】を選ぶ。同じボトムスを複数案で使い回さない。`]
            : []),
        ]
      : [
          "",
          "  - 各案で組み合わせ方・色・シルエットを変えて差別化する。",
        ];

  const lines: string[] = [
    heading,
    headLine,
    "  " + z.traits.map((t) => `「${t}」`).join("、"),
    "",
    "▼ ルール（厳守）：",
    "  - ブランド名・商品名・店舗名・ランキング順位は一切出さない。" +
    "あくまで『服の種類・色・素材・シルエット・系統』の傾向として表現する。",
    "  - 反映するのは衣装のみ。背景・顔・髪・ポーズ・カメラ・その他の固定軸は変更しない。",
    "  - 上記傾向を自然に組み合わせ、実際に着られそうな『今っぽいリアルなコーデ』にする" +
    "（非現実的な装飾過多・コスプレ的誇張にしない）。",
    ...(hasOthers.length > 0 ? [`  - 色・スタイル傾向（${hasOthers.map((t) => `「${t}」`).join("、")}）はすべての案で共通の方向性として活かす。`] : []),
    ...diversityNote,
  ];
  if (priority) {
    lines.push(
      "  - 衣装系の他指定（神引き・世界観・補助）と方向性が衝突する場合は、" +
      "ZOZOトレンドの方向性をベースにして調整する。"
    );
  }
  return lines.join("\n");
}

/**
 * 衣装生成ガイド。
 * 「量産AIっぽいドレス」パターンを強力に抑制し、ファッション性・意外性・モード感のある
 * 衣装を生成するよう LLM を誘導する。outfit スコープが含まれる場合に常時適用。
 */
function outfitDiversityBlock(): string {
  return [
    "【衣装生成ガイド — 量産AIドレス禁止・ファッション性最優先】",
    "",
    "▼ デフォルト優先カテゴリ（まずここから選ぶ）：",
    "  モード / ストリート / 広告ファッション / 近未来ファッション / テックウェア",
    "  コンセプト衣装 / 高級ブランド風 / 実験的ファッション / アート衣装 / エディトリアル",
    "  ランウェイ / Y2K / Y3K / ミニマル高級 / 構築的シルエット / レイヤード",
    "  異素材ミックス / 工業デザイン服 / 和モダン / 軍装風モード / スポーツラグジュアリー",
    "  ゴシックモード / サイバーモード / 都市未来服 / コンセプトコスチューム / 高級制服",
    "",
    "▼ ドレス系を選んでよい条件（以下の文脈に限る）：",
    "  ゴシック / ダークラグジュアリー / 映画的 / 神話・幻獣 / クラシカル / 悪役系 / 王族系 / 退廃美",
    "  → 上記以外の文脈でドレスをデフォルト選択しない。",
    "",
    "▼ ドレスが出る場合の必須条件（princess / fairy / fantasy 表現は禁止）：",
    "  構築的・建築的シルエット / 非対称 / 素材実験 / 未来素材 / シャープ",
    "  ダークゴシック / 高級ブランド風 / 広告風 のいずれかの方向で表現する。",
    "  「プリンセス」「妖精風」「女神風」「エルフ女王風」は表現に使わない。",
    "",
    "▼ 絶対に選ばない量産AIパターン（全案・全モードで厳禁）：",
    "  × プリンセスドレス / 量産ファンタジードレス / 透明シフォンドレス",
    "  × フリル大量 / 宝石まみれ / 女神風 / 妖精風 / 透明オーガンザ過多",
    "  × コルセット＋フリル固定パターン / 紫青クリスタル / キラキラ姫 / ふわふわ光る白ドレス",
    "  × エルフ女王風 / 魔法少女テンプレ衣装 / 透明マント付き幻想ドレス",
    "  × 「透明感＋フリル＋クリスタル＋ファンタジー＋女神」が同時に揃う組み合わせ → 即差し替え",
    "",
    "▼ 各案の衣装カテゴリ差別化（必須）：",
    "  - 複数案で同一カテゴリを繰り返さない（ドレス連発・ゴシック連発等を禁止）",
    "  - 素材・シルエット・色・時代感を案ごとに明確に変える",
    "  - 例：案1=テックウェア系 案2=和モダン 案3=Y2Kグランジ 案4=モード・ランウェイ",
    "",
    "▼ 衣装を確定する前の必須チェック：",
    "  □ 「よく見るAI量産画像の衣装パターン」に該当していないか",
    "  □ ドレスを選ぶ場合、上記「許可条件」に該当しているか",
    "  □ 複数案で衣装カテゴリが被っていないか",
    "  → 問題がある場合は上記優先カテゴリに差し替えてから出力する。",
    "",
    "▼ 【黒系ドレス — 最重要制限】：",
    "  黒・ダーク系のドレス（黒ドレス / 黒レースドレス / 黒フリルドレス / ダークドレス）は",
    "  以下の文脈が明示されている場合のみ選択できる：",
    "  ✓ ゴシック / ゴシックロリィタ / ゴシックモード が指定されている",
    "  ✓ dark / gothic mood が選択されている",
    "  ✓ 悪役系 / 魔女系 / ヴァンパイア系 / 退廃美 が明示されている",
    "  × 上記以外の「おまかせ・未指定」状態での黒ドレスはデフォルト禁止。",
    "  × 黒い衣装を出したい場合は「黒テックウェア」「黒コート」「黒スーツ」「黒ジャケット」等",
    "    ドレス以外のカテゴリで表現すること。",
    "  × 複数案で黒ドレスを連続して使わない（ゴシック文脈でも1案に留める）。",
  ].join("\n");
}

/**
 * ビジュアル設計の基本哲学ブロック。
 * このアプリが目指すのは「整った安全な生成」ではなく
 * 神引き・意外性・バズ・印象・中毒性・異常な組み合わせ。
 */
function userStyleBlock(): string {
  return [
    "【ビジュアル設計の基本哲学】",
    "このアプリの目的は「整った安全な生成」ではなく、神引き・意外性・バズ・強い印象・中毒性・異常な組み合わせ を追求すること。",
    "「全部足しても強いなら足していい。禁止なのは意味のない全部盛り。」",
    "",
    "▼ 構図・視認性（常時）：",
    "  - 被写体（1人）を中央配置、サムネで顔が潰れない視認性を確保する",
    "  - 高コントラスト・強い色テーマ・一目で世界観が伝わる主題",
    "  - 「保存したくなる絵」「壁紙にしたい絵」「10秒見続けてしまう絵」の完成度",
    "",
    "▼ 世界観は案ごとに散らす（同系統連続禁止）：",
    "  幻想 / 和風 / ダーク / 近未来 / 廃墟 / 広告 / 神秘 / ゴシック / サイバー /",
    "  ストリート / アート / 上品 / レトロ / 工業 / 神話 / 劇場的",
    "",
    "▼ 演出の散らし方（同じ演出を連発しない）：",
    "  光演出 / 影演出 / 質感演出 / 空気感演出 / 色対比演出 / 前景演出 /",
    "  抽象エフェクト / テクスチャ演出 / 空間演出 / 構図のトリック",
    "",
    "▼ 物騒な小道具ルール（特別演出として扱う。常時は出さない）：",
    "  攻撃的に見える小道具は、ユーザーがその系統を明示した場合のみ採用する。",
    "  それ以外の場面では小物・アクセサリー・光・影・空間・テクスチャで代替する。",
    "",
    "▼ 連発禁止（案をまたいで連続しないよう分散）：",
    "  同じ背景・同じ演出・同じ色・同じ小物カテゴリを複数案で連発しない。",
    "  透明ホログラムパネル・青いネオン・サイバー都市・HUDパネル は全案の25%以内に制限。",
  ].join("\n");
}

/**
 * 背景設計の基本原則（グローバル適用）。
 *
 * デフォルト哲学：背景は「被写体を立てる」空間設計。
 * 指定がない限り控えめ・上品・抜け感を優先。
 * 神背景系・世界観全振り が指定された場合のみ「暴れる」。
 *
 * background scope で place が具体値の場合はユーザー意図を尊重してスキップ。
 */
function bgDiversityBlock(req: GenerateRequest): string {
  // background scope で場所が具体的に指定済みなら制御不要
  // BUG-2: details / details.background が欠落していてもクラッシュしないよう optional chaining。
  // 未指定時は早期 return せず、通常の背景多様性ガイドへ進む（安全側の既定）。
  if (req.scopes.includes("background")) {
    const b = req.details?.background;
    if (b && b.place !== "auto" && b.place !== "skip") return "";
  }

  // 世界観全振りモード（背景を思い切り展開してよい条件）
  const WORLD_MOODS: Mood[] = ["fantasy", "gothic", "dark", "glitch", "cyberpunk"];
  const isWorldMode =
    (req.autoMoodCategories ?? []).some((c) => c === "世界観") ||
    req.moods.some((m) => WORLD_MOODS.includes(m));

  if (req.scopes.includes("background") && isWorldMode) {
    // 背景スコープあり ＋ 世界観モード → 制限緩め。ネオン連発だけ防ぐ
    return [
      "【背景：世界観モード】",
      "背景を変更する場合、各案で全く異なるロケーション・雰囲気・色調を使うこと。",
      "同じ背景を言い換えた案を作らない。自然・廃墟・室内・幻想・宇宙・抽象など多様なカテゴリから選ぶ。",
      "ネオン街・電脳都市・雨のネオン路地は全案の25%以内に制限（世界観モードでも連発しない）。",
    ].join("\n");
  }

  // ★ デフォルト：背景は控えめ・被写体を立てる
  return [
    "【背景設計の基本原則 — 重要】",
    "背景は「被写体を立てる」ための空間設計。デフォルトは控えめ・上品・抜け感を優先する。",
    "「背景が主役になって被写体に競合していないか」を常に確認すること。",
    "",
    "▼ デフォルト優先背景（指定がない場合、ここから選ぶ）：",
    "  白空間 / 高級スタジオ / 広告的ニュートラル壁 / 影だけの背景 / 無機質空間 /",
    "  柔らかい逆光 / ぼけた都市 / 反射床 / 薄い霧 / グラデーションバック /",
    "  シンプルな屋上 / モノトーン壁 / 抽象光背景 / 静謐な自然（1色の空・砂・草原）",
    "",
    "▼ 背景が「暴れていい」条件（以下のいずれかが明示されている場合のみ）：",
    "  - backgroundスコープが選択されている（ユーザーが背景変更を明示）",
    "  - 「神背景」「世界観」「幻想」「神話」「廃墟」「近未来都市」が具体的に指定されている",
    "  - 詳細設定で具体的な背景場所が設定されている",
    "",
    "ネオン街・電脳都市・雨のネオン路地・ブレードランナー風を使える条件：",
    "  「ネオン」「サイバー街」「電脳都市」「未来都市」「雨のネオン街」が明示指定の場合のみ。",
    "  それ以外では全案の15%以内（4案なら最大1案）に制限する。",
    "",
    "各案で背景の方向性を明確に差別化し、同じ背景傾向が連続しないよう分散させる。",
  ].join("\n");
}

/**
 * ポーズダイナミクス強制ブロック。
 * 静止ポーズを禁止し、動きのあるダイナミックなポーズを要求する。
 * pose スコープ選択時に挿入。
 */
function poseDynamicsBlock(): string {
  return [
    "【ポーズ設計 — 動きのあるポーズ必須】",
    "静止立ちポーズ（ただ立っているだけ / 正面を向いて直立するだけ）は使わない。",
    "「動き」「重力」「エネルギー」「ストーリー」が感じられるポーズを選ぶ。",
    "",
    "▼ 採用すべきポーズの方向性（案ごとに明確に変える）：",
    "  振り返りながら歩く / ジャンプの頂点 / しゃがみ込み / 壁を蹴る瞬間 / 片脚を上げる /",
    "  体をひねりながら視線をこちらに / 走り出す直前 / 飛び降りる直前 / 片手を上に伸ばす /",
    "  体が傾く瞬間 / 服・髪が風になびく / 地面に片膝をつく / 前傾姿勢で歩く /",
    "  振り返る途中の角度 / 肩ごしに視線 / 踊る途中のコマ止め",
    "",
    "▼ ポーズを確定する前の確認：",
    "  □ 「ただ立っているだけ」「正面を向いて直立」になっていないか",
    "  □ ポーズに「なぜそのポーズなのか」のストーリーがあるか",
    "  □ 各案でポーズが明確に異なるか",
  ].join("\n");
}

/**
 * 持ち物哲学ブロック。
 * 小道具扱いを禁止し、持ち物を作品の主役として設計させる。
 * props スコープ選択時に既存 propsRule と併用して挿入。
 */
function propsPhilosophyBlock(): string {
  return [
    "【持ち物設計の哲学 — 持ち物が作品を決める】",
    "持ち物は「小道具」ではない。持ち物だけで世界観・ストーリー・インパクトが決まっていい。",
    "「この持ち物、何？」と思わせるものを選ぶ。普通のハンドバッグ・スマホ・傘をデフォルトにしない。",
    "",
    "▼ 「主役になれる持ち物」の方向性（案ごとに全く別のカテゴリから）：",
    "  巨大な破れたぬいぐるみ / 古い監視カメラ（本物サイズ）/ 巨大なガラス箱 /",
    "  壊れたブラウン管テレビ / 鎖（装飾的） / 謎の発光装置 / 巨大な望遠鏡 /",
    "  古いプロジェクター / 超大型の手鏡 / ビニール袋いっぱいの花 /",
    "  剥製（小動物） / アンティーク地球儀 / 巨大なスノードーム /",
    "  ロール状の設計図 / 鳥籠（空） / 古い地図 / 発光する虫かご",
    "",
    "▼ 持ち物の選び方の原則：",
    "  - サイズ感は「普通より大きめ or 普通より小さすぎ」で違和感を出す",
    "  - 持ち物の「なぜここにあるのか」がわからないほど刺さる",
    "  - 衣装とジャンルが合いすぎる組み合わせは避ける（例：ゴシック×黒いバラは量産）",
    "  - 各案で持ち物のカテゴリ・素材・サイズ感を完全に変える",
  ].join("\n");
}

/**
 * 異常な組み合わせ奨励ブロック。
 * 「整合性の高い組み合わせ」ではなく「意外な衝突」を積極採用させる。
 * avoidClicheBlock と対で使用（あちらは「避ける定番」、こちらは「採用する衝突」）。
 */
function weirdCombinationBlock(): string {
  return [
    "【異常な組み合わせ — 積極採用ルール】",
    "「整合性がとれた組み合わせ」より「ジャンルの衝突・意外な文脈の混在」の方が刺さる。",
    "以下のような「一見ミスマッチ」を積極的に採用する：",
    "",
    "▼ 推奨する衝突パターン（例）：",
    "  上品×破壊 / 広告ビジュアル×廃墟 / Y3K×和紙・墨 / ゴシック×ポップカラー /",
    "  廃墟×高級ブランドファッション / 軍服×花畑 / 工事現場×ランウェイ /",
    "  和装×未来都市 / サイバー×土の庭 / スーツ×遊園地の廃墟 /",
    "  清楚×重機 / バレエ×工場 / 夏祭り×雪 / ストリート×宮殿",
    "",
    "▼ 組み合わせのルール：",
    "  - 「A × B」の両方が画面に存在し、どちらかが演出にとどまらず主役級であること",
    "  - 「なぜこの組み合わせ？」という疑問が保存・拡散の動機になる",
    "  - 各案で異なる「衝突軸」を使う",
  ].join("\n");
}

/**
 * カメラ攻撃性ブロック。
 * 正面・バストアップ・普通の三分割に偏らず、攻撃的なカメラアングルを採用させる。
 * camera スコープ選択時に挿入。
 */
function cameraAggressionBlock(): string {
  return [
    "【カメラ設計 — 攻撃的なアングル採用】",
    "「正面・バストアップ・ふつうの三分割」をデフォルトにしない。",
    "カメラの選択それ自体がインパクトになるアングルを採用する。",
    "",
    "▼ 採用すべきカメラの方向性（案ごとに明確に変える）：",
    "  防犯カメラ風ハイアングル / 魚眼レンズ歪み / 真上（真俯瞰）/",
    "  超ローアングル（地面すれすれ）/ 斜め45度上からの見下ろし /",
    "  超接近クローズアップ（顔の一部のみ）/ ドローン空撮風 /",
    "  パパラッチ望遠ショット（被写体が気づいていない）/",
    "  鏡越し・ガラス越し反射 / 画面端に寄せた大胆トリミング /",
    "  走り抜ける瞬間のブレ（意図的モーションブラー）",
    "",
    "▼ カメラを確定する前の確認：",
    "  □ 「正面バストアップ」「正面全身」がデフォルトになっていないか",
    "  □ このカメラアングル自体が「意外性」を持っているか",
    "  □ 各案でカメラアングルが明確に異なるか",
  ].join("\n");
}

/**
 * 全モード共通の安全出力ガイド。
 * LLM が生成するプロンプト本文（ユーザーが ChatGPT / Gemini / Nano に貼り付けるもの）が
 * 安全フィルターで誤判定されないよう、使用する表現の方針を事前に示す。
 * NG語リストではなく「どう書くか」の肯定的指示で記述する。
 */
function safetyOutputGuideBlock(): string {
  return [
    "【出力プロンプト 安全表現ガイド — 全モード共通・必須】",
    "生成するプロンプト本文は以下の方針で記述すること：",
    "",
    "▼ 衣装・ファッションの記述方針：",
    "  衣装はデザイン系統・シルエット・素材・色・ブランド感・季節感で表現する。",
    "  身体の部位を直接強調する言い方は避け「衣装のシルエット」「衣装のライン」「デザインの開放感」で代替する。",
    "  「スタイリッシュ」「上品」「洗練された」「大人っぽい」「モード感のある」を積極的に使う。",
    "",
    "▼ ポーズ・印象の記述方針：",
    "  「印象的な」「自信のある」「堂々とした」「凛とした」「存在感のある」を使う。",
    "  ポーズの力強さはダイナミクス・バランス・視線・エネルギーで表現する。",
    "",
    "▼ 小物・アクセサリーの記述方針：",
    "  小物はファッションアイテム・発光アクセサリー・光るオブジェクトとして表現する。",
    "  鋭利・物騒に見える小道具は描かず「発光する小道具」「透明なライトオブジェクト」「光るスタイリッシュな小道具」に置き換える。",
    "  手に持つアイテムは「スタイリッシュなアクセサリー」「未来的な小道具」として表現する。",
    "",
    "▼ 視覚インパクトの表現方針：",
    "  SNSインパクトは「配色の強さ」「光演出」「前景エフェクト」「構図の迫力」「ファッション性の高さ」で表現する。",
    "  過激さや危険な雰囲気ではなく、視覚的完成度・配色・光・透明感・高級感でインパクトを演出する。",
    "",
    "▼ 一発バズりモードの表現方針：",
    "  SNS映えは「強い配色コントラスト」「ドラマチックな光源」「印象的な前景演出」「高級感のあるファッション性」で実現する。",
    "  花・光・羽・水・透明素材・オーラ・粒子エフェクトを優先して使う。",
    "",
    "▼ プリセット別 表現方針：",
    "  Y2K：2000年代カルチャー全般（ピンクギャル固定ではない）。",
    "    ▷ 海外セレブ / クラブ / MTV / スポーティ / デニム / ラグジュアリー / サイバー / グランジ",
    "    ▷ モード / フェミニン / 広告 / 渋谷系 / レトロポップ / クロームシルバー 等を多様に使う。",
    "    ▷ 色はピンク固定にしない：シルバー / ブラック / ゴールド / レッド / パープル / ライム等も積極使用。",
    "    ▷ 小物はハート・キラキラ杖を避け、ヘッドフォン・ミニバッグ・チェーンアクセ・折りたたみデバイス等を使う。",
    "    ▷ 各案で背景・色・衣装シルエット・小物を完全に差別化する。身体強調・露出強調は避ける。",
    "  Y3K：未来のファッションカルチャー全般（ラグジュアリー未来・ポップ未来・カラフル未来・AI広告未来・都市未来・宇宙ホテル・未来ランウェイ等）。",
    "    ▷ 色は毎回多様に変える（マゼンタ・オレンジ・ゴールド・ホワイト・パステル等、青に固定しない）。",
    "    ▷ 小物はHUDパネル・透明オーブ・ホログラムUIを避け、近未来バッグ・発光アクセ・抽象オブジェ等から選ぶ。",
    "    ▷ 衣装は透明ボディスーツに固定せず、テックウェア・未来ランウェイ・ミニマル未来・クロームジャケット等を使う。",
    "    ▷ 背景はSF通路・電脳都市の雨に固定せず、未来ホテル・近未来ギャラリー・抽象空間・未来美術館等を使う。",
    "    ▷ 各案で背景・色彩・衣装・小物・演出を完全に差別化する。争いを思わせる要素は避ける。",
    "  ストリート：ファッション誌・モデルスナップ・アーバンカジュアルが基本（80%はこの方向）。",
    "    ▷ 「サイバーパンク」「電脳街」「ネオン路地」「黒×紫の雨のサイバー街」は全案の15%以内に制限する。",
    "    ▷ 衣装は白・ベージュ・デニム・カラフルな差し色を80%で優先。黒コーデは全案の1〜2割以内。",
    "    ▷ 背景は都市の自然光・屋上・ギャラリー・スタジオ・屋内等を優先。alley/industrialに偏らない。",
    "    ▷ 黒い衣装が出る場合は「アーバングランジ」「ゴシックストリート」等の明確な方向性を付与し、単なる黒×サイバーにしない。",
    "    ▷ 威圧感・反社会的表現・危険な演出は避ける。",
    "  神話/幻獣：人物が主役で幻獣は演出要素。各案で幻獣種・配置・文化・スタイルを完全に差別化する。",
    "    ▷ 既存IPの固有名詞（ガンダム・ポケモン・DQ・FF等）は使わずオリジナルデザインで描く。",
    "    ▷ 生々しい描写は避け、神聖・神秘・壮大・美麗な表現で幻獣を描く。",
    "    ▷ 幻獣ばかりを説明するのではなく、人物と幻獣の関係性・世界観を画として表現する。",
    "  ゴシック・ダーク系：暗さは「深みのある」「ミステリアスな」「重厚感のある」「幻想的な」で表現する。",
    "",
    "▼ 量産AIドレスパターン禁止（出力前に必ず確認）：",
    "  生成するプロンプトに以下のパターンが含まれていないか確認する：",
    "  × プリンセスドレス / 女神ドレス / 妖精ドレス / 透明シフォンドレス / フリル盛りドレス",
    "  × 宝石・クリスタル装飾過多 / 紫青クリスタル / エルフ女王風 / キラキラ幻想ドレス",
    "  × コルセット＋フリル固定 / 魔法少女テンプレ衣装 / 透明オーガンザ多用 / ふわふわ光る白ドレス",
    "  → 上記パターンが出る場合は「モード系・テックウェア・ランウェイ・Y2K・和モダン・ゴシックモード」等に変更する。",
    "  → ドレス系が許可されるのはゴシック・ダークラグジュアリー・映画的・神話・クラシカル・悪役系・王族系の文脈のみ。",
    "  → ドレスが出る場合も必ず「構築的・モード・建築的シルエット・非対称・高級ブランド風」で表現する。",
    "",
    "▼ 衣装シルエット・体型表現の禁止語と代替語（ChatGPT Image が特に敏感）：",
    "  ❌ スリムドレス           → ✅ スタイリッシュなドレス",
    "  ❌ スリムなパンツ         → ✅ テーパードパンツ",
    "  ❌ スリムな〇〇（衣装系）  → ✅ クリーンラインの〇〇 / シャープな〇〇",
    "  ❌ 彫刻的なシルエット     → ✅ 構造美のあるフォルム",
    "  ❌ 彫刻的なライン         → ✅ 立体的なデザインライン",
    "  ❌ エレガントなシルエット  → ✅ エレガントなフォルム",
    "  ❌ 体を強調するシルエット  → ✅ 洗練されたフォルム",
    "  ❌ ボディコン（衣装）      → ✅ フィット感のあるデザイン",
    "  ❌ タイトなシルエット      → ✅ シャープラインのデザイン",
    "  ❌ 細身のシルエット        → ✅ スマートなフォルム",
    "  ※ 「シルエット」は衣装デザインの文脈では使ってよい。体型・スリムと組み合わせない。",
    "",
    "▼ 出力全体のトーン規定（全モード共通）：",
    "  生成するプロンプトは『全年齢対象のファッション広告・アート写真・編集モード誌』の水準に収める。",
    "  大人向けの過激な方向や生々しい方向には振らず、上品・洗練・芸術的な方向でまとめる。",
    "  キャラクターは衣装デザイン・シルエット・色・素材・雰囲気で魅力を表現し、身体そのものを主題にしない。",
    "  危険物や争いを思わせる要素は用いず、ファッション・アート・幻想の文脈の小道具へ置き換える。",
    "  暗さ・重厚感は『ミステリアス』『幻想的』『ゴシックモード』など雰囲気語で表現する。",
    "→ 刺激が強くなりそうなときは、必ず上品な広告ビジュアル寄りの語へ言い換えてから出力する。",
    "",
    "【出力前 セルフチェック（必須）】",
    "各案を出力する直前に以下を確認し、該当すれば上品な代替表現へ書き換えてから出力すること：",
    "  □ 全年齢のファッション広告として問題ない表現になっているか",
    "  □ 体型そのものを強調する語（スリム＋衣装語・ボディコン・彫刻的なライン等）を使っていないか",
    "  □ 衣装は『デザイン・シルエット・素材・色』の語で表現できているか",
    "  → 該当すれば、その場で上品・洗練・アート寄りの語に書き換えて出力する。",
  ].join("\n");
}

/**
 * LLM が出力したプロンプト本文を安全後処理する。
 * ChatGPT / Gemini / Nano に貼り付けた際に誤判定されやすい語句を
 * ファッション・アート向けの安全な表現に自動置換する。
 * 意味を保ちながら過激語・身体強調語・武器語・暗黒系語を中立化する。
 * （安全基準の回避・危険内容の隠蔽ではなく、誤判定防止のための表現整備）
 *
 * @param text  LLM の生出力テキスト
 * @param debug true にすると置換ログをサーバーコンソールに出力（開発用）
 */
export function safetySanitizePrompt(
  text: string,
  debug = process.env.NODE_ENV !== "production",
): string {
  const log: Array<{ detected: string; replaced: string }> = [];

  function applyRule(input: string, pat: RegExp, rep: string): string {
    return input.replace(pat, (match) => {
      log.push({ detected: match, replaced: rep });
      return rep;
    });
  }

  // ─── 単語・フレーズ置換ルール ─────────────────────────────────────────────
  // ★ 順序重要：複合語・長いフレーズを先に処理し、単語は後でキャッチする
  const rules: Array<[RegExp, string]> = [

    // ── 悪魔・魔王・堕天使・闇落ち系（ChatGPT が特に敏感） ──────────────────
    [/悪魔女王/g,                               "ゴシック系の女王"],
    [/悪魔王/g,                                 "ゴシック調の支配者"],
    [/悪魔的な?/g,                              "ゴシック調の"],
    [/悪魔(?:系|風|スタイル|モード|化)/g,       "ゴシック系キャラクター"],
    [/悪魔(?=の|が|を|と|に|は|も|で|、|。|\s|$)/g, "ゴシック系キャラクター"],
    [/魔王スタイル/g,                           "神秘的な貴族スタイル"],
    [/魔王(?=の|が|を|系|風|、|。|\s|$)/g,     "神秘的な貴族"],
    [/堕天使/g,                                 "幻想的なキャラクター"],
    [/サキュバス/g,                             "ミステリアスなダーク系キャラクター"],
    [/インキュバス/g,                           "ミステリアスなダーク系キャラクター"],
    [/アンデッド/g,                             "ゴシック系"],
    [/暗黒騎士/g,                               "ダーク系騎士"],
    [/バニーガール/g,                           "バニーモチーフコスチューム"],
    [/闇落ち/g,                                 "深みのある変容"],
    [/闇の女王/g,                               "神秘的な女王"],
    [/闇の王/g,                                 "神秘的な存在感"],
    [/闇の魔女/g,                               "神秘的な魔女"],
    [/闇(?=の|系|属性|魔法|エネルギー|オーラ|サイド|面)/g, "深みのある"],
    [/死の天使/g,                               "ゴシック系の天使"],
    [/呪われた/g,                               "ダーク系の"],
    [/妖艶な?/g,                                "ミステリアスな"],
    [/誘惑的な?/g,                              "魅惑的な"],

    // ── 量産AIドレスパターン（長いフレーズを先に） ────────────────────────────
    [/プリンセスドレス/g,                        "モードドレス"],
    [/女神のような?ドレス/g,                     "構築的なドレス"],
    [/女神風ドレス/g,                            "アーキテクチャルドレス"],
    [/妖精のような?ドレス/g,                     "デザイナーズドレス"],
    [/妖精風ドレス/g,                            "エディトリアルドレス"],
    [/エルフ女王風/g,                            "ダーク系ゴシックモード"],
    [/魔法少女(?:風|テンプレ)?衣装/g,            "ゴシック系コンセプト衣装"],
    [/透明マント付き/g,                          "構築的なアウター付き"],
    [/ふわふわ(?:光る)?白いドレス/g,             "モードなホワイトドレス"],
    [/フリル(?:が)?大量/g,                       "装飾的なデザイン"],
    [/宝石まみれ/g,                              "ジュエリーアクセント"],
    [/キラキラ姫/g,                              "ラグジュアリースタイル"],
    [/量産ファンタジードレス/g,                  "コンセプトドレス"],
    [/AIっぽい?幻想ドレス/g,                     "アーキテクチャルドレス"],

    // ── 衣装シルエット・体型輪郭の強調表現（ChatGPT Image が特に敏感） ─────────
    // 長いフレーズを先に処理する
    [/スリムドレス/g,                            "スタイリッシュなドレス"],
    [/スリムなパンツ/g,                          "テーパードパンツ"],
    [/スリムなスカート/g,                        "クリーンラインのスカート"],
    [/スリムなシルエット/g,                      "クリーンラインのフォルム"],
    [/スリムなジャケット/g,                      "シャープなジャケット"],
    [/スリムなコート/g,                          "シャープなコート"],
    [/スリムな?(?=衣装|フィット)/g,              "クリーンラインの"],
    [/スリム(?=な|で|のシルエット|フィット)/g,   "クリーンライン"],
    [/彫刻的なシルエット/g,                      "構造美のあるフォルム"],
    [/彫刻的な?(?=ライン|デザイン|衣装|フォルム)/g, "立体的な"],
    [/彫刻的な?/g,                               "構造的な"],
    [/エレガントなシルエット/g,                  "エレガントなフォルム"],
    [/セクシーなシルエット/g,                    "洗練されたフォルム"],
    [/タイトなシルエット/g,                      "シャープラインのフォルム"],
    [/タイトな?(?=ドレス|衣装|ワンピース)/g,     "シャープラインの"],
    [/細身のシルエット/g,                        "スマートなフォルム"],
    [/ボディコン(?:スタイル)?/g,                 "フィット感のあるデザイン"],

    // ── 身体部位の強調表現 ───────────────────────────────────────────────────
    [/胸元を強調する?/g,                        "トップス部分のデザインを活かす"],
    [/胸元(?:に手を当てる)?/g,                  "トップス部分"],
    [/胸元/g,                                   "トップス部分"],
    [/胸から上/g,                               "上半身"],
    [/胸の高さ/g,                               "上半身の高さ"],
    [/胸の前で/g,                               "体の前で"],
    [/胸(?=が|を|の|部|周り|まわり|元)/g,       "バスト部分のデザイン"],
    [/太もも(?:を強調(?:する?)?)?/g,            "脚まわり・ボトムス"],
    [/ボディラインを強調する?/g,                "衣装のシルエットを際立たせる"],
    [/ボディライン/g,                           "衣装のシルエット"],
    [/肌を強調する?/g,                          "衣装のデザインを際立たせる"],
    [/肌を見せ/g,                               "デザインで魅せ"],
    [/肌の透け/g,                               "素材の透け感"],
    [/肉感的な?/g,                              "シルエット感のある"],
    [/肉感/g,                                   "シルエット感"],
    [/フェティッシュ/g,                         "個性的なファッション"],

    // ── 露出関連語 ──────────────────────────────────────────────────────────
    [/露出を強調する?/g,                        "開放感のあるデザイン"],
    [/露出高め/g,                               "スタイリッシュなシルエット"],
    [/露出低め/g,                               "カバレッジの高いデザイン"],
    [/露出標準/g,                               "標準的なシルエット"],
    [/露出度(?:が)?(?:高|低)/g,                 "衣装デザインの開放感"],
    [/露出度/g,                                 "衣装デザイン"],

    // ── 刺激的な形容詞・危険表現 ────────────────────────────────────────────
    [/官能的な?/g,                              "洗練された"],
    [/挑発的な?/g,                              "印象的な"],
    [/セクシーな?/g,                            "スタイリッシュな"],
    [/扇情的な?/g,                              "印象的な"],
    [/過激な?(?=[\s　「」、。・]|$)/g,          "インパクトのある"],
    [/ハードすぎ/g,                             "エッジが強め"],
    [/ハードな?雰囲気/g,                        "エッジの効いた雰囲気"],
    [/危険な?雰囲気/g,                          "緊張感のある雰囲気"],
    [/危険な?(?=イメージ|演出|要素|感)/g,      "緊張感のある"],
    [/不穏な?雰囲気/g,                          "神秘的な雰囲気"],
    [/攻撃的な?/g,                              "アクティブな"],
    [/支配的な?/g,                              "威厳のある"],
    [/凶悪な?/g,                                "個性的な"],

    // ── 武器・暴力系語句 ────────────────────────────────────────────────────
    [/刀を(?:振りかざす|構える|抜く|持つ|右手|左手)/g, "発光する小道具を持つ"],
    [/刀(?=を|が|の|、|。|\s|$)/g,             "発光する小道具"],
    [/ブレード(?:武器)?/g,                      "光るオブジェクト"],
    [/銃を(?:構える|持つ|右手|左手)/g,         "スタイリッシュなアクセサリーを持つ"],
    [/銃(?=を|が|の|、|。|\s|$)/g,             "スタイリッシュな小道具"],
    [/武器を持[つちっ]/g,                       "光る小道具を持つ"],
    [/武器(?=、|を|が|の|類|系)/g,             "発光するアクセサリー"],
    [/戦闘感/g,                                 "ダイナミックな存在感"],
    [/戦闘的な?/g,                              "アクティブな"],
    [/戦闘シーン/g,                             "ダイナミックなシーン"],
    [/拘束感/g,                                 "バインドデザイン感"],
    [/拘束(?!感)/g,                             "バインドデザイン"],

    // ── 暴力・不穏語 ────────────────────────────────────────────────────────
    [/流血/g,                                   "赤いエフェクト"],
    [/傷跡/g,                                   "装飾ライン"],
    [/傷(?=が|を|つ|ん|った|ついた)/g,          "装飾"],
    [/血(?:のような|っぽい)/g,                  "深みのある赤のような"],
    [/血(?=が|を|の|塗|しぶき)/g,              "赤いエフェクト"],

    // ── 追加：実写人物・年齢関連リスク語 ────────────────────────────────────
    // Gemini の PROHIBITED_CONTENT を引きやすい語を事前置換
    [/リアルな女性/g,                          "AI生成の架空キャラクター"],
    [/リアル(?:系|風)?な?(?=衣装|ファッション)/g, "ファッション誌風な"],
    [/生々しい/g,                              "ドラマチックな"],
    [/官能的な?/g,                             "印象的な"],
    [/セクシーな?/g,                           "スタイリッシュな"],
    [/扇情的な?/g,                             "インパクトのある"],
    [/魅惑的な?/g,                             "印象的な"],
    [/色気のある/g,                            "存在感のある"],
    [/艶めかし/g,                              "美しく"],
    [/なまめかし/g,                            "魅力的に"],
    [/水着(?:姿|風|系|コスチューム|モデル)?/g, "リゾートカジュアルウェア"],
    [/ビキニ(?:姿|風|スタイル)?/g,            "サマーリゾートウェア"],
    [/下着(?:姿|露出|見え)?/g,               "レイヤードファッション"],
    [/透けてい|透けた(?=衣装|素材|トップス|シャツ)/g, "シアー素材の"],
    [/肌の露出(?:が)?多/g,                    "開放感のある"],
    [/露出(?:が)?多め/g,                      "スタイリッシュな"],
    [/脚を見せ/g,                             "ボトムスのデザインを活かし"],
    [/胸(?:元)?を露出/g,                      "デコルテラインのデザインを強調"],
  ];

  let out = text;
  for (const [pat, rep] of rules) {
    out = applyRule(out, pat, rep);
  }

  // ─── 文脈チェック（近接語による判定） ──────────────────────────────────────
  // 複数の危険語が近くに並ぶ場合、文脈全体をまとめて安全な表現に置換する

  // ケース①：レザー + ハード + 手袋 → モードなレザーファッション手袋
  if (/レザー/.test(out) && /ハード/.test(out) && /手袋/.test(out)) {
    out = out.replace(
      /(?:レザー.{0,30}?ハード|ハード.{0,30}?レザー).{0,30}?手袋/g,
      (m) => {
        const rep = "モードなレザーファッション手袋";
        log.push({ detected: m + " (文脈: レザー+ハード+手袋)", replaced: rep });
        return rep;
      },
    );
  }

  // ケース②：衣装 + 脚/足/太もも + 強調 → 衣装のシルエットを際立たせる
  out = out.replace(
    /衣装.{0,50}?(?:脚|足|太もも).{0,30}?強調/g,
    (m) => {
      const rep = "衣装のシルエットを際立たせる";
      log.push({ detected: m + " (文脈: 衣装+脚+強調)", replaced: rep });
      return rep;
    },
  );

  // ケース③：赤/ダーク + 血/傷 → 深みのある赤エフェクト
  if (/(?:赤|ダーク)/.test(out) && /(?:血|傷)/.test(out)) {
    out = out.replace(/(?:血|傷)(?=.*?(?:赤|ダーク))|(?:赤|ダーク)(?=.*?(?:血|傷))/g, (m) => {
      if (/血|傷/.test(m)) {
        const rep = "深みのある赤エフェクト";
        log.push({ detected: m + " (文脈: 赤/ダーク+血/傷)", replaced: rep });
        return rep;
      }
      return m;
    });
  }

  // ─── デバッグ出力（サーバーコンソールのみ・UIには表示しない） ────────────
  if (debug && log.length > 0) {
    console.log("[SafetySanitize] 置換ログ ──────────────────");
    for (const entry of log) {
      console.log(`  検出：「${entry.detected}」→ 置換：「${entry.replaced}」`);
    }
    console.log("──────────────────────────────────────────────");
  }

  return out;
}

/**
 * Nano Banana 専用後処理。
 * LLM が出力したプロンプト内の「実在人物」関連語を「架空キャラクター」表現へ置換する。
 * safetySanitizePrompt() 適用後に重ねて適用する。
 *
 * （安全制限の回避ではなく、AIで生成された架空キャラクター画像の正確な記述のための整備）
 */
export function nanoSanitizePrompt(
  text: string,
  debug = process.env.NODE_ENV !== "production",
): string {
  const log: Array<{ detected: string; replaced: string }> = [];

  function applyRule(input: string, pat: RegExp, rep: string): string {
    return input.replace(pat, (match) => {
      log.push({ detected: match, replaced: rep });
      return rep;
    });
  }

  let out = text;

  // ── 長いフレーズを先に処理し、短い語は後でキャッチする ──────────────────
  const rules: Array<[RegExp, string]> = [
    [/人物の同一性は完全に維持/g,                      "架空キャラクターの視覚的一貫性を維持"],
    [/人物の視覚的一貫性/g,                            "キャラクターの視覚的一貫性"],
    [/人物の同一性/g,                                  "キャラクターの視覚的一貫性"],
    [/写真の人物/g,                                    "参照画像のキャラクター"],
    [/元の人(?=物|の|を|が|に|は|も|で|、|。|\s|$)/g,  "参照画像のキャラクター"],
    [/本人確認/g,                                      "キャラクターデザインの確認"],
    [/本人らしさ/g,                                    "キャラクターデザインの一貫性"],
    [/ポートレート写真/g,                              "キャラクターデザイン"],
    [/実在人物/g,                                      "AI生成の架空キャラクター"],
    [/この人物/g,                                      "この架空キャラクター"],
    [/人物の画像/g,                                    "架空キャラクターの画像"],
    [/顔を維持/g,                                      "キャラクターの視覚的一貫性を維持"],
    [/本人(?=の|が|を|と|に|は|も|で|、|。|\s|$)/g,    "架空キャラクター"],
  ];

  for (const [pat, rep] of rules) {
    out = applyRule(out, pat, rep);
  }

  if (debug && log.length > 0) {
    console.log("[NanoSanitize] 置換ログ ──────────────────");
    for (const entry of log) {
      console.log(`  検出：「${entry.detected}」→ 置換：「${entry.replaced}」`);
    }
    console.log("──────────────────────────────────────────────");
  }

  return out;
}

// ── 時代軸ブロック ───────────────────────────────────────────────────────────────
/**
 * eraBlock — 時代軸の指示を生成する。
 * "auto" はランダム選択指示、各固有値は具体的な時代的特徴を注入する。
 */
function eraBlock(era: Era | null | undefined): string {
  if (!era) return "";
  const ERA_PROMPTS: Record<Era, string> = {
    auto:
      "【時代軸】時代設定は画像のシーンに自然に合わせる。各案で異なる時代感を選択し、視覚的多様性を出す。",
    primitive:
      "【時代軸】原始時代・石器時代の視覚言語。洞窟・焚き火・毛皮・骨の装飾・荒削りな石造り。人工物は最小限。",
    ancient:
      "【時代軸】古代文明の遺跡と装飾。巨石・石柱・象形文字・石造建築・砂色と大地色のパレット。",
    egypt:
      "【時代軸】古代エジプトの視覚言語。砂岩の神殿・ヒエログリフ・ラピスラズリとゴールド・ファラオ装束・スカラベ・日輪の意匠。",
    greek:
      "【時代軸】古代ギリシャの白大理石神殿・列柱廊・月桂樹冠・白いトーガ・波型フリーズ装飾・エーゲ海ブルー。",
    roman:
      "【時代軸】古代ローマ。コロッセウム・石畳・赤い軍旗・ローマ衣装（トーガ・ロリカ）・モザイクタイル・大浴場アーキテクチャ。",
    heian:
      "【時代軸】平安時代の王朝美。十二単・御簾・几帳・蒔絵・月明かりの廊下・牛車・秋草紋様・墨絵的な奥行き。",
    sengoku:
      "【時代軸】戦国時代の張り詰めた空気。甲冑・兜・城郭石垣・戦旗・白煙と炎・落城の廃墟・血と鉄の質感。",
    edo:
      "【時代軸】江戸時代の浮世絵的美意識。提灯・暖簾・木造長屋・和服文様・墨と朱の色調・版画的な構図。",
    meiji:
      "【時代軸】明治の文明開化。洋館・レンガ建築・ガス灯・和洋折衷の室内・懐中時計・洋傘・白黒写真的ノスタルジア。",
    taisho:
      "【時代軸】大正ロマン。アールデコ調の建築・矢絣の着物とブーツ・活版印刷ポスター・書生・ハイカラ・和洋融合の装飾。",
    showa:
      "【時代軸】昭和レトロ。ホーロー看板・昭和家電・団地・銭湯・ブリキのおもちゃ・フィルム写真の粒状感・赤と黄のネオン。",
    "90s":
      "【時代軸】1990年代の視覚文化。グランジ・VHS的粒状感・フィルム写真風・原色のスポーツウェア・バブル崩壊後の退廃美。",
    y2k:
      "【時代軸】Y2Kエステティック。メタリックシルバー・半透明プラスチック・デジタルフォント・ホログラフィックシール・千禧年の輝き。ただし過度な青・紫は避ける。",
    modern:
      "【時代軸】現代（2020年代）。スマートフォン時代の素材感・現代的な都市景観・現在進行形のファッション・今のリアル。",
    near_future:
      "【時代軸】近未来（2030〜2060年代）。AR/VRの痕跡・電動モビリティ・素材の軽量化・テクノロジーと自然の融合・スリークなミニマルデザイン。",
    y3k:
      "【時代軸】Y3K・西暦3000年の超未来都市。壮大な有機建築・異文明的エネルギー構造体。【重要】青・紫だけに偏らず、アンバー・ゴールド・エメラルド・シルバーなど多彩な色調を積極活用すること。",
    far_future:
      "【時代軸】超未来（数万〜数十万年後）。既知の文明形態を超えた異星的構造物・有機テクノロジーの融合・地球的文脈を超えた奇異な美。",
    apocalypse:
      "【時代軸】終末後の世界。廃墟・錆・荒廃した自然の侵食・生存者の痕跡・静寂と崩壊の美・くすんだ土埃色のパレット。",
  };
  return ERA_PROMPTS[era] ?? "";
}

// ── 絵柄スタイルブロック ──────────────────────────────────────────────────────

/**
 * artStyleBlock — 絵柄スタイルの指示を生成する。
 * "auto" はランダム選択指示、各固有値は描画スタイルの具体的な指示を注入する。
 */
function artStyleBlock(artStyle: ArtStyle | null | undefined): string {
  if (!artStyle) return "";
  const ART_STYLE_PROMPTS: Record<ArtStyle, string> = {
    auto:
      "【絵柄】各案で異なるアート表現スタイルを積極的に選択し、視覚的な多様性を出す。",
    photo:
      "【絵柄】フォトリアル写真風。カメラで撮影したかのような自然な質感・光の描写・リアルな被写界深度を維持する。",
    illustration:
      "【絵柄】商業デジタルイラスト風。鮮やかな色彩・滑らかなグラデーション・プロフェッショナルなイラストの仕上がり。",
    anime:
      "【絵柄】日本アニメ調。セルシェーディング・明確な輪郭線・大きな瞳・鮮やかな色彩。TVアニメ的な表現を採用する。",
    watercolor:
      "【絵柄】水彩画風。滲み・にじみ表現・柔らかい色の混ざり合い・紙のテクスチャ感・透明感のある水彩絵の具の質感。",
    oil_painting:
      "【絵柄】油絵風。絵の具の重厚な質感・厚塗り・深みのある色彩・筆触の存在感・古典絵画的な雰囲気。",
    sketch:
      "【絵柄】スケッチ・鉛筆画風。鉛筆や炭素の質感・ハッチングとクロスハッチング・素描的な線の味わい・モノトーンまたは淡い着色。",
    line_art:
      "【絵柄】線画スタイル。明確な輪郭線主体・ミニマルな塗り・ペン画的な精密さ・シャープで美しいラインの表現。",
    "3d_render":
      "【絵柄】3DCGレンダリング風。立体的なモデリング感・物理的に正確な光と影・リアルな素材表現・CGアート的な質感。",
    concept_art:
      "【絵柄】コンセプトアート風。映画・ゲーム制作用のプロフェッショナルなコンセプトアート調・ダイナミックな構図・物語性のある演出。",
    manga:
      "【絵柄】白黒漫画風。スクリーントーン・効果線・白黒の対比・日本漫画的な表現・コマ割りを想起させるダイナミックな構図。",
    game_art:
      "【絵柄】ゲームアート風。ゲーム用キャラクターデザイン的な明確な輪郭・鮮やかな色彩・モバイル/コンシューマゲームのアートスタイル。",
    pixel:
      "【絵柄】ドット絵・ピクセルアート。低解像度のドット表現・レトロゲーム的な質感・ピクセル単位の精密なアート表現。",
    flat_design:
      "【絵柄】フラットデザイン風。陰影を極力排除した色面構成・シンプルでモダンなグラフィック・ベクターアート的な仕上がり。",
    ghibli_style:
      "【絵柄】スタジオジブリ風アニメーション。温かみある手描きアニメ調・柔らかい光と自然の描写・細部まで丁寧な背景描写・ジブリ独特の穏やかな色調。",
  };
  return ART_STYLE_PROMPTS[artStyle] ?? "";
}

// ── 色戦略ブロック ────────────────────────────────────────────────────────────

/** 色戦略のうち肯定系（色を指定・誘導する）をプロンプト指示として返す。 */
function colorStrategyPositiveBlock(cs: ColorStrategy | null | undefined): string {
  if (!cs) return "";
  const POSITIVE_PROMPTS: Partial<Record<ColorStrategy, string>> = {
    auto:
      "【色戦略】各案ごとに異なる配色アプローチを採用し、色彩的多様性を最大化する。",
    red_only:
      "【色戦略】深紅・赤・朱・緋色の階調のみで配色する。他の色相は最小限に抑え、赤の濃淡・明暗でバリエーションを作る。",
    warm:
      "【色戦略】暖色系（赤・オレンジ・黄・茶・アンバー）を主調色にする。青・紫・寒色系は排除またはアクセント最小限。",
    cool_tone:
      "【色戦略】寒色系（青・水色・白・グレー）を主調色にする。赤・オレンジ・暖色系は排除またはアクセント最小限。",
    complement:
      "【色戦略】補色対比を積極活用する。メインカラーとその正反対の補色を対比させ、強烈なビジュアルインパクトを作る。",
    mono:
      "【色戦略】完全モノクロームで統一。白・黒・グレーのグラデーションのみ。色相を持つ色は一切使わない。",
    pastel:
      "【色戦略】全体をパステルカラーで統一。淡く柔らかな彩度の低い色調のみ。高彩度・鮮やかすぎる色は避ける。",
    vivid:
      "【色戦略】高彩度・高鮮度の鮮やかな色彩で統一。くすみ・淡い色は使わず、力強く明快な発色を徹底する。",
    muted:
      "【色戦略】低彩度・くすんだトーンで統一。モーヴ・ダスティローズ・セージグリーン・スモーキーブルーなど穏やかな色調のみ。",
    white_base:
      "【色戦略】白を基調とした配色。白・オフホワイト・クリームを主体とし、差し色は控えめに最小限。明度の高い淡い画面を作る。",
    black_base:
      "【色戦略】黒を基調とした配色。黒・ディープグレー・ダークカラーを主体とし、明るい要素はアクセント程度に抑える。",
    no_color:
      "【色戦略】画面から色（色相）を完全に排除する。白・黒・グレーのみ使用。彩度のある色はプロンプト・出力に含めない。",
  };
  return POSITIVE_PROMPTS[cs] ?? "";
}

/**
 * 色戦略のうち否定系（NG 追加）を ngList に付加する文字列を返す。
 * 呼び出し元で既存 ngList と連結して使用する。
 */
function colorStrategyNgAddon(cs: ColorStrategy | null | undefined): string {
  if (!cs) return "";
  const NG_ADDONS: Partial<Record<ColorStrategy, string>> = {
    no_blue:
      "blue, cyan, azure, cobalt, sky blue, sapphire, navy, teal（青・水色・ターコイズ系を除外）",
    no_purple:
      "purple, violet, lavender, lilac, mauve, indigo（紫・ラベンダー系を除外）",
    no_pink:
      "pink, rose, magenta, hot pink, blush, fuchsia（ピンク・マゼンタ系を除外）",
    no_transparent:
      "transparent fabric, see-through material, PVC, sheer fabric, translucent clothing, transparent dress（透明素材・シースルー衣装を除外）",
  };
  return NG_ADDONS[cs] ?? "";
}

export function buildSystemPrompt(
  req: GenerateRequest,
  plan?: BatchPlan,
  subStylePlan?: SubStylePlan,
): string {
  // 安全モード（省略時 = "full" = 従来動作）
  const pt: PromptTarget = req.promptTarget ?? "full";

  const scopeList = req.scopes.map((s) => SCOPE_JA[s]).join("・");

  // 固定ムード（ユーザーが具体的に選択）
  const fixedMoodLine = req.moods.length
    ? req.moods.map((m) => MOOD_JA[m]).join(" / ")
    : "";

  // おまかせカテゴリ（案ごとにAIが自由に選ぶ）
  const autoCats = req.autoMoodCategories ?? [];
  const autoMoodBlock = autoCats.length > 0
    ? [
        "【雰囲気おまかせカテゴリ】以下のカテゴリは案ごとにAIが自由に選んでよい（各案で異なる選択を推奨）：",
        ...autoCats.map((cat) => {
          const opts = MOOD_GROUPS_SERVER[cat];
          return opts
            ? `  - ${cat}：${opts.join("・")}のいずれか（または近い質感）`
            : `  - ${cat}：AIが自由に選ぶ`;
        }),
      ].join("\n")
    : "";

  // 固定ムードもおまかせも何もなければ「中庸トーン」
  const moodLine = fixedMoodLine || (autoCats.length === 0 ? "中庸トーン" : "（固定雰囲気なし）");

  const detailLines = describeDetails(req.scopes, safeDetails(req.details ?? {}), pt, subStylePlan);
  const lockLine = lockLineJa(req.locks, req.scopes, pt);
  const safety = safetyJa(req);
  const extra = req.extraInstructions.trim();

  // 色戦略の NG 追加分を既存 ngList にマージ
  const csNgAddon = colorStrategyNgAddon(req.colorStrategy);
  const baseNg = req.ngList.trim();
  const effectiveNg = csNgAddon
    ? (baseNg ? `${baseNg}\n${csNgAddon}` : csNgAddon)
    : baseNg;
  const ngTrim = effectiveNg;

  const variationRule =
    `各案は明確に異なる方向性で作ること。系統・色・素材・形・場所・効果など、可能な軸で差別化し、` +
    `「ほぼ同じ案を言い換えただけ」のような重複は絶対に避ける。`;

  const propsRule = req.scopes.includes("props")
    ? [
        "",
        "【持ち物・小物 追加ルール】",
        "- 各案で必ず異なるアイテムを選ぶこと（カテゴリも可能な限り変える。例：案1=刀、案2=透明傘、案3=発光スマホ、案4=狐面、案5=巨大リボン、案6=ホログラム端末 のように方向性を散らす）。",
        "- アイテム名・配置場所・持たせ方・元画像との馴染ませ方を必ず具体的に書く。",
        "- 手で持たせる場合、手指の本数・握り方・手首/関節の角度・接触影・重さの表現を自然に整える指示を入れる。",
        "- 元画像と自然に馴染ませる（光源・色温度・接触影・反射の整合）。",
      ].join("\n")
    : "";

  // ── フォーマット用の pt 依存テキスト ──────────────────────────────────────
  const fixedSectionSpec = pt === "full"
    ? "- 【固定】変更しない要素を 1 行で列挙（顔・髪・衣装・背景・ポーズ・カメラ・アスペクト比のうち変更範囲外のもの＋顔ロック等）。"
    : pt === "nano_safe"
    ? "- 【固定】変更しない要素を 1 行で列挙。「体型」「完全維持」「再生成しない」「人物」「本人」は使わず「外観スタイル」「視覚的一貫性」「架空キャラクター」を使う。"
    : "- 【固定】変更しない要素を 1 行で列挙。「体型」「完全維持」「再生成しない」は使わず「外観スタイル」「一貫性を保つ」「視覚的特徴を維持」を使う。";

  // nano_safe 用：【前提】セクション仕様と出力例
  const premiseSectionSpec = pt === "nano_safe"
    ? "- 【前提】「参照画像は実在人物ではなく、AIで生成された架空のキャラクターイラストです」で始め、画像編集として何を変更するかを 1〜2 行で宣言。"
    : "- 【前提】被写体の AI 架空 or 実在 性質と、画像編集として何を変更するかを 1〜2 行で宣言。";

  // 変更対象の表示用ラベル（読点区切り）を例文に埋め込む。例の中で勝手に背景や他軸を追加させない。
  const scopeListForExample = req.scopes.length > 0
    ? req.scopes.map((s) => SCOPE_JA[s]).join("、")
    : "（変更対象は【今回の変更対象】に指定された軸）";

  const premiseExample = pt === "nano_safe"
    ? `【前提】参照画像は実在人物ではなく、AIで生成された架空のキャラクターイラストです。この架空キャラクターのデザインを基準に、${scopeListForExample}のみ変更してください。`
    : `【前提】この画像はAIで生成された架空キャラクター。画像編集として${scopeListForExample}のみ変更してください。`;

  const lengthGuide = pt === "nano_safe"
    ? "- 1 案あたり全体で 7〜10 行程度の軽量な長さに収める（Nano Banana 向け）。"
    : "- 1 案あたり全体で 9〜15 行程度の中程度の長さに収める。短すぎず、冗長すぎず。";

  const langNote = pt === "nano_safe"
    ? "- 衣装は英語のシンプルな表現でよい（例: dark cyber outfit, elegant dress, gothic fashion）。その他は日本語で記述。"
    : "- 日本語のみ。英語は禁止（固有名詞・解剖学略語を除く）。";

  const fixedExampleLine = pt === "full"
    ? "【固定】顔・髪型・体型・表情・人物の同一性・ポーズ・カメラ・アスペクト比は完全維持。"
    : pt === "nano_safe"
    ? "【固定】架空キャラクターの顔の特徴・髪型・外観スタイル・視覚的一貫性・ポーズ・カメラ・アスペクト比は維持。"
    : "【固定】顔の特徴・髪型・外観スタイル・表情・キャラクターの視覚的一貫性・ポーズ・カメラ・アスペクト比は維持。";

  // safe モードでは「顔・体型・表情・人物の同一性」の言い回しを中立化
  // nano_safe はさらに「架空キャラクター」明記で実在人物誤判定を防ぐ
  const principleFixedLine = pt === "full"
    ? "【固定原則】変更対象に含まれない要素（顔・体型・表情・人物の同一性・髪・衣装・背景・ポーズ・カメラ・アスペクト比のうち変更範囲に入っていないもの）は完全に維持し、変更を指示しない。"
    : pt === "nano_safe"
    ? "【固定原則】変更対象に含まれない要素（架空キャラクターの顔の特徴・外観スタイル・視覚的一貫性・髪・衣装・背景・ポーズ・カメラ・アスペクト比のうち変更範囲外のもの）は一貫性を保ち、変更を指示しない。参照画像はAI生成の架空キャラクター（実在人物ではない）。"
    : "【固定原則】変更対象に含まれない要素（顔の特徴・外観スタイル・表情・人物の視覚的一貫性・髪・衣装・背景・ポーズ・カメラ・アスペクト比のうち変更範囲外のもの）は一貫性を保ち、変更を指示しない。";

  /**
   * 統一フォーマット仕様（Gemini / Nano Banana / ChatGPT Image 共通）。
   * 各案は本フォーマットを厳格に守り、セクション見出し【XXX】を行頭に書く。
   */
  const unifiedFormat = [
    "【統一プロンプト出力フォーマット】",
    "Gemini / Nano Banana / ChatGPT Image どれにそのまま貼っても使えるように、以下の項目構造で各案を出力する。",
    "",
    "■ 必須セクション（順番厳守、各見出しを行頭に書く）：",
    premiseSectionSpec,
    fixedSectionSpec,
    "- 【変更】具体的な変更内容。素材・色・形・場所・アングル・小物名など具体語で 2〜4 行。",
    "- 【雰囲気】mood の質感・トーン・色味を 1〜2 行。",
    "- 【光】光源方向・色温度・影・反射・空気感を 1〜2 行（lighting scope 未選択でも、変更内容と整合する光の説明を入れる）。",
    "- 【品質】高解像度／物理的に正しい影と反射／違和感のない合成感／空気遠近法 等を 1 行。",
    "- 【人体補正】手・指（片手5本）・手首・肘・脚・膝・足首・接地感の解剖学的補正を 1 行（日英混在可）。★省略禁止★",
    ngTrim ? "- 【NG】NG 指定があるため、末尾に必ず明記する。" : "- 【NG】NG 指定がない場合は省略する。",
    "",
    "■ スタイル要件：",
    langNote,
    lengthGuide,
    "- 各セクションは【見出し】の直後に改行し、内容を続ける。",
    "- 説明文・前置き・あいさつは禁止。完成プロンプト本文のみ。",
    "- コードブロック記号、案番号、Markdown 装飾は使わない（プレーンテキスト＋【見出し】のみ）。",
    "",
    "■ 区切りルール（最重要・絶対遵守）：",
    "- 各案の本文は必ず【前提】から始める。",
    "- 案と案の間には、半角ハイフンのみの行 `---案区切り---` を 1 行だけ入れて区切る。",
    "- 1 案の途中に区切り行を入れない。区切り行の前後に空行を入れてよい。",
    "- 案番号（「案1」「Proposal 2」など）や Markdown 見出し（##）は出力しない。",
    `- 案数：${req.count}案ちょうど。1 案多くても少なくてもダメ。`,
    "",
    "■ 出力例（イメージ。実際の内容は今回の指示に合わせて生成すること）：",
    "※ 下記の出力例の【前提】【変更】には、必ず【今回の変更対象】に列挙された軸のみを使うこと。",
    "※ 例の中の軸を真似て、変更対象に入っていない軸（例：背景）を勝手に追加してはならない。",
    premiseExample,
    fixedExampleLine,
    // 【変更】の例は固定文ではなく書き方ガイドにする（軸名のハードコードでバイアスをかけない）
    `【変更】${scopeListForExample}を 1〜2 文で具体的に記述（変更対象に入っていない軸は記述しない）。`,
    "【雰囲気】クールで都市的、サイバーパンク寄り。",
    "【光】青緑ネオンの主光源を斜め上から、リム発光で輪郭を縁取る。",
    "【品質】高解像度、物理的に正しい影と反射、違和感のない合成感。",
    "【人体補正】手は片手5本指・自然な関節・手首肘なめらか。脚・膝・足首・接地感を物理的に整合。Anatomically correct hands, fingers, joints, grounding.",
    "---案区切り---",
    "【前提】... （案2 ここから）",
    "【固定】...",
    "（以下同様）",
  ].join("\n");

  // ── 安全度スコア：リスクが高い組み合わせを検出して追加ガードを投入 ────────────
  const hasManyScopes  = req.scopes.length >= 4;
  const isHighRealism  = (req.realismLevel ?? 3) >= 4;
  const hasViralOrGoth = req.viralMode ||
    (req.moods ?? []).some((m) => ["gothic", "dark", "glitch", "emo"].includes(m));
  const needExtraGuard = hasManyScopes || isHighRealism || hasViralOrGoth;

  // 追加安全宣言（リスク組み合わせ時のみ挿入）
  const extraSafetyNote = needExtraGuard ? [
    "【安全生成モード（追加）】",
    "・ 参照画像の人物はAI生成の架空キャラクター（成人設定）であり、実在人物ではありません。",
    "・ 生成するプロンプト本文は、全年齢対象の商業ファッション広告・アート写真・ファッション誌の水準に留めること。",
    "・ 衣装は「カジュアルな夏服」「ファッションショー」レベルまでとし、それ以上は踏み込まない。",
    "・ ポーズ・表情・衣装のいずれも、上品でファッショナブルな印象にまとめる。",
    "・ ゴシック・ダーク系であっても、ゴシックファッション雑誌レベルの上品な表現に留める。",
    "・ リアル度が高い場合でも「AIで制作された架空のファッション写真」という文脈を保つ。",
  ].join("\n") : "";

  return [
    "あなたは画像編集AI向けの統一プロンプトを生成するアシスタントです。",
    "タスクは『既存のAI生成キャラクター画像を編集するためのプロンプトテキストを作ること』であり、実際に画像を生成・編集したり、有害なコンテンツを生成したりするものではありません。",
    "出力はすべてテキストのみです。入力画像はプロンプトの参考にするためだけに使用します。",
    "参照画像はAIで生成された架空のキャラクターイラストであり、実在の人物・未成年者とは無関係です。",
    needExtraGuard ? extraSafetyNote : "",
    "",
    "アップロードされた画像があれば内容を解析し（被写体の特徴・色・構図・雰囲気）、それに基づいた具体的なプロンプトを作る。",
    "",
    `【今回の変更対象】${scopeList}`,
    // 出力に紛れ込む「軸の自動拡張」を強く禁止する厳守ルール。
    "【厳守ルール】出力プロンプトの【前提】行・【変更】行・本文中いずれも、上記【今回の変更対象】に列挙された軸『のみ』を変更対象として記述する。",
    "  ・ 列挙されていない軸（例：背景・髪・ポーズ・衣装・カメラなど）を1語でも追加してはならない。",
    "  ・ 例文や雛形に含まれていても、変更対象外の軸は出力から省く。",
    "  ・ 雰囲気・光・構図の描写でも、変更対象外の軸の見た目を変える文言を入れない（例：髪が変更対象でなければ髪の色や流れを記述しない）。",
    principleFixedLine,
    lockLine ? `【追加固定】${lockLine}` : "",
    `【安全前提】${safety}`,
    pt === "nano_safe" ? "\n" + nanoCharacterBlock() : "",
    "",
    `【雰囲気】${moodLine}`,
    autoMoodBlock || "",
    // 時代軸ブロック（設定なし = null/undefined の場合は挿入しない）
    (() => { const b = eraBlock(req.era); return b ? "\n" + b : ""; })(),
    // 色戦略ブロック（肯定系のみ。否定系は NG ブロックに追加済み）
    (() => { const b = colorStrategyPositiveBlock(req.colorStrategy); return b ? "\n" + b : ""; })(),
    // 絵柄スタイルブロック（設定なし = null/undefined の場合は挿入しない）
    (() => { const b = artStyleBlock(req.artStyle); return b ? "\n" + b : ""; })(),
    // マンネリ回避エンジン（ジャンル抽選・意外性・頻出ペナルティ・背景依存低減・最終チェック）
    (() => { const b = plan ? varietyBlock(plan, req) : ""; return b ? "\n" + b : ""; })(),
    "\n" + userStyleBlock(),
    // 異常な組み合わせ奨励：常時挿入（量産回避と対）
    "\n" + weirdCombinationBlock(),
    (() => { const b = bgDiversityBlock(req); return b ? "\n" + b : ""; })(),
    // 量産構図回避：UIトグルに従う（デフォルトON。省略時も true 扱い）。
    // ※「量産AI検知（Gemini採点）」は別物で gemini.ts 側で常時実行している。
    (req.avoidCliche !== false) ? "\n" + avoidClicheBlock() : "",
    // 衣装生成ガイド：outfit スコープ選択時は必須挿入
    req.scopes.includes("outfit") ? "\n" + outfitDiversityBlock() : "",
    // 衣装サブジャンル展開：大カテゴリ名は出さず案ごとにサブジャンルへ展開
    subStylePlan ? "\n" + subStyleBlock(subStylePlan) : "",
    // ZOZOトレンド：衣装ON時のみ、現在のリアルなファッション傾向を反映
    (() => { const b = zozoTrendBlock(req); return b ? "\n" + b : ""; })(),
    // 色彩多様性ルール：常時挿入（mono/no_color 戦略選択時のみ除外）
    "\n" + colorDiversityBlock(req),
    // お気に入り学習：traits があれば反映（コピー禁止・変更範囲内・固定優先）
    (() => { const b = favoriteProfileBlock(req.favoriteTraits, req.favoriteStrength); return b ? "\n" + b : ""; })(),
    // 神引き補助モディファイア（被り回避・別世界・バズ寄せ・顔映え）
    (() => { const b = boostBlock(req); return b ? "\n" + b : ""; })(),
    // 風の強さ（髪/衣装/前景演出/ポーズ/カメラ のいずれかON時のみ）
    (() => { const b = windBlock(req); return b ? "\n" + b : ""; })(),
    // 重複制御（頻出モチーフの出現制御レベル）
    (() => { const b = motifControlBlock(req, pt); return b ? "\n" + b : ""; })(),
    // 頻出構成（組み合わせ）制御
    (() => { const b = comboControlBlock(req, pt); return b ? "\n" + b : ""; })(),
    // 色ポリシー（restrict / block）— 旧式の全軸色制御（互換）
    (() => { const b = colorControlBlock(req, pt); return b ? "\n" + b : ""; })(),
    // 色×軸 重み制御（新式・軸別 0-5）— 髪/服/背景を独立に制御
    (() => { const b = colorWeightBlock(req, pt); return b ? "\n" + b : ""; })(),
    // 画像分析バイアス — 生成結果画像のクラスタリングから得た偏り情報
    (() => { const b = imageBiasBlock(req, pt); return b ? "\n" + b : ""; })(),
    // AI 好みプロファイル（実 Gemini 分析）— 最優先度の好み反映
    (() => { const b = preferenceProfileBlock(req, pt); return b ? "\n" + b : ""; })(),
    // ユーザー画像評価バイアス — 👍/👎 から導いた方向性ヒント
    (() => { const b = ratingBiasBlock(req, pt); return b ? "\n" + b : ""; })(),
    // 質感・リアル度 — 人物と背景の質感統一（背景だけリアルすぎる問題の防止）
    (() => { const b = realismBlock(req, pt); return b ? "\n" + b : ""; })(),
    detailLines ? `\n【詳細設定】\n${detailLines}` : "",
    extra ? `\n【ユーザー追加指示】${extra}` : "",
    "",
    `【バリエーション要件】${variationRule}`,
    propsRule,
    // 持ち物哲学：props スコープ選択時に追加で挿入
    req.scopes.includes("props") ? "\n" + propsPhilosophyBlock() : "",
    // ポーズダイナミクス：pose スコープ選択時に挿入
    req.scopes.includes("pose") ? "\n" + poseDynamicsBlock() : "",
    // カメラ攻撃性：camera スコープ選択時に挿入
    req.scopes.includes("camera") ? "\n" + cameraAggressionBlock() : "",
    // 顔ロック（デフォルトON）または表情変更モード（解除時）
    req.faceLock !== false
      ? "\n" + faceLockBlock(pt)
      : "\n" + expressionUnlockBlock(req.expression ?? null, pt),
    req.viralMode ? "\n" + viralBlock(pt) : "",
    req.strength && req.strength !== 3 ? "\n" + strengthBlock(req.strength) : "",
    (() => { const t = textureBlock(req); return t ? "\n" + t : ""; })(),
    ngBlock(effectiveNg) ? "\n" + ngBlock(effectiveNg) : "",
    // ★ 安全フィルタブロック（safe モード時のみ挿入）
    pt !== "full" ? "\n" + sanitizerBlock(pt) : "",
    // ★ 出力プロンプト安全ガイド（全モード共通・常時挿入）
    "\n" + safetyOutputGuideBlock(),
    // ★ 手足補正ルールは常時挿入。条件なし。省略・無効化不可。
    "\n" + bodyFixBlock(),
    "",
    unifiedFormat,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

export function buildUserPrompt(req: GenerateRequest): string {
  if (req.imageDataUrl) {
    return "添付画像を解析し、上記の制約に厳密に従って指定数の編集プロンプトを生成してください。";
  }
  return "画像は添付されていません。上記の制約に厳密に従って指定数の編集プロンプトを生成してください。";
}
