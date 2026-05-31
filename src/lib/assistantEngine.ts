/**
 * アシスタント発話エンジン。
 * 既存の AgentAnalysis を「短く・口調付き・感情付き」に変換する。
 *
 * 重要：発話は短く・1〜2文以内。詳細は「もっと見る」で AI分析タブへ誘導。
 */
import type { AgentAnalysis, AgentActionId } from "./aiAgent";
import type { AssistantTone } from "./assistantSettings";

export type Emotion = "normal" | "idea" | "warn" | "bold" | "tired" | "celebrate";

export const EMOTION_META: Record<Emotion, { icon: string; ring: string; bubble: string }> = {
  normal:    { icon: "🙂", ring: "ring-slate-400/40",  bubble: "border-slate-400/40 bg-slate-500/8" },
  idea:      { icon: "✨", ring: "ring-violet-400/55", bubble: "border-violet-400/55 bg-violet-500/12" },
  warn:      { icon: "⚠️", ring: "ring-amber-400/60",  bubble: "border-amber-400/60 bg-amber-500/12" },
  bold:      { icon: "🔥", ring: "ring-rose-400/60",   bubble: "border-rose-400/55 bg-rose-500/12" },
  tired:     { icon: "😴", ring: "ring-sky-400/45",    bubble: "border-sky-400/45 bg-sky-500/10" },
  celebrate: { icon: "🎉", ring: "ring-emerald-400/55",bubble: "border-emerald-400/55 bg-emerald-500/12" },
};

export interface AssistantSpeech {
  text: string;            // 短文（1〜2文）
  emotion: Emotion;
  /** 表示する提案ボタン（上限3）。AI分析タブの actions から抽出 */
  actions: AgentActionId[];
}

/** 文字数制限（口調 short 用） */
const SHORT_MAX = 36;

/** 口調を適用して短い発話に整える */
function applyTone(base: string, tone: AssistantTone): string {
  // 句点で1〜2文に切る
  const sentences = base.split(/(?<=[。．！？!?])\s*/).filter(Boolean);
  let head = sentences.slice(0, 2).join("");
  // 長すぎたら切る
  if (head.length > 80) head = head.slice(0, 80) + "…";

  switch (tone) {
    case "gentle":
      // 丁寧で柔らかい語尾
      return head
        .replace(/です。/g, "ですね。")
        .replace(/しましょう。/g, "してみましょうか。")
        .replace(/^/, "");
    case "energetic":
      // 元気・感嘆
      return head.replace(/。/g, "！").replace(/、/g, "、") + (head.endsWith("！") ? "" : "");
    case "harsh":
      // 短く強く
      return head
        .replace(/かも(しれません)?。/g, "。")
        .replace(/してみる？/g, "変えるべき。")
        .replace(/おすすめします。/g, "推奨。")
        + (head.endsWith("。") ? "" : "。");
    case "cool":
      // 体言止め・短文
      return head
        .replace(/ですね?。/g, "。")
        .replace(/しましょう。/g, "推奨。")
        .replace(/。$/, "。");
    case "short": {
      // 最初の文を短縮
      const first = sentences[0] ?? head;
      return first.length > SHORT_MAX ? first.slice(0, SHORT_MAX) + "…" : first;
    }
    default:
      return head;
  }
}

/**
 * AgentAnalysis から短い発話を生成。
 * 感情の優先度：高severity問題 → warn ／ 推奨あり → idea ／ それ以外 → normal
 */
export function speak(
  agent: AgentAnalysis | null,
  tone: AssistantTone,
  hint?: "bold" | "simplify" | "favorite",
): AssistantSpeech {
  if (!agent) {
    return {
      text: applyTone("まだ分析データが少ないよ。数回生成すると、もっと提案できるよ。", tone),
      emotion: "tired",
      actions: [],
    };
  }

  // hint が指定されていれば、対応するアクション中心の発話に差し替える
  if (hint === "bold") {
    return {
      text: applyTone("🔥 攻めるなら、神引きカオス＋バズ寄せで意外性を狙う構成にしてみる？", tone),
      emotion: "bold",
      actions: ["go_bold", "see_alternative"],
    };
  }
  if (hint === "simplify") {
    return {
      text: applyTone("🧹 変更範囲を絞ってシンプルに。神引きと補助は一旦解除しよう。", tone),
      emotion: "idea",
      actions: ["simplify", "see_alternative"],
    };
  }
  if (hint === "favorite") {
    return {
      text: applyTone("⭐ お気に入り傾向ONで好みの方向に寄せた案を作るよ。", tone),
      emotion: "idea",
      actions: ["favorite_bias"],
    };
  }

  // 通常：高severity問題があれば警告、なければトップ推奨を発話
  const highProblem = agent.problems.find((p) => p.severity === "high");
  if (highProblem) {
    return {
      text: applyTone(highProblem.text, tone),
      emotion: "warn",
      actions: agent.actions.slice(0, 3).map((a) => a.id),
    };
  }

  const mediumProblem = agent.problems.find((p) => p.severity === "medium");
  if (mediumProblem) {
    return {
      text: applyTone(mediumProblem.text, tone),
      emotion: "warn",
      actions: agent.actions.slice(0, 2).map((a) => a.id),
    };
  }

  if (agent.recommendations.length > 0) {
    return {
      text: applyTone(agent.recommendations[0], tone),
      emotion: "idea",
      actions: agent.actions.slice(0, 2).map((a) => a.id),
    };
  }

  // 何も問題なし
  return {
    text: applyTone("今の設定は安定してるよ。このまま生成してOK！", tone),
    emotion: "celebrate",
    actions: agent.actions.slice(0, 2).map((a) => a.id),
  };
}

/** アクションIDの表示ラベル（短いボタン用） */
export const ACTION_SHORT_LABEL: Record<AgentActionId, string> = {
  apply:           "✨ 反映",
  see_alternative: "🎭 別案",
  avoid_overlap:   "🔁 回避",
  favorite_bias:   "⭐ 好み",
  simplify:        "🧹 シンプル",
  go_bold:         "⚡ 攻める",
};
