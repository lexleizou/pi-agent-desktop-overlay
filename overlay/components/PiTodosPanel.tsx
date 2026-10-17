/**
 * PiTodosPanel — task panel pinned to the chat area's top-right corner.
 *
 * Folder: components/PiTodosPanel.tsx (new file — no upstream file touched)
 *
 * The user's pi-todos extension keeps the authoritative list. The wrapper
 * rebuilds it from the session branch for get_state (load/resume/branch
 * switch) and pushes a `pi_todos_update` event after every `todo` call or
 * /todos edit, so this panel is pure rendering — no polling, no extra fetches.
 *
 * Redesign (2026-10-17): structure borrowed from beautifului.dev's `TaskRows`
 * + `LoadingState` (MIT, © 2026 Shane Levine) — completion rail, per-row
 * status badges, expandable long rows, live `Working · Ns` shimmer. Claude
 * elements kept on purpose: `Progress` / `Memory` naming, quiet card shell,
 * Clay accent, and a suggestion-style conservatism about what the data
 * actually says (the badge is only done / not done).
 *
 * Control surface (added 2026-10-17, second pass):
 *  - **Resizable**: drag the left edge (or use ← / → on the handle when
 *    focused). Width is clamped to the current gutter and persisted.
 *  - **Collapsible**: the chevron in the header folds the card to a small pill.
 *  - **Closable**: × hides it, leaving a compact restore chip in the corner.
 *  - **Never covers the question**: the card is only used when it fits in the
 *    gutter beside the message column. Otherwise (or while a turn is running
 *    with the prompt anchored at the top) it degrades to the pill, and the
 *    panel is pushed below the anchored question. An overlay panel cannot
 *    guarantee zero overlap at any window size, so instead of pretending it
 *    does, the panel yields: it stays a pill until there is room for the card.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPENVIKING_URL = "http://127.0.0.1:8000"; // local OpenViking server

/** Rows longer than this get an expand affordance instead of a hard ellipsis.
 *  Kept low on purpose: the panel is 220-520px wide, so anything past a short
 *  label already overflows one line, and a wrapping row makes the list ragged. */
const TRUNCATE_AT = 28;
/** Rows rendered before collapsing the tail into "+N more". */
const VISIBLE_ROWS = 8;
/** The message column's max width (--chat-content-max-width default). */
const MESSAGE_COLUMN_WIDTH = 820;
/** Visible gap to leave between the card and the message column. */
const MIN_GUTTER = 16;
/** The panel's own `right` inset, mirrored from the stylesheet. */
const PANEL_RIGHT_INSET = 16;
const MIN_WIDTH = 220;
const MAX_WIDTH = 520;
const DEFAULT_WIDTH = 300;
const STORAGE_KEY = "pi-todos-panel";

type PanelMode = "pill" | "card" | "closed";

interface PiTodoRow {
  id: number;
  text: string;
  done: boolean;
}

interface StoredPrefs {
  mode?: PanelMode;
  width?: number;
}

function clampWidth(value: number, max = MAX_WIDTH): number {
  return Math.min(Math.max(Math.round(value), MIN_WIDTH), Math.max(MIN_WIDTH, max));
}

function readPrefs(): StoredPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredPrefs;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePrefs(next: StoredPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or disabled localStorage must never break the panel.
  }
}

function WorkingLabel({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="bui-shimmer-label" aria-live="polite">
      Working · {seconds}s
    </span>
  );
}

