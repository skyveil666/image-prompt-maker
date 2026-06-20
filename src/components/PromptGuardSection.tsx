/**
 * PromptGuardSection — 各プロンプト案カードに表示する「ガードパネル」。
 *
 * 4機能を1つの折りたたみセクションに統合：
 *   ① 変更対象ロック一覧（何を変える / 変えない / 固定ルール）
 *   ② 変更禁止チェック（保護対象への干渉警告 ＋ 禁止ワード除去）
 *   ③ skyveil好みスコア（参考表示のみ ＋ 改善案作成/反映）
 *   ④ 失敗理由メモ（ワンタップ理由＋自由入力＋深刻度・保存）
 *
 * 重要：分析やスコアは自動でプロンプトを変えない。すべてボタンを押した時だけ適用。
 */

import { useMemo, useState } from "react";
import type { FailureMemo, ServerScopeFilterSummary, IdentityShieldSummary } from "../types";
import { FAILURE_REASONS } from "../types";
import type { LockState } from "../lib/promptLockCheck";
import { cleanForbidden } from "../lib/promptLockCheck";
import { scoreBand, buildImprovedPrompt } from "../lib/skyveilScore";
import type { SkyveilProfile } from "../lib/skyveilProfile";
import { analyzeProposal } from "../lib/analyzeProposal";
import { massAILevelLabel, biasStrengthLabel } from "../lib/massAIBias";
import { identityLevelLabel } from "../lib/identityRisk";
import { diffPrompts, type PromptVersion } from "../lib/promptDiff";
import { generateReversePrompt } from "../lib/reversePrompt";

interface Props {
  promptText: string;
  lock: LockState;
  profile?: SkyveilProfile | null;
  existingMemo?: FailureMemo;
  /** サーバ側スコープフィルタ結果（生成時に削除した項目） */
  serverScopeFilter?: ServerScopeFilterSummary;
  /** Identity Shield 結果（生成時に追加した同一性保護文） */
  serverIdentityShield?: IdentityShieldSummary;
  /** 版履歴（差分・この版に戻す用） */
  versions?: PromptVersion[];
  /** 禁止ワード除去/改善案反映/版復元で promptText を上書きする */
  onApplyCleanedPrompt: (next: string) => void;
  /** 失敗理由メモを保存する */
  onSaveFailureMemo: (memo: FailureMemo) => void;
}

const MASS_TONE: Record<string, string> = {
  low: "text-emerald-300", medium: "text-amber-300", high: "text-orange-300", danger: "text-rose-300",
};
const RISK_TONE: Record<string, string> = {
  low: "text-emerald-300", medium: "text-amber-300", high: "text-orange-300", danger: "text-rose-300",
};

const TONE: Record<string, { ring: string; text: string; bar: string }> = {
  green:  { ring: "border-emerald-400/50", text: "text-emerald-300", bar: "bg-emerald-400" },
  lime:   { ring: "border-lime-400/50",    text: "text-lime-300",    bar: "bg-lime-400" },
  amber:  { ring: "border-amber-400/50",   text: "text-amber-300",   bar: "bg-amber-400" },
  orange: { ring: "border-orange-400/50",  text: "text-orange-300",  bar: "bg-orange-400" },
  red:    { ring: "border-rose-400/55",    text: "text-rose-300",    bar: "bg-rose-400" },
};

