import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compile = (source) => ts.transpile(source, { target: ts.ScriptTarget.ES2022 });
const withoutImports = (source) => source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/export /g, "");
function handler(path, name) {
  const source = read(path);
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(expression);
  return compile(`const run = ${expression};`) + "\nrun";
}
function task() {
  let controller;
  return { start() { controller = new AbortController(); return controller; }, stop() { controller.abort(); }, finish() {} };
}
function deferred() {
  let resolve;
  const promise = new Promise((value) => { resolve = value; });
  return { promise, resolve };
}

test("Stop aborts immediately; old completions cannot clear a restarted task", () => {
  let running, cleanup;
  const context = vm.createContext({ AbortController, useRef: () => ({ current: null }), useState: () => [false, (value) => { running = value; }], useEffect: (effect) => { cleanup = effect(); } });
  const active = vm.runInContext(compile(withoutImports(read("src/hooks/use-ai-task.ts"))) + "\nuseAiTask()", context);
  const first = active.start();
  assert.equal(running, true);
  active.stop();
  assert.equal(first.signal.aborted, true);
  assert.equal(running, false);
  const next = active.start();
  active.finish(first);
  assert.equal(running, true);
  cleanup();
  assert.equal(next.signal.aborted, true);
});

test("authenticated AI HTTP request receives AbortSignal and rejects late responses", async () => {
  const controller = new AbortController();
  const result = deferred();
  let fetchSignal;
  const context = vm.createContext({
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } }, error: null }) } },
    SUPABASE_URL: "https://example.invalid", SUPABASE_PUBLISHABLE_KEY: "public-key",
    fetch: async (_url, options) => { fetchSignal = options.signal; return result.promise; },
  });
  const invoke = vm.runInContext(compile(withoutImports(read("src/lib/ai-request.ts"))) + "\ninvokeAiFunction", context);
  const pending = invoke("ai-translate", { body: {} }, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchSignal, controller.signal);
  controller.abort();
  result.resolve({ ok: true, json: async () => ({ chapter: "late result" }) });
  await assert.rejects(pending, { name: "AbortError" });
});

for (const name of ["translateChapter", "extractGlossaryWithAi"]) {
  test(`${name}: cancelled results never update the editor or glossary`, async () => {
    const request = deferred();
    const active = task();
    let applied = 0;
    const changed = () => { applied++; };
    const context = vm.createContext({
      hasRichText: () => true, content: "Original", contentText: "Original", title: "Title", chapterNumber: 80, authorThoughts: "",
      originalLanguage: "Chinese", translationLanguage: "English", novelType: "Translation",
      translating: false, glossaryAiLoading: false, translationTask: active, glossaryTask: active,
      invokeAiFunction: () => request.promise, mergeGlossaryEntries: changed,
      setContent: changed, setTitle: changed, setAuthorThoughts: changed, setTranslateOpen: changed, toast: changed,
    });
    const pending = vm.runInContext(handler("src/pages/Workbook.tsx", name), context)();
    active.stop();
    request.resolve({ error: null, data: { entries: [{ original_word: "词语", replacement_word: "Term" }], chapter: { chapterNumber: 80, title: "New", content: ["New"], authorThoughts: "" } } });
    await pending;
    assert.equal(applied, 0);
  });
}

for (const stage of ["scrape", "cleanup"]) {
  test(`URL extraction Stop during ${stage} prevents editor changes and later requests`, async () => {
    const request = deferred();
    const active = task();
    let applied = 0, calls = 0;
    const changed = () => { applied++; };
    const context = vm.createContext({
      isLoading: false, isOnline: true, url: "https://example.invalid/chapter", cleanWithAi: true, extractionTask: active,
      invokeAiFunction: async () => {
        calls++;
        if (stage === "cleanup" && calls === 1) return { error: null, data: { success: true, content: "Original" } };
        return request.promise;
      },
      onContentReady: changed, onTitleReady: changed, onChapterNumberReady: changed, toast: changed,
      setUrl: changed, setExtractedContent: changed, setPageTitle: changed, setStep: changed,
    });
    const pending = vm.runInContext(handler("src/components/UrlImport.tsx", "handleFetch"), context)();
    await new Promise((resolve) => setImmediate(resolve));
    active.stop();
    request.resolve({ error: null, data: { success: true, content: "Late content", chapters: [{ content: "Late cleanup" }] } });
    await pending;
    assert.equal(applied, 0);
    // Stop after scrape must never start cleanup.
    assert.equal(calls, stage === "scrape" ? 1 : 2);
  });
}

test("Edge Function disconnect aborts upstream requests, including an already cancelled request", () => {
  const context = vm.createContext({ AbortController, DOMException, setTimeout, clearTimeout });
  const createAbort = vm.runInContext(compile(withoutImports(read("supabase/functions/_shared/request-abort.ts"))) + "\ncreateRequestAbort", context);
  const client = new AbortController();
  const operation = createAbort({ signal: client.signal }, 1000);
  assert.equal(operation.controller.signal.aborted, false);
  client.abort();
  assert.equal(operation.controller.signal.aborted, true);
  operation.dispose();
  const alreadyCancelled = createAbort({ signal: client.signal }, 1000);
  assert.equal(alreadyCancelled.controller.signal.aborted, true);
  alreadyCancelled.dispose();
});
