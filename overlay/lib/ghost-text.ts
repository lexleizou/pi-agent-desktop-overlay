/**
 * Ghost text — inline composer prediction for pi-agent-desktop (phase 2).
 *
 * Folder: lib/ghost-text.ts (new file — no upstream file touched)
 *
 * Pure functions + a debounce clock for the inline completion overlay.
 * Data source: the session's input history (last 50 user prompts, provided
 * by ChatWindow), matched by prefix — zero model calls, zero latency risk.
 * The suggestions path (phase 1) covers "what to do next"; ghost text covers
 * "how to retype what I typed before".
 */

export interface GhostTextState {
  /** Completion text shown inline after the cursor. Empty string = hidden. */
  completion: string;
  /** The full historical line the completion came from (for dedupe/debug). */
  source?: string;
}

const MIN_QUERY_LENGTH = 3;
const MIN_COMPLETION_LENGTH = 2;

/**
 * Match the current typed query against the input history. Prefers the most
 * recent entry (history is oldest → newest, so scan backwards). Completion is
 * the remainder of the historical line after the matched prefix. Case- and
 * whitespace-insensitive on the match, preserving the historical casing in
 * the completion.
 */
export function computeGhostText(
  value: string,
  caret: number,
  inputHistory: string[],
): GhostTextState {
  const query = value.slice(0, caret);
  // Only complete at the end of the input, on the final line, and not in the
  // middle of a slash/@/# menu query — those have their own completion UIs.
  if (caret !== value.length) return { completion: "" };
  const lineStart = query.lastIndexOf("\n");
  const line = lineStart === -1 ? query : query.slice(lineStart + 1);
  if (line.length < MIN_QUERY_LENGTH) return { completion: "" };
  const trimmed = line.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return { completion: "" };

  const lowerLine = line.toLowerCase();
  const lowerTrimmed = trimmed.toLowerCase();

  let best: GhostTextState = { completion: "" };
  // inputHistory is oldest → newest; the newest matching entry wins.
  for (let i = inputHistory.length - 1; i >= 0; i -= 1) {
    const entry = inputHistory[i];
    if (!entry) continue;
    const entryFirstLine = entry.split("\n", 1)[0];
    if (entryFirstLine.length <= line.length) continue;
    const lowerEntry = entryFirstLine.toLowerCase();
    const matchAgainst = lowerEntry.startsWith(lowerTrimmed)
      ? trimmed.length
      : lowerEntry.startsWith(lowerLine)
        ? line.length
        : 0;
    if (matchAgainst === 0) continue;
    const remainder = entryFirstLine.slice(line.length > 0 && matchAgainst === line.length ? line.length : matchAgainst);
    const suffix = entryFirstLine.slice(matchAgainst);
    const completion = (remainder || suffix).trimEnd();
    if (Array.from(completion).length < MIN_COMPLETION_LENGTH) continue;
    // Skip trivially repetitive completions (a single repeated character,
    // which reads as a rendering glitch rather than a suggestion).
    if (/^(.)\1+$/.test(completion.trim())) continue;
    best = { completion, source: entryFirstLine };
    break;
  }
  return best;
}

/**
 * Given the current value + caret and a ghost completion, produce the value
 * after Tab-accept. The completion is inserted at the caret (end of input).
 */
export function applyGhostCompletion(value: string, caret: number, completion: string): { value: string; caret: number } {
  const next = value.slice(0, caret) + completion;
  const nextCaret = next.length;
  return { value: next, caret: nextCaret };
}

/** Debounce helper: returns a controller that fires after `ms` of quiet. */
export class Debouncer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly ms: number;

  constructor(ms: number) {
    this.ms = ms;
  }

  schedule(run: () => void): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      run();
    }, this.ms);
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
