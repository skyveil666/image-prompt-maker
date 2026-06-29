/**
 * promptLockCheck — 変更禁止チェック機能。
 *
 * 最重要方針：顔・同一性維持を最優先し、ユーザーが選択した変更対象だけを変更する。
 *   - 変更対象（scopes）に入っていない軸 = 保護対象。
 *   - その軸に関する「変更ワード」が最終プロンプトに混ざっていないか検査する。
 *   - 顔・同一性に影響する危険表現も検査する。
 *
 * 重要：分析結果を自動適用しない。これは「検査」と「ユーザーが押したときの除去」だけ。
 *
 * 誤検知対策：
 *   生成プロンプトには「背景は維持」「顔は固定」のような保護宣言行が含まれる。
 *   これらは『変更』ではなく『維持』の文なので、保護キーワードを含む行はスキップする。
 */

import type { Scope } from "../types";
import { ALL_SCOPE_LABELS } from "./scopeLabels";

// ── ロック状態 ───────────────────────────────────────────────────────────────

/** 変更対象（ON=変更する） */
export interface ChangeTargets {
  hair: boolean;
  outfit: boolean;
  background: boolean;
  props: boolean;
  lighting: boolean;
  camera: boolean;
  foreground: boolean;
  pose: boolean;
}

/** 保護対象（ON=絶対に変更しない） */
export interface ProtectedTargets {
  face: boolean;
  identity: boolean;
  expression: boolean;
  bodyShape: boolean;
  aspectRatio: boolean;
  background: boolean;  // 背景が変更対象でない = 保護
  outfit: boolean;      // 衣装が変更対象でない = 保護
}

export interface LockState {
  changeTargets: ChangeTargets;
  protectedTargets: ProtectedTargets;
  /** 分析結果を自動反映しない（常に false 固定 = 反映はボタンを押した時だけ） */
  autoApplyAnalysis: false;
}

/**
 * 現在の scopes / 固定設定から LockState を導出する。
 * - scopes に含まれる軸 = 変更対象。含まれない軸 = 保護。
 * - faceLock=true なら 顔・表情を保護。identity は常に保護（最優先方針）。
 */
export function deriveLockState(args: {
  scopes: Scope[];
  faceLock: boolean;
  bodyPoseLock: boolean;
  colorMoodLock: boolean;
  compositionLock: boolean;
}): LockState {
  const has = (s: Scope) => args.scopes.includes(s);
  // cosplay / cyber(機械化) は衣装カテゴリの変更（サーバ scopeFilter.ts deriveServerLocks と同期・P1-4 系統A）。
  // outfit 未選択でも cosplay/cyber が選ばれていれば衣装は「変更対象」＝保護から外す。背景・顔・他軸は不変。
  const outfitChange = has("outfit") || has("cosplay") || has("cyber");
  const changeTargets: ChangeTargets = {
    hair:       has("hair"),
    outfit:     outfitChange,
    background: has("background"),
    props:      has("props"),
    lighting:   has("lighting"),
    camera:     has("camera"),
    foreground: has("foreground"),
    pose:       has("pose"),
  };
  return {
    changeTargets,
    protectedTargets: {
      face:        args.faceLock,
      identity:    true, // 同一性は常に最優先で保護
      expression:  args.faceLock,
      bodyShape:   args.bodyPoseLock || !has("pose"),
      aspectRatio: args.compositionLock || !has("aspect_ratio"),
      background:  !has("background"),
      outfit:      !outfitChange,
    },
    autoApplyAnalysis: false,
  };
}

// ── 軸ごとの「変更ワード」辞書（JP + EN） ────────────────────────────────────

/** 保護されている軸 → その軸に関する変更ワード一覧 */
const FORBIDDEN_WORDS: Record<keyof ChangeTargets, string[]> = {
  background: [
    "背景", "ロケーション", "風景", "シーン", "環境", "街並み", "都市", "部屋", "室内",
    "通り", "路地", "森", "廃墟", "美術館", "庭", "水中", "近未来都市", "電脳街", "スタジオ背景",
    "background", "location", "scene", "environment", "cityscape", "room", "street",
    "forest", "ruins", "museum", "garden", "underwater", "futuristic city", "cyberpunk city",
  ],
  outfit: [
    "衣装", "服装", "ファッション", "ドレス", "ジャケット", "コート", "スカート", "パンツ",
    "制服", "着物", "ボディスーツ", "アーマー", "鎧", "ストリートウェア", "重ね着", "コーデ",
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
    "pose", "standing", "sitting", "twisting body", "over the shoulder",
    "dynamic pose", "action pose", "looking back",
  ],
  camera: [
    "カメラアングル", "ローアングル", "ハイアングル", "俯瞰", "煽り", "引きの構図",
    "クローズアップ", "ドローン視点", "魚眼", "構図", "レンズ", "画角", "パース",
    "camera angle", "low angle", "high angle", "wide shot", "close-up",
    "drone view", "cctv", "perspective", "lens", "composition",
  ],
  lighting: [
    "ライティング", "照明", "逆光", "サイドライト", "リムライト", "スポットライト",
    "ネオンライト", "自然光", "光源",
    "lighting", "backlight", "side light", "rim light", "spotlight", "neon light",
  ],
  foreground: [
    "前景演出", "前ボケ", "手前の", "前景エフェクト", "粒子エフェクト", "舞い散る",
    "foreground", "bokeh foreground",
  ],
  props: [
    "小物", "持ち物", "アクセサリー", "バッグ", "帽子", "傘", "発光する小道具",
    "props", "accessory", "handheld",
  ],
};

