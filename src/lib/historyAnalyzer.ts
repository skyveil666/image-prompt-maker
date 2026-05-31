/**
 * 全履歴分析エンジン (historyAnalyzer)
 *
 * 全生成履歴を分析して「重複分析センター」の表示データを生成する。
 *
 * - 直近500件を対象にモチーフ頻度を集計（全件を常時スキャンすると重い）
 * - ペナルティレベル：none / light / medium / heavy / blocked
 * - auto-NG：heavy/blocked のモチーフは自動でNG候補に入れる（toggle ON時のみ適用）
 * - 傾向レーダー：5つの世界観クラスターで偏りを可視化
 * - 類似履歴：現バッチと2つ以上のモチーフが重なる過去アイテムを抽出
 * - 提案：最も偏ったクラスターの逆方向ジャンルを提案
 */

import type { PromptHistoryItem } from "../types";
import { MONITORED_MOTIFS, containsMotif } from "./biasAnalyzer";
import type { MonitoredMotif } from "./biasAnalyzer";

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type PenaltyLevel = "none" | "light" | "medium" | "heavy" | "blocked";

export interface MotifCount {
  motif: MonitoredMotif;
  /** 分析ウィンドウ内の出現回数 */
  totalCount: number;
  /** 直近50件中の出現回数 */
  recentCount: number;
  /** お気に入り済みアイテムでの出現回数 */
  favoriteCount: number;
  lastSeenDate?: string;
  penaltyLevel: PenaltyLevel;
  /** auto-NG 候補（heavy / blocked 相当の頻度） */
  autoNgCandidate: boolean;
}

export interface SimilarHistoryItem {
  id: string;
  batchId: string;
  dateKey: string;
  createdAt: number;
  /** 現バッチと共通のモチーフラベル一覧 */
  matchedMotifs: string[];
  matchScore: number;
  thumbnail: string | null;
  isFavorite: boolean;
}

interface RadarClusterDef {
  id: string;
  label: string;
  emoji: string;
  motifIds: string[];
}

export interface RadarEntry {
  id: string;
  label: string;
  emoji: string;
  /** ウィンドウ内でのクラスター合計出現回数 */
  count: number;
  /** 0–5 の偏り強度 */
  stars: number;
}

export interface AlternativeSuggestion {
  label: string;
  reason: string;
}

export interface UntappedGenre {
  id: string;
  label: string;
  /** ウィンドウ内での検出回数 */
  detectedCount: number;
  /** 0–100。100に近いほど未開拓（推奨度が高い） */
  untappedScore: number;
}

export interface FullHistoryAnalysis {
  totalItems: number;
  /** モチーフカウントを行った件数（最大500） */
  windowSize: number;
  analyzedAt: number;
  /** 全20モチーフ、totalCount 降順 */
  motifCounts: MotifCount[];
  /** totalCount > 0 のもの */
  topMotifs: MotifCount[];
  /** 現バッチと類似する過去アイテム（上位5件） */
  similarItems: SimilarHistoryItem[];
  radarData: RadarEntry[];
  suggestions: AlternativeSuggestion[];
  /** auto-NG に追加する英語トークン（ユーザーが toggle ON 時に使う） */
  autoNgTokens: string[];
  /** お気に入りに多いモチーフのラベル */
  favoriteMotifs: string[];
  /** 未開拓ジャンル（推奨度の高い順、上位N件） */
  untappedGenres: UntappedGenre[];
  /** AIが分析結果から生成したコメント文（templated） */
  aiComment: string;
  /** 頻出『構成』（2〜3モチーフの組み合わせ）TOP10 */
  topCombos: MotifCombo[];
}

/** 2〜3モチーフの同時出現（構成） */
export interface MotifCombo {
  /** 並び順固定の決定的キー（motifIds.sort().join("|")） */
  comboKey: string;
  /** ソート済みモチーフID */
  motifIds: string[];
  /** 表示用ラベル（motifIds と同順） */
  motifLabels: string[];
  /** 同時出現した履歴件数 */
  count: number;
  /** 該当履歴アイテムID（詳細表示用、最大10件） */
  matchedItemIds: string[];
  /** リスク（出現率ベース） */
  risk: "low" | "medium" | "high" | "danger";
}

