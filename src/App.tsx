import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { MiniExplorer } from "./components/MiniExplorer";
import { FavoritesPanel } from "./components/FavoritesPanel";
import { ImageSidebar } from "./components/ImageSidebar";
import { PromptList } from "./components/PromptList";
import { DetailsCard } from "./components/DetailsCard";
import { QuickActions } from "./components/QuickActions";
import { ControlPanel } from "./components/ControlPanel";
import { HistoryView } from "./components/HistoryView";
import { GenerationProgress } from "./components/GenerationProgress";
import { PromptTargetSelector } from "./components/PromptTargetSelector";
import { SelectionPromptModal } from "./components/SelectionPromptModal";
import { SimpleImageEditor } from "./components/SimpleImageEditor";
import { CompletionToast } from "./components/CompletionToast";
import { PresetAppliedToast } from "./components/PresetAppliedToast";
import { ReflectionStatusBar } from "./components/ReflectionStatusBar";
import { generateViaBackend, analyzePreferencesViaBackend } from "./lib/backendClient";
import { loadSettings, saveSettings, type PersistedSettings } from "./lib/settingsPersist";
import { getNotifSettings } from "./lib/notificationSettings";
import { playCompletionSound } from "./lib/completionSound";
import {
  buildAntiTemplateInputs,
  buildArrangeInputs,
  buildCombinedAssistInputs,
  buildCombinedCultureInputs,
  buildCombinedEffectInputs,
  buildCombinedGodInputs,
  buildCombinedSnsInputs,
  buildCombinedWorldInputs,
  buildCultureInputs,
  buildGodInputs,
  buildCompositionGodInputs,
  buildRandomInputs,
  buildSnsInputs,
  buildVariantInputs,
  buildViralInputs,
  buildImageViralInputs,
  getCultureLabel,
  getSnsLabel,
  GOD_MODE_DISPLAY,
  WORLD_PRESET_DISPLAY,
} from "./lib/quickActions";
import { buildChaosFusionInputs, formatChaosLabel } from "./lib/chaosEngine";
import { analyzeBias, type BiasAnalysisResult, type HistoryEntry } from "./lib/biasAnalyzer";
import { analyzeFullHistory, filterRecentWindow, WINDOW_DAYS, type FullHistoryAnalysis } from "./lib/historyAnalyzer";
import { DuplicateAnalysisPanel } from "./components/DuplicateAnalysisPanel";
import { ReferenceImportPanel, REFERENCE_CATEGORIES, referenceLockReason } from "./components/ReferenceImportPanel";
import { CompareModeView } from "./components/CompareModeView";
import { AnalysisLabPanel } from "./components/AnalysisLabPanel";
import {
  loadLevels, saveLevels, setLevel as setLevelFn, resetAllLevels, bulkSetLevels, clearNgLevels,
  isApplied, setAppliedStorage,
  getNgTokens, getMotifControls,
  computeAutoAdjust, countLevels, countComboPolicies,
  loadComboPolicies, saveComboPolicies, setComboPolicy as setComboPolicyFn,
  resetComboPolicies, getComboControls, getNgPhrasesFromCombos,
  type LevelMap, type MotifLevel,
  type ComboPolicy, type ComboPolicyMap,
} from "./lib/motifPolicy";
import {
  loadForbiddenTokens,
  saveForbiddenTokens,
  mergeForbiddenIntoNgList,
} from "./lib/forbiddenTokens";
// MassProductionBanner は DuplicateAnalysisPanel に統合されました。
import type { WorldPreset, EffectPreset, SnsType, CultureType } from "./components/QuickActions";
import { type VariationMemory, createEmptyMemory, updateMemory } from "./lib/variationEngine";
import type { ColorStrategy, Era, Expression } from "./types";
import {
  buildHistoryItems,
  getAll,
  saveBatch,
  uid,
  updateItem as updateItemDb,
  buildResultImagesPatch,
} from "./lib/history";
import { getRecentGenres, pushRecentGenres, clearRecentGenres } from "./lib/genreHistory";
import { getRecentSubStyles, pushRecentSubStyles, clearRecentSubStyles } from "./lib/subStyleHistory";
import { runAutoCleanup, getAutoCleanupEnabled } from "./lib/cleanup";
import { makeThumbnail } from "./lib/imageThumb";
import { saveReferenceRecord } from "./lib/referenceRecords";
import { loadReferenceLearning, type ReferenceLearning } from "./lib/referenceLearning";
import {
  type AppView,
  type Count,
  type DetailSettings,
  type Mood,
  type PromptHistoryItem,
  type PromptInputs,
  type PromptTarget,
  type Scope,
  type ArrangeResult,
  type GeneratedProposal,
} from "./types";
import { DEFAULT_DETAILS } from "./types";
import { computeChangedAxes, arrangeCandidateScopes, buildElementFilterInstruction } from "./lib/arrange";
import { buildFavoriteProfile, type FavoriteProfile } from "./lib/favoriteProfile";
import { analyzeAgent, type AgentActionId } from "./lib/aiAgent";
import { BoostControls } from "./components/BoostControls";
import type { ZozoTrend } from "./lib/zozoTrend";
import { analyzeColors, type ColorAnalysis } from "./lib/colorAnalyzer";
import {
  loadAllFeatures, buildAnalysis as buildImageAnalysis,
  runProgressiveAnalysis, primaryResultImage,
  type ImageAnalysisResult, type ImageFeature,
} from "./lib/imageAnalyzer";
import {
  analyzeRatings, buildRatingBiasPayload,
  type RatingAnalysis,
} from "./lib/ratingAnalyzer";
import { SkyveilBar } from "./components/SkyveilBar";
import {
  buildSkyveilProfile, favoriteToStrength, STRENGTH_TO_FAVORITE,
  type SkyveilStrength, type SkyveilProfile,
} from "./lib/skyveilProfile";
import { logOperation } from "./lib/operationLog";
import { deriveLockState } from "./lib/promptLockCheck";
import { analyzeIdentityRisk } from "./lib/identityRisk";
import { GlobalProtectionBar } from "./components/GlobalProtectionBar";
import { AnalysisStatusStrip, type AnalysisCategoryView } from "./components/AnalysisStatusStrip";
import { RecoveryPanel } from "./components/RecoveryPanel";
import { useAnalysisLive } from "./lib/useAnalysisLive";
import { AnalysisLiveView } from "./components/AnalysisLiveView";
import {
  extractSuccessPromptPatterns, type SuccessPromptPattern,
} from "./lib/successPatterns";
import {
  previewSuccessPattern, applyPreviewedScopes, type LearningApplyPreviewResult,
} from "./lib/learningPreview";
import { PostingCalendarModal } from "./components/PostingCalendarModal";
import {
  loadPreferenceProfile, savePreferenceProfile, clearPreferenceProfile,
  loadAutoLearn, saveAutoLearn,
  loadAutoLastCount, saveAutoLastCount,
  collectSamples, MIN_SAMPLES,
  AUTO_NEW_SAMPLE_THRESHOLD, AUTO_COOLDOWN_MS, AUTO_DEBOUNCE_MS,
  type PreferenceProfile,
} from "./lib/preferenceProfile";
import {
  loadColorWeights, saveColorWeights, setColorWeight as setColorWeightFn,
  resetColorWeights, getColorWeightControls, getBlockedColorTokens,
  autoAdjustColorWeights,
  type ColorWeight, type ColorWeightMap, type ColorAxisCtrl,
} from "./lib/colorPolicy";

// ── 代表ボタン用ランダムピック定数（モジュールレベル） ────────────────────────
const SNS_TYPES: SnsType[] = ["x_buzz", "instagram", "tiktok", "pinterest", "thumbnail", "icon", "scroll_stop", "save", "double_take", "global"];
const CULTURE_TYPES: CultureType[] = ["korea_ad", "china_future", "hk_neon", "shibuya_night", "harajuku_pop", "tokyo_cyber", "taiwan_neon", "la_90s", "nyc_street", "paris_luxury", "milan_runway", "berlin_industrial", "nordic_minimal", "london_punk", "dubai_luxury", "mumbai", "seoul_night", "osaka_town", "bangkok", "sao_paulo"];

