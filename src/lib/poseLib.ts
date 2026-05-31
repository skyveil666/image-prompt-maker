/**
 * ポーズ状態・プリセット・FK骨格計算ユーティリティ。
 *
 * 座標系:
 *   Y = 上方向  X = 右方向  Z = カメラ（画面手前）方向
 *
 * 腕アングル定義:
 *   0° = 真下  90° = 横水平(Tポーズ)  180° = 真上
 *
 * 脚フォワード定義:
 *   0° = 真下  正 = 前（カメラ方向）  負 = 後ろ
 *
 * ひじ/ひざ曲げ:
 *   0 = 伸ばした状態  145/120 = 最大に曲げた状態
 */

export interface PoseState {
  preset: string | null;

  // 腕の高さ（0=真下 90=水平Tポーズ 180=真上）
  lArmAngle: number;
  rArmAngle: number;

  // 腕の前後スイング（正=前 負=後ろ）
  lArmForward: number;
  rArmForward: number;

  // ひじ曲げ（0=伸ばす 145=最大）
  lElbow: number;
  rElbow: number;

  // 脚の前後スイング（正=前キック 負=後ろ）
  lLegForward: number;
  rLegForward: number;

  // ひざ曲げ（0=伸ばす 120=最大）
  lKnee: number;
  rKnee: number;
}

// ─── FK helpers ────────────────────────────────────────────────────────────────

type Pt = [number, number, number];

function d2r(d: number) { return (d * Math.PI) / 180; }
function add(a: Pt, b: Pt): Pt { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function scale(v: Pt, s: number): Pt { return [v[0]*s, v[1]*s, v[2]*s]; }

/** Z軸まわりの回転 (frontal plane) */
function rotZ(v: Pt, deg: number): Pt {
  const r = d2r(deg), c = Math.cos(r), s = Math.sin(r);
  return [v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2]];
}

/** X軸まわりの回転 (sagittal plane) */
function rotX(v: Pt, deg: number): Pt {
  const r = d2r(deg), c = Math.cos(r), s = Math.sin(r);
  return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c];
}

// ─── 固定ジョイント位置 ─────────────────────────────────────────────────────────

const HEAD:       Pt = [0, 7.2, 0];
const NECK:       Pt = [0, 6.4, 0];
const CHEST:      Pt = [0, 5.5, 0];
const WAIST:      Pt = [0, 3.9, 0];
const L_SHOULDER: Pt = [-1.1, 6.2, 0];
const R_SHOULDER: Pt = [ 1.1, 6.2, 0];
const L_HIP:      Pt = [-0.7, 3.6, 0];
const R_HIP:      Pt = [ 0.7, 3.6, 0];

// ─── ボーン長 ──────────────────────────────────────────────────────────────────

const UPPER_ARM = 1.36;
const FOREARM   = 1.51;
const UPPER_LEG = 1.70;
const LOWER_LEG = 1.85;

// ─── 計算済みジョイント型 ──────────────────────────────────────────────────────

export interface SkeletonJoints {
  head: Pt; neck: Pt; chest: Pt; waist: Pt;
  lShoulder: Pt; rShoulder: Pt;
  lElbow: Pt; rElbow: Pt;
  lHand: Pt; rHand: Pt;
  lHip: Pt; rHip: Pt;
  lKnee: Pt; rKnee: Pt;
  lFoot: Pt; rFoot: Pt;
}

/**
 * PoseState → 全ジョイントのワールド座標を計算（FK）。
 * 腕はZY平面内で回転後、X軸で前後スイング。
 * ひじ曲げはZ軸回転で近似。
 */
