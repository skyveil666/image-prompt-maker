/**
 * CompareModeView — Compare Mode（参照 ↔ 生成 比較）の全幅ビュー。docs/24 Phase B。
 *
 * 参照レコード（referenceRecords）一覧から1件選び、3ペインで並べて比較する：
 *   左   = 参照画像（refThumb・クリック拡大）
 *   中央 = 抽出/適用（背景/衣装/ポーズ/髪型/色味/空気感の6項目・一致率列は次段階で自動表示）
 *   右   = 生成結果画像（その batchId を持つ history アイテムの resultImage から取得）
 *
 * 読み取り専用：生成・抽出・保存ロジックは一切変更しない。referenceRecords / history を読むだけ。
 * 一致率（matchScores）と「生成側の自動抽出」は Phase C で追加する（ここでは枠のみ）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getReferenceRecords, updateReferenceRecord, type ReferenceRecord } from "../lib/referenceRecords";
import { getByIndex, STORE_HISTORY } from "../lib/idb";
import { getResultImages } from "../lib/history";
import { compareReferenceViaBackend } from "../lib/backendClient";
import type { PromptHistoryItem } from "../types";
import { REFERENCE_CATEGORIES } from "./ReferenceImportPanel";

/** 評価対象の生成結果（出所つき）。 */
interface ResultImage { url: string; historyItemId: string; imageIndex: number; }

