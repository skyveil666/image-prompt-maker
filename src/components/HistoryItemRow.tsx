import { useState } from "react";
import type { PromptHistoryItem } from "../types";
import { FavoriteButton } from "./FavoriteButton";
import { WithImagePreview } from "./ImagePreviewTooltip";
import { getResultImages } from "../lib/history";
import { confirmUnfavorite } from "../lib/favoriteConfirm";
import { formatDateTime } from "../lib/format";
import { ALL_SCOPE_LABELS as SCOPE_LABEL } from "../lib/scopeLabels";

interface Props {
  item: PromptHistoryItem;
  onUpdate: (id: string, patch: Partial<PromptHistoryItem>) => void;
  onDelete: (id: string) => void;
  onArrange?: (item: PromptHistoryItem) => void;
  /** 同じ構成で再生成：全設定をメイン画面に復元する */
  onRestore?: (item: PromptHistoryItem) => void;
  /** アレンジ元としてハイライト表示する */
  highlight?: boolean;
  /** このカードのアレンジが生成中 */
  busy?: boolean;
}

// Scope→ラベルは scopeLabels.ts に一本化（SCOPE_LABEL は別名 import）。

export function HistoryItemRow({ item, onUpdate, onDelete, onArrange, onRestore, highlight, busy }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const targetLabel =
    item.outputType === "unified"
      ? "統一"
      : item.outputType === "nano_gemini"
      ? "Nano Banana（旧）"
      : "ChatGPT（旧）";
  const targetColor =
    item.outputType === "unified"
      ? "border-accent/60 bg-accent/15 text-text-base"
      : item.outputType === "nano_gemini"
      ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
      : "border-fuchsia-400/60 bg-fuchsia-400/15 text-fuchsia-200";

  return (
    <article
      className={[
        "relative rounded-xl border overflow-hidden transition",
        highlight
          ? "border-violet-400 bg-violet-500/8 shadow-[0_0_0_1px_rgba(192,132,252,0.55),0_0_20px_rgba(192,132,252,0.35)]"
          : "border-bg-border bg-bg-card hover:border-accent/60 hover:shadow-[0_0_14px_-2px_rgba(124,92,255,0.45)]",
      ].join(" ")}
    >
      {/* アレンジ元バッジ */}
      {highlight && (
        <span className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-violet-300/60 bg-violet-500/30 text-violet-50 leading-none shadow">
          ✨ アレンジ元
        </span>
      )}
      <div className="p-3 flex gap-3">
        {/* サムネイル：生成結果がある場合はチェーン表示（複数枚なら横並び） */}
        {(() => { const results = getResultImages(item); return results.length > 0; })() ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            {item.sourceImageThumbnail ? (
              <WithImagePreview
                src={item.sourceImageThumbnail}
                label="元画像"
                sublabel={`案${item.proposalIndex}`}
              >
                <img
                  src={item.sourceImageThumbnail}
                  alt="元画像"
                  className="w-10 h-10 rounded-lg object-cover border border-bg-border cursor-zoom-in"
                />
              </WithImagePreview>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-bg-panel border border-bg-border flex items-center justify-center text-[8px] text-text-muted text-center leading-tight flex-shrink-0">
                なし
              </div>
            )}
            <span className="text-[10px] text-text-muted/40 leading-none flex-shrink-0">→</span>
            {/* 生成結果（最大3枚を縦に細く並べる：1枚なら大きく・複数なら積み重ね） */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {getResultImages(item).map((url, i) => (
                <WithImagePreview
                  key={`${i}-${url}`}
                  src={url}
                  label={`生成結果 ${i + 1}`}
                  sublabel={`案${item.proposalIndex}`}
                >
                  <div className="relative">
                    <img
                      src={url}
                      alt={`生成結果 ${i + 1}`}
                      className="w-10 h-10 rounded-lg object-cover border border-emerald-400/50 cursor-zoom-in"
                    />
                    {getResultImages(item).length > 1 && (
                      <span className="absolute -bottom-0.5 -right-0.5 px-1 rounded bg-black/70 text-emerald-200/95 text-[8px] leading-none font-bold pointer-events-none">
                        {i + 1}
                      </span>
                    )}
                  </div>
                </WithImagePreview>
              ))}
            </div>
          </div>
        ) : item.sourceImageThumbnail ? (
          <WithImagePreview
            src={item.sourceImageThumbnail}
            label="元画像"
            sublabel={`案${item.proposalIndex}`}
          >
            <img
              src={item.sourceImageThumbnail}
              alt="thumb"
              className="w-16 h-16 rounded-lg object-cover bg-bg-panel border border-bg-border cursor-zoom-in"
            />
          </WithImagePreview>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-bg-panel border border-bg-border flex items-center justify-center text-[10px] text-text-muted flex-shrink-0">
            画像なし
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${targetColor}`}>
              {targetLabel} 案{item.proposalIndex}
            </span>
            {(item.scopes ?? []).slice(0, 4).map((s) => (
              <span
                key={s}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-accent/40 bg-accent/10"
              >
                {SCOPE_LABEL[s]}
              </span>
            ))}
            {(item.scopes ?? []).length > 4 && (
              <span className="text-[10px] text-text-muted">+{(item.scopes ?? []).length - 4}</span>
            )}
            {item.viralMode && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-400/40 bg-rose-400/15 text-rose-200">
                🔥
              </span>
            )}
            <span className="text-[13px] font-semibold text-white/90 ml-auto whitespace-nowrap">{formatDateTime(item.createdAt)}</span>
          </div>
          <p
            className="text-xs text-text-base/90 break-words"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: "1.6",
            }}
          >
            {item.promptText}
          </p>
        </div>
      </div>

      <div className="px-3 pb-3 flex items-center gap-1.5 flex-wrap border-t border-bg-border/60 pt-3">
        <FavoriteButton
          active={item.isFavorite}
          onToggle={() => {
            if (item.isFavorite && !confirmUnfavorite()) return;
            onUpdate(item.id, { isFavorite: !item.isFavorite });
          }}
        />
        {onArrange && (
          <button
            type="button"
            disabled={busy}
            className={[
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition disabled:opacity-70",
              highlight
                ? "border-violet-400/80 bg-violet-400/25 text-violet-100"
                : "border-violet-400/50 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 hover:border-violet-400/80",
            ].join(" ")}
            onClick={() => onArrange(item)}
            title="このプロンプトをベースに、その場でアレンジ案を生成（右パネルに表示）"
          >
            {busy ? "⏳ アレンジ中…" : "✨ アレンジ"}
          </button>
        )}
        {onRestore && (
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-sky-400/50 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20 hover:border-sky-400/80 transition"
            onClick={() => onRestore(item)}
            title="元画像・変更対象・詳細設定など、当時の全設定をメイン画面に復元してすぐ再生成できます"
          >
            🔁 同じ構成で再生成
          </button>
        )}
        <button
          type="button"
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-bg-border bg-bg-panel/70 text-text-muted hover:text-text-base hover:border-accent/40 transition"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "閉じる" : "詳細を見る"}
        </button>
        {deleteConfirm ? (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-text-muted">削除しますか？</span>
            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 text-xs border border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/35 transition"
              onClick={() => { setDeleteConfirm(false); onDelete(item.id); }}
            >
              削除する
            </button>
            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 text-xs border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition"
              onClick={() => setDeleteConfirm(false)}
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ml-auto rounded-lg px-2.5 py-1.5 text-xs border border-bg-border text-text-muted hover:text-rose-200 hover:border-rose-400/40 transition"
            onClick={() => setDeleteConfirm(true)}
          >
            削除
          </button>
        )}
      </div>

    </article>
  );
}