export function computeJoints(pose: PoseState): SkeletonJoints {
  // ── 左腕 ──
  let lArmDir: Pt = [
    -Math.sin(d2r(pose.lArmAngle)),
    -Math.cos(d2r(pose.lArmAngle)),
    0,
  ];
  lArmDir = rotX(lArmDir, pose.lArmForward);
  const lElbow: Pt = add(L_SHOULDER, scale(lArmDir, UPPER_ARM));
  const lForearmDir = rotZ(lArmDir, pose.lElbow);
  const lHand: Pt   = add(lElbow, scale(lForearmDir, FOREARM));

  // ── 右腕（左右ミラー） ──
  let rArmDir: Pt = [
    Math.sin(d2r(pose.rArmAngle)),
    -Math.cos(d2r(pose.rArmAngle)),
    0,
  ];
  rArmDir = rotX(rArmDir, pose.rArmForward);
  const rElbow: Pt      = add(R_SHOULDER, scale(rArmDir, UPPER_ARM));
  const rForearmDir     = rotZ(rArmDir, -pose.rElbow);
  const rHand: Pt       = add(rElbow, scale(rForearmDir, FOREARM));

  // ── 左脚 ──
  const lUpperLegDir: Pt = rotX([0, -1, 0], -pose.lLegForward);
  const lKneeJoint: Pt   = add(L_HIP, scale(lUpperLegDir, UPPER_LEG));
  const lLowerLegDir: Pt = rotX([0, -1, 0], -pose.lLegForward + pose.lKnee);
  const lFoot: Pt        = add(lKneeJoint, scale(lLowerLegDir, LOWER_LEG));

  // ── 右脚 ──
  const rUpperLegDir: Pt = rotX([0, -1, 0], -pose.rLegForward);
  const rKneeJoint: Pt   = add(R_HIP, scale(rUpperLegDir, UPPER_LEG));
  const rLowerLegDir: Pt = rotX([0, -1, 0], -pose.rLegForward + pose.rKnee);
  const rFoot: Pt        = add(rKneeJoint, scale(rLowerLegDir, LOWER_LEG));

  return {
    head: HEAD, neck: NECK, chest: CHEST, waist: WAIST,
    lShoulder: L_SHOULDER, rShoulder: R_SHOULDER,
    lElbow,  rElbow,
    lHand,   rHand,
    lHip: L_HIP, rHip: R_HIP,
    lKnee: lKneeJoint, rKnee: rKneeJoint,
    lFoot,  rFoot,
  };
}

// ─── ポーズ自然言語記述 ────────────────────────────────────────────────────────

export function describePose(p: PoseState): string {
  const parts: string[] = [];

  // 腕
  const bothArmsUp    = p.lArmAngle > 125 && p.rArmAngle > 125;
  const oneArmUp      = !bothArmsUp && (p.lArmAngle > 125 || p.rArmAngle > 125);
  const armsWide      = p.lArmAngle > 65 && p.rArmAngle > 65 && Math.abs(p.lArmForward) < 30 && Math.abs(p.rArmForward) < 30;
  const armsForward   = p.lArmForward > 45 && p.rArmForward > 45;
  const elbowsBent    = p.lElbow > 55 && p.rElbow > 55;
  const guardStance   = armsForward && elbowsBent;

  if (bothArmsUp)   parts.push("両手を高く上げたポーズ");
  else if (oneArmUp) {
    const side = p.lArmAngle > 125 ? "左手" : "右手";
    parts.push(`${side}を上に挙げたポーズ`);
  } else if (guardStance) parts.push("両腕を前に構えた格闘スタンス");
  else if (armsForward)   parts.push("両腕を前方に伸ばしたポーズ");
  else if (armsWide)      parts.push("両腕を横に広げた開放的なポーズ");

  // 脚
  const sitting   = p.lLegForward > 65 && p.rLegForward > 65 && p.lKnee > 65 && p.rKnee > 65;
  const squatting = p.lKnee > 45 && p.rKnee > 45 && p.lLegForward < 55 && p.rLegForward < 55;
  const running   = Math.abs(p.lLegForward - p.rLegForward) > 35;
  const kneeling  = (p.lLegForward > 65 && p.lKnee > 65) || (p.rLegForward > 65 && p.rKnee > 65);

  if (sitting)        parts.push("座位（腰を下ろした姿勢）");
  else if (squatting) parts.push("しゃがんだ姿勢");
  else if (running)   parts.push("歩行・走行のポーズ");
  else if (kneeling)  parts.push("片膝を折った姿勢");

  return parts.length > 0 ? parts.join("、") + "。" : "";
}

