/**
 * scopeFilter — 最終出力直前の「最後の砦」。
 *
 * フロントのUIチェックを通り抜けても、Gemini が稀に変更対象外の軸を触る出力を返すことがある。
 * そこで生成結果テキストに対し、サーバ側で機械的に：
 *   1) applyIdentityShield … 顔・同一性を守る固定文を強化（リスクに応じて）
 *   2) applyServerScopeFilter … 変更対象外・保護対象に関する変更文を削除
 * を実行する。
 *
 * 最重要：保護対象 > 変更対象 > トレンド/好み/神引き の優先順位を機械的に保証する。
 */

import type { GenerateRequest, Scope } from "./types.ts";

export type ScopeCategory =
  | "face" | "identity" | "expression" | "bodyShape"
  | "background" | "outfit" | "hair" | "pose" | "camera"
  | "lighting" | "foreground" | "props" | "aspectRatio";

// ── 軸カテゴリの語彙（JP + EN・単一ソース） ──────────────────────────────────
const CATEGORY_KEYWORDS: Partial<Record<ScopeCategory, string[]>> = {
  background: [
    "背景", "ロケーション", "風景", "シーン", "環境", "街並み", "都市", "部屋", "室内",
    "通り", "路地", "森", "廃墟", "美術館", "庭", "水中", "近未来都市", "電脳街",
    "background", "location", "scene", "environment", "cityscape", "room", "street",
    "forest", "ruins", "museum", "garden", "underwater", "futuristic city", "cyberpunk city",
  ],
  outfit: [
    "衣装", "服装", "ファッション", "ドレス", "ジャケット", "コート", "スカート", "パンツ",
    "制服", "着物", "ボディスーツ", "アーマー", "鎧", "ストリートウェア", "重ね着",
    "outfit", "clothing", "fashion", "dress", "jacket", "coat", "skirt", "pants",
    "uniform", "kimono", "bodysuit", "armor", "streetwear", "layered clothing",
  ],
  hair: [
    "髪型", "髪色", "ヘアスタイル", "ボブ", "ロングヘア", "ショートヘア", "ポニーテール",
    "ツインテール", "前髪", "グラデーションヘア", "ハイライト", "濡れ髪",
    "hairstyle", "bob cut", "long hair", "short hair", "ponytail", "twin tail",
    "wet hair", "highlight", "gradient hair", "bangs",
  ],
  pose: [
    "ポーズ", "立ち姿", "座り", "振り向き", "ダイナミックポーズ", "アクションポーズ",
    "体をひねる", "肩越し", "見返り",
    "pose", "standing", "sitting", "twisting", "looking back", "dynamic pose", "action pose",
  ],
  camera: [
    "カメラアングル", "ローアングル", "ハイアングル", "俯瞰", "煽り", "引きの構図",
    "クローズアップ", "ドローン視点", "魚眼", "構図", "レンズ", "画角", "パース",
    "camera angle", "low angle", "high angle", "wide shot", "close-up",
    "drone view", "cctv", "perspective", "lens", "composition",
  ],
  lighting: [
    "ライティング", "照明", "逆光", "サイドライト", "リムライト", "スポットライト", "ネオンライト", "光源",
    "lighting", "backlight", "side light", "rim light", "spotlight", "neon light",
  ],
  foreground: [
    "前景演出", "前ボケ", "手前の", "前景エフェクト", "粒子エフェクト", "舞い散る",
    "foreground", "bokeh foreground",
  ],
  props: [
    "小物", "持ち物", "アクセサリー", "バッグ", "帽子", "傘",
    "props", "accessory", "handheld",
  ],
};

/** 顔・同一性を脅かす危険語（face カテゴリの削除/警告対象） */
const FACE_DANGER = [
  "別人", "顔を変える", "顔つきを変える", "顔立ちを変える", "顔の造形を変更", "顔を作り変える",
  "大人っぽい顔", "幼い顔", "別の顔", "顔の変形", "目鼻立ちを変える", "輪郭を変える",
  "different face", "new face", "mature face", "younger face", "face transformation",
  "change facial structure", "reshape face", "different person", "dramatic facial change",
];

const CATEGORY_JP: Record<ScopeCategory, string> = {
  face: "顔", identity: "同一性", expression: "表情", bodyShape: "体型",
  background: "背景", outfit: "衣装", hair: "髪型", pose: "ポーズ", camera: "カメラ",
  lighting: "ライティング", foreground: "前景演出", props: "小物", aspectRatio: "アスペクト比",
};

