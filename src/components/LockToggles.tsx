import type { LockKey } from "../types";

interface Props {
  value: Record<LockKey, boolean>;
  onChange: (next: Record<LockKey, boolean>) => void;
}

const OPTIONS: { id: LockKey; label: string }[] = [
  { id: "face", label: "顔" },
  { id: "body_shape", label: "体型" },
  { id: "expression", label: "表情" },
  { id: "identity", label: "人物の同一性" },
  { id: "color", label: "色味" },
  { id: "camera", label: "カメラ" },
  { id: "aspect_ratio", label: "アスペクト比" },
];

export function LockToggles({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {OPTIONS.map((opt) => {
        const on = value[opt.id];
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange({ ...value, [opt.id]: !on })}
            className={[
              "rounded-xl px-3 py-2 text-sm border transition flex items-center justify-between",
              on
                ? "border-accent/60 bg-accent/10 text-text-base"
                : "border-bg-border bg-bg-panel text-text-muted hover:text-text-base",
            ].join(" ")}
          >
            <span>{opt.label}</span>
            <span
              className={[
                "inline-block w-8 h-4 rounded-full relative transition",
                on ? "bg-accent" : "bg-bg-border",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition",
                  on ? "translate-x-4" : "",
                ].join(" ")}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
