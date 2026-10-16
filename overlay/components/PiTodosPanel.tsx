/**
 * PiTodosPanel — Claude Co-Work style task panel pinned to the chat area's
 * top-right corner.
 *
 * Folder: components/PiTodosPanel.tsx (new file — no upstream file touched)
 *
 * The user's pi-todos extension keeps the authoritative list. The wrapper
 * rebuilds it from the session branch for get_state (load/resume/branch
 * switch) and pushes a `pi_todos_update` event after every `todo` call or
 * /todos edit, so this panel is pure rendering — no polling, no extra
 * fetches. Styling reuses the Co-Work panel classes from cds-overlay.css.
 */
"use client";

const OPENVIKING_URL = "http://127.0.0.1:8000"; // local OpenViking server

export function PiTodosPanel({ todos }: { todos: { id: number; text: string; done: boolean }[] | null }) {
  if (!todos || todos.length === 0) return null;
  const done = todos.filter((todo) => todo.done).length;

  return (
    <div
      className="cowork-panel pi-todos-panel"
      data-testid="pi-todos-panel"
      aria-label="Task list"
    >
      <div className="cowork-section">
        <div className="cowork-section-header">
          <span className="cowork-section-title">Progress</span>
          <span className="cowork-section-count">{done}/{todos.length}</span>
        </div>
        {todos.slice(0, 8).map((todo) => (
          <div key={todo.id} className={`cowork-row cowork-task-${todo.done ? "done" : "pending"}`}>
            <span className="cowork-row-glyph" aria-hidden="true">{todo.done ? "☑" : "☐"}</span>
            <span className="cowork-row-text">{todo.text}</span>
          </div>
        ))}
        {todos.length > 8 && (
          <div className="cowork-row">
            <span className="cowork-row-glyph" aria-hidden="true">…</span>
            <span className="cowork-row-text cowork-row-dim">+{todos.length - 8} more</span>
          </div>
        )}
      </div>
      <div className="cowork-section">
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
