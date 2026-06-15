import { Suspense, lazy, useRef, useState } from "react";
import type { ArtStyle, Camera3DState, ColorStrategy, DetailSettings, Mood, Scope } from "../types";
import { DEFAULT_DETAILS, AUTO_DETAILS } from "../types";
import { describeCameraAngle } from "../lib/cameraAngle";
import type { PresetItem } from "../data/presets";
import {
  BG_COLORS,
  BG_DENSITIES,
  BG_DEPTHS,
  BG_EFFECTS,
  BG_INFOS,
  BG_PLACES,
  BG_STYLES,
  BG_TIMES,
  BG_WEATHERS,
  CAMERA_ANGLES,
  CAMERA_COMPOSITIONS,
  CAMERA_DISTANCES,
  CAMERA_EYE_HEIGHTS,
  CAMERA_FOVS,
  CAMERA_LENSES,
  CYBER_GLOW_COLORS,
  CYBER_INTENSITIES,
  CYBER_PARTS,
  CYBER_TEXTURES,
  CYBER_TYPES,
  COSPLAY_COLOR_DIRS,
  COSPLAY_CUTE_STYLES,
  COSPLAY_DARK_STYLES,
  COSPLAY_DECORATIONS,
  COSPLAY_EXPOSURES,
  COSPLAY_FANTASY_STYLES,
  COSPLAY_GENRES,
  COSPLAY_ITEMS,
  COSPLAY_JAPANESE_STYLES,
  COSPLAY_JOB_GENRES,
  COSPLAY_OCCUPATIONS,
  COSPLAY_SCIFI_STYLES,
  HAIR_ACCESSORIES,
  HAIR_BANGS,
  HAIR_COLOR_MODES,
  HAIR_COLORS,
  HAIR_LENGTHS,
  HAIR_SHAPES,
  HAIR_STYLES,
  HAIR_TEXTURES,
  HAIR_TIPS,
  HAIR_VOLUMES,
  LIGHT_ATMOSPHERES,
  LIGHT_DIRECTIONS,
  LIGHT_INTENSITIES,
  LIGHT_REFLECTIONS,
  LIGHT_SHADOWS,
  LIGHT_TEMPS,
  OUTFIT_COLORS,
  OUTFIT_DECORATIONS,
  OUTFIT_EXPOSURES,
  OUTFIT_LUXURIES,
  OUTFIT_MATERIALS,
  OUTFIT_SEASONS,
  OUTFIT_SILHOUETTES,
  OUTFIT_STYLES,
  POSE_BALANCES,
  POSE_FEET,
  POSE_GAZES,
  POSE_HANDS,
  POSE_IMPRESSIONS,
  POSE_MOTIONS,
  POSE_ORIENTATIONS,
  POSE_TYPES,
  PROPS_CATEGORIES,
  PROPS_COUNTS,
  PROPS_GLOWS,
  PROPS_HOLDS,
  PROPS_PLACEMENTS,
  PROPS_SIZES,
  PROPS_VIBES,
  ASPECT_RATIO_PRESETS,
  VEHICLE_GENRES,
  VEHICLE_TYPES,
  VEHICLE_INTERACTIONS,
  VEHICLE_ERAS,
  VEHICLE_MATERIALS,
  VEHICLE_ATMOSPHERES,
  MYTH_REGIONS,
  MYTH_CREATURES,
  MYTH_INTERACTIONS,
  MYTH_STYLES,
  MYTH_SIZES,
  FG_PRESETS,
  FG_EFFECT_TYPES,
  FG_SWIRL_TYPES,
  FG_DIGITAL_TYPES,
  FG_ART_TYPES,
  FG_POSITIONS,
  FG_DENSITIES,
  FG_MOTIONS,
  FG_COLORS,
  FG_DEPTHS,
  FG_VISIBILITIES,
  BG_TEXT_TYPES,
  BG_TEXT_MOODS,
  BG_TEXT_LAYOUTS,
  BG_TEXT_TEXTURES,
  BIG_OBJECT_GENRES,
  BIG_OBJECT_TYPES,
  BIG_OBJECT_CONDITIONS,
  BIG_OBJECT_PLACEMENTS,
  BIG_OBJECT_SIZES,
  BIG_OBJECT_MOODS,
} from "../data/presets";
import { GridCell, CellSectionLabel, CellGrid } from "./GridCell";
import { ExtraInstructions } from "./ExtraInstructions";
import { NgInput } from "./NgInput";
import { ForbiddenTokens } from "./ForbiddenTokens";
import {
  MOOD_GROUPS_BASIC,
  MOOD_GROUPS_DETAIL,
  type MoodGroup,
  MoodGroupRow,
} from "./MoodSelector";
import { COLOR_STRATEGY_OPTIONS } from "./EraColorSelector";

const Camera3DPicker = lazy(() => import("./Camera3DPicker"));

// ─── Types ────────────────────────────────────────────────────────────────────

// "era"（時代）は完全撤去（dead code整理）。"sns"/"culture" タブも撤去（重複整理：
// SNS系はバズボタン・世界観はQuickActionsプリセットに一本化。mood ID・保存データは非破壊）。
type ExtraTabId = "mood" | "globalStyle" | "ng";
type TabId = Scope | ExtraTabId;

// globalStyle（絵柄＋色戦略）は最上部にピン留めする（renderのsortで rank 最上位）。
const EXTRA_TAB_IDS: ExtraTabId[] = ["globalStyle", "mood", "ng"];

interface ExtraTabMeta {
  label: string;
  activeBorder: string;
  activeBg: string;
  activeText: string;
  activeShadow: string;
}

const EXTRA_TAB_META: Record<ExtraTabId, ExtraTabMeta> = {
  mood:          { label: "🎭 雰囲気",  activeBorder: "border-violet-400/70", activeBg: "bg-violet-500/15",  activeText: "text-violet-200",  activeShadow: "shadow-[0_0_10px_rgba(139,92,246,0.22)]" },
  globalStyle:   { label: "🎨 全体スタイル", activeBorder: "border-fuchsia-400/70", activeBg: "bg-fuchsia-500/15", activeText: "text-fuchsia-200", activeShadow: "shadow-[0_0_8px_rgba(217,70,239,0.22)]"  },
  ng:            { label: "🚫 NG指定",     activeBorder: "border-rose-400/70",   activeBg: "bg-rose-500/15",    activeText: "text-rose-200",    activeShadow: "shadow-[0_0_8px_rgba(244,63,94,0.22)]"   },
};

interface Props {
  scopes: Scope[];
  value: DetailSettings;
  onChange: (next: DetailSettings) => void;
  // Integrated 雰囲気 / 時代 / 色戦略 / NG props
  moods: Mood[];
  autoMoodCategories: string[];
  onMoodsChange: (moods: Mood[], autoCategories: string[]) => void;
  colorStrategy: ColorStrategy | null;
  artStyle: ArtStyle | null;
  onColorStrategyChange: (v: ColorStrategy | null) => void;
  onArtStyleChange: (v: ArtStyle | null) => void;
  extraInstructions: string;
  onExtraInstructionsChange: (v: string) => void;
  ngList: string;
  onNgListChange: (v: string) => void;
  forbiddenTokens: string[];
  onForbiddenTokensChange: (tokens: string[]) => void;
}

type Updater = <K extends keyof DetailSettings>(
  key: K,
  patch: Partial<DetailSettings[K]>
) => void;

// ─── Scope metadata ───────────────────────────────────────────────────────────

interface ScopeMeta {
  label: string;
  color: string;
  activeBorder: string;
  activeBg: string;
  activeShadow: string;
}
const SCOPE_META: Record<Scope, ScopeMeta> = {
  background:   { label: "背景",       color: "text-emerald-200", activeBorder: "border-emerald-400/80",  activeBg: "bg-emerald-500/20",  activeShadow: "shadow-[0_0_10px_rgba(52,211,153,0.25)]"  },
  foreground:   { label: "前景演出",   color: "text-lime-200",    activeBorder: "border-lime-400/80",     activeBg: "bg-lime-500/20",     activeShadow: "shadow-[0_0_10px_rgba(163,230,53,0.25)]"  },
  hair:         { label: "髪",         color: "text-fuchsia-200", activeBorder: "border-fuchsia-400/80",  activeBg: "bg-fuchsia-500/20",  activeShadow: "shadow-[0_0_10px_rgba(232,121,249,0.25)]"  },
  outfit:       { label: "衣装",       color: "text-sky-200",     activeBorder: "border-sky-400/80",      activeBg: "bg-sky-500/20",      activeShadow: "shadow-[0_0_10px_rgba(56,189,248,0.25)]"   },
  cosplay:      { label: "コスプレ",   color: "text-orange-200",  activeBorder: "border-orange-400/80",   activeBg: "bg-orange-500/20",   activeShadow: "shadow-[0_0_10px_rgba(251,146,60,0.25)]"   },
  cyber:        { label: "🦾 メカ",     color: "text-teal-200",    activeBorder: "border-teal-400/80",     activeBg: "bg-teal-500/20",     activeShadow: "shadow-[0_0_10px_rgba(45,212,191,0.25)]"   },
  pose:         { label: "ポーズ",     color: "text-amber-200",   activeBorder: "border-amber-400/80",    activeBg: "bg-amber-500/20",    activeShadow: "shadow-[0_0_10px_rgba(251,191,36,0.25)]"   },
  camera:       { label: "カメラ",     color: "text-cyan-200",    activeBorder: "border-cyan-400/80",     activeBg: "bg-cyan-500/20",     activeShadow: "shadow-[0_0_10px_rgba(34,211,238,0.25)]"   },
  props:        { label: "持ち物",     color: "text-rose-200",    activeBorder: "border-rose-400/80",     activeBg: "bg-rose-500/20",     activeShadow: "shadow-[0_0_10px_rgba(251,113,133,0.25)]"  },
  big_object:   { label: "🧸 大物",    color: "text-pink-200",    activeBorder: "border-pink-400/80",     activeBg: "bg-pink-500/20",     activeShadow: "shadow-[0_0_10px_rgba(244,114,182,0.25)]"  },
  vehicle:      { label: "乗り物",     color: "text-orange-200",  activeBorder: "border-orange-400/80",   activeBg: "bg-orange-500/20",   activeShadow: "shadow-[0_0_10px_rgba(251,146,60,0.25)]"   },
  myth:         { label: "神話/幻獣",  color: "text-amber-200",   activeBorder: "border-amber-400/80",    activeBg: "bg-amber-500/20",    activeShadow: "shadow-[0_0_10px_rgba(251,191,36,0.25)]"   },
  lighting:     { label: "照明",       color: "text-yellow-100",  activeBorder: "border-yellow-400/80",   activeBg: "bg-yellow-500/20",   activeShadow: "shadow-[0_0_10px_rgba(234,179,8,0.25)]"    },
  aspect_ratio: { label: "比率",       color: "text-indigo-200",  activeBorder: "border-indigo-400/80",   activeBg: "bg-indigo-500/20",   activeShadow: "shadow-[0_0_10px_rgba(99,102,241,0.25)]"   },
};

// ─── Background scene presets ─────────────────────────────────────────────────

