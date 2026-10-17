import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  OUTPUT_LANGUAGE_MARKER,
  normalizeOutputLanguage,
  outputLanguageDirective,
} = await jiti.import("./output-language.ts");
const { createOutputLanguageExtension } = await jiti.import("./output-language-extension.ts");

/** Run the extension's before_agent_start handler over a fake prompt. */
function runHook(language, systemPrompt = "BASE PROMPT") {
  const handlers = new Map();
  const extension = createOutputLanguageExtension(() => language);
  extension.factory({ on: (event, handler) => { handlers.set(event, handler); return () => {}; } });
  const handler = handlers.get("before_agent_start");
  assert.ok(handler, "the extension must register a before_agent_start handler");
  return handler({ type: "before_agent_start", systemPrompt, systemPromptOptions: {} });
}

test("normalizes unknown values to auto", () => {
  assert.equal(normalizeOutputLanguage("zh-CN"), "zh-CN");
  assert.equal(normalizeOutputLanguage("en"), "en");
  assert.equal(normalizeOutputLanguage("auto"), "auto");
  // Anything else — a missing field, a stale value, a hostile payload — must
  // leave the model's own behaviour alone rather than guess a language.
  assert.equal(normalizeOutputLanguage(undefined), "auto");
  assert.equal(normalizeOutputLanguage(null), "auto");
  assert.equal(normalizeOutputLanguage(""), "auto");
  assert.equal(normalizeOutputLanguage("zh"), "auto");
  assert.equal(normalizeOutputLanguage(7), "auto");
});

test("only the forced modes produce a directive", () => {
  assert.equal(outputLanguageDirective("auto"), null);
  assert.match(outputLanguageDirective("zh-CN"), /简体中文/);
  assert.match(outputLanguageDirective("zh-CN"), new RegExp(OUTPUT_LANGUAGE_MARKER));
  assert.match(outputLanguageDirective("en"), /English/);
});

test("appends the directive without touching the rest of the prompt", () => {
  const result = runHook("zh-CN");
  assert.equal(typeof result?.systemPrompt, "string");
  // The original prompt stays at the head, verbatim.
  assert.ok(result.systemPrompt.startsWith("BASE PROMPT\n\n"));
  assert.match(result.systemPrompt, /简体中文/);
});

test("auto leaves the system prompt untouched", () => {
  assert.equal(runHook("auto"), undefined);
});

test("switching the language applies on the next run", () => {
  let language = "auto";
  const handlers = new Map();
  const extension = createOutputLanguageExtension(() => language);
  extension.factory({ on: (event, handler) => { handlers.set(event, handler); return () => {}; } });
  const handler = handlers.get("before_agent_start");
  const event = { type: "before_agent_start", systemPrompt: "BASE", systemPromptOptions: {} };

  assert.equal(handler(event), undefined);
  language = "en";
  assert.match(handler(event).systemPrompt, /English/);
  language = "zh-CN";
  assert.match(handler(event).systemPrompt, /简体中文/);
});

test("never appends twice when the prompt already carries the directive", () => {
  const already = `BASE\n\n${outputLanguageDirective("zh-CN")}`;
  assert.equal(runHook("zh-CN", already), undefined);
});