/** 比較項目（design: 背景/衣装/ポーズ/髪型/色味/空気感）。key は抽出13カテゴリと対応。 */
const COMPARE_ITEMS: { key: string; label: string }[] = [
  { key: "background", label: "背景" },
  { key: "outfit", label: "衣装" },
  { key: "pose", label: "ポーズ" },
  { key: "hair", label: "髪型" },
  { key: "color", label: "色味" },
  { key: "mood", label: "空気感" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CompareModeView({ open, onClose }: Props) {
  const [records, setRecords] = useState<ReferenceRecord[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  /** 一致率を算出中の生成結果 url（null=非算出） */
  const [computing, setComputing] = useState<string | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);

  // 開いたら参照レコードを読み込み（最新順）。選択が無ければ先頭を自動選択。
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setRecords(null);
    void (async () => {
      try {
        const recs = await getReferenceRecords();
        if (!alive) return;
        setRecords(recs);
        setSelectedId((cur) => (cur && recs.some((r) => r.id === cur) ? cur : recs[0]?.id ?? null));
      } catch {
        if (alive) setRecords([]);
      }
    })();
    return () => { alive = false; };
  }, [open]);

  const selected = useMemo(
    () => records?.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  // 選択レコードの batchId から生成結果画像を取得（history を読むだけ・出所つき）。
  useEffect(() => {
    if (!open || !selected) { setResults([]); return; }
    let alive = true;
    setLoadingResults(true);
    setComputeError(null);
    void (async () => {
      try {
        const items = await getByIndex<PromptHistoryItem>(STORE_HISTORY, "batchId", selected.batchId);
        const list: ResultImage[] = [];
        for (const it of items) {
          getResultImages(it).forEach((u, idx) => {
            if (u && !list.some((r) => r.url === u)) list.push({ url: u, historyItemId: it.id, imageIndex: idx });
          });
        }
        if (alive) setResults(list.slice(0, 6));
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoadingResults(false);
      }
    })();
    return () => { alive = false; };
  }, [open, selected]);

  // 一致率を算出（案1：生成結果画像×参照6項目を Gemini 採点）。結果は referenceRecords にキャッシュ。
  const computeMatch = useCallback(async (target: ResultImage) => {
    if (!selected) return;
    setComputing(target.url);
    setComputeError(null);
    try {
      const referenceItems: Record<string, string> = {};
      for (const it of COMPARE_ITEMS) {
        const v = (selected.applied?.[it.key] ?? selected.extracted?.[it.key] ?? "").trim();
        if (v) referenceItems[it.key] = v;
      }
      const { scores, resultExtracted } = await compareReferenceViaBackend(target.url, referenceItems);
      const matchComputedAt = Date.now();
      const resultImageRef = { historyItemId: target.historyItemId, imageIndex: target.imageIndex };
      await updateReferenceRecord(selected.id, { matchScores: scores, resultExtracted, matchComputedAt, resultImageRef });
      setRecords((prev) => prev
        ? prev.map((r) => (r.id === selected.id ? { ...r, matchScores: scores, resultExtracted, matchComputedAt, resultImageRef } : r))
        : prev);
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : String(e));
    } finally {
      setComputing(null);
    }
  }, [selected]);

  // Escape：ライトボックス優先で閉じ、無ければビューを閉じる。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lightbox, onClose]);

  if (!open) return null;

  const fmtDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleString("ja-JP", {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    } catch { return String(ms); }
  };

  /** 一致率の色分け（70+緑 / 40-69 橙 / それ未満ローズ）。 */
  const scoreColor = (s: number) => (s >= 70 ? "text-emerald-300" : s >= 40 ? "text-amber-300" : "text-rose-300");

  const appliedLabels = (r: ReferenceRecord) =>
    REFERENCE_CATEGORIES.filter((c) => (r.applied?.[c.key] ?? "").trim()).map((c) => c.label);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-[1400px] h-[92vh] flex flex-col rounded-xl border border-bg-border bg-bg-panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダ */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bg-border shrink-0">
          <span className="text-[15px]">🆚</span>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-bold text-text-base">Compare Mode</span>
            <span className="text-[10px] text-text-muted/70">参照 ↔ 生成 を並べて比較（背景 / 衣装 / ポーズ / 髪型 / 色味 / 空気感）</span>
          </div>
          <button
            type="button" onClick={onClose}
            className="ml-auto text-[12px] px-2.5 py-1 rounded border border-bg-border bg-bg-base/60 text-text-muted hover:text-text-base transition"
          >✕ 閉じる</button>
        </div>

        {/* 本体 */}
        {records === null ? (
          <div className="flex-1 grid place-items-center text-[12px] text-text-muted">読み込み中…</div>
        ) : records.length === 0 ? (
          <div className="flex-1 grid place-items-center px-6 text-center">
            <div className="space-y-1.5 max-w-md">
              <p className="text-[13px] font-semibold text-text-base">まだ比較できる参照レコードがありません</p>
              <p className="text-[11.5px] text-text-muted leading-relaxed">
                Reference Picker で参照画像を取り込み →「適用」してから「プロンプトを生成」すると、ここに参照レコードが追加されます。
                生成結果を履歴で貼り戻すと、右側に並べて比較できます。
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            {/* 左レール：参照レコード一覧 */}
            <div className="w-44 sm:w-52 shrink-0 border-r border-bg-border overflow-y-auto p-2 space-y-1.5 bg-bg-base/30">
              <p className="text-[10px] text-text-muted/70 px-1 pb-1">参照レコード（{records.length}）</p>
              {records.map((r) => {
                const labels = appliedLabels(r);
                const active = r.id === selectedId;
                return (
                  <button
                    key={r.id} type="button" onClick={() => setSelectedId(r.id)}
                    className={[
                      "w-full text-left rounded-lg border p-1.5 transition flex gap-2 items-start",
                      active ? "border-violet-400/70 bg-violet-500/15" : "border-bg-border bg-bg-panel hover:bg-bg-base/50",
                    ].join(" ")}
                  >
                    <img src={r.refThumb} alt="" className="w-10 h-10 rounded object-cover border border-bg-border shrink-0" />
                    <span className="flex flex-col leading-tight min-w-0">
                      <span className="text-[10px] text-text-muted">{fmtDate(r.createdAt)}</span>
                      <span className="text-[10px] text-text-base/90 truncate">{labels.length ? labels.join("・") : "（適用なし）"}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* メイン3ペイン */}
            {selected && (
              <div className="flex-1 min-w-0 overflow-y-auto p-3">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.9fr)] gap-3">
                  {/* 左：参照画像 */}
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold text-text-muted">参照画像</h3>
                    <img
                      src={selected.refThumb} alt="参照" title="クリックで拡大"
                      onClick={() => setLightbox(selected.refThumb)}
                      className="w-full rounded-lg border border-bg-border object-contain cursor-zoom-in bg-bg-base/40"
                    />
                    <div className="text-[10.5px] text-text-muted leading-snug">
                      適用：{appliedLabels(selected).join("・") || "（なし）"}
                    </div>
                  </div>

                  {/* 中央：参照 ⇔ 生成 比較表（6項目＋一致率） */}
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold text-text-muted">参照 ⇔ 生成 ＋ 一致率</h3>
                    <div className="rounded-lg border border-bg-border overflow-hidden">
                      <table className="w-full text-[11px] table-fixed">
                        <thead>
                          <tr className="bg-bg-base/50 text-text-muted/80">
                            <th className="text-left font-semibold px-2 py-1 w-14">項目</th>
                            <th className="text-left font-semibold px-2 py-1">参照（抽出）</th>
                            <th className="text-left font-semibold px-2 py-1">生成側（抽出）</th>
                            <th className="text-center font-semibold px-2 py-1 w-12">一致率</th>
                          </tr>
                        </thead>
                        <tbody>
                          {COMPARE_ITEMS.map((it) => {
                            const ext = (selected.extracted?.[it.key] ?? "").trim();
                            const gen = (selected.resultExtracted?.[it.key] ?? "").trim();
                            const isApplied = !!(selected.applied?.[it.key] ?? "").trim();
                            const score = selected.matchScores?.[it.key];
                            return (
                              <tr key={it.key} className="border-t border-bg-border align-top">
                                <td className="px-2 py-1.5 font-semibold text-text-base whitespace-nowrap">
                                  {it.label}
                                  {isApplied
                                    ? <span className="ml-1 text-[9px] text-violet-200 bg-violet-500/20 rounded px-1">適用</span>
                                    : ext ? <span className="ml-1 text-[9px] text-text-muted/60">抽出のみ</span> : null}
                                </td>
                                <td className="px-2 py-1.5 text-text-base/90 leading-snug break-words">
                                  {ext || <span className="text-text-muted/45">—</span>}
                                </td>
                                <td className="px-2 py-1.5 text-text-base/80 leading-snug break-words">
                                  {gen || <span className="text-text-muted/35">—</span>}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {typeof score === "number"
                                    ? <span className={`font-bold ${scoreColor(score)}`}>{score}%</span>
                                    : <span className="text-text-muted/40" title="右の生成結果で「一致率を算出」を押すと表示されます">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {selected.matchComputedAt
                      ? <p className="text-[10px] text-text-muted/60 leading-snug">一致率：{fmtDate(selected.matchComputedAt)} に算出（生成結果ごとに「🎯 一致率を算出」で更新）。</p>
                      : <p className="text-[10px] text-text-muted/60 leading-snug">右の生成結果で「🎯 一致率を算出」を押すと、生成画像を解析して項目別の一致率と「生成側」を表示します。</p>}
                  </div>

                  {/* 右：生成結果画像（＋一致率を算出） */}
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold text-text-muted">生成結果</h3>
                    {loadingResults ? (
                      <div className="text-[11px] text-text-muted">読み込み中…</div>
                    ) : results.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-bg-border bg-bg-base/30 px-3 py-6 text-center text-[11px] text-text-muted leading-snug">
                        この生成の結果画像は未登録です。<br />
                        履歴で生成結果を貼り戻すと、ここに並んで比較できます。
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {results.map((r, i) => {
                          const isScored = selected.resultImageRef?.historyItemId === r.historyItemId
                            && selected.resultImageRef?.imageIndex === r.imageIndex;
                          const busy = computing === r.url;
                          return (
                            <div key={i} className="space-y-1">
                              <div className="relative">
                                <img
                                  src={r.url} alt={`生成結果${i + 1}`} title="クリックで拡大"
                                  onClick={() => setLightbox(r.url)}
                                  className={["w-full rounded-lg border object-cover cursor-zoom-in bg-bg-base/40",
                                    isScored ? "border-emerald-400/70" : "border-bg-border"].join(" ")}
                                />
                                {isScored && (
                                  <span className="absolute top-1 left-1 text-[9px] px-1 rounded bg-emerald-500/80 text-white">算出済み</span>
                                )}
                              </div>
                              <button
                                type="button" disabled={!!computing}
                                onClick={() => { void computeMatch(r); }}
                                className="w-full text-[10px] px-1.5 py-1 rounded border border-violet-400/45 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
                              >
                                {busy
                                  ? <><span className="w-1.5 h-1.5 rounded-full bg-violet-200 animate-pulse" />算出中…</>
                                  : isScored ? "🎯 再算出" : "🎯 一致率を算出"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {computeError && (
                      <p className="text-[10px] text-rose-300/90 leading-snug">⚠ {computeError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ライトボックス（拡大） */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
        >
          <img src={lightbox} alt="拡大" className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg border border-white/15" />
        </div>
      )}
    </div>
  );
}
