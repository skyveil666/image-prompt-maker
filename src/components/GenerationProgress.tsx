import { useEffect, useRef, useState } from "react";

interface Props {
  generating: boolean;
  count: number;
  /** 生成完了時に1回だけ呼ばれる（完了音・トースト等のトリガー用） */
  onComplete?: () => void;
  /** false にするとバッジ点滅・バーフラッシュを無効化 */
  animationEnabled?: boolean;
}

/**
 * 疑似進捗バー。Gemini API は段階的なストリーミングを返さないため、
 * 体感ベースでステージを進める：
 *  0〜15%   画像解析
 *  15〜35%  設定整理
 *  35〜75%  プロンプト生成
 *  75〜95%  出力整形
 *  95〜100% 完了直前
 * レスポンス到着で 100% にスナップして「✅ 生成完了」を表示してから消える。
 */

type RunState = "idle" | "running" | "done";

const STAGES: { until: number; text: string }[] = [
  { until: 15,  text: "画像を解析しています…"       },
  { until: 35,  text: "設定を整理しています…"         },
  { until: 75,  text: "プロンプトを生成しています…"   },
  { until: 95,  text: "出力を整えています…"           },
  { until: 100, text: "もうすぐ完了…"                 },
];

function stageOf(progress: number): string {
  for (const s of STAGES) {
    if (progress <= s.until) return s.text;
  }
  return STAGES[STAGES.length - 1].text;
}

export function GenerationProgress({
  generating,
  count,
  onComplete,
  animationEnabled = true,
}: Props) {
  const [progress,        setProgress]        = useState(0);
  const [state,           setState]           = useState<RunState>("idle");
  /** 完了アニメーション中フラグ（1200ms 間 true） */
  const [isDoneAnimating, setIsDoneAnimating] = useState(false);

  // onComplete を ref で安定させ、stale closure を避ける
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // generating の立ち上がり／立ち下がりに合わせて状態遷移
  useEffect(() => {
    if (generating) {
      if (state !== "running") {
        setProgress(0);
        setState("running");
        setIsDoneAnimating(false);
      }
    } else if (state === "running") {
      // 完了遷移
      setProgress(100);
      setState("done");

      // ① 完了アニメーション開始
      setIsDoneAnimating(true);

      // 完了コールバック（音・トースト・タブ等）
      onCompleteRef.current?.();

      const t1 = setTimeout(() => setIsDoneAnimating(false), 1200);
      const t2 = setTimeout(() => setState("idle"),          1400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  // running 中だけ進捗を進める（95% で頭打ち）
  useEffect(() => {
    if (state !== "running") return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return 95;
        const remaining = 95 - p;
        return p + Math.max(0.4, remaining * 0.06);
      });
    }, 220);
    return () => clearInterval(interval);
  }, [state]);

  if (state === "idle") return null;

  const isDone = state === "done";
  const doAnim = isDone && isDoneAnimating && animationEnabled;

  return (
    <div className="space-y-1.5" aria-live="polite" aria-atomic="true">
      <div className="flex items-center gap-2 text-sm">
        {isDone ? (
          <>
            {/* バッジ点滅：scale + glow（2回） */}
            <span
              className="text-emerald-300 text-base leading-none"
              style={
                doAnim
                  ? { animation: "completionPulse 0.58s ease-out 2" }
                  : undefined
              }
            >
              ✅
            </span>
            <span
              className="text-emerald-200 font-semibold"
              style={
                doAnim
                  ? { animation: "completionPulse 0.58s ease-out 2" }
                  : undefined
              }
            >
              生成完了
            </span>
          </>
        ) : (
          <>
            <Spinner />
            <span className="text-text-base">{stageOf(progress)}</span>
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-2 text-[13px] text-text-muted/85">
          <span>{count}案</span>
          <span className="tabular-nums font-mono text-text-base/80">
            {Math.round(progress)}%
          </span>
        </span>
      </div>

      <div className="relative h-2 rounded-full bg-bg-base overflow-hidden border border-bg-border">
        <div
          className={[
            "h-full rounded-full transition-[width] duration-200 ease-out",
            isDone
              ? "bg-gradient-to-r from-emerald-400 to-teal-300"
              : "bg-gradient-to-r from-accent via-fuchsia-400 to-sky-400 shadow-[0_0_14px_rgba(124,92,255,0.55)]",
          ].join(" ")}
          style={{
            width: `${progress}%`,
            // ⑥ 完了時バーフラッシュ
            animation: doAnim ? "barFlash 0.45s ease-out 2" : undefined,
          }}
        />
        {!isDone && (
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none animate-[shimmer_1.8s_linear_infinite]" />
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4 text-accent"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12" cy="12" r="9"
        stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"
      />
      <path
        d="M12 3 a 9 9 0 0 1 9 9"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"
      />
    </svg>
  );
}
