import { useState } from "react";
import type {
  Scope,
  Mood,
  Count,
  DetailSettings,
  PromptTarget,
  Expression,
  ColorStrategy,
  ArtStyle,
  AspectRatioPreset,
} from "../types";
import type { ZozoTrend } from "./zozoTrend";
import { loadSettings, type PersistedSettings } from "./settingsPersist";

/**
 * 永続設定（PersistedSettings の30項目）の state 群を集約するフック。
 * App.tsx に散在していた `loadSettings()` + useState 群をここへ移設（App分割 Phase4a）。
 *
 * 設計上の鉄則：
 * - App 側は戻り値を **同名で分割代入** して受け取る。これにより buildInputs / JSX /
 *   各ハンドラのクロージャは従来と同じ識別子を解決でき、呼び出し側の本体を一切変更しない。
 * - `dimensionLevel` は互換のため値のみ返す（setter なし。UI からは外している）。
 * - 永続化 effect（保存 / storage 同期 / アスペクト比記憶）は Phase4a では App.tsx に残す。
 *   分割代入した値・setter を読むだけで従来どおり動く。effect の移設は Phase4b で行う。
 * - `avoidRealBackground` は非永続（既定ON）のため本フックには含めない（App 側に残置）。
 */
export function usePersistedSettings() {
  const [s0] = useState<PersistedSettings>(() => loadSettings());

  const [scopes, setScopes] = useState<Scope[]>(s0.scopes);
  const [moods, setMoods] = useState<Mood[]>(s0.moods);
  const [autoMoodCategories, setAutoMoodCategories] = useState<string[]>(s0.autoMoodCategories);
  const [count, setCount] = useState<Count>(s0.count);
  const [details, setDetails] = useState<DetailSettings>(s0.details);
  const [extraInstructions, setExtraInstructions] = useState(s0.extraInstructions);
  const [ngList, setNgList] = useState(s0.ngList);
  const [bodyPoseLock, setBodyPoseLock] = useState(s0.bodyPoseLock);
  const [colorMoodLock, setColorMoodLock] = useState(s0.colorMoodLock);
  const [compositionLock, setCompositionLock] = useState(s0.compositionLock);
  const [viralMode, setViralMode] = useState(s0.viralMode);
  const [avoidCliche, setAvoidCliche] = useState(s0.avoidCliche);
  const [strength, setStrength] = useState(s0.strength);
  const [glossLevel, setGlossLevel] = useState(s0.glossLevel);
  // dimensionLevel は互換のため state に持つ（旧履歴・旧設定の保存のため）。UI からは外した。
  const [dimensionLevel] = useState(s0.dimensionLevel);
  const [realismLevel, setRealismLevel] = useState<number>(s0.realismLevel ?? 3);
  const [realismType, setRealismType] = useState<string | null>(s0.realismType ?? null);
  const [textureOriginal, setTextureOriginal] = useState(s0.textureOriginal);
  const [textureDisabled, setTextureDisabled] = useState(s0.textureDisabled);
  const [promptTarget, setPromptTarget] = useState<PromptTarget | null>(s0.promptTarget);
  const [faceLock, setFaceLock] = useState<boolean>(s0.faceLock);
  const [expression, setExpression] = useState<Expression | null>(s0.expression);
  const [colorStrategy, setColorStrategy] = useState<ColorStrategy | null>(s0.colorStrategy);
  const [artStyle, setArtStyle] = useState<ArtStyle | null>(s0.artStyle);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<AspectRatioPreset | null>(s0.defaultAspectRatio);
  const [favoriteLearnEnabled, setFavoriteLearnEnabled] = useState<boolean>(s0.favoriteLearnEnabled);
  const [favoriteStrength, setFavoriteStrength] = useState<number>(s0.favoriteStrength);
  const [zozoApplied, setZozoApplied] = useState<ZozoTrend | null>(s0.zozoApplied);
  const [activeBoosts, setActiveBoosts] = useState<string[]>(s0.activeBoosts);
  const [windLevel, setWindLevel] = useState<number>(s0.windLevel);

  return {
    scopes, setScopes,
    moods, setMoods,
    autoMoodCategories, setAutoMoodCategories,
    count, setCount,
    details, setDetails,
    extraInstructions, setExtraInstructions,
    ngList, setNgList,
    bodyPoseLock, setBodyPoseLock,
    colorMoodLock, setColorMoodLock,
    compositionLock, setCompositionLock,
    viralMode, setViralMode,
    avoidCliche, setAvoidCliche,
    strength, setStrength,
    glossLevel, setGlossLevel,
    dimensionLevel,
    realismLevel, setRealismLevel,
    realismType, setRealismType,
    textureOriginal, setTextureOriginal,
    textureDisabled, setTextureDisabled,
    promptTarget, setPromptTarget,
    faceLock, setFaceLock,
    expression, setExpression,
    colorStrategy, setColorStrategy,
    artStyle, setArtStyle,
    defaultAspectRatio, setDefaultAspectRatio,
    favoriteLearnEnabled, setFavoriteLearnEnabled,
    favoriteStrength, setFavoriteStrength,
    zozoApplied, setZozoApplied,
    activeBoosts, setActiveBoosts,
    windLevel, setWindLevel,
  };
}
