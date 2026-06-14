interface NanoBananaWarningProps {
  scopeCount: number;
}

/** Nano Banana 軽量化おすすめ警告（変更項目が多い時のみ・App.tsx から純移設・表示専用）。
 *  表示条件（promptTarget === "nano_safe" && scopes.length >= 4）は呼び出し側で判定する。 */
export function NanoBananaWarning({ scopeCount }: NanoBananaWarningProps) {
  return (
    <div className="fixed bottom-[92px] right-6 z-[100] max-w-[360px] rounded-xl border border-amber-400/50 bg-amber-500/12 backdrop-blur-md px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
      <p className="text-[11px] text-amber-100 leading-snug">
        ⚠️ Nano Banana は変更項目が多いと顔や服の品質が崩れやすいです。
        変更を2〜3個に絞ると安定します（現在 {scopeCount}項目）。
      </p>
    </div>
  );
}
