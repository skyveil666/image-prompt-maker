import { useEffect, useRef, useState } from "react";
import {
  getNotifSettings,
  setNotifSettings,
  type NotifSettings,
} from "../lib/notificationSettings";

interface ToggleItem {
  key:   keyof NotifSettings;
  icon:  string;
  label: string;
}

const ITEMS: ToggleItem[] = [
  { key: "sound",     icon: "🔔", label: "完了音" },
  { key: "toast",     icon: "💬", label: "トースト通知" },
  { key: "tabTitle",  icon: "📑", label: "タブ通知" },
  { key: "animation", icon: "✨", label: "アニメーション" },
];

export function NotificationSettings() {
  const [open,     setOpen]     = useState(false);
  const [settings, setSettings] = useState<NotifSettings>(getNotifSettings);
  const rootRef = useRef<HTMLDivElement>(null);

  // パネル外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (key: keyof NotifSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setNotifSettings(next);
  };

  return (
    <div className="relative" ref={rootRef}>
      {/* 🔔 アイコンボタン */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="完了通知の設定"
        className={[
          "w-9 h-9 flex items-center justify-center rounded-xl border transition text-base",
          open
            ? "border-accent/60 bg-accent/18 text-accent"
            : "border-bg-border bg-bg-panel/70 text-text-muted hover:text-text-base hover:border-accent/40",
        ].join(" ")}
      >
        🔔
      </button>

      {/* ドロップダウンパネル */}
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-bg-border bg-[#12151c] shadow-[0_8px_32px_rgba(0,0,0,0.55)] p-3 z-50">
          <p className="text-[10px] uppercase tracking-widest text-text-muted/50 mb-2.5 font-semibold px-1">
            完了通知
          </p>

          <div className="space-y-0.5">
            {ITEMS.map(({ key, icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition text-left group"
              >
                <span className="text-sm w-5 text-center flex-shrink-0">{icon}</span>
                <span className="flex-1 text-xs text-text-base/80 group-hover:text-text-base transition">
                  {label}
                </span>
                {/* トグルスイッチ */}
                <span
                  className={[
                    "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
                    settings[key] ? "bg-emerald-500/80" : "bg-bg-border",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      settings[key] ? "translate-x-4" : "translate-x-0",
                    ].join(" ")}
                  />
                </span>
              </button>
            ))}
          </div>

          {/* 全ON / 全OFF */}
          <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-bg-border/60">
            <button
              type="button"
              onClick={() => {
                const next: NotifSettings = { sound: true, toast: true, tabTitle: true, animation: true };
                setSettings(next);
                setNotifSettings(next);
              }}
              className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/8 text-emerald-300/80 hover:bg-emerald-400/15 transition"
            >
              全ON
            </button>
            <button
              type="button"
              onClick={() => {
                const next: NotifSettings = { sound: false, toast: false, tabTitle: false, animation: false };
                setSettings(next);
                setNotifSettings(next);
              }}
              className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border border-bg-border bg-bg-panel/60 text-text-muted/70 hover:text-text-base transition"
            >
              全OFF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
