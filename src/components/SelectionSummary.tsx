/**
 * SelectionSummary — 「変更範囲」エリア内に表示する現在の選択チップ一覧
 *
 * 変更範囲・神引き・神引き補助・演出・世界観・SNS・カルチャーの選択を
 * 1か所のチップ行に集約し、右端にリセットを置く。
 * カテゴリごとに色味を変え、各チップは × で個別解除できる。
 *
 * （旧 StatusBar の「適用中」専用行を廃止し、ここへ統合）
 */
import type { Scope } from "../types";
import type { WorldPreset, EffectPreset } from "../lib/quickActions";

// ── ラベルマップ ─────────────────────────────────────────────────────────────
const SCOPE_SHORT: Record<Scope, string> = {
  background: "背景", foreground: "前景", pose: "ポーズ", hair: "髪",
  outfit: "衣装", cosplay: "コスプレ", cyber: "機械化", camera: "カメラ",
  props: "小物", big_object: "大物", vehicle: "乗り物", myth: "神話",
  lighting: "照明", aspect_ratio: "比率",
};

const WORLD_LABEL: Record<WorldPreset, string> = {
  y2k: "👗 Y2K", y3k: "🚀 Y3K", street: "🏙️ ストリート",
  cinema: "🎬 映画", wafuu: "🌸 和風", gothic: "🖤 ゴシック",
  ad: "📢 広告", fantasy: "✨ 幻想", retro: "📺 レトロ",
  jirai: "🖤 地雷系", seikimatsu: "☠️ 世紀末系",
};

const GOD_LABEL: Record<string, string> = {
  normal: "👑 ノーマル", chaos: "🎲 カオス", outfit: "🧥 衣装", bg: "🌍 背景",
  composition: "📷 構図", color: "🎨 色", world_god: "🌌 世界観",
  props: "🎁 小物", bigobject: "🏛️ 大物", myth: "🐉 神話", movie: "🎬 映画",
};

const BOOST_LABEL: Record<string, string> = {
  avoid_overlap: "🔁 被り回避", other_world: "🎲 別世界",
  buzz: "🧲 バズ寄せ", face_pop: "🎯 顔映え",
};

const EFFECT_LABEL: Record<string, string> = {
  fgrich: "🌀 前景盛り", microcyber: "🧬 微機械化", clean: "🧊 清潔感",
};

// ── チップ ───────────────────────────────────────────────────────────────────
type ChipColor = "scope" | "god" | "boost" | "effect" | "world" | "viral" | "sns" | "culture" | "zozo" | "zozoPriority";

const CHIP_STYLE: Record<ChipColor, string> = {
  scope:   "border-violet-400/45 bg-violet-400/10 text-violet-200",      // 変更範囲：青〜紫
  god:     "border-amber-400/60 bg-amber-400/12 text-amber-100",         // 神引き：金〜黄
  boost:   "border-yellow-400/45 bg-yellow-400/8 text-yellow-100/90",    // 神引き補助：淡い金
  effect:  "border-cyan-400/50 bg-cyan-400/10 text-cyan-200",            // 演出：水色〜シアン
  world:   "border-pink-400/50 bg-pink-400/10 text-pink-200",            // 世界観：ピンク〜紫
  viral:   "border-rose-500/55 bg-rose-500/12 text-rose-200",
  sns:     "border-rose-400/50 bg-rose-400/10 text-rose-200",
  culture: "border-teal-400/50 bg-teal-400/10 text-teal-200",
  zozo:         "border-emerald-400/55 bg-emerald-400/12 text-emerald-100",  // ZOZO 補助反映
  zozoPriority: "border-amber-400/70 bg-amber-400/15 text-amber-100 shadow-[0_0_6px_rgba(251,191,36,0.3)]", // 優先反映
};

function Chip({ color, label, onRemove }: { color: ChipColor; label: string; onRemove?: () => void }) {
  return (
    <span className={[
      "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[12px] font-medium leading-snug",
      CHIP_STYLE[color],
    ].join(" ")}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 opacity-50 hover:opacity-100 transition text-[11px] leading-none"
          title="解除"
        >
          ×
        </button>
      )}
    </span>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  scopes: Scope[];
  onScopeRemove: (s: Scope) => void;
  activeGodModes: string[];
  chaosLabel: string | null;
  onGodReset: () => void;
  activeBoosts: string[];
  onBoostRemove: (id: string) => void;
  activeEffectTypes: EffectPreset[];
  onEffectRemove: (e: EffectPreset) => void;
  activeWorldPresets: WorldPreset[];
  onWorldRemove: (w: WorldPreset) => void;
  viralMode: boolean;
  onViralRemove: () => void;
  activeSnsLabels: string[];
  activeCultureLabels: string[];
  onAssistReset: () => void;
  /** 変更するもの（スコープ）だけリセット */
  onScopesReset: () => void;
  /** 全リセット（変更・ブースト・お気に入り・ZOZO） */
  onResetAll: () => void;
  /** ZOZO 反映状態（実効反映中のときラベル表示） */
  zozoEffective?: "off" | "assist" | "priority";
  zozoAgeLabel?: string;
  onZozoRemove?: () => void;
}

