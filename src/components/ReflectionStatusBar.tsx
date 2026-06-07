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
import type { ZozoTrend } from "../lib/zozoTrend";
import type { ColorWeightMap } from "../lib/colorPolicy";
import { countWeights } from "../lib/colorPolicy";
import type { FavoriteProfile } from "../lib/favoriteProfile";

// ── ラベル ──────────────────────────────────────────────────────────────────
const SCOPE_JP: Record<Scope, string> = {
  background: "背景", foreground: "前景演出", pose: "ポーズ", hair: "髪",
  outfit: "衣装", cosplay: "コスプレ", cyber: "🦾 メカ", camera: "カメラ",
  props: "小物", big_object: "大物", vehicle: "乗り物", myth: "神話",
  lighting: "ライティング", aspect_ratio: "比率",
};

const GOD_JP: Record<string, string> = {
  normal: "👑 ノーマル神引き", chaos: "🎲 ぶっ飛び融合神引き", composition: "📷 構図神引き",
  outfit: "🧥 衣装神引き", bg: "🌍 背景神引き", color: "🎨 色神引き",
  world_god: "🌌 世界観神引き", props: "🎁 小物神引き", bigobject: "🏛️ 大物神引き",
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

const REALISM_JP: Record<number, string> = {
  1: "イラスト", 2: "デジタルペイント", 3: "2.5D", 4: "リアル寄り", 5: "写真リアル",
};

// 風が効くスコープ / リアル度が効くスコープ（server 側ゲートと一致させる）
const WIND_SCOPES: Scope[] = ["hair", "outfit", "foreground", "pose", "camera"];
const REALISM_SCOPES: Scope[] = ["background", "outfit", "camera", "lighting"];

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  scopes: Scope[];
  // 守るもの
  faceLock: boolean;
  /** 全リセット（確認ダイアログ表示後に呼ばれる） — オプション：渡さない場合はボタン非表示 */
  onResetAll?: () => void;
  bodyPoseLock: boolean;
  colorMoodLock: boolean;
  compositionLock: boolean;
  // 生成補助
  avoidCliche: boolean;
  activeGodModes: string[];
  chaosLabel: string | null;
  activeBoosts: string[];
  viralMode: boolean;
  activeSnsLabels: string[];
  activeCultureLabels: string[];
  /** 世界観プリセットID（y2k 等）。内部でラベル化する */
  activeWorldPresets: string[];
  // 好み反映
  favoriteEnabled: boolean;
  favoriteProfile: FavoriteProfile | null;
  zozoApplied: ZozoTrend | null;
  // 見た目
  realismLevel: number;
  realismType: string | null;
  glossLevel: number;
  windLevel: number;
  // 重複制御
  policyApplied: boolean;
  motifControlledCount: number;
  comboControlCount: number;
  colorWeights: ColorWeightMap;
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

/** 無効チップ（理由付き・グレーアウト） */
function OffChip({ label, reason }: { label: string; reason: string }) {
  return (
    <Chip tone="off" title={`${label}：${reason}`}>
      {label}
      <span className="not-line-through text-[9px] text-amber-300/60 ml-0.5">（{reason}）</span>
    </Chip>
  );
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 py-0.5">
      <span className="text-[11px] font-bold text-slate-400 shrink-0 w-[5.5rem] leading-5 select-none">
        {icon} {label}
      </span>
      <div className="flex flex-wrap gap-1 items-center min-h-[1.25rem] flex-1">{children}</div>
    </div>
  );
}

