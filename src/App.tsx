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
import { SelectionSummary } from "./components/SelectionSummary";
import { generateViaBackend } from "./lib/backendClient";
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
import { analyzeFullHistory, type FullHistoryAnalysis } from "./lib/historyAnalyzer";
import { DuplicateAnalysisPanel } from "./components/DuplicateAnalysisPanel";
import {
  loadLevels, saveLevels, setLevel as setLevelFn, resetAllLevels, bulkSetLevels, clearNgLevels,
  isApplied, setAppliedStorage,
  getNgTokens, getMotifControls,
  computeAutoAdjust,
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
} from "./lib/history";
import { getRecentGenres, pushRecentGenres, clearRecentGenres } from "./lib/genreHistory";
import { getRecentSubStyles, pushRecentSubStyles, clearRecentSubStyles } from "./lib/subStyleHistory";
import { runAutoCleanup, getAutoCleanupEnabled } from "./lib/cleanup";
import { makeThumbnail } from "./lib/imageThumb";
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
import { computeChangedAxes, arrangeCandidateScopes, buildElementFilterInstruction } from "./lib/arrange";
import { buildFavoriteProfile, type FavoriteProfile } from "./lib/favoriteProfile";
import { analyzeAgent, type AgentActionId } from "./lib/aiAgent";
import { AssistantCharacter } from "./components/AssistantCharacter";
import { BoostControls } from "./components/BoostControls";
import type { ZozoTrend } from "./lib/zozoTrend";

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
  const [dimensionLevel,   setDimensionLevel]   = useState(s0.dimensionLevel);  // 1-5, 3=2.5D
  const [textureOriginal,  setTextureOriginal]  = useState(s0.textureOriginal); // 元画像維持
  const [textureDisabled,  setTextureDisabled]  = useState(s0.textureDisabled); // プロンプトに反映しない
  /** 出力先プラットフォームに合わせた安全モード（null = 解除済み・フィルタなし） */
  const [promptTarget, setPromptTarget] = useState<PromptTarget | null>(s0.promptTarget);
  /** アクティブな世界観プリセット（マルチセレクト、最大3） */
  const [activeWorldPresets, setActiveWorldPresets] = useState<WorldPreset[]>([]);
  /** 世界観プリセット由来の指示文（extraInstructions と分離して管理） */
  const [worldCombinedNote, setWorldCombinedNote] = useState("");
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
        const favs = all.filter((i) => i.isFavorite);
        setFavoriteProfile(buildFavoriteProfile(favs));
      } catch {
        // 分析失敗は無視
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** お気に入りプロファイルを再構築する（お気に入り変更後に呼ぶ）。 */
  const refreshFavoriteProfile = useCallback(async () => {
    try {
      const all = await getAll();
      setFavoriteProfile(buildFavoriteProfile(all.filter((i) => i.isFavorite)));
    } catch {
      // 無視
    }
  }, []);

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
      dimensionLevel, textureOriginal, textureDisabled,
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
    dimensionLevel, textureOriginal, textureDisabled,
    promptTarget, avoidCliche,
    bodyPoseLock, colorMoodLock, compositionLock,
    era, colorStrategy,
    faceLock, expression,
    artStyle, defaultAspectRatio,
    favoriteLearnEnabled, favoriteStrength,
    zozoApplied, activeBoosts, windLevel,
  ]);

  const buildInputs = useCallback(
    (override?: Partial<PromptInputs>): PromptInputs => ({
      scopes,
      target: "unified",
      moods,
      autoMoodCategories,
      count,
      // 顔・表情・同一性は常時保護。体型/色味/構図はUIトグルから。
      locks: {
        face:         true,
        identity:     true,
        expression:   true,
        body_shape:   bodyPoseLock,
        color:        colorMoodLock,
        camera:       compositionLock,
        aspect_ratio: compositionLock,
      },
      safety:   "fictional_ai",
      details,
      // worldCombinedNote（世界観プリセット由来）と追加指示を結合（出現制御は motifControls で別途反映）
      extraInstructions: [worldCombinedNote, extraInstructions].filter(Boolean).join("\n\n"),
      faceLock,
      expression: faceLock ? undefined : (expression ?? undefined),
      ngList: (() => {
        let base = mergeForbiddenIntoNgList(ngList, forbiddenTokens);
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
      viralMode,
      strength,
      glossLevel,
      dimensionLevel,
      textureOriginal,
      textureDisabled,
      // null（解除）は undefined として扱い、サーバー側で "full" にフォールバックさせる
      promptTarget: promptTarget ?? undefined,
      avoidCliche,
      era: era ?? undefined,
      colorStrategy: colorStrategy ?? undefined,
      artStyle: artStyle ?? undefined,
      // お気に入り学習：ONかつ傾向が抽出できている場合のみ反映（コピーではなく方向性）
      favoriteTraits:
        favoriteLearnEnabled && favoriteProfile && favoriteProfile.traitPhrases.length > 0
          ? favoriteProfile.traitPhrases
          : undefined,
      favoriteStrength:
        favoriteLearnEnabled && favoriteProfile && favoriteProfile.traitPhrases.length > 0
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
      zozoApplied,
      activeBoosts,
      windLevel,
    ]
  );

  /**
   * 偏り分析を実行して massProductionResult を更新する。
   * @param currentTexts  今回生成したプロンプトテキスト
   * @param excludeBatchId 今回のバッチを履歴から除外するためのID
   */
  const runBiasAnalysis = useCallback(
    async (currentTexts: string[], excludeBatchId?: string) => {
      try {
        const allHistory = await getAll();
        const historyEntries: HistoryEntry[] = allHistory
          .filter((i) => !excludeBatchId || i.batchId !== excludeBatchId)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 20)
          .map((i) => ({ text: i.promptText, dateKey: i.dateKey }));
        const result = analyzeBias(currentTexts, historyEntries);
        setMassProductionResult(result);

        // 全履歴分析（重複分析センター用）
        const fullAnalysis = analyzeFullHistory(allHistory.filter(
          (i) => !excludeBatchId || i.batchId !== excludeBatchId
        ), currentTexts);
        setHistoryAnalysis(fullAnalysis);
        return result;
      } catch {
        return null;
      }
    },
    []
  );

  /** API レスポンスの proposals を IndexedDB に保存しつつ state に格納する。 */
  const runGenerate = useCallback(
    async (inputs: PromptInputs) => {
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
        });
        await saveBatch(built);
        setItems(built);

        // 生成後に自動で偏り分析を実行（ノンブロッキング）
        const currentTexts = built.map((i) => i.promptText);
        void runBiasAnalysis(currentTexts, batchId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setItems([]);
      } finally {
        setGenerating(false);
        setArrangeSource(null);
      }
    },
    [imageDataUrl, runBiasAnalysis]
  );

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    void runGenerate(buildInputs());
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

  // ── 🤖 AI分析エージェント：useMemoで現状から提案を再計算 ──
  const agentAnalysis = useMemo(() => analyzeAgent({
    scopes, locks: {
      face: true, body_shape: bodyPoseLock, expression: true, identity: true,
      color: colorMoodLock, camera: compositionLock, aspect_ratio: compositionLock,
    },
    faceLock,
    activeWorldPresets, activeGodModes, activeBoosts, viralMode,
    favoriteProfile, favoriteEnabled: favoriteLearnEnabled,
    historyAnalysis, policyApplied,
    windLevel,
    hasImage: !!imageDataUrl,
  }), [
    scopes, bodyPoseLock, colorMoodLock, compositionLock, faceLock,
    activeWorldPresets, activeGodModes, activeBoosts, viralMode,
    favoriteProfile, favoriteLearnEnabled, historyAnalysis, policyApplied,
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

  // ─── 多様性ツール（生成補助）：ギャップ化・量産回避のトグル選択（最大2コンボ） ─

  const handleAssistToggle = useCallback((mode: "gap" | "anti") => {
    const prev = activeAssistModes;
    let next: string[];
    if (prev.includes(mode)) {
      next = prev.filter((m) => m !== mode);
    } else if (prev.length >= 2) {
      next = [...prev.slice(1), mode];
    } else {
      next = [...prev, mode];
    }
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

    const ASSIST_LABELS: Record<string, string> = { gap: "🎭 ギャップ化", anti: "🧪 量産回避" };
    const labels = next.map((m) => ASSIST_LABELS[m] ?? m);
    const msg = next.length === 1
      ? `${labels[0]} を適用しました`
      : `生成補助コンボ：${labels.join(" × ")}`;
    showPresetToast(msg, APPLY_HINT);
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

  const handleResetAll = useCallback(() => {
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
    setExtraInstructions("");
    setViralMode(false);
    showPresetToast("↺ プリセット設定を全リセットしました");
  }, [showPresetToast]);

  const handleResetGod = useCallback(() => {
    setActiveGodModes([]);
    setActiveBoosts([]);
    setChaosLabel(null);
    setExtraInstructions("");
    showPresetToast("神引きの設定をリセットしました");
  }, [showPresetToast]);

  const handleResetAssist = useCallback(() => {
    setActiveSnsTypes([]);
    setActiveCultureTypes([]);
    setActiveAssistModes([]);
    setViralMode(false);
    setExtraInstructions("");
    showPresetToast("生成補助の設定をリセットしました");
  }, [showPresetToast]);


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

  /** アレンジ案をお気に入りとして履歴へ保存する。 */
  const handleSaveArranged = useCallback(
    async (result: ArrangeResult, proposal: GeneratedProposal) => {
      const batchId = uid();
      const built = buildHistoryItems({
        proposals: [proposal],
        target: "unified",
        batchId,
        inputs: result.inputs,
        thumbnail: result.source.sourceImageThumbnail ?? null,
      });
      const favItems = built.map((i) => ({ ...i, isFavorite: true }));
      await saveBatch(favItems);
      void refreshFavoriteProfile();
    },
    [refreshFavoriteProfile]
  );

  /** 案カードからのお気に入り/評価/メモ変更を反映する。 */
  const handleItemUpdate = useCallback(
    async (id: string, patch: Partial<PromptHistoryItem>) => {
      await updateItemDb(id, patch);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
      // お気に入り状態が変わったらプロファイルを再構築
      if (Object.prototype.hasOwnProperty.call(patch, "isFavorite")) {
        void refreshFavoriteProfile();
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

  return (
    <div className="min-h-screen">
      <main className="w-full px-2 py-2">
        {view === "history" ? (
          <HistoryView
            onBack={() => setView("main")}
            initialFavoritesOnly={historyFavoritesOnly}
            onArrangeInline={handleArrangeInline}
            onSaveArranged={handleSaveArranged}
            onSendToGenerator={handleArrange}
            favoriteProfile={favoriteProfile}
            favoriteLearnEnabled={favoriteLearnEnabled}
          />
        ) : (
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
              assistantSlot={
                <AssistantCharacter agent={agentAnalysis} onAction={handleAgentAction} />
              }
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
                  onBulkLevel={(ids, lv) => {
                    handleBulkLevel(ids, lv);
                    showPresetToast("🎯 出現制御を一括設定しました", "「提案を反映」で生成に効きます。");
                  }}
                  onClearNg={() => {
                    handleClearNg();
                    showPresetToast("完全NGを解除しました", "");
                  }}
                  onAutoAdjust={handleAutoAdjust}
                  onUndoAutoAdjust={handleUndoAutoAdjust}
                  canUndoAuto={levelsUndoStack.length > 0}
                  changedIds={changedIds}
                  comboPolicies={comboPolicies}
                  onComboPolicyChange={handleComboPolicyChange}
                  agent={agentAnalysis}
                  onAgentAction={handleAgentAction}
                  onApplyPolicies={() => {
                    handleApplyPolicies();
                    showPresetToast("✓ 出現制御を反映しました", "次回の生成から効きます。");
                  }}
                  onUnapplyPolicies={() => {
                    handleUnapplyPolicies();
                    showPresetToast("反映を解除しました", "");
                  }}
                  onResetPolicies={() => {
                    handleResetPolicies();
                    showPresetToast("🗑️ 出現制御を全リセット", "全モチーフを許可(4)に戻しました。");
                  }}
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
                  onResetBias={() => {
                    clearRecentGenres();
                    clearRecentSubStyles();
                    setHistoryAnalysis(null);
                    setMassProductionResult(null);
                    showPresetToast("🧹 偏り履歴をクリア", "ジャンル＋サブジャンルの履歴をリセットしました。");
                  }}
                  onDismiss={() => {
                    setMassProductionResult(null);
                    setHistoryAnalysis(null);
                  }}
                />
              )}

              <ControlPanel
                scopes={scopes}
                onScopesChange={setScopes}
                selectionSummary={
                  <SelectionSummary
                    scopes={scopes}
                    onScopeRemove={(s) => setScopes(scopes.filter((v) => v !== s))}
                    activeGodModes={activeGodModes}
                    chaosLabel={chaosLabel}
                    onGodReset={handleResetGod}
                    activeBoosts={activeBoosts}
                    onBoostRemove={handleBoostToggle}
                    activeEffectTypes={activeEffectTypes}
                    onEffectRemove={handleEffectToggle}
                    activeWorldPresets={activeWorldPresets}
                    onWorldRemove={handleWorldPresetToggle}
                    viralMode={viralMode}
                    onViralRemove={handleViralOff}
                    activeSnsLabels={activeSnsTypes.map(getSnsLabel)}
                    activeCultureLabels={activeCultureTypes.map(getCultureLabel)}
                    onAssistReset={handleResetAssist}
                    onScopesReset={() => setScopes([])}
                    onResetAll={() => {
                      handleResetAll();
                      setScopes([]);
                      setActiveBoosts([]);
                      setFavoriteLearnEnabled(false);
                      setZozoApplied(null);
                    }}
                    // ZOZO は「衣装ON かつ反映済み」のときだけチップ表示（実効反映）
                    zozoEffective={
                      zozoApplied && zozoApplied.traits.length > 0 && scopes.includes("outfit")
                        ? (zozoApplied.mode === "priority" ? "priority" : "assist")
                        : "off"
                    }
                    zozoAgeLabel={zozoApplied?.ageLabel}
                    onZozoRemove={() => setZozoApplied(null)}
                  />
                }
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
                dimensionLevel={dimensionLevel}
                textureOriginal={textureOriginal}
                textureDisabled={textureDisabled}
                onStrengthChange={setStrength}
                onGlossChange={setGlossLevel}
                onDimensionChange={setDimensionLevel}
                onTextureOriginalChange={setTextureOriginal}
                onTextureDisabledChange={setTextureDisabled}
                faceLock={faceLock}
                expression={expression}
                onFaceLockChange={setFaceLock}
                onExpressionChange={setExpression}
                bodyPoseLock={bodyPoseLock}
                colorMoodLock={colorMoodLock}
                compositionLock={compositionLock}
                avoidCliche={avoidCliche}
                onBodyPoseLockChange={setBodyPoseLock}
                onColorMoodLockChange={setColorMoodLock}
                onCompositionLockChange={setCompositionLock}
                onAvoidClicheChange={setAvoidCliche}
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

              {/* 設定サマリー */}
              <div className="px-1 space-y-1.5">
                <div className="text-sm text-text-muted flex flex-wrap items-center gap-2">
                  <span className="text-text-base font-semibold">{scopeLabel}</span>
                  <span>/</span>
                  <span>{count}案 ・ 統一プロンプト</span>
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
                />
              </div>

              {error && (
                <section className="card border-rose-500/50 bg-rose-500/10">
                  <h3 className="text-sm font-semibold text-rose-300 mb-1">生成に失敗しました</h3>
                  <p className="text-xs text-rose-200/90 break-all">{error}</p>
                  <p className="text-xs text-text-muted mt-2">
                    `npm run dev:all` でサーバーが起動しているか、`server/.env` のキーが有効か確認してください。
                  </p>
                </section>
              )}

              {hasResults && (
                <section className="space-y-5">
                  <PromptList
                    title="統一プロンプト"
                    subtitle="日本語・項目分け（ChatGPT / Nano Banana 共通。出力先に応じて自動最適化）"
                    items={items}
                    onUpdate={handleItemUpdate}
                    onArrange={handleArrange}
                  />
                </section>
              )}

              <footer className="text-center text-xs text-text-muted py-8">
                画像と設定はローカル（IndexedDB）と localhost:3001 経由でのみ送信。APIキーはブラウザに渡しません。
              </footer>
            </div>
          </div>
        )}
      </main>

      {/* ⭐ お気に入りプロンプト右スライドパネル（fixed） */}
      <FavoritesPanel
        open={favPanelOpen}
        onClose={() => setFavPanelOpen(false)}
        onArrange={handleArrange}
        onUseAsSource={(url) => {
          setImageDataUrl(url);
          setFavPanelOpen(false);
        }}
      />

      {/* 🖌 選択範囲プロンプトモーダル */}
      {selectionModalOpen && imageDataUrl && (
        <SelectionPromptModal
          imageDataUrl={imageDataUrl}
          onClose={() => setSelectionModalOpen(false)}
        />
      )}

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

      {/* ── ✨ フローティングバー（出力先 + 案数 + 生成ボタン） ──────────────── */}
      <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-0 rounded-2xl border border-[#252e44]/90 bg-[#0e1219]/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* 出力先セレクタ */}
        <div className="px-3 py-2.5">
          <PromptTargetSelector value={promptTarget} onChange={setPromptTarget} />
        </div>
        {/* 縦区切り */}
        <div className="w-px self-stretch bg-[#252e44]/80 shrink-0" />
        {/* 案数 */}
        <div className="px-3 py-2.5 flex items-center gap-2 select-none">
          <span className="text-[11px] text-white/40 shrink-0">案数</span>
          <div className="flex gap-1">
            {([2, 3, 4, 5, 6] as Count[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCount(c)}
                className={[
                  "w-7 h-7 rounded-lg text-[12px] font-bold border transition leading-none",
                  count === c
                    ? "border-accent/80 bg-accent/25 text-white shadow-[0_0_8px_rgba(139,92,246,0.45)]"
                    : "border-[#252e44] bg-transparent text-white/45 hover:border-accent/40 hover:text-white/80",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {/* 縦区切り */}
        <div className="w-px self-stretch bg-[#252e44]/80 shrink-0" />
        {/* 生成ボタン */}
        <button
          type="button"
          disabled={!canGenerate || generating}
          onClick={handleGenerate}
          className={[
            "inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-[15px]",
            "transition-all duration-300 select-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            justCompleted
              ? "bg-emerald-500 text-white hover:bg-emerald-400"
              : canGenerate
                ? "bg-accent text-white hover:bg-accent-hover"
                : "bg-transparent text-white/40",
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
              <span className="text-[11px] font-normal opacity-50 ml-0.5 hidden sm:inline">Ctrl+↵</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
