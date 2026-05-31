/**
 * AI分析アシスタントキャラの設定（localStorage 永続化）。
 * アバター画像はデータURLで保存（ユーザーが自分のキャラを設定モーダルからアップロード）。
 */

export type AssistantTone =
  | "default"     // 標準
  | "gentle"      // やさしい
  | "energetic"   // 元気
  | "harsh"       // 辛口
  | "cool"        // クール
  | "short";      // 短文のみ

export interface AssistantSettings {
  /** 機能ON/OFF（OFFなら Explorer 下に何も出さない） */
  enabled:    boolean;
  /** アバター画像（data URL）。未設定ならデフォルト画像 → SVG の順でフォールバック */
  avatarUrl:  string | null;
  /** キャラ名（吹き出しの主） */
  name:       string;
  /** 口調 */
  tone:       AssistantTone;
  /** 吹き出し表示 */
  bubbleOn:   boolean;
  /** 感情アイコン表示 */
  emotionOn:  boolean;
  /** 音声読み上げ機能ON（OFFなら🔊ボタンも出さない） */
  speechOn:   boolean;
  /** 新しい発話で自動的に読み上げる（OFFなら🔊ボタンで手動） */
  autoSpeak:  boolean;
  /** 使用音声の voiceURI（null=自動選択） */
  voiceURI:   string | null;
  /** 読み上げ速度（0.5〜2.0、既定1.05） */
  rate:       number;
  /** 読み上げピッチ（0.5〜2.0、既定1.10） */
  pitch:      number;
}

/** デフォルトアバター画像のパス（public/assistant-default.png）。
 *  未保存時は SVG プレースホルダにフォールバック。 */
export const DEFAULT_AVATAR_PATH = "/assistant-default.png";

const STORAGE_KEY = "ipm_assistant_settings_v1";

export const ASSISTANT_DEFAULTS: AssistantSettings = {
  enabled:   true,
  avatarUrl: null,
  name:      "ナビ",
  tone:      "default",
  bubbleOn:  true,
  emotionOn: true,
  speechOn:  true,    // 機能自体はON、ただし autoSpeak は false なので勝手に話さない
  autoSpeak: false,
  voiceURI:  null,
  rate:      1.05,
  pitch:     1.10,
};

export function loadAssistantSettings(): AssistantSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ASSISTANT_DEFAULTS;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return ASSISTANT_DEFAULTS;
    return { ...ASSISTANT_DEFAULTS, ...(obj as Partial<AssistantSettings>) };
  } catch {
    return ASSISTANT_DEFAULTS;
  }
}

export function saveAssistantSettings(s: AssistantSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota or unavailable */
  }
}

export const TONE_OPTIONS: { value: AssistantTone; label: string }[] = [
  { value: "default",   label: "標準" },
  { value: "gentle",    label: "やさしい" },
  { value: "energetic", label: "元気" },
  { value: "harsh",     label: "辛口" },
  { value: "cool",      label: "クール" },
  { value: "short",     label: "短文" },
];
