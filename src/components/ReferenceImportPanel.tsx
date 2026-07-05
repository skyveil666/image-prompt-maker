/**
 * ReferenceImportPanel — 参照画像 / 要素抽出（Phase1）
 *
 * 他人の生成画像・参考画像を DnD / Ctrl+V / スクショ貼付 / ファイル選択 で取り込み、
 * 「良い要素だけ」をカテゴリ別に抽出（Phase1は手動入力/スタブ）して既存UIへ反映する。
 *
 * 反映方式（docs/23）: enum 詳細欄には自動反映しない。
 *   [適用] → 対応 scope を ON + 軸タグ付き自由文を referenceNote へ（生成時に統合）。
 *
 * 絶対条件:
 *   - 顔/同一性/表情/体型のカテゴリは作らない（＝適用不能）。参照画像の人物はコピーしない。
 *   - 既存の保護ロック（体型・ポーズ / 構図 / 色味）が ON のカテゴリは適用不可。
 *   - 未選択カテゴリは一切変更しない（[適用] を押した軸のみ）。自動適用なし。
 *
 * Phase2 で Gemini Vision による自動抽出（/api/extract-reference）を追加予定。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Scope } from "../types";
import { extractReferenceViaBackend } from "../lib/backendClient";
import { readFileAsDataUrl } from "../lib/imageFile";
import { useAutoResizeTextarea } from "../lib/useAutoResizeTextarea";
import { useLatestRef } from "../lib/useLatestRef";
import { useEscapeKey } from "../lib/useEscapeKey";
import { saveReferenceRecord, updateReferenceRecord } from "../lib/referenceRecords";
import { imageContentHash, makeThumbnail } from "../lib/imageThumb";

/** 内容に合わせて高さが自動で伸びる textarea（抽出結果をスクロールせず読めるように） */
function AutoTextarea({ value, onChange, placeholder, minRows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder: string; minRows?: number;
}) {
  const ref = useAutoResizeTextarea(value, { minRows });
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full text-[11px] rounded border border-bg-border bg-bg-base/60 px-2 py-1 text-text-base placeholder:text-text-muted/45 resize-y focus:outline-none focus:border-violet-400/60 overflow-hidden"
    />
  );
}

// ── カテゴリ定義（顔/同一性/表情/体型は含めない＝設計上の絶対条件） ────────────
export type RefLock = "bodyPose" | "composition" | "colorMood" | null;

export interface ReferenceCategory {
  key: string;
  label: string;
  /** 適用時に ON にする変更対象（null = 対応scopeなし＝自由文ノートのみ） */
  scope: Scope | null;
  /** この既存ロックが ON の時は適用不可 */
  lock: RefLock;
  placeholder: string;
}

export const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  { key: "background", label: "背景",          scope: "background", lock: null,          placeholder: "例：古い映画館のような赤い座席と奥行きのある暗い空間" },
  { key: "outfit",     label: "衣装",          scope: "outfit",     lock: null,          placeholder: "例：光沢のある黒いジャケットと細身のストリート系レイヤード" },
  { key: "hair",       label: "髪型",          scope: "hair",       lock: null,          placeholder: "例：濡れ感のあるダークトーンのミディアムレイヤー" },
  { key: "pose",       label: "ポーズ",        scope: "pose",       lock: "bodyPose",    placeholder: "例：片肩を前に出した斜め立ちのクールなポーズ" },
  { key: "composition",label: "構図",          scope: "camera",     lock: "composition", placeholder: "例：被写体を中央より少し右に置いた縦長ポートレート構図" },
  { key: "camera",     label: "カメラアングル", scope: "camera",     lock: "composition", placeholder: "例：やや見上げるローアングルで奥行きを強調" },
  { key: "lighting",   label: "ライティング",   scope: "lighting",   lock: null,          placeholder: "例：横からのリムライトで輪郭を際立たせる" },
  { key: "color",      label: "色味",          scope: null,         lock: "colorMood",   placeholder: "例：赤と黒を基調にした低彩度のシネマトーン" },
  { key: "props",      label: "小物",          scope: "props",      lock: null,          placeholder: "例：手元に発光する小型デバイス" },
  { key: "foreground", label: "前景演出",       scope: "foreground", lock: null,          placeholder: "例：手前に舞い散る粒子の前ボケ" },
  { key: "world",      label: "世界観",        scope: null,         lock: null,          placeholder: "例：退廃的でノスタルジックな近未来" },
  { key: "texture",    label: "質感",          scope: null,         lock: null,          placeholder: "例：フィルムグレインのある軽いマット質感" },
  { key: "mood",       label: "雰囲気",        scope: null,         lock: "colorMood",   placeholder: "例：静かで緊張感のあるクールな空気" },
];

export interface ReferenceProtections {
  bodyPoseLock: boolean;
  compositionLock: boolean;
  colorMoodLock: boolean;
}


/** カテゴリが現在のロック状態で適用不可か。理由文（不可時）も返す。 */
export function referenceLockReason(cat: ReferenceCategory, p: ReferenceProtections): string | null {
  if (cat.lock === "bodyPose" && p.bodyPoseLock) return "体型・ポーズ固定がONのため適用できません";
  if (cat.lock === "composition" && p.compositionLock) return "構図固定がONのため適用できません";
  if (cat.lock === "colorMood" && p.colorMoodLock) return "色味固定がONのため適用できません";
  return null;
}

// ── 🎯 一発「画像から変更対象を自動セット」用 定数 ───────────────────────────
/** 自動セットで拾う scope の固定優先度（composition/camera は同一 scope camera に畳まれる）。 */
const AUTO_SCOPE_PRIORITY: Scope[] = ["background", "outfit", "pose", "hair", "lighting", "camera", "props", "foreground"];
/** 過剰選択を避ける上限 scope 数（3〜5個に収める）。 */
const MAX_AUTO_SCOPES = 5;
/** 通知表示用の scope 日本語名。 */
const AUTO_SCOPE_JA: Record<string, string> = {
  background: "背景", outfit: "衣装", pose: "ポーズ", hair: "髪型",
  lighting: "光", camera: "構図/カメラ", props: "小物", foreground: "前景",
};

