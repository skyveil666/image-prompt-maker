/**
 * AssistantCharacter — Explorer 左下に常駐する AI分析アシスタントキャラ
 *
 * 構成：
 *   ┌───────────────────────┐
 *   │ [avatar] 吹き出しテキスト │
 *   │          [反映] [別案]   │
 *   │          [⚙][▲][🔊]    │
 *   └───────────────────────┘
 *
 * 既存の AgentAnalysis を assistantEngine.speak() で短文化して表示。
 * 提案ボタンは押下時のみ App 側ハンドラへ通知（自動反映なし）。
 *
 * アバター画像の優先順位:
 *   1. settings.avatarUrl (ユーザーがアップロードした data URL)
 *   2. /assistant-default.png (public/ に置かれたデフォルト画像)
 *   3. SVG プレースホルダ（コード内の小さなマスコット）
 *
 * 音声読み上げ:
 *   - speechOn: 機能ON/OFF（🔊ボタン自体の表示）
 *   - autoSpeak: 新しい発話が来たら自動的に音声化（OFFなら手動🔊のみ）
 */
import { useEffect, useRef, useState } from "react";
import type { AgentAnalysis, AgentActionId } from "../lib/aiAgent";
import {
  loadAssistantSettings, saveAssistantSettings,
  TONE_OPTIONS,
  DEFAULT_AVATAR_PATH,
  type AssistantSettings,
} from "../lib/assistantSettings";
import { speak, EMOTION_META, ACTION_SHORT_LABEL } from "../lib/assistantEngine";
import {
  speakText, cancelSpeech, isSpeechSupported,
  waitForVoices, getJapaneseVoices,
} from "../lib/assistantSpeech";

interface Props {
  agent: AgentAnalysis | null;
  onAction: (id: AgentActionId) => void;
}

// ── デフォルト SVG アバター（最終フォールバック） ─────────────────────────────
const DEFAULT_AVATAR_SVG = (
  <svg viewBox="0 0 64 80" className="w-full h-full">
    <defs>
      <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#c5cdd6" />
        <stop offset="100%" stopColor="#7d8896" />
      </linearGradient>
      <linearGradient id="jacket" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#fde68a" />
        <stop offset="100%" stopColor="#fbbf24" />
      </linearGradient>
    </defs>
    <path d="M14 18 Q32 0 50 18 L52 56 Q32 62 12 56 Z" fill="url(#hair)" />
    <ellipse cx="32" cy="28" rx="11" ry="13" fill="#f7d9c4" />
    <path d="M19 22 Q32 12 45 22 L43 24 Q32 18 21 24 Z" fill="url(#hair)" />
    <circle cx="27" cy="29" r="1.4" fill="#1a1a1a" />
    <circle cx="37" cy="29" r="1.4" fill="#1a1a1a" />
    <path d="M30 34 Q32 36 34 34" stroke="#c14b5b" strokeWidth="1" fill="none" strokeLinecap="round" />
    <path d="M14 50 L18 78 L46 78 L50 50 Q32 56 14 50 Z" fill="url(#jacket)" opacity="0.95" />
    <path d="M22 48 L24 78 L40 78 L42 48 Q32 53 22 48 Z" fill="#5a8cb0" />
  </svg>
);

/**
 * アバター描画コンポーネント。3段フォールバック対応：
 *   user upload → /assistant-default.png → SVG
 */
function Avatar({ url, alt }: { url: string | null; alt: string }) {
  // 表示状態を 3 段で持つ
  //   "user"    : ユーザーがアップロードした data URL を表示中
  //   "default" : /assistant-default.png を表示中
  //   "svg"     : 両方失敗 → 内蔵 SVG プレースホルダ
  const [stage, setStage] = useState<"user" | "default" | "svg">(
    url ? "user" : "default"
  );

  // url が変わったらリセット
  useEffect(() => {
    setStage(url ? "user" : "default");
  }, [url]);

  if (stage === "user" && url) {
    return (
      <img
        src={url}
        alt={alt}
        draggable={false}
        className="w-full h-full object-cover object-top"
        onError={() => setStage("default")}
      />
    );
  }
  if (stage === "default") {
    return (
      <img
        src={DEFAULT_AVATAR_PATH}
        alt={alt}
        draggable={false}
        className="w-full h-full object-cover object-top"
        onError={() => setStage("svg")}
      />
    );
  }
  return <div className="w-full h-full bg-bg-panel/70">{DEFAULT_AVATAR_SVG}</div>;
}

