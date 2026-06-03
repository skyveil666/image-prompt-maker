/**
 * 好みプロファイル — Gemini Flash で実際に分析した結果を保持する。
 *
 * ヒューリスティック集計（ratingAnalyzer.PreferenceReport）とは別物。
 * こちらは「実 API 呼び出しの結果」のみが入り、未分析時は null。
 *
 * UI/UX 規約：
 *   - null のとき「分析済み」「自動補正中」と書かない（ダミー禁止）
 *   - 値が入っている = 本当に Gemini に投げて結果が返ってきた状態
 */

const STORAGE_KEY = "ipm_preference_profile_v1";
const AUTOLEARN_KEY = "ipm_autolearn_v1";

/** 自動学習：これだけ新規評価が増えたら自動で再分析する */
export const AUTO_NEW_SAMPLE_THRESHOLD = 5;
/** 自動学習：直近の自動分析からこの時間が経つまで再分析しない（API 連打防止） */
export const AUTO_COOLDOWN_MS = 1000 * 60 * 3;  // 3分
/** 評価変更後、この時間だけ待ってから自動分析を発火（連続クリックのデバウンス） */
export const AUTO_DEBOUNCE_MS = 1000 * 20;      // 20秒

// ── 型 ──────────────────────────────────────────────────────────────────────

/** Gemini からの構造化レスポンス（structured JSON output） */
export interface PreferenceProfile {
  /** プロファイルバージョン（将来の互換管理） */
  version: 1;
  /** 分析実行時刻（Date.now()） */
  generatedAt: number;
  /** 使用した AI モデル名（例 "gemini-2.5-flash"） */
  model: string;
  /** 分析対象となった評価数（評価付き画像 = 1サンプル） */
  sampleSize: number;
  /** 軸別の「好む傾向」（短い日本語の説明文） */
  likes: {
    bg:     string;
    outfit: string;
    pose:   string;
  };
  /** 軸別の「嫌う傾向」 */
  dislikes: {
    bg:     string;
    outfit: string;
    pose:   string;
  };
  /** 次回プロンプトで優先したいキーワード（≦5 件） */
  preferKeywords: string[];
  /** 次回プロンプトで回避すべきキーワード（≦5 件） */
  avoidKeywords: string[];
  /** ユーザー好み傾向の要約（2-3文） */
  summary: string;
}

/** サーバへ送る生サンプル */
export interface PreferenceSample {
  /** プロンプト本文（履歴アイテムの promptText） */
  prompt: string;
  /** 全体評価（5/3/2/1）。null は除外済み */
  overall: number;
  /** 軸別評価（5=良い / 1=悪い / null=未評価） */
  bg:     number | null;
  outfit: number | null;
  pose:   number | null;
  /** 生成日時 */
  createdAt: number;
}

/** 最小サンプル数（これ未満では「分析を実行」ボタンを無効化） */
export const MIN_SAMPLES = 5;

// ── 永続化 ──────────────────────────────────────────────────────────────────

export function loadPreferenceProfile(): PreferenceProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    if (obj.version !== 1) return null;
    // ざっくり形チェック
    if (typeof obj.generatedAt !== "number") return null;
    if (typeof obj.model !== "string") return null;
    if (typeof obj.sampleSize !== "number") return null;
    if (!obj.likes || !obj.dislikes) return null;
    return obj as PreferenceProfile;
  } catch {
    return null;
  }
}

export function savePreferenceProfile(p: PreferenceProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

export function clearPreferenceProfile(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

/** 自動学習の ON/OFF（既定 ON） */
export function loadAutoLearn(): boolean {
  try {
    const raw = localStorage.getItem(AUTOLEARN_KEY);
    if (raw === null) return true;   // 未設定なら ON
    return raw === "1";
  } catch {
    return true;
  }
}

export function saveAutoLearn(enabled: boolean): void {
  try { localStorage.setItem(AUTOLEARN_KEY, enabled ? "1" : "0"); } catch { /* noop */ }
}

// ── サンプル収集 ──────────────────────────────────────────────────────────

/**
 * 履歴から「評価が1つでも付いている画像」をサンプルとして抽出。
 * 同じ案カードに複数の画像があるときは画像ごとに別サンプル扱い。
 */
export function collectSamples(items: readonly {
  promptText: string;
  resultImageData: string | null;
  resultImageDataList?: string[];
  resultRatings?: (number | null)[];
  resultBgRatings?: (number | null)[];
  resultOutfitRatings?: (number | null)[];
  resultPoseRatings?: (number | null)[];
  createdAt: number;
}[]): PreferenceSample[] {
  const samples: PreferenceSample[] = [];
  for (const it of items) {
    const images = (Array.isArray(it.resultImageDataList) && it.resultImageDataList.length > 0)
      ? it.resultImageDataList
      : (it.resultImageData ? [it.resultImageData] : []);
    for (let i = 0; i < images.length; i++) {
      const overall = pick(it.resultRatings, i);
      const bg      = pick(it.resultBgRatings, i);
      const outfit  = pick(it.resultOutfitRatings, i);
      const pose    = pick(it.resultPoseRatings, i);
      // どれか1つでも評価があれば採用
      if (overall == null && bg == null && outfit == null && pose == null) continue;
      samples.push({
        prompt: (it.promptText ?? "").slice(0, 1200),  // 長文は切り詰め（API 通信効率のため）
        overall: overall ?? 3,  // 全体評価無しのときは「普通」扱い
        bg, outfit, pose,
        createdAt: it.createdAt,
      });
    }
  }
  return samples;
}

function pick(arr: (number | null)[] | undefined, i: number): number | null {
  if (!Array.isArray(arr)) return null;
  const v = arr[i];
  return (v === 1 || v === 2 || v === 3 || v === 5) ? v : null;
}

// ── ヘルパー：プロファイルから「ヒント文」を作る ─────────────────────────

/**
 * UI 用：プロファイルの簡潔表示（軸ごとに likes/dislikes を1行に）
 */
export function profileSummaryLines(p: PreferenceProfile): {
  axis: "bg" | "outfit" | "pose";
  jp: string;
  emoji: string;
  likes: string;
  dislikes: string;
}[] {
  return [
    { axis: "bg",     jp: "背景",   emoji: "🏞", likes: p.likes.bg,     dislikes: p.dislikes.bg },
    { axis: "outfit", jp: "衣装",   emoji: "👗", likes: p.likes.outfit, dislikes: p.dislikes.outfit },
    { axis: "pose",   jp: "ポーズ", emoji: "🧍", likes: p.likes.pose,   dislikes: p.dislikes.pose },
  ];
}
