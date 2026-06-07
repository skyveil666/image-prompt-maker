/**
 * discoveryMotifs — 発見層（P3）。docs/30。
 *
 * 監視外で「頻出し始めた新語」を候補として抽出する。
 * 目的＝未開拓発見・新ジャンル発見・神引き候補発見（好み非依存：お気に入り/評価は使わない）。
 *
 * 不変条件: 検出方式（小文字化＋部分一致）・生成・抽出・履歴データ構造は不変。
 *           localStorage 追加キーのみ（無視リスト / 昇格モチーフ）。学習は自動適用しない（昇格はユーザー操作）。
 */
import { MONITORED_MOTIFS } from "./biasAnalyzer";
import type { MonitoredMotif, MotifCategory } from "./biasAnalyzer";

const IGNORED_KEY = "ipm_ignored_terms_v1";
const USER_MOTIFS_KEY = "ipm_user_motifs_v1";

export interface CandidateMotif {
  term: string;
  /** 出現プロンプト数（同一プロンプト内は1回計上） */
  count: number;
  /** 直近出現の createdAt（unix ms） */
  lastSeen: number;
  /** サンプル文脈（最大2件・60字） */
  sampleContexts: string[];
}

/** 昇格モチーフ（P3b で追加。発見層の受け皿） */
export interface UserMotif {
  id: string;
  label: string;
  category: MotifCategory;
  tokens: string[];
  source: "user";
  createdAt: number;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFC");
}

// 汎用ストップワード（英語＋生成プロンプトの定型・汎用語）。発見ノイズを抑える。
const STOPWORDS = new Set<string>([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "by", "for", "with", "from", "as",
  "is", "are", "be", "this", "that", "these", "those", "it", "its", "into", "over", "under",
  "image", "images", "photo", "photograph", "picture", "quality", "high", "detailed", "detail",
  "realistic", "background", "style", "color", "colors", "light", "lighting", "scene",
  "aesthetic", "aesthetics", "art", "character", "girl", "woman", "portrait", "full", "body",
  "shot", "view", "angle", "look", "very", "more", "best", "ultra", "8k", "4k", "hd",
  // 生成プロンプトの定型・汎用日本語
  "画像", "背景", "衣装", "髪型", "ポーズ", "変更", "維持", "保持", "禁止", "完全", "場合",
  "表情", "人物", "雰囲気", "以下", "参照", "適用", "生成", "編集", "以上", "など", "この",
  "その", "する", "して", "ない", "もの", "よう", "それ", "ため",
  // Layer2: 定型スキャフォールド語（docs/30 §7。前提/固定/品質/人体補正/NG品質文 等）
  "前提", "固定", "同一性", "輪郭", "質感", "アスペクト比", "比率", "品質", "高解像度",
  "解像度", "人体補正", "補正", "手", "片手", "5本指", "指", "崩れ", "防止", "保護",
  "架空", "キャラクター", "外観", "造形", "目", "鼻", "口", "肌", "配置",
  "anatomically", "correct", "hands", "hand", "fingers", "finger", "resolution",
  "preserve", "maintain", "keep", "identity", "face", "facial", "consistent", "consistency",
]);

// 区切り（日本語句読点・記号・空白・括弧）。
const SPLIT_RE =
  /[\s、，,。・/|｜「」『』（）()\[\]{}【】〔〕<>"'’“”:：;；!！?？=＝＋+＊*~〜…\.\-—–_]+/u;

function isAsciiWord(t: string): boolean {
  return /^[a-z0-9][a-z0-9'-]*$/.test(t);
}

/** unigram ＋ 英語 bi-gram（隣接2語がともに ASCII 単語のときのみ連結） */
function tokenize(text: string): string[] {
  const raw = norm(text).split(SPLIT_RE).map((t) => t.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    out.push(raw[i]);
    const n = raw[i + 1];
    if (n && isAsciiWord(raw[i]) && isAsciiWord(n)) out.push(`${raw[i]} ${n}`);
  }
  return out;
}

function acceptTerm(term: string): boolean {
  if (term.length < 2 || term.length > 40) return false;
  if (/^[0-9]+$/.test(term)) return false; // 純数字
  if (STOPWORDS.has(term)) return false;
  if (term.includes(" ")) {
    const [a, b] = term.split(" ");
    if (STOPWORDS.has(a) && STOPWORDS.has(b)) return false; // 両方汎用語の bi-gram は捨てる
  }
  return true;
}

// ── Layer1: 構造ブロック除去（可変セクションのみ抽出）docs/30 §7 ───────────────
// 生成プロンプトの【可変＝創作】セクションだけを候補対象にする。固定/保護/品質セクションは捨てる。
const VARIABLE_SECTION_KEYS = [
  "変更", "雰囲気", "スタイル", "世界観", "色", "絵柄", "演出", "前景", "小物",
  "カメラ", "ライティング", "光", "背景", "衣装", "髪", "ポーズ", "コスプレ",
  "機械", "乗り物", "神話", "大物", "構図", "トレンド",
];
const SECTION_RE = /【([^】]+)】([\s\S]*?)(?=【[^】]+】|$)/gu;

/** 生成プロンプトから可変セクションのみ抽出。【】が無ければ全文を返す（旧/プレーン互換）。 */
function extractVariableText(promptText: string): string {
  const kept: string[] = [];
  let found = false;
  SECTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SECTION_RE.exec(promptText)) !== null) {
    found = true;
    if (VARIABLE_SECTION_KEYS.some((k) => m![1].includes(k))) kept.push(m[2]);
  }
  return found ? kept.join(" \n ") : promptText;
}

