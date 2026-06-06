/**
 * 偏り分析エンジン（biasAnalyzer）
 *
 * 現在の生成バッチを直近の履歴と比較し、
 * 「重複度スコア」「新規性スコア」「頻出モチーフ一覧」を返す。
 *
 * スコア計算：複合確率式
 *   duplicateScore = (1 - ∏(1 - freq_i)) × 100
 *   freq_i = historyCount_i / historyTotal  for motifs in current batch
 *
 * 例：3つのモチーフが各 8/20（40%）の頻度で現バッチに含まれている場合
 *   score = (1 - 0.6^3) × 100 ≈ 78 ← ユーザー仕様の想定値と一致
 */

// 監視要素タクソノミー（curated）は data/monitoredMotifs.ts に分離（100+要素・docs/28）。
// 型は当ファイル定義 → データ側は type-only import なので実行時の循環は無い。
import { MONITORED_MOTIFS } from "../data/monitoredMotifs";

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type MotifCategory =
  // A群（造形・好み制御／既存互換）
  | '衣装' | '髪' | 'ポーズ' | '色' | 'ライティング' | 'カメラ' | '演出' | '背景' | '小物'
  // B群（表現スタイル・発見・意外性）
  | '芸術様式' | '建築' | '広告表現' | '映画表現' | '写真表現' | '雑誌表現'
  | '世界観' | '文化圏' | 'プロダクト' | '素材' | '感情トーン' | 'ジャンル' | '時代'
  | 'その他';

export type BiasRisk = 'low' | 'medium' | 'high' | 'danger';

export interface MonitoredMotif {
  readonly id:       string;
  readonly label:    string;
  readonly category: MotifCategory;
  readonly tokens:   readonly string[];
}

export interface HistoryEntry {
  readonly text:     string;
  readonly dateKey?: string;  // YYYY-MM-DD
}

export interface MotifFrequency {
  readonly motif:         MonitoredMotif;
  /** 直近 N 件中、このモチーフを含むもの */
  readonly historyCount:  number;
  /** 分析に使った履歴件数 N */
  readonly historyTotal:  number;
  /** 現在のバッチに含まれているか */
  readonly inCurrentBatch: boolean;
  readonly risk:          BiasRisk;
  /** 最後に出現した日付（YYYY-MM-DD）。履歴がなければ undefined。 */
  readonly lastSeenDate?: string;
}

export interface BiasAnalysisResult {
  readonly duplicateScore: number;   // 0–100
  readonly noveltyScore:   number;   // 0–100
  readonly risk:           BiasRisk;
  /** 出現あり(historyCount > 0 || inCurrentBatch)のモチーフ、頻度降順 */
  readonly topMotifs:      MotifFrequency[];
  /** 現バッチに存在しかつ履歴でも高頻出のモチーフの警告文 */
  readonly warnings:       string[];
  /** 分析に使った履歴件数 */
  readonly checkedCount:   number;
}

// 監視対象モチーフ定義は data/monitoredMotifs.ts に分離（100+要素・docs/28）。
// 後方互換: 既存20IDは新タクソノミー内に保持。biasAnalyzer/historyAnalyzer は本再エクスポートを参照。
export { MONITORED_MOTIFS };

// ── 内部ユーティリティ ────────────────────────────────────────────────────────

function normalizeForSearch(text: string): string {
  return text.toLowerCase().normalize("NFC");
}

export function containsMotif(text: string, motif: MonitoredMotif): boolean {
  const lower = normalizeForSearch(text);
  return motif.tokens.some((t) => lower.includes(normalizeForSearch(t)));
}

// ── 大量走査向け検出（正規化1回化＋hitキャッシュ・docs/28 P1）─────────────────────
// containsMotif と完全に同一判定だが、テキスト/トークンの正規化を再利用することで
// 「監視要素(最大~300) × 履歴(最大1000)」の走査コストを抑える。

/** モチーフ別・正規化済みトークン（モジュール初期化時に1回だけ算出） */
const NORM_MOTIF_TOKENS: ReadonlyArray<{ id: string; tokens: readonly string[] }> =
  MONITORED_MOTIFS.map((m) => ({ id: m.id, tokens: m.tokens.map(normalizeForSearch) }));

