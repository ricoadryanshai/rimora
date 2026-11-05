# Chapter Find and Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one MCP tool that applies literal find-and-replace to a specified saved chapter or returns transformed unsaved draft text.

**Architecture:** Add the tool to the existing Rimora MCP server and reuse its validation, ownership, chapter-loading, and persistence helpers. The tool will select exactly one mode: saved chapter (`novel_id` + `chapter_number`) or unsaved text (`text`); it will replace all literal matches case-sensitively, with an optional dry-run for saved chapters.

**Tech Stack:** TypeScript, Deno Supabase Edge Function, Supabase database.

**Spec:** `docs/superpowers/specs/2026-11-05-chapter-find-replace-design.md`

## Global Constraints

- Use a literal, global find string; replace all occurrences; default case-sensitive; never interpret the find value as a regex.
- Existing chapter mode reads current content and updates only `content`; draft mode returns updated text and never persists it.
- Reject ambiguous or conflicting mode inputs.
- Existing chapter writes are destructive and must be marked accordingly.

## Review Focus

- Empty find string must be rejected to prevent an unbounded insertion/replacement operation; test that validation errors before any write.
- A find string with regex metacharacters must be treated literally; test input `a.b` matches only the exact substring `a.b`.
- Case differences must not match; test `Fox` against `fox` produces zero replacements.
- Draft mode must not persist, and saved mode must not modify `source_content`; test both storage invariants.
- A chapter number that does not exist or belongs to a different user's novel must fail without writing; test ownership/not-found behavior.

---

### Task 1: Add the `find_replace_chapter` MCP tool

**Files:**
- Modify: `supabase/functions/mcp/index.ts` (tool definitions near `apply_glossary`)
- Test: existing MCP Edge Function test location, if present; otherwise add focused tests for the pure replacement helper under `supabase/functions/mcp/`

**Interfaces:**
- Consumes: existing `schema`, `str`, `uuid`, `int`, `loadChapter`, `assertOwnsNovel`, `upsertChapter` helpers.
- Produces: MCP tool `find_replace_chapter` with inputs `novel_id`, `chapter_number`, `text`, `find`, `replace`, and `dry_run`; saved mode requires `novel_id` and `chapter_number` and omits `text`; draft mode requires `text` and omits `novel_id`/`chapter_number`; both require `find` and `replace`. Result includes `replacements` and either updated `text` (draft mode) or `saved` (saved mode).

- [ ] **Step 1: Write failing tests**

Test the pure replacement behavior for replacing all exact literal occurrences, case sensitivity, regex metacharacters, empty find rejection, and zero matches. Test mode validation to reject neither-mode and conflicting-mode inputs. Test draft mode returns transformed text without persistence and saved mode only updates `content`, respecting `dry_run`.

- [ ] **Step 2: Run focused tests and verify they fail**

Run the repository's configured Deno test command for the MCP function or the specific test file. Expected: FAIL because the new tool/helper does not exist yet.

- [ ] **Step 3: Implement the tool and minimal helper**

Add a small pure literal-replacement helper in the MCP module (or its focused helper module if tests establish that structure). Reject empty `find`; use string splitting/joining or equivalent literal-safe logic, not `RegExp`. Define mutually exclusive saved and draft modes. Draft mode transforms supplied text and returns it without database calls. Saved mode verifies ownership, loads chapter, transforms `content`, and updates only `content`; return replacement count and saved status. For `dry_run: true`, return the count without writing. Mark the tool destructive because saved mode can alter a chapter.

- [ ] **Step 4: Run focused tests and verify they pass**

Run the same focused Deno test command. Expected: PASS, covering both modes, safety validation, dry run, and storage invariants.

- [ ] **Step 5: Run the repository's relevant checks**

Run available Deno type-check/lint/test commands for `supabase/functions/mcp`. Expected: no new diagnostics or failing tests.
