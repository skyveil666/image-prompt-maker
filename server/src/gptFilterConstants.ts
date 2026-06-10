/**
 * GPT Image 2 フィルター 3層対策定数
 *
 * ChatGPT は日本語プロンプトを内部で英訳してから L1 判定するため、
 * 日本語・英語の両方の形を含むことで素通りを防ぐ。
 *
 * 既存サニタイザ（safetySanitizePrompt）でカバー済みのものは重複を避け、
 * ここでは「未カバーの日本語語形」と「英語語形の全量」を定義する。
 *
 * 既存カバー済み（再登録不要）:
 *   ビキニ/下着/水着/透け素材/肌露出/脚/太もも/胸元/ボディライン
 *   監視カメラ（CCTV）/パパラッチ/覗き見/盗撮
 *   手首を切/リストカット/手首
 *   ロリィタ/ロリータ/セーラー服/JK/学ラン
 *   退廃的/官能的/挑発的/セクシー/扇情的/悪魔/破壊的/凶悪等
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L1: キーワードブロックリスト（英語 + 日本語同義語）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** L1: 肌露出・下着系 */
export const L1_EXPOSURE: Array<[RegExp, string]> = [
  // 日本語: 既存未カバー分
  [/ヌード(?:写真|撮影|シーン|スタイル|アート)?/g,  "ファッション撮影"],
  [/全裸(?:写真|撮影|シーン)?/g,                    "スタイルドコスチューム"],
  [/半裸(?:写真|撮影)?/g,                            "ミニマルスタイル"],
  [/裸体(?:写真|撮影|表現)?/g,                       "ファッション表現"],
  [/ランジェリー(?:姿|スタイル|コーデ|コレクション)?/g, "デリケートファッション"],
  [/PVC(?:衣装|コスチューム|スーツ|ドレス|素材)/g,   "構造的なコスチューム"],
  // 英語
  [/\bnude\b/gi,                                     "in fashion attire"],
  [/\bnaked\b/gi,                                    "in styled clothing"],
  [/\bbare\s+skin\b/gi,                              "visible fashion detail"],
  [/\bexposed\s+skin\b/gi,                           "open neckline design"],
  [/\bsee[-\s]?through\b/gi,                         "sheer-textured fabric"],
  [/\blingerie\b/gi,                                 "delicate fashion detail"],
  [/\bPVC\b(?=\s+(?:outfit|costume|suit|dress|wear|material))/gi, "structured costume"],
];

/** L1: 監視・盗撮系 */
export const L1_SURVEILLANCE: Array<[RegExp, string]> = [
  // 日本語: 隠しカメラ等は既存未カバー
  [/隠しカメラ(?:風|アングル)?/g,                   "映画スチール風アングル"],
  [/盗撮カメラ(?:風|アングル)?/g,                   "映画スチール風アングル"],
  // 英語
  [/\bsurveillance\b/gi,                             "cinematic angle"],
  [/\bCCTV\b/gi,                                     "portrait angle"],
  [/\bhidden\s+camera\b/gi,                          "candid portrait"],
  [/\bpaparazzi\b/gi,                                "editorial photography"],
  [/\bvoyeur(?:istic)?\b/gi,                         "unique perspective"],
  [/\bspy\s+shot\b/gi,                               "candid editorial"],
];

/** L1: 自傷・自殺系 */
export const L1_SELF_HARM: Array<[RegExp, string]> = [
  // 日本語: 既存未カバー分（手首を切/リストカットは既存カバー済み）
  [/自傷行為(?:シーン|描写|表現)?/g,                "アーティスティックな表現"],
  [/自傷/g,                                          "感情表現"],
  [/自殺(?:シーン|描写|シチュエーション)?/g,         "ドラマチックシーン"],
  [/首吊り(?:シーン|描写|ポーズ)?/g,                "サスペンデッドポーズ"],
  // 英語
  [/\bself[-\s]?harm\b/gi,                           "artistic expression"],
  [/\bsuicide\b/gi,                                  "dramatic scene"],
  [/\bhanging\b(?=\s+(?:from|scene|pose|figure|silhouette))/gi, "suspended pose"],
  [/\bwrist\s*cut\b/gi,                              "wrist accessory detail"],
  [/\bblade\b(?=\s+(?:in hand|weapon|drawn|raised|held))/gi,    "glowing prop"],
  [/\bknife\b(?=\s+(?:in hand|weapon|drawn|held|raised|pointed))/gi, "styled prop"],
];

