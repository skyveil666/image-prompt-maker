import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ImageCropModal — 矩形ドラッグ選択によるトリミング専用モーダル（削除済み SimpleImageEditor.tsx
 * の crop 部分のみを抽出・再構成。erase/回転/フィルターは持ち込まない）。
 *
 * ★非破壊：クロップ結果は onCropped(dataUrl) で呼び出し元へ返すだけで、元画像 state には
 *   一切触れない（旧実装は onSave→setImageDataUrl で直接上書きしていた＝破壊的だった）。
 * undo/redo は ImageData スナップショット方式でモーダル内メモリのみに保持し、閉じたら破棄される
 * （React のアンマウントで自然に消える・永続化しない）。
 */

const MAX_UNDO = 20;

interface Props {
  imageDataUrl: string;
  onClose: () => void;
  /** クロップ確定時に呼ばれる。元画像 state（imageDataUrl）は書き換えない。 */
  onCropped: (dataUrl: string) => void;
}

export function ImageCropModal({ imageDataUrl, onClose, onCropped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [canUndo,  setCanUndo]  = useState(false);
  const [canRedo,  setCanRedo]  = useState(false);
  const [origSize, setOrigSize] = useState<{ w: number; h: number } | null>(null);

  // ドラッグ選択中の矩形（canvas ピクセル座標）
  const [cropDrag, setCropDrag] = useState({ active: false, x0: 0, y0: 0, x1: 0, y1: 0 });

  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);

  // ── 初期化：画像をcanvasへ ──────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setOrigSize({ w: img.naturalWidth, h: img.naturalHeight });
      canvas.getContext("2d")!.drawImage(img, 0, 0);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const syncUndoState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const saveSnapshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const snap = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    undoStack.current = [snap, ...undoStack.current].slice(0, MAX_UNDO);
    redoStack.current = [];
    syncUndoState();
  }, [syncUndoState]);

  const handleUndo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || undoStack.current.length === 0) return;
    const ctx  = c.getContext("2d")!;
    const curr = ctx.getImageData(0, 0, c.width, c.height);
    redoStack.current = [curr, ...redoStack.current].slice(0, MAX_UNDO);
    const prev = undoStack.current.shift()!;
    if (prev.width !== c.width || prev.height !== c.height) {
      c.width = prev.width; c.height = prev.height;
      setOrigSize({ w: prev.width, h: prev.height });
    }
    ctx.putImageData(prev, 0, 0);
    syncUndoState();
  }, [syncUndoState]);

  const handleRedo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || redoStack.current.length === 0) return;
    const ctx  = c.getContext("2d")!;
    const curr = ctx.getImageData(0, 0, c.width, c.height);
    undoStack.current = [curr, ...undoStack.current].slice(0, MAX_UNDO);
    const next = redoStack.current.shift()!;
    if (next.width !== c.width || next.height !== c.height) {
      c.width = next.width; c.height = next.height;
      setOrigSize({ w: next.width, h: next.height });
    }
    ctx.putImageData(next, 0, 0);
    syncUndoState();
  }, [syncUndoState]);

  // ── Canvas 座標変換 ───────────────────────────────────────────────────────

  const toCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width)  * c.width,
      y: ((e.clientY - r.top)  / r.height) * c.height,
    };
  }, []);

  // ── Crop ──────────────────────────────────────────────────────────────────

  const handleApplyCrop = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x0, y0, x1, y1 } = cropDrag;
    const x = Math.round(Math.min(x0, x1));
    const y = Math.round(Math.min(y0, y1));
    const w = Math.round(Math.abs(x1 - x0));
    const h = Math.round(Math.abs(y1 - y0));
    if (w < 8 || h < 8) return;
    saveSnapshot();
    const tmp = document.createElement("canvas");
    tmp.width  = w; tmp.height = h;
    tmp.getContext("2d")!.drawImage(c, -x, -y);
    c.width  = w; c.height = h;
    c.getContext("2d")!.drawImage(tmp, 0, 0);
    setOrigSize({ w, h });
    setCropDrag({ active: false, x0: 0, y0: 0, x1: 0, y1: 0 });
  }, [cropDrag, saveSnapshot]);

  // ── マウス操作（常にドラッグ選択＝トリミング専用なのでツール切替は無し） ──────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pos = toCanvasPos(e);
      setCropDrag({ active: true, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
    },
    [toCanvasPos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!cropDrag.active) return;
      const pos = toCanvasPos(e);
      setCropDrag((prev) => ({ ...prev, x1: pos.x, y1: pos.y }));
    },
    [toCanvasPos, cropDrag.active]
  );

  const handleMouseUp = useCallback(() => {
    setCropDrag((prev) => ({ ...prev, active: false }));
  }, []);

  // ── 確定（呼び出し元へ返すだけ・元画像stateには触れない） ────────────────────

  const exportDataUrl = useCallback((): string => {
    const c = canvasRef.current;
    return c ? c.toDataURL("image/png") : imageDataUrl;
  }, [imageDataUrl]);

  const handleConfirm = useCallback(() => {
    onCropped(exportDataUrl());
    onClose();
  }, [exportDataUrl, onCropped, onClose]);

  // ── キーボードショートカット ──────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault(); handleUndo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault(); handleRedo(); return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, handleUndo, handleRedo]);

  // ── クロップ選択オーバーレイの表示矩形（canvas-px → CSS-px） ─────────────────

  const cropDisplayRect = (() => {
    const c = canvasRef.current;
    if (!c || c.offsetWidth === 0) return null;
    const dw = Math.abs(cropDrag.x1 - cropDrag.x0);
    const dh = Math.abs(cropDrag.y1 - cropDrag.y0);
    if (dw < 8 || dh < 8) return null;
    const sx = c.offsetWidth  / c.width;
    const sy = c.offsetHeight / c.height;
    return {
      x: Math.min(cropDrag.x0, cropDrag.x1) * sx,
      y: Math.min(cropDrag.y0, cropDrag.y1) * sy,
      w: dw * sx,
      h: dh * sy,
    };
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col select-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#1c1e27] shrink-0 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm">✂</span>
          <span className="text-[13px] font-bold text-white/85">トリミング</span>
          <div className="flex items-center gap-1 ml-1">
            <button onClick={handleUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)"
              className="px-2 py-1 text-xs rounded-lg bg-white/6 hover:bg-white/12 disabled:opacity-25 text-white/65 transition">
              ↩ 戻す
            </button>
            <button onClick={handleRedo} disabled={!canRedo} title="やり直し (Ctrl+Y)"
              className="px-2 py-1 text-xs rounded-lg bg-white/6 hover:bg-white/12 disabled:opacity-25 text-white/65 transition">
              ↪ 進む
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleConfirm}
            className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-[0_0_12px_rgba(124,92,255,0.35)] transition">
            ✓ この内容で確定
          </button>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/45 hover:text-white/80 hover:bg-white/10 transition text-sm">
            ✕
          </button>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 flex items-center justify-center bg-[#101218] relative overflow-hidden min-w-0">
        {/* 透過チェッカー背景 */}
        <div className="absolute inset-0 opacity-35 pointer-events-none" style={{
          backgroundImage:
            "linear-gradient(45deg,#2a2a2a 25%,transparent 25%)," +
            "linear-gradient(-45deg,#2a2a2a 25%,transparent 25%)," +
            "linear-gradient(45deg,transparent 75%,#2a2a2a 75%)," +
            "linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        }} />

        <div className="relative" style={{ display: "inline-block", lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth:  "calc(100vw - 3.5rem)",
              maxHeight: "calc(100vh - 52px)",
              display:   "block",
              cursor:    "crosshair",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {cropDisplayRect && (
            <div
              className="absolute pointer-events-none border-2 border-white/90"
              style={{
                left:      cropDisplayRect.x,
                top:       cropDisplayRect.y,
                width:     cropDisplayRect.w,
                height:    cropDisplayRect.h,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.52)",
              }}
            >
              {[
                "top-0 left-0 -translate-x-0.5 -translate-y-0.5",
                "top-0 right-0 translate-x-0.5 -translate-y-0.5",
                "bottom-0 left-0 -translate-x-0.5 translate-y-0.5",
                "bottom-0 right-0 translate-x-0.5 translate-y-0.5",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-3 h-3 border-2 border-white bg-white/20 ${cls}`} />
              ))}
            </div>
          )}
        </div>

        {cropDisplayRect && (
          <button onClick={handleApplyCrop}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 px-5 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-xl transition z-10">
            ✂ クロップを適用
          </button>
        )}

        {origSize && (
          <div className="absolute top-2 right-2 text-[10px] text-white/30 bg-black/45 rounded px-1.5 py-0.5 pointer-events-none">
            {origSize.w} × {origSize.h}
          </div>
        )}
      </div>

      <p className="shrink-0 text-center text-[10px] text-white/25 py-1.5 bg-[#1c1e27] border-t border-white/8">
        画像をドラッグして範囲選択→「クロップを適用」。「この内容で確定」を押すまで元画像は変更されません。
      </p>
    </div>,
    document.body
  );
}
