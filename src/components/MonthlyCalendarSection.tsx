/**
 * MonthlyCalendarSection — 1ヶ月生成カレンダー（分析センター内 plan タブの中身）。
 *
 * 旧 PostingCalendarModal の中身（月送り＋30日グリッド）を、モーダル枠（portal/背景/✕）を外して
 * 分析センターのタブ内に表示できるよう抽出したもの。
 * ロジックは postingCalendar.ts を無改変で再利用（決定的・Gemini不使用・履歴不使用）。
 *
 * 各日の「✨ このテーマで生成準備」は、ヒント文を受け取って追加指示へ追記するだけ。
 * scope・固定・顔・同一性には一切触れない（安全）。A案/B案の生成計画は Phase2 で追加予定。
 */

import { useMemo, useState } from "react";
import { generatePostingCalendar, buildDayHint, type PostingDay } from "../lib/postingCalendar";

interface Props {
  /** テーマで生成準備：ヒント文を受け取り、メイン画面の追加指示に追記する（scope/固定は触らない） */
  onUseTheme: (hint: string, day: PostingDay) => void;
}

const SLOT_TONE: Record<string, string> = {
  morning: "border-amber-400/40 bg-amber-400/8 text-amber-200",
  day: "border-sky-400/40 bg-sky-400/8 text-sky-200",
  night: "border-violet-400/40 bg-violet-400/8 text-violet-200",
  goodnight: "border-indigo-400/40 bg-indigo-400/8 text-indigo-200",
};

export function MonthlyCalendarSection({ onUseTheme }: Props) {
  // 今日（テーマ強調・初期月）。マウント時に1回確定（セッション中は固定）。
  const today = useMemo(() => {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    return {
      key: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
      year: now.getFullYear(),
      month: now.getMonth() + 1, // 1-12
    };
  }, []);

  const [ym, setYm] = useState({ year: today.year, month: today.month });
  const days = useMemo(() => generatePostingCalendar(ym.year, ym.month), [ym]);

  const shiftMonth = (delta: number) => {
    setYm((p) => {
      const m = p.month + delta;
      if (m < 1) return { year: p.year - 1, month: 12 };
      if (m > 12) return { year: p.year + 1, month: 1 };
      return { year: p.year, month: m };
    });
  };

  return (
    <div className="space-y-2 pb-2">
      {/* 役割説明（plan タブ） */}
      <div className="rounded-lg border border-accent/40 bg-accent/8 px-3 py-2 text-[12px] text-text-base leading-snug">
        ℹ お気に入り・評価・履歴・重複分析・色分析を参考に、次の30日分の生成案を作る場所です（A案/B案は今後追加）。
        <strong>自動反映はされません</strong>。各日の「このテーマで生成準備」は<strong>追加指示に追記するだけ</strong>で、
        変更対象（scope）・固定・顔は変更しません。
      </div>

      {/* 月送りヘッダー */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => shiftMonth(-1)}
          className="px-2 py-1 rounded-lg border border-bg-border text-text-muted hover:text-text-base transition text-[12px]">◀</button>
        <span className="text-[13px] font-semibold text-text-base w-24 text-center">{ym.year}年 {ym.month}月</span>
        <button type="button" onClick={() => shiftMonth(1)}
          className="px-2 py-1 rounded-lg border border-bg-border text-text-muted hover:text-text-base transition text-[12px]">▶</button>
        <span className="text-[11px] text-text-muted/65 hidden sm:inline ml-2">毎日の「何投稿する？」を解消。テーマは参考・反映は任意。</span>
      </div>

      {/* 30日グリッド（スクロールは分析センターのタブ領域が担当） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {days.map((d) => {
          const isToday = d.dateKey === today.key;
          return (
            <div key={d.dateKey}
              className={[
                "rounded-xl border px-3 py-2 transition-colors",
                isToday ? "border-accent/60 bg-accent/8 shadow-[0_0_12px_-3px_rgba(124,92,255,0.4)]"
                  : "border-bg-border bg-bg-panel/40 hover:border-accent/35",
              ].join(" ")}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-text-base w-10">{d.day}日</span>
                <span className={["text-[10px] px-1.5 py-0.5 rounded-full border leading-none", SLOT_TONE[d.slot]].join(" ")}>
                  {d.slotLabel}
                </span>
                <span className="text-[12px] font-semibold text-text-base">{d.styleLabel}</span>
                {isToday && <span className="text-[10px] text-accent font-bold ml-auto">今日</span>}
              </div>
              <p className="text-[11px] text-text-muted/80 leading-snug mt-1">{d.hint}</p>
              <button type="button"
                onClick={() => onUseTheme(buildDayHint(d), d)}
                className="mt-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-emerald-400/45 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/22 transition leading-none">
                ✨ このテーマで生成準備
              </button>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-text-muted/55 px-1">
        ※「生成準備」は追加指示にテーマヒントを足すだけです。変更対象・顔/背景固定などの保護設定は変更しません。
      </div>
    </div>
  );
}