// ── 定数 ────────────────────────────────────────────────────────────────────

const ANALYSIS_WINDOW = 500;

/**
 * ペナルティ閾値（ユーザー仕様より）
 * 50回 → light（抽選率 30%）
 * 100回 → medium（10%）
 * 150回 → heavy（5% → auto-NG 候補）
 * 200回 → blocked
 *
 * 比率ベースでもペナルティを発動（小規模履歴への対応）。
 * 例：ウィンドウ 100件 × ratio 0.30 = 30回で heavy
 */
function calcPenalty(count: number, windowSize: number): PenaltyLevel {
  if (windowSize === 0) return "none";
  const ratio = count / windowSize;
  if (count >= 200 || ratio >= 0.40) return "blocked";
  if (count >= 150 || ratio >= 0.30) return "heavy";
  if (count >= 100 || ratio >= 0.20) return "medium";
  if (count >= 50  || ratio >= 0.10) return "light";
  return "none";
}

/**
 * 傾向レーダー用クラスター定義（5種類）
 * モチーフID と MONITORED_MOTIFS.id が一致する。
 */
const RADAR_CLUSTERS: readonly RadarClusterDef[] = [
  {
    id: "dark_gothic", label: "ゴシック/ダーク", emoji: "🌑",
    motifIds: ["gothic_black", "black_outfit", "church_stained", "dark_bg"],
  },
  {
    id: "cyber_sci", label: "サイバー/SF", emoji: "💻",
    motifIds: ["cyber_bg", "hologram_hud", "neon_glow", "blue_purple"],
  },
  {
    id: "fantasy_myth", label: "幻想/神秘", emoji: "✨",
    motifIds: ["crystal", "feathers_wings", "goddess_ethereal", "snow_ice", "light_particles", "petals"],
  },
  {
    id: "dress_fashion", label: "ドレス/衣装偏重", emoji: "👗",
    motifIds: ["dress_general", "white_dress", "transparent_outfit", "long_coat"],
  },
  {
    id: "props_urban", label: "武器/都市系", emoji: "🗡️",
    motifIds: ["sword_katana", "rooftop_urban"],
  },
];

/**
 * 未開拓ジャンル定義
 * 履歴のプロンプトテキストに含まれているかを検出し、未開拓スコアを計算する。
 * varietyEngine（サーバ側）のGENRE_POOLに概ね対応するが、こちらはクライアント側の
 * 文字列検出用にトークンを最適化している。
 */