export function PromptGuardSection({
  promptText, lock, profile, existingMemo, serverScopeFilter, serverIdentityShield,
  versions, onApplyCleanedPrompt, onSaveFailureMemo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [reverse, setReverse] = useState<ReturnType<typeof generateReversePrompt> | null>(null);

  // 失敗理由メモのローカル編集状態
  const [reasons, setReasons] = useState<string[]>(existingMemo?.selectedReasons ?? []);
  const [customMemo, setCustomMemo] = useState<string>(existingMemo?.customMemo ?? "");
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(existingMemo?.severity ?? 3);
  const [memoSaved, setMemoSaved] = useState(false);

  // ── 全チェックを1関数に集約（analyzeProposal）。promptText / lock が変わるたび再計算 ──
  const analysis = useMemo(
    () => analyzeProposal(promptText, lock, profile),
    [promptText, lock, profile],
  );
  const { validation, identityRisk: identity, massAI, skyveilScore: score } = analysis;
  const band = scoreBand(score.total);
  const tone = TONE[band.tone];

  // ── #8 前回（最新の版）との差分 ──
  const lastVersion = versions && versions.length > 0 ? versions[versions.length - 1] : null;
  const diff = useMemo(
    () => lastVersion ? diffPrompts(lastVersion.prompt, promptText) : null,
    [lastVersion, promptText],
  );

  const changed = analysis.lockSummary.changed;
  const locked  = analysis.lockSummary.locked;

  const toggleReason = (r: string) =>
    setReasons((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const saveFailureMemo = () => {
    if (reasons.length === 0 && !customMemo.trim()) return;
    const memo: FailureMemo = {
      id: existingMemo?.id ?? `fm-${Date.now()}`,
      createdAt: Date.now(),
      promptId: "",  // 親で item.id を補完
      selectedReasons: reasons,
      customMemo: customMemo.trim(),
      severity,
    };
    onSaveFailureMemo(memo);
    setMemoSaved(true);
    setTimeout(() => setMemoSaved(false), 1800);
  };

  return (
    <div className="rounded-xl border border-bg-border/70 bg-bg-base/30 overflow-hidden">
      {/* ヘッダー（常時表示：スコア＋警告数の要約） */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/3 transition"
      >
        <span className="text-[13px]">🛡</span>
        <span className="text-[12px] font-bold text-text-base">ガード</span>
        {/* 検査バッジ */}
        {validation.isValid ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 leading-none">
            ✅ 保護OK
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-400/50 bg-rose-500/12 text-rose-200 leading-none">
            ⚠️ 干渉 {validation.warnings.length}件
          </span>
        )}
        {/* 同一性リスクバッジ */}
        {identity.level !== "low" && (
          <span className={["text-[10px] px-1.5 py-0.5 rounded-full border leading-none",
            identity.level === "danger" ? "border-rose-400/55 bg-rose-500/14 text-rose-100 font-semibold" : "border-amber-400/45 bg-amber-400/10 text-amber-200"].join(" ")}>
            同一性:{identity.level === "danger" ? "危険" : identity.level === "high" ? "高" : "注意"}
          </span>
        )}
        <span className="ml-auto text-[11px] text-text-muted/55">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-bg-border/50">

          <GroupHeader icon="🛡" label="安全チェック" sub="サーバフィルタ・Identity Shield・ロック・禁止チェック" />

          {/* 🪖 Identity Shield（サーバが追加した同一性保護文） ──── */}
          {serverIdentityShield && (
            <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/6 px-2.5 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-cyan-200">🪖 Identity Shield：ON</span>
                <span className={["text-[11px] font-bold ml-auto",
                  serverIdentityShield.riskLevel === "danger" ? "text-rose-300" :
                  serverIdentityShield.riskLevel === "high" ? "text-orange-300" : "text-amber-300"].join(" ")}>
                  同一性リスク：{serverIdentityShield.riskLevel === "danger" ? "危険" : serverIdentityShield.riskLevel === "high" ? "高" : "中"}
                </span>
              </div>
              {serverIdentityShield.reasons.length > 0 && (
                <p className="text-[10px] text-text-muted/80 leading-snug">理由：{serverIdentityShield.reasons.join("・")}</p>
              )}
              <p className="text-[10px] text-cyan-200/80 leading-snug">
                追加された保護文：{serverIdentityShield.addedIdentityClauses.map((c) => c.match(/^【([^】]+)】/)?.[1] ?? c).join(" / ")}
              </p>
            </div>
          )}

          {/* 🧱 サーバ側スコープフィルタ（最終出力前に削除した項目） ── */}
          <div className="rounded-lg border border-bg-border bg-bg-panel/30 px-2.5 py-2 space-y-1">
            <p className="text-[11px] font-bold text-text-base">🧱 サーバ側スコープフィルタ</p>
            {(!serverScopeFilter || serverScopeFilter.removedItems.length === 0) ? (
              <p className="text-[11px] text-emerald-300">✅ 最終スコープチェック完了（除去なし）</p>
            ) : (
              <div className="space-y-0.5">
                <p className="text-[11px] text-text-muted/80">除去（最終出力前に削除）：</p>
                {serverScopeFilter.removedItems.slice(0, 8).map((r, i) => (
                  <div key={i} className="text-[11px] leading-snug">
                    <span className="text-rose-200">− {r.text}</span>
                    <span className="block text-[10px] text-rose-300/70 pl-3">理由：{r.reason}</span>
                  </div>
                ))}
                {serverScopeFilter.removedItems.length > 8 && (
                  <p className="text-[10px] text-text-muted/55">＋他 {serverScopeFilter.removedItems.length - 8}件</p>
                )}
              </div>
            )}
          </div>

          {/* ① 変更対象ロック一覧 ─────────────────────────────── */}
          <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-violet-400/30 bg-violet-500/8 px-2.5 py-2">
              <p className="text-[11px] font-bold text-violet-200 mb-1">【今回変更する項目】</p>
              <p className="text-[12px] text-violet-100/90 leading-snug">
                {changed.length > 0 ? changed.join(" / ") : "（なし）"}
              </p>
            </div>
            <div className="rounded-lg border border-sky-400/30 bg-sky-500/8 px-2.5 py-2">
              <p className="text-[11px] font-bold text-sky-200 mb-1">【変更しない項目】</p>
              <p className="text-[12px] text-sky-100/90 leading-snug">{locked.join(" / ")}</p>
            </div>
          </div>
          <div className="rounded-lg border border-bg-border bg-bg-panel/40 px-2.5 py-1.5">
            <p className="text-[11px] text-text-muted/85 leading-snug">
              【固定ルール】 背景固定：{lock.protectedTargets.background ? "ON" : "OFF"} ／
              衣装固定：{lock.protectedTargets.outfit ? "ON" : "OFF"} ／
              顔・同一性維持：<span className="text-rose-300 font-semibold">最優先</span> ／
              分析結果の自動反映：<span className="text-emerald-300 font-semibold">OFF</span>
            </p>
          </div>

          {/* ② 変更禁止チェック ───────────────────────────────── */}
          <div className="rounded-lg border border-bg-border bg-bg-panel/30 px-2.5 py-2 space-y-1.5">
            <p className="text-[11px] font-bold text-text-base">変更禁止チェック</p>
            {validation.isValid ? (
              <p className="text-[12px] text-emerald-300">✅ 保護対象への干渉はありません</p>
            ) : (
              <>
                {validation.warnings.map((w, i) => (
                  <div key={i} className="text-[12px] text-rose-200 leading-snug">
                    ⚠️ {w.message}
                    <span className="block text-[10px] text-rose-300/70 pl-4">
                      検出：{w.matchedWords.slice(0, 6).join("・")}
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onApplyCleanedPrompt(cleanForbidden(promptText, lock))}
                  className="mt-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-rose-400/50 bg-rose-500/12 text-rose-100 hover:bg-rose-500/22 transition leading-none"
                >
                  🧹 禁止ワードを除去
                </button>
              </>
            )}
          </div>

          {/* ⑦ 同一性リスク表示（安全チェックの一部） ──────────── */}
          <div className={[
            "rounded-lg border px-2.5 py-2 space-y-1.5",
            identity.level === "low" ? "border-emerald-400/30 bg-emerald-500/5" : "border-rose-400/30 bg-rose-500/6",
          ].join(" ")}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-text-base">同一性リスク</span>
              <span className={["text-[12px] font-bold ml-auto", RISK_TONE[identity.level]].join(" ")}>{identityLevelLabel(identity.level)}</span>
            </div>
            {identity.reasons.length > 0 && (
              <p className="text-[11px] text-text-muted/85 leading-snug">理由：{identity.reasons.join("、")}</p>
            )}
            {identity.warnings.length > 0 && (
              <p className="text-[11px] text-rose-200 leading-snug">注意：{identity.warnings.join("／")}</p>
            )}
            {identity.safeSuggestions.length > 0 && (
              <details className="text-[10px] text-text-muted/75">
                <summary className="cursor-pointer text-sky-300/80">安全提案を見る（{identity.safeSuggestions.length}件）</summary>
                <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                  {identity.safeSuggestions.map((s, i) => <li key={i} className="leading-snug">{s}</li>)}
                </ul>
              </details>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function BiasChip({ label, score }: { label: string; score: number }) {
  const s = biasStrengthLabel(score);
  const cls = s === "強" ? "text-rose-300" : s === "中" ? "text-amber-300" : s === "弱" ? "text-text-muted/70" : "text-emerald-300/70";
  return (
    <span className="text-[10px] leading-none">
      <span className="text-text-muted/70">{label}偏り：</span>
      <span className={["font-bold", cls].join(" ")}>{s}</span>
    </span>
  );
}

function GroupHeader({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-2 pt-1.5 first:pt-0">
      <span className="text-[12px]">{icon}</span>
      <span className="text-[12px] font-bold text-text-base">{label}</span>
      <span className="text-[10px] text-text-muted/55">{sub}</span>
      <span className="flex-1 h-px bg-bg-border/60 self-center" />
    </div>
  );
}

// P4: サブスコアの意味を tooltip で補足（表示のみ・スコア計算は不変）
const SUBSCORE_TIPS: Record<string, string> = {
  "同一性安全度": "顔・人物の同一性が崩れにくいか（保護が効いているほど高い）",
  "ロック遵守度": "変更対象外の軸に触れていないか（守るものを守れているほど高い）",
  "AIっぽさ回避度": "ありがちなAIっぽい表現を避けられているか",
  "オリジナリティ": "独自性・新規性の高さ",
  "トレンドバランス": "流行を取り入れつつ偏りすぎていないか",
  "バズり余地": "SNSで伸びる余地・インパクト",
};
function SubScore({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "bg-emerald-400" : value >= 55 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-1.5 cursor-help" title={`${label}：${value}/100\n${SUBSCORE_TIPS[label] ?? ""}`}>
      <span className="text-[10px] text-text-muted/80 w-24 shrink-0 leading-none">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className={["h-full rounded-full", color].join(" ")} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-text-muted/80 w-6 text-right leading-none">{value}</span>
    </div>
  );
}
