import { useState } from "react";
import type { LockKey, SafetyMode } from "../types";

// ── Constants ──────────────────────────────────────────────────────────────

const LOCK_OPTIONS: { id: LockKey; label: string }[] = [
  { id: "face",         label: "顔"           },
  { id: "body_shape",   label: "体型"         },
  { id: "expression",   label: "表情"         },
  { id: "identity",     label: "同一性"       },
  { id: "color",        label: "色味"         },
  { id: "camera",       label: "カメラ"       },
  { id: "aspect_ratio", label: "アスペクト比" },
];

const SAFETY_OPTIONS: { id: SafetyMode; label: string }[] = [
  { id: "fictional_ai", label: "AI生成・架空キャラ" },
  { id: "real_person",  label: "実在人物"          },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  faceLock: boolean;
  onFaceLockChange: (v: boolean) => void;
  locks: Record<LockKey, boolean>;
  onLocksChange: (next: Record<LockKey, boolean>) => void;
  safety: SafetyMode;
  onSafetyChange: (next: SafetyMode) => void;
  avoidCliche: boolean;
  onAvoidClicheChange: (v: boolean) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * 保護設定バー — 顔ロック・固定項目・安全文モードをひとつに統合。
 *
 * 通常時: [🔒 保護設定] [N件ON] [●◦ faceLock] [詳細 ▼]
 * 展開時: 固定項目チェックボックス群 + 安全モード選択
 */
export function ProtectionBar({
  faceLock, onFaceLockChange,
  locks, onLocksChange,
  safety, onSafetyChange,
  avoidCliche, onAvoidClicheChange,
}: Props) {
  const [open, setOpen] = useState(false);

  // 顔ロック(1) + 個別ロック + 手足補正(常時1) = 表示カウント
  const activeLocks = Object.values(locks).filter(Boolean).length;
  const totalOn     = (faceLock ? 1 : 0) + activeLocks + 1; // +1 = 手足補正

  const borderColor = faceLock ? "border-emerald-500/45" : "border-[#252e44]";
  const bgColor     = faceLock ? "bg-emerald-500/8"      : "bg-[#0f1218]";

  return (
    <div>
      {/* ── Header bar ────────────────────────────────────────────── */}
      <div
        className={[
          "rounded-2xl border transition-colors",
          open ? "rounded-b-none border-b-[#0f1218]" : "",
          borderColor, bgColor,
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 px-4 py-3">

          {/* Icon */}
          <span className="text-[18px] shrink-0 leading-none">🔒</span>

          {/* Label + subtitle */}
          <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
            <span className={[
              "text-[13px] font-bold shrink-0",
              faceLock ? "text-emerald-200" : "text-text-muted",
            ].join(" ")}>
              保護設定
            </span>
            <span className="text-[11px] text-text-muted/45 truncate hidden sm:inline">
              選択項目を保護して生成します
            </span>
          </div>

          {/* Count badge */}
          <span className={[
            "text-[11px] font-semibold rounded-full px-2 py-0.5 border shrink-0 tabular-nums",
            faceLock
              ? "text-emerald-300/80 bg-emerald-400/10 border-emerald-400/22"
              : "text-text-muted/50 bg-bg-border/20 border-bg-border/40",
          ].join(" ")}>
            {totalOn}件ON
          </span>

          {/* FaceLock toggle — click stops propagation so it doesn't also toggle open */}
          <button
            type="button"
            title={faceLock ? "顔ロック ON（クリックでOFF）" : "顔ロック OFF（クリックでON）"}
            onClick={(e) => { e.stopPropagation(); onFaceLockChange(!faceLock); }}
            className="shrink-0"
          >
            <span className={[
              "inline-flex w-10 h-6 rounded-full relative transition-colors",
              faceLock ? "bg-emerald-500" : "bg-bg-border",
            ].join(" ")}>
              <span className={[
                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                faceLock ? "translate-x-4" : "",
              ].join(" ")} />
            </span>
          </button>

          {/* Expand button */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={[
              "shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border transition",
              open
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-[#252e44] text-text-muted/55 hover:border-accent/40 hover:text-text-base",
            ].join(" ")}
          >
            <span>詳細</span>
            <span className="text-[9px] leading-none">{open ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* ── Expanded panel ────────────────────────────────────────── */}
      {open && (
        <div className={[
          "rounded-b-2xl border border-t-0 px-4 pt-3 pb-3.5 space-y-3",
          borderColor,
          faceLock ? "bg-emerald-500/5" : "bg-[#0b0e15]",
        ].join(" ")}>

          {/* Lock chip row */}
          <div className="flex flex-wrap gap-1.5">
            {LOCK_OPTIONS.map((opt) => {
              const on = locks[opt.id];
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onLocksChange({ ...locks, [opt.id]: !on })}
                  className={[
                    "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] border transition select-none",
                    on
                      ? "border-accent/55 bg-accent/12 text-text-base"
                      : "border-[#252e44] bg-transparent text-text-muted/55 hover:border-accent/35 hover:text-text-base",
                  ].join(" ")}
                >
                  <span className={["text-[10px]", on ? "text-accent" : "text-text-muted/30"].join(" ")}>
                    {on ? "☑" : "☐"}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-bg-border/30" />

          {/* Safety mode + hand/foot note */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5">
            <span className="text-[11px] text-text-muted/50 shrink-0 select-none">安全モード</span>
            <div className="flex gap-1.5 flex-wrap">
              {SAFETY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSafetyChange(opt.id)}
                  className={[
                    "flex items-center gap-1 text-[12px] px-3 py-1 rounded-lg border transition font-medium select-none",
                    safety === opt.id
                      ? "border-violet-400/60 bg-violet-400/15 text-violet-100"
                      : "border-[#252e44] bg-transparent text-text-muted/60 hover:border-violet-400/35 hover:text-text-base",
                  ].join(" ")}
                >
                  <span className={[
                    "text-[9px]",
                    safety === opt.id ? "text-violet-400" : "text-text-muted/25",
                  ].join(" ")}>
                    {safety === opt.id ? "●" : "○"}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[10px] text-text-muted/30 shrink-0 select-none">
              🛡 手足補正 常時ON
            </span>
          </div>

          {/* Avoid cliché toggle */}
          <div className="flex items-center gap-2.5 pt-0.5">
            <button
              type="button"
              title={avoidCliche
                ? "量産構図を避ける：ON（クリックでOFF）"
                : "量産構図を避ける：OFF（クリックでON）"}
              onClick={() => onAvoidClicheChange(!avoidCliche)}
              className="flex items-center gap-2 select-none group"
            >
              <span className={[
                "inline-flex w-8 h-5 rounded-full relative transition-colors shrink-0",
                avoidCliche ? "bg-amber-500" : "bg-bg-border",
              ].join(" ")}>
                <span className={[
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  avoidCliche ? "translate-x-3" : "",
                ].join(" ")} />
              </span>
              <span className={[
                "text-[12px] font-medium leading-none transition-colors",
                avoidCliche ? "text-amber-200" : "text-text-muted/50",
              ].join(" ")}>
                量産構図を避ける
              </span>
            </button>
            <span className="text-[10px] text-text-muted/30 leading-tight">
              {avoidCliche
                ? "定番組み合わせをズラして独自性を出す"
                : "定番構成の制限なし"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
