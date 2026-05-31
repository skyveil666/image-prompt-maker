import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptHistoryItem } from "../types";
import { makeThumbnail } from "../lib/imageThumb";
import { FavoriteButton } from "./FavoriteButton";

interface Props {
  item: PromptHistoryItem;
  onUpdate: (id: string, patch: Partial<PromptHistoryItem>) => void;
  onArrange?: (item: PromptHistoryItem) => void;
}

// ─── Per-proposal accent palette (index 0 = 案1) ─────────────────────────────

const PROPOSAL_PALETTE = [
  {
    card:    "border-violet-400/35 from-violet-500/10 to-violet-500/3",
    header:  "border-b border-violet-400/20 bg-violet-500/8",
    badge:   "text-violet-200 border-violet-400/50 bg-violet-500/15",
    title:   "text-violet-200",
    glow:    "hover:shadow-[0_12px_36px_rgba(139,92,246,0.18)]",
  },
  {
    card:    "border-blue-400/35 from-blue-500/10 to-blue-500/3",
    header:  "border-b border-blue-400/20 bg-blue-500/8",
    badge:   "text-blue-200 border-blue-400/50 bg-blue-500/15",
    title:   "text-blue-200",
    glow:    "hover:shadow-[0_12px_36px_rgba(59,130,246,0.18)]",
  },
  {
    card:    "border-emerald-400/35 from-emerald-500/10 to-emerald-500/3",
    header:  "border-b border-emerald-400/20 bg-emerald-500/8",
    badge:   "text-emerald-200 border-emerald-400/50 bg-emerald-500/15",
    title:   "text-emerald-200",
    glow:    "hover:shadow-[0_12px_36px_rgba(52,211,153,0.18)]",
  },
  {
    card:    "border-orange-400/35 from-orange-500/10 to-orange-500/3",
    header:  "border-b border-orange-400/20 bg-orange-500/8",
    badge:   "text-orange-200 border-orange-400/50 bg-orange-500/15",
    title:   "text-orange-200",
    glow:    "hover:shadow-[0_12px_36px_rgba(251,146,60,0.18)]",
  },
  {
    card:    "border-pink-400/35 from-pink-500/10 to-pink-500/3",
    header:  "border-b border-pink-400/20 bg-pink-500/8",
    badge:   "text-pink-200 border-pink-400/50 bg-pink-500/15",
    title:   "text-pink-200",
    glow:    "hover:shadow-[0_12px_36px_rgba(236,72,153,0.18)]",
  },
  {
    card:    "border-cyan-400/35 from-cyan-500/10 to-cyan-500/3",
    header:  "border-b border-cyan-400/20 bg-cyan-500/8",
    badge:   "text-cyan-200 border-cyan-400/50 bg-cyan-500/15",
    title:   "text-cyan-200",
    glow:    "hover:shadow-[0_12px_36px_rgba(34,211,238,0.18)]",
  },
];

function paletteFor(proposalIndex: number) {
  return PROPOSAL_PALETTE[(proposalIndex - 1) % PROPOSAL_PALETTE.length];
}

const TARGET_BADGE: Record<PromptHistoryItem["outputType"], string> = {
  unified:       "統一プロンプト",
  nano_gemini:   "Nano Banana 案（旧）",
  chatgpt_image: "ChatGPT 案（旧）",
};

const LONG_THRESHOLD_LINES = 10;
const LONG_THRESHOLD_CHARS  = 480;

// ─── GeneratedResultSlot ──────────────────────────────────────────────────────

interface SlotProps {
  resultImageUrl: string | null;
  sourceImageUrl: string | null;
  onImage: (dataUrl: string) => void;
  onRemove: () => void;
}

