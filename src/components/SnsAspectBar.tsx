/**
 * SNS プラットフォーム別アスペクト比クイックバー。
 *
 * 「比率変更」トグル（初期OFF）でSNSボタンの有効/無効を切り替える。
 * - OFF: SNSボタン非活性、プロンプトに「元画像のアスペクト比を維持」
 * - ON : TikTok / IG縦 / 正方形 / 横長 を選択可能、選択比率をプロンプトに反映
 *
 * トグルはユーザーの明示的クリックのみで変わる（プリセット適用等では変わらない）。
 */
import type { AspectRatioPreset, DetailSettings, Scope } from "../types";

interface Props {
  details: DetailSettings;
  scopes: Scope[];
  aspectRatioEnabled: boolean;
  onDetailsChange: (next: DetailSettings) => void;
  onScopesChange: (next: Scope[]) => void;
  onAspectRatioEnabledChange: (v: boolean) => void;
}

const SNS_PRESETS: {
  label: string;
  icon: string;
  preset: AspectRatioPreset;
  title: string;
}[] = [
  { label: "TikTok",   icon: "📱", preset: "ar_9_16",  title: "縦型フル 9:16 — TikTok / Instagram Reels" },
  { label: "IG縦",     icon: "📸", preset: "ar_4_5",   title: "縦型 4:5 — Instagram 縦投稿" },
  { label: "正方形",   icon: "⬛", preset: "ar_1_1",   title: "正方形 1:1 — Instagram / X" },
  { label: "横長",     icon: "🖼", preset: "ar_16_9",  title: "横長ワイド 16:9 — Twitter(X) / YouTube" },
];

export function SnsAspectBar({
  details,
  scopes,
  aspectRatioEnabled,
  onDetailsChange,
  onScopesChange,
  onAspectRatioEnabledChange,
}: Props) {
  const activePreset = details.aspectRatio.preset;

  const apply = (preset: AspectRatioPreset) => {
    // トグルOFFなら操作不可
    if (!aspectRatioEnabled) return;

    const next: AspectRatioPreset = activePreset === preset ? "skip" : preset;
    onDetailsChange({ ...details, aspectRatio: { ...details.aspectRatio, preset: next } });

    if (next !== "skip") {
      // 比率選択 → aspect_ratio スコープを追加
      if (!scopes.includes("aspect_ratio")) {
        onScopesChange([...scopes, "aspect_ratio"]);
      }
    } else {
      // 比率解除（skip） → aspect_ratio スコープを除去
      onScopesChange(scopes.filter((s) => s !== "aspect_ratio"));
    }
  };

  const handleToggle = () => {
    onAspectRatioEnabledChange(!aspectRatioEnabled);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ── 比率変更トグル ──────────────────────────────── */}
      <button
        type="button"
        title={aspectRatioEnabled ? "比率変更ON（クリックでOFF）" : "比率変更OFF（クリックでON）"}
        onClick={handleToggle}
        className={[
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold border transition whitespace-nowrap shrink-0",
          aspectRatioEnabled
            ? "border-sky-400/65 bg-sky-400/15 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.25)]"
            : "border-[#252e44] bg-transparent text-text-muted/55 hover:border-[#3a4460] hover:text-text-muted/80",
        ].join(" ")}
      >
        <span className="text-[11px] leading-none">{aspectRatioEnabled ? "🔓" : "🔒"}</span>
        比率変更
      </button>

      {/* ── SNS プリセットボタン ─────────────────────────── */}
      {SNS_PRESETS.map((p) => {
        const active = aspectRatioEnabled && activePreset === p.preset;
        const disabled = !aspectRatioEnabled;
        return (
          <button
            key={p.preset}
            type="button"
            title={disabled ? "「比率変更」をONにすると選択できます" : p.title}
            disabled={disabled}
            onClick={() => apply(p.preset)}
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition whitespace-nowrap",
              disabled
                ? "border-[#1a1e2a] bg-[#0a0c10] text-text-muted/25 cursor-not-allowed"
                : active
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.25)]"
                  : "border-[#1e2638] bg-[#0d1118] text-text-muted/85 hover:border-white/30 hover:text-text-base",
            ].join(" ")}
          >
            <span className="text-[10px]">{p.icon}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
