import { useEffect, useMemo, useState } from "react";
import { getMonthCounts, type DayCounts } from "../lib/history";

interface Props {
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
  refreshKey?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function buildDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarView({ selectedDate, onSelectDate, refreshKey = 0 }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [counts, setCounts] = useState<Map<string, DayCounts>>(new Map());
  const [loading, setLoading] = useState(false);
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getMonthCounts(year, month).then((m) => {
      if (active) {
        setCounts(m);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [year, month, refreshKey]);

  const cells = useMemo(() => buildDays(year, month), [year, month]);

  const totalThisMonth = useMemo(() => {
    let t = 0;
    for (const c of counts.values()) t += c.total;
    return t;
  }, [counts]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <div className="rounded-2xl border border-bg-border bg-bg-panel/40 p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="w-7 h-7 rounded-md border border-bg-border bg-bg-base/60 text-text-muted hover:text-text-base hover:border-accent/60 transition text-sm"
            onClick={prevMonth}
            aria-label="前の月"
          >
            ‹
          </button>
          <h3 className="text-sm font-bold px-1">
            {year}年 {month + 1}月
          </h3>
          <button
            type="button"
            className="w-7 h-7 rounded-md border border-bg-border bg-bg-base/60 text-text-muted hover:text-text-base hover:border-accent/60 transition text-sm"
            onClick={nextMonth}
            aria-label="次の月"
          >
            ›
          </button>
        </div>
        <div className="text-[10px] text-text-muted">
          {loading ? "…" : `${totalThisMonth}件`}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-text-muted mb-1">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div
            key={d}
            className={[
              "py-0.5",
              i === 0 ? "text-rose-300/70" : i === 6 ? "text-sky-300/70" : "",
            ].join(" ")}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((dk, i) => {
          if (!dk) return <div key={i} className="h-10" />;
          const c = counts.get(dk);
          const day = Number(dk.slice(-2));
          const isToday = dk === todayKey;
          const isSelected = dk === selectedDate;
          const hasItems = !!c && c.total > 0;
          return (
            <button
              key={dk}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : dk)}
              className={[
                "h-10 rounded-md text-[11px] flex flex-col items-center justify-center border transition relative",
                isSelected
                  ? "border-accent bg-accent/25 text-text-base shadow-[0_0_0_1px_rgba(124,92,255,0.4)]"
                  : hasItems
                  ? "border-accent/30 bg-accent/5 hover:bg-accent/15 text-text-base"
                  : "border-bg-border/40 bg-bg-base/20 text-text-muted hover:bg-bg-base/40",
                isToday && !isSelected ? "ring-1 ring-amber-400/40" : "",
              ].join(" ")}
              title={
                c
                  ? `${dk} ・ ${c.total}件${c.favorites ? ` ・ ⭐${c.favorites}` : ""}`
                  : dk
              }
            >
              <span className={isToday ? "font-bold" : ""}>{day}</span>
              {c && (
                <span className="absolute bottom-0.5 right-1 flex items-center gap-0.5 text-[9px] leading-none">
                  {c.favorites > 0 && (
                    <span className="text-amber-300" aria-label="お気に入り">
                      ★
                    </span>
                  )}
                  <span className="text-text-muted">{c.total}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
