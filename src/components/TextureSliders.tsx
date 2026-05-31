/**
 * 変更の強さ / 守るもの — コンパクト統合カード
 *
 * ┌─────────────────────────────────────────┐
 * │ 変更強度 [1][2][3][4][5]  やや控えめ    │
 * │ 光沢感   [1][2][3][4][5]  標準          │
 * │ 立体感   [1][2][3][4][5]  2.5D          │
 * ├─────────────────────────────────────────┤
 * │ 守るもの                                │
 * │ [🔒顔/同一性][体型/ポーズ][色味][構図][量産回避] │
 * ├─────────────────────────────────────────┤
 * │ [☑質感/立体感を反映] [元画像維持] [リセット] │
 * └─────────────────────────────────────────┘
 */

import type { Scope } from "../types";

// ── Step button colors (sky→teal→neutral→orange→rose) ────────────────────────

const STEP_COLORS = [
  "hover:border-sky-400/60  hover:text-sky-200",
  "hover:border-teal-400/60 hover:text-teal-200",
  "hover:border-text-muted/60 hover:text-text-base",
  "hover:border-orange-400/60 hover:text-orange-200",
  "hover:border-rose-400/60 hover:text-rose-200",
];

const ACTIVE_COLORS = [
  "border-sky-400/60  bg-sky-400/15  text-sky-200  shadow-[0_0_6px_rgba(56,189,248,0.3)]",
  "border-teal-400/60 bg-teal-400/15 text-teal-200 shadow-[0_0_6px_rgba(45,212,191,0.3)]",
  "border-accent/60   bg-accent/18   text-accent   shadow-[0_0_6px_rgba(124,92,255,0.3)]",
  "border-orange-400/60 bg-orange-400/15 text-orange-200 shadow-[0_0_6px_rgba(251,146,60,0.3)]",
  "border-rose-400/60 bg-rose-400/15 text-rose-200 shadow-[0_0_6px_rgba(244,63,94,0.3)]",
];

// ── Label maps ───────────────────────────────────────────────────────────────

const STRENGTH_LABELS: Record<number, string> = {
  1: "控えめ",
  2: "やや控えめ",
  3: "標準",
  4: "大きめ変更",
  5: "大胆変更",
};

const GLOSS_LABELS: Record<number, string> = {
  1: "マット",
  2: "控えめ",
  3: "標準",
  4: "光沢強め",
  5: "高光沢",
};