const PROTECTIVE_HINTS = [
  "維持", "固定", "変更しない", "そのまま", "保持", "変えない", "据え置き", "崩さない",
  "禁止", "防止", "しないで", "保護", "完全一致", "一致を優先",
  "keep", "maintain", "preserve", "unchanged", "do not change", "fixed", "lock", "prohibit",
];
function isProtective(line: string): boolean {
  const l = line.toLowerCase();
  return PROTECTIVE_HINTS.some((h) => l.includes(h.toLowerCase()));
}

// ── ロック状態の導出（req.scopes + faceLock + locks から） ──────────────────
export interface DerivedLocks {
  changeTargets: Record<ScopeCategory, boolean>;
  protectedTargets: Record<ScopeCategory, boolean>;
  fixedRules: {
    backgroundLocked: boolean;
    outfitLocked: boolean;
    identityLocked: boolean;
    aspectRatioLocked: boolean;
  };
}

export function deriveServerLocks(req: GenerateRequest): DerivedLocks {
  const has = (s: Scope) => req.scopes.includes(s);
  // cosplay / cyber(機械化) は衣装カテゴリの変更：COSPLAY_LABELS は衣装語彙（メイド服/ドレス/鎧 等）、
  // cyber は「衣装の一部」を生成する。よって outfit を選んでいなくても、これらが選ばれていれば
  // 衣装は「変更対象」＝保護対象から外し、スコープフィルタで誤削除しない（P1-4 系統A）。
  // ※ 背景・顔・同一性・他軸の保護判定は一切変更しない。
  const outfitChange = has("outfit") || has("cosplay") || has("cyber");
  const changeTargets: Record<ScopeCategory, boolean> = {
    background: has("background"), outfit: outfitChange, hair: has("hair"),
    pose: has("pose"), camera: has("camera"), lighting: has("lighting"),
    foreground: has("foreground"), props: has("props"),
    aspectRatio: has("aspect_ratio"),
    face: false, identity: false, expression: false, bodyShape: false,
  };
  const protectedTargets: Record<ScopeCategory, boolean> = {
    face: req.faceLock,
    identity: true,
    expression: req.faceLock,
    bodyShape: req.locks?.body_shape || !has("pose"),
    background: !has("background"),
    outfit: !outfitChange,
    hair: !has("hair"),
    pose: !has("pose"),
    camera: !has("camera"),
    lighting: !has("lighting"),
    foreground: !has("foreground"),
    props: !has("props"),
    aspectRatio: req.locks?.aspect_ratio || !has("aspect_ratio"),
  };
  return {
    changeTargets,
    protectedTargets,
    fixedRules: {
      backgroundLocked: protectedTargets.background,
      outfitLocked: protectedTargets.outfit,
      identityLocked: true,
      aspectRatioLocked: protectedTargets.aspectRatio,
    },
  };
}

// ── 1) サーバ側スコープフィルタ ──────────────────────────────────────────────
export type RemovedScopeItem = {
  category: ScopeCategory;
  text: string;
  reason: string;
  severity: "low" | "medium" | "high";
};

export interface ScopeFilterResult {
  cleanedPrompt: string;
  removedItems: RemovedScopeItem[];
  warnings: string[];
  isSafe: boolean;
}

/** 保護対象のうち、削除対象となる語彙を持つカテゴリ */
function protectedAxisCategories(locks: DerivedLocks): ScopeCategory[] {
  return (Object.keys(CATEGORY_KEYWORDS) as ScopeCategory[])
    .filter((cat) => locks.protectedTargets[cat]);
}

function reasonFor(cat: ScopeCategory): string {
  if (cat === "background") return "背景固定ONのため削除";
  if (cat === "outfit") return "衣装OFFのため削除";
  return `${CATEGORY_JP[cat]}が変更対象外のため削除`;
}

export function applyServerScopeFilter(req: GenerateRequest, prompt: string): ScopeFilterResult {
  const locks = deriveServerLocks(req);
  const removedItems: RemovedScopeItem[] = [];
  const protCats = protectedAxisCategories(locks);

  const lines = prompt.split(/\r?\n/);
  const cleanedLines = lines.map((line) => {
    if (!line.trim()) return line;
    if (isProtective(line)) return line; // 「維持・固定」の行は残す（誤検知防止）

    // 文の断片に分解（。/ 、/ ・ / ; / スラッシュ）
    const fragments = line.split(/(?<=[。、・;／/])/);
    const kept = fragments.filter((frag) => {
      const lf = frag.toLowerCase();
      // 顔の危険語（保護されている時）
      if ((locks.protectedTargets.face || locks.protectedTargets.identity)) {
        const faceHit = FACE_DANGER.find((w) => lf.includes(w.toLowerCase()));
        if (faceHit) {
          removedItems.push({ category: "face", text: frag.trim(), reason: "顔・同一性保護のため削除", severity: "high" });
          return false;
        }
      }
      // 保護軸の変更語
      for (const cat of protCats) {
        const kw = CATEGORY_KEYWORDS[cat]!;
        if (kw.some((w) => lf.includes(w.toLowerCase()))) {
          removedItems.push({
            category: cat,
            text: frag.trim(),
            reason: reasonFor(cat),
            severity: cat === "background" || cat === "outfit" ? "high" : "medium",
          });
          return false;
        }
      }
      return true;
    });
    return kept.join("");
  });

  const cleanedPrompt = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const warnings = removedItems.length > 0
    ? [`変更対象外・保護対象に関する記述を ${removedItems.length}件 最終出力から削除しました。`]
    : [];
  return { cleanedPrompt, removedItems, warnings, isSafe: true };
}

