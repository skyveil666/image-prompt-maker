/**
 * SkyveilBar — メイン画面の「skyveil好みAI」操作バー。
 *
 * 🧬 2026-06-18（タスクA・Tier-1c）: skyveil「あなたの好み」機能を撤去。
 *   本コンポーネントは UI を全面非表示にする（return null）。
 *   - Props 型・呼び出し側（App / BoostArea / 分析センター slot）は無改修＝配線温存。
 *   - 生成への反映停止は App.tsx の buildInputs 側で恒久 OFF 済み
 *     （preferenceProfile / ratingBias / favoriteTraits / favoriteStrength を送らない）。
 *   - お気に入り・履歴・学習データ（localStorage / IndexedDB）には一切触れない。
 *   - 機能を復帰する場合は git からこのコンポーネントの旧実装を戻す。
 */

import type { SkyveilProfile, SkyveilStrength } from "../lib/skyveilProfile";
import type { SuccessPromptPattern } from "../lib/successPatterns";

interface Props {
  enabled: boolean;
  strength: SkyveilStrength;
  profile: SkyveilProfile;
  analyzing?: boolean;
  /** 実Gemini分析のサンプル数（更新ボタンの有効/無効に使う） */
  sampleCount?: number;
  minSamples?: number;
  /** 今回だけ反映が予約されているか */
  oneShotArmed: boolean;
  /** true＝操作不可の読み取り専用表示（分析センター確認用）。操作の主入口は生成画面側。 */
  readOnly?: boolean;

  onToggle?: (v: boolean) => void;
  onStrength?: (s: SkyveilStrength) => void;
  onUpdateAnalysis?: () => void;
  onOneShot?: () => void;
  onReset?: () => void;

  // ── M-3 で移設（DuplicateAnalysisPanel から集約・既存ハンドラ再利用） ──
  /** 直近の分析エラー（成功時 null） */
  profileError?: string | null;
  /** 自動学習 ON/OFF */
  autoLearnEnabled?: boolean;
  onToggleAutoLearn?: (enabled: boolean) => void;
  /** 好み分析プロファイルの削除（学習データ削除＝反映リセットとは別物） */
  onClearProfile?: () => void;

  /** 成功プロンプト抽出（#9） */
  successPatterns?: SuccessPromptPattern[];
  onApplyPattern?: (pattern: SuccessPromptPattern) => void;
}

/**
 * skyveil「あなたの好み」UI は撤去済み（タスクA・Tier-1c）。
 * Props は呼び出し側（App / BoostArea / 分析センター slot）の型互換のため維持し、描画はしない。
 */
export function SkyveilBar(_props: Props) {
  return null;
}
