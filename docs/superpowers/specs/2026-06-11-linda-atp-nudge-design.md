# Linda — the ATP nudge

**Date:** 2026-06-11
**Status:** Design approved, pending implementation plan

## Problem

Students write essays in `/eseje`. Each essay should be written in the **ATP form**
(*aplikovat teorii v praxi* — apply theory in practice): it must reflect how the
student converted, or could convert, the knowledge they gained into real practice.
Quality of reflection on the ideas, tools, and insights is what matters — not
re-summarizing the book's content. An essay missing ATP can be returned for rework
or have its points withheld by a coach.

Each coach has ~16 students writing ~20 essays/year ≈ **320 essays/coach/year**,
which is effectively impossible to read carefully. Many of those essays are pure
summaries with no ATP and could be caught and bounced back to the student *before*
a coach ever spends time on them.

## Solution overview

**Linda** is an automated reviewer with a friendly, by-students-for-students
persona. She reads every newly published essay. If the essay lacks ATP, she posts
**one** comment — an open, essay-specific question in Gen-Z Czech — nudging the
student to add their real-life application. If the essay has ATP, she stays silent.

Linda being automated is an **open secret**: it is commonly known she's AI, but
the app shows **no "AI" label** anywhere. She simply acts as Linda.

## Behavior

### Identity
- Linda is a real `profiles` row (special account, fixed avatar, name "Linda").
- Her comments use the existing `essay_comments` table with
  `author_profile_id = Linda`, so they render in the normal comment thread with no
  new comment UI.
- No "AI" badge or label is shown to users.
- The app must be able to *identify* Linda's comments (to dedupe, resolve, and
  drive the coach signal) — via a flag on the comment and/or a marker on her
  profile. Not used for display labeling.

### Trigger flow
- On **publish** of a new essay: the publish API returns immediately; Linda's
  evaluation runs in a **background task** (`after()` / fire-and-forget). Her
  comment appears a moment later. Publishing never blocks on AI.
- On **edit**: Linda re-evaluates **only if she currently has an open
  (unresolved) nudge** on that essay. A clean essay is never re-checked or
  re-pestered.
- **One open nudge per essay, maximum.**
- Applies to essays **created from launch onward only** — no backfill of existing
  essays.
- **No minimum length guard** — every published essay is judged regardless of
  length.

### The judgment
- A single Gemini call per evaluation.
- **Input:** essay text, plus book title/author for context, plus the ATP rubric
  (the Czech spec above) embedded in the prompt.
- **Output (structured):** `{ has_atp: boolean, nudge_text: string | null }`.
- `has_atp = true` → do nothing.
- `has_atp = false` → insert Linda's comment with `nudge_text`.

### Nudge content
- An **essay-specific open question** that references the actual idea the student
  wrote about and asks how *that concept* applies to their life/work.
- Written in **Czech**, **medium Gen-Z energy**, playful but respectful.
- **No swear words**, ever.

### Re-check / resolution
- Edit while an open nudge exists → re-evaluate.
- Now has ATP → Linda **edits her existing comment** into a short celebratory
  close (e.g. "ayy, teď to dává smysl 🙌") and marks the nudge **resolved**.
- Still missing ATP → leave the original nudge unchanged (no pile-on).

### Coach signal
- Essays with an **open** Linda nudge carry a visible indicator (badge/icon) on
  essay cards and, especially, the `ke-kontrole` review queue — so coaches
  instantly see "this essay has an unresolved ATP flag."
- Driven by a per-essay derived value, e.g. `has_open_linda_nudge`, computed from
  Linda's comment + its `open`/`resolved` status.

## Configuration

The persona description, tone rules (incl. the no-swearing constraint), and the
ATP rubric live in **editable config** (a constants file or a small DB-backed
prompt), so slang/strictness can be tuned without a code change.

## Guardrails

- Gemini failure or timeout → **fail silent**: no comment, log the error.
  Publishing/editing never breaks.
- Model: **Gemini Flash (latest), configurable**. Exact model ID and SDK to be
  confirmed against current Google documentation at planning time. No AI
  infrastructure exists yet (note: existing `ai_book_points` / `ai_reason` are a
  separate, books-only feature) — this is greenfield.

## Data model implications (to detail in the plan)

- Linda `profiles` row.
- A way to mark a comment as Linda's and track its `open` / `resolved` status
  (e.g. columns on `essay_comments` such as `is_linda_nudge` and `nudge_status`,
  or equivalent).
- A per-essay `has_open_linda_nudge` signal for the coach indicator (column,
  view, or query-time computation).

## Out of scope

- Backfilling Linda's review onto pre-launch essays.
- Any coach-facing AI triage *scoring* beyond the open/resolved nudge signal.
- Minimum-length filtering.
- Showing Linda as anything other than "Linda" (no AI labels/badges).
