/**
 * DuplicateAnalysisPanel — 重複分析センター（ユーザー判断型）
 *
 * 設計方針：分析は自動、反映はユーザー判断。
 *
 * - AIコメント / 頻出ランキング / 未開拓ジャンル / 類似履歴 / 傾向レーダー を表示
 * - 各モチーフ行に 3-state ボタン（禁止 / 警戒 / 許可）。クリック＝ポリシー保存のみ
 * - 「提案を反映」ボタンを押した時のみ、生成ロジック（ngList / extraInstructions）へ反映される
 * - 重複リセット / ジャンル分散 / 提案を反映 の3アクション
 */

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BiasAnalysisResult } from "../lib/biasAnalyzer";
import { biasRiskLabel, biasRiskTextClass, biasRiskBorderClass } from "../lib/biasAnalyzer";
import type {
  FullHistoryAnalysis, MotifCount, RadarEntry, UntappedGenre,
} from "../lib/historyAnalyzer";
import { starsLabel } from "../lib/historyAnalyzer";
import type { MotifLevel, LevelMap, ComboPolicy, ComboPolicyMap } from "../lib/motifPolicy";
import { getLevel, levelMeta, LEVEL_META, countLevels, getComboPolicy, countComboPolicies } from "../lib/motifPolicy";
import type { MotifCombo } from "../lib/historyAnalyzer";
import type { AgentAnalysis, AgentActionId } from "../lib/aiAgent";
import type { ImageAnalysisResult } from "../lib/imageAnalyzer";
import type { RatingAnalysis, RatingTrends, RatingPeriodKey, SuccessRankings, ElementRankEntry, ComboRankEntry, CaseRankEntry } from "../lib/ratingAnalyzer";
import { type PreferenceProfile } from "../lib/preferenceProfile";
import type { ColorAnalysis, ColorAxis, ColorSuccessAnalysis } from "../lib/colorAnalyzer";
import type { CandidateMotif } from "../lib/discoveryMotifs";
import { COLOR_GROUPS, COLOR_AXES } from "../lib/colorAnalyzer";
import type { ColorWeight, ColorWeightMap, ColorAxisCtrl } from "../lib/colorPolicy";
import { WEIGHT_META, COLOR_AXIS_CTRL, getColorEntry, countWeights } from "../lib/colorPolicy";
import { MonthlyCalendarSection } from "./MonthlyCalendarSection";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  biasResult:        BiasAnalysisResult | null;
  historyAnalysis:   FullHistoryAnalysis | null;
  isAnalyzing?:      boolean;

  /** モチーフ出現制御レベル（保存済み） */
  levels:            LevelMap;
  /** 反映状態（生成ロジックに効いているか） */
  policyApplied:     boolean;

  // ── アクションハンドラ ──
  onLevelChange:     (motifId: string, level: MotifLevel) => void;
  onApplyPolicies:   () => void;
  onUnapplyPolicies: () => void;
  onResetPolicies:   () => void;
  /** 一括操作（上位N件を指定レベルに） */
  onBulkLevel:       (motifIds: string[], level: MotifLevel) => void;
  /** 完全NG(0)のみ解除 */
  onClearNg:         () => void;
  /** 重複を自動調整（preserveManual: true=手動設定を保護） */
  onAutoAdjust:      (preserveManual: boolean) => void;
  /** 直前の自動調整を元に戻す */
  onUndoAutoAdjust:  () => void;
  /** 元に戻せるか */
  canUndoAuto:       boolean;
  /** 直近で自動調整された motifId（行ハイライト用） */
  changedIds:        ReadonlySet<string>;

  // ── 頻出構成（コンボ）制御 ──
  /** コンボポリシー（comboKey → block/alt/allow） */
  comboPolicies:     ComboPolicyMap;
  /** コンボごとのポリシー変更ハンドラ */
  onComboPolicyChange: (comboKey: string, policy: ComboPolicy) => void;
  /** 🔎 AIっぽさ（量産パターン）を再チェック（分析センター内で実行・生成は変えない）。任意。 */
  onRunBiasCheck?: () => void;

  // ── 🎨 色分析（生成制御センター） ──
  /** 色分析結果（履歴×ウィンドウサイズで集計） */
  colorAnalysis:     ColorAnalysis | null;
  /** A2-3b: 色の成功率分析（色×評価×時系列）。任意。 */
  colorSuccess?:     ColorSuccessAnalysis | null;
  /** skyveil好みAI タブの中身（SkyveilBar 要素を slot で受け取る・生成影響操作は別系統）。任意。 */
  skyveilSlot?:      ReactNode;
  /** 🔭発見タブ：監視外の頻出新語候補（未開拓発見担当）。任意。 */
  candidates?:       CandidateMotif[];
  onIgnoreTerm?:     (term: string) => void;
  /** 色×軸の重み（髪/服/背景それぞれ 0-5） */
  colorWeights:      ColorWeightMap;
  /** 色×軸の重み変更ハンドラ */
  onColorWeightChange: (colorId: string, axis: ColorAxisCtrl, weight: ColorWeight) => void;
  /** 全色を既定に戻す */
  onColorWeightsReset: () => void;
  /** 自動調整（偏り減点・未使用加点） */
  onColorAutoAdjust:    (preserveManual: boolean) => void;
  /** 自動調整 Undo */
  onColorUndoAdjust:    () => void;
  /** Undo 可能か */
  canColorUndo:         boolean;
  /** 直近で自動調整された (colorId,axis) ペア（行ハイライト用） */
  colorChangedKeys:     ReadonlySet<string>;
  /** 分析対象ウィンドウ（直近何件） */
  colorWindowSize:   50 | 100;
  /** ウィンドウ切替 */
  onColorWindowSizeChange: (size: 50 | 100) => void;

  // ── 📸 画像分析 ──
  /** 画像分析結果 */
  imageAnalysis:        ImageAnalysisResult | null;
  /** タブを開いたときに発火：未解析サムネを段階的にハッシュ化 */
  onStartImageAnalysis: () => void;
  /** 進捗（未解析件数の解析中表示） */
  imageAnalyzeProgress: { done: number; total: number } | null;
  /** F4: 解析中にキャンセルボタンを押した時 */
  onCancelImageAnalysis?: () => void;

  // ── 💡 評価集計（軸別👍👎）。skyveil好みの分析・反映操作は SkyveilBar に一本化（M-3） ──
  /** 評価分析（軸別👍👎の集計を含む） */
  ratingAnalysis:       RatingAnalysis | null;
  /** 評価集計 強化（②）：期間別/軸別/カテゴリ別成功率/月別/推移（表示専用） */
  ratingTrends?:        RatingTrends | null;
  /** 成功/失敗ランキング（③）：構成/要素横断/案単位（表示専用） */
  successRankings?:     SuccessRankings | null;
  /** 実 Gemini 分析の結果プロファイル（誘導表示の「分析済み/未分析」判定にのみ使用） */
  preferenceProfile:    PreferenceProfile | null;
  /** サンプル可能件数（評価が1つでも付いている画像数） */
  profileSampleCount:   number;

  // ── 🤖 AI分析エージェント ──
  agent:             AgentAnalysis | null;
  onAgentAction:     (id: AgentActionId) => void;

  onAutoFix:         () => void;
  onReroll:          () => void;
  onResetBias:       () => void;
  onDismiss:         () => void;
  /** 全画面モーダル（分析センター）として表示するか。docs/32 A1。 */
  asModal?:          boolean;
  /** 全画面モーダルを閉じる（asModal 時の ✕ / Esc）。 */
  onCenterClose?:    () => void;

  // ── 📅 1ヶ月生成カレンダー（plan タブ・Phase1: 移設のみ／A案B案はPhase2）──
  /** 初期表示タブ（誘導導線から開いた時に指定。省略時 "dup"）。 */
  initialTab?:       "dup" | "discovery" | "agent" | "color" | "image" | "pref" | "rank" | "skyveil" | "plan";
  /** テーマで生成準備：ヒント文を追加指示へ追記するだけ（scope/固定/顔は触らない）。任意。 */
  onUseCalendarTheme?: (hint: string) => void;

  // ── 📊 分析対象サマリ（見出しの件数表示用） ──
  analysisStats?: {
    windowDays: number;
    totalItems: number;
    promptCount: number;
    imageAnalyzedCount: number;
    ratedCount: number;
  };
  /** 現在の変更対象スコープ（反映状況の「変更対象外」判定に使う） */
  activeScopes?:        string[];
  /** お気に入り傾向プロファイル（反映中表示用） */
  favoriteProfile?:     { traitPhrases: string[] } | null;
  /** お気に入り傾向が現在ONか */
  favoriteLearnEnabled?: boolean;
}

// ── 小コンポーネント ──────────────────────────────────────────────────────────

function SectionTitle({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-bold text-slate-300 uppercase tracking-wider px-1 pt-3 pb-1.5 flex items-center gap-1.5">
      {icon && <span className="not-italic text-[13px]">{icon}</span>}
      <span>{children}</span>
    </p>
  );
}

function Divider() {
  return <div className="border-t border-white/12 my-1.5" />;
}


/** バー長＝出現回数、バー色＝制御レベル（0赤〜5シアン） */
function MiniBar({ count, max, level }: { count: number; max: number; level: MotifLevel }) {
  const pct = max > 0 ? Math.max(6, Math.round((count / max) * 100)) : 0;
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-16 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
        <span className={["h-full rounded-full", levelMeta(level).bar].join(" ")} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[13px] text-white font-bold tabular-nums leading-none shrink-0">
        {count}<span className="text-[10px] text-slate-400 font-normal">回</span>
      </span>
    </span>
  );
}

/** 未開拓ジャンルのバー：色は緑〜シアン（高いほど推奨） */
function UntappedBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-emerald-400"
    : score >= 75 ? "bg-teal-400"
    : score >= 50 ? "bg-sky-400"
    : "bg-slate-500";
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-16 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
        <span className={["h-full rounded-full", color].join(" ")} style={{ width: `${score}%` }} />
      </span>
      <span className="text-[13px] text-emerald-300 font-bold tabular-nums leading-none shrink-0">
        {score}<span className="text-[10px] text-emerald-400/60 font-normal">%</span>
      </span>
    </span>
  );
}

function ActionBtn({ icon, label, onClick, cls, title }: {
  icon: string; label: string; onClick: () => void; cls: string; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={["inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition leading-none", cls].join(" ")}>
      {icon} {label}
    </button>
  );
}

/** 反映状況の1行（ラベル＋名前付きチップ群）。「現在生成に反映中」で使用。 */
function ReflectRow({ color, label, items }: {
  color: "rose" | "sky" | "emerald" | "amber"; label: string; items: string[];
}) {
  if (items.length === 0) return null;
  const chip: Record<string, string> = {
    rose:    "border-rose-400/40 bg-rose-400/10 text-rose-200/90",
    sky:     "border-sky-400/40 bg-sky-400/10 text-sky-200/90",
    emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200/90",
    amber:   "border-amber-400/40 bg-amber-400/10 text-amber-200/90",
  };
  const lbl: Record<string, string> = {
    rose: "text-rose-300/80", sky: "text-sky-300/80",
    emerald: "text-emerald-300/80", amber: "text-amber-300/80",
  };
  const shown = items.slice(0, 8);
  const extra = items.length - shown.length;
  return (
    <div className="flex items-start gap-1.5">
      <span className={["text-[10px] font-bold shrink-0 mt-0.5 leading-none", lbl[color]].join(" ")}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {shown.map((t, i) => (
          <span key={i} className={["text-[10px] px-1.5 py-0.5 rounded-full border leading-none", chip[color]].join(" ")}>{t}</span>
        ))}
        {extra > 0 && <span className="text-[10px] text-text-muted/45 leading-none mt-0.5">+{extra}</span>}
      </div>
    </div>
  );
}

/** 出現制御コントロール（一発NG + 0〜5 セグメント） */
function LevelControl({
  level, onChange,
}: {
  level: MotifLevel; onChange: (lv: MotifLevel) => void;
}) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      {/* 一発NG（再クリックで許可に解除） */}
      <button
        type="button"
        onClick={() => onChange(level === 0 ? 4 : 0)}
        title={level === 0 ? "完全NG中（クリックで解除）" : "一発NG（完全に使わない）"}
        className={[
          "text-[11px] font-bold px-1.5 py-1 rounded border leading-none transition",
          level === 0
            ? "border-rose-400 bg-rose-500/85 text-white shadow-[0_0_6px_rgba(244,63,94,0.45)]"
            : "border-rose-400/40 text-rose-300/75 hover:bg-rose-500/20 hover:text-rose-100 hover:border-rose-400/70",
        ].join(" ")}
      >
        NG
      </button>
      {/* 0〜5 セグメント */}
      <span className="flex rounded-md overflow-hidden border border-white/10">
        {LEVEL_META.map((m) => {
          const active = level === m.level;
          return (
            <button
              key={m.level}
              type="button"
              onClick={() => onChange(m.level)}
              title={`${m.level} ${m.full}`}
              className={[
                "text-[11px] font-bold w-6 py-1 leading-none transition",
                active
                  ? m.activeBtn
                  : "text-slate-400 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {m.level}
            </button>
          );
        })}
      </span>
    </span>
  );
}

// ── セクション：💡 評価集計（軸別👍👎）─────────────────────────
// skyveil好みの「分析・反映・自動学習・削除」は SkyveilBar に一本化（M-3）。
// このタブは画像評価の実数集計の表示に役割特化する。

