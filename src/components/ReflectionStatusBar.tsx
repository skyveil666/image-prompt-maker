/**
 * ReflectionStatusBar — 「今、生成プロンプトに何が効くか」を一目で見せる読み取り専用バー
 *
 * 目的（要望 #7 / #8）：
 *   上部ボタンを押しても「それがプロンプトに反映されているか分からない」問題を解消する。
 *   このバーは buildInputs() と同じ条件で「実際にサーバへ送られる＝効く設定」を導出し、
 *   無効なもの（変更対象に含まれず効かないもの）は理由付きでグレー表示する。
 *
 * 重要：このコンポーネントは状態を一切変更しない（唯一のソースは上段ボタン＝App の state）。
 *       表示専用なので、生成ロジックと食い違わないよう「効く条件」を厳密に揃えている。
 */
import { useCallback, useState } from "react";
import type { Scope } from "../types";
import { DominatorBadge, summarizeNote } from "./DominatorBadge";
import { tagNgToLabels } from "../data/tagNgOptions";

// ── ラベル ──────────────────────────────────────────────────────────────────

const GOD_JP: Record<string, string> = {
  normal: "👑 強力おまかせ", chaos: "🎲 ぶっ飛び融合神引き", composition: "📷 構図神引き",
  outfit: "🧥 衣装神引き", bg: "🌍 背景神引き", color: "🎨 色神引き",
  world_god: "🌌 異世界ガチャ", props: "🎁 小物神引き", bigobject: "🏛️ 大物神引き",
  myth: "🐉 神話神引き", movie: "🎬 映画神引き",
};

const BOOST_JP: Record<string, string> = {
  avoid_overlap: "🔁 被り回避", other_world: "🌀 世界観を一新",
  buzz: "🧲 映え補正", face_pop: "🎯 顔映え",
};

const WORLD_JP: Record<string, string> = {
  y2k: "👗 Y2K", y3k: "🚀 Y3K", street: "🏙️ ストリート", cinema: "🎬 映画",
  wafuu: "🌸 和風", gothic: "🖤 ゴシック", ad: "📢 広告", fantasy: "✨ 幻想",
  retro: "📺 レトロ", jirai: "🖤 地雷系", seikimatsu: "☠️ 世紀末系",
};

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  scopes: Scope[];
  /** 全リセット（確認ダイアログ表示後に呼ばれる） — オプション：渡さない場合はボタン非表示 */
  onResetAll?: () => void;
  // 生成補助（分析センターが立てる state — このバーが唯一の可視化点）
  activeGodModes: string[];
  chaosLabel: string | null;
  activeBoosts: string[];
  /** 世界観プリセットID（y2k 等）。内部でラベル化する */
  activeWorldPresets: string[];
  // ── 「見えない支配」設定：全案に効くのに画面に出ない指示文を常時可視化＋解除 ──
  /** 世界観プリセット由来の追加指示（全案へ注入・通常は不可視）。非空なら支配バッジを出す。 */
  worldCombinedNote: string;
  /** 参照画像から適用した強制ブロック（全案へ注入・通常は不可視）。非空なら支配バッジを出す。 */
  referenceNoteText: string;
  /** 世界観の解除（worldCombinedNote + activeWorldPresets をクリア）。 */
  onClearWorld: () => void;
  /** 参照画像適用の解除（referenceNote をクリア）。 */
  onClearReference: () => void;
  /** 🌆 背景を2D/非写実に（既定ON・非永続）。背景が変更対象の時だけ全案に効くが回避▼に埋もれて気付きにくい。 */
  avoidRealBackground: boolean;
  /** 背景2D化の解除（avoidRealBackground を false に）。 */
  onClearAvoidRealBg: () => void;
  /** タグ個別NG（per-tag NG）の現在値。非空なら「本文から除外」バッジを出す（全案の【NG】に効く）。 */
  tagNg: string[];
  /** タグ個別NGの一括解除（setTagNg([])）。 */
  onClearTagNg: () => void;
}

// ── チップ ───────────────────────────────────────────────────────────────────
type Tone = "scope" | "lock" | "assist" | "avoid" | "fav" | "look" | "dup" | "off";

const TONE_CLS: Record<Tone, string> = {
  scope:  "border-violet-400/55 bg-violet-500/15 text-violet-100",
  lock:   "border-emerald-400/45 bg-emerald-500/12 text-emerald-100",
  assist: "border-amber-400/50 bg-amber-500/12 text-amber-100",
  avoid:  "border-sky-400/50 bg-sky-500/12 text-sky-100",
  fav:    "border-pink-400/50 bg-pink-500/12 text-pink-100",
  look:   "border-cyan-400/50 bg-cyan-500/12 text-cyan-100",
  dup:    "border-rose-400/50 bg-rose-500/12 text-rose-100",
  off:    "border-white/10 bg-white/3 text-text-muted/45 line-through decoration-text-muted/30",
};