/** 顔・同一性を脅かす危険表現 */
const FACE_RISK_WORDS: string[] = [
  "別人", "顔を変える", "顔の造形を変更", "新しい表情", "顔つきを変える", "顔を作り変える",
  "大人っぽい顔", "幼い顔", "別の顔", "顔の変形", "目鼻立ちを変える", "輪郭を変える",
  "change face", "different face", "new expression", "reshape face", "mature face",
  "younger face", "different person", "face transformation", "facial structure",
];

/** 行が「保護宣言（維持・固定）」なら true → 検査からスキップ */
const PROTECTIVE_LINE_HINTS = [
  "維持", "固定", "変更しない", "そのまま", "保持", "変えない", "据え置き", "崩さない",
  "keep", "maintain", "preserve", "unchanged", "do not change", "fixed", "lock",
];

function isProtectiveLine(line: string): boolean {
  const l = line.toLowerCase();
  return PROTECTIVE_LINE_HINTS.some((h) => l.includes(h.toLowerCase()));
}

/**
 * 禁止ワードが haystack に「実質的に」含まれるか。素朴な includes は誤検知が多い。
 *  - 単一漢字は「直前が漢字でない」位置のみ該当＝複合語の末尾を除外（"家庭"の庭・"校庭"の庭 を背景変更と誤検知しない）。
 *  - それ以外（複数文字の和語・英語・フレーズ）は従来どおり部分一致（挙動不変）。
 * ※ 既知の限界：文頭に現れる単一漢字（例「森の妖精風の衣装」の森）は語境界で判別できず検出のまま。
 *   axis ごとの文脈判定（その行が衣装の話か背景の話か）が必要で、それは別タスク。advisory（警告のみ）なので実害は限定的。
 */
function forbiddenWordHit(haystack: string, word: string): boolean {
  if (!word) return false;
  if ([...word].length === 1 && /\p{Script=Han}/u.test(word)) {
    for (let i = haystack.indexOf(word); i >= 0; i = haystack.indexOf(word, i + 1)) {
      if (i === 0 || !/\p{Script=Han}/u.test(haystack[i - 1])) return true;
    }
    return false;
  }
  return haystack.includes(word);
}

/** axis → 日本語ラベル（警告メッセージ用）。Scope→ラベルは scopeLabels.ts に一本化。 */
const AXIS_JP: Record<keyof ChangeTargets, string> = ALL_SCOPE_LABELS;

// ── 検査結果型 ───────────────────────────────────────────────────────────────

export interface LockWarning {
  target: string;
  message: string;
  matchedWords: string[];
  severity: "low" | "medium" | "high";
}

export interface PromptValidationResult {
  isValid: boolean;
  warnings: LockWarning[];
  /** 禁止ワードを除去したクリーン版（warnings がある時のみ生成） */
  cleanedPrompt?: string;
}

// ── 検査本体 ─────────────────────────────────────────────────────────────────

/**
 * 最終プロンプトを LockState に照らして検査する。
 * 保護されている軸に関する変更ワードが「変更意図の文脈」で含まれていれば警告。
 */
