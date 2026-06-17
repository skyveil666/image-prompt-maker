import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUploader, type UploadedMeta } from "./ImageUploader";
import { RecentImages } from "./RecentImages";
import {
  addRecentImage,
  clearRecentImages,
  dedupeRecentImages,
  deleteRecentImage,
  listRecentImages,
  type RecentImageItem,
} from "../lib/recentImages";
import { imageContentHash } from "../lib/imageThumb";
import { ALL_SCOPE_LABELS as SCOPE_LABEL } from "../lib/scopeLabels";
import type { Count, Scope } from "../types";

interface Props {
  imageDataUrl: string | null;
  onImageChange: (url: string | null) => void;
  scopes: Scope[];
  count: Count;
  generating: boolean;
  viralMode: boolean;
  onShowCalendar: () => void;
  onShowFavorites: () => void;
  /** 🖼 Reference Picker履歴（保存した参照画像＋抽出プロンプトの再利用／生成と比較）を開く */
  onShowReferenceHistory: () => void;
  onShowAnalysis: () => void;
  onToggleExplorer: () => void;
  explorerOpen: boolean;
  /** 「この画像でバズる」一発生成ボタンのコールバック（画像あり時のみ表示） */
  onImageViral?: () => void;
}

// Scope→ラベルは scopeLabels.ts に一本化（SCOPE_LABEL は別名 import）。

