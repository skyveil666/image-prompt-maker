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
  const [categories, setCategories] = useState<ZozoCategory[]>(["auto"]);
  const [mode, setMode]         = useState<"auto" | "paste">("auto");
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview]   = useState<ZozoTrend | null>(null);
  // 候補の中からユーザーがタップで選んだものだけ反映する（非永続・取得用の一時選択）。
  const [selectedTraits, setSelectedTraits] = useState<Set<string>>(new Set());

  // ── 現在の反映ステータス（バッジ）──
  const isApplied  = !!applied && applied.traits.length > 0;
  const isPriority = isApplied && applied?.mode === "priority";
  const effective  = isApplied && outfitScopeOn;            // 実効反映中
  const stalled    = isApplied && !outfitScopeOn;           // 未反映（衣装OFF）
  const conflictWarn = effective && outfitConflict && !isPriority; // 補助＋衝突
  const disabled   = !outfitScopeOn;                        // 衣装OFF＝衣装補助は無効（グレーアウト）

  const handleFetch = () => {
    setSelectedTraits(new Set()); // 取得直後は全未選択から（20個一括注入の混雑を避け、意図的に選ばせる）
    if (mode === "paste") {
      setPreview(extractZozoFromText(pasteText, age, categories));
    } else {
      setPreview(sampleZozoTrend(age, categories));
    }
  };

  const handleApply = () => {
    if (!preview) return;
    // ★選択したトレンドだけ反映（未選択は載せない＝一括注入の混雑を解消）。下流は traits[] を絞るだけ。
    const traits = preview.traits.filter((t) => selectedTraits.has(t));
    if (traits.length > 0) onApply({ ...preview, traits, mode: "assist" });
  };

  /** 候補トレンドのタップ選択トグル。 */
  const toggleTrait = (t: string) => {
    setSelectedTraits((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };
  const allTraitsSelected =
    !!preview && preview.traits.length > 0 && selectedTraits.size === preview.traits.length;
  const toggleSelectAll = () => {
    if (!preview) return;
    setSelectedTraits(allTraitsSelected ? new Set() : new Set(preview.traits));
  };

  /** カテゴリ複数選択トグル。おまかせ(auto)/全身コーデ(full) は広域モード＝排他（押すと単独に）。
   *  個別カテゴリは auto/full を外してトグル。空になったら おまかせ に戻す
   *  （＝おまかせ／全身 と 個別 は相互排他で「同時選択」は発生しない）。 */
  const toggleCategory = (v: ZozoCategory) => {
    setCategories((prev) => {
      if (v === "auto" || v === "full") return [v];
      const base = prev.filter((c) => c !== "auto" && c !== "full");
      const next = base.includes(v) ? base.filter((c) => c !== v) : [...base, v];
      return next.length === 0 ? ["auto"] : next;
    });
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
        {!isApplied && !disabled && (
          <span className="text-[11px] text-text-muted/45 leading-none">未反映</span>
        )}
        {disabled && !stalled && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-400/45 bg-amber-400/10 text-amber-200/90 leading-none">
            🔒 衣装OFF（補助）
          </span>
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

          {/* 衣装補助：衣装OFF時はグレーアウト＋案内（ZOZOは衣装スコープONのときだけ反映） */}
          {disabled && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/8 px-2.5 py-1.5 text-[12px] text-amber-100 leading-snug">
              🔒 ZOZOトレンドは<strong>衣装の補助</strong>です。上の「変更対象」で<strong>衣装</strong>をONにすると使えます。
            </div>
          )}

          <div className={disabled ? "opacity-50 pointer-events-none select-none" : ""}>

          {/* 年代 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-text-muted/80 w-14 shrink-0">年代</span>
            <div className="flex flex-wrap gap-1.5">
              {ZOZO_AGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setAge(o.value)}
                  className={[
                    "text-[13px] font-semibold px-2.5 py-1 rounded-lg border leading-none transition",
                    age === o.value
                      ? "border-pink-400/70 bg-pink-400/22 text-pink-100"
                      : "border-bg-border/70 text-text-muted/80 hover:text-text-base hover:border-pink-400/45",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* カテゴリ */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-text-muted/80 w-14 shrink-0">カテゴリ</span>
            <div className="flex flex-wrap gap-1.5">
              {ZOZO_CATEGORY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggleCategory(o.value)}
                  className={[
                    "text-[13px] font-semibold px-2.5 py-1 rounded-lg border leading-none transition",
                    categories.includes(o.value)
                      ? "border-pink-400/70 bg-pink-400/22 text-pink-100"
                      : "border-bg-border/70 text-text-muted/80 hover:text-text-base hover:border-pink-400/45",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* モード切替 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={[
                "text-[13px] font-semibold px-3 py-1 rounded-lg border leading-none transition",
                mode === "auto"
                  ? "border-sky-400/70 bg-sky-400/18 text-sky-100"
                  : "border-bg-border/70 text-text-muted/80 hover:text-text-base hover:border-sky-400/45",
              ].join(" ")}
            >
              自動（トレンド参照）
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={[
                "text-[13px] font-semibold px-3 py-1 rounded-lg border leading-none transition",
                mode === "paste"
                  ? "border-sky-400/70 bg-sky-400/18 text-sky-100"
                  : "border-bg-border/70 text-text-muted/80 hover:text-text-base hover:border-sky-400/45",
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
            <div className="rounded-xl border border-pink-400/30 bg-pink-400/6 p-3 space-y-2.5">
              <div className="text-[14px] font-bold text-pink-100">
                👗 ZOZOトレンド {preview.ageLabel}・{preview.categoryLabel}
              </div>
              {preview.traits.length > 0 ? (
                <div className="space-y-1.5">
                  {/* 選択ヘッダー：選択中N個 ＋ 全選択/全解除 トグル */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-pink-200/75 leading-none">
                      タップで選択 — <span className="font-bold text-pink-100">選択中 {selectedTraits.size} 個</span>
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-[11px] px-2 py-0.5 rounded-md border border-pink-400/40 text-pink-200/85 hover:bg-pink-400/15 transition leading-none"
                    >
                      {allTraitsSelected ? "全解除" : "全選択"}
                    </button>
                  </div>
                  {/* 候補（タップで選択／解除）*/}
                  <div className="flex flex-wrap gap-1.5">
                    {preview.traits.map((t) => {
                      const sel = selectedTraits.has(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTrait(t)}
                          className={[
                            "text-[13px] font-medium px-2.5 py-1 rounded-full border leading-none transition",
                            sel
                              ? "border-pink-400/70 bg-pink-400/30 text-pink-50 shadow-[0_0_6px_rgba(244,114,182,0.4)]"
                              : "border-pink-400/30 bg-pink-400/8 text-pink-200/65 hover:bg-pink-400/16 hover:text-pink-100",
                          ].join(" ")}
                        >
                          {sel ? "✓ " : ""}{t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-text-muted/75 leading-snug">
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
                    disabled={selectedTraits.size === 0}
                    onClick={handleApply}
                    title="選択したトレンドだけを衣装プロンプトへ反映する"
                    className="text-[12px] px-2.5 py-1 rounded-lg border border-pink-400/60 bg-pink-500/20 text-pink-50 font-semibold hover:bg-pink-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ✓ 反映する（{selectedTraits.size}個）
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
                  "text-[13px] leading-snug pt-0.5",
                  isPriority ? "text-amber-200" : "text-emerald-200",
                ].join(" ")}>
                  {isPriority
                    ? "⭐ 衣装方針の主軸として最優先で反映中。他の衣装指定はZOZOの方向性に合わせて調整されます。"
                    : "✅ 上記のトレンド要素を衣装プロンプトへ補助反映中。"}
                </p>
              )}
              {stalled && (
                <p className="text-[13px] text-amber-200 leading-snug pt-0.5">
                  ⚠ ZOZOトレンドは取得済みですが、現在は<span className="font-bold">「衣装」が変更対象に入っていない</span>ため反映されていません。
                  上の「変更するもの」で衣装をONにしてください。
                </p>
              )}
              {conflictWarn && (
                <p className="text-[13px] text-amber-200 leading-snug pt-0.5">
                  ⚠ 他の衣装指定（神引き・世界観など）が併用中です。
                  ZOZOを主軸にしたい場合は <span className="font-bold">「優先にする」</span> を押してください。
                </p>
              )}
            </div>
          )}

          {/* 注記 */}
          <p className="text-[12px] text-text-muted/65 leading-snug">
            ブランド名・商品名は使わず、服の種類・色・素材・シルエット・系統の傾向だけを衣装に反映します。反映は「衣装」スコープがONのときのみ有効です。
          </p>
          </div>{/* /グレーアウトラッパ */}
        </div>
      )}
    </div>
  );
}
