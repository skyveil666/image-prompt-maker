/**
 * QuickActions — クイック操作バー（カテゴリ別レイアウト）
 *
 * ┌─ 世界観 ──────────────────────────────────────────────────────────────────┐
 * │ 👗Y2K  🚀Y3K  🏙街  🎬映画  🌸和風  🖤ゴシック  📢広告  ✨幻想  📺レトロ │
 * ├─ 演出 ────────────────────────────────────────────────────────────────────┤
 * │ 🌀前景盛り  🧬微機械化  🧊清潔感                                         │
 * ├─ 映え ────────────────────────────────────────────────────────────────────┤
 * │ 🔥バズ最適化[▼バズモード/映え補正]   🎯顔映え                            │
 * ├─ 変化 ────────────────────────────────────────────────────────────────────┤
 * │ 👑神引き[▼おまかせ/カオス/大きく変える/軸別]   🔄別案                     │
 * ├─ 回避 ────────────────────────────────────────────────────────────────────┤
 * │ 🛡テンプレ回避[▼テンプレ回避/被り回避/AIっぽさチェック]                  │
 * ├─ ツール ──────────────────────────────────────────────────────────────────┤
 * │ ⭐お気に入り  📅履歴  ↩戻る  ↺プリセット解除                            │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 注: 📈SNSバズ / 🌐カルチャー は詳細設定(DetailsCard)の SNS / カルチャー タブ内
 *     「おまかせ」ボタンへ移設済み（1b）。内部関数名・フラグ・生成ロジックは不変。
 */

import { useState } from "react";
import type { ReactNode } from "react";
import type { SnsType, CultureType, WorldPreset, EffectPreset } from "../lib/quickActions";

export type { SnsType, CultureType, WorldPreset, EffectPreset };

/** 旧型名エイリアス（外部コードとの互換性維持） */
export type FashionPreset = WorldPreset;

