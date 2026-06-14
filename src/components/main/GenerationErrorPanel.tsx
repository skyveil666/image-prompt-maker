interface GenerationErrorPanelProps {
  error: string;
  onSafeRetry: () => void;
}

/** 生成エラー表示パネル（App.tsx から純移設・表示専用）。
 *  安全フィルタにブロックされた場合のみ「安全寄りに自動修正して再試行」ボタンを出す。
 *  再試行ロジック（handleSafeRetry）は App 側に保持し、onSafeRetry で受け取る。 */
export function GenerationErrorPanel({ error, onSafeRetry }: GenerationErrorPanelProps) {
  const isBlocked =
    error.includes("PROHIBITED_CONTENT") ||
    error.includes("SAFETY") ||
    error.includes("ブロックされました");

  return (
    <section className="card border-rose-500/50 bg-rose-500/10 space-y-2">
      <h3 className="text-sm font-semibold text-rose-300">
        {isBlocked ? "🛑 Gemini の安全フィルタにブロックされました" : "⚠ 生成に失敗しました"}
      </h3>
      <p className="text-xs text-rose-200/90 break-all">{error}</p>

      {isBlocked ? (
        <>
          <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/95 leading-relaxed space-y-1">
            <p className="font-bold">よくある原因（多い順）：</p>
            <ol className="list-decimal list-inside space-y-0.5 text-amber-100/85">
              <li><b>一発バズりモード</b>が ON ← 最も引きやすい</li>
              <li><b>変更対象が 4軸以上</b>（プロンプトが長く誤判定されやすい）</li>
              <li><b>リアル度 4-5</b>（写真リアル）＋ 元画像が女性キャラ</li>
              <li>履歴の <b>黒系・ゴシック・露出系</b>の偏りが累積</li>
              <li>元画像に <b>露出多めの服</b>・水着など</li>
            </ol>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onSafeRetry}
              className="rounded-lg px-3 py-1.5 text-[12px] font-bold border border-emerald-400/65 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 hover:border-emerald-400 transition shadow-[0_0_10px_-2px_rgba(52,211,153,0.4)]"
            >
              🛡 安全寄りに自動修正して再試行
            </button>
            <span className="text-[11px] text-text-muted/65">
              （バズり/神引き/世界観OFF・3軸まで・リアル度↓・NG露骨語を除去＋肯定方向追加）
            </span>
          </div>

          <p className="text-[11px] text-text-muted/55 pt-1">
            ※ プロジェクト方針として、フィルタを回避する目的の改造は行いません。
            このボタンは「より穏当な表現に寄せて再依頼」するだけです。
          </p>
        </>
      ) : (
        <p className="text-xs text-text-muted mt-2">
          `npm run dev:all` でサーバーが起動しているか、`server/.env` のキーが有効か確認してください。
        </p>
      )}
    </section>
  );
}
