/**
 * タグ個別NG（per-tag NG）の単一ソース解決テーブル。
 *
 * tagNg のキーは "category.field:value" 形式（例 "background.style:watercolor"）。
 * このキーを presets の options 配列から **en（英語語句）** に解決し、送信ゲートで ngList(【NG】) へ合流する。
 * ＝per-tag NG は「値の除外」なので applySectionNg(フィールドskip)ではなく ngList/【NG】を再利用する。
 *
 * FIELD_OPTIONS は DetailsCard の各 FieldSection/MultiFieldSection が使う options と同一参照（単一ソース）。
 */
import type { PresetItem } from "./presets";
import {
  HAIR_STYLES, HAIR_LENGTHS, HAIR_SHAPES, HAIR_COLORS, HAIR_TEXTURES, HAIR_COLOR_MODES,
  HAIR_BANGS, HAIR_TIPS, HAIR_VOLUMES, HAIR_ACCESSORIES,
  OUTFIT_STYLES, OUTFIT_COLORS, OUTFIT_MATERIALS, OUTFIT_SILHOUETTES, OUTFIT_EXPOSURES,
  OUTFIT_DECORATIONS, OUTFIT_SEASONS, OUTFIT_LUXURIES,
  BG_STYLES, BG_PLACES, BG_COLORS, BG_TIMES, BG_WEATHERS, BG_DENSITIES, BG_EFFECTS,
  BG_DEPTHS, BG_INFOS, BG_TEXT_TYPES, BG_TEXT_MOODS, BG_TEXT_LAYOUTS, BG_TEXT_TEXTURES,
  POSE_TYPES, POSE_IMPRESSIONS, POSE_GAZES, POSE_HANDS, POSE_FEET, POSE_BALANCES, POSE_MOTIONS, POSE_ORIENTATIONS,
  CAMERA_ANGLES, CAMERA_DISTANCES, CAMERA_LENSES, CAMERA_COMPOSITIONS, CAMERA_FOVS, CAMERA_EYE_HEIGHTS,
  PROPS_CATEGORIES, PROPS_HOLDS, PROPS_SIZES, PROPS_GLOWS, PROPS_VIBES, PROPS_PLACEMENTS, PROPS_COUNTS,
  BIG_OBJECT_TYPES, BIG_OBJECT_CONDITIONS, BIG_OBJECT_PLACEMENTS, BIG_OBJECT_SIZES, BIG_OBJECT_MOODS,
  VEHICLE_GENRES, VEHICLE_TYPES, VEHICLE_INTERACTIONS, VEHICLE_ERAS, VEHICLE_MATERIALS, VEHICLE_ATMOSPHERES,
  MYTH_REGIONS, MYTH_CREATURES, MYTH_INTERACTIONS, MYTH_STYLES, MYTH_SIZES,
  LIGHT_DIRECTIONS, LIGHT_INTENSITIES, LIGHT_TEMPS, LIGHT_SHADOWS, LIGHT_REFLECTIONS, LIGHT_ATMOSPHERES,
  CYBER_PARTS, CYBER_TYPES, CYBER_TEXTURES, CYBER_GLOW_COLORS,
  COSPLAY_GENRES, COSPLAY_CUTE_STYLES, COSPLAY_JOB_GENRES, COSPLAY_JAPANESE_STYLES, COSPLAY_FANTASY_STYLES,
  COSPLAY_SCIFI_STYLES, COSPLAY_DARK_STYLES, COSPLAY_OCCUPATIONS, COSPLAY_DECORATIONS, COSPLAY_ITEMS, COSPLAY_COLOR_DIRS,
  FG_PRESETS, FG_EFFECT_TYPES, FG_SWIRL_TYPES, FG_DIGITAL_TYPES, FG_ART_TYPES, FG_POSITIONS,
  FG_DENSITIES, FG_MOTIONS, FG_COLORS, FG_DEPTHS, FG_VISIBILITIES,
} from "./presets";

