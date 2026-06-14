/**
 * ControlPanel.tsx — 統合コントロールパネル
 *
 * 変更範囲 / 変更強度 / 光沢感 / 立体感 / 守るもの を
 * 1 枚のコンパクトカードに統合する。
 * ※ 案数はフローティングバー（App.tsx）に移動済み。
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │ 変更範囲                                                  │
 * │ [背景][前景][ポーズ][髪][衣装][コスプレ][機械化][カメラ]  │
 * │ [小物][🚗乗り物][🐉神話][ライティング]                    │
 * ├──────────────────────────────────────────────────────────┤
 * │ 変更強度 [1][2][3][4][5]  標準                           │
 * │ 光沢感   [1][2][3][4][5]  標準                           │
 * │ 立体感   [1][2][3][4][5]  2.5D                           │
 * ├──────────────────────────────────────────────────────────┤
 * │ 守るもの [🔒顔/同一性][体型][色味][構図][量産回避]         │
 * │ ☑質感反映  [元画像維持]  [リセット]                       │
 * └──────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Expression, Scope } from "../types";

// ── Scope options ──────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: { id: Scope; label: string; hint: string }[] = [
  { id: "background",   label: "背景",       hint: "環境のみ再構築" },
  { id: "foreground",   label: "前景演出",   hint: "人物の手前に重なる演出・エフェクト" },
  { id: "pose",         label: "ポーズ",     hint: "姿勢・手足のみ変更" },
  { id: "hair",         label: "髪",         hint: "髪型・髪色のみ" },
  { id: "outfit",       label: "衣装",       hint: "服飾のみ" },
  { id: "cosplay",      label: "コスプレ",   hint: "コスプレ衣装・小物・スタイル" },
  { id: "cyber",        label: "🦾 メカ",    hint: "体の一部をSF的にメカ化・デジタル化" },
  { id: "camera",       label: "カメラ",     hint: "視点・構図のみ変更" },
  { id: "props",        label: "持ち物",     hint: "刀・小物・SNS映えアイテム追加" },
  { id: "big_object",   label: "🧸 大物",    hint: "人物より大きい大道具・巨大オブジェ・大型アート作品を配置" },
  { id: "vehicle",      label: "🚗 乗り物",  hint: "乗り物・背景の乗り物を追加。人物が主役で乗り物は脇役" },
  { id: "myth",         label: "🐉 神話",    hint: "神話・幻獣を画面に追加。神獣・龍・精霊等を配置" },
  { id: "lighting",     label: "ライティング", hint: "光・影・色温度のみ変更" },
];

// 衣装系グループ（衣装＝主役 / コスプレ・機械化＝派生）。変更対象ボタンの視覚グループ化に使用。
const OUTFIT_GROUP: Scope[] = ["outfit", "cosplay", "cyber"];
const OUTFIT_GROUP_BEFORE: Scope[] = ["background", "foreground", "pose", "hair"];
const OUTFIT_GROUP_AFTER: Scope[] = ["camera", "props", "big_object", "vehicle", "myth", "lighting"];

// ── Button colors (1→sky, 2→teal, 3→accent, 4→orange, 5→rose) ────────────────

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

// ── Label maps ────────────────────────────────────────────────────────────────

const STRENGTH_LABELS: Record<number, string> = {
  1: "控えめ", 2: "やや控えめ", 3: "標準", 4: "大きめ変更", 5: "大胆変更",
};
const GLOSS_LABELS: Record<number, string> = {
  1: "マット", 2: "控えめ", 3: "標準", 4: "光沢強め", 5: "高光沢",
};
const REALISM_LABELS: Record<number, string> = {
  1: "イラスト", 2: "デジタルペイント", 3: "2.5D", 4: "リアル寄り", 5: "写真リアル",
};
const REALISM_HINT: Record<number, string> = {
  1: "背景もアニメ/絵画的に",
  2: "デジタルペイント/コンセプトアート風",
  3: "人物と背景を2.5Dで統一",
  4: "実写寄りだが人物と馴染ませる",
  5: "実写写真風の背景を許可",
};

const REALISM_TYPES_BRIEF: { id: string; jp: string; emoji: string }[] = [
  { id: "anime_bg",      jp: "アニメ背景",     emoji: "🎴" },
  { id: "digital_paint", jp: "デジタルペイント", emoji: "🖌" },
  { id: "oil_paint",     jp: "油絵",          emoji: "🎨" },
  { id: "watercolor",    jp: "水彩",          emoji: "💧" },
  { id: "cel",           jp: "セル画",        emoji: "📺" },
  { id: "manga_bg",      jp: "漫画背景",      emoji: "📖" },
  { id: "game_bg",       jp: "ゲーム背景",    emoji: "🎮" },
  { id: "concept_art",   jp: "コンセプトアート", emoji: "🖼" },
  { id: "photo_real",    jp: "写真リアル",    emoji: "📷" },
  { id: "movie_bg",      jp: "映画背景",      emoji: "🎬" },
];

// ── Expression options ────────────────────────────────────────────────────────

const EXPRESSION_OPTIONS: { value: Expression; label: string }[] = [
  { value: "neutral",      label: "無表情"  },
  { value: "smile",        label: "微笑み"  },
  { value: "cold",         label: "冷たい"  },
  { value: "assertive",    label: "強気"    },
  { value: "sad",          label: "悲しげ"  },
  { value: "sleepy",       label: "眠そう"  },
  { value: "elegant",      label: "上品"    },
  { value: "cool",         label: "クール"  },
  { value: "ephemeral",    label: "儚い"    },
  { value: "intimidating", label: "威圧感"  },
];

// ── Shared scope/count chip styles ────────────────────────────────────────────

// 選択中はラベル前に ✓ を付け、accent 色のリング＋強いグローで判別性を最大化
const CHIP_ACTIVE   = "border-accent bg-accent/22 text-white shadow-[0_0_0_2px_rgba(124,92,255,0.55),0_0_14px_-2px_rgba(124,92,255,0.55)] ring-1 ring-accent/45";
const CHIP_INACTIVE = "border-[#252e44] bg-[#0f1015] text-text-muted/85 hover:text-text-base hover:border-accent/40";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  // 変更範囲
  scopes: Scope[];
  onScopesChange: (v: Scope[]) => void;
  /** 変更対象（scopes）だけリセット */
  onScopesReset: () => void;
  /** 変更範囲＋ブースト＋お気に入り＋ZOZO まですべてリセット（守るものは維持） */
  onResetAll: () => void;
  /** 「生成ブースト」セクションの中身（お気に入り傾向・ZOZO 等。App から BoostControls を渡す） */
  boostArea?: ReactNode;
  /** プリセット押下時にインクリメント → スコープボタンをフラッシュ */
  scopeFlashKey?: number;
  // 変更強度 / 光沢感 / 質感・リアル度
  strength: number;
  glossLevel: number;
  /** 質感・リアル度（1=完全2D ↔ 5=写真リアル）。dimensionLevel は廃止。 */
  realismLevel: number;
  /** 質感タイプ（"anime_bg" 等、null=指定なし） */
  realismType: string | null;
  textureOriginal: boolean;
  textureDisabled: boolean;
  onStrengthChange: (v: number) => void;
  onGlossChange: (v: number) => void;
  onRealismLevelChange: (v: number) => void;
  onRealismTypeChange: (v: string | null) => void;
  onTextureOriginalChange: (v: boolean) => void;
  onTextureDisabledChange: (v: boolean) => void;
  // 守るもの — 顔/同一性
  faceLock: boolean;
  expression: Expression | null;
  onFaceLockChange: (v: boolean) => void;
  onExpressionChange: (v: Expression | null) => void;
  // 守るもの — その他（量産回避は生成補助へ移動したのでここには無い）
  bodyPoseLock: boolean;
  colorMoodLock: boolean;
  compositionLock: boolean;
  onBodyPoseLockChange: (v: boolean) => void;
  onColorMoodLockChange: (v: boolean) => void;
  onCompositionLockChange: (v: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ControlPanel({
  scopes, onScopesChange,
  onScopesReset, onResetAll,
  boostArea,
  scopeFlashKey = 0,
  strength, glossLevel, realismLevel, realismType,
  textureOriginal, textureDisabled,
  onStrengthChange, onGlossChange, onRealismLevelChange, onRealismTypeChange,
  onTextureOriginalChange, onTextureDisabledChange,
  faceLock, expression, onFaceLockChange, onExpressionChange,
  bodyPoseLock, colorMoodLock, compositionLock,
  onBodyPoseLockChange, onColorMoodLockChange, onCompositionLockChange,
}: Props) {
  const poseConflict    = scopes.includes("pose");
  const compConflict    = scopes.includes("camera") || scopes.includes("aspect_ratio");
  const glossDimDisabled = textureDisabled || textureOriginal;

  // 詳細設定（強度・質感）の折りたたみ
  const [detailOpen, setDetailOpen] = useState(false);

  // ── スコープフラッシュアニメーション ──────────────────────────────────────────
  const prevScopesRef = useRef<Scope[]>(scopes);
  const [flashScopes, setFlashScopes] = useState<ReadonlySet<string>>(new Set());

  // scopeFlashKey が変わったとき（プリセット押下時）に新規 ON になったスコープを光らせる
  useEffect(() => {
    if (scopeFlashKey === 0) return;
    const prev = new Set(prevScopesRef.current);
    const newlyActive = scopes.filter((s) => !prev.has(s));
    if (newlyActive.length > 0) {
      setFlashScopes(new Set(newlyActive));
      const timer = setTimeout(() => setFlashScopes(new Set()), 550);
      return () => clearTimeout(timer);
    }
  // scopeFlashKey の変化のみを起点にする（scopes は ref 経由で参照）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeFlashKey]);

  // prevScopesRef を scopes の最新値に追随させる
  useEffect(() => {
    prevScopesRef.current = scopes;
  }, [scopes]);

  function handleReset() {
    onStrengthChange(2);
    onGlossChange(3);
    onRealismLevelChange(3);
    onRealismTypeChange(null);
    onTextureOriginalChange(false);
    onTextureDisabledChange(false);
  }

  const toggleScope = (id: Scope) => {
    if (scopes.includes(id)) {
      // コスプレを外しても衣装は自動で外さない（衣装単独で使いたい場合があるため）
      onScopesChange(scopes.filter((v) => v !== id));
    } else {
      // コスプレは衣装の派生：ONにしたら衣装scopeも自動ON（タグはコスプレで分離。
      // BUG-17 で cosplay は衣装変更として扱う＝整合的）。
      const add: Scope[] = id === "cosplay" && !scopes.includes("outfit") ? [id, "outfit"] : [id];
      onScopesChange([...scopes, ...add]);
    }
  };

  // 衣装系（衣装＝主役 / コスプレ・機械化＝派生）を視覚的にまとめるためのグループ分け
  const renderScopeBtn = (opt: { id: Scope; label: string; hint: string }) => {
    const active   = scopes.includes(opt.id);
    const flashing = flashScopes.has(opt.id);
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() => toggleScope(opt.id)}
        title={opt.hint}
        aria-pressed={active}
        className={[
          "px-3.5 py-1.5 text-[13px] rounded-lg border font-semibold leading-none transition select-none inline-flex items-center gap-1",
          active ? CHIP_ACTIVE : CHIP_INACTIVE,
          flashing ? "scope-flash" : "",
        ].join(" ")}
      >
        {active && (
          <span className="text-[11px] leading-none text-accent/95" aria-hidden>✓</span>
        )}
        {opt.label}
      </button>
    );
  };

  return (
    <section className="card !p-2 space-y-1">

      {/* ══════ A. 変更対象（唯一のソース：上段ボタン） ══════ */}
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[13px] font-semibold uppercase tracking-widest text-violet-200/90 select-none leading-none">
            変更対象
            {scopes.length > 0 && (
              <span className="ml-1.5 text-violet-100/90 font-bold normal-case tracking-normal">
                （{scopes.length}件）
              </span>
            )}
          </span>
          {scopes.length > 0 && (
            <span className="ml-auto shrink-0 flex items-center gap-1.5">
              <button
                type="button"
                onClick={onScopesReset}
                title="「変更対象」だけを解除する"
                className="px-2.5 py-0.5 rounded border border-violet-400/30 bg-violet-400/8 text-violet-200/85 text-[12px] font-semibold hover:bg-violet-400/18 hover:border-violet-400/55 transition leading-snug"
              >
                ↺ 変更だけ
              </button>
              <button
                type="button"
                onClick={onResetAll}
                title="変更範囲・生成ブースト・お気に入り傾向・ZOZOをすべて解除（守るものは維持）"
                className="px-2.5 py-0.5 rounded border border-rose-400/30 bg-rose-400/8 text-rose-200/85 text-[12px] font-semibold hover:bg-rose-500/18 hover:border-rose-500/55 hover:text-rose-200 transition leading-snug"
              >
                ↺ 選択解除
              </button>
            </span>
          )}
        </div>
        <p className="text-[10px] text-text-desc leading-snug mb-1 -mt-0.5">何を変えるかを選ぶ（例：衣装・背景・髪・小物）。細かい指定は下の「詳細設定」、その軸をおまかせで引くなら「神引き」</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 衣装より前の軸 */}
          {SCOPE_OPTIONS.filter((o) => OUTFIT_GROUP_BEFORE.includes(o.id)).map(renderScopeBtn)}
          {/* 衣装系グループ：衣装＝主役 / コスプレ・機械化＝派生（視覚的に1つにまとめる） */}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/25 bg-violet-400/5 px-1.5 py-1">
            <span className="text-[10px] font-bold text-violet-200/70 leading-none select-none px-0.5">衣装系</span>
            {SCOPE_OPTIONS.filter((o) => OUTFIT_GROUP.includes(o.id)).map(renderScopeBtn)}
          </span>
          {/* 衣装系より後の軸 */}
          {SCOPE_OPTIONS.filter((o) => OUTFIT_GROUP_AFTER.includes(o.id)).map(renderScopeBtn)}
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────── */}
      <div className="border-t border-bg-border/25" />

      {/* ══════ B. 守るもの ══════ */}
      <div className="space-y-1">

        {/* 守るもの — 1行目 */}
        <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
          <span className="text-[13px] font-semibold uppercase tracking-widest text-emerald-200/90 select-none shrink-0 leading-none">
            守るもの
          </span>

          {/* ── 顔/同一性 固定ボタン（大きめ） ── */}
          {faceLock ? (
            /* 固定ON 状態 */
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold px-3 py-1 rounded-lg border border-emerald-400/55 bg-emerald-400/12 text-emerald-200/95 select-none whitespace-nowrap leading-none shadow-[0_0_8px_rgba(52,211,153,0.15)]">
                🔒 顔/同一性 固定ON
              </span>
              <button
                type="button"
                onClick={() => onFaceLockChange(false)}
                className="text-[13px] text-text-muted/85 hover:text-amber-300/90 transition leading-none whitespace-nowrap underline underline-offset-2 decoration-dotted"
                title="表情変更モードに切り替える（顔の造形は維持）"
              >
                解除して表情を選ぶ
              </button>
            </div>
          ) : (
            /* 解除中 状態 */
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold px-3 py-1 rounded-lg border border-amber-400/50 bg-amber-400/10 text-amber-200/90 select-none whitespace-nowrap leading-none">
              🔓 顔/同一性 解除中
              {expression && (
                <span className="ml-1 text-[12px] font-normal text-amber-300/90">
                  ({EXPRESSION_OPTIONS.find(o => o.value === expression)?.label})
                </span>
              )}
            </span>
          )}

          {/* 他の守るものチップ */}
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
          {/* 「量産回避」は生成補助（回避系）へ移動。守るものは純粋なロックのみに整理。 */}
        </div>

        {/* ── 表情エリア（解除時のみ表示） ── */}
        {!faceLock && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2 space-y-1.5">
            {/* 表情ヘッダ行 */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-amber-200/95 font-semibold leading-none select-none">
                表情
              </span>
              {expression && (
                <button
                  type="button"
                  onClick={() => onExpressionChange(null)}
                  className="text-[13px] text-text-muted/80 hover:text-text-muted/95 transition leading-none"
                >
                  選択解除
                </button>
              )}
              <button
                type="button"
                onClick={() => { onFaceLockChange(true); onExpressionChange(null); }}
                className="ml-auto text-[13px] font-semibold text-emerald-300/90 hover:text-emerald-100 transition leading-none whitespace-nowrap"
                title="顔/同一性ロックをONに戻す"
              >
                🔒 顔を再固定する
              </button>
            </div>

            {/* 表情チップ */}
            <div className="flex flex-wrap gap-1">
              {EXPRESSION_OPTIONS.map((opt) => {
                const active = expression === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onExpressionChange(active ? null : opt.value)}
                    className={[
                      "text-[12px] font-semibold px-2 py-0.5 rounded border transition leading-none whitespace-nowrap",
                      active
                        ? "border-amber-400/65 bg-amber-400/20 text-amber-100 shadow-[0_0_6px_rgba(245,158,11,0.25)]"
                        : "border-[#2a2e3a] bg-transparent text-text-muted/80 hover:border-amber-400/35 hover:text-amber-200/90",
                    ].join(" ")}
                  >
                    {active && <span className="mr-0.5 text-[11px]">✓</span>}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <p className="text-[13px] text-text-desc leading-relaxed">
              顔の造形・同一性は維持。表情ニュアンスのみ変更します。
            </p>
          </div>
        )}

      </div>

      {/* ══════ C. 生成ブースト ══════ */}
      {boostArea && (
        <>
          <div className="border-t border-bg-border/25" />
          <div>
            <span className="text-[13px] font-semibold uppercase tracking-widest text-amber-200/90 select-none leading-none block mb-1">
              生成ブースト
            </span>
            {boostArea}
          </div>
        </>
      )}

      {/* ── Divider ─────────────────────────────────────────── */}
      <div className="border-t border-bg-border/25" />

      {/* ══════ D. 詳細設定（折りたたみ：強度・質感）══════ */}
      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-widest text-slate-300/80 hover:text-slate-100 transition leading-none"
      >
        <span className="text-[10px]">{detailOpen ? "▲" : "▼"}</span>
        詳細設定（強度・質感）
      </button>

      {detailOpen && (
        <div className="space-y-2 pt-1">
          {/* 変更強度 / 光沢感 / 立体感 */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <ButtonRow label="変更強度" value={strength} labels={STRENGTH_LABELS} onChange={onStrengthChange} />
            <div className={[
              "flex flex-wrap items-center gap-x-5 gap-y-1.5 transition-opacity duration-150",
              glossDimDisabled ? "opacity-30 pointer-events-none" : "",
            ].join(" ")}>
              <ButtonRow label="光沢感" value={glossLevel} labels={GLOSS_LABELS} onChange={onGlossChange} />
              <ButtonRow label="🎨 リアル度" value={realismLevel} labels={REALISM_LABELS} onChange={onRealismLevelChange} />
            </div>
          </div>
          {/* リアル度ヒント + 質感タイプ折りたたみ */}
          <div className={glossDimDisabled ? "opacity-30 pointer-events-none" : ""}>
            <p className="text-[11px] text-text-desc leading-snug">
              💡 {REALISM_HINT[realismLevel]}
              {realismType && (
                <span className="ml-2 text-violet-300/80">
                  ・タイプ：{REALISM_TYPES_BRIEF.find((t) => t.id === realismType)?.jp}
                </span>
              )}
            </p>
            <details className="mt-0.5">
              <summary className="text-[11px] text-text-desc hover:text-text-base cursor-pointer leading-none inline-block py-0.5">
                ▸ 質感タイプ（任意）{realismType && <span className="ml-1 text-violet-300/80">●</span>}
              </summary>
              <div className="flex flex-wrap gap-1 mt-1 pl-1">
                <button
                  type="button"
                  onClick={() => onRealismTypeChange(null)}
                  className={[
                    "text-[11px] font-medium px-1.5 py-0.5 rounded border leading-none transition",
                    realismType === null
                      ? "border-violet-400/65 bg-violet-500/18 text-violet-100"
                      : "border-bg-border/45 text-text-muted/55 hover:border-violet-400/40 hover:text-text-base",
                  ].join(" ")}
                >
                  なし
                </button>
                {REALISM_TYPES_BRIEF.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onRealismTypeChange(t.id)}
                    className={[
                      "text-[11px] font-medium px-1.5 py-0.5 rounded border leading-none transition whitespace-nowrap",
                      realismType === t.id
                        ? "border-violet-400/65 bg-violet-500/18 text-violet-100"
                        : "border-bg-border/45 text-text-muted/55 hover:border-violet-400/40 hover:text-text-base",
                    ].join(" ")}
                  >
                    {t.emoji} {t.jp}
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* 質感反映 / 元画像維持 / リセット */}
          <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!textureDisabled}
            onChange={(e) => onTextureDisabledChange(!e.target.checked)}
            className="w-3 h-3 accent-violet-500 cursor-pointer"
          />
          <span className={[
            "text-[13px] transition",
            textureDisabled ? "text-text-muted/60" : "text-white/80",
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
            "px-2 py-0.5 rounded border text-[13px] font-semibold transition",
            textureDisabled
              ? "border-bg-border/25 text-text-muted/25 cursor-not-allowed"
              : textureOriginal
                ? "border-sky-400/65 bg-sky-400/15 text-sky-200"
                : "border-bg-border/50 text-white/70 hover:border-sky-400/40 hover:text-sky-200/80",
          ].join(" ")}
        >
          元画像維持
        </button>

        <button
          type="button"
          title="変更強度=2, 光沢感=標準, 立体感=標準 にリセット"
          onClick={handleReset}
          className="px-2 py-0.5 rounded border border-bg-border/40 text-[12px] text-white/65 hover:text-white hover:border-bg-border/70 transition"
        >
          リセット
        </button>

        {textureOriginal && !textureDisabled && (
          <span className="text-[13px] text-sky-300/90 leading-none">
            元画像の質感/立体感を維持
          </span>
        )}
        {textureDisabled && (
          <span className="text-[13px] text-text-desc leading-none">
            質感/立体感はプロンプトに未反映
          </span>
        )}
          </div>
        </div>
      )}

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
    <div className="flex items-center gap-2 shrink-0">
      {/* ラベル */}
      <span className="text-[13px] text-text-muted/90 font-semibold shrink-0 w-[3.5rem] leading-none">
        {label}
      </span>
      {/* ボタン 5 個 */}
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
                  : `border-[#252e44] bg-[#0f1015] text-white/55 ${STEP_COLORS[idx]}`,
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>
      {/* 現在値（コンパクト表示） */}
      <span className="text-[13px] font-semibold text-text-base leading-none shrink-0">
        {labels[value] ?? ""}
      </span>
    </div>
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
  label, value, onChange,
  warn = false, warnTitle = "", amber = false,
}: ProtectChipProps) {
  const onCls = amber
    ? "border-amber-400/55 bg-amber-400/12 text-amber-100/90 hover:border-amber-400/70"
    : "border-accent/55 bg-accent/12 text-text-base hover:border-accent/75";
  const offCls =
    "border-[#252e44] bg-transparent text-white/65 hover:border-accent/35 hover:text-text-base";

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={warnTitle || (value ? `${label}：ON（クリックでOFF）` : `${label}：OFF（クリックでON）`)}
      className={[
        "inline-flex items-center gap-1 text-[12px] font-medium px-2 py-[3px] rounded border transition select-none whitespace-nowrap leading-none",
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
