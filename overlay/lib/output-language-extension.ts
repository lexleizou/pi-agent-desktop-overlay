import type { InlineExtension } from "@earendil-works/pi-coding-agent";
import {
  OUTPUT_LANGUAGE_MARKER,
  outputLanguageDirective,
  type OutputLanguage,
} from "./output-language";

export const OUTPUT_LANGUAGE_EXTENSION_NAME = "pi-web-output-language";

/**
 * Append the user's reply-language directive to the system prompt of every run.
 *
 * Folder: lib/output-language-extension.ts (new file — no upstream file touched)
 *
 * `before_agent_start` is the one hook that can still change the prompt: it
 * receives the prompt already rendered from Pi's sections plus any earlier
 * handler's changes, and returning `systemPrompt` replaces it for that run
 * (see lib/exact-system-prompt.ts for the same mechanism used by chat-only
 * sessions). Appending to the text received keeps every other section — tools,
 * context files, project rules — exactly as Pi built it.
 *
 * `getLanguage` is read on every run, so switching the setting applies to the
 * next message without recreating the session.
 */
export function createOutputLanguageExtension(
  getLanguage: () => OutputLanguage,
): InlineExtension {
  return {
    name: OUTPUT_LANGUAGE_EXTENSION_NAME,
    hidden: true,
    factory: (pi) => {
      pi.on("before_agent_start", (event) => {
        const directive = outputLanguageDirective(getLanguage());
        if (!directive) return undefined;
        // A prompt that already carries the directive (a host override, a
        // future double registration) must not be appended twice.
        if (event.systemPrompt.includes(OUTPUT_LANGUAGE_MARKER)) return undefined;
        return { systemPrompt: `${event.systemPrompt}\n\n${directive}` };
      });
    },
  };
}