const DIM_LABELS: Record<number, string> = {
  1: "2D寄り",
  2: "やや平面的",
  3: "2.5D",
  4: "立体感強め",
  5: "3D寄り",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  strength: number;
  glossLevel: number;
  dimensionLevel: number;
  textureOriginal: boolean;
  textureDisabled: boolean;
  onStrengthChange: (v: number) => void;
  onGlossChange: (v: number) => void;
  onDimensionChange: (v: number) => void;
  onTextureOriginalChange: (v: boolean) => void;
  onTextureDisabledChange: (v: boolean) => void;
  bodyPoseLock: boolean;
  colorMoodLock: boolean;
  compositionLock: boolean;
  avoidCliche: boolean;
  onBodyPoseLockChange: (v: boolean) => void;
  onColorMoodLockChange: (v: boolean) => void;
  onCompositionLockChange: (v: boolean) => void;
  onAvoidClicheChange: (v: boolean) => void;
  scopes: Scope[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function TextureSliders({
  strength,
  glossLevel,
  dimensionLevel,
  textureOriginal,
  textureDisabled,
  onStrengthChange,
  onGlossChange,
  onDimensionChange,
  onTextureOriginalChange,
  onTextureDisabledChange,
  bodyPoseLock,
  colorMoodLock,
  compositionLock,
  avoidCliche,
  onBodyPoseLockChange,
  onColorMoodLockChange,
  onCompositionLockChange,
  onAvoidClicheChange,
  scopes,
}: Props) {
  const poseConflict     = scopes.includes("pose");
  const compConflict     = scopes.includes("camera") || scopes.includes("aspect_ratio");
  const glossDimDisabled = textureDisabled || textureOriginal;

  function handleReset() {
    onStrengthChange(2);
    onGlossChange(3);
    onDimensionChange(3);
    onTextureOriginalChange(false);
    onTextureDisabledChange(false);
  }

  return (
    <section className="card !p-2">

      {/* ── 変更強度 / 光沢感 / 立体感 ────────────────── */}
      <div className="space-y-1">
        <ButtonRow
          label="変更強度"
          value={strength}
          labels={STRENGTH_LABELS}
          onChange={onStrengthChange}
        />
        <div className={[
          "space-y-1 transition-opacity duration-150",
          glossDimDisabled ? "opacity-30 pointer-events-none" : "",
        ].join(" ")}>
          <ButtonRow
            label="光沢感"
            value={glossLevel}
            labels={GLOSS_LABELS}
            onChange={onGlossChange}
          />
          <ButtonRow
            label="立体感"
            value={dimensionLevel}
            labels={DIM_LABELS}
            onChange={onDimensionChange}
          />
        </div>
      </div>

      {/* ── 守るもの ────────────────────────────────────── */}
      <div className="mt-2 pt-2 border-t border-bg-border/25">
        <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap">
          <span className="text-[13px] font-semibold uppercase tracking-widest text-white/85 select-none shrink-0 leading-none">
            守るもの
          </span>
          {/* 顔/同一性: 固定ON */}
          <FixedChip label="🔒 顔/同一性" />
          <ProtectChip
            label="体型/ポーズ"
            value={bodyPoseLock}
            onChange={onBodyPoseLockChange}
            warn={poseConflict}
            warnTitle="「ポーズ」変更範囲と競合します"
          />
          <ProtectChip
            label="色味/雰囲気"
            value={colorMoodLock}
            onChange={onColorMoodLockChange}
          />
          <ProtectChip
            label="元画像構図"
            value={compositionLock}
            onChange={onCompositionLockChange}
            warn={compConflict}
            warnTitle="カメラ/アスペクト比変更範囲と競合します"
          />
          <ProtectChip
            label="量産回避"
            value={avoidCliche}
            onChange={onAvoidClicheChange}
            amber
          />
        </div>
      </div>

      {/* ── フッター制御 ─────────────────────────────────── */}
      <div className="mt-2 pt-2 border-t border-bg-border/25 flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!textureDisabled}
            onChange={(e) => onTextureDisabledChange(!e.target.checked)}
            className="w-3 h-3 accent-violet-500 cursor-pointer"
          />
          <span className={[
            "text-[13px] transition",
            textureDisabled ? "text-text-muted/35" : "text-text-muted/80",
          ].join(" ")}>
            質感/立体感を反映
          </span>
        </label>

        <button
          type="button"
          title="光沢感と立体感を元画像と同じに維持する"
          onClick={() => {
            onTextureOriginalChange(!textureOriginal);
            if (textureDisabled) onTextureDisabledChange(false);
          }}
          disabled={textureDisabled}
          className={[
            "px-2 py-1 rounded-lg border text-[13px] font-semibold transition",
            textureDisabled
              ? "border-bg-border/25 text-text-muted/25 cursor-not-allowed"
              : textureOriginal
                ? "border-sky-400/65 bg-sky-400/15 text-sky-200"
                : "border-bg-border/50 text-text-muted/60 hover:border-sky-400/40 hover:text-sky-200/80",
          ].join(" ")}
        >
          元画像維持
        </button>

        <button
          type="button"
          title="変更強度=2, 光沢感=標準, 立体感=標準 にリセット"
          onClick={handleReset}
          className="px-2 py-1 rounded-lg border border-bg-border/40 text-[12px] text-text-muted/70 hover:text-text-base/80 hover:border-bg-border/70 transition"
        >
          リセット
        </button>

        {/* インラインメモ */}
        {textureOriginal && !textureDisabled && (
          <span className="text-[13px] text-sky-300/80 leading-none">
            元画像の質感/立体感を維持
          </span>
        )}
        {textureDisabled && (
          <span className="text-[13px] text-text-muted/75 leading-none">
            質感/立体感はプロンプトに未反映
          </span>
        )}
      </div>

    </section>
  );
}

// ── ButtonRow ─────────────────────────────────────────────────────────────────

interface ButtonRowProps {
  label: string;
  value: number;
  labels: Record<number, string>;
  onChange: (v: number) => void;
}

function ButtonRow({ label, value, labels, onChange }: ButtonRowProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* ラベル列（固定幅で3行を揃える） */}
      <span className="text-[13px] text-text-muted/85 font-medium shrink-0 w-[3.25rem] leading-none">
        {label}
      </span>

      {/* ボタン5個（w-8 h-8 = 32px ≈ 1.33× large） */}
      <div className="flex items-center gap-1 shrink-0">
        {[1, 2, 3, 4, 5].map((n) => {
          const isActive = value === n;
          const idx = n - 1;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              title={labels[n]}
              className={[
                "w-8 h-8 rounded-md border text-[13px] font-bold transition leading-none select-none",
                isActive
                  ? ACTIVE_COLORS[idx]
                  : `border-[#252e44] bg-[#0f1015] text-text-muted/40 ${STEP_COLORS[idx]}`,
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* 現在値ラベル（スマホでも表示） */}
      <span className="text-[13px] font-semibold text-text-base leading-none shrink-0 min-w-[4.5rem]">
        {labels[value] ?? ""}
      </span>
    </div>
  );
}

// ── FixedChip ─────────────────────────────────────────────────────────────────

function FixedChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center text-[12px] font-medium px-2.5 py-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/10 text-emerald-200/85 select-none cursor-default whitespace-nowrap leading-none">
      {label}
    </span>
  );
}

// ── ProtectChip ───────────────────────────────────────────────────────────────

interface ProtectChipProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  warn?: boolean;
  warnTitle?: string;
  amber?: boolean;
}

function ProtectChip({
  label,
  value,
  onChange,
  warn = false,
  warnTitle = "",
  amber = false,
}: ProtectChipProps) {
  const onCls = amber
    ? "border-amber-400/55 bg-amber-400/12 text-amber-100/90 hover:border-amber-400/70"
    : "border-accent/55 bg-accent/12 text-text-base hover:border-accent/75";
  const offCls =
    "border-[#252e44] bg-transparent text-text-muted/45 hover:border-accent/35 hover:text-text-base";

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={warnTitle || (value ? `${label}：ON（クリックでOFF）` : `${label}：OFF（クリックでON）`)}
      className={[
        "inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-lg border transition select-none whitespace-nowrap leading-none",
        value ? onCls : offCls,
      ].join(" ")}
    >
      {label}
      {warn && (
        <span className="text-amber-400/80 text-[11px] leading-none">⚠</span>
      )}
    </button>
  );
}
