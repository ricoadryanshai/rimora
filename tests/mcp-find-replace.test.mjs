import assert from "node:assert/strict";
import test from "node:test";
import { findReplaceMode, replaceLiteral, validateReplacement } from "../supabase/functions/mcp/find-replace.ts";

test("replaces every exact occurrence literally", () => {
  assert.deepEqual(replaceLiteral("a.b a.b axb", "a.b", "x"), { text: "x x axb", replacements: 2 });
});

test("replacement is case-sensitive", () => {
  assert.deepEqual(replaceLiteral("fox Fox", "Fox", "cat"), { text: "fox cat", replacements: 1 });
});

test("rejects an empty find string", () => {
  assert.throws(() => replaceLiteral("abc", "", "x"), /find must not be empty/i);
});

test("returns zero replacements and original text when not found", () => {
  assert.deepEqual(replaceLiteral("fox", "wolf", "cat"), { text: "fox", replacements: 0 });
});

test("selects draft mode when only draft text is supplied", () => {
  assert.equal(findReplaceMode({ text: "draft" }), "draft");
});

test("selects saved mode when novel and chapter identifiers are supplied", () => {
  assert.equal(findReplaceMode({ novel_id: "novel", chapter_number: 1 }), "saved");
});

test("rejects missing mode and conflicting mode inputs", () => {
  assert.throws(() => findReplaceMode({}), /provide text/i);
  assert.throws(() => findReplaceMode({ novel_id: "novel", chapter_number: 1, text: "draft" }), /provide text/i);
  assert.throws(() => findReplaceMode({ novel_id: "novel" }), /provide text/i);
});

test("allows an empty replacement string", () => {
  assert.equal(validateReplacement(""), "");
});

test("rejects a non-string replacement", () => {
  assert.throws(() => validateReplacement(42), /replace must be a string/i);
});
