/**
 * SelectionPromptModal — 選択範囲プロンプト生成モード（第1段階）。
 *
 * - HTML Canvas でブラシ/消しゴムを使ってマスクを塗る（スムーズベジェ描画）
 * - 編集タイプを選択
 * - 追加指示を入力
 * - プロンプトを生成 → クリップボードへコピー / IndexedDB へ保存
 *
 * 画像は編集しない。外部 AI ツールへ貼るための「プロンプト文」を作るだけ。
 */
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectionEditType } from "../lib/selectionHistory";
import { saveSelectionItem } from "../lib/selectionHistory";
import { makeThumbnail } from "../lib/imageThumb";

// ── Constants ──────────────────────────────────────────────────────────────

const BRUSH_COLOR_RGBA = "rgba(59, 130, 246, 0.55)";
const BRUSH_ALPHA_BYTE  = 140; // 0.55 * 255
const MAX_UNDO          = 20;
const SNAP_RADIUS       = 14;  // px — AI吸着の探索半径
const SNAP_MIN_EDGE     = 18;  // Sobel magnitude minimum to snap

const FEATHER_STEPS = [0, 4, 8, 14, 20] as const;
type FeatherStep = typeof FEATHER_STEPS[number];

const EDIT_TYPE_OPTIONS: { id: SelectionEditType; label: string; icon: string }[] = [
  { id: "change",     icon: "✏️",  label: "変更"         },
  { id: "remove",     icon: "🪄",  label: "自然に消す"    },
  { id: "replace",    icon: "🔄",  label: "別物に置換"    },
  { id: "recolor",    icon: "🎨",  label: "色変更"        },
  { id: "texture",    icon: "🪨",  label: "質感変更"      },
  { id: "brightness", icon: "☀️",  label: "明るさ変更"    },
  { id: "gloss",      icon: "✨",  label: "光沢変更"      },
  { id: "outfit",     icon: "👗",  label: "衣装変更"      },
];

const EDIT_INSTRUCTIONS: Record<SelectionEditType, string> = {
  change:
    "青く塗られた選択範囲のみを変更してください。",
  remove:
    "青く塗られた選択範囲を自然に消去し、背景・周囲の素材・影・反射と違和感なく補完してください。",
  replace:
    "青く塗られた選択範囲を以下の内容に置き換えてください。周囲との光源・影・反射を整合させてください。",
  recolor:
    "青く塗られた選択範囲の色のみを変更してください。形・質感・影は維持したまま、色相・彩度・明度のみ変更してください。",
  texture:
    "青く塗られた選択範囲の質感のみを変更してください。形・色・位置・シルエットは維持してください。",
  brightness:
    "青く塗られた選択範囲の明るさのみを調整してください。周囲との光の整合性を保ってください。",
  gloss:
    "青く塗られた選択範囲の光沢感のみを変更してください。反射・ハイライト・マット感を調整し、周囲と自然に整合させてください。",
  outfit:
    "青く塗られた選択範囲の衣装・服装のみを変更してください。体型・ポーズ・顔・背景は完全固定してください。",
};

// ── Prompt builder ─────────────────────────────────────────────────────────

function buildSelectionPrompt(editType: SelectionEditType, extra: string): string {
  const lines: string[] = [
    "【選択範囲編集】",
    EDIT_INSTRUCTIONS[editType],
  ];
  if (extra.trim()) {
    lines.push(`変更の詳細指示：${extra.trim()}`);
  }
  lines.push(
    "選択範囲外の顔・髪・体型・表情・背景・ポーズ・カメラアングル・アスペクト比は完全固定し、一切変更しないでください。",
    "選択範囲と周囲の境界を自然に馴染ませ、境界線が見えないように自然に合成してください。",
    "影・反射・色温度・光源方向・接触影・質感を周囲の環境と完全に整合させてください。",
    "手・指・脚が関係する場合は解剖学的に自然に補正してください（片手5本指・自然な関節・正しい接地感）。",
    "高解像度、物理的に正しい影と反射、違和感のない補完。",
  );
  return lines.join("\n");
}

// ── Types ──────────────────────────────────────────────────────────────────

type ToolMode = "brush" | "eraser";

interface Point { x: number; y: number; }

