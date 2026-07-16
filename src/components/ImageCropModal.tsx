import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ImageCropModal — 矩形選択（角/辺ハンドルで伸縮・内側ドラッグで移動）によるトリミング専用モーダル
 * （削除済み SimpleImageEditor.tsx の crop 部分のみを抽出・再構成。erase/回転/フィルターは持ち込まない）。
 *
 * ★非破壊：クロップ結果は onCropped(dataUrl) で呼び出し元へ返すだけで、元画像 state には
 *   一切触れない（旧実装は onSave→setImageDataUrl で直接上書きしていた＝破壊的だった）。
 * undo/redo は ImageData スナップショット方式でモーダル内メモリのみに保持し、閉じたら破棄される
 * （React のアンマウントで自然に消える・永続化しない）。
 */

const MAX_UNDO = 20;
/** 選択範囲の最小サイズ（canvas ピクセル）。 */
const MIN_SIZE = 10;
/** ハンドルの当たり判定マージン（CSS ピクセル。画像の表示倍率に応じて canvas px へ換算する）。 */
const HANDLE_MARGIN_CSS = 10;

interface Props {
  imageDataUrl: string;
  onClose: () => void;
  /** クロップ確定時に呼ばれる。元画像 state（imageDataUrl）は書き換えない。 */
  onCropped: (dataUrl: string) => void;
}

/** 選択範囲（canvas ピクセル座標・常に正規化＝w/h は非負）。 */
interface SelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ハンドル種別：8方位（4隅＋4辺）／内側移動／新規描画。 */
type DragMode = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move" | "draw";

const CURSOR_BY_MODE: Record<DragMode, string> = {
  nw: "nwse-resize", se: "nwse-resize",
  ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
  move: "move",
  draw: "crosshair",
};

/** pos が sel のどの操作対象に当たるかを判定する（隅優先→辺→内側→外側）。 */
function hitTest(pos: { x: number; y: number }, sel: SelRect, margin: number): DragMode {
  const left = sel.x, right = sel.x + sel.w, top = sel.y, bottom = sel.y + sel.h;
  const nearLeft   = Math.abs(pos.x - left)   <= margin;
  const nearRight  = Math.abs(pos.x - right)  <= margin;
  const nearTop    = Math.abs(pos.y - top)    <= margin;
  const nearBottom = Math.abs(pos.y - bottom) <= margin;
  const withinX = pos.x >= left - margin && pos.x <= right + margin;
  const withinY = pos.y >= top - margin && pos.y <= bottom + margin;

  if (nearLeft  && nearTop    && withinX && withinY) return "nw";
  if (nearRight && nearTop    && withinX && withinY) return "ne";
  if (nearLeft  && nearBottom && withinX && withinY) return "sw";
  if (nearRight && nearBottom && withinX && withinY) return "se";
  if (nearTop    && withinX) return "n";
  if (nearBottom && withinX) return "s";
  if (nearLeft   && withinY) return "w";
  if (nearRight  && withinY) return "e";
  if (pos.x > left && pos.x < right && pos.y > top && pos.y < bottom) return "move";
  return "draw";
}

