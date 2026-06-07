/**
 * 変更の強さ / 守るもの — コンパクト統合カード
 *
 * ┌─────────────────────────────────────────┐
 * │ 変更強度   [1][2][3][4][5]  やや控えめ          │
 * │ 光沢感     [1][2][3][4][5]  標準                │
 * │ 🎨 リアル度 [1][2][3][4][5]  2.5D                │
 * │  ▾ 質感タイプ：[なし][アニメ背景][写真リアル]…  │
 * ├─────────────────────────────────────────┤
 * │ 守るもの                                │
 * │ [🔒顔/同一性][体型/ポーズ][色味][構図][量産回避] │
 * ├─────────────────────────────────────────┤
 * │ [☑質感/立体感を反映] [元画像維持] [リセット] │
 * └─────────────────────────────────────────┘
 *
 * 立体感ボタン (dimensionLevel) は分かりにくいので廃止。代わりに「質感・リアル度」を露出。
 * これは「背景だけリアルすぎる問題」を防ぐためのもので、scope に応じて
 *   背景／衣装／カメラ／ライティング
 * のプロンプトに反映される。
 */

import { useState } from "react";
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

/**
 * 質感・リアル度（1=完全2D ↔ 5=写真リアル）。
 * 人物と背景の質感統一が目的なので、ユーザーには「ラベル」だけ見せる。
 * 旧 DIM_LABELS（立体感 2D↔3D）は廃止。代わりにこちらを露出する。
 */
const REALISM_LABELS: Record<number, string> = {
  1: "イラスト",
  2: "デジタルペイント",
  3: "2.5D",
  4: "リアル寄り",
  5: "写真リアル",
};

const REALISM_HINTS: Record<number, string> = {
  1: "背景もアニメ背景・セル画・絵画的に。実写は使わない",
  2: "背景はデジタルペイント／ゲーム背景／コンセプトアート風",
  3: "人物と背景を2.5Dで統一（既定）",
  4: "背景は実写寄りだが人物と馴染ませる",
  5: "背景は写真のような実写質感を許可",
};

/** 質感タイプ（折りたたみ）。null=未指定 */
export const REALISM_TYPES: { id: string; jp: string; emoji: string }[] = [
  { id: "anime_bg",       jp: "アニメ背景",      emoji: "🎴" },
  { id: "digital_paint",  jp: "デジタルペイント", emoji: "🖌" },
  { id: "oil_paint",      jp: "油絵",           emoji: "🎨" },
  { id: "watercolor",     jp: "水彩",           emoji: "💧" },
  { id: "cel",            jp: "セル画",         emoji: "📺" },
  { id: "manga_bg",       jp: "漫画背景",       emoji: "📖" },
  { id: "game_bg",        jp: "ゲーム背景",     emoji: "🎮" },
  { id: "concept_art",    jp: "コンセプトアート", emoji: "🖼" },
  { id: "photo_real",     jp: "写真リアル",     emoji: "📷" },
  { id: "movie_bg",       jp: "映画背景",       emoji: "🎬" },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  strength: number;
  glossLevel: number;
  /** 質感・リアル度（1〜5、既定3）。dimensionLevel は廃止し、こちらに統一。 */
  realismLevel: number;
  /** 質感タイプ（"anime_bg" 等）。null = 指定なし */
  realismType: string | null;
  textureOriginal: boolean;
  textureDisabled: boolean;
  onStrengthChange: (v: number) => void;
  onGlossChange: (v: number) => void;
  /** リアル度の変更 */
  onRealismLevelChange: (v: number) => void;
  /** 質感タイプの変更（null=指定なし） */
  onRealismTypeChange: (v: string | null) => void;
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
  realismLevel,
  realismType,
  textureOriginal,
  textureDisabled,
  onStrengthChange,
  onGlossChange,
  onRealismLevelChange,
  onRealismTypeChange,
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
  const [typeOpen, setTypeOpen] = useState(false);

  function handleReset() {
    onStrengthChange(2);
    onGlossChange(3);
    onRealismLevelChange(3);
    onRealismTypeChange(null);
    onTextureOriginalChange(false);
    onTextureDisabledChange(false);
  }

  return (
    <section className="card !p-2">

      {/* ── 変更強度 / 光沢感 / 質感・リアル度 ────────────────── */}
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
            label="🎨 リアル度"
            value={realismLevel}
            labels={REALISM_LABELS}
            onChange={onRealismLevelChange}
          />
          {/* リアル度の補足ヒント */}
          <p className="text-[11px] text-text-muted/55 pl-[3.6rem] leading-snug">
            {REALISM_HINTS[realismLevel] ?? ""}
            {realismType && (
              <span className="ml-2 text-violet-300/80">
                ・タイプ：{REALISM_TYPES.find((t) => t.id === realismType)?.jp}
              </span>
            )}
          </p>
          {/* 質感タイプ：折りたたみ */}
          <div className="pl-[3.6rem]">
            <button
              type="button"
              onClick={() => setTypeOpen((v) => !v)}
              className="text-[11px] text-text-muted/60 hover:text-text-base leading-none px-1 py-0.5 rounded transition"
            >
              {typeOpen ? "▾" : "▸"} 質感タイプ（任意）
              {realismType && <span className="ml-1 text-violet-300/80">●</span>}
            </button>
            {typeOpen && (
              <div className="mt-1 flex flex-wrap gap-1">
                <TypeChip
                  label="なし"
                  active={realismType === null}
                  onClick={() => onRealismTypeChange(null)}
                />
                {REALISM_TYPES.map((t) => (
                  <TypeChip
                    key={t.id}
                    label={`${t.emoji} ${t.jp}`}
                    active={realismType === t.id}
                    onClick={() => onRealismTypeChange(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
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
            label="テンプレ回避"
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

// ── TypeChip（質感タイプ折りたたみ用） ────────────────────────────────────────

function TypeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-[11px] font-medium px-1.5 py-0.5 rounded border leading-none transition select-none whitespace-nowrap",
        active
          ? "border-violet-400/65 bg-violet-500/18 text-violet-100"
          : "border-bg-border/45 bg-transparent text-text-muted/55 hover:border-violet-400/40 hover:text-text-base",
      ].join(" ")}
    >
      {label}
    </button>
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
