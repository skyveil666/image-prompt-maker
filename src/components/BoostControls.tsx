/**
 * BoostControls — 「生成ブースト」セクションの中身（風のなびき + ZOZOトレンド）
 *
 * ControlPanel の boostArea スロットに差し込まれる。
 * お気に入り傾向（好み学習）は「あなたの好み（skyveil）」へ集約したため、ここからは撤去。
 */
import type { ZozoTrend } from "../lib/zozoTrend";
import { ZozoTrendBar } from "./ZozoTrendBar";
import { OUTFIT_EXPOSURES, OUTFIT_DECORATIONS } from "../data/presets";

interface Props {
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
  // 👗 衣装スライダー（露出3段・派手さ4段）— details.outfit を単一ソースに読み書き
  outfitExposure: string;
  outfitDecoration: string;
  onOutfitField: (field: "exposure" | "decoration", id: string) => void;
}

const WIND_LEVELS: { value: number; label: string; full: string }[] = [
  { value: 0, label: "0", full: "0：無風（髪・服は静止）" },
  { value: 1, label: "1", full: "1：微風（髪先・薄布が少しだけ動く）" },
  { value: 2, label: "2", full: "2：ややなびく（端が軽くなびく）" },
  { value: 3, label: "3", full: "3：標準（自然になびく）" },
  { value: 4, label: "4", full: "4：強め（大きく流れる）" },
  { value: 5, label: "5", full: "5：強風（ドラマチックに流れる）" },
];

// 衣装スライダー（露出3段・派手さ4段）。id は presets / OUTFIT_LABELS と完全一致＝§4キー（本文反映は既存経路を再利用）。
const OUTFIT_EXPOSURE_STEPS = [
  { id: "low",    label: "控えめ" },
  { id: "normal", label: "普通"   },
  { id: "high",   label: "高め"   },
] as const;
const OUTFIT_FLASHY_STEPS = [
  { id: "minimal",   label: "地味" },
  { id: "moderate",  label: "標準" },
  { id: "elaborate", label: "派手" },
  { id: "maximal",   label: "最大" },
] as const;

/** presets 配列から value(id)→表示ラベルを引く（表示専用・値定義は変更しない）。 */
function labelOf(items: { id: string; label: string }[], value: string): string {
  return items.find((o) => o.id === value)?.label ?? value;
}

/**
 * 衣装の露出/派手さを段階ボタンで操作する行（風 WIND 行と同じセグメント意匠）。
 * - value は details.outfit.exposure/decoration を直接受ける（ローカル state 無し＝DetailsCard グリッドとミラー）。
 * - アクティブ再クリックで "skip"（DetailsCard の FieldSection と同挙動）。
 * - 非スライダー値（長袖/種類値/auto/skip）の時は全ボタン非アクティブ。具体値の時だけ amber 注記。
 * - 押下時のみ onPick を呼ぶ（レンダでは書かない＝グリッドの非スライダー値を壊さない）。
 */
