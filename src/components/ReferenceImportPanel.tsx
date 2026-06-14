/**
 * ReferenceImportPanel — 参照画像 / 要素抽出（Phase1）
 *
 * 他人の生成画像・参考画像を DnD / Ctrl+V / スクショ貼付 / ファイル選択 で取り込み、
 * 「良い要素だけ」をカテゴリ別に抽出（Phase1は手動入力/スタブ）して既存UIへ反映する。
 *
 * 反映方式（docs/23）: enum 詳細欄には自動反映しない。
 *   [適用] → 対応 scope を ON + 軸タグ付き自由文を referenceNote へ（生成時に統合）。
 *
 * 絶対条件:
 *   - 顔/同一性/表情/体型のカテゴリは作らない（＝適用不能）。参照画像の人物はコピーしない。
 *   - 既存の保護ロック（体型・ポーズ / 構図 / 色味）が ON のカテゴリは適用不可。
 *   - 未選択カテゴリは一切変更しない（[適用] を押した軸のみ）。自動適用なし。
 *
 * Phase2 で Gemini Vision による自動抽出（/api/extract-reference）を追加予定。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Scope } from "../types";
import { extractReferenceViaBackend } from "../lib/backendClient";
import { readFileAsDataUrl } from "../lib/imageFile";
import { useAutoResizeTextarea } from "../lib/useAutoResizeTextarea";

/** 内容に合わせて高さが自動で伸びる textarea（抽出結果をスクロールせず読めるように） */
function AutoTextarea({ value, onChange, placeholder, minRows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder: string; minRows?: number;
}) {
  const ref = useAutoResizeTextarea(value, { minRows });
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full text-[11px] rounded border border-bg-border bg-bg-base/60 px-2 py-1 text-text-base placeholder:text-text-muted/45 resize-y focus:outline-none focus:border-violet-400/60 overflow-hidden"
    />
  );
}

// ── カテゴリ定義（顔/同一性/表情/体型は含めない＝設計上の絶対条件） ────────────
export type RefLock = "bodyPose" | "composition" | "colorMood" | null;

export interface ReferenceCategory {
  key: string;
  label: string;
  /** 適用時に ON にする変更対象（null = 対応scopeなし＝自由文ノートのみ） */
  scope: Scope | null;
  /** この既存ロックが ON の時は適用不可 */
  lock: RefLock;
  placeholder: string;
}

export const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  { key: "background", label: "背景",          scope: "background", lock: null,          placeholder: "例：古い映画館のような赤い座席と奥行きのある暗い空間" },
  { key: "outfit",     label: "衣装",          scope: "outfit",     lock: null,          placeholder: "例：光沢のある黒いジャケットと細身のストリート系レイヤード" },
  { key: "hair",       label: "髪型",          scope: "hair",       lock: null,          placeholder: "例：濡れ感のあるダークトーンのミディアムレイヤー" },
  { key: "pose",       label: "ポーズ",        scope: "pose",       lock: "bodyPose",    placeholder: "例：片肩を前に出した斜め立ちのクールなポーズ" },
  { key: "composition",label: "構図",          scope: "camera",     lock: "composition", placeholder: "例：被写体を中央より少し右に置いた縦長ポートレート構図" },
  { key: "camera",     label: "カメラアングル", scope: "camera",     lock: "composition", placeholder: "例：やや見上げるローアングルで奥行きを強調" },
  { key: "lighting",   label: "ライティング",   scope: "lighting",   lock: null,          placeholder: "例：横からのリムライトで輪郭を際立たせる" },
  { key: "color",      label: "色味",          scope: null,         lock: "colorMood",   placeholder: "例：赤と黒を基調にした低彩度のシネマトーン" },
  { key: "props",      label: "小物",          scope: "props",      lock: null,          placeholder: "例：手元に発光する小型デバイス" },
  { key: "foreground", label: "前景演出",       scope: "foreground", lock: null,          placeholder: "例：手前に舞い散る粒子の前ボケ" },
  { key: "world",      label: "世界観",        scope: null,         lock: null,          placeholder: "例：退廃的でノスタルジックな近未来" },
  { key: "texture",    label: "質感",          scope: null,         lock: null,          placeholder: "例：フィルムグレインのある軽いマット質感" },
  { key: "mood",       label: "雰囲気",        scope: null,         lock: "colorMood",   placeholder: "例：静かで緊張感のあるクールな空気" },
];