// ── 🖼 参照スロット（段階1：Nスロット化の土台。最大3・最小1） ──────────────────
/** 参照ピッカーの1スロット（画像1枚＋その抽出結果／選択／抽出中フラグ）。 */
export interface RefSlot {
  image: string | null;
  fields: Record<string, string>;
  extracting: boolean;
  extractError: string | null;
  autoSelecting: boolean;
  /** 段階3：この画像を自動保存した参照履歴レコードのid（未保存はnull）。抽出完了時に同じレコードへ追記する。 */
  recordId: string | null;
}
export const MAX_REF_SLOTS = 3;
function emptySlot(): RefSlot {
  return { image: null, fields: {}, extracting: false, extractError: null, autoSelecting: false, recordId: null };
}

/** 段階3：スロット識別色（見出しのみに使用・0=青/1=緑/2=橙）。ReflectionStatusBar の TONE_CLS 設計を参考。
 *  ※「どのスロットか」の区別用。セルの赤枠（適用中か）とは役割を分ける（色が競合しないよう見出し限定）。 */
function slotColor(i: number): string {
  switch (i) {
    case 0: return "border-sky-400/50 bg-sky-500/15 text-sky-100";          // 青＝スロット1
    case 1: return "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"; // 緑＝スロット2
    default: return "border-orange-400/50 bg-orange-500/15 text-orange-100";   // 橙＝スロット3
  }
}

interface Props {
  /** true=main view（表示）／false=history等の他view（非表示・アンマウントしない＝state保持）。
   *  旧実装は親側 {view==="main" && <Panel/>} の条件付きレンダーで、view切替のたびに
   *  本コンポーネントがアンマウント→再マウントされ全state（slots等）が初期化されていた。
   *  常時マウント＋本フラグで見た目だけ隠す方式に変更（state破棄バグの修正）。 */
  visible: boolean;
  protections: ReferenceProtections;
  /** 現在 ON の変更対象（適用済み表示用） */
  activeScopes: Scope[];
  /** 現在の referenceNote（適用済み表示用） */
  appliedNote: Record<string, string>;
  /** [適用]。許可されたら true。App 側で保護ゲート最終判定＋scope ON＋note追記。 */
  onApply: (catKey: string, text: string) => boolean;
  /** 🖼 要素を1つだけ解除（catKey単位・段階3コミット5）。App 側で referenceNote から catKey を外す。 */
  onUnapply?: (catKey: string) => void;
  /** 全解除（referenceNote クリア） */
  onClearAll: () => void;
  /** 参照画像＋抽出13カテゴリの変化を親へ通知（Compare Mode 用・任意）。生成時に参照レコードへ残す。 */
  onContextChange?: (ctx: { image: string; extracted: Record<string, string> } | null) => void;
  /** Compare Mode（参照↔生成 比較ビュー）を開く（任意）。 */
  onOpenCompare?: () => void;
  /** 📌 旧・現在の参照画像＋抽出を「Reference Picker履歴」へ手動保存（任意・段階3で dormant 化）。
   *  段階3以降は画像を入れた瞬間に自動保存されるため、本コンポーネントは内部で呼ばない。
   *  呼び出し元（App.tsx）の関数・本フィールドは hide-not-delete で温存。 */
  onSaveToHistory?: () => Promise<boolean>;
  /** 🖼 上部バーの「参照ピッカー」ボタンから開く（任意）。値が変わる（増える）たびにパネルを開く。
   *  段階3：右端の縦タブ導線を廃止し、開く導線を App の上部バーへ集約するための signal。 */
  openToken?: number;
  /** ♻ 🕘履歴からの再利用 seed（任意）。token が変わるたびに 参照画像（サムネ）＋抽出を流し込み、開く。 */
  reuseSeed?: { image: string; extracted: Record<string, string>; token: number } | null;
  /** ♻ seed を流し込み終えたら呼ぶ（任意）。親が seed を null に戻し、再マウント時の二重注入を防ぐ。 */
  onReuseConsumed?: () => void;
}

