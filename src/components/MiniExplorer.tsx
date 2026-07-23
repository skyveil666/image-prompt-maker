/**
 * MiniExplorer — Windows Explorer-style file browser.
 *
 * Preview layout (when hover/pinned is active):
 *
 *  ┌─ Explorer ─┐  ┌──────── LargePreview ─────────┐  ┌── Main UI ──
 *  │  tree      │  │                               │  │
 *  │  grid      │  │    [image - contain, black]   │  │  (behind)
 *  │            │  │                               │  │
 *  └────────────┘  ├───────────────────────────────┤  └────────────
 *                  │ name · 896×1152 · 1.3MB · date│
 *                  │ [セット] [♡] [📌] [×]         │
 *                  └───────────────────────────────┘
 *
 * Powered by File System Access API (Chrome / Edge only).
 */
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEscapeKey } from "../lib/useEscapeKey";
import { croppedImagesChanged, listCroppedImages, removeCroppedImage, toggleCroppedFavorite, type CroppedImageRecord } from "../lib/croppedImages";
import type { ExplorerFavorite, ExplorerImage, ExplorerSubfolder } from "../lib/miniExplorer";
import {
  addExplorerFavorite,
  compressToDataUrl,
  fileHandleToDataUrl,
  isFSASupported,
  listExplorerFavorites,
  loadRecentFolders,
  loadRootHandle,
  readImagesFromDir,
  readSubfolders,
  removeExplorerFavorite,
  resetRecentDatesOnce,
  saveRecentFolder,
  saveRootHandle,
  verifyPermission,
  type RecentFolder,
} from "../lib/miniExplorer";

