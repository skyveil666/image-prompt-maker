/**
 * QuickActions — クイック操作バー（カテゴリ別5行レイアウト）
 *
 * ┌─ 世界観 ──────────────────────────────────────────────────────────────────┐
 * │ 👗Y2K  🚀Y3K  🏙街  🎬映画  🌸和風  🖤ゴシック  📢広告  ✨幻想  📺レトロ │
 * ├─ 演出 ────────────────────────────────────────────────────────────────────┤
 * │ 🌀前景盛り  🧬微機械化  🧊清潔感                                         │
 * ├─ 神引き ───────────────────────────────────────────────────────────────────┤
 * │ 👑ノーマル 🎲カオス 🧥衣装 🌍背景 📷構図 🎨色 🌌世界観 [▼ もっと]        │
 * ├─ 生成補助 ────────────────────────────────────────────────────────────────┤
 * │ 🔥バズり  🧪量産回避  🎭ギャップ化  🎲おまかせ  🔄別案  📈SNSバズ  🌐カルチャー │
 * ├─ ツール ──────────────────────────────────────────────────────────────────┤
 * │ 🚫量産AI検知  ⭐お気に入り  📅履歴  ↩戻る                                │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

import { useState } from "react";
import type { ReactNode } from "react";
import type { SnsType, CultureType, WorldPreset, EffectPreset } from "../lib/quickActions";

export type { SnsType, CultureType, WorldPreset, EffectPreset };

/** 旧型名エイリアス（外部コードとの互換性維持） */
export type FashionPreset = WorldPreset;

// ── Props ──────────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  viralMode:          boolean;
  canVariant:         boolean;
  canUndo:            boolean;
  favPanelOpen:       boolean;
  disabled?:          boolean;
  chaosLabel?:        string | null;
  activeWorldPresets?: WorldPreset[];
  activeEffectTypes?:  EffectPreset[];
  // 生成ロジック補助
  onViral:            () => void;
  onViralOff:         () => void;
  onRandom:           () => void;
  onVariant:          () => void;
  onUndo:             () => void;
  onSnsSingle:        () => void;
  onCultureSingle:    () => void;
  onMassProductionCheck: () => void;
  // 世界観・演出・神引き・生成補助 トグル（マルチセレクト）
  onWorldPresetToggle: (preset: WorldPreset) => void;
  onEffectToggle:      (effect: EffectPreset) => void;
  onGodToggle:         (mode: string) => void;
  onAssistToggle:      (mode: "gap" | "anti") => void;
  /** 神引き補助モディファイア（被り回避・別世界・バズ寄せ・顔映え）トグル */
  onBoostToggle?:      (id: string) => void;
  // アクティブ状態（ボタン active 表示用）
  activeGodModes?:      string[];
  activeBoosts?:        string[];
  activeAssistModes?:   string[];
  activeSnsLabels?:     string[];
  activeCultureLabels?: string[];
  // リセット
  onResetAll: () => void;
  // ツール
  onToggleFavPanel:   () => void;
  onShowCalendar:     () => void;
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

type BtnVariant =
  | "rose" | "violet" | "cyan" | "amber" | "sky" | "gold"
  | "pink" | "indigo" | "stone" | "teal" | "default"
  | "jirai" | "seikimatsu";

