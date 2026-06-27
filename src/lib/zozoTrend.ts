/**
 * ZOZOトレンド — 女性ファッションの「現在のトレンド傾向」を衣装プロンプトに取り込む補助。
 *
 * 重要：ブランド名・商品名は扱わない。あくまで
 *   服の種類 / 色 / 素材 / シルエット / 季節感 / 系統 / 年代傾向 / 組み合わせ
 * という「抽象的な傾向」だけを抽出・生成する。
 *
 * 2方式：
 *  1) 自動モード … 内蔵トレンドライブラリから年代・カテゴリに応じてランダム抽出（毎回違う組み合わせ）
 *  2) 手動貼り付け … ZOZOランキング画面や商品名を貼ると、既知のトレンド属性だけを抽出
 *     （辞書に無いブランド名・固有名詞は自動的に無視されるため安全）
 */

// ── 型 ───────────────────────────────────────────────────────────────────────

export type ZozoAge =
  | "any" | "teens" | "twenties" | "thirties" | "teens_twenties" | "twenties_thirties";

export type ZozoCategory =
  | "auto" | "tops" | "outer" | "pants" | "skirt" | "onepiece"
  | "shoes" | "bag" | "accessory" | "full";

/** 反映モード：OFF=未反映 / assist=補助反映 / priority=優先反映（衣装方針の主軸） */
export type ZozoMode = "assist" | "priority";

export interface ZozoTrend {
  ageLabel: string;
  categoryLabel: string;
  /** 抽出されたトレンド属性フレーズ（ブランド名は含まない） */
  traits: string[];
  /** 反映モード（未指定は assist 扱い） */
  mode?: ZozoMode;
}

export const ZOZO_AGE_OPTIONS: { value: ZozoAge; label: string }[] = [
  { value: "any",               label: "指定なし" },
  { value: "teens",             label: "10代" },
  { value: "twenties",          label: "20代" },
  { value: "thirties",          label: "30代" },
  { value: "teens_twenties",    label: "10〜20代" },
  { value: "twenties_thirties", label: "20〜30代" },
];

export const ZOZO_CATEGORY_OPTIONS: { value: ZozoCategory; label: string }[] = [
  { value: "auto",      label: "おまかせ" },
  { value: "tops",      label: "トップス" },
  { value: "outer",     label: "アウター" },
  { value: "pants",     label: "パンツ" },
  { value: "skirt",     label: "スカート" },
  { value: "onepiece",  label: "ワンピース" },
  { value: "shoes",     label: "シューズ" },
  { value: "bag",       label: "バッグ" },
  { value: "accessory", label: "アクセサリー" },
  { value: "full",      label: "全身コーデ" },
];

// ── トレンドライブラリ ────────────────────────────────────────────────────────

/** 系統（年代別）*/
const STYLE_POOL: Record<"teens" | "twenties" | "thirties", string[]> = {
  teens: [
    "Y2Kガーリー", "韓国学生風カジュアル", "古着MIX", "サブカルストリート",
    "量産型かわいい", "スポーティーポップ", "ガーリーカジュアル", "ストリートロリ",
  ],
  twenties: [
    "淡色カジュアル", "韓国風きれいめ", "きれいめストリート", "シアー素材MIX",
    "スポーツMIX", "モードカジュアル", "ナチュラルベーシック", "Y2Kリバイバル",
    "フェミニンカジュアル", "ワントーンコーデ",
  ],
  thirties: [
    "きれいめベーシック", "上品カジュアル", "オフィスライク", "大人ストリート",
    "ミニマルモード", "リラックスエレガント", "ナチュラル上品", "ワントーン上品コーデ",
  ],
};

const COLOR_POOL = [
  "淡色トーン", "ワントーン配色", "モノトーン", "くすみカラー",
  "ニュアンスカラー", "ベージュ系", "黒主体に差し色", "白基調の清潔感",
];

