import { useCallback, useEffect, useRef, useState } from "react";
import { getAll } from "../lib/history";
import { listRecentImages } from "../lib/recentImages";
import { listExplorerFavorites } from "../lib/miniExplorer";
import { exportBackup, importBackup, type ImportResult } from "../lib/backup";

/**
 * RecoveryPanel — 履歴・お気に入り復旧（緊急対応・読み取り＋非破壊）。
 *
 * 目的: IndexedDB に残っているデータを「見える化」し、UI へ即再読み込みする。
 * 破壊的操作（削除/clear/deleteDatabase/migration/上書き削除）は一切行わない。
 *  - 件数表示: history / favorites(isFavorite) / recentImages / miniExplorerDB.exFavs / origin
 *  - 再読み込み: App の履歴・お気に入り表示を即リフレッシュ（リロードなし）
 *  - エクスポート/インポート: backup.ts（インポートは id 重複スキップのマージ＝上書きしない）
 */

interface Counts {
  origin: string;
  mainDbExists: boolean;
  history: number;
  favorites: number;
  recent: number;
  exFavs: number;
}

interface Props {
  /** App 側の履歴・お気に入り表示をリロードなしで再読み込みさせる */
  onReloadAll: () => void;
  onClose?: () => void;
}

export function RecoveryPanel({ onReloadAll, onClose }: Props) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  /** 読み込み時に設定（localStorage）も復元するか。既定 false＝設定に触れない（opt-in） */
  const [restoreSettings, setRestoreSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, recent, exFavs] = await Promise.all([
        getAll(),
        listRecentImages(),
        listExplorerFavorites().catch(() => []),
      ]);
      setCounts({
        origin: location.origin,
        mainDbExists: true,
        history: all.length,
        favorites: all.filter((it) => it.isFavorite).length,
        recent: recent.length,
        exFavs: exFavs.length,
      });
    } catch (e) {
      setError(String(e));
      setCounts({
        origin: location.origin,
        mainDbExists: false,
        history: 0, favorites: 0, recent: 0, exFavs: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCounts(); }, [loadCounts]);

  const handleReload = useCallback(async () => {
    onReloadAll();            // App 側の履歴/お気に入り表示を再読み込み（リロードなし）
    await loadCounts();       // パネルの件数も更新
  }, [onReloadAll, loadCounts]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try { await exportBackup(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }, []);

  const handleImportFile = useCallback(async (file: File) => {
    setBusy(true);
    setImportResult(null);
    try {
      const res = await importBackup(file, { restoreSettings });
      setImportResult(res);
      await loadCounts();
      onReloadAll();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [loadCounts, onReloadAll, restoreSettings]);

  const empty = counts != null && counts.history === 0;

  return (
    <div className="rounded-2xl border border-amber-400/45 bg-amber-500/8 p-3 space-y-3">
      {/* ヘッダ */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[15px]">🛟</span>
        <span className="text-[14px] font-bold text-amber-100">履歴・お気に入り復旧</span>
        <button
          type="button"
          onClick={() => void loadCounts()}
          disabled={loading}
          className="text-[11px] px-2 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition leading-none disabled:opacity-50"
        >
          {loading ? "確認中…" : "↻ 再確認"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[11px] px-2 py-0.5 rounded border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
          >
            ✕ 閉じる
          </button>
        )}
      </div>

      {/* 現在の保存状況 */}
      <div className="rounded-lg border border-amber-400/25 bg-bg-base/40 px-3 py-2 space-y-1 text-[12px]">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-text-muted/70">origin：<span className="text-text-base font-mono">{counts?.origin ?? "—"}</span></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 pt-1">
          <Stat label="履歴" value={counts?.history} highlight />
          <Stat label="お気に入り" value={counts?.favorites} highlight />
          <Stat label="直近画像" value={counts?.recent} />
          <Stat label="Explorer★" value={counts?.exFavs} />
        </div>
      </div>

      {/* origin違い / 0件 警告 */}
      {empty && (
        <div className="rounded-lg border border-rose-400/45 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100 leading-snug">
          ⚠ このURL（<span className="font-mono">{counts?.origin}</span>）には履歴データがありません。<br />
          以前使っていたURL/ポートが違う可能性があります。<span className="font-mono">http://localhost:5173</span> を確認してください。<br />
          <span className="text-rose-200/80 text-[11px]">
            ※ データは origin（ポート）ごとに分かれて保存されます。別ポートの preview では別の空データになります。
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-400/45 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          ⚠ {error}
        </div>
      )}

      {/* 操作ボタン */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleReload()}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-[12px] font-bold border border-emerald-400/55 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 transition leading-none disabled:opacity-50"
          title="IndexedDB から履歴・お気に入りを読み直して画面に反映（リロードなし）"
        >
          🔄 履歴・お気に入りを再読み込み
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-sky-400/45 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22 transition leading-none disabled:opacity-50"
          title="履歴・お気に入り・直近画像・選択履歴・Explorer★・設定を JSON で書き出し"
        >
          ⬇ 履歴・お気に入りを書き出し
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-violet-400/45 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition leading-none disabled:opacity-50"
          title="バックアップ JSON を読み込み（既存に追加マージ・上書き削除しません）"
        >
          ⬆ 履歴・お気に入りJSONを読み込み
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
          }}
        />
      </div>

      {/* 設定復元 opt-in（既定 OFF＝設定に触れない） */}
      <label className="flex items-start gap-2 text-[11px] text-text-muted/80 cursor-pointer select-none leading-snug">
        <input
          type="checkbox"
          checked={restoreSettings}
          onChange={(e) => setRestoreSettings(e.target.checked)}
          disabled={busy}
          className="mt-0.5 accent-violet-400 disabled:opacity-50"
        />
        <span>
          読み込み時に<span className="text-text-base font-semibold">設定も復元する</span>
          <span className="text-amber-200/80">（現在の設定を上書き・要再読み込み）</span><br />
          <span className="text-text-muted/55">
            ※ 履歴・お気に入り・選択履歴・Explorer★ は常に「追加マージ」で、このチェックの有無に関わらず上書きしません。
          </span>
        </span>
      </label>

      {/* インポート結果 */}
      {importResult && (
        <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/8 px-3 py-2 text-[11.5px] text-emerald-100 leading-snug space-y-0.5">
          <div>
            ✅ インポート完了：履歴 +{importResult.historyAdded}件（スキップ {importResult.historySkipped}）／
            画像 +{importResult.imagesAdded}件（スキップ {importResult.imagesSkipped}）
          </div>
          <div className="text-emerald-200/85">
            選択履歴 +{importResult.selectionAdded}件（スキップ {importResult.selectionSkipped}）／
            Explorer★ +{importResult.explorerFavAdded}件（スキップ {importResult.explorerFavSkipped}）
          </div>
          {importResult.settingsRestored > 0 && (
            <div className="text-violet-200/90">⚙ 設定 {importResult.settingsRestored}件を復元しました（反映には再読み込みが必要）</div>
          )}
          {importResult.errors.length > 0 && (
            <div className="text-rose-200/85 pt-0.5">⚠ {importResult.errors.join(" / ")}</div>
          )}
        </div>
      )}

      <p className="text-[10px] text-text-muted/50 leading-snug">
        ※ このパネルは読み取りと追加マージのみ。既存の履歴・お気に入りを削除・上書きしません。
      </p>
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: number | undefined; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-text-muted/70">{label}</span>
      <span className={[
        "text-[15px] font-black tabular-nums",
        value == null ? "text-text-muted/40" : value > 0 ? (highlight ? "text-emerald-200" : "text-text-base") : "text-rose-300",
      ].join(" ")}>
        {value == null ? "…" : value}
      </span>
    </div>
  );
}
