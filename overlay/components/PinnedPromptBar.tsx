/**
 * PinnedPromptBar — keeps the prompt currently being answered visible at the
 * top of the chat, no matter where you have scrolled to.
 *
 * Folder: components/PinnedPromptBar.tsx (new file — no upstream file touched)
 *
 * Why a sticky bar and not just the existing prompt anchor: the anchor scrolls
 * the sent message to the top *while the turn runs*, then releases it, and the
 * tail-follow scrolls the reply into view — so the question drifts off screen
 * exactly when you start reading the answer. This bar is the always-there
 * reference: one line of the latest user message, expandable, with a jump back
 * to the message itself.
 *
 * It hides itself while the real message is fully on screen (the same pattern
 * as an iOS navigation bar taking over from an in-page title), so the text is
 * never shown twice and nothing jumps as you scroll.
 */
"use client";

import { useEffect, useRef, useState } from "react";

/** Fraction of the message that counts as "on screen, no need for the bar". */
const VISIBLE_ENOUGH = 0.98;

interface PinnedPromptBarProps {
  /** The latest user message, or null when there is nothing to pin. */
  text: string | null;
  /** Entry id of that message, used to find its element in the transcript. */
  entryId?: string | null;
  /** The scrolling message list; the bar is sticky inside it. */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  onJump?: (element: HTMLElement) => void;
  labels: { title: string; toggle: string; jump: string };
}

export function PinnedPromptBar({
  text,
  entryId,
  scrollContainerRef,
  onJump,
  labels,
}: PinnedPromptBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [messageVisible, setMessageVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Collapse again whenever the pinned message changes (new turn).
  useEffect(() => {
    setExpanded(false);
  }, [entryId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!text || !container || !entryId) {
      setMessageVisible(false);
      return;
    }
    const element = container.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(entryId)}"]`);
    if (!element) {
      // Not (yet) part of the loaded window: the bar is the only way to see it.
      setMessageVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        setMessageVisible(entry ? entry.intersectionRatio >= VISIBLE_ENOUGH : false);
      },
      { root: container, threshold: [0, VISIBLE_ENOUGH, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [entryId, text, scrollContainerRef]);

  if (!text || messageVisible) return null;

  return (
    <div
      ref={rootRef}
      className={`pinned-prompt${expanded ? " is-expanded" : ""}`}
      data-testid="pinned-prompt"
    >
      <div className="pinned-prompt-inner">
        <button
          type="button"
          className="pinned-prompt-body"
          title={expanded ? labels.toggle : text}
          aria-label={labels.title}
          aria-expanded={expanded}
          onClick={() => setExpanded((previous) => !previous)}
        >
          <span className="pinned-prompt-glyph" aria-hidden="true">❯</span>
          <span className="pinned-prompt-text">{text}</span>
        </button>
        <button
          type="button"
          className="pinned-prompt-action"
          title={labels.jump}
          aria-label={labels.jump}
          onClick={() => {
            const container = scrollContainerRef.current;
            const element = entryId
              ? container?.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(entryId)}"]`) ?? null
              : null;
            if (element) onJump?.(element);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