function GeneratedResultSlot({ resultImageUrl, sourceImageUrl, onImage, onRemove }: SlotProps) {
  const slotRef      = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // stable ref — prevents stale closure in paste listener
  const onImageRef = useRef(onImage);
  useEffect(() => { onImageRef.current = onImage; }, [onImage]);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target!.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    try {
      const thumb = await makeThumbnail(dataUrl, 600, 0.83);
      onImageRef.current(thumb);
    } catch {
      onImageRef.current(dataUrl);
    }
  }, []);

  // Clipboard paste — only fires when this slot (tabIndex=0) has focus
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!slotRef.current) return;
      const active = document.activeElement;
      if (active !== slotRef.current && !slotRef.current.contains(active as Node)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) { e.preventDefault(); void processFile(file); return; }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [processFile]);

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = "";
  };
  const openPicker = () => fileInputRef.current?.click();

  // ── Filled state ──────────────────────────────────────────────────────
  if (resultImageUrl) {
    return (
      <div className="px-4 py-2.5 border-b border-bg-border/50 bg-black/15">
        <div className="flex items-center gap-3">
          {/* 元画像サムネイル */}
          {sourceImageUrl ? (
            <img
              src={sourceImageUrl}
              alt="元画像"
              className="w-14 h-14 rounded-lg object-cover border border-bg-border flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-bg-panel border border-bg-border flex items-center justify-center text-[11px] text-text-muted/75 text-center leading-tight flex-shrink-0">
              元画像<br />なし
            </div>
          )}
          {/* チェーン矢印 */}
          <div className="flex flex-col items-center flex-shrink-0 gap-0.5">
            <span className="text-[12px] text-text-muted/75 leading-none">→</span>
            <span className="text-[11px] text-emerald-400/80 leading-none font-semibold">生成</span>
          </div>
          {/* 生成結果画像 */}
          <img
            src={resultImageUrl}
            alt="生成結果"
            className="w-14 h-14 rounded-lg object-cover border border-emerald-400/50 shadow-[0_0_8px_rgba(52,211,153,0.2)] flex-shrink-0"
          />
          {/* ラベル＋操作ボタン */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <span className="text-[13px] text-emerald-300/90 font-medium leading-none">
              ✅ 生成結果登録済み
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={openPicker}
                className="text-[12px] px-2 py-1 rounded-lg border border-bg-border bg-bg-panel/60 text-text-muted hover:text-text-base hover:border-accent/40 transition"
              >
                🔄 変更
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="text-[12px] px-2 py-1 rounded-lg border border-rose-400/30 bg-transparent text-rose-300/60 hover:text-rose-200 hover:border-rose-400/50 hover:bg-rose-400/8 transition"
              >
                ✕ 削除
              </button>
            </div>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────
  return (
    <div
      ref={slotRef}
      tabIndex={0}
      role="button"
      aria-label="生成結果画像を登録（D&D / Ctrl+V / クリック）"
      onClick={openPicker}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        "mx-4 my-2 rounded-xl border-2 border-dashed px-4 py-2.5",
        "flex items-center justify-center gap-2",
        "cursor-pointer transition-all select-none outline-none",
        "text-[13px] text-white/75",
        isDragOver
          ? "border-accent bg-accent/10 text-white scale-[1.01]"
          : "border-bg-border/50 hover:border-accent/50 hover:bg-accent/5 hover:text-white/90 focus:border-accent/60 focus:bg-accent/6 focus:text-white/90",
      ].join(" ")}
    >
      <span className="text-sm leading-none flex-shrink-0">📎</span>
      <span>
        {isDragOver
          ? "ドロップして登録"
          : "生成結果画像をここに貼り付け（D&D / Ctrl+V / クリック）"}
      </span>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PromptCard({ item, onUpdate, onArrange }: Props) {
  const [expanded, setExpanded] = useState(false);

  /** 通常コピー済み：IndexedDB に永続保存（item.copied を直接使用） */
  const isCopied = item.copied === true;

  const pal  = paletteFor(item.proposalIndex);
  const isLocked  = item.locked === true;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.promptText);
      // DB に永続保存
      if (!isCopied) onUpdate(item.id, { copied: true });
    } catch {
      // clipboard API 失敗時のフォールバック
      window.prompt("コピーできませんでした。手動でコピーしてください：", item.promptText);
    }
  };

  const isLong =
    item.promptText.split(/\n/).length > LONG_THRESHOLD_LINES ||
    item.promptText.length > LONG_THRESHOLD_CHARS;

  const handleResultImage = useCallback((dataUrl: string) => {
    onUpdate(item.id, { resultImageData: dataUrl, generatedResultAddedAt: Date.now() });
  }, [item.id, onUpdate]);

  const handleResultRemove = useCallback(() => {
    onUpdate(item.id, { resultImageData: null });
  }, [item.id, onUpdate]);

  return (
    <article
      className={[
        "rounded-2xl border bg-gradient-to-br shadow-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5",
        // 固定中はアンバーの強調枠
        isLocked
          ? "border-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
          : pal.card,
        pal.glow,
      ].join(" ")}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className={[
          "px-5 py-3.5 flex items-center justify-between gap-4",
          isLocked ? "border-b border-amber-400/25 bg-amber-500/6" : pal.header,
        ].join(" ")}
      >
        {/* 案番号 + タイトル */}
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={[
              "inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-xl flex-shrink-0 border",
              isLocked ? "text-amber-200 border-amber-400/60 bg-amber-500/18" : pal.badge,
            ].join(" ")}
          >
            {item.proposalIndex}
          </span>
          <div className="min-w-0">
            <div className={`text-[20px] font-bold leading-tight ${isLocked ? "text-amber-100" : pal.title}`}>
              案 {item.proposalIndex}
              {isLocked && <span className="ml-2 text-[13px] text-amber-300/80">🔒 固定中</span>}
            </div>
            <div className="text-[13px] font-medium text-white/85 truncate mt-0.5">
              {TARGET_BADGE[item.outputType]}
              {item.presetName && (
                <span className="ml-2 normal-case text-accent/70">#{item.presetName}</span>
              )}
            </div>
          </div>
        </div>

        {/* アクションボタン群 */}
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {/* 🔒 固定 */}
          <button
            type="button"
            onClick={() => onUpdate(item.id, { locked: !isLocked })}
            title={isLocked ? "固定を解除する" : "この案を固定（アレンジのベースに使う）"}
            className={[
              "rounded-lg px-2.5 py-1.5 text-[13px] font-semibold border transition",
              isLocked
                ? "border-amber-400/70 bg-amber-400/18 text-amber-100 shadow-[0_0_8px_rgba(251,191,36,0.25)]"
                : "border-text-muted/25 bg-transparent text-text-muted/75 hover:border-amber-400/50 hover:text-amber-200 hover:bg-amber-400/8",
            ].join(" ")}
          >
            {isLocked ? "🔓 解除" : "🔒 固定"}
          </button>

          {/* ⭐ お気に入り */}
          <FavoriteButton
            active={item.isFavorite}
            onToggle={() => onUpdate(item.id, { isFavorite: !item.isFavorite })}
          />

          {/* 📋 コピー */}
          <button
            type="button"
            onClick={copy}
            title={isCopied ? "再コピー" : undefined}
            className={[
              "group inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold border transition-all duration-200",
              isCopied
                ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                : "border-sky-400/40 bg-gradient-to-r from-sky-500/15 to-blue-500/10 text-sky-100 hover:from-sky-500/25 hover:to-blue-500/20 hover:border-sky-400/70",
            ].join(" ")}
          >
            {isCopied ? (
              <>
                <span className="text-sm leading-none group-hover:hidden">✅</span>
                <span className="group-hover:hidden">コピー済み</span>
                <span className="hidden group-hover:inline text-sm leading-none">🔄</span>
                <span className="hidden group-hover:inline">再コピー</span>
              </>
            ) : (
              <><span className="text-sm leading-none">📋</span><span>コピー</span></>
            )}
          </button>
        </div>
      </header>

      {/* ── 生成結果スロット ────────────────────────────────────────────────── */}
      <GeneratedResultSlot
        resultImageUrl={item.resultImageData}
        sourceImageUrl={item.sourceImageThumbnail}
        onImage={handleResultImage}
        onRemove={handleResultRemove}
      />

      {/* ── 本文 ───────────────────────────────────────────────────────────── */}
      <div className="relative">
        <pre
          className={[
            "m-0 px-5 py-5 bg-[#0c0f15] text-[14px] font-mono whitespace-pre-wrap break-words border-b border-bg-border transition-all duration-300",
            isLong && !expanded ? "max-h-[280px] overflow-hidden" : "",
          ].join(" ")}
          style={{ lineHeight: "1.85", overflowWrap: "anywhere" }}
        >
          {item.promptText}
        </pre>
        {isLong && !expanded && (
          <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0c0f15] to-transparent pointer-events-none" />
        )}
      </div>

      {/* ── フッター ────────────────────────────────────────────────────────── */}
      {(onArrange || isLong) && (
        <div className="px-5 py-3 flex items-center gap-2 flex-wrap bg-black/20">
          {onArrange && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-violet-400/50 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 hover:border-violet-400/80 transition"
              onClick={() => onArrange(item)}
              title="このプロンプトをベースに雰囲気を継承した別案を生成"
            >
              ✨ アレンジ
            </button>
          )}
          {isLong && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-bg-border bg-bg-panel/70 text-text-muted hover:text-text-base hover:border-accent/40 transition ml-auto"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "▲ 閉じる" : "▼ 詳細を見る"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