interface Props {
  imageDataUrl: string;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getCanvasCoords(e: MouseEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function getTouchCoords(touch: React.Touch, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * (canvas.width  / rect.width),
    y: (touch.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

/**
 * スムーズ描画：中点二次ベジェ（C¹連続）でポイント列を滑らかな線にする。
 * feather > 0 のとき shadowBlur でエッジをぼかす。
 * キャンバスは devicePixelRatio 倍の物理ピクセルで初期化されるため、
 * size / feather もそれに合わせて DPR 倍して描画する。
 */
function drawSmoothPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  mode: ToolMode,
  size: number,
  feather: number,
): void {
  if (points.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.lineCap  = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * dpr;

  if (mode === "eraser") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle   = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = BRUSH_COLOR_RGBA;
    ctx.fillStyle   = BRUSH_COLOR_RGBA;
    if (feather > 0) {
      ctx.shadowBlur  = feather * dpr * 2.5;
      ctx.shadowColor = BRUSH_COLOR_RGBA;
    }
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) {
    // 単点：丸で描く
    ctx.arc(points[0].x, points[0].y, (size * dpr) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
  } else {
    // 中点二次ベジェ
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * liveCanvas のストロークを permCanvas に合成してコミットする。
 * eraserモードは destination-out で合成。
 */
function commitLiveStroke(
  permCtx: CanvasRenderingContext2D,
  liveCanvas: HTMLCanvasElement,
  mode: ToolMode,
): void {
  permCtx.save();
  if (mode === "eraser") {
    permCtx.globalCompositeOperation = "destination-out";
  } else {
    permCtx.globalCompositeOperation = "source-over";
  }
  permCtx.drawImage(liveCanvas, 0, 0);
  permCtx.restore();
}

/**
 * Sobel エッジマップを非同期で構築する。
 * imageDataUrl を object-contain でキャンバスに描画し、
 * グレースケール→Sobel勾配マグニチュードの Float32Array を返す。
 */
function buildEdgeMap(
  imgSrc: string,
  canvasW: number,
  canvasH: number,
  onDone: (edges: Float32Array, offsetX: number, offsetY: number, scale: number) => void,
): void {
  setTimeout(() => {
    const img = new Image();
    img.onload = () => {
      // object-contain の描画オフセットと倍率を計算
      const scale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
      const dw    = img.naturalWidth  * scale;
      const dh    = img.naturalHeight * scale;
      const ox    = (canvasW - dw) / 2;
      const oy    = (canvasH - dh) / 2;

      const tmp = document.createElement("canvas");
      tmp.width  = canvasW;
      tmp.height = canvasH;
      const ctx = tmp.getContext("2d")!;
      ctx.drawImage(img, ox, oy, dw, dh);

      const raw  = ctx.getImageData(0, 0, canvasW, canvasH);
      const data = raw.data;
      const W    = canvasW;
      const H    = canvasH;

      // グレースケール変換
      const gray = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      }

      // Sobel 3×3
      const edges = new Float32Array(W * H);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const gx =
            -gray[i - W - 1] + gray[i - W + 1]
            - 2 * gray[i - 1] + 2 * gray[i + 1]
            - gray[i + W - 1] + gray[i + W + 1];
          const gy =
            -gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1]
            + gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1];
          edges[i] = Math.sqrt(gx * gx + gy * gy);
        }
      }
      onDone(edges, ox, oy, scale);
    };
    img.src = imgSrc;
  }, 0);
}

/**
 * AI吸着：SNAP_RADIUS 内で最強エッジのピクセルに吸着する。
 */
function snapToEdge(
  pt: Point,
  edges: Float32Array,
  canvasW: number,
  canvasH: number,
): Point {
  const dpr = window.devicePixelRatio || 1;
  const r  = Math.round(SNAP_RADIUS * dpr);
  let best = SNAP_MIN_EDGE;
  let bx   = pt.x;
  let by   = pt.y;

  const x0 = Math.max(1, Math.round(pt.x) - r);
  const x1 = Math.min(canvasW - 2, Math.round(pt.x) + r);
  const y0 = Math.max(1, Math.round(pt.y) - r);
  const y1 = Math.min(canvasH - 2, Math.round(pt.y) + r);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - pt.x;
      const dy = y - pt.y;
      if (dx * dx + dy * dy > r * r) continue;
      const mag = edges[y * canvasW + x];
      if (mag > best) {
        best = mag;
        bx = x;
        by = y;
      }
    }
  }
  return { x: bx, y: by };
}

