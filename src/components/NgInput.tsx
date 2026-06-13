import { useAutoResizeTextarea } from "../lib/useAutoResizeTextarea";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const PLACEHOLDER = "例：露出高めNG / 武器NG / ピンクNG";

/** 「NG指定」入力欄 */
export function NgInput({ value, onChange }: Props) {
  const ref = useAutoResizeTextarea(value);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={PLACEHOLDER}
      rows={2}
      style={{ overflow: "hidden" }}
      className="w-full bg-bg-base border border-bg-border/50 rounded px-2.5 py-1.5 text-[13px] text-text-base placeholder:text-text-muted/65 leading-snug focus:outline-none focus:border-rose-400/40 focus:shadow-[0_0_0_2px_rgba(248,113,113,0.10)] transition-all"
    />
  );
}