export function ImageCropModal({ imageDataUrl, onClose, onCropped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [canUndo,  setCanUndo]  = useState(false);
  const [canRedo,  setCanRedo]  = useState(false);
  const [origSize, setOrigSize] = useState<{ w: number; h: number } | null>(null);

  // 選択範囲（確定後も保持し、ハンドル/内側ドラッグで再調整できる）。
  const [selection, setSelection] = useState<SelRect | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>("crosshair");
  // ドラッグ中の操作情報（mousedown 時点のモードと基準値）。再描画不要なので ref。
  const dragRef = useRef<{ mode: DragMode; startPos: { x: number; y: number }; startSel: SelRect | null } | null>(null);

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

  // ── Undo / Redo（selection は canvas サイズが変わりうるため破棄する） ────────

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
    setSelection(null);
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
    setSelection(null);
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

  /** CSS px のハンドル余裕を、現在の表示倍率から canvas px へ換算する。 */
  const marginInCanvasPx = useCallback((): number => {
    const c = canvasRef.current;
    if (!c || !c.offsetWidth) return HANDLE_MARGIN_CSS;
    return HANDLE_MARGIN_CSS * (c.width / c.offsetWidth);
  }, []);

  const clampSel = useCallback((sel: SelRect): SelRect => {
    const c = canvasRef.current;
    const cw = c?.width ?? sel.x + sel.w;
    const ch = c?.height ?? sel.y + sel.h;
    const w = Math.min(sel.w, cw);
    const h = Math.min(sel.h, ch);
    const x = Math.min(Math.max(sel.x, 0), cw - w);
    const y = Math.min(Math.max(sel.y, 0), ch - h);
    return { x, y, w, h };
  }, []);

  // ── Crop ──────────────────────────────────────────────────────────────────

  const handleApplyCrop = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !selection) return;
    const x = Math.round(selection.x);
    const y = Math.round(selection.y);
    const w = Math.round(selection.w);
    const h = Math.round(selection.h);
    if (w < MIN_SIZE || h < MIN_SIZE) return;
    saveSnapshot();
    const tmp = document.createElement("canvas");
    tmp.width  = w; tmp.height = h;
    tmp.getContext("2d")!.drawImage(c, -x, -y);
    c.width  = w; c.height = h;
    c.getContext("2d")!.drawImage(tmp, 0, 0);
    setOrigSize({ w, h });
    setSelection(null);
  }, [selection, saveSnapshot]);

  // ── マウス操作：新規描画／隅・辺ハンドルで伸縮／内側ドラッグで移動 ────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pos = toCanvasPos(e);
      const mode: DragMode = selection ? hitTest(pos, selection, marginInCanvasPx()) : "draw";
      dragRef.current = { mode, startPos: pos, startSel: selection };
      if (mode === "draw") {
        setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 });
      }
    },
    [selection, toCanvasPos, marginInCanvasPx]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = toCanvasPos(e);
      const drag = dragRef.current;
      const c = canvasRef.current;

      if (!drag) {
        // ドラッグ中でなければホバー中のカーソル形状だけ更新する
        setHoverCursor(selection ? CURSOR_BY_MODE[hitTest(pos, selection, marginInCanvasPx())] : "crosshair");
        return;
      }

      const { mode, startPos, startSel } = drag;
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      const cw = c?.width ?? 0;
      const ch = c?.height ?? 0;

      if (mode === "draw") {
        const x = Math.min(startPos.x, pos.x);
        const y = Math.min(startPos.y, pos.y);
        const w = Math.abs(pos.x - startPos.x);
        const h = Math.abs(pos.y - startPos.y);
        setSelection(clampSel({ x, y, w, h }));
        return;
      }
      if (!startSel) return;
      if (mode === "move") {
        const x = Math.min(Math.max(startSel.x + dx, 0), cw - startSel.w);
        const y = Math.min(Math.max(startSel.y + dy, 0), ch - startSel.h);
        setSelection({ ...startSel, x, y });
        return;
      }
      // 隅／辺ハンドル：対象の辺だけ動かす（反対側の辺は固定）。最小サイズ・画像境界でクランプ。
      let left = startSel.x, top = startSel.y;
      let right = startSel.x + startSel.w, bottom = startSel.y + startSel.h;
      if (mode.includes("n")) top    = Math.min(top    + dy, bottom - MIN_SIZE);
      if (mode.includes("s")) bottom = Math.max(bottom + dy, top    + MIN_SIZE);
      if (mode.includes("w")) left   = Math.min(left   + dx, right  - MIN_SIZE);
      if (mode.includes("e")) right  = Math.max(right  + dx, left   + MIN_SIZE);
      left = Math.max(0, left); top = Math.max(0, top);
      right = Math.min(cw, right); bottom = Math.min(ch, bottom);
      setSelection({ x: left, y: top, w: right - left, h: bottom - top });
    },
    [toCanvasPos, selection, marginInCanvasPx, clampSel]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
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

  // ── 選択範囲の表示矩形（canvas-px → CSS-px） ─────────────────────────────

  const cropDisplayRect = (() => {
    const c = canvasRef.current;
    if (!c || c.offsetWidth === 0 || !selection) return null;
    if (selection.w < MIN_SIZE || selection.h < MIN_SIZE) return null;
    const sx = c.offsetWidth  / c.width;
    const sy = c.offsetHeight / c.height;
    return {
      x: selection.x * sx,
      y: selection.y * sy,
      w: selection.w * sx,
      h: selection.h * sy,
    };
  })();

  // 隅ハンドル4つ＋辺ハンドル4つの見た目位置（オーバーレイ内の相対配置クラス）。
  // ★このdiv自体はpointer-events-noneの親を継承しクリックを受けない（当たり判定はcanvas側で
  //   一元処理・hitTest()）ため、cursorクラスは付けない（付けても適用されず死んだ指定になる）。
  const CORNER_HANDLES: { cls: string; mode: DragMode }[] = [
    { cls: "top-0 left-0 -translate-x-1/2 -translate-y-1/2", mode: "nw" },
    { cls: "top-0 right-0 translate-x-1/2 -translate-y-1/2", mode: "ne" },
    { cls: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", mode: "sw" },
    { cls: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", mode: "se" },
  ];
  const EDGE_HANDLES: { cls: string; mode: DragMode }[] = [
    { cls: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2", mode: "n" },
    { cls: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2", mode: "s" },
    { cls: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2", mode: "w" },
    { cls: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2", mode: "e" },
  ];

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
              cursor:    hoverCursor,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* 選択オーバーレイ：pointer-events-none のまま（当たり判定は canvas 側で一元処理）。
              ハンドルは見た目のみ・cursor だけ hoverCursor と同じ値をヒントとして持たせる。 */}
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
              {CORNER_HANDLES.map(({ cls, mode }) => (
                <div key={mode} className={`absolute w-3 h-3 border-2 border-white bg-white/20 ${cls}`} />
              ))}
              {EDGE_HANDLES.map(({ cls, mode }) => (
                <div key={mode} className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white bg-white/20 ${cls}`} />
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
        ドラッグで範囲選択。角/辺のハンドルで伸縮、内側ドラッグで移動できます。「クロップを適用」で確定→
        「この内容で確定」を押すまで元画像は変更されません。
      </p>
    </div>,
    document.body
  );
}
