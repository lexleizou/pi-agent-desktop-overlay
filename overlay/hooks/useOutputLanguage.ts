/**
 * Client store for the reply-language preference.
 *
 * Folder: hooks/useOutputLanguage.ts (new file — no upstream file touched)
 *
 * Same shape as useChatAppearance: a module-level value with subscribers, so
 * the Settings choice and every prompt submission read one source. The value
 * lives in localStorage (it is a per-machine UI preference, not session
 * state) and is sent with each prompt, which is what lets a change apply to
 * the next message in sessions that are already open.
 */
"use client";

import { useSyncExternalStore } from "react";
import {
  OUTPUT_LANGUAGE_STORAGE_KEY,
  normalizeOutputLanguage,
  type OutputLanguage,
} from "@/lib/output-language";

let current: OutputLanguage | null = null;
const listeners = new Set<() => void>();

function readStored(): OutputLanguage {
  try {
    return normalizeOutputLanguage(window.localStorage.getItem(OUTPUT_LANGUAGE_STORAGE_KEY));
  } catch {
    return "auto";
  }
}

function getSnapshot(): OutputLanguage {
  if (typeof window === "undefined") return "auto";
  if (current === null) current = readStored();
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Read without subscribing — used when submitting a prompt. */
export function readOutputLanguage(): OutputLanguage {
  return getSnapshot();
}

export function setOutputLanguage(language: OutputLanguage): void {
  const next = normalizeOutputLanguage(language);
  current = next;
  try {
    window.localStorage.setItem(OUTPUT_LANGUAGE_STORAGE_KEY, next);
  } catch {
    // Best-effort persistence; the in-memory value still applies.
  }
  listeners.forEach((listener) => listener());
}

export function useOutputLanguage(): {
  outputLanguage: OutputLanguage;
  setOutputLanguage: (language: OutputLanguage) => void;
} {
  const outputLanguage = useSyncExternalStore(subscribe, getSnapshot, () => "auto" as OutputLanguage);
  return { outputLanguage, setOutputLanguage };
}