const UNTAPPED_GENRE_DEFS: ReadonlyArray<{ id: string; label: string; tokens: readonly string[] }> = [
  { id: "luxury_fashion", label: "高級ファッション広告",
    tokens: ["high fashion", "luxury fashion", "editorial fashion", "haute couture",
             "fashion editorial", "brand campaign", "luxury campaign",
             "高級ファッション", "ハイブランド", "ファッション広告"] },
  { id: "sports_luxe", label: "スポーツラグジュアリー",
    tokens: ["sports luxe", "athleisure", "athletic luxury", "performance fashion",
             "tech sportswear", "スポーツラグジュアリー", "アスレジャー"] },
  { id: "minimal_white", label: "ホワイトミニマル",
    tokens: ["white minimal", "minimalist white", "all-white", "white studio",
             "clean white background", "ホワイトミニマル", "白背景ミニマル", "ミニマル白"] },
  { id: "contemporary_art", label: "現代アート",
    tokens: ["contemporary art", "modern art", "art installation", "fine art",
             "white cube gallery", "現代アート", "現代美術", "コンテンポラリーアート"] },
  { id: "magazine_cover", label: "雑誌表紙",
    tokens: ["magazine cover", "editorial cover", "magazine layout",
             "vogue style", "fashion magazine",
             "雑誌表紙", "雑誌風", "マガジンカバー"] },
  { id: "movie_poster", label: "映画ポスター",
    tokens: ["movie poster", "film poster", "cinematic poster", "key visual",
             "映画ポスター", "ムービーポスター", "映画ビジュアル"] },
  { id: "wa_modern", label: "和モダン",
    tokens: ["wa modern", "japanese modern", "modern japanese", "japandi",
             "和モダン", "ジャパンディ", "和洋折衷"] },
  { id: "industrial", label: "工業地帯",
    tokens: ["industrial", "factory interior", "warehouse", "industrial zone",
             "工業地帯", "工場", "倉庫", "プラント"] },
  { id: "greenhouse", label: "温室植物園",
    tokens: ["greenhouse", "botanical garden", "conservatory", "tropical greenhouse",
             "plant filled space",
             "温室", "植物園", "ボタニカル"] },
  { id: "underwater", label: "水中幻想",
    tokens: ["underwater", "submerged", "aquatic scene",
             "水中", "水中幻想", "水の中"] },
  { id: "apparel_lookbook", label: "アパレルLOOKBOOK",
    tokens: ["lookbook", "look book", "apparel campaign", "fashion lookbook",
             "LOOKBOOK", "ルックブック", "アパレル"] },
  { id: "architecture", label: "建築写真",
    tokens: ["architecture", "architectural photography", "brutalist", "geometric architecture",
             "建築写真", "建築物", "モダン建築"] },
];

/** 各クラスターが強い場合の逆方向提案 */
const OPPOSITE_MAP: Readonly<Record<string, string[]>> = {
  dark_gothic:    ["高級ファッション広告", "白背景ミニマル", "和モダン", "スポーツラグジュアリー", "温室植物園"],
  cyber_sci:      ["温室植物園", "和モダン", "美術館展示", "レトロ", "雪景色"],
  fantasy_myth:   ["工業地帯", "現代アート", "ストリート", "広告ビジュアル", "建築写真"],
  dress_fashion:  ["ポーズ/動き強化", "カメラアングル変更", "前景演出重視", "小物使い"],
  props_urban:    ["温室/植物系", "インテリア写真", "高級スタジオ", "アパレルLOOK"],
};

// ── ユーティリティ ────────────────────────────────────────────────────────────

function ratioToStars(count: number, windowSize: number): number {
  if (windowSize === 0 || count === 0) return 0;
  const r = count / windowSize;
  if (r >= 0.35) return 5;
  if (r >= 0.20) return 4;
  if (r >= 0.12) return 3;
  if (r >= 0.06) return 2;
  if (r >= 0.01) return 1;
  return 0;
}

/**
 * 未開拓ジャンルを検出してスコア付きで返す。
 * 出現頻度を「未使用度 = 100 - ratio×500」で計算（5% 出現 → 75点）。
 * 出現が少ないほど高スコアになる。
 */
function detectUntappedGenres(historyTexts: string[], windowSize: number): UntappedGenre[] {
  if (windowSize === 0) {
    return UNTAPPED_GENRE_DEFS.map((g) => ({
      id: g.id, label: g.label, detectedCount: 0, untappedScore: 100,
    }));
  }
  const lowered = historyTexts.map((t) => t.toLowerCase().normalize("NFC"));
  return UNTAPPED_GENRE_DEFS.map((g) => {
    const detectedCount = lowered.filter((text) =>
      g.tokens.some((tok) => text.includes(tok.toLowerCase().normalize("NFC")))
    ).length;
    const ratio = detectedCount / windowSize;
    const untappedScore = Math.max(0, Math.min(100, Math.round(100 - ratio * 500)));
    return { id: g.id, label: g.label, detectedCount, untappedScore };
  }).sort((a, b) => b.untappedScore - a.untappedScore);
}

/**
 * 頻出『構成』TOP10 検出。
 * 各履歴アイテムで検出されたモチーフから 2〜3個の組み合わせを生成し、
 * 同時出現が多いものを集計する。サブセット重複は除外（三つ組が選ばれていれば
 * 含まれる二つ組は表示しない）。
 */
