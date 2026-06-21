/**
 * ArrangePreviewPanel — 履歴一覧の右側「✨ アレンジ結果」パネル
 *
 * 「元プロンプトを丸ごと再利用」ではなく、
 * 「元プロンプトの中から使いたい要素だけ選んで再利用」する。
 *
 * フロー：カードのアレンジ → ここで使う要素をON/OFF選択 →
 *         [選択要素でアレンジ生成] を押して生成 → 結果表示。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArrangeResult, Count, GeneratedProposal, PromptHistoryItem, Scope } from "../types";
import { ARRANGE_AXES, ALL_SCOPE_LABELS, arrangeCandidateScopes } from "../lib/arrange";
import { WithImagePreview } from "./ImagePreviewTooltip";
import { DominatorBadge, summarizeNote } from "./DominatorBadge";
import { tagNgToLabels } from "../data/tagNgOptions";
import {
  MAX_RESULT_IMAGES, RATING_LABELS,
  AXIS_RATING_META, type RatingAxisKey,
} from "../lib/history";
import { fileToThumbnail } from "../lib/imageFile";
import { formatDateTime } from "../lib/format";

/** 1案ごとの画像・評価ローカル state の型 */
export interface ProposalLocalState {
  images:  string[];                  // 最大 MAX_RESULT_IMAGES 枚
  ratings: (number | null)[];         // 全体評価（5/3/2/1/null）
  memos:   (string | null)[];
  bgRatings:     (number | null)[];
  outfitRatings: (number | null)[];
  poseRatings:   (number | null)[];
}

export function emptyProposalLocalState(): ProposalLocalState {
  return { images: [], ratings: [], memos: [], bgRatings: [], outfitRatings: [], poseRatings: [] };
}

interface Props {
  /** 選択中のアレンジ元（カードのアレンジを押すと設定される） */
  source:            PromptHistoryItem | null;
  /** 使用する要素（ON のスコープ） */
  selectedScopes:    Scope[];
  onToggleScope:     (scope: Scope) => void;
  onSetScopes:       (scopes: Scope[]) => void;
  onGenerate:        () => void;

  result:            ArrangeResult | null;
  busy:              boolean;
  pinned:            boolean;
  onTogglePin:       () => void;
  onClose:           () => void;
  /**
   * お気に入り保存：画像・評価を含む拡張版。
   * localState が undefined のときは旧来の保存（画像なし）。
   */
  onSaveFavorite:    (proposal: GeneratedProposal, localState?: ProposalLocalState) => void | Promise<void>;
  onReArrange:       (proposal: GeneratedProposal) => void;
  onSendToGenerator: () => void;
  /** HistoryMiniExplorer で選択した参照画像（元画像として表示） */
  refImage?:         string | null;
  /** 参照画像をクリア */
  onClearRefImage?:  () => void;

  // ── 「見えない支配」可視化（メイン ReflectionStatusBar と同形式の rose バッジ）──
  // このアレンジで全案に効くのに画面に出ない設定を可視化＋ワンクリック解除する。
  // 値はいずれも App のライブ state（handleArrangeInline が {...current} で取り込む値と一致）。
  /** 🌆 背景を2D/非写実に（既定ON・非永続）。selectedScopes に background がある時だけ発火。 */
  avoidRealBackground?: boolean;
  /** 世界観プリセット由来の追加指示（全案へ注入・通常は不可視）。非空なら支配バッジを出す。 */
  worldCombinedNote?:   string;
  /** 参照画像から適用した強制ブロック（全案へ注入・通常は不可視）。非空なら支配バッジを出す。 */
  referenceNoteText?:   string;
  /** 背景2D化の解除（App の avoidRealBackground を false に）。 */
  onClearAvoidRealBg?:  () => void;
  /** 世界観の解除（App の activeWorldPresets + worldCombinedNote をクリア）。 */
  onClearWorld?:        () => void;
  /** 🌌 斬新背景プリセット由来の追加指示（背景スコープ時のみ全案へ注入・通常は不可視）。非空かつ背景が変更対象なら支配バッジを出す。 */
  bgPresetNote?:        string;
  /** 斬新背景の解除（App の activeBgPresets + bgPresetNote をクリア。scopes は世界観由来へ再計算で縮約・details は戻さない）。 */
  onClearBg?:           () => void;
  /** 参照画像適用の解除（App の referenceNote をクリア）。 */
  onClearReference?:    () => void;
  /** タグ個別NG（per-tag NG）の現在値。非空なら「タグNG（候補除外・準備中）」バッジを出す（①でtagNgは【NG】非合流＝現在は生成に未反映・Step2で候補除外を実効化）。 */
  tagNg?:               string[];
  /** タグ個別NGの一括解除（App の setTagNg([])）。 */
  onClearTagNg?:        () => void;

