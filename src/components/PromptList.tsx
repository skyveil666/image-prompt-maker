import { useMemo, useState } from "react";
import type { PromptHistoryItem } from "../types";
import { PromptCard } from "./PromptCard";
import type { LockState } from "../lib/promptLockCheck";
import type { SkyveilProfile } from "../lib/skyveilProfile";

interface Props {
  title: string;
  subtitle: string;
  items: PromptHistoryItem[];
  onUpdate: (id: string, patch: Partial<PromptHistoryItem>) => void;
  onArrange?: (item: PromptHistoryItem) => void;
  /** ガードパネル用：変更禁止チェック・スコアのロック状態 */
  lock?: LockState;
  skyveilProfile?: SkyveilProfile | null;
}

/** PromptCard へ渡すガード関連 props をまとめた型（prop-drilling 簡略化） */
type GuardProps = { lock?: LockState; skyveilProfile?: SkyveilProfile | null };

type ViewMode = "normal" | "tab" | "split";

// ─── Line-level diff helper ────────────────────────────────────────────────

interface DiffLine {
  text: string;
  /** 0 = same, 1 = only in A (rose), 2 = only in B (blue) */
  kind: 0 | 1 | 2;
}

function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.split(/\n/);
  const bLines = b.split(/\n/);
  const result: DiffLine[] = [];
  const maxLen = Math.max(aLines.length, bLines.length);

  for (let i = 0; i < maxLen; i++) {
    const al = aLines[i];
    const bl = bLines[i];
    if (al === undefined) {
      result.push({ text: bl, kind: 2 });
    } else if (bl === undefined) {
      result.push({ text: al, kind: 1 });
    } else if (al === bl) {
      result.push({ text: al, kind: 0 });
    } else {
      result.push({ text: al, kind: 1 });
      result.push({ text: bl, kind: 2 });
    }
  }
  return result;
}

// ─── SplitView ────────────────────────────────────────────────────────────