function detectTopCombos(
  window: PromptHistoryItem[],
  itemMotifIds: Map<string, Set<string>>,
  windowSize: number
): MotifCombo[] {
  if (window.length < 2) return [];

  type Acc = { ids: string[]; itemIds: string[] };
  const counter = new Map<string, Acc>();
  const MAX_PER_ITEM = 4; // 1アイテムから組み合わせ爆発を避ける

  for (const item of window) {
    const set = itemMotifIds.get(item.id);
    if (!set || set.size < 2) continue;
    const sorted = [...set].sort();
    const top = sorted.slice(0, MAX_PER_ITEM); // 上位だけで組み合わせを作る

    // 2つ組
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const key = `${top[i]}|${top[j]}`;
        const e = counter.get(key) ?? { ids: [top[i], top[j]], itemIds: [] };
        e.itemIds.push(item.id);
        counter.set(key, e);
      }
    }
    // 3つ組（3つ以上検出された時のみ）
    if (top.length >= 3) {
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          for (let k = j + 1; k < top.length; k++) {
            const key = `${top[i]}|${top[j]}|${top[k]}`;
            const e = counter.get(key) ?? { ids: [top[i], top[j], top[k]], itemIds: [] };
            e.itemIds.push(item.id);
            counter.set(key, e);
          }
        }
      }
    }
  }

  // 集計：≥2回 のみ。三つ組を優先（同件数なら三つ組が先）
  const idToLabel = new Map(MONITORED_MOTIFS.map((m) => [m.id, m.label]));
  const all: MotifCombo[] = [];
  for (const [comboKey, e] of counter) {
    if (e.itemIds.length < 2) continue;
    const ratio = windowSize > 0 ? e.itemIds.length / windowSize : 0;
    const risk: MotifCombo["risk"] =
      ratio >= 0.10 ? "danger" : ratio >= 0.06 ? "high" : ratio >= 0.03 ? "medium" : "low";
    all.push({
      comboKey,
      motifIds: e.ids,
      motifLabels: e.ids.map((id) => idToLabel.get(id) ?? id),
      count: e.itemIds.length,
      matchedItemIds: e.itemIds.slice(0, 10),
      risk,
    });
  }
  // 件数優先＋三つ組ボーナス（同件数で三つ組を先に）
  all.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.motifIds.length - a.motifIds.length;
  });

  // サブセット重複除去：既に選ばれた構成の部分集合は表示しない
  const final: MotifCombo[] = [];
  for (const c of all) {
    const setC = new Set(c.motifIds);
    const isSubset = final.some((prev) => {
      if (c.motifIds.length >= prev.motifIds.length) return false;
      return c.motifIds.every((id) => prev.motifIds.includes(id));
    });
    if (isSubset) continue;
    // 逆に、既に同サイズの上位がスーパーセットの場合もスキップ
    // （ただし、上で件数降順なので、上位は既に「より頻出」＝同等以上なら上位を残す）
    final.push(c);
    if (final.length >= 10) break;
    void setC;
  }
  return final;
}

/**
 * AI分析コメントを生成（template-based、LLM不使用）。
 * 入力データに応じて自然な日本語の所見文を組み立てる。
 */
