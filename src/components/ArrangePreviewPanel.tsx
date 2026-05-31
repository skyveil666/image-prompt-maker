/**
 * ArrangePreviewPanel — 履歴一覧の右側「✨ アレンジ結果」パネル
 *
 * 「元プロンプトを丸ごと再利用」ではなく、
 * 「元プロンプトの中から使いたい要素だけ選んで再利用」する。
 *
 * フロー：カードのアレンジ → ここで使う要素をON/OFF選択 →
 *         [選択要素でアレンジ生成] を押して生成 → 結果表示。
 */

import { useMemo, useState } from "react";
import type { ArrangeResult, GeneratedProposal, PromptHistoryItem, Scope } from "../types";
import { ARRANGE_AXES, ALL_SCOPE_LABELS, arrangeCandidateScopes } from "../lib/arrange";
import { WithImagePreview } from "./ImagePreviewTooltip";

interface Props {
  /** 選択中のアレンジ元（カードのアレンジを押すと設定される） */
  source:            PromptHistoryItem | null;
  /** 使用する要素（ON のスコープ） */
  selectedScopes:    Scope[];
  onToggleScope:     (scope: Scope) => void;
  onSetScopes:       (scopes: Scope[]) => void;
  onGenerate:        () => void;

  result:            ArrangeResult | null;
  busy:              boolean;
  pinned:            boolean;
  onTogglePin:       () => void;
  onClose:           () => void;
  onSaveFavorite:    (proposal: GeneratedProposal) => void | Promise<void>;
  onReArrange:       (proposal: GeneratedProposal) => void;
  onSendToGenerator: () => void;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return (
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ` +
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  );
}

// ── 要素選択チップ ────────────────────────────────────────────────────────────

function ElementSelector({
  source, selectedScopes, onToggleScope, onSetScopes,
}: {
  source: PromptHistoryItem;
  selectedScopes: Scope[];
  onToggleScope: (s: Scope) => void;
  onSetScopes: (s: Scope[]) => void;
}) {
  const candidates = useMemo(() => arrangeCandidateScopes(source), [source]);
  const sourceScopes = new Set(source.scopes ?? []);
  const sel = new Set(selectedScopes);

  // 標準9軸＋元プロンプト固有の追加軸
  const extraAxes = candidates
    .filter((s) => !ARRANGE_AXES.some((a) => a.scope === s))
    .map((s) => ({ scope: s, label: ALL_SCOPE_LABELS[s] }));
  const allAxes = [...ARRANGE_AXES, ...extraAxes];

  const SHORTCUTS: { label: string; apply: () => void }[] = [
    { label: "衣装だけ",   apply: () => onSetScopes(["outfit"]) },
    { label: "背景だけ",   apply: () => onSetScopes(["background"]) },
    { label: "髪だけ",     apply: () => onSetScopes(["hair"]) },
    { label: "カメラだけ", apply: () => onSetScopes(["camera"]) },
    { label: "背景を除外", apply: () => onSetScopes(selectedScopes.filter((s) => s !== "background")) },
    { label: "持ち物を除外", apply: () => onSetScopes(selectedScopes.filter((s) => s !== "props")) },
    { label: "全部ON",     apply: () => onSetScopes(candidates) },
    { label: "全部OFF",    apply: () => onSetScopes([]) },
  ];

  return (
    <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-violet-100">使用する要素を選択</span>
        <span className="text-[9px] text-text-muted/40">ONの要素だけ再利用します</span>
      </div>

      {/* 要素チップ */}
      <div className="flex flex-wrap gap-1">
        {allAxes.map(({ scope, label }) => {
          const on = sel.has(scope);
          const inSource = sourceScopes.has(scope);
          return (
            <button
              key={scope}
              type="button"
              onClick={() => onToggleScope(scope)}
              title={inSource ? "元プロンプトに含まれる要素" : "元プロンプトには無い要素（ONで新たに変更対象に追加）"}
              className={[
                "text-[11px] px-2 py-1 rounded-lg border leading-none transition flex items-center gap-1",
                on
                  ? "border-violet-400/70 bg-violet-500/25 text-violet-50 font-semibold"
                  : "border-text-muted/20 bg-text-muted/5 text-text-muted/45 hover:border-text-muted/40 line-through decoration-text-muted/30",
              ].join(" ")}
            >
              <span className="text-[8px]">{on ? "●" : "○"}</span>
              {label}
              {inSource && !on && <span className="text-[8px] text-rose-300/50">除外</span>}
            </button>
          );
        })}
      </div>

      {/* ショートカット */}
      <div className="flex flex-wrap gap-1 pt-0.5 border-t border-violet-400/15">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.apply}
            className="text-[10px] px-1.5 py-0.5 rounded-md border border-sky-400/30 bg-sky-400/8 text-sky-200/70 hover:bg-sky-400/18 transition leading-none"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 1案ぶんのカード ───────────────────────────────────────────────────────────

function ProposalCard({
  proposal, index, onSaveFavorite, onReArrange,
}: {
  proposal: GeneratedProposal;
  index: number;
  onSaveFavorite: (p: GeneratedProposal) => void | Promise<void>;
  onReArrange: (p: GeneratedProposal) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(proposal.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };
  const handleSave = async () => {
    await onSaveFavorite(proposal);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="rounded-xl border border-bg-border bg-bg-base/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-bg-border/60 bg-bg-panel/40">
        <span className="text-[12px] font-bold text-violet-200/90">案 {index + 1}</span>
        {proposal.genreLabel && (
          <span className="text-[10px] text-text-muted/50">{proposal.genreLabel}</span>
        )}
      </div>
      <p className="px-3 py-2.5 text-[13px] leading-relaxed text-text-base/95 whitespace-pre-wrap break-words select-text">
        {proposal.body}
      </p>
      <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
        <button type="button" onClick={handleCopy}
          className={[
            "rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition",
            copied ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-100"
                   : "border-sky-400/45 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20",
          ].join(" ")}>
          {copied ? "✓ コピーしました" : "📋 コピー"}
        </button>
        <button type="button" onClick={handleSave}
          className={[
            "rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition",
            saved ? "border-amber-400/60 bg-amber-400/20 text-amber-100"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
          ].join(" ")}>
          {saved ? "✓ 保存しました" : "♥ お気に入り保存"}
        </button>
        <button type="button" onClick={() => onReArrange(proposal)}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-violet-400/45 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 transition">
          ✨ さらにアレンジ
        </button>
      </div>
    </div>
  );
}

// ── メインパネル ───────────────────────────────────────────────────────────────

export function ArrangePreviewPanel({
  source, selectedScopes, onToggleScope, onSetScopes, onGenerate,
  result, busy, pinned, onTogglePin, onClose,
  onSaveFavorite, onReArrange, onSendToGenerator,
}: Props) {
  const usedAxes = result?.changedAxes.filter((a) => a.changed) ?? [];
  const excludedAxes = result?.changedAxes.filter((a) => !a.changed) ?? [];
  const canGenerate = !!source && selectedScopes.length > 0 && !busy;

  return (
    <div className="rounded-2xl border border-violet-400/30 bg-bg-panel/50 flex flex-col lg:sticky lg:top-0 lg:self-start lg:max-h-screen overflow-hidden shadow-[0_0_24px_rgba(139,92,246,0.12)]">

      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-violet-400/20 bg-violet-400/5">
        <span className="text-[14px]">✨</span>
        <span className="text-[13px] font-bold text-violet-100">アレンジ結果</span>
        {busy && <span className="text-[11px] text-violet-200/60 animate-pulse">生成中…</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onTogglePin}
            title={pinned ? "固定を解除" : "パネルを固定表示"}
            className={[
              "text-[11px] px-2 py-0.5 rounded-lg border leading-none transition",
              pinned ? "border-violet-400/60 bg-violet-400/20 text-violet-100"
                     : "border-bg-border bg-bg-panel/70 text-text-muted/60 hover:text-text-base",
            ].join(" ")}>
            📌 固定{pinned ? "中" : ""}
          </button>
          <button type="button" onClick={onClose} title="閉じる"
            className="text-[13px] text-text-muted/40 hover:text-text-muted/80 transition leading-none px-1">
            ✕
          </button>
        </div>
      </div>

      {/* スクロール領域 */}
      <div className="overflow-y-auto p-3 space-y-3 flex-1 min-h-[220px]">

        {/* 元未選択：空状態 */}
        {!source && (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-2 py-10">
            <span className="text-3xl opacity-30">✨</span>
            <p className="text-[13px] text-text-muted/50 leading-relaxed">
              アレンジ結果はここに表示されます。
              <br />
              左の履歴カードの「アレンジ」を押してください。
            </p>
          </div>
        )}

        {source && (
          <>
            {/* 元プロンプト情報 */}
            <div className="rounded-xl border border-bg-border bg-bg-base/40 p-2.5 flex gap-2.5 items-start">
              {/* 元画像／生成結果画像：ホバー・クリックで拡大（履歴一覧と共通） */}
              {source.sourceImageThumbnail || source.resultImageData ? (
                <div className="flex items-center gap-1 shrink-0">
                  {source.sourceImageThumbnail && (
                    <WithImagePreview src={source.sourceImageThumbnail} label="元画像" sublabel={`案${source.proposalIndex}`}>
                      <img src={source.sourceImageThumbnail} alt="元画像"
                        className="w-12 h-12 rounded-lg object-cover border border-bg-border" />
                    </WithImagePreview>
                  )}
                  {source.resultImageData && (
                    <>
                      {source.sourceImageThumbnail && (
                        <span className="text-[10px] text-text-muted/40 leading-none">→</span>
                      )}
                      <WithImagePreview src={source.resultImageData} label="生成結果" sublabel={`案${source.proposalIndex}`}>
                        <img src={source.resultImageData} alt="生成結果"
                          className="w-12 h-12 rounded-lg object-cover border border-emerald-400/50" />
                      </WithImagePreview>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-bg-panel border border-bg-border flex items-center justify-center text-[9px] text-text-muted/40 shrink-0">
                  画像なし
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-text-muted/50 leading-none mb-1">元プロンプト</div>
                <div className="text-[12px] text-text-base/80 font-semibold leading-tight">
                  {formatDateTime(source.createdAt)}
                </div>
                <p className="text-[11px] text-text-muted/55 leading-snug mt-1 break-words"
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {source.promptText}
                </p>
              </div>
            </div>

            {/* 要素選択 */}
            <ElementSelector
              source={source}
              selectedScopes={selectedScopes}
              onToggleScope={onToggleScope}
              onSetScopes={onSetScopes}
            />

            {/* 生成ボタン */}
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate}
              className={[
                "w-full rounded-lg px-3 py-2 text-[12px] font-bold border transition",
                canGenerate
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                  : "border-bg-border bg-bg-panel/50 text-text-muted/40 cursor-not-allowed",
              ].join(" ")}
            >
              {busy ? "⏳ 生成中…" : selectedScopes.length === 0
                ? "⚠ 使用する要素を1つ以上選んでください"
                : "✨ 選択要素でアレンジ生成"}
            </button>

            {/* 結果 */}
            {result && !busy && (
              <>
                {/* 今回使用 / 除外 */}
                <div className="rounded-lg border border-bg-border bg-bg-base/40 px-2.5 py-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-emerald-300/70 font-semibold mr-0.5">今回使用：</span>
                    {usedAxes.length > 0 ? usedAxes.map((a) => (
                      <span key={a.scope} className="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-400/45 bg-violet-400/15 text-violet-100 leading-none">
                        {a.label}
                      </span>
                    )) : <span className="text-[10px] text-text-muted/40">なし</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-rose-300/60 font-semibold mr-0.5">今回除外：</span>
                    {excludedAxes.length > 0 ? excludedAxes.map((a) => (
                      <span key={a.scope} className="text-[10px] px-1.5 py-0.5 rounded-full border border-text-muted/25 bg-text-muted/5 text-text-muted/50 leading-none">
                        {a.label}
                      </span>
                    )) : <span className="text-[10px] text-text-muted/40">なし</span>}
                  </div>
                  <p className="text-[9px] text-text-muted/35 leading-snug">
                    ※除外要素は元プロンプトに記述があっても反映されません（固定・維持）。
                  </p>
                </div>

                {/* 案一覧 */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-text-muted/60">
                    アレンジ後プロンプト（{result.proposals.length}案）
                  </div>
                  {result.proposals.map((p, i) => (
                    <ProposalCard key={p.index ?? i} proposal={p} index={i}
                      onSaveFavorite={onSaveFavorite} onReArrange={onReArrange} />
                  ))}
                </div>
              </>
            )}

            {/* 未生成ヒント */}
            {!result && !busy && (
              <p className="text-[11px] text-text-muted/45 text-center leading-relaxed py-2">
                使う要素を選んで「アレンジ生成」を押してください。
              </p>
            )}
          </>
        )}
      </div>

      {/* フッター：生成画面へ送る */}
      {result && (
        <div className="border-t border-violet-400/20 px-3.5 py-2.5 bg-bg-panel/40">
          <button type="button" onClick={onSendToGenerator}
            className="w-full rounded-lg px-3 py-2 text-[12px] font-bold border border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25 transition">
            🚀 この設定を生成画面へ送る
          </button>
        </div>
      )}
    </div>
  );
}
