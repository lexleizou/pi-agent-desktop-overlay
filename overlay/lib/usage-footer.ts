// Folder: lib/usage-footer.ts (fork-owned, new file)
// Pure formatting for the per-response usage footer, styled after the
// claude-mods statusline: "Tokens: 74.1M (in 1.7M / out 176.8K / cache 72.2M)
// | Cache Hit 98% | TPS: 56.9/s | Elapsed 3h49m | Cost: ~$3.88".

export interface UsageLike {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost?: { total: number };
}

export type CacheHitLevel = "good" | "fair" | "poor";

export interface UsageFooterModel {
  total: string;
  input: string;
  output: string;
  /** Present only when the response read or wrote prompt cache. */
  cache: string | null;
  cacheHit: { percent: number; level: CacheHitLevel } | null;
  tps: string | null;
  elapsed: string | null;
  cost: string | null;
}

/** 950 → "950", 176_800 → "176.8K", 74_100_000 → "74.1M". */
export function formatCompactTokens(n: number): string {
  const v = Math.max(0, n || 0);
  if (v >= 1_000_000) return `${trimZero((v / 1_000_000).toFixed(1))}M`;
  if (v >= 1000) return `${trimZero((v / 1000).toFixed(1))}K`;
  return String(Math.round(v));
}

/** 900 → "0.9s", 42_000 → "42s", 125_000 → "2m05s", 13_740_000 → "3h49m". */
export function formatElapsed(ms: number): string {
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)}s`;
  const total = Math.round(s);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  return `${m}m${String(total % 60).padStart(2, "0")}s`;
}

/** Same thresholds everywhere a cache hit rate is shown. */
export function cacheHitLevel(percent: number): CacheHitLevel {
  if (percent >= 80) return "good";
  if (percent >= 50) return "fair";
  return "poor";
}

function formatCost(total: number): string {
  // Sub-cent responses keep enough digits to stay non-zero.
  return `~$${total >= 0.01 ? total.toFixed(2) : total.toFixed(4)}`;
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function buildUsageFooter(usage: UsageLike, durationMs?: number): UsageFooterModel {
  const input = usage.input || 0;
  const output = usage.output || 0;
  const cacheRead = usage.cacheRead || 0;
  const cacheWrite = usage.cacheWrite || 0;
  const cached = cacheRead + cacheWrite;
  // Hit rate over every prompt-side token (input + cache writes + cache reads).
  const promptTokens = input + cached;
  const percent = cached > 0 && promptTokens > 0 ? Math.round((cacheRead / promptTokens) * 100) : null;

  let tps: string | null = null;
  if (output && durationMs && durationMs > 0) {
    const v = output / (durationMs / 1000);
    if (v > 0) tps = `${v.toFixed(1)}/s`;
  }

  return {
    total: formatCompactTokens(input + output + cached),
    input: formatCompactTokens(input),
    output: formatCompactTokens(output),
    cache: cached > 0 ? formatCompactTokens(cached) : null,
    cacheHit: percent === null ? null : { percent, level: cacheHitLevel(percent) },
    tps,
    elapsed: durationMs && durationMs > 0 ? formatElapsed(durationMs) : null,
    cost: usage.cost?.total ? formatCost(usage.cost.total) : null,
  };
}