function OutfitLevelRow({
  icon, label, value, steps, currentLabel, disabled, disabledHint, onPick,
}: {
  icon: string;
  label: string;
  value: string;
  steps: readonly { id: string; label: string }[];
  currentLabel: string;
  disabled: boolean;
  disabledHint?: string;
  onPick: (id: string) => void;
}) {
  const onSlider = steps.some((s) => s.id === value);
  const offSliderConcrete = !onSlider && value !== "skip" && value !== "auto";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* 操作部：disabled 時のみグレー（チップを読めるよう opacity は内側に閉じる）*/}
      <div className={[
        "flex items-center gap-1.5",
        disabled ? "opacity-40 pointer-events-none" : "",
      ].join(" ")}>
        <span
          className="text-[12px] font-semibold text-sky-200/90 leading-none shrink-0"
          title={`衣装の${label}（衣装ON時のみ反映）`}
        >
          {icon} {label}
        </span>
        <span className="flex rounded-md border border-sky-400/30 overflow-hidden">
          {steps.map((o) => {
            const active = value === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onPick(active ? "skip" : o.id)}
                title={o.label}
                className={[
                  "text-[12px] font-bold px-2.5 py-0.5 leading-none transition",
                  active
                    ? "bg-sky-500/70 text-white shadow-[0_0_6px_rgba(56,189,248,0.45)]"
                    : "text-sky-200/60 hover:bg-sky-400/15 hover:text-sky-100",
                ].join(" ")}
              >
                {o.label}
              </button>
            );
          })}
        </span>
        {!disabled && offSliderConcrete && (
          <span className="text-[11px] text-amber-300/75 leading-none whitespace-nowrap">
            詳細設定で「{currentLabel}」選択中
          </span>
        )}
      </div>
      {/* グレー理由チップ：full opacity（disabled の外側）*/}
      {disabled && disabledHint && (
        <span className="text-[10px] font-bold text-amber-300/85 border border-amber-400/40 bg-amber-400/10 rounded-full px-1.5 py-0.5 leading-none whitespace-nowrap select-none">
          {disabledHint}
        </span>
      )}
    </div>
  );
}

export function BoostControls({
  outfitScopeOn, outfitConflict = false, zozoApplied, onZozoApply, onZozoSetPriority, onZozoClear,
  windLevel, onWindLevelChange, windApplicable,
  outfitExposure, outfitDecoration, onOutfitField,
}: Props) {
  return (
    <div className="space-y-2">
      {/* ── 全体補助（風のなびき）＝cyan カード（SkyveilBar 意匠：rounded-2xl＋枠/50＋tint/8）── */}
      <div className="rounded-2xl border border-cyan-400/50 bg-cyan-500/8 px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[13px] font-bold text-cyan-200/90 leading-none select-none">全体補助</span>
        </div>
        {/* ── 横一列：風・露出・派手さ（gap-x-5・flex-wrap で幅狭時は折り返し）── */}
        <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap">
          {/* 風グループ（既存のまま＋風desc を segmented 直後に短縮内包）*/}
          <div className="flex items-center gap-1.5 shrink-0">
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
            <span className="text-[10px] text-text-muted/40 leading-none whitespace-nowrap select-none">髪/衣装/前景/ポーズ/カメラ</span>
            {windLevel > 0 && !windApplicable && (
              <span className="text-[11px] text-amber-300/75 leading-none whitespace-nowrap">
                ⚠ 未反映（対象スコープOFF）
              </span>
            )}
          </div>
          {/* 露出（3段）：衣装スコープ連動・OFF時「衣装ON」チップ */}
          <OutfitLevelRow
            icon="👗"
            label="露出"
            value={outfitExposure}
            steps={OUTFIT_EXPOSURE_STEPS}
            currentLabel={labelOf(OUTFIT_EXPOSURES, outfitExposure)}
            disabled={!outfitScopeOn}
            disabledHint="衣装ON"
            onPick={(id) => onOutfitField("exposure", id)}
          />
          {/* 派手さ（4段）*/}
          <OutfitLevelRow
            icon="✨"
            label="派手さ"
            value={outfitDecoration}
            steps={OUTFIT_FLASHY_STEPS}
            currentLabel={labelOf(OUTFIT_DECORATIONS, outfitDecoration)}
            disabled={!outfitScopeOn}
            disabledHint="衣装ON"
            onPick={(id) => onOutfitField("decoration", id)}
          />
        </div>
      </div>

      {/* ── 衣装補助＝sky カード（見出しは ZOZO に一本化・露出/派手さは全体補助カードへ移設）── */}
      <div className="rounded-2xl border border-sky-400/50 bg-sky-500/8 px-3 py-2">
        {/* 自動トレンド（ZOZO）── embedded（外枠は当 sky カードが担う・ZOZO 自前で見出し＋衣装OFF表示を持つ）*/}
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
