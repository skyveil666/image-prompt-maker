/**
 * BoostControls — 「生成ブースト」セクションの中身（お気に入り傾向 + ZOZOトレンド）
 *
 * ControlPanel の boostArea スロットに差し込まれる。
 * （旧 ReflectionOptionsBar のうち、変更/固定サマリーとリセットを除いた補助部分を継承）
 */
import type { FavoriteProfile } from "../lib/favoriteProfile";
import type { ZozoTrend } from "../lib/zozoTrend";
import { ZozoTrendBar } from "./ZozoTrendBar";

const STRENGTH_OPTIONS = [
  { value: 1, label: "弱" },
  { value: 2, label: "標準" },
  { value: 3, label: "強" },
];

interface Props {
  // お気に入り学習
  favoriteEnabled: boolean;
  onFavoriteEnabledChange: (v: boolean) => void;
  favoriteStrength: number;
  onFavoriteStrengthChange: (v: number) => void;
  favoriteProfile: FavoriteProfile | null;
  // ZOZOトレンド
  outfitScopeOn: boolean;
  /** 衣装系の他指定がアクティブか（神引き衣装・世界観衣装系など） */
  outfitConflict?: boolean;
  zozoApplied: ZozoTrend | null;
  onZozoApply: (t: ZozoTrend) => void;
  onZozoSetPriority?: (priority: boolean) => void;
  onZozoClear: () => void;
  // 風の強さ（0〜5）
  windLevel: number;
  onWindLevelChange: (v: number) => void;
  /** 風が反映可能なスコープがONか（OFFならグレーアウト＋未反映ラベル） */
  windApplicable: boolean;
}

const WIND_LEVELS: { value: number; label: string; full: string }[] = [
  { value: 0, label: "0", full: "0：無風（髪・服は静止）" },
  { value: 1, label: "1", full: "1：微風（髪先・薄布が少しだけ動く）" },
  { value: 2, label: "2", full: "2：ややなびく（端が軽くなびく）" },
  { value: 3, label: "3", full: "3：標準（自然になびく）" },
  { value: 4, label: "4", full: "4：強め（大きく流れる）" },
  { value: 5, label: "5", full: "5：強風（ドラマチックに流れる）" },
];

export function BoostControls({
  favoriteEnabled, onFavoriteEnabledChange, favoriteStrength, onFavoriteStrengthChange, favoriteProfile,
  outfitScopeOn, outfitConflict = false, zozoApplied, onZozoApply, onZozoSetPriority, onZozoClear,
  windLevel, onWindLevelChange, windApplicable,
}: Props) {
  const favHasData = (favoriteProfile?.favoriteCount ?? 0) > 0;
  const favTraits = favoriteProfile?.traitPhrases ?? [];

  return (
    <div className="space-y-1">
      {/* ── 全体補助（選択中の変更対象すべてに効く）── */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-text-muted/60 leading-none select-none">全体補助</span>
        <span className="text-[10px] text-text-muted/40 leading-none">お気に入り傾向・風（神引きは「神引き」ボタンから）</span>
      </div>
      {/* ── お気に入り傾向 ── */}
      <div className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap">
        <button
          type="button"
          disabled={!favHasData}
          onClick={() => onFavoriteEnabledChange(!favoriteEnabled)}
          title={favHasData
            ? (favoriteEnabled ? "お気に入り傾向 ON（クリックでOFF）" : "お気に入り傾向 OFF（クリックでON）")
            : "お気に入りがありません"}
          className={[
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold leading-none transition shrink-0",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            favoriteEnabled && favHasData
              ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
              : "border-bg-border bg-bg-panel/60 text-text-muted/70 hover:border-amber-400/35",
          ].join(" ")}
        >
          <span>⭐ お気に入り傾向</span>
          <span className={favoriteEnabled && favHasData ? "text-amber-300" : "text-text-muted/50"}>
            {favoriteEnabled && favHasData ? "ON" : "OFF"}
          </span>
        </button>

        {favoriteEnabled && favHasData && (
          <div className="flex rounded-lg border border-amber-400/30 overflow-hidden shrink-0">
            {STRENGTH_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onFavoriteStrengthChange(o.value)}
                className={[
                  "text-[12px] px-2 py-0.5 leading-none transition",
                  favoriteStrength === o.value
                    ? "bg-amber-500/70 text-white font-bold"
                    : "text-amber-200/60 hover:bg-amber-400/15",
                ].join(" ")}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {!favHasData && (
          <span className="text-[12px] text-text-muted/45 leading-snug">
            お気に入りを登録すると、好みの傾向を学習して反映できます。
          </span>
        )}

        {/* ── 風の強さ（0〜5）── */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <span className={[
            "text-[12px] font-semibold leading-none",
            windLevel > 0 && windApplicable ? "text-cyan-200"
            : windLevel > 0 ? "text-cyan-200/40"
            : "text-text-muted/55",
          ].join(" ")} title="風の強さ（髪・衣装・前景演出・ポーズ・カメラのいずれかON時のみ反映）">
            🌬️ 風
          </span>
          <span className="flex rounded-md border border-cyan-400/30 overflow-hidden">
            {WIND_LEVELS.map((o) => {
              const active = windLevel === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onWindLevelChange(o.value)}
                  title={o.full}
                  className={[
                    "text-[12px] font-bold w-6 py-0.5 leading-none transition",
                    active
                      ? (o.value === 0
                          ? "bg-text-muted/30 text-white"
                          : "bg-cyan-500/70 text-white shadow-[0_0_6px_rgba(34,211,238,0.45)]")
                      : "text-cyan-200/60 hover:bg-cyan-400/15 hover:text-cyan-100",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              );
            })}
          </span>
          {windLevel > 0 && !windApplicable && (
            <span className="text-[11px] text-amber-300/75 leading-none whitespace-nowrap">
              ⚠ 未反映（対象スコープOFF）
            </span>
          )}
        </div>
      </div>

      {/* 反映中の傾向（ON時のみ・小さく表示） */}
      {favoriteEnabled && favHasData && favTraits.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[12px] text-amber-200/55 leading-none mr-0.5">傾向:</span>
          {favTraits.map((t) => (
            <span key={t}
              className="text-[12px] px-1.5 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-100/85 leading-none">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* ── 衣装補助（衣装ON時のみ有効）── */}
      <div className="border-t border-bg-border/30 pt-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-text-muted/60 leading-none select-none">衣装補助</span>
          {!outfitScopeOn && (
            <span className="text-[10px] text-amber-300/70 leading-none">衣装ONで使えます</span>
          )}
        </div>
        <ZozoTrendBar
          embedded
          outfitScopeOn={outfitScopeOn}
          outfitConflict={outfitConflict}
          applied={zozoApplied}
          onApply={onZozoApply}
          onSetPriority={onZozoSetPriority}
          onClear={onZozoClear}
        />
      </div>
    </div>
  );
}
