/**
 * 出力先モデル選択コンポーネント。
 *
 * [✦ ChatGPT] [⚡ ChatGPT短縮] [🍌 Nano Banana]
 *
 * 出力先に応じてプロンプト構造を最適化する：
 *  - ChatGPT     : 詳細・長め（chatgpt_safe）
 *  - ChatGPT短縮 : 60-70%圧縮・生成成功率優先（chatgpt_short）
 *  - Nano Banana : 短文・軽量・顔固定優先（nano_safe）
 *
 * ※ 内部的に Gemini API を利用していても、ユーザー向け表示は「Nano Banana」に統一。
 */
import type { PromptTarget } from "../types";

interface Option {
  value: PromptTarget;
  label: string;
  icon: string;
  description: string;
  activeCls: string;
}

const OPTIONS: Option[] = [
  {
    value: "chatgpt_safe",
    label: "ChatGPT",
    icon: "✦",
    description: "ChatGPT / DALL-E 向け\n詳細・長めのプロンプト",
    activeCls: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  },
  {
    value: "chatgpt_short",
    label: "ChatGPT短縮",
    icon: "⚡",
    description: "ChatGPT 画像編集向け短縮版\n約60-70%圧縮・生成成功率優先",
    activeCls: "border-sky-400/50 bg-sky-400/10 text-sky-300",
  },
  {
    value: "nano_safe",
    label: "Nano Banana",
    icon: "🍌",
    description: "Nano Banana 向け\n短文・軽量・顔固定優先",
    activeCls: "border-amber-400/50 bg-amber-400/10 text-amber-300",
  },
];

interface Props {
  value: PromptTarget | null;
  onChange: (v: PromptTarget | null) => void;
}

export function PromptTargetSelector({ value, onChange }: Props) {
  // 旧 "full" / "gemini_safe" 等が保存されていた場合は ChatGPT 扱いで表示
  const effective: PromptTarget =
    value === "nano_safe"     ? "nano_safe"     :
    value === "chatgpt_short" ? "chatgpt_short" :
    "chatgpt_safe";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ラベル */}
      <span className="text-[13px] text-text-muted/80 shrink-0 select-none">
        出力先
      </span>

      {OPTIONS.map((opt) => {
        const active = effective === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.description}
            onClick={() => onChange(opt.value)}
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-semibold border transition whitespace-nowrap",
              active
                ? opt.activeCls
                : "border-[#1e2638] bg-[#0d1118] text-text-muted/55 hover:border-white/20 hover:text-text-muted/80",
            ].join(" ")}
          >
            <span className="text-[11px] opacity-90">{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