const BG_SCENE_PRESETS: Array<{
  id: string;
  label: string;
  patch: Partial<DetailSettings["background"]>;
}> = [
  {
    id: "skip", label: "設定なし",
    patch: { place: "skip", color: "skip", density: "skip", effect: "skip", time: "skip", weather: "skip", depth: "skip", info: "skip", style: "skip" },
  },
  {
    id: "auto", label: "おまかせ",
    patch: { place: "auto", color: "auto", density: "auto", effect: "auto", time: "auto", weather: "auto", depth: "auto", info: "auto", style: "auto" },
  },
  {
    id: "sns", label: "SNS映え",
    patch: { place: "indoor", color: "pink", density: "normal", effect: "particles", time: "golden_hour", weather: "clear", depth: "shallow", info: "balanced", style: "skip" },
  },
  {
    id: "neo_future", label: "近未来ネオン",
    patch: { place: "futuristic", color: "blue", density: "dense", effect: "glitch", time: "night", weather: "clear", depth: "moderate", info: "rich", style: "cyber" },
  },
  {
    id: "japanese", label: "和風幻想",
    patch: { place: "nature", color: "inherit", density: "normal", effect: "fog", time: "golden_hour", weather: "foggy", depth: "moderate", info: "balanced", style: "skip" },
  },
  {
    id: "cool_alley", label: "クール路地",
    patch: { place: "alley", color: "monochrome", density: "normal", effect: "reflection", time: "night", weather: "rainy", depth: "shallow", info: "balanced", style: "photorealistic" },
  },
  {
    id: "white_bg", label: "白背景",
    patch: { place: "studio", color: "white", density: "minimal", effect: "auto", time: "noon", weather: "clear", depth: "moderate", info: "sparse", style: "simple" },
  },
  {
    id: "black_bg", label: "黒背景",
    patch: { place: "studio", color: "black", density: "minimal", effect: "auto", time: "midnight", weather: "clear", depth: "moderate", info: "sparse", style: "simple" },
  },
  {
    id: "flower", label: "花背景",
    patch: { place: "nature", color: "pastel", density: "dense", effect: "particles", time: "morning", weather: "clear", depth: "shallow", info: "rich", style: "skip" },
  },
  {
    id: "cyber", label: "サイバー空間",
    patch: { place: "abstract", color: "blue", density: "dense", effect: "geometric", time: "night", weather: "clear", depth: "deep", info: "rich", style: "digital" },
  },
  {
    id: "luxe", label: "シンプル高級感",
    patch: { place: "museum", color: "inherit", density: "minimal", effect: "reflection", time: "noon", weather: "clear", depth: "moderate", info: "balanced", style: "simple" },
  },
  // ── 絵画・アート・素材系プリセット ─────────────────────────────────────────
  {
    id: "watercolor_bg", label: "水彩画風",
    patch: { place: "empty_space", color: "pastel", density: "minimal", effect: "watercolor_bleed", time: "morning", weather: "clear", depth: "shallow", info: "sparse", style: "watercolor" },
  },
  {
    id: "ink_wash_bg", label: "水墨画風",
    patch: { place: "empty_space", color: "monochrome", density: "minimal", effect: "ink_bleed", time: "noon", weather: "clear", depth: "moderate", info: "sparse", style: "ink_wash" },
  },
  {
    id: "modern_art_bg", label: "現代アート",
    patch: { place: "gallery", color: "inherit", density: "minimal", effect: "abstract_lines", time: "noon", weather: "clear", depth: "moderate", info: "balanced", style: "modern_art" },
  },
  {
    id: "contemporary_art_bg", label: "近代アート",
    patch: { place: "museum", color: "inherit", density: "minimal", effect: "color_planes", time: "noon", weather: "clear", depth: "moderate", info: "balanced", style: "contemporary_art" },
  },
  {
    id: "abstract_art_bg", label: "抽象アート",
    patch: { place: "abstract", color: "vivid", density: "normal", effect: "brushstroke", time: "noon", weather: "clear", depth: "moderate", info: "rich", style: "abstract_art" },
  },
  {
    id: "minimal_bg", label: "ミニマル背景",
    patch: { place: "studio", color: "light", density: "minimal", effect: "auto", time: "noon", weather: "clear", depth: "moderate", info: "sparse", style: "minimal" },
  },
  {
    id: "paper_bg", label: "紙質感背景",
    patch: { place: "paper_backdrop", color: "beige", density: "minimal", effect: "paper_texture", time: "noon", weather: "clear", depth: "moderate", info: "sparse", style: "washi" },
  },
  {
    id: "fabric_bg", label: "布背景",
    patch: { place: "fabric_backdrop", color: "inherit", density: "minimal", effect: "auto", time: "noon", weather: "clear", depth: "moderate", info: "sparse", style: "simple" },
  },
  {
    id: "gallery_bg", label: "ギャラリー背景",
    patch: { place: "gallery", color: "white", density: "minimal", effect: "reflection", time: "noon", weather: "clear", depth: "moderate", info: "balanced", style: "simple" },
  },
  {
    id: "natural_light_bg", label: "自然光背景",
    patch: { place: "studio", color: "light", density: "minimal", effect: "auto", time: "morning", weather: "clear", depth: "shallow", info: "sparse", style: "photorealistic" },
  },
];

// ─── Lighting presets ──────────────────────────────────────────────────────────

const LIGHTING_PRESETS: Array<{
  id: string;
  label: string;
  patch: Partial<DetailSettings["lighting"]>;
}> = [
  { id: "skip",         label: "設定なし",    patch: { direction: "skip",           intensity: "skip",       temperature: "skip",         shadow: "skip",    reflection: "skip",          atmosphere: "skip"        } },
  { id: "auto",         label: "おまかせ",    patch: { direction: "auto",           intensity: "auto",       temperature: "auto",         shadow: "auto",    reflection: "auto",          atmosphere: "auto"        } },
  { id: "rim_back",     label: "リム逆光",    patch: { direction: "rim",            intensity: "dramatic",   temperature: "cool",         shadow: "sharp",   reflection: "specular",      atmosphere: "clear"       } },
  { id: "neon_fog",     label: "ネオン霧",    patch: { direction: "multi",          intensity: "pale_glow",  temperature: "blue_tone",    shadow: "soft",    reflection: "glossy",        atmosphere: "hazy"        } },
  { id: "drama",        label: "ドラマ照明",  patch: { direction: "side",           intensity: "dramatic",   temperature: "warm",         shadow: "deep",    reflection: "satin",         atmosphere: "dusty"       } },
  { id: "natural",      label: "自然光",      patch: { direction: "diagonal_above", intensity: "soft",       temperature: "warm",         shadow: "soft",    reflection: "satin",         atmosphere: "clear"       } },
  { id: "studio",       label: "スタジオ",    patch: { direction: "front",          intensity: "normal",     temperature: "white_light",  shadow: "minimal", reflection: "matte",         atmosphere: "clear"       } },
  { id: "sunset_back",  label: "夕日逆光",    patch: { direction: "back",           intensity: "soft_backlight", temperature: "sunset",   shadow: "long",    reflection: "glossy",        atmosphere: "hazy"        } },
];

function activeLightPresetId(lt: DetailSettings["lighting"], mo?: Record<string, string[]>): string | null {
  // multi-overrides が活きていたらプリセットなし
  const lightingMo = Object.keys(mo ?? {}).filter((k) => k.startsWith("lighting."));
  if (lightingMo.length > 0) return null;
  for (const p of LIGHTING_PRESETS) {
    if (
      lt.direction   === p.patch.direction   &&
      lt.intensity   === p.patch.intensity   &&
      lt.temperature === p.patch.temperature &&
      lt.shadow      === p.patch.shadow      &&
      lt.reflection  === p.patch.reflection  &&
      lt.atmosphere  === p.patch.atmosphere
    ) return p.id;
  }
  return null;
}

// ─── Camera presets ────────────────────────────────────────────────────────────

const CAMERA_PRESETS: Array<{
  id: string;
  label: string;
  patch: Partial<DetailSettings["camera"]>;
}> = [
  { id: "skip",           label: "設定なし",      patch: { angle: "skip",        distance: "skip",     lens: "skip",       composition: "skip",           fov: "skip",              eyeHeight: "skip",       custom3D: null } },
  { id: "auto",           label: "おまかせ",      patch: { angle: "auto",        distance: "auto",     lens: "auto",       composition: "auto",           fov: "auto",              eyeHeight: "auto",       custom3D: null } },
  { id: "full_sns",       label: "全身縦長SNS",   patch: { angle: "front",       distance: "far",      lens: "normal",     composition: "centered",       fov: "vertical_sns",      eyeHeight: "eye_level",  custom3D: null } },
  { id: "bust_portrait",  label: "バストアップ縦", patch: { angle: "diagonal_45", distance: "bust_up",  lens: "portrait",   composition: "rule_of_thirds", fov: "vertical_sns",      eyeHeight: "eye_level",  custom3D: null } },
  { id: "overhead_full",  label: "見下ろし全身",  patch: { angle: "high",        distance: "far",      lens: "wide",       composition: "centered",       fov: "standard",          eyeHeight: "auto",       custom3D: null } },
  { id: "cinema_wide",    label: "シネマ横長",    patch: { angle: "cinematic",   distance: "medium",   lens: "cinema",     composition: "rule_of_thirds", fov: "horizontal_cinema", eyeHeight: "eye_level",  custom3D: null } },
  { id: "face_close",     label: "顔アップ接近",  patch: { angle: "front",       distance: "close",    lens: "portrait",   composition: "centered",       fov: "standard",          eyeHeight: "eye_level",  custom3D: null } },
];

function activeCameraPresetId(cam: DetailSettings["camera"], mo?: Record<string, string[]>): string | null {
  if (cam.custom3D) return null;
  const cameraMo = Object.keys(mo ?? {}).filter((k) => k.startsWith("camera."));
  if (cameraMo.length > 0) return null;
  for (const p of CAMERA_PRESETS) {
    if (
      cam.angle       === p.patch.angle       &&
      cam.distance    === p.patch.distance    &&
      cam.lens        === p.patch.lens        &&
      cam.composition === p.patch.composition &&
      cam.fov         === p.patch.fov         &&
      cam.eyeHeight   === p.patch.eyeHeight
    ) return p.id;
  }
  return null;
}

function activeBgPresetId(bg: DetailSettings["background"]): string | null {
  for (const p of BG_SCENE_PRESETS) {
    if (
      bg.place   === p.patch.place   &&
      bg.color   === p.patch.color   &&
      bg.density === p.patch.density &&
      bg.effect  === p.patch.effect  &&
      bg.time    === p.patch.time    &&
      bg.weather === p.patch.weather &&
      bg.depth   === p.patch.depth   &&
      bg.info    === p.patch.info    &&
      (bg.style ?? "skip") === (p.patch.style ?? "skip")
    ) return p.id;
  }
  return null;
}

// ─── FieldSection ─────────────────────────────────────────────────────────────

function FieldSection({
  label,
  value,
  options,
  onChange,
  noTopMargin = false,
}: {
  label: string;
  value: string;
  options: PresetItem[];
  onChange: (v: string) => void;
  noTopMargin?: boolean;
}) {
  return (
    <div>
      <CellSectionLabel label={label} noTopMargin={noTopMargin} />
      <CellGrid>
        <GridCell
          jaLabel="設定なし"
          active={value === "skip"}
          cellKind="skip"
          onClick={() => onChange("skip")}
        />
        <GridCell
          jaLabel="おまかせ"
          active={value === "auto"}
          cellKind="auto"
          onClick={() => onChange("auto")}
        />
        {options.map((opt) => (
          <GridCell
            key={opt.id}
            jaLabel={opt.label}
            active={value === opt.id}
            cellKind="value"
            title={opt.ja}
            onClick={() => onChange(value === opt.id ? "skip" : opt.id)}
          />
        ))}
      </CellGrid>
    </div>
  );
}

// ─── MultiFieldSection ────────────────────────────────────────────────────────
// 最大 maxSelect 個まで複数選択できる FieldSection。
// singleValue: DetailSettings のフィールド値（単独選択・auto・skip のいずれか）
// multiValues: multiOverrides[fieldKey] の値（2個以上のとき存在）
// onChange(single, multi):
//   single = 代表値（先頭 or "skip" or "auto"）
//   multi  = 全選択配列（2個以上のとき）または []（単独 or 特殊値）

function MultiFieldSection({
  label,
  singleValue,
  multiValues,
  options,
  onChange,
  noTopMargin = false,
  maxSelect = 3,
}: {
  label: string;
  singleValue: string;
  multiValues: string[];
  options: PresetItem[];
  onChange: (single: string, multi: string[]) => void;
  noTopMargin?: boolean;
  maxSelect?: number;
}) {
  // 有効な選択セット: multiValues が 2+ ならそれ、
  // そうでなければ singleValue から1個分を導出
  const activeSet =
    multiValues.length >= 2
      ? multiValues
      : singleValue !== "skip" && singleValue !== "auto"
      ? [singleValue]
      : [];

  const isSkip = singleValue === "skip" && multiValues.length === 0;
  const isAuto = singleValue === "auto" && multiValues.length === 0;

  const handleToggle = (id: string) => {
    const idx = activeSet.indexOf(id);
    if (idx >= 0) {
      // 選択解除
      const next = activeSet.filter((_, i) => i !== idx);
      if (next.length === 0) {
        onChange("skip", []);
      } else {
        onChange(next[0], next.length >= 2 ? next : []);
      }
    } else {
      // 選択追加
      let next: string[];
      if (activeSet.length >= maxSelect) {
        next = [...activeSet.slice(1), id]; // FIFO: 最古を除去
      } else {
        next = [...activeSet, id];
      }
      onChange(next[0], next.length >= 2 ? next : []);
    }
  };

  return (
    <div>
      <CellSectionLabel
        label={label}
        noTopMargin={noTopMargin}
        count={activeSet.length > 0 ? activeSet.length : undefined}
        maxCount={maxSelect}
      />
      <CellGrid>
        <GridCell
          jaLabel="設定なし"
          active={isSkip}
          cellKind="skip"
          onClick={() => onChange("skip", [])}
        />
        <GridCell
          jaLabel="おまかせ"
          active={isAuto}
          cellKind="auto"
          onClick={() => onChange("auto", [])}
        />
        {options.map((opt) => (
          <GridCell
            key={opt.id}
            jaLabel={opt.label}
            active={activeSet.includes(opt.id)}
            cellKind="value"
            title={opt.ja}
            onClick={() => handleToggle(opt.id)}
          />
        ))}
      </CellGrid>
    </div>
  );
}

