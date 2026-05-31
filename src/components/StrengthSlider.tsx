/**
 * Prompt Strength スライダー (1〜5)。
 * 1 = 原型維持  3 = 標準  5 = 大胆変更
 */

interface Props {
  value: number;
  onChange: (v: number) => void;
}

const LABELS: Record<number, string> = {
  1: "原型維持",
  2: "やや控えめ",
  3: "標準",
  4: "大胆",
  5: "最大変化",
};

const STEP_COLORS = [
  "hover:border-sky-400/60  hover:text-sky-200",
  "hover:border-teal-400/60 hover:text-teal-200",
  "hover:border-text-muted/60 hover:text-text-base",
  "hover:border-orange-400/60 hover:text-orange-200",
  "hover:border-rose-400/60 hover:text-rose-200",
];

const ACTIVE_COLORS = [
  "border-sky-400/60  bg-sky-400/15  text-sky-200  shadow-[0_0_6px_rgba(56,189,248,0.3)]",
  "border-teal-400/60 bg-teal-400/15 text-teal-200 shadow-[0_0_6px_rgba(45,212,191,0.3)]",
  "border-accent/60   bg-accent/18   text-accent   shadow-[0_0_6px_rgba(124,92,255,0.3)]",
  "border-orange-400/60 bg-orange-400/15 text-orange-200 shadow-[0_0_6px_rgba(251,146,60,0.3)]",
  "border-rose-400/60 bg-rose-400/15 text-rose-200 shadow-[0_0_6px_rgba(244,63,94,0.3)]",
];

export function StrengthSlider({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {/* ラベル */}
      <span className="text-[11px] text-text-muted/50 shrink-0 select-none whitespace-nowrap">
        Strength
      </span>

      {/* 5段階ボタン */}
      <div className="flex items-center gap-1 shrink-0">
        {[1, 2, 3, 4, 5].map((n) => {
          const isActive = value === n;
          const idx = n - 1;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              title={LABELS[n]}
              className={[
                "w-6 h-6 rounded-md border text-[11px] font-bold transition leading-none",
                isActive
                  ? ACTIVE_COLORS[idx]
                  : `border-[#252e44] bg-[#0f1015] text-text-muted/40 ${STEP_COLORS[idx]}`,
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* 現在の説明 */}
      <span className="text-[12px] font-semibold text-text-muted/80 shrink-0 leading-none">
        {LABELS[value]}
      </span>

      {/* 範囲ラベル（PC のみ表示） */}
      <span className="hidden sm:block text-[10px] text-text-muted/25 ml-auto shrink-0 select-none">
        原型維持 ←→ 大胆変更
      </span>
    </div>
  );
}