/** タクソノミー版数（要素数で代用。変化すれば検出キャッシュを実質無効化） */
const TAXONOMY_VERSION = `v1.${MONITORED_MOTIFS.length}`;

/** テキスト1件に含まれる全監視モチーフIDの集合（テキスト側の正規化も1回だけ） */
export function detectMotifIds(text: string): Set<string> {
  const lower = normalizeForSearch(text);
  const out = new Set<string>();
  for (const m of NORM_MOTIF_TOKENS) {
    for (const t of m.tokens) {
      if (lower.includes(t)) { out.add(m.id); break; }
    }
  }
  return out;
}

// 履歴アイテムの promptText は不変なので (version:id) で結果をメモ化（再分析で再利用）。
// 返す Set は呼び出し側で .has() のみ参照（破壊しない）前提。
const detectCache = new Map<string, Set<string>>();

/** 安定IDを持つテキスト（履歴アイテム）向け：検出結果をキャッシュして再利用する */
export function detectMotifIdsCached(stableId: string, text: string): Set<string> {
  const key = `${TAXONOMY_VERSION}:${stableId}`;
  const cached = detectCache.get(key);
  if (cached) return cached;
  // 異常増加ガード（履歴は想定最大1000程度。上限超過時は作り直す）
  if (detectCache.size > 5000) detectCache.clear();
  const set = detectMotifIds(text);
  detectCache.set(key, set);
  return set;
}

function toMotifRisk(historyCount: number, historyTotal: number): BiasRisk {
  if (historyTotal === 0) return 'low';
  const freq = historyCount / historyTotal;
  if (freq >= 0.40) return 'danger';
  if (freq >= 0.25) return 'high';
  if (freq >= 0.10) return 'medium';
  return 'low';
}

function calcDuplicateScore(motifs: MotifFrequency[]): number {
  // 現バッチに含まれ、かつ履歴での頻度がゼロ以上のモチーフのみが対象
  const hits = motifs.filter((m) => m.inCurrentBatch && m.historyCount > 0);
  if (hits.length === 0) return 0;

  // 複合確率式：score = (1 - ∏(1 - freq_i)) × 100
  // 3モチーフ × freq=0.4 → (1 - 0.6³) × 100 ≈ 78
  let pNone = 1;
  for (const m of hits) {
    const freq = m.historyCount / Math.max(1, m.historyTotal);
    pNone *= (1 - freq);
  }
  return Math.min(100, Math.round(100 * (1 - pNone)));
}

function calcBiasRisk(score: number): BiasRisk {
  if (score >= 75) return 'danger';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

// ── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * 現在の生成バッチと直近の履歴を比較して偏り分析結果を返す。
 *
 * @param currentTexts  今回生成されたプロンプトテキスト（N案分）
 * @param historyEntries 直近の履歴エントリ（通常20件まで）
 */
export function analyzeBias(
  currentTexts: string[],
  historyEntries: HistoryEntry[]
): BiasAnalysisResult {
  const checkedCount = historyEntries.length;
  const historyTexts  = historyEntries.map((e) => e.text);

  // 各モチーフの頻度と現バッチ出現を計算
  const motifFreqs: MotifFrequency[] = MONITORED_MOTIFS.map((motif) => {
    const historyCount  = historyTexts.filter((t) => containsMotif(t, motif)).length;
    const inCurrentBatch = currentTexts.some((t) => containsMotif(t, motif));

    // 最後に出現した日付
    const lastSeenDate = historyEntries
      .filter((e) => containsMotif(e.text, motif))
      .map((e) => e.dateKey)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);

    return {
      motif,
      historyCount,
      historyTotal: checkedCount,
      inCurrentBatch,
      risk: toMotifRisk(historyCount, checkedCount),
      lastSeenDate,
    };
  });

  // 表示対象：履歴またはバッチに出現したものだけ。
  // ソート: (現バッチ AND 履歴あり) → historyCount降順 → inCurrentBatch単独 → 残り
  const relevant = motifFreqs
    .filter((m) => m.historyCount > 0 || m.inCurrentBatch)
    .sort((a, b) => {
      const aPriority = (a.inCurrentBatch && a.historyCount > 0 ? 1000 : 0) + a.historyCount;
      const bPriority = (b.inCurrentBatch && b.historyCount > 0 ? 1000 : 0) + b.historyCount;
      return bPriority - aPriority;
    });

  const duplicateScore = calcDuplicateScore(relevant);
  const noveltyScore   = Math.max(0, Math.round(100 - duplicateScore * 1.1));
  const risk           = calcBiasRisk(duplicateScore);

  // 警告文：現バッチに含まれかつ高頻度のモチーフ名を列挙
  const warnings: string[] = [];
  const concerningHits = relevant.filter(
    (m) => m.inCurrentBatch && (m.risk === 'high' || m.risk === 'danger')
  );
  if (concerningHits.length > 0) {
    const names = concerningHits.slice(0, 3).map((m) => m.motif.label).join('・');
    warnings.push(`${names}が過去の出力と近いです。`);
  }

  return { duplicateScore, noveltyScore, risk, topMotifs: relevant, warnings, checkedCount };
}

