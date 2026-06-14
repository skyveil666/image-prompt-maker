import type { Scope } from "../types";

/**
 * 全スコープ（変更対象軸）の日本語表示ラベルの単一ソース。
 *
 * フロント全体の Scope→ラベル表示はここを参照する（重複定義・表記ドリフト防止）。
 * 以前は各コンポーネント/libに同じマップが10箇所以上コピーされ、値がドリフトしていた
 * （camera=カメラ/カメラアングル、props=持ち物/小物/持ち物・小物 等）。ここに一本化する。
 *
 * ※サーバ側（server/src/promptSystem.ts・scopeFilter.ts）は別ビルドのため共有しない。
 */
export const ALL_SCOPE_LABELS: Record<Scope, string> = {
  background:   "背景",
  foreground:   "前景演出",
  pose:         "ポーズ",
  hair:         "髪",
  outfit:       "衣装",
  cosplay:      "コスプレ",
  cyber:        "🦾 メカ",
  camera:       "カメラ",
  props:        "持ち物",
  big_object:   "大物",
  vehicle:      "乗り物",
  myth:         "神話/幻獣",
  lighting:     "ライティング",
  aspect_ratio: "アスペクト比",
};
