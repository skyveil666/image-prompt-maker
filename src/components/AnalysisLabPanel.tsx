/**
 * AnalysisLabPanel — 分析ラボ（重複分析の詳細探索・全幅ビュー）。docs/26 Lab-1/2・docs/28 P2。
 *
 * ダッシュボード（重複分析タブ・TOP10概要）とは別画面。同じデータ・同じハンドラを再利用し、
 * 件数(10/20/50/100/全件) / カテゴリ・リスクフィルタ / 検索 / ソート / NG一括 / 一括ポリシー / タグ一括 を提供する。
 * P2: 未開拓度（untappedScore）列＋ソート、🔭未開拓ビュー（未踏の表現領域発見）、カテゴリ色チップ＋順序フィルタ、
 *     一括操作はフィルタ全件対象（290要素規模対応）。仮想化はせずページング維持。
 *
 * 不変条件: 分析ロジック・既存ハンドラ・保存形式は一切変更しない（読む＋既存ハンドラ呼び出しのみ）。
 */
import { useEffect, useMemo, useState } from "react";
import type { MotifCount, MotifCombo } from "../lib/historyAnalyzer";
import { categoryColorClass } from "../lib/biasAnalyzer";
import { MOTIF_CATEGORY_ORDER } from "../data/monitoredMotifs";
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
import type { CandidateMotif } from "../lib/discoveryMotifs";

type LabTab = "element" | "combo" | "discovery";
type ElemSort = "count" | "recent" | "fav" | "level" | "name" | "cat" | "untapped";
type ComboSort = "count" | "risk" | "name";

const COUNT_OPTIONS: number[] = [10, 20, 50, 100, Infinity];
const countLabel = (n: number) => (n === Infinity ? "全件" : String(n));

// 未開拓度バーの色（高いほど狙い目＝緑／中＝琥珀／低＝淡）。docs/28 P2。
const UNTAPPED_THRESHOLD = 80;
const untappedBarClass = (s: number) =>
  s >= UNTAPPED_THRESHOLD ? "bg-emerald-400" : s >= 40 ? "bg-amber-400" : "bg-text-muted/40";

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
  /** P3 発見層：監視外の頻出新語候補（任意） */
  candidates?: CandidateMotif[];
  /** P3 発見層：候補を無視リストへ（任意） */
  onIgnoreTerm?: (term: string) => void;
}

