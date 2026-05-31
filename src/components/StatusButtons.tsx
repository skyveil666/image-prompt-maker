import type { HistoryStatus } from "../types";

interface Props {
  value: HistoryStatus;
  onChange: (next: HistoryStatus) => void;
}

const OPTIONS: {
  id: Exclude<HistoryStatus, "unused">;
  label: string;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    id: "posted",
    label: "📤 投稿した",
    activeClass:
      "border-violet-400/70 bg-gradient-to-r from-violet-400/30 to-purple-400/20 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.30)]",
    idleClass:
      "border-violet-400/30 bg-violet-400/5 text-violet-200/80 hover:bg-violet-400/15 hover:border-violet-400/50",
  },
  {
    id: "used",
    label: "使用した",
    activeClass:
      "border-sky-400/70 bg-gradient-to-r from-sky-400/30 to-blue-400/20 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.25)]",
    idleClass:
      "border-sky-400/30 bg-sky-400/5 text-sky-200/80 hover:bg-sky-400/15 hover:border-sky-400/50",
  },
  {
    id: "good",
    label: "結果よかった",
    activeClass:
      "border-emerald-400/70 bg-gradient-to-r from-emerald-400/30 to-teal-400/20 text-emerald-100 shadow-[0_0_10px_rgba(52,211,153,0.25)]",
    idleClass:
      "border-emerald-400/30 bg-emerald-400/5 text-emerald-200/80 hover:bg-emerald-400/15 hover:border-emerald-400/50",
  },
  {
    id: "bad",
    label: "微妙だった",
    activeClass:
      "border-rose-400/70 bg-gradient-to-r from-rose-400/30 to-red-400/20 text-rose-100 shadow-[0_0_10px_rgba(251,113,133,0.25)]",
    idleClass:
      "border-rose-400/30 bg-rose-400/5 text-rose-200/80 hover:bg-rose-400/15 hover:border-rose-400/50",
  },
];

export function StatusButtons({ value, onChange }: Props) {
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(active ? "unused" : opt.id)}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold border transition",
              active ? opt.activeClass : opt.idleClass,
            ].join(" ")}
            title={active ? "選択解除" : opt.label}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