function generateAiComment(
  topMotifs: MotifCount[],
  radarData: RadarEntry[],
  untappedGenres: UntappedGenre[],
  windowSize: number
): string {
  if (windowSize < 3) {
    return "まだ分析対象の履歴が少ないため、もう少し生成すると傾向が見えてきます。";
  }
  const parts: string[] = [];

  // パターン1: トップ2モチーフの組み合わせを指摘
  const hits = topMotifs.filter((mc) => mc.totalCount > 0);
  if (hits.length >= 2) {
    parts.push(`${hits[0].motif.label}＋${hits[1].motif.label}の組み合わせが頻発しています。`);
  } else if (hits.length === 1) {
    parts.push(`${hits[0].motif.label}が頻出しています。`);
  } else {
    parts.push("特定モチーフへの目立った偏りは見られません。");
  }

  // パターン2: クラスター偏り
  const topCluster = radarData.find((r) => r.stars >= 2);
  if (topCluster) {
    const traits = hits.slice(0, 4).map((m) => m.motif.label).join("・");
    if (traits) {
      parts.push(`現在の生成傾向は ${traits} に偏っています。`);
    } else {
      parts.push(`${topCluster.label}寄りの傾向が出ています。`);
    }
  }

  // パターン3: 未開拓ジャンルの推奨
  const topUntapped = untappedGenres.filter((g) => g.untappedScore >= 80).slice(0, 4);
  if (topUntapped.length > 0) {
    parts.push(`次回は ${topUntapped.map((g) => g.label).join("・")} を推奨します。`);
  }

  return parts.join("\n\n");
}