// ── 無視リスト（localStorage） ───────────────────────────────────────────────
export function loadIgnoredTerms(): string[] {
  try {
    const raw = localStorage.getItem(IGNORED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
export function addIgnoredTerm(term: string): string[] {
  const next = [...new Set([...loadIgnoredTerms(), norm(term)])];
  try { localStorage.setItem(IGNORED_KEY, JSON.stringify(next)); } catch { /* 無視 */ }
  return next;
}
export function removeIgnoredTerm(term: string): string[] {
  const next = loadIgnoredTerms().filter((t) => t !== norm(term));
  try { localStorage.setItem(IGNORED_KEY, JSON.stringify(next)); } catch { /* 無視 */ }
  return next;
}

// ── 昇格モチーフ（localStorage・P3b で書き込み） ──────────────────────────────
export function loadUserMotifs(): UserMotif[] {
  try {
    const raw = localStorage.getItem(USER_MOTIFS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (m): m is UserMotif =>
        m && typeof m === "object" && typeof m.id === "string" && Array.isArray(m.tokens),
    );
  } catch {
    return [];
  }
}

/** 実効監視集合（curated ＋ 昇格分）。昇格が無ければ従来と同一＝後方互換。 */
export function getEffectiveMotifs(): readonly MonitoredMotif[] {
  const user = loadUserMotifs();
  return user.length ? [...MONITORED_MOTIFS, ...user] : MONITORED_MOTIFS;
}

function buildCoveredTokens(): string[] {
  const out: string[] = [];
  for (const m of getEffectiveMotifs()) for (const t of m.tokens) out.push(norm(t));
  return out;
}

export interface HistoryTextItem {
  promptText: string;
  createdAt: number;
}
export interface DetectOptions {
  ignored?: string[];
  topN?: number;
  /** 候補に必要な最小出現数（既定2＝「頻出し始めた」もの） */
  minCount?: number;
}

/**
 * 監視外の頻出語を候補として抽出する（純粋関数・保存しない）。
 * 好み非依存：お気に入り/評価は一切参照しない。
 */
export function detectCandidateMotifs(
  items: HistoryTextItem[],
  opts: DetectOptions = {},
): CandidateMotif[] {
  const topN = opts.topN ?? 30;
  const minCount = opts.minCount ?? 2;
  const ignored = new Set((opts.ignored ?? loadIgnoredTerms()).map(norm));
  const covered = buildCoveredTokens();
  const coverCache = new Map<string, boolean>();
  const isCovered = (term: string): boolean => {
    const cached = coverCache.get(term);
    if (cached !== undefined) return cached;
    // 双方向部分一致（term が監視tokenを含む or 監視tokenが term を含む）
    const c = covered.some((tok) => term.includes(tok) || tok.includes(term));
    coverCache.set(term, c);
    return c;
  };

  // Layer3: 文書頻度カットオフ（全件の閾値超に出る語＝定型とみなし除外）。履歴が薄い時は無効化。
  const total = items.length;
  const dfCutoff = total >= 10 ? 0.75 : 1.1;

  const agg = new Map<string, { count: number; lastSeen: number; ctx: string[] }>();
  for (const it of items) {
    // Layer1: 可変セクションのみを対象に（固定/保護/品質セクションを除去）
    const varText = extractVariableText(it.promptText);
    const seenInItem = new Set<string>(); // 同一プロンプト内の二重計上を防ぐ
    for (const term of tokenize(varText)) {
      if (seenInItem.has(term)) continue;
      if (!acceptTerm(term)) continue;
      if (ignored.has(term)) continue;
      if (isCovered(term)) continue;
      seenInItem.add(term);
      const cur = agg.get(term) ?? { count: 0, lastSeen: 0, ctx: [] };
      cur.count++;
      if (it.createdAt > cur.lastSeen) cur.lastSeen = it.createdAt;
      if (cur.ctx.length < 2) {
        const snippet = varText.replace(/\s+/g, " ").trim().slice(0, 60);
        if (snippet && !cur.ctx.includes(snippet)) cur.ctx.push(snippet);
      }
      agg.set(term, cur);
    }
  }

  return [...agg.entries()]
    .filter(([, v]) => v.count >= minCount && v.count / total < dfCutoff)
    .map(([term, v]) => ({ term, count: v.count, lastSeen: v.lastSeen, sampleContexts: v.ctx }))
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, topN);
}