const CATEGORY_POOL: Record<Exclude<ZozoCategory, "auto" | "full">, string[]> = {
  tops: [
    "短丈トップス", "シアーブラウス", "リブニット", "ビッグシルエットT",
    "クロップドカットソー", "オフショルトップス", "ベスト重ね着", "ロゴT",
    "バンドカラーシャツ", "チューブトップにシアー重ね",
  ],
  outer: [
    "オーバーサイズデニムジャケット", "ショート丈ブルゾン", "テーラードジャケット",
    "ナイロンアノラック", "ニットカーディガン羽織り", "レザー風ジャケット",
    "トレンチコート", "MA-1風ブルゾン",
  ],
  pants: [
    "ワイドカーゴパンツ", "ローライズデニム", "ストレートデニム", "ナイロンパンツ",
    "センタープレスパンツ", "バギーパンツ", "レギンス見せ",
  ],
  skirt: [
    "プリーツスカート", "マーメイドロングスカート", "デニムミニスカート",
    "シアーレイヤードスカート", "カーゴスカート", "サテンロングスカート",
  ],
  onepiece: [
    "シアーワンピース", "キャミワンピの重ね着", "シャツワンピース",
    "ニットワンピース", "サロペット", "Aラインミニワンピース",
  ],
  shoes: [
    "厚底スニーカー", "厚底サンダル", "メリージェーン", "バレエシューズ",
    "ロングブーツ", "スポーツサンダル", "ローファー",
  ],
  bag: [
    "ミニショルダーバッグ", "ビッグトート", "巾着バッグ",
    "ナイロンボディバッグ", "メッシュバッグ",
  ],
  accessory: [
    "シルバーアクセの重ね付け", "ビッグフープピアス", "キャップ",
    "ニット帽", "レッグウォーマー", "アームウォーマー",
  ],
};

// ── ユーティリティ ────────────────────────────────────────────────────────────

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(pool: readonly T[], n: number): T[] {
  return shuffle(pool).slice(0, Math.max(0, n));
}

function ageToStyleKeys(age: ZozoAge): ("teens" | "twenties" | "thirties")[] {
  switch (age) {
    case "teens":            return ["teens"];
    case "twenties":         return ["twenties"];
    case "thirties":         return ["thirties"];
    case "teens_twenties":   return ["teens", "twenties"];
    case "twenties_thirties":return ["twenties", "thirties"];
    case "any":              return ["teens", "twenties", "thirties"];
  }
}

function ageLabelOf(age: ZozoAge): string {
  return ZOZO_AGE_OPTIONS.find((o) => o.value === age)?.label ?? "指定なし";
}
function categoryLabelOf(cat: ZozoCategory): string {
  return ZOZO_CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? "おまかせ";
}
/** 複数カテゴリ → 表示ラベル（おまかせ/全身コーデは単独表示・個別は「・」連結）。 */
function categoryLabelOfMulti(categories: ZozoCategory[]): string {
  if (categories.length === 0 || categories.includes("auto")) return categoryLabelOf("auto");
  if (categories.includes("full")) return categoryLabelOf("full");
  return categories.map((c) => categoryLabelOf(c)).join("・");
}

function pickStyle(age: ZozoAge): string {
  const keys = ageToStyleKeys(age);
  const merged = keys.flatMap((k) => STYLE_POOL[k]);
  return pickN(merged, 1)[0] ?? "カジュアル";
}

// ── 自動抽出 ──────────────────────────────────────────────────────────────────

/**
 * 年代・カテゴリに応じてトレンド属性をランダムに組み合わせる。
 * 毎回違う組み合わせになる（Math.random）。
 */
export function sampleZozoTrend(age: ZozoAge, categories: ZozoCategory[]): ZozoTrend {
  // おまかせ(auto)／全身コーデ(full)／未選択 は「広域モード」＝全カテゴリ横断。
  const isOmakase =
    categories.length === 0 ||
    categories.includes("auto") ||
    categories.includes("full");

  let traits: string[];
  if (isOmakase) {
    // 全カテゴリ横断で約20個（アイテム17＋色2＋系統1）。
    const colors = pickN(COLOR_POOL, 2);
    const style = pickStyle(age);
    const allItems = pickN(Object.values(CATEGORY_POOL).flat(), 17);
    traits = Array.from(new Set([...allItems, ...colors, style])).filter(Boolean).slice(0, 20);
  } else {
    // 個別カテゴリ：選択したカテゴリごとに5個ずつ UNION（色・系統は付けない＝純粋なカテゴリ傾向）。
    // 例：トップス＋シューズ＝約10個。データは増やさず既存プール（各5〜10件）の範囲で収まる。
    const specific = categories.filter(
      (c): c is Exclude<ZozoCategory, "auto" | "full"> => c !== "auto" && c !== "full",
    );
    const items = specific.flatMap((c) => pickN(CATEGORY_POOL[c], 5));
    traits = Array.from(new Set(items)).filter(Boolean);
  }

  return { ageLabel: ageLabelOf(age), categoryLabel: categoryLabelOfMulti(categories), traits };
}

// ── 手動貼り付け抽出 ──────────────────────────────────────────────────────────

