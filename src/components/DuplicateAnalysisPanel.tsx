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

import { useEffect, useState } from "react";
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
import type { RatingAnalysis } from "../lib/ratingAnalyzer";
import { type PreferenceProfile, profileSummaryLines, MIN_SAMPLES } from "../lib/preferenceProfile";
import type { ColorAnalysis, ColorAxis } from "../lib/colorAnalyzer";
import { COLOR_GROUPS, COLOR_AXES } from "../lib/colorAnalyzer";
import type { ColorWeight, ColorWeightMap, ColorAxisCtrl } from "../lib/colorPolicy";
import { WEIGHT_META, COLOR_AXIS_CTRL, getColorEntry, countWeights } from "../lib/colorPolicy";

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

  // ── 🎨 色分析（生成制御センター） ──
  /** 色分析結果（履歴×ウィンドウサイズで集計） */
  colorAnalysis:     ColorAnalysis | null;
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

  // ── 💡 好み分析（軸別👍👎 + 実 AI 分析） ──
  /** 評価分析（軸別👍👎の集計を含む） */
  ratingAnalysis:       RatingAnalysis | null;
  /** 実 Gemini 分析の結果プロファイル（null=未分析） */
  preferenceProfile:    PreferenceProfile | null;
  /** 分析実行中フラグ */
  analyzingProfile:     boolean;
  /** 直近の分析エラー */
  profileError:         string | null;
  /** サンプル可能件数（評価が1つでも付いている画像数） */
  profileSampleCount:   number;
  /** 分析実行ボタン */
  onRunPreferenceAnalysis: () => void;
  /** プロファイル削除（再分析準備） */
  onClearPreferenceProfile: () => void;
  /** 自動学習 ON/OFF */
  autoLearnEnabled: boolean;
  onToggleAutoLearn: (enabled: boolean) => void;

  // ── 🤖 AI分析エージェント ──
  agent:             AgentAnalysis | null;
  onAgentAction:     (id: AgentActionId) => void;

  onAutoFix:         () => void;
  onReroll:          () => void;
  onResetBias:       () => void;
  onDismiss:         () => void;

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

// ── セクション：💡 好み分析レポート（軸別👍👎） ─────────────────────────

