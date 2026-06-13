import { useAutoResizeTextarea } from "../lib/useAutoResizeTextarea";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const PLACEHOLDER = "例：黒レザー寄り / 元の緑光を残す / もっとSNS映え";

/** 「追加指示」入力欄 */
export function ExtraInstructions({ value, onChange }: Props) {
  const ref = useAutoResizeTextarea(value);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={PLACEHOLDER}
      rows={2}
      style={{ overflow: "hidden" }}
      className="w-full bg-bg-base border border-bg-border/50 rounded px-2.5 py-1.5 text-[13px] text-text-base placeholder:text-text-muted/40 leading-snug focus:outline-none focus:border-violet-400/50 focus:shadow-[0_0_0_2px_rgba(124,92,255,0.12)] transition-all"
    />
  );
}