export function ReferenceImportPanel({ visible, protections, activeScopes, appliedNote, onApply, onUnapply, onContextChange, onOpenCompare, openToken, reuseSeed, onReuseConsumed }: Props) {
  const [open, setOpen] = useState(false);
  // 🖼 段階3：カラム＝スロットの1対1（常に3固定）。空カラムに画像を落とせば埋まる（追加/削除ボタンは廃止）。
  const [slots, setSlots] = useState<RefSlot[]>(() => Array.from({ length: MAX_REF_SLOTS }, () => emptySlot()));
  // 段階3：activeSlot は「Ctrl+V の貼り付け先／📁ファイル選択先」＝最後にクリック/操作したカラム。
  const [activeSlot, setActiveSlot] = useState(0);
  // 🖼 段階2：要素ごとの横断選択。catKey → どのスロットindexから取るか（未指定＝activeSlotへフォールバック）。
  const [catSlotMap, setCatSlotMap] = useState<Record<string, number>>({});
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null); // 段階3：どのカラムにドラッグ中か
  const [note, setNote] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTargetRef = useRef(0); // 段階3：共有 file input がどのカラム（スロット）向けか

  // アクティブスロット（貼り付け先）の image/fields を導出（拡大表示・Compare通知に使用）。
  const current = slots[activeSlot] ?? emptySlot();
  const { image, fields } = current;
  // 段階3：抽出完了時に recordId を最新値で読むための ref（自動保存の非同期完了と抽出のタイミングが
  // 前後してもレースなく正しいレコードへ追記できるようにする）。
  const slotsRef = useLatestRef(slots);

  /** 段階2：catKey が実際にどのスロットindexから取られるか解決する（未指定・範囲外はactiveSlotへフォールバック）。 */
  const resolveCatSlotIndex = useCallback((catKey: string): number => {
    const mapped = catSlotMap[catKey];
    if (mapped != null && mapped < slots.length) return mapped;
    return activeSlot;
  }, [catSlotMap, activeSlot, slots.length]);

  /** 段階2：catKey の実効テキスト（解決したスロットのfields[catKey]）。 */
  const resolveCatText = useCallback((catKey: string): string => {
    const slotIndex = resolveCatSlotIndex(catKey);
    return (slots[slotIndex]?.fields[catKey] ?? "").trim();
  }, [slots, resolveCatSlotIndex]);

  /** 指定スロットを部分更新する（配列の該当indexだけ差し替え・他スロットは不変）。 */
  const updateSlot = useCallback((index: number, patch: Partial<RefSlot> | ((s: RefSlot) => Partial<RefSlot>)) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s)));
  }, []);

  // 段階3：カラム＝スロット3固定にしたため addSlot/removeSlot は廃止（カラム単位クリアはコミット3で clearSlot として実装）。

  // 段階2：JSON確認/コピーは「実際に適用される組み合わせ」＝各カテゴリの解決済みテキストを表示する。
  const currentJson = REFERENCE_CATEGORIES.reduce<Record<string, string>>((acc, c) => {
    acc[c.key] = resolveCatText(c.key);
    return acc;
  }, {});

  // Compare Mode 用：参照画像＋抽出の最新を親へ通知（image/fields 変化時のみ・通知は副作用なし）。
  useEffect(() => {
    if (!onContextChange) return;
    if (!image) { onContextChange(null); return; }
    const extracted = REFERENCE_CATEGORIES.reduce<Record<string, string>>((acc, c) => {
      acc[c.key] = (fields[c.key] ?? "").trim();
      return acc;
    }, {});
    onContextChange({ image, extracted });
  }, [image, fields, onContextChange]);

  const flash = useCallback((m: string) => {
    setNote(m);
    window.setTimeout(() => setNote((cur) => (cur === m ? null : cur)), 2600);
  }, []);

  /** 段階3：カラム単位クリア（クリアインプレース＝スロット枠は残して中身だけ空に・削除して詰めない＝常に3カラム維持）。
   *  画像/抽出結果/抽出中フラグ/recordId を空にし、catSlotMap から このスロットを指すエントリを削除する。
   *  ★適用済み referenceNote は解除しない（referenceNote は catKey→text のみでスロット由来を持たないため
   *  構造的に不可）。適用の取り消しは §5 の 🖼参照画像バッジ「× 解除」で行う（作業state のみを空にする）。 */
  const clearSlot = useCallback((i: number) => {
    updateSlot(i, emptySlot());
    setCatSlotMap((prev) => {
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(prev)) if (v !== i) next[k] = v; // このスロットを指す横断選択は削除（→activeSlotへフォールバック）
      return next;
    });
    flash(`スロット${i + 1}の中身をクリアしました（適用済みの反映は解除していません）`);
  }, [updateSlot, flash]);

  // ♻ 🕘履歴からの「再利用」：参照画像（サムネ）＋抽出13カテゴリをピッカーへ流し込み、開く。
  // token が変わるたびに再実行（同一レコードの再利用も拾う）。適用はユーザーが従来どおり押す＝適用ロジック不変。
  useEffect(() => {
    if (!reuseSeed) return;
    const next: Record<string, string> = {};
    for (const c of REFERENCE_CATEGORIES) next[c.key] = (reuseSeed.extracted[c.key] ?? "").trim();
    // 履歴は単一画像レコード（段階1）＝スロットを1件にリセットして流し込む。
    // recordId は紐付けない（reuseSeed.image はサムネであり元画像と contentHash が一致しない場合があるため、
    // 再度お気に入り登録すれば新規レコードとして安全に保存される＝データ破壊なし）。
    // 段階3：常に3カラム固定。slot0 へ流し込み、slot1/2 は空でパディング。
    setSlots([
      { image: reuseSeed.image, fields: next, extracting: false, extractError: null, autoSelecting: false, recordId: null },
      emptySlot(),
      emptySlot(),
    ]);
    setActiveSlot(0);
    // 段階3：単一スロットへ戻すため、古い横断選択マップはリセット（既定＝スロット1）。
    setCatSlotMap({});
    setOpen(true);
    flash("♻ 履歴から再利用しました。内容を確認し「適用」で反映してください。");
    onReuseConsumed?.(); // 親が seed を null に戻す＝再マウント時の二重注入防止
  }, [reuseSeed, flash, onReuseConsumed]);

  /** 段階3：画像をスロットへセットした直後に「Reference Picker履歴」へ自動保存する（入れた瞬間の自動保存）。
   *  contentHash で dedup（同じ画像を入れ直しても新規レコードを作らない・saveReferenceRecord側で判定）。
   *  抽出前のため extracted は空で保存し、抽出が完了したら同じレコードへ追記する（runExtract/handleAutoSelectFromReference）。
   *  失敗してもピッカーの操作は妨げない（ベストエフォート・トースト無し＝自動保存は静かに行う）。 */
  const autoSaveSlotImage = useCallback(async (slotIndex: number, image: string) => {
    try {
      const [refThumb, contentHash] = await Promise.all([makeThumbnail(image), imageContentHash(image)]);
      const id = await saveReferenceRecord({
        refThumb,
        contentHash,
        extracted: {},
        applied: {},
        batchId: "",
        kind: "picker",
      });
      updateSlot(slotIndex, { recordId: id });
    } catch {
      /* 自動保存の失敗はピッカー操作を止めない */
    }
  }, [updateSlot]);

  const loadFile = useCallback((file: File, slotIndex: number = activeSlot) => {
    if (!file.type.startsWith("image/")) { flash("画像ファイルを入れてください"); return; }
    // 段階3：取り込んだ画像は指定カラム（スロット）へ。省略時はアクティブカラム（＝貼り付け先）。
    readFileAsDataUrl(file)
      .then((url) => {
        updateSlot(slotIndex, { image: url, recordId: null }); // 新しい画像＝前の recordId はリセット
        setOpen(true);
        void autoSaveSlotImage(slotIndex, url); // 入れた瞬間に自動保存（段階3）
      })
      .catch(() => flash("画像の読み込みに失敗しました"));
  }, [flash, activeSlot, updateSlot, autoSaveSlotImage]);

  // Ctrl+V / Cmd+V / スクショ貼付（クリップボードに画像がある時だけ作動・テキスト貼付は妨げない）
  // ピッカーが open の時だけ購読する（閉じている間は貼付を生成用 ImageUploader に渡す）。
  // 画像を処理する時は capture フェーズで先取りし、stopImmediatePropagation で
  // ImageUploader（window/bubble）等の他リスナーへの伝播を止める＝左の画像選択欄への二重ロードを防ぐ。
  useEffect(() => {
    if (!visible || !open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); e.stopImmediatePropagation(); loadFile(f); }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  }, [visible, open, loadFile]);

  // 段階3：全画面パネル表示中（visible && open）は背面（メイン画面）のスクロールを止める
  // （背面スクロール防止＋スクロールバーのガター解消・CompareModeView と同じパターン）。
  useEffect(() => {
    if (!visible || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [visible, open]);

  // 段階3：上部バーの「🖼 参照ピッカー」ボタンから開く。openToken が増えるたびにパネルを開く
  // （初期値 0 の初回発火は開かない・以後クリックごとに +1 されて再オープンする）。
  useEffect(() => {
    if (openToken != null && openToken > 0) setOpen(true);
  }, [openToken]);

  // 段階3：Escape でパネルを閉じる（ライトボックス→右クリックメニュー→パネルの順で優先）。
  // enabled=visible && open の時だけリスナーを張る（他view・折りたたみ時は無反応）。
  useEscapeKey(() => {
    if (lightbox) setLightbox(false);
    else if (ctxMenu) setCtxMenu(null);
    else setOpen(false);
  }, visible && open);

  // 右クリック→独自メニュー「貼り付け」。navigator.clipboard.read() で画像を取得（ユーザー操作起点）。
  // 権限拒否・未対応・画像なし等で失敗したら Ctrl+V を案内（Ctrl+V は常に有効＝二重化）。
  // 第1便の paste 分離（open限定＋capture＋stopImmediatePropagation）には触れない別経路。
  const pasteFromClipboard = useCallback(async () => {
    setCtxMenu(null);
    try {
      if (!navigator.clipboard?.read) { flash("この環境は右クリック貼り付け非対応です。Ctrl+V で貼り付けてください"); return; }
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await it.getType(type);
          loadFile(new File([blob], "pasted-image", { type }));
          return;
        }
      }
      flash("クリップボードに画像がありません。Ctrl+V でも貼り付けられます");
    } catch {
      flash("クリップボードを読めませんでした。Ctrl+V で貼り付けてください");
    }
  }, [loadFile, flash]);

  // 段階3：編集は「そのカラム（スロット）」へ直接書き込む（転置レイアウト＝カラムがスロット）。
  const setFieldAt = (slotIndex: number, k: string, v: string) =>
    updateSlot(slotIndex, (s) => ({ fields: { ...s.fields, [k]: v } }));
  // 段階3：一括適用(applyOne/applyAll/applySelected)・全解除(clearAll)・チェック選択(toggleSelAt)は
  // 共有バー撤去に伴い廃止。適用は各セルの「◯◯に適用」＝onApply(catKey,text) 直呼び、
  // 解除は 📡反映状態バーの 🖼参照画像バッジ「× 解除」で行う（onClearAll/handleClearReference は温存）。

  /** 現在の13カテゴリ欄を JSON にしてコピー（抽出結果の比較・共有用・段階2＝解決済みの組み合わせ） */
  const copyJson = useCallback(() => {
    const obj: Record<string, string> = {};
    for (const c of REFERENCE_CATEGORIES) obj[c.key] = resolveCatText(c.key);
    const json = JSON.stringify(obj, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => flash("抽出JSONをコピーしました"),
        () => window.prompt("抽出JSON（コピーしてください）", json),
      );
    } else {
      window.prompt("抽出JSON（コピーしてください）", json);
    }
  }, [resolveCatText, flash]);

  /** ⭐ 段階4：現在のアクティブスロットの参照履歴レコードをお気に入り登録する（旧「📌 履歴に保存」ボタンを転用）。
   *  画像は入れた瞬間（loadFile→autoSaveSlotImage）に既に自動保存済み＝ここでは favorite:true を立てるだけ。
   *  自動保存がまだ完了していない稀なケース（極端に速い操作）はその場で保存してから favorite を立てる。
   *  既存の favorite 機構（CompareModeView の toggleFavorite と同じ updateReferenceRecord）を再利用。 */
  const markSlotFavorite = useCallback(async (slotIndex: number = activeSlot) => {
    const slot = slotsRef.current[slotIndex];
    if (!slot?.image || saving) return;
    setSaving(true);
    try {
      let recordId = slot.recordId;
      if (!recordId) {
        const [refThumb, contentHash] = await Promise.all([makeThumbnail(slot.image), imageContentHash(slot.image)]);
        recordId = await saveReferenceRecord({
          refThumb,
          contentHash,
          extracted: slot.fields,
          applied: {},
          batchId: "",
          kind: "picker",
        });
        if (recordId) updateSlot(slotIndex, { recordId });
      }
      if (!recordId) { flash("登録に失敗しました"); return; }
      const ok = await updateReferenceRecord(recordId, { favorite: true });
      flash(ok ? "⭐ お気に入りに登録しました（🕘 履歴で確認できます）" : "登録に失敗しました");
    } catch {
      flash("登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [activeSlot, saving, flash, updateSlot]);

  /** Gemini Vision で「アクティブスロット」の参照画像を解析し、そのスロットの13カテゴリ欄を実抽出結果で埋める。
   *  slotIndex は呼び出し時（＝ボタン押下時）に確定するため、実行中にユーザーが別スロットへ切り替えても
   *  結果は元のスロットへ正しく反映される（他スロットの独立抽出と混線しない・各スロット1回=1呼び出し）。 */
  const runExtract = useCallback(async (slotIndex: number = activeSlot) => {
    const slot = slots[slotIndex];
    if (!slot?.image) { flash("先に参照画像を貼ってください"); return; }
    const img = slot.image;
    updateSlot(slotIndex, { extracting: true, extractError: null });
    try {
      const { elements, missingRequired } = await extractReferenceViaBackend(img);
      // 実抽出結果で各欄を上書き（空文字のカテゴリは空のまま＝でっち上げない）
      const nextFields = REFERENCE_CATEGORIES.reduce<Record<string, string>>((acc, c) => {
        acc[c.key] = (elements[c.key] ?? "").trim();
        return acc;
      }, {});
      updateSlot(slotIndex, { fields: nextFields });
      // 段階3：入れた瞬間に自動保存済みのレコードがあれば、抽出結果をそこへ追記（新規レコードは作らない）。
      const recordId = slotsRef.current[slotIndex]?.recordId;
      if (recordId) void updateReferenceRecord(recordId, { extracted: nextFields });
      flash(
        missingRequired.length > 0
          ? `スロット${slotIndex + 1}：抽出しました。${missingRequired.length}件の必須カテゴリが空でした。手入力で補ってください。`
          : `スロット${slotIndex + 1}：参照画像から抽出しました。内容を確認し「○○に適用」で反映してください。`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateSlot(slotIndex, { extractError: msg });
      flash(`スロット${slotIndex + 1}：抽出に失敗：${msg}`);
    } finally {
      updateSlot(slotIndex, { extracting: false });
    }
  }, [activeSlot, slots, flash, updateSlot]);

  /** 🎯 抽出済み fields(src) から変更対象 scope を固定優先度で最大5個選び、案B（scope UNION追加＋note注入）で一括適用。
   *  ★onApply(=handleApplyReference) 経由＝保護ゲート＋scope ON(UNION)＋referenceNote のみ。setDetails/place は一切呼ばない（温室回避）。
   *  抽出直後は state 反映待ちで applyOne が stale fields を読むため、src を直接 onApply へ渡す。 */
  const autoSelectFromFields = useCallback((src: Record<string, string>) => {
    const withText = REFERENCE_CATEGORIES.filter((c) => c.scope != null && (src[c.key] ?? "").trim());
    const lockedSkipped = withText.filter((c) => referenceLockReason(c, protections));
    const appliable = withText.filter((c) => !referenceLockReason(c, protections));
    if (appliable.length === 0) {
      flash(lockedSkipped.length > 0
        ? `適用可能な変更対象がありません（ロック軸のみ：${lockedSkipped.map((c) => c.label).join("・")}）`
        : "適用できる変更対象がありません（先に画像から抽出してください）");
      return;
    }
    // scope を固定優先度で並べ、上位 MAX_AUTO_SCOPES に絞る（composition/camera は camera に畳まれ重複排除）
    const orderedScopes: Scope[] = [];
    for (const s of AUTO_SCOPE_PRIORITY) {
      if (appliable.some((c) => c.scope === s) && !orderedScopes.includes(s)) orderedScopes.push(s);
    }
    const pickedScopes = new Set<Scope>(orderedScopes.slice(0, MAX_AUTO_SCOPES));
    const droppedScopes = orderedScopes.slice(MAX_AUTO_SCOPES);
    // 選ばれた scope のカテゴリを優先度順に適用（onApply 直呼び＝直近抽出値 src を確実に使う・details/place 不触）
    const toApply = appliable
      .filter((c) => pickedScopes.has(c.scope as Scope))
      .sort((a, b) => AUTO_SCOPE_PRIORITY.indexOf(a.scope as Scope) - AUTO_SCOPE_PRIORITY.indexOf(b.scope as Scope));
    let applied = 0;
    for (const c of toApply) {
      const text = (src[c.key] ?? "").trim();
      if (text && onApply(c.key, text)) applied++;
    }
    const parts: string[] = [];
    parts.push(applied > 0
      ? `🎯 ${pickedScopes.size}個の変更対象を自動セット（${[...pickedScopes].map((s) => AUTO_SCOPE_JA[s] ?? s).join("・")}）`
      : "自動セットできる変更対象がありませんでした");
    if (lockedSkipped.length > 0) parts.push(`ロック軸は除外：${lockedSkipped.map((c) => c.label).join("・")}`);
    if (droppedScopes.length > 0) parts.push(`上限${MAX_AUTO_SCOPES}超で除外：${droppedScopes.map((s) => AUTO_SCOPE_JA[s] ?? s).join("・")}`);
    flash(parts.join(" ／ "));
  }, [protections, onApply, flash]);

  /** 🎯 一発：「アクティブスロット」の参照画像→変更対象を自動セット。未抽出なら内部で抽出してから（真の一発・spinner・連打防止）。
   *  失敗時は scope 不変でトースト通知（フォールバック）。§4(referenceExtract)・§3データ層 不触・既存 API を呼ぶのみ。
   *  slotIndex は呼び出し時に確定＝実行中に別スロットへ切り替えても結果は元のスロットへ正しく反映される。 */
  const handleAutoSelectFromReference = useCallback(async (slotIndex: number = activeSlot) => {
    const slot = slots[slotIndex];
    if (!slot?.image) { flash("先に参照画像を貼ってください"); return; }
    if (slot.autoSelecting || slot.extracting) return;
    // 抽出済み（scope付きカテゴリに text が1つでもある）ならそのまま自動セット
    const hasExtracted = REFERENCE_CATEGORIES.some((c) => c.scope != null && (slot.fields[c.key] ?? "").trim());
    if (hasExtracted) { autoSelectFromFields(slot.fields); return; }
    // 未抽出 → 内部で抽出してから自動セット（state 反映待ちを避け、抽出値 next を直接渡す）
    updateSlot(slotIndex, { autoSelecting: true, extractError: null });
    try {
      const { elements } = await extractReferenceViaBackend(slot.image);
      const next: Record<string, string> = {};
      for (const c of REFERENCE_CATEGORIES) next[c.key] = (elements[c.key] ?? "").trim();
      updateSlot(slotIndex, { fields: next });
      // 段階3：自動保存済みレコードがあれば抽出結果を追記（新規レコードは作らない）。
      const recordId = slotsRef.current[slotIndex]?.recordId;
      if (recordId) void updateReferenceRecord(recordId, { extracted: next });
      autoSelectFromFields(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateSlot(slotIndex, { extractError: msg });
      flash(`自動セットに失敗：${msg}`);  // scope 不変のフォールバック
    } finally {
      updateSlot(slotIndex, { autoSelecting: false });
    }
  }, [activeSlot, slots, autoSelectFromFields, flash, updateSlot]);

  // 優先6カテゴリ（常時展開）／その他（折りたたみ）
  const PRIORITY_KEYS = ["background", "outfit", "pose", "hair", "composition", "lighting"];
  const priorityCats = REFERENCE_CATEGORIES.filter((c) => PRIORITY_KEYS.includes(c.key));
  const otherCats = REFERENCE_CATEGORIES.filter((c) => !PRIORITY_KEYS.includes(c.key));

  /** 段階3：転置セル＝カラム（スロット slotIndex）の1カテゴリを描く。
   *  ★適用は onApply(catKey, text) のまま（安全経路不変）。適用時に catSlotMap[cat]=slotIndex を設定＝
   *  「このカラムから適用」＝横断選択が押した瞬間に暗黙設定される。 */
  const renderCell = (slotIndex: number, cat: ReferenceCategory) => {
    const text = (slots[slotIndex]?.fields[cat.key] ?? "").trim();
    const lockReason = referenceLockReason(cat, protections);
    const hasText = text.length > 0;
    const isSource = resolveCatSlotIndex(cat.key) === slotIndex; // このカラムが現在の適用元か
    const applied = appliedNote[cat.key] != null && isSource;    // 適用済みは「適用元カラム」だけに表示
    const scopeOn = cat.scope != null && activeScopes.includes(cat.scope);
    const status = lockReason
      ? { text: "🔒 保護で適用不可", cls: "border-bg-border bg-bg-base/40 text-text-muted/60" }
      : applied
      ? { text: "✅ 適用済み（反映中）", cls: "border-violet-400/45 bg-violet-400/12 text-violet-200" }
      : hasText
      ? { text: "⚠ 未適用", cls: "border-amber-400/55 bg-amber-400/15 text-amber-100 font-bold" }
      : { text: "— 空", cls: "border-bg-border bg-bg-base/40 text-text-muted/55" };
    // このカラムから適用：適用元をこのカラムに設定し、onApply へこのカラムの text を直接渡す
    // （applyOne は resolveCatText を読むため、直後だと catSlotMap 反映待ちで旧スロットを読む＝直呼びで回避）。
    // ★安全経路（catKey, text 文字列のみ）は不変。
    const applyFromHere = () => {
      if (lockReason) { flash(lockReason); return; }
      if (!text) { flash(`「${cat.label}」に内容がありません`); return; }
      setCatSlotMap((prev) => ({ ...prev, [cat.key]: slotIndex }));
      const ok = onApply(cat.key, text);
      flash(ok ? `「${cat.label}」をスロット${slotIndex + 1}から適用しました` : `「${cat.label}」を適用できませんでした`);
    };
    return (
      <div key={cat.key} className={[
        "rounded-lg border px-2.5 py-2 space-y-1.5",
        lockReason
          ? "border-bg-border bg-bg-base/20 opacity-70"
          : applied
          ? "border-rose-500/70 bg-rose-500/[0.07] ring-1 ring-rose-500/40"   // 段階3：適用中(このセルが適用元)＝赤枠
          : hasText
          ? "border-amber-400/50 bg-amber-400/[0.06] ring-1 ring-amber-400/25" // 抽出済み・未適用＝黄枠
          : "border-bg-border bg-bg-base/40",
      ].join(" ")}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-bold text-text-base">{cat.label}</span>
          <span className={["text-[9px] px-1.5 py-0.5 rounded-full border leading-none", status.cls].join(" ")}>{status.text}</span>
          {cat.scope && scopeOn && (
            <span className="text-[9px] px-1 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 leading-none">変更対象ON</span>
          )}
          {isSource && hasText && !lockReason && (
            <span title="このカテゴリの適用元カラム" className="ml-auto text-[9px] px-1 py-0.5 rounded-full border border-bg-border text-text-muted/70 leading-none">◎ 適用元</span>
          )}
        </div>
        <AutoTextarea
          value={text}
          onChange={(v) => setFieldAt(slotIndex, cat.key, v)}
          placeholder={cat.placeholder}
          minRows={["background", "outfit", "pose"].includes(cat.key) ? 6 : 4}
        />
        <div className="flex items-center justify-end gap-1.5">
          {applied && (
            <button type="button" onClick={() => onUnapply?.(cat.key)}
              title={`「${cat.label}」の反映を解除（この要素だけ・他の適用は残ります）`}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-rose-400/50 bg-rose-500/12 text-rose-100 hover:bg-rose-500/22 transition">
              解除
            </button>
          )}
          <button type="button" onClick={applyFromHere} disabled={!!lockReason}
            title={lockReason ?? `${cat.label}をこのカラム（スロット${slotIndex + 1}）から変更対象に反映`}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-violet-400/50 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {cat.label}に適用
          </button>
        </div>
      </div>
    );
  };

  /** 段階3：1カラム＝1スロット（画像取り込み＋抽出操作＋そのスロットの13カテゴリ）。
   *  取り込み/抽出/自動セット/お気に入りは全てこのカラムの slotIndex を対象に動作（混線しない）。 */
  const renderColumn = (i: number) => {
    const slot = slots[i] ?? emptySlot();
    const active = i === activeSlot;
    const busy = slot.extracting || slot.autoSelecting;
    const hasContent = !!slot.image || Object.values(slot.fields).some((v) => (v ?? "").trim().length > 0);
    return (
      <div
        key={i}
        onClick={() => setActiveSlot(i)}
        className={[
          "flex flex-col min-h-0 rounded-xl border p-2 lg:overflow-hidden transition",
          active ? "border-violet-400/60 ring-1 ring-violet-400/30" : "border-bg-border",
        ].join(" ")}
      >
        {/* カラムヘッダ（スロット番号・貼り付け先インジケータ・中身をクリア） */}
        <div className="shrink-0 flex items-center gap-1.5 mb-1.5">
          <span className={["text-[12px] font-bold px-2 py-0.5 rounded-md border leading-none", slotColor(i)].join(" ")}>スロット{i + 1}</span>
          {active && <span title="Ctrl+V の貼り付け先" className="text-[9px] px-1 py-0.5 rounded-full border border-violet-400/40 bg-violet-500/10 text-violet-200 leading-none">貼付先</span>}
          {busy && <span className="w-1.5 h-1.5 rounded-full bg-violet-200 animate-pulse" />}
          {hasContent && (
            <button type="button" onClick={(e) => { e.stopPropagation(); clearSlot(i); }}
              title="このカラムの画像・抽出結果・要素選択をまるごと空にします（適用済みの反映は解除しません）"
              className="ml-auto text-[9px] px-1.5 py-0.5 rounded border border-rose-400/40 bg-rose-400/8 text-rose-200/85 hover:bg-rose-400/16 transition leading-none">
              🧹 中身をクリア
            </button>
          )}
        </div>

        {/* 取り込みエリア（左）＋抽出操作（右）を横並び（このカラム＝スロットに対して動作） */}
        <div className="shrink-0 flex items-start gap-2">
          <div
            onContextMenu={(e) => { e.preventDefault(); setActiveSlot(i); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverSlot(i); }}
            onDragLeave={() => setDragOverSlot((cur) => (cur === i ? null : cur))}
            onDrop={(e) => { e.preventDefault(); setDragOverSlot(null); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f, i); }}
            className={[
              "flex-1 min-w-0 rounded-lg border border-dashed px-2 py-2 text-center transition",
              dragOverSlot === i ? "border-violet-400 bg-violet-500/10" : "border-bg-border bg-bg-base/40",
            ].join(" ")}
          >
            {slot.image ? (
              <img src={slot.image} alt="参照" onClick={(e) => { e.stopPropagation(); setActiveSlot(i); setLightbox(true); }} title="クリックで拡大"
                className="max-h-44 w-full rounded border border-bg-border object-contain cursor-zoom-in" />
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-text-base font-semibold">画像をドラッグ＆ドロップ</p>
                <p className="text-[10px] text-text-muted/80 leading-snug">
                  または <kbd className="px-1 rounded bg-white/10">Ctrl/⌘+V</kbd>
                </p>
                <button type="button" onClick={(e) => { e.stopPropagation(); fileTargetRef.current = i; fileRef.current?.click(); }}
                  className="mt-1 text-[10.5px] px-2 py-1 rounded-lg border border-violet-400/45 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition">
                  📁 ファイルを選択
                </button>
              </div>
            )}
          </div>

          <div className="w-32 shrink-0 space-y-1.5">
            <button type="button" disabled={!slot.image || busy}
              onClick={(e) => { e.stopPropagation(); void runExtract(i); }}
              title={slot.image ? "Gemini Vision で参照画像を解析し各欄を埋める" : "先に参照画像を貼ってください"}
              className="w-full text-[11px] leading-tight font-bold px-2 py-1.5 rounded-lg border border-violet-400/55 bg-violet-500/18 text-violet-50 hover:bg-violet-500/28 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1 text-center">
              {slot.extracting ? (<><span className="w-1.5 h-1.5 rounded-full bg-violet-200 animate-pulse" />解析中…</>) : "✨ 画像から要素抽出"}
            </button>
            <button type="button" disabled={!slot.image || busy}
              onClick={(e) => { e.stopPropagation(); void handleAutoSelectFromReference(i); }}
              title={slot.image ? "参照画像を解析し、変更対象を優先度順に最大5個ONにします（未解析なら自動で解析）。元画像の設定は変更しません。" : "先に参照画像を貼ってください"}
              className="w-full text-[10.5px] leading-tight font-bold px-2 py-1.5 rounded-lg border border-sky-400/55 bg-sky-500/18 text-sky-50 hover:bg-sky-500/28 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1 text-center">
              {slot.autoSelecting ? (<><span className="w-1.5 h-1.5 rounded-full bg-sky-200 animate-pulse" />自動セット中…</>) : "🎯 変更対象を自動セット"}
            </button>
            <button type="button" disabled={!slot.image || saving}
              onClick={(e) => { e.stopPropagation(); void markSlotFavorite(i); }}
              title={slot.image ? "このスロットの参照をお気に入り登録（画像は自動保存済み・お気に入りは上限から保護）" : "先に参照画像を貼ってください"}
              className="w-full text-[10.5px] leading-tight font-semibold px-2 py-1 rounded border border-amber-400/45 bg-amber-500/12 text-amber-100 hover:bg-amber-500/22 transition disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? "登録中…" : "⭐ お気に入りに登録"}
            </button>
            {slot.image && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={(e) => { e.stopPropagation(); fileTargetRef.current = i; fileRef.current?.click(); }}
                  className="flex-1 text-[10.5px] px-1 py-0.5 rounded border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition">画像を変更</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); updateSlot(i, { image: null }); }}
                  className="flex-1 text-[10.5px] px-1 py-0.5 rounded border border-rose-400/35 bg-rose-400/8 text-rose-200/85 hover:bg-rose-400/16 transition">画像を外す</button>
              </div>
            )}
          </div>
        </div>
        {slot.extractError && (
          <p className="shrink-0 mt-1 text-[10px] text-rose-300/90 leading-snug">⚠ {slot.extractError}</p>
        )}

        {/* このスロットの抽出要素（lg で独立縦スクロール） */}
        <div className="mt-2 space-y-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-0.5">
          {priorityCats.map((cat) => renderCell(i, cat))}
          <button type="button" onClick={(e) => { e.stopPropagation(); setOthersOpen((v) => !v); }}
            className="w-full text-left text-[11px] font-semibold text-text-muted/80 hover:text-text-base px-1 py-1 transition">
            {othersOpen ? "▲" : "▼"} その他（色味・小物・前景・世界観・質感・雰囲気）
          </button>
          {othersOpen && otherCats.map((cat) => renderCell(i, cat))}
        </div>
      </div>
    );
  };

  // ── 非表示（history等の他view）：アンマウントせず見た目だけ隠す（state保持） ──────
  if (!visible) return null;

  // ── 閉じている間は何も描画しない（開く導線は App 上部バーの「🖼 参照ピッカー」ボタンに集約） ──
  if (!open) return null;

  return (
    // 段階3：横ドロワー → 全画面大パネル（CompareModeView と同じ 2層シェル：bg-base 外殻 + bg-panel 内殻）。
    <aside className="fixed inset-0 z-40 flex flex-col bg-bg-base">
      <div className="flex-1 min-h-0 flex flex-col bg-bg-panel overflow-hidden">
      {/* ヘッダ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bg-border shrink-0">
        <span className="text-[14px]">🖼</span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-bold text-text-base">Reference Picker</span>
          <span className="text-[10px] text-text-muted/70">参照ピッカー / 要素抽出</span>
        </span>
        {onOpenCompare && (
          <button type="button" onClick={onOpenCompare}
            title="Reference Picker履歴（保存した参照・抽出を再利用／生成と比較）を開く"
            className="ml-auto text-[11px] px-2 py-0.5 rounded border border-violet-400/40 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22 transition leading-none">
            🕘 履歴
          </button>
        )}
        <button type="button" onClick={() => setShowJson((v) => !v)}
          title="抽出した13カテゴリを JSON で一括確認"
          className={[onOpenCompare ? "ml-1" : "ml-auto", "text-[11px] px-2 py-0.5 rounded border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition leading-none"].join(" ")}>
          {showJson ? "🔎 JSONを隠す" : "🔎 抽出JSONを見る"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-[12px] text-text-muted hover:text-text-base transition leading-none px-1">✕ 閉じる</button>
      </div>

      {/* 抽出JSON 一括表示 */}
      {showJson && (
        <div className="px-3 py-2 border-b border-bg-border bg-bg-base/40 shrink-0">
          <pre className="text-[10px] text-text-base/90 leading-snug max-h-48 overflow-auto whitespace-pre-wrap break-all bg-bg-base/60 rounded p-2 border border-bg-border">
{JSON.stringify(currentJson, null, 2)}
          </pre>
          <button type="button" onClick={copyJson}
            className="mt-1 text-[10px] px-2 py-0.5 rounded border border-bg-border bg-bg-panel text-text-muted hover:text-text-base transition">📋 コピー</button>
        </div>
      )}

      {/* 本体：3カラム（スロット別・lg で各カラム独立縦スクロール）。共有バー（反映状況・一括操作・注記）は撤去。 */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:flex lg:flex-col px-3 py-2.5">

        {/* 3カラム（スロット別）。lg 未満は縦積み・lg で3等分＋各カラム独立縦スクロール。 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:flex-1 lg:min-h-0">
          {[0, 1, 2].map((i) => renderColumn(i))}
        </div>

        {/* 共有 file input（📁ファイル選択・fileTargetRef で対象カラムを判定） */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f, fileTargetRef.current); if (fileRef.current) fileRef.current.value = ""; }} />
      </div>

      {/* フッタ通知 */}
      {note && (
        <div className="shrink-0 px-3 py-2 border-t border-bg-border text-[11px] text-violet-100 bg-violet-500/10">
          {note}
        </div>
      )}
      </div>{/* /内殻（bg-panel） */}

      {/* 参照画像 拡大表示（クリックで閉じる） */}
      {lightbox && image && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
          onClick={() => setLightbox(false)}>
          <img src={image} alt="参照（拡大）" className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg border border-white/15" />
          <button type="button" onClick={() => setLightbox(false)}
            className="fixed top-3 right-4 text-white/80 hover:text-white text-[20px] leading-none">✕</button>
        </div>
      )}

      {/* 右クリック・コンテキストメニュー（画像エリア用・「貼り付け」のみ）。失敗時は Ctrl+V 案内へ。 */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[410]" onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="fixed z-[411] rounded-lg border border-bg-border bg-bg-panel shadow-xl py-1"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 170), top: ctxMenu.y }}>
            <button type="button" onClick={() => { void pasteFromClipboard(); }}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-base hover:bg-violet-500/20 transition w-full text-left whitespace-nowrap">
              📋 クリップボードから貼り付け
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
