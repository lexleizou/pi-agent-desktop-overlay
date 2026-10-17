/**
 * Output language preference — shared by the browser and the session host.
 *
 * Folder: lib/output-language.ts (new file — no upstream file touched)
 *
 * "auto" leaves the model's own behaviour alone (its system prompt, AGENTS.md,
 * the conversation). The forced modes append an explicit directive to the
 * system prompt for the run, which is the only place an instruction can
 * reliably outrank the model's own habits — a prefix on the user message is
 * visible in the transcript and easier for the model to drift away from.
 *
 * The value travels with each prompt (see the `prompt` RPC command), so the
 * choice applies from the next message in every open session — no session
 * restart, and no second copy of the setting on disk.
 */

export type OutputLanguage = "auto" | "zh-CN" | "en";

export const OUTPUT_LANGUAGE_STORAGE_KEY = "pi-output-language";

/** Marks a directive already present in a system prompt. */
export const OUTPUT_LANGUAGE_MARKER = "<!-- pi-web:output-language -->";

export function normalizeOutputLanguage(value: unknown): OutputLanguage {
  return value === "zh-CN" || value === "en" ? value : "auto";
}

/**
 * The instruction appended to the system prompt for one run, or null when the
 * model should decide for itself.
 */
export function outputLanguageDirective(language: OutputLanguage): string | null {
  if (language === "zh-CN") {
    return [
      OUTPUT_LANGUAGE_MARKER,
      "## 回复语言（用户设置）",
      "用户已要求在本次会话中**始终使用简体中文**回复，无论上文语言、模型默认或历史习惯如何：",
      "- 正文、说明、过程进展、小结与提问，全部使用简体中文。",
      "- 代码、命令、文件路径、标识符、日志原文与专有名词保留原文，不要翻译。",
      "- 这条设置优先于此前任何与语言相关的偏好。",
    ].join("\n");
  }
  if (language === "en") {
    return [
      OUTPUT_LANGUAGE_MARKER,
      "## Reply language (user setting)",
      "The user requires every reply in this session to be written in **English**, regardless of earlier preferences or the model default:",
      "- Prose, explanations, progress notes, summaries and questions: English.",
      "- Code, commands, file paths, identifiers, log excerpts and proper nouns stay as they are.",
      "- This setting outranks any earlier language preference.",
    ].join("\n");
  }
  return null;
}
