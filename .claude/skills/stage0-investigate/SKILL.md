---
name: stage0-investigate
description: This skill should be used when the user asks for a read-only, no-changes
  investigation before any fix — messages tagged "【Stage 0 調査指示｜...】", or phrases like
  "調べて（直さないで）", "read-only で", "何も壊さず調べて", "現状を報告して", "原因を
  特定して". Also use proactively before implementing any non-trivial fix whose root cause is
  not yet confirmed. Produces a findings report and a proposed fix, but makes zero code changes
  and creates no commits.
---

Investigate first, propose second, never implement in the same pass. This skill exists because
this project's whole operating model depends on the investigate step being genuinely read-only —
the owner (or a later implement-feature pass) needs a trustworthy, unbiased picture of what is
actually happening before anything gets changed.

## Scope discipline

Touch nothing. Use Read, Grep, Glob, and Bash only for inspection (`git log`, `git diff`,
`git status`, `git show`, running a script through `tsx`/`node` to print real output — never to
mutate files). Do not run Edit or Write. Do not create, delete, or move files. Do not commit.

If the investigation naturally surfaces a fix, describe it as a **proposal** in the report,
clearly separated from the findings — do not act on it. That is the next skill's job
(`implement-feature`), gated on approval.

## Root-cause discipline

Do not report a symptom and call it a finding. Trace to the actual mechanism:

1. Read the exact error/symptom as reported — do not paraphrase away specifics.
2. Reproduce or trace the code path that produces it (grep the relevant handlers, read the
   full function, not just the line that looks suspicious).
3. Check what changed recently that could explain it (`git log -p` on the suspect file, recent
   commits touching the relevant area).
4. Form a single hypothesis for the root cause. If more than one hypothesis remains plausible,
   say so explicitly in the report rather than picking one to sound decisive — the point of
   Stage 0 is to hand off a confirmed mechanism, not a guess.
5. When the mechanism is genuinely ambiguous even after tracing, state that plainly instead of
   filling the gap with speculation.

## Untouchable-area awareness (read is fine, don't propose auto-fixing these)

While investigating, note but do not treat as routine any finding whose root cause lives in:
`server/src/promptSystem.ts`, `server/src/scopeFilter.ts`, `server/src/gemini.ts`,
`src/lib/preferenceProfile.ts` / `skyveilProfile.ts` / `skyveilScore.ts` / `favoriteProfile.ts` /
`ratingAnalyzer.ts` / `colorAnalyzer.ts` / `historyAnalyzer.ts` / `imageAnalyzer.ts` /
`biasAnalyzer.ts`, `src/lib/cleanup.ts`, `src/lib/idb.ts`, `src/lib/backup.ts`,
`src/lib/history.ts`, or any §3 destructive data operation
(`indexedDB.deleteDatabase()`/`localStorage.clear()`/`store.clear()`/store deletion/
`DB_VERSION` change). Reading these to understand a bug is normal and encouraged. Flag any
finding that lands here as needing an explicit go-ahead later — never fold it into a "routine,
auto-apply" recommendation.

## Report structure

Lead with the conclusion, not the process. Structure:

- **What was asked** (one line, in the requester's own words).
- **Findings**, lettered (A, B, C…) when there are several, each with: root cause (not just
  symptom), affected file(s) with line numbers, severity if this is a bug hunt, and whether it's
  new/known/already-reported (check `docs/19_bugfixes.md` and recent `current-priority.md`
  entries before calling something new).
- **Proposal**: the smallest fix that addresses the root cause — described technically here
  (this report's audience is the developer driving the session, not the owner). Do not implement
  it.
- **Open questions**, if any remain — phrase these as genuine technical questions when reporting
  to a developer. If this report's final destination is the owner directly (no developer
  intermediary in the loop), translate any decision point into one of the three owner-facing
  formats instead (see `implement-feature`'s vocabulary table) — but the investigation body
  itself can and should stay precise and technical; only the final ask gets translated.
- Explicitly state: **no files were changed, nothing was committed**.

## Verifying claims about running state

When a finding depends on runtime behavior (not just static code reading), verify it live rather
than asserting from code alone — e.g. run `buildSystemPrompt()` through `tsx` with a constructed
minimal input to see the actual generated text, or use an isolated Playwright preview
(`npx vite preview --port 4330 --strictPort`, never the real dev origin on 5173/3001) to check
actual UI/state behavior. Delete any temporary verification script after use. A claim like
"X always happens" should be backed by having actually seen X happen, not inferred from reading
the code that seems like it should produce X.

## Handing off

End every Stage 0 report by naming the next step explicitly: either "this needs
`implement-feature` once approved" or "this is dormant/needs owner judgment, see
`inventory-audit`'s classification" — so the read-only boundary of this skill is never
ambiguous to whoever reads the report next.