// ── 本体 ────────────────────────────────────────────────────────────────────
export function ReflectionStatusBar(p: Props) {
  // P4: 初期は折りたたみ（1行サマリ）。生成作業の縦スペースを優先。
  const [open, setOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleResetClick = useCallback(() => setConfirmingReset(true), []);
  const handleResetConfirm = useCallback(() => {
    setConfirmingReset(false);
    p.onResetAll?.();
  }, [p]);

  const hasOutfit = p.scopes.includes("outfit");
  const windApplicable  = p.scopes.some((s) => WIND_SCOPES.includes(s));
  const realismApplicable = p.scopes.some((s) => REALISM_SCOPES.includes(s));

  // 効いている条件（buildInputs と厳密に一致）
  const zozoActive = !!p.zozoApplied && p.zozoApplied.traits.length > 0 && hasOutfit;
  const zozoStaged = !!p.zozoApplied && p.zozoApplied.traits.length > 0 && !hasOutfit;
  const favActive  = p.favoriteEnabled && !!p.favoriteProfile && p.favoriteProfile.traitPhrases.length > 0;
  const favStaged  = p.favoriteEnabled && (!p.favoriteProfile || p.favoriteProfile.traitPhrases.length === 0);
  const windActive = p.windLevel > 0 && windApplicable;
  const windStaged = p.windLevel > 0 && !windApplicable;
  const realismOn  = p.realismLevel !== 3 || !!p.realismType;
  const realismActive = realismOn && realismApplicable;
  const realismStaged = realismOn && !realismApplicable;
  const glossOn    = p.glossLevel !== 3;
  const cw = countWeights(p.colorWeights);
  const colorCustom = cw.customized > 0;

  // 生成補助のチップ群（強化系 / 回避系 / SNS文化）
  const godChips = p.activeGodModes.map((m) =>
    m === "chaos" && p.chaosLabel ? `🎲 ${p.chaosLabel}` : (GOD_JP[m] ?? m)
  );

  // 折りたたみヘッダ：1行サマリ（P4：🎯変更N 🔒守るN ✨補助N 🧬好みON/OFF）
  const guardCount =
    1 /* 顔/同一性は常時保護 */ +
    (p.bodyPoseLock ? 1 : 0) + (p.colorMoodLock ? 1 : 0) + (p.compositionLock ? 1 : 0);
  const assistCount =
    godChips.length + (p.viralMode ? 1 : 0) + p.activeWorldPresets.length +
    (p.avoidCliche ? 1 : 0) + p.activeBoosts.length +
    p.activeSnsLabels.length + p.activeCultureLabels.length;
  const prefOn = favActive || zozoActive;
  const summaryParts: string[] = [
    `🎯変更${p.scopes.length}`,
    `🔒守る${guardCount}`,
    `✨補助${assistCount}`,
    `🧬好み${prefOn ? "ON" : "OFF"}`,
  ];

  return (
    <section className="rounded-lg border border-violet-400/25 bg-violet-500/5 overflow-hidden">
      {/* ヘッダ（button入れ子を避けるため div+role=button。Enter/Spaceで開閉） */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/3 transition text-left cursor-pointer"
      >
        <span className="text-[12px] font-bold text-violet-200 tracking-wide shrink-0">
          📡 現在の反映状態
        </span>
        {!open && (
          <span className="text-[11px] text-slate-400 truncate">
            {summaryParts.join(" ・ ")}
          </span>
        )}
        {/* 全リセットボタン（ReflectionStatusBar に1つだけ集約） */}
        {p.onResetAll && !confirmingReset && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleResetClick(); }}
            className="shrink-0 ml-2 text-[11px] font-semibold px-2 py-0.5 rounded border border-rose-400/40 bg-rose-400/8 text-rose-300/90 hover:bg-rose-400/18 hover:border-rose-400/65 transition leading-none"
            title="変更対象・設定・プレビューをすべて初期化（履歴・学習データは保持）"
          >
            ↺ 全リセット
          </button>
        )}
        <span className="ml-auto text-[10px] text-slate-400 shrink-0">{open ? "▲ 閉じる" : "▼ 開く"}</span>
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

      {open && (
        <div className="px-2.5 pb-2 pt-0.5 space-y-0.5 border-t border-white/8">
          {/* 1. 変更対象 */}
          <Row icon="🎯" label="変更対象">
            {p.scopes.length === 0 ? (
              <span className="text-[11px] text-amber-300/80">未選択 — 変更したい項目を選んでください</span>
            ) : (
              p.scopes.map((s) => <Chip key={s} tone="scope">{SCOPE_JP[s]}</Chip>)
            )}
          </Row>

          {/* 2. 守るもの */}
          <Row icon="🔒" label="守るもの">
            <Chip tone="lock">顔/同一性</Chip>
            {p.bodyPoseLock    && <Chip tone="lock">体型/ポーズ</Chip>}
            {p.colorMoodLock   && <Chip tone="lock">色味/雰囲気</Chip>}
            {p.compositionLock && <Chip tone="lock">元画像構図</Chip>}
          </Row>

          {/* 3. 生成補助 */}
          <Row icon="✨" label="生成補助">
            {/* 強化系 */}
            {godChips.map((label, i) => <Chip key={`g${i}`} tone="assist">{label}</Chip>)}
            {p.viralMode && <Chip tone="assist">🔥 バズり</Chip>}
            {p.activeWorldPresets.map((w, i) => <Chip key={`w${i}`} tone="assist">{WORLD_JP[w] ?? w}</Chip>)}
            {/* 回避系 */}
            {p.avoidCliche && <Chip tone="avoid">🛡 テンプレ回避</Chip>}
            {p.activeBoosts.map((b) => (
              <Chip key={b} tone={b === "avoid_overlap" || b === "other_world" ? "avoid" : "assist"}>
                {BOOST_JP[b] ?? b}
              </Chip>
            ))}
            {/* SNS / 文化 */}
            {p.activeSnsLabels.map((l, i) => <Chip key={`s${i}`} tone="assist">📈 {l}</Chip>)}
            {p.activeCultureLabels.map((l, i) => <Chip key={`c${i}`} tone="assist">🌐 {l}</Chip>)}
            {/* 何もなし */}
            {godChips.length === 0 && !p.viralMode && !p.avoidCliche &&
             p.activeBoosts.length === 0 && p.activeWorldPresets.length === 0 &&
             p.activeSnsLabels.length === 0 && p.activeCultureLabels.length === 0 && (
              <span className="text-[11px] text-text-muted/40">なし</span>
            )}
          </Row>

          {/* 4. 好み反映（お気に入り / ZOZO） */}
          <Row icon="💖" label="好み反映">
            {favActive && (
              <Chip tone="fav" title={p.favoriteProfile?.traitPhrases.slice(0, 4).join("・")}>
                ⭐ お気に入り傾向（{p.favoriteProfile?.traitPhrases.length ?? 0}項目）
              </Chip>
            )}
            {favStaged && <OffChip label="⭐ お気に入り傾向" reason="傾向データ不足・⭐を数件登録で有効" />}
            {zozoActive && (
              <Chip tone="fav">
                👗 ZOZO {p.zozoApplied?.ageLabel}{p.zozoApplied?.mode === "priority" ? "（優先）" : ""}
              </Chip>
            )}
            {zozoStaged && <OffChip label="👗 ZOZO トレンド" reason="衣装OFFのため未反映" />}
            {!favActive && !favStaged && !zozoActive && !zozoStaged && (
              <span className="text-[11px] text-text-muted/40">なし</span>
            )}
          </Row>

          {/* 5. 見た目 / 質感 */}
          <Row icon="🎨" label="見た目">
            {realismActive && <Chip tone="look">質感 {REALISM_JP[p.realismLevel]}{p.realismType ? "＋タイプ" : ""}</Chip>}
            {realismStaged && <OffChip label={`質感 ${REALISM_JP[p.realismLevel]}`} reason="背景/衣装/カメラ/光のいずれかをONで反映" />}
            {glossOn && <Chip tone="look">光沢 {p.glossLevel}</Chip>}
            {windActive && <Chip tone="look">🌬 風 {p.windLevel}</Chip>}
            {windStaged && <OffChip label={`🌬 風 ${p.windLevel}`} reason="髪/衣装/前景/ポーズ/カメラをONで反映" />}
            {!realismActive && !realismStaged && !glossOn && !windActive && !windStaged && (
              <span className="text-[11px] text-text-muted/40">標準（指定なし）</span>
            )}
          </Row>

          {/* 6. 重複制御（反映ON時のみ／色は常時） */}
          {(p.policyApplied && (p.motifControlledCount > 0 || p.comboControlCount > 0)) || colorCustom ? (
            <Row icon="🔬" label="重複制御">
              {p.policyApplied && p.motifControlledCount > 0 && (
                <Chip tone="dup">モチーフ {p.motifControlledCount}件</Chip>
              )}
              {p.policyApplied && p.comboControlCount > 0 && (
                <Chip tone="dup">構成 {p.comboControlCount}件</Chip>
              )}
              {colorCustom && (
                <Chip tone="dup">
                  色重み {cw.customized}色（禁止{cw.block}/抑制{cw.suppress}/推奨{cw.boost}）
                </Chip>
              )}
            </Row>
          ) : null}
        </div>
      )}
    </section>
  );
}
