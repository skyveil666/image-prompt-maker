import { useState } from "react";
import type { RecentImageItem } from "../lib/recentImages";
import { MAX_RECENT } from "../lib/recentImages";

interface Props {
  recents: RecentImageItem[];
  currentId: string | null;
  onSelect: (item: RecentImageItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

/**
 * 左サイドバー内、画像アップローダーの下に表示する「直近の画像」グリッド。
 *  - lg 以上：2 列グリッド
 *  - スマホ：横スクロール 1 行
 */
export function RecentImages({
  recents,
  currentId,
  onSelect,
  onDelete,
  onClear,
}: Props) {
  // インライン確認ステート（confirm() の代わり）
  const [clearConfirm, setClearConfirm] = useState(false);

  if (recents.length === 0) {
    return (
      <section className="card !p-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[12px] font-semibold uppercase tracking-widest text-text-muted/90">
            直近の画像
          </h3>
          <span className="text-[11px] text-text-muted/85">最大{MAX_RECENT}枚</span>
        </div>
        <p className="text-[13px] text-text-muted/85 mt-2">
          まだ履歴がありません。画像をアップロードすると、ここに自動で残ります。
        </p>
      </section>
    );
  }

  return (
    <section className="card !p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-text-muted/90">
          直近の画像
        </h3>
        {clearConfirm ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { onClear(); setClearConfirm(false); }}
              className="text-[10px] text-rose-300 hover:text-rose-100 transition font-semibold"
            >
              削除する
            </button>
            <button
              type="button"
              onClick={() => setClearConfirm(false)}
              className="text-[10px] text-text-muted hover:text-text-base transition"
            >
              キャンセル
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setClearConfirm(true)}
            className="text-[11px] text-text-muted/80 hover:text-rose-300 transition"
          >
            履歴をクリア
          </button>
        )}
      </div>

      {/* スマホ：横スクロール / lg：2 列グリッド */}
      <div
        className={[
          "lg:grid lg:grid-cols-2 lg:gap-2",
          "flex gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0",
        ].join(" ")}
      >
        {recents.map((item) => {
          const isCurrent = item.id === currentId;
          return (
            <div
              key={item.id}
              className={[
                "relative group flex-shrink-0 lg:flex-shrink rounded-lg overflow-hidden border-2 transition cursor-pointer aspect-square w-24 lg:w-auto",
                isCurrent
                  ? "border-accent shadow-[0_0_0_2px_rgba(124,92,255,0.45)]"
                  : "border-bg-border hover:border-accent/60",
              ].join(" ")}
              onClick={() => onSelect(item)}
              title={item.fileName}
            >
              <img
                src={item.thumbnailDataUrl}
                alt={item.fileName}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label="削除"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 transition"
              >
                ×
              </button>
              {isCurrent && (
                <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/90 text-white font-semibold">
                  選択中
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