export function validatePromptLocks(promptText: string, lock: LockState): PromptValidationResult {
  const warnings: LockWarning[] = [];
  const lines = promptText.split(/\r?\n/);
  // 変更意図の行だけを対象にする（維持・固定の行は除外）
  const changeLines = lines.filter((ln) => ln.trim() && !isProtectiveLine(ln));
  const haystack = changeLines.join("\n").toLowerCase();

  // 1) 保護されている各軸の変更ワード検査
  (Object.keys(FORBIDDEN_WORDS) as (keyof ChangeTargets)[]).forEach((axis) => {
    const isProtected = !lock.changeTargets[axis];
    if (!isProtected) return; // 変更対象なら検査不要
    const matched = FORBIDDEN_WORDS[axis].filter((w) => forbiddenWordHit(haystack, w.toLowerCase()));
    if (matched.length > 0) {
      const jp = AXIS_JP[axis];
      const lockedLabel = axis === "background" ? "背景固定ON" : `${jp}OFF`;
      warnings.push({
        target: axis,
        message: `${lockedLabel}ですが、${jp}に関する変更ワードが含まれています`,
        matchedWords: Array.from(new Set(matched)),
        severity: axis === "background" || axis === "outfit" ? "high" : "medium",
      });
    }
  });

  // 2) 顔・同一性の危険表現（保護されている時のみ）
  if (lock.protectedTargets.face || lock.protectedTargets.identity) {
    const matched = FACE_RISK_WORDS.filter((w) => haystack.includes(w.toLowerCase()));
    if (matched.length > 0) {
      warnings.push({
        target: "face",
        message: "顔・同一性に影響する可能性のある表現があります",
        matchedWords: Array.from(new Set(matched)),
        severity: "high",
      });
    }
  }

  const isValid = warnings.length === 0;
  return {
    isValid,
    warnings,
    ...(isValid ? {} : { cleanedPrompt: cleanForbidden(promptText, lock) }),
  };
}

/**
 * 禁止ワードを除去したプロンプトを生成する。
 * - 維持・固定の行は残す。
 * - 変更意図の行のうち、保護軸の禁止ワード／顔危険語を含む「文」を削除する。
 *   （行全体ではなく句点・読点・スラッシュ区切りの断片単位で削る）
 */
export function cleanForbidden(promptText: string, lock: LockState): string {
  // 検査対象の禁止語を集める
  const forbidden: string[] = [];
  (Object.keys(FORBIDDEN_WORDS) as (keyof ChangeTargets)[]).forEach((axis) => {
    if (!lock.changeTargets[axis]) forbidden.push(...FORBIDDEN_WORDS[axis]);
  });
  if (lock.protectedTargets.face || lock.protectedTargets.identity) forbidden.push(...FACE_RISK_WORDS);
  const lowerForbidden = forbidden.map((w) => w.toLowerCase());

  const lines = promptText.split(/\r?\n/);
  const out = lines.map((line) => {
    if (isProtectiveLine(line)) return line; // 維持行はそのまま
    // 文の断片に分割（。/ ・ / 、 / スラッシュ）
    const fragments = line.split(/(?<=[。、・/／])/);
    const kept = fragments.filter((frag) => {
      const lf = frag.toLowerCase();
      return !lowerForbidden.some((w) => lf.includes(w));
    });
    return kept.join("");
  });
  // 空行が増えすぎないように整理
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── ロック一覧の表示用ラベル ─────────────────────────────────────────────────

// ロック一覧の表示用ラベルも scopeLabels.ts に一本化（AXIS_JP と同一ソース）。
const CHANGE_LABEL: Record<keyof ChangeTargets, string> = ALL_SCOPE_LABELS;

const PROTECTED_LABEL: Record<keyof ProtectedTargets, string> = {
  face: "顔", identity: "同一性", expression: "表情", bodyShape: "体型",
  aspectRatio: "アスペクト比", background: "背景", outfit: "衣装",
};

/** 「今回変更する項目」ラベル一覧 */
export function changedTargetLabels(lock: LockState): string[] {
  return (Object.keys(lock.changeTargets) as (keyof ChangeTargets)[])
    .filter((k) => lock.changeTargets[k])
    .map((k) => CHANGE_LABEL[k]);
}

/** 「今回変更しない項目」ラベル一覧（保護対象＋OFF軸） */
export function lockedTargetLabels(lock: LockState): string[] {
  const set = new Set<string>();
  // 保護対象
  (Object.keys(lock.protectedTargets) as (keyof ProtectedTargets)[]).forEach((k) => {
    if (lock.protectedTargets[k]) set.add(PROTECTED_LABEL[k]);
  });
  // 変更対象でない軸も「変更しない」に含める
  (Object.keys(lock.changeTargets) as (keyof ChangeTargets)[]).forEach((k) => {
    if (!lock.changeTargets[k]) set.add(CHANGE_LABEL[k]);
  });
  return Array.from(set);
}

/** コピー用ヘッダー（ロック一覧）を生成する */
export function buildLockHeader(lock: LockState): string {
  const changed = changedTargetLabels(lock).join(" / ") || "（なし）";
  const locked = lockedTargetLabels(lock).join(" / ");
  return [
    "※ これはAIで生成された架空キャラクターを編集するためのプロンプトです。",
    `【変更する】 ${changed}`,
    `【変更しない】 ${locked}`,
    "【固定ルール】 顔・同一性維持：最優先 / 分析結果の自動反映：OFF",
    "",
  ].join("\n");
}
