import type { ReactNode } from "react";

// ─── GridCell ─────────────────────────────────────────────────────────────────

// cellKind controls visual style and active colour:
//   "skip"  → 設定なし  — active: gray
//   "auto"  → おまかせ  — active: violet/purple
//   "value" → 具体選択  — active: blue-indigo (default)
interface GridCellProps {
  jaLabel: string;
  active: boolean;
  cellKind?: "skip" | "auto" | "value";
  onClick: () => void;
  /** ダブルクリック時のハンドラ（オプション単位 NG トグル用）。 */
  onDoubleClick?: () => void;
  /** NG（ダブルクリックで除外）状態。赤字＋取り消し線で表示し、選択不可にする。 */
  ng?: boolean;
  title?: string;
  compact?: boolean;
}

/** ラベルの文字数に応じてフォントサイズを自動調整 */
function getCellFontClass(label: string): string {
  const n = label.length;
  if (n <= 4) return "text-[14px]";
  if (n <= 7) return "text-[13px]";
  return "text-[12px]";
}

export function GridCell({ jaLabel, active, cellKind = "value", onClick, onDoubleClick, ng = false, title, compact = false }: GridCellProps) {
  const activeStyle =
    cellKind === "skip"
      ? "bg-[#32363f] border-[#5a6070] shadow-[0_0_10px_rgba(150,160,180,0.3)] text-slate-100"
      : cellKind === "auto"
      ? "bg-gradient-to-b from-violet-500/70 to-violet-800/60 border-violet-300/90 shadow-[0_0_12px_rgba(139,92,246,0.55)] text-white"
      : "bg-gradient-to-b from-blue-500/65 to-indigo-600/55 border-blue-300/85 shadow-[0_0_12px_rgba(99,130,246,0.50)] text-white";

  const inactiveStyle =
    cellKind === "skip"
      ? "bg-[#0f1015] border-[#1c1e26] text-white/55 hover:bg-[#14161e] hover:border-[#272b38] hover:text-white/80"
      : cellKind === "auto"
      ? "bg-[#111420] border-[#1a1f34] text-white/55 hover:bg-[#161a2b] hover:border-[#2a3050] hover:text-white/80"
      : "bg-[#171b2c] border-[#252e44] text-white/72 hover:bg-[#1e2338] hover:border-[#354060] hover:text-text-base";

  const checkColor =
    cellKind === "skip" ? "text-slate-400" : cellKind === "auto" ? "text-violet-300" : "text-blue-300";

  const fontClass = getCellFontClass(jaLabel);

  // NG（ダブルクリック除外）：赤字＋取り消し線。active/inactive より優先。
  const ngStyle =
    "bg-[#2a0e12] border-red-500/55 text-red-400/85 line-through decoration-red-400/70 shadow-none hover:bg-[#37121a]";

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={ng ? `${title ?? jaLabel}（NG・ダブルクリックで解除）` : (title ?? jaLabel)}
      className={[
        `relative inline-flex items-center justify-center rounded-md border px-2 py-1 ${compact ? "min-h-[28px]" : "min-h-[34px]"} whitespace-nowrap text-center transition-all duration-150 select-none`,
        ng ? ngStyle : active ? activeStyle : inactiveStyle,
      ].join(" ")}
    >
      {!ng && active && (
        <span className={`absolute top-0.5 right-0.5 text-[10px] leading-none ${checkColor}`}>✓</span>
      )}
      <span className={`${fontClass} font-semibold leading-snug`}>{jaLabel}</span>
    </button>
  );
}

// ─── CellSectionLabel ─────────────────────────────────────────────────────────

