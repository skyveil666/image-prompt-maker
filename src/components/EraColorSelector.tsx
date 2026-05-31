/**
 * EraColorSelector — 時代軸・色戦略 セレクター
 *
 * section ③ 内に配置するコンパクトな単一選択 UI。
 * 「設定なし」= null / 選択値 = Era | ColorStrategy。
 *
 * 時代は 世界観 の近くに、色戦略は 色味 の近くに置く。
 */

import type { ColorStrategy, Era } from "../types";

// ── 時代定義 ─────────────────────────────────────────────────────────────────

export interface EraOption {
  value: Era;
  label: string;
}

export const ERA_OPTIONS: EraOption[] = [
  { value: "auto",        label: "おまかせ"  },
  { value: "primitive",   label: "原始"      },
  { value: "ancient",     label: "古代"      },
  { value: "egypt",       label: "エジプト"  },
  { value: "greek",       label: "ギリシャ"  },
  { value: "roman",       label: "ローマ"    },
  { value: "heian",       label: "平安"      },
  { value: "sengoku",     label: "戦国"      },
  { value: "edo",         label: "江戸"      },
  { value: "meiji",       label: "明治"      },
  { value: "taisho",      label: "大正"      },
  { value: "showa",       label: "昭和"      },
  { value: "90s",         label: "90s"       },
  { value: "y2k",         label: "Y2K"       },
  { value: "modern",      label: "現代"      },
  { value: "near_future", label: "近未来"    },
  { value: "y3k",         label: "Y3K"       },
  { value: "far_future",  label: "超未来"    },
  { value: "apocalypse",  label: "終末"      },
];

// ── 色戦略定義 ────────────────────────────────────────────────────────────────

export interface ColorStrategyOption {
  value: ColorStrategy;
  label: string;
  /** true = NG 系（赤いアクセント）。false/省略 = 肯定系（緑/青アクセント） */
  isNg?: boolean;
}

export const COLOR_STRATEGY_OPTIONS: ColorStrategyOption[] = [
  { value: "auto",          label: "おまかせ"   },
  { value: "red_only",      label: "赤だけ"     },
  { value: "warm",          label: "暖色"        },
  { value: "cool_tone",     label: "寒色"        },
  { value: "complement",    label: "補色"        },
  { value: "mono",          label: "モノクロ"    },
  { value: "pastel",        label: "パステル"    },
  { value: "vivid",         label: "高彩度"      },
  { value: "muted",         label: "低彩度"      },
  { value: "white_base",    label: "白基調"      },
  { value: "black_base",    label: "黒基調"      },
  { value: "no_color",      label: "色禁止",     isNg: true },
  { value: "no_blue",       label: "青NG",       isNg: true },
  { value: "no_purple",     label: "紫NG",       isNg: true },
  { value: "no_pink",       label: "ピンクNG",   isNg: true },
  { value: "no_transparent", label: "透明素材NG", isNg: true },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  era: Era | null;
  colorStrategy: ColorStrategy | null;
  onEraChange: (v: Era | null) => void;
  onColorStrategyChange: (v: ColorStrategy | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EraColorSelector({ era, colorStrategy, onEraChange, onColorStrategyChange }: Props) {
  return (
    <div className="space-y-3">

      {/* ── 時代 ─────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-black uppercase tracking-widest text-text-muted/80 select-none">
            🕰 時代
          </span>
          {era !== null && (
            <button
              type="button"
              onClick={() => onEraChange(null)}
              className="text-[11px] text-text-muted/65 hover:text-amber-400/80 transition leading-none"
            >
              解除
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {ERA_OPTIONS.map((opt) => {
            const active = era === opt.value;
            const isAuto = opt.value === "auto";
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onEraChange(active ? null : opt.value)}
                className={[
                  "text-[11px] font-semibold px-2 py-0.5 rounded border transition leading-none whitespace-nowrap",
                  active
                    ? isAuto
                      ? "bg-violet-500/30 border-violet-400/70 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.35)]"
                      : "bg-amber-500/25 border-amber-400/60 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                    : "bg-transparent border-[#252e44] text-text-muted/80 hover:border-[#3a4460] hover:text-text-muted/95",
                ].join(" ")}
              >
                {active && <span className="mr-0.5 text-[11px]">✓</span>}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 色戦略 ───────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-black uppercase tracking-widest text-text-muted/80 select-none">
            🎨 色戦略
          </span>
          {colorStrategy !== null && (
            <button
              type="button"
              onClick={() => onColorStrategyChange(null)}
              className="text-[11px] text-text-muted/65 hover:text-rose-400/80 transition leading-none"
            >
              解除
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {COLOR_STRATEGY_OPTIONS.map((opt) => {
            const active = colorStrategy === opt.value;
            const isAuto = opt.value === "auto";
            const isNg = opt.isNg;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onColorStrategyChange(active ? null : opt.value)}
                className={[
                  "text-[11px] font-semibold px-2 py-0.5 rounded border transition leading-none whitespace-nowrap",
                  active
                    ? isAuto
                      ? "bg-violet-500/30 border-violet-400/70 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.35)]"
                      : isNg
                        ? "bg-rose-500/25 border-rose-400/60 text-rose-200 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                        : "bg-teal-500/25 border-teal-400/60 text-teal-200 shadow-[0_0_8px_rgba(20,184,166,0.3)]"
                    : isNg
                      ? "bg-transparent border-rose-900/50 text-rose-400/70 hover:border-rose-500/60 hover:text-rose-300/90"
                      : "bg-transparent border-[#252e44] text-text-muted/80 hover:border-[#3a4460] hover:text-text-muted/95",
                ].join(" ")}
              >
                {active && <span className="mr-0.5 text-[11px]">✓</span>}
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted/65 leading-relaxed">
          NG系（赤文字）は該当色をプロンプトから除外。Y3Kの青偏りも防止。
        </p>
      </div>

    </div>
  );
}
