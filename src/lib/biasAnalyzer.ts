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

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type MotifCategory =
  | '衣装' | '背景' | '色' | '演出' | '小物' | '世界観' | 'その他';

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

// ── 監視対象モチーフ定義（20件）────────────────────────────────────────────────

export const MONITORED_MOTIFS: readonly MonitoredMotif[] = [
  // ── 衣装 ──────────────────────────────────────────────────────────────────
  {
    id: 'gothic_black', label: '黒ゴシック衣装', category: '衣装',
    tokens: [
      'gothic', 'dark gothic', 'gothic dress', 'gothic outfit', 'gothic aesthetic',
      'gothic costume', 'gothic lolita', 'gothic style', 'black gothic',
      'ゴシック', '黒ゴシック', 'gothic fashion',
    ],
  },
  {
    id: 'black_outfit', label: '黒系衣装', category: '衣装',
    tokens: [
      'black outfit', 'black dress', 'black clothing', 'black coat',
      'all-black outfit', 'dark outfit', 'black jacket',
      '黒衣装', '黒い衣装', '黒系衣装',
    ],
  },
  {
    id: 'dress_general', label: 'ドレス全般', category: '衣装',
    tokens: [
      'dress', 'gown', 'princess dress', 'ball gown', 'flowing dress',
      'elaborate dress', 'goddess dress',
      'ドレス', 'フレアドレス', 'ドレス系',
    ],
  },
  {
    id: 'white_dress', label: '白ドレス・白ワンピ', category: '衣装',
    tokens: [
      'white dress', 'white gown', 'white one-piece', 'flowing white dress',
      'white flowing dress', 'white elegant dress',
      '白ドレス', '白ワンピ', '白いドレス',
    ],
  },
  {
    id: 'transparent_outfit', label: '透明素材衣装', category: '衣装',
    tokens: [
      'transparent', 'see-through', 'pvc dress', 'translucent fabric',
      'clear material', 'sheer fabric', 'transparent dress',
      '透明素材', '透け素材', 'PVC',
    ],
  },
  {
    id: 'long_coat', label: 'ロングコート', category: '衣装',
    tokens: [
      'long coat', 'trench coat', 'long black coat', 'duster coat',
      'long overcoat', 'flowing coat',
      'ロングコート', 'ロングジャケット',
    ],
  },
  // ── 背景 ──────────────────────────────────────────────────────────────────
  {
    id: 'cyber_bg', label: 'サイバー・ネオン都市', category: '背景',
    tokens: [
      'cyberpunk city', 'cyber city', 'neon city', 'neon-lit street',
      'futuristic city', 'city skyline neon', 'digital city',
      'サイバー', 'ネオン都市', 'サイバーパンク', '電脳都市',
    ],
  },
  {
    id: 'church_stained', label: '教会・ステンドグラス', category: '背景',
    tokens: [
      'church', 'stained glass', 'cathedral', 'chapel', 'gothic church',
      'cathedral interior', 'church window',
      '教会', 'ステンドグラス', '大聖堂',
    ],
  },
  {
    id: 'rooftop_urban', label: '屋上・地下・駐車場', category: '背景',
    tokens: [
      'rooftop', 'skyscraper rooftop', 'underground', 'parking lot',
      'basement', 'underground garage', 'parking garage',
      '屋上', '地下駐車場', '地下', 'ルーフトップ',
    ],
  },
  {
    id: 'dark_bg', label: '暗い・黒背景', category: '背景',
    tokens: [
      'dark background', 'black background', 'dark void', 'pitch black background',
      'dark space', 'black space',
      '黒背景', '暗い背景', 'ダーク背景',
    ],
  },
  // ── 色 ─────────────────────────────────────────────────────────────────────
  {
    id: 'blue_purple', label: '青紫配色', category: '色',
    tokens: [
      'blue-purple', 'cyan purple', 'blue violet', 'purple and cyan',
      'teal and violet', 'blue purple neon', 'cyan-violet', 'indigo violet',
      '青紫', 'シアン紫', '青系紫',
    ],
  },
  // ── 演出 ──────────────────────────────────────────────────────────────────
  {
    id: 'neon_glow', label: 'ネオン発光', category: '演出',
    tokens: [
      'neon glow', 'neon light', 'neon sign', 'neon-lit', 'led strip',
      'glowing neon', 'neon tube',
      'ネオン', 'ネオン発光', 'ネオン光',
    ],
  },
  {
    id: 'crystal', label: 'クリスタル・結晶', category: '演出',
    tokens: [
      'crystal', 'crystal orb', 'glowing crystal', 'ice crystal', 'crystal shard',
      'crystal formation', 'gem crystal', 'crystal background',
      'クリスタル', '結晶', '水晶', '氷結晶',
    ],
  },
  {
    id: 'hologram_hud', label: 'ホログラム・HUD', category: '演出',
    tokens: [
      'hologram', 'holographic', 'hud display', 'holographic ui',
      'cyber interface', 'floating screen', 'digital panel', 'ar overlay',
      'ホログラム', 'HUD', 'ホログラフィック',
    ],
  },
  {
    id: 'snow_ice', label: '雪・氷演出', category: '演出',
    tokens: [
      'snow', 'snowflakes', 'ice', 'frozen', 'icy', 'blizzard',
      'snow particles', 'falling snow', 'ice crystals',
      '雪', '氷', '雪エフェクト', '吹雪', '雪の結晶',
    ],
  },
  {
    id: 'feathers_wings', label: '羽・翼', category: '演出',
    tokens: [
      'feathers', 'wings', 'angel wings', 'transparent wings', 'feather particles',
      'floating feathers', 'wing motif', 'gossamer wings',
      '羽', '翼', '天使の羽', '羽根', '羽エフェクト',
    ],
  },
  {
    id: 'petals', label: '花びら', category: '演出',
    tokens: [
      'petals', 'flower petals', 'sakura', 'cherry blossoms', 'rose petals',
      'falling petals', 'petal shower',
      '花びら', '桜', '花弁', '散る花びら',
    ],
  },
  {
    id: 'light_particles', label: '発光粒子', category: '演出',
    tokens: [
      'light particles', 'glowing particles', 'particle effects', 'floating particles',
      'sparkling particles', 'golden particles', 'magical particles',
      '発光粒子', '光の粒子', '輝く粒', '光粒',
    ],
  },
  // ── 小物 ──────────────────────────────────────────────────────────────────
  {
    id: 'sword_katana', label: '刀・剣', category: '小物',
    tokens: [
      'katana', 'sword', 'blade', 'neon sword', 'glowing sword',
      'energy sword', 'samurai sword', 'katana blade',
      '刀', '剣', '刀剣', 'ネオン刀', '発光剣',
    ],
  },
  // ── 世界観 ────────────────────────────────────────────────────────────────
  {
    id: 'goddess_ethereal', label: '女神・天使系', category: '世界観',
    tokens: [
      'goddess', 'celestial', 'angelic', 'ethereal', 'divine',
      'angel aesthetic', 'heavenly', 'seraphic',
      '女神', '天使', '神々しい', '天上的', '幻想的な神',
    ],
  },
];

// ── 内部ユーティリティ ────────────────────────────────────────────────────────

function normalizeForSearch(text: string): string {
  return text.toLowerCase().normalize("NFC");
}

export function containsMotif(text: string, motif: MonitoredMotif): boolean {
  const lower = normalizeForSearch(text);
  return motif.tokens.some((t) => lower.includes(normalizeForSearch(t)));
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
  return {
    '衣装':   'text-violet-300 border-violet-400/40 bg-violet-400/10',
    '背景':   'text-sky-300   border-sky-400/40    bg-sky-400/10',
    '色':     'text-pink-300  border-pink-400/40   bg-pink-400/10',
    '演出':   'text-cyan-300  border-cyan-400/40   bg-cyan-400/10',
    '小物':   'text-amber-300 border-amber-400/40  bg-amber-400/10',
    '世界観': 'text-indigo-300 border-indigo-400/40 bg-indigo-400/10',
    'その他': 'text-text-muted/60 border-text-muted/20 bg-text-muted/5',
  }[cat];
}

export function motifRiskDotClass(risk: BiasRisk): string {
  return {
    low:    'bg-emerald-400',
    medium: 'bg-amber-400',
    high:   'bg-orange-500',
    danger: 'bg-rose-500',
  }[risk];
}
