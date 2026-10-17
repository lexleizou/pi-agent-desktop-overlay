/**
 * PiTodosPanel — task panel pinned to the chat area's top-right corner.
 *
 * Folder: components/PiTodosPanel.tsx (new file — no upstream file touched)
 *
 * The user's pi-todos extension keeps the authoritative list. The wrapper
 * rebuilds it from the session branch for get_state (load/resume/branch
 * switch) and pushes a `pi_todos_update` event after every `todo` call or
 * /todos edit, so this panel is pure rendering — no polling, no extra
 * fetches.
 *
 * Redesign (2026-10-17): rebuilt in the structure of beautifului.dev's
 * `TaskRows` + `LoadingState` (MIT, © 2026 Shane Levine) — a completion rail,
 * per-row status badges, expandable long rows, and a live "Working · Ns"
 * shimmer while the turn is running. Claude elements are kept on purpose:
 * the "Progress" / "Memory" section naming, the quiet card shell and the
 * OpenViking shortcut. Nothing here claims a per-task running state the data
 * does not have — the badge is only done / not done, and the "Working" label
 * reflects the session's real busy flag.
 */
"use client";

import { useEffect, useState } from "react";

const OPENVIKING_URL = "http://127.0.0.1:8000"; // local OpenViking server

/** Rows longer than this get an expand affordance instead of a hard ellipsis. */
const TRUNCATE_AT = 72;
/** Rows rendered before collapsing the tail into "+N more". */
const VISIBLE_ROWS = 8;

interface PiTodoRow {
  id: number;
  text: string;
  done: boolean;
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
}: {
  todos: PiTodoRow[] | null;
  /** True while the session's agent or shell is running (from ChatWindow). */
  busy?: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [busySince, setBusySince] = useState<number | null>(null);

  useEffect(() => {
    if (!busy) {
      setBusySince(null);
      return;
    }
    setBusySince((previous) => previous ?? Date.now());
  }, [busy]);

  if (!todos || todos.length === 0) return null;

  const done = todos.filter((todo) => todo.done).length;
  const percent = todos.length > 0 ? Math.round((done / todos.length) * 100) : 0;
  const visible = showAll ? todos : todos.slice(0, VISIBLE_ROWS);

  return (
    <div
      className="cowork-panel pi-todos-panel"
      data-testid="pi-todos-panel"
      aria-label="Task list"
    >
      <div className="cowork-section bui-section">
        <div className="bui-progress-head">
          <span className="cowork-section-title">Progress</span>
          <span className="bui-progress-head-right">
            {busy && busySince !== null && <WorkingLabel since={busySince} />}
            <span className="cowork-section-count">{done}/{todos.length}</span>
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
  );
}
