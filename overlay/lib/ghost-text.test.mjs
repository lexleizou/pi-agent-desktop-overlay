import assert from "node:assert/strict";
import { test } from "node:test";

// Loaded through Node's native type stripping, matching the repo's lib test pattern.
const { computeGhostText, applyGhostCompletion, Debouncer } = await import("./ghost-text.ts");

const HISTORY = [
  "把方案写成文档",
  "run the tests now",
  "总结这次会话的结论",
  "check the deploy status",
];

test("completes the newest matching history entry after the typed prefix", () => {
  const result = computeGhostText("run the te", 10, HISTORY);
  assert.equal(result.completion, "sts now");
  assert.equal(result.source, "run the tests now");
});

test("prefers the most recent entry when several match", () => {
  const history = ["check status", "check the deploy status"];
  const result = computeGhostText("check ", 6, history);
  assert.equal(result.source, "check the deploy status");
});

test("is case-insensitive on the match and keeps the historical casing", () => {
  const result = computeGhostText("RUN THE T", 9, HISTORY);
  assert.equal(result.completion, "ests now");
});

test("completes CJK history entries", () => {
  const result = computeGhostText("把方案写", 4, HISTORY);
  assert.equal(result.completion, "成文档");
});

test("does not complete below the minimum query length", () => {
  assert.equal(computeGhostText("ru", 2, HISTORY).completion, "");
});

test("does not complete when the caret is not at the end", () => {
  const result = computeGhostText("run the tests now", 7, HISTORY);
  assert.equal(result.completion, "");
});

test("does not complete when there is nothing to add", () => {
  assert.equal(computeGhostText("run the tests now", 17, HISTORY).completion, "");
});

test("completes only the first line of a multi-line history entry", () => {
  const history = ["run the tests now\nthen review the diff"];
  const result = computeGhostText("run the te", 10, history);
  assert.equal(result.completion, "sts now");
});

test("skips single-repeated-character completions", () => {
  const history = ["---------"];
  const result = computeGhostText("---", 3, history);
  assert.equal(result.completion, "");
});

test("applyGhostCompletion appends at the caret and moves it", () => {
  const { value, caret } = applyGhostCompletion("run the te", 10, "sts now");
  assert.equal(value, "run the tests now");
  assert.equal(caret, 17);
});

test("Debouncer fires once after the quiet period and cancels cleanly", async () => {
  const debouncer = new Debouncer(20);
  let runs = 0;
  debouncer.schedule(() => { runs += 1; });
  debouncer.schedule(() => { runs += 10; });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(runs, 10);
  debouncer.schedule(() => { runs += 100; });
  debouncer.cancel();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(runs, 10);
});
