import type { Scope } from "../types";

interface Props {
  value: Scope[];
  onChange: (next: Scope[]) => void;
}

const OPTIONS: { id: Scope; label: string; hint: string }[] = [
  { id: "background", label: "背景", hint: "環境のみ再構築" },
  { id: "foreground", label: "前景演出", hint: "人物の手前に重なる演出・エフェクト" },
  { id: "pose", label: "ポーズ", hint: "姿勢・手足のみ変更" },
  { id: "hair", label: "髪", hint: "髪型・髪色のみ" },
  { id: "outfit", label: "衣装", hint: "服飾のみ" },
  { id: "cosplay", label: "コスプレ", hint: "コスプレ衣装・小物・スタイル" },
  { id: "cyber", label: "機械化", hint: "体の一部をSF的に機械化・デジタル化" },
  { id: "camera", label: "カメラアングル", hint: "視点・構図のみ変更" },
  { id: "props", label: "持ち物・小物", hint: "刀・小物・SNS映えアイテム追加" },
  { id: "lighting", label: "ライティング", hint: "光・影・色温度のみ変更" },
  { id: "aspect_ratio", label: "アスペクト比", hint: "画像のアスペクト比を変更" },
];

/**
 * 変更範囲タグセレクタ。横並び＋折り返しのコンパクトタグ。
 *  - 高さ ~38px、角丸 8px、密度高め
 *  - 選択中は紫アクセント
 */
export function ScopeSelector({ value, onChange }: Props) {
  const toggle = (id: Scope) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => {
        const active = value.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            title={opt.hint}
            className={[
              "px-3.5 py-2 text-sm rounded-lg border transition leading-none font-semibold",
              active
                ? "border-accent bg-accent/20 text-text-base shadow-[0_0_0_1px_rgba(124,92,255,0.35)]"
                : "border-bg-border bg-bg-panel/70 text-text-muted hover:text-text-base hover:border-accent/50",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