function TagBtn({
  label,
  title,
  onClick,
  disabled,
  active,
  variant = "default",
}: {
  label:     string;
  title?:    string;
  onClick:   () => void;
  disabled?: boolean;
  active?:   boolean;
  variant?:  BtnVariant;
}) {
  const base =
    "rounded-lg px-3 py-1.5 text-[13px] font-semibold border transition leading-none whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed";

  const styles: Record<BtnVariant, string> = {
    rose: active
      ? "border-rose-500/70 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-[0_0_14px_rgba(244,63,94,0.4)]"
      : "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:border-rose-500/70",
    violet: active
      ? "border-violet-400/80 bg-violet-400/20 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
      : "border-violet-400/50 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 hover:border-violet-400/80",
    cyan: active
      ? "border-cyan-400/80 bg-cyan-400/20 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
      : "border-cyan-400/50 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 hover:border-cyan-400/80",
    amber: active
      ? "border-amber-400/80 bg-amber-400/20 text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
      : "border-amber-400/40 bg-amber-400/8 text-amber-200 hover:bg-amber-400/15 hover:border-amber-400/70",
    sky: active
      ? "border-sky-400/80 bg-sky-400/20 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
      : "border-sky-400/50 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20 hover:border-sky-400/80",
    gold: active
      ? "border-amber-400/90 bg-gradient-to-r from-amber-500/30 to-yellow-500/25 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.35)]"
      : "border-amber-400/60 bg-gradient-to-r from-amber-500/20 to-yellow-500/15 text-amber-100 hover:from-amber-500/30 hover:to-yellow-500/25 hover:border-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.2)]",
    pink: active
      ? "border-pink-400/80 bg-pink-400/20 text-pink-100 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
      : "border-pink-400/35 bg-pink-400/8 text-pink-200 hover:bg-pink-400/15 hover:border-pink-400/70",
    indigo: active
      ? "border-indigo-400/80 bg-indigo-400/20 text-indigo-100 shadow-[0_0_10px_rgba(129,140,248,0.3)]"
      : "border-indigo-400/35 bg-indigo-400/8 text-indigo-200 hover:bg-indigo-400/15 hover:border-indigo-400/70",
    stone: active
      ? "border-orange-500/70 bg-orange-500/15 text-orange-200 shadow-[0_0_8px_rgba(249,115,22,0.25)]"
      : "border-[#3a3f52] bg-[#0f1015] text-text-muted hover:text-orange-200 hover:border-orange-500/40",
    teal: active
      ? "border-teal-400/80 bg-teal-400/20 text-teal-100 shadow-[0_0_10px_rgba(45,212,191,0.3)]"
      : "border-teal-400/40 bg-teal-400/8 text-teal-200 hover:bg-teal-400/15 hover:border-teal-400/70",
    default: active
      ? "border-accent/50 bg-accent/10 text-text-base shadow-[0_0_8px_rgba(124,92,255,0.2)]"
      : "border-bg-border bg-bg-panel/70 text-text-muted hover:text-text-base hover:border-accent/50",
    jirai: active
      ? "border-fuchsia-500/70 bg-gradient-to-r from-fuchsia-600/20 to-pink-600/15 text-pink-200 shadow-[0_0_10px_rgba(217,70,239,0.3)]"
      : "border-fuchsia-600/35 bg-black/50 text-fuchsia-300/75 hover:bg-fuchsia-600/10 hover:border-fuchsia-500/65 hover:text-pink-200",
    seikimatsu: active
      ? "border-orange-600/70 bg-orange-700/15 text-orange-300 shadow-[0_0_10px_rgba(194,65,12,0.3)]"
      : "border-orange-700/35 bg-black/50 text-orange-500/70 hover:bg-orange-700/10 hover:border-orange-600/60 hover:text-orange-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[base, styles[variant]].join(" ")}
    >
      {label}
    </button>
  );
}

function CategoryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className="pt-[5px] text-[13px] font-bold uppercase tracking-widest text-white/90 whitespace-nowrap w-12 text-right shrink-0 leading-none">
        {label}
      </div>
      <div className="w-px min-h-[20px] self-stretch bg-white/8 shrink-0" />
      <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────────────────