export default function App() {
  const [s0] = useState<PersistedSettings>(() => loadSettings());

  const [view, setView] = useState<AppView>("main");
  const [historyFavoritesOnly, setHistoryFavoritesOnly] = useState(false);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Scope[]>(s0.scopes);
  const [moods, setMoods] = useState<Mood[]>(s0.moods);
  const [autoMoodCategories, setAutoMoodCategories] = useState<string[]>(s0.autoMoodCategories);
  const [count, setCount] = useState<Count>(s0.count);
  const [details, setDetails] = useState<DetailSettings>(s0.details);
  const [extraInstructions, setExtraInstructions] = useState(s0.extraInstructions);
  const [ngList, setNgList] = useState(s0.ngList);
  const [bodyPoseLock,    setBodyPoseLock]    = useState(s0.bodyPoseLock);
  const [colorMoodLock,   setColorMoodLock]   = useState(s0.colorMoodLock);
  const [compositionLock, setCompositionLock] = useState(s0.compositionLock);
  const [viralMode, setViralMode] = useState(s0.viralMode);
  const [avoidCliche, setAvoidCliche] = useState(s0.avoidCliche);
  const [strength, setStrength] = useState(s0.strength);
  const [glossLevel,       setGlossLevel]       = useState(s0.glossLevel);      // 1-5, 3=標準
  // dimensionLevel は互換のため state に持つ（旧履歴・旧設定の保存のため）。UI からは外した。
  const [dimensionLevel]                        = useState(s0.dimensionLevel);  // 1-5, 3=2.5D
  /** 質感・リアル度（1=完全2D ↔ 5=写真リアル）。既定 3 = 2.5D */
  const [realismLevel,     setRealismLevel]     = useState<number>(s0.realismLevel ?? 3);
  /** 質感タイプ（"anime_bg" 等、null = 指定なし） */
  const [realismType,      setRealismType]      = useState<string | null>(s0.realismType ?? null);
  const [textureOriginal,  setTextureOriginal]  = useState(s0.textureOriginal); // 元画像維持
  const [textureDisabled,  setTextureDisabled]  = useState(s0.textureDisabled); // プロンプトに反映しない
  /** 出力先プラットフォームに合わせた安全モード（null = 解除済み・フィルタなし） */
  const [promptTarget, setPromptTarget] = useState<PromptTarget | null>(s0.promptTarget);
  /** アクティブな世界観プリセット（マルチセレクト、最大3） */
  const [activeWorldPresets, setActiveWorldPresets] = useState<WorldPreset[]>([]);
  /** 世界観プリセット由来の指示文（extraInstructions と分離して管理） */
  const [worldCombinedNote, setWorldCombinedNote] = useState("");
  /** 参照画像から「適用」した軸タグ付き自由文（catKey → text）。生成時に extraInstructions へ統合。
   *  ※ 詳細 enum には自動反映しない（docs/23）。worldCombinedNote と同じ追加マージ方式。 */
  const [referenceNote, setReferenceNote] = useState<Record<string, string>>({});
  /** referenceNote を「【参照画像から強制適用】」独立ブロックに整形（生成時に extraInstructions へ統合）。
   *  生成ロジック本体は不変。参照要素を最優先で反映させるため、強い宣言付きブロックにする。 */
  const referenceNoteText = useMemo(() => {
    const lines = REFERENCE_CATEGORIES
      .filter((c) => (referenceNote[c.key] ?? "").trim())
      .map((c) => `${c.label}：${referenceNote[c.key].trim()}`);
    if (lines.length === 0) return "";
    return [
      "【参照画像から強制適用】",
      ...lines,
      "上記の参照要素は優先度最高で必ず反映する。自動生成のジャンル・世界観・他の変更指示よりも優先する。",
      "参照画像の雰囲気・構図・色味・空気感を保つこと。参照画像に無い要素を勝手に足さないこと。",
    ].join("\n");
  }, [referenceNote]);
  /** Compare Mode 用：参照画像＋抽出13カテゴリを生成時に参照レコードへ残すための ref（再描画不要）。
   *  パネルから image / extracted が変わるたびに最新を受け取る。生成・抽出ロジックには影響しない。 */
  const referenceContextRef = useRef<{ image: string; extracted: Record<string, string> } | null>(null);
  const handleReferenceContextChange = useCallback(
    (ctx: { image: string; extracted: Record<string, string> } | null) => {
      referenceContextRef.current = ctx;
    },
    [],
  );
  /** referenceNote を runGenerate（deps非依存）から最新参照するための ref。 */
  const referenceNoteRef = useRef<Record<string, string>>({});
  useEffect(() => {
    referenceNoteRef.current = referenceNote;
  }, [referenceNote]);
  /** Compare Mode（参照↔生成 比較ビュー）の開閉。Reference Picker の「🆚 比較」から開く。 */
  const [compareOpen, setCompareOpen] = useState(false);
  /** 分析ラボ（重複分析の詳細探索・全幅ビュー）の開閉。ダッシュボードの「🔬 分析ラボ」から開く。 */
  const [analysisLabOpen, setAnalysisLabOpen] = useState(false);
  /** Phase D: Compare評価(referenceRecords)を集計した好み素材。マウント＋Compareクローズ（評価後）に再読込。 */
  const [referenceLearning, setReferenceLearning] = useState<ReferenceLearning | null>(null);
  useEffect(() => {
    if (!compareOpen) void loadReferenceLearning().then(setReferenceLearning);
  }, [compareOpen]);
  /** スコープボタンのフラッシュアニメーション用キー（インクリメントで発火） */
  const [scopeFlashKey, setScopeFlashKey] = useState(0);
  /** 多様性エンジン：直近の背景/衣装/ムード/前景エフェクトを記憶して連発を防ぐ */
  const [variationMemory, setVariationMemory] = useState<VariationMemory>(createEmptyMemory);
  /** 顔/同一性ロック（初期ON）*/
  const [faceLock, setFaceLock] = useState<boolean>(s0.faceLock);
  /** 表情指定（faceLock: false 時のみ有効）*/
  const [expression, setExpression] = useState<Expression | null>(s0.expression);
  /** 時代軸（null = 設定なし）*/
  const [era, setEra] = useState<Era | null>(s0.era);
  /** 色戦略（null = 設定なし）*/
  const [colorStrategy, setColorStrategy] = useState<ColorStrategy | null>(s0.colorStrategy);
  /** 絵柄スタイル（null = 設定なし）*/
  const [artStyle, setArtStyle] = useState<import("./types").ArtStyle | null>(s0.artStyle);
  /** デフォルトアスペクト比（null = なし）*/
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<import("./types").AspectRatioPreset | null>(s0.defaultAspectRatio);
  /** お気に入り学習：反映ON/OFF・強度・プロファイル */
  const [favoriteLearnEnabled, setFavoriteLearnEnabled] = useState<boolean>(s0.favoriteLearnEnabled);
  const [favoriteStrength, setFavoriteStrength] = useState<number>(s0.favoriteStrength);
  const [favoriteProfile, setFavoriteProfile] = useState<FavoriteProfile | null>(null);
  // skyveil好みAI：ON/OFF と強度は既存の favoriteLearnEnabled / favoriteStrength を流用（単一の真実）。
  // oneShot は「今回だけ反映」用の一時フラグ（生成後にクリア）。
  const [skyveilOneShot, setSkyveilOneShot] = useState<boolean>(false);
  /** ZOZOトレンド：反映中のトレンド（null = 未反映）。衣装ON時のみ送信。永続化 */
  const [zozoApplied, setZozoApplied] = useState<ZozoTrend | null>(s0.zozoApplied);
  /** 禁止トークン（意味ベースで類語展開してプロンプトから除外） */
  const [forbiddenTokens, setForbiddenTokens] = useState<string[]>(() => loadForbiddenTokens());
  /** カオス神引きのラベル（直前の融合結果表示） */
  const [chaosLabel, setChaosLabel] = useState<string | null>(null);
  /** アクティブな神引きモード配列（最大2コンボ。solo: normal/chaos/composition、combo: outfit/bg/color/world_god/props/bigobject/myth/movie） */
  const [activeGodModes,    setActiveGodModes]    = useState<string[]>([]);
  /** 神引き補助モディファイア（複数選択可。avoid_overlap/other_world/buzz/face_pop）。永続化 */
  const [activeBoosts,      setActiveBoosts]      = useState<string[]>(s0.activeBoosts);
  /** 風の強さ 0–5（初期0）。永続化 */
  const [windLevel,         setWindLevel]         = useState<number>(s0.windLevel);
  const handleBoostToggle = useCallback((id: string) => {
    setActiveBoosts((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
  }, []);
  /** アクティブな演出プリセット（マルチセレクト、最大2） */
  const [activeEffectTypes, setActiveEffectTypes] = useState<EffectPreset[]>([]);
  /** アクティブな SNS バズタイプ（マルチセレクト、最大2） */
  const [activeSnsTypes,    setActiveSnsTypes]    = useState<SnsType[]>([]);
  /** アクティブなカルチャータイプ（マルチセレクト、最大2） */
  const [activeCultureTypes, setActiveCultureTypes] = useState<CultureType[]>([]);
  /** アクティブな生成補助モード（"gap" | "anti"、最大2コンボ） */
  const [activeAssistModes,  setActiveAssistModes]  = useState<string[]>([]);
  /** 量産AI / 偏り分析結果（バナー表示用） */
  const [massProductionResult, setMassProductionResult] = useState<BiasAnalysisResult | null>(null);
  /** 全履歴分析結果（重複分析センター用） */
  const [historyAnalysis, setHistoryAnalysis] = useState<FullHistoryAnalysis | null>(null);
  /** 履歴の生アイテム（色分析の入力）。historyAnalysis と同期して更新される */
  const [historyItemsForColor, setHistoryItemsForColor] = useState<PromptHistoryItem[]>([]);
  /** 画像特徴キャッシュ（itemId → ImageFeature） */
  const [imageFeatureMap, setImageFeatureMap] = useState<Map<string, ImageFeature>>(new Map());
  /** 画像分析の進捗 */
  const [imageAnalyzeProgress, setImageAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  const imageAnalyzeAbortRef = useRef<AbortController | null>(null);
  /** モチーフ出現制御レベル（行ごとの 0〜5。永続化） */
  const [levels, setLevels] = useState<LevelMap>(() => loadLevels());
  /** 頻出構成（コンボ）ポリシー：comboKey → block/alt/allow。永続化 */
  const [comboPolicies, setComboPolicies] = useState<ComboPolicyMap>(() => loadComboPolicies());
  const handleComboPolicyChange = useCallback((comboKey: string, p: ComboPolicy) => {
    setComboPolicies((prev) => {
      const next = setComboPolicyFn(prev, comboKey, p);
      saveComboPolicies(next);
      return next;
    });
  }, []);
  /** 色×軸 重み：colorId → { hair, outfit, background }（各 0-5）。永続化 */
  const [colorWeights, setColorWeights] = useState<ColorWeightMap>(() => loadColorWeights());
  const handleColorWeightChange = useCallback((colorId: string, axis: ColorAxisCtrl, w: ColorWeight) => {
    setColorWeights((prev) => {
      const next = setColorWeightFn(prev, colorId, axis, w);
      saveColorWeights(next);
      return next;
    });
  }, []);
  const handleColorWeightsReset = useCallback(() => {
    setColorWeights(() => {
      const next = resetColorWeights();
      saveColorWeights(next);
      return next;
    });
  }, []);
  /** 色重み自動調整の Undo スタック */
  const [colorWeightsUndoStack, setColorWeightsUndoStack] = useState<ColorWeightMap[]>([]);
  /** 直近で自動調整された (colorId,axis) ペアの集合（行ハイライト用） */
  const [colorChangedKeys, setColorChangedKeys] = useState<ReadonlySet<string>>(new Set());
  const colorChangedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 色分析の対象ウィンドウ（50件 or 100件） */
  const [colorWindowSize, setColorWindowSize] = useState<50 | 100>(50);
  /** 反映状態（true = 生成ロジックへ実際に流す）。永続化 */
  const [policyApplied, setPolicyAppliedState] = useState<boolean>(() => isApplied());

  // ── 出現制御ハンドラ ──
  const handleLevelChange = useCallback((motifId: string, level: MotifLevel) => {
    setLevels((prev) => {
      const next = setLevelFn(prev, motifId, level);
      saveLevels(next);
      return next;
    });
  }, []);
  const handleBulkLevel = useCallback((motifIds: string[], level: MotifLevel) => {
    setLevels((prev) => {
      const next = bulkSetLevels(prev, motifIds, level);
      saveLevels(next);
      return next;
    });
  }, []);
  const handleClearNg = useCallback(() => {
    setLevels((prev) => {
      const next = clearNgLevels(prev);
      saveLevels(next);
      return next;
    });
  }, []);
  // 自動調整 state（実体ハンドラは showPresetToast 定義後に登録）
  const [levelsUndoStack, setLevelsUndoStack] = useState<LevelMap[]>([]);
  const [changedIds,      setChangedIds]      = useState<ReadonlySet<string>>(new Set());
  const changedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleApplyPolicies = useCallback(() => {
    setPolicyAppliedState(true);
    setAppliedStorage(true);
    void logOperation("policy_apply");
  }, []);
  const handleUnapplyPolicies = useCallback(() => {
    setPolicyAppliedState(false);
    setAppliedStorage(false);
  }, []);
  const handleResetPolicies = useCallback(() => {
    const empty = resetAllLevels();
    setLevels(empty);
    saveLevels(empty);
    const emptyCombo = resetComboPolicies();
    setComboPolicies(emptyCombo);
    saveComboPolicies(emptyCombo);
    setPolicyAppliedState(false);
    setAppliedStorage(false);
  }, []);
  /** ファッションプリセット適用トースト */
  const [fashionToastTrigger, setFashionToastTrigger] = useState(0);
  const [fashionToastMsg,     setFashionToastMsg]     = useState("");
  const [fashionToastHint,    setFashionToastHint]    = useState("");
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  /** 最後に正常生成できた items のバックアップ。
   *  履歴/お気に入り画面から戻った時に items が空でも復元できるようにする。 */
  const lastItemsRef = useRef<PromptHistoryItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("ipm_explorer_open");
      if (saved !== null) return saved === "true";
      return window.innerWidth >= 1024; // PC: デフォルト開く、モバイル: 閉じる
    } catch {
      return false;
    }
  });
  const [favPanelOpen, setFavPanelOpen] = useState(false);
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [simpleEditorOpen,   setSimpleEditorOpen]   = useState(false);
  /** ⑤ 生成完了後1.5秒だけ true → ボタンを「✅ 完了！」表示 */
  const [justCompleted, setJustCompleted] = useState(false);
  /** ③ インクリメントするたびトーストを1回表示 */
  const [toastTrigger, setToastTrigger] = useState(0);
  /** Explorer パネル幅（localStorage に永続化） */
  const [explorerWidth, setExplorerWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("ipm_explorerWidth");
      if (!raw) return 560;
      const n = parseInt(raw, 10);
      return isNaN(n) ? 560 : Math.min(900, Math.max(360, n));
    } catch {
      return 560; // localStorage 利用不可（プライベートブラウジング等）
    }
  });
  const handleExplorerResize = useCallback((w: number) => {
    setExplorerWidth(w);
    localStorage.setItem("ipm_explorerWidth", String(w));
  }, []);
  /** Undo stack: 最大 5 件の過去生成結果を保持 */
  const [undoStack, setUndoStack] = useState<PromptHistoryItem[][]>([]);
  /** アレンジ元プロンプト（バナー表示用） */
  const [arrangeSource, setArrangeSource] = useState<PromptHistoryItem | null>(null);
  /** 「同じ構成で再生成」復元後の確認バナー用 */
  const [restoredItem, setRestoredItem] = useState<PromptHistoryItem | null>(null);
  /** 📅 投稿カレンダーモーダルの開閉 */
  const [postCalendarOpen, setPostCalendarOpen] = useState(false);
  /** 🤖 AI分析ライブビュー */
  const analysisLive = useAnalysisLive();
  /** runGenerate 内で items の最新値を読むためのリファレンス */
  const itemsRef = useRef<PromptHistoryItem[]>(items);
  /** pendingRun の保証発火のためのカウンター（scopes/moods が変わらない場合の保険） */
  const [pendingRunKey, setPendingRunKey] = useState(0);
  const canGenerate = scopes.length > 0;

  // Keep itemsRef in sync so runGenerate can read the current value without a stale closure
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 起動時に自動クリーンアップを実行（設定が ON の場合のみ）
  useEffect(() => {
    if (getAutoCleanupEnabled()) {
      void runAutoCleanup();
    }
  }, []);

  // 起動時に全履歴の偏り分析＋お気に入りプロファイルを実行（既存履歴がある場合のみ）
  useEffect(() => {
    void (async () => {
      try {
        const all = await getAll();
        if (all.length > 0) {
          setHistoryAnalysis(analyzeFullHistory(all, []));
        }
        setHistoryItemsForColor(all);
        const favs = all.filter((i) => i.isFavorite);
        setFavoriteProfile(buildFavoriteProfile(favs));
        // 画像特徴キャッシュも先にロード（未解析分は後で要求された時に走らせる）
        const features = await loadAllFeatures();
        const m = new Map<string, ImageFeature>();
        for (const f of features) m.set(f.id, f);
        setImageFeatureMap(m);
      } catch {
        // 分析失敗は無視
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** お気に入りプロファイルを再構築する（お気に入り変更後に呼ぶ）。
   *  ついでに色分析・画像分析・評価分析の入力 historyItemsForColor も同期する
   *  （履歴削除や評価更新が反映されないバグを防ぐため）。 */
  // 🛟 緊急復旧パネル：履歴/お気に入り表示の再読み込み用。
  // dataVersion を key に渡して HistoryView / FavoritesPanel を再マウント＝IDB を再 getAll させる（リロードなし・非破壊）。
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const reloadAllData = useCallback(() => {
    setDataVersion((v) => v + 1);   // HistoryView / FavoritesPanel を再マウント → 再 getAll
    void refreshFavoriteProfile();  // 分析・AI分析ストリップの件数も再読み込み
  // refreshFavoriteProfile は後方宣言だが、呼び出し時点では定義済み（実行は onClick）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFavoriteProfile = useCallback(async () => {
    try {
      const all = await getAll();
      const favs = all.filter((i) => i.isFavorite);
      const imgs = all.filter((i) => i.resultImageData || (i.resultImageDataList?.length ?? 0) > 0);
      const rated = all.filter((i) => (i.resultRatings?.some((r) => r != null)));
      // ライブビューで読み込み状況を可視化
      analysisLive.start("データ再読み込み + 分析更新", {
        history: all.length,
        images: imgs.length,
        favorites: favs.length,
        ratings: rated.length,
      });
      analysisLive.startStep("loadHistory", `${all.length}件の履歴を読み込み`, all.length);
      analysisLive.completeStep("loadHistory");
      analysisLive.startStep("loadImages", `生成画像 ${imgs.length}件を確認`, imgs.length);
      analysisLive.completeStep("loadImages");
      analysisLive.startStep("loadFavorites", `お気に入り ${favs.length}件を集計`, favs.length);
      setFavoriteProfile(buildFavoriteProfile(favs));
      analysisLive.completeStep("loadFavorites");
      analysisLive.startStep("loadRatings", `評価データ ${rated.length}件を確認`, rated.length);
      setHistoryItemsForColor(all);
      analysisLive.completeStep("loadRatings");
      analysisLive.startStep("favoriteAnalysis", "お気に入り傾向を分析中");
      analysisLive.completeStep("favoriteAnalysis", "お気に入り傾向の集計完了");
      analysisLive.complete("データ同期完了");
    } catch {
      analysisLive.error("データ読み込みに失敗しました");
    }
  }, [analysisLive]);

  // 🔄 view が main に戻った時、items が空なら最後の生成結果を復元する。
  // 理由：履歴/お気に入り画面へ移動→戻った時や、エラー後に items が空になっていた場合の
  //        フォールバック。React の state は view 切り替えで消えないはずだが、
  //        万一消えた場合もこの effect で復元できる。
  useEffect(() => {
    if (view === "main" && items.length === 0 && lastItemsRef.current.length > 0) {
      setItems(lastItemsRef.current);
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explorer 開閉状態を localStorage に保存
  useEffect(() => {
    try { localStorage.setItem("ipm_explorer_open", String(explorerOpen)); } catch { /* ignore */ }
  }, [explorerOpen]);

  // 禁止トークンを localStorage に永続化
  useEffect(() => {
    saveForbiddenTokens(forbiddenTokens);
  }, [forbiddenTokens]);

  // アスペクト比が非skip値に変更されたらデフォルトとして自動記憶
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const preset = details.aspectRatio?.preset;
    if (preset && preset !== "skip") {
      setDefaultAspectRatio(preset as import("./types").AspectRatioPreset);
    }
  }, [details.aspectRatio?.preset]);

  // 設定変更のたびに localStorage へ自動保存（ページを閉じても復元できるように）
  useEffect(() => {
    saveSettings({
      scopes, moods, autoMoodCategories, count, details,
      extraInstructions, ngList, viralMode, strength, glossLevel,
      dimensionLevel, realismLevel, realismType, textureOriginal, textureDisabled,
      promptTarget, avoidCliche,
      bodyPoseLock, colorMoodLock, compositionLock,
      era, colorStrategy,
      faceLock, expression,
      artStyle, defaultAspectRatio,
      favoriteLearnEnabled, favoriteStrength,
      zozoApplied, activeBoosts, windLevel,
    });
  }, [
    scopes, moods, autoMoodCategories, count, details,
    extraInstructions, ngList, viralMode, strength, glossLevel,
    dimensionLevel, realismLevel, realismType, textureOriginal, textureDisabled,
    promptTarget, avoidCliche,
    bodyPoseLock, colorMoodLock, compositionLock,
    era, colorStrategy,
    faceLock, expression,
    artStyle, defaultAspectRatio,
    favoriteLearnEnabled, favoriteStrength,
    zozoApplied, activeBoosts, windLevel,
  ]);

  // stale closure 回避（BUG-1）：preferenceProfile / ratingAnalysis / imageAnalysis は
  // buildInputs より後で宣言されるため依存配列に入れられない（TDZ）。
  // skyveilProfileRef と同じく ref 経由で「最新値」を参照する（生成時には effect 同期済み）。
  const preferenceProfileRef = useRef<PreferenceProfile | null>(null);
  const ratingAnalysisRef = useRef<RatingAnalysis | null>(null);
  const imageAnalysisRef = useRef<ImageAnalysisResult | null>(null);

  /** Phase D: 好みAIへ送る方向性タグ＝お気に入り傾向 ＋ Compare評価 likes（限定重み slice(0,4)・後置）。
   *  コピーではなく方向性。多様性は既存機構（未開拓提案・被り回避・avoidCliche 等）が優先する。 */
  const skyveilFavoriteTraits = useMemo(() => {
    const base = favoriteProfile?.traitPhrases ?? [];
    const extra = (referenceLearning?.likes ?? []).slice(0, 4);
    return Array.from(new Set([...base, ...extra])).slice(0, 12);
  }, [favoriteProfile, referenceLearning]);

  const buildInputs = useCallback(
    (override?: Partial<PromptInputs>): PromptInputs => ({
      scopes,
      target: "unified",
      moods,
      autoMoodCategories,
      count,
      // 顔・表情・同一性は faceLock + Identity Shield で保護（locks には含めない）。
      // 体型/色味/構図はUIトグルから。参照: docs/09_face-lock統合.md
      locks: {
        body_shape:   bodyPoseLock,
        color:        colorMoodLock,
        camera:       compositionLock,
        aspect_ratio: compositionLock,
      },
      safety:   "fictional_ai",
      details,
      // worldCombinedNote（世界観プリセット由来）・referenceNote（参照画像から適用）・追加指示を結合
      // （出現制御は motifControls で別途反映）
      extraInstructions: [worldCombinedNote, referenceNoteText, extraInstructions].filter(Boolean).join("\n\n"),
      faceLock,
      expression: faceLock ? undefined : (expression ?? undefined),
      ngList: (() => {
        let base = mergeForbiddenIntoNgList(ngList, forbiddenTokens);
        // 禁止色（weight=0）の代表トークン（policyApplied に依存しない・色は明示UI設定なので常に効かせる）
        const blockedColorTokens = getBlockedColorTokens(colorWeights);
        if (blockedColorTokens.length > 0) {
          const joined = blockedColorTokens.join(", ");
          base = base ? `${base}\n${joined}` : joined;
        }
        if (!policyApplied) return base;
        // モチーフ単体の完全NG
        const ngTokens = getNgTokens(levels);
        if (ngTokens.length > 0) {
          const joined = ngTokens.join(", ");
          base = base ? `${base}\n${joined}` : joined;
        }
        // 頻出構成 block の同時使用禁止フレーズも ngList に追加
        if (historyAnalysis && historyAnalysis.topCombos.length > 0) {
          const keyToCombo = new Map(
            historyAnalysis.topCombos.map((c) => [c.comboKey, { motifLabels: c.motifLabels, motifIds: c.motifIds }])
          );
          const phrases = getNgPhrasesFromCombos(comboPolicies, keyToCombo);
          if (phrases.length > 0) {
            const joined = phrases.join("、");
            base = base ? `${base}\n${joined}` : joined;
          }
        }
        return base;
      })(),
      // 重複制御：反映ON時のみ、非4レベルのモチーフをサーバへ渡す
      motifControls: policyApplied ? getMotifControls(levels) : undefined,
      // 構成制御：反映ON時のみ、block/alt のコンボをサーバへ渡す
      comboControls: (() => {
        if (!policyApplied || !historyAnalysis) return undefined;
        const keyToCombo = new Map(
          historyAnalysis.topCombos.map((c) => [c.comboKey, { motifLabels: c.motifLabels, motifIds: c.motifIds }])
        );
        const ctrl = getComboControls(comboPolicies, keyToCombo);
        return ctrl.length > 0 ? ctrl : undefined;
      })(),
      // 色×軸 重み制御：常時送信（policyApplied に依存しない・色は明示的UI設定なので常に効かせる）
      colorWeights: (() => {
        const ctrl = getColorWeightControls(colorWeights);
        return ctrl.length > 0 ? ctrl : undefined;
      })(),
      // 好みプロファイル（実 Gemini 分析）：skyveil好みAI が ON（または今回だけ反映）の時のみ送信
      // BUG-1: ref 経由で最新値を参照（buildInputs の依存に入れられないため）
      preferenceProfile: (favoriteLearnEnabled || skyveilOneShot) ? (preferenceProfileRef.current ?? undefined) : undefined,
      // ユーザー画像評価バイアス（👍/👎）：これも「学習結果」なので skyveil好みAI が
      // ON（または今回だけ反映）の時のみ送る（分析結果を自動反映しないルール）。scope ON の軸のみ。
      ratingBias: (() => {
        if (!(favoriteLearnEnabled || skyveilOneShot)) return undefined;
        const ra = ratingAnalysisRef.current;
        if (!ra) return undefined;
        const activeScopes = new Set<string>(scopes);
        return buildRatingBiasPayload(ra, activeScopes) ?? undefined;
      })(),
      // 画像分析バイアス：頻出/未使用カテゴリと視覚的重複数をサーバへ送信。
      // 「提案を反映」(policyApplied) を押した時のみ生成に効かせる（勝手に反映しない）。
      imageBias: (() => {
        if (!policyApplied) return undefined;
        const ia = imageAnalysisRef.current;
        if (!ia) return undefined;
        const overused = ia.overusedCategories;
        const underused = ia.underusedCategories.slice(0, 8);
        const visualDupCount = ia.clusters[0]?.size ?? 0;
        if (overused.length === 0 && underused.length === 0 && visualDupCount < 3) return undefined;
        return {
          ...(overused.length > 0 && { overused }),
          ...(underused.length > 0 && { underused }),
          ...(visualDupCount >= 3 && { visualDupCount }),
        };
      })(),
      viralMode,
      strength,
      glossLevel,
      dimensionLevel,
      realismLevel,
      realismType,
      textureOriginal,
      textureDisabled,
      // null（解除）は undefined として扱い、サーバー側で "full" にフォールバックさせる
      promptTarget: promptTarget ?? undefined,
      avoidCliche,
      era: era ?? undefined,
      colorStrategy: colorStrategy ?? undefined,
      artStyle: artStyle ?? undefined,
      // skyveil好みAI：ON（または今回だけ反映）かつ傾向がある場合のみ反映（コピーではなく方向性）。
      // Phase D: お気に入り傾向 ＋ Compare評価likes（限定重み）を統合した skyveilFavoriteTraits を送る。
      favoriteTraits:
        (favoriteLearnEnabled || skyveilOneShot) && skyveilFavoriteTraits.length > 0
          ? skyveilFavoriteTraits
          : undefined,
      favoriteStrength:
        (favoriteLearnEnabled || skyveilOneShot) && skyveilFavoriteTraits.length > 0
          ? favoriteStrength
          : undefined,
      // ZOZOトレンド：衣装スコープON かつ 反映中の場合のみ送信（最重要：衣装ON時のみ）
      zozoTrend:
        zozoApplied && zozoApplied.traits.length > 0 && scopes.includes("outfit")
          ? zozoApplied
          : undefined,
      // 神引き補助モディファイア（被り回避・別世界・バズ寄せ・顔映え）
      boosts: activeBoosts.length > 0 ? activeBoosts : undefined,
      // 風の強さ（0 は送らない。サーバー側でも対象スコープゲートあり）
      windLevel: windLevel > 0 ? windLevel : undefined,
      ...override,
    }),
    [
      scopes,
      moods,
      autoMoodCategories,
      count,
      bodyPoseLock,
      colorMoodLock,
      compositionLock,
      details,
      worldCombinedNote,
      referenceNoteText,
      extraInstructions,
      ngList,
      forbiddenTokens,
      levels,
      comboPolicies,
      historyAnalysis,
      policyApplied,
      viralMode,
      strength,
      glossLevel,
      dimensionLevel,
      realismLevel,
      realismType,
      textureOriginal,
      textureDisabled,
      promptTarget,
      avoidCliche,
      era,
      colorStrategy,
      artStyle,
      faceLock,
      expression,
      favoriteLearnEnabled,
      favoriteProfile,
      favoriteStrength,
      skyveilFavoriteTraits,
      skyveilOneShot,
      zozoApplied,
      activeBoosts,
      windLevel,
      // imageAnalysis / ratingAnalysis / preferenceProfile は buildInputs より後で宣言され
      // 依存配列に入れると TDZ エラーになるため、ref 経由で最新値を参照する（BUG-1 修正）。
      // → preferenceProfileRef / ratingAnalysisRef / imageAnalysisRef（useEffect で同期）。
      colorWeights,
    ]
  );

  /**
   * 偏り分析を実行して massProductionResult を更新する。
   * @param currentTexts  今回生成したプロンプトテキスト
   * @param excludeBatchId 今回のバッチを履歴から除外するためのID
   */
  const runBiasAnalysis = useCallback(
    async (currentTexts: string[], excludeBatchId?: string) => {
      // ── ライブビュー：重複・色・お気に入り分析の処理を可視化 ──────────────
      analysisLive.start("生成後の分析（重複・色・履歴）");
      try {
        analysisLive.startStep("loadHistory", "全履歴を読み込み中");
        const allHistory = await getAll();
        const historyEntries: HistoryEntry[] = allHistory
          .filter((i) => !excludeBatchId || i.batchId !== excludeBatchId)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 20)
          .map((i) => ({ text: i.promptText, dateKey: i.dateKey }));
        analysisLive.completeStep("loadHistory", `${allHistory.length}件の履歴を確認`);

        analysisLive.startStep("duplicateAnalysis", "重複構成を検出中");
        const result = analyzeBias(currentTexts, historyEntries);
        setMassProductionResult(result);
        analysisLive.completeStep("duplicateAnalysis");

        analysisLive.startStep("colorAnalysis", "色傾向を集計中");
        const fullAnalysis = analyzeFullHistory(allHistory.filter(
          (i) => !excludeBatchId || i.batchId !== excludeBatchId
        ), currentTexts);
        setHistoryAnalysis(fullAnalysis);
        analysisLive.completeStep("colorAnalysis");

        // 根拠：頻出モチーフを記録
        if (fullAnalysis.topMotifs.length > 0) {
          const top3 = fullAnalysis.topMotifs.slice(0, 3);
          analysisLive.addEvidence({
            title: "重複頻出モチーフ",
            conclusion: `「${top3.map((m) => m.motif.label).join("・")}」が頻出しています`,
            sources: top3.map((m) => ({
              type: "history" as const,
              label: m.motif.label,
              count: m.totalCount,
            })),
          });
        }

        analysisLive.startStep("favoriteAnalysis", "お気に入り傾向を更新");
        setHistoryItemsForColor(allHistory);
        analysisLive.completeStep("favoriteAnalysis");

        analysisLive.complete(`分析完了（直近${fullAnalysis.windowSize}件）`);
        return result;
      } catch {
        analysisLive.error("分析中にエラーが発生しました");
        return null;
      }
    },
    [analysisLive]
  );

  /** API レスポンスの proposals を IndexedDB に保存しつつ state に格納する。 */
  const runGenerate = useCallback(
    async (inputs: PromptInputs) => {
      // 「今回だけ反映」(skyveilOneShot) は全生成経路が通る単一の出口であるここで1回消費する。
      // inputs は呼び出し側で buildInputs() により確定済みのため、ここで解除しても
      // 今回の生成への適用は維持され、次回以降だけ OFF になる（P1-5 / BUG-16）。
      setSkyveilOneShot(false);
      setGenerating(true);
      setError(null);
      // 現在の結果をアンドゥスタックに積む（空なら積まない）
      const prev = itemsRef.current;
      if (prev.length > 0) {
        setUndoStack((s) => [prev, ...s].slice(0, 5));
      }
      try {
        // マンネリ回避：直近ジャンル＋サブジャンルを渡し、返ってきたものを履歴に積む
        const recentGenres    = getRecentGenres();
        const recentSubStyles = getRecentSubStyles();
        const result = await generateViaBackend(inputs, imageDataUrl, recentGenres, recentSubStyles);
        const usedGenres = result.proposals
          .map((p) => p.genre)
          .filter((g): g is string => Boolean(g));
        if (usedGenres.length > 0) pushRecentGenres(usedGenres);
        const usedSubStyles = result.proposals
          .flatMap((p) => p.subStyles ?? [])
          .filter((s): s is string => typeof s === "string" && s.length > 0);
        if (usedSubStyles.length > 0) pushRecentSubStyles(usedSubStyles);
        const batchId = uid();
        const thumb = imageDataUrl ? await makeThumbnail(imageDataUrl) : null;
        const built = buildHistoryItems({
          proposals: result.proposals,
          target: "unified",
          batchId,
          inputs,
          thumbnail: thumb,
          // 「同じ構成で再生成」用スナップショット
          settingsSnapshot: {
            windLevel: windLevel > 0 ? windLevel : undefined,
            zozoApplied: zozoApplied ?? null,
            activeBoosts: activeBoosts.length > 0 ? [...activeBoosts] : undefined,
            colorStrategy: colorStrategy ?? null,
            artStyle: artStyle ?? null,
            era: era ?? null,
          },
        });
        await saveBatch(built);
        setItems(built);
        // 正常生成できたらバックアップに保存（履歴画面から戻った時の復元用）
        lastItemsRef.current = built;

        // ── Compare Mode 用：参照レコードを保存（追加のみ・既存保存に影響しない）──
        // 参照画像があり、かつ「適用」した軸が1つ以上ある場合のみ。失敗しても生成は妨げない。
        void (async () => {
          try {
            const refCtx = referenceContextRef.current;
            const applied = referenceNoteRef.current;
            const hasApplied = !!applied && Object.keys(applied).some((k) => (applied[k] ?? "").trim());
            if (!refCtx?.image || !hasApplied) return;
            const refThumb = await makeThumbnail(refCtx.image);
            await saveReferenceRecord({
              refThumb,
              extracted: refCtx.extracted,
              applied,
              batchId,
            });
          } catch { /* 参照レコード保存失敗は無視（生成を妨げない） */ }
        })();

        // 生成後に自動で偏り分析を実行（ノンブロッキング）
        const currentTexts = built.map((i) => i.promptText);
        void runBiasAnalysis(currentTexts, batchId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        // エラー時は items をクリアしない：以前の生成結果を維持する。
        // （古い結果が残っていてもユーザーはエラーバナーで把握できる）
      } finally {
        setGenerating(false);
        setArrangeSource(null);
      }
    },
    [imageDataUrl, runBiasAnalysis]
  );

  // skyveilProfile/Strength は後で宣言されるため、handleGenerate からは ref 経由で参照（TDZ回避）
  const skyveilProfileRef = useRef<SkyveilProfile | null>(null);
  const skyveilStrengthRef = useRef<SkyveilStrength>("standard");

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    const inputs = buildInputs();
    const skyveilOn = !!(inputs.favoriteTraits || inputs.preferenceProfile);
    const sp = skyveilProfileRef.current;
    const sStrength = skyveilStrengthRef.current;
    // ── 適用ログ：生成前に「何が効いているか」をブラウザのコンソールで確認できる ──
    try {
      console.groupCollapsed("%c🔬 生成に適用したバイアス（確認用ログ）", "color:#a78bfa;font-weight:bold");
      console.log("変更対象 scopes:", inputs.scopes);
      console.log("重複分析 motifControls:", inputs.motifControls ?? "（未反映：提案を反映を押す）");
      console.log("重複分析 comboControls:", inputs.comboControls ?? "（未反映）");
      console.log("画像分析 imageBias:", inputs.imageBias ?? "（未反映：提案を反映を押す / 画像が未解析）");
      console.log("評価バイアス ratingBias:", inputs.ratingBias ?? "（なし）");
      console.log("色ウェイト colorWeights:", inputs.colorWeights ?? "（既定）");
      console.log("NG（最終）:", inputs.ngList || "（なし）");
      // ── skyveil好みAI の +/- 内訳 ──
      const sLabel = sStrength === "weak" ? "弱" : sStrength === "strong" ? "強" : "標準";
      console.groupCollapsed(`%c🧬 skyveil好み反映：${skyveilOn ? `ON / ${sLabel}` : "OFF"}`,
        "color:#c4b5fd;font-weight:bold");
      if (skyveilOn && sp) {
        console.log("加点（好き）:", sp.likes);
        console.log("減点（避けたい）:", sp.avoid);
        console.log("変換（好きだが出すぎ）:", sp.overusedButLiked);
        console.log("未開拓加点:", sp.underusedRecommended);
        console.log("※ 変更対象に含まれる軸のみ反映・固定ルール最優先（サーバ側で厳守）");
      } else {
        console.log("（OFF：skyveil好みAI のトグルを ON にすると反映されます）");
      }
      console.groupEnd();
      console.groupEnd();
    } catch { /* console 非対応環境では無視 */ }
    // 操作ログ（skyveil学習データ）：生成イベントを記録
    void logOperation("generate", {
      scopes: inputs.scopes,
      count: inputs.count,
      outputType: inputs.promptTarget ?? "full",
      skyveil: skyveilOn ? sStrength : "off",
      viral: inputs.viralMode,
    });
    // 「今回だけ反映」の解除は runGenerate に集約（全生成経路で1回消費）
    void runGenerate(inputs);
  }, [canGenerate, buildInputs, runGenerate]);

  /**
   * GenerationProgress の onComplete から呼ばれる完了ハンドラ。
   * 通知設定に応じて音・トースト・タブ変更・ボタン演出を実行する。
   */
  const handleGenerationComplete = useCallback(() => {
    const s = getNotifSettings();

    // ⑤ ボタンを「✅ 完了！」に1.5秒変化
    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 1500);

    // ② 完了音
    if (s.sound) playCompletionSound();

    // ③ トースト
    if (s.toast) setToastTrigger((n) => n + 1);

    // ④ タブ通知
    if (s.tabTitle) {
      const original = document.title;
      document.title = "✅ 生成完了！";
      setTimeout(() => { document.title = original; }, 3000);
    }
  }, []);

  // ⌨️ Ctrl+Enter（または Cmd+Enter）でプロンプト生成
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canGenerate && !generating) {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canGenerate, generating, handleGenerate]);

  // 🔄 別案のみ自動生成トリガーを使う。他のボタンは設定反映のみ。
  const pendingRunRef = useRef<PromptInputs | null>(null);

  // ─── 共通トーストヘルパー ──────────────────────────────────────────────────
  const showPresetToast = useCallback((msg: string, hint?: string) => {
    setFashionToastMsg(msg);
    setFashionToastHint(hint ?? "");
    setFashionToastTrigger((n) => n + 1);
  }, []);

  const APPLY_HINT = "「プロンプトを生成」ボタンで反映します";

  // ── 📅 偏り検出の対象：直近90日（最大1000件）。古い好み・失敗を引きずらない ──
  const recentItems = useMemo(
    () => filterRecentWindow(historyItemsForColor),
    [historyItemsForColor],
  );

  // ── 🎨 色分析：直近90日×ウィンドウサイズで集計 ──
  const colorAnalysis: ColorAnalysis | null = useMemo(() => {
    if (recentItems.length === 0) return null;
    return analyzeColors(recentItems, colorWindowSize);
  }, [recentItems, colorWindowSize]);

  // ── 📸 画像分析：直近90日×特徴キャッシュから集計 ──
  const imageAnalysis: ImageAnalysisResult | null = useMemo(() => {
    if (recentItems.length === 0) return null;
    return buildImageAnalysis(recentItems, imageFeatureMap);
  }, [recentItems, imageFeatureMap]);

  // ── ⭐ 評価分析：履歴中の resultRatings を集計（評価＝回避学習は全期間が対象） ──
  const ratingAnalysis: RatingAnalysis | null = useMemo(() => {
    if (historyItemsForColor.length === 0) return null;
    const r = analyzeRatings(historyItemsForColor);
    return r.totalRatedImages > 0 ? r : null;
  }, [historyItemsForColor]);

  // ── 📊 分析対象サマリ（パネル見出しの「直近90日/N件」表示用） ──
  const analysisStats = useMemo(() => {
    const promptCount = recentItems.length;
    // 画像解析済み＝直近90日のうち結果画像があり特徴キャッシュに載っている件数
    let imageAnalyzedCount = 0;
    for (const it of recentItems) {
      if (imageFeatureMap.has(it.id)) imageAnalyzedCount++;
    }
    const ratedCount = ratingAnalysis?.totalRatedImages ?? 0;
    return {
      windowDays: WINDOW_DAYS,
      totalItems: historyItemsForColor.length,
      promptCount,
      imageAnalyzedCount,
      ratedCount,
    };
  }, [recentItems, imageFeatureMap, ratingAnalysis, historyItemsForColor.length]);

  // ── 💡 好みプロファイル：Gemini で実分析した結果（localStorage 永続化） ──
  // ↑ preferenceProfile はこの直後に宣言。skyveilProfile はさらに後で組み立てる。
  const [preferenceProfile, setPreferenceProfile] = useState<PreferenceProfile | null>(() => loadPreferenceProfile());
  /** 分析実行中フラグ */
  const [analyzingProfile, setAnalyzingProfile] = useState(false);
  /** 直近のエラー（成功時は null） */
  const [profileError, setProfileError] = useState<string | null>(null);
  /** 自動学習 ON/OFF（既定 ON・永続化） */
  const [autoLearnEnabled, setAutoLearnEnabled] = useState<boolean>(() => loadAutoLearn());
  /** 自動学習：直近の自動分析時刻（クールダウン判定） */
  const lastAutoAnalyzeRef = useRef<number>(0);
  /** 自動学習：デバウンスタイマー */
  const autoLearnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 評価可能サンプル数（評価が1つでも付いてる画像の総数） */
  const profileSampleCount = useMemo(
    () => collectSamples(historyItemsForColor).length,
    [historyItemsForColor],
  );

  // ── 🧬 skyveil好みAI：既存の各分析を1つの統合プロファイルに束ねる ──
  const skyveilStrength: SkyveilStrength = favoriteToStrength(favoriteStrength);
  const skyveilProfile = useMemo(
    () => buildSkyveilProfile({
      preferenceProfile, favoriteProfile, ratingAnalysis, imageAnalysis, historyAnalysis, referenceLearning,
    }),
    [preferenceProfile, favoriteProfile, ratingAnalysis, imageAnalysis, historyAnalysis, referenceLearning],
  );
  // handleGenerate（前方宣言）から ref 経由で最新値を読むため同期
  useEffect(() => { skyveilProfileRef.current = skyveilProfile; }, [skyveilProfile]);
  useEffect(() => { skyveilStrengthRef.current = skyveilStrength; }, [skyveilStrength]);
  // BUG-1: buildInputs（前方宣言）が最新の分析結果を ref 経由で参照するため同期
  useEffect(() => { preferenceProfileRef.current = preferenceProfile; }, [preferenceProfile]);
  useEffect(() => { ratingAnalysisRef.current = ratingAnalysis; }, [ratingAnalysis]);
  useEffect(() => { imageAnalysisRef.current = imageAnalysis; }, [imageAnalysis]);

  // 🛡 変更禁止チェック・スコア用のロック状態（現在の選択から導出）
  const currentLock = useMemo(
    () => deriveLockState({ scopes, faceLock, bodyPoseLock, colorMoodLock, compositionLock }),
    [scopes, faceLock, bodyPoseLock, colorMoodLock, compositionLock],
  );

  // 🛡 GlobalProtectionBar 用：生成前のライブ Identity リスク採点（設定ベース）。
  // analyzeIdentityRisk は本来「生成済みプロンプト」を採点するが、生成前は空文字を渡し
  // 変更軸数・髪/ポーズ/カメラ・faceLock から設定ベースのスコアを得る。
  const liveIdentityRisk = useMemo(
    () => analyzeIdentityRisk("", currentLock),
    [currentLock],
  );

  // 🤖 AnalysisStatusStrip 用：5分析の鮮度（最終実行時刻）。
  // 重複(historyAnalysis.analyzedAt) / 画像(ImageFeature.analyzedAt) / skyveil(preferenceProfile.generatedAt)
  // は既存データに実タイムスタンプがある。色・お気に入りはタイムスタンプを持たないため、
  // 再計算（useMemo 更新）を検知して App 側でスタンプする（分析ロジックは無変更）。
  const [analysisStamps, setAnalysisStamps] = useState<{ color: number | null; favorite: number | null }>({
    color: null, favorite: null,
  });
  useEffect(() => {
    if (colorAnalysis) setAnalysisStamps((s) => ({ ...s, color: Date.now() }));
  }, [colorAnalysis]);
  useEffect(() => {
    if (favoriteProfile) setAnalysisStamps((s) => ({ ...s, favorite: Date.now() }));
  }, [favoriteProfile]);
  /** 画像分析の最終実行時刻 = 特徴キャッシュ内 analyzedAt の最大値（永続・既存フィールド） */
  const imageAnalyzedAt = useMemo(() => {
    let mx: number | null = null;
    for (const f of imageFeatureMap.values()) {
      if (f.analyzedAt != null && (mx === null || f.analyzedAt > mx)) mx = f.analyzedAt;
    }
    return mx;
  }, [imageFeatureMap]);
  /** 5分析サマリ（件数 + 鮮度）。すべて既存 state から算出（ロジック非変更）。 */
  const analysisCategories = useMemo<AnalysisCategoryView[]>(() => [
    {
      key: "duplicate", icon: "📘", label: "重複分析",
      count: historyAnalysis ? `${historyAnalysis.windowSize}` : null,
      at: historyAnalysis?.analyzedAt ?? null,
    },
    {
      key: "color", icon: "🎨", label: "色分析",
      count: colorAnalysis ? `${colorAnalysis.windowSize}` : null,
      at: analysisStamps.color,
    },
    {
      key: "image", icon: "🖼", label: "画像分析",
      count: imageAnalysis && imageAnalysis.totalEligible > 0
        ? `${imageAnalysis.totalAnalyzed}/${imageAnalysis.totalEligible}` : null,
      at: imageAnalyzedAt,
    },
    {
      key: "favorite", icon: "⭐", label: "お気に入り",
      count: favoriteProfile && favoriteProfile.favoriteCount > 0 ? `${favoriteProfile.favoriteCount}` : null,
      at: favoriteProfile && favoriteProfile.favoriteCount > 0 ? analysisStamps.favorite : null,
    },
    {
      key: "skyveil", icon: "🧬", label: "skyveil好み",
      count: preferenceProfile ? `${preferenceProfile.sampleSize}` : null,
      at: preferenceProfile?.generatedAt ?? null,
    },
  ], [historyAnalysis, colorAnalysis, imageAnalysis, imageAnalyzedAt, favoriteProfile, preferenceProfile, analysisStamps]);
  /** AI分析詳細（AnalysisLiveView）の開閉。AnalysisStatusStrip の [詳細] で制御（M-2 統合）。 */
  const analysisLiveRef = useRef<HTMLDivElement>(null);
  const [analysisDetailOpen, setAnalysisDetailOpen] = useState(false);
  const toggleAnalysisDetail = useCallback(() => setAnalysisDetailOpen((v) => !v), []);
  // 詳細を開いた時、パネルを視界へスクロール（上部 sticky の直下に展開されるため）
  useEffect(() => {
    if (!analysisDetailOpen) return;
    const id = setTimeout(
      () => analysisLiveRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );
    return () => clearTimeout(id);
  }, [analysisDetailOpen]);

  // 🏆 成功プロンプト抽出（お気に入り・高評価・失敗少なめから型を抽出）
  const successPatterns = useMemo(
    () => extractSuccessPromptPatterns(historyItemsForColor),
    [historyItemsForColor],
  );
  /** 学習反映差分プレビュー（成功パターン）。反映ボタンを押すまで state は変えない。 */
  const [patternPreview, setPatternPreview] = useState<{
    pattern: SuccessPromptPattern;
    preview: LearningApplyPreviewResult;
  } | null>(null);

  /** 成功パターン反映：まず差分プレビューを出す（即適用しない） */
  const handleApplyPattern = useCallback((pattern: SuccessPromptPattern) => {
    const preview = previewSuccessPattern({ currentScopes: scopes, pattern, lock: currentLock });
    setPatternPreview({ pattern, preview });
  }, [scopes, currentLock]);

  /** プレビュー確定：ここで初めてスコープを更新（ブロック分は除外） */
  const handleConfirmPattern = useCallback(() => {
    if (!patternPreview) return;
    const next = applyPreviewedScopes(scopes, patternPreview.preview);
    setScopes(next);
    setScopeFlashKey((k) => k + 1);
    showPresetToast(
      `🏆「${patternPreview.pattern.title}」を反映しました`,
      "顔・同一性は保護。背景固定/衣装OFFのブロック分は反映していません。",
    );
    setPatternPreview(null);
  }, [patternPreview, scopes, showPresetToast]);

  /**
   * 実 Gemini 呼び出しで好みプロファイルを更新。
   * @param auto true=自動学習からの呼び出し（トーストを控えめに・クールダウン記録）
   */
  const handleRunPreferenceAnalysis = useCallback(async (auto = false) => {
    if (analyzingProfile) return;
    setProfileError(null);
    const samples = collectSamples(historyItemsForColor);
    if (samples.length < MIN_SAMPLES) {
      if (!auto) {
        setProfileError(`サンプル不足（${samples.length}件 / 最低 ${MIN_SAMPLES}件必要）。画像評価を増やしてから再試行してください。`);
      }
      return;
    }
    setAnalyzingProfile(true);
    if (auto) lastAutoAnalyzeRef.current = Date.now();
    // ── ライブビュー：skyveil好み分析の処理ステップを可視化 ──────────────
    analysisLive.start(auto ? "skyveil自動学習" : "skyveil好み分析", {
      history: historyItemsForColor.length,
      ratings: samples.length,
    });
    analysisLive.startStep("loadRatings", `評価サンプル ${samples.length}件を収集`, samples.length);
    analysisLive.completeStep("loadRatings");
    analysisLive.startStep("skyveilPreferenceAnalysis", "Gemini Flash で好み傾向を分析中…");
    try {
      const profile = await analyzePreferencesViaBackend(samples);
      analysisLive.completeStep("skyveilPreferenceAnalysis", `${profile.sampleSize}件から好み傾向を抽出`);
      // 根拠を記録
      analysisLive.addEvidence({
        title: "skyveil好み傾向の更新",
        conclusion: profile.summary || "好み傾向が更新されました",
        sources: [
          { type: "rating", label: "評価データ", count: profile.sampleSize },
        ],
      });
      analysisLive.startStep("suggestionGeneration", "次回おすすめ案を整理");
      analysisLive.completeStep("suggestionGeneration");
      analysisLive.complete(`好み傾向を${profile.sampleSize}件から整理完了`);
      savePreferenceProfile(profile);
      setPreferenceProfile(profile);
      // BUG-3A: 分析した時点の「クライアント側サンプル数」を基準として保存。
      // 次回の自動学習はこの数からの増分（+AUTO_NEW_SAMPLE_THRESHOLD）で判定する。
      saveAutoLastCount(samples.length);
      showPresetToast(
        auto ? "🔁 自動学習：好み傾向を更新しました" : "✓ AI分析完了",
        `${profile.sampleSize}件のデータから好み傾向を抽出し、次回プロンプト生成に反映します。`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      analysisLive.errorStep("skyveilPreferenceAnalysis", msg);
      analysisLive.error(msg);
      if (!auto) setProfileError(msg);
      else console.warn("[auto-learn] analysis failed:", msg);
    } finally {
      setAnalyzingProfile(false);
    }
  }, [analyzingProfile, historyItemsForColor, analysisLive, showPresetToast]);

  /** プロファイルを削除（再分析できるようにクリア） */
  const handleClearPreferenceProfile = useCallback(() => {
    clearPreferenceProfile();
    setPreferenceProfile(null);
    setProfileError(null);
  }, []);

  /** 自動学習トグル */
  const handleToggleAutoLearn = useCallback((enabled: boolean) => {
    setAutoLearnEnabled(enabled);
    saveAutoLearn(enabled);
  }, []);

  // ── 🔁 自動学習トリガー ──
  // 評価サンプルが一定数増えるたびに、デバウンス＋クールダウン付きで自動再分析する。
  // BUG-3A ループ防止：基準は「前回分析時のクライアント側サンプル数」(localStorage 永続)。
  //   サーバ返却の preferenceProfile.sampleSize は 100 件で頭打ちのため基準に使えない
  //   （100 件超で newSamples が常に閾値超になり自動分析が止まらなくなる）。
  //   分析成功時に saveAutoLastCount(samples.length) され、その差分で判定する。
  useEffect(() => {
    if (!autoLearnEnabled) return;
    if (analyzingProfile) return;
    if (profileSampleCount < MIN_SAMPLES) return;

    const lastCount = loadAutoLastCount();
    // 新規サンプル数。負になる場合（サンプルが減った等）は 0 扱い
    const newSamples = Math.max(0, profileSampleCount - lastCount);
    // 初回（プロファイル無し）は MIN_SAMPLES 到達で実行。以降は +AUTO_NEW_SAMPLE_THRESHOLD 毎。
    const need = preferenceProfile ? AUTO_NEW_SAMPLE_THRESHOLD : MIN_SAMPLES;
    if (newSamples < need) return;

    // クールダウン中なら待つ
    const sinceLast = Date.now() - lastAutoAnalyzeRef.current;
    if (sinceLast < AUTO_COOLDOWN_MS) return;

    // デバウンス：評価が連続したらタイマーをリセットして最後の操作から AUTO_DEBOUNCE_MS 後に実行
    if (autoLearnTimerRef.current) clearTimeout(autoLearnTimerRef.current);
    autoLearnTimerRef.current = setTimeout(() => {
      void handleRunPreferenceAnalysis(true);
    }, AUTO_DEBOUNCE_MS);

    return () => {
      if (autoLearnTimerRef.current) {
        clearTimeout(autoLearnTimerRef.current);
        autoLearnTimerRef.current = null;
      }
    };
  }, [autoLearnEnabled, analyzingProfile, profileSampleCount, preferenceProfile, handleRunPreferenceAnalysis]);

  // App unmount 時に進行中の画像分析を中断（メモリリーク・残留 setState 防止）
  useEffect(() => {
    return () => {
      if (imageAnalyzeAbortRef.current) {
        imageAnalyzeAbortRef.current.abort();
        imageAnalyzeAbortRef.current = null;
      }
    };
  }, []);

  /** 画像分析を開始（未解析分のサムネをハッシュ化）。タブを開いたときに発火 */
  const startImageAnalysis = useCallback(() => {
    if (imageAnalyzeAbortRef.current) {
      imageAnalyzeAbortRef.current.abort();
    }
    const ctrl = new AbortController();
    imageAnalyzeAbortRef.current = ctrl;
    void (async () => {
      analysisLive.start("画像分析", { images: historyItemsForColor.length });
      analysisLive.startStep("loadImages", "解析対象の画像を確認中");
      try {
        // F1: 進捗 setState を間引く（10枚ごと or 完了時のみ）。
        // 毎枚更新すると ~136 回の React コミット → パネル全体の再描画が連続し UI がジャンクする。
        // 分析結果・重複率・保存データは不変（スケジューリングのみ変更）。
        const PROGRESS_INTERVAL = 10;
        let lastReportedDone = -1;
        const next = await runProgressiveAnalysis(
          historyItemsForColor,
          imageFeatureMap,
          (state) => {
            if (ctrl.signal.aborted) return;
            const isDone = state.done >= state.total && state.total > 0;
            const crossedInterval = state.done - lastReportedDone >= PROGRESS_INTERVAL;
            if (!isDone && !crossedInterval) return;           // 間引き：完了でも閾値超えでもない
            lastReportedDone = state.done;
            setImageAnalyzeProgress({ done: state.done, total: state.total });
            if (state.total > 0) {
              const pct = Math.round((state.done / state.total) * 100);
              analysisLive.setStepProgress("imageAnalysis", pct);
            }
          },
          ctrl.signal,
        );
        if (!ctrl.signal.aborted) {
          setImageFeatureMap(next);
          analysisLive.completeStep("imageAnalysis", `${Object.keys(next).length}件の画像特徴を抽出`);
          analysisLive.complete("画像分析完了");
        }
      } finally {
        // アボートされていない場合のみ進捗をクリア
        if (!ctrl.signal.aborted) {
          setImageAnalyzeProgress(null);
        }
        if (imageAnalyzeAbortRef.current === ctrl) imageAnalyzeAbortRef.current = null;
      }
    })();
  }, [historyItemsForColor, imageFeatureMap, analysisLive]);

  /** F4: ユーザーが「キャンセル」を押した時に進行中の画像分析を中断する */
  const cancelImageAnalysis = useCallback(() => {
    if (imageAnalyzeAbortRef.current) {
      imageAnalyzeAbortRef.current.abort();
      imageAnalyzeAbortRef.current = null;
    }
    setImageAnalyzeProgress(null);
  }, []);

  // ── 📸 自動画像解析：結果画像を貼ったら（タブを開かなくても）自動で解析する ──
  // 直近90日に「結果画像はあるが未解析」のアイテムがあれば、デバウンス後に解析を走らせる。
  // runProgressiveAnalysis は未解析分のみ処理するので再実行は安全（解析済みは即終了）。
  // BUG-18: startImageAnalysis は analysisLive の identity 変化で頻繁に作り直されるため、
  // dep に入れると解析中にタイマーが連打リセットされ thrash する。最新参照を ref 経由にし、
  // effect は recentItems / imageFeatureMap の実変化のみで発火させる。
  const startImageAnalysisRef = useRef(startImageAnalysis);
  useEffect(() => { startImageAnalysisRef.current = startImageAnalysis; });
  const autoImageAnalyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let pending = 0;
    for (const it of recentItems) {
      if (!imageFeatureMap.has(it.id) && primaryResultImage(it) != null) { pending++; }
    }
    if (pending === 0) return;
    if (autoImageAnalyzeTimer.current) clearTimeout(autoImageAnalyzeTimer.current);
    autoImageAnalyzeTimer.current = setTimeout(() => { startImageAnalysisRef.current(); }, 1500);
    return () => {
      if (autoImageAnalyzeTimer.current) {
        clearTimeout(autoImageAnalyzeTimer.current);
        autoImageAnalyzeTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startImageAnalysis は ref 経由（thrash防止のため意図的に除外）
  }, [recentItems, imageFeatureMap]);

  // ── 🤖 AI分析エージェント：useMemoで現状から提案を再計算 ──
  const agentAnalysis = useMemo(() => analyzeAgent({
    scopes, locks: {
      body_shape: bodyPoseLock,
      color: colorMoodLock, camera: compositionLock, aspect_ratio: compositionLock,
    },
    faceLock,
    activeWorldPresets, activeGodModes, activeBoosts, viralMode,
    favoriteProfile, favoriteEnabled: favoriteLearnEnabled,
    historyAnalysis, colorAnalysis, imageAnalysis, ratingAnalysis, policyApplied,
    windLevel,
    hasImage: !!imageDataUrl,
  }), [
    scopes, bodyPoseLock, colorMoodLock, compositionLock, faceLock,
    activeWorldPresets, activeGodModes, activeBoosts, viralMode,
    favoriteProfile, favoriteLearnEnabled, historyAnalysis, colorAnalysis, imageAnalysis, ratingAnalysis, policyApplied,
    windLevel, imageDataUrl,
  ]);

  // ── 重複分析：自動調整ハンドラ（showPresetToast に依存するためここに配置） ──
  const handleAutoAdjust = useCallback((preserveManual: boolean) => {
    if (!historyAnalysis) return;
    const topMotifs = historyAnalysis.topMotifs.map((mc) => ({
      id: mc.motif.id, count: mc.totalCount,
    }));
    const windowSize = historyAnalysis.windowSize;
    // 未開拓ジャンルラベルから推奨IDを引く（推奨対象→積極許可(5)）
    const labelToId = new Map(
      historyAnalysis.motifCounts.map((mc) => [mc.motif.label, mc.motif.id])
    );
    const preferIds = (historyAnalysis.untappedGenres ?? [])
      .filter((g) => g.untappedScore >= 80)
      .map((g) => labelToId.get(g.label))
      .filter((v): v is string => !!v);

    const snapshot = { ...loadLevels() };
    const result = computeAutoAdjust(
      snapshot, { topMotifs, windowSize, preferIds }, preserveManual
    );
    if (result.changedIds.length === 0) {
      showPresetToast("変更点はありませんでした", "");
      return;
    }
    setLevelsUndoStack((s) => [snapshot, ...s].slice(0, 5));
    setLevels(result.next);
    saveLevels(result.next);

    // 変更行ハイライト：1.4秒で自然消去
    setChangedIds(new Set(result.changedIds));
    if (changedClearTimer.current) clearTimeout(changedClearTimer.current);
    changedClearTimer.current = setTimeout(() => setChangedIds(new Set()), 1400);

    const protectedNote = result.preservedIds.length > 0
      ? `（手動 ${result.preservedIds.length} 件は保護）`
      : "";
    showPresetToast(
      `✨ 重複分析から ${result.changedIds.length} 件を自動調整しました`,
      `${protectedNote}「提案を反映」で生成に効きます。`
    );
  }, [historyAnalysis, showPresetToast]);

  const handleUndoAutoAdjust = useCallback(() => {
    setLevelsUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const [restored, ...rest] = stack;
      setLevels(restored);
      saveLevels(restored);
      setChangedIds(new Set());
      showPresetToast("↶ 自動調整を元に戻しました", "");
      return rest;
    });
  }, [showPresetToast]);

  // F2: DuplicateAnalysisPanel へのコールバック props を安定化（memo との組み合わせ効果）。
  // JSX でインラインラムダを渡すと毎レンダー新規生成になり memo を無効化するため、
  // useCallback でここに移す（分析/生成/保護ロジックは不変・トーストのみ追加）。
  const handleDupBulkLevel = useCallback((ids: string[], lv: MotifLevel) => {
    handleBulkLevel(ids, lv);
    showPresetToast("🎯 出現制御を一括設定しました", "「提案を反映」で生成に効きます。");
  }, [handleBulkLevel, showPresetToast]);

  const handleDupClearNg = useCallback(() => {
    handleClearNg();
    showPresetToast("完全NGを解除しました", "");
  }, [handleClearNg, showPresetToast]);

  const handleDupApplyPolicies = useCallback(() => {
    handleApplyPolicies();
    showPresetToast("✓ 出現制御を反映しました", "次回の生成から効きます。");
  }, [handleApplyPolicies, showPresetToast]);

  const handleDupUnapplyPolicies = useCallback(() => {
    handleUnapplyPolicies();
    showPresetToast("反映を解除しました", "");
  }, [handleUnapplyPolicies, showPresetToast]);

  const handleDupResetPolicies = useCallback(() => {
    handleResetPolicies();
    showPresetToast("🗑️ 出現制御を全リセット", "全モチーフを許可(4)に戻しました。");
  }, [handleResetPolicies, showPresetToast]);

  const handleDupDismiss = useCallback(() => {
    setMassProductionResult(null);
    setHistoryAnalysis(null);
  }, []);

  const handleDupResetBias = useCallback(() => {
    clearRecentGenres();
    clearRecentSubStyles();
    setHistoryAnalysis(null);
    setMassProductionResult(null);
    showPresetToast("🧹 偏り履歴をクリア", "ジャンル＋サブジャンルの履歴をリセットしました。");
  }, [showPresetToast]);

  // ── 🖼 参照画像：要素を「適用」（保護ゲート内蔵・docs/23） ──────────────────
  // [適用] = その軸の scope を ON + 軸タグ付き自由文を referenceNote へ。enum詳細は触らない。
  // 顔/同一性/表情/体型カテゴリは存在しない。ロックON軸は適用不可（既存保護を最優先）。
  const handleApplyReference = useCallback((catKey: string, text: string): boolean => {
    const cat = REFERENCE_CATEGORIES.find((c) => c.key === catKey);
    const body = (text ?? "").trim();
    if (!cat || !body) return false;
    // 保護ゲート（既存ロック最優先）
    const blocked = referenceLockReason(cat, { bodyPoseLock, compositionLock, colorMoodLock });
    if (blocked) { showPresetToast("適用できません", blocked); return false; }
    // 対応 scope を ON（未選択軸のみ追加・他軸は触らない）
    if (cat.scope) {
      setScopes((prev) => (prev.includes(cat.scope!) ? prev : [...prev, cat.scope!]));
    }
    // 軸タグ付き自由文を referenceNote へ（生成時に extraInstructions へ統合）
    setReferenceNote((prev) => ({ ...prev, [catKey]: body }));
    showPresetToast(`🖼 「${cat.label}」を参照から反映しました`, "「プロンプトを生成」で効きます。");
    return true;
  }, [bodyPoseLock, compositionLock, colorMoodLock, showPresetToast]);

  const handleClearReference = useCallback(() => {
    setReferenceNote({});
  }, []);

  // ── 🎨 色重み：自動調整（偏り減点・未使用加点）──
  const handleColorAutoAdjust = useCallback((preserveManual: boolean) => {
    if (!colorAnalysis) {
      showPresetToast("色分析データが不足しています", "数回生成すると自動調整が使えます。");
      return;
    }
    const snapshot: ColorWeightMap = JSON.parse(JSON.stringify(colorWeights));
    const result = autoAdjustColorWeights(snapshot, colorAnalysis, preserveManual);
    if (result.changes.length === 0) {
      showPresetToast("変更点はありませんでした", "");
      return;
    }
    setColorWeightsUndoStack((s) => [snapshot, ...s].slice(0, 5));
    setColorWeights(result.next);
    saveColorWeights(result.next);

    // 変更ハイライト：colorId:axis のキーで管理、1.6 秒で自然消去
    const keys = new Set(result.changes.map((c) => `${c.colorId}:${c.axis}`));
    setColorChangedKeys(keys);
    if (colorChangedClearTimer.current) clearTimeout(colorChangedClearTimer.current);
    colorChangedClearTimer.current = setTimeout(() => setColorChangedKeys(new Set()), 1600);

    const biasCount = result.changes.filter((c) => c.reason === "bias" || c.reason === "axis_bias").length;
    const upCount   = result.changes.filter((c) => c.reason === "untapped").length;
    showPresetToast(
      `✨ 色重みを自動調整しました（${result.changes.length}件）`,
      `偏り減点 ${biasCount} 件・未使用加点 ${upCount} 件。次回の生成から反映されます。`,
    );
  }, [colorWeights, colorAnalysis, showPresetToast]);

  const handleColorUndoAdjust = useCallback(() => {
    setColorWeightsUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const [restored, ...rest] = stack;
      setColorWeights(restored);
      saveColorWeights(restored);
      setColorChangedKeys(new Set());
      showPresetToast("↶ 色重みの自動調整を元に戻しました", "");
      return rest;
    });
  }, [showPresetToast]);

  // ── 🤖 AI分析エージェント：提案アクションの実行 ──
  const handleAgentAction = useCallback((id: AgentActionId) => {
    switch (id) {
      case "apply": {
        // 自動調整（手動を保護）→ ユーザーが「提案を反映」を別途押すと生成に効く
        handleAutoAdjust(true);
        break;
      }
      case "see_alternative": {
        // 既存の「別ジャンル化」をトリガー（DuplicateAnalysisPanelの onAutoFix と同じ動作）
        const antiInputs = buildAntiTemplateInputs(buildInputs(), variationMemory);
        setScopes(antiInputs.scopes);
        setMoods(antiInputs.moods);
        setAutoMoodCategories(antiInputs.autoMoodCategories ?? []);
        setDetails(antiInputs.details);
        setViralMode(antiInputs.viralMode);
        setExtraInstructions(antiInputs.extraInstructions);
        setActiveWorldPresets([]);
        setWorldCombinedNote("");
        setScopeFlashKey((k) => k + 1);
        setVariationMemory((prev) => updateMemory(prev, {
          moods: antiInputs.moods, scopes: antiInputs.scopes,
        }));
        showPresetToast("🎭 別ジャンルへ変換しました", "プロンプトを生成してください。");
        break;
      }
      case "avoid_overlap": {
        // 神引き補助「被り回避」を ON
        if (!activeBoosts.includes("avoid_overlap")) {
          setActiveBoosts((prev) => [...prev, "avoid_overlap"]);
        }
        showPresetToast("🔁 重複を避けるをONにしました", "次の生成から直近と似た方向を回避します。");
        break;
      }
      case "favorite_bias": {
        // お気に入り学習を ON
        setFavoriteLearnEnabled(true);
        showPresetToast("⭐ お気に入り傾向ONにしました", "好みの方向に少し寄せた案を生成します。");
        break;
      }
      case "simplify": {
        // 変更範囲を上位2軸に絞り、神引き・補助を整理
        const priority: Scope[] = ["outfit", "hair", "lighting", "background", "camera", "foreground"];
        const keep = scopes.filter((s) => priority.includes(s)).slice(0, 2);
        if (keep.length > 0) setScopes(keep);
        setActiveGodModes([]);
        setActiveBoosts([]);
        setChaosLabel(null);
        setScopeFlashKey((k) => k + 1);
        showPresetToast("🧹 シンプル化しました", "変更範囲を絞り、神引き・補助を解除しました。");
        break;
      }
      case "go_bold": {
        // 神引きカオス + バズ寄せ
        if (!activeGodModes.includes("chaos")) {
          setActiveGodModes(["chaos"]);
        }
        if (!activeBoosts.includes("buzz")) {
          setActiveBoosts((prev) => [...prev, "buzz"]);
        }
        showPresetToast("⚡ 攻めるモードを適用しました", "意外性の高い構成で生成されます。");
        break;
      }
    }
  }, [
    handleAutoAdjust, buildInputs, variationMemory, activeBoosts, scopes,
    activeGodModes, showPresetToast,
  ]);

  // ─── 🔥 一発バズり：ON/OFF 切り替え＋スコープをバズり向けに更新 ─────────────
  const handleViral = useCallback(() => {
    const next = buildViralInputs(buildInputs(), variationMemory);
    setScopes(next.scopes);
    setMoods(next.moods);
    setAutoMoodCategories(next.autoMoodCategories ?? []);
    setViralMode(true);
    setActiveWorldPresets([]);
    setWorldCombinedNote("");
    setActiveGodModes([]);
    setActiveSnsTypes([]);
    setActiveCultureTypes([]);
    setActiveAssistModes([]);
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, {
      moods:  next.moods,
      scopes: next.scopes,
    }));
    showPresetToast("🔥 一発バズりモードをONにしました", APPLY_HINT);
  }, [buildInputs, variationMemory, showPresetToast]);

  const handleViralOff = useCallback(() => {
    setViralMode(false);
    showPresetToast("一発バズりモードをOFFにしました");
  }, [showPresetToast]);

  // ─── 🎲 全自動おまかせ：設定反映のみ。プロンプト生成はしない ─────────────────
  const handleRandom = useCallback(() => {
    const next = buildRandomInputs(buildInputs());
    setScopes(next.scopes);
    setMoods(next.moods);
    setAutoMoodCategories(next.autoMoodCategories ?? []);
    setCount(next.count);
    setDetails(next.details);
    setViralMode(next.viralMode);
    setActiveWorldPresets([]);
    setWorldCombinedNote("");
    setActiveGodModes([]);
    setActiveEffectTypes([]);
    setActiveSnsTypes([]);
    setActiveCultureTypes([]);
    setActiveAssistModes([]);
    showPresetToast("🎲 全自動おまかせの設定を適用しました", APPLY_HINT);
  }, [buildInputs, showPresetToast]);

  const handleVariant = useCallback(() => {
    const next = buildVariantInputs(buildInputs());
    setMoods(next.moods);
    setAutoMoodCategories(next.autoMoodCategories ?? []);
    setDetails(next.details);
    setViralMode(next.viralMode);
    pendingRunRef.current = next;
    // pendingRunKey をインクリメントしてエフェクトを確実に発火（mood が変わらなかった場合の保険）
    setPendingRunKey((k) => k + 1);
  }, [buildInputs]);

  // ─── 👑 神引き：トグル選択（solo: normal/chaos/composition、combo: 最大2） ───

  const handleGodToggle = useCallback((mode: string) => {
    // Solo モード（normal / chaos / composition）→ 常に単独適用
    if (mode === "normal") {
      const next = buildGodInputs(buildInputs(), variationMemory);
      setScopes(next.scopes);
      setMoods(next.moods);
      setAutoMoodCategories(next.autoMoodCategories ?? []);
      setCount(next.count);
      setDetails(next.details);
      setViralMode(next.viralMode);
      setExtraInstructions(next.extraInstructions);
      setActiveWorldPresets([]);
      setWorldCombinedNote("");
      setActiveGodModes(["normal"]);
      setScopeFlashKey((k) => k + 1);
      setVariationMemory((prev) => updateMemory(prev, { moods: next.moods, scopes: next.scopes }));
      showPresetToast("👑 神引きの設定を適用しました", APPLY_HINT);
      return;
    }

    if (mode === "chaos") {
      const next  = buildChaosFusionInputs(buildInputs(), variationMemory);
      const label = formatChaosLabel(next.extraInstructions ?? "");
      setScopes(next.scopes);
      setMoods(next.moods);
      setAutoMoodCategories(next.autoMoodCategories ?? []);
      setDetails(next.details);
      setViralMode(next.viralMode);
      setExtraInstructions(next.extraInstructions);
      setActiveWorldPresets([]);
      setWorldCombinedNote("");
      setChaosLabel(label);
      setActiveGodModes(["chaos"]);
      setScopeFlashKey((k) => k + 1);
      setVariationMemory((prev) => updateMemory(prev, { moods: next.moods, scopes: next.scopes }));
      showPresetToast(`🎲 カオス神引き: ${label}`, "設定を適用しました。プロンプトを生成してください。");
      return;
    }

    if (mode === "composition") {
      const { inputs: next, compositionId } = buildCompositionGodInputs(buildInputs(), variationMemory);
      setScopes(next.scopes);
      setMoods(next.moods);
      setAutoMoodCategories(next.autoMoodCategories ?? []);
      setDetails(next.details);
      setViralMode(next.viralMode);
      setExtraInstructions(next.extraInstructions);
      setActiveWorldPresets([]);
      setWorldCombinedNote("");
      setActiveGodModes(["composition"]);
      setScopeFlashKey((k) => k + 1);
      setVariationMemory((prev) => updateMemory(prev, { composition: compositionId, scopes: next.scopes }));
      showPresetToast("📷 構図神引きを適用しました", APPLY_HINT);
      return;
    }

    // Combineable モード（outfit/bg/color/world_god/props/bigobject/myth/movie）→ トグル最大2
    const prevCombo = activeGodModes.filter((m) => !["normal", "chaos", "composition"].includes(m));
    let nextCombo: string[];
    if (prevCombo.includes(mode)) {
      nextCombo = prevCombo.filter((m) => m !== mode);
    } else if (prevCombo.length >= 2) {
      nextCombo = [...prevCombo.slice(1), mode];
    } else {
      nextCombo = [...prevCombo, mode];
    }
    setActiveGodModes(nextCombo);

    if (nextCombo.length === 0) {
      setExtraInstructions("");
      setScopeFlashKey((k) => k + 1);
      showPresetToast("神引きの設定をリセットしました");
      return;
    }

    const combined = buildCombinedGodInputs(buildInputs(), nextCombo, variationMemory);
    setScopes(combined.scopes);
    setMoods(combined.moods);
    setAutoMoodCategories(combined.autoMoodCategories ?? []);
    setDetails(combined.details);
    setViralMode(combined.viralMode);
    setExtraInstructions(combined.extraInstructions);
    setActiveWorldPresets([]);
    setWorldCombinedNote("");
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, { moods: combined.moods, scopes: combined.scopes }));

    const labels = nextCombo.map((m) => GOD_MODE_DISPLAY[m] ?? m);
    const msg = nextCombo.length === 1
      ? `${labels[0]} 神引きを適用しました`
      : `👑 神引きコンボ：${labels.join(" × ")}`;
    showPresetToast(msg, nextCombo.length > 1 ? "神引き要素を融合します" : APPLY_HINT);
  }, [activeGodModes, buildInputs, variationMemory, showPresetToast]);

  // ─── 世界観プリセット：トグル選択（最大3コンボ）────────────────────────────────

  const handleWorldPresetToggle = useCallback((preset: WorldPreset) => {
    const prev = activeWorldPresets;
    let next: WorldPreset[];
    if (prev.includes(preset)) {
      // 選択済み → 解除
      next = prev.filter((p) => p !== preset);
    } else if (prev.length >= 3) {
      // 最大3件：最古を落として追加
      next = [...prev.slice(1), preset];
    } else {
      next = [...prev, preset];
    }
    setActiveWorldPresets(next);

    if (next.length === 0) {
      setWorldCombinedNote("");
      setScopeFlashKey((k) => k + 1);
      showPresetToast("世界観の設定をリセットしました");
      return;
    }

    const combined = buildCombinedWorldInputs(buildInputs(), next, variationMemory);
    setScopes(combined.scopes);
    setMoods(combined.moods);
    setAutoMoodCategories(combined.autoMoodCategories ?? []);
    if (next.length === 1) setDetails(combined.details);
    setViralMode(false);
    // 世界観ノートは専用 state に格納（extraInstructions は上書きしない）
    setWorldCombinedNote(combined.extraInstructions ?? "");
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, {
      moods:  combined.moods,
      scopes: combined.scopes,
      world:  preset,
    }));

    const labels = next.map((p) => WORLD_PRESET_DISPLAY[p]);
    const msg = next.length === 1
      ? `${labels[0]} プリセットを適用しました`
      : `🌍 コンボ：${labels.join(" × ")}`;
    const hint = next.length > 1
      ? `${next.length}つの世界観を融合します`
      : APPLY_HINT;
    showPresetToast(msg, hint);
  }, [activeWorldPresets, buildInputs, variationMemory, showPresetToast]);

  // ─── 演出プリセット：トグル選択（最大2コンボ）─────────────────────────────────

  const handleEffectToggle = useCallback((effect: EffectPreset) => {
    const prev = activeEffectTypes;
    let next: EffectPreset[];
    if (prev.includes(effect)) {
      next = prev.filter((e) => e !== effect);
    } else if (prev.length >= 2) {
      next = [...prev.slice(1), effect];
    } else {
      next = [...prev, effect];
    }
    setActiveEffectTypes(next);

    if (next.length === 0) {
      showPresetToast("演出の設定をリセットしました");
      return;
    }

    const combined = buildCombinedEffectInputs(buildInputs(), next, variationMemory);
    setScopes(combined.scopes);
    setMoods(combined.moods);
    setAutoMoodCategories(combined.autoMoodCategories ?? []);
    setDetails(combined.details);
    setViralMode(combined.viralMode);
    setExtraInstructions(combined.extraInstructions);
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, { scopes: combined.scopes }));

    const EFFECT_DISPLAY: Record<EffectPreset, string> = {
      fgrich: "🌀 前景盛り", microcyber: "🧬 微機械化", clean: "🧊 清潔感",
    };
    const labels = next.map((e) => EFFECT_DISPLAY[e]);
    const msg = next.length === 1
      ? `${labels[0]} を適用しました`
      : `演出コンボ：${labels.join(" × ")}`;
    showPresetToast(msg, APPLY_HINT);
  }, [activeEffectTypes, buildInputs, variationMemory, showPresetToast]);

  // ─── 多様性ツール（生成補助）：ギャップ化のトグル選択（単一） ─
  // 「anti（量産回避）」モードはUIから撤去済み（avoidCliche に統合）。
  // 引数型は "gap" のみに狭めてあり、buildAntiTemplateInputs は別ジャンル化機能から直接利用される。

  const handleAssistToggle = useCallback((mode: "gap") => {
    const prev = activeAssistModes;
    const next = prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode];
    setActiveAssistModes(next);

    if (next.length === 0) {
      setExtraInstructions("");
      showPresetToast("生成補助の設定をリセットしました");
      return;
    }

    const combined = buildCombinedAssistInputs(buildInputs(), next, variationMemory);
    setScopes(combined.scopes);
    setMoods(combined.moods);
    setAutoMoodCategories(combined.autoMoodCategories ?? []);
    setDetails(combined.details);
    setViralMode(combined.viralMode);
    setExtraInstructions(combined.extraInstructions);
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, { moods: combined.moods, scopes: combined.scopes }));

    showPresetToast(`🎭 ギャップ化 を適用しました`, APPLY_HINT);
  }, [activeAssistModes, buildInputs, variationMemory, showPresetToast]);

  // ─── SNSバズ・カルチャー：マルチセレクト（最大2コンボ） ────────────────────────

  /** DetailsCard から特定タイプを1つ選んで適用（単一選択・DetailsCard 専用） */
  const handleSns = useCallback((type: SnsType) => {
    const next = buildSnsInputs(buildInputs(), variationMemory, type);
    setScopes(next.scopes);
    setMoods(next.moods);
    setAutoMoodCategories(next.autoMoodCategories ?? []);
    setDetails(next.details);
    setViralMode(next.viralMode);
    setExtraInstructions(next.extraInstructions);
    setActiveSnsTypes([type]);
    setActiveCultureTypes([]);
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, { moods: next.moods, scopes: next.scopes }));
    showPresetToast(`📈 SNSバズ「${getSnsLabel(type)}」を適用しました`, APPLY_HINT);
  }, [buildInputs, variationMemory, showPresetToast]);

  /** DetailsCard からカルチャータイプを1つ選んで適用（単一選択・DetailsCard 専用） */
  const handleCulture = useCallback((type: CultureType) => {
    const next = buildCultureInputs(buildInputs(), variationMemory, type);
    setScopes(next.scopes);
    setMoods(next.moods);
    setAutoMoodCategories(next.autoMoodCategories ?? []);
    setDetails(next.details);
    setViralMode(next.viralMode);
    setExtraInstructions(next.extraInstructions);
    setActiveCultureTypes([type]);
    setActiveSnsTypes([]);
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, {
      bgPlace: next.details.background.place !== "auto" && next.details.background.place !== "skip" ? next.details.background.place : undefined,
      moods:   next.moods,
      scopes:  next.scopes,
    }));
    showPresetToast(`🌐 カルチャー「${getCultureLabel(type)}」を適用しました`, APPLY_HINT);
  }, [buildInputs, variationMemory, showPresetToast]);

  /** QuickActions の SNSバズボタン：クリックごとにランダム追加（最大2コンボ） */
  const handleSnsSingle = useCallback(() => {
    const prev = activeSnsTypes;
    const available = SNS_TYPES.filter((t) => !prev.includes(t));
    const pool = available.length > 0 ? available : SNS_TYPES;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const next: SnsType[] = prev.length >= 2 ? [...prev.slice(1), type] : [...prev, type];
    setActiveSnsTypes(next);
    setActiveCultureTypes([]);

    const combined = buildCombinedSnsInputs(buildInputs(), next, variationMemory);
    setScopes(combined.scopes);
    setMoods(combined.moods);
    setAutoMoodCategories(combined.autoMoodCategories ?? []);
    setDetails(combined.details);
    setViralMode(combined.viralMode);
    setExtraInstructions(combined.extraInstructions);
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, { moods: combined.moods, scopes: combined.scopes }));

    const labels = next.map((t) => getSnsLabel(t));
    const msg = next.length === 1
      ? `📈 SNSバズ「${labels[0]}」を適用しました`
      : `📈 SNSコンボ：${labels.join(" × ")}`;
    showPresetToast(msg, APPLY_HINT);
  }, [activeSnsTypes, buildInputs, variationMemory, showPresetToast]);

  /** QuickActions のカルチャーボタン：クリックごとにランダム追加（最大2コンボ） */
  const handleCultureSingle = useCallback(() => {
    const prev = activeCultureTypes;
    const available = CULTURE_TYPES.filter((t) => !prev.includes(t));
    const pool = available.length > 0 ? available : CULTURE_TYPES;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const next: CultureType[] = prev.length >= 2 ? [...prev.slice(1), type] : [...prev, type];
    setActiveCultureTypes(next);
    setActiveSnsTypes([]);

    const combined = buildCombinedCultureInputs(buildInputs(), next, variationMemory);
    setScopes(combined.scopes);
    setMoods(combined.moods);
    setAutoMoodCategories(combined.autoMoodCategories ?? []);
    setDetails(combined.details);
    setViralMode(combined.viralMode);
    setExtraInstructions(combined.extraInstructions);
    setScopeFlashKey((k) => k + 1);
    setVariationMemory((prev) => updateMemory(prev, {
      bgPlace: combined.details.background.place !== "auto" && combined.details.background.place !== "skip"
        ? combined.details.background.place
        : undefined,
      moods:   combined.moods,
      scopes:  combined.scopes,
    }));

    const labels = next.map((t) => getCultureLabel(t));
    const msg = next.length === 1
      ? `🌐 カルチャー「${labels[0]}」を適用しました`
      : `🌐 カルチャーコンボ：${labels.join(" × ")}`;
    showPresetToast(msg, APPLY_HINT);
  }, [activeCultureTypes, buildInputs, variationMemory, showPresetToast]);

  /** ⚡ この画像でバズる：画像を元にSNSバズり最強設定を適用して即座に生成 */
  const handleImageViral = useCallback(() => {
    if (!imageDataUrl) return;
    const next = buildImageViralInputs(buildInputs());
    setScopes(next.scopes);
    setMoods(next.moods);
    setAutoMoodCategories(next.autoMoodCategories ?? []);
    setViralMode(next.viralMode);
    setExtraInstructions(next.extraInstructions);
    setActiveWorldPresets([]);
    setWorldCombinedNote("");
    setActiveGodModes([]);
    setActiveEffectTypes([]);
    setActiveSnsTypes([]);
    setActiveCultureTypes([]);
    setActiveAssistModes([]);
    setScopeFlashKey((k) => k + 1);
    // 設定適用後に即座に生成実行
    pendingRunRef.current = next;
    setPendingRunKey((k) => k + 1);
  }, [imageDataUrl, buildInputs]);

  // ─── リセット系 ────────────────────────────────────────────────────────────────

  /**
   * 全リセット（完全版）：変更対象・守るもの・プリセット・詳細設定・見た目・重複制御・
   * 一時プレビューをすべて初期状態に戻す。
   * 履歴・お気に入り・評価・学習データ（skyveil / preferenceProfile）は保持する。
   * 確認ダイアログは呼び出し元で出すこと。
   */
  const handleResetAll = useCallback(() => {
    // ── 変更対象 ───────────────────────────────────────────────────────────────
    setScopes([]);
    // ── 守るもの ───────────────────────────────────────────────────────────────
    setBodyPoseLock(false);
    setColorMoodLock(false);
    setCompositionLock(false);
    // faceLock は顔・同一性最優先方針のため true を維持（リセット対象外）
    // ── プリセット・モード ─────────────────────────────────────────────────────
    setActiveWorldPresets([]);
    setWorldCombinedNote("");
    setActiveGodModes([]);
    setActiveBoosts([]);
    setActiveEffectTypes([]);
    setActiveSnsTypes([]);
    setActiveCultureTypes([]);
    setActiveAssistModes([]);
    setChaosLabel(null);
    setMoods([]);
    setAutoMoodCategories([]);
    setExtraInstructions("");
    setNgList("");
    setViralMode(false);
    setAvoidCliche(false);
    // ── 詳細設定 ───────────────────────────────────────────────────────────────
    setDetails(DEFAULT_DETAILS);
    // ── 好み反映 ───────────────────────────────────────────────────────────────
    setZozoApplied(null);
    setFavoriteLearnEnabled(false);
    setSkyveilOneShot(false);
    // ── 見た目 / 質感 ──────────────────────────────────────────────────────────
    setRealismLevel(3);
    setRealismType(null);
    setGlossLevel(3);
    setWindLevel(0);
    // ── 一時プレビュー ─────────────────────────────────────────────────────────
    setRestoredItem(null);
    setPatternPreview(null);
    setScopeFlashKey((k) => k + 1); // スコープボタンをフラッシュ
    void logOperation("reset");
    showPresetToast("↺ 全リセット完了", "変更対象・設定・プレビューをすべて初期化しました。履歴・学習データは保持。");
  }, [showPresetToast]);

  // handleResetGod / handleResetAssist は SelectionSummary（撤去済み）専用だったため削除。
  // 必要なリセットは onResetAll（全リセット）から行われる。

  /** 🚫 量産AI検知：生成済みプロンプトを偏り分析し結果を表示する。 */
  const handleMassProductionCheck = useCallback(() => {
    const texts = items
      .map((item) => item.promptText)
      .filter((t) => t.length > 0);

    if (texts.length === 0) {
      showPresetToast("⚠️ プロンプトを先に生成してください", "");
      return;
    }

    // 現在のバッチIDを除外して履歴と比較
    const currentBatchId = items[0]?.batchId;
    void runBiasAnalysis(texts, currentBatchId);
  }, [items, runBiasAnalysis, showPresetToast]);

  useEffect(() => {
    if (pendingRunRef.current) {
      const inputs = pendingRunRef.current;
      pendingRunRef.current = null;
      void runGenerate(inputs);
    }
    // pendingRunKey is intentionally included so handleArrange can guarantee
    // the effect fires even when scopes/moods didn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes, moods, count, details, viralMode, pendingRunKey, runGenerate]);

  /** ↩ 前の生成に戻る */
  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const [restored, ...rest] = stack;
      setItems(restored);
      return rest;
    });
  }, []);

  /** ✨ アレンジ：過去案をベースに生成 */
  const handleArrange = useCallback(
    (sourceItem: PromptHistoryItem) => {
      setView("main");
      setFavPanelOpen(false);
      const arrangeInputs = buildArrangeInputs(buildInputs(), sourceItem);
      setScopes(arrangeInputs.scopes);
      setMoods(arrangeInputs.moods);
      setAutoMoodCategories(arrangeInputs.autoMoodCategories ?? []);
      setDetails(arrangeInputs.details);
      setExtraInstructions(arrangeInputs.extraInstructions); // アレンジ指示を UI にも反映
      setViralMode(false);
      setArrangeSource(sourceItem);
      pendingRunRef.current = arrangeInputs;
      setPendingRunKey((k) => k + 1); // guarantee effect fires
    },
    [buildInputs]
  );

  /**
   * 🔁 同じ構成で再生成：履歴アイテムの全設定を現在の画面に復元する。
   * - PromptHistoryItem に保存されているフィールドは直接復元。
   * - settingsSnapshot があればそこから windLevel / zozoApplied / activeBoosts も復元。
   * - ない場合（古い履歴）は保存されているフィールドのみ復元し、バナーで案内。
   */
  const handleRestoreFromHistory = useCallback(
    (item: PromptHistoryItem) => {
      setView("main");
      setFavPanelOpen(false);

      // ── 基本設定（PromptHistoryItem に常にある） ─────────────────────────
      setScopes(item.scopes ?? []);
      setMoods(item.moods ?? []);
      setDetails(item.details ?? ({} as import("./types").DetailSettings));
      setFaceLock(item.faceLock ?? false);
      setNgList(item.ngList ?? "");
      setViralMode(item.viralMode ?? false);
      setExtraInstructions(item.extraInstructions ?? "");

      // ロックの各フィールドを展開
      const lk = item.locks ?? {};
      setBodyPoseLock(lk.body_shape ?? false);
      setColorMoodLock(lk.color ?? false);
      setCompositionLock(lk.camera ?? false);

      // 質感・リアル度
      if (item.realismLevel != null) setRealismLevel(item.realismLevel);
      if (item.realismType != null) setRealismType(item.realismType ?? null);
      if (item.glossLevel != null) setGlossLevel(item.glossLevel);
      if (item.textureOriginal != null) setTextureOriginal(item.textureOriginal);
      if (item.textureDisabled != null) setTextureDisabled(item.textureDisabled);

      // 出力先
      if (item.promptTarget) setPromptTarget(item.promptTarget);

      // 元画像（サムネイル）
      if (item.sourceImageThumbnail) {
        setImageDataUrl(item.sourceImageThumbnail);
      }

      // ── 拡張スナップショット（新しい履歴のみ存在） ─────────────────────
      const ss = item.settingsSnapshot;
      if (ss) {
        if (ss.windLevel != null) setWindLevel(ss.windLevel);
        if (ss.zozoApplied !== undefined) setZozoApplied(ss.zozoApplied);
        if (ss.activeBoosts) setActiveBoosts(ss.activeBoosts);
        if (ss.colorStrategy !== undefined) setColorStrategy(ss.colorStrategy as import("./types").ColorStrategy | null);
        if (ss.artStyle !== undefined) setArtStyle(ss.artStyle as import("./types").ArtStyle | null);
        if (ss.era !== undefined) setEra(ss.era as import("./types").Era | null);
      }

      // 確認バナー表示用
      setRestoredItem(item);
    },
    [setView, setFavPanelOpen, setScopes, setMoods, setDetails, setFaceLock,
     setNgList, setViralMode, setExtraInstructions, setBodyPoseLock, setColorMoodLock,
     setCompositionLock, setRealismLevel, setRealismType, setGlossLevel,
     setTextureOriginal, setTextureDisabled, setPromptTarget, setImageDataUrl,
     setWindLevel, setZozoApplied, setActiveBoosts, setColorStrategy, setArtStyle, setEra]
  );

  /**
   * ✨ インライン・アレンジ：履歴画面を離れずにその場で生成し結果を返す。
   * 元プロンプトの保護ルール（faceLock / locks / 変更範囲）を尊重する。
   */
  const handleArrangeInline = useCallback(
    async (sourceItem: PromptHistoryItem, selectedScopes?: Scope[]): Promise<ArrangeResult | null> => {
      const base = buildArrangeInputs(buildInputs(), sourceItem);
      // 使用する要素（ON）。未指定なら元プロンプトの全変更範囲。
      const usedScopes = (selectedScopes && selectedScopes.length > 0)
        ? selectedScopes
        : base.scopes;
      // 除外要素＝候補軸のうち ON でないもの（フィルタ指示で明示的に外す）
      const excludedScopes = arrangeCandidateScopes(sourceItem).filter((s) => !usedScopes.includes(s));
      const filterNote = buildElementFilterInstruction(usedScopes, excludedScopes);

      // 元プロンプトの固定設定を継承（背景固定・顔固定などを勝手に変えない）
      const arrangeInputs: PromptInputs = {
        ...base,
        scopes: usedScopes,
        faceLock: sourceItem.faceLock,
        locks: sourceItem.locks ?? base.locks,
        expression: sourceItem.faceLock ? undefined : base.expression,
        extraInstructions: [base.extraInstructions, filterNote].filter(Boolean).join("\n\n"),
      };
      try {
        const recentGenres    = getRecentGenres();
        const recentSubStyles = getRecentSubStyles();
        const res = await generateViaBackend(arrangeInputs, imageDataUrl, recentGenres, recentSubStyles);
        const usedGenres = res.proposals.map((p) => p.genre).filter((g): g is string => Boolean(g));
        if (usedGenres.length > 0) pushRecentGenres(usedGenres);
        const usedSub = res.proposals
          .flatMap((p) => p.subStyles ?? [])
          .filter((s): s is string => typeof s === "string" && s.length > 0);
        if (usedSub.length > 0) pushRecentSubStyles(usedSub);
        return {
          source: sourceItem,
          inputs: arrangeInputs,
          proposals: res.proposals,
          changedAxes: computeChangedAxes(arrangeInputs.scopes),
          createdAt: Date.now(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showPresetToast("⚠️ アレンジ生成に失敗しました", msg.slice(0, 80));
        return null;
      }
    },
    [buildInputs, imageDataUrl, showPresetToast]
  );

  /** アレンジ案をお気に入りとして履歴へ保存する（生成画像・評価・派生元メタを含む）。 */
  const handleSaveArranged = useCallback(
    async (
      result: ArrangeResult,
      proposal: GeneratedProposal,
      localState?: import("./components/ArrangePreviewPanel").ProposalLocalState,
    ) => {
      const batchId = uid();
      const built = buildHistoryItems({
        proposals: [proposal],
        target: "unified",
        batchId,
        inputs: result.inputs,
        thumbnail: result.source.sourceImageThumbnail ?? null,
      });

      // changedAxes から使用/除外スコープを抽出
      const usedScopes   = result.changedAxes.filter((a) => a.changed).map((a) => a.scope);
      const excludedScopes = result.changedAxes.filter((a) => !a.changed).map((a) => a.scope);

      const favItems = built.map((item) => {
        const base = { ...item, isFavorite: true };
        // 派生元リンク + アレンジメタ
        const withMeta = {
          ...base,
          derivedFromId:         result.source.id,
          derivedFromDate:       result.source.createdAt,
          arrangeCaseNumber:     (proposal.index ?? 0) + 1,
          arrangeUsedScopes:     usedScopes.length > 0 ? usedScopes : undefined,
          arrangeExcludedScopes: excludedScopes.length > 0 ? excludedScopes : undefined,
        };
        // 生成画像・評価を引き継ぐ
        if (localState && localState.images.length > 0) {
          return {
            ...withMeta,
            ...buildResultImagesPatch(localState.images),
            resultRatings:       localState.ratings.length > 0 ? localState.ratings : undefined,
            resultMemos:         localState.memos.length > 0 ? localState.memos : undefined,
            resultBgRatings:     localState.bgRatings.length > 0 ? localState.bgRatings : undefined,
            resultOutfitRatings: localState.outfitRatings.length > 0 ? localState.outfitRatings : undefined,
            resultPoseRatings:   localState.poseRatings.length > 0 ? localState.poseRatings : undefined,
            generatedResultAddedAt: Date.now(),
          };
        }
        return withMeta;
      });
      await saveBatch(favItems);
      void refreshFavoriteProfile();
      // 保存完了トースト
      const imgCount = localState?.images.length ?? 0;
      showPresetToast(
        "✨ アレンジお気に入りに保存しました",
        imgCount > 0 ? `画像 ${imgCount} 枚・評価付きで保存` : "プロンプトのみ保存（画像は未登録）",
      );
      void logOperation("arrange_save", { caseNumber: (proposal.index ?? 0) + 1, images: imgCount });
    },
    [refreshFavoriteProfile, showPresetToast]
  );

  /** 案カードからのお気に入り/評価/メモ変更を反映する。 */
  const handleItemUpdate = useCallback(
    async (id: string, patch: Partial<PromptHistoryItem>) => {
      await updateItemDb(id, patch);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
      // 評価/画像/お気に入りいずれかが変わったら色・画像・評価分析の入力を refresh
      const RELOAD_KEYS = [
        "isFavorite", "resultRatings", "resultMemos",
        "resultBgRatings", "resultOutfitRatings", "resultPoseRatings",
        "resultImageDataList", "resultImageData",
      ];
      if (RELOAD_KEYS.some((k) => Object.prototype.hasOwnProperty.call(patch, k))) {
        void refreshFavoriteProfile();
      }
      // 操作ログ（skyveil学習）：お気に入り・評価を記録
      if (Object.prototype.hasOwnProperty.call(patch, "isFavorite")) {
        void logOperation("favorite", { id, value: patch.isFavorite });
      }
      if (["resultRatings", "resultBgRatings", "resultOutfitRatings", "resultPoseRatings"]
        .some((k) => Object.prototype.hasOwnProperty.call(patch, k))) {
        void logOperation("rate", { id });
      }
      // 失敗理由メモ（skyveil学習材料・自動反映はしない）
      if (Object.prototype.hasOwnProperty.call(patch, "failureMemo") && patch.failureMemo) {
        void logOperation("fail_memo", {
          id,
          reasons: patch.failureMemo.selectedReasons,
          severity: patch.failureMemo.severity,
        });
      }
    },
    [refreshFavoriteProfile]
  );

  const hasResults = items.length > 0;

  const scopeLabel = useMemo(() => {
    const map: Record<Scope, string> = {
      background: "背景",
      foreground: "前景演出",
      pose: "ポーズ",
      hair: "髪",
      outfit: "衣装",
      cosplay: "コスプレ",
      cyber: "機械化",
      camera: "カメラアングル",
      props: "持ち物・小物",
      big_object: "大物",
      vehicle: "乗り物",
      myth: "神話/幻獣",
      lighting: "ライティング",
      aspect_ratio: "アスペクト比",
    };
    return scopes.map((s) => map[s]).join(" + ") || "—";
  }, [scopes]);

  // P4: 出力先ラベル（表示のみ。promptTarget は安全フィルタモードで生成ロジックは不変）
  const outputTargetLabel = useMemo(() => {
    switch (promptTarget) {
      case "chatgpt_safe": return "ChatGPT";
      case "gemini_safe":  return "Gemini";
      case "nano_safe":    return "Nano Banana";
      default:             return "両対応";
    }
  }, [promptTarget]);

  return (
    <div className="min-h-screen">
      <main className="w-full px-2 py-2">
        {view === "history" ? (
          <HistoryView
            key={`history-${dataVersion}`}
            onBack={() => {
              setView("main");
              // 履歴ビューで削除・評価変更があったかもしれないので分析入力を再ロード
              void refreshFavoriteProfile();
            }}
            initialFavoritesOnly={historyFavoritesOnly}
            onArrangeInline={handleArrangeInline}
            onSaveArranged={handleSaveArranged}
            onSendToGenerator={handleArrange}
            onRestore={handleRestoreFromHistory}
            favoriteProfile={favoriteProfile}
            favoriteLearnEnabled={favoriteLearnEnabled}
          />
        ) : (
          <>
          {/* 🛡🤖 保護状態＋AI分析を1段に統合した常時表示バー（P4・案B / sticky・読み取り専用） */}
          <GlobalProtectionBar
            faceLock={faceLock}
            risk={liveIdentityRisk}
            analysisSummary={
              <AnalysisStatusStrip
                variant="summary"
                live={analysisLive.state}
                categories={analysisCategories}
              />
            }
            analysisDetail={
              <AnalysisStatusStrip
                variant="detail"
                live={analysisLive.state}
                categories={analysisCategories}
                detailOpen={analysisDetailOpen}
                onDetail={toggleAnalysisDetail}
              />
            }
            actions={
              <>
                {/* 出力先 */}
                <PromptTargetSelector value={promptTarget} onChange={setPromptTarget} />
                {/* 案数 */}
                <div className="flex items-center gap-1.5 select-none">
                  <span className="text-[10px] text-text-muted/50 shrink-0">案数</span>
                  <div className="flex gap-1">
                    {([2, 3, 4, 5, 6] as Count[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCount(c)}
                        className={[
                          "w-6 h-6 rounded-md text-[11px] font-bold border transition leading-none",
                          count === c
                            ? "border-accent/80 bg-accent/25 text-white shadow-[0_0_6px_rgba(139,92,246,0.4)]"
                            : "border-[#252e44] bg-transparent text-white/45 hover:border-accent/40 hover:text-white/80",
                        ].join(" ")}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                {/* ✨ 生成ボタン（コンパクト・機能と Ctrl+Enter は不変） */}
                <button
                  type="button"
                  disabled={!canGenerate || generating}
                  onClick={handleGenerate}
                  className={[
                    "inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-[13px]",
                    "transition-all duration-300 select-none shrink-0",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    justCompleted
                      ? "bg-emerald-500 text-white hover:bg-emerald-400"
                      : canGenerate
                        ? "bg-accent text-white hover:bg-accent-hover"
                        : "bg-[#1a2030] text-white/40",
                  ].join(" ")}
                >
                  {generating ? (
                    <>
                      <span className="inline-block animate-spin leading-none">⟳</span>
                      生成中…
                    </>
                  ) : justCompleted ? (
                    "✅ 完了！"
                  ) : (
                    <>
                      ✨ プロンプトを生成
                      <span className="text-[10px] font-normal opacity-50 ml-0.5 hidden lg:inline">Ctrl+↵</span>
                    </>
                  )}
                </button>
              </>
            }
          />
          {/* 🤖 AI分析ライブビュー：GPB 展開内の[ライブビュー]で開く（M-2 統合） */}
          {analysisDetailOpen && (
            <div ref={analysisLiveRef} className="mb-3">
              <AnalysisLiveView
                state={analysisLive.state}
                onRetry={() => void refreshFavoriteProfile()}
              />
            </div>
          )}
          <div
            className="lg:grid lg:gap-6"
            style={{
              gridTemplateColumns: explorerOpen
                ? `${explorerWidth}px 360px minmax(0, 1fr)`
                : "48px 360px minmax(0, 1fr)",
              transition: "grid-template-columns 220ms ease-out",
            }}
          >
            <MiniExplorer
              open={explorerOpen}
              onOpen={() => setExplorerOpen(true)}
              onSelectImage={setImageDataUrl}
              onClose={() => setExplorerOpen(false)}
              width={explorerWidth}
              onResize={handleExplorerResize}
            />
            <ImageSidebar
              imageDataUrl={imageDataUrl}
              onImageChange={setImageDataUrl}
              scopes={scopes}
              count={count}
              generating={generating}
              viralMode={viralMode}
              onShowCalendar={() => {
                setHistoryFavoritesOnly(false);
                setView("history");
              }}
              onShowFavorites={() => {
                setHistoryFavoritesOnly(true);
                setView("history");
              }}
              onToggleExplorer={() => setExplorerOpen((v) => !v)}
              explorerOpen={explorerOpen}
              onOpenSelectionPrompt={() => setSelectionModalOpen(true)}
              onOpenSimpleEditor={() => setSimpleEditorOpen(true)}
              onImageViral={imageDataUrl ? handleImageViral : undefined}
            />

            <div className="space-y-5 mt-5 lg:mt-0 min-w-0 pb-24">

              {/* 🛟 履歴・お気に入り復旧（緊急対応・読み取り＋非破壊）。入口ボタン＋展開パネル */}
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRecoveryOpen((v) => !v)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-amber-400/45 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition leading-none"
                  title="IndexedDB に残っている履歴・お気に入りを確認・再読み込み・書き出し/読み込み"
                >
                  🛟 履歴・お気に入り復旧 {recoveryOpen ? "▲" : "▼"}
                </button>
                <button
                  type="button"
                  onClick={() => setPostCalendarOpen(true)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/8 text-accent/90 hover:bg-accent/15 hover:border-accent/60 transition leading-none"
                >
                  📅 1ヶ月投稿カレンダー
                </button>
              </div>
              {recoveryOpen && (
                <RecoveryPanel onReloadAll={reloadAllData} onClose={() => setRecoveryOpen(false)} />
              )}

              {/* 🔁 復元確認バナー：「同じ構成で再生成」後に表示 */}
              {restoredItem && (
                <div className="rounded-2xl border border-sky-400/45 bg-sky-500/10 px-4 py-3 flex items-center gap-3 flex-wrap shadow-[0_0_20px_-4px_rgba(56,189,248,0.35)]">
                  <span className="text-[18px] shrink-0">🔁</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-sky-100 leading-snug">
                      この構成を復元しました
                    </p>
                    <p className="text-[12px] text-sky-200/70 leading-snug">
                      {restoredItem.settingsSnapshot
                        ? `${new Date(restoredItem.createdAt).toLocaleDateString("ja-JP")} 生成 — 変更対象・詳細設定・元画像・全設定を復元しました`
                        : `${new Date(restoredItem.createdAt).toLocaleDateString("ja-JP")} 生成（古い履歴のため一部設定は復元できません）`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const inputs = buildInputs();
                        setRestoredItem(null);
                        void runGenerate(inputs);
                      }}
                      disabled={!canGenerate || generating}
                      className="rounded-lg px-3 py-1.5 text-[13px] font-bold border border-sky-400/65 bg-sky-500/22 text-sky-100 hover:bg-sky-500/35 transition disabled:opacity-50 leading-none"
                    >
                      🚀 このまま生成
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoredItem(null)}
                      className="rounded-lg px-3 py-1.5 text-[12px] border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
                    >
                      ✕ 閉じる
                    </button>
                  </div>
                </div>
              )}

              {/* 🏆 学習反映差分プレビュー（成功パターン）：反映前に必ず差分確認 */}
              {patternPreview && (
                <div className="rounded-2xl border border-emerald-400/45 bg-emerald-500/8 px-4 py-3 space-y-2 shadow-[0_0_20px_-4px_rgba(52,211,153,0.3)]">
                  <p className="text-[14px] font-bold text-emerald-100">
                    学習反映プレビュー — {patternPreview.pattern.title}
                  </p>
                  {patternPreview.preview.diffs.length > 0 ? (
                    <div className="space-y-0.5">
                      <p className="text-[12px] text-emerald-200/80 font-semibold">変更予定（反映されます）：</p>
                      {patternPreview.preview.diffs.map((d, i) => (
                        <p key={i} className="text-[12px] text-text-base/90 leading-snug">
                          ・{d.label}（{String(d.before)} → {String(d.after)}）<span className="text-text-muted/60 text-[10px]">Risk:{d.risk}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-text-muted/75">追加される変更対象はありません（すべて現状維持またはブロック）。</p>
                  )}
                  {patternPreview.preview.blockedDiffs.length > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[12px] text-rose-200 font-semibold">ブロック（保護対象のため反映不可）：</p>
                      {patternPreview.preview.blockedDiffs.map((d, i) => (
                        <p key={i} className="text-[12px] text-rose-200/90 leading-snug">⚠️ {d.label} — {d.warning}</p>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmPattern}
                      disabled={!patternPreview.preview.canApply}
                      className="rounded-lg px-3 py-1.5 text-[13px] font-bold border border-emerald-400/60 bg-emerald-500/22 text-emerald-50 hover:bg-emerald-500/35 transition disabled:opacity-40 disabled:cursor-not-allowed leading-none"
                    >
                      ✓ この変更を反映
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatternPreview(null)}
                      className="rounded-lg px-3 py-1.5 text-[12px] border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
                    >
                      キャンセル
                    </button>
                    <span className="text-[10px] text-text-muted/55 ml-1">※ 反映ボタンを押すまで設定は変わりません</span>
                  </div>
                </div>
              )}

              {/* 📡 現在の反映状態バー：今プロンプトに効く設定を一目で（読み取り専用） */}
              <ReflectionStatusBar
                scopes={scopes}
                faceLock={faceLock}
                bodyPoseLock={bodyPoseLock}
                colorMoodLock={colorMoodLock}
                compositionLock={compositionLock}
                avoidCliche={avoidCliche}
                activeGodModes={activeGodModes}
                chaosLabel={chaosLabel}
                activeBoosts={activeBoosts}
                viralMode={viralMode}
                activeSnsLabels={activeSnsTypes.map(getSnsLabel)}
                activeCultureLabels={activeCultureTypes.map(getCultureLabel)}
                activeWorldPresets={activeWorldPresets}
                favoriteEnabled={favoriteLearnEnabled}
                favoriteProfile={favoriteProfile}
                zozoApplied={zozoApplied}
                realismLevel={realismLevel}
                realismType={realismType}
                glossLevel={glossLevel}
                windLevel={windLevel}
                policyApplied={policyApplied}
                motifControlledCount={countLevels(levels).controlled}
                comboControlCount={countComboPolicies(comboPolicies).block + countComboPolicies(comboPolicies).alt}
                colorWeights={colorWeights}
                onResetAll={handleResetAll}
              />


              {/* 🧬 skyveil好みAI：既存の好み分析を束ねた単一の反映コントロール */}
              <SkyveilBar
                enabled={favoriteLearnEnabled}
                strength={skyveilStrength}
                profile={skyveilProfile}
                analyzing={analyzingProfile}
                sampleCount={profileSampleCount}
                minSamples={MIN_SAMPLES}
                oneShotArmed={skyveilOneShot}
                onToggle={(v) => {
                  setFavoriteLearnEnabled(v);
                  if (v) setSkyveilOneShot(false);
                  showPresetToast(v ? "🧬 skyveil好み反映 ON" : "skyveil好み反映 OFF",
                    v ? `${skyveilProfile.summary || "好みを次回生成に反映します"}` : "");
                }}
                onStrength={(s) => setFavoriteStrength(STRENGTH_TO_FAVORITE[s])}
                onUpdateAnalysis={() => { void handleRunPreferenceAnalysis(false); }}
                onOneShot={() => {
                  setSkyveilOneShot(true);
                  showPresetToast("✨ 今回だけ skyveil好みを反映します", "次の生成にのみ適用されます。");
                }}
                onReset={() => {
                  setFavoriteLearnEnabled(false);
                  setSkyveilOneShot(false);
                  showPresetToast("skyveil好み反映をリセットしました", "");
                }}
                profileError={profileError}
                autoLearnEnabled={autoLearnEnabled}
                onToggleAutoLearn={handleToggleAutoLearn}
                onClearProfile={handleClearPreferenceProfile}
                successPatterns={successPatterns}
                onApplyPattern={handleApplyPattern}
              />

              <QuickActions
                viralMode={viralMode}
                canVariant={!!imageDataUrl || hasResults}
                canUndo={undoStack.length > 0}
                favPanelOpen={favPanelOpen}
                disabled={generating}
                chaosLabel={chaosLabel}
                activeWorldPresets={activeWorldPresets}
                activeEffectTypes={activeEffectTypes}
                onViral={handleViral}
                onViralOff={handleViralOff}
                onRandom={handleRandom}
                onVariant={handleVariant}
                onUndo={handleUndo}
                onMassProductionCheck={handleMassProductionCheck}
                onToggleFavPanel={() => setFavPanelOpen((v) => !v)}
                onShowCalendar={() => {
                  setHistoryFavoritesOnly(false);
                  setView("history");
                }}
                onWorldPresetToggle={handleWorldPresetToggle}
                onEffectToggle={handleEffectToggle}
                onGodToggle={handleGodToggle}
                onBoostToggle={handleBoostToggle}
                avoidCliche={avoidCliche}
                onAvoidClicheChange={setAvoidCliche}
                onAssistToggle={handleAssistToggle}
                onSnsSingle={handleSnsSingle}
                onCultureSingle={handleCultureSingle}
                activeGodModes={activeGodModes}
                activeBoosts={activeBoosts}
                activeAssistModes={activeAssistModes}
                activeSnsLabels={activeSnsTypes.map(getSnsLabel)}
                activeCultureLabels={activeCultureTypes.map(getCultureLabel)}
                onResetAll={handleResetAll}
              />

              {/* 🔬 重複分析センター */}
              {(massProductionResult || historyAnalysis) && (
                <DuplicateAnalysisPanel
                  biasResult={massProductionResult}
                  historyAnalysis={historyAnalysis}
                  levels={levels}
                  policyApplied={policyApplied}
                  onLevelChange={handleLevelChange}
                  onBulkLevel={handleDupBulkLevel}
                  onClearNg={handleDupClearNg}
                  onAutoAdjust={handleAutoAdjust}
                  onUndoAutoAdjust={handleUndoAutoAdjust}
                  canUndoAuto={levelsUndoStack.length > 0}
                  changedIds={changedIds}
                  comboPolicies={comboPolicies}
                  onComboPolicyChange={handleComboPolicyChange}
                  onOpenLab={() => setAnalysisLabOpen(true)}
                  colorAnalysis={colorAnalysis}
                  colorWeights={colorWeights}
                  onColorWeightChange={handleColorWeightChange}
                  onColorWeightsReset={handleColorWeightsReset}
                  onColorAutoAdjust={handleColorAutoAdjust}
                  onColorUndoAdjust={handleColorUndoAdjust}
                  canColorUndo={colorWeightsUndoStack.length > 0}
                  colorChangedKeys={colorChangedKeys}
                  colorWindowSize={colorWindowSize}
                  onColorWindowSizeChange={setColorWindowSize}
                  imageAnalysis={imageAnalysis}
                  onStartImageAnalysis={startImageAnalysis}
                  imageAnalyzeProgress={imageAnalyzeProgress}
                  onCancelImageAnalysis={cancelImageAnalysis}
                  ratingAnalysis={ratingAnalysis}
                  preferenceProfile={preferenceProfile}
                  profileSampleCount={profileSampleCount}
                  agent={agentAnalysis}
                  onAgentAction={handleAgentAction}
                  onApplyPolicies={handleDupApplyPolicies}
                  onUnapplyPolicies={handleDupUnapplyPolicies}
                  onResetPolicies={handleDupResetPolicies}
                  onAutoFix={() => {
                    const antiInputs = buildAntiTemplateInputs(buildInputs(), variationMemory);
                    setScopes(antiInputs.scopes);
                    setMoods(antiInputs.moods);
                    setAutoMoodCategories(antiInputs.autoMoodCategories ?? []);
                    setDetails(antiInputs.details);
                    setViralMode(antiInputs.viralMode);
                    setExtraInstructions(antiInputs.extraInstructions);
                    setActiveWorldPresets([]);
                    setWorldCombinedNote("");
                    setScopeFlashKey((k) => k + 1);
                    setVariationMemory((prev) => updateMemory(prev, {
                      moods:  antiInputs.moods,
                      scopes: antiInputs.scopes,
                    }));
                    setMassProductionResult(null);
                    showPresetToast("🎭 別ジャンルへ変換しました", "プロンプトを生成してください。");
                  }}
                  onReroll={() => {
                    setMassProductionResult(null);
                    void runGenerate(buildInputs());
                  }}
                  onResetBias={handleDupResetBias}
                  onDismiss={handleDupDismiss}
                  analysisStats={analysisStats}
                  activeScopes={scopes}
                  favoriteProfile={favoriteProfile}
                  favoriteLearnEnabled={favoriteLearnEnabled}
                />
              )}

              <ControlPanel
                scopes={scopes}
                onScopesChange={setScopes}
                onScopesReset={() => setScopes([])}
                onResetAll={() => {
                  handleResetAll();
                  setScopes([]);
                  setActiveBoosts([]);
                  setFavoriteLearnEnabled(false);
                  setZozoApplied(null);
                }}
                boostArea={
                  <BoostControls
                    favoriteEnabled={favoriteLearnEnabled}
                    onFavoriteEnabledChange={setFavoriteLearnEnabled}
                    favoriteStrength={favoriteStrength}
                    onFavoriteStrengthChange={setFavoriteStrength}
                    favoriteProfile={favoriteProfile}
                    outfitScopeOn={scopes.includes("outfit")}
                    outfitConflict={
                      // 衣装に強い影響を与える指定がアクティブな時のみ「他指定が優先」を提示
                      // （映画/レトロ等の世界観だけでは ZOZO 競合とはみなさない）
                      activeGodModes.includes("outfit") ||
                      activeWorldPresets.some((w) =>
                        ["y2k", "y3k", "street", "gothic", "wafuu", "jirai"].includes(w)
                      )
                    }
                    zozoApplied={zozoApplied}
                    onZozoApply={(t) => {
                      setZozoApplied(t);
                      showPresetToast(
                        t.mode === "priority"
                          ? "⭐ ZOZOトレンドを優先反映に設定しました"
                          : "✅ ZOZOトレンドを衣装プロンプトに反映しました",
                        ""
                      );
                    }}
                    onZozoSetPriority={(priority) => {
                      if (!zozoApplied) return;
                      const nextMode = priority ? "priority" : "assist";
                      setZozoApplied({ ...zozoApplied, mode: nextMode });
                      showPresetToast(
                        priority
                          ? "⭐ ZOZOを優先反映に切替"
                          : "✅ ZOZOを補助反映に戻しました",
                        ""
                      );
                    }}
                    onZozoClear={() => {
                      setZozoApplied(null);
                      showPresetToast("ZOZOトレンドの反映を解除しました", "");
                    }}
                    windLevel={windLevel}
                    onWindLevelChange={setWindLevel}
                    windApplicable={
                      scopes.includes("hair") || scopes.includes("outfit") ||
                      scopes.includes("foreground") || scopes.includes("pose") ||
                      scopes.includes("camera")
                    }
                  />
                }
                scopeFlashKey={scopeFlashKey}
                strength={strength}
                glossLevel={glossLevel}
                realismLevel={realismLevel}
                realismType={realismType}
                textureOriginal={textureOriginal}
                textureDisabled={textureDisabled}
                onStrengthChange={setStrength}
                onGlossChange={setGlossLevel}
                onRealismLevelChange={setRealismLevel}
                onRealismTypeChange={setRealismType}
                onTextureOriginalChange={setTextureOriginal}
                onTextureDisabledChange={setTextureDisabled}
                faceLock={faceLock}
                expression={expression}
                onFaceLockChange={setFaceLock}
                onExpressionChange={setExpression}
                bodyPoseLock={bodyPoseLock}
                colorMoodLock={colorMoodLock}
                compositionLock={compositionLock}
                onBodyPoseLockChange={setBodyPoseLock}
                onColorMoodLockChange={setColorMoodLock}
                onCompositionLockChange={setCompositionLock}
              />

              <DetailsCard
                scopes={scopes}
                value={details}
                onChange={setDetails}
                moods={moods}
                autoMoodCategories={autoMoodCategories}
                onMoodsChange={(m, a) => { setMoods(m); setAutoMoodCategories(a); }}
                era={era}
                colorStrategy={colorStrategy}
                artStyle={artStyle}
                onEraChange={setEra}
                onColorStrategyChange={setColorStrategy}
                onArtStyleChange={setArtStyle}
                extraInstructions={extraInstructions}
                onExtraInstructionsChange={setExtraInstructions}
                ngList={ngList}
                onNgListChange={setNgList}
                forbiddenTokens={forbiddenTokens}
                onForbiddenTokensChange={setForbiddenTokens}
                onSnsSelect={handleSns}
                onCultureSelect={handleCulture}
              />


              {/* ✨ アレンジ元プロンプト表示バナー */}
              {arrangeSource && (
                <div className="rounded-xl border border-violet-400/40 bg-violet-400/10 px-3.5 py-2.5 flex items-center gap-2.5 text-xs">
                  <span className="text-base shrink-0">✨</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-violet-200 font-semibold">アレンジ生成中</span>
                    <span className="text-text-muted ml-2">
                      元プロンプト: 案{arrangeSource.proposalIndex} ·{" "}
                      {new Date(arrangeSource.createdAt).toLocaleDateString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setArrangeSource(null)}
                    className="shrink-0 text-text-muted hover:text-text-base transition"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 設定サマリー（P4：出力先ラベルを追加・表示のみ） */}
              <div className="px-1 space-y-1.5">
                <div className="text-sm text-text-muted flex flex-wrap items-center gap-2">
                  <span className="text-text-base font-semibold">{scopeLabel}</span>
                  <span>/</span>
                  <span>{count}案 ・ 統一プロンプト</span>
                  <span className="text-text-muted/60">・ 出力先：{outputTargetLabel}</span>
                  {viralMode && (
                    <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-500/15 text-rose-200 border border-rose-500/40">
                      🔥 一発バズりモード
                    </span>
                  )}
                </div>
                <GenerationProgress
                  generating={generating}
                  count={count}
                  onComplete={handleGenerationComplete}
                  animationEnabled={true}
                  info={`${outputTargetLabel}向け / 統一プロンプト`}
                />
              </div>

              {error && (() => {
                const isBlocked =
                  error.includes("PROHIBITED_CONTENT") ||
                  error.includes("SAFETY") ||
                  error.includes("ブロックされました");

                // 「安全寄りに再試行」：複数の刺激要因を一度に外し、
                // 調整済みの inputs を直接組み立てて再生成する（state 非同期問題を回避）
                const handleSafeRetry = () => {
                  // ── 安全化する値を先にローカルで計算 ──
                  const nextViralMode = false;
                  const nextGodModes: string[] = [];
                  const nextBoosts = activeBoosts.filter((b) => b !== "buzz" && b !== "other_world");
                  const nextWorldPresets: import("./components/QuickActions").WorldPreset[] = [];
                  const nextWorldNote = "";

                  // スコープ：3軸まで絞る
                  const priorityOrder: Scope[] = [
                    "outfit", "background", "lighting", "camera", "hair",
                    "pose", "foreground", "cosplay", "props", "myth",
                    "big_object", "vehicle", "cyber", "aspect_ratio",
                  ];
                  const nextScopes = scopes.length > 3
                    ? priorityOrder.filter((s) => scopes.includes(s)).slice(0, 3)
                    : scopes;

                  // リアル度：4以上なら 2 に
                  const nextRealismLevel = realismLevel >= 4 ? 2 : realismLevel;

                  // 雰囲気：フィルタを引きやすい dark/gothic/emo/decadent を外す
                  const HIGH_RISK_MOODS = ["dark", "gothic", "emo", "decadent"];
                  const nextMoods = moods.filter((m) => !HIGH_RISK_MOODS.includes(m));

                  // NG：感度を引く可能性のある明示語を除去（書くだけで Gemini が反応する）
                  const TRIGGER_WORDS_TO_STRIP = [
                    "sensual", "suggestive", "intimate", "erotic",
                    "swimwear", "lingerie", "underwear", "panties", "bra",
                    "cleavage", "exposed", "topless", "nude", "naked",
                    "セクシー", "扇情", "下着", "水着",
                  ];
                  const nextNgList = ngList
                    .split(/[、,\n]+/)
                    .map((s) => s.trim())
                    .filter((s) => s && !TRIGGER_WORDS_TO_STRIP.some((w) => s.toLowerCase() === w.toLowerCase()))
                    .join(", ");

                  // 追加指示：肯定的な方向指示を注入（禁止語を書かず「上品寄り」を誘導）
                  const POSITIVE_DIRECTION =
                    "衣装は常識的な日常着。雑誌の表紙レベルの上品さで統一する。" +
                    "全体トーンは clean / editorial / artistic にする。";
                  const nextExtra = extraInstructions.includes(POSITIVE_DIRECTION)
                    ? extraInstructions
                    : (extraInstructions ? `${extraInstructions}\n${POSITIVE_DIRECTION}` : POSITIVE_DIRECTION);

                  // ── state を更新（次回以降の通常生成にも反映） ──
                  setViralMode(nextViralMode);
                  setActiveGodModes(nextGodModes);
                  setChaosLabel(null);
                  setActiveBoosts(nextBoosts);
                  setActiveWorldPresets(nextWorldPresets);
                  setWorldCombinedNote(nextWorldNote);
                  setScopes(nextScopes);
                  setRealismLevel(nextRealismLevel);
                  setMoods(nextMoods);
                  setNgList(nextNgList);
                  setExtraInstructions(nextExtra);

                  // ── エラー解除 ──
                  setError(null);
                  showPresetToast(
                    "🛡 安全寄り設定に切り替えて再生成します",
                    "バズり/神引き/世界観 OFF・スコープ縮小・暗い雰囲気を緩和・NG露骨語除去・上品方向追加",
                  );

                  // ── 調整済みの inputs で即再生成（state 反映を待たずに直接組み立て） ──
                  // buildInputs は現 state を読むが、上記 setState はまだ反映されていないため、
                  // 変更した値を override で直接渡す。
                  const safeInputs = buildInputs({
                    viralMode: nextViralMode,
                    scopes: nextScopes,
                    moods: nextMoods,
                    extraInstructions: nextExtra,
                    ngList: nextNgList,
                    realismLevel: nextRealismLevel,
                    realismType,                    // 変更なし
                  });
                  pendingRunRef.current = safeInputs;
                  setPendingRunKey((k) => k + 1);
                };

                return (
                  <section className="card border-rose-500/50 bg-rose-500/10 space-y-2">
                    <h3 className="text-sm font-semibold text-rose-300">
                      {isBlocked ? "🛑 Gemini の安全フィルタにブロックされました" : "⚠ 生成に失敗しました"}
                    </h3>
                    <p className="text-xs text-rose-200/90 break-all">{error}</p>

                    {isBlocked ? (
                      <>
                        <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/95 leading-relaxed space-y-1">
                          <p className="font-bold">よくある原因（多い順）：</p>
                          <ol className="list-decimal list-inside space-y-0.5 text-amber-100/85">
                            <li><b>一発バズりモード</b>が ON ← 最も引きやすい</li>
                            <li><b>変更対象が 4軸以上</b>（プロンプトが長く誤判定されやすい）</li>
                            <li><b>リアル度 4-5</b>（写真リアル）＋ 元画像が女性キャラ</li>
                            <li>履歴の <b>黒系・ゴシック・露出系</b>の偏りが累積</li>
                            <li>元画像に <b>露出多めの服</b>・水着など</li>
                          </ol>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSafeRetry}
                            className="rounded-lg px-3 py-1.5 text-[12px] font-bold border border-emerald-400/65 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 hover:border-emerald-400 transition shadow-[0_0_10px_-2px_rgba(52,211,153,0.4)]"
                          >
                            🛡 安全寄りに自動修正して再試行
                          </button>
                          <span className="text-[11px] text-text-muted/65">
                            （バズり/神引き/世界観OFF・3軸まで・リアル度↓・NG露骨語を除去＋肯定方向追加）
                          </span>
                        </div>

                        <p className="text-[11px] text-text-muted/55 pt-1">
                          ※ プロジェクト方針として、フィルタを回避する目的の改造は行いません。
                          このボタンは「より穏当な表現に寄せて再依頼」するだけです。
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-text-muted mt-2">
                        `npm run dev:all` でサーバーが起動しているか、`server/.env` のキーが有効か確認してください。
                      </p>
                    )}
                  </section>
                );
              })()}

              {hasResults && (
                <section className="space-y-5">
                  <PromptList
                    title="統一プロンプト"
                    subtitle="日本語・項目分け（ChatGPT / Nano Banana 共通。出力先に応じて自動最適化）"
                    items={items}
                    onUpdate={handleItemUpdate}
                    onArrange={handleArrange}
                    lock={currentLock}
                    skyveilProfile={skyveilProfile}
                  />
                </section>
              )}

              <footer className="text-center text-xs text-text-muted py-8">
                画像と設定はローカル（IndexedDB）と localhost:3001 経由でのみ送信。APIキーはブラウザに渡しません。
              </footer>
            </div>
          </div>
          </>
        )}
      </main>

      {/* ⭐ お気に入りプロンプト右スライドパネル（fixed） */}
      <FavoritesPanel
        key={`favorites-${dataVersion}`}
        open={favPanelOpen}
        onClose={() => setFavPanelOpen(false)}
        onArrange={handleArrange}
        onUseAsSource={(url) => {
          setImageDataUrl(url);
          setFavPanelOpen(false);
        }}
      />

      {/* 🖼 参照画像 / 要素抽出 右側固定パネル（fixed・新規要素・main view のみ） */}
      {view === "main" && (
        <ReferenceImportPanel
          protections={{ bodyPoseLock, compositionLock, colorMoodLock }}
          activeScopes={scopes}
          appliedNote={referenceNote}
          onApply={handleApplyReference}
          onClearAll={handleClearReference}
          onContextChange={handleReferenceContextChange}
          onOpenCompare={() => setCompareOpen(true)}
        />
      )}

      {/* 🆚 Compare Mode（参照↔生成 比較・全幅ビュー） */}
      <CompareModeView open={compareOpen} onClose={() => setCompareOpen(false)} />

      {/* 🔬 分析ラボ（重複分析の詳細探索・全幅ビュー） */}
      <AnalysisLabPanel
        open={analysisLabOpen}
        onClose={() => setAnalysisLabOpen(false)}
        motifCounts={historyAnalysis?.motifCounts ?? []}
        topCombos={historyAnalysis?.topCombos ?? []}
        levels={levels}
        comboPolicies={comboPolicies}
        onLevelChange={handleLevelChange}
        onBulkLevel={handleDupBulkLevel}
        onComboPolicyChange={handleComboPolicyChange}
      />

      {/* 🖌 選択範囲プロンプトモーダル */}
      {selectionModalOpen && imageDataUrl && (
        <SelectionPromptModal
          imageDataUrl={imageDataUrl}
          onClose={() => setSelectionModalOpen(false)}
        />
      )}

      {/* 📅 1ヶ月投稿カレンダー */}
      {postCalendarOpen && (() => {
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return (
          <PostingCalendarModal
            todayKey={todayKey}
            initialYear={now.getFullYear()}
            initialMonth={now.getMonth() + 1}
            onClose={() => setPostCalendarOpen(false)}
            onUseTheme={(hint) => {
              // テーマヒントを追加指示に追記（変更対象・固定設定は触らない）
              setExtraInstructions((prev) => prev ? `${prev}\n${hint}` : hint);
              setPostCalendarOpen(false);
              setView("main");
              showPresetToast("📅 投稿テーマを反映しました", "追加指示にヒントを追記。スコープ・固定設定は変更していません。");
            }}
          />
        );
      })()}

      {/* 🎨 簡易画像編集モーダル */}
      {simpleEditorOpen && imageDataUrl && (
        <SimpleImageEditor
          imageDataUrl={imageDataUrl}
          onClose={() => setSimpleEditorOpen(false)}
          onSave={(newUrl) => {
            setImageDataUrl(newUrl);
            setSimpleEditorOpen(false);
          }}
        />
      )}

      {/* ③ 生成完了トースト（右上・3秒） */}
      <CompletionToast trigger={toastTrigger} count={count} />

      {/* ✨ プリセット適用トースト（上部中央・2.8秒） */}
      <PresetAppliedToast trigger={fashionToastTrigger} message={fashionToastMsg} hint={fashionToastHint} />

      {/* Nano Banana 軽量化おすすめ警告（変更項目が多い時のみ） */}
      {promptTarget === "nano_safe" && scopes.length >= 4 && (
        <div className="fixed bottom-[92px] right-6 z-[100] max-w-[360px] rounded-xl border border-amber-400/50 bg-amber-500/12 backdrop-blur-md px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] text-amber-100 leading-snug">
            ⚠️ Nano Banana は変更項目が多いと顔や服の品質が崩れやすいです。
            変更を2〜3個に絞ると安定します（現在 {scopes.length}項目）。
          </p>
        </div>
      )}

      {/* ✨ 生成操作（出力先 / 案数 / プロンプト生成）は上部ヘッダー（GlobalProtectionBar の actions スロット）へ移設。
          下部固定バーは廃止し作業領域を広く確保。生成ロジック・Ctrl+Enter（グローバル keydown）は不変。 */}
    </div>
  );
}