function PreferenceReportSection({
  ratingAnalysis, ratingTrends, profile, profileSampleCount,
}: {
  ratingAnalysis: RatingAnalysis | null;
  ratingTrends: RatingTrends | null;
  /** 「分析済み/未分析」の誘導表示にのみ使用（操作は SkyveilBar へ） */
  profile: PreferenceProfile | null;
  profileSampleCount: number;
}) {
  const rep = ratingAnalysis?.preferenceReport;

  return (
    <div className="space-y-3 py-2">
      {/* skyveil好みAI への誘導（分析・反映・自動学習・削除は SkyveilBar に集約） */}
      <div className="rounded-lg border border-violet-400/30 bg-violet-500/8 px-2.5 py-2 space-y-1">
        <p className="text-[11px] text-violet-100/90 leading-snug">
          🧬 好み傾向の<span className="font-bold">分析・反映・自動学習・削除</span>は、生成画面の「あなたの好み（skyveil）」に集約しました（ここは確認用）。
        </p>
        <p className="text-[10px] text-slate-400 leading-snug">
          現在：{profile
            ? <span className="text-emerald-200">分析済み（{profile.sampleSize}件 / {new Date(profile.generatedAt).toLocaleDateString("ja-JP")}）</span>
            : <span className="text-slate-300">未分析</span>}
          {"　"}・ 評価サンプル {profileSampleCount} 件
        </p>
        <p className="text-[10px] text-slate-400/85 leading-snug">
          このタブは「画像評価（👍👎）の実数集計」を表示します。
        </p>
      </div>

      {/* 評価サンプル統計（実数値） */}
      {rep && rep.totalAxisRatings > 0 ? (
        <div className="rounded-lg border border-white/12 bg-white/3 px-2.5 py-2 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-slate-200">
              📊 評価サンプル統計（実数値）
            </span>
            <span className="ml-auto text-[10px] text-slate-400">
              合計 {rep.totalAxisRatings} 件（背景/衣装/ポーズの 👍👎）
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-slate-400 px-1 leading-snug">
          💡 まだ評価データがありません。各案カードで生成結果画像を登録し、
          評価ボタン（👍/😐/👎/💀 と 背景/衣装/ポーズ × 👍👎）を付けると、ここに集計されます。
        </p>
      )}

      {/* 軸別の好評/不評率（数値のみ・嘘なし） */}
      {rep && rep.totalAxisRatings > 0 && (
        <div>
          <SectionTitle icon="📊">軸別の評価集計</SectionTitle>
          <div className="space-y-1.5 px-1">
            {rep.axes.map((a) => (
              <AxisPrefRow key={a.axis} stat={a} />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 px-1 pt-1 leading-snug">
            ※ これは画像評価ボタンの集計結果（実数値）です。傾向の分析・反映は生成画面の「あなたの好み（skyveil）」で行えます。
          </p>
        </div>
      )}

      {/* ②評価集計 強化：期間別 / 推移 / 軸別👍👎 / カテゴリ別成功率 / 月別 */}
      {ratingTrends && <RatingTrendsSection trends={ratingTrends} />}

      <p className="text-[10px] text-slate-400 px-1 leading-snug border-t border-white/5 pt-2">
        ※ 評価は画像単位で IndexedDB に保存されます。再クリックで評価を変えられます。
      </p>
    </div>
  );
}

// ── セクション：⭐ 評価集計 強化（②）期間別/推移/軸別/カテゴリ別成功率/月別 ──

const RT_PERIOD_TABS: { key: RatingPeriodKey; label: string }[] = [
  { key: "d7", label: "7日" },
  { key: "d30", label: "30日" },
  { key: "d90", label: "90日" },
  { key: "all", label: "全期間" },
];

/** 成功率の横棒（緑）＋数値。大型・全幅。 */
function RateBar({ rate, good, bad, height = "h-3" }: { rate: number; good: number; bad: number; height?: string }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} rounded-full bg-white/8 overflow-hidden`}>
        <div className="h-full bg-emerald-400/75 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-slate-300 tabular-nums w-[88px] text-right shrink-0">
        {pct}% <span className="text-emerald-200/70">{good}</span><span className="text-slate-500">/</span><span className="text-rose-200/70">{bad}</span>
      </span>
    </div>
  );
}

function DeltaPill({ delta, unit = "" }: { delta: number; unit?: string }) {
  const up = delta > 0.0001, down = delta < -0.0001;
  const cls = up ? "text-emerald-300 bg-emerald-500/12 border-emerald-400/30"
    : down ? "text-rose-300 bg-rose-500/12 border-rose-400/30"
      : "text-slate-400 bg-white/5 border-white/10";
  const arrow = up ? "▲" : down ? "▼" : "→";
  const sign = up ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${cls}`}>
      {arrow} {sign}{unit === "%" ? Math.round(delta * 100) : delta.toFixed(2)}{unit}
    </span>
  );
}

