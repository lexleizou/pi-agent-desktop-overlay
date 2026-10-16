/**
 * SuggestionChips — follow-up suggestion chips shown above the composer.
 *
 * Folder: components/SuggestionChips.tsx (new file — no upstream file touched)
 *
 * Follows the Claude Design System (CDS) visual language extracted by
 * open-claude-ui (MIT): CDS surface tokens, hairline border, Clay accent,
 * a CSS spring approximation for the entrance, and dark-mode parity via the
 * app's existing `html.dark` class. All colors live in cds-overlay.css —
 * this file carries layout only.
 *
 * Interaction contract, tuned for a coding tool (more conservative than
 * ChatGPT's tap-to-send): tapping a chip fills the composer via the existing
 * chatInputRef.insertIfEmpty() handle — sending still needs the user's
 * Enter. Chips show only while the session is idle and hide as soon as the
 * user starts typing; clicking one also hides the row (one-shot).
 */
"use client";

import { useCallback, useEffect, useState } from "react";

export interface SuggestionChipsHandle {
  /** Present new suggestions (already fetched by ChatWindow). */
  present: (suggestions: string[]) => void;
  /** Drop current suggestions immediately. */
  clear: () => void;
}

interface SuggestionChipsProps {
  handleRef: React.MutableRefObject<SuggestionChipsHandle | null>;
  /** Insert text into the composer (only if the composer is empty). */
  onInsert: (text: string) => void;
  /** Focus the composer after inserting. */
  onFocusInput: () => void;
}

export function SuggestionChips({ handleRef, onInsert, onFocusInput }: SuggestionChipsProps) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [entered, setEntered] = useState(false);

  const clear = useCallback(() => {
    setSuggestions(null);
    setEntered(false);
  }, []);

  const present = useCallback((next: string[]) => {
    setSuggestions(next);
    setEntered(false);
    // Double rAF so the transition runs even when the row just mounted.
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }, []);

  useEffect(() => {
    handleRef.current = { present, clear };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, present, clear]);

  // Escape hides the row; focus semantics stay with the composer.
  useEffect(() => {
    if (!suggestions || suggestions.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      const insideChips = target instanceof HTMLElement && target.closest(".suggestion-chips");
      if (!insideChips) {
        event.stopPropagation();
      }
      clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suggestions, clear]);

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div
      className="suggestion-chips"
      data-entered={entered ? "true" : "false"}
      aria-live="polite"
      data-testid="suggestion-chips"
    >
      {suggestions.map((text, index) => (
        <button
          key={`${index}-${text}`}
          type="button"
          className="suggestion-chip"
          onClick={() => {
            onInsert(text);
            onFocusInput();
            clear();
          }}
          title={text}
          aria-label={`Use suggestion: ${text}`}
        >
          <span className="suggestion-chip-label">{text}</span>
          <span className="suggestion-chip-arrow" aria-hidden="true">↑</span>
        </button>
      ))}
    </div>
  );
}