/** ラベル ← 検出トークン（ブランド名は辞書に無いので自然に無視される） */
const EXTRACT_DICT: { label: string; tokens: string[] }[] = [
  { label: "短丈トップス",       tokens: ["短丈", "クロップド", "ショート丈", "へそ出し", "ベアトップ"] },
  { label: "シアー素材",         tokens: ["シアー", "透け", "オーガンジー"] },
  { label: "リブニット",         tokens: ["リブニット", "リブ"] },
  { label: "ニットトップス",     tokens: ["ニット", "セーター"] },
  { label: "ビッグシルエットT",  tokens: ["ビッグt", "オーバーサイズt", "ビッグシルエット"] },
  { label: "ロゴT",              tokens: ["ロゴt", "プリントt"] },
  { label: "ベスト重ね着",       tokens: ["ベスト", "ジレ"] },
  { label: "オフショルトップス", tokens: ["オフショル", "肩出し"] },
  { label: "カーゴパンツ",       tokens: ["カーゴ"] },
  { label: "ワイドパンツ",       tokens: ["ワイドパンツ", "バギー", "ワイドデニム"] },
  { label: "ローライズデニム",   tokens: ["ローライズ", "ローウエスト"] },
  { label: "デニム",             tokens: ["デニム", "ジーンズ", "ジーパン"] },
  { label: "ナイロンパンツ",     tokens: ["ナイロンパンツ", "トラックパンツ", "ジャージパンツ"] },
  { label: "センタープレスパンツ", tokens: ["センタープレス", "スラックス"] },
  { label: "プリーツスカート",   tokens: ["プリーツ"] },
  { label: "ロングスカート",     tokens: ["ロングスカート", "マキシスカート", "マーメイド"] },
  { label: "ミニスカート",       tokens: ["ミニスカ", "ミニスカート"] },
  { label: "サテンスカート",     tokens: ["サテン"] },
  { label: "ワンピース",         tokens: ["ワンピース", "ワンピ", "サロペット"] },
  { label: "シャツワンピ",       tokens: ["シャツワンピ"] },
  { label: "厚底シューズ",       tokens: ["厚底"] },
  { label: "スニーカー",         tokens: ["スニーカー"] },
  { label: "サンダル",           tokens: ["サンダル"] },
  { label: "ロングブーツ",       tokens: ["ブーツ"] },
  { label: "バレエシューズ",     tokens: ["バレエシューズ", "メリージェーン", "ローファー"] },
  { label: "ジャケット/アウター", tokens: ["ジャケット", "ブルゾン", "アウター", "コート", "カーディガン", "アノラック", "ma-1", "ma1"] },
  { label: "ミニバッグ",         tokens: ["ミニバッグ", "ミニショルダー", "巾着"] },
  { label: "ビッグトート",       tokens: ["トート", "ビッグバッグ"] },
  { label: "シルバーアクセ",     tokens: ["シルバーアクセ", "シルバーリング", "ピアス", "アクセ重ね"] },
  { label: "キャップ/帽子",      tokens: ["キャップ", "ニット帽", "バケハ", "ハット"] },
  { label: "レッグ/アームウォーマー", tokens: ["レッグウォーマー", "アームウォーマー"] },
  // 系統・色
  { label: "淡色カジュアル",     tokens: ["淡色"] },
  { label: "ワントーンコーデ",   tokens: ["ワントーン", "ワンカラー"] },
  { label: "モノトーン配色",     tokens: ["モノトーン", "白黒"] },
  { label: "くすみカラー",       tokens: ["くすみ"] },
  { label: "韓国風カジュアル",   tokens: ["韓国", "韓国風", "オルチャン"] },
  { label: "スポーツMIX",        tokens: ["スポーツ", "アスレ", "ジャージ", "テック"] },
  { label: "Y2Kスタイル",        tokens: ["y2k", "2000年代", "ギャル"] },
  { label: "古着MIX",            tokens: ["古着", "ヴィンテージ"] },
  { label: "きれいめスタイル",   tokens: ["きれいめ", "オフィス", "上品"] },
];

/**
 * 貼り付けテキストからトレンド属性を抽出する。
 * 辞書にあるトークンのみ拾うため、ブランド名・商品名は自然に除外される。
 */
export function extractZozoFromText(text: string, age: ZozoAge, categories: ZozoCategory[]): ZozoTrend {
  const norm = text.toLowerCase().normalize("NFC");
  const found: string[] = [];
  for (const entry of EXTRACT_DICT) {
    if (entry.tokens.some((t) => norm.includes(t.toLowerCase().normalize("NFC")))) {
      if (!found.includes(entry.label)) found.push(entry.label);
    }
  }
  return {
    ageLabel: ageLabelOf(age),
    categoryLabel: categoryLabelOfMulti(categories),
    traits: found.slice(0, 8),
  };
}
