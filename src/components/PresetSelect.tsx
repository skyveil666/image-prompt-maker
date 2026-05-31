import type { PresetItem } from "../data/presets";

interface Props {
  label: string;
  value: string;            // "auto" or preset id
  onChange: (v: string) => void;
  options: PresetItem[];
  autoLabel?: string;
}

/**
 * 詳細設定で使う、ラベル付き <select>。
 * - ラベルは強調表示
 * - "auto" が選ばれている時はミュート、固定値が選ばれていると紫アクセント
 */
export function PresetSelect({
  label,
  value,
  onChange,
  options,
  autoLabel = "おまかせ（案ごとに変化）",
}: Props) {
  const pinned = value !== "auto";
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className={[
          "text-[13px] font-semibold tracking-wide",
          pinned ? "text-accent" : "text-text-base",
        ].join(" ")}
      >
        {label}
        {pinned && <span className="ml-1 text-[10px] text-accent/80">●固定</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "bg-bg-base border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition",
          pinned
            ? "border-accent/70 ring-1 ring-accent/30 text-text-base"
            : "border-bg-border text-text-base hover:border-accent/40 focus:border-accent",
        ].join(" ")}
      >
        <option value="auto">{autoLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
