/**
 * SkyveilBar — メイン画面の「skyveil好みAI」操作バー。
 *
 * 既存の好み分析(実Gemini)・お気に入り傾向・評価・画像分析を1つに束ねた
 * 統合プロファイルを反映するための、単一の操作起点。
 *
 *  [skyveil好み反映 ON/OFF]  [弱 / 標準 / 強]
 *  [好み分析を更新] [プロファイルを見る] [今回だけ反映] [リセット]
 *  ▼ 好き / 出すぎ注意 / 避けたい / 未開拓おすすめ / 現在の反映
 */

import { useState } from "react";
import type { SkyveilProfile, SkyveilStrength } from "../lib/skyveilProfile";
import { STRENGTH_LABEL } from "../lib/skyveilProfile";

interface Props {
  enabled: boolean;
  strength: SkyveilStrength;
  profile: SkyveilProfile;
  analyzing: boolean;
  /** 実Gemini分析のサンプル数（更新ボタンの有効/無効に使う） */
  sampleCount: number;
  minSamples: number;
  /** 今回だけ反映が予約されているか */
  oneShotArmed: boolean;

  onToggle: (v: boolean) => void;
  onStrength: (s: SkyveilStrength) => void;
  onUpdateAnalysis: () => void;
  onOneShot: () => void;
  onReset: () => void;
}

const STRENGTHS: SkyveilStrength[] = ["weak", "standard", "strong"];

export function SkyveilBar({
  enabled, strength, profile, analyzing, sampleCount, minSamples, oneShotArmed,
  onToggle, onStrength, onUpdateAnalysis, onOneShot, onReset,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = enabled || oneShotArmed;

  return (
    <div className={[
      "rounded-2xl border transition-colors",
      active ? "border-violet-400/50 bg-violet-500/8" : "border-bg-border bg-bg-panel/40",
    ].join(" ")}>
      {/* ── 上段：トグル＋強度 ── */}
      <div className="px-3.5 py-2.5 flex items-center gap-2.5 flex-wrap">
        <span className="text-[15px]">🧬</span>
        <span className="text-[14px] font-bold text-text-base">skyveil好みAI</span>

        {/* ON/OFF */}
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          aria-pressed={enabled}
          className={[
            "ml-1 px-2.5 py-1 rounded-full text-[12px] font-bold border transition leading-none",
            enabled
              ? "border-violet-400/70 bg-violet-500/25 text-violet-100"
              : "border-bg-border bg-bg-panel text-text-muted hover:text-text-base hover:border-accent/50",
          ].join(" ")}
        >
          {enabled ? "反映 ON" : "反映 OFF"}
        </button>

        {/* 強度 */}
        <div className="flex items-center gap-1" role="group" aria-label="反映強度">
          {STRENGTHS.map((s) => {
            const on = strength === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStrength(s)}
                disabled={!enabled && !oneShotArmed}
                className={[
                  "px-2 py-1 rounded-md text-[12px] font-semibold border transition leading-none",
                  on
                    ? "border-violet-400/70 bg-violet-500/20 text-violet-100"
                    : "border-bg-border bg-bg-panel text-text-muted hover:text-text-base",
                  (!enabled && !oneShotArmed) ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {STRENGTH_LABEL[s]}
              </button>
            );
          })}
        </div>

        {oneShotArmed && !enabled && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-amber-400/50 bg-amber-400/12 text-amber-200 leading-none">
            今回だけ反映
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[12px] text-text-muted hover:text-text-base transition leading-none"
        >
          {open ? "▲ 閉じる" : "▼ プロファイルを見る"}
        </button>
      </div>

      {/* ── 下段：操作ボタン ── */}
      <div className="px-3.5 pb-2.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onUpdateAnalysis}
          disabled={analyzing || sampleCount < minSamples}
          title={sampleCount < minSamples ? `評価が ${minSamples} 件以上たまると更新できます（現在 ${sampleCount} 件）` : "Geminiで好みプロファイルを再分析"}
          className="px-2.5 py-1 rounded-lg text-[12px] font-semibold border border-violet-400/45 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition disabled:opacity-40 disabled:cursor-not-allowed leading-none"
        >
          {analyzing ? "分析中…" : "🔄 好み分析を更新"}
        </button>
        {!enabled && (
          <button
            type="button"
            onClick={onOneShot}
            className="px-2.5 py-1 rounded-lg text-[12px] font-semibold border border-amber-400/45 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition leading-none"
          >
            ✨ 今回だけ反映
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="px-2.5 py-1 rounded-lg text-[12px] border border-bg-border bg-bg-panel text-text-muted hover:text-text-base hover:border-rose-400/40 transition leading-none"
        >
          反映リセット
        </button>
      </div>

      {/* ── プロファイル表示 ── */}
      {open && (
        <div className="px-3.5 pb-3 pt-1 border-t border-violet-400/15 space-y-2">
          {!profile.hasData ? (
            <p className="text-[12px] text-text-muted/80 leading-snug py-1">
              まだ好みデータが足りません。生成・お気に入り・評価を重ねるか「好み分析を更新」を押すと、
              ここに skyveil の好みプロファイルが表示されます。
            </p>
          ) : (
            <>
              {profile.summary && (
                <p className="text-[12px] text-violet-100/85 leading-snug bg-violet-500/8 rounded-lg px-2.5 py-1.5 border border-violet-400/20">
                  💬 {profile.summary}
                </p>
              )}
              <ProfileRow color="emerald" label="好き"          items={profile.likes} />
              <ProfileRow color="amber"   label="出すぎ注意"     items={profile.overusedButLiked}
                          note="（好みだが頻出。変換して新鮮さを出します）" />
              <ProfileRow color="rose"    label="避けたい"       items={profile.avoid} />
              <ProfileRow color="sky"     label="未開拓おすすめ" items={profile.underusedRecommended} />
            </>
          )}

          {/* 現在の反映 */}
          <div className="text-[12px] text-text-muted/85 pt-1 border-t border-violet-400/10">
            現在の反映：
            <span className={active ? "text-violet-200 font-semibold ml-1" : "text-text-muted ml-1"}>
              {enabled ? `ON / ${STRENGTH_LABEL[strength]}` : oneShotArmed ? `今回だけ / ${STRENGTH_LABEL[strength]}` : "OFF"}
            </span>
            <span className="text-text-muted/60 ml-2">
              ※ 変更対象・固定ルールが最優先（対象外の軸には反映しません）
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({ color, label, items, note }: {
  color: "emerald" | "amber" | "rose" | "sky"; label: string; items: string[]; note?: string;
}) {
  if (items.length === 0) return null;
  const chip: Record<string, string> = {
    emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200/90",
    amber:   "border-amber-400/40 bg-amber-400/10 text-amber-200/90",
    rose:    "border-rose-400/40 bg-rose-400/10 text-rose-200/90",
    sky:     "border-sky-400/40 bg-sky-400/10 text-sky-200/90",
  };
  const lbl: Record<string, string> = {
    emerald: "text-emerald-300/85", amber: "text-amber-300/85",
    rose: "text-rose-300/85", sky: "text-sky-300/85",
  };
  return (
    <div className="flex items-start gap-2">
      <span className={["text-[12px] font-bold shrink-0 mt-0.5 leading-none w-20", lbl[color]].join(" ")}>{label}</span>
      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
        {items.map((t, i) => (
          <span key={i} className={["text-[11px] px-1.5 py-0.5 rounded-full border leading-none", chip[color]].join(" ")}>{t}</span>
        ))}
        {note && <span className="text-[10px] text-text-muted/55 w-full leading-snug">{note}</span>}
      </div>
    </div>
  );
}