function formatDate(createdAt: number): string {
  const d = new Date(createdAt);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mo}/${day} ${hh}:${mm}`;
}

// ── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * 全生成履歴を分析して重複分析センターのデータを返す。
 *
 * @param allItems     IndexedDB から取得した全履歴
 * @param currentTexts 現在の生成バッチのテキスト（空配列の場合は類似履歴なし）
 */
export function analyzeFullHistory(
  allItems: PromptHistoryItem[],
  currentTexts: string[] = []
): FullHistoryAnalysis {
  const totalItems = allItems.length;

  // 直近 N 件を対象にする（重い処理を避けるため）
  const sorted = [...allItems].sort((a, b) => b.createdAt - a.createdAt);
  const window = sorted.slice(0, ANALYSIS_WINDOW);
  const windowSize = window.length;

  // ── 1. 各ヒストリーアイテムのモチーフを検出（後でループを減らすために先に計算）
  const itemMotifIds: Map<string, Set<string>> = new Map();
  for (const item of window) {
    const detected = new Set<string>();
    for (const motif of MONITORED_MOTIFS) {
      if (containsMotif(item.promptText, motif)) detected.add(motif.id);
    }
    itemMotifIds.set(item.id, detected);
  }

  // ── 2. モチーフ頻度カウント
  const RECENT_WINDOW = 50;
  const motifCounts: MotifCount[] = MONITORED_MOTIFS.map((motif) => {
    let totalCount = 0;
    let recentCount = 0;
    let favoriteCount = 0;
    let lastSeenDate: string | undefined;

    for (let i = 0; i < window.length; i++) {
      const item = window[i];
      if (itemMotifIds.get(item.id)?.has(motif.id)) {
        totalCount++;
        if (i < RECENT_WINDOW) recentCount++;
        if (item.isFavorite) favoriteCount++;
        if (!lastSeenDate) lastSeenDate = item.dateKey;
      }
    }

    const penaltyLevel = calcPenalty(totalCount, windowSize);
    return {
      motif,
      totalCount,
      recentCount,
      favoriteCount,
      lastSeenDate,
      penaltyLevel,
      autoNgCandidate: penaltyLevel === "heavy" || penaltyLevel === "blocked",
    };
  }).sort((a, b) => b.totalCount - a.totalCount);

  // ── 3. 現バッチのモチーフセット
  const currentBatchMotifIds = new Set<string>();
  for (const text of currentTexts) {
    for (const motif of MONITORED_MOTIFS) {
      if (containsMotif(text, motif)) currentBatchMotifIds.add(motif.id);
    }
  }

  // ── 4. 類似履歴（現バッチと2つ以上共通するモチーフを持つ過去アイテム）
  const similarItems: SimilarHistoryItem[] = [];
  if (currentBatchMotifIds.size >= 1) {
    const scored: Array<{ item: PromptHistoryItem; matched: string[]; score: number }> = [];
    for (const item of window) {
      const itemSet = itemMotifIds.get(item.id) ?? new Set();
      const matched: string[] = [];
      for (const motifId of currentBatchMotifIds) {
        if (itemSet.has(motifId)) {
          const m = MONITORED_MOTIFS.find((x) => x.id === motifId);
          if (m) matched.push(m.label);
        }
      }
      if (matched.length >= 2) {
        scored.push({ item, matched, score: matched.length });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    for (const { item, matched, score } of scored.slice(0, 5)) {
      similarItems.push({
        id: item.id,
        batchId: item.batchId,
        dateKey: formatDate(item.createdAt),
        createdAt: item.createdAt,
        matchedMotifs: matched,
        matchScore: score,
        thumbnail: item.sourceImageThumbnail ?? null,
        isFavorite: item.isFavorite,
      });
    }
  }

  // ── 5. 傾向レーダー
  const mcById = new Map(motifCounts.map((mc) => [mc.motif.id, mc]));
  const radarData: RadarEntry[] = RADAR_CLUSTERS.map((cluster) => {
    const count = cluster.motifIds
      .map((id) => mcById.get(id)?.totalCount ?? 0)
      .reduce((a, b) => a + b, 0);
    const stars = ratioToStars(count, windowSize * cluster.motifIds.length);
    return { id: cluster.id, label: cluster.label, emoji: cluster.emoji, count, stars };
  }).sort((a, b) => b.count - a.count);

  // ── 6. 逆方向提案
  const topCluster = radarData.find((r) => r.stars >= 2);
  const suggestions: AlternativeSuggestion[] = topCluster
    ? (OPPOSITE_MAP[topCluster.id] ?? []).slice(0, 4).map((label) => ({
        label,
        reason: `${topCluster.label}への偏りを検出`,
      }))
    : [];

  // ── 7. Auto-NG トークン（heavy / blocked モチーフのトークンを収集）
  const autoNgTokenSet = new Set<string>();
  for (const mc of motifCounts) {
    if (mc.autoNgCandidate) {
      for (const token of mc.motif.tokens) autoNgTokenSet.add(token);
    }
  }
  const autoNgTokens = [...autoNgTokenSet];

  // ── 8. お気に入りモチーフ
  const favoriteMotifs = motifCounts
    .filter((mc) => mc.favoriteCount >= 2)
    .slice(0, 5)
    .map((mc) => mc.motif.label);

  // ── 9. 未開拓ジャンル
  const untappedGenres = detectUntappedGenres(
    window.map((it) => it.promptText),
    windowSize
  );

  const topMotifsFiltered = motifCounts.filter((mc) => mc.totalCount > 0);

  // ── 10. AIコメント
  const aiComment = generateAiComment(topMotifsFiltered, radarData, untappedGenres, windowSize);

  // ── 11. 頻出『構成』TOP10（2〜3モチーフ同時出現）
  const topCombos = detectTopCombos(window, itemMotifIds, windowSize);

  return {
    totalItems,
    windowSize,
    analyzedAt: Date.now(),
    motifCounts,
    topMotifs: topMotifsFiltered,
    similarItems,
    radarData,
    suggestions,
    autoNgTokens,
    favoriteMotifs,
    untappedGenres,
    aiComment,
    topCombos,
  };
}

// ── UIヘルパー ────────────────────────────────────────────────────────────────

export function penaltyLabel(level: PenaltyLevel): string {
  return { none: "—", light: "軽微", medium: "中", heavy: "高", blocked: "制限中" }[level];
}

export function penaltyColorClass(level: PenaltyLevel): string {
  // ピル表示（文字＋枠＋背景）で黒背景でもはっきり読めるよう明るめに
  return {
    none:    "text-slate-400 border-transparent",
    light:   "text-cyan-200 border-cyan-400/50 bg-cyan-400/15",
    medium:  "text-amber-100 border-amber-400/55 bg-amber-400/20",
    heavy:   "text-orange-100 border-orange-400/60 bg-orange-500/25",
    blocked: "text-rose-100 border-rose-400/60 bg-rose-500/25",
  }[level];
}

export function starsLabel(stars: number): string {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}