export interface ReferenceProtections {
  bodyPoseLock: boolean;
  compositionLock: boolean;
  colorMoodLock: boolean;
}


/** カテゴリが現在のロック状態で適用不可か。理由文（不可時）も返す。 */
export function referenceLockReason(cat: ReferenceCategory, p: ReferenceProtections): string | null {
  if (cat.lock === "bodyPose" && p.bodyPoseLock) return "体型・ポーズ固定がONのため適用できません";
  if (cat.lock === "composition" && p.compositionLock) return "構図固定がONのため適用できません";
  if (cat.lock === "colorMood" && p.colorMoodLock) return "色味固定がONのため適用できません";
  return null;
}

interface Props {
  protections: ReferenceProtections;
  /** 現在 ON の変更対象（適用済み表示用） */
  activeScopes: Scope[];
  /** 現在の referenceNote（適用済み表示用） */
  appliedNote: Record<string, string>;
  /** [適用]。許可されたら true。App 側で保護ゲート最終判定＋scope ON＋note追記。 */
  onApply: (catKey: string, text: string) => boolean;
  /** 全解除（referenceNote クリア） */
  onClearAll: () => void;
  /** 参照画像＋抽出13カテゴリの変化を親へ通知（Compare Mode 用・任意）。生成時に参照レコードへ残す。 */
  onContextChange?: (ctx: { image: string; extracted: Record<string, string> } | null) => void;
  /** Compare Mode（参照↔生成 比較ビュー）を開く（任意）。 */
  onOpenCompare?: () => void;
}

