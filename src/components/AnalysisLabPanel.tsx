/**
 * AnalysisLabPanel — 分析ラボ（重複分析の詳細探索・全幅ビュー）。docs/26 Lab-1。
 *
 * ダッシュボード（重複分析タブ・TOP10概要）とは別画面。同じデータ・同じハンドラを再利用し、
 * 件数(10/20/50/100/全件) / カテゴリ・リスクフィルタ / 検索 / ソート / NG一括 / 一括ポリシー を提供する。
 *
 * 不変条件: 分析ロジック・既存ハンドラ・保存形式は一切変更しない（読む＋既存ハンドラ呼び出しのみ）。
 * タグ（Lab-2）は未実装。
 */
import { useEffect, useMemo, useState } from "react";
import type { MotifCount, MotifCombo } from "../lib/historyAnalyzer";
import {
  LEVEL_META,
  DEFAULT_LEVEL,
  type MotifLevel,
  type LevelMap,
  type ComboPolicy,
  type ComboPolicyMap,
} from "../lib/motifPolicy";
import {
  loadMotifTags,
  saveMotifTags,
  tagsForMotif,
  addTagToMotifs,
  removeTagFromMotifs,
  allMotifTags,
  type MotifTagMap,
} from "../lib/motifTags";

type LabTab = "element" | "combo";
type ElemSort = "count" | "recent" | "fav" | "level" | "name" | "cat";
type ComboSort = "count" | "risk" | "name";

const COUNT_OPTIONS: number[] = [10, 20, 50, 100, Infinity];
const countLabel = (n: number) => (n === Infinity ? "全件" : String(n));

