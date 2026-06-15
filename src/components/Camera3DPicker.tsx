/**
 * Camera3DPicker — カメラアングル専用 3D ピッカー
 *
 * 3Dビューをマウスで操作してカメラアングルを決めるだけのツール。
 *   - ドラッグ回転 → yaw / pitch
 *   - ホイールズーム → distance（→ compositionFromDistance で構図語を自動決定）
 * 操作結果は describeCameraAngle で日本語のカメラ語句へ変換し、
 * details.camera.custom3D として親へ emit する。
 * roll（ダッチ）/ preset は本ツールでは扱わず固定（roll=0 / preset=null）。
 *
 * 被写体は静的な簡易マネキン（lathe胴＋カプセル四肢・関節なし＝ポーズ機能ではない）。
 * 背景は白。yaw/pitch/distance の取得と describeCameraAngle 出力は不変（表示のみ）。
 *
 * ┌─ 左：3D Canvas（3:4 縦長・白背景・人型大きめ）─┬─ 右：出力文 ─┐
 * └──────────────────────────────────────────────┴──────────────┘
 */

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  DEFAULT_CAMERA_3D,
  compositionFromDistance,
  describeCameraAngle,
  type Camera3DState,
} from "../lib/cameraAngle";

interface Props {
  value: Camera3DState | null;
  onChange: (next: Camera3DState | null) => void;
}

// ─── カメラ計算 ────────────────────────────────────────────────────────────────

const TARGET = new THREE.Vector3(0, 4.7, 0);
function d2r(d: number) { return (d * Math.PI) / 180; }
function r2d(r: number) { return (r * 180) / Math.PI; }

function stateToCamPos(yaw: number, pitch: number, dist: number): [number, number, number] {
  return [
    TARGET.x + Math.cos(d2r(pitch)) * Math.sin(d2r(yaw)) * dist,
    TARGET.y + Math.sin(d2r(pitch)) * dist,
    TARGET.z + Math.cos(d2r(pitch)) * Math.cos(d2r(yaw)) * dist,
  ];
}

function camToState(pos: THREE.Vector3) {
  const dx = pos.x - TARGET.x, dy = pos.y - TARGET.y, dz = pos.z - TARGET.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return {
    yaw:      r2d(Math.atan2(dx, dz)),
    pitch:    r2d(Math.asin(dy / Math.max(0.0001, dist))),
    distance: dist,
  };
}

// ─── 静的マネキン（滑らかな簡易人体・関節なし・固定形状＝ポーズ機能ではない） ──────
//   - 胴は LatheGeometry（回転体）を前後に薄く潰して女性寄りのテーパー＋向き判別
//   - 四肢は CapsuleGeometry（丸い）/ 頭・目・鼻で正面/背面/横を判別
const SKIN = "#b9bdca";
const TORSO_PROFILE: THREE.Vector2[] = [
  [0.03, 3.30], [0.40, 3.48], [0.50, 3.72], [0.49, 4.00],
  [0.39, 4.45], [0.37, 4.68], [0.45, 5.02], [0.48, 5.25],
  [0.40, 5.45], [0.24, 5.60],
].map(([r, y]) => new THREE.Vector2(r, y));

