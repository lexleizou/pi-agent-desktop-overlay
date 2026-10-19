/**
 * SuggestionChips — the follow-up suggestion, delivered as grey text INSIDE the
 * composer instead of a card above it.
 *
 * Folder: components/SuggestionChips.tsx (new file — no upstream file touched)
 *
 * Behaviour (2026-10-18):
 *  - One suggestion per turn (the engine merges the reply's own next step with
 *    its own idea into a single line).
 *  - It is shown as placeholder-style grey text in the empty composer, so it
 *    reads as a proposal rather than an extra panel — nothing is covered and the
 *    chat area's height never changes.
 *  - `Tab` accepts it: the text is inserted as a real draft the user can edit,
 *    and the grey text disappears (the composer is no longer empty).
 *  - Typing anything dismisses it; the suggestion only lives while the composer
 *    is empty and the session is idle.
 *
 * The component renders nothing. It owns the fetch-triggered lifecycle and hands
 * the text to ChatInput through the handle, because the grey text has to live in
 * the composer's own placeholder slot.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

export interface SuggestionChipsHandle {
  /** Present a suggestion (already fetched by ChatWindow). */
  present: (suggestions: string[]) => void;
  /** Drop the current suggestion immediately. */
  clear: () => void;
}

interface SuggestionChipsProps {
  handleRef: React.MutableRefObject<SuggestionChipsHandle | null>;
  /** Current suggestion, mirrored up so the composer can render it. */
  onChange?: (suggestion: string | null) => void;
}

export function SuggestionChips({ handleRef, onChange }: SuggestionChipsProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const clear = useCallback(() => {
    setSuggestion(null);
    onChange?.(null);
  }, [onChange]);

  const present = useCallback((next: string[]) => {
    // One line is the contract now; a stale multi-item payload still works.
    const first = next.map((item) => item.trim()).find((item) => item.length > 0) ?? null;
    setSuggestion(first);
    onChange?.(first);
  }, [onChange]);

  useEffect(() => {
    handleRef.current = { present, clear };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, present, clear]);

  // Escape drops it, matching the old card's behaviour.
  useEffect(() => {
    if (!suggestion) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suggestion, clear]);

  return null;
}