const RISK_RANK: Record<MotifCombo["risk"], number> = { danger: 3, high: 2, medium: 1, low: 0 };
const RISK_LABEL: Record<MotifCombo["risk"], string> = { danger: "危険", high: "高", medium: "中", low: "低" };
const RISK_CLASS: Record<MotifCombo["risk"], string> = {
  danger: "text-rose-300 border-rose-400/40 bg-rose-500/12",
  high: "text-amber-300 border-amber-400/40 bg-amber-500/12",
  medium: "text-yellow-200 border-yellow-300/35 bg-yellow-400/10",
  low: "text-emerald-300 border-emerald-400/35 bg-emerald-500/10",
};
const COMBO_POLICIES: { key: ComboPolicy; label: string }[] = [
  { key: "block", label: "今後出さない" },
  { key: "alt", label: "別ジャンル化" },
  { key: "allow", label: "許可" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  motifCounts: MotifCount[];
  topCombos: MotifCombo[];
  levels: LevelMap;
  comboPolicies: ComboPolicyMap;
  onLevelChange: (motifId: string, level: MotifLevel) => void;
  onBulkLevel: (motifIds: string[], level: MotifLevel) => void;
  onComboPolicyChange: (comboKey: string, policy: ComboPolicy) => void;
}

export function AnalysisLabPanel({
  open, onClose, motifCounts, topCombos, levels, comboPolicies,
  onLevelChange, onBulkLevel, onComboPolicyChange,
}: Props) {
  const [tab, setTab] = useState<LabTab>("element");

  // 頻出要素タブ
  const [elemCount, setElemCount] = useState<number>(20);
  const [elemCat, setElemCat] = useState<string>("all");
  const [elemSearch, setElemSearch] = useState("");
  const [elemSort, setElemSort] = useState<ElemSort>("count");
  const [elemSel, setElemSel] = useState<Set<string>>(new Set());
  const [elemTag, setElemTag] = useState<string>("all");
  // Lab-2: モチーフ自由タグ（ラボ内メタデータ・localStorage 自己管理。生成には不使用）
  const [motifTags, setMotifTags] = useState<MotifTagMap>({});
  const [tagInput, setTagInput] = useState("");

  // 頻出構成タブ
  const [comboCount, setComboCount] = useState<number>(20);
  const [comboRisk, setComboRisk] = useState<string>("all");
  const [comboSearch, setComboSearch] = useState("");
  const [comboSort, setComboSort] = useState<ComboSort>("count");
  const [comboSel, setComboSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lab-2: 開いたらタグを読み込み（localStorage）
  useEffect(() => { if (open) setMotifTags(loadMotifTags()); }, [open]);

  const categories = useMemo(
    () => Array.from(new Set(motifCounts.map((m) => m.motif.category))),
    [motifCounts],
  );
  const lvlOf = (id: string): MotifLevel => levels[id] ?? DEFAULT_LEVEL;

  const tagOptions = useMemo(() => allMotifTags(motifTags), [motifTags]);

  const filteredElements = useMemo(() => {
    let arr = motifCounts.slice();
    if (elemCat !== "all") arr = arr.filter((m) => m.motif.category === elemCat);
    if (elemTag !== "all") arr = arr.filter((m) => tagsForMotif(motifTags, m.motif.id).includes(elemTag));
    const q = elemSearch.trim().toLowerCase();
    if (q) arr = arr.filter((m) =>
      m.motif.label.toLowerCase().includes(q) ||
      (m.motif.tokens ?? []).some((t) => t.toLowerCase().includes(q)));
    arr.sort((a, b) => {
      switch (elemSort) {
        case "recent": return b.recentCount - a.recentCount;
        case "fav": return b.favoriteCount - a.favoriteCount;
        case "level": return (levels[a.motif.id] ?? DEFAULT_LEVEL) - (levels[b.motif.id] ?? DEFAULT_LEVEL);
        case "name": return a.motif.label.localeCompare(b.motif.label, "ja");
        case "cat": return a.motif.category.localeCompare(b.motif.category, "ja") || b.totalCount - a.totalCount;
        default: return b.totalCount - a.totalCount;
      }
    });
    return arr;
  }, [motifCounts, elemCat, elemTag, elemSearch, elemSort, levels, motifTags]);
  const shownElements = useMemo(
    () => (elemCount === Infinity ? filteredElements : filteredElements.slice(0, elemCount)),
    [filteredElements, elemCount],
  );

  const filteredCombos = useMemo(() => {
    let arr = topCombos.slice();
    if (comboRisk !== "all") arr = arr.filter((c) => c.risk === comboRisk);
    const q = comboSearch.trim().toLowerCase();
    if (q) arr = arr.filter((c) => c.motifLabels.some((l) => l.toLowerCase().includes(q)));
    arr.sort((a, b) => {
      switch (comboSort) {
        case "risk": return (RISK_RANK[b.risk] - RISK_RANK[a.risk]) || (b.count - a.count);
        case "name": return a.motifLabels.join("").localeCompare(b.motifLabels.join(""), "ja");
        default: return b.count - a.count;
      }
    });
    return arr;
  }, [topCombos, comboRisk, comboSearch, comboSort]);
  const shownCombos = useMemo(
    () => (comboCount === Infinity ? filteredCombos : filteredCombos.slice(0, comboCount)),
    [filteredCombos, comboCount],
  );

  if (!open) return null;

  // ── 選択ヘルパ ──
  const toggleElem = (id: string) => setElemSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const shownElemIds = shownElements.map((m) => m.motif.id);
  const elemAllSelected = shownElemIds.length > 0 && shownElemIds.every((id) => elemSel.has(id));
  const toggleAllElem = () => setElemSel((s) => {
    const n = new Set(s);
    if (elemAllSelected) shownElemIds.forEach((id) => n.delete(id));
    else shownElemIds.forEach((id) => n.add(id));
    return n;
  });
  const applyBulkLevel = (level: MotifLevel) => { const ids = [...elemSel]; if (ids.length) onBulkLevel(ids, level); };

  // Lab-2: タグ操作（ラボ内・localStorage 即保存。生成には不使用）
  const applyAddTag = () => {
    const ids = [...elemSel];
    if (!ids.length || !tagInput.trim()) return;
    setMotifTags((prev) => { const next = addTagToMotifs(prev, ids, tagInput); saveMotifTags(next); return next; });
    setTagInput("");
  };
  const applyRemoveTag = () => {
    const ids = [...elemSel];
    if (!ids.length || !tagInput.trim()) return;
    setMotifTags((prev) => { const next = removeTagFromMotifs(prev, ids, tagInput); saveMotifTags(next); return next; });
  };
  const removeMotifTag = (id: string, tag: string) => {
    setMotifTags((prev) => { const next = removeTagFromMotifs(prev, [id], tag); saveMotifTags(next); return next; });
  };

  const toggleCombo = (key: string) => setComboSel((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const shownComboKeys = shownCombos.map((c) => c.comboKey);
  const comboAllSelected = shownComboKeys.length > 0 && shownComboKeys.every((k) => comboSel.has(k));
  const toggleAllCombo = () => setComboSel((s) => {
    const n = new Set(s);
    if (comboAllSelected) shownComboKeys.forEach((k) => n.delete(k));
    else shownComboKeys.forEach((k) => n.add(k));
    return n;
  });
  const applyBulkPolicy = (policy: ComboPolicy) => { comboSel.forEach((k) => onComboPolicyChange(k, policy)); };

  const selectCls = "rounded border border-bg-border bg-bg-base/60 text-[11px] text-text-base px-1.5 py-1 focus:outline-none focus:border-violet-400/60";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-[1400px] h-[92vh] flex flex-col rounded-xl border border-bg-border bg-bg-panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダ */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bg-border shrink-0">
          <span className="text-[15px]">🔬</span>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-bold text-text-base">分析ラボ</span>
            <span className="text-[10px] text-text-muted/70">頻出要素・頻出構成を 件数 / フィルタ / 検索 / ソート / 一括編集 で詳細探索（分析ロジックは不変）</span>
          </div>
          <button type="button" onClick={onClose}
            className="ml-auto text-[12px] px-2.5 py-1 rounded border border-bg-border bg-bg-base/60 text-text-muted hover:text-text-base transition">✕ 閉じる</button>
        </div>

        {/* タブ */}
        <div className="flex items-center gap-1 px-3 pt-2 shrink-0">
          {([["element", "頻出要素"], ["combo", "頻出構成"]] as [LabTab, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={["text-[12px] px-3 py-1.5 rounded-t-lg border-b-2 transition",
                tab === k ? "border-violet-400 text-text-base font-bold bg-bg-base/40" : "border-transparent text-text-muted hover:text-text-base"].join(" ")}>
              {label}（{k === "element" ? motifCounts.length : topCombos.length}）
            </button>
          ))}
        </div>

        {/* ───────── 頻出要素タブ ───────── */}
        {tab === "element" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* ツールバー */}
            <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-bg-border shrink-0">
              <label className="flex items-center gap-1 text-[10px] text-text-muted">件数
                <select className={selectCls} value={String(elemCount)} onChange={(e) => setElemCount(Number(e.target.value))}>
                  {COUNT_OPTIONS.map((n) => <option key={n} value={String(n)}>{countLabel(n)}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-text-muted">カテゴリ
                <select className={selectCls} value={elemCat} onChange={(e) => setElemCat(e.target.value)}>
                  <option value="all">すべて</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-text-muted">タグ
                <select className={selectCls} value={elemTag} onChange={(e) => setElemTag(e.target.value)} disabled={tagOptions.length === 0}>
                  <option value="all">すべて</option>
                  {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-text-muted">ソート
                <select className={selectCls} value={elemSort} onChange={(e) => setElemSort(e.target.value as ElemSort)}>
                  <option value="count">出現回数</option>
                  <option value="recent">直近</option>
                  <option value="fav">お気に入り</option>
                  <option value="level">レベル</option>
                  <option value="name">名前</option>
                  <option value="cat">カテゴリ</option>
                </select>
              </label>
              <input className={`${selectCls} flex-1 min-w-[120px]`} placeholder="🔎 要素を検索（名前・キーワード）"
                value={elemSearch} onChange={(e) => setElemSearch(e.target.value)} />
              <span className="text-[10px] text-text-muted/60">{filteredElements.length}件中 {shownElements.length}件表示</span>
            </div>

            {/* テーブル */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-bg-panel">
                  <tr className="text-text-muted/70 border-b border-bg-border">
                    <th className="w-7 px-1 py-1"><input type="checkbox" checked={elemAllSelected} onChange={toggleAllElem} aria-label="全選択" /></th>
                    <th className="text-left font-semibold px-2 py-1">要素</th>
                    <th className="text-left font-semibold px-2 py-1 w-16">カテゴリ</th>
                    <th className="text-right font-semibold px-2 py-1 w-12">出現</th>
                    <th className="text-right font-semibold px-2 py-1 w-12">直近</th>
                    <th className="text-right font-semibold px-2 py-1 w-10">⭐</th>
                    <th className="text-left font-semibold px-2 py-1">レベル（NG・0-5）</th>
                    <th className="text-left font-semibold px-2 py-1 w-40">タグ</th>
                  </tr>
                </thead>
                <tbody>
                  {shownElements.map((m) => {
                    const cur = lvlOf(m.motif.id);
                    const sel = elemSel.has(m.motif.id);
                    return (
                      <tr key={m.motif.id} className={["border-b border-bg-border/50", sel ? "bg-violet-500/8" : ""].join(" ")}>
                        <td className="px-1 py-1.5 text-center"><input type="checkbox" checked={sel} onChange={() => toggleElem(m.motif.id)} /></td>
                        <td className="px-2 py-1.5 text-text-base font-medium">{m.motif.label}</td>
                        <td className="px-2 py-1.5 text-text-muted">{m.motif.category}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-base/90">{m.totalCount}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{m.recentCount}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{m.favoriteCount}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex gap-0.5">
                            {LEVEL_META.map((lm) => (
                              <button key={lm.level} type="button" title={lm.full}
                                onClick={() => onLevelChange(m.motif.id, lm.level)}
                                className={["px-1.5 py-0.5 rounded text-[10px] border leading-none transition",
                                  cur === lm.level ? lm.activeBtn : "border-bg-border text-text-muted/60 hover:text-text-base hover:border-violet-400/40"].join(" ")}>
                                {lm.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {tagsForMotif(motifTags, m.motif.id).map((t) => (
                              <span key={t} className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-violet-500/15 border border-violet-400/30 text-violet-100">
                                {t}
                                <button type="button" onClick={() => removeMotifTag(m.motif.id, t)} title="タグを外す"
                                  className="text-violet-200/70 hover:text-rose-300 leading-none">×</button>
                              </span>
                            ))}
                            {tagsForMotif(motifTags, m.motif.id).length === 0 && <span className="text-text-muted/35 text-[10px]">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {shownElements.length === 0 && (
                    <tr><td colSpan={8} className="px-2 py-6 text-center text-[11px] text-text-muted">該当する要素がありません。</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* NG一括バー */}
            {elemSel.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-t border-bg-border bg-bg-base/40 shrink-0">
                <span className="text-[11px] text-text-base font-semibold">選択 {elemSel.size}件 → 一括レベル：</span>
                {LEVEL_META.map((lm) => (
                  <button key={lm.level} type="button" title={lm.full} onClick={() => applyBulkLevel(lm.level)}
                    className="px-2 py-1 rounded text-[11px] border border-bg-border text-text-base hover:border-violet-400/60 hover:bg-violet-500/10 transition">
                    {lm.label}
                  </button>
                ))}
                <span className="text-text-muted/30 select-none">｜</span>
                <span className="text-[11px] text-text-base font-semibold">タグ一括：</span>
                <input className={`${selectCls} w-28`} placeholder="タグ名" value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyAddTag(); }} />
                <button type="button" onClick={applyAddTag} disabled={!tagInput.trim()}
                  className="px-2 py-1 rounded text-[11px] border border-violet-400/50 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed">＋付与</button>
                <button type="button" onClick={applyRemoveTag} disabled={!tagInput.trim()}
                  className="px-2 py-1 rounded text-[11px] border border-bg-border text-text-muted hover:text-rose-300 transition disabled:opacity-40 disabled:cursor-not-allowed">－削除</button>
                <button type="button" onClick={() => setElemSel(new Set())}
                  className="ml-auto text-[11px] px-2 py-1 rounded border border-bg-border text-text-muted hover:text-text-base">選択解除</button>
              </div>
            )}
          </div>
        )}

        {/* ───────── 頻出構成タブ ───────── */}
        {tab === "combo" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-bg-border shrink-0">
              <label className="flex items-center gap-1 text-[10px] text-text-muted">件数
                <select className={selectCls} value={String(comboCount)} onChange={(e) => setComboCount(Number(e.target.value))}>
                  {COUNT_OPTIONS.map((n) => <option key={n} value={String(n)}>{countLabel(n)}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-text-muted">リスク
                <select className={selectCls} value={comboRisk} onChange={(e) => setComboRisk(e.target.value)}>
                  <option value="all">すべて</option>
                  <option value="danger">危険</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-text-muted">ソート
                <select className={selectCls} value={comboSort} onChange={(e) => setComboSort(e.target.value as ComboSort)}>
                  <option value="count">出現回数</option>
                  <option value="risk">リスク</option>
                  <option value="name">名前</option>
                </select>
              </label>
              <input className={`${selectCls} flex-1 min-w-[120px]`} placeholder="🔎 構成を検索（要素名）"
                value={comboSearch} onChange={(e) => setComboSearch(e.target.value)} />
              <span className="text-[10px] text-text-muted/60">{filteredCombos.length}件中 {shownCombos.length}件表示</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-bg-panel">
                  <tr className="text-text-muted/70 border-b border-bg-border">
                    <th className="w-7 px-1 py-1"><input type="checkbox" checked={comboAllSelected} onChange={toggleAllCombo} aria-label="全選択" /></th>
                    <th className="text-left font-semibold px-2 py-1">構成（組み合わせ）</th>
                    <th className="text-center font-semibold px-2 py-1 w-12">リスク</th>
                    <th className="text-right font-semibold px-2 py-1 w-12">出現</th>
                    <th className="text-left font-semibold px-2 py-1">ポリシー</th>
                  </tr>
                </thead>
                <tbody>
                  {shownCombos.map((c) => {
                    const cur = comboPolicies[c.comboKey] ?? "allow";
                    const sel = comboSel.has(c.comboKey);
                    return (
                      <tr key={c.comboKey} className={["border-b border-bg-border/50", sel ? "bg-violet-500/8" : ""].join(" ")}>
                        <td className="px-1 py-1.5 text-center"><input type="checkbox" checked={sel} onChange={() => toggleCombo(c.comboKey)} /></td>
                        <td className="px-2 py-1.5 text-text-base font-medium">{c.motifLabels.join(" ＋ ")}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={["text-[9px] px-1.5 py-0.5 rounded border", RISK_CLASS[c.risk]].join(" ")}>{RISK_LABEL[c.risk]}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-base/90">{c.count}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex gap-1">
                            {COMBO_POLICIES.map((p) => (
                              <button key={p.key} type="button" onClick={() => onComboPolicyChange(c.comboKey, p.key)}
                                className={["px-1.5 py-0.5 rounded text-[10px] border leading-none transition",
                                  cur === p.key
                                    ? (p.key === "allow" ? "border-emerald-400 bg-emerald-500/70 text-white" : "border-rose-400 bg-rose-500/70 text-white")
                                    : "border-bg-border text-text-muted/60 hover:text-text-base hover:border-violet-400/40"].join(" ")}>
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {shownCombos.length === 0 && (
                    <tr><td colSpan={5} className="px-2 py-6 text-center text-[11px] text-text-muted">該当する構成がありません。</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {comboSel.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-t border-bg-border bg-bg-base/40 shrink-0">
                <span className="text-[11px] text-text-base font-semibold">選択 {comboSel.size}件 → 一括ポリシー：</span>
                {COMBO_POLICIES.map((p) => (
                  <button key={p.key} type="button" onClick={() => applyBulkPolicy(p.key)}
                    className="px-2 py-1 rounded text-[11px] border border-bg-border text-text-base hover:border-violet-400/60 hover:bg-violet-500/10 transition">
                    {p.label}
                  </button>
                ))}
                <button type="button" onClick={() => setComboSel(new Set())}
                  className="ml-auto text-[11px] px-2 py-1 rounded border border-bg-border text-text-muted hover:text-text-base">選択解除</button>
              </div>
            )}
          </div>
        )}

        {/* フッタ注記 */}
        <div className="px-3 py-1.5 border-t border-bg-border shrink-0">
          <p className="text-[10px] text-text-muted/55 leading-snug">
            ※ レベル・ポリシーの変更はダッシュボードと共通（即保存）。生成への反映は重複分析タブの「提案を反映」を押した時のみ。タグ一括編集は次段階（Lab-2）で追加予定。
          </p>
        </div>
      </div>
    </div>
  );
}
