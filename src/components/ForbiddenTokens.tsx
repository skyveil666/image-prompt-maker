/**
 * ForbiddenTokens — 禁止モチーフ・禁止ワード入力 UI
 *
 * タグ形式で禁止要素を追加・削除・全クリアできる。
 * 各タグは意味ベースで展開されるため、
 * 「ドレス」と入力するだけで dress / gown / goddess dress 等が
 * 自動的に除外候補に加わる。
 */

import { useState, useRef, useCallback } from "react";
import { tokenPreview, FORBIDDEN_SUGGESTIONS } from "../lib/forbiddenTokens";

interface Props {
  tokens:   string[];
  onChange: (tokens: string[]) => void;
}

export function ForbiddenTokens({ tokens, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── ハンドラ ──────────────────────────────────────────────────────────────

  const handleAdd = useCallback((raw: string) => {
    const val = raw.trim();
    if (!val || tokens.includes(val)) return;
    onChange([...tokens, val]);
    setInputValue("");
    setShowSuggestions(false);
  }, [tokens, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAdd(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tokens.length > 0) {
      onChange(tokens.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [inputValue, tokens, onChange, handleAdd]);

  const handleRemove = useCallback((idx: number) => {
    onChange(tokens.filter((_, i) => i !== idx));
  }, [tokens, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // ── サジェスト絞り込み ────────────────────────────────────────────────────

  const filteredSuggestions = inputValue.length >= 1
    ? FORBIDDEN_SUGGESTIONS.filter(
        (s) => s.includes(inputValue) && !tokens.includes(s),
      ).slice(0, 6)
    : [];

  // ── レンダリング ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">

      {/* ヘッダ行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-widest text-text-muted/80 select-none">
            🚫 禁止モチーフ
          </span>
          {tokens.length > 0 && (
            <span className="text-[11px] text-text-muted/70 leading-none">
              ({tokens.length}件)
            </span>
          )}
        </div>
        {tokens.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] text-text-muted/65 hover:text-rose-400/80 transition leading-none"
          >
            全クリア
          </button>
        )}
      </div>

      {/* タグ + 入力フィールド */}
      <div
        className="flex flex-wrap gap-1.5 min-h-[30px] px-2 py-1.5 rounded-lg border border-[#252e44] bg-[#0b0d12]
                   cursor-text focus-within:border-rose-500/40 transition"
        onClick={() => inputRef.current?.focus()}
      >
        {tokens.map((tok, i) => (
          <TokenTag
            key={`${tok}-${i}`}
            label={tok}
            preview={tokenPreview(tok)}
            onRemove={() => handleRemove(i)}
          />
        ))}

        {/* 入力 */}
        <div className="relative flex-1 min-w-[100px]">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={tokens.length === 0 ? "黒バラ、ドレス、クリスタル…" : "追加…"}
            className="w-full bg-transparent text-[12px] text-text-base placeholder:text-text-muted/60
                       outline-none leading-none py-0.5"
          />

          {/* サジェストドロップダウン */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div
              className="absolute top-full left-0 mt-1 z-50 min-w-[140px]
                         bg-[#131720] border border-[#252e44] rounded-lg shadow-xl overflow-hidden"
            >
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleAdd(s); }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-text-muted/90
                             hover:bg-rose-500/10 hover:text-rose-200 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 入力ヒント */}
      <p className="text-[11px] text-text-muted/65 leading-relaxed">
        Enter で追加。意味ベースで類語も自動除外（例：「ドレス」→ dress, gown, goddess dress…）
      </p>

    </div>
  );
}

// ── TokenTag ─────────────────────────────────────────────────────────────────

function TokenTag({
  label,
  preview,
  onRemove,
}: {
  label:    string;
  preview:  string;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border
                 border-rose-500/35 bg-rose-500/10 text-rose-200/85 text-[11px]
                 font-medium leading-none whitespace-nowrap select-none group"
      title={`除外候補: ${preview}`}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="text-rose-400/50 hover:text-rose-300 transition ml-0.5 leading-none"
        aria-label={`${label}を削除`}
      >
        ×
      </button>
    </span>
  );
}
