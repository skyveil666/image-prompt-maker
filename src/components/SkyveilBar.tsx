/**
 * SkyveilBar — メイン画面の「skyveil好みAI」操作バー（skyveil の唯一のハブ）。
 *
 * 既存の好み分析(実Gemini)・お気に入り傾向・評価・画像分析を1つに束ねた
 * 統合プロファイルを反映するための、単一の操作起点。
 *
 * 通常時（常時表示）: [反映 ON/OFF] [弱/標準/強] [今回だけ反映]
 * 折りたたみ（▼設定・プロファイル）:
 *   操作: [好み分析を更新] [自動学習 ON/OFF] [反映リセット] [プロファイル削除]
 *   表示: 好き/出すぎ注意/避けたい/未開拓おすすめ / 成功プロンプト / 現在の反映
 *
 * ※ 反映ボタン方式を維持（自動反映はしない）。学習ロジックは変更しない（既存ハンドラ再利用のみ）。
 */

import { useState } from "react";
import type { SkyveilProfile, SkyveilStrength } from "../lib/skyveilProfile";
import { STRENGTH_LABEL } from "../lib/skyveilProfile";
import type { SuccessPromptPattern } from "../lib/successPatterns";

interface Props {
  enabled: boolean;
  strength: SkyveilStrength;
  profile: SkyveilProfile;
  analyzing?: boolean;
  /** 実Gemini分析のサンプル数（更新ボタンの有効/無効に使う） */
  sampleCount?: number;
  minSamples?: number;
  /** 今回だけ反映が予約されているか */
  oneShotArmed: boolean;
  /** true＝操作不可の読み取り専用表示（分析センター確認用）。操作の主入口は生成画面側。 */
  readOnly?: boolean;

  onToggle?: (v: boolean) => void;
  onStrength?: (s: SkyveilStrength) => void;
  onUpdateAnalysis?: () => void;
  onOneShot?: () => void;
  onReset?: () => void;

  // ── M-3 で移設（DuplicateAnalysisPanel から集約・既存ハンドラ再利用） ──
  /** 直近の分析エラー（成功時 null） */
  profileError?: string | null;
  /** 自動学習 ON/OFF */
  autoLearnEnabled?: boolean;
  onToggleAutoLearn?: (enabled: boolean) => void;
  /** 好み分析プロファイルの削除（学習データ削除＝反映リセットとは別物） */
  onClearProfile?: () => void;

  /** 成功プロンプト抽出（#9） */
  successPatterns?: SuccessPromptPattern[];
  onApplyPattern?: (pattern: SuccessPromptPattern) => void;
}

const STRENGTHS: SkyveilStrength[] = ["weak", "standard", "strong"];