export function ImageSidebar({
  imageDataUrl,
  onImageChange,
  scopes,
  count,
  generating,
  viralMode,
  onShowCalendar,
  onShowFavorites,
  onShowReferenceHistory,
  onShowAnalysis,
  onToggleExplorer,
  explorerOpen,
  onImageViral,
}: Props) {
  const [recents, setRecents] = useState<RecentImageItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // 起動時：旧スキーマや古い重複を一括清掃してから一覧を構築
  useEffect(() => {
    void (async () => {
      const cleaned = await dedupeRecentImages();
      setRecents(cleaned);
    })();
  }, []);

  /**
   * imageDataUrl が変化するたびに recents を IDB から再同期する。
   * - 通常のアップロード（handleUpload）では setRecents 済みだが冪等で問題なし。
   * - Explorer 選択等の外部セット時は handleUpload を
   *   経由しないため、ここで同期しないと一覧が古いままになる。
   * - 外部由来の URL（data:image/...）が recents に存在しなければ新規登録する。
   */
  const syncRecentsRef = useRef(false); // handleUpload が直前に setRecents 済みかフラグ
  useEffect(() => {
    if (!imageDataUrl) {
      setCurrentId(null);
      return;
    }
    // handleUpload が同フレームで setRecents を呼んだ場合はスキップ（二重 IDB 読み込みを防ぐ）
    if (syncRecentsRef.current) {
      syncRecentsRef.current = false;
      return;
    }

    void (async () => {
      // 既存リストを取得してマッチするものを探す
      const list = await listRecentImages();
      const match = list.find((it) => it.imageDataUrl === imageDataUrl);
      if (match) {
        setCurrentId(match.id);
        setRecents(list);
        return;
      }

      // 外部セット（Explorer 選択等）の場合：コンテンツハッシュで重複確認後に追加
      try {
        const hash = await imageContentHash(imageDataUrl);
        const { list: updated, item } = await addRecentImage({
          imageHash: hash,
          originalDataUrl: imageDataUrl,
          fileName: `image-${Date.now()}.jpg`,
        });
        setCurrentId(item.id);
        setRecents(updated);
      } catch {
        // 追加失敗時は単純リロード
        setRecents(list);
      }
    })();
  // imageDataUrl の変化だけを追う（他の依存は意図的に除外）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  }, []);

  // 新規アップロード／貼り付け／フォルダー参照経由
  const handleUpload = useCallback(
    async (url: string | null, meta?: UploadedMeta) => {
      if (!url || !meta?.fileHash) {
        onImageChange(url);
        setCurrentId(null);
        return;
      }

      const { list, item, wasExisting } = await addRecentImage({
        imageHash: meta.fileHash,
        originalDataUrl: url,
        fileName: meta.fileName,
      });

      // 既存ヒット時は dedup（履歴に追加せず、保存済みの再利用版へ切り替え）
      if (wasExisting) {
        onImageChange(item.imageDataUrl);
        showToast("既存画像を選択しました");
      } else {
        onImageChange(url);
      }
      syncRecentsRef.current = true; // useEffect の二重実行を抑制
      setCurrentId(item.id);
      setRecents(list);
    },
    [onImageChange, showToast]
  );

  const handleSelectRecent = useCallback(
    (item: RecentImageItem) => {
      onImageChange(item.imageDataUrl);
      setCurrentId(item.id);
    },
    [onImageChange]
  );

  const handleDeleteRecent = useCallback(
    async (id: string) => {
      await deleteRecentImage(id);
      const list = await listRecentImages();
      setRecents(list);
      if (currentId === id) setCurrentId(null);
    },
    [currentId]
  );

  const handleClearRecents = useCallback(async () => {
    await clearRecentImages();
    setRecents([]);
    setCurrentId(null);
  }, []);

  return (
    <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto lg:pr-1">

      {/* ナビゲーションショートカット */}
      <div className="space-y-2">
        {/* Explorer */}
        {explorerOpen ? (
          /* 開いている状態：✕ 閉じる */
          <button
            type="button"
            onClick={onToggleExplorer}
            className="w-full rounded-2xl px-4 py-3.5 text-base font-bold flex items-center gap-2 transition border bg-accent/20 border-accent/70 text-text-base shadow-[0_0_14px_rgba(124,92,255,0.35)] hover:bg-accent/30"
          >
            <span className="text-lg">📁</span>
            <span>Explorer</span>
            <span className="text-sm opacity-60 ml-auto">✕ 閉じる</span>
          </button>
        ) : (
          /* 閉じている状態：細いボタン */
          <button
            type="button"
            onClick={onToggleExplorer}
            className="w-full rounded-xl px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition border border-bg-border/60 bg-bg-panel/30 text-text-muted/70 hover:bg-accent/8 hover:border-accent/35 hover:text-text-base"
          >
            <span>📁</span>
            <span>Explorer を開く</span>
          </button>
        )}
        {/* カレンダー */}
        <button
          type="button"
          onClick={onShowCalendar}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold border border-sky-400/50 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20 hover:border-sky-400/80 transition flex items-center justify-center gap-2"
        >
          <span>📅</span>
          <span>カレンダー / 履歴</span>
        </button>
        {/* お気に入り */}
        <button
          type="button"
          onClick={onShowFavorites}
          className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold border border-amber-400/50 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 hover:border-amber-400/80 transition flex items-center justify-center gap-2"
        >
          <span>⭐</span>
          <span>お気に入り一覧</span>
        </button>
        {/* 🖼 Reference Picker履歴（保存した参照画像＋抽出プロンプトの再利用／生成と比較・全画面） */}
        <button
          type="button"
          onClick={onShowReferenceHistory}
          className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold border border-violet-400/40 bg-violet-400/8 text-violet-100 hover:bg-violet-400/18 hover:border-violet-400/70 transition flex items-center justify-center gap-2"
          title="保存した参照画像・抽出プロンプトの履歴を全画面で開く（再利用・生成と比較）"
        >
          <span>🖼</span>
          <span>Reference Picker履歴</span>
        </button>
        {/* 分析センター（独立画面・全画面） */}
        <button
          type="button"
          onClick={onShowAnalysis}
          className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold border border-violet-400/50 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20 hover:border-violet-400/80 transition flex items-center justify-center gap-2"
        >
          <span>📊</span>
          <span>分析センター</span>
        </button>
      </div>

      <section className="card">
        <h2 className="section-title">画像</h2>
        <ImageUploader value={imageDataUrl} onChange={handleUpload} />
        {imageDataUrl && onImageViral && (
          <button
            type="button"
            onClick={onImageViral}
            disabled={generating}
            className="w-full mt-2 rounded-xl px-3 py-3 text-[13px] font-bold border border-rose-500/55 bg-gradient-to-r from-rose-600/20 to-orange-500/15 text-rose-100 hover:from-rose-600/30 hover:to-orange-500/25 hover:border-rose-500/75 transition flex items-center justify-center gap-2 shadow-[0_0_14px_rgba(244,63,94,0.18)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-base">⚡</span>
            <span>この画像でバズる</span>
          </button>
        )}
      </section>

      {toast && (
        <div
          role="status"
          className="rounded-xl border border-accent/50 bg-accent/15 text-text-base text-xs px-3 py-2 shadow-[0_0_12px_rgba(124,92,255,0.35)]"
        >
          ✓ {toast}
        </div>
      )}

      <RecentImages
        recents={recents}
        currentId={currentId}
        onSelect={handleSelectRecent}
        onDelete={handleDeleteRecent}
        onClear={handleClearRecents}
      />

      <section className="card !p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-widest text-text-muted/90">状態</span>
          {generating && (
            <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              生成中…
            </span>
          )}
        </div>
        <div className="text-xs text-text-base leading-relaxed">
          {imageDataUrl
            ? "画像あり：AIが内容を解析してプロンプトに反映します"
            : "画像なし：テキスト指示のみで生成します"}
        </div>
      </section>

      <section className="card !p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-widest text-text-muted/90">変更範囲</h3>
          <span className="text-[11px] text-text-muted/85">
            {count}案 ・ 統一{viralMode && " · 🔥"}
          </span>
        </div>
        {scopes.length === 0 ? (
          <div className="text-xs text-text-muted">未選択</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {scopes.map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-full text-xs border border-accent/40 bg-accent/10 text-text-base"
              >
                {SCOPE_LABEL[s]}
              </span>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
