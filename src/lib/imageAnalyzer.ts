/**
 * 画像分析エンジン（生成結果登録済みの画像に対する重複検出 + 出現率集計）。
 *
 * 設計方針（コスト現実主義）：
 *   - 真の Vision API 呼び出しは行わない（毎画像コストが高すぎるため）
 *   - 代わりに **perceptual hash (dHash 64bit)** で視覚的類似性を検出
 *   - **構造化 details（PromptHistoryItem.details）** からカテゴリ出現率を集計
 *
 * このアプローチで「文章は違うが画像が似ている」ケースを捕捉できる。
 *   例：「高級ホテル」と「ラグジュアリーロビー」が視覚的に同じ場合、
 *       両方の dHash が近く、同一クラスタとして検出される。
 */
import type { PromptHistoryItem } from "../types";
import { put, getAll as idbGetAll, STORE_IMAGE_FEATURES } from "./idb";
import { getResultImages } from "./history";

/** 解析対象の画像（1アイテムにつき最初の登録画像のみ）を取得。
 *  複数枚登録されていてもクラスタリング自体は単純化のため代表1枚で行う。 */
export function primaryResultImage(item: PromptHistoryItem): string | null {
  const imgs = getResultImages(item);
  return imgs.length > 0 ? imgs[0] : null;
}

// ── 型 ──────────────────────────────────────────────────────────────────────

/** 画像特徴DB の 1 レコード */
export interface ImageFeature {
  /** 履歴アイテムID（PromptHistoryItem.id） */
  id: string;
  /** dHash 64bit を 16進文字列で（16文字） */
  hash: string;
  /** バッチID（クラスタ判定で同バッチをまとめないため） */
  batchId: string;
  analyzedAt: number;
}

export interface ImageCluster {
  /** クラスタを構成するアイテムID（時系列降順、ハッシュ距離 <= THRESHOLD） */
  itemIds: string[];
  /** クラスタ代表（先頭の hash） */
  representativeHash: string;
  /** 代表サムネイル（先頭アイテムの resultImageData） */
  representativeThumb: string | null;
  /** 構成枚数 */
  size: number;
}

export interface CategoryRate {
  label: string;
  count: number;
  ratio: number;
}

export interface PerItemScore {
  /** 0-100：未開拓度（クラスタに属さない＝高い） */
  novelty: number;
  /** 0-100：重複度（クラスタサイズが大きいほど高い） */
  duplication: number;
  /** 0-100：偏り度（属する詳細カテゴリの頻度に比例） */
  bias: number;
}

export interface ImageAnalysisResult {
  /** 解析対象件数（resultImageData が null でない件数） */
  totalEligible: number;
  /** 実際に解析完了した件数 */
  totalAnalyzed: number;
  /** 視覚的に類似した画像のクラスタ（size>=2、サイズ降順 TOP20） */
  clusters: ImageCluster[];
  /** クラスタに属さない単独画像の数 */
  uniqueCount: number;
  /** カテゴリ別出現率 */
  backgroundRates:  CategoryRate[];
  outfitRates:      CategoryRate[];
  hairRates:        CategoryRate[];
  cameraRates:      CategoryRate[];
  lightingRates:    CategoryRate[];
  /** TOP3 カテゴリ（頻出） */
  overusedCategories: { axis: string; label: string; ratio: number }[];
  /** 未使用カテゴリ（このウィンドウで出ていない選択肢） */
  underusedCategories: { axis: string; label: string }[];
  /** アイテム単位のスコア */
  itemScores: Map<string, PerItemScore>;
}

// ── dHash 64bit の計算 ─────────────────────────────────────────────────────

const HASH_W = 9;  // 横9、隣接比較で 8 になる
const HASH_H = 8;
const CLUSTER_DISTANCE_THRESHOLD = 10;  // 64bit中 10 までを類似とみなす

/** data URL → 9x8 grayscale 配列 */
function loadAndDownscale(dataUrl: string): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = HASH_W;
        canvas.height = HASH_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas 2d unavailable"));
        ctx.drawImage(img, 0, 0, HASH_W, HASH_H);
        const data = ctx.getImageData(0, 0, HASH_W, HASH_H).data;
        // RGBA → grayscale
        const gray = new Uint8ClampedArray(HASH_W * HASH_H);
        for (let i = 0; i < HASH_W * HASH_H; i++) {
          const r = data[i * 4 + 0];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          gray[i] = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
        }
        resolve(gray);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}