  // ── アレンジ生成枚数（アレンジ専用・メイン案数とは独立・非永続）──
  /** このアレンジで生成する案数（2-6）。未指定なら 2。 */
  arrangeCount?:        Count;
  /** 生成枚数の変更。 */
  onArrangeCountChange?: (c: Count) => void;
}

// ── 要素選択チップ ────────────────────────────────────────────────────────────

function ElementSelector({
  source, selectedScopes, onToggleScope, onSetScopes,
}: {
  source: PromptHistoryItem;
  selectedScopes: Scope[];
  onToggleScope: (s: Scope) => void;
  onSetScopes: (s: Scope[]) => void;
}) {
  const candidates = useMemo(() => arrangeCandidateScopes(source), [source]);
  const sourceScopes = new Set(source.scopes ?? []);
  const sel = new Set(selectedScopes);

  // 標準9軸＋元プロンプト固有の追加軸
  const extraAxes = candidates
    .filter((s) => !ARRANGE_AXES.some((a) => a.scope === s))
    .map((s) => ({ scope: s, label: ALL_SCOPE_LABELS[s] }));
  const allAxes = [...ARRANGE_AXES, ...extraAxes];

  const SHORTCUTS: { label: string; apply: () => void }[] = [
    { label: "衣装だけ",   apply: () => onSetScopes(["outfit"]) },
    { label: "背景だけ",   apply: () => onSetScopes(["background"]) },
    { label: "髪だけ",     apply: () => onSetScopes(["hair"]) },
    { label: "カメラだけ", apply: () => onSetScopes(["camera"]) },
    { label: "背景を除外", apply: () => onSetScopes(selectedScopes.filter((s) => s !== "background")) },
    { label: "持ち物を除外", apply: () => onSetScopes(selectedScopes.filter((s) => s !== "props")) },
    { label: "全部ON",     apply: () => onSetScopes(candidates) },
    { label: "全部OFF",    apply: () => onSetScopes([]) },
  ];

  return (
    <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-violet-100">使用する要素を選択</span>
        <span className="text-[9px] text-text-muted/40">ONの要素だけ再利用します</span>
      </div>

      {/* 要素チップ */}
      <div className="flex flex-wrap gap-1">
        {allAxes.map(({ scope, label }) => {
          const on = sel.has(scope);
          const inSource = sourceScopes.has(scope);
          return (
            <button
              key={scope}
              type="button"
              onClick={() => onToggleScope(scope)}
              title={inSource ? "元プロンプトに含まれる要素" : "元プロンプトには無い要素（ONで新たに変更対象に追加）"}
              className={[
                "text-[11px] px-2 py-1 rounded-lg border leading-none transition flex items-center gap-1",
                on
                  ? "border-violet-400/70 bg-violet-500/25 text-violet-50 font-semibold"
                  : "border-text-muted/20 bg-text-muted/5 text-text-muted/45 hover:border-text-muted/40 line-through decoration-text-muted/30",
              ].join(" ")}
            >
              <span className="text-[8px]">{on ? "●" : "○"}</span>
              {label}
              {inSource && !on && <span className="text-[8px] text-rose-300/50">除外</span>}
            </button>
          );
        })}
      </div>

      {/* ショートカット */}
      <div className="flex flex-wrap gap-1 pt-0.5 border-t border-violet-400/15">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.apply}
            className="text-[10px] px-1.5 py-0.5 rounded-md border border-sky-400/30 bg-sky-400/8 text-sky-200/70 hover:bg-sky-400/18 transition leading-none"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 画像スロット（グリッド＋大ドロップゾーン版） ─────────────────────────────

function ArrangeImageSlot({
  images, onAppend, onReplaceAt, onRemoveAt,
}: {
  images: string[];
  onAppend:    (url: string) => void;
  onReplaceAt: (i: number, url: string) => void;
  onRemoveAt:  (i: number) => void;
}) {
  const dropRef    = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const appendRef  = useRef(onAppend);
  const replaceRef = useRef(onReplaceAt);
  const [isDrag, setIsDrag]         = useState(false);
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);

  useEffect(() => { appendRef.current  = onAppend;    }, [onAppend]);
  useEffect(() => { replaceRef.current = onReplaceAt; }, [onReplaceAt]);

  const process = useCallback(async (file: File) => {
    const final = await fileToThumbnail(file);
    if (!final) return;
    if (replaceIdx !== null) { replaceRef.current(replaceIdx, final); setReplaceIdx(null); }
    else appendRef.current(final);
  }, [replaceIdx]);

  // Ctrl+V ペースト（ドロップゾーンフォーカス時 or 常時）
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.items ?? []).find((it) => it.type.startsWith("image/"))?.getAsFile();
      if (f && images.length < MAX_RESULT_IMAGES) { e.preventDefault(); void process(f); }
    };
    document.addEventListener("paste", h);
    return () => document.removeEventListener("paste", h);
  }, [process, images.length]);

  const canAdd = images.length < MAX_RESULT_IMAGES;

  const openReplace = (i: number) => { setReplaceIdx(i); fileRef.current?.click(); };
  const openAppend  = () => { setReplaceIdx(null); fileRef.current?.click(); };

  return (
    <div className="space-y-1.5">
      {/* ヘッダー：件数＋追加ボタン */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted/55 font-semibold">
          🖼 生成結果画像 {images.length}/{MAX_RESULT_IMAGES}
        </span>
        {canAdd && images.length > 0 && (
          <button type="button" onClick={openAppend}
            className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-400/45 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/22 transition leading-none">
            ＋ 追加
          </button>
        )}
      </div>

      {/* スロットグリッド（登録済み画像） */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((url, i) => (
            <div key={i} className="relative group aspect-square">
              <img
                src={url}
                alt={`生成 ${i+1}`}
                title="クリックで差し替え"
                onClick={() => openReplace(i)}
                className="w-full h-full rounded-lg object-cover border border-emerald-400/50 cursor-pointer hover:border-accent/70 transition"
              />
              {/* 個別削除 */}
              <button type="button" onClick={() => onRemoveAt(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500/85 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow">
                ×
              </button>
              <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/65 text-emerald-100 text-[9px] font-bold pointer-events-none">
                {i+1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 大きいドロップゾーン（常時表示 or 追加エリア） */}
      <div
        ref={dropRef}
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); if (canAdd) setIsDrag(true); }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setIsDrag(false);
          if (!canAdd) return;
          const f = e.dataTransfer.files[0];
          if (f) void process(f);
        }}
        onClick={() => { if (canAdd) openAppend(); }}
        className={[
          "rounded-lg border-2 border-dashed px-3 py-3 text-center cursor-pointer transition select-none outline-none",
          !canAdd ? "opacity-35 cursor-not-allowed border-bg-border/30 text-text-muted/30"
            : isDrag ? "border-accent bg-accent/12 text-white scale-[1.01]"
              : "border-bg-border/50 text-text-muted/50 hover:border-accent/50 hover:bg-accent/5 hover:text-text-muted/70 focus:border-accent/55",
        ].join(" ")}
      >
        <div className="text-[18px] mb-1">
          {isDrag ? "⬇️" : canAdd ? "📎" : "✅"}
        </div>
        <div className="text-[11px] leading-snug">
          {!canAdd
            ? `上限 ${MAX_RESULT_IMAGES} 枚に達しました`
            : isDrag
              ? "ドロップして追加"
              : `ここにドロップ・Ctrl+V・クリックで追加\n(最大${MAX_RESULT_IMAGES}枚)`}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void process(f); e.target.value = ""; }} />
    </div>
  );
}

