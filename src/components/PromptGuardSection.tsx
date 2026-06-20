/**
 * PromptGuardSection — 各プロンプト案カードに表示する「ガードパネル（安全チェック）」。
 *
 * 安全チェックを1つの折りたたみセクションに表示：
 *   ・サーバ側スコープフィルタ / Identity Shield（生成時の保護結果）
 *   ① 変更対象ロック一覧（何を変える / 変えない / 固定ルール）
 *   ② 変更禁止チェック（保護対象への干渉警告 ＋ 禁止ワード除去）
 *   ⑦ 同一性リスク表示
 *
 * 重要：表示のみ。🧹禁止ワード除去を押した時だけ promptText を上書きする（自動反映なし）。
 */

import { useMemo, useState } from "react";
import type { ServerScopeFilterSummary, IdentityShieldSummary } from "../types";
import type { LockState } from "../lib/promptLockCheck";
import { cleanForbidden } from "../lib/promptLockCheck";
import { analyzeProposal } from "../lib/analyzeProposal";
import { identityLevelLabel } from "../lib/identityRisk";

interface Props {
  promptText: string;
  lock: LockState;
  /** サーバ側スコープフィルタ結果（生成時に削除した項目） */
  serverScopeFilter?: ServerScopeFilterSummary;
  /** Identity Shield 結果（生成時に追加した同一性保護文） */
  serverIdentityShield?: IdentityShieldSummary;
  /** 🧹禁止ワード除去で promptText を上書きする */
  onApplyCleanedPrompt: (next: string) => void;
}

const RISK_TONE: Record<string, string> = {
  low: "text-emerald-300", medium: "text-amber-300", high: "text-orange-300", danger: "text-rose-300",
};

export function PromptGuardSection({
  promptText, lock, serverScopeFilter, serverIdentityShield, onApplyCleanedPrompt,
}: Props) {
  const [open, setOpen] = useState(false);

  // ── 全チェックを1関数に集約（analyzeProposal）。promptText / lock が変わるたび再計算 ──
  const analysis = useMemo(
    () => analyzeProposal(promptText, lock),
    [promptText, lock],
  );
  const { validation, identityRisk: identity } = analysis;

  const changed = analysis.lockSummary.changed;
  const locked  = analysis.lockSummary.locked;

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
