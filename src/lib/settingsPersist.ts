/**
 * UI設定の localStorage 永続化。
 * ページを閉じても設定が保持され、次回開いたときに自動復元される。
 *
 * バージョンキー "ipm_settings_v1"：
 *   スキーマが互換性を失う変更をした場合は v2, v3 … とインクリメントする。
 *   古いキーは読まれず自然に無視される（新デフォルト値で起動）。
 */
import type {
  ArtStyle,
  AspectRatioPreset,
  ColorStrategy,
  Count,
  DetailSettings,
  Era,
  Expression,
  Mood,
  PromptTarget,
  Scope,
} from "../types";
import { DEFAULT_DETAILS } from "../types";
import type { ZozoTrend } from "./zozoTrend";

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ipm_settings_v1";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface PersistedSettings {
  scopes:             Scope[];
  moods:              Mood[];
  autoMoodCategories: string[];
  count:              Count;
  details:            DetailSettings;
  extraInstructions:  string;
  ngList:             string;
  viralMode:          boolean;
  strength:           number;
  glossLevel:         number;
  dimensionLevel:     number;
  /** 質感・リアル度 1-5（1=完全2D ↔ 5=写真リアル）。既定 3 = 2.5D */
  realismLevel:       number;
  /** 質感タイプ（"anime_bg" 等、null = 指定なし） */
  realismType:        string | null;
  textureOriginal:    boolean;
  textureDisabled:    boolean;
  promptTarget:       PromptTarget | null;
  /** 量産構図を避ける（初期ON）*/
  avoidCliche:        boolean;
  /** 体型とポーズを守る（初期ON）*/
  bodyPoseLock:       boolean;
  /** 色味と雰囲気を守る（初期ON）*/
  colorMoodLock:      boolean;
  /** 元画像構図を守る（初期ON）*/
  compositionLock:    boolean;
  /** 時代軸（null = 設定なし）*/
  era:                Era | null;
  /** 色戦略（null = 設定なし）*/
  colorStrategy:      ColorStrategy | null;
  /** 顔/同一性ロック（初期ON）*/
  faceLock:           boolean;
  /** 表情指定（faceLock: false 時のみ有効。null = 表情自由）*/
  expression:         Expression | null;
  /** 絵柄スタイル（null = 設定なし）*/
  artStyle:           ArtStyle | null;
  /** デフォルトアスペクト比（null = なし。起動時に aspect_ratio.preset が skip の場合に適用）*/
  defaultAspectRatio: AspectRatioPreset | null;
  /** お気に入り学習を新規生成に反映する（初期OFF）*/
  favoriteLearnEnabled: boolean;
  /** お気に入り反映強度：1=弱 / 2=標準 / 3=強（初期2）*/
  favoriteStrength:   number;
  /** ZOZOトレンド反映状態（null = 未反映） */
  zozoApplied:        ZozoTrend | null;
  /** 神引き補助モディファイア（被り回避/別世界/バズ寄せ/顔映え） */
  activeBoosts:       string[];
  /** 風の強さ 0–5（初期0=無風） */
  windLevel:          number;
}

export const SETTINGS_DEFAULTS: PersistedSettings = {
  scopes:             ["background"],
  moods:              [],
  autoMoodCategories: [],
  count:              4 as Count,
  details:            DEFAULT_DETAILS,
  extraInstructions:  "",
  ngList:             "",
  viralMode:          false,
  strength:           2,
  glossLevel:         3,
  dimensionLevel:     3,
  realismLevel:       3,
  realismType:        null,
  textureOriginal:    false,
  textureDisabled:    false,
  promptTarget:       "chatgpt_safe",
  avoidCliche:        true,
  bodyPoseLock:       true,
  colorMoodLock:      true,
  compositionLock:    true,
  era:                null,
  colorStrategy:      null,
  faceLock:           true,
  expression:         null,
  artStyle:           null,
  defaultAspectRatio: null,
  favoriteLearnEnabled: false,
  favoriteStrength:   2,
  zozoApplied:        null,
  activeBoosts:       [],
  windLevel:          0,
};

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

