/**
 * SuggestionChips — follow-up suggestion cards shown above the composer.
 *
 * Folder: components/SuggestionChips.tsx (new file — no upstream file touched)
 *
 * Redesign (2026-10-17): rebuilt as a recommendation CARD in the structure of
 * beautifului.dev's `RecommendationCard` (MIT, © 2026 Shane Levine) — a card
 * shell with a hairline ring, a header row with count, and one row per
 * suggestion carrying an explicit accept affordance. The *look* stays Claude:
 * quiet surfaces, Clay accent, no confidence gauge (the engine returns plain
 * strings and this file will not invent a score for them).
 *
 * Interaction contract is unchanged and deliberately conservative for a
 * coding tool: tapping a row fills the composer via the existing
 * chatInputRef.insertIfEmpty() handle — sending still needs Enter. Rows show
 * only while the session is idle and disappear as soon as the user types or
 * a row is accepted (one-shot). Escape dismisses the card.
 *
 * Aesthetics come from components/bui-overlay.css (`.bui-card`, `.bui-row`);
 * this file carries structure and behaviour only.
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
    // Double rAF so the entrance transition runs even when the card just mounted.
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }, []);

  useEffect(() => {
    handleRef.current = { present, clear };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, present, clear]);

  // Escape dismisses the card; focus semantics stay with the composer.
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
      className="suggestion-chips bui-card"
      data-entered={entered ? "true" : "false"}
      aria-live="polite"
      data-testid="suggestion-chips"
      role="group"
      aria-label="Follow-up suggestions"
    >
      <div className="suggestion-card-head">
        <span className="suggestion-card-title">
          <span className="suggestion-card-spark" aria-hidden="true">✦</span>
          Follow-ups
        </span>
        <span className="suggestion-card-count">
          {suggestions.length}
        </span>
      </div>
      <div className="suggestion-card-body">
        {suggestions.map((text, index) => (
          <button
            key={`${index}-${text}`}
            type="button"
            className="suggestion-chip bui-row"
            style={{ animationDelay: `${index * 40}ms` }}
            onClick={() => {
              onInsert(text);
              onFocusInput();
              clear();
            }}
            title={text}
            aria-label={`Use suggestion: ${text}`}
          >
            <span className="suggestion-chip-index" aria-hidden="true">{index + 1}</span>
            <span className="suggestion-chip-label">{text}</span>
            <span className="suggestion-chip-arrow" aria-hidden="true" title="Insert into the composer">
              ↵
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
