import { useState, useEffect } from "react";
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
import { loadSettings, saveSettings, STORAGE_KEY as SETTINGS_STORAGE_KEY, type PersistedSettings } from "./settingsPersist";
import type { CustomInstructionItem } from "./customInstructionItems";

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
 * - `avoidRealBackground` は永続化（既定ON）。App 側の standalone useState から本フックへ移管
 *   （写実背景を減らす設定をセッション跨ぎで保持するため）。表示・解除は既存の DominatorBadge で可視化済み。
 */
export function usePersistedSettings() {
  const [s0] = useState<PersistedSettings>(() => loadSettings());

  const [scopes, setScopes] = useState<Scope[]>(s0.scopes);
  const [moods, setMoods] = useState<Mood[]>(s0.moods);
  const [autoMoodCategories, setAutoMoodCategories] = useState<string[]>(s0.autoMoodCategories);
  const [count, setCount] = useState<Count>(s0.count);
  const [details, setDetails] = useState<DetailSettings>(s0.details);
  const [extraInstructions, setExtraInstructions] = useState(s0.extraInstructions);
  const [customInstruction, setCustomInstruction] = useState<string>(s0.customInstruction ?? "");
  /** ✏ 指示欄の項目分割（段階1）。commit1時点ではloadSettings()の一度きり移行でのみ書き込まれる
   *  （表示は仮＝App/ControlPanelはまだ本stateを消費しない・buildInputs/§5は customInstruction のまま不変）。 */
  const [customInstructionItems, setCustomInstructionItems] = useState<CustomInstructionItem[]>(s0.customInstructionItems ?? []);
  const [ngList, setNgList] = useState(s0.ngList);
  const [tagNg, setTagNg] = useState<string[]>(s0.tagNg ?? []);
  const [bodyPoseLock, setBodyPoseLock] = useState(s0.bodyPoseLock);
  const [colorMoodLock, setColorMoodLock] = useState(s0.colorMoodLock);
  const [compositionLock, setCompositionLock] = useState(s0.compositionLock);
  const [viralMode, setViralMode] = useState(s0.viralMode);
  const [avoidCliche, setAvoidCliche] = useState(s0.avoidCliche);
  const [avoidRealBackground, setAvoidRealBackground] = useState<boolean>(s0.avoidRealBackground ?? true);
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
  /** ✨派手さ→配色 連動（既定ON）。×解除をセッション跨ぎで保持（非永続だとリロードで連動が勝手に復活する不具合の防止）。 */
  const [decorationColorLink, setDecorationColorLink] = useState<boolean>(s0.decorationColorLink ?? true);

  // ── 永続化 effect（App分割 Phase4b でここへ集約。挙動は App 時代と同一）──────────

  // アスペクト比が非skip値に変更されたらデフォルトとして自動記憶
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const preset = details.aspectRatio?.preset;
    if (preset && preset !== "skip") {
      setDefaultAspectRatio(preset as AspectRatioPreset);
    }
  }, [details.aspectRatio?.preset]);

  // 設定変更のたびに localStorage へ自動保存（ページを閉じても復元できるように）
  useEffect(() => {
    saveSettings({
      scopes, moods, autoMoodCategories, count, details,
      extraInstructions, customInstruction, customInstructionItems, ngList, tagNg, viralMode, strength, glossLevel,
      dimensionLevel, realismLevel, realismType, textureOriginal, textureDisabled,
      promptTarget, avoidCliche, avoidRealBackground,
      bodyPoseLock, colorMoodLock, compositionLock,
      colorStrategy,
      faceLock, expression,
      artStyle, defaultAspectRatio,
      favoriteLearnEnabled, favoriteStrength,
      zozoApplied, activeBoosts, windLevel, decorationColorLink,
    });
  }, [
    scopes, moods, autoMoodCategories, count, details,
    extraInstructions, customInstruction, customInstructionItems, ngList, tagNg, viralMode, strength, glossLevel,
    dimensionLevel, realismLevel, realismType, textureOriginal, textureDisabled,
    promptTarget, avoidCliche, avoidRealBackground,
    bodyPoseLock, colorMoodLock, compositionLock,
    colorStrategy,
    faceLock, expression,
    artStyle, defaultAspectRatio,
    favoriteLearnEnabled, favoriteStrength,
    zozoApplied, activeBoosts, windLevel, decorationColorLink,
  ]);

  // 他タブの設定変更を storage イベントで受け取り UI に反映（マルチタブ相互上書き対策）
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== SETTINGS_STORAGE_KEY) return;
      const next = loadSettings();
      setScopes(next.scopes);
      setMoods(next.moods);
      setAutoMoodCategories(next.autoMoodCategories);
      setCount(next.count);
      setDetails(next.details);
      setExtraInstructions(next.extraInstructions);
      setCustomInstruction(next.customInstruction ?? "");
      setCustomInstructionItems(next.customInstructionItems ?? []);
      setNgList(next.ngList);
      setTagNg(next.tagNg);
      setViralMode(next.viralMode);
      setStrength(next.strength);
      setGlossLevel(next.glossLevel);
      setRealismLevel(next.realismLevel);
      setRealismType(next.realismType);
      setTextureOriginal(next.textureOriginal);
      setTextureDisabled(next.textureDisabled);
      setPromptTarget(next.promptTarget);
      setAvoidCliche(next.avoidCliche);
      setAvoidRealBackground(next.avoidRealBackground);
      setBodyPoseLock(next.bodyPoseLock);
      setColorMoodLock(next.colorMoodLock);
      setCompositionLock(next.compositionLock);
      setColorStrategy(next.colorStrategy);
      setFaceLock(next.faceLock);
      setExpression(next.expression);
      setArtStyle(next.artStyle);
      setDefaultAspectRatio(next.defaultAspectRatio);
      setFavoriteLearnEnabled(next.favoriteLearnEnabled);
      setFavoriteStrength(next.favoriteStrength);
      setZozoApplied(next.zozoApplied);
      setActiveBoosts(next.activeBoosts);
      setWindLevel(next.windLevel);
      setDecorationColorLink(next.decorationColorLink ?? true);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return {
    scopes, setScopes,
    moods, setMoods,
    autoMoodCategories, setAutoMoodCategories,
    count, setCount,
    details, setDetails,
    extraInstructions, setExtraInstructions,
    customInstruction, setCustomInstruction,
    customInstructionItems, setCustomInstructionItems,
    ngList, setNgList,
    tagNg, setTagNg,
    bodyPoseLock, setBodyPoseLock,
    colorMoodLock, setColorMoodLock,
    compositionLock, setCompositionLock,
    viralMode, setViralMode,
    avoidCliche, setAvoidCliche,
    avoidRealBackground, setAvoidRealBackground,
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
    decorationColorLink, setDecorationColorLink,
  };
}
