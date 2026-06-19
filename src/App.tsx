import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { MiniExplorer } from "./components/MiniExplorer";
import { ImageSidebar } from "./components/ImageSidebar";
import { PromptList } from "./components/PromptList";
import { DetailsCard } from "./components/DetailsCard";
import { QuickActions } from "./components/QuickActions";
import { ControlPanel } from "./components/ControlPanel";
import { HistoryView } from "./components/HistoryView";
import { RestoredItemBanner } from "./components/main/RestoredItemBanner";
import { PatternPreviewBanner } from "./components/main/PatternPreviewBanner";
import { ArrangeSourceBanner } from "./components/main/ArrangeSourceBanner";
import { GenerationSummary } from "./components/main/GenerationSummary";
import { GenerationProgress } from "./components/GenerationProgress";
import { BackendStatus } from "./components/BackendStatus";
import { NanoBananaWarning } from "./components/main/NanoBananaWarning";
import { GenerationActionBar } from "./components/main/GenerationActionBar";
import { GenerationErrorPanel } from "./components/main/GenerationErrorPanel";
import { BoostArea } from "./components/main/BoostArea";
import { PromptTargetSelector } from "./components/PromptTargetSelector";
import { CompletionToast } from "./components/CompletionToast";
import { PresetAppliedToast } from "./components/PresetAppliedToast";
import { ReflectionStatusBar } from "./components/ReflectionStatusBar";
import { generateViaBackend, analyzePreferencesViaBackend } from "./lib/backendClient";
import { usePersistedSettings } from "./lib/usePersistedSettings";
import { getNotifSettings } from "./lib/notificationSettings";
import { playCompletionSound } from "./lib/completionSound";
import {
  buildArrangeInputs,
  buildCombinedWorldInputs,
  WORLD_PRESET_DISPLAY,
} from "./lib/quickActions";
import { analyzeBias, type BiasAnalysisResult, type HistoryEntry } from "./lib/biasAnalyzer";
import { analyzeFullHistory, filterRecentWindow, type FullHistoryAnalysis } from "./lib/historyAnalyzer";
import { ReferenceImportPanel, REFERENCE_CATEGORIES, referenceLockReason } from "./components/ReferenceImportPanel";
import { CompareModeView } from "./components/CompareModeView";
import {
  loadLevels,
  isApplied,
  getMotifControls,
  loadComboPolicies, getComboControls,
  type LevelMap,
  type ComboPolicyMap,
} from "./lib/motifPolicy";
import {
  loadForbiddenTokens,
  saveForbiddenTokens,
} from "./lib/forbiddenTokens";
import { splitNg } from "./lib/ngPositive";
// MassProductionBanner は DuplicateAnalysisPanel に統合されました。
import type { WorldPreset } from "./components/QuickActions";
import { type VariationMemory, createEmptyMemory, updateMemory } from "./lib/variationEngine";
import {
  buildHistoryItems,
  getAll,
  saveBatch,
  uid,
  updateItem as updateItemDb,
  buildResultImagesPatch,
} from "./lib/history";
import { getRecentGenres, pushRecentGenres } from "./lib/genreHistory";
import { getRecentSubStyles, pushRecentSubStyles } from "./lib/subStyleHistory";
import { runAutoCleanup, getAutoCleanupEnabled } from "./lib/cleanup";
import { makeThumbnail } from "./lib/imageThumb";
import { saveReferenceRecord, type ReferenceRecord } from "./lib/referenceRecords";
import { StorageQuotaError } from "./lib/idb";
import { loadReferenceLearning, type ReferenceLearning } from "./lib/referenceLearning";
import {
  type AppView,
  type Count,
  type PromptHistoryItem,
  type PromptInputs,
  type Scope,
  type ArrangeResult,
  type GeneratedProposal,
} from "./types";
import { DEFAULT_DETAILS } from "./types";
import { computeChangedAxes, arrangeCandidateScopes, buildElementFilterInstruction } from "./lib/arrange";
import { ALL_SCOPE_LABELS } from "./lib/scopeLabels";
import { buildFavoriteProfile, type FavoriteProfile } from "./lib/favoriteProfile";
import { analyzeColors, type ColorAnalysis } from "./lib/colorAnalyzer";
import {
  loadAllFeatures, buildAnalysis as buildImageAnalysis,
  runProgressiveAnalysis, primaryResultImage,
  type ImageAnalysisResult, type ImageFeature,
} from "./lib/imageAnalyzer";
import { analyzeRatings, type RatingAnalysis } from "./lib/ratingAnalyzer";
import {
  buildSkyveilProfile, favoriteToStrength,
  type SkyveilStrength, type SkyveilProfile,
} from "./lib/skyveilProfile";
import { logOperation } from "./lib/operationLog";
import { deriveLockState } from "./lib/promptLockCheck";
import { analyzeIdentityRisk } from "./lib/identityRisk";
import { GlobalProtectionBar } from "./components/GlobalProtectionBar";
import { AnalysisStatusStrip, type AnalysisCategoryView } from "./components/AnalysisStatusStrip";
import { RecoveryPanel } from "./components/RecoveryPanel";
import { useAnalysisLive } from "./lib/useAnalysisLive";
import { useLatestRef } from "./lib/useLatestRef";
import { buildReferenceNoteText } from "./lib/referenceNote";
import { AnalysisLiveView } from "./components/AnalysisLiveView";
import {
  extractSuccessPromptPatterns, type SuccessPromptPattern,
} from "./lib/successPatterns";
import {
  previewSuccessPattern, applyPreviewedScopes, type LearningApplyPreviewResult,
} from "./lib/learningPreview";
import {
  loadPreferenceProfile, savePreferenceProfile, clearPreferenceProfile,
  loadAutoLearn, saveAutoLearn,
  loadAutoLastCount, saveAutoLastCount,
  collectSamples, MIN_SAMPLES,
  AUTO_NEW_SAMPLE_THRESHOLD, AUTO_COOLDOWN_MS, AUTO_DEBOUNCE_MS,
  type PreferenceProfile,
} from "./lib/preferenceProfile";
import {
  loadColorWeights, getColorWeightControls,
  type ColorWeightMap,
} from "./lib/colorPolicy";

