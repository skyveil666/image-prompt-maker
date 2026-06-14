/**
 * HistoryMiniExplorer — 履歴/カレンダー画面の左サイドバー用 小型 Explorer
 *
 * 役割：
 *   - ローカルフォルダの画像を参照する
 *   - 最近使った画像をサムネイル表示する
 *   - クリックで画像を選択し、右アレンジパネルへ「参照画像」として渡す
 *
 * カレンダーとお気に入り分析の間に配置する。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { listRecentImages, addRecentImage, type RecentImageItem } from "../lib/recentImages";
import { fileToThumbnail } from "../lib/imageFile";

interface Props {
  /** 選択中の画像 dataURL（親へ lift-up） */
  selectedImage: string | null;
  onSelectImage: (url: string | null) => void;
  /** 「この画像をアレンジ参照に使う」ボタンを押したとき */
  onUseForArrange: (url: string) => void;
}

export function HistoryMiniExplorer({ selectedImage, onSelectImage, onUseForArrange }: Props) {
  const [recentImages, setRecentImages] = useState<RecentImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 起動時に最近の画像を読み込む
  useEffect(() => {
    void listRecentImages().then(setRecentImages);
  }, []);

  // ファイル / フォルダ選択
  const openFilePicker = useCallback(async () => {
    // 単一ファイル選択（fsa.d.ts の showOpenFilePicker を使用）
    if (typeof window !== "undefined" && "showOpenFilePicker" in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: "Images", accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"] } }],
          multiple: false,
        });
        const file = await (handle as FileSystemFileHandle).getFile();
        await processImageFile(file);
      } catch (e) {
        // キャンセル時はスルー
      }
      return;
    }
    // フォールバック：input[type=file]
    fileInputRef.current?.click();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setLoading(true);
    try {
      const thumb = await fileToThumbnail(file, 400, 0.85);
      if (thumb) {
        onSelectImage(thumb);
        // 最近の画像に追加
        await addRecentImage({ imageHash: `hist-${Date.now()}`, originalDataUrl: thumb });
        const fresh = await listRecentImages();
        setRecentImages(fresh);
      }
    } finally {
      setLoading(false);
    }
  }, [onSelectImage]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void processImageFile(f);
    e.target.value = "";
  }, [processImageFile]);

  // Ctrl+V ペースト（このコンポーネント内にフォーカスがある時）
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const img = items.find((it) => it.type.startsWith("image/"))?.getAsFile();
      if (img) { e.preventDefault(); void processImageFile(img); }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [processImageFile]);

  return (
    <div className="rounded-2xl border border-sky-400/25 bg-sky-500/5 overflow-hidden">
      {/* ヘッダー */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/3 transition text-left"
      >
        <span className="text-[13px]">📁</span>
        <span className="text-[12px] font-bold text-sky-100">Explorer mini</span>
        {selectedImage && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-400/55 bg-emerald-500/15 text-emerald-200 leading-none">
            選択中
          </span>
        )}
        <span className="ml-auto text-[10px] text-text-muted/45">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-sky-400/15">
          {/* フォルダを開くボタン */}
          <div className="pt-2 flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={loading}
              className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border border-sky-400/50 bg-sky-400/12 text-sky-100 hover:bg-sky-400/22 transition disabled:opacity-50"
            >
              {loading ? "読み込み中…" : "📂 フォルダを開く"}
            </button>
            {selectedImage && (
              <button
                type="button"
                onClick={() => onSelectImage(null)}
                className="rounded-lg px-2 py-1.5 text-[11px] border border-rose-400/35 bg-rose-400/8 text-rose-200 hover:bg-rose-400/18 transition"
              >
                クリア
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />

          {/* 最近の画像サムネイル */}
          {recentImages.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted/55 mb-1.5 font-semibold">最近の画像</p>
              <div className="grid grid-cols-4 gap-1">
                {recentImages.slice(0, 12).map((img) => {
                  const isSelected = selectedImage === img.thumbnailDataUrl || selectedImage === img.imageDataUrl;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => onSelectImage(img.imageDataUrl ?? img.thumbnailDataUrl)}
                      title="この画像を選択"
                      className={[
                        "relative aspect-square rounded-md overflow-hidden border-2 transition cursor-pointer",
                        isSelected
                          ? "border-sky-400/85 shadow-[0_0_8px_-1px_rgba(56,189,248,0.6)]"
                          : "border-transparent hover:border-sky-400/50",
                      ].join(" ")}
                    >
                      <img
                        src={img.thumbnailDataUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <span className="absolute bottom-0 left-0 right-0 bg-sky-500/80 text-white text-[8px] text-center leading-tight py-0.5 font-bold">
                          選択中
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 選択中プレビュー */}
          {selectedImage && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-sky-200/70 font-semibold">選択中</p>
              <div className="rounded-lg overflow-hidden border border-sky-400/45 shadow-[0_0_10px_-2px_rgba(56,189,248,0.4)]">
                <img
                  src={selectedImage}
                  alt="選択中の画像"
                  className="w-full object-contain max-h-36 bg-black/30"
                />
              </div>
              <button
                type="button"
                onClick={() => onUseForArrange(selectedImage)}
                className="w-full rounded-lg py-1.5 text-[11px] font-bold border border-violet-400/60 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30 transition"
              >
                ✨ この画像をアレンジ参照に使う
              </button>
            </div>
          )}

          {recentImages.length === 0 && !selectedImage && (
            <p className="text-[10px] text-text-muted/45 text-center py-2 leading-snug">
              「フォルダを開く」または Ctrl+V で<br />画像を追加できます
            </p>
          )}
        </div>
      )}
    </div>
  );
}
