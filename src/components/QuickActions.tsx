/**
 * QuickActions — クイック操作バー（アクションバー + 世界観）
 *
 * ┌─ アクションバー ──────────────────────────────────────────────────────────┐
 * │ 🛡テンプレ回避[▼テンプレ回避/被り回避/背景2D化]              ↩戻る        │
 * ├─ 世界観 ──────────────────────────────────────────────────────────────────┤
 * │ 👗Y2K  🚀Y3K  🏙街  🎬映画  🌸和風  🖤ゴシック  📢広告  ✨幻想  📺レトロ │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 注: 📈SNSバズ / 🌐カルチャー は詳細設定(DetailsCard)の SNS / カルチャー タブ内
 *     「おまかせ」ボタンへ移設済み（1b）。↺全リセットは📡反映バー（RSB）に集約済み。
 */

import { useState } from "react";
import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import type { WorldPreset, BgPreset, ArtPreset } from "../lib/quickActions";
import type { ColorDominance } from "../lib/colorDominanceNote";
import { MyPresetsSection } from "./MyPresetsSection";
import { MY_PRESET_MAX } from "../lib/myPresets";
import type { MyPresetRecord } from "../lib/myPresets";

export type { WorldPreset, BgPreset, ArtPreset };

// ── Props ──────────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  canUndo:            boolean;
  disabled?:          boolean;
  activeWorldPresets?: WorldPreset[];
  onUndo:             () => void;
  // 世界観 トグル（通常クリック=単一選択・Shift+クリック=コンボ累積）
  onWorldPresetToggle: (preset: WorldPreset, additive?: boolean) => void;
  /** 🌌 斬新背景プリセット（背景版・最大3コンボ） */
  activeBgPresets?:    BgPreset[];
  onBgPresetToggle?:   (preset: BgPreset, additive?: boolean) => void;
  /** 🖌 画法世界プリセット（アナログな画法・質感の系統・最大3コンボ） */
  activeArtPresets?:   ArtPreset[];
  onArtPresetToggle?:  (preset: ArtPreset, additive?: boolean) => void;
  /** 🎨 配色の主従（衣装/背景どちらを主役にするか・単一選択・null=設定なし） */
  colorDominance?:        ColorDominance | null;
  onColorDominanceChange?: (v: ColorDominance | null) => void;
  /** 💾 マイプリセット（現在の全設定を名前付きで保存・再適用） */
  myPresets?:           MyPresetRecord[];
  /** 保存欄を開いた瞬間に入力欄へ流し込む自動生成名（「YYYY/MM/DD 設定ラベル」）。 */
  myPresetDefaultName?: string;
  onSaveMyPreset?:      (name: string) => void;
  onApplyMyPreset?:     (preset: MyPresetRecord) => void;
  onOverwriteMyPreset?: (id: string) => void;
  onDeleteMyPreset?:    (id: string) => void;
  /** 量産回避（avoidCliche・サーバ側 cliche 回避ブロック。既定ON） */
  avoidCliche?:        boolean;
  onAvoidClicheChange?: (v: boolean) => void;
  /** 🌆 リアル背景回避（既定ON）。背景が変更対象の時だけサーバ側で実写背景を強め抑制（表示トグル） */
  avoidRealBackground?: boolean;
  onAvoidRealBackgroundChange?: (v: boolean) => void;
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