export function AssistantCharacter({ agent, onAction }: Props) {
  const [settings, setSettings] = useState<AssistantSettings>(() => loadAssistantSettings());
  const [hint, setHint] = useState<"bold" | "simplify" | "favorite" | undefined>();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // unmount で必ず音声停止
  useEffect(() => () => { cancelSpeech(); }, []);

  if (!settings.enabled) {
    return (
      <button
        type="button"
        onClick={() => {
          const next = { ...settings, enabled: true };
          setSettings(next);
          saveAssistantSettings(next);
        }}
        title="アシスタントを表示"
        className="self-start mt-1 ml-1 px-1.5 py-0.5 text-[10px] rounded border border-white/15 bg-white/5 text-text-muted/55 hover:text-text-base hover:border-accent/40 transition leading-none"
      >
        🤖
      </button>
    );
  }

  const sp = speak(agent, settings.tone, hint);
  const em = EMOTION_META[sp.emotion];

  const handleAction = (id: AgentActionId) => {
    onAction(id);
    setHint(undefined);
  };

  const update = (patch: Partial<AssistantSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAssistantSettings(next);
  };

  // ── 音声：手動再生 ──
  const handleSpeak = () => {
    if (!settings.speechOn) return;
    speakText(sp.text, {
      voiceURI: settings.voiceURI,
      rate:     settings.rate,
      pitch:    settings.pitch,
    });
  };

  // ── 音声：autoSpeak ──
  // sp.text が前回と変わった瞬間に1回だけ発話する。collapsed/!enabled 時はスキップ。
  const lastSpokenRef = useRef<string>("");
  useEffect(() => {
    if (!settings.enabled) return;
    if (!settings.speechOn) return;
    if (!settings.autoSpeak) return;
    if (collapsed) return;
    if (!sp.text) return;
    if (sp.text === lastSpokenRef.current) return;
    lastSpokenRef.current = sp.text;
    speakText(sp.text, {
      voiceURI: settings.voiceURI,
      rate:     settings.rate,
      pitch:    settings.pitch,
    });
  }, [
    sp.text, settings.enabled, settings.speechOn, settings.autoSpeak,
    settings.voiceURI, settings.rate, settings.pitch, collapsed,
  ]);

  // 折りたたみ：アバターのみ表示
  if (collapsed) {
    return (
      <div className="px-2 py-1.5 flex items-center gap-1 border-t border-bg-border/40 bg-bg-panel/30 shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title={`${settings.name}を表示`}
          className={[
            "w-8 h-10 rounded-md overflow-hidden ring-2 shrink-0 cursor-pointer transition",
            em.ring,
          ].join(" ")}
        >
          <Avatar url={settings.avatarUrl} alt={settings.name} />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-[10px] text-text-muted/55 hover:text-text-base px-1 leading-none"
        >
          ▲
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={[
        "border-t border-bg-border/40 bg-bg-panel/35 shrink-0",
        "px-2 py-2 flex gap-2 items-start",
      ].join(" ")}>
        {/* アバター */}
        <div className={[
          "w-12 h-16 rounded-md overflow-hidden ring-2 shrink-0 transition-shadow",
          em.ring,
        ].join(" ")}>
          <Avatar url={settings.avatarUrl} alt={settings.name} />
        </div>

        {/* 吹き出し + アクション */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* ヘッダ：名前 + 感情アイコン + 🔊 + ⚙ + ▼ */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-text-base/90 leading-none">{settings.name}</span>
            {settings.emotionOn && <span className="text-[12px] leading-none">{em.icon}</span>}

            {/* 🔊 読み上げ（speechOn かつブラウザ対応時のみ表示） */}
            {settings.speechOn && isSpeechSupported() && (
              <button
                type="button"
                onClick={handleSpeak}
                title="この発話を読み上げる"
                className="ml-auto text-[12px] text-text-muted/45 hover:text-text-base leading-none px-0.5"
              >
                🔊
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="アシスタント設定"
              className={[
                "text-[12px] text-text-muted/45 hover:text-text-base leading-none px-0.5",
                settings.speechOn && isSpeechSupported() ? "" : "ml-auto",
              ].join(" ")}
            >
              ⚙
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="折りたたむ"
              className="text-[10px] text-text-muted/45 hover:text-text-base leading-none px-0.5"
            >
              ▼
            </button>
          </div>

          {/* 吹き出し */}
          {settings.bubbleOn && (
            <div className={[
              "rounded-lg border px-2 py-1.5 leading-snug",
              em.bubble,
            ].join(" ")}>
              <p className="text-[12px] text-text-base/95 whitespace-pre-wrap break-words">
                {sp.text}
              </p>
            </div>
          )}

          {/* 提案ボタン（最大3） */}
          {sp.actions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sp.actions.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleAction(id)}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-violet-400/40 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20 hover:border-violet-400/70 transition leading-none"
                >
                  {ACTION_SHORT_LABEL[id]}
                </button>
              ))}
            </div>
          )}

          {/* 気分切替（軽い対話） */}
          <div className="flex flex-wrap gap-1 pt-0.5 border-t border-white/5">
            <button type="button" onClick={() => setHint(hint === "bold" ? undefined : "bold")}
              title="攻める提案に切り替え"
              className={["text-[10px] px-1.5 py-0.5 rounded border leading-none transition",
                hint === "bold" ? "border-rose-400/70 bg-rose-500/20 text-rose-100"
                                : "border-white/15 bg-white/5 text-text-muted/65 hover:text-text-base"].join(" ")}>
              🔥 攻めたい
            </button>
            <button type="button" onClick={() => setHint(hint === "simplify" ? undefined : "simplify")}
              title="シンプル化提案に切り替え"
              className={["text-[10px] px-1.5 py-0.5 rounded border leading-none transition",
                hint === "simplify" ? "border-sky-400/70 bg-sky-500/20 text-sky-100"
                                    : "border-white/15 bg-white/5 text-text-muted/65 hover:text-text-base"].join(" ")}>
              🧹 シンプルに
            </button>
            <button type="button" onClick={() => setHint(hint === "favorite" ? undefined : "favorite")}
              title="お気に入り寄せ提案"
              className={["text-[10px] px-1.5 py-0.5 rounded border leading-none transition",
                hint === "favorite" ? "border-amber-400/70 bg-amber-500/20 text-amber-100"
                                    : "border-white/15 bg-white/5 text-text-muted/65 hover:text-text-base"].join(" ")}>
              ⭐ 好み寄せ
            </button>
          </div>
        </div>
      </div>

      {/* 設定モーダル */}
      {settingsOpen && (
        <AssistantSettingsModal
          settings={settings}
          onChange={update}
          onClose={() => setSettingsOpen(false)}
          previewText={sp.text}
        />
      )}
    </>
  );
}

