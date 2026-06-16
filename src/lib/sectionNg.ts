/**
 * セクションNG（詳細フィールド単位の強制skip）の単一ソース定義。
 *
 * キーは "category.field" 形式（DetailSettings のカテゴリ名・例 "background.place"）。
 * - applySectionNg（ngGate.ts）：このキーで details[cat][field] を "skip" 上書き／multiOverrides[key] を delete。
 * - DetailsCard：見出しダブルクリックで onToggleSectionNg(key)。ngKey は SectionNgKey 型に縛り、
 *   ラベルマップ＝ngKey＝applySectionNg/multiOverrides を「同一ソース・同一規則」で揃える（キーずれ防止）。
 * - ReflectionStatusBar / ArrangePreviewPanel（B2b）：key → 日本語ラベルに変換してバッジ表示。
 *
 * ラベルはカテゴリ内で一意（カテゴリを跨ぐ重複はバッジ側でカテゴリ接頭辞を付けて区別する）。
 * アスペクト比は対象外（含めない）。露出/変化量など FieldSection を使わない特殊コントロールも対象外。
 */
export const SECTION_NG_LABELS = {
  // 髪
  "hair.hairStyle":  "スタイル系統",
  "hair.length":     "長さ",
  "hair.shape":      "形",
  "hair.color":      "髪色",
  "hair.texture":    "質感",
  "hair.colorMode":  "カラーモード",
  "hair.bangs":      "前髪",
  "hair.tips":       "毛先",
  "hair.volume":     "ボリューム",
  "hair.accessory":  "アクセサリー",
  // 衣装
  "outfit.style":      "系統",
  "outfit.color":      "色方向",
  "outfit.material":   "素材",
  "outfit.silhouette": "シルエット",
  "outfit.exposure":   "露出",
  "outfit.decoration": "装飾量",
  "outfit.season":     "季節感",
  "outfit.luxury":     "高級感",
  // 背景
  "background.style":       "背景スタイル",
  "background.place":       "場所",
  "background.color":       "色",
  "background.time":        "時間帯",
  "background.weather":     "天候",
  "background.density":     "密度",
  "background.effect":      "空間効果",
  "background.depth":       "奥行き",
  "background.info":        "情報量",
  "background.textType":    "文字の種類",
  "background.textMood":    "文字の雰囲気",
  "background.textLayout":  "文字配置",
  "background.textTexture": "文字の質感",
  // ポーズ
  "pose.type":        "種類",
  "pose.impression":  "印象",
  "pose.gaze":        "視線",
  "pose.hand":        "手の位置",
  "pose.foot":        "足の位置",
  "pose.balance":     "重心",
  "pose.motion":      "動き",
  "pose.orientation": "体の向き",
  // カメラ
  "camera.angle":       "角度",
  "camera.distance":    "距離",
  "camera.lens":        "レンズ感",
  "camera.composition": "構図",
  "camera.fov":         "画角",
  "camera.eyeHeight":   "視点高さ",
  // 持ち物
  "props.category":  "カテゴリ",
  "props.hold":      "持たせ方",
  "props.size":      "サイズ",
  "props.glow":      "光り方",
  "props.vibe":      "雰囲気",
  "props.placement": "配置",
  "props.count":     "個数",
  // 大物
  "bigObject.type":      "種類",
  "bigObject.condition": "状態",
  "bigObject.placement": "配置",
  "bigObject.size":      "サイズ",
  "bigObject.mood":      "雰囲気",
  // 乗り物
  "vehicle.genre":       "ジャンル",
  "vehicle.type":        "種類",
  "vehicle.interaction": "関わり方",
  "vehicle.era":         "時代感",
  "vehicle.material":    "素材感",
  "vehicle.atmosphere":  "雰囲気",
  // 神話
  "myth.region":      "神話地域",
  "myth.creature":    "幻獣種別",
  "myth.interaction": "配置・関わり方",
  "myth.style":       "描写スタイル",
  "myth.size":        "サイズ感",
  // ライティング
  "lighting.direction":   "光源方向",
  "lighting.intensity":   "強さ",
  "lighting.temperature": "色温度",
  "lighting.shadow":      "影",
  "lighting.reflection":  "反射",
  "lighting.atmosphere":  "空気感",
  // 機械化
  "cyber.part":      "変化する部位",
  "cyber.type":      "機械化タイプ",
  "cyber.texture":   "質感",
  "cyber.glowColor": "発光色",
  // コスプレ
  "cosplay.genre":         "ジャンル系統",
  "cosplay.cuteStyle":     "かわいい系",
  "cosplay.jobGenre":      "職種・役割系",
  "cosplay.japaneseStyle": "和風系",
  "cosplay.fantasyStyle":  "ファンタジー系",
  "cosplay.scifiStyle":    "SF・近未来系",
  "cosplay.darkStyle":     "ダーク系",
  "cosplay.occupation":    "職業コスプレ",
  "cosplay.decoration":    "装飾レベル",
  "cosplay.item":          "持ち物・小物",
  "cosplay.colorDir":      "カラー方向",
  // 前景演出
  "foreground.preset":      "プリセット",
  "foreground.effectType":  "エフェクト種類",
  "foreground.swirlType":   "回転・渦",
  "foreground.digitalType": "HUD・デジタル",
  "foreground.artType":     "アート表現",
  "foreground.position":    "位置",
  "foreground.density":     "密度",
  "foreground.motion":      "動き",
  "foreground.color":       "色方向",
  "foreground.depth":       "奥行き",
  "foreground.visibility":  "視認性",
} as const;

/** セクションNG 可能なフィールドキー（"category.field"）。ngKey はこの union に縛る。 */
export type SectionNgKey = keyof typeof SECTION_NG_LABELS;

/** "category.field" → 日本語ラベル（未知キーはそのまま）。バッジ表示用。 */
export function sectionNgLabel(key: string): string {
  return (SECTION_NG_LABELS as Record<string, string>)[key] ?? key;
}

/** sectionNg 配列を日本語ラベル配列へ。バッジ表示用。 */
export function sectionNgLabels(keys: string[]): string[] {
  return keys.map(sectionNgLabel);
}
