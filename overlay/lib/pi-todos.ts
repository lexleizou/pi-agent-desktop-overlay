/**
 * pi-todos state bridge.
 *
 * The user's pi-todos extension keeps its authoritative state in tool-result
 * details and custom session entries. These helpers mirror that state without
 * parsing the presentation-only widget (which is truncated to a few rows).
 */

export interface PiTodo {
  id: number;
  text: string;
  done: boolean;
}

export interface PiTodosState {
  todos: PiTodo[];
  nextId: number;
}

const PI_TODOS_ENTRY_TYPE = "pi-todos";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneState(state: PiTodosState): PiTodosState {
  return {
    todos: state.todos.map((todo) => ({ ...todo })),
    nextId: state.nextId,
  };
}

export function isPiTodosState(value: unknown): value is PiTodosState {
  if (!isRecord(value) || !Array.isArray(value.todos)) return false;
  if (typeof value.nextId !== "number" || !Number.isFinite(value.nextId)) return false;
  return value.todos.every((todo) => (
    isRecord(todo)
    && typeof todo.id === "number"
    && typeof todo.text === "string"
    && typeof todo.done === "boolean"
  ));
}

/** Extract state from a pi-todos `tool_execution_end` result. */
export function piTodosFromToolResult(result: unknown): PiTodosState | null {
  if (!isRecord(result)) return null;
  return isPiTodosState(result.details) ? cloneState(result.details) : null;
}

/**
 * Replay the current branch exactly like pi-todos does: later tool results and
 * manual custom entries overwrite earlier state.
 */
export function reconstructPiTodos(entries: readonly unknown[]): PiTodosState {
  let state: PiTodosState = { todos: [], nextId: 1 };
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    if (entry.type === "message") {
      const message = entry.message;
      if (!isRecord(message) || message.role !== "toolResult" || message.toolName !== "todo") continue;
      if (isPiTodosState(message.details)) state = cloneState(message.details);
    } else if (entry.type === "custom" && entry.customType === PI_TODOS_ENTRY_TYPE) {
      if (isPiTodosState(entry.data)) state = cloneState(entry.data);
    }
  }
  return state;
}

/** Todo state carried by a live session event: a finished `todo` tool call,
 *  or the custom entry the extension appends for manual /todos edits. */
export function piTodosFromEvent(event: { type: string; [key: string]: unknown }): PiTodosState | null {
  if (event.type === "tool_execution_end" && event.toolName === "todo") {
    return piTodosFromToolResult(event.result);
  }
  if (event.type === "entry_appended" && isRecord(event.entry)) {
    const entry = event.entry;
    if (entry.type === "custom" && entry.customType === PI_TODOS_ENTRY_TYPE && isPiTodosState(entry.data)) {
      return cloneState(entry.data);
    }
  }
  return null;
}
