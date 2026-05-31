/**
 * ImagePreviewTooltip / WithImagePreview
 *
 * サムネイルの汎用プレビュー・ラッパー（履歴・お気に入り・アレンジ結果で共通利用）。
 *
 * - ホバー：大型プレビューを portal で横に表示（pointer-events-none で下のUIを邪魔しない）
 * - クリック / タップ：中央に大きく拡大するモーダルを表示
 *     × ボタン / 背景クリック / Esc キーで閉じられる（スマホのタップにも対応）
 */
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export interface WithImagePreviewProps {
  src: string;
  /** ヘッダー左：「元画像」「生成結果」など */
  label: string;
  /** ヘッダー右：案番号・日時など（省略可） */
  sublabel?: string;
  children: React.ReactNode;
}

export function WithImagePreview({ src, label, sublabel, children }: WithImagePreviewProps) {
  const [visible, setVisible]     = useState(false);  // ホバーツールチップ
  const [modalOpen, setModalOpen] = useState(false);  // クリック拡大モーダル
  const [style, setStyle]         = useState<React.CSSProperties>({});
  const ref      = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEnter = () => {
    clearTimeout(timerRef.current);
    if (!ref.current || !src || modalOpen) return;
    const rect = ref.current.getBoundingClientRect();
    const pw   = 380;
    const maxH = 540; // プレビュー最大高さの目安

    // 水平：左に pw+12+8 以上あれば左、なければ右
    let left: number;
    if (rect.left - pw - 12 >= 8) {
      left = rect.left - pw - 12;
    } else {
      left = Math.min(rect.right + 12, window.innerWidth - pw - 8);
    }
    left = Math.max(8, left);

    // 垂直：サムネイル中央揃え → 画面端クランプ
    let top = rect.top + rect.height / 2 - maxH / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - maxH - 8));

    setStyle({ left, top, width: pw });
    setVisible(true);
  };

  const handleLeave = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 80);
  };

  const openModal = (e?: { stopPropagation: () => void }) => {
    if (!src) return;
    e?.stopPropagation();
    clearTimeout(timerRef.current);
    setVisible(false);   // ホバーツールチップを隠す
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Esc で拡大モーダルを閉じる
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  return (
    <div
      ref={ref}
      className="flex-shrink-0 cursor-zoom-in"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={openModal}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(); }
      }}
    >
      {children}

      {/* ── ホバー：横に出る大型プレビュー ── */}
      {visible && src && !modalOpen && createPortal(
        <div
          className="fixed z-[400] pointer-events-none rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.92)] border border-white/10"
          style={style}
        >
          <div className="px-3.5 py-2 bg-[#0c0f16]/95 border-b border-white/8 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-white/70 leading-none">{label}</span>
            {sublabel && (
              <span className="text-[10px] text-white/35 ml-auto font-mono leading-none">{sublabel}</span>
            )}
          </div>
          <img
            src={src}
            alt={label}
            className="w-full max-h-[520px] object-contain bg-black block"
          />
        </div>,
        document.body,
      )}

      {/* ── クリック：中央に拡大するモーダル ── */}
      {modalOpen && src && createPortal(
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.92)] border border-white/10 bg-[#0c0f16] max-w-[92vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="px-4 py-2.5 bg-[#0c0f16]/95 border-b border-white/8 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-white/80 leading-none">{label}</span>
              {sublabel && (
                <span className="text-[11px] text-white/40 font-mono leading-none">{sublabel}</span>
              )}
              <button
                type="button"
                onClick={closeModal}
                title="閉じる（Esc）"
                className="ml-auto shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition text-[13px] leading-none"
              >
                ✕
              </button>
            </div>
            {/* 画像本体 */}
            <img
              src={src}
              alt={label}
              className="block max-w-[92vw] max-h-[80vh] object-contain bg-black"
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