export function AnalysisLabPanel({
  open, onClose, motifCounts, topCombos, levels, comboPolicies,
  onLevelChange, onBulkLevel, onComboPolicyChange,
  candidates = [], onIgnoreTerm,
}: Props) {
  const [tab, setTab] = useState<LabTab>("element");

  // 頻出要素タブ
  const [elemCount, setElemCount] = useState<number>(20);
  const [elemCat, setElemCat] = useState<string>("all");
  const [elemSearch, setElemSearch] = useState("");
  const [elemSort, setElemSort] = useState<ElemSort>("count");
  const [elemSel, setElemSel] = useState<Set<string>>(new Set());
  const [elemTag, setElemTag] = useState<string>("all");
  // P2: 未開拓ビュー（未踏の表現領域＝低出現要素のみ）
  const [untappedOnly, setUntappedOnly] = useState(false);
  // Lab-2: モチーフ自由タグ（ラボ内メタデータ・localStorage 自己管理。生成には不使用）
  const [motifTags, setMotifTags] = useState<MotifTagMap>({});
  const [tagInput, setTagInput] = useState("");

  // 頻出構成タブ
  const [comboCount, setComboCount] = useState<number>(20);
  const [comboRisk, setComboRisk] = useState<string>("all");
  const [comboSearch, setComboSearch] = useState("");
  const [comboSort, setComboSort] = useState<ComboSort>("count");
  const [comboSel, setComboSel] = useState<Set<string>>(new Set());

  // 🔭 発見タブ（P3a）
  const [discCount, setDiscCount] = useState<number>(20);
  const [discSearch, setDiscSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lab-2: 開いたらタグを読み込み（localStorage）
  useEffect(() => { if (open) setMotifTags(loadMotifTags()); }, [open]);

  // P2: 実データに存在するカテゴリを MOTIF_CATEGORY_ORDER 順に整列（従来は Set 順＝不定）。
  const categories = useMemo(() => {
    const present = new Set<string>(motifCounts.map((m) => m.motif.category));
    return MOTIF_CATEGORY_ORDER.filter((c) => present.has(c));
  }, [motifCounts]);
  const lvlOf = (id: string): MotifLevel => levels[id] ?? DEFAULT_LEVEL;

  // P2: カテゴリ別「未出現(totalCount=0)」集計＝未踏の表現領域（新軸探索の入口）。多い順。
  const untappedByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const mc of motifCounts) {
      if (mc.totalCount === 0) m.set(mc.motif.category, (m.get(mc.motif.category) ?? 0) + 1);
    }
    return MOTIF_CATEGORY_ORDER
      .filter((c) => m.has(c))
      .map((c) => ({ cat: c, n: m.get(c)! }))
      .sort((a, b) => b.n - a.n);
  }, [motifCounts]);

  const tagOptions = useMemo(() => allMotifTags(motifTags), [motifTags]);

  const filteredElements = useMemo(() => {
    let arr = motifCounts.slice();
    if (elemCat !== "all") arr = arr.filter((m) => m.motif.category === elemCat);
    if (elemTag !== "all") arr = arr.filter((m) => tagsForMotif(motifTags, m.motif.id).includes(elemTag));
    if (untappedOnly) arr = arr.filter((m) => m.untappedScore >= UNTAPPED_THRESHOLD);
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
        case "untapped": return (b.untappedScore - a.untappedScore) || (a.totalCount - b.totalCount);
        default: return b.totalCount - a.totalCount;
      }
    });
    return arr;
  }, [motifCounts, elemCat, elemTag, untappedOnly, elemSearch, elemSort, levels, motifTags]);
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

  // 🔭 発見タブ（P3a）：候補の検索フィルタ＋件数
  const filteredCandidates = useMemo(() => {
    const q = discSearch.trim().toLowerCase();
    return q ? candidates.filter((c) => c.term.includes(q)) : candidates;
  }, [candidates, discSearch]);
  const shownCandidates = useMemo(
    () => (discCount === Infinity ? filteredCandidates : filteredCandidates.slice(0, discCount)),
    [filteredCandidates, discCount],
  );

  // フィルタ変更で表示対象から外れた選択を破棄（UIの「選択N件」と実適用の乖離を防ぐ）。
  useEffect(() => {
    const valid = new Set(filteredElements.map((m) => m.motif.id));
    setElemSel((s) => {
      let changed = false;
      const n = new Set<string>();
      for (const id of s) { if (valid.has(id)) n.add(id); else changed = true; }
      return changed ? n : s;
    });
  }, [filteredElements]);
  useEffect(() => {
    const valid = new Set(filteredCombos.map((c) => c.comboKey));
    setComboSel((s) => {
      let changed = false;
      const n = new Set<string>();
      for (const k of s) { if (valid.has(k)) n.add(k); else changed = true; }
      return changed ? n : s;
    });
  }, [filteredCombos]);

  if (!open) return null;

  // ── 選択ヘルパ ──
  const toggleElem = (id: string) => setElemSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // P2: 全選択は「表示中(slice後)」ではなく「フィルタ全件」を対象（290規模で意図どおり一括できるように）。
  const filteredElemIds = filteredElements.map((m) => m.motif.id);
  const elemAllSelected = filteredElemIds.length > 0 && filteredElemIds.every((id) => elemSel.has(id));
  const toggleAllElem = () => setElemSel((s) => {
    const n = new Set(s);
    if (elemAllSelected) filteredElemIds.forEach((id) => n.delete(id));
    else filteredElemIds.forEach((id) => n.add(id));
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
  // 全選択は「表示中(slice後)」ではなく「フィルタ全件」を対象（ページング時の不整合を防ぐ）。
  const filteredComboKeys = filteredCombos.map((c) => c.comboKey);
  const comboAllSelected = filteredComboKeys.length > 0 && filteredComboKeys.every((k) => comboSel.has(k));
  const toggleAllCombo = () => setComboSel((s) => {
    const n = new Set(s);
    if (comboAllSelected) filteredComboKeys.forEach((k) => n.delete(k));
    else filteredComboKeys.forEach((k) => n.add(k));
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
          {([["element", "頻出要素"], ["combo", "頻出構成"], ["discovery", "🔭 発見"]] as [LabTab, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={["text-[12px] px-3 py-1.5 rounded-t-lg border-b-2 transition",
                tab === k ? "border-violet-400 text-text-base font-bold bg-bg-base/40" : "border-transparent text-text-muted hover:text-text-base"].join(" ")}>
              {label}（{k === "element" ? motifCounts.length : k === "combo" ? topCombos.length : candidates.length}）
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
                  <option value="untapped">未開拓度（高い順）</option>
                </select>
              </label>
              {/* P2: 未開拓ビュー＝未踏の表現領域を一発抽出（ソート未開拓↓＋未出現/低出現のみ） */}
              <button type="button"
                onClick={() => {
                  if (untappedOnly) { setUntappedOnly(false); setElemSort("count"); setElemSel(new Set()); }
                  else { setUntappedOnly(true); setElemSort("untapped"); setElemCat("all"); setElemSel(new Set()); }
                }}
                title={`未開拓度 ${UNTAPPED_THRESHOLD} 以上に絞り、未開拓度の高い順に並べます`}
                className={["text-[11px] px-2 py-1 rounded border transition whitespace-nowrap",
                  untappedOnly
                    ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100 font-semibold"
                    : "border-bg-border bg-bg-base/60 text-text-muted hover:text-text-base hover:border-emerald-400/40"].join(" ")}>
                🔭 未開拓ビュー
              </button>
              <input className={`${selectCls} flex-1 min-w-[120px]`} placeholder="🔎 要素を検索（名前・キーワード）"
                value={elemSearch} onChange={(e) => setElemSearch(e.target.value)} />
              <span className="text-[10px] text-text-muted/60">{filteredElements.length}件中 {shownElements.length}件表示</span>
            </div>

            {/* P2: 未開拓ビュー時のカテゴリ別「未出現」サマリ＝新軸探索の入口 */}
            {untappedOnly && untappedByCat.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap px-3 py-1.5 border-b border-bg-border bg-emerald-500/[0.04] shrink-0">
                <span className="text-[10px] text-emerald-200/80 font-semibold">🌱 未踏の表現領域（未出現の要素数）:</span>
                {untappedByCat.slice(0, 10).map(({ cat, n }) => (
                  <button key={cat} type="button" onClick={() => setElemCat(cat)} title={`${cat} に絞り込む`}
                    className={["text-[10px] px-1.5 py-0.5 rounded border transition hover:brightness-125",
                      categoryColorClass(cat)].join(" ")}>
                    {cat} <span className="tabular-nums opacity-80">{n}</span>
                  </button>
                ))}
              </div>
            )}

            {/* テーブル */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-bg-panel">
                  <tr className="text-text-muted/70 border-b border-bg-border">
                    <th className="w-7 px-1 py-1" title="フィルタ全件を選択"><input type="checkbox" checked={elemAllSelected} onChange={toggleAllElem} aria-label="フィルタ全件を選択" /></th>
                    <th className="text-left font-semibold px-2 py-1">要素</th>
                    <th className="text-left font-semibold px-2 py-1 w-20">カテゴリ</th>
                    <th className="text-right font-semibold px-2 py-1 w-12">出現</th>
                    <th className="text-right font-semibold px-2 py-1 w-12">直近</th>
                    <th className="text-right font-semibold px-2 py-1 w-10">⭐</th>
                    <th className="text-left font-semibold px-2 py-1 w-24" title="未開拓度＝低出現ほど高い（新軸の狙い目）">未開拓度</th>
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
                        <td className="px-2 py-1.5">
                          <span className={["inline-block text-[9px] px-1.5 py-0.5 rounded border leading-none", categoryColorClass(m.motif.category)].join(" ")}>
                            {m.motif.category}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-base/90">{m.totalCount}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{m.recentCount}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{m.favoriteCount}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1" title={`未開拓度 ${m.untappedScore}`}>
                            <div className="flex-1 h-1.5 rounded bg-bg-base/70 overflow-hidden min-w-[28px]">
                              <div className={["h-full rounded", untappedBarClass(m.untappedScore)].join(" ")} style={{ width: `${m.untappedScore}%` }} />
                            </div>
                            <span className="tabular-nums text-[10px] text-text-muted w-6 text-right">{m.untappedScore}</span>
                          </div>
                        </td>
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
                    <tr><td colSpan={9} className="px-2 py-6 text-center text-[11px] text-text-muted">{untappedOnly ? "未開拓（未出現/低出現）の要素はありません。" : "該当する要素がありません。"}</td></tr>
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

        {/* ───────── 🔭 発見タブ（P3a：監視外の頻出新語） ───────── */}
        {tab === "discovery" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-bg-border shrink-0">
              <span className="text-[10.5px] text-emerald-200/85 font-semibold">🔭 監視外で頻出し始めた新語＝未開拓/新ジャンル/神引き候補（好み非依存）</span>
              <label className="flex items-center gap-1 text-[10px] text-text-muted ml-auto">件数
                <select className={selectCls} value={String(discCount)} onChange={(e) => setDiscCount(Number(e.target.value))}>
                  {COUNT_OPTIONS.map((n) => <option key={n} value={String(n)}>{countLabel(n)}</option>)}
                </select>
              </label>
              <input className={`${selectCls} flex-1 min-w-[120px]`} placeholder="🔎 候補語を検索"
                value={discSearch} onChange={(e) => setDiscSearch(e.target.value)} />
              <span className="text-[10px] text-text-muted/60">{filteredCandidates.length}件中 {shownCandidates.length}件表示</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-bg-panel">
                  <tr className="text-text-muted/70 border-b border-bg-border">
                    <th className="text-left font-semibold px-2 py-1">候補語</th>
                    <th className="text-right font-semibold px-2 py-1 w-12">出現</th>
                    <th className="text-left font-semibold px-2 py-1">サンプル文脈</th>
                    <th className="text-right font-semibold px-2 py-1 w-16">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {shownCandidates.map((c) => (
                    <tr key={c.term} className="border-b border-bg-border/50">
                      <td className="px-2 py-1.5 text-text-base font-medium">{c.term}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text-base/90">{c.count}</td>
                      <td className="px-2 py-1.5 text-text-muted/70">
                        <span title={c.sampleContexts.join(" / ")}>{c.sampleContexts[0] ?? "—"}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button type="button" onClick={() => onIgnoreTerm?.(c.term)} title="この語を今後の候補から無視"
                          className="text-[10px] px-1.5 py-0.5 rounded border border-bg-border text-text-muted hover:text-rose-300 hover:border-rose-400/40 transition">🚫 無視</button>
                      </td>
                    </tr>
                  ))}
                  {shownCandidates.length === 0 && (
                    <tr><td colSpan={4} className="px-2 py-6 text-center text-[11px] text-text-muted">
                      候補がありません（履歴が少ない／すべて監視済み・無視済み）。昇格は次段階（P3b）で追加予定。
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* フッタ注記 */}
        <div className="px-3 py-1.5 border-t border-bg-border shrink-0">
          <p className="text-[10px] text-text-muted/55 leading-snug">
            ※ レベル・ポリシーの変更はダッシュボードと共通（即保存）。生成への反映は重複分析タブの「提案を反映」を押した時のみ。
            🔭 未開拓ビュー＝未踏の表現領域（低出現要素）を探す発見用ビュー（タグ一括・全選択はフィルタ全件が対象）。
          </p>
        </div>
      </div>
    </div>
  );
}
