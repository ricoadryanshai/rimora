import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the production handler with mocked Supabase requests and React state.
const source = readFileSync(new URL("../src/pages/NovelWorkspace.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("NovelWorkspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "importChapterJob") {
    handler = node.initializer.getText(tree);
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(handler);
const code = ts.transpile(`const run = ${handler};`, { target: ts.ScriptTarget.ES2022 }) + "\nrun";

async function runImport(skipGlossaryExtraction, skipTranslation, failStage, stopStage, range) {
  const events = [];
  const saved = [];
  const itemStates = [];
  let displayed = [];
  let currentChapter;
  let progress = {};
  let finalJob;
  const controller = new AbortController();
  const client = {
    functions: {
      async invoke(name, { body }) {
        if (name === "ai-discover-chapter-links") {
          if (stopStage === "discovery") controller.abort();
          if (range) { assert.equal(body.chapterFrom, 81); assert.equal(body.chapterTo, 82); }
          return { data: { chapters: (range ? [83, 82, 81, 80] : stopStage ? [3, 2, 1] : [2, 1]).map((n) => ({ chapter_number: n, title: `Title ${n}`, url: `https://example.com/${n}` })) } };
        }
        if (name === "firecrawl-scrape") {
          assert.equal(body.cleanWithAi, false);
          currentChapter = Number(body.url.split("/").at(-1));
          if (currentChapter === 2 && !failStage) {
            assert.ok(saved.some((chapter) => chapter.chapter_number === 1));
            assert.ok(displayed.some((chapter) => chapter.chapter_number === 1));
          }
          events.push(`fetch:${currentChapter}`);
          if (stopStage === "scrape" && currentChapter === 2) controller.abort();
          return { data: { success: true, content: `Source ${currentChapter}` } };
        }
        if (name === "ai-chapter-import") {
          assert.equal(body.chapterFrom, currentChapter);
          assert.equal(body.chapterTo, currentChapter);
          assert.equal(body.url, `https://example.com/${currentChapter}`);
          events.push(`extract:${currentChapter}`);
          if (failStage === "chapter" && currentChapter === 1) return { data: { success: true, chapters: [{ chapter_number: 99, title: "Wrong chapter", content: "Wrong content" }] } };
          if (stopStage === "extract" && currentChapter === 2) controller.abort();
          return { data: { success: true, chapters: [{ chapter_number: currentChapter, title: `Title ${currentChapter}`, content: `Source ${currentChapter}` }] } };
        }
        assert.equal(body.originalLanguage, "Chinese");
        if (name === "ai-glossary-extract") {
          events.push(`glossary:${currentChapter}`);
          if (stopStage === "glossary" && currentChapter === 2) controller.abort();
          if (failStage === "glossary" && currentChapter === 1) return { data: { error: "Extraction failed" } };
          return { data: { entries: [{ original_word: "旧词", replacement_word: "Existing" }, { original_word: "新词", replacement_word: "New" }] } };
        }
        assert.equal(name, "ai-translate");
        events.push(`translate:${currentChapter}`);
        if (stopStage === "translation" && currentChapter === 2) controller.abort();
        if (failStage === "translation" && currentChapter === 1) return { error: { message: "Translation failed" } };
        return { data: { chapter: { title: `Translated ${currentChapter}`, content: [`Translation ${currentChapter}`] } } };
      },
    },
    from(table) {
      let operation, values;
      const filters = {};
      const builder = {
        insert(value) { operation = "insert"; values = value; return this; },
        update(value) { operation = "update"; values = value; return this; },
        upsert(value) { operation = "upsert"; values = value; return this; },
        select() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        in(key, value) { filters[key] = value; return this; },
        abortSignal(signal) { assert.equal(signal, controller.signal); return this; },
        single() { return this; },
        async then(resolve, reject) {
          try {
            if (table === "chapter_import_jobs") {
              if (["completed", "completed_with_errors", "cancelled"].includes(values.status)) finalJob = values;
              return resolve({ data: { id: "job" } });
            }
            if (table === "chapter_import_items") {
              if (operation === "update") itemStates.push({ ...values, chapter_number: filters.chapter_number });
              return resolve({});
            }
            if (table === "glossary_entries") {
              events.push(`term:${currentChapter}:${values.source_term}`);
              return resolve({ error: values.source_term === "旧词" ? { code: "23505" } : null });
            }
            assert.equal(table, "chapters");
            assert.equal(operation, "upsert");
            events.push(`save:${values.chapter_number}`);
            if (failStage === "save" && values.chapter_number === 1) return resolve({ error: { message: "Database unavailable" } });
            await Promise.resolve();
            saved.push(values);
            return resolve({ data: { ...values, id: `chapter-${values.chapter_number}`, deleted_at: null, updated_at: "now" } });
          } catch (error) { reject(error); }
        },
      };
      return builder;
    },
  };
  const context = vm.createContext({
    supabase: client, rimora: client,
    invokeAiFunction: (name, options, signal) => {
      assert.equal(signal, controller.signal);
      return client.functions.invoke(name, options);
    },
    importTask: { start: () => controller, finish() {} },
    aiImporting: false, novelId: "novel", user: { id: "owner" }, aiImportUrl: "https://example.com/novel",
    chapterRangeEnabled: Boolean(range), chapterFrom: range ? "81" : "", chapterTo: range ? "82" : "",
    novel: { original_language: "Chinese", language: "English", translation_language: "English" },
    skipGlossaryExtraction, skipTranslation,
    setAiImporting() {}, setAiImportOpen() {}, setActiveTab() {}, toast() {},
    setImportProgress(value) { progress = typeof value === "function" ? value(progress) : value; },
    setChapters(update) { displayed = update(displayed); events.push(`display:${displayed.at(-1).chapter_number}`); },
  });
  await vm.runInContext(code, context)();
  return { events, saved, displayed, itemStates, progress, finalJob };
}

for (const skipGlossary of [true, false]) {
  for (const skipTranslation of [true, false]) {
    test(`save before next chapter: skip glossary=${skipGlossary}, skip translation=${skipTranslation}`, async () => {
      const result = await runImport(skipGlossary, skipTranslation);
      const expected = [1, 2].flatMap((n) => [
        `fetch:${n}`, `extract:${n}`,
        ...(!skipGlossary ? [`glossary:${n}`, `term:${n}:旧词`, `term:${n}:新词`] : []),
        ...(!skipTranslation ? [`translate:${n}`] : []),
        `save:${n}`, `display:${n}`,
      ]);
      assert.deepEqual(result.events, expected);
      assert.equal(result.progress.completed, 2);
      assert.equal(result.progress.failed, 0);
      assert.equal(result.finalJob.status, "completed");
      for (const chapter of result.saved) {
        assert.equal(chapter.content, `${skipTranslation ? "Source" : "Translation"} ${chapter.chapter_number}`);
        assert.equal(chapter.source_content, `Source ${chapter.chapter_number}`);
        assert.equal(chapter.source_url, `https://example.com/${chapter.chapter_number}`);
      }
    });
  }
}

for (const stage of ["chapter", "glossary", "translation", "save"]) {
  test(`${stage} failure keeps the next chapter processing independently`, async () => {
    const result = await runImport(false, false, stage);
    assert.deepEqual(result.saved.map((chapter) => chapter.chapter_number), [2]);
    assert.equal(result.displayed.length, 1);
    assert.equal(result.progress.completed, 1);
    assert.equal(result.progress.failed, 1);
    assert.ok(result.itemStates.some((item) => item.chapter_number === 1 && item.status === "failed"));
    assert.equal(result.finalJob.status, "completed_with_errors");
  });
}

test("81–82 range creates exactly two raw-scrape/structure/save iterations", async () => {
  const result = await runImport(true, true, undefined, undefined, true);
  assert.deepEqual(result.events, ["fetch:81", "extract:81", "save:81", "display:81", "fetch:82", "extract:82", "save:82", "display:82"]);
  assert.equal(result.progress.total, 2);
  assert.deepEqual(result.saved.map((chapter) => chapter.chapter_number), [81, 82]);
});

test("index discovery resolves relative chapter links and removes duplicate or unsafe links", () => {
  const source = readFileSync(new URL("../supabase/functions/ai-discover-chapter-links/index.ts", import.meta.url), "utf8");
  const tree = ts.createSourceFile("discovery.ts", source, ts.ScriptTarget.Latest, true);
  let parser;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "parseLinks") parser = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const parse = vm.runInNewContext(ts.transpile(`const parse = ${parser};`, { target: ts.ScriptTarget.ES2022 }) + "\nparse", { URL });
  const links = parse(JSON.stringify([
    { chapter_number: 81, title: "Chapter 81", url: "/chapter/81" },
    { chapter_number: 81, title: "Duplicate", url: "/duplicate" },
    { chapter_number: 82, title: "Chapter 82", url: "82.htm" },
    { chapter_number: 83, title: "Unsafe", url: "javascript:alert(1)" },
  ]), "https://example.com/book/74678/");
  assert.equal(links.length, 2);
  assert.equal(links[0].url, "https://example.com/chapter/81");
  assert.equal(links[1].url, "https://example.com/book/74678/82.htm");
});

for (const stage of ["discovery", "scrape", "extract", "glossary", "translation"]) {
  test(`Stop during ${stage} exits the queue and preserves committed chapters`, async () => {
    const result = await runImport(false, false, undefined, stage);
    assert.deepEqual(result.saved.map((chapter) => chapter.chapter_number), stage === "discovery" ? [] : [1]);
    assert.equal(result.finalJob.status, "cancelled");
    assert.equal(result.finalJob.failed_chapters, 0);
    assert.equal(result.finalJob.completed_chapters, stage === "discovery" ? 0 : 1);
    assert.ok(!result.events.includes("save:2"));
    assert.ok(!result.events.includes("fetch:3"));
    assert.ok(result.itemStates.some((item) => item.status === "skipped"));
  });
}
