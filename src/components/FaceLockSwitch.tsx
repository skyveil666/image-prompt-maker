interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

/**
 * 顔絶対固定ロックの大型バナー。
 * 初期 ON。OFF にすると system prompt から強い顔固定文言が外れる。
 */
export function FaceLockSwitch({ value, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={[
        "w-full rounded-2xl px-5 py-4 border transition flex items-center justify-between gap-3",
        value
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-amber-500/60 bg-amber-500/10",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 text-left">
        <span className="text-2xl">🔒</span>
        <div>
          <div
            className={[
              "text-sm font-bold",
              value ? "text-emerald-200" : "text-amber-200",
            ].join(" ")}
          >
            {value ? "顔を絶対変えない（ON）" : "顔ロック OFF（顔が変わる可能性あり）"}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            顔の造形・目・鼻・口・輪郭・人物の同一性を完全維持するよう全プロンプトに強制注入します。
          </div>
        </div>
      </div>
      <span
        className={[
          "inline-block w-12 h-7 rounded-full relative transition shrink-0",
          value ? "bg-emerald-500" : "bg-bg-border",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition",
            value ? "translate-x-5" : "",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