export function SelectionSummary({
  scopes, onScopeRemove,
  activeGodModes, chaosLabel, onGodReset,
  activeBoosts, onBoostRemove,
  activeEffectTypes, onEffectRemove,
  activeWorldPresets, onWorldRemove,
  viralMode, onViralRemove,
  activeSnsLabels, activeCultureLabels, onAssistReset,
  onScopesReset, onResetAll,
  zozoEffective = "off", zozoAgeLabel, onZozoRemove,
}: Props) {
  const zozoActive = zozoEffective !== "off";
  // 神引きは normal/chaos/composition 以外も含め、まとめて1チップ群で表示
  const godChips = activeGodModes.map((m) =>
    m === "chaos" && chaosLabel ? `🎲 ${chaosLabel}` : (GOD_LABEL[m] ?? m)
  );

  const count =
    scopes.length + activeGodModes.length + activeBoosts.length +
    activeEffectTypes.length + activeWorldPresets.length +
    activeSnsLabels.length + activeCultureLabels.length + (viralMode ? 1 : 0) +
    (zozoActive ? 1 : 0);

  return (
    <div className="mt-1 rounded-lg border border-bg-border/40 bg-bg-base/30 px-2 py-1 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
      {/* 件数ラベル */}
      <span className="text-[12px] font-semibold text-slate-300 tracking-wider shrink-0">
        選択中{count > 0 ? `：${count}件` : ""}
      </span>

      {count === 0 ? (
        <span className="text-[12px] text-white/25">変更したい項目を選んでください</span>
      ) : (
        <>
          {/* 変更範囲 */}
          {scopes.map((s) => (
            <Chip key={`sc-${s}`} color="scope" label={SCOPE_SHORT[s]} onRemove={() => onScopeRemove(s)} />
          ))}
          {/* 世界観 */}
          {activeWorldPresets.map((w) => (
            <Chip key={`w-${w}`} color="world" label={WORLD_LABEL[w]} onRemove={() => onWorldRemove(w)} />
          ))}
          {/* 演出 */}
          {activeEffectTypes.map((e) => (
            <Chip key={`e-${e}`} color="effect" label={EFFECT_LABEL[e] ?? e} onRemove={() => onEffectRemove(e)} />
          ))}
          {/* 神引き（まとめて解除） */}
          {godChips.map((label, i) => (
            <Chip key={`g-${i}`} color="god" label={label} onRemove={onGodReset} />
          ))}
          {/* 神引き補助 */}
          {activeBoosts.map((b) => (
            <Chip key={`b-${b}`} color="boost" label={BOOST_LABEL[b] ?? b} onRemove={() => onBoostRemove(b)} />
          ))}
          {/* バズり */}
          {viralMode && <Chip color="viral" label="🔥 バズり" onRemove={onViralRemove} />}
          {/* SNS / カルチャー（まとめて解除） */}
          {activeSnsLabels.map((l, i) => (
            <Chip key={`s-${i}`} color="sns" label={`📈 ${l}`} onRemove={onAssistReset} />
          ))}
          {activeCultureLabels.map((l, i) => (
            <Chip key={`c-${i}`} color="culture" label={`🌐 ${l}`} onRemove={onAssistReset} />
          ))}
          {/* 👗 ZOZO 反映中（実効反映時のみ・優先は金色強調） */}
          {zozoActive && (
            <Chip
              color={zozoEffective === "priority" ? "zozoPriority" : "zozo"}
              label={
                zozoEffective === "priority"
                  ? `⭐ 👗 ZOZO 優先${zozoAgeLabel ? `（${zozoAgeLabel}）` : ""}`
                  : `✅ 👗 ZOZO 反映中${zozoAgeLabel ? `（${zozoAgeLabel}）` : ""}`
              }
              onRemove={onZozoRemove}
            />
          )}
        </>
      )}

      {/* リセット（右端固定・2種類） */}
      {count > 0 && (
        <span className="ml-auto shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onScopesReset}
            title="「変更するもの」（変更範囲）だけを解除する"
            className="px-2.5 py-0.5 rounded border border-violet-400/30 bg-violet-400/8 text-violet-200/80 text-[12px] font-semibold hover:bg-violet-400/18 hover:border-violet-400/55 transition leading-snug"
          >
            ↺ 変更だけ
          </button>
          <button
            type="button"
            onClick={onResetAll}
            title="変更範囲・生成ブースト・お気に入り傾向・ZOZOをすべて解除（守るものは維持）"
            className="px-2.5 py-0.5 rounded border border-rose-400/30 bg-rose-400/8 text-rose-200/85 text-[12px] font-semibold hover:bg-rose-500/18 hover:border-rose-500/55 hover:text-rose-200 transition leading-snug"
          >
            ↺ 全リセット
          </button>
        </span>
      )}
    </div>
  );
}
