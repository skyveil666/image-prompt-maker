/**
 * AI分析エージェント — ヒューリスティックなアシスタント
 *
 * 「現在のUI状態 + 履歴分析 + お気に入り傾向 + 重複制御」を統合して、
 * ユーザーが次に何を押すと良いかを提案する。
 *
 * LLMは呼ばない（即応答・コスト0）。すべて履歴ベースの観測ロジック。
 */
import type { Scope, LockKey } from "../types";
import type { FullHistoryAnalysis } from "./historyAnalyzer";
import type { FavoriteProfile } from "./favoriteProfile";

// ── 入力 ─────────────────────────────────────────────────────────────────────

export interface AgentInput {
  /** 現在の変更範囲 */
  scopes: Scope[];
  /** 守るもの */
  locks: Record<LockKey, boolean>;
  faceLock: boolean;
  /** 適用中のプリセット */
  activeWorldPresets: string[];
  activeGodModes: string[];
  activeBoosts: string[];
  viralMode: boolean;
  /** お気に入り傾向（学習プロファイル） */
  favoriteProfile: FavoriteProfile | null;
  favoriteEnabled: boolean;
  /** 履歴分析（重複分析センターと同じソース） */
  historyAnalysis: FullHistoryAnalysis | null;
  /** 重複分析の制御反映状態 */
  policyApplied: boolean;
  /** 風の強さ 0-5 */
  windLevel: number;
  /** 元画像があるか */
  hasImage: boolean;
}

// ── 出力 ─────────────────────────────────────────────────────────────────────

/** 提案アクションのID（App側で実ハンドラに紐付け） */
export type AgentActionId =
  | "apply"          // この提案を反映：高頻度上位3件を抑制 + 未開拓ジャンルを推奨
  | "see_alternative"// 別案を見る：別ジャンル化（既存 onAutoFix）
  | "avoid_overlap"  // 重複を避ける：被り回避ブーストON
  | "favorite_bias" // お気に入り寄せ：お気に入り学習ON
  | "simplify"       // シンプル化：scope を1〜2軸に絞る
  | "go_bold";       // 攻める：神引きカオス + バズ寄せ

export interface AgentAction {
  id: AgentActionId;
  label: string;
  description: string;
  /** 推奨度（低・中・高）。今の状況に対する適合度 */
  priority: "low" | "medium" | "high";
}

export interface AgentObservation {
  /** 重要度。high=赤系警告 / medium=黄 / low=情報 */
  severity: "low" | "medium" | "high";
  text: string;
}

export interface AgentAnalysis {
  /** 「現在の傾向」一段落 */
  trendSummary: string;
  /** 「問題点」リスト */
  problems: AgentObservation[];
  /** 「次におすすめ」具体提案（箇条書き、短文） */
  recommendations: string[];
  /** 提案アクションボタン（最大6） */
  actions: AgentAction[];
}

// ── 分析ロジック ──────────────────────────────────────────────────────────────

const SCOPE_LABEL: Record<Scope, string> = {
  background: "背景", foreground: "前景演出", pose: "ポーズ", hair: "髪",
  outfit: "衣装", cosplay: "コスプレ", cyber: "機械化", camera: "カメラ",
  props: "持ち物", big_object: "大物", vehicle: "乗り物", myth: "神話",
  lighting: "ライティング", aspect_ratio: "比率",
};

/**
 * 観察 + 提案を生成する。
 * 観点8項目（同じ服/背景/色味の連発、神引き効きすぎ、変更範囲外、固定遵守、好み寄せすぎ、量産検知）。
 */
