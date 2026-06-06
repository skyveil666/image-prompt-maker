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
        {/* スコアミニ表示 */}
        <span className={["text-[12px] font-black", tone.text].join(" ")}>{score.total}</span>
        <span className="text-[10px] text-text-muted/60">/100</span>
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
        {/* 量産AI度バッジ */}
        {massAI.level !== "low" && (
          <span className={["text-[10px] px-1.5 py-0.5 rounded-full border leading-none",
            massAI.level === "danger" ? "border-rose-400/50 bg-rose-500/12 text-rose-200" : "border-orange-400/40 bg-orange-400/10 text-orange-200"].join(" ")}>
            量産AI:{massAI.level === "danger" ? "危険" : massAI.level === "high" ? "高" : "中"}
          </span>
        )}
        {/* 同一性リスクバッジ */}
        {identity.level !== "low" && (
          <span className={["text-[10px] px-1.5 py-0.5 rounded-full border leading-none",
            identity.level === "danger" ? "border-rose-400/55 bg-rose-500/14 text-rose-100 font-semibold" : "border-amber-400/45 bg-amber-400/10 text-amber-200"].join(" ")}>
            同一性:{identity.level === "danger" ? "危険" : identity.level === "high" ? "高" : "注意"}
          </span>
        )}
        {existingMemo && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-200 leading-none">
            📝 失敗メモあり
          </span>
        )}
        <span className="ml-auto text-[11px] text-text-muted/55">{open ? "▲" : "▼"}</span>
      </button>

      {/* 🚀 投稿前スコア（常時表示・Xに出す前の一目チェック） */}
      <PostReadyScore
        snsBuzz={score.buzzPotential}
        skyveilFit={score.total}
        massAvoid={score.aiBiasAvoidance}
        identitySafe={score.identitySafety}
      />

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

          <GroupHeader icon="📊" label="プロンプト評価スコア" sub="skyveil好み・量産AI回避・バズり余地" />

          {/* ③ skyveil好みスコア ──────────────────────────────── */}
          <div className={["rounded-lg border bg-bg-panel/30 px-2.5 py-2 space-y-2", tone.ring].join(" ")}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-text-base">skyveil好みスコア</span>
              <span className={["text-[16px] font-black leading-none", tone.text].join(" ")}>{score.total}</span>
              <span className="text-[10px] text-text-muted/55">/100</span>
              <span className={["text-[11px] font-semibold ml-auto", tone.text].join(" ")}>{band.label}</span>
            </div>
            {/* サブスコア */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <SubScore label="同一性安全度" value={score.identitySafety} />
              <SubScore label="ロック遵守度" value={score.lockCompliance} />
              <SubScore label="量産AI回避度" value={score.aiBiasAvoidance} />
              <SubScore label="オリジナリティ" value={score.originality} />
              <SubScore label="トレンドバランス" value={score.trendBalance} />
              <SubScore label="バズり余地" value={score.buzzPotential} />
            </div>
            {/* 理由 */}
            {score.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {score.reasons.slice(0, 6).map((r, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-400/8 text-emerald-200/85 leading-none">＋{r}</span>
                ))}
              </div>
            )}
            {/* 警告（赤系） */}
            {score.warnings.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {score.warnings.slice(0, 6).map((w, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-400/35 bg-rose-400/8 text-rose-200/85 leading-none">－{w}</span>
                ))}
              </div>
            )}
            {/* 改善案 */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setImproved(buildImprovedPrompt(promptText, lock))}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-violet-400/50 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition leading-none"
              >
                💡 このスコアを参考に改善案を作る
              </button>
              {improved && (
                <span className="text-[10px] text-text-muted/55">下に改善案を表示（元は上書きしません）</span>
              )}
            </div>
            {improved && (
              <div className="rounded-lg border border-violet-400/30 bg-bg-base/50 p-2 space-y-1.5">
                <pre className="text-[11px] text-text-base/90 whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed">{improved}</pre>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { onApplyCleanedPrompt(improved); setImproved(null); }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-violet-400/60 bg-violet-500/22 text-violet-50 hover:bg-violet-500/35 transition leading-none"
                  >
                    ✓ この改善案を反映
                  </button>
                  <button
                    type="button"
                    onClick={() => setImproved(null)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
                  >
                    破棄
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ⑥ 量産AI回避メーター ─────────────────────────────── */}
          <div className="rounded-lg border border-bg-border bg-bg-panel/30 px-2.5 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-text-base">量産AI回避メーター</span>
              <span className={["text-[12px] font-bold ml-auto", MASS_TONE[massAI.level]].join(" ")}>{massAILevelLabel(massAI.level)}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <BiasChip label="黒ゴシック" score={massAI.categories.blackGothic} />
              <BiasChip label="青ネオン"   score={massAI.categories.blueNeon} />
              <BiasChip label="サイバー背景" score={massAI.categories.cyberBackground} />
              <BiasChip label="クリスタル" score={massAI.categories.crystal} />
              <BiasChip label="ドレス"     score={massAI.categories.dress} />
            </div>
            {massAI.suggestions.length > 0 && (
              <details className="text-[10px] text-text-muted/75">
                <summary className="cursor-pointer text-orange-300/80">改善案を見る（{massAI.suggestions.length}件）</summary>
                <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                  {massAI.suggestions.map((s, i) => <li key={i} className="leading-snug">{s}</li>)}
                </ul>
              </details>
            )}
          </div>

          {/* ⑧ 前回との差分 ───────────────────────────────────── */}
          {lastVersion && diff && (
            <div className="rounded-lg border border-bg-border bg-bg-panel/30 px-2.5 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-text-base">前回との差分</span>
                <span className="text-[10px] text-text-muted/70">{diff.summary.join(" / ")}</span>
                <button
                  type="button"
                  onClick={() => setShowDiff((v) => !v)}
                  className="ml-auto text-[11px] text-sky-300/85 hover:text-sky-200 transition leading-none"
                >
                  {showDiff ? "閉じる" : "差分を見る"}
                </button>
              </div>
              {showDiff && (
                <div className="space-y-1 text-[11px] leading-snug max-h-44 overflow-y-auto">
                  {diff.removed.map((l, i) => <div key={`r${i}`} className="text-rose-300/90 bg-rose-500/8 rounded px-1.5 py-0.5">− {l}</div>)}
                  {diff.changed.map((c, i) => (
                    <div key={`c${i}`} className="bg-amber-400/8 rounded px-1.5 py-0.5">
                      <div className="text-amber-300/80">~ {c.before}</div>
                      <div className="text-amber-100">→ {c.after}</div>
                    </div>
                  ))}
                  {diff.added.map((l, i) => <div key={`a${i}`} className="text-emerald-300/90 bg-emerald-500/8 rounded px-1.5 py-0.5">＋ {l}</div>)}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onApplyCleanedPrompt(lastVersion.prompt)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-sky-400/50 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22 transition leading-none"
                    >
                      ↩ この版に戻す
                    </button>
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(
                        [...diff.removed.map((l) => `- ${l}`), ...diff.added.map((l) => `+ ${l}`)].join("\n")); }}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-bg-border bg-bg-panel/60 text-text-muted hover:text-text-base transition leading-none"
                    >
                      📋 差分をコピー
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <GroupHeader icon="📚" label="学習・改善センター" sub="失敗メモ・逆プロンプト（すべて手動反映）" />

          {/* ④ 失敗理由メモ ───────────────────────────────────── */}
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-2.5 py-2 space-y-2">
            <p className="text-[11px] font-bold text-amber-200">失敗理由メモ <span className="text-[10px] text-amber-300/60 font-normal">（学習材料・自動反映しません）</span></p>
            <div className="flex flex-wrap gap-1">
              {FAILURE_REASONS.map((r) => {
                const on = reasons.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleReason(r)}
                    className={[
                      "text-[10px] px-1.5 py-0.5 rounded-full border transition leading-none",
                      on
                        ? "border-amber-400/70 bg-amber-400/22 text-amber-100 font-semibold"
                        : "border-bg-border bg-bg-panel/60 text-text-muted/80 hover:text-text-base hover:border-amber-400/40",
                    ].join(" ")}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <textarea
              value={customMemo}
              onChange={(e) => setCustomMemo(e.target.value.slice(0, 300))}
              placeholder="自由入力（例：顔は良かったけど背景が勝手に変わった）"
              rows={2}
              className="w-full rounded-lg border border-bg-border bg-bg-base/60 px-2 py-1.5 text-[12px] text-text-base placeholder:text-text-muted/45 outline-none focus:border-amber-400/50 transition resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-text-muted/75">深刻度</span>
              {([1, 2, 3, 4, 5] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={[
                    "w-6 h-6 rounded-md text-[11px] font-bold border transition leading-none",
                    severity === s
                      ? "border-amber-400/70 bg-amber-400/25 text-amber-100"
                      : "border-bg-border bg-bg-panel/50 text-text-muted/70 hover:text-text-base",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={saveFailureMemo}
                disabled={reasons.length === 0 && !customMemo.trim()}
                className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-400/55 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25 transition disabled:opacity-40 disabled:cursor-not-allowed leading-none"
              >
                {memoSaved ? "✅ 保存しました" : "💾 失敗理由を保存"}
              </button>
            </div>
          </div>

          {/* ⑩ 逆プロンプト生成 ───────────────────────────────── */}
          <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/6 px-2.5 py-2 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-fuchsia-200">逆プロンプト生成</span>
              <span className="text-[10px] text-text-muted/60">失敗から次回改善案を作る（自動反映しません）</span>
              <button
                type="button"
                onClick={() => setReverse(generateReversePrompt({
                  sourcePrompt: promptText,
                  sourcePromptId: "",
                  failureMemo: existingMemo,
                  validation, massAI, identity, lock,
                }))}
                className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25 transition leading-none"
              >
                🔄 逆プロンプト生成
              </button>
            </div>
            {reverse && (
              <div className="rounded-lg border border-fuchsia-400/25 bg-bg-base/50 p-2 space-y-1.5">
                {reverse.failureSummary.length > 0 && (
                  <p className="text-[11px] text-rose-200 leading-snug">
                    <span className="font-semibold">失敗原因：</span>{reverse.failureSummary.join(" / ")}
                  </p>
                )}
                {reverse.avoidNextTime.length > 0 && (
                  <p className="text-[11px] text-orange-200/90 leading-snug">
                    <span className="font-semibold">次回避ける表現：</span>{reverse.avoidNextTime.slice(0, 8).join("、")}
                  </p>
                )}
                {reverse.strengthenLocks.length > 0 && (
                  <div className="text-[11px] text-sky-200/90 leading-snug">
                    <span className="font-semibold">次回強める固定文：</span>
                    <ul className="pl-3 list-disc mt-0.5">
                      {reverse.strengthenLocks.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] font-semibold text-fuchsia-200">改善プロンプト案：</p>
                <pre className="text-[11px] text-text-base/90 whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed bg-bg-base/60 rounded p-1.5">{reverse.improvedPrompt}</pre>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { onApplyCleanedPrompt(reverse.improvedPrompt); setReverse(null); }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-fuchsia-400/60 bg-fuchsia-500/22 text-fuchsia-50 hover:bg-fuchsia-500/35 transition leading-none"
                  >
                    ✓ 改善案をこの案に反映
                  </button>
                  <button
                    type="button"
                    onClick={() => setReverse(null)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
                  >
                    破棄
                  </button>
                </div>
              </div>
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

/** 🚀 投稿前スコア：X投稿前に「出して大丈夫か」を1秒で判断する集約バッジ */
function PostReadyScore({ snsBuzz, skyveilFit, massAvoid, identitySafe }: {
  snsBuzz: number; skyveilFit: number; massAvoid: number; identitySafe: number;
}) {
  // 投稿OK判定：4軸すべてが基準以上（同一性安全を最重視）
  const ok = identitySafe >= 70 && skyveilFit >= 70 && massAvoid >= 55 && snsBuzz >= 50;
  const warn = identitySafe < 55 || skyveilFit < 55;
  const verdict = ok ? { label: "✅ 投稿OK", cls: "border-emerald-400/55 bg-emerald-500/15 text-emerald-200" }
    : warn ? { label: "❌ 要調整", cls: "border-rose-400/55 bg-rose-500/14 text-rose-200" }
    : { label: "🟡 もう一押し", cls: "border-amber-400/50 bg-amber-400/12 text-amber-200" };
  const numCls = (v: number) => v >= 75 ? "text-emerald-300" : v >= 55 ? "text-amber-300" : "text-rose-300";
  // P4: 各スコアの意味を tooltip で補足（表示のみ・スコア計算は不変）
  const Item = ({ label, v, tip }: { label: string; v: number; tip: string }) => (
    <span className="text-[11px] leading-none whitespace-nowrap cursor-help" title={`${label}：${v}/100\n${tip}`}>
      <span className="text-text-muted/70">{label} </span>
      <span className={["font-black tabular-nums", numCls(v)].join(" ")}>{v}</span>
    </span>
  );
  return (
    <div className="px-3 py-2 border-t border-bg-border/40 flex items-center gap-x-3 gap-y-1 flex-wrap bg-bg-base/20">
      <span className="text-[11px] font-bold text-text-base cursor-help"
        title="X投稿前に「出して大丈夫か」を1秒で判断する集約バッジ。4軸すべてが基準以上で『投稿OK』。">
        🚀 投稿前スコア
      </span>
      <Item label="SNS映え"    v={snsBuzz}      tip="SNSで目を引く度合い（高いほどバズりやすい）" />
      <Item label="skyveil適性" v={skyveilFit}   tip="あなたの好み傾向との一致度（skyveil好み）" />
      <Item label="量産AI回避"  v={massAvoid}    tip="ありがちな量産AI表現を避けられている度合い" />
      <Item label="同一性安全"  v={identitySafe} tip="顔・人物の同一性が崩れにくい度合い（最重視）" />
      <span className={["ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full border leading-none cursor-help", verdict.cls].join(" ")}
        title="判定基準：同一性安全≥70・skyveil適性≥70・量産AI回避≥55・SNS映え≥50 をすべて満たすと『投稿OK』。">
        {verdict.label}
      </span>
    </div>
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
  "量産AI回避度": "ありがちな量産AI表現を避けられているか",
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
