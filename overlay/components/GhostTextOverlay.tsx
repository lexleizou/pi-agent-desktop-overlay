/**
 * Ghost text state hook (phase 2) — rebuilt 2026-10-17.
 *
 * Folder: components/GhostTextOverlay.tsx (new file — no upstream file touched)
 *
 * Two defects were found in the first implementation and are both removed
 * here rather than patched:
 *
 *  1. Positioning. It measured the caret with a hidden mirror element, so the
 *     completion could render at the wrong offset (the layer's nearest
 *     positioned ancestor is the outer `.chat-composer-wrap`, not the
 *     textarea container) — and a failed measurement silently produced
 *     nothing. This version does not measure at all: the completion is
 *     rendered as a normal flex sibling of the textarea (see ChatInput), so
 *     it can never be misplaced and needs no caret maths.
 *  2. Triggering. It only recomputed from the textarea's own change/select
 *     handlers; anything that changed the draft another way left the
 *     completion stale, which read as "it only works once". The recompute is
 *     now keyed on the draft value itself, and state updates are identity
 *     -checked so recomputing cannot loop.
 *
 * The engine (prefix match over input history) lives in lib/ghost-text and is
 * unchanged.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeGhostText, type GhostTextState } from "@/lib/ghost-text";

export interface GhostTextController {
  /** Recompute for the current textarea state. */
  update: () => void;
  /** Hide immediately (send, menu open, blur, streaming). */
  hide: () => void;
  /** Snapshot of the current completion, for ChatInput's Tab handler. */
  current: () => { completion: string; sourceLine: string } | null;
}

const EMPTY: GhostTextState = { completion: "" };

export function useGhostText(
  getTextarea: () => HTMLTextAreaElement | null,
  inputHistory: string[],
  suppressed: boolean,
  /** The draft value; recomputing is keyed on this so no edit source is missed. */
  value: string,
): {
  controllerRef: React.MutableRefObject<GhostTextController | null>;
  ghost: GhostTextState;
  hide: () => void;
} {
  const [ghost, setGhost] = useState<GhostTextState>(EMPTY);
  const ghostRef = useRef<GhostTextState>(EMPTY);

  // Latest inputs, read at call time. Reading them from refs keeps `compute`
  // identity-stable, so the value-keyed effect cannot re-run in a loop.
  const latest = useRef({ getTextarea, inputHistory, suppressed });
  latest.current = { getTextarea, inputHistory, suppressed };

  const apply = useCallback((next: GhostTextState) => {
    const previous = ghostRef.current;
    if (previous.completion === next.completion && previous.source === next.source) return;
    ghostRef.current = next;
    setGhost(next);
  }, []);

  const hide = useCallback(() => {
    apply(EMPTY);
  }, [apply]);

  const compute = useCallback(() => {
    const { getTextarea: get, inputHistory: history, suppressed: isSuppressed } = latest.current;
    if (isSuppressed) {
      apply(EMPTY);
      return;
    }
    const textarea = get();
    if (!textarea) {
      apply(EMPTY);
      return;
    }
    const caret = textarea.selectionStart ?? textarea.value.length;
    apply(computeGhostText(textarea.value, caret, history));
  }, [apply]);

  // Keyed on the draft value and the suppress flag: every edit path — typing,
  // paste, draft restore, menu open, stream start — recomputes exactly once.
  useEffect(() => {
    compute();
  }, [value, suppressed, compute]);

  const controllerRef = useRef<GhostTextController | null>(null);
  controllerRef.current = {
    update: compute,
    hide,
    current: () =>
      ghostRef.current.completion
        ? { completion: ghostRef.current.completion, sourceLine: ghostRef.current.source ?? "" }
        : null,
  };

  return { controllerRef, ghost, hide };
}
