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
}

export function ReferenceImportPanel({ protections, activeScopes, appliedNote, onApply, onClearAll }: Props) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = useCallback((m: string) => {
    setNote(m);
    window.setTimeout(() => setNote((cur) => (cur === m ? null : cur)), 2600);
  }, []);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { flash("画像ファイルを入れてください"); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setOpen(true); };
    reader.onerror = () => flash("画像の読み込みに失敗しました");
    reader.readAsDataURL(file);
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

  // ── 折りたたみハンドル ────────────────────────────────────────────
  if (!open) {
    const appliedCount = Object.keys(appliedNote).length;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="参照画像 / 要素抽出 を開く"
        className="fixed right-0 top-1/3 z-30 -translate-y-1/2 rounded-l-lg border border-r-0 border-violet-400/45 bg-violet-500/15 px-1.5 py-3 text-[11px] font-bold text-violet-100 hover:bg-violet-500/25 transition [writing-mode:vertical-rl] leading-tight"
      >
        🖼 参照画像{appliedCount > 0 ? `（${appliedCount}）` : ""}
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-14 bottom-0 z-30 w-[340px] max-w-[88vw] flex flex-col border-l border-bg-border bg-bg-panel/95 backdrop-blur-sm shadow-2xl">
      {/* ヘッダ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bg-border shrink-0">
        <span className="text-[14px]">🖼</span>
        <span className="text-[13px] font-bold text-text-base">参照画像 / 要素抽出</span>
        <button type="button" onClick={() => setOpen(false)}
          className="ml-auto text-[12px] text-text-muted hover:text-text-base transition leading-none px-1">▶ 閉じる</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3">
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
              <img src={image} alt="参照" className="max-h-40 w-auto mx-auto rounded border border-bg-border object-contain" />
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

        {/* 抽出ボタン（Phase1: 手動入力。AI抽出はPhase2） */}
        <div className="rounded-lg border border-bg-border bg-bg-base/30 px-2.5 py-2">
          <button type="button" disabled={!image}
            onClick={() => flash("Phase1は手動入力です（AI自動抽出はPhase2で追加）。各欄に良い要素を記入し『適用』してください")}
            className="w-full text-[12px] font-bold px-2.5 py-1.5 rounded-lg border border-violet-400/55 bg-violet-500/18 text-violet-50 hover:bg-violet-500/28 transition disabled:opacity-40 disabled:cursor-not-allowed">
            ✨ 画像から要素抽出
          </button>
          <p className="text-[10px] text-text-muted/65 leading-snug pt-1.5">
            ※ 顔・同一性・表情・体型は抽出しません。人物そのものは複製しません。背景・衣装・構図・光・雰囲気などの要素だけを扱います。
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

        {/* カテゴリ別カード */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-text-muted/80">参照画像から抽出された要素</p>
          {REFERENCE_CATEGORIES.map((cat) => {
            const lockReason = referenceLockReason(cat, protections);
            const applied = appliedNote[cat.key] != null;
            const scopeOn = cat.scope != null && activeScopes.includes(cat.scope);
            return (
              <div key={cat.key} className={[
                "rounded-lg border px-2.5 py-2 space-y-1.5",
                lockReason ? "border-bg-border bg-bg-base/20 opacity-70" : "border-bg-border bg-bg-base/40",
              ].join(" ")}>
                <div className="flex items-center gap-1.5">
                  <input type="checkbox" checked={selected.has(cat.key)} onChange={() => toggleSel(cat.key)}
                    disabled={!!lockReason} className="accent-violet-400 disabled:opacity-40" />
                  <span className="text-[12px] font-bold text-text-base">{cat.label}</span>
                  {cat.scope && scopeOn && (
                    <span className="text-[9px] px-1 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 leading-none">変更対象ON</span>
                  )}
                  {applied && (
                    <span className="text-[9px] px-1 py-0.5 rounded-full border border-violet-400/40 bg-violet-400/10 text-violet-200 leading-none">反映中</span>
                  )}
                  {lockReason && (
                    <span className="text-[9px] px-1 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-200 leading-none" title={lockReason}>🔒 固定中</span>
                  )}
                </div>
                <textarea
                  value={fields[cat.key] ?? ""}
                  onChange={(e) => setField(cat.key, e.target.value)}
                  placeholder={cat.placeholder}
                  rows={2}
                  className="w-full text-[11px] rounded border border-bg-border bg-bg-base/60 px-2 py-1 text-text-base placeholder:text-text-muted/45 resize-y focus:outline-none focus:border-violet-400/60"
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
          })}
        </div>
      </div>

      {/* フッタ通知 */}
      {note && (
        <div className="shrink-0 px-3 py-2 border-t border-bg-border text-[11px] text-violet-100 bg-violet-500/10">
          {note}
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