// ── Quick Access helpers: 追加日の表示名 & 月別12色（季節配色） ───────────────
/** 月(1-12)→色。春=緑/桜・夏=青/水色・秋=橙/茶・冬=白/青紫。undated=グレー。実機で微調整。 */
const MONTH_COLORS: Record<number, string> = {
  1: "#c7d2fe", 2: "#a5b4fc",                 // 冬：青紫
  3: "#bbf7d0", 4: "#f9a8d4", 5: "#86efac",   // 春：若草・桜・緑
  6: "#7dd3fc", 7: "#38bdf8", 8: "#0ea5e9",   // 夏：水色〜青
  9: "#fdba74", 10: "#fb923c", 11: "#b45309", // 秋：橙〜茶
  12: "#e5e7eb",                              // 冬：白/淡
};
function monthColor(addedAt: number | null): string {
  if (addedAt == null) return "#6b7280"; // undated=グレー
  return MONTH_COLORS[new Date(addedAt).getMonth() + 1] ?? "#6b7280";
}
/** addedAt→「M月D日」。undated は null。 */
function formatAddedDate(addedAt: number | null): string | null {
  if (addedAt == null) return null;
  const d = new Date(addedAt);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ── Types ──────────────────────────────────────────────────────────────────

type SortKey   = "name" | "newest" | "oldest" | "fav";
type ThumbMode = "sm" | "md" | "lg";

interface NavEntry {
  handle: FileSystemDirectoryHandle;
  pathHandles: FileSystemDirectoryHandle[];
}

/** explorerRight = right-edge x-coord of the Explorer aside */
interface PreviewBase {
  image: ExplorerImage;
  explorerRight: number;
}

type HoverState  = PreviewBase;
type PinnedState = PreviewBase;

interface CtxMenu {
  x: number;
  y: number;
  image: ExplorerImage;
}

interface Props {
  onSelectImage: (dataUrl: string) => void;
  onClose?: () => void;
  open: boolean;
  onOpen: () => void;
  width: number;
  onResize: (w: number) => void;
}

interface TreeCtx {
  expandedSet: Set<string>;
  childrenMap: Map<string, ExplorerSubfolder[]>;
  loadingSet:  Set<string>;
  currentNavPK: string;
  onNavigate: (handle: FileSystemDirectoryHandle, pathHandles: FileSystemDirectoryHandle[]) => void;
  onExpand:   (handle: FileSystemDirectoryHandle, pk: string) => Promise<void>;
  onToggle:   (pk: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "name",   label: "名前順"      },
  { id: "newest", label: "新しい順"    },
  { id: "oldest", label: "古い順"      },
  { id: "fav",    label: "⭐ お気に入り順" },
];

const THUMB_MINW: Record<ThumbMode, number> = { sm: 90, md: 130, lg: 180 };
const THUMB_MODE_KEY = "ipm_thumbMode";
/** Header height — 0 because the top header bar has been removed */
const HEADER_H = 0;

const pk = (handles: FileSystemDirectoryHandle[]): string =>
  handles.map((h) => h.name).join("\0");

// ── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024)        return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

/** Compute preview panel left-edge: right of Explorer + gap, clamped to viewport */
function computeLeft(explorerRight: number, previewW: number): number {
  const gap = 8;
  const raw = explorerRight + gap;
  // If even at raw position the panel overflows right, clamp—but never go left of Explorer
  return Math.min(raw, Math.max(raw, window.innerWidth - previewW - 4));
}

// ── LargePreview (shared by HoverPreview & PinnedPreview) ─────────────────
// A full-height panel that sits to the right of the Explorer panel.
// Image fills ~all available height; a compact info+action bar sits at bottom.

interface LargePreviewProps {
  state: PreviewBase;
  folderName: string;
  isFav: boolean;
  isPinned: boolean;          // true = pinned variant (violet border, × button)
  onSelect: () => void;
  onSelectAndClose: () => void;
  onFav: () => void;
  onHide: () => void;
  onPin?: () => void;         // only in hover variant
  onClose?: () => void;       // only in pinned variant
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function LargePreview({
  state, folderName, isFav, isPinned,
  onSelect, onSelectAndClose, onFav, onHide, onPin, onClose,
  onMouseEnter, onMouseLeave,
}: LargePreviewProps) {
  const [visible, setVisible]   = useState(false);
  const [dims, setDims]         = useState<{ w: number; h: number } | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  // ── Size ──────────────────────────────────────────────────────────
  // Width: 50vw capped at 1000px, minimum 480px
  const PW = Math.max(480, Math.min(1000, Math.round(window.innerWidth * 0.50)));
  // Full viewport height minus header
  const PANEL_H  = window.innerHeight - HEADER_H;
  // Bottom bar height
  const BAR_H    = 76;
  const IMG_H    = PANEL_H - BAR_H;

  const left = computeLeft(state.explorerRight, PW);
  const top  = HEADER_H;

  // ── Mount animation ───────────────────────────────────────────────
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Esc closes pinned ─────────────────────────────────────────────
  useEscapeKey(() => onClose?.(), !!isPinned && !!onClose);

  // ── Lazy-load file size ───────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    state.image.fileHandle.getFile()
      .then((f) => { if (!dead) setFileSize(f.size); })
      .catch(() => {});
    return () => { dead = true; };
  }, [state.image]);

  // ── Border colour ─────────────────────────────────────────────────
  const borderCls = isPinned
    ? "border-violet-400/40 shadow-[0_0_0_1px_rgba(139,92,246,0.12)]"
    : "border-white/[0.07]";

  return createPortal(
    <div
      style={{
        position: "fixed",
        left,
        top,
        width:  PW,
        height: PANEL_H,
        zIndex: isPinned ? 10000 : 9999,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 120ms ease, transform 120ms ease",
      }}
      className={`flex flex-col rounded-none overflow-hidden border-l border-r border-b ${borderCls} bg-[#04060a] shadow-[4px_0_40px_rgba(0,0,0,0.6)]`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* ── Image area ── fills everything above the bar ───────── */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden bg-[#04060a] min-h-0"
        style={{ height: IMG_H }}
      >
        <img
          key={state.image.objectUrl}
          src={state.image.objectUrl}
          alt={state.image.name}
          style={{ maxWidth: "100%", maxHeight: IMG_H, objectFit: "contain", display: "block" }}
          onLoad={(e) => {
            const el = e.currentTarget;
            setDims({ w: el.naturalWidth, h: el.naturalHeight });
          }}
        />

        {/* Pinned close button — top-right corner overlay */}
        {isPinned && onClose && (
          <button
            type="button"
            onClick={onClose}
            title="閉じる (Esc)"
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 border border-white/15 text-white/60 hover:text-white hover:bg-black/80 transition text-[13px] backdrop-blur-sm"
          >
            ×
          </button>
        )}

        {/* Pinned badge — top-left */}
        {isPinned && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/25 border border-violet-400/35 backdrop-blur-sm">
            <span className="text-[12px] text-violet-300">📌 固定中</span>
          </div>
        )}

        {/* Hover hint — bottom-right corner */}
        {!isPinned && onPin && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            title="固定表示（ダブルクリックでも可）"
            className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/55 border border-white/10 text-[11px] text-white/50 hover:text-white/80 hover:bg-black/75 transition backdrop-blur-sm"
          >
            📌 固定
          </button>
        )}
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col justify-center gap-1.5 px-3 py-2 border-t border-white/[0.06] bg-[#0a0d14]"
        style={{ height: BAR_H }}
      >
        {/* Info row */}
        <div className="flex items-center gap-0 min-w-0 overflow-hidden">
          {/* Filename */}
          <span
            className="text-[12px] font-semibold text-text-base truncate mr-3 shrink-0 max-w-[38%]"
            title={state.image.name}
          >
            {state.image.name}
          </span>
          {/* Meta chips */}
          <div className="flex items-center gap-2 text-[12px] text-text-muted/70 min-w-0 overflow-hidden flex-wrap">
            {dims && (
              <span className="shrink-0 font-medium text-text-muted/75">
                {dims.w.toLocaleString()}×{dims.h.toLocaleString()}
              </span>
            )}
            {fileSize !== null && <span className="shrink-0">{formatFileSize(fileSize)}</span>}
            <span className="shrink-0">{formatDate(state.image.lastModified)}</span>
            {folderName && (
              <span className="truncate max-w-[150px]" title={folderName}>
                📁 {folderName}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSelect}
            className="flex-1 rounded-lg py-1 text-[12px] font-bold border border-accent/55 bg-accent/12 text-accent hover:bg-accent/22 hover:border-accent/80 transition"
          >
            この画像をセット
          </button>
          {isPinned && (
            <button
              type="button"
              onClick={onSelectAndClose}
              className="flex-1 rounded-lg py-1 text-[12px] font-bold border border-sky-400/35 bg-sky-400/8 text-sky-200/80 hover:bg-sky-400/16 hover:border-sky-400/60 transition"
            >
              セット＆閉じる
            </button>
          )}
          <button
            type="button"
            onClick={onFav}
            title={isFav ? "お気に入りから削除" : "お気に入りに追加"}
            className={[
              "rounded-lg px-3 py-1 text-[13px] border transition",
              isFav
                ? "border-amber-400/60 bg-amber-400/12 text-amber-200 hover:bg-amber-400/22"
                : "border-white/10 bg-white/[0.03] text-text-muted/50 hover:border-amber-400/50 hover:text-amber-200",
            ].join(" ")}
          >
            {isFav ? "★" : "☆"}
          </button>
          <button
            type="button"
            onClick={onHide}
            title="このセッションで非表示"
            className="rounded-lg px-2.5 py-1 text-[12px] border border-white/[0.06] text-text-muted/50 hover:border-rose-400/35 hover:text-rose-300/70 transition"
          >
            ×
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── ContextMenu portal ─────────────────────────────────────────────────────

function ContextMenu({
  state, isFav, onFav, onCopy, onHide, onClose,
}: {
  state: CtxMenu; isFav: boolean;
  onFav: () => void; onCopy: () => void; onHide: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const W = 192;
  const x = Math.min(state.x, window.innerWidth  - W - 8);
  const y = Math.min(state.y, window.innerHeight - 120 - 8);

  return createPortal(
    <div ref={ref} style={{ position: "fixed", left: x, top: y, width: W, zIndex: 9998 }}
      className="rounded-xl border border-bg-border bg-bg-card shadow-2xl py-1 overflow-hidden">
      {[
        { icon: isFav ? "★" : "☆", label: isFav ? "お気に入りから削除" : "お気に入りに追加", fn: onFav  },
        { icon: "📋",               label: "クリップボードにコピー",                          fn: onCopy },
        { icon: "🗑",               label: "表示から削除",                                    fn: onHide },
      ].map((item) => (
        <button key={item.label} type="button"
          onClick={() => { item.fn(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-base hover:bg-accent/15 transition text-left">
          <span className="w-4 text-center shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ── ThumbCard ──────────────────────────────────────────────────────────────

function ThumbCard({
  image, selected, isFav,
  onSelect, onDoubleClick, onHover, onHoverEnd, onContextMenu, onToggleFav, onEnlarge,
}: {
  image: ExplorerImage; selected: boolean; isFav: boolean;
  onSelect: () => void; onDoubleClick: () => void;
  onHover: (r: DOMRect) => void; onHoverEnd: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleFav: () => void; onEnlarge: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} role="button" tabIndex={0}
      onClick={onSelect} onDoubleClick={onDoubleClick}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onMouseEnter={() => ref.current && onHover(ref.current.getBoundingClientRect())}
      onMouseLeave={onHoverEnd} onContextMenu={onContextMenu}
      className={[
        "flex flex-col rounded-xl overflow-hidden cursor-pointer select-none transition-all group",
        selected
          ? "ring-[3px] ring-accent shadow-[0_0_0_1px_rgba(124,92,255,0.3),0_0_10px_3px_rgba(124,92,255,0.22)] bg-accent/8"
          : "ring-1 ring-white/10 hover:ring-accent/50 hover:shadow-md",
      ].join(" ")}
    >
      <div className="relative aspect-square overflow-hidden bg-bg-panel/40">
        <img src={image.objectUrl} alt={image.name} title={image.name}
          className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-[1.04]" loading="lazy" />

        {/* ★ お気に入りトグル（お気に入り時は常時、それ以外はホバー時表示） */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          title={isFav ? "お気に入りから削除" : "お気に入りに追加"}
          className={[
            "absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold transition backdrop-blur-sm",
            isFav
              ? "bg-amber-400/90 text-amber-900 opacity-100"
              : "bg-black/55 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-amber-200",
          ].join(" ")}
        >
          {isFav ? "★" : "☆"}
        </button>

        {/* 🔍 拡大（ホバー時のみ・左上） */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEnlarge(); }}
          title="拡大して固定表示"
          className="absolute top-1 left-1 w-5 h-5 rounded-md flex items-center justify-center text-[10px] bg-black/55 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white transition backdrop-blur-sm"
        >
          🔍
        </button>

        {selected && (
          <div className="absolute bottom-0 left-0 right-0 bg-accent/85 text-white text-[11px] font-bold text-center py-0.5 tracking-wider">使用中</div>
        )}
      </div>
      <div
        className={[
          "px-1.5 py-1 text-[11px] truncate text-center leading-tight transition-colors",
          selected ? "bg-accent/15 text-accent/80 font-medium" : "bg-bg-card/70 text-text-muted group-hover:text-text-base",
        ].join(" ")}
        title={image.name}
      >{image.name}</div>
    </div>
  );
}

// ── TreeItem (recursive) ───────────────────────────────────────────────────

function TreeItem({
  handle, pathHandles, depth, ctx,
}: {
  handle: FileSystemDirectoryHandle;
  pathHandles: FileSystemDirectoryHandle[];
  depth: number;
  ctx: TreeCtx;
}) {
  const itemPK     = pk(pathHandles);
  const isExpanded = ctx.expandedSet.has(itemPK);
  const isSelected = itemPK === ctx.currentNavPK;
  const children   = ctx.childrenMap.get(itemPK);
  const isLoading  = ctx.loadingSet.has(itemPK);
  const hasChildren = children === undefined || children.length > 0;

  const handleTriangle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded && children === undefined) await ctx.onExpand(handle, itemPK);
    ctx.onToggle(itemPK);
  };

  return (
    <>
      <div
        style={{ paddingLeft: 4 + depth * 14 }}
        className={[
          "flex items-center h-[30px] gap-0.5 cursor-pointer rounded-sm transition-colors select-none pr-2",
          isSelected ? "bg-accent/20 text-text-base" : "text-text-muted hover:bg-white/[0.06] hover:text-text-base",
        ].join(" ")}
        onClick={() => ctx.onNavigate(handle, pathHandles)}
      >
        <button
          type="button"
          onClick={(e) => void handleTriangle(e)}
          className="w-5 h-5 flex items-center justify-center text-[9px] shrink-0 opacity-50 hover:opacity-100 rounded"
        >
          {isLoading ? (
            <span className="animate-spin text-[8px]">○</span>
          ) : hasChildren ? (
            isExpanded ? "▼" : "▶"
          ) : null}
        </button>
        <span className="text-[13px] shrink-0 w-5 text-center">
          {isExpanded ? "📂" : "📁"}
        </span>
        <span className={["text-[13px] truncate", isSelected ? "font-semibold" : ""].join(" ")}>
          {handle.name}
        </span>
      </div>

      {isExpanded && children && children.map((child) => (
        <TreeItem
          key={child.name}
          handle={child.handle}
          pathHandles={[...pathHandles, child.handle]}
          depth={depth + 1}
          ctx={ctx}
        />
      ))}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MiniExplorer({ onSelectImage, onClose, open, onOpen, width, onResize }: Props) {
  // ── Core navigation state ────────────────────────────────────────────
  const [rootHandle,  setRootHandle]  = useState<FileSystemDirectoryHandle | null>(null);
  const [navHistory,  setNavHistory]  = useState<NavEntry[]>([]);
  const [navIndex,    setNavIndex]    = useState(-1);

  const currentNav    = navIndex >= 0 ? navHistory[navIndex] : null;
  const currentHandle = currentNav?.handle ?? null;
  const currentPathPK = currentNav ? pk(currentNav.pathHandles) : "";

  // ── Tree state ───────────────────────────────────────────────────────
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Map<string, ExplorerSubfolder[]>>(new Map());
  const [loadingSet,  setLoadingSet]  = useState<Set<string>>(new Set());

  // ── Image grid state ─────────────────────────────────────────────────
  const [images,    setImages]    = useState<ExplorerImage[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<ExplorerFavorite[]>([]);
  const [favNames,  setFavNames]  = useState<Set<string>>(new Set());

  // ── UI state ─────────────────────────────────────────────────────────
  const [recents,   setRecents]   = useState<RecentFolder[]>([]);
  const [sort,      setSort]      = useState<SortKey>("name");
  const [thumbMode, setThumbMode] = useState<ThumbMode>(
    () => (localStorage.getItem(THUMB_MODE_KEY) as ThumbMode) ?? "md",
  );
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [hover,        setHover]        = useState<HoverState | null>(null);
  const [pinned,       setPinned]       = useState<PinnedState | null>(null);
  const [ctxMenu,      setCtxMenu]      = useState<CtxMenu | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [selecting,    setSelecting]    = useState(false);
  const [showSort,     setShowSort]     = useState(false);
  const [query,        setQuery]        = useState("");      // ファイル名検索
  const [favOnly,      setFavOnly]      = useState(false);   // お気に入りのみ
  const [croppedList,  setCroppedList]  = useState<CroppedImageRecord[]>([]); // ✂ トリミング画像（クイックアクセス直下）

  const sortRef     = useRef<HTMLDivElement>(null);
  const showTimer   = useRef<ReturnType<typeof setTimeout> | null>(null); // delay before showing hover
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null); // delay before hiding hover
  const explorerRef = useRef<HTMLElement>(null);
  const fsaOk       = isFSASupported();

  const folderName = currentHandle?.name ?? "";
  const folderPath = (currentNav?.pathHandles ?? []).map((h) => h.name).join("/");

  // ── Hover helpers ────────────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);

  /** Mouse enters a thumbnail — schedule showing the large preview after 90ms */
  const startHover = useCallback((image: ExplorerImage) => {
    clearAllTimers();
    if (pinned) return; // pinned takes over; don't show hover
    showTimer.current = setTimeout(() => {
      showTimer.current = null;
      const explorerRight = explorerRef.current?.getBoundingClientRect().right ?? 500;
      setHover({ image, explorerRight });
    }, 90);
  }, [pinned, clearAllTimers]);

  /** Mouse leaves thumbnail or preview — schedule clearing after 200ms */
  const scheduleHoverClear = useCallback(() => {
    clearAllTimers();
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      setHover(null);
    }, 200);
  }, [clearAllTimers]);

  const cancelHoverClear = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);

  // ── Drag-resize ──────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => onResize(Math.min(900, Math.max(360, startW + (ev.clientX - startX))));
    const onUp   = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [width, onResize]);

  // ── Sort dropdown close-on-outside-click ─────────────────────────────
  useEffect(() => {
    if (!showSort) return;
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showSort]);

  // ── Mount: restore saved handles ─────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const favs = await listExplorerFavorites();
      setFavorites(favs);
      setFavNames(new Set(favs.map((f) => f.name)));

      try {
        await resetRecentDatesOnce(); // 機能導入前の既存フォルダを一度だけ undated 化（OS名表示に戻す）
      } catch { /* idb エラー時も下の recents/root 復元を止めない */ }
      const recent = await loadRecentFolders();
      setRecents(recent);

      const saved = await loadRootHandle();
      if (!saved) return;
      try {
        const opts: FileSystemHandlePermissionDescriptor = { mode: "read" };
        if ((await saved.queryPermission(opts)) !== "granted") return;
        await initRoot(saved, false);
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Explorer が閉じられたときにプレビュー/メニューをクリアする
  useEffect(() => {
    if (!open) {
      clearAllTimers();
      setHover(null);
      setPinned(null);
      setCtxMenu(null);
    }
  }, [open, clearAllTimers]);

  // ✂ トリミング画像一覧：マウント時に初回取得＋以後は保存/削除のたびにイベントで即時反映
  // （パネルの開閉に依存しない＝開きっぱなしのままトリミング保存しても即座に一覧へ出る）
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void listCroppedImages().then((list) => { if (!cancelled) setCroppedList(list); }); };
    refresh();
    croppedImagesChanged.addEventListener("change", refresh);
    return () => { cancelled = true; croppedImagesChanged.removeEventListener("change", refresh); };
  }, []);

  // ── Load images ──────────────────────────────────────────────────────
  const loadImages = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setHiddenIds(new Set());
    clearAllTimers();
    setHover(null);
    setPinned(null);
    try {
      const imgs = await readImagesFromDir(handle);
      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.objectUrl));
        return imgs;
      });
    } finally {
      setLoading(false);
    }
  }, [clearAllTimers]);

  // ── Init root ────────────────────────────────────────────────────────
  const initRoot = useCallback(async (handle: FileSystemDirectoryHandle, triggerPick = true) => {
    if (triggerPick) {
      await saveRootHandle(handle);
      await saveRecentFolder(handle);
      setRecents(await loadRecentFolders());
    }
    setRootHandle(handle);
    setSelectedId(null);
    setSelectedName(null);

    const rootPK   = pk([handle]);
    const children = await readSubfolders(handle);
    setChildrenMap(new Map([[rootPK, children]]));
    setExpandedSet(new Set([rootPK]));

    const entry: NavEntry = { handle, pathHandles: [handle] };
    setNavHistory([entry]);
    setNavIndex(0);
    await loadImages(handle);
  }, [loadImages]);

  // ── Pick folder ──────────────────────────────────────────────────────
  const handlePickFolder = useCallback(async () => {
    if (!fsaOk) { alert("Chrome または Edge が必要です。"); return; }
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      await initRoot(handle, true);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") console.error(err);
    }
  }, [fsaOk, initRoot]);

  const handleOpenRecent = useCallback(async (handle: FileSystemDirectoryHandle) => {
    try {
      const ok = await verifyPermission(handle);
      if (!ok) return;
      // 既存フォルダを開くだけでは日付を付けない（＝無視・OS名のまま）。日付は新規追加時のみ。
      await initRoot(handle, false);
    } catch { /* ignore */ }
  }, [initRoot]);

  // アンマウント時に残存 objectURL を全解放
  useEffect(() => {
    return () => {
      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.objectUrl));
        return prev;
      });
    };
  }, []);

  // ── Navigate ─────────────────────────────────────────────────────────
  const navigateTo = useCallback((handle: FileSystemDirectoryHandle, pathHandles: FileSystemDirectoryHandle[]) => {
    const entry: NavEntry = { handle, pathHandles };
    setNavHistory((prev) => {
      const trimmed = [...prev.slice(0, navIndex + 1), entry];
      setNavIndex(trimmed.length - 1);
      return trimmed;
    });
    // フォルダ移動時は選択状態をリセット（initRoot と整合。別フォルダの同ID画像の誤選択を防ぐ）
    setSelectedId(null);
    setSelectedName(null);
    void loadImages(handle);
  }, [navIndex, loadImages]);

  const up = useCallback(() => { if (!currentNav || currentNav.pathHandles.length <= 1) return; const p = currentNav.pathHandles.slice(0, -1); navigateTo(p[p.length - 1], p); }, [currentNav, navigateTo]);

  // ── Tree expand ──────────────────────────────────────────────────────
  const onExpand = useCallback(async (handle: FileSystemDirectoryHandle, pathKey: string) => {
    setLoadingSet((prev) => new Set(prev).add(pathKey));
    try {
      const ok = await verifyPermission(handle);
      if (!ok) return;
      const children = await readSubfolders(handle);
      setChildrenMap((prev) => new Map(prev).set(pathKey, children));
    } finally {
      setLoadingSet((prev) => { const s = new Set(prev); s.delete(pathKey); return s; });
    }
  }, []);

  const onToggle = useCallback((pathKey: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey); else next.add(pathKey);
      return next;
    });
  }, []);

  // ── Select image ─────────────────────────────────────────────────────
  const handleSelect = useCallback(async (img: ExplorerImage) => {
    setSelecting(true);
    try {
      const dataUrl = await fileHandleToDataUrl(img.fileHandle);
      setSelectedId(img.id);
      setSelectedName(img.name);
      onSelectImage(dataUrl);
    } catch (err) { console.error(err); }
    finally { setSelecting(false); }
  }, [onSelectImage]);

  // ✂ トリミング画像：クリックで即座に元画像エリアへ反映（フォルダー参照画像と同じ扱い）
  const handleSelectCropped = useCallback((record: CroppedImageRecord) => {
    onSelectImage(record.dataUrl);
  }, [onSelectImage]);

  /** ✂ トリミング画像を1件削除（一覧からも即座に外す） */
  const handleRemoveCropped = useCallback(async (id: string) => {
    await removeCroppedImage(id);
    setCroppedList((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** ✂ トリミング画像の★お気に入りを切り替え（上限50件prune保護のON/OFF）。一覧にも即座に反映。 */
  const handleToggleCroppedFavorite = useCallback(async (id: string) => {
    await toggleCroppedFavorite(id);
    setCroppedList((prev) => prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)));
  }, []);

  /** Double-click → pin the large preview (does NOT auto-select) */
  const handleDoubleClick = useCallback((img: ExplorerImage) => {
    clearAllTimers();
    setHover(null);
    const explorerRight = explorerRef.current?.getBoundingClientRect().right ?? 500;
    setPinned({ image: img, explorerRight });
  }, [clearAllTimers]);

  // ── Thumb mode ───────────────────────────────────────────────────────
  const changeThumbMode = (m: ThumbMode) => {
    setThumbMode(m);
    localStorage.setItem(THUMB_MODE_KEY, m);
  };

  // ── Favorites ────────────────────────────────────────────────────────
  const handleToggleFav = useCallback(async (img: ExplorerImage) => {
    const favKey = `${folderPath}/${img.name}`;
    if (favNames.has(favKey)) {
      const next = await removeExplorerFavorite(`img:${favKey}`);
      setFavorites(next); setFavNames(new Set(next.map((f) => f.name)));
    } else {
      const [thumb, full] = await Promise.all([
        compressToDataUrl(img.objectUrl, 160, 0.75),
        compressToDataUrl(img.objectUrl, 1024, 0.88),
      ]);
      const next = await addExplorerFavorite({
        id: `img:${favKey}`, name: favKey,
        thumbDataUrl: thumb, fullDataUrl: full, addedAt: Date.now(),
      });
      setFavorites(next); setFavNames(new Set(next.map((f) => f.name)));
    }
  }, [favNames, folderPath]);

  const handleCopy = useCallback(async (img: ExplorerImage) => {
    try {
      const file = await img.fileHandle.getFile();
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || "image/jpeg" });
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      try { await navigator.clipboard.writeText(img.objectUrl); } catch { /* noop */ }
    }
  }, []);

  // ── Display list ─────────────────────────────────────────────────────
  const displayImages = useMemo<ExplorerImage[]>(() => {
    const q = query.trim().toLowerCase();
    const list = images.filter((img) =>
      !hiddenIds.has(img.id) &&
      (!favOnly || favNames.has(`${folderPath}/${img.name}`)) &&
      (!q || img.name.toLowerCase().includes(q))
    );
    const copy = [...list];
    switch (sort) {
      case "name":   copy.sort((a, b) => a.name.localeCompare(b.name, "ja")); break;
      case "newest": copy.sort((a, b) => b.lastModified - a.lastModified);     break;
      case "oldest": copy.sort((a, b) => a.lastModified - b.lastModified);     break;
      case "fav": {
        const order = new Map(favorites.map((f, i) => [f.name, i]));
        copy.sort((a, b) => {
          const ai = order.get(`${folderPath}/${a.name}`) ?? 99999;
          const bi = order.get(`${folderPath}/${b.name}`) ?? 99999;
          return ai !== bi ? ai - bi : a.name.localeCompare(b.name, "ja");
        });
        break;
      }
    }
    return copy;
  }, [images, hiddenIds, sort, favorites, query, favOnly, favNames, folderPath]);

  // ── Derived ──────────────────────────────────────────────────────────
  const sortLabel   = SORT_OPTIONS.find((s) => s.id === sort)?.label ?? "並替";
  const canUp = (currentNav?.pathHandles.length ?? 0) > 1;
  const breadcrumbs = currentNav?.pathHandles ?? [];

  const treeCtx: TreeCtx = {
    expandedSet, childrenMap, loadingSet,
    currentNavPK: currentPathPK,
    onNavigate: navigateTo, onExpand, onToggle,
  };

  // ── Preview pin helper ────────────────────────────────────────────────
  const pinFromHover = useCallback((image: ExplorerImage) => {
    clearAllTimers();
    setHover(null);
    const explorerRight = explorerRef.current?.getBoundingClientRect().right ?? 500;
    setPinned({ image, explorerRight });
  }, [clearAllTimers]);

  const hideImage = useCallback((id: string) => {
    setHiddenIds((prev) => new Set([...prev, id]));
    setHover(null);
    setPinned(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <aside ref={explorerRef} className="hidden lg:flex flex-col sticky top-0 max-h-screen relative overflow-hidden">

      {/* ── Collapsed slim bar ───────────────────────────────────── */}
      {!open && (
        <button
          type="button"
          onClick={onOpen}
          title="Explorerを開く"
          className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl border border-bg-border/60 bg-bg-panel/40 text-text-muted/60 hover:bg-accent/10 hover:border-accent/40 hover:text-text-muted transition-colors duration-150"
        >
          <span className="text-xl">📁</span>
          <span
            className="text-[12px] font-semibold tracking-widest select-none"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            Explorer
          </span>
        </button>
      )}

      {/* ── Full explorer (open state) ────────────────────────────── */}
      {open && (<>

      {/* ── Inner content box ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 bg-bg-panel border border-bg-border rounded-2xl overflow-hidden shadow-lg">

        {/* ─── Navigation bar ──────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-bg-border bg-bg-panel/90">
          <button type="button"
            onClick={up} disabled={!canUp} title="上の階層へ"
            className="shrink-0 w-7 h-7 flex items-center justify-center text-[13px] rounded-md border border-bg-border hover:border-accent/50 hover:bg-accent/10 transition text-text-muted hover:text-text-base disabled:opacity-25 disabled:cursor-not-allowed"
          >↑</button>

          <div className="flex-1 min-w-0 mx-1 flex items-center gap-0.5 overflow-hidden">
            {breadcrumbs.length === 0 ? (
              <span className="text-[12px] text-text-muted/90 italic truncate">フォルダを選択…</span>
            ) : (
              breadcrumbs.map((h, i) => (
                <span key={i} className="flex items-center gap-0.5 min-w-0 shrink-0">
                  {i > 0 && <span className="text-text-muted/40 text-[10px]">›</span>}
                  <button type="button"
                    onClick={() => { if (i < breadcrumbs.length - 1) navigateTo(h, breadcrumbs.slice(0, i + 1)); }}
                    className={["text-[12px] truncate max-w-[120px] transition",
                      i === breadcrumbs.length - 1 ? "text-text-base font-semibold cursor-default" : "text-text-muted hover:text-accent cursor-pointer"].join(" ")}
                    title={h.name}
                  >{h.name}</button>
                </span>
              ))
            )}
          </div>

          {selecting && <span className="shrink-0 text-[11px] text-accent animate-pulse ml-1">読込</span>}
        </div>

        {/* ─── Main 2-pane area ─────────────────────────────────────── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ── Left: folder tree ───────────────────────────────────── */}
          <div className="w-[220px] shrink-0 border-r-2 border-bg-border flex flex-col overflow-hidden bg-black/25">
            <div className="shrink-0 px-2 py-1.5 border-b border-bg-border/60">
              <button type="button" onClick={handlePickFolder}
                className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] border border-bg-border hover:border-accent/60 hover:bg-accent/10 transition text-text-muted hover:text-text-base">
                <span>📂</span>
                <span className="truncate">フォルダを開く…</span>
                {!fsaOk && <span className="text-rose-400 text-[11px] ml-auto">Chrome必須</span>}
              </button>
            </div>

            {/* 上半分：クイックアクセス＋フォルダツリー（独立スクロール） */}
            <div className="flex-1 min-h-0 overflow-y-auto py-1 mx-thin-scroll">
              {recents.length > 0 && (
                <div className="mb-1">
                  <div className="px-3 py-1 text-[12px] uppercase tracking-widest text-text-muted/90 font-bold select-none">
                    📌 クイックアクセス
                  </div>
                  {recents.map((r, i) => (
                    <button key={`${r.handle.name}-${i}`} type="button"
                      onClick={() => void handleOpenRecent(r.handle)}
                      className={["w-full flex items-center gap-1.5 px-3 h-[28px] text-left text-[13px] transition-colors hover:bg-white/[0.06] select-none",
                        rootHandle?.name === r.handle.name ? "text-accent/90 font-medium" : "text-text-muted/90 hover:text-text-base"].join(" ")}
                      title={r.handle.name}>
                      <span className="shrink-0 text-[12px] rounded-sm px-[1px]" style={{ backgroundColor: monthColor(r.addedAt) }}>📁</span>
                      <span className="truncate">{formatAddedDate(r.addedAt) ?? r.handle.name}</span>
                    </button>
                  ))}
                  <div className="mx-3 mt-1 mb-0.5 border-t border-bg-border/40" />
                </div>
              )}

              {rootHandle && (
                <TreeItem handle={rootHandle} pathHandles={[rootHandle]} depth={0} ctx={treeCtx} />
              )}

              {!rootHandle && (
                <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
                  <span className="text-3xl opacity-20">🗂</span>
                  <p className="text-[13px] text-text-muted/90 leading-relaxed">
                    上のボタンでフォルダを開くと<br />ここにツリーが表示されます
                  </p>
                </div>
              )}
            </div>

            {/* 下半分：✂トリミング画像（上のフォルダ関連と混ざらないよう独立区画・独立スクロール） */}
            {croppedList.length > 0 && (
              <div className="flex-1 min-h-0 flex flex-col border-t-2 border-bg-border bg-black/15">
                <div
                  className="shrink-0 px-3 py-1.5 text-[12px] uppercase tracking-widest text-text-muted/90 font-bold select-none"
                  title="★お気に入りは上限50件のカウント・自動削除から保護されます"
                >
                  ✂ トリミング画像
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-3 content-start gap-1 px-3 pb-2 mx-thin-scroll">
                  {croppedList.map((r) => (
                    <div key={r.id} role="button" tabIndex={0}
                      onClick={() => handleSelectCropped(r)}
                      onKeyDown={(e) => e.key === "Enter" && handleSelectCropped(r)}
                      title={new Date(r.createdAt).toLocaleString("ja-JP")}
                      className="group relative aspect-square rounded-md overflow-hidden cursor-pointer select-none ring-1 ring-white/10 hover:ring-accent/50 transition"
                    >
                      <img src={r.thumb} alt="" className="w-full h-full object-cover" />
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); void handleToggleCroppedFavorite(r.id); }}
                        title={r.favorite ? "お気に入りから外す（上限50件の保護対象から外れます）" : "お気に入りに追加（上限50件を超えても消えなくなります）"}
                        className={[
                          "absolute top-0.5 left-0.5 w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-bold transition backdrop-blur-sm",
                          r.favorite
                            ? "bg-amber-400/90 text-amber-900 opacity-100"
                            : "bg-black/60 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-amber-200",
                        ].join(" ")}
                      >
                        {r.favorite ? "★" : "☆"}
                      </button>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); void handleRemoveCropped(r.id); }}
                        title="削除"
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-sm flex items-center justify-center text-[10px] bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-rose-500/80 hover:text-white transition backdrop-blur-sm"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: image grid ───────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Controls row */}
            <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 border-b border-bg-border/60 bg-bg-panel/20">
              <div className="relative" ref={sortRef}>
                <button type="button" onClick={() => setShowSort((v) => !v)}
                  className="h-6 px-2 text-[12px] rounded-md border border-bg-border hover:border-accent/50 bg-bg-panel/60 text-text-muted/90 hover:text-text-base transition flex items-center gap-0.5">
                  <span className="max-w-[56px] truncate">{sortLabel}</span>
                  <span className="text-[8px] opacity-50">▾</span>
                </button>
                {showSort && (
                  <div className="absolute left-0 top-full mt-1 w-40 rounded-xl border border-bg-border bg-bg-card shadow-2xl z-50 py-1 overflow-hidden">
                    {SORT_OPTIONS.map((s) => (
                      <button key={s.id} type="button"
                        onClick={() => { setSort(s.id); setShowSort(false); }}
                        className={["w-full text-left px-3 py-1.5 text-[12px] hover:bg-accent/15 transition",
                          sort === s.id ? "text-accent font-semibold" : "text-text-muted/85 hover:text-text-base"].join(" ")}
                      >{s.label}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex rounded-md overflow-hidden border border-bg-border">
                {(["sm", "md", "lg"] as ThumbMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => changeThumbMode(m)}
                    title={{ sm: "小アイコン", md: "中アイコン", lg: "大アイコン" }[m]}
                    className={["w-7 h-6 flex items-center justify-center text-[12px] font-semibold transition",
                      thumbMode === m ? "bg-accent/25 text-accent" : "text-text-muted hover:bg-bg-border/60"].join(" ")}
                  >{{ sm: "S", md: "M", lg: "L" }[m]}</button>
                ))}
              </div>

              {/* 検索 */}
              <div className="relative flex-1 min-w-[80px]">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted/50 pointer-events-none">🔍</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="画像名で検索"
                  className="w-full h-6 pl-5 pr-2 rounded-md border border-bg-border bg-bg-base text-[12px] text-text-base placeholder:text-text-muted/45 outline-none focus:border-accent/55 transition"
                />
              </div>

              {/* お気に入りのみ */}
              <button type="button" onClick={() => setFavOnly((v) => !v)}
                title="お気に入りのみ表示"
                className={["shrink-0 h-6 px-2 rounded-md border text-[12px] transition leading-none",
                  favOnly ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-bg-border text-text-muted/70 hover:text-amber-200 hover:border-amber-400/40"].join(" ")}
              >★</button>

              {/* Pinned indicator in toolbar */}
              {pinned && (
                <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-violet-400/10 border border-violet-400/25">
                  <span className="text-[12px] text-violet-300/85 truncate max-w-[72px]">
                    📌 {pinned.image.name}
                  </span>
                  <button type="button" onClick={() => setPinned(null)}
                    className="text-[10px] text-text-muted/40 hover:text-rose-300 transition leading-none">×</button>
                </div>
              )}

              <span className="ml-auto text-[12px] text-text-muted/90">
                {loading ? "読込中…" : `${displayImages.length} 枚`}
              </span>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto min-w-0 mx-thin-scroll">
              {loading ? (
                <div className="flex items-center justify-center h-24">
                  <span className="text-[13px] text-text-muted animate-pulse">読み込み中…</span>
                </div>
              ) : !currentHandle ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                  <span className="text-5xl opacity-15">🗂</span>
                  <p className="text-sm text-text-muted">左のツリーでフォルダを選択してください</p>
                </div>
              ) : displayImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 px-4 gap-1">
                  <p className="text-[13px] text-text-muted/85">
                    {query.trim() || favOnly ? "条件に一致する画像がありません" : "このフォルダに画像はありません"}
                  </p>
                  {(query.trim() || favOnly) && (
                    <button type="button" onClick={() => { setQuery(""); setFavOnly(false); }}
                      className="text-[11px] text-accent/80 hover:text-accent underline">
                      絞り込みを解除
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2.5" style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_MINW[thumbMode]}px, 1fr))`,
                  gap: "9px",
                }}>
                  {displayImages.map((img) => (
                    <ThumbCard
                      key={img.id}
                      image={img}
                      selected={selectedId === img.id}
                      isFav={favNames.has(`${folderPath}/${img.name}`)}
                      onSelect={() => void handleSelect(img)}
                      onDoubleClick={() => handleDoubleClick(img)}
                      onHover={() => startHover(img)}
                      onHoverEnd={scheduleHoverClear}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCtxMenu({ x: e.clientX, y: e.clientY, image: img });
                      }}
                      onToggleFav={() => void handleToggleFav(img)}
                      onEnlarge={() => handleDoubleClick(img)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Status bar ───────────────────────────────────────────── */}
        <div className="shrink-0 px-3 py-1 border-t border-bg-border bg-bg-panel/50 flex items-center gap-2 text-[12px] text-text-muted/90">
          {selectedName ? (
            <><span className="text-accent/70 truncate max-w-[180px]" title={selectedName}>✓ {selectedName}</span><span className="opacity-40">·</span></>
          ) : null}
          <span>{loading ? "読み込み中…" : `${displayImages.length} 枚`}</span>
          {hiddenIds.size > 0 && <span className="opacity-50">({hiddenIds.size} 非表示)</span>}
          <span className="ml-auto opacity-40">{thumbMode.toUpperCase()} · {sortLabel}</span>
          {pinned && <span className="text-violet-400/50">· 📌 固定中</span>}
        </div>
      </div>

      {/* ── Resize handle ───────────────────────────────────────────── */}
      <div
        className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-20 flex items-center justify-center group"
        onMouseDown={handleResizeStart}
        title="ドラッグで幅を調整"
      >
        <div className="w-px h-16 rounded-full bg-bg-border group-hover:bg-accent/70 group-active:bg-accent transition-colors" />
      </div>

      {/* ── Portals ─────────────────────────────────────────────────── */}

      {/* Hover preview — suppressed when pinned is active */}
      {hover && !pinned && (
        <LargePreview
          state={hover}
          folderName={folderName}
          isFav={favNames.has(`${folderPath}/${hover.image.name}`)}
          isPinned={false}
          onSelect={() => void handleSelect(hover.image)}
          onSelectAndClose={() => { void handleSelect(hover.image); onClose?.(); }}
          onFav={() => void handleToggleFav(hover.image)}
          onHide={() => hideImage(hover.image.id)}
          onPin={() => pinFromHover(hover.image)}
          onMouseEnter={cancelHoverClear}
          onMouseLeave={scheduleHoverClear}
        />
      )}

      {/* Pinned preview */}
      {pinned && (
        <LargePreview
          state={pinned}
          folderName={folderName}
          isFav={favNames.has(`${folderPath}/${pinned.image.name}`)}
          isPinned={true}
          onSelect={() => void handleSelect(pinned.image)}
          onSelectAndClose={() => { void handleSelect(pinned.image); onClose?.(); }}
          onFav={() => void handleToggleFav(pinned.image)}
          onHide={() => hideImage(pinned.image.id)}
          onClose={() => setPinned(null)}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          state={ctxMenu}
          isFav={favNames.has(`${folderPath}/${ctxMenu.image.name}`)}
          onFav={() => void handleToggleFav(ctxMenu.image)}
          onCopy={() => void handleCopy(ctxMenu.image)}
          onHide={() => hideImage(ctxMenu.image.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}
      </>)}
    </aside>
  );
}
