/**
 * ZozoTrendBar — 👗 ZOZOトレンド 補助バー（衣装系）
 *
 * 現在の女性ファッショントレンドを抽象属性として抽出し、
 * 「反映する」を押した時だけ衣装プロンプトに反映する。
 *
 * - 自動モード：内蔵トレンドライブラリから年代・カテゴリでランダム抽出（毎回違う）
 * - 手動貼り付け：ZOZOランキング文を貼ると既知のトレンド属性だけ抽出（ブランド名は無視）
 */

import { useState } from "react";
import {
  sampleZozoTrend, extractZozoFromText,
  ZOZO_AGE_OPTIONS, ZOZO_CATEGORY_OPTIONS,
  type ZozoAge, type ZozoCategory, type ZozoTrend,
} from "../lib/zozoTrend";

interface Props {
  /** 衣装スコープが現在ONか（反映可否の判定・警告表示用） */
  outfitScopeOn: boolean;
  /** 衣装系の他指定（神引き衣装・世界観衣装系等）がアクティブか（競合表示用） */
  outfitConflict?: boolean;
  /** 現在反映中のトレンド（null = 未反映）。mode で 補助/優先 を区別 */
  applied: ZozoTrend | null;
  /** 反映する（mode 既定 assist） */
  onApply: (trend: ZozoTrend) => void;
  /** 優先反映に切替（既存 applied がある場合に mode=priority へ） */
  onSetPriority?: (priority: boolean) => void;
  /** 反映クリア */
  onClear: () => void;
  /** 反映オプション内に埋め込む場合は外枠を消す */
  embedded?: boolean;
}