export function SkyveilBar({
  enabled, strength, profile, analyzing = false, sampleCount = 0, minSamples = 0, oneShotArmed,
  readOnly = false,
  onToggle, onStrength, onUpdateAnalysis, onOneShot, onReset,
  profileError, autoLearnEnabled = false, onToggleAutoLearn, onClearProfile,
  successPatterns, onApplyPattern,
}: Props) {
  const [open, setOpen] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const active = enabled || oneShotArmed;

  // ── 読み取り専用（分析センター確認用）：操作は出さず、学習結果の要約のみ表示 ──
  if (readOnly) {
    return (
      <div className="rounded-2xl border border-violet-400/40 bg-violet-500/8">
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-[14px] leading-none">🧬</span>
          <span className="text-[13px] font-bold text-text-base leading-none">あなたの好み / skyveil傾向</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-400/40 bg-violet-500/12 text-violet-200/90 leading-none">確認用（読み取り専用）</span>
          <span className="ml-auto text-[11px] text-text-desc leading-none">
            現在の反映：
            <span className={active ? "text-violet-200 font-semibold ml-1" : "text-text-muted ml-1"}>
              {enabled ? `ON / ${STRENGTH_LABEL[strength]}` : oneShotArmed ? `今回だけ / ${STRENGTH_LABEL[strength]}` : "OFF"}
            </span>
          </span>
        </div>
        <div className="px-3.5 pb-3 pt-1 border-t border-violet-400/15 space-y-2.5">
          {!profile.hasData ? (
            <p className="text-[12px] text-text-desc leading-snug py-1">
              まだ好みデータが足りません。生成・お気に入り・評価を重ねると、ここに skyveil の好み傾向が表示されます。
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
          <div className="text-[11px] text-text-desc leading-snug pt-1 border-t border-violet-400/10">
            分析ソース：⭐お気に入り ・ 🆚Compare評価 ・ 📊画像評価 ・ 🕒履歴
          </div>
          <p className="text-[11px] text-violet-200/85 leading-snug">
            ↩ 反映・更新などの操作は、生成画面の「あなたの好み（skyveil）」で行えます（ここは確認専用）。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={[
      "rounded-2xl border transition-colors",
      active ? "border-violet-400/50 bg-violet-500/8" : "border-bg-border bg-bg-panel/40",
    ].join(" ")}>
      {/* ── 上段（常時表示・P4微圧縮）：トグル＋強度＋今回だけ反映 ── */}
      <div className="px-3 py-1.5 flex items-center gap-2 flex-wrap">
        <span className="text-[14px] leading-none">🧬</span>
        <span className="text-[13px] font-bold text-text-base leading-none">あなたの好み（skyveil）</span>

        {/* ON/OFF */}
        <button
          type="button"
          onClick={() => onToggle?.(!enabled)}
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
                onClick={() => onStrength?.(s)}
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

        {/* 今回だけ反映（OFF時のみ：通常利用の主操作） */}
        {!enabled && !oneShotArmed && (
          <button
            type="button"
            onClick={onOneShot}
            className="px-2.5 py-1 rounded-full text-[12px] font-semibold border border-amber-400/45 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition leading-none"
          >
            ✨ 今回だけ反映
          </button>
        )}
        {oneShotArmed && !enabled && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-amber-400/50 bg-amber-400/12 text-amber-200 leading-none">
            ✨ 今回だけ反映 予約中
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[12px] text-text-muted hover:text-text-base transition leading-none"
        >
          {open ? "▲ 閉じる" : "▼ 設定"}
        </button>
      </div>

      {/* ── 折りたたみ（展開時のみ）：詳細操作＋プロファイル ── */}
      {open && (
        <div className="px-3.5 pb-3 pt-1 border-t border-violet-400/15 space-y-2.5">

          {/* 詳細操作ボタン群（移設） */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onUpdateAnalysis}
              disabled={analyzing || sampleCount < minSamples}
              title={sampleCount < minSamples ? `評価が ${minSamples} 件以上たまると更新できます（現在 ${sampleCount} 件）` : "Geminiで好みプロファイルを再分析"}
              className="px-2.5 py-1 rounded-lg text-[12px] font-semibold border border-violet-400/45 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition disabled:opacity-40 disabled:cursor-not-allowed leading-none"
            >
              {analyzing ? "分析中…" : "🔄 好み分析を更新"}
            </button>

            {/* 自動学習トグル（移設） */}
            <button
              type="button"
              onClick={() => onToggleAutoLearn?.(!autoLearnEnabled)}
              aria-pressed={autoLearnEnabled}
              title="評価が増えるたびに自動で好みプロファイルを再分析する（生成への反映は反映ボタン方式のまま）"
              className={[
                "px-2.5 py-1 rounded-lg text-[12px] font-semibold border transition leading-none",
                autoLearnEnabled
                  ? "border-emerald-400/55 bg-emerald-500/15 text-emerald-100"
                  : "border-bg-border bg-bg-panel text-text-muted hover:text-text-base",
              ].join(" ")}
            >
              🔁 自動学習 {autoLearnEnabled ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              onClick={onReset}
              title="反映状態（ON/今回だけ）を解除します。学習データは消えません。"
              className="px-2.5 py-1 rounded-lg text-[12px] border border-bg-border bg-bg-panel text-text-muted hover:text-text-base hover:border-rose-400/40 transition leading-none"
            >
              反映リセット
            </button>

            <button
              type="button"
              onClick={onClearProfile}
              title="好み分析プロファイル（学習データ）を削除します。反映リセットとは別。"
              className="px-2.5 py-1 rounded-lg text-[12px] border border-rose-400/35 bg-rose-400/8 text-rose-200/85 hover:bg-rose-400/16 transition leading-none"
            >
              🗑 プロファイル削除
            </button>
          </div>

          {/* 分析ソース（読み取り専用の説明）＋ 今回だけ反映の説明 */}
          <div className="text-[11px] text-text-desc leading-snug space-y-0.5">
            <div>分析ソース：⭐お気に入り ・ 🆚Compare評価 ・ 📊画像評価 ・ 🕒履歴（自動では反映しません）</div>
            <div>✨ 今回だけ反映＝保存せず、この1回だけ適用。反映は<span className="text-amber-200/90 font-semibold">あなたが押した時だけ</span>。</div>
          </div>

          {/* エラー表示（移設） */}
          {profileError && (
            <div className="rounded-md border border-rose-400/55 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100/95">
              ⚠ 分析失敗: {profileError}
            </div>
          )}

          {/* プロファイル表示 */}
          {!profile.hasData ? (
            <p className="text-[12px] text-text-desc leading-snug py-1">
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

          {/* 🏆 成功プロンプト抽出（#9） */}
          {successPatterns && successPatterns.length > 0 && (
            <div className="pt-1 border-t border-violet-400/10">
              <button
                type="button"
                onClick={() => setPatternsOpen((v) => !v)}
                className="w-full flex items-center gap-2 text-left"
              >
                <span className="text-[12px] font-bold text-emerald-200">🏆 成功プロンプト抽出</span>
                <span className="text-[10px] text-text-muted/55">({successPatterns.length}型)</span>
                <span className="ml-auto text-[10px] text-text-muted/45">{patternsOpen ? "▲" : "▼"}</span>
              </button>
              {patternsOpen && (
                <div className="space-y-2 pt-1.5">
                  {successPatterns.map((p) => (
                    <div key={p.id} className="rounded-lg border border-emerald-400/25 bg-emerald-500/5 px-2.5 py-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-emerald-100">{p.title}</span>
                        <span className="text-[10px] text-emerald-300/70">適性 {p.score}</span>
                      </div>
                      <p className="text-[11px] text-text-muted/85 leading-snug">
                        変更対象：{p.changeTargetPattern.length > 0 ? p.changeTargetPattern.join("・") : "（なし）"}
                      </p>
                      <p className="text-[11px] text-text-muted/85 leading-snug">
                        守るもの：{p.protectedTargetPattern.slice(0, 6).join("・")}
                      </p>
                      {p.stylePattern.length > 0 && (
                        <p className="text-[11px] text-text-muted/75 leading-snug">傾向：{p.stylePattern.join("・")}</p>
                      )}
                      {p.successReasons.length > 0 && (
                        <p className="text-[10px] text-emerald-200/75 leading-snug">成功理由：{p.successReasons.join("／")}</p>
                      )}
                      {onApplyPattern && (
                        <button
                          type="button"
                          onClick={() => onApplyPattern(p)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-emerald-400/55 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 transition leading-none"
                        >
                          ✓ この型を現在設定に反映
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-[10px] text-text-desc leading-snug">
                    ※ 反映しても顔・同一性は保護。背景固定ON/衣装OFFの軸は反映されません。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 現在の反映 */}
          <div className="text-[12px] text-text-desc pt-1 border-t border-violet-400/10">
            現在の反映：
            <span className={active ? "text-violet-200 font-semibold ml-1" : "text-text-muted ml-1"}>
              {enabled ? `ON / ${STRENGTH_LABEL[strength]}` : oneShotArmed ? `今回だけ / ${STRENGTH_LABEL[strength]}` : "OFF"}
            </span>
            <span className="text-text-desc ml-2">
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
        {note && <span className="text-[10px] text-text-desc w-full leading-snug">{note}</span>}
      </div>
    </div>
  );
}