// ─── Camera 3-D toggle ────────────────────────────────────────────────────────

function Camera3DToggleSlot({
  value,
  onChange,
}: {
  value: Camera3DState | null;
  onChange: (next: Camera3DState | null) => void;
}) {
  const [open, setOpen] = useState(!!value);
  const summary = value ? describeCameraAngle(value) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={[
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all leading-none font-medium",
            value
              ? "bg-gradient-to-b from-violet-600/45 to-blue-700/35 border-violet-400/80 shadow-[0_0_10px_rgba(139,92,246,0.35)] text-white"
              : "bg-[#171b2c] border-[#252e44] text-text-muted/80 hover:bg-[#1e2338] hover:border-[#354060] hover:text-text-base",
          ].join(" ")}
        >
          {value && <span className="text-violet-300 text-[10px]">✓</span>}
          🎥 3Dで角度調整{value ? "（指定中）" : ""}
        </button>
        {summary && (
          <span className="text-[11px] text-text-muted/55 truncate max-w-[200px]">
            {summary}
          </span>
        )}
      </div>
      {open && (
        <Suspense
          fallback={
            <div className="rounded-xl border border-bg-border bg-bg-panel/40 h-[280px] grid place-items-center text-xs text-text-muted">
              3D ビューア読み込み中…
            </div>
          }
        >
          <Camera3DPicker value={value} onChange={onChange} />
        </Suspense>
      )}
    </div>
  );
}

// ─── Per-scope content ────────────────────────────────────────────────────────

/**
 * multiOverrides を出し入れしつつ単一値も更新する共通クロージャ。
 * 各 *Content にコピペされていた mc を集約（scope キーだけ差し替え）。
 */
function makeMultiChanger(
  d: DetailSettings,
  chg: (n: DetailSettings) => void,
  scope: "hair" | "outfit" | "camera" | "myth" | "lighting" | "cyber" | "background" | "props" | "pose" | "bigObject" | "vehicle" | "foreground" | "cosplay",
) {
  return (fieldKey: string, field: string) => (single: string, multi: string[]) => {
    const mo = { ...(d.multiOverrides ?? {}) };
    if (multi.length < 2) delete mo[fieldKey]; else mo[fieldKey] = multi;
    chg({
      ...d,
      [scope]: { ...(d[scope] as any), [field]: single as any },
      multiOverrides: Object.keys(mo).length > 0 ? mo : undefined,
    } as DetailSettings);
  };
}

function HairContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "hair");
  return (
    <div>
      <FieldSection label="スタイル系統" value={d.hair.hairStyle ?? "skip"} options={HAIR_STYLES} noTopMargin
        onChange={(v) => upd("hair", { hairStyle: v as DetailSettings["hair"]["hairStyle"] })} />
      <FieldSection label="長さ" value={d.hair.length} options={HAIR_LENGTHS}
        onChange={(v) => upd("hair", { length: v as DetailSettings["hair"]["length"] })} />
      <MultiFieldSection label="形" singleValue={d.hair.shape} multiValues={d.multiOverrides?.["hair.shape"] ?? []} options={HAIR_SHAPES}
        onChange={mc("hair.shape", "shape")} />
      <MultiFieldSection label="髪色" singleValue={d.hair.color} multiValues={d.multiOverrides?.["hair.color"] ?? []} options={HAIR_COLORS}
        onChange={mc("hair.color", "color")} />
      <MultiFieldSection label="質感" singleValue={d.hair.texture} multiValues={d.multiOverrides?.["hair.texture"] ?? []} options={HAIR_TEXTURES}
        onChange={mc("hair.texture", "texture")} />
      <FieldSection label="カラーモード" value={d.hair.colorMode} options={HAIR_COLOR_MODES}
        onChange={(v) => upd("hair", { colorMode: v as DetailSettings["hair"]["colorMode"] })} />
      <FieldSection label="前髪" value={d.hair.bangs} options={HAIR_BANGS}
        onChange={(v) => upd("hair", { bangs: v as DetailSettings["hair"]["bangs"] })} />
      <MultiFieldSection label="毛先" singleValue={d.hair.tips} multiValues={d.multiOverrides?.["hair.tips"] ?? []} options={HAIR_TIPS}
        onChange={mc("hair.tips", "tips")} />
      <FieldSection label="ボリューム" value={d.hair.volume} options={HAIR_VOLUMES}
        onChange={(v) => upd("hair", { volume: v as DetailSettings["hair"]["volume"] })} />
      <MultiFieldSection label="アクセサリー" singleValue={d.hair.accessory} multiValues={d.multiOverrides?.["hair.accessory"] ?? []} options={HAIR_ACCESSORIES}
        onChange={mc("hair.accessory", "accessory")} />
    </div>
  );
}

function OutfitContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "outfit");
  return (
    <div>
      <MultiFieldSection label="系統" singleValue={d.outfit.style} multiValues={d.multiOverrides?.["outfit.style"] ?? []} options={OUTFIT_STYLES} noTopMargin
        onChange={mc("outfit.style", "style")} />
      <MultiFieldSection label="色方向" singleValue={d.outfit.color} multiValues={d.multiOverrides?.["outfit.color"] ?? []} options={OUTFIT_COLORS}
        onChange={mc("outfit.color", "color")} />
      <MultiFieldSection label="素材" singleValue={d.outfit.material} multiValues={d.multiOverrides?.["outfit.material"] ?? []} options={OUTFIT_MATERIALS}
        onChange={mc("outfit.material", "material")} />
      <MultiFieldSection label="シルエット" singleValue={d.outfit.silhouette} multiValues={d.multiOverrides?.["outfit.silhouette"] ?? []} options={OUTFIT_SILHOUETTES}
        onChange={mc("outfit.silhouette", "silhouette")} />
      <FieldSection label="露出" value={d.outfit.exposure} options={OUTFIT_EXPOSURES}
        onChange={(v) => upd("outfit", { exposure: v as DetailSettings["outfit"]["exposure"] })} />
      <FieldSection label="装飾量" value={d.outfit.decoration} options={OUTFIT_DECORATIONS}
        onChange={(v) => upd("outfit", { decoration: v as DetailSettings["outfit"]["decoration"] })} />
      <FieldSection label="季節感" value={d.outfit.season} options={OUTFIT_SEASONS}
        onChange={(v) => upd("outfit", { season: v as DetailSettings["outfit"]["season"] })} />
      <FieldSection label="高級感" value={d.outfit.luxury} options={OUTFIT_LUXURIES}
        onChange={(v) => upd("outfit", { luxury: v as DetailSettings["outfit"]["luxury"] })} />
    </div>
  );
}

function BackgroundContent({ d, upd, chg }: {
  d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void;
}) {
  const activeId = activeBgPresetId(d.background);
  const textActive =
    d.background.textType !== "skip" ||
    d.background.textMood !== "skip" ||
    d.background.textLayout !== "skip" ||
    d.background.textTexture !== "skip";
  const [textOpen, setTextOpen] = useState(textActive);
  const mc = makeMultiChanger(d, chg, "background");
  return (
    <div>
      {/* Scene preset grid */}
      <CellSectionLabel label="プリセット" noTopMargin />
      <CellGrid>
        {BG_SCENE_PRESETS.map((p) => (
          <GridCell
            key={p.id}
            jaLabel={p.label}
            active={activeId === p.id}
            cellKind={p.id === "skip" ? "skip" : p.id === "auto" ? "auto" : "value"}
            onClick={() => upd("background", p.patch)}
          />
        ))}
      </CellGrid>
      {/* Individual field grids */}
      <MultiFieldSection label="背景スタイル" singleValue={d.background.style ?? "skip"} multiValues={d.multiOverrides?.["background.style"] ?? []} options={BG_STYLES}
        onChange={mc("background.style", "style")} />
      <MultiFieldSection label="場所" singleValue={d.background.place} multiValues={d.multiOverrides?.["background.place"] ?? []} options={BG_PLACES}
        onChange={(single, multi) => {
          const mo = { ...(d.multiOverrides ?? {}) };
          if (multi.length < 2) delete mo["background.place"]; else mo["background.place"] = multi;
          chg({ ...d, background: { ...d.background, place: single as DetailSettings["background"]["place"] }, multiOverrides: Object.keys(mo).length > 0 ? mo : undefined });
        }} />
      <MultiFieldSection label="色" singleValue={d.background.color} multiValues={d.multiOverrides?.["background.color"] ?? []} options={BG_COLORS}
        onChange={mc("background.color", "color")} />
      <FieldSection label="時間帯" value={d.background.time} options={BG_TIMES}
        onChange={(v) => upd("background", { time: v as DetailSettings["background"]["time"] })} />
      <FieldSection label="天候" value={d.background.weather} options={BG_WEATHERS}
        onChange={(v) => upd("background", { weather: v as DetailSettings["background"]["weather"] })} />
      <FieldSection label="密度" value={d.background.density} options={BG_DENSITIES}
        onChange={(v) => upd("background", { density: v as DetailSettings["background"]["density"] })} />
      <MultiFieldSection label="空間効果" singleValue={d.background.effect} multiValues={d.multiOverrides?.["background.effect"] ?? []} options={BG_EFFECTS}
        onChange={mc("background.effect", "effect")} />
      <FieldSection label="奥行き" value={d.background.depth} options={BG_DEPTHS}
        onChange={(v) => upd("background", { depth: v as DetailSettings["background"]["depth"] })} />
      <FieldSection label="情報量" value={d.background.info} options={BG_INFOS}
        onChange={(v) => upd("background", { info: v as DetailSettings["background"]["info"] })} />
      {/* 文字背景 / 書（アコーディオン） */}
      <div className="mt-3 pt-2.5 border-t border-white/8">
        <button
          type="button"
          onClick={() => setTextOpen((v) => !v)}
          className={[
            "inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all leading-none",
            textOpen
              ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
              : textActive
                ? "border-emerald-400/40 bg-emerald-500/8 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                : "border-bg-border/50 bg-transparent text-text-muted/60 hover:text-text-muted hover:border-bg-border/80",
          ].join(" ")}
        >
          {textOpen ? "▲" : "▼"}
          &nbsp;文字背景 / 書
          {textActive && !textOpen && (
            <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/50 text-[9px] font-black text-white leading-none">
              ●
            </span>
          )}
        </button>
      </div>
      {textOpen && (
        <div className="mt-1 pl-1 border-l-2 border-emerald-500/20">
          <FieldSection label="文字の種類" value={d.background.textType} options={BG_TEXT_TYPES} noTopMargin
            onChange={(v) => upd("background", { textType: v as DetailSettings["background"]["textType"] })} />
          <FieldSection label="雰囲気" value={d.background.textMood} options={BG_TEXT_MOODS}
            onChange={(v) => upd("background", { textMood: v as DetailSettings["background"]["textMood"] })} />
          <FieldSection label="配置" value={d.background.textLayout} options={BG_TEXT_LAYOUTS}
            onChange={(v) => upd("background", { textLayout: v as DetailSettings["background"]["textLayout"] })} />
          <FieldSection label="質感" value={d.background.textTexture} options={BG_TEXT_TEXTURES}
            onChange={(v) => upd("background", { textTexture: v as DetailSettings["background"]["textTexture"] })} />
        </div>
      )}
    </div>
  );
}

function PoseContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "pose");
  return (
    <div>
      <FieldSection label="種類" value={d.pose.type} options={POSE_TYPES} noTopMargin
        onChange={(v) => upd("pose", { type: v as DetailSettings["pose"]["type"] })} />
      <MultiFieldSection label="印象" singleValue={d.pose.impression} multiValues={d.multiOverrides?.["pose.impression"] ?? []} options={POSE_IMPRESSIONS}
        onChange={mc("pose.impression", "impression")} />
      <FieldSection label="視線" value={d.pose.gaze} options={POSE_GAZES}
        onChange={(v) => upd("pose", { gaze: v as DetailSettings["pose"]["gaze"] })} />
      <MultiFieldSection label="手の位置" singleValue={d.pose.hand} multiValues={d.multiOverrides?.["pose.hand"] ?? []} options={POSE_HANDS}
        onChange={mc("pose.hand", "hand")} />
      <MultiFieldSection label="足の位置" singleValue={d.pose.foot} multiValues={d.multiOverrides?.["pose.foot"] ?? []} options={POSE_FEET}
        onChange={mc("pose.foot", "foot")} />
      <FieldSection label="重心" value={d.pose.balance} options={POSE_BALANCES}
        onChange={(v) => upd("pose", { balance: v as DetailSettings["pose"]["balance"] })} />
      <MultiFieldSection label="動き" singleValue={d.pose.motion} multiValues={d.multiOverrides?.["pose.motion"] ?? []} options={POSE_MOTIONS}
        onChange={mc("pose.motion", "motion")} />
      <FieldSection label="体の向き" value={d.pose.orientation} options={POSE_ORIENTATIONS}
        onChange={(v) => upd("pose", { orientation: v as DetailSettings["pose"]["orientation"] })} />
    </div>
  );
}

function CameraContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "camera");
  const activePresetId = activeCameraPresetId(d.camera, d.multiOverrides);
  return (
    <div>
      {/* 人物サイズ維持の注意（豆粒化防止） */}
      <p className="text-[11px] text-amber-200/80 px-1 pb-1.5 leading-snug">
        📐 カメラを変えても人物は元画像に近い大きさを維持します。「遠景許可（超遠距離）」「超広角」「俯瞰＋頭上」の組み合わせは人物が小さくなりやすいので注意。全身構図でも画面内で十分大きく見える距離を優先します。
      </p>
      {/* カメラプリセット */}
      <CellSectionLabel label="プリセット" noTopMargin />
      <CellGrid>
        {CAMERA_PRESETS.map((p) => (
          <GridCell
            key={p.id}
            jaLabel={p.label}
            active={activePresetId === p.id}
            cellKind={p.id === "skip" ? "skip" : p.id === "auto" ? "auto" : "value"}
            onClick={() => {
              const moNext = Object.fromEntries(
                Object.entries(d.multiOverrides ?? {}).filter(([k]) => !k.startsWith("camera."))
              );
              chg({
                ...d,
                camera: { ...d.camera, ...p.patch },
                multiOverrides: Object.keys(moNext).length > 0 ? moNext : undefined,
              });
            }}
          />
        ))}
      </CellGrid>
      <div className={d.camera.custom3D ? "opacity-40 pointer-events-none select-none" : ""}>
      {d.camera.custom3D && (
        <p className="text-[11px] text-cyan-200/80 px-1 pt-2 pb-0.5 leading-snug">
          🎥 3D指定中：角度・距離・レンズ・構図・画角・視点高さは3Dピッカーが優先します（解除はプリセット「設定なし／おまかせ」で）。
        </p>
      )}
      <MultiFieldSection label="角度" singleValue={d.camera.angle} multiValues={d.multiOverrides?.["camera.angle"] ?? []} options={CAMERA_ANGLES}
        onChange={mc("camera.angle", "angle")} />
      <MultiFieldSection label="距離" singleValue={d.camera.distance} multiValues={d.multiOverrides?.["camera.distance"] ?? []} options={CAMERA_DISTANCES}
        onChange={mc("camera.distance", "distance")} />
      <MultiFieldSection label="レンズ感" singleValue={d.camera.lens} multiValues={d.multiOverrides?.["camera.lens"] ?? []} options={CAMERA_LENSES}
        onChange={mc("camera.lens", "lens")} />
      <MultiFieldSection label="構図" singleValue={d.camera.composition} multiValues={d.multiOverrides?.["camera.composition"] ?? []} options={CAMERA_COMPOSITIONS}
        onChange={mc("camera.composition", "composition")} />
      <FieldSection label="画角" value={d.camera.fov} options={CAMERA_FOVS}
        onChange={(v) => upd("camera", { fov: v as DetailSettings["camera"]["fov"] })} />
      <FieldSection label="視点高さ" value={d.camera.eyeHeight} options={CAMERA_EYE_HEIGHTS}
        onChange={(v) => upd("camera", { eyeHeight: v as DetailSettings["camera"]["eyeHeight"] })} />
      </div>
      <div>
        <CellSectionLabel label="3D指定" />
        <Camera3DToggleSlot
          value={d.camera.custom3D}
          onChange={(next) =>
            upd("camera", next
              ? { custom3D: next, lens: "skip", fov: "skip", composition: "skip" }
              : { custom3D: next })
          }
        />
      </div>
    </div>
  );
}

function PropsContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "props");
  return (
    <div>
      <MultiFieldSection label="カテゴリ" singleValue={d.props.category} multiValues={d.multiOverrides?.["props.category"] ?? []} options={PROPS_CATEGORIES} noTopMargin
        onChange={(single, multi) => {
          const mo = { ...(d.multiOverrides ?? {}) };
          if (multi.length < 2) delete mo["props.category"]; else mo["props.category"] = multi;
          chg({ ...d, props: { ...d.props, category: single as DetailSettings["props"]["category"] }, multiOverrides: Object.keys(mo).length > 0 ? mo : undefined });
        }} />
      <MultiFieldSection label="持たせ方" singleValue={d.props.hold} multiValues={d.multiOverrides?.["props.hold"] ?? []} options={PROPS_HOLDS}
        onChange={mc("props.hold", "hold")} />
      <FieldSection label="サイズ" value={d.props.size} options={PROPS_SIZES}
        onChange={(v) => upd("props", { size: v as DetailSettings["props"]["size"] })} />
      <FieldSection label="光り方" value={d.props.glow} options={PROPS_GLOWS}
        onChange={(v) => upd("props", { glow: v as DetailSettings["props"]["glow"] })} />
      <MultiFieldSection label="雰囲気" singleValue={d.props.vibe} multiValues={d.multiOverrides?.["props.vibe"] ?? []} options={PROPS_VIBES}
        onChange={mc("props.vibe", "vibe")} />
      <MultiFieldSection label="配置" singleValue={d.props.placement} multiValues={d.multiOverrides?.["props.placement"] ?? []} options={PROPS_PLACEMENTS}
        onChange={mc("props.placement", "placement")} />
      <FieldSection label="個数" value={d.props.count} options={PROPS_COUNTS}
        onChange={(v) => upd("props", { count: v as DetailSettings["props"]["count"] })} />
    </div>
  );
}

function BigObjectContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const genreGroups: Array<{ label: string; ids: string[] }> = [
    { label: "綺麗・上品系", ids: ["clean", "luxury_display", "art", "mystic_display"] },
    { label: "壊れ・異物系", ids: ["foreign", "broken", "ruins", "creepy_cute", "retro_foreign"] },
    { label: "映画・超現実系", ids: ["movie_prop", "surreal", "lab"] },
  ];
  const MAX_GENRE = 3;
  const genreMulti = d.multiOverrides?.["bigObject.genre"] ?? [];
  const genreActiveSet = genreMulti.length >= 2
    ? genreMulti
    : d.bigObject.genre !== "skip" && d.bigObject.genre !== "auto"
    ? [d.bigObject.genre]
    : [];
  const genreIsSkip = d.bigObject.genre === "skip" && genreMulti.length === 0;
  const genreIsAuto = d.bigObject.genre === "auto" && genreMulti.length === 0;

  const toggleGenre = (id: string) => {
    const idx = genreActiveSet.indexOf(id);
    let next: string[];
    if (idx >= 0) {
      next = genreActiveSet.filter((_, i) => i !== idx);
    } else {
      next = genreActiveSet.length >= MAX_GENRE
        ? [...genreActiveSet.slice(1), id]
        : [...genreActiveSet, id];
    }
    const single = next.length === 0 ? "skip" : next[0];
    const mo = { ...(d.multiOverrides ?? {}) };
    if (next.length < 2) delete mo["bigObject.genre"]; else mo["bigObject.genre"] = next;
    chg({ ...d, bigObject: { ...d.bigObject, genre: single as DetailSettings["bigObject"]["genre"] }, multiOverrides: Object.keys(mo).length > 0 ? mo : undefined });
  };

  const mc = makeMultiChanger(d, chg, "bigObject");
  return (
    <div>
      {/* 系統（グループ分け表示） */}
      <div>
        <CellSectionLabel label="系統" noTopMargin
          count={genreActiveSet.length > 0 ? genreActiveSet.length : undefined}
          maxCount={MAX_GENRE}
        />
        <CellGrid>
          <GridCell
            jaLabel="設定なし"
            active={genreIsSkip}
            cellKind="skip"
            onClick={() => {
              const mo = { ...(d.multiOverrides ?? {}) };
              delete mo["bigObject.genre"];
              chg({ ...d, bigObject: { ...d.bigObject, genre: "skip" as DetailSettings["bigObject"]["genre"] }, multiOverrides: Object.keys(mo).length > 0 ? mo : undefined });
            }}
          />
          <GridCell
            jaLabel="おまかせ"
            active={genreIsAuto}
            cellKind="auto"
            onClick={() => {
              const mo = { ...(d.multiOverrides ?? {}) };
              delete mo["bigObject.genre"];
              chg({ ...d, bigObject: { ...d.bigObject, genre: "auto" as DetailSettings["bigObject"]["genre"] }, multiOverrides: Object.keys(mo).length > 0 ? mo : undefined });
            }}
          />
        </CellGrid>
        {genreGroups.map((group) => {
          const items = BIG_OBJECT_GENRES.filter((g) => group.ids.includes(g.id));
          return (
            <div key={group.label}>
              <div className="mt-2 mb-1 text-[10px] text-text-muted/50 font-semibold tracking-wide px-0.5">
                ── {group.label}
              </div>
              <CellGrid>
                {items.map((opt) => (
                  <GridCell
                    key={opt.id}
                    jaLabel={opt.label}
                    active={genreActiveSet.includes(opt.id)}
                    cellKind="value"
                    title={opt.ja}
                    onClick={() => toggleGenre(opt.id)}
                  />
                ))}
              </CellGrid>
            </div>
          );
        })}
      </div>
      <FieldSection label="種類" value={d.bigObject.type} options={BIG_OBJECT_TYPES}
        onChange={(v) => upd("bigObject", { type: v as DetailSettings["bigObject"]["type"] })} />
      <MultiFieldSection label="状態" singleValue={d.bigObject.condition} multiValues={d.multiOverrides?.["bigObject.condition"] ?? []} options={BIG_OBJECT_CONDITIONS}
        onChange={mc("bigObject.condition", "condition")} />
      <FieldSection label="配置" value={d.bigObject.placement} options={BIG_OBJECT_PLACEMENTS}
        onChange={(v) => upd("bigObject", { placement: v as DetailSettings["bigObject"]["placement"] })} />
      <FieldSection label="サイズ" value={d.bigObject.size} options={BIG_OBJECT_SIZES}
        onChange={(v) => upd("bigObject", { size: v as DetailSettings["bigObject"]["size"] })} />
      <MultiFieldSection label="雰囲気" singleValue={d.bigObject.mood} multiValues={d.multiOverrides?.["bigObject.mood"] ?? []} options={BIG_OBJECT_MOODS}
        onChange={mc("bigObject.mood", "mood")} />
    </div>
  );
}

function VehicleContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "vehicle");
  return (
    <div>
      {/* 安全ルール注記 */}
      <div className="mb-3 rounded-xl border border-orange-400/25 bg-orange-500/8 px-3 py-2 text-[11px] text-orange-200/70 leading-relaxed">
        🚗 <span className="text-orange-200/90 font-semibold">人物が主役</span>、乗り物は脇役。乗り物のジャンル・種類の順に選ぶと絞り込めます。ミリタリーは展示・停止状態のみ。
      </div>
      <FieldSection label="ジャンル" value={d.vehicle.genre} options={VEHICLE_GENRES} noTopMargin
        onChange={(v) => upd("vehicle", { genre: v as DetailSettings["vehicle"]["genre"] })} />
      <FieldSection label="種類" value={d.vehicle.type} options={VEHICLE_TYPES}
        onChange={(v) => upd("vehicle", { type: v as DetailSettings["vehicle"]["type"] })} />
      <FieldSection label="関わり方" value={d.vehicle.interaction} options={VEHICLE_INTERACTIONS}
        onChange={(v) => upd("vehicle", { interaction: v as DetailSettings["vehicle"]["interaction"] })} />
      <FieldSection label="時代感" value={d.vehicle.era} options={VEHICLE_ERAS}
        onChange={(v) => upd("vehicle", { era: v as DetailSettings["vehicle"]["era"] })} />
      <MultiFieldSection label="素材感" singleValue={d.vehicle.material} multiValues={d.multiOverrides?.["vehicle.material"] ?? []} options={VEHICLE_MATERIALS}
        onChange={mc("vehicle.material", "material")} />
      <MultiFieldSection label="雰囲気" singleValue={d.vehicle.atmosphere} multiValues={d.multiOverrides?.["vehicle.atmosphere"] ?? []} options={VEHICLE_ATMOSPHERES}
        onChange={mc("vehicle.atmosphere", "atmosphere")} />
    </div>
  );
}

function MythContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "myth");
  return (
    <div>
      {/* 安全ルール注記 */}
      <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-200/70 leading-relaxed">
        🐉 <span className="text-amber-200/90 font-semibold">人物が主役</span>、幻獣は演出要素。既存作品（ガンダム・ポケモン・DQ・FF等）の固有キャラクターは使わず、オリジナルデザインで描写します。
      </div>
      <MultiFieldSection label="神話地域" singleValue={d.myth.region} multiValues={d.multiOverrides?.["myth.region"] ?? []} options={MYTH_REGIONS} noTopMargin
        onChange={mc("myth.region", "region")} />
      <MultiFieldSection label="幻獣種別" singleValue={d.myth.creature} multiValues={d.multiOverrides?.["myth.creature"] ?? []} options={MYTH_CREATURES}
        onChange={mc("myth.creature", "creature")} />
      <MultiFieldSection label="配置・関わり方" singleValue={d.myth.interaction} multiValues={d.multiOverrides?.["myth.interaction"] ?? []} options={MYTH_INTERACTIONS}
        onChange={mc("myth.interaction", "interaction")} />
      <MultiFieldSection label="描写スタイル" singleValue={d.myth.style} multiValues={d.multiOverrides?.["myth.style"] ?? []} options={MYTH_STYLES}
        onChange={mc("myth.style", "style")} />
      <FieldSection label="サイズ感" value={d.myth.size} options={MYTH_SIZES}
        onChange={(v) => upd("myth", { size: v as DetailSettings["myth"]["size"] })} />
    </div>
  );
}

function LightingContent({ d, chg }: { d: DetailSettings; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "lighting");
  const activePresetId = activeLightPresetId(d.lighting, d.multiOverrides);
  return (
    <div>
      {/* ライティングプリセット */}
      <CellSectionLabel label="プリセット" noTopMargin />
      <CellGrid>
        {LIGHTING_PRESETS.map((p) => (
          <GridCell
            key={p.id}
            jaLabel={p.label}
            active={activePresetId === p.id}
            cellKind={p.id === "skip" ? "skip" : p.id === "auto" ? "auto" : "value"}
            onClick={() => {
              const moNext = Object.fromEntries(
                Object.entries(d.multiOverrides ?? {}).filter(([k]) => !k.startsWith("lighting."))
              );
              chg({
                ...d,
                lighting: { ...d.lighting, ...p.patch },
                multiOverrides: Object.keys(moNext).length > 0 ? moNext : undefined,
              });
            }}
          />
        ))}
      </CellGrid>
      <MultiFieldSection label="光源方向" singleValue={d.lighting.direction} multiValues={d.multiOverrides?.["lighting.direction"] ?? []} options={LIGHT_DIRECTIONS}
        onChange={mc("lighting.direction", "direction")} />
      <MultiFieldSection label="強さ" singleValue={d.lighting.intensity} multiValues={d.multiOverrides?.["lighting.intensity"] ?? []} options={LIGHT_INTENSITIES}
        onChange={mc("lighting.intensity", "intensity")} />
      <MultiFieldSection label="色温度" singleValue={d.lighting.temperature} multiValues={d.multiOverrides?.["lighting.temperature"] ?? []} options={LIGHT_TEMPS}
        onChange={mc("lighting.temperature", "temperature")} />
      <MultiFieldSection label="影" singleValue={d.lighting.shadow} multiValues={d.multiOverrides?.["lighting.shadow"] ?? []} options={LIGHT_SHADOWS}
        onChange={mc("lighting.shadow", "shadow")} />
      <MultiFieldSection label="反射" singleValue={d.lighting.reflection} multiValues={d.multiOverrides?.["lighting.reflection"] ?? []} options={LIGHT_REFLECTIONS}
        onChange={mc("lighting.reflection", "reflection")} />
      <MultiFieldSection label="空気感" singleValue={d.lighting.atmosphere} multiValues={d.multiOverrides?.["lighting.atmosphere"] ?? []} options={LIGHT_ATMOSPHERES}
        onChange={mc("lighting.atmosphere", "atmosphere")} />
    </div>
  );
}

function CyberContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "cyber");
  return (
    <div>
      {/* 安全ルール注記 */}
      <div className="mb-3 rounded-xl border border-teal-400/25 bg-teal-500/8 px-3 py-2 text-[11px] text-teal-200/70 leading-relaxed">
        🤖 体の<span className="text-teal-200/90 font-semibold">一部だけ</span>をSF的に変化させます。顔・表情・体型・ポーズは維持。傷・欠損・血液表現は禁止。
      </div>
      <MultiFieldSection label="変化する部位" singleValue={d.cyber.part} multiValues={d.multiOverrides?.["cyber.part"] ?? []} options={CYBER_PARTS} noTopMargin
        onChange={mc("cyber.part", "part")} />
      <MultiFieldSection label="機械化タイプ" singleValue={d.cyber.type} multiValues={d.multiOverrides?.["cyber.type"] ?? []} options={CYBER_TYPES}
        onChange={mc("cyber.type", "type")} />
      <MultiFieldSection label="質感" singleValue={d.cyber.texture} multiValues={d.multiOverrides?.["cyber.texture"] ?? []} options={CYBER_TEXTURES}
        onChange={mc("cyber.texture", "texture")} />
      <MultiFieldSection label="発光色" singleValue={d.cyber.glowColor} multiValues={d.multiOverrides?.["cyber.glowColor"] ?? []} options={CYBER_GLOW_COLORS}
        onChange={mc("cyber.glowColor", "glowColor")} />
      {/* 変化量：おまかせボタンなし */}
      <div>
        <CellSectionLabel label="変化量" />
        <CellGrid>
          <GridCell
            jaLabel="設定なし"
            active={d.cyber.intensity === "skip"}
            cellKind="skip"
            onClick={() => upd("cyber", { intensity: "skip" })}
          />
          {CYBER_INTENSITIES.map((opt) => (
            <GridCell
              key={opt.id}
              jaLabel={opt.label}
              active={d.cyber.intensity === opt.id}
              cellKind="value"
              title={opt.ja}
              onClick={() =>
                upd("cyber", {
                  intensity: d.cyber.intensity === opt.id ? "skip" : (opt.id as DetailSettings["cyber"]["intensity"]),
                })
              }
            />
          ))}
        </CellGrid>
      </div>
    </div>
  );
}

function CosplayContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "cosplay");
  return (
    <div>
      <MultiFieldSection label="ジャンル系統" singleValue={d.cosplay.genre} multiValues={d.multiOverrides?.["cosplay.genre"] ?? []} options={COSPLAY_GENRES} noTopMargin
        onChange={mc("cosplay.genre", "genre")} />
      <FieldSection label="かわいい系" value={d.cosplay.cuteStyle} options={COSPLAY_CUTE_STYLES}
        onChange={(v) => upd("cosplay", { cuteStyle: v as DetailSettings["cosplay"]["cuteStyle"] })} />
      <FieldSection label="職種・役割系" value={d.cosplay.jobGenre} options={COSPLAY_JOB_GENRES}
        onChange={(v) => upd("cosplay", { jobGenre: v as DetailSettings["cosplay"]["jobGenre"] })} />
      <FieldSection label="和風系" value={d.cosplay.japaneseStyle} options={COSPLAY_JAPANESE_STYLES}
        onChange={(v) => upd("cosplay", { japaneseStyle: v as DetailSettings["cosplay"]["japaneseStyle"] })} />
      <FieldSection label="ファンタジー系" value={d.cosplay.fantasyStyle} options={COSPLAY_FANTASY_STYLES}
        onChange={(v) => upd("cosplay", { fantasyStyle: v as DetailSettings["cosplay"]["fantasyStyle"] })} />
      <FieldSection label="SF・近未来系" value={d.cosplay.scifiStyle} options={COSPLAY_SCIFI_STYLES}
        onChange={(v) => upd("cosplay", { scifiStyle: v as DetailSettings["cosplay"]["scifiStyle"] })} />
      <FieldSection label="ダーク系" value={d.cosplay.darkStyle} options={COSPLAY_DARK_STYLES}
        onChange={(v) => upd("cosplay", { darkStyle: v as DetailSettings["cosplay"]["darkStyle"] })} />
      <FieldSection label="職業コスプレ" value={d.cosplay.occupation} options={COSPLAY_OCCUPATIONS}
        onChange={(v) => upd("cosplay", { occupation: v as DetailSettings["cosplay"]["occupation"] })} />
      <FieldSection label="装飾レベル" value={d.cosplay.decoration} options={COSPLAY_DECORATIONS}
        onChange={(v) => upd("cosplay", { decoration: v as DetailSettings["cosplay"]["decoration"] })} />
      <MultiFieldSection label="持ち物・小物" singleValue={d.cosplay.item} multiValues={d.multiOverrides?.["cosplay.item"] ?? []} options={COSPLAY_ITEMS}
        onChange={mc("cosplay.item", "item")} />
      {/* 露出：おまかせボタンなし（安全のため） */}
      <div>
        <CellSectionLabel label="露出" />
        <CellGrid>
          <GridCell
            jaLabel="設定なし"
            active={d.cosplay.exposure === "skip"}
            cellKind="skip"
            onClick={() => upd("cosplay", { exposure: "skip" })}
          />
          {COSPLAY_EXPOSURES.map((opt) => (
            <GridCell
              key={opt.id}
              jaLabel={opt.label}
              active={d.cosplay.exposure === opt.id}
              cellKind="value"
              title={opt.ja}
              onClick={() =>
                upd("cosplay", {
                  exposure: d.cosplay.exposure === opt.id ? "skip" : (opt.id as DetailSettings["cosplay"]["exposure"]),
                })
              }
            />
          ))}
        </CellGrid>
      </div>
      <MultiFieldSection label="カラー方向" singleValue={d.cosplay.colorDir} multiValues={d.multiOverrides?.["cosplay.colorDir"] ?? []} options={COSPLAY_COLOR_DIRS}
        onChange={mc("cosplay.colorDir", "colorDir")} />
    </div>
  );
}

