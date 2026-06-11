/**
 * 色戦略の定義（COLOR_STRATEGY_OPTIONS）。
 *
 * ※ 旧「時代軸」セレクター（ERA_OPTIONS / EraColorSelector コンポーネント）は撤去（dead code整理・
 *    グローバル era は生成にも不使用だった）。ファイル名は互換のため維持
 *    （DetailsCard が COLOR_STRATEGY_OPTIONS を import）。
 */

import type { ColorStrategy } from "../types";

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