function StaticSilhouette() {
  const mat = <meshStandardMaterial color={SKIN} roughness={0.8} metalness={0.04} />;
  return (
    <group>
      {/* 胴（回転体を前後に薄く＝向き判別） */}
      <mesh position={[0, 0, 0]} scale={[1, 1, 0.62]}>
        <latheGeometry args={[TORSO_PROFILE, 32]} />
        {mat}
      </mesh>

      {/* 首 */}
      <mesh position={[0, 5.52, 0]}>
        <cylinderGeometry args={[0.17, 0.19, 0.34, 16]} />
        {mat}
      </mesh>
      {/* 頭 */}
      <mesh position={[0, 6.0, 0]} scale={[0.92, 1.08, 0.86]}>
        <sphereGeometry args={[0.5, 28, 20]} />
        {mat}
      </mesh>
      {/* 目（向き＋人間味） */}
      <mesh position={[-0.17, 6.02, 0.4]}><sphereGeometry args={[0.05, 12, 8]} /><meshStandardMaterial color="#41454f" roughness={0.5} /></mesh>
      <mesh position={[0.17, 6.02, 0.4]}><sphereGeometry args={[0.05, 12, 8]} /><meshStandardMaterial color="#41454f" roughness={0.5} /></mesh>
      {/* 鼻（前面マーカー） */}
      <mesh position={[0, 5.88, 0.45]}><sphereGeometry args={[0.06, 12, 8]} /><meshStandardMaterial color="#6fb8c6" emissive="#3aa6b8" emissiveIntensity={0.3} /></mesh>

      {/* 肩 */}
      <mesh position={[-0.47, 5.35, 0]}><sphereGeometry args={[0.22, 18, 14]} />{mat}</mesh>
      <mesh position={[0.47, 5.35, 0]}><sphereGeometry args={[0.22, 18, 14]} />{mat}</mesh>
      {/* 上腕 */}
      <mesh position={[-0.55, 4.85, 0]}><capsuleGeometry args={[0.15, 0.95, 6, 12]} />{mat}</mesh>
      <mesh position={[0.55, 4.85, 0]}><capsuleGeometry args={[0.15, 0.95, 6, 12]} />{mat}</mesh>
      {/* 前腕 */}
      <mesh position={[-0.6, 3.75, 0]}><capsuleGeometry args={[0.12, 0.95, 6, 12]} />{mat}</mesh>
      <mesh position={[0.6, 3.75, 0]}><capsuleGeometry args={[0.12, 0.95, 6, 12]} />{mat}</mesh>
      {/* 手 */}
      <mesh position={[-0.61, 3.0, 0]} scale={[1, 1.4, 0.55]}><sphereGeometry args={[0.15, 14, 10]} />{mat}</mesh>
      <mesh position={[0.61, 3.0, 0]} scale={[1, 1.4, 0.55]}><sphereGeometry args={[0.15, 14, 10]} />{mat}</mesh>

      {/* 太もも */}
      <mesh position={[-0.25, 2.5, 0]}><capsuleGeometry args={[0.25, 1.2, 6, 14]} />{mat}</mesh>
      <mesh position={[0.25, 2.5, 0]}><capsuleGeometry args={[0.25, 1.2, 6, 14]} />{mat}</mesh>
      {/* すね */}
      <mesh position={[-0.23, 1.0, 0]}><capsuleGeometry args={[0.18, 1.2, 6, 14]} />{mat}</mesh>
      <mesh position={[0.23, 1.0, 0]}><capsuleGeometry args={[0.18, 1.2, 6, 14]} />{mat}</mesh>
      {/* 足（前方=+Z＝向き判別） */}
      <mesh position={[-0.23, 0.1, 0.16]}><boxGeometry args={[0.26, 0.16, 0.56]} />{mat}</mesh>
      <mesh position={[0.23, 0.1, 0.16]}><boxGeometry args={[0.26, 0.16, 0.56]} />{mat}</mesh>

      {/* 接地（白背景でのソフトな影代わり） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.05, 40]} />
        <meshBasicMaterial color="#e4e5ea" />
      </mesh>
    </group>
  );
}

// ─── カメラ位置レポーター（ドラッグ/ホイール → yaw/pitch/distance） ───────────────

function CameraReporter({
  onReport,
}: {
  onReport: (s: { yaw: number; pitch: number; distance: number }) => void;
}) {
  const last = useRef<{ yaw: number; pitch: number; distance: number } | null>(null);
  useFrame(({ camera }) => {
    const s = camToState(camera.position);
    const p = last.current;
    if (!p || Math.abs(p.yaw - s.yaw) > 0.3 || Math.abs(p.pitch - s.pitch) > 0.3 || Math.abs(p.distance - s.distance) > 0.05) {
      last.current = s;
      onReport(s);
    }
  });
  return null;
}

// ─── メインコンポーネント ──────────────────────────────────────────────────────

export default function Camera3DPicker({ value, onChange }: Props) {
  const initCam = value ?? DEFAULT_CAMERA_3D;

  const [yaw, setYaw]           = useState(initCam.yaw);
  const [pitch, setPitch]       = useState(initCam.pitch);
  const [distance, setDistance] = useState(initCam.distance);

  const composition = useMemo(() => compositionFromDistance(distance), [distance]);

  // ドラッグ/ホイール → 状態更新 ＋ 親へ emit（roll/preset は固定）
  const handleReport = (s: { yaw: number; pitch: number; distance: number }) => {
    setYaw(s.yaw); setPitch(s.pitch); setDistance(s.distance);
    const comp = compositionFromDistance(s.distance);
    onChange({ yaw: s.yaw, pitch: s.pitch, roll: 0, distance: s.distance, composition: comp, preset: null });
  };

  const previewText = useMemo(
    () => describeCameraAngle({ yaw, pitch, roll: 0, distance, composition, preset: null }),
    [yaw, pitch, distance, composition]
  );

  const initCamPos = stateToCamPos(initCam.yaw, initCam.pitch, initCam.distance);

  return (
    <div className="rounded-2xl border border-bg-border bg-bg-panel/40 overflow-hidden">
      <div className="flex gap-2.5 p-2.5">
        {/* ── 左：3D Canvas（3:4 縦長・白背景・人型大きめ） ── */}
        <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 264, height: 352, background: "#f2f3f6" }}>
          <Canvas camera={{ position: initCamPos, fov: 46, near: 0.1, far: 100 }}>
            <Suspense fallback={null}>
              <color attach="background" args={["#f2f3f6"]} />
              <ambientLight intensity={0.78} />
              <directionalLight position={[4, 8, 6]} intensity={0.85} />
              <directionalLight position={[-5, 4, -3]} intensity={0.32} color="#cdd6ff" />
              <directionalLight position={[0, 2, 7]} intensity={0.22} />
              <StaticSilhouette />
              <OrbitControls target={[TARGET.x, TARGET.y, TARGET.z]}
                enableDamping dampingFactor={0.08} minDistance={2} maxDistance={12} />
              <CameraReporter onReport={handleReport} />
            </Suspense>
          </Canvas>
          <div className="absolute top-1.5 left-1.5 text-[9px] text-black/45 bg-white/70 rounded px-1.5 py-0.5 pointer-events-none select-none leading-tight">
            ドラッグ回転／ホイール拡縮
          </div>
        </div>

        {/* ── 右：出力プレビュー文（必要十分まで縮める＝左ビュー優先） ── */}
        <div className="flex-1 min-w-0 max-w-[300px] flex items-center">
          <div className="w-full rounded-lg border border-bg-border bg-bg-base/60 px-3 py-2.5 leading-relaxed">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">生成プロンプトに使われる文</div>
            <div className="text-sm text-text-base">{previewText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
