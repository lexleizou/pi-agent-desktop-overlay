import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { piTodosFromEvent, reconstructPiTodos } = await jiti.import("./pi-todos.ts");

const stateA = { todos: [{ id: 1, text: "调研", done: false }], nextId: 2 };
const stateB = { todos: [{ id: 1, text: "调研", done: true }, { id: 2, text: "写方案", done: false }], nextId: 3 };

test("reconstructPiTodos replays tool results and manual entries in order", () => {
  const entries = [
    { type: "message", message: { role: "toolResult", toolName: "todo", details: stateA } },
    { type: "message", message: { role: "toolResult", toolName: "bash", details: { todos: [], nextId: 9 } } },
    { type: "custom", customType: "pi-todos", data: stateB },
    { type: "custom", customType: "other", data: stateA },
  ];
  assert.deepEqual(reconstructPiTodos(entries), stateB);
  assert.deepEqual(reconstructPiTodos([]), { todos: [], nextId: 1 });
});

test("piTodosFromEvent reads todo tool ends and pi-todos custom entries only", () => {
  assert.deepEqual(
    piTodosFromEvent({ type: "tool_execution_end", toolName: "todo", result: { details: stateA } }),
    stateA,
  );
  assert.deepEqual(
    piTodosFromEvent({ type: "entry_appended", entry: { type: "custom", customType: "pi-todos", data: stateB } }),
    stateB,
  );
  assert.equal(piTodosFromEvent({ type: "tool_execution_end", toolName: "bash", result: { details: stateA } }), null);
  assert.equal(piTodosFromEvent({ type: "entry_appended", entry: { type: "custom", customType: "pi-todos", data: { todos: "x" } } }), null);
  assert.equal(piTodosFromEvent({ type: "message_end" }), null);
});

test("piTodosFromEvent returns a copy, not the event's object", () => {
  const result = piTodosFromEvent({ type: "tool_execution_end", toolName: "todo", result: { details: stateA } });
  result.todos[0].done = true;
  assert.equal(stateA.todos[0].done, false);
});
