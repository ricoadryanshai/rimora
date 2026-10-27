const hasHtmlTags = (value: string) => /<\/?[a-z][^>]*>/i.test(value);

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Stored chapters use HTML with `<br>` line breaks (what the editor produces).
 * Convert plain text with newlines into that format; leave existing HTML untouched.
 */
export const plainTextToChapterHtml = (value: string, knownPlain = false) =>
  !knownPlain && hasHtmlTags(value)
    ? value
    : value
        .split(/\r?\n/)
        .map((line) => escapeHtml(line))
        .join("<br>");
