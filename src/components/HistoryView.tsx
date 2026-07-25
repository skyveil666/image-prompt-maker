import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ArrangeResult, Count, GeneratedProposal, PromptHistoryItem, Scope } from "../types";
import { detectSourceScopes } from "../lib/arrange";
import { deleteItem, getAll, getByDate, updateItem } from "../lib/history";
import { CalendarView } from "./CalendarView";
import { HistoryItemRow } from "./HistoryItemRow";
import { ArrangePreviewPanel } from "./ArrangePreviewPanel";
import { HistoryMiniExplorer } from "./HistoryMiniExplorer";
import type { FavoriteProfile } from "../lib/favoriteProfile";
import type { MemoBadge } from "../lib/axisMemoNote";
import type { BgPreset, ArtPreset } from "../lib/quickActions";
import {
  runAutoCleanup,
  getAutoCleanupEnabled,
  setAutoCleanupEnabled,
  RETENTION_DAYS,
} from "../lib/cleanup";
import { exportBackup, importBackup, type ImportResult } from "../lib/backup";
import { MAX_RECENT } from "../lib/recentImages";

// 左サイドバー整理（hide-not-delete）：お気に入り分析カードとフィルタ/追加条件を UI 非表示にする。
//   表示だけ隠し、state(filter/extraFilters/analysisOpen)・型/ラベル(FilterMode/ExtraFilter/FILTER_LABELS)・
//   filtered useMemo・props(favoriteProfile) は dormant 据え置き＝全件表示で閲覧成立。傾向反映の機能run
//   （App 側: buildFavoriteProfile / buildInputs 注入 / BoostArea トグル）は完全に無傷（GPB同型）。
//   ★検索バー・データ管理（export/import/自動削除/保持期間）は hide しない（残す）。
const SHOW_FAV_ANALYSIS = false;
const SHOW_HISTORY_FILTERS = false;

interface Props {
  onBack: () => void;
  initialFavoritesOnly?: boolean;
  /** その場でアレンジ生成し結果を返す（選択した要素のみ使用）。 */
  onArrangeInline?: (item: PromptHistoryItem, scopes: Scope[], count?: Count) => Promise<ArrangeResult | null>;
  /** アレンジ案をお気に入りとして履歴に保存する（生成画像・評価を含む）。 */
  onSaveArranged?: (result: ArrangeResult, proposal: GeneratedProposal, localState?: import("./ArrangePreviewPanel").ProposalLocalState) => Promise<void> | void;
  /** アレンジ元の設定を生成画面へ送る（メイン画面に遷移）。 */
  onSendToGenerator?: (item: PromptHistoryItem) => void;
  /** 同じ構成で再生成：全設定をメイン画面に復元する。 */
  onRestore?: (item: PromptHistoryItem) => void;
  /** お気に入り学習プロファイル（分析カード表示用）。 */
  favoriteProfile?: FavoriteProfile | null;
  /** お気に入り学習が現在ONか（「反映中」表示用）。 */
  favoriteLearnEnabled?: boolean;
  /** 🛟 履歴・お気に入り復旧（左メニューから移設・左レール最下部に表示）。App 側で構築した RecoveryPanel を渡す。 */
  recoverySlot?: ReactNode;

