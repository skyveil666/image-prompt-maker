---
name: progress-checkpoint
description: This skill should be used at the end of a shipped and committed change, or when
  the user asks to "記録して", "ここまでをメモして", "続きが分かるようにして", or a session is
  about to be compacted or ended. Appends a new dated, numbered entry to this project's running
  status log in the assistant's own auto-memory (current-priority.md), updates the one-line
  index pointer in MEMORY.md, and flags when the log has grown too large to read in one pass so
  a memory-consolidation pass should be considered.
---

Record "how far we got and what's next" so a future session (possibly a fresh one, possibly
after a context compaction) can pick up without re-deriving context from scratch. This is the
persistent-memory equivalent of a commit message — write it every time a unit of work actually
lands, not only when explicitly asked.

## When to run this

- Right after a change from `implement-feature` is committed (and pushed, if applicable).
- Right after a `stage0-investigate` or `inventory-audit` pass that produced a decision or a
  clear next step, even if nothing was committed.
- When the user explicitly asks for a record of progress.
- Before a natural session boundary, if a meaningful amount of undocumented work happened.

Do not run this for every trivial step — the point is one entry per coherent unit of work
(roughly: one commit, or one investigation that changed the plan), not a line per tool call.

## Where it lives

This project keeps its running status log in the assistant's own auto-memory system, in a file
named `current-priority.md`, indexed from `MEMORY.md`. Locate these the same way the assistant's
own system prompt already describes finding its memory directory for this project — do not
hardcode a path; read the existing files to find the current location and format instead of
assuming.

## Procedure

1. **Read the latest entry**, not the whole file. `current-priority.md` in this project stores
   entries newest-first, each one titled `【続N：タイトル (YYYY-MM-DD)】`, ordered so the most
   recent is right after the YAML frontmatter. Read roughly the first 80-120 lines to see the
   latest entry and confirm the current numbering (N) and format — do not assume the number from
   memory, the file may have moved on since. If the file is too large to read a useful window
   (check size/line count first), read only the frontmatter plus enough of the top to find the
   latest `【続N…】` header.
2. **Compose the new entry** as `【続N+1：短いタイトル (今日の日付)】`, following the existing
   entries' shape:
   - develop/origin の同期状態とコミットハッシュ（例："develop=origin/develop=hash（push済・
     同期）。前hash..今hash・コミット数・変更ファイル。"）。
   - What was asked (in the requester's own words, briefly).
   - What was investigated/decided, if anything (including any correction of a previous
     entry's claim that turned out to be too optimistic or wrong — do not silently drop a past
     misstatement, note the correction explicitly).
   - What was implemented, with file:line references.
   - How it was verified (type-check/build/test results, live-preview checks actually
     performed).
   - What remains open / next candidates, and who they're waiting on (owner decision, further
     investigation, etc).
   - `直前=続N(...)`  linking back to the previous entry.
3. **Insert the new entry** right after the frontmatter, before the previous latest entry (i.e.
   at the top of the body, newest-first) — do not append at the end of a 1000+ line file, and do
   not rewrite or delete older entries.
4. **Update the frontmatter**: bump the `続N` reference in the `description` field and the
   `modified` timestamp to today's date (use the actual current date available in context —
   never fabricate a timestamp's time-of-day precision that wasn't actually observed).
5. **Update `MEMORY.md`'s one-line index entry** for this file so it points at the new latest
   summary (title, date, commit hash, one-line "残=..." of open items). Keep this to roughly the
   same length as the entry it replaces — do not let the index line itself balloon; the detail
   belongs in `current-priority.md`, not in the index.

## Size discipline

This log accumulates indefinitely and is allowed to grow large (it is the project's full
history, and past entries are not deleted). But if `current-priority.md` has grown large enough
that even locating the latest entry requires reading a large fraction of the file, or the
`MEMORY.md` index line for it has itself grown past a few hundred characters, say so explicitly
in the checkpoint report and suggest running a memory-consolidation pass (the
`anthropic-skills:consolidate-memory` skill, if available) rather than trying to prune or
restructure the history unilaterally — restructuring long-lived project memory is a bigger
decision than a routine checkpoint should make on its own.

## What not to do

- Do not use this skill to make implementation decisions — it only records what already
  happened and what's already been decided as next.
- Do not silently rewrite or shorten older entries to save space; only add.
- Do not fabricate specifics (commit hashes, line numbers, dates) — read them from the actual
  git state and files at record time.
