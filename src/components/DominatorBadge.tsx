/**
 * DominatorBadge — 「見えない支配」設定の rose バッジ（ラベル＋要約＋「× 解除」）。
 *
 * CLAUDE.md §5 鉄則: 全案の生成プロンプトに効くのに画面に出ない設定（世界観 / 参照画像から適用 /
 * 背景2D化 など）は、ReflectionStatusBar と アレンジ画面(ArrangePreviewPanel) の両方に
 * 「同形バッジ＋ワンクリック解除」を必ず出す。両画面が同一コンポーネントを共有することで
 * 「同形」をコードレベルで保証する（発火条件・解除ハンドラ・各画面のラッパ/順序は呼び出し側のまま）。
 */

/** 指示文を【…】除去＋空白圧縮して24字に要約。 */
export function summarizeNote(s: string): string {
  const flat = s.replace(/【[^】]*】/g, "").replace(/\s+/g, " ").trim();
  return flat.length > 24 ? flat.slice(0, 24) + "…" : flat;
}

/** 全案に効くのに画面に出ない設定の rose バッジ（ラベル＋要約＋「× 解除」）。 */
export function DominatorBadge({
  label, summary, summaryTitle, onClear, clearTitle,
}: {
  label: string; summary?: string; summaryTitle?: string; onClear: () => void; clearTitle: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-rose-400/55 bg-rose-500/15 text-rose-100 text-[11px] font-medium">
      <span className="font-bold">{label}</span>
      {summary && (
        <span className="text-rose-200/65 text-[10px] font-normal" title={summaryTitle}>（{summary}）</span>
      )}
      <button type="button" onClick={onClear}
        className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-300/50 bg-rose-400/15 text-rose-100 hover:bg-rose-400/30 transition leading-none"
        title={clearTitle}>× 解除</button>
    </span>
  );
}