// ── 代表ボタン用ランダムピック定数（モジュールレベル） ────────────────────────
// SNS/カルチャープリセットは撤去（重複整理：SNS系はバズボタン・世界観はQuickActionsプリセットに一本化）。

export default function App() {
  // 永続設定（30項目）は usePersistedSettings() に集約（App分割 Phase4a）。
  // 戻り値を「同名で分割代入」して受け取ることで buildInputs / JSX / 各ハンドラは無変更。
  // dimensionLevel は互換のため値のみ（setter なし）。
  const {
    scopes, setScopes,
    moods, setMoods,
    autoMoodCategories, setAutoMoodCategories,
    count, setCount,
    details, setDetails,
    extraInstructions, setExtraInstructions,
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
    favoriteLearnEnabled, setFavoriteLearnEnabled,
    favoriteStrength, setFavoriteStrength,
    zozoApplied, setZozoApplied,
    activeBoosts, setActiveBoosts,
    windLevel, setWindLevel,
  } = usePersistedSettings();

  // per-tag NG（タグ個別NG）：タグのダブルクリックで tagNg をトグル（DetailsCard 側）。tagNg は永続。
  const onToggleTagNg = useCallback((fieldKey: string, value: string) => {
    const key = `${fieldKey}:${value}`;
    setTagNg((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, [setTagNg]);

  // ── B: カメラが変更対象から外れたら 3D カメラ指定(custom3D)を自動解除 ─────────────
  // 3Dピッカーは camera タブ内にしか無く、custom3D は camera ∈ scopes のときだけ本文へ反映される。
  // camera を変更対象から外すと custom3D は画面から消えたまま残留し、再選択時にボタン指定を
  // 上書きする「見えない支配」になり得る。invariant「custom3D は camera が変更対象のときだけ存在」を
  // 全経路（手動解除 / 全リセット / 履歴復元 / アレンジ）で強制する。
  useEffect(() => {
    if (!scopes.includes("camera") && details.camera.custom3D) {
      setDetails((d) => ({ ...d, camera: { ...d.camera, custom3D: null } }));
    }
  }, [scopes, details.camera.custom3D]);

  const [view, setView] = useState<AppView>("main");
  const [historyFavoritesOnly, setHistoryFavoritesOnly] = useState(false);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  // 🌆 背景を2D/非写実に（既定ON・avoidRealBackgroundBlock）は usePersistedSettings へ移管し永続化（上の分割代入で受領）。
  /** アクティブな世界観プリセット（マルチセレクト、最大3） */
  const [activeWorldPresets, setActiveWorldPresets] = useState<WorldPreset[]>([]);
  /** 世界観プリセット由来の指示文（extraInstructions と分離して管理） */
  const [worldCombinedNote, setWorldCombinedNote] = useState("");
  /** 参照画像から「適用」した軸タグ付き自由文（catKey → text）。生成時に extraInstructions へ統合。
   *  ※ 詳細 enum には自動反映しない（docs/23）。worldCombinedNote と同じ追加マージ方式。 */
  const [referenceNote, setReferenceNote] = useState<Record<string, string>>({});
  /** referenceNote を「【参照画像から強制適用】」独立ブロックに整形（生成時に extraInstructions へ統合）。
   *  生成ロジック本体は不変。参照要素を最優先で反映させるため、強い宣言付きブロックにする。 */
  const referenceNoteText = useMemo(
    () => buildReferenceNoteText(referenceNote, REFERENCE_CATEGORIES),
    [referenceNote],
  );
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
  const referenceNoteRef = useLatestRef(referenceNote);
  /** 📌 現在の参照画像＋抽出を「Reference Picker履歴」へ手動保存（生成しなくても残す）。
   *  生成時の自動保存（下記 runGenerate 内）と同じデータ源（referenceContextRef＝画像+抽出 /
   *  referenceNote＝適用）を使う追加経路。kind:"picker" / batchId:"" で記録（生成バッチ無し）。
   *  抽出・適用・生成ロジックには一切影響しない。保存できたら true。 */
  const handleSaveReferenceToHistory = useCallback(async (): Promise<boolean> => {
    try {
      const refCtx = referenceContextRef.current;
      if (!refCtx?.image) return false;
      const refThumb = await makeThumbnail(refCtx.image);
      const id = await saveReferenceRecord({
        refThumb,
        extracted: refCtx.extracted,
        applied: referenceNoteRef.current ?? {},
        batchId: "",
        kind: "picker",
      });
      return id != null;
    } catch {
      return false;
    }
  }, [referenceNoteRef]);
  /** Compare Mode（参照↔生成 比較ビュー）の開閉。Reference Picker の「🆚 比較」から開く。 */
  const [compareOpen, setCompareOpen] = useState(false);
  /** ♻ 🕘履歴からの「再利用」：選んだ参照レコードの 参照画像（サムネ）＋抽出13カテゴリを
   *  ピッカーへ流し込むための seed。token を変えるたびにピッカー側 effect が再発火（同一レコードの
   *  再利用も拾う）。適用はユーザーが従来どおり押す＝適用ロジックには一切触れない。 */
  const referenceReuseTokenRef = useRef(0);
  const [referenceReuseSeed, setReferenceReuseSeed] =
    useState<{ image: string; extracted: Record<string, string>; token: number } | null>(null);
  const handleReuseReference = useCallback((rec: ReferenceRecord) => {
    referenceReuseTokenRef.current += 1;
    setReferenceReuseSeed({ image: rec.refThumb, extracted: { ...rec.extracted }, token: referenceReuseTokenRef.current });
    setCompareOpen(false); // 履歴を閉じてメインのピッカーへ戻す
    setView("main");       // ピッカーは main view でのみ描画されるため確実に main へ
  }, []);
  /** ♻ ピッカーが seed を流し込み終えたら null に戻す（再マウント時の二重注入防止）。 */
  const handleReuseConsumed = useCallback(() => setReferenceReuseSeed(null), []);
  // 分析ラボ（孤立入口）は撤去（#4）。詳細探索は分析センターの重複分析/🔭発見タブに集約。
  // 🧹 分析センター（DuplicateAnalysisPanel）撤去（タスクB・案X）：開閉 state・無視候補語 state は廃止。
  /** Phase D: Compare評価(referenceRecords)を集計した好み素材。マウント＋Compareクローズ（評価後）に再読込。 */
  const [referenceLearning, setReferenceLearning] = useState<ReferenceLearning | null>(null);
  useEffect(() => {
    if (!compareOpen) void loadReferenceLearning().then(setReferenceLearning);
  }, [compareOpen]);
  /** スコープボタンのフラッシュアニメーション用キー（インクリメントで発火） */
  const [scopeFlashKey, setScopeFlashKey] = useState(0);
  /** 多様性エンジン：直近の背景/衣装/ムード/前景エフェクトを記憶して連発を防ぐ */
  const [variationMemory, setVariationMemory] = useState<VariationMemory>(createEmptyMemory);
  // 時代軸（era）は完全撤去（dead code整理・生成にも不使用だった）。
  const [favoriteProfile, setFavoriteProfile] = useState<FavoriteProfile | null>(null);
  // skyveil好みAI：ON/OFF と強度は既存の favoriteLearnEnabled / favoriteStrength を流用（単一の真実）。
  // oneShot は「今回だけ反映」用の一時フラグ（生成後にクリア）。
  const [skyveilOneShot, setSkyveilOneShot] = useState<boolean>(false);
  /** 禁止トークン（意味ベースで類語展開してプロンプトから除外） */
  const [forbiddenTokens, setForbiddenTokens] = useState<string[]>(() => loadForbiddenTokens());
  /** カオス神引きのラベル（直前の融合結果表示） */
  const [chaosLabel, setChaosLabel] = useState<string | null>(null);
  /** アクティブな神引きモード配列（最大2コンボ。solo: normal/chaos/composition、combo: outfit/bg/color/world_god/props/bigobject/myth/movie） */
  const [activeGodModes,    setActiveGodModes]    = useState<string[]>([]);
  // handleBoostToggle（被り回避/映え補正/顔映え/世界観を一新のUIトグル）は撤去。
  // boost の state 操作は分析センター handleAgentAction が直接 setActiveBoosts で行うため state/setter は温存。
  // SNS/カルチャー state は撤去（重複整理。mood ID は VIRAL_MOOD_POOL 等で存続）。
  /** 量産AI / 偏り分析結果（バナー表示用） */
  // 🧹 偏り分析結果は runBiasAnalysis（生成後 自動実行）が更新するが、表示は分析センター撤去で廃止。setter のみ温存。
  const [, setMassProductionResult] = useState<BiasAnalysisResult | null>(null);
  /** 全履歴分析結果（重複分析センター用） */
  const [historyAnalysis, setHistoryAnalysis] = useState<FullHistoryAnalysis | null>(null);
  /** 履歴の生アイテム（色分析の入力）。historyAnalysis と同期して更新される */
  const [historyItemsForColor, setHistoryItemsForColor] = useState<PromptHistoryItem[]>([]);
  /** 画像特徴キャッシュ（itemId → ImageFeature） */
  const [imageFeatureMap, setImageFeatureMap] = useState<Map<string, ImageFeature>>(new Map());
  /** 画像分析の進捗 */
  // 🧹 進捗表示は分析センター撤去で廃止。setter は自動画像解析（startImageAnalysis）が使うため温存。
  const [, setImageAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  const imageAnalyzeAbortRef = useRef<AbortController | null>(null);
  /** モチーフ出現制御レベル（行ごとの 0〜5。永続化） */
  const [levels] = useState<LevelMap>(() => loadLevels());
  /** 頻出構成（コンボ）ポリシー：comboKey → block/alt/allow。永続化 */
  const [comboPolicies] = useState<ComboPolicyMap>(() => loadComboPolicies());
  /** 色×軸 重み：colorId → { hair, outfit, background }（各 0-5）。永続化 */
  const [colorWeights] = useState<ColorWeightMap>(() => loadColorWeights());
  // 🧹 色重みのエディタ系（変更/リセット/自動調整Undo/ハイライト）は分析センター撤去で廃止。colorWeights 本体は温存。
  /** 色分析の対象ウィンドウ（50件・colorAnalysis が使用） */
  const [colorWindowSize] = useState<50 | 100>(50);
  /** 反映状態（true = 生成ロジックへ実際に流す）。永続化 */
  // 🧹 反映状態（policyApplied）は永続値を読むのみ（トグル UI は分析センター撤去で廃止）。buildInputs では引き続き使用。
  const [policyApplied] = useState<boolean>(() => isApplied());

  // 🧹 出現制御／反映トグル／全リセット等のエディタ系ハンドラは分析センター撤去（タスクB・案X）で廃止。
  //    levels / comboPolicies の永続値と buildInputs での使用は温存（既存設定は引き続き生成に効く）。
  /** ファッションプリセット適用トースト */
  const [presetToastTrigger, setPresetToastTrigger] = useState(0);
  const [presetToastMsg,     setPresetToastMsg]     = useState("");
  const [presetToastHint,    setPresetToastHint]    = useState("");
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  /** 最後に正常生成できた items のバックアップ。
   *  履歴/お気に入り画面から戻った時に items が空でも復元できるようにする。 */
  const lastItemsRef = useRef<PromptHistoryItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
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
  /** ⑤ 生成完了後1.5秒だけ true → ボタンを「✅ 完了！」表示 */
  const [justCompleted, setJustCompleted] = useState(false);
  /** ③ インクリメントするたびトーストを1回表示 */
  const [toastTrigger, setToastTrigger] = useState(0);
  const [cleanupToastTrigger, setCleanupToastTrigger] = useState(0);
  const [cleanupToastMsg,     setCleanupToastMsg]     = useState("");
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
  /** 🤖 AI分析ライブビュー */
  const analysisLive = useAnalysisLive();
  /** runGenerate 内で items の最新値を読むためのリファレンス */
  const itemsRef = useLatestRef(items);
  /** pendingRun の保証発火のためのカウンター（scopes/moods が変わらない場合の保険） */
  const [pendingRunKey, setPendingRunKey] = useState(0);
  const canGenerate = scopes.length > 0;

  // 起動時に自動クリーンアップを実行（設定が ON の場合のみ）
  useEffect(() => {
    if (getAutoCleanupEnabled()) {
      void runAutoCleanup().then((n) => {
        if (n > 0) {
          setCleanupToastMsg(`${n}件の履歴を整理しました`);
          setCleanupToastTrigger((c) => c + 1);
        }
      });
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
  // dataVersion を key に渡して HistoryView を再マウント＝IDB を再 getAll させる（リロードなし・非破壊）。
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const reloadAllData = useCallback(() => {
    setDataVersion((v) => v + 1);   // HistoryView を再マウント → 再 getAll
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
      // 復旧・再読込時に重複分析センターの集計も同期（従来は色用 items のみ更新で分析が古いままだった）
      if (all.length > 0) setHistoryAnalysis(analyzeFullHistory(all, []));
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

  // 永続設定の保存 / 別タブ storage 同期 / アスペクト比自動記憶 effect は
  // usePersistedSettings() へ集約（App分割 Phase4b）。

  // stale closure 回避（BUG-1）：preferenceProfile / ratingAnalysis / imageAnalysis は
  // buildInputs より後で宣言されるため依存配列に入れられない（TDZ）。
  // skyveilProfileRef と同じく ref 経由で「最新値」を参照する（生成時には effect 同期済み）。
  const preferenceProfileRef = useRef<PreferenceProfile | null>(null);
  const ratingAnalysisRef = useRef<RatingAnalysis | null>(null);
  const imageAnalysisRef = useRef<ImageAnalysisResult | null>(null);

  // 🧬 skyveil「あなたの好み」撤去（A・Tier-1c）：方向性タグ skyveilFavoriteTraits は廃止（生成へ送らない）。

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
      // worldCombinedNote（世界観プリセット由来）・referenceNote（参照画像から適用）・追加指示
      // ＋ NG肯定誘導（splitNg：否定NG語を肯定方向の誘導文へ変換・GPT Image対策）を結合。出現制御は motifControls で別途。
      extraInstructions: [worldCombinedNote, referenceNoteText, extraInstructions, splitNg(ngList, forbiddenTokens).positiveGuidance].filter(Boolean).join("\n\n"),
      faceLock,
      expression: faceLock ? undefined : (expression ?? undefined),
      // 出力の【NG】にはユーザー明示NG（NG欄＋禁止モチーフ）のうち「肯定変換できなかった語」のみを載せる。
      // splitNg：対応表該当語は肯定誘導(extraInstructions)へ回し、残りを【NG】否定形へ／禁止モチーフは英語類語展開。
      // モチーフlv0・禁止色(weight=0)・頻出構成block は motifControls / colorWeights / comboControls の別経路（ngList非合流）。
      ngList: splitNg(ngList, forbiddenTokens).ngForBlock,
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
      // 🧬 skyveil「あなたの好み」撤去（A・Tier-1c）：生成への反映を恒久停止（undefined＝サーバ無注入）。
      preferenceProfile: undefined,
      // 🧬 skyveil撤去（A・Tier-1c）：評価バイアス（👍/👎 学習）の反映も恒久停止。
      ratingBias: undefined,
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
      avoidRealBackground,
      colorStrategy: colorStrategy ?? undefined,
      artStyle: artStyle ?? undefined,
      // 🧬 skyveil撤去（A・Tier-1c）：お気に入り傾向の方向性注入も恒久停止。
      favoriteTraits: undefined,
      favoriteStrength: undefined,
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
      avoidRealBackground,
      colorStrategy,
      artStyle,
      faceLock,
      expression,
      favoriteLearnEnabled,
      favoriteProfile,
      favoriteStrength,
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
      if (generatingRef.current) return;
      generatingRef.current = true;
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
        const result = await generateViaBackend(inputs, imageDataUrl, recentGenres, recentSubStyles, ngList, forbiddenTokens, tagNg);
        if (result.retried) {
          setPresetToastMsg("再試行しました（1回目は失敗しましたが成功しました）");
          setPresetToastHint("");
          setPresetToastTrigger((n) => n + 1);
        }
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
        if (err instanceof StorageQuotaError) {
          setPresetToastMsg("ストレージが不足しています。履歴の整理または書き出しをしてください");
          setPresetToastHint("");
          setPresetToastTrigger((n) => n + 1);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
        // エラー時は items をクリアしない：以前の生成結果を維持する。
        // （古い結果が残っていてもユーザーはエラーバナーで把握できる）
      } finally {
        generatingRef.current = false;
        setGenerating(false);
        setArrangeSource(null);
      }
    },
    [imageDataUrl, runBiasAnalysis, ngList, forbiddenTokens, tagNg]
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
    setPresetToastMsg(msg);
    setPresetToastHint(hint ?? "");
    setPresetToastTrigger((n) => n + 1);
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

  // 🧹 色成功率分析・評価集計強化・成功/失敗ランキングは分析センター撤去（タスクB・案X）で廃止（表示専用だった）。

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

  // 🧹 発見層（候補語抽出/無視）・分析対象サマリは分析センター撤去（タスクB・案X）で廃止。

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

  // 🧹 AI分析エージェント（agentAnalysis）と提案アクションは分析センター撤去（タスクB・案X）で廃止。

  // 🧹 出現制御の自動調整・一括設定・反映/解除・偏り履歴クリア等の分析センター用ハンドラは
  //    タスクB・案X で廃止（UI 撤去）。levels/comboPolicies/policyApplied の永続値と buildInputs 使用は温存。

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

  // 🧹 色重みの自動調整／Undo、AI分析エージェントの提案アクション（handleAgentAction）は
  //    分析センター撤去（タスクB・案X）で廃止。colorWeights 本体と buildInputs 使用は温存。

  // handleRandom（🎲おまかせ）・handleVariant（🔄別案）の UI トグルは撤去。

  // 👑 神引き（handleGodToggle）の UI トグルは撤去（神引き完全撤去）。
  // god の state 操作は分析センター handleAgentAction が直接 setActiveGodModes で行うため state/setter は温存。

  // ─── 世界観プリセット：トグル選択（最大3コンボ）────────────────────────────────

  const handleWorldPresetToggle = useCallback((preset: WorldPreset, additive = false) => {
    const prev = activeWorldPresets;
    let next: WorldPreset[];
    if (additive) {
      // Shift+クリック＝コンボ追加（従来の累積動作・最大3件 FIFO）
      if (prev.includes(preset)) {
        // 選択済み → 解除
        next = prev.filter((p) => p !== preset);
      } else if (prev.length >= 3) {
        // 最大3件：最古を落として追加
        next = [...prev.slice(1), preset];
      } else {
        next = [...prev, preset];
      }
    } else {
      // 通常クリック＝単一トグル：このプリセットだけ選択（既存はクリア）。
      // 同じプリセットが単独で選択中なら解除（→空）。
      next = prev.length === 1 && prev[0] === preset ? [] : [preset];
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

  // ─── 多様性ツール（生成補助）：ギャップ化のトグル選択（単一） ─
  // handleAssistToggle（🎭雰囲気を逆に）の UI トグルは撤去。
  // assist の state（activeAssistModes）は生成送信・復元のため温存。

  // SNSバズ・カルチャーのハンドラ群（handleSns/handleCulture/handleSnsSingle/handleCultureSingle）は撤去。
  // 重複整理：SNS系はバズボタン（viralMode）・世界観はQuickActionsプリセットに一本化。
  // ※カルチャーの hint/bgPlace ワンショット注入（見えない支配）もこれで消滅。


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
    setChaosLabel(null);
    setMoods([]);
    setAutoMoodCategories([]);
    setExtraInstructions("");
    setNgList("");
    setViralMode(false);
    setAvoidCliche(false);
    setAvoidRealBackground(true);
    // ── 詳細設定 ───────────────────────────────────────────────────────────────
    setDetails(DEFAULT_DETAILS);
    // ── 好み反映 ───────────────────────────────────────────────────────────────
    setZozoApplied(null);
    setFavoriteLearnEnabled(false);
    setSkyveilOneShot(false);
    // ── 見た目 / 質感 ──────────────────────────────────────────────────────────
    setRealismLevel(3);  // 既定Lv3＝2.5D（元画像の実写質感をそのまま維持）
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

  // 🧹 AIっぽさチェック（手動 runBiasAnalysis トリガー）は分析センター撤去（タスクB・案X）で廃止。
  //    runBiasAnalysis は生成後に自動実行され続ける（historyAnalysis 等の更新は維持）。

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
      }

      // 確認バナー表示用
      setRestoredItem(item);
    },
    [setView, setScopes, setMoods, setDetails, setFaceLock,
     setNgList, setViralMode, setExtraInstructions, setBodyPoseLock, setColorMoodLock,
     setCompositionLock, setRealismLevel, setRealismType, setGlossLevel,
     setTextureOriginal, setTextureDisabled, setPromptTarget, setImageDataUrl,
     setWindLevel, setZozoApplied, setActiveBoosts, setColorStrategy, setArtStyle]
  );

  /**
   * ✨ インライン・アレンジ：履歴画面を離れずにその場で生成し結果を返す。
   * 元プロンプトの保護ルール（faceLock / locks / 変更範囲）を尊重する。
   */
  const handleArrangeInline = useCallback(
    async (sourceItem: PromptHistoryItem, selectedScopes?: Scope[], count?: Count): Promise<ArrangeResult | null> => {
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
        // アレンジ専用の生成枚数（パネルの枚数セレクタ）。未指定なら従来どおり base.count（メイン案数）。
        count: count ?? base.count,
        faceLock: sourceItem.faceLock,
        locks: sourceItem.locks ?? base.locks,
        expression: sourceItem.faceLock ? undefined : base.expression,
        extraInstructions: [base.extraInstructions, filterNote].filter(Boolean).join("\n\n"),
      };
      try {
        const recentGenres    = getRecentGenres();
        const recentSubStyles = getRecentSubStyles();
        const res = await generateViaBackend(arrangeInputs, imageDataUrl, recentGenres, recentSubStyles, ngList, forbiddenTokens, tagNg);
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
    [buildInputs, imageDataUrl, showPresetToast, ngList, forbiddenTokens, tagNg]
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

  const scopeLabel = useMemo(
    () => scopes.map((s) => ALL_SCOPE_LABELS[s]).join(" + ") || "—",
    [scopes]
  );

  // P4: 出力先ラベル（表示のみ。promptTarget は安全フィルタモードで生成ロジックは不変）
  const outputTargetLabel = useMemo(() => {
    switch (promptTarget) {
      case "chatgpt_safe": return "ChatGPT";
      case "gemini_safe":  return "Gemini";
      case "nano_safe":    return "Nano Banana";
      default:             return "両対応";
    }
  }, [promptTarget]);

  // 🛡 生成エラー時の「安全寄りに自動修正して再試行」。複数の刺激要因を一度に外し、
  // 調整済みの inputs を override で直接組み立てて再生成する（state 非同期問題を回避）。
  // 表示は GenerationErrorPanel、ロジックはここ（App）に保持し onSafeRetry で渡す。
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
            recoverySlot={
              <div className="space-y-2">
                {/* 🛟 履歴・お気に入り復旧：左メニューから移設（誤操作防止）。機能は RecoveryPanel のまま不変。 */}
                <button
                  type="button"
                  onClick={() => setRecoveryOpen((v) => !v)}
                  title="IndexedDB に残っている履歴・お気に入りを確認・再読み込み・書き出し/読み込み"
                  className="w-full rounded-xl px-3 py-2 text-[12px] font-semibold border border-amber-400/30 bg-amber-400/5 text-amber-200/90 hover:bg-amber-400/12 hover:border-amber-400/60 transition flex items-center gap-2"
                >
                  <span>🛟</span>
                  <span>履歴・お気に入り復旧</span>
                  <span className="ml-auto opacity-60">{recoveryOpen ? "▲" : "▼"}</span>
                </button>
                {recoveryOpen && (
                  <RecoveryPanel onReloadAll={reloadAllData} onClose={() => setRecoveryOpen(false)} />
                )}
              </div>
            }
            onArrangeInline={handleArrangeInline}
            onSaveArranged={handleSaveArranged}
            onSendToGenerator={handleArrange}
            onRestore={handleRestoreFromHistory}
            favoriteProfile={favoriteProfile}
            favoriteLearnEnabled={favoriteLearnEnabled}
            // 「見えない支配」可視化：アレンジ画面（ArrangePreviewPanel）にも反映状態バッジを出す。
            // メイン ReflectionStatusBar（下記）と同じライブ state・同じ解除関数を使い回す。
            avoidRealBackground={avoidRealBackground}
            worldCombinedNote={worldCombinedNote}
            referenceNoteText={referenceNoteText}
            onClearAvoidRealBg={() => setAvoidRealBackground(false)}
            onClearWorld={() => { setActiveWorldPresets([]); setWorldCombinedNote(""); }}
            onClearReference={() => setReferenceNote({})}
            tagNg={tagNg}
            onClearTagNg={() => setTagNg([])}
            onToast={showPresetToast}
          />
        ) : (
          <>
          {/* 🛡🤖 保護状態＋AI分析を1段に統合した常時表示バー（P4・案B / sticky・読み取り専用） */}
          <GlobalProtectionBar
            faceLock={faceLock}
            risk={liveIdentityRisk}
            analysisSummary={
              <div className="flex items-center gap-2 flex-wrap">
                <AnalysisStatusStrip
                  variant="summary"
                  live={analysisLive.state}
                  categories={analysisCategories}
                />
                {/* 🧹 分析センター（DuplicateAnalysisPanel）は撤去（タスクB・案X）。入口ボタンも撤去。 */}
                {/* 🟢 Gemini 接続状態（health ポーリング・8b7bfa2 で落ちた最終配線を復旧） */}
                <BackendStatus prominent />
              </div>
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
                <GenerationActionBar
                  count={count}
                  onCountChange={setCount}
                  canGenerate={canGenerate}
                  generating={generating}
                  justCompleted={justCompleted}
                  onGenerate={handleGenerate}
                />
              </>
            }
            progressSlot={
              <GenerationProgress
                generating={generating}
                count={count}
                onComplete={handleGenerationComplete}
                size="lg"
                info={`${outputTargetLabel}向け / 統一プロンプト`}
              />
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
              onShowReferenceHistory={() => setCompareOpen(true)}
              onToggleExplorer={() => setExplorerOpen((v) => !v)}
              explorerOpen={explorerOpen}
            />

            <div className="space-y-5 mt-5 lg:mt-0 min-w-0 pb-24">

              {/* 🔁 復元確認バナー：「同じ構成で再生成」後に表示 */}
              {restoredItem && (
                <RestoredItemBanner
                  item={restoredItem}
                  canGenerate={canGenerate}
                  generating={generating}
                  onGenerate={() => {
                    const inputs = buildInputs();
                    setRestoredItem(null);
                    void runGenerate(inputs);
                  }}
                  onClose={() => setRestoredItem(null)}
                />
              )}

              {/* 🏆 学習反映差分プレビュー（成功パターン）：反映前に必ず差分確認 */}
              {patternPreview && (
                <PatternPreviewBanner
                  pattern={patternPreview.pattern}
                  preview={patternPreview.preview}
                  onConfirm={handleConfirmPattern}
                  onCancel={() => setPatternPreview(null)}
                />
              )}

              {/* 📡 現在の反映状態バー：今プロンプトに効く設定を一目で（読み取り専用） */}
              <ReflectionStatusBar
                scopes={scopes}
                activeGodModes={activeGodModes}
                chaosLabel={chaosLabel}
                activeBoosts={activeBoosts}
                activeWorldPresets={activeWorldPresets}
                onResetAll={handleResetAll}
                worldCombinedNote={worldCombinedNote}
                referenceNoteText={referenceNoteText}
                onClearWorld={() => { setActiveWorldPresets([]); setWorldCombinedNote(""); }}
                onClearReference={() => setReferenceNote({})}
                avoidRealBackground={avoidRealBackground}
                onClearAvoidRealBg={() => setAvoidRealBackground(false)}
                tagNg={tagNg}
                onClearTagNg={() => setTagNg([])}
              />


              {/* 🧬 skyveil好みAI はメインから撤去し、分析センターの専用タブへ集約（docs/32 §5.6） */}

              <QuickActions
                canUndo={undoStack.length > 0}
                disabled={generating}
                activeWorldPresets={activeWorldPresets}
                onUndo={handleUndo}
                onWorldPresetToggle={handleWorldPresetToggle}
                avoidCliche={avoidCliche}
                onAvoidClicheChange={setAvoidCliche}
                avoidRealBackground={avoidRealBackground}
                onAvoidRealBackgroundChange={setAvoidRealBackground}
              />

              {/* 🧹 分析センター（DuplicateAnalysisPanel）は撤去（タスクB・案X）。
                  UI のみ撤去で buildInputs は無改変＝生成は完全に不変（motif/combo/color/image/rating の
                  反映ゲートと localStorage の levels/comboPolicies/colorWeights/policyApplied は温存）。
                  お気に入り・履歴・学習データには一切触れない。 */}

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
                  <BoostArea
                    favoriteLearnEnabled={favoriteLearnEnabled}
                    skyveilStrength={skyveilStrength}
                    skyveilProfile={skyveilProfile}
                    analyzingProfile={analyzingProfile}
                    profileSampleCount={profileSampleCount}
                    skyveilOneShot={skyveilOneShot}
                    profileError={profileError}
                    autoLearnEnabled={autoLearnEnabled}
                    successPatterns={successPatterns}
                    setFavoriteLearnEnabled={setFavoriteLearnEnabled}
                    setSkyveilOneShot={setSkyveilOneShot}
                    setFavoriteStrength={setFavoriteStrength}
                    onUpdateAnalysis={() => { void handleRunPreferenceAnalysis(false); }}
                    onToggleAutoLearn={handleToggleAutoLearn}
                    onClearProfile={handleClearPreferenceProfile}
                    onApplyPattern={handleApplyPattern}
                    scopes={scopes}
                    activeGodModes={activeGodModes}
                    activeWorldPresets={activeWorldPresets}
                    zozoApplied={zozoApplied}
                    windLevel={windLevel}
                    setZozoApplied={setZozoApplied}
                    setWindLevel={setWindLevel}
                    showPresetToast={showPresetToast}
                    details={details}
                    onOutfitField={(field, id) =>
                      setDetails((d) => ({ ...d, outfit: { ...d.outfit, [field]: id } as typeof d.outfit }))
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
                colorStrategy={colorStrategy}
                artStyle={artStyle}
                onColorStrategyChange={setColorStrategy}
                onArtStyleChange={setArtStyle}
                extraInstructions={extraInstructions}
                onExtraInstructionsChange={setExtraInstructions}
                ngList={ngList}
                onNgListChange={setNgList}
                forbiddenTokens={forbiddenTokens}
                onForbiddenTokensChange={setForbiddenTokens}
                tagNg={tagNg}
                onToggleTagNg={onToggleTagNg}
              />


              {/* ✨ アレンジ元プロンプト表示バナー */}
              {arrangeSource && (
                <ArrangeSourceBanner source={arrangeSource} onClear={() => setArrangeSource(null)} />
              )}

              {/* 設定サマリー（P4：出力先ラベルを追加・表示のみ） */}
              <GenerationSummary
                scopeLabel={scopeLabel}
                count={count}
                outputTargetLabel={outputTargetLabel}
                viralMode={viralMode}
              />

              {error && (
                <GenerationErrorPanel error={error} onSafeRetry={handleSafeRetry} />
              )}

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
          onSaveToHistory={handleSaveReferenceToHistory}
          reuseSeed={referenceReuseSeed}
          onReuseConsumed={handleReuseConsumed}
        />
      )}

      {/* 🆚 Compare Mode（参照↔生成 比較・全幅ビュー） */}
      <CompareModeView open={compareOpen} onClose={() => setCompareOpen(false)} onReuse={handleReuseReference} />

      {/* 🔬 分析ラボは撤去（#4・孤立入口）。詳細探索は分析センターの重複分析/🔭発見タブへ集約。 */}

      {/* ③ 生成完了トースト（右上・3秒） */}
      <CompletionToast trigger={toastTrigger} count={count} />

      {/* ✨ プリセット適用トースト（上部中央・2.8秒） */}
      <PresetAppliedToast trigger={presetToastTrigger} message={presetToastMsg} hint={presetToastHint} />

      {/* 🗂 自動クリーンアップ完了トースト */}
      <PresetAppliedToast trigger={cleanupToastTrigger} message={cleanupToastMsg} />

      {/* Nano Banana 軽量化おすすめ警告（変更項目が多い時のみ） */}
      {promptTarget === "nano_safe" && scopes.length >= 4 && (
        <NanoBananaWarning scopeCount={scopes.length} />
      )}

      {/* ✨ 生成操作（出力先 / 案数 / プロンプト生成）は上部ヘッダー（GlobalProtectionBar の actions スロット）へ移設。
          下部固定バーは廃止し作業領域を広く確保。生成ロジック・Ctrl+Enter（グローバル keydown）は不変。 */}
    </div>
  );
}
