/**
 * PostingCalendarModal — 1ヶ月投稿カレンダー。
 *
 * 毎日1〜2枚X投稿する人向けに、30日分の投稿テーマ（時間帯＋系統）を一覧表示する。
 * 各日の「このテーマで生成準備」を押すと、テーマのヒント文を追加指示に追記してメイン画面へ。
 * ※ 変更対象・固定設定（顔・同一性・背景固定など）は一切触れない（安全）。
 */

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { generatePostingCalendar, buildDayHint, type PostingDay } from "../lib/postingCalendar";

interface Props {
  /** 今日の日付（テーマ強調用）。YYYY-MM-DD */
  todayKey: string;
  initialYear: number;
  initialMonth: number; // 1-12
  onClose: () => void;
  /** テーマで生成準備：ヒント文を受け取り、メイン画面の追加指示に追記する */
  onUseTheme: (hint: string, day: PostingDay) => void;
}

const SLOT_TONE: Record<string, string> = {
  morning: "border-amber-400/40 bg-amber-400/8 text-amber-200",
  day: "border-sky-400/40 bg-sky-400/8 text-sky-200",
  night: "border-violet-400/40 bg-violet-400/8 text-violet-200",
  goodnight: "border-indigo-400/40 bg-indigo-400/8 text-indigo-200",
};

export function PostingCalendarModal({ todayKey, initialYear, initialMonth, onClose, onUseTheme }: Props) {
  const [ym, setYm] = useState({ year: initialYear, month: initialMonth });
  const days = useMemo(() => generatePostingCalendar(ym.year, ym.month), [ym]);

  const shiftMonth = (delta: number) => {
    setYm((p) => {
      const m = p.month + delta;
      if (m < 1) return { year: p.year - 1, month: 12 };
      if (m > 12) return { year: p.year + 1, month: 1 };
      return { year: p.year, month: m };
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-bg-border bg-bg-card"
        onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-bg-border">
          <span className="text-[16px] font-bold text-text-base">📅 1ヶ月投稿カレンダー</span>
          <div className="flex items-center gap-1 ml-2">
            <button type="button" onClick={() => shiftMonth(-1)}
              className="px-2 py-1 rounded-lg border border-bg-border text-text-muted hover:text-text-base transition text-[12px]">◀</button>
            <span className="text-[13px] font-semibold text-text-base w-24 text-center">{ym.year}年 {ym.month}月</span>
            <button type="button" onClick={() => shiftMonth(1)}
              className="px-2 py-1 rounded-lg border border-bg-border text-text-muted hover:text-text-base transition text-[12px]">▶</button>
          </div>
          <span className="text-[11px] text-text-muted/65 hidden sm:inline">毎日の「何投稿する？」を解消。テーマは参考・反映は任意。</span>
          <button type="button" onClick={onClose}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-full border border-bg-border text-text-muted hover:text-text-base hover:border-accent/50 transition">✕</button>
        </div>

        {/* 30日リスト */}
        <div className="overflow-y-auto px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {days.map((d) => {
            const isToday = d.dateKey === todayKey;
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

        <div className="px-4 py-2 border-t border-bg-border text-[10px] text-text-muted/55">
          ※「生成準備」は追加指示にテーマヒントを足すだけです。変更対象・顔/背景固定などの保護設定は変更しません。
        </div>
      </div>
    </div>,
    document.body,
  );
}