// ── 設定モーダル ─────────────────────────────────────────────────────────────

function AssistantSettingsModal({
  settings, onChange, onClose, previewText,
}: {
  settings: AssistantSettings;
  onChange: (patch: Partial<AssistantSettings>) => void;
  onClose: () => void;
  previewText: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speechAvailable = isSpeechSupported();

  // 日本語ボイス一覧をロード（非同期、Chrome対応）
  useEffect(() => {
    if (!speechAvailable) return;
    let cancelled = false;
    waitForVoices().then(() => {
      if (cancelled) return;
      setVoices(getJapaneseVoices());
    });
    return () => { cancelled = true; };
  }, [speechAvailable]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      alert("画像が大きすぎます（2MB以下にしてください）");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") onChange({ avatarUrl: r.result });
    };
    r.readAsDataURL(f);
  };

  const handlePreviewSpeak = () => {
    speakText(previewText || "こんにちは。これは音声プレビューです。", {
      voiceURI: settings.voiceURI,
      rate:     settings.rate,
      pitch:    settings.pitch,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-bg-border bg-bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダ */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border/60 shrink-0">
          <span className="text-[14px] font-bold text-text-base">🤖 アシスタント設定</span>
          <button type="button" onClick={onClose}
            className="text-[14px] text-text-muted/55 hover:text-text-base leading-none">✕</button>
        </div>

        {/* 本体（スクロール可） */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* アバター */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-20 rounded-md overflow-hidden border border-white/15 bg-bg-base/40 shrink-0">
              <Avatar url={settings.avatarUrl} alt="" />
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-[11px] text-text-muted/55 leading-snug">
                キャラ画像（PNG/JPG、2MB以下）<br />
                <span className="text-[10px] text-text-muted/45">
                  未設定なら <code className="text-violet-300/80">/assistant-default.png</code> を表示
                </span>
              </p>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-[11px] px-2 py-1 rounded border border-violet-400/45 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20 transition">
                  📁 画像を選択
                </button>
                {settings.avatarUrl && (
                  <button type="button" onClick={() => onChange({ avatarUrl: null })}
                    className="text-[11px] px-2 py-1 rounded border border-rose-400/40 bg-rose-400/8 text-rose-200 hover:bg-rose-400/16 transition">
                    🗑 クリア
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 名前 */}
          <label className="block">
            <span className="text-[11px] text-text-muted/65 block mb-0.5">名前</span>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => onChange({ name: e.target.value.slice(0, 16) })}
              className="w-full px-2 py-1 rounded border border-bg-border bg-bg-base text-[13px] text-text-base outline-none focus:border-accent/60"
              placeholder="ナビ"
            />
          </label>

          {/* 口調 */}
          <div>
            <span className="text-[11px] text-text-muted/65 block mb-0.5">口調</span>
            <div className="flex flex-wrap gap-1">
              {TONE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange({ tone: o.value })}
                  className={[
                    "text-[11px] px-2 py-1 rounded-md border leading-none transition",
                    settings.tone === o.value
                      ? "border-violet-400/70 bg-violet-500/20 text-violet-100"
                      : "border-bg-border text-text-muted/60 hover:border-violet-400/40",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* トグル群 */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Toggle label="表示する" value={settings.enabled}   onChange={(v) => onChange({ enabled:  v })} />
            <Toggle label="吹き出し" value={settings.bubbleOn}  onChange={(v) => onChange({ bubbleOn: v })} />
            <Toggle label="感情表示" value={settings.emotionOn} onChange={(v) => onChange({ emotionOn:v })} />
            <Toggle label="音声ON"   value={settings.speechOn}  onChange={(v) => {
              onChange({ speechOn: v });
              if (!v) cancelSpeech();
            }} />
          </div>

          {/* ── 音声セクション ─────────────────────────────── */}
          <div className={[
            "rounded-lg border p-2.5 space-y-2 transition",
            settings.speechOn ? "border-sky-400/35 bg-sky-500/5" : "border-white/8 bg-white/3 opacity-55",
          ].join(" ")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-base/90">
                🔊 音声読み上げ
              </span>
              {speechAvailable && settings.speechOn && (
                <button type="button" onClick={handlePreviewSpeak}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-sky-400/50 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20 transition leading-none">
                  ▶ プレビュー
                </button>
              )}
            </div>

            {!speechAvailable && (
              <p className="text-[10px] text-amber-300/80 leading-snug">
                ⚠ このブラウザは音声合成に対応していません。
              </p>
            )}

            {speechAvailable && (
              <>
                <Toggle
                  label="新しい発話を自動で読み上げる"
                  value={settings.autoSpeak}
                  onChange={(v) => onChange({ autoSpeak: v })}
                />

                <label className="block">
                  <span className="text-[10px] text-text-muted/65 block mb-0.5">音声（日本語）</span>
                  <select
                    value={settings.voiceURI ?? ""}
                    onChange={(e) => onChange({ voiceURI: e.target.value || null })}
                    disabled={!settings.speechOn}
                    className="w-full px-2 py-1 rounded border border-bg-border bg-bg-base text-[11px] text-text-base outline-none focus:border-accent/60 disabled:opacity-50"
                  >
                    <option value="">自動選択（ja-JP）</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                  {voices.length === 0 && settings.speechOn && (
                    <p className="text-[9px] text-text-muted/45 mt-0.5">
                      日本語ボイスが見つかりません（OS の音声設定で日本語を追加できます）
                    </p>
                  )}
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] text-text-muted/65 block mb-0.5">
                      速度 {settings.rate.toFixed(2)}
                    </span>
                    <input
                      type="range" min={0.5} max={2.0} step={0.05}
                      value={settings.rate}
                      onChange={(e) => onChange({ rate: parseFloat(e.target.value) })}
                      disabled={!settings.speechOn}
                      className="w-full accent-sky-400 disabled:opacity-50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-text-muted/65 block mb-0.5">
                      ピッチ {settings.pitch.toFixed(2)}
                    </span>
                    <input
                      type="range" min={0.5} max={2.0} step={0.05}
                      value={settings.pitch}
                      onChange={(e) => onChange({ pitch: parseFloat(e.target.value) })}
                      disabled={!settings.speechOn}
                      className="w-full accent-sky-400 disabled:opacity-50"
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          <p className="text-[10px] text-text-muted/40 leading-snug border-t border-white/5 pt-2">
            ⚠ アシスタントは提案するだけです。「反映」ボタンを押した時だけ生成設定に効きます。
          </p>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-1.5 text-[11px] text-text-base/90"
    >
      <span className={[
        "relative w-7 h-3.5 rounded-full transition-colors shrink-0",
        value ? "bg-violet-500/70" : "bg-white/15",
      ].join(" ")}>
        <span className={[
          "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform",
          value ? "translate-x-3.5" : "translate-x-0.5",
        ].join(" ")} />
      </span>
      {label}
    </button>
  );
}
