/**
 * MyPresetsSection — マイプリセット（QuickActions内の1セクション）。
 *
 * 現在の全設定（スコープ・詳細・世界観/斬新背景/画法世界・配色主従）を名前付きで
 * 保存し、一覧からワンクリックで再適用する。保存/適用/上書き/削除の実処理は
 * すべて App.tsx 側（src/lib/myPresets.ts 経由）に委ね、本コンポーネントは
 * 表示と名前入力のみを担当する（純表示コンポーネント・croppedImages一覧UIと同じ分離）。
 *
 * 一覧は横並びチップではなく縦1行1件のリストにして、最大20件まで増えても
 * 「適用（名前クリック）／上書き／削除」の3操作が常に読める配置を保つ。
 *
 * ここは設定画面なので「開閉トグル＋直近10件」に絞る（既定は閉じた状態＝常時ズラッと
 * 並ばない）。全件は左のExplorerパネルの💾マイ保存区画で見る。
 */
import { useState } from "react";
import { MY_PRESET_MAX } from "../lib/myPresets";
import type { MyPresetRecord } from "../lib/myPresets";

/** 設定画面に出す最大件数（これを超えた分はExplorerパネルの全件一覧で見る）。 */
const RECENT_LIMIT = 10;

interface MyPresetsSectionProps {
  presets:      MyPresetRecord[];
  disabled?:    boolean;
  atCap:        boolean;
  /** 保存欄を開いた瞬間に入力欄へ流し込む自動生成名（「YYYY/MM/DD 設定ラベル」）。 */
  defaultName:  string;
  onSave:       (name: string) => void;
  onApply:      (preset: MyPresetRecord) => void;
  onOverwrite:  (id: string) => void;
  onDelete:     (id: string) => void;
}

export function MyPresetsSection({
  presets, disabled, atCap, defaultName, onSave, onApply, onOverwrite, onDelete,
}: MyPresetsSectionProps) {
  const [open, setOpen]     = useState(false);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft]   = useState("");
  const recent = presets.slice(0, RECENT_LIMIT);

  const openNaming = () => {
    setDraft(defaultName);
    setNaming(true);
  };

  const commit = () => {
    if (!draft.trim()) return;
    onSave(draft);
    setDraft("");
    setNaming(false);
  };

  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className="pt-[5px] text-[13px] font-bold uppercase tracking-widest text-white/90 whitespace-nowrap w-12 text-right shrink-0 leading-none">
        マイ保存
      </div>
      <div className="w-px min-h-[20px] self-stretch bg-white/8 shrink-0" />
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="今の設定に名前を付けて保存し、いつでも呼び戻せる。クリックで展開"
          className="self-start rounded-lg px-3 py-1.5 text-[13px] font-semibold border leading-none whitespace-nowrap transition border-emerald-400/50 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20 hover:border-emerald-400/80"
        >
          💾 マイ保存（{presets.length}）{open ? "▲" : "▼"}
        </button>

        {open && (
        <>
        <span className="w-full text-[10px] text-text-desc leading-snug">
          今の設定（変更対象・詳細・世界観/斬新背景/画法世界・配色主従）を保存していつでも呼び戻せる。
          名前は「日付＋今の設定内容」が自動で入る（書き換え・追記も自由）。（{presets.length}/{MY_PRESET_MAX}件）
        </span>

        {!naming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNaming}
              disabled={disabled || atCap}
              title={atCap ? "上限20件です。削除してから保存してください" : "今の設定に名前を付けて保存"}
              className="self-start rounded-lg px-3 py-1.5 text-[13px] font-semibold border leading-none whitespace-nowrap transition disabled:opacity-40 disabled:cursor-not-allowed border-emerald-400/50 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20 hover:border-emerald-400/80"
            >
              ＋ 今の設定を保存
            </button>
            {atCap && (
              <span className="text-[11px] text-amber-300/80 font-semibold">
                上限20件です。保存するには下の一覧から削除してください。
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setNaming(false); setDraft(""); }
              }}
              placeholder="プリセット名"
              maxLength={60}
              className="rounded-lg px-2.5 py-1.5 text-[13px] bg-bg-panel/80 border border-emerald-400/40 text-text-base placeholder:text-text-muted/50 focus:outline-none focus:border-emerald-400/80 min-w-0 w-72"
            />
            <button
              type="button"
              onClick={commit}
              disabled={!draft.trim()}
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold border leading-none whitespace-nowrap transition disabled:opacity-40 disabled:cursor-not-allowed border-emerald-400/70 bg-emerald-400/20 text-emerald-100"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => { setNaming(false); setDraft(""); }}
              className="rounded-lg px-3 py-1.5 text-[13px] border leading-none whitespace-nowrap transition border-white/15 bg-white/5 text-text-muted hover:text-text-base"
            >
              キャンセル
            </button>
          </div>
        )}

        {presets.length === 0 ? (
          <p className="text-[11px] text-text-muted/60 italic mt-0.5">
            まだ保存されたプリセットはありません。上のボタンで今の設定を保存できます。
          </p>
        ) : (
          <div className="flex flex-col gap-1 mt-0.5 max-w-full">
            {recent.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-lg border border-bg-border bg-bg-panel/70 px-1 py-0.5 min-w-0"
              >
                <button
                  type="button"
                  onClick={() => onApply(p)}
                  disabled={disabled}
                  title={`クリックでこのプリセットを適用（保存日：${new Date(p.createdAt).toLocaleDateString()}）`}
                  className="flex-1 min-w-0 text-left px-2 py-1.5 text-[13px] font-semibold text-text-muted hover:text-text-base disabled:opacity-40 disabled:cursor-not-allowed truncate"
                >
                  📂 {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => onOverwrite(p.id)}
                  disabled={disabled}
                  title="今の設定でこのプリセットを上書き保存する"
                  className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-sky-300/80 hover:text-sky-200 hover:bg-sky-400/10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  ⟳ 上書き
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  disabled={disabled}
                  title="このプリセットを削除する"
                  className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-rose-300/80 hover:text-rose-200 hover:bg-rose-400/10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  × 削除
                </button>
              </div>
            ))}
            {presets.length > RECENT_LIMIT && (
              <p className="text-[11px] text-text-muted/70 mt-0.5">
                新しい{RECENT_LIMIT}件を表示中（全{presets.length}件）。すべては左の「📁 Explorer」の
                💾マイ保存から見られます。
              </p>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