function Chip({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={[
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium leading-none whitespace-nowrap",
        TONE_CLS[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

// ── 本体 ────────────────────────────────────────────────────────────────────
export function ReflectionStatusBar(p: Props) {
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleResetClick = useCallback(() => setConfirmingReset(true), []);
  const handleResetConfirm = useCallback(() => {
    setConfirmingReset(false);
    p.onResetAll?.();
  }, [p]);

  // 生成補助チップ（god/boost は分析センターが立てる state）
  const godChips = p.activeGodModes.map((m) =>
    m === "chaos" && p.chaosLabel ? `🎲 ${p.chaosLabel}` : (GOD_JP[m] ?? m)
  );

  // 🚨 「見えない支配」：全案に注入されるのに画面に出ない指示文（世界観/参照画像）を常時バッジ化する
  const worldNote = p.worldCombinedNote.trim();
  const refNote = p.referenceNoteText.trim();
  // 背景2D化（avoidRealBackground）は既定ON・非永続だが、背景が変更対象の時だけ実際に発火する（server側ゲートと一致）
  const bgStylizeActive = p.avoidRealBackground && p.scopes.includes("background");
  // 🚫 タグ個別NG（per-tag NG）：折りたたみ時に赤タグが見えなくなるため、ここで常時可視化＋解除（§5）。
  const tagNgLabels = tagNgToLabels(p.tagNg);
  const hasDominator = worldNote.length > 0 || refNote.length > 0 || bgStylizeActive || p.tagNg.length > 0;
  const worldLabel = p.activeWorldPresets.map((w) => WORLD_JP[w] ?? w).join(" × ") || "適用中";

  return (
    <section className="rounded-lg border border-violet-400/25 bg-violet-500/5 overflow-hidden">
      {/* 🚨 「見えない支配」常時バッジ：全案に効くのに画面に出ない指示文（世界観/参照画像）を
          open 状態に関係なく常時表示し、ワンクリックで解除できるようにする。両方空なら何も出さない。 */}
      {hasDominator && (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/12 border-b border-rose-400/30">
          {worldNote && (
            <DominatorBadge
              label={`🌍 世界観：${worldLabel}`}
              summary={summarizeNote(worldNote)}
              summaryTitle={p.worldCombinedNote}
              onClear={p.onClearWorld}
              clearTitle="この世界観を全案から解除する"
            />
          )}
          {refNote && (
            <DominatorBadge
              label="🖼 参照画像から適用中"
              summary={summarizeNote(refNote)}
              summaryTitle={p.referenceNoteText}
              onClear={p.onClearReference}
              clearTitle="参照画像からの適用を全案から解除する"
            />
          )}
          {bgStylizeActive && (
            <DominatorBadge
              label="🌆 背景を2D/非写実に"
              summary="既定ON・全案の背景をイラスト調に"
              summaryTitle="背景の風景・空間をイラスト調に寄せる（人物・顔・肌は実写維持）。既定ON・背景が変更対象の時だけ全案に効く。"
              onClear={p.onClearAvoidRealBg}
              clearTitle="背景2D化をOFFにする（実写背景を許可。回避▼トグルと同じ設定）"
            />
          )}
          {p.tagNg.length > 0 && (
            <DominatorBadge
              label="🚫 タグNG（本文から除外）"
              summary={tagNgLabels.join("・")}
              summaryTitle={`NG設定モードで除外したタグを全案の本文から除外します：${tagNgLabels.join("、")}`}
              onClear={p.onClearTagNg}
              clearTitle="タグNGを全解除（値の選択は保持）"
            />
          )}
        </div>
      )}
      {/* 📡 boost/god チップ＋全リセット */}
      <div className="flex items-center flex-wrap gap-1.5 px-2.5 py-1.5">
        <span className="text-[12px] font-bold text-violet-200 shrink-0">📡</span>
        {godChips.map((label, i) => (
          <Chip key={`g${i}`} tone="assist">{label}</Chip>
        ))}
        {p.activeBoosts.map((b) => (
          <Chip key={b} tone={b === "avoid_overlap" || b === "other_world" ? "avoid" : "assist"}>
            {BOOST_JP[b] ?? b}
          </Chip>
        ))}
        {p.onResetAll && !confirmingReset && (
          <button type="button" onClick={handleResetClick}
            className="ml-auto shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded border border-rose-400/40 bg-rose-400/8 text-rose-300/90 hover:bg-rose-400/18 hover:border-rose-400/65 transition leading-none"
            title="変更対象・設定・プレビューをすべて初期化（履歴・学習データは保持）">
            ↺ 全リセット
          </button>
        )}
      </div>

      {/* ── 確認ダイアログ（インライン）────────────────────────────── */}
      {confirmingReset && (
        <div className="px-3 py-2.5 bg-rose-500/12 border-t border-rose-400/25 space-y-2">
          <p className="text-[12px] text-rose-100 leading-snug">
            現在の選択状態と反映中の設定をすべて初期化します。<br />
            <span className="text-rose-300/80">履歴・お気に入り・学習データは削除されません。</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetConfirm}
              className="text-[12px] font-bold px-3 py-1 rounded-lg border border-rose-400/65 bg-rose-500/25 text-rose-100 hover:bg-rose-500/40 transition leading-none"
            >
              リセットする
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="text-[12px] px-3 py-1 rounded-lg border border-white/15 bg-white/5 text-text-muted hover:text-text-base transition leading-none"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
