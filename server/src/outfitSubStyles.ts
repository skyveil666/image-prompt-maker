/**
 * 衣装サブジャンル展開エンジン
 *
 * 目的：「ストリート」「モード」「サイバー」などの大カテゴリ名を
 *       そのままプロンプトに出させない。必ずサブジャンルへ展開する。
 *
 * - 各大カテゴリは 12 のサブジャンルを持つ（SUB_STYLE_POOLS）
 * - 案ごとに 2 個（神引き時は 3 個）のサブジャンルを抽選
 * - 直近使用（recentSubStyles）を回避
 * - 同バッチ内では別案が同じサブジャンルを使わないよう調整
 * - 抽選結果は GeneratedProposal.subStyles に格納し、クライアントが履歴へ往復させる
 */

import type { GenerateRequest } from "./types.ts";

export interface SubStyleDef {
  /** 履歴重複回避用の安定ID */
  readonly id: string;
  /** プロンプトに織り込む自然な日本語フレーズ */
  readonly label: string;
}

/**
 * 大カテゴリ（OUTFIT_LABELS.style のキー）→ サブジャンル候補プール。
 * 各プールは 12 件のバリエーションを持つ。
 */
export const SUB_STYLE_POOLS: Readonly<Record<string, readonly SubStyleDef[]>> = {
  street: [
    { id: "street_90s",       label: "90sストリート" },
    { id: "street_skater",    label: "スケーターストリート" },
    { id: "street_korean",    label: "韓国ストリート" },
    { id: "street_tokyo",     label: "東京ストリート" },
    { id: "street_ny",        label: "NYストリート" },
    { id: "street_sport_mix", label: "スポーツミックスストリート" },
    { id: "street_grunge",    label: "グランジストリート" },
    { id: "street_tech",      label: "テックストリート" },
    { id: "street_minimal",   label: "ミニマルストリート" },
    { id: "street_luxe",      label: "高級ストリート" },
    { id: "street_vintage",   label: "古着MIXストリート" },
    { id: "street_subway",    label: "地下鉄ストリート" },
  ],
  mode: [
    { id: "mode_black",       label: "黒モード" },
    { id: "mode_white",       label: "白モード" },
    { id: "mode_minimal",     label: "ミニマルモード" },
    { id: "mode_constructive",label: "構築的モード" },
    { id: "mode_runway",      label: "ランウェイモード" },
    { id: "mode_tokyo",       label: "東京モード" },
    { id: "mode_paris",       label: "パリコレ風モード" },
    { id: "mode_asym",        label: "アシンメトリーモード" },
    { id: "mode_sculpture",   label: "彫刻的シルエットのモード" },
    { id: "mode_ad",          label: "広告モード" },
    { id: "mode_experimental",label: "実験服モード" },
    { id: "mode_future",      label: "近未来モード" },
  ],
  cyber: [
    { id: "cyber_punk",       label: "サイバーパンク" },
    { id: "cyber_clean",      label: "クリーンサイバー" },
    { id: "cyber_white",      label: "白サイバー" },
    { id: "cyber_medical",    label: "医療サイバー" },
    { id: "cyber_ad",         label: "広告サイバー" },
    { id: "cyber_y3k",        label: "Y3Kサイバー" },
    { id: "cyber_industrial", label: "工業サイバー" },
    { id: "cyber_transparent",label: "透明素材サイバー" },
    { id: "cyber_ai_lab",     label: "AI研究所風サイバー" },
    { id: "cyber_minimal",    label: "ミニマルサイバー" },
    { id: "cyber_bio",        label: "バイオサイバー" },
    { id: "cyber_luxe",       label: "高級サイバー" },
  ],
  japanese: [
    { id: "wa_taisho",        label: "大正ロマン" },
    { id: "wa_showa_retro",   label: "昭和レトロ和風" },
    { id: "wa_kyo",           label: "京都古典" },
    { id: "wa_edo",           label: "江戸町娘" },
    { id: "wa_miko_modern",   label: "巫女モダン" },
    { id: "wa_monpfuku",      label: "黒紋付" },
    { id: "wa_avant",         label: "着物アバンギャルド" },
    { id: "wa_fusion",        label: "和洋折衷" },
    { id: "wa_buke",          label: "武家娘" },
    { id: "wa_shinto",        label: "神社装束モチーフ" },
    { id: "wa_street",        label: "ストリート和風" },
    { id: "wa_pop",           label: "ポップ和風" },
  ],
  gothic: [
    { id: "goth_victorian",   label: "ヴィクトリアンゴシック" },
    { id: "goth_lolita",      label: "ゴシックドール系" },
    { id: "goth_academia",    label: "ダークアカデミアゴシック" },
    { id: "goth_mode",        label: "モードゴシック" },
    { id: "goth_vampire",     label: "ヴァンパイア風ゴシック" },
    { id: "goth_church",      label: "教会ゴシック" },
    { id: "goth_decadent",    label: "退廃ゴシック" },
    { id: "goth_street",      label: "ストリートゴシック" },
    { id: "goth_clean",       label: "クリーンゴシック" },
    { id: "goth_romantic",    label: "ロマンティックゴシック" },
    { id: "goth_industrial",  label: "工業ゴシック" },
    { id: "goth_baroque",     label: "バロックゴシック" },
  ],
  military: [
    { id: "mil_combat",       label: "戦闘服ミリタリー" },
    { id: "mil_pilot",        label: "パイロットスーツ" },
    { id: "mil_para",         label: "パラトルーパー風" },
    { id: "mil_tech",         label: "テクニカル軍服" },
    { id: "mil_desert",       label: "デザートカモ" },
    { id: "mil_urban",        label: "アーバンカモ" },
    { id: "mil_navy",         label: "海軍士官風" },
    { id: "mil_air",          label: "空軍ジャケット" },
    { id: "mil_minimal",      label: "ミニマルミリタリー" },
    { id: "mil_mode",         label: "モードミリタリー" },
    { id: "mil_vintage",      label: "ヴィンテージミリタリー" },
    { id: "mil_techwear",     label: "テックミリタリー" },
  ],
  techwear: [
    { id: "tw_goggles",       label: "ゴーグルテックウェア" },
    { id: "tw_desert",        label: "デザートテックウェア" },
    { id: "tw_urban",         label: "アーバンテックウェア" },
    { id: "tw_white",         label: "白テックウェア" },
    { id: "tw_black",         label: "黒テックウェア" },
    { id: "tw_transparent",   label: "透明素材テックウェア" },
    { id: "tw_minimal",       label: "ミニマルテックウェア" },
    { id: "tw_luxe",          label: "高級テックウェア" },
    { id: "tw_industrial",    label: "工業テックウェア" },
    { id: "tw_bio",           label: "バイオテックウェア" },
    { id: "tw_athletic",      label: "アスレチックテックウェア" },
    { id: "tw_military",      label: "ミリタリーテックウェア" },
  ],
  dress: [
    { id: "dr_constructive",  label: "構築的ドレス" },
    { id: "dr_asym",          label: "アシンメトリードレス" },
    { id: "dr_minimal",       label: "ミニマルドレス" },
    { id: "dr_mode",          label: "モードドレス" },
    { id: "dr_ad",            label: "広告風ドレス" },
    { id: "dr_brand",         label: "高級ブランドドレス" },
    { id: "dr_sculpture",     label: "彫刻的ドレス" },
    { id: "dr_tech",          label: "テックドレス" },
    { id: "dr_wa",            label: "和ドレス" },
    { id: "dr_vintage",       label: "ヴィンテージドレス" },
    { id: "dr_avant",         label: "アヴァンギャルドドレス" },
    { id: "dr_runway",        label: "ランウェイドレス" },
  ],
  armor: [
    { id: "ar_light",         label: "軽量装甲" },
    { id: "ar_knight",        label: "重装騎士アーマー" },
    { id: "ar_leather",       label: "戦士の革鎧" },
    { id: "ar_fantasy",       label: "ファンタジー鎧" },
    { id: "ar_mode",          label: "モードアーマー" },
    { id: "ar_transparent",   label: "透明アーマー" },
    { id: "ar_hitech",        label: "ハイテクアーマー" },
    { id: "ar_bio",           label: "バイオアーマー" },
    { id: "ar_minimal",       label: "ミニマルアーマー" },
    { id: "ar_ornate",        label: "装飾アーマー" },
    { id: "ar_gothic",        label: "ゴシックアーマー" },
    { id: "ar_samurai",       label: "侍アーマー" },
  ],
  y2k: [
    { id: "y2k_pink",         label: "ピンクY2K" },
    { id: "y2k_silver",       label: "シルバーY2K" },
    { id: "y2k_bubble",       label: "バブルY2K" },
    { id: "y2k_techno",       label: "テクノY2K" },
    { id: "y2k_lowrise",      label: "ローライズY2K" },
    { id: "y2k_logo",         label: "ロゴY2K" },
    { id: "y2k_transparent",  label: "トランスペアレントY2K" },
    { id: "y2k_grunge",       label: "グランジY2K" },
    { id: "y2k_gal",          label: "ギャルY2K" },
    { id: "y2k_minimal",      label: "ミニマルY2K" },
    { id: "y2k_street",       label: "ストリートY2K" },
    { id: "y2k_club",         label: "クラブY2K" },
  ],
  lolita: [
    { id: "lo_sweet",         label: "スイートドール系" },
    { id: "lo_gothic",        label: "ゴシックドール系" },
    { id: "lo_classical",     label: "クラシカルドール系" },
    { id: "lo_punk",          label: "パンクドール系" },
    { id: "lo_wa",            label: "和ドール系" },
    { id: "lo_country",       label: "カントリードール系" },
    { id: "lo_modern",        label: "モダンドール系" },
    { id: "lo_pink",          label: "ピンクドール系" },
    { id: "lo_black",         label: "黒ドール系" },
    { id: "lo_white",         label: "白ドール系" },
    { id: "lo_victorian",     label: "ヴィクトリアンドール系" },
    { id: "lo_dark",          label: "ダークドール系" },
  ],
  uniform: [
    { id: "uni_sailor",       label: "マリンカレッジスタイル" },
    { id: "uni_gakuran",      label: "クラシックカレッジスタイル" },
    { id: "uni_blazer",       label: "ブレザー制服" },
    { id: "uni_jk_street",    label: "カレッジストリートスタイル" },
    { id: "uni_nurse",        label: "ナース風制服" },
    { id: "uni_pilot",        label: "パイロット制服" },
    { id: "uni_station",      label: "駅員制服風" },
    { id: "uni_police",       label: "警察制服風" },
    { id: "uni_hotel",        label: "ホテル制服風" },
    { id: "uni_maid",         label: "メイド風制服" },
    { id: "uni_chef",         label: "シェフ風制服" },
    { id: "uni_staff",        label: "スタッフ制服風" },
  ],
  idol: [
    { id: "id_stage",         label: "アイドルステージ衣装" },
    { id: "id_mv",            label: "MVドレス系アイドル衣装" },
    { id: "id_jpop",          label: "J-POPアイドル衣装" },
    { id: "id_kpop",          label: "K-POPアイドル衣装" },
    { id: "id_retro",         label: "レトロアイドル衣装" },
    { id: "id_pastel",        label: "パステルアイドル衣装" },
    { id: "id_creative",      label: "クリエイティブアイドル衣装" },
    { id: "id_rock",          label: "ロックアイドル衣装" },
    { id: "id_sweet",         label: "スイートアイドル衣装" },
    { id: "id_mode",          label: "モードアイドル衣装" },
    { id: "id_wa",            label: "和アイドル衣装" },
    { id: "id_tech",          label: "テックアイドル衣装" },
  ],
  runway: [
    { id: "rw_paris",         label: "パリコレランウェイ" },
    { id: "rw_milan",         label: "ミラノコレクション風" },
    { id: "rw_tokyo",         label: "東京コレクション風" },
    { id: "rw_brand",         label: "ハイブランドランウェイ" },
    { id: "rw_avant",         label: "アヴァンギャルドランウェイ" },
    { id: "rw_constructive",  label: "構築的ランウェイ" },
    { id: "rw_sculpture",     label: "彫刻的ランウェイ" },
    { id: "rw_street",        label: "ストリートランウェイ" },
    { id: "rw_minimal",       label: "ミニマルランウェイ" },
    { id: "rw_mono",          label: "モノクロランウェイ" },
    { id: "rw_tech",          label: "テックランウェイ" },
    { id: "rw_baroque",       label: "バロックランウェイ" },
  ],
  future_dress: [
    { id: "fd_hologram",      label: "ホログラムドレス" },
    { id: "fd_liquid_metal",  label: "液体金属ドレス" },
    { id: "fd_nano",          label: "ナノマシン服" },
    { id: "fd_techno",        label: "テクノドレス" },
    { id: "fd_ai_lab",        label: "AIラボドレス" },
    { id: "fd_clean_sf",      label: "クリーンSFドレス" },
    { id: "fd_transparent",   label: "透明素材未来ドレス" },
    { id: "fd_y3k",           label: "Y3Kドレス" },
    { id: "fd_space",         label: "スペースドレス" },
    { id: "fd_bio",           label: "バイオドレス" },
    { id: "fd_minimal",       label: "ミニマル未来ドレス" },
    { id: "fd_constructive",  label: "構築的未来ドレス" },
  ],
  wa_modern: [
    { id: "wm_minimal",       label: "和モダンミニマル" },
    { id: "wm_street",        label: "和×ストリート" },
    { id: "wm_gothic",        label: "和ゴシック" },
    { id: "wm_tech",          label: "和テック" },
    { id: "wm_ad",            label: "和×広告ビジュアル" },
    { id: "wm_industrial",    label: "和×インダストリアル" },
    { id: "wm_kyo",           label: "京モダン" },
    { id: "wm_japandi",       label: "ジャパンディ" },
    { id: "wm_nordic",        label: "和×北欧" },
    { id: "wm_neo",           label: "ネオ和風" },
    { id: "wm_black",         label: "黒和モダン" },
    { id: "wm_white",         label: "白和モダン" },
  ],
};

