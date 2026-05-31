/**
 * Camera3DPicker — ポーズ + カメラアングル統合3Dピッカー
 *
 * ┌─ ポーズプリセット ─────────────────────────────────┐
 * │ [自然立ち] [気をつけ] [Tポーズ] [バンザイ] ...      │
 * ├─ カメラプリセット ────────────────────────────────┤
 * │ [正面] [斜め45°] [横顔] ...                       │
 * ├─ 3D Canvas ────────────────────────────────────────┤
 * │  FK骨格をリアルタイム表示                           │
 * ├─ 関節スライダー ──────────────────────────────────┤
 * │ 腕・脚・ひじ・ひざ の2列グリッド                    │
 * ├─ カメラスライダー ────────────────────────────────┤
 * │ 水平回転・仰角・ダッチ・距離                        │
 * ├─ 構図 + プレビュー + 解除 ──────────────────────────┤
 * └───────────────────────────────────────────────────┘
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_PRESETS,
  DEFAULT_CAMERA_3D,
  compositionFromDistance,
  describeCameraAngle,
  type Camera3DState,
  type Composition,
} from "../lib/cameraAngle";
import {
  DEFAULT_POSE,
  POSE_PRESETS,
  computeJoints,
  describePose,
  type PoseState,
} from "../lib/poseLib";

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
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
  return {
    yaw:      r2d(Math.atan2(dx, dz)),
    pitch:    r2d(Math.asin(dy / Math.max(0.0001, dist))),
    distance: dist,
  };
}

// ─── FK スケルトン ─────────────────────────────────────────────────────────────

function DynamicSkeleton({ pose }: { pose: PoseState }) {
  const j = computeJoints(pose);

  const segments: [number, number, number][][] = [
    [j.neck,      j.chest],
    [j.chest,     j.waist],
    [j.lShoulder, j.rShoulder],
    [j.lShoulder, j.lElbow],
    [j.lElbow,    j.lHand],
    [j.rShoulder, j.rElbow],
    [j.rElbow,    j.rHand],
    [j.lHip,      j.rHip],
    [j.waist,     j.lHip],
    [j.waist,     j.rHip],
    [j.lHip,      j.lKnee],
    [j.lKnee,     j.lFoot],
    [j.rHip,      j.rKnee],
    [j.rKnee,     j.rFoot],
  ];

  const joints: [number, number, number][] = [
    j.neck, j.chest, j.waist,
    j.lShoulder, j.rShoulder,
    j.lElbow, j.rElbow, j.lHand, j.rHand,
    j.lHip, j.rHip, j.lKnee, j.rKnee, j.lFoot, j.rFoot,
  ];

  return (
    <group>
      <mesh position={j.head}>
        <sphereGeometry args={[0.55, 24, 16]} />
        <meshStandardMaterial color="#e8d9ff" emissive="#5a3fff" emissiveIntensity={0.15} />
      </mesh>
      {segments.map((seg, i) => (
        <Line key={i} points={seg} color="#bda7ff" lineWidth={2.2} />
      ))}
      {joints.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.09, 12, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[1.1, 1.2, 48]} />
        <meshBasicMaterial color="#3a3550" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CameraReporter({
  onChange, rollDeg, composition,
}: {
  onChange: (s: { yaw: number; pitch: number; distance: number }) => void;
  rollDeg: number;
  composition: Composition;
}) {
  const last = useRef<{ yaw: number; pitch: number; distance: number } | null>(null);
  useFrame(({ camera }) => {
    const s = camToState(camera.position);
    const p = last.current;
    if (!p || Math.abs(p.yaw-s.yaw)>0.3 || Math.abs(p.pitch-s.pitch)>0.3 || Math.abs(p.distance-s.distance)>0.05) {
      last.current = s;
      onChange(s);
    }
  });
  // suppress unused-var warnings
  void rollDeg; void composition;
  return null;
}

// ─── UIパーツ ──────────────────────────────────────────────────────────────────

const CYAN  = "rgb(34 211 238)";
const VIOLET = "rgb(167 139 250)";

function SliderRow({
  label, value, min, max, step = 1, onChange, fmt,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-white/45 w-14 shrink-0 select-none leading-none">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 cursor-pointer" style={{ accentColor: CYAN }} />
      <span className="text-[11px] font-mono text-cyan-200 w-10 text-right shrink-0 select-none">{fmt(value)}</span>
    </div>
  );
}

function PoseSliderRow({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-white/40 w-[70px] shrink-0 select-none leading-none">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 cursor-pointer" style={{ accentColor: VIOLET }} />
      <span className="text-[10px] font-mono text-violet-300 w-8 text-right shrink-0 select-none">{Math.round(value)}°</span>
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────────────────────

export default function Camera3DPicker({ value, onChange }: Props) {
  const initCam  = value ?? DEFAULT_CAMERA_3D;
  const initPose = value?.pose ?? DEFAULT_POSE;

  // カメラ状態
  const [yaw,         setYaw]         = useState(initCam.yaw);
  const [pitch,       setPitch]       = useState(initCam.pitch);
  const [roll,        setRoll]        = useState(initCam.roll);
  const [distance,    setDistance]    = useState(initCam.distance);
  const [composition, setComposition] = useState<Composition>(initCam.composition);
  const [camPreset,   setCamPreset]   = useState<string | null>(initCam.preset);

  // ポーズ状態
  const [pose, setPose] = useState<PoseState>(initPose);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // ── カメラ位置を controls に反映 ──
  const applyCamera = (y: number, p: number, d: number) => {
    const ctrl = controlsRef.current;
    if (ctrl) {
      const [x, cy, z] = stateToCamPos(y, p, d);
      ctrl.object.position.set(x, cy, z);
      ctrl.target.set(TARGET.x, TARGET.y, TARGET.z);
      ctrl.update();
    }
  };

  // ── 親へ emit ──
  const emit = (
    y: number, p: number, rl: number, d: number,
    comp: Composition, cp: string | null, ps: PoseState
  ) => {
    onChange({ yaw: y, pitch: p, roll: rl, distance: d, composition: comp, preset: cp, pose: ps });
  };

  // ── カメラプリセット ──
  const applyCamera3DPreset = (id: string) => {
    const pr = CAMERA_PRESETS.find((x) => x.id === id);
    if (!pr) return;
    setYaw(pr.yaw); setPitch(pr.pitch); setRoll(pr.roll);
    setDistance(pr.distance); setComposition(pr.composition); setCamPreset(pr.id);
    applyCamera(pr.yaw, pr.pitch, pr.distance);
    emit(pr.yaw, pr.pitch, pr.roll, pr.distance, pr.composition, pr.id, pose);
  };

  // ── ポーズプリセット ──
  const applyPosePreset = (id: string) => {
    const pr = POSE_PRESETS.find((x) => x.id === id);
    if (!pr) return;
    const next: PoseState = { ...pr.pose, preset: pr.id };
    setPose(next);
    emit(yaw, pitch, roll, distance, composition, camPreset, next);
  };

  // ── 3Dドラッグ更新 ──
  const handleCameraReport = (s: { yaw: number; pitch: number; distance: number }) => {
    setYaw(s.yaw); setPitch(s.pitch); setDistance(s.distance);
    const comp = compositionFromDistance(s.distance);
    setComposition(comp); setCamPreset(null);
    emit(s.yaw, s.pitch, roll, s.distance, comp, null, pose);
  };

  // ── カメラスライダー ──
  const updateYaw = (v: number)      => { setYaw(v);      setCamPreset(null); applyCamera(v, pitch, distance);    emit(v, pitch, roll, distance, composition, null, pose); };
  const updatePitch = (v: number)    => { setPitch(v);    setCamPreset(null); applyCamera(yaw, v, distance);      emit(yaw, v, roll, distance, composition, null, pose); };
  const updateDistance = (v: number) => { setDistance(v); setCamPreset(null); applyCamera(yaw, pitch, v); const c = compositionFromDistance(v); setComposition(c); emit(yaw, pitch, roll, v, c, null, pose); };

  useEffect(() => {
    emit(yaw, pitch, roll, distance, composition, camPreset, pose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll]);

  // ── ポーズスライダー 更新ヘルパー ──
  const updatePose = (patch: Partial<PoseState>) => {
    const next: PoseState = { ...pose, ...patch, preset: null };
    setPose(next);
    emit(yaw, pitch, roll, distance, composition, camPreset, next);
  };

  // ── 構図 ──
  const handleComposition = (c: Composition) => {
    setComposition(c); setCamPreset(null);
    emit(yaw, pitch, roll, distance, c, null, pose);
  };

  // ── プレビューテキスト ──
  const previewText = useMemo(
    () => describeCameraAngle({ yaw, pitch, roll, distance, composition, preset: camPreset }),
    [yaw, pitch, roll, distance, composition, camPreset]
  );
  const poseText = useMemo(() => describePose(pose), [pose]);

  const initCamPos = stateToCamPos(initCam.yaw, initCam.pitch, initCam.distance);

  // カメラプリセットを2グループに分割
  const anglePresets   = CAMERA_PRESETS.filter((p) => ["front","diagonal45","side","back","low","high","top_down","over_shoulder","dutch"].includes(p.id));
  const framingPresets = CAMERA_PRESETS.filter((p) => ["full_body","bust_up","face_up"].includes(p.id));

  return (
    <div className="rounded-2xl border border-bg-border bg-bg-panel/40 overflow-hidden">

      {/* ── ポーズプリセット ──────────────────────────────────── */}
      <div className="px-3 pt-2.5 pb-2 border-b border-bg-border/30">
        <div className="text-[10px] text-white/35 mb-1.5 select-none tracking-wide">ポーズ</div>
        <div className="flex flex-wrap gap-1.5">
          {POSE_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => applyPosePreset(p.id)}
              className={[
                "rounded-full text-[11px] px-2.5 py-1 border transition",
                pose.preset === p.id
                  ? "border-violet-300 bg-violet-400/20 text-violet-100"
                  : "border-bg-border bg-bg-panel text-white/50 hover:border-violet-400/40 hover:text-white/85",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── カメラ角度プリセット ──────────────────────────────── */}
      <div className="px-3 pt-2 pb-1.5 border-b border-bg-border/30">
        <div className="text-[10px] text-white/35 mb-1.5 select-none tracking-wide">カメラ角度</div>
        <div className="flex flex-wrap gap-1.5">
          {anglePresets.map((p) => (
            <button key={p.id} type="button" onClick={() => applyCamera3DPreset(p.id)}
              className={[
                "rounded-full text-[11px] px-2.5 py-1 border transition",
                camPreset === p.id
                  ? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
                  : "border-bg-border bg-bg-panel text-white/50 hover:border-cyan-400/40 hover:text-white/85",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── フレーミングプリセット ────────────────────────────── */}
      <div className="px-3 pt-1.5 pb-2 border-b border-bg-border/30">
        <div className="text-[10px] text-white/35 mb-1.5 select-none tracking-wide">フレーミング</div>
        <div className="flex flex-wrap gap-1.5">
          {framingPresets.map((p) => (
            <button key={p.id} type="button" onClick={() => applyCamera3DPreset(p.id)}
              className={[
                "rounded-full text-[11px] px-2.5 py-1 border transition",
                camPreset === p.id
                  ? "border-emerald-300 bg-emerald-400/20 text-emerald-100"
                  : "border-bg-border bg-bg-panel text-white/50 hover:border-emerald-400/40 hover:text-white/85",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3D Canvas ────────────────────────────────────────── */}
      <div className="relative h-[220px] bg-[#0c0f15]">
        <Canvas camera={{ position: initCamPos, fov: 35, near: 0.1, far: 100 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 8, 5]} intensity={0.7} />
            <directionalLight position={[-4, 4, -3]} intensity={0.25} color="#9d8bff" />
            <DynamicSkeleton pose={pose} />
            <axesHelper args={[2.5]} position={[0, 0.02, 0]} />
            <OrbitControls ref={controlsRef} target={[TARGET.x, TARGET.y, TARGET.z]}
              enableDamping dampingFactor={0.08} minDistance={2} maxDistance={12} />
            <CameraReporter onChange={handleCameraReport} rollDeg={roll} composition={composition} />
          </Suspense>
        </Canvas>
        <div className="absolute top-2 left-2 text-[10px] text-white/40 bg-black/50 rounded px-2 py-1 pointer-events-none select-none">
          ドラッグ：回転　／　ホイール：ズーム
        </div>
      </div>

      {/* ── 関節スライダー ────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-bg-border/30 space-y-3">
        {/* 腕 */}
        <div>
          <div className="text-[10px] text-violet-400/70 mb-2 select-none font-semibold tracking-wide">腕の調整</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2">
            <PoseSliderRow label="左腕の高さ"  value={pose.lArmAngle}   min={0}   max={175} onChange={(v) => updatePose({ lArmAngle: v })} />
            <PoseSliderRow label="右腕の高さ"  value={pose.rArmAngle}   min={0}   max={175} onChange={(v) => updatePose({ rArmAngle: v })} />
            <PoseSliderRow label="左腕の前後"  value={pose.lArmForward} min={-60} max={90}  onChange={(v) => updatePose({ lArmForward: v })} />
            <PoseSliderRow label="右腕の前後"  value={pose.rArmForward} min={-60} max={90}  onChange={(v) => updatePose({ rArmForward: v })} />
            <PoseSliderRow label="左ひじ曲げ"  value={pose.lElbow}      min={0}   max={145} onChange={(v) => updatePose({ lElbow: v })} />
            <PoseSliderRow label="右ひじ曲げ"  value={pose.rElbow}      min={0}   max={145} onChange={(v) => updatePose({ rElbow: v })} />
          </div>
        </div>
        {/* 脚 */}
        <div>
          <div className="text-[10px] text-violet-400/70 mb-2 select-none font-semibold tracking-wide">脚の調整</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2">
            <PoseSliderRow label="左脚の前後"  value={pose.lLegForward} min={-30} max={90}  onChange={(v) => updatePose({ lLegForward: v })} />
            <PoseSliderRow label="右脚の前後"  value={pose.rLegForward} min={-30} max={90}  onChange={(v) => updatePose({ rLegForward: v })} />
            <PoseSliderRow label="左ひざ曲げ"  value={pose.lKnee}       min={0}   max={120} onChange={(v) => updatePose({ lKnee: v })} />
            <PoseSliderRow label="右ひざ曲げ"  value={pose.rKnee}       min={0}   max={120} onChange={(v) => updatePose({ rKnee: v })} />
          </div>
        </div>
      </div>

      {/* ── カメラスライダー ──────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2.5 border-t border-bg-border/30">
        <div className="text-[10px] text-cyan-400/70 mb-1 select-none font-semibold tracking-wide">カメラ調整</div>
        <SliderRow label="水平回転" value={Math.round(yaw)}      min={-180} max={180} onChange={updateYaw}      fmt={(v) => `${v}°`} />
        <SliderRow label="仰　　角" value={Math.round(pitch)}    min={-60}  max={60}  onChange={updatePitch}    fmt={(v) => `${v}°`} />
        <SliderRow label="ダッチ"   value={Math.round(roll)}     min={-45}  max={45}  onChange={setRoll}        fmt={(v) => `${v}°`} />
        <SliderRow label="距　　離" value={parseFloat(distance.toFixed(1))} min={2} max={12} step={0.5} onChange={updateDistance} fmt={(v) => v.toFixed(1)} />
      </div>

      {/* ── 構図 ──────────────────────────────────────────────── */}
      <div className="px-4 pb-2.5 flex flex-wrap items-center gap-1.5 border-t border-bg-border/20 pt-2.5">
        <span className="text-[11px] text-white/35 mr-0.5 select-none">構図</span>
        {(["face","bust","waist","full","wide"] as Composition[]).map((c) => (
          <button key={c} type="button" onClick={() => handleComposition(c)}
            className={[
              "rounded-full text-[11px] px-2.5 py-1 border transition",
              composition === c
                ? "border-emerald-400 bg-emerald-400/20 text-emerald-100"
                : "border-bg-border bg-bg-panel text-white/50 hover:text-white/85",
            ].join(" ")}
          >
            {compLabel(c)}
          </button>
        ))}
      </div>

      {/* ── プレビューテキスト ──────────────────────────────────── */}
      <div className="px-4 pb-3 border-t border-bg-border/20 pt-2.5 space-y-1.5">
        <div className="rounded-lg border border-bg-border bg-bg-base/60 px-3 py-2 text-xs leading-relaxed">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">生成プロンプトに使われる文</div>
          <div className="text-text-base">{previewText}</div>
          {poseText && (
            <div className="text-violet-200 mt-1">{poseText}</div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button type="button"
            onClick={() => {
              setYaw(0); setPitch(0); setRoll(0); setDistance(5); setComposition("bust"); setCamPreset("front");
              applyCamera(0, 0, 5);
              setPose(DEFAULT_POSE);
              emit(0, 0, 0, 5, "bust", "front", DEFAULT_POSE);
            }}
            className="text-[11px] text-white/35 hover:text-white/65 transition px-2 py-1 rounded-lg border border-transparent hover:border-bg-border"
          >
            ↺ 全リセット
          </button>
          <button type="button" onClick={() => onChange(null)}
            className="text-[11px] text-white/35 hover:text-rose-300 transition"
          >
            3D 指定を解除（プリセットに戻す）
          </button>
        </div>
      </div>
    </div>
  );
}

function compLabel(c: Composition): string {
  return c === "face" ? "顔アップ" : c === "bust" ? "バスト" : c === "waist" ? "腰上" : c === "full" ? "全身" : "広角";
}
