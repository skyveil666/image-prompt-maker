/**
 * Web Audio API でピコン♪ 通知音を合成する（0.3秒・ファイル不要）。
 * AudioContext が利用できない環境ではサイレントに無視する。
 */
export function playCompletionSound(): void {
  try {
    const ctx = new AudioContext();

    const play = (
      freq: number,
      startAt: number,
      sustainEnd: number,
      releaseEnd: number,
    ) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(0,    startAt);
      gain.gain.linearRampToValueAtTime(0.22, startAt + 0.012);
      gain.gain.setValueAtTime(0.22, sustainEnd);
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

      osc.start(startAt);
      osc.stop(releaseEnd + 0.01);
    };

    const t = ctx.currentTime;
    // ♪ A5 (880Hz) → E6 (1320Hz) — 短い上昇2音
    play(880,  t,        t + 0.06,  t + 0.18);
    play(1320, t + 0.11, t + 0.18,  t + 0.35);

    setTimeout(() => void ctx.close(), 800);
  } catch {
    // AudioContext が利用不可（セキュリティ制限等）
  }
}
