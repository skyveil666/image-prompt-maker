/**
 * クイックプリセットバー（v2）
 *
 * - プリセット選択中：上部にアクティブ情報バー
 *     [絵文字 プリセット名] · [弱][標準][強] · 対象: 背景/光/小物 · [× 解除]
 * - プリセット未選択：ボタン行のみ
 * - ダイアログ不要：情報は上部バーで静かに表示
 */
import type { Preset, PresetIntensity } from "../lib/presets";
import {
  STYLE_PRESETS,
  TREND_PRESETS,
  INTENSITY_LABELS,
  getIntensityScopes,
} from "../lib/presets";

const SCOPE_LABELS: Record<string, string> = {
  background: "背景",
  lighting:   "光",
  props:      "小物",
  hair:       "髪",
  outfit:     "衣装",
  color:      "色味",
};

const INTENSITIES: PresetIntensity[] = ["weak", "standard", "strong"];

interface Props {
  activePresetId:    string | null;
  presetIntensity:   PresetIntensity;
  onApply:           (preset: Preset) => void;
  onClear:           () => void;
  onIntensityChange: (intensity: PresetIntensity) => void;
}

export function PresetBar({
  activePresetId,
  presetIntensity,
  onApply,
  onClear,
  onIntensityChange,
}: Props) {
  const allPresets   = [...STYLE_PRESETS, ...TREND_PRESETS];
  const activePreset = activePresetId
    ? (allPresets.find((p) => p.id === activePresetId) ?? null)
    : null;

  const activeScopes = activePreset
    ? getIntensityScopes(activePreset, presetIntensity)
    : [];

  return (
    <div className="card !py-2 !px-3 flex flex-col gap-1.5">

      {/* ── アクティブ情報バー（選択中のみ） ─────────────────────────────────── */}
      {activePreset && (
        <div className="flex items-center gap-2 flex-wrap pb-1.5 border-b border-white/5">

          {/* プリセット名 */}
          <span className="text-[12px] font-semibold text-text-base/90 shrink-0">
            {activePreset.emoji} {activePreset.label}
          </span>

          {/* 強度セレクター */}
          <div
            className="inline-flex items-center rounded border border-white/10 overflow-hidden shrink-0"
            role="group"
            aria-label="強度"
          >
            {INTENSITIES.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onIntensityChange(lvl)}
                className={[
                  "px-2.5 py-0.5 text-[10px] font-semibold leading-snug transition",
                  lvl === presetIntensity
                    ? "bg-accent/30 text-accent"
                    : "bg-transparent text-text-muted/45 hover:text-text-muted/80 hover:bg-white/5",
                ].join(" ")}
              >
                {INTENSITY_LABELS[lvl]}
              </button>
            ))}
          </div>

          {/* 対象スコープ */}
          {activeScopes.length > 0 && (
            <span className="text-[11px] text-text-muted/50 shrink-0">
              対象: {activeScopes.map((s) => SCOPE_LABELS[s] ?? s).join(" / ")}
            </span>
          )}

          {/* 右揃え：解除ボタン */}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 px-2 py-0.5 rounded border border-text-muted/15 text-[10px] text-text-muted/40 hover:border-rose-400/40 hover:text-rose-300 transition"
            title="プリセットを解除（設定はそのまま）"
          >
            × 解除
          </button>
        </div>
      )}

      {/* ── プリセットボタン行 ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* Style */}
        <span className="text-[10px] uppercase tracking-widest text-text-muted/40 select-none mr-0.5 shrink-0">
          Style
        </span>
        {STYLE_PRESETS.map((p) => (
          <PresetBtn
            key={p.id}
            preset={p}
            active={activePresetId === p.id}
            onClick={() => onApply(p)}
          />
        ))}

        {/* 区切り */}
        <span className="text-text-muted/20 text-sm select-none mx-0.5 shrink-0">│</span>

        {/* Trend */}
        <span className="text-[10px] uppercase tracking-widest text-text-muted/40 select-none mr-0.5 shrink-0">
          Trend
        </span>
        {TREND_PRESETS.map((p) => (
          <PresetBtn
            key={p.id}
            preset={p}
            active={activePresetId === p.id}
            onClick={() => onApply(p)}
          />
        ))}

        {/* 解除（情報バーなしの安全装置。通常は表示されない） */}
        {activePresetId && !activePreset && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1 shrink-0 text-[11px] px-2 py-1 rounded-lg border border-text-muted/20 bg-transparent text-text-muted/50 hover:border-rose-400/50 hover:text-rose-300 transition"
          >
            × 解除
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ボタン ──────────────────────────────────────────────────────────────────

function PresetBtn({
  preset,
  active,
  onClick,
}: {
  preset: Preset;
  active: boolean;
  onClick: () => void;
}) {
  const tooltip =
    preset.extraNote
      ? `${preset.label}\n${preset.extraNote}`
      : preset.label;

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={[
        "rounded-lg px-2.5 py-1 text-[12px] font-semibold border transition whitespace-nowrap leading-snug",
        active
          ? "border-accent/65 bg-accent/20 text-accent shadow-[0_0_8px_rgba(124,92,255,0.3)]"
          : preset.category === "trend"
          ? "border-[#1e2638] bg-[#0d1118] text-text-muted/65 hover:border-sky-400/35 hover:text-sky-200 hover:bg-sky-400/6"
          : "border-[#252e44] bg-[#0f1218] text-text-muted/70 hover:border-accent/40 hover:text-text-base hover:bg-[#161a2a]",
      ].join(" ")}
    >
      <span className="mr-1">{preset.emoji}</span>
      {preset.label}
    </button>
  );
}