// ── UIヘルパー ────────────────────────────────────────────────────────────────

export function biasRiskLabel(risk: BiasRisk): string {
  return { low: '低', medium: '中', high: '高', danger: '危険' }[risk];
}

export function biasRiskTextClass(risk: BiasRisk): string {
  return {
    low:    'text-emerald-400',
    medium: 'text-amber-300',
    high:   'text-orange-400',
    danger: 'text-rose-400',
  }[risk];
}

export function biasRiskBorderClass(risk: BiasRisk): string {
  return {
    low:    'border-emerald-400/40 bg-emerald-400/8',
    medium: 'border-amber-400/40 bg-amber-400/8',
    high:   'border-orange-500/50 bg-orange-400/10',
    danger: 'border-rose-500/60 bg-rose-400/12',
  }[risk];
}

export function categoryColorClass(cat: MotifCategory): string {
  const map: Partial<Record<MotifCategory, string>> = {
    '衣装':       'text-violet-300 border-violet-400/40 bg-violet-400/10',
    '髪':         'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-400/10',
    'ポーズ':     'text-rose-300 border-rose-400/40 bg-rose-400/10',
    '色':         'text-pink-300 border-pink-400/40 bg-pink-400/10',
    'ライティング': 'text-yellow-300 border-yellow-400/40 bg-yellow-400/10',
    'カメラ':     'text-lime-300 border-lime-400/40 bg-lime-400/10',
    '演出':       'text-cyan-300 border-cyan-400/40 bg-cyan-400/10',
    '背景':       'text-sky-300 border-sky-400/40 bg-sky-400/10',
    '小物':       'text-amber-300 border-amber-400/40 bg-amber-400/10',
    '芸術様式':   'text-indigo-300 border-indigo-400/40 bg-indigo-400/10',
    '建築':       'text-slate-300 border-slate-400/40 bg-slate-400/10',
    '広告表現':   'text-orange-300 border-orange-400/40 bg-orange-400/10',
    '映画表現':   'text-red-300 border-red-400/40 bg-red-400/10',
    '写真表現':   'text-teal-300 border-teal-400/40 bg-teal-400/10',
    '雑誌表現':   'text-purple-300 border-purple-400/40 bg-purple-400/10',
    '世界観':     'text-indigo-300 border-indigo-400/40 bg-indigo-400/10',
    '文化圏':     'text-emerald-300 border-emerald-400/40 bg-emerald-400/10',
    'プロダクト': 'text-blue-300 border-blue-400/40 bg-blue-400/10',
    '素材':       'text-stone-300 border-stone-400/40 bg-stone-400/10',
    '感情トーン': 'text-pink-300 border-pink-400/40 bg-pink-400/10',
    'ジャンル':   'text-violet-300 border-violet-400/40 bg-violet-400/10',
    '時代':       'text-amber-300 border-amber-400/40 bg-amber-400/10',
  };
  return map[cat] ?? 'text-text-muted/60 border-text-muted/20 bg-text-muted/5';
}

export function motifRiskDotClass(risk: BiasRisk): string {
  return {
    low:    'bg-emerald-400',
    medium: 'bg-amber-400',
    high:   'bg-orange-500',
    danger: 'bg-rose-500',
  }[risk];
}
