import { useCallback, useEffect, useRef, useState } from "react";
import { imageContentHash } from "../lib/imageThumb";
import { readFileAsDataUrl } from "../lib/imageFile";

export interface UploadedMeta {
  fileName?: string;
  /** 元ファイル ArrayBuffer の SHA-256（直近画像の dedup 正本）。 */
  fileHash: string;
}

interface Props {
  value: string | null;
  /**
   * 新しい画像を受け取った時のコールバック。
   * `meta` には正本ハッシュとファイル名が入る。`null` で呼ばれるのは「画像をクリア」時のみ。
   */
  onChange: (dataUrl: string | null, meta?: UploadedMeta) => void;
}

export function ImageUploader({ value, onChange }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) return;
      // readAsDataUrl を先に待ち、content hash（ピクセル一致）を計算する
      // → PNG/JPEG 等フォーマットが異なっても同じ画像なら同じ ID になり重複を防ぐ
      const url = await readFileAsDataUrl(file);
      const hash = await imageContentHash(url);
      onChange(url, { fileName: file.name, fileHash: hash });
    },
    [onChange]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // テキスト入力欄にフォーカスがある場合はテキストペーストを妨げない
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            void handleFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      void handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl px-4 py-2.5 font-semibold text-sm bg-gradient-to-r from-accent to-sky-500 text-white hover:brightness-110 transition shadow-[0_0_18px_rgba(124,92,255,0.35)] flex items-center justify-center gap-2"
      >
        <span className="text-base">📁</span>
        <span>フォルダー参照</span>
      </button>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "relative border-2 border-dashed rounded-2xl transition cursor-pointer",
          "min-h-[200px] flex items-center justify-center text-center",
          dragOver
            ? "border-accent bg-accent/10"
            : "border-bg-border bg-bg-panel hover:border-accent/60",
        ].join(" ")}
      >
        {value ? (
          <img
            src={value}
            alt="preview"
            className="max-h-[420px] rounded-xl object-contain"
          />
        ) : (
          <div className="px-4 py-10 text-text-muted">
            <div className="text-3xl mb-2">⬆</div>
            <div className="text-sm">
              画像をドラッグ＆ドロップ / クリック / Ctrl+V で貼り付け
            </div>
            <div className="text-xs mt-1 opacity-80">
              （アップロードはローカル表示のみ・送信されません）
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
      {value && (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn text-sm"
            onClick={() => onChange(null)}
          >
            画像をクリア
          </button>
        </div>
      )}
    </div>
  );
}