/**
 * 保存された DetailSettings を DEFAULT_DETAILS とマージして欠損フィールドを補完する。
 * 新しいフィールド（hairStyle 等）が追加された場合も古い保存データで安全に動作する。
 */
function mergeDetails(saved: unknown): DetailSettings {
  if (!saved || typeof saved !== "object") return DEFAULT_DETAILS;
  const s = saved as Record<string, unknown>;
  const merge = <T extends object>(def: T, src: unknown): T =>
    src && typeof src === "object" ? { ...def, ...(src as Partial<T>) } : def;
  return {
    hair:        merge(DEFAULT_DETAILS.hair,        s.hair),
    outfit:      merge(DEFAULT_DETAILS.outfit,      s.outfit),
    cosplay:     merge(DEFAULT_DETAILS.cosplay,     s.cosplay),
    cyber:       merge(DEFAULT_DETAILS.cyber,       s.cyber),
    background:  merge(DEFAULT_DETAILS.background,  s.background),
    foreground:  merge(DEFAULT_DETAILS.foreground,  s.foreground),
    pose:        merge(DEFAULT_DETAILS.pose,        s.pose),
    camera:      merge(DEFAULT_DETAILS.camera,      s.camera),
    props:       merge(DEFAULT_DETAILS.props,       s.props),
    bigObject:   merge(DEFAULT_DETAILS.bigObject,   s.bigObject),
    vehicle:     merge(DEFAULT_DETAILS.vehicle,     s.vehicle),
    myth:        merge(DEFAULT_DETAILS.myth,        s.myth),
    lighting:    merge(DEFAULT_DETAILS.lighting,    s.lighting),
    aspectRatio: merge(DEFAULT_DETAILS.aspectRatio, s.aspectRatio),
  };
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * localStorage から設定を読み込む。
 * - 存在しない・JSON壊れ → SETTINGS_DEFAULTS を返す
 * - 古いスキーマ → SETTINGS_DEFAULTS にマージして欠損フィールドを補完
 */
export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SETTINGS_DEFAULTS;
    const p = JSON.parse(raw) as Partial<PersistedSettings>;
    const loaded: PersistedSettings = {
      ...SETTINGS_DEFAULTS,
      ...p,
      // ネストオブジェクトは明示的にマージ（欠損フィールドを補完するため）
      details: mergeDetails(p.details),
    };
    // デフォルトアスペクト比を適用：保存データが "skip" でデフォルトが設定されている場合
    if (loaded.defaultAspectRatio && loaded.details.aspectRatio.preset === "skip") {
      loaded.details = {
        ...loaded.details,
        aspectRatio: { ...loaded.details.aspectRatio, preset: loaded.defaultAspectRatio },
      };
    }
    // ── 一度きりの復旧移行（6/3基準の実写維持へ）─────────────────────────────
    // リグレッション期間（22dda3d 以降）にスタイライズ寄り(Lv1/2)が既定化され、
    // その状態で保存された realismLevel を写実維持(Lv3)へ一度だけ引き上げる。
    // 元画像の実写質感・顔・肌をそのまま維持することを最優先するための復旧措置。
    // マーカーで1回限り。ユーザーが意図的に再度 Lv1/2 を選ぶことは妨げない。
    try {
      const REALISM_RESTORE_KEY = "ipm_realism_restore_v1";
      if (!localStorage.getItem(REALISM_RESTORE_KEY)) {
        if (typeof loaded.realismLevel === "number" && loaded.realismLevel < 3) {
          loaded.realismLevel = 3;
          loaded.realismType = null;
          saveSettings(loaded);  // 引き上げ結果を永続化（リロードしても維持）
        }
        localStorage.setItem(REALISM_RESTORE_KEY, "1");
      }
    } catch {
      // localStorage 不可環境では移行をスキップ
    }
    return loaded;
  } catch {
    return SETTINGS_DEFAULTS;
  }
}

/**
 * 設定を localStorage に保存する。
 * localStorage が利用できない場合（プライベートブラウジング等）は無視する。
 * ※ imageDataUrl は保存しない（複数MBになりクォータを消費するため）。
 *    画像は毎回アップロードしなおしてください。
 */
export function saveSettings(s: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // quota exceeded やプライベートブラウジングでは無視
  }
}