/** dHash 64bit を 16進文字列で返す */
async function computeHash(dataUrl: string): Promise<string> {
  const gray = await loadAndDownscale(dataUrl);
  let bits = 0n;
  let bit = 0;
  for (let y = 0; y < HASH_H; y++) {
    for (let x = 0; x < HASH_W - 1; x++) {
      const left  = gray[y * HASH_W + x];
      const right = gray[y * HASH_W + x + 1];
      if (left > right) bits |= 1n << BigInt(bit);
      bit++;
    }
  }
  // 16進16文字に
  return bits.toString(16).padStart(16, "0");
}

// loadDominantColors / loadBrightness は削除（ImageFeature.dominantColors/brightness は
// どこからも読まれていなかったため。クラスタリングは hash のみ使用＝毎画像の canvas描画2回＋
// ピクセル走査2回を削減）。

/** 16進ハッシュ → BigInt */
function hashToBig(hex: string): bigint {
  return BigInt("0x" + hex);
}

/** 2つの hash 間の Hamming 距離 */
export function hammingDistance(h1: string, h2: string): number {
  let x = hashToBig(h1) ^ hashToBig(h2);
  let count = 0;
  while (x > 0n) {
    if (x & 1n) count++;
    x >>= 1n;
  }
  return count;
}

// ── 1アイテムの解析 ─────────────────────────────────────────────────────

/**
 * 1つの履歴アイテムから ImageFeature を計算（resultImageData が必要）。
 * 既にキャッシュがあればそれを返す。
 */
export async function analyzeOne(
  item: PromptHistoryItem,
  cached: Map<string, ImageFeature>,
): Promise<ImageFeature | null> {
  const primary = primaryResultImage(item);
  if (!primary) return null;
  const existing = cached.get(item.id);
  if (existing) return existing;

  try {
    const hash = await computeHash(primary);
    const f: ImageFeature = {
      id: item.id,
      hash,
      batchId: item.batchId,
      analyzedAt: Date.now(),
    };
    // IDB へ保存（非同期、エラーは無視）
    void put(STORE_IMAGE_FEATURES, f).catch(() => { /* noop */ });
    return f;
  } catch {
    return null;
  }
}

/** 既存キャッシュ全件ロード */
export async function loadAllFeatures(): Promise<ImageFeature[]> {
  try {
    return await idbGetAll(STORE_IMAGE_FEATURES) as ImageFeature[];
  } catch {
    return [];
  }
}

// ── クラスタリング ──────────────────────────────────────────────────────

/**
 * dHash でクラスタリング。
 * - 距離 <= THRESHOLD で union-find
 * - 同一 batchId は別アイテムでも同じバッチ生成なので同クラスタにまとめる
 */
function clusterByHash(features: ImageFeature[]): Map<number, number[]> {
  const n = features.length;
  const parent = new Array(n).fill(0).map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const nx = parent[x];
      parent[x] = r;
      x = nx;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = hammingDistance(features[i].hash, features[j].hash);
      if (d <= CLUSTER_DISTANCE_THRESHOLD) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  return groups;
}

// ── カテゴリ出現率（details から集計） ─────────────────────────────────

const SKIP_VALUES = new Set(["auto", "skip", "", null, undefined]);

function isMeaningful(v: unknown): v is string {
  return typeof v === "string" && !SKIP_VALUES.has(v);
}

/**
 * 単一フィールドの出現率を集計（auto/skip を除外）。
 * 全候補のうち1度も出ていないものを「未使用」として返す側で活用。
 */
