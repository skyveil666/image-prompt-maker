/**
 * FavoritesPanel v2 — 生成チェーン表示パネル
 *
 * 各カード：元画像 → プロンプト → 生成結果 を一目で確認。
 * 生成結果はドラッグ＆ドロップまたはクリックで後から登録可能。
 *
 * レイアウト:
 *  - lg+: 右端 440px のスライドドロワー
 *  - sm 未満: 画面下から出るフルワイドシート
 */
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptHistoryItem, Mood } from "../types";
import { getAll, updateItem, getResultImages, buildResultImagesPatch, MAX_RESULT_IMAGES } from "../lib/history";
import { fileToThumbnail } from "../lib/imageFile";
import { confirmUnfavorite } from "../lib/favoriteConfirm";
import { formatDateTime } from "../lib/format";
import { useEscapeKey } from "../lib/useEscapeKey";
import { ALL_SCOPE_LABELS as SCOPE_LABEL } from "../lib/scopeLabels";
import { WithImagePreview } from "./ImagePreviewTooltip";

// Scope→ラベルは scopeLabels.ts に一本化（SCOPE_LABEL は別名 import）。

const MOOD_LABEL: Partial<Record<Mood, string>> = {
  sns_pop: "SNS映え", cool: "クール", dark: "ダーク",
  cyberpunk: "サイバー", fantasy: "幻想的", cinematic: "映画風",
  vivid: "鮮やか", retro: "レトロ", gothic: "ゴシック",
  mystic: "神秘的", luxe: "高級感", art: "アート",
  bright: "明るい", pop: "ポップ", cute: "かわいい",
  japanese: "和風", street: "ストリート", stylish: "スタイリッシュ",
  monochrome: "モノクロ", pastel: "パステル",
};

const OUTPUT_LABEL: Record<PromptHistoryItem["outputType"], string> = {
  unified:       "統一",
  nano_gemini:   "Nano",
  chatgpt_image: "ChatGPT",
};

// ── ヘルパー ──────────────────────────────────────────────────────────────────

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onArrange: (item: PromptHistoryItem) => void;
  /** 生成結果を元画像として使用するコールバック */
  onUseAsSource: (imageDataUrl: string) => void;
}

// ── 比較モーダル ──────────────────────────────────────────────────────────────