function hasMaskPixels(data: ImageData): boolean {
  for (let i = 3; i < data.data.length; i += 4) {
    if (data.data[i] > 0) return true;
  }
  return false;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SelectionPromptModal({ imageDataUrl, onClose }: Props) {
  // ── Refs ──────────────────────────────────────────────────────────
  /** 確定済みストローク（pointer-events: none） */
  const permCanvasRef  = useRef<HTMLCanvasElement>(null);
  /** 現在描画中のストロークプレビュー（イベント受付） */
  const liveCanvasRef  = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const isPaintingRef  = useRef(false);
  const strokeBufferRef = useRef<Point[]>([]);
  const undoStackRef   = useRef<ImageData[]>([]);
  const redoStackRef   = useRef<ImageData[]>([]);
  /** Sobel エッジマップ */
  const imgEdgeRef     = useRef<Float32Array | null>(null);
  /** buildEdgeMap のオフセット／倍率 */
  const edgeMetaRef    = useRef<{ ox: number; oy: number; scale: number }>({ ox: 0, oy: 0, scale: 1 });

  // ── UI state ──────────────────────────────────────────────────────
  const [tool,            setTool]           = useState<ToolMode>("brush");
  const [brushSize,       setBrushSize]      = useState(24);
  const [smoothMode,      setSmoothMode]     = useState(true);
  const [featherRadius,   setFeatherRadius]  = useState<FeatherStep>(0);
  const [aiSnap,          setAiSnap]         = useState(false);
  const [edgeBuilding,    setEdgeBuilding]   = useState(false);
  const [editType,        setEditType]       = useState<SelectionEditType>("change");
  const [extra,           setExtra]          = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [copied,          setCopied]         = useState(false);
  const [saving,          setSaving]         = useState(false);
  const [saved,           setSaved]          = useState(false);
  const [canUndo,         setCanUndo]        = useState(false);
  const [canRedo,         setCanRedo]        = useState(false);
  const [hasMask,         setHasMask]        = useState(false);
  /** キャンバスリサイズが発生するたびにインクリメント。AI吸着エッジマップ再ビルドのトリガー。 */
  const [canvasSizeKey,   setCanvasSizeKey]  = useState(0);

  // ── Canvas init ───────────────────────────────────────────────────
  useEffect(() => {
    const perm      = permCanvasRef.current;
    const live      = liveCanvasRef.current;
    const container = containerRef.current;
    if (!perm || !live || !container) return;

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth  || 600;
      const h = container.clientHeight || 450;
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (perm.width !== pw || perm.height !== ph) {
        perm.width  = pw; perm.height  = ph;
        live.width  = pw; live.height  = ph;
        undoStackRef.current = [];
        redoStackRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
        setHasMask(false);
        // エッジマップをクリア → canvasSizeKey を上げて再ビルドをトリガー
        imgEdgeRef.current = null;
        setCanvasSizeKey((k) => k + 1);
      }
    };

    init();
    const ro = new ResizeObserver(init);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── AI吸着：エッジマップ構築 ──────────────────────────────────────
  useEffect(() => {
    if (!aiSnap) return;
    if (imgEdgeRef.current !== null) return; // 既に構築済み
    const perm = permCanvasRef.current;
    if (!perm || perm.width === 0) return;
    setEdgeBuilding(true);
    buildEdgeMap(imageDataUrl, perm.width, perm.height, (edges, ox, oy, scale) => {
      imgEdgeRef.current   = edges;
      edgeMetaRef.current  = { ox, oy, scale };
      setEdgeBuilding(false);
    });
  // canvasSizeKey を依存に含めることでリサイズ後も自動再ビルドされる
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSnap, imageDataUrl, canvasSizeKey]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")              { onClose(); return; }
      if (e.key === "b" || e.key === "B")  { setTool("brush");  return; }
      if (e.key === "e" || e.key === "E")  { setTool("eraser"); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault(); handleRedo();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Undo / Redo helpers ───────────────────────────────────────────

  const saveSnapshot = useCallback(() => {
    const perm = permCanvasRef.current;
    if (!perm) return;
    const ctx      = perm.getContext("2d")!;
    const snapshot = ctx.getImageData(0, 0, perm.width, perm.height);
    undoStackRef.current = [snapshot, ...undoStackRef.current].slice(0, MAX_UNDO);
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    const perm = permCanvasRef.current;
    if (!perm || undoStackRef.current.length === 0) return;
    const ctx     = perm.getContext("2d")!;
    const current = ctx.getImageData(0, 0, perm.width, perm.height);
    redoStackRef.current = [current, ...redoStackRef.current].slice(0, MAX_UNDO);
    const [state, ...rest] = undoStackRef.current;
    undoStackRef.current   = rest;
    ctx.putImageData(state, 0, 0);
    setCanUndo(rest.length > 0);
    setCanRedo(true);
    setHasMask(hasMaskPixels(state));
  }, []);

  const handleRedo = useCallback(() => {
    const perm = permCanvasRef.current;
    if (!perm || redoStackRef.current.length === 0) return;
    const ctx     = perm.getContext("2d")!;
    const current = ctx.getImageData(0, 0, perm.width, perm.height);
    undoStackRef.current = [current, ...undoStackRef.current].slice(0, MAX_UNDO);
    const [state, ...rest] = redoStackRef.current;
    redoStackRef.current   = rest;
    ctx.putImageData(state, 0, 0);
    setCanUndo(true);
    setCanRedo(rest.length > 0);
    setHasMask(hasMaskPixels(state));
  }, []);

  const handleClear = useCallback(() => {
    const perm = permCanvasRef.current;
    if (!perm) return;
    saveSnapshot();
    perm.getContext("2d")!.clearRect(0, 0, perm.width, perm.height);
    setHasMask(false);
  }, [saveSnapshot]);

  const handleInvert = useCallback(() => {
    const perm = permCanvasRef.current;
    if (!perm) return;
    saveSnapshot();
    const ctx  = perm.getContext("2d")!;
    const data = ctx.getImageData(0, 0, perm.width, perm.height);
    const d    = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) {
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      } else {
        d[i]     = 59;
        d[i + 1] = 130;
        d[i + 2] = 246;
        d[i + 3] = BRUSH_ALPHA_BYTE;
      }
    }
    ctx.putImageData(data, 0, 0);
    setHasMask(true);
  }, [saveSnapshot]);

  // ── Painting ──────────────────────────────────────────────────────

  const resolvePoint = useCallback((raw: Point): Point => {
    const perm = permCanvasRef.current;
    if (aiSnap && imgEdgeRef.current && perm) {
      return snapToEdge(raw, imgEdgeRef.current, perm.width, perm.height);
    }
    return raw;
  }, [aiSnap]);

  const startPaint = useCallback((rawPt: Point) => {
    const perm = permCanvasRef.current;
    const live = liveCanvasRef.current;
    if (!perm || !live) return;
    isPaintingRef.current = true;
    saveSnapshot();

    const pt = resolvePoint(rawPt);
    strokeBufferRef.current = [pt];

    // live canvas をクリアしてから単点を描画
    const liveCtx = live.getContext("2d")!;
    liveCtx.clearRect(0, 0, live.width, live.height);
    drawSmoothPath(liveCtx, [pt], tool, brushSize, featherRadius);
    setHasMask(true);
  }, [tool, brushSize, featherRadius, resolvePoint, saveSnapshot]);

  const continuePaint = useCallback((rawPt: Point) => {
    if (!isPaintingRef.current) return;
    const live = liveCanvasRef.current;
    if (!live) return;

    const pt = resolvePoint(rawPt);
    strokeBufferRef.current = [...strokeBufferRef.current, pt];

    const liveCtx = live.getContext("2d")!;
    liveCtx.clearRect(0, 0, live.width, live.height);

    if (smoothMode) {
      drawSmoothPath(liveCtx, strokeBufferRef.current, tool, brushSize, featherRadius);
    } else {
      // レガシー：逐次線描
      const pts = strokeBufferRef.current;
      const from = pts[pts.length - 2] ?? pt;
      drawSmoothPath(liveCtx, [from, pt], tool, brushSize, featherRadius);
    }
    setHasMask(true);
  }, [tool, brushSize, featherRadius, smoothMode, resolvePoint]);

  const endPaint = useCallback(() => {
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;

    const perm = permCanvasRef.current;
    const live = liveCanvasRef.current;
    if (!perm || !live) return;

    const permCtx = perm.getContext("2d")!;
    commitLiveStroke(permCtx, live, tool);

    // live canvas をクリア
    live.getContext("2d")!.clearRect(0, 0, live.width, live.height);
    strokeBufferRef.current = [];
  }, [tool]);

  // ── Mouse events ──────────────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    startPaint(getCanvasCoords(e.nativeEvent, liveCanvasRef.current!));
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    continuePaint(getCanvasCoords(e.nativeEvent, liveCanvasRef.current!));
  };
  const onMouseUp    = () => endPaint();
  const onMouseLeave = () => endPaint();

  // ── Touch events ──────────────────────────────────────────────────

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    startPaint(getTouchCoords(e.touches[0], liveCanvasRef.current!));
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    continuePaint(getTouchCoords(e.touches[0], liveCanvasRef.current!));
  };
  const onTouchEnd = () => endPaint();

  // ── Prompt generation ─────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    const prompt = buildSelectionPrompt(editType, extra);
    setGeneratedPrompt(prompt);
    setSaved(false);
    setCopied(false);
  }, [editType, extra]);

  // ── Copy ──────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!generatedPrompt) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
    } catch { /* ignore */ }
  }, [generatedPrompt]);

  // ── Save to IDB ───────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!generatedPrompt) return;
    setSaving(true);
    try {
      const perm        = permCanvasRef.current;
      const maskDataUrl = perm ? perm.toDataURL("image/png") : "";
      const thumb       = await makeThumbnail(imageDataUrl, 200).catch(() => imageDataUrl);
      await saveSelectionItem({
        sourceImageThumbnail: thumb,
        maskDataUrl,
        generatedPrompt,
        editType,
        extraInstructions: extra,
      });
      setSaved(true);
    } catch (err) {
      console.error("SelectionHistory save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [generatedPrompt, editType, extra, imageDataUrl]);

  // ── Render ────────────────────────────────────────────────────────

  const cursorStyle = tool === "eraser" ? "cursor-cell" : "cursor-crosshair";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-6xl h-full max-h-[calc(100vh-32px)] flex flex-col rounded-2xl border border-bg-border bg-[#0b0d14] shadow-2xl overflow-hidden">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-bg-border bg-bg-panel/60">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖌</span>
            <span className="text-sm font-bold text-text-base">選択範囲プロンプト</span>
            <span className="text-[11px] text-text-muted/50">— 選択範囲を塗って、外部 AI ツール用のプロンプトを生成</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-bg-border text-text-muted hover:text-text-base hover:border-accent/50 transition text-sm"
            title="閉じる (Esc)"
          >
            ×
          </button>
        </div>

        {/* ── Toolbar row 1: tool / size / undo ─────────────────── */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-bg-border bg-[#0d1017]/80 flex-wrap">

          {/* Tool toggle */}
          <div className="flex rounded-lg overflow-hidden border border-bg-border">
            {(["brush", "eraser"] as ToolMode[]).map((t) => (
              <button
                key={t}
                type="button"
                title={`${t === "brush" ? "ブラシ (B)" : "消しゴム (E)"}`}
                onClick={() => setTool(t)}
                className={[
                  "px-3 py-1.5 text-[12px] font-semibold transition flex items-center gap-1.5",
                  tool === t
                    ? "bg-accent/20 text-accent border-r border-bg-border"
                    : "text-text-muted/60 hover:text-text-base border-r border-bg-border last:border-r-0",
                ].join(" ")}
              >
                <span>{t === "brush" ? "🖌" : "⊘"}</span>
                <span>{t === "brush" ? "ブラシ" : "消しゴム"}</span>
              </button>
            ))}
          </div>

          {/* Brush size */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted/50 shrink-0">サイズ</span>
            <input
              type="range"
              min={4} max={80} step={2}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 h-1.5 accent-accent cursor-pointer"
            />
            <span className="text-[11px] text-text-muted/70 w-6 text-right tabular-nums shrink-0">
              {brushSize}
            </span>
          </div>

          {/* Divider */}
          <span className="w-px h-5 bg-bg-border shrink-0" />

          {/* Undo / Redo */}
          {[
            { fn: handleUndo, enabled: canUndo, icon: "↩", title: "元に戻す (Ctrl+Z)" },
            { fn: handleRedo, enabled: canRedo, icon: "↪", title: "やり直す (Ctrl+Y)" },
          ].map((btn) => (
            <button
              key={btn.icon}
              type="button"
              title={btn.title}
              disabled={!btn.enabled}
              onClick={btn.fn}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-bg-border text-[14px] transition text-text-muted hover:text-text-base hover:border-accent/50 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              {btn.icon}
            </button>
          ))}

          {/* Clear / Invert */}
          <button
            type="button"
            title="全消去"
            onClick={handleClear}
            className="px-2.5 py-1 rounded-lg border border-bg-border text-[11px] text-text-muted/60 hover:text-rose-300 hover:border-rose-400/40 transition"
          >
            🗑 全消去
          </button>
          <button
            type="button"
            title="選択範囲を反転"
            onClick={handleInvert}
            className="px-2.5 py-1 rounded-lg border border-bg-border text-[11px] text-text-muted/60 hover:text-sky-300 hover:border-sky-400/40 transition"
          >
            ⇄ 反転
          </button>

          {/* Hint */}
          <span className="ml-auto text-[10px] text-text-muted/35 hidden sm:inline">
            B: ブラシ　E: 消しゴム　Ctrl+Z: 元に戻す
          </span>
        </div>

        {/* ── Toolbar row 2: smooth / feather / AI snap ─────────── */}
        <div className="shrink-0 flex items-center gap-2.5 px-3 py-1.5 border-b border-bg-border/60 bg-[#0c0f18]/70 flex-wrap">

          {/* スムーズ描画 toggle */}
          <button
            type="button"
            onClick={() => setSmoothMode((v) => !v)}
            title="スムーズ描画：ベジェ補間で滑らかなパスを描く"
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition",
              smoothMode
                ? "border-violet-400/60 bg-violet-500/15 text-violet-200"
                : "border-bg-border text-text-muted/55 hover:text-text-base hover:border-bg-border/80",
            ].join(" ")}
          >
            <span>〰</span>
            <span>スムーズ描画</span>
          </button>

          {/* 境界ぼかし */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted/50 shrink-0">境界ぼかし</span>
            <div className="flex gap-0.5">
              {FEATHER_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setFeatherRadius(step)}
                  title={`ぼかし ${step === 0 ? "なし" : step + "px"}`}
                  className={[
                    "px-2 py-0.5 rounded text-[10px] font-semibold border transition",
                    featherRadius === step
                      ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200"
                      : "border-bg-border text-text-muted/50 hover:text-text-base hover:border-bg-border/70",
                  ].join(" ")}
                >
                  {step === 0 ? "なし" : step}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <span className="w-px h-4 bg-bg-border/60 shrink-0" />

          {/* AI吸着 toggle */}
          <button
            type="button"
            onClick={() => setAiSnap((v) => !v)}
            title="AI吸着：服・髪・背景などのエッジに自動で吸着する"
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition",
              aiSnap
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                : "border-bg-border text-text-muted/55 hover:text-text-base hover:border-bg-border/80",
            ].join(" ")}
          >
            <span>{edgeBuilding ? "⏳" : "🧲"}</span>
            <span>AI吸着{edgeBuilding ? " 解析中…" : ""}</span>
          </button>

          {/* AI吸着 note */}
          {aiSnap && !edgeBuilding && (
            <span className="text-[10px] text-emerald-300/50">
              服・髪・背景のエッジに吸着
            </span>
          )}
        </div>

        {/* ── Main content ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

          {/* Canvas area */}
          <div
            ref={containerRef}
            className="relative flex-1 min-h-0 bg-black overflow-hidden"
          >
            {/* Source image (underneath canvas) */}
            <img
              src={imageDataUrl}
              alt="source"
              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
            />

            {/* Perm canvas（確定済みストローク、イベントなし） */}
            <canvas
              ref={permCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Live canvas（現在のストロークプレビュー、イベント受付） */}
            <canvas
              ref={liveCanvasRef}
              className={`absolute inset-0 w-full h-full ${cursorStyle} touch-none`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            />

            {/* Overlay hint when no mask */}
            {!hasMask && (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
                <div className="text-[11px] text-white/30 bg-black/40 rounded-full px-3 py-1">
                  画像の上を塗って選択範囲を作ってください
                </div>
              </div>
            )}
          </div>

          {/* Controls panel */}
          <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-bg-border flex flex-col overflow-y-auto bg-[#0d1017]">

            {/* Edit type */}
            <div className="p-3 border-b border-bg-border/60">
              <div className="text-[11px] uppercase tracking-widest text-text-muted/55 mb-2 font-semibold">
                編集タイプ
              </div>
              <div className="grid grid-cols-2 gap-1">
                {EDIT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEditType(opt.id)}
                    className={[
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] border transition text-left",
                      editType === opt.id
                        ? "border-accent/60 bg-accent/15 text-text-base font-semibold"
                        : "border-[#252e44] bg-transparent text-text-muted/65 hover:border-accent/35 hover:text-text-base",
                    ].join(" ")}
                  >
                    <span className="shrink-0 text-[13px]">{opt.icon}</span>
                    <span className="leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Extra instructions */}
            <div className="p-3 border-b border-bg-border/60">
              <label className="block text-[11px] uppercase tracking-widest text-text-muted/55 mb-1.5 font-semibold">
                追加指示（任意）
              </label>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="例：赤いリボンに変更してほしい"
                rows={3}
                className="w-full rounded-xl border border-bg-border bg-bg-panel/60 text-[12px] text-text-base px-3 py-2 placeholder:text-text-muted/35 focus:outline-none focus:border-accent/60 resize-none"
              />
            </div>

            {/* Generate button */}
            <div className="p-3">
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full rounded-xl py-3 text-sm font-bold border border-accent/60 bg-accent/12 text-accent hover:bg-accent/22 hover:border-accent/80 transition"
              >
                🔮 プロンプトを生成
              </button>
            </div>

            {/* Generated prompt */}
            {generatedPrompt !== null && (
              <div className="px-3 pb-3 space-y-2 flex-1 flex flex-col">
                <div className="text-[11px] uppercase tracking-widest text-text-muted/55 font-semibold">
                  生成されたプロンプト
                </div>
                <textarea
                  readOnly
                  value={generatedPrompt}
                  rows={8}
                  className="flex-1 w-full rounded-xl border border-bg-border bg-bg-panel/40 text-[11px] text-text-base px-3 py-2 resize-none focus:outline-none leading-relaxed"
                />

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    title={copied ? "再コピー" : undefined}
                    className={[
                      "group flex-1 rounded-lg py-2 text-[12px] font-bold border transition",
                      copied
                        ? "border-emerald-400/60 bg-emerald-400/12 text-emerald-200"
                        : "border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent/70",
                    ].join(" ")}
                  >
                    {copied ? (
                      <>
                        <span className="group-hover:hidden">✅ コピー済み</span>
                        <span className="hidden group-hover:inline">🔄 再コピー</span>
                      </>
                    ) : "📋 コピー"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || saved}
                    className={[
                      "flex-1 rounded-lg py-2 text-[12px] font-bold border transition",
                      saved
                        ? "border-emerald-400/40 bg-emerald-400/8 text-emerald-300/70"
                        : "border-sky-400/50 bg-sky-400/8 text-sky-200 hover:bg-sky-400/15 hover:border-sky-400/70 disabled:opacity-50 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    {saving ? "保存中…" : saved ? "✓ 保存済み" : "💾 保存"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-bg-border bg-bg-panel/40">
          <span className="text-[11px] text-text-muted/40">
            第1段階：プロンプト生成のみ。画像は編集されません。
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-bg-border text-[12px] text-text-muted hover:text-text-base hover:border-accent/40 transition"
          >
            キャンセル
          </button>
        </div>

      </div>
    </div>,
    document.body,
  );
}