export function ZozoTrendBar({
  outfitScopeOn, outfitConflict = false,
  applied, onApply, onSetPriority, onClear, embedded = false,
}: Props) {
  const [open, setOpen]         = useState(false);
  const [age, setAge]           = useState<ZozoAge>("twenties"); // 初期値：20代
  const [category, setCategory] = useState<ZozoCategory>("auto");
  const [mode, setMode]         = useState<"auto" | "paste">("auto");
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview]   = useState<ZozoTrend | null>(null);

  // ── 現在の反映ステータス（バッジ）──
  const isApplied  = !!applied && applied.traits.length > 0;
  const isPriority = isApplied && applied?.mode === "priority";
  const effective  = isApplied && outfitScopeOn;            // 実効反映中
  const stalled    = isApplied && !outfitScopeOn;           // 未反映（衣装OFF）
  const conflictWarn = effective && outfitConflict && !isPriority; // 補助＋衝突

  const handleFetch = () => {
    if (mode === "paste") {
      setPreview(extractZozoFromText(pasteText, age, category));
    } else {
      setPreview(sampleZozoTrend(age, category));
    }
  };

  const handleApply = () => {
    if (preview && preview.traits.length > 0) {
      onApply({ ...preview, mode: "assist" });
    }
  };

  return (
    <div
      className={[
        "transition-colors",
        embedded
          ? "rounded-lg"
          : ["rounded-xl border",
              isPriority && effective ? "border-amber-400/70 bg-amber-400/8 shadow-[0_0_10px_rgba(251,191,36,0.18)]"
              : effective              ? "border-emerald-400/55 bg-emerald-400/8"
              : isApplied              ? "border-amber-400/40 bg-amber-400/5"
              : "border-bg-border bg-bg-panel/40"
            ].join(" "),
      ].join(" ")}
    >
      {/* ── ヘッダー（👗 ZOZO ボタン）── */}
      <div className={["flex items-center gap-2.5 flex-wrap", embedded ? "px-0 py-0.5" : "px-3.5 py-2.5"].join(" ")}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2"
        >
          <span className="text-[15px] leading-none">👗</span>
          <span className={[
            "text-[12px] font-bold leading-none",
            effective ? "text-emerald-100" : isApplied ? "text-amber-100" : "text-text-muted",
          ].join(" ")}>
            ZOZOトレンド
          </span>
          <span className="text-[11px] text-text-muted/40">衣装の今っぽさを補助</span>
        </button>

        {/* ── 反映ステータスバッジ ── */}
        {effective && isPriority && (
          <span className="text-[12px] font-bold px-2 py-0.5 rounded-full border border-amber-400/70 bg-amber-400/20 text-amber-100 leading-none shadow-[0_0_6px_rgba(251,191,36,0.35)]">
            ⭐ 優先反映中（{applied!.ageLabel}）
          </span>
        )}
        {effective && !isPriority && (
          <span className="text-[12px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/55 bg-emerald-400/15 text-emerald-100 leading-none">
            ✅ 反映中（{applied!.ageLabel}）
          </span>
        )}
        {stalled && (
          <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full border border-amber-400/55 bg-amber-400/15 text-amber-100 leading-none">
            ⚠ 未反映（衣装変更OFF）
          </span>
        )}
        {!isApplied && (
          <span className="text-[11px] text-text-muted/45 leading-none">未反映</span>
        )}
        {conflictWarn && (
          <span className="text-[11px] text-amber-200/80 leading-none">
            ⚠ 他の衣装指定と併用中（優先反映を推奨）
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[12px] text-text-muted/40 hover:text-text-muted/70 transition px-1 leading-none"
        >
          {open ? "▲" : "▼"}
        </button>
      </div>

      {/* ── 展開パネル ── */}
      {open && (
        <div className={["border-t border-bg-border/60 py-2.5 space-y-2.5", embedded ? "px-0 mt-1" : "px-3.5"].join(" ")}>

          {/* 年代 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-muted/50 w-10 shrink-0">年代</span>
            <div className="flex flex-wrap gap-1">
              {ZOZO_AGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setAge(o.value)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded-md border leading-none transition",
                    age === o.value
                      ? "border-pink-400/60 bg-pink-400/20 text-pink-100 font-semibold"
                      : "border-bg-border text-text-muted/55 hover:border-pink-400/35",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* カテゴリ */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-muted/50 w-10 shrink-0">カテゴリ</span>
            <div className="flex flex-wrap gap-1">
              {ZOZO_CATEGORY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setCategory(o.value)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded-md border leading-none transition",
                    category === o.value
                      ? "border-pink-400/60 bg-pink-400/20 text-pink-100 font-semibold"
                      : "border-bg-border text-text-muted/55 hover:border-pink-400/35",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* モード切替 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={[
                "text-[11px] px-2 py-0.5 rounded-md border leading-none transition",
                mode === "auto"
                  ? "border-sky-400/60 bg-sky-400/15 text-sky-100"
                  : "border-bg-border text-text-muted/50 hover:border-sky-400/35",
              ].join(" ")}
            >
              自動（トレンド参照）
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={[
                "text-[11px] px-2 py-0.5 rounded-md border leading-none transition",
                mode === "paste"
                  ? "border-sky-400/60 bg-sky-400/15 text-sky-100"
                  : "border-bg-border text-text-muted/50 hover:border-sky-400/35",
              ].join(" ")}
            >
              手動貼り付け
            </button>
          </div>

          {/* 貼り付けエリア */}
          {mode === "paste" && (
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="ZOZOランキングの商品名やコーデ文をここに貼り付け。ブランド名は無視され、トレンド傾向だけ抽出します。"
              rows={3}
              className="w-full px-2.5 py-2 rounded-lg border border-bg-border bg-bg-base text-[12px] text-text-base placeholder:text-text-muted/45 outline-none focus:border-pink-400/50 transition resize-none"
            />
          )}

          {/* 取得ボタン */}
          <button
            type="button"
            onClick={handleFetch}
            className="w-full rounded-lg px-3 py-1.5 text-[12px] font-semibold border border-sky-400/40 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20 transition"
          >
            {mode === "paste" ? "📝 貼り付けから傾向を抽出" : "🔄 トレンドを取得（毎回ランダム）"}
          </button>

          {/* プレビュー結果 */}
          {preview && (
            <div className="rounded-lg border border-pink-400/25 bg-pink-400/5 p-2.5 space-y-2">
              <div className="text-[12px] font-bold text-pink-100">
                👗 ZOZOトレンド {preview.ageLabel}・{preview.categoryLabel}
              </div>
              {preview.traits.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {preview.traits.map((t) => (
                    <span key={t}
                      className="text-[11px] px-1.5 py-0.5 rounded-full border border-pink-400/30 bg-pink-400/10 text-pink-100/85 leading-none">
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-text-muted/50 leading-snug">
                  傾向を抽出できませんでした。別の文を貼るか、自動モードをお試しください。
                </p>
              )}

              {/* アクション */}
              <div className="flex flex-wrap gap-1.5 pt-0.5 items-center">
                {/* 反映 / 反映解除 サイクル */}
                {isApplied ? (
                  <button
                    type="button"
                    onClick={() => { setPreview(null); onClear(); }}
                    title="反映を解除（ZOZOトレンドの反映を停止）"
                    className="text-[12px] px-2.5 py-1 rounded-lg border border-emerald-400/60 bg-emerald-500/20 text-emerald-50 font-bold hover:bg-rose-500/25 hover:border-rose-400/70 transition"
                  >
                    {isPriority ? "⭐ 優先反映中（解除）" : "✅ 反映中（解除）"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={preview.traits.length === 0}
                    onClick={handleApply}
                    title="この内容で衣装プロンプトへ反映する"
                    className="text-[12px] px-2.5 py-1 rounded-lg border border-pink-400/60 bg-pink-500/20 text-pink-50 font-semibold hover:bg-pink-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ✓ 反映する（補助）
                  </button>
                )}

                {/* 優先トグル */}
                {isApplied && onSetPriority && (
                  <button
                    type="button"
                    onClick={() => onSetPriority(!isPriority)}
                    title={isPriority
                      ? "優先反映を解除して『補助反映』に戻す"
                      : "ZOZOトレンドを衣装方針の主軸として優先反映する"}
                    className={[
                      "text-[12px] px-2.5 py-1 rounded-lg border font-bold transition",
                      isPriority
                        ? "border-amber-400/70 bg-amber-400/20 text-amber-100"
                        : "border-amber-400/45 bg-amber-400/8 text-amber-200 hover:bg-amber-400/18",
                    ].join(" ")}
                  >
                    {isPriority ? "⭐ 優先ON" : "☆ 優先にする"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleFetch}
                  className="text-[12px] px-2.5 py-1 rounded-lg border border-sky-400/40 bg-sky-400/8 text-sky-200/80 hover:bg-sky-400/18 transition"
                >
                  🔄 再取得
                </button>
              </div>

              {/* ステータス補足説明 */}
              {effective && (
                <p className={[
                  "text-[11px] leading-snug pt-1",
                  isPriority ? "text-amber-200" : "text-emerald-200/85",
                ].join(" ")}>
                  {isPriority
                    ? "⭐ 衣装方針の主軸として最優先で反映中。他の衣装指定はZOZOの方向性に合わせて調整されます。"
                    : "✅ 上記のトレンド要素を衣装プロンプトへ補助反映中。"}
                </p>
              )}
              {stalled && (
                <p className="text-[11px] text-amber-200 leading-snug pt-1">
                  ⚠ ZOZOトレンドは取得済みですが、現在は<span className="font-bold">「衣装」が変更対象に入っていない</span>ため反映されていません。
                  上の「変更するもの」で衣装をONにしてください。
                </p>
              )}
              {conflictWarn && (
                <p className="text-[11px] text-amber-200/85 leading-snug pt-1">
                  ⚠ 他の衣装指定（神引き・世界観など）が併用中です。
                  ZOZOを主軸にしたい場合は <span className="font-bold">「優先にする」</span> を押してください。
                </p>
              )}
            </div>
          )}

          {/* 注記 */}
          <p className="text-[11px] text-text-muted/35 leading-snug">
            ブランド名・商品名は使わず、服の種類・色・素材・シルエット・系統の傾向だけを衣装に反映します。
            反映は「衣装」スコープがONのときのみ有効です。
          </p>
        </div>
      )}
    </div>
  );
}
