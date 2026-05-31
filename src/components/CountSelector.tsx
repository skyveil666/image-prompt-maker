import type { Count } from "../types";

interface Props {
  value: Count;
  onChange: (next: Count) => void;
}

/** 生成数タグセレクタ。コンパクトな 4 ボタン。 */
export function CountSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {([3, 4, 5, 6] as Count[]).map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={[
              "px-3.5 py-2 text-sm rounded-lg border font-semibold transition leading-none",
              active
                ? "border-accent bg-accent/20 text-text-base shadow-[0_0_0_1px_rgba(124,92,255,0.35)]"
                : "border-bg-border bg-bg-panel/70 text-text-muted hover:text-text-base hover:border-accent/50",
            ].join(" ")}
          >
            {c}案
          </button>
        );
      })}
    </div>
  );
}