/** 神引きモードの短い表示ラベル（アクティブチップ用） */
const GOD_DISPLAY: Record<string, string> = {
  normal: "👑 強力おまかせ", chaos: "🎲 ぶっ飛び融合", outfit: "🧥 衣装", bg: "🌍 背景",
  composition: "📷 構図", color: "🎨 色", world_god: "🌌 異世界ガチャ",
  props: "🎁 小物", bigobject: "🏛️ 大物", myth: "🐉 神話", movie: "🎬 映画",
};

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
  /** 🔎 AIっぽさ確認：分析センターを開く誘導（生成画面では分析実行しない） */
  onOpenAnalysisCenter: () => void;
  // 世界観・演出・神引き・生成補助 トグル（マルチセレクト）
  onWorldPresetToggle: (preset: WorldPreset) => void;
  onEffectToggle:      (effect: EffectPreset) => void;
  onGodToggle:         (mode: string) => void;
  // "anti"（量産回避）は撤去済み — avoidCliche に統合された
  onAssistToggle:      (mode: "gap") => void;
  /** 神引き補助モディファイア（被り回避・別世界・バズ寄せ・顔映え）トグル */
  onBoostToggle?:      (id: string) => void;
  /** 量産回避（avoidCliche・サーバ側 cliche 回避ブロック。既定ON） */
  avoidCliche?:        boolean;
  onAvoidClicheChange?: (v: boolean) => void;
  /** 🌆 リアル背景回避（既定ON）。背景が変更対象の時だけサーバ側で実写背景を強め抑制（表示トグル） */
  avoidRealBackground?: boolean;
  onAvoidRealBackgroundChange?: (v: boolean) => void;
  // アクティブ状態（ボタン active 表示用）
  activeGodModes?:      string[];
  activeBoosts?:        string[];
  activeAssistModes?:   string[];
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
  onViral, onViralOff,
  onRandom, onVariant, onUndo,
  onOpenAnalysisCenter,
  onWorldPresetToggle, onEffectToggle,
  onGodToggle, onAssistToggle, onBoostToggle,
  avoidCliche = true, onAvoidClicheChange,
  avoidRealBackground = true, onAvoidRealBackgroundChange,
  onResetAll,
  onToggleFavPanel, onShowCalendar,
}: QuickActionsProps) {
  // 映え／変化／回避 はそれぞれ展開パネル（ポップオーバー）に統合（種類が多く常時展開すると煩雑なため）
  const [godOpen, setGodOpen] = useState(false);
  const [buzzOpen, setBuzzOpen] = useState(false);
  const [avoidOpen, setAvoidOpen] = useState(false);
  const activeGodChips = activeGodModes.map((m) =>
    m === "chaos" && chaosLabel ? `🎲 ${chaosLabel}` : (GOD_DISPLAY[m] ?? m)
  );
  // 「変化」グループのアクティブ表示（神引きモード＋雰囲気を逆に＋世界観を一新）
  const changeChips: string[] = [
    ...activeGodChips,
    activeAssistModes.includes("gap") ? "🎭 逆に" : null,
    activeBoosts.includes("other_world") ? "🌀 世界観を一新" : null,
  ].filter((x): x is string => x !== null);

  return (
    <div className="card !py-3 !px-4 space-y-2.5">

      {/* ══════ 世界観 / ジャンル ══════ */}
      <CategoryRow label="世界観">
        <span className="w-full text-[10px] text-text-muted/55 leading-snug mb-0.5">最初の方向性（既成ジャンル）を選ぶ</span>
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
        <span className="w-full text-[10px] text-text-muted/55 leading-snug mb-0.5">作品の雰囲気を足す演出補助（変更対象ではなく、前景/メカ/質感を自動セット）</span>
        <TagBtn label="🌀 前景盛り" title="人物の前面に演出を追加。花びら・光・蝶・ガラス片・霧など毎回ランダムに選ぶ（最大2選択）"      onClick={() => onEffectToggle("fgrich")}     disabled={disabled} variant="cyan"   active={activeEffectTypes.includes("fgrich")} />
        <TagBtn label="🧬 うっすらメカ" title="ガチサイボーグ禁止。目元・頬・首元など一部にだけ上品な未来感アクセサリーを追加（最大2選択）"   onClick={() => onEffectToggle("microcyber")} disabled={disabled} variant="indigo" active={activeEffectTypes.includes("microcyber")} />
        <TagBtn label="🧊 清潔感"   title="上品でクリーン。白・シルバー・透明感・高級広告・Appleっぽい仕上がり（最大2選択）"             onClick={() => onEffectToggle("clean")}      disabled={disabled} variant="sky"    active={activeEffectTypes.includes("clean")} />
        {activeEffectTypes.length > 1 && (
          <span className="text-[11px] text-cyan-300/70 font-semibold self-center ml-1">
            {activeEffectTypes.length}選択中
          </span>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ 映え ══════ */}
      <CategoryRow label="映え">
        <span className="w-full text-[10px] text-text-muted/55 leading-snug mb-0.5">SNS映え・見栄えの補正（中身は変えない。中身を変えるのは「神引き」）</span>
        {/* 🔥 バズ最適化（▼で「バズモード」「映え補正」を格納。旧 🔥バズり＋🧲バズ寄せ を統合表示） */}
        <button
          type="button"
          onClick={() => setBuzzOpen((v) => !v)}
          disabled={disabled}
          title="SNS映え方向への補正をまとめた設定。クリックで展開（バズモード／映え補正）"
          className={[
            "rounded-lg px-3 py-1.5 text-[13px] font-semibold border leading-none whitespace-nowrap transition",
            (viralMode || activeBoosts.includes("buzz"))
              ? "border-rose-500/70 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-[0_0_14px_rgba(244,63,94,0.4)]"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:border-rose-500/70",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          🔥 バズ最適化 {buzzOpen ? "▲" : "▼"}
        </button>
        <TagBtn label="🎯 顔映え"   title="顔は絶対に変更しない。光・構図・背景・前景を最適化して顔を引き立てる（複数選択可）"                  onClick={() => onBoostToggle?.("face_pop")} disabled={disabled} variant="rose" active={activeBoosts.includes("face_pop")} />
        {/* 展開：バズモード（旧バズり）＋映え補正（旧バズ寄せ） */}
        {buzzOpen && (
          <div className="w-full mt-1.5 p-2 rounded-lg border border-rose-500/20 bg-rose-500/5 flex flex-wrap gap-1.5">
            <span className="w-full text-[10px] text-rose-300/60 leading-none mb-0.5">
              ※ SNSで映える方向へ寄せる補正です。
            </span>
            <TagBtn label={viralMode ? "🔥 バズモード ON" : "🔥 バズモード"} title={viralMode ? "一発バズりモードをOFF（設定は維持）" : "SNS映えスタイルに補正モードをON（設定のみ）"} onClick={viralMode ? onViralOff : onViral} active={viralMode} variant="rose" disabled={disabled} />
            <TagBtn label="🧲 映え補正（構図・色・前景）" title="SNS映えする構図・色・前景に寄せる。明暗差・顔周りの視線誘導・印象的な背景・強い一要素（複数選択可）" onClick={() => onBoostToggle?.("buzz")} disabled={disabled} variant="rose" active={activeBoosts.includes("buzz")} />
          </div>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ 変化 ══════ */}
      <CategoryRow label="変化">
        <span className="w-full text-[10px] text-text-muted/55 leading-snug mb-0.5">ランダム性・大きな変化を足す（神引き＝おまかせの司令塔／別案＝近い再生成）</span>
        {/* 👑 神引き（▼で おまかせ・カオス・大きく変える・軸別 を格納） */}
        <button
          type="button"
          onClick={() => setGodOpen((v) => !v)}
          disabled={disabled}
          title="神引き＝変更対象と詳細を自動で埋める強力プリセット。おまかせ・大きく変えるもここに。クリックで展開"
          className={[
            "rounded-lg px-3 py-1.5 text-[12px] font-bold border leading-none whitespace-nowrap transition",
            changeChips.length > 0
              ? "border-amber-400/65 bg-amber-400/15 text-amber-100 shadow-[0_0_8px_-2px_rgba(251,191,36,0.5)]"
              : "border-amber-400/30 bg-transparent text-amber-300/70 hover:text-amber-200 hover:border-amber-400/55",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          👑 神引き {godOpen ? "▲" : "▼"}
        </button>
        {/* アクティブを チップ表示（閉じていても何が効いているか分かる） */}
        {changeChips.map((label, i) => (
          <span key={i} className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border border-amber-400/45 bg-amber-400/10 text-amber-100 leading-none">
            {label}
          </span>
        ))}
        <TagBtn label="🔄 別案"      title="現在の画像と設定を保持したまま雰囲気をひと揺らしして再生成"       onClick={onVariant} disabled={disabled || !canVariant} variant="cyan" />

        {/* 📈SNSバズ・🌐カルチャーは詳細設定(DetailsCard)のSNS/カルチャータブ内「おまかせ」へ移設済み（1b） */}

        {/* 展開：3小見出し（おまかせの強さ／大きく変える／軸別ガチャ）。handler・builder・flag・mode key は不変＝表示整理のみ */}
        {godOpen && (
          <div className="w-full mt-1.5 p-2 rounded-lg border border-amber-400/20 bg-amber-500/5 flex flex-wrap gap-1.5">
            <span className="w-full text-[10px] text-amber-300/60 leading-none mb-0.5">
              ※ 神引き＝おまかせの司令塔。下ほど大胆。押すと変更対象が自動でON（生成は別途「✨生成」）。
            </span>

            {/* ── おまかせの強さ（標準→強力→意外性） ── */}
            <span className="w-full text-[10px] font-bold text-amber-300/75 uppercase tracking-widest leading-none mt-0.5">おまかせの強さ</span>
            <div className="w-full flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <TagBtn label="🎲 おまかせ" title="変更範囲・雰囲気・案数をすべてランダムに決めて設定適用" onClick={onRandom} disabled={disabled} variant="default" />
                <span className="text-[10px] text-text-muted/70 leading-none">標準ランダム</span>
              </div>
              <div className="flex items-center gap-2">
                <TagBtn label="👑 強力おまかせ" title="全スコープON・最大インパクトで設定を適用（設定のみ）" onClick={() => onGodToggle("normal")} disabled={disabled} variant="gold" active={activeGodModes.includes("normal")} />
                <span className="text-[10px] text-text-muted/70 leading-none">全開ランダム＋映え強化</span>
              </div>
              <div className="flex items-center gap-2">
                <TagBtn label={chaosLabel ? `🎲 ${chaosLabel}` : "🎲 ぶっ飛び融合"} title="普段あり得ない世界観を3〜4軸強制融合。毎回前例のない組み合わせを生成" onClick={() => onGodToggle("chaos")} disabled={disabled} variant="gold" active={activeGodModes.includes("chaos")} />
                <span className="text-[10px] text-text-muted/70 leading-none">異世界を混ぜる・意外性MAX</span>
              </div>
            </div>

            {/* ── 大きく変える（方向転換の修飾） ── */}
            <span className="w-full text-[10px] font-bold text-amber-300/75 uppercase tracking-widest leading-none mt-1 pt-1.5 border-t border-amber-400/10">大きく変える</span>
            <TagBtn label="🎭 雰囲気を逆に" title="現在の雰囲気と逆方向へ振る。かわいい→ダーク等の映えるギャップを毎回ランダム"                          onClick={() => onAssistToggle("gap")}         disabled={disabled} variant="amber" active={activeAssistModes.includes("gap")} />
            <TagBtn label="🌀 世界観を一新" title="顔・同一性は維持したまま、変更対象の軸を前回と全く違う世界観へ大胆に変化（複数選択可）。※軸別ガチャの「異世界ガチャ」とは別＝今の方向を別物へ振る修飾" onClick={() => onBoostToggle?.("other_world")} disabled={disabled} variant="amber" active={activeBoosts.includes("other_world")} />

            {/* ── 軸別ガチャ（その軸だけ引く） ── */}
            <span className="w-full text-[10px] font-bold text-amber-300/75 uppercase tracking-widest leading-none mt-1 pt-1.5 border-t border-amber-400/10">軸別ガチャ（1つの軸だけランダム強化・指定は詳細設定で）</span>
            <TagBtn label="🧥 衣装"       title="衣装スコープのみ変更。顔・背景・ポーズ・カメラは固定。毎回異なる高品質な衣装（最大2コンボ）"        onClick={() => onGodToggle("outfit")}      disabled={disabled} variant="gold" active={activeGodModes.includes("outfit")} />
            <TagBtn label="🌍 背景"       title="人物固定。温室・美術館・地下図書館など珍しい背景を毎回ランダム（最大2コンボ）"                       onClick={() => onGodToggle("bg")}          disabled={disabled} variant="gold" active={activeGodModes.includes("bg")} />
            <TagBtn label="📷 構図"       title="カメラ視点・フレーミングを強変更。超寄り・魚眼・ドローン・肩越しなど。顔固定"                       onClick={() => onGodToggle("composition")} disabled={disabled} variant="gold" active={activeGodModes.includes("composition")} />
            <TagBtn label="🎨 色"         title="色だけをランダム強化。色彩・パレット主導の画面設計。8種の色方向から毎回異なる配色（最大2コンボ）"                          onClick={() => onGodToggle("color")}       disabled={disabled} variant="gold" active={activeGodModes.includes("color")} />
            <TagBtn label="🌌 異世界ガチャ" title="異世界・異空間を全力で1つ引く。宇宙神社・水没図書館・鏡の宮殿など8方向（最大2コンボ）。※「世界観を一新」とは別＝単発の異空間ガチャ" onClick={() => onGodToggle("world_god")}   disabled={disabled} variant="gold" active={activeGodModes.includes("world_god")} />
            <TagBtn label="🎁 小物"       title="アイテム主導の映え設計。光る蝶・王冠・ガラスの剣・花冠など10種（最大2コンボ）"                       onClick={() => onGodToggle("props")}       disabled={disabled} variant="gold" active={activeGodModes.includes("props")} />
            <TagBtn label="🏛️ 大物"      title="場を支配する大きな物体主導。巨大クリスタル・古代石像・花のインスタレーションなど8種（最大2コンボ）"   onClick={() => onGodToggle("bigobject")}   disabled={disabled} variant="gold" active={activeGodModes.includes("bigobject")} />
            <TagBtn label="🐉 神話"       title="神話・伝説・幻獣を使った世界観構築。白龍・鳳凰・天使・白狐など8種（最大2コンボ）"                    onClick={() => onGodToggle("myth")}        disabled={disabled} variant="gold" active={activeGodModes.includes("myth")} />
            <TagBtn label="🎬 映画"       title="映画ジャンル特化の画面設計。ノワール・SF叙事詩・ゴシックホラー・黒澤風など8方向（最大2コンボ）"      onClick={() => onGodToggle("movie")}       disabled={disabled} variant="gold" active={activeGodModes.includes("movie")} />
          </div>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ 回避 ══════ */}
      <CategoryRow label="回避">
        {/* 🛡 テンプレ回避（▼で テンプレ回避・被り回避・AIっぽさチェック。旧🛡量産回避＝同一フラグを「テンプレ回避」に統一表示） */}
        <button
          type="button"
          onClick={() => setAvoidOpen((v) => !v)}
          disabled={disabled}
          title="AIっぽさ・直近との被りを避ける設定とチェック。クリックで展開"
          className={[
            "rounded-lg px-3 py-1.5 text-[13px] font-semibold border leading-none whitespace-nowrap transition",
            (avoidCliche || activeBoosts.includes("avoid_overlap"))
              ? "border-amber-400/80 bg-amber-400/20 text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
              : "border-amber-400/40 bg-amber-400/8 text-amber-200 hover:bg-amber-400/15 hover:border-amber-400/70",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          🛡 テンプレ回避 {avoidOpen ? "▲" : "▼"}
        </button>
        {avoidCliche && (
          <span className="text-[11px] text-amber-300/70 font-semibold self-center ml-0.5">既定ON</span>
        )}
        {/* 展開：テンプレ回避（旧量産回避）＋被り回避＋AIっぽさチェック（旧量産AI検知・解析のみ） */}
        {avoidOpen && (
          <div className="w-full mt-1.5 p-2 rounded-lg border border-amber-400/20 bg-amber-500/5 flex flex-wrap gap-1.5">
            <span className="w-full text-[10px] text-amber-300/60 leading-none mb-0.5">
              ※ AIっぽい量産パターンや直近との被りを避けます。「AIっぽさ確認」を押すと分析センターで確認できます（生成画面では分析実行しません）。
            </span>
            <TagBtn label={avoidCliche ? "🛡 テンプレ回避 ON" : "🛡 テンプレ回避"} title="黒バラ・ステンドグラス・白ワンピ・ネオン刀などのAIテンプレを避ける常時補正（既定ON・サーバ側で全案に効く）" onClick={() => onAvoidClicheChange?.(!avoidCliche)} disabled={disabled} variant="amber" active={avoidCliche} />
            <TagBtn label="🔁 被り回避"  title="直近の生成と似た背景・衣装・色・前景・カメラ・世界観を避ける（複数選択可）"                          onClick={() => onBoostToggle?.("avoid_overlap")} disabled={disabled} variant="amber" active={activeBoosts.includes("avoid_overlap")} />
            <TagBtn label="🔎 AIっぽさ確認" title="分析センターを開いて、AIっぽさ（量産パターン）・テンプレ回避を確認します（生成画面では分析を実行しません）" onClick={onOpenAnalysisCenter} disabled={disabled} variant="rose" />
            <TagBtn label={avoidRealBackground ? "🌆 リアル背景を避ける ON" : "🌆 リアル背景を避ける"} title="実写っぽい住宅街・普通の路地・生活感のある背景を避け、キャラに合う演出背景へ寄せる（背景を変更対象にした時だけ効く・既定ON）" onClick={() => onAvoidRealBackgroundChange?.(!avoidRealBackground)} disabled={disabled} variant="amber" active={avoidRealBackground} />
          </div>
        )}
      </CategoryRow>

      <div className="border-t border-white/5" />

      {/* ══════ ツール ══════ */}
      <CategoryRow label="ツール">
        <TagBtn label="⭐ お気に入り" title="お気に入り登録したプロンプトを右パネルで表示"                                    onClick={onToggleFavPanel}      variant="amber"  active={favPanelOpen} />
        <TagBtn label="📅 履歴"       title="月ごとのカレンダーで履歴を確認"                                                onClick={onShowCalendar}        variant="sky"    />
        <TagBtn label="↩ 戻る"        title={canUndo ? "1つ前の生成結果に戻す" : "戻れる履歴がありません"}                  onClick={onUndo}                variant="default" disabled={disabled || !canUndo} />
        <div className="w-px self-stretch bg-white/8 mx-0.5 shrink-0" />
        <TagBtn
          label="↺ プリセット解除"
          title="神引き・バズり・SNS・生成補助などのプリセットを解除（全リセットは「現在の反映状態」パネルから）"
          onClick={onResetAll}
          variant="default"
        />
      </CategoryRow>

    </div>
  );
}