export function QuickActions({
  viralMode,
  canVariant,
  canUndo,
  favPanelOpen,
  disabled,
  chaosLabel,
  activeWorldPresets  = [],
  activeEffectTypes   = [],
  activeGodModes      = [],
  activeBoosts        = [],
  activeAssistModes   = [],
  activeSnsLabels     = [],
  activeCultureLabels = [],
  onViral, onViralOff,
  onRandom, onVariant, onUndo,
  onSnsSingle, onCultureSingle,
  onMassProductionCheck,
  onWorldPresetToggle, onEffectToggle,
  onGodToggle, onAssistToggle, onBoostToggle,
  onResetAll,
  onToggleFavPanel, onShowCalendar,
}: QuickActionsProps) {
  const [godMore, setGodMore] = useState(false);

  return (
    <div className="card !py-3 !px-4 space-y-2.5">

      {/* ══════ 世界観 / ジャンル ══════ */}
      <CategoryRow label="世界観">
        <TagBtn label="👗 Y2K"       title="2000年代ファッション：ポップ・メタリック・ラインストーン（最大3選択）"                                    onClick={() => onWorldPresetToggle("y2k")}        active={activeWorldPresets.includes("y2k")}        variant="pink"       disabled={disabled} />
        <TagBtn label="🚀 Y3K"       title="近未来ハイファッション：透明素材・シルバー・sci-fi感（最大3選択）"                                         onClick={() => onWorldPresetToggle("y3k")}        active={activeWorldPresets.includes("y3k")}        variant="indigo"     disabled={disabled} />
        <TagBtn label="🏙️ ストリート" title="都会・アーバン・ファッション誌風（最大3選択）"                                                              onClick={() => onWorldPresetToggle("street")}     active={activeWorldPresets.includes("street")}     variant="stone"      disabled={disabled} />
        <TagBtn label="🎬 映画"      title="映画ポスター風。SF・ノワール・アート映画などジャンルを毎回変化させる（最大3選択）"                           onClick={() => onWorldPresetToggle("cinema")}     active={activeWorldPresets.includes("cinema")}     variant="violet"     disabled={disabled} />
        <TagBtn label="🌸 和風"      title="和のテイストを軸にした多彩な世界観。京都・桜・竹林・和ゴシック等（最大3選択）"                              onClick={() => onWorldPresetToggle("wafuu")}      active={activeWorldPresets.includes("wafuu")}      variant="amber"      disabled={disabled} />
        <TagBtn label="🖤 ゴシック"  title="ダーク・退廃美・建築的ゴシック。図書館・廃墟・美術館等（最大3選択）"                                        onClick={() => onWorldPresetToggle("gothic")}     active={activeWorldPresets.includes("gothic")}     variant="stone"      disabled={disabled} />
        <TagBtn label="📢 広告"      title="ハイエンド広告・ファッション誌・ブランドビジュアル風（最大3選択）"                                           onClick={() => onWorldPresetToggle("ad")}         active={activeWorldPresets.includes("ad")}         variant="sky"        disabled={disabled} />
        <TagBtn label="✨ 幻想"      title="神秘的・夢幻的な幻想世界観。光の森・月夜・花の嵐等（最大3選択・量産ファンタジードレス禁止）"                 onClick={() => onWorldPresetToggle("fantasy")}   active={activeWorldPresets.includes("fantasy")}   variant="teal"       disabled={disabled} />
        <TagBtn label="📺 レトロ"    title="昭和・フィルム・80年代ポップ・ヴィンテージの世界観（最大3選択）"                                             onClick={() => onWorldPresetToggle("retro")}      active={activeWorldPresets.includes("retro")}      variant="gold"       disabled={disabled} />
        <TagBtn label="🖤 地雷系"   title="かわいい×ダークの病みかわいい世界観。黒/白/ピンク/赤系・リボン・厚底（最大3選択）"                            onClick={() => onWorldPresetToggle("jirai")}      active={activeWorldPresets.includes("jirai")}      variant="jirai"      disabled={disabled} />
        <TagBtn label="☠️ 世紀末系" title="荒廃都市・廃墟・錆・砂埃・終末ロードムービー感（最大3選択）"                                                  onClick={() => onWorldPresetToggle("seikimatsu")} active={activeWorldPresets.includes("seikimatsu")} variant="seikimatsu" disabled={disabled} />
        {activeWorldPresets.length > 1 && (
          <span className="text-[11px] text-indigo-300/70 font-semibold self-center ml-1">
            {activeWorldPresets.length}選択中
          </span>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ 演出 / 効果 ══════ */}
      <CategoryRow label="演出">
        <TagBtn label="🌀 前景盛り" title="人物の前面に演出を追加。花びら・光・蝶・ガラス片・霧など毎回ランダムに選ぶ（最大2選択）"      onClick={() => onEffectToggle("fgrich")}     disabled={disabled} variant="cyan"   active={activeEffectTypes.includes("fgrich")} />
        <TagBtn label="🧬 微機械化" title="ガチサイボーグ禁止。目元・頬・首元など一部にだけ上品な未来感アクセサリーを追加（最大2選択）"   onClick={() => onEffectToggle("microcyber")} disabled={disabled} variant="indigo" active={activeEffectTypes.includes("microcyber")} />
        <TagBtn label="🧊 清潔感"   title="上品でクリーン。白・シルバー・透明感・高級広告・Appleっぽい仕上がり（最大2選択）"             onClick={() => onEffectToggle("clean")}      disabled={disabled} variant="sky"    active={activeEffectTypes.includes("clean")} />
        {activeEffectTypes.length > 1 && (
          <span className="text-[11px] text-cyan-300/70 font-semibold self-center ml-1">
            {activeEffectTypes.length}選択中
          </span>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ 👑 神引きシリーズ ══════ */}
      <CategoryRow label="神引き">
        <TagBtn label="👑 ノーマル"     title="全スコープON・最大インパクトで設定を適用（設定のみ）"                                                                       onClick={() => onGodToggle("normal")}      disabled={disabled} variant="gold" active={activeGodModes.includes("normal")} />
        <TagBtn label={chaosLabel ? `🎲 ${chaosLabel}` : "🎲 カオス"} title="普段あり得ない世界観を3〜4軸強制融合。毎回前例のない組み合わせを生成（AIテンプレ完全禁止）" onClick={() => onGodToggle("chaos")}       disabled={disabled} variant="gold" active={activeGodModes.includes("chaos")} />
        <TagBtn label="🧥 衣装"         title="衣装スコープのみ変更。顔・背景・ポーズ・カメラは完全固定。毎回異なる高品質な衣装を選ぶ（最大2コンボ）"                  onClick={() => onGodToggle("outfit")}      disabled={disabled} variant="gold" active={activeGodModes.includes("outfit")} />
        <TagBtn label="🌍 背景"         title="人物固定。温室・美術館・地下図書館など珍しい背景を毎回ランダムに選ぶ（最大2コンボ）"                                     onClick={() => onGodToggle("bg")}          disabled={disabled} variant="gold" active={activeGodModes.includes("bg")} />
        <TagBtn label="📷 構図"         title="カメラ視点・フレーミングをランダムに強変更。超寄り・魚眼・ドローン・肩越しなど毎回異なる特殊構図を選ぶ。顔固定"           onClick={() => onGodToggle("composition")} disabled={disabled} variant="gold" active={activeGodModes.includes("composition")} />
        <TagBtn label="🎨 色"           title="色彩・パレット主導の画面設計。8種の色方向（モノクローム・ジュエル・パステル・ゴールド等）から毎回異なる配色を選ぶ（最大2コンボ）" onClick={() => onGodToggle("color")}  disabled={disabled} variant="gold" active={activeGodModes.includes("color")} />
        <TagBtn label="🌌 世界観"       title="異世界・異空間の世界観を全力で引く。宇宙神社・水没図書館・鏡の宮殿など8方向から毎回異なる空間を選ぶ（最大2コンボ）"   onClick={() => onGodToggle("world_god")}   disabled={disabled} variant="gold" active={activeGodModes.includes("world_god")} />

        {/* ── 補助モディファイア（複数選択可・固定ルールは常に優先）── */}
        <div className="w-px self-stretch bg-white/8 mx-0.5 shrink-0" />
        <TagBtn label="🔁 被り回避" title="直近の生成と似た背景・衣装・色・前景・カメラ・世界観を避ける。ネオン/サイバー/黒衣装/剣/花びら/廃墟/屋上などの連続使用を回避（複数選択可）" onClick={() => onBoostToggle?.("avoid_overlap")} disabled={disabled} variant="sky" active={activeBoosts.includes("avoid_overlap")} />
        <TagBtn label="🎲 別世界"   title="顔・同一性は維持したまま、変更対象の軸を前回と全く違う世界観へ大胆に変化（1つの完成された世界観としてまとめる・複数選択可）"        onClick={() => onBoostToggle?.("other_world")}  disabled={disabled} variant="sky" active={activeBoosts.includes("other_world")} />
        <TagBtn label="🧲 バズ寄せ" title="SNS映えする構図・色・前景に寄せる。明暗差・顔周りの視線誘導・印象的な背景・強い一要素（ネオン偏りは回避・複数選択可）"            onClick={() => onBoostToggle?.("buzz")}         disabled={disabled} variant="sky" active={activeBoosts.includes("buzz")} />
        <TagBtn label="🎯 顔映え"   title="顔は絶対に変更しない。光・構図・背景・前景を最適化して顔を引き立てる（リムライト/キャッチライト/視線誘導・複数選択可）"          onClick={() => onBoostToggle?.("face_pop")}     disabled={disabled} variant="sky" active={activeBoosts.includes("face_pop")} />
        {activeBoosts.length > 0 && (
          <span className="text-[11px] text-sky-300/70 font-semibold self-center ml-0.5">
            {activeBoosts.length}選択中
          </span>
        )}

        {/* もっとトグル */}
        <button
          type="button"
          onClick={() => setGodMore((v) => !v)}
          disabled={disabled}
          className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold border border-amber-400/25 bg-transparent text-amber-300/50 hover:text-amber-200 hover:border-amber-400/55 disabled:opacity-40 disabled:cursor-not-allowed transition leading-none whitespace-nowrap"
        >
          {godMore ? "▲ 閉じる" : "▼ もっと"}
        </button>
        {activeGodModes.filter((m) => !["normal", "chaos", "composition"].includes(m)).length > 1 && (
          <span className="text-[11px] text-amber-300/70 font-semibold self-center ml-1">
            {activeGodModes.filter((m) => !["normal", "chaos", "composition"].includes(m)).length}選択中
          </span>
        )}
        {godMore && (
          <>
            <TagBtn label="🎁 小物"         title="アイテム主導の映え設計。光る蝶・王冠・ガラスの剣・花冠など10種から選び、文脈・ムードまで一緒に設計する（最大2コンボ）"  onClick={() => onGodToggle("props")}     disabled={disabled} variant="gold" active={activeGodModes.includes("props")} />
            <TagBtn label="🏛️ 大物"        title="場を支配する大きな物体主導の画面設計。巨大クリスタル・古代石像・花のインスタレーションなど8種から選ぶ（最大2コンボ）"   onClick={() => onGodToggle("bigobject")} disabled={disabled} variant="gold" active={activeGodModes.includes("bigobject")} />
            <TagBtn label="🐉 神話"         title="神話・伝説・幻獣を使った世界観構築。白龍・鳳凰・天使・白狐など8種から選び、神話的な荘厳さを演出する（最大2コンボ）"    onClick={() => onGodToggle("myth")}      disabled={disabled} variant="gold" active={activeGodModes.includes("myth")} />
            <TagBtn label="🎬 映画神引き"   title="映画ジャンル特化の画面設計。ノワール・SF叙事詩・ゴシックホラー・黒澤風など8方向から毎回異なる映画美学を選ぶ（最大2コンボ）" onClick={() => onGodToggle("movie")}  disabled={disabled} variant="gold" active={activeGodModes.includes("movie")} />
          </>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ 生成補助 ══════ */}
      <CategoryRow label="生成補助">
        <TagBtn label={viralMode ? "🔥 バズりON" : "🔥 バズり"} title={viralMode ? "一発バズりモードをOFF（設定は維持）" : "SNS映えスタイルに補正モードをON（設定のみ）"} onClick={viralMode ? onViralOff : onViral} active={viralMode} variant="rose" disabled={disabled} />
        <TagBtn label="🧪 量産回避"  title="黒バラ・ステンドグラス・白ワンピ・ネオン刀などのAIテンプレを避け、珍しい場所・意外な色・映画的構図を優先（ギャップ化と同時選択可）" onClick={() => onAssistToggle("anti")} disabled={disabled} variant="amber" active={activeAssistModes.includes("anti")} />
        <TagBtn label="🎭 ギャップ化" title="現在の雰囲気と逆方向へ振る。かわいい→ダーク、ストリート→高級など「映えるギャップ」を毎回ランダムに選ぶ（量産回避と同時選択可）" onClick={() => onAssistToggle("gap")} disabled={disabled} variant="rose" active={activeAssistModes.includes("gap")} />
        {activeAssistModes.length > 1 && (
          <span className="text-[11px] text-orange-300/70 font-semibold self-center">2コンボ</span>
        )}
        <TagBtn label="🎲 おまかせ"  title="変更範囲・雰囲気・案数をすべてランダムに決めて設定適用"                                                     onClick={onRandom}        disabled={disabled} variant="default" />
        <TagBtn label="🔄 別案"      title="現在の画像と設定を保持したまま雰囲気をひと揺らしして再生成"                                                onClick={onVariant}       disabled={disabled || !canVariant} variant="cyan" />
        <TagBtn label="📈 SNSバズ"   title="SNS向けビジュアル補正をランダム追加（最大2コンボ。詳細設定の「SNS」タブでも選択可）"                       onClick={onSnsSingle}     disabled={disabled} variant="rose"    active={activeSnsLabels.length > 0} />
        {activeSnsLabels.length > 1 && (
          <span className="text-[11px] text-rose-300/70 font-semibold self-center">{activeSnsLabels.length}コンボ</span>
        )}
        <TagBtn label="🌐 カルチャー" title="都市・文化圏の世界観をランダム追加（最大2コンボ。詳細設定の「カルチャー」タブでも選択可）"                 onClick={onCultureSingle} disabled={disabled} variant="teal"   active={activeCultureLabels.length > 0} />
        {activeCultureLabels.length > 1 && (
          <span className="text-[11px] text-teal-300/70 font-semibold self-center">{activeCultureLabels.length}コンボ</span>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ ツール ══════ */}
      <CategoryRow label="ツール">
        <TagBtn label="🚫 量産AI検知" title="生成済みプロンプトを解析して量産AIパターンを検出。高リスクなら自動で新構成へ変換" onClick={onMassProductionCheck} variant="rose"    />
        <TagBtn label="⭐ お気に入り" title="お気に入り登録したプロンプトを右パネルで表示"                                    onClick={onToggleFavPanel}      variant="amber"  active={favPanelOpen} />
        <TagBtn label="📅 履歴"       title="月ごとのカレンダーで履歴を確認"                                                onClick={onShowCalendar}        variant="sky"    />
        <TagBtn label="↩ 戻る"        title={canUndo ? "1つ前の生成結果に戻す" : "戻れる履歴がありません"}                  onClick={onUndo}                variant="default" disabled={disabled || !canUndo} />
        <div className="w-px self-stretch bg-white/8 mx-0.5 shrink-0" />
        <TagBtn
          label="↺ 全リセット"
          title="適用した世界観・神引き・SNS・生成補助をリセット（変更範囲・顔固定は維持）"
          onClick={onResetAll}
          variant="default"
        />
      </CategoryRow>

    </div>
  );
}
