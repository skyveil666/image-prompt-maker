/**
 * アシスタント音声読み上げ（Web Speech API ラッパー）。
 *
 * 重要：
 *   - 追加依存ゼロ（ブラウザ標準 API のみ）
 *   - 失敗時は静かに無視（音声なしでも吹き出しは機能する）
 *   - 同時発話は禁止（新しい発話で前の発話をキャンセル）
 */

export interface SpeakOptions {
  /** 読み上げ言語（既定 "ja-JP"） */
  lang?:   string;
  /** 速度（0.5〜2.0、既定 1.05） */
  rate?:   number;
  /** ピッチ（0.5〜2.0、既定 1.10） */
  pitch?:  number;
  /** 音量（0.0〜1.0、既定 1.0） */
  volume?: number;
  /** 使用する voiceURI（null/undefined のときは ja-JP の声を自動選択） */
  voiceURI?: string | null;
}

/** ブラウザが SpeechSynthesis に対応しているか */
export function isSpeechSupported(): boolean {
  return typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined"
    && typeof window.SpeechSynthesisUtterance !== "undefined";
}

/** 現在話している音声を即停止 */
export function cancelSpeech(): void {
  if (!isSpeechSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
}

/**
 * 音声リスト取得。Chrome 等では非同期にロードされるため、
 * 未ロード時は voiceschanged イベントを待つ必要がある。
 */
export function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  try { return window.speechSynthesis.getVoices(); } catch { return []; }
}

/** voiceschanged を待ってからボイス一覧を返す（最大2秒タイムアウト） */
export function waitForVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) { resolve([]); return; }
    const first = getVoices();
    if (first.length > 0) { resolve(first); return; }
    let done = false;
    const onChange = () => {
      if (done) return;
      done = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onChange);
      resolve(getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", onChange);
    setTimeout(() => {
      if (done) return;
      done = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onChange);
      resolve(getVoices());
    }, timeoutMs);
  });
}

/** 日本語の声だけ抽出 */
export function getJapaneseVoices(): SpeechSynthesisVoice[] {
  return getVoices().filter((v) => v.lang.toLowerCase().startsWith("ja"));
}

/**
 * テキストを読み上げ。前の発話があれば即キャンセル。
 * 音声が無いブラウザでは静かに無視。
 */
export function speakText(text: string, opts: SpeakOptions = {}): void {
  if (!isSpeechSupported()) return;
  const trimmed = (text ?? "").trim();
  if (!trimmed) return;

  // 絵文字や記号は読みづらいので軽く除去（必要最小限）
  const cleaned = trimmed
    .replace(/[🙂✨⚠️🔥😴🎉🚫🎭🔁⭐🧹⚡🎨📁🤖💬🔊]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return;

  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleaned);
    u.lang   = opts.lang   ?? "ja-JP";
    u.rate   = clamp(opts.rate   ?? 1.05, 0.5, 2.0);
    u.pitch  = clamp(opts.pitch  ?? 1.10, 0.5, 2.0);
    u.volume = clamp(opts.volume ?? 1.0,  0.0, 1.0);

    // ボイス選択
    const voices = getVoices();
    if (opts.voiceURI) {
      const v = voices.find((x) => x.voiceURI === opts.voiceURI);
      if (v) u.voice = v;
    }
    if (!u.voice) {
      // ja-JP を優先、なければ ja を含むもの
      const ja = voices.find((v) => v.lang === "ja-JP")
              ?? voices.find((v) => v.lang.toLowerCase().startsWith("ja"));
      if (ja) u.voice = ja;
    }

    window.speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
