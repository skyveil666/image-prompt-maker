import { useState } from "react";
import type { SafetyMode } from "../types";

interface Props {
  value: SafetyMode;
  onChange: (next: SafetyMode) => void;
  /** true のとき横並びセグメントボタン＋ヒントアイコンで表示 */
  compact?: boolean;
}

const OPTIONS: { id: SafetyMode; label: string; hint: string }[] = [
  {
    id: "fictional_ai",
    label: "AI生成・架空キャラ",
    hint: "「実在人物ではない」前提文を入れる",
  },
  {
    id: "real_person",
    label: "実在人物",
    hint: "架空主張を入れず、編集範囲のみ宣言",
  },
];

export function SafetyToggle({ value, onChange, compact = false }: Props) {
  const [hintOpen, setHintOpen] = useState(false);

  // ─ コンパクトモード ────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-text-muted/55 shrink-0 select-none pr-0.5">
          安全文
        </span>

        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              "text-[12px] px-2.5 py-1 rounded-lg border transition font-medium whitespace-nowrap leading-snug",
              value === opt.id
                ? "border-violet-400/65 bg-violet-400/18 text-violet-100"
                : "border-[#252e44] bg-[#0f1015] text-text-muted/70 hover:border-violet-400/40 hover:text-text-base",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}

        {/* ヒントアイコン */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setHintOpen((v) => !v)}
            onBlur={() => setTimeout(() => setHintOpen(false), 150)}
            aria-label="安全文モードの説明"
            className={[
              "w-[18px] h-[18px] rounded-full border text-[10px] flex items-center justify-center transition font-bold leading-none",
              hintOpen
                ? "border-accent/55 text-accent/85 bg-accent/12"
                : "border-text-muted/22 text-text-muted/40 hover:border-accent/50 hover:text-accent/70",
            ].join(" ")}
          >
            ?
          </button>

          {hintOpen && (
            <div className="absolute bottom-full right-0 mb-2 z-30 pointer-events-none">
              <div className="bg-[#191d2d] border border-[#2a3158] rounded-xl p-3 text-[11px] text-text-muted w-56 space-y-2 shadow-2xl">
                {OPTIONS.map((opt) => (
                  <div key={opt.id}>
                    <div className="text-text-base font-semibold mb-0.5">{opt.label}</div>
                    <div>{opt.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─ フルモード（後方互換） ───────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              "w-full text-left rounded-xl px-3 py-2.5 border transition",
              active
                ? "border-accent bg-accent/15 text-text-base"
                : "border-bg-border bg-bg-panel text-text-muted hover:border-accent/60 hover:text-text-base",
            ].join(" ")}
          >
            <div className="text-sm font-semibold">{opt.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{opt.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
