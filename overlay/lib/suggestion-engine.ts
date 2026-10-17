/**
 * Follow-up suggestion engine for pi-agent-desktop.
 *
 * Folder: lib/suggestion-engine.ts (new file — no upstream file touched)
 *
 * Runs right after a turn settles. Builds a bounded transcript from the live
 * session state (same approach as lib/session-title.ts), asks the session's
 * own model for the three next steps the user is most likely to want, and
 * returns validated suggestion strings for the SuggestionChips UI.
 *
 * Cost profile: one call per settled turn, transcript budgeted like the title
 * path (a few KB), output capped at a short JSON array. Cancel-safe via
 * AbortSignal.
 */
import { randomUUID } from "node:crypto";
import type {
  Agent,
  AgentMessage,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";
import {
  getSupportedThinkingLevels,
  normalizeContext,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";

const SUGGESTION_TIMEOUT_MS = 30_000;
const SUGGESTION_MAX_TOKENS = 220;
const MAX_SUGGESTIONS = 3;
const MIN_SUGGESTION_LENGTH = 2;
const MAX_SUGGESTION_LENGTH = 120; // characters, CJK-aware via Array.from

// Transcript budget. The engine reads like the title path: user turns carry
// intent, the final reply carries the state the user will react to; tool
// traffic is noise for this purpose.
const USER_CHARS = 600;
const ASSISTANT_CHARS = 240;
const LAST_ASSISTANT_CHARS = 500;
const TRANSCRIPT_CHARS = 5_000;

const ELISION = "[…]";
const IMAGE_PLACEHOLDER = "[image]";

const SUGGESTION_SYSTEM_PROMPT = [
  "You suggest what the user will most likely want to do next in a coding agent session.",
  "You never answer the user's question yourself; you suggest turns.",
].join(" ");

const SUGGESTION_PROMPT = `Based on the conversation above, write the three next steps the user is most likely to want to take in this coding-agent session.

Requirements:
- Match the primary language the user used in this session.
- Each suggestion is an instruction the user could send as their next message (e.g. "run the tests now", "把方案写成文档"), not a question the assistant would answer.
- Each suggestion is one line, at most 100 characters.
- Do not repeat a suggestion already covered well by the last assistant reply.
- Output strict JSON: {"suggestions": ["...", "...", "..."]} — an object with a "suggestions" key mapping to a plain JSON array of 3 short strings. No markdown, no explanation.

JSON:`;

export interface GeneratedSuggestions {
  suggestions: string[];
  usage?: {
    input: number;
    output: number;
    total: number;
  };
}

/** Cheap thinking: suggestions are a classification-shaped task. */
function resolveSuggestionThinkingLevel(model: Model<Api>): ThinkingLevel {
  if (!model.reasoning) return "off";
  const supported = getSupportedThinkingLevels(model);
  const rejectsMinimal = model.api === "google-generative-ai" || /gemini/i.test(model.id);
  const usable = rejectsMinimal
    ? supported.filter((level) => level !== "off" && level !== "minimal")
    : supported;
  return usable[0] ?? supported[0] ?? "off";
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  let images = 0;
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const type = (block as { type?: string }).type;
    if (type === "text" && typeof (block as { text?: unknown }).text === "string") {
      parts.push((block as { text: string }).text);
    } else if (type === "image") {
      images += 1;
    }
  }
  const text = parts.join("\n").trim();
  if (images === 0) return text;
  const marker = images === 1 ? IMAGE_PLACEHOLDER : `${IMAGE_PLACEHOLDER} ×${images}`;
  return text ? `${text}\n${marker}` : marker;
}

function clip(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length <= max ? text : `${characters.slice(0, max).join("")}…`;
}

/**
 * Keep both ends of the session: opening turns state the goal, the tail
 * carries the state the user reacts to. Mirrors the title path's budgeting.
 */
function boundTranscript(lines: string[]): string {
  const joined = lines.join("\n\n");
  if (joined.length <= TRANSCRIPT_CHARS || lines.length < 2) return joined;

  const head: string[] = [];
  let used = ELISION.length + 4;
  let next = 0;
  for (; next < lines.length; next++) {
    const size = used + lines[next].length + 2;
    if (head.length > 0 && size > TRANSCRIPT_CHARS * 0.4) break;
    head.push(lines[next]);
    used = size;
  }

  const tail: string[] = [];
  for (let i = lines.length - 1; i >= next; i--) {
    const size = used + lines[i].length + 2;
    if (size > TRANSCRIPT_CHARS) break;
    tail.unshift(lines[i]);
    used = size;
  }

  if (next + tail.length >= lines.length) return joined;
  return [...head, ELISION, ...tail].join("\n\n");
}

function lineForMessage(message: AgentMessage, lastAssistant?: AgentMessage): string | undefined {
  if (message.role === "compactionSummary" || message.role === "branchSummary") {
    const summary = message.summary.trim();
    return summary ? `[Earlier summary] ${clip(summary, 400)}` : undefined;
  }
  if (message.role !== "user" && message.role !== "assistant") return undefined;
  const text = textOf(message.content).trim();
  if (!text) return undefined;
  if (message.role === "user") return `User: ${clip(text, USER_CHARS)}`;
  return `Assistant: ${clip(text, message === lastAssistant ? LAST_ASSISTANT_CHARS : ASSISTANT_CHARS)}`;
}

export function buildSuggestionTranscript(messages: AgentMessage[]): string {
  let lastAssistant: AgentMessage | undefined;
  for (const message of messages) {
    if (message.role === "assistant" && textOf(message.content).trim()) lastAssistant = message;
  }
  const lines: string[] = [];
  for (const message of messages) {
    const line = lineForMessage(message, lastAssistant);
    if (line) lines.push(line);
  }
  return boundTranscript(lines);
}

/**
 * Parse the model's reply into validated suggestion strings. Tolerates
 * fenced JSON, a bare JSON array, or a JSON object with a "suggestions" key.
 */
export function parseSuggestions(raw: string): string[] {
  let value = raw.trim();
  const fenced = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) value = fenced[1].trim();

  let candidate: unknown = null;
  try {
    candidate = JSON.parse(value);
  } catch {
    // Tolerate leading prose before the JSON object/array.
    const brace = value.indexOf("{");
    const bracket = value.indexOf("[");
    const start = brace === -1
      ? bracket
      : bracket === -1
        ? brace
        : Math.min(brace, bracket);
    if (start !== -1) {
      const end = Math.max(value.lastIndexOf("}"), value.lastIndexOf("]"));
      if (end > start) {
        try {
          candidate = JSON.parse(value.slice(start, end + 1));
        } catch {
          candidate = null;
        }
  }
      }
    }

  const items: unknown[] = Array.isArray(candidate)
    ? candidate
    : candidate && typeof candidate === "object" && Array.isArray((candidate as { suggestions?: unknown }).suggestions)
      ? (candidate as { suggestions: unknown[] }).suggestions
      : [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    let text = item.trim().replace(/\s+/g, " ");
    text = text.replace(/^[-*•\d.)\s]+/, "").trim(); // strip bullets/numbering
    text = text.replace(/^["'“‘]+|["'”’]+$/g, "").trim();
    if (text.length < MIN_SUGGESTION_LENGTH) continue;
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clip(text, MAX_SUGGESTION_LENGTH));
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  if (out.length === 0) {
    throw new Error("The model did not return usable suggestions");
  }
  return out;
}

export function suggestionsFromAssistant(message: AssistantMessage): GeneratedSuggestions {
  if (message.stopReason === "error") {
    throw new Error(message.errorMessage || "The suggestion model request failed");
  }
  if (message.stopReason === "aborted") {
    throw new Error("Suggestion generation was aborted");
  }
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("The model did not return suggestions");
  return {
    suggestions: parseSuggestions(text),
    ...(message.usage ? {
      usage: {
        input: message.usage.input,
        output: message.usage.output,
        total: message.usage.totalTokens,
      },
    } : {}),
  };
}

/**
 * Generate suggestions from a live agent session. Called server-side after a
 * turn settles; never throws to the caller's await-chain wrongly — throws are
 * the API route's signal to return an error payload.
 */
export async function generateSuggestions(source: Agent): Promise<GeneratedSuggestions> {
  const transcript = buildSuggestionTranscript([...source.state.messages]);
  if (!transcript.trim()) {
    throw new Error("The session has no usable text to suggest from");
  }

  const model = source.state.model;
  if (!model) throw new Error("The session has no model selected");

  const thinkingLevel = resolveSuggestionThinkingLevel(model);
  const context: Context = {
    systemPrompt: SUGGESTION_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [{ type: "text", text: `${transcript}\n\n${SUGGESTION_PROMPT}` }],
      timestamp: Date.now(),
    }],
  };
  const options: SimpleStreamOptions = {
    maxTokens: SUGGESTION_MAX_TOKENS,
    cacheRetention: "none",
    sessionId: randomUUID(),
    transport: source.transport,
    thinkingBudgets: source.thinkingBudgets,
    maxRetryDelayMs: source.maxRetryDelayMs,
    ...(thinkingLevel !== "off" ? { reasoning: thinkingLevel } : {}),
  };

  const apiKey = await source.getApiKey?.(model.provider);
  const controller = new AbortController();
  const requestOptions: SimpleStreamOptions = {
    ...options,
    signal: controller.signal,
    ...(apiKey ? { apiKey } : {}),
  };

  const timeout = setTimeout(() => controller.abort(), SUGGESTION_TIMEOUT_MS);
  try {
    // Route through the session's own streamFunction rather than the standalone
    // `completeSimple` from pi-ai/compat. compat resolves credentials from a
    // fixed provider→env-var table (getEnvApiKey), which has no entry for a
    // custom provider such as the local `magpie` gateway, so every call failed
    // with "No API key for provider: magpie". The session-bound function already
    // carries the resolved auth from models.json, which is how the session
    // title path (lib/session-title.ts) has always worked.
    const stream = await source.streamFunction(model, normalizeContext(context), requestOptions);
    return suggestionsFromAssistant(await stream.result());
  } finally {
    clearTimeout(timeout);
  }
}