/** セクション見出しのアイコンマップ */
const SECTION_ICONS: Record<string, string> = {
  // 背景
  "プリセット": "🎛", "背景スタイル": "🖼", "場所": "🏙", "色": "🎨", "時間帯": "🕐",
  "天候": "☁️",  "密度": "🌫", "空間効果": "✨", "奥行き": "📐", "情報量": "📊",
  // 髪
  "スタイル系統": "🎭", "長さ": "📏", "形": "💇", "髪色": "🎨", "質感": "🌊", "カラーモード": "🔒",
  "前髪": "🌿", "毛先": "✂️", "ボリューム": "💨", "アクセサリー": "💍",
  // 衣装
  "系統": "👗", "色方向": "🖌", "素材": "🧵", "シルエット": "👤",
  "露出": "🔆", "装飾量": "💎", "季節感": "🌸", "高級感": "👑",
  // ポーズ
  "種類": "🤸", "印象": "💭", "視線": "👁", "手の位置": "✋",
  "足の位置": "🦶", "重心": "⚖️", "動き": "💫", "体の向き": "🔄",
  // カメラ
  "角度": "🎯", "距離": "🔭", "レンズ感": "📸", "構図": "🖼",
  "画角": "🔲", "視点高さ": "↕", "3D指定": "🎥",
  // 持ち物
  "カテゴリ": "📦", "持たせ方": "🤲", "サイズ": "📏",
  "光り方": "💡", "雰囲気": "🌟", "配置": "📍", "個数": "🔢",
  // 照明
  "光源方向": "☀️", "強さ": "⚡", "色温度": "🌡", "影": "🌑", "反射": "🪞", "空気感": "🌬",
  // 比率
  "比率": "📐",
  // コスプレ
  "ジャンル系統": "🎭", "かわいい系": "🌸", "職種・役割系": "⚔️", "和風系": "⛩",
  "ファンタジー系": "🧝", "SF・近未来系": "🤖", "ダーク系": "🖤", "職業コスプレ": "💼",
  "装飾レベル": "💎", "持ち物・小物": "🪄", "カラー方向": "🎨",
  // 機械化
  "変化する部位": "🦾", "機械化タイプ": "⚙️", "発光色": "💡", "変化量": "📊",
  // 前景演出
  "エフェクト種類": "✨", "回転・渦": "🌀", "HUD・デジタル": "💻",
  "アート表現": "🎨", "位置": "📍", "視認性": "👁",
  // ムード
  "基本": "⭐", "世界観": "🌍", "演出": "✨", "色味": "🎨", "SNS最適化": "📱", "その他": "📌",
};

export function CellSectionLabel({
  label,
  noTopMargin,
  compact = false,
  count,
  maxCount,
}: {
  label: string;
  noTopMargin?: boolean;
  compact?: boolean;
  /** 現在の複数選択数（0以上のとき表示） */
  count?: number;
  /** 最大選択数（count と併用して N/maxCount 表示） */
  maxCount?: number;
}) {
  const icon = SECTION_ICONS[label];
  return (
    <div
      className={[
        "flex items-center gap-2",
        noTopMargin
          ? (compact ? "mb-1" : "mb-2")
          : (compact ? "mt-2 mb-1" : "mt-4 mb-2"),
      ].join(" ")}
    >
      {/* 左揃えのラベル */}
      <span
        className="flex items-center gap-1.5 text-[15px] font-semibold whitespace-nowrap leading-none shrink-0"
        style={{ color: "#b388ff" }}
      >
        {icon && <span className="text-[14px] leading-none">{icon}</span>}
        {label}
        {count !== undefined && count > 0 && maxCount !== undefined && (
          <span className="ml-0.5 text-[10px] font-bold text-blue-300/65 leading-none">
            {count}/{maxCount}
          </span>
        )}
      </span>
      {/* 右側だけに区切り線 */}
      <span className="h-px flex-1 bg-[#2a3158]" />
    </div>
  );
}

// ─── CellGrid ─────────────────────────────────────────────────────────────────

export function CellGrid({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap ${compact ? "gap-[2px]" : "gap-[3px]"}`}>
      {children}
    </div>
  );
}
