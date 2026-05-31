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

import { useState } from "react";
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

  // ── 🤖 AI分析エージェント ──
  agent:             AgentAnalysis | null;
  onAgentAction:     (id: AgentActionId) => void;

  onAutoFix:         () => void;
  onReroll:          () => void;
  onResetBias:       () => void;
  onDismiss:         () => void;
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

      <p className="text-[10px] text-text-muted/40 leading-snug px-1 border-t border-white/10 pt-1.5">
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
                    {idx > 0 && <span className="text-slate-500 text-[11px]">＋</span>}
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
        <span className="text-[10px] text-text-muted/40 leading-snug ml-1">
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

      <div className="space-y-px px-1">
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
              : "text-slate-500",
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
  agent, onAgentAction,
  onAutoFix, onReroll, onResetBias, onDismiss,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"dup" | "agent">("dup");

  // 反映時のサマリー（制御中 = 非4 件数 / NG件数）
  const { controlled: controlledCount, ng: ngCount } = countLevels(levels);
  const { block: comboBlockCount, alt: comboAltCount } = countComboPolicies(comboPolicies);
  const hasStagedPolicies = controlledCount > 0 || comboBlockCount + comboAltCount > 0;

  // ヘッダーデータ
  const risk = biasResult?.risk ?? "low";
  const dupScore = biasResult?.duplicateScore ?? 0;
  const novScore = biasResult?.noveltyScore ?? 100;
  const borderCls = biasRiskBorderClass(risk);
  const riskTextCls = biasRiskTextClass(risk);
  const compact3 = biasResult?.topMotifs.slice(0, 3) ?? [];
  const ha = historyAnalysis;

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
            <span className="text-[11px] text-slate-500">/100</span>
            <span className="text-slate-600 text-[11px] mx-0.5">·</span>
            <span className="text-[12px] text-slate-300">新規性</span>
            <span className={[
              "text-[16px] font-black",
              novScore >= 60 ? "text-emerald-300" : novScore >= 35 ? "text-amber-300" : "text-rose-300",
            ].join(" ")}>{novScore}</span>
            <span className="text-[11px] text-slate-500">/100</span>
          </span>
          {ha && (
            <span className="text-[11px] text-slate-400 leading-none">
              (全{ha.totalItems}件/分析{ha.windowSize}件)
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
          </div>

          <div className="px-3 overflow-y-auto max-h-[62vh]">

            {/* === AI分析タブ === */}
            {tab === "agent" && <AgentSection agent={agent} onAction={onAgentAction} />}

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
              <p className="py-3 text-center text-[11px] text-text-muted/35">
                生成後に分析が始まります
              </p>
            )}

            </>}{/* end of tab === "dup" */}
          </div>

          {/* ── フッター：反映状態 + 一括操作 ──────────────── */}
          <div className="border-t border-text-muted/10 px-3.5 py-2.5 space-y-2">

            {/* 反映状態バナー */}
            {policyApplied ? (
              <div className="rounded-lg border border-violet-400/30 bg-violet-400/8 px-2.5 py-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] text-violet-200/85 leading-snug">
                  ✓ 出現制御を反映中
                  <span className="text-violet-300/60 ml-1.5">
                    （要素：制御 {controlledCount}件 / 完全NG {ngCount}件
                    {(comboBlockCount + comboAltCount > 0) && <>
                      　・構成：禁止 {comboBlockCount}件 / 別ジャンル化 {comboAltCount}件
                    </>}）
                  </span>
                </span>
                <button type="button" onClick={onUnapplyPolicies}
                  className="text-[11px] text-violet-200/60 hover:text-violet-100 underline leading-none whitespace-nowrap">
                  解除
                </button>
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
              <p className="text-[11px] text-text-muted/40 leading-snug px-0.5">
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