function CompareModal({
  item,
  onClose,
}: {
  item: PromptHistoryItem | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // アイテムが変わったらコピー状態リセット
  useEffect(() => { setCopied(false); }, [item]);

  useEscapeKey(onClose, !!item);

  const copyPrompt = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.promptText);
      setCopied(true);
    } catch { /* noop */ }
  };

  if (!item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/92 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-base font-bold text-text-base">
              {OUTPUT_LABEL[item.outputType]} 案{item.proposalIndex}
            </span>
            {item.derivedFromId && (
              <span className="text-xs px-2 py-1 rounded-lg border border-violet-400/50 bg-violet-500/15 text-violet-100 flex items-center gap-1">
                ✨ アレンジ保存
                {item.arrangeCaseNumber && <span className="opacity-75">（案{item.arrangeCaseNumber}）</span>}
              </span>
            )}
            {item.derivedFromDate && (
              <span className="text-xs text-violet-200/60">
                元：{formatDateTime(item.derivedFromDate)}
              </span>
            )}
            {item.presetName && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-accent/40 bg-accent/12 text-accent/90">
                {item.presetName}
              </span>
            )}
            <span className="text-[13px] font-semibold text-white/90">{formatDateTime(item.createdAt)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-bg-border text-text-muted hover:text-text-base hover:border-accent/50 transition"
            title="閉じる (Esc)"
          >
            ✕
          </button>
        </div>

        {/* アレンジ保存情報 */}
        {item.derivedFromId && (
          <div className="rounded-xl border border-violet-400/30 bg-violet-500/8 px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-violet-100">✨ アレンジ保存の詳細</span>
              {item.arrangeCaseNumber && (
                <span className="text-[11px] text-violet-200/70">案 {item.arrangeCaseNumber}</span>
              )}
              {item.derivedFromDate && (
                <span className="text-[11px] text-violet-200/55">元：{formatDateTime(item.derivedFromDate)}</span>
              )}
            </div>
            {(item.arrangeUsedScopes ?? []).length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-emerald-300/70 font-semibold">使用：</span>
                {(item.arrangeUsedScopes ?? []).map((s) => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-400/40 bg-violet-400/12 text-violet-200/85 leading-none">
                    {SCOPE_LABEL[s] ?? s}
                  </span>
                ))}
              </div>
            )}
            {(item.arrangeExcludedScopes ?? []).length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-rose-300/60 font-semibold">除外：</span>
                {(item.arrangeExcludedScopes ?? []).map((s) => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/3 text-text-muted/50 leading-none">
                    {SCOPE_LABEL[s] ?? s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 画像比較 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 左：元画像 */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-text-muted/70 text-center uppercase tracking-wide">
              {item.derivedFromId ? "アレンジ元画像" : "元画像"}
            </p>
            {item.sourceImageThumbnail ? (
              <img
                src={item.sourceImageThumbnail}
                alt="元画像"
                className="w-full rounded-2xl object-contain max-h-[65vh] bg-black/60 border border-bg-border"
              />
            ) : (
              <div className="aspect-square rounded-2xl bg-bg-panel/60 border border-bg-border flex items-center justify-center text-text-muted/40">
                画像なし
              </div>
            )}
          </div>

          {/* 右：生成結果（最大3枚） */}
          <div className="space-y-2">
            {(() => {
              const imgs = getResultImages(item);
              const total = imgs.length;
              return (
                <>
                  <p className="text-[11px] font-semibold text-text-muted/70 text-center uppercase tracking-wide">
                    生成結果 {total > 0 && <span className="text-text-muted/50">（{total}枚）</span>}
                  </p>
                  {total === 0 ? (
                    <div className="aspect-square rounded-2xl bg-bg-panel/60 border border-bg-border border-dashed flex flex-col items-center justify-center gap-2 text-text-muted/40">
                      <span className="text-2xl">🖼</span>
                      <span className="text-xs">未登録</span>
                    </div>
                  ) : total === 1 ? (
                    <img
                      src={imgs[0]}
                      alt="生成結果"
                      className="w-full rounded-2xl object-contain max-h-[65vh] bg-black/60 border border-bg-border"
                    />
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[65vh] overflow-y-auto">
                      {imgs.map((url, i) => (
                        <div key={`${i}-${url}`} className="relative">
                          <img
                            src={url}
                            alt={`生成結果 ${i + 1}`}
                            className="w-full rounded-2xl object-contain max-h-[40vh] bg-black/60 border border-bg-border"
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-emerald-200 text-[11px] font-bold leading-none">
                            {i + 1} / {total}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* プロンプトプレビュー */}
        <div className="rounded-2xl border border-bg-border bg-[#0c0f15]/90 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-text-muted/45 font-semibold">
              プロンプト
            </span>
            <button
              type="button"
              onClick={copyPrompt}
              className={[
                "group/cmod text-[11px] px-2.5 py-1 rounded-lg border transition",
                copied
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : "border-sky-400/30 bg-sky-400/6 text-sky-300/70 hover:border-sky-400/55 hover:bg-sky-400/12",
              ].join(" ")}
            >
              {copied ? (
                <>
                  <span className="group-hover/cmod:hidden">✅ コピー済み</span>
                  <span className="hidden group-hover/cmod:inline">🔄 再コピー</span>
                </>
              ) : "📋 プロンプトをコピー"}
            </button>
          </div>
          <p className="text-[11px] font-mono text-text-base/75 leading-relaxed whitespace-pre-wrap break-words line-clamp-4">
            {item.promptText}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── 生成結果スロット（ドラッグ＆ドロップ） ────────────────────────────────────

interface GeneratedImageSlotProps {
  imageUrl: string | null | undefined;
  onImage: (url: string) => Promise<void>;
}

function GeneratedImageSlot({ imageUrl, onImage }: GeneratedImageSlotProps) {
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const thumb = await fileToThumbnail(file);
      if (thumb) await onImage(thumb);
    } catch { /* noop */ } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = "";
  };

  if (imageUrl) {
    return (
      <div className="relative group/slot w-20 h-20 rounded-xl overflow-hidden border border-bg-border flex-shrink-0">
        <img src={imageUrl} alt="生成結果" className="w-full h-full object-cover" />
        {/* ホバーオーバーレイ */}
        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/slot:opacity-100 transition flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title="画像を変更"
            className="text-[9px] text-white/90 bg-white/15 rounded-md px-1.5 py-1 hover:bg-white/25 transition"
          >
            変更
          </button>
          <button
            type="button"
            onClick={async () => { try { await onImage(""); } catch (e) { console.error("画像の削除に失敗しました:", e); } }}
            title="削除"
            className="text-[9px] text-rose-300/90 bg-rose-500/15 rounded-md px-1.5 py-1 hover:bg-rose-500/30 transition"
          >
            削除
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={handleChange} />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        "w-20 h-20 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1",
        "cursor-pointer transition-all duration-150 flex-shrink-0 select-none",
        dragging
          ? "border-accent scale-105 bg-accent/15 shadow-[0_0_12px_rgba(124,92,255,0.3)]"
          : "border-bg-border/50 bg-bg-panel/40 hover:border-accent/50 hover:bg-accent/8",
      ].join(" ")}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      aria-label="生成結果画像を登録"
    >
      {uploading ? (
        <div className="w-5 h-5 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
      ) : dragging ? (
        <>
          <span className="text-accent text-lg">⊕</span>
          <span className="text-[9px] text-accent/80">ドロップ</span>
        </>
      ) : (
        <>
          <span className="text-[18px] opacity-35">🖼</span>
          <span className="text-[8.5px] text-text-muted/45 leading-tight text-center px-1">
            結果を登録
          </span>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={handleChange} />
    </div>
  );
}

// ── FavCard ────────────────────────────────────────────────────────────────────

interface FavCardProps {
  item: PromptHistoryItem;
  onUpdate:      (id: string, patch: Partial<PromptHistoryItem>) => Promise<void>;
  onArrange:     (item: PromptHistoryItem) => void;
  onUseAsSource: (url: string) => void;
  onCompare:     (item: PromptHistoryItem) => void;
}

function FavCard({ item, onUpdate, onArrange, onUseAsSource, onCompare }: FavCardProps) {
  const [copied,   setCopied]   = useState(() => {
    try { return localStorage.getItem(`copied_${item.id}`) === "1" || item.copied === true; }
    catch { return item.copied === true; }
  });
  const [expanded, setExpanded] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.promptText);
      setCopied(true);
      try { localStorage.setItem(`copied_${item.id}`, "1"); } catch {}
    } catch { /* noop */ }
  };

  const resultImages = getResultImages(item);

  /** 末尾に追加（GeneratedImageSlot は1スロットなのでファースト枠 / 追加枠で使い分け） */
  const handleAppend = useCallback(async (url: string) => {
    if (!url) {
      // 空文字 = 全削除（後方互換）
      await onUpdate(item.id, buildResultImagesPatch([]));
      return;
    }
    const next = [...resultImages, url].slice(0, MAX_RESULT_IMAGES);
    await onUpdate(item.id, buildResultImagesPatch(next));
  }, [item.id, onUpdate, resultImages]);

  /** 指定インデックスの画像を差し替え or 削除（url="" で削除） */
  const handleReplaceAt = useCallback(async (idx: number, url: string) => {
    if (!url) {
      const next = resultImages.filter((_, i) => i !== idx);
      await onUpdate(item.id, buildResultImagesPatch(next));
      return;
    }
    const next = [...resultImages];
    next[idx] = url;
    await onUpdate(item.id, buildResultImagesPatch(next));
  }, [item.id, onUpdate, resultImages]);

  const scopes = item.scopes.slice(0, 3);
  const moods  = (item.moods ?? []).slice(0, 3);
  const hasResult = resultImages.length > 0;
  const isArranged = !!item.derivedFromId;

  return (
    <article className={[
      "rounded-2xl border overflow-hidden transition-colors duration-200",
      isArranged
        ? "border-violet-400/40 bg-violet-500/5 hover:border-violet-400/65"
        : "border-bg-border bg-bg-card hover:border-accent/40",
    ].join(" ")}>

      {/* ── アレンジ保存バナー（派生元ありの場合のみ） ──────────── */}
      {isArranged && (
        <div className="px-3 py-1.5 border-b border-violet-400/20 bg-violet-500/10 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-violet-100 flex items-center gap-1">
            ✨ アレンジ保存
            {item.arrangeCaseNumber && (
              <span className="text-[10px] text-violet-300/80">（案{item.arrangeCaseNumber}）</span>
            )}
          </span>
          {item.derivedFromDate && (
            <span className="text-[10px] text-violet-200/65">
              元：{formatDateTime(item.derivedFromDate)}
            </span>
          )}
          {/* 使用要素チップ */}
          {(item.arrangeUsedScopes ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 ml-auto">
              {(item.arrangeUsedScopes ?? []).slice(0, 4).map((s) => (
                <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full border border-violet-400/40 bg-violet-400/12 text-violet-200/85 leading-none">
                  {SCOPE_LABEL[s] ?? s}
                </span>
              ))}
              {(item.arrangeUsedScopes ?? []).length > 4 && (
                <span className="text-[9px] text-violet-300/60">+{(item.arrangeUsedScopes ?? []).length - 4}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ヘッダー ──────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
        <span className={[
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
          item.outputType === "unified"
            ? "border-accent/40 bg-accent/12 text-accent/90"
            : item.outputType === "nano_gemini"
            ? "border-sky-400/40 bg-sky-400/12 text-sky-300"
            : "border-fuchsia-400/40 bg-fuchsia-400/12 text-fuchsia-300",
        ].join(" ")}>
          {OUTPUT_LABEL[item.outputType]} 案{item.proposalIndex}
        </span>
        {item.presetName && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/8 text-amber-300/80 truncate max-w-[80px]">
            {item.presetName}
          </span>
        )}
        {/* hasImage バッジ */}
        {hasResult && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-200/85 leading-none">
            🖼 画像{resultImages.length}枚
          </span>
        )}
        {item.viralMode && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-rose-400/35 bg-rose-400/8 text-rose-300/70">
            🔥
          </span>
        )}
        <span className="ml-auto text-[13px] font-semibold text-white/90 shrink-0 whitespace-nowrap">
          {formatDateTime(item.createdAt)}
        </span>
      </div>

      {/* ── 除外要素（アレンジ保存時のみ） ────────────────────────── */}
      {isArranged && (item.arrangeExcludedScopes ?? []).length > 0 && (
        <div className="px-3 pb-1 flex items-center gap-1 flex-wrap">
          <span className="text-[9px] text-text-muted/45">除外：</span>
          {(item.arrangeExcludedScopes ?? []).slice(0, 4).map((s) => (
            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/3 text-text-muted/50 leading-none line-through decoration-text-muted/25">
              {SCOPE_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

      {/* ── 生成チェーン ──────────────────────────────────────────── */}
      <div className="px-3 pb-2.5 flex items-center gap-2.5">

        {/* 元画像 */}
        {item.sourceImageThumbnail ? (
          <WithImagePreview
            src={item.sourceImageThumbnail}
            label={isArranged ? "アレンジ元画像" : "元画像"}
            sublabel={isArranged && item.derivedFromDate
              ? formatDateTime(item.derivedFromDate)
              : `${OUTPUT_LABEL[item.outputType]} 案${item.proposalIndex}`}
          >
            <div className="relative">
              <img
                src={item.sourceImageThumbnail}
                alt="元画像"
                className={[
                  "w-20 h-20 rounded-xl object-cover cursor-zoom-in",
                  isArranged ? "border-2 border-violet-400/50" : "border border-bg-border",
                ].join(" ")}
              />
              {isArranged && (
                <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-md bg-violet-600/85 text-[8px] font-bold text-white leading-none shadow">
                  元
                </span>
              )}
            </div>
          </WithImagePreview>
        ) : (
          <div className="w-20 h-20 rounded-xl bg-bg-panel/50 border border-bg-border flex flex-col items-center justify-center gap-1 flex-shrink-0">
            <span className="text-lg opacity-25">📷</span>
            <span className="text-[8px] text-text-muted/40">なし</span>
          </div>
        )}

        {/* 矢印 */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-6">
          <span className={[
            "text-base leading-none",
            isArranged ? "text-violet-400/65" : "text-text-muted/45",
          ].join(" ")}>→</span>
          {hasResult && (
            <span className="text-[7px] text-emerald-400/50">✓</span>
          )}
        </div>

        {/* 生成結果スロット（最大3枚：既存スロットを縦に並べる） */}
        <div className="flex flex-col gap-1">
          {resultImages.length === 0 ? (
            <GeneratedImageSlot imageUrl={null} onImage={handleAppend} />
          ) : (
            <>
              {resultImages.map((url, i) => (
                <div key={`${i}-${url}`} className="relative">
                  <WithImagePreview
                    src={url}
                    label={`生成結果 ${i + 1}`}
                    sublabel={`案${item.proposalIndex} · ${formatDateTime(item.createdAt)}`}
                  >
                    <GeneratedImageSlot
                      imageUrl={url}
                      onImage={async (nu) => { await handleReplaceAt(i, nu); }}
                    />
                  </WithImagePreview>
                  {resultImages.length > 1 && (
                    <span className="absolute top-1 left-1 px-1 rounded bg-black/70 text-emerald-200/95 text-[9px] leading-none font-bold pointer-events-none">
                      {i + 1}/{resultImages.length}
                    </span>
                  )}
                </div>
              ))}
              {resultImages.length < MAX_RESULT_IMAGES && (
                <GeneratedImageSlot imageUrl={null} onImage={handleAppend} />
              )}
            </>
          )}
        </div>

        {/* スコープ＋ムードタグ */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {scopes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {scopes.map((s) => (
                <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full border border-accent/30 bg-accent/8 text-text-base/65">
                  {SCOPE_LABEL[s]}
                </span>
              ))}
              {item.scopes.length > 3 && (
                <span className="text-[9px] text-text-muted/45">+{item.scopes.length - 3}</span>
              )}
            </div>
          )}
          {moods.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {moods.map((m) => (
                <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full border border-fuchsia-400/25 bg-fuchsia-400/6 text-fuchsia-300/65">
                  {MOOD_LABEL[m] ?? m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── プロンプトプレビュー ──────────────────────────────────── */}
      <div className="px-3 pb-2 border-t border-bg-border/40 pt-2.5">
        <p
          className="text-[11px] text-text-base/70 break-words leading-relaxed"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: expanded ? "unset" : 2,
            WebkitBoxOrient: "vertical",
            overflow: expanded ? "visible" : "hidden",
          }}
        >
          {item.promptText}
        </p>
        {item.promptText.length > 100 && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-accent/60 hover:text-accent transition"
            >
              {expanded ? "閉じる" : "全文を見る"}
            </button>
            {/* 展開時：プロンプト全文コピーボタン */}
            {expanded && (
              <button
                type="button"
                onClick={copy}
                className={[
                  "group/cdet text-[11px] px-2.5 py-1 rounded-lg border transition",
                  copied
                    ? "border-emerald-400/50 bg-emerald-400/8 text-emerald-300"
                    : "border-sky-400/30 bg-sky-400/5 text-sky-300/70 hover:border-sky-400/50 hover:bg-sky-400/12",
                ].join(" ")}
              >
                {copied ? (
                  <>
                    <span className="group-hover/cdet:hidden">✅ コピー済み</span>
                    <span className="hidden group-hover/cdet:inline">🔄 再コピー</span>
                  </>
                ) : "📋 プロンプトをコピー"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── アクションボタン ──────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-2 border-t border-bg-border/40 flex items-center gap-1.5 flex-wrap">

        {/* 📋 コピー */}
        <button
          type="button"
          onClick={copy}
          title={copied ? "再コピー" : "プロンプトをコピー"}
          className={[
            "group/btn rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border transition",
            copied
              ? "border-emerald-400/60 bg-emerald-400/12 text-emerald-200"
              : "border-sky-400/40 bg-sky-400/8 text-sky-200 hover:bg-sky-400/15",
          ].join(" ")}
        >
          {copied ? (
            <>
              <span className="group-hover/btn:hidden">✅ コピー済</span>
              <span className="hidden group-hover/btn:inline">🔄 再コピー</span>
            </>
          ) : "📋 コピー"}
        </button>

        {/* ✨ アレンジ */}
        <button
          type="button"
          onClick={() => onArrange(item)}
          title="このプロンプトをベースにアレンジ生成"
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border border-violet-400/40 bg-violet-400/8 text-violet-200 hover:bg-violet-400/18 transition"
        >
          ✨ アレンジ
        </button>

        {/* 🖼 この生成結果を元画像にする */}
        {hasResult && (
          <button
            type="button"
            onClick={() => onUseAsSource(resultImages[0]!)}
            title="この生成結果を元画像として使用してさらに生成"
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border border-emerald-400/40 bg-emerald-400/8 text-emerald-200 hover:bg-emerald-400/18 transition"
          >
            🖼 元画像に
          </button>
        )}

        {/* ⚖ 比較 */}
        <button
          type="button"
          onClick={() => onCompare(item)}
          title="元画像と生成結果を並べて比較"
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border border-bg-border bg-bg-panel/60 text-text-muted/65 hover:text-text-base hover:border-accent/40 transition"
        >
          ⚖ 比較
        </button>

        {/* ★ お気に入り解除 */}
        <button
          type="button"
          onClick={() => {
            if (!confirmUnfavorite()) return;
            void onUpdate(item.id, { isFavorite: false });
          }}
          title="お気に入りから削除"
          className="ml-auto rounded-lg px-2.5 py-1.5 text-[11px] border border-bg-border text-amber-300/60 hover:text-rose-300 hover:border-rose-400/40 transition"
        >
          ★ 解除
        </button>
      </div>
    </article>
  );
}

// ── メインパネル ──────────────────────────────────────────────────────────────

export function FavoritesPanel({ open, onClose, onArrange, onUseAsSource }: Props) {
  const [favorites,   setFavorites]   = useState<PromptHistoryItem[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [compareItem, setCompareItem] = useState<PromptHistoryItem | null>(null);

  // パネルが開くたびに IDB からリロード
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void getAll().then((all) => {
      setFavorites(
        all
          .filter((it) => it.isFavorite)
          .sort((a, b) => b.createdAt - a.createdAt),
      );
      setLoading(false);
    });
  }, [open]);

  /** IndexedDB 更新 + 楽観的 state 更新 */
  const handleUpdate = useCallback(async (id: string, patch: Partial<PromptHistoryItem>) => {
    setFavorites((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, ...patch } : it));
      // お気に入り解除 → リストから削除
      return patch.isFavorite === false ? next.filter((it) => it.id !== id) : next;
    });
    await updateItem(id, patch);
  }, []);

  const handleArrangeAndClose = useCallback((item: PromptHistoryItem) => {
    onClose();
    onArrange(item);
  }, [onClose, onArrange]);

  const handleUseAsSourceAndClose = useCallback((url: string) => {
    onClose();
    onUseAsSource(url);
  }, [onClose, onUseAsSource]);

  const chainCount  = favorites.filter((it) => getResultImages(it).length > 0).length;
  const totalCount  = favorites.length;

  return (
    <>
      {/* バックドロップ（モバイル） */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* パネル本体 */}
      <aside
        className={[
          "fixed inset-y-0 right-0 z-50 flex flex-col",
          "w-full sm:w-[440px]",
          "bg-bg-panel border-l border-bg-border shadow-[-8px_0_40px_rgba(0,0,0,0.5)]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="お気に入りパネル"
      >
        {/* ── ヘッダー ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-bg-border shrink-0 bg-bg-panel/95 backdrop-blur">
          <div>
            <h2 className="text-sm font-bold text-text-base">⭐ お気に入り</h2>
            <p className="text-[10px] text-text-muted mt-0.5">
              {totalCount}件
              {chainCount > 0 && (
                <span className="ml-1.5 text-emerald-400/70">
                  · チェーン完成 {chainCount}件
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-bg-border text-text-muted hover:text-text-base hover:border-accent/50 transition text-sm"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* ── コンテンツ ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-xs text-text-muted">
              <span className="animate-pulse">読み込み中…</span>
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 h-56 text-center px-6">
              <span className="text-4xl opacity-25">⭐</span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-text-muted">お気に入りがありません</p>
                <p className="text-xs text-text-muted/60 leading-relaxed">
                  生成結果カードの ⭐ ボタンで登録できます。
                </p>
              </div>
            </div>
          ) : (
            favorites.map((item) => (
              <FavCard
                key={item.id}
                item={item}
                onUpdate={handleUpdate}
                onArrange={handleArrangeAndClose}
                onUseAsSource={handleUseAsSourceAndClose}
                onCompare={setCompareItem}
              />
            ))
          )}
        </div>

        {/* ── フッター ─────────────────────────────────────── */}
        {favorites.length > 0 && (
          <div className="shrink-0 px-4 py-2.5 border-t border-bg-border/60 text-[10px] text-text-muted/50">
            🖼 欄をクリック or ドロップで生成結果を登録　⚖ で並べて比較
          </div>
        )}
      </aside>

      {/* 比較モーダル（portal） */}
      <CompareModal item={compareItem} onClose={() => setCompareItem(null)} />
    </>
  );
}
