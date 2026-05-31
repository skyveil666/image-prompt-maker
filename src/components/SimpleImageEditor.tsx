import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Types ────────────────────────────────────────────────────────────────────

type Tool      = "select" | "crop" | "erase";
type TabPanel  = "adjustments" | "filters";

interface Adjustments {
  brightness: number; // -100..100
  contrast:   number; // -100..100
  saturation: number; // -100..100
  highlights: number; // -100..100
  shadows:    number; // -100..100
  colorTemp:  number; // -100..100  (neg=cool, pos=warm)
}

const DEFAULT_ADJ: Adjustments = {
  brightness: 0,
  contrast:   0,
  saturation: 0,
  highlights: 0,
  shadows:    0,
  colorTemp:  0,
};

// ── Filter presets ───────────────────────────────────────────────────────────

const FILTER_PRESETS = [
  { id: "none",    label: "なし",         css: "" },
  { id: "mono",    label: "モノクロ",     css: "grayscale(1)" },
  { id: "sepia",   label: "セピア",       css: "sepia(0.8) saturate(0.9)" },
  { id: "vivid",   label: "ビビッド",     css: "saturate(1.8) contrast(1.1)" },
  { id: "soft",    label: "ソフト",       css: "brightness(1.08) contrast(0.88) saturate(0.88)" },
  { id: "cinema",  label: "シネマ",       css: "contrast(1.25) saturate(0.75) brightness(0.92)" },
  { id: "retro",   label: "レトロ",       css: "sepia(0.35) saturate(0.7) contrast(1.1) hue-rotate(10deg)" },
  { id: "summer",  label: "夏",           css: "saturate(1.35) brightness(1.1) hue-rotate(8deg)" },
  { id: "winter",  label: "冬",           css: "saturate(0.7) brightness(1.05) hue-rotate(-15deg) contrast(1.05)" },
  { id: "dreamy",  label: "ドリーミー",   css: "brightness(1.12) saturate(0.78) contrast(0.88)" },
  { id: "hard",    label: "ハードライト", css: "contrast(1.45) saturate(1.25) brightness(0.92)" },
] as const;

// ── CSS filter string builder ────────────────────────────────────────────────

function buildFilter(adj: Adjustments, presetId: string): string {
  // Highlights: adds to effective brightness; Shadows: reduces contrast slightly (lifts darks)
  const b = (1 + adj.brightness / 100 + adj.highlights / 300).toFixed(3);
  const c = (1 + adj.contrast   / 100 - adj.shadows   / 300).toFixed(3);
  const s = (1 + adj.saturation / 100).toFixed(3);

  let tempCss = "";
  if (adj.colorTemp > 0) {
    const a = (adj.colorTemp / 100 * 0.32).toFixed(3);
    tempCss = ` sepia(${a})`;
  } else if (adj.colorTemp < 0) {
    const deg = (-adj.colorTemp / 100 * 22).toFixed(1);
    tempCss = ` hue-rotate(-${deg}deg) saturate(1.12)`;
  }

  const presetCss = FILTER_PRESETS.find((p) => p.id === presetId)?.css ?? "";
  const parts = [`brightness(${b})`, `contrast(${c})`, `saturate(${s})`];
  if (tempCss.trim()) parts.push(tempCss.trim());
  if (presetCss)       parts.push(presetCss);
  return parts.join(" ");
}

// ── Slider row ───────────────────────────────────────────────────────────────