// ─── デフォルト ────────────────────────────────────────────────────────────────

export const DEFAULT_POSE: PoseState = {
  preset: "stand_neutral",
  lArmAngle: 17, rArmAngle: 17,
  lArmForward: 0,  rArmForward: 0,
  lElbow: 0,       rElbow: 0,
  lLegForward: 0,  rLegForward: 0,
  lKnee: 0,        rKnee: 0,
};

// ─── ポーズプリセット定義 ──────────────────────────────────────────────────────

export interface PosePreset {
  id: string;
  label: string;
  pose: Omit<PoseState, "preset">;
}

export const POSE_PRESETS: PosePreset[] = [
  {
    id: "stand_neutral",
    label: "自然立ち",
    pose: { lArmAngle:17, rArmAngle:17, lArmForward:0,  rArmForward:0,  lElbow:0,  rElbow:0,  lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "attention",
    label: "気をつけ",
    pose: { lArmAngle:4,  rArmAngle:4,  lArmForward:0,  rArmForward:0,  lElbow:0,  rElbow:0,  lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "t_pose",
    label: "Tポーズ",
    pose: { lArmAngle:90, rArmAngle:90, lArmForward:0,  rArmForward:0,  lElbow:0,  rElbow:0,  lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "banzai",
    label: "バンザイ",
    pose: { lArmAngle:150,rArmAngle:150,lArmForward:0,  rArmForward:0,  lElbow:12, rElbow:12, lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "raise_right",
    label: "右手挙げ",
    pose: { lArmAngle:17, rArmAngle:155,lArmForward:0,  rArmForward:0,  lElbow:0,  rElbow:0,  lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "arms_wide",
    label: "腕を広げる",
    pose: { lArmAngle:72, rArmAngle:72, lArmForward:0,  rArmForward:0,  lElbow:0,  rElbow:0,  lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "fight_guard",
    label: "格闘ガード",
    pose: { lArmAngle:35, rArmAngle:35, lArmForward:55, rArmForward:55, lElbow:100,rElbow:100,lLegForward:10, rLegForward:10, lKnee:0,   rKnee:0  },
  },
  {
    id: "reach_forward",
    label: "前に手を伸ばす",
    pose: { lArmAngle:17, rArmAngle:17, lArmForward:80, rArmForward:80, lElbow:15, rElbow:15, lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "prayer",
    label: "お祈り",
    pose: { lArmAngle:42, rArmAngle:42, lArmForward:58, rArmForward:58, lElbow:85, rElbow:85, lLegForward:0,  rLegForward:0,  lKnee:0,   rKnee:0  },
  },
  {
    id: "running",
    label: "走り",
    pose: { lArmAngle:17, rArmAngle:17, lArmForward:-28,rArmForward:28, lElbow:70, rElbow:70, lLegForward:48, rLegForward:-25,lKnee:0,   rKnee:48 },
  },
  {
    id: "sitting",
    label: "座り",
    pose: { lArmAngle:17, rArmAngle:17, lArmForward:0,  rArmForward:0,  lElbow:0,  rElbow:0,  lLegForward:80, rLegForward:80, lKnee:88,  rKnee:88 },
  },
  {
    id: "squat",
    label: "しゃがみ",
    pose: { lArmAngle:17, rArmAngle:17, lArmForward:25, rArmForward:25, lElbow:0,  rElbow:0,  lLegForward:25, rLegForward:25, lKnee:82,  rKnee:82 },
  },
];