function SplitView({
  items,
  onUpdate,
  onArrange,
  guard,
}: {
  items: PromptHistoryItem[];
  onUpdate: (id: string, patch: Partial<PromptHistoryItem>) => void;
  onArrange?: (item: PromptHistoryItem) => void;
  guard: GuardProps;
}) {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, items.length - 1));

  const leftItem  = items[leftIdx];
  const rightItem = items[rightIdx];

  const diffResult = useMemo(
    () => diffLines(leftItem?.promptText ?? "", rightItem?.promptText ?? ""),
    [leftItem?.promptText, rightItem?.promptText]
  );

  const hasDiff = diffResult.some((l) => l.kind !== 0);

  return (
    <div className="space-y-4">
      {/* 案選択ドロップダウン */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-rose-300/80 font-semibold">左：</span>
          <select
            value={leftIdx}
            onChange={(e) => setLeftIdx(Number(e.target.value))}
            className="rounded-lg px-3 py-1.5 text-xs border border-rose-400/40 bg-rose-400/8 text-text-base outline-none cursor-pointer"
          >
            {items.map((it, i) => (
              <option key={it.id} value={i}>
                案{it.proposalIndex}
              </option>
            ))}
          </select>
        </div>
        <span className="text-text-muted/40 text-sm">vs</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-300/80 font-semibold">右：</span>
          <select
            value={rightIdx}
            onChange={(e) => setRightIdx(Number(e.target.value))}
            className="rounded-lg px-3 py-1.5 text-xs border border-blue-400/40 bg-blue-400/8 text-text-base outline-none cursor-pointer"
          >
            {items.map((it, i) => (
              <option key={it.id} value={i}>
                案{it.proposalIndex}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto text-[11px] text-text-muted/60">
          {hasDiff ? "差分あり" : "完全一致"}
        </span>
      </div>

      {/* 差分ビュー（テキスト比較） */}
      <div className="rounded-2xl border border-bg-border bg-[#0c0f15] overflow-hidden">
        <div className="px-4 py-2 border-b border-bg-border/60 flex items-center gap-3 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/50 border border-rose-400/60 inline-block" />
            案{leftItem?.proposalIndex} のみ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/50 border border-blue-400/60 inline-block" />
            案{rightItem?.proposalIndex} のみ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-bg-panel border border-bg-border inline-block" />
            共通
          </span>
        </div>
        <pre
          className="m-0 px-5 py-4 text-[13px] font-mono whitespace-pre-wrap break-words max-h-[480px] overflow-y-auto"
          style={{ lineHeight: "1.9", overflowWrap: "anywhere" }}
        >
          {diffResult.map((line, i) => (
            <span
              key={i}
              className={[
                "block",
                line.kind === 1
                  ? "bg-rose-500/18 text-rose-200 border-l-2 border-rose-400/60 pl-2 -ml-2"
                  : line.kind === 2
                  ? "bg-blue-500/18 text-blue-200 border-l-2 border-blue-400/60 pl-2 -ml-2"
                  : "text-text-base",
              ].join(" ")}
            >
              {line.text || " "}
            </span>
          ))}
        </pre>
      </div>

      {/* 両カード並べて表示 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-rose-300/70 px-1">
            ← 案{leftItem?.proposalIndex}
          </div>
          {leftItem && (
            <PromptCard item={leftItem} onUpdate={onUpdate} onArrange={onArrange} {...guard} />
          )}
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-blue-300/70 px-1">
            → 案{rightItem?.proposalIndex}
          </div>
          {rightItem && (
            <PromptCard item={rightItem} onUpdate={onUpdate} onArrange={onArrange} {...guard} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TabView ──────────────────────────────────────────────────────────────

function TabView({
  items,
  onUpdate,
  onArrange,
  guard,
}: {
  items: PromptHistoryItem[];
  onUpdate: (id: string, patch: Partial<PromptHistoryItem>) => void;
  onArrange?: (item: PromptHistoryItem) => void;
  guard: GuardProps;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = items[activeIdx];

  return (
    <div className="space-y-3">
      {/* タブ行 */}
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={[
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition",
              i === activeIdx
                ? "border-accent/80 bg-accent/20 text-text-base shadow-[0_0_10px_rgba(139,92,246,0.25)]"
                : "border-bg-border bg-bg-panel text-text-muted hover:border-accent/40 hover:text-text-base",
            ].join(" ")}
          >
            案{it.proposalIndex}
            {it.isFavorite && <span className="ml-1">⭐</span>}
            {it.locked && <span className="ml-1">🔒</span>}
          </button>
        ))}
      </div>

      {/* 選択中カード */}
      {active && (
        <PromptCard item={active} onUpdate={onUpdate} onArrange={onArrange} {...guard} />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

/** localStorage キー：全案コピー済み（batchId ごと） */
const allCopiedKey = (batchId: string) => `all_copied_${batchId}`;

export function PromptList({ title, subtitle, items, onUpdate, onArrange, lock, skyveilProfile }: Props) {
  const batchId = items[0]?.batchId ?? "";
  const guard: GuardProps = { lock, skyveilProfile };

  /** 全案コピー済み：localStorage に永続保存 */
  const [copiedAll, setCopiedAll] = useState(() => {
    if (!batchId) return false;
    try { return localStorage.getItem(allCopiedKey(batchId)) === "1"; } catch { return false; }
  });

  const [viewMode, setViewMode] = useState<ViewMode>("normal");

  const copyAll = async () => {
    const joined = items
      .map((p) => `# 案${p.proposalIndex}\n${p.promptText}`)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(joined);
      setCopiedAll(true);
      if (batchId) {
        try { localStorage.setItem(allCopiedKey(batchId), "1"); } catch {}
      }
    } catch {
      // clipboard API 失敗時のフォールバック
      window.prompt("全案コピー（手動でコピーしてください）:", joined);
    }
  };

  if (items.length === 0) return null;

  const VIEW_MODES: { id: ViewMode; label: string; title: string; disabled?: boolean }[] = [
    { id: "normal", label: "通常",    title: "全案を縦に並べて表示" },
    { id: "tab",    label: "タブ",    title: "タブで1案ずつ切り替え" },
    { id: "split",  label: "2分割",   title: "2案を並べて差分比較", disabled: items.length < 2 },
  ];

  return (
    <section className="card">
      {/* ── ヘッダー ──────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-white/80">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 表示モード切り替え */}
          <div className="flex rounded-lg overflow-hidden border border-bg-border">
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.disabled ? "2案以上必要です" : m.title}
                disabled={m.disabled}
                onClick={() => !m.disabled && setViewMode(m.id)}
                className={[
                  "px-3 py-1.5 text-xs font-semibold border-r last:border-r-0 border-bg-border transition",
                  m.disabled
                    ? "opacity-35 cursor-not-allowed bg-bg-panel text-text-muted"
                    : viewMode === m.id
                    ? "bg-accent/20 text-text-base border-accent/30"
                    : "bg-bg-panel text-text-muted hover:text-text-base hover:bg-bg-panel/80",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* 全案コピー */}
          <button
            type="button"
            onClick={copyAll}
            title={copiedAll ? "再コピー（全案）" : undefined}
            className={[
              "group inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold border transition-all duration-200",
              copiedAll
                ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                : "border-bg-border bg-bg-panel text-text-muted hover:border-accent/60 hover:text-text-base",
            ].join(" ")}
          >
            {copiedAll ? (
              <>
                <span className="group-hover:hidden">✅</span>
                <span className="group-hover:hidden">全案コピー済み</span>
                <span className="hidden group-hover:inline">🔄</span>
                <span className="hidden group-hover:inline">再コピー</span>
              </>
            ) : (
              <><span>📋</span><span>全案コピー</span></>
            )}
          </button>
        </div>
      </div>

      {/* ── コンテンツ ─────────────────────────────────────────────────── */}
      {viewMode === "normal" && (
        <div className="flex flex-col gap-6">
          {items.map((item) => (
            <PromptCard key={item.id} item={item} onUpdate={onUpdate} onArrange={onArrange} {...guard} />
          ))}
        </div>
      )}

      {viewMode === "tab" && (
        <TabView items={items} onUpdate={onUpdate} onArrange={onArrange} guard={guard} />
      )}

      {viewMode === "split" && (
        <SplitView items={items} onUpdate={onUpdate} onArrange={onArrange} guard={guard} />
      )}
    </section>
  );
}