function SliderRow({
  label, emoji, value, onChange,
}: {
  label: string; emoji: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-white/60">{emoji} {label}</span>
        <span className="text-[11px] font-mono text-white/38 w-9 text-right">
          {value > 0 ? "+" : ""}{value}
        </span>
      </div>
      <input
        type="range" min={-100} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-violet-500 cursor-pointer"
      />
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  imageDataUrl: string;
  onClose: () => void;
  /** Called with the final PNG data URL when user clicks "画像に反映" */
  onSave: (dataUrl: string) => void;
}

const MAX_UNDO = 20;

// ── Component ────────────────────────────────────────────────────────────────

export function SimpleImageEditor({ imageDataUrl, onClose, onSave }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const [tool,      setTool]     = useState<Tool>("select");
  const [tab,       setTab]      = useState<TabPanel>("adjustments");
  const [adj,       setAdj]      = useState<Adjustments>(DEFAULT_ADJ);
  const [presetId,  setPresetId] = useState<string>("none");
  const [eraseSize, setEraseSize] = useState(36);
  const [painting,  setPainting] = useState(false);
  const [canUndo,   setCanUndo]  = useState(false);
  const [canRedo,   setCanRedo]  = useState(false);
  const [copyDone,  setCopyDone] = useState(false);
  const [origSize,  setOrigSize] = useState<{ w: number; h: number } | null>(null);

  // Crop drag state (canvas-pixel coordinates)
  const [cropDrag, setCropDrag] = useState({
    active: false, x0: 0, y0: 0, x1: 0, y1: 0,
  });

  const undoStack  = useRef<ImageData[]>([]);
  const redoStack  = useRef<ImageData[]>([]);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

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

  // ── Rotate ────────────────────────────────────────────────────────────────

  const handleRotate = useCallback((dir: 1 | -1) => {
    const c = canvasRef.current;
    if (!c) return;
    saveSnapshot();
    const tmp = document.createElement("canvas");
    tmp.width  = c.height;
    tmp.height = c.width;
    const tc = tmp.getContext("2d")!;
    tc.translate(tmp.width / 2, tmp.height / 2);
    tc.rotate((dir * Math.PI) / 2);
    tc.drawImage(c, -c.width / 2, -c.height / 2);
    c.width  = tmp.width;
    c.height = tmp.height;
    c.getContext("2d")!.drawImage(tmp, 0, 0);
    setOrigSize({ w: c.width, h: c.height });
  }, [saveSnapshot]);

  // ── Canvas coordinate helpers ─────────────────────────────────────────────

  const toCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width)  * c.width,
      y: ((e.clientY - r.top)  / r.height) * c.height,
    };
  }, []);

  // ── Erase ─────────────────────────────────────────────────────────────────

  const eraseLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const c   = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth   = eraseSize;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x,   to.y);
      ctx.stroke();
      ctx.restore();
    },
    [eraseSize]
  );

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
    setTool("select");
  }, [cropDrag, saveSnapshot]);

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pos = toCanvasPos(e);
      if (tool === "erase") {
        saveSnapshot();
        lastPosRef.current = pos;
        setPainting(true);
        eraseLine(pos, pos);
      } else if (tool === "crop") {
        setCropDrag({ active: true, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
      }
    },
    [tool, saveSnapshot, toCanvasPos, eraseLine]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = toCanvasPos(e);
      if (tool === "erase" && painting) {
        if (lastPosRef.current) eraseLine(lastPosRef.current, pos);
        lastPosRef.current = pos;
      } else if (tool === "crop" && cropDrag.active) {
        setCropDrag((prev) => ({ ...prev, x1: pos.x, y1: pos.y }));
      }
    },
    [tool, painting, toCanvasPos, eraseLine, cropDrag.active]
  );

  const handleMouseUp = useCallback(() => {
    setPainting(false);
    lastPosRef.current = null;
    if (tool === "crop") setCropDrag((prev) => ({ ...prev, active: false }));
  }, [tool]);

  // ── Export ────────────────────────────────────────────────────────────────

  const exportDataUrl = useCallback((): string => {
    const src = canvasRef.current;
    if (!src) return imageDataUrl;
    const hasFilter =
      Object.values(adj).some((v) => v !== 0) || presetId !== "none";
    const out = document.createElement("canvas");
    out.width  = src.width;
    out.height = src.height;
    const ctx  = out.getContext("2d")!;
    if (hasFilter) ctx.filter = buildFilter(adj, presetId);
    ctx.drawImage(src, 0, 0);
    if (hasFilter) ctx.filter = "none";
    return out.toDataURL("image/png");
  }, [adj, presetId, imageDataUrl]);

  const handleSaveToApp = useCallback(() => {
    onSave(exportDataUrl());
    onClose();
  }, [exportDataUrl, onSave, onClose]);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href     = exportDataUrl();
    a.download = `edited_${Date.now()}.png`;
    a.click();
  }, [exportDataUrl]);

  const handleCopy = useCallback(async () => {
    try {
      const res  = await fetch(exportDataUrl());
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch { /* clipboard API unavailable */ }
  }, [exportDataUrl]);

  const handleReset = useCallback(() => {
    setAdj(DEFAULT_ADJ);
    setPresetId("none");
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

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
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === "e" || e.key === "E") setTool("erase");
        if (e.key === "s" || e.key === "S") setTool("select");
        if (e.key === "c" || e.key === "C") setTool("crop");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, handleUndo, handleRedo]);

  // ── Crop overlay display rect (canvas-px → CSS-px) ────────────────────────

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

  const filterStr = buildFilter(adj, presetId);

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col select-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#1c1e27] shrink-0 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm">🎨</span>
          <span className="text-[13px] font-bold text-white/85">簡易画像編集</span>
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
          <button onClick={handleReset}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition">
            リセット
          </button>
          <button onClick={handleDownload}
            className="px-3 py-1.5 text-xs rounded-lg border border-sky-400/45 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 transition">
            💾 保存
          </button>
          <button onClick={() => void handleCopy()}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/18 bg-white/5 text-white/65 hover:bg-white/10 transition">
            {copyDone ? "✓ コピー済み" : "📋 コピー"}
          </button>
          <button onClick={handleSaveToApp}
            className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-[0_0_12px_rgba(124,92,255,0.35)] transition">
            ✓ 画像に反映
          </button>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/45 hover:text-white/80 hover:bg-white/10 transition text-sm">
            ✕
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left toolbar ── */}
        <div className="w-14 shrink-0 flex flex-col items-center py-3 gap-1.5 border-r border-white/8 bg-[#1c1e27]">
          {(
            [
              { id: "select" as Tool, icon: "↖️", label: "選択 (S)" },
              { id: "crop"   as Tool, icon: "✂️",  label: "クロップ (C)" },
              { id: "erase"  as Tool, icon: "🖌️", label: "消去ブラシ (E)" },
            ] as const
          ).map(({ id, icon, label }) => (
            <button key={id} title={label} onClick={() => setTool(id)}
              className={[
                "w-9 h-9 rounded-xl flex items-center justify-center text-base transition",
                tool === id
                  ? "bg-violet-600 shadow-[0_0_12px_rgba(124,92,255,0.45)]"
                  : "bg-white/5 hover:bg-white/12",
              ].join(" ")}>
              {icon}
            </button>
          ))}

          <div className="my-1 border-t border-white/10 w-7" />

          <button title="左90°回転" onClick={() => handleRotate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-white/5 hover:bg-white/12 transition">
            ↺
          </button>
          <button title="右90°回転" onClick={() => handleRotate(1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-white/5 hover:bg-white/12 transition">
            ↻
          </button>
        </div>

        {/* ── Canvas area ── */}
        <div className="flex-1 flex items-center justify-center bg-[#101218] relative overflow-hidden min-w-0">
          {/* Checkerboard transparency indicator */}
          <div className="absolute inset-0 opacity-35 pointer-events-none" style={{
            backgroundImage:
              "linear-gradient(45deg,#2a2a2a 25%,transparent 25%)," +
              "linear-gradient(-45deg,#2a2a2a 25%,transparent 25%)," +
              "linear-gradient(45deg,transparent 75%,#2a2a2a 75%)," +
              "linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          }} />

          {/* Canvas wrapper — relative so crop overlay positions correctly */}
          <div className="relative" style={{ display: "inline-block", lineHeight: 0 }}>
            <canvas
              ref={canvasRef}
              style={{
                maxWidth:  "calc(100vw - 14rem - 3.5rem)",
                maxHeight: "calc(100vh - 52px)",
                display:   "block",
                filter:    filterStr || undefined,
                cursor:
                  tool === "erase" ? "crosshair" :
                  tool === "crop"  ? "crosshair" : "default",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* Crop selection overlay */}
            {tool === "crop" && cropDisplayRect && (
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
                {/* Corner handles */}
                {[
                  "top-0 left-0 -translate-x-0.5 -translate-y-0.5",
                  "top-0 right-0 translate-x-0.5 -translate-y-0.5",
                  "bottom-0 left-0 -translate-x-0.5 translate-y-0.5",
                  "bottom-0 right-0 translate-x-0.5 translate-y-0.5",
                ].map((cls, i) => (
                  <div key={i}
                    className={`absolute w-3 h-3 border-2 border-white bg-white/20 ${cls}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Crop apply button */}
          {tool === "crop" && cropDisplayRect && (
            <button onClick={handleApplyCrop}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 px-5 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-xl transition z-10">
              ✂ クロップを適用
            </button>
          )}

          {/* Erase brush size control */}
          {tool === "erase" && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/70 rounded-xl px-3 py-2 text-xs text-white/65 z-10 backdrop-blur-sm">
              <span>ブラシ</span>
              <input type="range" min={4} max={120} value={eraseSize}
                onChange={(e) => setEraseSize(Number(e.target.value))}
                className="w-24 accent-violet-500 cursor-pointer" />
              <span className="font-mono w-7">{eraseSize}px</span>
            </div>
          )}

          {/* Image size badge */}
          {origSize && (
            <div className="absolute top-2 right-2 text-[10px] text-white/30 bg-black/45 rounded px-1.5 py-0.5 pointer-events-none">
              {origSize.w} × {origSize.h}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="w-[256px] shrink-0 flex flex-col border-l border-white/8 bg-[#1c1e27] overflow-y-auto">

          {/* Tabs */}
          <div className="flex border-b border-white/8 shrink-0">
            {(["adjustments", "filters"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={[
                  "flex-1 py-2.5 text-[11px] font-semibold transition",
                  tab === t
                    ? "text-white border-b-2 border-violet-500"
                    : "text-white/35 hover:text-white/55",
                ].join(" ")}>
                {t === "adjustments" ? "🎚 調整" : "🎨 フィルター"}
              </button>
            ))}
          </div>

          {/* Adjustments panel */}
          {tab === "adjustments" && (
            <div className="p-4 space-y-4">
              <SliderRow label="明るさ"      emoji="☀️"  value={adj.brightness}
                onChange={(v) => setAdj((p) => ({ ...p, brightness: v }))} />
              <SliderRow label="コントラスト" emoji="◑"  value={adj.contrast}
                onChange={(v) => setAdj((p) => ({ ...p, contrast: v }))} />
              <SliderRow label="彩度"         emoji="🌈" value={adj.saturation}
                onChange={(v) => setAdj((p) => ({ ...p, saturation: v }))} />
              <SliderRow label="ハイライト"   emoji="💡" value={adj.highlights}
                onChange={(v) => setAdj((p) => ({ ...p, highlights: v }))} />
              <SliderRow label="シャドウ"     emoji="🌑" value={adj.shadows}
                onChange={(v) => setAdj((p) => ({ ...p, shadows: v }))} />
              <SliderRow label="色温度"       emoji="🌡️" value={adj.colorTemp}
                onChange={(v) => setAdj((p) => ({ ...p, colorTemp: v }))} />

              <button onClick={handleReset}
                className="w-full mt-1 py-1.5 text-xs rounded-lg border border-white/12 text-white/38 hover:bg-white/8 hover:text-white/58 transition">
                調整をリセット
              </button>

              <p className="text-[10px] text-white/25 leading-relaxed pt-1">
                ヒント: ハイライトで明るい部分、シャドウで暗い部分を個別に調整できます。
              </p>
            </div>
          )}

          {/* Filters panel */}
          {tab === "filters" && (
            <div className="p-3 grid grid-cols-3 gap-1.5">
              {FILTER_PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => setPresetId(preset.id)}
                  className={[
                    "rounded-xl overflow-hidden flex flex-col transition border-2",
                    presetId === preset.id
                      ? "border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.4)]"
                      : "border-transparent hover:border-white/20",
                  ].join(" ")}>
                  <div className="aspect-square overflow-hidden bg-white/5">
                    {/* Show original image with each preset's filter for preview */}
                    <img src={imageDataUrl} alt={preset.label}
                      style={{
                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                        filter: preset.css || undefined,
                      }} />
                  </div>
                  <div className="py-1 text-[9px] text-white/55 text-center leading-none">
                    {preset.label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