export function ReferenceImportPanel({ protections, activeScopes, appliedNote, onApply, onClearAll, onContextChange, onOpenCompare }: Props) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentJson = REFERENCE_CATEGORIES.reduce<Record<string, string>>((acc, c) => {
    acc[c.key] = (fields[c.key] ?? "").trim();
    return acc;
  }, {});

  // Compare Mode 用：参照画像＋抽出の最新を親へ通知（image/fields 変化時のみ・通知は副作用なし）。
  useEffect(() => {
    if (!onContextChange) return;
    if (!image) { onContextChange(null); return; }
    const extracted = REFERENCE_CATEGORIES.reduce<Record<string, string>>((acc, c) => {
      acc[c.key] = (fields[c.key] ?? "").trim();
      return acc;
    }, {});
    onContextChange({ image, extracted });
  }, [image, fields, onContextChange]);

  const flash = useCallback((m: string) => {
    setNote(m);
    window.setTimeout(() => setNote((cur) => (cur === m ? null : cur)), 2600);
  }, []);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { flash("画像ファイルを入れてください"); return; }
    readFileAsDataUrl(file)
      .then((url) => { setImage(url); setOpen(true); })
      .catch(() => flash("画像の読み込みに失敗しました"));
  }, [flash]);

  // Ctrl+V / Cmd+V / スクショ貼付（クリップボードに画像がある時だけ作動・テキスト貼付は妨げない）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); loadFile(f); }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  const setField = (k: string, v: string) => setFields((p) => ({ ...p, [k]: v }));
  const toggleSel = (k: string) => setSelected((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  /** 1カテゴリを適用（空文字・ロック時はスキップ）。適用できたら true。 */
  const applyOne = useCallback((catKey: string): boolean => {
    const cat = REFERENCE_CATEGORIES.find((c) => c.key === catKey);
    if (!cat) return false;
    const text = (fields[catKey] ?? "").trim();
    if (!text) { flash(`「${cat.label}」に内容がありません`); return false; }
    if (referenceLockReason(cat, protections)) { flash(referenceLockReason(cat, protections)!); return false; }
    return onApply(catKey, text);
  }, [fields, protections, onApply, flash]);

  const applySelected = useCallback(() => {
    const keys = REFERENCE_CATEGORIES.filter((c) => selected.has(c.key)).map((c) => c.key);
    if (keys.length === 0) { flash("適用する項目を選択してください"); return; }
    let n = 0;
    for (const k of keys) if (applyOne(k)) n++;
    flash(n > 0 ? `${n}件を適用しました` : "適用できる項目がありませんでした");
  }, [selected, applyOne, flash]);

  const clearAll = useCallback(() => {
    setFields({});
    setSelected(new Set());
    onClearAll();
    flash("参照反映を全解除しました");
  }, [onClearAll, flash]);

  /** 現在の13カテゴリ欄を JSON にしてコピー（抽出結果の比較・共有用） */
  const copyJson = useCallback(() => {
    const obj: Record<string, string> = {};
    for (const c of REFERENCE_CATEGORIES) obj[c.key] = (fields[c.key] ?? "").trim();
    const json = JSON.stringify(obj, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => flash("抽出JSONをコピーしました"),
        () => window.prompt("抽出JSON（コピーしてください）", json),
      );
    } else {
      window.prompt("抽出JSON（コピーしてください）", json);
    }
  }, [fields, flash]);

  /** Gemini Vision で参照画像を解析し、13カテゴリ欄を実抽出結果で埋める。 */
  const runExtract = useCallback(async () => {
    if (!image) { flash("先に参照画像を貼ってください"); return; }
    setExtracting(true);
    setExtractError(null);
    try {
      const { elements, missingRequired } = await extractReferenceViaBackend(image);
      // 実抽出結果で各欄を上書き（空文字のカテゴリは空のまま＝でっち上げない）
      setFields(() => {
        const next: Record<string, string> = {};
        for (const c of REFERENCE_CATEGORIES) next[c.key] = (elements[c.key] ?? "").trim();
        return next;
      });
      flash(
        missingRequired.length > 0
          ? `抽出しました。${missingRequired.length}件の必須カテゴリが空でした。手入力で補ってください。`
          : "参照画像から抽出しました。内容を確認し「○○に適用」で反映してください。",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExtractError(msg);
      flash(`抽出に失敗：${msg}`);
    } finally {
      setExtracting(false);
    }
  }, [image, flash]);

  // 優先6カテゴリ（常時展開）／その他（折りたたみ）
  const PRIORITY_KEYS = ["background", "outfit", "pose", "hair", "composition", "lighting"];
  const priorityCats = REFERENCE_CATEGORIES.filter((c) => PRIORITY_KEYS.includes(c.key));
  const otherCats = REFERENCE_CATEGORIES.filter((c) => !PRIORITY_KEYS.includes(c.key));

  /** カテゴリ別カード（状態バッジ：未適用/適用済み/保護で適用不可） */
  const renderCard = (cat: ReferenceCategory) => {
    const lockReason = referenceLockReason(cat, protections);
    const hasText = (fields[cat.key] ?? "").trim().length > 0;
    const applied = appliedNote[cat.key] != null;
    const scopeOn = cat.scope != null && activeScopes.includes(cat.scope);
    const status = lockReason
      ? { text: "🔒 保護で適用不可", cls: "border-amber-400/40 bg-amber-400/10 text-amber-200" }
      : applied
      ? { text: "✅ 適用済み（反映中）", cls: "border-violet-400/45 bg-violet-400/12 text-violet-200" }
      : hasText
      ? { text: "○ 未適用", cls: "border-sky-400/35 bg-sky-400/8 text-sky-200/85" }
      : { text: "— 空", cls: "border-bg-border bg-bg-base/40 text-text-muted/55" };
    return (
      <div key={cat.key} className={[
        "rounded-lg border px-2.5 py-2 space-y-1.5",
        lockReason ? "border-bg-border bg-bg-base/20 opacity-70" : "border-bg-border bg-bg-base/40",
      ].join(" ")}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input type="checkbox" checked={selected.has(cat.key)} onChange={() => toggleSel(cat.key)}
            disabled={!!lockReason} className="accent-violet-400 disabled:opacity-40" />
          <span className="text-[12px] font-bold text-text-base">{cat.label}</span>
          <span className={["text-[9px] px-1.5 py-0.5 rounded-full border leading-none", status.cls].join(" ")}>{status.text}</span>
          {cat.scope && scopeOn && (
            <span className="text-[9px] px-1 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 leading-none">変更対象ON</span>
          )}
        </div>
        <AutoTextarea
          value={fields[cat.key] ?? ""}
          onChange={(v) => setField(cat.key, v)}
          placeholder={cat.placeholder}
          minRows={["background", "outfit", "pose"].includes(cat.key) ? 6 : 4}
        />
        <div className="flex items-center justify-end">
          <button type="button" onClick={() => applyOne(cat.key)} disabled={!!lockReason}
            title={lockReason ?? `${cat.label}を変更対象に反映`}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-violet-400/50 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {cat.label}に適用
          </button>
        </div>
      </div>
    );
  };

  // ── 折りたたみハンドル ────────────────────────────────────────────
  if (!open) {
    const appliedCount = Object.keys(appliedNote).length;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Reference Picker（参照ピッカー / 要素抽出）を開く"
        className="fixed right-0 top-1/3 z-30 -translate-y-1/2 rounded-l-lg border border-r-0 border-violet-400/45 bg-violet-500/15 px-1.5 py-3 text-[11px] font-bold text-violet-100 hover:bg-violet-500/25 transition [writing-mode:vertical-rl] leading-tight"
      >
        🖼 参照ピッカー{appliedCount > 0 ? `（${appliedCount}）` : ""}
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-14 bottom-0 z-30 w-[94vw] sm:w-[460px] lg:w-[760px] max-w-[96vw] flex flex-col border-l border-bg-border bg-bg-panel/95 backdrop-blur-sm shadow-2xl">
      {/* ヘッダ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bg-border shrink-0">
        <span className="text-[14px]">🖼</span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-bold text-text-base">Reference Picker</span>
          <span className="text-[10px] text-text-muted/70">参照ピッカー / 要素抽出</span>
        </span>
        {onOpenCompare && (
          <button type="button" onClick={onOpenCompare}
            title="参照と生成結果を並べて比較（Compare Mode）"
            className="ml-auto text-[11px] px-2 py-0.5 rounded border border-violet-400/40 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition leading-none">
            🆚 比較
          </button>
        )}
        <button type="button" onClick={() => setShowJson((v) => !v)}
          title="抽出した13カテゴリを JSON で一括確認"
          className={[onOpenCompare ? "ml-1" : "ml-auto", "text-[11px] px-2 py-0.5 rounded border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition leading-none"].join(" ")}>
          {showJson ? "🔎 JSONを隠す" : "🔎 抽出JSONを見る"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-[12px] text-text-muted hover:text-text-base transition leading-none px-1">▶ 閉じる</button>
      </div>

      {/* 抽出JSON 一括表示 */}
      {showJson && (
        <div className="px-3 py-2 border-b border-bg-border bg-bg-base/40 shrink-0">
          <pre className="text-[10px] text-text-base/90 leading-snug max-h-48 overflow-auto whitespace-pre-wrap break-all bg-bg-base/60 rounded p-2 border border-bg-border">
{JSON.stringify(currentJson, null, 2)}
          </pre>
          <button type="button" onClick={copyJson}
            className="mt-1 text-[10px] px-2 py-0.5 rounded border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition">📋 コピー</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-3 lg:items-start">
        {/* ── 左カラム：参照画像＋抽出操作（広い画面では sticky） ── */}
        <div className="space-y-3 lg:sticky lg:top-0">
        {/* 反映済みサマリ（appliedNote がある時のみ・反映が分かる表示） */}
        {Object.keys(appliedNote).length > 0 && (
          <div className="rounded-lg border border-violet-400/45 bg-violet-500/12 px-2.5 py-1.5 text-[11px] text-violet-100 leading-snug">
            ✅ 反映中：{REFERENCE_CATEGORIES.filter((c) => appliedNote[c.key]).map((c) => c.label).join("・")}
            （{Object.keys(appliedNote).length}件）
            <span className="text-violet-200/70"> ／「プロンプトを生成」で効きます</span>
          </div>
        )}
        {/* 取り込みエリア */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}
          className={[
            "rounded-lg border border-dashed px-3 py-3 text-center transition",
            dragOver ? "border-violet-400 bg-violet-500/10" : "border-bg-border bg-bg-base/40",
          ].join(" ")}
        >
          {image ? (
            <div className="space-y-2">
              <img src={image} alt="参照" onClick={() => setLightbox(true)} title="クリックで拡大"
                className="max-h-72 w-auto mx-auto rounded border border-bg-border object-contain cursor-zoom-in" />
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-[11px] px-2 py-0.5 rounded border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition">画像を変更</button>
                <button type="button" onClick={() => setImage(null)}
                  className="text-[11px] px-2 py-0.5 rounded border border-rose-400/35 bg-rose-400/8 text-rose-200/85 hover:bg-rose-400/16 transition">画像を外す</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[12px] text-text-base font-semibold">画像をドラッグ＆ドロップ</p>
              <p className="text-[10.5px] text-text-muted/80 leading-snug">
                または <kbd className="px-1 rounded bg-white/10">Ctrl/⌘+V</kbd> で貼り付け（スクショ可）
              </p>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="mt-1 text-[11px] px-2.5 py-1 rounded-lg border border-violet-400/45 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition">
                📁 ファイルを選択
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); if (fileRef.current) fileRef.current.value = ""; }} />
        </div>

        {/* 抽出ボタン（Gemini Vision で参照画像を実解析） */}
        <div className="rounded-lg border border-bg-border bg-bg-base/30 px-2.5 py-2">
          <button type="button" disabled={!image || extracting}
            onClick={() => { void runExtract(); }}
            title={image ? "Gemini Vision で参照画像を解析し各欄を埋める" : "先に参照画像を貼ってください"}
            className="w-full text-[12px] font-bold px-2.5 py-1.5 rounded-lg border border-violet-400/55 bg-violet-500/18 text-violet-50 hover:bg-violet-500/28 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5">
            {extracting ? (<><span className="w-1.5 h-1.5 rounded-full bg-violet-200 animate-pulse" />解析中…</>) : "✨ 画像から要素抽出"}
          </button>
          {extractError && (
            <p className="text-[10px] text-rose-300/90 leading-snug pt-1.5">⚠ {extractError}</p>
          )}
          <button type="button" onClick={copyJson}
            title="現在の13カテゴリ欄をJSONでコピー（抽出結果の確認・共有用）"
            className="mt-1.5 w-full text-[11px] px-2 py-1 rounded border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition">
            📋 抽出JSONをコピー
          </button>
          <p className="text-[10px] text-text-muted/65 leading-snug pt-1.5">
            ※ 参照画像に実際に見える要素だけを抽出します（無い要素を足しません）。
            顔・同一性・表情・体型は抽出せず、人物そのものは複製しません。手入力で上書きも可。
          </p>
        </div>

        {/* 一括操作 */}
        <div className="flex flex-wrap gap-1">
          <BulkBtn label="背景だけ適用"  onClick={() => { applyOne("background"); }} />
          <BulkBtn label="衣装だけ適用"  onClick={() => { applyOne("outfit"); }} />
          <BulkBtn label="ポーズだけ適用" onClick={() => { applyOne("pose"); }} />
          <BulkBtn label="構図だけ適用"  onClick={() => { applyOne("composition"); }} />
          <BulkBtn label="光だけ適用"    onClick={() => { applyOne("lighting"); }} />
          <BulkBtn label="色味だけ適用"  onClick={() => { applyOne("color"); }} />
          <BulkBtn label="選択項目だけ適用" onClick={applySelected} accent />
          <BulkBtn label="全解除" onClick={clearAll} danger />
        </div>
        </div>{/* /左カラム */}

        {/* ── 右カラム：抽出結果（カテゴリ別）。優先6は常時展開、その他は折りたたみ ── */}
        <div className="space-y-2 mt-3 lg:mt-0">
          <p className="text-[11px] font-bold text-text-muted/80">参照画像から抽出された要素</p>
          {priorityCats.map(renderCard)}

          <button type="button" onClick={() => setOthersOpen((v) => !v)}
            className="w-full text-left text-[11px] font-semibold text-text-muted/80 hover:text-text-base px-1 py-1 transition">
            {othersOpen ? "▲" : "▼"} その他（色味・小物・前景・世界観・質感・雰囲気）
          </button>
          {othersOpen && otherCats.map(renderCard)}
        </div>
        </div>{/* /grid */}
      </div>

      {/* フッタ通知 */}
      {note && (
        <div className="shrink-0 px-3 py-2 border-t border-bg-border text-[11px] text-violet-100 bg-violet-500/10">
          {note}
        </div>
      )}

      {/* 参照画像 拡大表示（クリックで閉じる） */}
      {lightbox && image && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
          onClick={() => setLightbox(false)}>
          <img src={image} alt="参照（拡大）" className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg border border-white/15" />
          <button type="button" onClick={() => setLightbox(false)}
            className="fixed top-3 right-4 text-white/80 hover:text-white text-[20px] leading-none">✕</button>
        </div>
      )}
    </aside>
  );
}

function BulkBtn({ label, onClick, accent, danger }: { label: string; onClick: () => void; accent?: boolean; danger?: boolean }) {
  const cls = danger
    ? "border-rose-400/35 bg-rose-400/8 text-rose-200/85 hover:bg-rose-400/16"
    : accent
    ? "border-violet-400/55 bg-violet-500/18 text-violet-50 hover:bg-violet-500/28"
    : "border-bg-border bg-bg-panel text-text-muted hover:text-text-base";
  return (
    <button type="button" onClick={onClick}
      className={["text-[10.5px] px-2 py-0.5 rounded border transition leading-none", cls].join(" ")}>
      {label}
    </button>
  );
}