export function PiTodosPanel({
  todos,
  busy = false,
  anchored = false,
}: {
  todos: PiTodoRow[] | null;
  /** True while the session's agent or shell is running (from ChatWindow). */
  busy?: boolean;
  /** True while the last user message is pinned to the top of the chat area. */
  anchored?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [busySince, setBusySince] = useState<number | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [userMode, setUserMode] = useState<PanelMode | null>(null);
  const [areaWidth, setAreaWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  /** Mode to come back to when the closed chip is clicked. */
  const lastOpenModeRef = useRef<PanelMode>("pill");

  useEffect(() => {
    const prefs = readPrefs();
    if (typeof prefs.width === "number" && Number.isFinite(prefs.width)) {
      setWidth(clampWidth(prefs.width));
    }
    if (prefs.mode === "pill" || prefs.mode === "card" || prefs.mode === "closed") {
      setUserMode(prefs.mode);
    }
  }, []);

  useEffect(() => {
    if (!busy) {
      setBusySince(null);
      return;
    }
    setBusySince((previous) => previous ?? Date.now());
  }, [busy]);

  // The chat window is the panel's offset parent (it is `relative`); measuring
  // it tells us whether the card fits beside the message column. Keyed on
  // `hasRows`: the panel renders nothing until there are todos, so a `[]`-deps
  // effect would run once with a null ref and then never measure again, which
  // silently pinned the panel to the card layout at every window size.
  const hasRows = Boolean(todos && todos.length > 0);
  useEffect(() => {
    if (!hasRows) return;
    const element = panelRef.current;
    const host = (element?.closest(".chat-window") as HTMLElement | null)
      ?? (element?.offsetParent as HTMLElement | null);
    if (!host) return;
    const measure = () => setAreaWidth(host.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hasRows]);

  const gutter = areaWidth === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, (areaWidth - MESSAGE_COLUMN_WIDTH) / 2);
  /** Widest card that still clears the message column. */
  const maxWidthForGutter = Math.max(
    MIN_WIDTH,
    Math.min(MAX_WIDTH, gutter - PANEL_RIGHT_INSET - MIN_GUTTER),
  );
  /** The width the card would like, narrowed to the room that actually exists. */
  const cardWidth = Math.min(width, maxWidthForGutter);
  const preferredFits = cardWidth >= width;

  // An explicit request ALWAYS opens — the card is narrowed to the gutter
  // rather than refused, because refusing is what made a click look dead
  // wherever 300px did not fit. Only the automatic appearance is conservative:
  // a card when it fits and the question is not pinned to the top of the chat.
  const explicitCard = userMode === "card";
  const autoCard = userMode === null && preferredFits && !(busy && anchored);
  const mode: PanelMode = userMode === "closed"
    ? "closed"
    : explicitCard || autoCard
      ? "card"
      : "pill";

  const setMode = useCallback((next: PanelMode) => {
    setUserMode(next);
    writePrefs({ mode: next, width });
  }, [width]);

  const startDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    // Capture keeps the drag alive outside the handle, but a browser may
    // refuse it (or the event may be synthetic); the resize must not depend
    // on it succeeding.
    try {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore: pointermove events still arrive while the button is held.
    }
    dragRef.current = { startX: event.clientX, startWidth: cardWidth };
    setDragging(true);
  }, [cardWidth]);

  const onDragMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // The handle sits on the left edge: dragging left widens the panel.
    const next = clampWidth(drag.startWidth - (event.clientX - drag.startX), maxWidthForGutter);
    setWidth(next);
  }, [maxWidthForGutter]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    setWidth((current) => {
      writePrefs({ mode: userMode ?? "card", width: current });
      return current;
    });
  }, [userMode]);

  if (!todos || todos.length === 0) return null;

  const done = todos.filter((todo) => todo.done).length;
  const percent = todos.length > 0 ? Math.round((done / todos.length) * 100) : 0;
  const visible = showAll ? todos : todos.slice(0, VISIBLE_ROWS);
  const anchoredClass = anchored ? " pi-todos-panel--anchored" : "";

  if (mode === "closed") {
    return (
      <button
        type="button"
        ref={panelRef as React.RefObject<HTMLButtonElement>}
        className={`pi-todos-restore${anchoredClass}`}
        onClick={() => setMode(lastOpenModeRef.current)}
        title="Show the task panel"
        aria-label={`Show task panel (${done} of ${todos.length} done)`}
      >
        <span aria-hidden="true">◱</span>
        {done}/{todos.length}
      </button>
    );
  }

  if (mode === "pill") {
    return (
      <button
        type="button"
        ref={panelRef as React.RefObject<HTMLButtonElement>}
        className={`pi-todos-pill${anchoredClass}${busy ? " is-busy" : ""}`}
        onClick={() => setMode("card")}
        title={preferredFits
          ? "Show the task panel"
          : "Show the task panel (narrowed to the space beside the text)"}
        aria-label={`Tasks ${done} of ${todos.length} done`}
      >
        <span className="pi-todos-pill-rail" aria-hidden="true">
          <span className="pi-todos-pill-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="pi-todos-pill-count">{done}/{todos.length}</span>
        {busy && busySince !== null && <WorkingLabel since={busySince} />}
      </button>
    );
  }

  return (
    <div
      ref={panelRef as React.RefObject<HTMLDivElement>}
      className={`cowork-panel pi-todos-panel${anchoredClass}${dragging ? " is-dragging" : ""}`}
      data-testid="pi-todos-panel"
      aria-label="Task list"
      style={{ width: cardWidth }}
    >
      <span
        className="pi-todos-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize task panel"
        tabIndex={0}
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const next = clampWidth(width + (event.key === "ArrowLeft" ? 24 : -24), maxWidthForGutter);
          setWidth(next);
          writePrefs({ mode: userMode ?? "card", width: next });
        }}
      />

      <div className="pi-todos-scroll">
        <div className="cowork-section bui-section">
          <div className="bui-progress-head">
            <span className="cowork-section-title">Progress</span>
            <span className="bui-progress-head-right">
              {busy && busySince !== null && <WorkingLabel since={busySince} />}
              <span className="cowork-section-count">{done}/{todos.length}</span>
              <button
                type="button"
                className="pi-todos-action"
                onClick={() => setMode("pill")}
                title="Collapse"
                aria-label="Collapse task panel"
              >
                ⌄
              </button>
              <button
                type="button"
                className="pi-todos-action"
                onClick={() => {
                  lastOpenModeRef.current = "card";
                  setMode("closed");
                }}
                title="Close"
                aria-label="Close task panel"
              >
                ✕
              </button>
            </span>
          </div>
          <div
            className="bui-progress-rail"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Task completion"
          >
            <div
              className="bui-progress-fill"
              data-active={busy ? "true" : "false"}
              style={{ width: `${percent}%` }}
            />
          </div>

          {visible.map((todo) => {
            const long = todo.text.length > TRUNCATE_AT;
            const isExpanded = long && expanded[todo.id] === true;
            const text = (
              <span
                className="bui-task-text"
                data-done={todo.done ? "true" : "false"}
                data-truncated={long && !isExpanded ? "true" : "false"}
                data-expanded={isExpanded ? "true" : "false"}
              >
                {todo.text}
              </span>
            );
            const badge = (
              <span
                className={`bui-task-badge ${todo.done ? "bui-task-badge-done" : "bui-task-badge-pending"}`}
                aria-hidden="true"
              >
                {todo.done ? "✓" : ""}
              </span>
            );

            // Long rows expand in place (beautifului TaskRows' disclosure);
            // short rows are plain list items with no affordance to click.
            return long ? (
              <button
                key={todo.id}
                type="button"
                className="bui-task-row"
                data-interactive="true"
                aria-expanded={isExpanded}
                onClick={() => setExpanded((prev) => ({ ...prev, [todo.id]: !prev[todo.id] }))}
                title={todo.text}
              >
                {badge}
                {text}
                <span className="bui-task-caret" aria-hidden="true">›</span>
              </button>
            ) : (
              <div key={todo.id} className="bui-task-row" data-interactive="false">
                {badge}
                {text}
              </div>
            );
          })}

          {todos.length > VISIBLE_ROWS && (
            <button
              type="button"
              className="bui-task-row bui-task-more"
              data-interactive="true"
              onClick={() => setShowAll((prev) => !prev)}
            >
              <span className="bui-task-text" data-done="false">
                {showAll ? "Show less" : `+${todos.length - VISIBLE_ROWS} more`}
              </span>
            </button>
          )}
        </div>

        <div className="cowork-section bui-section">
          <div className="cowork-section-header">
            <span className="cowork-section-title">Memory</span>
          </div>
          <a className="cowork-row cowork-memory-link" href={OPENVIKING_URL} target="_blank" rel="noreferrer">
            <span className="cowork-row-glyph" aria-hidden="true">⟳</span>
            <span className="cowork-row-text">OpenViking</span>
          </a>
        </div>
      </div>
    </div>
  );
}
