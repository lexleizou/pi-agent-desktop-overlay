import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { buildUsageFooter, cacheHitLevel, formatCompactTokens, formatElapsed } = await jiti.import("./usage-footer.ts");

test("formatCompactTokens uses K/M units like the claude-mods statusline", () => {
  assert.equal(formatCompactTokens(950), "950");
  assert.equal(formatCompactTokens(1000), "1K");
  assert.equal(formatCompactTokens(176_800), "176.8K");
  assert.equal(formatCompactTokens(1_700_000), "1.7M");
  assert.equal(formatCompactTokens(74_100_000), "74.1M");
});

test("formatElapsed picks seconds, minutes or hours", () => {
  assert.equal(formatElapsed(900), "0.9s");
  assert.equal(formatElapsed(42_000), "42s");
  assert.equal(formatElapsed(125_000), "2m05s");
  assert.equal(formatElapsed(13_740_000), "3h49m");
});

test("cacheHitLevel thresholds", () => {
  assert.equal(cacheHitLevel(98), "good");
  assert.equal(cacheHitLevel(80), "good");
  assert.equal(cacheHitLevel(65), "fair");
  assert.equal(cacheHitLevel(10), "poor");
});

test("buildUsageFooter reproduces the screenshot line", () => {
  const m = buildUsageFooter(
    { input: 1_700_000, output: 176_800, cacheRead: 72_200_000, cacheWrite: 0, cost: { total: 3.88 } },
    13_740_000,
  );
  assert.equal(m.total, "74.1M");
  assert.equal(m.input, "1.7M");
  assert.equal(m.output, "176.8K");
  assert.equal(m.cache, "72.2M");
  assert.deepEqual(m.cacheHit, { percent: 98, level: "good" });
  assert.equal(m.elapsed, "3h49m");
  assert.equal(m.cost, "~$3.88");
});

test("buildUsageFooter omits cache, TPS, elapsed and cost when absent", () => {
  const m = buildUsageFooter({ input: 120, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } });
  assert.equal(m.total, "120");
  assert.equal(m.cache, null);
  assert.equal(m.cacheHit, null);
  assert.equal(m.tps, null);
  assert.equal(m.elapsed, null);
  assert.equal(m.cost, null);
});

test("buildUsageFooter keeps sub-cent costs non-zero and reports TPS", () => {
  const m = buildUsageFooter({ input: 10, output: 500, cacheRead: 0, cacheWrite: 90, cost: { total: 0.0012 } }, 10_000);
  assert.equal(m.cost, "~$0.0012");
  assert.equal(m.tps, "50.0/s");
  assert.deepEqual(m.cacheHit, { percent: 0, level: "poor" });
});