/** L1: 年齢・制服系 */
export const L1_AGE_UNIFORM: Array<[RegExp, string]> = [
  // 日本語: 制服ジェネリック（既存は固有単語のみカバー）
  [/学校制服(?:風|スタイル|コーデ)?/g,              "カレッジスタイル"],
  [/女子制服(?:風|スタイル)?/g,                      "カレッジスタイル"],
  [/制服(?:コスプレ|姿|風コーデ|スタイル)/g,         "カレッジスタイル"],
  // 英語
  [/\blolita\b/gi,                                   "doll-style fashion"],
  [/\bschool\s+uniform\b/gi,                         "classic college jacket"],
  [/\bsailor\s+uniform\b/gi,                         "marine college wear"],
  [/\bteen\b(?=\s+(?:model|fashion|style|character|girl|boy|female|male))/gi, "young adult model"],
  [/\bchildlike\b/gi,                                "youthful"],
  [/\bJK\b(?=\s+(?:style|fashion|uniform|outfit|look|character))/g, "college style"],
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L2: 雰囲気語安全変換テーブル（英語 + 日本語同義語）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const L2_ATMOSPHERE: Array<[RegExp, string]> = [
  // 日本語: 既存未カバー分
  [/グロテスク(?:な|系|風|的)?/g,                   "シュールで抽象的な"],
  [/オカルト(?:な|系|風|的)?/g,                     "シンボリックなモチーフ"],
  [/引き裂か?れた(?:衣装|ドレス|服|布|素材)?/g,     "ディストレス加工の"],
  [/戦場のような?/g,                                 "ウェザードテクスチャの"],
  // 英語
  [/\bdark\b(?=\s+(?:and\s+gloomy|atmosphere|mood|aesthetic|theme|scene|vibe|setting))/gi,
                                                      "moody, low-key lighting"],
  [/\bgloomy\b/gi,                                   "atmospheric low-key"],
  [/\bbattle[-\s]?worn\b/gi,                         "weathered-textured"],
  [/\bragged\b(?=\s+(?:outfit|clothing|look|style|appearance|texture))/gi, "vintage-textured"],
  [/\btorn\b(?=\s+(?:outfit|clothing|fabric|dress|garment|sleeve))/gi,     "distressed"],
  [/\bblood\b(?!\s+orange)(?=\s+(?:stain|red|splatter|drip|color|colored))/gi, "crimson accent"],
  [/\bgrotesque\b/gi,                                "surreal and abstract"],
  [/\boccult\b/gi,                                   "symbolic ritualistic motif"],
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L3: 複合トリガーパターン（日本語・英語共通の文脈検査）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const L3_COMPOUND: Array<{
  label: string;
  detect: (text: string) => boolean;
  fix: (text: string) => string;
}> = [
  {
    // コスプレ系衣装 + 上方アングル → 目線高さ・アイレベルに補正
    label: "L3-cosplay-highangle",
    detect: (t) =>
      /コスプレ|コスチューム|制服|cosplay|costume|uniform/i.test(t) &&
      /真上|真俯瞰|ハイアングル|俯瞰|bird.?s.?eye|overhead|top.?down/i.test(t),
    fix: (t) =>
      t.replace(
        /真上|真俯瞰|俯瞰ハイアングル|ハイアングル|bird'?s.?eye\s*(?:view)?|overhead\s*shot|top.?down\s*(?:shot|view)?/gi,
        "目線高さ・アイレベル",
      ),
  },
  {
    // 人物 + 肌露出多 → fully clothed 補完
    label: "L3-exposure-person",
    detect: (t) =>
      /人物|モデル|キャラクター|character|model|figure/i.test(t) &&
      /肌の露出が多|露出多め|肌露出|bare skin|exposed skin|skin showing/i.test(t),
    fix: (t) => t + ", fully clothed, complete outfit coverage",
  },
  {
    // 防犯カメラ / ドローン空撮風 → 映画スチール風ポートレートアングルへ
    label: "L3-surveillance-angle",
    detect: (t) =>
      /防犯カメラ|ドローン空撮|ドローン直下|監視カメラ|surveillance|CCTV|drone\s*overhead/i.test(t),
    fix: (t) =>
      t.replace(
        /防犯カメラ(?:風)?|ドローン空撮(?:風)?|ドローン直下(?:風)?|surveillance\s*camera|CCTV|drone\s*overhead/gi,
        "映画スチール風ポートレートアングル",
      ),
  },
];

/** safetySanitizePrompt() の rules 配列末尾に展開する L1+L2 統合リスト */
export const GPT_FILTER_RULES: Array<[RegExp, string]> = [
  ...L1_EXPOSURE,
  ...L1_SURVEILLANCE,
  ...L1_SELF_HARM,
  ...L1_AGE_UNIFORM,
  ...L2_ATMOSPHERE,
];