function RatingTrendsSection({ trends }: { trends: RatingTrends }) {
  const [pk, setPk] = useState<RatingPeriodKey>("d30");
  const p = trends.periods[pk];
  const tr = trends.trend;
  const monthly = trends.monthly.slice(-12); // 直近12ヶ月
  const maxMonthCount = Math.max(1, ...monthly.map((m) => m.count));

  return (
    <div className="space-y-3 pt-1">
      <SectionTitle icon="📈">評価集計（期間別・推移・月別）</SectionTitle>

      {/* 期間タブ */}
      <div className="flex items-center gap-1.5 flex-wrap px-1">
        {RT_PERIOD_TABS.map((t) => {
          const active = pk === t.key;
          const n = trends.periods[t.key].rated;
          return (
            <button
              key={t.key}
              onClick={() => setPk(t.key)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-bold border transition-colors ${
                active
                  ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-100"
                  : "bg-white/4 border-white/10 text-slate-300 hover:bg-white/8"
              }`}
            >
              {t.label}<span className="ml-1 text-[10px] font-normal opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      {/* 選択期間サマリ */}
      <div className="rounded-lg border border-white/12 bg-white/4 px-3 py-2.5 space-y-2">
        {p.rated === 0 ? (
          <p className="text-[12px] text-slate-400">この期間の評価データはありません。</p>
        ) : (
          <>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <div className="text-[10px] text-slate-400">成功率（評価5 / 評価1・2）</div>
                <div className="text-[26px] font-black text-emerald-200 leading-none tabular-nums">
                  {Math.round(p.rate * 100)}<span className="text-[15px]">%</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">平均評価</div>
                <div className="text-[20px] font-bold text-slate-100 leading-none tabular-nums">{p.avg.toFixed(2)}</div>
              </div>
              {p.kami > 0 && (
                <div>
                  <div className="text-[10px] text-slate-400">神率（評価6）</div>
                  <div className="text-[20px] font-bold text-amber-300 leading-none tabular-nums">
                    {Math.round(p.kamiRate * 100)}<span className="text-[13px]">%</span>
                    <span className="text-[11px] text-slate-400 ml-1">({p.kami}枚)</span>
                  </div>
                </div>
              )}
              <div className="text-[11px] text-slate-300 ml-auto text-right leading-relaxed">
                評価枚数 <span className="font-bold text-slate-100">{p.rated}</span><br />
                <span className="text-emerald-200">成功 {p.good}</span> ・ <span className="text-slate-400">中立 {p.normal}</span> ・ <span className="text-rose-200">失敗 {p.bad}</span>
              </div>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-white/8">
              <div className="bg-emerald-400/75" style={{ width: `${(p.good / p.rated) * 100}%` }} />
              <div className="bg-slate-400/40" style={{ width: `${(p.normal / p.rated) * 100}%` }} />
              <div className="bg-rose-400/70" style={{ width: `${(p.bad / p.rated) * 100}%` }} />
            </div>
          </>
        )}
      </div>

      {/* 推移（直近30日 vs 前30日）*/}
      <div className="rounded-lg border border-sky-400/25 bg-sky-500/8 px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-[12px] font-bold text-sky-100">📊 直近の推移</span>
          <span className="text-[10px] text-slate-400">直近30日 vs 前30日（31〜60日前）</span>
        </div>
        {tr.recentN === 0 && tr.prevN === 0 ? (
          <p className="text-[11px] text-slate-400">推移を出すには 60日以内の評価が必要です。</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                成功率 <DeltaPill delta={tr.deltaRate} unit="%" />
              </div>
              <div className="text-[13px] tabular-nums text-slate-200">
                {Math.round(tr.recentRate * 100)}% <span className="text-slate-500">←</span> <span className="text-slate-400">{Math.round(tr.prevRate * 100)}%</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                平均評価 <DeltaPill delta={tr.deltaAvg} />
              </div>
              <div className="text-[13px] tabular-nums text-slate-200">
                {tr.recentAvg.toFixed(2)} <span className="text-slate-500">←</span> <span className="text-slate-400">{tr.prevAvg.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 軸別👍👎（背景/衣装/ポーズ・直接評価データ・選択期間）*/}
      {p.axisGoodBad.some((a) => a.total > 0) && (
        <div className="rounded-lg border border-white/12 bg-white/3 px-3 py-2.5 space-y-2">
          <div className="text-[12px] font-bold text-slate-200">🎯 軸別👍👎（{RT_PERIOD_TABS.find((t) => t.key === pk)?.label}）</div>
          {p.axisGoodBad.map((a) => (
            <div key={a.axis} className="space-y-1">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-bold text-slate-200 w-20 shrink-0">{a.emoji} {a.jp}</span>
                {a.total === 0
                  ? <span className="text-[11px] text-slate-500">評価なし</span>
                  : <RateBar rate={a.goodRatio} good={a.good} bad={a.bad} />}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-500">※ 軸別👍👎は専用の評価データ（実数）です。</p>
        </div>
      )}

      {/* カテゴリ別成功率（背景/衣装/髪型/カメラ/ライティング・全体評価から派生・選択期間）*/}
      {p.axisSuccess.some((a) => a.total > 0) && (
        <div className="space-y-2">
          <div className="text-[12px] font-bold text-slate-200 px-1">🧩 カテゴリ別 成功率（{RT_PERIOD_TABS.find((t) => t.key === pk)?.label}）</div>
          <p className="text-[10px] text-slate-400 px-1 -mt-1">全体評価（5=成功 / 2・1=失敗）× 各カテゴリ出現から派生。色味は「色分析」タブの成功率分析を参照。</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {p.axisSuccess.filter((a) => a.total > 0).map((a) => (
              <div key={a.axis} className="rounded-lg border border-white/12 bg-white/3 px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-slate-200">{a.emoji} {a.jp}</span>
                  <span className="ml-auto text-[11px] text-slate-300 tabular-nums">
                    成功率 <span className="font-bold text-emerald-200">{Math.round(a.rate * 100)}%</span>
                    <span className="text-slate-500"> （{a.good}/{a.good + a.bad}）</span>
                  </span>
                </div>
                {a.best.length > 0 && (
                  <div className="space-y-0.5">
                    {a.best.map((c) => (
                      <div key={`b-${c.value}`} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-300 w-24 truncate shrink-0" title={c.jp}>🟢 {c.jp}</span>
                        <RateBar rate={c.rate} good={c.good} bad={c.bad} height="h-2" />
                      </div>
                    ))}
                  </div>
                )}
                {a.worst.length > 0 && a.worst.some((c) => c.rate < 0.5) && (
                  <div className="space-y-0.5 border-t border-white/8 pt-1">
                    {a.worst.filter((c) => c.rate < 0.5).slice(0, 3).map((c) => (
                      <div key={`w-${c.value}`} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 w-24 truncate shrink-0" title={c.jp}>🔻 {c.jp}</span>
                        <RateBar rate={c.rate} good={c.good} bad={c.bad} height="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 月別評価 */}
      {monthly.length > 0 && (
        <div className="rounded-lg border border-white/12 bg-white/3 px-3 py-2.5 space-y-1.5">
          <div className="text-[12px] font-bold text-slate-200">🗓 月別評価（直近{monthly.length}ヶ月）</div>
          <div className="space-y-1">
            {monthly.map((m) => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-300 tabular-nums w-16 shrink-0">{m.month}</span>
                <div className="flex-1 h-3 rounded bg-white/6 overflow-hidden relative">
                  <div className="h-full bg-sky-400/30" style={{ width: `${(m.count / maxMonthCount) * 100}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums w-12 text-right shrink-0">{m.count}枚</span>
                <span className="text-[11px] tabular-nums w-14 text-right shrink-0 text-emerald-200">{Math.round(m.rate * 100)}%</span>
                <span className="text-[10px] text-slate-400 tabular-nums w-16 text-right shrink-0">平均{m.avg.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">※ 棒＝月の評価枚数・％＝成功率（評価5）・平均＝全体評価平均。</p>
        </div>
      )}
    </div>
  );
}

function AxisPrefRow({ stat }: { stat: { jp: string; emoji: string; good: number; bad: number; total: number; goodRatio: number; badRatio: number; confidence: string } }) {
  const goodPct = stat.total > 0 ? stat.goodRatio * 100 : 0;
  const badPct  = stat.total > 0 ? stat.badRatio  * 100 : 0;
  return (
    <div className="rounded-md border border-white/8 bg-white/3 px-2 py-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-bold text-slate-200 shrink-0">
          {stat.emoji} {stat.jp}
        </span>
        {stat.total === 0 ? (
          <span className="text-[10px] text-slate-400">評価なし</span>
        ) : (
          <>
            <span className="text-[10px] text-emerald-200/85">👍 {stat.good}</span>
            <span className="text-[10px] text-rose-200/85">👎 {stat.bad}</span>
            <span className="ml-auto text-[9px] text-slate-400">
              信頼性：{stat.confidence === "high" ? "高" : stat.confidence === "medium" ? "中" : stat.confidence === "low" ? "低" : "—"}
            </span>
          </>
        )}
      </div>
      {stat.total > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden flex">
            <div className="h-full bg-emerald-400/70 transition-all" style={{ width: `${goodPct}%` }} />
            <div className="h-full bg-rose-400/70 transition-all"    style={{ width: `${badPct}%` }} />
          </div>
          <span className="text-[9px] text-slate-400 tabular-nums w-16 text-right">
            {Math.round(goodPct)}% / {Math.round(badPct)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ── セクション：🏆 成功/失敗ランキング（③）勝ちパターン/神引き候補発見 ──

/** 成功率の横棒（率帯で緑/橙/赤） */
function RankBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = rate >= 0.66 ? "bg-emerald-400/80" : rate >= 0.4 ? "bg-amber-400/75" : "bg-rose-400/75";
  return (
    <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden min-w-[36px]">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ComboRankList({ entries, tone }: { entries: ComboRankEntry[]; tone: "success" | "fail" }) {
  if (entries.length === 0) return <p className="text-[11px] text-slate-500 px-1 py-1">該当なし（最小サンプル未満）。</p>;
  return (
    <ol className="space-y-1">
      {entries.map((c, i) => (
        <li key={c.key} className="flex items-start gap-2 rounded-md border border-white/8 bg-white/3 px-2 py-1.5">
          <span className="text-[10px] text-slate-500 tabular-nums w-5 text-right shrink-0 pt-0.5">{i + 1}</span>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5">
              {c.parts.map((p, j) => (
                <span key={j} className="text-[11px] text-slate-200">
                  <span className="text-slate-500">{p.axisJp}:</span>{p.valueJp}
                  {j < c.parts.length - 1 && <span className="text-slate-600 mx-0.5">×</span>}
                </span>
              ))}
            </div>
            <RankBar rate={c.rate} />
          </div>
          <span className="text-[11px] tabular-nums w-[72px] text-right shrink-0 pt-0.5">
            <span className={tone === "success" ? "text-emerald-200 font-bold" : "text-rose-200 font-bold"}>{Math.round(c.rate * 100)}%</span>
            <br /><span className="text-slate-500 text-[10px]">{c.good}/{c.total}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ElementRankList({ entries, tone }: { entries: ElementRankEntry[]; tone: "success" | "fail" }) {
  if (entries.length === 0) return <p className="text-[11px] text-slate-500 px-1 py-1">該当なし（最小サンプル未満）。</p>;
  return (
    <ol className="space-y-1">
      {entries.map((e, i) => (
        <li key={e.key} className="flex items-center gap-2 rounded-md border border-white/8 bg-white/3 px-2 py-1">
          <span className="text-[10px] text-slate-500 tabular-nums w-5 text-right shrink-0">{i + 1}</span>
          <span className="text-[11px] text-slate-200 w-28 truncate shrink-0" title={`${e.axisJp} ${e.valueJp}`}>
            {e.emoji} <span className="text-slate-500">{e.axisJp}</span> {e.valueJp}
          </span>
          <RankBar rate={e.rate} />
          <span className="text-[11px] tabular-nums w-[70px] text-right shrink-0">
            <span className={`font-bold ${tone === "success" ? "text-emerald-200" : "text-rose-200"}`}>{Math.round(e.rate * 100)}%</span>
            <span className="text-slate-500"> {e.good}/{e.total}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function CaseRankList({ entries, tone }: { entries: CaseRankEntry[]; tone: "success" | "fail" }) {
  if (entries.length === 0) return <p className="text-[11px] text-slate-500 px-1 py-1">該当なし。</p>;
  return (
    <ol className="space-y-1">
      {entries.map((c, i) => (
        <li key={c.id || i} className="rounded-md border border-white/8 bg-white/3 px-2 py-1.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] text-slate-500 tabular-nums w-5 text-right shrink-0">{i + 1}</span>
            <span className={`text-[12px] font-bold tabular-nums ${tone === "success" ? "text-emerald-200" : "text-rose-200"}`}>★{c.avg.toFixed(2)}</span>
            <span className="text-[10px] text-emerald-200/70">👍{c.good}</span>
            <span className="text-[10px] text-rose-200/70">👎{c.bad}</span>
            {c.createdAt != null && <span className="ml-auto text-[9px] text-slate-500">{new Date(c.createdAt).toLocaleDateString("ja-JP")}</span>}
          </div>
          {c.parts.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-7">
              {c.parts.slice(0, 6).map((p, j) => (
                <span key={j} className="text-[10px] text-slate-300 bg-white/5 rounded px-1 py-0.5">{p}</span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function RankingSection({ rankings, colorSuccess }: { rankings: SuccessRankings | null; colorSuccess: ColorSuccessAnalysis | null }) {
  if (!rankings) {
    return (
      <p className="text-[12px] text-slate-400 px-1 py-3 leading-snug">
        🏆 まだ評価データがありません。生成結果に 👍/👎（と 背景/衣装/ポーズの軸別評価）を付けると、
        成功/失敗の<span className="font-bold text-slate-200">構成・要素・案</span>ランキングがここに表示されます。
      </p>
    );
  }

  const { composition, cases, minSample, topN } = rankings;

  // 要素横断：details要素＋色（既存 colorSuccess の色別成功率）を統合して順位付け（再抽出しない）
  const colorEntries: ElementRankEntry[] = (colorSuccess?.successRate ?? []).map((c) => ({
    key: `color:${c.colorId}`,
    axisJp: "色",
    emoji: "🎨",
    valueJp: COLOR_GROUPS.find((g) => g.id === c.colorId)?.jp ?? c.colorId,
    good: c.good, bad: c.bad, total: c.total, rate: c.total > 0 ? c.good / c.total : 0,
  }));
  const mergedElements = [...rankings.elements, ...colorEntries].filter((e) => e.total >= minSample);
  // 成功リストは「成功1件以上」、失敗リストは「失敗1件以上」に限定（100%/0%の混入を防ぐ）
  const elemSuccess = [...mergedElements].filter((e) => e.good > 0).sort((a, b) => b.rate - a.rate || b.total - a.total).slice(0, topN);
  const elemFail = [...mergedElements].filter((e) => e.bad > 0).sort((a, b) => a.rate - b.rate || b.total - a.total).slice(0, topN);

  return (
    <div className="space-y-4 py-2">
      {/* バナー */}
      <div className="rounded-lg border border-amber-400/30 bg-amber-500/8 px-3 py-2">
        <p className="text-[12px] text-amber-100/95 font-bold leading-snug">🏆 成功/失敗ランキング — 勝ちパターン発見・神引き候補発見</p>
        <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
          成功＝評価5 / 失敗＝評価2・1（中立3は除外）。最小サンプル {minSample} 件以上を対象・各 TOP{topN}。全期間。
        </p>
      </div>

      {/* ①構成（最重視）*/}
      <div className="space-y-2">
        <SectionTitle icon="🧩">構成（組合せ）ランキング — 最重要</SectionTitle>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/6 px-2.5 py-2 space-y-1.5">
            <div className="text-[12px] font-bold text-emerald-200">🏆 成功構成 TOP{topN}</div>
            <ComboRankList entries={composition.success} tone="success" />
          </div>
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/6 px-2.5 py-2 space-y-1.5">
            <div className="text-[12px] font-bold text-rose-200">💥 失敗構成 TOP{topN}</div>
            <ComboRankList entries={composition.fail} tone="fail" />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 px-1">※ 背景×衣装×髪型などの組合せ単位の成功率。神引きの“勝ち構成”候補・避けたい“負け構成”。</p>
      </div>

      {/* ②要素横断 */}
      <div className="space-y-2">
        <SectionTitle icon="✨">要素横断ランキング（全軸＋色）</SectionTitle>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/6 px-2.5 py-2 space-y-1.5">
            <div className="text-[12px] font-bold text-emerald-200">✨ 成功要素 TOP{topN}</div>
            <ElementRankList entries={elemSuccess} tone="success" />
          </div>
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/6 px-2.5 py-2 space-y-1.5">
            <div className="text-[12px] font-bold text-rose-200">⚠️ 失敗要素 TOP{topN}</div>
            <ElementRankList entries={elemFail} tone="fail" />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 px-1">※ 全軸（背景/衣装/髪型/カメラ/ライティング）＋色を横断。モチーフは「🔭発見」「重複分析」を参照。</p>
      </div>

      {/* ③案単位 */}
      <div className="space-y-2">
        <SectionTitle icon="📋">案単位ランキング</SectionTitle>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/6 px-2.5 py-2 space-y-1.5">
            <div className="text-[12px] font-bold text-emerald-200">📈 成功案 TOP{topN}</div>
            <CaseRankList entries={cases.success} tone="success" />
          </div>
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/6 px-2.5 py-2 space-y-1.5">
            <div className="text-[12px] font-bold text-rose-200">📉 失敗案 TOP{topN}</div>
            <CaseRankList entries={cases.fail} tone="fail" />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 px-1">※ 個別生成案を全体評価の平均で順位付け（★＝平均評価）。</p>
      </div>
    </div>
  );
}

// ── セクション：📸 画像分析（生成結果画像の重複・出現率） ───────────────

/** F4: 解析進捗バー。タブをブロックせずに解析状況を表示。 */
function AnalyzingBar({ done, total, pct, onCancel }: {
  done: number; total: number; pct: number; onCancel?: () => void;
}) {
  return (
    <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/8 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[12px] font-semibold text-emerald-100">
            画像を解析中…
          </span>
          <span className="text-[11px] text-emerald-200/80 tabular-nums">
            {done} / {total}件
          </span>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] px-2 py-0.5 rounded border border-slate-400/30 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 hover:text-white transition leading-none"
          >
            キャンセル
          </button>
        )}
      </div>
      {/* 進捗バー */}
      <div className="h-1 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-emerald-200/55 leading-snug">
        解析中も他のタブは使えます。完了後に自動で結果を更新します。
      </p>
    </div>
  );
}

function ImageAnalysisSection({
  analysis, progress, onCancel,
}: {
  analysis: ImageAnalysisResult | null;
  progress: { done: number; total: number } | null;
  onCancel?: () => void;
}) {
  // F4: 解析中かどうか（progress があり、かつ未完了）
  const isAnalyzing = !!(progress && progress.total > 0 && progress.done < progress.total);
  const pct = isAnalyzing ? Math.round((progress.done / progress.total) * 100) : null;

  if (!analysis || analysis.totalEligible === 0) {
    return (
      <div className="px-2 py-3 space-y-2">
        {isAnalyzing && (
          <AnalyzingBar done={progress.done} total={progress.total} pct={pct!} onCancel={onCancel} />
        )}
        <p className="text-[12px] text-slate-400">
          📸 生成結果画像がまだありません。各案カードで「生成結果」を登録すると画像分析が始まります。
        </p>
      </div>
    );
  }

  const remaining = analysis.totalEligible - analysis.totalAnalyzed;

  return (
    <div className="space-y-3 py-2">
      {/* F4: 解析中バー（目立つ位置・タブはブロックしない） */}
      {isAnalyzing && (
        <AnalyzingBar done={progress.done} total={progress.total} pct={pct!} onCancel={onCancel} />
      )}
      {/* ── ヘッダ：統計 ─────────────────────────── */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-1">
        <p className="text-[11px] text-slate-400">
          対象：<span className="text-emerald-200 font-bold">{analysis.totalAnalyzed}</span> 件解析済
          {remaining > 0 && (
            <span className="text-slate-400">（残 {remaining} 件）</span>
          )}
          ・クラスタ <span className="text-emerald-200">{analysis.clusters.length}</span>
          ・単独 <span className="text-slate-300">{analysis.uniqueCount}</span>
        </p>
      </div>

      {/* ── 視覚クラスタ TOP10 ──────────────────────────── */}
      {analysis.clusters.length > 0 && (
        <div>
          <SectionTitle icon="🔁">視覚的に類似した画像クラスタ（TOP10）</SectionTitle>
          <div className="space-y-1.5 px-1">
            {analysis.clusters.slice(0, 10).map((c, i) => (
              <div
                key={c.representativeHash}
                className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0"
              >
                <span className="text-[10px] text-slate-400 w-5 text-right">{i + 1}位</span>
                {c.representativeThumb ? (
                  <img
                    src={c.representativeThumb}
                    alt=""
                    className="w-10 h-10 rounded object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-white/5 border border-white/15 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-200">
                    <span className={c.size >= 5 ? "text-rose-200 font-bold" : c.size >= 3 ? "text-amber-200 font-bold" : ""}>
                      {c.size} 枚
                    </span>
                    の視覚的に類似画像
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    hash: {c.representativeHash.slice(0, 8)}…
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 px-1 pt-1 leading-snug">
            ※ プロンプトの文言が違っても見た目が酷似している場合に検出されます。
          </p>
        </div>
      )}

      {/* ── カテゴリ出現率 ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <RateCard title="🏞 背景"        rates={analysis.backgroundRates} />
        <RateCard title="👗 衣装"        rates={analysis.outfitRates} />
        <RateCard title="💇 髪型"        rates={analysis.hairRates} />
        <RateCard title="📷 カメラ"      rates={analysis.cameraRates} />
        <RateCard title="💡 ライティング" rates={analysis.lightingRates} />
      </div>

      {/* ── 頻出カテゴリ警告 ────────────────────────────── */}
      {analysis.overusedCategories.length > 0 && (
        <div>
          <SectionTitle icon="⚠">頻出カテゴリ（重みを下げ推奨）</SectionTitle>
          <div className="space-y-1 px-1">
            {analysis.overusedCategories.map((c, i) => (
              <div
                key={i}
                className={[
                  "rounded-md border px-2 py-1 text-[11px]",
                  c.ratio >= 0.70
                    ? "border-rose-400/55 bg-rose-500/10 text-rose-100"
                    : "border-amber-400/45 bg-amber-500/10 text-amber-100",
                ].join(" ")}
              >
                <span className="font-bold">{c.axis}：{c.label}</span>
                <span className="opacity-70 ml-1.5">{Math.round(c.ratio * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 未開拓カテゴリ ────────────────────────────── */}
      {analysis.underusedCategories.length > 0 && (
        <div>
          <SectionTitle icon="🌈">未開拓カテゴリ（試すと新規性が上がる）</SectionTitle>
          <div className="flex flex-wrap gap-1 px-1">
            {analysis.underusedCategories.slice(0, 24).map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-100 leading-none"
              >
                <span className="opacity-75 mr-1">{c.axis}</span>
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* フッタ説明 */}
      <p className="text-[10px] text-slate-400 px-1 leading-snug border-t border-white/5 pt-2">
        ※ 画像分析は生成結果画像の <strong>perceptual hash</strong> による視覚的類似度＋
        履歴の構造化 details からの集計です。文言が違っても見た目が似た画像を捕捉します。
        次回プロンプト生成時に、頻出カテゴリ回避・未開拓カテゴリ推奨としてサーバに送信されます。
      </p>
    </div>
  );
}

function RateCard({ title, rates }: { title: string; rates: { label: string; count: number; ratio: number }[] }) {
  const total = rates.reduce((s, r) => s + r.count, 0);
  return (
    <div className="rounded-md border border-white/12 bg-white/3 px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-slate-200">{title}</span>
        <span className="text-[10px] text-slate-400">{total}回</span>
      </div>
      {rates.length === 0 ? (
        <p className="text-[12px] text-slate-400">記録なし</p>
      ) : (
        <div className="space-y-0.5 ipm-list">
          {rates.slice(0, 4).map((r) => (
            <div key={r.label} className="flex items-center gap-1.5 px-1 py-0.5">
              <span className="text-[12px] text-slate-200 flex-1 truncate">{r.label}</span>
              <div className="w-12 h-1 rounded-full bg-white/8 overflow-hidden">
                <div className="h-full bg-emerald-400/70" style={{ width: `${Math.max(2, r.ratio * 100)}%` }} />
              </div>
              <span className="text-[11px] text-slate-300 tabular-nums w-8 text-right">{Math.round(r.ratio * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── セクション：🎨 色生成制御センター ─────────────────────────────────────

function ColorAnalysisSection({
  analysis, colorSuccess, weights, onWeightChange, onReset,
  onAutoAdjust, onUndoAdjust, canUndo, changedKeys,
  windowSize, onWindowSizeChange,
}: {
  analysis:   ColorAnalysis | null;
  colorSuccess: ColorSuccessAnalysis | null;
  weights:    ColorWeightMap;
  onWeightChange: (colorId: string, axis: ColorAxisCtrl, w: ColorWeight) => void;
  onReset:        () => void;
  onAutoAdjust:   (preserveManual: boolean) => void;
  onUndoAdjust:   () => void;
  canUndo:        boolean;
  changedKeys:    ReadonlySet<string>;
  windowSize:        50 | 100;
  onWindowSizeChange: (size: 50 | 100) => void;
}) {
  if (!analysis || analysis.windowSize === 0) {
    return (
      <div className="px-2 py-3 space-y-2">
        <p className="text-[12px] text-slate-400">
          🎨 履歴が不足しています。数回生成すると色分析が動き始めます。
        </p>
        <ColorWeightGrid weights={weights} onWeightChange={onWeightChange} onReset={onReset}
          onAutoAdjust={onAutoAdjust} onUndoAdjust={onUndoAdjust} canUndo={canUndo}
          changedKeys={changedKeys} canAutoAdjust={false} />
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {/* ── ウィンドウ切替 ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] text-slate-400">
          対象：直近 <span className="text-amber-200 font-bold">{analysis.windowSize}</span> 件
        </p>
        <div className="flex gap-1">
          {([50, 100] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onWindowSizeChange(n)}
              className={[
                "text-[10px] font-semibold px-2 py-0.5 rounded border leading-none transition",
                windowSize === n
                  ? "border-amber-400/70 bg-amber-500/20 text-amber-100"
                  : "border-white/15 bg-white/5 text-slate-400 hover:text-slate-100",
              ].join(" ")}
            >
              {n}件
            </button>
          ))}
        </div>
      </div>

      {/* ── 色相分布（全10色を色相順に大型横棒）A2-3a ── */}
      <div>
        <SectionTitle icon="🌈">色相分布（全色・色相順）</SectionTitle>
        {(() => {
          const max = Math.max(1, ...analysis.globalRanking.map((x) => x.count));
          return (
            <div className="space-y-2 px-1">
              {COLOR_GROUPS.map((g) => {
                const r = analysis.globalRanking.find((x) => x.colorId === g.id);
                const count = r?.count ?? 0;
                const ratio = r?.ratio ?? 0;
                return (
                  <div key={g.id} className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded border border-white/25 shrink-0" style={{ backgroundColor: g.swatch }} />
                    <span className="text-[14px] text-slate-100 w-24 shrink-0">{g.jp}</span>
                    <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ width: `${Math.round((count / max) * 100)}%`, backgroundColor: g.swatch, opacity: count > 0 ? 0.9 : 0 }} />
                    </div>
                    <span className="text-[13px] tabular-nums text-slate-200 w-20 text-right shrink-0">{Math.round(ratio * 100)}%<span className="text-slate-500 ml-1">{count}</span></span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── A2-3b: 色の成功率分析（評価×時系列）── */}
      {colorSuccess && colorSuccess.ratedItemCount > 0 && (() => {
        const meta = (id: string) => COLOR_GROUPS.find((c) => c.id === id);
        const chip = (id: string, suffix: string) => {
          const g = meta(id); if (!g) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-slate-100 leading-none">
              <span className="w-3 h-3 rounded-sm border border-white/20" style={{ backgroundColor: g.swatch }} />
              {g.jp}<span className="text-slate-400">{suffix}</span>
            </span>
          );
        };
        const list = (title: string, items: { colorId: string; count: number }[]) => (
          <div>
            <p className="text-[13px] font-bold text-slate-200 mb-1">{title}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.length === 0 ? <span className="text-[12px] text-slate-500">データなし</span>
                : items.map((e) => chip(e.colorId, ` ${e.count}`))}
            </div>
          </div>
        );
        return (
          <div className="space-y-3">
            <SectionTitle icon="🏆">成功率分析（評価4-5=成功 / 1-2=失敗・{colorSuccess.ratedItemCount}件）</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-1">
              {list("✅ 成功色 TOP（評価4-5）", colorSuccess.successTop)}
              {list("❌ 失敗色 TOP（評価1-2）", colorSuccess.failTop)}
            </div>
            {colorSuccess.successRate.length > 0 && (
              <div>
                <p className="text-[13px] font-bold text-slate-200 mb-1 px-1">色別 成功率（成功/失敗/率）</p>
                <div className="space-y-1.5 px-1">
                  {colorSuccess.successRate.map((e) => {
                    const g = meta(e.colorId);
                    return (
                      <div key={e.colorId} className="flex items-center gap-2.5">
                        <span className="w-4 h-4 rounded border border-white/25 shrink-0" style={{ backgroundColor: g?.swatch }} />
                        <span className="text-[13px] text-slate-100 w-20 shrink-0">{g?.jp ?? e.colorId}</span>
                        <div className="flex-1 h-4 rounded bg-rose-500/25 overflow-hidden" title={`成功${e.good} / 失敗${e.bad}`}>
                          <div className="h-full rounded bg-emerald-500/70" style={{ width: `${e.rate}%` }} />
                        </div>
                        <span className="text-[13px] tabular-nums text-slate-200 w-28 text-right shrink-0">
                          {e.rate}% <span className="text-emerald-300">{e.good}</span>/<span className="text-rose-300">{e.bad}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-1">
              <div className="space-y-2">
                {list("📈 直近30日 よく使った色", colorSuccess.trend30)}
                {list("🗓 直近90日 よく使った色", colorSuccess.trend90)}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[13px] font-bold text-emerald-300 mb-1">⤴ 急上昇色（30日 vs 31-90日）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {colorSuccess.rising.length === 0 ? <span className="text-[12px] text-slate-500">なし</span>
                      : colorSuccess.rising.map((d) => chip(d.colorId, ` +${d.delta}%`))}
                  </div>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-rose-300 mb-1">⤵ 急下降色</p>
                  <div className="flex flex-wrap gap-1.5">
                    {colorSuccess.falling.length === 0 ? <span className="text-[12px] text-slate-500">なし</span>
                      : colorSuccess.falling.map((d) => chip(d.colorId, ` ${d.delta}%`))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 偏り警告 ─────────────────────────────────── */}
      {analysis.biasWarnings.length > 0 && (
        <div className="space-y-1.5">
          <SectionTitle icon="⚠">色偏り警告</SectionTitle>
          {analysis.biasWarnings.map((w, i) => (
            <div
              key={i}
              className={[
                "rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug",
                w.severity === "high"
                  ? "border-rose-400/55 bg-rose-500/10 text-rose-100"
                  : "border-amber-400/45 bg-amber-500/10 text-amber-100",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={[
                  "w-2.5 h-2.5 rounded-sm border border-white/20",
                ].join(" ")} style={{ backgroundColor: COLOR_GROUPS.find((c) => c.id === w.colorId)?.swatch }} />
                <span className="font-bold">
                  {w.axis === "global" ? "全体" : COLOR_AXES.find((a) => a.id === w.axis)?.jp}
                </span>
                <span className="text-[10px] opacity-70">
                  {Math.round(w.ratio * 100)}%
                </span>
              </div>
              <p>{w.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 色別ランキング（軸を問わない総出現） ──────────────── */}
      <div>
        <SectionTitle icon="📊">色別ランキング（全軸合計）</SectionTitle>
        <div className="space-y-1 px-1 ipm-list">
          {analysis.globalRanking.filter((r) => r.count > 0).slice(0, 12).map((r) => (
            <ColorBar key={r.colorId} colorId={r.colorId} count={r.count} ratio={r.ratio} />
          ))}
          {analysis.globalRanking.every((r) => r.count === 0) && (
            <p className="text-[11px] text-slate-400">色情報が検出されませんでした。</p>
          )}
        </div>
      </div>

      {/* ── 軸別カード ─────────────────────────────────── */}
      <div>
        <SectionTitle icon="🎯">軸別の色傾向（背景 / 衣装 / 髪 / 差し色 / ライティング）</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 px-1">
          {analysis.perAxis.map((ax) => (
            <AxisCard key={ax.axis} axis={ax.axis} total={ax.total} byColor={ax.byColor} topColor={ax.topColor} />
          ))}
        </div>
      </div>

      {/* ── 配色ランキング ───────────────────────────────── */}
      {analysis.comboRanking.length > 0 && (
        <div>
          <SectionTitle icon="🎭">配色ランキング（軸ペアの組合せ）</SectionTitle>
          <div className="space-y-1 px-1">
            {analysis.comboRanking.map((c, i) => (
              <ComboColorRow key={i} entry={c} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── 未開拓カラー ─────────────────────────────────── */}
      {analysis.unexploredColors.length > 0 && (
        <div>
          <SectionTitle icon="🌈">未開拓カラー（まだ使っていない色）</SectionTitle>
          <div className="flex flex-wrap gap-1 px-1">
            {analysis.unexploredColors.map((id) => {
              const g = COLOR_GROUPS.find((c) => c.id === id);
              if (!g) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-100 leading-none"
                >
                  <span className="w-3 h-3 rounded-sm border border-white/20" style={{ backgroundColor: g.swatch }} />
                  {g.jp}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 神引き色候補（未開拓＋低出現＝意外性が出る色）A2-3a ── */}
      {(() => {
        const lowUsed = analysis.globalRanking.filter((r) => r.count > 0).sort((a, b) => a.count - b.count).slice(0, 4).map((r) => r.colorId);
        const cand = [...new Set([...analysis.unexploredColors, ...lowUsed])].slice(0, 8);
        if (cand.length === 0) return null;
        return (
          <div>
            <SectionTitle icon="🎲">神引き色候補（未開拓・低出現＝意外性）</SectionTitle>
            <div className="flex flex-wrap gap-1.5 px-1">
              {cand.map((id) => {
                const g = COLOR_GROUPS.find((c) => c.id === id);
                if (!g) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100 leading-none">
                    <span className="w-3 h-3 rounded-sm border border-white/20" style={{ backgroundColor: g.swatch }} />
                    {g.jp}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 色×軸重みグリッド（生成制御の主役） ─────────── */}
      <ColorWeightGrid weights={weights} onWeightChange={onWeightChange} onReset={onReset}
        onAutoAdjust={onAutoAdjust} onUndoAdjust={onUndoAdjust} canUndo={canUndo}
        changedKeys={changedKeys} canAutoAdjust={true} />
    </div>
  );
}

// ── 色×軸 重みグリッド（生成制御センターの主役） ──────────────────────────

function ColorWeightGrid({
  weights, onWeightChange, onReset,
  onAutoAdjust, onUndoAdjust, canUndo,
  changedKeys, canAutoAdjust,
}: {
  weights:       ColorWeightMap;
  onWeightChange: (colorId: string, axis: ColorAxisCtrl, w: ColorWeight) => void;
  onReset:       () => void;
  onAutoAdjust:  (preserveManual: boolean) => void;
  onUndoAdjust:  () => void;
  canUndo:       boolean;
  changedKeys:   ReadonlySet<string>;
  canAutoAdjust: boolean;
}) {
  const { block, suppress, boost, customized } = countWeights(weights);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 flex-wrap gap-1">
        <SectionTitle icon="🎛">色×軸 生成制御（髪/服/背景を独立に 0-5）</SectionTitle>
        <div className="flex gap-1 items-center">
          {canAutoAdjust && (
            <button
              type="button"
              onClick={() => onAutoAdjust(true)}
              title="偏り色を減点・未使用色を加点（手動設定は保護）"
              className="text-[10px] font-semibold text-violet-100 bg-violet-500/20 border border-violet-400/55 px-1.5 py-0.5 rounded leading-none hover:bg-violet-500/30 transition"
            >
              ✨ 提案を反映
            </button>
          )}
          {canAutoAdjust && (
            <button
              type="button"
              onClick={() => onAutoAdjust(false)}
              title="手動設定も含めて全色を上書きで自動調整"
              className="text-[10px] font-semibold text-amber-100 bg-amber-500/15 border border-amber-400/45 px-1.5 py-0.5 rounded leading-none hover:bg-amber-500/25 transition"
            >
              全上書き
            </button>
          )}
          {canUndo && (
            <button
              type="button"
              onClick={onUndoAdjust}
              title="直前の自動調整を取り消す"
              className="text-[10px] text-slate-300 border border-white/20 bg-white/5 px-1.5 py-0.5 rounded leading-none hover:bg-white/10 transition"
            >
              ↶ 元に戻す
            </button>
          )}
          {customized > 0 && (
            <button
              type="button"
              onClick={onReset}
              title="全色を既定（普通=3）に戻す"
              className="text-[10px] text-slate-400 hover:text-slate-100 px-1.5 py-0.5 rounded border border-white/15 hover:border-white/30 leading-none"
            >
              🗑 全リセット
            </button>
          )}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400 flex-wrap">
        <span>凡例：</span>
        {([0, 1, 2, 3, 4, 5] as ColorWeight[]).map((w) => (
          <span key={w} className="inline-flex items-center gap-0.5">
            <span className={["w-3 h-3 rounded-sm border", WEIGHT_META[w].cls].join(" ")} />
            <span>{WEIGHT_META[w].jp}</span>
          </span>
        ))}
      </div>

      {/* ヘッダ行 */}
      <div className="grid grid-cols-[3.4rem_1fr_1fr_1fr] gap-x-2 px-1 text-[10px] text-slate-400 font-semibold">
        <span></span>
        {COLOR_AXIS_CTRL.map((a) => (
          <span key={a.id} className="text-center">
            {a.emoji} {a.jp}
          </span>
        ))}
      </div>

      <div className="space-y-1 px-1">
        {COLOR_GROUPS.map((g) => {
          const entry = getColorEntry(weights, g.id);
          return (
            <div key={g.id} className="grid grid-cols-[3.4rem_1fr_1fr_1fr] gap-x-2 items-center py-1 border-b border-white/4 last:border-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0"
                  style={{ backgroundColor: g.swatch }}
                />
                <span className="text-[11px] text-slate-200 truncate">{g.jp}</span>
              </div>
              {COLOR_AXIS_CTRL.map((a) => (
                <WeightCells
                  key={a.id}
                  value={entry[a.id]}
                  changed={changedKeys.has(`${g.id}:${a.id}`)}
                  onChange={(w) => onWeightChange(g.id, a.id, w)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* フッタ情報 */}
      <p className="text-[10px] text-slate-400 px-1 pt-2 leading-snug">
        ※ 「禁止」(0) 指定の色はその軸で使わない（さらに NG トークンとしても扱われる）。
        「強推奨」(5) は最優先で取り入れる。3=普通は何も指示しない。
      </p>
      <p className="text-[10px] text-slate-400 px-1 leading-snug">
        現在：制御中 <span className="text-violet-200">{customized}</span> 色
        ・禁止 <span className="text-rose-200">{block}</span>
        ・抑制 <span className="text-amber-200">{suppress}</span>
        ・推奨 <span className="text-sky-200">{boost}</span>
      </p>
    </div>
  );
}

// ── 重みセル（6ボタン水平、ハイライト対応） ────────────────────────────

function WeightCells({
  value, changed, onChange,
}: {
  value:    ColorWeight;
  changed:  boolean;
  onChange: (w: ColorWeight) => void;
}) {
  return (
    <div className={[
      "flex gap-0.5 justify-center",
      changed ? "ring-1 ring-violet-400/55 rounded-md p-0.5 -m-0.5" : "",
    ].join(" ")}>
      {([0, 1, 2, 3, 4, 5] as ColorWeight[]).map((w) => {
        const active = value === w;
        const meta = WEIGHT_META[w];
        return (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            title={`${w} ${meta.jp}`}
            className={[
              "w-5 h-5 text-[9px] font-bold rounded border leading-none transition select-none",
              active
                ? `${meta.cls} ${meta.textCls}`
                : "border-white/10 bg-white/4 text-slate-400 hover:border-white/25 hover:text-slate-200",
            ].join(" ")}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}

// ── 色バー（ランキング用） ────────────────────────────

function ColorBar({ colorId, count, ratio }: { colorId: string; count: number; ratio: number }) {
  const g = COLOR_GROUPS.find((c) => c.id === colorId);
  if (!g) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-sm border border-white/20 shrink-0" style={{ backgroundColor: g.swatch }} />
      <span className="text-[11px] text-slate-200 w-12 shrink-0">{g.jp}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, ratio * 100)}%`, backgroundColor: g.swatch, opacity: 0.85 }}
        />
      </div>
      <span className="text-[10px] text-slate-400 w-16 text-right tabular-nums">
        {count}回 / {Math.round(ratio * 100)}%
      </span>
    </div>
  );
}

// ── 軸別カード ────────────────────────────────────

function AxisCard({
  axis, total, byColor, topColor,
}: {
  axis:    ColorAxis;
  total:   number;
  byColor: { colorId: string; count: number; ratio: number }[];
  topColor?: { colorId: string; ratio: number };
}) {
  const meta = COLOR_AXES.find((a) => a.id === axis)!;
  const isStrongBias = topColor && topColor.ratio >= 0.70;
  return (
    <div className={[
      "rounded-md border px-2 py-1.5",
      isStrongBias ? "border-rose-400/40 bg-rose-500/5" : "border-white/12 bg-white/3",
    ].join(" ")}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
          <span>{meta.emoji}</span>
          <span>{meta.jp}</span>
        </span>
        <span className="text-[10px] text-slate-400">{total}回</span>
      </div>
      {total === 0 ? (
        <p className="text-[10px] text-slate-400">検出なし</p>
      ) : (
        <div className="space-y-0.5">
          {byColor.filter((c) => c.count > 0).slice(0, 4).map((c) => {
            const g = COLOR_GROUPS.find((x) => x.id === c.colorId)!;
            return (
              <div key={c.colorId} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm border border-white/20 shrink-0" style={{ backgroundColor: g.swatch }} />
                <span className="text-[10px] text-slate-300 flex-1 truncate">{g.jp}</span>
                <span className="text-[9px] text-slate-400 tabular-nums">{Math.round(c.ratio * 100)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 配色ペア表示 ──────────────────────────────────

function ComboColorRow({ entry, rank }: { entry: { axes: { axis: ColorAxis; colorId: string }[]; count: number }; rank: number }) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
      <span className="text-[10px] text-slate-400 w-5 text-right">{rank}位</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {entry.axes.map((a, i) => {
          const g = COLOR_GROUPS.find((c) => c.id === a.colorId);
          const ax = COLOR_AXES.find((x) => x.id === a.axis);
          if (!g || !ax) return null;
          return (
            <span key={i} className="flex items-center gap-1 text-[10px]">
              {i > 0 && <span className="text-slate-400">×</span>}
              <span className="w-2.5 h-2.5 rounded-sm border border-white/20" style={{ backgroundColor: g.swatch }} />
              <span className="text-slate-300">{ax.jp.replace("色", "")}/{g.jp.replace("系", "")}</span>
            </span>
          );
        })}
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{entry.count}回</span>
    </div>
  );
}

// ── セクション：🤖 AI分析エージェント ────────────────────────────────────────

function AgentSection({
  agent, onAction,
}: {
  agent: AgentAnalysis | null;
  onAction: (id: AgentActionId) => void;
}) {
  if (!agent) {
    return (
      <p className="text-[12px] text-slate-400 px-2 py-3">
        分析データが不足しています。数回生成すると、AI分析が動き始めます。
      </p>
    );
  }
  const sevCls = (s: "low" | "medium" | "high") =>
    s === "high"   ? "border-rose-400/55 bg-rose-500/10 text-rose-100"
    : s === "medium" ? "border-amber-400/45 bg-amber-500/10 text-amber-100"
    : "border-white/15 bg-white/5 text-slate-200";

  const priorityCls = (p: "low" | "medium" | "high") =>
    p === "high"   ? "border-violet-400/70 bg-violet-500/25 text-violet-50 shadow-[0_0_8px_rgba(139,92,246,0.35)]"
    : p === "medium" ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10";

  return (
    <div className="px-2 pb-2 space-y-3">
      {/* 現在の傾向 */}
      <div>
        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">現在の傾向</div>
        <p className="text-[13px] text-slate-100 leading-relaxed px-1">{agent.trendSummary}</p>
        <p className="text-[10px] text-slate-400/70 px-1 mt-0.5">※ 重複回避・未開拓発見・神引き候補を優先（好みは任意）。発見性・意外性が評価軸です。</p>
      </div>

      {/* 🔴 問題 */}
      {agent.problems.length > 0 && (
        <div>
          <div className="text-[12px] font-bold mb-1 px-1 text-rose-300">🔴 問題</div>
          <ul className="space-y-1">
            {agent.problems.map((p, i) => (
              <li key={i} className={["text-[12px] leading-snug px-2 py-1.5 rounded-md border", sevCls(p.severity)].join(" ")}>
                {p.severity === "high" ? "🔴 " : p.severity === "medium" ? "🟡 " : "💡 "}{p.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🟡 原因 */}
      {agent.causes.length > 0 && (
        <div>
          <div className="text-[12px] font-bold mb-1 px-1 text-amber-300">🟡 原因</div>
          <ul className="space-y-1">
            {agent.causes.map((c, i) => (
              <li key={i} className="text-[12px] leading-snug px-2 py-1.5 rounded-md border border-amber-400/35 bg-amber-500/8 text-amber-100/90">
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔵 改善案 */}
      <div>
        <div className="text-[12px] font-bold mb-1 px-1 text-sky-300">🔵 改善案（発見志向）</div>
        <ul className="space-y-1">
          {agent.recommendations.map((r, i) => (
            <li key={i} className="text-[12px] text-sky-100/90 leading-snug px-2 py-1.5 rounded-md border border-sky-400/30 bg-sky-500/8">
              ・{r}
            </li>
          ))}
        </ul>
      </div>

      {/* 🟢 推奨アクション */}
      <div>
        <div className="text-[12px] font-bold mb-1 px-1 text-emerald-300">🟢 推奨アクション（押した時だけ反映）</div>
        <div className="flex flex-wrap gap-1.5">
          {agent.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAction(a.id)}
              title={a.description}
              className={[
                "inline-flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg border text-left transition",
                priorityCls(a.priority),
              ].join(" ")}
            >
              <span className="text-[12px] font-bold leading-none">{a.label}</span>
              <span className="text-[10px] opacity-70 leading-tight">{a.description}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-text-muted/60 leading-snug px-1 border-t border-white/10 pt-1.5">
        ⚠ AI分析エージェントは設定を勝手に変更しません。ボタンを押した時だけ反映します。
      </p>
    </div>
  );
}

// ── セクション：頻出構成 TOP10 ────────────────────────────────────────────────

function ComboPolicyBtn({
  current, target, onClick, label, color,
}: {
  current: ComboPolicy; target: ComboPolicy;
  onClick: () => void; label: string; color: "rose" | "fuchsia" | "emerald";
}) {
  const active = current === target;
  const palette = {
    rose:     active ? "border-rose-400 bg-rose-500/80 text-white shadow-[0_0_6px_rgba(244,63,94,0.4)]"
                     : "border-rose-400/40 text-rose-200 hover:bg-rose-500/15 hover:border-rose-400/70",
    fuchsia:  active ? "border-fuchsia-400 bg-fuchsia-500/75 text-white shadow-[0_0_6px_rgba(217,70,239,0.4)]"
                     : "border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-500/15 hover:border-fuchsia-400/70",
    emerald:  active ? "border-emerald-400 bg-emerald-500/75 text-white"
                     : "border-emerald-400/30 text-emerald-300/70 hover:bg-emerald-500/12 hover:border-emerald-400/60",
  }[color];
  return (
    <button type="button" onClick={onClick}
      className={["text-[11px] font-bold px-2 py-1 rounded border leading-none transition whitespace-nowrap", palette].join(" ")}>
      {label}
    </button>
  );
}

// ── セクション：複合構成分析（サイズ別＋ドリルダウン）docs/32 A2-1b ──────────────
function kCombinations(arr: string[], k: number): string[][] {
  if (k <= 0 || k > arr.length) return [];
  if (k === 1) return arr.map((x) => [x]);
  const out: string[][] = [];
  const rec = (start: number, combo: string[]) => {
    if (combo.length === k) { out.push(combo.slice()); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop(); }
  };
  rec(0, []);
  return out;
}

function CompositionAnalysis({
  itemSets, motifCounts, windowSize,
}: {
  itemSets: string[][];
  motifCounts: MotifCount[];
  windowSize: number;
}) {
  const [mode, setMode] = useState<"drill" | "size">("drill");
  const [bg, setBg] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<string | null>(null);
  const rate = (n: number) => (windowSize > 0 ? Math.round((n / windowSize) * 100) : 0);

  const idToMotif = useMemo(() => {
    const m = new Map<string, { label: string; category: string }>();
    for (const mc of motifCounts) m.set(mc.motif.id, { label: mc.motif.label, category: mc.motif.category });
    return m;
  }, [motifCounts]);
  const labelOf = (id: string) => idToMotif.get(id)?.label ?? id;

  // サイズ別ランキング（1/2/3要素・出現数降順 top8）
  const bySize = useMemo(() => {
    const rank = (size: number) => {
      const counter = new Map<string, { ids: string[]; count: number }>();
      for (const set of itemSets) {
        if (set.length < size) continue;
        for (const combo of kCombinations(set, size)) {
          const ids = [...combo].sort();
          const key = ids.join("|");
          const e = counter.get(key) ?? { ids, count: 0 };
          e.count++; counter.set(key, e);
        }
      }
      return [...counter.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    };
    return { one: rank(1), two: rank(2), three: rank(3) };
  }, [itemSets]);

  // ドリルダウン：カテゴリ進行（背景→衣装→髪）。required を全て含む item 内の category 共起を集計。
  const rankByCat = (category: string, required: string[]) => {
    const counter = new Map<string, number>();
    for (const set of itemSets) {
      if (!required.every((r) => set.includes(r))) continue;
      for (const id of set) {
        if (required.includes(id)) continue;
        if (idToMotif.get(id)?.category !== category) continue;
        counter.set(id, (counter.get(id) ?? 0) + 1);
      }
    }
    return [...counter.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  };
  const bgRank = useMemo(() => rankByCat("背景", []), [itemSets, idToMotif]);
  const outfitRank = useMemo(() => (bg ? rankByCat("衣装", [bg]) : []), [itemSets, idToMotif, bg]);
  const hairRank = useMemo(() => (bg && outfit ? rankByCat("髪", [bg, outfit]) : []), [itemSets, idToMotif, bg, outfit]);

  if (itemSets.length === 0) return null;

  const rowEl = (key: string, label: string, count: number, active?: boolean, onClick?: () => void) => (
    <button key={key} type="button" disabled={!onClick} onClick={onClick}
      className={["w-full flex items-center justify-between gap-2 px-2 py-1 rounded border text-left transition",
        active ? "border-violet-400/70 bg-violet-500/20 text-violet-50"
        : onClick ? "border-white/10 bg-white/4 text-slate-200 hover:border-violet-400/40 hover:bg-violet-500/10 cursor-pointer"
        : "border-white/8 bg-white/3 text-slate-300"].join(" ")}>
      <span className="text-[11px] truncate">{label}</span>
      <span className="text-[11px] tabular-nums shrink-0">{rate(count)}%<span className="text-slate-400 ml-1">{count}</span></span>
    </button>
  );

  return (
    <>
      <SectionTitle icon="🧬">複合構成分析</SectionTitle>
      <p className="text-[10.5px] text-slate-400 px-1 pb-1 leading-snug">
        いつもの「組み合わせの連鎖」を可視化。ドリルダウンは 背景→共起する衣装→共起する髪型 と段階的に辿れます。
      </p>
      <div className="flex items-center gap-1 px-1 pb-1.5">
        {([["drill", "ドリルダウン（背景→衣装→髪）"], ["size", "サイズ別（1/2/3要素）"]] as [typeof mode, string][]).map(([k, lbl]) => (
          <button key={k} type="button" onClick={() => setMode(k)}
            className={["text-[11px] px-2 py-1 rounded border transition",
              mode === k ? "border-violet-400/70 bg-violet-500/20 text-violet-50 font-semibold" : "border-white/12 bg-white/3 text-slate-400 hover:text-slate-100"].join(" ")}>
            {lbl}
          </button>
        ))}
      </div>

      {mode === "drill" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-1 pb-1">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-sky-300/90">① 背景</p>
            {bgRank.length === 0 && <p className="text-[10px] text-slate-500">データなし</p>}
            {bgRank.map((r) => rowEl(r.id, labelOf(r.id), r.count, bg === r.id, () => { setBg(bg === r.id ? null : r.id); setOutfit(null); }))}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-violet-300/90">② ＋衣装 {!bg && <span className="text-slate-500 font-normal">（背景を選択）</span>}</p>
            {bg && outfitRank.length === 0 && <p className="text-[10px] text-slate-500">共起なし</p>}
            {outfitRank.map((r) => rowEl(r.id, labelOf(r.id), r.count, outfit === r.id, () => setOutfit(outfit === r.id ? null : r.id)))}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-fuchsia-300/90">③ ＋髪型 {!(bg && outfit) && <span className="text-slate-500 font-normal">（衣装を選択）</span>}</p>
            {bg && outfit && hairRank.length === 0 && <p className="text-[10px] text-slate-500">共起なし</p>}
            {hairRank.map((r) => rowEl(r.id, labelOf(r.id), r.count))}
          </div>
        </div>
      )}

      {mode === "size" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-1 pb-1">
          {([["1要素", bySize.one], ["2要素", bySize.two], ["3要素", bySize.three]] as [string, { ids: string[]; count: number }[]][]).map(([title, list]) => (
            <div key={title} className="space-y-1">
              <p className="text-[10px] font-bold text-slate-300">{title}</p>
              {list.length === 0 && <p className="text-[10px] text-slate-500">データなし</p>}
              {list.map((c) => rowEl(c.ids.join("|"), c.ids.map(labelOf).join(" ＋ "), c.count))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ComboRanking({
  combos, policies, onChange, windowSize,
}: {
  combos: MotifCombo[];
  policies: ComboPolicyMap;
  onChange: (key: string, p: ComboPolicy) => void;
  windowSize: number;
}) {
  const [count, setCount] = useState<number>(20);
  if (combos.length === 0) return null;
  const sorted = [...combos].sort((a, b) => b.count - a.count);
  const show = count === Infinity ? sorted : sorted.slice(0, count);
  const rate = (n: number) => (windowSize > 0 ? Math.round((n / windowSize) * 100) : 0);
  const riskCls = (r: MotifCombo["risk"]) =>
    r === "danger" ? "text-rose-300 border-rose-400/55 bg-rose-500/15"
    : r === "high" ? "text-orange-200 border-orange-400/50 bg-orange-500/12"
    : r === "medium" ? "text-amber-200 border-amber-400/45 bg-amber-500/10"
    : "text-slate-300 border-white/15 bg-white/5";
  const riskLabel = (r: MotifCombo["risk"]) =>
    r === "danger" ? "危険" : r === "high" ? "高" : r === "medium" ? "中" : "低";

  return (
    <>
      <SectionTitle icon="🧩">頻出構成（出現率順）</SectionTitle>
      <div className="flex items-center gap-2 flex-wrap px-1 pb-1">
        <p className="text-[11px] text-slate-400 leading-snug flex-1 min-w-[200px]">
          同じ案内で何度も揃う組み合わせ。「今後出さない」で同時使用を禁止、「別ジャンル化」で別方向へ振り替え。
        </p>
        <label className="flex items-center gap-1 text-[10px] text-slate-400">件数
          <select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}
            className="rounded border border-white/15 bg-bg-base/60 text-[11px] text-slate-100 px-1.5 py-1 focus:outline-none">
            {[20, 50, 100, Infinity].map((n) => <option key={n} value={String(n)}>{n === Infinity ? "全件" : n}</option>)}
          </select>
        </label>
        <span className="text-[10px] text-slate-400/70 tabular-nums">{combos.length}件中 {show.length}件</span>
      </div>
      <div className="space-y-1 px-1 max-h-[46vh] overflow-y-auto">
        {show.map((c, i) => {
          const policy = getComboPolicy(policies, c.comboKey);
          const rowBg = policy === "block" ? "bg-rose-500/8"
            : policy === "alt" ? "bg-fuchsia-500/8"
            : "";
          return (
            <div key={c.comboKey}
              className={["flex items-center gap-x-2 gap-y-1 flex-wrap px-1.5 py-1 rounded border border-white/8 transition-colors", rowBg].join(" ")}>
              {/* 順位 + リスク */}
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-[12px] text-slate-400 font-mono tabular-nums w-6 text-right">{i + 1}.</span>
                <span className={["text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none", riskCls(c.risk)].join(" ")}>
                  {riskLabel(c.risk)}
                </span>
              </span>
              {/* モチーフチップ群 */}
              <span className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
                {c.motifLabels.map((label, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="text-slate-400 text-[11px]">＋</span>}
                    <span className="text-[12px] px-1.5 py-0.5 rounded border border-violet-400/40 bg-violet-400/10 text-violet-100 leading-none">
                      {label}
                    </span>
                  </span>
                ))}
              </span>
              {/* 出現率 + 件数 */}
              <span className="flex items-baseline gap-1 shrink-0 tabular-nums">
                <span className="text-[13px] text-white font-bold leading-none">{rate(c.count)}<span className="text-[10px] text-slate-400 font-normal">%</span></span>
                <span className="text-[11px] text-slate-400 leading-none">{c.count}回</span>
              </span>
              {/* 操作 */}
              <span className="flex items-center gap-1 shrink-0">
                <ComboPolicyBtn current={policy} target="block" color="rose"    label="🚫 今後出さない"
                  onClick={() => onChange(c.comboKey, policy === "block" ? "allow" : "block")} />
                <ComboPolicyBtn current={policy} target="alt"   color="fuchsia" label="🎭 別ジャンル化"
                  onClick={() => onChange(c.comboKey, policy === "alt" ? "allow" : "alt")} />
                <ComboPolicyBtn current={policy} target="allow" color="emerald" label="許可"
                  onClick={() => onChange(c.comboKey, "allow")} />
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── セクション：AIコメント ────────────────────────────────────────────────────

function AiCommentSection({ comment }: { comment: string }) {
  if (!comment) return null;
  const paragraphs = comment.split("\n\n").filter(Boolean);
  // 意味に応じて色分け：推奨＝緑 / 偏り・頻発の注意＝黄 / それ以外＝白
  const lineClass = (p: string): string => {
    if (p.includes("推奨")) return "text-emerald-300 font-semibold";
    if (p.includes("頻発") || p.includes("偏") || p.includes("注意")) return "text-amber-200";
    return "text-slate-100";
  };
  return (
    <>
      <SectionTitle icon="💬">AIコメント</SectionTitle>
      <div className="mx-1 mb-1 rounded-lg border border-violet-400/35 bg-violet-400/10 px-3 py-2.5 space-y-2">
        {paragraphs.map((p, i) => (
          <p key={i} className={["text-[13px] leading-relaxed", lineClass(p)].join(" ")}>
            {p}
          </p>
        ))}
      </div>
    </>
  );
}

// ── セクション：頻出ランキング + 出現制御 ────────────────────────────────────

function FrequencyRanking({
  topMotifs, levels, onLevelChange, onBulkLevel, onClearNg,
  onAutoAdjust, onUndoAutoAdjust, canUndoAuto, changedIds, windowSize,
}: {
  topMotifs: MotifCount[];
  levels: LevelMap;
  onLevelChange: (id: string, lv: MotifLevel) => void;
  onBulkLevel: (ids: string[], lv: MotifLevel) => void;
  onClearNg: () => void;
  onAutoAdjust: (preserveManual: boolean) => void;
  onUndoAutoAdjust: () => void;
  canUndoAuto: boolean;
  changedIds: ReadonlySet<string>;
  windowSize: number;
}) {
  const [count, setCount] = useState<number>(20);
  const max = topMotifs[0]?.totalCount ?? 1;
  if (topMotifs.length === 0) return null;
  const show = count === Infinity ? topMotifs : topMotifs.slice(0, count);
  const rate = (n: number) => (windowSize > 0 ? Math.round((n / windowSize) * 100) : 0);

  const top5  = topMotifs.slice(0, 5).map((m) => m.motif.id);
  const top10 = topMotifs.slice(0, 10).map((m) => m.motif.id);
  const allIds = topMotifs.map((m) => m.motif.id);

  return (
    <>
      <SectionTitle icon="📊">頻出要素一覧（出現制御・出現率順）</SectionTitle>
      <div className="flex items-center gap-2 px-1 pb-1">
        <label className="flex items-center gap-1 text-[10px] text-slate-400">件数
          <select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}
            className="rounded border border-white/15 bg-bg-base/60 text-[11px] text-slate-100 px-1.5 py-1 focus:outline-none">
            {[20, 50, 100, Infinity].map((n) => <option key={n} value={String(n)}>{n === Infinity ? "全件" : n}</option>)}
          </select>
        </label>
        <span className="text-[10px] text-slate-400/70 tabular-nums">{topMotifs.length}件中 {show.length}件</span>
      </div>

      {/* 自動調整（メインアクション） */}
      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5">
        <button type="button"
          onClick={() => onAutoAdjust(true)}
          title="頻出回数に応じて 0〜5 を自動設定（手動設定済みは保護）"
          className="text-[12px] font-bold px-2.5 py-1 rounded-lg border border-violet-400/60 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30 transition shadow-[0_0_8px_rgba(139,92,246,0.25)]">
          ✨ 重複を自動調整
        </button>
        <button type="button"
          onClick={() => {
            if (confirm("手動で設定した出現制御も含めて、すべて自動調整で上書きします。よろしいですか？")) {
              onAutoAdjust(false);
            }
          }}
          title="手動設定も含めて全件を自動調整で上書きする"
          className="text-[11px] px-2 py-1 rounded-lg border border-amber-400/40 bg-amber-400/8 text-amber-200 hover:bg-amber-400/18 transition">
          全上書きで調整
        </button>
        {canUndoAuto && (
          <button type="button"
            onClick={onUndoAutoAdjust}
            title="直前の自動調整を取り消す"
            className="text-[11px] px-2 py-1 rounded-lg border border-sky-400/40 bg-sky-400/8 text-sky-200 hover:bg-sky-400/18 transition">
            ↶ 自動調整を元に戻す
          </button>
        )}
        <span className="text-[10px] text-text-muted/60 leading-snug ml-1">
          頻出回数に応じて自動で 0〜5 を設定（NGはNG指定に反映）
        </span>
      </div>

      {/* 一括操作（細かい調整用） */}
      <div className="flex flex-wrap gap-1 px-1 pb-1.5">
        <span className="text-[10px] text-slate-400 self-center mr-0.5">一括:</span>
        <button type="button" onClick={() => onBulkLevel(top5, 1)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-orange-400/40 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20 transition leading-none">
          上位5件を強抑制
        </button>
        <button type="button" onClick={() => onBulkLevel(top10, 3)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-400/40 bg-yellow-400/10 text-yellow-100 hover:bg-yellow-400/20 transition leading-none">
          上位10件を注意
        </button>
        <button type="button" onClick={onClearNg}
          className="text-[10px] px-1.5 py-0.5 rounded border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition leading-none">
          完全NG解除
        </button>
        <button type="button" onClick={() => onBulkLevel(allIds, 4)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 transition leading-none">
          全部許可
        </button>
      </div>

      <div className="space-y-px px-1 ipm-list max-h-[42vh] overflow-y-auto">
        {show.map((mc) => {
          const level = getLevel(levels, mc.motif.id);
          const m = levelMeta(level);
          const rowBg = level <= 1 ? "bg-rose-500/8" : level <= 2 ? "bg-amber-500/6" : level === 5 ? "bg-cyan-500/6" : "";
          const changed = changedIds.has(mc.motif.id);
          return (
            <div key={mc.motif.id}
              className={[
                "flex items-center gap-x-2 py-1 px-1 rounded transition-colors flex-wrap",
                rowBg,
                changed ? "ring-2 ring-violet-400/70 animate-pulse" : "",
              ].join(" ")}>
              {/* 名前 + カテゴリ */}
              <span className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[13px] text-slate-100 font-medium leading-snug truncate">
                  {mc.motif.label}
                </span>
                <span className="text-[11px] text-slate-400 leading-none shrink-0">
                  {mc.motif.category}
                </span>
              </span>
              {/* バー（長さ=回数, 色=制御レベル）+ 回数 */}
              <MiniBar count={mc.totalCount} max={max} level={level} />
              {/* 出現率 */}
              <span className="text-[10px] text-slate-400 tabular-nums w-10 text-right shrink-0">{rate(mc.totalCount)}%</span>
              {/* 現在レベルの短ラベル */}
              <span className={["text-[10px] font-bold leading-none w-12 text-right shrink-0", level <= 1 ? "text-rose-300" : level <= 3 ? "text-amber-200" : level === 5 ? "text-cyan-200" : "text-emerald-300"].join(" ")}>
                {level}:{m.label}
              </span>
              {/* 出現制御コントロール */}
              <LevelControl level={level} onChange={(lv) => onLevelChange(mc.motif.id, lv)} />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── セクション：未開拓ジャンル ────────────────────────────────────────────────

function UntappedGenresSection({ genres }: { genres: UntappedGenre[] }) {
  const show = genres.slice(0, 6);
  if (show.length === 0) return null;
  return (
    <>
      <Divider />
      <SectionTitle icon="🎯">次に狙うべき方向（未開拓度）</SectionTitle>
      <div className="space-y-px px-1">
        {show.map((g) => (
          <div key={g.id}
            className="grid grid-cols-[1fr_auto] gap-x-2 items-center py-1 px-1">
            <span className="text-[13px] text-slate-100 font-medium leading-snug truncate">
              {g.label}
              {g.detectedCount > 0 && (
                <span className="text-[11px] text-slate-400 ml-1.5 font-normal">
                  （直近{g.detectedCount}回）
                </span>
              )}
            </span>
            <UntappedBar score={g.untappedScore} />
          </div>
        ))}
      </div>
    </>
  );
}

// ── セクション：類似履歴 ──────────────────────────────────────────────────────

function SimilarHistorySection({ items }: { items: FullHistoryAnalysis["similarItems"] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Divider />
      <SectionTitle icon="🔍">類似した過去の生成</SectionTitle>
      <div className="space-y-1 px-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 py-0.5">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt=""
                className="w-8 h-8 rounded object-cover shrink-0 border border-text-muted/15" />
            ) : (
              <div className="w-8 h-8 rounded bg-bg-border/50 shrink-0 flex items-center justify-center text-[10px] text-text-muted/30">
                🖼️
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-slate-300 font-medium leading-none">{item.dateKey}</span>
                {item.isFavorite && <span className="text-[11px] text-amber-300">♥ お気に入り</span>}
                <span className="text-[12px] text-rose-300 ml-auto shrink-0">
                  {"★".repeat(Math.min(item.matchScore, 5))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.matchedMotifs.slice(0, 4).map((label) => (
                  <span key={label}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-rose-400/15 text-rose-200 leading-none border border-rose-400/30">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── セクション：傾向レーダー ──────────────────────────────────────────────────

function BiasRadar({ radarData }: { radarData: RadarEntry[] }) {
  if (!radarData.some((r) => r.stars > 0)) return null;
  return (
    <>
      <Divider />
      <SectionTitle icon="📈">傾向レーダー</SectionTitle>
      <div className="space-y-1 px-1 pb-1">
        {radarData.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            <span className="text-[13px] leading-none shrink-0">{entry.emoji}</span>
            <span className="text-[12px] text-slate-200 font-medium leading-none w-28 shrink-0 truncate">
              {entry.label}
            </span>
            <span className={[
              "text-[14px] leading-none font-mono tracking-tight",
              entry.stars >= 4 ? "text-rose-400"
              : entry.stars >= 3 ? "text-orange-400"
              : entry.stars >= 2 ? "text-amber-300"
              : "text-slate-400",
            ].join(" ")}>
              {starsLabel(entry.stars)}
            </span>
            <span className="text-[11px] text-slate-400 leading-none">{entry.count}回</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── セクション：好みの傾向 ────────────────────────────────────────────────────

function FavoritesNote({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <>
      <Divider />
      <SectionTitle icon="♥">好みの傾向</SectionTitle>
      <div className="flex flex-wrap gap-1 px-1 pb-0.5">
        {labels.map((label) => (
          <span key={label}
            className="text-[12px] px-2 py-0.5 rounded border border-amber-400/40 bg-amber-400/12 text-amber-200 leading-snug">
            ♥ {label}
          </span>
        ))}
      </div>
    </>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────────────────

// F2: React.memo でラップ。画像解析中の進捗更新（F1）で App が再レンダーされても、
// props が変わっていなければパネル全体の再描画をスキップする。
// props 安定化（App 側の useCallback 化）と組み合わせて効果が出る。
function DuplicateAnalysisPanelInner({
  biasResult, historyAnalysis, isAnalyzing,
  levels, policyApplied,
  onLevelChange, onApplyPolicies, onUnapplyPolicies, onResetPolicies, onBulkLevel, onClearNg,
  onAutoAdjust, onUndoAutoAdjust, canUndoAuto, changedIds,
  comboPolicies, onComboPolicyChange, onRunBiasCheck,
  colorAnalysis, colorSuccess, skyveilSlot, candidates = [], onIgnoreTerm,
  colorWeights, onColorWeightChange, onColorWeightsReset,
  onColorAutoAdjust, onColorUndoAdjust, canColorUndo, colorChangedKeys,
  colorWindowSize, onColorWindowSizeChange,
  imageAnalysis, onStartImageAnalysis, imageAnalyzeProgress, onCancelImageAnalysis,
  ratingAnalysis, ratingTrends, successRankings,
  preferenceProfile, profileSampleCount,
  agent, onAgentAction,
  onAutoFix, onReroll, onResetBias, onDismiss, asModal, onCenterClose,
  initialTab, onUseCalendarTheme,
  analysisStats, activeScopes, favoriteProfile, favoriteLearnEnabled,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = asModal ? true : expanded;
  // 全画面モーダル（分析センター）時は Esc で閉じる
  useEffect(() => {
    if (!asModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCenterClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asModal, onCenterClose]);
  const [tab, setTab] = useState<"dup" | "discovery" | "agent" | "color" | "image" | "pref" | "rank" | "skyveil" | "plan">(initialTab ?? "dup");
  // 🔭発見タブ（未開拓発見担当）
  const [discSearch, setDiscSearch] = useState("");
  const [discCount, setDiscCount] = useState<number>(20);

  // 画像分析タブを開いた時に解析を発火（BUG-18: 一度きりの発火）。
  // onStartImageAnalysis は analysisLive の identity 変化で頻繁に作り直されるため、
  // これを effect の dep に入れると「発火→analysisLive更新→onStartImageAnalysis再生成→再発火」の
  // 無限ループになる。最新参照を ref に退避し、effect は tab/expanded のみに依存させる。
  const startImageRef = useRef(onStartImageAnalysis);
  useEffect(() => { startImageRef.current = onStartImageAnalysis; });
  useEffect(() => {
    if (tab === "image" && isExpanded) startImageRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStartImageAnalysis は ref 経由（ループ防止のため意図的に除外）
  }, [tab, isExpanded]);

  // 反映時のサマリー（制御中 = 非4 件数 / NG件数）
  const { controlled: controlledCount, ng: ngCount } = countLevels(levels);
  const { block: comboBlockCount, alt: comboAltCount } = countComboPolicies(comboPolicies);
  const { block: colorBlockCount, suppress: colorSuppressCount, boost: colorBoostCount } = countWeights(colorWeights);
  const hasStagedPolicies = controlledCount > 0 || comboBlockCount + comboAltCount > 0;

  // ヘッダーデータ
  const risk = biasResult?.risk ?? "low";
  const dupScore = biasResult?.duplicateScore ?? 0;
  const novScore = biasResult?.noveltyScore ?? 100;
  const borderCls = biasRiskBorderClass(risk);
  const riskTextCls = biasRiskTextClass(risk);
  const compact3 = biasResult?.topMotifs.slice(0, 3) ?? [];
  const ha = historyAnalysis;

  // ── 現在生成に「反映中」の要素を名前付きで集計（スコープ考慮） ──
  // policyApplied のときだけ生成に効く。変更対象外の軸は「未反映」として分ける。
  const AXIS_JP: Record<string, string> = {
    background: "背景", outfit: "衣装", hair: "髪", camera: "カメラ",
    lighting: "ライティング", pose: "ポーズ", props: "小物", foreground: "前景",
  };
  // BUG-5: imageAnalyzer の axis は日本語（背景/衣装/髪型/カメラ/ライティング）だが
  // activeScopes(=scopeSet) は英語（background/outfit/...）。そのまま has() すると常に不一致になり
  // 「反映中」バナーが誤って「未反映（変更対象外）」と表示される。日本語軸→英語scopeキーで揃える。
  const IMG_AXIS_TO_SCOPE: Record<string, string> = {
    "背景": "background", "衣装": "outfit", "髪型": "hair", "髪": "hair",
    "カメラ": "camera", "ライティング": "lighting",
    "ポーズ": "pose", "前景": "foreground", "小物": "props",
  };
  const scopeSet = new Set(activeScopes ?? []);
  const axisInScope = (axis: string) => {
    if (scopeSet.size === 0) return true;
    const scopeKey = IMG_AXIS_TO_SCOPE[axis] ?? axis; // 既に英語キーならそのまま
    return scopeSet.has(scopeKey);
  };

  // 画像分析：頻出＝抑制／未開拓＝推奨。変更対象外はスキップ一覧へ。
  const imgSuppress: string[] = [];
  const imgSkipped:  string[] = [];
  for (const o of (imageAnalysis?.overusedCategories ?? []).slice(0, 8)) {
    const label = `${AXIS_JP[o.axis] ?? o.axis}:${o.label}`;
    if (axisInScope(o.axis)) imgSuppress.push(label);
    else imgSkipped.push(`${AXIS_JP[o.axis] ?? o.axis}`);
  }
  const imgBoost: string[] = [];
  for (const u of (imageAnalysis?.underusedCategories ?? []).slice(0, 8)) {
    if (axisInScope(u.axis)) imgBoost.push(`${AXIS_JP[u.axis] ?? u.axis}:${u.label}`);
  }
  // 重複分析：抑制モチーフ(level<=2)／優先モチーフ(level5)
  const motifAvoid:  string[] = [];
  const motifPrefer: string[] = [];
  for (const m of (ha?.topMotifs ?? [])) {
    const lv = getLevel(levels, m.motif.id);
    if (lv <= 2) motifAvoid.push(m.motif.label);
    else if (lv >= 5) motifPrefer.push(m.motif.label);
  }
  // 構成：今後出さない
  const comboBlocked: string[] = [];
  for (const c of (ha?.topCombos ?? [])) {
    if (getComboPolicy(comboPolicies, c.comboKey) === "block") comboBlocked.push(c.motifLabels.join("＋"));
  }
  // お気に入り傾向（ONのときのみ）
  const favTraits = (favoriteLearnEnabled && favoriteProfile) ? favoriteProfile.traitPhrases.slice(0, 6) : [];
  const skippedAxes = Array.from(new Set(imgSkipped));

  return (
    <div className={asModal ? "h-full flex flex-col min-h-0" : ["rounded-xl border transition-all", borderCls].join(" ")}>

      {/* ── ヘッダー（常時表示） ─────────────────────────────────── */}
      <div className="px-3.5 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[15px] leading-none">📊</span>
          <span className="text-[15px] font-bold text-white leading-none">分析センター</span>
          <span className={["text-[13px] font-black leading-none", riskTextCls].join(" ")}>
            {biasRiskLabel(risk)}
          </span>
          <span className="flex items-center gap-1.5 leading-none">
            <span className="text-[12px] text-slate-300">重複度</span>
            <span className={["text-[16px] font-black", riskTextCls].join(" ")}>{dupScore}</span>
            <span className="text-[11px] text-slate-400">/100</span>
            <span className="text-slate-400 text-[11px] mx-0.5">·</span>
            <span className="text-[12px] text-slate-300">新規性</span>
            <span className={[
              "text-[16px] font-black",
              novScore >= 60 ? "text-emerald-300" : novScore >= 35 ? "text-amber-300" : "text-rose-300",
            ].join(" ")}>{novScore}</span>
            <span className="text-[11px] text-slate-400">/100</span>
          </span>
          {analysisStats ? (
            <span className="text-[11px] text-slate-400 leading-none" title="偏り検出は直近90日のみが対象。お気に入り傾向・評価学習は全期間が対象です。">
              分析対象：直近{analysisStats.windowDays}日 / {analysisStats.promptCount}件
              <span className="text-slate-400 mx-1">·</span>
              画像解析 {analysisStats.imageAnalyzedCount}件
              <span className="text-slate-400 mx-1">·</span>
              評価 {analysisStats.ratedCount}件
              <span className="text-slate-400 ml-1">（全{analysisStats.totalItems}件保存）</span>
            </span>
          ) : ha && (
            <span className="text-[11px] text-slate-400 leading-none">
              分析対象：直近{ha.windowDays}日 / {ha.windowSize}件
            </span>
          )}
          {policyApplied && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-violet-400/50 bg-violet-400/15 text-violet-100 leading-none shrink-0">
              反映中
            </span>
          )}
          {isAnalyzing && (
            <span className="text-[11px] text-slate-300 animate-pulse leading-none">分析中…</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!asModal && (
            <button type="button" onClick={() => setExpanded((v) => !v)}
              title={expanded ? "折りたたむ" : "詳細を開く"}
              className="text-[13px] text-slate-400 hover:text-slate-100 transition px-1 leading-none">
              {expanded ? "▲" : "▼"}
            </button>
          )}
          <button type="button" onClick={asModal ? onCenterClose : onDismiss} title="閉じる"
            className="text-[13px] px-2 py-1 rounded border border-bg-border bg-bg-base/60 text-slate-400 hover:text-slate-100 transition leading-none">
            {asModal ? "✕ 閉じる" : "✕"}
          </button>
        </div>
      </div>

      {/* ── コンパクト：今回の偏り上位3件（インライン時のみ。全画面では非表示）── */}
      {!asModal && compact3.length > 0 && (
        <div className="px-3.5 pb-2 flex flex-wrap gap-1.5">
          {compact3.map((m) => (
            <span key={m.motif.id}
              className={[
                "inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded border leading-snug",
                m.inCurrentBatch && m.historyCount > 0
                  ? "border-rose-400/50 bg-rose-400/15 text-rose-100"
                  : "border-white/15 bg-white/5 text-slate-300",
              ].join(" ")}>
              {m.motif.label}
              {m.historyCount > 0 && (
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {m.historyCount}/{m.historyTotal}
                </span>
              )}
              {m.inCurrentBatch && (
                <span className="text-[10px] font-bold text-rose-300">今回</span>
              )}
            </span>
          ))}
          {(biasResult?.topMotifs?.length ?? 0) > 3 && !expanded && (
            <button type="button" onClick={() => setExpanded(true)}
              className="text-[12px] text-slate-400 hover:text-slate-100 transition leading-none font-medium">
              +{(biasResult?.topMotifs.length ?? 0) - 3}件 →
            </button>
          )}
        </div>
      )}

      {/* ── 展開パネル（全画面時は flex-1 でスクロール）──────────────── */}
      {isExpanded && (
        <div className={asModal ? "flex-1 min-h-0 overflow-y-auto border-t border-white/12" : "border-t border-white/12"}>
          {/* タブスイッチャー */}
          <div className="flex items-center gap-1 flex-wrap px-3 pt-2 pb-1 border-b border-white/8 bg-bg-base/30">
            <button
              type="button"
              onClick={() => setTab("dup")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none",
                tab === "dup"
                  ? "bg-violet-500/20 text-violet-100 border border-violet-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              🔬 重複分析
            </button>
            <button
              type="button"
              onClick={() => setTab("discovery")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "discovery"
                  ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              🔭 発見（{candidates.length}）
            </button>
            <button
              type="button"
              onClick={() => setTab("agent")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "agent"
                  ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              🤖 AI分析エージェント
              {agent && agent.problems.some((p) => p.severity === "high") && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("color")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "color"
                  ? "bg-amber-500/20 text-amber-100 border border-amber-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              🎨 色分析
              {colorAnalysis && colorAnalysis.biasWarnings.some((w) => w.severity === "high") && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              )}
              {(colorBlockCount + colorSuppressCount + colorBoostCount) > 0 && (
                <span className="text-[9px] text-amber-200/70 leading-none">
                  ({colorBlockCount + colorSuppressCount + colorBoostCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("image")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "image"
                  ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              📸 画像分析
              {imageAnalysis && imageAnalysis.clusters.length > 0 && (
                <span className="text-[9px] text-emerald-200/70 leading-none">
                  ({imageAnalysis.clusters[0]?.size}枚被り)
                </span>
              )}
              {imageAnalyzeProgress && imageAnalyzeProgress.total > 0 && imageAnalyzeProgress.done < imageAnalyzeProgress.total && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("pref")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "pref"
                  ? "bg-pink-500/20 text-pink-100 border border-pink-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              💡 評価集計
              {ratingAnalysis?.preferenceReport.active && (
                <span className="text-[9px] text-pink-200/70 leading-none">
                  ({ratingAnalysis.preferenceReport.totalAxisRatings})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("rank")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "rank"
                  ? "bg-amber-500/20 text-amber-100 border border-amber-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              🏆 成功/失敗
              {successRankings && successRankings.composition.success.length > 0 && (
                <span className="text-[9px] text-amber-200/70 leading-none">
                  ({successRankings.composition.success.length + successRankings.composition.fail.length})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("skyveil")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "skyveil"
                  ? "bg-violet-500/20 text-violet-100 border border-violet-400/45"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              🧬 あなたの好み
            </button>
            <button
              type="button"
              onClick={() => setTab("plan")}
              className={[
                "text-[12px] font-bold px-2.5 py-1 rounded-md transition leading-none flex items-center gap-1",
                tab === "plan"
                  ? "bg-accent/20 text-accent border border-accent/50"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              📅 1ヶ月生成カレンダー
            </button>
          </div>

          <div className="px-3 overflow-y-auto max-h-[62vh]">

            {/* === AI分析タブ === */}
            {tab === "agent" && <AgentSection agent={agent} onAction={onAgentAction} />}

            {/* === 画像分析タブ === */}
            {tab === "image" && (
              <ImageAnalysisSection
                analysis={imageAnalysis}
                progress={imageAnalyzeProgress}
                onCancel={onCancelImageAnalysis}
              />
            )}

            {/* === 評価集計タブ（軸別👍👎集計）。skyveil好みの分析・反映は SkyveilBar に集約済み === */}
            {tab === "pref" && (
              <PreferenceReportSection
                ratingAnalysis={ratingAnalysis}
                ratingTrends={ratingTrends ?? null}
                profile={preferenceProfile}
                profileSampleCount={profileSampleCount}
              />
            )}

            {/* === 🏆 成功/失敗ランキングタブ（③・勝ちパターン/神引き候補発見）=== */}
            {tab === "rank" && (
              <RankingSection rankings={successRankings ?? null} colorSuccess={colorSuccess ?? null} />
            )}

            {/* === 🧬 skyveil好みAI タブ（好み最適化担当・生成に影響＝発見系とは別系統）=== */}
            {tab === "skyveil" && (
              <div className="space-y-2 pb-2">
                <div className="rounded-lg border border-violet-400/45 bg-violet-500/10 px-3 py-2 text-[12px] text-violet-100 leading-snug">
                  ℹ これは <strong>確認用（読み取り専用）</strong>。反映ON/OFF・強度・更新・自動学習・リセット・削除などの<strong>操作は、生成画面の「あなたの好み（skyveil）」</strong>で行えます。重複分析・🔭発見・神引き候補（＝未開拓発見担当）とは別系統です。
                </div>
                {skyveilSlot ?? <p className="text-[12px] text-slate-400 px-1">あなたの好み を読み込めませんでした。</p>}
              </div>
            )}

            {/* === 📅 1ヶ月生成カレンダー タブ（Phase1: 現行カレンダーを移設・分析ドリブンのA案/B案はPhase2）=== */}
            {tab === "plan" && (
              onUseCalendarTheme
                ? <MonthlyCalendarSection onUseTheme={(hint) => onUseCalendarTheme(hint)} />
                : <p className="text-[12px] text-slate-400 px-1 py-2">1ヶ月生成カレンダーを読み込めませんでした。</p>
            )}

            {/* === 🔭 発見タブ（未開拓発見担当・監視外の頻出新語）=== */}
            {tab === "discovery" && (() => {
              const q = discSearch.trim().toLowerCase();
              const filtered = q ? candidates.filter((c) => c.term.includes(q)) : candidates;
              const shown = discCount === Infinity ? filtered : filtered.slice(0, discCount);
              return (
                <div className="space-y-2 pb-2">
                  <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100 leading-snug">
                    🔭 <strong>未開拓発見担当</strong>。監視外で頻出し始めた新語＝新ジャンル/神引き候補。好み最適化（skyveil好みAI）とは別系統です。🚫無視でノイズ除去。
                  </div>
                  <div className="flex items-center gap-2 flex-wrap px-1">
                    <label className="flex items-center gap-1 text-[10px] text-slate-400">件数
                      <select value={String(discCount)} onChange={(e) => setDiscCount(Number(e.target.value))}
                        className="rounded border border-white/15 bg-bg-base/60 text-[11px] text-slate-100 px-1.5 py-1 focus:outline-none">
                        {[20, 50, 100, Infinity].map((n) => <option key={n} value={String(n)}>{n === Infinity ? "全件" : n}</option>)}
                      </select>
                    </label>
                    <input value={discSearch} onChange={(e) => setDiscSearch(e.target.value)} placeholder="🔎 候補語を検索"
                      className="flex-1 min-w-[140px] rounded border border-white/15 bg-bg-base/60 text-[12px] text-slate-100 px-2 py-1 focus:outline-none" />
                    <span className="text-[10px] text-slate-400/70 tabular-nums">{filtered.length}件中 {shown.length}件</span>
                  </div>
                  <div className="px-1 max-h-[52vh] overflow-y-auto">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-bg-panel">
                        <tr className="text-slate-400/80 border-b border-white/10">
                          <th className="text-left font-semibold px-2 py-1">候補語</th>
                          <th className="text-right font-semibold px-2 py-1 w-14">出現</th>
                          <th className="text-left font-semibold px-2 py-1">サンプル文脈</th>
                          <th className="text-right font-semibold px-2 py-1 w-16">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((c) => (
                          <tr key={c.term} className="border-b border-white/5">
                            <td className="px-2 py-1.5 text-slate-100 font-medium">{c.term}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-slate-200">{c.count}</td>
                            <td className="px-2 py-1.5 text-slate-400/70"><span title={c.sampleContexts.join(" / ")}>{c.sampleContexts[0] ?? "—"}</span></td>
                            <td className="px-2 py-1.5 text-right">
                              <button type="button" onClick={() => onIgnoreTerm?.(c.term)} title="今後の候補から無視"
                                className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 text-slate-400 hover:text-rose-300 hover:border-rose-400/40 transition">🚫 無視</button>
                            </td>
                          </tr>
                        ))}
                        {shown.length === 0 && (
                          <tr><td colSpan={4} className="px-2 py-6 text-center text-[12px] text-slate-500">候補がありません（履歴が少ない／すべて監視済み・無視済み）。</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* === 色分析タブ（生成制御センター） === */}
            {tab === "color" && (
              <ColorAnalysisSection
                analysis={colorAnalysis}
                colorSuccess={colorSuccess ?? null}
                weights={colorWeights}
                onWeightChange={onColorWeightChange}
                onReset={onColorWeightsReset}
                onAutoAdjust={onColorAutoAdjust}
                onUndoAdjust={onColorUndoAdjust}
                canUndo={canColorUndo}
                changedKeys={colorChangedKeys}
                windowSize={colorWindowSize}
                onWindowSizeChange={onColorWindowSizeChange}
              />
            )}

            {/* === 重複分析タブ === */}
            {tab === "dup" && <>

            {/* 📋 読み取り専用の総括＋🔎 AIっぽさ再チェック（実行はここ・生成画面はバッジ/誘導のみ） */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2">
              <span className="text-[11px] text-violet-100/90 leading-snug">
                📋 ここは<strong>読み取り専用</strong>の集計です。好み等は<strong>自動反映されません</strong>。反映は<strong>生成画面</strong>から。
              </span>
              {onRunBiasCheck && (
                <button type="button" onClick={onRunBiasCheck}
                  className="shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-lg border border-rose-400/55 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 transition">
                  🔎 AIっぽさを再チェック
                </button>
              )}
            </div>

            {/* AIコメント — トップに目立つように */}
            {ha && <AiCommentSection comment={ha.aiComment} />}

            {/* 頻出構成（出現率順・件数20/50/100/全件・スクロール） */}
            {ha && ha.topCombos.length > 0 && (
              <ComboRanking
                combos={ha.topCombos}
                windowSize={ha.windowSize}
                policies={comboPolicies}
                onChange={onComboPolicyChange}
              />
            )}

            {/* 🧬 複合構成分析（サイズ別＋ドリルダウン・docs/32 A2-1b） */}
            {ha && ha.itemMotifSets && ha.itemMotifSets.length > 0 && (
              <CompositionAnalysis
                itemSets={ha.itemMotifSets}
                motifCounts={ha.motifCounts}
                windowSize={ha.windowSize}
              />
            )}

            {/* 警告（重複度85+ 時のみ） */}
            {biasResult && biasResult.warnings.length > 0 && (
              <div className="pt-1 pb-1 space-y-1 px-1">
                {biasResult.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-200/70 leading-snug">⚠️ {w}</p>
                ))}
                {dupScore >= 85 && (
                  <p className="text-[11px] text-rose-300/80 font-semibold leading-snug">
                    🔴 重複度 85+ — 再抽選を強く推奨します。
                  </p>
                )}
              </div>
            )}

            {/* 頻出ランキング（0〜5 出現制御 + 自動調整 + 一発NG） */}
            {ha && ha.topMotifs.length > 0 && (
              <FrequencyRanking
                topMotifs={ha.topMotifs}
                windowSize={ha.windowSize}
                levels={levels}
                onLevelChange={onLevelChange}
                onBulkLevel={onBulkLevel}
                onClearNg={onClearNg}
                onAutoAdjust={onAutoAdjust}
                onUndoAutoAdjust={onUndoAutoAdjust}
                canUndoAuto={canUndoAuto}
                changedIds={changedIds}
              />
            )}

            {/* 未開拓ジャンル */}
            {ha && <UntappedGenresSection genres={ha.untappedGenres} />}

            {/* 類似履歴 */}
            {ha && <SimilarHistorySection items={ha.similarItems} />}

            {/* 傾向レーダー */}
            {ha && <BiasRadar radarData={ha.radarData} />}

            {/* お気に入り傾向 */}
            {ha && <FavoritesNote labels={ha.favoriteMotifs} />}

            {/* データなし */}
            {!ha && !biasResult && (
              <p className="py-3 text-center text-[11px] text-text-muted/60">
                生成後に分析が始まります
              </p>
            )}

            </>}{/* end of tab === "dup" */}
          </div>

          {/* ── フッター：反映状態 + 一括操作 ──────────────── */}
          <div className="border-t border-text-muted/10 px-3.5 py-2.5 space-y-2">

            {/* 反映状態バナー（名前付き・現在生成に効いている要素） */}
            {policyApplied ? (
              <div className="rounded-lg border border-violet-400/30 bg-violet-400/8 px-2.5 py-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-violet-100 leading-none">✓ 現在、生成に反映中</span>
                  <button type="button" onClick={onUnapplyPolicies}
                    className="text-[11px] text-violet-200/60 hover:text-violet-100 underline leading-none whitespace-nowrap">
                    反映を解除
                  </button>
                </div>

                {/* 回避中 */}
                {(motifAvoid.length > 0 || comboBlocked.length > 0) && (
                  <ReflectRow color="rose" label="回避中" items={[
                    ...motifAvoid, ...comboBlocked,
                  ]} />
                )}
                {/* 画像分析から（抑制） */}
                {imgSuppress.length > 0 && (
                  <ReflectRow color="sky" label="画像分析から抑制" items={imgSuppress} />
                )}
                {/* 優先中 */}
                {(motifPrefer.length > 0 || imgBoost.length > 0) && (
                  <ReflectRow color="emerald" label="優先中" items={[...motifPrefer, ...imgBoost]} />
                )}
                {/* お気に入りから */}
                {favTraits.length > 0 && (
                  <ReflectRow color="amber" label="お気に入りから" items={favTraits} />
                )}
                {/* スコープ外で未反映の軸 */}
                {skippedAxes.length > 0 && (
                  <p className="text-[10px] text-text-muted/55 leading-snug pt-0.5">
                    ⚠ {skippedAxes.join("・")}は変更対象外のため、回避は今回は未反映です。
                  </p>
                )}
                {/* 何も具体名が無い時のフォールバック（カウント表示） */}
                {motifAvoid.length === 0 && comboBlocked.length === 0 && imgSuppress.length === 0 &&
                 motifPrefer.length === 0 && imgBoost.length === 0 && favTraits.length === 0 && (
                  <p className="text-[11px] text-violet-200/70 leading-snug">
                    出現制御を反映中（制御 {controlledCount}件 / 完全NG {ngCount}件
                    {(comboBlockCount + comboAltCount > 0) && <> ・構成 禁止 {comboBlockCount}件 / 別ジャンル化 {comboAltCount}件</>}）
                  </p>
                )}
              </div>
            ) : hasStagedPolicies ? (
              <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-2.5 py-1.5">
                <p className="text-[11px] text-amber-200/70 leading-snug">
                  編集中（要素 制御 {controlledCount}件 / 完全NG {ngCount}件
                  {(comboBlockCount + comboAltCount > 0) && <> ・構成 禁止 {comboBlockCount}件 / 別ジャンル化 {comboAltCount}件</>}）。
                  <span className="text-amber-300/80 font-semibold">「提案を反映」</span>を押すと生成に効きます。
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-text-muted/60 leading-snug px-0.5">
                頻出構成は「🚫 今後出さない」「🎭 別ジャンル化」、頻出要素は 0〜5 段階で設定。「提案を反映」で生成に効かせます。
              </p>
            )}

            {/* 反映・リセット */}
            <div className="flex flex-wrap gap-1.5">
              <ActionBtn icon="✓" label={policyApplied ? "再反映" : "提案を反映"}
                onClick={onApplyPolicies}
                title="出現制御レベルを ngList / 指示に反映する"
                cls="border-violet-500/60 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 shadow-[0_0_10px_rgba(139,92,246,0.2)]" />
              <ActionBtn icon="🗑️" label="制御リセット" onClick={onResetPolicies}
                title="全モチーフの出現制御を許可(4)に戻す"
                cls="border-text-muted/30 bg-text-muted/5 text-text-muted/55 hover:bg-text-muted/10" />
            </div>

            {/* 補助アクション */}
            <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
              <ActionBtn icon="🔄" label="再抽選" onClick={onReroll}
                cls="border-sky-500/40 bg-sky-500/5 text-sky-300/80 hover:bg-sky-500/15" />
              <ActionBtn icon="🎭" label="別ジャンル化" onClick={onAutoFix}
                cls="border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-300/80 hover:bg-fuchsia-500/15" />
              <ActionBtn icon="🧹" label="偏り履歴クリア" onClick={onResetBias}
                cls="border-text-muted/25 bg-text-muted/5 text-text-muted/45 hover:bg-text-muted/10" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** F2: memo でラップ。画像解析の進捗更新（F1）で App が再レンダーされても
 *  props 不変時はパネル全体の再描画をスキップする。 */
export const DuplicateAnalysisPanel = memo(DuplicateAnalysisPanelInner);
