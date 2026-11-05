# Chapter Find and Replace — Design

- **Intent:** Add one MCP tool so an author using Claude can find and replace text in a specific novel workspace chapter.
- **Goals:** Support an existing saved chapter (identify by `novel_id` and `chapter_number`, replace its content, save it) and a new unsaved chapter (accept draft text, return transformed text without saving). Return a replacement count; an optional dry run can report the count without saving for persisted chapters.
- **Non-goals:** Search across multiple chapters, regex replacement, modifying chapter title or source content, or UI changes.
- **Approaches:** (1) One flexible tool with saved-chapter and draft-text modes—selected by the user, compact tool list but conditional inputs; (2) two focused tools—clearer per-tool inputs but more tools. Implement option 1.
- **Constraints:** Follow existing MCP input-schema conventions; verify ownership of novel/chapter; preserve chapter HTML formatting as far as practical; literal search, with explicit case-sensitivity behavior; no match should report zero replacements and not alter storage. Existing chapter writes are destructive and must be marked accordingly.
- **Builder calls:** Use a literal, global find string; replace all occurrences; default case-sensitive; never interpret the find value as a regex. Existing chapter mode reads current content and updates only `content`; draft mode returns updated text and never persists it. Reject ambiguous or conflicting mode inputs.
- **Approval gate:** No product code changes until the user approves this design.