// ── 評価バー（ArrangeProposalCard 専用） ─────────────────────────────────────

function ratingBorderCls(r: number | null): string {
  return r === 5 ? "border-emerald-400/75" : r === 3 ? "border-sky-400/65" : r === 2 ? "border-amber-400/65" : r === 1 ? "border-rose-400/75" : "border-emerald-400/40";
}

function ArrangeRatingRow({
  imageIndex, ratings, bgRatings, outfitRatings, poseRatings, memos,
  onSetRating, onSetAxisRating, onSetMemo,
}: {
  imageIndex: number;
  ratings: (number | null)[];
  bgRatings: (number | null)[];
  outfitRatings: (number | null)[];
  poseRatings: (number | null)[];
  memos: (string | null)[];
  onSetRating:     (idx: number, v: number | null) => void;
  onSetAxisRating: (axis: RatingAxisKey, idx: number, v: number | null) => void;
  onSetMemo:       (idx: number, memo: string) => void;
}) {
  const i = imageIndex;
  const rating   = ratings[i] ?? null;
  const memo     = memos[i] ?? "";
  const [memoOpen, setMemoOpen] = useState(false);

  return (
    <div className="space-y-1">
      {/* 全体評価 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-text-muted/60 shrink-0 w-16">全体評価</span>
        {([5, 3, 2, 1] as const).map((v) => {
          const m = RATING_LABELS[v];
          const active = rating === v;
          const activeCls = v === 5 ? "border-emerald-400/80 bg-emerald-500/22 text-emerald-100"
            : v === 3 ? "border-sky-400/75 bg-sky-500/20 text-sky-100"
            : v === 2 ? "border-amber-400/75 bg-amber-500/20 text-amber-100"
            :            "border-rose-400/80 bg-rose-500/22 text-rose-100";
          return (
            <button key={v} type="button"
              onClick={() => onSetRating(i, active ? null : v)}
              title={`${m.emoji} ${m.jp}`}
              className={[
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-none transition",
                active ? activeCls : "border-bg-border/55 bg-bg-base/40 text-text-muted/70 hover:text-text-base hover:border-white/30",
              ].join(" ")}>
              <span className="text-[11px]">{m.emoji}</span><span>{m.jp}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setMemoOpen((v) => !v)}
          title={memo ? `メモ: ${memo}` : "メモを追加"}
          className={["inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-none transition",
            memo ? "border-violet-400/60 bg-violet-500/16 text-violet-100" : "border-bg-border/55 bg-bg-base/40 text-text-muted/70 hover:text-text-base",
          ].join(" ")}>
          📝
        </button>
      </div>
      {/* 軸別 */}
      <div className="flex items-center gap-2 flex-wrap pl-16">
        {(["bg", "outfit", "pose"] as RatingAxisKey[]).map((axis) => {
          const axMeta = AXIS_RATING_META[axis];
          const axMap = { bg: bgRatings, outfit: outfitRatings, pose: poseRatings };
          const v = axMap[axis][i] ?? null;
          return (
            <span key={axis} className="inline-flex items-center gap-1">
              <span className="text-[9px] text-text-muted/60 w-8">{axMeta.emoji} {axMeta.jp}</span>
              {([5, 1] as const).map((val) => (
                <button key={val} type="button" onClick={() => onSetAxisRating(axis, i, v === val ? null : val)}
                  title={val === 5 ? "良い" : "悪い"}
                  className={[
                    "w-5 h-5 rounded border text-[11px] leading-none flex items-center justify-center transition",
                    v === val
                      ? val === 5 ? "border-emerald-400/75 bg-emerald-500/22 text-emerald-100" : "border-rose-400/75 bg-rose-500/22 text-rose-100"
                      : "border-bg-border/45 bg-bg-base/30 text-text-muted/55 hover:text-text-base hover:border-white/25",
                  ].join(" ")}>
                  {val === 5 ? "👍" : "👎"}
                </button>
              ))}
            </span>
          );
        })}
      </div>
      {/* メモ入力 */}
      {memoOpen && (
        <input type="text" value={memo} autoFocus maxLength={200}
          onChange={(e) => onSetMemo(i, e.target.value)}
          onBlur={() => setMemoOpen(false)}
          placeholder="メモ（例：背景が良い / 衣装が微妙）"
          className="w-full px-2 py-1 rounded border border-violet-400/45 bg-bg-base/90 text-[11px] text-text-base outline-none focus:border-violet-400/70" />
      )}
    </div>
  );
}