// ── 2) Identity Shield ───────────────────────────────────────────────────────
export interface IdentityShieldResult {
  strengthenedPrompt: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "danger";
  addedIdentityClauses: string[];
  warnings: string[];
  reasons: string[];
}

// 5月設計（最小限の保護）へ回帰。発火時も短い1行に留め、抑制語（若返り/大人化/禁止/完全維持）を削減。
const CLAUSE_PROTECT =
  "【同一性保護】顔の造形・配置・表情・外観スタイルは元画像から維持してください。";
const CLAUSE_ANTIBREAK =
  "【顔崩れ防止】変更時も顔の造形と人物の印象は変えないでください（別人化を避ける）。";
const CLAUSE_FORCE =
  "【強制固定】顔と同一性を最優先で固定してください。";

export function applyIdentityShield(req: GenerateRequest, prompt: string): IdentityShieldResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let risk = 0;

  // 顔保護の主機構は faceLock ブロック（本文に常時挿入）＋【固定】に一本化。
  // Identity Shield は「faceLock が無効化されている／顔造形を変えうる語がある」など
  // 本当に危険な場合のみ同一性保護文を追加前置する“保険”に縮小（統合プラン Part B①）。
  // 通常の scope 変更（faceLock ON）では発火させない＝5月の「変更を促す＋最小限の保護」設計へ回帰。
  if (!req.faceLock) { risk += 50; warnings.push("顔固定がOFFです"); reasons.push("faceLock OFF"); }

  const lower = prompt.toLowerCase();
  if (FACE_DANGER.some((w) => lower.includes(w.toLowerCase()))) {
    risk += 50; warnings.push("顔変更に近い表現が含まれます"); reasons.push("顔造形を変えうる語");
  }
  // 顔の向きが大きく変わりうる指定のみ軽く加点（単独では発火しない）
  if (["顔の向き", "顔を傾け", "横顔", "振り向き"].some((w) => prompt.includes(w))) {
    risk += 12; reasons.push("顔の向きが変わる可能性");
  }

  risk = Math.max(0, Math.min(100, risk));
  const riskLevel: IdentityShieldResult["riskLevel"] =
    risk >= 90 ? "danger" : risk >= 50 ? "high" : risk >= 30 ? "medium" : "low";

  const addedIdentityClauses: string[] = [];
  if (riskLevel !== "low") addedIdentityClauses.push(CLAUSE_PROTECT);
  if (riskLevel === "high" || riskLevel === "danger") addedIdentityClauses.push(CLAUSE_ANTIBREAK);
  if (riskLevel === "danger") addedIdentityClauses.push(CLAUSE_FORCE);

  const strengthenedPrompt = addedIdentityClauses.length > 0
    ? insertClausesAfterPremise(prompt, addedIdentityClauses)
    : prompt;

  return { strengthenedPrompt, riskScore: risk, riskLevel, addedIdentityClauses, warnings, reasons };
}

/**
 * 同一性保護文を【前提】セクションの直後に挿入する。
 * 「AIで生成された架空キャラクター」という文脈宣言を必ず本文先頭に保つため、
 * 前置はしない（先頭の文脈宣言が画像生成側フィルタ通過の要）。
 * 【前提】が見つからない場合のみ従来どおり先頭に置く。
 */
function insertClausesAfterPremise(prompt: string, clauses: string[]): string {
  const joined = clauses.join("\n");
  if (!/^\s*【前提】/.test(prompt)) return joined + "\n" + prompt;
  const nextSection = prompt.indexOf("\n【", prompt.indexOf("【前提】") + 1);
  if (nextSection === -1) return prompt + "\n" + joined;
  return prompt.slice(0, nextSection) + "\n" + joined + prompt.slice(nextSection);
}
