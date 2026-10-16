/**
 * Ghost text state + rendering helper hook (phase 2).
 *
 * Folder: components/GhostTextOverlay.tsx (new file — no upstream file touched)
 *
 * Renders the ghost completion inline after the caret. Technique: a wrapper
 * div (position: relative, supplied by ChatInput) contains the textarea plus
 * this absolutely-positioned overlay that mirrors the textarea's text layout
 * via a same-metrics "before" span — the standard caret-measurement approach.
 *
 * To keep the overlay simple and robust across theme changes, ChatInput
 * passes the caret (x, y) measured from the real DOM each time it changes;
 * this file only positions and renders. The engine lives in lib/ghost-text.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeGhostText, Debouncer, type GhostTextState } from "@/lib/ghost-text";

export interface GhostTextController {
  /**
   * Recompute for the current textarea state. Call from onChange/onSelect.
   * No-op while suppressed.
   */
  update: () => void;
  /** Hide immediately (send, menu open, blur, streaming). */
  hide: () => void;
  /** Snapshot of the current completion, for ChatInput's Tab handler. */
  current: () => { completion: string; sourceLine: string } | null;
}

const DEBOUNCE_MS = 200;

export function useGhostText(
  getTextarea: () => HTMLTextAreaElement | null,
  inputHistory: string[],
  suppressed: boolean,
): {
  controllerRef: React.MutableRefObject<GhostTextController | null>;
  ghost: GhostTextState;
  caretPosition: { left: number; top: number } | null;
  /** Measure and set caret position from the live textarea. */
  measure: () => void;
  hide: () => void;
} {
  const [ghost, setGhost] = useState<GhostTextState>({ completion: "" });
  const [caretPosition, setCaretPosition] = useState<{ left: number; top: number } | null>(null);
  const ghostRef = useRef<GhostTextState>({ completion: "" });
  const debouncerRef = useRef<Debouncer | null>(null);

  useEffect(() => {
    debouncerRef.current = new Debouncer(DEBOUNCE_MS);
    return () => debouncerRef.current?.cancel();
  }, []);

  const compute = useCallback(() => {
    const ta = getTextarea();
    if (!ta || suppressed) return;
    const state = computeGhostText(ta.value, ta.selectionStart ?? ta.value.length, inputHistory);
    ghostRef.current = state;
    setGhost(state);
    if (state.completion) {
      setCaretPosition(measureCaret(ta, ta.selectionStart ?? ta.value.length));
    } else {
      setCaretPosition(null);
    }
  }, [getTextarea, inputHistory, suppressed]);

  const hide = useCallback(() => {
    debouncerRef.current?.cancel();
    ghostRef.current = { completion: "" };
    setGhost({ completion: "" });
    setCaretPosition(null);
  }, []);

  const measure = useCallback(() => {
    const ta = getTextarea();
    if (!ta) return;
    setCaretPosition(measureCaret(ta, ta.selectionStart ?? ta.value.length));
  }, [getTextarea]);

  const controllerRef = useRef<GhostTextController | null>(null);
  controllerRef.current = {
    update: () => {
      debouncerRef.current?.schedule(compute);
    },
    hide,
    current: () => ghostRef.current.completion ? { completion: ghostRef.current.completion, sourceLine: ghostRef.current.source ?? "" } : null,
  };

  // Stand down while suppressed.
  useEffect(() => {
    if (suppressed) hide();
  }, [suppressed, hide]);

  return { controllerRef, ghost, caretPosition, measure, hide };
}

/**
 * Measure the caret's coordinates inside a textarea via a mirror element.
 * Standard technique: copy the text before the caret into a hidden div with
 * identical metrics, append a marker span, and read its offset. Returns
 * coordinates relative to the textarea's border box.
 */
export function measureCaret(ta: HTMLTextAreaElement, caret: number): { left: number; top: number } {
  let mirror = document.getElementById("ghost-text-mirror");
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.id = "ghost-text-mirror";
    document.body.appendChild(mirror);
  }
  const style = mirror.style;
  const taStyle = getComputedStyle(ta);

  style.position = "absolute";
  style.visibility = "hidden";
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";
  style.boxSizing = "border-box";

  const props = [
    "fontSize", "lineHeight", "fontFamily", "fontWeight", "fontStyle",
    "letterSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "tabSize", "textTransform",
  ] as const;
  for (const prop of props) {
    style[prop] = taStyle[prop] as unknown as string;
  }
  style.width = `${ta.clientWidth}px`;

  mirror.textContent = ta.value.slice(0, caret);
  const marker = document.createElement("span");
  marker.textContent = "​"; // zero-width space keeps the span from collapsing
  mirror.appendChild(marker);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const left = markerRect.left - mirrorRect.left - ta.scrollLeft;
  const top = markerRect.top - mirrorRect.top - ta.scrollTop;
  return { left, top };
}