export function analyzeAgent(input: AgentInput): AgentAnalysis {
  const {
    scopes, faceLock, activeWorldPresets, activeGodModes, activeBoosts, viralMode,
    favoriteProfile, favoriteEnabled, historyAnalysis, policyApplied, windLevel, hasImage,
  } = input;

  const ha = historyAnalysis;
  const topMotifs = ha?.topMotifs ?? [];
  const top3Names = topMotifs.slice(0, 3).map((m) => m.motif.label);
  const topCombo  = ha?.topCombos?.[0];
  const dupHigh   = !!topCombo && topCombo.count >= 5;
  const untapped  = (ha?.untappedGenres ?? []).filter((g) => g.untappedScore >= 80).slice(0, 4);

  // ── 現在の傾向 ──
  let trendSummary = "";
  if (top3Names.length === 0) {
    trendSummary = "まだ十分なデータがありません。数回生成すると傾向分析が始まります。";
  } else {
    const dom = top3Names.join("・");
    const total = ha?.windowSize ?? 0;
    trendSummary = `直近${total}件の履歴では ${dom} が頻発しています。`;
    if (topCombo && topCombo.count >= 3) {
      trendSummary += ` 特に「${topCombo.motifLabels.join(" ＋ ")}」が${topCombo.count}回同時出現しています。`;
    }
  }

  // ── 問題点 ──
  const problems: AgentObservation[] = [];

  // 1. 同じ服/背景/色味の連発
  if (topMotifs.length > 0 && topMotifs[0].totalCount >= 30) {
    problems.push({
      severity: "high",
      text: `${topMotifs[0].motif.label}が${topMotifs[0].totalCount}回出ています — 強い偏りです。`,
    });
  }

  // 2. 頻出構成（コンボ）
  if (dupHigh && topCombo) {
    problems.push({
      severity: "high",
      text: `組み合わせ「${topCombo.motifLabels.join(" ＋ ")}」が${topCombo.count}回反復しています — 構成被りです。`,
    });
  }

  // 3. 神引き効きすぎ
  const heavyGod = activeGodModes.filter((m) => !["normal", "composition"].includes(m)).length;
  if (heavyGod >= 2 && activeBoosts.length >= 2) {
    problems.push({
      severity: "medium",
      text: "神引きと補助ブーストを同時に多用しています。強すぎて狙いがぼやけやすい状態です。",
    });
  }

  // 4. 変更範囲外を触る可能性のあるプリセット競合
  if (activeWorldPresets.length > 0 && !scopes.includes("background") && !scopes.includes("outfit")) {
    problems.push({
      severity: "medium",
      text: "世界観プリセットが適用中ですが、背景も衣装も変更対象に入っていません。効きにくい状態です。",
    });
  }

  // 5. 顔固定の遵守状態
  if (!faceLock) {
    problems.push({
      severity: "medium",
      text: "🔓 顔固定が解除されています。表情変更モード以外では再固定を推奨します。",
    });
  }

  // 6. お気に入り寄せすぎ
  if (favoriteEnabled && favoriteProfile && favoriteProfile.traitPhrases.length >= 6) {
    problems.push({
      severity: "low",
      text: `お気に入り学習で ${favoriteProfile.traitPhrases.length} 個の傾向が反映されています — 寄せすぎに注意。新規性が出にくい場合は強度を「弱」に。`,
    });
  }

  // 7. 量産検知が未反映
  const hasMotifControls = !!ha && (
    topMotifs.some((m) => m.penaltyLevel === "heavy" || m.penaltyLevel === "blocked")
  );
  if (hasMotifControls && !policyApplied) {
    problems.push({
      severity: "medium",
      text: "重複分析は危険水域ですが「提案を反映」を押していないため、まだ生成に効いていません。",
    });
  }

  // 8. 画像未投入
  if (!hasImage) {
    problems.push({
      severity: "low",
      text: "元画像が貼られていません。画像があるとAIが内容を解析してより的確に反映できます。",
    });
  }

  // ── 次におすすめ（箇条書き）──
  const recommendations: string[] = [];

  if (top3Names.length > 0 && untapped.length > 0) {
    recommendations.push(
      `背景・衣装は触らず、未開拓の「${untapped.slice(0, 2).map((g) => g.label).join("・")}」方向へ振ってみる`
    );
  }
  if (dupHigh && topCombo) {
    recommendations.push(
      `頻出構成「${topCombo.motifLabels.join(" ＋ ")}」を「🚫 今後出さない」または「🎭 別ジャンル化」に設定`
    );
  }
  if (favoriteProfile && favoriteProfile.traitPhrases.length > 0 && !favoriteEnabled) {
    recommendations.push("お気に入り傾向ONで、好みの方向へ寄せた案を生成");
  }
  if (windLevel === 0 && (scopes.includes("hair") || scopes.includes("outfit"))) {
    recommendations.push("風レベル2〜3を追加して、髪や衣装に自然な動きを足す");
  }
  if (scopes.length === 0) {
    recommendations.push("変更するものを1つ以上選択（おすすめ：衣装または背景から始める）");
  } else if (scopes.length >= 5) {
    recommendations.push("変更範囲が多すぎます。2〜3軸に絞ると指示が通りやすくなります");
  }
  if (viralMode && scopes.length >= 4) {
    recommendations.push("🔥 バズり ONかつ変更項目が多いため、Nano Bananaでは品質が落ちやすいです。3軸以下推奨");
  }
  if (recommendations.length === 0) {
    recommendations.push("現状の設定は安定しています。このまま生成して問題ありません。");
  }

  // ── アクションボタン（最大6）──
  const actions: AgentAction[] = [];

  // ① この提案を反映
  if (dupHigh || (topMotifs[0]?.totalCount ?? 0) >= 30) {
    actions.push({
      id: "apply",
      label: "✨ この提案を反映",
      description: "頻出上位3件を強抑制、未開拓ジャンルを優先（自動調整）",
      priority: "high",
    });
  }
  // ② 別案を見る
  actions.push({
    id: "see_alternative",
    label: "🎭 別案を見る",
    description: "別ジャンル化：現在の方向を逆へ振り替えて再構築",
    priority: dupHigh ? "high" : "medium",
  });
  // ③ 重複を避ける
  if (!activeBoosts.includes("avoid_overlap")) {
    actions.push({
      id: "avoid_overlap",
      label: "🔁 重複を避ける",
      description: "被り回避ブーストをONにして、直近と似た方向を回避",
      priority: dupHigh ? "high" : "medium",
    });
  }
  // ④ お気に入り寄せ
  if (favoriteProfile && favoriteProfile.favoriteCount > 0 && !favoriteEnabled) {
    actions.push({
      id: "favorite_bias",
      label: "⭐ お気に入り寄せ",
      description: "お気に入り傾向ONで、好みの方向に少し寄せる",
      priority: "medium",
    });
  }
  // ⑤ シンプル化
  if (scopes.length >= 4 || activeGodModes.length >= 2 || activeBoosts.length >= 2) {
    actions.push({
      id: "simplify",
      label: "🧹 シンプル化",
      description: "変更範囲を2軸に絞り、神引き・ブーストを整理",
      priority: "medium",
    });
  }
  // ⑥ 攻める
  actions.push({
    id: "go_bold",
    label: "⚡ 攻める",
    description: "神引きカオス + バズ寄せ：意外性の高い構成へ",
    priority: "low",
  });

  return { trendSummary, problems, recommendations, actions };
}

// ── 補助：scope ラベル ───────────────────────────────────────────────────────
export function scopeLabel(s: Scope): string {
  return SCOPE_LABEL[s];
}