function PreferenceReportSection({
  ratingAnalysis, profile, analyzing, profileError, profileSampleCount,
  onRunAnalysis, onClearProfile, autoLearnEnabled, onToggleAutoLearn,
}: {
  ratingAnalysis: RatingAnalysis | null;
  profile: PreferenceProfile | null;
  analyzing: boolean;
  profileError: string | null;
  profileSampleCount: number;
  onRunAnalysis: () => void;
  onClearProfile: () => void;
  autoLearnEnabled: boolean;
  onToggleAutoLearn: (enabled: boolean) => void;
}) {
  const rep = ratingAnalysis?.preferenceReport;
  // 「実行可能か」= サンプル数 >= MIN_SAMPLES
  const canRun = profileSampleCount >= MIN_SAMPLES && !analyzing;
  // 経過時間表示
  const lastAnalyzedText = profile
    ? new Date(profile.generatedAt).toLocaleString("ja-JP")
    : "未実行";

  if (!ratingAnalysis && !profile) {
    return (
      <div className="px-2 py-3 space-y-3">
        <p className="text-[12px] text-slate-400">
          💡 まだ評価データがありません。各案カードで生成結果画像を登録し、
          評価ボタン（👍/😐/👎/💀 と 背景/衣装/ポーズ × 👍👎）を付けると分析できるようになります。
        </p>
        <RealAnalysisCard
          profile={null}
          analyzing={analyzing}
          profileError={profileError}
          sampleCount={profileSampleCount}
          canRun={false}
          lastAnalyzedText={lastAnalyzedText}
          onRun={onRunAnalysis}
          onClear={onClearProfile}
          autoLearnEnabled={autoLearnEnabled}
          onToggleAutoLearn={onToggleAutoLearn}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {/* ── 実 AI 分析カード（最上部、最重要） ─────────────── */}
      <RealAnalysisCard
        profile={profile}
        analyzing={analyzing}
        profileError={profileError}
        sampleCount={profileSampleCount}
        canRun={canRun}
        lastAnalyzedText={lastAnalyzedText}
        onRun={onRunAnalysis}
        onClear={onClearProfile}
        autoLearnEnabled={autoLearnEnabled}
        onToggleAutoLearn={onToggleAutoLearn}
      />

      {/* ── サンプル統計（ヒューリスティック・嘘なし） ─────── */}
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
        <p className="text-[10px] text-slate-400/85 leading-snug">
          これはローカル集計です。実際の「ユーザーが好む傾向」分析は上の AI 分析ボタンを押してください。
        </p>
      </div>
      ) : null}

      {/* ── 軸別の好評/不評率（数値のみ・嘘なし） ───────────── */}
      {rep && rep.totalAxisRatings > 0 && (
        <div>
          <SectionTitle icon="📊">軸別の評価集計</SectionTitle>
          <div className="space-y-1.5 px-1">
            {rep.axes.map((a) => (
              <AxisPrefRow key={a.axis} stat={a} />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 px-1 pt-1 leading-snug">
            ※ これは画像評価ボタンの集計結果です。あくまで数値であり、傾向解釈は AI 分析を実行してください。
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-400 px-1 leading-snug border-t border-white/5 pt-2">
        ※ 評価は画像単位で IndexedDB に保存されます。再クリックで評価を変えられます。
      </p>
    </div>
  );
}

// ── 実 AI 分析カード（最重要）─────────────────────────────────────

function RealAnalysisCard({
  profile, analyzing, profileError, sampleCount, canRun, lastAnalyzedText,
  onRun, onClear, autoLearnEnabled, onToggleAutoLearn,
}: {
  profile: PreferenceProfile | null;
  analyzing: boolean;
  profileError: string | null;
  sampleCount: number;
  canRun: boolean;
  lastAnalyzedText: string;
  onRun: () => void;
  onClear: () => void;
  autoLearnEnabled: boolean;
  onToggleAutoLearn: (enabled: boolean) => void;
}) {
  const isFresh = profile && (Date.now() - profile.generatedAt) < 1000 * 60 * 60 * 24 * 7;  // 1週間以内
  // 次回自動分析までに必要な新規評価数
  const nextAutoNeed = profile
    ? Math.max(0, (profile.sampleSize + 5) - sampleCount)  // +5 = AUTO_NEW_SAMPLE_THRESHOLD
    : Math.max(0, MIN_SAMPLES - sampleCount);

  return (
    <div className="rounded-lg border border-violet-400/50 bg-violet-500/8 px-3 py-2.5 space-y-2">
      {/* ヘッダ */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-bold text-violet-100">
          🤖 AI 好み分析（実 Gemini 呼び出し）
        </span>
        {profile ? (
          <span className={[
            "text-[10px] px-1.5 py-0.5 rounded border leading-none",
            isFresh
              ? "border-emerald-400/55 bg-emerald-500/15 text-emerald-100"
              : "border-amber-400/55 bg-amber-500/15 text-amber-100",
          ].join(" ")}>
            {isFresh ? "✓ 分析済み・生成に反映中" : "⚠ 古い（再分析推奨）"}
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-400/35 bg-slate-500/10 text-slate-300 leading-none">
            未分析
          </span>
        )}
      </div>

      {/* 🔁 自動学習トグル */}
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/3 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => onToggleAutoLearn(!autoLearnEnabled)}
          className="flex items-center gap-1.5 text-[12px] font-semibold leading-none"
          title="評価が増えるたびに自動で再分析する"
        >
          <span className={[
            "relative w-9 h-4 rounded-full transition-colors shrink-0",
            autoLearnEnabled ? "bg-emerald-500/75" : "bg-white/15",
          ].join(" ")}>
            <span className={[
              "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
              autoLearnEnabled ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")} />
          </span>
          <span className={autoLearnEnabled ? "text-emerald-200" : "text-slate-400"}>
            🔁 自動学習 {autoLearnEnabled ? "ON" : "OFF"}
          </span>
        </button>
        <span className="ml-auto text-[10px] text-slate-400 leading-snug text-right">
          {autoLearnEnabled
            ? (nextAutoNeed > 0
                ? `あと ${nextAutoNeed} 件の評価で自動分析`
                : "条件達成・まもなく自動分析")
            : "手動分析のみ"}
        </span>
      </div>

      {/* メタ情報 */}
      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300/85">
        <div>📅 最終分析: <span className="text-slate-100">{lastAnalyzedText}</span></div>
        <div>🤖 使用モデル: <span className="text-slate-100">{profile?.model ?? "—"}</span></div>
        <div>📦 分析対象: <span className="text-slate-100">{profile?.sampleSize ?? 0} 件</span></div>
        <div>💾 現サンプル数: <span className="text-slate-100">{sampleCount} 件</span></div>
      </div>

      {/* 分析結果（あれば） */}
      {profile && (
        <div className="rounded-md border border-violet-400/30 bg-bg-base/40 px-2.5 py-1.5 space-y-1.5">
          <p className="text-[11px] font-bold text-violet-200">📝 分析結果サマリ</p>
          <p className="text-[11px] text-text-base/90 leading-relaxed">{profile.summary}</p>

          <div className="space-y-1 pt-1 border-t border-violet-400/15">
            {profileSummaryLines(profile).map((row) => (
              <div key={row.axis} className="text-[10px] leading-snug">
                <span className="font-bold text-slate-100">{row.emoji} {row.jp}</span>
                <div className="ml-3">
                  <span className="text-emerald-300/85">好む傾向：</span>
                  <span className="text-slate-200/90">{row.likes}</span>
                </div>
                <div className="ml-3">
                  <span className="text-rose-300/85">嫌う傾向：</span>
                  <span className="text-slate-200/90">{row.dislikes}</span>
                </div>
              </div>
            ))}
          </div>

          {(profile.preferKeywords.length > 0 || profile.avoidKeywords.length > 0) && (
            <div className="space-y-0.5 pt-1 border-t border-violet-400/15">
              {profile.preferKeywords.length > 0 && (
                <div className="text-[10px]">
                  <span className="font-bold text-emerald-300">優先：</span>
                  {profile.preferKeywords.map((k, i) => (
                    <span key={i} className="ml-1 px-1 rounded bg-emerald-500/15 text-emerald-100">
                      {k}
                    </span>
                  ))}
                </div>
              )}
              {profile.avoidKeywords.length > 0 && (
                <div className="text-[10px]">
                  <span className="font-bold text-rose-300">回避：</span>
                  {profile.avoidKeywords.map((k, i) => (
                    <span key={i} className="ml-1 px-1 rounded bg-rose-500/15 text-rose-100">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {profileError && (
        <div className="rounded-md border border-rose-400/55 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100/95">
          ⚠ 分析失敗: {profileError}
        </div>
      )}

      {/* 実行ボタン */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className={[
            "rounded-lg px-3 py-1.5 text-[12px] font-bold border leading-none transition",
            analyzing
              ? "border-amber-400/65 bg-amber-500/20 text-amber-100 cursor-progress"
              : canRun
                ? "border-violet-400/70 bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
                : "border-white/10 bg-white/4 text-text-muted/45 cursor-not-allowed",
          ].join(" ")}
        >
          {analyzing
            ? "⏳ AI分析中..."
            : profile
              ? "🔄 再分析を実行"
              : "🤖 AI分析を実行"}
        </button>
        {!canRun && !analyzing && (
          <span className="text-[10px] text-amber-300/85">
            サンプル不足（{sampleCount} / 最低 {MIN_SAMPLES}件）— 画像評価を増やしてください
          </span>
        )}
        {profile && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] px-2 py-1 rounded border border-rose-400/30 bg-rose-400/8 text-rose-200/85 hover:bg-rose-400/16 transition leading-none"
          >
            🗑 プロファイル削除
          </button>
        )}
      </div>

      <p className="text-[9px] text-slate-400 leading-snug">
        ※ 評価データを Gemini Flash に送信して分析します（画像は送信せず、プロンプト本文と評価のみ）。
        分析結果は localStorage に保存され、次回生成プロンプトに自動注入されます。
      </p>
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

// ── セクション：📸 画像分析（生成結果画像の重複・出現率） ───────────────

function ImageAnalysisSection({
  analysis, progress,
}: {
  analysis: ImageAnalysisResult | null;
  progress: { done: number; total: number } | null;
}) {
  if (!analysis || analysis.totalEligible === 0) {
    return (
      <div className="px-2 py-3 space-y-2">
        <p className="text-[12px] text-slate-400">
          📸 生成結果画像がまだありません。各案カードで「生成結果」を登録すると画像分析が始まります。
        </p>
      </div>
    );
  }

  const remaining = analysis.totalEligible - analysis.totalAnalyzed;

  return (
    <div className="space-y-3 py-2">
      {/* ── ヘッダ：統計＋進捗 ─────────────────────────── */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-1">
        <p className="text-[11px] text-slate-400">
          対象：<span className="text-emerald-200 font-bold">{analysis.totalAnalyzed}</span> 件解析済
          {remaining > 0 && (
            <span className="text-slate-400">（残 {remaining} 件）</span>
          )}
          ・クラスタ <span className="text-emerald-200">{analysis.clusters.length}</span>
          ・単独 <span className="text-slate-300">{analysis.uniqueCount}</span>
        </p>
        {progress && progress.total > 0 && progress.done < progress.total && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-200">
              解析中 {progress.done}/{progress.total}
            </span>
          </div>
        )}
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
  analysis, weights, onWeightChange, onReset,
  onAutoAdjust, onUndoAdjust, canUndo, changedKeys,
  windowSize, onWindowSizeChange,
}: {
  analysis:   ColorAnalysis | null;
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
        <SectionTitle icon="🎯">軸別の色傾向</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-1">
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
                  className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-100 leading-none"
                >
                  <span className="w-2 h-2 rounded-sm border border-white/20" style={{ backgroundColor: g.swatch }} />
                  {g.jp}
                </span>
              );
            })}
          </div>
        </div>
      )}

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
      </div>

      {/* 問題点 */}
      {agent.problems.length > 0 && (
        <div>
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">問題点</div>
          <ul className="space-y-1">
            {agent.problems.map((p, i) => (
              <li key={i} className={["text-[12px] leading-snug px-2 py-1.5 rounded-md border", sevCls(p.severity)].join(" ")}>
                {p.severity === "high" ? "🔴 " : p.severity === "medium" ? "🟡 " : "💡 "}{p.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 次におすすめ */}
      <div>
        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">次におすすめ</div>
        <ul className="space-y-0.5">
          {agent.recommendations.map((r, i) => (
            <li key={i} className="text-[12px] text-emerald-200/90 leading-snug px-1">
              ・{r}
            </li>
          ))}
        </ul>
      </div>

      {/* 提案アクション */}
      <div>
        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">提案アクション（押した時だけ反映）</div>
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

function ComboRanking({
  combos, policies, onChange,
}: {
  combos: MotifCombo[];
  policies: ComboPolicyMap;
  onChange: (key: string, p: ComboPolicy) => void;
}) {
  const show = combos.slice(0, 10);
  if (show.length === 0) return null;
  const riskCls = (r: MotifCombo["risk"]) =>
    r === "danger" ? "text-rose-300 border-rose-400/55 bg-rose-500/15"
    : r === "high" ? "text-orange-200 border-orange-400/50 bg-orange-500/12"
    : r === "medium" ? "text-amber-200 border-amber-400/45 bg-amber-500/10"
    : "text-slate-300 border-white/15 bg-white/5";
  const riskLabel = (r: MotifCombo["risk"]) =>
    r === "danger" ? "危険" : r === "high" ? "高" : r === "medium" ? "中" : "低";

  return (
    <>
      <SectionTitle icon="🧩">頻出構成 TOP10（組み合わせ被り）</SectionTitle>
      <p className="text-[11px] text-slate-400 px-1 pb-1 leading-snug">
        同じ案内で何度も揃っているモチーフの組み合わせです。「今後出さない」で同時使用を禁止、「別ジャンル化」で出そうな時に別方向へ振り替えます。
      </p>
      <div className="space-y-1 px-1">
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
              {/* 件数 */}
              <span className="text-[13px] text-white font-bold tabular-nums leading-none shrink-0">
                {c.count}<span className="text-[10px] text-slate-400 font-normal">回</span>
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
  onAutoAdjust, onUndoAutoAdjust, canUndoAuto, changedIds,
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
}) {
  const max = topMotifs[0]?.totalCount ?? 1;
  const show = topMotifs.slice(0, 12);
  if (show.length === 0) return null;

  const top5  = topMotifs.slice(0, 5).map((m) => m.motif.id);
  const top10 = topMotifs.slice(0, 10).map((m) => m.motif.id);
  const allIds = topMotifs.map((m) => m.motif.id);

  return (
    <>
      <SectionTitle icon="📊">頻出要素一覧（出現制御）</SectionTitle>

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

      <div className="space-y-px px-1 ipm-list">
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

export function DuplicateAnalysisPanel({
  biasResult, historyAnalysis, isAnalyzing,
  levels, policyApplied,
  onLevelChange, onApplyPolicies, onUnapplyPolicies, onResetPolicies, onBulkLevel, onClearNg,
  onAutoAdjust, onUndoAutoAdjust, canUndoAuto, changedIds,
  comboPolicies, onComboPolicyChange,
  colorAnalysis,
  colorWeights, onColorWeightChange, onColorWeightsReset,
  onColorAutoAdjust, onColorUndoAdjust, canColorUndo, colorChangedKeys,
  colorWindowSize, onColorWindowSizeChange,
  imageAnalysis, onStartImageAnalysis, imageAnalyzeProgress,
  ratingAnalysis,
  preferenceProfile, analyzingProfile, profileError, profileSampleCount,
  onRunPreferenceAnalysis, onClearPreferenceProfile,
  autoLearnEnabled, onToggleAutoLearn,
  agent, onAgentAction,
  onAutoFix, onReroll, onResetBias, onDismiss,
  analysisStats, activeScopes, favoriteProfile, favoriteLearnEnabled,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"dup" | "agent" | "color" | "image" | "pref">("dup");

  // 画像分析タブを開いた時に解析を発火
  useEffect(() => {
    if (tab === "image" && expanded) onStartImageAnalysis();
  }, [tab, expanded, onStartImageAnalysis]);

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
  const scopeSet = new Set(activeScopes ?? []);
  const axisInScope = (axis: string) => scopeSet.size === 0 ? true : scopeSet.has(axis);

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
    <div className={["rounded-xl border transition-all", borderCls].join(" ")}>

      {/* ── ヘッダー（常時表示） ─────────────────────────────────── */}
      <div className="px-3.5 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[15px] leading-none">🔬</span>
          <span className="text-[15px] font-bold text-white leading-none">重複分析センター</span>
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
          <button type="button" onClick={() => setExpanded((v) => !v)}
            title={expanded ? "折りたたむ" : "詳細を開く"}
            className="text-[13px] text-slate-400 hover:text-slate-100 transition px-1 leading-none">
            {expanded ? "▲" : "▼"}
          </button>
          <button type="button" onClick={onDismiss} title="閉じる"
            className="text-[14px] text-slate-400 hover:text-slate-100 transition leading-none">
            ✕
          </button>
        </div>
      </div>

      {/* ── コンパクト：今回の偏り上位3件 ─────────────────────── */}
      {compact3.length > 0 && (
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

      {/* ── 展開パネル ────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-white/12">
          {/* タブスイッチャー */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-white/8 bg-bg-base/30">
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
              💡 好み分析
              {ratingAnalysis?.preferenceReport.active && (
                <span className="text-[9px] text-pink-200/70 leading-none">
                  ({ratingAnalysis.preferenceReport.totalAxisRatings})
                </span>
              )}
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
              />
            )}

            {/* === 好み分析タブ（軸別👍👎集計 + 実 AI 分析） === */}
            {tab === "pref" && (
              <PreferenceReportSection
                ratingAnalysis={ratingAnalysis}
                profile={preferenceProfile}
                analyzing={analyzingProfile}
                profileError={profileError}
                profileSampleCount={profileSampleCount}
                onRunAnalysis={onRunPreferenceAnalysis}
                onClearProfile={onClearPreferenceProfile}
                autoLearnEnabled={autoLearnEnabled}
                onToggleAutoLearn={onToggleAutoLearn}
              />
            )}

            {/* === 色分析タブ（生成制御センター） === */}
            {tab === "color" && (
              <ColorAnalysisSection
                analysis={colorAnalysis}
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

            {/* AIコメント — トップに目立つように */}
            {ha && <AiCommentSection comment={ha.aiComment} />}

            {/* 頻出構成 TOP10（コンボ被り） */}
            {ha && ha.topCombos.length > 0 && (
              <ComboRanking
                combos={ha.topCombos}
                policies={comboPolicies}
                onChange={onComboPolicyChange}
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
                {(motifAvoid.length > 0 || comboBlocked.length > 0 || imgSuppress.length > 0) && (
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