// ── 1案ぶんのカード（再利用スタジオ版） ──────────────────────────────────────

function ArrangeProposalCard({
  proposal, index, localState, onLocalStateChange, onSaveFavorite, onReArrange,
}: {
  proposal: GeneratedProposal;
  index: number;
  localState: ProposalLocalState;
  onLocalStateChange: (next: ProposalLocalState) => void;
  onSaveFavorite: (p: GeneratedProposal, ls: ProposalLocalState) => void | Promise<void>;
  onReArrange: (p: GeneratedProposal) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(proposal.body); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { /* noop */ }
  };
  const handleSave = async () => {
    await onSaveFavorite(proposal, localState);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  // image helpers
  const imgs = localState.images;
  const setImages = (next: string[]) => onLocalStateChange({ ...localState, images: next.slice(0, MAX_RESULT_IMAGES) });
  const appendImg   = (url: string) => setImages([...imgs, url]);
  const replaceImg  = (i: number, url: string) => { const n = [...imgs]; n[i] = url; setImages(n); };
  const removeImg   = (i: number) => setImages(imgs.filter((_, j) => j !== i));

  // rating helpers (same shape as PromptCard)
  const setRating = (idx: number, v: number | null) => {
    const next = [...localState.ratings];
    while (next.length <= idx) next.push(null);
    next[idx] = v;
    onLocalStateChange({ ...localState, ratings: next });
  };
  const setAxisRating = (axis: RatingAxisKey, idx: number, v: number | null) => {
    const field: Record<RatingAxisKey, keyof ProposalLocalState> = { bg: "bgRatings", outfit: "outfitRatings", pose: "poseRatings" };
    const arr = [...(localState[field[axis]] as (number | null)[])];
    while (arr.length <= idx) arr.push(null);
    arr[idx] = v;
    onLocalStateChange({ ...localState, [field[axis]]: arr });
  };
  const setMemo = (idx: number, memo: string) => {
    const next = [...localState.memos];
    while (next.length <= idx) next.push(null);
    next[idx] = memo.trim() || null;
    onLocalStateChange({ ...localState, memos: next });
  };

  // 評価済み画像の枠色
  const firstRating = localState.ratings[0] ?? null;
  const borderCls = ratingBorderCls(firstRating);

  return (
    <div className={["rounded-xl border-2 bg-bg-base/60 overflow-hidden transition", borderCls].join(" ")}>
      {/* カードヘッダー */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-bg-border/60 bg-bg-panel/40">
        <span className="text-[12px] font-bold text-violet-200/90">案 {index + 1}</span>
        {proposal.genreLabel && <span className="text-[10px] text-text-muted/50">{proposal.genreLabel}</span>}
      </div>

      {/* プロンプト本文 */}
      <p className="px-3 py-2.5 text-[13px] leading-relaxed text-text-base/95 whitespace-pre-wrap break-words select-text">
        {proposal.body}
      </p>

      {/* 生成結果画像スロット */}
      <div className="px-3 pb-2 space-y-1.5">
        <p className="text-[10px] text-text-muted/55 font-semibold">🖼 生成結果画像（最大{MAX_RESULT_IMAGES}枚）</p>
        <ArrangeImageSlot images={imgs} onAppend={appendImg} onReplaceAt={replaceImg} onRemoveAt={removeImg} />

        {/* 画像ごとの評価 */}
        {imgs.map((_, i) => (
          <ArrangeRatingRow key={i} imageIndex={i}
            ratings={localState.ratings} bgRatings={localState.bgRatings}
            outfitRatings={localState.outfitRatings} poseRatings={localState.poseRatings}
            memos={localState.memos}
            onSetRating={setRating} onSetAxisRating={setAxisRating} onSetMemo={setMemo}
          />
        ))}
      </div>

      {/* アクションボタン */}
      <div className="px-3 pb-3 flex flex-wrap gap-1.5 border-t border-bg-border/40 pt-2.5">
        <button type="button" onClick={handleCopy}
          className={["rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition",
            copied ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-100" : "border-sky-400/45 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20",
          ].join(" ")}>
          {copied ? "✓ コピーしました" : "📋 コピー"}
        </button>
        <button type="button" onClick={handleSave}
          className={["rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition",
            saved ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
          ].join(" ")}>
          {saved ? "✓ 保存しました" : "♥ お気に入り保存"}
        </button>
        <button type="button" onClick={() => onReArrange(proposal)}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-violet-400/45 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 transition">
          ✨ さらにアレンジ
        </button>
        {imgs.length > 0 && (
          <span className="text-[10px] text-text-muted/50 self-center ml-1">
            画像 {imgs.length}/{MAX_RESULT_IMAGES} 枚登録
          </span>
        )}
      </div>
    </div>
  );
}

// ── 「見えない支配」バッジ（rose系・メイン ReflectionStatusBar 235-243 と同形式）─────────

// DominatorBadge / summarizeNote は src/components/DominatorBadge.tsx に共有（ReflectionStatusBar と同形・§5鉄則）。

// ── メインパネル ───────────────────────────────────────────────────────────────

export function ArrangePreviewPanel({
  source, selectedScopes, onToggleScope, onSetScopes, onGenerate,
  result, busy, pinned, onTogglePin, onClose,
  onSaveFavorite, onReArrange, onSendToGenerator,
  refImage, onClearRefImage,
  avoidRealBackground = false,
  worldCombinedNote = "",
  referenceNoteText = "",
  onClearAvoidRealBg = () => {},
  onClearWorld = () => {},
  bgPresetNote = "",
  onClearBg = () => {},
  onClearReference = () => {},
  tagNg = [],
  onClearTagNg = () => {},
  arrangeCount = 2,
  onArrangeCountChange = () => {},
}: Props) {
  const usedAxes = result?.changedAxes.filter((a) => a.changed) ?? [];
  const excludedAxes = result?.changedAxes.filter((a) => !a.changed) ?? [];

  // 「見えない支配」常時バッジの判定（メイン ReflectionStatusBar 200-204 と同形）。
  // 背景2D化は selectedScopes（=このアレンジの usedScopes）に background がある時だけ発火させ、
  // server ゲート（req.scopes.includes("background") && avoidRealBackground）と一致させる。
  const worldNote = worldCombinedNote.trim();
  const refNote   = referenceNoteText.trim();
  const bgStylizeActive = avoidRealBackground && selectedScopes.includes("background");
  // 🌌 斬新背景：bgPresetNote は buildInputs で「背景スコープ時のみ」注入＝発火条件もサーバ効果と厳密一致。
  const bgNote = bgPresetNote.trim();
  const bgFires = bgNote.length > 0 && selectedScopes.includes("background");
  // 🚫 タグ個別NG（per-tag NG）：アレンジは {...current} で同設定を継承するため、ここでも常時可視化＋解除（§5）。
  const tagNgLabels = tagNgToLabels(tagNg);
  const hasDominator = worldNote.length > 0 || bgFires || refNote.length > 0 || bgStylizeActive || tagNg.length > 0;

  // 案ごとのローカル state（画像・評価）。result が変わっても貼付け済みの内容は引き継ぐ。
  const [proposalStates, setProposalStates] = useState<ProposalLocalState[]>([]);
  useEffect(() => {
    if (result) {
      setProposalStates((prev) =>
        result.proposals.map((_, i) => {
          const existing = prev[i];
          if (existing && (existing.images.length > 0 || existing.ratings.some((r) => r != null))) {
            return existing;
          }
          return emptyProposalLocalState();
        })
      );
    }
  }, [result]);
  const canGenerate = !!source && selectedScopes.length > 0 && !busy;

  return (
    <div className="rounded-2xl border border-violet-400/30 bg-bg-panel/50 flex flex-col lg:sticky lg:top-0 lg:self-start lg:max-h-screen overflow-hidden shadow-[0_0_24px_rgba(139,92,246,0.12)]">

      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-violet-400/20 bg-violet-400/5">
        <span className="text-[14px]">✨</span>
        <span className="text-[13px] font-bold text-violet-100">アレンジ結果</span>
        {busy && <span className="text-[11px] text-violet-200/60 animate-pulse">生成中…</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onTogglePin}
            title={pinned ? "固定を解除" : "パネルを固定表示"}
            className={[
              "text-[11px] px-2 py-0.5 rounded-lg border leading-none transition",
              pinned ? "border-violet-400/60 bg-violet-400/20 text-violet-100"
                     : "border-bg-border bg-bg-panel/70 text-text-muted/60 hover:text-text-base",
            ].join(" ")}>
            📌 固定{pinned ? "中" : ""}
          </button>
          <button type="button" onClick={onClose} title="閉じる"
            className="text-[13px] text-text-muted/40 hover:text-text-muted/80 transition leading-none px-1">
            ✕
          </button>
        </div>
      </div>

      {/* スクロール領域 */}
      <div className="overflow-y-auto p-3 space-y-3 flex-1 min-h-[220px]">

        {/* 元未選択：空状態 */}
        {!source && (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-2 py-10">
            <span className="text-3xl opacity-30">✨</span>
            <p className="text-[13px] text-text-muted/50 leading-relaxed">
              アレンジ結果はここに表示されます。
              <br />
              左の履歴カードの「アレンジ」を押してください。
            </p>
          </div>
        )}

        {/* Explorer からの参照画像バナー */}
        {refImage && (
          <div className="rounded-xl border border-sky-400/40 bg-sky-500/8 p-2 flex items-center gap-2.5">
            <img src={refImage} alt="参照画像" className="w-12 h-12 rounded-lg object-cover border border-sky-400/55 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-sky-100">📁 Explorer 参照画像</p>
              <p className="text-[10px] text-sky-200/65 leading-snug">各案の「＋ 追加」または画像スロットのドロップで登録できます</p>
            </div>
            {onClearRefImage && (
              <button type="button" onClick={onClearRefImage} title="参照画像を解除"
                className="shrink-0 text-[11px] text-text-muted/50 hover:text-text-muted/80 px-1.5 py-0.5 transition leading-none">
                ✕
              </button>
            )}
          </div>
        )}

        {source && (
          <>
            {/* 元プロンプト情報 */}
            <div className="rounded-xl border border-bg-border bg-bg-base/40 p-2.5 flex gap-2.5 items-start">
              {/* 元画像／生成結果画像：ホバー・クリックで拡大（履歴一覧と共通） */}
              {source.sourceImageThumbnail || source.resultImageData ? (
                <div className="flex items-center gap-1 shrink-0">
                  {source.sourceImageThumbnail && (
                    <WithImagePreview src={source.sourceImageThumbnail} label="元画像" sublabel={`案${source.proposalIndex}`}>
                      <img src={source.sourceImageThumbnail} alt="元画像"
                        className="w-12 h-12 rounded-lg object-cover border border-bg-border" />
                    </WithImagePreview>
                  )}
                  {source.resultImageData && (
                    <>
                      {source.sourceImageThumbnail && (
                        <span className="text-[10px] text-text-muted/40 leading-none">→</span>
                      )}
                      <WithImagePreview src={source.resultImageData} label="生成結果" sublabel={`案${source.proposalIndex}`}>
                        <img src={source.resultImageData} alt="生成結果"
                          className="w-12 h-12 rounded-lg object-cover border border-emerald-400/50" />
                      </WithImagePreview>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-bg-panel border border-bg-border flex items-center justify-center text-[9px] text-text-muted/40 shrink-0">
                  画像なし
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-text-muted/50 leading-none mb-1">元プロンプト</div>
                <div className="text-[12px] text-text-base/80 font-semibold leading-tight">
                  {formatDateTime(source.createdAt)}
                </div>
                <p className="text-[11px] text-text-muted/55 leading-snug mt-1 break-words"
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {source.promptText}
                </p>
              </div>
            </div>

            {/* 要素選択 */}
            <ElementSelector
              source={source}
              selectedScopes={selectedScopes}
              onToggleScope={onToggleScope}
              onSetScopes={onSetScopes}
            />

            {/* 🚨 「見えない支配」常時バッジ：このアレンジで全案に効くのに画面に出ない設定を可視化＋
                ワンクリック解除。背景2D化は selectedScopes に background がある時だけ（server ゲートと一致）。
                解除は App のライブ state を変えるため、次の「アレンジ生成」から外れる。 */}
            {hasDominator && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/12 px-2.5 py-2">
                {bgStylizeActive && (
                  <DominatorBadge
                    label="🌆 背景を2D/非写実に"
                    summary="既定ON・全案の背景をイラスト調に"
                    summaryTitle="背景の風景・空間をイラスト調に寄せる（人物・顔・肌は実写維持）。既定ON・背景が変更対象の時だけ全案に効く。"
                    onClear={onClearAvoidRealBg}
                    clearTitle="背景2D化をOFFにする（実写背景を許可。メインの回避▼トグルと同じ設定）"
                  />
                )}
                {worldNote && (
                  <DominatorBadge
                    label="🌐 世界観適用中"
                    summary={summarizeNote(worldNote)}
                    summaryTitle={worldCombinedNote}
                    onClear={onClearWorld}
                    clearTitle="この世界観を全案から解除する"
                  />
                )}
                {bgFires && (
                  <DominatorBadge
                    label="🌌 斬新背景適用中"
                    summary={summarizeNote(bgNote)}
                    summaryTitle={bgPresetNote}
                    onClear={onClearBg}
                    clearTitle="この斬新背景を全案から解除する"
                  />
                )}
                {refNote && (
                  <DominatorBadge
                    label="🖼 参照画像から適用中"
                    summary={summarizeNote(refNote)}
                    summaryTitle={referenceNoteText}
                    onClear={onClearReference}
                    clearTitle="参照画像からの適用を全案から解除する"
                  />
                )}
                {tagNg.length > 0 && (
                  <DominatorBadge
                    label="🚫 タグNG（候補除外・準備中）"
                    summary={tagNgLabels.join("・")}
                    summaryTitle={`NG指定したタグ（候補からの除外を準備中・現在は生成に未反映）：${tagNgLabels.join("、")}`}
                    onClear={onClearTagNg}
                    clearTitle="タグNGを全解除（値の選択は保持）"
                  />
                )}
              </div>
            )}

            {/* 生成枚数（アレンジ専用・メイン案数とは独立・非永続）。サーバ検証は 2-6。 */}
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[11px] font-bold text-violet-100 shrink-0">生成枚数</span>
              <div className="flex items-center gap-1">
                {([2, 3, 4, 5, 6] as Count[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onArrangeCountChange(c)}
                    className={[
                      "w-7 h-7 rounded-md text-[12px] font-bold border transition leading-none",
                      arrangeCount === c
                        ? "border-violet-400/80 bg-violet-500/25 text-violet-50 shadow-[0_0_6px_rgba(139,92,246,0.4)]"
                        : "border-bg-border bg-transparent text-text-muted/50 hover:border-violet-400/40 hover:text-text-base/80",
                    ].join(" ")}
                  >
                    {c}
                  </button>
                ))}
                <span className="text-[10px] text-text-muted/45 self-center ml-0.5">枚</span>
              </div>
            </div>

            {/* 生成ボタン */}
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate}
              className={[
                "w-full rounded-lg px-3 py-2 text-[12px] font-bold border transition",
                canGenerate
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                  : "border-bg-border bg-bg-panel/50 text-text-muted/40 cursor-not-allowed",
              ].join(" ")}
            >
              {busy ? "⏳ 生成中…" : selectedScopes.length === 0
                ? "⚠ 使用する要素を1つ以上選んでください"
                : "✨ 選択要素でアレンジ生成"}
            </button>

            {/* 結果 */}
            {result && !busy && (
              <>
                {/* 今回使用 / 除外 */}
                <div className="rounded-lg border border-bg-border bg-bg-base/40 px-2.5 py-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-emerald-300/70 font-semibold mr-0.5">今回使用：</span>
                    {usedAxes.length > 0 ? usedAxes.map((a) => (
                      <span key={a.scope} className="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-400/45 bg-violet-400/15 text-violet-100 leading-none">
                        {a.label}
                      </span>
                    )) : <span className="text-[10px] text-text-muted/40">なし</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-rose-300/60 font-semibold mr-0.5">今回除外：</span>
                    {excludedAxes.length > 0 ? excludedAxes.map((a) => (
                      <span key={a.scope} className="text-[10px] px-1.5 py-0.5 rounded-full border border-text-muted/25 bg-text-muted/5 text-text-muted/50 leading-none">
                        {a.label}
                      </span>
                    )) : <span className="text-[10px] text-text-muted/40">なし</span>}
                  </div>
                  <p className="text-[9px] text-text-muted/35 leading-snug">
                    ※除外要素は元プロンプトに記述があっても反映されません（固定・維持）。
                  </p>
                </div>

                {/* 案一覧（再利用スタジオ版） */}
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-text-muted/60">
                    アレンジ後プロンプト（{result.proposals.length}案）
                    <span className="ml-2 text-[10px] text-violet-300/65 font-normal">
                      各案に生成結果を貼り付けて評価・保存できます
                    </span>
                  </div>
                  {result.proposals.map((p, i) => {
                    const ls = proposalStates[i] ?? emptyProposalLocalState();
                    return (
                      <ArrangeProposalCard
                        key={p.index ?? i}
                        proposal={p}
                        index={i}
                        localState={ls}
                        onLocalStateChange={(next) => {
                          setProposalStates((prev) => {
                            const cp = [...prev];
                            cp[i] = next;
                            return cp;
                          });
                        }}
                        onSaveFavorite={onSaveFavorite}
                        onReArrange={onReArrange}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {/* 未生成ヒント */}
            {!result && !busy && (
              <p className="text-[11px] text-text-muted/45 text-center leading-relaxed py-2">
                使う要素を選んで「アレンジ生成」を押してください。
              </p>
            )}
          </>
        )}
      </div>

      {/* フッター：生成画面へ送る */}
      {result && (
        <div className="border-t border-violet-400/20 px-3.5 py-2.5 bg-bg-panel/40">
          <button type="button" onClick={onSendToGenerator}
            className="w-full rounded-lg px-3 py-2 text-[12px] font-bold border border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25 transition">
            🚀 この設定を生成画面へ送る
          </button>
        </div>
      )}
    </div>
  );
}
