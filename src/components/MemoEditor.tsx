import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onCommit: (next: string) => void;
  open: boolean;
  onClose: () => void;
}

/**
 * Inline expandable memo editor. Commits on blur or explicit Save.
 */
export function MemoEditor({ value, onCommit, open, onClose }: Props) {
  const [draft, setDraft] = useState(value);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value, open]);

  useEffect(() => {
    if (open) taRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const save = () => {
    if (draft !== value) onCommit(draft);
    onClose();
  };

  return (
    <div className="mt-2 p-3 rounded-xl border border-bg-border bg-bg-panel/60">
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        placeholder="結果画像の感想／どのAIで使ったか／どこが良かった or 微妙だったかなど"
        rows={3}
        className="w-full bg-bg-base border border-bg-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          className="btn text-xs"
          onClick={() => {
            setDraft(value);
            onClose();
          }}
        >
          キャンセル
        </button>
        <button type="button" className="btn-primary text-xs px-3 py-1.5" onClick={save}>
          保存
        </button>
      </div>
    </div>
  );
}