const POOL_KEYS = new Set(Object.keys(SUB_STYLE_POOLS));

const LARGE_CATEGORY_LABEL: Record<string, string> = {
  street:       "ストリート",
  mode:         "モード",
  cyber:        "サイバー",
  japanese:     "和風",
  gothic:       "ゴシック",
  military:     "ミリタリー",
  techwear:     "テックウェア",
  dress:        "ドレス",
  armor:        "アーマー",
  y2k:          "Y2K",
  lolita:       "ドール系",
  uniform:      "制服",
  idol:         "アイドル衣装",
  runway:       "ランウェイ",
  future_dress: "未来ドレス",
  wa_modern:    "和モダン",
};

// ── 抽選プラン ───────────────────────────────────────────────────────────────

export interface SubStylePlanItem {
  /** 1案ぶんのサブジャンル選定 */
  picks: SubStyleDef[];
}

export interface SubStylePlan {
  /** 元の大カテゴリキー（例：street） */
  styleKey: string;
  /** 大カテゴリの日本語ラベル（例：ストリート）— UI/プロンプト文中での参照用 */
  styleLabel: string;
  /** 各案の抽選結果 */
  items: SubStylePlanItem[];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * サブジャンル展開を適用してよい条件。
 *  - outfit スコープに入っている
 *  - outfit.style が大カテゴリキーかつプールあり
 *  - multiOverrides で2件以上選ばれている場合は適用しない（ユーザーが明示的に複合指定）
 */
export function shouldExpandSubStyles(req: GenerateRequest): boolean {
  if (!req.scopes.includes("outfit")) return false;
  const style = req.details?.outfit?.style;
  if (!style || style === "auto" || style === "skip") return false;
  if (!POOL_KEYS.has(style)) return false;
  const multi = req.details?.multiOverrides?.["outfit.style"];
  if (Array.isArray(multi) && multi.length >= 2) return false;
  return true;
}

/**
 * バッチ計画：各案に 2〜3 個のサブジャンルを抽選する。
 *  - 通常案：2 個
 *  - 神引き（viralMode）：3 個
 *  - 直近使用（recentSubStyles）を優先回避
 *  - 同バッチ内で別案と重複しないよう usedThisBatch を維持
 */
export function planSubStylesForBatch(req: GenerateRequest): SubStylePlan | null {
  if (!shouldExpandSubStyles(req)) return null;
  const style = req.details.outfit.style as string;
  const pool = SUB_STYLE_POOLS[style];
  if (!pool || pool.length === 0) return null;

  const recentIds = new Set((req.recentSubStyles ?? []).map(String));
  const picksPerProposal = req.viralMode === true ? 3 : 2;
  const count = Math.max(1, req.count);

  const usedThisBatch = new Set<string>();
  const items: SubStylePlanItem[] = [];

  for (let i = 0; i < count; i++) {
    // 優先順位: 1) 直近未使用 かつ バッチ未使用 2) 直近使用 かつ バッチ未使用 3) いずれも使用済み
    const tier1 = shuffle(pool.filter((p) => !recentIds.has(p.id) && !usedThisBatch.has(p.id)));
    const tier2 = shuffle(pool.filter((p) =>  recentIds.has(p.id) && !usedThisBatch.has(p.id)));
    const tier3 = shuffle(pool);
    const ordered = [...tier1, ...tier2, ...tier3];

    const picks: SubStyleDef[] = [];
    for (const cand of ordered) {
      if (picks.length >= picksPerProposal) break;
      if (picks.some((p) => p.id === cand.id)) continue;
      picks.push(cand);
    }
    picks.forEach((p) => usedThisBatch.add(p.id));
    items.push({ picks });
  }

  return {
    styleKey:   style,
    styleLabel: LARGE_CATEGORY_LABEL[style] ?? style,
    items,
  };
}

// ── プロンプトブロック ───────────────────────────────────────────────────────

/**
 * サブジャンル展開ブロック。describeDetails の outfit 系統行の代わりに挿入される。
 */
export function subStyleBlock(plan: SubStylePlan): string {
  const lines: string[] = [];
  lines.push("【衣装サブジャンル展開 — 最重要】");
  lines.push(
    `ユーザーは大カテゴリ「${plan.styleLabel}」を選択した。` +
    `ただし「${plan.styleLabel}風」「${plan.styleLabel}スタイル」のような` +
    `大カテゴリ語の単独使用は禁止。必ず以下のサブジャンルを掛け合わせ、` +
    `素材・シルエット・色・質感を具体的に描写すること。`
  );
  lines.push("");
  plan.items.forEach((it, i) => {
    const labels = it.picks.map((p) => p.label).join(" × ");
    lines.push(`  案${i + 1}：${labels}`);
  });
  lines.push("");
  lines.push("▼ 出力ルール：");
  lines.push("  - 各案でサブジャンル名を文章に必ず織り込む（言い換えて消さない）。");
  lines.push(
    `  - 「${plan.styleLabel}」という大カテゴリ語の単独使用は禁止。` +
    `必要なら「${plan.styleLabel}系のサブジャンル」のように具体名と並記する。`
  );
  lines.push("  - 案ごとに素材・色・シルエットを変えて差別化する。");
  lines.push("  - サブジャンル名に含まれる色名（白・黒等）は一例。各案で色は多様に展開してよく、名前の色に固定しない。");
  lines.push("  - サブジャンルの数（2〜3）を同案内で減らさない（全て使い切る）。");
  return lines.join("\n");
}