  // ── 「見えない支配」可視化（App のライブ state を ArrangePreviewPanel へ透過）──
  // アレンジは handleArrangeInline 内で buildInputs() を {...current} 取り込みするため、
  // これらの値がそのままアレンジ全案に効く。鉄則（全案に効く設定は可視化＋解除）の穴を塞ぐ。
  /** 🌆 背景を2D/非写実に（既定ON・非永続）。 */
  avoidRealBackground?: boolean;
  /** 世界観プリセット由来の追加指示（全案へ注入）。 */
  worldCombinedNote?:   string;
  /** 参照画像から適用した強制ブロック（全案へ注入）。 */
  referenceNoteText?:   string;
  /** 背景2D化の解除。 */
  onClearAvoidRealBg?:  () => void;
  /** 世界観の解除。 */
  onClearWorld?:        () => void;
  /** 🌌 アクティブな斬新背景プリセットID。ArrangePreviewPanel へ中継（commit3：bg×art融合バッジの判定に使用）。 */
  activeBgPresets?:     BgPreset[];
  /** 🌌 斬新背景プリセット由来の追加指示（背景スコープ時のみ全案へ注入）。ArrangePreviewPanel へ中継。 */
  bgPresetNote?:        string;
  /** 斬新背景の解除（soft）。ArrangePreviewPanel へ中継。 */
  onClearBg?:           () => void;
  /** 🖌 アクティブな画法世界プリセットID。ArrangePreviewPanel へ中継（commit3：bg×art融合バッジの判定に使用）。 */
  activeArtPresets?:    ArtPreset[];
  /** 🖌 画法世界プリセット由来の追加指示（背景スコープ時のみ全案へ注入）。ArrangePreviewPanel へ中継。 */
  artPresetNote?:       string;
  /** 画法世界の解除（soft）。ArrangePreviewPanel へ中継。 */
  onClearArt?:          () => void;
  /** 🎨 配色の主従（null = 設定なし）。ArrangePreviewPanel へ中継。 */
  colorDominance?:      import("../lib/colorDominanceNote").ColorDominance | null;
  /** 配色の主従の解除（soft）。ArrangePreviewPanel へ中継。 */
  onClearColorDominance?: () => void;
  /** 参照画像適用の解除。 */
  onClearReference?:    () => void;
  /** タグ個別NG（per-tag NG）の現在値。ArrangePreviewPanel へ中継（アレンジも全案に効く）。 */
  tagNg?:               string[];
  /** タグ個別NGの一括解除。ArrangePreviewPanel へ中継。 */
  onClearTagNg?:        () => void;
  /** ✏ 軸ごとカスタム指示メモのバッジ（App→ArrangePreviewPanel へ中継。アレンジにも焼き込まれて効く）。 */
  memoBadges?:          MemoBadge[];
  /** トースト表示（プロンプト全文コピー完了通知などに使用）。 */
  onToast?: (msg: string) => void;
}

type FilterMode = "all" | "favorites" | "used" | "good" | "bad";
type ExtraFilter =
  | "copied"
  | "notCopied"
  | "hasBackground"
  | "hasOutfit"
  | "hasHair"
  | "hasCamera"
  | "hasProps"
  | "isArranged"
  | "hasImage"
  | "hasDerived";

const FILTER_LABELS: { id: FilterMode; label: string }[] = [
  { id: "all", label: "全件" },
  { id: "favorites", label: "⭐ お気に入りのみ" },
  { id: "used", label: "使用した" },
  { id: "good", label: "結果よかった" },
  { id: "bad", label: "微妙だった" },
];

const EXTRA_FILTER_LABELS: { id: ExtraFilter; label: string }[] = [
  { id: "copied",        label: "📋 コピー済み" },
  { id: "notCopied",     label: "⬜ 未コピー" },
  { id: "hasBackground", label: "🏞 背景変更" },
  { id: "hasOutfit",     label: "👗 衣装変更" },
  { id: "hasHair",       label: "💇 髪変更" },
  { id: "hasCamera",     label: "📷 カメラ変更" },
  { id: "hasProps",      label: "🎒 持ち物あり" },
  { id: "isArranged",    label: "✨ アレンジ保存" },
  { id: "hasImage",      label: "🖼 画像あり" },
  { id: "hasDerived",    label: "🔀 派生元あり" },
];

