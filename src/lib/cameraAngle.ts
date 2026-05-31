/**
 * 3D カメラアングル状態とプリセット、自然言語記述化のユーティリティ。
 *  - yaw    : Y軸回り（被写体を中心にした水平回転） -180〜180°。0=正面、+90=右側、180=背面
 *  - pitch  : X軸回り（俯瞰⇄あおり） -90〜90°。0=水平、正=ハイ、負=ロー
 *  - roll   : Z軸回り（ダッチアングル） -45〜45°
 *  - distance: 被写体中心〜カメラの距離（単位：頭身相当） 2.0(顔)〜10.0(超広角引き)
 */

export interface Camera3DState {
  yaw: number;
  pitch: number;
  roll: number;
  distance: number;
  composition: Composition;
  /** 直近に選んだプリセット id（再 hydrate 用）。手動操作で null。 */
  preset: string | null;
  /** ポーズ状態（null = デフォルト自然立ち）*/
  pose?: import("./poseLib").PoseState | null;
}

export type Composition =
  | "face"
  | "bust"
  | "waist"
  | "full"
  | "wide";

export const DEFAULT_CAMERA_3D: Camera3DState = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  distance: 5.0,
  composition: "bust",
  preset: "front",
};

export interface CameraPreset {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  roll: number;
  distance: number;
  composition: Composition;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: "front", label: "正面", yaw: 0, pitch: 0, roll: 0, distance: 5.0, composition: "bust" },
  { id: "diagonal45", label: "斜め45度", yaw: 45, pitch: 0, roll: 0, distance: 5.0, composition: "bust" },
  { id: "side", label: "横顔", yaw: 90, pitch: 0, roll: 0, distance: 4.5, composition: "bust" },
  { id: "back", label: "背面", yaw: 180, pitch: 0, roll: 0, distance: 5.0, composition: "bust" },
  { id: "low", label: "ローアングル", yaw: 0, pitch: -25, roll: 0, distance: 5.0, composition: "full" },
  { id: "high", label: "ハイアングル", yaw: 0, pitch: 28, roll: 0, distance: 5.0, composition: "full" },
  { id: "top_down", label: "上空俯瞰", yaw: 0, pitch: 70, roll: 0, distance: 6.0, composition: "full" },
  { id: "over_shoulder", label: "肩越し", yaw: 30, pitch: 8, roll: 0, distance: 3.5, composition: "bust" },
  { id: "dutch", label: "ダッチアングル", yaw: 25, pitch: -5, roll: 18, distance: 5.0, composition: "bust" },
  { id: "full_body", label: "全身", yaw: 0, pitch: 0, roll: 0, distance: 8.0, composition: "full" },
  { id: "bust_up", label: "バストアップ", yaw: 0, pitch: 0, roll: 0, distance: 4.5, composition: "bust" },
  { id: "face_up", label: "顔アップ", yaw: 0, pitch: 0, roll: 0, distance: 2.5, composition: "face" },
];

const COMPOSITION_JA: Record<Composition, string> = {
  face: "顔アップ構図",
  bust: "バストアップ構図",
  waist: "腰までの構図",
  full: "全身構図",
  wide: "引きの広角構図",
};

/** 距離から構図を自動推定する（プリセット読み込み時の補助）。 */
export function compositionFromDistance(distance: number): Composition {
  if (distance < 3.0) return "face";
  if (distance < 5.0) return "bust";
  if (distance < 6.5) return "waist";
  if (distance < 8.5) return "full";
  return "wide";
}

/**
 * カメラ状態を日本語の自然な構図説明に変換する。
 * Gemini に貼ると、そのまま「カメラ：...」セクションに使える文字列。
 */
export function describeCameraAngle(c: Camera3DState): string {
  const parts: string[] = [];

  // Yaw（水平）
  const yawN = ((c.yaw % 360) + 540) % 360 - 180; // -180..180 に正規化
  const yawAbs = Math.abs(yawN);
  if (yawAbs < 8) {
    parts.push("正面構図");
  } else if (yawAbs >= 170) {
    parts.push("背面構図");
  } else if (yawAbs > 80 && yawAbs < 100) {
    parts.push(yawN > 0 ? "右側からの真横（横顔）" : "左側からの真横（横顔）");
  } else if (yawN > 0) {
    parts.push(`右斜め${Math.round(yawAbs)}度`);
  } else {
    parts.push(`左斜め${Math.round(yawAbs)}度`);
  }

  // Pitch（仰角）
  if (c.pitch > 55) parts.push("真上からの俯瞰");
  else if (c.pitch > 15) parts.push(`ハイアングル（${Math.round(c.pitch)}度見下ろし）`);
  else if (c.pitch < -55) parts.push("極端なローアングル");
  else if (c.pitch < -15) parts.push(`ローアングル（${Math.round(Math.abs(c.pitch))}度あおり）`);
  else parts.push("ほぼ水平視点");

  // Roll（ダッチ）
  if (Math.abs(c.roll) > 5) {
    parts.push(`ダッチアングル（${c.roll > 0 ? "右" : "左"}に${Math.round(Math.abs(c.roll))}度傾ける）`);
  }

  // Composition
  parts.push(COMPOSITION_JA[c.composition]);

  return parts.join("、") + "。";
}