/** "category.field" → そのフィールドの選択肢配列（DetailsCard と同一参照）。 */
export const FIELD_OPTIONS: Record<string, PresetItem[]> = {
  "hair.hairStyle": HAIR_STYLES, "hair.length": HAIR_LENGTHS, "hair.shape": HAIR_SHAPES,
  "hair.color": HAIR_COLORS, "hair.texture": HAIR_TEXTURES, "hair.colorMode": HAIR_COLOR_MODES,
  "hair.bangs": HAIR_BANGS, "hair.tips": HAIR_TIPS, "hair.volume": HAIR_VOLUMES, "hair.accessory": HAIR_ACCESSORIES,
  "outfit.style": OUTFIT_STYLES, "outfit.color": OUTFIT_COLORS, "outfit.material": OUTFIT_MATERIALS,
  "outfit.silhouette": OUTFIT_SILHOUETTES, "outfit.exposure": OUTFIT_EXPOSURES, "outfit.decoration": OUTFIT_DECORATIONS,
  "outfit.season": OUTFIT_SEASONS, "outfit.luxury": OUTFIT_LUXURIES,
  "background.style": BG_STYLES, "background.place": BG_PLACES, "background.color": BG_COLORS,
  "background.time": BG_TIMES, "background.weather": BG_WEATHERS, "background.density": BG_DENSITIES,
  "background.effect": BG_EFFECTS, "background.depth": BG_DEPTHS, "background.info": BG_INFOS,
  "background.textType": BG_TEXT_TYPES, "background.textMood": BG_TEXT_MOODS,
  "background.textLayout": BG_TEXT_LAYOUTS, "background.textTexture": BG_TEXT_TEXTURES,
  "pose.type": POSE_TYPES, "pose.impression": POSE_IMPRESSIONS, "pose.gaze": POSE_GAZES,
  "pose.hand": POSE_HANDS, "pose.foot": POSE_FEET, "pose.balance": POSE_BALANCES,
  "pose.motion": POSE_MOTIONS, "pose.orientation": POSE_ORIENTATIONS,
  "camera.angle": CAMERA_ANGLES, "camera.distance": CAMERA_DISTANCES, "camera.lens": CAMERA_LENSES,
  "camera.composition": CAMERA_COMPOSITIONS, "camera.fov": CAMERA_FOVS, "camera.eyeHeight": CAMERA_EYE_HEIGHTS,
  "props.category": PROPS_CATEGORIES, "props.hold": PROPS_HOLDS, "props.size": PROPS_SIZES,
  "props.glow": PROPS_GLOWS, "props.vibe": PROPS_VIBES, "props.placement": PROPS_PLACEMENTS, "props.count": PROPS_COUNTS,
  "bigObject.type": BIG_OBJECT_TYPES, "bigObject.condition": BIG_OBJECT_CONDITIONS,
  "bigObject.placement": BIG_OBJECT_PLACEMENTS, "bigObject.size": BIG_OBJECT_SIZES, "bigObject.mood": BIG_OBJECT_MOODS,
  "vehicle.genre": VEHICLE_GENRES, "vehicle.type": VEHICLE_TYPES, "vehicle.interaction": VEHICLE_INTERACTIONS,
  "vehicle.era": VEHICLE_ERAS, "vehicle.material": VEHICLE_MATERIALS, "vehicle.atmosphere": VEHICLE_ATMOSPHERES,
  "myth.region": MYTH_REGIONS, "myth.creature": MYTH_CREATURES, "myth.interaction": MYTH_INTERACTIONS,
  "myth.style": MYTH_STYLES, "myth.size": MYTH_SIZES,
  "lighting.direction": LIGHT_DIRECTIONS, "lighting.intensity": LIGHT_INTENSITIES, "lighting.temperature": LIGHT_TEMPS,
  "lighting.shadow": LIGHT_SHADOWS, "lighting.reflection": LIGHT_REFLECTIONS, "lighting.atmosphere": LIGHT_ATMOSPHERES,
  "cyber.part": CYBER_PARTS, "cyber.type": CYBER_TYPES, "cyber.texture": CYBER_TEXTURES, "cyber.glowColor": CYBER_GLOW_COLORS,
  "cosplay.genre": COSPLAY_GENRES, "cosplay.cuteStyle": COSPLAY_CUTE_STYLES, "cosplay.jobGenre": COSPLAY_JOB_GENRES,
  "cosplay.japaneseStyle": COSPLAY_JAPANESE_STYLES, "cosplay.fantasyStyle": COSPLAY_FANTASY_STYLES,
  "cosplay.scifiStyle": COSPLAY_SCIFI_STYLES, "cosplay.darkStyle": COSPLAY_DARK_STYLES,
  "cosplay.occupation": COSPLAY_OCCUPATIONS, "cosplay.decoration": COSPLAY_DECORATIONS,
  "cosplay.item": COSPLAY_ITEMS, "cosplay.colorDir": COSPLAY_COLOR_DIRS,
  "foreground.preset": FG_PRESETS, "foreground.effectType": FG_EFFECT_TYPES, "foreground.swirlType": FG_SWIRL_TYPES,
  "foreground.digitalType": FG_DIGITAL_TYPES, "foreground.artType": FG_ART_TYPES, "foreground.position": FG_POSITIONS,
  "foreground.density": FG_DENSITIES, "foreground.motion": FG_MOTIONS, "foreground.color": FG_COLORS,
  "foreground.depth": FG_DEPTHS, "foreground.visibility": FG_VISIBILITIES,
};

/** tagNg のキー "category.field:value" → option を引く（無ければ null）。 */
export function lookupTagOption(key: string): PresetItem | null {
  const i = key.lastIndexOf(":");
  if (i < 0) return null;
  const fieldKey = key.slice(0, i);
  const value = key.slice(i + 1);
  return FIELD_OPTIONS[fieldKey]?.find((o) => o.id === value) ?? null;
}

/** tagNg(キー配列) → 【NG】へ載せる en 語句配列（en 優先・無ければ label・最後に value）。重複排除。 */
export function tagNgToNgTerms(tagNg: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of tagNg) {
    const opt = lookupTagOption(key);
    const term = (opt?.en || opt?.label || key.slice(key.lastIndexOf(":") + 1)).trim();
    if (term && !seen.has(term.toLowerCase())) { seen.add(term.toLowerCase()); out.push(term); }
  }
  return out;
}

/** UI用：あるフィールドのタグがNG中か（"category.field:value" を構築して判定）。 */
export function isTagNg(tagNg: string[], fieldKey: string, value: string): boolean {
  return tagNg.includes(`${fieldKey}:${value}`);
}

/** UI表示用：tagNg(キー配列) → 日本語ラベル配列（label 優先・無ければ value）。バッジ要約に使う。 */
export function tagNgToLabels(tagNg: string[]): string[] {
  return tagNg.map((key) => {
    const opt = lookupTagOption(key);
    return opt?.label || key.slice(key.lastIndexOf(":") + 1);
  });
}
