import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptHistoryItem, FailureMemo } from "../types";
import { makeThumbnail } from "../lib/imageThumb";
import { FavoriteButton } from "./FavoriteButton";
import {
  getResultImages, buildResultImagesPatch, MAX_RESULT_IMAGES,
  getRatingAt, getMemoAt, buildRatingPatch, buildMemoPatch, RATING_LABELS,
  getAxisRatingAt, buildAxisRatingPatch, AXIS_RATING_META, type RatingAxisKey,
} from "../lib/history";
import { PromptGuardSection } from "./PromptGuardSection";
import type { LockState } from "../lib/promptLockCheck";
import { buildLockHeader } from "../lib/promptLockCheck";
import type { SkyveilProfile } from "../lib/skyveilProfile";

interface Props {
  item: PromptHistoryItem;
  onUpdate: (id: string, patch: Partial<PromptHistoryItem>) => void;
  onArrange?: (item: PromptHistoryItem) => void;
  /** 変更禁止チェック・スコア用のロック状態（メイン生成画面でのみ渡る） */
  lock?: LockState;
  /** skyveil好みスコア用プロファイル */
  skyveilProfile?: SkyveilProfile | null;
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
  /** 登録済みの生成結果画像（最大3枚） */
  resultImages: string[];
  /** 画像ごとの評価（同インデックス、null=未評価） */
  resultRatings: (number | null)[];
  /** 画像ごとのメモ（同インデックス） */
  resultMemos: (string | null)[];
  sourceImageUrl: string | null;
  /** 末尾に画像を追加（呼び出し側で MAX_RESULT_IMAGES 制限済み） */
  onAppend: (dataUrl: string) => void;
  /** 指定インデックスの画像を差し替え */
  onReplaceAt: (index: number, dataUrl: string) => void;
  /** 指定インデックスの画像を削除 */
  onRemoveAt: (index: number) => void;
  /** 全削除 */
  onRemoveAll: () => void;
  /** 評価を設定／クリア（null=クリア） */
  onSetRating: (index: number, rating: number | null) => void;
  /** メモを設定 */
  onSetMemo: (index: number, memo: string) => void;
  /** 軸別評価マップ（背景/衣装/ポーズ） */
  axisRatings: Record<RatingAxisKey, (number | null)[]>;
  /** 軸別評価の設定（null=解除） */
  onSetAxisRating: (axis: RatingAxisKey, index: number, value: number | null) => void;
}

const SLOT_MAX = 3;

// 評価値 → 枠の Tailwind クラス（緑=良い / 青=普通 / 黄=微妙 / 赤=失敗）
function ratingFrameClass(rating: number | null): string {
  switch (rating) {
    case 5: return "border-emerald-400/85 shadow-[0_0_10px_-2px_rgba(52,211,153,0.55)]";
    case 3: return "border-sky-400/80 shadow-[0_0_8px_-2px_rgba(56,189,248,0.45)]";
    case 2: return "border-amber-400/80 shadow-[0_0_8px_-2px_rgba(251,191,36,0.45)]";
    case 1: return "border-rose-400/85 shadow-[0_0_10px_-2px_rgba(244,63,94,0.55)]";
    default: return "border-emerald-400/50 shadow-[0_0_8px_rgba(52,211,153,0.2)]";
  }
}

