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
 * ┌─ 3D Canvas（静的シルエット＋OrbitControls）─┐
 * ├─ 生成プロンプトに使われる文（プレビュー）──┤
 * └────────────────────────────────────────────┘
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

const TARGET = new THREE.Vector3(0, 3.6, 0);
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

// ─── 静的シルエット（被写体の大きさ・向きの視覚基準。関節なし） ──────────────────

function StaticSilhouette() {
  return (
    <group>
      {/* 頭 */}
      <mesh position={[0, 6.4, 0]}>
        <sphereGeometry args={[0.55, 24, 16]} />
        <meshStandardMaterial color="#e8d9ff" emissive="#5a3fff" emissiveIntensity={0.15} />
      </mesh>
      {/* 胴（カプセル） */}
      <mesh position={[0, 3.4, 0]}>
        <capsuleGeometry args={[0.6, 4.4, 6, 12]} />
        <meshStandardMaterial color="#bda7ff" emissive="#5a3fff" emissiveIntensity={0.08} />
      </mesh>
      {/* 接地リング（足元の基準） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[1.1, 1.2, 48]} />
        <meshBasicMaterial color="#3a3550" side={THREE.DoubleSide} />
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
      {/* ── 3D Canvas ────────────────────────────────────────── */}
      <div className="relative h-[220px] bg-[#0c0f15]">
        <Canvas camera={{ position: initCamPos, fov: 35, near: 0.1, far: 100 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 8, 5]} intensity={0.7} />
            <directionalLight position={[-4, 4, -3]} intensity={0.25} color="#9d8bff" />
            <StaticSilhouette />
            <axesHelper args={[2.5]} position={[0, 0.02, 0]} />
            <OrbitControls target={[TARGET.x, TARGET.y, TARGET.z]}
              enableDamping dampingFactor={0.08} minDistance={2} maxDistance={12} />
            <CameraReporter onReport={handleReport} />
          </Suspense>
        </Canvas>
        <div className="absolute top-2 left-2 text-[10px] text-white/40 bg-black/50 rounded px-2 py-1 pointer-events-none select-none">
          ドラッグ：回転　／　ホイール：ズーム
        </div>
      </div>

      {/* ── 出力プレビュー文 ──────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-bg-border/20">
        <div className="rounded-lg border border-bg-border bg-bg-base/60 px-3 py-2 text-xs leading-relaxed">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">生成プロンプトに使われる文</div>
          <div className="text-text-base">{previewText}</div>
        </div>
      </div>
    </div>
  );
}
