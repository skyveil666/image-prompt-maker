import { SkyveilBar } from "../SkyveilBar";
import { BoostControls } from "../BoostControls";
import { MIN_SAMPLES } from "../../lib/preferenceProfile";
import { STRENGTH_TO_FAVORITE, type SkyveilStrength, type SkyveilProfile } from "../../lib/skyveilProfile";
import type { SuccessPromptPattern } from "../../lib/successPatterns";
import type { ZozoTrend } from "../../lib/zozoTrend";
import type { Scope } from "../../types";
import type { WorldPreset } from "../QuickActions";

interface BoostAreaProps {
  // 🧬 skyveil好み（SkyveilBar）
  favoriteLearnEnabled: boolean;
  skyveilStrength: SkyveilStrength;
  skyveilProfile: SkyveilProfile;
  analyzingProfile: boolean;
  profileSampleCount: number;
  skyveilOneShot: boolean;
  profileError: string | null;
  autoLearnEnabled: boolean;
  successPatterns: SuccessPromptPattern[];
  setFavoriteLearnEnabled: (v: boolean) => void;
  setSkyveilOneShot: (v: boolean) => void;
  setFavoriteStrength: (n: number) => void;
  onUpdateAnalysis: () => void;
  onToggleAutoLearn: (enabled: boolean) => void;
  onClearProfile: () => void;
  onApplyPattern: (pattern: SuccessPromptPattern) => void;
  // 👗 ZOZO / 🌬 風（BoostControls）
  scopes: Scope[];
  activeGodModes: string[];
  activeWorldPresets: WorldPreset[];
  zozoApplied: ZozoTrend | null;
  windLevel: number;
  setZozoApplied: (t: ZozoTrend | null) => void;
  setWindLevel: (n: number) => void;
  // 共通
  showPresetToast: (msg: string, hint?: string) => void;
}

/**
 * ControlPanel の boostArea スロット（好み skyveil ＋ ZOZOトレンド ＋ 風）を集約（App分割 #2）。
 * トグル/トーストのクロージャは本コンポーネントが所有し、App からは値・setter・showPresetToast を受ける。
 * 葉コンポーネント SkyveilBar / BoostControls は無変更で受け渡す。発火文言・順序は App 時代と同一。
 */
export function BoostArea({
  favoriteLearnEnabled,
  skyveilStrength,
  skyveilProfile,
  analyzingProfile,
  profileSampleCount,
  skyveilOneShot,
  profileError,
  autoLearnEnabled,
  successPatterns,
  setFavoriteLearnEnabled,
  setSkyveilOneShot,
  setFavoriteStrength,
  onUpdateAnalysis,
  onToggleAutoLearn,
  onClearProfile,
  onApplyPattern,
  scopes,
  activeGodModes,
  activeWorldPresets,
  zozoApplied,
  windLevel,
  setZozoApplied,
  setWindLevel,
  showPresetToast,
}: BoostAreaProps) {
  return (
    <div className="space-y-2">
      {/* 🧬 あなたの好み（skyveil）：好み最適化の主入口。反映はユーザー操作時のみ（自動反映しない） */}
      <SkyveilBar
        enabled={favoriteLearnEnabled}
        strength={skyveilStrength}
        profile={skyveilProfile}
        analyzing={analyzingProfile}
        sampleCount={profileSampleCount}
        minSamples={MIN_SAMPLES}
        oneShotArmed={skyveilOneShot}
        onToggle={(v) => {
          setFavoriteLearnEnabled(v);
          if (v) setSkyveilOneShot(false);
          showPresetToast(v ? "🧬 あなたの好み（skyveil）反映 ON" : "あなたの好み（skyveil）反映 OFF",
            v ? `${skyveilProfile.summary || "好みを次回生成に反映します"}` : "");
        }}
        onStrength={(s) => setFavoriteStrength(STRENGTH_TO_FAVORITE[s])}
        onUpdateAnalysis={onUpdateAnalysis}
        onOneShot={() => {
          setSkyveilOneShot(true);
          showPresetToast("✨ 今回だけ あなたの好みを反映します", "次の生成にのみ適用されます（保存しません）。");
        }}
        onReset={() => {
          setFavoriteLearnEnabled(false);
          setSkyveilOneShot(false);
          showPresetToast("あなたの好み反映をリセットしました", "");
        }}
        profileError={profileError}
        autoLearnEnabled={autoLearnEnabled}
        onToggleAutoLearn={onToggleAutoLearn}
        onClearProfile={onClearProfile}
        successPatterns={successPatterns}
        onApplyPattern={onApplyPattern}
      />
      <BoostControls
        outfitScopeOn={scopes.includes("outfit")}
        outfitConflict={
          // 衣装に強い影響を与える指定がアクティブな時のみ「他指定が優先」を提示
          // （映画/レトロ等の世界観だけでは ZOZO 競合とはみなさない）
          activeGodModes.includes("outfit") ||
          activeWorldPresets.some((w) =>
            ["y2k", "y3k", "street", "gothic", "wafuu", "jirai"].includes(w)
          )
        }
        zozoApplied={zozoApplied}
        onZozoApply={(t) => {
          setZozoApplied(t);
          showPresetToast(
            t.mode === "priority"
              ? "⭐ ZOZOトレンドを優先反映に設定しました"
              : "✅ ZOZOトレンドを衣装プロンプトに反映しました",
            ""
          );
        }}
        onZozoSetPriority={(priority) => {
          if (!zozoApplied) return;
          const nextMode = priority ? "priority" : "assist";
          setZozoApplied({ ...zozoApplied, mode: nextMode });
          showPresetToast(
            priority
              ? "⭐ ZOZOを優先反映に切替"
              : "✅ ZOZOを補助反映に戻しました",
            ""
          );
        }}
        onZozoClear={() => {
          setZozoApplied(null);
          showPresetToast("ZOZOトレンドの反映を解除しました", "");
        }}
        windLevel={windLevel}
        onWindLevelChange={setWindLevel}
        windApplicable={
          scopes.includes("hair") || scopes.includes("outfit") ||
          scopes.includes("foreground") || scopes.includes("pose") ||
          scopes.includes("camera")
        }
      />
    </div>
  );
}