function GeneratedResultSlot({
  resultImages, resultRatings, resultMemos,
  sourceImageUrl,
  onAppend, onReplaceAt, onRemoveAt, onRemoveAll,
  onSetRating, onSetMemo,
  axisRatings, onSetAxisRating,
}: SlotProps) {
  const [memoOpenIdx, setMemoOpenIdx] = useState<number | null>(null);
  const slotRef      = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  /** 差し替え対象（null = 末尾追加） */
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);

  // stable refs — prevent stale closure in paste listener
  const appendRef    = useRef(onAppend);
  const replaceRef   = useRef(onReplaceAt);
  useEffect(() => { appendRef.current = onAppend; }, [onAppend]);
  useEffect(() => { replaceRef.current = onReplaceAt; }, [onReplaceAt]);

  /** ファイル → サムネ → 追加 or 差し替え */
  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target!.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    let final = dataUrl;
    try {
      final = await makeThumbnail(dataUrl, 600, 0.83);
    } catch { /* 元 dataUrl で続行 */ }
    if (replaceTarget !== null) {
      replaceRef.current(replaceTarget, final);
      setReplaceTarget(null);
    } else {
      appendRef.current(final);
    }
  }, [replaceTarget]);

  const canAdd = resultImages.length < SLOT_MAX;

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

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); if (canAdd) setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canAdd && replaceTarget === null) return;
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    } else {
      // ファイル未選択（=キャンセル）の場合は replaceTarget をクリアして次回 paste/D&D を append 扱いに戻す
      setReplaceTarget(null);
    }
    e.target.value = "";
  };
  // input の cancel イベントは React の型に無いので addEventListener で個別購読
  // （Chrome 113+ / Firefox 91+ でサポート、それ以外は何もしないだけで実害なし）
  useEffect(() => {
    const el = fileInputRef.current;
    if (!el) return;
    const onCancel = () => setReplaceTarget(null);
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, []);

  const openAppendPicker = () => {
    if (!canAdd) return;
    setReplaceTarget(null);
    fileInputRef.current?.click();
  };
  const openReplacePicker = (idx: number) => {
    setReplaceTarget(idx);
    fileInputRef.current?.click();
  };

  // ── Filled state（1〜3枚） ────────────────────────────────────────────
  if (resultImages.length > 0) {
    return (
      <div className="px-4 py-2.5 border-b border-bg-border/50 bg-black/15">
        <div className="flex items-center gap-3 flex-wrap">
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
          {/* 生成結果画像（横並び、最大3枚） — 評価バーは右列に移動 */}
          <div className="flex items-center gap-1.5 flex-shrink-0"
               ref={slotRef} tabIndex={0}
               onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            {resultImages.map((url, i) => {
              const rating = resultRatings[i] ?? null;
              return (
                <div key={url} className="relative group">
                  <img
                    src={url}
                    alt={`生成結果 ${i + 1}`}
                    title="クリックで差し替え"
                    onClick={() => openReplacePicker(i)}
                    className={[
                      "w-16 h-16 rounded-lg object-cover border-2 cursor-pointer hover:border-accent/70 transition",
                      ratingFrameClass(rating),
                    ].join(" ")}
                  />
                  {/* 個別×削除 */}
                  <button
                    type="button"
                    onClick={() => onRemoveAt(i)}
                    title="この画像を削除"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500/85 hover:bg-rose-500 text-white text-[11px] font-bold leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                  >
                    ×
                  </button>
                  <span className="absolute -bottom-1 -left-1 px-1 rounded bg-black/65 text-emerald-200/95 text-[10px] leading-none font-bold pointer-events-none">
                    {i + 1}
                    {rating !== null && <span className="ml-0.5">{RATING_LABELS[rating]?.emoji}</span>}
                  </span>
                </div>
              );
            })}
            {canAdd && (
              <button
                type="button"
                onClick={openAppendPicker}
                title={`生成結果を追加（${resultImages.length}/${SLOT_MAX}）`}
                className={[
                  "w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition",
                  isDragOver
                    ? "border-accent bg-accent/10 text-white"
                    : "border-bg-border/60 text-text-muted/60 hover:border-accent/50 hover:text-accent",
                ].join(" ")}
              >
                <span className="text-[22px] leading-none">＋</span>
              </button>
            )}
          </div>
          {/* 右列：ラベル＋操作＋画像ごとの評価バー（広めに使う） */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] text-emerald-300/90 font-medium leading-none">
                ✅ 生成結果 <span className="text-[11px] text-emerald-300/60">（{resultImages.length}/{SLOT_MAX}）</span>
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                {canAdd && (
                  <button
                    type="button"
                    onClick={openAppendPicker}
                    className="text-[11px] px-2 py-0.5 rounded border border-emerald-400/40 bg-emerald-400/8 text-emerald-200 hover:bg-emerald-400/16 hover:border-emerald-400/65 transition leading-none"
                  >
                    ＋ 追加
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRemoveAll}
                  className="text-[11px] px-2 py-0.5 rounded border border-rose-400/30 bg-transparent text-rose-300/60 hover:text-rose-200 hover:border-rose-400/50 hover:bg-rose-400/8 transition leading-none"
                >
                  ✕ 全削除
                </button>
              </span>
            </div>

            {/* 画像ごとの評価バー（縦に並べる：右の余白を活用） */}
            <div className="space-y-1">
              {resultImages.map((_, i) => {
                const rating = resultRatings[i] ?? null;
                const memo = resultMemos[i] ?? "";
                const isMemoOpen = memoOpenIdx === i;
                // 番号バッジ（サムネのと同色）
                const indexBadgeCls =
                  rating === 6 ? "border-yellow-300/70  bg-yellow-400/15  text-yellow-100"
                : rating === 5 ? "border-emerald-400/65 bg-emerald-500/15 text-emerald-100"
                : rating === 3 ? "border-sky-400/65     bg-sky-500/15     text-sky-100"
                : rating === 2 ? "border-amber-400/65   bg-amber-500/15   text-amber-100"
                : rating === 1 ? "border-rose-400/65    bg-rose-500/15    text-rose-100"
                : "border-white/15 bg-white/4 text-text-muted/60";
                return (
                  <div key={resultImages[i]} className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={[
                        "inline-flex items-center justify-center w-6 h-6 rounded border text-[11px] font-bold leading-none shrink-0",
                        indexBadgeCls,
                      ].join(" ")}>
                        {i + 1}
                      </span>
                      {([6, 5, 3, 2, 1] as const).map((v) => {
                        const m = RATING_LABELS[v];
                        const active = rating === v;
                        const activeCls =
                          v === 6 ? "border-yellow-300/90  bg-yellow-400/25  text-yellow-100  shadow-[0_0_8px_-1px_rgba(250,204,21,0.5)]"
                        : v === 5 ? "border-emerald-400/85 bg-emerald-500/25 text-emerald-100 shadow-[0_0_6px_-1px_rgba(52,211,153,0.4)]"
                        : v === 3 ? "border-sky-400/80     bg-sky-500/22     text-sky-100     shadow-[0_0_6px_-1px_rgba(56,189,248,0.35)]"
                        : v === 2 ? "border-amber-400/80   bg-amber-500/22   text-amber-100   shadow-[0_0_6px_-1px_rgba(251,191,36,0.35)]"
                        :            "border-rose-400/85    bg-rose-500/22    text-rose-100    shadow-[0_0_6px_-1px_rgba(244,63,94,0.4)]";
                        const idleCls = "border-bg-border/55 bg-bg-base/40 text-text-muted/75 hover:text-text-base hover:border-white/35";
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => onSetRating(i, active ? null : v)}
                            title={`${m.emoji} ${m.jp}${active ? "（クリックで解除）" : ""}`}
                            className={[
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-semibold leading-none transition select-none",
                              active ? activeCls : idleCls,
                            ].join(" ")}
                          >
                            <span className="text-[14px]">{m.emoji}</span>
                            <span>{m.jp}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setMemoOpenIdx(isMemoOpen ? null : i)}
                        title={memo ? `メモ：${memo}` : "メモを追加"}
                        className={[
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-semibold leading-none transition",
                          memo
                            ? "border-violet-400/65 bg-violet-500/18 text-violet-100"
                            : "border-bg-border/55 bg-bg-base/40 text-text-muted/75 hover:text-text-base hover:border-violet-400/45",
                        ].join(" ")}
                      >
                        <span>📝</span>
                        <span>{memo ? "メモ" : "メモ"}</span>
                      </button>
                    </div>
                    {/* 軸別評価（背景/衣装/ポーズ）— 30件以上で内部分析が走る */}
                    <div className="flex items-center gap-2 pl-7 flex-wrap">
                      {(["bg", "outfit", "pose"] as RatingAxisKey[]).map((axis) => {
                        const meta = AXIS_RATING_META[axis];
                        const v = axisRatings[axis][i] ?? null;
                        // 軸別は3段階（良い/普通/悪い）。腕マーク系（👍👎）は廃止し短いラベルに統一。
                        const mkBtn = (val: 5 | 3 | 1, lbl: string, onCls: string) => {
                          const on = v === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => onSetAxisRating(axis, i, on ? null : val)}
                              title={`${meta.jp}：${lbl}${on ? "（クリックで解除）" : ""}`}
                              className={[
                                "inline-flex items-center px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold leading-none transition select-none",
                                on
                                  ? onCls
                                  : "border-bg-border/50 bg-bg-base/40 text-text-muted/70 hover:text-text-base hover:border-white/35",
                              ].join(" ")}
                            >
                              {lbl}
                            </button>
                          );
                        };
                        return (
                          <span key={axis} className="inline-flex items-center gap-1 rounded-xl border border-bg-border/35 bg-bg-panel/40 px-2 py-1">
                            <span className="text-[12px] font-semibold text-text-muted/85 leading-none shrink-0 select-none">
                              {meta.emoji}{meta.jp}
                            </span>
                            {mkBtn(5, "良い", "border-emerald-400/75 bg-emerald-500/22 text-emerald-100")}
                            {mkBtn(3, "普通", "border-sky-400/70     bg-sky-500/20     text-sky-100")}
                            {mkBtn(1, "悪い", "border-rose-400/75    bg-rose-500/22    text-rose-100")}
                          </span>
                        );
                      })}
                    </div>
                    {isMemoOpen && (
                      <input
                        type="text"
                        value={memo}
                        onChange={(e) => onSetMemo(i, e.target.value)}
                        onBlur={() => setMemoOpenIdx(null)}
                        placeholder="メモ（例：背景が良い / 顔は良いが衣装は微妙）"
                        autoFocus
                        maxLength={200}
                        className="w-full px-2 py-1 rounded border border-violet-400/45 bg-bg-base/90 text-[12px] text-text-base outline-none focus:border-violet-400/80"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-text-muted/45 leading-snug">
              画像クリックで差し替え・×で個別削除・最大{SLOT_MAX}枚 ／ 評価は次回プロンプト生成に反映
            </p>
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
      aria-label="生成結果画像を登録（D&D / Ctrl+V / クリック・最大3枚）"
      onClick={openAppendPicker}
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
          : `生成結果画像をここに貼り付け（D&D / Ctrl+V / クリック・最大${SLOT_MAX}枚）`}
      </span>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PromptCard({ item, onUpdate, onArrange, lock, skyveilProfile }: Props) {
  const [expanded, setExpanded] = useState(false);
  /** ロック一覧をコピーに含めるか */
  const [includeLockHeader, setIncludeLockHeader] = useState(false);

  /** 通常コピー済み：IndexedDB に永続保存（item.copied を直接使用） */
  const isCopied = item.copied === true;

  const pal  = paletteFor(item.proposalIndex);
  const isLocked  = item.locked === true;

  /** コピーするテキスト（ロック一覧を含める設定なら先頭に付与） */
  const copyText = (includeLockHeader && lock)
    ? buildLockHeader(lock) + item.promptText
    : item.promptText;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      // DB に永続保存
      if (!isCopied) onUpdate(item.id, { copied: true });
    } catch {
      // clipboard API 失敗時のフォールバック
      window.prompt("コピーできませんでした。手動でコピーしてください：", copyText);
    }
  };

  /** 禁止ワード除去/改善案反映/版復元：promptText を上書き。
   *  上書き前の内容を versions に push して「前回との差分・この版に戻す」を可能にする。 */
  const applyCleanedPrompt = useCallback((next: string) => {
    if (next === item.promptText) return;
    const prevVersions = item.versions ?? [];
    const newVersion = {
      id: `v-${Date.now()}`,
      createdAt: Date.now(),
      prompt: item.promptText,
      source: "improvement" as const,
    };
    // 直近20版まで保持
    const versions = [...prevVersions, newVersion].slice(-20);
    onUpdate(item.id, { promptText: next, versions });
  }, [item.id, item.promptText, item.versions, onUpdate]);

  /** 失敗理由メモを保存（promptId を補完） */
  const saveFailureMemo = useCallback((memo: FailureMemo) => {
    onUpdate(item.id, { failureMemo: { ...memo, promptId: item.id } });
  }, [item.id, onUpdate]);

  const isLong =
    item.promptText.split(/\n/).length > LONG_THRESHOLD_LINES ||
    item.promptText.length > LONG_THRESHOLD_CHARS;

  const currentImages = getResultImages(item);

  /** 末尾に追加（上限超え分は無視） */
  const handleResultAppend = useCallback((dataUrl: string) => {
    const next = [...currentImages, dataUrl].slice(0, MAX_RESULT_IMAGES);
    onUpdate(item.id, {
      ...buildResultImagesPatch(next),
      generatedResultAddedAt: Date.now(),
    });
  }, [item.id, onUpdate, currentImages]);

  /** 指定インデックスの画像を差し替え */
  const handleResultReplaceAt = useCallback((index: number, dataUrl: string) => {
    const next = [...currentImages];
    if (index < 0 || index >= next.length) return;
    next[index] = dataUrl;
    onUpdate(item.id, {
      ...buildResultImagesPatch(next),
      generatedResultAddedAt: Date.now(),
    });
  }, [item.id, onUpdate, currentImages]);

  /** 指定インデックスの画像を削除（同時に評価・メモも同じ位置を削除） */
  const handleResultRemoveAt = useCallback((index: number) => {
    const nextImages = currentImages.filter((_, i) => i !== index);
    const ratingsSrc = currentImages.map((_, i) => getRatingAt(item, i));
    const memosSrc   = currentImages.map((_, i) => getMemoAt(item, i));
    onUpdate(item.id, {
      ...buildResultImagesPatch(nextImages),
      resultRatings: ratingsSrc.filter((_, i) => i !== index),
      resultMemos:   memosSrc.filter((_, i) => i !== index),
    });
  }, [item, onUpdate, currentImages]);

  /** すべての画像を削除（評価・メモも一緒にクリア） */
  const handleResultRemoveAll = useCallback(() => {
    onUpdate(item.id, {
      ...buildResultImagesPatch([]),
      resultRatings: [],
      resultMemos: [],
    });
  }, [item.id, onUpdate]);

  /** 画像ごとの評価を設定 */
  const handleSetRating = useCallback((index: number, value: number | null) => {
    onUpdate(item.id, buildRatingPatch(item, index, value));
  }, [item, onUpdate]);

  /** 画像ごとのメモを設定 */
  const handleSetMemo = useCallback((index: number, memo: string) => {
    onUpdate(item.id, buildMemoPatch(item, index, memo));
  }, [item, onUpdate]);

  /** 軸別評価（背景/衣装/ポーズ）を設定 */
  const handleSetAxisRating = useCallback((axis: RatingAxisKey, index: number, value: number | null) => {
    onUpdate(item.id, buildAxisRatingPatch(item, axis, index, value));
  }, [item, onUpdate]);

  // 評価・メモ・軸別評価を画像枚数と揃えて取得
  const currentRatings: (number | null)[] = currentImages.map((_, i) => getRatingAt(item, i));
  const currentMemos: (string | null)[]   = currentImages.map((_, i) => getMemoAt(item, i));
  const axisRatings: Record<RatingAxisKey, (number | null)[]> = {
    bg:     currentImages.map((_, i) => getAxisRatingAt(item, "bg", i)),
    outfit: currentImages.map((_, i) => getAxisRatingAt(item, "outfit", i)),
    pose:   currentImages.map((_, i) => getAxisRatingAt(item, "pose", i)),
  };

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
          {/* 🌟 神候補：お気に入り画像は「神候補」として扱う（自動で神確定はしない・ユーザー評価が優先） */}
          {item.isFavorite && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-yellow-300/55 bg-yellow-400/12 text-yellow-100 text-[11px] font-bold leading-none select-none"
              title="お気に入り＝神候補。総合評価で「🌟 神」を付けると確定します（自動確定はしません）。"
            >
              🌟 神候補
            </span>
          )}

          {/* ロック一覧もコピーに含める */}
          {lock && (
            <label className="flex items-center gap-1 text-[11px] text-text-muted/80 cursor-pointer select-none" title="コピー時、先頭に【変更する】【変更しない】【固定ルール】を付ける">
              <input
                type="checkbox"
                checked={includeLockHeader}
                onChange={(e) => setIncludeLockHeader(e.target.checked)}
                className="accent-violet-500"
              />
              ロック一覧も含める
            </label>
          )}

          {/* 📋 コピー */}
          <button
            type="button"
            onClick={copy}
            title={isCopied ? "コピー済み（クリックで再コピー）" : "プロンプトをクリップボードにコピー"}
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

      {/* ── 生成結果スロット（最大3枚＋全体評価＋軸別評価） ─────────────── */}
      <GeneratedResultSlot
        resultImages={currentImages}
        resultRatings={currentRatings}
        resultMemos={currentMemos}
        sourceImageUrl={item.sourceImageThumbnail}
        onAppend={handleResultAppend}
        onReplaceAt={handleResultReplaceAt}
        onRemoveAt={handleResultRemoveAt}
        onRemoveAll={handleResultRemoveAll}
        onSetRating={handleSetRating}
        onSetMemo={handleSetMemo}
        axisRatings={axisRatings}
        onSetAxisRating={handleSetAxisRating}
      />

      {/* ── 🛡 ガードパネル（変更禁止チェック / ロック一覧 / スコア / 失敗メモ） ── */}
      {lock && (
        <div className="px-5 pb-1">
          <PromptGuardSection
            promptText={item.promptText}
            lock={lock}
            profile={skyveilProfile}
            existingMemo={item.failureMemo}
            serverScopeFilter={item.serverScopeFilter}
            serverIdentityShield={item.identityShield}
            versions={item.versions}
            onApplyCleanedPrompt={applyCleanedPrompt}
            onSaveFailureMemo={saveFailureMemo}
          />
        </div>
      )}

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
