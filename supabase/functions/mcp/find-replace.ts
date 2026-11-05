export function replaceLiteral(text: string, find: string, replacement: string) {
  if (!find) throw new Error("find must not be empty");
  const parts = text.split(find);
  return { text: parts.join(replacement), replacements: parts.length - 1 };
}

export function validateReplacement(value: unknown): string {
  if (typeof value !== "string") throw new Error("replace must be a string");
  return value;
}

export function findReplaceMode(args: {
  novel_id?: unknown;
  chapter_number?: unknown;
  text?: unknown;
}) {
  const hasNovelId = args.novel_id !== undefined && args.novel_id !== null;
  const hasChapterNumber = args.chapter_number !== undefined && args.chapter_number !== null;
  const hasText = args.text !== undefined && args.text !== null;
  if (hasText && !hasNovelId && !hasChapterNumber) return "draft" as const;
  if (!hasText && hasNovelId && hasChapterNumber) return "saved" as const;
  throw new Error("Provide text for draft mode, or novel_id and chapter_number for saved mode, but not both");
}