function aggregateField<T extends string>(
  items: PromptHistoryItem[],
  picker: (it: PromptHistoryItem) => T | null | undefined,
  labelMap?: Record<string, string>,
): { rates: CategoryRate[]; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const it of items) {
    const v = picker(it);
    if (!isMeaningful(v)) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    total++;
  }
  const rates: CategoryRate[] = Array.from(counts.entries())
    .map(([k, c]) => ({
      label: labelMap?.[k] ?? k,
      count: c,
      ratio: total > 0 ? c / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { rates, total };
}

// ── ラベルマップ（UI 表示用） ─────────────────────────────────────────

const BG_PLACE_JP: Record<string, string> = {
  indoor: "屋内", alley: "路地", futuristic: "未来的", abstract: "抽象",
  nature: "自然", museum: "美術館", industrial: "工業", gallery: "ギャラリー",
  atelier: "アトリエ", japanese_room: "和室", garden: "庭園", seaside: "海辺",
  forest: "森", empty_space: "余白空間", studio: "スタジオ",
  paper_backdrop: "紙背景", fabric_backdrop: "布背景",
  old_cinema: "古い映画館", greenhouse: "温室", rooftop: "屋上",
  library: "図書館", rainy_station: "雨の駅", night_amusement: "夜の遊園地",
  frosted_room: "霜の部屋",
};

const OUTFIT_STYLE_JP: Record<string, string> = {
  street: "ストリート", mode: "モード", cyber: "サイバー",
  japanese: "和風", gothic: "ゴシック", military: "ミリタリー",
  techwear: "テックウェア", dress: "ドレス", armor: "アーマー",
  y2k: "Y2K", lolita: "ロリータ", uniform: "制服",
  future_dress: "未来ドレス", wa_modern: "和モダン", idol: "アイドル",
  runway: "ランウェイ",
};

const HAIR_STYLE_JP: Record<string, string> = {
  modern: "モダン", y2k: "Y2K", heisei_gal: "平成ギャル",
  retro: "レトロ", showa_idol: "昭和アイドル", taisho_roman: "大正ロマン",
  wa_gothic: "和ゴシック", cyberpunk: "サイバーパンク",
  near_future: "近未来", magical_girl: "魔法少女",
  gothic_lolita: "ゴシックロリ", street: "ストリート",
  korean: "韓国系", anime: "アニメ", doll: "ドール",
  viral: "バズ系", unique: "ユニーク",
};

const CAMERA_ANGLE_JP: Record<string, string> = {
  front: "正面", diagonal_45: "斜め45°", low: "ローアングル",
  high: "ハイアングル", top_down: "真上", side_profile: "横顔",
  over_shoulder: "肩越し", close_portrait: "アップ",
  full_body: "全身", dutch: "ダッチ", cinematic: "シネマ",
  diagonal_high: "斜め俯瞰", back_view: "後ろ姿",
};

const LIGHTING_DIR_JP: Record<string, string> = {
  top: "トップ", side: "サイド", back: "バック", front: "フロント",
  below: "下方", multi: "マルチ", rim: "リム",
  diagonal_above: "斜め上", window: "窓光", spot: "スポット",
  ambient: "環境光",
};

// ── 全体解析 ────────────────────────────────────────────────────────

/**
 * 履歴 + 既存特徴キャッシュから ImageAnalysisResult を組み立てる。
 *
 * @param items   履歴アイテム（時系列降順 or 昇順どちらでも可）
 * @param featuresMap  itemId → ImageFeature の Map（既存解析済み）
 */
export function buildAnalysis(
  items: readonly PromptHistoryItem[],
  featuresMap: Map<string, ImageFeature>,
): ImageAnalysisResult {
  const eligible = items.filter((it) => primaryResultImage(it) != null);
  const featureList: ImageFeature[] = [];
  const analyzedItems: PromptHistoryItem[] = [];
  for (const it of eligible) {
    const f = featuresMap.get(it.id);
    if (f) { featureList.push(f); analyzedItems.push(it); }
  }

  // ── クラスタリング ──
  const groups = clusterByHash(featureList);
  const clusters: ImageCluster[] = [];
  let uniqueCount = 0;
  const itemToCluster = new Map<string, ImageCluster>();
  for (const idxs of groups.values()) {
    if (idxs.length === 1) {
      uniqueCount++;
      continue;
    }
    // サイズ降順用に新しい順でソート（createdAt 降順）
    idxs.sort((a, b) => analyzedItems[b].createdAt - analyzedItems[a].createdAt);
    const cluster: ImageCluster = {
      itemIds: idxs.map((i) => featureList[i].id),
      representativeHash: featureList[idxs[0]].hash,
      representativeThumb: primaryResultImage(analyzedItems[idxs[0]]),
      size: idxs.length,
    };
    clusters.push(cluster);
    for (const id of cluster.itemIds) itemToCluster.set(id, cluster);
  }
  clusters.sort((a, b) => b.size - a.size);

  // ── カテゴリ出現率 ──
  const bg = aggregateField(
    analyzedItems,
    (it) => it.details?.background?.place as string | null | undefined,
    BG_PLACE_JP,
  );
  const outfit = aggregateField(
    analyzedItems,
    (it) => it.details?.outfit?.style as string | null | undefined,
    OUTFIT_STYLE_JP,
  );
  const hair = aggregateField(
    analyzedItems,
    (it) => it.details?.hair?.hairStyle as string | null | undefined,
    HAIR_STYLE_JP,
  );
  const camera = aggregateField(
    analyzedItems,
    (it) => it.details?.camera?.angle as string | null | undefined,
    CAMERA_ANGLE_JP,
  );
  const lighting = aggregateField(
    analyzedItems,
    (it) => it.details?.lighting?.direction as string | null | undefined,
    LIGHTING_DIR_JP,
  );

  // ── 未使用 / 頻出 ──
  const usedSet = (rates: CategoryRate[]) => new Set(rates.map((r) => r.label));
  const underused: { axis: string; label: string }[] = [];
  const allMaps: { axis: string; map: Record<string, string>; rates: CategoryRate[] }[] = [
    { axis: "背景",       map: BG_PLACE_JP,     rates: bg.rates },
    { axis: "衣装",       map: OUTFIT_STYLE_JP, rates: outfit.rates },
    { axis: "髪型",       map: HAIR_STYLE_JP,   rates: hair.rates },
    { axis: "カメラ",     map: CAMERA_ANGLE_JP, rates: camera.rates },
    { axis: "ライティング", map: LIGHTING_DIR_JP, rates: lighting.rates },
  ];
  for (const e of allMaps) {
    const used = usedSet(e.rates);
    for (const lbl of Object.values(e.map)) {
      if (!used.has(lbl)) underused.push({ axis: e.axis, label: lbl });
    }
  }

  const overused: { axis: string; label: string; ratio: number }[] = [];
  for (const e of allMaps) {
    if (e.rates.length === 0) continue;
    const top = e.rates[0];
    if (top.ratio >= 0.40) overused.push({ axis: e.axis, label: top.label, ratio: top.ratio });
  }
  overused.sort((a, b) => b.ratio - a.ratio);

  // ── アイテム単位スコア ──
  const itemScores = new Map<string, PerItemScore>();
  for (const it of analyzedItems) {
    const cluster = itemToCluster.get(it.id);
    const clusterSize = cluster?.size ?? 1;
    const duplication = Math.min(100, Math.round((clusterSize - 1) / Math.max(1, analyzedItems.length) * 200));
    const novelty     = Math.max(0, 100 - duplication);

    // 偏り：このアイテムの category 値が overused に該当するか
    let biasHits = 0;
    const detVals = [
      it.details?.background?.place,
      it.details?.outfit?.style,
      it.details?.hair?.hairStyle,
      it.details?.camera?.angle,
      it.details?.lighting?.direction,
    ];
    for (let i = 0; i < allMaps.length; i++) {
      const v = detVals[i];
      if (typeof v !== "string" || SKIP_VALUES.has(v)) continue;
      const jp = allMaps[i].map[v] ?? v;
      const found = allMaps[i].rates.find((r) => r.label === jp);
      if (found && found.ratio >= 0.30) biasHits++;
    }
    const bias = Math.min(100, biasHits * 25);
    itemScores.set(it.id, { novelty, duplication, bias });
  }

  return {
    totalEligible: eligible.length,
    totalAnalyzed: analyzedItems.length,
    clusters: clusters.slice(0, 20),
    uniqueCount,
    backgroundRates: bg.rates,
    outfitRates:     outfit.rates,
    hairRates:       hair.rates,
    cameraRates:     camera.rates,
    lightingRates:   lighting.rates,
    overusedCategories:  overused,
    underusedCategories: underused.slice(0, 30),
    itemScores,
  };
}

// ── 段階解析ランナー（重い処理を細切れで） ─────────────────────────

/**
 * 未解析の履歴アイテムを 1 件ずつ解析し、進捗を callback で通知。
 * onProgress({done, total}) → Vt: 完了で resolve。
 *
 * abortSignal で中断可能。
 */
export async function runProgressiveAnalysis(
  items: readonly PromptHistoryItem[],
  existingMap: Map<string, ImageFeature>,
  onProgress: (state: { done: number; total: number; latest?: ImageFeature }) => void,
  abortSignal?: AbortSignal,
): Promise<Map<string, ImageFeature>> {
  const todo = items.filter((it) => primaryResultImage(it) != null && !existingMap.has(it.id));
  const total = todo.length;
  if (total === 0) {
    onProgress({ done: 0, total: 0 });
    return existingMap;
  }
  const next = new Map(existingMap);
  let done = 0;
  for (const item of todo) {
    if (abortSignal?.aborted) break;
    const f = await analyzeOne(item, next);
    if (f) next.set(item.id, f);
    done++;
    onProgress({ done, total, latest: f ?? undefined });
    // 連続実行で UI を固めないために 1 件ごとに譲る
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return next;
}