type BtnVariant =
  | "violet" | "amber" | "sky" | "gold"
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
  onClick:   (e: ReactMouseEvent) => void;
  disabled?: boolean;
  active?:   boolean;
  variant?:  BtnVariant;
}) {
  const base =
    "rounded-lg px-3 py-1.5 text-[13px] font-semibold border transition leading-none whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed";

  const styles: Record<BtnVariant, string> = {
    violet: active
      ? "border-violet-400/80 bg-violet-400/20 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
      : "border-violet-400/50 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 hover:border-violet-400/80",
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
  canUndo,
  disabled,
  activeWorldPresets  = [],
  onUndo,
  onWorldPresetToggle,
  activeBgPresets     = [],
  onBgPresetToggle,
  activeArtPresets    = [],
  onArtPresetToggle,
  colorDominance = null, onColorDominanceChange,
  myPresets = [], myPresetDefaultName = "", onSaveMyPreset, onApplyMyPreset, onOverwriteMyPreset, onDeleteMyPreset,
  avoidCliche = true, onAvoidClicheChange,
  avoidRealBackground = true, onAvoidRealBackgroundChange,
}: QuickActionsProps) {
  // 回避 は展開パネル（ポップオーバー）。変化（撤去済み）は展開不要。
  const [avoidOpen, setAvoidOpen] = useState(false);

  return (
    <div className="card !py-3 !px-4 space-y-2.5">

      {/* ── アクションバー：回避▼ + ↩戻る ──────────────────────────── */}
      {/* ┌ 🛡テンプレ回避[▼]  既定ON ─────────────────────── ↩戻る ┐ */}
      <div className="flex items-center flex-wrap gap-1.5">
        {/* 🛡 テンプレ回避 ▼（▼でテンプレ回避/被り回避/背景2D化） */}
        <button
          type="button"
          onClick={() => setAvoidOpen((v) => !v)}
          disabled={disabled}
          title="AIっぽさ・直近との被りを避ける設定とチェック。クリックで展開"
          className={[
            "rounded-lg px-3 py-1.5 text-[13px] font-semibold border leading-none whitespace-nowrap transition",
            avoidCliche
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
        <div className="ml-auto">
          <TagBtn label="↩ 戻る" title={canUndo ? "1つ前の生成結果に戻す" : "戻れる履歴がありません"} onClick={onUndo} variant="default" disabled={disabled || !canUndo} />
        </div>
      </div>
      {/* 展開：テンプレ回避（旧量産回避）＋被り回避＋AIっぽさチェック（旧量産AI検知・解析のみ） */}
      {avoidOpen && (
        <div className="w-full p-2 rounded-lg border border-amber-400/20 bg-amber-500/5 flex flex-wrap gap-1.5">
          <span className="w-full text-[10px] text-amber-300/60 leading-none mb-0.5">
            ※ AIっぽい量産パターンを避ける常時補正（既定ON・サーバ側で全案に効く）。AIっぽさの確認は左メニューの「分析センターで見る」から。
          </span>
          <TagBtn label={avoidCliche ? "🛡 テンプレ回避 ON" : "🛡 テンプレ回避"} title="黒バラ・ステンドグラス・白ワンピ・ネオン刀などのAIテンプレを避ける常時補正（既定ON・サーバ側で全案に効く）" onClick={() => onAvoidClicheChange?.(!avoidCliche)} disabled={disabled} variant="amber" active={avoidCliche} />
          <TagBtn label={avoidRealBackground ? "🌆 背景を2D/非写実に ON" : "🌆 背景を2D/非写実に"} title="背景の風景・空間だけを2D/イラスト調（アニメ背景・コンセプトアート・絵画調）に寄せる。人物・顔・肌は元画像の実写質感のまま固定。背景を変更対象にした時だけ効く・既定ON" onClick={() => onAvoidRealBackgroundChange?.(!avoidRealBackground)} disabled={disabled} variant="amber" active={avoidRealBackground} />
        </div>
      )}

      <div className="border-t border-white/5" />

      {/* ══════ 世界観 / ジャンル ══════ */}
      <CategoryRow label="世界観">
        <span className="w-full text-[10px] text-text-desc leading-snug mb-0.5">最初の方向性（既成ジャンル）を選ぶ（クリック=単独選択 / Shift+クリック=コンボ）</span>
        <TagBtn label="👗 Y2K"       title="2000年代ファッション：ポップ・メタリック・ラインストーン（クリック=単独選択 / Shift+クリック=コンボ）"                                    onClick={(e) => onWorldPresetToggle("y2k", e.shiftKey)}        active={activeWorldPresets.includes("y2k")}        variant="pink"       disabled={disabled} />
        <TagBtn label="🚀 Y3K"       title="近未来ハイファッション：透明素材・シルバー・sci-fi感（クリック=単独選択 / Shift+クリック=コンボ）"                                         onClick={(e) => onWorldPresetToggle("y3k", e.shiftKey)}        active={activeWorldPresets.includes("y3k")}        variant="indigo"     disabled={disabled} />
        <TagBtn label="🏙️ ストリート" title="都会・アーバン・ファッション誌風（クリック=単独選択 / Shift+クリック=コンボ）"                                                              onClick={(e) => onWorldPresetToggle("street", e.shiftKey)}     active={activeWorldPresets.includes("street")}     variant="stone"      disabled={disabled} />
        <TagBtn label="🎬 映画"      title="映画ポスター風。SF・ノワール・アート映画などジャンルを毎回変化させる（クリック=単独選択 / Shift+クリック=コンボ）"                           onClick={(e) => onWorldPresetToggle("cinema", e.shiftKey)}     active={activeWorldPresets.includes("cinema")}     variant="violet"     disabled={disabled} />
        <TagBtn label="🌸 和風"      title="和のテイストを軸にした多彩な世界観（クリック=単独選択 / Shift+クリック=コンボ）"                              onClick={(e) => onWorldPresetToggle("wafuu", e.shiftKey)}      active={activeWorldPresets.includes("wafuu")}      variant="amber"      disabled={disabled} />
        <TagBtn label="🖤 ゴシック"  title="ダーク・退廃美・建築的ゴシック（クリック=単独選択 / Shift+クリック=コンボ）"                                        onClick={(e) => onWorldPresetToggle("gothic", e.shiftKey)}     active={activeWorldPresets.includes("gothic")}     variant="stone"      disabled={disabled} />
        <TagBtn label="📢 広告"      title="ハイエンド広告・ファッション誌・ブランドビジュアル風（クリック=単独選択 / Shift+クリック=コンボ）"                                           onClick={(e) => onWorldPresetToggle("ad", e.shiftKey)}         active={activeWorldPresets.includes("ad")}         variant="sky"        disabled={disabled} />
        <TagBtn label="✨ 幻想"      title="神秘的・夢幻的な幻想世界観。量産ファンタジードレス禁止（クリック=単独選択 / Shift+クリック=コンボ）"                 onClick={(e) => onWorldPresetToggle("fantasy", e.shiftKey)}   active={activeWorldPresets.includes("fantasy")}   variant="teal"       disabled={disabled} />
        <TagBtn label="📺 レトロ"    title="昭和・フィルム・80年代ポップ・ヴィンテージの世界観（クリック=単独選択 / Shift+クリック=コンボ）"                                             onClick={(e) => onWorldPresetToggle("retro", e.shiftKey)}      active={activeWorldPresets.includes("retro")}      variant="gold"       disabled={disabled} />
        <TagBtn label="🖤 地雷系"   title="かわいい×ダークの病みかわいい世界観。黒/白/ピンク/赤系・リボン・厚底（クリック=単独選択 / Shift+クリック=コンボ）"                            onClick={(e) => onWorldPresetToggle("jirai", e.shiftKey)}      active={activeWorldPresets.includes("jirai")}      variant="jirai"      disabled={disabled} />
        <TagBtn label="☠️ 世紀末系" title="錆・砂埃・終末ロードムービー感（クリック=単独選択 / Shift+クリック=コンボ）"                                                  onClick={(e) => onWorldPresetToggle("seikimatsu", e.shiftKey)} active={activeWorldPresets.includes("seikimatsu")} variant="seikimatsu" disabled={disabled} />
        {activeWorldPresets.length > 1 && (
          <span className="text-[11px] text-indigo-300/70 font-semibold self-center ml-1">
            {activeWorldPresets.length}選択中
          </span>
        )}
      </CategoryRow>

      {/* ══════ 斬新背景（背景版プリセット・人物は変えない） ══════ */}
      {onBgPresetToggle && (
        <CategoryRow label="斬新背景">
          <span className="w-full text-[10px] text-text-desc leading-snug mb-0.5">背景だけを「実在しない斬新な世界」に置き換える（人物・衣装・構図は変えない / クリック=単独選択・Shift+クリック=コンボ）</span>
          <TagBtn label="🖥 コード空間" title="背景を流れるソースコード・データラインの斬新空間に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onBgPresetToggle("code_space", e.shiftKey)} active={activeBgPresets.includes("code_space")} variant="teal"   disabled={disabled} />
          <TagBtn label="🔢 数式世界" title="背景を浮遊する数式・幾何学の斬新空間に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）"     onClick={(e) => onBgPresetToggle("math_world", e.shiftKey)} active={activeBgPresets.includes("math_world")} variant="indigo" disabled={disabled} />
          <TagBtn label="🔟 数字世界" title="背景を無数の数字・数列（バイナリの雨）の斬新空間に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onBgPresetToggle("digit_world", e.shiftKey)} active={activeBgPresets.includes("digit_world")} variant="sky"    disabled={disabled} />
          <TagBtn label="🖌 漢字空間" title="背景を無数の漢字・墨字・古文書の文字の海の斬新空間に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onBgPresetToggle("kanji_space", e.shiftKey)} active={activeBgPresets.includes("kanji_space")} variant="amber"  disabled={disabled} />
          <TagBtn label="🔤 英字タイポ空間" title="背景を英字・タイポグラフィの羅列のエディトリアル斬新空間に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onBgPresetToggle("typo_space", e.shiftKey)} active={activeBgPresets.includes("typo_space")} variant="violet" disabled={disabled} />
          <TagBtn label="🔌 回路基板の街" title="背景を基板の配線が街並みになる斬新な世界に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onBgPresetToggle("circuit_city", e.shiftKey)} active={activeBgPresets.includes("circuit_city")} variant="gold" disabled={disabled} />
          <TagBtn label="🔺 ポリゴン・ワイヤーフレーム" title="背景を低ポリゴン・ワイヤーフレームの斬新な世界に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onBgPresetToggle("polygon_mesh", e.shiftKey)} active={activeBgPresets.includes("polygon_mesh")} variant="stone" disabled={disabled} />
          {activeBgPresets.length > 1 && (
            <span className="text-[11px] text-indigo-300/70 font-semibold self-center ml-1">
              {activeBgPresets.length}選択中
            </span>
          )}
        </CategoryRow>
      )}

      {/* ══════ 画法世界（斬新背景の姉妹カテゴリ・アナログな画法/質感の系統） ══════ */}
      {onArtPresetToggle && (
        <CategoryRow label="画法世界">
          <span className="w-full text-[10px] text-text-desc leading-snug mb-0.5">背景だけを「アナログな画法・質感」の世界に置き換える（人物・衣装・構図は変えない / クリック=単独選択・Shift+クリック=コンボ）</span>
          <TagBtn label="🖨 印刷物・活版" title="背景を活版印刷・古い刷り物の質感の世界に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onArtPresetToggle("letterpress", e.shiftKey)} active={activeArtPresets.includes("letterpress")} variant="amber" disabled={disabled} />
          <TagBtn label="🔷 キュビスム" title="背景を多視点が同居するキュビスムの世界に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onArtPresetToggle("cubism", e.shiftKey)} active={activeArtPresets.includes("cubism")} variant="sky" disabled={disabled} />
          <TagBtn label="🪵 版画・木版" title="背景を彫りと刷りの質感を持つ木版画の世界に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onArtPresetToggle("woodblock", e.shiftKey)} active={activeArtPresets.includes("woodblock")} variant="stone" disabled={disabled} />
          <TagBtn label="🎭 切り絵・シルエット層" title="背景を切り絵のシルエットが幾重にも重なる世界に。人物・衣装・構図は変えない（クリック=単独選択 / Shift+クリック=コンボ）" onClick={(e) => onArtPresetToggle("paper_cut", e.shiftKey)} active={activeArtPresets.includes("paper_cut")} variant="violet" disabled={disabled} />
          {activeArtPresets.length > 1 && (
            <span className="text-[11px] text-indigo-300/70 font-semibold self-center ml-1">
              {activeArtPresets.length}選択中
            </span>
          )}
        </CategoryRow>
      )}

      {/* ══════ 配色の主従（衣装/背景どちらを主役にするか・単一選択） ══════ */}
      {onColorDominanceChange && (
        <CategoryRow label="配色主従">
          <span className="w-full text-[10px] text-text-desc leading-snug mb-0.5">衣装と背景、どちらの配色を主役にするか（クリックで選択・もう一度クリックで解除）</span>
          <TagBtn label="👗 衣装主役" title="背景の配色は無彩色〜低彩度に抑え、衣装だけが彩度を持つようにする" onClick={() => onColorDominanceChange(colorDominance === "outfit" ? null : "outfit")} active={colorDominance === "outfit"} variant="pink" disabled={disabled} />
          <TagBtn label="🖼 背景主役" title="衣装の配色はモノトーン〜控えめに抑え、背景の方が色で主張するようにする" onClick={() => onColorDominanceChange(colorDominance === "background" ? null : "background")} active={colorDominance === "background"} variant="sky" disabled={disabled} />
          <TagBtn label="⚡ 対比" title="衣装と背景を反対方向の配色に振り分け、コントラストを強める" onClick={() => onColorDominanceChange(colorDominance === "contrast" ? null : "contrast")} active={colorDominance === "contrast"} variant="gold" disabled={disabled} />
        </CategoryRow>
      )}

      {/* ══════ マイプリセット（現在の全設定を名前付きで保存・再適用） ══════ */}
      {onSaveMyPreset && onApplyMyPreset && onOverwriteMyPreset && onDeleteMyPreset && (
        <MyPresetsSection
          presets={myPresets}
          disabled={disabled}
          atCap={myPresets.length >= MY_PRESET_MAX}
          defaultName={myPresetDefaultName}
          onSave={onSaveMyPreset}
          onApply={onApplyMyPreset}
          onOverwrite={onOverwriteMyPreset}
          onDelete={onDeleteMyPreset}
        />
      )}

    </div>
  );
}
