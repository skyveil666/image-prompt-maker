/**
 * successPatterns — 成功プロンプト抽出（#9）。
 *
 * お気に入り・高評価・失敗が少ないプロンプトから「成功しやすい型」を抽出する。
 * 自動反映しない。「現在設定に反映」ボタンを押した時だけ、かつ保護対象を優先して反映する。
 */

import type { PromptHistoryItem, Scope } from "../types";

export interface SuccessPromptPattern {
  id: string;
  title: string;
  sourcePromptIds: string[];
  /** 成功時の変更対象スコープ */
  changeTargetPattern: Scope[];
  /** 成功時の保護対象（変更しなかった軸） */
  protectedTargetPattern: string[];
  stylePattern: string[];
  cameraPattern: string[];
  lightingPattern: string[];
  foregroundPattern: string[];
  successReasons: string[];
  riskNotes: string[];
  recommendedFor: ("ChatGPT" | "Gemini" | "NanoBanana")[];
  /** 0-100：この型の信頼度 */
  score: number;
  createdAt: number;
}

const SCOPE_LABEL: Record<string, string> = {
  background: "背景", foreground: "前景演出", pose: "ポーズ", hair: "髪", outfit: "衣装",
  cosplay: "コスプレ", cyber: "機械化", camera: "カメラ", props: "小物", big_object: "大物",
  vehicle: "乗り物", myth: "神話/幻獣", lighting: "ライティング", aspect_ratio: "アスペクト比",
};

/** アイテムが「成功」かどうかと、その強さ（重み）を判定 */
function successWeight(item: PromptHistoryItem): number {
  let w = 0;
  if (item.isFavorite) w += 3;
  // 高評価（resultRatings に 5 が含まれる）
  const ratings = item.resultRatings ?? [];
  if (ratings.some((r) => r === 5)) w += 2;
  if (ratings.some((r) => r === 3)) w += 1;
  // 失敗評価・失敗メモがあれば減点
  if (ratings.some((r) => r === 1)) w -= 2;
  if (item.failureMemo && (item.failureMemo.selectedReasons.length > 0)) {
    w -= Math.min(2, item.failureMemo.severity / 2);
  }
  return w;
}

/** プロンプト文から代表的な傾向語を拾う */
function pickStyleHints(text: string): string[] {
  const STYLE = ["ストリート", "モード", "テックウェア", "古着", "スポーツラグジュアリー",
    "ナチュラル", "きれいめ", "Y2K", "ミニマル", "広告", "和モダン", "レイヤード", "カジュアル"];
  const lower = text.toLowerCase();
  return STYLE.filter((s) => lower.includes(s.toLowerCase())).slice(0, 3);
}
function pickHints(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase())).slice(0, 3);
}

export function extractSuccessPromptPatterns(items: PromptHistoryItem[]): SuccessPromptPattern[] {
  // 成功アイテムのみ
  const scored = items
    .map((it) => ({ it, w: successWeight(it) }))
    .filter((x) => x.w >= 2);
  if (scored.length === 0) return [];

  // 変更対象スコープの組み合わせでグルーピング
  const groups = new Map<string, { items: PromptHistoryItem[]; weight: number }>();
  for (const { it, w } of scored) {
    const key = [...(it.scopes ?? [])].sort().join("|");
    const g = groups.get(key) ?? { items: [], weight: 0 };
    g.items.push(it);
    g.weight += w;
    groups.set(key, g);
  }

  // グループを重み順に並べ、上位を型として整形
  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].weight - a[1].weight);
  const patterns: SuccessPromptPattern[] = [];

  sorted.slice(0, 5).forEach(([key, g], idx) => {
    if (key === "") return;
    const scopes = key.split("|").filter(Boolean) as Scope[];
    const allScopes: Scope[] = ["background", "foreground", "pose", "hair", "outfit", "camera", "lighting", "props"];
    const protectedScopes = allScopes.filter((s) => !scopes.includes(s)).map((s) => SCOPE_LABEL[s] ?? s);

    // 代表テキスト（最も評価の高いもの）から傾向語を拾う
    const repText = g.items.map((i) => i.promptText).join("\n");
    const style = pickStyleHints(repText);
    const camera = pickHints(repText, ["ローアングル", "ハイアングル", "クローズアップ", "俯瞰", "正面", "後ろ姿"]);
    const lighting = pickHints(repText, ["自然光", "サイドライト", "逆光", "暖色光", "スタジオ光", "リムライト"]);
    const foreground = pickHints(repText, ["前景", "粒子", "ボケ", "舞い散る"]);

    const successReasons: string[] = [];
    if (!scopes.includes("background")) successReasons.push("背景を変えないので顔・場所が安定");
    if (scopes.length <= 3) successReasons.push("変更対象が少なく顔が崩れにくい");
    if (style.length > 0) successReasons.push(`${style.join("・")}系で量産AIっぽさが少ない`);
    if (g.items.some((i) => i.isFavorite)) successReasons.push("お気に入り登録された実績あり");

    const riskNotes: string[] = [];
    if (scopes.includes("pose") && scopes.includes("camera")) riskNotes.push("ポーズ＋カメラ同時のため顔の角度に注意");

    const score = Math.min(100, 50 + g.weight * 6 + (scopes.length <= 3 ? 10 : 0) + (!scopes.includes("background") ? 8 : 0));

    patterns.push({
      id: `sp-${key}`,
      title: `成功しやすい型 ${String(idx + 1).padStart(2, "0")}`,
      sourcePromptIds: g.items.map((i) => i.id).slice(0, 10),
      changeTargetPattern: scopes,
      protectedTargetPattern: ["顔", "同一性", ...protectedScopes],
      stylePattern: style,
      cameraPattern: camera,
      lightingPattern: lighting,
      foregroundPattern: foreground,
      successReasons,
      riskNotes,
      recommendedFor: ["ChatGPT", "NanoBanana"],
      score,
      createdAt: Date.now(),
    });
  });

  return patterns;
}

/**
 * 型の変更対象を「現在のスコープ」へ反映する際の安全フィルタ。
 * 最重要：現在の保護対象を優先する。
 *   - 背景・衣装が現在OFF（=保護中）なら、型に含まれていても追加しない
 *     （背景固定ONなら背景要素は反映しない / 衣装OFFなら衣装要素は反映しない）。
 *   - それ以外の型の変更対象は現在のスコープに足す。
 *   - 顔・同一性・体型のロックは scopes と別管理なので一切触れない。
 */
export function applyPatternScopes(pattern: SuccessPromptPattern, currentScopes: Scope[]): Scope[] {
  const protectedIfOff: Scope[] = ["background", "outfit"];
  const additions = pattern.changeTargetPattern.filter((s) =>
    !protectedIfOff.includes(s) || currentScopes.includes(s));
  return Array.from(new Set([...currentScopes, ...additions]));
}