function AspectRatioContent({ d, upd }: { d: DetailSettings; upd: Updater }) {
  return (
    <div>
      <CellSectionLabel label="比率" noTopMargin />
      <CellGrid>
        <GridCell
          jaLabel="設定なし"
          active={d.aspectRatio.preset === "skip"}
          cellKind="skip"
          onClick={() => upd("aspectRatio", { preset: "skip" })}
        />
        {ASPECT_RATIO_PRESETS.map((opt) => (
          <GridCell
            key={opt.id}
            jaLabel={opt.label}
            active={d.aspectRatio.preset === opt.id}
            cellKind="value"
            title={opt.ja}
            onClick={() =>
              upd("aspectRatio", {
                preset: opt.id as DetailSettings["aspectRatio"]["preset"],
              })
            }
          />
        ))}
      </CellGrid>
      {d.aspectRatio.preset === "custom" && (
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="text-xs text-text-muted/60">W</span>
          <input
            type="number" min={1} max={9999}
            value={d.aspectRatio.customW}
            onChange={(e) =>
              upd("aspectRatio", { customW: Math.max(1, Number(e.target.value)) })
            }
            className="w-22 rounded-lg border border-violet-400/20 bg-bg-panel text-text-base text-sm px-3 py-1.5 focus:outline-none focus:border-violet-400/60 focus:shadow-[0_0_0_2px_rgba(124,92,255,0.15)]"
          />
          <span className="text-text-muted/60 text-sm">×</span>
          <span className="text-xs text-text-muted/60">H</span>
          <input
            type="number" min={1} max={9999}
            value={d.aspectRatio.customH}
            onChange={(e) =>
              upd("aspectRatio", { customH: Math.max(1, Number(e.target.value)) })
            }
            className="w-22 rounded-lg border border-violet-400/20 bg-bg-panel text-text-base text-sm px-3 py-1.5 focus:outline-none focus:border-violet-400/60 focus:shadow-[0_0_0_2px_rgba(124,92,255,0.15)]"
          />
          {d.aspectRatio.customW > 0 && d.aspectRatio.customH > 0 && (
            <span className="text-xs text-text-muted/55">
              ≈{" "}
              {d.aspectRatio.customW > d.aspectRatio.customH
                ? `${(d.aspectRatio.customW / d.aspectRatio.customH).toFixed(2)} : 1`
                : `1 : ${(d.aspectRatio.customH / d.aspectRatio.customW).toFixed(2)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ForegroundContent({ d, upd, chg }: { d: DetailSettings; upd: Updater; chg: (n: DetailSettings) => void }) {
  const mc = makeMultiChanger(d, chg, "foreground");
  return (
    <div>
      {/* 安全ルール注記 */}
      <div className="mb-3 rounded-xl border border-lime-400/25 bg-lime-500/8 px-3 py-2 text-[11px] text-lime-200/70 leading-relaxed">
        🌿 人物の<span className="text-lime-200/90 font-semibold">手前</span>にエフェクトを重ねます。顔・目・表情は隠さず、ポーズ・衣装は変更しません。
      </div>
      <FieldSection label="プリセット" value={d.foreground.preset} options={FG_PRESETS} noTopMargin
        onChange={(v) => upd("foreground", { preset: v as DetailSettings["foreground"]["preset"] })} />
      <MultiFieldSection label="エフェクト種類" singleValue={d.foreground.effectType} multiValues={d.multiOverrides?.["foreground.effectType"] ?? []} options={FG_EFFECT_TYPES}
        onChange={mc("foreground.effectType", "effectType")} />
      <MultiFieldSection label="回転・渦" singleValue={d.foreground.swirlType} multiValues={d.multiOverrides?.["foreground.swirlType"] ?? []} options={FG_SWIRL_TYPES}
        onChange={mc("foreground.swirlType", "swirlType")} />
      <MultiFieldSection label="HUD・デジタル" singleValue={d.foreground.digitalType} multiValues={d.multiOverrides?.["foreground.digitalType"] ?? []} options={FG_DIGITAL_TYPES}
        onChange={mc("foreground.digitalType", "digitalType")} />
      <MultiFieldSection label="アート表現" singleValue={d.foreground.artType} multiValues={d.multiOverrides?.["foreground.artType"] ?? []} options={FG_ART_TYPES}
        onChange={mc("foreground.artType", "artType")} />
      <MultiFieldSection label="位置" singleValue={d.foreground.position} multiValues={d.multiOverrides?.["foreground.position"] ?? []} options={FG_POSITIONS}
        onChange={mc("foreground.position", "position")} />
      <FieldSection label="密度" value={d.foreground.density} options={FG_DENSITIES}
        onChange={(v) => upd("foreground", { density: v as DetailSettings["foreground"]["density"] })} />
      <MultiFieldSection label="動き" singleValue={d.foreground.motion} multiValues={d.multiOverrides?.["foreground.motion"] ?? []} options={FG_MOTIONS}
        onChange={mc("foreground.motion", "motion")} />
      <MultiFieldSection label="色方向" singleValue={d.foreground.color} multiValues={d.multiOverrides?.["foreground.color"] ?? []} options={FG_COLORS}
        onChange={mc("foreground.color", "color")} />
      <FieldSection label="奥行き" value={d.foreground.depth} options={FG_DEPTHS}
        onChange={(v) => upd("foreground", { depth: v as DetailSettings["foreground"]["depth"] })} />
      <FieldSection label="視認性" value={d.foreground.visibility} options={FG_VISIBILITIES}
        onChange={(v) => upd("foreground", { visibility: v as DetailSettings["foreground"]["visibility"] })} />
    </div>
  );
}

// ─── Random helpers ───────────────────────────────────────────────────────────

function randFrom(arr: PresetItem[]): string {
  return arr[Math.floor(Math.random() * arr.length)].id;
}

function randomizeScope(scope: Scope, d: DetailSettings): Partial<DetailSettings> {
  switch (scope) {
    case "hair":
      return {
        hair: {
          hairStyle: randFrom(HAIR_STYLES)      as DetailSettings["hair"]["hairStyle"],
          length:    randFrom(HAIR_LENGTHS)     as DetailSettings["hair"]["length"],
          shape:     randFrom(HAIR_SHAPES)      as DetailSettings["hair"]["shape"],
          texture:   randFrom(HAIR_TEXTURES)    as DetailSettings["hair"]["texture"],
          colorMode: randFrom(HAIR_COLOR_MODES) as DetailSettings["hair"]["colorMode"],
          color:     randFrom(HAIR_COLORS)      as DetailSettings["hair"]["color"],
          bangs:     randFrom(HAIR_BANGS)       as DetailSettings["hair"]["bangs"],
          tips:      randFrom(HAIR_TIPS)        as DetailSettings["hair"]["tips"],
          volume:    randFrom(HAIR_VOLUMES)     as DetailSettings["hair"]["volume"],
          accessory: randFrom(HAIR_ACCESSORIES) as DetailSettings["hair"]["accessory"],
        },
      };
    case "outfit":
      return {
        outfit: {
          style:      randFrom(OUTFIT_STYLES)      as DetailSettings["outfit"]["style"],
          exposure:   randFrom(OUTFIT_EXPOSURES)   as DetailSettings["outfit"]["exposure"],
          material:   randFrom(OUTFIT_MATERIALS)   as DetailSettings["outfit"]["material"],
          color:      randFrom(OUTFIT_COLORS)      as DetailSettings["outfit"]["color"],
          silhouette: randFrom(OUTFIT_SILHOUETTES) as DetailSettings["outfit"]["silhouette"],
          decoration: randFrom(OUTFIT_DECORATIONS) as DetailSettings["outfit"]["decoration"],
          season:     randFrom(OUTFIT_SEASONS)     as DetailSettings["outfit"]["season"],
          luxury:     randFrom(OUTFIT_LUXURIES)    as DetailSettings["outfit"]["luxury"],
        },
      };
    case "background":
      return {
        background: {
          place:       randFrom(BG_PLACES)    as DetailSettings["background"]["place"],
          color:       randFrom(BG_COLORS)    as DetailSettings["background"]["color"],
          density:     randFrom(BG_DENSITIES) as DetailSettings["background"]["density"],
          effect:      randFrom(BG_EFFECTS)   as DetailSettings["background"]["effect"],
          time:        randFrom(BG_TIMES)     as DetailSettings["background"]["time"],
          weather:     randFrom(BG_WEATHERS)  as DetailSettings["background"]["weather"],
          depth:       randFrom(BG_DEPTHS)    as DetailSettings["background"]["depth"],
          info:        randFrom(BG_INFOS)     as DetailSettings["background"]["info"],
          style:       randFrom(BG_STYLES)    as DetailSettings["background"]["style"],
          textType:    "skip"                 as DetailSettings["background"]["textType"],
          textMood:    "skip"                 as DetailSettings["background"]["textMood"],
          textLayout:  "skip"                 as DetailSettings["background"]["textLayout"],
          textTexture: "skip"                 as DetailSettings["background"]["textTexture"],
        },
      };
    case "foreground":
      return {
        foreground: {
          preset:      randFrom(FG_PRESETS)      as DetailSettings["foreground"]["preset"],
          effectType:  randFrom(FG_EFFECT_TYPES) as DetailSettings["foreground"]["effectType"],
          swirlType:   randFrom(FG_SWIRL_TYPES)  as DetailSettings["foreground"]["swirlType"],
          digitalType: randFrom(FG_DIGITAL_TYPES) as DetailSettings["foreground"]["digitalType"],
          artType:     randFrom(FG_ART_TYPES)    as DetailSettings["foreground"]["artType"],
          position:    randFrom(FG_POSITIONS)    as DetailSettings["foreground"]["position"],
          density:     randFrom(FG_DENSITIES)    as DetailSettings["foreground"]["density"],
          motion:      randFrom(FG_MOTIONS)      as DetailSettings["foreground"]["motion"],
          color:       randFrom(FG_COLORS)       as DetailSettings["foreground"]["color"],
          depth:       randFrom(FG_DEPTHS)       as DetailSettings["foreground"]["depth"],
          visibility:  "face_protected"          as DetailSettings["foreground"]["visibility"],
        },
      };
    case "pose":
      return {
        pose: {
          type:        randFrom(POSE_TYPES)        as DetailSettings["pose"]["type"],
          impression:  randFrom(POSE_IMPRESSIONS)  as DetailSettings["pose"]["impression"],
          hand:        randFrom(POSE_HANDS)        as DetailSettings["pose"]["hand"],
          foot:        randFrom(POSE_FEET)         as DetailSettings["pose"]["foot"],
          balance:     randFrom(POSE_BALANCES)     as DetailSettings["pose"]["balance"],
          motion:      randFrom(POSE_MOTIONS)      as DetailSettings["pose"]["motion"],
          gaze:        randFrom(POSE_GAZES)        as DetailSettings["pose"]["gaze"],
          orientation: randFrom(POSE_ORIENTATIONS) as DetailSettings["pose"]["orientation"],
        },
      };
    case "camera":
      return {
        camera: {
          angle:       randFrom(CAMERA_ANGLES)       as DetailSettings["camera"]["angle"],
          distance:    randFrom(CAMERA_DISTANCES)    as DetailSettings["camera"]["distance"],
          lens:        randFrom(CAMERA_LENSES)       as DetailSettings["camera"]["lens"],
          composition: randFrom(CAMERA_COMPOSITIONS) as DetailSettings["camera"]["composition"],
          fov:         randFrom(CAMERA_FOVS)         as DetailSettings["camera"]["fov"],
          eyeHeight:   randFrom(CAMERA_EYE_HEIGHTS)  as DetailSettings["camera"]["eyeHeight"],
          custom3D:    null,
        },
      };
    case "props":
      return {
        props: {
          category:  randFrom(PROPS_CATEGORIES) as DetailSettings["props"]["category"],
          hold:      randFrom(PROPS_HOLDS)      as DetailSettings["props"]["hold"],
          size:      randFrom(PROPS_SIZES)      as DetailSettings["props"]["size"],
          glow:      randFrom(PROPS_GLOWS)      as DetailSettings["props"]["glow"],
          vibe:      randFrom(PROPS_VIBES)      as DetailSettings["props"]["vibe"],
          placement: randFrom(PROPS_PLACEMENTS) as DetailSettings["props"]["placement"],
          count:     randFrom(PROPS_COUNTS)     as DetailSettings["props"]["count"],
        },
      };
    case "big_object":
      return {
        bigObject: {
          genre:     randFrom(BIG_OBJECT_GENRES)     as DetailSettings["bigObject"]["genre"],
          type:      randFrom(BIG_OBJECT_TYPES)      as DetailSettings["bigObject"]["type"],
          condition: randFrom(BIG_OBJECT_CONDITIONS) as DetailSettings["bigObject"]["condition"],
          placement: randFrom(BIG_OBJECT_PLACEMENTS) as DetailSettings["bigObject"]["placement"],
          size:      randFrom(BIG_OBJECT_SIZES)      as DetailSettings["bigObject"]["size"],
          mood:      randFrom(BIG_OBJECT_MOODS)      as DetailSettings["bigObject"]["mood"],
        },
      };
    case "vehicle":
      return {
        vehicle: {
          genre:       randFrom(VEHICLE_GENRES)       as DetailSettings["vehicle"]["genre"],
          type:        randFrom(VEHICLE_TYPES)        as DetailSettings["vehicle"]["type"],
          interaction: randFrom(VEHICLE_INTERACTIONS) as DetailSettings["vehicle"]["interaction"],
          era:         randFrom(VEHICLE_ERAS)         as DetailSettings["vehicle"]["era"],
          material:    randFrom(VEHICLE_MATERIALS)    as DetailSettings["vehicle"]["material"],
          atmosphere:  randFrom(VEHICLE_ATMOSPHERES)  as DetailSettings["vehicle"]["atmosphere"],
        },
      };
    case "myth":
      return {
        myth: {
          region:      randFrom(MYTH_REGIONS)       as DetailSettings["myth"]["region"],
          creature:    randFrom(MYTH_CREATURES)      as DetailSettings["myth"]["creature"],
          interaction: randFrom(MYTH_INTERACTIONS)   as DetailSettings["myth"]["interaction"],
          style:       randFrom(MYTH_STYLES)         as DetailSettings["myth"]["style"],
          size:        randFrom(MYTH_SIZES)          as DetailSettings["myth"]["size"],
        },
      };
    case "lighting":
      return {
        lighting: {
          direction:   randFrom(LIGHT_DIRECTIONS)  as DetailSettings["lighting"]["direction"],
          intensity:   randFrom(LIGHT_INTENSITIES) as DetailSettings["lighting"]["intensity"],
          temperature: randFrom(LIGHT_TEMPS)       as DetailSettings["lighting"]["temperature"],
          shadow:      randFrom(LIGHT_SHADOWS)     as DetailSettings["lighting"]["shadow"],
          reflection:  randFrom(LIGHT_REFLECTIONS) as DetailSettings["lighting"]["reflection"],
          atmosphere:  randFrom(LIGHT_ATMOSPHERES) as DetailSettings["lighting"]["atmosphere"],
        },
      };
    case "cyber":
      return {
        cyber: {
          part:      randFrom(CYBER_PARTS)       as DetailSettings["cyber"]["part"],
          type:      randFrom(CYBER_TYPES)       as DetailSettings["cyber"]["type"],
          texture:   randFrom(CYBER_TEXTURES)    as DetailSettings["cyber"]["texture"],
          glowColor: randFrom(CYBER_GLOW_COLORS) as DetailSettings["cyber"]["glowColor"],
          intensity: randFrom(CYBER_INTENSITIES) as DetailSettings["cyber"]["intensity"],
        },
      };
    case "cosplay":
      return {
        cosplay: {
          genre:         randFrom(COSPLAY_GENRES)          as DetailSettings["cosplay"]["genre"],
          cuteStyle:     randFrom(COSPLAY_CUTE_STYLES)     as DetailSettings["cosplay"]["cuteStyle"],
          jobGenre:      randFrom(COSPLAY_JOB_GENRES)      as DetailSettings["cosplay"]["jobGenre"],
          japaneseStyle: randFrom(COSPLAY_JAPANESE_STYLES) as DetailSettings["cosplay"]["japaneseStyle"],
          fantasyStyle:  randFrom(COSPLAY_FANTASY_STYLES)  as DetailSettings["cosplay"]["fantasyStyle"],
          scifiStyle:    randFrom(COSPLAY_SCIFI_STYLES)    as DetailSettings["cosplay"]["scifiStyle"],
          darkStyle:     randFrom(COSPLAY_DARK_STYLES)     as DetailSettings["cosplay"]["darkStyle"],
          occupation:    randFrom(COSPLAY_OCCUPATIONS)     as DetailSettings["cosplay"]["occupation"],
          decoration:    randFrom(COSPLAY_DECORATIONS)     as DetailSettings["cosplay"]["decoration"],
          item:          randFrom(COSPLAY_ITEMS)           as DetailSettings["cosplay"]["item"],
          exposure:      "modest",  // ランダム時も露出は控えめ固定
          colorDir:      randFrom(COSPLAY_COLOR_DIRS)      as DetailSettings["cosplay"]["colorDir"],
        },
      };
    case "aspect_ratio":
      return {
        aspectRatio: {
          preset:  randFrom(ASPECT_RATIO_PRESETS.filter((p) => p.id !== "custom" && p.id !== "skip")) as DetailSettings["aspectRatio"]["preset"],
          customW: d.aspectRatio.customW,
          customH: d.aspectRatio.customH,
        },
      };
  }
}

// ─── Extra tab content components ─────────────────────────────────────────────

/** 雰囲気タブ：基本/世界観/演出/SNS最適化/その他 + 詳細オプション（色味を除く） */
function MoodTabContent({
  moods,
  autoMoodCategories,
  onMoodsChange,
}: {
  moods: Mood[];
  autoMoodCategories: string[];
  onMoodsChange: (moods: Mood[], autoCategories: string[]) => void;
}) {
  const handleSelect = (group: MoodGroup, selection: "skip" | "auto" | Mood) => {
    const newMoods = moods.filter((m) => !group.moods.some((gm) => gm.id === m));
    const newAuto = autoMoodCategories.filter((c) => c !== group.label);
    if (selection === "skip") {
      onMoodsChange(newMoods, newAuto);
    } else if (selection === "auto") {
      onMoodsChange(newMoods, [...newAuto, group.label]);
    } else {
      onMoodsChange([...newMoods, selection as Mood], newAuto);
    }
  };

  // 色味グループは 色戦略 タブに移動
  const filteredBasicGroups = MOOD_GROUPS_BASIC.filter((g) => g.label !== "色味");

  return (
    <div>
      {filteredBasicGroups.map((group, i) => (
        <MoodGroupRow
          key={group.label}
          group={group}
          moods={moods}
          autoMoodCategories={autoMoodCategories}
          onSelect={handleSelect}
          noTopMargin={i === 0}
        />
      ))}

      {/* 詳細オプション（反射・空気感・色調・空間）：折りたたみ廃止＝基本群に続けて常時表示 */}
      {MOOD_GROUPS_DETAIL.map((group) => (
        <MoodGroupRow
          key={group.label}
          group={group}
          moods={moods}
          autoMoodCategories={autoMoodCategories}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}

// ─── ArtStyle tab ─────────────────────────────────────────────────────────────

const ART_STYLE_OPTIONS: Array<{ value: ArtStyle; label: string; hint: string }> = [
  { value: "auto",         label: "おまかせ",        hint: "案ごとに自動で絵柄スタイルを変化させる"               },
  { value: "photo",        label: "📷 フォトリアル", hint: "カメラ撮影のようなリアルな質感・自然な光描写"         },
  { value: "illustration", label: "🎨 イラスト",     hint: "商業デジタルイラスト風・鮮やかな色彩"                 },
  { value: "anime",        label: "✨ アニメ調",     hint: "日本TVアニメ風・セルシェーディング・明確な輪郭線"     },
  { value: "watercolor",   label: "💧 水彩画",       hint: "滲み・にじみ・透明感のある水彩絵の具の質感"           },
  { value: "oil_painting", label: "🖌 油絵",         hint: "厚塗り・重厚な質感・古典絵画的な雰囲気"               },
  { value: "sketch",       label: "✏️ スケッチ",     hint: "鉛筆・炭素の質感・ハッチング・素描的な線の味わい"     },
  { value: "line_art",     label: "〰 線画",          hint: "明確な輪郭線主体・ミニマルな塗り・ペン画的な精密さ"   },
  { value: "3d_render",    label: "🔷 3DCG",         hint: "3Dモデリング感・物理的に正確な光と影・CG的な質感"     },
  { value: "concept_art",  label: "🎬 コンセプトアート", hint: "映画・ゲーム制作用のプロアート調・物語性ある演出" },
  { value: "manga",        label: "📰 漫画風",       hint: "スクリーントーン・効果線・白黒漫画の対比表現"         },
  { value: "game_art",     label: "🎮 ゲームアート", hint: "ゲームキャラ的な明確な輪郭・鮮やかな色彩"             },
  { value: "pixel",        label: "🟦 ドット絵",     hint: "ピクセルアート・レトロゲーム的な質感"                 },
  { value: "flat_design",  label: "⬛ フラット",     hint: "陰影なし・シンプルな色面構成・ベクターアート的"       },
  { value: "ghibli_style", label: "🌿 ジブリ風",     hint: "温かみある手描きアニメ調・柔らかい光と自然描写"       },
];

/** 絵柄スタイルタブ */
function ArtStyleTabContent({
  artStyle,
  onArtStyleChange,
}: {
  artStyle: ArtStyle | null;
  onArtStyleChange: (v: ArtStyle | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-black uppercase tracking-widest text-text-muted/80 select-none">
          🖌 絵柄スタイル
        </span>
        {artStyle !== null && (
          <button
            type="button"
            onClick={() => onArtStyleChange(null)}
            className="text-[11px] text-text-muted/65 hover:text-fuchsia-400/80 transition leading-none"
          >
            解除
          </button>
        )}
      </div>
      <p className="text-[10px] text-text-muted/45 leading-tight mb-1">
        全体の描画スタイルを固定。スコープを問わずすべての案に反映されます。
      </p>
      <div className="flex flex-wrap gap-1">
        {ART_STYLE_OPTIONS.map((opt) => {
          const active = artStyle === opt.value;
          const isAuto = opt.value === "auto";
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.hint}
              onClick={() => onArtStyleChange(active ? null : opt.value)}
              className={[
                "text-[11px] font-semibold px-2 py-0.5 rounded border transition leading-none whitespace-nowrap",
                active
                  ? isAuto
                    ? "bg-violet-500/30 border-violet-400/70 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.35)]"
                    : "bg-fuchsia-500/25 border-fuchsia-400/60 text-fuchsia-200 shadow-[0_0_8px_rgba(217,70,239,0.3)]"
                  : "bg-transparent border-[#252e44] text-text-muted/80 hover:border-[#3a4460] hover:text-text-muted/95",
              ].join(" ")}
            >
              {active && <span className="mr-0.5 text-[9px]">✓</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 時代タブ（EraTabContent）は完全撤去（dead code整理・グローバル era は生成にも不使用）。

/** 色戦略タブ：色戦略セレクター（「色味」mood 行は撤去＝色戦略に一本化・重複整理） */
function ColorStrategyTabContent({
  colorStrategy,
  onColorStrategyChange,
}: {
  colorStrategy: ColorStrategy | null;
  onColorStrategyChange: (v: ColorStrategy | null) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 色戦略 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-black uppercase tracking-widest text-text-muted/80 select-none">
            🎨 色戦略
          </span>
          {colorStrategy !== null && (
            <button
              type="button"
              onClick={() => onColorStrategyChange(null)}
              className="text-[11px] text-text-muted/65 hover:text-rose-400/80 transition leading-none"
            >
              解除
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {COLOR_STRATEGY_OPTIONS.map((opt) => {
            const active = colorStrategy === opt.value;
            const isAuto = opt.value === "auto";
            const isNg = opt.isNg;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onColorStrategyChange(active ? null : opt.value)}
                className={[
                  "text-[11px] font-semibold px-2 py-0.5 rounded border transition leading-none whitespace-nowrap",
                  active
                    ? isAuto
                      ? "bg-violet-500/30 border-violet-400/70 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.35)]"
                      : isNg
                        ? "bg-rose-500/25 border-rose-400/60 text-rose-200 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                        : "bg-teal-500/25 border-teal-400/60 text-teal-200 shadow-[0_0_8px_rgba(20,184,166,0.3)]"
                    : isNg
                      ? "bg-transparent border-rose-900/50 text-rose-400/70 hover:border-rose-500/60 hover:text-rose-300/90"
                      : "bg-transparent border-[#252e44] text-text-muted/80 hover:border-[#3a4460] hover:text-text-muted/95",
                ].join(" ")}
              >
                {active && <span className="mr-0.5 text-[9px]">✓</span>}
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted/65 leading-relaxed">
          NG系（赤文字）は該当色をプロンプトから除外。Y3Kの青偏りも防止。
        </p>
      </div>
    </div>
  );
}

/** 全体スタイルタブ：絵柄＋色戦略（どちらもグローバル＝scope非依存・全案に適用）を1セクションに集約 */
function GlobalStyleTabContent({
  artStyle,
  onArtStyleChange,
  colorStrategy,
  onColorStrategyChange,
}: {
  artStyle: ArtStyle | null;
  onArtStyleChange: (v: ArtStyle | null) => void;
  colorStrategy: ColorStrategy | null;
  onColorStrategyChange: (v: ColorStrategy | null) => void;
}) {
  return (
    <div className="space-y-4">
      <ArtStyleTabContent artStyle={artStyle} onArtStyleChange={onArtStyleChange} />
      <div className="border-t border-white/8" />
      <ColorStrategyTabContent colorStrategy={colorStrategy} onColorStrategyChange={onColorStrategyChange} />
    </div>
  );
}

/** NG指定タブ：追加指示 + NG指定 + 禁止モチーフ */
function NgTabContent({
  extraInstructions,
  onExtraInstructionsChange,
  ngList,
  onNgListChange,
  forbiddenTokens,
  onForbiddenTokensChange,
}: {
  extraInstructions: string;
  onExtraInstructionsChange: (v: string) => void;
  ngList: string;
  onNgListChange: (v: string) => void;
  forbiddenTokens: string[];
  onForbiddenTokensChange: (tokens: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-rose-200/85 bg-rose-500/8 border border-rose-400/25 rounded-lg px-2.5 py-1.5 leading-snug">
        🚫 <b>NGはこの欄に入力します</b>（「NG指定（任意）」テキスト欄／下の「禁止モチーフ」）。
        詳細設定のグリッドではNG指定できません（グリッドは候補の選択のみ）。
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted/70 mb-1 font-medium">
            追加指示（任意）
          </label>
          <ExtraInstructions value={extraInstructions} onChange={onExtraInstructionsChange} />
        </div>
        <div>
          <label className="block text-xs text-text-muted/70 mb-1 font-medium">
            NG指定（任意）
          </label>
          <NgInput value={ngList} onChange={onNgListChange} />
        </div>
      </div>
      <div className="border-t border-bg-border/25 pt-2">
        <ForbiddenTokens tokens={forbiddenTokens} onChange={onForbiddenTokensChange} />
      </div>
    </div>
  );
}


// ─── Main component ───────────────────────────────────────────────────────────

export function DetailsCard({
  scopes,
  value,
  onChange,
  moods,
  autoMoodCategories,
  onMoodsChange,
  colorStrategy,
  artStyle,
  onColorStrategyChange,
  onArtStyleChange,
  extraInstructions,
  onExtraInstructionsChange,
  ngList,
  onNgListChange,
  forbiddenTokens,
  onForbiddenTokensChange,
}: Props) {
  const scopeKeyOf = (t: TabId): string => (t === "big_object" ? "bigObject" : t);
  const isScopeTab = (t: TabId): boolean => !(EXTRA_TAB_IDS as string[]).includes(t);

  const update: Updater = (key, patch) => {
    onChange({ ...value, [key]: { ...value[key], ...patch } });
  };

  // ── 各カテゴリの選択件数（バッジ表示用）──
  function countTab(t: TabId): number {
    switch (t) {
      case "mood":          return moods.length + autoMoodCategories.length;
      case "globalStyle":   return (artStyle ? 1 : 0) + (colorStrategy ? 1 : 0);
      case "ng":            return (extraInstructions.trim() ? 1 : 0) + (ngList.trim() ? 1 : 0) + forbiddenTokens.length;
      case "aspect_ratio":  return value.aspectRatio?.preset && value.aspectRatio.preset !== "skip" ? 1 : 0;
      default: {
        const scopeKey = scopeKeyOf(t);
        const fields = (value as unknown as Record<string, unknown>)[scopeKey] as Record<string, unknown> | undefined;
        if (!fields) return 0;
        const mo = value.multiOverrides ?? {};
        const moFields = new Set(
          Object.keys(mo)
            .filter((k) => k.startsWith(`${scopeKey}.`) && (mo[k]?.length ?? 0) >= 1)
            .map((k) => k.slice(scopeKey.length + 1))
        );
        let n = 0;
        for (const [fk, fv] of Object.entries(fields)) {
          if (moFields.has(fk)) { n++; continue; }
          if (fk === "custom3D") { if (fv) n++; continue; }
          if (typeof fv === "string" && fv !== "skip" && fv !== "auto") n++;
        }
        return n;
      }
    }
  }

  const allTabs: TabId[] = [...scopes, ...EXTRA_TAB_IDS];

  // ── 折りたたみ開閉（P4：選択あり=初期展開 / 未選択=初期クローズ）──
  const [openTabs, setOpenTabs] = useState<Set<TabId>>(
    () => new Set(allTabs.filter((t) => countTab(t) > 0)),
  );
  const toggleOpen = (t: TabId) =>
    setOpenTabs((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t); else n.add(t);
      return n;
    });
  const openAll  = () => setOpenTabs(new Set(allTabs));
  const closeAll = () => setOpenTabs(new Set());

  const [undoBuffer, setUndoBuffer] = useState<DetailSettings | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAll = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoBuffer(value);
    onChange({ ...AUTO_DETAILS, multiOverrides: undefined });
    undoTimerRef.current = setTimeout(() => {
      setUndoBuffer(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  const undoReset = () => {
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    if (undoBuffer) { onChange(undoBuffer); setUndoBuffer(null); }
  };

  // カテゴリ単位のクリア（スコープ系のみ）
  const resetScope = (t: TabId) => {
    const scopeKey = scopeKeyOf(t);
    const moBase = value.multiOverrides ?? {};
    const moClean = Object.fromEntries(
      Object.entries(moBase).filter(([k]) => !k.startsWith(`${scopeKey}.`))
    );
    const moNext = Object.keys(moClean).length > 0 ? moClean : undefined;
    if (t === "aspect_ratio") {
      onChange({ ...value, aspectRatio: DEFAULT_DETAILS.aspectRatio, multiOverrides: moNext });
    } else {
      onChange({
        ...value,
        [scopeKey]: DEFAULT_DETAILS[scopeKey as keyof typeof DEFAULT_DETAILS],
        multiOverrides: moNext,
      });
    }
  };

  // カテゴリ単位のランダム（スコープ系のみ）
  const randomizeTabId = (t: TabId) => {
    const patch = randomizeScope(t as Scope, value);
    const scopeKey = scopeKeyOf(t);
    const moBase = value.multiOverrides ?? {};
    const moClean = Object.fromEntries(
      Object.entries(moBase).filter(([k]) => !k.startsWith(`${scopeKey}.`))
    );
    onChange({
      ...value,
      ...patch,
      multiOverrides: Object.keys(moClean).length > 0 ? moClean : undefined,
    });
  };

  const tabLabel = (t: TabId): string =>
    isScopeTab(t) ? SCOPE_META[t as Scope].label : EXTRA_TAB_META[t as ExtraTabId].label;

  // 各カテゴリの中身を返す（開いているカテゴリのみ描画される）
  const renderTabContent = (t: TabId) => {
    switch (t) {
      case "hair":          return <HairContent       d={value} upd={update} chg={onChange} />;
      case "outfit":        return <OutfitContent     d={value} upd={update} chg={onChange} />;
      case "cosplay":       return <CosplayContent    d={value} upd={update} chg={onChange} />;
      case "cyber":         return <CyberContent      d={value} upd={update} chg={onChange} />;
      case "background":    return <BackgroundContent d={value} upd={update} chg={onChange} />;
      case "foreground":    return <ForegroundContent d={value} upd={update} chg={onChange} />;
      case "pose":          return <PoseContent       d={value} upd={update} chg={onChange} />;
      case "camera":        return <CameraContent     d={value} upd={update} chg={onChange} />;
      case "props":         return <PropsContent      d={value} upd={update} chg={onChange} />;
      case "big_object":    return <BigObjectContent  d={value} upd={update} chg={onChange} />;
      case "vehicle":       return <VehicleContent    d={value} upd={update} chg={onChange} />;
      case "myth":          return <MythContent       d={value} upd={update} chg={onChange} />;
      case "lighting":      return <LightingContent   d={value} chg={onChange} />;
      case "aspect_ratio":  return <AspectRatioContent d={value} upd={update} />;
      case "mood":          return <MoodTabContent moods={moods} autoMoodCategories={autoMoodCategories} onMoodsChange={onMoodsChange} />;
      case "globalStyle":   return <GlobalStyleTabContent artStyle={artStyle} onArtStyleChange={onArtStyleChange} colorStrategy={colorStrategy} onColorStrategyChange={onColorStrategyChange} />;
      case "ng":            return <NgTabContent extraInstructions={extraInstructions} onExtraInstructionsChange={onExtraInstructionsChange} ngList={ngList} onNgListChange={onNgListChange} forbiddenTokens={forbiddenTokens} onForbiddenTokensChange={onForbiddenTokensChange} />;
      default:              return null;
    }
  };

  return (
    <section className="card">
      {/* Header + utility buttons */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="section-title !mb-0">雰囲気・スタイル</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openAll}
            title="すべてのカテゴリを開く"
            className="px-2.5 py-1 text-[11px] rounded-md border border-bg-border/60 text-white/70 hover:text-white hover:border-bg-border hover:bg-bg-panel/40 transition-all leading-none"
          >
            すべて開く
          </button>
          <button
            type="button"
            onClick={closeAll}
            title="すべてのカテゴリを閉じる"
            className="px-2.5 py-1 text-[11px] rounded-md border border-bg-border/60 text-white/70 hover:text-white hover:border-bg-border hover:bg-bg-panel/40 transition-all leading-none"
          >
            すべて閉じる
          </button>
          {undoBuffer ? (
            <button
              type="button"
              onClick={undoReset}
              title="リセット前の状態に戻す（5秒間有効）"
              className="px-2.5 py-1 text-[11px] rounded-md border border-amber-400/60 bg-amber-400/12 text-amber-200 hover:bg-amber-400/22 transition-all leading-none"
            >
              元に戻す
            </button>
          ) : (
            <button
              type="button"
              onClick={resetAll}
              title="すべての雰囲気・スタイル設定をおまかせに戻す"
              className="px-2.5 py-1 text-[11px] rounded-md border border-bg-border/60 text-white/70 hover:text-white hover:border-bg-border hover:bg-bg-panel/40 transition-all leading-none"
            >
              すべておまかせ
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-text-muted/55 leading-snug mb-2 -mt-1.5">選んだ項目を細かく指定（未指定＝おまかせ）。何を変えるかは「変更対象」、おまかせで引くなら「神引き」</p>

      {/* 折りたたみカテゴリ一覧（タブ廃止 → アコーディオン）
          P4: 選択あり（件数>0）のカテゴリを上に安定ソート（元の順序は保持） */}
      <div className="space-y-1.5">
        {[...allTabs]
          // globalStyle（絵柄＋色戦略）は最上部固定（rank 2）→ 選択済み（rank 1）→ 未選択（rank 0）
          .sort((a, b) => {
            const rank = (t: TabId) => (t === "globalStyle" ? 2 : countTab(t) > 0 ? 1 : 0);
            return rank(b) - rank(a);
          })
          .map((t) => {
          const open     = openTabs.has(t);
          const count    = countTab(t);
          const scopeTab = isScopeTab(t);
          const selected = count > 0;
          return (
            <div
              key={t}
              className={[
                "rounded-lg border transition-colors",
                selected ? "border-violet-400/40 bg-violet-400/5" : "border-bg-border/40 bg-bg-panel/20",
              ].join(" ")}
            >
              {/* ── ヘッダー行（クリックで開閉）── */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => toggleOpen(t)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span className={["text-[10px] w-3 shrink-0", open ? "text-white/70" : "text-white/40"].join(" ")}>
                    {open ? "▼" : "▶"}
                  </span>
                  <span className={["text-[13px] font-semibold leading-none", selected ? "text-violet-100" : "text-white/70"].join(" ")}>
                    {tabLabel(t)}
                  </span>
                  {count > 0 ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-violet-400/50 bg-violet-400/15 text-violet-100 leading-none shrink-0">
                      {count}件
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/25 leading-none shrink-0">0</span>
                  )}
                </button>
                {scopeTab && open && (
                  <>
                    <button
                      type="button"
                      onClick={() => resetScope(t)}
                      title="このカテゴリをクリア"
                      className="px-2 py-0.5 text-[10px] rounded border border-bg-border/60 text-white/60 hover:text-white hover:border-bg-border transition leading-none shrink-0"
                    >
                      クリア
                    </button>
                    <button
                      type="button"
                      onClick={() => randomizeTabId(t)}
                      title="このカテゴリをランダム"
                      className="px-2 py-0.5 text-[10px] rounded border border-bg-border/60 text-white/60 hover:text-violet-300 hover:border-violet-400/50 transition leading-none shrink-0"
                    >
                      🎲
                    </button>
                  </>
                )}
              </div>

              {/* ── 中身（開いている時のみ）── */}
              {open && (
                <div className="px-2.5 pb-2.5 pt-1 border-t border-bg-border/25 dc-accordion-body">
                  {renderTabContent(t)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-text-muted/35 mt-4 leading-tight">
        設定なし＝プロンプト省略　おまかせ＝案ごとに変化　選択＝固定
      </p>
    </section>
  );
}