export function HistoryView({
  onBack, initialFavoritesOnly = false,
  onArrangeInline, onSaveArranged, onSendToGenerator, onRestore,
  favoriteProfile = null, favoriteLearnEnabled = false, recoverySlot,
  avoidRealBackground, worldCombinedNote, referenceNoteText,
  onClearAvoidRealBg, onClearWorld, onClearReference,
  activeBgPresets = [], bgPresetNote, onClearBg,
  activeArtPresets = [], artPresetNote, onClearArt,
  colorDominance, onClearColorDominance,
  tagNg = [], onClearTagNg = () => {},
  memoBadges = [],
  onToast,
}: Props) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  const [filter, setFilter] = useState<FilterMode>(initialFavoritesOnly ? "favorites" : "all");
  const [extraFilters, setExtraFilters] = useState<Set<ExtraFilter>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // ─ アレンジ・プレビュー（要素選択 → 生成） ─────────────────────────────────
  const [arrangeSource, setArrangeSource]   = useState<PromptHistoryItem | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>([]);
  // アレンジ生成枚数（アレンジ専用・メイン案数とは独立・非永続）。既定 2。
  const [arrangeCount, setArrangeCount]     = useState<Count>(2);
  const [arrangeResult, setArrangeResult]   = useState<ArrangeResult | null>(null);
  const [arrangeBusy, setArrangeBusy]       = useState(false);
  const [pinned, setPinned]                 = useState(false);
  /** HistoryMiniExplorer で選択した参照画像 dataURL */
  const [refImage, setRefImage]             = useState<string | null>(null);

  const panelOpen = arrangeBusy || pinned || arrangeSource !== null;

  // カードのアレンジを押す → 元として選択（生成はまだしない）。元の変更範囲を初期ON。
  const handleArrangeSelect = useCallback((sourceItem: PromptHistoryItem) => {
    setArrangeSource(sourceItem);
    setSelectedScopes(detectSourceScopes(sourceItem));
    setArrangeResult(null);
  }, []);

  const toggleScope = useCallback((scope: Scope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }, []);

  // [選択要素でアレンジ生成]
  const handleGenerateArrange = useCallback(async () => {
    if (!onArrangeInline || !arrangeSource || selectedScopes.length === 0 || arrangeBusy) return;
    setArrangeBusy(true);
    try {
      const r = await onArrangeInline(arrangeSource, selectedScopes, arrangeCount);
      if (r) setArrangeResult(r);
    } finally {
      setArrangeBusy(false);
    }
  }, [onArrangeInline, arrangeSource, selectedScopes, arrangeCount, arrangeBusy]);

  // さらにアレンジ：選んだ案を新しい元プロンプトとして、同じ要素選択で再生成
  const handleReArrange = useCallback(
    async (proposal: GeneratedProposal) => {
      const base = arrangeSource ?? arrangeResult?.source;
      if (!base || !onArrangeInline || arrangeBusy) return;
      const synthetic: PromptHistoryItem = { ...base, promptText: proposal.body };
      setArrangeSource(synthetic);
      setArrangeBusy(true);
      try {
        const r = await onArrangeInline(synthetic, selectedScopes, arrangeCount);
        if (r) setArrangeResult(r);
      } finally {
        setArrangeBusy(false);
      }
    },
    [arrangeSource, arrangeResult, onArrangeInline, selectedScopes, arrangeCount, arrangeBusy]
  );

  const handleCloseArrange = useCallback(() => {
    setArrangeSource(null);
    setArrangeResult(null);
    setSelectedScopes([]);
    setPinned(false);
  }, []);

  // ─ 管理ステート ────────────────────────────────────────────────────────────
  const [autoCleanup, setAutoCleanupState] = useState(() => getAutoCleanupEnabled());
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupCount, setCleanupCount] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = selectedDate ? await getByDate(selectedDate) : await getAll();
    next.sort((a, b) => b.createdAt - a.createdAt);
    setItems(next);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // 📜 履歴/カレンダー画面を開いたら最上部（＝降順ソートの先頭＝最新プロンプト）から表示する。
  //    view 切替は同一 document でスクロール位置が残るため、マウント時に先頭へ戻す（表示位置のみ・データ不変）。
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const toggleExtraFilter = useCallback((id: ExtraFilter) => {
    setExtraFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // 他のアイテムから派生元として参照されているIDセット（hasDerivedフィルタ用）
    const derivedSourceIds = new Set(items.map((i) => i.derivedFromId).filter(Boolean) as string[]);
    return items.filter((it) => {
      // ステータスフィルタ
      if (filter === "favorites" && !it.isFavorite) return false;
      if (filter === "used"      && it.status !== "used") return false;
      if (filter === "good"      && it.status !== "good") return false;
      if (filter === "bad"       && it.status !== "bad") return false;

      // 追加フィルタ（AND）
      if (extraFilters.has("copied")        && !it.copied)                        return false;
      if (extraFilters.has("notCopied")     && it.copied)                         return false;
      if (extraFilters.has("hasBackground") && !it.scopes?.includes("background"))return false;
      if (extraFilters.has("hasOutfit")     && !it.scopes?.includes("outfit"))    return false;
      if (extraFilters.has("hasHair")       && !it.scopes?.includes("hair"))      return false;
      if (extraFilters.has("hasCamera")     && !it.scopes?.includes("camera"))    return false;
      if (extraFilters.has("hasProps")      && !it.scopes?.includes("props"))     return false;
      if (extraFilters.has("isArranged")    && !it.derivedFromId)                 return false;
      if (extraFilters.has("hasImage")      && !it.resultImageData)               return false;
      if (extraFilters.has("hasDerived")    && !derivedSourceIds.has(it.id))       return false;

      // 検索
      if (q) {
        const inText = it.promptText.toLowerCase().includes(q);
        const inMemo = (it.memo ?? "").toLowerCase().includes(q);
        const inTags = (it.tags ?? []).some((t) => t.toLowerCase().includes(q));
        const inPreset = (it.presetName ?? "").toLowerCase().includes(q);
        if (!inText && !inMemo && !inTags && !inPreset) return false;
      }

      return true;
    });
  }, [items, filter, extraFilters, searchQuery]);

  const handleUpdate = useCallback(
    async (id: string, patch: Partial<PromptHistoryItem>) => {
      await updateItem(id, patch);
      // 楽観的更新のみ。setRefreshKey を呼ばない（不要な全件 reload を防ぐ）
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    []
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteItem(id);
    // 楽観的更新のみ。setRefreshKey を呼ばない（不要な全件 reload を防ぐ）
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // ─ 管理ハンドラ ────────────────────────────────────────────────────────────
  const handleToggleAutoCleanup = useCallback(() => {
    const next = !autoCleanup;
    setAutoCleanupEnabled(next);
    setAutoCleanupState(next);
  }, [autoCleanup]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportBackup();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImportChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || importing) return;
      setImporting(true);
      setImportError(null);
      setImportResult(null);
      setCleanupCount(null);
      try {
        const result = await importBackup(file);
        if (result.errors.length > 0) {
          setImportError(result.errors[0]);
        } else {
          setImportResult(result);
          setRefreshKey((k) => k + 1);
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "インポートに失敗しました");
      } finally {
        setImporting(false);
        // 同じファイルを再インポートできるようリセット
        if (importFileRef.current) importFileRef.current.value = "";
      }
    },
    [importing]
  );

  const handleCleanup = useCallback(async () => {
    setCleanupRunning(true);
    setImportResult(null);
    setImportError(null);
    try {
      const count = await runAutoCleanup();
      setCleanupCount(count);
      setRefreshKey((k) => k + 1);
    } finally {
      setCleanupRunning(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* ヘッダー行（sticky で「←戻る」を常時表示・スクロールしても隠れない） */}
      <div className="sticky top-0 z-30 py-2 bg-bg-base/95 backdrop-blur-sm flex items-center gap-3 flex-wrap">
        <button type="button" className="btn text-sm" onClick={onBack}>
          ← 戻る
        </button>
        <h2 className="text-lg font-bold">履歴 / カレンダー</h2>
        <span className="ml-auto text-[13px] text-text-muted/85">
          {loading ? "読み込み中…" : `${filtered.length}件 表示中`}
        </span>
      </div>

      {/* PC: 横並び。アレンジパネル展開時は3カラム（カレンダー / 一覧 / プレビュー） */}
      <div
        className={
          panelOpen
            /* 3カラム：左サイドバー(320px固定) / 中央一覧(1fr) / 右アレンジ(42%) */
            ? "lg:grid lg:grid-cols-[320px_minmax(0,1fr)_minmax(0,42%)] lg:gap-4"
            /* 2カラム：左サイドバー(320px固定) / 中央一覧(1fr) */
            : "lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-4"
        }
      >
        {/* Left: calendar + filter + 管理（sticky） */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto lg:pr-1">
          <CalendarView
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            refreshKey={refreshKey}
          />

          {/* 📁 小型Explorer（カレンダー直下） */}
          <HistoryMiniExplorer
            selectedImage={refImage}
            onSelectImage={setRefImage}
            onUseForArrange={(url) => {
              setRefImage(url);
              // アレンジパネルが開いていなければ促す
            }}
          />

          {/* ⭐ お気に入り分析（hide-not-delete・表示のみ非表示／集計run・傾向反映は App 側で温存） */}
          {SHOW_FAV_ANALYSIS && favoriteProfile && favoriteProfile.favoriteCount > 0 && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3 space-y-2">
              <button
                type="button"
                onClick={() => setAnalysisOpen((v) => !v)}
                className="w-full flex items-center gap-2"
              >
                <span className="text-[13px]">⭐</span>
                <span className="text-[12px] font-bold text-amber-100">お気に入り分析</span>
                <span className="text-[10px] text-text-muted/40">
                  ({favoriteProfile.favoriteCount}件)
                </span>
                {favoriteLearnEnabled && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/15 text-amber-200 leading-none">
                    反映中
                  </span>
                )}
                <span className="ml-auto text-[11px] text-text-muted/40">
                  {analysisOpen ? "▲" : "▼"}
                </span>
              </button>

              {analysisOpen && (
                <div className="space-y-2 pt-1">
                  {/* 反映中の傾向 */}
                  {favoriteProfile.traitPhrases.length > 0 && (
                    <div>
                      <div className="text-[10px] text-amber-200/55 mb-1">反映される傾向</div>
                      <div className="flex flex-wrap gap-1">
                        {favoriteProfile.traitPhrases.map((t) => (
                          <span key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-100/85 leading-none">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* カテゴリ別 */}
                  {favoriteProfile.categories.map((cat) => (
                    <div key={cat.category}>
                      <div className="text-[10px] text-text-muted/45 mb-0.5">
                        よく使う{cat.category}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cat.items.slice(0, 4).map((it) => (
                          <span key={it.label}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-bg-border bg-bg-panel/60 text-text-base/70 leading-none">
                            {it.label}
                            <span className="text-text-muted/40 ml-1">{it.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* 雰囲気 */}
                  {favoriteProfile.topMoodLabels.length > 0 && (
                    <div>
                      <div className="text-[10px] text-text-muted/45 mb-0.5">よく使う雰囲気</div>
                      <div className="flex flex-wrap gap-1">
                        {favoriteProfile.topMoodLabels.map((m) => (
                          <span key={m}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-violet-400/30 bg-violet-400/10 text-violet-200/80 leading-none">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 神引き率 */}
                  {favoriteProfile.viralRatio > 0 && (
                    <div className="text-[10px] text-text-muted/50">
                      神引き要素：{Math.round(favoriteProfile.viralRatio * 100)}%
                    </div>
                  )}

                  <p className="text-[9px] text-text-muted/35 leading-snug border-t border-amber-400/15 pt-1.5">
                    メイン画面の「⭐ お気に入り傾向を反映」をONにすると、これらの傾向を
                    コピーせず方向性として新規生成に反映します。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 検索バー */}
          <div className="rounded-2xl border border-bg-border bg-bg-panel/40 p-3">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-text-muted/90 mb-2">
              検索
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/70 text-[13px] pointer-events-none">
                🔍
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="プロンプト・メモ・タグ…"
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-bg-border bg-bg-base text-[13px] text-text-base placeholder:text-text-muted/65 outline-none focus:border-accent/60 transition"
              />
            </div>
          </div>

          {/* フィルタ（hide-not-delete・絞り込み表示のみ。hide 中は filter=all で全件表示・カレンダー再クリックで日付解除可） */}
          {SHOW_HISTORY_FILTERS && (
          <div className="rounded-2xl border border-bg-border bg-bg-panel/40 p-3 space-y-3">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-text-muted/90">
              フィルタ
            </div>

            {/* ステータスフィルタ */}
            <div className="flex flex-wrap gap-1.5">
              {FILTER_LABELS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={
                      active
                        ? "rounded-full text-[12px] px-2.5 py-1 border border-accent bg-accent/20 text-text-base"
                        : "rounded-full text-[12px] px-2.5 py-1 border border-bg-border bg-bg-panel text-text-muted hover:text-text-base hover:border-accent/50 transition"
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* 追加フィルタ（複数選択・AND） */}
            <div>
              <div className="text-[13px] text-text-muted/85 mb-1.5">
                追加条件（複数AND）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXTRA_FILTER_LABELS.map((f) => {
                  const active = extraFilters.has(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleExtraFilter(f.id)}
                      className={[
                        "rounded-full text-[12px] px-2.5 py-1 border transition",
                        active
                          ? "border-violet-400/70 bg-violet-400/20 text-violet-100"
                          : "border-bg-border bg-bg-panel text-text-muted hover:text-text-base hover:border-violet-400/40",
                      ].join(" ")}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
              {extraFilters.size > 0 && (
                <button
                  type="button"
                  className="mt-1.5 text-[12px] text-text-muted/80 hover:text-accent transition"
                  onClick={() => setExtraFilters(new Set())}
                >
                  追加条件をリセット
                </button>
              )}
            </div>

            <div className="text-[13px] text-text-muted/90 border-t border-bg-border/60 pt-2">
              {selectedDate ? `${selectedDate} のみ` : "全期間"}
              {selectedDate && (
                <button
                  type="button"
                  className="ml-2 text-accent hover:underline"
                  onClick={() => setSelectedDate(null)}
                >
                  解除
                </button>
              )}
            </div>
          </div>
          )}

          {/* データ管理 */}
          <div className="rounded-2xl border border-bg-border bg-bg-panel/40 p-3 space-y-2.5">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-text-muted/90">
              データ管理
            </div>

            {/* 保存ルール表示 */}
            <div className="text-[12px] text-text-muted/90 leading-relaxed space-y-0.5">
              <div>📁 通常履歴 {RETENTION_DAYS}日 / お気に入り・良好 無期限</div>
              <div>🖼 最近画像 最大 {MAX_RECENT}枚</div>
              <div className="flex items-center gap-2 pt-0.5">
                <span>自動削除</span>
                <button
                  type="button"
                  onClick={handleToggleAutoCleanup}
                  className={[
                    "text-[12px] px-2 py-0.5 rounded-full border transition font-semibold",
                    autoCleanup
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25"
                      : "bg-bg-panel border-bg-border text-text-muted hover:border-accent/40 hover:text-text-base",
                  ].join(" ")}
                >
                  {autoCleanup ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* ボタン群 */}
            <div className="flex flex-col gap-1.5">
              {/* エクスポート */}
              <button
                type="button"
                disabled={exporting}
                onClick={handleExport}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold border border-violet-400/40 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                <span>📤</span>
                <span>{exporting ? "エクスポート中…" : "エクスポート"}</span>
              </button>

              {/* インポート */}
              <label className="rounded-lg px-3 py-1.5 text-[12px] font-semibold border border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20 transition flex items-center gap-2 cursor-pointer">
                <span>📥</span>
                <span>インポート</span>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportChange}
                />
              </label>

              {/* クリーンアップ */}
              <button
                type="button"
                disabled={cleanupRunning}
                onClick={handleCleanup}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold border border-rose-400/30 bg-rose-400/8 text-rose-200 hover:bg-rose-400/18 transition flex items-center gap-2 disabled:opacity-50"
              >
                <span>🧹</span>
                <span>{cleanupRunning ? "実行中…" : "クリーンアップ実行"}</span>
              </button>
            </div>

            {/* 操作結果メッセージ */}
            {cleanupCount !== null && (
              <div className="text-[13px] leading-relaxed border-t border-bg-border/60 pt-2">
                {cleanupCount === 0 ? (
                  <span className="text-text-muted">削除対象なし（{RETENTION_DAYS}日以内）</span>
                ) : (
                  <span className="text-emerald-300">✓ {cleanupCount}件を削除しました</span>
                )}
              </div>
            )}
            {importResult && (
              <div className="text-[11px] text-emerald-300 leading-relaxed border-t border-bg-border/60 pt-2 space-y-0.5">
                <div>✓ 履歴 {importResult.historyAdded}件追加、{importResult.historySkipped}件スキップ</div>
                {(importResult.imagesAdded > 0 || importResult.imagesSkipped > 0) && (
                  <div>　画像 {importResult.imagesAdded}件追加、{importResult.imagesSkipped}件スキップ</div>
                )}
                {(importResult.selectionAdded > 0 || importResult.selectionSkipped > 0) && (
                  <div>　選択履歴 {importResult.selectionAdded}件追加、{importResult.selectionSkipped}件スキップ</div>
                )}
                {(importResult.explorerFavAdded > 0 || importResult.explorerFavSkipped > 0) && (
                  <div>　Explorer★ {importResult.explorerFavAdded}件追加、{importResult.explorerFavSkipped}件スキップ</div>
                )}
              </div>
            )}
            {importError && (
              <div className="text-[11px] text-rose-300 leading-relaxed border-t border-bg-border/60 pt-2">
                ⚠ {importError}
              </div>
            )}
          </div>
          {/* 🛟 履歴・お気に入り復旧（左メニューから移設・左レール最下部＝左下） */}
          {recoverySlot}
        </aside>

        {/* Middle: history list */}
        <div className="mt-4 lg:mt-0">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-bg-border bg-bg-card/60 text-center text-sm text-text-muted py-14 px-4">
              {selectedDate
                ? "この日の履歴はありません。"
                : items.length === 0
                ? "まだ履歴がありません。プロンプトを生成すると自動で保存されます。"
                : "フィルタに一致する履歴がありません。"}
            </div>
          ) : (
            <div className={panelOpen ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 xl:grid-cols-2 gap-3"}>
              {filtered.map((it) => (
                <HistoryItemRow
                  key={it.id}
                  item={it}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onArrange={onArrangeInline ? handleArrangeSelect : undefined}
                  onRestore={onRestore}
                  onCopied={() => onToast?.("✓ コピーしました")}
                  highlight={arrangeSource?.id === it.id}
                  busy={arrangeBusy && arrangeSource?.id === it.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: アレンジ結果プレビュー（展開時のみ） */}
        {panelOpen && (
          <div className="mt-4 lg:mt-0 hidden lg:block">
            <ArrangePreviewPanel
              source={arrangeSource}
              selectedScopes={selectedScopes}
              onToggleScope={toggleScope}
              onSetScopes={setSelectedScopes}
              onGenerate={() => void handleGenerateArrange()}
              result={arrangeResult}
              busy={arrangeBusy}
              pinned={pinned}
              onTogglePin={() => setPinned((v) => !v)}
              onClose={handleCloseArrange}
              refImage={refImage}
              onClearRefImage={() => setRefImage(null)}
              avoidRealBackground={avoidRealBackground}
              worldCombinedNote={worldCombinedNote}
              referenceNoteText={referenceNoteText}
              onClearAvoidRealBg={onClearAvoidRealBg}
              onClearWorld={onClearWorld}
              activeBgPresets={activeBgPresets}
              bgPresetNote={bgPresetNote}
              onClearBg={onClearBg}
              activeArtPresets={activeArtPresets}
              artPresetNote={artPresetNote}
              onClearArt={onClearArt}
              colorDominance={colorDominance}
              onClearColorDominance={onClearColorDominance}
              onClearReference={onClearReference}
              tagNg={tagNg}
              onClearTagNg={onClearTagNg}
              memoBadges={memoBadges}
              arrangeCount={arrangeCount}
              onArrangeCountChange={setArrangeCount}
              onSaveFavorite={(p, ls) => {
                if (arrangeResult && onSaveArranged) return onSaveArranged(arrangeResult, p, ls);
              }}
              onReArrange={(p) => void handleReArrange(p)}
              onSendToGenerator={() => {
                const src = arrangeSource ?? arrangeResult?.source;
                if (src && onSendToGenerator) onSendToGenerator(src);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
